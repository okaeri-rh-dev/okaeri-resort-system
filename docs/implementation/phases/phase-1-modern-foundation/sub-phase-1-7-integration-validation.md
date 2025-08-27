# Sub-Phase 1.7: Integration & E2E Validation

## Overview

This final sub-phase of Phase 1 focuses on complete system integration,
end-to-end testing, performance validation, security auditing, and deployment
readiness verification. It ensures all components work together seamlessly and
meet production standards.

## Objectives

1. Perform complete integration testing across all components
2. Execute end-to-end user flow validation
3. Conduct performance benchmarking and optimization
4. Complete security audit and compliance check
5. Validate deployment readiness and documentation

## Test-First Development Process

### Step 1: Define Test Specifications

- Agent writes comprehensive test suite based on requirements
- Tests cover expected input/output pairs for integration & validation
- Include edge cases, error scenarios, and Philippine-specific requirements
- Reference test templates from `/tests/templates/`

### Step 2: Validate Tests Fail

- Run test suite to confirm all tests fail (no implementation exists)
- Command: `npm test integration-validation.test.ts`
- Expected: All tests should fail with clear error messages
- NO implementation code should be written at this stage

### Step 3: Commit Test Suite

- Tests are committed as the immutable specification
- Commit message: "test: add failing tests for integration & validation"
- These tests CANNOT be modified during implementation

### Step 4: Implement Feature

- Agent writes minimal code to pass ALL tests
- Tests remain unchanged - implementation must adapt
- Use repository patterns from `/src/lib/repositories/`
- Apply dependency injection for testability

### Step 5: Independent Verification

- Different specialized agent reviews implementation
- Ensures no overfitting to test cases
- Validates general solution beyond test scenarios
- Confirms best practices and patterns are followed

## Integration Points

### System Architecture Validation

```
Frontend (React 19 + Vite 7)
    ↓
TanStack Router (Protected Routes)
    ↓
Zustand + TanStack Query (State Management)
    ↓
API Client (Type-safe requests)
    ↓
Vercel API Routes (Serverless Functions)
    ↓
Middleware Stack (Auth, Validation, Rate Limiting)
    ↓
Neon PostgreSQL (Multi-tenant Database)
```

## E2E Test Scenarios

### Critical User Flows

```typescript
// tests/e2e/critical-flows.spec.ts
import { test, expect } from "@playwright/test";
import { createTestUser, cleanupTestData } from "./helpers";

test.describe("Critical User Flows", () => {
  let testUser: { email: string; password: string; id: string };

  test.beforeAll(async () => {
    testUser = await createTestUser();
  });

  test.afterAll(async () => {
    await cleanupTestData(testUser.id);
  });

  test("Complete booking creation flow", async ({ page }) => {
    // 1. Login
    await page.goto("/login");
    await page.fill('[name="email"]', testUser.email);
    await page.fill('[name="password"]', testUser.password);
    await page.click('[type="submit"]');

    await expect(page).toHaveURL("/dashboard");

    // 2. Navigate to bookings
    await page.click('[data-testid="nav-bookings"]');
    await expect(page).toHaveURL(/\/bookings/);

    // 3. Create new booking
    await page.click('[data-testid="new-booking-btn"]');

    await page.fill('[name="guestName"]', "John Doe");
    await page.fill('[name="guestEmail"]', "john@example.com");
    await page.fill('[name="checkinDate"]', "2025-02-01");
    await page.fill('[name="checkoutDate"]', "2025-02-03");
    await page.fill('[name="guestCount"]', "2");
    await page.fill('[name="totalAmount"]', "5000");
    await page.selectOption('[name="source"]', "direct");

    await page.click('[type="submit"]');

    // 4. Verify booking created
    await expect(page.locator('[data-testid="booking-list"]')).toContainText(
      "John Doe"
    );

    // 5. View booking details
    await page.click('[data-testid="booking-item"]:first-child');
    await expect(page.locator("h1")).toContainText("Booking Details");

    // 6. Add payment
    await page.click('[data-testid="add-payment-btn"]');
    await page.fill('[name="amount"]', "2500");
    await page.selectOption('[name="paymentMethod"]', "gcash");
    await page.click('[type="submit"]');

    await expect(page.locator('[data-testid="payment-list"]')).toContainText(
      "₱2,500"
    );
  });

  test("Expense tracking flow", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', testUser.email);
    await page.fill('[name="password"]', testUser.password);
    await page.click('[type="submit"]');

    // Navigate to expenses
    await page.click('[data-testid="nav-expenses"]');

    // Create expense
    await page.click('[data-testid="new-expense-btn"]');
    await page.fill('[name="description"]', "Cleaning supplies");
    await page.fill('[name="amount"]', "1500");
    await page.selectOption('[name="category"]', "supplies");
    await page.setInputFiles('[name="receipt"]', "tests/fixtures/receipt.jpg");

    await page.click('[type="submit"]');

    // Verify expense created
    await expect(page.locator('[data-testid="expense-list"]')).toContainText(
      "Cleaning supplies"
    );
    await expect(page.locator('[data-testid="expense-list"]')).toContainText(
      "₱1,500"
    );
  });

  test("Multi-project switching", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', testUser.email);
    await page.fill('[name="password"]', testUser.password);
    await page.click('[type="submit"]');

    // Create second project
    await page.click('[data-testid="project-switcher"]');
    await page.click('[data-testid="create-project-btn"]');

    await page.fill('[name="projectName"]', "Test Resort 2");
    await page.selectOption('[name="businessType"]', "resort");
    await page.fill('[name="location"]', "Boracay");
    await page.click('[type="submit"]');

    // Verify project created and switched
    await expect(page.locator('[data-testid="current-project"]')).toContainText(
      "Test Resort 2"
    );

    // Switch back to first project
    await page.click('[data-testid="project-switcher"]');
    await page.click('[data-testid="project-item"]:first-child');

    // Verify data isolation
    await page.goto("/dashboard/bookings");
    const bookingCount1 = await page
      .locator('[data-testid="booking-item"]')
      .count();

    await page.click('[data-testid="project-switcher"]');
    await page.click('[data-testid="project-item"]:last-child');

    await page.goto("/dashboard/bookings");
    const bookingCount2 = await page
      .locator('[data-testid="booking-item"]')
      .count();

    expect(bookingCount2).toBe(0); // New project should have no bookings
  });
});
```

## Performance Testing

### Lighthouse CI Configuration

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: [
        "http://localhost:3000/",
        "http://localhost:3000/login",
        "http://localhost:3000/dashboard",
        "http://localhost:3000/dashboard/bookings",
      ],
      numberOfRuns: 3,
      settings: {
        preset: "desktop",
        throttling: {
          cpuSlowdownMultiplier: 1,
        },
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.95 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.95 }],
        "categories:seo": ["error", { minScore: 0.9 }],
        "first-contentful-paint": ["error", { maxNumericValue: 1500 }],
        interactive: ["error", { maxNumericValue: 3000 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "total-bundle-size": ["error", { maxNumericValue: 150000 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
```

### Load Testing

```typescript
// tests/load/api-load-test.ts
import { check } from "k6";
import http from "k6/http";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const apiDuration = new Trend("api_duration");

export const options = {
  stages: [
    { duration: "30s", target: 10 }, // Ramp up to 10 users
    { duration: "1m", target: 50 }, // Stay at 50 users
    { duration: "30s", target: 100 }, // Peak at 100 users
    { duration: "30s", target: 0 }, // Ramp down
  ],
  thresholds: {
    errors: ["rate<0.01"], // Error rate < 1%
    api_duration: ["p(95)<500"], // 95% of requests < 500ms
    http_req_duration: ["p(99)<1000"], // 99% of requests < 1s
  },
};

export default function () {
  const token = login();

  // Test booking list endpoint
  const bookingsRes = http.get("http://localhost:3000/api/project-1/bookings", {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(bookingsRes, {
    "bookings status is 200": (r) => r.status === 200,
    "bookings response time < 500ms": (r) => r.timings.duration < 500,
  });

  apiDuration.add(bookingsRes.timings.duration);
  errorRate.add(bookingsRes.status !== 200);

  // Test expense creation
  const expenseRes = http.post(
    "http://localhost:3000/api/project-1/expenses",
    JSON.stringify({
      description: "Load test expense",
      amount: 100,
      category: "other",
      expenseDate: new Date().toISOString(),
    }),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  check(expenseRes, {
    "expense creation status is 201": (r) => r.status === 201,
    "expense creation time < 500ms": (r) => r.timings.duration < 500,
  });
}

function login() {
  const res = http.post(
    "http://localhost:3000/api/auth/login",
    JSON.stringify({
      email: "loadtest@example.com",
      password: "LoadTest123!",
    }),
    { headers: { "Content-Type": "application/json" } }
  );

  return JSON.parse(res.body).accessToken;
}
```

## Security Audit

### Security Checklist

```typescript
// tests/security/security-audit.test.ts
import { describe, it, expect } from "vitest";
import {
  testSecurityHeaders,
  testAuth,
  testInjection,
} from "./security-helpers";

describe("Security Audit", () => {
  describe("Headers", () => {
    it("sets proper security headers", async () => {
      const headers = await testSecurityHeaders("http://localhost:3000");

      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["x-xss-protection"]).toBe("1; mode=block");
      expect(headers["strict-transport-security"]).toContain("max-age=");
      expect(headers["content-security-policy"]).toBeDefined();
    });
  });

  describe("Authentication", () => {
    it("prevents access without auth", async () => {
      const response = await fetch(
        "http://localhost:3000/api/project-1/bookings"
      );
      expect(response.status).toBe(401);
    });

    it("validates JWT properly", async () => {
      const invalidToken = "invalid.jwt.token";
      const response = await fetch(
        "http://localhost:3000/api/project-1/bookings",
        {
          headers: { Authorization: `Bearer ${invalidToken}` },
        }
      );
      expect(response.status).toBe(401);
    });

    it("enforces password requirements", async () => {
      const weakPasswords = ["short", "12345678", "password", "Password1"];

      for (const password of weakPasswords) {
        const response = await testAuth.register({
          email: "test@example.com",
          password,
          firstName: "Test",
          lastName: "User",
        });

        expect(response.status).toBe(400);
        expect(response.error).toContain("password");
      }
    });
  });

  describe("SQL Injection", () => {
    it("prevents SQL injection in search", async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      const response = await testInjection.search(maliciousInput);

      expect(response.status).toBe(200); // Should handle gracefully

      // Verify database is intact
      const dbCheck = await testInjection.verifyDatabase();
      expect(dbCheck.tablesExist).toBe(true);
    });

    it("sanitizes user input", async () => {
      const xssPayload = '<script>alert("XSS")</script>';
      const response = await testInjection.createBooking({
        guestName: xssPayload,
        // ... other fields
      });

      const booking = response.data;
      expect(booking.guestName).not.toContain("<script>");
    });
  });

  describe("Rate Limiting", () => {
    it("enforces rate limits", async () => {
      const requests = Array(150)
        .fill(null)
        .map(() =>
          fetch("http://localhost:3000/api/auth/login", {
            method: "POST",
            body: JSON.stringify({
              email: "test@example.com",
              password: "wrong",
            }),
          })
        );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe("CORS", () => {
    it("restricts CORS appropriately", async () => {
      const response = await fetch("http://localhost:3000/api/auth/login", {
        method: "OPTIONS",
        headers: {
          Origin: "http://malicious-site.com",
        },
      });

      const allowedOrigin = response.headers.get("Access-Control-Allow-Origin");
      expect(allowedOrigin).not.toBe("http://malicious-site.com");
    });
  });
});
```

## Performance Benchmarks

### Target Metrics

| Metric                  | Target   | Actual | Status |
| ----------------------- | -------- | ------ | ------ |
| Lighthouse Performance  | ≥ 95     | -      | ⏳     |
| First Contentful Paint  | < 1.5s   | -      | ⏳     |
| Time to Interactive     | < 3s     | -      | ⏳     |
| Cumulative Layout Shift | < 0.1    | -      | ⏳     |
| Bundle Size (gzipped)   | < 150KB  | -      | ⏳     |
| API Response Time (p50) | < 100ms  | -      | ⏳     |
| API Response Time (p95) | < 500ms  | -      | ⏳     |
| API Response Time (p99) | < 1000ms | -      | ⏳     |
| Database Query Time     | < 50ms   | -      | ⏳     |
| Cold Start Time         | < 500ms  | -      | ⏳     |

## Integration Test Suite

### API Integration Tests

```typescript
// tests/integration/api-integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDatabase, teardownTestDatabase } from "./test-helpers";
import { apiClient } from "@/api/client";

describe("API Integration", () => {
  let testProjectId: string;
  let authToken: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    testProjectId = setup.projectId;
    authToken = setup.token;
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe("Booking Flow", () => {
    it("creates, updates, and deletes booking", async () => {
      // Create
      const createRes = await apiClient.post(
        `/projects/${testProjectId}/bookings`,
        {
          guestName: "Integration Test",
          checkinDate: "2025-03-01",
          checkoutDate: "2025-03-03",
          guestCount: 2,
          totalAmount: 5000,
          source: "direct",
        }
      );

      expect(createRes.status).toBe(201);
      const bookingId = createRes.data.id;

      // Read
      const getRes = await apiClient.get(
        `/projects/${testProjectId}/bookings/${bookingId}`
      );
      expect(getRes.status).toBe(200);
      expect(getRes.data.guestName).toBe("Integration Test");

      // Update
      const updateRes = await apiClient.put(
        `/projects/${testProjectId}/bookings/${bookingId}`,
        {
          guestCount: 3,
        }
      );
      expect(updateRes.status).toBe(200);
      expect(updateRes.data.guestCount).toBe(3);

      // Delete
      const deleteRes = await apiClient.delete(
        `/projects/${testProjectId}/bookings/${bookingId}`
      );
      expect(deleteRes.status).toBe(204);

      // Verify deletion
      const verifyRes = await apiClient.get(
        `/projects/${testProjectId}/bookings/${bookingId}`
      );
      expect(verifyRes.status).toBe(404);
    });
  });

  describe("Multi-tenant Isolation", () => {
    it("prevents cross-project data access", async () => {
      // Create data in project 1
      const booking1 = await apiClient.post(
        `/projects/${testProjectId}/bookings`,
        {
          guestName: "Project 1 Guest",
          // ... other fields
        }
      );

      // Create second project
      const project2 = await apiClient.post("/projects", {
        name: "Test Project 2",
        businessType: "resort",
      });

      // Try to access project 1 booking from project 2 context
      const crossAccessRes = await apiClient.get(
        `/projects/${project2.data.id}/bookings/${booking1.data.id}`
      );

      expect(crossAccessRes.status).toBe(404);
    });
  });
});
```

## Deployment Validation

### Pre-Deployment Checklist

```yaml
# .github/workflows/pre-deploy-check.yml
name: Pre-Deployment Validation

on:
  push:
    branches: [main, staging]

jobs:
  validate:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "20"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type checking
        run: pnpm type-check

      - name: Linting
        run: pnpm lint

      - name: Unit tests
        run: pnpm test:unit

      - name: Integration tests
        run: pnpm test:integration

      - name: Build
        run: pnpm build

      - name: Bundle size check
        run: pnpm size-limit

      - name: Lighthouse CI
        run: pnpm lhci autorun

      - name: Security audit
        run: pnpm audit

      - name: E2E tests
        run: pnpm test:e2e
```

## Agent Validation Requirements

### Required Agent Sign-offs

| Agent                             | Validation Areas                            | Status |
| --------------------------------- | ------------------------------------------- | ------ |
| typescript-react-quality-expert   | Code quality, type safety, best practices   | ⏳     |
| security-compliance-auditor       | Security audit, compliance, data protection | ⏳     |
| vercel-deployment-optimizer       | Deployment config, performance, monitoring  | ⏳     |
| postgres-serverless-architect     | Database performance, queries, indexes      | ⏳     |
| zustand-tanstack-resort-architect | State management, data flow, caching        | ⏳     |
| serverless-saas-architect         | Architecture review, scalability, costs     | ⏳     |
| resort-ui-designer                | UI/UX review, accessibility, mobile         | ⏳     |
| pwa-performance-optimizer         | PWA features, offline, performance          | ⏳     |

### Validation Report Template

```markdown
## Agent Validation Report

**Agent:** [Agent Name] **Date:** [Date] **Phase:** 1.7 - Integration & E2E
Validation

### Areas Reviewed

- [ ] Area 1
- [ ] Area 2
- [ ] Area 3

### Findings

1. **Critical Issues:** None / List
2. **Recommendations:** List
3. **Optimizations:** List

### Approval Status

- [ ] Approved
- [ ] Approved with conditions
- [ ] Requires revision

### Conditions/Notes

[Any conditions or notes]

**Signed:** [Agent Signature]
```

## Final Deliverables

### Documentation

- [ ] API documentation with examples
- [ ] Database schema documentation
- [ ] Deployment guide
- [ ] Development setup guide
- [ ] Architecture decision records
- [ ] Security audit report
- [ ] Performance benchmark report

### Code Deliverables

- [ ] Complete frontend application
- [ ] All API endpoints implemented
- [ ] Database with migrations
- [ ] Authentication system
- [ ] Test suites (unit, integration, e2e)
- [ ] CI/CD pipeline configuration
- [ ] Monitoring and logging setup

### Metrics & Reports

- [ ] Code coverage report (> 80%)
- [ ] Bundle size analysis
- [ ] Lighthouse scores
- [ ] Load test results
- [ ] Security scan results
- [ ] Agent validation reports

## Success Criteria

### Functional Requirements

- ✅ User can register and login
- ✅ User can create and manage projects
- ✅ User can create, view, update, delete bookings
- ✅ User can track expenses with receipts
- ✅ User can switch between projects
- ✅ Data is properly isolated between projects
- ✅ Role-based access control works

### Non-Functional Requirements

- ✅ Page load time < 3 seconds
- ✅ API response time < 500ms (p95)
- ✅ Lighthouse score > 95
- ✅ Mobile responsive design
- ✅ WCAG 2.1 AA compliant
- ✅ Security best practices followed
- ✅ 99.9% uptime capability

## Handoff to Phase 2

### Prerequisites for Phase 2

1. All Phase 1 deliverables completed
2. All agent validations passed
3. Production environment configured
4. Team trained on architecture
5. Documentation complete

### Phase 2 Dependencies

- Working authentication system
- Database schema established
- API structure defined
- State management patterns
- Component library ready

### Known Issues / Tech Debt

- [ ] List any known issues
- [ ] Document technical debt
- [ ] Note performance optimizations needed
- [ ] Identify refactoring opportunities

## Completion Checklist

- [ ] All sub-phases 1.1-1.6 completed
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] All agent validations received
- [ ] Documentation complete
- [ ] Code coverage > 80%
- [ ] Bundle size < 150KB
- [ ] Deployment validated
- [ ] Handoff to Phase 2 ready

---

_Sub-Phase 1.7 ensures the complete Phase 1 implementation is production-ready,
performant, secure, and validated by all specialized agents._
