using System.Diagnostics;
using System.Globalization;
using System.Text.RegularExpressions;
using System.Text.Json.Nodes;

namespace Wuwa.Export;

internal enum CollectionStage { Starting, Login, Reading, Closing }
internal static class Workflow
{
    public static Task Run(
        Options options, CancellationToken cancellation,
        IProgress<CollectionStage>? progress = null, Func<JsonObject, string>? saveExport = null)
    {
        using var mutex = new Mutex(false, @"Local\WuwaAchievementExport");
        var run = new CollectionRun(options.Output);
        bool acquired = false;
        try
        {
            try { acquired = mutex.WaitOne(0); } catch (AbandonedMutexException) { acquired = true; }
            if (!acquired) throw new CollectionException(CollectionFailure.ExporterBusy, "Another exporter is running");
            // Mutex ownership is thread-affine; keep acquisition and release on this thread.
            Export(options, run, cancellation, progress, saveExport).GetAwaiter().GetResult();
            return Task.CompletedTask;
        }
        catch (Exception error) when (error is not OperationCanceledException || !cancellation.IsCancellationRequested)
        {
            var failure = run.Fail(error, acquired);
            if (ReferenceEquals(error, failure)) throw;
            throw failure;
        }
        finally { if (acquired) mutex.ReleaseMutex(); }
    }
    private static async Task Export(
        Options options, CollectionRun session, CancellationToken cancellation,
        IProgress<CollectionStage>? progress, Func<JsonObject, string>? saveExport)
    {
        cancellation.ThrowIfCancellationRequested();
        if (!File.Exists(options.Game)) throw new CollectionException(CollectionFailure.GameMissing, $"Game executable is unavailable: {options.Game}");
        options = options with { Game = Path.GetFullPath(options.Game) };
        string bin = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(options.Game)!, "Client/Binaries/Win64"));
        string runtime = Path.Combine(bin, "coreclr.dll");
        RuntimeProfile.Verify(runtime);
        if (Process.GetProcessesByName("Client-Win64-Shipping").Length > 0) throw new CollectionException(CollectionFailure.GameRunning, "Wuthering Waves is already running");
        _ = typeof(GCHeapDump).Assembly;
        string quality = Launcher.Quality(options.Game, options.Quality);
        string fingerprint = GameResources.Fingerprint(options.Game);
        cancellation.ThrowIfCancellationRequested();
        DateTime started = DateTime.Now;
        string run = session.DirectoryPath;
        Directory.CreateDirectory(run);
        session.Phase = CollectionPhase.Launch;
        using var child = new StartupProcess(Path.Combine(bin, "Client-Win64-Shipping.exe"), quality);
        session.Pid = child.Id;
        var timings = new ExportTimings(run, Console.WriteLine);
        Json.Save(Path.Combine(run, "session.json"), new { pid = child.Id, startedAt = started.ToString("o"), coreclrSha256 = RuntimeProfile.Hash, gamePath = options.Game, backend = "csharp" });
        child.Resume();
        progress?.Report(CollectionStage.Starting);
        Console.WriteLine($"Game process started (PID {child.Id}); waiting for its window…");
        string resultPath = session.ResultPath;
        Json.Save(resultPath, new { success = false, status = "waiting-for-window", pid = child.Id, run });

        JsonObject export;
        using (var capture = CancellationTokenSource.CreateLinkedTokenSource(cancellation))
        {
            var monitor = WatchGameExit(child, capture);
            try
            {
                session.Phase = CollectionPhase.Window;
                await WaitForGame(child.HasVisibleMainWindow, TimeSpan.FromMinutes(10), 250,
                    CollectionFailure.WindowTimeout, "Game window did not appear before timeout", capture.Token);
                ThrowIfGameExited(child);
                session.Phase = CollectionPhase.Login;
                progress?.Report(CollectionStage.Login);
                Console.WriteLine("请登录游戏，等待成就同步…");
                Json.Save(resultPath, new { success = false, status = "waiting-for-login", pid = child.Id, run });

                string log = Path.Combine(Path.GetDirectoryName(options.Game)!, "Client/Saved/Logs/Client.log");
                await WaitForGame(() => HasAchievementSync(log, started), TimeSpan.FromSeconds(options.TimeoutSeconds), 2000,
                    CollectionFailure.LoginTimeout, "Achievements did not sync before timeout", capture.Token);
                ThrowIfGameExited(child);
                string uid = ReadUid(log, started)
                    ?? throw new CollectionException(CollectionFailure.AccountUnknown, "Could not identify the UID from the current game session");
                progress?.Report(CollectionStage.Reading);
                Console.WriteLine("成就已同步，开始定位模型…");
                var (first, second) = await ReadStable(child, session, capture.Token, timings);
                session.Phase = CollectionPhase.Validation;
                Json.Save(Path.Combine(run, "achievement-snapshot-first.json"), first);
                Json.Save(Path.Combine(run, "achievement-snapshot.json"), second);
                using (timings.Measure("生成账号进度文件"))
                {
                    if (GameResources.Fingerprint(options.Game) != fingerprint) throw new CollectionException(CollectionFailure.ResourcesChanged, "Resources changed during export");
                    string? latestUid = ReadUid(log, started);
                    if (uid != latestUid) throw new CollectionException(CollectionFailure.AccountChanged, "Account changed during export");
                    export = AccountExport.Build(first, second, uid, fingerprint);
                }
                capture.Token.ThrowIfCancellationRequested();
            }
            catch (Exception exception) when (!cancellation.IsCancellationRequested && child.HasExited
                && exception is not CollectionException { Failure: CollectionFailure.GameExited })
            {
                throw new CollectionException(CollectionFailure.GameExited, "The game exited before collection completed", exception);
            }
            finally
            {
                await capture.CancelAsync();
                await monitor;
            }
        }

        cancellation.ThrowIfCancellationRequested();
        ThrowIfGameExited(child);
        session.Phase = CollectionPhase.Save;
        string exportPath = saveExport is null ? AccountExport.Save(export, options.Output) : saveExport(export);
        session.Phase = CollectionPhase.Close;
        progress?.Report(CollectionStage.Closing);
        try { child.CloseOwnedGame(); }
        catch (Exception exception) when (exception is System.ComponentModel.Win32Exception or TimeoutException)
        {
            throw new CollectionException(CollectionFailure.CloseFailed, "Achievements were saved but the game could not be closed", exception);
        }
        int exportCount = export.Get<int>("count");
        Json.Save(resultPath, new { success = true, pid = child.Id, count = exportCount, clientModelCount = export["clientModelCount"]?.GetValue<int>() ?? exportCount, path = exportPath, gameExited = child.HasExited, backend = "csharp", completedAt = DateTimeOffset.Now.ToString("o"), run });
        Console.WriteLine($"导出完成：{exportCount} 条成就。文件：{exportPath}。本次游戏进程已关闭。");
    }

    private static async Task WatchGameExit(StartupProcess child, CancellationTokenSource capture)
    {
        try
        {
            while (!child.HasExited)
                await Task.Delay(250, capture.Token);
            await capture.CancelAsync();
        }
        catch (OperationCanceledException) when (capture.IsCancellationRequested) { }
    }

    private static void ThrowIfGameExited(StartupProcess child)
    {
        if (child.HasExited)
            throw new CollectionException(CollectionFailure.GameExited, "The game exited before collection completed");
    }

    private static async Task WaitForGame(
        Func<bool> ready, TimeSpan timeout, int pollMilliseconds,
        CollectionFailure failure, string message, CancellationToken cancellation)
    {
        var elapsed = Stopwatch.StartNew();
        while (true)
        {
            cancellation.ThrowIfCancellationRequested();
            if (ready()) return;
            if (elapsed.Elapsed >= timeout) throw new CollectionException(failure, message);
            await Task.Delay(pollMilliseconds, cancellation);
        }
    }

    private static bool HasAchievementSync(string log, DateTime started)
    {
        if (!File.Exists(log)) return false;
        string[] lines;
        try { lines = LogEvidence.Find(log); }
        catch (FileNotFoundException) { return false; } // The game can rotate the log between polls.

        var since = started.AddTicks(-(started.Ticks % TimeSpan.TicksPerMillisecond));
        foreach (string line in lines)
        {
            var match = Regex.Match(line, @"^\[(\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2}:\d{3})\].*Achievement PhraseBaseData response");
            if (match.Success && DateTime.TryParseExact(match.Groups[1].Value, "yyyy.MM.dd-HH.mm.ss:fff",
                CultureInfo.InvariantCulture, DateTimeStyles.None, out var timestamp) && timestamp >= since)
                return true;
        }
        return false;
    }

    private static string? ReadUid(string log, DateTime started)
    {
        if (!File.Exists(log)) return null;
        string text = LogEvidence.ReadText(log);
        try { return LogEvidence.CurrentUid(text, started); }
        catch (InvalidOperationException error)
        {
            throw new CollectionException(CollectionFailure.AccountChanged, "Multiple accounts appeared in the current game log", error);
        }
    }

    private static async Task<List<HeapObjects.Item>> Capture(StartupProcess child, string run, CancellationToken cancellation, ExportTimings timings)
    {
        string dump = Path.Combine(run, "heap-" + Guid.NewGuid().ToString("N") + ".gcdump");
        using (timings.Measure("采集托管堆快照"))
        {
            var start = Launcher.Self("internal-collect", "collect", "-p", child.Id.ToString(), "-o", dump, "-t", "20", "--verbose");
            start.RedirectStandardOutput = true; start.RedirectStandardError = true; start.CreateNoWindow = true;
            using var worker = Process.Start(start) ?? throw new IOException("Unable to start diagnostic worker");
            Task<string> output = worker.StandardOutput.ReadToEndAsync(), error = worker.StandardError.ReadToEndAsync();
            try { await worker.WaitForExitAsync(cancellation).WaitAsync(TimeSpan.FromSeconds(60), cancellation); }
            catch
            {
                if (!worker.HasExited) worker.Kill(true);
                await worker.WaitForExitAsync(CancellationToken.None);
                throw;
            }
            finally
            {
                if (worker.HasExited)
                {
                    await SaveCaptureLog(Path.Combine(run, "gcdump.log"), output);
                    await SaveCaptureLog(Path.Combine(run, "gcdump-error.log"), error);
                }
            }
            if (worker.ExitCode != 0) throw new IOException($"Diagnostic capture failed ({worker.ExitCode}); see {run}");
        }
        using var locating = timings.Measure("解析堆快照并定位成就模型");
        var objects = HeapObjects.Load(dump);
        Json.Save(Path.Combine(run, "objects.json"), objects.Select(o => new { type = o.Type, address = o.Address, size = o.Size, children = o.Children }).ToArray());
        return objects;
    }

    private static async Task SaveCaptureLog(string path, Task<string> text)
    {
        try
        {
            string content = await text;
            CollectionRun.TryWriteDiagnostic(() => File.WriteAllText(path, content));
        }
        catch (IOException) { }
    }
    private static async Task<(Snapshot First, Snapshot Second)> ReadStable(StartupProcess child, CollectionRun session, CancellationToken cancellation, ExportTimings timings)
    {
        const int maximumAttempts = 8;
        string run = session.DirectoryPath;
        List<HeapObjects.Item>? objects = null;
        for (int attempt = 1; ; attempt++)
        {
            cancellation.ThrowIfCancellationRequested();
            if (objects is null)
            {
                session.Phase = CollectionPhase.Heap;
                string captureDirectory = attempt == 1 ? run : Path.Combine(run, $"capture-{attempt}");
                Directory.CreateDirectory(captureDirectory);
                objects = await Capture(child, captureDirectory, cancellation, timings);
            }
            using var measurement = timings.Measure($"读取并校验成就进度（第 {attempt} 次）");
            Snapshot? first = null, second = null;
            try
            {
                cancellation.ThrowIfCancellationRequested();
                session.Phase = CollectionPhase.Model;
                first = new MonoReader(child).ReadSnapshot(objects);
                session.Phase = CollectionPhase.Validation;
                Json.Save(Path.Combine(run, $"attempt-{attempt}-first.json"), first);
                await Task.Delay(1500, cancellation);
                session.Phase = CollectionPhase.Model;
                second = new MonoReader(child).ReadSnapshot(objects);
                session.Phase = CollectionPhase.Validation;
                Json.Save(Path.Combine(run, $"attempt-{attempt}-second.json"), second);
                AccountExport.Validate(first, second, retryChanges: true);
                return (first, second);
            }
            catch (SnapshotChangedException error)
            {
                CollectionRun.TryWriteDiagnostic(() => Json.Save(Path.Combine(run, $"attempt-{attempt}-difference.json"), new
                {
                    error = error.Message, firstCount = first?.Count, secondCount = second?.Count,
                    firstFinished = first?.ModelFinishCount, secondFinished = second?.ModelFinishCount,
                    firstStars = first?.ModelStarCount, secondStars = second?.ModelStarCount,
                    changed = first is null || second is null ? null : second.Achievements.Where(a => !first.Achievements.Contains(a)).ToArray(),
                    changedGroups = first is null || second is null ? null : second.GroupStates.Where(g => !first.GroupStates.Contains(g)).ToArray()
                }));
                if (attempt == maximumAttempts)
                    throw new CollectionException(CollectionFailure.Unstable, error.Message, error, attempts: attempt);
                Console.WriteLine($"{error.Message} Retrying ({attempt}/{maximumAttempts})…");
                if (error.Recapture) objects = null;
                await Task.Delay(2000, cancellation);
            }
        }
    }
    public static async Task<int> Collect(string[] arguments)
    {
        var main = typeof(GCHeapDump).Assembly.EntryPoint ?? throw new MissingMethodException("gcdump entry point");
        object? result = main.Invoke(null, [arguments]);
        if (result is Task<int> task) return await task;
        if (result is Task other) { await other; return 0; }
        return result is int code ? code : 0;
    }
}


