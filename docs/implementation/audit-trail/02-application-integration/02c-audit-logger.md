# Phase 2c: Audit Logger Utility

## Purpose

This document covers the `audit-logger.ts` utility module that provides convenient functions for creating enriched audit logs with automatic user context extraction and sensitive data redaction. This is the **Layer 2** (application-level) logging system.

**When to use Layer 2 logging:**

- Critical business operations (cancellations, refunds, status changes)
- Authentication events (login, logout, failed attempts)
- Operations needing business context beyond database field changes
- Security-sensitive operations requiring extra audit detail

## Core Logger Module

### File Location

Create `src/lib/audit-logger.ts`:

```typescript
// src/lib/audit-logger.ts

import { db, supabase } from "./supabase";
import type {
  AuditEventContext,
  AuditCategory,
  AuditSeverity,
  AuditAction,
  AuditEventType,
} from "../../database.types";
import { redactSensitiveData, isAuditedTable, AUDIT_DEBUG, auditDebugLog } from "./audit-constants";

// ============================================
// MAIN AUDIT LOGGING FUNCTION
// ============================================

/**
 * Log an audit event with business context
 *
 * This creates a Layer 2 audit log with enriched metadata.
 * Database triggers (Layer 1) still capture the actual data changes.
 *
 * NOTE: Layer 2 logs always use action='INSERT' and source='app' internally.
 * Store semantic action meaning in description or metadata.action if needed.
 *
 * @param context - Audit event context with business information
 * @returns Promise resolving to created audit log (or null if failed)
 *
 * @example
 * // Basic usage without correlation
 * await logAuditEvent({
 *   tableName: 'bookings',
 *   recordId: booking.booking_id,
 *   description: 'Booking cancelled by guest request',
 *   category: AuditCategory.BOOKING,
 *   severity: AuditSeverity.WARNING,
 *   metadata: { action: 'cancelled', cancellationReason: 'Personal emergency' }
 * });
 *
 * @example
 * // With correlation ID to link trigger log and app log
 * import { v4 as uuidv4 } from 'uuid';
 *
 * const correlationId = uuidv4();
 *
 * // 1. Perform database mutation (triggers fire)
 * const { data: booking } = await db.bookings.update(bookingId, { status: 'cancelled' });
 *
 * // 2. Log business context with same correlation_id
 * await logAuditEvent({
 *   tableName: 'bookings',
 *   recordId: bookingId,
 *   correlationId,  // ← Links this app log to the trigger log
 *   description: 'Booking cancelled by guest request',
 *   category: AuditCategory.BOOKING,
 *   severity: AuditSeverity.WARNING,
 * });
 */
export async function logAuditEvent(
  context: AuditEventContext
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate table name
    if (!isAuditedTable(context.tableName)) {
      console.warn(`[Audit] Table "${context.tableName}" is not audited`);
      return { success: false, error: "Table not audited" };
    }

    // Warn if critical category without IP capture
    const CRITICAL_CATEGORIES = ["authentication", "payment"] as const;
    if (CRITICAL_CATEGORIES.includes(context.category as any)) {
      console.warn(
        `[Audit] Critical event ${context.category} logged without IP. ` +
          `Consider using logAuditEventWithIP() for accurate IP capture.`
      );
    }

    // Get current user from Supabase Auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.warn("[Audit] Failed to get current user:", authError.message);
      // Continue anyway - system operations may not have a user
    }

    // NOTE: XSS sanitization happens at UI rendering layer (see Phase 3b: Table Component)
    // The description is stored raw here and sanitized when displayed to users

    // Redact sensitive data
    const redactedOldData = context.oldData
      ? redactSensitiveData(context.tableName, context.oldData)
      : null;
    const redactedNewData = context.newData
      ? redactSensitiveData(context.tableName, context.newData)
      : null;

    // Build audit log metadata (only for extra context, NOT for dedicated columns)
    const metadata = {
      ...(context.metadata || {}),
      // Add timestamp for reference
      logged_at: new Date().toISOString(),
    };

    // Create audit log via db helper
    // IMPORTANT: db.auditLogs.create() automatically sets action='INSERT' and source='app'
    const { data, error } = await db.auditLogs.create({
      tableName: context.tableName,
      recordId: context.recordId,
      correlationId: context.correlationId, // Optional: links to related trigger logs
      description: context.description, // Stored raw, sanitized at UI layer
      category: context.category,
      severity: context.severity || AuditSeverity.INFO,
      metadata, // Extra context only, NOT dedicated column values
      oldData: redactedOldData,
      newData: redactedNewData,
    });

    if (error) {
      console.error("[Audit] Failed to create audit log:", error.message);
      return { success: false, error: error.message };
    }

    auditDebugLog("Audit log created", { audit_id: data?.audit_id, context });

    return { success: true };
  } catch (error) {
    // Non-blocking: Audit logging failures should not break app functionality
    console.error("[Audit] Exception in logAuditEvent:", error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// SPECIALIZED AUDIT LOGGING HELPERS
// ============================================

/**
 * Log authentication events
 * @param event - Auth event type
 * @param details - Additional context
 */
export async function logAuthEvent(
  event: "login" | "logout" | "login_failed" | "password_reset",
  details?: {
    email?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  // Map event to AuditEventType
  const eventTypeMap: Record<typeof event, AuditEventType> = {
    login: AuditEventType.LOGIN,
    logout: AuditEventType.LOGOUT,
    login_failed: AuditEventType.LOGIN_FAILED,
    password_reset: AuditEventType.PASSWORD_RESET,
  };

  const severity =
    event === "login_failed"
      ? AuditSeverity.WARNING
      : event === "login"
        ? AuditSeverity.INFO
        : AuditSeverity.INFO;

  await logAuditEvent({
    tableName: "authentication", // Virtual table for auth events (Layer 2)
    recordId: undefined, // No specific record for auth events
    eventType: eventTypeMap[event], // Map to semantic event type
    description: `User ${event.replace("_", " ")}: ${details?.email || "unknown"}`,
    category: AuditCategory.AUTHENTICATION,
    severity,
    metadata: {
      event, // Also store in metadata for backward compatibility
      ...details?.metadata,
    },
  });
}

/**
 * Log booking lifecycle events
 * @param bookingId - Booking UUID
 * @param action - Booking action
 * @param details - Business context
 */
export async function logBookingEvent(
  bookingId: string,
  action: "created" | "updated" | "cancelled" | "checked_in" | "checked_out",
  details: {
    oldStatus?: string;
    newStatus?: string;
    reason?: string;
    amount?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  // Map action to AuditEventType (only for specific business events)
  const eventTypeMap: Partial<Record<typeof action, AuditEventType>> = {
    cancelled: AuditEventType.CANCEL_BOOKING,
    checked_in: AuditEventType.BOOKING_CHECKED_IN,
    checked_out: AuditEventType.BOOKING_CHECKED_OUT,
    // Note: 'created' and 'updated' don't have specific event types
  };

  const severity =
    action === "cancelled"
      ? AuditSeverity.WARNING
      : action === "created"
        ? AuditSeverity.INFO
        : AuditSeverity.INFO;

  await logAuditEvent({
    tableName: "bookings",
    recordId: bookingId,
    eventType: eventTypeMap[action], // Map to semantic event type (optional)
    description: `Booking ${action}${details.reason ? `: ${details.reason}` : ""}`,
    category: AuditCategory.BOOKING,
    severity,
    metadata: {
      action, // Also store in metadata for backward compatibility
      oldStatus: details.oldStatus,
      newStatus: details.newStatus,
      amount: details.amount,
      ...details.metadata,
    },
    oldData: details.oldStatus ? { booking_status: details.oldStatus } : undefined,
    newData: details.newStatus ? { booking_status: details.newStatus } : undefined,
  });
}

/**
 * Log payment events
 * @param paymentId - Payment UUID
 * @param action - Payment action
 * @param details - Financial context
 */
export async function logPaymentEvent(
  paymentId: string,
  action: "recorded" | "verified" | "refunded" | "failed",
  details: {
    amount: number;
    paymentMethod: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  // Map action to AuditEventType
  const eventTypeMap: Partial<Record<typeof action, AuditEventType>> = {
    refunded: AuditEventType.REFUND_PAYMENT,
    failed: AuditEventType.PAYMENT_FAILED,
    verified: AuditEventType.PAYMENT_VERIFIED,
    // Note: 'recorded' doesn't have a specific event type
  };

  const severity =
    action === "refunded"
      ? AuditSeverity.WARNING
      : action === "failed"
        ? AuditSeverity.CRITICAL
        : AuditSeverity.INFO;

  await logAuditEvent({
    tableName: "payments",
    recordId: paymentId,
    eventType: eventTypeMap[action], // Map to semantic event type (optional)
    description: `Payment ${action}: ₱${details.amount.toFixed(2)} via ${details.paymentMethod}${details.reason ? ` - ${details.reason}` : ""}`,
    category: AuditCategory.PAYMENT,
    severity,
    metadata: {
      action, // Also store in metadata for backward compatibility
      amount: details.amount,
      paymentMethod: details.paymentMethod,
      currency: "PHP",
      reason: details.reason,
      ...details.metadata,
    },
  });
}

/**
 * Log expense tracking events
 * @param expenseId - Expense UUID
 * @param action - Expense action
 * @param details - Expense context
 */
export async function logExpenseEvent(
  expenseId: string,
  action: "created" | "updated" | "deleted" | "category_changed",
  details: {
    amount: number;
    category: string;
    description: string;
    oldCategory?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  // Map action to AuditEventType
  const eventTypeMap: Partial<Record<typeof action, AuditEventType>> = {
    deleted: AuditEventType.EXPENSE_DELETED,
    category_changed: AuditEventType.EXPENSE_CATEGORY_CHANGED,
    // Note: 'created' and 'updated' don't have specific event types
  };

  const severity = action === "deleted" ? AuditSeverity.WARNING : AuditSeverity.INFO;

  await logAuditEvent({
    tableName: "expenses",
    recordId: expenseId,
    eventType: eventTypeMap[action], // Map to semantic event type (optional)
    description: `Expense ${action}: ${details.description} - ₱${details.amount.toFixed(2)}`,
    category: AuditCategory.EXPENSE,
    severity,
    metadata: {
      action, // Also store in metadata for backward compatibility
      amount: details.amount,
      expenseCategory: details.category,
      oldCategory: details.oldCategory,
      currency: "PHP",
      ...details.metadata,
    },
  });
}

/**
 * Log critical system operations
 * @param operation - System operation type
 * @param details - Operation context
 */
export async function logSystemEvent(
  operation: "migration" | "config_change" | "backup" | "other",
  details: {
    description: string;
    severity?: AuditSeverity;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  // Map operation to AuditEventType
  const eventTypeMap: Record<typeof operation, AuditEventType | undefined> = {
    migration: AuditEventType.SYSTEM_MIGRATION,
    config_change: AuditEventType.SYSTEM_CONFIG_CHANGE,
    backup: AuditEventType.SYSTEM_BACKUP,
    other: undefined, // No specific event type for generic operations
  };

  await logAuditEvent({
    tableName: "system", // Virtual table for system events (Layer 2)
    recordId: undefined, // No specific record for system events
    eventType: eventTypeMap[operation], // Map to semantic event type (optional)
    description: `System: ${details.description}`,
    category: AuditCategory.SYSTEM,
    severity: details.severity || AuditSeverity.INFO,
    metadata: {
      operation,
      ...details.metadata,
    },
  });
}

// ============================================
// BULK LOGGING HELPERS
// ============================================

/**
 * Log multiple audit events in sequence
 * Useful for batch operations
 *
 * @param contexts - Array of audit event contexts
 * @returns Array of results (success/failure for each)
 */
export async function logAuditEvents(
  contexts: AuditEventContext[]
): Promise<Array<{ success: boolean; error?: string }>> {
  const results = [];
  for (const context of contexts) {
    const result = await logAuditEvent(context);
    results.push(result);
  }
  return results;
}

// ============================================
// USER CONTEXT UTILITIES
// ============================================

/**
 * Get current user context for audit logging
 * Extracts user information from Supabase Auth
 *
 * @returns User context object or null
 */
export async function getCurrentUserContext(): Promise<{
  userId: string | null;
  email: string | null;
} | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email || null,
    };
  } catch (error) {
    console.error("[Audit] Failed to get user context:", error);
    return null;
  }
}

/**
 * Check if current user is an owner (full audit access)
 * @returns true if user is owner
 */
export async function isCurrentUserOwner(): Promise<boolean> {
  const context = await getCurrentUserContext();
  if (!context || !context.email) return false;

  const ownerEmails = import.meta.env.VITE_OWNER_EMAILS?.split(",").map((e) => e.trim()) || [];
  return ownerEmails.includes(context.email);
}
```

## Usage Examples

### Example 1: Booking Cancellation

```typescript
// In your booking cancellation handler
import { logBookingEvent } from "@/lib/audit-logger";

async function handleCancelBooking(booking: Booking, reason: string) {
  // Cancel booking via db helper
  const { error } = await db.bookings.cancel(booking.booking_id);

  if (error) {
    console.error("Failed to cancel booking:", error);
    return;
  }

  // Log audit event with business context
  await logBookingEvent(booking.booking_id, "cancelled", {
    oldStatus: booking.booking_status,
    newStatus: "Cancelled",
    reason,
    amount: booking.total_amount,
    metadata: {
      cancelledBy: "owner",
      refundIssued: true,
    },
  });

  // Trigger will also log the UPDATE automatically (Layer 1)
  // This Layer 2 log adds business context
}
```

### Example 2: Payment Recording

```typescript
// In your payment form submission
import { logPaymentEvent } from "@/lib/audit-logger";

async function recordPayment(paymentData: PaymentFormData) {
  // Create payment record
  const { data: payment, error } = await db.payments.create(paymentData);

  if (error || !payment) {
    console.error("Failed to record payment:", error);
    return;
  }

  // Log payment audit event
  await logPaymentEvent(payment.payment_id, "recorded", {
    amount: payment.payment_amount,
    paymentMethod: payment.payment_method,
    metadata: {
      bookingId: payment.booking_id,
      paymentDate: payment.payment_date,
    },
  });

  console.log("Payment recorded and logged to audit trail");
}
```

### Example 3: Authentication Logging

```typescript
// In your login handler
import { logAuthEvent } from "@/lib/audit-logger";

async function handleLogin(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Log failed login attempt
    await logAuthEvent("login_failed", {
      email,
      reason: error.message,
    });
    return { success: false, error };
  }

  // Log successful login
  await logAuthEvent("login", { email });
  return { success: true, data };
}
```

### Example 4: Bulk Expense Import

```typescript
// When importing multiple expenses
import { logAuditEvents } from "@/lib/audit-logger";

async function importExpenses(expenses: ExpenseData[]) {
  const auditContexts: AuditEventContext[] = expenses.map((expense) => ({
    tableName: "expenses",
    recordId: expense.expense_id,
    action: "INSERT",
    description: `Imported expense: ${expense.expense_description}`,
    category: AuditCategory.EXPENSE,
    severity: AuditSeverity.INFO,
    metadata: {
      importedAt: new Date().toISOString(),
      importBatch: "2024-01-15",
    },
  }));

  const results = await logAuditEvents(auditContexts);

  const successCount = results.filter((r) => r.success).length;
  console.log(`Logged ${successCount}/${expenses.length} expense imports to audit trail`);
}
```

### Example 5: Critical System Operation

```typescript
// When performing database migration or system config change
import { logSystemEvent } from "@/lib/audit-logger";

async function performDatabaseMigration() {
  await logSystemEvent("migration", {
    description: "Database migration started",
    severity: AuditSeverity.CRITICAL,
    metadata: {
      migrationVersion: "v2.5.0",
      backupCreated: true,
    },
  });

  // Perform migration...

  await logSystemEvent("migration", {
    description: "Database migration completed",
    severity: AuditSeverity.INFO,
    metadata: {
      migrationVersion: "v2.5.0",
      duration: "2.3s",
    },
  });
}
```

## Integration with Existing Code

### Where to Add Audit Logging

#### High Priority (Always Log)

- ✅ Booking cancellations
- ✅ Payment refunds
- ✅ Manual payment status changes
- ✅ Booking status overrides (staff corrections)
- ✅ Failed login attempts (security)
- ✅ User role changes

#### Medium Priority (Log When Significant)

- ⚠️ Booking creation (if created by staff on behalf of guest)
- ⚠️ Expense category changes
- ⚠️ Unit rate changes
- ⚠️ Guest profile updates with significant changes

#### Low Priority (Trigger Logging Sufficient)

- ℹ️ Routine bookings (automatic processing)
- ℹ️ Automated payment confirmations
- ℹ️ System-generated maintenance logs

### Integration Pattern

```typescript
// Standard pattern for audit logging in mutation handlers

async function performCriticalOperation(data: OperationData) {
  try {
    // 1. Perform database operation
    const { data: result, error } = await db.table.operation(data);

    if (error) {
      // 2a. Log failure
      await logAuditEvent({
        tableName: "table",
        action: "UPDATE",
        description: `Operation failed: ${error.message}`,
        category: AuditCategory.SYSTEM,
        severity: AuditSeverity.WARNING,
      });
      return { error };
    }

    // 2b. Log success with business context
    await logAuditEvent({
      tableName: "table",
      recordId: result.id,
      action: "UPDATE",
      description: "Operation completed successfully",
      category: AuditCategory.BOOKING,
      severity: AuditSeverity.INFO,
      metadata: { ...contextData },
    });

    return { data: result };
  } catch (exception) {
    // 3. Log exception
    console.error("Unexpected error:", exception);
    await logSystemEvent(`Exception in operation: ${exception}`, {
      severity: AuditSeverity.CRITICAL,
    });
    throw exception;
  }
}
```

## Security Considerations

### XSS Protection

**Sanitization happens at the UI rendering layer** (Phase 3b: Table Component), not during logging:

- **Audit logger**: Stores descriptions raw (separation of concerns)
- **UI components**: Use DOMPurify when rendering user-provided text
- **Why this approach**: Cleaner architecture, avoids browser-only dependencies in logger

See [Phase 3b: Table Component](../03-audit-viewer-ui/03b-table-component.md) for DOMPurify usage examples.

```typescript
// Example in UI component (not in audit logger):
import DOMPurify from "dompurify";

<div dangerouslySetInnerHTML={{
  __html: DOMPurify.sanitize(log.description)
}} />
```

### Sensitive Data Redaction

Sensitive fields are automatically redacted using the `SENSITIVE_FIELDS` configuration:

```typescript
// Input: { guest_phone: '+63 912 345 6789', guest_name: 'John Doe' }
// Output: { guest_phone: '[REDACTED]', guest_name: 'John Doe' }
```

### Non-Blocking Errors

Audit logging failures never break application functionality:

```typescript
// Even if audit logging fails, the booking still gets cancelled
try {
  await db.bookings.cancel(id);
  await logBookingEvent(id, "cancelled", { ... }); // May fail silently
} catch (error) {
  // App continues working
}
```

## Testing the Logger

### Manual Test Script

```typescript
// src/scripts/test-audit-logger.ts
import { logAuditEvent, logBookingEvent, logPaymentEvent, logAuthEvent } from "@/lib/audit-logger";
import { AuditCategory, AuditSeverity } from "../../database.types";

async function testAuditLogger() {
  console.log("Testing audit logger...\n");

  // Test 1: Basic audit event
  console.log("1. Basic audit event:");
  const result1 = await logAuditEvent({
    tableName: "bookings",
    action: "UPDATE",
    description: "Test audit log",
    category: AuditCategory.BOOKING,
  });
  console.log(`  ${result1.success ? "✓" : "✗"} Result:`, result1);

  // Test 2: Booking event
  console.log("\n2. Booking cancellation:");
  await logBookingEvent("test-booking-id", "cancelled", {
    oldStatus: "Confirmed",
    newStatus: "Cancelled",
    reason: "Test cancellation",
  });
  console.log("  ✓ Booking event logged");

  // Test 3: Payment event
  console.log("\n3. Payment recording:");
  await logPaymentEvent("test-payment-id", "recorded", {
    amount: 5000,
    paymentMethod: "GCash",
  });
  console.log("  ✓ Payment event logged");

  // Test 4: Auth event
  console.log("\n4. Authentication event:");
  await logAuthEvent("login", { email: "test@resort.com" });
  console.log("  ✓ Auth event logged");

  console.log("\n✅ All audit logger tests completed!");
}

testAuditLogger().catch(console.error);
```

## Troubleshooting

### Problem: Audit logs not being created

**Diagnosis:**

```typescript
// Enable debug logging in .env.local
VITE_AUDIT_DEBUG = true;
```

Check browser console for `[AUDIT DEBUG]` messages.

**Common causes:**

1. User not authenticated (Supabase Auth not initialized)
2. Table name misspelled or not in `AUDITED_TABLES`
3. Database connection error

### Problem: Sensitive data appearing in logs

**Solution:** Verify `SENSITIVE_FIELDS` configuration includes the field:

```typescript
// src/lib/audit-constants.ts
export const SENSITIVE_FIELDS = {
  guests: [
    "guest_phone", // Add missing fields here
    "guest_email",
    // ...
  ],
};
```

### Problem: XSS in audit descriptions

This should never happen due to DOMPurify sanitization, but if you see HTML rendering:

**Solution:** Ensure DOMPurify is installed and imported correctly:

```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

## Next Steps

**Next**: [Phase 2d - React Hooks and Store](./02d-react-hooks-and-store.md)

Phase 2d will create TanStack Query hooks and a Zustand store for fetching and managing audit logs in the React application.

---

**Audit Logger Checklist:**

- [ ] `src/lib/audit-logger.ts` created
- [ ] DOMPurify installed for sanitization
- [ ] Test script runs successfully
- [ ] Sensitive data redaction working
- [ ] Non-blocking error handling verified
- [ ] Debug logging available in development
