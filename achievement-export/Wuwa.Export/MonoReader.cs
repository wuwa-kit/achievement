using System.Text;
using System.Text.RegularExpressions;

namespace Wuwa.Export;

internal sealed class MonoReader(Func<long, int, byte[]> read, uint processId)
{
    public MonoReader(StartupProcess child) : this(child.Read, child.Id) { }
    internal sealed record Field(int Offset, byte Kind, ushort Attributes, long Data);
    private static readonly string[] AchievementFields = ["Id", "LastAchievementId", "NextAchievementId", "CurrentProgress", "MaxProgress", "HasGetRewardState", "FinishTime"];
    private static readonly string[] GroupFields = ["Id", "IfUnLock"];
    private readonly Dictionary<long, Dictionary<string, Field>> fields = new();
    private readonly Dictionary<long, string> classNames = new();
    private byte[] Bytes(long address, int count)
    {
        if (address <= 0) throw new InvalidDataException("Invalid address in Mono object or metadata");
        try { return read(address, count); }
        catch (Exception error) when (error is System.ComponentModel.Win32Exception or IOException)
        {
            throw new CollectionException(CollectionFailure.MemoryRead, $"Failed reading {count} bytes at 0x{address:X}: {error.Message}", error);
        }
    }
    public long Pointer(long address) => BitConverter.ToInt64(Bytes(address, 8));
    public int Integer(long address) => BitConverter.ToInt32(Bytes(address, 4));
    public long ObjectClass(long address) => Pointer(Pointer(address));
    public string ClassName(long klass)
    {
        if (classNames.TryGetValue(klass, out var name)) return name;
        name = Name(Pointer(klass + 72));
        classNames.Add(klass, name);
        return name;
    }
    private string Name(long address)
    {
        byte[] bytes = Bytes(address, 128); int end = Array.IndexOf(bytes, (byte)0);
        if (end < 0) throw new InvalidDataException("Unterminated metadata name");
        return Encoding.UTF8.GetString(bytes, 0, end);
    }
    public Dictionary<string, Field> Fields(long klass)
    {
        if (fields.TryGetValue(klass, out var cached)) return cached;
        long pointer = Pointer(klass + 160); var result = new Dictionary<string, Field>();
        for (int i = 0; i < 128; i++)
        {
            byte[] entry = Bytes(pointer + i * 32, 32);
            if ((BitConverter.ToInt64(entry, 16) & -4L) != klass) break;
            string name = Name(BitConverter.ToInt64(entry, 8));
            if (!Regex.IsMatch(name, @"^[A-Za-z_<][A-Za-z0-9_<>`.$]*$")) break;
            byte[] type = Bytes(BitConverter.ToInt64(entry), 16);
            result.Add(name, new(BitConverter.ToInt32(entry, 24), type[10], BitConverter.ToUInt16(type, 8), BitConverter.ToInt64(type)));
        }
        fields.Add(klass, result); return result;
    }
    private Dictionary<string, Field> RequiredFields(long klass, params string[] names)
    {
        var result = Fields(klass);
        foreach (string name in names)
        {
            if (!result.TryGetValue(name, out var field))
                throw new CollectionException(CollectionFailure.FieldMissing, $"Missing Mono field {name}", field: name);
            if (field.Offset < 16) throw new InvalidDataException($"Invalid instance offset for Mono field {name}: {field.Offset}");
        }
        return result;
    }
    private object? Nullable(long address, Field field)
    {
        if (field.Kind != 21) throw new InvalidDataException("Expected nullable field");
        long klass = Pointer(field.Data + 32);
        if (ClassName(klass) != "Nullable`1") throw new InvalidDataException("Invalid nullable class");
        var f = RequiredFields(klass, "hasValue", "value"); byte hasValue = Bytes(address + f["hasValue"].Offset - 16, 1)[0];
        if (hasValue == 0) return null;
        if (hasValue != 1) throw new InvalidDataException("Invalid nullable flag");
        long value = address + f["value"].Offset - 16;
        return f["value"].Kind switch { 2 => Bytes(value, 1)[0] != 0, 8 => Integer(value), _ => throw new InvalidDataException("Unsupported nullable type") };
    }
    public string ManagedString(long address)
    {
        if (ClassName(ObjectClass(address)) != "String") throw new InvalidDataException("Not a string");
        int length = Integer(address + 16);
        if (length < 0 || length > 32768) throw new InvalidDataException("String length bound");
        return length == 0 ? "" : Encoding.Unicode.GetString(Bytes(address + 20, length * 2));
    }
    private List<(int Key, long Address)> Entries(long dictionary, int maximum)
    {
        var df = RequiredFields(ObjectClass(dictionary), "_count", "_freeCount", "_version", "_entries");
        int count = Integer(dictionary + df["_count"].Offset), free = Integer(dictionary + df["_freeCount"].Offset), version = Integer(dictionary + df["_version"].Offset);
        if (count < 1 || count > maximum || free < 0 || free > count) throw new InvalidDataException("Dictionary count bound");
        long array = Pointer(dictionary + df["_entries"].Offset), element = Pointer(ObjectClass(array));
        var ef = RequiredFields(element, "next", "key", "value"); int stride = Integer(element + 28) - 16; long length = Pointer(array + 24);
        if (stride < 16 || stride > 128 || length < count || length > 100000) throw new InvalidDataException("Dictionary layout bound");
        var result = new List<(int, long)>(); var keys = new HashSet<int>();
        for (int i = 0; i < count; i++)
        {
            long entry = array + 32 + i * stride;
            if (Integer(entry + ef["next"].Offset - 16) < -1) continue;
            int key = Integer(entry + ef["key"].Offset - 16); long value = Pointer(entry + ef["value"].Offset - 16);
            if (!keys.Add(key) || value == 0) throw new InvalidDataException("Duplicate or null dictionary entry");
            result.Add((key, value));
        }
        if (Integer(dictionary + df["_version"].Offset) != version || Pointer(dictionary + df["_entries"].Offset) != array)
            throw new SnapshotChangedException("Dictionary changed during read");
        if (result.Count != count - free) throw new InvalidDataException("Dictionary entry count mismatch");
        return result;
    }
    public Snapshot ReadSnapshot(IEnumerable<HeapObjects.Item> objects)
    {
        var candidates = objects.Where(o => o.Type == "AchievementModel").Take(2).ToArray();
        if (candidates.Length == 0) throw new CollectionException(CollectionFailure.ModelMissing, "AchievementModel was not found in the heap snapshot");
        if (candidates.Length > 1) throw new CollectionException(CollectionFailure.ModelAmbiguous, "Multiple AchievementModel objects were found in the heap snapshot");
        long model = checked((long)candidates[0].Address);
        long modelClass = ObjectClass(model);
        if (ClassName(modelClass) != "AchievementModel") throw new SnapshotChangedException("Heap snapshot address no longer points to AchievementModel", recapture: true);
        var mf = RequiredFields(modelClass, "AchievementMap", "AllAchievementGroupMap", "AchieveFinishCount", "AchieveStarCount");
        long map = Pointer(model + mf["AchievementMap"].Offset);
        long mapVersionAddress = map + RequiredFields(ObjectClass(map), "_version")["_version"].Offset;
        int mapVersion = Integer(mapVersionAddress);
        var rows = new List<Achievement>();
        foreach (var (id, address) in Entries(map, 10000))
        {
            long klass = ObjectClass(address);
            if (ClassName(klass) != "AchievementData") throw new InvalidDataException("Wrong achievement type");
            var f = RequiredFields(klass, AchievementFields);
            if (Integer(address + f["Id"].Offset) != id) throw new InvalidDataException("Achievement key mismatch");
            object? Get(string key) => Nullable(address + f[key].Offset, f[key]);
            rows.Add(new(id, Integer(address + f["LastAchievementId"].Offset), Integer(address + f["NextAchievementId"].Offset), (int?)Get("CurrentProgress"), (int?)Get("MaxProgress"), (bool?)Get("HasGetRewardState"), (int?)Get("FinishTime")));
        }
        if (Pointer(model + mf["AchievementMap"].Offset) != map || Integer(mapVersionAddress) != mapVersion) throw new SnapshotChangedException("Achievement map changed during read");
        var groups = new List<GroupState>();
        long groupMap = Pointer(model + mf["AllAchievementGroupMap"].Offset);
        long groupVersionAddress = groupMap + RequiredFields(ObjectClass(groupMap), "_version")["_version"].Offset;
        int groupVersion = Integer(groupVersionAddress);
        foreach (var (id, address) in Entries(groupMap, 1000))
        {
            long klass = ObjectClass(address);
            if (ClassName(klass) != "AchievementGroupData") throw new InvalidDataException("Wrong group type");
            var f = RequiredFields(klass, GroupFields); if (Integer(address + f["Id"].Offset) != id) throw new InvalidDataException("Group key mismatch");
            byte unlocked = Bytes(address + f["IfUnLock"].Offset, 1)[0];
            if (unlocked > 1) throw new InvalidDataException("Invalid group state");
            groups.Add(new(id, unlocked == 1));
        }
        if (Pointer(model + mf["AllAchievementGroupMap"].Offset) != groupMap || Integer(groupVersionAddress) != groupVersion) throw new SnapshotChangedException("Achievement group map changed during read");
        return new(processId, DateTimeOffset.Now.ToString("o"), "snapshot", true, rows.Count, Integer(model + mf["AchieveFinishCount"].Offset), Integer(model + mf["AchieveStarCount"].Offset), rows.ToArray(), groups.ToArray());
    }
}
