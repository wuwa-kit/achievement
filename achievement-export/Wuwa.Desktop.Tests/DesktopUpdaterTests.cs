using System.Net;
using System.Security.Cryptography;
using System.Text.Json;
using Wuwa.Desktop;

internal static class DesktopUpdaterTests
{
    public static async Task RunAsync(string directory)
    {
        const string tag = "v0.10.0";
        const string standardName = "WuwaAchievementExport-Full-v0.10.0.exe";
        const string liteName = "WuwaAchievementExport-Lite-v0.10.0.exe";
        var standardBytes = new byte[] { 10, 20, 30 };
        var liteBytes = new byte[] { 40, 50 };
        var payloads = new Dictionary<string, byte[]> { [standardName] = standardBytes, [liteName] = liteBytes };
        var release = new UpdateRelease(1, tag, "Release notes",
            new(Asset(standardName, standardBytes), Asset(liteName, liteBytes)));
        var manifest = release;
        Uri? redirect = null;
        HttpStatusCode manifestStatus = HttpStatusCode.OK;
        Exception? requestFailure = null;
        string? manifestBody = null;
        using var client = new HttpClient(new ReleaseHandler(uri =>
        {
            if (uri.AbsolutePath.EndsWith("/update.json", StringComparison.Ordinal))
            {
                if (requestFailure is not null) throw requestFailure;
                if (redirect is not null && uri.AbsolutePath.EndsWith("/latest/download/update.json", StringComparison.Ordinal))
                    return new(HttpStatusCode.Redirect) { Headers = { Location = redirect } };
                if (manifestStatus != HttpStatusCode.OK) return new(manifestStatus);
                return new(HttpStatusCode.OK)
                {
                    Content = new StringContent(manifestBody ?? JsonSerializer.Serialize(manifest, JsonSerializerOptions.Web))
                };
            }
            Check(uri.AbsolutePath.StartsWith($"/wuwa-kit/achievement/releases/download/{tag}/", StringComparison.Ordinal));
            return new(HttpStatusCode.OK) { Content = new ByteArrayContent(payloads[Path.GetFileName(uri.AbsolutePath)]) };
        }));
        var target = Directory.CreateDirectory(Path.Combine(directory, "updates")).FullName;
        var updater = new DesktopUpdater(target, client);
        Check(await updater.CheckAsync("v0.9.9") == new UpdateCheckResult("checked", release));
        Check(await updater.CheckAsync("v0.10.0-beta.1") == new UpdateCheckResult("checked", release));
        Check(await updater.CheckAsync(tag) == new UpdateCheckResult("checked"));
        Check(await updater.CheckAsync("v0.11.0") == new UpdateCheckResult("checked"));

        var legacyStandard = Asset("WuwaAchievementExport-v0.10.0.exe", standardBytes);
        manifest = release with { Assets = release.Assets with { Standard = legacyStandard } };
        Check(await updater.CheckAsync("v0.9.9") == new UpdateCheckResult("checked", manifest));
        manifest = release;

        redirect = new Uri("https://github.com/wuwa-kit/achievement/releases/download/v0.10.0/update.json");
        manifestStatus = HttpStatusCode.NotFound;
        Check(await updater.CheckAsync("v0.9.9") == new UpdateCheckResult("manifestMissing"));
        redirect = null;
        manifestStatus = HttpStatusCode.ServiceUnavailable;
        Check(await updater.CheckAsync("v0.9.9") == new UpdateCheckResult("httpError", HttpStatus: 503));
        manifestStatus = HttpStatusCode.OK;
        requestFailure = new HttpRequestException("DNS failure.");
        Check(await updater.CheckAsync("v0.9.9") == new UpdateCheckResult("networkError"));
        requestFailure = new OperationCanceledException();
        Check(await updater.CheckAsync("v0.9.9") == new UpdateCheckResult("checkTimeout"));
        requestFailure = null;
        manifestBody = "<html>Unexpected response</html>";
        Check(await updater.CheckAsync("v0.9.9") == new UpdateCheckResult("invalidManifest"));
        manifestBody = null;

        manifest = release with { Assets = release.Assets with { Standard = release.Assets.Standard with { FileName = "../wrong.exe" } } };
        Check(await updater.CheckAsync("v0.9.9") == new UpdateCheckResult("invalidManifest"));
        manifest = release;
        redirect = new Uri("https://example.com/download/update.json");
        Check(await updater.CheckAsync("v0.9.9") == new UpdateCheckResult("invalidManifest"));
        redirect = null;

        var progress = new Progress<long>();
        payloads[liteName] = [41, 51];
        await RejectInvalid(() => updater.DownloadAsync(tag, release.Assets.Lite, progress, default));
        Check(Directory.GetFiles(target).Length == 0);
        payloads[liteName] = liteBytes;
        foreach (var asset in new[] { release.Assets.Standard, release.Assets.Lite })
        {
            await updater.DownloadAsync(tag, asset, progress, default);
            await updater.DownloadAsync(tag, asset, progress, default);
            Check(File.ReadAllBytes(Path.Combine(target, asset.FileName)).SequenceEqual(payloads[asset.FileName]));
        }
        Check(Directory.GetFiles(target).Length == 2);
        var standardPath = Path.Combine(target, standardName);
        File.WriteAllBytes(standardPath, [1, 2, 3]);
        await RejectInvalid(() => updater.OpenVerifiedAsync(release.Assets.Standard));
        await RejectInvalid(() => updater.DownloadAsync(tag, release.Assets.Standard, progress, default));
        Check(File.ReadAllBytes(standardPath).SequenceEqual(new byte[] { 1, 2, 3 }));
        Console.WriteLine("Desktop update version ordering, check errors, edition selection, download integrity and file reuse passed.");
    }

    private static UpdateAsset Asset(string fileName, byte[] bytes) => new(fileName, bytes.Length, Convert.ToHexString(SHA256.HashData(bytes)));

    private static void Check(bool condition)
    {
        if (!condition) throw new Exception("Desktop update assertion failed.");
    }

    private static async Task RejectInvalid(Func<Task> action)
    {
        try { await action(); }
        catch (InvalidDataException) { return; }
        throw new Exception("Invalid desktop update was accepted.");
    }

    private sealed class ReleaseHandler(Func<Uri, HttpResponseMessage> response) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(response(request.RequestUri!));
    }
}
