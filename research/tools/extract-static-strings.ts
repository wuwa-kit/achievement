import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  ExtractionResult,
  MatchedPakKey,
  StringCandidate,
} from "./static-string-types.ts";

const folder = "artifacts/static-strings";
const keys: MatchedPakKey[] = JSON.parse(
  fs.readFileSync(folder + "/matched-keys.json", "utf8"),
);
const candidates: StringCandidate[] = JSON.parse(
  fs.readFileSync(folder + "/string-candidates.json", "utf8"),
);
const selected = candidates.filter((r) =>
  /\/(?:lang_achievement|lang_multi_text|lang_multi_text_1sthalf|lang_hot_patch|db_achievement)\.db$/i.test(
    r.path,
  ),
);
const output: ExtractionResult[] = [];
fs.mkdirSync(folder + "/extracted", { recursive: true });
for (const r of selected) {
  try {
    const b = fs.readFileSync(folder + "/" + r.entries);
    let p = r.entry,
      v = b.readUInt32LE(p);
    p += 4;
    const f =
      (((v >>> 16) & 63) |
        ((v & 65535) << 6) |
        ((v & (1 << 28)) >>> 6) |
        ((v & 0x0fc00000) << 1) |
        ((v & 0xc0000000) >>> 1) |
        ((v & 0x20000000) << 2)) >>>
      0;
    const custom = b[p++];
    if ((f & 63) === 63) p += 4;
    const num = (small: boolean) => {
      const n = small ? b.readUInt32LE(p) : Number(b.readBigInt64LE(p));
      p += small ? 4 : 8;
      return n;
    };
    const size = num(!!(f & 0x80000000)),
      offset = num(!!(f & 0x40000000));
    if (((f >>> 23) & 63) !== 0) throw Error("compressed entry unsupported");
    if (size > 128 * 1024 * 1024) throw Error("size bound");
    const encrypted = !!(f & 0x400000),
      fd = fs.openSync(r.pak, "r"),
      raw = Buffer.alloc(encrypted ? Math.ceil(size / 16) * 16 : size);
    try {
      if (fs.readSync(fd, raw, 0, raw.length, offset + 53) !== raw.length)
        throw Error("short read");
    } finally {
      fs.closeSync(fd);
    }
    const limits: Record<number, number | undefined> = {
      0: raw.length,
      1: 0x200000,
      2: 0x800,
      4: 0,
    };
    const limit = limits[custom];
    if (limit === undefined) throw Error("unknown custom flag");
    if (encrypted) {
      const key = keys.find((k) => k.file === r.pak)?.key;
      if (!key) throw Error("no matching key");
      const d = crypto.createDecipheriv(
        "aes-256-ecb",
        Buffer.from(key.slice(2), "hex"),
        null,
      );
      d.setAutoPadding(false);
      const n = Math.min(limit, raw.length);
      Buffer.concat([d.update(raw.subarray(0, n)), d.final()]).copy(raw);
    }
    const content = raw.subarray(0, size),
      name = `${output.length}-${path.basename(r.path)}`,
      dest = folder + "/extracted/" + name;
    fs.writeFileSync(dest, content);
    output.push({
      ...r,
      output: dest,
      size,
      custom,
      sha256: crypto.createHash("sha256").update(content).digest("hex"),
      header: content.subarray(0, 16).toString(),
    });
  } catch (e) {
    output.push({ ...r, error: e instanceof Error ? e.message : String(e) });
  }
}
fs.writeFileSync(
  folder + "/extraction-report.json",
  JSON.stringify(output, null, 2),
);
console.log(
  JSON.stringify(
    {
      files: output.length,
      failed: output.filter((r) => r.error),
      headers: [...new Set(output.map((r) => r.header))],
      sample: output.slice(0, 3),
    },
    null,
    2,
  ),
);
