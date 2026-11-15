using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Wuwa.Export;

internal static class Json
{
    public static readonly JsonSerializerOptions Options = new() { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase, Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
    public static JsonObject Read(string path) => JsonNode.Parse(File.ReadAllText(path).TrimStart('\uFEFF'))?.AsObject() ?? throw new InvalidDataException($"Invalid JSON: {path}");
    public static T Load<T>(string path) => JsonSerializer.Deserialize<T>(File.ReadAllText(path).TrimStart('\uFEFF'), Options) ?? throw new InvalidDataException(path);
    public static JsonNode? Node(object? value) => JsonSerializer.SerializeToNode(value, Options);
    public static void Save(string path, object value, Action<string>? validate = null)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);
        string temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            File.WriteAllText(temporary, JsonSerializer.Serialize(value, Options), new System.Text.UTF8Encoding(false));
            if (validate is null)
            {
                using var check = JsonDocument.Parse(File.ReadAllText(temporary));
            }
            else validate(temporary);
            File.Move(temporary, path, true);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
    public static T Get<T>(this JsonNode node, string name) => node[name] is { } value ? value.GetValue<T>() : throw new InvalidDataException($"Missing field: {name}");
    public static IEnumerable<JsonObject> Rows(this JsonNode node, string name) => node[name]?.AsArray().Select(n => n?.AsObject() ?? throw new InvalidDataException(name)) ?? throw new InvalidDataException(name);
    public static JsonObject Pick(this JsonNode node, params string[] keys)
    {
        var result = new JsonObject();
        foreach (var key in keys) result[key] = node[key]?.DeepClone();
        return result;
    }
}

internal sealed record Achievement(int Id, int PreviousId, int NextId, int? CurrentProgress, int? MaxProgress, bool? HasGetReward, int? FinishTimeRaw);
internal sealed record GroupState(int Id, bool Unlocked);
internal sealed record Snapshot(uint Pid, string At, string Stage, bool StructurallyValidated, int Count, int ModelFinishCount, int ModelStarCount, Achievement[] Achievements, GroupState[] GroupStates);
