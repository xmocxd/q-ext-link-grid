
## 1. What Next.js parts am I looking at?

### `app/page.tsx`
This file controls what shows on the `/` (home) page.

In this project, `app/page.tsx` is an **async server component**, meaning:

- It runs on the server during the build (not in the browser),
- so it can safely read files and fetch other websites to figure out icons.


### `lib/loadPages.ts`
This helper reads `data/pages.json` from disk and turns it into a clean JavaScript array.

### `lib/resolveIcon.ts`
This helper is responsible for the icon logic.


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

In the Next.js App Router, an Async Server Component is a [React Server Component (RSC)](https://react.dev/reference/rsc/server-components) that is declared as an async function. This allows you to use await directly inside the component body to fetch data or perform asynchronous operations before the component renders. [1, 2, 3, 4, 5] 
How it Works

* Server-Side Execution: The component runs [only on the server](https://tribhuvancode.medium.com/next-js-15-simplifying-server-data-fetching-with-async-server-components-13b76d258d90).
* Direct Data Fetching: You can query databases or call external APIs [directly within the component](https://nextjs.org/docs/app/getting-started/fetching-data).
* No Hooks Needed: Since it runs on the server, you don't use useEffect or useState for data fetching.
* Streaming & Suspense: While the server waits for an await to resolve, it can stream the rest of the page to the client. You can wrap these components in a Suspense boundary to show a [loading state](https://www.reddit.com/r/nextjs/comments/1b8ugxi/is_this_the_usual_way_to_deal_with_async_data_in/) while data is being fetched. [2, 3, 6, 7, 8, 9, 10, 11] 

Example
In this example, the page is an async function that waits for data before returning the JSX: [12, 13] 

```
// app/posts/page.jsexport default async function Page() {
  // Direct fetch call on the server
  const response = await fetch('https://api.example.com');
  const posts = await response.json();

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```


To set up an async server component, you just need to follow two main rules: use the App Router and add the async keyword to your function.
By default, every component in the app directory is a Server Component.
1. Basic Structure
Simply define your component as an async function. This allows you to use await directly in the body.
```
// app/profile/page.js
export default async function ProfilePage() {
  // You can fetch data directly here
  const res = await fetch('https://api.example.com');
  const user = await res.json();

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.bio}</p>
    </div>
  );
}
```
2. Key Rules to Remember

* No "use client": Do not add the "use client" directive at the top. If you do, it becomes a Client Component, and React does not currently support async functions for Client Components [5, 6].
* Server-Only Logic: Since this code only runs on the server, you can perform secure operations like calling a database (e.g., await db.query(...)) or using private API keys [4, 7].
* Handling "Wait" Times: Because the component is async, it will pause rendering until the await finishes. To prevent the whole page from feeling slow, wrap the component in a <Suspense> boundary in a parent file to show a loading spinner while it fetches [3, 8].

3. Using it in a Parent Component
If you want to use an async component inside another one:
```
// This component fetches its own dataasync function Weather() {
  const data = await fetchWeather(); 
  return <div>{data.temp}°C</div>;
}
export default function Dashboard() {
  return (
    <section>
      <h1>My Dashboard</h1>
      {/* Next.js handles the async resolution automatically */}
      <Weather /> 
    </section>
  );
}


```


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

