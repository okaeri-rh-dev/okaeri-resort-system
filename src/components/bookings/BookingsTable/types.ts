import type { BookingsSearch } from "@/lib/bookings";
import type { Booking, BookingStatus } from "@/types";

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
}

export interface BookingFiltersProps {
  search: BookingsSearch;
  setSearch: (next: Partial<BookingsSearch>) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
  /** Number of bookings after filtering */
  resultCount?: number;
  /** Total number of bookings before filtering */
  totalCount?: number;
}

export interface DateRange {
  from: Date | undefined;
  to?: Date | undefined;
}
