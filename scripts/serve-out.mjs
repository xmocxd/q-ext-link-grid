/**
 * Serves `out/` like GitHub Pages project sites: URLs include /<repo>/ but files live at out/_next/, etc.
 * Plain `http-server out` maps /q-ext-link-grid/_next/... to out/q-ext-link-grid/_next/ (wrong).
 */
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { siteBasePath } from "../lib/siteBasePath.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "..", "out");
const PORT = Number.parseInt(process.env.PORT ?? "8080", 10);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] ?? "application/octet-stream";
}

function isInsideOutDir(resolved) {
  const rel = path.relative(outDir, resolved);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function badSegment(seg) {
  return seg === "" || seg === "." || seg === "..";
}

function resolvePathUnderOut(pathname) {
  if (!siteBasePath) {
    if (pathname === "/" || pathname === "") {
      return path.join(outDir, "index.html");
    }
    const segments = pathname.split("/").filter(Boolean);
    if (segments.some(badSegment)) return null;
    return path.join(outDir, ...segments);
  }

  if (pathname === siteBasePath || pathname === `${siteBasePath}/`) {
    return path.join(outDir, "index.html");
  }
  if (!pathname.startsWith(`${siteBasePath}/`)) {
    return null;
  }
  const tail = pathname.slice(siteBasePath.length + 1);
  const segments = tail.split("/").filter(Boolean);
  if (segments.some(badSegment)) return null;
  if (segments.length === 0) {
    return path.join(outDir, "index.html");
  }
  return path.join(outDir, ...segments);
}

const server = http.createServer(async (req, res) => {
  const host = req.headers.host ?? "localhost";
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? "/", `http://${host}`).pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }

  if (siteBasePath && (pathname === "/" || pathname === "")) {
    res.writeHead(302, { Location: `${siteBasePath}/` });
    res.end();
    return;
  }

  let filePath = resolvePathUnderOut(pathname);
  if (filePath === null) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(
      siteBasePath
        ? `Path must be under ${siteBasePath}/ (see lib/siteBasePath.js). Open ${siteBasePath}/ in the browser.`
        : "Not found",
    );
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const resolved = path.resolve(filePath);
  if (!isInsideOutDir(resolved)) {
    res.writeHead(403).end();
    return;
  }

  try {
    const body = await fs.readFile(resolved);
    const headers = {
      "Content-Type": mimeFor(resolved),
      "Cache-Control": "no-cache",
    };
    if (req.method === "HEAD") {
      res.writeHead(200, { ...headers, "Content-Length": body.length });
      res.end();
      return;
    }
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});

server.listen(PORT, () => {
  const base = siteBasePath || "/";
  console.log(`Serving ${outDir} at http://127.0.0.1:${PORT}${base}`);
  if (siteBasePath) {
    console.log(`Open http://127.0.0.1:${PORT}${siteBasePath}/ (same path shape as GitHub Pages)`);
  }
});
