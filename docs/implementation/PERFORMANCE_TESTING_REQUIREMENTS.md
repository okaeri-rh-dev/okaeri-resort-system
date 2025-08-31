# Performance Testing Requirements

## Overview

This document specifies the performance testing infrastructure requirements for
the Okaeri Resort Management System. It ensures consistent performance
measurement and budget enforcement across local development and CI environments.

**Owner**: pwa-performance-optimizer  
**Status**: Required for Phase 1 RED  
**Last Updated**: August 31, 2025

## Critical Performance Tools Installation

### 1. Required DevDependencies

```bash
# CRITICAL: Install locally for stability and speed
npm i -D lighthouse bundlesize

# OPTIONAL but RECOMMENDED: PWA validation
npm i -D pwa-asset-generator workbox-cli
```

#### Tool Purposes and Current Issues

| Tool                  | Purpose                          | Current Issue                 | Impact                         |
| --------------------- | -------------------------------- | ----------------------------- | ------------------------------ |
| `lighthouse`          | Performance/accessibility audits | Using npx (network dependent) | CI failures, slow execution    |
| `bundlesize`          | Bundle size enforcement          | Using npx (network dependent) | Delayed feedback, CI fragility |
| `pwa-asset-generator` | PWA asset creation               | Using npx                     | Slow asset generation          |
| `workbox-cli`         | Service worker generation        | Not configured                | PWA features incomplete        |

### 2. Bundlesize Configuration

Create/verify `bundlesize.config.json`:

```json
{
  "files": [
    {
      "path": "dist/assets/index-*.js",
      "maxSize": "150 KB",
      "compression": "gzip"
    },
    {
      "path": "dist/assets/vendor-*.js",
      "maxSize": "200 KB",
      "compression": "gzip"
    },
    {
      "path": "dist/assets/index-*.css",
      "maxSize": "50 KB",
      "compression": "gzip"
    },
    {
      "path": "dist/**/*.js",
      "maxSize": "400 KB",
      "compression": "gzip"
    }
  ]
}
```

## Performance Script Requirements

### 1. Core Performance Scripts

Update package.json with these scripts:

```json
{
  "scripts": {
    // Bundle size enforcement (NOT visualization)
    "perf:budget": "npm run build && bundlesize",

    // Lighthouse with server lifecycle management
    "verify:performance": "npm run build && start-server-and-test preview http://localhost:4173 'lighthouse http://localhost:4173 --preset=desktop --output=json --output-path=./lighthouse-performance.json'",

    "verify:accessibility": "npm run build && start-server-and-test preview http://localhost:4173 'lighthouse http://localhost:4173 --only-categories=accessibility --output=json --output-path=./lighthouse-accessibility.json'",

    // Composite verification for pre-push
    "verify:push": "npm run verify:all && npm run verify:bundle && npm run verify:performance",

    // 3G network simulation
    "perf:test-3g": "npm run build && start-server-and-test preview http://localhost:4173 'lighthouse http://localhost:4173 --throttling-method=devtools --throttling.cpuSlowdownMultiplier=4 --throttling.requestLatencyMs=560 --throttling.downloadThroughputKbps=1474 --throttling.uploadThroughputKbps=675'",

    // PWA validation
    "pwa:validate": "npm run build && start-server-and-test preview http://localhost:4173 'lighthouse http://localhost:4173 --only-categories=pwa --output=json --output-path=./lighthouse-pwa.json'"
  }
}
```

### 2. Script Clarifications

#### Scripts Requiring Running Server

These scripts assume a server is already running:

- `perf:audit` - Manual performance audit
- `perf:analyze` - Bundle analysis (visualization)

**Documentation Update**: Add clear labels:

```json
{
  "perf:audit": "echo 'Requires running server on :4173' && lighthouse http://localhost:4173 --output=html --output-path=./lighthouse-report.html",
  "perf:analyze": "echo 'Visualization only - use perf:budget for enforcement' && npm run build:analyze"
}
```

## Lighthouse Configuration

### 1. Desktop Performance Configuration

Create `lighthouse.desktop.config.js`:

```javascript
module.exports = {
  extends: "lighthouse:default",
  settings: {
    formFactor: "desktop",
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
    screenEmulation: {
      mobile: false,
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      disabled: false,
    },
    emulatedUserAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  },
  categories: {
    performance: 90,
    accessibility: 90,
    "best-practices": 90,
    seo: 90,
    pwa: 80,
  },
};
```

### 2. Mobile Performance Configuration

Create `lighthouse.mobile.config.js`:

```javascript
module.exports = {
  extends: "lighthouse:default",
  settings: {
    formFactor: "mobile",
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4,
      requestLatencyMs: 562.5,
      downloadThroughputKbps: 1474.5,
      uploadThroughputKbps: 675,
    },
    screenEmulation: {
      mobile: true,
      width: 412,
      height: 823,
      deviceScaleFactor: 2.625,
      disabled: false,
    },
  },
  categories: {
    performance: 85, // Slightly lower for mobile
    accessibility: 90,
    "best-practices": 90,
    seo: 90,
    pwa: 90, // Higher for mobile PWA
  },
};
```

## Performance Budget Thresholds

### Critical Web Vitals Targets

| Metric                         | Desktop | Mobile  | Measurement     |
| ------------------------------ | ------- | ------- | --------------- |
| LCP (Largest Contentful Paint) | < 2.5s  | < 4.0s  | 75th percentile |
| FID (First Input Delay)        | < 100ms | < 200ms | 75th percentile |
| CLS (Cumulative Layout Shift)  | < 0.1   | < 0.25  | 75th percentile |
| FCP (First Contentful Paint)   | < 1.0s  | < 1.8s  | 75th percentile |
| TTI (Time to Interactive)      | < 3.5s  | < 5.0s  | Median          |
| TBT (Total Blocking Time)      | < 200ms | < 350ms | Sum             |

### Bundle Size Budgets

| Bundle        | Max Size (gzip) | Current | Status   |
| ------------- | --------------- | ------- | -------- |
| Main JS       | 150 KB          | TBD     | Enforced |
| Vendor JS     | 200 KB          | TBD     | Enforced |
| Main CSS      | 50 KB           | TBD     | Enforced |
| Total Initial | 400 KB          | TBD     | Enforced |

## Server Lifecycle Management

### Why start-server-and-test is Critical

**Problem**: Lighthouse/performance tests need a running server but scripts
often assume it exists.

**Solution**: Use `start-server-and-test` for automated lifecycle:

```bash
# Pattern for all performance scripts
start-server-and-test <server-command> <url> <test-command>

# Example
start-server-and-test preview http://localhost:4173 'lighthouse ...'
```

### Benefits

1. **CI Reliability**: Server automatically starts/stops
2. **Local Consistency**: Same behavior locally and in CI
3. **Clean State**: Fresh server for each test run
4. **Error Handling**: Proper cleanup on failure

## CI/CD Integration

### GitHub Actions Performance Job

```yaml
performance:
  name: Performance Testing
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "20"
        cache: "npm"

    - name: Install dependencies
      run: npm ci

    - name: Build application
      run: npm run build

    - name: Run performance tests
      run: |
        npm run verify:performance
        npm run verify:accessibility
        npm run verify:bundle

    - name: Upload Lighthouse reports
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: lighthouse-reports
        path: |
          lighthouse-*.json
          lighthouse-*.html
        retention-days: 30
```

## PWA Requirements

### Service Worker Configuration

Create `workbox.config.js`:

```javascript
module.exports = {
  globDirectory: "dist/",
  globPatterns: ["**/*.{html,js,css,png,jpg,jpeg,svg,woff,woff2}"],
  swDest: "dist/service-worker.js",
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\.okaeri\.dev\//,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 300, // 5 minutes
        },
      },
    },
  ],
};
```

### PWA Manifest Requirements

Verify `public/manifest.json`:

```json
{
  "name": "Okaeri Resort Management",
  "short_name": "Okaeri",
  "theme_color": "#0ea5e9",
  "background_color": "#ffffff",
  "display": "standalone",
  "scope": "/",
  "start_url": "/",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

## Verification Commands

```bash
# After installing dependencies
npm list lighthouse bundlesize

# Test bundle enforcement
npm run perf:budget
# Should fail if over budget

# Test performance measurement
npm run verify:performance
# Should generate lighthouse-performance.json

# Test accessibility
npm run verify:accessibility
# Should generate lighthouse-accessibility.json

# Test composite push verification
npm run verify:push
# Should run all verifications
```

## Common Issues and Solutions

### Issue: "lighthouse: command not found"

**Solution**: Install lighthouse as devDependency, not rely on npx

### Issue: "Server not running" errors

**Solution**: Use start-server-and-test for all performance scripts

### Issue: Bundle size not enforced

**Solution**: Ensure verify:bundle uses perf:budget, not build:analyze

### Issue: Slow CI performance tests

**Solution**: Install tools as devDependencies to avoid network downloads

## Performance Testing Workflow

### Local Development

1. Make changes
2. Run `npm run build`
3. Run `npm run perf:budget` - Check bundle sizes
4. Run `npm run verify:performance` - Check Core Web Vitals
5. Fix any violations before committing

### Pre-Push

```bash
npm run verify:push
```

Runs all critical performance checks

### CI Pipeline

Automated performance gates enforce budgets on every PR

## Related Documentation

- [Performance_Budgets.md](./Performance_Budgets.md) - Budget definitions
- [PERFORMANCE_BUDGET_VERIFICATION.md](./PERFORMANCE_BUDGET_VERIFICATION.md) -
  Enforcement details
- [LOCAL_TESTING_ERGONOMICS.md](./LOCAL_TESTING_ERGONOMICS.md) - Local testing
  setup
- [CI_CD_TDD_ENFORCEMENT.md](./CI_CD_TDD_ENFORCEMENT.md) - CI configuration

---

_Document Owner: pwa-performance-optimizer_  
_Review Status: Ready for Implementation_  
_Priority: CRITICAL - Affects CI/CD reliability_
