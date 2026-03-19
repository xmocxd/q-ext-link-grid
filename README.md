This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

The app source is **JavaScript** (`app/*.jsx`, `lib/*.js`), not TypeScript.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

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
