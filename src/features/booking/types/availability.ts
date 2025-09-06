/**
 * Availability System Type Definitions
 *
 * Types for the availability checking system, including day-level availability,
 * bulk availability checking, and calendar availability views.
 */

// Core availability interfaces
export interface DateRange {
  from: string; // ISO date string
  to: string; // ISO date string
}

export interface DayAvailability {
  date: string; // ISO date string (YYYY-MM-DD)
  available: boolean; // Whether the property is available
  price?: number; // Optional price for the day
  bookingId?: string; // ID of booking that makes it unavailable
  minimumStay?: number; // Minimum stay requirement
  reason?: string; // Reason for unavailability
}

export interface CalendarAvailability {
  year: number;
  month: number;
  properties: Map<string, DayAvailability[]>; // propertyId -> daily availability
  totalDays: number;
}

// Service interfaces that the tests expect
export interface AvailabilityService {
  // Core availability checking
  checkRoomAvailability(
    projectId: string,
    propertyId: string,
    checkIn: Date,
    checkOut: Date
  ): Promise<boolean>;

  // Bulk availability checking
  getBulkAvailability(
    projectId: string,
    propertyIds: string[],
    dateRange: DateRange
  ): Promise<Map<string, DayAvailability[]>>;

  // Calendar view availability
  getCalendarAvailability(
    projectId: string,
    year: number,
    month: number
  ): Promise<CalendarAvailability>;

  // Cache management
  invalidateAvailabilityCache(projectId: string, propertyId: string): Promise<void>;
  invalidateCalendarCache(projectId: string, year: number, month: number): Promise<void>;
  invalidateBulkCache(projectId: string, propertyIds: string[]): Promise<void>;
  warmUpCache(projectId: string, propertyIds: string[], daysAhead: number): Promise<void>;
}

// Booking Service interface for CRUD operations
export interface CreateBookingDto {
  roomId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone: string;
  guestCount: number;
  checkInDate: Date;
  checkOutDate: Date;
  totalAmount: number;
  paidAmount?: number;
  status?: string;
  paymentStatus?: string;
}

export interface UpdateBookingDto extends Partial<CreateBookingDto> {
  id: string;
}

export interface BookingFilters {
  status?: string[];
  dateFrom?: string;
  dateTo?: string;
  guestName?: string;
  roomId?: string;
}

export interface BookingService {
  createBooking(userId: string, projectId: string, data: CreateBookingDto): Promise<Booking>;

  getBookings(userId: string, projectId: string, filters?: BookingFilters): Promise<Booking[]>;

  updateBooking(
    userId: string,
    projectId: string,
    bookingId: string,
    data: UpdateBookingDto
  ): Promise<Booking>;

  deleteBooking(userId: string, projectId: string, bookingId: string): Promise<void>;
}

// Re-export common types from the main types file
export type { Booking, Property, BookingStatus, PaymentStatus } from "@/types/common";
