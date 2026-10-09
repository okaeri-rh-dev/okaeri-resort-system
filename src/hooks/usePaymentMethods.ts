import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { paymentMethodKeys } from "@/lib/query-keys";
import { db, handleSupabaseError, storage } from "@/lib/supabase";
import type { PaymentMethodConfig } from "@/types";

const paymentMethodsQuery = () =>
  queryOptions({
    queryKey: paymentMethodKeys.list(),
    queryFn: async () => {
      const { data, error } = await db.paymentMethods.all();
      if (error) throw error;
      return data as PaymentMethodConfig[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

// Longer stale time since payment methods rarely change
const activePaymentMethodsQuery = () =>
  queryOptions({
    queryKey: paymentMethodKeys.active(),
    queryFn: async () => {
      const { data, error } = await db.paymentMethods.active();
      if (error) throw error;
      return data as PaymentMethodConfig[];
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
  });

/**
 * Hook to fetch all payment methods (including inactive) for admin settings
 */
export function usePaymentMethods() {
  return useQuery(paymentMethodsQuery());
}

/**
 * Hook to fetch active payment methods only (for guest-facing pages)
 */
export function useActivePaymentMethods() {
  return useQuery(activePaymentMethodsQuery());
}

/**
 * Hook to create a new payment method
 */
export function useCreatePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<PaymentMethodConfig, "id" | "created_at" | "updated_at">) => {
      const { data: result, error } = await db.paymentMethods.create(data);
      if (error) throw error;
      return result as PaymentMethodConfig;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all });
      toast.success("Payment method created", {
        description: `${data.display_name} has been added successfully.`,
      });
    },
    onError: (error) => {
      toast.error("Error creating payment method", {
        description: handleSupabaseError(error),
      });
    },
  });
}

/**
 * Hook to update an existing payment method
 */
export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<PaymentMethodConfig, "id" | "created_at" | "updated_at">>;
    }) => {
      const { data, error } = await db.paymentMethods.update(id, updates);
      if (error) throw error;
      return data as PaymentMethodConfig;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all });
      toast.success("Payment method updated", {
        description: `${data.display_name} has been updated successfully.`,
      });
    },
    onError: (error) => {
      toast.error("Error updating payment method", {
        description: handleSupabaseError(error),
      });
    },
  });
}

/**
 * Hook to soft-delete (deactivate) a payment method
 */
export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db.paymentMethods.delete(id);
      if (error) throw error;
      return data as PaymentMethodConfig;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all });
      toast.success("Payment method deactivated", {
        description: `${data.display_name} has been deactivated.`,
      });
    },
    onError: (error) => {
      toast.error("Error deactivating payment method", {
        description: handleSupabaseError(error),
      });
    },
  });
}

/**
 * Hook to reactivate a deactivated payment method
 */
export function useReactivatePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db.paymentMethods.reactivate(id);
      if (error) throw error;
      return data as PaymentMethodConfig;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all });
      toast.success("Payment method reactivated", {
        description: `${data.display_name} has been reactivated.`,
      });
    },
    onError: (error) => {
      toast.error("Error reactivating payment method", {
        description: handleSupabaseError(error),
      });
    },
  });
}

/**
 * Hook to upload a QR code image for a payment method
 * Uploads to the payment-methods storage bucket and updates the record
 */
export function useUploadQrCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const ext = file.name.split(".").pop() || "png";
      const storagePath = `qr-codes/${id}-${Date.now()}.${ext}`;

      // Upload to storage
      const { url } = await storage.upload("payment-methods", storagePath, file);

      // Update the payment method record with the URL
      const { data, error } = await db.paymentMethods.update(id, {
        qr_code_url: url,
        qr_code_storage_path: storagePath,
      });
      if (error) throw error;
      return data as PaymentMethodConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all });
      toast.success("QR code uploaded successfully");
    },
    onError: (error) => {
      toast.error("Error uploading QR code", {
        description: handleSupabaseError(error),
      });
    },
  });
}

/**
 * Hook to delete a QR code image from a payment method
 */
export function useDeleteQrCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string }) => {
      // Delete from storage
      await storage.delete("payment-methods", storagePath);

      // Clear the URL from the record
      const { data, error } = await db.paymentMethods.update(id, {
        qr_code_url: null,
        qr_code_storage_path: null,
      });
      if (error) throw error;
      return data as PaymentMethodConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all });
      toast.success("QR code removed");
    },
    onError: (error) => {
      toast.error("Error removing QR code", {
        description: handleSupabaseError(error),
      });
    },
  });
}
