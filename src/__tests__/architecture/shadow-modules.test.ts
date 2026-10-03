/**
 * When both `X.tsx` and `X/index.tsx` exist, `import "./X"` resolves to the
 * file and the directory is dead. Edits made in the directory silently do
 * nothing: is_walk_in landed only in the dead BookingForm/ (996a60f) and the
 * live form broke until 5480e84.
 */

import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const srcRoot = join(__dirname, "..", "..");
const routesDir = join(srcRoot, "routes");

// Known pairs awaiting the dead-code cleanup (audit Decision 4). Remove an
// entry when its dead directory is deleted; never add one.
const knownShadowedDirs = ["components/bookings/BookingForm", "components/expenses/ExpenseEdit"];

function findShadowedDirs(dir: string): string[] {
  const shadowed: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "__tests__") continue;
    const childDir = join(dir, entry.name);
    // File-based routes: admin.tsx (layout) beside admin/index.tsx (index) is intended
    if (childDir === routesDir) continue;
    const hasIndex = ["index.ts", "index.tsx"].some((name) => existsSync(join(childDir, name)));
    const hasSiblingFile = [".ts", ".tsx"].some((ext) => existsSync(join(dir, entry.name + ext)));
    if (hasIndex && hasSiblingFile) shadowed.push(relative(srcRoot, childDir));
    shadowed.push(...findShadowedDirs(childDir));
  }
  return shadowed;
}

describe("shadow modules", () => {
  it("has no directory module hidden by a same-named file", () => {
    const unexpected = findShadowedDirs(srcRoot).filter((dir) => !knownShadowedDirs.includes(dir));

    expect(unexpected).toEqual([]);
  });

  it("keeps the known list accurate", () => {
    const stillShadowed = new Set(findShadowedDirs(srcRoot));

    expect(knownShadowedDirs.filter((dir) => !stillShadowed.has(dir))).toEqual([]);
  });
});
