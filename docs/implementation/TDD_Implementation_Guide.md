# TDD Implementation Guide - Okaeri Resort Management System

## Executive Summary

### Why TDD for Resort Management Systems

Resort management systems require exceptional reliability due to their critical
business impact. A single bug in booking calculations, payment processing, or
availability management can result in significant financial losses and damaged
customer relationships. Test-Driven Development (TDD) provides the safety net
and confidence needed for such mission-critical applications.

**Key Benefits for Okaeri Resort System:**

- **Financial Accuracy**: Ensures booking calculations, payment tracking, and
  financial reports are mathematically correct
- **Data Integrity**: Prevents corruption of guest information, booking records,
  and property data
- **Business Logic Reliability**: Validates complex availability rules, pricing
  calculations, and multi-tenant operations
- **Regression Prevention**: Catches breaking changes in core features like
  check-in/check-out flows
- **Maintainability**: Enables safe refactoring as business requirements evolve
  over seasons
- **Team Confidence**: Allows multiple developers to contribute without fear of
  breaking critical systems

**ROI for Family Business:**

- Reduced downtime during peak seasons
- Fewer customer service issues from booking errors
- Faster feature development with confidence
- Lower long-term maintenance costs
- Protection against costly booking mistakes

## TDD Fundamentals - Red-Green-Refactor for TypeScript/React

### The TDD Cycle in Practice

**Red Phase - Write Failing Tests**

```typescript
// 1. Start with a failing test that describes the desired behavior
describe("BookingCalculation", () => {
  it("should calculate total amount with tax for Philippine resort booking", () => {
    const booking = {
      baseAmount: 5000,
      nights: 3,
      taxRate: 0.12, // Philippines VAT
      serviceChargeRate: 0.1,
    };

    const result = calculateBookingTotal(booking);

    expect(result.subtotal).toBe(15000); // 5000 * 3
    expect(result.tax).toBe(1800); // 15000 * 0.12
    expect(result.serviceCharge).toBe(1500); // 15000 * 0.10
    expect(result.total).toBe(18300);
  });
});
```

**Green Phase - Write Minimal Implementation**

```typescript
// 2. Write just enough code to make the test pass
interface BookingCalculation {
  baseAmount: number;
  nights: number;
  taxRate: number;
  serviceChargeRate: number;
}

interface BookingTotal {
  subtotal: number;
  tax: number;
  serviceCharge: number;
  total: number;
}

function calculateBookingTotal(booking: BookingCalculation): BookingTotal {
  const subtotal = booking.baseAmount * booking.nights;
  const tax = subtotal * booking.taxRate;
  const serviceCharge = subtotal * booking.serviceChargeRate;
  const total = subtotal + tax + serviceCharge;

  return { subtotal, tax, serviceCharge, total };
}
```

**Refactor Phase - Improve Code Quality**

```typescript
// 3. Clean up the code while keeping tests green
import { ProjectConfig } from "@/types/common";

class BookingCalculator {
  constructor(private config: ProjectConfig) {}

  calculateTotal(baseAmount: number, nights: number): BookingTotal {
    const subtotal = this.calculateSubtotal(baseAmount, nights);
    const tax = this.calculateTax(subtotal);
    const serviceCharge = this.calculateServiceCharge(subtotal);

    return {
      subtotal,
      tax,
      serviceCharge,
      total: subtotal + tax + serviceCharge,
    };
  }

  private calculateSubtotal(baseAmount: number, nights: number): number {
    if (nights <= 0) throw new Error("Nights must be greater than 0");
    if (baseAmount <= 0) throw new Error("Base amount must be greater than 0");
    return baseAmount * nights;
  }

  private calculateTax(subtotal: number): number {
    // Use project config for tax rates per Philippines regions
    const taxRate = this.config.locale === "ph-PH" ? 0.12 : 0.0;
    return Math.round(subtotal * taxRate * 100) / 100; // Round to 2 decimals
  }

  private calculateServiceCharge(subtotal: number): number {
    return Math.round(subtotal * 0.1 * 100) / 100;
  }
}
```

### TypeScript-First TDD Approach

**1. Define Types First**

```typescript
// Start with domain types to guide implementation
interface CreateBookingData {
  readonly guestName: string;
  readonly guestEmail: string;
  readonly propertyId: string;
  readonly checkIn: string; // ISO date string
  readonly checkOut: string; // ISO date string
  readonly totalAmount: number;
  readonly guestCount: number;
  readonly specialRequests?: string;
}

interface BookingValidationResult {
  readonly isValid: boolean;
  readonly errors: ReadonlyArray<BookingValidationError>;
}

interface BookingValidationError {
  readonly field: keyof CreateBookingData;
  readonly message: string;
  readonly code: string;
}
```

**2. Test Type Safety**

```typescript
describe("CreateBookingData Type Safety", () => {
  it("should enforce required fields at compile time", () => {
    // This should compile
    const validBooking: CreateBookingData = {
      guestName: "Juan Dela Cruz",
      guestEmail: "juan@example.ph",
      propertyId: "prop-123",
      checkIn: "2024-12-25",
      checkOut: "2024-12-30",
      totalAmount: 25000,
      guestCount: 2,
    };

    expect(validBooking).toBeDefined();
  });

  it("should prevent mutation of booking data", () => {
    const booking: CreateBookingData = createTestBooking();

    // TypeScript should prevent these mutations
    // booking.totalAmount = 9999; // TS Error: Cannot assign to readonly property
    // booking.guestName = 'Hacker'; // TS Error: Cannot assign to readonly property

    expect(booking.totalAmount).toBe(25000); // Original value preserved
  });
});
```

## Project-Specific Patterns for React Components and Zustand Stores

### Testing React Components with TypeScript

**Pattern 1: Component Contract Testing**

```typescript
// src/components/booking/__tests__/BookingForm.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookingForm } from '../BookingForm';
import { renderWithProviders } from '@tests/utils/test-utils';

interface BookingFormProps {
  onSubmit: (data: CreateBookingData) => Promise<void>;
  availableProperties: Property[];
  initialData?: Partial<CreateBookingData>;
  isLoading?: boolean;
}

describe('BookingForm', () => {
  const defaultProps: BookingFormProps = {
    onSubmit: vi.fn(),
    availableProperties: [
      {
        id: 'villa-1',
        name: 'Beachfront Villa',
        baseRate: 8000,
        capacity: 4
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Validation', () => {
    it('should validate Philippine email formats', async () => {
      const user = userEvent.setup();
      renderWithProviders(<BookingForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /book now/i });

      // Test valid Philippine email domains
      const validEmails = [
        'guest@gmail.com.ph',
        'customer@yahoo.com.ph',
        'user@up.edu.ph',
        'client@ayala.com.ph'
      ];

      for (const email of validEmails) {
        await user.clear(emailInput);
        await user.type(emailInput, email);

        expect(screen.queryByText(/invalid email/i)).not.toBeInTheDocument();
      }
    });

    it('should calculate nights automatically when dates change', async () => {
      const user = userEvent.setup();
      renderWithProviders(<BookingForm {...defaultProps} />);

      const checkInInput = screen.getByLabelText(/check.in/i);
      const checkOutInput = screen.getByLabelText(/check.out/i);

      await user.type(checkInInput, '2024-12-25');
      await user.type(checkOutInput, '2024-12-30');

      await waitFor(() => {
        expect(screen.getByText('5 nights')).toBeInTheDocument();
      });
    });

    it('should prevent booking past dates', async () => {
      const user = userEvent.setup();
      renderWithProviders(<BookingForm {...defaultProps} />);

      const checkInInput = screen.getByLabelText(/check.in/i);
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);

      await user.type(checkInInput, yesterdayDate.toISOString().split('T')[0]);
      await user.blur(checkInInput);

      await waitFor(() => {
        expect(screen.getByText(/cannot book past dates/i)).toBeInTheDocument();
      });
    });
  });

  describe('Philippine-Specific Features', () => {
    it('should show peso currency formatting', async () => {
      renderWithProviders(
        <BookingForm
          {...defaultProps}
          initialData={{ totalAmount: 15000 }}
        />
      );

      expect(screen.getByText('₱15,000.00')).toBeInTheDocument();
    });

    it('should handle barangay address fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<BookingForm {...defaultProps} />);

      // Philippine address should include barangay
      const barangayInput = screen.getByLabelText(/barangay/i);
      await user.type(barangayInput, 'Barangay Poblacion');

      expect(barangayInput).toHaveValue('Barangay Poblacion');
    });
  });

  describe('Accessibility', () => {
    it('should announce booking total changes to screen readers', async () => {
      const user = userEvent.setup();
      renderWithProviders(<BookingForm {...defaultProps} />);

      const guestCountSelect = screen.getByLabelText(/number of guests/i);
      await user.selectOptions(guestCountSelect, '4');

      // Check for aria-live region updates
      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/total.*₱/i);
      });
    });
  });
});
```

**Pattern 2: Compound Component Testing**

```typescript
// src/components/booking/__tests__/BookingWizard.test.tsx
import { BookingWizard } from '../BookingWizard';

describe('BookingWizard Compound Component', () => {
  it('should navigate through booking steps correctly', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();

    renderWithProviders(
      <BookingWizard onComplete={onComplete}>
        <BookingWizard.PropertySelection />
        <BookingWizard.DateSelection />
        <BookingWizard.GuestDetails />
        <BookingWizard.PaymentOptions />
        <BookingWizard.Confirmation />
      </BookingWizard>
    );

    // Step 1: Select property
    expect(screen.getByText('Select Property')).toBeInTheDocument();
    await user.click(screen.getByText('Beachfront Villa'));
    await user.click(screen.getByText('Next'));

    // Step 2: Select dates
    expect(screen.getByText('Choose Dates')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/check.in/i), '2024-12-25');
    await user.type(screen.getByLabelText(/check.out/i), '2024-12-30');
    await user.click(screen.getByText('Next'));

    // Continue through steps...
    expect(screen.getByText('Guest Details')).toBeInTheDocument();
  });

  it('should preserve form data when navigating backwards', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BookingWizard onComplete={vi.fn()} />);

    // Fill out step 1
    await user.click(screen.getByText('Beachfront Villa'));
    await user.click(screen.getByText('Next'));

    // Fill out step 2
    await user.type(screen.getByLabelText(/check.in/i), '2024-12-25');
    await user.click(screen.getByText('Next'));

    // Go back to step 1
    await user.click(screen.getByText('Previous'));

    // Verify selection is preserved
    expect(screen.getByText('Beachfront Villa')).toHaveAttribute('aria-selected', 'true');
  });
});
```

### Testing Zustand Stores with TypeScript

**Pattern 1: Store State Testing**

```typescript
// src/stores/__tests__/bookingStore.test.ts
import { renderHook, act } from "@testing-library/react";
import { useBookingStore } from "../bookingStore";
import { mockApiClient } from "@tests/mocks/apiClient";
import { createTestBooking } from "@tests/factories/bookingFactory";

describe("BookingStore", () => {
  beforeEach(() => {
    const { result } = renderHook(() => useBookingStore());
    act(() => {
      result.current.reset();
    });
  });

  describe("Optimistic Updates", () => {
    it("should add optimistic booking immediately and replace with server response", async () => {
      const testBooking = createTestBooking();
      const serverBooking = { ...testBooking, id: "server-123" };

      mockApiClient.post.mockResolvedValueOnce({ data: serverBooking });

      const { result } = renderHook(() => useBookingStore());

      // Start creation - should add optimistic booking
      const createPromise = act(async () => {
        await result.current.createBooking(testBooking);
      });

      // Check optimistic state
      expect(result.current.optimisticBookings).toHaveLength(1);
      expect(result.current.optimisticBookings[0].id).toMatch(/^temp-booking-/);

      await createPromise;

      // After resolution - optimistic should be removed, real booking added
      expect(result.current.optimisticBookings).toHaveLength(0);
      expect(result.current.bookings).toHaveLength(1);
      expect(result.current.bookings[0].id).toBe("server-123");
    });

    it("should rollback optimistic update on error", async () => {
      const testBooking = createTestBooking();
      const error = new Error("Network error");

      mockApiClient.post.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useBookingStore());

      await expect(
        act(async () => {
          await result.current.createBooking(testBooking);
        })
      ).rejects.toThrow("Network error");

      // Should rollback optimistic booking
      expect(result.current.optimisticBookings).toHaveLength(0);
      expect(result.current.bookings).toHaveLength(0);
      expect(result.current.error).toBe("Network error");
    });
  });

  describe("Business Logic", () => {
    it("should calculate correct booking nights", () => {
      const { result } = renderHook(() => useBookingStore());

      const booking = createTestBooking({
        checkIn: "2024-12-25",
        checkOut: "2024-12-30",
      });

      act(() => {
        result.current.addOptimisticBooking(booking);
      });

      expect(result.current.optimisticBookings[0].nights).toBe(5);
    });

    it("should filter upcoming check-ins correctly", () => {
      const { result } = renderHook(() => useBookingStore());

      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);

      const upcomingBooking = createTestBooking({
        checkIn: tomorrow.toISOString(),
        status: BookingStatus.CONFIRMED,
      });

      act(() => {
        result.current.setBookings([upcomingBooking]);
      });

      const upcomingCheckIns = result.current.getUpcomingCheckIns(7);
      expect(upcomingCheckIns).toHaveLength(1);
      expect(upcomingCheckIns[0].id).toBe(upcomingBooking.id);
    });
  });

  describe("Multi-tenant Isolation", () => {
    it("should only fetch bookings for active project", async () => {
      const { result } = renderHook(() => useBookingStore());

      // Mock project store
      vi.mocked(useProjectStore.getState).mockReturnValue({
        activeProjectId: "project-123",
      });

      await act(async () => {
        await result.current.fetchBookings();
      });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        "/projects/project-123/bookings",
        expect.any(Object)
      );
    });

    it("should throw error when no active project", async () => {
      const { result } = renderHook(() => useBookingStore());

      vi.mocked(useProjectStore.getState).mockReturnValue({
        activeProjectId: null,
      });

      await expect(
        act(async () => {
          await result.current.fetchBookings();
        })
      ).rejects.toThrow("No active project selected");
    });
  });

  describe("Performance", () => {
    it("should not refetch if data is fresh", async () => {
      const { result } = renderHook(() => useBookingStore());

      // Set recent fetch time
      act(() => {
        result.current.setBookings([createTestBooking()]);
      });

      result.current.lastFetch = Date.now() - 60000; // 1 minute ago

      await act(async () => {
        await result.current.refreshIfNeeded();
      });

      // Should not make API call since data is fresh (< 5 minutes)
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });
  });
});
```

**Pattern 2: Store Integration Testing**

```typescript
// src/stores/__tests__/integration/booking-project-integration.test.ts
import { renderHook, act } from '@testing-library/react';
import { useBookingStore } from '../../bookingStore';
import { useProjectStore } from '../../projectStore';
import { TestWrapper } from '@tests/utils/TestWrapper';

describe('Booking-Project Store Integration', () => {
  it('should reset booking data when switching projects', async () => {
    const wrapper = ({ children }) => (
      <TestWrapper>
        {children}
      </TestWrapper>
    );

    const { result: bookingResult } = renderHook(() => useBookingStore(), { wrapper });
    const { result: projectResult } = renderHook(() => useProjectStore(), { wrapper });

    // Set up initial state
    act(() => {
      bookingResult.current.setBookings([createTestBooking()]);
      projectResult.current.setActiveProject('project-1');
    });

    expect(bookingResult.current.bookings).toHaveLength(1);

    // Switch project
    act(() => {
      projectResult.current.setActiveProject('project-2');
    });

    // Bookings should be reset
    expect(bookingResult.current.bookings).toHaveLength(0);
    expect(bookingResult.current.filters).toEqual({});
  });
});
```

## Practical Booking and Payment Examples

### Test-Driven Booking Flow Implementation

**Example 1: Availability Checking**

```typescript
// src/services/__tests__/availability.service.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { AvailabilityService } from "../availability.service";
import { DateRange, PropertyAvailability } from "@/types/booking";

describe("AvailabilityService", () => {
  let service: AvailabilityService;

  beforeEach(() => {
    service = new AvailabilityService();
  });

  describe("checkPropertyAvailability", () => {
    it("should return available when no overlapping bookings", async () => {
      // Arrange
      const propertyId = "villa-001";
      const requestedRange: DateRange = {
        checkIn: "2024-12-25",
        checkOut: "2024-12-30",
      };

      const existingBookings = [
        {
          checkIn: "2024-12-20",
          checkOut: "2024-12-23", // Ends before requested
          status: "CONFIRMED",
        },
        {
          checkIn: "2025-01-02",
          checkOut: "2025-01-05", // Starts after requested
          status: "CONFIRMED",
        },
      ];

      service.setExistingBookings(existingBookings);

      // Act
      const result = await service.checkPropertyAvailability(
        propertyId,
        requestedRange
      );

      // Assert
      expect(result.available).toBe(true);
      expect(result.conflictingBookings).toHaveLength(0);
    });

    it("should detect overlapping booking conflicts", async () => {
      const propertyId = "villa-001";
      const requestedRange: DateRange = {
        checkIn: "2024-12-25",
        checkOut: "2024-12-30",
      };

      const conflictingBooking = {
        id: "booking-123",
        checkIn: "2024-12-28",
        checkOut: "2025-01-02",
        status: "CONFIRMED",
      };

      service.setExistingBookings([conflictingBooking]);

      const result = await service.checkPropertyAvailability(
        propertyId,
        requestedRange
      );

      expect(result.available).toBe(false);
      expect(result.conflictingBookings).toHaveLength(1);
      expect(result.conflictingBookings[0].id).toBe("booking-123");
    });

    it("should ignore cancelled bookings in availability check", async () => {
      const propertyId = "villa-001";
      const requestedRange: DateRange = {
        checkIn: "2024-12-25",
        checkOut: "2024-12-30",
      };

      const cancelledBooking = {
        checkIn: "2024-12-26",
        checkOut: "2024-12-29",
        status: "CANCELLED",
      };

      service.setExistingBookings([cancelledBooking]);

      const result = await service.checkPropertyAvailability(
        propertyId,
        requestedRange
      );

      expect(result.available).toBe(true);
    });

    it("should handle same-day checkout/checkin scenario", async () => {
      // Philippine resort rule: checkout at 12PM, checkin at 2PM same day is OK
      const propertyId = "villa-001";
      const requestedRange: DateRange = {
        checkIn: "2024-12-25",
        checkOut: "2024-12-30",
      };

      const sameDayCheckoutBooking = {
        checkIn: "2024-12-20",
        checkOut: "2024-12-25", // Checkout same day as new checkin
        status: "CONFIRMED",
      };

      service.setExistingBookings([sameDayCheckoutBooking]);

      const result = await service.checkPropertyAvailability(
        propertyId,
        requestedRange
      );

      expect(result.available).toBe(true);
      expect(result.message).toContain("Same-day turnaround available");
    });
  });

  describe("getAvailabilityCalendar", () => {
    it("should generate monthly availability calendar", async () => {
      const propertyId = "villa-001";
      const month = "2024-12";

      const bookings = [
        {
          checkIn: "2024-12-15",
          checkOut: "2024-12-20",
          status: "CONFIRMED",
        },
      ];

      service.setExistingBookings(bookings);

      const calendar = await service.getAvailabilityCalendar(propertyId, month);

      // Check specific dates
      expect(calendar.days.find((d) => d.date === "2024-12-14").available).toBe(
        true
      );
      expect(calendar.days.find((d) => d.date === "2024-12-15").available).toBe(
        false
      );
      expect(calendar.days.find((d) => d.date === "2024-12-16").available).toBe(
        false
      );
      expect(calendar.days.find((d) => d.date === "2024-12-19").available).toBe(
        false
      );
      expect(calendar.days.find((d) => d.date === "2024-12-20").available).toBe(
        true
      ); // Checkout day
    });
  });
});

// Implementation driven by tests
export class AvailabilityService {
  private existingBookings: BookingRecord[] = [];

  setExistingBookings(bookings: BookingRecord[]): void {
    this.existingBookings = bookings;
  }

  async checkPropertyAvailability(
    propertyId: string,
    requested: DateRange
  ): Promise<PropertyAvailability> {
    const activeBookings = this.existingBookings.filter(
      (booking) => booking.status !== "CANCELLED"
    );

    const conflicts = activeBookings.filter((booking) =>
      this.hasDateOverlap(requested, booking)
    );

    if (conflicts.length === 0) {
      return {
        available: true,
        conflictingBookings: [],
        propertyId,
        requestedRange: requested,
      };
    }

    // Check for same-day turnaround (allowed in resort industry)
    if (conflicts.every((booking) => booking.checkOut === requested.checkIn)) {
      return {
        available: true,
        conflictingBookings: [],
        propertyId,
        requestedRange: requested,
        message: "Same-day turnaround available (checkout 12PM, checkin 2PM)",
      };
    }

    return {
      available: false,
      conflictingBookings: conflicts,
      propertyId,
      requestedRange: requested,
    };
  }

  private hasDateOverlap(
    requested: DateRange,
    existing: BookingRecord
  ): boolean {
    const requestStart = new Date(requested.checkIn);
    const requestEnd = new Date(requested.checkOut);
    const existingStart = new Date(existing.checkIn);
    const existingEnd = new Date(existing.checkOut);

    // No overlap if one booking ends when the other starts (same-day turnaround)
    if (
      requestStart.getTime() === existingEnd.getTime() ||
      requestEnd.getTime() === existingStart.getTime()
    ) {
      return false;
    }

    // Check for any overlap
    return requestStart < existingEnd && requestEnd > existingStart;
  }

  async getAvailabilityCalendar(
    propertyId: string,
    month: string
  ): Promise<AvailabilityCalendar> {
    const [year, monthNum] = month.split("-").map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    const days: AvailabilityDay[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${monthNum.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
      const available = await this.isDateAvailable(propertyId, dateStr);

      days.push({
        date: dateStr,
        available,
        price: available
          ? await this.getPriceForDate(propertyId, dateStr)
          : null,
      });
    }

    return {
      propertyId,
      month,
      days,
    };
  }

  private async isDateAvailable(
    propertyId: string,
    date: string
  ): Promise<boolean> {
    return !this.existingBookings.some((booking) => {
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      const targetDate = new Date(date);

      return (
        booking.status !== "CANCELLED" &&
        targetDate >= checkIn &&
        targetDate < checkOut
      ); // Guest checks out in morning, new guest can check in afternoon
    });
  }

  private async getPriceForDate(
    propertyId: string,
    date: string
  ): Promise<number> {
    // Implementation for dynamic pricing based on season, day of week, etc.
    return 8000; // Base rate for now
  }
}
```

**Example 2: Payment Processing with TDD**

```typescript
// src/services/__tests__/payment.service.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { PaymentService } from "../payment.service";
import { PaymentMethod, PaymentResult, BookingPayment } from "@/types/payment";

describe("PaymentService", () => {
  let service: PaymentService;
  let mockPaymentGateway: any;

  beforeEach(() => {
    mockPaymentGateway = {
      processPayment: vi.fn(),
      verifyPayment: vi.fn(),
    };
    service = new PaymentService(mockPaymentGateway);
  });

  describe("processBookingPayment", () => {
    it("should process full payment successfully", async () => {
      // Arrange
      const booking = createTestBooking({ totalAmount: 15000 });
      const payment: BookingPayment = {
        bookingId: booking.id,
        amount: 15000,
        method: PaymentMethod.CREDIT_CARD,
        currency: "PHP",
        reference: "ref-123",
      };

      mockPaymentGateway.processPayment.mockResolvedValue({
        success: true,
        transactionId: "txn-456",
        gatewayResponse: { status: "approved" },
      });

      // Act
      const result = await service.processBookingPayment(payment);

      // Assert
      expect(result.success).toBe(true);
      expect(result.paymentStatus).toBe("PAID");
      expect(result.transactionId).toBe("txn-456");
      expect(result.amountPaid).toBe(15000);
      expect(result.remainingBalance).toBe(0);
    });

    it("should handle partial payment correctly", async () => {
      const booking = createTestBooking({ totalAmount: 15000 });
      const partialPayment: BookingPayment = {
        bookingId: booking.id,
        amount: 5000, // Partial payment
        method: PaymentMethod.BANK_TRANSFER,
        currency: "PHP",
      };

      mockPaymentGateway.processPayment.mockResolvedValue({
        success: true,
        transactionId: "txn-789",
      });

      const result = await service.processBookingPayment(partialPayment);

      expect(result.success).toBe(true);
      expect(result.paymentStatus).toBe("PARTIAL");
      expect(result.amountPaid).toBe(5000);
      expect(result.remainingBalance).toBe(10000);
    });

    it("should calculate correct Philippine taxes and fees", async () => {
      const booking = createTestBooking({
        baseAmount: 10000,
        nights: 2,
      });

      const payment: BookingPayment = {
        bookingId: booking.id,
        amount: 24400, // Base: 20000, Tax: 2400, Service: 2000
        method: PaymentMethod.CASH,
        currency: "PHP",
      };

      const result = await service.processBookingPayment(payment);

      expect(result.breakdown).toEqual({
        subtotal: 20000,
        vat: 2400, // 12% VAT
        serviceCharge: 2000, // 10% service charge
        total: 24400,
      });
    });

    it("should handle payment gateway failures gracefully", async () => {
      const payment: BookingPayment = {
        bookingId: "booking-123",
        amount: 15000,
        method: PaymentMethod.CREDIT_CARD,
        currency: "PHP",
      };

      mockPaymentGateway.processPayment.mockRejectedValue(
        new Error("Gateway timeout")
      );

      const result = await service.processBookingPayment(payment);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Gateway timeout");
      expect(result.paymentStatus).toBe("FAILED");
    });

    it("should validate payment amounts against booking total", async () => {
      const booking = createTestBooking({ totalAmount: 15000 });
      const invalidPayment: BookingPayment = {
        bookingId: booking.id,
        amount: 20000, // More than booking total
        method: PaymentMethod.CREDIT_CARD,
        currency: "PHP",
      };

      await expect(
        service.processBookingPayment(invalidPayment)
      ).rejects.toThrow("Payment amount exceeds booking total");
    });

    it("should support multiple payment methods for Philippine market", async () => {
      const testCases = [
        PaymentMethod.CREDIT_CARD,
        PaymentMethod.DEBIT_CARD,
        PaymentMethod.BANK_TRANSFER,
        PaymentMethod.GCASH,
        PaymentMethod.PAYMAYA,
        PaymentMethod.CASH,
      ];

      for (const method of testCases) {
        mockPaymentGateway.processPayment.mockResolvedValue({
          success: true,
          transactionId: `txn-${method}`,
        });

        const payment: BookingPayment = {
          bookingId: "booking-123",
          amount: 15000,
          method,
          currency: "PHP",
        };

        const result = await service.processBookingPayment(payment);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("refundPayment", () => {
    it("should calculate correct refund amount based on cancellation policy", async () => {
      const originalPayment = {
        transactionId: "txn-123",
        amount: 15000,
        processedAt: new Date("2024-12-01"),
      };

      const cancellationDate = new Date("2024-12-20"); // 5 days before checkin (Dec 25)
      const checkInDate = new Date("2024-12-25");

      const refund = await service.calculateRefund(
        originalPayment,
        cancellationDate,
        checkInDate
      );

      // 5 days notice = 50% refund based on policy
      expect(refund.amount).toBe(7500);
      expect(refund.percentage).toBe(50);
      expect(refund.reason).toContain("5 days notice");
    });
  });
});
```

## TanStack Query Testing Patterns and Integration

### Testing Query Hooks with TypeScript

**Pattern 1: Query Hook Testing**

```typescript
// src/hooks/queries/__tests__/use-bookings.test.ts
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useBookings } from "../use-bookings";
import { QueryClient } from "@tanstack/react-query";
import { createQueryWrapper } from "@tests/utils/query-wrapper";

describe("useBookings", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it("should fetch bookings with proper TypeScript inference", async () => {
    // Mock API response
    const mockBookings = [
      createTestBooking({ id: "booking-1", guestName: "Juan Dela Cruz" }),
      createTestBooking({ id: "booking-2", guestName: "Maria Santos" }),
    ];

    mockApiClient.get.mockResolvedValue({
      data: { data: mockBookings, meta: { total: 2 } },
    });

    const { result } = renderHook(() => useBookings({ status: "CONFIRMED" }), {
      wrapper: createQueryWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // TypeScript ensures type safety
    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.data[0].guestName).toBe("Juan Dela Cruz");

    // Verify API call structure
    expect(mockApiClient.get).toHaveBeenCalledWith(
      "/projects/project-123/bookings",
      expect.objectContaining({
        status: "CONFIRMED",
      })
    );
  });

  it("should handle query errors gracefully", async () => {
    const networkError = new Error("Network unavailable");
    mockApiClient.get.mockRejectedValue(networkError);

    const { result } = renderHook(() => useBookings(), {
      wrapper: createQueryWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(networkError);
    expect(result.current.data).toBeUndefined();
  });

  it("should use proper cache key structure", () => {
    const filters = { status: "CONFIRMED", propertyId: "villa-1" };

    renderHook(() => useBookings(filters), {
      wrapper: createQueryWrapper(queryClient),
    });

    const cacheKeys = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey);

    expect(cacheKeys).toContainEqual([
      "projects",
      "project-123",
      "bookings",
      { status: "CONFIRMED", propertyId: "villa-1" },
    ]);
  });

  it("should support pagination", async () => {
    const page1Response = {
      data: [createTestBooking({ id: "booking-1" })],
      meta: { total: 25, page: 1, limit: 10 },
    };

    mockApiClient.get.mockResolvedValue({ data: page1Response });

    const { result } = renderHook(() => useBookings({ page: 1, limit: 10 }), {
      wrapper: createQueryWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.meta.page).toBe(1);
    expect(result.current.data?.meta.total).toBe(25);
  });
});
```

**Pattern 2: Mutation Hook Testing**

```typescript
// src/hooks/mutations/__tests__/use-create-booking.test.ts
import { renderHook, waitFor } from "@testing-library/react";
import { useCreateBooking } from "../use-create-booking";
import { createQueryWrapper } from "@tests/utils/query-wrapper";

describe("useCreateBooking", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it("should create booking and invalidate related queries", async () => {
    const newBooking = createTestBooking({ guestName: "New Guest" });
    const createdBooking = { ...newBooking, id: "server-123" };

    mockApiClient.post.mockResolvedValue({ data: createdBooking });

    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: createQueryWrapper(queryClient),
    });

    // Pre-populate cache with existing bookings
    queryClient.setQueryData(["projects", "project-123", "bookings", {}], {
      data: [createTestBooking({ id: "existing-1" })],
      meta: { total: 1 },
    });

    await waitFor(async () => {
      await result.current.mutateAsync(newBooking);
    });

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toEqual(createdBooking);

    // Verify API call
    expect(mockApiClient.post).toHaveBeenCalledWith(
      "/projects/project-123/bookings",
      newBooking
    );

    // Verify cache invalidation (queries should be marked as stale)
    const bookingQueries = queryClient.getQueryCache().findAll({
      queryKey: ["projects", "project-123", "bookings"],
    });

    expect(bookingQueries.every((query) => query.isStale())).toBe(true);
  });

  it("should handle optimistic updates correctly", async () => {
    const newBooking = createTestBooking();
    mockApiClient.post.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ data: newBooking }), 100)
        )
    );

    const { result } = renderHook(
      () =>
        useCreateBooking({
          enableOptimisticUpdates: true,
        }),
      { wrapper: createQueryWrapper(queryClient) }
    );

    // Start mutation
    result.current.mutate(newBooking);

    // Should immediately show optimistic data
    expect(result.current.isPending).toBe(true);

    // Check if optimistic booking was added to cache
    const cacheData = queryClient.getQueryData([
      "projects",
      "project-123",
      "bookings",
      {},
    ]) as any;

    const optimisticBooking = cacheData?.data?.find((b: any) =>
      b.id.startsWith("temp-booking-")
    );
    expect(optimisticBooking).toBeDefined();

    // Wait for completion
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Optimistic booking should be replaced with server response
    const finalCacheData = queryClient.getQueryData([
      "projects",
      "project-123",
      "bookings",
      {},
    ]) as any;

    expect(
      finalCacheData?.data?.some((b: any) => b.id.startsWith("temp-booking-"))
    ).toBe(false);
  });

  it("should validate booking data before submission", async () => {
    const invalidBooking = createTestBooking({
      guestName: "", // Invalid - required field
      checkIn: "2024-12-30",
      checkOut: "2024-12-25", // Invalid - checkout before checkin
    });

    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: createQueryWrapper(queryClient),
    });

    await expect(result.current.mutateAsync(invalidBooking)).rejects.toThrow(
      /validation/i
    );

    // Should not make API call with invalid data
    expect(mockApiClient.post).not.toHaveBeenCalled();
  });

  it("should handle concurrent mutations correctly", async () => {
    const booking1 = createTestBooking({ guestName: "Guest 1" });
    const booking2 = createTestBooking({ guestName: "Guest 2" });

    mockApiClient.post
      .mockResolvedValueOnce({ data: { ...booking1, id: "server-1" } })
      .mockResolvedValueOnce({ data: { ...booking2, id: "server-2" } });

    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: createQueryWrapper(queryClient),
    });

    // Fire multiple mutations concurrently
    const promise1 = result.current.mutateAsync(booking1);
    const promise2 = result.current.mutateAsync(booking2);

    const results = await Promise.all([promise1, promise2]);

    expect(results[0].id).toBe("server-1");
    expect(results[1].id).toBe("server-2");
    expect(mockApiClient.post).toHaveBeenCalledTimes(2);
  });
});
```

**Pattern 3: Infinite Query Testing**

```typescript
// src/hooks/queries/__tests__/use-infinite-bookings.test.ts
import { renderHook, waitFor } from "@testing-library/react";
import { useInfiniteBookings } from "../use-infinite-bookings";

describe("useInfiniteBookings", () => {
  it("should load multiple pages correctly", async () => {
    // Mock paginated responses
    const page1 = {
      data: [createTestBooking({ id: "booking-1" })],
      meta: { page: 1, limit: 10, total: 25, hasMore: true },
    };

    const page2 = {
      data: [createTestBooking({ id: "booking-2" })],
      meta: { page: 2, limit: 10, total: 25, hasMore: true },
    };

    mockApiClient.get
      .mockResolvedValueOnce({ data: page1 })
      .mockResolvedValueOnce({ data: page2 });

    const { result } = renderHook(() => useInfiniteBookings({ limit: 10 }), {
      wrapper: createQueryWrapper(queryClient),
    });

    // Wait for first page
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.data?.pages[0].data[0].id).toBe("booking-1");
    expect(result.current.hasNextPage).toBe(true);

    // Fetch next page
    result.current.fetchNextPage();

    await waitFor(() => {
      expect(result.current.data?.pages).toHaveLength(2);
    });

    expect(result.current.data?.pages[1].data[0].id).toBe("booking-2");
  });

  it("should flatten pages correctly for display", async () => {
    const page1Data = [
      createTestBooking({ id: "booking-1" }),
      createTestBooking({ id: "booking-2" }),
    ];
    const page2Data = [
      createTestBooking({ id: "booking-3" }),
      createTestBooking({ id: "booking-4" }),
    ];

    mockApiClient.get
      .mockResolvedValueOnce({
        data: { data: page1Data, meta: { hasMore: true } },
      })
      .mockResolvedValueOnce({
        data: { data: page2Data, meta: { hasMore: false } },
      });

    const { result } = renderHook(() => useInfiniteBookings(), {
      wrapper: createQueryWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    result.current.fetchNextPage();

    await waitFor(() => {
      expect(result.current.data?.pages).toHaveLength(2);
    });

    // Test flattened data
    const allBookings =
      result.current.data?.pages.flatMap((page) => page.data) ?? [];
    expect(allBookings).toHaveLength(4);
    expect(allBookings.map((b) => b.id)).toEqual([
      "booking-1",
      "booking-2",
      "booking-3",
      "booking-4",
    ]);
  });
});
```

### Integration Testing Patterns

**Pattern 1: Store + Query Integration**

```typescript
// src/integration/__tests__/booking-flow.integration.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBookingStore } from '@/stores/bookingStore';
import { useCreateBooking } from '@/hooks/mutations/use-create-booking';
import { useBookings } from '@/hooks/queries/use-bookings';
import { TestProvider } from '@tests/utils/TestProvider';

describe('Booking Flow Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
  });

  it('should maintain consistency between Zustand store and TanStack Query cache', async () => {
    const newBooking = createTestBooking();
    const createdBooking = { ...newBooking, id: 'server-123' };

    mockApiClient.post.mockResolvedValue({ data: createdBooking });
    mockApiClient.get.mockResolvedValue({
      data: { data: [createdBooking], meta: { total: 1 } }
    });

    const TestComponent = () => {
      const bookingStore = useBookingStore();
      const createMutation = useCreateBooking();
      const bookingsQuery = useBookings();

      return {
        bookingStore,
        createMutation,
        bookingsQuery
      };
    };

    const { result } = renderHook(TestComponent, {
      wrapper: ({ children }) => (
        <TestProvider queryClient={queryClient}>
          {children}
        </TestProvider>
      )
    });

    // Initial state - both should be empty
    expect(result.current.bookingStore.bookings).toHaveLength(0);
    expect(result.current.bookingsQuery.data?.data).toBeUndefined();

    // Create booking via mutation
    await act(async () => {
      await result.current.createMutation.mutateAsync(newBooking);
    });

    // Wait for query to refetch and update
    await waitFor(() => {
      expect(result.current.bookingsQuery.data?.data).toHaveLength(1);
    });

    // Both store and query cache should be in sync
    expect(result.current.bookingStore.bookings).toHaveLength(1);
    expect(result.current.bookingsQuery.data?.data[0].id).toBe('server-123');
    expect(result.current.bookingStore.bookings[0].id).toBe('server-123');
  });

  it('should handle offline scenarios gracefully', async () => {
    const newBooking = createTestBooking();

    // Simulate network failure
    mockApiClient.post.mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(
      () => ({
        store: useBookingStore(),
        mutation: useCreateBooking()
      }),
      { wrapper: createTestWrapper(queryClient) }
    );

    // Attempt to create booking
    await expect(
      act(async () => {
        await result.current.mutation.mutateAsync(newBooking);
      })
    ).rejects.toThrow('Network Error');

    // Store should handle the error gracefully
    expect(result.current.store.error).toBe('Network Error');
    expect(result.current.store.optimisticBookings).toHaveLength(0);
    expect(result.current.mutation.isError).toBe(true);
  });
});
```

**Pattern 2: End-to-End Booking Scenario**

```typescript
// src/integration/__tests__/complete-booking-flow.test.ts
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookingPage } from '@/pages/BookingPage';
import { TestProvider } from '@tests/utils/TestProvider';

describe('Complete Booking Flow', () => {
  it('should complete full booking process from search to confirmation', async () => {
    const user = userEvent.setup();

    // Mock API responses for the complete flow
    mockApiClient.get
      .mockResolvedValueOnce({ // Properties
        data: [{ id: 'villa-1', name: 'Beachfront Villa', baseRate: 8000 }]
      })
      .mockResolvedValueOnce({ // Availability check
        data: { available: true }
      })
      .mockResolvedValueOnce({ // Booking creation
        data: createTestBooking({ id: 'new-booking-123' })
      });

    render(
      <TestProvider>
        <BookingPage />
      </TestProvider>
    );

    // Step 1: Select property
    await waitFor(() => {
      expect(screen.getByText('Beachfront Villa')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Beachfront Villa'));

    // Step 2: Select dates
    const checkInInput = screen.getByLabelText(/check.in/i);
    const checkOutInput = screen.getByLabelText(/check.out/i);

    await user.type(checkInInput, '2024-12-25');
    await user.type(checkOutInput, '2024-12-30');

    // Step 3: Fill guest information
    await user.type(screen.getByLabelText(/guest name/i), 'Juan Dela Cruz');
    await user.type(screen.getByLabelText(/email/i), 'juan@example.ph');
    await user.type(screen.getByLabelText(/phone/i), '+639171234567');

    // Step 4: Submit booking
    const submitButton = screen.getByRole('button', { name: /confirm booking/i });
    await user.click(submitButton);

    // Verify success
    await waitFor(() => {
      expect(screen.getByText(/booking confirmed/i)).toBeInTheDocument();
      expect(screen.getByText('new-booking-123')).toBeInTheDocument();
    });

    // Verify all API calls were made correctly
    expect(mockApiClient.get).toHaveBeenCalledTimes(2);
    expect(mockApiClient.post).toHaveBeenCalledWith(
      expect.stringContaining('/bookings'),
      expect.objectContaining({
        guestName: 'Juan Dela Cruz',
        guestEmail: 'juan@example.ph'
      })
    );
  });
});
```

### Testing Utilities and Helpers

```typescript
// tests/utils/query-wrapper.tsx
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectProvider } from '@/contexts/ProjectContext';

export const createQueryWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ProjectProvider projectId="project-123">
        {children}
      </ProjectProvider>
    </QueryClientProvider>
  );
};

// tests/utils/test-factories.ts
export const createTestBooking = (overrides: Partial<Booking> = {}): Booking => ({
  id: `booking-${Math.random().toString(36).substr(2, 9)}`,
  projectId: 'project-123',
  propertyId: 'villa-1',
  guestName: 'Test Guest',
  guestEmail: 'test@example.com',
  guestPhone: '+639171234567',
  checkIn: '2024-12-25',
  checkOut: '2024-12-30',
  nights: 5,
  guestCount: 2,
  totalAmount: 40000,
  paidAmount: 0,
  status: BookingStatus.PENDING,
  paymentStatus: 'PENDING' as any,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

// tests/utils/assertions.ts
export const expectBookingToEqual = (
  actual: Booking,
  expected: Partial<Booking>
) => {
  Object.entries(expected).forEach(([key, value]) => {
    expect(actual[key as keyof Booking]).toBe(value);
  });
};

export const expectQueryToBeInCache = (
  queryClient: QueryClient,
  queryKey: any[],
  expectedData?: any
) => {
  const queryData = queryClient.getQueryData(queryKey);
  expect(queryData).toBeDefined();

  if (expectedData) {
    expect(queryData).toEqual(expectedData);
  }
};
```

This comprehensive TDD Implementation Guide provides the foundation for building
reliable, maintainable code for the Okaeri Resort Management System. The
examples show real-world patterns specific to the resort/hospitality industry
while maintaining strict TypeScript safety and comprehensive test coverage.

The guide covers:

- **Executive Summary**: Business case for TDD in resort management
- **TDD Fundamentals**: Red-Green-Refactor cycle with TypeScript
- **Project-Specific Patterns**: React components and Zustand store testing
- **Practical Examples**: Booking and payment processing with real code
- **TanStack Query Integration**: Comprehensive query and mutation testing
  patterns

Use this guide as a reference for implementing test-driven development across
all features of the resort management system, ensuring reliability and
maintainability for long-term success.

<function_calls> <invoke name="TodoWrite"> <parameter name="todos">[{"content":
"Create TDD Implementation Guide with executive summary and fundamentals",
"status": "completed", "activeForm": "Creating TDD Implementation Guide with
executive summary and fundamentals"}, {"content": "Add project-specific patterns
for React components and Zustand stores", "status": "completed", "activeForm":
"Adding project-specific patterns for React components and Zustand stores"},
{"content": "Include practical booking and payment examples with real code",
"status": "completed", "activeForm": "Including practical booking and payment
examples with real code"}, {"content": "Add TanStack Query testing patterns and
integration examples", "status": "in_progress", "activeForm": "Adding TanStack
Query testing patterns and integration examples"}]
