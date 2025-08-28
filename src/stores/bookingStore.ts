/**
 * Booking management store using Zustand with optimistic updates
 * Handles comprehensive booking operations for the resort system
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { BookingStatus } from "@/types/common";
import type {
  Booking,
  CreateBookingData,
  UpdateBookingData,
  BookingCalendarEvent,
  BookingTimelineData,
  PaginatedResponse,
  FilterParams,
  Property,
} from "@/types/common";
import { apiClient } from "@/api/client";
import { useProjectStore } from "./projectStore";
import { useUIStore } from "./uiStore";

interface BookingState {
  // Bookings data
  bookings: Booking[];
  optimisticBookings: Booking[];
  totalBookings: number;
  currentPage: number;
  pageSize: number;

  // Calendar and timeline views
  calendarEvents: BookingCalendarEvent[];
  timelineData: BookingTimelineData[];

  // Availability
  availability: Map<string, Date[]>; // propertyId -> unavailable dates

  // UI state
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  error: string | null;
  lastFetch: number | null;

  // Filters
  filters: FilterParams;
}

interface BookingActions {
  // CRUD operations
  fetchBookings: (params?: FilterParams) => Promise<void>;
  fetchBookingById: (bookingId: string) => Promise<Booking>;
  createBooking: (data: CreateBookingData) => Promise<Booking>;
  updateBooking: (bookingId: string, data: UpdateBookingData) => Promise<void>;
  deleteBooking: (bookingId: string) => Promise<void>;

  // Status management
  checkIn: (bookingId: string) => Promise<void>;
  checkOut: (bookingId: string) => Promise<void>;
  cancelBooking: (bookingId: string, reason?: string) => Promise<void>;
  confirmBooking: (bookingId: string) => Promise<void>;

  // Availability
  checkAvailability: (propertyId: string, checkIn: Date, checkOut: Date) => Promise<boolean>;
  fetchAvailability: (propertyIds: string[], startDate: Date, endDate: Date) => Promise<void>;

  // Guest operations
  linkGuest: (bookingId: string, guestId: string) => Promise<void>;
  unlinkGuest: (bookingId: string) => Promise<void>;

  // Payment tracking
  updatePayment: (bookingId: string, amount: number, method?: string) => Promise<void>;

  // View data
  getCalendarEvents: (startDate: Date, endDate: Date) => void;
  getTimelineData: (startDate: Date, endDate: Date) => void;

  // Optimistic updates
  addOptimisticBooking: (booking: Booking) => void;
  removeOptimisticBooking: (bookingId: string) => void;
  clearOptimisticBookings: () => void;

  // State management
  setBookings: (bookings: Booking[]) => void;
  setFilters: (filters: FilterParams) => void;
  setPagination: (page: number, size: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;

  // Utility
  getBookingById: (bookingId: string) => Booking | undefined;
  getBookingsByProperty: (propertyId: string) => Booking[];
  getBookingsByStatus: (status: BookingStatus) => Booking[];
  getUpcomingCheckIns: (days?: number) => Booking[];
  getUpcomingCheckOuts: (days?: number) => Booking[];
  refreshIfNeeded: () => Promise<void>;
}

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Generate temporary ID for optimistic updates
let tempIdCounter = 0;
const generateTempId = () => `temp-booking-${Date.now()}-${++tempIdCounter}`;

export const useBookingStore = create<BookingState & BookingActions>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        bookings: [],
        optimisticBookings: [],
        totalBookings: 0,
        currentPage: 1,
        pageSize: 20,
        calendarEvents: [],
        timelineData: [],
        availability: new Map(),
        isLoading: false,
        isCreating: false,
        isUpdating: false,
        error: null,
        lastFetch: null,
        filters: {},

        // CRUD operations
        fetchBookings: async (params?: FilterParams) => {
          const { activeProjectId } = useProjectStore.getState();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          set((state) => {
            state.isLoading = true;
            state.error = null;
            if (params) state.filters = params;
          });

          try {
            const response = await apiClient.get<PaginatedResponse<Booking>>(
              `/projects/${activeProjectId}/bookings`,
              {
                page: get().currentPage,
                limit: get().pageSize,
                ...get().filters,
              }
            );

            set((state) => {
              state.bookings = response.data.data;
              state.totalBookings = response.data.meta.total;
              state.lastFetch = Date.now();
              state.isLoading = false;
            });
          } catch (error: any) {
            set((state) => {
              state.isLoading = false;
              state.error = error.message || "Failed to fetch bookings";
            });
            useUIStore.getState().toast.error("Failed to fetch bookings", error.message);
            throw error;
          }
        },

        fetchBookingById: async (bookingId: string) => {
          const { activeProjectId } = useProjectStore.getState();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await apiClient.get<Booking>(
              `/projects/${activeProjectId}/bookings/${bookingId}`
            );
            const booking = response.data;

            set((state) => {
              const index = state.bookings.findIndex((b) => b.id === bookingId);
              if (index !== -1) {
                state.bookings[index] = booking;
              } else {
                state.bookings.push(booking);
              }
              state.isLoading = false;
            });

            return booking;
          } catch (error: any) {
            set((state) => {
              state.isLoading = false;
              state.error = error.message || "Failed to fetch booking";
            });
            useUIStore.getState().toast.error("Failed to fetch booking", error.message);
            throw error;
          }
        },

        createBooking: async (data: CreateBookingData) => {
          const { activeProjectId } = useProjectStore.getState();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          // Create optimistic booking
          const tempId = generateTempId();
          const optimisticBooking: Booking = {
            id: tempId,
            projectId: activeProjectId,
            ...data,
            nights: Math.ceil(
              (new Date(data.checkOut).getTime() - new Date(data.checkIn).getTime()) /
                (1000 * 60 * 60 * 24)
            ),
            status: BookingStatus.PENDING,
            paymentStatus: data.paidAmount
              ? data.paidAmount >= data.totalAmount
                ? ("PAID" as any)
                : ("PARTIAL" as any)
              : ("PENDING" as any),
            paidAmount: data.paidAmount || 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          set((state) => {
            state.isCreating = true;
            state.error = null;
            state.optimisticBookings.unshift(optimisticBooking);
          });

          try {
            const response = await apiClient.post<Booking>(
              `/projects/${activeProjectId}/bookings`,
              data
            );
            const booking = response.data;

            set((state) => {
              // Remove optimistic booking
              state.optimisticBookings = state.optimisticBookings.filter((b) => b.id !== tempId);
              // Add real booking
              state.bookings.unshift(booking);
              state.totalBookings++;
              state.isCreating = false;
            });

            useUIStore.getState().toast.success("Booking created successfully");
            return booking;
          } catch (error: any) {
            set((state) => {
              // Remove optimistic booking on error
              state.optimisticBookings = state.optimisticBookings.filter((b) => b.id !== tempId);
              state.isCreating = false;
              state.error = error.message || "Failed to create booking";
            });
            useUIStore.getState().toast.error("Failed to create booking", error.message);
            throw error;
          }
        },

        updateBooking: async (bookingId: string, data: UpdateBookingData) => {
          const { activeProjectId } = useProjectStore.getState();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          // Store original booking for rollback
          const originalBooking = get().bookings.find((b) => b.id === bookingId);
          if (!originalBooking) {
            throw new Error("Booking not found");
          }

          set((state) => {
            state.isUpdating = true;
            state.error = null;
            // Optimistic update
            const index = state.bookings.findIndex((b) => b.id === bookingId);
            if (index !== -1) {
              state.bookings[index] = { ...state.bookings[index]!, ...data };
            }
          });

          try {
            const response = await apiClient.patch<Booking>(
              `/projects/${activeProjectId}/bookings/${bookingId}`,
              data
            );
            const updatedBooking = response.data;

            set((state) => {
              const index = state.bookings.findIndex((b) => b.id === bookingId);
              if (index !== -1) {
                state.bookings[index] = updatedBooking;
              }
              state.isUpdating = false;
            });

            useUIStore.getState().toast.success("Booking updated successfully");
          } catch (error: any) {
            set((state) => {
              // Rollback on error
              const index = state.bookings.findIndex((b) => b.id === bookingId);
              if (index !== -1) {
                state.bookings[index] = originalBooking;
              }
              state.isUpdating = false;
              state.error = error.message || "Failed to update booking";
            });
            useUIStore.getState().toast.error("Failed to update booking", error.message);
            throw error;
          }
        },

        deleteBooking: async (bookingId: string) => {
          const { activeProjectId } = useProjectStore.getState();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          // Store original booking for rollback
          const originalBooking = get().bookings.find((b) => b.id === bookingId);
          if (!originalBooking) {
            throw new Error("Booking not found");
          }

          set((state) => {
            state.isLoading = true;
            state.error = null;
            // Optimistic delete
            state.bookings = state.bookings.filter((b) => b.id !== bookingId);
            state.totalBookings--;
          });

          try {
            await apiClient.delete(`/projects/${activeProjectId}/bookings/${bookingId}`);

            set((state) => {
              state.isLoading = false;
            });

            useUIStore.getState().toast.success("Booking deleted successfully");
          } catch (error: any) {
            set((state) => {
              // Rollback on error
              state.bookings.push(originalBooking);
              state.totalBookings++;
              state.isLoading = false;
              state.error = error.message || "Failed to delete booking";
            });
            useUIStore.getState().toast.error("Failed to delete booking", error.message);
            throw error;
          }
        },

        // Status management
        checkIn: async (bookingId: string) => {
          await get().updateBooking(bookingId, {
            status: BookingStatus.CHECKED_IN,
          });
        },

        checkOut: async (bookingId: string) => {
          await get().updateBooking(bookingId, {
            status: BookingStatus.CHECKED_OUT,
          });
        },

        cancelBooking: async (bookingId: string, reason?: string) => {
          await get().updateBooking(bookingId, {
            status: BookingStatus.CANCELLED,
            notes: reason ? `Cancellation reason: ${reason}` : undefined,
          });
        },

        confirmBooking: async (bookingId: string) => {
          await get().updateBooking(bookingId, {
            status: BookingStatus.CONFIRMED,
          });
        },

        // Availability
        checkAvailability: async (propertyId: string, checkIn: Date, checkOut: Date) => {
          const { activeProjectId } = useProjectStore.getState();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          try {
            const response = await apiClient.get<{ available: boolean }>(
              `/projects/${activeProjectId}/properties/${propertyId}/availability`,
              {
                checkIn: checkIn.toISOString(),
                checkOut: checkOut.toISOString(),
              }
            );
            return response.data.available;
          } catch (error: any) {
            useUIStore.getState().toast.error("Failed to check availability", error.message);
            throw error;
          }
        },

        fetchAvailability: async (propertyIds: string[], startDate: Date, endDate: Date) => {
          const { activeProjectId } = useProjectStore.getState();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          try {
            const response = await apiClient.post<{
              [propertyId: string]: Date[];
            }>(`/projects/${activeProjectId}/availability`, {
              propertyIds,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
            });

            set((state) => {
              Object.entries(response.data).forEach(([propertyId, dates]) => {
                state.availability.set(
                  propertyId,
                  dates.map((d) => new Date(d))
                );
              });
            });
          } catch (error: any) {
            useUIStore.getState().toast.error("Failed to fetch availability", error.message);
            throw error;
          }
        },

        // Guest operations
        linkGuest: async (bookingId: string, guestId: string) => {
          await get().updateBooking(bookingId, { guestId });
        },

        unlinkGuest: async (bookingId: string) => {
          await get().updateBooking(bookingId, { guestId: undefined });
        },

        // Payment tracking
        updatePayment: async (bookingId: string, amount: number, method?: string) => {
          const booking = get().getBookingById(bookingId);
          if (!booking) throw new Error("Booking not found");

          const newPaidAmount = booking.paidAmount + amount;
          const paymentStatus =
            newPaidAmount >= booking.totalAmount
              ? ("PAID" as any)
              : newPaidAmount > 0
                ? ("PARTIAL" as any)
                : ("PENDING" as any);

          await get().updateBooking(bookingId, {
            paidAmount: newPaidAmount,
            paymentStatus,
            paymentMethod: method as any,
          });
        },

        // View data
        getCalendarEvents: (startDate: Date, endDate: Date) => {
          const bookings = [...get().bookings, ...get().optimisticBookings];
          const { properties } = useProjectStore.getState();

          const events: BookingCalendarEvent[] = bookings
            .filter((booking) => {
              const checkIn = new Date(booking.checkIn);
              const checkOut = new Date(booking.checkOut);
              return (
                (checkIn >= startDate && checkIn <= endDate) ||
                (checkOut >= startDate && checkOut <= endDate) ||
                (checkIn <= startDate && checkOut >= endDate)
              );
            })
            .map((booking) => {
              const property = properties.find((p) => p.id === booking.propertyId);
              return {
                id: booking.id,
                title: `${booking.guestName} - ${property?.name || "Unknown"}`,
                start: new Date(booking.checkIn),
                end: new Date(booking.checkOut),
                propertyId: booking.propertyId,
                propertyName: property?.name || "Unknown",
                status: booking.status,
                guestName: booking.guestName,
                totalAmount: booking.totalAmount,
                color: getStatusColor(booking.status),
              };
            });

          set((state) => {
            state.calendarEvents = events;
          });
        },

        getTimelineData: (startDate: Date, endDate: Date) => {
          const bookings = [...get().bookings, ...get().optimisticBookings];
          const { properties } = useProjectStore.getState();

          const timeline: BookingTimelineData[] = properties.map((property) => {
            const propertyBookings = bookings
              .filter((booking) => {
                const checkIn = new Date(booking.checkIn);
                const checkOut = new Date(booking.checkOut);
                return (
                  booking.propertyId === property.id &&
                  ((checkIn >= startDate && checkIn <= endDate) ||
                    (checkOut >= startDate && checkOut <= endDate) ||
                    (checkIn <= startDate && checkOut >= endDate))
                );
              })
              .map((booking) => ({
                id: booking.id,
                guestName: booking.guestName,
                start: new Date(booking.checkIn),
                end: new Date(booking.checkOut),
                status: booking.status,
              }))
              .sort((a, b) => a.start.getTime() - b.start.getTime());

            return {
              propertyId: property.id,
              propertyName: property.name,
              bookings: propertyBookings,
            };
          });

          set((state) => {
            state.timelineData = timeline;
          });
        },

        // Optimistic updates
        addOptimisticBooking: (booking: Booking) => {
          set((state) => {
            state.optimisticBookings.unshift(booking);
          });
        },

        removeOptimisticBooking: (bookingId: string) => {
          set((state) => {
            state.optimisticBookings = state.optimisticBookings.filter((b) => b.id !== bookingId);
          });
        },

        clearOptimisticBookings: () => {
          set((state) => {
            state.optimisticBookings = [];
          });
        },

        // State management
        setBookings: (bookings: Booking[]) => {
          set((state) => {
            state.bookings = bookings;
          });
        },

        setFilters: (filters: FilterParams) => {
          set((state) => {
            state.filters = filters;
          });
        },

        setPagination: (page: number, size: number) => {
          set((state) => {
            state.currentPage = page;
            state.pageSize = size;
          });
        },

        setLoading: (loading: boolean) => {
          set((state) => {
            state.isLoading = loading;
          });
        },

        setError: (error: string | null) => {
          set((state) => {
            state.error = error;
          });
        },

        clearError: () => {
          set((state) => {
            state.error = null;
          });
        },

        reset: () => {
          set((state) => {
            state.bookings = [];
            state.optimisticBookings = [];
            state.totalBookings = 0;
            state.currentPage = 1;
            state.calendarEvents = [];
            state.timelineData = [];
            state.availability.clear();
            state.filters = {};
            state.error = null;
            state.lastFetch = null;
          });
        },

        // Utility functions
        getBookingById: (bookingId: string) => {
          return (
            get().bookings.find((b) => b.id === bookingId) ||
            get().optimisticBookings.find((b) => b.id === bookingId)
          );
        },

        getBookingsByProperty: (propertyId: string) => {
          return [...get().bookings, ...get().optimisticBookings].filter(
            (b) => b.propertyId === propertyId
          );
        },

        getBookingsByStatus: (status: BookingStatus) => {
          return [...get().bookings, ...get().optimisticBookings].filter(
            (b) => b.status === status
          );
        },

        getUpcomingCheckIns: (days = 7) => {
          const now = new Date();
          const futureDate = new Date();
          futureDate.setDate(now.getDate() + days);

          return [...get().bookings, ...get().optimisticBookings].filter((booking) => {
            const checkIn = new Date(booking.checkIn);
            return (
              checkIn >= now && checkIn <= futureDate && booking.status === BookingStatus.CONFIRMED
            );
          });
        },

        getUpcomingCheckOuts: (days = 7) => {
          const now = new Date();
          const futureDate = new Date();
          futureDate.setDate(now.getDate() + days);

          return [...get().bookings, ...get().optimisticBookings].filter((booking) => {
            const checkOut = new Date(booking.checkOut);
            return (
              checkOut >= now &&
              checkOut <= futureDate &&
              booking.status === BookingStatus.CHECKED_IN
            );
          });
        },

        refreshIfNeeded: async () => {
          const { lastFetch } = get();
          const now = Date.now();

          if (!lastFetch || now - lastFetch > CACHE_DURATION) {
            await get().fetchBookings();
          }
        },
      })),
      {
        name: "booking-storage",
        partialize: (state) => ({
          filters: state.filters,
          currentPage: state.currentPage,
          pageSize: state.pageSize,
        }),
      }
    ),
    {
      name: "BookingStore",
    }
  )
);

// Helper function to get color based on status
const getStatusColor = (status: BookingStatus): string => {
  switch (status) {
    case BookingStatus.CONFIRMED:
      return "#10b981"; // green
    case BookingStatus.PENDING:
      return "#f59e0b"; // yellow
    case BookingStatus.CHECKED_IN:
      return "#3b82f6"; // blue
    case BookingStatus.CHECKED_OUT:
      return "#6b7280"; // gray
    case BookingStatus.CANCELLED:
      return "#ef4444"; // red
    case BookingStatus.NO_SHOW:
      return "#991b1b"; // dark red
    default:
      return "#6b7280"; // gray
  }
};

// Selector hooks for better performance
export const useBookings = () =>
  useBookingStore((state) => [...state.bookings, ...state.optimisticBookings]);
export const useBookingLoading = () =>
  useBookingStore((state) => state.isLoading || state.isCreating || state.isUpdating);
export const useBookingError = () => useBookingStore((state) => state.error);
export const useCalendarEvents = () => useBookingStore((state) => state.calendarEvents);
export const useTimelineData = () => useBookingStore((state) => state.timelineData);
export const useUpcomingCheckIns = () => useBookingStore((state) => state.getUpcomingCheckIns());
export const useUpcomingCheckOuts = () => useBookingStore((state) => state.getUpcomingCheckOuts());
