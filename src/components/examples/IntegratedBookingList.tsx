/**
 * Example component demonstrating the integrated Zustand + TanStack Query system
 * Shows optimistic updates, offline support, and seamless state management
 */

import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  useBookingManagement,
  usePaginatedStoreQuery,
  useStoreMutation,
} from "@/hooks/useStoreQuery";
import { useProjectStore, useActiveProject } from "@/stores/projectStore";
import { useUIStore, useToast } from "@/stores/uiStore";
import { useNavigationStore } from "@/lib/store-router-integration";
import { queryKeys } from "@/lib/query-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Booking } from "@/types/common";
import { format } from "date-fns";

/**
 * Integrated Booking List Component
 * Demonstrates seamless integration between routing, stores, and queries
 */
export function IntegratedBookingList() {
  const navigate = useNavigate();
  const activeProject = useActiveProject();
  const toast = useToast();
  const { setPageTransition } = useUIStore();
  const { queuePrefetch } = useNavigationStore();

  // Local UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Integrated booking management with store sync
  const { bookings, createBooking, updateBooking, cancelBooking } = useBookingManagement(
    activeProject?.id || ""
  );

  // Search and filter logic
  const searchParams = useMemo(
    () => ({
      search: searchQuery || undefined,
      status: selectedStatus || undefined,
    }),
    [searchQuery, selectedStatus]
  );

  // Update search with debouncing
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      bookings.updateSearchParams({ search: query });
    },
    [bookings]
  );

  // Optimistic navigation to booking details
  const navigateToBooking = useCallback(
    (bookingId: string) => {
      // Set optimistic UI state
      setPageTransition(true);

      // Queue prefetch for related data
      queuePrefetch(`/bookings/${bookingId}/payments`, 10);
      queuePrefetch(`/bookings/${bookingId}/history`, 9);

      // Navigate with optimistic update
      navigate({
        to: "/bookings/$bookingId",
        params: { bookingId },
      });
    },
    [navigate, setPageTransition, queuePrefetch]
  );

  // Create new booking with optimistic update
  const handleCreateBooking = useCallback(
    async (data: Partial<Booking>) => {
      // Optimistic UI feedback
      const tempId = `temp-${Date.now()}`;
      const optimisticBooking: Booking = {
        ...data,
        id: tempId,
        status: "PENDING",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Booking;

      try {
        // The mutation already handles optimistic updates
        const result = await createBooking.mutateAsync(data);

        // Navigate to the newly created booking
        navigateToBooking(result.id);
      } catch (error) {
        // Error is already handled by the mutation
        console.error("Failed to create booking:", error);
      }
    },
    [createBooking, navigateToBooking]
  );

  // Quick actions with optimistic updates
  const handleQuickCheckIn = useCallback(
    async (booking: Booking) => {
      // Optimistic update
      setSelectedBooking({ ...booking, status: "CHECKED_IN" });

      try {
        await updateBooking.mutateAsync({
          id: booking.id,
          data: { status: "CHECKED_IN", checkInTime: new Date().toISOString() },
        });

        toast.success(
          "Check-in successful",
          `Guest has been checked in to ${booking.propertyName}`
        );
      } catch (error) {
        // Rollback optimistic update
        setSelectedBooking(booking);
      }
    },
    [updateBooking, toast]
  );

  const handleQuickCancel = useCallback(
    async (booking: Booking) => {
      if (!confirm("Are you sure you want to cancel this booking?")) return;

      try {
        await cancelBooking.mutateAsync(booking.id);

        // Remove from selected if it was selected
        if (selectedBooking?.id === booking.id) {
          setSelectedBooking(null);
        }
      } catch (error) {
        console.error("Failed to cancel booking:", error);
      }
    },
    [cancelBooking, selectedBooking]
  );

  // Render loading state
  if (bookings.isLoading && !bookings.data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="border-ocean-600 mx-auto h-8 w-8 animate-spin rounded-full border-b-2" />
          <p className="mt-2 text-sm text-gray-600">Loading bookings...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (bookings.error) {
    return (
      <Card className="border-red-200 bg-red-50 p-6">
        <h3 className="text-lg font-semibold text-red-900">Error loading bookings</h3>
        <p className="mt-2 text-sm text-red-700">
          {(bookings.error as Error).message || "An unexpected error occurred"}
        </p>
        <Button onClick={() => bookings.refetch()} className="mt-4" variant="outline">
          Try Again
        </Button>
      </Card>
    );
  }

  const bookingData = bookings.data?.items || [];
  const totalBookings = bookings.data?.total || 0;

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <Input
            type="search"
            placeholder="Search bookings..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1"
          />

          <select
            value={selectedStatus || ""}
            onChange={(e) => setSelectedStatus(e.target.value || null)}
            className="rounded-md border px-3 py-2"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CHECKED_IN">Checked In</option>
            <option value="CHECKED_OUT">Checked Out</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <Button onClick={() => setSelectedBooking(null)} className="whitespace-nowrap">
            New Booking
          </Button>
        </div>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing {bookingData.length} of {totalBookings} bookings
        </p>

        {/* Offline indicator */}
        {!navigator.onLine && (
          <div className="flex items-center gap-2 text-amber-600">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm">Offline mode</span>
          </div>
        )}
      </div>

      {/* Bookings List */}
      <div className="grid gap-4">
        {bookingData.map((booking) => (
          <Card
            key={booking.id}
            className={`cursor-pointer p-4 transition-all hover:shadow-md ${
              selectedBooking?.id === booking.id ? "ring-ocean-500 ring-2" : ""
            }`}
            onClick={() => setSelectedBooking(booking)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{booking.guestName}</h3>
                  <StatusBadge status={booking.status} />
                </div>

                <p className="mt-1 text-sm text-gray-600">
                  {booking.propertyName} • {format(new Date(booking.checkIn), "MMM d")} -{" "}
                  {format(new Date(booking.checkOut), "MMM d, yyyy")}
                </p>

                <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                  <span>{booking.nights} nights</span>
                  <span>{booking.guests} guests</span>
                  <span className="font-medium text-gray-700">
                    ₱{booking.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                {booking.status === "CONFIRMED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickCheckIn(booking);
                    }}
                  >
                    Check In
                  </Button>
                )}

                {booking.status === "PENDING" && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickCancel(booking);
                    }}
                  >
                    Cancel
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToBooking(booking.id);
                  }}
                >
                  View Details
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {bookings.data && bookings.data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => bookings.goToPage(bookings.page - 1)}
            disabled={!bookings.hasPreviousPage}
          >
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {Array.from({ length: Math.min(5, bookings.data.totalPages) }, (_, i) => {
              const pageNumber = i + 1;
              return (
                <Button
                  key={pageNumber}
                  variant={bookings.page === pageNumber ? "default" : "outline"}
                  size="sm"
                  onClick={() => bookings.goToPage(pageNumber)}
                >
                  {pageNumber}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => bookings.goToPage(bookings.page + 1)}
            disabled={!bookings.hasNextPage}
          >
            Next
          </Button>
        </div>
      )}

      {/* Empty State */}
      {bookingData.length === 0 && !bookings.isLoading && (
        <Card className="p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <svg
              className="h-6 w-6 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">No bookings found</h3>
          <p className="mt-2 text-sm text-gray-600">
            {searchQuery
              ? "Try adjusting your search criteria"
              : "Create your first booking to get started"}
          </p>
          <Button onClick={() => handleCreateBooking({})} className="mt-4">
            Create Booking
          </Button>
        </Card>
      )}
    </div>
  );
}

/**
 * Status Badge Component
 */
function StatusBadge({ status }: { status: string }) {
  const statusColors = {
    PENDING: "bg-yellow-100 text-yellow-800",
    CONFIRMED: "bg-green-100 text-green-800",
    CHECKED_IN: "bg-blue-100 text-blue-800",
    CHECKED_OUT: "bg-gray-100 text-gray-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-medium ${
        statusColors[status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
