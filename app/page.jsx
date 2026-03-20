import {
  canonicalPageUrl,
  displayTitleForUrl,
  flushLinkGridFetchCache,
  resolveIconAndTitleForUrl,
} from "@/lib/resolveIcon";
import { loadPagesJson } from "@/lib/loadPages";

// Next.js route segment config: force this page to be pre-rendered at build time as static HTML.
// That matches `output: "export"` in next.config.mjs — no per-request server rendering for `/`.
export const dynamic = "force-static";

const DEFAULT_CONCURRENCY = Math.max(
  1,
  Math.min(32, Number.parseInt(process.env.LINK_GRID_FETCH_CONCURRENCY ?? "12", 10) || 12),
);

/**
 * Resolve icon + title for each unique URL once, then map back to all rows (faster when the same
 * URL appears in multiple categories). Results are cached on disk under `.cache/link-grid-fetch.json`.
 */
async function resolveIcons(pages, concurrency = DEFAULT_CONCURRENCY) {
  const urlKeys = [];
  const seen = new Set();
  for (const p of pages) {
    const key = canonicalPageUrl(p.url) ?? p.url.trim();
    if (!seen.has(key)) {
      seen.add(key);
      urlKeys.push(key);
    }
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

  return pages.map((p) => {
    const key = canonicalPageUrl(p.url) ?? p.url.trim();
    const { iconUrl, pageTitle } = urlToResult.get(key) ?? {
      iconUrl: "",
      pageTitle: null,
    };
    return {
      url: p.url,
      title: displayTitleForUrl(p.url, p.title, pageTitle),
      iconUrl,
      category: p.category,
    };
  });
}

export default async function Home() {
  const pages = await loadPagesJson();
  const items = await resolveIcons(pages);

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
    <main className="min-h-screen px-6 pb-18 pt-12 text-gray-900 dark:bg-[#2F2F2F] bg-[#2F2F2F] dark:text-gray-100">
      <div className="space-y-6">
        {categoryOrder.map((category) => {
          const sectionItems = categoryToItems.get(category) ?? [];
          return (
            <section
              key={category}
              className="mx-auto max-w-[1100px]"
              aria-label={`Category: ${category}`}
            >
              <h2 className="mb-3 text-lg font-extrabold text-gray-900 dark:text-gray-100">
                {category}
              </h2>
              <div
                className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3.5 px-0.5 py-2"
                aria-label={`Links for ${category}`}
              >
                {sectionItems.map((item) => (
                  <a
                    key={`${category}::${item.url}`}
                    className="link-card-hover w-full justify-center items-center flex min-h-[108px] flex-col gap-2.5 rounded-2xl border-0 border-gray-200 p-2.5 transition-[transform,background-color,border-color] duration-150 ease-out hover:-translate-y-px hover:border-transparent hover:bg-gray-100 motion-reduce:hover:translate-y-0 dark:border-slate-700 dark:hover:bg-slate-800/90 justify-self-center self-center"
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.title}
                  >
                    <img
                      className="h-11 w-11 rounded-xl object-cover"
                      src={item.iconUrl}
                      alt=""
                      loading="lazy"
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
