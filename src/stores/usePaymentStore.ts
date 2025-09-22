import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, handleSupabaseError } from "@/lib/supabase";
import { uploadReceipt } from "@/lib/storage-security";
import type { Payment, PaymentMethod, PaymentStatus } from "@/types";

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

// Fetch all payments
export const usePayments = () => {
  const { filters, searchQuery, sortBy, sortOrder } = usePaymentStore();

  return useQuery({
    queryKey: ["payments", filters, searchQuery, sortBy, sortOrder],
    queryFn: async () => {
      let query = supabase.from("payments").select(`
        *,
        booking:bookings(
          booking_id,
          booking_reference,
          guest_name,
          guest_email,
          unit_id,
          total_amount,
          units(unit_name)
        )
      `);

      // Apply filters
      if (filters.status) {
        query = query.eq("payment_status", filters.status);
      }
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
};

// Fetch single payment
export const usePayment = (paymentId: string) => {
  return useQuery({
    queryKey: ["payments", paymentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          `
          *,
          booking:bookings(*)
        `
        )
        .eq("payment_id", paymentId)
        .single();

      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    enabled: !!paymentId,
    staleTime: 60000,
  });
};

// Fetch payments for a booking
export const useBookingPayments = (bookingId: string) => {
  return useQuery({
    queryKey: ["payments", "booking", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("booking_id", bookingId)
        .order("payment_date", { ascending: false });

      if (error) throw new Error(handleSupabaseError(error));
      return data || [];
    },
    enabled: !!bookingId,
    staleTime: 60000,
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
      let proof_url = data.proof_url;

      // Upload receipt if provided
      if (receiptFile) {
        const uploadedUrl = await uploadReceipt(receiptFile);
        proof_url = uploadedUrl;
      }

      const { data: newPayment, error } = await supabase
        .from("payments")
        .insert({
          ...data,
          proof_url,
        })
        .select()
        .single();

      if (error) throw new Error(handleSupabaseError(error));

      // Update booking payment status if needed
      const { data: bookingPayments } = await supabase
        .from("payments")
        .select("amount")
        .eq("booking_id", data.booking_id);

      const totalPaid = bookingPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;

      const { data: booking } = await supabase
        .from("bookings")
        .select("total_amount")
        .eq("booking_id", data.booking_id)
        .single();

      if (booking) {
        let paymentStatus: PaymentStatus = "Pending";
        if (totalPaid >= booking.total_amount) {
          paymentStatus = "Completed";
        } else if (totalPaid > 0) {
          paymentStatus = "Partial";
        }

        await supabase
          .from("bookings")
          .update({ payment_status: paymentStatus })
          .eq("booking_id", data.booking_id);
      }

      return newPayment;
    },
    onMutate: async ({ data }) => {
      await queryClient.cancelQueries({ queryKey: ["payments"] });

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
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
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
      let proof_url = updates.proof_url;

      // Upload new receipt if provided
      if (receiptFile) {
        const uploadedUrl = await uploadReceipt(receiptFile);
        proof_url = uploadedUrl;
      }

      const { data, error } = await supabase
        .from("payments")
        .update({
          ...updates,
          proof_url,
        })
        .eq("payment_id", paymentId)
        .select()
        .single();

      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onMutate: async ({ paymentId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["payments"] });

      const previousPayment = queryClient.getQueryData<Payment>(["payments", paymentId]);

      updateOptimistic(paymentId, updates);

      return { previousPayment };
    },
    onError: (_, { paymentId }, context) => {
      if (context?.previousPayment) {
        updateOptimistic(paymentId, context.previousPayment);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
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
      await queryClient.cancelQueries({ queryKey: ["payments"] });
      removeOptimistic(paymentId);
      return { paymentId };
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
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
          verified_at: new Date().toISOString(),
          payment_status: "Completed",
        })
        .eq("payment_id", paymentId)
        .select()
        .single();

      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onMutate: async (paymentId) => {
      await queryClient.cancelQueries({ queryKey: ["payments"] });

      updateOptimistic(paymentId, {
        verified_at: new Date().toISOString(),
        payment_status: "Completed",
      });

      return { paymentId };
    },
    onError: (_, paymentId) => {
      queryClient.invalidateQueries({ queryKey: ["payments", paymentId] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
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
          guest_name,
          units(unit_name)
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
      downloadCSV(csv, `payments-${new Date().toISOString().split("T")[0]}.csv`);
    },
  });
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function convertToCSV(data: any[]): string {
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

  const rows = data.map((payment) => [
    payment.payment_date,
    payment.booking?.booking_reference || "",
    payment.booking?.guest_name || "",
    payment.booking?.units?.unit_name || "",
    payment.amount,
    payment.payment_method || "",
    payment.payment_status || "",
    payment.reference_number || "",
    payment.notes || "",
  ]);

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
