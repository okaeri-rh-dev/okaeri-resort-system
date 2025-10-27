# Code Review Findings: Chunk 003 Security Constraints

**Review Date**: 2025-01-27
**Reviewer**: code-quality-reviewer agent
**Overall Score**: 8.5/10
**Production Readiness**: READY WITH CAVEATS

---

## Executive Summary

Migration 022 is **professional-grade database engineering** with thoughtful security controls and Filipino cultural awareness. The implementation demonstrates mastery of PostgreSQL constraints, audit patterns, and concurrency control.

**However**, three critical issues must be addressed before production deployment:

1. **Sensitive Data Exposure** in audit logs (PCI-DSS compliance risk)
2. **Race Condition** in all-or-nothing constraint (can allow partial assignments)
3. **Audit Trigger Logic Bug** (may miss DELETE audit entries)

With these fixes applied, the migration will provide a robust, compliant, and performant security layer.

---

## Critical Issues (MUST FIX)

### Issue #1: Sensitive Data Exposure in Audit Logs

**Severity**: CRITICAL
**Location**: `022-security-constraints-audit.sql` lines 184-187, 195-196, 211-214
**Risk**: PCI-DSS violation, BIR data protection breach

**Problem:**

```sql
-- Current code assumes all tables have 'payment_details' field
v_changes := jsonb_build_object(
    'before', NULL,
    'after', row_to_json(NEW)::JSONB - 'payment_details'
);
```

The code attempts to exclude `payment_details` from all tables, but:

- Not all tables have this field (silently fails)
- Other sensitive fields (`payment_method`, `payment_proof_url`) are still logged
- No table-specific filtering logic

**Impact:**

- Payment information logged in plaintext
- Violates PCI-DSS requirements
- BIR compliance risk (excessive data retention)

**Recommended Fix:**
Create a helper function to get sensitive fields per table, then exclude them dynamically:

```sql
CREATE OR REPLACE FUNCTION get_sensitive_fields(p_table_name text)
RETURNS text[] AS $$
BEGIN
    RETURN CASE p_table_name
        WHEN 'bookings' THEN ARRAY['payment_method', 'payment_proof_url']
        WHEN 'payments' THEN ARRAY['payment_details', 'transaction_reference']
        ELSE ARRAY[]::text[]
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

Then update the audit trigger to use this function.

**Action Items:**

- [ ] Create `get_sensitive_fields()` helper function
- [ ] Update `audit_log_trigger()` to use dynamic field exclusion
- [ ] Test with real payment data to verify exclusion
- [ ] Document which fields are excluded for each table

---

### Issue #2: Race Condition in All-or-Nothing Constraint

**Severity**: CRITICAL
**Location**: `022-security-constraints-audit.sql` lines 50-63
**Risk**: Partial assignments possible under concurrency

**Problem:**

```sql
ALTER TABLE bookings
ADD CONSTRAINT all_or_nothing_assignment CHECK (
    unit_assignment_status != 'assigned' OR (
        (SELECT COUNT(*) FROM booking_units WHERE ... status = 'confirmed')
        =
        (SELECT COUNT(*) FROM guest_booking_unit_requests WHERE ...)
    )
);
```

CHECK constraints evaluate subqueries at statement time, not transaction commit time. This creates a race window:

1. **Transaction A**: Updates booking to 'assigned', sees 3/3 units → PASS
2. **Transaction B** (concurrent): Cancels 1 booking_unit
3. **Transaction A**: Commits (constraint already checked)
4. **Result**: Database has partial assignment (2/3 units)

**Impact:**

- Partial assignments during peak season (Holy Week, Christmas)
- Customer disputes ("We paid for 5 cottages, got 3")
- Violates "sama-sama o wala" business rule

**Recommended Fix:**
Convert CHECK constraint to BEFORE UPDATE trigger with explicit row locking:

```sql
CREATE OR REPLACE FUNCTION enforce_all_or_nothing()
RETURNS TRIGGER AS $$
DECLARE
    v_confirmed_count INT;
    v_requested_count INT;
BEGIN
    IF NEW.unit_assignment_status = 'assigned' THEN
        -- Lock rows to prevent concurrent modifications
        SELECT COUNT(*) INTO v_confirmed_count
        FROM booking_units
        WHERE booking_id = NEW.booking_id
        AND status = 'confirmed'
        FOR UPDATE;  -- Critical: locks rows

        SELECT COUNT(*) INTO v_requested_count
        FROM guest_booking_unit_requests
        WHERE booking_id = NEW.booking_id
        FOR UPDATE;  -- Critical: locks rows

        IF v_confirmed_count != v_requested_count THEN
            RAISE EXCEPTION 'All-or-nothing violated: % confirmed != % requested',
                v_confirmed_count, v_requested_count;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_all_or_nothing_trigger
    BEFORE UPDATE OF unit_assignment_status ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION enforce_all_or_nothing();
```

**Action Items:**

- [ ] Replace CHECK constraint with BEFORE UPDATE trigger
- [ ] Add `FOR UPDATE` row locking to queries
- [ ] Test under concurrent load (simulate 50 simultaneous assignments)
- [ ] Document locking behavior in comments

---

### Issue #3: Audit Trigger WHEN Clause Logic Bug

**Severity**: CRITICAL
**Location**: `022-security-constraints-audit.sql` lines 269-273
**Risk**: Missing audit entries for DELETE operations

**Problem:**

```sql
CREATE TRIGGER audit_bookings_trigger
    AFTER INSERT OR UPDATE OR DELETE ON bookings
    FOR EACH ROW
    WHEN (
        (NEW.is_guest_booking IS TRUE AND NEW.is_multi_unit IS TRUE)
        OR
        (OLD.is_guest_booking IS TRUE AND OLD.is_multi_unit IS TRUE)
    )
    EXECUTE FUNCTION audit_log_trigger();
```

Issues:

- For INSERT: `OLD` is NULL → `OLD.is_guest_booking IS TRUE` → FALSE
- For DELETE: `NEW` is NULL → `NEW.is_guest_booking IS TRUE` → FALSE
- The OR saves it, but semantically wrong
- If booking changes from `is_multi_unit=TRUE` to `FALSE` then DELETE, audit is skipped

**Impact:**

- Missing audit trail for some DELETE operations
- BIR compliance failure (incomplete audit logs)
- Cannot investigate booking cancellations

**Recommended Fix:**
Make WHEN clause operation-aware:

```sql
CREATE TRIGGER audit_bookings_trigger
    AFTER INSERT OR UPDATE OR DELETE ON bookings
    FOR EACH ROW
    WHEN (
        (TG_OP = 'INSERT' AND NEW.is_guest_booking IS TRUE AND NEW.is_multi_unit IS TRUE)
        OR
        (TG_OP = 'UPDATE' AND (
            (NEW.is_guest_booking IS TRUE AND NEW.is_multi_unit IS TRUE) OR
            (OLD.is_guest_booking IS TRUE AND OLD.is_multi_unit IS TRUE)
        ))
        OR
        (TG_OP = 'DELETE' AND OLD.is_guest_booking IS TRUE AND OLD.is_multi_unit IS TRUE)
    )
    EXECUTE FUNCTION audit_log_trigger();
```

**Action Items:**

- [ ] Update WHEN clause with TG_OP checks
- [ ] Test INSERT, UPDATE, DELETE with multi-unit bookings
- [ ] Test UPDATE from multi-unit to single-unit (should still audit)
- [ ] Verify audit logs after DELETE operations

---

## High Priority Recommendations

### Incomplete Error Handling in Auth Functions

**Location**: Lines 167-173
**Risk**: Silent failures mask configuration errors

Replace `EXCEPTION WHEN OTHERS` with specific exception handling and logging.

### Missing Timezone Handling in check_availability()

**Location**: Lines 365-380
**Risk**: Date boundary ambiguity

Use `TIMESTAMPTZ` parameters or explicitly document timezone assumptions.

### Insufficient Indexes on audit_logs

**Location**: Lines 129-144
**Risk**: Slow compliance queries

Add composite indexes for common query patterns:

- User activity timeline
- Table-action-date lookups
- Record change history

---

## Medium Priority Suggestions

1. **Audit Log Retention Policy**: Define 5-year BIR compliance archival strategy
2. **IP Address Validation**: Verify Cloudflare proxy headers, detect private IPs
3. **RLS Policy Clarity**: Separate service role policies for SELECT/INSERT (no DELETE)
4. **Constraint Verification**: Check constraint definition matches expected logic

---

## Strengths (What Was Done Well)

✅ **Excellent Documentation**: Culturally aware comments ("sama-sama o wala", GCash, "paasa bookings")
✅ **Idempotent Design**: Extensive use of `DROP IF EXISTS`, safe to re-run
✅ **Security-First**: Multiple layers (EXCLUDE, CHECK, RLS, audit)
✅ **MVCC-Aware**: Proper use of GiST indexes for concurrency
✅ **Comprehensive Testing**: 17 SQL tests cover positive and negative cases
✅ **Performance Conscious**: Partial indexes, generated columns
✅ **Compliance-Oriented**: BIR/DTI requirements documented

---

## Production Deployment Checklist

### Before Applying Migration:

- [ ] Verify migration 021 successfully applied
- [ ] Backup production database
- [ ] Test on staging with production-sized dataset
- [ ] Verify btree_gist extension available
- [ ] Check disk space for audit_logs growth

### After Applying Migration:

- [ ] Verify all 3 constraints active
- [ ] Test double-booking prevention
- [ ] Monitor audit_logs growth rate (first 24 hours)
- [ ] Set up alerts for constraint violations
- [ ] Document RLS bypass for emergency

### Fix Critical Issues (Before Production):

- [ ] Issue #1: Fix sensitive data exposure in audit logs
- [ ] Issue #2: Fix race condition in all-or-nothing constraint
- [ ] Issue #3: Fix audit trigger WHEN clause logic

### Within 1 Week:

- [ ] Add supporting B-tree indexes for availability queries
- [ ] Implement audit log archival strategy
- [ ] Add monitoring for constraint violations
- [ ] Create runbook for constraint failures

### Within 1 Month:

- [ ] Performance test with 100 concurrent bookings
- [ ] Penetration test audit log immutability
- [ ] BIR compliance review with legal team

---

## Security Score Breakdown

| Category                   | Score        | Notes                                    |
| -------------------------- | ------------ | ---------------------------------------- |
| Constraint Correctness     | 9/10         | Deduction for race condition             |
| Audit Trail Integrity      | 8/10         | Deduction for sensitive data handling    |
| RLS Implementation         | 9/10         | Minor policy ambiguity                   |
| SQL Injection Protection   | 7/10         | Dynamic table name handling needs review |
| Concurrency Control        | 7/10         | CHECK constraint race condition          |
| **Overall Security Grade** | **B+ (85%)** | Production-ready with fixes              |

---

## Recommended Next Steps

### Option 1: Fix Now (Recommended)

1. Address all 3 critical issues in migration 022
2. Re-run code quality review
3. Test on staging environment
4. Deploy to production

**Timeline**: 2-3 hours
**Risk**: Low (fixes are well-defined)

### Option 2: Deploy with Workarounds

1. Deploy current migration
2. Add application-level validation for all-or-nothing
3. Manually review audit logs for sensitive data
4. Fix in next maintenance window

**Timeline**: Immediate deployment, fix within 1 week
**Risk**: Medium (relies on application code)

### Option 3: Defer Chunk 003

1. Proceed to Chunk 004 (API endpoints)
2. Use application-level security temporarily
3. Return to fix migration later

**Timeline**: Deferred
**Risk**: HIGH (no database-level enforcement)

---

## Conclusion

This migration represents **excellent database engineering** with minor but critical flaws. The issues identified are genuine production risks, not academic concerns.

**Recommendation**: Spend 2-3 hours fixing the 3 critical issues, then proceed. The foundation is solid and the fixes are straightforward.

**Final Verdict**: ⚠️ **APPROVED WITH REQUIRED FIXES** ⚠️

---

**Files Referenced:**

- `/database/migrations/022-security-constraints-audit.sql`
- `/__tests__/database/chunk-003-checkpoint-tests.sql`
- `/database/migrations/021-multi-unit-guest-booking-schema.sql`
