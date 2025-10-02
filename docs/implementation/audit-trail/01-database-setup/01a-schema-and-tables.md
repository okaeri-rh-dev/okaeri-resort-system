# Phase 1a: Schema & Tables

**Duration**: 30-45 minutes
**Prerequisites**: PostgreSQL/Supabase access, database tools installed

## Overview

This document covers the creation of the `audit_logs` table, the central storage for all audit trail data. This table is designed to capture changes from both database triggers (Layer 1) and application-level logging (Layer 2).

## Table Purpose

The `audit_logs` table stores:

- **All database changes** via PostgreSQL triggers (automatic)
- **Business context** via application logging (selective)
- **User information** from Supabase Auth
- **Before/after data** for all modifications
- **Metadata** for investigations and reporting

## Complete Schema

### SQL Definition

```sql
-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
-- Description: Central audit trail for all database changes
-- Populated by: PostgreSQL triggers (Layer 1) + Application logging (Layer 2)
-- Retention: Manual archival recommended quarterly

CREATE TABLE IF NOT EXISTS audit_logs (
    -- ============================================
    -- IDENTITY
    -- ============================================
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Correlation ID for linking related log entries
    -- Allows connecting trigger logs with corresponding app logs for the same business operation
    -- Example: booking update triggers audit_trigger_func (correlation_id=X)
    --          AND app logs business context (same correlation_id=X)
    -- Defaults to random UUID; app can pass explicit value to correlate events
    correlation_id UUID DEFAULT gen_random_uuid(),

    -- ============================================
    -- WHAT CHANGED (Layer 1: Database Triggers)
    -- ============================================
    table_name TEXT NOT NULL,
    record_id TEXT,  -- Nullable to support app events without specific records. TEXT type for flexibility with non-UUID PKs.
    record_pk JSONB,  -- Full composite primary key as JSON (for tables with multi-column PKs)
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),

    -- Business event type for application-level logs (Layer 2 only)
    -- Examples: 'login', 'logout', 'cancel_booking', 'refund_payment', 'system_migration'
    -- NULL for database trigger logs (Layer 1)
    event_type VARCHAR(50),

    -- ============================================
    -- SOURCE TRACKING (Dual-Layer Design)
    -- ============================================
    -- Distinguishes between database triggers and application logging
    -- 'db' = Layer 1 (automatic database triggers)
    -- 'app' = Layer 2 (manual application logging with business context)
    source VARCHAR(10) NOT NULL DEFAULT 'db' CHECK (source IN ('db', 'app')),

    -- ============================================
    -- WHO MADE THE CHANGE (Layer 1: From auth.uid())
    -- ============================================
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    user_role TEXT,

    -- ============================================
    -- DATA CHANGES (Layer 1: Automatic Capture)
    -- ============================================
    -- old_data: Complete record state BEFORE change (NULL for INSERT)
    -- new_data: Complete record state AFTER change (NULL for DELETE)
    old_data JSONB,
    new_data JSONB,

    -- Array of field names that changed (UPDATE only for DB triggers)
    -- Example: ['base_rate', 'weekend_rate']
    -- NULL for Layer 2 app events
    changed_fields TEXT[],

    -- ============================================
    -- APPLICATION CONTEXT (Layer 2: Required for app events)
    -- ============================================
    -- These fields populated by application-level logging
    -- NULL when only database trigger fires (Layer 1)

    -- Human-readable description of the action
    -- Example: "Changed booking status from Pending to Confirmed"
    description TEXT,

    -- Categorization for filtering
    -- Examples: 'authentication', 'booking', 'payment', 'unit', 'guest', 'expense', 'maintenance', 'system'
    category VARCHAR(50),

    -- Severity level for monitoring (UPPERCASE)
    severity VARCHAR(20) CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL', 'DEBUG')),

    -- Additional machine-readable context (flexible JSON)
    -- Example: {"booking_reference": "BK-20250101-ABC123", "previous_status": "Pending"}
    -- NOTE: Do NOT duplicate description/category/severity here - use dedicated columns above
    metadata JSONB,

    -- ============================================
    -- CLIENT CONTEXT (Layer 2: Optional)
    -- ============================================
    -- Captured from application layer when available
    ip_address INET,
    user_agent TEXT,

    -- ============================================
    -- TIMING
    -- ============================================
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- ============================================
    -- CONSTRAINTS
    -- ============================================
    -- Layer 1 (DB triggers): UPDATE operations MUST have changed_fields
    -- Layer 2 (app events): changed_fields is NULL (app events use action='INSERT' by convention)
    CONSTRAINT valid_changed_fields CHECK (
        (source = 'app') OR  -- App events exempt from this constraint
        (action != 'UPDATE') OR
        (changed_fields IS NOT NULL AND array_length(changed_fields, 1) > 0)
    ),

    -- Event type validation: Only app events can have event_type
    CONSTRAINT valid_event_type CHECK (
        (source = 'db' AND event_type IS NULL) OR  -- DB triggers don't use event_type
        (source = 'app')  -- App events can optionally specify event_type
    )
);

-- ============================================
-- IDENTITY ENFORCEMENT TRIGGER (Security)
-- ============================================
-- Purpose: Prevent clients from forging user identity or source in Layer 2 logs
-- This trigger forces server-side identity extraction from JWT claims

CREATE OR REPLACE FUNCTION enforce_audit_identity_func()
RETURNS TRIGGER AS $$
BEGIN
    -- Only enforce for Layer 2 (app) logs or when source is NULL
    -- Layer 1 (db triggers) bypass this via SECURITY DEFINER context
    IF NEW.source = 'app' OR NEW.source IS NULL THEN
        -- Force user identity from Supabase Auth JWT claims
        NEW.user_id := auth.uid();
        NEW.user_email := NULLIF(
            current_setting('request.jwt.claims', TRUE)::json->>'email',
            ''
        );
        NEW.user_role := NULLIF(
            current_setting('request.jwt.claims', TRUE)::json->>'role',
            ''
        );

        -- Force source to 'app' for client-side inserts
        NEW.source := 'app';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_audit_identity
BEFORE INSERT ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION enforce_audit_identity_func();

COMMENT ON FUNCTION enforce_audit_identity_func() IS
    'Enforces server-side user identity for Layer 2 audit logs. Prevents clients from forging user_id, user_email, or source fields.';

-- ============================================
-- APP ROLES TABLE (Role Management)
-- ============================================
-- Purpose: Store user role assignments for audit trail access control
-- Supports: admin, owner, manager, and staff roles
-- Alternative to GUC-based email lists (more portable and auditable)

CREATE TABLE IF NOT EXISTS app_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'owner', 'manager', 'staff')),
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT  -- Optional notes about why role was granted
);

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_app_roles_role ON app_roles(role);

-- Table comment
COMMENT ON TABLE app_roles IS
    'User role assignments for audit trail access control. Provides runtime-reconfigurable role management without requiring database admin privileges.';

COMMENT ON COLUMN app_roles.user_id IS
    'Foreign key to auth.users. Primary key ensures one role per user.';

COMMENT ON COLUMN app_roles.role IS
    'User role: admin (full system access + role management), owner (all audit logs), manager (business operations only), staff (own logs only).';

COMMENT ON COLUMN app_roles.granted_by IS
    'User who granted this role. NULL for bootstrap/system grants.';

COMMENT ON COLUMN app_roles.granted_at IS
    'Timestamp when role was granted.';

COMMENT ON COLUMN app_roles.notes IS
    'Optional notes about why role was granted or any special conditions.';
```

### Identity Enforcement Rationale

**Security Problem**: Without enforcement, malicious clients could:

- Insert logs with arbitrary `user_id` (impersonate other users)
- Set `user_email` to someone else's email
- Mark client logs as `source='db'` to masquerade as trigger logs

**Solution**: BEFORE INSERT trigger force-sets identity from JWT claims:

- ✅ `user_id` always from `auth.uid()` (Supabase Auth)
- ✅ `user_email` always from JWT claims
- ✅ `source` always set to `'app'` for client inserts
- ✅ Client-supplied values for these fields are **ignored**

**How Database Triggers Bypass This**:

- Triggers run with `SECURITY DEFINER` privilege
- They can set `source='db'` because they're trusted database code
- Client code (via Supabase client) cannot forge this

## Dual-Layer Design Conventions

### Layer 1: Database Triggers (Automatic)

- **source**: Always `'db'`
- **record_id**: Always populated (UUID of changed record)
- **action**: `'INSERT'`, `'UPDATE'`, or `'DELETE'` based on actual DB operation
- **changed_fields**: Populated for UPDATE actions
- **description/category/severity**: NULL (triggers don't add business context)

### Layer 2: Application Logging (Selective)

- **source**: Always `'app'`
- **record_id**: Nullable (may be NULL for system-wide events)
- **correlation_id**: Can be explicitly set to match corresponding trigger log

**Transactional Boundaries**:

Layer 2 (app) logs are **best-effort** and not transactionally coupled with Layer 1 (trigger) logs. This means:

- **Layer 1 triggers** fire synchronously within the database transaction (guaranteed)
- **Layer 2 app logs** are separate network calls to `db.auditLogs.create()` (may fail independently)
- **Trade-off**: Eventual consistency vs operational simplicity

**For critical operations** requiring guaranteed correlation (e.g., financial refunds, compliance events), consider:

1. **Server-side RPC function** that performs mutation + app logging in single transaction
2. **Edge Function** that bundles both operations atomically
3. **Accept eventual consistency** - Layer 1 triggers are source of truth; Layer 2 adds business context

**Recommendation for 3-room resort**: Accept eventual consistency. Layer 1 provides complete change history. Layer 2 failures are rare and non-blocking. Add atomic wrappers only if production audit gaps occur.

### Correlation ID Usage

**Purpose**: Link related log entries from Layer 1 (triggers) and Layer 2 (app) for the same business operation.

**Use Cases**:

1. **Debugging**: Find all logs related to a specific booking update
2. **Audit Trail**: Show complete story of "user X updated booking Y" with both DB changes and business context
3. **Support**: Trace issues by following correlation chain

**Implementation Pattern**:

```typescript
// When performing a business operation that you want to correlate:
import { v4 as uuidv4 } from "uuid";

const correlationId = uuidv4();

// 1. Perform database mutation (triggers fire with auto-generated correlation_id)
const { data: booking } = await db.bookings.update(bookingId, updates);

// 2. Log business context with SAME correlation_id
await logAuditEvent({
  tableName: "bookings",
  recordId: bookingId,
  eventType: "status_change",
  description: `Changed booking status to ${newStatus}`,
  category: "booking",
  severity: "INFO",
  correlationId, // ← Explicit correlation
  metadata: {
    previousStatus: oldStatus,
    newStatus,
  },
});
```

**Querying Correlated Logs**:

```sql
-- Find all logs for a correlation_id
SELECT
  audit_id,
  source,
  table_name,
  action,
  event_type,
  description,
  created_at
FROM audit_logs
WHERE correlation_id = 'your-correlation-uuid'
ORDER BY created_at ASC;

-- Expected result: 1 trigger log (source='db') + 1 app log (source='app')
```

**Default Behavior**:

- If no correlation_id provided, each log entry gets unique UUID
- Trigger logs and app logs will have different correlation_ids
- Still traceable via `table_name + record_id + created_at` proximity
- **action**: Always `'INSERT'` by convention (avoids constraint conflicts)
- **changed_fields**: NULL (app events don't track field-level changes)
- **description/category/severity**: Required (provides business context)
- **table_name**: Can be special values like `'system'` or `'authentication'`

### Why This Convention?

**Problem**: Layer 2 app events don't have `changed_fields` data, which would violate the `valid_changed_fields` constraint if we used `action='UPDATE'`.

**Solution**: Layer 2 always uses `action='INSERT'` to represent "inserting a business event into the audit log" rather than "updating a database record." The `source='app'` column makes the distinction clear.

**Benefits**:

- ✅ No constraint violations
- ✅ Clear semantic separation between DB changes and business events
- ✅ Single table keeps queries and UI simple
- ✅ Easy to filter: `WHERE source='db'` for DB changes, `WHERE source='app'` for business context

## Role Management with app_roles

### Role Hierarchy

The `app_roles` table provides a four-tier role system for audit trail access control:

| Role        | Access Level       | Audit Log Visibility                                                                                | Role Management               |
| ----------- | ------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------- |
| **admin**   | Full system access | All audit logs                                                                                      | Can grant/revoke all roles    |
| **owner**   | Business owner     | All audit logs                                                                                      | Can grant manager/staff roles |
| **manager** | Operations manager | Business operations only (`bookings`, `payments`, `guests`, `expenses`, `system`, `authentication`) | No role management            |
| **staff**   | Team member        | Own logs only                                                                                       | No role management            |

### Why app_roles Instead of GUC Emails?

**app_roles advantages**:

- ✅ **Runtime reconfigurable** - No database admin privileges needed to change roles
- ✅ **Environment portable** - Works identically across dev/staging/prod
- ✅ **Auditable** - Track who granted roles and when (`granted_by`, `granted_at`)
- ✅ **UI manageable** - Can build admin interface for role assignments
- ✅ **Scalable** - Supports four role levels vs. two with GUC

**GUC approach limitations** (legacy):

- ❌ Requires `ALTER DATABASE` privilege (DB admin only)
- ❌ Environment-specific (hard to replicate across environments)
- ❌ Not auditable (no record of role changes)
- ❌ Two-tier only (owner vs. manager)

### Bootstrap Process

1. **Initial Admin Grant** - First user seeded via migration:

```sql
-- Run once during initial deployment
INSERT INTO app_roles (user_id, role, granted_by, notes) VALUES
  ('<first-owner-uuid>', 'admin', NULL, 'Bootstrap admin - initial system setup')
ON CONFLICT (user_id) DO NOTHING;
```

2. **Subsequent Role Grants** - Admin/owner grants via application:

```sql
-- Example: Owner grants manager role
INSERT INTO app_roles (user_id, role, granted_by, notes) VALUES
  ('<new-manager-uuid>', 'manager', '<owner-uuid>', 'Granted manager role for booking operations')
ON CONFLICT (user_id) DO UPDATE SET
  role = EXCLUDED.role,
  granted_by = EXCLUDED.granted_by,
  granted_at = NOW(),
  notes = EXCLUDED.notes;
```

### Querying User Roles

```sql
-- Check current user's role
SELECT role FROM app_roles WHERE user_id = auth.uid();

-- Get all users with a specific role
SELECT u.email, ar.role, ar.granted_at
FROM app_roles ar
JOIN auth.users u ON u.id = ar.user_id
WHERE ar.role = 'manager';

-- Check if user has admin or owner privileges
SELECT EXISTS (
  SELECT 1 FROM app_roles
  WHERE user_id = auth.uid()
    AND role IN ('admin', 'owner')
) AS has_elevated_access;
```

## Column Rationale

### Why JSONB for old_data and new_data?

**Benefits**:

- ✅ **Schema flexibility** - No need to modify audit table when business tables change
- ✅ **Complete history** - Captures entire record state, not just changed fields
- ✅ **Query capability** - Can search within JSONB using GIN indexes
- ✅ **Type preservation** - JSON preserves data types (numbers, booleans, nulls)

**Trade-offs**:

- ⚠️ **Storage size** - Larger than storing only changed fields (~3KB per audit log)
- ⚠️ **Query complexity** - JSONB queries more complex than simple columns

**Decision**: JSONB chosen for flexibility. With 3 rooms, storage is negligible (~26MB/year).

### Why TEXT[] for changed_fields?

**Benefits**:

- ✅ **Efficient storage** - Only stores field names, not values
- ✅ **Fast filtering** - Can query `'base_rate' = ANY(changed_fields)`
- ✅ **Index support** - PostgreSQL GIN indexes support array operations
- ✅ **Human readable** - Easy to understand in queries

### Why record_pk JSONB for Composite Primary Keys?

**Problem**: Tables with composite primary keys (e.g., `PRIMARY KEY (room_id, date)`) only had the first column captured in `record_id TEXT`.

**Solution**: `record_pk JSONB` stores the full composite key as JSON.

**Usage Examples**:

```sql
-- Table with composite PK: PRIMARY KEY (room_id, date)
-- record_id: "1" (first column only)
-- record_pk: {"room_id": 1, "date": "2025-01-15"}

-- Query by composite key:
SELECT * FROM audit_logs
WHERE record_pk @> '{"room_id": 1, "date": "2025-01-15"}';

-- Query by partial key:
SELECT * FROM audit_logs
WHERE record_pk @> '{"room_id": 1}';
```

**When to Use**:

- ✅ Tables with composite primary keys (2+ columns)
- ✅ Tables with natural keys (non-UUID identifiers)
- ❌ Not needed for simple UUID or single-column PKs (use record_id TEXT)

**Benefits**:

- ✅ **Complete identity** - Full primary key preserved, not just first column
- ✅ **Query flexibility** - Use JSONB operators for filtering
- ✅ **Future-proof** - Handles any PK structure without schema changes
- ✅ **Optional** - NULL for simple single-column PKs (no storage overhead)

**Alternative considered**: Comma-separated string

- ❌ Less efficient queries
- ❌ No array operators
- ❌ More parsing required

### Why separate description vs metadata?

**description** (TEXT):

- Human-readable narrative
- Displayed directly in UI
- Examples: "User logged in successfully", "Booking cancelled due to weather"

**metadata** (JSONB):

- Machine-readable structured data
- Used for filtering/analysis
- Examples: `{"refund_amount": 5000, "cancellation_reason": "weather"}`

**This separation allows**:

- Clear UI messages (description)
- Flexible data analysis (metadata)
- No confusion between presentation and data

### Why allow NULL for user context?

**Scenarios where user_id is NULL**:

1. **System operations** - Automated jobs, triggers, cron tasks
2. **Unauthenticated operations** - Guest bookings (before auth flow)
3. **Database maintenance** - Manual SQL operations by admins
4. **Migration operations** - Bulk data changes during deployment

**Impact**: Query logic must handle NULL users gracefully with `COALESCE(user_email, 'System')`

## Table Comments

Add PostgreSQL comments for documentation:

```sql
-- ============================================
-- TABLE AND COLUMN COMMENTS
-- ============================================

COMMENT ON TABLE audit_logs IS
    'Complete audit trail of all database changes. Populated by PostgreSQL triggers (automatic) and application-level logging (selective).';

COMMENT ON COLUMN audit_logs.audit_id IS
    'Unique identifier for this audit entry';

COMMENT ON COLUMN audit_logs.table_name IS
    'Name of the table that was modified (e.g., bookings, units, payments)';

COMMENT ON COLUMN audit_logs.record_id IS
    'Identifier of the specific record that was modified. TEXT type for flexibility with UUID and non-UUID primary keys.';

COMMENT ON COLUMN audit_logs.action IS
    'Type of database operation: INSERT, UPDATE, or DELETE';

COMMENT ON COLUMN audit_logs.event_type IS
    'Business event type for application-level logs. Examples: login, logout, cancel_booking, refund_payment. NULL for database trigger logs.';

COMMENT ON COLUMN audit_logs.user_id IS
    'Foreign key to auth.users. NULL for system operations or unauthenticated actions.';

COMMENT ON COLUMN audit_logs.user_email IS
    'Email address of the user who made the change. Denormalized for query performance.';

COMMENT ON COLUMN audit_logs.user_role IS
    'User role at time of action (owner, manager, staff). Captured from JWT claims.';

COMMENT ON COLUMN audit_logs.old_data IS
    'Complete record state BEFORE the change. NULL for INSERT operations. Stored as JSONB for flexibility.';

COMMENT ON COLUMN audit_logs.new_data IS
    'Complete record state AFTER the change. NULL for DELETE operations. Stored as JSONB for flexibility.';

COMMENT ON COLUMN audit_logs.changed_fields IS
    'Array of field names that changed during UPDATE. Enables fast filtering (e.g., find all base_rate changes).';

COMMENT ON COLUMN audit_logs.description IS
    'Human-readable description from application layer. Example: "Changed booking status from Pending to Confirmed"';

COMMENT ON COLUMN audit_logs.category IS
    'Categorization for filtering: auth, booking, payment, unit, guest, expense, maintenance, system';

COMMENT ON COLUMN audit_logs.severity IS
    'Severity level for monitoring: INFO (default), WARNING (suspicious), CRITICAL (requires attention), DEBUG (verbose)';

COMMENT ON COLUMN audit_logs.metadata IS
    'Additional structured context from application layer. Flexible JSONB for business-specific data.';

COMMENT ON COLUMN audit_logs.ip_address IS
    'IP address of client that initiated the change. Captured from application layer when available.';

COMMENT ON COLUMN audit_logs.user_agent IS
    'Browser user agent string. Captured from application layer for client identification.';

COMMENT ON COLUMN audit_logs.created_at IS
    'Timestamp when audit log was created (UTC with timezone)';
```

## Verification Queries

After creating the table, run these queries to verify:

### Check Table Exists

```sql
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'audit_logs'
) AS table_exists;
```

**Expected**: `table_exists = TRUE`

### Check Column Structure

```sql
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'audit_logs'
ORDER BY ordinal_position;
```

**Expected columns** (19 total):

- `audit_id` - uuid, not null, default uuid_generate_v4()
- `table_name` - text, not null
- `record_id` - text, nullable (TEXT type for flexibility with non-UUID PKs)
- `record_pk` - jsonb, nullable (composite primary keys)
- `action` - character varying(10), not null
- `event_type` - character varying(50), nullable (app events only)
- `source` - character varying(10), not null, default 'db'
- `user_id` - uuid, nullable
- `user_email` - text, nullable
- `user_role` - text, nullable
- `old_data` - jsonb, nullable
- `new_data` - jsonb, nullable
- `changed_fields` - ARRAY, nullable
- `description` - text, nullable
- `category` - character varying(50), nullable
- `severity` - character varying(20), nullable
- `metadata` - jsonb, nullable
- `ip_address` - inet, nullable
- `user_agent` - text, nullable
- `created_at` - timestamp with time zone, default now()

### Check Constraints

```sql
SELECT
    constraint_name,
    constraint_type,
    check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'audit_logs';
```

**Expected constraints**:

1. `audit_logs_pkey` - PRIMARY KEY (audit_id)
2. `audit_logs_action_check` - CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))
3. `audit_logs_source_check` - CHECK (source IN ('db', 'app'))
4. `valid_changed_fields` - CHECK for UPDATE operations
5. `valid_event_type` - CHECK (event_type validation for app events)
6. `audit_logs_severity_check` - CHECK (severity IN (...))
7. `audit_logs_user_id_fkey` - FOREIGN KEY to auth.users

### Check Comments

```sql
SELECT
    col_description('audit_logs'::regclass, ordinal_position) AS column_comment
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'audit_logs'
  AND col_description('audit_logs'::regclass, ordinal_position) IS NOT NULL
ORDER BY ordinal_position;
```

**Expected**: All columns should have descriptive comments

## Storage Estimates

### Per Audit Log

**Typical audit log size**:

```
- UUID (audit_id): 16 bytes
- Text fields: ~200 bytes (table_name, user_email, description)
- JSONB old_data: ~1KB (varies by table)
- JSONB new_data: ~1KB (varies by table)
- Array changed_fields: ~50 bytes
- Other fields: ~100 bytes
Total: ~2.5KB per audit log (average)
```

### Monthly Estimates (3-Room Resort)

**Activity breakdown**:

```
Bookings: 50/month × 3 changes = 150 logs
Payments: 50/month × 2 changes = 100 logs
Units: 10/month updates = 10 logs
Guests: 50/month × 2 changes = 100 logs
Expenses: 30/month × 2 changes = 60 logs
Maintenance: 20/month updates = 20 logs
Auth events: ~500/month = 500 logs
Total: ~940 logs/month

Storage: 940 × 2.5KB = 2.35MB/month
Annual: 2.35MB × 12 = 28.2MB/year
```

**Supabase Free Tier**: 500MB database
**Verdict**: Safe for 17+ years without archival ✅

## Archive Table Schema

For long-term storage and regulatory compliance, create an archive table with identical structure to `audit_logs`:

```sql
-- ============================================
-- AUDIT LOGS ARCHIVE TABLE
-- ============================================
-- Purpose: Long-term storage for archived audit logs
-- Populated by: Manual archival via archive_audit_logs() function
-- Retention: Permanent or per compliance requirements

CREATE TABLE IF NOT EXISTS audit_logs_archive (
    LIKE audit_logs INCLUDING ALL
);

-- Add table comment
COMMENT ON TABLE audit_logs_archive IS
    'Archive storage for audit logs. Populated by archive_audit_logs() function. Logs are moved (not copied) from audit_logs to reduce active table size while maintaining audit trail.';

-- Indexes (same as main table for consistent query performance)
CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_user_context
    ON audit_logs_archive (user_email, user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_table_name
    ON audit_logs_archive (table_name);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_timestamp
    ON audit_logs_archive (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_record
    ON audit_logs_archive (table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_correlation
    ON audit_logs_archive (correlation_id);
```

### Archive vs Delete Decision

**Archive-Move Pattern (Recommended)**:

- **Pros**: Reversible, tamper-evident, maintains complete history
- **Cons**: Requires archive table storage (minimal for 3-room resort)
- **Use when**: Compliance requires retention beyond operational needs

**Direct Delete Pattern**:

- **Pros**: Simpler, reclaims storage immediately
- **Cons**: Irreversible, no audit trail of what was deleted
- **Use when**: Certain logs are truly disposable (e.g., debug events)

**Recommendation for Resort**: Use archive-move for all logs. At ~450MB/year, archival costs are negligible but audit integrity is valuable.

### Restore from Archive

```sql
-- Restore specific logs back to active table
INSERT INTO audit_logs
SELECT * FROM audit_logs_archive
WHERE correlation_id = 'uuid-here';

-- Or restore by date range
INSERT INTO audit_logs
SELECT * FROM audit_logs_archive
WHERE created_at BETWEEN '2024-01-01' AND '2024-12-31';

-- Remove from archive after restore
DELETE FROM audit_logs_archive
WHERE correlation_id = 'uuid-here';
```

## Migration File

Save this schema as:

**File**: `scripts/audit-migrations/migrations/001-audit-tables.sql`

```sql
-- ============================================
-- MIGRATION: 001 - Create Audit Logs Table
-- ============================================
-- Description: Creates the central audit_logs table
-- Author: Okaeri Resort System
-- Date: 2025-01-XX
-- Dependencies: None

\set ON_ERROR_STOP on

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create audit_logs table
-- (Full schema from above)

-- Add table and column comments
-- (Full comments from above)

-- Verify table creation
SELECT 'Audit logs table created successfully' AS status,
       COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'audit_logs';
```

## Next Steps

After completing this phase:

1. ✅ Verify table created successfully
2. ✅ Check all constraints in place
3. ✅ Review column comments
4. ➡️ Proceed to [01b: Triggers & Functions](./01b-triggers-and-functions.md)

## Troubleshooting

### Issue: "pgcrypto extension not available"

**Solution**:

```sql
-- Enable pgcrypto extension (usually pre-enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- If still unavailable, check with Supabase support
-- gen_random_uuid() is typically available by default
```

### Issue: "Foreign key constraint fails"

**Cause**: auth.users table doesn't exist or different schema

**Solution**:

```sql
-- Check auth schema
SELECT schemaname, tablename
FROM pg_tables
WHERE tablename = 'users';

-- Adjust foreign key if needed
ALTER TABLE audit_logs
    DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

ALTER TABLE audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;
```

### Issue: "Table already exists"

**Solution**:

```sql
-- Drop and recreate (WARNING: loses data)
DROP TABLE IF EXISTS audit_logs CASCADE;

-- Then run CREATE TABLE again
```

---

**Next**: [01b: Triggers & Functions](./01b-triggers-and-functions.md) - Implement automatic change tracking
