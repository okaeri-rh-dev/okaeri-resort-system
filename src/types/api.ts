/**
 * API Request/Response Types
 *
 * Comprehensive type definitions for API communication in the Okaeri Resort Management System.
 * These types ensure type safety across all API interactions, including success/error responses,
 * authentication tokens, session management, and paginated responses.
 */

import { z } from "zod";
import type {
  User,
  Project,
  Booking,
  Payment,
  Expense,
  ExpenseCategory,
  Income,
  UserProjectPermission,
  AuditLog,
  PaginationMeta,
  EntityId,
  Timestamp,
} from "./database";

import {
  PaginatedResponseSchema,
  UserSchema,
  ProjectSchema,
  BookingSchema,
  PaymentSchema,
  ExpenseSchema,
  ExpenseCategorySchema,
  IncomeSchema,
  UserProjectPermissionSchema,
  AuditLogSchema,
  UuidSchema,
  TimestampSchema,
  EmailSchema,
} from "./schemas";

// ====================================
// BASE API RESPONSE TYPES
// ====================================

/**
 * Standard API success response wrapper
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  timestamp: Timestamp;
  requestId?: string;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    field?: string; // For validation errors
    stack?: string; // Only in development
  };
  timestamp: Timestamp;
  requestId?: string;
  path?: string;
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Paginated API response
 */
export interface ApiPaginatedResponse<T = unknown> extends ApiSuccessResponse<T[]> {
  data: T[];
  meta: PaginationMeta;
}

// ====================================
// AUTHENTICATION TYPES
// ====================================

/**
 * JWT token payload structure
 */
export interface JwtPayload {
  sub: EntityId; // User ID
  email: string;
  role?: string;
  iat: number; // Issued at
  exp: number; // Expires at
  aud: string; // Audience
  iss: string; // Issuer
  jti?: string; // JWT ID for revocation
}

/**
 * Auth tokens response
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Seconds until expiration
  tokenType: "Bearer";
}

/**
 * Login response
 */
export interface LoginResponse extends AuthTokens {
  user: Omit<User, "passwordHash" | "emailVerificationToken" | "passwordResetToken">;
  permissions?: {
    global: string[];
    projects: Record<EntityId, string[]>;
  };
}

/**
 * Refresh token response
 */
export interface RefreshTokenResponse extends AuthTokens {
  user?: Partial<User>;
}

/**
 * Session information
 */
export interface SessionInfo {
  id: string;
  userId: EntityId;
  userAgent?: string;
  ipAddress?: string;
  location?: {
    country?: string;
    city?: string;
  };
  createdAt: Timestamp;
  lastActivityAt: Timestamp;
  expiresAt: Timestamp;
  isActive: boolean;
}

// ====================================
// REQUEST CONTEXT TYPES
// ====================================

/**
 * Request metadata
 */
export interface ApiRequestMeta {
  userAgent?: string;
  ipAddress?: string;
  requestId?: string;
  traceId?: string;
  userId?: EntityId;
  projectId?: EntityId;
  timestamp: Timestamp;
}

/**
 * Rate limiting information
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * API request options
 */
export interface ApiRequestOptions {
  timeout?: number;
  retries?: number;
  cache?: boolean;
  cacheTtl?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  meta?: Partial<ApiRequestMeta>;
}

// ====================================
// ENTITY API RESPONSE TYPES
// ====================================

/**
 * User API responses
 */
export type ApiUser = z.infer<typeof UserSchema>;
export type ApiUsersResponse = ApiPaginatedResponse<ApiUser>;
export type ApiUserResponse = ApiSuccessResponse<ApiUser>;
export type ApiUserStatsResponse = ApiSuccessResponse<{
  totalUsers: number;
  activeUsers: number;
  verifiedUsers: number;
  recentSignups: number;
}>;

/**
 * Project API responses
 */
export type ApiProject = z.infer<typeof ProjectSchema>;
export type ApiProjectsResponse = ApiPaginatedResponse<ApiProject>;
export type ApiProjectResponse = ApiSuccessResponse<ApiProject>;
export type ApiProjectStatsResponse = ApiSuccessResponse<{
  totalRevenue: string; // PHP amount as string
  totalExpenses: string;
  netIncome: string;
  totalBookings: number;
  occupancyRate: number;
  averageBookingValue: string;
  monthlyGrowth: {
    revenue: number; // Percentage
    bookings: number;
    expenses: number;
  };
}>;

/**
 * Booking API responses
 */
export type ApiBooking = z.infer<typeof BookingSchema>;
export type ApiBookingsResponse = ApiPaginatedResponse<ApiBooking>;
export type ApiBookingResponse = ApiSuccessResponse<ApiBooking>;
export type ApiBookingStatsResponse = ApiSuccessResponse<{
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  totalRevenue: string;
  averageBookingValue: string;
  occupancyRate: number;
  upcomingCheckIns: number;
  upcomingCheckOuts: number;
}>;

/**
 * Payment API responses
 */
export type ApiPayment = z.infer<typeof PaymentSchema>;
export type ApiPaymentsResponse = ApiPaginatedResponse<ApiPayment>;
export type ApiPaymentResponse = ApiSuccessResponse<ApiPayment>;
export type ApiPaymentStatsResponse = ApiSuccessResponse<{
  totalPayments: string;
  completedPayments: string;
  pendingPayments: string;
  failedPayments: number;
  refundedAmount: string;
  paymentMethodBreakdown: Record<
    string,
    {
      count: number;
      amount: string;
    }
  >;
}>;

/**
 * Expense API responses
 */
export type ApiExpenseCategory = z.infer<typeof ExpenseCategorySchema>;
export type ApiExpense = z.infer<typeof ExpenseSchema>;
export type ApiExpenseCategoriesResponse = ApiPaginatedResponse<ApiExpenseCategory>;
export type ApiExpenseCategoryResponse = ApiSuccessResponse<ApiExpenseCategory>;
export type ApiExpensesResponse = ApiPaginatedResponse<ApiExpense>;
export type ApiExpenseResponse = ApiSuccessResponse<ApiExpense>;
export type ApiExpenseStatsResponse = ApiSuccessResponse<{
  totalExpenses: string;
  approvedExpenses: string;
  pendingExpenses: string;
  rejectedExpenses: number;
  categoryBreakdown: Record<
    string,
    {
      count: number;
      amount: string;
    }
  >;
  monthlyTrend: Array<{
    month: string;
    amount: string;
  }>;
}>;

/**
 * Income API responses
 */
export type ApiIncome = z.infer<typeof IncomeSchema>;
export type ApiIncomeResponse = ApiPaginatedResponse<ApiIncome>;
export type ApiIncomeItemResponse = ApiSuccessResponse<ApiIncome>;
export type ApiIncomeStatsResponse = ApiSuccessResponse<{
  totalIncome: string;
  bookingIncome: string;
  otherIncome: string;
  sourceBreakdown: Record<
    string,
    {
      count: number;
      amount: string;
    }
  >;
  monthlyTrend: Array<{
    month: string;
    amount: string;
  }>;
}>;

/**
 * User Project Permission API responses
 */
export type ApiUserProjectPermission = z.infer<typeof UserProjectPermissionSchema>;
export type ApiUserProjectPermissionsResponse = ApiPaginatedResponse<ApiUserProjectPermission>;
export type ApiUserProjectPermissionResponse = ApiSuccessResponse<ApiUserProjectPermission>;

/**
 * Audit Log API responses
 */
export type ApiAuditLog = z.infer<typeof AuditLogSchema>;
export type ApiAuditLogsResponse = ApiPaginatedResponse<ApiAuditLog>;
export type ApiAuditLogResponse = ApiSuccessResponse<ApiAuditLog>;

// ====================================
// DASHBOARD & ANALYTICS TYPES
// ====================================

/**
 * Dashboard overview response
 */
export interface DashboardOverview {
  revenue: {
    current: string;
    previous: string;
    growth: number; // Percentage
    trend: Array<{ date: string; value: string }>;
  };
  bookings: {
    current: number;
    previous: number;
    growth: number;
    trend: Array<{ date: string; value: number }>;
  };
  expenses: {
    current: string;
    previous: string;
    growth: number;
    trend: Array<{ date: string; value: string }>;
  };
  occupancy: {
    rate: number;
    available: number;
    occupied: number;
    blocked: number;
  };
  upcomingEvents: {
    checkIns: number;
    checkOuts: number;
    expiringBookings: number;
    pendingPayments: number;
  };
}

export type ApiDashboardOverviewResponse = ApiSuccessResponse<DashboardOverview>;

/**
 * Chart data types
 */
export interface ChartDataPoint {
  label: string;
  value: number | string;
  color?: string;
  metadata?: Record<string, unknown>;
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: Array<number | string>;
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    metadata?: Record<string, unknown>;
  }>;
}

export type ApiChartDataResponse = ApiSuccessResponse<ChartData>;

/**
 * Report generation types
 */
export interface ReportRequest {
  type: "revenue" | "bookings" | "expenses" | "occupancy" | "financial";
  period: {
    start: string; // ISO date
    end: string; // ISO date
  };
  filters?: {
    properties?: EntityId[];
    categories?: EntityId[];
    status?: string[];
    paymentMethods?: string[];
  };
  format: "pdf" | "excel" | "csv";
  groupBy?: "day" | "week" | "month" | "category" | "property";
  includeCharts?: boolean;
  locale?: "en" | "fil";
  timezone?: string;
}

export interface ReportResponse {
  id: EntityId;
  status: "generating" | "completed" | "failed";
  downloadUrl?: string;
  expiresAt?: Timestamp;
  metadata: {
    request: ReportRequest;
    generatedAt?: Timestamp;
    fileSize?: number;
    recordCount?: number;
  };
}

export type ApiReportResponse = ApiSuccessResponse<ReportResponse>;

// ====================================
// FILE UPLOAD TYPES
// ====================================

/**
 * File upload request
 */
export interface FileUploadRequest {
  file: File | Blob;
  filename?: string;
  category: "avatar" | "logo" | "receipt" | "document" | "image";
  metadata?: {
    entityType?: string;
    entityId?: EntityId;
    description?: string;
  };
}

/**
 * File upload response
 */
export interface FileUploadResponse {
  id: EntityId;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  category: string;
  metadata?: Record<string, unknown>;
  uploadedAt: Timestamp;
}

export type ApiFileUploadResponse = ApiSuccessResponse<FileUploadResponse>;

/**
 * Multiple file upload response
 */
export interface MultipleFileUploadResponse {
  files: FileUploadResponse[];
  failed: Array<{
    filename: string;
    error: string;
  }>;
}

export type ApiMultipleFileUploadResponse = ApiSuccessResponse<MultipleFileUploadResponse>;

// ====================================
// SEARCH & FILTER TYPES
// ====================================

/**
 * Search request
 */
export interface SearchRequest {
  query: string;
  entities?: ("users" | "projects" | "bookings" | "expenses" | "income")[];
  filters?: Record<string, unknown>;
  limit?: number;
  includeHighlights?: boolean;
}

/**
 * Search result item
 */
export interface SearchResultItem {
  id: EntityId;
  type: "user" | "project" | "booking" | "expense" | "income";
  title: string;
  subtitle?: string;
  description?: string;
  url?: string;
  highlights?: Record<string, string[]>;
  metadata?: Record<string, unknown>;
  relevanceScore?: number;
}

/**
 * Search response
 */
export interface SearchResponse {
  results: SearchResultItem[];
  total: number;
  took: number; // Search time in milliseconds
  query: string;
  suggestions?: string[];
}

export type ApiSearchResponse = ApiSuccessResponse<SearchResponse>;

// ====================================
// WEBHOOK & EVENT TYPES
// ====================================

/**
 * Webhook event payload
 */
export interface WebhookEvent {
  id: EntityId;
  type: string;
  action: "created" | "updated" | "deleted";
  entity: {
    type: string;
    id: EntityId;
    data: Record<string, unknown>;
  };
  project?: {
    id: EntityId;
    slug: string;
  };
  user?: {
    id: EntityId;
    email: string;
  };
  timestamp: Timestamp;
  version: string;
}

/**
 * Notification payload
 */
export interface NotificationPayload {
  id: EntityId;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    label: string;
    action: string;
    style: "primary" | "secondary" | "danger";
  }>;
  expiresAt?: Timestamp;
  readAt?: Timestamp;
  createdAt: Timestamp;
}

export type ApiNotificationResponse = ApiSuccessResponse<NotificationPayload[]>;

// ====================================
// BATCH OPERATION TYPES
// ====================================

/**
 * Batch operation request
 */
export interface BatchOperationRequest<T = unknown> {
  operation: "create" | "update" | "delete";
  items: T[];
  options?: {
    continueOnError?: boolean;
    validateOnly?: boolean;
  };
}

/**
 * Batch operation result
 */
export interface BatchOperationResult<T = unknown> {
  successful: Array<{
    index: number;
    item: T;
    id?: EntityId;
  }>;
  failed: Array<{
    index: number;
    error: string;
    code?: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    duration: number; // Milliseconds
  };
}

export type ApiBatchOperationResponse<T = unknown> = ApiSuccessResponse<BatchOperationResult<T>>;

// ====================================
// VALIDATION SCHEMAS
// ====================================

/**
 * API response validation schemas
 */
export const ApiSuccessResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    message: z.string().optional(),
    timestamp: TimestampSchema,
    requestId: z.string().optional(),
  });

export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    field: z.string().optional(),
    stack: z.string().optional(),
  }),
  timestamp: TimestampSchema,
  requestId: z.string().optional(),
  path: z.string().optional(),
});

export const ApiPaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  ApiSuccessResponseSchema(z.array(itemSchema)).extend({
    meta: z.object({
      total: z.number().int().min(0),
      page: z.number().int().min(1),
      limit: z.number().int().min(1),
      totalPages: z.number().int().min(0),
      hasNext: z.boolean(),
      hasPrev: z.boolean(),
    }),
  });

export const AuthTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
  tokenType: z.literal("Bearer"),
});

export const LoginResponseSchema = AuthTokensSchema.extend({
  user: UserSchema.omit({
    passwordHash: true,
    emailVerificationToken: true,
    passwordResetToken: true,
  }),
  permissions: z
    .object({
      global: z.array(z.string()),
      projects: z.record(UuidSchema, z.array(z.string())),
    })
    .optional(),
});

export const SessionInfoSchema = z.object({
  id: z.string(),
  userId: UuidSchema,
  userAgent: z.string().optional(),
  ipAddress: z.string().ip().optional(),
  location: z
    .object({
      country: z.string().optional(),
      city: z.string().optional(),
    })
    .optional(),
  createdAt: TimestampSchema,
  lastActivityAt: TimestampSchema,
  expiresAt: TimestampSchema,
  isActive: z.boolean(),
});

export const FileUploadResponseSchema = z.object({
  id: UuidSchema,
  url: z.string().url(),
  filename: z.string(),
  size: z.number().int().positive(),
  mimeType: z.string(),
  category: z.string(),
  metadata: z.record(z.unknown()).optional(),
  uploadedAt: TimestampSchema,
});

// ====================================
// TYPE GUARDS
// ====================================

/**
 * Type guard for API success response
 */
export function isApiSuccessResponse<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard for API error response
 */
export function isApiErrorResponse(response: ApiResponse): response is ApiErrorResponse {
  return response.success === false;
}

/**
 * Type guard for paginated response
 */
export function isApiPaginatedResponse<T>(
  response: ApiResponse<T[]>
): response is ApiPaginatedResponse<T> {
  return isApiSuccessResponse(response) && "meta" in response;
}

/**
 * Type guard for JWT payload
 */
export function isValidJwtPayload(payload: unknown): payload is JwtPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.sub === "string" &&
    typeof p.email === "string" &&
    typeof p.iat === "number" &&
    typeof p.exp === "number" &&
    typeof p.aud === "string" &&
    typeof p.iss === "string"
  );
}

// ====================================
// UTILITY FUNCTIONS
// ====================================

/**
 * Create a success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  requestId?: string
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    requestId,
  };
}

/**
 * Create an error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  field?: string,
  requestId?: string,
  path?: string
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      field,
    },
    timestamp: new Date().toISOString(),
    requestId,
    path,
  };
}

/**
 * Create a paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  meta: PaginationMeta,
  message?: string,
  requestId?: string
): ApiPaginatedResponse<T> {
  return {
    success: true,
    data,
    meta,
    message,
    timestamp: new Date().toISOString(),
    requestId,
  };
}

/**
 * Extract data from API response
 */
export function extractApiData<T>(response: ApiResponse<T>): T {
  if (!isApiSuccessResponse(response)) {
    throw new Error(`API Error: ${response.error.message}`);
  }
  return response.data;
}

/**
 * Handle API response with error throwing
 */
export function handleApiResponse<T>(response: ApiResponse<T>): T {
  return extractApiData(response);
}

// ====================================
// ERROR CLASSES
// ====================================

/**
 * API error class for better error handling
 */
export class ApiError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly field?: string;
  public readonly statusCode?: number;
  public readonly requestId?: string;
  public readonly timestamp: string;

  constructor(response: ApiErrorResponse, statusCode?: number) {
    super(response.error.message);
    this.name = "ApiError";
    this.code = response.error.code;
    this.details = response.error.details;
    this.field = response.error.field;
    this.statusCode = statusCode;
    this.requestId = response.requestId;
    this.timestamp = response.timestamp;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /**
   * Check if error is a validation error
   */
  public isValidationError(): boolean {
    return this.code.startsWith("VALIDATION_");
  }

  /**
   * Check if error is an authentication error
   */
  public isAuthError(): boolean {
    return this.code.startsWith("AUTH_") || this.statusCode === 401;
  }

  /**
   * Check if error is an authorization error
   */
  public isAuthorizationError(): boolean {
    return this.code.startsWith("PERMISSION_") || this.statusCode === 403;
  }

  /**
   * Check if error is a not found error
   */
  public isNotFoundError(): boolean {
    return this.code === "NOT_FOUND" || this.statusCode === 404;
  }

  /**
   * Check if error is a rate limit error
   */
  public isRateLimitError(): boolean {
    return this.code === "RATE_LIMIT_EXCEEDED" || this.statusCode === 429;
  }

  /**
   * Check if error is a server error
   */
  public isServerError(): boolean {
    return (this.statusCode && this.statusCode >= 500) || this.code.startsWith("INTERNAL_");
  }

  /**
   * Convert to plain object for serialization
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      field: this.field,
      statusCode: this.statusCode,
      requestId: this.requestId,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

// ====================================
// CONSTANTS
// ====================================

/**
 * Common API error codes
 */
export const API_ERROR_CODES = {
  // Authentication errors
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",

  // Authorization errors
  PERMISSION_DENIED: "PERMISSION_DENIED",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  PROJECT_ACCESS_DENIED: "PROJECT_ACCESS_DENIED",

  // Validation errors
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_FORMAT: "INVALID_FORMAT",
  VALUE_OUT_OF_RANGE: "VALUE_OUT_OF_RANGE",

  // Business logic errors
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  RESOURCE_CONFLICT: "RESOURCE_CONFLICT",
  BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION",
  OPERATION_NOT_ALLOWED: "OPERATION_NOT_ALLOWED",

  // System errors
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  DATABASE_ERROR: "DATABASE_ERROR",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  TIMEOUT: "TIMEOUT",

  // File upload errors
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  UPLOAD_FAILED: "UPLOAD_FAILED",
  STORAGE_QUOTA_EXCEEDED: "STORAGE_QUOTA_EXCEEDED",
} as const;

/**
 * HTTP status codes mapping
 */
export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;
