using System.Text.Json.Nodes;
using Wuwa.Desktop;

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
    Check(ExportHistory.JsonFileName(first) == "Wuthering-Waves-Achievements-123-20261114-000000Z.json");
    store.Add(source);
    Check(store.List().Single() == first && first.Uid == "123" && first.CompletedCount == 1 && first.TotalCount == 2);
    var newest = source.DeepClone().AsObject();
    newest["capturedAt"] = "2026-11-14T01:00:00Z";
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
}
finally { Directory.Delete(directory, true); }
