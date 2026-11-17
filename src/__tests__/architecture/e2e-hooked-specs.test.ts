/**
 * scripts/e2e/run-hooked.sh names every spec it runs, so a spec missing from
 * it never runs in `npm run test:e2e:hooked` or the CI e2e job.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = join(__dirname, "..", "..", "..");
const hookedRunner = readFileSync(join(repoRoot, "scripts", "e2e", "run-hooked.sh"), "utf8");
const specs = readdirSync(join(repoRoot, "e2e")).filter((file) => file.endsWith(".spec.ts"));

describe("hooked E2E runner", () => {
  it.each(specs)("runs e2e/%s", (spec) => {
    expect(hookedRunner).toContain(`e2e/${spec}`);
  });
});
