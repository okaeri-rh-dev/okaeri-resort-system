# Performance Testing Guide (Gate 5)

This guide provides comprehensive procedures for reproducing performance tests
locally that match CI requirements. Performance testing is critical for the
Okaeri Resort Management System to ensure optimal user experience on Philippine
mobile networks.

## Table of Contents

- [Overview](#overview)
- [Performance Targets](#performance-targets)
- [Local Setup](#local-setup)
- [Core Web Vitals Testing](#core-web-vitals-testing)
- [Bundle Size Analysis](#bundle-size-analysis)
- [Network Simulation](#network-simulation)
- [Device Emulation](#device-emulation)
- [PWA Performance Testing](#pwa-performance-testing)
- [Resort-Specific Testing](#resort-specific-testing)
- [CI Parity](#ci-parity)
- [Troubleshooting](#troubleshooting)

## Overview

The Okaeri Resort System must perform optimally under challenging network
conditions typical of Philippine resort locations. Our performance testing
ensures:

- Fast loading on 3G networks (1.47 Mbps down/675 Kbps up)
- Efficient rendering on mid-range Android devices
- Optimal Core Web Vitals scores
- Effective bundle splitting and caching
- Smooth offline-to-online transitions

## Performance Targets

Based on CI configuration, all tests must meet these thresholds:

### Core Web Vitals

- **Lighthouse Performance Score**: ≥90%
- **First Contentful Paint (FCP)**: <1.5s
- **Largest Contentful Paint (LCP)**: <2.5s
- **Cumulative Layout Shift (CLS)**: <0.1
- **Total Blocking Time (TBT)**: <300ms
- **Speed Index**: <3s
- **Time to Interactive (TTI)**: <3s

### Bundle Size Limits (Gzipped)

- Main Application Bundle: 120KB
- Main CSS Bundle: 40KB
- React Vendor Bundle: 42KB
- Router Bundle: 28KB
- Query Bundle: 32KB
- UI Components (Critical): 38KB
- UI Components (Extended): 65KB
- Forms Bundle: 22KB
- Utilities Bundle: 18KB
- Icons Bundle: 25KB
- State Management: 15KB
- Dashboard Route: 35KB
- Bookings Route: 45KB
- Properties Route: 30KB
- Expenses Route: 35KB

### Network Performance

- **Total Byte Weight**: <1.6MB
- **Server Response Time**: <600ms
- **Network RTT**: <300ms
- **Main Thread Work**: <4s
- **JavaScript Boot-up Time**: <3.5s

## Local Setup

### Prerequisites

```bash
# Install required tools
npm install -g @lhci/cli@0.13.x
npm install -g bundlesize
npm install -g lighthouse

# Install project dependencies
npm ci
```

### Environment Configuration

```bash
# Create performance testing environment
cp .env.example .env.perf
echo "NODE_ENV=production" >> .env.perf
echo "VITE_API_URL=/api" >> .env.perf
echo "VITE_APP_VERSION=local-test" >> .env.perf
```

## Core Web Vitals Testing

### 1. Basic Lighthouse Testing

```bash
# Build the application
npm run build

# Start preview server
npm run preview &
sleep 5  # Wait for server to start

# Run basic Lighthouse audit
lighthouse http://localhost:4173 \
  --output=html \
  --output-path=./lighthouse-basic.html \
  --chrome-flags="--no-sandbox --disable-dev-shm-usage"
```

### 2. Philippine 3G Network Simulation

```bash
# Test with Philippine 3G conditions
lighthouse http://localhost:4173 \
  --throttling-method=devtools \
  --throttling.cpuSlowdownMultiplier=4 \
  --throttling.requestLatencyMs=300 \
  --throttling.downloadThroughputKbps=1474 \
  --throttling.uploadThroughputKbps=675 \
  --throttling.rttMs=300 \
  --output=html \
  --output-path=./lighthouse-3g.html
```

### 3. Mobile Device Testing

```bash
# Test on mobile viewport with device emulation
lighthouse http://localhost:4173 \
  --preset=mobile \
  --form-factor=mobile \
  --screenEmulation.mobile=true \
  --screenEmulation.width=412 \
  --screenEmulation.height=732 \
  --screenEmulation.deviceScaleFactor=2.625 \
  --emulated-user-agent="Mozilla/5.0 (Linux; Android 11; moto g power) AppleWebKit/537.36" \
  --output=json \
  --output-path=./lighthouse-mobile.json
```

### 4. Multi-Page Testing

```bash
# Test all critical routes
ROUTES=("/" "/login" "/dashboard" "/bookings" "/expenses" "/properties")

for route in "${ROUTES[@]}"; do
  echo "Testing route: $route"
  lighthouse "http://localhost:4173$route" \
    --output=json \
    --output-path="./lighthouse-$route.json" \
    --quiet
done
```

### 5. Using npm Scripts

```bash
# Use predefined performance scripts
npm run perf:audit          # Basic performance audit
npm run perf:test-3g        # Philippine 3G simulation
npm run verify:performance  # Full performance verification
```

## Bundle Size Analysis

### 1. Bundle Size Verification

```bash
# Check bundle sizes against budgets
npm run perf:budget

# Expected output should show all bundles within limits:
# ✓ Main Application Bundle: 98KB < 120KB
# ✓ Main CSS Bundle: 35KB < 40KB
# ✓ React Vendor Bundle: 38KB < 42KB
# ... etc
```

### 2. Bundle Analysis

```bash
# Generate detailed bundle analysis
ANALYZE=true npm run build

# This creates dist/bundle-analysis.html
# Open in browser to view bundle composition
open dist/bundle-analysis.html
```

### 3. Manual Bundle Inspection

```bash
# Check actual bundle sizes
npm run build
find dist/assets -name "*.js" -exec du -h {} \; | sort -hr
find dist/assets -name "*.css" -exec du -h {} \;

# Check gzipped sizes (matches CI)
find dist/assets -name "*.js" -exec gzip -c {} \; | wc -c
find dist/assets -name "*.css" -exec gzip -c {} \; | wc -c
```

### 4. Bundle Debugging

```bash
# Analyze specific chunks
npx webpack-bundle-analyzer dist/assets --host localhost --port 8888

# Or use Vite's built-in analyzer
npm run build:analyze
```

## Network Simulation

### 1. Chrome DevTools Method

1. Open Chrome DevTools
2. Go to Network tab
3. Click "No throttling" dropdown
4. Select "Add..." to create custom profile:
   - **Name**: "Philippines 3G"
   - **Download**: 1474 Kb/s
   - **Upload**: 675 Kb/s
   - **Latency**: 300ms

### 2. Command Line Network Testing

```bash
# Install network simulation tools (macOS)
brew install dummynet

# Create network delay (requires sudo)
sudo dnctl pipe 1 config delay 300ms
sudo dnctl pipe 2 config bw 1474Kb/s
sudo pfctl -f /etc/pf.conf
```

### 3. Using Lighthouse CI Configuration

```bash
# Run with exact CI network settings
lhci autorun --config=./lighthouserc.js

# Or use specific config
lighthouse http://localhost:4173 \
  --config-path=./lighthouse.config.js \
  --output=html \
  --output-path=./lighthouse-ci-match.html
```

## Device Emulation

### 1. Mid-Range Android Testing

```bash
# Emulate typical Philippine Android device (Moto G Power)
lighthouse http://localhost:4173 \
  --screenEmulation.mobile=true \
  --screenEmulation.width=412 \
  --screenEmulation.height=732 \
  --screenEmulation.deviceScaleFactor=2.625 \
  --throttling.cpuSlowdownMultiplier=4 \
  --emulated-user-agent="Mozilla/5.0 (Linux; Android 11; moto g power) AppleWebKit/537.36" \
  --output=json \
  --output-path=./lighthouse-android.json
```

### 2. Battery-Conscious Testing

```bash
# Test with reduced CPU performance
lighthouse http://localhost:4173 \
  --throttling.cpuSlowdownMultiplier=6 \
  --output=html \
  --output-path=./lighthouse-low-battery.html
```

### 3. Memory Constraints

```bash
# Test with memory pressure simulation
lighthouse http://localhost:4173 \
  --chrome-flags="--max_old_space_size=512 --no-sandbox" \
  --output=json \
  --output-path=./lighthouse-memory-constrained.json
```

## PWA Performance Testing

### 1. Service Worker Performance

```bash
# Test service worker caching effectiveness
lighthouse http://localhost:4173 \
  --only-categories=pwa \
  --output=html \
  --output-path=./lighthouse-pwa.html
```

### 2. Offline Performance Testing

```bash
# Start app and cache resources
npm run preview &
sleep 10

# Load page to cache resources
curl -s http://localhost:4173 > /dev/null

# Test offline scenario (requires custom script)
node scripts/test-offline-performance.js
```

### 3. Cache Hit Rate Testing

```bash
# Test cache effectiveness with repeated loads
lighthouse http://localhost:4173 \
  --disable-storage-reset \
  --output=json \
  --output-path=./lighthouse-cached.json
```

## Resort-Specific Testing

### 1. Dashboard Performance

```bash
# Test dashboard with data loading simulation
lighthouse http://localhost:4173/dashboard \
  --throttling.requestLatencyMs=500 \
  --output=html \
  --output-path=./lighthouse-dashboard.html
```

### 2. Booking Calendar Performance

```bash
# Test booking calendar with complex interactions
lighthouse http://localhost:4173/bookings \
  --output=html \
  --output-path=./lighthouse-bookings.html
```

### 3. Expense Upload Performance

```bash
# Test expense page (image upload simulation)
lighthouse http://localhost:4173/expenses \
  --output=html \
  --output-path=./lighthouse-expenses.html
```

### 4. Multi-Property Switching

```bash
# Test property switching performance
for property_id in {1..3}; do
  lighthouse "http://localhost:4173/properties/$property_id" \
    --output=json \
    --output-path="./lighthouse-property-$property_id.json"
done
```

## CI Parity

### 1. Exact CI Configuration

Use the exact Lighthouse CI configuration from the project:

```bash
# Copy CI configuration
cp lighthouserc.js lighthouserc.local.js

# Modify for local testing
sed -i 's/localhost:4173/localhost:4173/g' lighthouserc.local.js

# Run with CI config
lhci autorun --config=./lighthouserc.local.js
```

### 2. CI Environment Variables

```bash
# Set CI-like environment
export CI=true
export NODE_ENV=production
export LIGHTHOUSE_SCORE_THRESHOLD=90

# Run tests
npm run verify:performance
```

### 3. Multiple Runs (Like CI)

```bash
# Run multiple iterations for consistent results
for i in {1..3}; do
  echo "Run $i of 3"
  lighthouse http://localhost:4173 \
    --output=json \
    --output-path="./lighthouse-run-$i.json" \
    --quiet
done

# Average the results
node scripts/average-lighthouse-scores.js
```

### 4. Headless Testing

```bash
# Test in headless mode (matches CI)
lighthouse http://localhost:4173 \
  --chrome-flags="--headless --no-sandbox --disable-dev-shm-usage" \
  --output=html \
  --output-path=./lighthouse-headless.html
```

## Troubleshooting

### Common Performance Issues

#### 1. Bundle Size Exceeded

```bash
# Check which bundles are too large
npm run perf:budget

# Analyze bundle composition
ANALYZE=true npm run build
open dist/bundle-analysis.html

# Common fixes:
# - Move large dependencies to separate chunks
# - Use dynamic imports for less critical code
# - Check for duplicate dependencies
```

#### 2. Poor Core Web Vitals

```bash
# Check LCP issues
lighthouse http://localhost:4173 \
  --only-audits="largest-contentful-paint,preload-lcp-image" \
  --output=html \
  --output-path=./lighthouse-lcp-debug.html

# Check CLS issues
lighthouse http://localhost:4173 \
  --only-audits="cumulative-layout-shift,layout-shift-elements" \
  --output=html \
  --output-path=./lighthouse-cls-debug.html
```

#### 3. Network Issues

```bash
# Test server response time
curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:4173"

# Check for render-blocking resources
lighthouse http://localhost:4173 \
  --only-audits="render-blocking-resources" \
  --output=html \
  --output-path=./lighthouse-blocking.html
```

#### 4. JavaScript Issues

```bash
# Check for unused JavaScript
lighthouse http://localhost:4173 \
  --only-audits="unused-javascript,legacy-javascript" \
  --output=html \
  --output-path=./lighthouse-js-debug.html
```

### Performance Optimization Tips

#### 1. Route-Level Optimization

```javascript
// Use dynamic imports for route components
const BookingsPage = lazy(() => import("../pages/BookingsPage"));

// Preload critical routes
import { preloadRoute } from "@tanstack/react-router";
preloadRoute({ to: "/dashboard" });
```

#### 2. Image Optimization

```bash
# Optimize images before testing
npm install -g imagemin-cli
imagemin src/assets/*.{jpg,png} --out-dir=public/images --plugin=imagemin-webp
```

#### 3. Critical CSS Inlining

```bash
# Extract critical CSS
npm install -g critical
critical http://localhost:4173 --base dist --inline --css dist/assets/*.css
```

### Debugging Failed Tests

#### 1. Lighthouse Report Analysis

```javascript
// Parse Lighthouse JSON report
const report = require("./lighthouse-mobile.json");
console.log(
  "Performance Score:",
  report.lhr.categories.performance.score * 100
);

// Check specific metrics
const metrics = report.lhr.audits;
console.log("FCP:", metrics["first-contentful-paint"].numericValue);
console.log("LCP:", metrics["largest-contentful-paint"].numericValue);
```

#### 2. Bundle Analysis

```bash
# Check bundle sizes programmatically
node -e "
const fs = require('fs');
const path = require('path');
const distDir = './dist/assets';
fs.readdirSync(distDir)
  .filter(f => f.endsWith('.js'))
  .forEach(f => {
    const size = fs.statSync(path.join(distDir, f)).size;
    console.log(\`\${f}: \${(size/1024).toFixed(2)}KB\`);
  });
"
```

#### 3. Performance Monitoring

```bash
# Monitor performance during development
npm install -g perfbudget
perfbudget --budget=bundlesize.config.json --url=http://localhost:4173
```

## Expected Outputs

### Successful Performance Test

```
✓ Performance: 92/100
✓ First Contentful Paint: 1.2s
✓ Largest Contentful Paint: 2.1s
✓ Cumulative Layout Shift: 0.08
✓ Total Blocking Time: 245ms
✓ Speed Index: 2.8s
✓ Time to Interactive: 2.9s

Bundle Sizes:
✓ Main Bundle: 115KB < 120KB
✓ CSS Bundle: 38KB < 40KB
✓ Vendor Bundle: 40KB < 42KB
```

### Failed Performance Test

```
✗ Performance: 87/100 (< 90 required)
✗ First Contentful Paint: 1.8s (> 1.5s limit)
✓ Largest Contentful Paint: 2.3s
✗ Total Blocking Time: 350ms (> 300ms limit)

Bundle Sizes:
✗ Main Bundle: 125KB > 120KB limit
✓ CSS Bundle: 35KB < 40KB
```

This comprehensive guide ensures you can reproduce all performance tests locally
and debug any issues before CI runs.
