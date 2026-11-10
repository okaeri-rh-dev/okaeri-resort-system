import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type { Guest } from "@/types";

// ============================================
// ZUSTAND STORE
// ============================================
export interface GuestStore {
  // Local state
  selectedGuest: Guest | null;
  searchQuery: string;
  sortBy: "name" | "bookings" | "spent" | "created";
  sortOrder: "asc" | "desc";

  // Actions
  setSelectedGuest: (guest: Guest | null) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: "name" | "bookings" | "spent" | "created") => void;
  setSortOrder: (order: "asc" | "desc") => void;
}

export const useGuestStore = create<GuestStore>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        selectedGuest: null,
        searchQuery: "",
        sortBy: "name",
        sortOrder: "asc",

        // Actions
        setSelectedGuest: (guest) => set({ selectedGuest: guest }),

        setSearchQuery: (query) => set({ searchQuery: query }),

        setSortBy: (sortBy) => set({ sortBy }),

        setSortOrder: (order) => set({ sortOrder: order }),
      }),
      {
        name: "guest-storage",
        storage: {
          getItem: (name) => {
            const value = sessionStorage.getItem(name);
            return value ? JSON.parse(value) : null;
          },
          setItem: (name, value) => {
            sessionStorage.setItem(name, JSON.stringify(value));
          },
          removeItem: (name) => {
            sessionStorage.removeItem(name);
          },
        },
        partialize: (state) =>
          ({
            sortBy: state.sortBy,
            sortOrder: state.sortOrder,
          }) as GuestStore,
      }
    ),
    {
      name: "GuestStore",
    }
  )
);
