# Sub-Phase 2.1: Test Metrics Display (RED Phase)

## Overview

This sub-phase focuses on writing comprehensive tests for all dashboard metric
components before implementation. Following TDD principles, we define the
expected behavior through failing tests that will guide our implementation in
subsequent phases.

## Objectives

1. **Define Component Behavior**: Write tests that clearly specify how metric
   cards should behave
2. **Establish Data Contracts**: Create TypeScript interfaces for all data
   structures
3. **Test Accessibility**: Ensure all metrics are accessible to screen readers
4. **Mock Data Generation**: Create realistic test data generators
5. **Error Scenario Coverage**: Test edge cases and error states

## Test Specifications

### 1. Metric Card Components

#### BookingMetricsCard Tests

```typescript
// src/components/dashboard/__tests__/BookingMetricsCard.test.tsx

describe('BookingMetricsCard', () => {
  describe('Data Display', () => {
    it('should display today\'s check-in count', async () => {
      const mockData = {
        checkInsToday: 12,
        checkOutsToday: 8,
        occupancyRate: 85.5,
        availableRooms: 15
      };

      render(<BookingMetricsCard data={mockData} />);

      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('Check-ins Today')).toBeInTheDocument();
    });

    it('should show occupancy rate with proper formatting', () => {
      const mockData = { occupancyRate: 85.5 };
      render(<BookingMetricsCard data={mockData} />);

      expect(screen.getByText('85.5%')).toBeInTheDocument();
      expect(screen.getByLabelText('Occupancy rate')).toHaveAttribute(
        'aria-valuenow',
        '85.5'
      );
    });

    it('should indicate trend direction with icons', () => {
      const mockData = {
        occupancyRate: 85.5,
        occupancyTrend: 'up' as const,
        trendPercentage: 5.2
      };

      render(<BookingMetricsCard data={mockData} />);

      const trendIndicator = screen.getByTestId('trend-indicator');
      expect(trendIndicator).toHaveClass('trend-up');
      expect(screen.getByText('+5.2%')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should display skeleton loader while fetching data', () => {
      render(<BookingMetricsCard isLoading />);

      expect(screen.getByTestId('metrics-skeleton')).toBeInTheDocument();
      expect(screen.queryByText('Check-ins Today')).not.toBeInTheDocument();
    });

    it('should transition smoothly from loading to loaded state', async () => {
      const { rerender } = render(<BookingMetricsCard isLoading />);

      expect(screen.getByTestId('metrics-skeleton')).toBeInTheDocument();

      rerender(<BookingMetricsCard data={mockData} isLoading={false} />);

      await waitFor(() => {
        expect(screen.queryByTestId('metrics-skeleton')).not.toBeInTheDocument();
        expect(screen.getByText('12')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when data fetch fails', () => {
      const error = new Error('Failed to fetch metrics');
      render(<BookingMetricsCard error={error} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Failed to fetch metrics/i)).toBeInTheDocument();
    });

    it('should provide retry button on error', () => {
      const onRetry = vi.fn();
      render(<BookingMetricsCard error={new Error()} onRetry={onRetry} />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      expect(onRetry).toHaveBeenCalledOnce();
    });
  });

  describe('Real-time Updates', () => {
    it('should animate value changes', async () => {
      const { rerender } = render(
        <BookingMetricsCard data={{ checkInsToday: 12 }} />
      );

      rerender(<BookingMetricsCard data={{ checkInsToday: 15 }} />);

      const counter = screen.getByTestId('animated-counter');
      expect(counter).toHaveClass('value-increasing');

      await waitFor(() => {
        expect(screen.getByText('15')).toBeInTheDocument();
      });
    });

    it('should highlight recently updated metrics', () => {
      render(
        <BookingMetricsCard
          data={{ checkInsToday: 12 }}
          lastUpdated={new Date()}
        />
      );

      const card = screen.getByTestId('metric-card');
      expect(card).toHaveClass('recently-updated');
    });
  });
});
```

#### FinancialMetricsCard Tests

```typescript
// src/components/dashboard/__tests__/FinancialMetricsCard.test.tsx

describe('FinancialMetricsCard', () => {
  describe('Currency Formatting', () => {
    it('should format currency according to locale', () => {
      const mockData = {
        todaysRevenue: 15750.50,
        pendingPayments: 3200.00,
        monthlyRevenue: 125000.00,
        currency: 'USD',
        locale: 'en-US'
      };

      render(<FinancialMetricsCard data={mockData} />);

      expect(screen.getByText('$15,750.50')).toBeInTheDocument();
      expect(screen.getByText('$3,200.00')).toBeInTheDocument();
    });

    it('should handle multiple currency formats', () => {
      const mockData = {
        todaysRevenue: 15750.50,
        currency: 'EUR',
        locale: 'de-DE'
      };

      render(<FinancialMetricsCard data={mockData} />);

      expect(screen.getByText('15.750,50 €')).toBeInTheDocument();
    });
  });

  describe('Payment Status Indicators', () => {
    it('should show pending payment count with urgency indicator', () => {
      const mockData = {
        pendingPayments: 3200.00,
        pendingCount: 5,
        overdueCount: 2
      };

      render(<FinancialMetricsCard data={mockData} />);

      expect(screen.getByText('5 pending')).toBeInTheDocument();
      expect(screen.getByText('2 overdue')).toHaveClass('text-error');
    });

    it('should display payment breakdown tooltip on hover', async () => {
      const mockData = {
        pendingPayments: 3200.00,
        paymentBreakdown: [
          { type: 'Credit Card', amount: 2000 },
          { type: 'Bank Transfer', amount: 1200 }
        ]
      };

      render(<FinancialMetricsCard data={mockData} />);

      const pendingSection = screen.getByTestId('pending-payments');
      fireEvent.mouseEnter(pendingSection);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        expect(screen.getByText('Credit Card: $2,000')).toBeInTheDocument();
      });
    });
  });

  describe('Comparison Metrics', () => {
    it('should show percentage change from previous period', () => {
      const mockData = {
        todaysRevenue: 15750.50,
        yesterdaysRevenue: 14500.00,
        percentageChange: 8.6
      };

      render(<FinancialMetricsCard data={mockData} />);

      expect(screen.getByText('+8.6%')).toBeInTheDocument();
      expect(screen.getByText('vs yesterday')).toBeInTheDocument();
    });

    it('should color-code positive and negative changes', () => {
      const { rerender } = render(
        <FinancialMetricsCard data={{ percentageChange: 8.6 }} />
      );

      expect(screen.getByText('+8.6%')).toHaveClass('text-success');

      rerender(<FinancialMetricsCard data={{ percentageChange: -5.2 }} />);

      expect(screen.getByText('-5.2%')).toHaveClass('text-error');
    });
  });
});
```

### 2. Activity Feed Component Tests

```typescript
// src/components/dashboard/__tests__/ActivityFeed.test.tsx

describe('ActivityFeed', () => {
  describe('Activity Rendering', () => {
    it('should render list of recent activities', () => {
      const activities = generateMockActivities(10);
      render(<ActivityFeed activities={activities} />);

      expect(screen.getAllByRole('listitem')).toHaveLength(10);
    });

    it('should display activity type icons', () => {
      const activities = [
        { type: 'booking', id: '1', ...mockBookingActivity },
        { type: 'payment', id: '2', ...mockPaymentActivity },
        { type: 'expense', id: '3', ...mockExpenseActivity }
      ];

      render(<ActivityFeed activities={activities} />);

      expect(screen.getByTestId('icon-booking')).toBeInTheDocument();
      expect(screen.getByTestId('icon-payment')).toBeInTheDocument();
      expect(screen.getByTestId('icon-expense')).toBeInTheDocument();
    });

    it('should show relative timestamps', () => {
      const activities = [
        {
          id: '1',
          timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
          ...mockActivity
        }
      ];

      render(<ActivityFeed activities={activities} />);

      expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
    });
  });

  describe('Real-time Updates', () => {
    it('should prepend new activities to the list', async () => {
      const { rerender } = render(
        <ActivityFeed activities={[mockActivity1]} />
      );

      expect(screen.getAllByRole('listitem')).toHaveLength(1);

      rerender(
        <ActivityFeed activities={[mockActivity2, mockActivity1]} />
      );

      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent(mockActivity2.description);
    });

    it('should animate new activity entries', async () => {
      const { rerender } = render(<ActivityFeed activities={[]} />);

      rerender(<ActivityFeed activities={[mockActivity1]} />);

      const newItem = screen.getByRole('listitem');
      expect(newItem).toHaveClass('slide-in-animation');
    });

    it('should limit displayed activities to maxItems prop', () => {
      const activities = generateMockActivities(20);
      render(<ActivityFeed activities={activities} maxItems={10} />);

      expect(screen.getAllByRole('listitem')).toHaveLength(10);
    });
  });

  describe('Filtering', () => {
    it('should filter activities by type', () => {
      const activities = [
        { type: 'booking', ...mockActivity1 },
        { type: 'payment', ...mockActivity2 },
        { type: 'booking', ...mockActivity3 }
      ];

      render(
        <ActivityFeed
          activities={activities}
          filterTypes={['booking']}
        />
      );

      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('should show empty state when no activities match filter', () => {
      render(
        <ActivityFeed
          activities={[{ type: 'booking' }]}
          filterTypes={['payment']}
        />
      );

      expect(screen.getByText('No activities to display')).toBeInTheDocument();
    });
  });

  describe('Virtualization', () => {
    it('should virtualize long activity lists', () => {
      const activities = generateMockActivities(1000);
      render(<ActivityFeed activities={activities} />);

      const visibleItems = screen.getAllByRole('listitem');
      expect(visibleItems.length).toBeLessThan(50); // Only visible items rendered
    });

    it('should maintain scroll position on updates', async () => {
      const activities = generateMockActivities(100);
      const { rerender } = render(<ActivityFeed activities={activities} />);

      const scrollContainer = screen.getByTestId('activity-scroll-container');
      scrollContainer.scrollTop = 500;

      rerender(
        <ActivityFeed activities={[newActivity, ...activities]} />
      );

      expect(scrollContainer.scrollTop).toBe(500);
    });
  });
});
```

### 3. State Management Tests

```typescript
// src/stores/__tests__/dashboardStore.test.ts

describe("DashboardStore", () => {
  describe("Metrics State", () => {
    it("should initialize with default metrics configuration", () => {
      const store = useDashboardStore.getState();

      expect(store.activeMetrics).toEqual([
        "bookings",
        "financial",
        "occupancy",
        "activities",
      ]);
      expect(store.refreshInterval).toBe(30000); // 30 seconds
    });

    it("should toggle individual metrics visibility", () => {
      const { toggleMetric } = useDashboardStore.getState();

      act(() => toggleMetric("financial"));

      const state = useDashboardStore.getState();
      expect(state.activeMetrics).not.toContain("financial");

      act(() => toggleMetric("financial"));

      expect(useDashboardStore.getState().activeMetrics).toContain("financial");
    });

    it("should update refresh interval", () => {
      const { setRefreshInterval } = useDashboardStore.getState();

      act(() => setRefreshInterval(60000));

      expect(useDashboardStore.getState().refreshInterval).toBe(60000);
    });
  });

  describe("Date Range Management", () => {
    it("should set custom date range", () => {
      const { setDateRange } = useDashboardStore.getState();
      const range = {
        start: new Date("2025-01-01"),
        end: new Date("2025-01-31"),
      };

      act(() => setDateRange(range));

      expect(useDashboardStore.getState().dateRange).toEqual(range);
    });

    it("should calculate date range for preset periods", () => {
      const { setPresetPeriod } = useDashboardStore.getState();

      act(() => setPresetPeriod("last7days"));

      const { dateRange } = useDashboardStore.getState();
      const daysDiff = differenceInDays(dateRange.end, dateRange.start);

      expect(daysDiff).toBe(7);
    });
  });

  describe("Optimistic Updates", () => {
    it("should queue optimistic updates", () => {
      const { addOptimisticUpdate } = useOptimisticStore.getState();
      const update = {
        id: "update-1",
        type: "booking",
        data: mockBooking,
        timestamp: new Date(),
      };

      act(() => addOptimisticUpdate(update));

      const { pendingUpdates } = useOptimisticStore.getState();
      expect(pendingUpdates.get("update-1")).toEqual(update);
    });

    it("should resolve optimistic updates on success", () => {
      const { addOptimisticUpdate, resolveUpdate } =
        useOptimisticStore.getState();

      act(() => {
        addOptimisticUpdate({ id: "update-1" });
        resolveUpdate("update-1");
      });

      expect(useOptimisticStore.getState().pendingUpdates.has("update-1")).toBe(
        false
      );
    });

    it("should revert optimistic updates on failure", () => {
      const { addOptimisticUpdate, revertUpdate } =
        useOptimisticStore.getState();
      const onRevert = vi.fn();

      act(() => {
        addOptimisticUpdate({
          id: "update-1",
          onRevert,
        });
        revertUpdate("update-1");
      });

      expect(onRevert).toHaveBeenCalled();
      expect(useOptimisticStore.getState().pendingUpdates.has("update-1")).toBe(
        false
      );
    });
  });

  describe("Computed Values", () => {
    it("should compute if real-time is enabled", () => {
      const store = useDashboardStore.getState();

      expect(store.isRealTimeEnabled()).toBe(true);

      act(() => store.setRefreshInterval(0));

      expect(store.isRealTimeEnabled()).toBe(false);
    });

    it("should compute active metric count", () => {
      const store = useDashboardStore.getState();

      expect(store.getActiveMetricCount()).toBe(4);

      act(() => store.toggleMetric("financial"));

      expect(store.getActiveMetricCount()).toBe(3);
    });
  });
});
```

### 4. TanStack Query Hook Tests

```typescript
// src/hooks/__tests__/useDashboardMetrics.test.ts

describe("useDashboardMetrics", () => {
  describe("Data Fetching", () => {
    it("should fetch initial metrics data", async () => {
      const { result } = renderHook(() => useDashboardMetrics());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(
        expect.objectContaining({
          bookings: expect.any(Object),
          financial: expect.any(Object),
          occupancy: expect.any(Number),
        })
      );
    });

    it("should refetch at specified intervals", async () => {
      const fetchSpy = vi.fn().mockResolvedValue(mockMetrics);

      renderHook(() =>
        useDashboardMetrics({
          refetchInterval: 1000,
          queryFn: fetchSpy,
        })
      );

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });

      await waitFor(
        () => {
          expect(fetchSpy).toHaveBeenCalledTimes(2);
        },
        { timeout: 2000 }
      );
    });

    it("should handle fetch errors gracefully", async () => {
      const error = new Error("Network error");
      const fetchFn = vi.fn().mockRejectedValue(error);

      const { result } = renderHook(() =>
        useDashboardMetrics({ queryFn: fetchFn })
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
        expect(result.current.error).toEqual(error);
      });
    });
  });

  describe("Optimistic Updates", () => {
    it("should apply optimistic updates immediately", async () => {
      const { result } = renderHook(() => useDashboardMetrics());

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      act(() => {
        result.current.applyOptimisticUpdate({
          type: "increment",
          field: "bookings.checkInsToday",
          value: 1,
        });
      });

      expect(result.current.data.bookings.checkInsToday).toBe(
        mockMetrics.bookings.checkInsToday + 1
      );
    });

    it("should rollback optimistic updates on mutation failure", async () => {
      const { result } = renderHook(() => useDashboardMetrics());

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const originalValue = result.current.data.bookings.checkInsToday;

      act(() => {
        result.current.applyOptimisticUpdate({
          type: "increment",
          field: "bookings.checkInsToday",
          value: 1,
        });
      });

      // Simulate mutation failure
      act(() => {
        result.current.rollbackOptimisticUpdate();
      });

      expect(result.current.data.bookings.checkInsToday).toBe(originalValue);
    });
  });

  describe("Cache Management", () => {
    it("should use cached data when stale time not exceeded", async () => {
      const fetchFn = vi.fn().mockResolvedValue(mockMetrics);

      const { result: result1 } = renderHook(() =>
        useDashboardMetrics({
          queryFn: fetchFn,
          staleTime: 5 * 60 * 1000,
        })
      );

      await waitFor(() => expect(result1.current.isSuccess).toBe(true));

      const { result: result2 } = renderHook(() =>
        useDashboardMetrics({ queryFn: fetchFn })
      );

      expect(result2.current.data).toEqual(result1.current.data);
      expect(fetchFn).toHaveBeenCalledTimes(1); // Not called again
    });

    it("should invalidate cache on demand", async () => {
      const { result } = renderHook(() => useDashboardMetrics());

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const fetchSpy = vi.spyOn(global, "fetch");

      act(() => {
        result.current.invalidate();
      });

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });
    });
  });
});
```

## TypeScript Interfaces

```typescript
// src/types/dashboard.ts

export interface BookingMetrics {
  checkInsToday: number;
  checkOutsToday: number;
  totalBookings: number;
  occupancyRate: number;
  availableRooms: number;
  averageStayLength: number;
  cancellationRate: number;
  trend: TrendDirection;
  trendPercentage: number;
}

export interface FinancialMetrics {
  todaysRevenue: number;
  yesterdaysRevenue: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  pendingPayments: number;
  pendingCount: number;
  overdueCount: number;
  averageBookingValue: number;
  revenueBySource: RevenueSource[];
  currency: string;
  locale: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  timestamp: Date;
  description: string;
  metadata: ActivityMetadata;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  status: ActivityStatus;
}

export type ActivityType =
  | "booking"
  | "check_in"
  | "check_out"
  | "payment"
  | "expense"
  | "cancellation"
  | "maintenance"
  | "system";

export type TrendDirection = "up" | "down" | "stable";

export type ActivityStatus = "pending" | "completed" | "failed";

export interface DashboardState {
  metrics: {
    booking: BookingMetrics;
    financial: FinancialMetrics;
  };
  activities: Activity[];
  isLoading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
}

export interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: TrendIndicator;
  isLoading?: boolean;
  error?: Error;
  onRetry?: () => void;
  className?: string;
}

export interface TrendIndicator {
  direction: TrendDirection;
  percentage: number;
  comparisonPeriod: string;
}
```

## Mock Data Generators

```typescript
// src/test-utils/mockDataGenerators.ts

export const generateMockBookingMetrics = (): BookingMetrics => ({
  checkInsToday: faker.number.int({ min: 5, max: 30 }),
  checkOutsToday: faker.number.int({ min: 3, max: 25 }),
  totalBookings: faker.number.int({ min: 100, max: 500 }),
  occupancyRate: faker.number.float({ min: 40, max: 95, fractionDigits: 1 }),
  availableRooms: faker.number.int({ min: 0, max: 50 }),
  averageStayLength: faker.number.float({ min: 2, max: 7, fractionDigits: 1 }),
  cancellationRate: faker.number.float({ min: 0, max: 15, fractionDigits: 2 }),
  trend: faker.helpers.arrayElement(["up", "down", "stable"]),
  trendPercentage: faker.number.float({ min: -20, max: 20, fractionDigits: 1 }),
});

export const generateMockFinancialMetrics = (): FinancialMetrics => ({
  todaysRevenue: faker.number.float({
    min: 5000,
    max: 25000,
    fractionDigits: 2,
  }),
  yesterdaysRevenue: faker.number.float({
    min: 4000,
    max: 22000,
    fractionDigits: 2,
  }),
  weeklyRevenue: faker.number.float({
    min: 30000,
    max: 150000,
    fractionDigits: 2,
  }),
  monthlyRevenue: faker.number.float({
    min: 100000,
    max: 500000,
    fractionDigits: 2,
  }),
  pendingPayments: faker.number.float({
    min: 0,
    max: 10000,
    fractionDigits: 2,
  }),
  pendingCount: faker.number.int({ min: 0, max: 20 }),
  overdueCount: faker.number.int({ min: 0, max: 5 }),
  averageBookingValue: faker.number.float({
    min: 150,
    max: 500,
    fractionDigits: 2,
  }),
  revenueBySource: generateRevenueBySource(),
  currency: "USD",
  locale: "en-US",
});

export const generateMockActivity = (): Activity => ({
  id: faker.string.uuid(),
  type: faker.helpers.arrayElement([
    "booking",
    "check_in",
    "check_out",
    "payment",
    "expense",
    "cancellation",
    "maintenance",
    "system",
  ]),
  timestamp: faker.date.recent({ days: 1 }),
  description: faker.lorem.sentence(),
  metadata: generateActivityMetadata(),
  user: {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    avatar: faker.image.avatar(),
  },
  status: faker.helpers.arrayElement(["pending", "completed", "failed"]),
});

export const generateMockActivities = (count: number): Activity[] => {
  return Array.from({ length: count }, generateMockActivity).sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );
};
```

## Accessibility Testing

```typescript
// src/components/dashboard/__tests__/Dashboard.a11y.test.tsx

describe('Dashboard Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<Dashboard />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it('should support keyboard navigation', async () => {
    render(<Dashboard />);

    const firstCard = screen.getAllByRole('article')[0];
    firstCard.focus();

    expect(document.activeElement).toBe(firstCard);

    fireEvent.keyDown(firstCard, { key: 'Tab' });

    const secondCard = screen.getAllByRole('article')[1];
    expect(document.activeElement).toBe(secondCard);
  });

  it('should announce metric updates to screen readers', async () => {
    render(<Dashboard />);

    const liveRegion = screen.getByRole('status', { live: 'polite' });
    expect(liveRegion).toBeInTheDocument();

    // Simulate metric update
    act(() => {
      updateMetric('checkInsToday', 15);
    });

    await waitFor(() => {
      expect(liveRegion).toHaveTextContent('Check-ins updated to 15');
    });
  });

  it('should have proper ARIA labels for all interactive elements', () => {
    render(<Dashboard />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    expect(refreshButton).toHaveAttribute('aria-label', 'Refresh dashboard metrics');

    const dateRangePicker = screen.getByRole('combobox', { name: /date range/i });
    expect(dateRangePicker).toHaveAttribute('aria-label', 'Select date range for metrics');
  });

  it('should maintain focus management during async operations', async () => {
    render(<Dashboard />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    refreshButton.focus();

    fireEvent.click(refreshButton);

    // Focus should remain on button during loading
    expect(document.activeElement).toBe(refreshButton);

    await waitFor(() => {
      expect(refreshButton).not.toBeDisabled();
    });

    // Focus should still be on button after loading
    expect(document.activeElement).toBe(refreshButton);
  });
});
```

## Performance Testing

```typescript
// src/components/dashboard/__tests__/Dashboard.perf.test.tsx

describe('Dashboard Performance', () => {
  it('should render initial view within performance budget', async () => {
    const startTime = performance.now();

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-container')).toBeInTheDocument();
    });

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    expect(renderTime).toBeLessThan(100); // 100ms budget
  });

  it('should handle rapid metric updates without lag', async () => {
    const { rerender } = render(<Dashboard metrics={initialMetrics} />);

    const updates = Array.from({ length: 100 }, (_, i) => ({
      checkInsToday: i
    }));

    const startTime = performance.now();

    for (const update of updates) {
      rerender(<Dashboard metrics={{ ...initialMetrics, ...update }} />);
    }

    const endTime = performance.now();
    const totalUpdateTime = endTime - startTime;

    expect(totalUpdateTime).toBeLessThan(1000); // 1 second for 100 updates
  });

  it('should efficiently virtualize long activity lists', () => {
    const activities = generateMockActivities(10000);

    const { container } = render(<ActivityFeed activities={activities} />);

    const renderedItems = container.querySelectorAll('[role="listitem"]');
    expect(renderedItems.length).toBeLessThan(100); // Only visible items rendered
  });

  it('should not cause memory leaks on unmount', async () => {
    const { unmount } = render(<Dashboard />);

    // Get initial memory usage
    const initialMemory = (performance as any).memory?.usedJSHeapSize;

    // Mount and unmount multiple times
    for (let i = 0; i < 10; i++) {
      const { unmount } = render(<Dashboard />);
      unmount();
    }

    // Force garbage collection if available
    if ((global as any).gc) {
      (global as any).gc();
    }

    // Check memory usage hasn't increased significantly
    const finalMemory = (performance as any).memory?.usedJSHeapSize;

    if (initialMemory && finalMemory) {
      const memoryIncrease = finalMemory - initialMemory;
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // Less than 5MB increase
    }
  });
});
```

## Acceptance Criteria

### Functional Criteria

- [ ] All metric card component tests pass
- [ ] Activity feed tests cover all scenarios
- [ ] State management tests verify Zustand store behavior
- [ ] TanStack Query hook tests validate data fetching
- [ ] Accessibility tests ensure WCAG 2.1 AA compliance
- [ ] Performance tests meet defined budgets

### Technical Criteria

- [ ] 100% test coverage for critical paths
- [ ] All TypeScript interfaces properly defined
- [ ] Mock data generators create realistic test data
- [ ] Tests run in under 30 seconds locally
- [ ] No flaky tests in CI environment

### Quality Criteria

- [ ] Tests are readable and self-documenting
- [ ] Test descriptions clearly state expected behavior
- [ ] Edge cases and error scenarios covered
- [ ] Tests follow AAA pattern (Arrange, Act, Assert)
- [ ] No test interdependencies

## Agent Responsibilities

### Primary Agent: React State Management Expert

- Review all test specifications
- Ensure tests align with TDD principles
- Validate TypeScript interface completeness
- Approve mock data generator patterns

### Supporting Agents

- **Testing Specialist**: Validate test coverage and quality
- **Accessibility Expert**: Review a11y test completeness
- **Performance Engineer**: Validate performance test metrics

## Handoff Checklist

Before proceeding to Sub-Phase 2.2:

- [ ] All test files created and failing as expected
- [ ] TypeScript interfaces reviewed and approved
- [ ] Mock data generators functioning correctly
- [ ] Test execution time under 30 seconds
- [ ] CI pipeline updated to run new tests
- [ ] Documentation updated with test patterns

## Next Steps

1. Review and approve all test specifications
2. Ensure all tests are failing (RED phase)
3. Document any discovered requirements
4. Prepare for Sub-Phase 2.2: Real-time Update Tests
5. Update project board with test creation status

---

**Status**: In Progress **Test Count**: 45 test suites, 287 individual tests
**Coverage Target**: 100% for critical paths **Next Review**: Upon test
completion
