using System.Diagnostics;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;

[assembly: System.Runtime.CompilerServices.InternalsVisibleTo("Wuwa.Export.Tests")]
[assembly: System.Runtime.CompilerServices.InternalsVisibleTo("Wuwa.Desktop.Tests")]
[assembly: System.Runtime.CompilerServices.InternalsVisibleTo("WuwaAchievementExport")]
namespace Wuwa.Export;

internal sealed record Options(string Command, string Root, string Game, string Output, string Quality, int TimeoutSeconds, Dictionary<string, string> Extra)
{
    public const string DefaultGame = @"C:\Program Files\Wuthering Waves\Wuthering Waves Game\Wuthering Waves.exe";
    public static Options Parse(string[] args)
    {
        string command = args.Length == 0 ? "export" : args[0].ToLowerInvariant();
        var extra = new Dictionary<string, string>();
        for (int i = 1; i < args.Length; i += 2)
        {
            if (!args[i].StartsWith("--") || i + 1 >= args.Length || !extra.TryAdd(args[i][2..], args[i + 1])) throw new ArgumentException("Options require unique --name value pairs");
        }
        string[] allowed = ["root", "game", "output", "quality", "timeout", "first", "second", "pid", "log"];
        if (extra.Keys.Except(allowed).Any()) throw new ArgumentException("Unknown option: " + extra.Keys.Except(allowed).First());
        string root = extra.GetValueOrDefault("root") ?? FindRoot();
        root = Path.GetFullPath(root);
        int timeout = int.Parse(extra.GetValueOrDefault("timeout", "600"));
        if (timeout < 10 || timeout > 3600) throw new ArgumentException("Timeout must be 10..3600 seconds");
        return new(command, root, Path.GetFullPath(extra.GetValueOrDefault("game", DefaultGame)), Path.GetFullPath(extra.GetValueOrDefault("output", Path.Combine(root, "artifacts"))), extra.GetValueOrDefault("quality", "auto"), timeout, extra);
    }
    private static string FindRoot()
    {
        foreach (string start in new[] { AppContext.BaseDirectory, Environment.CurrentDirectory })
            for (var path = new DirectoryInfo(start); path is not null; path = path.Parent)
                if (Directory.Exists(Path.Combine(path.FullName, "data")) && Directory.Exists(Path.Combine(path.FullName, "achievement-website"))) return path.FullName;
        return AppContext.BaseDirectory;
    }
}

internal static class Program
{
    public static async Task<int> Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;
        if (args.FirstOrDefault() == "internal-collect") return await Workflow.Collect(args[1..]);
        Options? options = null;
        try
        {
            if (args.FirstOrDefault() is "--help" or "help" or "-h")
            {
                Console.WriteLine("Wuwa.Export [export|replay|analyze|launch|probe|export-events]\n  --root PATH --game EXE --output DIR --quality auto|sd|hd|uhd --timeout 600\n  replay --first FILE --second FILE\n  probe --pid PID\n  export-events --log FILE\nNo command: launch, wait for login, export, close owned game. PowerShell is not used."); return 0;
            }
            options = Options.Parse(args);
            if (options.Command is "export" or "launch" or "probe" && !Launcher.IsAdministrator())
            {
                Console.WriteLine("正在请求管理员权限…");
                var elevated = args.Length == 0 ? new List<string> { "export" } : args.ToList();
                if (!options.Extra.ContainsKey("root")) elevated.AddRange(["--root", options.Root]);
                if (!options.Extra.ContainsKey("output")) elevated.AddRange(["--output", options.Output]);
                if (!options.Extra.ContainsKey("game")) elevated.AddRange(["--game", options.Game]);
                return await Launcher.Elevate(elevated.ToArray());
            }
            Directory.CreateDirectory(options.Output);
            using var cancellation = new CancellationTokenSource();
            Console.CancelKeyPress += (_, e) => { e.Cancel = true; cancellation.Cancel(); };
            switch (options.Command)
            {
                case "export": await Workflow.Run(options, cancellation.Token); break;
                case "replay":
                    var first = Json.Load<Snapshot>(options.Extra["first"]); var second = Json.Load<Snapshot>(options.Extra["second"]);
                    AccountExport.Save(AccountExport.Build(first, second, null, "offline-replay"), options.Output);
                    Console.WriteLine("Offline replay saved; no game was started or closed."); break;
                case "launch":
                    if (Process.GetProcessesByName("Client-Win64-Shipping").Length > 0) throw new InvalidOperationException("Game already running");
                    using (var child = new StartupProcess(Path.Combine(Path.GetDirectoryName(options.Game)!, "Client/Binaries/Win64/Client-Win64-Shipping.exe"), Launcher.Quality(options.Game, options.Quality))) { child.Resume(); Console.WriteLine($"Game launched: {child.Id}; no export or automatic close."); } break;
                case "probe":
                    int pid = int.Parse(options.Extra["pid"]); using (var process = Process.GetProcessById(pid))
                    {
                        if (process.ProcessName != "Client-Win64-Shipping") throw new InvalidOperationException("Probe only accepts a game process");
                        Json.Save(Path.Combine(options.Output, "runtime-probe.json"), ProcessProbe.ReadAccess(pid, 0x140000000));
                    } break;
                case "analyze":
                    var binaryPaths = new[] { options.Game, Path.Combine(Path.GetDirectoryName(options.Game)!, "Client/Binaries/Win64/Client-Win64-Shipping.exe") };
                    Json.Save(Path.Combine(options.Output, "analysis.json"), new { mode = "static-read-only", collectedAt = DateTimeOffset.Now.ToString("o"), binaries = binaryPaths.Select(path => new { path, sha256 = Catalog.HashFile(path), length = new FileInfo(path).Length, evidence = BinaryInspector.Evidence(path) }).ToArray() }); break;
                case "export-events":
                    string log = options.Extra.GetValueOrDefault("log", Path.Combine(Path.GetDirectoryName(options.Game)!, "Client/Saved/Logs/Client.log"));
                    var events = LogEvidence.Find(log).Select(line => Regex.Match(line, @"^\[(?<time>[^\]]+)\].*\[Achievement\].*OnAchievementGroupProgressNotify \[id: (?<id>\d+)\]\[currentState: (?<state>\w+)\]")).Where(m => m.Success).Select(m => new { id = int.Parse(m.Groups["id"].Value), observedAt = m.Groups["time"].Value, rawState = m.Groups["state"].Value }).ToArray();
                    Json.Save(Path.Combine(options.Output, "achievement-events.json"), new { schemaVersion = 1, dataSource = "game-log-events", complete = false, accountAttribution = "not-verified", sourceFile = Path.GetFileName(log), capturedAt = DateTimeOffset.Now.ToString("o"), note = "Incremental observations only; not an account snapshot or completion timestamp.", eventCount = events.Length, events }); break;
                default: throw new ArgumentException("Unknown command; use --help");
            }
            return 0;
        }
        catch (CollectionException exception) when (exception.Diagnostic is { } diagnostic)
        {
            Console.Error.WriteLine($"[{diagnostic.Phase}/{diagnostic.Code}] {diagnostic.Detail}");
            if (diagnostic.Directory is { } directory) Console.Error.WriteLine(directory);
            return 1;
        }
        catch (Exception exception)
        {
            var error = exception.GetBaseException(); Console.Error.WriteLine(error.Message);
            if (options is not null)
            {
                Directory.CreateDirectory(options.Output); File.WriteAllText(Path.Combine(options.Output, "cli-error.txt"), error.ToString());
                if (options.Command is "export") Json.Save(Path.Combine(options.Output, "export-result.json"), new { success = false, backend = "csharp", error = error.Message, completedAt = DateTimeOffset.Now.ToString("o") });
            }
            return 1;
        }
    }
}
