/**
 * Shared API types and interfaces for Vercel serverless functions
 */

import { z } from "zod";
import type {
  User as _User,
  Project as _Project,
  Booking as _Booking,
  Expense as _Expense,
  Property as _Property,
  PaginatedResponse as _PaginatedResponse,
  ApiErrorResponse,
} from "@/types/common";

// Re-export types to avoid unused variable warnings
export type User = _User;
export type Project = _Project;
export type Booking = _Booking;
export type Expense = _Expense;
export type Property = _Property;
export type PaginatedResponse<T = unknown> = _PaginatedResponse<T>;

// Request/Response types
export interface ApiRequest<T = unknown> {
  body?: T;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  projectId?: string;
  userId?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

// JWT Token payload
export interface TokenPayload {
  userId: string;
  email: string;
  projectId?: string;
  role: string;
  permissions?: string[];
  iat?: number;
  exp?: number;
}

// Multi-tenant context
export interface TenantContext {
  projectId: string;
  userId: string;
  userRole: string;
  permissions: string[];
}

// Validation schemas for common operations
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const dateRangeSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export const projectIdSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
});

// Philippine-specific validations
export const philippinePhoneSchema = z
  .string()
  .regex(/^(\+63|0)?9\d{9}$/, "Invalid Philippine phone number");

export const pesoAmountSchema = z
  .number()
  .min(0, "Amount cannot be negative")
  .max(999999999.99, "Amount exceeds maximum")
  .transform((val) => Math.round(val * 100) / 100); // Round to 2 decimal places

// File upload validation
export const fileUploadSchema = z.object({
  filename: z.string(),
  mimetype: z.string(),
  size: z.number().max(10 * 1024 * 1024, "File size must be less than 10MB"),
});

// Rate limiting
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  identifier: string;
}

// API Error classes
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ValidationError extends ApiError {
  constructor(
    message: string,
    public errors?: unknown
  ) {
    super(400, message, "VALIDATION_ERROR");
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = "Authentication required") {
    super(401, message, "AUTHENTICATION_ERROR");
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = "Insufficient permissions") {
    super(403, message, "AUTHORIZATION_ERROR");
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, `${resource} not found`, "NOT_FOUND");
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message, "CONFLICT_ERROR");
  }
}

export class RateLimitError extends ApiError {
  constructor(retryAfter?: number) {
    super(429, "Too many requests", "RATE_LIMIT_ERROR");
    if (retryAfter) {
      // Use retryAfter for Retry-After header if needed
    }
  }
}

export class ServerError extends ApiError {
  constructor(message: string = "Internal server error") {
    super(500, message, "SERVER_ERROR");
  }
}

// Response helpers
export const successResponse = <T>(data: T, message?: string): ApiResponse<T> => ({
  success: true,
  data,
  message,
  timestamp: new Date().toISOString(),
});

export const errorResponse = (error: ApiError | Error): ApiErrorResponse => ({
  error: error.name,
  message: error.message,
  statusCode: error instanceof ApiError ? error.statusCode : 500,
  timestamp: new Date().toISOString(),
});

// Type guards
export const isApiError = (error: unknown): error is ApiError => {
  return error instanceof ApiError;
};

export const hasProjectAccess = (context: TenantContext, requiredPermission?: string): boolean => {
  if (!context.projectId) return false;
  if (!requiredPermission) return true;
  return context.permissions.includes(requiredPermission);
};

// Currency formatting for Philippine Peso
export const formatPeso = (amount: number): string => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Date formatting for Philippine timezone
export const formatPhilippineDate = (date: Date | string): string => {
  const d = new Date(date);
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};
