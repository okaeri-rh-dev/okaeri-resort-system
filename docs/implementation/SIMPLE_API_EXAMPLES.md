# Simple API Examples for Family Resort

## Overview

This document provides practical API examples for a family resort system using
**simple application-level filtering** instead of complex RLS. All examples use
Drizzle ORM with TypeScript for type safety.

## Project Structure

```
/src
  /services         # Business logic with simple filtering
  /api             # API routes
  /lib/db          # Database connection and schema
  /types           # TypeScript types
```

## Database Connection Setup

```typescript
// src/lib/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Good for family resort scale
  idleTimeoutMillis: 30000,
});

export const db = drizzle(pool, { schema });
```

## Service Layer Examples

### Booking Service

```typescript
// src/services/booking.service.ts
import { db } from "@/lib/db";
import { bookings, payments } from "@/lib/db/schema";
import { eq, and, gte, lte, desc, not } from "drizzle-orm";
import { startOfDay, endOfDay } from "date-fns";

export class BookingService {
  // Get all bookings for a resort
  async getResortBookings(resortId: string) {
    return db.query.bookings.findMany({
      where: eq(bookings.projectId, resortId),
      with: {
        payments: true,
        guest: true,
      },
      orderBy: [desc(bookings.checkInDate)],
    });
  }

  // Get today's activity
  async getTodayActivity(resortId: string) {
    const today = new Date();
    const dayStart = startOfDay(today);
    const dayEnd = endOfDay(today);

    const [checkIns, checkOuts, inHouse] = await Promise.all([
      // Today's check-ins
      db.query.bookings.findMany({
        where: and(
          eq(bookings.projectId, resortId),
          eq(bookings.checkInDate, dayStart),
          not(eq(bookings.status, "cancelled"))
        ),
      }),

      // Today's check-outs
      db.query.bookings.findMany({
        where: and(
          eq(bookings.projectId, resortId),
          eq(bookings.checkOutDate, dayStart),
          eq(bookings.status, "checked_in")
        ),
      }),

      // Currently in-house
      db.query.bookings.findMany({
        where: and(
          eq(bookings.projectId, resortId),
          eq(bookings.status, "checked_in")
        ),
      }),
    ]);

    return {
      checkIns,
      checkOuts,
      inHouse,
      summary: {
        checkInsCount: checkIns.length,
        checkOutsCount: checkOuts.length,
        inHouseCount: inHouse.length,
      },
    };
  }

  // Check availability
  async checkAvailability(
    resortId: string,
    roomType: string,
    checkIn: Date,
    checkOut: Date
  ) {
    // Get total rooms of this type
    const totalRooms = await db.query.rooms.findMany({
      where: and(
        eq(rooms.projectId, resortId),
        eq(rooms.roomType, roomType),
        eq(rooms.isActive, true)
      ),
    });

    // Get conflicting bookings
    const bookedRooms = await db.query.bookings.findMany({
      where: and(
        eq(bookings.projectId, resortId),
        eq(bookings.roomType, roomType),
        not(eq(bookings.status, "cancelled")),
        // Date overlap check
        lte(bookings.checkInDate, checkOut),
        gte(bookings.checkOutDate, checkIn)
      ),
    });

    return {
      roomType,
      totalRooms: totalRooms.length,
      bookedRooms: bookedRooms.length,
      availableRooms: totalRooms.length - bookedRooms.length,
      isAvailable: totalRooms.length > bookedRooms.length,
    };
  }

  // Create booking
  async createBooking(resortId: string, userId: string, data: BookingInput) {
    // Generate booking code
    const bookingCode = await this.generateBookingCode(resortId);

    // Create booking
    const [booking] = await db
      .insert(bookings)
      .values({
        projectId: resortId,
        bookingCode,
        guestName: data.guestName,
        guestPhone: data.guestPhone,
        guestEmail: data.guestEmail,
        checkInDate: data.checkInDate,
        checkOutDate: data.checkOutDate,
        roomType: data.roomType,
        numberOfGuests: data.numberOfGuests,
        totalAmount: data.totalAmount,
        status: "confirmed",
        createdBy: userId,
        createdAt: new Date(),
      })
      .returning();

    // Log the action
    await this.logAction(resortId, userId, "booking_created", booking.id);

    return booking;
  }

  // Helper: Generate unique booking code
  private async generateBookingCode(resortId: string): Promise<string> {
    const prefix = "BK";
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");

    // Get count of bookings this month
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const monthlyBookings = await db.query.bookings.findMany({
      where: and(
        eq(bookings.projectId, resortId),
        gte(bookings.createdAt, monthStart),
        lte(bookings.createdAt, monthEnd)
      ),
    });

    const sequence = (monthlyBookings.length + 1).toString().padStart(4, "0");
    return `${prefix}${year}${month}${sequence}`;
  }

  // Helper: Log actions
  private async logAction(
    resortId: string,
    userId: string,
    action: string,
    entityId: string
  ) {
    await db.insert(auditLogs).values({
      projectId: resortId,
      userId,
      action,
      entityId,
      timestamp: new Date(),
    });
  }
}
```

### Financial Service

```typescript
// src/services/financial.service.ts
import { db } from "@/lib/db";
import { payments, expenses, income } from "@/lib/db/schema";
import { eq, and, gte, lte, sum, desc } from "drizzle-orm";
import { startOfMonth, endOfMonth } from "date-fns";

export class FinancialService {
  // Get monthly summary
  async getMonthlySummary(resortId: string, year: number, month: number) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = endOfMonth(monthStart);

    // Get income
    const incomeData = await db
      .select({
        total: sum(payments.amount),
        count: count(payments.id),
      })
      .from(payments)
      .where(
        and(
          eq(payments.projectId, resortId),
          gte(payments.paidAt, monthStart),
          lte(payments.paidAt, monthEnd),
          eq(payments.status, "completed")
        )
      );

    // Get expenses by category
    const expenseData = await db
      .select({
        category: expenses.category,
        total: sum(expenses.amount),
        count: count(expenses.id),
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.projectId, resortId),
          gte(expenses.date, monthStart),
          lte(expenses.date, monthEnd),
          eq(expenses.status, "approved")
        )
      )
      .groupBy(expenses.category);

    const totalExpenses = expenseData.reduce(
      (sum, e) => sum + Number(e.total || 0),
      0
    );

    return {
      period: { year, month },
      income: {
        total: Number(incomeData[0]?.total || 0),
        transactionCount: incomeData[0]?.count || 0,
      },
      expenses: {
        byCategory: expenseData,
        total: totalExpenses,
      },
      netProfit: Number(incomeData[0]?.total || 0) - totalExpenses,
    };
  }

  // Record payment
  async recordPayment(resortId: string, userId: string, data: PaymentInput) {
    const [payment] = await db
      .insert(payments)
      .values({
        projectId: resortId,
        bookingId: data.bookingId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber,
        status: data.paymentMethod === "gcash" ? "pending" : "completed",
        paidAt: new Date(),
        recordedBy: userId,
      })
      .returning();

    // Update booking paid amount
    if (data.bookingId) {
      await this.updateBookingPayment(resortId, data.bookingId);
    }

    return payment;
  }

  // Add expense
  async addExpense(resortId: string, userId: string, data: ExpenseInput) {
    const [expense] = await db
      .insert(expenses)
      .values({
        projectId: resortId,
        category: data.category,
        description: data.description,
        amount: data.amount,
        date: data.date || new Date(),
        vendor: data.vendor,
        receiptUrl: data.receiptUrl,
        status: "pending",
        submittedBy: userId,
        createdAt: new Date(),
      })
      .returning();

    return expense;
  }

  // Helper: Update booking payment status
  private async updateBookingPayment(resortId: string, bookingId: string) {
    // Get all payments for this booking
    const bookingPayments = await db.query.payments.findMany({
      where: and(
        eq(payments.projectId, resortId),
        eq(payments.bookingId, bookingId),
        eq(payments.status, "completed")
      ),
    });

    const totalPaid = bookingPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );

    // Update booking
    await db
      .update(bookings)
      .set({
        paidAmount: totalPaid.toString(),
        paymentStatus:
          totalPaid >= Number(booking.totalAmount)
            ? "paid"
            : totalPaid > 0
              ? "partial"
              : "pending",
      })
      .where(and(eq(bookings.id, bookingId), eq(bookings.projectId, resortId)));
  }
}
```

## API Route Examples

### Booking Routes

```typescript
// src/api/bookings.ts
import type { Request, Response } from "express";
import { BookingService } from "@/services/booking.service";
import { validateResortAccess } from "@/middleware/auth";

const bookingService = new BookingService();

export async function getBookings(req: Request, res: Response) {
  try {
    const { resortId } = req.params;
    const { userId } = req.user;

    // Simple access check
    const hasAccess = await validateResortAccess(userId, resortId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    const bookings = await bookingService.getResortBookings(resortId);
    res.json({ bookings });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
}

export async function createBooking(req: Request, res: Response) {
  try {
    const { resortId } = req.params;
    const { userId } = req.user;
    const bookingData = req.body;

    // Validate access
    const hasAccess = await validateResortAccess(userId, resortId, "staff");
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Check availability first
    const availability = await bookingService.checkAvailability(
      resortId,
      bookingData.roomType,
      bookingData.checkInDate,
      bookingData.checkOutDate
    );

    if (!availability.isAvailable) {
      return res.status(400).json({
        error: "No rooms available for selected dates",
      });
    }

    // Create booking
    const booking = await bookingService.createBooking(
      resortId,
      userId,
      bookingData
    );

    res.status(201).json({ booking });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ error: "Failed to create booking" });
  }
}

export async function getTodayActivity(req: Request, res: Response) {
  try {
    const { resortId } = req.params;
    const { userId } = req.user;

    // Validate access
    const hasAccess = await validateResortAccess(userId, resortId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    const activity = await bookingService.getTodayActivity(resortId);
    res.json(activity);
  } catch (error) {
    console.error("Error fetching today activity:", error);
    res.status(500).json({ error: "Failed to fetch activity" });
  }
}
```

### Financial Routes

```typescript
// src/api/financial.ts
import type { Request, Response } from "express";
import { FinancialService } from "@/services/financial.service";
import { validateResortAccess } from "@/middleware/auth";

const financialService = new FinancialService();

export async function getMonthlySummary(req: Request, res: Response) {
  try {
    const { resortId } = req.params;
    const { year, month } = req.query;
    const { userId } = req.user;

    // Validate access (financial data requires higher permission)
    const hasAccess = await validateResortAccess(userId, resortId, "owner");
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    const summary = await financialService.getMonthlySummary(
      resortId,
      Number(year),
      Number(month)
    );

    res.json(summary);
  } catch (error) {
    console.error("Error fetching monthly summary:", error);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
}

export async function recordPayment(req: Request, res: Response) {
  try {
    const { resortId } = req.params;
    const { userId } = req.user;
    const paymentData = req.body;

    // Validate access
    const hasAccess = await validateResortAccess(userId, resortId, "staff");
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    const payment = await financialService.recordPayment(
      resortId,
      userId,
      paymentData
    );

    res.status(201).json({ payment });
  } catch (error) {
    console.error("Error recording payment:", error);
    res.status(500).json({ error: "Failed to record payment" });
  }
}
```

## Middleware Examples

### Simple Authentication

```typescript
// src/middleware/auth.ts
import { db } from "@/lib/db";
import { users, userProjects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import jwt from "jsonwebtoken";

export async function authenticate(req: Request, res: Response, next: Next) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as {
      userId: string;
    };

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.userId),
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid user" });
    }

    req.user = { userId: user.id, email: user.email };
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
}

export async function validateResortAccess(
  userId: string,
  resortId: string,
  requiredRole?: "owner" | "staff" | "viewer"
): Promise<boolean> {
  const access = await db.query.userProjects.findFirst({
    where: and(
      eq(userProjects.userId, userId),
      eq(userProjects.projectId, resortId),
      eq(userProjects.isActive, true)
    ),
  });

  if (!access) return false;

  // Check role if specified
  if (requiredRole) {
    const roleHierarchy = { owner: 3, staff: 2, viewer: 1 };
    const userLevel = roleHierarchy[access.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    return userLevel >= requiredLevel;
  }

  return true;
}
```

## Error Handling

```typescript
// src/middleware/errorHandler.ts
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: Next
) {
  console.error("Error:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    user: req.user?.userId,
  });

  // Handle specific errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation failed",
      details: err.message,
    });
  }

  if (err.name === "UnauthorizedError") {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  // Default error
  res.status(500).json({
    error: "An error occurred",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
}
```

## Testing Examples

```typescript
// src/services/__tests__/booking.service.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { BookingService } from "../booking.service";

describe("BookingService", () => {
  let service: BookingService;
  const testResortId = "test-resort-123";
  const testUserId = "test-user-456";

  beforeEach(() => {
    service = new BookingService();
  });

  describe("getResortBookings", () => {
    it("should return only bookings for specified resort", async () => {
      const bookings = await service.getResortBookings(testResortId);

      expect(bookings).toBeDefined();
      expect(bookings.every((b) => b.projectId === testResortId)).toBe(true);
    });
  });

  describe("checkAvailability", () => {
    it("should correctly identify available rooms", async () => {
      const availability = await service.checkAvailability(
        testResortId,
        "standard",
        new Date("2024-03-01"),
        new Date("2024-03-05")
      );

      expect(availability).toHaveProperty("isAvailable");
      expect(availability.availableRooms).toBeGreaterThanOrEqual(0);
    });
  });

  describe("createBooking", () => {
    it("should create booking with correct resort ID", async () => {
      const bookingData = {
        guestName: "Juan Dela Cruz",
        guestPhone: "09171234567",
        checkInDate: new Date("2024-03-01"),
        checkOutDate: new Date("2024-03-03"),
        roomType: "standard",
        numberOfGuests: 2,
        totalAmount: "5000",
      };

      const booking = await service.createBooking(
        testResortId,
        testUserId,
        bookingData
      );

      expect(booking.projectId).toBe(testResortId);
      expect(booking.guestName).toBe(bookingData.guestName);
      expect(booking.bookingCode).toMatch(/^BK\d{6}$/);
    });
  });
});
```

## Summary

These examples demonstrate:

1. **Simple application-level filtering** - No complex RLS needed
2. **Clear service layer** - Business logic separated from routes
3. **Proper access control** - Check permissions at application level
4. **Type safety** - Full TypeScript with Drizzle ORM
5. **Error handling** - Consistent error responses
6. **Testing** - Unit tests for business logic

This approach is:

- Easy to understand and maintain
- Perfect for family resort scale (1-3 properties)
- Secure through application-level checks
- Performant without RLS overhead
- Testable with standard tools
