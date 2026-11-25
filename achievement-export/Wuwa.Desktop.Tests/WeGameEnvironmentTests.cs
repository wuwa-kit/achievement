using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Wuwa.Desktop;

internal static class WeGameEnvironmentTests
{
    internal static async Task RunAsync(string directory)
    {
        string source = Path.Combine(directory, "wegame-source");
        string data = Path.Combine(directory, "wegame-data");
        void Write(string path, string text)
        {
            string file = Path.Combine(source, path);
            Directory.CreateDirectory(Path.GetDirectoryName(file)!);
            File.WriteAllText(file, text);
        }
        static void Check(bool value, [System.Runtime.CompilerServices.CallerLineNumber] int line = 0) { if (!value) throw new Exception("WeGame environment assertion failed at " + line); }
        Write("rail_files/rail_game_identify.json", "{\"game_id\":2002137}");
        Write("rail_files/rail_game_build_info.dat", "version1");
        Write("Wuthering Waves.exe", "bootstrap");
        Write("Client/Binaries/Win64/Client-Win64-Shipping.exe", "game");
        Write("Client/Binaries/Win64/coreclr.dll", "runtime");
        Write(WeGameEnvironment.Sdk + "/KRSDK.dll", "wegame-sdk");
        Write(WeGameEnvironment.Sdk + "/shared.dll", "unchanged");
        Write("Client/Saved/Config/settings.ini", "original");
        Write("Client/Saved/Resources/update.pak", "update");
        Write("Client/Content/test.pak", "content");
        Write("Engine/test.dll", "engine");
        string game = Path.Combine(source, "Wuthering Waves.exe");
        Check(WeGameEnvironment.IsWeGame(game));
        Check(!WeGameEnvironment.IsWeGame(Path.Combine(directory, "official.exe")));
        try { WeGameEnvironment.ResolveFile(data, "../escape.dll"); throw new Exception("Traversal accepted"); }
        catch (InvalidDataException) { }
        var handler = new ManifestHandler();
        using var client = new HttpClient(handler);
        try
        {
            var plan = (await WeGameEnvironment.Inspect(game, data, CancellationToken.None, client))!;
            var inspection = plan.Status;
            Check(inspection.Status == "missing" && inspection.Total == Encoding.UTF8.GetByteCount("official-sdk"));
            Check(!Directory.Exists(data));
            int checkedRequests = handler.Requests;
            handler.Corrupt = true;
            try { await WeGameEnvironment.Prepare(game, data, new Progress<string>(), CancellationToken.None, client, plan: plan); throw new Exception("Corrupt SDK accepted"); }
            catch (InvalidDataException) { }
            Check(handler.Requests == checkedRequests + 1); // Download starts without fetching either manifest again.
            Check(!Directory.EnumerateFiles(data, "ready.json", SearchOption.AllDirectories).Any());
            Check(Directory.Exists(plan.Staging) && plan.Status.Status == "missing");
            WeGameEnvironment.Junction(Path.Combine(plan.Staging, "shared-link"), Path.Combine(source, "Client/Content"));
            handler.Corrupt = false;
            using var stopDownload = new CancellationTokenSource();
            try
            {
                await WeGameEnvironment.Prepare(game, data, new Progress<string>(), stopDownload.Token, client,
                    report: value => { if (value.Status == "downloading" && value.Received > 0) stopDownload.Cancel(); }, plan: plan);
                throw new Exception("Download cancellation ignored");
            }
            catch (OperationCanceledException) { }
            Check(!Directory.Exists(Path.Combine(plan.Installation, "staging")));
            Check(plan.Status.Status == "missing");
            Check(File.ReadAllText(Path.Combine(source, "Client/Content/test.pak")) == "content");
            Check(File.ReadAllText(Path.Combine(source, WeGameEnvironment.Sdk, "KRSDK.dll")) == "wegame-sdk");
            Check(plan.Status == (await WeGameEnvironment.Inspect(game, data, CancellationToken.None, client))!.Status);
            checkedRequests = handler.Requests;
            handler.Corrupt = false;
            var updates = new List<WeGameEnvironment.SdkStatus>();
            string prepared = await WeGameEnvironment.Prepare(game, data, new Progress<string>(), CancellationToken.None, client, report: updates.Add, plan: plan);
            Check(updates.Select(value => value.Status).Distinct().SequenceEqual(new[] { "downloading", "preparing", "ready" }));
            Check(handler.Requests == checkedRequests + 1);
            Check(await WeGameEnvironment.Prepare(game, data, new Progress<string>(), CancellationToken.None, client, plan: plan) == prepared);
            Check(handler.Requests == checkedRequests + 1); // Immediate collection also uses the completed plan.
            Check(updates.Any(value => value.Status == "downloading" && value.Received == value.Total && value.Total > 0));
            Check(updates.Last().Status == "ready");
            Check((await WeGameEnvironment.Check(game, data, CancellationToken.None, client)).Status == "ready");
            string root = Path.GetDirectoryName(prepared)!;
            string legacy = Path.Combine(Path.GetDirectoryName(root)!, "ABCDEF0123456789");
            Directory.Move(root, legacy);
            File.WriteAllText(Path.Combine(legacy, "migration-marker.txt"), "keep");
            Check(await WeGameEnvironment.Prepare(game, data, new Progress<string>(), CancellationToken.None, client) == prepared);
            Check(!Directory.Exists(legacy) && File.ReadAllText(Path.Combine(root, "migration-marker.txt")) == "keep");
            Check(File.ReadAllText(Path.Combine(root, WeGameEnvironment.Sdk, "KRSDK.dll")) == "official-sdk");
            Check(File.ReadAllText(Path.Combine(source, WeGameEnvironment.Sdk, "KRSDK.dll")) == "wegame-sdk");
            Check(new DirectoryInfo(Path.Combine(root, "Client/Content")).ResolveLinkTarget(true)?.FullName == Path.GetFullPath(Path.Combine(source, "Client/Content")));
            File.WriteAllText(Path.Combine(root, "Client/Saved/Config/settings.ini"), "independent");
            Check(File.ReadAllText(Path.Combine(source, "Client/Saved/Config/settings.ini")) == "original");
            int requests = handler.Requests;
            Check(await WeGameEnvironment.Prepare(game, data, new Progress<string>(), CancellationToken.None, client) == prepared);
            Check(handler.Requests == requests + 2); // Only index and manifest, no SDK download.
            string runtimeFile = Path.Combine(root, WeGameEnvironment.Sdk, "login-cache.dat");
            File.WriteAllText(runtimeFile, "persist-login");
            var programTime = File.GetLastWriteTimeUtc(Path.Combine(root, "Client/Binaries/Win64/Client-Win64-Shipping.exe"));
            handler.SdkContent = "official-new"; // Same size and unchanged game, different SDK hash.
            var updatePlan = (await WeGameEnvironment.Inspect(game, data, CancellationToken.None, client))!;
            Check(updatePlan.Status.Status == "outdated");
            handler.Corrupt = true;
            try { await WeGameEnvironment.Prepare(game, data, new Progress<string>(), CancellationToken.None, client, plan: updatePlan); throw new Exception("Corrupt SDK update accepted"); }
            catch (InvalidDataException) { }
            Check(Directory.Exists(root));
            handler.Corrupt = false;
            int downloadsBeforeUpdate = handler.Downloads;
            using var stopAfterDownload = new CancellationTokenSource();
            try
            {
                await WeGameEnvironment.Prepare(game, data, new Progress<string>(), stopAfterDownload.Token, client,
                    report: value => { if (value.Status == "preparing") stopAfterDownload.Cancel(); }, plan: updatePlan);
                throw new Exception("Preparation cancellation ignored");
            }
            catch (OperationCanceledException) { }
            Check(updatePlan.DownloadSize == Encoding.UTF8.GetByteCount(handler.SdkContent));
            Check(!Directory.Exists(Path.Combine(updatePlan.Installation, "staging")));
            Check(updatePlan.Status == (await WeGameEnvironment.Inspect(game, data, CancellationToken.None, client))!.Status);
            int requestsBeforeRetry = handler.Requests;
            string updated = await WeGameEnvironment.Prepare(game, data, new Progress<string>(), CancellationToken.None, client, plan: updatePlan);
            Check(handler.Requests == requestsBeforeRetry + 1); // Cancelled downloads are removed; retry downloads them again without fetching manifests.
            Check(handler.Downloads == downloadsBeforeUpdate + 2); // Unchanged files are verified and reused; only changed SDK content is downloaded.
            Check(updated == prepared && Directory.Exists(root));
            string leftover = Path.Combine(updatePlan.Installation, "staging", "old", "partial.download");
            Directory.CreateDirectory(Path.GetDirectoryName(leftover)!);
            File.WriteAllText(leftover, "partial");
            WeGameEnvironment.ClearDownloads(updatePlan, CancellationToken.None);
            Check(!File.Exists(leftover) && updatePlan.Status.Status == "ready");
            Check(File.ReadAllText(runtimeFile) == "persist-login");
            Check(File.GetLastWriteTimeUtc(Path.Combine(root, "Client/Binaries/Win64/Client-Win64-Shipping.exe")) == programTime);
            root = Path.GetDirectoryName(updated)!;
            Check(File.ReadAllText(Path.Combine(root, WeGameEnvironment.Sdk, "KRSDK.dll")) == "official-new");
            Check(File.ReadAllText(Path.Combine(root, "Client/Saved/Config/settings.ini")) == "independent");
            handler.ReverseManifest = true;
            Check(await WeGameEnvironment.Prepare(game, data, new Progress<string>(), CancellationToken.None, client) == updated);
            using var cancelled = new CancellationTokenSource(); cancelled.Cancel();
            try { await WeGameEnvironment.Prepare(game, data, new Progress<string>(), cancelled.Token, client); throw new Exception("Cancellation ignored"); }
            catch (OperationCanceledException) { }
            Write("Client/Binaries/Win64/Client-Win64-Shipping.exe", "old-game");
            Check(!updatePlan.MatchesGame(game, data));
            Check(!updatePlan.MatchesGame(Path.Combine(directory, "other.exe"), data));
            try { await WeGameEnvironment.Prepare(game, data, new Progress<string>(), CancellationToken.None, client, plan: updatePlan); throw new Exception("Version mismatch accepted"); }
            catch (InvalidDataException error) when (error.Message == "wegameVersionMismatch") { }
            Check(Directory.Exists(root));
            string old = Path.Combine(Path.GetDirectoryName(root)!, "1111111111111111");
            Directory.CreateDirectory(old);
            File.WriteAllText(Path.Combine(old, "old-sdk.dll"), "old");
            WeGameEnvironment.Junction(Path.Combine(old, "shared"), Path.Combine(source, "Client/Content"));
            string unfinished = Path.Combine(Path.GetDirectoryName(root)!, "2222222222222222");
            Directory.CreateDirectory(unfinished);
            File.WriteAllText(Path.Combine(unfinished, "sdk.download"), "partial");
            string unrelated = Path.Combine(Path.GetDirectoryName(root)!, "user-files");
            Directory.CreateDirectory(unrelated);
            WeGameEnvironment.CleanupOldEnvironments(unfinished, CancellationToken.None);
            Check(Directory.Exists(old)); // An incomplete replacement cannot trigger cleanup.
            try { WeGameEnvironment.CleanupOldEnvironments(root, cancelled.Token); throw new Exception("Cleanup cancellation ignored"); }
            catch (OperationCanceledException) { }
            Check(Directory.Exists(old));
            WeGameEnvironment.CleanupOldEnvironments(root, CancellationToken.None);
            Check(!Directory.Exists(old) && !Directory.Exists(unfinished));
            Check(Directory.Exists(root) && Directory.Exists(unrelated));
            Check(File.ReadAllText(Path.Combine(source, "Client/Content/test.pak")) == "content");
            Check(File.ReadAllText(Path.Combine(root, "Client/Saved/Config/settings.ini")) == "independent");
            Console.WriteLine("Old environment cleanup preserves active files and junction targets; incomplete/cancelled preparation retains old environments.");
            Console.WriteLine("WeGame detection, SDK-only update, manifest order stability, reuse, config migration, checksum/retry, junctions, cancellation and version mismatch passed.");
        }
        finally
        {
            // Remove only links before the test fixture's recursive cleanup.
            foreach (var key in Directory.EnumerateDirectories(Path.Combine(data, "WeGame")))
                foreach (var version in Directory.EnumerateDirectories(key))
                    foreach (var relative in new[] { "Client/Content", "Client/Saved/Resources" })
                    {
                        var link = new DirectoryInfo(Path.Combine(version, relative));
                        if (link.LinkTarget is not null) link.Delete();
                    }
        }
    }
    private sealed class ManifestHandler : HttpMessageHandler
    {
        internal bool Corrupt;
        internal string SdkContent = "official-sdk";
        internal bool ReverseManifest;
        internal int Requests;
        internal int Downloads;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        {
            token.ThrowIfCancellationRequested(); Requests++;
            object Entry(string path, string value) => new { dest = path, size = Encoding.UTF8.GetByteCount(value), md5 = Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(value))) };
            var entries = new[] { Entry("Client/Binaries/Win64/Client-Win64-Shipping.exe", "game"), Entry(WeGameEnvironment.Sdk + "/KRSDK.dll", SdkContent), Entry(WeGameEnvironment.Sdk + "/shared.dll", "unchanged") };
            if (ReverseManifest) Array.Reverse(entries);
            byte[] manifest = JsonSerializer.SerializeToUtf8Bytes(new { resource = entries });
            byte[] content = request.RequestUri!.Host.StartsWith("prod-cn-")
                ? JsonSerializer.SerializeToUtf8Bytes(new { cdnList = new[] { new { url = "https://fixture.invalid/" } }, resourcePacks = new { common = new { indexFile = "manifest", indexFileMd5 = Convert.ToHexString(MD5.HashData(manifest)), baseUrl = "files/" } } })
                : request.RequestUri.AbsolutePath == "/manifest" ? manifest : Encoding.UTF8.GetBytes(Corrupt ? "corrupt" : request.RequestUri.AbsolutePath.EndsWith("/shared.dll") ? "unchanged" : SdkContent);
            if (request.RequestUri.AbsolutePath.StartsWith("/files/")) Downloads++;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(content) });
        }
    }
}
