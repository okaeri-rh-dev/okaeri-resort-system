/**
 * Central type exports for the application
 * This file ensures consistent type imports across the codebase
 */

// ====================================
// DATABASE TYPES
// ====================================

// Re-export all database entity types and helpers
export * from "./database";

// ====================================
// VALIDATION SCHEMAS
// ====================================

// Re-export all Zod validation schemas and input types
export * from "./schemas";

// ====================================
// API TYPES
// ====================================

// Re-export all API request/response types
export * from "./api";

// ====================================
// LEGACY TYPES (maintained for backward compatibility)
// ====================================

// Re-export existing common types
export * from "./common";

// Re-export route parameter types and validators
export * from "./route-params";

// Re-export legacy API schema types
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
 * Legacy API response types (use new API types from api.ts instead)
 * @deprecated Use types from ./api.ts for new development
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
 * Legacy common entity types (use database types instead)
 * @deprecated Use types from ./database.ts for new development
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

// ====================================
// TYPE ALIASES FOR COMMON PATTERNS
// ====================================

/**
 * Commonly used database types with convenient aliases
 */

// Entity identifier alias
export type { EntityId } from "./database";

// Timestamp alias
export type { Timestamp } from "./database";

// Philippine peso amount alias
export type { PhpAmount } from "./database";

// Common CRUD input types
export type {
  CreateUserInput,
  UpdateUserInput,
  CreateProjectInput,
  UpdateProjectInput,
  CreateBookingInput,
  UpdateBookingInput,
  CreatePaymentInput,
  UpdatePaymentInput,
  CreateExpenseInput,
  UpdateExpenseInput,
  CreateIncomeInput,
  UpdateIncomeInput,
} from "./database";

// Common API response types with convenient aliases
export type {
  ApiSuccessResponse,
  ApiErrorResponse as NewApiErrorResponse,
  ApiPaginatedResponse as NewApiPaginatedResponse,
  ApiResponse as NewApiResponse,
} from "./api";

// Authentication types
export type { AuthTokens, LoginResponse as NewLoginResponse, JwtPayload, SessionInfo } from "./api";

// Schema validation input types
export type {
  CreateUserInput as CreateUserSchema,
  UpdateUserInput as UpdateUserSchema,
  CreateProjectInput as CreateProjectSchema,
  UpdateProjectInput as UpdateProjectSchema,
  CreateBookingInput as CreateBookingSchema,
  UpdateBookingInput as UpdateBookingSchema,
  CreatePaymentInput as CreatePaymentSchema,
  UpdatePaymentInput as UpdatePaymentSchema,
  CreateExpenseInput as CreateExpenseSchema,
  UpdateExpenseInput as UpdateExpenseSchema,
} from "./schemas";

// Search and filter types
export type {
  BookingSearchParams as BookingSearchInput,
  PaymentSearchParams as PaymentSearchInput,
  ExpenseSearchParams as ExpenseSearchInput,
  IncomeSearchParams as IncomeSearchInput,
  UserSearchParams as UserSearchInput,
  ProjectSearchParams as ProjectSearchInput,
} from "./schemas";

// ====================================
// RE-EXPORT TYPE GUARDS
// ====================================

export {
  hasAuditFields,
  hasUserTracking,
  isValidEntityId,
  isValidTimestamp,
  isValidPhpAmount,
} from "./database";

export {
  isApiSuccessResponse,
  isApiErrorResponse,
  isApiPaginatedResponse,
  isValidJwtPayload,
} from "./api";

// ====================================
// RE-EXPORT UTILITY FUNCTIONS
// ====================================

export {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  extractApiData,
  handleApiResponse,
} from "./api";

// ====================================
// RE-EXPORT ERROR CLASSES
// ====================================

export { ApiError } from "./api";

// ====================================
// RE-EXPORT CONSTANTS
// ====================================

export {
  DATABASE_LIMITS,
  PHILIPPINE_CONSTANTS,
  API_ERROR_CODES,
  HTTP_STATUS_CODES,
} from "./database";

export { API_ERROR_CODES as NEW_API_ERROR_CODES } from "./api";
