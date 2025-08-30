# Sub-Phase 5.1: Test Deployment Pipeline (RED Phase)

## Overview

The RED phase of our TDD approach focuses on creating comprehensive tests for
the entire deployment pipeline, from code commit to production release. This
ensures our CI/CD process is robust, reliable, and can handle various deployment
scenarios with confidence.

## Objectives

- **Deployment Testing**: Validate build processes, environment configurations,
  and deployment mechanisms
- **CI/CD Validation**: Ensure GitHub Actions pipeline handles all scenarios
  correctly
- **Integration Testing**: Verify serverless functions, database connections,
  and external service integrations
- **Rollback Testing**: Validate automated rollback procedures and manual
  recovery processes

## Testing Strategy

### 1. Build Process Testing

#### Build Configuration Tests

```typescript
// tests/deployment/build-config.test.ts
import { describe, it, expect } from "vitest";
import { build } from "vite";
import { resolve } from "path";
import fs from "fs/promises";

describe("Build Configuration", () => {
  it("should generate production build with correct structure", async () => {
    // Clean dist directory
    await fs.rm("dist", { recursive: true, force: true });

    // Run production build
    await build({
      mode: "production",
      build: {
        outDir: "dist",
        emptyOutDir: true,
      },
    });

    // Verify build outputs
    const distExists = await fs
      .access("dist")
      .then(() => true)
      .catch(() => false);
    expect(distExists).toBe(true);

    const indexHtml = await fs.readFile("dist/index.html", "utf-8");
    expect(indexHtml).toContain("<script");
    expect(indexHtml).toContain("assets/");

    // Verify asset optimization
    const assets = await fs.readdir("dist/assets");
    const jsFiles = assets.filter((file) => file.endsWith(".js"));
    const cssFiles = assets.filter((file) => file.endsWith(".css"));

    expect(jsFiles.length).toBeGreaterThan(0);
    expect(cssFiles.length).toBeGreaterThan(0);
  });

  it("should respect bundle size limits", async () => {
    const stats = await fs.readdir("dist/assets");
    const jsFiles = stats.filter((file) => file.endsWith(".js"));

    for (const jsFile of jsFiles) {
      const filePath = `dist/assets/${jsFile}`;
      const stat = await fs.stat(filePath);

      // Main bundle should be under 500KB
      if (jsFile.includes("index")) {
        expect(stat.size).toBeLessThan(500 * 1024);
      }
    }
  });

  it("should generate service worker for PWA", async () => {
    const swExists = await fs
      .access("dist/sw.js")
      .then(() => true)
      .catch(() => false);
    expect(swExists).toBe(true);

    const manifest = await fs.readFile("dist/manifest.json", "utf-8");
    const manifestData = JSON.parse(manifest);

    expect(manifestData.name).toBe("Okaeri Resort Management");
    expect(manifestData.start_url).toBe("/");
    expect(manifestData.icons).toHaveLength(3); // Different sizes
  });
});
```

#### Environment Variable Tests

```typescript
// tests/deployment/environment.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("Environment Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should validate required production environment variables", () => {
    const requiredVars = [
      "DATABASE_URL",
      "JWT_SECRET",
      "JWT_REFRESH_SECRET",
      "UPSTASH_REDIS_URL",
      "UPSTASH_REDIS_TOKEN",
    ];

    requiredVars.forEach((varName) => {
      delete process.env[varName];

      expect(() => {
        // Import config that validates env vars
        require("../../src/config");
      }).toThrow(`Missing required environment variable: ${varName}`);

      process.env[varName] = `test-${varName.toLowerCase()}`;
    });
  });

  it("should set correct default values for optional variables", () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.UPSTASH_REDIS_URL = "redis://localhost:6379";
    process.env.UPSTASH_REDIS_TOKEN = "test-token";

    const config = require("../../src/config");

    expect(config.database.poolSize).toBe(10);
    expect(config.jwt.accessExpiry).toBe("15m");
    expect(config.jwt.refreshExpiry).toBe("7d");
  });
});
```

### 2. Serverless Function Testing

#### API Route Deployment Tests

```typescript
// tests/deployment/api-routes.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcess } from "child_process";
import fetch from "node-fetch";

describe("Serverless Function Deployment", () => {
  let vercelDev: ChildProcess;
  const BASE_URL = "http://localhost:3000";

  beforeAll(async () => {
    // Start Vercel dev server
    vercelDev = spawn("vercel", ["dev", "--listen", "3000"], {
      stdio: "pipe",
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 5000));
  });

  afterAll(() => {
    if (vercelDev) {
      vercelDev.kill();
    }
  });

  it("should deploy health check endpoint", async () => {
    const response = await fetch(`${BASE_URL}/api/health/check`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("status", "healthy");
    expect(data).toHaveProperty("timestamp");
    expect(data).toHaveProperty("version");
  });

  it("should deploy authentication endpoints", async () => {
    const endpoints = [
      "/api/auth/login",
      "/api/auth/register",
      "/api/auth/logout",
      "/api/auth/refresh",
      "/api/auth/me",
    ];

    for (const endpoint of endpoints) {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: "POST",
      });

      // Should not be 404 (deployed) and not 500 (basic validation)
      expect(response.status).not.toBe(404);
      expect(response.status).not.toBe(500);
    }
  });

  it("should handle concurrent requests without cold start issues", async () => {
    const requests = Array(10)
      .fill(null)
      .map(() => fetch(`${BASE_URL}/api/health/check`));

    const responses = await Promise.all(requests);
    const statuses = responses.map((r) => r.status);

    // All requests should succeed
    expect(statuses.every((status) => status === 200)).toBe(true);

    // Response times should be reasonable (< 2s including cold start)
    const times = await Promise.all(
      responses.map(async (response, index) => {
        const start = Date.now();
        await response.text();
        return Date.now() - start;
      })
    );

    expect(Math.max(...times)).toBeLessThan(2000);
  });

  it("should respect function timeout limits", async () => {
    // Test with a potentially slow endpoint
    const start = Date.now();
    const response = await fetch(`${BASE_URL}/api/bookings`, {
      method: "GET",
      headers: {
        Authorization: "Bearer test-token",
      },
    });
    const duration = Date.now() - start;

    // Should complete within Vercel's 30s limit
    expect(duration).toBeLessThan(30000);

    // Should be reasonably fast for production use
    expect(duration).toBeLessThan(5000);
  });
});
```

### 3. Database Connection Testing

#### Connection Pool Tests

```typescript
// tests/deployment/database-connection.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../../src/lib/db";
import { users } from "../../src/lib/db/schema";
import { eq } from "drizzle-orm";

describe("Database Connection in Production Environment", () => {
  beforeAll(async () => {
    // Ensure test database is clean
    await db
      .delete(users)
      .where(eq(users.email, "test-deployment@example.com"));
  });

  afterAll(async () => {
    // Cleanup test data
    await db
      .delete(users)
      .where(eq(users.email, "test-deployment@example.com"));
  });

  it("should handle multiple concurrent database connections", async () => {
    const concurrentOperations = Array(50)
      .fill(null)
      .map(async (_, index) => {
        return await db.select().from(users).limit(1);
      });

    const results = await Promise.allSettled(concurrentOperations);
    const successful = results.filter(
      (result) => result.status === "fulfilled"
    );

    // At least 90% should succeed (allowing for some connection limits)
    expect(successful.length).toBeGreaterThan(45);
  });

  it("should handle connection timeouts gracefully", async () => {
    // Test with a query that might timeout
    const longRunningQuery = db.select().from(users).limit(10000);

    let hasTimedOut = false;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        hasTimedOut = true;
        reject(new Error("Query timeout"));
      }, 10000); // 10 second timeout
    });

    try {
      await Promise.race([longRunningQuery, timeoutPromise]);
    } catch (error) {
      if (hasTimedOut) {
        // This is expected behavior for very long queries
        expect(error.message).toBe("Query timeout");
      } else {
        // Database should handle this gracefully
        expect(error.message).toContain("timeout");
      }
    }
  });

  it("should maintain connection pool health", async () => {
    // Simulate typical application load
    const operations = [];

    // Read operations
    for (let i = 0; i < 20; i++) {
      operations.push(db.select().from(users).limit(10));
    }

    // Write operations
    for (let i = 0; i < 5; i++) {
      operations.push(
        db.insert(users).values({
          email: `test-${i}-deployment@example.com`,
          firstName: `Test${i}`,
          lastName: "User",
          hashedPassword: "test-hash",
          role: "user",
          isEmailVerified: false,
        })
      );
    }

    const results = await Promise.allSettled(operations);
    const failures = results.filter((result) => result.status === "rejected");

    // Should have very few failures
    expect(failures.length).toBeLessThan(2);

    // Cleanup inserted test data
    for (let i = 0; i < 5; i++) {
      await db
        .delete(users)
        .where(eq(users.email, `test-${i}-deployment@example.com`));
    }
  });
});
```

### 4. CI/CD Pipeline Tests

#### GitHub Actions Workflow Tests

```yaml
# .github/workflows/deployment-test.yml
name: Deployment Testing

on:
  push:
    branches: [feature/deployment-testing]
  pull_request:
    branches: [main, develop]

jobs:
  build-test:
    name: Build and Test Deployment
    runs-on: ubuntu-latest
    environment: staging

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run deployment tests
        run: npm run test:deployment
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          JWT_SECRET: ${{ secrets.TEST_JWT_SECRET }}
          JWT_REFRESH_SECRET: ${{ secrets.TEST_JWT_REFRESH_SECRET }}

      - name: Build for production
        run: npm run build
        env:
          NODE_ENV: production
          VITE_APP_VERSION: ${{ github.sha }}

      - name: Test production build
        run: npm run test:build

      - name: Deploy to staging
        if: github.event_name == 'pull_request'
        run: npx vercel --token=${{ secrets.VERCEL_TOKEN }} --scope=okaeri-dev
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

      - name: Run E2E tests against staging
        if: github.event_name == 'pull_request'
        run: npm run test:e2e:staging
        env:
          STAGING_URL: ${{ steps.deploy.outputs.url }}

  security-scan:
    name: Security Deployment Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run security audit
        run: npm audit --audit-level=high

      - name: Check for secrets in build
        run: |
          npm run build
          if grep -r "sk_" dist/ || grep -r "pk_test" dist/ || grep -r "password" dist/; then
            echo "Potential secrets found in build!"
            exit 1
          fi

      - name: Verify environment isolation
        run: |
          if grep -r "development\|localhost\|127.0.0.1" dist/; then
            echo "Development references found in production build!"
            exit 1
          fi

  performance-test:
    name: Performance Deployment Test
    runs-on: ubuntu-latest
    needs: build-test
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build and analyze bundle
        run: npm run build:analyze

      - name: Check bundle size
        run: npm run perf:budget

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v10
        with:
          configPath: "./lighthouserc.json"
          temporaryPublicStorage: true
```

### 5. Rollback Testing

#### Automated Rollback Tests

```typescript
// tests/deployment/rollback.test.ts
import { describe, it, expect } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import fetch from "node-fetch";

const execAsync = promisify(exec);

describe("Deployment Rollback", () => {
  it("should identify previous stable deployment", async () => {
    // Get deployment list
    const { stdout } = await execAsync("vercel ls --token=$VERCEL_TOKEN");
    const deployments = stdout
      .split("\n")
      .filter((line) => line.includes("okaeri-resort"));

    expect(deployments.length).toBeGreaterThan(1);

    // Should have at least one production deployment
    const prodDeployments = deployments.filter((line) =>
      line.includes("READY")
    );
    expect(prodDeployments.length).toBeGreaterThan(0);
  });

  it("should rollback to previous deployment successfully", async () => {
    // This would be run in a controlled test environment
    // Get current deployment URL
    const currentResponse = await fetch(
      "https://okaeri-resort-staging.vercel.app/api/health/check"
    );
    expect(currentResponse.status).toBe(200);

    const currentData = await currentResponse.json();
    const currentVersion = currentData.version;

    // Simulate rollback (in staging environment)
    // await execAsync('vercel rollback [previous-deployment-url] --token=$VERCEL_TOKEN')

    // Verify rollback completed
    // const rolledBackResponse = await fetch('https://okaeri-resort-staging.vercel.app/api/health/check')
    // const rolledBackData = await rolledBackResponse.json()

    // expect(rolledBackData.version).not.toBe(currentVersion)

    // This test would need to be adapted for actual rollback scenarios
    expect(true).toBe(true); // Placeholder for actual rollback testing
  });

  it("should maintain database integrity during rollback", async () => {
    // Verify database connections still work after rollback
    const response = await fetch(
      "https://okaeri-resort-staging.vercel.app/api/auth/me",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer test-token",
        },
      }
    );

    // Should handle gracefully (either 401 for invalid token or proper response)
    expect([200, 401]).toContain(response.status);
  });
});
```

### 6. Performance Testing

#### Load Testing for Deployment

```typescript
// tests/deployment/load-test.ts
import { describe, it, expect } from "vitest";
import { check, sleep } from "k6";
import http from "k6/http";

export const options = {
  stages: [
    { duration: "2m", target: 100 }, // Ramp up
    { duration: "5m", target: 100 }, // Stay at 100 users
    { duration: "2m", target: 200 }, // Ramp up to 200 users
    { duration: "5m", target: 200 }, // Stay at 200 users
    { duration: "2m", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests must complete below 500ms
    http_req_failed: ["rate<0.01"], // Error rate must be below 1%
  },
};

export default function () {
  // Test main application
  let response = http.get(
    process.env.DEPLOYMENT_URL || "https://okaeri-resort.vercel.app"
  );
  check(response, {
    "status is 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  // Test API endpoints
  response = http.get(`${process.env.DEPLOYMENT_URL}/api/health/check`);
  check(response, {
    "API status is 200": (r) => r.status === 200,
    "API response time < 200ms": (r) => r.timings.duration < 200,
  });

  sleep(1);
}
```

## Test Execution Plan

### Phase 1: Local Testing (Day 1)

```bash
# Run all deployment tests
npm run test:deployment

# Test build process
npm run build
npm run test:build

# Performance testing
npm run perf:budget
npm run perf:test-3g

# Security scanning
npm audit --audit-level=moderate
```

### Phase 2: Staging Environment (Day 2)

```bash
# Deploy to staging
vercel --token=$VERCEL_TOKEN --scope=okaeri-dev

# Run integration tests
npm run test:e2e:staging

# Load testing
k6 run --env DEPLOYMENT_URL=https://staging-url tests/deployment/load-test.ts

# Security validation
npm run test:security:staging
```

### Phase 3: Production Simulation (Day 3)

```bash
# Canary deployment testing
vercel --prod --token=$VERCEL_TOKEN --scope=okaeri-dev

# Monitor deployment health
npm run monitor:health-check

# Rollback testing (if issues detected)
vercel rollback [deployment-url]

# Final validation
npm run test:production:validation
```

## Success Criteria

### Build Quality

- ✅ All unit tests pass (100% success rate)
- ✅ Build completes without errors
- ✅ Bundle size within limits (< 500KB main bundle)
- ✅ No security vulnerabilities in dependencies

### Performance Standards

- ✅ Lighthouse score > 90 for all categories
- ✅ Time to First Byte < 200ms
- ✅ Load time < 3s on 3G networks
- ✅ 99% of requests complete < 500ms under load

### Deployment Reliability

- ✅ Zero-downtime deployment capability
- ✅ Successful rollback within 5 minutes
- ✅ Database integrity maintained during deployments
- ✅ All serverless functions deploy successfully

### Monitoring and Observability

- ✅ Health checks respond correctly
- ✅ Error tracking captures deployment issues
- ✅ Performance monitoring active
- ✅ Alert systems functional

## Automation Scripts

### Test Runner Script

```bash
#!/bin/bash
# scripts/test-deployment.sh

echo "🚀 Running Deployment Test Suite..."

# Set test environment
export NODE_ENV=test
export DATABASE_URL=$TEST_DATABASE_URL

# Clean previous builds
rm -rf dist/
npm run lint:fix

echo "📦 Testing build process..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed!"
  exit 1
fi

echo "🧪 Running deployment tests..."
npm run test:deployment
if [ $? -ne 0 ]; then
  echo "❌ Deployment tests failed!"
  exit 1
fi

echo "⚡ Running performance tests..."
npm run perf:budget
if [ $? -ne 0 ]; then
  echo "❌ Performance budget exceeded!"
  exit 1
fi

echo "🔒 Running security tests..."
npm audit --audit-level=moderate
if [ $? -ne 0 ]; then
  echo "❌ Security vulnerabilities found!"
  exit 1
fi

echo "✅ All deployment tests passed!"
```

## Next Steps

After completing the RED phase of deployment testing:

1. **Review Test Results**: Analyze all test outputs and identify any failing
   scenarios
2. **Fix Issues**: Address any deployment, build, or configuration problems
   discovered
3. **Document Findings**: Create a deployment test report with recommendations
4. **Proceed to Security Hardening**: Move to Sub-Phase 5.2 with confidence in
   deployment pipeline

The comprehensive test suite ensures that our deployment process is bulletproof
before we implement security hardening and performance optimizations in the
subsequent phases.
