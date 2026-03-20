# GitHub Pages deployment (reference)

This note documents **why** static export initially broke on GitHub Pages and **what** we changed so the site (CSS, JS, fonts, and local icons) loads correctly when served from a **project** URL like `https://<user>.github.io/<repo>/`.

The app uses **Next.js static export** (`output: "export"` in `next.config.mjs`). The build output lives in **`out/`**, which is what you publish to the **`gh-pages`** branch.

---

## 1. Two separate problems (symptoms looked similar)

| Symptom | Root cause |
|--------|------------|
| Requests went to `https://<user>.github.io/_next/...` (missing `/<repo>`) | **Subpath hosting** — HTML used root-absolute URLs. |
| Requests went to `https://<user>.github.io/<repo>/_next/...` but still **404** | **Jekyll** on GitHub Pages **omitted** the `_next` folder. |

You may fix one and still see failures until both are addressed.

---

## 2. Project sites vs root sites

GitHub Pages has two common URL shapes:

- **Project site:** `https://<user>.github.io/<repository-name>/`  
  Everything under that repo’s Pages build is served **under** `/<repository-name>/`.

- **User/org site:** `https://<user>.github.io/` from a repo named `<user>.github.io`  
  The site is served from the **domain root** (no extra path segment).

- **Custom domain at apex** (e.g. `https://example.com/`): also behaves like a **root** site for path purposes.

Next’s default static HTML uses **root-absolute** asset URLs: `/_next/static/...`, `/favicon.ico`, etc. That is correct only when the site is served at **`/`**. On a **project** site, the browser resolves `/_next/...` against the **host**, not the repo folder, so it requests the wrong URL and assets **404**.

---

## 3. Fix A — `basePath` (Next.js)

### 3.1 What we did

- **`lib/siteBasePath.js`** exports a single string, e.g. `"/q-ext-link-grid"`, which must match the **repository name** segment in the GitHub Pages URL (leading slash, no trailing slash).
- **`next.config.mjs`** imports that value and sets Next’s **`basePath`** when it is non-empty. That prefixes **framework** assets: `/_next/static/...`, scripts, preloads, and metadata URLs that Next controls.

Official reference: [basePath](https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath).

### 3.2 When to use `""`

Set **`siteBasePath`** in `lib/siteBasePath.js` to **`""`** (and keep `next.config.mjs` importing it) if you deploy only to:

- a **user/org** GitHub Pages site at the domain root, or  
- a **custom domain** where the app is served at `/`.

Then Next omits `basePath` from the config object entirely (`...(basePath ? { basePath } : {})`).

### 3.3 Public files in `pages.json` (`/link-icons/...`)

JSON and build logic still store **root-absolute** paths such as `/link-icons/<hash>.ico`. Those strings are **not** rewritten by `basePath` automatically when passed to a plain `<img src={...} />`.

**`app/components/LinkIcon.jsx`** imports **`siteBasePath`** and prefixes **only** same-origin style paths: strings starting with `/` that are not protocol-relative (`//`). External `https://...` URLs are unchanged.

If you add other raw `/...` public URLs in the UI later, apply the same rule or use Next’s asset patterns so they respect the subpath.

---

## 4. Fix B — `.nojekyll` (GitHub Pages + Jekyll)

### 4.1 What went wrong

GitHub Pages runs **Jekyll** on published branches **by default**. Jekyll **ignores** files and directories whose names start with **`_`** (with limited exceptions). Next’s build output includes a directory named **`_next`**, so Jekyll **did not publish** it. The HTML requested the right URLs after `basePath` was added, but the server had **no files** at those paths → **404** for every CSS, JS, and font chunk.

### 4.2 What we did

- Added **`public/.nojekyll`** (empty file). Next copies everything under `public/` into the root of **`out/`**, so the published site includes **`out/.nojekyll`**.
- That file tells GitHub Pages to **disable Jekyll** for the site so **`_next`** is deployed and served like any other folder.

After each `next build`, confirm **`out/.nojekyll`** exists next to **`out/_next/`** before you deploy.

---

## 5. Deploy workflow (example)

This project does **not** automate GitHub Actions here; a typical flow is:

1. **`npm run build`** — produces a fresh **`out/`** tree (including **`.nojekyll`** and **`_next/`**).
2. Push **`out/`** to the remote branch GitHub Pages uses (often **`gh-pages`**), e.g.:

   ```bash
   git subtree push --prefix out origin gh-pages
   ```

3. In the GitHub repo → **Settings → Pages**, ensure the source is the branch you pushed (e.g. **`gh-pages`**) and the folder is **root** (`/`).

**Important:** If you deploy an **`out/`** built **before** `.nojekyll` or **before** `basePath` was set, the live site will stay broken until you rebuild and redeploy.

---

## 6. Local verification

### 6.1 Mirror the real URL path

With a non-empty `siteBasePath`, do **not** expect `http://localhost:8080/` alone to load assets correctly if you only map the static root to **`out/`**. Open the app at the **subpath**, e.g.:

`http://localhost:8080/q-ext-link-grid/`

(Adjust host/port to match `http-server` or another static server.)

### 6.2 Quick production checks

After deploy:

- **`https://<user>.github.io/<repo>/.nojekyll`** — should return an empty response (proves Jekyll is off).
- **`https://<user>.github.io/<repo>/_next/static/chunks/<some>.css`** — should return **200** (not 404).

---

## 7. File checklist

| File | Role |
|------|------|
| `lib/siteBasePath.js` | Single source of truth for the repo path segment; must match GitHub repo name for project Pages. |
| `next.config.mjs` | Imports `siteBasePath` and applies `basePath`. |
| `app/components/LinkIcon.jsx` | Prefixes root-relative icon URLs with `siteBasePath`. |
| `public/.nojekyll` | Copied to `out/.nojekyll` so GitHub Pages serves `_next/`. |

---

## 8. Further reading

- [Next.js: Static exports](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)  
- [GitHub Pages: Using a static site generator](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)  
- Common static hosting gotcha: [Files that start with an underscore are missing](https://github.blog/2009-12-29-bypassing-jekyll-on-github-pages/) (`.nojekyll` bypass)
