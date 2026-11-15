using System.Diagnostics;
using System.Security.Principal;
using System.Text;
using System.Text.Json.Nodes;

namespace Wuwa.Export;

internal static class Launcher
{
    public static bool IsAdministrator() => new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator);
    public static ProcessStartInfo Self(params string[] arguments)
    {
        var start = new ProcessStartInfo(Environment.ProcessPath!) { UseShellExecute = false, WorkingDirectory = Environment.CurrentDirectory };
        if (string.Equals(Path.GetFileNameWithoutExtension(start.FileName), "dotnet", StringComparison.OrdinalIgnoreCase)) start.ArgumentList.Add(Path.Combine(AppContext.BaseDirectory, "Wuwa.Export.dll"));
        foreach (var argument in arguments) start.ArgumentList.Add(argument);
        return start;
    }
    public static async Task<int> Elevate(string[] arguments)
    {
        var start = Self(arguments); start.UseShellExecute = true; start.Verb = "runas";
        using var worker = Process.Start(start) ?? throw new IOException("Cannot start elevated exporter");
        await worker.WaitForExitAsync(); return worker.ExitCode;
    }
    public static string Quality(string gamePath, string requested)
    {
        requested = requested.ToLowerInvariant(); string[] allowed = ["sd", "hd", "uhd"];
        if (allowed.Contains(requested)) return requested;
        if (requested != "auto") throw new ArgumentException("Quality must be auto, sd, hd or uhd");
        string game = Path.GetDirectoryName(gamePath)!;
        string stateFile = Path.Combine(Directory.GetParent(game)!.FullName, "kr_game_cache", "platform_ui_state.bin");
        if (File.Exists(stateFile))
        {
            try
            {
                byte[] bytes = Convert.FromBase64String(File.ReadAllText(stateFile));
                for (int i = 0; i < bytes.Length; i++) bytes[i] ^= 0x63;
                var state = JsonNode.Parse(Encoding.UTF8.GetString(bytes).TrimStart('\uFEFF'))!;
                var active = state["activeGameScope"];
                var scopes = new[] { active?["gameIdentity"]?.GetValue<string>() == "Aki" ? active : null, state["recentGames"]?["Aki"] };
                foreach (var scope in scopes)
                    if (scope?["bundleName"]?.GetValue<string>().ToLowerInvariant() is { } bundle && allowed.Contains(bundle)) return bundle;
            }
            catch (Exception e) when (e is FormatException or System.Text.Json.JsonException or InvalidOperationException) { }
        }
        string manifest = Path.Combine(game, "launcherDownloadConfig.json");
        if (File.Exists(manifest))
        {
            var choices = Json.Read(manifest)["bundles"]!.AsObject().Select(p => p.Key.ToLowerInvariant()).Where(allowed.Contains).ToArray();
            if (choices.Length == 1) return choices[0];
        }
        throw new InvalidDataException("Cannot determine resource quality; use --quality sd|hd|uhd");
    }
}
