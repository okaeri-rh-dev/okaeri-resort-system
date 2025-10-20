// src/stores/useAuditStore.ts

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type { AuditLog, AuditLogFilters } from "@/types/audit.types";

// ============================================
// TYPES & INTERFACES
// ============================================

/**
 * Table state for TanStack Table integration
 */
interface TableState {
  pagination?: {
    pageIndex: number;
    pageSize: number;
  };
  sorting?: Array<{
    id: string;
    desc: boolean;
  }>;
  columnVisibility?: Record<string, boolean>;
}

// ============================================
// STORE INTERFACE
// ============================================

interface AuditStore {
  // Selected audit log (for detail view)
  selectedLog: AuditLog | null;
  setSelectedLog: (log: AuditLog | null) => void;

  // Filter state
  filters: AuditLogFilters;
  setFilters: (filters: AuditLogFilters) => void;
  resetFilters: () => void;

  // UI state
  showFilters: boolean;
  toggleFilters: () => void;

  // Table state (for TanStack Table)
  tableState: Partial<TableState>;
  setTableState: (state: Partial<TableState>) => void;

  // Quick filters (preset filter shortcuts)
  applyQuickFilter: (preset: QuickFilterPreset) => void;
}

/**
 * Quick filter presets for common queries
 */
export enum QuickFilterPreset {
  RECENT = "recent",
  FAILED_LOGINS = "failed_logins",
  DELETIONS = "deletions",
  CRITICAL = "critical",
  BOOKINGS_TODAY = "bookings_today",
  PAYMENTS_TODAY = "payments_today",
}

// ============================================
// ZUSTAND STORE
// ============================================

export const useAuditStore = create<AuditStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        selectedLog: null,
        filters: {},
        showFilters: true,
        tableState: {
          pagination: {
            pageIndex: 0,
            pageSize: 50,
          },
        },

        // Actions
        setSelectedLog: (log) => set({ selectedLog: log }),

        setFilters: (filters) =>
          set({
            filters,
            tableState: {
              ...get().tableState,
              pagination: { pageIndex: 0, pageSize: 50 }, // Reset to first page
            },
          }),

        resetFilters: () =>
          set({
            filters: {},
            tableState: {
              pagination: { pageIndex: 0, pageSize: 50 },
            },
          }),

        toggleFilters: () => set({ showFilters: !get().showFilters }),

        setTableState: (state) =>
          set({
            tableState: {
              ...get().tableState,
              ...state,
            },
          }),

        /**
         * Apply preset quick filters
         */
        applyQuickFilter: (preset: QuickFilterPreset) => {
          const now = new Date();
          const todayStart = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          ).toISOString();

          const presetFilters: Record<QuickFilterPreset, AuditLogFilters> = {
            [QuickFilterPreset.RECENT]: {
              limit: 50,
              offset: 0,
            },
            [QuickFilterPreset.FAILED_LOGINS]: {
              action: "INSERT" as const, // Login attempts are inserts
              startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
              limit: 50,
            },
            [QuickFilterPreset.DELETIONS]: {
              action: "DELETE" as const,
              limit: 50,
            },
            [QuickFilterPreset.CRITICAL]: {
              // This would need severity filtering
              limit: 50,
            },
            [QuickFilterPreset.BOOKINGS_TODAY]: {
              tableName: "bookings",
              startDate: todayStart,
              limit: 100,
            },
            [QuickFilterPreset.PAYMENTS_TODAY]: {
              tableName: "payments",
              startDate: todayStart,
              limit: 100,
            },
          };

          set({
            filters: presetFilters[preset],
            tableState: {
              pagination: { pageIndex: 0, pageSize: 50 },
            },
          });
        },
      }),
      {
        name: "audit-store", // localStorage key
        partialize: (state) => ({
          // Only persist filters and UI preferences
          filters: state.filters,
          showFilters: state.showFilters,
          tableState: state.tableState,
          // Don't persist selectedLog (not needed across sessions)
        }),
      }
    )
  )
);

// ============================================
// SELECTOR HOOKS (for performance)
// ============================================

/**
 * Get current filters (optimized selector)
 */
export const useAuditFilters = () => useAuditStore((state) => state.filters);

/**
 * Get selected log (optimized selector)
 */
export const useSelectedAuditLog = () => useAuditStore((state) => state.selectedLog);

/**
 * Get table state (optimized selector)
 */
export const useAuditTableState = () => useAuditStore((state) => state.tableState);
