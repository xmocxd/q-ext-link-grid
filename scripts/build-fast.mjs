/**
 * Fast static build: skips per-URL HTTP fetches (LINK_GRID_SKIP_FETCH in lib/resolveIcon.js).
 * Usage: npm run build:fast
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.LINK_GRID_SKIP_FETCH = "1";

const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
if (!existsSync(nextCli)) {
  console.error("Next.js CLI not found. Run: npm install");
  process.exit(1);
}

const r = spawnSync(process.execPath, [nextCli, "build"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

process.exit(r.status ?? 1);
