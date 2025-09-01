# Phase 0 Infrastructure Preservation Reference

## Preservation Strategy

**Backup Branch**: `backup/pre-phase0-cleanup-2025-09-01`  
**Created**: September 1, 2025  
**Purpose**: Complete repository snapshot before Phase 0 cleanup

## How to Access Preserved State

```bash
# View preserved code without switching branches
git show backup/pre-phase0-cleanup-2025-09-01:src/lib/security/secure-token-manager.ts

# Compare current state with preserved state
git diff backup/pre-phase0-cleanup-2025-09-01 HEAD -- src/stores/

# Restore specific files if needed
git checkout backup/pre-phase0-cleanup-2025-09-01 -- src/lib/security/

# Full rollback if necessary
git checkout backup/pre-phase0-cleanup-2025-09-01
```

## Preserved Infrastructure Components

The following components are preserved in the backup branch and MUST NOT be
deleted during cleanup:

### ✅ Security Infrastructure

- **Path**: `src/lib/security/`
- **Critical Files**: secure-token-manager.ts, session-monitor.ts,
  rate-limiter.ts
- **Test Coverage**: 95%
- **Why Preserved**: Core authentication and security features

### ✅ State Management

- **Path**: `src/stores/`
- **Critical Files**: authStore.ts, bookingStore.ts, projectStore.ts,
  expenseStore.ts
- **Test Coverage**: 88%
- **Why Preserved**: Business logic and state management

### ✅ API Infrastructure

- **Path**: `src/lib/api-client.ts`, `api/`
- **Critical Files**: api-client.ts, API route templates
- **Test Coverage**: 92%
- **Why Preserved**: Network layer with retry logic

### ✅ Database Layer

- **Path**: `src/lib/db/`, `migrations/`
- **Critical Files**: Schema definitions, migration files
- **Test Coverage**: 87%
- **Why Preserved**: Database utilities and migrations

### ✅ Type Definitions

- **Path**: `src/types/`
- **Critical Files**: All TypeScript type definitions
- **Why Preserved**: Type safety across application

## Components Safe to Remove

During Sub-Phase 0.3, these can be safely removed:

- ❌ `src/pages/` - All page components
- ❌ `src/layouts/` - Layout components
- ❌ `src/routes/` - Route implementations
- ❌ `src/components/` - EXCEPT keep `/ui` and `/auth` subdirectories

## Protection Mechanism

To prevent accidental deletion of preserved infrastructure during cleanup:

1. **Always check before deletion**:

   ```bash
   # Before removing any directory, verify it's not preserved
   ls -la src/lib/  # Check what's in lib before any lib deletions
   ```

2. **Use targeted removal**:

   ```bash
   # Good - Specific removal
   rm -rf src/pages/

   # Bad - Too broad
   rm -rf src/
   ```

3. **Verify after each removal**:
   ```bash
   npm run type-check  # Ensure no broken imports
   npm test           # Ensure tests still pass
   ```

## Emergency Rollback

If something goes wrong during cleanup:

```bash
# Quick rollback to preserved state
git reset --hard backup/pre-phase0-cleanup-2025-09-01

# Or selective restoration
git checkout backup/pre-phase0-cleanup-2025-09-01 -- src/stores/authStore.ts
```

## Validation Commands

Run these after any cleanup operation:

```bash
# Verify TypeScript compilation
npm run type-check

# Verify build
npm run build

# Run critical tests
npm test src/stores
npm test src/lib/security
```

---

_The backup branch serves as the authoritative preservation mechanism._  
_No file duplication needed - Git already provides perfect snapshots._
