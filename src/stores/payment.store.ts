/**
 * Payment Store
 * Manages payment processing and reconciliation
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { Money } from "@/lib/money";
import type {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from "@/features/financial/types/financial.types";

interface PaymentFilters {
  startDate?: Date;
  endDate?: Date;
  method?: PaymentMethod;
  status?: PaymentStatus;
  bookingId?: string;
}

interface PaymentMetrics {
  totalProcessed: Money;
  totalPending: Money;
  totalFailed: Money;
  totalFees: Money;
  byMethod: Record<
    PaymentMethod,
    {
      total: Money;
      fees: Money;
      count: number;
      successRate: number;
    }
  >;
  dailyVolume: Array<{
    date: string;
    amount: Money;
    count: number;
  }>;
}

interface CashDrawer {
  openingBalance: Money;
  currentBalance: Money;
  totalCashIn: Money;
  totalCashOut: Money;
  lastReconciliation: Date | null;
  discrepancy: Money | null;
}

interface PaymentState {
  // Data
  payments: Payment[];
  pendingPayments: Payment[];
  selectedPayment: Payment | null;
  filters: PaymentFilters;
  metrics: PaymentMetrics | null;
  cashDrawer: CashDrawer | null;

  // UI State
  isProcessing: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setPayments: (payments: Payment[]) => void;
  addPayment: (payment: Payment) => void;
  updatePaymentStatus: (id: string, status: PaymentStatus, metadata?: any) => void;
  selectPayment: (payment: Payment | null) => void;

  // Payment processing
  addPendingPayment: (payment: Payment) => void;
  confirmPayment: (id: string) => void;
  failPayment: (id: string, reason: string) => void;
  retryPayment: (id: string) => void;

  // Cash drawer
  openCashDrawer: (openingBalance: Money) => void;
  closeCashDrawer: (actualBalance: Money) => void;
  reconcileCash: () => { expected: Money; actual: Money; discrepancy: Money } | null;

  // Filters
  setFilters: (filters: PaymentFilters) => void;
  clearFilters: () => void;

  // Metrics
  calculateMetrics: () => void;

  // UI State
  setProcessing: (processing: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const usePaymentStore = create<PaymentState>()(
  immer((set, get) => ({
    // Initial state
    payments: [],
    pendingPayments: [],
    selectedPayment: null,
    filters: {},
    metrics: null,
    cashDrawer: null,
    isProcessing: false,
    isLoading: false,
    error: null,

    // Actions
    setPayments: (payments) =>
      set((state) => {
        state.payments = payments;
        state.error = null;
      }),

    addPayment: (payment) =>
      set((state) => {
        state.payments.push(payment);
      }),

    updatePaymentStatus: (id, status, metadata) =>
      set((state) => {
        const payment = state.payments.find((p) => p.id === id);
        if (payment) {
          payment.status = status;
          if (metadata) {
            payment.metadata = { ...payment.metadata, ...metadata };
          }
        }

        // Remove from pending if confirmed or failed
        if (status === PaymentStatus.COMPLETED || status === PaymentStatus.FAILED) {
          state.pendingPayments = state.pendingPayments.filter((p) => p.id !== id);
        }
      }),

    selectPayment: (payment) =>
      set((state) => {
        state.selectedPayment = payment;
      }),

    // Payment processing
    addPendingPayment: (payment) =>
      set((state) => {
        state.pendingPayments.push(payment);
      }),

    confirmPayment: (id) =>
      set((state) => {
        const pendingIndex = state.pendingPayments.findIndex((p) => p.id === id);
        if (pendingIndex !== -1) {
          const payment = state.pendingPayments[pendingIndex];
          payment.status = PaymentStatus.COMPLETED;
          state.payments.push(payment);
          state.pendingPayments.splice(pendingIndex, 1);
        }
      }),

    failPayment: (id, reason) =>
      set((state) => {
        const payment =
          state.payments.find((p) => p.id === id) || state.pendingPayments.find((p) => p.id === id);
        if (payment) {
          payment.status = PaymentStatus.FAILED;
          payment.metadata = { ...payment.metadata, failureReason: reason };
        }
      }),

    retryPayment: (id) =>
      set((state) => {
        const payment = state.payments.find((p) => p.id === id);
        if (payment && payment.status === PaymentStatus.FAILED) {
          payment.status = PaymentStatus.PENDING;
          state.pendingPayments.push(payment);
        }
      }),

    // Cash drawer
    openCashDrawer: (openingBalance) =>
      set((state) => {
        state.cashDrawer = {
          openingBalance,
          currentBalance: openingBalance,
          totalCashIn: new Money(0),
          totalCashOut: new Money(0),
          lastReconciliation: new Date(),
          discrepancy: null,
        };
      }),

    closeCashDrawer: (actualBalance) =>
      set((state) => {
        if (state.cashDrawer) {
          const expected = state.cashDrawer.currentBalance;
          const discrepancy = actualBalance.subtract(expected);
          state.cashDrawer.discrepancy = discrepancy;
          state.cashDrawer.lastReconciliation = new Date();
        }
      }),

    reconcileCash: () => {
      const { cashDrawer, payments } = get();
      if (!cashDrawer) return null;

      const cashPayments = payments.filter(
        (p) =>
          p.method === PaymentMethod.CASH &&
          p.status === PaymentStatus.COMPLETED &&
          new Date(p.createdAt) >= cashDrawer.lastReconciliation!
      );

      let totalCash = cashDrawer.openingBalance;
      for (const payment of cashPayments) {
        const amount = payment.amount instanceof Money ? payment.amount : new Money(payment.amount);
        totalCash = totalCash.add(amount);
      }

      return {
        expected: totalCash,
        actual: cashDrawer.currentBalance,
        discrepancy: cashDrawer.currentBalance.subtract(totalCash),
      };
    },

    // Filters
    setFilters: (filters) =>
      set((state) => {
        state.filters = filters;
      }),

    clearFilters: () =>
      set((state) => {
        state.filters = {};
      }),

    // Metrics
    calculateMetrics: () =>
      set((state) => {
        const payments = state.payments;

        if (payments.length === 0) {
          state.metrics = null;
          return;
        }

        let totalProcessed = new Money(0);
        let totalPending = new Money(0);
        let totalFailed = new Money(0);
        let totalFees = new Money(0);

        const byMethod: Partial<Record<PaymentMethod, any>> = {};
        const dailyData: Record<string, { amount: Money; count: number }> = {};

        for (const payment of payments) {
          const amount =
            payment.amount instanceof Money ? payment.amount : new Money(payment.amount);
          const fee =
            payment.processingFee instanceof Money
              ? payment.processingFee
              : new Money(payment.processingFee || 0);

          // Status totals
          if (payment.status === PaymentStatus.COMPLETED) {
            totalProcessed = totalProcessed.add(amount);
          } else if (payment.status === PaymentStatus.PENDING) {
            totalPending = totalPending.add(amount);
          } else if (payment.status === PaymentStatus.FAILED) {
            totalFailed = totalFailed.add(amount);
          }

          totalFees = totalFees.add(fee);

          // Method breakdown
          if (!byMethod[payment.method]) {
            byMethod[payment.method] = {
              total: new Money(0),
              fees: new Money(0),
              count: 0,
              successful: 0,
            };
          }
          byMethod[payment.method]!.total = byMethod[payment.method]!.total.add(amount);
          byMethod[payment.method]!.fees = byMethod[payment.method]!.fees.add(fee);
          byMethod[payment.method]!.count++;
          if (payment.status === PaymentStatus.COMPLETED) {
            byMethod[payment.method]!.successful++;
          }

          // Daily volume
          const date = new Date(payment.createdAt).toISOString().slice(0, 10);
          if (!dailyData[date]) {
            dailyData[date] = { amount: new Money(0), count: 0 };
          }
          if (payment.status === PaymentStatus.COMPLETED) {
            dailyData[date].amount = dailyData[date].amount.add(amount);
            dailyData[date].count++;
          }
        }

        // Calculate success rates
        for (const method in byMethod) {
          const data = byMethod[method as PaymentMethod]!;
          data.successRate = data.count > 0 ? (data.successful / data.count) * 100 : 0;
          delete data.successful;
        }

        const dailyVolume = Object.entries(dailyData)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, data]) => ({ date, ...data }));

        state.metrics = {
          totalProcessed,
          totalPending,
          totalFailed,
          totalFees,
          byMethod: byMethod as Record<PaymentMethod, any>,
          dailyVolume,
        };
      }),

    // UI State
    setProcessing: (processing) =>
      set((state) => {
        state.isProcessing = processing;
      }),

    setLoading: (loading) =>
      set((state) => {
        state.isLoading = loading;
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
        state.isProcessing = false;
        state.isLoading = false;
      }),

    clearError: () =>
      set((state) => {
        state.error = null;
      }),
  }))
);
