#!/usr/bin/env node
// Stop: lint and type-check what changed on this branch before Claude reports done.
// Blocks once per distinct working-tree state, so an unfixable failure cannot loop:
// if nothing changed since the last block, the stop is let through.
import { execFileSync, execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const git = (args) => execSync(`git ${args}`, { cwd: projectDir, encoding: "utf8" }).trim();

let base = "HEAD";
for (const ref of ["origin/main", "main"]) {
  try {
    base = git(`merge-base ${ref} HEAD`);
    break;
  } catch {
    // try the next ref
  }
}

const changed = [
  ...git(`diff --name-only --diff-filter=ACMR ${base}`).split("\n"),
  ...git("ls-files --others --exclude-standard").split("\n"),
]
  .filter((file) => /\.(ts|tsx|js|mjs)$/.test(file) && !/\.phase3-4\./.test(file))
  .filter((file, index, all) => all.indexOf(file) === index && existsSync(join(projectDir, file)));

if (changed.length === 0) process.exit(0);

const run = (command, args) => {
  try {
    execFileSync(command, args, { cwd: projectDir, stdio: "pipe", encoding: "utf8" });
    return "";
  } catch (error) {
    return `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
};

const failures = [
  run("npx", [
    "eslint",
    "--cache",
    "--cache-location",
    ".eslintcache",
    "--no-warn-ignored",
    ...changed,
  ]),
  run("npx", [
    "tsc",
    "--noEmit",
    "--incremental",
    "--tsBuildInfoFile",
    "node_modules/.cache/tsc-stop-hook.tsbuildinfo",
  ]),
  run("npx", ["tsc", "--noEmit", "--incremental", "-p", "functions/tsconfig.json"]),
]
  .filter(Boolean)
  .join("\n");

if (!failures) process.exit(0);

const treeHash = createHash("sha256");
for (const file of changed) treeHash.update(file).update(readFileSync(join(projectDir, file)));
const currentHash = treeHash.digest("hex");
const marker = join(tmpdir(), `okaeri-stop-check-${input.session_id ?? "nosession"}`);

if (existsSync(marker) && readFileSync(marker, "utf8") === currentHash) process.exit(0);
writeFileSync(marker, currentHash);

console.error(
  `Lint/type errors in files changed on this branch. Fix them before finishing:\n${failures.split("\n").slice(-40).join("\n")}`
);
process.exit(2);
