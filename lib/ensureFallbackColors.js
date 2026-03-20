import fs from "node:fs/promises";
import path from "node:path";

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

function normalizeUrl(u) {
  return String(u ?? "").trim();
}

export function isValidFallbackColorHex(s) {
  return typeof s === "string" && HEX6.test(s.trim());
}

/** Pleasant saturated colors for avatar circles (deterministic randomness not required). */
export function generateFallbackColor() {
  const h = Math.random() * 360;
  const s = 55 + Math.random() * 20;
  const l = 42 + Math.random() * 16;
  return hslToHex(h, s, l);
}

function hslToHex(h, s, l) {
  const ss = s / 100;
  const ll = l / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toByte = (n) => Math.round(Math.min(255, Math.max(0, (n + m) * 255)));
  const hex = (n) => n.toString(16).padStart(2, "0");
  return `#${hex(toByte(r))}${hex(toByte(g))}${hex(toByte(b))}`;
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
 * Ensures every link in `data/pages.json` has a `fallbackColor` (#RRGGBB).
 * Preserves existing valid colors. Mutates the parsed structure in memory and
 * rewrites the file only when something changed.
 */
export async function ensureFallbackColorsInPagesJson(
  jsonPath = path.join(process.cwd(), "data", "pages.json"),
) {
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
          linksRaw[i] = {
            url: link.trim(),
            fallbackColor: generateFallbackColor(),
          };
          changed = true;
          continue;
        }

        if (!link || typeof link !== "object") continue;
        const url = normalizeUrl(link.url);
        if (!url) continue;

        if (isValidFallbackColorHex(link.fallbackColor)) continue;

        link.fallbackColor = generateFallbackColor();
        changed = true;
      }
    }
  } else {
    for (const p of parsed) {
      if (!p || typeof p !== "object") continue;
      if (!normalizeUrl(p.url)) continue;
      if (isValidFallbackColorHex(p.fallbackColor)) continue;
      p.fallbackColor = generateFallbackColor();
      changed = true;
    }
  }

  if (!changed) return;

  const out = `${JSON.stringify(parsed, null, 2)}\n`;
  const tmp = `${jsonPath}.${process.pid}.tmp`;
  await fs.writeFile(tmp, out, "utf8");
  await fs.rename(tmp, jsonPath);
}
