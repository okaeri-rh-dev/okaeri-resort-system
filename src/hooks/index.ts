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

// Calendar hooks
export { useCalendarBookings } from "./useCalendarBookings";
