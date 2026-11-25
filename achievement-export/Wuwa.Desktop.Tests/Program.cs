using System.IO.Compression;
using System.Text.Json.Nodes;
using Wuwa.Desktop;

if (args.Length == 3 && args[0] == "--wegame-cancel")
{
    using var cancellation = new CancellationTokenSource();
    try
    {
        await WeGameEnvironment.Prepare(args[1], args[2], new Progress<string>(Console.WriteLine), cancellation.Token,
            report: state => { if (state.Received > 65536) cancellation.Cancel(); });
        throw new Exception("Expected download interruption");
    }
    catch (OperationCanceledException) when (cancellation.IsCancellationRequested) { Console.WriteLine("Live SDK download cancelled successfully"); }
    return;
}
if (args.Length == 3 && args[0] == "--wegame-check")
{
    Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(await WeGameEnvironment.Check(args[1], args[2], CancellationToken.None)));
    return;
}
if (args.Length == 3 && args[0] == "--wegame-prepare")
{
    Console.WriteLine(await WeGameEnvironment.Prepare(args[1], args[2], new Progress<string>(Console.WriteLine), CancellationToken.None));
    return;
}
var directory = Path.Combine(Path.GetTempPath(), "wuwa-history-test-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(directory);
try
{
    void Check(bool value) { if (!value) throw new Exception("History assertion failed."); }
    var source = JsonNode.Parse("""{"uid":"123","capturedAt":"2026-11-14T08:00:00+08:00","count":2,"completedCount":1,"achievements":[{"id":1,"currentProgress":1,"hasGetReward":true,"note":"=1+1"},{"id":2,"currentProgress":0,"hasGetReward":false,"note":"<&>"}]}""")!.AsObject();
    var history = Path.Combine(directory, "accounts");
    var store = new ExportHistory(history);
    foreach (string? uid in new[] { null, "", "0", "00123", "../123" })
    {
        var invalid = source.DeepClone().AsObject();
        invalid["uid"] = uid;
        try { store.Add(invalid); throw new Exception("Invalid UID accepted."); } catch (InvalidDataException) { }
    }
    Check(!Directory.Exists(history));
    var archive = Path.Combine(history, "123.json");
    Check(store.Add(source) == archive);
    var first = store.List().Single();
    Check(first.StarCount is null);
    Check(ExportHistory.JsonFileName(first) == "Wuthering-Waves-Achievements-123-20261114-000000Z.json");
    store.Add(source);
    Check(store.List().Single() == first && first.Uid == "123" && first.CompletedCount == 1 && first.TotalCount == 2);
    var newest = source.DeepClone().AsObject();
    newest["capturedAt"] = "2026-11-14T01:00:00Z";
    newest["starCount"] = 87;
    using (File.OpenRead(archive))
    {
        try { store.Add(newest); throw new Exception("Replaced a locked snapshot."); }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException) { }
        Check(store.List().Single() == first);
    }
    Check(store.Add(newest) == archive);
    store.Add(source);
    var entries = new ExportHistory(history).List();
    Check(entries.Length == 1 && entries[0].Id != first.Id && Directory.GetFiles(history).Single() == archive);
    Check(entries[0].StarCount == 87);
    Check(!store.Delete(first.Id));
    try { store.Read(first.Id); throw new Exception("Read a newer snapshot using the old ID."); } catch (FileNotFoundException) { }
    Check(JsonNode.DeepEquals(newest, JsonNode.Parse(store.Read(entries[0].Id).Bytes)));
    var json = Path.Combine(directory, "copy.json");
    store.SaveJson(entries[0].Id, json);
    Check(File.ReadAllText(json) == File.ReadAllText(archive));
    try { store.Read("../source"); throw new Exception("Traversal accepted."); } catch (ArgumentException) { }
    var otherAccount = source.DeepClone().AsObject();
    otherAccount["uid"] = "456";
    store.Add(otherAccount);
    Check(store.List().Select(entry => entry.Uid).SequenceEqual(["123", "456"]));
    Check(store.Delete(entries[0].Id) && store.List().Single().Uid == "456");
    Check(!File.Exists(archive));
    Console.WriteLine("UID validation, atomic account replacement, stale entries, deletion, and JSON checks passed.");

    var diagnostics = Path.Combine(directory, "diagnostics");
    var session = Directory.CreateDirectory(Path.Combine(diagnostics, "csharp-session-20261115")).FullName;
    File.WriteAllText(Path.Combine(session, "gcdump.log"), "diagnostic output");
    File.WriteAllText(Path.Combine(session, "achievement-snapshot.json"), "private snapshot");
    File.WriteAllText(Path.Combine(session, "heap.gcdump"), "private heap");
    var game = Path.Combine(directory, "game");
    var logs = Directory.CreateDirectory(Path.Combine(game, "Client", "Saved", "Logs")).FullName;
    File.WriteAllText(Path.Combine(game, "launcherDownloadConfig.json"), """{"appId":50004,"version":"3.8.0"}""");
    var mount = Directory.CreateDirectory(Path.Combine(game, "Client", "Saved", "Resources", "3.8.0", "Mount")).FullName;
    var scriptPak = $"Resource/3.8.11/pakchunk18-WindowsNoEditor_P,15,{new string('A', 40)},{new string('B', 40)}";
    File.WriteAllText(Path.Combine(mount, "MountResource.txt"), scriptPak + ",,\n");
    const string prefix = "[2026.11.15-08.00.12:623][265][GameThread]Sharphereal: Display: [C#][1150][Info][Log][YYZ][42] ";
    File.WriteAllLines(Path.Combine(logs, "Client.log"),
        [prefix + "设置当前UID [UID: 123456789] token=private", prefix + "当前母包_热更版本号 [version: 3.8.0_3.8.11]", prefix + "unrelated private log"]);
    Check(DiagnosticArchive.FileName(DateTimeOffset.FromUnixTimeMilliseconds(1234)) == "wuwa-achievement-export-log-1234.zip");
    var diagnosticZip = Path.Combine(directory, "diagnostic.zip");
    DiagnosticArchive.Save(diagnosticZip, diagnostics, Path.Combine(game, "Wuthering Waves.exe"));
    using var bundle = ZipFile.OpenRead(diagnosticZip);
    Check(bundle.Entries.Select(entry => entry.FullName).Order().SequenceEqual(
        ["collection/gcdump.log", "game/Client.log", "game/metadata.json"]));
    using var logReader = new StreamReader(bundle.GetEntry("game/Client.log")!.Open());
    string exportedLog = logReader.ReadToEnd();
    Check(exportedLog.Contains("设置当前UID [UID: <redacted>]") && exportedLog.Contains("3.8.0_3.8.11"));
    Check(!exportedLog.Contains("123456789") && !exportedLog.Contains("private"));
    using var metadataReader = new StreamReader(bundle.GetEntry("game/metadata.json")!.Open());
    var metadata = JsonNode.Parse(metadataReader.ReadToEnd());
    Check(metadata?["launcherAppId"]?.GetValue<string>() == "50004");
    Check(metadata?["scriptPakMount"]?.GetValue<string>() == scriptPak);
    Console.WriteLine("Diagnostic archive contents, epoch filename, and log redaction passed.");
    await DesktopUpdaterTests.RunAsync(directory);
    await WeGameEnvironmentTests.RunAsync(directory);
    DiagnosticRetentionTests.Run(directory);
}
catch (Exception error) { Console.Error.WriteLine(error); throw; }
finally { Directory.Delete(directory, true); }
