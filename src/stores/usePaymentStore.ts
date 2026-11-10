import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type { PaymentMethod, PaymentStatus } from "@/types";

interface PaymentFilters {
  status?: PaymentStatus;
  method?: PaymentMethod;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaymentStore {
  filters: PaymentFilters;
  searchQuery: string;
  sortBy: "date" | "amount" | "status" | "booking";
  sortOrder: "asc" | "desc";

  setFilters: (filters: PaymentFilters) => void;
  resetFilters: () => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: "date" | "amount" | "status" | "booking") => void;
  setSortOrder: (order: "asc" | "desc") => void;
}

export const usePaymentStore = create<PaymentStore>()(
  devtools(
    persist(
      (set) => ({
        filters: {},
        searchQuery: "",
        sortBy: "date",
        sortOrder: "desc",

        setFilters: (filters) => set({ filters }),

        resetFilters: () => set({ filters: {} }),

        setSearchQuery: (query) => set({ searchQuery: query }),

        setSortBy: (sortBy) => set({ sortBy }),

        setSortOrder: (order) => set({ sortOrder: order }),
      }),
      {
        name: "payment-store",
        partialize: (state) => ({
          filters: state.filters,
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
        }),
      }
    )
  )
);
