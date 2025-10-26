# Troubleshooting: Chunk 001

## Purpose

Common issues encountered during Chunk 001 implementation and their solutions. Organized by symptom for quick reference.

---

## Table of Contents

1. [Migration Execution Issues](#migration-execution-issues)
2. [Table Creation Failures](#table-creation-failures)
3. [Function Creation Errors](#function-creation-errors)
4. [Constraint Violations](#constraint-violations)
5. [Index Creation Problems](#index-creation-problems)
6. [RLS Policy Errors](#rls-policy-errors)
7. [TypeScript Type Generation](#typescript-type-generation)
8. [Pricing Function Errors](#pricing-function-errors)
9. [Data Integrity Issues](#data-integrity-issues)

---

## Migration Execution Issues

### Symptom: "Transaction aborted" or "Migration rolled back"

**Cause**: SQL syntax error or constraint violation during migration.

**Solution**:

1. **Find the exact error**:

   ```sql
   -- Check PostgreSQL logs in Supabase Dashboard → Logs → Postgres
   ```

2. **Run migration in sections**:
   Instead of running the entire migration at once, run each section separately:
   - Tables first
   - Functions second
   - Constraints third
   - Indexes fourth
   - RLS policies last

3. **Check for existing objects**:

   ```sql
   -- See if tables already exist
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('pricing_config', 'guest_booking_unit_requests');

   -- If they exist, drop them first (CAUTION: Only in development)
   DROP TABLE IF EXISTS guest_booking_unit_requests CASCADE;
   DROP TABLE IF EXISTS pricing_config CASCADE;
   DROP TABLE IF EXISTS discount_rules CASCADE;
   DROP TABLE IF EXISTS idempotency_keys CASCADE;
   ```

---

### Symptom: "Permission denied for table/function"

**Cause**: Using incorrect database credentials or insufficient permissions.

**Solution**:

1. **Verify you're using service_role key** (not anon key):

   ```bash
   # Check your .env file
   grep SUPABASE_SERVICE_ROLE_KEY .env

   # Service role key starts with "eyJ..." and is much longer than anon key
   ```

2. **Grant permissions manually** (if using custom role):

   ```sql
   GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
   GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;
   ```

3. **Use Supabase SQL Editor directly** (recommended):
   - Supabase SQL Editor runs as superuser by default
   - No permission issues

---

### Symptom: "Extension btree_gist does not exist"

**Cause**: Extension not enabled in database.

**Solution**:

```sql
-- Enable extension (requires superuser)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Verify it's installed
SELECT * FROM pg_extension WHERE extname = 'btree_gist';

-- If you don't have superuser access, contact Supabase support
-- Extension is required for EXCLUDE constraints
```

---

## Table Creation Failures

### Symptom: "Table already exists" error

**Cause**: Table was created in a previous migration attempt.

**Solution**:

**Option 1: Use IF NOT EXISTS** (already in migration):

```sql
CREATE TABLE IF NOT EXISTS pricing_config (...);
-- This should not error even if table exists
```

**Option 2: Drop and recreate** (destructive, development only):

```sql
-- CAUTION: This deletes all data
DROP TABLE IF EXISTS pricing_config CASCADE;
CREATE TABLE pricing_config (...);
```

**Option 3: Check table structure matches**:

```sql
-- Compare existing table to expected schema
\d+ pricing_config
```

---

### Symptom: "Column already exists" when extending bookings table

**Cause**: Columns were added in a previous attempt.

**Solution**:

Migration already uses `ADD COLUMN IF NOT EXISTS`:

```sql
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS is_multi_unit BOOLEAN DEFAULT FALSE;
```

If error persists:

```sql
-- Check which columns already exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bookings'
AND column_name IN (
  'is_multi_unit',
  'requested_unit_count',
  'discount_percent',
  'unit_assignment_status',
  'pricing_snapshot'
);

-- Drop specific column if needed (development only)
ALTER TABLE bookings DROP COLUMN IF EXISTS is_multi_unit;
```

---

### Symptom: "Foreign key constraint violation" during table creation

**Cause**: Trying to create `guest_booking_unit_requests` before `bookings` table exists.

**Solution**:

```sql
-- Verify bookings table exists
SELECT table_name FROM information_schema.tables
WHERE table_name = 'bookings' AND table_schema = 'public';

-- If missing, you need to create base schema first
-- See database/schema.sql or run migrations in order
```

---

## Function Creation Errors

### Symptom: "Function calculate_booking_pricing already exists"

**Cause**: Function was created in previous attempt.

**Solution**:

Migration uses `CREATE OR REPLACE FUNCTION`, so this shouldn't happen. If it does:

```sql
-- Drop function first
DROP FUNCTION IF EXISTS calculate_booking_pricing(JSONB, DATE, DATE);

-- Then recreate
CREATE OR REPLACE FUNCTION calculate_booking_pricing(...) RETURNS JSONB AS $$
...
$$;
```

---

### Symptom: "Function returns placeholder message"

**Cause**: This is **expected behavior** in Chunk 001.

**Verification**:

```sql
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-11-01'::DATE,
    '2025-11-04'::DATE
)->>'version';
-- Expected: '1.0.0-stub'
```

**If you need full pricing**: Move to Chunk 002 implementation.

---

### Symptom: "Function execution error: No pricing configuration found"

**Cause**: `pricing_config` table is empty (default row not inserted).

**Solution**:

```sql
-- Check if default row exists
SELECT * FROM pricing_config WHERE id = 'default';

-- If empty, insert default configuration
INSERT INTO pricing_config (
    id, base_rate, weekend_rate, extra_person_rate,
    base_occupancy, max_capacity_per_unit
) VALUES (
    'default',
    3000.00,
    3500.00,
    500.00,
    2,
    20
)
ON CONFLICT (id) DO NOTHING;
```

---

### Symptom: "Placeholder function doesn't calculate pricing"

**Cause**: This is **expected behavior** in Chunk 001. The placeholder function returns `total: 0.00` and `downpayment_required: 0.00`.

**Explanation**:
Full pricing logic (discounts, weekend rates, extra person fees) will be implemented in **Chunk 002**. The placeholder only validates input and calculates basic metrics (nights, units, guests).

**Verification**:

```sql
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-11-01'::DATE,
    '2025-11-04'::DATE
);

-- Expected in Chunk 001:
-- - version: "1.0.0-stub"
-- - total: 0.00
-- - downpayment_required: 0.00
-- - message: "PLACEHOLDER - Full pricing implementation in Chunk 002"
```

**To get real pricing**: Implement Chunk 002.

---

### Symptom: "Function returns wrong pricing values"

⚠️ **Note**: This section applies to **Chunk 002** (full pricing implementation), not Chunk 001 (placeholder).

**Cause**: Pricing config values are incorrect or weekend logic is broken (Chunk 002 only).

**Debug**:

```sql
-- Test function step-by-step
DO $$
DECLARE
    v_result JSONB;
BEGIN
    v_result := calculate_booking_pricing(
        '[{"guests_per_unit": 2}]'::JSONB,
        '2025-11-01'::DATE,
        '2025-11-04'::DATE
    );

    RAISE NOTICE 'Result: %', v_result;
    RAISE NOTICE 'Nights: %', v_result->>'nights';
    RAISE NOTICE 'Base Total: %', v_result->>'base_total';
    RAISE NOTICE 'Weekend Surcharge: %', v_result->>'weekend_surcharge';
    RAISE NOTICE 'Total: %', v_result->>'total';
END $$;
```

**Common Issues**:

1. **Weekend nights wrong**:
   - Friday = DOW 5, Saturday = DOW 6 in PostgreSQL
   - Check with: `SELECT EXTRACT(DOW FROM '2025-11-01'::DATE);`

2. **Extra person calculation wrong**:
   - Verify: `extra_persons = GREATEST(0, guests_per_unit - base_occupancy)`
   - Check config: `SELECT base_occupancy FROM pricing_config;`

3. **Discount not applying**:
   - Verify discount rules exist: `SELECT * FROM discount_rules WHERE is_active = TRUE;`
   - Check conditions match: Duration must be >= min_nights

---

### Symptom: "PL/pgSQL syntax error in function"

**Cause**: Copy-paste error or missing semicolons.

**Solution**:

1. **Find exact line**:
   Error message shows line number: `ERROR: syntax error at or near "END" LINE 42`

2. **Common syntax issues**:
   - Missing semicolon after statement
   - Missing `END IF;` or `END LOOP;`
   - Incorrect variable declaration
   - Missing `$$` at function end

3. **Validate function separately**:
   ```sql
   -- Test function creation in isolation
   CREATE OR REPLACE FUNCTION test_function() RETURNS VOID AS $$
   BEGIN
       RAISE NOTICE 'Test';
   END;
   $$ LANGUAGE plpgsql;
   ```

---

## Constraint Violations

### Symptom: "Check constraint payment_before_assignment violated"

**Cause**: This is **expected behavior** when testing the constraint.

**Verification**:

```sql
-- This SHOULD fail (constraint working correctly)
UPDATE bookings
SET unit_assignment_status = 'assigned'
WHERE payment_status = 'Pending';

-- ERROR: new row violates check constraint "payment_before_assignment"
-- ✅ This error means constraint is working!
```

**If constraint doesn't fire** (test passes when it should fail):

```sql
-- Verify constraint exists
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
AND conname = 'payment_before_assignment';

-- Re-add constraint if missing
ALTER TABLE bookings
ADD CONSTRAINT payment_before_assignment CHECK (
    unit_assignment_status != 'assigned' OR payment_status IN ('Verified', 'Completed', 'Paid')
);
```

---

### Symptom: "Check constraint valid_discount_value violated"

**Cause**: Trying to insert invalid discount values.

**Solution**:

```sql
-- Check the rule
SELECT * FROM discount_rules WHERE id = '<failing-rule-id>';

-- Constraints:
-- 1. discount_value > 0
-- 2. If percentage, discount_value <= 100

-- Fix data
UPDATE discount_rules
SET discount_value = 5.00  -- Valid percentage
WHERE id = '<rule-id>';
```

---

### Symptom: "Unique violation on pricing_config.id"

**Cause**: Trying to insert second row into singleton table (expected behavior).

**Verification**:

```sql
-- This SHOULD fail (singleton pattern working)
INSERT INTO pricing_config (id, base_rate, weekend_rate, max_capacity_per_unit)
VALUES ('another', 5000, 6000, 25);

-- ERROR: duplicate key value violates unique constraint
-- ✅ This error means singleton pattern is working!
```

**If you need to update config**:

```sql
-- Use UPDATE instead of INSERT
UPDATE pricing_config
SET base_rate = 3500.00,
    weekend_rate = 4000.00
WHERE id = 'default';
```

---

## Index Creation Problems

### Symptom: "Index already exists"

**Cause**: Index created in previous migration attempt.

**Solution**:

Migration uses `CREATE INDEX IF NOT EXISTS`:

```sql
CREATE INDEX IF NOT EXISTS idx_guest_booking_requests_booking
ON guest_booking_unit_requests(booking_id);
```

If error persists:

```sql
-- Drop and recreate
DROP INDEX IF EXISTS idx_guest_booking_requests_booking;
CREATE INDEX idx_guest_booking_requests_booking
ON guest_booking_unit_requests(booking_id);
```

---

### Symptom: "Cannot create GIN index on discount_rules.conditions"

**Cause**: JSONB column or GIN operator class not available.

**Solution**:

```sql
-- Verify column type
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'discount_rules'
AND column_name = 'conditions';
-- Should be: jsonb

-- Create index with explicit operator class
CREATE INDEX idx_discount_rules_conditions
ON discount_rules USING gin(conditions jsonb_path_ops);

-- If still fails, check PostgreSQL version
SELECT version();
-- GIN indexes on JSONB require PostgreSQL 9.4+
```

---

## RLS Policy Errors

### Symptom: "RLS policy references undefined function auth.jwt()"

**Cause**: Supabase auth schema not available or incorrect policy syntax.

**Solution**:

1. **Check if using Supabase** (auth.jwt() only works on Supabase):

   ```sql
   -- Verify auth schema exists
   SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'auth';
   ```

2. **Use correct Supabase RLS pattern**:

   ```sql
   -- ✅ CORRECT (Supabase)
   CREATE POLICY pricing_config_select_policy ON pricing_config
       FOR SELECT TO authenticated, anon
       USING (true);

   -- For admin checks, use app_roles table lookup
   USING (
       (SELECT app_role FROM app_roles
        WHERE user_id = auth.uid()
        AND is_active = TRUE
        LIMIT 1) = 'admin'
   )
   ```

3. **If not using Supabase**, replace with standard PostgreSQL RLS:
   ```sql
   -- Standard PostgreSQL (no Supabase)
   CREATE POLICY pricing_config_select_policy ON pricing_config
       FOR SELECT TO PUBLIC
       USING (true);
   ```

---

### Symptom: "Row level security policy blocks INSERT/SELECT"

**Cause**: RLS policies too restrictive or service_role not being used.

**Solution**:

1. **Verify service_role bypasses RLS**:

   ```sql
   -- Service role should bypass RLS automatically
   -- Test with service_role key in Supabase client
   ```

2. **Temporarily disable RLS for debugging**:

   ```sql
   -- CAUTION: Development only
   ALTER TABLE pricing_config DISABLE ROW LEVEL SECURITY;

   -- Test operations

   -- Re-enable
   ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;
   ```

3. **Add service_role policy**:
   ```sql
   CREATE POLICY allow_service_role ON pricing_config
       FOR ALL TO service_role
       USING (true) WITH CHECK (true);
   ```

---

## TypeScript Type Generation

### Symptom: "npx supabase gen types command not found"

**Cause**: Supabase CLI not installed.

**Solution**:

```bash
# Install Supabase CLI
npm install -g supabase

# Verify installation
supabase --version

# Generate types
npx supabase gen types typescript --project-id <your-project-id> > src/types/database.types.ts
```

---

### Symptom: "Type generation fails with authentication error"

**Cause**: Missing or incorrect project ID or access token.

**Solution**:

1. **Get project ID**:
   - Supabase Dashboard → Settings → General → Reference ID

2. **Login to Supabase CLI**:

   ```bash
   npx supabase login
   # Opens browser for authentication
   ```

3. **Generate types with project ref**:

   ```bash
   npx supabase gen types typescript --project-id <your-ref> > src/types/database.types.ts
   ```

4. **Alternative: Use direct database URL**:
   ```bash
   npx supabase gen types typescript --db-url "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres" > src/types/database.types.ts
   ```

---

### Symptom: "Generated types missing new tables"

**Cause**: Type generation cached old schema or migration not applied.

**Solution**:

1. **Verify tables exist in database**:

   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   ORDER BY table_name;
   ```

2. **Force regenerate types**:

   ```bash
   # Delete old types
   rm src/types/database.types.ts

   # Regenerate
   npx supabase gen types typescript --project-id <your-ref> > src/types/database.types.ts
   ```

3. **Check generated file**:
   ```bash
   grep -i "pricing_config" src/types/database.types.ts
   # Should show type definition
   ```

---

### Symptom: "TypeScript errors after type generation"

**Cause**: Breaking changes in table structure or missing columns.

**Solution**:

1. **Identify the error**:

   ```bash
   npm run type-check 2>&1 | grep "error TS"
   ```

2. **Common type errors**:

   **Error**: `Property 'is_multi_unit' does not exist on type 'Booking'`

   ```typescript
   // Fix: Type not regenerated properly
   // Regenerate types from database
   ```

   **Error**: `Type 'boolean | null' is not assignable to type 'boolean'`

   ```typescript
   // Fix: Handle nullable columns
   const isMultiUnit = booking.is_multi_unit ?? false;
   ```

3. **Verify type matches schema**:
   ```sql
   -- Check actual column type
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'bookings'
   AND column_name = 'is_multi_unit';
   ```

---

## Pricing Function Errors

⚠️ **Important**: The pricing function in Chunk 001 is a **PLACEHOLDER**. Most pricing-related troubleshooting applies to **Chunk 002** (full implementation).

**Chunk 001 placeholder behavior:**

- Returns version: "1.0.0-stub"
- Sets total and downpayment to 0.00
- Only validates dates and calculates basic metrics

**For full pricing troubleshooting**, see Chunk 002's troubleshooting.md.

---

### Symptom: "Invalid date range" exception

**Cause**: Check-out date is before or equal to check-in date.

**Solution**:

```sql
-- Function validates: check_out > check_in
-- Test with valid dates
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-11-01'::DATE,  -- Check-in
    '2025-11-04'::DATE   -- Check-out (must be AFTER check-in)
);

-- ❌ This SHOULD fail
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    '2025-11-01'::DATE,
    '2025-11-01'::DATE  -- Same day - INVALID
);
```

---

### Symptom: "Discount not applied when it should be"

**Cause**: Discount conditions not matching or rule inactive.

**Debug**:

```sql
-- 1. Check discount rules
SELECT id, name, discount_value, is_active, conditions
FROM discount_rules
WHERE is_active = TRUE
ORDER BY priority;

-- 2. Test specific condition
-- For 7-night booking:
SELECT
    name,
    conditions,
    CASE
        WHEN conditions @> '[{"type": "min_nights"}]'::jsonb
            AND 7 >= (conditions->0->>'value')::INTEGER
        THEN '✅ MATCHES'
        ELSE '❌ NO MATCH'
    END AS matches
FROM discount_rules
WHERE is_active = TRUE;

-- 3. Manually test pricing
SELECT calculate_booking_pricing(
    '[{"guests_per_unit": 2}]'::JSONB,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '7 days'
) -> 'discount';
-- Should return discount object, not null
```

**Solution**:

1. **Activate rule** if inactive:

   ```sql
   UPDATE discount_rules
   SET is_active = TRUE
   WHERE name = 'Week Stay Discount';
   ```

2. **Check condition format**:
   ```sql
   -- Correct format
   UPDATE discount_rules
   SET conditions = '[{"type": "min_nights", "value": 7}]'::JSONB
   WHERE name = 'Week Stay Discount';
   ```

---

### Symptom: "Extra person fees calculated incorrectly"

**Cause**: Base occupancy configuration wrong or calculation logic error.

**Debug**:

```sql
-- Check base occupancy
SELECT base_occupancy, extra_person_rate
FROM pricing_config WHERE id = 'default';
-- Expected: base_occupancy = 2, extra_person_rate = 500.00

-- Manual calculation for 4 guests
-- Extra persons = 4 - 2 = 2
-- Extra fees = 2 * 500 * nights
-- For 3 nights = 2 * 500 * 3 = 3000.00

-- Test function
SELECT
    (pricing->'extra_person_fees')::DECIMAL AS extra_fees,
    CASE
        WHEN (pricing->'extra_person_fees')::DECIMAL = 3000.00
        THEN '✅ CORRECT'
        ELSE '❌ WRONG'
    END AS status
FROM (
    SELECT calculate_booking_pricing(
        '[{"guests_per_unit": 4}]'::JSONB,  -- 4 guests
        '2025-11-01'::DATE,
        '2025-11-04'::DATE  -- 3 nights
    ) AS pricing
) AS test;
```

---

## Data Integrity Issues

### Symptom: "Orphaned records in guest_booking_unit_requests"

**Cause**: Booking deleted but unit requests remained.

**Solution**:

```sql
-- Check for orphans
SELECT gbur.id, gbur.booking_id
FROM guest_booking_unit_requests gbur
LEFT JOIN bookings b ON b.booking_id = gbur.booking_id
WHERE b.booking_id IS NULL;

-- Clean up orphans
DELETE FROM guest_booking_unit_requests
WHERE booking_id NOT IN (SELECT booking_id FROM bookings);

-- Prevention: ON DELETE CASCADE is already set
-- Verify cascade
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.table_name = 'guest_booking_unit_requests'
AND tc.constraint_type = 'FOREIGN KEY';
-- delete_rule should be 'CASCADE'
```

---

### Symptom: "Idempotency keys not expiring"

**Cause**: Cleanup function not running or expires_at not set.

**Solution**:

```sql
-- Check for expired keys that should be deleted
SELECT key, created_at, expires_at,
    CASE
        WHEN expires_at < NOW() THEN '⏰ EXPIRED'
        ELSE '✅ ACTIVE'
    END AS status
FROM idempotency_keys;

-- Manually run cleanup
SELECT cleanup_expired_idempotency_keys();
-- Returns number of deleted keys

-- Verify expires_at is set correctly (48 hours from creation)
SELECT
    created_at,
    expires_at,
    expires_at - created_at AS expiry_interval
FROM idempotency_keys
LIMIT 5;
-- expiry_interval should be '2 days'
```

---

## Still Stuck?

### Escalation Path

1. **Check Supabase Status**: https://status.supabase.com
   - Verify no ongoing incidents

2. **Review Supabase Logs**:
   - Dashboard → Logs → Postgres
   - Look for detailed error messages

3. **Search Supabase Discord/GitHub**:
   - Discord: https://discord.supabase.com
   - GitHub Issues: https://github.com/supabase/supabase/issues

4. **Create Minimal Reproduction**:

   ```sql
   -- Isolate failing query
   -- Test in fresh database
   -- Share exact error message
   ```

5. **Ask for Help** (provide these details):
   - Exact error message (copy-paste)
   - PostgreSQL version: `SELECT version();`
   - Supabase project region
   - Migration SQL that failed
   - Which checkpoint test failed
   - Steps already tried

### Emergency Rollback

If chunk is completely broken and you need to start over:

```sql
-- ⚠️ DESTRUCTIVE: Only in development
BEGIN;

-- Drop all new objects
DROP TABLE IF EXISTS guest_booking_unit_requests CASCADE;
DROP TABLE IF EXISTS pricing_config CASCADE;
DROP TABLE IF EXISTS discount_rules CASCADE;
DROP TABLE IF EXISTS idempotency_keys CASCADE;

DROP FUNCTION IF EXISTS calculate_booking_pricing(JSONB, DATE, DATE);
DROP FUNCTION IF EXISTS create_guest_booking(JSONB, JSONB, JSONB, UUID);
DROP FUNCTION IF EXISTS assign_units_to_booking(UUID, UUID[]);
DROP FUNCTION IF EXISTS cleanup_expired_idempotency_keys();
DROP FUNCTION IF EXISTS cleanup_expired_payment_proofs();

-- Remove bookings extensions
ALTER TABLE bookings DROP COLUMN IF EXISTS is_multi_unit;
ALTER TABLE bookings DROP COLUMN IF EXISTS requested_unit_count;
ALTER TABLE bookings DROP COLUMN IF EXISTS discount_percent;
ALTER TABLE bookings DROP COLUMN IF EXISTS discount_amount;
ALTER TABLE bookings DROP COLUMN IF EXISTS downpayment_required;
ALTER TABLE bookings DROP COLUMN IF EXISTS unit_assignment_status;
ALTER TABLE bookings DROP COLUMN IF EXISTS pricing_snapshot;
ALTER TABLE bookings DROP COLUMN IF EXISTS is_guest_booking;

-- Remove constraint
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS payment_before_assignment;

COMMIT;

-- Restore from backup
-- See instructions.md Step 1 for backup restoration
```

---

**Remember**: Most issues have simple solutions. Take a breath, read the error carefully, and check the relevant section above. You've got this! 🚀
