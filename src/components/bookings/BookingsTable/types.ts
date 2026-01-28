import type { Booking, BookingFilters } from "@/types";

export interface BookingsTableProps {
  className?: string;
}

export interface BookingCardProps {
  booking: Booking;
  onUploadPayment: () => void;
  onCancel: () => void;
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
