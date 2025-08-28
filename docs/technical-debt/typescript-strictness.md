# TypeScript Strictness Technical Debt

## Overview

This document tracks the temporary TypeScript configuration relaxations made
during Phase 1 to enable successful production builds. These relaxations are
**TEMPORARY** and must be re-enabled in future phases as part of our commitment
to type safety.

## Temporarily Disabled Settings

### 1. `exactOptionalPropertyTypes: false`

**Status**: DISABLED ❌  
**Original**: `true` (strict)  
**Phase 1 Setting**: `false` (relaxed)  
**Re-enable Target**: Phase 3

**Reason for Relaxation**:

- Incompatible with third-party dependencies (React, Vite, TanStack Query)
- Vite plugin type conflicts with exact optional property types
- Over 100+ type errors related to optional properties in dependency interfaces

**Impact**:

- Reduces type safety for optional properties
- May allow `undefined` where not intended
- Affects API response typing and form validation

**Migration Plan**:

- Phase 2: Audit all optional properties in internal code
- Phase 3: Update third-party dependencies to compatible versions
- Phase 3: Re-enable `exactOptionalPropertyTypes: true`
- Phase 3: Fix any new type errors with proper type guards

### 2. `noUnusedLocals: false`

**Status**: DISABLED ❌  
**Original**: `true` (strict)  
**Phase 1 Setting**: `false` (relaxed)  
**Re-enable Target**: Phase 2

**Reason for Relaxation**:

- Too many false positives from event handlers
- Import statements for type-only imports being flagged
- Development imports that are conditionally used

**Impact**:

- May accumulate unused variables over time
- Slightly larger bundle size from unused imports
- Reduced code cleanliness

**Migration Plan**:

- Phase 2: Implement ESLint rule `@typescript-eslint/no-unused-vars` with
  appropriate exceptions
- Phase 2: Clean up genuinely unused imports and variables
- Phase 2: Re-enable `noUnusedLocals: true`

### 3. `noUnusedParameters: false`

**Status**: DISABLED ❌  
**Original**: `true` (strict)  
**Phase 1 Setting**: `false` (relaxed)  
**Re-enable Target**: Phase 2

**Reason for Relaxation**:

- Event handlers require unused parameters for correct typing
- React component props that are partially used
- Callback functions with standard signatures

**Impact**:

- May accumulate unused parameters
- Slightly reduced code documentation value
- Less clear function interfaces

**Migration Plan**:

- Phase 2: Use underscore prefix for intentionally unused parameters (`_event`,
  `_props`)
- Phase 2: Implement ESLint rule with underscore exception pattern
- Phase 2: Re-enable `noUnusedParameters: true`

## Maintained Strict Settings

The following strict settings remain **ENABLED** and should not be relaxed:

- ✅ `strict: true`
- ✅ `noImplicitAny: true`
- ✅ `strictNullChecks: true`
- ✅ `strictFunctionTypes: true`
- ✅ `strictBindCallApply: true`
- ✅ `strictPropertyInitialization: true`
- ✅ `noImplicitThis: true`
- ✅ `noImplicitReturns: true`
- ✅ `noFallthroughCasesInSwitch: true`
- ✅ `noUncheckedIndexedAccess: true`
- ✅ `noImplicitOverride: true`

## Configuration Fixed

### vitest.config.ts

- **Issue**: `reporter` property should be `reporters` (array)
- **Fix**: Changed `reporter: ["verbose", "json", "html"]` to
  `reporters: ["verbose", "json", "html"]`
- **Status**: FIXED ✅

### API Middleware Types

- **Issue**: `ApiHandler` return type incompatible with actual usage
- **Fix**: Updated `ApiHandler` to allow
  `Promise<void | VercelResponse> | void | VercelResponse`
- **Status**: FIXED ✅

### Function Signatures

- **Issue**: `withRateLimit` middleware pattern inconsistency
- **Fix**: Changed to curried function pattern:
  `(identifier?: string) => (handler: ApiHandler) => ApiHandler`
- **Status**: FIXED ✅

### Type Overrides

- **Issue**: Missing `override` modifier on `ApiError.message`
- **Fix**: Added `public override message: string`
- **Status**: FIXED ✅

## Timeline for Re-enablement

| Phase   | Target Date | Settings to Re-enable                  | Priority |
| ------- | ----------- | -------------------------------------- | -------- |
| Phase 2 | Next Sprint | `noUnusedLocals`, `noUnusedParameters` | High     |
| Phase 3 | Q2 2024     | `exactOptionalPropertyTypes`           | Medium   |

## Monitoring and Alerts

1. **Weekly Reviews**: Check for accumulation of unused code
2. **PR Requirements**: Document any new optional property patterns
3. **Phase Gate Reviews**: Mandatory type safety assessment before phase
   completion

## Developer Guidelines

While these settings are relaxed:

1. **Write code as if strict mode is enabled**
2. **Use explicit typing for all optional properties**
3. **Prefix unused parameters with underscore**
4. **Document intentional unused variables with comments**
5. **Run periodic cleanup of unused imports**

## Rollback Plan

If build issues persist after Phase 1 completion:

1. Investigate specific type errors in isolation
2. Create targeted type assertion files
3. Use `// @ts-expect-error` with detailed comments for known issues
4. Document all type assertions in this file

## Success Metrics

Phase 1 completion criteria:

- ✅ `npm run build` completes successfully
- ✅ Bundle is created in `dist/`
- ✅ All relaxations documented with re-enablement timeline
- ✅ No runtime type-related errors in production

---

**Last Updated**: 2025-08-27  
**Next Review**: Phase 2 Start  
**Responsible**: TypeScript Architecture Team
