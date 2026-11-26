import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  MatchedPakKey,
  PakInventoryEntry,
} from "./static-string-types.ts";

interface PublicKeys {
  mainKey: string;
  dynamicKeys: { key: string }[];
}
// Read-only PAK v12 inventory. Public keys are supplied explicitly; no network or process access.
const root = path.resolve(
  process.argv[2] ??
    "C:/Program Files/Wuthering Waves/Wuthering Waves Game/Client",
);
const folder = "artifacts/static-strings";
const keyFile = process.argv[3] ?? folder + "/public-keys.json";
const supplied: PublicKeys = JSON.parse(fs.readFileSync(keyFile, "utf8"));
const keys = [
  ...new Set([supplied.mainKey, ...supplied.dynamicKeys.map((k) => k.key)]),
].map((k) => Buffer.from(k.replace(/^0x/, ""), "hex"));
if (keys.some((k) => k.length !== 32)) throw Error("Expected AES-256 keys");
function walk(dir: string): string[] {
  return fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((e) =>
          e.isDirectory()
            ? walk(path.join(dir, e.name))
            : [path.join(dir, e.name)],
        )
    : [];
}
const rows: PakInventoryEntry[] = [];
const matches: MatchedPakKey[] = [];
for (const file of [
  ...walk(path.join(root, "Content/Paks")),
  ...walk(path.join(root, "Saved/Resources")),
].filter((p) => p.endsWith(".pak"))) {
  const fd = fs.openSync(file, "r");
  try {
    const size = fs.fstatSync(fd).size,
      b = Buffer.alloc(Math.min(size, 512));
    fs.readSync(fd, b, 0, b.length, size - b.length);
    const at = b.lastIndexOf(Buffer.from("e1126f5a", "hex"));
    if (at < 17 || at + 44 > b.length)
      throw Error("Unsupported PAK footer: " + file);
    const row = {
      file,
      size,
      version: b.readUInt32LE(at + 4),
      encrypted: b[at - 1],
      guid: b.subarray(at - 17, at - 1).toString("hex"),
      offset: Number(b.readBigInt64LE(at + 8)),
      indexSize: Number(b.readBigInt64LE(at + 16)),
      hash: b.subarray(at + 24, at + 44).toString("hex"),
    };
    if (
      row.version !== 12 ||
      row.offset < 0 ||
      row.indexSize < 64 ||
      row.offset + row.indexSize > size ||
      row.encrypted > 1
    )
      throw Error("Unsupported PAK bounds/version: " + file);
    rows.push(row);
    if (row.encrypted) {
      const head = Buffer.alloc(64);
      fs.readSync(fd, head, 0, 64, row.offset);
      for (const key of keys) {
        const d = crypto.createDecipheriv("aes-256-ecb", key, null);
        d.setAutoPadding(false);
        const plain = Buffer.concat([d.update(head), d.final()]);
        const n = plain.readInt32LE();
        if (n > 0 && n < 2048 && plain.subarray(4, 7).toString() === "../") {
          matches.push({ file, key: "0x" + key.toString("hex") });
          break;
        }
      }
    }
  } finally {
    fs.closeSync(fd);
  }
}
fs.mkdirSync(folder, { recursive: true });
fs.writeFileSync(folder + "/pak-inventory.json", JSON.stringify(rows, null, 2));
fs.writeFileSync(
  folder + "/matched-keys.json",
  JSON.stringify(matches, null, 2),
);
console.log(
  JSON.stringify({
    archives: rows.length,
    encrypted: rows.filter((r) => r.encrypted).length,
    candidateKeyMatches: matches.length,
  }),
);
