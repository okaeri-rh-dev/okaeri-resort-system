# Phase Scaffolding Requirements

## Overview

This document specifies the scaffolding requirements for Phases 2-5 of the
Okaeri Resort Management System TDD implementation. It ensures CI/CD pipeline
compatibility and provides clear structure for future phase development.

**Owner**: zustand-tanstack-resort-architect  
**Status**: Required for CI Matrix Compatibility  
**Last Updated**: August 31, 2025

## Phase Scripts Requirements

### 1. Package.json Phase Scripts

Add these scripts to package.json to enable CI matrix testing:

```json
{
  "scripts": {
    // Phase 1 (Already exists)
    "scaffold:phase1": "echo 'See docs/implementation/phases/phase-1-login-tdd/PHASE_1_FORM_TEST_SPECIFICATIONS.md'",
    "test:phase1": "vitest run src/features/auth/**/__tests__/*.test.{ts,tsx}",
    "test:phase1:coverage": "vitest run --coverage src/features/auth/**/__tests__/*.test.{ts,tsx}",
    "test:phase1:watch": "vitest watch src/features/auth/**/__tests__/*.test.{ts,tsx}",

    // Phase 2: Dashboard & State Management
    "scaffold:phase2": "echo 'Phase 2: Dashboard - See docs/implementation/phases/phase-2-dashboard-tdd/README.md'",
    "test:phase2": "vitest run src/features/dashboard/**/__tests__/*.test.{ts,tsx}",
    "test:phase2:coverage": "vitest run --coverage src/features/dashboard/**/__tests__/*.test.{ts,tsx}",
    "test:phase2:watch": "vitest watch src/features/dashboard/**/__tests__/*.test.{ts,tsx}",

    // Phase 3: Booking System
    "scaffold:phase3": "echo 'Phase 3: Booking - See docs/implementation/phases/phase-3-booking-tdd/README.md'",
    "test:phase3": "vitest run src/features/booking/**/__tests__/*.test.{ts,tsx}",
    "test:phase3:coverage": "vitest run --coverage src/features/booking/**/__tests__/*.test.{ts,tsx}",
    "test:phase3:watch": "vitest watch src/features/booking/**/__tests__/*.test.{ts,tsx}",

    // Phase 4: Financial Management
    "scaffold:phase4": "echo 'Phase 4: Financial - See docs/implementation/phases/phase-4-financial-tdd/README.md'",
    "test:phase4": "vitest run src/features/financial/**/__tests__/*.test.{ts,tsx}",
    "test:phase4:coverage": "vitest run --coverage src/features/financial/**/__tests__/*.test.{ts,tsx}",
    "test:phase4:watch": "vitest watch src/features/financial/**/__tests__/*.test.{ts,tsx}",

    // Phase 5: Production Deployment
    "scaffold:phase5": "echo 'Phase 5: Deployment - See docs/implementation/phases/phase-5-deployment/README.md'",
    "test:phase5": "vitest run src/features/deployment/**/__tests__/*.test.{ts,tsx}",
    "test:phase5:coverage": "vitest run --coverage src/features/deployment/**/__tests__/*.test.{ts,tsx}",
    "test:phase5:watch": "vitest watch src/features/deployment/**/__tests__/*.test.{ts,tsx}",

    // Composite scripts
    "test:all-phases": "npm run test:phase1 && npm run test:phase2 && npm run test:phase3 && npm run test:phase4 && npm run test:phase5",
    "test:all-phases:coverage": "vitest run --coverage src/features/**/__tests__/*.test.{ts,tsx}"
  }
}
```

### 2. Placeholder Scripts Rationale

**Why add empty phase scripts now?**

1. **CI Matrix Compatibility**: CI configuration expects these scripts
2. **Documentation Alignment**: Docs reference these scripts
3. **Developer Experience**: Clear roadmap for future phases
4. **No False Positives**: Empty globs return zero tests (not failure)

## Directory Structure Requirements

### Canonical Feature Directory Structure

```
src/
├── features/                    # Feature-based organization
│   ├── auth/                   # Phase 1: Authentication
│   │   ├── components/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegistrationForm.tsx
│   │   │   └── PasswordResetForm.tsx
│   │   ├── hooks/
│   │   │   └── useAuth.ts
│   │   ├── stores/
│   │   │   └── authStore.ts
│   │   ├── types/
│   │   │   └── auth.types.ts
│   │   └── __tests__/
│   │       ├── LoginForm.test.tsx
│   │       ├── RegistrationForm.test.tsx
│   │       └── auth.integration.test.ts
│   │
│   ├── dashboard/              # Phase 2: Dashboard & Metrics
│   │   ├── components/
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── MetricsCard.tsx
│   │   │   └── OccupancyChart.tsx
│   │   ├── hooks/
│   │   │   └── useDashboard.ts
│   │   ├── stores/
│   │   │   └── dashboardStore.ts
│   │   └── __tests__/
│   │       └── .gitkeep       # Placeholder
│   │
│   ├── booking/                # Phase 3: Booking Management
│   │   ├── components/
│   │   │   ├── BookingForm.tsx
│   │   │   ├── BookingCalendar.tsx
│   │   │   └── RoomSelector.tsx
│   │   ├── hooks/
│   │   │   └── useBooking.ts
│   │   ├── stores/
│   │   │   └── bookingStore.ts
│   │   └── __tests__/
│   │       └── .gitkeep       # Placeholder
│   │
│   ├── financial/              # Phase 4: Financial Features
│   │   ├── components/
│   │   │   ├── ExpenseForm.tsx
│   │   │   ├── RevenueReport.tsx
│   │   │   └── PaymentProcessor.tsx
│   │   ├── hooks/
│   │   │   └── useFinancial.ts
│   │   ├── stores/
│   │   │   └── financialStore.ts
│   │   └── __tests__/
│   │       └── .gitkeep       # Placeholder
│   │
│   └── deployment/             # Phase 5: Deployment Tools
│       ├── components/
│       │   ├── HealthCheck.tsx
│       │   └── MaintenanceMode.tsx
│       ├── utils/
│       │   └── deployment.utils.ts
│       └── __tests__/
│           └── .gitkeep       # Placeholder
```

### Creating Placeholder Directories

```bash
# Script to create phase directories
mkdir -p src/features/dashboard/{components,hooks,stores,types,__tests__}
mkdir -p src/features/booking/{components,hooks,stores,types,__tests__}
mkdir -p src/features/financial/{components,hooks,stores,types,__tests__}
mkdir -p src/features/deployment/{components,utils,__tests__}

# Add .gitkeep to empty test directories
touch src/features/dashboard/__tests__/.gitkeep
touch src/features/booking/__tests__/.gitkeep
touch src/features/financial/__tests__/.gitkeep
touch src/features/deployment/__tests__/.gitkeep
```

## Phase-Specific Coverage Thresholds

### Vitest Configuration by Phase

Update `vitest.config.ts` with phase-specific thresholds:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        // Global minimum
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        // Phase 1: Authentication (Higher due to security criticality)
        "src/features/auth/**": {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        // Phase 2: Dashboard (Standard coverage)
        "src/features/dashboard/**": {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        // Phase 3: Booking (Higher due to business criticality)
        "src/features/booking/**": {
          branches: 93,
          functions: 93,
          lines: 93,
          statements: 93,
        },
        // Phase 4: Financial (Highest due to money handling)
        "src/features/financial/**": {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        // Phase 5: Deployment (Lower, mostly integration)
        "src/features/deployment/**": {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
  },
});
```

## CI/CD Matrix Configuration

### GitHub Actions Phase Matrix

```yaml
# .github/workflows/ci.yml
jobs:
  test-phases:
    name: Test Phase ${{ matrix.phase }}
    runs-on: ubuntu-latest
    strategy:
      matrix:
        phase: [1, 2, 3, 4, 5]
      fail-fast: false # Continue other phases if one fails

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run Phase ${{ matrix.phase }} tests
        run: npm run test:phase${{ matrix.phase }}:coverage

      - name: Check Phase ${{ matrix.phase }} coverage
        run: |
          # Phase-specific thresholds are enforced by vitest
          echo "Phase ${{ matrix.phase }} coverage check completed"

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage-phase-${{ matrix.phase }}
          path: coverage/
          retention-days: 7
```

## Phase Documentation Templates

### Phase README Template

Create template for each phase:

```markdown
# Phase [NUMBER]: [NAME] TDD Implementation

## Overview

[Description of phase objectives]

**Lead Agent**: [agent-name]  
**Support Agents**: [list]  
**Timeline**: [estimated duration]  
**Status**: Not Started | In Progress | Complete

## Objectives

1. [Objective 1]
2. [Objective 2]
3. [Objective 3]

## Test Coverage Requirements

- Minimum Coverage: [X]%
- Critical Paths: [List critical functionality]

## RED Phase Checklist

- [ ] Test specifications written
- [ ] Test skeletons created
- [ ] All tests failing (RED)
- [ ] Coverage targets defined

## GREEN Phase Checklist

- [ ] Minimal implementation complete
- [ ] All tests passing
- [ ] Coverage targets met
- [ ] No linting errors

## REFACTOR Phase Checklist

- [ ] Code optimized
- [ ] Documentation complete
- [ ] Performance verified
- [ ] Security validated

## Components to Implement

- `Component1.tsx` - [Description]
- `Component2.tsx` - [Description]

## API Endpoints Required

- `POST /api/[endpoint]` - [Description]
- `GET /api/[endpoint]` - [Description]

## State Management

- Store: `[storeName]Store.ts`
- Actions: [List key actions]
- Selectors: [List key selectors]

## Verification Commands

\`\`\`bash npm run test:phase[X] npm run test:phase[X]:coverage npm run
test:phase[X]:watch \`\`\`

## Dependencies on Previous Phases

- Phase [X]: [What's needed]

## Handoff Criteria

- [ ] All tests passing
- [ ] Coverage requirements met
- [ ] Documentation complete
- [ ] Performance benchmarks met
- [ ] Security audit passed
```

## Phase Transition Management

### Phase Completion Criteria

Each phase must meet these criteria before proceeding:

1. **Test Coverage**: Meets phase-specific thresholds
2. **Documentation**: README and test specs complete
3. **Integration**: Works with previous phases
4. **Performance**: Meets defined budgets
5. **Security**: Passes security audits
6. **Review**: Lead agent approves

### Handoff Protocol

```typescript
// Example handoff verification
interface PhaseHandoff {
  phase: number;
  testsPass: boolean;
  coverageMet: boolean;
  documented: boolean;
  integrated: boolean;
  performant: boolean;
  secure: boolean;
  approvedBy: string;
  timestamp: string;
}
```

## Verification Commands for All Phases

```bash
# Scaffold information
npm run scaffold:phase1  # Shows Phase 1 docs
npm run scaffold:phase2  # Shows Phase 2 docs
npm run scaffold:phase3  # Shows Phase 3 docs
npm run scaffold:phase4  # Shows Phase 4 docs
npm run scaffold:phase5  # Shows Phase 5 docs

# Run specific phase tests
npm run test:phase1      # Run Phase 1 tests
npm run test:phase2      # Run Phase 2 tests (empty initially)

# Coverage for specific phase
npm run test:phase1:coverage

# Watch mode for TDD
npm run test:phase1:watch

# Run all phases
npm run test:all-phases

# Complete coverage report
npm run test:all-phases:coverage
```

## Common Issues and Solutions

### Issue: "No test files found" for Phase 2-5

**Expected**: These phases haven't started yet. Empty glob is correct.

### Issue: CI matrix fails for future phases

**Solution**: Ensure placeholder scripts exist even if empty

### Issue: Coverage thresholds not applied

**Solution**: Update vitest.config.ts with phase-specific paths

## Phase Timeline Estimates

| Phase | Feature        | Duration | Dependencies  |
| ----- | -------------- | -------- | ------------- |
| 1     | Authentication | 1 week   | None          |
| 2     | Dashboard      | 1 week   | Phase 1       |
| 3     | Booking        | 2 weeks  | Phase 1, 2    |
| 4     | Financial      | 2 weeks  | Phase 1, 2, 3 |
| 5     | Deployment     | 3 days   | All phases    |

## Related Documentation

- [Agent_Delegation_Matrix.md](./Agent_Delegation_Matrix.md) - Agent assignments
- [TDD_Master_Plan.md](./TDD_Master_Plan.md) - Overall strategy
- [Verification_Protocol.md](./Verification_Protocol.md) - Quality gates
- [phases/](./phases/) - Phase-specific documentation

---

_Document Owner: zustand-tanstack-resort-architect_  
_Review Status: Ready for Implementation_  
_Priority: HIGH - Enables CI Matrix Testing_
