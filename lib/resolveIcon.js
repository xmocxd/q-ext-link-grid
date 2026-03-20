import fs from "node:fs";
import path from "node:path";

const ICON_FALLBACK_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#e5e7eb"/>
  <path d="M20 24h24v4H20v-4Zm0 12h16v4H20v-4Z" fill="#6b7280"/>
</svg>`;

const ICON_FALLBACK_DATA_URI =
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(ICON_FALLBACK_SVG);

const CACHE_PATH = path.join(process.cwd(), ".cache", "link-grid-fetch.json");
const CACHE_DISABLED = process.env.LINK_GRID_FETCH_CACHE === "0";
const SKIP_FETCH = process.env.LINK_GRID_SKIP_FETCH === "1";

/** Default timeout per HTTP fetch (ms). Override with LINK_GRID_FETCH_TIMEOUT_MS. */
const FETCH_TIMEOUT_MS = Math.max(
  1000,
  Number.parseInt(process.env.LINK_GRID_FETCH_TIMEOUT_MS ?? "4000", 10) || 4000,
);

let cacheObject = null;
let cacheDirty = false;

function loadCache() {
  if (CACHE_DISABLED) return {};
  if (cacheObject !== null) return cacheObject;
  try {
    const raw = fs.readFileSync(CACHE_PATH, "utf8");
    cacheObject = JSON.parse(raw);
    if (!cacheObject || typeof cacheObject !== "object") cacheObject = {};
  } catch {
    cacheObject = {};
  }
  return cacheObject;
}

/**
 * Persist cache to disk (call once after all URLs resolved — e.g. end of resolveIcons).
 * Safe to call multiple times; only writes if entries changed.
 */
export function flushLinkGridFetchCache() {
  if (CACHE_DISABLED || !cacheDirty || !cacheObject) return;
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    const tmp = `${CACHE_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cacheObject), "utf8");
    fs.renameSync(tmp, CACHE_PATH);
    cacheDirty = false;
  } catch {
    // ignore disk errors (read-only CI, etc.)
  }
}

function getCached(urlKey) {
  const c = loadCache();
  const entry = c[urlKey];
  if (!entry || typeof entry !== "object") return null;
  return {
    iconUrl: String(entry.iconUrl),
    pageTitle: entry.pageTitle == null ? null : String(entry.pageTitle),
  };
}

function setCached(urlKey, result) {
  if (CACHE_DISABLED) return;
  const c = loadCache();
  c[urlKey] = {
    iconUrl: result.iconUrl,
    pageTitle: result.pageTitle,
  };
  cacheDirty = true;
}

function normalizeUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    if (!/^https?:\/\//i.test(trimmed)) return new URL(`https://${trimmed}`).toString();
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

/** Stable key for cache + deduping (same as normalized URL used for fetch). */
export function canonicalPageUrl(input) {
  return normalizeUrl(String(input ?? ""));
}

function truncate(s, maxLen) {
  if (s.length <= maxLen) return s;
  return s.slice(0, Math.max(0, maxLen - 1)) + "...";
}

function pickFirstMatch(html, regex) {
  const m = html.match(regex);
  return m?.[1] ?? null;
}

function resolveUrl(possibleHref, baseUrl) {
  try {
    return new URL(possibleHref, baseUrl).toString();
  } catch {
    return possibleHref;
  }
}

async function fetchPageHtml(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "link-grid-bot",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractOgImage(html, baseUrl) {
  const og = pickFirstMatch(
    html,
    /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
  );
  if (!og) return null;
  return resolveUrl(og, baseUrl);
}

function decodeHtmlEntities(input) {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_match, dec) => {
      const code = Number(dec);
      if (!Number.isFinite(code)) return _match;
      return String.fromCharCode(code);
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => {
      const code = Number.parseInt(hex, 16);
      if (!Number.isFinite(code)) return _match;
      return String.fromCharCode(code);
    });
}

function extractOgTitle(html) {
  const ogTitle =
    pickFirstMatch(
      html,
      /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    ) ??
    pickFirstMatch(
      html,
      /<meta[^>]+name=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    );

  if (!ogTitle) return null;
  const decoded = decodeHtmlEntities(ogTitle);
  const cleaned = decoded.replace(/\s+/g, " ").trim();
  return cleaned.length ? cleaned : null;
}

function extractPageTitle(html) {
  const title = pickFirstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) {
    const decoded = decodeHtmlEntities(title);
    const cleaned = decoded.replace(/\s+/g, " ").trim();
    return cleaned.length ? cleaned : null;
  }
  return extractOgTitle(html);
}

function extractFavicon(html, baseUrl) {
  const iconLinks = html.match(/<link\b[^>]*>/gi);
  if (!iconLinks) return null;

  for (const tag of iconLinks) {
    const rel = pickFirstMatch(tag, /rel=["']([^"']+)["']/i)?.toLowerCase() ?? "";
    const isFavicon =
      rel.includes("icon") || rel.includes("apple-touch-icon") || rel.includes("shortcut icon");
    if (!isFavicon) continue;

    const href = pickFirstMatch(tag, /href=["']([^"']+)["']/i);
    if (!href) continue;

    if (
      href.startsWith("data:") ||
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("/")
    ) {
      const resolved = resolveUrl(href, baseUrl);
      if (resolved && resolved.length > 0) return resolved;
    }
  }

  return null;
}

function resolveWithoutNetwork(url) {
  const base = (() => {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  })();
  const fallbackFavicon = base ? `${base.origin}/favicon.ico` : null;
  return {
    iconUrl: fallbackFavicon ?? ICON_FALLBACK_DATA_URI,
    pageTitle: null,
  };
}

async function resolveIconAndTitleForUrlUncached(url) {
  if (!url) {
    return { iconUrl: ICON_FALLBACK_DATA_URI, pageTitle: null };
  }

  const base = (() => {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  })();

  const fallbackFavicon = base ? `${base.origin}/favicon.ico` : null;

  const html = await fetchPageHtml(url);
  if (html) {
    const favicon = extractFavicon(html, url);
    const ogImage = extractOgImage(html, url);
    const pageTitle = extractPageTitle(html);

    return {
      iconUrl: favicon ?? ogImage ?? fallbackFavicon ?? ICON_FALLBACK_DATA_URI,
      pageTitle,
    };
  }

  return {
    iconUrl: fallbackFavicon ?? ICON_FALLBACK_DATA_URI,
    pageTitle: null,
  };
}

export async function resolveIconForUrl(inputUrl) {
  const url = normalizeUrl(inputUrl);
  if (!url) return ICON_FALLBACK_DATA_URI;

  const { iconUrl } = await resolveIconAndTitleForUrl(inputUrl);
  return iconUrl;
}

export async function resolveIconAndTitleForUrl(inputUrl) {
  const url = normalizeUrl(inputUrl);
  if (!url) {
    return { iconUrl: ICON_FALLBACK_DATA_URI, pageTitle: null };
  }

  if (SKIP_FETCH) {
    return resolveWithoutNetwork(url);
  }

  const cached = getCached(url);
  if (cached) return cached;

  const result = await resolveIconAndTitleForUrlUncached(url);
  setCached(url, result);
  return result;
}

export function displayTitleForUrl(url, title, pageTitle) {
  const t = title?.trim();
  if (t) return t;

  const pt = pageTitle?.trim();
  if (pt) return pt;

  return truncate(url, 44);
}
