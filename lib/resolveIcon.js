const ICON_FALLBACK_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#e5e7eb"/>
  <path d="M20 24h24v4H20v-4Zm0 12h16v4H20v-4Z" fill="#6b7280"/>
</svg>`;

const ICON_FALLBACK_DATA_URI =
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(ICON_FALLBACK_SVG);

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

async function fetchPageHtml(url, timeoutMs = 6000) {
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

export async function resolveIconForUrl(inputUrl) {
  const url = normalizeUrl(inputUrl);
  if (!url) return ICON_FALLBACK_DATA_URI;

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
    if (favicon) return favicon;

    const ogImage = extractOgImage(html, url);
    if (ogImage) return ogImage;
  }

  if (fallbackFavicon) return fallbackFavicon;

  return ICON_FALLBACK_DATA_URI;
}

export async function resolveIconAndTitleForUrl(inputUrl) {
  const url = normalizeUrl(inputUrl);
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

export function displayTitleForUrl(url, title, pageTitle) {
  const t = title?.trim();
  if (t) return t;

  const pt = pageTitle?.trim();
  if (pt) return pt;

  return truncate(url, 44);
}
