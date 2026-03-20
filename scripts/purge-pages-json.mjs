/**
 * Manual-only: strip `data/pages.json` down to user fields per link: `url`, `title`, `useImage`.
 * Removes `fallbackColor`, `iconImagePath`, and any other extra fields. Group `category` is kept.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = path.join(__dirname, "..", "data", "pages.json");

function normalizeUrl(u) {
  return String(u ?? "").trim();
}

function isGroupItem(x) {
  return (
    x &&
    typeof x === "object" &&
    typeof x.category === "string" &&
    (Array.isArray(x.links) || Array.isArray(x.pages))
  );
}

function purgeLink(link) {
  if (typeof link === "string") {
    const u = normalizeUrl(link);
    return u ? { url: u } : null;
  }
  if (!link || typeof link !== "object") return null;
  const url = normalizeUrl(link.url);
  if (!url) return null;
  const out = { url };
  const t = String(link.title ?? "").trim();
  if (t) out.title = t;
  if (link.useImage === false) out.useImage = false;
  return out;
}

function purgeGroup(group) {
  const linksRaw = group.links ?? group.pages;
  if (!Array.isArray(linksRaw)) {
    return { category: group.category, links: [] };
  }
  const key = group.links != null ? "links" : "pages";
  const next = linksRaw.map((link) => purgeLink(link)).filter(Boolean);
  return { category: group.category, [key]: next };
}

const raw = await fs.readFile(jsonPath, "utf8");
const parsed = JSON.parse(raw);

if (!Array.isArray(parsed)) {
  console.error("pages.json must be a JSON array.");
  process.exit(1);
}

const hasAnyGroups = parsed.some((x) => isGroupItem(x));

let outArr;
if (hasAnyGroups) {
  outArr = parsed.map((x) => (isGroupItem(x) ? purgeGroup(x) : x));
} else {
  outArr = parsed.map((p) => purgeLink(p)).filter(Boolean);
}

const out = `${JSON.stringify(outArr, null, 2)}\n`;
const tmp = `${jsonPath}.${process.pid}.tmp`;
await fs.writeFile(tmp, out, "utf8");
await fs.rename(tmp, jsonPath);

console.log(`Purged ${jsonPath} (url / title / useImage only per link).`);
