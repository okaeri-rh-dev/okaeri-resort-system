/**
 * Custom hooks for booking operations using TanStack Query
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, mutationKeys, invalidateQueries } from "@/lib/query-client";
import { useBookingStore } from "@/stores/bookingStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import type { Booking, CreateBookingData, UpdateBookingData } from "@/types/common";

/**
 * Fetch all bookings for the active project
 */
export function useBookings(filters?: any) {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const fetchBookings = useBookingStore((state) => state.fetchBookings);

  return useQuery({
    queryKey: queryKeys.bookings.list(activeProjectId!, filters),
    queryFn: () => fetchBookings(filters),
    enabled: !!activeProjectId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch a single booking by ID
 */
export function useBooking(bookingId: string) {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const bookingStore = useBookingStore();

  return useQuery({
    queryKey: queryKeys.bookings.detail(activeProjectId!, bookingId),
    queryFn: async () => {
      // Check if booking is already in store
      const existingBooking = bookingStore.bookings.find((b) => b.id === bookingId);
      if (existingBooking && Date.now() - bookingStore.lastFetch < 60000) {
        return existingBooking;
      }
      // Otherwise fetch from API
      return bookingStore.fetchBookingById(bookingId);
    },
    enabled: !!activeProjectId && !!bookingId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Create a new booking with optimistic update
 */
export function useCreateBooking() {
  const queryClient = useQueryClient();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const createBooking = useBookingStore((state) => state.createBooking);
  const toast = useUIStore((state) => state.toast);

  return useMutation({
    mutationKey: mutationKeys.bookings.create(activeProjectId!),
    mutationFn: (data: CreateBookingData) => createBooking(data),
    onMutate: async (newBooking) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.bookings.all(activeProjectId!),
      });

      // Snapshot previous value
      const previousBookings = queryClient.getQueryData(queryKeys.bookings.list(activeProjectId!));

      // Optimistically update
      queryClient.setQueryData(queryKeys.bookings.list(activeProjectId!), (old: Booking[] = []) => [
        ...old,
        {
          ...newBooking,
          id: `temp-${Date.now()}`,
          status: "PENDING",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      return { previousBookings };
    },
    onError: (err, newBooking, context) => {
      // Rollback on error
      if (context?.previousBookings) {
        queryClient.setQueryData(
          queryKeys.bookings.list(activeProjectId!),
          context.previousBookings
        );
      }
      toast.error("Failed to create booking", err.message);
    },
    onSuccess: () => {
      toast.success("Booking created successfully");
      invalidateQueries.bookings(activeProjectId!);
    },
  });
}

/**
 * Update an existing booking with optimistic update
 */
export function useUpdateBooking() {
  const queryClient = useQueryClient();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const updateBooking = useBookingStore((state) => state.updateBooking);
  const toast = useUIStore((state) => state.toast);

  return useMutation({
    mutationKey: mutationKeys.bookings.update(activeProjectId!, ""),
    mutationFn: ({ id, data }: { id: string; data: UpdateBookingData }) => updateBooking(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.bookings.detail(activeProjectId!, id),
      });

      const previousBooking = queryClient.getQueryData(
        queryKeys.bookings.detail(activeProjectId!, id)
      );

      queryClient.setQueryData(queryKeys.bookings.detail(activeProjectId!, id), (old: Booking) => ({
        ...old,
        ...data,
        updatedAt: new Date().toISOString(),
      }));

      return { previousBooking };
    },
    onError: (err, variables, context) => {
      if (context?.previousBooking) {
        queryClient.setQueryData(
          queryKeys.bookings.detail(activeProjectId!, variables.id),
          context.previousBooking
        );
      }
      toast.error("Failed to update booking", err.message);
    },
    onSuccess: (data, variables) => {
      toast.success("Booking updated successfully");
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.detail(activeProjectId!, variables.id),
      });
      invalidateQueries.bookings(activeProjectId!);
    },
  });
}

/**
 * Delete a booking
 */
export function useDeleteBooking() {
  const queryClient = useQueryClient();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const deleteBooking = useBookingStore((state) => state.deleteBooking);
  const toast = useUIStore((state) => state.toast);

  return useMutation({
    mutationKey: mutationKeys.bookings.cancel(activeProjectId!, ""),
    mutationFn: (bookingId: string) => deleteBooking(bookingId),
    onSuccess: () => {
      toast.success("Booking deleted successfully");
      invalidateQueries.bookings(activeProjectId!);
    },
    onError: (err) => {
      toast.error("Failed to delete booking", err.message);
    },
  });
}

/**
 * Check in a booking
 */
export function useCheckInBooking() {
  const queryClient = useQueryClient();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const checkIn = useBookingStore((state) => state.checkIn);
  const toast = useUIStore((state) => state.toast);

  return useMutation({
    mutationKey: mutationKeys.bookings.checkIn(activeProjectId!, ""),
    mutationFn: (bookingId: string) => checkIn(bookingId),
    onMutate: async (bookingId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.bookings.detail(activeProjectId!, bookingId),
      });

      const previousBooking = queryClient.getQueryData<Booking>(
        queryKeys.bookings.detail(activeProjectId!, bookingId)
      );

      // Optimistically update status
      if (previousBooking) {
        queryClient.setQueryData(queryKeys.bookings.detail(activeProjectId!, bookingId), {
          ...previousBooking,
          status: "CHECKED_IN",
          checkedInAt: new Date().toISOString(),
        });
      }

      return { previousBooking };
    },
    onError: (err, bookingId, context) => {
      if (context?.previousBooking) {
        queryClient.setQueryData(
          queryKeys.bookings.detail(activeProjectId!, bookingId),
          context.previousBooking
        );
      }
      toast.error("Failed to check in", err.message);
    },
    onSuccess: (data, bookingId) => {
      toast.success("Guest checked in successfully");
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.detail(activeProjectId!, bookingId),
      });
    },
  });
}

/**
 * Check out a booking
 */
export function useCheckOutBooking() {
  const queryClient = useQueryClient();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const checkOut = useBookingStore((state) => state.checkOut);
  const toast = useUIStore((state) => state.toast);

  return useMutation({
    mutationKey: mutationKeys.bookings.checkOut(activeProjectId!, ""),
    mutationFn: (bookingId: string) => checkOut(bookingId),
    onMutate: async (bookingId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.bookings.detail(activeProjectId!, bookingId),
      });

      const previousBooking = queryClient.getQueryData<Booking>(
        queryKeys.bookings.detail(activeProjectId!, bookingId)
      );

      // Optimistically update status
      if (previousBooking) {
        queryClient.setQueryData(queryKeys.bookings.detail(activeProjectId!, bookingId), {
          ...previousBooking,
          status: "CHECKED_OUT",
          checkedOutAt: new Date().toISOString(),
        });
      }

      return { previousBooking };
    },
    onError: (err, bookingId, context) => {
      if (context?.previousBooking) {
        queryClient.setQueryData(
          queryKeys.bookings.detail(activeProjectId!, bookingId),
          context.previousBooking
        );
      }
      toast.error("Failed to check out", err.message);
    },
    onSuccess: (data, bookingId) => {
      toast.success("Guest checked out successfully");
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.detail(activeProjectId!, bookingId),
      });
    },
  });
}

/**
 * Cancel a booking
 */
export function useCancelBooking() {
  const queryClient = useQueryClient();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const cancelBooking = useBookingStore((state) => state.cancelBooking);
  const toast = useUIStore((state) => state.toast);

  return useMutation({
    mutationKey: mutationKeys.bookings.cancel(activeProjectId!, ""),
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) =>
      cancelBooking(bookingId, reason),
    onSuccess: (data, variables) => {
      toast.success("Booking cancelled successfully");
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookings.detail(activeProjectId!, variables.bookingId),
      });
      invalidateQueries.bookings(activeProjectId!);
    },
    onError: (err) => {
      toast.error("Failed to cancel booking", err.message);
    },
  });
}

/**
 * Fetch booking calendar data
 */
export function useBookingCalendar(propertyId?: string) {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const fetchCalendarData = useBookingStore((state) => state.fetchCalendarData);

  return useQuery({
    queryKey: queryKeys.bookings.calendar(activeProjectId!, propertyId),
    queryFn: () => fetchCalendarData(propertyId),
    enabled: !!activeProjectId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch booking timeline data
 */
export function useBookingTimeline(dateRange?: { start: string; end: string }) {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const fetchTimelineData = useBookingStore((state) => state.fetchTimelineData);

  return useQuery({
    queryKey: queryKeys.bookings.timeline(activeProjectId!, dateRange),
    queryFn: () => fetchTimelineData(dateRange),
    enabled: !!activeProjectId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Check availability for a property
 */
export function useCheckAvailability(propertyId: string, checkIn: string, checkOut: string) {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const checkAvailability = useBookingStore((state) => state.checkAvailability);

  return useQuery({
    queryKey: queryKeys.properties.availability(activeProjectId!, propertyId),
    queryFn: () => checkAvailability(propertyId, checkIn, checkOut),
    enabled: !!activeProjectId && !!propertyId && !!checkIn && !!checkOut,
    staleTime: 60 * 1000, // 1 minute - availability changes frequently
  });
}
