# Phase 3c: Filters and Queries

## Purpose

This document covers the `AuditFilters` component that provides date range pickers, dropdown filters, quick action buttons, and CSV export functionality. This component controls the filters in the Zustand store which trigger data refetching.

**UX Pattern**: Filters update immediately (no "Apply" button needed) due to TanStack Query's automatic refetching.

## Filters Component

### File Location

Create `src/components/audit/AuditFilters.tsx`:

```typescript
// src/components/audit/AuditFilters.tsx

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useAuditStore, QuickFilterPreset } from "@/stores/useAuditStore";
import { useExportAuditLogs } from "@/lib/audit-hooks";
import {
  AUDITED_TABLES,
  TABLE_DISPLAY_NAMES,
  ACTION_DISPLAY_NAMES,
  EVENT_TYPE_DISPLAY_NAMES,
} from "@/lib/audit-constants";
import type { AuditAction, AuditLogFilters, AuditEventType } from "../../../database.types";
import { CalendarIcon, Download, X, Zap } from "lucide-react";
import { format } from "date-fns";

// ============================================
// MAIN FILTERS COMPONENT
// ============================================

export function AuditFilters() {
  const filters = useAuditStore((state) => state.filters);
  const setFilters = useAuditStore((state) => state.setFilters);
  const resetFilters = useAuditStore((state) => state.resetFilters);
  const applyQuickFilter = useAuditStore((state) => state.applyQuickFilter);

  const exportLogs = useExportAuditLogs();

  // Local state for date pickers
  const [startDate, setStartDate] = useState<Date | undefined>(
    filters.startDate ? new Date(filters.startDate) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    filters.endDate ? new Date(filters.endDate) : undefined
  );

  // Filter update handlers
  const updateFilter = (key: keyof AuditLogFilters, value: string | undefined) => {
    setFilters({
      ...filters,
      [key]: value || undefined,
      offset: 0, // Reset to first page when filters change
    });
  };

  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date);
    updateFilter("startDate", date?.toISOString());
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date);
    updateFilter("endDate", date?.toISOString());
  };

  const handleExport = async () => {
    await exportLogs.mutateAsync({
      filters,
      filename: `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`,
    });
  };

  // Check if filters are active
  const hasActiveFilters =
    filters.tableName ||
    filters.userEmail ||
    filters.action ||
    filters.source ||
    filters.eventType ||
    filters.startDate ||
    filters.endDate;

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Quick Actions</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyQuickFilter(QuickFilterPreset.RECENT)}
          >
            <Zap className="h-4 w-4 mr-1" />
            Recent Activity
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyQuickFilter(QuickFilterPreset.DELETIONS)}
          >
            <Zap className="h-4 w-4 mr-1" />
            All Deletions
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyQuickFilter(QuickFilterPreset.BOOKINGS_TODAY)}
          >
            <Zap className="h-4 w-4 mr-1" />
            Today's Bookings
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyQuickFilter(QuickFilterPreset.PAYMENTS_TODAY)}
          >
            <Zap className="h-4 w-4 mr-1" />
            Today's Payments
          </Button>
        </div>
      </div>

      {/* Date Range Filters */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Start Date */}
        <div className="space-y-2">
          <Label htmlFor="start-date">Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="start-date"
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={handleStartDateChange}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* End Date */}
        <div className="space-y-2">
          <Label htmlFor="end-date">End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="end-date"
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={handleEndDateChange}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Dropdown Filters - Row 1 */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Table Filter */}
        <div className="space-y-2">
          <Label htmlFor="table-filter">Table</Label>
          <Select
            value={filters.tableName || "all"}
            onValueChange={(value) => updateFilter("tableName", value === "all" ? undefined : value)}
          >
            <SelectTrigger id="table-filter">
              <SelectValue placeholder="All tables" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tables</SelectItem>
              {AUDITED_TABLES.map((table) => (
                <SelectItem key={table} value={table}>
                  {TABLE_DISPLAY_NAMES[table] || table}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Source Filter (DB vs App) */}
        <div className="space-y-2">
          <Label htmlFor="source-filter">Source</Label>
          <Select
            value={filters.source || "all"}
            onValueChange={(value) => {
              updateFilter("source", value === "all" ? undefined : (value as 'db' | 'app'));
              // Clear event type when source changes (event type only applies to app events)
              if (value !== 'app') {
                updateFilter("eventType", undefined);
              }
            }}
          >
            <SelectTrigger id="source-filter">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="db">Database Triggers (Layer 1)</SelectItem>
              <SelectItem value="app">Application Events (Layer 2)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action Filter */}
        <div className="space-y-2">
          <Label htmlFor="action-filter">Action</Label>
          <Select
            value={filters.action || "all"}
            onValueChange={(value) =>
              updateFilter("action", value === "all" ? undefined : (value as AuditAction))
            }
          >
            <SelectTrigger id="action-filter">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="INSERT">{ACTION_DISPLAY_NAMES.INSERT}</SelectItem>
              <SelectItem value="UPDATE">{ACTION_DISPLAY_NAMES.UPDATE}</SelectItem>
              <SelectItem value="DELETE">{ACTION_DISPLAY_NAMES.DELETE}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Dropdown Filters - Row 2 (conditional) */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Event Type Filter - Only show when source='app' */}
        {filters.source === 'app' && (
          <div className="space-y-2">
            <Label htmlFor="event-type-filter">Event Type</Label>
            <Select
              value={filters.eventType || "all"}
              onValueChange={(value) =>
                updateFilter("eventType", value === "all" ? undefined : value)
              }
            >
              <SelectTrigger id="event-type-filter">
                <SelectValue placeholder="All event types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Event Types</SelectItem>
                <SelectItem value="login">User Login</SelectItem>
                <SelectItem value="logout">User Logout</SelectItem>
                <SelectItem value="login_failed">Failed Login</SelectItem>
                <SelectItem value="password_reset">Password Reset</SelectItem>
                <SelectItem value="cancel_booking">Booking Cancelled</SelectItem>
                <SelectItem value="booking_checked_in">Booking Checked In</SelectItem>
                <SelectItem value="booking_checked_out">Booking Checked Out</SelectItem>
                <SelectItem value="booking_status_override">Booking Status Override</SelectItem>
                <SelectItem value="refund_payment">Payment Refunded</SelectItem>
                <SelectItem value="payment_failed">Payment Failed</SelectItem>
                <SelectItem value="payment_verified">Payment Verified</SelectItem>
                <SelectItem value="expense_deleted">Expense Deleted</SelectItem>
                <SelectItem value="expense_category_changed">Expense Category Changed</SelectItem>
                <SelectItem value="system_migration">System Migration</SelectItem>
                <SelectItem value="system_config_change">System Config Change</SelectItem>
                <SelectItem value="system_backup">System Backup</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* User Email Filter (Text Input) */}
        <div className="space-y-2">
          <Label htmlFor="user-filter">User Email</Label>
          <input
            id="user-filter"
            type="email"
            placeholder="Filter by email..."
            value={filters.userEmail || ""}
            onChange={(e) => updateFilter("userEmail", e.target.value || undefined)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">Active Filters:</span>
          {filters.tableName && (
            <Badge variant="secondary" className="gap-1">
              Table: {TABLE_DISPLAY_NAMES[filters.tableName]}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("tableName", undefined)}
              />
            </Badge>
          )}
          {filters.source && (
            <Badge variant="secondary" className="gap-1">
              Source: {filters.source === 'db' ? 'Database Triggers' : 'Application Events'}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("source", undefined)}
              />
            </Badge>
          )}
          {filters.eventType && (
            <Badge variant="secondary" className="gap-1">
              Event: {EVENT_TYPE_DISPLAY_NAMES[filters.eventType] || filters.eventType}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("eventType", undefined)}
              />
            </Badge>
          )}
          {filters.action && (
            <Badge variant="secondary" className="gap-1">
              Action: {ACTION_DISPLAY_NAMES[filters.action]}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("action", undefined)}
              />
            </Badge>
          )}
          {filters.userEmail && (
            <Badge variant="secondary" className="gap-1">
              User: {filters.userEmail}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter("userEmail", undefined)}
              />
            </Badge>
          )}
          {filters.startDate && (
            <Badge variant="secondary" className="gap-1">
              From: {format(new Date(filters.startDate), "PP")}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => {
                  setStartDate(undefined);
                  updateFilter("startDate", undefined);
                }}
              />
            </Badge>
          )}
          {filters.endDate && (
            <Badge variant="secondary" className="gap-1">
              To: {format(new Date(filters.endDate), "PP")}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => {
                  setEndDate(undefined);
                  updateFilter("endDate", undefined);
                }}
              />
            </Badge>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={resetFilters}
          disabled={!hasActiveFilters}
        >
          <X className="h-4 w-4 mr-1" />
          Clear All Filters
        </Button>

        <Button
          variant="default"
          onClick={handleExport}
          disabled={exportLogs.isPending}
        >
          <Download className="h-4 w-4 mr-1" />
          {exportLogs.isPending ? "Exporting..." : "Export to CSV"}
        </Button>
      </div>
    </div>
  );
}
```

## Filter Features

### 1. Quick Action Buttons

Pre-configured filters for common queries:

- **Recent Activity** - Last 50 logs
- **All Deletions** - Security audit
- **Today's Bookings** - Today's booking changes
- **Today's Payments** - Today's payment activity

### 2. Date Range Picker

- shadcn/ui Calendar component
- ISO 8601 date format for queries
- Clear button to remove date filters
- Popover for space-efficient UI

### 3. Dropdown Filters

- **Table** - Filter by specific table (bookings, units, etc.)
- **Source** - Filter by log source (Database Triggers vs Application Events)
- **Action** - Filter by operation type (INSERT, UPDATE, DELETE)
- **Event Type** - Filter by semantic business event (conditional, only shown when source='app')
- **User Email** - Text input for email filtering

### 4. Conditional Event Type Filter

The Event Type filter is **only visible when Source filter is set to "Application Events"**:

- Automatically hidden when source is 'db' or unset
- Clears automatically when changing source from 'app' to another value
- Shows all 15+ predefined event types (login, cancel_booking, refund_payment, etc.)
- Helps distinguish between business events with same database action

**Example Use Case**:

```typescript
// Both of these create INSERT records, but with different event types:
// 1. User login: source='app', action='INSERT', event_type='login'
// 2. Booking cancelled: source='app', action='INSERT', event_type='cancel_booking'

// Filter to see only login events:
filters = { source: "app", eventType: "login" };
```

### 5. Active Filters Display

- Shows currently active filters as badges
- Click X on badge to remove individual filter
- "Clear All Filters" button to reset everything
- Includes display names for event types (uses EVENT_TYPE_DISPLAY_NAMES)

### 6. CSV Export

- Exports filtered results to CSV
- Filename includes current date
- Handles up to 10,000 logs (configured in hook)
- Uses browser download API
- Includes event_type column in export

## Display Helper Function

### getDisplayAction()

Helper function to show proper action text based on source and event_type:

```typescript
/**
 * Get display text for audit log action/event
 * Prioritizes event_type for app events, falls back to action for DB events
 */
function getDisplayAction(log: AuditLog): string {
  // For app events, show event type if available
  if (log.source === "app" && log.event_type) {
    return EVENT_TYPE_DISPLAY_NAMES[log.event_type] || log.event_type;
  }

  // For DB events, show database action
  return ACTION_DISPLAY_NAMES[log.action] || log.action;
}
```

**Usage in Table Component**:

```typescript
<TableCell>{getDisplayAction(log)}</TableCell>

// Example outputs:
// - DB event: "Created" (from INSERT action)
// - App event with event_type: "User Login" (from login event_type)
// - App event without event_type: "Created" (falls back to INSERT action)
```

This ensures the UI always shows the most meaningful label:

- **Database triggers** (source='db'): Show CRUD action (INSERT/UPDATE/DELETE)
- **Application events** (source='app' with event_type): Show business event (Login, Booking Cancelled, etc.)
- **Legacy app events** (source='app' without event_type): Fall back to action

## Filter Behavior

### Immediate Updates

Filters update as soon as they change (no "Apply" button):

```typescript
// Filter change triggers immediate re-render
const updateFilter = (key: keyof AuditLogFilters, value: string | undefined) => {
  setFilters({
    ...filters,
    [key]: value || undefined,
    offset: 0, // Reset to first page
  });
};

// TanStack Query automatically refetches when filters change
const { data } = useAuditLogs(filters);
```

### Pagination Reset

When filters change, pagination resets to page 1:

```typescript
setFilters({
  ...filters,
  tableName: newTable,
  offset: 0, // Reset to first page
});
```

## Quick Filter Presets

Defined in Zustand store (`useAuditStore.ts`):

```typescript
export enum QuickFilterPreset {
  RECENT = "recent",
  FAILED_LOGINS = "failed_logins",
  DELETIONS = "deletions",
  CRITICAL = "critical",
  BOOKINGS_TODAY = "bookings_today",
  PAYMENTS_TODAY = "payments_today",
}
```

Add more presets as needed for your resort's common queries.

## CSV Export Implementation

The export functionality is in the `useExportAuditLogs` hook:

```typescript
// From 02d-react-hooks-and-store.md
export function useExportAuditLogs() {
  return useMutation<void, Error, { filters?: AuditLogFilters; filename?: string }>({
    mutationFn: async ({ filters, filename }) => {
      const result = await db.auditLogs.all({
        ...filters,
        limit: 10000, // Export limit
      });

      const csv = convertLogsToCSV(result.data);
      downloadCSV(csv, filename || `audit-logs-${new Date().toISOString().split("T")[0]}.csv`);
    },
  });
}
```

### CSV Format

```csv
Timestamp,User Email,Table,Action,Record ID,Changed Fields,Description
2024-01-15T10:30:00Z,owner@resort.com,bookings,UPDATE,123e4567-...,booking_status,"Booking cancelled"
...
```

## Styling and Layout

### Responsive Grid

```typescript
// 2-column grid for date pickers
<div className="grid gap-4 md:grid-cols-2">

// 3-column grid for dropdown filters
<div className="grid gap-4 md:grid-cols-3">
```

### Active Filter Badges

```typescript
// Badge with remove button
<Badge variant="secondary" className="gap-1">
  Table: Bookings
  <X
    className="h-3 w-3 cursor-pointer"
    onClick={() => removeFilter('tableName')}
  />
</Badge>
```

## Accessibility

- **Labels**: All form fields have proper labels
- **ARIA**: Select components have proper ARIA attributes
- **Keyboard**: All interactive elements are keyboard accessible
- **Focus Management**: Popover calendars manage focus correctly

## Performance Considerations

### Debounced Text Input (Optional)

For better performance with text filters:

```typescript
import { useDebouncedCallback } from "use-debounce";

const debouncedUpdateEmail = useDebouncedCallback(
  (value: string) => updateFilter("userEmail", value || undefined),
  300 // 300ms delay
);

<input
  onChange={(e) => debouncedUpdateEmail(e.target.value)}
/>
```

### Filter Persistence

Filters persist across page reloads via Zustand persist middleware:

```typescript
// From useAuditStore.ts
persist(
  (set, get) => ({
    /* store definition */
  }),
  {
    name: "audit-store",
    partialize: (state) => ({
      filters: state.filters, // Persisted
      showFilters: state.showFilters, // Persisted
    }),
  }
);
```

## Testing Checklist

- [ ] Quick action buttons apply correct filters
- [ ] Date pickers update filters correctly
- [ ] Dropdown filters work for table/action/source
- [ ] Source filter shows "Database Triggers" and "Application Events"
- [ ] Event type filter only appears when source='app'
- [ ] Event type filter clears when changing source away from 'app'
- [ ] Event type dropdown shows all 15+ event types
- [ ] Email text input filters correctly
- [ ] Active filter badges display for all filter types
- [ ] Active filter badges show proper display names for event types
- [ ] "Clear All Filters" resets everything including source and eventType
- [ ] CSV export downloads file with event_type column
- [ ] Filters persist across page reload
- [ ] Pagination resets when filters change
- [ ] getDisplayAction() shows correct labels for DB vs App events

## Next Steps

**Next**: [Phase 3d - Diff Viewer](./03d-diff-viewer.md)

Phase 3d will create the `AuditDiffViewer` dialog component that shows before/after changes with highlighted differences.

---

**Filters Component Checklist:**

- [ ] `AuditFilters.tsx` component created
- [ ] All filter types working (date, dropdown, text)
- [ ] Quick action buttons functional
- [ ] CSV export downloads correctly
- [ ] Active filters display as badges
- [ ] Clear filters button works
- [ ] Filters persist across reloads
