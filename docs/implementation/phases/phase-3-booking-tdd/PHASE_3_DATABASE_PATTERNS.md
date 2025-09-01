# Phase 3: Booking System Database Patterns

> **Application-Level Multi-Tenant Patterns for the Booking System**

## Overview

This document provides specific database patterns for implementing the booking
system with application-level multi-tenant isolation. All patterns use explicit
`project_id` filtering rather than Row-Level Security (RLS).

## Core Booking Services

### BookingService Implementation

```typescript
import { db } from "@/lib/db";
import {
  bookings,
  rooms,
  bookingGuests,
  bookingPayments,
} from "@/lib/db/schema";
import { and, eq, gte, lte, ne, or, desc } from "drizzle-orm";
import { ForbiddenError, ConflictError } from "@/lib/errors";

export class BookingService {
  // Base validation for all operations
  private async validateProjectAccess(
    userId: string,
    projectId: string
  ): Promise<void> {
    const access = await db
      .select()
      .from(userProjectRoles)
      .where(
        and(
          eq(userProjectRoles.userId, userId),
          eq(userProjectRoles.projectId, projectId),
          eq(userProjectRoles.isActive, true)
        )
      )
      .limit(1);

    if (!access.length) {
      throw new ForbiddenError(
        `User ${userId} has no access to project ${projectId}`
      );
    }
  }

  // Create a new booking with conflict detection
  async createBooking(
    userId: string,
    projectId: string,
    data: CreateBookingDto
  ): Promise<Booking> {
    // 1. Validate project access
    await this.validateProjectAccess(userId, projectId);

    // 2. Verify room belongs to project
    const room = await db
      .select()
      .from(rooms)
      .where(
        and(
          eq(rooms.id, data.roomId),
          eq(rooms.projectId, projectId) // CRITICAL: Verify ownership
        )
      )
      .limit(1);

    if (!room.length) {
      throw new ForbiddenError("Room not found in project");
    }

    // 3. Check for conflicts
    const hasConflict = await this.checkBookingConflict(
      projectId,
      data.roomId,
      data.checkIn,
      data.checkOut
    );

    if (hasConflict) {
      throw new ConflictError("Room is not available for selected dates");
    }

    // 4. Create booking with transaction
    return await db.transaction(async (tx) => {
      // Insert booking
      const [booking] = await tx
        .insert(bookings)
        .values({
          ...data,
          projectId, // CRITICAL: Always include project_id
          status: "pending",
          createdBy: userId,
          createdAt: new Date(),
        })
        .returning();

      // Insert guests if provided
      if (data.guests?.length) {
        await tx.insert(bookingGuests).values(
          data.guests.map((guest) => ({
            ...guest,
            bookingId: booking.id,
            projectId, // CRITICAL: Include in all related tables
          }))
        );
      }

      // Audit log
      await tx.insert(auditLogs).values({
        projectId,
        userId,
        action: "CREATE_BOOKING",
        tableName: "bookings",
        recordId: booking.id,
        newValues: booking,
        createdAt: new Date(),
      });

      return booking;
    });
  }

  // Get bookings with filtering
  async getBookings(
    userId: string,
    projectId: string,
    filters?: BookingFilters
  ): Promise<Booking[]> {
    await this.validateProjectAccess(userId, projectId);

    const conditions = [
      eq(bookings.projectId, projectId), // CRITICAL: Always first condition
    ];

    // Add optional filters
    if (filters?.status) {
      conditions.push(eq(bookings.status, filters.status));
    }
    if (filters?.roomId) {
      conditions.push(eq(bookings.roomId, filters.roomId));
    }
    if (filters?.startDate) {
      conditions.push(gte(bookings.checkIn, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(bookings.checkOut, filters.endDate));
    }

    return await db
      .select()
      .from(bookings)
      .where(and(...conditions))
      .orderBy(desc(bookings.checkIn))
      .limit(filters?.limit || 100);
  }

  // Update booking with ownership verification
  async updateBooking(
    userId: string,
    projectId: string,
    bookingId: string,
    data: UpdateBookingDto
  ): Promise<Booking> {
    await this.validateProjectAccess(userId, projectId);

    // Prevent project_id modification
    const { projectId: _, ...updateData } = data as any;

    // Update with ownership check
    const [updated] = await db
      .update(bookings)
      .set({
        ...updateData,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.projectId, projectId) // CRITICAL: Verify ownership
        )
      )
      .returning();

    if (!updated) {
      throw new ForbiddenError("Booking not found or access denied");
    }

    return updated;
  }

  // Delete booking with cascade
  async deleteBooking(
    userId: string,
    projectId: string,
    bookingId: string
  ): Promise<void> {
    await this.validateProjectAccess(userId, projectId);

    await db.transaction(async (tx) => {
      // Delete related records first
      await tx
        .delete(bookingGuests)
        .where(
          and(
            eq(bookingGuests.bookingId, bookingId),
            eq(bookingGuests.projectId, projectId)
          )
        );

      await tx
        .delete(bookingPayments)
        .where(
          and(
            eq(bookingPayments.bookingId, bookingId),
            eq(bookingPayments.projectId, projectId)
          )
        );

      // Delete booking
      const result = await tx
        .delete(bookings)
        .where(
          and(eq(bookings.id, bookingId), eq(bookings.projectId, projectId))
        );

      if (result.rowCount === 0) {
        throw new ForbiddenError("Booking not found or access denied");
      }

      // Audit log
      await tx.insert(auditLogs).values({
        projectId,
        userId,
        action: "DELETE_BOOKING",
        tableName: "bookings",
        recordId: bookingId,
        createdAt: new Date(),
      });
    });
  }

  // Check for booking conflicts
  private async checkBookingConflict(
    projectId: string,
    roomId: string,
    checkIn: Date,
    checkOut: Date,
    excludeBookingId?: string
  ): Promise<boolean> {
    const conditions = [
      eq(bookings.projectId, projectId),
      eq(bookings.roomId, roomId),
      ne(bookings.status, "cancelled"),
      // Date overlap conditions
      or(
        // New booking's check-in falls within existing booking
        and(lte(bookings.checkIn, checkIn), gt(bookings.checkOut, checkIn)),
        // New booking's check-out falls within existing booking
        and(lt(bookings.checkIn, checkOut), gte(bookings.checkOut, checkOut)),
        // New booking completely encompasses existing booking
        and(gte(bookings.checkIn, checkIn), lte(bookings.checkOut, checkOut))
      ),
    ];

    if (excludeBookingId) {
      conditions.push(ne(bookings.id, excludeBookingId));
    }

    const conflicts = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(...conditions))
      .limit(1);

    return conflicts.length > 0;
  }
}
```

## Availability Service Patterns

### Efficient Availability Checking

```typescript
export class AvailabilityService {
  constructor(private bookingService: BookingService) {}

  // Get availability for multiple rooms
  async getRoomAvailability(
    userId: string,
    projectId: string,
    roomIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<RoomAvailabilityMap> {
    // Validate access
    await this.bookingService.validateProjectAccess(userId, projectId);

    // Verify all rooms belong to project
    const validRooms = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(and(eq(rooms.projectId, projectId), inArray(rooms.id, roomIds)));

    if (validRooms.length !== roomIds.length) {
      throw new ForbiddenError("Some rooms not found in project");
    }

    // Get all bookings in date range
    const bookings = await db
      .select({
        roomId: bookings.roomId,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        status: bookings.status,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.projectId, projectId), // CRITICAL: Project filter
          inArray(bookings.roomId, roomIds),
          ne(bookings.status, "cancelled"),
          // Overlapping date range
          lte(bookings.checkIn, endDate),
          gte(bookings.checkOut, startDate)
        )
      );

    // Build availability map
    const availabilityMap: RoomAvailabilityMap = new Map();

    for (const roomId of roomIds) {
      const roomBookings = bookings.filter((b) => b.roomId === roomId);
      const availability = this.calculateDailyAvailability(
        startDate,
        endDate,
        roomBookings
      );
      availabilityMap.set(roomId, availability);
    }

    return availabilityMap;
  }

  // Calculate daily availability
  private calculateDailyAvailability(
    startDate: Date,
    endDate: Date,
    bookings: Array<{ checkIn: Date; checkOut: Date }>
  ): DailyAvailability[] {
    const availability: DailyAvailability[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const isBooked = bookings.some(
        (booking) =>
          currentDate >= booking.checkIn && currentDate < booking.checkOut
      );

      availability.push({
        date: new Date(currentDate),
        available: !isBooked,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return availability;
  }

  // Get availability summary for calendar view
  async getCalendarAvailability(
    userId: string,
    projectId: string,
    year: number,
    month: number
  ): Promise<CalendarAvailability> {
    await this.bookingService.validateProjectAccess(userId, projectId);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Get room count for project
    const roomCount = await db
      .select({ count: count() })
      .from(rooms)
      .where(and(eq(rooms.projectId, projectId), eq(rooms.isActive, true)));

    // Get booking counts by date
    const bookingCounts = await db
      .select({
        date: sql`DATE(${bookings.checkIn})`,
        count: count(),
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.projectId, projectId),
          ne(bookings.status, "cancelled"),
          gte(bookings.checkIn, startDate),
          lte(bookings.checkIn, endDate)
        )
      )
      .groupBy(sql`DATE(${bookings.checkIn})`);

    return {
      year,
      month,
      totalRooms: roomCount[0].count,
      dailyAvailability: this.buildCalendarDays(
        startDate,
        endDate,
        bookingCounts,
        roomCount[0].count
      ),
    };
  }
}
```

## Transaction Patterns

### Complex Booking Operations

```typescript
export class BookingTransactionService {
  // Create booking with payment
  async createBookingWithPayment(
    userId: string,
    projectId: string,
    bookingData: CreateBookingDto,
    paymentData: CreatePaymentDto
  ): Promise<{ booking: Booking; payment: Payment }> {
    return await db.transaction(async (tx) => {
      // 1. Create booking
      const [booking] = await tx
        .insert(bookings)
        .values({
          ...bookingData,
          projectId, // CRITICAL: Include project_id
          createdBy: userId,
        })
        .returning();

      // 2. Create payment
      const [payment] = await tx
        .insert(bookingPayments)
        .values({
          ...paymentData,
          bookingId: booking.id,
          projectId, // CRITICAL: Include in related tables
          createdBy: userId,
        })
        .returning();

      // 3. Update booking with payment info
      await tx
        .update(bookings)
        .set({
          paidAmount: payment.amount,
          paymentStatus:
            payment.amount >= booking.totalAmount ? "paid" : "partial",
        })
        .where(
          and(
            eq(bookings.id, booking.id),
            eq(bookings.projectId, projectId) // Always verify
          )
        );

      // 4. Audit log
      await tx.insert(auditLogs).values({
        projectId,
        userId,
        action: "CREATE_BOOKING_WITH_PAYMENT",
        tableName: "bookings",
        recordId: booking.id,
        metadata: { paymentId: payment.id },
      });

      return { booking, payment };
    });
  }

  // Cancel booking with refund
  async cancelBookingWithRefund(
    userId: string,
    projectId: string,
    bookingId: string,
    refundAmount: number,
    reason: string
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // 1. Verify booking exists and belongs to project
      const [booking] = await tx
        .select()
        .from(bookings)
        .where(
          and(eq(bookings.id, bookingId), eq(bookings.projectId, projectId))
        )
        .limit(1);

      if (!booking) {
        throw new ForbiddenError("Booking not found");
      }

      // 2. Update booking status
      await tx
        .update(bookings)
        .set({
          status: "cancelled",
          cancellationReason: reason,
          cancelledBy: userId,
          cancelledAt: new Date(),
        })
        .where(
          and(eq(bookings.id, bookingId), eq(bookings.projectId, projectId))
        );

      // 3. Create refund record
      if (refundAmount > 0) {
        await tx.insert(bookingRefunds).values({
          bookingId,
          projectId, // CRITICAL: Include project_id
          amount: refundAmount,
          reason,
          processedBy: userId,
          processedAt: new Date(),
        });
      }

      // 4. Audit log
      await tx.insert(auditLogs).values({
        projectId,
        userId,
        action: "CANCEL_BOOKING",
        tableName: "bookings",
        recordId: bookingId,
        metadata: { refundAmount, reason },
      });
    });
  }
}
```

## Query Optimization Patterns

### Indexed Query Patterns

```typescript
// Pattern 1: Always use project_id as first condition for index usage
const bookings = await db
  .select()
  .from(bookings)
  .where(
    and(
      eq(bookings.projectId, projectId), // First for index
      gte(bookings.checkIn, startDate),
      lte(bookings.checkOut, endDate)
    )
  );

// Pattern 2: Use covering indexes for common queries
// Index: CREATE INDEX idx_bookings_project_status_dates
//        ON bookings(project_id, status, check_in, check_out)
//        INCLUDE (guest_name, total_amount);
const upcomingBookings = await db
  .select({
    id: bookings.id,
    guestName: bookings.guestName,
    checkIn: bookings.checkIn,
    checkOut: bookings.checkOut,
    totalAmount: bookings.totalAmount,
  })
  .from(bookings)
  .where(
    and(
      eq(bookings.projectId, projectId),
      eq(bookings.status, "confirmed"),
      gte(bookings.checkIn, new Date())
    )
  )
  .orderBy(bookings.checkIn)
  .limit(10);

// Pattern 3: Batch operations with project validation
const batchUpdateStatus = async (
  projectId: string,
  bookingIds: string[],
  newStatus: BookingStatus
) => {
  // First verify all bookings belong to project
  const validBookings = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(eq(bookings.projectId, projectId), inArray(bookings.id, bookingIds))
    );

  if (validBookings.length !== bookingIds.length) {
    throw new ForbiddenError("Some bookings not found in project");
  }

  // Then perform batch update
  return await db
    .update(bookings)
    .set({ status: newStatus })
    .where(
      and(eq(bookings.projectId, projectId), inArray(bookings.id, bookingIds))
    );
};
```

## Service Layer Validation Patterns

### Input Validation with Project Context

```typescript
export class BookingValidationService {
  // Validate booking dates
  async validateBookingDates(
    projectId: string,
    checkIn: Date,
    checkOut: Date
  ): Promise<void> {
    // Check minimum stay requirements
    const project = await db
      .select({ minStay: projects.minStayDays })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    const nights = differenceInDays(checkOut, checkIn);
    if (nights < project[0].minStay) {
      throw new ValidationError(`Minimum stay is ${project[0].minStay} nights`);
    }

    // Check maximum advance booking
    const maxAdvanceDays = 365;
    if (differenceInDays(checkIn, new Date()) > maxAdvanceDays) {
      throw new ValidationError(
        `Cannot book more than ${maxAdvanceDays} days in advance`
      );
    }
  }

  // Validate room capacity
  async validateRoomCapacity(
    projectId: string,
    roomId: string,
    guestCount: number
  ): Promise<void> {
    const room = await db
      .select({ capacity: rooms.capacity })
      .from(rooms)
      .where(and(eq(rooms.id, roomId), eq(rooms.projectId, projectId)))
      .limit(1);

    if (!room.length) {
      throw new ForbiddenError("Room not found in project");
    }

    if (guestCount > room[0].capacity) {
      throw new ValidationError(`Room capacity is ${room[0].capacity} guests`);
    }
  }

  // Validate pricing
  async validatePricing(
    projectId: string,
    roomId: string,
    checkIn: Date,
    checkOut: Date,
    quotedPrice: number
  ): Promise<void> {
    const calculatedPrice = await this.calculatePrice(
      projectId,
      roomId,
      checkIn,
      checkOut
    );

    // Allow small variance for currency conversion
    const variance = Math.abs(calculatedPrice - quotedPrice);
    if (variance > 0.01) {
      throw new ValidationError("Price mismatch detected");
    }
  }
}
```

## Testing Patterns for Booking System

### Unit Tests with Project Isolation

```typescript
describe("BookingService", () => {
  let service: BookingService;
  let testProjectId: string;
  let testUserId: string;

  beforeEach(async () => {
    // Setup test project and user
    testProjectId = "test-project-" + Date.now();
    testUserId = "test-user-" + Date.now();

    await db.insert(projects).values({
      id: testProjectId,
      name: "Test Resort",
    });

    await db.insert(userProjectRoles).values({
      userId: testUserId,
      projectId: testProjectId,
      role: "admin",
    });

    service = new BookingService();
  });

  afterEach(async () => {
    // Cleanup in reverse order of foreign keys
    await db
      .delete(bookingPayments)
      .where(eq(bookingPayments.projectId, testProjectId));
    await db
      .delete(bookingGuests)
      .where(eq(bookingGuests.projectId, testProjectId));
    await db.delete(bookings).where(eq(bookings.projectId, testProjectId));
    await db.delete(rooms).where(eq(rooms.projectId, testProjectId));
    await db
      .delete(userProjectRoles)
      .where(eq(userProjectRoles.projectId, testProjectId));
    await db.delete(projects).where(eq(projects.id, testProjectId));
  });

  describe("createBooking", () => {
    it("should include project_id in booking", async () => {
      const roomId = await createTestRoom(testProjectId);

      const booking = await service.createBooking(testUserId, testProjectId, {
        roomId,
        guestName: "John Doe",
        checkIn: new Date("2024-06-01"),
        checkOut: new Date("2024-06-03"),
      });

      expect(booking.projectId).toBe(testProjectId);
    });

    it("should prevent creating booking in wrong project", async () => {
      const otherProjectId = "other-project";
      const roomId = await createTestRoom(otherProjectId);

      await expect(
        service.createBooking(testUserId, testProjectId, {
          roomId, // Room from different project
          guestName: "John Doe",
          checkIn: new Date("2024-06-01"),
          checkOut: new Date("2024-06-03"),
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("should detect booking conflicts", async () => {
      const roomId = await createTestRoom(testProjectId);

      // Create first booking
      await service.createBooking(testUserId, testProjectId, {
        roomId,
        guestName: "John Doe",
        checkIn: new Date("2024-06-01"),
        checkOut: new Date("2024-06-03"),
      });

      // Attempt overlapping booking
      await expect(
        service.createBooking(testUserId, testProjectId, {
          roomId,
          guestName: "Jane Doe",
          checkIn: new Date("2024-06-02"),
          checkOut: new Date("2024-06-04"),
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("getBookings", () => {
    it("should only return bookings from specified project", async () => {
      // Create bookings in multiple projects
      const booking1 = await createTestBooking(testProjectId);
      const booking2 = await createTestBooking("other-project");

      const bookings = await service.getBookings(testUserId, testProjectId);

      expect(bookings).toHaveLength(1);
      expect(bookings[0].id).toBe(booking1.id);
      expect(bookings).not.toContainEqual(
        expect.objectContaining({ id: booking2.id })
      );
    });
  });
});
```

### Integration Tests for Availability

```typescript
describe("AvailabilityService Integration", () => {
  it("should calculate availability across multiple rooms", async () => {
    const projectId = await setupTestProject();
    const roomIds = await createTestRooms(projectId, 3);

    // Create some bookings
    await createBooking(projectId, roomIds[0], "2024-06-01", "2024-06-03");
    await createBooking(projectId, roomIds[1], "2024-06-02", "2024-06-04");

    const availability = await availabilityService.getRoomAvailability(
      userId,
      projectId,
      roomIds,
      new Date("2024-06-01"),
      new Date("2024-06-05")
    );

    // Room 0 should be unavailable on June 1-2
    expect(availability.get(roomIds[0])[0].available).toBe(false);
    expect(availability.get(roomIds[0])[1].available).toBe(false);
    expect(availability.get(roomIds[0])[2].available).toBe(true);

    // Room 2 should be fully available
    expect(availability.get(roomIds[2]).every((day) => day.available)).toBe(
      true
    );
  });
});
```

## Performance Monitoring

### Query Performance Tracking

```typescript
export class BookingPerformanceMonitor {
  static async trackBookingQuery<T>(
    operation: string,
    projectId: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();

    try {
      const result = await queryFn();
      const duration = performance.now() - startTime;

      // Log slow queries
      if (duration > 100) {
        console.warn(`Slow booking query: ${operation}`, {
          projectId,
          duration,
          timestamp: new Date(),
        });

        // Record in database for analysis
        await db.insert(performanceMetrics).values({
          projectId,
          operation,
          duration,
          category: "booking",
          timestamp: new Date(),
        });
      }

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      // Log failed queries
      console.error(`Failed booking query: ${operation}`, {
        projectId,
        duration,
        error: error.message,
      });

      throw error;
    }
  }
}
```

## Summary

The booking system implements multi-tenant isolation through:

1. **Explicit project_id filtering** in every query
2. **Service-layer validation** before all operations
3. **Transaction-scoped operations** for data consistency
4. **Comprehensive audit logging** for compliance
5. **Performance monitoring** for optimization

Key patterns to follow:

- Always validate project access first
- Include project_id in all table operations
- Use transactions for complex operations
- Monitor query performance
- Test isolation between projects
