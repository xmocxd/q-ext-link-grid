/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",

  // Skip type-checking during `next build` (JS-only repo; avoids the full TS validation pass).
  typescript: {
    ignoreBuildErrors: true,
  },

  poweredByHeader: false,
};

export default nextConfig;
