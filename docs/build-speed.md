# Build speed (reference)

This note records **why `next build` was slow** and **what we changed** so you (or future you) can tune or extend it without rediscovering everything.

---

## 1. What actually takes time?

This app uses **static export** (`output: "export"` in `next.config.mjs`). During `next build`, Next pre-renders `/` as HTML.

The **slow part is usually not** compiling React or Tailwind. It is **network I/O** in `lib/resolveIcon.js`: for each **unique** link URL, the build may **HTTP-fetch** the target page to:

- pick a favicon (or fall back to `og:image`),
- read `<title>` / `og:title` when JSON has no `title`.

Many links, slow hosts, or long timeouts = a long build.

---

## 2. Optimizations in application code

### 2.1 Disk cache (repeat builds)

- **File:** `.cache/link-grid-fetch.json` (see `.gitignore` — not committed).
- **Behavior:** After a successful resolve for a normalized URL, `{ iconUrl, pageTitle }` is stored. The next `npm run build` **reuses** it and **skips** that HTTP request.
- **Flush:** `flushLinkGridFetchCache()` runs once after all URLs are resolved (see `app/page.jsx`).
- **Disable cache:** set `LINK_GRID_FETCH_CACHE=0` or delete the `.cache/` folder.
- **Refresh one URL:** remove that URL’s entry from the JSON file, or wipe `.cache/` for a full refetch.

### 2.2 Deduplicate URLs

If the same URL appears in **multiple categories**, `app/page.jsx` resolves it **once** and maps the result to every row. That cuts duplicate fetches.

### 2.3 Concurrency and timeouts

- **Concurrency:** default **12** parallel workers (was lower earlier). Override with `LINK_GRID_FETCH_CONCURRENCY` (clamped between 1 and 32).
- **Per-request timeout:** default **4000 ms**. Override with `LINK_GRID_FETCH_TIMEOUT_MS` (minimum 1000 ms enforced in code).

Higher concurrency can speed builds but may annoy rate-limited sites.

### 2.4 “Fast build” — skip all link HTTP

- **Env:** `LINK_GRID_SKIP_FETCH=1`
- **Script:** `npm run build:fast` runs `scripts/build-fast.mjs`, which sets that env and invokes the Next CLI directly (`node …/next/dist/bin/next build`) so it works without relying on `npx`/shell quirks (e.g. WSL).
- **Trade-off:** no HTML fetch — icons fall back to **origin `/favicon.ico`** (or placeholder); titles from the network are not used. Good when you only need a quick **`out/`** for layout or CI smoke tests.
- **Cache:** skip-fetch mode **does not read or write** the fetch cache (so it does not overwrite good cached data with shallow results).

---

## 3. Optimizations in Next.js config

### 3.1 TypeScript step during build

The repo is **JavaScript-only** (`*.jsx` / `*.js`), but Next can still run a TypeScript-related phase during build.

In `next.config.mjs`:

```js
typescript: {
  ignoreBuildErrors: true,
},
```

This makes the build **skip strict type validation** (you should see something like “Skipping validation of types” in the log). Lint is **not** configured here: Next 16 **does not** support an `eslint` block in `next.config` the same way older versions did; use `npm run lint` when you want ESLint.

### 3.2 What we did *not* disable

We still run a normal **production** compile (Turbopack in this Next version), Tailwind/PostCSS, and static generation. The goal was “fast enough” and **correct static output**, not stripping minification or removing the export pipeline.

---

## 4. Environment variables (cheat sheet)

| Variable | Effect |
|----------|--------|
| `LINK_GRID_SKIP_FETCH=1` | No HTTP per link; fastest build; weaker icons/titles. |
| `LINK_GRID_FETCH_CACHE=0` | Disable read/write of `.cache/link-grid-fetch.json`. |
| `LINK_GRID_FETCH_CONCURRENCY` | Parallel fetch workers (1–32, default 12). |
| `LINK_GRID_FETCH_TIMEOUT_MS` | Per-URL fetch timeout (ms, default 4000). |

---

## 5. WSL vs Windows `node_modules`

If the repo lives on **`/mnt/c/...`** and you run Node in **WSL**, install dependencies **inside WSL** (`rm -rf node_modules && npm install` there). Mixing a Windows `node_modules` with Linux Node can break native addons (this project uses Tailwind v3 to avoid LightningCSS issues from Tailwind v4 on mixed setups).

**Timing builds in WSL:**

```bash
cd /mnt/c/Users/YOU/git/q-ext-link-grid
/usr/bin/time -f 'elapsed %e s' npm run build:fast
/usr/bin/time -f 'elapsed %e s' npm run build
```

---

## 6. Files to read when changing this behavior

| Area | File(s) |
|------|---------|
| Fetch + cache + env | `lib/resolveIcon.js` |
| Dedupe + parallel resolve + flush | `app/page.jsx` |
| Fast build entrypoint | `scripts/build-fast.mjs` |
| Next build behavior | `next.config.mjs` |
| npm scripts | `package.json` |

---

## 7. When to use which command

| Goal | Command |
|------|---------|
| Normal static site with real icons/titles | `npm run build` (second run faster if `.cache/` exists) |
| Fastest possible `out/` for smoke test / layout | `npm run build:fast` |
| Force refetch everything | Delete `.cache/` then `npm run build` |

---

*Last aligned with the repo’s `resolveIcon.js`, `page.jsx`, `next.config.mjs`, and `scripts/build-fast.mjs`.*
