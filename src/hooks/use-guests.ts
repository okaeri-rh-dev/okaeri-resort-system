/**
 * Custom hooks for guest operations using TanStack Query
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, invalidateQueries } from "@/lib/query-client";
import { useGuestStore } from "@/stores/guestStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import type { Guest, CreateGuestData, UpdateGuestData } from "@/types/common";

/**
 * Fetch all guests for the active project
 */
export function useGuests(filters?: any) {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const fetchGuests = useGuestStore((state) => state.fetchGuests);

  return useQuery({
    queryKey: ["guests", activeProjectId, filters],
    queryFn: () => fetchGuests(filters),
    enabled: !!activeProjectId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch a single guest by ID
 */
export function useGuest(guestId: string) {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const guestStore = useGuestStore();

  return useQuery({
    queryKey: ["guests", activeProjectId, "detail", guestId],
    queryFn: async () => {
      const existingGuest = guestStore.guests.find((g) => g.id === guestId);
      if (existingGuest && Date.now() - guestStore.lastFetch < 60000) {
        return existingGuest;
      }
      return guestStore.fetchGuestById(guestId);
    },
    enabled: !!activeProjectId && !!guestId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Search guests with fuzzy matching
 */
export function useSearchGuests(query: string) {
  const searchGuests = useGuestStore((state) => state.searchGuests);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);

  return useQuery({
    queryKey: ["guests", activeProjectId, "search", query],
    queryFn: () => searchGuests(query),
    enabled: !!query && query.length >= 2 && !!activeProjectId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Create a new guest with duplicate detection
 */
export function useCreateGuest() {
  const queryClient = useQueryClient();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const createGuest = useGuestStore((state) => state.createGuest);
  const toast = useUIStore((state) => state.toast);

  return useMutation({
    mutationKey: ["guests", "create", activeProjectId],
    mutationFn: async (data: CreateGuestData) => {
      // Check for duplicates before creating
      const guestStore = useGuestStore.getState();
      const duplicate = await guestStore.checkDuplicate(data.email, data.phone, data.name);

      if (duplicate) {
        const confirmMerge = window.confirm(
          `A guest with similar details already exists (${duplicate.name}). Would you like to merge?`
        );
        if (confirmMerge) {
          return guestStore.updateGuest(duplicate.id, data);
        }
      }

      return createGuest(data);
    },
    onSuccess: () => {
      toast.success("Guest created successfully");
      queryClient.invalidateQueries({ queryKey: ["guests", activeProjectId] });
    },
    onError: (err) => {
      toast.error("Failed to create guest", err.message);
    },
  });
}

/**
 * Update an existing guest
 */
export function useUpdateGuest() {
  const queryClient = useQueryClient();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const updateGuest = useGuestStore((state) => state.updateGuest);
  const toast = useUIStore((state) => state.toast);

  return useMutation({
    mutationKey: ["guests", "update", activeProjectId],
    mutationFn: ({ id, data }: { id: string; data: UpdateGuestData }) => updateGuest(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({
        queryKey: ["guests", activeProjectId, "detail", id],
      });

      const previousGuest = queryClient.getQueryData(["guests", activeProjectId, "detail", id]);

      queryClient.setQueryData(["guests", activeProjectId, "detail", id], (old: Guest) => ({
        ...old,
        ...data,
        updatedAt: new Date().toISOString(),
      }));

      return { previousGuest };
    },
    onError: (err, variables, context) => {
      if (context?.previousGuest) {
        queryClient.setQueryData(
          ["guests", activeProjectId, "detail", variables.id],
          context.previousGuest
        );
      }
      toast.error("Failed to update guest", err.message);
    },
    onSuccess: (data, variables) => {
      toast.success("Guest updated successfully");
      queryClient.invalidateQueries({
        queryKey: ["guests", activeProjectId, "detail", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["guests", activeProjectId] });
    },
  });
}

/**
 * Delete a guest (GDPR compliant)
 */
export function useDeleteGuest() {
  const queryClient = useQueryClient();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const deleteGuest = useGuestStore((state) => state.deleteGuest);
  const toast = useUIStore((state) => state.toast);

  return useMutation({
    mutationKey: ["guests", "delete", activeProjectId],
    mutationFn: (guestId: string) => deleteGuest(guestId),
    onSuccess: () => {
      toast.success("Guest deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["guests", activeProjectId] });
    },
    onError: (err) => {
      toast.error("Failed to delete guest", err.message);
    },
  });
}

/**
 * Merge duplicate guests
 */
export function useMergeGuests() {
  const queryClient = useQueryClient();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const mergeGuests = useGuestStore((state) => state.mergeGuests);
  const toast = useUIStore((state) => state.toast);

  return useMutation({
    mutationKey: ["guests", "merge", activeProjectId],
    mutationFn: ({ primaryId, duplicateIds }: { primaryId: string; duplicateIds: string[] }) =>
      mergeGuests(primaryId, duplicateIds),
    onSuccess: () => {
      toast.success("Guests merged successfully");
      queryClient.invalidateQueries({ queryKey: ["guests", activeProjectId] });
    },
    onError: (err) => {
      toast.error("Failed to merge guests", err.message);
    },
  });
}

/**
 * Get guest bookings
 */
export function useGuestBookings(guestId: string) {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const getGuestBookings = useGuestStore((state) => state.getGuestBookings);

  return useQuery({
    queryKey: ["guests", activeProjectId, guestId, "bookings"],
    queryFn: () => getGuestBookings(guestId),
    enabled: !!activeProjectId && !!guestId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Toggle VIP status
 */
export function useToggleVIP() {
  const queryClient = useQueryClient();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const toggleVIP = useGuestStore((state) => state.toggleVIP);
  const toast = useUIStore((state) => state.toast);

  return useMutation({
    mutationKey: ["guests", "toggleVIP", activeProjectId],
    mutationFn: (guestId: string) => toggleVIP(guestId),
    onMutate: async (guestId) => {
      await queryClient.cancelQueries({
        queryKey: ["guests", activeProjectId, "detail", guestId],
      });

      const previousGuest = queryClient.getQueryData<Guest>([
        "guests",
        activeProjectId,
        "detail",
        guestId,
      ]);

      if (previousGuest) {
        queryClient.setQueryData(["guests", activeProjectId, "detail", guestId], {
          ...previousGuest,
          isVIP: !previousGuest.isVIP,
        });
      }

      return { previousGuest };
    },
    onError: (err, guestId, context) => {
      if (context?.previousGuest) {
        queryClient.setQueryData(
          ["guests", activeProjectId, "detail", guestId],
          context.previousGuest
        );
      }
      toast.error("Failed to update VIP status", err.message);
    },
    onSuccess: (data, guestId) => {
      const guest = queryClient.getQueryData<Guest>(["guests", activeProjectId, "detail", guestId]);
      toast.success(guest?.isVIP ? "Guest marked as VIP" : "VIP status removed");
      queryClient.invalidateQueries({
        queryKey: ["guests", activeProjectId, "detail", guestId],
      });
    },
  });
}

/**
 * Toggle blacklist status
 */
export function useToggleBlacklist() {
  const queryClient = useQueryClient();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const toggleBlacklist = useGuestStore((state) => state.toggleBlacklist);
  const toast = useUIStore((state) => state.toast);

  return useMutation({
    mutationKey: ["guests", "toggleBlacklist", activeProjectId],
    mutationFn: ({ guestId, reason }: { guestId: string; reason?: string }) =>
      toggleBlacklist(guestId, reason),
    onSuccess: (data, variables) => {
      const guest = queryClient.getQueryData<Guest>([
        "guests",
        activeProjectId,
        "detail",
        variables.guestId,
      ]);
      toast.warning(
        guest?.isBlacklisted ? "Guest added to blacklist" : "Guest removed from blacklist"
      );
      queryClient.invalidateQueries({
        queryKey: ["guests", activeProjectId, "detail", variables.guestId],
      });
      queryClient.invalidateQueries({ queryKey: ["guests", activeProjectId] });
    },
    onError: (err) => {
      toast.error("Failed to update blacklist status", err.message);
    },
  });
}

/**
 * Export guest data for GDPR compliance
 */
export function useExportGuestData() {
  const exportGuestData = useGuestStore((state) => state.exportGuestData);
  const toast = useUIStore((state) => state.toast);

  return useMutation({
    mutationKey: ["guests", "export"],
    mutationFn: (guestId: string) => exportGuestData(guestId),
    onSuccess: (data, guestId) => {
      // Create and download JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `guest-data-${guestId}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Guest data exported successfully");
    },
    onError: (err) => {
      toast.error("Failed to export guest data", err.message);
    },
  });
}

/**
 * Anonymize guest data for GDPR compliance
 */
export function useAnonymizeGuest() {
  const queryClient = useQueryClient();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const anonymizeGuest = useGuestStore((state) => state.anonymizeGuest);
  const toast = useUIStore((state) => state.toast);

  return useMutation({
    mutationKey: ["guests", "anonymize", activeProjectId],
    mutationFn: (guestId: string) => anonymizeGuest(guestId),
    onSuccess: (data, guestId) => {
      toast.success("Guest data anonymized successfully");
      queryClient.invalidateQueries({
        queryKey: ["guests", activeProjectId, "detail", guestId],
      });
      queryClient.invalidateQueries({ queryKey: ["guests", activeProjectId] });
    },
    onError: (err) => {
      toast.error("Failed to anonymize guest data", err.message);
    },
  });
}
