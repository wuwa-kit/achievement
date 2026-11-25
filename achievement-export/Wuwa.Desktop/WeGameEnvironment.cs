using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Win32.SafeHandles;

namespace Wuwa.Desktop;

internal static class WeGameEnvironment
{
    internal sealed record SdkStatus(string Status, long Received = 0, long Total = 0);
    internal sealed record PreparationPlan(string Game, string Data, string GameSignature, string Signature,
        Uri BaseUrl, JsonNode[] Files, JsonNode[] SdkFiles, string[] Previous, Dictionary<string, string> Reusable)
    {
        internal bool Ready { get; set; }
        internal string Source => Path.GetDirectoryName(Game)!;
        internal string Installation => Path.Combine(Data, "WeGame", Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Source.ToUpperInvariant())))[..16]);
        internal string Root => Path.Combine(Installation, "game");
        internal string Staging => Path.Combine(Installation, "staging", Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Signature)))[..16]);
        internal long DownloadSize => SdkFiles.Where(file => !Reusable.ContainsKey(file["dest"]!.GetValue<string>())).Sum(file => file["size"]!.GetValue<long>());
        internal SdkStatus Status => new(Ready ? "ready" : File.Exists(Path.Combine(Root, "ready.json")) || Previous.Any(Directory.Exists) ? "outdated" : "missing", 0, Ready ? 0 : DownloadSize);
        internal SdkStatus StartStatus => Ready ? new("ready") : new(DownloadSize > 0 ? "downloading" : "preparing", 0, DownloadSize);
        internal bool MatchesGame(string game, string data) =>
            string.Equals(Game, Path.GetFullPath(game), StringComparison.OrdinalIgnoreCase) &&
            string.Equals(Data, Path.GetFullPath(data), StringComparison.OrdinalIgnoreCase) &&
            GameSignature == ReadGameSignature(Source);
    }

    internal static async Task<SdkStatus> Check(string game, string data, CancellationToken token, HttpClient? client = null) =>
        (await Inspect(game, data, token, client))?.Status ?? new("notApplicable");

    private static string ReadGameSignature(string source) => string.Join('|', new[] { "Wuthering Waves.exe", "Client/Binaries/Win64/Client-Win64-Shipping.exe", "Client/Binaries/Win64/coreclr.dll", "rail_files/rail_game_build_info.dat" }.Select(p =>
    {
        var file = new FileInfo(Path.Combine(source, p));
        return $"{p}:{file.Length}:{file.LastWriteTimeUtc.Ticks}";
    }));

    internal const string Sdk = "Client/Binaries/Win64/ThirdParty/KrPcSdk_Mainland";
    private const string Index = "https://prod-cn-alicdn-gamestarter.kurogame.com/launcher/game/10003_oLNgHF1CESo51DGHN2odtp40e3oI1HfZ/G152/official/index.json";
    private static readonly HttpClient Http = new(new HttpClientHandler { AutomaticDecompression = System.Net.DecompressionMethods.All }) { Timeout = TimeSpan.FromMinutes(15) };

    internal static bool IsWeGame(string game)
    {
        var identify = Path.Combine(Path.GetDirectoryName(Path.GetFullPath(game))!, "rail_files/rail_game_identify.json");
        if (!File.Exists(identify)) return false;
        try { return JsonNode.Parse(File.ReadAllText(identify))?["game_id"]?.ToString() == "2002137"; }
        catch (System.Text.Json.JsonException) { return false; }
    }

    internal static string ResolveFile(string root, string relative)
    {
        string path = Path.GetFullPath(Path.Combine(root, relative));
        if (!path.StartsWith(Path.GetFullPath(root) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Invalid official manifest path");
        return path;
    }

    internal static async Task<PreparationPlan?> Inspect(string game, string data, CancellationToken token, HttpClient? client = null)
    {
        client ??= Http;
        token.ThrowIfCancellationRequested();
        if (!IsWeGame(game)) return null;
        game = Path.GetFullPath(game);
        data = Path.GetFullPath(data);
        string source = Path.GetDirectoryName(game)!;
        string key = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(source.ToUpperInvariant())))[..16];
        string root = Path.Combine(data, "WeGame", key);
        string signature = ReadGameSignature(source);
        var index = JsonNode.Parse(await client.GetStringAsync(Index, token))!;
        var pack = index["resourcePacks"]!["common"]!;
        var cdn = new Uri(index["cdnList"]![0]!["url"]!.GetValue<string>());
        byte[] manifestBytes = await client.GetByteArrayAsync(new Uri(cdn, pack["indexFile"]!.GetValue<string>()), token);
        if (!Convert.ToHexString(MD5.HashData(manifestBytes)).Equals(pack["indexFileMd5"]!.GetValue<string>(), StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Official manifest checksum mismatch");
        var files = JsonNode.Parse(manifestBytes)!["resource"]!.AsArray().Select(n => n!).ToArray();
        // Do not combine an older installed executable with the latest channel SDK.
        var executable = files.Single(n => n["dest"]!.GetValue<string>() == "Client/Binaries/Win64/Client-Win64-Shipping.exe");
        if (!Matches(Path.Combine(source, executable["dest"]!.GetValue<string>()), executable))
            throw new InvalidDataException("wegameVersionMismatch");
        var sdkFiles = files.Where(n => n["dest"]!.GetValue<string>().StartsWith(Sdk + "/", StringComparison.Ordinal)).ToArray();
        if (sdkFiles.Length == 0) throw new InvalidDataException("Official SDK manifest is empty");
        string sdkSignature = System.Text.Json.JsonSerializer.Serialize(sdkFiles
            .OrderBy(n => n["dest"]!.GetValue<string>(), StringComparer.Ordinal)
            .Select(n => new { path = n["dest"]!.GetValue<string>(), size = n["size"]!.GetValue<long>(), md5 = n["md5"]!.GetValue<string>().ToLowerInvariant() }));
        string gameSignature = signature;
        signature += "|sdk:" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(sdkSignature)));
        string installation = root;
        root = Path.Combine(installation, "game");
        string staging = Path.Combine(installation, "staging", Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(signature)))[..16]);
        string marker = Path.Combine(root, "ready.json");
        if (File.Exists(marker) && await File.ReadAllTextAsync(marker, token) == signature &&
            File.Exists(Path.Combine(root, "Wuthering Waves.exe")) &&
            File.Exists(Path.Combine(root, "Client/Binaries/Win64/Client-Win64-Shipping.exe")) &&
            sdkFiles.All(file => Matches(ResolveFile(root, file["dest"]!.GetValue<string>()), file)))
        {
            return new(game, data, gameSignature, signature, new Uri(cdn, pack["baseUrl"]!.GetValue<string>()), files, sdkFiles, [], new()) { Ready = true };
        }
        string[] previous = Directory.Exists(installation) ? new DirectoryInfo(installation).EnumerateDirectories()
            .Where(d => d.FullName != root && d.Name.Length == 16 && d.Name.All(char.IsAsciiHexDigit) &&
                !d.Attributes.HasFlag(FileAttributes.ReparsePoint) && File.Exists(Path.Combine(d.FullName, "ready.json")))
            .OrderByDescending(d => File.GetLastWriteTimeUtc(Path.Combine(d.FullName, "ready.json")))
            .Select(d => d.FullName).ToArray() : [];
        var reusable = new Dictionary<string, string>();
        foreach (var file in sdkFiles)
        {
            token.ThrowIfCancellationRequested();
            string relative = file["dest"]!.GetValue<string>();
            string? existing = new[] { staging, root, source }.Concat(previous).Select(basePath => ResolveFile(basePath, relative)).FirstOrDefault(path => Matches(path, file));
            if (existing is not null) reusable[relative] = existing;
        }
        return new(game, data, gameSignature, signature, new Uri(cdn, pack["baseUrl"]!.GetValue<string>()), files, sdkFiles, previous, reusable);
    }

    internal static async Task<string> Prepare(string game, string data, IProgress<string> progress, CancellationToken token, HttpClient? client = null, Action<SdkStatus>? report = null, PreparationPlan? plan = null)
    {
        client ??= Http;
        token.ThrowIfCancellationRequested();
        if (!IsWeGame(game)) return game;
        foreach (var process in Process.GetProcessesByName("Client-Win64-Shipping"))
            using (process) throw new InvalidOperationException("wegameGameRunning");
        if (plan is null || !plan.MatchesGame(game, data))
        {
            report?.Invoke(new("checking"));
            progress.Report("wegamePreparing");
            plan = (await Inspect(game, data, token, client))!;
        }
        try
        {
            string source = plan.Source, root = plan.Root, installation = plan.Installation, staging = plan.Staging;
            string signature = plan.Signature, gameSignature = plan.GameSignature;
            string marker = Path.Combine(root, "ready.json");
            var files = plan.Files;
            var sdkFiles = plan.SdkFiles;
            var previous = plan.Previous;
            var reusable = plan.Reusable;
            if (plan.Ready)
            {
                LinkResources(source, root);
                CleanupOldEnvironments(root, token);
                report?.Invoke(new("ready"));
                return Path.Combine(root, "Wuthering Waves.exe");
            }
            long total = plan.DownloadSize, received = 0;
            Directory.CreateDirectory(staging);
            report?.Invoke(new(total > 0 ? "downloading" : "preparing", 0, total));
            progress.Report(total > 0 ? "wegameDownloading" : "wegameLinking");
            foreach (var file in sdkFiles)
            {
                token.ThrowIfCancellationRequested();
                string relative = file["dest"]!.GetValue<string>();
                string destination = ResolveFile(staging, relative);
                Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
                if (reusable.TryGetValue(relative, out var existing))
                {
                    if (!string.Equals(existing, destination, StringComparison.OrdinalIgnoreCase)) File.Copy(existing, destination, true);
                    reusable[relative] = destination;
                    continue;
                }
                string partial = destination + ".download";
                using (var response = await client.GetAsync(new Uri(plan.BaseUrl, relative), HttpCompletionOption.ResponseHeadersRead, token))
                {
                    response.EnsureSuccessStatusCode();
                    await using var output = File.Create(partial);
                    await using var input = await response.Content.ReadAsStreamAsync(token);
                    byte[] buffer = new byte[128 * 1024];
                    long lastReport = Environment.TickCount64;
                    int count;
                    while ((count = await input.ReadAsync(buffer, token)) > 0)
                    {
                        await output.WriteAsync(buffer.AsMemory(0, count), token);
                        received += count;
                        if (Environment.TickCount64 - lastReport >= 100)
                        {
                            report?.Invoke(new("downloading", received, total));
                            lastReport = Environment.TickCount64;
                        }
                    }
                    report?.Invoke(new("downloading", received, total));
                }
                if (!Matches(partial, file)) throw new InvalidDataException("Official SDK checksum mismatch: " + relative);
                File.Move(partial, destination, true);
                reusable[relative] = destination;
            }
            progress.Report("wegameLinking");
            report?.Invoke(new("preparing", received, total));
            token.ThrowIfCancellationRequested();
            // Adopt the previous environment once; its configuration and runtime data stay in place thereafter.
            if (!Directory.Exists(root) && previous.FirstOrDefault() is { } prior)
            {
                if (Path.GetDirectoryName(prior) != installation || new DirectoryInfo(prior).Attributes.HasFlag(FileAttributes.ReparsePoint))
                    throw new IOException("Unexpected environment migration path");
                Directory.Move(prior, root);
            }
            Directory.CreateDirectory(root);
            string oldSignature = File.Exists(marker) ? await File.ReadAllTextAsync(marker, token) : "";
            if (!oldSignature.StartsWith(gameSignature + "|sdk:", StringComparison.Ordinal) ||
                !File.Exists(Path.Combine(root, "Client/Binaries/Win64/Client-Win64-Shipping.exe")))
            {
                CopyTree(Path.Combine(source, "Engine"), Path.Combine(root, "Engine"), false, token);
                CopyTree(Path.Combine(source, "Client"), Path.Combine(root, "Client"), true, token, source);
                // Only refresh installed program files when the base game changes; keep runtime-created files and Saved.
                foreach (var file in files.Where(n => n["dest"]!.GetValue<string>().StartsWith("Client/Binaries/", StringComparison.Ordinal) &&
                    !n["dest"]!.GetValue<string>().StartsWith(Sdk + "/", StringComparison.Ordinal)))
                {
                    token.ThrowIfCancellationRequested();
                    string relative = file["dest"]!.GetValue<string>();
                    string original = ResolveFile(source, relative);
                    if (File.Exists(original)) { string target = ResolveFile(root, relative); Directory.CreateDirectory(Path.GetDirectoryName(target)!); File.Copy(original, target, true); }
                }
                File.Copy(game, Path.Combine(root, "Wuthering Waves.exe"), true);
            }
            string installedManifest = Path.Combine(root, "sdk-files.json");
            string[] oldFiles = File.Exists(installedManifest) ? System.Text.Json.JsonSerializer.Deserialize<string[]>(await File.ReadAllTextAsync(installedManifest, token))! : [];
            var newFiles = sdkFiles.Select(file => file["dest"]!.GetValue<string>()).ToHashSet(StringComparer.OrdinalIgnoreCase);
            File.Delete(marker);
            foreach (string relative in newFiles)
            {
                token.ThrowIfCancellationRequested();
                string target = ResolveFile(root, relative);
                Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                File.Copy(ResolveFile(staging, relative), target, true);
            }
            foreach (string relative in oldFiles.Where(path => !newFiles.Contains(path) && path.StartsWith(Sdk + "/", StringComparison.Ordinal)))
                File.Delete(ResolveFile(root, relative));
            await File.WriteAllTextAsync(installedManifest, System.Text.Json.JsonSerializer.Serialize(newFiles), token);
            LinkResources(source, root);
            await File.WriteAllTextAsync(marker, signature, token);
            plan.Ready = true;
            CleanupOldEnvironments(root, token);
            DeleteWithoutFollowingLinks(new DirectoryInfo(Path.Combine(installation, "staging")), token);
            report?.Invoke(new("ready", received, total));
            return Path.Combine(root, "Wuthering Waves.exe");
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested)
        {
            ClearDownloads(plan, CancellationToken.None);
            report?.Invoke(plan.Status);
            throw;
        }
    }

    internal static void ClearDownloads(PreparationPlan plan, CancellationToken token)
    {
        string installation = Path.GetFullPath(plan.Installation);
        var staging = new DirectoryInfo(Path.Combine(installation, "staging"));
        if (staging.Exists)
        {
            if (staging.Parent?.FullName != installation ||
                new DirectoryInfo(installation).Attributes.HasFlag(FileAttributes.ReparsePoint) ||
                new DirectoryInfo(Path.Combine(plan.Data, "WeGame")).Attributes.HasFlag(FileAttributes.ReparsePoint))
                throw new IOException("Unexpected download cleanup path");
            DeleteWithoutFollowingLinks(staging, token);
        }
        plan.Reusable.Clear();
        if (plan.Ready) return;
        foreach (var file in plan.SdkFiles)
        {
            token.ThrowIfCancellationRequested();
            string relative = file["dest"]!.GetValue<string>();
            string? existing = new[] { plan.Root, plan.Source }.Concat(plan.Previous)
                .Select(root => ResolveFile(root, relative)).FirstOrDefault(path => Matches(path, file));
            if (existing is not null) plan.Reusable[relative] = existing;
        }
    }

    internal static void CleanupOldEnvironments(string current, CancellationToken token)
    {
        var active = new DirectoryInfo(Path.GetFullPath(current));
        var installation = active.Parent!;
        if (!File.Exists(Path.Combine(active.FullName, "ready.json"))) return;
        // Only this installation's generated version directories belong to this cleanup.
        if (installation.Attributes.HasFlag(FileAttributes.ReparsePoint) || active.Attributes.HasFlag(FileAttributes.ReparsePoint))
            throw new IOException("Capture environment must not be a directory link");
        foreach (var old in installation.EnumerateDirectories())
        {
            token.ThrowIfCancellationRequested();
            if (string.Equals(old.FullName, active.FullName, StringComparison.OrdinalIgnoreCase) ||
                old.Name.Length != 16 || !old.Name.All(char.IsAsciiHexDigit)) continue;
            if (!string.Equals(old.Parent?.FullName, installation.FullName, StringComparison.OrdinalIgnoreCase))
                throw new IOException("Unexpected capture cleanup path");
            try { DeleteWithoutFollowingLinks(old, token); }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException)
            {
                // Locked files remain for the next preparation; a usable environment can still launch.
                Trace.TraceWarning("Could not clean capture environment {0}: {1}", old.FullName, error.Message);
            }
        }
    }

    private static void DeleteWithoutFollowingLinks(DirectoryInfo directory, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        if (directory.Attributes.HasFlag(FileAttributes.ReparsePoint))
        {
            directory.Delete();
            return;
        }
        foreach (var item in directory.EnumerateFileSystemInfos())
        {
            token.ThrowIfCancellationRequested();
            if (item is DirectoryInfo child) DeleteWithoutFollowingLinks(child, token);
            else item.Delete();
        }
        directory.Delete();
    }

    private static bool Matches(string path, JsonNode file)
    {
        if (!File.Exists(path) || new FileInfo(path).Length != file["size"]!.GetValue<long>()) return false;
        using var stream = File.OpenRead(path);
        return Convert.ToHexString(MD5.HashData(stream)).Equals(file["md5"]!.GetValue<string>(), StringComparison.OrdinalIgnoreCase);
    }

    private static void CopyTree(string source, string target, bool preserve, CancellationToken token, string? gameRoot = null)
    {
        Directory.CreateDirectory(target);
        foreach (var item in new DirectoryInfo(source).EnumerateFileSystemInfos())
        {
            token.ThrowIfCancellationRequested();
            string relative = gameRoot is null ? "" : Path.GetRelativePath(gameRoot, item.FullName).Replace('\\', '/');
            if (relative is "Client/Content" or "Client/Saved/Resources" || relative.StartsWith(Sdk, StringComparison.Ordinal)) continue;
            if (item.Attributes.HasFlag(FileAttributes.ReparsePoint)) throw new IOException("Unexpected source link: " + item.FullName);
            string destination = Path.Combine(target, item.Name);
            if (item is DirectoryInfo) CopyTree(item.FullName, destination, preserve || relative == "Client/Saved", token, gameRoot);
            else if (!preserve || !File.Exists(destination)) File.Copy(item.FullName, destination, true);
        }
    }

    private static void LinkResources(string source, string root)
    {
        foreach (string relative in new[] { "Client/Content", "Client/Saved/Resources" })
        {
            string target = Path.Combine(source, relative);
            // A first launch may not have a hot-update resource directory yet.
            Directory.CreateDirectory(target);
            Junction(Path.Combine(root, relative), target);
        }
    }

    internal static void Junction(string path, string target)
    {
        var directory = new DirectoryInfo(path);
        if (directory.Exists)
        {
            if (directory.LinkTarget is not null && string.Equals(directory.ResolveLinkTarget(true)?.FullName, Path.GetFullPath(target), StringComparison.OrdinalIgnoreCase)) return;
            throw new IOException("Resource link destination is already occupied: " + path);
        }
        Directory.CreateDirectory(path);
        string substitute = @"\??\" + Path.GetFullPath(target);
        byte[] substituteBytes = Encoding.Unicode.GetBytes(substitute);
        byte[] printBytes = Encoding.Unicode.GetBytes(Path.GetFullPath(target));
        byte[] buffer = new byte[16 + substituteBytes.Length + printBytes.Length + 4];
        BitConverter.GetBytes(0xA0000003u).CopyTo(buffer, 0);
        BitConverter.GetBytes((ushort)(buffer.Length - 8)).CopyTo(buffer, 4);
        BitConverter.GetBytes((ushort)substituteBytes.Length).CopyTo(buffer, 10);
        BitConverter.GetBytes((ushort)(substituteBytes.Length + 2)).CopyTo(buffer, 12);
        BitConverter.GetBytes((ushort)printBytes.Length).CopyTo(buffer, 14);
        substituteBytes.CopyTo(buffer, 16); printBytes.CopyTo(buffer, 18 + substituteBytes.Length);
        using var handle = CreateFile(path, 0x40000000, 0, IntPtr.Zero, 3, 0x02200000, IntPtr.Zero);
        if (handle.IsInvalid || !DeviceIoControl(handle, 0x000900A4, buffer, buffer.Length, IntPtr.Zero, 0, out _, IntPtr.Zero))
        {
            int error = Marshal.GetLastWin32Error();
            handle.Dispose();
            Directory.Delete(path);
            throw new System.ComponentModel.Win32Exception(error);
        }
    }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true, EntryPoint = "CreateFileW")]
    private static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool DeviceIoControl(SafeFileHandle handle, uint code, byte[] input, int size, IntPtr output, int outputSize, out int returned, IntPtr overlapped);
}
