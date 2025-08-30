/**
 * Mock Booking Service
 * Provides realistic booking management behavior for development and testing
 */

import {
  AbstractBaseService,
  ServiceErrors,
  type PaginatedResponse,
  type BaseFilters,
} from "../base.service";
import { MockServiceUtils, DEFAULT_REALISTIC_CONFIG } from "@/lib/test-utils";
import type { MockServiceConfig } from "@/test/types/test-interfaces";
import { getEnvironmentConfig } from "@/test/config/mock-service-config";

/**
 * Booking types
 */
export interface Booking {
  id: string;
  projectId: string;
  propertyId: string;
  roomId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  infants: number;
  status: BookingStatus;
  source: BookingSource;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  notes?: string;
  specialRequests?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show";

export type BookingSource =
  | "direct"
  | "airbnb"
  | "booking.com"
  | "agoda"
  | "walk_in"
  | "phone"
  | "website";

export interface CreateBookingDTO {
  propertyId: string;
  roomId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string | Date;
  checkOut: string | Date;
  adults: number;
  children?: number;
  infants?: number;
  source?: BookingSource;
  totalAmount: number;
  paidAmount?: number;
  notes?: string;
  specialRequests?: string;
}

export interface UpdateBookingDTO extends Partial<CreateBookingDTO> {
  status?: BookingStatus;
}

export interface BookingFilters extends BaseFilters {
  status?: BookingStatus;
  propertyId?: string;
  source?: BookingSource;
  dateRange?: {
    start: string | Date;
    end: string | Date;
  };
  guestName?: string;
}

/**
 * Utility functions (DEPRECATED - replaced with deterministic utils)
 * Kept for backward compatibility during transition
 */
// This function is deprecated - use MockServiceUtils instead
// It remains here temporarily to avoid breaking existing code
async function simulateDelay(minMs: number = 200, maxMs: number = 600): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Mock bookings database
 */
const mockBookings: Booking[] = [
  {
    id: "booking-1",
    projectId: "project-1",
    propertyId: "property-1",
    roomId: "room-1",
    guestName: "Juan Dela Cruz",
    guestEmail: "juan@email.com",
    guestPhone: "+639171234567",
    checkIn: new Date("2025-02-01"),
    checkOut: new Date("2025-02-03"),
    adults: 2,
    children: 0,
    infants: 0,
    status: "confirmed",
    source: "direct",
    totalAmount: 8000,
    paidAmount: 8000,
    currency: "PHP",
    notes: "Anniversary celebration",
    createdAt: new Date("2025-01-15"),
    updatedAt: new Date("2025-01-15"),
  },
  {
    id: "booking-2",
    projectId: "project-1",
    propertyId: "property-1",
    roomId: "room-2",
    guestName: "Maria Santos",
    guestEmail: "maria@email.com",
    guestPhone: "+639181234567",
    checkIn: new Date("2025-02-05"),
    checkOut: new Date("2025-02-07"),
    adults: 1,
    children: 0,
    infants: 0,
    status: "pending",
    source: "airbnb",
    totalAmount: 5000,
    paidAmount: 0,
    currency: "PHP",
    createdAt: new Date("2025-01-20"),
    updatedAt: new Date("2025-01-20"),
  },
  {
    id: "booking-3",
    projectId: "project-1",
    propertyId: "property-1",
    roomId: "room-1",
    guestName: "Pedro Reyes",
    guestEmail: "pedro@email.com",
    guestPhone: "+639191234567",
    checkIn: new Date("2025-01-25"),
    checkOut: new Date("2025-01-27"),
    adults: 2,
    children: 2,
    infants: 0,
    status: "checked_out",
    source: "booking.com",
    totalAmount: 10000,
    paidAmount: 10000,
    currency: "PHP",
    specialRequests: "Extra pillows",
    createdAt: new Date("2025-01-10"),
    updatedAt: new Date("2025-01-27"),
  },
];

/**
 * Mock Booking Service Implementation
 */
export class MockBookingService extends AbstractBaseService<
  Booking,
  CreateBookingDTO,
  UpdateBookingDTO
> {
  private bookings: Booking[] = [...mockBookings];
  private readonly DELAY_MS = { min: 300, max: 600 };
  private readonly utils: MockServiceUtils;
  private readonly config: MockServiceConfig;

  constructor(config?: MockServiceConfig) {
    super();

    // Initialize configuration with fallbacks
    this.config = config || getEnvironmentConfig();
    this.utils = new MockServiceUtils(this.config);

    console.info(
      `[MockBookingService] Initialized with ${this.config.deterministic ? "deterministic" : "non-deterministic"} behavior, error rate: ${this.config.errorRate}`
    );
  }

  /**
   * List bookings with filters and pagination
   */
  async list(filters?: BookingFilters): Promise<PaginatedResponse<Booking>> {
    return this.utils.executeWithSimulation(
      async () => {
        let filtered = [...this.bookings];

        // Apply filters
        if (filters?.status) {
          filtered = filtered.filter((b) => b.status === filters.status);
        }

        if (filters?.propertyId) {
          filtered = filtered.filter((b) => b.propertyId === filters.propertyId);
        }

        if (filters?.source) {
          filtered = filtered.filter((b) => b.source === filters.source);
        }

        if (filters?.guestName) {
          const searchTerm = filters.guestName.toLowerCase();
          filtered = filtered.filter((b) => b.guestName.toLowerCase().includes(searchTerm));
        }

        if (filters?.dateRange) {
          const start = new Date(filters.dateRange.start);
          const end = new Date(filters.dateRange.end);
          filtered = filtered.filter((b) => {
            const checkIn = new Date(b.checkIn);
            return checkIn >= start && checkIn <= end;
          });
        }

        // Sort
        const sortField = filters?.sort || "checkIn";
        const sortOrder = filters?.order || "desc";
        filtered.sort((a, b) => {
          const aVal = (a as any)[sortField];
          const bVal = (b as any)[sortField];
          const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return sortOrder === "asc" ? comparison : -comparison;
        });

        // Paginate
        const { page, limit } = this.normalizePagination(filters);
        const start = (page - 1) * limit;
        const end = start + limit;
        const paginatedData = filtered.slice(start, end);

        return {
          data: paginatedData,
          meta: this.calculatePaginationMeta(filtered.length, page, limit),
        };
      },
      this.DELAY_MS.min,
      this.DELAY_MS.max,
      "networkError"
    );
  }

  /**
   * Get a single booking by ID
   */
  async get(id: string): Promise<Booking> {
    return this.utils.executeWithSimulation(
      async () => {
        const booking = this.bookings.find((b) => b.id === id);
        if (!booking) {
          throw ServiceErrors.NotFound("Booking", id);
        }

        return booking;
      },
      200,
      400,
      "notFoundError"
    );
  }

  /**
   * Search bookings by guest name or email
   */
  async search(query: string, filters?: BookingFilters): Promise<Booking[]> {
    return this.utils.executeWithSimulation(
      async () => {
        const searchTerm = query.toLowerCase();
        let results = this.bookings.filter(
          (b) =>
            b.guestName.toLowerCase().includes(searchTerm) ||
            b.guestEmail.toLowerCase().includes(searchTerm) ||
            b.guestPhone.includes(searchTerm)
        );

        // Apply additional filters
        if (filters?.status) {
          results = results.filter((b) => b.status === filters.status);
        }

        if (filters?.propertyId) {
          results = results.filter((b) => b.propertyId === filters.propertyId);
        }

        return results;
      },
      this.DELAY_MS.min,
      this.DELAY_MS.max,
      "networkError"
    );
  }

  /**
   * Create a new booking
   */
  async create(data: CreateBookingDTO): Promise<Booking> {
    return this.utils.executeWithSimulation(
      async () => {
        // Check for conflicts
        const checkIn = new Date(data.checkIn);
        const checkOut = new Date(data.checkOut);

        const hasConflict = this.bookings.some(
          (b) =>
            b.roomId === data.roomId &&
            b.status !== "cancelled" &&
            this.datesOverlap(b.checkIn, b.checkOut, checkIn, checkOut)
        );

        if (hasConflict) {
          throw ServiceErrors.Conflict("Room is not available for the selected dates");
        }

        // Validate dates
        if (checkIn >= checkOut) {
          throw ServiceErrors.ValidationFailed({
            checkOut: "Check-out date must be after check-in date",
          });
        }

        const newBooking: Booking = {
          id: `booking-${Date.now()}`,
          projectId: "project-1", // Mock project ID
          propertyId: data.propertyId,
          roomId: data.roomId,
          guestName: data.guestName,
          guestEmail: data.guestEmail,
          guestPhone: data.guestPhone,
          checkIn,
          checkOut,
          adults: data.adults,
          children: data.children || 0,
          infants: data.infants || 0,
          status: "pending",
          source: data.source || "direct",
          totalAmount: data.totalAmount,
          paidAmount: data.paidAmount || 0,
          currency: "PHP",
          notes: data.notes,
          specialRequests: data.specialRequests,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        this.bookings.push(newBooking);
        return newBooking;
      },
      this.DELAY_MS.min,
      this.DELAY_MS.max,
      "conflictError"
    );
  }

  /**
   * Update an existing booking
   */
  async update(id: string, data: UpdateBookingDTO): Promise<Booking> {
    return this.utils.executeWithSimulation(
      async () => {
        const bookingIndex = this.bookings.findIndex((b) => b.id === id);
        if (bookingIndex === -1) {
          throw ServiceErrors.NotFound("Booking", id);
        }

        const booking = this.bookings[bookingIndex];

        // Check for conflicts if dates are being changed
        if (data.checkIn || data.checkOut || data.roomId) {
          const checkIn = data.checkIn ? new Date(data.checkIn) : booking.checkIn;
          const checkOut = data.checkOut ? new Date(data.checkOut) : booking.checkOut;
          const roomId = data.roomId || booking.roomId;

          const hasConflict = this.bookings.some(
            (b) =>
              b.id !== id &&
              b.roomId === roomId &&
              b.status !== "cancelled" &&
              this.datesOverlap(b.checkIn, b.checkOut, checkIn, checkOut)
          );

          if (hasConflict) {
            throw ServiceErrors.Conflict("Room is not available for the selected dates");
          }
        }

        const updatedBooking: Booking = {
          ...booking,
          ...data,
          id: booking.id, // Prevent ID change
          projectId: booking.projectId, // Prevent project change
          checkIn: data.checkIn ? new Date(data.checkIn) : booking.checkIn,
          checkOut: data.checkOut ? new Date(data.checkOut) : booking.checkOut,
          updatedAt: new Date(),
        };

        this.bookings[bookingIndex] = updatedBooking;
        return updatedBooking;
      },
      this.DELAY_MS.min,
      this.DELAY_MS.max,
      "conflictError"
    );
  }

  /**
   * Delete a booking
   */
  async delete(id: string): Promise<void> {
    return this.utils.executeWithSimulation(
      async () => {
        const bookingIndex = this.bookings.findIndex((b) => b.id === id);
        if (bookingIndex === -1) {
          throw ServiceErrors.NotFound("Booking", id);
        }

        // Only allow deletion of pending or cancelled bookings
        const booking = this.bookings[bookingIndex];
        if (!["pending", "cancelled"].includes(booking.status)) {
          throw ServiceErrors.ValidationFailed({
            status: "Can only delete pending or cancelled bookings",
          });
        }

        this.bookings.splice(bookingIndex, 1);
      },
      this.DELAY_MS.min,
      this.DELAY_MS.max,
      "validationError"
    );
  }

  /**
   * Check availability for a property
   */
  async checkAvailability(
    propertyId: string,
    checkIn: Date | string,
    checkOut: Date | string
  ): Promise<{ roomId: string; available: boolean }[]> {
    return this.utils.executeWithSimulation(
      async () => {
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);

        // Mock rooms for the property
        const rooms = ["room-1", "room-2", "room-3"];

        return rooms.map((roomId) => {
          const hasBooking = this.bookings.some(
            (b) =>
              b.propertyId === propertyId &&
              b.roomId === roomId &&
              b.status !== "cancelled" &&
              this.datesOverlap(b.checkIn, b.checkOut, checkInDate, checkOutDate)
          );

          return {
            roomId,
            available: !hasBooking,
          };
        });
      },
      200,
      400,
      "networkError"
    );
  }

  /**
   * Get booking statistics
   */
  async getStatistics(propertyId?: string): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    checkedIn: number;
    revenue: number;
  }> {
    return this.utils.executeWithSimulation(
      async () => {
        const filtered = propertyId
          ? this.bookings.filter((b) => b.propertyId === propertyId)
          : this.bookings;

        return {
          total: filtered.length,
          pending: filtered.filter((b) => b.status === "pending").length,
          confirmed: filtered.filter((b) => b.status === "confirmed").length,
          checkedIn: filtered.filter((b) => b.status === "checked_in").length,
          revenue: filtered.reduce((sum, b) => sum + b.paidAmount, 0),
        };
      },
      200,
      400,
      "networkError"
    );
  }

  /**
   * Batch create bookings
   */
  async batchCreate(data: CreateBookingDTO[]): Promise<Booking[]> {
    const results: Booking[] = [];

    for (const dto of data) {
      try {
        const booking = await this.create(dto);
        results.push(booking);
      } catch (error) {
        console.error("Failed to create booking:", error);
      }
    }

    return results;
  }

  /**
   * Batch update bookings
   */
  async batchUpdate(updates: { id: string; data: UpdateBookingDTO }[]): Promise<Booking[]> {
    const results: Booking[] = [];

    for (const { id, data } of updates) {
      try {
        const booking = await this.update(id, data);
        results.push(booking);
      } catch (error) {
        console.error(`Failed to update booking ${id}:`, error);
      }
    }

    return results;
  }

  /**
   * Batch delete bookings
   */
  async batchDelete(ids: string[]): Promise<void> {
    for (const id of ids) {
      try {
        await this.delete(id);
      } catch (error) {
        console.error(`Failed to delete booking ${id}:`, error);
      }
    }
  }

  // Helper methods
  private datesOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && start2 < end1;
  }

  /**
   * Update mock service configuration (for testing)
   */
  public updateConfig(newConfig: MockServiceConfig): void {
    // Update the internal config reference
    Object.assign(this.config, newConfig);
    this.utils.updateConfig(newConfig);
  }

  /**
   * Reset mock service to initial state (for testing)
   */
  public reset(): void {
    this.utils.reset();
    this.bookings = [...mockBookings]; // Reset bookings to original state
  }

  /**
   * Get current configuration (for testing)
   */
  public getConfig(): MockServiceConfig {
    return this.config;
  }
}

export default MockBookingService;
