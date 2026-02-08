/**
 * Okaeri Resort System - Custom Hooks Index
 *
 * Central export for all custom React hooks used throughout the application.
 */

// Authentication Hooks
export { useAuthToken } from "./useAuthToken";

// Role & Permissions
export { useUserRole } from "./useUserRole";

// Performance & Responsive Design
export {
  useResponsiveView,
  useResponsiveDataAttribute,
  useResponsivePerformanceMonitor,
} from "./useResponsiveView";

// Business Logic Hooks
// Availability hooks
export {
  useUnitAvailability,
  // useAvailabilityCalendar, // ❌ DISABLED: Requires get_unit_availability_calendar() RPC
  useAvailableUnits,
  useAvailableUnitsByType,
  useBatchUnitAvailability,
  useUnitBlackouts,
  useCreateBlackout,
  // useRefreshAvailabilityCache, // ❌ DISABLED: Requires refresh_availability_cache() RPC
  // useCacheMetrics, // ❌ DISABLED: Requires availability_cache table
  useDateValidation,
  useAvailabilityMessage,
  // useAutoRefreshCache, // ❌ DISABLED: Depends on disabled cache hooks
  useOptimisticAvailability,
  useAvailabilityPerformance,
} from "./useAvailability";

// Search hooks
export {
  useUnifiedSearch,
  useBookingSearch,
  useGuestSearch,
  useUnitAvailabilitySearch,
  useSearchSuggestions,
  useSearchAnalytics,
  useSearchExport,
  useSavedSearches,
} from "./useSearch";

// Calendar hooks
export { useCalendarBookings } from "./useCalendarBookings";

// Workflow Hooks (Phase 3-4)
// export { useWorkflowSearch } from './useWorkflowSearch.phase3-4';
