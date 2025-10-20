# 🔧 Phase 2: Application Layer

**Duration:** Week 2-3 (16-20 hours)  
**Status:** Not Started  
**Prerequisites:** Phase 1 complete, TypeScript knowledge

---

## 🎯 Phase Objectives

Build TypeScript utilities that wrap Supabase operations and enrich audit logs with business context, user actions, and metadata that database triggers cannot capture.

**Key Outcomes:**

- ✅ TypeScript audit library with strong typing
- ✅ `auditedOperation()` wrapper for automatic logging
- ✅ `logAuditEvent()` for standalone events
- ✅ React hooks for querying audit logs
- ✅ Integration with existing auth system
- ✅ 100% test coverage

---

## 📋 Task Breakdown

### Task 2.1: TypeScript Types & Constants (3 hours)

**Priority:** Critical  
**Dependencies:** Phase 1

Define all TypeScript types, enums, and constants for the audit system.

**File:** `src/lib/audit/types.ts`

```typescript
/**
 * Audit System Type Definitions
 *
 * This file contains all TypeScript types for the audit logging system.
 * Ensures type safety across database and application layers.
 */

import type { Database } from "@/database.types";

// ============================================
// DATABASE TYPES (from Supabase)
// ============================================

export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
export type AuditLogInsert = Database["public"]["Tables"]["audit_logs"]["Insert"];
export type AuditLogUpdate = Database["public"]["Tables"]["audit_logs"]["Update"];

// ============================================
// AUDIT ACTIONS
// ============================================

/**
 * Database-level actions (from triggers)
 */
export type DatabaseAction = "INSERT" | "UPDATE" | "DELETE";

/**
 * Application-level actions (business logic)
 */
export enum AuditAction {
  // Authentication
  AUTH_LOGIN = "auth:login",
  AUTH_LOGOUT = "auth:logout",
  AUTH_LOGIN_FAILED = "auth:login_failed",
  AUTH_SESSION_REFRESH = "auth:session_refresh",
  AUTH_SESSION_EXPIRED = "auth:session_expired",

  // Bookings
  BOOKING_CREATE = "booking:create",
  BOOKING_UPDATE = "booking:update",
  BOOKING_DELETE = "booking:delete",
  BOOKING_STATUS_CHANGE = "booking:status_change",
  BOOKING_CANCEL = "booking:cancel",
  BOOKING_CONFIRM = "booking:confirm",
  BOOKING_CHECKIN = "booking:checkin",
  BOOKING_CHECKOUT = "booking:checkout",

  // Payments
  PAYMENT_RECORD = "payment:record",
  PAYMENT_UPDATE = "payment:update",
  PAYMENT_DELETE = "payment:delete",
  PAYMENT_REFUND = "payment:refund",
  PAYMENT_PROOF_UPLOAD = "payment:proof_upload",

  // Units
  UNIT_CREATE = "unit:create",
  UNIT_UPDATE = "unit:update",
  UNIT_DELETE = "unit:delete",
  UNIT_STATUS_CHANGE = "unit:status_change",
  UNIT_RATE_CHANGE = "unit:rate_change",

  // Guests
  GUEST_CREATE = "guest:create",
  GUEST_UPDATE = "guest:update",
  GUEST_MERGE = "guest:merge",

  // Expenses
  EXPENSE_CREATE = "expense:create",
  EXPENSE_UPDATE = "expense:update",
  EXPENSE_DELETE = "expense:delete",
  EXPENSE_RECEIPT_UPLOAD = "expense:receipt_upload",

  // Maintenance
  MAINTENANCE_CREATE = "maintenance:create",
  MAINTENANCE_UPDATE = "maintenance:update",
  MAINTENANCE_RESOLVE = "maintenance:resolve",

  // System
  SYSTEM_CONFIG_CHANGE = "system:config_change",
  SYSTEM_EXPORT = "system:export",
  SYSTEM_IMPORT = "system:import",
  SYSTEM_BACKUP = "system:backup",
}

// ============================================
// SEVERITY LEVELS
// ============================================

export enum AuditSeverity {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARNING = "WARNING",
  CRITICAL = "CRITICAL",
}

// ============================================
// AUDIT CATEGORIES
// ============================================

export enum AuditCategory {
  AUTH = "auth",
  BOOKING = "booking",
  PAYMENT = "payment",
  UNIT = "unit",
  GUEST = "guest",
  EXPENSE = "expense",
  MAINTENANCE = "maintenance",
  SYSTEM = "system",
}

// ============================================
// TABLE NAMES (Type-safe)
// ============================================

export type AuditableTable =
  | "units"
  | "guests"
  | "bookings"
  | "payments"
  | "expenses"
  | "maintenance_logs";

// ============================================
// AUDIT EVENT CONTEXT
// ============================================

/**
 * Context information for audit events
 */
export interface AuditContext {
  // Required
  action: AuditAction | string;
  description: string;

  // Optional - Database context
  tableName?: AuditableTable;
  recordId?: string;

  // Optional - Change tracking
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;

  // Optional - Categorization
  category?: AuditCategory;
  severity?: AuditSeverity;

  // Optional - Additional metadata
  metadata?: Record<string, unknown>;
}

// ============================================
// AUDIT QUERY FILTERS
// ============================================

/**
 * Filters for querying audit logs
 */
export interface AuditLogFilters {
  // Table filtering
  tableName?: AuditableTable | AuditableTable[];
  recordId?: string;

  // User filtering
  userId?: string;
  userEmail?: string;

  // Action filtering
  action?: DatabaseAction | DatabaseAction[];
  category?: AuditCategory | AuditCategory[];

  // Severity filtering
  severity?: AuditSeverity | AuditSeverity[];

  // Time range
  startDate?: Date;
  endDate?: Date;

  // Pagination
  limit?: number;
  offset?: number;

  // Sorting
  sortBy?: "created_at" | "table_name" | "user_email";
  sortOrder?: "asc" | "desc";
}

// ============================================
// AUDIT QUERY RESULTS
// ============================================

/**
 * Result of an audit log query
 */
export interface AuditLogQueryResult {
  logs: AuditLog[];
  total: number;
  hasMore: boolean;
}

// ============================================
// AUDIT DIFF
// ============================================

/**
 * Represents a field change in an audit log
 */
export interface AuditFieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  type: "added" | "modified" | "deleted";
}

/**
 * Formatted diff view of changes
 */
export interface AuditDiff {
  changes: AuditFieldChange[];
  totalChanges: number;
}

// ============================================
// AUDIT STATISTICS
// ============================================

/**
 * Statistics for audit logs
 */
export interface AuditStats {
  totalChanges: number;
  changesByTable: Record<string, number>;
  changesByUser: Record<string, number>;
  changesByAction: Record<string, number>;
  recentActivity: Array<{
    date: string;
    count: number;
  }>;
}

// ============================================
// OPERATION WRAPPER TYPES
// ============================================

/**
 * Options for audited operations
 */
export interface AuditedOperationOptions {
  // Context
  description: string;
  category?: AuditCategory;
  severity?: AuditSeverity;

  // Error handling
  captureErrors?: boolean;
  throwOnAuditFailure?: boolean;

  // Performance
  async?: boolean;
}

/**
 * Result of an audited operation
 */
export interface AuditedOperationResult<T> {
  data: T;
  auditId?: string;
  error?: Error;
}

// ============================================
// EXPORT ALL
// ============================================

export type { AuditLog, AuditLogInsert, AuditLogUpdate, DatabaseAction };
```

**File:** `src/lib/audit/constants.ts`

```typescript
/**
 * Audit System Constants
 *
 * Central location for all audit-related constants.
 */

import { AuditAction, AuditCategory, AuditSeverity } from "./types";

// ============================================
// ACTION SEVERITY MAPPING
// ============================================

/**
 * Default severity level for each action type
 */
export const ACTION_SEVERITY_MAP: Record<string, AuditSeverity> = {
  // Critical actions
  [AuditAction.AUTH_LOGIN_FAILED]: AuditSeverity.WARNING,
  [AuditAction.BOOKING_CANCEL]: AuditSeverity.WARNING,
  [AuditAction.PAYMENT_REFUND]: AuditSeverity.CRITICAL,
  [AuditAction.SYSTEM_CONFIG_CHANGE]: AuditSeverity.CRITICAL,

  // Info actions (default for most)
  [AuditAction.AUTH_LOGIN]: AuditSeverity.INFO,
  [AuditAction.AUTH_LOGOUT]: AuditSeverity.INFO,
  [AuditAction.BOOKING_CREATE]: AuditSeverity.INFO,
  [AuditAction.PAYMENT_RECORD]: AuditSeverity.INFO,

  // Debug actions
  [AuditAction.AUTH_SESSION_REFRESH]: AuditSeverity.DEBUG,
};

// ============================================
// ACTION CATEGORY MAPPING
// ============================================

/**
 * Automatic category assignment based on action
 */
export const ACTION_CATEGORY_MAP: Record<string, AuditCategory> = {
  // Auth
  [AuditAction.AUTH_LOGIN]: AuditCategory.AUTH,
  [AuditAction.AUTH_LOGOUT]: AuditCategory.AUTH,
  [AuditAction.AUTH_LOGIN_FAILED]: AuditCategory.AUTH,
  [AuditAction.AUTH_SESSION_REFRESH]: AuditCategory.AUTH,
  [AuditAction.AUTH_SESSION_EXPIRED]: AuditCategory.AUTH,

  // Bookings
  [AuditAction.BOOKING_CREATE]: AuditCategory.BOOKING,
  [AuditAction.BOOKING_UPDATE]: AuditCategory.BOOKING,
  [AuditAction.BOOKING_STATUS_CHANGE]: AuditCategory.BOOKING,
  [AuditAction.BOOKING_CANCEL]: AuditCategory.BOOKING,

  // Payments
  [AuditAction.PAYMENT_RECORD]: AuditCategory.PAYMENT,
  [AuditAction.PAYMENT_REFUND]: AuditCategory.PAYMENT,

  // Units
  [AuditAction.UNIT_CREATE]: AuditCategory.UNIT,
  [AuditAction.UNIT_UPDATE]: AuditCategory.UNIT,
  [AuditAction.UNIT_STATUS_CHANGE]: AuditCategory.UNIT,

  // Guests
  [AuditAction.GUEST_CREATE]: AuditCategory.GUEST,
  [AuditAction.GUEST_UPDATE]: AuditCategory.GUEST,

  // Expenses
  [AuditAction.EXPENSE_CREATE]: AuditCategory.EXPENSE,
  [AuditAction.EXPENSE_UPDATE]: AuditCategory.EXPENSE,

  // Maintenance
  [AuditAction.MAINTENANCE_CREATE]: AuditCategory.MAINTENANCE,
  [AuditAction.MAINTENANCE_UPDATE]: AuditCategory.MAINTENANCE,
};

// ============================================
// QUERY LIMITS
// ============================================

/**
 * Pagination defaults
 */
export const AUDIT_QUERY_LIMITS = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 500,
  DEFAULT_PAGE_SIZE: 25,
} as const;

// ============================================
// RETENTION POLICY
// ============================================

/**
 * Audit log retention configuration
 */
export const AUDIT_RETENTION = {
  HOT_DATA_DAYS: 30, // Keep in main table
  WARM_DATA_DAYS: 180, // Move to archive
  COLD_DATA_DAYS: 365, // Eligible for deletion
} as const;

// ============================================
// SENSITIVE FIELDS
// ============================================

/**
 * Fields to redact or mask in audit logs
 */
export const SENSITIVE_FIELDS = [
  "password",
  "access_token",
  "refresh_token",
  "api_key",
  "secret",
  "credit_card",
  "ssn",
] as const;

// ============================================
// HUMAN-READABLE LABELS
// ============================================

/**
 * User-friendly labels for actions
 */
export const ACTION_LABELS: Record<string, string> = {
  [AuditAction.AUTH_LOGIN]: "User Login",
  [AuditAction.AUTH_LOGOUT]: "User Logout",
  [AuditAction.AUTH_LOGIN_FAILED]: "Failed Login Attempt",
  [AuditAction.BOOKING_CREATE]: "Booking Created",
  [AuditAction.BOOKING_UPDATE]: "Booking Updated",
  [AuditAction.BOOKING_STATUS_CHANGE]: "Booking Status Changed",
  [AuditAction.BOOKING_CANCEL]: "Booking Cancelled",
  [AuditAction.PAYMENT_RECORD]: "Payment Recorded",
  [AuditAction.PAYMENT_REFUND]: "Payment Refunded",
  [AuditAction.UNIT_STATUS_CHANGE]: "Unit Status Changed",
  [AuditAction.EXPENSE_CREATE]: "Expense Added",
  [AuditAction.SYSTEM_CONFIG_CHANGE]: "System Configuration Changed",
};

/**
 * User-friendly labels for categories
 */
export const CATEGORY_LABELS: Record<AuditCategory, string> = {
  [AuditCategory.AUTH]: "Authentication",
  [AuditCategory.BOOKING]: "Bookings",
  [AuditCategory.PAYMENT]: "Payments",
  [AuditCategory.UNIT]: "Units",
  [AuditCategory.GUEST]: "Guests",
  [AuditCategory.EXPENSE]: "Expenses",
  [AuditCategory.MAINTENANCE]: "Maintenance",
  [AuditCategory.SYSTEM]: "System",
};

/**
 * User-friendly labels for severity
 */
export const SEVERITY_LABELS: Record<AuditSeverity, string> = {
  [AuditSeverity.DEBUG]: "Debug",
  [AuditSeverity.INFO]: "Info",
  [AuditSeverity.WARNING]: "Warning",
  [AuditSeverity.CRITICAL]: "Critical",
};

// ============================================
// COLORS FOR UI
// ============================================

/**
 * Tailwind color classes for severity levels
 */
export const SEVERITY_COLORS: Record<AuditSeverity, string> = {
  [AuditSeverity.DEBUG]: "text-gray-500 bg-gray-100",
  [AuditSeverity.INFO]: "text-blue-600 bg-blue-100",
  [AuditSeverity.WARNING]: "text-yellow-600 bg-yellow-100",
  [AuditSeverity.CRITICAL]: "text-red-600 bg-red-100",
};

/**
 * Tailwind color classes for categories
 */
export const CATEGORY_COLORS: Record<AuditCategory, string> = {
  [AuditCategory.AUTH]: "text-purple-600 bg-purple-100",
  [AuditCategory.BOOKING]: "text-blue-600 bg-blue-100",
  [AuditCategory.PAYMENT]: "text-green-600 bg-green-100",
  [AuditCategory.UNIT]: "text-orange-600 bg-orange-100",
  [AuditCategory.GUEST]: "text-pink-600 bg-pink-100",
  [AuditCategory.EXPENSE]: "text-red-600 bg-red-100",
  [AuditCategory.MAINTENANCE]: "text-yellow-600 bg-yellow-100",
  [AuditCategory.SYSTEM]: "text-gray-600 bg-gray-100",
};
```

---

### Task 2.2: Core Audit Logger (5 hours)

**Priority:** Critical  
**Dependencies:** Task 2.1

Build the core logging utility that interfaces with Supabase.

**File:** `src/lib/audit/logger.ts`

````typescript
/**
 * Core Audit Logger
 *
 * Provides functions to create audit log entries with rich context.
 * Works alongside database triggers to provide complete audit trail.
 */

import { supabase } from "@/lib/supabase";

import { ACTION_CATEGORY_MAP, ACTION_SEVERITY_MAP, SENSITIVE_FIELDS } from "./constants";
import { AuditSeverity, type AuditContext, type AuditLogInsert } from "./types";

// ============================================
// ERROR HANDLING
// ============================================

class AuditLogError extends Error {
  constructor(
    message: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "AuditLogError";
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get current user context from Supabase Auth
 */
async function getUserContext() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return {
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      userRole: session?.user?.user_metadata?.role,
    };
  } catch (error) {
    console.warn("Failed to get user context for audit:", error);
    return {
      userId: undefined,
      userEmail: undefined,
      userRole: undefined,
    };
  }
}

/**
 * Get client context (browser info)
 */
function getClientContext() {
  if (typeof window === "undefined") {
    return {
      userAgent: undefined,
      ipAddress: undefined,
    };
  }

  return {
    userAgent: navigator.userAgent,
    // IP address will be null from client-side
    // Could be enriched server-side if using Edge Functions
    ipAddress: undefined,
  };
}

/**
 * Redact sensitive fields from data
 */
function redactSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...data };

  for (const field of SENSITIVE_FIELDS) {
    if (field in redacted) {
      redacted[field] = "[REDACTED]";
    }
  }

  return redacted;
}

/**
 * Determine severity from action
 */
function getSeverity(action: string, explicitSeverity?: AuditSeverity): AuditSeverity {
  return explicitSeverity || ACTION_SEVERITY_MAP[action] || AuditSeverity.INFO;
}

/**
 * Determine category from action
 */
function getCategory(action: string, explicitCategory?: string): string | undefined {
  return explicitCategory || ACTION_CATEGORY_MAP[action];
}

// ============================================
// MAIN LOGGING FUNCTION
// ============================================

/**
 * Create an audit log entry
 *
 * This function enriches database-level audit logs with application context.
 * Database triggers handle the basic change tracking; this adds business logic.
 *
 * @param context - Audit event context
 * @returns Promise<string> - Audit log ID
 * @throws AuditLogError - If audit logging fails
 *
 * @example
 * ```typescript
 * await logAuditEvent({
 *   action: AuditAction.BOOKING_STATUS_CHANGE,
 *   description: 'Changed booking status from Pending to Confirmed',
 *   tableName: 'bookings',
 *   recordId: bookingId,
 *   oldData: { booking_status: 'Pending' },
 *   newData: { booking_status: 'Confirmed' },
 *   metadata: { bookingReference: 'BK-20250101-ABC123' },
 * });
 * ```
 */
export async function logAuditEvent(context: AuditContext): Promise<string> {
  try {
    // Get user and client context
    const userContext = await getUserContext();
    const clientContext = getClientContext();

    // Determine severity and category
    const severity = getSeverity(context.action, context.severity);
    const category = getCategory(context.action, context.category);

    // Redact sensitive data
    const oldData = context.oldData ? redactSensitiveData(context.oldData) : null;
    const newData = context.newData ? redactSensitiveData(context.newData) : null;

    // Build audit log entry
    const auditEntry: AuditLogInsert = {
      // Action details
      table_name: context.tableName,
      record_id: context.recordId,
      action: "UPDATE", // Application logs don't have DB action

      // User context
      user_id: userContext.userId,
      user_email: userContext.userEmail,
      user_role: userContext.userRole,

      // Change tracking
      old_data: oldData as never,
      new_data: newData as never,
      changed_fields: null, // Database trigger handles this

      // Application context
      description: context.description,
      category: category,
      severity: severity,
      metadata: context.metadata as never,

      // Client context
      ip_address: clientContext.ipAddress,
      user_agent: clientContext.userAgent,
    };

    // Insert into database
    const { data, error } = await supabase
      .from("audit_logs")
      .insert(auditEntry)
      .select("audit_id")
      .single();

    if (error) {
      throw new AuditLogError("Failed to insert audit log", error);
    }

    if (!data?.audit_id) {
      throw new AuditLogError("Audit log created but no ID returned");
    }

    return data.audit_id;
  } catch (error) {
    // Log error but don't throw - audit failures shouldn't break app
    console.error("Audit logging failed:", error);

    // Optionally send to error tracking service
    // e.g., Sentry.captureException(error)

    // Return empty string to indicate failure
    return "";
  }
}

// ============================================
// SPECIALIZED LOGGING FUNCTIONS
// ============================================

/**
 * Log authentication events
 */
export async function logAuthEvent(
  action: string,
  description: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  return logAuditEvent({
    action,
    description,
    severity: action.includes("failed") ? AuditSeverity.WARNING : AuditSeverity.INFO,
    metadata,
  });
}

/**
 * Log booking events
 */
export async function logBookingEvent(
  action: string,
  bookingId: string,
  description: string,
  oldData?: Record<string, unknown>,
  newData?: Record<string, unknown>,
  metadata?: Record<string, unknown>
): Promise<string> {
  return logAuditEvent({
    action,
    description,
    tableName: "bookings",
    recordId: bookingId,
    oldData,
    newData,
    metadata,
  });
}

/**
 * Log payment events
 */
export async function logPaymentEvent(
  action: string,
  paymentId: string,
  description: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  return logAuditEvent({
    action,
    description,
    tableName: "payments",
    recordId: paymentId,
    severity: action.includes("refund") ? AuditSeverity.CRITICAL : AuditSeverity.INFO,
    metadata,
  });
}

/**
 * Log system events
 */
export async function logSystemEvent(
  action: string,
  description: string,
  severity: AuditSeverity = AuditSeverity.INFO,
  metadata?: Record<string, unknown>
): Promise<string> {
  return logAuditEvent({
    action,
    description,
    severity,
    metadata,
  });
}

// ============================================
// BATCH LOGGING
// ============================================

/**
 * Log multiple audit events at once
 * Useful for bulk operations
 */
export async function logAuditEventsBatch(contexts: AuditContext[]): Promise<string[]> {
  const promises = contexts.map((context) => logAuditEvent(context));
  return Promise.all(promises);
}

// ============================================
// EXPORTS
// ============================================

export { AuditLogError };
````

---

### Task 2.3: Operation Wrapper (4 hours)

**Priority:** High  
**Dependencies:** Task 2.2

Create wrapper for Supabase operations with automatic audit logging.

**File:** `src/lib/audit/wrapper.ts`

````typescript
/**
 * Audited Operation Wrapper
 *
 * Wraps Supabase operations to automatically log audit trails.
 * Use this for all critical database operations.
 */

import type { PostgrestError } from "@supabase/supabase-js";

import { logAuditEvent } from "./logger";
import type { AuditContext, AuditedOperationOptions, AuditedOperationResult } from "./types";

// ============================================
// OPERATION WRAPPER
// ============================================

/**
 * Wraps a Supabase operation with audit logging
 *
 * Automatically logs:
 * - Operation success/failure
 * - Execution time
 * - User context
 * - Error details (if any)
 *
 * @param operation - Async function performing the operation
 * @param context - Audit context for the operation
 * @param options - Additional options
 * @returns Operation result with audit metadata
 *
 * @example
 * ```typescript
 * const result = await auditedOperation(
 *   async () => {
 *     const { data, error } = await supabase
 *       .from('bookings')
 *       .update({ booking_status: 'Confirmed' })
 *       .eq('booking_id', bookingId)
 *       .select()
 *       .single();
 *
 *     if (error) throw error;
 *     return data;
 *   },
 *   {
 *     action: AuditAction.BOOKING_STATUS_CHANGE,
 *     description: `Changed booking ${bookingRef} to Confirmed`,
 *     tableName: 'bookings',
 *     recordId: bookingId,
 *     oldData: { booking_status: 'Pending' },
 *     newData: { booking_status: 'Confirmed' },
 *   }
 * );
 *
 * if (result.error) {
 *   console.error('Operation failed:', result.error);
 * } else {
 *   console.log('Success! Audit ID:', result.auditId);
 * }
 * ```
 */
export async function auditedOperation<T>(
  operation: () => Promise<T>,
  context: AuditContext,
  options: Partial<AuditedOperationOptions> = {}
): Promise<AuditedOperationResult<T>> {
  const startTime = Date.now();

  try {
    // Execute the operation
    const data = await operation();
    const executionTime = Date.now() - startTime;

    // Log successful operation
    const auditId = await logAuditEvent({
      ...context,
      metadata: {
        ...context.metadata,
        success: true,
        executionTime,
      },
    });

    return {
      data,
      auditId: auditId || undefined,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;

    // Log failed operation
    if (options.captureErrors !== false) {
      await logAuditEvent({
        ...context,
        description: `${context.description} (FAILED)`,
        severity: "WARNING",
        metadata: {
          ...context.metadata,
          success: false,
          executionTime,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }

    // Decide whether to throw
    if (options.throwOnAuditFailure) {
      throw error;
    }

    return {
      data: null as T,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

// ============================================
// SPECIALIZED WRAPPERS
// ============================================

/**
 * Wrapper specifically for booking operations
 */
export async function auditedBookingOperation<T>(
  operation: () => Promise<T>,
  bookingId: string,
  action: string,
  description: string,
  oldData?: Record<string, unknown>,
  newData?: Record<string, unknown>
): Promise<AuditedOperationResult<T>> {
  return auditedOperation(operation, {
    action,
    description,
    tableName: "bookings",
    recordId: bookingId,
    oldData,
    newData,
  });
}

/**
 * Wrapper specifically for payment operations
 */
export async function auditedPaymentOperation<T>(
  operation: () => Promise<T>,
  paymentId: string,
  action: string,
  description: string,
  metadata?: Record<string, unknown>
): Promise<AuditedOperationResult<T>> {
  return auditedOperation(operation, {
    action,
    description,
    tableName: "payments",
    recordId: paymentId,
    metadata,
  });
}

/**
 * Wrapper for batch operations
 */
export async function auditedBatchOperation<T>(
  operation: () => Promise<T>,
  action: string,
  description: string,
  itemCount: number
): Promise<AuditedOperationResult<T>> {
  return auditedOperation(operation, {
    action,
    description,
    metadata: {
      batchOperation: true,
      itemCount,
    },
  });
}
````

_[Continuing in next file due to length...]_

---

## ✅ Phase 2 Completion Checklist

### TypeScript Setup

- [ ] `types.ts` created with all type definitions
- [ ] `constants.ts` created with enums and mappings
- [ ] Types exported from `index.ts`
- [ ] No TypeScript errors

### Core Logger

- [ ] `logger.ts` implemented
- [ ] User context captured correctly
- [ ] Sensitive data redacted
- [ ] Error handling works
- [ ] Specialized log functions created

### Operation Wrapper

- [ ] `auditedOperation()` wrapper working
- [ ] Specialized wrappers implemented
- [ ] Error capture functioning
- [ ] Performance acceptable (<50ms overhead)

### React Hooks

- [ ] `useAuditLogs()` hook created
- [ ] `useAuditTrail()` hook created
- [ ] Query filters working
- [ ] React Query integration complete

### Testing

- [ ] Unit tests written (80%+ coverage)
- [ ] Integration tests passing
- [ ] Manual testing complete

---

## 🔗 Next Steps

- ✅ Phase 2 Complete
- ⏭️ Proceed to [Phase 3: UI & Visualization](./AUDIT_PHASE_3_UI.md)

---

_Phase 2 establishes rich, contextual audit logging at the application layer._
