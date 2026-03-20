import { LinkIcon } from "@/app/components/LinkIcon";
import { ensureFallbackColorsInPagesJson } from "@/lib/ensureFallbackColors";
import { ensureLocalIconImagesInPagesJson } from "@/lib/ensureLocalIconImages";
import { linkIconFileExists, isPublicLinkIconPath } from "@/lib/iconImagePath";
import { loadPagesJson } from "@/lib/loadPages";
import { persistFetchedTitlesInPagesJson } from "@/lib/persistFetchedTitlesInPagesJson";
import {
  canonicalPageUrl,
  displayTitleForUrl,
  flushLinkGridFetchCache,
  resolveIconAndTitleForUrl,
} from "@/lib/resolveIcon";

// Next.js route segment config: force this page to be pre-rendered at build time as static HTML.
// That matches `output: "export"` in next.config.mjs — no per-request server rendering for `/`.
export const dynamic = "force-static";

const DEFAULT_CONCURRENCY = Math.max(
  1,
  Math.min(32, Number.parseInt(process.env.LINK_GRID_FETCH_CONCURRENCY ?? "12", 10) || 12),
);

function hasValidLocalIconRow(p, cwd) {
  if (p.useImage === false) return true;
  const w = p.iconImagePath?.trim();
  if (!w || !isPublicLinkIconPath(w)) return false;
  return linkIconFileExists(cwd, w);
}

function pageNeedsNetworkForUrl(pages, urlKey, cwd) {
  return pages.some((p) => {
    const k = canonicalPageUrl(p.url) ?? p.url.trim();
    if (k !== urlKey) return false;
    const needsTitle = !String(p.title ?? "").trim();
    const needsRemoteIconMeta = p.useImage !== false && !hasValidLocalIconRow(p, cwd);
    return needsTitle || needsRemoteIconMeta;
  });
}

/**
 * Resolve icon + title for each unique URL once, then map back to all rows (faster when the same
 * URL appears in multiple categories). Results are cached on disk under `.cache/link-grid-fetch.json`.
 * Skips network entirely for a URL when every row has a local `iconImagePath` on disk and an
 * explicit JSON title (so titles are not re-fetched).
 */
async function resolveIcons(pages, concurrency = DEFAULT_CONCURRENCY) {
  const cwd = process.cwd();
  const urlKeys = [];
  const seen = new Set();
  for (const p of pages) {
    const key = canonicalPageUrl(p.url) ?? p.url.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (pageNeedsNetworkForUrl(pages, key, cwd)) urlKeys.push(key);
  }

  const urlToResult = new Map();
  let index = 0;

  async function worker() {
    while (index < urlKeys.length) {
      const currentIndex = index++;
      const urlKey = urlKeys[currentIndex];
      const result = await resolveIconAndTitleForUrl(urlKey);
      urlToResult.set(urlKey, result);
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  flushLinkGridFetchCache();

  const items = pages.map((p) => {
    const key = canonicalPageUrl(p.url) ?? p.url.trim();
    const { iconUrl: fetchedIcon, pageTitle } = urlToResult.get(key) ?? {
      iconUrl: "",
      pageTitle: null,
    };
    const localIcon =
      p.useImage !== false && p.iconImagePath?.trim() && isPublicLinkIconPath(p.iconImagePath.trim())
        ? p.iconImagePath.trim()
        : null;
    const iconUrl =
      p.useImage === false
        ? null
        : (fetchedIcon && String(fetchedIcon).trim()) || localIcon || null;

    return {
      url: p.url,
      title: displayTitleForUrl(p.url, p.title, pageTitle),
      iconUrl,
      category: p.category,
      fallbackColor: p.fallbackColor,
      useImage: p.useImage !== false,
    };
  });

  return { items, urlToResult };
}

export default async function Home() {
  await ensureFallbackColorsInPagesJson();
  await ensureLocalIconImagesInPagesJson();
  const pages = await loadPagesJson();
  const { items, urlToResult } = await resolveIcons(pages);
  await persistFetchedTitlesInPagesJson(urlToResult);

  const categoryOrder = [];
  const categoryToItems = new Map();
  for (const item of items) {
    const category = item.category;
    if (!categoryToItems.has(category)) {
      categoryToItems.set(category, []);
      categoryOrder.push(category);
    }
    categoryToItems.get(category).push(item);
  }

  return (
    <main className="flex flex-col justify-center min-h-screen px-6 pb-18 pt-12 text-gray-900 dark:bg-[#2F2F2F] bg-[#2F2F2F] dark:text-gray-100 ">
      <div className="space-y-6">
        {categoryOrder.map((category) => {
          const sectionItems = categoryToItems.get(category) ?? [];
          return (
            <section
              key={category}
              className="mx-auto max-w-[1100px]"
              aria-label={`Category: ${category}`}
            >
              <h2 className="text-center mb-3 text-lg font-extrabold text-gray-900 dark:text-gray-500">
                {category}
              </h2>
              <div
                className="flex gap-3.5 px-0.5 py-2 justify-center flex-wrap"
                aria-label={`Links for ${category}`}
              >
                {sectionItems.map((item) => (
                  <a
                    key={`${category}::${item.url}`}
                    className="link-card-hover w-36 justify-center items-center flex min-h-[120px] flex-col gap-2.5 rounded-2xl border-0 p-2.5 transition-[background-color] duration-150 ease-out hover:bg-gray-100 dark:hover:bg-zinc-700/90 justify-self-center self-center no-underline"
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.title}
                  >
                    <LinkIcon
                      iconUrl={item.iconUrl}
                      title={item.title}
                      fallbackColor={item.fallbackColor}
                      useImage={item.useImage}
                    />
                    <div className="line-clamp-2 text-sm text-center font-semibold leading-tight text-gray-900 dark:text-gray-100">
                      {item.title}
                    </div>
                  </a>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
