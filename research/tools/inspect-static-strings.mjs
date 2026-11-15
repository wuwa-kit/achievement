import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const folder = "artifacts/static-strings";
const matches = JSON.parse(
  fs.readFileSync(path.join(folder, "matched-keys.json")),
);
const inventory = JSON.parse(
  fs.readFileSync(path.join(folder, "pak-inventory.json")),
);
function decrypt(buffer, key) {
  if (!key) return buffer;
  const d = crypto.createDecipheriv(
    "aes-256-ecb",
    Buffer.from(key.replace(/^0x/, ""), "hex"),
    null,
  );
  d.setAutoPadding(false);
  return Buffer.concat([d.update(buffer), d.final()]);
}
function read(fd, offset, size) {
  if (size < 0 || size > 128 * 1024 * 1024) throw Error("size bound");
  const b = Buffer.alloc(size);
  if (fs.readSync(fd, b, 0, size, offset) !== size) throw Error("short read");
  return b;
}
class Reader {
  constructor(b) {
    this.b = b;
    this.p = 0;
  }
  i() {
    let n = this.b.readInt32LE(this.p);
    this.p += 4;
    return n;
  }
  l() {
    let n = Number(this.b.readBigInt64LE(this.p));
    this.p += 8;
    return n;
  }
  s() {
    let n = this.i();
    if (Math.abs(n) > 100000) throw Error("string bound");
    let v = this.b.subarray(this.p, this.p + Math.abs(n) * (n < 0 ? 2 : 1));
    this.p += v.length;
    return v.toString(n < 0 ? "utf16le" : "utf8").replace(/\0$/, "");
  }
}
const report = [];
const candidates = [];
for (const r of inventory) {
  const fd = fs.openSync(r.file, "r");
  try {
    const key = matches.find((k) => k.file === r.file)?.key;
    if (r.encrypted && !key) throw Error("no matching key");
    const get = (o, n) => decrypt(read(fd, o, n), key);
    const b = get(r.offset, r.indexSize);
    if (crypto.createHash("sha1").update(b).digest("hex") !== r.hash)
      throw Error("primary hash mismatch");
    const a = new Reader(b),
      mount = a.s(),
      count = a.i();
    a.l();
    if (a.i()) a.p += 36;
    if (!a.i()) throw Error("no directory");
    const offset = a.l(),
      size = a.l(),
      hash = b.subarray(a.p, a.p + 20).toString("hex");
    a.p += 20;
    const n = a.i(),
      encoded = b.subarray(a.p, a.p + n);
    const db = get(offset, size);
    if (crypto.createHash("sha1").update(db).digest("hex") !== hash)
      throw Error("directory hash mismatch");
    const d = new Reader(db),
      dirs = d.i();
    let files = 0,
      targets = [];
    for (let i = 0; i < dirs; i++) {
      const dir = d.s(),
        len = d.i();
      for (let j = 0; j < len; j++) {
        const name = mount + dir + d.s(),
          entry = d.i();
        files++;
        if (
          /MultiText|\.db$|Aki\..*\.dll$|Achievement|TextConfig|\.csv$/i.test(
            name,
          )
        )
          targets.push({ path: name, entry });
      }
    }
    if (targets.length) {
      const id = report.length;
      fs.writeFileSync(path.join(folder, `entries-${id}.bin`), encoded);
      candidates.push(
        ...targets.map((t) => ({
          ...t,
          pak: r.file,
          entries: `entries-${id}.bin`,
        })),
      );
    }
    report.push({
      file: r.file,
      mount,
      count,
      files,
      hashVerified: true,
      targets: targets.length,
    });
  } catch (e) {
    report.push({ file: r.file, error: e.message });
  } finally {
    fs.closeSync(fd);
  }
}
fs.writeFileSync(
  path.join(folder, "directory-report.json"),
  JSON.stringify(report, null, 2),
);
fs.writeFileSync(
  path.join(folder, "string-candidates.json"),
  JSON.stringify(candidates, null, 2),
);
console.log(
  JSON.stringify(
    {
      archives: report.length,
      failures: report.filter((r) => r.error),
      candidates: candidates.length,
      sample: candidates.slice(0, 35),
    },
    null,
    2,
  ),
);
