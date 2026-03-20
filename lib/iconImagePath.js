import fs from "node:fs";
import path from "node:path";

const LINK_ICONS_PREFIX = "/link-icons/";

/** Max icon file size when downloading (bytes). */
export const MAX_ICON_BYTES = 2 * 1024 * 1024;

/**
 * True if `s` is a safe public URL path under `/link-icons/` (no traversal).
 */
export function isPublicLinkIconPath(s) {
  if (typeof s !== "string") return false;
  const t = s.trim();
  if (!t.startsWith(LINK_ICONS_PREFIX)) return false;
  const rest = t.slice(LINK_ICONS_PREFIX.length);
  if (!rest || rest.includes("..") || rest.includes("/") || rest.includes("\\")) return false;
  if (!/^[a-zA-Z0-9._-]+$/.test(rest)) return false;
  return true;
}

export function publicFilePathForLinkIcon(cwd, webPath) {
  if (!isPublicLinkIconPath(webPath)) return null;
  const relFromPublic = webPath.replace(/^\//, "");
  const full = path.resolve(path.join(cwd, "public", relFromPublic));
  const iconsDir = path.resolve(path.join(cwd, "public", "link-icons"));
  const rel = path.relative(iconsDir, full);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return full;
}

export function linkIconFileExists(cwd, webPath) {
  const fp = publicFilePathForLinkIcon(cwd, webPath);
  if (!fp) return false;
  try {
    return fs.statSync(fp).isFile();
  } catch {
    return false;
  }
}
