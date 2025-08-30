# CI/CD Troubleshooting Guide

This guide provides comprehensive procedures for reproducing CI failures locally
and debugging performance/accessibility issues before they reach the CI
pipeline. This ensures faster development cycles and reduces CI build failures.

## Table of Contents

- [Overview](#overview)
- [Reproducing CI Environment Locally](#reproducing-ci-environment-locally)
- [Performance Gate Failures](#performance-gate-failures)
- [Accessibility Gate Failures](#accessibility-gate-failures)
- [Bundle Size Failures](#bundle-size-failures)
- [PWA Failures](#pwa-failures)
- [Test Failures](#test-failures)
- [Security Failures](#security-failures)
- [Deployment Failures](#deployment-failures)
- [CI Configuration Issues](#ci-configuration-issues)

## Overview

The Okaeri Resort System uses a multi-gate CI/CD pipeline with strict quality
requirements. Understanding how to reproduce and debug CI failures locally saves
time and ensures code quality before pushing to remote repositories.

### CI Pipeline Gates

1. **Quality Gates**: Linting, formatting, TypeScript, security audit
2. **Deterministic Tests**: Unit, integration, security tests
3. **Build & Performance Analysis**: Bundle analysis, performance budgets
4. **Security Scanning**: Secret scanning, dependency vulnerabilities
5. **Lighthouse Performance**: Core Web Vitals, mobile performance
6. **E2E Tests**: Cross-browser functional testing
7. **Deployment**: Vercel deployment with environment promotion

## Reproducing CI Environment Locally

### 1. Environment Setup

```bash
# Create CI-like environment
export CI=true
export NODE_ENV=production
export LIGHTHOUSE_SCORE_THRESHOLD=90
export MAX_BUNDLE_SIZE_KB=150
export MAX_VENDOR_SIZE_KB=200
export MAX_CSS_SIZE_KB=50

# Set deterministic test environment
export VITEST_DETERMINISTIC=true
export TEST_SCENARIO=STABLE
export TEST_TIMEOUT=30000
export TEST_SEED="stable-ci-seed-$(date +%Y%m%d)"
```

### 2. Run All CI Steps Locally

```bash
# Quality Gates
npm run lint -- --max-warnings 0
npm run format:check
npm run type-check
npm audit --audit-level=high --omit=dev

# Deterministic Tests
npm run test:coverage -- --reporter=json --outputFile=coverage.json --run --passWithNoTests
npm run test:db -- --run --reporter=json --outputFile=test-results.json
npm run verify:security

# Build & Performance Analysis
NODE_ENV=production npm run build
npm run perf:budget

# Security Scanning (manual equivalents)
npm audit --audit-level=high
# Note: TruffleHog and Snyk require actual tools/tokens

# Lighthouse Performance
npm run build && npm run preview &
sleep 10
lhci autorun

# E2E Tests
npm run test:e2e -- --reporter=html --output-dir=playwright-report

# Cleanup
killall node
```

### 3. CI-Specific Configurations

```javascript
// Create CI test configuration
// .env.ci
NODE_ENV = test;
VITE_USE_MOCK_API = true;
VITEST_DETERMINISTIC = true;
TEST_TIMEOUT = 30000;
TEST_SEED = stable - ci - seed;
PLAYWRIGHT_DETERMINISTIC = true;
```

```bash
# Use CI configuration
cp .env.ci .env.test
npm run test -- --run --config=vitest.config.ci.ts
```

## Performance Gate Failures

### 1. Bundle Size Exceeded

**Symptoms:**

```
❌ Main bundle exceeds budget: 125KB > 120KB
❌ Performance budget validation failed
```

**Local Debugging:**

```bash
# Check current bundle sizes
npm run build
find dist/assets -name "*.js" -exec du -k {} \; | sort -nr

# Analyze bundle composition
ANALYZE=true npm run build
open dist/bundle-analysis.html

# Check specific bundle sizes match CI
npm run perf:budget
```

**Common Causes & Fixes:**

```javascript
// 1. Large dependency imported entirely
// ❌ Bad
import * as lodash from "lodash";

// ✅ Good
import { debounce, throttle } from "lodash";

// 2. Missing dynamic imports
// ❌ Bad
import ExpensePage from "./pages/ExpensePage";

// ✅ Good
const ExpensePage = lazy(() => import("./pages/ExpensePage"));

// 3. Duplicate dependencies
// Check with bundle analyzer for duplicate React, date-fns, etc.
```

### 2. Core Web Vitals Failures

**Symptoms:**

```
✗ First Contentful Paint: 1.8s (> 1.5s limit)
✗ Largest Contentful Paint: 2.7s (> 2.5s limit)
✗ Total Blocking Time: 350ms (> 300ms limit)
```

**Local Debugging:**

```bash
# Test with exact CI network conditions
lighthouse http://localhost:4173 \
  --preset=mobile \
  --throttling.rttMs=300 \
  --throttling.downloadThroughputKbps=1474 \
  --throttling.uploadThroughputKbps=675 \
  --throttling.cpuSlowdownMultiplier=4 \
  --output=html \
  --output-path=./lighthouse-debug.html

# Test specific metrics
lighthouse http://localhost:4173 \
  --only-audits="first-contentful-paint,largest-contentful-paint,total-blocking-time" \
  --output=json \
  --output-path=./lighthouse-metrics.json
```

**Common Causes & Fixes:**

```javascript
// 1. Blocking JavaScript
// ❌ Bad
<script src="/large-library.js"></script>

// ✅ Good
<script src="/large-library.js" async></script>

// 2. Missing resource hints
// ✅ Add to index.html
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preconnect" href="https://api.okaeri.com">

// 3. Unoptimized images
// ✅ Use proper image optimization
<img src="/hero.webp" alt="Resort" loading="lazy" width="800" height="600">
```

### 3. Lighthouse Performance Score Below 90%

**Local Debugging:**

```bash
# Detailed performance audit
lighthouse http://localhost:4173 \
  --output=html \
  --output-path=./lighthouse-detailed.html \
  --view

# Focus on performance issues
lighthouse http://localhost:4173 \
  --only-categories=performance \
  --output=json \
  --output-path=./perf-debug.json

# Check specific performance issues
node -e "
const report = require('./perf-debug.json');
const audits = report.lhr.audits;
Object.entries(audits)
  .filter(([key, audit]) => audit.score !== null && audit.score < 0.9)
  .forEach(([key, audit]) => {
    console.log(\`❌ \${key}: \${audit.score * 100}% - \${audit.title}\`);
  });
"
```

## Accessibility Gate Failures

### 1. Accessibility Score Below 95%

**Symptoms:**

```
✗ Accessibility: 89/100 (< 95% required)
✗ 3 images missing alt attributes
✗ 2 buttons without accessible names
```

**Local Debugging:**

```bash
# Test accessibility locally
lighthouse http://localhost:4173 \
  --only-categories=accessibility \
  --output=html \
  --output-path=./a11y-debug.html

# Use axe-core for detailed analysis
axe http://localhost:4173 --exit

# Test specific routes
lighthouse http://localhost:4173/dashboard \
  --only-categories=accessibility \
  --output=json \
  --output-path=./a11y-dashboard.json
```

**Common Issues & Fixes:**

```jsx
// 1. Missing alt attributes
// ❌ Bad
<img src="/logo.png" />

// ✅ Good
<img src="/logo.png" alt="Okaeri Resort System" />

// 2. Buttons without accessible names
// ❌ Bad
<button><Icon name="close" /></button>

// ✅ Good
<button aria-label="Close modal"><Icon name="close" /></button>

// 3. Form inputs without labels
// ❌ Bad
<input type="email" placeholder="Email" />

// ✅ Good
<label htmlFor="email">Email Address</label>
<input type="email" id="email" />
```

### 2. Color Contrast Failures

**Local Testing:**

```bash
# Install contrast checker
npm install -g pa11y

# Test color contrast
pa11y http://localhost:4173 --include-notices --include-warnings

# Manual testing with DevTools
# 1. Open Chrome DevTools
# 2. Select element with text
# 3. Check Computed styles
# 4. Look for color contrast ratio in Accessibility panel
```

**Fixes:**

```css
/* ❌ Poor contrast (2.1:1) */
.text-gray-400 {
  color: #9ca3af; /* on white background */
}

/* ✅ Good contrast (4.5:1+) */
.text-gray-700 {
  color: #374151; /* on white background */
}

/* For large text (18pt+), 3:1 minimum */
.text-large {
  font-size: 18pt;
  color: #6b7280; /* 3.2:1 ratio - acceptable for large text */
}
```

### 3. Touch Target Issues

**Local Testing:**

```javascript
// Check touch target sizes
const touchTargets = document.querySelectorAll(
  'button, a, input[type="checkbox"]'
);
touchTargets.forEach((element) => {
  const rect = element.getBoundingClientRect();
  const minSize = Math.min(rect.width, rect.height);

  if (minSize < 44) {
    console.log(
      `❌ Touch target too small: ${element.tagName} - ${rect.width}x${rect.height}px`
    );
  }
});
```

**Fixes:**

```css
/* Ensure minimum touch target sizes */
.touch-target {
  min-width: 48px;
  min-height: 48px;
}

/* For smaller visual elements, add transparent padding */
.icon-button {
  padding: 12px; /* Creates 48px touch target for 24px icon */
}
```

## Bundle Size Failures

### 1. Analyzing Bundle Size Issues

**Local Analysis:**

```bash
# Generate bundle analysis
ANALYZE=true npm run build

# Check individual chunk sizes
node -e "
const fs = require('fs');
const path = require('path');
const distDir = './dist/assets';

fs.readdirSync(distDir)
  .filter(f => f.endsWith('.js'))
  .forEach(f => {
    const filePath = path.join(distDir, f);
    const stats = fs.statSync(filePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(\`\${f}: \${sizeKB}KB\`);
  });
"

# Check gzipped sizes (matches bundlesize config)
ls -la dist/assets/*.js | awk '{print $9, $5}' | while read file size; do
  gzipped=$(gzip -c "$file" | wc -c)
  echo "$(basename "$file"): ${gzipped} bytes ($(echo "scale=2; $gzipped/1024" | bc)KB gzipped)"
done
```

### 2. Common Bundle Optimizations

```javascript
// vite.config.ts optimizations
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Split large dependencies
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom")) {
              return "react-vendor";
            }
            if (id.includes("@radix-ui")) {
              return "ui-vendor";
            }
            if (id.includes("date-fns")) {
              return "utils-vendor";
            }
            return "vendor";
          }
        },
      },
    },
  },
});

// Dynamic imports for code splitting
const ExpensePage = lazy(() =>
  import("./pages/ExpensePage").then((module) => ({
    default: module.ExpensePage,
  }))
);

// Tree shaking optimization
// ❌ Bad
import * as dateFns from "date-fns";

// ✅ Good
import { format, addDays } from "date-fns";
```

## PWA Failures

### 1. Service Worker Issues

**Symptoms:**

```
✗ service-worker: Does not register a service worker
✗ installable-manifest: Web app manifest does not exist
```

**Local Debugging:**

```bash
# Check service worker registration
npm run build
npm run preview &
sleep 5

# Test in browser console:
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log('SW registrations:', registrations.length);
});

# Check manifest
curl http://localhost:4173/manifest.json | jq .

# Validate PWA
lighthouse http://localhost:4173 \
  --only-categories=pwa \
  --output=html \
  --output-path=./pwa-debug.html
```

**Common Fixes:**

```typescript
// Ensure service worker is enabled in production
// vite.config.ts
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    // Ensure globPatterns include all necessary files
    globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,webp,svg,woff2}']
  }
})

// Ensure manifest is complete
// public/manifest.json
{
  "name": "Okaeri Resort System",
  "short_name": "Okaeri Resort",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0F172A",
  "theme_color": "#0EA5E9",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

### 2. Offline Functionality Issues

**Testing:**

```javascript
// Test offline functionality
const testOffline = async () => {
  // Register SW and cache resources
  await navigator.serviceWorker.ready;

  // Simulate offline
  navigator.serviceWorker.controller.postMessage({
    type: "SIMULATE_OFFLINE",
  });

  // Test critical routes
  const routes = ["/", "/dashboard", "/bookings"];
  for (const route of routes) {
    try {
      const response = await fetch(route);
      console.log(`${route}: ${response.status === 200 ? "✓" : "✗"}`);
    } catch (error) {
      console.log(`${route}: ✗ (${error.message})`);
    }
  }
};
```

## Test Failures

### 1. Flaky Tests

**Symptoms:**

```
✗ test sometimes passes, sometimes fails
✗ timing-dependent test failures
✗ random test order causing failures
```

**Local Debugging:**

```bash
# Run tests multiple times to catch flakiness
for i in {1..10}; do
  echo "Test run $i"
  npm test -- --run --reporter=dot
done

# Run tests with deterministic settings
export VITEST_DETERMINISTIC=true
export TEST_SEED=fixed-seed
npm test -- --run --reporter=verbose

# Test specific failing test in isolation
npm test -- --run src/components/LoginForm.test.tsx

# Test with increased timeout
npm test -- --run --testTimeout=60000
```

**Common Fixes:**

```javascript
// 1. Use fake timers for time-dependent tests
vi.useFakeTimers();

test("debounced function works", async () => {
  const fn = vi.fn();
  const debounced = debounce(fn, 100);

  debounced();
  debounced();
  debounced();

  // Fast-forward time instead of waiting
  vi.advanceTimersByTime(100);

  expect(fn).toHaveBeenCalledTimes(1);
});

// 2. Wait for async operations properly
test("async operation completes", async () => {
  render(<AsyncComponent />);

  // ❌ Bad
  await wait(1000);

  // ✅ Good
  await waitFor(() => {
    expect(screen.getByText("Loaded")).toBeInTheDocument();
  });
});

// 3. Clean up after tests
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});
```

### 2. Memory Leaks in Tests

**Detection:**

```bash
# Run tests with memory monitoring
npm test -- --run --reporter=verbose --logHeapUsage

# Check for memory leaks
node --expose-gc --inspect=9229 node_modules/.bin/vitest --run
```

**Fixes:**

```javascript
// Properly cleanup subscriptions
afterEach(() => {
  // Clean up React Query cache
  queryClient.clear();

  // Clean up Zustand stores
  useAuthStore.setState(initialState);

  // Clean up DOM
  cleanup();

  // Clean up local storage
  localStorage.clear();
  sessionStorage.clear();
});
```

## Security Failures

### 1. Dependency Vulnerabilities

**Symptoms:**

```
❌ High-severity vulnerabilities found
found 3 vulnerabilities (1 moderate, 2 high)
```

**Local Analysis:**

```bash
# Check vulnerabilities
npm audit
npm audit --audit-level=high

# Generate detailed report
npm audit --json > audit-report.json

# Check specific dependency
npm audit --package=package-name

# Fix automatically
npm audit fix

# Force fix (caution: may break things)
npm audit fix --force
```

**Manual Resolution:**

```bash
# Update specific vulnerable package
npm update vulnerable-package

# Update to specific version
npm install vulnerable-package@^safe-version

# If no fix available, consider alternatives
npm uninstall vulnerable-package
npm install safer-alternative
```

### 2. Secret Scanning Issues

**Symptoms:**

```
❌ Potential secrets found in code
❌ API keys detected in source files
```

**Local Scanning:**

```bash
# Manual secret scanning
grep -r "sk_\|pk_\|secret\|password\|token" src/ --exclude-dir=node_modules

# Check environment files
find . -name ".env*" -not -name ".env.example" -exec grep -l "sk_\|pk_\|secret" {} \;

# Check git history for secrets
git log -p | grep -i "password\|secret\|key" | head -20
```

**Fixes:**

```javascript
// ❌ Bad - hardcoded secrets
const API_KEY = "sk_live_abcdef123456789";

// ✅ Good - use environment variables
const API_KEY = process.env.VITE_API_KEY;

// ✅ Better - validate environment variables
const requiredEnvVars = ["VITE_API_URL", "VITE_APP_ENV"];
requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});
```

### 3. CSP Header Violations

**Local Testing:**

```bash
# Test CSP headers
curl -I http://localhost:4173

# Should include:
# Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'
```

## Deployment Failures

### 1. Vercel Build Failures

**Local Reproduction:**

```bash
# Test Vercel build locally
npx vercel build

# Test with Vercel environment
vercel env pull .env.vercel.local
npm run build

# Test serverless functions
vercel dev
```

**Common Issues:**

```javascript
// 1. Missing environment variables
// Check vercel.json and ensure all required env vars are set

// 2. API route issues
// Ensure API routes follow Vercel file naming conventions
// api/auth/login.ts -> /api/auth/login

// 3. Build output issues
// Ensure dist/ directory is properly generated
// Check for missing assets or incorrect paths
```

### 2. Environment Configuration Issues

```bash
# Validate environment configurations
node -e "
const requiredVars = [
  'VITE_API_URL',
  'VITE_APP_VERSION',
  'DATABASE_URL',
  'JWT_SECRET'
];

requiredVars.forEach(envVar => {
  if (!process.env[envVar]) {
    console.log(\`❌ Missing: \${envVar}\`);
  } else {
    console.log(\`✅ Found: \${envVar}\`);
  }
});
"
```

## CI Configuration Issues

### 1. GitHub Actions Workflow Failures

**Local Testing:**

```bash
# Install act to run GitHub Actions locally
brew install act

# Run specific workflow
act -j quality-gates

# Run with secrets
act -j quality-gates -s GITHUB_TOKEN=your_token

# Debug workflow step by step
act -j quality-gates --verbose
```

### 2. Caching Issues

**Clear CI Cache:**

```bash
# Clear npm cache
npm cache clean --force

# Clear GitHub Actions cache (via UI or API)
# Go to GitHub repo -> Actions -> Caches

# Clear local cache
rm -rf node_modules
rm package-lock.json
npm install
```

### 3. Timeout Issues

**Common Timeouts:**

```yaml
# .github/workflows/ci.yml
- name: Install dependencies with retry
  run: |
    npm ci --prefer-offline --no-audit --progress=false || \
    npm ci --prefer-offline --no-audit --progress=false || \
    npm ci --no-audit --progress=false
  timeout-minutes: 10 # Increase if needed

- name: Run tests
  run: npm run test:coverage
  timeout-minutes: 15 # Adjust based on test suite size
```

## Quick Debugging Checklist

### Pre-Push Checklist

```bash
# 1. Quality Gates
npm run lint -- --max-warnings 0 && echo "✓ Linting passed"
npm run format:check && echo "✓ Formatting passed"
npm run type-check && echo "✓ TypeScript passed"

# 2. Tests
npm run test:coverage -- --run && echo "✓ Tests passed"

# 3. Build & Performance
npm run build && echo "✓ Build passed"
npm run perf:budget && echo "✓ Bundle size passed"

# 4. Security
npm audit --audit-level=high && echo "✓ Security passed"

# 5. Accessibility (if applicable)
npm run verify:accessibility && echo "✓ Accessibility passed"

echo "🚀 Ready to push!"
```

### Quick Fix Commands

```bash
# Fix formatting
npm run format

# Fix auto-fixable lint issues
npm run lint:fix

# Update dependencies
npm update

# Regenerate lock file
rm package-lock.json && npm install

# Clear all caches
npm cache clean --force
rm -rf node_modules .next dist
npm install
```

This troubleshooting guide helps identify and resolve CI failures quickly by
reproducing issues locally and providing targeted solutions for each type of
failure.
