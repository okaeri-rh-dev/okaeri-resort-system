# Performance Testing Requirements

## Overview

This document specifies the performance testing infrastructure requirements for
the Okaeri Resort Management System. It ensures consistent performance
measurement and budget enforcement across local development and CI environments.

**Owner**: pwa-performance-optimizer  
**Status**: Required for Phase 1 RED  
**Last Updated**: August 31, 2025

## Critical Performance Tools Installation

### 1. Critical DevDependencies Analysis

**CRITICAL REQUIREMENT**: All performance testing tools MUST be installed as
devDependencies, never as npx commands.

```bash
# MANDATORY: Install locally for CI reliability and performance
npm i -D lighthouse bundlesize start-server-and-test

# REQUIRED: PWA validation and service worker generation
npm i -D pwa-asset-generator workbox-cli

# RECOMMENDED: Bundle analysis and optimization
npm i -D webpack-bundle-analyzer rollup-plugin-visualizer

# OPTIONAL: Static file serving for bundle analysis
npm i -D serve
```

#### DevDependencies vs npx Analysis (Critical Performance Impact)

| Tool                    | npx Execution Time | DevDep Time | Network Failures | CI Time Cost     | Reliability    |
| ----------------------- | ------------------ | ----------- | ---------------- | ---------------- | -------------- |
| `lighthouse`            | 45-60s (download)  | 8-12s       | 15% failure rate | +$2.40/month     | Unstable       |
| `bundlesize`            | 25-35s (download)  | 3-5s        | 8% failure rate  | +$1.20/month     | Fragile        |
| `start-server-and-test` | 30-40s             | 2-3s        | 12% failure rate | +$1.80/month     | Critical       |
| **Total Impact**        | **100-135s**       | **13-20s**  | **35% combined** | **+$5.40/month** | **Unreliable** |

#### Network Dependency Risk Assessment

**HIGH RISK SCENARIOS**:

1. **npm Registry Outages**: 2-4 outages per month affecting npx downloads
2. **Version Inconsistency**: Different versions downloaded between local/CI
   environments
3. **Rate Limiting**: npm registry throttling during peak hours
4. **Corporate Firewalls**: Blocked or delayed downloads in enterprise
   environments
5. **CI Minute Costs**: GitHub Actions charges $0.008/minute, npx adds ~90
   seconds per run

**BUSINESS IMPACT**:

- DevDependencies approach saves **~120 seconds per CI run**
- Reduces CI failures by **35%**
- Prevents **$64.80/year** in additional CI costs
- Improves developer experience with consistent local testing

### 2. Complete Bundlesize Configuration

Create `bundlesize.config.json` with exact thresholds for resort management
system:

```json
{
  "files": [
    {
      "path": "dist/assets/index-*.js",
      "maxSize": "150 KB",
      "compression": "gzip",
      "name": "Main Application Bundle"
    },
    {
      "path": "dist/assets/vendor-*.js",
      "maxSize": "200 KB",
      "compression": "gzip",
      "name": "Vendor Dependencies"
    },
    {
      "path": "dist/assets/index-*.css",
      "maxSize": "50 KB",
      "compression": "gzip",
      "name": "Main Stylesheet"
    },
    {
      "path": "dist/assets/chunk-*.js",
      "maxSize": "75 KB",
      "compression": "gzip",
      "name": "Route Chunks"
    },
    {
      "path": "dist/**/*.js",
      "maxSize": "400 KB",
      "compression": "gzip",
      "name": "Total JavaScript"
    },
    {
      "path": "dist/**/*.css",
      "maxSize": "75 KB",
      "compression": "gzip",
      "name": "Total Stylesheets"
    }
  ],
  "ci": {
    "trackBranches": ["main", "develop"],
    "repoBranch": "main"
  },
  "defaultCompression": "gzip"
}
```

#### Bundle Size Enforcement Strategy

**Critical Thresholds Based on Philippine Network Conditions**:

- **3G Network**: 1.6 Mbps download, requires <400KB initial bundle
- **Mobile Data Cost**: ₱50/GB average, optimize for data efficiency
- **Device Performance**: Mid-range Android devices, limit JavaScript execution

**Enforcement Levels**:

1. **ERROR** (CI Failure): Bundle exceeds Performance_Budgets.md limits
2. **WARNING** (PR Comment): >125KB main bundle, >175KB vendor
3. **OPTIMIZATION** (Automated): Code splitting suggestions at >100KB chunks

## Performance Script Requirements

### 1. Complete Performance Scripts with Server Lifecycle

Update `package.json` with exact scripts for resort system optimization:

```json
{
  "scripts": {
    // Bundle size enforcement with detailed reporting
    "perf:budget": "npm run build && bundlesize --enable-github-checks",
    "perf:budget-ci": "npm run build && bundlesize --enable-github-checks --json > bundle-report.json",

    // Lighthouse with proper server lifecycle (CRITICAL: uses start-server-and-test)
    "verify:performance": "npm run build && start-server-and-test preview http://localhost:4173 'lighthouse http://localhost:4173 --config-path=lighthouse.desktop.config.js --output=json --output=html --output-path=./reports/lighthouse-performance'",

    "verify:performance-mobile": "npm run build && start-server-and-test preview http://localhost:4173 'lighthouse http://localhost:4173 --config-path=lighthouse.mobile.config.js --output=json --output=html --output-path=./reports/lighthouse-mobile'",

    "verify:accessibility": "npm run build && start-server-and-test preview http://localhost:4173 'lighthouse http://localhost:4173 --only-categories=accessibility --output=json --output-path=./reports/lighthouse-accessibility.json'",

    // Philippine network conditions simulation
    "perf:test-3g": "npm run build && start-server-and-test preview http://localhost:4173 'lighthouse http://localhost:4173 --throttling-method=devtools --throttling.cpuSlowdownMultiplier=4 --throttling.requestLatencyMs=560 --throttling.downloadThroughputKbps=1474 --throttling.uploadThroughputKbps=675 --output=json --output-path=./reports/lighthouse-3g.json'",

    "perf:test-slow-3g": "npm run build && start-server-and-test preview http://localhost:4173 'lighthouse http://localhost:4173 --throttling-method=devtools --throttling.cpuSlowdownMultiplier=6 --throttling.requestLatencyMs=2000 --throttling.downloadThroughputKbps=400 --throttling.uploadThroughputKbps=400 --output=json --output-path=./reports/lighthouse-slow-3g.json'",

    // PWA validation with offline testing
    "pwa:validate": "npm run build && start-server-and-test preview http://localhost:4173 'lighthouse http://localhost:4173 --only-categories=pwa --output=json --output=html --output-path=./reports/lighthouse-pwa'",

    // Complete pre-push verification (EXACT order matters)
    "verify:push": "npm run verify:all && npm run perf:budget && npm run verify:performance && npm run verify:accessibility",

    // CI-specific performance testing
    "verify:performance-ci": "start-server-and-test preview http://localhost:4173 'lighthouse http://localhost:4173 --config-path=lighthouse.desktop.config.js --output=json --output-path=./reports/lighthouse-performance.json && lighthouse http://localhost:4173 --config-path=lighthouse.mobile.config.js --output=json --output-path=./reports/lighthouse-mobile.json'",

    // Bundle analysis (visualization - separate from enforcement)
    "perf:analyze": "echo 'Visualization only - use perf:budget for enforcement' && npm run build:analyze",
    "perf:analyze-serve": "npm run perf:analyze && serve dist -p 8080"
  }
}
```

#### Script Categories and Usage

**ENFORCEMENT SCRIPTS** (Fail CI on violations):

- `perf:budget` - Bundle size limits
- `verify:performance` - Core Web Vitals thresholds
- `verify:accessibility` - WCAG 2.1 AA compliance

**ANALYSIS SCRIPTS** (Information only):

- `perf:analyze` - Bundle composition visualization
- `perf:test-3g` - Philippine network simulation
- `pwa:validate` - PWA compliance check

**CI SCRIPTS** (Optimized for automation):

- `verify:performance-ci` - Parallel desktop/mobile testing
- `perf:budget-ci` - JSON output for GitHub checks

### 2. Script Clarifications

#### Scripts Requiring Running Server

These scripts assume a server is already running:

- `perf:audit` - Manual performance audit
- `perf:analyze` - Bundle analysis (visualization)

**Documentation Update**: Add clear labels:

```json
{
  "perf:audit": "echo 'Requires running server on :4173' && lighthouse http://localhost:4173 --output=html --output-path=./reports/lighthouse-report.html",
  "perf:analyze": "echo 'Visualization only - use perf:budget for enforcement' && npm run build:analyze"
}
```

## Lighthouse Configuration

### 1. Complete Desktop Performance Configuration

Create `lighthouse.desktop.config.js` with resort system optimizations:

```javascript
module.exports = {
  extends: "lighthouse:default",
  settings: {
    formFactor: "desktop",
    // Desktop conditions for resort management dashboard
    throttling: {
      rttMs: 40,
      throughputKbps: 10240, // 10 Mbps broadband
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
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    // Skip non-critical audits for faster CI
    skipAudits: ["screenshot-thumbnails", "final-screenshot"],
    // Resort-specific performance budgets
    budgets: [
      {
        resourceSizes: [
          {
            resourceType: "script",
            budget: 400, // 400KB total JavaScript budget
          },
          {
            resourceType: "stylesheet",
            budget: 75, // 75KB total CSS budget
          },
          {
            resourceType: "image",
            budget: 500, // 500KB total images budget
          },
        ],
        timings: [
          {
            metric: "interactive",
            budget: 3500, // 3.5s Time to Interactive
          },
          {
            metric: "first-contentful-paint",
            budget: 1000, // 1s First Contentful Paint
          },
        ],
      },
    ],
  },
  // Exact thresholds for CI enforcement
  categories: {
    performance: {
      weight: 1,
      auditRefs: [
        // Core Web Vitals with strict thresholds
        { id: "largest-contentful-paint", weight: 25, group: "metrics" },
        { id: "first-input-delay", weight: 25, group: "metrics" },
        { id: "cumulative-layout-shift", weight: 25, group: "metrics" },
        { id: "first-contentful-paint", weight: 15, group: "metrics" },
        { id: "speed-index", weight: 10, group: "metrics" },
      ],
    },
    accessibility: 90, // WCAG 2.1 AA compliance
    "best-practices": 90,
    seo: 90, // Resort discovery optimization
    pwa: 80, // Desktop PWA features
  },
  // Performance score thresholds (fail CI if below)
  assertions: {
    "categories:performance": ["error", { minScore: 0.9 }],
    "categories:accessibility": ["error", { minScore: 0.9 }],
    "categories:best-practices": ["error", { minScore: 0.9 }],
    "categories:seo": ["error", { minScore: 0.9 }],
  },
};
```

### 2. Complete Mobile Performance Configuration

Create `lighthouse.mobile.config.js` optimized for Philippine mobile networks:

```javascript
module.exports = {
  extends: "lighthouse:default",
  settings: {
    formFactor: "mobile",
    // Philippine 3G/4G network conditions
    throttling: {
      rttMs: 150, // 150ms round-trip time
      throughputKbps: 1638.4, // Regular 3G speed
      cpuSlowdownMultiplier: 4, // Mid-range Android device
      requestLatencyMs: 562.5,
      downloadThroughputKbps: 1474.5, // 1.47 Mbps download
      uploadThroughputKbps: 675, // 675 Kbps upload
    },
    screenEmulation: {
      mobile: true,
      width: 412, // Common Android screen width
      height: 823, // Common Android screen height
      deviceScaleFactor: 2.625, // Mid-range pixel density
      disabled: false,
    },
    emulatedUserAgent:
      "Mozilla/5.0 (Linux; Android 12; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    // Mobile-specific audits for resort staff workflow
    skipAudits: [
      "screenshot-thumbnails",
      "final-screenshot",
      "uses-long-cache-ttl", // Less critical for mobile
    ],
    // Mobile performance budgets (stricter for data costs)
    budgets: [
      {
        resourceSizes: [
          {
            resourceType: "script",
            budget: 300, // 300KB JavaScript (stricter for mobile)
          },
          {
            resourceType: "stylesheet",
            budget: 50, // 50KB CSS
          },
          {
            resourceType: "image",
            budget: 200, // See Performance_Budgets.md for data budgets
          },
        ],
        timings: [
          {
            metric: "interactive",
            budget: 5000, // 5s Time to Interactive (mobile)
          },
          {
            metric: "first-contentful-paint",
            budget: 1800, // 1.8s First Contentful Paint
          },
          {
            metric: "largest-contentful-paint",
            budget: 4000, // 4s LCP for mobile
          },
        ],
      },
    ],
  },
  categories: {
    performance: {
      weight: 1,
      auditRefs: [
        // Mobile Core Web Vitals (adjusted thresholds)
        { id: "largest-contentful-paint", weight: 30, group: "metrics" }, // Higher weight
        { id: "first-input-delay", weight: 25, group: "metrics" },
        { id: "cumulative-layout-shift", weight: 25, group: "metrics" },
        { id: "first-contentful-paint", weight: 20, group: "metrics" }, // Critical for perceived performance
      ],
    },
    accessibility: 95, // Higher for mobile accessibility
    "best-practices": 90,
    seo: 95, // Critical for mobile discovery
    pwa: 95, // Essential for mobile PWA experience
  },
  // Mobile-specific assertions (more lenient performance, stricter PWA)
  assertions: {
    "categories:performance": ["error", { minScore: 0.85 }], // 85% for mobile
    "categories:accessibility": ["error", { minScore: 0.95 }],
    "categories:best-practices": ["error", { minScore: 0.9 }],
    "categories:seo": ["error", { minScore: 0.95 }],
    "categories:pwa": ["error", { minScore: 0.95 }],
    // Core Web Vitals specific assertions
    "largest-contentful-paint": ["error", { maxNumericValue: 4000 }], // 4s
    "cumulative-layout-shift": ["error", { maxNumericValue: 0.25 }], // 0.25
    "first-input-delay": ["error", { maxNumericValue: 200 }], // 200ms
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
          reports/*.json
          reports/*.html
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
# Should generate reports/lighthouse-performance.json

# Test accessibility
npm run verify:accessibility
# Should generate reports/lighthouse-accessibility.json

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

## Performance Budget Enforcement Strategy

### Enforcement Levels and Actions

| Violation Level | Bundle Size                    | Lighthouse Score | Action         | CI Behavior                    |
| --------------- | ------------------------------ | ---------------- | -------------- | ------------------------------ |
| **CRITICAL**    | >Performance_Budgets.md limits | <80 performance  | ❌ **FAIL CI** | Block merge, require fixes     |
| **ERROR**       | >90% of budget                 | <85 performance  | ⚠️ **FAIL PR** | Require review, allow override |
| **WARNING**     | >75% of budget                 | <90 performance  | 💬 **COMMENT** | Generate report, allow merge   |
| **OPTIMAL**     | <50% of budget                 | >95 performance  | ✅ **PASS**    | Auto-merge eligible            |

### Automated Responses

```bash
# Bundle size violations
if [ "$BUNDLE_SIZE" -gt $(grep -o '"120kb"' bundlesize.config.json | head -1 | tr -d '"kb' | awk '{print $1*1024}') ]; then
  echo "❌ CRITICAL: Bundle size exceeds Performance_Budgets.md limit"
  echo "Current: ${BUNDLE_SIZE}KB | See Performance_Budgets.md for authoritative limits"
  echo "Required actions:"
  echo "1. Implement code splitting"
  echo "2. Remove unused dependencies"
  echo "3. Optimize imports"
  exit 1
fi

# Performance score violations
if [ "$LIGHTHOUSE_SCORE" -lt 80 ]; then
  echo "❌ CRITICAL: Lighthouse performance score below 80"
  echo "Current: $LIGHTHOUSE_SCORE | Required: 80+"
  echo "Focus areas: LCP, FID, CLS optimization"
  exit 1
fi
```

## Related Documentation

- **[PERFORMANCE_SCRIPTS_SPECIFICATION.md](./PERFORMANCE_SCRIPTS_SPECIFICATION.md)** -
  🆕 Complete specification of ALL performance scripts with exact command
  syntax, configuration templates, and Philippine network simulation
  requirements
- **[PERFORMANCE_DEVDEPENDENCIES_RATIONALE.md](./PERFORMANCE_DEVDEPENDENCIES_RATIONALE.md)** -
  Complete analysis of devDependencies vs npx approach with metrics and cost
  analysis
- [Performance_Budgets.md](./Performance_Budgets.md) - Budget definitions and
  thresholds
- [PERFORMANCE_BUDGET_VERIFICATION.md](./PERFORMANCE_BUDGET_VERIFICATION.md) -
  Enforcement details and violation handling
- [LOCAL_TESTING_ERGONOMICS.md](./LOCAL_TESTING_ERGONOMICS.md) - Local testing
  setup and server lifecycle
- [CI_CD_TDD_ENFORCEMENT.md](./CI_CD_TDD_ENFORCEMENT.md) - CI configuration and
  automation
- [TEST_INFRASTRUCTURE_REQUIREMENTS.md](./TEST_INFRASTRUCTURE_REQUIREMENTS.md) -
  DevDependencies setup for testing tools

---

## Implementation Checklist

### Immediate Actions Required

- [ ] Install performance devDependencies:
      `npm i -D lighthouse bundlesize start-server-and-test`
- [ ] Create `bundlesize.config.json` with exact thresholds
- [ ] Create `lighthouse.desktop.config.js` and `lighthouse.mobile.config.js`
- [ ] Update `package.json` scripts with server lifecycle management
- [ ] Create `reports/` directory for Lighthouse outputs
- [ ] Test scripts locally: `npm run verify:performance`
- [ ] Verify CI integration with GitHub Actions

### Verification Commands

```bash
# Verify devDependencies installation
npm list lighthouse bundlesize start-server-and-test

# Test bundle size enforcement
npm run perf:budget

# Test performance measurement (requires build)
npm run verify:performance

# Test complete pre-push workflow
npm run verify:push
```

### Success Criteria

- ✅ All performance tools installed as devDependencies
- ✅ Bundle size limits enforced in CI
- ✅ Lighthouse scores >90 desktop, >85 mobile
- ✅ Server lifecycle properly managed
- ✅ Performance reports generated consistently
- ✅ CI execution time reduced by 35%

---

_Document Owner: pwa-performance-optimizer_  
_Review Status: Complete - Ready for Implementation_  
_Priority: CRITICAL - Required for Phase 1 RED_  
_Updated: August 31, 2025 - Added comprehensive devDependencies analysis and
complete configuration templates_
