# Deterministic Test Configuration Guide

> **Purpose**: Ensure test reproducibility across all environments  
> **Authority**: References TDD_SINGLE_SOURCE_OF_TRUTH.md  
> **Last Updated**: August 2025 **CRITICAL**: Addresses date mismatch between
> documentation and implementation

## Overview

This document provides implementation guidance for aligning test configuration
with the Single Source of Truth standards. All test environments must use these
exact settings to ensure deterministic, reproducible test results.

**✅ RESOLVED**: The `src/test/setup.ts` now correctly uses
`2024-01-01T00:00:00Z` aligned with SSoT. Migration steps retained below for
reference.

## Standard Test Configuration

### Current State Analysis

**Documentation (SSoT)**: `2024-01-01T00:00:00Z` ✅  
**Repository Reality**: `2024-01-01T00:00:00Z` ✅  
**Status**: Fully aligned - no action required

### Authoritative Values (from TDD_SINGLE_SOURCE_OF_TRUTH.md)

```typescript
// CANONICAL configuration - must be implemented
const TEST_CONFIG = {
  scenario: "STABLE",
  seed: "test-seed-2024",
  timestamp: "2024-01-01T00:00:00Z", // CANONICAL DATE
  timezone: "Asia/Manila",
  locale: "en-PH",
  currency: "PHP",
};
```

### Environment Variables

These environment variables control test behavior and must align with the SSoT:

| Variable        | Default Value            | Purpose                       |
| --------------- | ------------------------ | ----------------------------- |
| `NODE_ENV`      | `"test"`                 | Enable test mode              |
| `TEST_SCENARIO` | `"STABLE"`               | Deterministic mock responses  |
| `MOCK_DELAY`    | `"0"`                    | No artificial delays in tests |
| `RANDOM_SEED`   | `"test-seed-2024"`       | Predictable random values     |
| `FIXED_TIME`    | `"2024-01-01T00:00:00Z"` | Consistent timestamps         |
| `TZ`            | `"Asia/Manila"`          | Philippine timezone           |

## Required Implementation in src/test/setup.ts

### Current vs Required Changes

**Current (misaligned)**:

```typescript
// ❌ INCORRECT - doesn't match SSoT
vi.setSystemTime(new Date("2025-08-25T00:00:00.000Z"));
vi.spyOn(Math, "random").mockReturnValue(0.5); // Fixed value problematic
```

**Required (SSoT-aligned)**:

```typescript
// ✅ CORRECT - matches SSoT with environment variable support
const FIXED_TIME = process.env.FIXED_TIME ?? "2024-01-01T00:00:00Z";
vi.setSystemTime(new Date(FIXED_TIME));
// Use seeded random instead of fixed 0.5
```

### Complete Recommended Implementation

The test setup file must be updated to align with SSoT defaults:

```typescript
/**
 * Test Setup Configuration
 * Aligns with TDD_SINGLE_SOURCE_OF_TRUTH.md standards
 *
 * CRITICAL: Uses environment variables with SSoT fallbacks
 * This resolves the 2025-08-25 vs 2024-01-01 date mismatch
 */

import { beforeAll, afterEach, afterAll, vi } from "vitest";
import "@testing-library/jest-dom";
import { config } from "dotenv";
import { enableMapSet } from "immer";

// Enable Immer MapSet plugin for zustand stores
enableMapSet();

// Load test environment variables
config({ path: ".env.test" });

// Read configuration from environment with SSoT fallbacks
// These values MUST align with TDD_SINGLE_SOURCE_OF_TRUTH.md
const FIXED_TIME = process.env.FIXED_TIME ?? "2024-01-01T00:00:00Z"; // CANONICAL
const RANDOM_SEED = process.env.RANDOM_SEED ?? "test-seed-2024"; // CANONICAL
const TEST_SCENARIO = process.env.TEST_SCENARIO ?? "STABLE";
const MOCK_DELAY = process.env.MOCK_DELAY ?? "0";

// Set deterministic test environment
process.env.TZ = "Asia/Manila";
process.env.NODE_ENV = "test";
process.env.TEST_SCENARIO = TEST_SCENARIO;
process.env.MOCK_DELAY = MOCK_DELAY;
process.env.RANDOM_SEED = RANDOM_SEED;

// Use fake timers with SSoT-aligned fixed time
vi.useFakeTimers();
vi.setSystemTime(new Date(FIXED_TIME));

// Mock Math.random for deterministic randomness with realistic distribution
const originalRandom = Math.random;
let rng: () => number;

beforeAll(() => {
  // Create a simple PRNG using the seed (without external dependency)
  // This provides realistic value distribution unlike fixed 0.5
  const seed = hashCode(RANDOM_SEED);
  rng = createSeededRandom(seed);

  vi.spyOn(Math, "random").mockImplementation(() => rng());
});

afterAll(() => {
  Math.random = originalRandom;
  vi.useRealTimers();
});

// Convert seed string to numeric value (matches src/test/setup.ts)
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Simple Linear Congruential Generator (LCG) for deterministic randomness
// Uses same implementation as src/test/setup.ts for consistency
function createSeededRandom(seed: number): () => number {
  let state = seed || 123456789;
  return () => {
    // Numerical Recipes LCG parameters (matches setup.ts)
    state = (1664525 * state + 1013904223) >>> 0;
    return (state & 0xffffffff) / 0x100000000;
  };
}

// Rest of existing setup code (preserve existing mocks and utilities)...
```

**Important**: This seeded PRNG approach provides deterministic randomness with
realistic value distribution across the 0-1 range. Unlike a fixed value of 0.5,
this approach:

- ✅ Provides varied but predictable random values
- ✅ Won't break code that expects different random values
- ✅ Maintains reproducible test results
- ✅ Works with algorithms that use multiple random values
- ✅ No external dependencies required

**Alternative with seedrandom package** (if more complex randomness needed):

```bash
npm install --save-dev seedrandom @types/seedrandom
```

```typescript
import seedrandom from "seedrandom";

beforeAll(() => {
  const rng = seedrandom(RANDOM_SEED);
  vi.spyOn(Math, "random").mockImplementation(() => rng());
});
```

## Mock Service Configuration

Mock services must honor the deterministic configuration:

```typescript
// src/services/mock/base.mock.service.ts
export abstract class BaseMockService {
  protected readonly config = {
    scenario: process.env.TEST_SCENARIO || "STABLE",
    delay: parseInt(process.env.MOCK_DELAY || "0", 10),
    seed: process.env.RANDOM_SEED || "test-seed-2024",
    timestamp: process.env.FIXED_TIME || "2024-01-01T00:00:00Z",
  };

  protected async simulateDelay(): Promise<void> {
    if (this.config.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.config.delay));
    }
  }

  protected generateId(prefix: string, sequence: number): string {
    // Deterministic ID generation
    return `${prefix}-${this.config.seed}-${sequence}`;
  }

  protected getCurrentTime(): Date {
    // Always return the fixed time in tests
    return new Date(this.config.timestamp);
  }
}
```

## Test Data Standards

### ID Generation Sequences

Per TDD_SINGLE_SOURCE_OF_TRUTH.md:

- User IDs: Sequential from 1000
- Booking IDs: Sequential from 2000
- Transaction IDs: Sequential from 3000
- Property IDs: Sequential from 4000
- Expense IDs: Sequential from 5000

### Factory Configuration

```typescript
// src/test/factories/base.factory.ts
export class BaseFactory {
  private static sequences: Map<string, number> = new Map([
    ["user", 1000],
    ["booking", 2000],
    ["transaction", 3000],
    ["property", 4000],
    ["expense", 5000],
  ]);

  protected static getNextId(type: string): number {
    const current = this.sequences.get(type) || 1000;
    this.sequences.set(type, current + 1);
    return current;
  }

  protected static getFixedTime(): Date {
    return new Date(process.env.FIXED_TIME || "2024-01-01T00:00:00Z");
  }

  protected static reset(): void {
    // Reset sequences for test isolation
    this.sequences.set("user", 1000);
    this.sequences.set("booking", 2000);
    this.sequences.set("transaction", 3000);
    this.sequences.set("property", 4000);
    this.sequences.set("expense", 5000);
  }
}
```

## Verification Commands

### Check Current Configuration

```bash
# Verify deterministic date is configured correctly
grep "2024-01-01" src/test/setup.ts && echo "✅ SSoT date aligned" || echo "❌ Time constant misaligned - should be 2024-01-01"
grep "2025-08-25" src/test/setup.ts && echo "⚠️ Found non-SSoT date - needs migration" || echo "✅ No non-SSoT dates found"

# Check for other SSoT alignment
grep "test-seed-2024" src/test/setup.ts && echo "✅ Seed aligned" || echo "❌ Seed misaligned"
grep "Asia/Manila" src/test/setup.ts && echo "✅ Timezone aligned" || echo "❌ Timezone misaligned"

# Verify environment variable usage
grep "process.env.FIXED_TIME" src/test/setup.ts && echo "✅ Environment variable support present" || echo "❌ Missing environment variable support"
```

### Run Tests with Custom Time

```bash
# Run tests with canonical SSoT time (should be default behavior)
FIXED_TIME="2024-01-01T00:00:00Z" npm run test:coverage

# Verify current implementation behavior
npm run test:coverage

# Test with different time for debugging
FIXED_TIME="2023-12-25T00:00:00Z" npm run test src/test/setup.test.ts
```

### Verify CI Configuration

```bash
# Check if CI explicitly sets FIXED_TIME
grep "FIXED_TIME" .github/workflows/ci.yml && echo "✅ CI has explicit time config" || echo "⚠️ CI relies on code defaults"

# Verify no hardcoded non-SSoT dates in CI
grep "2025-08-25" .github/workflows/ && echo "⚠️ Found non-SSoT date in CI" || echo "✅ No non-SSoT dates in CI"
```

## Local Development Setup

### Environment File Configuration

The `.env.test` file provides environment variables for local testing:

**Location**: Project root directory
(`/Users/jasonacido/repos/okaeri-dev/okaeri-resort-system/.env.test`)

**Git Status**: NOT committed to repository (included in `.gitignore`)

**Purpose**: Override default test values for local development without
affecting CI/CD

### Creating .env.test File

```bash
# Create .env.test in project root with canonical values
cat > .env.test << 'EOF'
# Deterministic Test Configuration - Must match CI exactly
NODE_ENV=test
FIXED_TIME=2024-01-01T00:00:00Z
RANDOM_SEED=test-seed-2024
TEST_SCENARIO=STABLE
MOCK_DELAY=0
TZ=Asia/Manila
VITEST_DETERMINISTIC=true
EOF
```

### Canonical Environment Variables

These values MUST be identical between local development and CI/CD:

| Variable               | Canonical Value        | Purpose                                |
| ---------------------- | ---------------------- | -------------------------------------- |
| `NODE_ENV`             | `test`                 | Ensures test mode                      |
| `FIXED_TIME`           | `2024-01-01T00:00:00Z` | Fixed timestamp for all tests          |
| `RANDOM_SEED`          | `test-seed-2024`       | Seed for deterministic randomness      |
| `TEST_SCENARIO`        | `STABLE`               | Test scenario selector                 |
| `MOCK_DELAY`           | `0`                    | No artificial delays in tests          |
| `TZ`                   | `Asia/Manila`          | Philippine timezone for resort context |
| `VITEST_DETERMINISTIC` | `true`                 | Enable deterministic mode              |

### Verification

```bash
# Verify .env.test exists and has correct values
if [ -f .env.test ]; then
  echo "✅ .env.test exists"
  grep "FIXED_TIME=2024-01-01T00:00:00Z" .env.test && echo "✅ Correct time configured"
  grep "RANDOM_SEED=test-seed-2024" .env.test && echo "✅ Correct seed configured"
else
  echo "❌ .env.test missing - create it with canonical values"
fi
```

### Environment Variable Check

```bash
# Create a test script to verify runtime values
cat > verify-test-env.js << 'EOF'
console.log("=== Test Environment Configuration ===\n");
console.log("FIXED_TIME:", process.env.FIXED_TIME || "2024-01-01T00:00:00Z (DEFAULT)");
console.log("RANDOM_SEED:", process.env.RANDOM_SEED || "test-seed-2024 (DEFAULT)");
console.log("TEST_SCENARIO:", process.env.TEST_SCENARIO || "STABLE (DEFAULT)");
console.log("MOCK_DELAY:", process.env.MOCK_DELAY || "0 (DEFAULT)");
console.log("TZ:", process.env.TZ || "Asia/Manila (DEFAULT)");
console.log("NODE_ENV:", process.env.NODE_ENV || "(not set)");

// Verify SSoT alignment
const fixedTime = process.env.FIXED_TIME || "2024-01-01T00:00:00Z";
const isCanonical = fixedTime === "2024-01-01T00:00:00Z";
console.log("\n=== SSoT Alignment Check ===\n");
console.log("FIXED_TIME matches canonical:", isCanonical ? "✅ YES" : "❌ NO");
if (!isCanonical) {
  console.log("Expected: 2024-01-01T00:00:00Z");
  console.log("Actual:", fixedTime);
}
EOF

echo "Running environment verification..."
node verify-test-env.js
echo "\nCleaning up..."
rm verify-test-env.js
```

### Quick SSoT Alignment Check

```bash
# One-liner to check if current setup matches SSoT
if grep -q "2024-01-01" src/test/setup.ts && grep -q "process.env.FIXED_TIME" src/test/setup.ts; then
  echo "✅ Test setup appears aligned with SSoT"
else
  echo "❌ Test setup needs SSoT alignment"
  echo "Current time setting:"
  grep "setSystemTime" src/test/setup.ts
fi
```

## Common Issues and Solutions

### Issue 1: Tests Pass Locally but Fail in CI

**Cause**: Environment variables not aligned  
**Solution**: Ensure CI uses the same defaults as local environment

```yaml
# .github/workflows/ci.yml
env:
  FIXED_TIME: "2024-01-01T00:00:00Z"
  RANDOM_SEED: "test-seed-2024"
  TEST_SCENARIO: "STABLE"
  MOCK_DELAY: "0"
  TZ: "Asia/Manila"
```

### Issue 2: Random Values Differ Between Runs

**Cause**: Math.random not properly mocked  
**Solution**: Ensure Math.random mock is applied before any test code runs

### Issue 3: Timestamps Inconsistent

**Cause**: Using Date.now() or new Date() directly  
**Solution**: Always use vi.setSystemTime() and ensure fake timers are enabled

## Migration Path from Current State

### Step-by-Step Migration Process

#### Phase 1: Audit Current State

```bash
# Find all references to the current non-SSoT date
grep -r "2025-08-25" src/ docs/ .github/ || echo "No 2025-08-25 references found"

# Find all setSystemTime calls
grep -r "setSystemTime" src/ --include="*.ts" --include="*.tsx"

# Find hardcoded dates in tests
grep -r "202[0-9]-[0-9][0-9]-[0-9][0-9]" src/**/*.test.* || echo "No hardcoded dates in tests"

# Check for date-dependent test expectations
grep -r "getFullYear\|getMonth\|getDate" src/**/*.test.*
```

#### Phase 2: Update src/test/setup.ts

**CRITICAL**: This is the main file that needs updating:

```typescript
// BEFORE (line 23 in current setup.ts):
vi.setSystemTime(new Date("2025-08-25T00:00:00.000Z"));

// AFTER (SSoT-aligned with environment variable support):
const FIXED_TIME = process.env.FIXED_TIME ?? "2024-01-01T00:00:00Z";
vi.setSystemTime(new Date(FIXED_TIME));
```

**Also update the Math.random mock**:

```typescript
// BEFORE (line 28 in current setup.ts):
vi.spyOn(Math, "random").mockReturnValue(0.5);

// AFTER (seeded random for better test realism):
const seed = hashCode(RANDOM_SEED);
const rng = createSeededRandom(seed);
vi.spyOn(Math, "random").mockImplementation(() => rng());
```

#### Phase 3: Test Impact Analysis

```bash
# Run all tests before migration to establish baseline
npm run test:coverage > pre-migration-test-results.log 2>&1

# After making changes, run tests again
npm run test:coverage > post-migration-test-results.log 2>&1

# Compare results
diff pre-migration-test-results.log post-migration-test-results.log
```

#### Phase 4: Update Affected Tests

Look for tests that might have date expectations:

```bash
# Search for potential date-dependent tests
grep -r "2025" src/**/*.test.* || echo "No 2025 references in tests"
grep -r "August" src/**/*.test.* || echo "No August references in tests"
grep -r "getTime\|toISOString\|valueOf" src/**/*.test.*
```

#### Phase 5: Update Mock Services

```bash
# Check if mock services use deterministic dates
grep -r "new Date" src/services/mock/ || echo "No Date constructors in mocks"
grep -r "Date.now" src/services/mock/ || echo "No Date.now calls in mocks"

# Update to use FIXED_TIME environment variable
# Replace direct Date constructors with:
# new Date(process.env.FIXED_TIME || "2024-01-01T00:00:00Z")
```

#### Phase 6: CI Configuration

Ensure CI uses the same defaults:

```yaml
# .github/workflows/ci.yml
env:
  FIXED_TIME: "2024-01-01T00:00:00Z" # Explicit override to canonical
  RANDOM_SEED: "test-seed-2024"
  TEST_SCENARIO: "STABLE"
  MOCK_DELAY: "0"
  TZ: "Asia/Manila"
```

### Validation After Migration

```bash
# Verify alignment with SSoT
npm run verify:test-config  # (if this script exists)

# Check that tests are deterministic
npm run test:coverage
npm run test:coverage  # Should produce identical results

# Verify no regressions
npm run verify:all
```

## Enforcement

### Pre-commit Hook

Add to `.husky/pre-commit`:

```bash
# Verify test configuration alignment
if grep -q "2025-08-25" src/test/setup.ts; then
  echo "❌ Test setup uses non-standard date. Should be 2024-01-01"
  exit 1
fi
```

### CI Validation

Add to CI pipeline:

```yaml
- name: Verify Test Configuration
  run: |
    npm run test:config:verify
```

## Best Practices

### Development Guidelines

1. **Never hardcode dates** - Always use FIXED_TIME environment variable
2. **Never use Math.random directly** - Use seeded random or mocked values
3. **Always reset sequences** - Clear test data between tests
4. **Use factories** - Don't create test data manually
5. **Document deviations** - If you must diverge, document why
6. **Verify SSoT alignment** - Check that your implementation matches canonical
   values
7. **Test environment isolation** - Ensure tests don't depend on system time or
   random values

### Code Review Checklist

- [ ] No hardcoded dates (especially non-SSoT dates like 2025-08-25)
- [ ] Uses FIXED_TIME environment variable with proper fallback
- [ ] Math.random is mocked or uses seeded generator
- [ ] Test data uses deterministic ID sequences
- [ ] Mock services respect deterministic configuration
- [ ] All timestamps reference canonical test date

### Migration Safety Checklist

- [ ] Current test results documented before changes
- [ ] All date references audited
- [ ] Environment variable fallbacks implemented
- [ ] CI configuration aligned
- [ ] Post-migration test results match expectations
- [ ] No test coverage regressions
- [ ] Performance impact assessed

## Summary

Deterministic test configuration ensures:

- ✅ Reproducible test results
- ✅ Consistent CI/local behavior
- ✅ Predictable test data
- ✅ Easier debugging
- ✅ Reliable TDD workflow

All test configuration must align with the Single Source of Truth defined in
TDD_SINGLE_SOURCE_OF_TRUTH.md. This alignment is non-negotiable for maintaining
test reliability and TDD effectiveness.

## Implementation Status

### ✅ Current Status: Fully Aligned

The repository is now fully aligned with SSoT requirements:

- Date configuration uses `2024-01-01T00:00:00Z`
- Environment variable support implemented with proper fallbacks
- Seeded random generator in place (not fixed 0.5)
- All deterministic values properly configured

### Historical Issues (Resolved)

These issues were identified and have been resolved:

1. **Date Mismatch** (RESOLVED): `src/test/setup.ts` previously used
   `2025-08-25T00:00:00.000Z`
   - ✅ Now uses canonical `2024-01-01T00:00:00Z`
2. **Missing Environment Variable Support** (RESOLVED): No fallback mechanism
   was implemented
   - ✅ Now uses `process.env.FIXED_TIME ?? "2024-01-01T00:00:00Z"`
3. **Suboptimal Random Mocking** (RESOLVED): Used fixed `0.5` instead of seeded
   generator
   - ✅ Now uses seeded PRNG with `RANDOM_SEED`

### Success Criteria

- ✅ `grep "2024-01-01" src/test/setup.ts` returns matches
- ✅ `grep "process.env.FIXED_TIME" src/test/setup.ts` returns matches
- ✅ `grep "2025-08-25" src/test/setup.ts` returns no matches
- ✅ Tests produce identical results across multiple runs
- ✅ CI and local environments behave identically
- ✅ All verification commands pass successfully

This migration resolves the critical deterministic testing mismatch and ensures
long-term test reliability for the Okaeri Resort Management System.
