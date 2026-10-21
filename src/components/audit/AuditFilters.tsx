// src/components/audit/AuditFilters.tsx

import { useState } from "react";

import { format } from "date-fns";
import { Download, X, Zap } from "lucide-react";

import {
  Button,
  DateRangePicker,
  FilterBar,
  FilterPopover,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  TableSearch,
  type DateRange,
} from "@/components/patterns";
import { ACTION_DISPLAY_NAMES, ALL_AUDIT_TABLES, TABLE_DISPLAY_NAMES } from "@/lib/audit-constants";
import { useExportAuditLogs } from "@/lib/audit-hooks";
import { QuickFilterPreset, useAuditStore } from "@/stores/useAuditStore";
import {
  AuditEventType,
  EVENT_TYPE_DISPLAY_NAMES,
  type AuditAction,
  type AuditLogFilters,
} from "@/types/audit.types";

// ============================================
// MAIN FILTERS COMPONENT
// ============================================

export function AuditFilters() {
  const filters = useAuditStore((state) => state.filters);
  const setFilters = useAuditStore((state) => state.setFilters);
  const resetFilters = useAuditStore((state) => state.resetFilters);
  const applyQuickFilter = useAuditStore((state) => state.applyQuickFilter);

  const exportLogs = useExportAuditLogs();

  // User email search query (for TableSearch component)
  const [searchQuery, setSearchQuery] = useState(filters.userEmail || "");

  // Filter update handler (immediate for dropdowns/text, not for date range)
  const updateFilter = (key: keyof AuditLogFilters, value: string | undefined) => {
    setFilters({
      ...filters,
      [key]: value || undefined,
      offset: 0, // Reset to first page when filters change
    });
  };

  // Handle CSV export
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

  // Count active filter types (excluding search)
  const activeFilterCount = (): number => {
    let count = 0;
    if (filters.tableName) count++;
    if (filters.source) count++;
    if (filters.action) count++;
    if (filters.eventType) count++;
    if (filters.startDate || filters.endDate) count++;
    return count;
  };

  // Extracted sub-components for reuse in both layouts
  const TableFilter = () => (
    <FilterPopover
      isActive={!!filters.tableName}
      content={
        <div className="space-y-2">
          <div className="text-sm font-medium">Table</div>
          <Select
            value={filters.tableName || "all"}
            onValueChange={(value: string) =>
              updateFilter("tableName", value === "all" ? undefined : value)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tables</SelectItem>
              {ALL_AUDIT_TABLES.map((table) => (
                <SelectItem key={table} value={table}>
                  {TABLE_DISPLAY_NAMES[table] || table}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      Table
    </FilterPopover>
  );

  const SourceFilter = () => (
    <FilterPopover
      isActive={!!filters.source}
      content={
        <div className="space-y-2">
          <div className="text-sm font-medium">Source</div>
          <Select
            value={filters.source || "all"}
            onValueChange={(value: string) => {
              updateFilter("source", value === "all" ? undefined : (value as "db" | "app"));
              if (value !== "app") {
                updateFilter("eventType", undefined);
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="db">Database Triggers (Layer 1)</SelectItem>
              <SelectItem value="app">Application Events (Layer 2)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      Source
    </FilterPopover>
  );

  const ActionFilter = () => (
    <FilterPopover
      isActive={!!filters.action}
      content={
        <div className="space-y-2">
          <div className="text-sm font-medium">Action</div>
          <Select
            value={filters.action || "all"}
            onValueChange={(value: string) =>
              updateFilter("action", value === "all" ? undefined : (value as AuditAction))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="INSERT">{ACTION_DISPLAY_NAMES.INSERT}</SelectItem>
              <SelectItem value="UPDATE">{ACTION_DISPLAY_NAMES.UPDATE}</SelectItem>
              <SelectItem value="DELETE">{ACTION_DISPLAY_NAMES.DELETE}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      Action
    </FilterPopover>
  );

  const EventTypeFilter = () => (
    <FilterPopover
      isActive={!!filters.eventType}
      content={
        <div className="space-y-2">
          <div className="text-sm font-medium">Event Type</div>
          <Select
            value={filters.eventType || "all"}
            onValueChange={(value: string) =>
              updateFilter("eventType", value === "all" ? undefined : value)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Event Types</SelectItem>
              <SelectItem value={AuditEventType.LOGIN}>User Login</SelectItem>
              <SelectItem value={AuditEventType.LOGOUT}>User Logout</SelectItem>
              <SelectItem value={AuditEventType.LOGIN_FAILED}>Failed Login</SelectItem>
              <SelectItem value={AuditEventType.PASSWORD_RESET}>Password Reset</SelectItem>
              <SelectItem value={AuditEventType.CANCEL_BOOKING}>Booking Cancelled</SelectItem>
              <SelectItem value={AuditEventType.BOOKING_CHECKED_IN}>Guest Checked In</SelectItem>
              <SelectItem value={AuditEventType.BOOKING_CHECKED_OUT}>Guest Checked Out</SelectItem>
              <SelectItem value={AuditEventType.BOOKING_STATUS_OVERRIDE}>
                Booking Status Override
              </SelectItem>
              <SelectItem value={AuditEventType.REFUND_PAYMENT}>Payment Refunded</SelectItem>
              <SelectItem value={AuditEventType.PAYMENT_FAILED}>Payment Failed</SelectItem>
              <SelectItem value={AuditEventType.PAYMENT_VERIFIED}>Payment Verified</SelectItem>
              <SelectItem value={AuditEventType.EXPENSE_DELETED}>Expense Deleted</SelectItem>
              <SelectItem value={AuditEventType.EXPENSE_CATEGORY_CHANGED}>
                Expense Category Changed
              </SelectItem>
              <SelectItem value={AuditEventType.SYSTEM_MIGRATION}>System Migration</SelectItem>
              <SelectItem value={AuditEventType.SYSTEM_CONFIG_CHANGED}>
                Configuration Change
              </SelectItem>
              <SelectItem value={AuditEventType.SYSTEM_BACKUP}>System Backup</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      Event Type
    </FilterPopover>
  );

  const dateRange: DateRange | undefined = filters.startDate
    ? {
        from: new Date(filters.startDate),
        to: filters.endDate ? new Date(filters.endDate) : undefined,
      }
    : undefined;

  const applyDateRange = (range: DateRange | undefined) => {
    const fromDate = range?.from;
    const toDate = range?.to || fromDate;
    setFilters({
      ...filters,
      startDate: fromDate?.toISOString(),
      endDate: toDate?.toISOString(),
      offset: 0,
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Row: Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyQuickFilter(QuickFilterPreset.RECENT)}
        >
          <Zap className="mr-1 h-3 w-3" />
          Recent Activity
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyQuickFilter(QuickFilterPreset.DELETIONS)}
        >
          <Zap className="mr-1 h-3 w-3" />
          All Deletions
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyQuickFilter(QuickFilterPreset.BOOKINGS_TODAY)}
        >
          <Zap className="mr-1 h-3 w-3" />
          Today's Bookings
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyQuickFilter(QuickFilterPreset.PAYMENTS_TODAY)}
        >
          <Zap className="mr-1 h-3 w-3" />
          Today's Payments
        </Button>
      </div>

      <FilterBar
        search={
          <TableSearch
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              updateFilter("userEmail", value || undefined);
            }}
            placeholder="Search by email..."
          />
        }
        filters={
          <>
            <TableFilter />
            <SourceFilter />
            <ActionFilter />
            {/* Event Type Filter - Only shown when source='app' */}
            {filters.source === "app" && <EventTypeFilter />}
            <DateRangePicker
              value={dateRange}
              onChange={applyDateRange}
              placeholder="Dates"
              aria-label="Filter by date range"
              className="w-56"
            />
          </>
        }
        activeFilterCount={activeFilterCount()}
        onClearFilters={
          hasActiveFilters
            ? () => {
                resetFilters();
                setSearchQuery("");
              }
            : undefined
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exportLogs.isPending}
          >
            <Download className="mr-1 h-3 w-3" />
            {exportLogs.isPending ? "Exporting..." : "Export CSV"}
          </Button>
        }
      />

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground text-sm font-medium">Active Filters:</span>
          {filters.tableName && (
            <StatusBadge tone="neutral">
              Table:{" "}
              {TABLE_DISPLAY_NAMES[filters.tableName as keyof typeof TABLE_DISPLAY_NAMES] ||
                filters.tableName}
              <RemoveFilterButton onClick={() => updateFilter("tableName", undefined)} />
            </StatusBadge>
          )}
          {filters.source && (
            <StatusBadge tone="neutral">
              Source: {filters.source === "db" ? "Database Triggers" : "Application Events"}
              <RemoveFilterButton onClick={() => updateFilter("source", undefined)} />
            </StatusBadge>
          )}
          {filters.eventType && (
            <StatusBadge tone="neutral">
              Event: {EVENT_TYPE_DISPLAY_NAMES[filters.eventType] || filters.eventType}
              <RemoveFilterButton onClick={() => updateFilter("eventType", undefined)} />
            </StatusBadge>
          )}
          {filters.action && (
            <StatusBadge tone="neutral">
              Action: {ACTION_DISPLAY_NAMES[filters.action as AuditAction]}
              <RemoveFilterButton onClick={() => updateFilter("action", undefined)} />
            </StatusBadge>
          )}
          {filters.userEmail && (
            <StatusBadge tone="neutral">
              User: {filters.userEmail}
              <RemoveFilterButton
                onClick={() => {
                  updateFilter("userEmail", undefined);
                  setSearchQuery("");
                }}
              />
            </StatusBadge>
          )}
          {filters.startDate && (
            <StatusBadge tone="neutral">
              From: {format(new Date(filters.startDate), "PP")}
              <RemoveFilterButton
                onClick={() => {
                  setFilters({
                    ...filters,
                    startDate: undefined,
                    offset: 0,
                  });
                }}
              />
            </StatusBadge>
          )}
          {filters.endDate && (
            <StatusBadge tone="neutral">
              To: {format(new Date(filters.endDate), "PP")}
              <RemoveFilterButton
                onClick={() => {
                  setFilters({
                    ...filters,
                    endDate: undefined,
                    offset: 0,
                  });
                }}
              />
            </StatusBadge>
          )}
        </div>
      )}
    </div>
  );
}

function RemoveFilterButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove filter"
      className="hover:text-destructive -my-1 ml-0.5 inline-flex size-6 items-center justify-center rounded-full transition-colors duration-150"
    >
      <X className="size-3" aria-hidden="true" />
    </button>
  );
}
