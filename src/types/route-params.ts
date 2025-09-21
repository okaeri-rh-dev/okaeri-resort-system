import { z } from "zod";
import {
  BookingStatus,
  PropertyStatus,
  ExpenseStatus,
  PropertyType,
  ExpenseCategory,
  BookingSource,
  PaymentMethod,
} from "./common";
import { isDevelopment } from "@/lib/env-client";
import { ROUTES } from "@/constants/routes";

/**
 * Route parameter validation schemas and types
 * Used for type-safe search parameter handling in TanStack Router
 */

// Base pagination schema
export const BasePaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Dashboard route search parameters
export const DashboardSearchSchema = z.object({
  dateRange: z.enum(["7d", "30d", "90d", "1y"]).default("30d"),
  error: z.string().optional(),
  success: z.string().optional(),
});

// Bookings route search parameters
export const BookingsSearchSchema = BasePaginationSchema.extend({
  search: z.string().optional(),
  status: z.array(z.nativeEnum(BookingStatus)).optional(),
  propertyId: z.string().uuid().optional(),
  source: z.array(z.nativeEnum(BookingSource)).optional(),
  checkInFrom: z.string().datetime().optional(),
  checkInTo: z.string().datetime().optional(),
  checkOutFrom: z.string().datetime().optional(),
  checkOutTo: z.string().datetime().optional(),
  guestName: z.string().optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  paymentStatus: z.enum(["pending", "partial", "paid", "overdue"]).optional(),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
});

// Individual booking route parameters
export const BookingParamsSchema = z.object({
  bookingId: z.string().uuid(),
});

export const BookingSearchSchema = z.object({
  tab: z.enum(["details", "payments", "history", "notes"]).default("details"),
  edit: z.boolean().default(false),
});

// Properties route search parameters
export const PropertiesSearchSchema = BasePaginationSchema.extend({
  search: z.string().optional(),
  status: z.array(z.nativeEnum(PropertyStatus)).optional(),
  type: z.array(z.nativeEnum(PropertyType)).optional(),
  minCapacity: z.coerce.number().min(1).optional(),
  maxCapacity: z.coerce.number().min(1).optional(),
  hasBookings: z.boolean().optional(),
  city: z.string().optional(),
  amenities: z.array(z.string()).optional(),
});

// Individual property route parameters
export const PropertyParamsSchema = z.object({
  propertyId: z.string().uuid(),
});

export const PropertySearchSchema = z.object({
  tab: z.enum(["overview", "bookings", "calendar", "rates", "maintenance"]).default("overview"),
  edit: z.boolean().default(false),
  dateRange: z.enum(["30d", "90d", "1y"]).default("90d"),
});

// Expenses route search parameters
export const ExpensesSearchSchema = BasePaginationSchema.extend({
  search: z.string().optional(),
  status: z.array(z.nativeEnum(ExpenseStatus)).optional(),
  category: z.array(z.nativeEnum(ExpenseCategory)).optional(),
  propertyId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  vendor: z.string().optional(),
  paymentMethod: z.array(z.nativeEnum(PaymentMethod)).optional(),
  hasReceipt: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  approvedBy: z.string().uuid().optional(),
});

// Individual expense route parameters
export const ExpenseParamsSchema = z.object({
  expenseId: z.string().uuid(),
});

export const ExpenseSearchSchema = z.object({
  tab: z.enum(["details", "receipt", "approval", "history"]).default("details"),
  edit: z.boolean().default(false),
});

// Reports route search parameters
export const ReportsSearchSchema = z.object({
  reportType: z.enum(["revenue", "occupancy", "expenses", "profit", "taxes"]).default("revenue"),
  dateRange: z.enum(["7d", "30d", "90d", "1y", "custom"]).default("30d"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  propertyIds: z.array(z.string().uuid()).optional(),
  granularity: z.enum(["daily", "weekly", "monthly", "yearly"]).default("daily"),
  groupBy: z.enum(["property", "category", "source", "none"]).default("none"),
  currency: z.string().optional(),
  includeProjected: z.boolean().default(false),
  export: z.enum(["csv", "excel", "pdf"]).optional(),
});

// Team route search parameters
export const TeamSearchSchema = BasePaginationSchema.extend({
  search: z.string().optional(),
  role: z.enum(["OWNER", "ADMIN", "MANAGER", "MEMBER", "VIEWER"]).optional(),
  status: z.enum(["active", "inactive", "pending"]).optional(),
  permissions: z.array(z.string()).optional(),
  joinedFrom: z.string().datetime().optional(),
  joinedTo: z.string().datetime().optional(),
});

// Settings route search parameters
export const SettingsSearchSchema = z.object({
  section: z
    .enum(["general", "billing", "integrations", "notifications", "security", "advanced"])
    .default("general"),
  edit: z.boolean().default(false),
});

// Project settings route search parameters
export const ProjectSettingsSearchSchema = z.object({
  section: z
    .enum([
      "general",
      "features",
      "limits",
      "custom-fields",
      "integrations",
      "webhooks",
      "api-keys",
      "danger-zone",
    ])
    .default("general"),
  edit: z.boolean().default(false),
});

// Auth route search parameters
export const LoginSearchSchema = z.object({
  // [PHASE 1 TEMPORARY - Update in Phase 5.2 to properly validate URLs]
  redirect: z.string().optional(), // Allow any string for now, including relative paths
  reason: z
    .enum(["session_expired", "access_denied", "logout", "registration_complete"])
    .optional(),
  email: z.string().email().optional(),
});

export const RegisterSearchSchema = z.object({
  token: z.string().optional(),
  email: z.string().email().optional(),
  plan: z.enum(["trial", "pro", "enterprise"]).default("trial"),
});

// Error route search parameters
export const ErrorSearchSchema = z.object({
  code: z.enum(["400", "401", "403", "404", "429", "500"]).optional(),
  message: z.string().optional(),
  redirect: z.string().url().optional(),
});

// Global search parameters that can be used across routes
export const GlobalSearchSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  lang: z.enum(["en", "es", "fr", "de", "ja", "pt"]).optional(),
  project: z.string().uuid().optional(),
  debug: z.boolean().default(false),
});

// Export inferred types for TypeScript usage
export type DashboardSearchParams = z.infer<typeof DashboardSearchSchema>;
export type BookingsSearchParams = z.infer<typeof BookingsSearchSchema>;
export type BookingParams = z.infer<typeof BookingParamsSchema>;
export type BookingSearchParams = z.infer<typeof BookingSearchSchema>;
export type PropertiesSearchParams = z.infer<typeof PropertiesSearchSchema>;
export type PropertyParams = z.infer<typeof PropertyParamsSchema>;
export type PropertySearchParams = z.infer<typeof PropertySearchSchema>;
export type ExpensesSearchParams = z.infer<typeof ExpensesSearchSchema>;
export type ExpenseParams = z.infer<typeof ExpenseParamsSchema>;
export type ExpenseSearchParams = z.infer<typeof ExpenseSearchSchema>;
export type ReportsSearchParams = z.infer<typeof ReportsSearchSchema>;
export type TeamSearchParams = z.infer<typeof TeamSearchSchema>;
export type SettingsSearchParams = z.infer<typeof SettingsSearchSchema>;
export type ProjectSettingsSearchParams = z.infer<typeof ProjectSettingsSearchSchema>;
export type LoginSearchParams = z.infer<typeof LoginSearchSchema>;
export type RegisterSearchParams = z.infer<typeof RegisterSearchSchema>;
export type ErrorSearchParams = z.infer<typeof ErrorSearchSchema>;
export type GlobalSearchParams = z.infer<typeof GlobalSearchSchema>;

// Validation helper functions
export function validateSearchParams<T extends z.ZodType>(
  schema: T,
  params: Record<string, any>
): z.infer<T> {
  const result = schema.safeParse(params);
  if (result.success) {
    return result.data;
  }

  // Log validation errors in development
  if (isDevelopment()) {
    console.warn("Invalid search parameters:", result.error.errors);
  }

  // Return defaults on validation failure
  return schema.parse({});
}

// Route parameter validation helper
export function validateRouteParams<T extends z.ZodType>(
  schema: T,
  params: Record<string, any>
): z.infer<T> {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new Error(`Invalid route parameters: ${result.error.message}`);
  }
  return result.data;
}

// Common filter builders
export function buildDateRangeFilter(dateRange: string, startDate?: string, endDate?: string) {
  if (dateRange === "custom" && startDate && endDate) {
    return { startDate, endDate };
  }

  const now = new Date();
  const ranges = {
    "7d": new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    "30d": new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    "90d": new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
    "1y": new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
  };

  const start = ranges[dateRange as keyof typeof ranges];
  return start
    ? {
        startDate: start.toISOString(),
        endDate: now.toISOString(),
      }
    : {};
}

// URL parameter serialization helpers
export function serializeArrayParam(values: string[] | undefined): string | undefined {
  return values && values.length > 0 ? values.join(",") : undefined;
}

export function deserializeArrayParam(value: string | undefined): string[] | undefined {
  return value ? value.split(",").filter(Boolean) : undefined;
}

// Search parameter sanitization
export function sanitizeSearchParams(params: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  Object.entries(params).forEach(([key, value]) => {
    // Skip undefined, null, or empty string values
    if (value !== undefined && value !== null && value !== "") {
      // Convert arrays to comma-separated strings for URL
      if (Array.isArray(value)) {
        if (value.length > 0) {
          sanitized[key] = value.join(",");
        }
      } else {
        sanitized[key] = value;
      }
    }
  });

  return sanitized;
}

// Route metadata for breadcrumbs and navigation
export interface RouteMetadata {
  title: string;
  description?: string;
  icon?: string;
  breadcrumb?: string;
  requiresProject?: boolean;
  requiredPermissions?: string[];
}

export const routeMetadata: Record<string, RouteMetadata> = {
  [ROUTES.root]: {
    title: "Dashboard",
    description: "Overview of your resort operations",
    icon: "dashboard",
    breadcrumb: "Dashboard",
    requiresProject: true,
  },
  [ROUTES.dashboard]: {
    title: "Dashboard",
    description: "Overview of your resort operations",
    icon: "dashboard",
    breadcrumb: "Dashboard",
    requiresProject: true,
  },
  "/bookings": {
    title: "Bookings",
    description: "Manage your property bookings",
    icon: "calendar",
    breadcrumb: "Bookings",
    requiresProject: true,
  },
  "/properties": {
    title: "Properties",
    description: "Manage your rental properties",
    icon: "home",
    breadcrumb: "Properties",
    requiresProject: true,
  },
  "/expenses": {
    title: "Expenses",
    description: "Track and manage expenses",
    icon: "receipt",
    breadcrumb: "Expenses",
    requiresProject: true,
  },
  "/reports": {
    title: "Reports",
    description: "Financial reports and analytics",
    icon: "chart",
    breadcrumb: "Reports",
    requiresProject: true,
  },
  "/team": {
    title: "Team",
    description: "Manage team members and permissions",
    icon: "users",
    breadcrumb: "Team",
    requiresProject: true,
  },
  "/settings": {
    title: "Settings",
    description: "Account and project settings",
    icon: "settings",
    breadcrumb: "Settings",
  },
};
