import { displayTitleForUrl, resolveIconAndTitleForUrl } from "@/lib/resolveIcon";
import { loadPagesJson } from "@/lib/loadPages";

// Next.js route segment config: force this page to be pre-rendered at build time as static HTML.
// That matches `output: "export"` in next.config.mjs — no per-request server rendering for `/`.
export const dynamic = "force-static";

async function resolveIcons(pages, concurrency = 5) {
  const out = [];
  let index = 0;

  async function worker() {
    while (index < pages.length) {
      const currentIndex = index++;
      const p = pages[currentIndex];
      const { iconUrl, pageTitle } = await resolveIconAndTitleForUrl(p.url);
      out[currentIndex] = {
        url: p.url,
        title: displayTitleForUrl(p.url, p.title, pageTitle),
        iconUrl,
        category: p.category,
      };
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return out;
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
    <main className="min-h-screen bg-zinc-50 px-6 pb-18 pt-12 text-gray-900 dark:bg-[#0b0f19] dark:text-gray-100">
      <header className="mx-auto mb-6 max-w-[1100px] rounded-2xl border border-gray-200 bg-white p-[18px] dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-[28px] font-bold tracking-tight">Link Grid</h1>
        <p className="mt-2 text-sm leading-snug text-gray-500 dark:text-gray-400">
          Add entries to{" "}
          <code className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[13px] text-gray-800 dark:bg-slate-800 dark:text-gray-200">
            data/pages.json
          </code>{" "}
          and rebuild.
        </p>
      </header>

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
                    className="link-card-hover flex min-h-[108px] flex-col items-start gap-2.5 rounded-2xl border border-gray-200 bg-white p-3.5 transition-[transform,background-color,border-color] duration-150 ease-out hover:-translate-y-px hover:border-transparent hover:bg-gray-100 motion-reduce:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/90"
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
                    <div className="line-clamp-2 text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100">
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
