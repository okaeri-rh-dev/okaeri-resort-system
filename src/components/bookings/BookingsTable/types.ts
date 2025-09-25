import type { Booking, BookingFilters } from "@/types";

export interface BookingsTableProps {
  onViewBooking?: (booking: Booking) => void;
  onEditBooking?: (booking: Booking) => void;
  className?: string;
}

export interface BookingCardProps {
  booking: Booking;
  onView: () => void;
  onEdit: () => void;
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
}

export interface DateRange {
  from: Date | undefined;
  to?: Date | undefined;
}
