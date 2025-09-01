# Testing Documentation

Comprehensive testing procedures for the Okaeri Resort Management System, ensuring performance, accessibility, and PWA functionality across Gates 5 and 6 of our CI/CD pipeline.

## Overview

This documentation provides step-by-step procedures for reproducing all CI/CD tests locally, enabling developers to catch and fix issues before they reach the pipeline. The testing framework is specifically designed for the challenging network conditions and mobile-first requirements of Philippine resort management.

## Testing Guides

### 🚀 [Performance Testing Guide (Gate 5)](./PERFORMANCE_TESTING_GUIDE.md)
- **Core Web Vitals Testing**: FCP, LCP, CLS, TBT measurement procedures
- **Bundle Size Analysis**: Detailed bundle optimization and verification
- **Network Simulation**: Philippine 3G conditions testing
- **Device Emulation**: Mid-range Android device testing
- **Resort-Specific Performance**: Dashboard, booking, expense testing

**Key Targets:**
- Lighthouse Performance: ≥90%
- First Contentful Paint: <1.5s
- Bundle sizes per `bundlesize.config.json`

### ♿ [Accessibility Testing Guide (Gate 6)](./ACCESSIBILITY_TESTING_GUIDE.md)
- **Lighthouse Accessibility Testing**: WCAG 2.1 AA compliance
- **Axe-core Integration**: Runtime and CLI accessibility testing
- **Manual Testing Procedures**: Keyboard navigation and screen reader testing
- **Touch Target Validation**: 48x48px minimum touch targets
- **Color Contrast Testing**: 4.5:1 ratio verification

**Key Targets:**
- Lighthouse Accessibility: ≥95% (CI needs update from 90%)
- WCAG 2.1 AA compliance
- Full keyboard navigation support

### 📱 [PWA Testing Guide](./PWA_TESTING_GUIDE.md)
- **Service Worker Testing**: Cache strategy verification
- **Offline Functionality**: Offline-first testing procedures
- **App Installation**: Installation flow testing
- **Background Sync**: Offline data synchronization testing
- **Push Notifications**: Business alert notification testing

**Key Features:**
- Reliable offline functionality for poor connectivity
- Background sync for expense logging and bookings
- Native app-like installation experience

### 🔧 [CI Troubleshooting Guide](./CI_TROUBLESHOOTING_GUIDE.md)
- **Performance Gate Failures**: Bundle size and Core Web Vitals debugging
- **Accessibility Gate Failures**: A11y issue identification and fixes
- **Test Failures**: Flaky test debugging and memory leak detection
- **Security Failures**: Dependency vulnerability and secret scanning
- **Environment Reproduction**: Exact CI condition matching

## Quick Start

### Prerequisites

```bash
# Install testing tools
npm install -g @lhci/cli@0.13.x
npm install -g bundlesize
npm install -g @axe-core/cli
npm install -g pa11y

# Project setup
npm ci
```

### Run All Local Tests (CI Simulation)

```bash
# Set CI environment
export CI=true
export NODE_ENV=production

# 1. Quality Gates
npm run lint -- --max-warnings 0
npm run format:check
npm run type-check
npm audit --audit-level=high --omit=dev

# 2. Tests
npm run test:coverage -- --run
npm run verify:security

# 3. Build & Performance
npm run build
npm run perf:budget

# 4. Performance Testing
npm run preview &
sleep 10
lhci autorun

# 5. Accessibility Testing
npm run verify:accessibility

# 6. PWA Testing  
lighthouse http://localhost:4173 --only-categories=pwa

# 7. E2E Testing
npm run test:e2e

# Cleanup
killall node
```

## Performance Targets Summary

| Metric | Target | Current CI | Notes |
|--------|---------|------------|-------|
| **Performance Score** | ≥90% | ✅ 90% | Lighthouse overall score |
| **First Contentful Paint** | <1.5s | ✅ <1.5s | Critical for perceived performance |
| **Largest Contentful Paint** | <2.5s | ✅ <2.5s | Core Web Vital |
| **Cumulative Layout Shift** | <0.1 | ✅ <0.1 | Visual stability metric |
| **Total Blocking Time** | <300ms | ✅ <300ms | Interactivity metric |
| **Speed Index** | <3s | ✅ <3s | Visual progress metric |
| **Time to Interactive** | <3s | ✅ <3s | Full interactivity |

## Bundle Size Targets

**Note**: All bundle size targets are defined in [Performance_Budgets.md](../implementation/Performance_Budgets.md) - the authoritative source.

| Bundle | Target (Gzipped) | Purpose |
|--------|------------------|---------|
| **Main Application** | See Performance_Budgets.md | Core app functionality |
| **React Vendor** | See Performance_Budgets.md | React & React DOM |
| **UI Components (Critical)** | 38KB | Essential UI components |
| **UI Components (Extended)** | 65KB | Additional UI components |
| **Dashboard Route** | 35KB | Dashboard page code |
| **Bookings Route** | 45KB | Booking management |
| **Expenses Route** | 35KB | Expense tracking |
| **Total Global Threshold** | 1.5MB | Overall app size limit |

## Accessibility Targets

| Audit | Requirement | Current CI | Fix Needed |
|-------|-------------|------------|------------|
| **Accessibility Score** | ≥95% | ⚠️ 90% | Update CI config |
| **Color Contrast** | 4.5:1 normal, 3:1 large | ⚠️ warn | Should be error |
| **Touch Targets** | ≥48x48px (44px minimum) | ✅ error | Properly enforced |
| **ARIA Attributes** | Complete and valid | ✅ error | Properly enforced |
| **Alt Text** | All images | ✅ error | Properly enforced |
| **Form Labels** | All inputs labeled | ✅ error | Properly enforced |

## Resort-Specific Testing Considerations

### Network Conditions
- **Philippine 3G**: 1474 Kbps down, 675 Kbps up, 300ms RTT
- **Poor connectivity**: Intermittent connections common in resort locations
- **Mobile data costs**: Efficient data usage crucial

### Device Considerations  
- **Mid-range Android**: Moto G Power equivalent (typical staff device)
- **Battery constraints**: Optimize for battery-conscious usage
- **Touch targets**: Larger targets for mobile-first interface

### Business Operations
- **Expense logging**: Must work offline with background sync
- **Booking calendar**: Cached viewing for offline access
- **Dashboard metrics**: Background refresh with offline fallback
- **Multi-property**: Offline access to current property data
- **File uploads**: Queue receipts/photos when offline, sync when online

## Common Issues & Quick Fixes

### Bundle Size Issues
```bash
# Quick analysis
ANALYZE=true npm run build
open dist/bundle-analysis.html

# Common fix: Add dynamic imports
const ExpensePage = lazy(() => import('./pages/ExpensePage'));
```

### Performance Issues
```bash
# Test with 3G simulation
lighthouse http://localhost:4173 \
  --preset=mobile \
  --throttling.downloadThroughputKbps=1474 \
  --output=html
```

### Accessibility Issues
```bash
# Quick accessibility check
axe http://localhost:4173 --exit
```

### PWA Issues
```bash
# Check service worker and manifest
lighthouse http://localhost:4173 --only-categories=pwa
```

## CI Configuration Issues

### Inconsistency Fix Needed
The CI configuration has an inconsistency that should be addressed:

```yaml
# .github/workflows/ci.yml (line 61)
# Current: "categories:accessibility": ["error", { minScore: 0.9 }]
# Should be: "categories:accessibility": ["error", { minScore: 0.95 }]
```

This documentation assumes the 95% target as that represents true WCAG 2.1 AA compliance.

## Integration with Development Workflow

### Pre-commit Hooks
The project includes husky pre-commit hooks that run:
- Linting and formatting
- Type checking  
- Basic test validation

### Development Scripts
```bash
# Performance monitoring during development
npm run perf:audit          # Quick performance check
npm run perf:test-3g        # 3G network simulation
npm run verify:performance  # Full performance verification
npm run verify:accessibility # Full accessibility verification
```

### IDE Integration
- **ESLint**: Real-time linting feedback
- **Prettier**: Automatic formatting
- **TypeScript**: Type checking and IntelliSense
- **axe-core**: Accessibility linting (with appropriate extensions)

## Continuous Improvement

### Performance Monitoring
- Real User Monitoring (RUM) should be implemented
- Synthetic monitoring for critical user journeys
- Performance budgets reviewed quarterly

### Accessibility Auditing
- Regular manual testing with screen readers
- User testing with accessibility needs
- Periodic professional accessibility audits

### PWA Evolution
- Monitor offline usage patterns
- Refine caching strategies based on real usage
- Implement progressive enhancement features

This testing documentation ensures the Okaeri Resort Management System maintains high quality standards while providing excellent user experience in challenging Philippine resort environments.