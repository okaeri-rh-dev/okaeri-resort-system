# Phase 5: Integration Testing & Quality Assurance

**Timeline**: Week 6 (Nov 10-14, 2025)
**Lead Agent**: `code-quality-reviewer`
**Supporting Agents**: `security-compliance-auditor`, `pwa-performance-optimizer`
**Dependencies**: Phases 1-4 complete, feature flags implemented
**Deliverables**: Complete test suite, performance benchmarks, security audit report

---

## Phase Overview

Phase 5 focuses on comprehensive testing and quality assurance before production rollout. This phase validates:

- **Functional Correctness**: E2E scenarios for multi-unit booking workflows
- **Performance**: API response times, database query performance, UI responsiveness
- **Security**: Input validation, authorization, XSS/SQL injection prevention
- **Reliability**: Error handling, offline support, race conditions
- **Accessibility**: WCAG 2.1 AA compliance verification
- **Load Capacity**: Concurrent booking stress tests

---

## Success Criteria

| Metric                  | Target                     | Measurement                    |
| ----------------------- | -------------------------- | ------------------------------ |
| **Code Coverage**       | ≥90%                       | Jest + Vitest coverage reports |
| **E2E Test Pass Rate**  | 100%                       | Playwright test suite          |
| **API Response Time**   | <200ms (p95)               | Artillery load tests           |
| **Database Query Time** | <100ms (p95)               | PostgreSQL EXPLAIN ANALYZE     |
| **Security Scan**       | 0 critical issues          | OWASP ZAP, Snyk                |
| **Accessibility Score** | ≥95% WCAG AA (pragmatic)   | axe DevTools, Lighthouse       |
| **Load Test Capacity**  | 50 concurrent bookings/min | Artillery sustained load       |
| **Error Recovery**      | 100%                       | Chaos engineering tests        |

---

## Agent Assignments

### Lead Agent: `code-quality-reviewer`

**Responsibilities**:

- Review all test implementations for completeness
- Validate test coverage meets ≥90% threshold
- Ensure test quality (no flaky tests, proper assertions)
- Review mock data and test fixtures
- Validate integration test scenarios
- Code review for test maintainability

**Deliverables**:

- Test coverage report with detailed analysis
- Test quality review document
- Recommendations for test improvements

### Supporting Agent: `security-compliance-auditor`

**Responsibilities**:

- Conduct security penetration testing
- Validate input sanitization (DOMPurify)
- Test authorization/authentication flows
- SQL injection and XSS vulnerability scanning
- Review audit logging completeness
- Validate RLS policies

**Deliverables**:

- Security audit report
- Vulnerability assessment
- Compliance checklist (data protection)

### Supporting Agent: `pwa-performance-optimizer`

**Responsibilities**:

- Performance profiling and optimization
- Bundle size analysis
- Network performance testing
- Lighthouse score validation
- Core Web Vitals monitoring
- Offline functionality testing

**Deliverables**:

- Performance benchmark report
- Optimization recommendations
- Core Web Vitals scorecard

---

## 1. End-to-End Testing (Playwright)

### Test Environment Setup

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html"],
    ["junit", { outputFile: "test-results/junit.xml" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 5"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 12"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
});
```

### Critical E2E Test Scenarios

#### Scenario 1: Complete Multi-Unit Booking Flow

```typescript
// e2e/multi-unit-booking-flow.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Multi-Unit Booking Complete Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Login as authenticated user
    await page.goto("/login");
    await page.fill('[name="email"]', "test@resort.com");
    await page.fill('[name="password"]', "TestPassword123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/dashboard");
  });

  test("should successfully create multi-unit booking with payment", async ({ page }) => {
    // Navigate to bookings
    await page.goto("/bookings");
    await page.click('button:has-text("New Booking")');

    // Step 1: Guest Information
    await page.fill('[name="guest_name"]', "John Doe");
    await page.fill('[name="email"]', "john.doe@example.com");
    await page.fill('[name="contact_number"]', "+63 917 123 4567");
    await page.click('button:has-text("Next")');

    // Step 2: Date Selection
    await page.fill('[name="check_in"]', "2025-11-15");
    await page.fill('[name="check_out"]', "2025-11-17");
    await page.click('button:has-text("Next")');

    // Step 3: Unit Selection (Multiple Units)
    await expect(page.locator(".unit-grid")).toBeVisible();

    // Add first unit
    await page.click('[data-testid="unit-card-cabin-1"] button:has-text("Add Unit")');
    await expect(page.locator('[data-testid="selected-units-count"]')).toHaveText(
      "1 unit selected"
    );

    // Add second unit
    await page.click('[data-testid="unit-card-cabin-2"] button:has-text("Add Unit")');
    await expect(page.locator('[data-testid="selected-units-count"]')).toHaveText(
      "2 units selected"
    );

    // Verify pricing calculation
    const pricingSummary = page.locator('[data-testid="pricing-summary"]');
    await expect(pricingSummary.locator('[data-testid="unit-1-price"]')).toContainText("₱3,000.00");
    await expect(pricingSummary.locator('[data-testid="unit-2-price"]')).toContainText("₱3,000.00");
    await expect(pricingSummary.locator('[data-testid="total-price"]')).toContainText("₱6,000.00");

    await page.click('button:has-text("Next")');

    // Step 4: Guest Assignment (Optional)
    await page.fill('[data-testid="unit-1-guest-count"]', "2");
    await page.fill('[data-testid="unit-2-guest-count"]', "3");
    await page.click('button:has-text("Next")');

    // Step 5: Payment
    await page.selectOption('[name="payment_method"]', "GCash");
    await page.fill('[name="payment_amount"]', "6000");
    await page.fill('[name="reference_number"]', "GCASH123456789");

    // Submit booking
    await page.click('button:has-text("Confirm Booking")');

    // Verify success
    await expect(page.locator(".success-message")).toBeVisible();
    await expect(page.locator('[data-testid="booking-reference"]')).toContainText(/BK-\d{8}-\d{4}/);

    // Verify booking appears in table
    await page.goto("/bookings");
    await expect(page.locator("table tbody tr").first()).toContainText("John Doe");
    await expect(page.locator("table tbody tr").first()).toContainText("2 units");

    // Verify audit log entry
    const firstRow = page.locator("table tbody tr").first();
    await firstRow.click();
    await page.click('[data-testid="view-audit-trail"]');
    await expect(page.locator(".audit-log")).toContainText("booking.created");
    await expect(page.locator(".audit-log")).toContainText("multi_unit_booking");
  });

  test("should prevent double-booking for same unit", async ({ page }) => {
    await page.goto("/bookings/new");

    // Fill guest info
    await page.fill('[name="guest_name"]', "Jane Smith");
    await page.fill('[name="email"]', "jane@example.com");
    await page.fill('[name="contact_number"]', "+63 917 987 6543");
    await page.click('button:has-text("Next")');

    // Select dates that overlap with existing booking
    await page.fill('[name="check_in"]', "2025-11-15");
    await page.fill('[name="check_out"]', "2025-11-17");
    await page.click('button:has-text("Next")');

    // Try to add already-booked unit
    const bookedUnit = page.locator('[data-testid="unit-card-cabin-1"]');
    await expect(bookedUnit).toHaveClass(/unavailable/);
    await expect(bookedUnit.locator("button")).toBeDisabled();
    await expect(bookedUnit.locator(".availability-badge")).toHaveText("Unavailable");
  });

  test("should handle optimistic UI updates correctly", async ({ page }) => {
    await page.goto("/bookings/new");

    // Complete booking form
    // ... (fill form steps)

    // Mock slow network
    await page.route("**/api/bookings/multi-unit", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 2s delay
      await route.continue();
    });

    // Submit booking
    await page.click('button:has-text("Confirm Booking")');

    // Verify optimistic update (booking appears immediately)
    await expect(page.locator('[data-testid="booking-status"]')).toHaveText("Pending");
    await expect(page.locator(".optimistic-indicator")).toBeVisible();

    // Wait for server confirmation
    await expect(page.locator('[data-testid="booking-status"]')).toHaveText("Confirmed", {
      timeout: 5000,
    });
    await expect(page.locator(".optimistic-indicator")).not.toBeVisible();
  });

  test("should handle offline queue when network unavailable", async ({ page, context }) => {
    await page.goto("/bookings/new");

    // Complete booking form
    // ... (fill form steps)

    // Go offline
    await context.setOffline(true);

    // Submit booking
    await page.click('button:has-text("Confirm Booking")');

    // Verify queued for offline
    await expect(page.locator(".offline-queue-notice")).toBeVisible();
    await expect(page.locator(".offline-queue-notice")).toContainText("Will sync when online");

    // Go back online
    await context.setOffline(false);

    // Verify automatic sync
    await expect(page.locator(".sync-success-notice")).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="booking-status"]')).toHaveText("Confirmed");
  });
});
```

#### Scenario 2: Multi-Unit Availability Search

```typescript
// e2e/multi-unit-availability.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Multi-Unit Availability Search", () => {
  test("should show real-time availability for multiple units", async ({ page }) => {
    await page.goto("/availability");

    // Set search criteria
    await page.fill('[name="check_in"]', "2025-12-01");
    await page.fill('[name="check_out"]', "2025-12-03");
    await page.fill('[name="guest_count"]', "5");
    await page.click('button:has-text("Search")');

    // Verify results
    await expect(page.locator(".availability-results")).toBeVisible();

    // Verify unit cards show correct availability
    const availableUnits = page.locator('[data-available="true"]');
    expect(await availableUnits.count()).toBeGreaterThan(0);

    // Verify pricing is displayed
    await expect(availableUnits.first().locator('[data-testid="unit-price"]')).toContainText("₱");

    // Test filtering
    await page.selectOption('[name="unit_type_filter"]', "Cabin");
    await expect(page.locator(".availability-results")).toContainText("Cabin");

    // Test sorting
    await page.selectOption('[name="sort_by"]', "price_low_high");
    const prices = await page.locator('[data-testid="unit-price"]').allTextContents();
    const numericPrices = prices.map((p) => parseFloat(p.replace(/[₱,]/g, "")));
    expect(numericPrices).toEqual([...numericPrices].sort((a, b) => a - b));
  });

  test("should update availability in real-time when booking created", async ({
    page,
    context,
  }) => {
    // Open two tabs
    const page1 = page;
    const page2 = await context.newPage();

    // Both tabs search for same dates
    await page1.goto("/availability?check_in=2025-12-10&check_out=2025-12-12");
    await page2.goto("/availability?check_in=2025-12-10&check_out=2025-12-12");

    // Verify unit is available in both
    await expect(page1.locator('[data-testid="unit-cabin-3"]')).toHaveAttribute(
      "data-available",
      "true"
    );
    await expect(page2.locator('[data-testid="unit-cabin-3"]')).toHaveAttribute(
      "data-available",
      "true"
    );

    // Create booking in page1
    await page1.click('[data-testid="unit-cabin-3"] button:has-text("Book Now")');
    // ... complete booking flow

    // Verify page2 updates availability automatically (via Supabase realtime)
    await expect(page2.locator('[data-testid="unit-cabin-3"]')).toHaveAttribute(
      "data-available",
      "false",
      { timeout: 5000 }
    );
    await expect(page2.locator('[data-testid="unit-cabin-3"] .availability-badge')).toHaveText(
      "Just Booked"
    );
  });
});
```

#### Scenario 3: Backwards Compatibility with Single-Unit

```typescript
// e2e/backwards-compatibility.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Backwards Compatibility: Single-Unit Bookings", () => {
  test("should create legacy single-unit booking correctly", async ({ page }) => {
    await page.goto("/bookings/new");

    // Toggle to single-unit mode (if feature flag allows)
    const multiUnitToggle = page.locator('[data-testid="multi-unit-toggle"]');
    if (await multiUnitToggle.isVisible()) {
      await multiUnitToggle.uncheck();
    }

    // Fill guest info
    await page.fill('[name="guest_name"]', "Legacy User");
    await page.fill('[name="email"]', "legacy@example.com");
    await page.fill('[name="contact_number"]', "+63 917 111 2222");
    await page.click('button:has-text("Next")');

    // Select dates
    await page.fill('[name="check_in"]', "2025-12-20");
    await page.fill('[name="check_out"]', "2025-12-22");
    await page.click('button:has-text("Next")');

    // Select single unit (old-style dropdown)
    await page.selectOption('[name="unit_id"]', "cabin-5");
    await page.click('button:has-text("Next")');

    // Payment
    await page.selectOption('[name="payment_method"]', "Cash");
    await page.fill('[name="payment_amount"]', "2500");
    await page.click('button:has-text("Confirm Booking")');

    // Verify booking created with legacy schema
    await expect(page.locator(".success-message")).toBeVisible();

    // Verify database entry uses bookings.unit_id (not junction table)
    // This would be verified in backend integration tests
  });

  test("should display legacy single-unit bookings correctly", async ({ page }) => {
    await page.goto("/bookings");

    // Filter for legacy bookings
    await page.click('[data-testid="filter-legacy-bookings"]');

    // Verify legacy booking displays
    const legacyBooking = page.locator('[data-testid="booking-row-legacy"]').first();
    await expect(legacyBooking).toContainText("1 unit"); // Not "1 units"

    // Click to view details
    await legacyBooking.click();

    // Verify details page shows single unit correctly
    await expect(page.locator('[data-testid="booking-units-section"]')).toContainText(
      "Unit: Cabin 5"
    );
    await expect(page.locator('[data-testid="unit-count"]')).not.toBeVisible(); // Not shown for legacy
  });
});
```

---

## 2. Performance Testing (Artillery)

### Load Test Configuration

```yaml
# artillery/load-test.yml
config:
  target: "http://localhost:5173"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm-up"
    - duration: 120
      arrivalRate: 30
      name: "Sustained load"
    - duration: 60
      arrivalRate: 50
      name: "Peak load"
  environments:
    production:
      target: "https://resort.okaeri.dev"
  processor: "./artillery/processors.js"
  plugins:
    metrics-by-endpoint:
      stripQueryString: true
    ensure:
      thresholds:
        - http.response_time.p95: 200
        - http.response_time.p99: 500
        - http.request_rate: 50

scenarios:
  - name: "Multi-Unit Booking Flow"
    weight: 60
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "{{ $randomEmail() }}"
            password: "TestPassword123!"
          capture:
            - json: "$.access_token"
              as: "token"

      - get:
          url: "/api/availability/multi-unit"
          qs:
            check_in: "2025-12-01"
            check_out: "2025-12-03"
            min_units: 2
          headers:
            Authorization: "Bearer {{ token }}"
          capture:
            - json: "$.available_units[0].unit_id"
              as: "unit1"
            - json: "$.available_units[1].unit_id"
              as: "unit2"

      - post:
          url: "/api/bookings/multi-unit"
          headers:
            Authorization: "Bearer {{ token }}"
          json:
            primary_guest:
              guest_name: "{{ $randomFullName() }}"
              email: "{{ $randomEmail() }}"
              contact_number: "+639171234567"
            check_in: "2025-12-01"
            check_out: "2025-12-03"
            units:
              - unit_id: "{{ unit1 }}"
                num_guests: 2
              - unit_id: "{{ unit2 }}"
                num_guests: 3
            payment:
              method: "GCash"
              amount: 6000
          afterResponse: "validateBookingCreation"

  - name: "Availability Search"
    weight: 30
    flow:
      - get:
          url: "/api/availability/search"
          qs:
            check_in: "{{ $randomDate() }}"
            check_out: "{{ $randomDate(7) }}"
            guest_count: "{{ $randomInt(1, 8) }}"

  - name: "Read Operations (Dashboard)"
    weight: 10
    flow:
      - get:
          url: "/api/bookings"
          qs:
            limit: 50
            offset: 0
      - get:
          url: "/api/dashboard/metrics"
```

### Performance Test Processor

```javascript
// artillery/processors.js
module.exports = {
  validateBookingCreation: (requestParams, response, context, ee, next) => {
    if (response.statusCode !== 201) {
      ee.emit("error", `Booking creation failed: ${response.statusCode}`);
    }

    const body = JSON.parse(response.body);
    if (!body.booking_id || !body.booking_reference) {
      ee.emit("error", "Missing booking ID or reference");
    }

    if (body.units.length !== 2) {
      ee.emit("error", `Expected 2 units, got ${body.units.length}`);
    }

    return next();
  },

  $randomEmail: () => {
    return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
  },

  $randomFullName: () => {
    const firstNames = ["John", "Jane", "Alex", "Maria", "Carlos"];
    const lastNames = ["Doe", "Smith", "Garcia", "Lee", "Santos"];
    return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
  },

  $randomDate: (daysFromNow = 30) => {
    const date = new Date();
    date.setDate(date.getDate() + Math.floor(Math.random() * daysFromNow));
    return date.toISOString().split("T")[0];
  },

  $randomInt: (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
};
```

### Performance Test Execution Script

```bash
#!/bin/bash
# scripts/run-performance-tests.sh

echo "🚀 Starting Performance Test Suite"

# Start local server
echo "📦 Building production bundle..."
npm run build

echo "🌐 Starting preview server..."
npm run preview &
SERVER_PID=$!
sleep 5

# Run Artillery tests
echo "⚡ Running load tests..."
npx artillery run artillery/load-test.yml --output artillery-report.json

# Generate HTML report
echo "📊 Generating report..."
npx artillery report artillery-report.json --output artillery-report.html

# Analyze database performance
echo "🗄️ Running database performance analysis..."
psql $DATABASE_URL -f tests/performance/analyze-queries.sql > db-performance.log

# Stop server
kill $SERVER_PID

echo "✅ Performance tests complete!"
echo "📄 Reports available:"
echo "  - artillery-report.html"
echo "  - db-performance.log"

# Check thresholds
if grep -q "Thresholds: NOT OK" artillery-report.json; then
  echo "❌ Performance thresholds not met!"
  exit 1
else
  echo "✅ All performance thresholds passed!"
fi
```

---

## 3. Database Performance Testing

### Query Analysis Script

```sql
-- tests/performance/analyze-queries.sql

-- Enable timing
\timing on

-- Test 1: Multi-unit availability check (should be <100ms)
EXPLAIN ANALYZE
SELECT * FROM check_multi_unit_availability(
  ARRAY['unit-id-1', 'unit-id-2', 'unit-id-3']::UUID[],
  '2025-12-01'::TIMESTAMPTZ,
  '2025-12-03'::TIMESTAMPTZ
);

-- Test 2: Create multi-unit booking (should be <150ms)
EXPLAIN ANALYZE
SELECT * FROM create_multi_unit_booking(
  'guest-id'::UUID,
  '2025-12-01'::TIMESTAMPTZ,
  '2025-12-03'::TIMESTAMPTZ,
  jsonb_build_array(
    jsonb_build_object('unit_id', 'unit-1'::UUID, 'num_guests', 2, 'unit_price', 3000),
    jsonb_build_object('unit_id', 'unit-2'::UUID, 'num_guests', 3, 'unit_price', 3000)
  ),
  6000,
  'GCash',
  'GCASH123'
);

-- Test 3: Get booking with units (should be <50ms)
EXPLAIN ANALYZE
SELECT b.*,
       json_agg(
         json_build_object(
           'unit_id', bu.unit_id,
           'unit_name', u.unit_name,
           'unit_price', bu.unit_price,
           'num_guests', bu.assigned_guests
         )
       ) as units
FROM bookings b
LEFT JOIN booking_units bu ON b.booking_id = bu.booking_id
LEFT JOIN units u ON bu.unit_id = u.unit_id
WHERE b.booking_id = 'test-booking-id'::UUID
GROUP BY b.booking_id;

-- Test 4: Exclusion constraint performance (concurrent bookings)
EXPLAIN ANALYZE
WITH conflict_test AS (
  INSERT INTO booking_unit_availability (unit_id, booking_id, check_in, check_out, booking_status)
  VALUES
    ('unit-1'::UUID, gen_random_uuid(), '2025-12-01', '2025-12-03', 'Confirmed')
  ON CONFLICT DO NOTHING
  RETURNING *
)
SELECT * FROM conflict_test;

-- Test 5: Index usage verification
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('bookings', 'booking_units', 'booking_unit_availability')
ORDER BY idx_scan DESC;

-- Test 6: Table bloat check
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('bookings', 'booking_units', 'booking_unit_availability')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Database Performance Benchmarks

```typescript
// tests/performance/db-benchmarks.test.ts
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { performance } from "perf_hooks";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe("Database Performance Benchmarks", () => {
  const ITERATIONS = 100;

  test("availability check should complete <100ms (p95)", async () => {
    const timings: number[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();

      await supabase.rpc("check_multi_unit_availability", {
        p_unit_ids: ["unit-1", "unit-2", "unit-3"],
        p_check_in: "2025-12-01",
        p_check_out: "2025-12-03",
      });

      const duration = performance.now() - start;
      timings.push(duration);
    }

    timings.sort((a, b) => a - b);
    const p95 = timings[Math.floor(ITERATIONS * 0.95)];
    const p99 = timings[Math.floor(ITERATIONS * 0.99)];
    const avg = timings.reduce((sum, t) => sum + t, 0) / ITERATIONS;

    console.log(
      `Availability Check - Avg: ${avg.toFixed(2)}ms, P95: ${p95.toFixed(2)}ms, P99: ${p99.toFixed(2)}ms`
    );

    expect(p95).toBeLessThan(100);
  });

  test("create booking should complete <150ms (p95)", async () => {
    const timings: number[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();

      await supabase.rpc("create_multi_unit_booking", {
        p_guest_id: "test-guest-id",
        p_check_in: "2025-12-01",
        p_check_out: "2025-12-03",
        p_units: [
          { unit_id: "unit-1", num_guests: 2, unit_price: 3000 },
          { unit_id: "unit-2", num_guests: 3, unit_price: 3000 },
        ],
        p_total_amount: 6000,
        p_payment_method: "GCash",
        p_payment_reference: `GCASH${i}`,
      });

      const duration = performance.now() - start;
      timings.push(duration);

      // Cleanup (delete created booking)
      // await supabase.from('bookings').delete().eq('payment_reference', `GCASH${i}`);
    }

    timings.sort((a, b) => a - b);
    const p95 = timings[Math.floor(ITERATIONS * 0.95)];

    console.log(`Create Booking - P95: ${p95.toFixed(2)}ms`);

    expect(p95).toBeLessThan(150);
  });

  test("concurrent bookings should handle race conditions", async () => {
    const unitId = "test-unit-concurrent";
    const promises: Promise<any>[] = [];

    // Attempt 10 concurrent bookings for same unit/dates
    for (let i = 0; i < 10; i++) {
      promises.push(
        supabase.rpc("create_multi_unit_booking", {
          p_guest_id: `guest-${i}`,
          p_check_in: "2025-12-15",
          p_check_out: "2025-12-17",
          p_units: [{ unit_id: unitId, num_guests: 2, unit_price: 3000 }],
          p_total_amount: 3000,
          p_payment_method: "Cash",
          p_payment_reference: `CONCURRENT${i}`,
        })
      );
    }

    const results = await Promise.allSettled(promises);
    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`Concurrent bookings - Success: ${successful}, Failed: ${failed}`);

    // Only 1 should succeed due to exclusion constraint
    expect(successful).toBe(1);
    expect(failed).toBe(9);
  });
});
```

---

## 4. Security Testing

### Security Test Suite

```typescript
// tests/security/xss-prevention.test.ts
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DOMPurify from 'dompurify';
import { BookingCard } from '@/components/bookings/BookingCard';

describe('XSS Prevention', () => {
  test('should sanitize guest notes in booking display', () => {
    const maliciousInput = {
      booking_id: '123',
      guest_name: 'John Doe',
      notes: '<script>alert("XSS")</script><b>Important note</b>',
      check_in: '2025-12-01',
      check_out: '2025-12-03'
    };

    render(<BookingCard booking={maliciousInput} />);

    // Script tag should be removed
    expect(screen.queryByText(/script/i)).not.toBeInTheDocument();

    // Safe HTML should remain
    const notesElement = screen.getByTestId('booking-notes');
    expect(notesElement.innerHTML).toContain('<b>Important note</b>');
    expect(notesElement.innerHTML).not.toContain('<script>');
  });

  test('should sanitize unit descriptions', () => {
    const maliciousDescription = '<img src=x onerror="alert(\'XSS\')">';
    const sanitized = DOMPurify.sanitize(maliciousDescription);

    expect(sanitized).not.toContain('onerror');
    expect(sanitized).not.toContain('alert');
  });

  test('should prevent SQL injection in search queries', async () => {
    const maliciousSearch = "'; DROP TABLE bookings; --";

    // This should be parameterized and safe
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .ilike('guest_name', `%${maliciousSearch}%`);

    // Should not error or execute injection
    expect(error).toBeNull();
    // Table should still exist
    const { data: tableCheck } = await supabase.from('bookings').select('count');
    expect(tableCheck).toBeDefined();
  });
});
```

### OWASP ZAP Automation

```yaml
# tests/security/zap-scan.yaml
env:
  contexts:
    - name: "Resort Booking System"
      urls:
        - "http://localhost:5173"
      includePaths:
        - "http://localhost:5173/.*"
      excludePaths:
        - "http://localhost:5173/static/.*"
      authentication:
        method: "json"
        loginUrl: "http://localhost:5173/api/auth/login"
        loginRequestData: '{"email":"test@resort.com","password":"TestPassword123!"}'
      sessionManagement:
        method: "cookie"

  parameters:
    failOnError: true
    failOnWarning: false
    progressToStdout: true

jobs:
  - type: spider
    parameters:
      maxDuration: 5
      maxDepth: 10

  - type: passiveScan-wait
    parameters:
      maxDuration: 5

  - type: activeScan
    parameters:
      policy: "API-scan"
      maxRuleDurationInMins: 5
      maxScanDurationInMins: 10

  - type: report
    parameters:
      template: "traditional-html"
      reportDir: "test-results/security"
      reportFile: "zap-report"
      reportTitle: "Multi-Unit Booking Security Scan"

rules:
  - id: 10021
    name: "X-Content-Type-Options Header Missing"
    threshold: "off"
  - id: 10096
    name: "Timestamp Disclosure"
    threshold: "off"
```

### Security Audit Checklist

```typescript
// tests/security/audit-checklist.test.ts
import { describe, test, expect } from "vitest";
import { supabase } from "@/lib/supabase";

describe("Security Audit Checklist", () => {
  test("RLS policies are enabled on all tables", async () => {
    const { data: tables } = await supabase.rpc("get_tables_without_rls");

    const criticalTables = ["bookings", "booking_units", "guests", "payments"];
    const missingRLS = tables?.filter((t) => criticalTables.includes(t.tablename));

    expect(missingRLS).toHaveLength(0);
  });

  test("audit logging is active for all mutations", async () => {
    // Create test booking
    const { data: booking, error } = await supabase.rpc("create_multi_unit_booking", {
      // ... booking data
    });

    expect(error).toBeNull();

    // Verify audit log entry
    const { data: auditLogs } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("entity_type", "booking")
      .eq("entity_id", booking.booking_id)
      .eq("action", "booking.created");

    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({
      action: "booking.created",
      entity_type: "booking",
      entity_id: booking.booking_id,
      user_id: expect.any(String),
      metadata: expect.objectContaining({
        ip_address: expect.any(String),
        user_agent: expect.any(String),
      }),
    });
  });

  test("sensitive data is not exposed in API responses", async () => {
    const { data } = await supabase.from("guests").select("*").limit(1).single();

    // Should not include internal fields
    expect(data).not.toHaveProperty("password_hash");
    expect(data).not.toHaveProperty("ssn");
    expect(data).not.toHaveProperty("credit_card_number");
  });

  test("rate limiting is enforced on public endpoints", async () => {
    const requests: Promise<any>[] = [];

    // Attempt 100 requests in rapid succession
    for (let i = 0; i < 100; i++) {
      requests.push(
        fetch("http://localhost:5173/api/guest-booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            /* booking data */
          }),
        })
      );
    }

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter((r) => r.status === 429);

    // Should have some rate-limited responses
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

---

## 5. Accessibility Testing

**Pragmatic Approach**: We target **≥95% Lighthouse accessibility score** with **zero critical violations**. This balances excellent accessibility with practical development constraints. All critical and blocking issues must be resolved, while up to 2 serious violations are acceptable if documented.

**Core Requirements**:

- ✅ 0 critical violations (blocking)
- ✅ ≤2 serious violations (documented)
- ✅ 100% keyboard navigation
- ✅ Screen reader compatibility

### Automated Accessibility Tests

```typescript
// tests/a11y/multi-unit-booking.test.ts
import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MultiUnitSelector } from '@/components/bookings/MultiUnitSelector';

expect.extend(toHaveNoViolations);

describe('Accessibility: Multi-Unit Booking Flow', () => {
  test('MultiUnitSelector has no critical accessibility violations', async () => {
    const { container } = render(
      <MultiUnitSelector
        units={mockUnits}
        selectedUnits={[]}
        checkIn="2025-12-01"
        checkOut="2025-12-03"
        onAddUnit={() => {}}
        onRemoveUnit={() => {}}
      />
    );

    const results = await axe(container);

    // Pragmatic approach: Allow up to 2 serious violations if documented
    const criticalViolations = results.violations.filter(
      v => v.impact === 'critical'
    );
    const seriousViolations = results.violations.filter(
      v => v.impact === 'serious'
    );

    expect(criticalViolations).toHaveLength(0);
    expect(seriousViolations.length).toBeLessThanOrEqual(2);

    // Document any serious violations for tracking
    if (seriousViolations.length > 0) {
      console.warn('Serious accessibility violations found:', seriousViolations);
    }
  });

  test('UnitCardList is keyboard navigable', async () => {
    const { getByTestId } = render(
      <UnitCardList units={mockUnits} onRemove={() => {}} />
    );

    const firstCard = getByTestId('unit-card-0');
    firstCard.focus();

    expect(document.activeElement).toBe(firstCard);

    // Test keyboard navigation
    // Tab should move to next card
    fireEvent.keyDown(firstCard, { key: 'Tab' });
    expect(document.activeElement).toBe(getByTestId('unit-card-1'));
  });

  test('form inputs have proper labels and ARIA attributes', () => {
    const { getByLabelText } = render(<BookingForm />);

    const guestNameInput = getByLabelText('Guest Name');
    expect(guestNameInput).toHaveAttribute('aria-required', 'true');
    expect(guestNameInput).toHaveAttribute('aria-invalid', 'false');

    // Trigger validation error
    fireEvent.blur(guestNameInput);
    expect(guestNameInput).toHaveAttribute('aria-invalid', 'true');
    expect(guestNameInput).toHaveAttribute('aria-describedby');
  });

  test('error messages are announced to screen readers', async () => {
    const { getByRole, getByText } = render(<BookingForm />);

    const submitButton = getByRole('button', { name: /submit/i });
    fireEvent.click(submitButton);

    // Wait for error message
    await waitFor(() => {
      const errorMessage = getByText(/guest name is required/i);
      expect(errorMessage).toHaveAttribute('role', 'alert');
      expect(errorMessage).toHaveAttribute('aria-live', 'assertive');
    });
  });

  test('color contrast meets WCAG AA standards (pragmatic)', async () => {
    const { container } = render(<MultiUnitPricingSummary units={mockUnits} />);

    // Run axe with specific color-contrast rule
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true }
      }
    });

    const contrastViolations = results.violations.filter(v => v.id === 'color-contrast');
    const criticalContrast = contrastViolations.filter(v => v.impact === 'critical');

    // Must have 0 critical contrast violations
    expect(criticalContrast).toHaveLength(0);

    // Document any minor contrast issues
    if (contrastViolations.length > 0) {
      console.warn('Non-critical contrast issues:', contrastViolations);
    }
  });
});
```

### Lighthouse CI Configuration

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run preview",
      url: [
        "http://localhost:4173/",
        "http://localhost:4173/bookings",
        "http://localhost:4173/bookings/new",
        "http://localhost:4173/availability",
      ],
      numberOfRuns: 3,
    },
    assert: {
      preset: "lighthouse:recommended",
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.8 }],

        // Custom assertions
        "first-contentful-paint": ["warn", { maxNumericValue: 2000 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["warn", { maxNumericValue: 300 }],

        // Accessibility specific
        "aria-allowed-attr": "error",
        "aria-required-attr": "error",
        "aria-valid-attr-value": "error",
        "button-name": "error",
        "document-title": "error",
        "duplicate-id-aria": "error",
        "html-has-lang": "error",
        "image-alt": "error",
        label: "error",
        "link-name": "error",
        "meta-viewport": "error",
        tabindex: "error",
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
```

---

## 6. Integration Test Suite Organization

```
tests/
├── e2e/
│   ├── multi-unit-booking-flow.spec.ts
│   ├── multi-unit-availability.spec.ts
│   ├── backwards-compatibility.spec.ts
│   ├── guest-assignment.spec.ts
│   ├── payment-processing.spec.ts
│   └── realtime-updates.spec.ts
├── performance/
│   ├── artillery/
│   │   ├── load-test.yml
│   │   └── processors.js
│   ├── db-benchmarks.test.ts
│   ├── analyze-queries.sql
│   └── bundle-size.test.ts
├── security/
│   ├── xss-prevention.test.ts
│   ├── sql-injection.test.ts
│   ├── auth-authorization.test.ts
│   ├── audit-checklist.test.ts
│   └── zap-scan.yaml
├── a11y/
│   ├── multi-unit-booking.test.ts
│   ├── keyboard-navigation.test.ts
│   └── screen-reader.test.ts
└── integration/
    ├── offline-support.test.ts
    ├── optimistic-updates.test.ts
    ├── realtime-sync.test.ts
    └── error-recovery.test.ts
```

---

## 7. Test Execution Plan

### Pre-Production Checklist

```bash
#!/bin/bash
# scripts/pre-production-tests.sh

set -e

echo "🧪 Running Pre-Production Test Suite"
echo "======================================"

# 1. Unit & Integration Tests
echo "\n📦 Running unit tests with coverage..."
npm run test:coverage
COVERAGE=$(npx nyc report --reporter=text-summary | grep "Lines" | awk '{print $3}' | sed 's/%//')
if (( $(echo "$COVERAGE < 90" | bc -l) )); then
  echo "❌ Coverage below 90%: $COVERAGE%"
  exit 1
fi

# 2. Type Checking
echo "\n🔍 Running TypeScript type check..."
npm run type-check

# 3. Linting
echo "\n🧹 Running ESLint..."
npm run lint

# 4. E2E Tests
echo "\n🎭 Running Playwright E2E tests..."
npx playwright test

# 5. Performance Tests
echo "\n⚡ Running performance benchmarks..."
npm run test:performance
./scripts/run-performance-tests.sh

# 6. Security Scan
echo "\n🔒 Running security scan..."
npm audit --production
npx snyk test

# 7. Accessibility Tests
echo "\n♿ Running Lighthouse CI..."
npx lighthouse-ci autorun

# 8. Database Tests
echo "\n🗄️ Running database performance tests..."
npm run test:db

# 9. Build Verification
echo "\n🏗️ Building production bundle..."
npm run build
npm run build:analyze

# 10. Generate Report
echo "\n📊 Generating test report..."
node scripts/generate-test-report.js

echo "\n✅ All pre-production tests passed!"
echo "📄 Test report: test-results/summary.html"
```

### Continuous Integration Pipeline

```yaml
# .github/workflows/test-suite.yml
name: Test Suite

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  performance-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - run: ./scripts/run-performance-tests.sh
      - name: Check performance thresholds
        run: |
          if [ -f artillery-report.json ]; then
            node scripts/check-performance-thresholds.js
          fi

  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm audit --production
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  accessibility-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - run: npx lighthouse-ci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

---

## 8. Acceptance Criteria

### Phase 5 Sign-Off Checklist

- [ ] **Test Coverage**
  - [ ] Unit test coverage ≥90% for new code
  - [ ] All E2E scenarios passing
  - [ ] Integration tests cover critical paths
  - [ ] Performance benchmarks documented

- [ ] **Performance**
  - [ ] API response time <200ms (p95)
  - [ ] Database queries <100ms (p95)
  - [ ] Lighthouse Performance score ≥90
  - [ ] Bundle size within budget (<500KB gzipped)

- [ ] **Security**
  - [ ] 0 critical vulnerabilities (Snyk, npm audit)
  - [ ] OWASP ZAP scan clean
  - [ ] All inputs sanitized (DOMPurify)
  - [ ] RLS policies validated
  - [ ] Audit logging functional

- [ ] **Accessibility**
  - [ ] Lighthouse Accessibility score ≥95 (pragmatic target)
  - [ ] 0 critical violations (blocking issues)
  - [ ] ≤2 serious violations (must be documented if present)
  - [ ] 100% keyboard navigation functionality
  - [ ] Screen reader compatibility tested
  - [ ] WCAG 2.1 AA core compliance verified

- [ ] **Reliability**
  - [ ] Offline queue functional
  - [ ] Optimistic updates working correctly
  - [ ] Error recovery mechanisms tested
  - [ ] Race condition handling verified
  - [ ] Real-time sync operational

- [ ] **Documentation**
  - [ ] Test execution guide created
  - [ ] Performance baselines documented
  - [ ] Known issues logged
  - [ ] CI/CD pipeline configured

---

## Next Phase Dependencies

**Phase 6: Migration & Rollout** requires:

1. ✅ All tests passing in Phase 5
2. ✅ Performance benchmarks meeting targets
3. ✅ Security audit cleared
4. ✅ Accessibility compliance verified
5. ✅ Feature flag implementation ready
6. ✅ Monitoring infrastructure prepared
7. ✅ Rollback procedures documented

**Estimated Timeline**: Phase 5 completion by Nov 14, 2025 enables Phase 6 (Nov 17-22, 2025)

---

## Risk Mitigation

| Risk                      | Impact   | Mitigation                                                      |
| ------------------------- | -------- | --------------------------------------------------------------- |
| Flaky E2E tests           | High     | Implement retry logic, use data-testid, avoid time-based waits  |
| Performance regression    | High     | Automated performance budgets, alerting on threshold violations |
| Security vulnerabilities  | Critical | Automated security scanning in CI, monthly dependency updates   |
| Low test coverage         | Medium   | Required pre-commit hooks, coverage gates in CI                 |
| Accessibility regressions | Medium   | Automated a11y tests in CI, manual testing with screen readers  |

---

**Phase 5 Lead**: `code-quality-reviewer`
**Review & Approval**: Product Owner, Security Team, QA Team
**Target Completion**: November 14, 2025
