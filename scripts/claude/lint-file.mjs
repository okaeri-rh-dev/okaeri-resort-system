#!/usr/bin/env node
// PostToolUse(Edit|Write): lint the file that was just edited so errors surface
// seconds after the edit. Exit 2 feeds the output back to Claude; warnings pass.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { relative } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const filePath = input.tool_input?.file_path ?? "";
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const relativePath = relative(projectDir, filePath);

const lintable = /\.(ts|tsx|js|mjs)$/.test(filePath) && !/\.phase3-4\./.test(filePath);
if (!lintable || relativePath.startsWith("..")) process.exit(0);

try {
  execFileSync(
    "npx",
    ["eslint", "--cache", "--cache-location", ".eslintcache", "--no-warn-ignored", relativePath],
    { cwd: projectDir, stdio: "pipe", encoding: "utf8" }
  );
} catch (error) {
  console.error(`ESLint errors in ${relativePath}:\n${error.stdout ?? ""}${error.stderr ?? ""}`);
  process.exit(2);
}
