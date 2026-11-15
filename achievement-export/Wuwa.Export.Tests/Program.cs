using System.Text;
using System.Text.Json.Nodes;
using Wuwa.Export;

string root = Path.GetFullPath(args.FirstOrDefault() ?? "..");
var first = Json.Load<Snapshot>(Path.Combine(root, "fixtures/local/session-24624/achievement-snapshot-first.json"));
var second = Json.Load<Snapshot>(Path.Combine(root, "fixtures/local/session-24624/achievement-snapshot.json"));
int tests = 0;
void Check(bool condition, string message) { if (!condition) throw new Exception(message); tests++; Console.WriteLine("PASS " + message); }
void Reject(Action action, string name) { bool rejected = false; try { action(); } catch (InvalidDataException) { rejected = true; } Check(rejected, name); }
Check(FixedResourceFingerprint() == "4F759B40C5514DAB2071E0B9122B7E95BFE81091606A652AC758ED3FFC20A6EF",
    "Resource fingerprint matches the fixed fixture");
Check(HeapObjects.Load(Path.Combine(root, "fixtures/local/session-24624/heap.gcdump")).Count(o => o.Type == "AchievementModel") == 1, "Managed GC dump reader");
string output = Path.Combine(root, "artifacts/csharp-regression");
string fixture = Path.Combine(output, "quality-fixture"); Directory.CreateDirectory(Path.Combine(fixture, "game")); Directory.CreateDirectory(Path.Combine(fixture, "kr_game_cache"));
byte[] state = Encoding.UTF8.GetBytes("{\"activeGameScope\":{\"gameIdentity\":\"Aki\",\"bundleName\":\"UHD\"}}");
for (int i = 0; i < state.Length; i++) state[i] ^= 0x63;
File.WriteAllText(Path.Combine(fixture, "kr_game_cache/platform_ui_state.bin"), Convert.ToBase64String(state));
Check(Launcher.Quality(Path.Combine(fixture, "game/Wuthering Waves.exe"), "auto") == "uhd", "Launcher cache quality decoded");
Check(Launcher.Quality(Path.Combine(fixture, "game/Wuthering Waves.exe"), "sd") == "sd", "Explicit quality precedence");

var switchedFirst = Json.Load<Snapshot>(Path.Combine(root, "fixtures/local/csharp-session-10324-20261114-071240/attempt-8-first.json"));
var switchedSecond = Json.Load<Snapshot>(Path.Combine(root, "fixtures/local/csharp-session-10324-20261114-071240/attempt-8-second.json"));

int metadataReads = 0;
byte[] FakeMemory(long address, int size)
{
    metadataReads++;
    if (address == 1072 && size == 8) return BitConverter.GetBytes(2000L);
    if (address == 2000 && size == 128) { var bytes = new byte[128]; Encoding.UTF8.GetBytes("AchievementData").CopyTo(bytes, 0); return bytes; }
    throw new Exception("Unexpected memory read");
}
var cachedReader = new MonoReader(FakeMemory, 1);
for (int i = 0; i < 1408; i++) CheckName();
void CheckName() { if (cachedReader.ClassName(1000) != "AchievementData") throw new Exception("Class name changed"); }
Check(metadataReads == 2, "Repeated class names require only two process reads per snapshot");
_ = new MonoReader(FakeMemory, 2).ClassName(1000);
Check(metadataReads == 4, "Metadata caches are isolated between readers and processes");
var modelCandidate = new HeapObjects.Item { Type = "AchievementModel", Address = 0x1000 };
byte[] ModelWithoutFields(long address, int size)
{
    if (address == 0x1000) return BitConverter.GetBytes(0x2000L);
    if (address == 0x2000) return BitConverter.GetBytes(0x3000L);
    if (address == 0x3000 + 72) return BitConverter.GetBytes(0x4000L);
    if (address == 0x3000 + 160) return BitConverter.GetBytes(0x5000L);
    if (address == 0x5000) return new byte[size];
    if (address == 0x4000)
    {
        var bytes = new byte[size];
        Encoding.UTF8.GetBytes("AchievementModel").CopyTo(bytes, 0);
        return bytes;
    }
    throw new Exception("Unexpected memory read");
}
CollectionException CollectionError(Action action)
{
    try { action(); }
    catch (CollectionException error) { return error; }
    throw new Exception("Expected a collection failure");
}
var modelReader = new MonoReader(ModelWithoutFields, 1);
Check(CollectionError(() => modelReader.ReadSnapshot([])).Failure == CollectionFailure.ModelMissing, "Missing heap model has its own reason");
Check(CollectionError(() => modelReader.ReadSnapshot([modelCandidate, modelCandidate])).Failure == CollectionFailure.ModelAmbiguous, "Ambiguous heap model has its own reason");
var fieldError = CollectionError(() => modelReader.ReadSnapshot([modelCandidate]));
Check(fieldError.Failure == CollectionFailure.FieldMissing && fieldError.Field == "AchievementMap", "Missing model field fails with the field name");
try
{
    AccountExport.Validate(first, second with { ModelStarCount = second.ModelStarCount + 1 }, retryChanges: true);
    throw new Exception("Expected a snapshot change");
}
catch (SnapshotChangedException error) { Check(!error.Recapture, "Snapshot drift is eligible for a retry using the same heap dump"); }

string preflightOutput = Path.Combine(output, "preflight-" + Guid.NewGuid().ToString("N"));
string preflightGame = Path.Combine(preflightOutput, "Wuthering Waves.exe");
string preflightRuntime = Path.Combine(preflightOutput, "Client/Binaries/Win64/coreclr.dll");
Directory.CreateDirectory(Path.GetDirectoryName(preflightRuntime)!);
File.WriteAllText(preflightGame, "game fixture");
File.WriteAllText(preflightRuntime, "runtime fixture");
string previousExport = Path.Combine(preflightOutput, "achievements.json");
File.WriteAllText(previousExport, "previous result");
var preflightOptions = new Options("export", root, preflightGame, preflightOutput, "auto", 10, new());
var preflight = CollectionError(() => Workflow.Run(preflightOptions, CancellationToken.None));
var persistedFailure = Json.Read(Path.Combine(preflightOutput, "export-result.json"));
Check(preflight.Diagnostic is { Code: "unsupportedRuntime", Phase: "preflight", Directory: not null } diagnostic &&
    diagnostic.Detail.Contains(RuntimeProfile.Hash) && diagnostic.Detail.Contains(GameResources.HashFile(preflightRuntime)) &&
    File.Exists(Path.Combine(diagnostic.Directory, "collection-error.json")) &&
    persistedFailure["pid"] is null && persistedFailure["diagnostic"]?["id"]?.GetValue<string>() == diagnostic.Id &&
    File.ReadAllText(previousExport) == "previous result", "Runtime mismatch stops before game launch and preserves the last export");
var messages = new List<string>();
var timingDirectory = Path.Combine(output, "timing-fixture");
Directory.CreateDirectory(timingDirectory);
var timings = new ExportTimings(timingDirectory, messages.Add);
try { using (timings.Measure("failure")) throw new InvalidDataException("fixture"); } catch (InvalidDataException) { }
var stage = timings.Measure("success"); stage.Dispose(); stage.Dispose();
var timingRows = JsonNode.Parse(File.ReadAllText(Path.Combine(timingDirectory, "timings.json")))!.AsArray();
Check(timingRows.Count == 2 && messages.Count == 4, "Stage timings survive exceptions and dispose only once");

var uidStart = new DateTime(2026, 11, 14, 8, 0, 0);
Check(LogEvidence.CurrentUid("[2026.11.14-08.00.12:623][265][GameThread]Sharphereal: Display: [C#][1150][Info][Log] 设置当前UID [UID: 10001]", uidStart) == "10001", "Current game UID extracted");
Check(LogEvidence.CurrentUid("[2026.11.14-07.00.12:623][C#] 设置当前UID [UID: 10001]", uidStart) is null, "Previous session UID ignored");
Check(LogEvidence.CurrentUid("[2026.11.14-08.00.12:623][C#] SDK [uid: 10001] [PlayerId: 10002]", uidStart) is null, "SDK and other player IDs ignored");

string UidLine(string uid) => $"[2026.11.14-08.00.12:623][265][GameThread]Sharphereal: Display: [C#][1150][Info][Log] 设置当前UID [UID: {uid}]";
Check(LogEvidence.CurrentUid(UidLine("10001") + "\n" + UidLine("10001"), uidStart) == "10001", "Repeated current UID stays stable");
bool changedUidRejected = false;
try { LogEvidence.CurrentUid(UidLine("10001") + "\n" + UidLine("10002"), uidStart); }
catch (InvalidOperationException) { changedUidRejected = true; }
Check(changedUidRejected, "Account changes during export are rejected");
Check(LogEvidence.CurrentUid("[2026.11.14-07.00.12:623][C#] 设置当前UID [UID: 99999]\n" + UidLine("10002"), uidStart) == "10002", "New session UID supersedes historical account");
Check(LogEvidence.CurrentUid(UidLine("0"), uidStart) is null, "Invalid zero UID remains unknown");
foreach (bool encoded in new[] { false, true })
foreach (bool bom in new[] { false, true })
{
    byte[] content = Encoding.UTF8.GetBytes(UidLine("10002"));
    if (encoded) for (int i = 0; i < content.Length; i++) content[i] ^= (byte)((content[i] & 1) == 1 ? 0xEF : 0xA5);
    string path = Path.Combine(output, $"uid-log-{encoded}-{bom}.log");
    File.WriteAllBytes(path, bom ? [0xEF, 0xBB, 0xBF, .. content] : content);
    Check(LogEvidence.CurrentUid(LogEvidence.ReadText(path), uidStart) == "10002", $"UID log decoding encoded={encoded}, BOM={bom}");
}

var compact = AccountExport.Build(first, second, "10001", "test-resources");
var compactB = AccountExport.Build(switchedFirst, switchedSecond, "10002", "test-resources");
Check(compact.Get<int>("schemaVersion") == 3 && compact.Get<int>("count") == second.Count, "Compact export preserves all observed IDs");
Check(compact["languages"] is null && compact["categories"] is null && compact.Rows("achievements").All(a => a["texts"] is null && a["rewards"] is null), "Account export has no static resources");
Check(compact.Rows("achievements").Any(a => a.Get<int>("id") == 201196), "Exclusions belong to website, not account capture");
Reject(() => AccountExport.Build(first, second with { ModelStarCount = second.ModelStarCount + 1 }, null, "test"), "Unstable compact export rejected");
Reject(() => AccountExport.Build(first, second with { Achievements = [second.Achievements[0], .. second.Achievements.Skip(2), second.Achievements[0]] }, null, "test"), "Duplicate compact IDs rejected");
var changedGroup = second.GroupStates[0] with { Unlocked = !second.GroupStates[0].Unlocked };
Reject(() => AccountExport.Build(first, second with { GroupStates = [changedGroup, .. second.GroupStates.Skip(1)] }, null, "test"), "Changing group state rejected");
var newId = new Achievement(999999, -1, -1, 0, 1, false, 0);
var future = second with { Count = second.Count + 1, Achievements = [.. second.Achievements, newId] };
Check(AccountExport.Build(future, future, null, "test").Rows("achievements").Any(a => a.Get<int>("id") == 999999), "New IDs export without a catalog");
string saved = AccountExport.Save(compact, Path.Combine(output, "compact-a"));
Check(JsonNode.DeepEquals(compact, Json.Read(saved)), "Account export round-trips after atomic save");
Check(compactB.Get<int>("completedCount") == 1200 && compactB.Get<int>("starCount") == 1571, "Switched account totals preserved");
Check(typeof(AccountExport).Assembly.GetManifestResourceNames().Length == 0, "Exporter has no embedded catalog or exclusions");
Console.WriteLine($"{tests} assertions passed; both account snapshots validated.");

static string FixedResourceFingerprint()
{
    var fixture = Directory.CreateTempSubdirectory("wuwa-resource-fingerprint-");
    try
    {
        var timestamp = new DateTime(2025, 1, 2, 3, 4, 5, DateTimeKind.Utc);
        File.WriteAllText(Path.Combine(fixture.FullName, "LocalGameResources.json"), """{"version":"fixture"}""");
        File.WriteAllText(Path.Combine(fixture.FullName, "launcherDownloadConfig.json"), """{"bundles":{}}""");

        void WriteFile(string relativePath, int size)
        {
            var path = Path.Combine(fixture.FullName, relativePath);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllBytes(path, new byte[size]);
            File.SetLastWriteTimeUtc(path, timestamp);
        }

        WriteFile("Client/Content/Paks/pakchunk2.pak", 2);
        WriteFile("Client/Content/Paks/pakchunk10.pak", 4);
        WriteFile("Client/Saved/Resources/patch/resource.pak", 3);
        WriteFile("Client/Content/Paks/Video/ignored.pak", 5);
        WriteFile("Client/Saved/Resources/patch/ignored.sig", 6);
        return GameResources.Fingerprint(Path.Combine(fixture.FullName, "Wuthering Waves.exe"));
    }
    finally
    {
        fixture.Delete(recursive: true);
    }
}
