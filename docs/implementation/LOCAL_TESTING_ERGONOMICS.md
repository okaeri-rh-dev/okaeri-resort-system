# Local Testing Ergonomics Guide

> **Purpose**: Streamline local testing workflow for developers  
> **Focus**: Accessibility, Security, and Performance testing  
> **Last Updated**: August 2025

## Overview

This guide provides ergonomic commands and workflows for running comprehensive
tests locally before pushing code. All commands are designed to be memorable,
fast, and provide actionable feedback.

## Critical Issues & Solutions

### Issue 1: Lighthouse Scripts Don't Start Server

**Problem**: Current Lighthouse verification scripts (`verify:accessibility` and
`verify:performance`) assume a server is already running at
`http://localhost:4173`, but they only run the build step without starting the
preview server, causing test failures.

**Root Cause**: The scripts run
`npm run build && npx lighthouse http://localhost:4173` but never execute
`npm run preview` to start the server.

**Solution**: Use the `start-server-and-test` package for automatic server
lifecycle management:

```bash
# Install the required dependency
npm install --save-dev start-server-and-test

# Updated scripts automatically handle server start/stop
npm run verify:accessibility  # Now works reliably
npm run verify:performance    # Now works reliably
```

**Migration Required**: The package.json scripts section below shows the
corrected implementations.

## Quick Reference Card

```bash
# The Big Three - Run before every PR
npm run verify              # Complete verification suite
npm run verify:accessibility # WCAG 2.1 AA compliance
npm run verify:security     # Security vulnerability scan
npm run verify:performance  # Lighthouse performance check

# Phase-Specific Testing
npm run test:phase1         # Run Phase 1 tests only
npm run test:phase1:coverage # Phase 1 with coverage report

# Quick Checks
npm run test               # Watch mode for active development
npm run test:coverage      # Full test suite with coverage
npm run lint              # Code style check
npm run type-check        # TypeScript validation
```

## Accessibility Testing

### Quick Accessibility Check

```bash
# Fast accessibility audit (requires build and starts preview server automatically)
npm run verify:accessibility

# Detailed report with suggestions
npm run test:accessibility:local

# Specific component testing
npx jest --testNamePattern="Accessibility" src/features/auth
```

### Manual Accessibility Testing

```bash
# 1. Start dev server
npm run dev

# 2. Run axe DevTools (browser extension)
# 3. Check these critical items:
```

**Keyboard Navigation Checklist**:

- [ ] Tab through all interactive elements
- [ ] Enter/Space activate buttons
- [ ] Escape closes modals
- [ ] Arrow keys navigate menus
- [ ] Focus indicators visible

**Screen Reader Testing**:

```bash
# macOS: Enable VoiceOver
Cmd + F5

# Windows: Enable Narrator
Win + Ctrl + Enter

# Test these flows:
# - Login form completion
# - Error message announcement
# - Navigation menu usage
# - Data table navigation
```

### Accessibility Test Scripts

Create `scripts/test-accessibility-local.sh`:

```bash
#!/bin/bash
echo "🔍 Running Accessibility Tests..."

# Build if needed
if [ ! -d "dist" ]; then
  npm run build
fi

# Start preview server in background
npm run preview &
SERVER_PID=$!
sleep 3

# Run Lighthouse accessibility audit
npx lighthouse http://localhost:4173 \
  --only-categories=accessibility \
  --output=html \
  --output-path=./accessibility-report.html

# Run axe-core on critical pages
npx axe http://localhost:4173 \
  http://localhost:4173/login \
  http://localhost:4173/dashboard \
  --save accessibility-axe-report.json

# Kill preview server
kill $SERVER_PID

echo "✅ Accessibility reports generated:"
echo "   - accessibility-report.html"
echo "   - accessibility-axe-report.json"

# Open report
open accessibility-report.html 2>/dev/null || xdg-open accessibility-report.html
```

## Security Testing

### Quick Security Audit

```bash
# Dependency vulnerability scan
npm run verify:security

# Deep security audit with details
npm audit

# Check for known vulnerabilities in specific package
npm audit <package-name>

# Auto-fix vulnerabilities (use with caution)
npm audit fix
```

### Security Headers Validation

Create `scripts/validate-security-headers.sh`:

```bash
#!/bin/bash
echo "🔒 Validating Security Headers..."

# Start dev server
npm run dev &
SERVER_PID=$!
sleep 5

# Check CSP headers
curl -I http://localhost:5173 | grep -i "content-security-policy" || echo "⚠️ Missing CSP"

# Check security headers
curl -I http://localhost:5173 | grep -i "x-frame-options" || echo "⚠️ Missing X-Frame-Options"
curl -I http://localhost:5173 | grep -i "x-content-type-options" || echo "⚠️ Missing X-Content-Type-Options"
curl -I http://localhost:5173 | grep -i "strict-transport-security" || echo "⚠️ Missing HSTS"

# Kill dev server
kill $SERVER_PID

echo "✅ Security header validation complete"
```

### OWASP Security Checklist

```bash
# Run OWASP ZAP (if installed)
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:5173 \
  -r owasp-report.html

# Manual security checks
echo "Manual Security Checklist:"
echo "[ ] No secrets in code (use git-secrets)"
echo "[ ] Input validation on all forms"
echo "[ ] XSS prevention (React handles most)"
echo "[ ] SQL injection prevention (parameterized queries)"
echo "[ ] Authentication properly implemented"
echo "[ ] Authorization checks in place"
echo "[ ] Sensitive data encrypted"
echo "[ ] Rate limiting configured"
```

## Performance Testing

### Quick Performance Check

```bash
# Lighthouse performance audit (starts preview server automatically)
npm run verify:performance

# Bundle size analysis
npm run build:analyze

# 3G network simulation
npm run perf:test-3g
```

### Detailed Performance Testing

Create `scripts/test-performance-local.sh`:

```bash
#!/bin/bash
echo "⚡ Running Performance Tests..."

# Build production bundle
npm run build

# Start preview server
npm run preview &
SERVER_PID=$!
sleep 3

# Run Lighthouse with different profiles
echo "Testing Desktop Performance..."
npx lighthouse http://localhost:4173 \
  --preset=desktop \
  --output=json \
  --output-path=./perf-desktop.json

echo "Testing Mobile 3G Performance..."
npx lighthouse http://localhost:4173 \
  --throttling-method=devtools \
  --throttling.cpuSlowdownMultiplier=4 \
  --throttling.requestLatencyMs=560 \
  --throttling.downloadThroughputKbps=1474 \
  --throttling.uploadThroughputKbps=675 \
  --output=json \
  --output-path=./perf-mobile-3g.json

# Check bundle sizes
echo "Bundle Size Analysis:"
du -sh dist/assets/*.js | sort -h

# Memory profiling (requires Chrome DevTools)
echo "For memory profiling:"
echo "1. Open Chrome DevTools"
echo "2. Go to Performance tab"
echo "3. Record while using the app"
echo "4. Check memory usage"

# Kill preview server
kill $SERVER_PID

echo "✅ Performance reports generated:"
echo "   - perf-desktop.json"
echo "   - perf-mobile-3g.json"
```

### Performance Monitoring Commands

```bash
# Watch bundle size during development
npm run build -- --watch &
watch -n 5 'du -sh dist/assets/*.js | sort -h'

# Profile build time
time npm run build

# Analyze dependencies impact
npx bundlephobia-cli <package-name>

# Find large dependencies
npm ls --depth=0 | awk '{print $2}' | xargs -I {} npx bundlephobia-cli {}
```

## Test Organization

### Before Every Commit

```bash
# Quick validation (< 30 seconds)
npm run lint
npm run type-check
npm run test -- --run --changed

# If UI changes
npm run verify:accessibility

# If security-related
npm run verify:security
```

### Before Every PR

```bash
# Complete verification (< 5 minutes)
npm run verify

# Phase-specific testing
npm run test:phase1:coverage  # Or relevant phase

# Performance check if bundle changed
npm run verify:performance
```

### Weekly Deep Testing

```bash
# Full test suite with all reports
npm run test:coverage
npm run verify:accessibility
npm run verify:security
npm run verify:performance
npm run build:analyze

# Manual testing
# - Different browsers (Chrome, Firefox, Safari)
# - Different devices (phone, tablet, desktop)
# - Different network speeds
# - Screen reader testing
```

## CI Simulation

### Run CI Locally

```bash
# Simulate CI environment
npm run test:ci:simulation

# This runs:
# - test:performance:local
# - test:accessibility:local
# - Full test suite
# - Security audit
```

### Pre-push Hook

Add to `.husky/pre-push`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "Running pre-push checks..."

# Quick checks only
npm run lint || exit 1
npm run type-check || exit 1
npm run test -- --run --changed || exit 1

echo "✅ Pre-push checks passed"
```

## Troubleshooting

### Mock Service Verification

Before running tests, verify that all required mock services are available:

```bash
# Verify mock services exist
test -f src/services/registry.ts && echo "✅ Service registry exists" || echo "❌ Missing src/services/registry.ts"
test -f src/services/mock/auth.mock.service.ts && echo "✅ Auth mock service exists" || echo "❌ Missing mock auth service"
test -f src/services/mock/booking.mock.service.ts && echo "✅ Booking mock service exists" || echo "❌ Missing mock booking service"
test -d src/test/factories && echo "✅ Test factories exist" || echo "❌ Missing test factories directory"
test -f src/test/helpers.tsx && echo "✅ Test helpers exist" || echo "❌ Missing test helpers"
```

**If mock services are missing**, follow these recovery steps:

1. **Check Mock API Architecture documentation**:

   ```bash
   cat docs/implementation/Mock_API_Architecture.md
   ```

2. **Verify service registry setup**:

   ```bash
   # Service registry should exist
   ls -la src/services/

   # Should contain:
   # - registry.ts (service registry)
   # - service.factory.ts (factory pattern)
   # - base.service.ts (base service class)
   # - mock/ directory (all mock implementations)
   ```

3. **Create missing mock services** (if needed):

   ```bash
   # Create mock directory structure
   mkdir -p src/services/mock

   # Template for missing mock services
   # See Mock_API_Architecture.md for implementation patterns
   ```

4. **Test mock service integration**:

   ```bash
   # Run mock service tests (if available)
   npm run test src/services/mock/*.test.ts 2>/dev/null || echo "Note: Add mock service tests for better reliability"

   # Test service factory
   npm run test src/services/service.factory.test.ts 2>/dev/null || echo "Note: Service factory tests needed"
   ```

### Common Issues

**Issue**: Tests fail with import errors from @/test/helpers

```bash
# Verify TypeScript paths configuration
npm run verify:aliases

# Check if test setup is properly configured
test -f src/test/setup.ts && echo "✅ Test setup exists" || echo "❌ Missing test setup"

# Verify vitest can resolve paths
npm run test -- --run --reporter=verbose src/test/setup.ts
```

**Issue**: Mock services return undefined or errors

```bash
# Check service registry configuration
node -e "
const registry = require('./src/services/registry.ts');
console.log('Available services:', Object.keys(registry));
"

# Verify mock service initialization
npm run test -- --run src/services/mock/__tests__/integration.test.ts 2>/dev/null || echo "Create integration tests for mock services"
```

**Issue**: Accessibility tests fail locally but pass in CI

```bash
# Ensure same viewport
npm run test -- --viewport 1280x720
```

**Issue**: Performance scores vary

```bash
# Use consistent environment
npm run build
npm run preview  # Don't use dev server
# Close other applications
# Use incognito mode
```

**Issue**: Security audit has too many warnings

```bash
# Focus on high/critical only
npm audit --audit-level=high

# Check production dependencies only
npm audit --production
```

**Issue**: Test infrastructure appears broken

```bash
# Complete infrastructure verification
npm run verify:test-config
npm run verify:mock-services
npm run verify:test-factories
npm run verify:aliases

# If any fail, see Mock_API_Architecture.md and Test_Data_Seeding_Strategy.md
```

## Testing Scripts Package.json

Ensure these scripts are in package.json.

### Critical Fix Required

**Current Problem**: The existing Lighthouse scripts in package.json are broken:

```json
{
  "verify:accessibility": "npm run build && npx lighthouse http://localhost:4173 --only-categories=accessibility --output=json",
  "verify:performance": "npm run build && npx lighthouse http://localhost:4173 --preset=desktop --output=json"
}
```

These fail because no server is started after the build.

**Required Solution**: Install dependency and update scripts:

```bash
npm install --save-dev start-server-and-test
```

**Updated Scripts** (copy these to package.json):

```json
{
  "scripts": {
    "verify": "npm run verify:all",
    "verify:all": "npm run verify:tests && npm run verify:types && npm run verify:lint && npm run verify:security",
    "verify:tests": "vitest run --coverage",
    "verify:types": "tsc --noEmit",
    "verify:lint": "eslint . --max-warnings 0",
    "verify:security": "npm audit --audit-level=high",
    "verify:accessibility": "npm run build && start-server-and-test preview http://localhost:4173 'lighthouse http://localhost:4173 --only-categories=accessibility --output=json --output-path=./lighthouse-accessibility.json'",
    "verify:performance": "npm run build && start-server-and-test preview http://localhost:4173 'lighthouse http://localhost:4173 --preset=desktop --output=json --output-path=./lighthouse-performance.json'",
    "verify:bundle": "npm run build:analyze",
    "test:lighthouse:full": "npm run build && start-server-and-test preview http://localhost:4173 'npm run lighthouse:all-checks'",
    "lighthouse:all-checks": "npm run lighthouse:performance && npm run lighthouse:accessibility",
    "lighthouse:accessibility": "npx lighthouse http://localhost:4173 --only-categories=accessibility --output=json --output-path=lighthouse-accessibility.json",
    "lighthouse:performance": "npx lighthouse http://localhost:4173 --preset=desktop --output=json --output-path=lighthouse-performance.json",
    "test:accessibility:local": "./scripts/test-accessibility-local.sh",
    "test:performance:local": "./scripts/test-performance-local.sh",
    "test:ci:simulation": "npm run test:performance:local && npm run test:accessibility:local"
  }
}
```

### How the Fix Works

1. **`start-server-and-test preview http://localhost:4173`**:
   - Starts `npm run preview` (serves built assets)
   - Waits for `http://localhost:4173` to respond
   - Times out after 60 seconds if server doesn't start

2. **`'lighthouse http://localhost:4173 ...'`**:
   - Runs once server is confirmed ready
   - Executes Lighthouse against the running server

3. **Automatic Cleanup**:
   - Server process is terminated when Lighthouse completes
   - No manual cleanup required

## Quick Decision Tree

```
Need to test something?
├── Is it a code change?
│   ├── Yes → npm run test (watch mode)
│   └── No → Skip
├── Is it a UI change?
│   ├── Yes → npm run verify:accessibility
│   └── No → Skip
├── Is it security-related?
│   ├── Yes → npm run verify:security
│   └── No → Skip
├── Does it affect bundle size?
│   ├── Yes → npm run verify:performance
│   └── No → Skip
└── Ready to commit?
    └── Yes → npm run verify (everything)
```

## Summary

Local testing should be:

- **Fast**: Quick commands for rapid iteration
- **Comprehensive**: Cover accessibility, security, and performance
- **Actionable**: Clear reports with fix suggestions
- **Automated**: Scripts handle complex workflows
- **Ergonomic**: Easy to remember and type

Remember: The goal is to catch issues locally before they reach CI, saving time
and maintaining code quality.
