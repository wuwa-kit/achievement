using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Wuwa.Export;

internal static class GameResources
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
            // Keep the ordering used by existing resource fingerprints.
            foreach (string file in Directory.EnumerateFiles(directory, "*.pak", SearchOption.AllDirectories).Where(p => !p.Contains("\\Video\\", StringComparison.OrdinalIgnoreCase)).OrderBy(p => p, StringComparer.Create(CultureInfo.CurrentCulture, true)))
            {
                var info = new FileInfo(file); parts.Add(file[game.Length..] + ":" + info.Length + ":" + info.LastWriteTimeUtc.Ticks);
            }
        }
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(string.Join('\n', parts))));
    }
}
