import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { afterBookingPaymentChange, invalidatePayments } from "@/lib/query-invalidation";
import { paymentKeys } from "@/lib/query-keys";
import { uploadPaymentProof } from "@/lib/storage-security";
import { handleSupabaseError, supabase } from "@/lib/supabase";
import { toManilaDateString } from "@/lib/timezone";
import type { Payment, PaymentMethod, PaymentStatus } from "@/types";
import type { TablesInsert, TablesUpdate } from "@/types/database.types";

// ============================================
// ZUSTAND STORE
// ============================================
interface PaymentFilters {
  status?: PaymentStatus;
  method?: PaymentMethod;
  dateFrom?: string;
  dateTo?: string;
}

interface PaymentStore {
  // Local state
  selectedPayment: Payment | null;
  filters: PaymentFilters;
  searchQuery: string;
  sortBy: "date" | "amount" | "status" | "booking";
  sortOrder: "asc" | "desc";

  // Actions
  setSelectedPayment: (payment: Payment | null) => void;
  setFilters: (filters: PaymentFilters) => void;
  resetFilters: () => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: "date" | "amount" | "status" | "booking") => void;
  setSortOrder: (order: "asc" | "desc") => void;

  // Optimistic updates
  optimisticPayments: Map<string, Payment>;
  addOptimisticPayment: (payment: Payment) => void;
  updateOptimisticPayment: (paymentId: string, updates: Partial<Payment>) => void;
  removeOptimisticPayment: (paymentId: string) => void;
  clearOptimisticPayments: () => void;
}

export const usePaymentStore = create<PaymentStore>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        selectedPayment: null,
        filters: {},
        searchQuery: "",
        sortBy: "date",
        sortOrder: "desc",
        optimisticPayments: new Map(),

        // Actions
        setSelectedPayment: (payment) => set({ selectedPayment: payment }),

        setFilters: (filters) => set({ filters }),

        resetFilters: () => set({ filters: {} }),

        setSearchQuery: (query) => set({ searchQuery: query }),

        setSortBy: (sortBy) => set({ sortBy }),

        setSortOrder: (order) => set({ sortOrder: order }),

        addOptimisticPayment: (payment) =>
          set((state) => {
            const newMap = new Map(state.optimisticPayments);
            newMap.set(payment.payment_id, payment);
            return { optimisticPayments: newMap };
          }),

        updateOptimisticPayment: (paymentId, updates) =>
          set((state) => {
            const newMap = new Map(state.optimisticPayments);
            const existing = newMap.get(paymentId);
            if (existing) {
              newMap.set(paymentId, { ...existing, ...updates });
            }
            return { optimisticPayments: newMap };
          }),

        removeOptimisticPayment: (paymentId) =>
          set((state) => {
            const newMap = new Map(state.optimisticPayments);
            newMap.delete(paymentId);
            return { optimisticPayments: newMap };
          }),

        clearOptimisticPayments: () => set({ optimisticPayments: new Map() }),
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

// ============================================
// TANSTACK QUERY HOOKS
// ============================================

// One payment with its booking and guest; the detail and edit routes and useEntityEdit share this cache entry
export const paymentDetailQuery = (paymentId: string) =>
  queryOptions({
    queryKey: paymentKeys.detail(paymentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          `
          *,
          booking:bookings(
            booking_id,
            booking_reference,
            check_in,
            check_out,
            total_amount,
            guest_id,
            guest_name,
            guest:guests(guest_name, email, phone_number)
          )
        `
        )
        .eq("payment_id", paymentId)
        .single();

      if (error) throw new Error(`Failed to load payment: ${handleSupabaseError(error)}`);
      return data;
    },
    staleTime: 30000,
  });

// Fetch all payments
const paymentListQuery = ({
  filters,
  searchQuery,
  sortBy,
  sortOrder,
}: Pick<PaymentStore, "filters" | "searchQuery" | "sortBy" | "sortOrder">) =>
  queryOptions({
    queryKey: paymentKeys.list({ filters, searchQuery, sortBy, sortOrder }),
    queryFn: async () => {
      let query = supabase
        .from("payments")
        .select(
          `
        *,
        booking:bookings(
          booking_id,
          booking_reference,
          guest_name,
          contact_number,
          email,
          num_guests,
          check_in,
          check_out,
          total_amount,
          payment_status,
          booking_status,
          created_at,
          updated_at
        )
      `
        )
        .neq("status", "Deleted");

      // Apply filters
      // Note: payment_status is not a column in payments table
      if (filters.method) {
        query = query.eq("payment_method", filters.method);
      }
      if (filters.dateFrom) {
        query = query.gte("payment_date", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("payment_date", filters.dateTo);
      }

      // Apply search
      if (searchQuery) {
        query = query.or(`
          notes.ilike.%${searchQuery}%,
          reference_number.ilike.%${searchQuery}%
        `);
      }

      // Apply sorting
      const column = {
        date: "payment_date",
        amount: "amount",
        status: "payment_status",
        booking: "booking_id",
      }[sortBy];

      query = query.order(column, { ascending: sortOrder === "asc" });

      const { data, error } = await query;
      if (error) throw new Error(handleSupabaseError(error));

      return data || [];
    },
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
  });

export const usePayments = () => {
  const { filters, searchQuery, sortBy, sortOrder } = usePaymentStore();

  return useQuery(paymentListQuery({ filters, searchQuery, sortBy, sortOrder }));
};

// Fetch single payment
export const usePayment = (paymentId: string) => {
  return useQuery({ ...paymentDetailQuery(paymentId), enabled: !!paymentId });
};

// Fetch payments for a booking
const bookingPaymentsQuery = (bookingId: string) =>
  queryOptions({
    queryKey: paymentKeys.byBooking(bookingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("booking_id", bookingId)
        .neq("status", "Deleted")
        .order("payment_date", { ascending: false });

      if (error) throw new Error(handleSupabaseError(error));
      return data || [];
    },
    staleTime: 60000,
  });

export const useBookingPayments = (bookingId: string) => {
  return useQuery({
    ...bookingPaymentsQuery(bookingId),
    enabled: !!bookingId,
  });
};

// Create payment
export const useCreatePayment = () => {
  const queryClient = useQueryClient();
  const addOptimistic = usePaymentStore((state) => state.addOptimisticPayment);

  return useMutation({
    mutationFn: async ({
      data,
      receiptFile,
    }: {
      data: Omit<Payment, "payment_id" | "created_at">;
      receiptFile?: File;
    }) => {
      let receipt_url = data.proof_url || null;

      // Upload receipt if provided
      if (receiptFile && data.booking_id) {
        const uploadedUrl = await uploadPaymentProof(receiptFile, data.booking_id);
        receipt_url = uploadedUrl.url;
      }

      const { data: newPayment, error } = await supabase
        .from("payments")
        .insert({
          booking_id: data.booking_id,
          amount: data.amount,
          payment_method: data.payment_method || "Cash",
          payment_date: data.payment_date,
          proof_url: receipt_url,
          notes: data.notes || null,
        } satisfies TablesInsert<"payments">)
        .select()
        .single();

      if (error) throw new Error(handleSupabaseError(error));

      // Update booking payment status if needed
      let bookingPayments = null;
      if (data.booking_id) {
        const { data: payments } = await supabase
          .from("payments")
          .select("amount")
          .eq("booking_id", data.booking_id);
        bookingPayments = payments;
      }

      const totalPaid = bookingPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;

      let booking = null;
      if (data.booking_id) {
        const { data: bookingData } = await supabase
          .from("bookings")
          .select("total_amount")
          .eq("booking_id", data.booking_id)
          .single();
        booking = bookingData;
      }

      if (booking) {
        let paymentStatus: PaymentStatus = "Pending";
        if (totalPaid >= booking.total_amount) {
          paymentStatus = "Completed";
        } else if (totalPaid > 0) {
          paymentStatus = "Partial";
        }

        if (data.booking_id) {
          await supabase
            .from("bookings")
            .update({ payment_status: paymentStatus } satisfies TablesUpdate<"bookings">)
            .eq("booking_id", data.booking_id);
        }
      }

      return newPayment;
    },
    onMutate: async ({ data }) => {
      await queryClient.cancelQueries({ queryKey: paymentKeys.all });

      const optimisticPayment: Payment = {
        ...data,
        payment_id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
      };

      addOptimistic(optimisticPayment);

      return { optimisticPayment };
    },
    onError: (_, __, context) => {
      if (context?.optimisticPayment) {
        usePaymentStore.getState().removeOptimisticPayment(context.optimisticPayment.payment_id);
      }
    },
    onSettled: () => {
      afterBookingPaymentChange();
    },
  });
};

// Update payment
export const useUpdatePayment = () => {
  const queryClient = useQueryClient();
  const updateOptimistic = usePaymentStore((state) => state.updateOptimisticPayment);

  return useMutation({
    mutationFn: async ({
      paymentId,
      updates,
      receiptFile,
    }: {
      paymentId: string;
      updates: Partial<Omit<Payment, "payment_id" | "created_at">>;
      receiptFile?: File;
    }) => {
      let proof_url = updates.proof_url || null;

      // Upload new receipt if provided
      if (receiptFile) {
        // Get booking_id for the payment to use in upload path
        const { data: payment } = await supabase
          .from("payments")
          .select("booking_id")
          .eq("payment_id", paymentId)
          .single();

        if (payment && payment.booking_id) {
          const uploadedUrl = await uploadPaymentProof(receiptFile, payment.booking_id);
          proof_url = uploadedUrl.url;
        }
      }

      const { data, error } = await supabase
        .from("payments")
        .update({
          ...updates,
          proof_url,
        } satisfies TablesUpdate<"payments">)
        .eq("payment_id", paymentId)
        .select()
        .single();

      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onMutate: async ({ paymentId, updates }) => {
      await queryClient.cancelQueries({ queryKey: paymentKeys.all });

      const previousPayment = queryClient.getQueryData<Payment>(paymentKeys.detail(paymentId));

      updateOptimistic(paymentId, updates);

      return { previousPayment };
    },
    onError: (_, { paymentId }, context) => {
      if (context?.previousPayment) {
        updateOptimistic(paymentId, context.previousPayment);
      }
    },
    onSettled: () => {
      afterBookingPaymentChange();
    },
  });
};

// Delete payment
export const useDeletePayment = () => {
  const queryClient = useQueryClient();
  const removeOptimistic = usePaymentStore((state) => state.removeOptimisticPayment);

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase.from("payments").delete().eq("payment_id", paymentId);

      if (error) throw new Error(handleSupabaseError(error));
    },
    onMutate: async (paymentId) => {
      await queryClient.cancelQueries({ queryKey: paymentKeys.all });
      removeOptimistic(paymentId);
      return { paymentId };
    },
    onError: () => {
      invalidatePayments();
    },
    onSuccess: () => {
      afterBookingPaymentChange();
    },
  });
};

// Soft-delete payment (sets status to 'Deleted' instead of removing the row)
export const useSoftDeletePayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("payments")
        .update({ status: "Deleted" } satisfies TablesUpdate<"payments">)
        .eq("payment_id", paymentId);

      if (error) throw new Error(handleSupabaseError(error));
    },
    onMutate: async (paymentId) => {
      await queryClient.cancelQueries({ queryKey: paymentKeys.all });

      // Store previous data for rollback
      const previousPayments = queryClient.getQueryData(paymentKeys.all);
      return { previousPayments, paymentId };
    },
    onError: () => {
      invalidatePayments();
    },
    onSuccess: () => {
      afterBookingPaymentChange();
    },
  });
};

// Verify payment
export const useVerifyPayment = () => {
  const queryClient = useQueryClient();
  const updateOptimistic = usePaymentStore((state) => state.updateOptimisticPayment);

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { data, error } = await supabase
        .from("payments")
        .update({
          notes: `Verified on ${new Date().toISOString()}`,
        } satisfies TablesUpdate<"payments">)
        .eq("payment_id", paymentId)
        .select()
        .single();

      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onMutate: async (paymentId) => {
      await queryClient.cancelQueries({ queryKey: paymentKeys.all });

      updateOptimistic(paymentId, {
        notes: `Verified on ${new Date().toISOString()}`,
      });

      return { paymentId };
    },
    onError: () => {
      invalidatePayments();
    },
    onSettled: () => {
      afterBookingPaymentChange();
    },
  });
};

// Export payments
export const useExportPayments = () => {
  return useMutation({
    mutationFn: async (dateRange?: { from: Date; to: Date }) => {
      let query = supabase.from("payments").select(`
        *,
        booking:bookings(
          booking_reference,
          guest_name
        )
      `);

      if (dateRange) {
        query = query
          .gte("payment_date", dateRange.from.toISOString())
          .lte("payment_date", dateRange.to.toISOString());
      }

      const { data, error } = await query.order("payment_date", { ascending: false });

      if (error) throw new Error(handleSupabaseError(error));

      // Convert to CSV
      const csv = convertToCSV(data || []);
      downloadCSV(csv, `payments-${toManilaDateString(new Date())}.csv`);
    },
  });
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function convertToCSV(data: unknown[]): string {
  if (data.length === 0) return "";

  const headers = [
    "Payment Date",
    "Booking Reference",
    "Guest Name",
    "Unit",
    "Amount",
    "Payment Method",
    "Status",
    "Reference Number",
    "Notes",
  ];

  const rows = data.map((payment: unknown) => {
    const p = payment as Record<string, unknown>;
    const booking = p.booking as Record<string, unknown> | undefined;
    return [
      p.payment_date,
      booking?.booking_reference || "",
      booking?.guest_name || "",
      "N/A", // Unit info not available in payment export (bookings now use booking_units junction table)
      p.amount,
      p.payment_method || "",
      p.payment_status || "",
      p.reference_number || "",
      p.notes || "",
    ];
  });

  return [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
