import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { z } from "zod";
import { catalogPng } from "../achievement-website/build/catalog-png.ts";
import { publicPreview } from "../achievement-website/build/public-catalog.ts";
import { readCatalogPngJson } from "../achievement-website/src/lib/catalog-png.ts";

const siteOrigin = "https://wu.songe.li";
const kuroOrigin = "https://www.kurobbs.com";
const uploadEndpoint = "https://api.kurobbs.com/forum/uploadForumImgForH5";
const imageUrl =
  /^https:\/\/prod-alicdn-community\.kurobbs\.com\/forum\/[\w/-]+\.png$/;
const manifest = new URL(
  "../achievement-website/website-catalog.json",
  import.meta.url,
);

function readImageUrl(input: unknown) {
  const result = z
    .object({
      code: z.union([z.number(), z.string()]),
      data: z.unknown().optional(),
    })
    .safeParse(input);
  if (!result.success) throw new Error("无法识别库街区上传响应");
  const { code, data } = result.data;
  if (String(code) === "220")
    throw new Error("库街区登录已过期，请更新根目录 .env");
  if (!["0", "200"].includes(String(code))) throw new Error("库街区拒绝上传");

  const urls = new Set<string>();
  function collect(value: unknown) {
    if (typeof value === "string" && imageUrl.test(value)) urls.add(value);
    if (value && typeof value === "object")
      Object.values(value).forEach(collect);
  }
  collect(data);
  if (urls.size !== 1) throw new Error("上传响应未包含唯一的库街区 PNG 直链");
  return [...urls][0];
}

async function uploadCatalog() {
  const env = await readFile(new URL("../.env", import.meta.url), "utf8").catch(
    () => {
      throw new Error("无法读取仓库根目录 .env");
    },
  );
  const { KURO_TOKEN: token, KURO_DEVCODE: devcode } = parseEnv(env);
  if (!token?.trim() || !devcode?.trim())
    throw new Error("请在根目录 .env 中填写 KURO_TOKEN 和 KURO_DEVCODE");

  const json = await publicPreview();
  const sourceSha256 = createHash("sha256").update(json).digest("hex");
  const png = catalogPng(json);
  const form = new FormData();
  form.append(
    "files",
    new Blob([new Uint8Array(png)], { type: "image/png" }),
    "achievement-catalog.png",
  );
  const upload = await fetch(uploadEndpoint, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(60_000),
    headers: {
      Accept: "application/json, text/plain, */*",
      source: "h5",
      state_id: "8",
      wiki_type: "10",
      token: token.trim(),
      devcode: devcode.trim(),
      Origin: kuroOrigin,
      Referer: kuroOrigin + "/",
    },
    body: form,
  });
  if (!upload.ok) throw new Error(`库街区上传失败（HTTP ${upload.status}）`);
  const url = readImageUrl(await upload.json().catch(() => null));
  const original = await fetch(url, {
    redirect: "error",
    headers: { Origin: siteOrigin },
    signal: AbortSignal.timeout(60_000),
  });
  if (!original.ok)
    throw new Error(`无法读取库街区原图（HTTP ${original.status}）`);
  if (!original.headers.get("content-type")?.startsWith("image/png"))
    throw new Error("库街区原图未返回 PNG");
  const allowedOrigin = original.headers.get("access-control-allow-origin");
  if (allowedOrigin !== "*" && allowedOrigin !== siteOrigin)
    throw new Error("库街区原图不允许网站跨域读取");

  const body = await original.arrayBuffer();
  if (!Buffer.from(body).equals(png))
    throw new Error("库街区原图与上传的 PNG 字节不同");
  if ((await readCatalogPngJson(body)) !== json)
    throw new Error("库街区原图的 iTXt 数据与源图鉴不同");

  const temporary = new URL(
    `website-catalog.json.${randomUUID()}.tmp`,
    manifest,
  );
  try {
    await writeFile(
      temporary,
      JSON.stringify({ url, sourceSha256 }, null, 2) + "\n",
      { flag: "wx" },
    );
    await rename(temporary, manifest);
  } finally {
    await rm(temporary, { force: true });
  }
  console.log(`已验证并更新图鉴直链 ${url}`);
}

try {
  await uploadCatalog();
} catch (error) {
  console.error(error instanceof Error ? error.message : "上传图鉴失败");
  process.exitCode = 1;
}
