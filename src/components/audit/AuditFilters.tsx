// src/components/audit/AuditFilters.tsx

import { useState } from "react";
import { CalendarDays, Download, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSearch, FilterPopover } from "@/components/tables/utils";
import { useAuditStore, QuickFilterPreset } from "@/stores/useAuditStore";
import { useExportAuditLogs } from "@/lib/audit-hooks";
import { ALL_AUDIT_TABLES, TABLE_DISPLAY_NAMES, ACTION_DISPLAY_NAMES } from "@/lib/audit-constants";
import type { AuditAction, AuditLogFilters } from "@/types/database.types";
import { EVENT_TYPE_DISPLAY_NAMES, AuditEventType } from "@/types/database.types";
import { format } from "date-fns";

// ============================================
// TYPES
// ============================================

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

// ============================================
// MAIN FILTERS COMPONENT
// ============================================

export function AuditFilters() {
  const filters = useAuditStore((state) => state.filters);
  const setFilters = useAuditStore((state) => state.setFilters);
  const resetFilters = useAuditStore((state) => state.resetFilters);
  const applyQuickFilter = useAuditStore((state) => state.applyQuickFilter);

  const exportLogs = useExportAuditLogs();

  // Date range state management (Apply/Clear pattern)
  const [dateRange, setDateRange] = useState<DateRange>({
    from: filters.startDate ? new Date(filters.startDate) : undefined,
    to: filters.endDate ? new Date(filters.endDate) : undefined,
  });
  const [tempDateRange, setTempDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [dateFilterOpen, setDateFilterOpen] = useState(false);

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

      {/* Filter Row */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 flex-wrap">
          {/* User Email Search */}
          <TableSearch
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              updateFilter("userEmail", value || undefined);
            }}
            placeholder="Search by email..."
            className="w-64"
          />

          {/* Table Filter */}
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

          {/* Source Filter */}
          <FilterPopover
            isActive={!!filters.source}
            content={
              <div className="space-y-2">
                <div className="text-sm font-medium">Source</div>
                <Select
                  value={filters.source || "all"}
                  onValueChange={(value: string) => {
                    updateFilter("source", value === "all" ? undefined : (value as "db" | "app"));
                    // Clear event type when source changes away from 'app'
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

          {/* Action Filter */}
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

          {/* Event Type Filter - Only shown when source='app' */}
          {filters.source === "app" && (
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
                      <SelectItem value={AuditEventType.CANCEL_BOOKING}>
                        Booking Cancelled
                      </SelectItem>
                      <SelectItem value={AuditEventType.BOOKING_CHECKED_IN}>
                        Guest Checked In
                      </SelectItem>
                      <SelectItem value={AuditEventType.BOOKING_CHECKED_OUT}>
                        Guest Checked Out
                      </SelectItem>
                      <SelectItem value={AuditEventType.BOOKING_STATUS_OVERRIDE}>
                        Booking Status Override
                      </SelectItem>
                      <SelectItem value={AuditEventType.REFUND_PAYMENT}>
                        Payment Refunded
                      </SelectItem>
                      <SelectItem value={AuditEventType.PAYMENT_FAILED}>Payment Failed</SelectItem>
                      <SelectItem value={AuditEventType.PAYMENT_VERIFIED}>
                        Payment Verified
                      </SelectItem>
                      <SelectItem value={AuditEventType.EXPENSE_DELETED}>
                        Expense Deleted
                      </SelectItem>
                      <SelectItem value={AuditEventType.EXPENSE_CATEGORY_CHANGED}>
                        Expense Category Changed
                      </SelectItem>
                      <SelectItem value={AuditEventType.SYSTEM_MIGRATION}>
                        System Migration
                      </SelectItem>
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
          )}

          {/* Date Range Filter */}
          <FilterPopover
            isActive={!!(filters.startDate || filters.endDate)}
            open={dateFilterOpen}
            onOpenChange={(open) => {
              setDateFilterOpen(open);
              if (open) {
                setTempDateRange(dateRange);
              }
            }}
            showActions={true}
            onApply={() => {
              setDateRange(tempDateRange);
              // If only "from" date is selected, use it for both from and to
              const fromDate = tempDateRange?.from;
              const toDate = tempDateRange?.to || fromDate;
              setFilters({
                ...filters,
                startDate: fromDate?.toISOString(),
                endDate: toDate?.toISOString(),
                offset: 0, // Reset to first page
              });
              setDateFilterOpen(false);
            }}
            onClear={() => {
              setTempDateRange({ from: undefined, to: undefined });
            }}
            content={
              <div className="space-y-3">
                <div className="text-sm font-medium">Date Range</div>
                <Calendar
                  mode="range"
                  selected={tempDateRange}
                  onSelect={(range) => {
                    if (range) {
                      setTempDateRange({ from: range.from, to: range.to });
                    } else {
                      setTempDateRange({ from: undefined, to: undefined });
                    }
                  }}
                  className="rounded-md border"
                  required={false}
                />
              </div>
            }
          >
            <CalendarDays className="mr-1 h-3 w-3" />
            Dates
          </FilterPopover>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetFilters();
                setDateRange({ from: undefined, to: undefined });
                setSearchQuery("");
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Export Button */}
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exportLogs.isPending}>
          <Download className="mr-1 h-3 w-3" />
          {exportLogs.isPending ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-neutral-700">Active Filters:</span>
          {filters.tableName && (
            <Badge variant="secondary" className="gap-1">
              Table:{" "}
              {TABLE_DISPLAY_NAMES[filters.tableName as keyof typeof TABLE_DISPLAY_NAMES] ||
                filters.tableName}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => updateFilter("tableName", undefined)}
              />
            </Badge>
          )}
          {filters.source && (
            <Badge variant="secondary" className="gap-1">
              Source: {filters.source === "db" ? "Database Triggers" : "Application Events"}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => updateFilter("source", undefined)}
              />
            </Badge>
          )}
          {filters.eventType && (
            <Badge variant="secondary" className="gap-1">
              Event: {EVENT_TYPE_DISPLAY_NAMES[filters.eventType] || filters.eventType}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => updateFilter("eventType", undefined)}
              />
            </Badge>
          )}
          {filters.action && (
            <Badge variant="secondary" className="gap-1">
              Action: {ACTION_DISPLAY_NAMES[filters.action as AuditAction]}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => updateFilter("action", undefined)}
              />
            </Badge>
          )}
          {filters.userEmail && (
            <Badge variant="secondary" className="gap-1">
              User: {filters.userEmail}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => {
                  updateFilter("userEmail", undefined);
                  setSearchQuery("");
                }}
              />
            </Badge>
          )}
          {filters.startDate && (
            <Badge variant="secondary" className="gap-1">
              From: {format(new Date(filters.startDate), "PP")}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => {
                  setDateRange({ ...dateRange, from: undefined });
                  setFilters({
                    ...filters,
                    startDate: undefined,
                    offset: 0,
                  });
                }}
              />
            </Badge>
          )}
          {filters.endDate && (
            <Badge variant="secondary" className="gap-1">
              To: {format(new Date(filters.endDate), "PP")}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => {
                  setDateRange({ ...dateRange, to: undefined });
                  setFilters({
                    ...filters,
                    endDate: undefined,
                    offset: 0,
                  });
                }}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
