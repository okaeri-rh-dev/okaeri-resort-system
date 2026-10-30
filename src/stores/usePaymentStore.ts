import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import {
  appendVerificationNote,
  createPayment,
  softDeletePayment,
  updatePayment,
  type PaymentChanges,
  type PaymentInput,
} from "@/lib/payments";
import { afterBookingPaymentChange } from "@/lib/query-invalidation";
import { paymentKeys } from "@/lib/query-keys";
import { throwDetailLoadError } from "@/lib/detail-load-error";
import { handleSupabaseError, supabase, supabaseAuth } from "@/lib/supabase";
import { toManilaDateString } from "@/lib/timezone";
import type { PaymentMethod, PaymentStatus } from "@/types";

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

      if (error) throwDetailLoadError(error, "payment");
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

      // Apply sorting
      const column = {
        date: "payment_date",
        amount: "amount",
        status: "status",
        booking: "booking_id",
      }[sortBy];

      query = query.order(column, { ascending: sortOrder === "asc" });

      const { data, error } = await query;
      if (error) throw new Error(handleSupabaseError(error));

      const search = searchQuery.trim().toLowerCase();
      if (!search) return data || [];

      return (data || []).filter((payment) =>
        [payment.notes, payment.booking?.booking_reference, payment.booking?.guest_name].some(
          (field) => field?.toLowerCase().includes(search)
        )
      );
    },
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
  });

export const usePayments = () => {
  const { filters, searchQuery, sortBy, sortOrder } = usePaymentStore();

  return useQuery(paymentListQuery({ filters, searchQuery, sortBy, sortOrder }));
};

// Mutations go through the Payment module; the database derives the booking's payment status.

export const useCreatePayment = () =>
  useMutation({
    mutationFn: ({ input, receiptFile }: { input: PaymentInput; receiptFile?: File }) =>
      createPayment(supabase, input, receiptFile),
    onSettled: () => {
      afterBookingPaymentChange();
    },
  });

export const useUpdatePayment = () =>
  useMutation({
    mutationFn: ({
      paymentId,
      changes,
      receiptFile,
    }: {
      paymentId: string;
      changes: PaymentChanges;
      receiptFile?: File;
    }) => updatePayment(supabase, paymentId, changes, receiptFile),
    onSettled: () => {
      afterBookingPaymentChange();
    },
  });

export const useSoftDeletePayment = () =>
  useMutation({
    mutationFn: (paymentId: string) => softDeletePayment(supabase, paymentId),
    onSettled: () => {
      afterBookingPaymentChange();
    },
  });

export const useVerifyPayment = () =>
  useMutation({
    mutationFn: async (paymentId: string) => {
      const {
        data: { user },
      } = await supabaseAuth.getUser();
      return appendVerificationNote(supabase, paymentId, user?.email ?? "unknown user");
    },
    onSettled: () => {
      afterBookingPaymentChange();
    },
  });

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
