using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;
using Wuwa.Export;

namespace Wuwa.Desktop;

internal static class DiagnosticArchive
{
    private static readonly EnumerationOptions LocalFiles = new() { AttributesToSkip = FileAttributes.ReparsePoint };
    private static readonly Regex GameLine = new(
        @"^\[[0-9.:\-]+\](?:\[[ A-Za-z0-9_\-]{1,32}\])*(?:Sharphereal: (?:Display|Log): )?\[C#\](?:\[[ A-Za-z0-9_\-]{1,32}\])* (?:(?:设置当前UID|(?:Set(?:ting)? )?(?:Current )?UID) \[UID: (?<uid>[0-9]+)\]|当前母包_热更版本号 \[version: [0-9.]+_[0-9.]+\]|Achievement PhraseBaseData response)",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Multiline);
    private static readonly Regex ScriptMount = new(
        @"^Resource/[0-9.]+/pakchunk18-WindowsNoEditor_P,[0-9]+,[0-9a-fA-F]{40},[0-9a-fA-F]{40}",
        RegexOptions.Multiline);

    public static string FileName(DateTimeOffset now) =>
        FormattableString.Invariant($"wuwa-achievement-export-log-{now.ToUnixTimeMilliseconds()}.zip");

    public static void Save(string destination, string diagnostics, string gamePath)
    {
        string temporary = destination + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            using (var stream = new FileStream(temporary, FileMode.CreateNew))
            using (var archive = new ZipArchive(stream, ZipArchiveMode.Create))
            {
                string? game = string.IsNullOrWhiteSpace(gamePath) ? null : Path.GetDirectoryName(gamePath.Trim());
                AddGame(archive, game);
                CopyLog(archive, diagnostics, "desktop-error.txt", "collection");
                string? session = Directories(diagnostics, "csharp-session-*").OrderDescending(StringComparer.Ordinal).FirstOrDefault();
                if (session is not null)
                {
                    foreach (string file in new[] { "session.json", "timings.json", "collection-error.json", "gcdump.log", "gcdump-error.log" })
                        CopyLog(archive, session, file, "collection");
                    foreach (string capture in Directories(session, "capture-*"))
                        foreach (string file in new[] { "gcdump.log", "gcdump-error.log" })
                            CopyLog(archive, capture, file, $"collection/{Path.GetFileName(capture)}");
                }
            }
            File.Move(temporary, destination, overwrite: true);
        }
        finally { CollectionRun.TryWriteDiagnostic(() => File.Delete(temporary)); }
    }

    private static IEnumerable<string> Directories(string path, string pattern) =>
        Directory.Exists(path) ? Directory.EnumerateDirectories(path, pattern, LocalFiles) : [];

    private static void AddGame(ZipArchive archive, string? game)
    {
        string? launcherAppId = null, launcherVersion = null, runtimeSha256 = null, scriptPakMount = null;
        var lines = new List<string>();
        if (game is not null && Directory.Exists(game))
        {
            string? manifest = ReadOptional(Path.Combine(game, "launcherDownloadConfig.json"), File.ReadAllText);
            if (manifest is not null)
                try
                {
                    using var document = JsonDocument.Parse(manifest);
                    if (document.RootElement.ValueKind == JsonValueKind.Object)
                    {
                        launcherAppId = ManifestValue(document.RootElement, "appId", @"^[0-9]+$");
                        launcherVersion = ManifestValue(document.RootElement, "version", @"^[0-9.]+$");
                    }
                }
                catch (JsonException) { /* Other diagnostics are still available. */ }

            string client = Path.Combine(game, "Client");
            runtimeSha256 = ReadOptional(Path.Combine(client, "Binaries", "Win64", "coreclr.dll"), GameResources.HashFile);
            string saved = Path.Combine(client, "Saved");
            string? resources = Directories(Path.Combine(saved, "Resources"), "*")
                .Where(path => Version.TryParse(Path.GetFileName(path), out _))
                .MaxBy(path => Version.Parse(Path.GetFileName(path)));
            if (resources is not null &&
                ReadOptional(Path.Combine(resources, "Mount", "MountResource.txt"), File.ReadAllText) is { } mount &&
                ScriptMount.Match(mount) is { Success: true } row)
                scriptPakMount = row.Value;

            string logFolder = Path.Combine(saved, "Logs");
            if (Directory.Exists(logFolder))
                foreach (string log in Directory.EnumerateFiles(logFolder, "Client*.log", LocalFiles)
                    .OrderByDescending(File.GetLastWriteTimeUtc).Take(3).Reverse())
                {
                    string? text = ReadOptional(log, LogEvidence.ReadText);
                    if (text is null) continue;
                    foreach (Match match in GameLine.Matches(text))
                    {
                        Group uid = match.Groups["uid"];
                        lines.Add(uid.Success ? match.Value[..(uid.Index - match.Index)] + "<redacted>]" : match.Value);
                    }
                }
        }

        string? exporterVersion = Assembly.GetEntryAssembly()?.GetName().Version?.ToString();
        AddText(archive, "game/metadata.json", JsonSerializer.Serialize(new
        {
            createdAt = DateTimeOffset.UtcNow, exporterVersion, launcherAppId, launcherVersion, runtimeSha256, scriptPakMount
        }, Json.Options));
        if (lines.Count > 0) AddText(archive, "game/Client.log", string.Join('\n', lines.TakeLast(100)) + "\n");
    }

    private static string? ManifestValue(JsonElement manifest, string name, string pattern)
    {
        if (!manifest.TryGetProperty(name, out var value)) return null;
        var text = value.ToString();
        return Regex.IsMatch(text, pattern) ? text : null;
    }

    private static string? ReadOptional(string path, Func<string, string> read)
    {
        try
        {
            var info = new FileInfo(path);
            return info.Exists && !info.Attributes.HasFlag(FileAttributes.ReparsePoint) && info.Length <= 32 * 1024 * 1024
                ? read(path) : null;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException) { return null; }
    }

    private static void CopyLog(ZipArchive archive, string directory, string file, string entryDirectory)
    {
        string? text = ReadOptional(Path.Combine(directory, file), File.ReadAllText);
        if (text is null) return;
        string profile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        if (profile.Length > 0)
            text = text.Replace(profile, "<profile>", StringComparison.OrdinalIgnoreCase)
                .Replace(profile.Replace(@"\", @"\\"), "<profile>", StringComparison.OrdinalIgnoreCase);
        text = Regex.Replace(text, @"https?://[^\s""\\\]]+", "<url>", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"(?i)(\bUID:\s*)\d+", "$1<redacted>");
        AddText(archive, $"{entryDirectory}/{file}", text);
    }

    private static void AddText(ZipArchive archive, string name, string text)
    {
        using var writer = new StreamWriter(archive.CreateEntry(name).Open());
        writer.Write(text);
    }
}
