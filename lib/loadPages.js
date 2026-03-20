import fs from "node:fs/promises";
import path from "node:path";

import { isValidFallbackColorHex } from "./ensureFallbackColors.js";
import { isPublicLinkIconPath } from "./iconImagePath.js";

export async function loadPagesJson(jsonPath = path.join(process.cwd(), "data", "pages.json")) {
  const raw = await fs.readFile(jsonPath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) return [];

  const normalizeUrl = (u) => String(u ?? "").trim();
  const normalizeTitle = (t) => {
    const s = t == null ? "" : String(t).trim();
    return s ? s : undefined;
  };

  /** Default true; only explicit `false` disables fetched images. */
  const useImageFrom = (x) => (x && typeof x === "object" && x.useImage === false ? false : true);

  const isGroupItem = (x) =>
    x &&
    typeof x === "object" &&
    typeof x.category === "string" &&
    (Array.isArray(x.links) || Array.isArray(x.pages));

  const hasAnyGroups = parsed.some((x) => isGroupItem(x));

  if (hasAnyGroups) {
    const out = [];
    for (const group of parsed) {
      if (!isGroupItem(group)) continue;
      const category = group.category.trim();
      if (!category) continue;

      const linksRaw = group.links ?? group.pages ?? [];
      for (const link of linksRaw) {
        if (typeof link === "string") {
          const url = normalizeUrl(link);
          if (!url) continue;
          out.push({ category, url });
          continue;
        }

        if (!link || typeof link !== "object") continue;
        const url = normalizeUrl(link.url);
        if (!url) continue;
        const fc =
          link.fallbackColor != null && isValidFallbackColorHex(link.fallbackColor)
            ? link.fallbackColor.trim()
            : undefined;
        const useImage = useImageFrom(link);
        const iconIP =
          link.iconImagePath != null && isPublicLinkIconPath(link.iconImagePath)
            ? link.iconImagePath.trim()
            : undefined;
        out.push({
          category,
          url,
          title: normalizeTitle(link.title),
          ...(fc ? { fallbackColor: fc } : {}),
          ...(iconIP ? { iconImagePath: iconIP } : {}),
          ...(useImage ? {} : { useImage: false }),
        });
      }
    }
    return out;
  }

  const out = [];
  for (const p of parsed) {
    if (!p || typeof p !== "object") continue;
    const url = normalizeUrl(p.url);
    if (!url) continue;
    const title = normalizeTitle(p.title);
    const fc =
      p.fallbackColor != null && isValidFallbackColorHex(p.fallbackColor)
        ? p.fallbackColor.trim()
        : undefined;
    const useImage = useImageFrom(p);
    const iconIP =
      p.iconImagePath != null && isPublicLinkIconPath(p.iconImagePath)
        ? p.iconImagePath.trim()
        : undefined;
    const baseRow = {
      ...(fc ? { fallbackColor: fc } : {}),
      ...(iconIP ? { iconImagePath: iconIP } : {}),
      ...(useImage ? {} : { useImage: false }),
    };

    const rawCats = p.categories ?? p.category;
    if (rawCats == null) {
      out.push({ category: "Uncategorized", url, title, ...baseRow });
      continue;
    }

    if (typeof rawCats === "string") {
      const cat = rawCats.trim();
      out.push({ category: cat ? cat : "Uncategorized", url, title, ...baseRow });
      continue;
    }

    if (Array.isArray(rawCats)) {
      const cats = rawCats.map((c) => normalizeUrl(c)).filter(Boolean);
      if (cats.length === 0) {
        out.push({ category: "Uncategorized", url, title, ...baseRow });
      } else {
        for (const cat of cats) out.push({ category: cat, url, title, ...baseRow });
      }
    }
  }

  return out;
}
