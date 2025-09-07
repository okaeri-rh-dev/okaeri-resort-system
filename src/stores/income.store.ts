/**
 * Income Store
 * Manages booking income and revenue tracking
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist, createJSONStorage } from "zustand/middleware";
import { Money } from "@/lib/money";
import type { Income, BookingPlatform } from "@/features/financial/types/financial.types";

interface IncomeFilters {
  startDate?: Date;
  endDate?: Date;
  platform?: BookingPlatform;
  search?: string;
}

interface RevenueSummary {
  totalGross: Money;
  totalNet: Money;
  totalPlatformFees: Money;
  totalVat: Money;
  totalDiscounts: Money;
  byPlatform: Record<
    BookingPlatform,
    {
      gross: Money;
      net: Money;
      fees: Money;
      count: number;
    }
  >;
  monthlyTrend: Array<{
    month: string;
    gross: Money;
    net: Money;
  }>;
}

interface IncomeState {
  // Data
  incomes: Income[];
  selectedIncome: Income | null;
  filters: IncomeFilters;
  summary: RevenueSummary | null;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions
  setIncomes: (incomes: Income[]) => void;
  addIncome: (income: Income) => void;
  updateIncome: (id: string, updates: Partial<Income>) => void;
  selectIncome: (income: Income | null) => void;

  // Filters
  setFilters: (filters: IncomeFilters) => void;
  clearFilters: () => void;

  // Summary
  setSummary: (summary: RevenueSummary) => void;
  calculateSummary: () => void;

  // Platform-specific calculations
  calculatePlatformMetrics: (platform: BookingPlatform) => {
    totalBookings: number;
    averageBookingValue: Money;
    totalFees: Money;
    effectiveRate: number;
  };

  // UI State
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useIncomeStore = create<IncomeState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      incomes: [],
      selectedIncome: null,
      filters: {},
      summary: null,
      isLoading: false,
      error: null,

      // Actions
      setIncomes: (incomes) =>
        set((state) => {
          state.incomes = incomes;
          state.error = null;
        }),

      addIncome: (income) =>
        set((state) => {
          state.incomes.push(income);
        }),

      updateIncome: (id, updates) =>
        set((state) => {
          const index = state.incomes.findIndex((i) => i.id === id);
          if (index !== -1) {
            state.incomes[index] = { ...state.incomes[index], ...updates };
          }
        }),

      selectIncome: (income) =>
        set((state) => {
          state.selectedIncome = income;
        }),

      // Filters
      setFilters: (filters) =>
        set((state) => {
          state.filters = filters;
        }),

      clearFilters: () =>
        set((state) => {
          state.filters = {};
        }),

      // Summary
      setSummary: (summary) =>
        set((state) => {
          state.summary = summary;
        }),

      calculateSummary: () =>
        set((state) => {
          const incomes = state.incomes;

          if (incomes.length === 0) {
            state.summary = null;
            return;
          }

          let totalGross = new Money(0);
          let totalNet = new Money(0);
          let totalPlatformFees = new Money(0);
          let totalVat = new Money(0);
          let totalDiscounts = new Money(0);

          const byPlatform: Partial<Record<BookingPlatform, any>> = {};
          const monthlyData: Record<string, { gross: Money; net: Money }> = {};

          for (const income of incomes) {
            const gross =
              income.grossAmount instanceof Money
                ? income.grossAmount
                : new Money(income.grossAmount);
            const net =
              income.netAmount instanceof Money ? income.netAmount : new Money(income.netAmount);
            const fees =
              income.platformFees instanceof Money
                ? income.platformFees
                : new Money(income.platformFees || 0);
            const vat =
              income.vatAmount instanceof Money
                ? income.vatAmount
                : new Money(income.vatAmount || 0);
            const discount =
              income.discountAmount instanceof Money
                ? income.discountAmount
                : new Money(income.discountAmount || 0);

            totalGross = totalGross.add(gross);
            totalNet = totalNet.add(net);
            totalPlatformFees = totalPlatformFees.add(fees);
            totalVat = totalVat.add(vat);
            totalDiscounts = totalDiscounts.add(discount);

            // Platform breakdown
            if (!byPlatform[income.platform]) {
              byPlatform[income.platform] = {
                gross: new Money(0),
                net: new Money(0),
                fees: new Money(0),
                count: 0,
              };
            }
            byPlatform[income.platform]!.gross = byPlatform[income.platform]!.gross.add(gross);
            byPlatform[income.platform]!.net = byPlatform[income.platform]!.net.add(net);
            byPlatform[income.platform]!.fees = byPlatform[income.platform]!.fees.add(fees);
            byPlatform[income.platform]!.count++;

            // Monthly trend
            const month = new Date(income.bookingDate).toISOString().slice(0, 7);
            if (!monthlyData[month]) {
              monthlyData[month] = { gross: new Money(0), net: new Money(0) };
            }
            monthlyData[month].gross = monthlyData[month].gross.add(gross);
            monthlyData[month].net = monthlyData[month].net.add(net);
          }

          const monthlyTrend = Object.entries(monthlyData)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, data]) => ({ month, ...data }));

          state.summary = {
            totalGross,
            totalNet,
            totalPlatformFees,
            totalVat,
            totalDiscounts,
            byPlatform: byPlatform as Record<BookingPlatform, any>,
            monthlyTrend,
          };
        }),

      // Platform-specific calculations
      calculatePlatformMetrics: (platform) => {
        const incomes = get().incomes.filter((i) => i.platform === platform);

        if (incomes.length === 0) {
          return {
            totalBookings: 0,
            averageBookingValue: new Money(0),
            totalFees: new Money(0),
            effectiveRate: 0,
          };
        }

        let totalGross = new Money(0);
        let totalFees = new Money(0);

        for (const income of incomes) {
          const gross =
            income.grossAmount instanceof Money
              ? income.grossAmount
              : new Money(income.grossAmount);
          const fees =
            income.platformFees instanceof Money
              ? income.platformFees
              : new Money(income.platformFees || 0);

          totalGross = totalGross.add(gross);
          totalFees = totalFees.add(fees);
        }

        return {
          totalBookings: incomes.length,
          averageBookingValue: totalGross.divide(incomes.length),
          totalFees,
          effectiveRate:
            totalGross.toNumber() > 0 ? (totalFees.toNumber() / totalGross.toNumber()) * 100 : 0,
        };
      },

      // UI State
      setLoading: (loading) =>
        set((state) => {
          state.isLoading = loading;
        }),

      setError: (error) =>
        set((state) => {
          state.error = error;
          state.isLoading = false;
        }),

      clearError: () =>
        set((state) => {
          state.error = null;
        }),
    })),
    {
      name: "income-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        filters: state.filters,
      }),
    }
  )
);
