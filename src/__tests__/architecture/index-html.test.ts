// @vitest-environment node
/**
 * index.html and the manifest hold hand-synced hex copies of the background tokens
 * (DESIGN.md, Hand-synced hex copies). These fail when a copy drifts from src/index.css.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { formatHex } from "culori";
import { describe, expect, it } from "vitest";

import { resolveToken, themeTokens } from "@/test/design-tokens";

const root = path.resolve(__dirname, "../../..");
const indexHtml = readFileSync(path.join(root, "index.html"), "utf8");
const manifest = JSON.parse(readFileSync(path.join(root, "public/manifest.json"), "utf8"));

const background = {
  light: formatHex(resolveToken("background", themeTokens.light)),
  dark: formatHex(resolveToken("background", themeTokens.dark)),
};

function metaContent(name: string, media?: string): string[] {
  const metas = indexHtml.match(/<meta\b[^>]*>/g) ?? [];
  return metas
    .filter((meta) => meta.includes(`name="${name}"`))
    .filter((meta) => (media ? meta.includes(`media="${media}"`) : true))
    .map((meta) => /content="([^"]*)"/.exec(meta)?.[1] ?? "");
}

describe("index.html", () => {
  it("does not disable zoom", () => {
    const [viewport] = metaContent("viewport");
    expect(viewport).toBeDefined();
    expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)/);
    expect(viewport).not.toMatch(/maximum-scale\s*=\s*1(\.0*)?\b/);
  });

  it.each(["light", "dark"] as const)("theme-color for %s matches the background token", (mode) => {
    const colours = metaContent("theme-color", `(prefers-color-scheme: ${mode})`);
    expect(colours.map((colour) => colour.toLowerCase())).toEqual([background[mode]]);
  });

  it("has no theme-color without a colour-scheme media query", () => {
    const metas = (indexHtml.match(/<meta\b[^>]*name="theme-color"[^>]*>/g) ?? []).filter(
      (meta) => !meta.includes("media=")
    );
    expect(metas).toEqual([]);
  });
});

describe("manifest.json", () => {
  it("uses the light background for theme and background colour", () => {
    expect(manifest.theme_color.toLowerCase()).toBe(background.light);
    expect(manifest.background_color.toLowerCase()).toBe(background.light);
  });
});
