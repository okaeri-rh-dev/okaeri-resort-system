/**
 * Booking Repository
 * Handles all booking-related database operations with multi-tenant support
 */

import { and, between, eq, gte, lte, ne, or, sql, desc, asc, like, isNotNull } from "drizzle-orm";
import {
  MultiTenantRepository,
  type FilterCondition,
  type TransactionContext,
} from "./base.repository";
import { createProjectSchema, type ProjectSchema } from "../db/schema/project";
import type { BookingStatus, PaymentStatus } from "../db/schema";

/**
 * Booking entity type (inferred from schema)
 */
export interface Booking {
  id: string;
  bookingCode: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string;
  guestAddress: string | null;
  numberOfGuests: number;
  numberOfChildren: number;
  checkInDate: Date;
  checkOutDate: Date;
  checkInTime: string | null;
  checkOutTime: string | null;
  roomType: string | null;
  roomNumber: string | null;
  basePrice: string;
  additionalCharges: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  depositAmount: string;
  paidAmount: string;
  balanceAmount: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  specialRequests: string | null;
  internalNotes: string | null;
  cancellationReason: string | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  source: string;
  metadata: any;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Booking creation input
 */
export type NewBooking = Omit<Booking, "id" | "createdAt" | "updatedAt">;

/**
 * Booking update input
 */
export type UpdateBooking = Partial<Omit<Booking, "id" | "createdAt">>;

/**
 * Booking availability check parameters
 */
export interface AvailabilityCheckParams {
  checkInDate: Date;
  checkOutDate: Date;
  roomType?: string;
  roomNumber?: string;
  excludeBookingId?: string;
}

/**
 * Booking conflict result
 */
export interface BookingConflict {
  bookingId: string;
  bookingCode: string;
  guestName: string;
  checkInDate: Date;
  checkOutDate: Date;
  roomNumber: string | null;
  roomType: string | null;
}

/**
 * Booking timeline entry
 */
export interface BookingTimeline {
  date: Date;
  bookings: Array<{
    id: string;
    bookingCode: string;
    guestName: string;
    status: BookingStatus;
    roomNumber: string | null;
    checkIn: boolean;
    checkOut: boolean;
  }>;
}

/**
 * Booking revenue summary
 */
export interface BookingRevenueSummary {
  totalRevenue: number;
  paidAmount: number;
  pendingAmount: number;
  bookingCount: number;
  averageBookingValue: number;
  occupancyRate: number;
}

/**
 * Booking repository interface
 */
export interface IBookingRepository {
  // Standard CRUD operations (inherited from base)
  findById(id: string, tx?: TransactionContext): Promise<Booking | null>;
  findByBookingCode(code: string, tx?: TransactionContext): Promise<Booking | null>;
  create(data: NewBooking, tx?: TransactionContext): Promise<Booking>;
  update(id: string, data: UpdateBooking, tx?: TransactionContext): Promise<Booking | null>;
  delete(id: string, tx?: TransactionContext): Promise<boolean>;

  // Availability and conflict checks
  checkAvailability(params: AvailabilityCheckParams, tx?: TransactionContext): Promise<boolean>;
  findConflictingBookings(
    params: AvailabilityCheckParams,
    tx?: TransactionContext
  ): Promise<BookingConflict[]>;

  // Complex queries
  findByDateRange(startDate: Date, endDate: Date, tx?: TransactionContext): Promise<Booking[]>;
  findByStatus(status: BookingStatus, tx?: TransactionContext): Promise<Booking[]>;
  findByPaymentStatus(status: PaymentStatus, tx?: TransactionContext): Promise<Booking[]>;
  findUpcomingCheckIns(days: number, tx?: TransactionContext): Promise<Booking[]>;
  findUpcomingCheckOuts(days: number, tx?: TransactionContext): Promise<Booking[]>;
  findOverduePayments(tx?: TransactionContext): Promise<Booking[]>;

  // Timeline and calendar views
  getBookingTimeline(
    startDate: Date,
    endDate: Date,
    tx?: TransactionContext
  ): Promise<BookingTimeline[]>;
  getMonthlyBookingSummary(
    year: number,
    month: number,
    tx?: TransactionContext
  ): Promise<BookingRevenueSummary>;

  // Search functionality
  searchBookings(query: string, tx?: TransactionContext): Promise<Booking[]>;

  // Bulk operations
  bulkUpdateStatus(
    bookingIds: string[],
    status: BookingStatus,
    tx?: TransactionContext
  ): Promise<number>;
  bulkUpdatePaymentStatus(
    bookingIds: string[],
    status: PaymentStatus,
    tx?: TransactionContext
  ): Promise<number>;

  // Philippine-specific queries
  findGcashPayments(tx?: TransactionContext): Promise<Booking[]>;
  calculateVatAmount(bookingId: string, tx?: TransactionContext): Promise<number>;
}

/**
 * Booking repository implementation
 */
export class BookingRepository
  extends MultiTenantRepository<Booking, NewBooking, UpdateBooking>
  implements IBookingRepository
{
  protected table: any;

  constructor(projectId: string) {
    super(projectId);
    // Create schema tables for this project
    const schema = createProjectSchema(this.schemaName);
    this.table = schema.bookings;
  }

  /**
   * Find booking by booking code
   */
  async findByBookingCode(code: string, tx?: TransactionContext): Promise<Booking | null> {
    return this.findOne([{ field: "bookingCode", operator: "eq", value: code }], tx);
  }

  /**
   * Check room availability for given dates
   */
  async checkAvailability(
    params: AvailabilityCheckParams,
    tx?: TransactionContext
  ): Promise<boolean> {
    const conflicts = await this.findConflictingBookings(params, tx);
    return conflicts.length === 0;
  }

  /**
   * Find bookings that conflict with given date range
   */
  async findConflictingBookings(
    params: AvailabilityCheckParams,
    tx?: TransactionContext
  ): Promise<BookingConflict[]> {
    const db = this.getDb(tx);

    // Build conditions for overlapping dates
    const dateOverlapConditions = and(
      lte(this.table.checkInDate, params.checkOutDate),
      gte(this.table.checkOutDate, params.checkInDate),
      ne(this.table.status, "cancelled"),
      ne(this.table.status, "no_show")
    );

    // Add room-specific conditions if provided
    let conditions = dateOverlapConditions;
    if (params.roomNumber) {
      conditions = and(conditions, eq(this.table.roomNumber, params.roomNumber));
    }
    if (params.roomType) {
      conditions = and(conditions, eq(this.table.roomType, params.roomType));
    }
    if (params.excludeBookingId) {
      conditions = and(conditions, ne(this.table.id, params.excludeBookingId));
    }

    const conflicts = await db
      .select({
        bookingId: this.table.id,
        bookingCode: this.table.bookingCode,
        guestName: this.table.guestName,
        checkInDate: this.table.checkInDate,
        checkOutDate: this.table.checkOutDate,
        roomNumber: this.table.roomNumber,
        roomType: this.table.roomType,
      })
      .from(this.table)
      .where(conditions);

    return conflicts as BookingConflict[];
  }

  /**
   * Find bookings within a date range
   */
  async findByDateRange(
    startDate: Date,
    endDate: Date,
    tx?: TransactionContext
  ): Promise<Booking[]> {
    const db = this.getDb(tx);

    const result = await db
      .select()
      .from(this.table)
      .where(
        or(
          between(this.table.checkInDate, startDate, endDate),
          between(this.table.checkOutDate, startDate, endDate),
          and(lte(this.table.checkInDate, startDate), gte(this.table.checkOutDate, endDate))
        )
      )
      .orderBy(asc(this.table.checkInDate));

    return result as Booking[];
  }

  /**
   * Find bookings by status
   */
  async findByStatus(status: BookingStatus, tx?: TransactionContext): Promise<Booking[]> {
    return this.findMany([{ field: "status", operator: "eq", value: status }], tx);
  }

  /**
   * Find bookings by payment status
   */
  async findByPaymentStatus(status: PaymentStatus, tx?: TransactionContext): Promise<Booking[]> {
    return this.findMany([{ field: "paymentStatus", operator: "eq", value: status }], tx);
  }

  /**
   * Find upcoming check-ins within specified days
   */
  async findUpcomingCheckIns(days: number, tx?: TransactionContext): Promise<Booking[]> {
    const db = this.getDb(tx);
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    const result = await db
      .select()
      .from(this.table)
      .where(
        and(between(this.table.checkInDate, today, futureDate), eq(this.table.status, "confirmed"))
      )
      .orderBy(asc(this.table.checkInDate));

    return result as Booking[];
  }

  /**
   * Find upcoming check-outs within specified days
   */
  async findUpcomingCheckOuts(days: number, tx?: TransactionContext): Promise<Booking[]> {
    const db = this.getDb(tx);
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    const result = await db
      .select()
      .from(this.table)
      .where(
        and(
          between(this.table.checkOutDate, today, futureDate),
          eq(this.table.status, "checked_in")
        )
      )
      .orderBy(asc(this.table.checkOutDate));

    return result as Booking[];
  }

  /**
   * Find bookings with overdue payments
   */
  async findOverduePayments(tx?: TransactionContext): Promise<Booking[]> {
    const db = this.getDb(tx);
    const today = new Date();

    const result = await db
      .select()
      .from(this.table)
      .where(
        and(
          lte(this.table.checkInDate, today),
          sql`${this.table.balanceAmount} > 0`,
          or(eq(this.table.paymentStatus, "pending"), eq(this.table.paymentStatus, "partial"))
        )
      )
      .orderBy(desc(this.table.balanceAmount));

    return result as Booking[];
  }

  /**
   * Get booking timeline for calendar view
   */
  async getBookingTimeline(
    startDate: Date,
    endDate: Date,
    tx?: TransactionContext
  ): Promise<BookingTimeline[]> {
    const bookings = await this.findByDateRange(startDate, endDate, tx);

    // Group bookings by date
    const timeline: Map<string, BookingTimeline> = new Map();

    // Initialize dates
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split("T")[0];
      timeline.set(dateKey, {
        date: new Date(currentDate),
        bookings: [],
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Populate bookings for each date
    bookings.forEach((booking) => {
      const checkInKey = booking.checkInDate.toISOString().split("T")[0];
      const checkOutKey = booking.checkOutDate.toISOString().split("T")[0];

      // Add check-in
      if (timeline.has(checkInKey)) {
        timeline.get(checkInKey)!.bookings.push({
          id: booking.id,
          bookingCode: booking.bookingCode,
          guestName: booking.guestName,
          status: booking.status,
          roomNumber: booking.roomNumber,
          checkIn: true,
          checkOut: false,
        });
      }

      // Add check-out
      if (timeline.has(checkOutKey) && checkInKey !== checkOutKey) {
        timeline.get(checkOutKey)!.bookings.push({
          id: booking.id,
          bookingCode: booking.bookingCode,
          guestName: booking.guestName,
          status: booking.status,
          roomNumber: booking.roomNumber,
          checkIn: false,
          checkOut: true,
        });
      }

      // Add for days in between
      const currentDate = new Date(booking.checkInDate);
      currentDate.setDate(currentDate.getDate() + 1);
      while (currentDate < booking.checkOutDate) {
        const dateKey = currentDate.toISOString().split("T")[0];
        if (timeline.has(dateKey)) {
          timeline.get(dateKey)!.bookings.push({
            id: booking.id,
            bookingCode: booking.bookingCode,
            guestName: booking.guestName,
            status: booking.status,
            roomNumber: booking.roomNumber,
            checkIn: false,
            checkOut: false,
          });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    return Array.from(timeline.values());
  }

  /**
   * Get monthly booking and revenue summary
   */
  async getMonthlyBookingSummary(
    year: number,
    month: number,
    tx?: TransactionContext
  ): Promise<BookingRevenueSummary> {
    const db = this.getDb(tx);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month
    const totalDays = endDate.getDate();

    const result = await db
      .select({
        totalRevenue: sql`COALESCE(SUM(${this.table.totalAmount}::numeric), 0)`,
        paidAmount: sql`COALESCE(SUM(${this.table.paidAmount}::numeric), 0)`,
        pendingAmount: sql`COALESCE(SUM(${this.table.balanceAmount}::numeric), 0)`,
        bookingCount: sql`COUNT(*)::int`,
        confirmedBookings: sql`COUNT(CASE WHEN ${this.table.status} = 'confirmed' OR ${this.table.status} = 'checked_in' OR ${this.table.status} = 'checked_out' THEN 1 END)::int`,
        totalRoomNights: sql`SUM(DATE_PART('day', ${this.table.checkOutDate}::timestamp - ${this.table.checkInDate}::timestamp))::int`,
      })
      .from(this.table)
      .where(
        and(
          or(
            between(this.table.checkInDate, startDate, endDate),
            between(this.table.checkOutDate, startDate, endDate)
          ),
          ne(this.table.status, "cancelled")
        )
      );

    const summary = result[0];
    const totalRoomNights = summary.totalRoomNights || 0;
    const maxRoomNights = totalDays * 10; // Assuming 10 rooms (this should be configurable)

    return {
      totalRevenue: parseFloat(summary.totalRevenue as string),
      paidAmount: parseFloat(summary.paidAmount as string),
      pendingAmount: parseFloat(summary.pendingAmount as string),
      bookingCount: summary.bookingCount as number,
      averageBookingValue:
        summary.bookingCount > 0
          ? parseFloat(summary.totalRevenue as string) / (summary.bookingCount as number)
          : 0,
      occupancyRate: maxRoomNights > 0 ? (totalRoomNights / maxRoomNights) * 100 : 0,
    };
  }

  /**
   * Search bookings by guest name, phone, email, or booking code
   */
  async searchBookings(query: string, tx?: TransactionContext): Promise<Booking[]> {
    const db = this.getDb(tx);
    const searchPattern = `%${query}%`;

    const result = await db
      .select()
      .from(this.table)
      .where(
        or(
          like(this.table.guestName, searchPattern),
          like(this.table.guestPhone, searchPattern),
          like(this.table.guestEmail, searchPattern),
          like(this.table.bookingCode, searchPattern)
        )
      )
      .orderBy(desc(this.table.createdAt))
      .limit(50);

    return result as Booking[];
  }

  /**
   * Bulk update booking status
   */
  async bulkUpdateStatus(
    bookingIds: string[],
    status: BookingStatus,
    tx?: TransactionContext
  ): Promise<number> {
    const db = this.getDb(tx);

    const result = await db
      .update(this.table)
      .set({ status, updatedAt: new Date() })
      .where(sql`${this.table.id} = ANY(${bookingIds})`);

    return result.length;
  }

  /**
   * Bulk update payment status
   */
  async bulkUpdatePaymentStatus(
    bookingIds: string[],
    status: PaymentStatus,
    tx?: TransactionContext
  ): Promise<number> {
    const db = this.getDb(tx);

    const result = await db
      .update(this.table)
      .set({ paymentStatus: status, updatedAt: new Date() })
      .where(sql`${this.table.id} = ANY(${bookingIds})`);

    return result.length;
  }

  /**
   * Find bookings with GCash payments
   */
  async findGcashPayments(tx?: TransactionContext): Promise<Booking[]> {
    const db = this.getDb(tx);

    // This would typically join with payments table
    // For now, we'll look for metadata indicating GCash
    const result = await db
      .select()
      .from(this.table)
      .where(sql`${this.table.metadata}->>'paymentMethod' = 'gcash'`)
      .orderBy(desc(this.table.createdAt));

    return result as Booking[];
  }

  /**
   * Calculate VAT amount for Philippine tax compliance
   */
  async calculateVatAmount(bookingId: string, tx?: TransactionContext): Promise<number> {
    const booking = await this.findById(bookingId, tx);
    if (!booking) return 0;

    // Philippine VAT rate is 12%
    const vatRate = 0.12;
    const totalAmount = parseFloat(booking.totalAmount);

    // VAT is already included in the total (VAT-inclusive pricing)
    // To extract VAT: VAT = Total - (Total / 1.12)
    const vatAmount = totalAmount - totalAmount / (1 + vatRate);

    return Math.round(vatAmount * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Generate unique booking code
   */
  async generateBookingCode(tx?: TransactionContext): Promise<string> {
    const prefix = "BK";
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();

    let code = `${prefix}${timestamp}${random}`;

    // Ensure uniqueness
    let exists = await this.exists([{ field: "bookingCode", operator: "eq", value: code }], tx);
    let attempts = 0;

    while (exists && attempts < 10) {
      const newRandom = Math.random().toString(36).substring(2, 6).toUpperCase();
      code = `${prefix}${timestamp}${newRandom}`;
      exists = await this.exists([{ field: "bookingCode", operator: "eq", value: code }], tx);
      attempts++;
    }

    if (exists) {
      throw new Error("Unable to generate unique booking code");
    }

    return code;
  }
}
