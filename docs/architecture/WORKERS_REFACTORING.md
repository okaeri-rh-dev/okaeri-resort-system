# Cloudflare Workers Architecture Refactoring Plan

## Problem Statement

Integration tests (22 tests) and property-based tests (4 tests) fail because Cloudflare Workers Functions (`functions/`) import Vite-compiled frontend code (`src/`) which uses `import.meta.env`.

### Error Example

```
Uncaught TypeError: Cannot read properties of undefined (reading 'VITE_SUPABASE_URL')
    at ../src/lib/supabase.ts:18518:35
    at ../src/lib/audit-roles.ts:19049:5
    at ../src/lib/audit-logger.ts:19126:5
    at api/admin/assign-units.ts:19440:5
```

### Root Cause

- `import.meta.env` is a Vite-specific API available only in browser/Vite build context
- Cloudflare Workers runtime doesn't support `import.meta`
- Workers Functions directly import from `src/` (e.g., `import { supabase } from "@/lib/supabase"`)
- This creates a hard dependency on Vite compilation that doesn't exist in Workers

## Affected Files

### Critical Dependencies

1. `src/lib/supabase.ts` - Creates Supabase client using `import.meta.env.VITE_SUPABASE_URL`
2. `src/lib/audit-constants.ts` - Reads `import.meta.env.VITE_AUDIT_DEBUG`
3. `src/lib/audit-roles.ts` - Imports supabase client
4. `src/lib/audit-logger.ts` - Imports audit roles

### Workers Importing These

- `functions/api/admin/assign-units.ts`
- `functions/api/admin/verify-payment.ts`
- `functions/api/guest-booking.ts`
- All other `functions/api/**/*.ts` files

## Solution Options

### Option A: Environment Variable Compatibility Layer (Recommended)

**Approach**: Create a shared utilities layer that works in both Vite and Workers contexts.

**Implementation**:

1. Create `src/lib/env.ts`:

```typescript
/**
 * Environment variable access compatible with both Vite and Cloudflare Workers
 */

// Type for environment variables
export interface Env {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  VITE_AUDIT_DEBUG?: string;
  // ... other env vars
}

/**
 * Get environment variable - works in both Vite (import.meta.env) and Workers (globalThis)
 */
export function getEnv(key: keyof Env): string | undefined {
  // Browser/Vite context
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[key];
  }

  // Node.js/Workers context
  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }

  // Workers globalThis context (if env is passed via context)
  if (typeof globalThis !== "undefined" && (globalThis as any).env) {
    return (globalThis as any).env[key];
  }

  return undefined;
}

export function requireEnv(key: keyof Env): string {
  const value = getEnv(key);
  if (!value) {
    throw new Error(`Required environment variable ${key} is not defined`);
  }
  return value;
}
```

2. Update `src/lib/supabase.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

import { requireEnv } from "./env";

export const supabase = createClient(
  requireEnv("VITE_SUPABASE_URL"),
  requireEnv("VITE_SUPABASE_ANON_KEY")
);
```

3. Update `src/lib/audit-constants.ts`:

```typescript
import { getEnv } from "./env";

export const AUDIT_DEBUG = getEnv("VITE_AUDIT_DEBUG") === "true";
```

**Pros**:

- Minimal code changes
- Works in all contexts (Vite, Workers, Node.js)
- Type-safe with Env interface
- Centralized environment access

**Cons**:

- Still requires passing environment variables to Workers
- Doesn't prevent future `import.meta` usage

---

### Option B: Separate Worker Utilities (Clean Separation)

**Approach**: Create a separate `functions/lib/` directory with Worker-specific implementations.

**Implementation**:

1. Create `functions/lib/supabase-worker.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

// Workers receive env via context parameter, not import.meta
export function createWorkerSupabaseClient(env: Env) {
  return createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
}

export function createWorkerSupabaseAdmin(env: Env) {
  return createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}
```

2. Create `functions/lib/audit-logger-worker.ts`:

```typescript
// Worker-specific audit logger
export async function logAuditEventWorker(env: Env, event: AuditEvent): Promise<void> {
  const supabase = createWorkerSupabaseAdmin(env);
  // ... audit logging logic
}
```

3. Update Workers to use Worker-specific utilities:

```typescript
// functions/api/admin/assign-units.ts
import { logAuditEventWorker } from "../lib/audit-logger-worker";
import { createWorkerSupabaseAdmin } from "../lib/supabase-worker";

export async function onRequestPost(context) {
  const { env } = context;
  const supabase = createWorkerSupabaseAdmin(env);
  // ... use worker-specific utilities
}
```

**Pros**:

- Clean separation between frontend and backend code
- No risk of accidentally importing Vite-specific code
- Easier to maintain separate concerns
- Workers don't depend on frontend build

**Cons**:

- Code duplication (shared logic needs to be in both places)
- More files to maintain
- Refactoring required for all Workers functions

---

### Option C: Build-Time Variable Replacement

**Approach**: Use esbuild/Vite plugins to replace `import.meta.env` with `process.env` at build time.

**Implementation**:

1. Add Vite plugin for Workers build:

```typescript
// vite.config.workers.ts
import { defineConfig } from "vite";
import { replaceImportMeta } from "vite-plugin-replace-import-meta";

export default defineConfig({
  plugins: [
    replaceImportMeta({
      "import.meta.env": "process.env",
    }),
  ],
});
```

2. Update Workers build script in `package.json`:

```json
{
  "scripts": {
    "build:workers": "vite build --config vite.config.workers.ts"
  }
}
```

**Pros**:

- Minimal code changes
- Automatic transformation
- Works with existing imports

**Cons**:

- Adds build complexity
- Harder to debug (transformed code)
- Still requires Workers to receive env vars differently than Vite
- Band-aid solution that doesn't address root cause

---

## Recommended Approach

**Use Option A (Environment Compatibility Layer) as initial fix**, then migrate to **Option B (Separate Worker Utilities)** for long-term maintainability.

### Phase 1: Quick Fix (Option A)

1. Create `src/lib/env.ts` with compatibility layer
2. Update `src/lib/supabase.ts`, `src/lib/audit-constants.ts` to use `getEnv()`
3. Run integration tests to verify fix
4. **Estimated Time**: 2-3 hours

### Phase 2: Long-Term Refactoring (Option B)

1. Create `functions/lib/` directory structure
2. Extract shared business logic into `src/lib/shared/`
3. Create Worker-specific wrappers in `functions/lib/`
4. Update all Workers to use Worker-specific utilities
5. Remove frontend-specific imports from Workers
6. **Estimated Time**: 1-2 days

## Testing Strategy

### Integration Tests

- 18 tests in `__tests__/integration/`
- Require Workers running at `localhost:8788`
- Need proper environment variable configuration

### Property-Based Tests

- 4 tests in `__tests__/properties/pricing-properties.test.ts`
- Test pricing calculations via Workers API
- Require database seeding (pricing_config table)

### Test Environment Setup

Create `.env.test` with:

```bash
# Local Supabase
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<local_service_key>

# Workers API
VITE_API_URL=http://localhost:8788

# Optional debug flags
VITE_AUDIT_DEBUG=false
```

## Success Criteria

- [ ] All 22 integration tests passing
- [ ] All 4 property-based tests passing
- [ ] Workers can import from `src/lib/` without errors
- [ ] No `import.meta` references in Workers runtime
- [ ] Environment variables accessible in both Vite and Workers contexts
- [ ] Test suite runs without manual Workers startup

## Related Issues

- Test infrastructure documented in `src/test/integration-setup.ts`
- Workers setup attempts to start via Wrangler in tests
- Current blocker: Workers fail during startup due to `import.meta.env`

## Future Considerations

1. **Environment Variable Management**: Use a centralized Env type for type safety
2. **Shared Business Logic**: Extract to `src/lib/shared/` for reuse
3. **Workers Testing**: Consider using Miniflare for faster test runs
4. **Build Process**: Document Workers build separately from frontend build

---

**Last Updated**: 2025-10-29
**Status**: ⚠️ Blocking 26 tests (22 integration + 4 property-based)
