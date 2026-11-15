using System.Globalization;
using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using Wuwa.Export;

namespace Wuwa.Desktop;

internal sealed record HistoryEntry(string Id, string Uid, string ExportedAt, int CompletedCount, int TotalCount);

internal sealed class ExportHistory(string directory)
{
    private const string HistoryMutex = "WuwaAchievementExport.Accounts";

    private static bool IsUid(string? uid) => uid is { Length: > 0 } && uid[0] != '0' && uid.All(char.IsAsciiDigit);

    private string PathForId(string id)
    {
        var uid = id.Split('-', 2)[0];
        if (!IsUid(uid)) throw new ArgumentException("Invalid history ID.");
        return Path.Combine(directory, uid + ".json");
    }

    private static HistoryEntry Describe(JsonElement data)
    {
        var uid = data.TryGetProperty("uid", out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() : null;
        if (uid is null || !IsUid(uid)) throw new InvalidDataException("The snapshot must have a valid UID.");
        var capturedAt = data.GetProperty("capturedAt").GetString() ?? throw new InvalidDataException("Missing capture time.");
        var timestamp = DateTimeOffset.Parse(capturedAt, CultureInfo.InvariantCulture);
        var id = uid + "-" + timestamp.UtcTicks.ToString(CultureInfo.InvariantCulture);
        return new(id, uid, capturedAt, data.GetProperty("completedCount").GetInt32(), data.GetProperty("count").GetInt32());
    }

    private static DateTimeOffset Timestamp(HistoryEntry entry) => DateTimeOffset.Parse(entry.ExportedAt, CultureInfo.InvariantCulture);

    public static string JsonFileName(HistoryEntry entry)
    {
        var timestamp = Timestamp(entry).UtcDateTime.ToString("yyyyMMdd-HHmmss'Z'", CultureInfo.InvariantCulture);
        return $"Wuthering-Waves-Achievements-{entry.Uid}-{timestamp}.json";
    }

    private static (HistoryEntry Entry, byte[] Bytes)? ReadSnapshot(string path)
    {
        try
        {
            var uid = Path.GetFileNameWithoutExtension(path);
            if (!IsUid(uid) || (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0) return null;
            var bytes = File.ReadAllBytes(path);
            using var document = JsonDocument.Parse(bytes);
            var entry = Describe(document.RootElement);
            return entry.Uid == uid ? (entry, bytes) : null;
        }
        catch (Exception e) when (e is InvalidDataException || e is JsonException or IOException or InvalidOperationException or KeyNotFoundException or FormatException)
        {
            return null;
        }
    }

    public HistoryEntry[] List() => WithLock<HistoryEntry[]>(() =>
    {
        if (!Directory.Exists(directory)) return [];
        return Directory.EnumerateFiles(directory, "*.json")
            .Select(path => ReadSnapshot(path)?.Entry)
            .OfType<HistoryEntry>()
            .OrderByDescending(Timestamp)
            .ThenBy(entry => entry.Uid, StringComparer.Ordinal)
            .ToArray();
    });

    private static T WithLock<T>(Func<T> action)
    {
        using var mutex = new Mutex(false, HistoryMutex);
        try { mutex.WaitOne(); }
        catch (AbandonedMutexException) { }
        try { return action(); }
        finally { mutex.ReleaseMutex(); }
    }

    public string Add(JsonObject export)
    {
        var incoming = Describe(JsonSerializer.SerializeToElement(export, Json.Options));
        var path = Path.Combine(directory, incoming.Uid + ".json");
        return WithLock(() =>
        {
            if (ReadSnapshot(path) is not { Entry: var existing } || Timestamp(existing) < Timestamp(incoming))
                AccountExport.SaveFile(export, path);
            return path;
        });
    }

    public bool Delete(string id) => WithLock(() =>
    {
        var path = PathForId(id);
        if (ReadSnapshot(path)?.Entry.Id != id) return false;
        File.Delete(path);
        return true;
    });

    public (HistoryEntry Entry, byte[] Bytes) Read(string id) => WithLock(() =>
    {
        var snapshot = ReadSnapshot(PathForId(id));
        if (snapshot is not { } current || current.Entry.Id != id)
            throw new FileNotFoundException("The history entry no longer exists.");
        return current;
    });

    public void SaveJson(string id, string destination) => File.WriteAllBytes(destination, Read(id).Bytes);
}
