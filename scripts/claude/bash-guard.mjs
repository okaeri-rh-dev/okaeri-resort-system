#!/usr/bin/env node
// PreToolUse(Bash): refuse commands that touch production or rewrite history.
// Exit 2 blocks the call and shows stderr to Claude. Hooks can only add refusals,
// never grant permissions, so a miss here falls back to the normal permission flow.
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const command = input.tool_input?.command ?? "";
const runInBackground = input.tool_input?.run_in_background === true;
const timeoutMs = Number(input.tool_input?.timeout ?? 0);

// Match only where a command starts (line start or after ; & |), so commit
// messages and echo text that mention these commands are not blocked.
const commandStart = String.raw`(?:^|[;&|]\s*)(?:npx\s+|sudo\s+)?`;
const startsWith = (pattern) => new RegExp(commandStart + pattern, "m");

const blocked = [
  [
    startsWith(String.raw`supabase\s+db\s+push\b`),
    "supabase db push applies migrations to the linked PRODUCTION project. Ask the user to run it.",
  ],
  [
    startsWith(String.raw`supabase\s+migration\s+repair\b`),
    "supabase migration repair rewrites production migration history. Ask the user.",
  ],
  [
    startsWith(String.raw`supabase\s+link\b`),
    "supabase link changes which project the CLI targets. Ask the user.",
  ],
  [
    startsWith(String.raw`supabase\s+secrets\s+set\b`),
    "supabase secrets set changes production secrets. Ask the user.",
  ],
  [
    startsWith(String.raw`supabase\s+db\s+reset\b.*--(linked|db-url)\b`),
    "supabase db reset against a remote database wipes it. Only plain local `supabase db reset` is allowed.",
  ],
  [
    startsWith(String.raw`wrangler\s+pages\s+deploy\b`),
    "Deploys go through CI (deploy needs the quality gate). Push to main instead.",
  ],
  [
    startsWith(String.raw`wrangler\s+(pages\s+)?secret\s+(put|delete|bulk)\b`),
    "Changing Cloudflare secrets affects production. Use the deploy-secrets skill and ask the user.",
  ],
  [
    startsWith(String.raw`npm\s+run\s+deploy`),
    "npm run deploy bypasses the CI quality gate. Push to main instead.",
  ],
  [
    startsWith(String.raw`git\s+push\b.*(\s--force\b|\s-f\b|--force-with-lease)`),
    "Force-push rewrites shared history. Ask the user.",
  ],
  [
    startsWith(String.raw`git\s+push\b.*(--no-verify|\s-n\b)`),
    "CLAUDE.md: never skip the pre-push hook without asking. Run `npm run verify` and ask the user.",
  ],
];

for (const [pattern, reason] of blocked) {
  if (pattern.test(command)) {
    console.error(`Blocked by scripts/claude/bash-guard.mjs: ${reason}`);
    process.exit(2);
  }
}

if (startsWith(String.raw`git\s+push\b`).test(command) && !runInBackground && timeoutMs < 600000) {
  console.error(
    "Blocked by scripts/claude/bash-guard.mjs: the pre-push hook takes minutes and is killed at the default timeout (exit 143), leaving the push incomplete. Re-run with run_in_background: true or timeout: 600000."
  );
  process.exit(2);
}

const safeRmTargets = [
  /^dist(\/|$)/,
  /^node_modules\/\.vite(\/|$)/,
  /^\.wrangler(\/|$)/,
  /^functions\/\.wrangler(\/|$)/,
  /^test-results(\/|$)/,
  /^playwright-report(\/|$)/,
  /^coverage(\/|$)/,
  /^(\/private)?\/tmp\/claude-/,
];

const rmRecursiveForce = new RegExp(
  commandStart +
    String.raw`rm\s+(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*)\s+([^;&|\n]+)`,
  "gm"
);
for (const match of command.matchAll(rmRecursiveForce)) {
  const targets = match[2]
    .trim()
    .split(/\s+/)
    .filter((token) => !token.startsWith("-"));
  const unsafe = targets.filter(
    (target) => !safeRmTargets.some((safe) => safe.test(target.replace(/^\.\//, "")))
  );
  if (unsafe.length > 0) {
    console.error(
      `Blocked by scripts/claude/bash-guard.mjs: rm -rf outside build output or the scratchpad (${unsafe.join(", ")}). Delete specific files, or ask the user.`
    );
    process.exit(2);
  }
}
