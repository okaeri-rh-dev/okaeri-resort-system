# Sub-phase 3.1: Test Calendar Component (RED Phase)

## Overview

This sub-phase focuses on creating comprehensive tests for the calendar
visualization component before implementation. Following TDD principles, we
write failing tests that define the expected behavior of our booking calendar
system.

## Test Specifications

### Calendar Component Tests

```typescript
// tests/components/BookingCalendar.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BookingCalendar } from '@/components/booking/BookingCalendar';
import { mockBookings, mockRooms } from '@/tests/fixtures/booking-fixtures';

describe('BookingCalendar Component', () => {
  describe('Calendar Rendering', () => {
    it('should render calendar with current month by default', () => {
      render(<BookingCalendar projectId="test-project-001" />);

      const currentMonth = new Date().toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
      });
      expect(screen.getByText(currentMonth)).toBeInTheDocument();
    });

    it('should display all days of the month in grid layout', () => {
      render(<BookingCalendar projectId="test-project-001" />);

      const dayGrid = screen.getByTestId('calendar-day-grid');
      const days = dayGrid.querySelectorAll('[data-testid^="calendar-day-"]');

      expect(days.length).toBeGreaterThanOrEqual(28); // Minimum days in any month
      expect(days.length).toBeLessThanOrEqual(42); // Maximum grid cells (6 weeks)
    });

    it('should highlight today\'s date', () => {
      render(<BookingCalendar projectId="test-project-001" />);

      const today = new Date().getDate().toString();
      const todayCell = screen.getByTestId(`calendar-day-${today}`);

      expect(todayCell).toHaveClass('calendar-day--today');
    });

    it('should show week headers (Sun-Sat)', () => {
      render(<BookingCalendar projectId="test-project-001" />);

      const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      weekDays.forEach(day => {
        expect(screen.getByText(day)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Controls', () => {
    it('should navigate to previous month when clicking previous button', async () => {
      render(<BookingCalendar projectId="test-project-001" />);

      const prevButton = screen.getByTestId('calendar-prev-month');
      const currentDate = new Date();
      const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);

      fireEvent.click(prevButton);

      await waitFor(() => {
        const monthDisplay = prevMonth.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric'
        });
        expect(screen.getByText(monthDisplay)).toBeInTheDocument();
      });
    });

    it('should navigate to next month when clicking next button', async () => {
      render(<BookingCalendar projectId="test-project-001" />);

      const nextButton = screen.getByTestId('calendar-next-month');
      const currentDate = new Date();
      const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1);

      fireEvent.click(nextButton);

      await waitFor(() => {
        const monthDisplay = nextMonth.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric'
        });
        expect(screen.getByText(monthDisplay)).toBeInTheDocument();
      });
    });

    it('should jump to today when clicking today button', async () => {
      render(<BookingCalendar projectId="test-project-001" />);

      // Navigate away first
      const prevButton = screen.getByTestId('calendar-prev-month');
      fireEvent.click(prevButton);
      fireEvent.click(prevButton);

      // Click today button
      const todayButton = screen.getByTestId('calendar-today-button');
      fireEvent.click(todayButton);

      await waitFor(() => {
        const currentMonth = new Date().toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric'
        });
        expect(screen.getByText(currentMonth)).toBeInTheDocument();
      });
    });

    it('should allow date picker selection for specific month/year', async () => {
      render(<BookingCalendar projectId="test-project-001" />);

      const datePickerButton = screen.getByTestId('calendar-date-picker');
      fireEvent.click(datePickerButton);

      const monthSelect = screen.getByTestId('month-select');
      const yearSelect = screen.getByTestId('year-select');

      fireEvent.change(monthSelect, { target: { value: '11' } }); // December
      fireEvent.change(yearSelect, { target: { value: '2024' } });

      const applyButton = screen.getByTestId('date-picker-apply');
      fireEvent.click(applyButton);

      await waitFor(() => {
        expect(screen.getByText('December 2024')).toBeInTheDocument();
      });
    });
  });

  describe('View Modes', () => {
    it('should switch between month, week, and day views', () => {
      render(<BookingCalendar projectId="test-project-001" />);

      const viewSelector = screen.getByTestId('calendar-view-selector');

      // Test week view
      fireEvent.change(viewSelector, { target: { value: 'week' } });
      expect(screen.getByTestId('calendar-week-view')).toBeInTheDocument();

      // Test day view
      fireEvent.change(viewSelector, { target: { value: 'day' } });
      expect(screen.getByTestId('calendar-day-view')).toBeInTheDocument();

      // Test month view
      fireEvent.change(viewSelector, { target: { value: 'month' } });
      expect(screen.getByTestId('calendar-month-view')).toBeInTheDocument();
    });

    it('should display hourly slots in day view', () => {
      render(<BookingCalendar projectId="test-project-001" viewMode="day" />);

      const hourSlots = screen.getAllByTestId(/^hour-slot-/);
      expect(hourSlots).toHaveLength(24); // 24 hours

      // Check specific hours are displayed
      expect(screen.getByText('12:00 AM')).toBeInTheDocument();
      expect(screen.getByText('12:00 PM')).toBeInTheDocument();
      expect(screen.getByText('11:00 PM')).toBeInTheDocument();
    });

    it('should show 7 days in week view', () => {
      render(<BookingCalendar projectId="test-project-001" viewMode="week" />);

      const dayColumns = screen.getAllByTestId(/^week-day-column-/);
      expect(dayColumns).toHaveLength(7);
    });
  });

  describe('Date Selection', () => {
    it('should allow single date selection', () => {
      const onDateSelect = jest.fn();
      render(
        <BookingCalendar
          projectId="test-project-001"
          onDateSelect={onDateSelect}
        />
      );

      const date = screen.getByTestId('calendar-day-15');
      fireEvent.click(date);

      expect(date).toHaveClass('calendar-day--selected');
      expect(onDateSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          date: expect.any(Date),
          available: expect.any(Boolean)
        })
      );
    });

    it('should allow date range selection', () => {
      const onRangeSelect = jest.fn();
      render(
        <BookingCalendar
          projectId="test-project-001"
          selectionMode="range"
          onRangeSelect={onRangeSelect}
        />
      );

      const startDate = screen.getByTestId('calendar-day-10');
      const endDate = screen.getByTestId('calendar-day-15');

      fireEvent.click(startDate);
      fireEvent.click(endDate);

      expect(startDate).toHaveClass('calendar-day--range-start');
      expect(endDate).toHaveClass('calendar-day--range-end');

      // Check intermediate days are highlighted
      for (let i = 11; i <= 14; i++) {
        const dayCell = screen.getByTestId(`calendar-day-${i}`);
        expect(dayCell).toHaveClass('calendar-day--in-range');
      }

      expect(onRangeSelect).toHaveBeenCalledWith({
        start: expect.any(Date),
        end: expect.any(Date),
        days: 6
      });
    });

    it('should prevent selection of past dates when disabled', () => {
      const onDateSelect = jest.fn();
      render(
        <BookingCalendar
          projectId="test-project-001"
          disablePastDates={true}
          onDateSelect={onDateSelect}
        />
      );

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDate = yesterday.getDate();

      const yesterdayCell = screen.getByTestId(`calendar-day-${yesterdayDate}`);
      fireEvent.click(yesterdayCell);

      expect(yesterdayCell).toHaveClass('calendar-day--disabled');
      expect(onDateSelect).not.toHaveBeenCalled();
    });

    it('should clear selection when clicking clear button', () => {
      render(
        <BookingCalendar
          projectId="test-project-001"
          selectionMode="range"
        />
      );

      const startDate = screen.getByTestId('calendar-day-10');
      const endDate = screen.getByTestId('calendar-day-15');

      fireEvent.click(startDate);
      fireEvent.click(endDate);

      const clearButton = screen.getByTestId('calendar-clear-selection');
      fireEvent.click(clearButton);

      expect(startDate).not.toHaveClass('calendar-day--range-start');
      expect(endDate).not.toHaveClass('calendar-day--range-end');
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should display mobile-optimized layout on small screens', () => {
      // Mock window.matchMedia
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(max-width: 768px)',
          media: query,
          onchange: null,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(<BookingCalendar projectId="test-project-001" />);

      expect(screen.getByTestId('calendar-mobile-view')).toBeInTheDocument();
      expect(screen.queryByTestId('calendar-desktop-view')).not.toBeInTheDocument();
    });

    it('should show swipe hints on mobile', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(max-width: 768px)',
          media: query,
          onchange: null,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(<BookingCalendar projectId="test-project-001" />);

      expect(screen.getByText(/Swipe left\/right to navigate/i)).toBeInTheDocument();
    });
  });
});
```

### Database Schema Tests

```typescript
// tests/database/booking-schema.test.ts
import { Pool } from "pg";
import {
  createTestDatabase,
  dropTestDatabase,
} from "@/tests/helpers/db-helpers";
import { runMigrations } from "@/database/migrations";

describe("Booking Database Schema", () => {
  let pool: Pool;
  let projectSchema: string;

  beforeAll(async () => {
    projectSchema = "test_project_" + Date.now();
    pool = await createTestDatabase();
    await runMigrations(pool, projectSchema);
  });

  afterAll(async () => {
    await dropTestDatabase(pool, projectSchema);
    await pool.end();
  });

  describe("RLS Table Structure", () => {
    it("should have project_id column in all booking tables", async () => {
      const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'bookings'
          AND column_name = 'project_id'
      `);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].column_name).toBe("project_id");
    });

    it("should create all required booking tables in public schema", async () => {
      const tables = [
        "bookings",
        "booking_guests",
        "booking_payments",
        "rooms",
        "room_types",
        "availability_rules",
        "booking_status_history",
      ];

      for (const table of tables) {
        const result = await pool.query(
          `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        `,
          [table]
        );

        expect(result.rows).toHaveLength(1);
      }
    });

    it("should have proper column types for financial data", async () => {
      const result = await pool.query(`
        SELECT column_name, data_type, numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = 'bookings'
          AND column_name IN ('total_amount', 'paid_amount', 'balance_amount')
      `);

      result.rows.forEach((column) => {
        expect(column.data_type).toBe("numeric");
        expect(column.numeric_precision).toBe(12);
        expect(column.numeric_scale).toBe(2);
      });
    });

    it("should have RLS enabled on bookings table", async () => {
      const result = await pool.query(`
        SELECT relrowsecurity, relforcerowsecurity
        FROM pg_class
        WHERE relname = 'bookings'
          AND relnamespace = 'public'::regnamespace
      `);

      expect(result.rows[0].relrowsecurity).toBe(true);
      expect(result.rows[0].relforcerowsecurity).toBe(true);
    });
  });

  describe("Constraints and Indexes", () => {
    it("should have primary key on bookings table", async () => {
      const result = await pool.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'public' 
          AND table_name = 'bookings'
          AND constraint_type = 'PRIMARY KEY'
      `);

      expect(result.rows).toHaveLength(1);
    });

    it("should have foreign key from bookings to rooms", async () => {
      const result = await pool.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'public' 
          AND table_name = 'bookings'
          AND constraint_type = 'FOREIGN KEY'
          AND constraint_name LIKE '%room%'
      `);

      expect(result.rows.length).toBeGreaterThan(0);
    });

    it("should have check constraint for date validation", async () => {
      const result = await pool.query(`
        SELECT constraint_name
        FROM information_schema.check_constraints
        WHERE constraint_schema = 'public'
          AND constraint_name = 'check_dates'
      `);

      expect(result.rows).toHaveLength(1);
    });

    it("should have composite index with project_id for performance", async () => {
      const result = await pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'bookings'
          AND indexdef LIKE '%project_id%'
      `);

      expect(result.rows.length).toBeGreaterThan(0);
    });

    it("should have GiST index for date range queries", async () => {
      const result = await pool.query(
        `
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = $1
          AND tablename = 'bookings'
          AND indexdef LIKE '%gist%'
      `,
        [projectSchema]
      );

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].indexdef).toContain("daterange");
    });

    it("should have composite index for availability queries", async () => {
      const result = await pool.query(
        `
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = $1
          AND tablename = 'bookings'
          AND indexname = 'idx_bookings_room_dates'
      `,
        [projectSchema]
      );

      expect(result.rows).toHaveLength(1);
    });
  });

  describe("Row-Level Security", () => {
    it("should have RLS enabled on bookings table", async () => {
      const result = await pool.query(
        `
        SELECT relrowsecurity
        FROM pg_class
        WHERE relnamespace = $1::regnamespace
          AND relname = 'bookings'
      `,
        [projectSchema]
      );

      expect(result.rows[0].relrowsecurity).toBe(true);
    });

    it("should have project isolation policy", async () => {
      const result = await pool.query(
        `
        SELECT polname
        FROM pg_policies
        WHERE schemaname = $1
          AND tablename = 'bookings'
          AND polname = 'booking_project_isolation'
      `,
        [projectSchema]
      );

      expect(result.rows).toHaveLength(1);
    });
  });
});
```

### Calendar Utility Tests

```typescript
// tests/utils/calendar-utils.test.ts
import {
  getMonthData,
  getWeekData,
  isDateAvailable,
  getDateRangeArray,
  formatCalendarDate,
  calculateBookingDuration,
  getConflictingBookings,
} from "@/utils/calendar-utils";

describe("Calendar Utilities", () => {
  describe("getMonthData", () => {
    it("should return correct number of weeks for a month", () => {
      const februaryData = getMonthData(2024, 1); // February 2024
      expect(februaryData.weeks).toHaveLength(5); // Feb 2024 spans 5 weeks

      const marchData = getMonthData(2024, 2); // March 2024
      expect(marchData.weeks).toHaveLength(6); // March 2024 spans 6 weeks
    });

    it("should include previous and next month dates", () => {
      const data = getMonthData(2024, 0); // January 2024

      // January 2024 starts on Monday, so should include Dec 31
      const firstWeek = data.weeks[0];
      expect(
        firstWeek.some((day) => day.month === 11 && day.year === 2023)
      ).toBe(true);

      // Should also include some February dates
      const lastWeek = data.weeks[data.weeks.length - 1];
      expect(lastWeek.some((day) => day.month === 1 && day.year === 2024)).toBe(
        true
      );
    });

    it("should mark weekends correctly", () => {
      const data = getMonthData(2024, 0);

      data.weeks.forEach((week) => {
        expect(week[0].isWeekend).toBe(true); // Sunday
        expect(week[6].isWeekend).toBe(true); // Saturday
        expect(week[3].isWeekend).toBe(false); // Wednesday
      });
    });
  });

  describe("getWeekData", () => {
    it("should return 7 days starting from Sunday", () => {
      const week = getWeekData(new Date("2024-01-15"));

      expect(week).toHaveLength(7);
      expect(week[0].dayOfWeek).toBe(0); // Sunday
      expect(week[6].dayOfWeek).toBe(6); // Saturday
    });

    it("should handle week spanning two months", () => {
      const week = getWeekData(new Date("2024-01-31")); // Jan 31 is Wednesday

      // Week should be Jan 28 (Sun) to Feb 3 (Sat)
      expect(week[0].date.getDate()).toBe(28);
      expect(week[0].date.getMonth()).toBe(0); // January

      expect(week[6].date.getDate()).toBe(3);
      expect(week[6].date.getMonth()).toBe(1); // February
    });
  });

  describe("isDateAvailable", () => {
    const bookings = [
      {
        id: "1",
        checkIn: new Date("2024-01-10"),
        checkOut: new Date("2024-01-15"),
        roomId: "room-1",
        status: "confirmed",
      },
      {
        id: "2",
        checkIn: new Date("2024-01-20"),
        checkOut: new Date("2024-01-22"),
        roomId: "room-1",
        status: "pending",
      },
    ];

    it("should return false for dates within booking range", () => {
      expect(isDateAvailable(new Date("2024-01-12"), "room-1", bookings)).toBe(
        false
      );
    });

    it("should return true for check-out date", () => {
      expect(isDateAvailable(new Date("2024-01-15"), "room-1", bookings)).toBe(
        true
      );
    });

    it("should return false for check-in date", () => {
      expect(isDateAvailable(new Date("2024-01-10"), "room-1", bookings)).toBe(
        false
      );
    });

    it("should return true for available dates", () => {
      expect(isDateAvailable(new Date("2024-01-17"), "room-1", bookings)).toBe(
        true
      );
    });

    it("should ignore cancelled bookings", () => {
      const bookingsWithCancelled = [
        ...bookings,
        {
          id: "3",
          checkIn: new Date("2024-01-25"),
          checkOut: new Date("2024-01-27"),
          roomId: "room-1",
          status: "cancelled",
        },
      ];

      expect(
        isDateAvailable(new Date("2024-01-26"), "room-1", bookingsWithCancelled)
      ).toBe(true);
    });
  });

  describe("getDateRangeArray", () => {
    it("should return array of dates between start and end", () => {
      const start = new Date("2024-01-10");
      const end = new Date("2024-01-15");
      const range = getDateRangeArray(start, end);

      expect(range).toHaveLength(6); // Jan 10-15 inclusive
      expect(range[0].toISOString()).toContain("2024-01-10");
      expect(range[5].toISOString()).toContain("2024-01-15");
    });

    it("should handle single day range", () => {
      const date = new Date("2024-01-10");
      const range = getDateRangeArray(date, date);

      expect(range).toHaveLength(1);
      expect(range[0].toISOString()).toContain("2024-01-10");
    });

    it("should throw error for invalid range", () => {
      const start = new Date("2024-01-15");
      const end = new Date("2024-01-10");

      expect(() => getDateRangeArray(start, end)).toThrow("Invalid date range");
    });
  });

  describe("formatCalendarDate", () => {
    it("should format date in Philippine locale", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      const formatted = formatCalendarDate(date, "full");

      expect(formatted).toMatch(/January 15, 2024/);
    });

    it("should format date in short format", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      const formatted = formatCalendarDate(date, "short");

      expect(formatted).toMatch(/1\/15\/24/);
    });

    it("should format date with time", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      const formatted = formatCalendarDate(date, "datetime");

      expect(formatted).toMatch(/Jan 15, 2024.*6:30 PM/); // PHT is UTC+8
    });
  });

  describe("calculateBookingDuration", () => {
    it("should calculate nights correctly", () => {
      const checkIn = new Date("2024-01-10");
      const checkOut = new Date("2024-01-15");
      const duration = calculateBookingDuration(checkIn, checkOut);

      expect(duration.nights).toBe(5);
      expect(duration.days).toBe(6);
    });

    it("should handle same-day booking", () => {
      const date = new Date("2024-01-10");
      const duration = calculateBookingDuration(date, date);

      expect(duration.nights).toBe(0);
      expect(duration.days).toBe(1);
    });

    it("should throw error for invalid duration", () => {
      const checkIn = new Date("2024-01-15");
      const checkOut = new Date("2024-01-10");

      expect(() => calculateBookingDuration(checkIn, checkOut)).toThrow(
        "Check-out must be after check-in"
      );
    });
  });

  describe("getConflictingBookings", () => {
    const existingBookings = [
      {
        id: "1",
        checkIn: new Date("2024-01-10"),
        checkOut: new Date("2024-01-15"),
        roomId: "room-1",
      },
      {
        id: "2",
        checkIn: new Date("2024-01-20"),
        checkOut: new Date("2024-01-25"),
        roomId: "room-1",
      },
      {
        id: "3",
        checkIn: new Date("2024-01-12"),
        checkOut: new Date("2024-01-18"),
        roomId: "room-2",
      },
    ];

    it("should detect overlapping bookings", () => {
      const conflicts = getConflictingBookings(
        new Date("2024-01-14"),
        new Date("2024-01-21"),
        "room-1",
        existingBookings
      );

      expect(conflicts).toHaveLength(2);
      expect(conflicts.map((b) => b.id)).toContain("1");
      expect(conflicts.map((b) => b.id)).toContain("2");
    });

    it("should not detect adjacent bookings as conflicts", () => {
      const conflicts = getConflictingBookings(
        new Date("2024-01-15"),
        new Date("2024-01-20"),
        "room-1",
        existingBookings
      );

      expect(conflicts).toHaveLength(0);
    });

    it("should only check specified room", () => {
      const conflicts = getConflictingBookings(
        new Date("2024-01-13"),
        new Date("2024-01-17"),
        "room-1",
        existingBookings
      );

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].roomId).toBe("room-1");
    });

    it("should detect same-day conflicts", () => {
      const conflicts = getConflictingBookings(
        new Date("2024-01-10"),
        new Date("2024-01-10"),
        "room-1",
        existingBookings
      );

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].id).toBe("1");
    });
  });
});
```

## Expected Test Output (RED Phase)

All tests should initially fail with messages like:

```bash
FAIL tests/components/BookingCalendar.test.tsx
  ● BookingCalendar Component › Calendar Rendering › should render calendar with current month by default

    TestingLibraryElementError: Unable to find an element with the text: January 2024

FAIL tests/database/booking-schema.test.ts
  ● Booking Database Schema › Schema Structure › should create project-specific schema

    error: schema "test_project_1704000000" does not exist

FAIL tests/utils/calendar-utils.test.ts
  ● Calendar Utilities › getMonthData › should return correct number of weeks for a month

    TypeError: getMonthData is not a function
```

## Database Connection Configuration

```typescript
// tests/helpers/db-config.ts
import { PoolConfig } from "pg";

export const getTestDbConfig = (): PoolConfig => ({
  host: process.env.TEST_DB_HOST || "localhost",
  port: parseInt(process.env.TEST_DB_PORT || "5432"),
  database: process.env.TEST_DB_NAME || "okaeri_test",
  user: process.env.TEST_DB_USER || "test_user",
  password: process.env.TEST_DB_PASSWORD,
  max: 5, // Limit connections for testing
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 5000,
  query_timeout: 5000,
});

export const createProjectSchema = async (pool: Pool, projectId: string) => {
  const schemaName = `project_${projectId.replace(/-/g, "_")}`;

  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
  await pool.query(`
    SET search_path TO ${schemaName}, public;
  `);

  return schemaName;
};
```

## Performance Test Specifications

```typescript
// tests/performance/calendar-performance.test.ts
describe('Calendar Performance', () => {
  it('should render calendar within 500ms', async () => {
    const startTime = performance.now();

    render(<BookingCalendar projectId="test-project" />);

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    expect(renderTime).toBeLessThan(500);
  });

  it('should check availability for 30 days within 100ms', async () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    const startTime = performance.now();

    const availability = await checkAvailability(
      'room-1',
      startDate,
      endDate
    );

    const endTime = performance.now();
    const queryTime = endTime - startTime;

    expect(queryTime).toBeLessThan(100);
    expect(availability).toBeDefined();
  });

  it('should handle 1000 bookings without performance degradation', async () => {
    const bookings = generateMockBookings(1000);

    const startTime = performance.now();

    render(
      <BookingCalendar
        projectId="test-project"
        bookings={bookings}
      />
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    expect(renderTime).toBeLessThan(1000);
  });
});
```

## Accessibility Tests

```typescript
// tests/accessibility/calendar-a11y.test.ts
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Calendar Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<BookingCalendar projectId="test-project" />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it('should support keyboard navigation', () => {
    render(<BookingCalendar projectId="test-project" />);

    const firstDate = screen.getByTestId('calendar-day-1');
    firstDate.focus();

    // Test arrow key navigation
    fireEvent.keyDown(firstDate, { key: 'ArrowRight' });
    expect(screen.getByTestId('calendar-day-2')).toHaveFocus();

    fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' });
    expect(screen.getByTestId('calendar-day-9')).toHaveFocus();
  });

  it('should have proper ARIA labels', () => {
    render(<BookingCalendar projectId="test-project" />);

    expect(screen.getByRole('grid')).toHaveAttribute('aria-label', 'Calendar');
    expect(screen.getByTestId('calendar-prev-month'))
      .toHaveAttribute('aria-label', 'Previous month');
    expect(screen.getByTestId('calendar-next-month'))
      .toHaveAttribute('aria-label', 'Next month');
  });

  it('should announce date selection to screen readers', () => {
    render(<BookingCalendar projectId="test-project" />);

    const date = screen.getByTestId('calendar-day-15');
    fireEvent.click(date);

    expect(date).toHaveAttribute('aria-selected', 'true');
    expect(date).toHaveAttribute('aria-label', expect.stringContaining('Selected'));
  });
});
```

## Test Fixtures and Mocks

```typescript
// tests/fixtures/booking-fixtures.ts
export const mockRooms = [
  {
    id: "room-1",
    name: "Deluxe Suite A",
    typeId: "type-deluxe",
    capacity: 4,
    basePrice: 5000.0,
    status: "available",
  },
  {
    id: "room-2",
    name: "Standard Room B",
    typeId: "type-standard",
    capacity: 2,
    basePrice: 3000.0,
    status: "available",
  },
];

export const mockBookings = [
  {
    id: "booking-1",
    projectId: "test-project-001",
    roomId: "room-1",
    guestName: "John Doe",
    checkIn: new Date("2024-01-10"),
    checkOut: new Date("2024-01-15"),
    status: "confirmed",
    totalAmount: 25000.0,
    paidAmount: 25000.0,
    paymentMethod: "gcash",
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "booking-2",
    projectId: "test-project-001",
    roomId: "room-2",
    guestName: "Jane Smith",
    checkIn: new Date("2024-01-20"),
    checkOut: new Date("2024-01-22"),
    status: "pending",
    totalAmount: 6000.0,
    paidAmount: 0,
    paymentMethod: "cash",
    createdAt: new Date("2024-01-05"),
  },
];

export const generateMockBookings = (count: number) => {
  const bookings = [];
  const startDate = new Date("2024-01-01");

  for (let i = 0; i < count; i++) {
    const checkIn = new Date(startDate);
    checkIn.setDate(checkIn.getDate() + i * 3);

    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + Math.floor(Math.random() * 5) + 1);

    bookings.push({
      id: `booking-${i}`,
      projectId: "test-project-001",
      roomId: mockRooms[i % mockRooms.length].id,
      guestName: `Guest ${i}`,
      checkIn,
      checkOut,
      status: ["pending", "confirmed", "cancelled"][i % 3],
      totalAmount: (Math.floor(Math.random() * 10) + 1) * 1000,
      paidAmount: 0,
      paymentMethod: ["cash", "gcash", "bank_transfer"][i % 3],
      createdAt: new Date(),
    });
  }

  return bookings;
};
```

## Test Execution Plan

### Phase Timeline

- **Day 1**: Write component rendering and navigation tests
- **Day 2**: Write database schema and utility function tests

### Running Tests

```bash
# Run all calendar tests
npm test -- --testPathPattern=calendar

# Run with coverage
npm test -- --coverage --testPathPattern=calendar

# Run in watch mode for TDD
npm test -- --watch --testPathPattern=calendar

# Run database tests only
npm test -- --testPathPattern=database/booking-schema
```

### Expected Coverage Targets

- Component tests: 0% (RED phase)
- Utility functions: 0% (RED phase)
- Database operations: 0% (RED phase)

## Agent Handoff Notes

### For Frontend Developer Agent

- All calendar component tests are defined
- Test IDs are specified for all interactive elements
- Accessibility requirements are documented
- Mobile responsiveness tests are included

### For Backend Developer Agent

- Database schema tests are ready
- Connection pooling requirements are specified
- Performance benchmarks are defined
- Transaction patterns are tested

### For QA Engineer Agent

- E2E test scenarios are outlined
- Performance metrics are established
- Accessibility standards are defined
- Test fixtures are provided

## Next Steps

After all tests are written and failing:

1. Proceed to Sub-phase 3.2: Test Availability Logic
2. Continue writing more granular tests for business logic
3. Document any additional test requirements discovered
4. Prepare test database environments
