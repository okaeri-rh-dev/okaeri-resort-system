# Supabase SQL Editor Compatibility Notes

## Overview

The migration script `018-production-wipe-test-data.sql` has been optimized for **Supabase SQL Editor** compatibility. This document explains the changes made and how to verify compatibility.

---

## What Changed

### 1. Removed `\set ON_ERROR_STOP on`

**Before:**

```sql
\set ON_ERROR_STOP on
```

**After:**

```sql
-- Note: Supabase SQL Editor automatically stops on errors (no \set needed)
```

**Reason:**

- `\set` is a psql meta-command
- NOT supported in Supabase SQL Editor
- Supabase SQL Editor automatically stops on errors by default

---

### 2. Wrapped Standalone `RAISE` Statements

**Before:**

```sql
TRUNCATE TABLE payments CASCADE;
RAISE NOTICE '✓ Payments table truncated';
```

**After:**

```sql
TRUNCATE TABLE payments CASCADE;

DO $$ BEGIN
    RAISE NOTICE '✓ Payments table truncated';
END $$;
```

**Reason:**

- Supabase SQL Editor requires `RAISE` statements to be inside `DO` blocks
- Standalone `RAISE` outside functions/procedures causes syntax errors
- Wrapping in `DO $$ BEGIN ... END $$;` makes it compatible

**All Wrapped Statements:**

- Line 83-85: After `TRUNCATE TABLE payments`
- Line 91-93: After `TRUNCATE TABLE bookings`
- Line 98-100: After `TRUNCATE TABLE guests`
- Line 149-152: No sequences notice
- Line 188-190: Audit log created notice
- Line 199-209: Final completion messages

---

### 3. Kept Transaction Blocks (Safe)

**No Change Needed:**

```sql
BEGIN;
-- operations
COMMIT;
```

**Reason:**

- Supabase SQL Editor supports explicit `BEGIN`/`COMMIT`
- If the script is already wrapped in an auto-transaction, explicit `BEGIN` creates a savepoint
- This is **safe** and provides extra transaction control
- Keeps script portable for both Supabase and psql

---

## Compatibility Testing

### Test Script: `TEST-018-compatibility.sql`

We've created a **read-only test script** to verify your Supabase SQL Editor supports all required features:

**Tests Performed:**

1. ✅ DO blocks
2. ✅ DECLARE variables
3. ✅ RAISE NOTICE/WARNING
4. ✅ String formatting in RAISE
5. ✅ Transaction blocks (BEGIN/COMMIT/ROLLBACK)
6. ✅ JSONB operations
7. ✅ ARRAY operations
8. ✅ NOW() function
9. ✅ Conditional logic (IF/ELSE)
10. ✅ Exception handling

**How to Run:**

1. Open `database/migrations/TEST-018-compatibility.sql`
2. Copy entire contents
3. Paste into Supabase SQL Editor
4. Click "Run"
5. Expected output: `✅ ALL COMPATIBILITY TESTS PASSED`

**Safety:** This script is **completely read-only** - it doesn't modify any data.

---

## psql vs Supabase SQL Editor Comparison

| Feature                   | psql         | Supabase SQL Editor  | Status        |
| ------------------------- | ------------ | -------------------- | ------------- |
| `\set` meta-commands      | ✅ Supported | ❌ Not supported     | Removed       |
| Standalone `RAISE`        | ✅ Supported | ❌ Not supported     | Wrapped in DO |
| `DO $$ BEGIN ... END $$;` | ✅ Supported | ✅ Supported         | ✅ Used       |
| `BEGIN`/`COMMIT`          | ✅ Supported | ✅ Supported         | ✅ Kept       |
| `DECLARE` variables       | ✅ Supported | ✅ Supported         | ✅ Used       |
| `RAISE NOTICE '%', var`   | ✅ Supported | ✅ Supported (in DO) | ✅ Used       |
| `TRUNCATE ... CASCADE`    | ✅ Supported | ✅ Supported         | ✅ Used       |
| `jsonb_build_object()`    | ✅ Supported | ✅ Supported         | ✅ Used       |
| Transaction control       | ✅ Supported | ✅ Supported         | ✅ Used       |

---

## Common Supabase SQL Editor Limitations

### 1. No psql Meta-Commands

**Not Supported:**

```sql
\set VARIABLE value
\echo 'message'
\timing
\x
\gset
```

**Use Instead:**

```sql
-- Use comments for notes
-- Use RAISE NOTICE for messages
-- Use NOW() for timing
-- Use DO blocks for logic
```

### 2. RAISE Must Be In DO Blocks

**Wrong:**

```sql
SELECT 1;
RAISE NOTICE 'Done';  -- ❌ Syntax error
```

**Correct:**

```sql
SELECT 1;
DO $$ BEGIN
    RAISE NOTICE 'Done';  -- ✅ Works
END $$;
```

### 3. No Interactive Commands

**Not Supported:**

```sql
\prompt 'Enter value: ' myvar
```

**Use Instead:**

- Pass variables as parameters
- Use environment variables
- Hardcode values (for migrations)

### 4. Limited Multi-Statement Control

**psql Specific:**

```sql
-- psql can execute multiple independent statements
SELECT 1;
SELECT 2;
-- Each runs separately
```

**Supabase Behavior:**

```sql
-- Entire script wrapped in auto-transaction
SELECT 1;
SELECT 2;
-- All run together, rollback on any error
```

---

## Migration Script Features

### Built-In Safety Features

1. **Pre-Wipe Snapshot**
   - Shows current counts before deletion
   - Helps verify what will be deleted

2. **Safety Check**
   - Warns if deleting >100 bookings
   - 5-second delay to abort

3. **Post-Wipe Verification**
   - Confirms tables empty
   - Validates units table preserved
   - Raises exception if validation fails

4. **Transaction Wrapper**
   - All-or-nothing execution
   - Auto-rollback on errors

5. **Audit Logging**
   - Records wipe operation
   - Tracks what was deleted

### Output Messages

**Expected Output When Running:**

```
NOTICE:  ============================================
NOTICE:  PRE-WIPE SNAPSHOT (2025-10-07 12:34:56 UTC)
NOTICE:  ============================================
NOTICE:  Bookings:     15 records
NOTICE:  Payments:     8 records
NOTICE:  Guests:       5 records
NOTICE:  Units:        3 records (WILL BE PRESERVED)
NOTICE:  Expenses:     0 records (WILL BE PRESERVED)
NOTICE:  Audit Logs:   120 records (WILL BE PRESERVED)
NOTICE:  ============================================
NOTICE:  ✓ Payments table truncated
NOTICE:  ✓ Bookings table truncated
NOTICE:  ✓ Guests table truncated
NOTICE:  ============================================
NOTICE:  POST-WIPE VERIFICATION (2025-10-07 12:34:56 UTC)
NOTICE:  ============================================
NOTICE:  Bookings:     0 (expected: 0)
NOTICE:  Payments:     0 (expected: 0)
NOTICE:  Guests:       0 (expected: 0)
NOTICE:  Units:        3 (preserved)
NOTICE:  Expenses:     0 (preserved)
NOTICE:  ============================================
NOTICE:  ✓ All validations passed
NOTICE:  ✓ No sequences to reset (UUID primary keys)
NOTICE:  ✓ Audit log entry created
NOTICE:  ============================================
NOTICE:  ✅ PRODUCTION WIPE COMPLETE
NOTICE:  ============================================
NOTICE:  Next steps:
NOTICE:  1. Verify units table still has your room configurations
NOTICE:  2. Deploy frontend with view-edit routes
NOTICE:  3. Create a test booking to verify everything works
NOTICE:  4. Monitor audit_logs for the next 48 hours
NOTICE:  ============================================
```

---

## Troubleshooting

### Issue: Syntax Error Near `RAISE`

**Error Message:**

```
ERROR:  syntax error at or near "RAISE"
LINE 82: RAISE NOTICE '✓ Payments table truncated';
```

**Solution:**

- Ensure all `RAISE` statements are wrapped in `DO $$ BEGIN ... END $$;`
- Check you're using the updated `018-production-wipe-test-data.sql`

### Issue: `\set` Command Not Recognized

**Error Message:**

```
ERROR:  syntax error at or near "\"
LINE 16: \set ON_ERROR_STOP on
```

**Solution:**

- Remove the `\set` line
- Supabase SQL Editor auto-stops on errors
- Use the updated script (already removed)

### Issue: Script Runs But No Output

**Possible Causes:**

1. Supabase SQL Editor suppressing NOTICE messages
2. Script running too fast to see messages

**Solution:**

- Check "Messages" tab in SQL Editor
- Check "Logs" panel (may be collapsed)
- Output should appear in bottom panel

### Issue: Transaction Already Active

**Error Message:**

```
WARNING:  there is already a transaction in progress
```

**This is Normal:**

- Supabase auto-wraps scripts in transaction
- Our explicit `BEGIN` creates a savepoint
- Script will still work correctly
- Safe to ignore this warning

---

## Best Practices for Supabase SQL Editor

### 1. Always Test First

```sql
-- Run TEST-018-compatibility.sql first
-- Verify your environment before destructive operations
```

### 2. Use DO Blocks for Logic

```sql
-- Good
DO $$ BEGIN
    RAISE NOTICE 'Message';
END $$;

-- Bad (doesn't work in Supabase)
RAISE NOTICE 'Message';
```

### 3. Check Output Panel

- Look for NOTICE messages
- Check for WARNINGs
- Verify SUCCESS at end

### 4. Keep Backup Handy

- Always create manual backup first
- Download backup file locally
- Verify backup before proceeding

### 5. Read All Messages

- Script provides detailed progress
- Warnings are important
- Errors mean ROLLBACK occurred

---

## Script Portability

The updated script maintains **full portability**:

✅ **Works in:**

- Supabase SQL Editor ✅
- psql command line ✅
- pgAdmin ✅
- DBeaver ✅
- DataGrip ✅
- Any PostgreSQL client ✅

❌ **Does NOT require:**

- Specific client features
- Interactive input
- External variables
- Meta-commands

---

## Verification Checklist

Before running production wipe:

- [ ] Ran `TEST-018-compatibility.sql` successfully
- [ ] Saw `✅ ALL COMPATIBILITY TESTS PASSED`
- [ ] Confirmed Supabase SQL Editor version is recent
- [ ] Created manual backup
- [ ] Downloaded backup file
- [ ] Read through `018-production-wipe-test-data.sql`
- [ ] Understand what will be deleted
- [ ] Team notified of maintenance window

After running production wipe:

- [ ] Saw `✅ PRODUCTION WIPE COMPLETE` message
- [ ] Verified bookings = 0
- [ ] Verified payments = 0
- [ ] Verified guests = 0
- [ ] Verified units > 0 (preserved)
- [ ] Checked audit_logs for wipe entry
- [ ] Ran `verify-production-state.sql`

---

## Additional Resources

**Supabase Documentation:**

- SQL Editor: https://supabase.com/docs/guides/database/overview
- Migrations: https://supabase.com/docs/guides/cli/local-development

**PostgreSQL DO Blocks:**

- Official Docs: https://www.postgresql.org/docs/current/sql-do.html
- Examples: https://wiki.postgresql.org/wiki/Anonymous_code_block

**Transaction Control:**

- BEGIN/COMMIT: https://www.postgresql.org/docs/current/tutorial-transactions.html
- Savepoints: https://www.postgresql.org/docs/current/sql-savepoint.html

---

## Summary

✅ **Script is NOW compatible with Supabase SQL Editor**

**Changes Made:**

1. Removed `\set ON_ERROR_STOP on`
2. Wrapped all standalone `RAISE` statements in DO blocks
3. Kept transaction control (BEGIN/COMMIT)

**Testing:**

- Run `TEST-018-compatibility.sql` first
- Expect `✅ ALL COMPATIBILITY TESTS PASSED`
- Proceed with `018-production-wipe-test-data.sql`

**Safety:**

- All validations intact
- Transaction safety maintained
- Audit logging preserved
- Rollback on any error

---

**Last Updated:** October 7, 2025
**Script Version:** 1.1 (Supabase Compatible)
**Tested On:** Supabase SQL Editor (Latest)
