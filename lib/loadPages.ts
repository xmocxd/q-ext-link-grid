import fs from "node:fs/promises";
import path from "node:path";

export type GridLink = {
  url: string;
  title?: string;
};

export type CategorizedLink = {
  category: string;
  url: string;
  title?: string;
};

export async function loadPagesJson(
  jsonPath: string = path.join(process.cwd(), "data", "pages.json"),
): Promise<CategorizedLink[]> {
  const raw = await fs.readFile(jsonPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  // Very small validation to avoid blowing up on malformed JSON.
  if (!Array.isArray(parsed)) return [];

  const normalizeUrl = (u: unknown): string => String(u ?? "").trim();
  const normalizeTitle = (t: unknown): string | undefined => {
    const s = t == null ? "" : String(t).trim();
    return s ? s : undefined;
  };

  // New format (preferred):
  // [
  //   { "category": "Frameworks", "links": [ { "url": "...", "title": "..." }, "https://..." ] }
  // ]
  const isGroupItem = (x: any): x is { category: string; links?: unknown[]; pages?: unknown[] } =>
    x && typeof x === "object" && typeof x.category === "string" && (Array.isArray(x.links) || Array.isArray(x.pages));

  const hasAnyGroups = parsed.some((x) => isGroupItem(x));

  if (hasAnyGroups) {
    const out: CategorizedLink[] = [];
    for (const group of parsed) {
      if (!isGroupItem(group)) continue;
      const category = group.category.trim();
      if (!category) continue;

      const linksRaw = (group.links ?? group.pages ?? []) as unknown[];
      for (const link of linksRaw) {
        if (typeof link === "string") {
          const url = normalizeUrl(link);
          if (!url) continue;
          out.push({ category, url });
          continue;
        }

        if (!link || typeof link !== "object") continue;
        const url = normalizeUrl((link as any).url);
        if (!url) continue;
        out.push({
          category,
          url,
          title: normalizeTitle((link as any).title),
        });
      }
    }
    return out;
  }

  // Old format:
  // [
  //   { "url": "...", "title": "...", "category": "..." }
  // ]
  const out: CategorizedLink[] = [];
  for (const p of parsed as any[]) {
    if (!p || typeof p !== "object") continue;
    const url = normalizeUrl(p.url);
    if (!url) continue;
    const title = normalizeTitle(p.title);

    const rawCats: unknown = p.categories ?? p.category;
    if (rawCats == null) {
      out.push({ category: "Uncategorized", url, title });
      continue;
    }

    if (typeof rawCats === "string") {
      const cat = rawCats.trim();
      out.push({ category: cat ? cat : "Uncategorized", url, title });
      continue;
    }

    if (Array.isArray(rawCats)) {
      const cats = rawCats.map((c) => normalizeUrl(c)).filter(Boolean);
      if (cats.length === 0) {
        out.push({ category: "Uncategorized", url, title });
      } else {
        for (const cat of cats) out.push({ category: cat, url, title });
      }
    }
  }

  return out;
}

