# Simple Database Guide for Okaeri Resort System

> ✅ **PRIMARY APPROACH - Internal App**
>
> This is the authoritative database guide for the Okaeri Resort System. The
> system uses **application-level filtering** for an internal resort management
> app. No Row-Level Security (RLS) is used - security is handled at the service
> layer.

## Overview

This guide explains the database architecture for a family resort business
managing 1-3 properties. We use a **simple, practical approach** that
prioritizes ease of understanding and maintenance over complex enterprise
features.

## Database Architecture: Simple and Practical

### Primary Approach: Application-Level Filtering

Instead of complex Row-Level Security (RLS), we use **simple application-level
filtering** with Drizzle ORM. This approach is:

- Easy to understand and debug
- Perfect for 1-3 resort properties
- Maintainable by a small team
- No complex database configuration needed

```typescript
// Simple, clear, and secure - our primary approach
export async function getResortBookings(resortId: string) {
  return db.query.bookings.findMany({
    where: eq(bookings.projectId, resortId),
    orderBy: [desc(bookings.checkInDate)],
  });
}
```

### Database Structure

We use a **single schema** with a `project_id` column to separate data between
resorts:

```typescript
// Each table has a project_id column for resort isolation
export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull(), // Identifies which resort
  guestName: varchar("guest_name", { length: 255 }).notNull(),
  checkInDate: date("check_in_date").notNull(),
  checkOutDate: date("check_out_date").notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  // ... other fields
});
```

## Practical Code Examples

### 1. Basic Operations

```typescript
// Get bookings for a specific resort
async function getBookingsForResort(resortId: string) {
  return db.query.bookings.findMany({
    where: eq(bookings.projectId, resortId),
    with: {
      payments: true,
      guest: true,
    },
  });
}

// Add a new expense
async function addExpense(resortId: string, expense: ExpenseData) {
  return db.insert(expenses).values({
    projectId: resortId,
    ...expense,
    createdAt: new Date(),
  });
}

// Get monthly income summary
async function getMonthlyIncome(resortId: string, month: Date) {
  const startDate = startOfMonth(month);
  const endDate = endOfMonth(month);

  return db.query.payments.findMany({
    where: and(
      eq(payments.projectId, resortId),
      gte(payments.paidAt, startDate),
      lte(payments.paidAt, endDate),
      eq(payments.status, "completed")
    ),
  });
}
```

### 2. Common Resort Operations

```typescript
// Check room availability
async function checkAvailability(
  resortId: string,
  checkIn: Date,
  checkOut: Date
) {
  const conflictingBookings = await db.query.bookings.findMany({
    where: and(
      eq(bookings.projectId, resortId),
      not(eq(bookings.status, "cancelled")),
      or(
        // Check-in during existing booking
        and(
          lte(bookings.checkInDate, checkIn),
          gte(bookings.checkOutDate, checkIn)
        ),
        // Check-out during existing booking
        and(
          lte(bookings.checkInDate, checkOut),
          gte(bookings.checkOutDate, checkOut)
        ),
        // Existing booking within new dates
        and(
          gte(bookings.checkInDate, checkIn),
          lte(bookings.checkOutDate, checkOut)
        )
      )
    ),
  });

  return conflictingBookings.length === 0;
}

// Get today's check-ins and check-outs
async function getTodayActivity(resortId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [checkIns, checkOuts] = await Promise.all([
    db.query.bookings.findMany({
      where: and(
        eq(bookings.projectId, resortId),
        eq(bookings.checkInDate, today)
      ),
    }),
    db.query.bookings.findMany({
      where: and(
        eq(bookings.projectId, resortId),
        eq(bookings.checkOutDate, today)
      ),
    }),
  ]);

  return { checkIns, checkOuts };
}
```

### 3. Financial Reports

```typescript
// Simple monthly financial summary
async function getMonthlyFinancialSummary(
  resortId: string,
  year: number,
  month: number
) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  // Get income
  const income = await db
    .select({
      total: sum(payments.amount),
    })
    .from(payments)
    .where(
      and(
        eq(payments.projectId, resortId),
        gte(payments.paidAt, startDate),
        lte(payments.paidAt, endDate),
        eq(payments.status, "completed")
      )
    );

  // Get expenses
  const expenses = await db
    .select({
      category: expenseCategories.name,
      total: sum(expenses.amount),
    })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .where(
      and(
        eq(expenses.projectId, resortId),
        gte(expenses.date, startDate),
        lte(expenses.date, endDate)
      )
    )
    .groupBy(expenseCategories.name);

  return {
    income: income[0]?.total || 0,
    expenses,
    netProfit:
      (income[0]?.total || 0) -
      expenses.reduce((sum, e) => sum + (e.total || 0), 0),
  };
}
```

## User Roles: Keep It Simple

For a family resort, we only need three roles:

1. **Owner** - Full access to everything
2. **Staff** - Manage bookings and daily operations
3. **Viewer** - Read-only access for reports

```typescript
// Simple role checking
async function canUserAccessResort(userId: string, resortId: string) {
  const access = await db.query.userProjects.findFirst({
    where: and(
      eq(userProjects.userId, userId),
      eq(userProjects.projectId, resortId),
      eq(userProjects.isActive, true)
    ),
  });

  return access !== null;
}

// Check specific permission
async function canUserManageBookings(userId: string, resortId: string) {
  const access = await db.query.userProjects.findFirst({
    where: and(
      eq(userProjects.userId, userId),
      eq(userProjects.projectId, resortId),
      inArray(userProjects.role, ["owner", "staff"])
    ),
  });

  return access !== null;
}
```

## Database Migrations: Simple Approach

### Current Migration Structure

✅ **Migration `006_simple_resort_setup.sql` has been created** with:

- Core tables with `project_id` columns for resort separation
- Simple B-tree indexes for performance
- Audit logging table for security tracking
- NO Row-Level Security (RLS) policies

Note: RLS migrations (004 and 005) have been archived to
`/docs/archive/advanced-rls/` as they are not needed for this internal
application.

```sql
-- Simple migration for family resort (to be created)
-- 006_simple_resort_setup.sql

-- Basic tables with project_id for resort separation
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  guest_name VARCHAR(255) NOT NULL,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Simple index for performance
CREATE INDEX idx_bookings_project ON bookings(project_id);
CREATE INDEX idx_bookings_dates ON bookings(project_id, check_in_date, check_out_date);
```

## Files to Be Created (When Needed)

These files are referenced in documentation but don't exist yet. They should be
created **only when actually needed**:

### Future Implementation Files

- `/src/lib/db/rls-helpers.ts` - Helper functions for RLS (create when scaling
  beyond 3 properties)
- `/src/lib/db/rls-context.ts` - RLS context management (create when
  implementing RLS)
- `/api/_lib/db/context.ts` - API context helpers (create when building API
  routes)

**Note**: For now, use the simple application-level filtering shown above. These
files are for future scaling.

## Performance Tips for Small Resorts

### 1. Use Indexes Wisely

```sql
-- Essential indexes for a resort system
CREATE INDEX idx_bookings_project_dates ON bookings(project_id, check_in_date);
CREATE INDEX idx_payments_project_date ON payments(project_id, paid_at);
CREATE INDEX idx_expenses_project_date ON expenses(project_id, date);
```

### 2. Efficient Date Queries

```typescript
// Use date indexes effectively
async function getBookingsInRange(resortId: string, start: Date, end: Date) {
  return db.query.bookings.findMany({
    where: and(
      eq(bookings.projectId, resortId),
      gte(bookings.checkInDate, start),
      lte(bookings.checkInDate, end)
    ),
    // Limit results for performance
    limit: 100,
  });
}
```

### 3. Batch Operations

```typescript
// Process large imports in batches
async function importBookings(resortId: string, bookingData: any[]) {
  const BATCH_SIZE = 50;

  for (let i = 0; i < bookingData.length; i += BATCH_SIZE) {
    const batch = bookingData.slice(i, i + BATCH_SIZE);

    await db.insert(bookings).values(
      batch.map((b) => ({
        ...b,
        projectId: resortId,
      }))
    );

    // Small delay to prevent overwhelming the database
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
```

## Financial Operations

### Complete Financial Schema Documentation

For comprehensive financial database operations including expenses, income,
payments, receipts, and audit trails, see:

**📘 [FINANCIAL_DATABASE_SCHEMA.md](./FINANCIAL_DATABASE_SCHEMA.md)**

This document provides:

- Complete table definitions with Philippine compliance fields
- Practical Drizzle ORM query examples
- Receipt management and OCR integration patterns
- Balance calculations and internal reporting queries
- Cash flow and occupancy rate calculations
- Performance indexes for financial queries

## Advanced Options (Future Consideration)

### When to Consider RLS

Row-Level Security (RLS) is an advanced PostgreSQL feature. Consider it only
when:

- Managing 10+ properties
- Need strict database-level isolation
- Have dedicated database administrator
- Compliance requirements demand it

For 1-3 family resorts, **application-level filtering is sufficient and
recommended**.

### If You Need RLS Later

The existing RLS documentation (`RLS_MULTI_TENANT.md`) provides enterprise-grade
patterns. However, for family resorts, the migration path is:

1. Start with application-level filtering (current approach)
2. Monitor growth and complexity
3. If managing 10+ properties, evaluate RLS benefits
4. Migrate gradually with professional assistance

## Common Patterns for Philippine Resorts

### Handling Philippine Peso

```typescript
// Always use DECIMAL for money
const payments = pgTable("payments", {
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(), // ₱999,999,999.99 max
  // ... other fields
});

// Format for display
function formatPeso(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}
```

### GCash Integration

```typescript
// Simple GCash payment tracking
async function recordGCashPayment(
  resortId: string,
  bookingId: string,
  amount: number,
  referenceNumber: string
) {
  return db.insert(payments).values({
    projectId: resortId,
    bookingId,
    amount: amount.toString(),
    paymentMethod: "gcash",
    referenceNumber,
    status: "pending", // Verify manually or via GCash API
    paidAt: new Date(),
  });
}
```

### Timezone Handling

```typescript
// Always store in UTC, display in Philippine time
function toPhilippineTime(date: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
```

## Security Best Practices

### Simple but Secure

1. **Always filter by project_id** in queries
2. **Validate user access** before operations
3. **Use parameterized queries** (Drizzle does this automatically)
4. **Keep audit logs** for financial transactions

```typescript
// Example: Secure booking update
async function updateBooking(
  userId: string,
  resortId: string,
  bookingId: string,
  updates: Partial<Booking>
) {
  // 1. Check user access
  const hasAccess = await canUserManageBookings(userId, resortId);
  if (!hasAccess) {
    throw new Error("Unauthorized");
  }

  // 2. Update with project_id check
  const result = await db
    .update(bookings)
    .set(updates)
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.projectId, resortId) // Always include project check
      )
    );

  // 3. Log the action
  await db.insert(auditLogs).values({
    userId,
    projectId: resortId,
    action: "booking_updated",
    entityId: bookingId,
    changes: JSON.stringify(updates),
    timestamp: new Date(),
  });

  return result;
}
```

## Summary

This simplified approach provides:

1. **Clear, maintainable code** using Drizzle ORM
2. **Adequate security** through application-level filtering
3. **Good performance** for 1-3 resort properties
4. **Easy debugging** without complex RLS rules
5. **Room to grow** with clear migration path if needed

### Key Principles

- **Start simple** - Use application filtering, not RLS
- **Be consistent** - Always filter by project_id
- **Stay practical** - Don't over-engineer for a family business
- **Focus on reliability** - Simple code is easier to maintain
- **Plan for growth** - But don't implement until needed

### Next Steps

1. Use the simple Drizzle ORM patterns shown above
2. Implement basic role checking (owner/staff/viewer)
3. Add indexes for common query patterns
4. Monitor performance and adjust as needed
5. Consider advanced features only when managing 10+ properties

Remember: **For a family resort with 1-3 properties, simple is better than
complex.**
