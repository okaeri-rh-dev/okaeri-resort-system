# Database Migration Consolidation Guide

## Current Migration Issues

The project currently has conflicting migration files that need consolidation:

### Existing Migration Files

1. `004_rls_optimization.sql` - Contains RLS setup and functions
2. `005_add_rls_policies.sql` - Contains duplicate functions and policies

### Problems Identified

- Duplicate function definitions (`current_project_id()` defined in both files)
- Inconsistent naming (`auth.user_id()` vs `current_user_id()`)
- Overly complex RLS policies for a family resort business
- Mix of global and project-specific configurations

## Recommended Consolidation

### Option 1: Simple Family Resort Setup (RECOMMENDED)

For a family resort with 1-3 properties, create a single, simple migration:

```sql
-- 006_simple_family_resort.sql
-- Simple setup for family resort business

BEGIN;

-- Basic project isolation (no RLS needed)
-- Just ensure all tables have project_id column

-- Add project_id to tables if not exists
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS project_id UUID NOT NULL;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS project_id UUID NOT NULL;

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS project_id UUID NOT NULL;

ALTER TABLE income
  ADD COLUMN IF NOT EXISTS project_id UUID NOT NULL;

-- Simple indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_project_dates
  ON bookings(project_id, check_in_date, check_out_date);

CREATE INDEX IF NOT EXISTS idx_payments_project
  ON payments(project_id, created_at);

CREATE INDEX IF NOT EXISTS idx_expenses_project
  ON expenses(project_id, date);

-- Basic constraints
ALTER TABLE bookings
  ADD CONSTRAINT bookings_project_code_unique
  UNIQUE(project_id, booking_code);

COMMIT;
```

### Option 2: Consolidate RLS (Only if Needed)

If RLS is actually required (unlikely for 1-3 properties), consolidate into one
file:

```sql
-- 006_consolidated_rls.sql
-- Only use if managing 10+ properties

BEGIN;

-- Single function definition (remove duplicates)
CREATE OR REPLACE FUNCTION current_project_id()
RETURNS UUID AS $$
  SELECT current_setting('app.current_project', true)::UUID;
$$ LANGUAGE sql STABLE;

-- Enable RLS on necessary tables only
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Simple policies
CREATE POLICY project_isolation ON bookings
  USING (project_id = current_project_id());

COMMIT;
```

## Migration Steps

### 1. Backup Current Database

```bash
pg_dump $DATABASE_URL > backup_before_consolidation.sql
```

### 2. Check Current State

```sql
-- Check which functions exist
SELECT proname, prosrc
FROM pg_proc
WHERE proname IN ('current_project_id', 'current_user_id');

-- Check RLS status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

### 3. Clean Up Duplicates

```sql
-- Remove duplicate functions if they exist
DROP FUNCTION IF EXISTS auth.user_id();
DROP FUNCTION IF EXISTS current_user_id();
DROP FUNCTION IF EXISTS current_project_id();
```

### 4. Apply Consolidated Migration

```bash
# For simple setup (recommended)
psql $DATABASE_URL -f migrations/006_simple_family_resort.sql

# OR for RLS (only if needed)
psql $DATABASE_URL -f migrations/006_consolidated_rls.sql
```

### 5. Mark Old Migrations as Applied

```sql
-- Record that old migrations have been consolidated
INSERT INTO schema_migrations (version, applied_at) VALUES
  ('004_rls_optimization', NOW()),
  ('005_add_rls_policies', NOW()),
  ('006_simple_family_resort', NOW())
ON CONFLICT (version) DO NOTHING;
```

## Application Code Changes

After consolidation, update your application code:

### Remove RLS Context Setting

```typescript
// OLD - Remove this
await db.execute(sql`
  SELECT set_config('app.current_project', ${projectId}, true)
`);

// NEW - Use simple filtering
const bookings = await db.query.bookings.findMany({
  where: eq(bookings.projectId, projectId),
});
```

### Update Service Layer

```typescript
// services/booking.service.ts
export class BookingService {
  // Simple, clear methods without RLS complexity
  async getBookingsForResort(resortId: string) {
    return db.query.bookings.findMany({
      where: eq(bookings.projectId, resortId),
      orderBy: [desc(bookings.checkInDate)],
    });
  }

  async createBooking(resortId: string, data: BookingInput) {
    return db.insert(bookings).values({
      ...data,
      projectId: resortId,
      createdAt: new Date(),
    });
  }
}
```

## Testing After Consolidation

### 1. Verify Table Structure

```sql
-- Check all tables have project_id
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'project_id';
```

### 2. Test Basic Operations

```typescript
// Test that filtering works correctly
const resort1Bookings = await getBookingsForResort("resort-1-id");
const resort2Bookings = await getBookingsForResort("resort-2-id");

// Verify no data leakage
expect(resort1Bookings.every((b) => b.projectId === "resort-1-id")).toBe(true);
expect(resort2Bookings.every((b) => b.projectId === "resort-2-id")).toBe(true);
```

### 3. Performance Check

```sql
-- Verify indexes are being used
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM bookings
WHERE project_id = 'test-id'
  AND check_in_date >= CURRENT_DATE;
```

## Rollback Plan

If issues occur, rollback to previous state:

```bash
# Restore from backup
psql $DATABASE_URL < backup_before_consolidation.sql

# Or manually revert
psql $DATABASE_URL -c "
  DROP FUNCTION IF EXISTS current_project_id();
  ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
  -- etc.
"
```

## Decision Matrix

| Scenario           | Recommended Approach                  | Migration File               |
| ------------------ | ------------------------------------- | ---------------------------- |
| 1-3 family resorts | Simple filtering                      | 006_simple_family_resort.sql |
| 4-9 properties     | Simple filtering with better indexing | 006_simple_family_resort.sql |
| 10+ properties     | Consider RLS                          | 006_consolidated_rls.sql     |
| Enterprise SaaS    | Full RLS implementation               | Custom enterprise migration  |

## Summary

For the Okaeri Resort System with 1-3 properties:

1. **Don't use RLS** - It's unnecessary complexity
2. **Consolidate migrations** into one simple file
3. **Use application-level filtering** with Drizzle ORM
4. **Keep it simple** - Family businesses need maintainable code

The existing RLS documentation should be marked as "advanced/future options" and
not used for the initial implementation.
