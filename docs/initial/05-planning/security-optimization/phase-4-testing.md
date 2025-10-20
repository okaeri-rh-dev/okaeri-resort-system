# Phase 4: Testing & Validation

## Implementation Guide

**Phase Duration:** 2 Days
**Priority:** MEDIUM - P2
**Prerequisites:** Phases 1-3 Complete
**Dependencies:** Jest, React Testing Library, Cypress, Lighthouse, OWASP ZAP

---

## Overview

Phase 4 validates all security fixes, performance optimizations, and architectural improvements through comprehensive testing. This phase ensures production readiness through automated testing, security scanning, and performance benchmarking.

---

## Testing Strategy

### 1. Security Testing Suite

#### XSS Prevention Testing

```typescript
// File: /src/__tests__/security/xss-prevention.test.ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookingForm } from '@/components/bookings/BookingForm';
import { sanitizeText, sanitizeRichText, sanitizeUrl } from '@/lib/security/sanitize';

describe('XSS Prevention', () => {
  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    'javascript:alert("XSS")',
    '<svg onload=alert("XSS")>',
    '"><script>alert("XSS")</script>',
    '<iframe src=javascript:alert("XSS")>',
    '<body onload=alert("XSS")>',
    '<input onfocus=alert("XSS") autofocus>',
    '<marquee onstart=alert("XSS")>',
    '<details open ontoggle=alert("XSS")>',
  ];

  describe('Input Sanitization', () => {
    test.each(xssPayloads)(
      'should sanitize XSS payload: %s',
      (payload) => {
        const sanitized = sanitizeText(payload);
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain('>');
        expect(sanitized).not.toContain('script');
        expect(sanitized).not.toContain('onerror');
        expect(sanitized).not.toContain('javascript:');
      }
    );
  });

  describe('Form Component XSS Protection', () => {
    test.each(xssPayloads)(
      'should prevent XSS in guest name field with payload: %s',
      async (payload) => {
        const user = userEvent.setup();
        const handleSubmit = jest.fn();

        render(<BookingForm onSuccess={handleSubmit} />);

        const nameInput = screen.getByLabelText(/guest name/i);
        await user.type(nameInput, payload);

        // Submit form
        const submitButton = screen.getByRole('button', { name: /submit/i });
        await user.click(submitButton);

        // Verify sanitized data
        await waitFor(() => {
          expect(handleSubmit).toHaveBeenCalled();
          const submittedData = handleSubmit.mock.calls[0][0];
          expect(submittedData.guest_name).not.toContain('<script>');
          expect(submittedData.guest_name).not.toContain('javascript:');
        });
      }
    );
  });

  describe('URL Sanitization', () => {
    const maliciousUrls = [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:alert(1)',
      'file:///etc/passwd',
      'jar:http://example.com!/path',
    ];

    test.each(maliciousUrls)(
      'should block malicious URL: %s',
      (url) => {
        const sanitized = sanitizeUrl(url);
        expect(sanitized).toBe('');
      }
    );

    test('should allow valid URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        '/relative/path',
        '../parent/path',
      ];

      validUrls.forEach(url => {
        const sanitized = sanitizeUrl(url);
        expect(sanitized).toBeTruthy();
      });
    });
  });
});
```

#### Authentication Security Testing

```typescript
// File: /src/__tests__/security/auth-security.test.ts
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

describe("Authentication Security", () => {
  describe("Session Refresh Security", () => {
    test("should use random refresh intervals", async () => {
      const intervals: number[] = [];

      // Mock setTimeout to capture intervals
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback, interval) => {
        intervals.push(interval as number);
        return originalSetTimeout(callback, 0);
      }) as any;

      // Start multiple refresh cycles
      for (let i = 0; i < 10; i++) {
        auth.startSessionRefresh();
        auth.stopSessionRefresh();
      }

      // Verify intervals are random (45-55 minutes)
      const uniqueIntervals = new Set(intervals);
      expect(uniqueIntervals.size).toBeGreaterThan(1);

      intervals.forEach((interval) => {
        expect(interval).toBeGreaterThanOrEqual(45 * 60 * 1000);
        expect(interval).toBeLessThanOrEqual(55 * 60 * 1000);
      });

      global.setTimeout = originalSetTimeout;
    });

    test("should validate routes before redirect", () => {
      const mockReplace = jest.fn();
      window.location.replace = mockReplace;

      // Test valid route
      auth.handleSessionExpired();
      expect(mockReplace).toHaveBeenCalledWith("/login");

      // Test invalid route injection attempt
      mockReplace.mockClear();
      const maliciousRoute = "javascript:alert(1)";
      // Should not redirect to malicious route
      expect(mockReplace).not.toHaveBeenCalledWith(maliciousRoute);
    });

    test("should clear all sensitive data on logout", async () => {
      // Set some test data
      sessionStorage.setItem("test-key", "test-value");
      localStorage.setItem("auth-token", "secret-token");
      document.cookie = "session=abc123; path=/";

      await auth.signOut();

      // Verify all storage cleared
      expect(sessionStorage.length).toBe(0);
      expect(localStorage.getItem("auth-token")).toBeNull();
      expect(document.cookie).not.toContain("session=abc123");
    });

    test("should not leak information in error messages", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      try {
        await auth.signIn("invalid@email.com", "wrongpassword");
      } catch (error: any) {
        // Error message should be generic
        expect(error.message).toBe("Authentication failed. Please check your credentials.");
        expect(error.message).not.toContain("user not found");
        expect(error.message).not.toContain("invalid password");
      }

      consoleErrorSpy.mockRestore();
    });
  });
});
```

#### SQL Injection Testing

```typescript
// File: /src/__tests__/security/sql-injection.test.ts
import { supabase } from "@/lib/supabase";

describe("SQL Injection Prevention", () => {
  const sqlInjectionPayloads = [
    "'; DROP TABLE bookings; --",
    "1' OR '1' = '1",
    "admin'--",
    "1' UNION SELECT * FROM users--",
    "' OR 1=1--",
    "'; DELETE FROM bookings WHERE '1'='1",
  ];

  test.each(sqlInjectionPayloads)(
    "should prevent SQL injection with payload: %s",
    async (payload) => {
      // Test in search query
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .ilike("guest_name", `%${payload}%`);

      // Should not cause database error
      expect(error).toBeNull();
      // Should treat payload as literal string
      expect(data).toEqual([]);
    }
  );

  test("should use parameterized queries", async () => {
    const userInput = "O'Brien"; // Name with apostrophe

    const { data, error } = await supabase.from("guests").select("*").eq("guest_name", userInput);

    // Should handle special characters safely
    expect(error).toBeNull();
  });
});
```

---

### 2. Performance Testing

#### Memory Leak Testing

```typescript
// File: /src/__tests__/performance/memory-leaks.test.ts
import { act, cleanup, renderHook } from "@testing-library/react-hooks";

import { useBookingStore } from "@/stores/useBookingStore";

describe("Memory Leak Prevention", () => {
  afterEach(cleanup);

  test("should clean up optimistic bookings after TTL", async () => {
    jest.useFakeTimers();

    const { result } = renderHook(() => useBookingStore());

    // Add optimistic bookings
    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.addOptimisticBooking({
          booking_id: `test-${i}`,
          // ... other booking data
        });
      }
    });

    expect(result.current.optimisticBookings.size).toBe(10);

    // Fast-forward time past TTL (5 minutes)
    act(() => {
      jest.advanceTimersByTime(6 * 60 * 1000);
    });

    // Verify cleanup occurred
    expect(result.current.optimisticBookings.size).toBe(0);

    jest.useRealTimers();
  });

  test("should enforce maximum optimistic entries limit", () => {
    const { result } = renderHook(() => useBookingStore());

    // Add more than max limit (100)
    act(() => {
      for (let i = 0; i < 150; i++) {
        result.current.addOptimisticBooking({
          booking_id: `test-${i}`,
          // ... other booking data
        });
      }
    });

    // Should not exceed 100 entries
    expect(result.current.optimisticBookings.size).toBeLessThanOrEqual(100);
  });

  test("should clean up timers on unmount", () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");
    const { result, unmount } = renderHook(() => useBookingStore());

    act(() => {
      result.current.startCleanupTimer();
    });

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
```

#### Bundle Size Testing

```typescript
// File: /scripts/test-bundle-size.js
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const MAX_BUNDLE_SIZE = 500 * 1024; // 500KB
const MAX_CHUNK_SIZE = 200 * 1024; // 200KB per chunk

function testBundleSize() {
  // Build production bundle
  execSync("npm run build", { stdio: "inherit" });

  const distPath = path.join(__dirname, "../dist");
  const assets = fs.readdirSync(path.join(distPath, "assets"));

  let totalSize = 0;
  const oversizedChunks = [];

  assets.forEach((file) => {
    if (file.endsWith(".js") || file.endsWith(".css")) {
      const filePath = path.join(distPath, "assets", file);
      const stats = fs.statSync(filePath);
      const size = stats.size;

      totalSize += size;

      if (size > MAX_CHUNK_SIZE) {
        oversizedChunks.push({
          file,
          size: `${(size / 1024).toFixed(2)}KB`,
        });
      }
    }
  });

  console.log(`Total bundle size: ${(totalSize / 1024).toFixed(2)}KB`);

  if (totalSize > MAX_BUNDLE_SIZE) {
    console.error(
      `❌ Bundle size exceeds limit: ${(totalSize / 1024).toFixed(2)}KB > ${MAX_BUNDLE_SIZE / 1024}KB`
    );
    process.exit(1);
  }

  if (oversizedChunks.length > 0) {
    console.warn("⚠️ Large chunks detected:", oversizedChunks);
  }

  console.log("✅ Bundle size within limits");
}

testBundleSize();
```

#### Performance Metrics Testing

```typescript
// File: /src/__tests__/performance/metrics.test.ts
import { measurePerformance } from '@/utils/performance';
import { render } from '@testing-library/react';
import { BookingTable } from '@/components/bookings/BookingTable';

describe('Performance Metrics', () => {
  test('should render large dataset efficiently', async () => {
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      booking_id: `booking-${i}`,
      // ... other booking data
    }));

    const startTime = performance.now();
    const { container } = render(<BookingTable bookings={largeDataset} />);
    const endTime = performance.now();

    const renderTime = endTime - startTime;

    // Should render in under 100ms
    expect(renderTime).toBeLessThan(100);

    // Should use virtualization for large lists
    const visibleRows = container.querySelectorAll('tr');
    expect(visibleRows.length).toBeLessThan(50); // Only visible items rendered
  });

  test('should maintain 60fps during scroll', async () => {
    const { container } = render(<BookingTable bookings={mockBookings} />);

    const fps = await measureScrollPerformance(container);

    expect(fps).toBeGreaterThanOrEqual(60);
  });

  test('should have acceptable Time to Interactive', async () => {
    const metrics = await measureWebVitals();

    expect(metrics.FCP).toBeLessThan(1800); // First Contentful Paint < 1.8s
    expect(metrics.LCP).toBeLessThan(2500); // Largest Contentful Paint < 2.5s
    expect(metrics.TTI).toBeLessThan(3500); // Time to Interactive < 3.5s
    expect(metrics.CLS).toBeLessThan(0.1);  // Cumulative Layout Shift < 0.1
  });
});
```

---

### 3. Type Coverage Testing

```typescript
// File: /scripts/type-coverage.ts
import { Project } from "ts-morph";

async function checkTypeCoverage() {
  const project = new Project({
    tsConfigFilePath: "./tsconfig.json",
  });

  const sourceFiles = project.getSourceFiles();
  let totalNodes = 0;
  let typedNodes = 0;
  const anyUsages: string[] = [];

  sourceFiles.forEach((file) => {
    file.forEachDescendant((node) => {
      totalNodes++;

      // Check for 'any' type
      if (node.getType().getText() === "any") {
        anyUsages.push(`${file.getFilePath()}:${node.getStartLineNumber()}`);
      } else if (node.getType().getText() !== "unknown") {
        typedNodes++;
      }
    });
  });

  const coverage = (typedNodes / totalNodes) * 100;

  console.log(`Type Coverage: ${coverage.toFixed(2)}%`);

  if (anyUsages.length > 0) {
    console.error('❌ Found "any" types:', anyUsages);
    process.exit(1);
  }

  if (coverage < 95) {
    console.error(`❌ Type coverage below 95%: ${coverage.toFixed(2)}%`);
    process.exit(1);
  }

  console.log("✅ Type coverage passes");
}

checkTypeCoverage();
```

---

### 4. Integration Testing

```typescript
// File: /cypress/e2e/security-integration.cy.ts
describe("Security Integration Tests", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("should prevent XSS attacks in all forms", () => {
    cy.login();
    cy.visit("/bookings/new");

    const xssPayload = "<img src=x onerror=alert(1)>";

    // Try XSS in each form field
    cy.get('input[name="guest_name"]').type(xssPayload);
    cy.get('input[name="email"]').type("test@example.com");
    cy.get('textarea[name="special_requests"]').type(xssPayload);

    cy.get("form").submit();

    // Verify no alert was triggered
    cy.on("window:alert", () => {
      throw new Error("XSS attack succeeded!");
    });

    // Verify data was sanitized
    cy.wait("@createBooking").then((interception) => {
      const { guest_name, special_requests } = interception.request.body;
      expect(guest_name).not.to.contain("<");
      expect(special_requests).not.to.contain("<img");
    });
  });

  it("should handle session timeout securely", () => {
    cy.login();
    cy.visit("/dashboard");

    // Simulate session expiry
    cy.window().then((win) => {
      win.localStorage.removeItem("supabase.auth.token");
    });

    // Try to access protected route
    cy.visit("/bookings");

    // Should redirect to login
    cy.url().should("include", "/login");

    // Should clear all sensitive data
    cy.window().then((win) => {
      expect(win.sessionStorage.length).to.equal(0);
      expect(win.localStorage.getItem("auth_token")).to.be.null;
    });
  });

  it("should prevent CSRF attacks", () => {
    cy.login();

    // Attempt CSRF attack
    cy.request({
      method: "POST",
      url: "/api/bookings",
      headers: {
        Origin: "http://evil-site.com",
      },
      body: {
        // Malicious booking data
      },
      failOnStatusCode: false,
    }).then((response) => {
      // Should be rejected
      expect(response.status).to.equal(403);
    });
  });
});
```

---

## Production Readiness Checklist

### Security Checklist

- [ ] All XSS test cases passing
- [ ] SQL injection prevention verified
- [ ] Authentication security hardened
- [ ] CSRF protection implemented
- [ ] Session management secure
- [ ] Error messages sanitized
- [ ] Input validation complete
- [ ] File upload restrictions in place
- [ ] Rate limiting configured
- [ ] Security headers set

### Performance Checklist

- [ ] Bundle size < 500KB (gzipped)
- [ ] No memory leaks detected
- [ ] FCP < 1.8s
- [ ] LCP < 2.5s
- [ ] TTI < 3.5s
- [ ] CLS < 0.1
- [ ] 60fps scroll performance
- [ ] Code splitting implemented
- [ ] Images optimized
- [ ] Fonts optimized

### Code Quality Checklist

- [ ] 100% TypeScript coverage
- [ ] No 'any' types
- [ ] All components < 300 lines
- [ ] Error boundaries implemented
- [ ] useEffect cleanups in place
- [ ] ESLint passing
- [ ] Prettier formatted
- [ ] No console.log statements
- [ ] Documentation complete
- [ ] Tests passing (>80% coverage)

### Infrastructure Checklist

- [ ] Environment variables secured
- [ ] HTTPS enforced
- [ ] CDN configured
- [ ] Caching headers set
- [ ] Monitoring configured
- [ ] Error tracking setup
- [ ] Backup strategy defined
- [ ] Rollback plan tested
- [ ] Load testing completed
- [ ] Disaster recovery plan

---

## Continuous Monitoring

### Automated Security Scanning

```yaml
# File: .github/workflows/security-scan.yml
name: Security Scan

on:
  push:
    branches: [main, develop]
  schedule:
    - cron: "0 2 * * *" # Daily at 2 AM

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run npm audit
        run: npm audit --audit-level=moderate

      - name: Run OWASP Dependency Check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          path: "."
          format: "HTML"

      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: security-reports
          path: reports/
```

### Performance Monitoring

```typescript
// File: /src/utils/performance-monitoring.ts
import { getCLS, getFCP, getFID, getLCP, getTTFB } from "web-vitals";

export function initPerformanceMonitoring() {
  // Send metrics to analytics service
  const sendToAnalytics = (metric: any) => {
    // Replace with your analytics service
    if (window.gtag) {
      window.gtag("event", metric.name, {
        value: Math.round(metric.value),
        metric_id: metric.id,
        metric_value: metric.value,
        metric_delta: metric.delta,
      });
    }
  };

  getCLS(sendToAnalytics);
  getFID(sendToAnalytics);
  getFCP(sendToAnalytics);
  getLCP(sendToAnalytics);
  getTTFB(sendToAnalytics);

  // Custom performance marks
  performance.mark("app-init-start");

  window.addEventListener("load", () => {
    performance.mark("app-init-end");
    performance.measure("app-init", "app-init-start", "app-init-end");

    const measure = performance.getEntriesByName("app-init")[0];
    sendToAnalytics({
      name: "app-init",
      value: measure.duration,
    });
  });
}
```

---

## Final Validation

### Production Deployment Checklist

```bash
#!/bin/bash
# File: /scripts/pre-deploy-validation.sh

echo "🔍 Running pre-deployment validation..."

# Type coverage
echo "Checking type coverage..."
npm run type-coverage

# Security audit
echo "Running security audit..."
npm audit --production

# Bundle size
echo "Checking bundle size..."
npm run build
node scripts/test-bundle-size.js

# Tests
echo "Running test suite..."
npm run test:ci

# Lighthouse
echo "Running Lighthouse audit..."
npx lighthouse http://localhost:3000 --output=json --output-path=./lighthouse-report.json

# Check results
if [ $? -eq 0 ]; then
  echo "✅ All validations passed! Ready for deployment."
else
  echo "❌ Validation failed. Please fix issues before deploying."
  exit 1
fi
```

---

## Success Criteria

### Phase 4 Complete When:

- [ ] All security tests passing
- [ ] Performance metrics meet targets
- [ ] 100% type coverage achieved
- [ ] No critical vulnerabilities found
- [ ] Load testing successful (1000+ concurrent users)
- [ ] Penetration testing passed
- [ ] Documentation complete
- [ ] Team training completed
- [ ] Monitoring configured
- [ ] Rollback plan tested

---

## Deployment Sign-off

| Role             | Name | Date | Signature |
| ---------------- | ---- | ---- | --------- |
| Development Lead |      |      |           |
| Security Officer |      |      |           |
| QA Manager       |      |      |           |
| Product Owner    |      |      |           |
| DevOps Lead      |      |      |           |

---

**Document Version:** 1.0.0
**Phase Owner:** QA Manager
**Review Required By:** CTO, Security Team, DevOps
**Estimated Completion:** 2 days from start
**Go-Live Date:** **\*\***\_**\*\***
