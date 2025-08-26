/**
 * Database Entity Types
 *
 * Comprehensive TypeScript type definitions derived from Drizzle ORM schemas
 * for the Okaeri Resort Management System. These types ensure strict type safety
 * across all database operations and provide helper types for CRUD operations.
 */

import { InferSelectModel, InferInsertModel } from "drizzle-orm";

// Import database schemas
import {
  users,
  projects,
  userProjectPermissions,
  auditLogs,
  createProjectSchema,
  USER_ROLES,
  BOOKING_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  EXPENSE_STATUS,
  AUDIT_CATEGORIES,
  AUDIT_SEVERITIES,
} from "../lib/db/schema";

import type { ProjectSchema } from "../lib/db/schema";

// ====================================
// GLOBAL SCHEMA TYPES
// ====================================

/**
 * User entity types
 */
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

// User helper types
export type CreateUserInput = Omit<
  NewUser,
  "id" | "createdAt" | "updatedAt" | "loginAttempts" | "metadata"
> & {
  loginAttempts?: never; // Prevent manual setting
  metadata?: Record<string, unknown>;
};

export type UpdateUserInput = Partial<Omit<CreateUserInput, "email" | "passwordHash">> & {
  email?: string; // Allow email updates with special handling
  passwordHash?: string; // Allow password updates with special handling
};

export type UserWithoutSensitiveData = Omit<
  User,
  "passwordHash" | "emailVerificationToken" | "passwordResetToken"
>;

export type LoginAttempt = {
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
};

export type UserPreferences = {
  language?: "en" | "fil";
  timezone?: string;
  notifications?: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
};

/**
 * Project entity types
 */
export type Project = InferSelectModel<typeof projects>;
export type NewProject = InferInsertModel<typeof projects>;

// Project helper types
export type CreateProjectInput = Omit<
  NewProject,
  "id" | "createdAt" | "updatedAt" | "schemaName"
> & {
  schemaName?: never; // Prevent manual setting - generated from slug
};

export type UpdateProjectInput = Partial<Omit<CreateProjectInput, "ownerId" | "slug">> & {
  // Owner and slug changes require special handling
};

export type ProjectCoordinates = {
  lat: number;
  lng: number;
};

export type ProjectSocialMedia = {
  facebook?: string;
  instagram?: string;
  twitter?: string;
};

export type ProjectBookingRules = {
  advanceBookingDays?: number;
  cancellationHours?: number;
  requireDeposit?: boolean;
  depositPercentage?: number;
};

export type ProjectPaymentMethods = {
  cash?: boolean;
  gcash?: boolean;
  bankTransfer?: boolean;
  creditCard?: boolean;
};

export type ProjectNotificationSettings = {
  bookingConfirmation?: boolean;
  paymentReceived?: boolean;
  dailyReport?: boolean;
};

export type ProjectSettings = {
  bookingRules?: ProjectBookingRules;
  paymentMethods?: ProjectPaymentMethods;
  notifications?: ProjectNotificationSettings;
};

/**
 * User Project Permission entity types
 */
export type UserProjectPermission = InferSelectModel<typeof userProjectPermissions>;
export type NewUserProjectPermission = InferInsertModel<typeof userProjectPermissions>;

// User Project Permission helper types
export type CreateUserProjectPermissionInput = Omit<
  NewUserProjectPermission,
  "createdAt" | "updatedAt" | "invitationToken" | "invitationExpiry"
>;

export type UpdateUserProjectPermissionInput = Partial<
  Omit<CreateUserProjectPermissionInput, "userId" | "projectId">
>;

export type PermissionActions = {
  view?: boolean;
  create?: boolean;
  update?: boolean;
  delete?: boolean;
};

export type ResourcePermissions = {
  bookings?: PermissionActions;
  payments?: PermissionActions;
  expenses?: PermissionActions;
  reports?: {
    view?: boolean;
    export?: boolean;
  };
  settings?: {
    view?: boolean;
    update?: boolean;
  };
  users?: {
    view?: boolean;
    invite?: boolean;
    remove?: boolean;
    updateRoles?: boolean;
  };
};

/**
 * Audit Log entity types
 */
export type AuditLog = InferSelectModel<typeof auditLogs>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;

// Audit Log helper types
export type CreateAuditLogInput = Omit<NewAuditLog, "id" | "createdAt">;

// ====================================
// PROJECT SCHEMA TYPES
// ====================================

/**
 * Helper type to infer types from project schema
 */
type ProjectSchemaTypes<T extends ProjectSchema> = {
  Booking: InferSelectModel<T["bookings"]>;
  NewBooking: InferInsertModel<T["bookings"]>;
  Payment: InferSelectModel<T["payments"]>;
  NewPayment: InferInsertModel<T["payments"]>;
  ExpenseCategory: InferSelectModel<T["expenseCategories"]>;
  NewExpenseCategory: InferInsertModel<T["expenseCategories"]>;
  Expense: InferSelectModel<T["expenses"]>;
  NewExpense: InferInsertModel<T["expenses"]>;
  Income: InferSelectModel<T["income"]>;
  NewIncome: InferInsertModel<T["income"]>;
  BookingTimeline: InferSelectModel<T["bookingTimeline"]>;
  NewBookingTimeline: InferInsertModel<T["bookingTimeline"]>;
  ProjectSettings: InferSelectModel<T["projectSettings"]>;
  NewProjectSettings: InferInsertModel<T["projectSettings"]>;
};

// Create a sample project schema for type inference
const sampleProjectSchema = createProjectSchema("sample");
type SampleProjectTypes = ProjectSchemaTypes<typeof sampleProjectSchema>;

/**
 * Booking entity types
 */
export type Booking = SampleProjectTypes["Booking"];
export type NewBooking = SampleProjectTypes["NewBooking"];

// Booking helper types
export type CreateBookingInput = Omit<
  NewBooking,
  "id" | "bookingCode" | "createdAt" | "updatedAt" | "cancelledAt" | "cancelledBy"
> & {
  bookingCode?: never; // Auto-generated
};

export type UpdateBookingInput = Partial<Omit<CreateBookingInput, "createdBy">> & {
  cancellationReason?: string;
  cancelledBy?: string;
};

export type BookingWithRelations = Booking & {
  payments?: Payment[];
  timeline?: BookingTimeline[];
};

/**
 * Payment entity types
 */
export type Payment = SampleProjectTypes["Payment"];
export type NewPayment = SampleProjectTypes["NewPayment"];

// Payment helper types
export type CreatePaymentInput = Omit<
  NewPayment,
  "id" | "paymentCode" | "createdAt" | "updatedAt" | "verifiedAt" | "verifiedBy"
> & {
  paymentCode?: never; // Auto-generated
};

export type UpdatePaymentInput = Partial<Omit<CreatePaymentInput, "bookingId">> & {
  verifiedBy?: string;
};

/**
 * Expense Category entity types
 */
export type ExpenseCategory = SampleProjectTypes["ExpenseCategory"];
export type NewExpenseCategory = SampleProjectTypes["NewExpenseCategory"];

// Expense Category helper types
export type CreateExpenseCategoryInput = Omit<NewExpenseCategory, "id" | "createdAt" | "updatedAt">;
export type UpdateExpenseCategoryInput = Partial<CreateExpenseCategoryInput>;

/**
 * Expense entity types
 */
export type Expense = SampleProjectTypes["Expense"];
export type NewExpense = SampleProjectTypes["NewExpense"];

// Expense helper types
export type CreateExpenseInput = Omit<
  NewExpense,
  "id" | "expenseCode" | "createdAt" | "updatedAt" | "approvedBy" | "approvedAt"
> & {
  expenseCode?: never; // Auto-generated
};

export type UpdateExpenseInput = Partial<Omit<CreateExpenseInput, "createdBy">> & {
  approvedBy?: string;
};

export type ExpenseAttachment = {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
};

/**
 * Income entity types
 */
export type Income = SampleProjectTypes["Income"];
export type NewIncome = SampleProjectTypes["NewIncome"];

// Income helper types
export type CreateIncomeInput = Omit<NewIncome, "id" | "incomeCode" | "createdAt" | "updatedAt"> & {
  incomeCode?: never; // Auto-generated
};

export type UpdateIncomeInput = Partial<Omit<CreateIncomeInput, "recordedBy">>;

/**
 * Booking Timeline entity types
 */
export type BookingTimeline = SampleProjectTypes["BookingTimeline"];
export type NewBookingTimeline = SampleProjectTypes["NewBookingTimeline"];

// Booking Timeline helper types
export type CreateBookingTimelineInput = Omit<NewBookingTimeline, "id" | "createdAt">;

/**
 * Project Settings entity types
 */
export type ProjectSettingsEntry = SampleProjectTypes["ProjectSettings"];
export type NewProjectSettingsEntry = SampleProjectTypes["NewProjectSettings"];

// Project Settings helper types
export type CreateProjectSettingsInput = Omit<
  NewProjectSettingsEntry,
  "id" | "createdAt" | "updatedAt"
>;
export type UpdateProjectSettingsInput = Partial<Omit<CreateProjectSettingsInput, "key">>;

// ====================================
// ENUM TYPES (Re-exported from schema)
// ====================================

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];
export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];
export type ExpenseStatus = (typeof EXPENSE_STATUS)[keyof typeof EXPENSE_STATUS];
export type AuditCategory = (typeof AUDIT_CATEGORIES)[keyof typeof AUDIT_CATEGORIES];
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[keyof typeof AUDIT_SEVERITIES];

// ====================================
// UTILITY TYPES
// ====================================

/**
 * Database entity identifier type
 */
export type EntityId = string;

/**
 * Database timestamp type (ISO string)
 */
export type Timestamp = string;

/**
 * Philippine peso amount type (stored as decimal string)
 */
export type PhpAmount = string;

/**
 * Generic entity with audit fields
 */
export type EntityWithAudit = {
  id: EntityId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/**
 * Generic entity with user tracking
 */
export type EntityWithUserTracking = EntityWithAudit & {
  createdBy?: EntityId;
  updatedBy?: EntityId;
};

/**
 * Pagination metadata for database queries
 */
export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

/**
 * Generic paginated response from database
 */
export type PaginatedResult<T> = {
  data: T[];
  meta: PaginationMeta;
};

/**
 * Database filter operators
 */
export type FilterOperator =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "ilike"
  | "in"
  | "notIn"
  | "isNull"
  | "isNotNull";

/**
 * Generic database filter
 */
export type DatabaseFilter<T = unknown> = {
  field: string;
  operator: FilterOperator;
  value: T;
};

/**
 * Database sort order
 */
export type SortOrder = "asc" | "desc";

/**
 * Database sort specification
 */
export type DatabaseSort = {
  field: string;
  order: SortOrder;
};

/**
 * Database query options
 */
export type DatabaseQueryOptions = {
  page?: number;
  limit?: number;
  filters?: DatabaseFilter[];
  sorts?: DatabaseSort[];
  include?: string[]; // Relations to include
};

// ====================================
// TYPE GUARDS
// ====================================

/**
 * Type guard to check if an entity has audit fields
 */
export function hasAuditFields(entity: unknown): entity is EntityWithAudit {
  return (
    typeof entity === "object" &&
    entity !== null &&
    "id" in entity &&
    "createdAt" in entity &&
    "updatedAt" in entity
  );
}

/**
 * Type guard to check if an entity has user tracking
 */
export function hasUserTracking(entity: unknown): entity is EntityWithUserTracking {
  return hasAuditFields(entity) && ("createdBy" in entity || "updatedBy" in entity);
}

/**
 * Type guard for valid UUID format
 */
export function isValidEntityId(id: unknown): id is EntityId {
  if (typeof id !== "string") return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Type guard for valid ISO timestamp
 */
export function isValidTimestamp(timestamp: unknown): timestamp is Timestamp {
  if (typeof timestamp !== "string") return false;
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) && date.toISOString() === timestamp;
}

/**
 * Type guard for valid Philippine peso amount
 */
export function isValidPhpAmount(amount: unknown): amount is PhpAmount {
  if (typeof amount !== "string") return false;
  const decimal = parseFloat(amount);
  return !isNaN(decimal) && decimal >= 0 && /^\d+(\.\d{1,2})?$/.test(amount);
}

// ====================================
// CONSTANTS
// ====================================

/**
 * Re-export enum constants for convenience
 */
export {
  USER_ROLES,
  BOOKING_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  EXPENSE_STATUS,
  AUDIT_CATEGORIES,
  AUDIT_SEVERITIES,
} from "../lib/db/schema";

/**
 * Database constraints
 */
export const DATABASE_LIMITS = {
  // String lengths (matching database constraints)
  EMAIL_MAX_LENGTH: 255,
  NAME_MAX_LENGTH: 100,
  PHONE_MAX_LENGTH: 20,
  SLUG_MAX_LENGTH: 255,
  SCHEMA_NAME_MAX_LENGTH: 63,

  // Pagination limits
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // File constraints
  MAX_FILE_SIZE_MB: 10,
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/webp"],
  ALLOWED_DOCUMENT_TYPES: ["application/pdf", "image/jpeg", "image/png"],

  // Business rules
  MIN_BOOKING_ADVANCE_HOURS: 1,
  MAX_BOOKING_ADVANCE_DAYS: 365,
  MIN_CANCELLATION_HOURS: 1,
  MAX_DEPOSIT_PERCENTAGE: 100,
} as const;

/**
 * Philippine-specific constants
 */
export const PHILIPPINE_CONSTANTS = {
  CURRENCY: "PHP",
  TIMEZONE: "Asia/Manila",
  COUNTRY_CODE: "PH",
  PHONE_PREFIX: "+63",
  LOCALE: "en-PH",
} as const;
