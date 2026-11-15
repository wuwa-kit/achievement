using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;

namespace Wuwa.Export;

internal static class Catalog
{
    public static string HashFile(string path) { using var stream = File.OpenRead(path); return Convert.ToHexString(SHA256.HashData(stream)); }
    public static string Fingerprint(string gamePath)
    {
        string game = Path.GetDirectoryName(gamePath)!; var parts = new List<string>();
        foreach (string name in new[] { "LocalGameResources.json", "launcherDownloadConfig.json" })
            if (File.Exists(Path.Combine(game, name))) parts.Add(name + ":" + HashFile(Path.Combine(game, name)));
        foreach (string folder in new[] { "Client/Content/Paks", "Client/Saved/Resources" })
        {
            string directory = Path.GetFullPath(Path.Combine(game, folder)); if (!Directory.Exists(directory)) continue;
            // PowerShell Sort-Object uses culture-aware sorting; preserve the existing cache fingerprint.
            foreach (string file in Directory.EnumerateFiles(directory, "*.pak", SearchOption.AllDirectories).Where(p => !p.Contains("\\Video\\", StringComparison.OrdinalIgnoreCase)).OrderBy(p => p, StringComparer.Create(CultureInfo.CurrentCulture, true)))
            {
                var info = new FileInfo(file); parts.Add(file[game.Length..] + ":" + info.Length + ":" + info.LastWriteTimeUtc.Ticks);
            }
        }
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(string.Join('\n', parts))));
    }
    public static JsonObject Build(JsonObject raw, string fingerprint)
    {
        var entries = raw.Rows("achievements").ToArray();
        if (raw.Get<int>("count") != raw.Get<int>("requestedCount") || raw.Get<int>("count") != entries.Length || raw["missingIds"]!.AsArray().Count > 0 || raw.Get<int>("missingRewardCount") != 0 || entries.Select(a => a.Get<int>("id")).Distinct().Count() != entries.Length)
            throw new InvalidDataException("Incomplete configuration or rewards");
        if (raw["astriteItem"]?["names"]?["zh-Hans"]?.GetValue<string>() != "星声") throw new InvalidDataException("Currency identity mismatch");
        var main = entries.Where(a => a.Get<bool>("inMainMenu")).ToArray(); var coverage = new List<object>();
        foreach (var code in raw["languages"]!.AsArray())
        {
            string language = code!.GetValue<string>();
            var missingTitles = main.Where(a => a["texts"]?[language]?["title"] is null).Select(a => a.Get<int>("id")).ToArray();
            var missingDescriptions = main.Where(a => a["texts"]?[language]?["description"] is null).Select(a => a.Get<int>("id")).ToArray();
            coverage.Add(new { language, available = missingTitles.Length < main.Length || missingDescriptions.Length < main.Length, mainTitles = main.Length - missingTitles.Length, mainDescriptions = main.Length - missingDescriptions.Length, mainCount = main.Length, missingTitles, missingDescriptions });
        }
        return new JsonObject
        {
            ["schemaVersion"] = 1, ["source"] = "local-client-config-api", ["collectedAt"] = DateTimeOffset.Now.ToString("o"),
            ["resourceFingerprint"] = fingerprint, ["configComplete"] = true, ["allTranslationsPresent"] = raw.Get<bool>("complete"), ["count"] = entries.Length,
            ["languages"] = raw["languages"]!.DeepClone(), ["languageCoverage"] = Json.Node(coverage), ["astriteItem"] = raw["astriteItem"]!.DeepClone(),
            ["categories"] = raw["categories"]!.DeepClone(), ["groups"] = Json.Node(raw.Rows("groups").Select(g => g.Pick("id", "categoryId", "sort", "enabled", "titleKey", "texts"))),
            ["achievements"] = Json.Node(entries.Select(a => a.Pick("id", "groupId", "categoryId", "inMainMenu", "hidden", "nextLink", "titleKey", "descriptionKey", "level", "dropId", "astrite", "rewards", "texts")))
        };
    }
    public static void Save(JsonObject catalog, string directory)
    {
        foreach (var code in catalog["languages"]!.AsArray())
        {
            string language = code!.GetValue<string>();
            if (!System.Text.RegularExpressions.Regex.IsMatch(language, "^[a-zA-Z-]{2,16}$")) throw new InvalidDataException("Invalid language code");
            var texts = new JsonObject();
            foreach (var row in catalog.Rows("achievements"))
                foreach (var (key, field) in new[] { ("titleKey", "title"), ("descriptionKey", "description") })
                    if (row[key]?.GetValue<string>() is { Length: > 0 } name) texts[name] = row["texts"]?[language]?[field]?.DeepClone();
            foreach (var row in catalog.Rows("categories").Concat(catalog.Rows("groups"))) texts[row.Get<string>("titleKey")] = row["texts"]?[language]?["title"]?.DeepClone();
            Json.Save(Path.Combine(directory, "locales", language + ".json"), new { language, source = "local-client-config-api", coverage = catalog.Rows("languageCoverage").Single(c => c.Get<string>("language") == language), texts });
        }
        Json.Save(Path.Combine(directory, "achievement-catalog.json"), catalog);
    }
}
