#!/usr/bin/env node

/**
 * Environment Verification Script for Okaeri Resort System
 *
 * This script verifies that Phase 0 cleanup is complete and the environment
 * is ready for Phase 1 TDD implementation. It checks documentation, test
 * infrastructure, security components, and build configuration.
 *
 * Usage:
 *   node scripts/verify-environment.js
 *   npm run verify:environment
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.join(__dirname, "..");

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.blue}═══ ${msg} ═══${colors.reset}\n`),
};

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = [];

/**
 * Check if a file or directory exists
 */
function checkExists(filepath, description) {
  totalChecks++;
  const fullPath = path.join(rootDir, filepath);
  if (fs.existsSync(fullPath)) {
    log.success(`${description}: ${filepath}`);
    passedChecks++;
    return true;
  } else {
    log.error(`${description} MISSING: ${filepath}`);
    failedChecks.push(`${description}: ${filepath}`);
    return false;
  }
}

/**
 * Check if a command executes successfully
 */
function checkCommand(command, description) {
  totalChecks++;
  try {
    execSync(command, { cwd: rootDir, stdio: "pipe" });
    log.success(description);
    passedChecks++;
    return true;
  } catch (error) {
    log.error(`${description} FAILED`);
    failedChecks.push(description);
    return false;
  }
}

/**
 * Check if a package is installed
 */
function checkPackage(packageName, isDev = false) {
  totalChecks++;
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
    const deps = isDev ? packageJson.devDependencies : packageJson.dependencies;

    if (deps && deps[packageName]) {
      log.success(`Package installed: ${packageName} (${deps[packageName]})`);
      passedChecks++;
      return true;
    } else {
      log.error(`Package MISSING: ${packageName}`);
      failedChecks.push(`Package: ${packageName}`);
      return false;
    }
  } catch (error) {
    log.error(`Failed to check package: ${packageName}`);
    failedChecks.push(`Package check: ${packageName}`);
    return false;
  }
}

/**
 * Main verification function
 */
async function verifyEnvironment() {
  console.log(`
${colors.cyan}╔═══════════════════════════════════════════════════╗
║     Okaeri Resort System Environment Verification  ║
║                  Phase 0 Completion Check           ║
╚═══════════════════════════════════════════════════╝${colors.reset}
`);

  log.section("Phase 0 Documentation");
  checkExists(
    "docs/implementation/phases/phase-0-cleanup/PHASE_0_COMPLETION_REPORT.md",
    "Completion Report"
  );
  checkExists("docs/implementation/phases/phase-0-cleanup/PHASE_0_PROGRESS.md", "Progress Tracker");
  checkExists("docs/implementation/phases/phase-0-cleanup/API_CONTRACTS.md", "API Contracts");
  checkExists(
    "docs/implementation/phases/phase-0-cleanup/PRESERVATION_REFERENCE.md",
    "Preservation Reference"
  );
  checkExists("docs/implementation/PHASE_1_HANDOFF.md", "Phase 1 Handoff");

  log.section("Preserved Infrastructure");
  checkExists("src/lib/security", "Security Infrastructure");
  checkExists("src/stores", "State Management (Zustand)");
  checkExists("src/lib/api-client.ts", "API Client");
  checkExists("src/lib/db", "Database Utilities");
  checkExists("src/types", "TypeScript Definitions");
  checkExists("src/services/mock", "Mock Services");

  log.section("Test Infrastructure");
  checkExists("src/test/helpers.tsx", "Test Helpers");
  checkExists("src/test/setup.ts", "Test Setup");
  checkExists("src/test/factories", "Test Factories");
  checkExists("src/features/auth/__tests__", "Auth Test Files");
  checkExists("vitest.config.ts", "Vitest Configuration");

  log.section("Authentication Components");
  checkExists("src/components/auth/LoginForm.tsx", "Login Form Component");
  checkExists("src/components/auth/RegistrationForm.tsx", "Registration Form Component");
  checkExists("src/components/ui", "shadcn/ui Components");

  log.section("Configuration Files");
  checkExists("tsconfig.json", "TypeScript Config");
  checkExists("tsconfig.app.json", "App TypeScript Config");
  checkExists("tailwind.config.ts", "Tailwind Config");
  checkExists("vite.config.ts", "Vite Config");
  checkExists(".env.test", "Test Environment Variables");

  log.section("Security Components");
  checkExists("src/lib/security/token-manager.ts", "Token Manager");
  checkExists("src/lib/security/secure-token-manager.ts", "Secure Token Manager");
  checkExists("src/lib/security/session-monitor.ts", "Session Monitor");
  checkExists("src/lib/security/permission-guard.ts", "Permission Guard");
  checkExists("src/lib/security/rate-limiter.ts", "Rate Limiter");
  checkExists("src/lib/security/audit-logger.ts", "Audit Logger");

  log.section("Core Dependencies");
  checkPackage("react");
  checkPackage("react-dom");
  checkPackage("zustand");
  checkPackage("@tanstack/react-query");
  checkPackage("@tanstack/react-router");
  checkPackage("react-hook-form");
  checkPackage("zod");

  log.section("Dev Dependencies");
  checkPackage("vitest", true);
  checkPackage("@testing-library/react", true);
  checkPackage("@testing-library/user-event", true);
  checkPackage("typescript", true);
  checkPackage("eslint", true);
  checkPackage("prettier", true);

  log.section("Build & Compilation");
  checkCommand("npm run type-check", "TypeScript Compilation");

  log.section("Git Repository");
  // Check if backup branch exists
  try {
    execSync("git rev-parse --verify backup/pre-phase0-cleanup-2025-09-01", {
      cwd: rootDir,
      stdio: "pipe",
    });
    log.success("Backup branch exists: backup/pre-phase0-cleanup-2025-09-01");
    passedChecks++;
    totalChecks++;
  } catch {
    log.warning("Backup branch not found (may be in remote only)");
  }

  // Final Report
  console.log(`
${colors.cyan}═══════════════════════════════════════════════════${colors.reset}
${colors.blue}                VERIFICATION SUMMARY               ${colors.reset}
${colors.cyan}═══════════════════════════════════════════════════${colors.reset}

Total Checks: ${totalChecks}
Passed: ${colors.green}${passedChecks}${colors.reset}
Failed: ${colors.red}${failedChecks.length}${colors.reset}
Success Rate: ${passedChecks === totalChecks ? colors.green : colors.yellow}${((passedChecks / totalChecks) * 100).toFixed(1)}%${colors.reset}
`);

  if (failedChecks.length > 0) {
    console.log(`${colors.red}Failed Checks:${colors.reset}`);
    failedChecks.forEach((check, index) => {
      console.log(`  ${index + 1}. ${check}`);
    });
    console.log("");
  }

  if (passedChecks === totalChecks) {
    console.log(`${colors.green}🎉 ENVIRONMENT VERIFICATION COMPLETE!${colors.reset}`);
    console.log(`${colors.green}✅ Phase 0 successfully completed${colors.reset}`);
    console.log(`${colors.green}✅ Ready for Phase 1 TDD Implementation${colors.reset}`);
    process.exit(0);
  } else if (passedChecks / totalChecks >= 0.9) {
    console.log(`${colors.yellow}⚠️  ENVIRONMENT MOSTLY READY${colors.reset}`);
    console.log(`${colors.yellow}Some non-critical items are missing.${colors.reset}`);
    console.log(
      `${colors.yellow}Review the failed checks and proceed with caution.${colors.reset}`
    );
    process.exit(0);
  } else {
    console.log(`${colors.red}❌ ENVIRONMENT NOT READY${colors.reset}`);
    console.log(`${colors.red}Critical infrastructure is missing.${colors.reset}`);
    console.log(`${colors.red}Please resolve the failed checks before proceeding.${colors.reset}`);
    process.exit(1);
  }
}

// Run verification
verifyEnvironment().catch((error) => {
  console.error(`${colors.red}Verification script failed:${colors.reset}`, error);
  process.exit(1);
});
