import { useMemo } from "react";

import { useNavigate, useSearch } from "@tanstack/react-router";

import { useAllBookings } from "@/hooks/useBookings";
import {
  manilaDayOf,
  parseBookingsSearch,
  selectBookings,
  type BookingsSearch,
} from "@/lib/bookings";

/** The bookings the URL's view, search and filters select, shared by the list and its export. */
export const useSelectedBookings = () => {
  const search = useSearch({ from: "/admin/bookings" });
  const navigate = useNavigate({ from: "/admin/bookings" });
  const { data: bookings = [], isLoading, isPlaceholderData, error } = useAllBookings();
  const today = manilaDayOf(new Date());

  const selection = useMemo(
    () => selectBookings(bookings, search, today),
    [bookings, search, today]
  );

  // A view change is a history step; typing and filters replace the entry
  const setSearch = (next: Partial<BookingsSearch>) =>
    void navigate({
      search: (prev) => parseBookingsSearch({ ...prev, ...next }),
      replace: !("view" in next) || next.view === search.view,
    });

  return {
    ...selection,
    search,
    setSearch,
    totalCount: bookings.length,
    isLoading,
    isPlaceholderData,
    error,
  };
};
