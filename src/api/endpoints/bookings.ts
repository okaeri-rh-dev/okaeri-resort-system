/**
 * Bookings API endpoints
 */

import { apiClient } from "@/api/client";
import type { Booking, PaginatedResponse, PaginationParams, FilterParams } from "@/types/common";

export interface BookingFilters extends FilterParams {
  propertyId?: string;
  checkInFrom?: string;
  checkInTo?: string;
  paymentStatus?: string[];
}

export interface CreateBookingPayload {
  propertyId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  status?: "PENDING" | "CONFIRMED" | "CANCELLED";
  source?: string;
  totalAmount: number;
  paidAmount?: number;
  paymentMethod?: string;
  notes?: string;
  specialRequests?: string;
  sendConfirmation?: boolean;
}

export interface UpdateBookingPayload {
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  status?: string;
  totalAmount?: number;
  paidAmount?: number;
  paymentMethod?: string;
  notes?: string;
  specialRequests?: string;
}

export interface BookingStats {
  totalBookings: number;
  confirmedBookings: number;
  todayCheckIns: number;
  todayCheckOuts: number;
  totalRevenue: number;
  totalPaid: number;
  avgStayLength: number;
  avgGuests: number;
}

export const bookingsApi = {
  /**
   * List bookings with filters and pagination
   */
  async list(
    params?: PaginationParams & BookingFilters
  ): Promise<PaginatedResponse<Booking> & { stats: BookingStats }> {
    const response = await apiClient.get<PaginatedResponse<Booking> & { stats: BookingStats }>(
      "/bookings",
      params
    );
    return response.data;
  },

  /**
   * Get booking by ID
   */
  async getById(id: string): Promise<Booking> {
    const response = await apiClient.get<Booking>(`/bookings/${id}`);
    return response.data;
  },

  /**
   * Create new booking
   */
  async create(data: CreateBookingPayload): Promise<Booking> {
    const response = await apiClient.post<Booking>("/bookings/create", data);
    return response.data;
  },

  /**
   * Update existing booking
   */
  async update(id: string, data: UpdateBookingPayload): Promise<Booking> {
    const response = await apiClient.put<Booking>(`/bookings/${id}`, data);
    return response.data;
  },

  /**
   * Cancel booking
   */
  async cancel(id: string): Promise<void> {
    await apiClient.delete(`/bookings/${id}`);
  },

  /**
   * Check in guest
   */
  async checkIn(id: string): Promise<Booking> {
    const response = await apiClient.put<Booking>(`/bookings/${id}`, {
      status: "CHECKED_IN",
    });
    return response.data;
  },

  /**
   * Check out guest
   */
  async checkOut(id: string): Promise<Booking> {
    const response = await apiClient.put<Booking>(`/bookings/${id}`, {
      status: "CHECKED_OUT",
    });
    return response.data;
  },

  /**
   * Import bookings from CSV
   */
  async importCsv(
    file: File,
    options?: {
      onProgress?: (progress: number) => void;
    }
  ): Promise<{
    imported: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
  }> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.upload<{
      imported: number;
      failed: number;
      errors: Array<{ row: number; error: string }>;
    }>("/bookings/import-csv", formData, {
      onProgress: options?.onProgress,
    });

    return response.data;
  },

  /**
   * Check availability for dates
   */
  async checkAvailability(params: {
    propertyId: string;
    checkIn: string;
    checkOut: string;
    excludeBookingId?: string;
  }): Promise<{
    available: boolean;
    conflicts: Booking[];
  }> {
    const response = await apiClient.get<{
      available: boolean;
      conflicts: Booking[];
    }>("/bookings/check-availability", params);
    return response.data;
  },

  /**
   * Get booking calendar data
   */
  async getCalendar(params: { propertyId?: string; month: number; year: number }): Promise<{
    bookings: Array<{
      id: string;
      propertyId: string;
      propertyName: string;
      guestName: string;
      checkIn: string;
      checkOut: string;
      status: string;
    }>;
  }> {
    const response = await apiClient.get<{
      bookings: Array<{
        id: string;
        propertyId: string;
        propertyName: string;
        guestName: string;
        checkIn: string;
        checkOut: string;
        status: string;
      }>;
    }>("/bookings/calendar", params);
    return response.data;
  },
};

export default bookingsApi;
