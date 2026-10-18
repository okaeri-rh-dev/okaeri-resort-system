# Audit Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anonymize audit rows older than 24 months in place, weekly, so guest and staff personal data does not outlive its purpose (RA 10173).

**Architecture:** A service-role-only SQL function clears personal columns on old rows in `audit_logs` and `audit_logs_archive` and stamps `metadata.anonymized_at`. A `CRON_SECRET`-protected Pages endpoint calls it, and the existing GitHub Actions cleanup workflow schedules it weekly (restoring the payment-proof schedule in the same slot). The audit UI reads the marker to label anonymized rows.

**Tech Stack:** Postgres (Supabase migrations), Cloudflare Pages Functions (TypeScript), GitHub Actions, React + Vitest + Testing Library.

Spec: `docs/plans/2026-10-18-audit-retention-design.md`. Branch: `feat/audit-retention`.

## Global Constraints

- Window: `interval '24 months'`, the default of `p_older_than`.
- Keep-list (tables whose `old_data`/`new_data`/`description` survive): `units`, `pricing_config`, `schema_migrations`, `maintenance_logs`.
- Cleared on every qualifying row: `user_email`, `ip_address`, `user_agent`. Cleared outside the keep-list: `old_data`, `new_data`, `description`. Kept always: `action`, `table_name`, `record_id`, `record_pk`, `user_id`, `user_role`, `changed_fields`, `category`, `severity`, `created_at`, `audit_id`, `correlation_id`, `event_type`, `source`.
- Marker: anonymized rows carry `metadata.anonymized_at` (ISO timestamp). Outside the keep-list `metadata` becomes exactly `{"anonymized_at": ...}`; on keep-list rows the key is merged into the existing metadata.
- Size alert threshold: 50 MB (`52428800` bytes) of `pg_total_relation_size('public.audit_logs')`.
- SQL functions: `SECURITY DEFINER`, `SET search_path = ''`, EXECUTE only for `service_role`.
- DB tests take "now" from Postgres: `src/test/setup.ts` pins `Date.now()` to 2025-09-25.
- UI copy: "Staff (details removed)", "Details removed after the retention period".
- No front-desk/hotel terminology in copy (project memory).
- Run `npm run verify` before every commit that touches TypeScript; `npm run test:db` needs `supabase start`.

---

### Task 1: `anonymize_audit_logs` SQL function

**Files:**

- Create: `src/__tests__/setup/psql.ts`
- Create: `src/__tests__/database/audit-anonymization.test.ts`
- Create: `supabase/migrations/20261018000000_anonymize_audit_logs.sql`
- Modify: `src/types/database.generated.ts` (regenerated)

**Interfaces:**

- Produces: `public.anonymize_audit_logs(p_older_than interval DEFAULT '24 months') RETURNS TABLE(anonymized_count bigint, audit_logs_bytes bigint)`; RPC type `Database["public"]["Functions"]["anonymize_audit_logs"]` with `Returns: { anonymized_count: number; audit_logs_bytes: number }[]`.
- Produces: `psqlAvailable(): boolean` and `runPsql(sql: string): string[]` from `src/__tests__/setup/psql.ts`.

- [x] **Step 1: Add the shared psql helper**

`src/__tests__/setup/psql.ts`:

```ts
import { execFileSync } from "node:child_process";

const PG_PASSWORD = process.env.PGPASSWORD ?? "postgres";

export function psqlAvailable(): boolean {
  try {
    execFileSync("psql", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Runs SQL as the local postgres superuser; returns non-empty output lines (-tA format). */
export function runPsql(sql: string): string[] {
  const output = execFileSync(
    "psql",
    [
      "-h",
      "127.0.0.1",
      "-p",
      "54322",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-tA",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: sql, env: { ...process.env, PGPASSWORD: PG_PASSWORD }, encoding: "utf8" }
  );
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
```

- [x] **Step 2: Write the failing DB test**

`src/__tests__/database/audit-anonymization.test.ts`:

```ts
/**
 * Audit rows older than 24 months lose their personal data (RA 10173 retention).
 * Actor columns are cleared on every row; data columns everywhere except a keep-list
 * of tables without personal data. Anonymized rows carry metadata.anonymized_at.
 *
 * Requires a local Supabase (supabase start). Runs in the DB suite / infra-health.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { psqlAvailable, runPsql } from "../setup/psql";
import { testSupabaseAdmin as admin, shouldRunDatabaseTests } from "../setup/test-db";

const PROBE = "anon-probe";

type ProbeRow = {
  record_id: string;
  user_email: string | null;
  ip_address: unknown;
  user_agent: string | null;
  old_data: unknown;
  new_data: unknown;
  description: string | null;
  metadata: Record<string, unknown> | null;
  user_id: string | null;
  changed_fields: string[] | null;
};

function insertProbe(
  table: "audit_logs" | "audit_logs_archive",
  recordId: string,
  tableName: string,
  age: string
) {
  runPsql(`
    INSERT INTO public.${table} (audit_id, action, source, table_name, record_id, user_id, user_email,
      ip_address, user_agent, old_data, new_data, description, metadata, changed_fields, created_at)
    VALUES (gen_random_uuid(), 'UPDATE', 'db', '${tableName}', '${PROBE}-${recordId}',
      '00000000-0000-0000-0000-00000000a0a0', 'staff@example.com', '10.0.0.1', 'probe-agent',
      '{"email":"old@example.com"}', '{"email":"new@example.com"}', 'changed guest@example.com',
      '{"ip":"10.0.0.1"}', ARRAY['email'], now() - interval '${age}');
  `);
}

async function probe(
  table: "audit_logs" | "audit_logs_archive",
  recordId: string
): Promise<ProbeRow> {
  const { data, error } = await admin
    .from(table)
    .select(
      "record_id, user_email, ip_address, user_agent, old_data, new_data, description, metadata, user_id, changed_fields"
    )
    .eq("record_id", `${PROBE}-${recordId}`)
    .single();
  if (error || !data) throw new Error(`probe ${recordId} missing: ${error?.message}`);
  return data as ProbeRow;
}

describe("anonymize_audit_logs", () => {
  let canRun = false;

  beforeAll(async () => {
    canRun = (await shouldRunDatabaseTests()) && psqlAvailable();
    if (!canRun) {
      console.log("⏭️  Skipping audit anonymization tests — database or psql unavailable");
      return;
    }
    runPsql(`
      DELETE FROM public.audit_logs WHERE record_id LIKE '${PROBE}-%';
      DELETE FROM public.audit_logs_archive WHERE record_id LIKE '${PROBE}-%';
    `);
    insertProbe("audit_logs", "guest-old", "guests", "25 months");
    insertProbe("audit_logs", "guest-recent", "guests", "23 months");
    insertProbe("audit_logs", "unit-old", "units", "25 months");
    insertProbe("audit_logs", "legacy-old", "auth_events", "25 months");
    insertProbe("audit_logs_archive", "archived-old", "bookings", "25 months");
  });

  afterAll(() => {
    if (!canRun) return;
    runPsql(`
      DELETE FROM public.audit_logs WHERE record_id LIKE '${PROBE}-%';
      DELETE FROM public.audit_logs_archive WHERE record_id LIKE '${PROBE}-%';
    `);
  });

  it("only the service role can execute it", () => {
    if (!canRun) return;
    const fn = "public.anonymize_audit_logs(interval)";
    expect(
      runPsql(`
        SELECT has_function_privilege('anon', '${fn}', 'EXECUTE'),
               has_function_privilege('authenticated', '${fn}', 'EXECUTE'),
               has_function_privilege('service_role', '${fn}', 'EXECUTE');
      `)
    ).toEqual(["f|f|t"]);
  });

  it("anonymizes old rows, keeps recent ones, and is idempotent", async () => {
    if (!canRun) return;
    const { data: first, error } = await admin.rpc("anonymize_audit_logs");
    expect(error).toBeNull();
    expect(first?.[0]?.anonymized_count).toBeGreaterThanOrEqual(4);
    expect(first?.[0]?.audit_logs_bytes).toBeGreaterThan(0);

    const guestOld = await probe("audit_logs", "guest-old");
    expect(guestOld).toMatchObject({
      user_email: null,
      ip_address: null,
      user_agent: null,
      old_data: null,
      new_data: null,
      description: null,
      user_id: "00000000-0000-0000-0000-00000000a0a0",
      changed_fields: ["email"],
    });
    expect(Object.keys(guestOld.metadata ?? {})).toEqual(["anonymized_at"]);

    const guestRecent = await probe("audit_logs", "guest-recent");
    expect(guestRecent).toMatchObject({
      user_email: "staff@example.com",
      old_data: { email: "old@example.com" },
      metadata: { ip: "10.0.0.1" },
    });

    const unitOld = await probe("audit_logs", "unit-old");
    expect(unitOld).toMatchObject({
      user_email: null,
      ip_address: null,
      user_agent: null,
      old_data: { email: "old@example.com" },
      new_data: { email: "new@example.com" },
      description: "changed guest@example.com",
    });
    expect(unitOld.metadata).toMatchObject({ ip: "10.0.0.1", anonymized_at: expect.any(String) });

    const legacyOld = await probe("audit_logs", "legacy-old");
    expect(legacyOld).toMatchObject({ user_email: null, old_data: null, description: null });

    const archivedOld = await probe("audit_logs_archive", "archived-old");
    expect(archivedOld).toMatchObject({ user_email: null, old_data: null, new_data: null });

    const { data: second } = await admin.rpc("anonymize_audit_logs");
    expect(second?.[0]?.anonymized_count).toBe(0);
  });
});
```

- [x] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/database/audit-anonymization.test.ts`
Expected: both tests FAIL (`function public.anonymize_audit_logs(interval) does not exist` from psql, and `Could not find the function public.anonymize_audit_logs` from PostgREST). If tests are skipped instead, run `supabase start` first.

- [x] **Step 4: Write the migration**

`supabase/migrations/20261018000000_anonymize_audit_logs.sql`:

```sql
-- Audit retention (RA 10173): rows older than the window lose their personal data.
-- Actor columns are cleared on every row; data columns are cleared on every table
-- except a keep-list of tables without personal data, so legacy and future
-- table names are anonymized by default. Kept: who (user_id, user_role), what
-- (action, table_name, record_id, changed_fields) and when. Anonymized rows carry
-- metadata.anonymized_at, which the UI reads and which makes re-runs no-ops.

CREATE OR REPLACE FUNCTION public.anonymize_audit_logs(p_older_than interval DEFAULT interval '24 months')
RETURNS TABLE(anonymized_count bigint, audit_logs_bytes bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_cutoff timestamptz := now() - p_older_than;
    v_keep_tables text[] := ARRAY['units', 'pricing_config', 'schema_migrations', 'maintenance_logs'];
    v_marker jsonb := jsonb_build_object('anonymized_at', now());
    v_live_count bigint;
    v_archived_count bigint;
BEGIN
    UPDATE public.audit_logs a
    SET user_email = NULL,
        ip_address = NULL,
        user_agent = NULL,
        old_data = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.old_data END,
        new_data = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.new_data END,
        description = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.description END,
        metadata = CASE
            WHEN a.table_name = ANY (v_keep_tables) THEN COALESCE(a.metadata, '{}'::jsonb) || v_marker
            ELSE v_marker
        END
    WHERE a.created_at < v_cutoff
      AND NOT COALESCE(a.metadata ? 'anonymized_at', false);
    GET DIAGNOSTICS v_live_count = ROW_COUNT;

    UPDATE public.audit_logs_archive a
    SET user_email = NULL,
        ip_address = NULL,
        user_agent = NULL,
        old_data = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.old_data END,
        new_data = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.new_data END,
        description = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.description END,
        metadata = CASE
            WHEN a.table_name = ANY (v_keep_tables) THEN COALESCE(a.metadata, '{}'::jsonb) || v_marker
            ELSE v_marker
        END
    WHERE a.created_at < v_cutoff
      AND NOT COALESCE(a.metadata ? 'anonymized_at', false);
    GET DIAGNOSTICS v_archived_count = ROW_COUNT;

    RETURN QUERY SELECT v_live_count + v_archived_count, pg_total_relation_size('public.audit_logs');
END;
$$;

REVOKE ALL ON FUNCTION public.anonymize_audit_logs(interval) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_audit_logs(interval) TO service_role;
```

- [x] **Step 5: Apply it and run the test to verify it passes**

Run: `supabase migration up --local && npx vitest run src/__tests__/database/audit-anonymization.test.ts`
Expected: `Tests  2 passed (2)`.

- [x] **Step 6: Regenerate types and lint**

Run: `npm run gen:types && git diff --stat src/types && supabase db lint --local 2>/dev/null | jq '[.results[].issues[] | select(.level == "error")] | length'`
Expected: `database.generated.ts` gains an `anonymize_audit_logs` entry; the lint prints `0`.

- [x] **Step 7: Commit**

```bash
git add src/__tests__/setup/psql.ts src/__tests__/database/audit-anonymization.test.ts supabase/migrations/20261018000000_anonymize_audit_logs.sql src/types/database.generated.ts
git commit -m "feat(db): anonymize audit rows older than 24 months"
```

---

### Task 2: Shared cron auth

**Files:**

- Create: `functions/lib/cron-auth.ts`
- Create: `src/__tests__/api/cron-auth.test.ts`
- Modify: `functions/api/cron/cleanup-idempotency.ts:13-48` (delete local `verifyAuth`, import the shared one)
- Modify: `functions/api/cron/cleanup-payment-proofs.ts:13-48` (same)

**Interfaces:**

- Produces: `verifyCronAuth(request: Request, cronSecret: string | undefined): { valid: boolean; error?: string }` from `functions/lib/cron-auth.ts`. Error strings, unchanged from the current copies: `"Missing Authorization header"`, `"Invalid Authorization format. Expected: Bearer <token>"`, `"Server configuration error"`, `"Invalid token"`.

- [x] **Step 1: Write the failing test**

`src/__tests__/api/cron-auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { verifyCronAuth } from "../../../functions/lib/cron-auth";

const requestWith = (authorization?: string) =>
  new Request("https://example.com/api/cron/x", {
    method: "POST",
    headers: authorization ? { Authorization: authorization } : {},
  });

describe("verifyCronAuth", () => {
  it("rejects a missing header", () => {
    expect(verifyCronAuth(requestWith(), "secret")).toEqual({
      valid: false,
      error: "Missing Authorization header",
    });
  });

  it("rejects a non-Bearer header", () => {
    expect(verifyCronAuth(requestWith("Basic abc"), "secret").valid).toBe(false);
  });

  it("rejects when the secret is not configured", () => {
    expect(verifyCronAuth(requestWith("Bearer secret"), undefined)).toEqual({
      valid: false,
      error: "Server configuration error",
    });
  });

  it("rejects a wrong token", () => {
    expect(verifyCronAuth(requestWith("Bearer nope"), "secret")).toEqual({
      valid: false,
      error: "Invalid token",
    });
  });

  it("accepts the configured token", () => {
    expect(verifyCronAuth(requestWith("Bearer secret"), "secret")).toEqual({ valid: true });
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/api/cron-auth.test.ts`
Expected: FAIL, `Failed to resolve import "../../../functions/lib/cron-auth"`.

- [x] **Step 3: Implement the helper**

`functions/lib/cron-auth.ts`:

```ts
/** Checks the `Authorization: Bearer <CRON_SECRET>` header the cleanup workflow sends. */
export function verifyCronAuth(
  request: Request,
  cronSecret: string | undefined
): { valid: boolean; error?: string } {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return { valid: false, error: "Missing Authorization header" };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Invalid Authorization format. Expected: Bearer <token>" };
  }

  if (!cronSecret) {
    console.error("[CRON] CRON_SECRET environment variable not configured");
    return { valid: false, error: "Server configuration error" };
  }

  if (authHeader.substring(7) !== cronSecret) {
    return { valid: false, error: "Invalid token" };
  }

  return { valid: true };
}
```

- [x] **Step 4: Use it in both existing endpoints**

In `functions/api/cron/cleanup-idempotency.ts` and `functions/api/cron/cleanup-payment-proofs.ts`: delete the `/** Verify the request has a valid CRON_SECRET Bearer token */` doc comment and the whole `function verifyAuth(...) { ... }`; add `import { verifyCronAuth } from "../../lib/cron-auth";` below the existing scheduled-module import; replace `const auth = verifyAuth(request, env);` with:

```ts
const auth = verifyCronAuth(request, env.CRON_SECRET);
```

- [x] **Step 5: Run the tests and type-check**

Run: `npx vitest run src/__tests__/api/cron-auth.test.ts src/__tests__/api/cleanup-payment-proofs.test.ts && npx tsc --noEmit -p functions/tsconfig.json`
Expected: `Tests  7 passed (7)`; tsc exits 0 with no output.

- [x] **Step 6: Commit**

```bash
git add functions/lib/cron-auth.ts src/__tests__/api/cron-auth.test.ts functions/api/cron/cleanup-idempotency.ts functions/api/cron/cleanup-payment-proofs.ts
git commit -m "refactor(api): share CRON_SECRET verification across cron endpoints"
```

---

### Task 3: Anonymize-audit job and endpoint

**Files:**

- Create: `functions/scheduled/anonymize-audit.ts`
- Create: `functions/api/cron/anonymize-audit.ts`
- Create: `src/__tests__/api/anonymize-audit.test.ts`

**Interfaces:**

- Consumes: RPC `anonymize_audit_logs` (Task 1), `verifyCronAuth` (Task 2), `createLogger(env)` from `functions/lib/logger.ts`.
- Produces: `anonymizeAuditLogs(env: { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string; ENVIRONMENT?: string }): Promise<{ anonymizedCount: number; auditLogsBytes: number }>`; `POST /api/cron/anonymize-audit` returning `{ success, anonymized_count, audit_logs_bytes, duration_ms, timestamp }` (200) or `{ success: false, error, message }` (401/500).

- [x] **Step 1: Write the failing test**

`src/__tests__/api/anonymize-audit.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onRequestPost } from "../../../functions/api/cron/anonymize-audit";
import { anonymizeAuditLogs } from "../../../functions/scheduled/anonymize-audit";

const rpc = vi.fn();
const warn = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ rpc })),
}));

vi.mock("../../../functions/lib/logger", () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn, error: vi.fn(), debug: vi.fn() })),
}));

const env = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-key",
  CRON_SECRET: "secret",
};

const post = (authorization?: string) =>
  onRequestPost({
    request: new Request("https://example.com/api/cron/anonymize-audit", {
      method: "POST",
      headers: authorization ? { Authorization: authorization } : {},
    }),
    env,
  });

describe("anonymizeAuditLogs", () => {
  beforeEach(() => {
    rpc.mockReset();
    warn.mockReset();
  });

  it("returns the count and table size from the SQL function", async () => {
    rpc.mockResolvedValue({
      data: [{ anonymized_count: 12, audit_logs_bytes: 3_432_448 }],
      error: null,
    });

    await expect(anonymizeAuditLogs(env)).resolves.toEqual({
      anonymizedCount: 12,
      auditLogsBytes: 3_432_448,
    });
    expect(rpc).toHaveBeenCalledWith("anonymize_audit_logs");
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns when audit_logs passes 50 MB", async () => {
    rpc.mockResolvedValue({
      data: [{ anonymized_count: 0, audit_logs_bytes: 60 * 1024 * 1024 }],
      error: null,
    });

    await anonymizeAuditLogs(env);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("50 MB"));
  });

  it("throws on a database error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(anonymizeAuditLogs(env)).rejects.toThrow("Database error: boom");
  });
});

describe("POST /api/cron/anonymize-audit", () => {
  beforeEach(() => rpc.mockReset());

  it("rejects requests without the cron secret", async () => {
    const response = await post();
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns the job result", async () => {
    rpc.mockResolvedValue({
      data: [{ anonymized_count: 3, audit_logs_bytes: 1024 }],
      error: null,
    });

    const response = await post("Bearer secret");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      anonymized_count: 3,
      audit_logs_bytes: 1024,
    });
  });

  it("returns 500 when the job fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const response = await post("Bearer secret");

    expect(response.status).toBe(500);
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/api/anonymize-audit.test.ts`
Expected: FAIL, `Failed to resolve import "../../../functions/api/cron/anonymize-audit"`.

- [x] **Step 3: Implement the job**

`functions/scheduled/anonymize-audit.ts`:

```ts
/**
 * Audit retention (RA 10173): anonymizes audit rows older than 24 months.
 * The rules live in the anonymize_audit_logs SQL function; see
 * docs/plans/2026-10-18-audit-retention-design.md.
 *
 * Also logs the audit_logs size: archiving and export are deferred until it passes 50 MB.
 */

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { createLogger } from "../lib/logger";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ENVIRONMENT?: string;
}

const SIZE_ALERT_BYTES = 50 * 1024 * 1024;

export async function anonymizeAuditLogs(
  env: Env
): Promise<{ anonymizedCount: number; auditLogsBytes: number }> {
  const logger = createLogger(env);
  const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("anonymize_audit_logs");
  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  const anonymizedCount = data?.[0]?.anonymized_count ?? 0;
  const auditLogsBytes = data?.[0]?.audit_logs_bytes ?? 0;
  const sizeMB = (auditLogsBytes / 1024 / 1024).toFixed(1);

  logger.info(`[CRON] Audit anonymization: ${anonymizedCount} rows, audit_logs is ${sizeMB} MB`);

  if (auditLogsBytes > SIZE_ALERT_BYTES) {
    logger.warn(
      `[ALERT] audit_logs is ${sizeMB} MB, past the 50 MB trigger. ` +
        `Revisit the deferred archiving/export decision in docs/plans/2026-10-18-audit-retention-design.md.`
    );
  }

  return { anonymizedCount, auditLogsBytes };
}
```

- [x] **Step 4: Implement the endpoint**

`functions/api/cron/anonymize-audit.ts`:

```ts
/**
 * HTTP endpoint for audit anonymization.
 * Triggered weekly by .github/workflows/scheduled-cleanup.yml (Bearer CRON_SECRET).
 */

import { verifyCronAuth } from "../../lib/cron-auth";
import { anonymizeAuditLogs } from "../../scheduled/anonymize-audit";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CRON_SECRET: string;
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const startTime = Date.now();

  const auth = verifyCronAuth(request, env.CRON_SECRET);
  if (!auth.valid) {
    console.warn("[CRON] Unauthorized anonymization attempt:", auth.error);
    return Response.json({ error: "Unauthorized", message: auth.error }, { status: 401 });
  }

  try {
    const { anonymizedCount, auditLogsBytes } = await anonymizeAuditLogs(env);

    return Response.json({
      success: true,
      anonymized_count: anonymizedCount,
      audit_logs_bytes: auditLogsBytes,
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CRON] Audit anonymization failed:", error);

    return Response.json(
      {
        success: false,
        error: "Anonymization failed",
        message: error instanceof Error ? error.message : "Unknown error",
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
```

- [x] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/__tests__/api/anonymize-audit.test.ts && npx tsc --noEmit -p functions/tsconfig.json`
Expected: `Tests  6 passed (6)`; tsc exits 0.

- [x] **Step 6: Commit**

```bash
git add functions/scheduled/anonymize-audit.ts functions/api/cron/anonymize-audit.ts src/__tests__/api/anonymize-audit.test.ts
git commit -m "feat(api): add the weekly audit anonymization endpoint"
```

---

### Task 4: Weekly schedule

**Files:**

- Modify: `.github/workflows/scheduled-cleanup.yml`

**Interfaces:**

- Consumes: `POST /api/cron/anonymize-audit` (Task 3), `POST /api/cron/cleanup-payment-proofs` (PR #25).

- [x] **Step 1: Replace the header comment (lines 1-14)**

```yaml
# Scheduled Cleanup Tasks
#
# Replaces Cloudflare Workers cron triggers (not supported by Pages)
# Calls HTTP endpoints protected by CRON_SECRET Bearer token
#
# Schedules (UTC):
# - Daily 2:00 AM: Cleanup expired idempotency keys (48+ hours old)
# - Weekly Sunday 3:00 AM: payment-proof cleanup (90 days after check-out,
#   30 days after cancellation) and audit anonymization (rows older than
#   24 months; docs/plans/2026-10-18-audit-retention-design.md)
#
# Manual trigger: GitHub Actions > Scheduled Cleanup Tasks > Run workflow
```

- [x] **Step 2: Replace the `on:` block**

```yaml
on:
  schedule:
    # Daily at 2:00 AM UTC (10:00 AM PHT): idempotency keys.
    - cron: "0 2 * * *"
    # Weekly, Sunday 3:00 AM UTC (11:00 AM PHT): payment proofs and audit anonymization.
    - cron: "0 3 * * 0"
  workflow_dispatch:
    inputs:
      task:
        description: "Which cleanup task to run"
        required: true
        default: "idempotency"
        type: choice
        options:
          - all
          - idempotency
          - payment-proofs
          - anonymize-audit
```

- [x] **Step 3: Update both job conditions and the payment-proof comment**

In `cleanup-idempotency`, replace `github.event.inputs.task == 'both'` with `github.event.inputs.task == 'all'` and the comment with `# Run daily at 2 AM UTC, or when manually triggered with 'all' or 'idempotency'`. In `cleanup-payment-proofs`, replace the two `# DISABLED ...` comment lines with `# Run weekly on Sunday 3 AM UTC, or when manually triggered with 'all' or 'payment-proofs'` and `'both'` with `'all'`.

- [x] **Step 4: Append the anonymization job**

```yaml
anonymize-audit:
  name: Anonymize Old Audit Rows
  runs-on: ubuntu-latest
  # Run weekly on Sunday 3 AM UTC, or when manually triggered with 'all' or 'anonymize-audit'
  if: |
    github.event.schedule == '0 3 * * 0' ||
    (github.event_name == 'workflow_dispatch' && (github.event.inputs.task == 'all' || github.event.inputs.task == 'anonymize-audit'))
  steps:
    - name: Trigger audit anonymization
      run: |
        echo "Starting audit anonymization..."

        RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
          -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
          -H "Content-Type: application/json" \
          "${{ env.PRODUCTION_URL }}/api/cron/anonymize-audit")

        HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
        BODY=$(echo "$RESPONSE" | sed '$d')

        echo "Response: $BODY"
        echo "HTTP Status: $HTTP_CODE"

        if [ "$HTTP_CODE" -ne 200 ]; then
          echo "::error::Anonymization failed with HTTP $HTTP_CODE"
          exit 1
        fi

        echo "Audit anonymization completed successfully"
```

- [x] **Step 5: Validate the YAML**

Run: `python3 -c "import yaml,sys; d=yaml.safe_load(open('.github/workflows/scheduled-cleanup.yml')); print(sorted(d['jobs']), [s['cron'] for s in d[True]['schedule']], d[True]['workflow_dispatch']['inputs']['task']['options'])"`
Expected: `['anonymize-audit', 'cleanup-idempotency', 'cleanup-payment-proofs'] ['0 2 * * *', '0 3 * * 0'] ['all', 'idempotency', 'payment-proofs', 'anonymize-audit']` (PyYAML parses the `on:` key as `True`). Also `grep -c "'both'" .github/workflows/scheduled-cleanup.yml` prints `0`.

- [x] **Step 6: Commit**

```bash
git add .github/workflows/scheduled-cleanup.yml
git commit -m "ci(cleanup): schedule weekly payment-proof cleanup and audit anonymization"
```

---

### Task 5: Audit UI labels for anonymized rows

**Files:**

- Create: `src/lib/audit-display.ts`
- Create: `src/lib/__tests__/audit-display.test.ts`
- Modify: `src/components/entity-detail/DetailAuditSection.tsx:72`
- Modify: `src/components/audit/AuditLogViewer.tsx:235`
- Modify: `src/components/audit/AuditDiffViewer.tsx:69,119-131`
- Modify: `src/components/audit/__tests__/AuditDiffViewer.test.tsx` (new cases)

**Interfaces:**

- Consumes: the `metadata.anonymized_at` marker (Task 1); `AuditLog` from `@/types/audit.types`.
- Produces: `isAnonymized(log: Pick<AuditLog, "metadata">): boolean`; `auditActorLabel(log: Pick<AuditLog, "user_email" | "user_id" | "metadata">): string`.

- [x] **Step 1: Write the failing unit test**

`src/lib/__tests__/audit-display.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { auditActorLabel, isAnonymized } from "../audit-display";

const ANONYMIZED = { anonymized_at: "2028-01-02T03:00:00Z" };

describe("isAnonymized", () => {
  it("is true only when metadata carries anonymized_at", () => {
    expect(isAnonymized({ metadata: ANONYMIZED })).toBe(true);
    expect(isAnonymized({ metadata: { ip: "10.0.0.1" } })).toBe(false);
    expect(isAnonymized({ metadata: null })).toBe(false);
    expect(isAnonymized({ metadata: ["anonymized_at"] })).toBe(false);
  });
});

describe("auditActorLabel", () => {
  it("shows the email when present", () => {
    expect(auditActorLabel({ user_email: "a@b.com", user_id: "u1", metadata: null })).toBe(
      "a@b.com"
    );
  });

  it("marks anonymized staff rows", () => {
    expect(auditActorLabel({ user_email: null, user_id: "u1", metadata: ANONYMIZED })).toBe(
      "Staff (details removed)"
    );
  });

  it("falls back to System otherwise", () => {
    expect(auditActorLabel({ user_email: null, user_id: null, metadata: ANONYMIZED })).toBe(
      "System"
    );
    expect(auditActorLabel({ user_email: null, user_id: "u1", metadata: null })).toBe("System");
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/__tests__/audit-display.test.ts`
Expected: FAIL, `Failed to resolve import "../audit-display"`.

- [x] **Step 3: Implement the helpers**

`src/lib/audit-display.ts`:

```ts
import type { AuditLog } from "@/types/audit.types";

/** Rows anonymized by the retention job (anonymize_audit_logs) carry metadata.anonymized_at. */
export function isAnonymized(log: Pick<AuditLog, "metadata">): boolean {
  const { metadata } = log;
  return (
    metadata !== null &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    "anonymized_at" in metadata
  );
}

export function auditActorLabel(
  log: Pick<AuditLog, "user_email" | "user_id" | "metadata">
): string {
  if (log.user_email) return log.user_email;
  if (log.user_id && isAnonymized(log)) return "Staff (details removed)";
  return "System";
}
```

- [x] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/__tests__/audit-display.test.ts`
Expected: `Tests  4 passed (4)`.

- [x] **Step 5: Add failing diff-viewer cases**

Append inside the top-level `describe("AuditDiffViewer", ...)` in `src/components/audit/__tests__/AuditDiffViewer.test.tsx`:

```tsx
describe("anonymized rows", () => {
  const anonymized = createMockLog({
    user_email: null,
    ip_address: null,
    description: null,
    metadata: { anonymized_at: "2028-01-02T03:00:00Z" },
  });

  it("explains that details were removed", () => {
    render(<AuditDiffViewer log={anonymized} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Details removed after the retention period")).toBeInTheDocument();
    expect(
      screen.queryByText("No data changes recorded for this log entry")
    ).not.toBeInTheDocument();
  });

  it("labels the staff member as removed, not System", () => {
    render(<AuditDiffViewer log={anonymized} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Staff (details removed)")).toBeInTheDocument();
    expect(screen.queryByText("System")).not.toBeInTheDocument();
  });
});
```

Run: `npx vitest run src/components/audit/__tests__/AuditDiffViewer.test.tsx`
Expected: the 2 new tests FAIL; the existing ones pass.

- [x] **Step 6: Use the helpers in the three components**

`src/components/audit/AuditDiffViewer.tsx`: add `import { auditActorLabel, isAnonymized } from "@/lib/audit-display";` with the other `@/lib` imports; replace line 69 with

```tsx
<div className="text-sm">{auditActorLabel(log)}</div>
```

and replace the `<span>` inside the no-data branch (line 129) with

```tsx
<span className="text-sm">
  {isAnonymized(log)
    ? "Details removed after the retention period"
    : "No data changes recorded for this log entry"}
</span>
```

`src/components/audit/AuditLogViewer.tsx`: add the same import (only `auditActorLabel`); replace line 235 with

```tsx
<div className="text-sm">{auditActorLabel(log)}</div>
```

`src/components/entity-detail/DetailAuditSection.tsx`: add `import { auditActorLabel } from "@/lib/audit-display";` after the `@/lib/audit-hooks` import; replace line 72 with

```tsx
<div className="text-xs text-neutral-500">{auditActorLabel(log)}</div>
```

- [x] **Step 7: Run the UI tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/audit-display.test.ts src/components/audit src/components/entity-detail/__tests__/DetailAuditSection.test.tsx`
Expected: all pass, 0 failed.

- [x] **Step 8: Commit**

```bash
git add src/lib/audit-display.ts src/lib/__tests__/audit-display.test.ts src/components/audit/AuditDiffViewer.tsx src/components/audit/AuditLogViewer.tsx src/components/entity-detail/DetailAuditSection.tsx src/components/audit/__tests__/AuditDiffViewer.test.tsx
git commit -m "feat(audit): label anonymized audit rows in the viewers"
```

---

### Task 6: Verify, PR, prod

- [x] **Step 1: Full verification**

Run: `npm run verify; echo "EXIT $?"` then `npm run test:db; echo "EXIT $?"`
Expected: both `EXIT 0`; test:db count is the previous 121 plus 2.

- [x] **Step 2: Docs**

Tick this plan's tasks; in `docs/plans/2026-10-03-guardrails-design.md` item 2, append "Implemented on `feat/audit-retention`, PR #<n>". In `src/components/audit/CLAUDE.md`, add one bullet: "Rows older than 24 months are anonymized weekly (`anonymize_audit_logs`); they carry `metadata.anonymized_at`. Use `auditActorLabel`/`isAnonymized` from `src/lib/audit-display.ts` instead of reading `user_email` directly." Commit as `docs(plans): track audit retention implementation`.

- [ ] **Step 3: Push and open the PR**

Push with `timeout: 600000` (pre-push runs the unit suite), verify `git rev-parse HEAD origin/feat/audit-retention` match, then `gh pr create` with the mattpocock `pr` skill template.

- [ ] **Step 4: Prod (user)**

After merge: `supabase db push`; `sh scripts/drift-check.sh` (needs `supabase start`); GitHub Actions > Scheduled Cleanup Tasks > Run workflow > `anonymize-audit`. Expected first-run log: about 0 rows anonymized (the oldest prod row is from 2025-10-02, so nothing qualifies until 2027-10), and `audit_logs` around 3.4 MB.

## Decisions & Deferrals

- **`metadata.anonymized_at` marker instead of NULL metadata (2026-10-18, deviation from the approved spec).** Why: rows can lack `user_email` without being anonymized (legacy app-logged rows), so "email missing" cannot drive the "Staff (details removed)" label; the marker is exact, gives the UI a date, and is the job's idempotency check. Revisit: n/a.
- **Shared `src/__tests__/setup/psql.ts` used by the new test only.** Why: three DB tests carry slightly different `runPsql` copies (one returns a string); migrating them is unrelated churn. Revisit: next time one of those tests is edited.
- **No retries in the anonymization job.** Why: weekly and idempotent; the next run catches up, and the workflow failure email is the alert. Revisit: if runs fail intermittently.
- **`both` dispatch option renamed `all`.** Why: there are now three tasks. No callers outside the workflow. Revisit: n/a.
- **First prod run anonymizes nothing.** Why: the oldest row is 2025-10-02; rows start qualifying in 2027-10. The size log still runs weekly. Revisit: n/a.
- **Execution notes (2026-10-18).** Task 1: the probe rows use a real auth user, because `audit_logs.user_id` references `auth.users` (`ON DELETE SET NULL`, so deleting a staff account already blanks `user_id` on live rows). Task 4: validated with the `yaml` npm package (PyYAML is not installed). Task 5: `src/components/admin/RoleChangeHistory.tsx` also rendered `user_email || "System"` and now uses `auditActorLabel`. Verify: 1486 passed / 20 skipped; test:db: 123 passed.
