import fs from "node:fs/promises";
import path from "node:path";

import { canonicalPageUrl } from "./resolveIcon.js";

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

/**
 * Writes fetched page titles into `data/pages.json` when a link had no `title` and the build
 * resolved one from the remote page. Does nothing if nothing changed.
 *
 * @param {Map<string, { iconUrl?: string | null; pageTitle?: string | null }>} urlToResult
 */
export async function persistFetchedTitlesInPagesJson(
  urlToResult,
  jsonPath = path.join(process.cwd(), "data", "pages.json"),
) {
  if (!urlToResult || urlToResult.size === 0) return;

  let raw;
  try {
    raw = await fs.readFile(jsonPath, "utf8");
  } catch {
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }

  if (!Array.isArray(parsed)) return;

  let changed = false;

  function maybeSetTitle(link) {
    if (!link || typeof link !== "object") return;
    const url = normalizeUrl(link.url);
    if (!url) return;
    if (String(link.title ?? "").trim()) return;
    const key = canonicalPageUrl(url);
    if (!key) return;
    const pt = urlToResult.get(key)?.pageTitle;
    const t = typeof pt === "string" ? pt.trim() : "";
    if (!t) return;
    link.title = t;
    changed = true;
  }

  const hasAnyGroups = parsed.some((x) => isGroupItem(x));

  if (hasAnyGroups) {
    for (const group of parsed) {
      if (!isGroupItem(group)) continue;
      const linksRaw = group.links ?? group.pages;
      if (!Array.isArray(linksRaw)) continue;

      for (let i = 0; i < linksRaw.length; i++) {
        const link = linksRaw[i];

        if (typeof link === "string") {
          const url = normalizeUrl(link);
          if (!url) continue;
          const key = canonicalPageUrl(url);
          if (!key) continue;
          const pt = urlToResult.get(key)?.pageTitle;
          const t = typeof pt === "string" ? pt.trim() : "";
          if (!t) continue;
          linksRaw[i] = { url: link.trim(), title: t };
          changed = true;
          continue;
        }

        maybeSetTitle(link);
      }
    }
  } else {
    for (const p of parsed) {
      if (!p || typeof p !== "object") continue;
      if (!normalizeUrl(p.url)) continue;
      maybeSetTitle(p);
    }
  }

  if (!changed) return;

  const out = `${JSON.stringify(parsed, null, 2)}\n`;
  const tmp = `${jsonPath}.${process.pid}.tmp`;
  await fs.writeFile(tmp, out, "utf8");
  await fs.rename(tmp, jsonPath);
}
