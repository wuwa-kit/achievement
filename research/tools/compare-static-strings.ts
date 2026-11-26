import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type {
  ExtractedDatabase,
  ExtractionResult,
} from "./static-string-types.ts";

interface CatalogTextItem {
  titleKey?: string | null;
  descriptionKey?: string | null;
  texts: Record<string, { title: string | null; description?: string | null }>;
}

interface TextCatalog {
  languages: string[];
  achievements: CatalogTextItem[];
  groups: CatalogTextItem[];
  categories: CatalogTextItem[];
}

interface MultiTextRow {
  Id: string;
  Content: string | null;
  RedirectDbIndex?: number | null;
}

const folder = "artifacts/static-strings";
const rows: ExtractionResult[] = JSON.parse(
  fs.readFileSync(folder + "/extraction-report.json", "utf8"),
);
const catalog: TextCatalog = JSON.parse(
  fs.readFileSync("data/achievement-catalog.json", "utf8"),
);
const selected = new Map<string, ExtractedDatabase>();
for (const r of rows) {
  if (r.error === undefined) selected.set(r.path.replace(/\/+/g, "/"), r);
}
const texts: Record<string, Record<string, string | null>> = {};
const report = [];
const differences = [];
for (const language of catalog.languages) {
  const databases = [...selected.values()]
    .filter(
      (r) =>
        r.path.includes("/" + language + "/") &&
        /lang_(multi_text|multi_text_1sthalf|hot_patch)\.db$/.test(r.path),
    )
    .map((r) => ({
      source: r,
      db: new DatabaseSync(r.output, { readOnly: true }),
    }));
  const statements = databases.flatMap(({ source, db }) =>
    db
      .prepare("select name from sqlite_master where type='table'")
      .all()
      .filter((t) => t.name === "MultiText")
      .map(() => ({
        source,
        query: db.prepare("select * from MultiText where Id = ?"),
      })),
  );
  let checked = 0,
    matched = 0,
    missing = 0,
    redirected = 0;
  const values: Record<string, string | null> = {};
  const records = [
    ...catalog.achievements,
    ...catalog.groups,
    ...catalog.categories,
  ];
  for (const item of records)
    for (const [keyField, field] of [
      ["titleKey", "title"],
      ["descriptionKey", "description"],
    ] as const) {
      const key = item[keyField];
      if (!key) continue;
      const found = statements.flatMap((s) => {
        const row = s.query.get(key) as MultiTextRow | undefined;
        return row ? [{ row, source: s.source.path }] : [];
      });
      const nonempty = found.filter((x) => x.row.Content);
      const unique = [...new Set(nonempty.map((x) => x.row.Content))];
      if (found.some((x) => (x.row.RedirectDbIndex ?? 0) !== 0)) redirected++;
      const actual = unique.length === 1 ? unique[0] : null;
      const expected = item.texts[language]?.[field] ?? null;
      values[key] = actual;
      checked++;
      if (actual === expected) matched++;
      else
        differences.push({
          language,
          key,
          expected,
          actual,
          candidates: nonempty,
        });
      if (!actual) missing++;
    }
  texts[language] = values;
  report.push({
    language,
    checked,
    matched,
    missing,
    redirected,
    databaseCount: databases.length,
  });
  for (const { db } of databases) {
    const result = db.prepare("PRAGMA quick_check").all();
    if (result.some((r) => r.quick_check !== "ok"))
      throw Error("SQLite integrity check failed");
    db.close();
  }
}
fs.writeFileSync(
  folder + "/achievement-strings.json",
  JSON.stringify({ source: "local-pak-sqlite", texts }, null, 2),
);
fs.writeFileSync(
  folder + "/comparison.json",
  JSON.stringify({ report, differences }, null, 2),
);
console.log(
  JSON.stringify(
    {
      report,
      differenceCount: differences.length,
      sample: differences.slice(0, 4),
    },
    null,
    2,
  ),
);
