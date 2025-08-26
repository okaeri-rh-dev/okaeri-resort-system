/**
 * Central type exports for the application
 * This file ensures consistent type imports across the codebase
 */

// Re-export all common types
export * from "./common";

// Re-export route parameter types and validators
export * from "./route-params";

// Re-export API schema types
export * from "./api-schemas";

// Re-export global declarations
export * from "./global.d";

/**
 * Commonly used type combinations for route handling
 */
export type {
  // Route parameter types
  DashboardSearchParams,
  BookingsSearchParams,
  PropertiesSearchParams,
  ExpensesSearchParams,
  ReportsSearchParams,
  TeamSearchParams,
  SettingsSearchParams,
  ProjectSettingsSearchParams,

  // Route param types
  BookingParams,
  PropertyParams,
  ExpenseParams,

  // Search param types for individual entities
  BookingSearchParams,
  PropertySearchParams,
  ExpenseSearchParams,

  // Auth route types
  LoginSearchParams,
  RegisterSearchParams,
  ErrorSearchParams,
  GlobalSearchParams,
} from "./route-params";

/**
 * API response types for type-safe API calls
 */
export type {
  ApiUser,
  ApiProject,
  ApiProperty,
  ApiBooking,
  ApiExpense,
  ApiDashboardStats,
  ApiChartData,
  ApiGuest,
  ApiPaginatedResponse,
  ApiErrorResponse,
  ApiLoginResponse,
} from "./api-schemas";

/**
 * Common entity types
 */
export type {
  User,
  Project,
  Property,
  Booking,
  Expense,
  Guest,
  Payment,

  // Enums
  UserRole,
  ProjectRole,
  ProjectType,
  ProjectStatus,
  PropertyType,
  PropertyStatus,
  BookingStatus,
  BookingSource,
  PaymentStatus,
  PaymentMethod,
  ExpenseStatus,
  ExpenseCategory,
  GuestDocumentType,

  // Utility types
  PaginatedResponse,
  PaginationParams,
  FilterParams,
  ApiErrorResponse as CommonApiErrorResponse,
  SuccessResponse,
  SelectOption,
  TableColumn,
  Notification,
  FileUpload,
  DateRange,
  DashboardStats,
  ChartData,
  ActivityLog,
} from "./common";

/**
 * Type guard and utility re-exports
 */
export {
  isUUID,
  isEmail,
  isURL,
  isISODateTime,
  isUser,
  isProject,
  isProperty,
  isBooking,
  isExpense,
  isGuest,
  isPaginatedResponse,
  assertType,
  safeCast,
  isArrayOf,
  isPartialType,
  RouteValidationError,
  validateRouteParam,
  createEnumValidator,
  createEnumArrayValidator,
  validateWithSchema,
  safeValidateWithSchema,
  devAssert,
  isSortOrder,
  isDateRange,
  isPositiveInteger,
  isNonNegativeNumber,
  safeGet,
  deepEqual,
} from "../lib/type-utils";

/**
 * API client type exports
 */
export { isApiError, isValidApiResponse } from "../lib/api-client";

export type { ApiConfig, ApiResponse, ApiError, RequestOptions } from "../lib/api-client";
