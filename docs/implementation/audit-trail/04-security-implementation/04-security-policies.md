# Phase 4: Security Policies and Access Control

## Purpose

This document covers security implementation for the audit trail system, including Row Level Security (RLS) policies, role-based access control, sensitive data handling, and manual archival procedures.

---

## ⚠️ CRITICAL: Use app_roles Table Approach

> **🚨 WARNING: The GUC-based approach shown later in this document is DEPRECATED.**
>
> **✅ USE THIS INSTEAD**: [Phase 4b: Role Management with app_roles Table](./04b-role-management.md)
>
> ### Why app_roles is Better:
>
> - ✅ **Runtime reconfigurable** - Change roles without database restart
> - ✅ **Portable** - Works across dev, staging, production environments
> - ✅ **Auditable** - Track who granted roles and when
> - ✅ **No DB admin required** - Manage roles via application
> - ✅ **Type-safe** - Use TypeScript helpers (`grantRole()`, `revokeRole()`)
> - ✅ **Four-tier roles**: admin, owner, manager, staff
>
> ### Why GUC is Problematic:
>
> - ❌ Requires `ALTER DATABASE` privilege (DB admin only)
> - ❌ Not portable (different configs per environment)
> - ❌ Can't be changed at runtime
> - ❌ No audit trail of role changes
> - ❌ Hard to manage in CI/CD
>
> **👉 Jump to**: [RLS Policies Using app_roles (Recommended)](#rls-policies-using-app_roles-recommended)

---

## Row Level Security (RLS) Policies

### RLS Overview

PostgreSQL RLS ensures users only see audit logs they're authorized to view. This is enforced at the database level, making it impossible to bypass via application code.

**This document shows TWO approaches** (use app_roles, skip GUC):

1. ✅ **app_roles-based** (RECOMMENDED) - Runtime-configurable role management
2. ⚠️ **GUC-based** (DEPRECATED) - Database configuration variables

---

## RLS Policies Using app_roles (Recommended)

**📚 Full Documentation**: See [Phase 4b: Role Management](./04b-role-management.md) for complete app_roles implementation.

### Quick Start with app_roles

**Step 1**: Create app_roles table (see 04b for full schema):

```sql
CREATE TABLE app_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'owner', 'manager', 'staff')),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
```

**Step 2**: Create RLS policies using app_roles:

```sql
-- ============================================
-- ENABLE RLS ON AUDIT_LOGS TABLE
-- ============================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DROP EXISTING POLICIES (if re-running)
-- ============================================

DROP POLICY IF EXISTS "audit_logs_select_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete_policy" ON audit_logs;

-- ============================================
-- SELECT POLICY (Using app_roles)
-- ============================================

CREATE POLICY "audit_logs_select_policy"
ON audit_logs
FOR SELECT
USING (
    -- Admins and owners see all audit logs
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role IN ('admin', 'owner')
    )
    OR
    -- Managers see business operations only
    (
        EXISTS (
            SELECT 1 FROM app_roles ar
            WHERE ar.user_id = auth.uid()
              AND ar.role = 'manager'
        )
        AND table_name IN ('bookings', 'payments', 'guests', 'expenses', 'system', 'authentication')
    )
    OR
    -- Staff see only their own logs
    (
        user_email = (current_setting('request.jwt.claims', TRUE)::json->>'email')
    )
);

-- ============================================
-- DELETE POLICY (Using app_roles)
-- ============================================

CREATE POLICY "audit_logs_delete_policy"
ON audit_logs
FOR DELETE
USING (
    -- Only admins and owners can delete (for manual archival)
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role IN ('admin', 'owner')
    )
);

-- ============================================
-- INSERT POLICY (Unchanged - allows triggers)
-- ============================================

CREATE POLICY "audit_logs_insert_policy"
ON audit_logs
FOR INSERT
WITH CHECK (
    -- Authenticated users can insert logs
    auth.uid() IS NOT NULL
    OR
    -- System (trigger) can insert logs
    user_id IS NULL
);

COMMENT ON POLICY "audit_logs_select_policy" ON audit_logs IS
    'Uses app_roles table for role-based access. Admins/owners see all, managers see business ops, staff see own logs.';

COMMENT ON POLICY "audit_logs_delete_policy" ON audit_logs IS
    'Only admins and owners can manually delete logs for archival purposes.';
```

**Step 3**: Seed initial roles:

```sql
-- Grant first admin role (run once as DB admin)
INSERT INTO app_roles (user_id, role, notes)
SELECT id, 'admin', 'Initial system administrator'
FROM auth.users
WHERE email = 'your-admin@resort.com';
```

**Step 4**: Use TypeScript helpers to manage roles:

```typescript
import { grantRole, revokeRole, AuditRole } from "@/lib/audit-roles";

// Grant owner role
await grantRole(userId, AuditRole.OWNER, "Resort owner - full access");

// Revoke role
await revokeRole(userId);
```

**✅ Done!** Your audit trail now uses runtime-configurable role management.

---

## GUC-Based Policies (DEPRECATED - For Reference Only)

> **⚠️ This section is kept for historical reference only.**
> **Do NOT use this approach for new implementations.**
> **Use app_roles instead (see above).**

### Policy Implementation

Add these policies to your Supabase database (via SQL Editor):

```sql
-- ============================================
-- ENABLE RLS ON AUDIT_LOGS TABLE
-- ============================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DROP EXISTING POLICIES (if re-running)
-- ============================================

DROP POLICY IF EXISTS "audit_logs_select_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_update_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete_policy" ON audit_logs;

-- ============================================
-- SELECT POLICY (Who can read audit logs)
-- ============================================

CREATE POLICY "audit_logs_select_policy"
ON audit_logs
FOR SELECT
USING (
  -- Get current user email from JWT claims (auth.email() does not exist)
  (current_setting('request.jwt.claims', TRUE)::json->>'email') IN (
    -- Owner emails from environment (full access)
    SELECT unnest(string_to_array(current_setting('app.owner_emails', true), ','))
  )
  OR
  -- Managers see business operations, system events, and authentication logs
  (
    (current_setting('request.jwt.claims', TRUE)::json->>'email') IN (
      SELECT unnest(string_to_array(current_setting('app.manager_emails', true), ','))
    )
    AND table_name IN ('bookings', 'payments', 'guests', 'expenses', 'system', 'authentication')
  )
  OR
  -- Staff see only their own logs
  (
    user_email = (current_setting('request.jwt.claims', TRUE)::json->>'email')
  )
);

-- ============================================
-- INSERT POLICY (Who can create audit logs)
-- ============================================

CREATE POLICY "audit_logs_insert_policy"
ON audit_logs
FOR INSERT
WITH CHECK (
  -- Only authenticated users can insert logs
  auth.uid() IS NOT NULL
  OR
  -- System (trigger) can insert logs (user_id = NULL for triggers)
  user_id IS NULL
);

-- ============================================
-- UPDATE/DELETE POLICIES (No one can modify audit logs)
-- ============================================

CREATE POLICY "audit_logs_update_policy"
ON audit_logs
FOR UPDATE
USING (false);  -- No updates allowed

CREATE POLICY "audit_logs_delete_policy"
ON audit_logs
FOR DELETE
USING (
  -- Only owners can delete (for manual archival)
  (current_setting('request.jwt.claims', TRUE)::json->>'email') IN (
    SELECT unnest(string_to_array(current_setting('app.owner_emails', true), ','))
  )
);

-- ============================================
-- SET DATABASE CONFIGURATION (Owner/Manager Emails)
-- ============================================

-- Set owner emails (replace with your actual owner emails)
ALTER DATABASE postgres SET app.owner_emails = 'owner@resort.com,admin@resort.com';

-- Set manager emails (replace with your actual manager emails)
ALTER DATABASE postgres SET app.manager_emails = 'manager@resort.com';

-- Apply settings
SELECT pg_reload_conf();
```

### Policy Rationale

**SELECT Policy** - Three-tier access:

1. **Owners** - See all audit logs (full transparency)
2. **Managers** - See business operations only (bookings, payments, guests, expenses)
3. **Staff** - See only their own actions (privacy + accountability)

**INSERT Policy** - Anyone authenticated can log:

- Authenticated users can create Layer 2 logs
- Triggers can create Layer 1 logs (user_id = NULL)

**UPDATE Policy** - No updates allowed:

- Audit logs are immutable (integrity)
- Prevents tampering with audit trail

**DELETE Policy** - Only owners can delete:

- Manual archival requires owner permission
- Prevents unauthorized log deletion

---

## RLS Policies Using app_roles (Recommended)

### Improved Security Model

Instead of hard-coded email lists in GUC settings, use the **app_roles table** for dynamic, auditable role management.

**Advantages over GUC**:

- ✅ No database admin privileges required for role changes
- ✅ Portable across dev/staging/prod environments
- ✅ Supports four role levels: `admin`, `owner`, `manager`, `staff`
- ✅ Auditable (track who granted roles and when)
- ✅ Can be managed via application UI (future Phase 5)

**Complete documentation**: See [Phase 4b: Role Management](./04b-role-management.md)

### Updated RLS Policies

```sql
-- ============================================
-- ENABLE RLS ON AUDIT_LOGS TABLE
-- ============================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DROP EXISTING POLICIES (if re-running)
-- ============================================

DROP POLICY IF EXISTS "audit_logs_select_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_update_policy" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete_policy" ON audit_logs;

-- ============================================
-- SELECT POLICY (Who can read audit logs)
-- ============================================

CREATE POLICY "audit_logs_select_policy"
ON audit_logs
FOR SELECT
USING (
    -- Admins and owners see all audit logs
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role IN ('admin', 'owner')
    )
    OR
    -- Managers see business operations only
    (
        EXISTS (
            SELECT 1 FROM app_roles ar
            WHERE ar.user_id = auth.uid()
              AND ar.role = 'manager'
        )
        AND table_name IN ('bookings', 'payments', 'guests', 'expenses', 'system', 'authentication')
    )
    OR
    -- Staff see only their own logs
    (
        user_email = (current_setting('request.jwt.claims', TRUE)::json->>'email')
    )
);

-- ============================================
-- INSERT POLICY (Who can create audit logs)
-- ============================================

CREATE POLICY "audit_logs_insert_policy"
ON audit_logs
FOR INSERT
WITH CHECK (
    -- Only authenticated users can insert logs
    auth.uid() IS NOT NULL
    OR
    -- System (trigger) can insert logs (user_id = NULL for triggers)
    user_id IS NULL
);

-- ============================================
-- UPDATE/DELETE POLICIES
-- ============================================

CREATE POLICY "audit_logs_update_policy"
ON audit_logs
FOR UPDATE
USING (false);  -- No updates allowed

CREATE POLICY "audit_logs_delete_policy"
ON audit_logs
FOR DELETE
USING (
    -- Only admins and owners can delete (for manual archival)
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role IN ('admin', 'owner')
    )
);
```

### Policy Rationale (app_roles)

**SELECT Policy** - Four-tier access:

1. **Admins** - Full system access + role management capabilities
2. **Owners** - See all audit logs (business transparency)
3. **Managers** - See business operations only (bookings, payments, guests, expenses)
4. **Staff** - See only their own actions (privacy + accountability)

**INSERT Policy** - Same as GUC approach:

- Authenticated users can create Layer 2 logs
- Triggers can create Layer 1 logs (user_id = NULL)

**DELETE Policy** - Only admins and owners:

- Manual archival requires elevated permission
- Staff and managers cannot delete audit history

**★ Insight ─────────────────────────────────────**
The app_roles approach decouples role assignment from database configuration, making it practical to manage permissions via application UI without requiring database admin access.
**─────────────────────────────────────────────────**

---

## Environment Configuration

**⚠️ RECOMMENDATION**: Instead of using GUC email lists shown below, use the **app_roles table** approach documented in [Phase 4b: Role Management](./04b-role-management.md). The GUC approach is shown here for reference only.

### Setting Owner/Manager Emails (GUC Approach - Legacy)

**Option 1: Database Configuration**

```sql
-- Set in Supabase SQL Editor
ALTER DATABASE postgres SET app.owner_emails = 'owner@resort.com,admin@resort.com';
ALTER DATABASE postgres SET app.manager_emails = 'manager@resort.com,staff@resort.com';
```

**Option 2: Supabase Dashboard**

1. Go to Project Settings → Database → Configuration
2. Add custom database parameters:
   - `app.owner_emails`: `owner@resort.com,admin@resort.com`
   - `app.manager_emails`: `manager@resort.com`

**Option 3: Environment Variables (Application Layer)**

```bash
# .env.local
VITE_OWNER_EMAILS="owner@resort.com,admin@resort.com"
VITE_MANAGER_EMAILS="manager@resort.com"
```

This is used for UI access control (hiding/showing audit link) but **NOT** for RLS (RLS uses database config only).

## Sensitive Data Handling

### Automatic Redaction

Sensitive fields are redacted automatically when logging (see Phase 2a):

```typescript
// src/lib/audit-constants.ts
export const SENSITIVE_FIELDS: Record<string, string[]> = {
  guests: ["guest_phone", "guest_email", "guest_address", "guest_notes", "emergency_contact_phone"],
  bookings: ["special_requests", "internal_notes"],
  payments: ["payment_method_details", "transaction_reference", "receipt_url"],
  expenses: ["vendor_contact", "receipt_url"],
};
```

### Adding New Sensitive Fields

When adding new fields to your schema:

1. **Identify PII/sensitive data** - Phone, email, financial details
2. **Add to SENSITIVE_FIELDS** - Update `audit-constants.ts`
3. **Test redaction** - Verify `[REDACTED]` appears in logs

Example:

```typescript
// Adding a new field to guests table
export const SENSITIVE_FIELDS: Record<string, string[]> = {
  guests: [
    // ... existing fields
    "government_id", // New: Government ID number (PII)
    "passport_number", // New: Passport number (PII)
  ],
};
```

### Viewing Redacted Data

**Q: Can owners see redacted data?**
**A: No.** Redaction happens before logging. Even owners see `[REDACTED]`.

**Why?** Audit logs are for accountability, not data recovery. Original data is in the source tables (guests, bookings, etc).

## Manual Archival

### Archival Strategy

**No scheduled jobs** - Manual quarterly archival by owners.

**Why manual?**

- Cloudflare Workers (serverless) don't support scheduled jobs well
- 3-room resort generates ~10K logs/year (manageable)
- Owners control when/what to archive

### Archival Process

#### 1. Backup Before Archival

```bash
# Run from terminal with Supabase CLI
supabase db dump -f audit_logs_backup_$(date +%Y%m%d).sql --table audit_logs

# Or via SQL export in Supabase Dashboard:
# Database → Backups → Create Manual Backup
```

#### 2. Archive Old Logs

```sql
-- Archive logs older than 2 years (run quarterly)
DELETE FROM audit_logs
WHERE timestamp < NOW() - INTERVAL '2 years';

-- Check how many logs will be deleted (run first)
SELECT COUNT(*) FROM audit_logs
WHERE timestamp < NOW() - INTERVAL '2 years';
```

#### 3. Vacuum and Reindex

```sql
-- Reclaim disk space
VACUUM FULL audit_logs;

-- Rebuild indexes for optimal performance
REINDEX TABLE audit_logs;

-- Update statistics
ANALYZE audit_logs;
```

### Archival Schedule

**Recommended**: Quarterly (every 3 months)

| Quarter | Archival Date | Delete Logs Before |
| ------- | ------------- | ------------------ |
| Q1      | January 15    | 2 years ago        |
| Q2      | April 15      | 2 years ago        |
| Q3      | July 15       | 2 years ago        |
| Q4      | October 15    | 2 years ago        |

### Using the Database Helper

```typescript
// Use the archiveOld helper (from Phase 2b)
import { db } from "@/lib/supabase";

// Archive logs older than 2 years
const twoYearsAgo = new Date();
twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

const deletedCount = await db.auditLogs.archiveOld(twoYearsAgo.toISOString());
console.log(`Archived ${deletedCount} old audit logs`);
```

## Security Best Practices

### 1. Never Log Passwords

```typescript
// ❌ Bad: Logging password fields
await logAuditEvent({
  tableName: "users",
  newData: {
    email: "user@resort.com",
    password_hash: "bcrypt_hash_here", // Don't log this!
  },
});

// ✅ Good: Exclude password from logs
const { password_hash, ...safeData } = userData;
await logAuditEvent({
  tableName: "users",
  newData: safeData,
});
```

### 2. Sanitize User Input

All audit descriptions are sanitized with DOMPurify:

```typescript
// src/lib/audit-logger.ts
const sanitizedDescription = DOMPurify.sanitize(context.description, {
  ALLOWED_TAGS: [], // Strip all HTML
  ALLOWED_ATTR: [],
});
```

### 3. Validate Audit Log Access

```typescript
// Always check access before showing audit UI
import { canAccessAuditTrail } from "@/lib/audit-logger";

const canAccess = await canAccessAuditTrail();
if (!canAccess) {
  // Redirect or show error
  throw redirect({ to: "/" });
}
```

### 4. Use HTTPS Only

Ensure your application uses HTTPS in production:

```typescript
// vercel.json (if using Vercel)
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=63072000; includeSubDomains; preload"
        }
      ]
    }
  ]
}
```

### 5. Rotate Owner Emails Periodically

When staff leaves or roles change:

```sql
-- Update owner emails in database
ALTER DATABASE postgres SET app.owner_emails = 'new-owner@resort.com';
SELECT pg_reload_conf();
```

## Testing Security

### RLS Policy Testing

```sql
-- Test as owner (should see all logs)
SET app.owner_emails = 'owner@resort.com';
SET request.jwt.claims = '{"email": "owner@resort.com"}';
-- Verify email extraction works
SELECT (current_setting('request.jwt.claims', TRUE)::json->>'email');  -- Should return 'owner@resort.com'
SELECT COUNT(*) FROM audit_logs;  -- Should return all logs

-- Test as manager (should see limited logs)
SET app.manager_emails = 'manager@resort.com';
SET request.jwt.claims = '{"email": "manager@resort.com"}';
SELECT COUNT(*) FROM audit_logs WHERE table_name = 'bookings';  -- Should return booking logs

-- Test as staff (should see only own logs)
SET request.jwt.claims = '{"email": "staff@resort.com"}';
SELECT COUNT(*) FROM audit_logs WHERE user_email = 'staff@resort.com';  -- Only own logs
```

### Application-Level Testing

```typescript
// Test access control in browser console
import { getUserAuditRole } from "@/lib/audit-logger";

const role = await getUserAuditRole();
console.log("Your audit role:", role);
// Expected: 'owner', 'manager', 'staff', or 'none'
```

## Troubleshooting Security Issues

### Problem: Owner can't see any audit logs

**Diagnosis:**

```sql
-- Check if owner email is configured
SHOW app.owner_emails;
```

**Solution:**

```sql
-- Set owner emails
ALTER DATABASE postgres SET app.owner_emails = 'owner@resort.com';
SELECT pg_reload_conf();
```

### Problem: RLS policies not working

**Diagnosis:**

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'audit_logs';
```

**Solution:**

```sql
-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
```

### Problem: Sensitive data appearing in logs

**Solution:** Add fields to `SENSITIVE_FIELDS` constant:

```typescript
// src/lib/audit-constants.ts
export const SENSITIVE_FIELDS: Record<string, string[]> = {
  guests: [
    // Add missing sensitive field here
    "new_sensitive_field",
  ],
};
```

## Compliance Considerations

### Internal Auditing vs Compliance

**This system is for internal auditing**, not regulatory compliance:

- ✅ **Internal use** - Track staff changes, investigate issues
- ✅ **Operational transparency** - See who changed what
- ✅ **Accountability** - Hold staff accountable for actions
- ❌ **Not for compliance** - Not SOC 2, HIPAA, PCI-DSS compliant
- ❌ **Not for guests** - Guests don't see audit logs

### If Compliance is Required

Consider adding:

1. **Immutable log storage** - Write-once storage (AWS Glacier, etc)
2. **Digital signatures** - Sign logs cryptographically
3. **Tamper detection** - Hash chains to detect modifications
4. **Extended retention** - 7+ year retention for compliance
5. **External auditing** - Third-party audit log analysis

## Next Steps

**Next**: [Phase 5 - API Reference](../05-api-reference.md)

Phase 5 provides comprehensive API documentation for all helpers, hooks, stores, and types.

---

**Security Checklist:**

- [ ] RLS policies created and enabled
- [ ] Owner/manager emails configured
- [ ] Sensitive fields list reviewed
- [ ] Manual archival schedule documented
- [ ] Security testing completed
- [ ] Access control working correctly
- [ ] HTTPS enforced in production

---

## PII and Data Handling

### Current Implementation

**Layer 1 (Database Triggers)**:

- **PII is automatically redacted at write-time** by the trigger function (see Phase 1b)
- Sensitive fields are masked with `[REDACTED]` before entering `audit_logs` table
- All readers see redacted data—cannot be bypassed by RLS misconfiguration
- Original sensitive data remains unredacted only in source business tables (guests, bookings, payments)

**Layer 2 (Application Logs)**:

- Redacts sensitive fields via `redactSensitiveData()` before logging
- Applies to `oldData` and `newData` in `db.auditLogs.create()`
- Sensitive fields defined in `SENSITIVE_FIELDS` constant
- Provides additional layer of defense for app-layer logging

**Redacted Fields** (as defined in Phase 1b trigger):

- `guests`: phone, email, address, notes, emergency contact
- `bookings`: special requests, internal notes
- `payments`: payment method details, transaction references, receipt URLs
- `expenses`: vendor contact, receipt URLs

### Design Decision

**Defense in depth** approach to PII protection:

- ✅ **Database layer**: Triggers redact PII at write-time (cannot be bypassed)
- ✅ **Application layer**: Additional redaction for Layer 2 logs
- ✅ **Access control**: RLS policies limit WHO can see logs

Audit logs prioritize **accountability with privacy**:

- Original data lives unredacted in business tables (for business operations)
- Audit logs show "who changed what" with sensitive values masked
- Compliance-friendly for internal resort use (PII minimization)

### Viewing Redacted Data

**Q: Can owners/admins see original PII values?**
**A: No.** Once redacted by triggers, the original value is permanently masked in audit logs. All users see `[REDACTED]`, regardless of role.

**Q: Where is original PII stored?**
**A:** In the source business tables (`guests`, `bookings`, `payments`). Audit logs track _changes_ with privacy protection; business tables hold _current state_ for operations.

---

## IP Address Collection

### Current Limitation

The `ip_address` column will be **NULL** for most entries because:

- Client-side JavaScript cannot reliably capture true IP addresses
- Proxies, NAT, and VPNs obscure real client IPs
- Supabase client library doesn't expose request IP

### Solutions

**Option A (Current MVP)**: Accept NULL IPs

- Rely on `user_email` and `user_agent` for identification
- Sufficient for internal resort audit trails
- No additional complexity

**Option B (Future Enhancement)**: Edge Function Logging

- Route Layer 2 logs through Supabase Edge Function
- Edge Function reads `X-Forwarded-For` header
- More accurate IP capture
- Adds latency and deployment complexity

### Recommendation

**Use Option A** for MVP. IP tracking is nice-to-have but not critical for small resort operations. `user_email` provides sufficient accountability.
