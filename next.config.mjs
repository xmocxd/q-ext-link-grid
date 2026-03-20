/** @type {import('next').NextConfig} */

import { siteBasePath as basePath } from "./lib/siteBasePath.js";

// See lib/siteBasePath.js — use `""` there (and here via import) for a user site or apex custom domain.
// https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath

const nextConfig = {
  output: "export",
  ...(basePath ? { basePath } : {}),

  // Skip type-checking during `next build` (JS-only repo; avoids the full TS validation pass).
  typescript: {
    ignoreBuildErrors: true,
  },

  poweredByHeader: false,
};

export default nextConfig;
