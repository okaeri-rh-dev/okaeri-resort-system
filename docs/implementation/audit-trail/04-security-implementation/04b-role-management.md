# Phase 4b: Role-Based Access Control with app_roles Table

## Purpose

This document covers the `app_roles` table approach for managing audit trail access permissions. This replaces the GUC (database configuration) method with a runtime-configurable, portable, and maintainable solution.

**Why This Matters**: Role management needs to be dynamic, auditable, and manageable without database admin privileges.

## Problem with GUC Approach

The original Phase 4 documentation used database configuration variables:

```sql
-- ❌ Old approach: GUC settings
ALTER DATABASE postgres SET app.owner_emails = 'owner@resort.com';
ALTER DATABASE postgres SET app.manager_emails = 'manager@resort.com';
```

**Problems**:

- ❌ Requires `ALTER DATABASE` privilege (DB admin only)
- ❌ Not portable across environments (dev, staging, prod)
- ❌ Can't be changed at runtime without elevated access
- ❌ No audit trail of role changes
- ❌ Difficult to manage in CI/CD pipelines
- ❌ Single point of failure (one config for all environments)

## Solution: app_roles Table

**✅ New approach**: Dedicated table with RLS policies

```sql
CREATE TABLE app_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'owner', 'manager', 'staff')),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
```

**Benefits**:

- ✅ Runtime reconfigurable via UI or SQL
- ✅ Portable across all environments
- ✅ Auditable (track who granted roles and when)
- ✅ Supports granular permissions
- ✅ No database admin privileges required
- ✅ Can be seeded in migrations
- ✅ Integrates with Supabase Auth seamlessly

---

## Complete Schema Definition

### app_roles Table

```sql
-- ============================================
-- APP_ROLES TABLE
-- ============================================
-- Purpose: Manage user roles for audit trail access control
-- Roles: admin (full access), owner (full access), manager (limited), staff (own logs only)

CREATE TABLE IF NOT EXISTS app_roles (
    -- ============================================
    -- IDENTITY
    -- ============================================
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    -- ============================================
    -- ROLE ASSIGNMENT
    -- ============================================
    -- Role hierarchy: admin > owner > manager > staff
    -- admin: System administrators (full access to all audit logs + role management)
    -- owner: Business owners (full access to all audit logs)
    -- manager: Department managers (limited access to business operations)
    -- staff: Regular employees (see only their own logs)
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'owner', 'manager', 'staff')),

    -- ============================================
    -- AUDIT FIELDS
    -- ============================================
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- ============================================
    -- METADATA
    -- ============================================
    notes TEXT  -- Optional notes about role assignment
);

-- ============================================
-- INDEXES
-- ============================================

-- Fast role lookups by user_id (primary use case)
-- Already covered by PRIMARY KEY

-- Fast queries by role (e.g., "list all admins")
CREATE INDEX idx_app_roles_role ON app_roles(role);

-- Track who granted roles (for auditing)
CREATE INDEX idx_app_roles_granted_by ON app_roles(granted_by) WHERE granted_by IS NOT NULL;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE app_roles IS
    'User role assignments for audit trail access control. Replaces GUC configuration with runtime-manageable roles.';

COMMENT ON COLUMN app_roles.user_id IS
    'Foreign key to auth.users. User receiving the role assignment.';

COMMENT ON COLUMN app_roles.role IS
    'Role level: admin (full + role mgmt), owner (full access), manager (limited), staff (own logs only)';

COMMENT ON COLUMN app_roles.granted_at IS
    'Timestamp when role was assigned';

COMMENT ON COLUMN app_roles.granted_by IS
    'User ID of who granted this role (for audit trail)';
```

---

## Role Definitions

### Role Hierarchy

```
admin (highest)
  ├─ Full audit log access (SELECT, DELETE)
  ├─ Role management (grant/revoke roles)
  └─ System configuration

owner
  ├─ Full audit log access (SELECT, DELETE)
  └─ Cannot manage roles

manager
  ├─ Limited audit log access (business operations only)
  ├─ Tables: bookings, payments, guests, expenses, system, authentication
  └─ Cannot delete logs or manage roles

staff (lowest)
  ├─ See only their own audit logs
  └─ No management capabilities
```

### Role Capabilities Matrix

| Capability         | admin | owner | manager       | staff |
| ------------------ | ----- | ----- | ------------- | ----- |
| View all logs      | ✅    | ✅    | ❌ (filtered) | ❌    |
| View business logs | ✅    | ✅    | ✅            | ❌    |
| View own logs      | ✅    | ✅    | ✅            | ✅    |
| Delete old logs    | ✅    | ✅    | ❌            | ❌    |
| Grant/revoke roles | ✅    | ❌    | ❌            | ❌    |
| Export logs        | ✅    | ✅    | ✅            | ❌    |

---

## RLS Policies for app_roles Table

Protect the roles table itself with RLS:

```sql
-- ============================================
-- ENABLE RLS ON APP_ROLES
-- ============================================

ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DROP EXISTING POLICIES (if re-running)
-- ============================================

DROP POLICY IF EXISTS "app_roles_select_policy" ON app_roles;
DROP POLICY IF EXISTS "app_roles_insert_policy" ON app_roles;
DROP POLICY IF EXISTS "app_roles_update_policy" ON app_roles;
DROP POLICY IF EXISTS "app_roles_delete_policy" ON app_roles;

-- ============================================
-- SELECT POLICY (Who can view roles)
-- ============================================

CREATE POLICY "app_roles_select_policy"
ON app_roles
FOR SELECT
USING (
    -- Admins can see all roles
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role = 'admin'
    )
    OR
    -- Users can see their own role
    user_id = auth.uid()
);

-- ============================================
-- INSERT POLICY (Who can grant roles)
-- ============================================

CREATE POLICY "app_roles_insert_policy"
ON app_roles
FOR INSERT
WITH CHECK (
    -- Only admins can grant roles
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role = 'admin'
    )
);

-- ============================================
-- UPDATE POLICY (Who can modify roles)
-- ============================================

CREATE POLICY "app_roles_update_policy"
ON app_roles
FOR UPDATE
USING (
    -- Only admins can modify roles
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role = 'admin'
    )
);

-- ============================================
-- DELETE POLICY (Who can revoke roles)
-- ============================================

CREATE POLICY "app_roles_delete_policy"
ON app_roles
FOR DELETE
USING (
    -- Only admins can revoke roles
    EXISTS (
        SELECT 1 FROM app_roles ar
        WHERE ar.user_id = auth.uid()
          AND ar.role = 'admin'
    )
    AND
    -- Cannot delete own admin role (prevent lockout)
    user_id != auth.uid()
);
```

**★ Insight ─────────────────────────────────────**
The DELETE policy includes `user_id != auth.uid()` to prevent admins from accidentally removing their own admin privileges and locking themselves out. This is a critical safety mechanism.
**─────────────────────────────────────────────────**

---

## Seed Data Examples

### Initial Setup

```sql
-- ============================================
-- SEED INITIAL ROLES
-- ============================================
-- Replace UUIDs with actual user IDs from auth.users

-- Grant admin role to system administrator
INSERT INTO app_roles (user_id, role, notes)
VALUES (
    'your-admin-user-uuid',  -- Replace with actual UUID from auth.users
    'admin',
    'System administrator - initial setup'
);

-- Grant owner roles to business owners
INSERT INTO app_roles (user_id, role, granted_by, notes)
VALUES
    (
        'owner-1-user-uuid',  -- Replace with actual UUID
        'owner',
        'your-admin-user-uuid',  -- Granted by admin
        'Resort owner - full audit access'
    ),
    (
        'owner-2-user-uuid',  -- Replace with actual UUID
        'owner',
        'your-admin-user-uuid',
        'Co-owner - full audit access'
    );

-- Grant manager roles
INSERT INTO app_roles (user_id, role, granted_by, notes)
VALUES (
    'manager-user-uuid',  -- Replace with actual UUID
    'manager',
    'your-admin-user-uuid',
    'Operations manager - business logs only'
);
```

### Finding User UUIDs

```sql
-- Query to find user UUIDs by email
SELECT id, email
FROM auth.users
WHERE email IN ('owner@resort.com', 'admin@resort.com', 'manager@resort.com');
```

---

## Environment-Specific Role Seeding

### Development Environment

Create `sql/seed-roles-dev.sql`:

```sql
-- ============================================
-- DEVELOPMENT ENVIRONMENT ROLE SEEDING
-- ============================================
-- Purpose: Seed test roles for local development
-- Run: psql -d your_dev_db -f sql/seed-roles-dev.sql

BEGIN;

-- Helper to get user ID by email
CREATE OR REPLACE FUNCTION get_user_id_by_email(user_email TEXT)
RETURNS UUID AS $$
    SELECT id FROM auth.users WHERE email = user_email LIMIT 1;
$$ LANGUAGE sql;

-- Seed admin role (development only)
INSERT INTO app_roles (user_id, role, notes)
VALUES (
    get_user_id_by_email('dev-admin@localhost'),
    'admin',
    'Development admin - auto-seeded'
)
ON CONFLICT (user_id) DO NOTHING;

-- Seed owner role
INSERT INTO app_roles (user_id, role, granted_by, notes)
VALUES (
    get_user_id_by_email('dev-owner@localhost'),
    'owner',
    get_user_id_by_email('dev-admin@localhost'),
    'Development owner - auto-seeded'
)
ON CONFLICT (user_id) DO NOTHING;

-- Seed manager role
INSERT INTO app_roles (user_id, role, granted_by, notes)
VALUES (
    get_user_id_by_email('dev-manager@localhost'),
    'manager',
    get_user_id_by_email('dev-admin@localhost'),
    'Development manager - auto-seeded'
)
ON CONFLICT (user_id) DO NOTHING;

-- Seed staff role
INSERT INTO app_roles (user_id, role, granted_by, notes)
VALUES (
    get_user_id_by_email('dev-staff@localhost'),
    'staff',
    get_user_id_by_email('dev-admin@localhost'),
    'Development staff - auto-seeded'
)
ON CONFLICT (user_id) DO NOTHING;

-- Verify seeding
SELECT
    u.email,
    ar.role,
    ar.granted_at,
    granter.email AS granted_by_email
FROM app_roles ar
JOIN auth.users u ON ar.user_id = u.id
LEFT JOIN auth.users granter ON ar.granted_by = granter.id
ORDER BY ar.role, u.email;

-- Clean up helper function
DROP FUNCTION get_user_id_by_email(TEXT);

COMMIT;
```

### Staging Environment

Create `sql/seed-roles-staging.sql`:

```sql
-- ============================================
-- STAGING ENVIRONMENT ROLE SEEDING
-- ============================================
-- Purpose: Seed production-like roles for staging
-- Run manually or via CI/CD

BEGIN;

-- Seed admin (use real staging admin email)
INSERT INTO app_roles (user_id, role, notes)
SELECT
    id,
    'admin',
    'Staging admin - seeded via migration'
FROM auth.users
WHERE email = 'staging-admin@resort.com'
ON CONFLICT (user_id) DO NOTHING;

-- Seed owner
INSERT INTO app_roles (user_id, role, granted_by, notes)
SELECT
    u.id,
    'owner',
    admin.id,
    'Staging owner - seeded via migration'
FROM auth.users u
CROSS JOIN (
    SELECT id FROM auth.users WHERE email = 'staging-admin@resort.com'
) admin
WHERE u.email = 'staging-owner@resort.com'
ON CONFLICT (user_id) DO NOTHING;

-- Verify staging roles
SELECT
    u.email,
    ar.role,
    ar.notes
FROM app_roles ar
JOIN auth.users u ON ar.user_id = u.id
ORDER BY ar.role;

COMMIT;
```

### Production Environment

Create `sql/seed-roles-production.sql`:

```sql
-- ============================================
-- PRODUCTION ENVIRONMENT ROLE SEEDING
-- ============================================
-- ⚠️ CRITICAL: Run manually with extreme caution
-- Purpose: Bootstrap initial production admin
-- Run ONCE during initial deployment

BEGIN;

-- Step 1: Verify no roles exist yet (safety check)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM app_roles LIMIT 1) THEN
        RAISE EXCEPTION 'Roles already exist. Aborting to prevent duplicate seeding.';
    END IF;
END $$;

-- Step 2: Seed ONLY the first admin
-- Replace with ACTUAL production admin email
INSERT INTO app_roles (user_id, role, notes)
SELECT
    id,
    'admin',
    'Production admin - initial bootstrap'
FROM auth.users
WHERE email = 'admin@your-resort-domain.com'  -- ⚠️ REPLACE THIS
LIMIT 1;

-- Step 3: Verify exactly one admin was created
DO $$
DECLARE
    admin_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_count FROM app_roles WHERE role = 'admin';

    IF admin_count != 1 THEN
        RAISE EXCEPTION 'Expected exactly 1 admin, but found %', admin_count;
    END IF;

    RAISE NOTICE 'Successfully created 1 admin role';
END $$;

-- Step 4: Show what was created
SELECT
    u.email,
    ar.role,
    ar.granted_at,
    ar.notes
FROM app_roles ar
JOIN auth.users u ON ar.user_id = u.id;

COMMIT;

-- ============================================
-- POST-BOOTSTRAP INSTRUCTIONS
-- ============================================
-- After this script succeeds:
-- 1. Log in as the admin user
-- 2. Use the UI (or grantRole() function) to add owner/manager roles
-- 3. NEVER run this script again
```

---

## TypeScript Seeding Helpers

For programmatic role seeding (development automation):

```typescript
// scripts/seed-dev-roles.ts

import { createClient } from "@supabase/supabase-js";
import { grantRole, AuditRole } from "../src/lib/audit-roles";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role for admin operations
);

/**
 * Seed development roles
 * Run: tsx scripts/seed-dev-roles.ts
 */
async function seedDevRoles() {
  const devUsers = [
    { email: "dev-admin@localhost", role: AuditRole.ADMIN },
    { email: "dev-owner@localhost", role: AuditRole.OWNER },
    { email: "dev-manager@localhost", role: AuditRole.MANAGER },
    { email: "dev-staff@localhost", role: AuditRole.STAFF },
  ];

  console.log("🌱 Seeding development roles...\n");

  for (const user of devUsers) {
    // Find user by email
    const { data: authUser } = await supabase
      .from("auth.users")
      .select("id")
      .eq("email", user.email)
      .single();

    if (!authUser) {
      console.log(`⚠️  User ${user.email} not found, skipping...`);
      continue;
    }

    // Grant role (uses INSERT ... ON CONFLICT DO NOTHING pattern)
    const { data, error } = await supabase.from("app_roles").upsert(
      {
        user_id: authUser.id,
        role: user.role,
        notes: "Auto-seeded for development",
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.log(`❌ Failed to grant ${user.role} to ${user.email}: ${error.message}`);
    } else {
      console.log(`✅ Granted ${user.role} to ${user.email}`);
    }
  }

  console.log("\n✨ Development role seeding complete!");
}

seedDevRoles().catch(console.error);
```

### Package.json Script

Add to `package.json`:

```json
{
  "scripts": {
    "seed:roles:dev": "tsx scripts/seed-dev-roles.ts",
    "seed:roles:verify": "tsx scripts/verify-roles.ts"
  }
}
```

### Verification Script

Create `scripts/verify-roles.ts`:

```typescript
// scripts/verify-roles.ts

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyRoles() {
  const { data, error } = await supabase
    .from("app_roles")
    .select(
      `
      user_id,
      role,
      granted_at,
      notes,
      user:auth.users!user_id(email)
    `
    )
    .order("role");

  if (error) {
    console.error("❌ Error fetching roles:", error.message);
    return;
  }

  console.log("\n📋 Current Role Assignments:\n");
  console.table(
    data.map((r: any) => ({
      Email: r.user?.email || "unknown",
      Role: r.role,
      "Granted At": new Date(r.granted_at).toLocaleString(),
      Notes: r.notes || "-",
    }))
  );

  // Summary by role
  const summary = data.reduce((acc: any, r: any) => {
    acc[r.role] = (acc[r.role] || 0) + 1;
    return acc;
  }, {});

  console.log("\n📊 Summary:");
  console.table(summary);
}

verifyRoles().catch(console.error);
```

---

## Updated RLS Policies for audit_logs

Update the audit_logs RLS policies to use app_roles table:

```sql
-- ============================================
-- UPDATED SELECT POLICY (using app_roles)
-- ============================================

DROP POLICY IF EXISTS "audit_logs_select_policy" ON audit_logs;

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
-- UPDATED DELETE POLICY (using app_roles)
-- ============================================

DROP POLICY IF EXISTS "audit_logs_delete_policy" ON audit_logs;

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

---

## Helper Functions

### Check User Role

```sql
-- ============================================
-- HELPER: Get current user's role
-- ============================================

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS VARCHAR(20) AS $$
    SELECT role
    FROM app_roles
    WHERE user_id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_user_role() IS
    'Returns the current authenticated user role (admin, owner, manager, staff) or NULL if no role assigned.';

-- Usage:
-- SELECT get_user_role();  -- Returns 'admin', 'owner', 'manager', 'staff', or NULL
```

### Check User Permission

```sql
-- ============================================
-- HELPER: Check if user has specific role or higher
-- ============================================

CREATE OR REPLACE FUNCTION has_role(required_role VARCHAR(20))
RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR(20);
    role_hierarchy INTEGER;
    required_hierarchy INTEGER;
BEGIN
    -- Get user's current role
    SELECT role INTO user_role
    FROM app_roles
    WHERE user_id = auth.uid()
    LIMIT 1;

    -- Return false if no role assigned
    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Define role hierarchy (higher number = more permissions)
    role_hierarchy := CASE user_role
        WHEN 'admin' THEN 4
        WHEN 'owner' THEN 3
        WHEN 'manager' THEN 2
        WHEN 'staff' THEN 1
        ELSE 0
    END;

    required_hierarchy := CASE required_role
        WHEN 'admin' THEN 4
        WHEN 'owner' THEN 3
        WHEN 'manager' THEN 2
        WHEN 'staff' THEN 1
        ELSE 0
    END;

    -- Check if user's role meets or exceeds required role
    RETURN role_hierarchy >= required_hierarchy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION has_role(VARCHAR(20)) IS
    'Checks if current user has the specified role or higher in the hierarchy. Returns true/false.';

-- Usage:
-- SELECT has_role('manager');  -- Returns TRUE if user is manager, owner, or admin
-- SELECT has_role('owner');    -- Returns TRUE only if user is owner or admin
```

### Get Current Audit Role (Recommended for UI Guards)

```sql
-- ============================================
-- HELPER: Get current user's audit role or 'none'
-- ============================================
-- Purpose: Single source of truth for UI route guards and access control
-- Returns 'admin', 'owner', 'manager', 'staff', or 'none' (never NULL)

CREATE OR REPLACE FUNCTION get_current_audit_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM app_roles
    WHERE user_id = auth.uid()
      AND is_active = true
    LIMIT 1;

    -- Return 'none' instead of NULL for easier client-side checks
    RETURN COALESCE(user_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_current_audit_role() IS
    'Returns current user audit role: admin|owner|manager|staff|none. Preferred for UI route guards.';

-- Usage in SQL:
-- SELECT get_current_audit_role();  -- Returns 'admin', 'owner', 'manager', 'staff', or 'none'

-- Usage in TypeScript:
-- const { data: role } = await supabase.rpc('get_current_audit_role');
-- if (role !== 'admin' && role !== 'owner') {
--   throw redirect({ to: '/' });
-- }
```

**★ Insight ─────────────────────────────────────**
`get_current_audit_role()` is the recommended function for UI guards because it returns 'none' instead of NULL, making client-side checks cleaner and avoiding null pointer issues. Use this instead of `get_user_role()` for route protection.
**─────────────────────────────────────────────────**

**When to Use Which Helper**:

| Function                   | Returns           | Use Case                               |
| -------------------------- | ----------------- | -------------------------------------- |
| `get_current_audit_role()` | TEXT (never NULL) | ✅ UI route guards, client-side checks |
| `get_user_role()`          | VARCHAR or NULL   | SQL queries, conditional logic         |
| `has_role('manager')`      | BOOLEAN           | Permission checks (hierarchy-aware)    |

**Example UI Route Guard**:

```typescript
// src/routes/audit/_layout.tsx
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/audit/_layout")({
  beforeLoad: async () => {
    // Get effective audit role from single source of truth
    const { data: role, error } = await supabase.rpc("get_current_audit_role");

    if (error) {
      throw new Error("Failed to check audit permissions");
    }

    // Only admins, owners, and managers can access audit UI
    if (role === "staff" || role === "none") {
      throw redirect({
        to: "/",
        search: { error: "insufficient_permissions" },
      });
    }

    return { auditRole: role };
  },
});
```

---

## Migration from GUC Approach

If you previously used GUC settings, migrate to app_roles:

```sql
-- ============================================
-- MIGRATION SCRIPT: GUC → app_roles
-- ============================================

BEGIN;

-- Step 1: Create app_roles table
-- (Use schema definition from above)

-- Step 2: Migrate existing email-based permissions
-- Manually identify users and insert into app_roles
-- (See "Seed Data Examples" section above)

-- Step 3: Update audit_logs RLS policies
-- (Use updated policies from above)

-- Step 4: Verify migration
SELECT
    u.email,
    ar.role,
    ar.granted_at
FROM app_roles ar
JOIN auth.users u ON ar.user_id = u.id
ORDER BY ar.role, u.email;

-- Step 5: Remove old GUC settings (optional)
-- ALTER DATABASE postgres RESET app.owner_emails;
-- ALTER DATABASE postgres RESET app.manager_emails;

COMMIT;
```

---

## Application Integration

### TypeScript Helper Functions

Create `src/lib/audit-roles.ts`:

```typescript
// src/lib/audit-roles.ts

import { supabase } from "./supabase";

export enum AuditRole {
  ADMIN = "admin",
  OWNER = "owner",
  MANAGER = "manager",
  STAFF = "staff",
}

/**
 * Get current user's audit role
 */
export async function getUserAuditRole(): Promise<AuditRole | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("app_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;
  return data.role as AuditRole;
}

/**
 * Check if user has required role or higher
 */
export async function hasAuditRole(requiredRole: AuditRole): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", { required_role: requiredRole });
  return data === true;
}

/**
 * Check if user can access audit trail
 */
export async function canAccessAuditTrail(): Promise<boolean> {
  const role = await getUserAuditRole();
  return role !== null; // Any role can access (filtered by RLS)
}

// ============================================
// ROLE MANAGEMENT FUNCTIONS (Admin-only)
// ============================================

/**
 * Grant a role to a user
 * Requires admin privileges
 *
 * @param userId - UUID of user receiving the role
 * @param role - Role to grant (admin, owner, manager, staff)
 * @param notes - Optional notes about why role was granted
 * @returns Success status and error message if failed
 */
export async function grantRole(
  userId: string,
  role: AuditRole,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current user as the granter
    const {
      data: { user: granter },
    } = await supabase.auth.getUser();

    if (!granter) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify granter is admin
    const granterRole = await getUserAuditRole();
    if (granterRole !== AuditRole.ADMIN) {
      return { success: false, error: "Only admins can grant roles" };
    }

    // Insert role assignment
    const { error } = await supabase.from("app_roles").insert({
      user_id: userId,
      role,
      granted_by: granter.id,
      notes: notes || null,
    });

    if (error) {
      // Handle duplicate key error
      if (error.code === "23505") {
        return { success: false, error: "User already has a role. Use updateRole() instead." };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Revoke a user's role
 * Requires admin privileges
 * Cannot revoke own admin role (prevents lockout)
 *
 * @param userId - UUID of user whose role will be revoked
 * @returns Success status and error message if failed
 */
export async function revokeRole(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify user is admin
    const userRole = await getUserAuditRole();
    if (userRole !== AuditRole.ADMIN) {
      return { success: false, error: "Only admins can revoke roles" };
    }

    // Prevent self-revocation of admin role
    if (userId === user.id) {
      return { success: false, error: "Cannot revoke your own admin role (lockout prevention)" };
    }

    // Delete role assignment
    const { error } = await supabase.from("app_roles").delete().eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Update a user's role
 * Requires admin privileges
 *
 * @param userId - UUID of user whose role will be updated
 * @param newRole - New role to assign
 * @param notes - Optional notes about the change
 * @returns Success status and error message if failed
 */
export async function updateRole(
  userId: string,
  newRole: AuditRole,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current user as the updater
    const {
      data: { user: updater },
    } = await supabase.auth.getUser();

    if (!updater) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify updater is admin
    const updaterRole = await getUserAuditRole();
    if (updaterRole !== AuditRole.ADMIN) {
      return { success: false, error: "Only admins can update roles" };
    }

    // Update role assignment
    const { error } = await supabase
      .from("app_roles")
      .update({
        role: newRole,
        granted_by: updater.id,
        granted_at: new Date().toISOString(),
        notes: notes || null,
      })
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * List all users with their roles
 * Requires admin privileges
 *
 * @returns Array of users with roles, or error
 */
export async function listAllRoles(): Promise<{
  success: boolean;
  data?: Array<{
    user_id: string;
    email: string;
    role: AuditRole;
    granted_at: string;
    granted_by: string | null;
    notes: string | null;
  }>;
  error?: string;
}> {
  try {
    // Verify user is admin
    const userRole = await getUserAuditRole();
    if (userRole !== AuditRole.ADMIN) {
      return { success: false, error: "Only admins can list all roles" };
    }

    // Query roles with user emails
    const { data, error } = await supabase
      .from("app_roles")
      .select(
        `
        user_id,
        role,
        granted_at,
        granted_by,
        notes,
        user:auth.users!user_id(email)
      `
      )
      .order("role")
      .order("granted_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    // Transform data to include email at top level
    const roles = data.map((r: any) => ({
      user_id: r.user_id,
      email: r.user?.email || "unknown",
      role: r.role as AuditRole,
      granted_at: r.granted_at,
      granted_by: r.granted_by,
      notes: r.notes,
    }));

    return { success: true, data: roles };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
```

---

## UI Considerations (Future Phase 5)

### Role Management Interface

**Admin-only features**:

- View all users and their roles
- Grant/revoke roles to users
- View role assignment history

**Suggested UI components**:

1. **Role Badge**: Display user's role in header/profile
2. **Role Management Page**: `/admin/roles` (admin only)
3. **Audit Trail Access Control**: Hide audit link if no role assigned
4. **Permission Warnings**: Show warnings when users try restricted actions

### Route Guards

```typescript
// Example: Protect audit trail route
export const Route = createFileRoute("/audit")({
  beforeLoad: async () => {
    const role = await getUserAuditRole();
    if (!role) {
      throw redirect({ to: "/" });
    }
  },
});
```

---

## Troubleshooting

### Problem: Admin can't see app_roles table

**Diagnosis**:

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'app_roles';
```

**Solution**: Ensure RLS policies are created correctly and user has admin role.

### Problem: Cannot grant first admin role

**Solution**: Use database admin privileges for initial setup:

```sql
-- As database admin (postgres user)
INSERT INTO app_roles (user_id, role, notes)
VALUES ('first-admin-uuid', 'admin', 'Initial system administrator');
```

### Problem: User has role but can't access logs

**Diagnosis**:

```sql
-- Verify role exists
SELECT * FROM app_roles WHERE user_id = 'user-uuid';

-- Check if RLS policies use app_roles
SELECT * FROM pg_policies WHERE tablename = 'audit_logs';
```

**Solution**: Ensure audit_logs policies are updated to query app_roles table.

---

## Security Best Practices

1. **Bootstrap Carefully**: Set up first admin role using database admin privileges, then manage roles through UI
2. **Prevent Lockout**: Never allow admins to delete their own admin role
3. **Audit Role Changes**: Log role grants/revokes to separate audit table (future enhancement)
4. **Minimal Roles**: Only grant necessary permissions (principle of least privilege)
5. **Regular Review**: Periodically review role assignments and revoke unused roles

---

## Next Steps

**Integration Checklist**:

- [ ] Create app_roles table
- [ ] Enable RLS on app_roles
- [ ] Create helper functions (get_user_role, has_role)
- [ ] Update audit_logs RLS policies to use app_roles
- [ ] Seed initial roles (at least one admin)
- [ ] Update 04-security-policies.md to reference this document
- [ ] Test role-based access from application

**Next**: Return to [Phase 4: Security Policies](./04-security-policies.md) to see updated RLS policies using app_roles.

---

**Role Management Checklist:**

- [ ] app_roles table created with admin, owner, manager, staff roles
- [ ] RLS policies protect app_roles table
- [ ] Helper functions created
- [ ] audit_logs policies updated to use app_roles
- [ ] Initial admin role seeded
- [ ] Migration from GUC completed (if applicable)
- [ ] Application helpers created
- [ ] Access control tested
