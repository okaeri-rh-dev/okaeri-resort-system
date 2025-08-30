# Sub-phase 3.2: Test Availability Logic (RED Phase)

## Overview

This sub-phase focuses on creating comprehensive tests for the availability
checking algorithms, conflict detection, and booking rules validation. These
tests define the business logic requirements before implementation.

## Database Query Tests

### Availability Query Tests

```typescript
// tests/database/availability-queries.test.ts
import { Pool } from "pg";
import { AvailabilityService } from "@/services/availability.service";
import { createTestDatabase, seedTestData } from "@/tests/helpers/db-helpers";

describe("Availability Database Queries", () => {
  let pool: Pool;
  let availabilityService: AvailabilityService;
  let projectSchema: string;

  beforeAll(async () => {
    projectSchema = "test_project_" + Date.now();
    pool = await createTestDatabase();
    availabilityService = new AvailabilityService(pool, projectSchema);
    await seedTestData(pool, projectSchema);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("Single Room Availability", () => {
    it("should check availability using daterange operators", async () => {
      const query = `
        SELECT 
          r.id,
          r.name,
          NOT EXISTS (
            SELECT 1 
            FROM ${projectSchema}.bookings b
            WHERE b.room_id = r.id
              AND b.status != 'cancelled'
              AND daterange(b.check_in, b.check_out, '[)') && 
                  daterange($2::date, $3::date, '[)')
          ) as is_available
        FROM ${projectSchema}.rooms r
        WHERE r.id = $1
      `;

      const result = await pool.query(query, [
        "room-1",
        "2024-02-01",
        "2024-02-05",
      ]);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toHaveProperty("is_available");
      expect(typeof result.rows[0].is_available).toBe("boolean");
    });

    it("should use GiST index for range queries", async () => {
      const explainQuery = `
        EXPLAIN (FORMAT JSON, ANALYZE TRUE)
        SELECT * FROM ${projectSchema}.bookings
        WHERE daterange(check_in, check_out, '[)') && 
              daterange('2024-02-01'::date, '2024-02-05'::date, '[)')
      `;

      const result = await pool.query(explainQuery);
      const plan = result.rows[0]["QUERY PLAN"][0]["Plan"];

      // Verify index scan is used
      expect(plan["Node Type"]).toContain("Index Scan");
      expect(plan["Index Name"]).toBe("idx_bookings_date_range");
      expect(plan["Planning Time"]).toBeLessThan(10); // ms
      expect(plan["Execution Time"]).toBeLessThan(5); // ms
    });

    it("should handle edge cases for date boundaries", async () => {
      // Test check-out date of existing booking as check-in for new booking
      const existing = {
        checkIn: "2024-02-01",
        checkOut: "2024-02-05",
        roomId: "room-1",
      };

      await pool.query(
        `
        INSERT INTO ${projectSchema}.bookings 
        (room_id, check_in, check_out, status)
        VALUES ($1, $2, $3, 'confirmed')
      `,
        [existing.roomId, existing.checkIn, existing.checkOut]
      );

      // Should be available starting from checkout date
      const availableFrom = await availabilityService.checkAvailability(
        "room-1",
        "2024-02-05",
        "2024-02-07"
      );
      expect(availableFrom).toBe(true);

      // Should NOT be available ending on checkout date
      const notAvailable = await availabilityService.checkAvailability(
        "room-1",
        "2024-02-04",
        "2024-02-06"
      );
      expect(notAvailable).toBe(false);
    });
  });

  describe("Bulk Availability Check", () => {
    it("should efficiently check multiple rooms in single query", async () => {
      const roomIds = ["room-1", "room-2", "room-3", "room-4", "room-5"];
      const dateRange = { start: "2024-02-01", end: "2024-02-05" };

      const query = `
        WITH room_availability AS (
          SELECT 
            r.id,
            r.name,
            r.base_price,
            ARRAY_AGG(
              jsonb_build_object(
                'check_in', b.check_in,
                'check_out', b.check_out,
                'guest_name', b.guest_name
              ) ORDER BY b.check_in
            ) FILTER (
              WHERE b.status != 'cancelled'
                AND daterange(b.check_in, b.check_out, '[)') && 
                    daterange($2::date, $3::date, '[)')
            ) as conflicts
          FROM ${projectSchema}.rooms r
          LEFT JOIN ${projectSchema}.bookings b ON r.id = b.room_id
          WHERE r.id = ANY($1::uuid[])
          GROUP BY r.id, r.name, r.base_price
        )
        SELECT 
          id,
          name,
          base_price,
          conflicts IS NULL as is_available,
          COALESCE(array_length(conflicts, 1), 0) as conflict_count,
          conflicts
        FROM room_availability
        ORDER BY is_available DESC, base_price ASC
      `;

      const startTime = performance.now();
      const result = await pool.query(query, [
        roomIds,
        dateRange.start,
        dateRange.end,
      ]);
      const queryTime = performance.now() - startTime;

      expect(queryTime).toBeLessThan(50); // Should be fast with indexes
      expect(result.rows).toHaveLength(5);
      result.rows.forEach((row) => {
        expect(row).toHaveProperty("is_available");
        expect(row).toHaveProperty("conflict_count");
      });
    });

    it("should use materialized CTE for complex availability matrix", async () => {
      const query = `
        WITH MATERIALIZED date_series AS (
          SELECT generate_series(
            $1::date,
            $2::date,
            '1 day'::interval
          )::date as check_date
        ),
        room_daily_availability AS (
          SELECT 
            r.id as room_id,
            ds.check_date,
            NOT EXISTS (
              SELECT 1 
              FROM ${projectSchema}.bookings b
              WHERE b.room_id = r.id
                AND b.status != 'cancelled'
                AND ds.check_date >= b.check_in
                AND ds.check_date < b.check_out
            ) as is_available
          FROM ${projectSchema}.rooms r
          CROSS JOIN date_series ds
          WHERE r.status = 'active'
        )
        SELECT 
          room_id,
          array_agg(
            jsonb_build_object(
              'date', check_date,
              'available', is_available
            ) ORDER BY check_date
          ) as availability_calendar
        FROM room_daily_availability
        GROUP BY room_id
      `;

      const result = await pool.query(query, ["2024-02-01", "2024-02-29"]);

      expect(result.rows.length).toBeGreaterThan(0);
      result.rows.forEach((row) => {
        expect(row.availability_calendar).toHaveLength(29); // Feb 2024 has 29 days
        expect(row.availability_calendar[0]).toHaveProperty("date");
        expect(row.availability_calendar[0]).toHaveProperty("available");
      });
    });
  });

  describe("Conflict Detection", () => {
    it("should detect all types of booking conflicts", async () => {
      const testCases = [
        {
          name: "Exact overlap",
          existing: { checkIn: "2024-02-10", checkOut: "2024-02-15" },
          new: { checkIn: "2024-02-10", checkOut: "2024-02-15" },
          shouldConflict: true,
        },
        {
          name: "New booking starts during existing",
          existing: { checkIn: "2024-02-10", checkOut: "2024-02-15" },
          new: { checkIn: "2024-02-12", checkOut: "2024-02-17" },
          shouldConflict: true,
        },
        {
          name: "New booking ends during existing",
          existing: { checkIn: "2024-02-10", checkOut: "2024-02-15" },
          new: { checkIn: "2024-02-08", checkOut: "2024-02-12" },
          shouldConflict: true,
        },
        {
          name: "New booking contains existing",
          existing: { checkIn: "2024-02-10", checkOut: "2024-02-15" },
          new: { checkIn: "2024-02-08", checkOut: "2024-02-17" },
          shouldConflict: true,
        },
        {
          name: "Adjacent bookings (no conflict)",
          existing: { checkIn: "2024-02-10", checkOut: "2024-02-15" },
          new: { checkIn: "2024-02-15", checkOut: "2024-02-20" },
          shouldConflict: false,
        },
      ];

      for (const testCase of testCases) {
        const conflicts = await availabilityService.detectConflicts(
          "room-1",
          testCase.new.checkIn,
          testCase.new.checkOut,
          [testCase.existing]
        );

        expect(conflicts.length > 0).toBe(testCase.shouldConflict);
      }
    });

    it("should handle concurrent booking attempts with advisory locks", async () => {
      const roomId = "room-1";
      const dateRange = { checkIn: "2024-03-01", checkOut: "2024-03-05" };

      // Simulate concurrent booking attempts
      const booking1 = pool.query(
        `
        BEGIN;
        SELECT pg_advisory_xact_lock($1::bigint);
        
        INSERT INTO ${projectSchema}.bookings (room_id, check_in, check_out, status)
        SELECT $2, $3, $4, 'confirmed'
        WHERE NOT EXISTS (
          SELECT 1 FROM ${projectSchema}.bookings
          WHERE room_id = $2
            AND status != 'cancelled'
            AND daterange(check_in, check_out, '[)') && 
                daterange($3::date, $4::date, '[)')
        );
        
        COMMIT;
      `,
        [
          hashCode(roomId), // Convert UUID to bigint for advisory lock
          roomId,
          dateRange.checkIn,
          dateRange.checkOut,
        ]
      );

      const booking2 = pool.query(
        `
        BEGIN;
        SELECT pg_advisory_xact_lock($1::bigint);
        
        INSERT INTO ${projectSchema}.bookings (room_id, check_in, check_out, status)
        SELECT $2, $3, $4, 'confirmed'
        WHERE NOT EXISTS (
          SELECT 1 FROM ${projectSchema}.bookings
          WHERE room_id = $2
            AND status != 'cancelled'
            AND daterange(check_in, check_out, '[)') && 
                daterange($3::date, $4::date, '[)')
        );
        
        COMMIT;
      `,
        [hashCode(roomId), roomId, dateRange.checkIn, dateRange.checkOut]
      );

      const results = await Promise.all([booking1, booking2]);

      // Only one booking should succeed
      const successCount = results.filter((r) => r.rowCount > 0).length;
      expect(successCount).toBe(1);
    });
  });

  describe("Availability Rules", () => {
    it("should apply minimum stay rules", async () => {
      await pool.query(
        `
        INSERT INTO ${projectSchema}.availability_rules 
        (room_type_id, rule_type, rule_value, start_date, end_date)
        VALUES ($1, 'minimum_stay', 3, $2, $3)
      `,
        ["type-deluxe", "2024-02-01", "2024-02-29"]
      );

      const isValid = await availabilityService.validateBookingRules(
        "room-1", // Deluxe room
        "2024-02-10",
        "2024-02-11" // Only 1 night
      );

      expect(isValid.valid).toBe(false);
      expect(isValid.errors).toContain("Minimum stay is 3 nights");
    });

    it("should apply maximum stay rules", async () => {
      await pool.query(
        `
        INSERT INTO ${projectSchema}.availability_rules 
        (room_type_id, rule_type, rule_value, start_date, end_date)
        VALUES ($1, 'maximum_stay', 7, $2, $3)
      `,
        ["type-standard", "2024-02-01", "2024-02-29"]
      );

      const isValid = await availabilityService.validateBookingRules(
        "room-2", // Standard room
        "2024-02-10",
        "2024-02-20" // 10 nights
      );

      expect(isValid.valid).toBe(false);
      expect(isValid.errors).toContain("Maximum stay is 7 nights");
    });

    it("should apply advance booking restrictions", async () => {
      await pool.query(
        `
        INSERT INTO ${projectSchema}.availability_rules 
        (room_type_id, rule_type, rule_value)
        VALUES ($1, 'advance_booking_days', 90)
      `,
        ["type-deluxe"]
      );

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 100); // 100 days from now

      const isValid = await availabilityService.validateBookingRules(
        "room-1",
        futureDate.toISOString().split("T")[0],
        new Date(futureDate.getTime() + 86400000).toISOString().split("T")[0]
      );

      expect(isValid.valid).toBe(false);
      expect(isValid.errors).toContain(
        "Cannot book more than 90 days in advance"
      );
    });

    it("should apply blackout dates", async () => {
      await pool.query(
        `
        INSERT INTO ${projectSchema}.availability_rules 
        (rule_type, rule_value, start_date, end_date)
        VALUES ('blackout', true, $1, $2)
      `,
        ["2024-12-24", "2024-12-26"]
      ); // Christmas blackout

      const isAvailable = await availabilityService.checkAvailability(
        "room-1",
        "2024-12-23",
        "2024-12-27"
      );

      expect(isAvailable).toBe(false);
    });
  });
});
```

### Business Logic Tests

```typescript
// tests/services/booking-logic.test.ts
import { BookingService } from "@/services/booking.service";
import { PricingService } from "@/services/pricing.service";
import { ValidationService } from "@/services/validation.service";

describe("Booking Business Logic", () => {
  let bookingService: BookingService;
  let pricingService: PricingService;
  let validationService: ValidationService;

  beforeEach(() => {
    bookingService = new BookingService();
    pricingService = new PricingService();
    validationService = new ValidationService();
  });

  describe("Price Calculation", () => {
    it("should calculate base price for date range", () => {
      const price = pricingService.calculateBasePrice({
        baseRate: 5000,
        checkIn: new Date("2024-02-01"),
        checkOut: new Date("2024-02-05"),
      });

      expect(price).toBe(20000); // 5000 * 4 nights
    });

    it("should apply seasonal pricing adjustments", () => {
      const price = pricingService.calculatePrice({
        baseRate: 5000,
        checkIn: new Date("2024-12-24"), // Peak season
        checkOut: new Date("2024-12-26"),
        seasonalRates: {
          peak: { multiplier: 1.5, dates: ["2024-12-24", "2024-12-25"] },
        },
      });

      expect(price).toBe(15000); // 5000 * 2 nights * 1.5
    });

    it("should apply weekend surcharges", () => {
      const price = pricingService.calculatePrice({
        baseRate: 5000,
        checkIn: new Date("2024-02-02"), // Friday
        checkOut: new Date("2024-02-04"), // Sunday
        weekendSurcharge: 1000,
      });

      // Friday and Saturday nights have surcharge
      expect(price).toBe(12000); // (5000 + 1000) * 2 nights
    });

    it("should apply long-stay discounts", () => {
      const price = pricingService.calculatePrice({
        baseRate: 5000,
        checkIn: new Date("2024-02-01"),
        checkOut: new Date("2024-02-08"), // 7 nights
        discounts: {
          longStay: { nights: 7, percentage: 10 },
        },
      });

      expect(price).toBe(31500); // 5000 * 7 * 0.9
    });

    it("should calculate Philippine VAT correctly", () => {
      const breakdown = pricingService.calculatePriceBreakdown({
        baseAmount: 10000,
        includesVAT: false,
        vatRate: 0.12,
      });

      expect(breakdown.vatAmount).toBe(1200);
      expect(breakdown.totalAmount).toBe(11200);
      expect(breakdown.netAmount).toBe(10000);
    });

    it("should apply senior/PWD discounts per Philippine law", () => {
      const breakdown = pricingService.applySeniorPWDDiscount({
        totalAmount: 11200, // Including VAT
        discountType: "senior",
        idNumber: "SC123456",
      });

      // 20% discount on VAT-exclusive amount
      expect(breakdown.discountAmount).toBe(2000); // 10000 * 0.20
      expect(breakdown.vatExemptAmount).toBe(1200); // VAT exemption
      expect(breakdown.finalAmount).toBe(8000); // 10000 - 2000
    });
  });

  describe("Booking Validation", () => {
    it("should validate guest information completeness", () => {
      const validation = validationService.validateGuestInfo({
        firstName: "Juan",
        lastName: "Dela Cruz",
        email: "juan@example.com",
        phone: "+639171234567",
        address: "123 Rizal St, Manila",
      });

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should validate Philippine phone numbers", () => {
      const validNumbers = ["+639171234567", "09171234567", "639171234567"];

      validNumbers.forEach((number) => {
        const validation = validationService.validatePhoneNumber(number);
        expect(validation).toBe(true);
      });

      const invalidNumbers = ["1234567", "+11234567890", "notanumber"];

      invalidNumbers.forEach((number) => {
        const validation = validationService.validatePhoneNumber(number);
        expect(validation).toBe(false);
      });
    });

    it("should validate booking dates", () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const dayAfter = new Date(today);
      dayAfter.setDate(dayAfter.getDate() + 2);

      // Past check-in date
      expect(() =>
        validationService.validateBookingDates({
          checkIn: yesterday,
          checkOut: tomorrow,
        })
      ).toThrow("Check-in date cannot be in the past");

      // Check-out before check-in
      expect(() =>
        validationService.validateBookingDates({
          checkIn: dayAfter,
          checkOut: tomorrow,
        })
      ).toThrow("Check-out must be after check-in");

      // Valid dates
      expect(() =>
        validationService.validateBookingDates({
          checkIn: tomorrow,
          checkOut: dayAfter,
        })
      ).not.toThrow();
    });

    it("should validate payment method", () => {
      const validMethods = ["cash", "gcash", "bank_transfer", "credit_card"];

      validMethods.forEach((method) => {
        const validation = validationService.validatePaymentMethod(method);
        expect(validation).toBe(true);
      });

      expect(validationService.validatePaymentMethod("bitcoin")).toBe(false);
    });

    it("should validate special requests", () => {
      const validRequests = [
        "Early check-in please",
        "Extra pillows",
        "Vegetarian meals",
      ];

      validRequests.forEach((request) => {
        const validation = validationService.validateSpecialRequest(request);
        expect(validation.isValid).toBe(true);
      });

      // Too long request
      const longRequest = "x".repeat(1001);
      const validation = validationService.validateSpecialRequest(longRequest);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe(
        "Special request too long (max 1000 characters)"
      );
    });
  });

  describe("Cancellation Policy", () => {
    it("should calculate refund based on cancellation timing", () => {
      const booking = {
        totalAmount: 10000,
        checkIn: new Date("2024-03-01"),
        createdAt: new Date("2024-02-01"),
      };

      // Free cancellation (>7 days before)
      const fullRefund = bookingService.calculateRefund(
        booking,
        new Date("2024-02-20")
      );
      expect(fullRefund.amount).toBe(10000);
      expect(fullRefund.percentage).toBe(100);

      // 50% refund (3-7 days before)
      const halfRefund = bookingService.calculateRefund(
        booking,
        new Date("2024-02-26")
      );
      expect(halfRefund.amount).toBe(5000);
      expect(halfRefund.percentage).toBe(50);

      // No refund (<3 days before)
      const noRefund = bookingService.calculateRefund(
        booking,
        new Date("2024-02-28")
      );
      expect(noRefund.amount).toBe(0);
      expect(noRefund.percentage).toBe(0);
    });

    it("should handle non-refundable bookings", () => {
      const booking = {
        totalAmount: 10000,
        checkIn: new Date("2024-03-01"),
        isNonRefundable: true,
      };

      const refund = bookingService.calculateRefund(
        booking,
        new Date("2024-02-20")
      );

      expect(refund.amount).toBe(0);
      expect(refund.reason).toBe("Non-refundable booking");
    });
  });

  describe("Booking Status Transitions", () => {
    it("should follow valid status transitions", () => {
      const validTransitions = [
        { from: "pending", to: "confirmed", valid: true },
        { from: "pending", to: "cancelled", valid: true },
        { from: "confirmed", to: "checked_in", valid: true },
        { from: "confirmed", to: "cancelled", valid: true },
        { from: "checked_in", to: "checked_out", valid: true },
        { from: "cancelled", to: "confirmed", valid: false },
        { from: "checked_out", to: "cancelled", valid: false },
      ];

      validTransitions.forEach((transition) => {
        const result = bookingService.canTransitionStatus(
          transition.from,
          transition.to
        );
        expect(result).toBe(transition.valid);
      });
    });

    it("should record status history with metadata", async () => {
      const bookingId = "booking-123";

      await bookingService.updateStatus(bookingId, "confirmed", {
        userId: "user-456",
        reason: "Payment received",
        paymentReference: "GCash-789",
      });

      const history = await bookingService.getStatusHistory(bookingId);

      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        bookingId,
        status: "confirmed",
        userId: "user-456",
        metadata: {
          reason: "Payment received",
          paymentReference: "GCash-789",
        },
      });
    });
  });
});
```

### Performance and Load Tests

```typescript
// tests/performance/availability-performance.test.ts
import { performance } from "perf_hooks";
import { Pool } from "pg";
import { generateLargeDataset } from "@/tests/helpers/data-generators";

describe("Availability Performance Tests", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({
      max: 20, // Higher connection limit for load testing
      connectionTimeoutMillis: 5000,
    });

    // Generate large dataset for testing
    await generateLargeDataset(pool, {
      rooms: 100,
      bookings: 10000,
      dateRange: { start: "2024-01-01", end: "2024-12-31" },
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("Query Performance Benchmarks", () => {
    it("should check single room availability under 10ms", async () => {
      const measurements = [];

      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();

        await pool.query(
          `
          SELECT EXISTS (
            SELECT 1 FROM bookings
            WHERE room_id = $1
              AND status != 'cancelled'
              AND daterange(check_in, check_out, '[)') && 
                  daterange($2::date, $3::date, '[)')
          )
        `,
          ["room-1", "2024-06-01", "2024-06-05"]
        );

        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }

      const avgTime =
        measurements.reduce((a, b) => a + b) / measurements.length;
      const maxTime = Math.max(...measurements);

      expect(avgTime).toBeLessThan(10);
      expect(maxTime).toBeLessThan(20);
    });

    it("should generate monthly availability matrix under 100ms", async () => {
      const startTime = performance.now();

      await pool.query(`
        WITH RECURSIVE dates AS (
          SELECT '2024-06-01'::date as date
          UNION ALL
          SELECT date + 1
          FROM dates
          WHERE date < '2024-06-30'::date
        ),
        room_availability AS (
          SELECT 
            r.id,
            d.date,
            NOT EXISTS (
              SELECT 1 FROM bookings b
              WHERE b.room_id = r.id
                AND b.status != 'cancelled'
                AND d.date >= b.check_in
                AND d.date < b.check_out
            ) as available
          FROM rooms r
          CROSS JOIN dates d
          WHERE r.status = 'active'
        )
        SELECT 
          id,
          json_object_agg(date, available ORDER BY date) as availability
        FROM room_availability
        GROUP BY id
      `);

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(100);
    });

    it("should handle concurrent availability checks", async () => {
      const concurrentChecks = 50;
      const promises = [];

      const startTime = performance.now();

      for (let i = 0; i < concurrentChecks; i++) {
        const checkPromise = pool.query(
          `
          SELECT room_id, 
                 NOT EXISTS (
                   SELECT 1 FROM bookings
                   WHERE room_id = rooms.id
                     AND status != 'cancelled'
                     AND daterange(check_in, check_out, '[)') && 
                         daterange($1::date, $2::date, '[)')
                 ) as available
          FROM rooms
          WHERE status = 'active'
          LIMIT 10
        `,
          ["2024-07-01", "2024-07-05"]
        );

        promises.push(checkPromise);
      }

      await Promise.all(promises);

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerCheck = totalTime / concurrentChecks;

      expect(avgTimePerCheck).toBeLessThan(50);
      expect(totalTime).toBeLessThan(1000);
    });
  });

  describe("Connection Pool Management", () => {
    it("should handle connection exhaustion gracefully", async () => {
      const queries = [];

      // Attempt to use more connections than pool max
      for (let i = 0; i < 30; i++) {
        queries.push(
          pool
            .query("SELECT pg_sleep(0.1)") // Simulate slow query
            .catch((err) => ({ error: err.message }))
        );
      }

      const results = await Promise.all(queries);
      const errors = results.filter((r) => r.error);

      // Some queries should queue but not fail
      expect(errors.length).toBe(0);
    });

    it("should reuse connections efficiently", async () => {
      const stats1 = await pool.query(`
        SELECT count(*) as connection_count
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND application_name LIKE '%node%'
      `);

      // Execute many quick queries
      for (let i = 0; i < 100; i++) {
        await pool.query("SELECT 1");
      }

      const stats2 = await pool.query(`
        SELECT count(*) as connection_count
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND application_name LIKE '%node%'
      `);

      // Connection count should not grow significantly
      expect(stats2.rows[0].connection_count).toBeLessThanOrEqual(
        stats1.rows[0].connection_count + 5
      );
    });
  });

  describe("Index Effectiveness", () => {
    it("should use indexes for all critical queries", async () => {
      const criticalQueries = [
        {
          name: "Date range search",
          query: `
            SELECT * FROM bookings
            WHERE daterange(check_in, check_out, '[)') && 
                  daterange($1::date, $2::date, '[)')
          `,
          params: ["2024-06-01", "2024-06-05"],
          expectedIndex: "idx_bookings_date_range",
        },
        {
          name: "Room availability check",
          query: `
            SELECT * FROM bookings
            WHERE room_id = $1 
              AND status != 'cancelled'
              AND check_in <= $2 
              AND check_out > $2
          `,
          params: ["room-1", "2024-06-15"],
          expectedIndex: "idx_bookings_room_dates",
        },
        {
          name: "Project bookings list",
          query: `
            SELECT * FROM bookings
            WHERE project_id = $1 
              AND status = $2
            ORDER BY check_in DESC
          `,
          params: ["project-1", "confirmed"],
          expectedIndex: "idx_bookings_status_project",
        },
      ];

      for (const test of criticalQueries) {
        const explainResult = await pool.query(
          `EXPLAIN (FORMAT JSON) ${test.query}`,
          test.params
        );

        const plan = explainResult.rows[0]["QUERY PLAN"][0]["Plan"];
        const scanType = plan["Node Type"];

        expect(scanType).toContain("Index");

        // Verify specific index is used
        if (plan["Index Name"]) {
          expect(plan["Index Name"]).toBe(test.expectedIndex);
        }
      }
    });
  });
});
```

### Transaction and Concurrency Tests

```typescript
// tests/database/booking-transactions.test.ts
import { Pool } from "pg";
import { BookingTransactionManager } from "@/services/booking-transaction.service";

describe("Booking Transaction Management", () => {
  let pool: Pool;
  let txManager: BookingTransactionManager;

  beforeAll(async () => {
    pool = new Pool();
    txManager = new BookingTransactionManager(pool);
  });

  describe("Transaction Atomicity", () => {
    it("should rollback entire booking on partial failure", async () => {
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // Insert booking
        await client.query(
          `
          INSERT INTO bookings (id, room_id, check_in, check_out)
          VALUES ($1, $2, $3, $4)
        `,
          ["booking-1", "room-1", "2024-06-01", "2024-06-05"]
        );

        // Insert guest (will fail due to constraint)
        await client.query(
          `
          INSERT INTO booking_guests (booking_id, email)
          VALUES ($1, $2)
        `,
          ["booking-1", "not-an-email"]
        ); // Invalid email

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }

      // Verify booking was not created
      const result = await pool.query("SELECT * FROM bookings WHERE id = $1", [
        "booking-1",
      ]);

      expect(result.rows).toHaveLength(0);
    });

    it("should handle nested transactions with savepoints", async () => {
      const bookingData = {
        roomId: "room-1",
        checkIn: "2024-06-01",
        checkOut: "2024-06-05",
        guests: [
          { name: "John Doe", email: "john@example.com" },
          { name: "Jane Doe", email: "invalid-email" },
        ],
      };

      const result = await txManager.createBookingWithSavepoints(bookingData);

      // Main booking should succeed
      expect(result.bookingId).toBeDefined();

      // First guest should succeed
      expect(result.guestIds).toHaveLength(1);

      // Second guest should fail but not affect the rest
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("invalid email");
    });
  });

  describe("Deadlock Prevention", () => {
    it("should acquire locks in consistent order", async () => {
      const bookingPromises = [];

      // Simulate multiple concurrent bookings for overlapping rooms
      for (let i = 0; i < 10; i++) {
        const promise = txManager.createBookingWithLocking({
          roomIds: ["room-1", "room-2", "room-3"].sort(), // Always sort for consistent order
          checkIn: "2024-06-01",
          checkOut: "2024-06-05",
        });

        bookingPromises.push(promise);
      }

      const results = await Promise.all(bookingPromises);

      // No deadlocks should occur
      const errors = results.filter((r) => r.error === "deadlock detected");
      expect(errors).toHaveLength(0);
    });

    it("should use advisory locks for critical sections", async () => {
      const roomId = "room-1";
      const lockKey = hashCode(roomId);

      const booking1 = txManager.createBookingWithAdvisoryLock(lockKey, {
        roomId,
        checkIn: "2024-06-01",
        checkOut: "2024-06-05",
      });

      const booking2 = txManager.createBookingWithAdvisoryLock(lockKey, {
        roomId,
        checkIn: "2024-06-01",
        checkOut: "2024-06-05",
      });

      const results = await Promise.all([booking1, booking2]);

      // Only one should succeed due to conflict
      const successes = results.filter((r) => r.success);
      expect(successes).toHaveLength(1);
    });
  });

  describe("Optimistic Locking", () => {
    it("should detect concurrent modifications", async () => {
      // Create initial booking
      const booking = await pool.query(
        `
        INSERT INTO bookings (room_id, check_in, check_out, version)
        VALUES ($1, $2, $3, 1)
        RETURNING id, version
      `,
        ["room-1", "2024-06-01", "2024-06-05"]
      );

      const bookingId = booking.rows[0].id;
      const version = booking.rows[0].version;

      // Two concurrent updates
      const update1 = pool.query(
        `
        UPDATE bookings 
        SET guest_name = $1, version = version + 1
        WHERE id = $2 AND version = $3
        RETURNING version
      `,
        ["John Doe", bookingId, version]
      );

      const update2 = pool.query(
        `
        UPDATE bookings 
        SET guest_name = $1, version = version + 1
        WHERE id = $2 AND version = $3
        RETURNING version
      `,
        ["Jane Doe", bookingId, version]
      );

      const results = await Promise.all([update1, update2]);

      // One should succeed, one should fail
      const successCount = results.filter((r) => r.rowCount > 0).length;
      expect(successCount).toBe(1);
    });
  });

  describe("Isolation Levels", () => {
    it("should prevent phantom reads with SERIALIZABLE", async () => {
      const client1 = await pool.connect();
      const client2 = await pool.connect();

      try {
        // Start serializable transactions
        await client1.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        await client2.query("BEGIN ISOLATION LEVEL SERIALIZABLE");

        // Client 1 reads available rooms
        const read1 = await client1.query(`
          SELECT COUNT(*) FROM rooms 
          WHERE id NOT IN (
            SELECT room_id FROM bookings
            WHERE daterange(check_in, check_out) && 
                  daterange('2024-07-01', '2024-07-05')
          )
        `);

        // Client 2 creates a booking
        await client2.query(`
          INSERT INTO bookings (room_id, check_in, check_out)
          VALUES ('room-5', '2024-07-01', '2024-07-05')
        `);

        // Client 1 reads again (should see same result)
        const read2 = await client1.query(`
          SELECT COUNT(*) FROM rooms 
          WHERE id NOT IN (
            SELECT room_id FROM bookings
            WHERE daterange(check_in, check_out) && 
                  daterange('2024-07-01', '2024-07-05')
          )
        `);

        expect(read1.rows[0].count).toBe(read2.rows[0].count);

        await client1.query("COMMIT");
        await client2.query("COMMIT");
      } catch (error) {
        await client1.query("ROLLBACK");
        await client2.query("ROLLBACK");

        // Serialization failure is expected
        expect(error.code).toBe("40001"); // serialization_failure
      } finally {
        client1.release();
        client2.release();
      }
    });
  });
});
```

## Database Schema Definition

```sql
-- Complete schema for testing
CREATE SCHEMA IF NOT EXISTS project_test;

-- Rooms and room types
CREATE TABLE project_test.room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  base_price DECIMAL(12,2) NOT NULL,
  max_capacity INTEGER NOT NULL,
  amenities JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE project_test.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  type_id UUID REFERENCES project_test.room_types(id),
  floor INTEGER,
  base_price DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_room_number UNIQUE (room_number)
);

-- Main bookings table with optimized indexes
CREATE TABLE project_test.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  room_id UUID REFERENCES project_test.rooms(id),
  guest_name VARCHAR(200) NOT NULL,
  guest_email VARCHAR(255),
  guest_phone VARCHAR(50),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  adults INTEGER DEFAULT 1,
  children INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  total_amount DECIMAL(12,2) NOT NULL,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  balance_amount DECIMAL(12,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  payment_method VARCHAR(50),
  special_requests TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT check_dates CHECK (check_out > check_in),
  CONSTRAINT check_amounts CHECK (paid_amount >= 0 AND total_amount >= 0),
  CONSTRAINT check_capacity CHECK (adults > 0)
);

-- Critical indexes for performance
CREATE INDEX idx_bookings_date_range ON project_test.bookings
  USING GIST (daterange(check_in, check_out));

CREATE INDEX idx_bookings_room_dates ON project_test.bookings(room_id, check_in, check_out)
  WHERE status != 'cancelled';

CREATE INDEX idx_bookings_status_project ON project_test.bookings(project_id, status)
  WHERE status != 'cancelled';

CREATE INDEX idx_bookings_guest_email ON project_test.bookings(guest_email)
  WHERE guest_email IS NOT NULL;

-- Availability rules
CREATE TABLE project_test.availability_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id UUID REFERENCES project_test.room_types(id),
  rule_type VARCHAR(50) NOT NULL, -- minimum_stay, maximum_stay, advance_booking, blackout
  rule_value JSONB NOT NULL,
  start_date DATE,
  end_date DATE,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_availability_rules_dates ON project_test.availability_rules(start_date, end_date)
  WHERE start_date IS NOT NULL;

-- Booking status history for audit trail
CREATE TABLE project_test.booking_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES project_test.bookings(id),
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  reason TEXT,
  metadata JSONB,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE booking_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_isolation ON booking_status_history
  USING (project_id = current_setting('app.current_project')::uuid);

CREATE INDEX CONCURRENTLY idx_status_history_project_booking ON booking_status_history
  (project_id, booking_id, created_at DESC);
```

## Test Helpers and Utilities

```typescript
// tests/helpers/availability-helpers.ts
export const hashCode = (str: string): bigint => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return BigInt(Math.abs(hash));
};

export const generateBookingConflicts = (baseDate: Date, count: number) => {
  const conflicts = [];

  for (let i = 0; i < count; i++) {
    const checkIn = new Date(baseDate);
    checkIn.setDate(checkIn.getDate() + i * 2);

    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + Math.floor(Math.random() * 5) + 1);

    conflicts.push({
      roomId: `room-${(i % 5) + 1}`,
      checkIn,
      checkOut,
      status: "confirmed",
    });
  }

  return conflicts;
};

export const createAvailabilityMatrix = (
  startDate: Date,
  endDate: Date,
  rooms: string[],
  bookings: any[]
) => {
  const matrix = {};
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split("T")[0];
    matrix[dateKey] = {};

    rooms.forEach((roomId) => {
      matrix[dateKey][roomId] = !bookings.some(
        (booking) =>
          booking.roomId === roomId &&
          currentDate >= booking.checkIn &&
          currentDate < booking.checkOut &&
          booking.status !== "cancelled"
      );
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return matrix;
};
```

## Expected Test Results (RED Phase)

All tests should fail initially:

```bash
FAIL tests/database/availability-queries.test.ts
  ✕ should check availability using daterange operators (5ms)
  ✕ should use GiST index for range queries (3ms)
  ✕ should efficiently check multiple rooms in single query (12ms)

FAIL tests/services/booking-logic.test.ts
  ✕ should calculate base price for date range (2ms)
  ✕ should apply seasonal pricing adjustments (1ms)
  ✕ should validate Philippine phone numbers (3ms)

FAIL tests/performance/availability-performance.test.ts
  ✕ should check single room availability under 10ms (45ms)
  ✕ should handle concurrent availability checks (1203ms)

Test Suites: 3 failed, 3 total
Tests: 45 failed, 45 total
```

## Next Steps

1. Complete all RED phase tests
2. Document any additional business rules discovered
3. Prepare for Sub-phase 3.3: Implementation
4. Set up continuous integration for test execution
