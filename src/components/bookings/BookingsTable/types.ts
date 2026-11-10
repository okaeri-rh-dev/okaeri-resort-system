import type { BookingsSearch, StatusChange } from "@/lib/bookings";
import type { Booking } from "@/types";

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
  updateBookingStatus: MutationLike<StatusChange>;
}

export interface BookingFiltersProps {
  search: BookingsSearch;
  setSearch: (next: Partial<BookingsSearch>) => void;
  hasActiveFilters: boolean;
  /** Number of bookings after filtering */
  resultCount?: number;
  /** Total number of bookings before filtering */
  totalCount?: number;
}
