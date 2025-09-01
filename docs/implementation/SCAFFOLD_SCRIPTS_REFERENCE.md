# Scaffold Scripts Reference Documentation

## Overview

The scaffold scripts are essential tools in the Okaeri Resort System's
Test-Driven Development (TDD) workflow. They automate the creation of test
files, component structures, and implementation stubs that support the
RED-GREEN-REFACTOR cycle. Each phase of development has dedicated scaffold
commands that ensure consistent project structure and enforce TDD practices.

### Purpose and Benefits

- **Enforces TDD**: Creates test files first, supporting the RED phase of
  development
- **Ensures Consistency**: Maintains uniform project structure across all phases
- **Accelerates Development**: Reduces boilerplate setup time
- **Prevents Errors**: Eliminates manual file creation mistakes
- **Documents Intent**: Generated files include clear documentation of purpose

## Complete Scaffold Scripts Reference

### Phase 1: Authentication Features

#### Command Syntax

```bash
npm run scaffold:phase1:auth
```

#### Directory Structure Created

```
src/
├── features/
│   └── auth/
│       ├── __tests__/
│       │   ├── components/
│       │   │   ├── LoginForm.test.tsx
│       │   │   ├── RegisterForm.test.tsx
│       │   │   ├── ForgotPasswordForm.test.tsx
│       │   │   ├── ResetPasswordForm.test.tsx
│       │   │   └── AuthLayout.test.tsx
│       │   ├── hooks/
│       │   │   ├── useAuth.test.ts
│       │   │   ├── useSession.test.ts
│       │   │   └── useTokenRefresh.test.ts
│       │   ├── stores/
│       │   │   └── authStore.test.ts
│       │   └── api/
│       │       ├── login.test.ts
│       │       ├── register.test.ts
│       │       ├── logout.test.ts
│       │       ├── refresh.test.ts
│       │       └── session.test.ts
│       ├── components/
│       │   ├── LoginForm.tsx
│       │   ├── RegisterForm.tsx
│       │   ├── ForgotPasswordForm.tsx
│       │   ├── ResetPasswordForm.tsx
│       │   └── AuthLayout.tsx
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── useSession.ts
│       │   └── useTokenRefresh.ts
│       ├── stores/
│       │   └── authStore.ts
│       └── types/
│           └── auth.types.ts
├── api/
│   └── auth/
│       ├── login.ts
│       ├── register.ts
│       ├── logout.ts
│       ├── refresh.ts
│       └── session.ts
└── lib/
    └── auth/
        ├── jwt.ts
        ├── validation.ts
        └── middleware.ts
```

#### Files Generated

- **Test Files**: 16 test files with RED phase assertions
- **Component Files**: 5 authentication components with TypeScript interfaces
- **Hook Files**: 3 custom hooks for auth state management
- **Store Files**: 1 Zustand store for authentication state
- **API Routes**: 5 serverless function endpoints
- **Utility Files**: JWT handling, validation schemas, middleware

#### TDD Integration

1. Tests include failing assertions for all auth flows
2. Component tests verify form validation and submission
3. Hook tests ensure proper state management
4. API tests validate JWT handling and security

### Phase 2: Dashboard Features

#### Command Syntax

```bash
npm run scaffold:phase2:dashboard
```

#### Directory Structure Created

```
src/
├── features/
│   └── dashboard/
│       ├── __tests__/
│       │   ├── components/
│       │   │   ├── DashboardLayout.test.tsx
│       │   │   ├── MetricsCard.test.tsx
│       │   │   ├── BookingCalendar.test.tsx
│       │   │   ├── RevenueChart.test.tsx
│       │   │   ├── OccupancyWidget.test.tsx
│       │   │   └── QuickActions.test.tsx
│       │   ├── hooks/
│       │   │   ├── useDashboardMetrics.test.ts
│       │   │   ├── useRealtimeUpdates.test.ts
│       │   │   └── useProjectContext.test.ts
│       │   ├── stores/
│       │   │   ├── dashboardStore.test.ts
│       │   │   └── projectStore.test.ts
│       │   └── api/
│       │       ├── metrics.test.ts
│       │       ├── projects.test.ts
│       │       └── analytics.test.ts
│       ├── components/
│       │   ├── DashboardLayout.tsx
│       │   ├── MetricsCard.tsx
│       │   ├── BookingCalendar.tsx
│       │   ├── RevenueChart.tsx
│       │   ├── OccupancyWidget.tsx
│       │   └── QuickActions.tsx
│       ├── hooks/
│       │   ├── useDashboardMetrics.ts
│       │   ├── useRealtimeUpdates.ts
│       │   └── useProjectContext.ts
│       ├── stores/
│       │   ├── dashboardStore.ts
│       │   └── projectStore.ts
│       └── types/
│           ├── dashboard.types.ts
│           └── metrics.types.ts
├── api/
│   └── dashboard/
│       ├── metrics.ts
│       ├── projects.ts
│       └── analytics.ts
└── routes/
    └── dashboard/
        ├── index.tsx
        ├── analytics.tsx
        └── settings.tsx
```

#### Files Generated

- **Test Files**: 14 test files for dashboard functionality
- **Component Files**: 6 dashboard UI components
- **Hook Files**: 3 hooks for data fetching and real-time updates
- **Store Files**: 2 Zustand stores for dashboard and project state
- **API Routes**: 3 endpoints for metrics and analytics
- **Route Files**: 3 TanStack Router pages

#### TDD Integration

1. Tests for real-time data updates and WebSocket connections
2. Component tests for chart rendering and interactions
3. Store tests for optimistic updates
4. API tests for multi-tenant data isolation

### Phase 3: Booking Features

#### Command Syntax

```bash
npm run scaffold:phase3:booking
```

#### Directory Structure Created

```
src/
├── features/
│   └── booking/
│       ├── __tests__/
│       │   ├── components/
│       │   │   ├── BookingForm.test.tsx
│       │   │   ├── BookingCalendar.test.tsx
│       │   │   ├── RoomSelector.test.tsx
│       │   │   ├── GuestDetails.test.tsx
│       │   │   ├── BookingConfirmation.test.tsx
│       │   │   └── BookingList.test.tsx
│       │   ├── hooks/
│       │   │   ├── useBookingMutation.test.ts
│       │   │   ├── useAvailability.test.ts
│       │   │   ├── usePricing.test.ts
│       │   │   └── useBookingOptimistic.test.ts
│       │   ├── stores/
│       │   │   ├── bookingStore.test.ts
│       │   │   └── availabilityStore.test.ts
│       │   └── api/
│       │       ├── bookings.test.ts
│       │       ├── availability.test.ts
│       │       ├── pricing.test.ts
│       │       └── guests.test.ts
│       ├── components/
│       │   ├── BookingForm.tsx
│       │   ├── BookingCalendar.tsx
│       │   ├── RoomSelector.tsx
│       │   ├── GuestDetails.tsx
│       │   ├── BookingConfirmation.tsx
│       │   └── BookingList.tsx
│       ├── hooks/
│       │   ├── useBookingMutation.ts
│       │   ├── useAvailability.ts
│       │   ├── usePricing.ts
│       │   └── useBookingOptimistic.ts
│       ├── stores/
│       │   ├── bookingStore.ts
│       │   └── availabilityStore.ts
│       └── types/
│           ├── booking.types.ts
│           ├── room.types.ts
│           └── guest.types.ts
├── api/
│   └── bookings/
│       ├── create.ts
│       ├── update.ts
│       ├── cancel.ts
│       ├── availability.ts
│       ├── pricing.ts
│       └── guests.ts
└── routes/
    └── bookings/
        ├── index.tsx
        ├── new.tsx
        ├── [id].tsx
        └── calendar.tsx
```

#### Files Generated

- **Test Files**: 16 test files for booking workflows
- **Component Files**: 6 booking UI components
- **Hook Files**: 4 hooks for booking operations and optimistic updates
- **Store Files**: 2 stores for booking and availability state
- **API Routes**: 6 endpoints for CRUD and availability
- **Route Files**: 4 TanStack Router pages

#### TDD Integration

1. Tests for complex availability calculations
2. Optimistic booking update tests
3. Conflict resolution tests for concurrent bookings
4. Price calculation and seasonal rate tests

### Phase 4: Financial Features

#### Command Syntax

```bash
npm run scaffold:phase4:financial
```

#### Directory Structure Created

```
src/
├── features/
│   └── financial/
│       ├── __tests__/
│       │   ├── components/
│       │   │   ├── ExpenseForm.test.tsx
│       │   │   ├── ExpenseList.test.tsx
│       │   │   ├── RevenueReport.test.tsx
│       │   │   ├── TaxCalculator.test.tsx
│       │   │   ├── ReceiptGenerator.test.tsx
│       │   │   └── ApprovalChain.test.tsx
│       │   ├── hooks/
│       │   │   ├── useExpenseMutation.test.ts
│       │   │   ├── useFinancialReports.test.ts
│       │   │   ├── useTaxCalculation.test.ts
│       │   │   └── useApprovalWorkflow.test.ts
│       │   ├── stores/
│       │   │   ├── expenseStore.test.ts
│       │   │   └── financialStore.test.ts
│       │   └── api/
│       │       ├── expenses.test.ts
│       │       ├── revenue.test.ts
│       │       ├── reports.test.ts
│       │       ├── tax.test.ts
│       │       └── approvals.test.ts
│       ├── components/
│       │   ├── ExpenseForm.tsx
│       │   ├── ExpenseList.tsx
│       │   ├── RevenueReport.tsx
│       │   ├── TaxCalculator.tsx
│       │   ├── ReceiptGenerator.tsx
│       │   └── ApprovalChain.tsx
│       ├── hooks/
│       │   ├── useExpenseMutation.ts
│       │   ├── useFinancialReports.ts
│       │   ├── useTaxCalculation.ts
│       │   └── useApprovalWorkflow.ts
│       ├── stores/
│       │   ├── expenseStore.ts
│       │   └── financialStore.ts
│       └── types/
│           ├── expense.types.ts
│           ├── revenue.types.ts
│           └── tax.types.ts
├── api/
│   └── financial/
│       ├── expenses/
│       │   ├── create.ts
│       │   ├── update.ts
│       │   └── approve.ts
│       ├── revenue/
│       │   ├── daily.ts
│       │   └── monthly.ts
│       ├── reports/
│       │   ├── generate.ts
│       │   └── export.ts
│       └── tax/
│           └── calculate.ts
└── routes/
    └── financial/
        ├── index.tsx
        ├── expenses.tsx
        ├── revenue.tsx
        ├── reports.tsx
        └── approvals.tsx
```

#### Files Generated

- **Test Files**: 17 test files for financial operations
- **Component Files**: 6 financial UI components
- **Hook Files**: 4 hooks for financial mutations and calculations
- **Store Files**: 2 stores for expense and financial state
- **API Routes**: 9 endpoints for financial operations
- **Route Files**: 5 TanStack Router pages

#### TDD Integration

1. Tests for BIR tax compliance calculations
2. Receipt generation format tests
3. Approval workflow state machine tests
4. Financial report accuracy tests

### Phase 5: Deployment Features

#### Command Syntax

```bash
npm run scaffold:phase5:deployment
```

#### Directory Structure Created

```
.github/
├── workflows/
│   ├── ci.yml
│   ├── cd-staging.yml
│   ├── cd-production.yml
│   └── security-scan.yml
├── scripts/
│   ├── pre-deploy.js
│   ├── post-deploy.js
│   └── health-check.js
└── ISSUE_TEMPLATE/
    ├── bug_report.md
    └── feature_request.md

tests/
├── e2e/
│   ├── __tests__/
│   │   ├── auth-flow.test.ts
│   │   ├── booking-flow.test.ts
│   │   ├── financial-flow.test.ts
│   │   └── critical-paths.test.ts
│   └── fixtures/
│       ├── users.json
│       └── bookings.json
├── performance/
│   ├── __tests__/
│   │   ├── lighthouse.test.ts
│   │   ├── bundle-size.test.ts
│   │   └── api-response.test.ts
│   └── benchmarks/
│       └── baseline.json
└── security/
    ├── __tests__/
    │   ├── jwt-validation.test.ts
    │   ├── rate-limiting.test.ts
    │   └── csp-headers.test.ts
    └── penetration/
        └── owasp-top10.test.ts

monitoring/
├── alerts/
│   ├── error-rate.yml
│   ├── response-time.yml
│   └── availability.yml
└── dashboards/
    ├── application.json
    └── infrastructure.json
```

#### Files Generated

- **CI/CD Workflows**: 4 GitHub Actions workflows
- **Deployment Scripts**: 3 Node.js scripts for deployment automation
- **E2E Tests**: 4 Playwright test suites
- **Performance Tests**: 3 performance benchmark tests
- **Security Tests**: 4 security validation tests
- **Monitoring Configs**: 6 monitoring and alerting configurations

#### TDD Integration

1. E2E tests for critical user paths
2. Performance tests against baseline metrics
3. Security tests for OWASP Top 10
4. Deployment validation tests

## Pre-Implementation Scaffold Commands

### Quick Start Commands

```bash
# Scaffold all phases at once (for initial project setup)
npm run scaffold:all

# Individual phase scaffolding
npm run scaffold:phase1:auth
npm run scaffold:phase2:dashboard
npm run scaffold:phase3:booking
npm run scaffold:phase4:financial
npm run scaffold:phase5:deployment

# Feature-specific scaffolding
npm run scaffold:auth:mfa          # Multi-factor authentication
npm run scaffold:booking:channels  # Channel manager integration
npm run scaffold:financial:bir     # BIR compliance features
```

### Custom Scaffold Creation

```bash
# Create custom scaffold for new feature
npm run scaffold:custom -- --feature=amenities --tests=unit,integration

# Scaffold with specific test coverage
npm run scaffold:with-coverage -- --feature=reports --coverage=95
```

## CI/CD Integration Patterns

### Pre-Commit Hooks

```json
// .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Verify scaffold structure
npm run verify:scaffold

# Check test coverage
npm run test:coverage -- --silent

# Lint scaffolded files
npm run lint:staged
```

### GitHub Actions Integration

```yaml
# .github/workflows/scaffold-check.yml
name: Scaffold Verification
on:
  pull_request:
    paths:
      - "src/**"
      - "tests/**"

jobs:
  verify-scaffold:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Verify Scaffold Structure
        run: npm run verify:scaffold
      - name: Check Test Coverage
        run: npm run test:coverage
      - name: Validate TDD Compliance
        run: npm run verify:tdd
```

### Deployment Pipeline Integration

```yaml
# Vercel deployment with scaffold validation
build:
  environment:
    - name: NEXT_PUBLIC_SCAFFOLD_MODE
      value: production
  script:
    - npm run scaffold:verify
    - npm run build
    - npm run test:e2e
```

## Best Practices

### 1. Always Scaffold Before Implementation

```bash
# Wrong approach
touch src/features/newFeature/Component.tsx
# Right approach
npm run scaffold:feature -- --name=newFeature
```

### 2. Maintain Test-First Development

- Run scaffold command first
- Write failing tests in generated test files
- Implement features to make tests pass
- Refactor with confidence

### 3. Use Scaffold Templates

```bash
# Create reusable templates
npm run scaffold:template:create -- --name=crud-feature
npm run scaffold:from-template -- --template=crud-feature --name=amenities
```

### 4. Integrate with IDE

```json
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Scaffold Feature",
      "type": "shell",
      "command": "npm run scaffold:feature -- --name=${input:featureName}",
      "problemMatcher": []
    }
  ]
}
```

### 5. Document Scaffold Customizations

```typescript
// scaffold.config.ts
export const scaffoldConfig = {
  testFramework: "vitest",
  testPattern: "__tests__",
  componentTemplate: "functional",
  storeTemplate: "zustand",
  apiTemplate: "vercel-serverless",
};
```

## Troubleshooting

### Common Issues and Solutions

#### Issue: Scaffold command fails with permission error

```bash
# Solution: Check file permissions
chmod +x scripts/scaffold/*.js
```

#### Issue: Tests not generated in correct location

```bash
# Solution: Verify scaffold configuration
npm run scaffold:config:validate
```

#### Issue: Duplicate files created

```bash
# Solution: Clean and re-scaffold
npm run scaffold:clean -- --phase=2
npm run scaffold:phase2:dashboard
```

#### Issue: Custom templates not working

```bash
# Solution: Validate template syntax
npm run scaffold:template:validate -- --name=my-template
```

#### Issue: CI/CD scaffold checks failing

```bash
# Solution: Ensure all files match scaffold structure
npm run scaffold:sync
```

### Scaffold Validation Commands

```bash
# Validate scaffold structure
npm run scaffold:validate

# Check for missing test files
npm run scaffold:check:tests

# Verify TDD compliance
npm run scaffold:check:tdd

# Sync scaffold with current structure
npm run scaffold:sync
```

### Debug Mode

```bash
# Run scaffold in debug mode
DEBUG=scaffold:* npm run scaffold:phase1:auth

# Dry run without creating files
npm run scaffold:phase2:dashboard -- --dry-run

# Verbose output
npm run scaffold:phase3:booking -- --verbose
```

## Integration with Development Workflow

### 1. RED Phase (Test First)

```bash
# Generate failing tests
npm run scaffold:phase1:auth
# Tests are created with assertions that will fail
# Run tests to confirm RED state
npm run test:phase1
```

### 2. GREEN Phase (Make Tests Pass)

```bash
# Implement minimal code to pass tests
# Use generated component and API stubs
# Run tests continuously
npm run test:watch
```

### 3. REFACTOR Phase (Improve Code)

```bash
# Refactor with confidence
# Tests ensure functionality remains intact
# Check coverage
npm run test:coverage
```

### 4. Continuous Integration

```bash
# Automated checks on commit
# Pre-commit hooks validate scaffold
# CI/CD ensures all tests pass
git commit -m "feat: implement auth feature"
```

## Scaffold Configuration Reference

### Configuration File Structure

```typescript
// scaffold.config.ts
interface ScaffoldConfig {
  phases: {
    [key: string]: PhaseConfig;
  };
  templates: {
    component: string;
    test: string;
    api: string;
    store: string;
  };
  options: {
    generateDocs: boolean;
    includeStorybook: boolean;
    testCoverage: number;
    strictMode: boolean;
  };
}
```

### Environment Variables

```bash
# .env.scaffold
SCAFFOLD_MODE=development
SCAFFOLD_TEST_FRAMEWORK=vitest
SCAFFOLD_COVERAGE_THRESHOLD=90
SCAFFOLD_TEMPLATE_PATH=./templates
SCAFFOLD_OUTPUT_PATH=./src
```

## Conclusion

The scaffold scripts are fundamental to maintaining code quality and consistency
in the Okaeri Resort System. By automating the creation of test files and
project structure, they enforce TDD practices and accelerate development while
reducing errors. Always use the appropriate scaffold command before implementing
new features to ensure compliance with project standards and maintain the
RED-GREEN-REFACTOR development cycle.

For additional support or custom scaffold requirements, refer to the
phase-specific documentation or contact the development team.
