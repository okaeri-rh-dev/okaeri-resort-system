import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface GuestStore {
  // Local state
  searchQuery: string;
  sortBy: "name" | "bookings" | "spent" | "created";
  sortOrder: "asc" | "desc";

  // Actions
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: "name" | "bookings" | "spent" | "created") => void;
  setSortOrder: (order: "asc" | "desc") => void;
}

export const useGuestStore = create<GuestStore>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        searchQuery: "",
        sortBy: "name",
        sortOrder: "asc",

        // Actions
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
