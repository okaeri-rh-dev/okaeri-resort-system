# Phase 5: Complete API Reference

## Overview

This document provides comprehensive API documentation for all audit trail system components, including database helpers, logging functions, React hooks, Zustand store, types, and constants.

---

## Database Helpers (`db.auditLogs.*`)

Location: `src/lib/supabase.ts`

### `db.auditLogs.all(filters?)`

Fetch paginated audit logs with optional filters.

**Signature:**

```typescript
all(filters?: AuditLogFilters): Promise<AuditLogQueryResult>
```

**Parameters:**

- `filters?` - Optional filter criteria

**Returns:**

```typescript
{
  data: AuditLog[],
  totalCount: number,
  hasMore: boolean,
  currentPage: number,
  totalPages: number
}
```

**Example:**

```typescript
const result = await db.auditLogs.all({
  tableName: "bookings",
  startDate: "2024-01-01T00:00:00Z",
  limit: 50,
  offset: 0,
});
console.log(`Found ${result.totalCount} logs, showing page ${result.currentPage}`);
```

---

### `db.auditLogs.byId(auditId)`

Get single audit log by ID.

**Signature:**

```typescript
byId(auditId: string): Promise<{ data: AuditLog | null; error: Error | null }>
```

**Parameters:**

- `auditId` - UUID of audit log

**Example:**

```typescript
const { data: log, error } = await db.auditLogs.byId("123e4567-...");
if (log) {
  console.log("Found log:", log.created_at, log.action);
}
```

---

### `db.auditLogs.byRecord(tableName, recordId)`

Get audit trail for a specific record.

**Signature:**

```typescript
byRecord(tableName: string, recordId: string): Promise<AuditLog[]>
```

**Parameters:**

- `tableName` - Table name (bookings, units, etc)
- `recordId` - UUID of record

**Returns:** Array of audit logs in chronological order (oldest first)

**Example:**

```typescript
const history = await db.auditLogs.byRecord("bookings", booking.booking_id);
console.log(`Booking has ${history.length} changes`);
history.forEach((log) => {
  console.log(`${log.created_at}: ${log.action} by ${log.user_email}`);
});
```

---

### `db.auditLogs.byUser(userEmail, limit?)`

Get audit logs for a specific user.

**Signature:**

```typescript
byUser(userEmail: string, limit = 100): Promise<AuditLog[]>
```

**Parameters:**

- `userEmail` - User email to filter by
- `limit?` - Maximum logs to return (default 100)

**Example:**

```typescript
const userLogs = await db.auditLogs.byUser("owner@resort.com", 50);
console.log(`User has ${userLogs.length} recent actions`);
```

---

### `db.auditLogs.recent(limit?)`

Get most recent audit logs.

**Signature:**

```typescript
recent(limit = 50): Promise<AuditLog[]>
```

**Parameters:**

- `limit?` - Number of logs to return (default 50)

**Example:**

```typescript
const recentLogs = await db.auditLogs.recent(10);
console.log(
  "Last 10 actions:",
  recentLogs.map((l) => l.action)
);
```

---

### `db.auditLogs.stats(filters?)`

Get aggregated audit statistics.

**Signature:**

```typescript
stats(filters?: AuditLogFilters): Promise<AuditLogStats>
```

**Returns:**

```typescript
{
  totalLogs: number,
  byTable: Record<string, number>,
  byAction: Record<AuditAction, number>,
  byUser: Array<{ email: string; count: number }>,
  recentActivity: Array<{ date: string; count: number }>
}
```

**Example:**

```typescript
const stats = await db.auditLogs.stats();
console.log(`Total logs: ${stats.totalLogs}`);
console.log("Most active table:", Object.entries(stats.byTable).sort((a, b) => b[1] - a[1])[0]);
```

---

### `db.auditLogs.create(context)`

Create manual audit log entry (Layer 2 logging).

**Signature:**

```typescript
create(context: AuditEventContext): Promise<{ data: AuditLog | null; error: Error | null }>
```

**Parameters:**

```typescript
interface AuditEventContext {
  tableName: string;
  recordId?: string;
  action: AuditAction;
  description: string;
  category: AuditCategory;
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
}
```

**Example:**

```typescript
const { data, error } = await db.auditLogs.create({
  tableName: "bookings",
  recordId: booking.booking_id,
  action: "UPDATE",
  description: "Booking cancelled by guest request",
  category: AuditCategory.BOOKING,
  severity: AuditSeverity.WARNING,
  metadata: { cancellationReason: "Personal emergency" },
});
```

---

### `db.auditLogs.archiveOld(beforeDate)`

Delete old audit logs (manual archival).

**Signature:**

```typescript
archiveOld(beforeDate: string): Promise<number>
```

**Parameters:**

- `beforeDate` - ISO date string, delete logs before this date

**Returns:** Number of deleted logs

**Example:**

```typescript
const twoYearsAgo = new Date();
twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
const deleted = await db.auditLogs.archiveOld(twoYearsAgo.toISOString());
console.log(`Archived ${deleted} old logs`);
```

---

## Audit Logger Functions

Location: `src/lib/audit-logger.ts`

### `logAuditEvent(context)`

Main audit logging function for Layer 2 (application) logs.

**Signature:**

```typescript
logAuditEvent(context: AuditEventContext): Promise<{ success: boolean; error?: string }>
```

**Parameters:** Same as `db.auditLogs.create`

**Returns:**

```typescript
{
  success: boolean,
  error?: string
}
```

**Example:**

```typescript
const result = await logAuditEvent({
  tableName: "payments",
  action: "INSERT",
  description: "Payment recorded",
  category: AuditCategory.PAYMENT,
  metadata: { amount: 5000, method: "GCash" },
});
if (result.success) {
  console.log("Audit log created");
}
```

---

### Specialized Logging Functions

#### `logAuthEvent(event, details?)`

Log authentication events.

**Signature:**

```typescript
logAuthEvent(
  event: 'login' | 'logout' | 'login_failed' | 'password_reset',
  details?: { email?: string; reason?: string; metadata?: Record<string, unknown> }
): Promise<void>
```

**Example:**

```typescript
await logAuthEvent("login", { email: "owner@resort.com" });
await logAuthEvent("login_failed", { email: "hacker@evil.com", reason: "Invalid password" });
```

---

#### `logBookingEvent(bookingId, action, details)`

Log booking lifecycle events.

**Signature:**

```typescript
logBookingEvent(
  bookingId: string,
  action: 'created' | 'updated' | 'cancelled' | 'checked_in' | 'checked_out',
  details: {
    oldStatus?: string;
    newStatus?: string;
    reason?: string;
    amount?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<void>
```

**Example:**

```typescript
await logBookingEvent(booking.booking_id, "cancelled", {
  oldStatus: "Confirmed",
  newStatus: "Cancelled",
  reason: "Guest request",
  amount: booking.total_amount,
});
```

---

#### `logPaymentEvent(paymentId, action, details)`

Log payment events.

**Signature:**

```typescript
logPaymentEvent(
  paymentId: string,
  action: 'recorded' | 'verified' | 'refunded' | 'failed',
  details: {
    amount: number;
    paymentMethod: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void>
```

**Example:**

```typescript
await logPaymentEvent(payment.payment_id, "refunded", {
  amount: 5000,
  paymentMethod: "GCash",
  reason: "Booking cancelled",
});
```

---

#### `logExpenseEvent(expenseId, action, details)`

Log expense tracking events.

**Signature:**

```typescript
logExpenseEvent(
  expenseId: string,
  action: 'created' | 'updated' | 'deleted',
  details: {
    amount: number;
    category: string;
    description: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void>
```

---

#### `logSystemEvent(operation, details?)`

Log critical system operations.

**Signature:**

```typescript
logSystemEvent(
  operation: string,
  details?: {
    severity?: AuditSeverity;
    metadata?: Record<string, unknown>;
  }
): Promise<void>
```

**Example:**

```typescript
await logSystemEvent("Database migration completed", {
  severity: AuditSeverity.INFO,
  metadata: { version: "2.5.0", duration: "2.3s" },
});
```

---

### Access Control Functions

#### `getCurrentUserContext()`

Get current user context from Supabase Auth.

**Signature:**

```typescript
getCurrentUserContext(): Promise<{ userId: string | null; email: string | null } | null>
```

---

#### `isCurrentUserOwner()`

Check if current user is an owner.

**Signature:**

```typescript
isCurrentUserOwner(): Promise<boolean>
```

---

#### `getUserAuditRole()`

Get user's audit access role.

**Signature:**

```typescript
getUserAuditRole(): Promise<AuditRole>

enum AuditRole {
  OWNER = "owner",
  MANAGER = "manager",
  STAFF = "staff",
  NONE = "none"
}
```

---

#### `canAccessAuditTrail()`

Check if user can access audit trail page.

**Signature:**

```typescript
canAccessAuditTrail(): Promise<boolean>
```

---

## React Hooks (TanStack Query)

Location: `src/lib/audit-hooks.ts`

### `useAuditLogs(filters?)`

Fetch paginated audit logs.

**Signature:**

```typescript
useAuditLogs(filters?: AuditLogFilters): UseQueryResult<AuditLogQueryResult, Error>
```

**Returns:** TanStack Query result object

**Example:**

```typescript
function Component() {
  const { data, isLoading, error } = useAuditLogs({
    tableName: 'bookings',
    limit: 50
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>Found {data?.totalCount} logs</div>;
}
```

---

### `useAuditLog(auditId)`

Fetch single audit log by ID.

**Signature:**

```typescript
useAuditLog(auditId: string): UseQueryResult<AuditLog, Error>
```

---

### `useAuditTrail(tableName, recordId)`

Fetch audit trail for specific record.

**Signature:**

```typescript
useAuditTrail(tableName: string, recordId: string): UseQueryResult<AuditLog[], Error>
```

**Example:**

```typescript
function BookingHistory({ bookingId }: { bookingId: string }) {
  const { data: history } = useAuditTrail('bookings', bookingId);

  return (
    <div>
      {history?.map(log => (
        <div key={log.audit_id}>
          {log.created_at}: {log.action}
        </div>
      ))}
    </div>
  );
}
```

---

### `useAuditStats(filters?)`

Fetch audit statistics.

**Signature:**

```typescript
useAuditStats(filters?: AuditLogFilters): UseQueryResult<AuditLogStats, Error>
```

---

### `useRecentAuditLogs(limit?)`

Fetch recent audit logs.

**Signature:**

```typescript
useRecentAuditLogs(limit = 50): UseQueryResult<AuditLog[], Error>
```

---

### `useUserAuditLogs(userEmail, limit?)`

Fetch user activity logs.

**Signature:**

```typescript
useUserAuditLogs(userEmail: string, limit = 100): UseQueryResult<AuditLog[], Error>
```

---

### Mutation Hooks

#### `useCreateAuditLog()`

Create manual audit log.

**Signature:**

```typescript
useCreateAuditLog(): UseMutationResult<AuditLog, Error, AuditEventContext>
```

**Example:**

```typescript
function Component() {
  const createLog = useCreateAuditLog();

  const handleAction = async () => {
    await createLog.mutateAsync({
      tableName: 'bookings',
      action: 'UPDATE',
      description: 'Manual change',
      category: AuditCategory.BOOKING
    });
  };

  return <button onClick={handleAction}>Log Action</button>;
}
```

---

#### `useArchiveAuditLogs()`

Archive old audit logs.

**Signature:**

```typescript
useArchiveAuditLogs(): UseMutationResult<number, Error, string>
```

---

#### `useExportAuditLogs()`

Export audit logs to CSV.

**Signature:**

```typescript
useExportAuditLogs(): UseMutationResult<void, Error, { filters?: AuditLogFilters; filename?: string }>
```

**Example:**

```typescript
function ExportButton() {
  const exportLogs = useExportAuditLogs();

  return (
    <button onClick={() => exportLogs.mutateAsync({ filename: 'audit-logs.csv' })}>
      Export CSV
    </button>
  );
}
```

---

## Zustand Store (`useAuditStore`)

Location: `src/stores/useAuditStore.ts`

### State

```typescript
interface AuditStore {
  selectedLog: AuditLog | null;
  filters: AuditLogFilters;
  showFilters: boolean;
  tableState: Partial<TableState>;
}
```

### Actions

#### `setSelectedLog(log)`

Set currently selected audit log.

#### `setFilters(filters)`

Update filter criteria (resets pagination).

#### `resetFilters()`

Clear all filters.

#### `toggleFilters()`

Show/hide filter panel.

#### `setTableState(state)`

Update table state (pagination, etc).

#### `applyQuickFilter(preset)`

Apply preset filter.

**Presets:**

- `QuickFilterPreset.RECENT` - Last 50 logs
- `QuickFilterPreset.DELETIONS` - All deletions
- `QuickFilterPreset.BOOKINGS_TODAY` - Today's booking changes
- `QuickFilterPreset.PAYMENTS_TODAY` - Today's payment activity

### Example Usage

```typescript
function Component() {
  const filters = useAuditStore((state) => state.filters);
  const setFilters = useAuditStore((state) => state.setFilters);
  const applyQuickFilter = useAuditStore((state) => state.applyQuickFilter);

  return (
    <>
      <button onClick={() => applyQuickFilter(QuickFilterPreset.RECENT)}>
        Recent
      </button>
      <button onClick={() => setFilters({ tableName: 'bookings' })}>
        Bookings Only
      </button>
    </>
  );
}
```

### Selector Hooks

```typescript
const filters = useAuditFilters(); // Optimized filter selector
const selectedLog = useSelectedAuditLog(); // Optimized selection selector
const tableState = useAuditTableState(); // Optimized table state selector
```

---

## TypeScript Types

Location: `database.types.ts`

### Core Types

```typescript
type AuditAction = "INSERT" | "UPDATE" | "DELETE";

enum AuditCategory {
  AUTHENTICATION = "authentication",
  BOOKING = "booking",
  PAYMENT = "payment",
  GUEST = "guest",
  UNIT = "unit",
  EXPENSE = "expense",
  MAINTENANCE = "maintenance",
  SYSTEM = "system",
}

enum AuditSeverity {
  INFO = "info",
  WARNING = "warning",
  CRITICAL = "critical",
}

interface AuditLog {
  audit_id: string;
  created_at: string;
  table_name: string;
  record_id: string | null;
  action: AuditAction;
  user_id: string | null;
  user_email: string | null;
  ip_address: string | null;
  changed_fields: string[] | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

interface AuditLogFilters {
  startDate?: string;
  endDate?: string;
  userEmail?: string;
  userId?: string;
  tableName?: string;
  recordId?: string;
  action?: AuditAction;
  category?: AuditCategory;
  severity?: AuditSeverity;
  limit?: number;
  offset?: number;
}

interface AuditLogQueryResult {
  data: AuditLog[];
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
}

interface AuditLogStats {
  totalLogs: number;
  byTable: Record<string, number>;
  byAction: Record<AuditAction, number>;
  byUser: Array<{ email: string; count: number }>;
  recentActivity: Array<{ date: string; count: number }>;
}

interface AuditEventContext {
  tableName: string;
  recordId?: string;
  action: AuditAction;
  description: string;
  category: AuditCategory;
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
}
```

---

## Constants

Location: `src/lib/audit-constants.ts`

### Sensitive Fields

```typescript
const SENSITIVE_FIELDS: Record<string, string[]>
const REDACTION_PLACEHOLDER = '[REDACTED]'

getSensitiveFields(tableName: string): string[]
isSensitiveField(tableName: string, fieldName: string): boolean
redactSensitiveData(tableName: string, data: Record<string, unknown> | null): Record<string, unknown> | null
```

### Audited Tables

```typescript
const AUDITED_TABLES = ['units', 'guests', 'bookings', 'payments', 'expenses', 'maintenance_logs']
type AuditedTable = typeof AUDITED_TABLES[number]

isAuditedTable(tableName: string): tableName is AuditedTable
```

### Display Names

```typescript
const TABLE_DISPLAY_NAMES: Record<string, string>;
const ACTION_DISPLAY_NAMES: Record<AuditAction, string>;
const CATEGORY_DISPLAY_NAMES: Record<AuditCategory, string>;
const SEVERITY_COLORS: Record<AuditSeverity, string>;
```

### Pagination Defaults

```typescript
const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 200,
  STATS_LIMIT: 10,
  EXPORT_BATCH_SIZE: 1000,
  RECENT_ACTIVITY_DAYS: 7,
};
```

### Cache Configuration

```typescript
const AUDIT_CACHE_CONFIG = {
  STALE_TIME: 5 * 60 * 1000, // 5 minutes
  CACHE_TIME: 30 * 60 * 1000, // 30 minutes
  RETRY: 2,
  REFETCH_ON_WINDOW_FOCUS: false,
};
```

### Environment Utilities

```typescript
getOwnerEmails(): string[]
isOwnerEmail(email: string): boolean
auditDebugLog(message: string, data?: unknown): void
```

---

## Next Steps

**Next**: [Phase 6 - Troubleshooting](./06-troubleshooting.md)

Phase 6 provides comprehensive troubleshooting guidance for common issues, diagnostic queries, and debugging procedures.

---

**API Reference Checklist:**

- ✅ All database helpers documented
- ✅ All logging functions documented
- ✅ All React hooks documented
- ✅ Zustand store API documented
- ✅ TypeScript types documented
- ✅ Constants and utilities documented
- ✅ Usage examples provided
