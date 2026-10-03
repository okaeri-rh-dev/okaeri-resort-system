/**
 * scripts/claude/bash-guard.mjs is the PreToolUse hook that refuses
 * production-touching shell commands. Exit 2 = blocked, 0 = allowed.
 */

import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const guard = join(__dirname, "..", "..", "..", "scripts", "claude", "bash-guard.mjs");

function decision(toolInput: { command: string; run_in_background?: boolean; timeout?: number }) {
  const result = spawnSync("node", [guard], { input: JSON.stringify({ tool_input: toolInput }) });
  return result.status === 2 ? "block" : "allow";
}

describe("bash guard hook", () => {
  it.each([
    "supabase db push",
    "cd /repo && npx supabase db push --dry-run",
    "echo hi; supabase migration repair --status applied 1",
    "supabase db reset --linked",
    "npx wrangler pages deploy dist",
    "npx wrangler pages secret put X --project-name okaeri-resort",
    "npm run deploy",
    "rm -rf src",
    "cd x && rm -rf ~",
  ])("blocks %s", (command) => {
    expect(decision({ command })).toBe("block");
  });

  it.each([
    'git commit -m "blocks supabase db push and git push --force"',
    'echo "probe: supabase db push"',
    "npx wrangler pages secret list --project-name okaeri-resort",
    "supabase db reset",
    "rm -rf dist coverage",
    "rm -r src/__probe",
  ])("allows %s", (command) => {
    expect(decision({ command })).toBe("allow");
  });

  it("blocks force and no-verify pushes even in the background", () => {
    expect(decision({ command: "git push --force origin main", run_in_background: true })).toBe(
      "block"
    );
    expect(decision({ command: "git push origin main --no-verify", run_in_background: true })).toBe(
      "block"
    );
  });

  it("requires git push to run in the background or with a long timeout", () => {
    expect(decision({ command: "git fetch && git push origin main" })).toBe("block");
    expect(decision({ command: "git push origin main", run_in_background: true })).toBe("allow");
    expect(decision({ command: "git push origin main", timeout: 600000 })).toBe("allow");
  });
});
