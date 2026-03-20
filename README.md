This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

The app source is **JavaScript** (`app/*.jsx`, `lib/*.js`), not TypeScript.

Styling uses **Tailwind CSS v3** with PostCSS (`tailwindcss` + `autoprefixer` in `postcss.config.mjs`). This avoids native `lightningcss` bindings that can break when `node_modules` is on a Windows drive but you run `next build` inside **WSL** — if you still see platform errors, run `rm -rf node_modules && npm install` in the same environment you use to build.

## Getting Started

This app uses a **GitHub Pages–style base path** (`lib/siteBasePath.js`). Pick one:

**Static preview (matches production `out/`):**

```bash
npm run dev
```

This runs `next build` then `scripts/serve-out.mjs` on port **8080**. Open **`http://127.0.0.1:8080/q-ext-link-grid/`** — not the site root alone, or assets 404 (see `docs/github-pages.md`).

**Hot reload (Next dev server):**

```bash
npm run dev:next
```

Open **`http://localhost:3000/q-ext-link-grid/`**.

This homepage is driven by `data/pages.json`.

Each entry should look like:

```json
[
  {
    "category": "Tools",
    "links": [
      { "url": "https://example.com", "title": "Example" },
      { "url": "https://no-title.example.com" }
    ]
  },
  {
    "category": "Docs",
    "links": [{ "url": "https://another.com", "title": "Another" }]
  }
]
```

If `title` is missing, the UI falls back to a truncated version of the `url`.
If the app can read the linked page's title (from the HTML `<title>` or `og:title`), it uses that instead. If that also fails, it falls back to truncated `url`.
During build, the icon for each link is resolved by trying the page favicon first, then falling back to `og:image`.

After changing `data/pages.json`, rebuild:

```bash
npm run build
```

On a **full** build (not `build:fast` with fetch skipped), if a link has **no `title`** in JSON but a title is **read from the page** (`<title>` / `og:title`), that string is **written back** into `data/pages.json` so the next build can skip fetching it for title only.

To **strip generated fields** from `data/pages.json` and keep only `url`, `title`, and `useImage` per link (and `category` per group), run manually:

```bash
npm run purge
```

This does **not** run on build.

**Fastest build (no link HTTP):** `npm run build:fast` sets `LINK_GRID_SKIP_FETCH=1` so icons/titles skip network (guessed favicons only). Use when you only need a working `out/` quickly.

**`next build` is lighter:** TypeScript validation during the build is **skipped** (`typescript.ignoreBuildErrors` in `next.config.mjs`). ESLint is not part of `next build` in Next 16 — run `npm run lint` when you want it.

**Faster rebuilds with network:** later `npm run build` runs reuse `.cache/link-grid-fetch.json` (gitignored). Delete `.cache/` or set `LINK_GRID_FETCH_CACHE=0` to refetch. Tune with `LINK_GRID_FETCH_CONCURRENCY`, `LINK_GRID_FETCH_TIMEOUT_MS`.

**Time the build in WSL** (use a Linux `node_modules` if the project lives under `/mnt/c/...`):

```bash
cd /mnt/c/Users/YOU/git/q-ext-link-grid   # adjust path
rm -rf node_modules && npm install        # once, inside WSL
/usr/bin/time -f 'elapsed %e s' npm run build:fast
/usr/bin/time -f 'elapsed %e s' npm run build
```

The generated static site will be in `out/` (open `out/index.html` or host `out/` on a static server).

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Beginner Docs

See `docs/for-dummies-nextjs-link-grid.md` for a step-by-step explanation.

## Build performance (reference)

See `docs/build-speed.md` for what makes `next build` slow or fast (caches, `build:fast`, env vars, WSL notes).

## GitHub Pages

See `docs/github-pages.md` for **basePath**, **`.nojekyll`** (Jekyll vs `_next`), subtree deploy, and local testing under a repo subpath.
