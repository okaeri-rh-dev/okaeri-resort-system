# JWT Security Scripts Documentation

## Overview

This document specifies the JWT security scripts that must be added to
`package.json` to enforce the memory-only JWT storage strategy and validate
security compliance across different environments.

**Owner**: security-compliance-auditor  
**Status**: Required Security Implementation  
**Last Updated**: September 1, 2025  
**Priority**: CRITICAL - CI/CD Security Gates

## Environment-Aware Security Enforcement

The security scripts adapt their behavior based on the environment:

| Environment | localStorage | sessionStorage   | Cookies      | Memory-Only |
| ----------- | ------------ | ---------------- | ------------ | ----------- |
| Production  | ❌ Forbidden | ❌ Forbidden     | ❌ Forbidden | ✅ Required |
| Test/CI     | ❌ Forbidden | ❌ Forbidden     | ❌ Forbidden | ✅ Required |
| Development | ❌ Forbidden | ⚠️ Conditional\* | ❌ Forbidden | ✅ Default  |

\*sessionStorage allowed ONLY for mock tokens when `VITE_MOCK_AUTH=true` and
properly gated with `isDevelopmentMockAuth()`

## Required Scripts for package.json

Add the following scripts to the `scripts` section of `package.json`:

```json
{
  "scripts": {
    // JWT-specific security scripts
    "verify:jwt": "tsx scripts/security/verify-jwt-storage.ts",
    "audit:jwt:storage": "tsx scripts/security/audit-jwt-storage.ts",
    "audit:jwt:transmission": "tsx scripts/security/audit-jwt-transmission.ts",
    "audit:jwt:cookies": "tsx scripts/security/audit-jwt-cookies.ts",
    "audit:jwt:production": "NODE_ENV=production tsx scripts/security/audit-jwt-production.ts",
    "security:jwt:full": "npm run verify:jwt && npm run audit:jwt:storage && npm run audit:jwt:transmission && npm run audit:jwt:cookies",

    // JWT testing scripts
    "test:security:jwt": "vitest run src/__tests__/security/jwt.security.test.ts",
    "test:security:jwt:coverage": "vitest run --coverage src/__tests__/security/jwt.security.test.ts",
    "test:security:jwt:watch": "vitest watch src/__tests__/security/jwt.security.test.ts",

    // Integration with existing security scripts
    "security:audit:all": "npm run security:jwt:full && npm run security:headers && npm run security:csp",
    "verify:security:enhanced": "npm run verify:security && npm run security:jwt:full",

    // Pre-commit hooks
    "pre-commit:jwt": "npm run audit:jwt:cookies && npm run audit:jwt:storage",
    "pre-push:jwt": "npm run security:jwt:full && npm run test:security:jwt"
  }
}
```

## Script Implementations

### 1. verify:jwt (scripts/security/verify-jwt-storage.ts)

**Purpose**: Comprehensive verification of JWT storage implementation with
environment awareness

```typescript
#!/usr/bin/env tsx

import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";

interface Violation {
  file: string;
  line: number;
  pattern: string;
  severity: "error" | "warning";
  message: string;
}

// Environment detection
const isDevelopment =
  process.env.NODE_ENV === "development" || process.env.NODE_ENV === undefined;
const isProduction = process.env.NODE_ENV === "production";
const isMockAuthEnabled = process.env.VITE_MOCK_AUTH === "true";

// Check if code is properly gated
function isProperlyGated(content: string, lineIndex: number): boolean {
  const lines = content.split("\n");
  const contextStart = Math.max(0, lineIndex - 10);
  const contextLines = lines.slice(contextStart, lineIndex + 1).join("\n");

  return (
    /isDevelopmentMockAuth\(\)/.test(contextLines) ||
    /VITE_MOCK_AUTH.*===.*['"]true['"]/.test(contextLines)
  );
}

const PROHIBITED_PATTERNS = [
  {
    pattern: /localStorage\.(?:set|get)Item\(['"].*(?:token|jwt|auth)/gi,
    message:
      "JWT storage in localStorage is prohibited - use memory-only storage",
    severity: "error" as const,
    allEnvironments: true,
  },
  {
    pattern: /document\.cookie\s*=.*(?:token|jwt|auth)/gi,
    message: "JWT storage in cookies is prohibited",
    severity: "error" as const,
    allEnvironments: true,
  },
  {
    pattern:
      /sessionStorage\.(?:set|get)Item\(['"](?!mock_).*(?:token|jwt|auth)/gi,
    message: "Real JWT storage in sessionStorage is prohibited",
    severity: "error" as const,
    allEnvironments: true,
  },
  {
    pattern: /sessionStorage\.setItem\(['"]mock_/gi,
    message:
      "Mock token storage must be properly gated with isDevelopmentMockAuth()",
    severity: "warning" as const,
    checkGating: true,
    skipInDev: false,
  },
  {
    pattern: /credentials:\s*['"]include['"]/gi,
    message: "credentials: include is prohibited with JWT",
    severity: "error" as const,
    allEnvironments: true,
  },
  {
    pattern: /withCredentials:\s*true/gi,
    message: "withCredentials is prohibited with JWT",
    severity: "error" as const,
    allEnvironments: true,
  },
];

const REQUIRED_PATTERNS = [
  {
    pattern: /SecureTokenManager|TokenManager/,
    message: "JWT must be managed via SecureTokenManager or TokenManager class",
    fileTypes: ["auth", "token", "security"],
  },
  {
    pattern: /Authorization.*Bearer/,
    message: "JWT must be transmitted via Authorization header",
    fileTypes: ["api", "client", "fetch"],
  },
];

async function scanFile(filePath: string): Promise<Violation[]> {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const violations: Violation[] = [];

  // Check for prohibited patterns
  PROHIBITED_PATTERNS.forEach(
    ({
      pattern,
      message,
      severity,
      checkGating,
      allEnvironments,
      skipInDev,
    }) => {
      // Skip development-specific checks in production mode
      if (isProduction && skipInDev) return;

      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          // If gating check is required, verify proper gating
          if (checkGating) {
            if (!isProperlyGated(content, index)) {
              violations.push({
                file: filePath,
                line: index + 1,
                pattern: pattern.source,
                severity,
                message: message + " (missing isDevelopmentMockAuth() check)",
              });
            }
          } else {
            violations.push({
              file: filePath,
              line: index + 1,
              pattern: pattern.source,
              severity,
              message,
            });
          }
        }
      });
    }
  );

  // Check for required patterns (context-aware)
  const fileName = path.basename(filePath).toLowerCase();
  REQUIRED_PATTERNS.forEach(({ pattern, message, fileTypes }) => {
    if (fileTypes.some((type) => fileName.includes(type))) {
      if (!content.match(pattern)) {
        violations.push({
          file: filePath,
          line: 0,
          pattern: pattern.source,
          severity: "warning",
          message: `Missing required pattern: ${message}`,
        });
      }
    }
  });

  return violations;
}

async function main() {
  console.log("🔍 Verifying JWT Storage Implementation...");
  console.log(
    `   Environment: ${isProduction ? "PRODUCTION" : isDevelopment ? "DEVELOPMENT" : "TEST"}`
  );
  console.log(`   Mock Auth: ${isMockAuthEnabled ? "ENABLED" : "DISABLED"}\n`);

  const sourceFiles = await glob("src/**/*.{ts,tsx,js,jsx}", {
    ignore: ["**/node_modules/**", "**/*.test.*", "**/*.spec.*"],
  });

  const apiFiles = await glob("api/**/*.{ts,js}", {
    ignore: ["**/node_modules/**", "**/*.test.*"],
  });

  const allFiles = [...sourceFiles, ...apiFiles];
  const allViolations: Violation[] = [];

  for (const file of allFiles) {
    const violations = await scanFile(file);
    allViolations.push(...violations);
  }

  // Report results
  const errors = allViolations.filter((v) => v.severity === "error");
  const warnings = allViolations.filter((v) => v.severity === "warning");

  if (errors.length > 0) {
    console.error("❌ JWT Security Violations Found:\n");
    errors.forEach((v) => {
      console.error(`  ${v.file}:${v.line}`);
      console.error(`    ${v.message}`);
      console.error(`    Pattern: ${v.pattern}\n`);
    });
  }

  if (warnings.length > 0) {
    console.warn("⚠️  JWT Implementation Warnings:\n");
    warnings.forEach((v) => {
      console.warn(`  ${v.file}:${v.line || "N/A"}`);
      console.warn(`    ${v.message}\n`);
    });
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log("✅ JWT storage implementation verified successfully");
    console.log("  ✓ Memory-only storage enforced");
    console.log("  ✓ No localStorage usage for tokens");
    console.log("  ✓ sessionStorage properly gated for mock tokens");
    console.log("  ✓ No cookie storage detected");
    console.log("  ✓ Authorization header usage verified");
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch(console.error);
```

### 2. audit:jwt:storage (scripts/security/audit-jwt-storage.ts)

**Purpose**: Audit storage usage patterns with environment awareness

```typescript
#!/usr/bin/env tsx

import * as fs from "fs";
import { glob } from "glob";

interface StorageAudit {
  totalFiles: number;
  filesWithStorage: number;
  storagePatterns: Map<string, number>;
  violations: string[];
}

// Development mode mock tokens are allowed with proper gating
const VALID_MOCK_STORAGE_KEYS = ["mock_access_token", "mock_refresh_token"];

// Check for proper environment gating
function isProperlyGated(code: string, lineIndex: number): boolean {
  const lines = code.split("\n");
  const startIndex = Math.max(0, lineIndex - 10);
  const checkLines = lines.slice(startIndex, lineIndex + 1).join("\n");
  return (
    /isDevelopmentMockAuth\(\)/.test(checkLines) ||
    /VITE_MOCK_AUTH/.test(checkLines)
  );
}

async function auditStorageUsage(): Promise<StorageAudit> {
  const files = await glob("src/**/*.{ts,tsx,js,jsx}", {
    ignore: ["**/node_modules/**", "**/*.test.*"],
  });

  const audit: StorageAudit = {
    totalFiles: files.length,
    filesWithStorage: 0,
    storagePatterns: new Map(),
    violations: [],
  };

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");

    // Check for localStorage usage (always prohibited for tokens)
    if (content.includes("localStorage")) {
      const localStorageMatches = content.matchAll(
        /localStorage\.[gs]etItem\(['"]([^'"]+)['"]/g
      );
      for (const match of localStorageMatches) {
        const key = match[1];
        if (
          key.includes("token") ||
          key.includes("jwt") ||
          key.includes("auth")
        ) {
          audit.violations.push(
            `${file}: localStorage usage for tokens is prohibited - use memory-only storage`
          );
        }
      }
    }

    // Check for sessionStorage usage (must be properly gated for mock tokens)
    if (content.includes("sessionStorage")) {
      audit.filesWithStorage++;

      lines.forEach((line, index) => {
        if (/sessionStorage\.[gs]etItem/.test(line)) {
          const keyMatch = line.match(
            /sessionStorage\.[gs]etItem\(['"]([^'"]+)['"]/
          );
          if (keyMatch) {
            const key = keyMatch[1];
            audit.storagePatterns.set(
              key,
              (audit.storagePatterns.get(key) || 0) + 1
            );

            // Check if it's token-related
            if (
              key.includes("token") ||
              key.includes("jwt") ||
              key.includes("auth")
            ) {
              // Must be a mock token
              if (!key.startsWith("mock_")) {
                audit.violations.push(
                  `${file}:${index + 1}: Non-mock token '${key}' in sessionStorage`
                );
              }
              // Must be properly gated
              else if (!isProperlyGated(content, index)) {
                audit.violations.push(
                  `${file}:${index + 1}: Mock token storage not properly gated with isDevelopmentMockAuth()`
                );
              }
            }
          }
        }
      });
    }
  }

  return audit;
}

async function main() {
  console.log("📊 Auditing JWT Storage Patterns...\n");

  const audit = await auditStorageUsage();

  console.log(`Files scanned: ${audit.totalFiles}`);
  console.log(`Files using sessionStorage: ${audit.filesWithStorage}`);
  console.log("\nStorage Keys Found:");

  audit.storagePatterns.forEach((count, key) => {
    const isMockKey = VALID_MOCK_STORAGE_KEYS.includes(key);
    const isTokenRelated =
      key.includes("token") || key.includes("jwt") || key.includes("auth");
    let marker = "  ";

    if (isTokenRelated) {
      if (isMockKey) {
        marker = "✅"; // Valid mock token key
      } else if (key.startsWith("mock_")) {
        marker = "⚠️"; // Unknown mock key
      } else {
        marker = "❌"; // Invalid: real token in storage
      }
    }

    console.log(`  ${marker} ${key}: ${count} usage(s)`);
  });

  if (audit.violations.length > 0) {
    console.error("\n❌ Storage Violations:");
    audit.violations.forEach((v) => console.error(`  ${v}`));
    process.exit(1);
  } else {
    console.log("\n✅ JWT storage audit passed");
    console.log("  ✓ No localStorage usage for tokens");
    console.log("  ✓ sessionStorage properly gated for mock tokens only");
    console.log("  ✓ Memory-only storage enforced");
  }
}

main().catch(console.error);
```

### 3. audit:jwt:production (scripts/security/audit-jwt-production.ts)

**Purpose**: Strict production-only audit that fails on ANY Web Storage usage

```typescript
#!/usr/bin/env tsx

import * as fs from "fs";
import { glob } from "glob";

interface ProductionViolation {
  file: string;
  line: number;
  type: "localStorage" | "sessionStorage" | "cookie";
  message: string;
}

async function auditProduction(): Promise<ProductionViolation[]> {
  console.log("🔒 Running PRODUCTION JWT Security Audit (Strict Mode)...\n");

  const files = await glob("src/**/*.{ts,tsx,js,jsx}", {
    ignore: [
      "**/node_modules/**",
      "**/*.test.*",
      "**/*.spec.*",
      "**/test-utils.*",
    ],
  });

  const violations: ProductionViolation[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      // ANY localStorage usage with tokens
      if (/localStorage\.[gs]etItem.*(?:token|jwt|auth)/i.test(line)) {
        violations.push({
          file,
          line: index + 1,
          type: "localStorage",
          message: "localStorage is FORBIDDEN for JWT storage in production",
        });
      }

      // ANY sessionStorage usage with tokens (even mock)
      if (/sessionStorage\.[gs]etItem.*(?:token|jwt|auth)/i.test(line)) {
        violations.push({
          file,
          line: index + 1,
          type: "sessionStorage",
          message: "sessionStorage is FORBIDDEN for JWT storage in production",
        });
      }

      // ANY cookie usage with tokens
      if (/document\.cookie.*(?:token|jwt|auth)/i.test(line)) {
        violations.push({
          file,
          line: index + 1,
          type: "cookie",
          message: "Cookies are FORBIDDEN for JWT storage",
        });
      }
    });
  }

  return violations;
}

async function main() {
  const violations = await auditProduction();

  if (violations.length > 0) {
    console.error("❌ PRODUCTION SECURITY VIOLATIONS DETECTED!\n");
    console.error("The following code will FAIL in production:\n");

    violations.forEach((v) => {
      console.error(`  ${v.file}:${v.line}`);
      console.error(`    Type: ${v.type.toUpperCase()}`);
      console.error(`    ${v.message}\n`);
    });

    console.error(
      "🚨 Production deployment will be BLOCKED until these are fixed."
    );
    console.error("\nRequired fixes:");
    console.error("  1. Remove ALL localStorage usage for tokens");
    console.error("  2. Remove ALL sessionStorage usage for tokens");
    console.error("  3. Use SecureTokenManager for memory-only storage");
    console.error(
      "  4. Ensure isDevelopmentMockAuth() gates are production-safe"
    );

    process.exit(1);
  } else {
    console.log("✅ Production JWT security audit PASSED");
    console.log("  ✓ No Web Storage API usage for tokens");
    console.log("  ✓ Memory-only storage enforced");
    console.log("  ✓ Ready for production deployment");
  }
}

main().catch(console.error);
```

## Integration with CI/CD

### GitHub Actions Workflow

```yaml
# .github/workflows/jwt-security.yml
name: JWT Security Audit

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  jwt-security-dev:
    runs-on: ubuntu-latest
    name: JWT Security (Development)

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20.x"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run JWT Security Audit (Dev Mode)
        env:
          NODE_ENV: development
          VITE_MOCK_AUTH: true
        run: npm run security:jwt:full

      - name: Run JWT Security Tests
        run: npm run test:security:jwt:coverage

  jwt-security-prod:
    runs-on: ubuntu-latest
    name: JWT Security (Production)

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20.x"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run Production JWT Audit (Strict)
        env:
          NODE_ENV: production
        run: npm run audit:jwt:production

      - name: Verify No Web Storage Usage
        run: |
          if grep -r "localStorage.*token\|sessionStorage.*token" src/ --include="*.ts" --include="*.tsx"; then
            echo "❌ Web Storage usage detected in production code!"
            exit 1
          fi
          echo "✅ No Web Storage usage found"

      - name: Upload Audit Report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: jwt-security-audit
          path: |
            jwt-audit-report.json
            coverage/
```

### Pre-commit Hook

```bash
#!/bin/sh
# .husky/pre-commit

# Detect environment
if [ "$NODE_ENV" = "production" ]; then
  echo "🔒 Running production JWT security checks..."
  npm run audit:jwt:production
else
  echo "🔍 Running development JWT security checks..."
  npm run audit:jwt:storage
fi

if [ $? -ne 0 ]; then
  echo "❌ JWT security violations detected. Commit blocked."
  echo "💡 Tip: Use SecureTokenManager for all token operations"
  exit 1
fi

echo "✅ JWT security checks passed"
```

## Troubleshooting

### Common Issues and Solutions

#### Issue: False positives in test files

```typescript
// Add to ignore patterns in audit scripts
const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/*.test.*",
  "**/*.spec.*",
  "**/test-utils.*",
  "**/__tests__/**",
  "**/mocks/**",
];
```

#### Issue: Legacy code using localStorage

```typescript
// Migration helper script
async function migrateLegacyStorage() {
  // 1. Find all localStorage usage
  const violations = await findLocalStorageUsage();

  // 2. Generate migration patches
  for (const violation of violations) {
    console.log(`Migrate ${violation.file}:`);
    console.log(`  - Remove: localStorage.setItem('${violation.key}', token)`);
    console.log(`  + Add: tokenManager.storeTokens(token)`);
  }
}
```

## Related Documentation

- [JWT_SECURITY_TEST_SPECIFICATION.md](./JWT_SECURITY_TEST_SPECIFICATION.md)
- [JWT_STORAGE_IMPLEMENTATION_GUIDE.md](./JWT_STORAGE_IMPLEMENTATION_GUIDE.md)
- [JWT_TESTING_PATTERNS.md](./JWT_TESTING_PATTERNS.md)
- [MEMORY_ONLY_JWT_STORAGE_UPDATE.md](./MEMORY_ONLY_JWT_STORAGE_UPDATE.md)
- [SECURITY_VERIFICATION_SCRIPTS.md](../implementation/SECURITY_VERIFICATION_SCRIPTS.md)

---

_Document Owner: security-compliance-auditor_  
_Classification: Security Critical_  
_Script Language: TypeScript (tsx)_  
_Last Updated: September 1, 2025_
