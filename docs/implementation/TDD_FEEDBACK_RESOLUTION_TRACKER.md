# TDD Feedback Resolution Tracker

## Overview

This document tracks the resolution of 14 critical issues identified in the TDD
documentation review on August 31, 2025. These issues must be resolved before
Phase 1 RED implementation can proceed safely.

**Goal**: Make documentation "rock solid" for TDD implementation with zero CI
failures and cross-platform support.

## Success Criteria

- ✅ All Highest Priority blockers resolved (Issues 1-5)
- ✅ No contradictions between documents
- ✅ Clear authoritative sources established
- ✅ All referenced files exist and are linked
- ✅ Scripts work cross-platform (Windows/Mac/Linux)
- ✅ CI runs deterministically without failures

## Issue Tracking Matrix

### Highest Priority - CI/RED Stability Blockers

#### Issue 1: Vitest Coverage Path-Based Thresholds Not Supported

- **Status**: ✅ Resolved
- **Priority**: HIGHEST
- **Agent**: typescript-react-quality-expert
- **Location**: `vitest.config.ts` lines 85-118
- **Problem**: Vitest doesn't natively support path-based coverage thresholds
  like `"src/features/auth/**": { branches: 95 }`
- **Solution**:
  1. Remove path-based thresholds from vitest.config.ts
  2. Create `scripts/check-coverage.js` for custom path validation
  3. Update TEST_CONFIGURATION_TEMPLATES.md
  4. Add `verify:coverage:paths` script to package.json
- **Files to Update**:
  - `vitest.config.ts`
  - `TEST_CONFIGURATION_TEMPLATES.md`
  - `package.json`
  - Create: `scripts/check-coverage.js`
- **Verification**: Run `npm run test:coverage` without errors

#### Issue 2: Lighthouse Usage Inconsistency (npx vs devDependency)

- **Status**: ✅ Resolved
- **Priority**: HIGHEST
- **Agent**: pwa-performance-optimizer
- **Problem**: Mixed usage of `npx lighthouse` vs local `lighthouse` causing CI
  instability
- **Solution**:
  1. Remove all `npx lighthouse` references
  2. Ensure lighthouse is in devDependencies
  3. Update all scripts to use local lighthouse
  4. Always use with `start-server-and-test`
- **Files to Update**:
  - `LOCAL_TESTING_ERGONOMICS.md`
  - `PERFORMANCE_SCRIPTS_SPECIFICATION.md`
  - `VERIFICATION_SCRIPT_SUITE.md`
  - `package.json` scripts
- **Verification**: Scripts run without npx downloads

#### Issue 3: Missing Package.json Scripts

- **Status**: ✅ Resolved
- **Priority**: HIGHEST
- **Agent**: typescript-react-quality-expert
- **Problem**: Many referenced scripts don't exist in package.json
- **Missing Scripts**:
  - `verify:coverage:paths`
  - `verify:jwt`
  - `test:utilities`
  - `lighthouse:accessibility`
  - `lighthouse:performance`
- **Solution**: Add all missing scripts per VERIFICATION_SCRIPT_SUITE.md
- **Files to Update**:
  - `package.json`
  - Reconcile with `VERIFICATION_SCRIPT_SUITE.md`
- **Verification**: All referenced scripts executable

#### Issue 4: Deterministic Testing Configuration Gaps

- **Status**: ✅ Resolved
- **Priority**: HIGHEST
- **Agent**: typescript-react-quality-expert
- **Problem**: Missing .env.test configuration and setup gaps
- **Solution**:
  1. Create `.env.test` with canonical values
  2. Ensure vitest.config.ts has `environment: 'jsdom'`
  3. Verify `setupFiles: ['src/test/setup.ts']`
  4. Confirm jest-axe integration
- **Files to Update**:
  - Create: `.env.test`
  - `DETERMINISTIC_TEST_CONFIGURATION.md`
  - `TEST_CONFIGURATION_TEMPLATES.md`
- **Verification**: Tests run deterministically with fixed time/seed

#### Issue 5: Security Scripts Not Cross-Platform

- **Status**: ✅ Resolved
- **Priority**: HIGHEST
- **Agent**: security-compliance-auditor
- **Problem**: Bash-only scripts won't run on Windows
- **Solution**:
  1. Keep bash scripts for CI (Linux)
  2. Create Node.js equivalents for local development
  3. Document platform requirements
- **Files to Create**:
  - `scripts/security-audits/jwt-audit.js`
  - `scripts/security-audits/storage-audit.js`
  - `scripts/security-audits/header-audit.js`
- **Files to Update**:
  - `SECURITY_VERIFICATION_SCRIPTS.md`
  - `package.json` (add node script variants)
- **Verification**: Scripts run on Windows via Node.js

### High Priority - Correctness/Consistency

#### Issue 6: Multiple Documents Covering Same Topics

- **Status**: ✅ Resolved
- **Priority**: HIGH
- **Agent**: context-manager
- **Problem**: Documentation duplication causing drift
- **Solution**: Establish authoritative documents:
  - Scripts: `VERIFICATION_SCRIPT_SUITE.md` (primary)
  - Performance: `PERFORMANCE_TESTING_REQUIREMENTS.md` (primary)
  - Add "References canonical source" headers
- **Files to Update**:
  - `TDD_SINGLE_SOURCE_OF_TRUTH.md`
  - Add authority markers to secondary docs
- **Verification**: Clear SSOT hierarchy established

#### Issue 7: Missing Referenced Documents

- **Status**: ✅ Resolved
- **Priority**: HIGH
- **Agent**: context-manager
- **Missing Files**:
  - `DOCUMENTATION_MAP.md` (referenced in README.md line 25)
  - `COMPOSITE_SCRIPTS_GUIDE.md` (referenced in README.md line 27)
  - `TEST_UTILITIES_SPECIFICATION.md` (needed for patterns)
- **Solution**:
  1. Create missing documents OR
  2. Remove orphaned references from README.md
- **Verification**: No broken document references

#### Issue 8: Phase 3 Database Confusion

- **Status**: ✅ RESOLVED
- **Priority**: HIGH
- **Agent**: postgres-serverless-architect
- **Problem**: Mixed signals on RLS/pooling scope
- **Solution**: Added "Runtime Scope" clarification box to Phase 3 README
- **Files Updated**:
  - ✅ `phases/phase-3-booking-tdd/README.md` - Added clear scope box at top
  - ✅ Linked to `SIMPLE_DATABASE_GUIDE.md` as authority
  - ✅ Marked advanced features as "reference only"
  - ✅ Updated references section with primary/secondary distinction
- **Verification**: Clear scope boundaries established - NO RLS in Phase 3

#### Issue 9: Cross-Platform Scaffold Scripts

- **Status**: ✅ RESOLVED
- **Priority**: HIGH
- **Agent**: vercel-resort-api-architect
- **Problem**: Bash mkdir -p and brace expansion won't work on Windows
- **Solution IMPLEMENTED**:
  1. ✅ Created Node.js scaffold script at `scripts/scaffold-phase.cjs`
  2. ✅ Kept bash scripts with `:bash` suffix for Linux/Mac
  3. ✅ Documented both approaches in PHASE_SCAFFOLDING_REQUIREMENTS.md
- **Files Created**:
  - ✅ `scripts/scaffold-phase.cjs` - Cross-platform Node.js script
- **Files Updated**:
  - ✅ `PHASE_SCAFFOLDING_REQUIREMENTS.md` - Added cross-platform section and
    troubleshooting
  - ✅ `package.json` - Updated scaffold scripts to use Node.js by default, bash
    as alternative
- **Verification**: ✅ Scaffolding works on all platforms (Node.js with
  CommonJS)

#### Issue 10: Accessibility Testing Integration Details

- **Status**: ✅ Resolved
- **Priority**: HIGH
- **Agent**: resort-ui-designer
- **Problem**: Missing jest-axe setup patterns and utilities
- **Solution**:
  1. Create TEST_UTILITIES_SPECIFICATION.md
  2. Add renderWithProviders + axe patterns
  3. Document TypeScript setup
- **Files to Create**:
  - `TEST_UTILITIES_SPECIFICATION.md`
- **Files to Update**:
  - `COMPONENT_TESTING_PATTERNS.md`
- **Verification**: Accessibility tests have clear patterns

### Medium Priority - Quality/DevEx

#### Issue 11: Readiness Checklist tsconfig Path Issues

- **Status**: ✅ Resolved
- **Priority**: MEDIUM
- **Agent**: typescript-react-quality-expert
- **Problem**: Assumes specific tsconfig filename
- **Solution**: Check multiple candidate files
- **Files to Update**:
  - `IMPLEMENTATION_READINESS_CHECKLIST.md`

#### Issue 12: JWT Path/Naming Inconsistencies

- **Status**: ✅ Resolved
- **Priority**: MEDIUM
- **Agent**: security-compliance-auditor
- **Problem**: secure-token-manager naming mismatches
- **Solution**: Standardize on actual implementation names
- **Files to Update**:
  - `SECURITY_VERIFICATION_SCRIPTS.md`
  - `JWT_SECURITY_MANAGER_SKELETON.md`

#### Issue 13: Bundlesize Configuration Assumptions

- **Status**: ✅ Resolved
- **Priority**: MEDIUM
- **Agent**: pwa-performance-optimizer
- **Problem**: Path assumptions may not match Vite output
- **Solution**: Align bundlesize config with actual build output
- **Files to Update**:
  - `bundlesize.config.json`
  - `PERFORMANCE_BUDGET_VERIFICATION.md`

#### Issue 14: CI Empty Directory False Negatives

- **Status**: ✅ Resolved
- **Priority**: MEDIUM
- **Agent**: vercel-deployment-optimizer
- **Problem**: Empty phase directories may fail coverage
- **Solution**: Document CI phase activation strategy
- **Files to Update**:
  - `CI_CD_TDD_ENFORCEMENT.md`
  - Phase README files

## Agent Assignment Summary

| Agent                           | Primary Issues | Support Issues     | Priority |
| ------------------------------- | -------------- | ------------------ | -------- |
| typescript-react-quality-expert | 1, 3, 4        | 11                 | HIGHEST  |
| pwa-performance-optimizer       | 2              | 13                 | HIGHEST  |
| security-compliance-auditor     | 5              | 12                 | HIGHEST  |
| context-manager                 | 6, 7           | All (coordination) | HIGH     |
| postgres-serverless-architect   | 8              | -                  | HIGH     |
| vercel-resort-api-architect     | 9              | -                  | HIGH     |
| resort-ui-designer              | 10             | -                  | HIGH     |
| vercel-deployment-optimizer     | 14             | -                  | MEDIUM   |

## Resolution Timeline

### Phase 1: Immediate (Before any code)

- Issues 1-5 (Highest Priority blockers)
- Must complete before Phase 1 RED

### Phase 2: Pre-RED (Before writing tests)

- Issues 6-10 (High Priority consistency)
- Complete before Phase 1 RED tests

### Phase 3: During GREEN (Quality improvements)

- Issues 11-14 (Medium Priority DevEx)
- Can be done during Phase 1 GREEN

## Verification Checklist

### After Highest Priority Fixes ✅

- ✅ `npm run test:coverage` runs without path-based threshold errors (Issue 1
  resolved)
- ✅ All lighthouse scripts use local devDependency (Issue 2 resolved)
- ✅ `npm run verify:all` executes successfully (Issue 3 resolved)
- ✅ Tests run with deterministic time/seed (Issue 4 resolved)
- ✅ Security scripts work on Windows (Issue 5 resolved)

### After High Priority Fixes ✅

- ✅ No duplicate documentation topics (Issue 6 resolved)
- ✅ All document references resolve (Issue 7 resolved)
- ✅ Phase 3 database scope is clear (Issue 8 resolved)
- ✅ Scaffolding works cross-platform (Issue 9 resolved)
- ✅ Accessibility patterns documented (Issue 10 resolved)

### After Medium Priority Fixes ✅

- ✅ tsconfig verification is robust (Issue 11 resolved)
- ✅ JWT naming is consistent (Issue 12 resolved)
- ✅ Bundlesize matches build output (Issue 13 resolved)
- ✅ CI handles empty phases correctly (Issue 14 resolved)

## Notes

- This tracker is the authoritative source for issue resolution status
- Update status immediately when issues are resolved
- All changes must maintain backward compatibility
- Documentation fixes only - no implementation changes until Phase 1 RED

---

_Last Updated: August 31, 2025_ _Tracker Version: 1.1.0_ _Status: ✅ ALL 14
ISSUES RESOLVED_
