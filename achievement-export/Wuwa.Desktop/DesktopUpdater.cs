using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Wuwa.Desktop;

internal sealed record UpdateAsset(string FileName, long Size, string Sha256);
internal sealed record UpdateAssets(UpdateAsset Standard, UpdateAsset Lite)
{
    public UpdateAsset Select(string edition) => edition switch
    {
        "standard" => Standard,
        "lite" => Lite,
        _ => throw new ArgumentException("Unknown desktop edition.", nameof(edition))
    };
}
internal sealed record UpdateRelease(int SchemaVersion, string Version, string Notes, UpdateAssets Assets);
internal sealed record UpdateCheckResult(string Status, UpdateRelease? Release = null, int? HttpStatus = null);

internal sealed class DesktopUpdater(string directory, HttpClient client)
{
    private const string Repository = "https://github.com/wuwa-kit/achievement/releases/";
    private const string ReleasePath = "/wuwa-kit/achievement/releases/";
    private const string ManifestName = "update.json";
    private const long MaxAssetSize = 1024 * 1024 * 1024;
    private static readonly TimeSpan DownloadIdleTimeout = TimeSpan.FromSeconds(30);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly Regex VersionPattern = new(@"\Av?([0-9]{1,9}\.[0-9]{1,9}\.[0-9]{1,9})(-[0-9A-Za-z.-]+)?\z");

    public static HttpClient CreateClient() => new(new HttpClientHandler { AllowAutoRedirect = false })
    {
        MaxResponseContentBufferSize = 128 * 1024
    };

    public async Task<UpdateCheckResult> CheckAsync(string currentTag)
    {
        try { return new("checked", await ReadNewReleaseAsync(currentTag).ConfigureAwait(false)); }
        catch (OperationCanceledException) { return new("checkTimeout"); }
        catch (HttpRequestException error)
        {
            return error.StatusCode switch
            {
                HttpStatusCode.NotFound => new("manifestMissing"),
                HttpStatusCode status => new("httpError", HttpStatus: (int)status),
                _ when error.HttpRequestError == HttpRequestError.ConfigurationLimitExceeded => new("invalidManifest"),
                _ => new("networkError")
            };
        }
        catch (HttpIOException) { return new("networkError"); }
        catch (Exception error) when (error is JsonException or InvalidDataException or UriFormatException)
        {
            return new("invalidManifest");
        }
    }

    private async Task<UpdateRelease?> ReadNewReleaseAsync(string currentTag)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(12));
        using var response = await GetAsync(new Uri(Repository + "latest/download/" + ManifestName),
            HttpCompletionOption.ResponseContentRead, timeout.Token).ConfigureAwait(false);
        var json = await response.Content.ReadAsByteArrayAsync(timeout.Token).ConfigureAwait(false);
        var release = JsonSerializer.Deserialize<UpdateRelease>(json, JsonOptions);
        if (release is null || release.SchemaVersion != 1 || string.IsNullOrWhiteSpace(release.Notes) ||
            !TryReadVersion(release.Version, out var latest, out var preview) || preview ||
            !ValidAsset(release.Assets?.Standard, $"WuwaAchievementExport-{release.Version}.exe") ||
            !ValidAsset(release.Assets?.Lite, $"WuwaAchievementExport-Lite-{release.Version}.exe") ||
            !TryReadVersion(currentTag, out var current, out var currentIsPreview))
            throw new InvalidDataException("Invalid desktop update manifest or version.");

        return latest > current || (currentIsPreview && latest == current) ? release : null;
    }

    public async Task DownloadAsync(string tag, UpdateAsset asset, IProgress<long> progress, CancellationToken cancellation)
    {
        var path = AssetPath(asset);
        if (File.Exists(path))
        {
            using var existing = await OpenVerifiedAsync(asset, cancellation).ConfigureAwait(false);
            return;
        }

        var temporary = path + "." + Guid.NewGuid().ToString("N") + ".part";
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
            timeout.CancelAfter(DownloadIdleTimeout);
            using var response = await GetAsync(new Uri(Repository + $"download/{tag}/{asset.FileName}"),
                HttpCompletionOption.ResponseHeadersRead, timeout.Token).ConfigureAwait(false);
            if (response.Content.Headers.ContentLength is long size && size != asset.Size)
                throw new InvalidDataException("Unexpected update size.");

            await using (var target = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 65536, useAsync: true))
            {
                using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
                await using var source = await response.Content.ReadAsStreamAsync(timeout.Token).ConfigureAwait(false);
                var buffer = new byte[65536];
                var interval = Stopwatch.StartNew();
                long received = 0;
                while (true)
                {
                    timeout.CancelAfter(DownloadIdleTimeout);
                    var count = await source.ReadAsync(buffer, timeout.Token).ConfigureAwait(false);
                    if (count == 0) break;
                    received += count;
                    if (received > asset.Size) throw new InvalidDataException("Unexpected update size.");
                    await target.WriteAsync(buffer.AsMemory(0, count), timeout.Token).ConfigureAwait(false);
                    hash.AppendData(buffer, 0, count);
                    if (interval.ElapsedMilliseconds < 100) continue;
                    interval.Restart();
                    progress.Report(received);
                }
                if (received != asset.Size || !HashMatches(hash.GetHashAndReset(), asset))
                    throw new InvalidDataException("Update integrity check failed.");
                await target.FlushAsync(timeout.Token).ConfigureAwait(false);
            }
            cancellation.ThrowIfCancellationRequested();
            try { File.Move(temporary, path); }
            catch (IOException) when (File.Exists(path))
            {
                // Another instance may have downloaded the same asset in the meantime.
                using var existing = await OpenVerifiedAsync(asset, cancellation).ConfigureAwait(false);
            }
        }
        finally
        {
            try { File.Delete(temporary); }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException) { Trace.TraceWarning(error.ToString()); }
        }
    }

    // Keep the verified EXE open without write/delete sharing until the process starts.
    public async Task<FileStream> OpenVerifiedAsync(UpdateAsset asset, CancellationToken cancellation = default)
    {
        var path = AssetPath(asset);
        if ((File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
            throw new InvalidDataException("The update executable is a reparse point.");
        var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 65536, useAsync: true);
        try
        {
            if (file.Length != asset.Size || !HashMatches(await SHA256.HashDataAsync(file, cancellation).ConfigureAwait(false), asset))
                throw new InvalidDataException("Update integrity check failed.");
            return file;
        }
        catch
        {
            await file.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    private string AssetPath(UpdateAsset asset) => Path.Combine(directory, asset.FileName);

    private static bool HashMatches(byte[] hash, UpdateAsset asset) =>
        Convert.ToHexString(hash).Equals(asset.Sha256, StringComparison.OrdinalIgnoreCase);

    private static bool ValidAsset(UpdateAsset? asset, string fileName) => asset is not null &&
        asset.FileName == fileName && asset.Size is > 0 and <= MaxAssetSize &&
        asset.Sha256 is { Length: 64 } hash && hash.All(Uri.IsHexDigit);

    private static bool TryReadVersion(string? tag, out Version? version, out bool preview)
    {
        var match = VersionPattern.Match(tag ?? "");
        preview = match.Groups[2].Success;
        return Version.TryParse(match.Groups[1].Value, out version);
    }

    private async Task<HttpResponseMessage> GetAsync(Uri uri, HttpCompletionOption completion, CancellationToken cancellation)
    {
        for (var redirects = 0; redirects <= 5; redirects++)
        {
            if (!IsReleaseUri(uri)) throw new InvalidDataException("Untrusted desktop update address.");
            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            request.Headers.CacheControl = new CacheControlHeaderValue { NoCache = true };
            var response = await client.SendAsync(request, completion, cancellation).ConfigureAwait(false);
            if (response.StatusCode == HttpStatusCode.OK) return response;
            using (response)
            {
                if ((int)response.StatusCode is < 300 or >= 400 || response.Headers.Location is not { } location)
                    throw new HttpRequestException("Desktop update asset unavailable.", null, response.StatusCode);
                uri = new Uri(uri, location);
            }
        }
        throw new InvalidDataException("Too many desktop update redirects.");
    }

    private static bool IsReleaseUri(Uri uri) => uri.Scheme == Uri.UriSchemeHttps && uri.IsDefaultPort &&
        uri.UserInfo.Length == 0 && (uri.Host is "release-assets.githubusercontent.com" or "objects.githubusercontent.com" ||
        (uri.Host == "github.com" && uri.AbsolutePath.StartsWith(ReleasePath, StringComparison.Ordinal)));
}
