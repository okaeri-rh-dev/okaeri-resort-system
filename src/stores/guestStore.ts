/**
 * Guest information management store using Zustand
 * Handles comprehensive guest data with GDPR-compliant practices
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  Guest,
  GuestPreferences,
  CreateGuestData,
  UpdateGuestData,
  Booking,
  PaginatedResponse,
  FilterParams,
} from "@/types/common";
import { apiClient } from "@/api/client";
import { useProjectStore } from "./projectStore";
import { useUIStore } from "./uiStore";

interface GuestState {
  // Guests data
  guests: Guest[];
  optimisticGuests: Guest[];
  totalGuests: number;
  currentPage: number;
  pageSize: number;

  // Search
  searchResults: Guest[];
  searchQuery: string;
  isSearching: boolean;

  // Guest bookings cache
  guestBookings: Map<string, Booking[]>;

  // Guest preferences cache
  guestPreferences: Map<string, GuestPreferences>;

  // UI state
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isMerging: boolean;
  error: string | null;
  lastFetch: number | null;

  // Filters
  filters: FilterParams;

  // Duplicate detection
  potentialDuplicates: Array<{
    guest1: Guest;
    guest2: Guest;
    similarity: number;
  }>;
}

interface GuestActions {
  // CRUD operations
  fetchGuests: (params?: FilterParams) => Promise<void>;
  fetchGuestById: (guestId: string) => Promise<Guest>;
  createGuest: (data: CreateGuestData) => Promise<Guest>;
  updateGuest: (guestId: string, data: UpdateGuestData) => Promise<void>;
  deleteGuest: (guestId: string) => Promise<void>;

  // Search operations
  searchGuests: (query: string, fuzzy?: boolean) => Promise<void>;
  clearSearch: () => void;

  // Guest bookings
  fetchGuestBookings: (guestId: string) => Promise<Booking[]>;
  getGuestBookingHistory: (guestId: string) => Booking[];
  getTotalSpent: (guestId: string) => number;

  // Guest preferences
  updateGuestPreferences: (guestId: string, preferences: GuestPreferences) => Promise<void>;
  getGuestPreferences: (guestId: string) => GuestPreferences | undefined;

  // Merge duplicates
  mergeGuests: (primaryGuestId: string, secondaryGuestId: string) => Promise<void>;
  detectDuplicates: () => Promise<void>;
  ignoreDuplicate: (guest1Id: string, guest2Id: string) => void;

  // VIP and blacklist management
  markAsVIP: (guestId: string) => Promise<void>;
  removeVIPStatus: (guestId: string) => Promise<void>;
  blacklistGuest: (guestId: string, reason?: string) => Promise<void>;
  removeFromBlacklist: (guestId: string) => Promise<void>;

  // Contact management
  updateContactInfo: (
    guestId: string,
    contact: { email?: string; phone?: string; alternatePhone?: string }
  ) => Promise<void>;
  verifyEmail: (guestId: string, email: string) => Promise<boolean>;
  verifyPhone: (guestId: string, phone: string) => Promise<boolean>;

  // Optimistic updates
  addOptimisticGuest: (guest: Guest) => void;
  removeOptimisticGuest: (guestId: string) => void;
  clearOptimisticGuests: () => void;

  // State management
  setGuests: (guests: Guest[]) => void;
  setFilters: (filters: FilterParams) => void;
  setPagination: (page: number, size: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;

  // Utility
  getGuestById: (guestId: string) => Guest | undefined;
  getGuestByEmail: (email: string) => Guest | undefined;
  getGuestByPhone: (phone: string) => Guest | undefined;
  getVIPGuests: () => Guest[];
  getBlacklistedGuests: () => Guest[];
  getFrequentGuests: (minBookings?: number) => Guest[];
  refreshIfNeeded: () => Promise<void>;

  // GDPR compliance
  exportGuestData: (guestId: string) => Promise<any>;
  anonymizeGuest: (guestId: string) => Promise<void>;
}

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Generate temporary ID for optimistic updates
let tempIdCounter = 0;
const generateTempId = () => `temp-guest-${Date.now()}-${++tempIdCounter}`;

// Fuzzy search scoring function
const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bigrams1 = new Set();
  const bigrams2 = new Set();

  for (let i = 0; i < s1.length - 1; i++) {
    bigrams1.add(s1.slice(i, i + 2));
  }

  for (let i = 0; i < s2.length - 1; i++) {
    bigrams2.add(s2.slice(i, i + 2));
  }

  const intersection = new Set([...bigrams1].filter((x) => bigrams2.has(x)));
  const union = new Set([...bigrams1, ...bigrams2]);

  return intersection.size / union.size;
};

export const useGuestStore = create<GuestState & GuestActions>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      guests: [],
      optimisticGuests: [],
      totalGuests: 0,
      currentPage: 1,
      pageSize: 20,
      searchResults: [],
      searchQuery: "",
      isSearching: false,
      guestBookings: new Map(),
      guestPreferences: new Map(),
      isLoading: false,
      isCreating: false,
      isUpdating: false,
      isMerging: false,
      error: null,
      lastFetch: null,
      filters: {},
      potentialDuplicates: [],

      // CRUD operations
      fetchGuests: async (params?: FilterParams) => {
        const { activeProjectId } = useProjectStore.getState();
        if (!activeProjectId) {
          throw new Error("No active project selected");
        }

        set((state) => {
          state.isLoading = true;
          state.error = null;
          if (params) state.filters = params;
        });

        try {
          const response = await apiClient.get<PaginatedResponse<Guest>>(
            `/projects/${activeProjectId}/guests`,
            {
              page: get().currentPage,
              limit: get().pageSize,
              ...get().filters,
            }
          );

          set((state) => {
            state.guests = response.data.data;
            state.totalGuests = response.data.meta.total;
            state.lastFetch = Date.now();
            state.isLoading = false;
          });

          // Detect duplicates after fetching
          get().detectDuplicates();
        } catch (error: any) {
          set((state) => {
            state.isLoading = false;
            state.error = error.message || "Failed to fetch guests";
          });
          useUIStore.getState().toast.error("Failed to fetch guests", error.message);
          throw error;
        }
      },

      fetchGuestById: async (guestId: string) => {
        const { activeProjectId } = useProjectStore.getState();
        if (!activeProjectId) {
          throw new Error("No active project selected");
        }

        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const response = await apiClient.get<Guest>(
            `/projects/${activeProjectId}/guests/${guestId}`
          );
          const guest = response.data;

          set((state) => {
            const index = state.guests.findIndex((g) => g.id === guestId);
            if (index !== -1) {
              state.guests[index] = guest;
            } else {
              state.guests.push(guest);
            }

            // Cache preferences
            if (guest.preferences) {
              state.guestPreferences.set(guestId, guest.preferences);
            }

            state.isLoading = false;
          });

          return guest;
        } catch (error: any) {
          set((state) => {
            state.isLoading = false;
            state.error = error.message || "Failed to fetch guest";
          });
          useUIStore.getState().toast.error("Failed to fetch guest", error.message);
          throw error;
        }
      },

      createGuest: async (data: CreateGuestData) => {
        const { activeProjectId } = useProjectStore.getState();
        if (!activeProjectId) {
          throw new Error("No active project selected");
        }

        // Check for existing guest with same email or phone
        const existingByEmail = data.email && get().getGuestByEmail(data.email);
        const existingByPhone = data.phone && get().getGuestByPhone(data.phone);

        if (existingByEmail || existingByPhone) {
          const existing = existingByEmail || existingByPhone;
          const confirmUpdate = window.confirm(
            `A guest with this ${existingByEmail ? "email" : "phone"} already exists (${
              existing!.name
            }). Would you like to update the existing guest instead?`
          );

          if (confirmUpdate) {
            await get().updateGuest(existing!.id, data);
            return existing!;
          }
        }

        // Create optimistic guest
        const tempId = generateTempId();
        const optimisticGuest: Guest = {
          id: tempId,
          projectId: activeProjectId,
          ...data,
          totalBookings: 0,
          totalSpent: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((state) => {
          state.isCreating = true;
          state.error = null;
          state.optimisticGuests.unshift(optimisticGuest);
        });

        try {
          const response = await apiClient.post<Guest>(`/projects/${activeProjectId}/guests`, data);
          const guest = response.data;

          set((state) => {
            // Remove optimistic guest
            state.optimisticGuests = state.optimisticGuests.filter((g) => g.id !== tempId);
            // Add real guest
            state.guests.unshift(guest);
            state.totalGuests++;

            // Cache preferences
            if (guest.preferences) {
              state.guestPreferences.set(guest.id, guest.preferences);
            }

            state.isCreating = false;
          });

          useUIStore.getState().toast.success("Guest created successfully");
          return guest;
        } catch (error: any) {
          set((state) => {
            // Remove optimistic guest on error
            state.optimisticGuests = state.optimisticGuests.filter((g) => g.id !== tempId);
            state.isCreating = false;
            state.error = error.message || "Failed to create guest";
          });
          useUIStore.getState().toast.error("Failed to create guest", error.message);
          throw error;
        }
      },

      updateGuest: async (guestId: string, data: UpdateGuestData) => {
        const { activeProjectId } = useProjectStore.getState();
        if (!activeProjectId) {
          throw new Error("No active project selected");
        }

        // Store original guest for rollback
        const originalGuest = get().guests.find((g) => g.id === guestId);
        if (!originalGuest) {
          throw new Error("Guest not found");
        }

        set((state) => {
          state.isUpdating = true;
          state.error = null;
          // Optimistic update
          const index = state.guests.findIndex((g) => g.id === guestId);
          if (index !== -1) {
            state.guests[index] = { ...state.guests[index]!, ...data };
          }
        });

        try {
          const response = await apiClient.patch<Guest>(
            `/projects/${activeProjectId}/guests/${guestId}`,
            data
          );
          const updatedGuest = response.data;

          set((state) => {
            const index = state.guests.findIndex((g) => g.id === guestId);
            if (index !== -1) {
              state.guests[index] = updatedGuest;
            }

            // Update cached preferences
            if (updatedGuest.preferences) {
              state.guestPreferences.set(guestId, updatedGuest.preferences);
            }

            state.isUpdating = false;
          });

          useUIStore.getState().toast.success("Guest updated successfully");
        } catch (error: any) {
          set((state) => {
            // Rollback on error
            const index = state.guests.findIndex((g) => g.id === guestId);
            if (index !== -1) {
              state.guests[index] = originalGuest;
            }
            state.isUpdating = false;
            state.error = error.message || "Failed to update guest";
          });
          useUIStore.getState().toast.error("Failed to update guest", error.message);
          throw error;
        }
      },

      deleteGuest: async (guestId: string) => {
        const { activeProjectId } = useProjectStore.getState();
        if (!activeProjectId) {
          throw new Error("No active project selected");
        }

        // Check if guest has bookings
        const bookings = get().guestBookings.get(guestId);
        if (bookings && bookings.length > 0) {
          const confirmDelete = window.confirm(
            `This guest has ${bookings.length} booking(s). Are you sure you want to delete?`
          );
          if (!confirmDelete) return;
        }

        // Store original guest for rollback
        const originalGuest = get().guests.find((g) => g.id === guestId);
        if (!originalGuest) {
          throw new Error("Guest not found");
        }

        set((state) => {
          state.isLoading = true;
          state.error = null;
          // Optimistic delete
          state.guests = state.guests.filter((g) => g.id !== guestId);
          state.totalGuests--;
          state.guestBookings.delete(guestId);
          state.guestPreferences.delete(guestId);
        });

        try {
          await apiClient.delete(`/projects/${activeProjectId}/guests/${guestId}`);

          set((state) => {
            state.isLoading = false;
          });

          useUIStore.getState().toast.success("Guest deleted successfully");
        } catch (error: any) {
          set((state) => {
            // Rollback on error
            state.guests.push(originalGuest);
            state.totalGuests++;
            state.isLoading = false;
            state.error = error.message || "Failed to delete guest";
          });
          useUIStore.getState().toast.error("Failed to delete guest", error.message);
          throw error;
        }
      },

      // Search operations
      searchGuests: async (query: string, fuzzy = true) => {
        const { activeProjectId } = useProjectStore.getState();
        if (!activeProjectId) {
          throw new Error("No active project selected");
        }

        set((state) => {
          state.isSearching = true;
          state.searchQuery = query;
          state.error = null;
        });

        try {
          if (fuzzy) {
            // Fuzzy search locally for better UX
            const allGuests = [...get().guests, ...get().optimisticGuests];
            const results = allGuests
              .map((guest) => {
                const nameScore = calculateSimilarity(guest.name, query);
                const emailScore = guest.email ? calculateSimilarity(guest.email, query) : 0;
                const phoneScore = guest.phone ? calculateSimilarity(guest.phone, query) : 0;
                const maxScore = Math.max(nameScore, emailScore, phoneScore);

                return { guest, score: maxScore };
              })
              .filter((item) => item.score > 0.3) // Threshold for fuzzy match
              .sort((a, b) => b.score - a.score)
              .map((item) => item.guest);

            set((state) => {
              state.searchResults = results;
              state.isSearching = false;
            });
          } else {
            // Exact search from API
            const response = await apiClient.get<Guest[]>(
              `/projects/${activeProjectId}/guests/search`,
              { q: query }
            );

            set((state) => {
              state.searchResults = response.data;
              state.isSearching = false;
            });
          }
        } catch (error: any) {
          set((state) => {
            state.isSearching = false;
            state.error = error.message || "Search failed";
          });
          useUIStore.getState().toast.error("Search failed", error.message);
          throw error;
        }
      },

      clearSearch: () => {
        set((state) => {
          state.searchResults = [];
          state.searchQuery = "";
        });
      },

      // Guest bookings
      fetchGuestBookings: async (guestId: string) => {
        const { activeProjectId } = useProjectStore.getState();
        if (!activeProjectId) {
          throw new Error("No active project selected");
        }

        try {
          const response = await apiClient.get<Booking[]>(
            `/projects/${activeProjectId}/guests/${guestId}/bookings`
          );
          const bookings = response.data;

          set((state) => {
            state.guestBookings.set(guestId, bookings);
          });

          return bookings;
        } catch (error: any) {
          useUIStore.getState().toast.error("Failed to fetch guest bookings", error.message);
          throw error;
        }
      },

      getGuestBookingHistory: (guestId: string) => {
        return get().guestBookings.get(guestId) || [];
      },

      getTotalSpent: (guestId: string) => {
        const bookings = get().guestBookings.get(guestId) || [];
        return bookings.reduce((total, booking) => total + booking.totalAmount, 0);
      },

      // Guest preferences
      updateGuestPreferences: async (guestId: string, preferences: GuestPreferences) => {
        await get().updateGuest(guestId, { preferences });
      },

      getGuestPreferences: (guestId: string) => {
        return get().guestPreferences.get(guestId);
      },

      // Merge duplicates
      mergeGuests: async (primaryGuestId: string, secondaryGuestId: string) => {
        const { activeProjectId } = useProjectStore.getState();
        if (!activeProjectId) {
          throw new Error("No active project selected");
        }

        set((state) => {
          state.isMerging = true;
          state.error = null;
        });

        try {
          const response = await apiClient.post<Guest>(
            `/projects/${activeProjectId}/guests/merge`,
            {
              primaryGuestId,
              secondaryGuestId,
            }
          );
          const mergedGuest = response.data;

          set((state) => {
            // Remove secondary guest
            state.guests = state.guests.filter((g) => g.id !== secondaryGuestId);
            // Update primary guest
            const index = state.guests.findIndex((g) => g.id === primaryGuestId);
            if (index !== -1) {
              state.guests[index] = mergedGuest;
            }
            state.totalGuests--;
            state.isMerging = false;

            // Remove from duplicates
            state.potentialDuplicates = state.potentialDuplicates.filter(
              (dup) =>
                !(
                  (dup.guest1.id === primaryGuestId && dup.guest2.id === secondaryGuestId) ||
                  (dup.guest1.id === secondaryGuestId && dup.guest2.id === primaryGuestId)
                )
            );
          });

          useUIStore.getState().toast.success("Guests merged successfully");
        } catch (error: any) {
          set((state) => {
            state.isMerging = false;
            state.error = error.message || "Failed to merge guests";
          });
          useUIStore.getState().toast.error("Failed to merge guests", error.message);
          throw error;
        }
      },

      detectDuplicates: async () => {
        const guests = [...get().guests, ...get().optimisticGuests];
        const duplicates: Array<{
          guest1: Guest;
          guest2: Guest;
          similarity: number;
        }> = [];

        for (let i = 0; i < guests.length - 1; i++) {
          for (let j = i + 1; j < guests.length; j++) {
            const guest1 = guests[i]!;
            const guest2 = guests[j]!;

            // Check name similarity
            const nameSimilarity = calculateSimilarity(guest1.name, guest2.name);

            // Check email match
            const emailMatch = guest1.email && guest2.email && guest1.email === guest2.email;

            // Check phone match
            const phoneMatch = guest1.phone && guest2.phone && guest1.phone === guest2.phone;

            // Calculate overall similarity
            let similarity = nameSimilarity;
            if (emailMatch) similarity = Math.max(similarity, 0.9);
            if (phoneMatch) similarity = Math.max(similarity, 0.9);

            // If similarity is high enough, consider as potential duplicate
            if (similarity > 0.7) {
              duplicates.push({
                guest1,
                guest2,
                similarity,
              });
            }
          }
        }

        set((state) => {
          state.potentialDuplicates = duplicates.sort((a, b) => b.similarity - a.similarity);
        });

        if (duplicates.length > 0) {
          useUIStore
            .getState()
            .toast.info(
              "Potential duplicates detected",
              `Found ${duplicates.length} potential duplicate guest(s)`
            );
        }
      },

      ignoreDuplicate: (guest1Id: string, guest2Id: string) => {
        set((state) => {
          state.potentialDuplicates = state.potentialDuplicates.filter(
            (dup) =>
              !(
                (dup.guest1.id === guest1Id && dup.guest2.id === guest2Id) ||
                (dup.guest1.id === guest2Id && dup.guest2.id === guest1Id)
              )
          );
        });
      },

      // VIP and blacklist management
      markAsVIP: async (guestId: string) => {
        await get().updateGuest(guestId, { vipStatus: true });
      },

      removeVIPStatus: async (guestId: string) => {
        await get().updateGuest(guestId, { vipStatus: false });
      },

      blacklistGuest: async (guestId: string, reason?: string) => {
        await get().updateGuest(guestId, {
          blacklisted: true,
          notes: reason ? `Blacklisted: ${reason}` : undefined,
        });
      },

      removeFromBlacklist: async (guestId: string) => {
        await get().updateGuest(guestId, { blacklisted: false });
      },

      // Contact management
      updateContactInfo: async (guestId: string, contact) => {
        await get().updateGuest(guestId, contact);
      },

      verifyEmail: async (guestId: string, email: string) => {
        const { activeProjectId } = useProjectStore.getState();
        if (!activeProjectId) {
          throw new Error("No active project selected");
        }

        try {
          const response = await apiClient.post<{ verified: boolean }>(
            `/projects/${activeProjectId}/guests/${guestId}/verify-email`,
            { email }
          );
          return response.data.verified;
        } catch (error: any) {
          useUIStore.getState().toast.error("Email verification failed", error.message);
          return false;
        }
      },

      verifyPhone: async (guestId: string, phone: string) => {
        const { activeProjectId } = useProjectStore.getState();
        if (!activeProjectId) {
          throw new Error("No active project selected");
        }

        try {
          const response = await apiClient.post<{ verified: boolean }>(
            `/projects/${activeProjectId}/guests/${guestId}/verify-phone`,
            { phone }
          );
          return response.data.verified;
        } catch (error: any) {
          useUIStore.getState().toast.error("Phone verification failed", error.message);
          return false;
        }
      },

      // Optimistic updates
      addOptimisticGuest: (guest: Guest) => {
        set((state) => {
          state.optimisticGuests.unshift(guest);
        });
      },

      removeOptimisticGuest: (guestId: string) => {
        set((state) => {
          state.optimisticGuests = state.optimisticGuests.filter((g) => g.id !== guestId);
        });
      },

      clearOptimisticGuests: () => {
        set((state) => {
          state.optimisticGuests = [];
        });
      },

      // State management
      setGuests: (guests: Guest[]) => {
        set((state) => {
          state.guests = guests;
        });
      },

      setFilters: (filters: FilterParams) => {
        set((state) => {
          state.filters = filters;
        });
      },

      setPagination: (page: number, size: number) => {
        set((state) => {
          state.currentPage = page;
          state.pageSize = size;
        });
      },

      setLoading: (loading: boolean) => {
        set((state) => {
          state.isLoading = loading;
        });
      },

      setError: (error: string | null) => {
        set((state) => {
          state.error = error;
        });
      },

      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },

      reset: () => {
        set((state) => {
          state.guests = [];
          state.optimisticGuests = [];
          state.totalGuests = 0;
          state.currentPage = 1;
          state.searchResults = [];
          state.searchQuery = "";
          state.guestBookings.clear();
          state.guestPreferences.clear();
          state.filters = {};
          state.error = null;
          state.lastFetch = null;
          state.potentialDuplicates = [];
        });
      },

      // Utility functions
      getGuestById: (guestId: string) => {
        return (
          get().guests.find((g) => g.id === guestId) ||
          get().optimisticGuests.find((g) => g.id === guestId)
        );
      },

      getGuestByEmail: (email: string) => {
        return [...get().guests, ...get().optimisticGuests].find(
          (g) => g.email?.toLowerCase() === email.toLowerCase()
        );
      },

      getGuestByPhone: (phone: string) => {
        const normalizedPhone = phone.replace(/\D/g, "");
        return [...get().guests, ...get().optimisticGuests].find(
          (g) => g.phone?.replace(/\D/g, "") === normalizedPhone
        );
      },

      getVIPGuests: () => {
        return [...get().guests, ...get().optimisticGuests].filter((g) => g.vipStatus === true);
      },

      getBlacklistedGuests: () => {
        return [...get().guests, ...get().optimisticGuests].filter((g) => g.blacklisted === true);
      },

      getFrequentGuests: (minBookings = 5) => {
        return [...get().guests, ...get().optimisticGuests].filter(
          (g) => (g.totalBookings || 0) >= minBookings
        );
      },

      refreshIfNeeded: async () => {
        const { lastFetch } = get();
        const now = Date.now();

        if (!lastFetch || now - lastFetch > CACHE_DURATION) {
          await get().fetchGuests();
        }
      },

      // GDPR compliance (Note: No sensitive data stored locally)
      exportGuestData: async (guestId: string) => {
        const { activeProjectId } = useProjectStore.getState();
        if (!activeProjectId) {
          throw new Error("No active project selected");
        }

        try {
          const response = await apiClient.get(
            `/projects/${activeProjectId}/guests/${guestId}/export`
          );
          return response.data;
        } catch (error: any) {
          useUIStore.getState().toast.error("Failed to export guest data", error.message);
          throw error;
        }
      },

      anonymizeGuest: async (guestId: string) => {
        const { activeProjectId } = useProjectStore.getState();
        if (!activeProjectId) {
          throw new Error("No active project selected");
        }

        const confirmAnonymize = window.confirm(
          "Are you sure you want to anonymize this guest? This action cannot be undone."
        );
        if (!confirmAnonymize) return;

        try {
          await apiClient.post(`/projects/${activeProjectId}/guests/${guestId}/anonymize`);

          // Remove guest from local state
          set((state) => {
            state.guests = state.guests.filter((g) => g.id !== guestId);
            state.guestBookings.delete(guestId);
            state.guestPreferences.delete(guestId);
            state.totalGuests--;
          });

          useUIStore.getState().toast.success("Guest data anonymized");
        } catch (error: any) {
          useUIStore.getState().toast.error("Failed to anonymize guest", error.message);
          throw error;
        }
      },
    })),
    {
      name: "GuestStore",
    }
  )
);

// Selector hooks for better performance
export const useGuests = () =>
  useGuestStore((state) => [...state.guests, ...state.optimisticGuests]);
export const useGuestLoading = () =>
  useGuestStore((state) => state.isLoading || state.isCreating || state.isUpdating);
export const useGuestError = () => useGuestStore((state) => state.error);
export const useGuestSearch = () =>
  useGuestStore((state) => ({
    results: state.searchResults,
    query: state.searchQuery,
    isSearching: state.isSearching,
  }));
export const useVIPGuests = () => useGuestStore((state) => state.getVIPGuests());
export const useBlacklistedGuests = () => useGuestStore((state) => state.getBlacklistedGuests());
export const usePotentialDuplicates = () => useGuestStore((state) => state.potentialDuplicates);
