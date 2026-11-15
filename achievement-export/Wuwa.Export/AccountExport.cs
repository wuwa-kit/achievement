using System.Text.Json.Nodes;

namespace Wuwa.Export;

internal static class AccountExport
{
    public static void Validate(Snapshot first, Snapshot second, bool retryChanges = false)
    {
        foreach (var snapshot in new[] { first, second })
        {
            if (!snapshot.StructurallyValidated || snapshot.Stage != "snapshot" || snapshot.Count < 1 ||
                snapshot.Achievements.Length != snapshot.Count || snapshot.Achievements.Select(a => a.Id).Distinct().Count() != snapshot.Count ||
                snapshot.Achievements.Any(a => a.Id <= 0 || a.CurrentProgress < 0 || a.MaxProgress < 0 || a.FinishTimeRaw < 0) ||
                snapshot.ModelFinishCount < 0 || snapshot.ModelFinishCount > snapshot.Count || snapshot.ModelStarCount < 0 ||
                snapshot.GroupStates.Length == 0 || snapshot.GroupStates.Any(g => g.Id <= 0) ||
                snapshot.GroupStates.Select(g => g.Id).Distinct().Count() != snapshot.GroupStates.Length)
                throw new InvalidDataException("Snapshot structural validation failed");
        }
        if (first.Pid != second.Pid) throw new InvalidDataException("Snapshots came from different game processes");
        if (first.ModelFinishCount != second.ModelFinishCount || first.ModelStarCount != second.ModelStarCount ||
            !first.Achievements.OrderBy(a => a.Id).SequenceEqual(second.Achievements.OrderBy(a => a.Id)) ||
            !first.GroupStates.OrderBy(g => g.Id).SequenceEqual(second.GroupStates.OrderBy(g => g.Id)))
        {
            const string message = "Account state changed between snapshots";
            if (retryChanges) throw new SnapshotChangedException(message);
            throw new InvalidDataException(message);
        }
    }

    // Capture every observed ID, including unknown/new IDs. Only the website owns the catalog.
    public static JsonObject Build(Snapshot first, Snapshot second, string? uid, string resourceFingerprint)
    {
        Validate(first, second);
        return new JsonObject
        {
            ["schemaVersion"] = 3,
            ["kind"] = "account-progress",
            ["complete"] = true,
            ["uid"] = uid,
            ["capturedAt"] = second.At,
            ["resourceFingerprint"] = resourceFingerprint,
            ["count"] = second.Count,
            ["completedCount"] = second.ModelFinishCount,
            ["starCount"] = second.ModelStarCount,
            ["groupStates"] = Json.Node(second.GroupStates),
            ["achievements"] = Json.Node(second.Achievements.OrderBy(a => a.Id)),
        };
    }

    public static string Save(JsonObject export, string output)
    {
        string path = Path.Combine(output, "achievements.json");
        SaveFile(export, path);
        return path;
    }

    public static void SaveFile(JsonObject export, string path)
    {
        Json.Save(path, export, temporary =>
        {
            if (!JsonNode.DeepEquals(export, Json.Read(temporary))) throw new IOException("Export read-back mismatch");
        });
    }
}
