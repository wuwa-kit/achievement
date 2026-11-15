using System.Text.Json.Nodes;

namespace Wuwa.Export;

internal static class ExportBuilder
{
    public static void Validate(Snapshot first, Snapshot second, JsonObject? catalog = null)
    {
        HashSet<int>? mainIds = null;
        HashSet<int>? mainGroupIds = null;
        if (catalog is not null)
        {
            var mainCategories = catalog.Rows("categories").Where(c => c.Get<int>("functionType") == 1).Select(c => c.Get<int>("id")).ToHashSet();
            mainIds = catalog.Rows("achievements").Where(a => mainCategories.Contains(a.Get<int>("categoryId"))).Select(a => a.Get<int>("id")).ToHashSet();
            mainGroupIds = catalog.Rows("groups").Where(g => mainCategories.Contains(g.Get<int>("categoryId"))).Select(g => g.Get<int>("id")).ToHashSet();
            var configuredIds = catalog.Rows("achievements").Select(a => a.Get<int>("id")).ToHashSet();
            if (first.Achievements.Concat(second.Achievements).Any(a => !configuredIds.Contains(a.Id))) throw new InvalidDataException("Live ID missing from catalog");
        }
        foreach (var snapshot in new[] { first, second })
        {
            if (!snapshot.StructurallyValidated || snapshot.Stage != "snapshot" || snapshot.Count < 1 || snapshot.Achievements.Length != snapshot.Count || snapshot.Achievements.Select(a => a.Id).Distinct().Count() != snapshot.Count)
                throw new InvalidDataException("Snapshot structural validation failed");
            if (mainIds is not null)
            {
                int completed = snapshot.Achievements.Count(a => mainIds.Contains(a.Id) && (a.HasGetReward == true || a.FinishTimeRaw > 0));
                if (completed != snapshot.ModelFinishCount)
                    throw new InvalidDataException($"四大类完成数校验失败：逐条记录 {completed}，客户端总数 {snapshot.ModelFinishCount}。");
            }
            // A claimed reward is itself completion evidence; timestamps can be absent.
            if (snapshot.GroupStates.Length == 0 || snapshot.GroupStates.Select(g => g.Id).Distinct().Count() != snapshot.GroupStates.Length) throw new InvalidDataException("Missing or duplicate group states");
        }
        // Without a catalog, retain the full comparison until configuration is refreshed.
        IEnumerable<Achievement> RelevantAchievements(Snapshot s) => s.Achievements.Where(a => mainIds is null || mainIds.Contains(a.Id)).OrderBy(a => a.Id);
        IEnumerable<GroupState> RelevantGroups(Snapshot s) => s.GroupStates.Where(g => mainGroupIds is null || mainGroupIds.Contains(g.Id)).OrderBy(g => g.Id);
        if (first.Pid != second.Pid || first.ModelFinishCount != second.ModelFinishCount || first.ModelStarCount != second.ModelStarCount || !RelevantAchievements(first).SequenceEqual(RelevantAchievements(second)) || !RelevantGroups(first).SequenceEqual(RelevantGroups(second)))
            throw new InvalidDataException("Achievement or group state changed between snapshots; retry");
    }

    public static JsonObject Build(Snapshot first, Snapshot second, JsonObject catalog)
    {
        Validate(first, second, catalog);
        if (!catalog.Get<bool>("configComplete")) throw new InvalidDataException("Incomplete catalog");
        var configs = catalog.Rows("achievements").ToDictionary(a => a.Get<int>("id"));
        var groups = catalog.Rows("groups").ToDictionary(g => g.Get<int>("id"));
        var progress = second.Achievements.ToDictionary(a => a.Id);
        var unlock = second.GroupStates.ToDictionary(g => g.Id, g => g.Unlocked);
        if (configs.Count != catalog.Get<int>("count")) throw new InvalidDataException("Catalog count mismatch");
        var mainCategoryIds = catalog.Rows("categories").Where(c => c.Get<int>("functionType") == 1).Select(c => c.Get<int>("id")).ToHashSet();
        int selectedModelCount = progress.Keys.Count(id => mainCategoryIds.Contains(configs[id].Get<int>("categoryId")));
        var rows = new List<JsonObject>();
        foreach (var id in configs.Keys.Where(id => mainCategoryIds.Contains(configs[id].Get<int>("categoryId"))).Order())
        {
            bool catalogOnly = !progress.TryGetValue(id, out var p);
            if (catalogOnly)
            {
                int[] previousIds = configs.Values.Where(a => a.Get<int>("nextLink") == id).Select(a => a.Get<int>("id")).ToArray();
                if (previousIds.Length > 1) throw new InvalidDataException("Ambiguous configuration chain");
                p = new Achievement(id, previousIds.FirstOrDefault(-1), configs[id].Get<int>("nextLink"), null, null, null, null);
            }
            if (p is null) throw new InvalidDataException("Missing achievement after catalog merge");
            var c = configs[p.Id]; var group = groups[c.Get<int>("groupId")]; int groupId = group.Get<int>("id");
            if (!unlock.ContainsKey(groupId)) throw new InvalidDataException($"Live group missing: {groupId}");
            string state = p.HasGetReward == true ? "HaveGetReward" : p.FinishTimeRaw > 0 ? "CanGetReward" : "UnFinished";
            string status = p.HasGetReward == true ? "reward_claimed" : p.FinishTimeRaw > 0 ? "completed" : p.CurrentProgress is null || p.MaxProgress is null ? "unknown" : "in_progress";
            string reason = !c.Get<bool>("inMainMenu") ? "outside_main_menu" :
                !group.Get<bool>("enabled") || !unlock[groupId] ? "group_unavailable" :
                p.MaxProgress is null ? "progress_unavailable" :
                c.Get<bool>("hidden") && state == "UnFinished" ? "hidden_until_completed" :
                p.PreviousId != -1 && (!progress.TryGetValue(p.PreviousId, out var previous) || previous.HasGetReward != true) ? "previous_reward_unclaimed" :
                p.HasGetReward == true && p.NextId > 0 ? "replaced_by_next_stage" : "visible";
            var row = c.Pick("id", "categoryId", "groupId", "hidden", "inMainMenu", "titleKey", "descriptionKey", "level", "dropId", "astrite", "rewards", "texts");
            row["visibleForAccount"] = reason == "visible"; row["visibilityReason"] = reason; row["clientState"] = state;
            row["previousId"] = p.PreviousId; row["nextId"] = p.NextId; row["currentProgress"] = p.CurrentProgress; row["maxProgress"] = p.MaxProgress;
            row["hasGetReward"] = p.HasGetReward; row["finishTimeRaw"] = p.FinishTimeRaw; row["status"] = status;
            if (catalogOnly) row["progressSource"] = "catalog-only";
            if (AchievementExclusions.Reason(row) is not null)
            {
                if (!catalogOnly) selectedModelCount--;
                continue;
            }
            if (row.Rows("rewards").Where(r => r.Get<int>("itemId") == 3).Sum(r => r.Get<int>("quantity")) != row.Get<int>("astrite")) throw new InvalidDataException("Astrite reward mismatch");
            rows.Add(row);
        }
        var categories = new List<JsonObject>();
        foreach (var category in catalog.Rows("categories").Where(c => c.Get<bool>("inMainMenu")))
        {
            var categoryGroups = new List<JsonObject>();
            foreach (var group in groups.Values.Where(g => g.Get<int>("categoryId") == category.Get<int>("id")).OrderBy(g => g.Get<int>("sort")).ThenBy(g => g.Get<int>("id")))
            {
                int id = group.Get<int>("id"); var g = group.Pick("id", "categoryId", "sort", "enabled", "titleKey", "texts");
                g["unlocked"] = unlock[id]; g["achievementIds"] = Json.Node(rows.Where(a => a.Get<int>("groupId") == id).Select(a => a.Get<int>("id"))); categoryGroups.Add(g);
            }
            var c = category.Pick("id", "titleKey", "texts"); c["groups"] = Json.Node(categoryGroups); categories.Add(c);
        }
        var main = rows.Where(a => a.Get<bool>("inMainMenu")).ToArray();
        var coverage = new List<object>();
        foreach (var code in catalog["languages"]!.AsArray())
        {
            string language = code!.GetValue<string>();
            var missingTitles = main.Where(a => a["texts"]?[language]?["title"] is null).Select(a => a.Get<int>("id")).ToArray();
            var missingDescriptions = main.Where(a => a["texts"]?[language]?["description"] is null).Select(a => a.Get<int>("id")).ToArray();
            coverage.Add(new { language, available = missingTitles.Length < main.Length || missingDescriptions.Length < main.Length, mainTitles = main.Length - missingTitles.Length, mainDescriptions = main.Length - missingDescriptions.Length, mainCount = main.Length, missingTitles, missingDescriptions });
        }
        var export = new JsonObject
        {
            ["schemaVersion"] = 2, ["complete"] = true, ["coverage"] = "main-achievement-menu", ["capturedAt"] = second.At,
            ["processId"] = second.Pid, ["count"] = rows.Count, ["completedCount"] = second.ModelFinishCount, ["starCount"] = second.ModelStarCount,
            ["unknownCount"] = rows.Count(a => a.Get<string>("status") == "unknown"), ["groupStates"] = Json.Node(second.GroupStates.Where(g => groups.TryGetValue(g.Id, out var config) && mainCategoryIds.Contains(config.Get<int>("categoryId")))),
            ["achievements"] = Json.Node(rows), ["coreclrSha256"] = RuntimeProfile.Hash,
            ["languages"] = catalog["languages"]!.DeepClone(), ["languageCoverage"] = Json.Node(coverage),
            ["catalogSource"] = catalog["source"]!.DeepClone(), ["catalogFingerprint"] = catalog["resourceFingerprint"]!.DeepClone(),
            ["categories"] = Json.Node(categories), ["mainMenuCount"] = main.Length, ["otherGameplayCount"] = rows.Count - main.Length,
            ["astriteSummary"] = Json.Node(new { scope = "main-achievement-menu", configuredTotal = main.Sum(a => a.Get<int>("astrite")), claimed = main.Where(a => a["hasGetReward"]?.GetValue<bool>() == true).Sum(a => a.Get<int>("astrite")), readyToClaim = main.Where(a => a.Get<string>("clientState") == "CanGetReward").Sum(a => a.Get<int>("astrite")), notCompleted = main.Where(a => a.Get<string>("clientState") == "UnFinished").Sum(a => a.Get<int>("astrite")), unknownProgressCount = main.Count(a => a["maxProgress"] is null) })
        };
        if (rows.Count != selectedModelCount)
        {
            export["coverage"] = "main-achievement-menu+catalog";
            export["clientModelCount"] = selectedModelCount;
            export["catalogOnlyCount"] = rows.Count - selectedModelCount;
        }
        return export;
    }

    public static void SaveViews(JsonObject export, string output)
    {
        var index = export.Rows("achievements").ToDictionary(a => a.Get<int>("id"));
        string? Title(JsonNode node) => node["texts"]?["zh-Hans"]?["title"]?.GetValue<string>();
        var categories = export.Rows("categories").Select(category => new
        {
            id = category.Get<int>("id"), title = Title(category),
            groups = category.Rows("groups").Select(group => new
            {
                id = group.Get<int>("id"), title = Title(group), enabled = group.Get<bool>("enabled"), unlocked = group.Get<bool>("unlocked"),
                achievements = group["achievementIds"]!.AsArray().Select(n =>
                {
                    var item = index[n!.GetValue<int>()]; var row = item.Pick("id", "hidden", "visibleForAccount", "visibilityReason", "status", "currentProgress", "maxProgress", "astrite", "rewards", "previousId", "nextId");
                    row["title"] = Title(item); row["description"] = item["texts"]?["zh-Hans"]?["description"]?.DeepClone(); return row;
                }).ToArray()
            }).ToArray()
        }).ToArray();
        Json.Save(Path.Combine(output, "achievement-tree.zh-Hans.json"), new { language = "zh-Hans", scope = "main-achievement-menu", count = export.Get<int>("mainMenuCount"), astriteSummary = export["astriteSummary"], categories });
        Json.Save(Path.Combine(output, "achievements.json"), export);
        if (!JsonNode.DeepEquals(export, Json.Read(Path.Combine(output, "achievements.json")))) throw new IOException("Export read-back mismatch");
    }
}

