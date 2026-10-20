import { readFileSync } from "node:fs";
import path from "node:path";

import { interpolate, parse, type Color } from "culori";

export type ThemeTokens = Map<string, string>;

const stylesheet = readFileSync(path.resolve(__dirname, "../index.css"), "utf8");

function tokenBlock(selector: string): ThemeTokens {
  const escaped = selector.replace(".", "\\.");
  const block = new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, "m").exec(stylesheet);
  if (!block) throw new Error(`No top-level ${selector} block in src/index.css`);
  const declarations = block[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g);
  return new Map([...declarations].map(([, name, value]) => [name, value.trim()]));
}

const lightTokens = tokenBlock(":root");

/** The semantic tokens of src/index.css per theme; dark falls back to :root like the cascade. */
export const themeTokens = {
  light: lightTokens,
  dark: new Map([...lightTokens, ...tokenBlock(".dark")]),
};

function resolveColor(value: string, tokens: ThemeTokens): Color {
  const reference = /^var\(--([\w-]+)\)$/.exec(value);
  if (reference) return resolveToken(reference[1], tokens);

  const mix = /^color-mix\(in oklch,\s*(.+?)\s+(\d+(?:\.\d+)?)%,\s*(.+)\)$/.exec(value);
  if (mix) {
    const [, first, firstPercent, second] = mix;
    const towardFirst = interpolate(
      [resolveColor(second, tokens), resolveColor(first, tokens)],
      "oklch"
    );
    return towardFirst(Number(firstPercent) / 100);
  }

  const color = parse(value);
  if (!color) throw new Error(`Can't parse colour "${value}"`);
  return color;
}

export function resolveToken(name: string, tokens: ThemeTokens): Color {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`--${name} is not defined`);
  return resolveColor(value, tokens);
}
