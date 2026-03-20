"use client";

import { useCallback, useState } from "react";

import { siteBasePath } from "@/lib/siteBasePath";

/** Prefix root-relative public paths with `basePath` (GitHub Pages project sites). */
function withBasePath(path) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return path;
  return `${siteBasePath}${path}`;
}

function firstLetter(title) {
  const t = String(title ?? "").trim();
  if (!t) return "?";
  const ch = [...t][0];
  return ch.toLocaleUpperCase();
}

function contrastText(hex) {
  const h = String(hex ?? "").trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(h)) return "#ffffff";
  const r = Number.parseInt(h.slice(1, 3), 16) / 255;
  const g = Number.parseInt(h.slice(3, 5), 16) / 255;
  const b = Number.parseInt(h.slice(5, 7), 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.55 ? "#1f2937" : "#ffffff";
}

export function LinkIcon({ iconUrl, title, fallbackColor, useImage = true }) {
  const [broken, setBroken] = useState(false);
  const onError = useCallback(() => setBroken(true), []);
  const bg = /^#[0-9A-Fa-f]{6}$/.test(String(fallbackColor ?? "").trim())
    ? String(fallbackColor).trim()
    : "#6b7280";
  const letter = firstLetter(title);
  const color = contrastText(bg);
  const showFallback = useImage === false || !iconUrl || broken;

  if (showFallback) {
    return (
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold leading-none"
        style={{ backgroundColor: bg, color }}
        aria-hidden
      >
        {letter}
      </div>
    );
  }

  return (
    <img
      className="h-11 w-11 shrink-0 rounded-xl object-cover"
      src={withBasePath(iconUrl)}
      alt=""
      loading="lazy"
      onError={onError}
    />
  );
}
