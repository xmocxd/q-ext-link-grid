# Link Grid (Next.js) - For Dummies

This project is a tiny Next.js app that turns a local JSON file into a homepage full of clickable link "tiles" (an icon + a title).

If you are new to Next.js, think of it like this:

- You edit `data/pages.json` (your input data).
- When you run `next build`, the app reads that JSON.
- For each URL, it tries to find an icon (favicon first, then `og:image`).
- Then it renders a responsive grid on the home page.

---

## 1. What Next.js parts am I looking at?

### `app/page.tsx`
This file controls what shows on the `/` (home) page.

In this project, `app/page.tsx` is an **async server component**, meaning:

- It runs on the server during the build (not in the browser),
- so it can safely read files and fetch other websites to figure out icons.

### `data/pages.json`
This is your input file. Each item has:

- `category`: the name of the section
- `links`: a list of link objects inside that section
  - each link object has:
    - `url`: the website link
    - `title` (optional): the label you want to show
      - if you do not provide `title`, the app tries to read the linked page's `<title>` (or `og:title`)
      - if it cannot resolve a title, the app falls back to showing a truncated version of the `url`

If you want the same URL to appear in multiple sections, just repeat it in multiple `links` lists.

Example:

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

### `lib/loadPages.ts`
This helper reads `data/pages.json` from disk and turns it into a clean JavaScript array.

### `lib/resolveIcon.ts`
This helper is responsible for the icon logic.

For each `url`, it:

1. Downloads the HTML of that page (`fetch(url)`).
2. Tries to find a favicon link in the HTML (things like `rel="icon"`).
3. If that fails, it tries to find the Open Graph image (`<meta property="og:image" ...>`).
4. If everything fails, it uses a fallback placeholder image.

---

## 2. What happens when you build it?

Run:

```bash
npm run build
```

Important idea: **icon resolution and HTML parsing happen during build**.

So after `next build`, you get static output in the `out/` folder.

Then you can open `out/index.html` in a browser, or host the `out/` folder on any static host.

This is set up in `next.config.ts` using:

- `output: "export"`

---

## 3. What does the homepage render?

The home page is a grid of clickable cards.

Cards are separated into sections using your JSON groups: one section per `category` group name.

For each JSON entry you get a card with:

- an icon (favicon or `og:image`)
- a title
  - if `title` exists, it uses it
  - if `title` is missing, it tries the linked page's `<title>` (or `og:title`)
  - if it still can't resolve a title, it shows a truncated version of the `url`

It is implemented in `app/page.tsx`, and styled by `app/page.module.css`.

The grid is responsive using CSS Grid:

- `repeat(auto-fit, minmax(160px, 1fr))`

That means:

- on wide screens you see more columns
- on small screens the tiles wrap into fewer columns

---

## 4. Common gotchas (newbie-friendly)

### Icons might not always work
Some websites:

- block scraping,
- or do not provide `og:image`,
- or use weird markup for favicons.

That is why the icon resolver has fallbacks.

If you want icons to always be correct, you could add caching, a better favicon strategy, or a manual override field to the JSON later.

### Build time can be slower
Because it fetches each URL during `next build`, having many entries means it may take longer to build.

### You need to rebuild after editing JSON
Change `data/pages.json`, then run:

```bash
npm run build
```

so the static HTML gets regenerated.

---

## 5. Where should you start?

1. Edit `data/pages.json`
2. Run `npm run build`
3. Open `out/index.html`

If you tell me how you plan to deploy it (GitHub Pages, Netlify, plain static hosting, etc.), I can suggest the simplest “deploy” approach too.

---

## 6. Why does the app render as static HTML?

Because this project is built to pre-render the `/` page during `next build`, then save the result as plain static files (like `out/index.html`).

Three things work together:

1. `next.config.ts` uses `output: "export"`.
   - Next knows it should generate static files for deployment.
2. `app/page.tsx` declares `export const dynamic = "force-static"`.
   - Next treats the home page as static and precomputes it while building.
3. `app/page.tsx` is an async server component.
   - It reads `data/pages.json` and fetches the linked pages' HTML during the build.
   - So by the time the browser loads the site, it only receives the finished HTML/CSS markup.

---

## 7. Deploy on GitHub Pages

This project produces a fully static site in the `out/` folder after `npm run build`.
GitHub Pages can host static files as long as you publish the contents of `out/` to a branch/folder that Pages knows about.

### Option A (common): `gh-pages` branch (deploy from branch root)

1. Run a build locally:
   ```bash
   npm run build
   ```
   This creates `out/`.
2. Create (or reuse) a branch named `gh-pages`.
3. Replace the contents of that branch with the contents of `out/` (so `out/index.html` becomes the branch’s `index.html` at the root).
4. Push the `gh-pages` branch to GitHub.
5. In GitHub:
   - Go to your repository → `Settings` → `Pages`
   - Under “Build and deployment”, choose “Deploy from a branch”
   - Set “Branch” to `gh-pages` and “Folder” to `/ (root)`
   - Save

After a short delay, GitHub Pages will publish your site.

### Option B: publish into a folder on your main branch

If you don’t want a separate branch:
1. Run `npm run build` to generate `out/`
2. Copy `out/` into a folder like `docs/` in your repo
3. Configure GitHub Pages to use that folder (for example, branch `main` + folder `/docs`)

