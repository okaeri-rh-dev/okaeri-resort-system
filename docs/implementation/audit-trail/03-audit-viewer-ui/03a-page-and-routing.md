# Phase 3a: Page and Routing

## Purpose

This document covers setting up the audit log viewer page with TanStack Router, including route configuration, access control, page layout, and navigation integration. The audit log viewer is **owner/manager only** - staff cannot access it.

**Security**: Hard-coded owner emails in environment variables control full access.

## TanStack Router Setup

### Route File Location

Create `src/routes/audit-logs/index.tsx`:

```typescript
// src/routes/audit-logs/index.tsx

import { createFileRoute, redirect } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield } from "lucide-react";
import { AuditLogViewer } from "@/components/audit/AuditLogViewer";
import { AuditFilters } from "@/components/audit/AuditFilters";
import { AuditStatsPanel } from "@/components/audit/AuditStatsPanel";
import { useAuditStore } from "@/stores/useAuditStore";
import { useAuditStats } from "@/lib/audit-hooks";
import { isCurrentUserOwner } from "@/lib/audit-logger";
import { useEffect, useState } from "react";

// ============================================
// ROUTE DEFINITION
// ============================================

export const Route = createFileRoute("/audit-logs/")({
  component: AuditLogsPage,

  // Route loader - check access before rendering
  beforeLoad: async ({ context, location }) => {
    // Check if user is owner/manager
    const isOwner = await isCurrentUserOwner();

    if (!isOwner) {
      // Redirect to home page if not authorized
      throw redirect({
        to: "/",
        search: {
          error: "unauthorized",
          message: "You do not have permission to access audit logs",
        },
      });
    }
  },

  // Set page metadata
  meta: () => [
    { title: "Audit Trail - Resort Management System" },
    { name: "description", content: "View system audit logs and change history" },
  ],
});

// ============================================
// PAGE COMPONENT
// ============================================

function AuditLogsPage() {
  const filters = useAuditStore((state) => state.filters);
  const showFilters = useAuditStore((state) => state.showFilters);
  const toggleFilters = useAuditStore((state) => state.toggleFilters);

  const { data: stats, isLoading: statsLoading } = useAuditStats(filters);

  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    // Verify access on mount
    isCurrentUserOwner().then(setIsOwner);
  }, []);

  if (!isOwner) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to access audit logs. This area is restricted to owners and managers.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Trail</h1>
          <p className="text-muted-foreground">
            View system changes and user activity logs
          </p>
        </div>

        <button
          onClick={toggleFilters}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {showFilters ? "Hide" : "Show"} Filters
        </button>
      </div>

      {/* Statistics Panel */}
      <AuditStatsPanel stats={stats} isLoading={statsLoading} />

      {/* Filters Section */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Filter audit logs by date, user, table, or action
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuditFilters />
          </CardContent>
        </Card>
      )}

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
          <CardDescription>
            {filters.tableName
              ? `Showing logs for ${filters.tableName}`
              : "Showing all system logs"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditLogViewer />
        </CardContent>
      </Card>
    </div>
  );
}
```

## Statistics Panel Component

Create `src/components/audit/AuditStatsPanel.tsx`:

```typescript
// src/components/audit/AuditStatsPanel.tsx

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditLogStats } from "../../../database.types";
import { TABLE_DISPLAY_NAMES, ACTION_DISPLAY_NAMES } from "@/lib/audit-constants";
import { Activity, Database, FileText, Users } from "lucide-react";

interface AuditStatsPanelProps {
  stats?: AuditLogStats;
  isLoading: boolean;
}

export function AuditStatsPanel({ stats, isLoading }: AuditStatsPanelProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {/* Total Logs */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Logs</p>
              <p className="text-2xl font-bold">{stats.totalLogs.toLocaleString()}</p>
            </div>
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Most Active Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Most Active Table</p>
              <p className="text-2xl font-bold">
                {getMostActive(stats.byTable)}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.byTable[getMostActive(stats.byTable)]} logs
              </p>
            </div>
            <Database className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Most Common Action */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Most Common Action</p>
              <p className="text-2xl font-bold">
                {getMostActiveAction(stats.byAction)}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.byAction[getMostActiveAction(stats.byAction)]} times
              </p>
            </div>
            <Activity className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Top User */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Most Active User</p>
              <p className="text-lg font-bold truncate">
                {stats.byUser[0]?.email || "N/A"}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.byUser[0]?.count || 0} actions
              </p>
            </div>
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper functions
function getMostActive(byTable: Record<string, number>): string {
  const entries = Object.entries(byTable);
  if (entries.length === 0) return "N/A";

  const [table] = entries.reduce((max, curr) =>
    curr[1] > max[1] ? curr : max
  );

  return TABLE_DISPLAY_NAMES[table] || table;
}

function getMostActiveAction(byAction: Record<string, number>): string {
  const entries = Object.entries(byAction);
  if (entries.length === 0) return "N/A";

  const [action] = entries.reduce((max, curr) =>
    curr[1] > max[1] ? curr : max
  );

  return ACTION_DISPLAY_NAMES[action as keyof typeof ACTION_DISPLAY_NAMES] || action;
}
```

## Navigation Integration

### Add to Main Navigation

Update your navigation component (e.g., `src/components/layout/Navbar.tsx`):

```typescript
// src/components/layout/Navbar.tsx (add to existing navigation)

import { Shield } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { isCurrentUserOwner } from "@/lib/audit-logger";
import { useEffect, useState } from "react";

export function Navbar() {
  const [showAuditLink, setShowAuditLink] = useState(false);

  useEffect(() => {
    // Check if user can access audit logs
    isCurrentUserOwner().then(setShowAuditLink);
  }, []);

  return (
    <nav>
      {/* ... existing navigation items ... */}

      {showAuditLink && (
        <Link
          to="/audit-logs"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium hover:bg-accent rounded-md"
        >
          <Shield className="h-4 w-4" />
          <span>Audit Trail</span>
        </Link>
      )}
    </nav>
  );
}
```

## Access Control Utilities

### Enhanced Access Check

Update `src/lib/audit-logger.ts` with more granular access control:

```typescript
// src/lib/audit-logger.ts (add to existing file)

/**
 * User roles for audit access control
 */
export enum AuditRole {
  OWNER = "owner", // Full access to all logs
  MANAGER = "manager", // Access to business operations (bookings, payments)
  STAFF = "staff", // Access to own auth logs only
  NONE = "none", // No access
}

/**
 * Get user's audit access role
 * @returns User's audit role
 */
export async function getUserAuditRole(): Promise<AuditRole> {
  const context = await getCurrentUserContext();
  if (!context || !context.email) return AuditRole.NONE;

  const ownerEmails = import.meta.env.VITE_OWNER_EMAILS?.split(",").map((e) => e.trim()) || [];
  const managerEmails = import.meta.env.VITE_MANAGER_EMAILS?.split(",").map((e) => e.trim()) || [];

  if (ownerEmails.includes(context.email)) {
    return AuditRole.OWNER;
  }

  if (managerEmails.includes(context.email)) {
    return AuditRole.MANAGER;
  }

  // Staff can see their own logs
  return AuditRole.STAFF;
}

/**
 * Check if user can access audit trail page
 */
export async function canAccessAuditTrail(): Promise<boolean> {
  const role = await getUserAuditRole();
  return role === AuditRole.OWNER || role === AuditRole.MANAGER;
}

/**
 * Filter audit logs based on user role
 * Managers see only business operations, staff see only their own logs
 */
export function applyRoleBasedFilters(
  role: AuditRole,
  userEmail: string,
  filters: AuditLogFilters
): AuditLogFilters {
  switch (role) {
    case AuditRole.OWNER:
      // Owners see everything
      return filters;

    case AuditRole.MANAGER:
      // Managers see business operations only
      return {
        ...filters,
        tableName: filters.tableName || undefined,
        // Restrict to business tables if no table filter specified
        ...(!filters.tableName &&
          {
            // This would need to be implemented in the query layer
            // For now, managers see all tables
          }),
      };

    case AuditRole.STAFF:
      // Staff see only their own actions
      return {
        ...filters,
        userEmail: userEmail,
      };

    default:
      // No access - return empty filters that won't match anything
      return { userEmail: "NO_ACCESS" };
  }
}
```

## Environment Variables

Update `.env.local`:

```bash
# Audit Trail Access Control
VITE_OWNER_EMAILS="owner@resort.com,admin@resort.com"
VITE_MANAGER_EMAILS="manager@resort.com"
```

## Page Layout and Styling

The page uses a consistent layout:

1. **Header** - Title and filter toggle
2. **Stats Panel** - 4-card grid showing key metrics
3. **Filters** - Collapsible filter section
4. **Audit Table** - Main table with pagination

All using shadcn/ui components for consistency with the rest of the app.

## Error Handling

### Unauthorized Access

```typescript
// Route loader handles unauthorized access
beforeLoad: async () => {
  const canAccess = await canAccessAuditTrail();
  if (!canAccess) {
    throw redirect({
      to: "/",
      search: {
        error: "unauthorized",
        message: "You do not have permission to access audit logs",
      },
    });
  }
};
```

### Loading States

```typescript
// Stats panel shows skeletons while loading
if (isLoading) {
  return <Skeleton className="h-16" />;
}
```

## Testing the Page

### Manual Verification

1. **Access Control**

   ```bash
   # Set owner email in .env.local
   VITE_OWNER_EMAILS="your-email@resort.com"

   # Restart dev server
   npm run dev

   # Navigate to /audit-logs
   # Should see audit trail page
   ```

2. **Non-Owner Access**

   ```bash
   # Change email in .env.local to different email
   # Or logout and login as different user
   # Navigate to /audit-logs
   # Should redirect to home with error message
   ```

3. **Navigation Link**
   ```bash
   # Check if "Audit Trail" link appears in navigation
   # Should only appear for owners/managers
   ```

## Troubleshooting

### Problem: "Unauthorized" error even as owner

**Solution**: Verify environment variables are loaded:

```typescript
// Add debug logging
console.log("Owner emails:", import.meta.env.VITE_OWNER_EMAILS);
console.log("Current user:", await getCurrentUserContext());
```

### Problem: Navigation link not appearing

**Solution**: Ensure navigation component re-checks access on auth state change:

```typescript
// Listen to auth changes
useEffect(() => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(() => {
    canAccessAuditTrail().then(setShowAuditLink);
  });
  return () => subscription.unsubscribe();
}, []);
```

### Problem: Page shows briefly then redirects

**Solution**: Use `beforeLoad` in route definition to check access before rendering:

```typescript
beforeLoad: async () => {
  // This runs BEFORE component renders
  const canAccess = await canAccessAuditTrail();
  if (!canAccess) throw redirect({ to: "/" });
};
```

## Next Steps

**Next**: [Phase 3b - Table Component](./03b-table-component.md)

Phase 3b will create the main `AuditLogViewer` table component with pagination, row expansion, and detail views.

You now have:

- ✅ Route configuration with access control
- ✅ Page layout with stats panel
- ✅ Navigation integration
- ✅ Role-based access control utilities

Ready to build the audit log table!

---

**Page Setup Checklist:**

- [ ] Route file created at `src/routes/audit-logs/index.tsx`
- [ ] Access control working (owners only)
- [ ] Stats panel showing correct metrics
- [ ] Navigation link appears for authorized users
- [ ] Environment variables configured
- [ ] Page redirects unauthorized users
