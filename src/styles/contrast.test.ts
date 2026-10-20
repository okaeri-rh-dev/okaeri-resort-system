// @vitest-environment node
/**
 * WCAG 2.2 AA contrast for the semantic tokens in src/index.css, light and dark.
 * A new token joins the pair list in the same change.
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

// destructive doubles as form error text
const textOnSurfaces = ["foreground", "muted-foreground", "primary", "destructive"].flatMap(
  (text) => ["background", "card"].map((surface) => [text, surface, TEXT] as const)
);

// Calendar cells carry foreground text only
const availabilityPairs = ["high", "medium", "low"].map(
  (level) => ["foreground", `availability-${level}`, TEXT] as const
);

// Cabin chips: text on the chip fill and on a card (Pending chips are outlined on the card)
const unitLanePairs = [1, 2, 3].flatMap((lane) => [
  [`unit-lane-${lane}-foreground`, `unit-lane-${lane}`, TEXT] as const,
  [`unit-lane-${lane}-foreground`, "card", TEXT] as const,
  [`unit-lane-${lane}-accent`, "card", NON_TEXT] as const,
]);

const nonTextPairs = [
  ["input", "background", NON_TEXT],
  ["input", "card", NON_TEXT],
  ["ring", "background", NON_TEXT],
  ["ring", "card", NON_TEXT],
  ["sidebar-ring", "sidebar", NON_TEXT],
] as const;

const requiredPairs = [
  ...surfacePairs,
  ...textOnSurfaces,
  ...availabilityPairs,
  ...unitLanePairs,
  ...nonTextPairs,
];

describe.each(Object.entries(themeTokens))("%s theme contrast", (_theme, tokens) => {
  it.each(requiredPairs)("%s on %s is at least %s:1", (foreground, background, minimum) => {
    const ratio = wcagContrast(resolveToken(foreground, tokens), resolveToken(background, tokens));
    expect(ratio).toBeGreaterThanOrEqual(minimum);
  });
});
