/**
 * Okaeri Resort System - Custom Hooks Index
 *
 * Central export for all custom React hooks used throughout the application.
 */

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
  useAvailabilityCalendar,
  useAvailableUnits,
  useAvailableUnitsByType,
  useBatchUnitAvailability,
  useUnitBlackouts,
  useCreateBlackout,
  useRefreshAvailabilityCache,
  useCacheMetrics,
  useDateValidation,
  useAvailabilityMessage,
  useAutoRefreshCache,
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
