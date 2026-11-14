import type { UpdateBookingStatus } from "@/components/bookings/BookingSections/types";
import type { BookingsSearch } from "@/lib/bookings";
import type { Booking } from "@/types";

export interface BookingsTableProps {
  className?: string;
}

export interface BookingCardProps {
  booking: Booking;
  onRecordPayment: () => void;
  onCancel: () => void;
  updateBookingStatus: UpdateBookingStatus;
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
