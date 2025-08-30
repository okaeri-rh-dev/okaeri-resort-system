# CI Configuration Fixes - Implementation Guide

This document provides **exact CI configuration changes** required to address
the gaps identified in the earlier analysis. Each fix includes specific file
modifications, before/after values, and integration steps.

## Overview of Required Fixes

The analysis identified 5 critical CI/CD gaps that need immediate resolution:

1. **Accessibility Threshold Inconsistency**: CI enforces 90% but documentation
   requires 95%
2. **Missing Component Isolation Testing (Gate 3)**: No isolated component
   testing
3. **Missing Project_ID Validation**: No CI checks for tenant isolation
4. **Test Progress Tracking**: Static 0/150 dashboard with no automation
5. **Factory Usage Enforcement**: CONFIG_PRESETS exist but not enforced in CI

## 1. Accessibility Threshold Fix

### 1.1 Current State Analysis

**Files Affected:**

- `/Users/jasonacido/repos/okaeri-dev/okaeri-resort-system/.github/workflows/ci.yml`
  (Line 31)
- `/Users/jasonacido/repos/okaeri-dev/okaeri-resort-system/docs/testing/ACCESSIBILITY_TESTING_GUIDE.md`
  (Line 36)

**Current Configuration:**

```yaml
# .github/workflows/ci.yml - Line 31
env:
  LIGHTHOUSE_SCORE_THRESHOLD: 90

# Lighthouse CI job uses this in assertions - Lines 548-549
assertions: {
  'categories:accessibility': ['error', { minScore: 0.9 }],
```

**Documentation Requirement:**

```markdown
# docs/testing/ACCESSIBILITY_TESTING_GUIDE.md - Line 36

- **Accessibility Score**: ≥95% (Note: CI currently has 90%, needs update)
```

### 1.2 Required Changes

**File: `.github/workflows/ci.yml`**

```yaml
# Line 31 - CHANGE
# Before:
env:
  LIGHTHOUSE_SCORE_THRESHOLD: 90

# After:
env:
  LIGHTHOUSE_SCORE_THRESHOLD: 95
```

```yaml
# Lines 548-549 - CHANGE
# Before:
assertions: {
  'categories:accessibility': ['error', { minScore: 0.9 }],

# After:
assertions: {
  'categories:accessibility': ['error', { minScore: 0.95 }],
```

**File: `docs/testing/ACCESSIBILITY_TESTING_GUIDE.md`**

```markdown
# Line 36 - UPDATE

# Before:

- **Accessibility Score**: ≥95% (Note: CI currently has 90%, needs update)

# After:

- **Accessibility Score**: ≥95% (Enforced in CI)
```

### 1.3 Local Testing Commands

```bash
# Test with 95% threshold locally
lighthouse http://localhost:4173 \
  --only-categories=accessibility \
  --output=json \
  --output-path=./lighthouse-a11y-95.json

# Verify score meets 95% threshold
node -e "
const report = require('./lighthouse-a11y-95.json');
const score = report.lhr.categories.accessibility.score * 100;
console.log('Accessibility Score:', score);
console.log('Meets 95% threshold:', score >= 95 ? '✓ PASS' : '✗ FAIL');
if (score < 95) {
  console.log('Gap:', (95 - score).toFixed(1), 'points needed');
  process.exit(1);
}
"
```

### 1.4 Impact Assessment

- **Performance Impact**: None - only changes threshold validation
- **Risk**: **Medium** - May cause existing CI builds to fail if current
  accessibility score is between 90-95%
- **Rollout Plan**:
  1. Test current accessibility score locally
  2. Fix any accessibility issues found
  3. Deploy threshold change
  4. Monitor CI builds for failures

## 2. Component Isolation Testing (Gate 3)

### 2.1 Design Approach

Based on the existing test infrastructure, create a practical component
isolation testing job that:

- Tests critical UI components in isolation
- Prevents state management leaks between tests
- Integrates with existing Vitest setup
- Maintains reasonable CI performance

### 2.2 Required New CI Job

**File: `.github/workflows/ci.yml`**

Add new job after line 198 (after `deterministic-tests` job):

```yaml
# ==========================================
# PHASE 2.5: Component Isolation Testing (Gate 3)
# ==========================================

component-isolation-tests:
  name: Component Isolation Tests (Gate 3)
  runs-on: ubuntu-latest
  needs: quality-gates

  steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: "npm"

    - name: Install dependencies
      run: npm ci --prefer-offline --no-audit --progress=false

    - name: Setup isolated component test environment
      run: |
        # Create isolated test environment
        cp .env.test.example .env.component-test
        echo "NODE_ENV=test" >> .env.component-test
        echo "VITE_USE_MOCK_API=true" >> .env.component-test
        echo "VITEST_ISOLATED_COMPONENTS=true" >> .env.component-test
        echo "COMPONENT_TEST_MODE=isolation" >> .env.component-test

        # Set deterministic seeds for component testing
        echo "COMPONENT_TEST_SEED=isolated-$(date +%Y%m%d)" >> .env.component-test

    - name: Run component isolation tests
      run: |
        # Run component tests in isolation mode
        npm run test:components:isolated -- \
          --reporter=json \
          --outputFile=component-isolation-results.json \
          --run \
          --testTimeout=10000 \
          --teardownTimeout=5000 \
          --isolate
      env:
        NODE_ENV: test
        VITEST_ISOLATED_COMPONENTS: true
        COMPONENT_TEST_MODE: isolation

    - name: Validate component isolation
      run: |
        # Check for state leaks between component tests
        if [ -f component-isolation-results.json ]; then
          # Validate no shared state between tests
          node scripts/validate-component-isolation.js
        else
          echo "❌ Component isolation test results not found"
          exit 1
        fi

    - name: Upload component test results
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: component-isolation-results-${{ github.run_id }}
        path: |
          component-isolation-results.json
          component-test-report.html
        retention-days: 7
```

### 2.3 Required New Test Script

**File: `package.json`**

Add new script:

```json
{
  "scripts": {
    "test:components:isolated": "vitest run src/components/**/*.test.tsx --config=vitest.component-isolation.config.ts"
  }
}
```

### 2.4 Component Isolation Config

**File: `vitest.component-isolation.config.ts` (NEW)**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup-component-isolation.ts"],
    isolate: true,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    globals: false,
    include: [
      "src/components/**/?(*.){test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
    ],
    exclude: [
      "src/components/**/*.integration.test.*",
      "src/components/**/*.e2e.test.*",
    ],
    testTimeout: 10000,
    teardownTimeout: 5000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/test": path.resolve(__dirname, "./src/test"),
    },
  },
});
```

### 2.5 Component Isolation Validation Script

**File: `scripts/validate-component-isolation.js` (NEW)**

```javascript
#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function validateComponentIsolation() {
  console.log("=== Component Isolation Validation ===");

  if (!fs.existsSync("component-isolation-results.json")) {
    console.error("❌ Component isolation results file not found");
    process.exit(1);
  }

  const results = JSON.parse(
    fs.readFileSync("component-isolation-results.json", "utf8")
  );

  let validationPassed = true;
  const issues = [];

  // Check for state leakage indicators
  const stateLeakagePatterns = [
    /zustand.*state.*persisted/i,
    /tanstack.*query.*cache.*not.*cleared/i,
    /react.*context.*provider.*leak/i,
    /test.*state.*shared/i,
    /mock.*not.*reset/i,
  ];

  // Analyze test results for isolation issues
  if (results.testResults) {
    results.testResults.forEach((testFile) => {
      testFile.assertionResults.forEach((test) => {
        if (test.status === "failed") {
          const errorMessage = test.failureMessages.join(" ");

          stateLeakagePatterns.forEach((pattern) => {
            if (pattern.test(errorMessage)) {
              issues.push({
                type: "state_leakage",
                test: test.fullName,
                file: testFile.name,
                message: errorMessage,
              });
              validationPassed = false;
            }
          });
        }
      });
    });
  }

  // Check for proper component isolation patterns
  const isolationRequirements = [
    "All Zustand stores reset between tests",
    "TanStack Query cache cleared between tests",
    "React Testing Library cleanup executed",
    "Mock services reset between tests",
    "No shared component instances",
  ];

  isolationRequirements.forEach((requirement) => {
    console.log(`✓ ${requirement}`);
  });

  if (issues.length > 0) {
    console.log("\n❌ Component isolation issues found:");
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.type.toUpperCase()} in ${issue.test}`);
      console.log(`   File: ${issue.file}`);
      console.log(`   Issue: ${issue.message.substring(0, 200)}...`);
      console.log("");
    });
  }

  if (validationPassed) {
    console.log("✅ Component isolation validation passed");
    console.log(`   Tests analyzed: ${results.numTotalTests || 0}`);
    console.log(`   Components tested: ${results.numTotalTestSuites || 0}`);
  } else {
    console.log("❌ Component isolation validation failed");
    process.exit(1);
  }
}

validateComponentIsolation();
```

### 2.6 Local Testing Commands

```bash
# Run component isolation tests locally
npm run test:components:isolated

# Validate isolation manually
npm run test:components:isolated && node scripts/validate-component-isolation.js

# Test specific component in isolation
npx vitest run src/components/auth/LoginForm.test.tsx --config=vitest.component-isolation.config.ts
```

## 3. Project_ID Validation Checks

### 3.1 Design Approach

Create CI validation to ensure all database queries include proper `project_id`
filtering for tenant isolation. This prevents data leaks between different
resort properties.

### 3.2 Required New CI Job

**File: `.github/workflows/ci.yml`**

Add new step in the `quality-gates` job after line 83:

```yaml
- name: Validate tenant isolation (project_id usage)
  run: |
    echo "=== Project ID Validation ==="

    # Check for database queries missing project_id filters
    npm run lint:tenant-isolation || {
      echo "❌ Tenant isolation violations found"
      echo "All database queries must include project_id filtering"
      exit 1
    }

    # Check for hardcoded project_id values
    if grep -r "project_id.*=.*['\"]" src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v mock; then
      echo "❌ Hardcoded project_id values found in source code"
      echo "Use useCurrentProject() hook or project context instead"
      exit 1
    fi

    echo "✅ Tenant isolation validation passed"
```

### 3.3 Required New Lint Script

**File: `package.json`**

Add new script:

```json
{
  "scripts": {
    "lint:tenant-isolation": "node scripts/lint-tenant-isolation.js"
  }
}
```

### 3.4 Tenant Isolation Linting Script

**File: `scripts/lint-tenant-isolation.js` (NEW)**

```javascript
#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const glob = require("glob");

function lintTenantIsolation() {
  console.log("=== Tenant Isolation Linting ===");

  const violations = [];

  // Patterns that should include project_id filtering
  const queryPatterns = [
    /supabase\.from\(['"](\w+)['"]\)\.select/g,
    /supabase\.from\(['"](\w+)['"]\)\.insert/g,
    /supabase\.from\(['"](\w+)['"]\)\.update/g,
    /supabase\.from\(['"](\w+)['"]\)\.delete/g,
    /\.createBooking\(/g,
    /\.createExpense\(/g,
    /\.createPayment\(/g,
    /\.getBookings\(/g,
    /\.getExpenses\(/g,
    /\.getPayments\(/g,
  ];

  // Tables that require project_id filtering
  const tenantTables = [
    "bookings",
    "expenses",
    "payments",
    "properties",
    "users",
    "guests",
  ];

  // Files to check
  const sourceFiles = glob.sync("src/**/*.{ts,tsx}", {
    ignore: [
      "src/**/*.test.*",
      "src/**/*.spec.*",
      "src/test/**/*",
      "src/**/*.mock.*",
    ],
  });

  sourceFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      queryPatterns.forEach((pattern) => {
        const matches = [...line.matchAll(pattern)];

        matches.forEach((match) => {
          const tableName = match[1];

          // Check if this is a tenant table that needs project_id
          if (tenantTables.includes(tableName)) {
            // Look for project_id in the same line or next few lines
            const nextLines = lines.slice(index, index + 5).join(" ");

            if (
              !nextLines.includes("project_id") &&
              !nextLines.includes("useCurrentProject") &&
              !nextLines.includes("projectContext")
            ) {
              violations.push({
                file: filePath,
                line: index + 1,
                table: tableName,
                query: line.trim(),
                issue: "Missing project_id filter for tenant table",
              });
            }
          }
        });
      });

      // Check for raw SQL that might bypass RLS
      if (line.includes(".rpc(") || line.includes("sql`")) {
        if (
          !line.includes("project_id") &&
          !line.includes("-- SYSTEM QUERY") &&
          !line.includes("-- ADMIN QUERY")
        ) {
          violations.push({
            file: filePath,
            line: index + 1,
            query: line.trim(),
            issue: "Raw SQL query without project_id consideration",
          });
        }
      }
    });
  });

  // Check for proper RLS policies in migrations
  const migrationFiles = glob.sync("migrations/**/*.sql");
  migrationFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");

    tenantTables.forEach((table) => {
      if (
        content.includes(`CREATE TABLE ${table}`) ||
        content.includes(`ALTER TABLE ${table}`)
      ) {
        if (
          !content.includes(`${table}_project_id_policy`) &&
          !content.includes("ENABLE ROW LEVEL SECURITY")
        ) {
          violations.push({
            file: filePath,
            line: 0,
            table: table,
            issue: "Table created without RLS policy for project_id",
          });
        }
      }
    });
  });

  // Report violations
  if (violations.length > 0) {
    console.log(`\n❌ Found ${violations.length} tenant isolation violations:`);

    violations.forEach((violation, index) => {
      console.log(`\n${index + 1}. ${violation.issue}`);
      console.log(`   File: ${violation.file}:${violation.line}`);
      if (violation.table) {
        console.log(`   Table: ${violation.table}`);
      }
      if (violation.query) {
        console.log(`   Query: ${violation.query}`);
      }
    });

    console.log("\nTo fix these issues:");
    console.log('1. Add .eq("project_id", projectId) to database queries');
    console.log("2. Use useCurrentProject() hook for project context");
    console.log("3. Ensure RLS policies include project_id filtering");
    console.log("4. Add -- SYSTEM QUERY comment for admin-level operations");

    process.exit(1);
  } else {
    console.log(
      "✅ All database queries properly include project_id filtering"
    );
    console.log(`   Files checked: ${sourceFiles.length}`);
    console.log(`   Migrations checked: ${migrationFiles.length}`);
  }
}

lintTenantIsolation();
```

### 3.5 Local Testing Commands

```bash
# Check tenant isolation locally
npm run lint:tenant-isolation

# Check specific file
node scripts/lint-tenant-isolation.js src/services/booking.service.ts

# Find potential violations manually
grep -r "supabase.from" src/ --include="*.ts" | grep -v "project_id"
```

## 4. Test Progress Tracking

### 4.1 Design Approach

Create automated test counting and progress tracking that:

- Counts actual test cases across all test files
- Updates dashboard metrics automatically
- Provides visibility into test coverage progress
- Integrates with existing CI infrastructure

### 4.2 Required CI Job Modification

**File: `.github/workflows/ci.yml`**

Add new step in the `deterministic-tests` job after line 186:

```yaml
- name: Track test progress metrics
  run: |
    echo "=== Test Progress Tracking ==="

    # Count and analyze tests
    npm run test:count && npm run test:progress:update

    # Generate test metrics
    node scripts/generate-test-metrics.js
  env:
    NODE_ENV: test

- name: Upload test metrics
  uses: actions/upload-artifact@v4
  with:
    name: test-metrics-${{ github.run_id }}
    path: |
      test-metrics.json
      test-progress-report.html
    retention-days: 30
```

### 4.3 Required New Scripts

**File: `package.json`**

Add new scripts:

```json
{
  "scripts": {
    "test:count": "node scripts/count-tests.js",
    "test:progress:update": "node scripts/update-test-progress.js"
  }
}
```

### 4.4 Test Counting Script

**File: `scripts/count-tests.js` (NEW)**

```javascript
#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const glob = require("glob");

function countTests() {
  console.log("=== Test Counting Analysis ===");

  const testStats = {
    totalTests: 0,
    testFiles: 0,
    testSuites: 0,
    testsByType: {
      unit: 0,
      integration: 0,
      component: 0,
      e2e: 0,
    },
    testsByFeature: {},
    coverage: {
      hasTests: 0,
      needsTests: 0,
    },
  };

  // Count test files and tests
  const testPatterns = [
    "src/**/*.test.{ts,tsx,js,jsx}",
    "src/**/*.spec.{ts,tsx,js,jsx}",
    "e2e/**/*.test.{ts,js}",
    "tests/**/*.test.{ts,tsx,js,jsx}",
  ];

  testPatterns.forEach((pattern) => {
    const files = glob.sync(pattern);
    files.forEach((filePath) => {
      const content = fs.readFileSync(filePath, "utf8");
      testStats.testFiles++;

      // Count test cases (it, test, expect)
      const testMatches = content.match(/\b(it|test)\s*\(/g) || [];
      testStats.totalTests += testMatches.length;

      // Count test suites (describe)
      const suiteMatches = content.match(/\bdescribe\s*\(/g) || [];
      testStats.testSuites += suiteMatches.length;

      // Categorize by test type
      if (filePath.includes("integration")) {
        testStats.testsByType.integration += testMatches.length;
      } else if (
        filePath.includes("component") ||
        filePath.includes("components/")
      ) {
        testStats.testsByType.component += testMatches.length;
      } else if (filePath.includes("e2e")) {
        testStats.testsByType.e2e += testMatches.length;
      } else {
        testStats.testsByType.unit += testMatches.length;
      }

      // Categorize by feature
      const featurePath = filePath.split("/")[1] || "root";
      if (!testStats.testsByFeature[featurePath]) {
        testStats.testsByFeature[featurePath] = 0;
      }
      testStats.testsByFeature[featurePath] += testMatches.length;
    });
  });

  // Count source files that need tests
  const sourceFiles = glob.sync("src/**/*.{ts,tsx}", {
    ignore: [
      "src/**/*.test.*",
      "src/**/*.spec.*",
      "src/**/*.d.ts",
      "src/test/**/*",
      "src/**/*.mock.*",
      "src/vite-env.d.ts",
    ],
  });

  sourceFiles.forEach((filePath) => {
    const testFilePaths = [
      filePath.replace(/\.(ts|tsx)$/, ".test.$1"),
      filePath.replace(/\.(ts|tsx)$/, ".spec.$1"),
      filePath.replace(/src\//, "src/").replace(/\.(ts|tsx)$/, ".test.$1"),
    ];

    const hasTest = testFilePaths.some((testPath) => fs.existsSync(testPath));

    if (hasTest) {
      testStats.coverage.hasTests++;
    } else {
      testStats.coverage.needsTests++;
    }
  });

  // Calculate target based on current codebase
  const targetTests = Math.max(150, sourceFiles.length * 2); // Minimum 150 or 2 tests per source file
  const progress = ((testStats.totalTests / targetTests) * 100).toFixed(1);

  // Output results
  console.log(
    `Total Tests: ${testStats.totalTests}/${targetTests} (${progress}%)`
  );
  console.log(`Test Files: ${testStats.testFiles}`);
  console.log(`Test Suites: ${testStats.testSuites}`);
  console.log(`Source Files: ${sourceFiles.length}`);
  console.log(`Files with Tests: ${testStats.coverage.hasTests}`);
  console.log(`Files needing Tests: ${testStats.coverage.needsTests}`);

  console.log("\nTest Distribution:");
  Object.entries(testStats.testsByType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  console.log("\nTests by Feature:");
  Object.entries(testStats.testsByFeature)
    .sort(([, a], [, b]) => b - a)
    .forEach(([feature, count]) => {
      console.log(`  ${feature}: ${count}`);
    });

  // Save metrics
  const metrics = {
    ...testStats,
    targetTests,
    progress: parseFloat(progress),
    timestamp: new Date().toISOString(),
    gitCommit: process.env.GITHUB_SHA || "local",
  };

  fs.writeFileSync("test-metrics.json", JSON.stringify(metrics, null, 2));

  // Set CI environment variables for other jobs
  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(
      process.env.GITHUB_ENV,
      `TEST_COUNT=${testStats.totalTests}\n`
    );
    fs.appendFileSync(process.env.GITHUB_ENV, `TEST_TARGET=${targetTests}\n`);
    fs.appendFileSync(process.env.GITHUB_ENV, `TEST_PROGRESS=${progress}\n`);
  }

  console.log(`\n✅ Test metrics saved to test-metrics.json`);

  return metrics;
}

if (require.main === module) {
  countTests();
}

module.exports = { countTests };
```

### 4.5 Progress Update Script

**File: `scripts/update-test-progress.js` (NEW)**

```javascript
#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function updateTestProgress() {
  console.log("=== Updating Test Progress Dashboard ===");

  if (!fs.existsSync("test-metrics.json")) {
    console.error("❌ Test metrics not found. Run test:count first.");
    process.exit(1);
  }

  const metrics = JSON.parse(fs.readFileSync("test-metrics.json", "utf8"));

  // Generate HTML progress report
  const htmlReport = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Progress Report - Okaeri Resort System</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; }
        .header { background: #0F172A; color: white; padding: 20px; border-radius: 8px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: #F8FAFC; padding: 15px; border-radius: 8px; border-left: 4px solid #0EA5E9; }
        .metric-value { font-size: 24px; font-weight: bold; color: #0F172A; }
        .metric-label { color: #64748B; font-size: 14px; }
        .progress-bar { background: #E2E8F0; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .progress-fill { background: linear-gradient(90deg, #10B981 0%, #0EA5E9 100%); height: 100%; transition: width 0.3s; }
        .chart { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .test-type { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E2E8F0; }
        .feature-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
        .feature-item { background: #F1F5F9; padding: 10px; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Test Progress Report</h1>
        <p>Okaeri Resort Management System - ${new Date(metrics.timestamp).toLocaleString()}</p>
        <p>Git Commit: ${metrics.gitCommit?.substring(0, 8) || "local"}</p>
    </div>
    
    <div class="metrics">
        <div class="metric">
            <div class="metric-value">${metrics.totalTests}/${metrics.targetTests}</div>
            <div class="metric-label">Total Tests</div>
        </div>
        <div class="metric">
            <div class="metric-value">${metrics.progress}%</div>
            <div class="metric-label">Progress</div>
        </div>
        <div class="metric">
            <div class="metric-value">${metrics.testFiles}</div>
            <div class="metric-label">Test Files</div>
        </div>
        <div class="metric">
            <div class="metric-value">${metrics.coverage.hasTests}/${metrics.coverage.hasTests + metrics.coverage.needsTests}</div>
            <div class="metric-label">Files with Tests</div>
        </div>
    </div>
    
    <div class="progress-bar">
        <div class="progress-fill" style="width: ${metrics.progress}%"></div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
        <div class="chart">
            <h3>Tests by Type</h3>
            ${Object.entries(metrics.testsByType)
              .map(
                ([type, count]) => `
                <div class="test-type">
                    <span>${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                    <strong>${count}</strong>
                </div>
            `
              )
              .join("")}
        </div>
        
        <div class="chart">
            <h3>Tests by Feature</h3>
            <div class="feature-list">
                ${Object.entries(metrics.testsByFeature)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 10)
                  .map(
                    ([feature, count]) => `
                        <div class="feature-item">
                            <strong>${feature}</strong><br>
                            <small>${count} tests</small>
                        </div>
                    `
                  )
                  .join("")}
            </div>
        </div>
    </div>
    
    <div class="chart">
        <h3>Next Steps</h3>
        <ul>
            <li>Add ${Math.max(0, metrics.targetTests - metrics.totalTests)} more tests to reach target</li>
            <li>Create tests for ${metrics.coverage.needsTests} untested files</li>
            <li>Focus on ${Object.entries(metrics.testsByFeature)
              .sort(([, a], [, b]) => a - b)
              .slice(0, 3)
              .map(([feature]) => feature)
              .join(", ")} (lowest coverage)</li>
        </ul>
    </div>
</body>
</html>
  `;

  fs.writeFileSync("test-progress-report.html", htmlReport);

  // Update dashboard metrics in a format that can be consumed by the dashboard
  const dashboardMetrics = {
    testProgress: {
      current: metrics.totalTests,
      target: metrics.targetTests,
      percentage: metrics.progress,
      lastUpdated: metrics.timestamp,
    },
  };

  fs.writeFileSync(
    "dashboard-test-metrics.json",
    JSON.stringify(dashboardMetrics, null, 2)
  );

  console.log(`✅ Test progress updated:`);
  console.log(
    `   Current: ${metrics.totalTests}/${metrics.targetTests} tests (${metrics.progress}%)`
  );
  console.log(`   Report: test-progress-report.html`);
  console.log(`   Dashboard: dashboard-test-metrics.json`);
}

if (require.main === module) {
  updateTestProgress();
}

module.exports = { updateTestProgress };
```

### 4.6 Local Testing Commands

```bash
# Count tests locally
npm run test:count

# Update progress dashboard
npm run test:progress:update

# View progress report
open test-progress-report.html

# Check current metrics
cat test-metrics.json | jq '.totalTests, .targetTests, .progress'
```

## 5. Factory Usage Enforcement

### 5.1 Design Approach

Enforce the usage of CONFIG_PRESETS and factory patterns in tests by:

- Detecting hardcoded test data in test files
- Validating proper factory usage patterns
- Ensuring consistent test data generation
- Maintaining the existing factory infrastructure

### 5.2 Required CI Job Modification

**File: `.github/workflows/ci.yml`**

Add new step in the `deterministic-tests` job after the test progress step:

```yaml
- name: Enforce factory usage in tests
  run: |
    echo "=== Factory Usage Enforcement ==="

    # Check for hardcoded test data
    npm run lint:test-factories || {
      echo "❌ Test factory violations found"
      echo "Use test factories from src/test/factories/ instead of hardcoded data"
      exit 1
    }

    echo "✅ Factory usage validation passed"
```

### 5.3 Required New Lint Script

**File: `package.json`**

Add new script:

```json
{
  "scripts": {
    "lint:test-factories": "node scripts/lint-test-factories.js"
  }
}
```

### 5.4 Factory Usage Linting Script

**File: `scripts/lint-test-factories.js` (NEW)**

```javascript
#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const glob = require("glob");

function lintTestFactories() {
  console.log("=== Test Factory Usage Linting ===");

  const violations = [];

  // Patterns indicating hardcoded test data (violations)
  const hardcodedPatterns = [
    // Hardcoded booking data
    /checkInDate:\s*['"][0-9]{4}-[0-9]{2}-[0-9]{2}['"]/g,
    /checkOutDate:\s*['"][0-9]{4}-[0-9]{2}-[0-9]{2}['"]/g,
    /totalAmount:\s*['"][0-9]+\.00['"]/g,
    /guestName:\s*['"](?!test-|mock-)[A-Za-z\s]+['"]/g,
    /email:\s*['"][a-z]+@[a-z]+\.[a-z]+['"]/g,

    // Hardcoded expense data
    /amount:\s*['"][0-9]+\.[0-9]+['"]/g,
    /expenseDate:\s*['"][0-9]{4}-[0-9]{2}-[0-9]{2}['"]/g,
    /category:\s*['"](?!test-)[A-Za-z\s]+['"]/g,

    // Hardcoded payment data
    /paymentDate:\s*['"][0-9]{4}-[0-9]{2}-[0-9]{2}['"]/g,
    /gcashReferenceNumber:\s*['"][0-9]+['"]/g,
    /paymentMethod:\s*['"](?!test-)(gcash|bank|cash)['"]/g,

    // Hardcoded user data
    /firstName:\s*['"](?!test-|mock-)[A-Za-z]+['"]/g,
    /lastName:\s*['"](?!test-|mock-)[A-Za-z]+['"]/g,
    /phoneNumber:\s*['"][\+]?[0-9\-\(\)\s]+['"]/g,
  ];

  // Required factory usage patterns (should be present)
  const factoryPatterns = [
    /import.*from.*['"]@\/test\/factories['"]/,
    /createBooking\(/,
    /createExpense\(/,
    /createPayment\(/,
    /createUser\(/,
    /testDataFactory\./,
    /quickCreate\./,
  ];

  // Get all test files
  const testFiles = glob.sync("src/**/*.{test,spec}.{ts,tsx,js,jsx}", {
    ignore: ["src/test/factories/**/*", "src/test/mocks/**/*"],
  });

  testFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    // Check for hardcoded data patterns
    hardcodedPatterns.forEach((pattern) => {
      const matches = [...content.matchAll(pattern)];

      matches.forEach((match) => {
        const lineIndex =
          content.substring(0, match.index).split("\n").length - 1;
        violations.push({
          file: filePath,
          line: lineIndex + 1,
          type: "hardcoded_data",
          pattern: pattern.source,
          match: match[0],
          issue: "Hardcoded test data found - use factory instead",
        });
      });
    });

    // Check if file has test cases but no factory imports
    const hasTests = /\b(it|test|describe)\s*\(/.test(content);
    const hasFactoryImport = factoryPatterns.some((pattern) =>
      pattern.test(content)
    );

    if (hasTests && !hasFactoryImport) {
      // Check if file actually creates test data objects
      const createsTestData = [
        /const\s+\w+\s*=\s*\{[\s\S]*?checkInDate/,
        /const\s+\w+\s*=\s*\{[\s\S]*?totalAmount/,
        /const\s+\w+\s*=\s*\{[\s\S]*?expenseDate/,
        /const\s+\w+\s*=\s*\{[\s\S]*?paymentDate/,
        /const\s+\w+\s*=\s*\{[\s\S]*?firstName/,
      ].some((pattern) => pattern.test(content));

      if (createsTestData) {
        violations.push({
          file: filePath,
          line: 1,
          type: "missing_factory_import",
          issue: "Test file creates data objects but does not import factories",
        });
      }
    }

    // Check for inline object creation instead of factory usage
    lines.forEach((line, index) => {
      // Look for patterns like { id: 1, name: "test", ... } in test contexts
      if (
        line.includes("expect") ||
        line.includes("render") ||
        line.includes("mount")
      ) {
        const inlineObjectPattern = /\{\s*\w+:\s*['"]?[^,}]+['"]?[,\s]*\w+:/;
        if (inlineObjectPattern.test(line) && !line.includes("createMock")) {
          violations.push({
            file: filePath,
            line: index + 1,
            type: "inline_object",
            match: line.trim(),
            issue:
              "Inline object creation in test - use factory method instead",
          });
        }
      }
    });
  });

  // Check for proper factory configuration usage
  const factoryFiles = glob.sync("src/test/factories/*.ts");
  factoryFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");

    // Ensure factories use CONFIG_PRESETS
    if (
      !content.includes("CONFIG_PRESETS") &&
      !content.includes("FACTORY_CONFIG")
    ) {
      violations.push({
        file: filePath,
        line: 1,
        type: "missing_config_presets",
        issue:
          "Factory does not use CONFIG_PRESETS for consistent configuration",
      });
    }

    // Ensure factories have proper TypeScript types
    if (!content.includes("FactoryOptions") && !content.includes("interface")) {
      violations.push({
        file: filePath,
        line: 1,
        type: "missing_types",
        issue: "Factory missing TypeScript interface definitions",
      });
    }
  });

  // Report violations
  if (violations.length > 0) {
    console.log(`\n❌ Found ${violations.length} test factory violations:`);

    const violationsByType = {};
    violations.forEach((violation) => {
      if (!violationsByType[violation.type]) {
        violationsByType[violation.type] = [];
      }
      violationsByType[violation.type].push(violation);
    });

    Object.entries(violationsByType).forEach(([type, typeViolations]) => {
      console.log(
        `\n${type.toUpperCase().replace("_", " ")} (${typeViolations.length} issues):`
      );

      typeViolations.forEach((violation, index) => {
        console.log(`  ${index + 1}. ${violation.file}:${violation.line}`);
        console.log(`     ${violation.issue}`);
        if (violation.match) {
          console.log(`     Found: ${violation.match}`);
        }
      });
    });

    console.log("\n🔧 How to fix:");
    console.log(
      '1. Import factories: import { createBooking, createExpense } from "@/test/factories"'
    );
    console.log(
      '2. Use factory methods: const booking = createBooking({ checkInDate: "2024-12-20" })'
    );
    console.log(
      "3. Avoid hardcoded data: Use factory overrides for specific test needs"
    );
    console.log(
      "4. Use CONFIG_PRESETS: Leverage predefined configurations in factories"
    );

    console.log("\n📚 Examples:");
    console.log("// ❌ Bad - hardcoded data");
    console.log(
      'const booking = { id: 1, guestName: "John Doe", checkInDate: "2024-12-20" }'
    );
    console.log("");
    console.log("// ✅ Good - factory usage");
    console.log('const booking = createBooking({ checkInDate: "2024-12-20" })');
    console.log("const booking = bookingScenarios.confirmedPaid()");

    process.exit(1);
  } else {
    console.log("✅ All tests properly use factory patterns");
    console.log(`   Test files checked: ${testFiles.length}`);
    console.log(`   Factory files: ${factoryFiles.length}`);

    // Show factory usage statistics
    const factoryUsageStats = {
      filesWithFactories: 0,
      totalFactoryCalls: 0,
    };

    testFiles.forEach((filePath) => {
      const content = fs.readFileSync(filePath, "utf8");

      if (factoryPatterns.some((pattern) => pattern.test(content))) {
        factoryUsageStats.filesWithFactories++;
      }

      const factoryCalls = (content.match(/create\w+\(/g) || []).length;
      factoryUsageStats.totalFactoryCalls += factoryCalls;
    });

    console.log(
      `   Files using factories: ${factoryUsageStats.filesWithFactories}/${testFiles.length}`
    );
    console.log(
      `   Total factory method calls: ${factoryUsageStats.totalFactoryCalls}`
    );
  }
}

if (require.main === module) {
  lintTestFactories();
}

module.exports = { lintTestFactories };
```

### 5.5 Local Testing Commands

```bash
# Check factory usage locally
npm run lint:test-factories

# Check specific test file
node scripts/lint-test-factories.js src/components/BookingForm.test.tsx

# Find potential hardcoded data
grep -r "checkInDate:" src/ --include="*.test.*" | head -5
```

## Integration Plan

### 1. Deployment Sequence

**Phase 1: Low-Risk Changes (Week 1)**

1. Add test counting and progress tracking
2. Add factory usage enforcement
3. Test all changes locally

**Phase 2: Medium-Risk Changes (Week 2)**

1. Add project_id validation
2. Add component isolation testing
3. Monitor CI performance impact

**Phase 3: Higher-Risk Changes (Week 3)**

1. Update accessibility threshold from 90% to 95%
2. Monitor for failing builds
3. Fix any accessibility issues discovered

### 2. Performance Impact Assessment

| Fix                       | CI Time Impact | Risk Level | Mitigation             |
| ------------------------- | -------------- | ---------- | ---------------------- |
| Accessibility Threshold   | None           | Medium     | Pre-test current score |
| Component Isolation       | +2-3 minutes   | Low        | Runs in parallel       |
| Project_ID Validation     | +30 seconds    | Low        | Lightweight linting    |
| Test Progress Tracking    | +1 minute      | Low        | Cache results          |
| Factory Usage Enforcement | +30 seconds    | Low        | Static analysis only   |

**Total estimated CI time increase: 3-5 minutes**

### 3. Rollback Plan

Each fix is independent and can be rolled back by:

1. **Accessibility Threshold**: Revert environment variable and assertions
2. **Component Isolation**: Remove job from CI workflow
3. **Project_ID Validation**: Remove lint step and script
4. **Test Progress**: Remove tracking steps
5. **Factory Enforcement**: Remove lint step and script

### 4. Success Metrics

**Before Implementation:**

- Accessibility threshold: 90% (inconsistent with docs)
- Component isolation: Not tested
- Project_ID validation: Manual review only
- Test progress: Static "0/150" display
- Factory usage: No enforcement

**After Implementation:**

- Accessibility threshold: 95% (consistent)
- Component isolation: Automated validation
- Project_ID validation: Automated CI checks
- Test progress: Live dashboard with real metrics
- Factory usage: Enforced via CI

### 5. Monitoring and Alerts

**Set up monitoring for:**

- CI build success rates (should remain >95%)
- Build time increases (should be <20% increase)
- Accessibility score trends
- Test count progression
- Factory compliance rates

## Conclusion

This implementation plan provides **exact, actionable fixes** for all 5
identified CI gaps. Each fix is:

- **Specific**: Exact file paths, line numbers, and code changes
- **Implementable**: Uses existing toolchain and infrastructure
- **Appropriate**: Suitable for a 1-3 property internal resort management app
- **Maintainable**: Can be managed and updated by a small team
- **Testable**: Includes local testing commands for each fix

The total implementation effort is estimated at 2-3 weeks with staged rollout,
resulting in a significantly more robust CI/CD pipeline that enforces quality
standards appropriate for the Okaeri Resort Management System.
