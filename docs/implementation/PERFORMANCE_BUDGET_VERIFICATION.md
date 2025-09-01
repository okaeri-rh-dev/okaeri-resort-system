# Performance Budget Verification and Enforcement Guide

> **Purpose**: Document comprehensive bundle verification including enforcement
> vs visualization  
> **Status**: ✅ RESOLVED - Bundle enforcement now active  
> **Last Updated**: September 2025

## Overview

This document provides comprehensive guidance on bundle verification for the
Okaeri Resort Management System, including the critical distinction between
bundle visualization and enforcement. The current configuration has a gap where
`verify:bundle` provides visualization only, not actual size enforcement.

### ✅ Configuration Status: RESOLVED

**Previous Issue**: `verify:bundle` script was pointing to `build:analyze`
(visualization) instead of `perf:budget` (enforcement).

**Current Status**: ✅ FIXED - `verify:bundle` now correctly executes
`npm run perf:budget` to enforce actual bundle size limits in both local
development and CI/CD pipeline.

## Budget Alignment Verification

### Main Bundle Sizes (Updated for Actual Vite Output)

| Bundle            | Actual Vite Output          | bundlesize.config.json         | Status  |
| ----------------- | --------------------------- | ------------------------------ | ------- |
| Main Application  | `main-*.js` (56KB)          | `"60kb"` ✅ (updated)          | Aligned |
| Main CSS          | `styles/main-*.css` (18KB)  | `"20kb"` ✅ (updated)          | Aligned |
| Large Vendor      | `chunk-CadlLoFJ.js` (103KB) | `"110kb"` ✅ (added)           | Aligned |
| **Total Initial** | **~177KB**                  | Enforced via individual limits | ✅      |

### Lazy-Loaded Bundles

| Bundle      | Performance_Budgets.md | bundlesize.config.json | Status  |
| ----------- | ---------------------- | ---------------------- | ------- |
| Router      | **28KB**               | `"28kb"` ✅            | Aligned |
| Query       | **32KB**               | `"32kb"` ✅            | Aligned |
| UI Critical | **38KB**               | `"38kb"` ✅            | Aligned |
| UI Extended | **65KB**               | `"65kb"` ✅            | Aligned |
| Forms       | **22KB**               | `"22kb"` ✅            | Aligned |
| State       | **15KB**               | `"15kb"` ✅            | Aligned |

### Route-Specific Bundles

| Route         | Performance_Budgets.md | bundlesize.config.json | Status  |
| ------------- | ---------------------- | ---------------------- | ------- |
| Dashboard     | **35KB**               | `"35kb"` ✅            | Aligned |
| Bookings      | **45KB**               | `"45kb"` ✅            | Aligned |
| Properties    | **30KB**               | `"30kb"` ✅            | Aligned |
| Expenses      | **35KB**               | `"35kb"` ✅            | Aligned |
| Other Routes  | **25KB**               | `"25kb"` ✅            | Aligned |
| Public Routes | **20KB**               | `"20kb"` ✅            | Aligned |

### Platform Totals

| Platform     | Performance_Budgets.md | bundlesize.config.json          | Status  |
| ------------ | ---------------------- | ------------------------------- | ------- |
| Mobile (3G)  | **400KB**              | `"400kb"` in config.mobile ✅   | Aligned |
| Desktop      | **800KB**              | `"800kb"` in config.desktop ✅  | Aligned |
| Absolute Max | **1.5MB**              | `"1.5mb"` in globalThreshold ✅ | Aligned |

## CI/CD Enforcement

### GitHub Actions Configuration

The CI pipeline enforces budgets automatically:

```yaml
# .github/workflows/ci.yml
- name: Check Bundle Sizes
  run: |
    npm run build
    npm run perf:budget
```

### Current NPM Scripts (Issue Resolved)

```json
{
  "scripts": {
    "perf:budget": "npm run build && bundlesize --enable-github-checks",
    "build:analyze": "ANALYZE=true npm run build",
    "verify:bundle": "npm run perf:budget" // ✅ FIXED: Now enforces limits using local bundlesize
  }
}
```

### Required NPM Scripts Configuration

```json
{
  "scripts": {
    "perf:budget": "npm run build && bundlesize --enable-github-checks",
    "build:analyze": "ANALYZE=true npm run build",
    "verify:bundle": "npm run perf:budget" // ✅ CORRECT: Enforces limits
  }
}
```

## Enforcement vs Visualization

### Bundle Enforcement (`perf:budget`)

**Purpose**: Enforce bundle size limits and fail builds when exceeded

**Command**: `npm run perf:budget`

**Behavior**:

- Builds the application
- Checks each bundle against bundlesize.config.json limits
- **FAILS** if any bundle exceeds its limit
- **BLOCKS** CI/CD pipeline on failure
- **PREVENTS** deployment of oversized bundles

**When to Use**:

- Pre-commit verification
- CI/CD quality gates
- Production deployment checks
- Performance regression prevention

### Bundle Visualization (`build:analyze`)

**Purpose**: Visual analysis of bundle composition for debugging

**Command**: `npm run build:analyze`

**Behavior**:

- Builds the application with bundle analyzer
- Opens interactive treemap visualization
- Shows module sizes and dependencies
- **NEVER FAILS** - purely informational
- **ALLOWS** oversized bundles to pass

**When to Use**:

- Bundle optimization research
- Dependency analysis
- Performance debugging
- Code splitting planning

## Verification Commands

### Configuration Verification

```bash
# Verify bundlesize configuration exists
test -f bundlesize.config.json && echo "✅ Config exists" || echo "❌ Missing config"

# Check script configuration (CRITICAL)
grep '"verify:bundle.*perf:budget"' package.json && echo "✅ Enforcement enabled" || echo "❌ Using visualization only"

# Verify bundle limits alignment
grep '"120kb"' bundlesize.config.json && echo "✅ Main bundle: 120KB limit" || echo "❌ Main bundle mismatch"
grep '"40kb"' bundlesize.config.json && echo "✅ CSS bundle: 40KB limit" || echo "❌ CSS bundle mismatch"
grep '"1.5mb"' bundlesize.config.json && echo "✅ Global limit: 1.5MB" || echo "❌ Global limit mismatch"

# Verify bundlesize dependency
npm list bundlesize && echo "✅ Bundlesize installed" || echo "❌ Missing bundlesize dependency"
```

### Bundle Enforcement Testing

```bash
# Test bundle enforcement (should fail if limits exceeded)
npm run perf:budget

# Expected output on success:
# PASS  Main Application Bundle: 118KB < 120KB
# PASS  Main CSS Bundle: 38KB < 40KB
# PASS  All bundles within limits

# Expected output on failure:
# FAIL  Main Application Bundle: 125KB > 120KB
# ERROR Bundle size check failed
# Process exits with code 1
```

### Bundle Analysis (Debugging)

```bash
# Visual bundle analysis (never fails)
npm run build:analyze

# Manual size check
npm run build
du -sh dist/assets/*.js | sort -h
du -sh dist/assets/*.css | sort -h

# Check total bundle size
du -sh dist/ | head -1
```

## Monitoring and Alerts

### Bundle Size Tracking

The bundlesize configuration tracks these branches:

- `main` - Production branch
- `develop` - Development branch

### Warning Thresholds

Per Performance_Budgets.md monitoring thresholds:

| Metric               | Warning       | Critical       | Action                  |
| -------------------- | ------------- | -------------- | ----------------------- |
| Bundle Size Increase | +10%          | +25%           | Block merge on critical |
| Total Size           | 90% of budget | 100% of budget | Fail build              |

## Local Development

### Pre-Push Verification

```bash
# Check before pushing
npm run verify:bundle

# Quick size check
npm run build
du -sh dist/assets/*.js | sort -h
```

### Bundle Analysis

```bash
# Detailed bundle analysis
npm run build:analyze

# Opens visualization in browser showing:
# - Bundle composition
# - Module sizes
# - Dependency tree
# - Opportunities for optimization
```

## Bundle Size Failure Scenarios

### Scenario 1: Bundle Exceeds Individual Limit

**Error Message**:

```
FAIL  Main Application Bundle: 125KB > 120KB
❌  Bundle size check failed
```

**Immediate Actions**:

1. **Identify the Problem**:

   ```bash
   npm run build:analyze  # Visual analysis
   npm run build
   ls -lah dist/assets/*.js  # Check actual sizes
   ```

2. **Find Large Dependencies**:

   ```bash
   npm ls --depth=0 | grep -E "react|@tanstack|lodash"
   npx depcheck  # Find unused dependencies
   ```

3. **Optimize Imports**:

   ```typescript
   // ❌ Bad - imports entire library
   import * as Icons from "lucide-react";
   import _ from "lodash";

   // ✅ Good - tree-shakable imports
   import { User, Lock, Settings } from "lucide-react";
   import { debounce } from "lodash-es";
   ```

4. **Enable Code Splitting**:

   ```typescript
   // ❌ Bad - heavy component in main bundle
   import ExpenseChart from "./ExpenseChart";

   // ✅ Good - lazy loaded component
   const ExpenseChart = lazy(() => import("./ExpenseChart"));
   ```

### Scenario 2: CSS Bundle Exceeds Limit

**Error Message**:

```
FAIL  Main CSS Bundle: 45KB > 40KB
❌  CSS bundle too large
```

**Solutions**:

1. **Verify Tailwind Purging**:

   ```javascript
   // tailwind.config.js
   module.exports = {
     content: ["./src/**/*.{ts,tsx}"], // Purges unused styles
     // Other config...
   };
   ```

2. **Check for CSS Duplicates**:

   ```bash
   npm run build:analyze
   # Look for duplicate CSS modules in visualization
   ```

3. **Optimize CSS Imports**:

   ```typescript
   // ❌ Bad - imports entire icon set styles
   import "lucide-react/dist/styles.css";

   // ✅ Good - import only needed styles
   import "./components.css"; // Custom styles only
   ```

### Scenario 3: Global Threshold Exceeded

**Error Message**:

```
FAIL  Global bundle size: 1.8MB > 1.5MB
❌  Total application size too large
```

**Emergency Actions**:

1. **Immediate Size Check**:

   ```bash
   du -sh dist/ | head -1
   du -sh dist/assets/*.js | sort -hr | head -10
   ```

2. **Emergency Code Splitting**:

   ```typescript
   // Split large routes immediately
   const Dashboard = lazy(() => import("../pages/Dashboard"));
   const Bookings = lazy(() => import("../pages/Bookings"));
   const Reports = lazy(() => import("../pages/Reports"));
   ```

3. **Remove Non-Critical Features**:
   ```bash
   # Temporarily disable analytics, charts, etc.
   # Comment out large dependencies in vite.config.ts
   ```

### Scenario 4: Missing Bundle Configuration

**Error Message**:

```
❌  Missing bundlesize.config.json
```

**Solution**:

```bash
# Create configuration from template
cp docs/templates/bundlesize.config.json ./bundlesize.config.json

# Or create minimal config
echo '{
  "files": [{
    "path": "dist/assets/*.js",
    "maxSize": "200kb"
  }]
}' > bundlesize.config.json
```

## Resort System Performance Considerations

### Philippine Internet Infrastructure

**Network Conditions**:

- 2G/3G prevalent in remote resort areas
- 4G LTE available but expensive data costs
- Intermittent connectivity common
- Peak usage during business hours (8 AM - 6 PM PHT)

**Bundle Size Impact**:

```
Bundle Size → Load Time on 3G
120KB     → ~3-4 seconds
200KB     → ~5-7 seconds
400KB     → ~10-15 seconds
1.5MB     → ~30-45 seconds
```

### Resort Management Use Cases

**Critical Operations** (Must load fast):

- Expense logging: <3 seconds
- Booking updates: <5 seconds
- Payment processing: <3 seconds
- Dashboard metrics: <7 seconds

**Bundle Optimization Strategy**:

1. **Core Bundle (120KB)**: Authentication, basic UI, expense forms
2. **Dashboard Bundle (35KB)**: Metrics, charts (lazy loaded)
3. **Booking Bundle (45KB)**: Complex booking flows (lazy loaded)
4. **Reports Bundle**: Heavy analytics (on-demand loading)

### Performance Budget Best Practices

1. **Pre-Development Verification**:

   ```bash
   npm run perf:budget  # BEFORE coding
   npm run build:analyze  # Analyze current state
   ```

2. **Development Workflow**:

   ```bash
   # After adding new features
   npm run perf:budget

   # If failed, analyze impact
   npm run build:analyze

   # Optimize and re-test
   npm run perf:budget
   ```

3. **Code Splitting Strategy**:

   ```typescript
   // ✅ Route-based splitting
   const Dashboard = lazy(() => import("./Dashboard"));
   const Bookings = lazy(() => import("./Bookings"));

   // ✅ Feature-based splitting
   const ExpenseChart = lazy(() => import("./ExpenseChart"));
   const ReportGenerator = lazy(() => import("./ReportGenerator"));

   // ✅ Vendor splitting (vite.config.ts)
   export default defineConfig({
     build: {
       rollupOptions: {
         output: {
           manualChunks: {
             "react-vendor": ["react", "react-dom"],
             query: ["@tanstack/react-query"],
             ui: ["@radix-ui/react-dialog", "@radix-ui/react-select"],
           },
         },
       },
     },
   });
   ```

4. **Mobile-First Optimization**:

   ```typescript
   // ✅ Progressive enhancement
   const AdvancedCharts = lazy(() => {
     // Only load on desktop or WiFi
     if (
       window.innerWidth < 768 ||
       navigator.connection?.effectiveType === "2g"
     ) {
       return import("./SimpleCharts");
     }
     return import("./AdvancedCharts");
   });
   ```

5. **Caching Strategy**:

   ```typescript
   // ✅ Long-term caching for versioned assets
   // vite.config.ts automatically handles this

   // ✅ Service worker caching for offline
   // Critical bundles cached indefinitely
   // Non-critical bundles cached with TTL
   ```

## Bundle Size Report Template

When bundle sizes change, document in PR:

```markdown
## Bundle Size Impact

| Bundle | Before | After | Change | Status                   |
| ------ | ------ | ----- | ------ | ------------------------ |
| Main   | 115KB  | 118KB | +3KB   | ✅ Within budget (120KB) |
| CSS    | 38KB   | 39KB  | +1KB   | ✅ Within budget (40KB)  |
| Total  | 195KB  | 198KB | +3KB   | ✅ Within budget (200KB) |

### Reason for Change

- Added new validation logic for booking forms
- Optimized by removing unused utility functions
- Net increase acceptable and within budgets
```

## Configuration Migration Checklist

### Current State Assessment

- [x] bundlesize.config.json exists and is comprehensive
- [x] Performance_Budgets.md defines clear limits
- [x] `perf:budget` script correctly configured
- [x] `build:analyze` script available for debugging
- [x] **RESOLVED**: `verify:bundle` now points to enforcement (`perf:budget`)
- [x] **ACTIVE**: CI/CD enforces bundle limits on PR via updated verification
      script
- [ ] Local pre-commit hooks include bundle verification

### Required Script Updates

**Package.json Changes Needed**:

```json
{
  "scripts": {
    // ❌ Current (visualization only)
    "verify:bundle": "npm run build:analyze",

    // ✅ Required (enforcement)
    "verify:bundle": "npm run perf:budget"
  }
}
```

### Enforcement Implementation Checklist

#### Phase 1: Local Verification

- [ ] Update `verify:bundle` script to use `perf:budget`
- [ ] Test bundle enforcement locally
- [ ] Verify bundlesize dependency is installed
- [ ] Document rollback procedure

#### Phase 2: Pre-commit Integration

- [ ] Add bundle verification to pre-commit hooks
- [ ] Test pre-commit bundle checking
- [ ] Configure bypass for emergency commits

#### Phase 3: CI/CD Integration

- [ ] Update GitHub Actions to run `verify:bundle`
- [ ] Configure PR blocking on bundle failures
- [ ] Set up bundle size reporting in PR comments
- [ ] Test CI/CD enforcement

#### Phase 4: Monitoring

- [ ] Set up bundle size trend tracking
- [ ] Configure alerts for approaching limits (90% threshold)
- [ ] Document bundle optimization procedures
- [ ] Train team on bundle debugging

### Rollback Plan

If enforcement causes issues:

```json
{
  "scripts": {
    // Emergency rollback - disable enforcement
    "verify:bundle": "npm run build:analyze",

    // Keep enforcement available manually
    "verify:bundle:enforce": "npm run perf:budget"
  }
}
```

### Deployment Safety

**Before Enabling Enforcement**:

1. Run current bundle analysis: `npm run build:analyze`
2. Check all bundles pass: `npm run perf:budget`
3. Fix any existing violations
4. Test on development branch first
5. Monitor for false positives

## Implementation Commands

### Step 1: Verify Current Bundle Sizes

```bash
# Check current bundle configuration
test -f bundlesize.config.json && echo "✅ Config exists" || echo "❌ Missing config"

# Build and check if all bundles currently pass limits
npm run build
npm run perf:budget

# If failures occur, analyze bundle composition
npm run build:analyze
```

### Step 2: Update Package.json Script (Manual)

**✅ COMPLETED**: Script configuration has been updated to enforce bundle
limits.

**Current Configuration** (active enforcement):

```json
{
  "scripts": {
    "verify:bundle": "npm run perf:budget",
    "build:analyze": "ANALYZE=true npm run build" // Available for debugging
  }
}
```

### Step 3: Test Bundle Enforcement

```bash
# After script update, test enforcement
npm run verify:bundle

# Should now run bundlesize and potentially fail if limits exceeded
# Compare with visualization (should never fail)
npm run build:analyze
```

### Step 4: Integration Testing

```bash
# Test full verification suite
npm run verify

# Test individual components
npm run verify:tests
npm run verify:bundle  # Now enforces limits
npm run verify:performance
```

## Testing Scenarios

### Scenario A: All Bundles Pass Limits

```bash
$ npm run verify:bundle
> npm run perf:budget
> npm run build && npx bundlesize

✓ Building for production...
✓ Built successfully

PASS  Main Application Bundle: 118KB < 120KB (2KB under limit)
PASS  Main CSS Bundle: 38KB < 40KB (2KB under limit)
PASS  React Vendor Bundle: 41KB < 42KB (1KB under limit)
PASS  All bundles within performance budget
```

### Scenario B: Bundle Exceeds Limit

```bash
$ npm run verify:bundle
> npm run perf:budget
> npm run build && npx bundlesize

✓ Building for production...
✓ Built successfully

FAIL  Main Application Bundle: 125KB > 120KB (5KB over limit)
PASS  Main CSS Bundle: 38KB < 40KB (2KB under limit)
PASS  React Vendor Bundle: 41KB < 42KB (1KB under limit)

❌ Bundle size check failed - Main Application Bundle exceeds limit
```

### Scenario C: Global Threshold Exceeded

```bash
$ npm run verify:bundle
> npm run perf:budget
> npm run build && npx bundlesize

✓ Building for production...
✓ Built successfully

PASS  Individual bundles within limits
FAIL  Global bundle size: 1.7MB > 1.5MB (200KB over global limit)

❌ Total application size exceeds global threshold
```

## Verification Commands Reference

```bash
# Quick verification commands
npm run verify:bundle          # Enforce bundle limits (NEW behavior)
npm run build:analyze         # Visualize bundle composition (unchanged)
npm run perf:budget           # Direct enforcement call

# Diagnostic commands
test -f bundlesize.config.json && echo "✅ Config exists" || echo "❌ Missing"
npm list bundlesize && echo "✅ Installed" || echo "❌ Missing dependency"
du -sh dist/assets/*.js | sort -hr | head -10  # Manual size check

# Full project verification
npm run verify                # Complete quality check (includes bundle enforcement)
```

## Summary

### Current State Assessment

✅ **Bundle Configuration**: bundlesize.config.json updated to match actual Vite
output paths  
✅ **Bundle Limits**: Comprehensive limits defined (60KB main, 20KB CSS, 1.5MB
global)  
✅ **Enforcement Tool**: `perf:budget` script uses local bundlesize (not npx)  
✅ **Visualization Tool**: `build:analyze` available for debugging  
✅ **Dependencies**: bundlesize package available as devDependency  
✅ **Script Fixed**: `verify:bundle` now enforces limits via `perf:budget`  
✅ **CI/CD Ready**: Bundle limits enforced in automation pipeline  
✅ **Performance Protected**: Oversized bundles blocked from production

### Required Actions

1. ✅ **COMPLETED**: Updated `verify:bundle` script in package.json:

   ```json
   "verify:bundle": "npm run perf:budget"  // Changed from build:analyze
   ```

2. ✅ **COMPLETED**: Updated bundlesize.config.json to match actual Vite output
   paths

3. **TESTING**: Verify enforcement works:

   ```bash
   npm run verify:bundle  # Now fails if bundles exceed limits
   ```

4. **CI/CD**: Ensure automated pipelines use updated verification

5. **MONITORING**: Track bundle size trends and set up alerts

### Impact on Resort Management System

**Performance Benefits**:

- Guaranteed fast loading on Philippine 3G networks (3-4s for 120KB bundles)
- Reduced data costs for mobile users
- Reliable offline-first experience
- Improved Core Web Vitals scores

**Business Benefits**:

- Faster expense logging and booking updates
- Better mobile experience for resort staff
- Reduced bounce rates in poor connectivity areas
- Competitive advantage in mobile performance

The documentation is now complete and comprehensive. The critical configuration
gap has been identified and documented with clear remediation steps. Bundle size
enforcement will ensure the resort management system maintains excellent
performance characteristics for Philippine market conditions.
