import styles from "./page.module.css";
import { displayTitleForUrl, resolveIconAndTitleForUrl } from "@/lib/resolveIcon";
import { loadPagesJson } from "@/lib/loadPages";

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
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.h1}>Link Grid</h1>
        <p className={styles.sub}>
          Add entries to <code>data/pages.json</code> and rebuild.
        </p>
      </header>

      {categoryOrder.map((category) => {
        const sectionItems = categoryToItems.get(category) ?? [];
        return (
          <section key={category} className={styles.section} aria-label={`Category: ${category}`}>
            <h2 className={styles.sectionTitle}>{category}</h2>
            <div className={styles.grid} aria-label={`Links for ${category}`}>
              {sectionItems.map((item) => (
                <a
                  key={`${category}::${item.url}`}
                  className={styles.card}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.title}
                >
                  <img className={styles.icon} src={item.iconUrl} alt="" loading="lazy" />
                  <div className={styles.title}>{item.title}</div>
                </a>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
