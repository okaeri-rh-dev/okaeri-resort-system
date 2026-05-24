import type { Booking, BookingFilters, BookingStatus } from "@/types";

export interface BookingsTableProps {
  className?: string;
}

interface MutationLike<TVariables> {
  mutate: (variables: TVariables) => void;
}

export interface BookingCardProps {
  booking: Booking;
  onUploadPayment: () => void;
  onCancel: () => void;
  updateBookingStatus: MutationLike<{ bookingId: string; status: BookingStatus }>;
  deleteBooking: MutationLike<string>;
}

export interface BookingFiltersProps {
  filters: BookingFilters;
  setFilters: (filters: BookingFilters) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;
  onExport: () => void;
  /** Number of bookings after filtering */
  resultCount?: number;
  /** Total number of bookings before filtering */
  totalCount?: number;
}

export interface DateRange {
  from: Date | undefined;
  to?: Date | undefined;
}
