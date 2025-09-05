/**
 * FinancialMetricsCard Component Tests
 * Phase 2.1 - RED Phase: Comprehensive test suite for financial metrics display
 *
 * @description Tests for financial metrics card component displaying revenue,
 * expenses, payments, and Philippine tax compliance for Okaeri Resort
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";

// Types and test utilities
import type { FinancialMetrics, PhilippineCurrency } from "../../types";
import { DashboardTestProvider } from "@tests/utils/dashboard-providers";
import { DashboardMockGenerator } from "@tests/utils/dashboard-mocks";
import { createPHPCurrency } from "@tests/utils/metric-helpers";
import {
  expectPhilippineCurrency,
  expectPercentageDisplay,
  expectTrendIndicator,
  expectBIRCompliance,
} from "@tests/utils/dashboard-assertions";

// Component under test (does not exist yet - RED phase)
import { FinancialMetricsCard } from "../../components/FinancialMetricsCard";

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe("FinancialMetricsCard Component", () => {
  let mockGenerator: DashboardMockGenerator;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    mockGenerator = new DashboardMockGenerator();
    user = userEvent.setup();
    vi.clearAllMocks();
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Basic Rendering and Display", () => {
    it("should render financial metrics card with title", () => {
      const financialMetrics = mockGenerator.withRevenue(48500).build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("financial-metrics-card")).toBeInTheDocument();
      expect(screen.getByText("Financial Overview")).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Financial metrics" })).toBeInTheDocument();
    });

    it("should display today's revenue in Philippine peso format", () => {
      const financialMetrics = mockGenerator.withRevenue(48500).build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      const revenueElement = screen.getByTestId("revenue-today");
      expect(revenueElement).toHaveTextContent("₱48,500.00");
      expect(revenueElement).toHaveAttribute("data-currency", "PHP");
    });

    it("should show revenue breakdown by period", () => {
      const financialMetrics = mockGenerator
        .withRevenue(48500)
        .withWeekRevenue(285000)
        .withMonthRevenue(1250000)
        .build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("revenue-today")).toHaveTextContent("₱48,500.00");
      expect(screen.getByTestId("revenue-week")).toHaveTextContent("₱285,000.00");
      expect(screen.getByTestId("revenue-month")).toHaveTextContent("₱1,250,000.00");
    });

    it("should display revenue trend indicator", () => {
      const financialMetrics = mockGenerator.withRevenueTrend("up", 15.5).build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      const trendElement = screen.getByTestId("revenue-trend");
      expect(trendElement).toHaveTextContent("↗ 15.5%");
      expect(trendElement).toHaveAttribute("aria-label", "Revenue up by 15.5%");
      expect(trendElement).toHaveClass("text-green-600");
    });
  });

  describe("Philippine Payment Methods Display", () => {
    it("should display payment breakdown by method", () => {
      const financialMetrics = mockGenerator
        .withPaymentMethods({
          cash: 15000,
          gcash: 12500,
          maya: 8000,
          bank_transfer: 10000,
          credit_card: 3000,
          pending: 0,
        })
        .build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("payment-cash")).toHaveTextContent("₱15,000.00");
      expect(screen.getByTestId("payment-gcash")).toHaveTextContent("₱12,500.00");
      expect(screen.getByTestId("payment-maya")).toHaveTextContent("₱8,000.00");
      expect(screen.getByTestId("payment-bank-transfer")).toHaveTextContent("₱10,000.00");
    });

    it("should calculate payment method percentages", () => {
      const financialMetrics = mockGenerator
        .withPaymentMethods({
          cash: 20000,
          gcash: 15000,
          maya: 10000,
          bank_transfer: 5000,
          credit_card: 0,
          pending: 0,
        })
        .build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("payment-cash-percentage")).toHaveTextContent("40.0%");
      expect(screen.getByTestId("payment-gcash-percentage")).toHaveTextContent("30.0%");
      expect(screen.getByTestId("payment-maya-percentage")).toHaveTextContent("20.0%");
      expect(screen.getByTestId("payment-bank-transfer-percentage")).toHaveTextContent("10.0%");
    });

    it("should highlight pending payments when present", () => {
      const financialMetrics = mockGenerator
        .withPaymentMethods({
          cash: 20000,
          gcash: 15000,
          maya: 10000,
          bank_transfer: 5000,
          credit_card: 0,
          pending: 8500,
        })
        .build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      const pendingElement = screen.getByTestId("payment-pending");
      expect(pendingElement).toHaveTextContent("₱8,500.00");
      expect(pendingElement).toHaveClass("text-yellow-600", "font-semibold");
      expect(screen.getByTestId("pending-alert")).toBeInTheDocument();
    });

    it("should display payment method icons for easy recognition", () => {
      const financialMetrics = mockGenerator
        .withPaymentMethods({
          cash: 15000,
          gcash: 12500,
          maya: 8000,
          bank_transfer: 10000,
          credit_card: 3000,
          pending: 0,
        })
        .build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("icon-gcash")).toHaveAttribute("aria-label", "GCash payment");
      expect(screen.getByTestId("icon-maya")).toHaveAttribute("aria-label", "Maya payment");
      expect(screen.getByTestId("icon-cash")).toHaveAttribute("aria-label", "Cash payment");
    });
  });

  describe("Expense Tracking and Budget Management", () => {
    it("should display monthly expenses vs budget", () => {
      const financialMetrics = mockGenerator.withExpenses(850000, 1000000).build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("expenses-monthly")).toHaveTextContent("₱850,000.00");
      expect(screen.getByTestId("expenses-budget")).toHaveTextContent("₱1,000,000.00");
      expect(screen.getByTestId("budget-utilization")).toHaveTextContent("85%");
    });

    it("should show expense categories breakdown", () => {
      const financialMetrics = mockGenerator
        .withExpenseCategories([
          {
            id: "utilities",
            name: "Utilities",
            budgetAllocated: createPHPCurrency(150000),
            spent: createPHPCurrency(125000),
            variance: -16.67,
            subcategories: {
              utilities: createPHPCurrency(125000),
              maintenance: createPHPCurrency(0),
              supplies: createPHPCurrency(0),
              staff: createPHPCurrency(0),
              marketing: createPHPCurrency(0),
              other: createPHPCurrency(0),
            },
          },
        ])
        .build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByText("Utilities")).toBeInTheDocument();
      expect(screen.getByTestId("category-utilities-spent")).toHaveTextContent("₱125,000.00");
      expect(screen.getByTestId("category-utilities-budget")).toHaveTextContent("₱150,000.00");
      expect(screen.getByTestId("category-utilities-variance")).toHaveTextContent("-16.67%");
    });

    it("should highlight over-budget categories", () => {
      const financialMetrics = mockGenerator
        .withExpenseCategories([
          {
            id: "marketing",
            name: "Marketing",
            budgetAllocated: createPHPCurrency(50000),
            spent: createPHPCurrency(65000),
            variance: 30,
            subcategories: {
              utilities: createPHPCurrency(0),
              maintenance: createPHPCurrency(0),
              supplies: createPHPCurrency(0),
              staff: createPHPCurrency(0),
              marketing: createPHPCurrency(65000),
              other: createPHPCurrency(0),
            },
          },
        ])
        .build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      const varianceElement = screen.getByTestId("category-marketing-variance");
      expect(varianceElement).toHaveTextContent("+30%");
      expect(varianceElement).toHaveClass("text-red-600", "font-semibold");
      expect(screen.getByTestId("over-budget-alert")).toBeInTheDocument();
    });
  });

  describe("Philippine Tax Compliance (BIR)", () => {
    it("should display VAT collection (12%)", () => {
      const financialMetrics = mockGenerator
        .withTaxation({
          vatCollected: 5820, // 12% of 48500
          withHoldingTax: 0,
          occupancyTax: 485, // 1% local tax
          quarterlyEstimate: 87300,
          nextFilingDate: new Date("2024-04-15"),
        })
        .build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("vat-collected")).toHaveTextContent("₱5,820.00");
      expect(screen.getByTestId("vat-rate")).toHaveTextContent("12%");
      expect(screen.getByTestId("vat-label")).toHaveTextContent("VAT Collected (12%)");
    });

    it("should show withholding tax when applicable", () => {
      const financialMetrics = mockGenerator
        .withTaxation({
          vatCollected: 5820,
          withHoldingTax: 2425, // 5% for rental income
          occupancyTax: 485,
          quarterlyEstimate: 87300,
          nextFilingDate: new Date("2024-04-15"),
        })
        .build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("withholding-tax")).toHaveTextContent("₱2,425.00");
      expect(screen.getByTestId("withholding-label")).toHaveTextContent("Withholding Tax");
    });

    it("should display local government occupancy tax", () => {
      const financialMetrics = mockGenerator
        .withTaxation({
          vatCollected: 5820,
          withHoldingTax: 0,
          occupancyTax: 485,
          quarterlyEstimate: 87300,
          nextFilingDate: new Date("2024-04-15"),
        })
        .build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("occupancy-tax")).toHaveTextContent("₱485.00");
      expect(screen.getByTestId("occupancy-tax-label")).toHaveTextContent("LGU Occupancy Tax");
    });

    it("should show BIR filing reminders", () => {
      const nextFilingDate = new Date();
      nextFilingDate.setDate(nextFilingDate.getDate() + 5); // 5 days from now

      const financialMetrics = mockGenerator
        .withTaxation({
          vatCollected: 5820,
          withHoldingTax: 0,
          occupancyTax: 485,
          quarterlyEstimate: 87300,
          nextFilingDate,
        })
        .build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("bir-filing-reminder")).toBeInTheDocument();
      expect(screen.getByText("BIR Filing Due in 5 days")).toBeInTheDocument();
      expect(screen.getByTestId("quarterly-estimate")).toHaveTextContent("₱87,300.00");
    });

    it("should calculate and display total tax obligations", () => {
      const financialMetrics = mockGenerator
        .withTaxation({
          vatCollected: 5820,
          withHoldingTax: 2425,
          occupancyTax: 485,
          quarterlyEstimate: 87300,
          nextFilingDate: new Date("2024-04-15"),
        })
        .build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      const totalTax = 5820 + 2425 + 485;
      expect(screen.getByTestId("total-tax-obligations")).toHaveTextContent(
        `₱${totalTax.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
      );
    });
  });

  describe("Profitability Metrics", () => {
    it("should display gross and net profit", () => {
      const financialMetrics = mockGenerator
        .withProfitability({
          grossProfit: 28500,
          netProfit: 18500,
          margin: 38.14,
          averageRoomRate: 2500,
          revPAR: 1875,
        })
        .build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("gross-profit")).toHaveTextContent("₱28,500.00");
      expect(screen.getByTestId("net-profit")).toHaveTextContent("₱18,500.00");
      expect(screen.getByTestId("profit-margin")).toHaveTextContent("38.14%");
    });

    it("should show average room rate (ARR) and RevPAR", () => {
      const financialMetrics = mockGenerator
        .withProfitability({
          grossProfit: 28500,
          netProfit: 18500,
          margin: 38.14,
          averageRoomRate: 2500,
          revPAR: 1875,
        })
        .build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("average-room-rate")).toHaveTextContent("₱2,500.00");
      expect(screen.getByTestId("revpar")).toHaveTextContent("₱1,875.00");
      expect(screen.getByTestId("revpar-label")).toHaveTextContent("RevPAR");
    });

    it("should indicate profitability trends", () => {
      const scenarios = [
        { margin: 45, color: "green", label: "Excellent" },
        { margin: 35, color: "blue", label: "Good" },
        { margin: 25, color: "yellow", label: "Fair" },
        { margin: 15, color: "orange", label: "Low" },
        { margin: 5, color: "red", label: "Critical" },
      ];

      scenarios.forEach(({ margin, color, label }) => {
        const financialMetrics = mockGenerator
          .withProfitability({
            grossProfit: 28500,
            netProfit: 18500,
            margin,
            averageRoomRate: 2500,
            revPAR: 1875,
          })
          .build().financial;

        const { unmount } = render(
          <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
            <FinancialMetricsCard />
          </DashboardTestProvider>
        );

        const marginElement = screen.getByTestId("profit-margin");
        expect(marginElement).toHaveClass(`text-${color}-600`);
        expect(marginElement).toHaveAttribute("data-level", label.toLowerCase());

        unmount();
      });
    });
  });

  describe("Loading and Error States", () => {
    it("should display loading skeleton when data is loading", () => {
      render(
        <DashboardTestProvider loading={true}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("financial-metrics-skeleton")).toBeInTheDocument();
      expect(screen.getByLabelText("Loading financial metrics")).toBeInTheDocument();
      expect(screen.getAllByTestId("skeleton-line")).toHaveLength(6);
    });

    it("should handle error state gracefully", () => {
      const error = "Failed to load financial data";

      render(
        <DashboardTestProvider error={error}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("financial-metrics-error")).toBeInTheDocument();
      expect(screen.getByText("Error loading financial data")).toBeInTheDocument();
      expect(screen.getByText(error)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    });

    it("should show empty state when no financial data available", () => {
      render(
        <DashboardTestProvider initialFinancialMetrics={null}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("financial-metrics-empty")).toBeInTheDocument();
      expect(screen.getByText("No financial data available")).toBeInTheDocument();
      expect(screen.getByText("Start tracking revenue and expenses")).toBeInTheDocument();
    });
  });

  describe("Real-time Updates", () => {
    it("should update revenue when new payment received", async () => {
      const { rerender } = render(
        <DashboardTestProvider
          initialFinancialMetrics={mockGenerator.withRevenue(45000).build().financial}
        >
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("revenue-today")).toHaveTextContent("₱45,000.00");

      // Simulate payment received via WebSocket
      const updatedMetrics = mockGenerator.withRevenue(48500).build().financial;

      rerender(
        <DashboardTestProvider initialFinancialMetrics={updatedMetrics} realtimeUpdate={true}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("revenue-today")).toHaveTextContent("₱48,500.00");
        expect(screen.getByTestId("revenue-update-indicator")).toBeInTheDocument();
      });
    });

    it("should show payment notification for GCash/Maya", async () => {
      render(
        <DashboardTestProvider
          initialFinancialMetrics={mockGenerator.withRevenue(45000).build().financial}
        >
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      // Simulate GCash payment received
      act(() => {
        window.dispatchEvent(
          new CustomEvent("dashboard-update", {
            detail: {
              type: "payment_received",
              amount: 3500,
              method: "gcash",
              reference: "GC-2024-001",
            },
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId("payment-notification")).toBeInTheDocument();
        expect(screen.getByText("GCash payment received: ₱3,500.00")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility (WCAG 2.1 AA)", () => {
    it("should have no accessibility violations", async () => {
      const financialMetrics = mockGenerator
        .withRevenue(48500)
        .withExpenses(35000, 50000)
        .build().financial;

      const { container } = render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should properly announce currency values to screen readers", () => {
      const financialMetrics = mockGenerator.withRevenue(48500).build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      const revenueElement = screen.getByTestId("revenue-today");
      expect(revenueElement).toHaveAttribute("aria-label", "48,500 Philippine pesos");
      expect(revenueElement).toHaveAttribute("role", "text");
    });

    it("should support keyboard navigation for interactive elements", async () => {
      const financialMetrics = mockGenerator.withRevenue(48500).build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      const viewDetailsButton = screen.getByRole("button", { name: "View details" });

      viewDetailsButton.focus();
      expect(viewDetailsButton).toHaveFocus();

      await user.keyboard("{Enter}");
      expect(screen.getByTestId("financial-details-modal")).toBeInTheDocument();
    });
  });

  describe("Mobile Responsiveness", () => {
    it("should adapt layout for mobile viewport", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      });

      const financialMetrics = mockGenerator.withRevenue(48500).build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics} isMobile={true}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      const card = screen.getByTestId("financial-metrics-card");
      expect(card).toHaveClass("mobile-layout");

      // Payment methods should be in compact grid
      const paymentGrid = screen.getByTestId("payment-methods-grid");
      expect(paymentGrid).toHaveClass("grid-cols-2"); // 2 columns on mobile
    });

    it("should use compact number formatting on mobile", () => {
      const financialMetrics = mockGenerator.withRevenue(1250000).build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics} isMobile={true}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      // Should show compact format on mobile
      expect(screen.getByTestId("revenue-month-mobile")).toHaveTextContent("₱1.25M");
    });
  });

  describe("Performance", () => {
    it("should render within performance budget (< 100ms)", () => {
      const startTime = performance.now();

      const financialMetrics = mockGenerator
        .withRevenue(48500)
        .withExpenses(35000, 50000)
        .withPaymentMethods({
          cash: 15000,
          gcash: 12500,
          maya: 8000,
          bank_transfer: 10000,
          credit_card: 3000,
          pending: 0,
        })
        .build().financial;

      render(
        <DashboardTestProvider initialFinancialMetrics={financialMetrics}>
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(100);
    });

    it("should memoize expensive calculations", () => {
      const calculateSpy = vi.fn();

      const { rerender } = render(
        <DashboardTestProvider
          initialFinancialMetrics={mockGenerator.withRevenue(48500).build().financial}
          onCalculate={calculateSpy}
        >
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      expect(calculateSpy).toHaveBeenCalledTimes(1);

      // Rerender with same data
      rerender(
        <DashboardTestProvider
          initialFinancialMetrics={mockGenerator.withRevenue(48500).build().financial}
          onCalculate={calculateSpy}
        >
          <FinancialMetricsCard />
        </DashboardTestProvider>
      );

      // Should not recalculate with same data
      expect(calculateSpy).toHaveBeenCalledTimes(1);
    });
  });
});
