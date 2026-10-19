// @vitest-environment node
/**
 * WCAG 2.2 AA contrast for the semantic tokens in src/index.css, light and dark.
 * The pair list is from Semantic token architecture (#32); a new token joins it in the same change.
 */

import { wcagContrast } from "culori";
import { describe, expect, it } from "vitest";

import { resolveToken, themeTokens } from "@/test/design-tokens";

const TEXT = 4.5;
const NON_TEXT = 3;

const surfacePairs = [
  ["foreground", "background", TEXT] as const,
  ...[
    "card",
    "popover",
    "primary",
    "secondary",
    "muted",
    "accent",
    "destructive",
    "brand",
    "success",
    "warning",
    "info",
    "danger",
    "sidebar",
    "sidebar-primary",
    "sidebar-accent",
  ].map((surface) => [`${surface}-foreground`, surface, TEXT] as const),
];

const textSurfaces = [
  "background",
  "card",
  "availability-high",
  "availability-medium",
  "availability-low",
];
const textOnSurfaces = ["foreground", "muted-foreground", "primary"].flatMap((text) =>
  textSurfaces.map((surface) => [text, surface, TEXT] as const)
);

const nonTextPairs = [
  ["input", "background", NON_TEXT],
  ["input", "card", NON_TEXT],
  ["ring", "background", NON_TEXT],
  ["ring", "card", NON_TEXT],
  ["sidebar-ring", "sidebar", NON_TEXT],
] as const;

const requiredPairs = [...surfacePairs, ...textOnSurfaces, ...nonTextPairs];

describe.each(Object.entries(themeTokens))("%s theme contrast", (_theme, tokens) => {
  it.each(requiredPairs)("%s on %s is at least %s:1", (foreground, background, minimum) => {
    const ratio = wcagContrast(resolveToken(foreground, tokens), resolveToken(background, tokens));
    expect(ratio).toBeGreaterThanOrEqual(minimum);
  });
});
