using System.Text.Json.Nodes;

namespace Wuwa.Export;

internal static class AchievementExclusions
{
    private static readonly Dictionary<int, JsonObject> Rules = Load();

    private static Dictionary<int, JsonObject> Load()
    {
        using var stream = typeof(AchievementExclusions).Assembly.GetManifestResourceStream("achievement-exclusions.json")
            ?? throw new InvalidDataException("Missing achievement exclusion configuration");
        var config = JsonNode.Parse(stream)!.AsObject();
        if (config.Get<int>("version") != 1 || config.Any(p => p.Key is not ("version" or "rules")))
            throw new InvalidDataException("Unsupported achievement exclusion configuration");
        var result = new Dictionary<int, JsonObject>();
        foreach (var rule in config.Rows("rules"))
        {
            string condition = rule.Get<string>("condition");
            if (condition is not ("always" or "missingProgress" or "titleEquals") ||
                rule.Get<int>("id") <= 0 || string.IsNullOrEmpty(rule.Get<string>("reason")) ||
                rule.Any(p => p.Key is not ("id" or "reason" or "condition") &&
                    !(condition == "titleEquals" && p.Key is "language" or "title")))
                throw new InvalidDataException("Invalid achievement exclusion rule");
            if (condition == "titleEquals" && (string.IsNullOrEmpty(rule.Get<string>("language")) || string.IsNullOrEmpty(rule.Get<string>("title"))))
                throw new InvalidDataException("Missing exclusion title or language");
            if (!result.TryAdd(rule.Get<int>("id"), rule)) throw new InvalidDataException("Duplicate achievement exclusion ID");
        }
        return result;
    }

    public static string? Reason(JsonObject item)
    {
        if (!Rules.TryGetValue(item.Get<int>("id"), out var rule)) return null;
        bool matches = rule.Get<string>("condition") switch
        {
            "always" => true,
            "titleEquals" => item["texts"]?[rule.Get<string>("language")]?["title"]?.GetValue<string>() == rule.Get<string>("title"),
            "missingProgress" => item.Get<string>("status") == "unknown" && item["currentProgress"] is null && item["maxProgress"] is null &&
                item["hasGetReward"]?.GetValue<bool>() != true && !(item["finishTimeRaw"]?.GetValue<double>() > 0) && !item.Get<bool>("visibleForAccount"),
            _ => throw new InvalidDataException("Unsupported exclusion condition")
        };
        return matches ? rule.Get<string>("reason") : null;
    }
}
