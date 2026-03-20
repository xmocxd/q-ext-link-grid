import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { MAX_ICON_BYTES, isPublicLinkIconPath, linkIconFileExists } from "./iconImagePath.js";
import {
  canonicalPageUrl,
  flushLinkGridFetchCache,
  resolveIconAndTitleForUrl,
} from "./resolveIcon.js";

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

const EXT_BY_TYPE = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/svg+xml": "svg",
};

function extFromContentType(ct) {
  if (!ct || typeof ct !== "string") return null;
  const base = ct.split(";")[0].trim().toLowerCase();
  return EXT_BY_TYPE[base] ?? null;
}

function extFromIconUrl(iconUrl) {
  try {
    const u = new URL(iconUrl);
    const base = path.basename(u.pathname).toLowerCase();
    const m = base.match(/\.(png|jpe?g|gif|webp|ico|svg)$/);
    return m ? m[1].replace("jpeg", "jpg") : null;
  } catch {
    return null;
  }
}

async function downloadIconToBuffer(iconUrl, timeoutMs) {
  if (!iconUrl || iconUrl.startsWith("data:")) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(iconUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "link-grid-bot" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type");
    const ab = await res.arrayBuffer();
    if (ab.byteLength === 0 || ab.byteLength > MAX_ICON_BYTES) return null;
    const ext = extFromContentType(ct) ?? extFromIconUrl(iconUrl) ?? "png";
    return { buffer: Buffer.from(ab), ext };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function collectLinkObjects(parsed) {
  const out = [];
  if (!Array.isArray(parsed)) return out;

  const hasAnyGroups = parsed.some((x) => isGroupItem(x));
  if (hasAnyGroups) {
    for (const group of parsed) {
      if (!isGroupItem(group)) continue;
      const linksRaw = group.links ?? group.pages;
      if (!Array.isArray(linksRaw)) continue;
      for (const link of linksRaw) {
        if (!link || typeof link !== "object") continue;
        if (!normalizeUrl(link.url)) continue;
        out.push(link);
      }
    }
    return out;
  }

  for (const p of parsed) {
    if (!p || typeof p !== "object") continue;
    if (!normalizeUrl(p.url)) continue;
    out.push(p);
  }
  return out;
}

/**
 * Download icon binaries into `public/link-icons/` and set `iconImagePath` on each link.
 * Skips links with `useImage: false`. Reuses an existing file when `iconImagePath` is valid
 * or when another entry for the same canonical URL already has a saved file.
 */
export async function ensureLocalIconImagesInPagesJson(
  jsonPath = path.join(process.cwd(), "data", "pages.json"),
  cwd = process.cwd(),
) {
  const FETCH_TIMEOUT_MS = Math.max(
    1000,
    Number.parseInt(process.env.LINK_GRID_FETCH_TIMEOUT_MS ?? "4000", 10) || 4000,
  );

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

  const links = collectLinkObjects(parsed);

  /** @type {Map<string, object[]>} */
  const byUrl = new Map();
  for (const link of links) {
    const key = canonicalPageUrl(link.url) ?? normalizeUrl(link.url);
    if (!key) continue;
    if (!byUrl.has(key)) byUrl.set(key, []);
    byUrl.get(key).push(link);
  }

  const dir = path.join(cwd, "public", "link-icons");
  await fs.mkdir(dir, { recursive: true });

  let changed = false;

  for (const [urlKey, group] of byUrl) {
    const active = group.filter((l) => l.useImage !== false);
    if (active.length === 0) continue;

    let chosenPath = null;
    for (const l of active) {
      const p = l.iconImagePath;
      if (typeof p === "string" && isPublicLinkIconPath(p) && linkIconFileExists(cwd, p)) {
        chosenPath = p.trim();
        break;
      }
    }

    if (chosenPath) {
      for (const l of active) {
        const cur = typeof l.iconImagePath === "string" ? l.iconImagePath.trim() : "";
        if (cur !== chosenPath) {
          l.iconImagePath = chosenPath;
          changed = true;
        }
      }
      continue;
    }

    const { iconUrl } = await resolveIconAndTitleForUrl(urlKey);
    if (!iconUrl) continue;

    const downloaded = await downloadIconToBuffer(iconUrl, FETCH_TIMEOUT_MS);
    if (!downloaded) continue;

    const hash = crypto.createHash("sha256").update(urlKey).digest("hex").slice(0, 16);
    const filename = `${hash}.${downloaded.ext}`;
    const absFile = path.join(dir, filename);
    const webPath = `/link-icons/${filename}`;

    await fs.writeFile(absFile, downloaded.buffer);

    for (const l of active) {
      l.iconImagePath = webPath;
      changed = true;
    }
  }

  if (changed) {
    const out = `${JSON.stringify(parsed, null, 2)}\n`;
    const tmp = `${jsonPath}.${process.pid}.tmp`;
    await fs.writeFile(tmp, out, "utf8");
    await fs.rename(tmp, jsonPath);
  }

  flushLinkGridFetchCache();
}
