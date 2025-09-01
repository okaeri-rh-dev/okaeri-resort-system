# Phase Scaffolding Requirements

## Overview

This document specifies the complete scaffolding requirements for Phases 2-5 of
the Okaeri Resort Management System TDD implementation. It ensures CI/CD
pipeline compatibility, provides clear structure for future phase development,
and serves as the authoritative guide for phase scaffolding.

**Owner**: zustand-tanstack-resort-architect  
**Status**: Required for CI Matrix Compatibility  
**Last Updated**: August 31, 2025  
**Related**: [PHASE_PROGRESSION_STRATEGY.md](./PHASE_PROGRESSION_STRATEGY.md)

## Critical Requirements Summary

### Why These Scripts Must Exist Now

1. **CI Matrix Dependency**: The GitHub Actions CI matrix expects these scripts
   to exist
2. **Prevent CI Failures**: Missing scripts cause workflow failures even for
   placeholder phases
3. **Documentation References**: Multiple docs reference these scripts as part
   of the roadmap
4. **Developer Experience**: Clear commands show what's coming in future phases
5. **TDD Preparation**: Scaffolding enables immediate test-first development
   when phases begin

### Complete Script Reference

For comprehensive details about all scaffold scripts, exact command syntax,
directory structures, and TDD workflow integration, see:

**[SCAFFOLD_SCRIPTS_REFERENCE.md](./SCAFFOLD_SCRIPTS_REFERENCE.md)**

This companion document provides:

- Detailed command documentation for each phase
- Complete directory structure specifications
- TDD workflow integration guidelines
- CI/CD pipeline integration patterns
- Troubleshooting guides and best practices

## Cross-Platform Scaffolding Support

### Node.js Scaffolding Script (Recommended for Windows/Mac/Linux)

**NEW**: A cross-platform Node.js script is now available at
`scripts/scaffold-phase.cjs` that works on all platforms without requiring bash
or shell-specific features.

#### Usage:

```bash
# Scaffold individual phases
npm run scaffold:phase2    # Uses Node.js script
npm run scaffold:phase3    # Uses Node.js script
npm run scaffold:phase4    # Uses Node.js script
npm run scaffold:phase5    # Uses Node.js script

# Scaffold all phases at once
npm run scaffold:all-phases   # Uses Node.js script

# Direct script usage
node scripts/scaffold-phase.cjs 2     # Scaffold Phase 2
node scripts/scaffold-phase.cjs all   # Scaffold all phases
```

#### Features:

- Works on Windows, Mac, and Linux
- No bash or shell dependencies
- Idempotent (safe to run multiple times)
- Clear console output with color coding
- Creates directories with proper path separators
- Handles .gitkeep files and placeholder type files
- Provides helpful error messages

### Bash Scripts (Legacy - Linux/Mac Only)

For Linux and Mac users who prefer bash, the original bash scripts are still
available:

```bash
npm run scaffold:phase2:bash    # Uses bash with brace expansion
npm run scaffold:phase3:bash    # Uses bash with brace expansion
npm run scaffold:phase4:bash    # Uses bash with brace expansion
npm run scaffold:phase5:bash    # Uses bash with brace expansion
npm run scaffold:all-phases:bash   # Uses bash scripts
```

**Note**: These bash scripts use features like `mkdir -p` with brace expansion
(`{components,hooks,stores}`) that don't work on Windows.

## Phase Scripts Requirements

### 1. Complete Package.json Phase Scripts

Add ALL these scripts to package.json to enable CI matrix testing. These MUST be
added even as placeholders:

```json
{
  "scripts": {
    // Phase 1 (Already exists)
    "scaffold:phase1": "echo 'See docs/implementation/phases/phase-1-login-tdd/PHASE_1_FORM_TEST_SPECIFICATIONS.md'",
    "test:phase1": "vitest run src/features/auth/**/__tests__/*.test.{ts,tsx}",
    "test:phase1:coverage": "vitest run --coverage src/features/auth/**/__tests__/*.test.{ts,tsx}",
    "test:phase1:watch": "vitest watch src/features/auth/**/__tests__/*.test.{ts,tsx}",

    // Phase 2: Dashboard & State Management
    "scaffold:phase2": "echo 'Phase 2: Dashboard - See docs/implementation/phases/phase-2-dashboard-tdd/README.md' && npm run scaffold:phase2:dirs",
    "scaffold:phase2:dirs": "mkdir -p src/features/dashboard/{components,hooks,stores,types,__tests__} && touch src/features/dashboard/__tests__/.gitkeep",
    "test:phase2": "vitest run src/features/dashboard/**/__tests__/*.test.{ts,tsx}",
    "test:phase2:coverage": "vitest run --coverage src/features/dashboard/**/__tests__/*.test.{ts,tsx}",
    "test:phase2:watch": "vitest watch src/features/dashboard/**/__tests__/*.test.{ts,tsx}",
    "test:phase2:unit": "vitest run src/features/dashboard/**/__tests__/*.unit.test.{ts,tsx}",
    "test:phase2:integration": "vitest run src/features/dashboard/**/__tests__/*.integration.test.{ts,tsx}",

    // Phase 3: Booking System
    "scaffold:phase3": "echo 'Phase 3: Booking - See docs/implementation/phases/phase-3-booking-tdd/README.md' && npm run scaffold:phase3:dirs",
    "scaffold:phase3:dirs": "mkdir -p src/features/booking/{components,hooks,stores,types,__tests__} && touch src/features/booking/__tests__/.gitkeep",
    "test:phase3": "vitest run src/features/booking/**/__tests__/*.test.{ts,tsx}",
    "test:phase3:coverage": "vitest run --coverage src/features/booking/**/__tests__/*.test.{ts,tsx}",
    "test:phase3:watch": "vitest watch src/features/booking/**/__tests__/*.test.{ts,tsx}",
    "test:phase3:unit": "vitest run src/features/booking/**/__tests__/*.unit.test.{ts,tsx}",
    "test:phase3:integration": "vitest run src/features/booking/**/__tests__/*.integration.test.{ts,tsx}",

    // Phase 4: Financial Management
    "scaffold:phase4": "echo 'Phase 4: Financial - See docs/implementation/phases/phase-4-financial-tdd/README.md' && npm run scaffold:phase4:dirs",
    "scaffold:phase4:dirs": "mkdir -p src/features/financial/{components,hooks,stores,types,__tests__} && touch src/features/financial/__tests__/.gitkeep",
    "test:phase4": "vitest run src/features/financial/**/__tests__/*.test.{ts,tsx}",
    "test:phase4:coverage": "vitest run --coverage src/features/financial/**/__tests__/*.test.{ts,tsx}",
    "test:phase4:watch": "vitest watch src/features/financial/**/__tests__/*.test.{ts,tsx}",
    "test:phase4:unit": "vitest run src/features/financial/**/__tests__/*.unit.test.{ts,tsx}",
    "test:phase4:integration": "vitest run src/features/financial/**/__tests__/*.integration.test.{ts,tsx}",

    // Phase 5: Production Deployment
    "scaffold:phase5": "echo 'Phase 5: Deployment - See docs/implementation/phases/phase-5-deployment/README.md' && npm run scaffold:phase5:dirs",
    "scaffold:phase5:dirs": "mkdir -p src/features/deployment/{components,utils,__tests__} && touch src/features/deployment/__tests__/.gitkeep",
    "test:phase5": "vitest run src/features/deployment/**/__tests__/*.test.{ts,tsx}",
    "test:phase5:coverage": "vitest run --coverage src/features/deployment/**/__tests__/*.test.{ts,tsx}",
    "test:phase5:watch": "vitest watch src/features/deployment/**/__tests__/*.test.{ts,tsx}",
    "test:phase5:e2e": "playwright test --project=phase5",

    // Composite scripts for all phases
    "scaffold:all-phases": "npm run scaffold:phase2:dirs && npm run scaffold:phase3:dirs && npm run scaffold:phase4:dirs && npm run scaffold:phase5:dirs",
    "test:all-phases": "npm run test:phase1 && npm run test:phase2 && npm run test:phase3 && npm run test:phase4 && npm run test:phase5",
    "test:all-phases:coverage": "vitest run --coverage src/features/**/__tests__/*.test.{ts,tsx}",
    "test:all-phases:parallel": "concurrently \"npm run test:phase1\" \"npm run test:phase2\" \"npm run test:phase3\" \"npm run test:phase4\" \"npm run test:phase5\"",
    "test:active-phases": "npm run test:phase1",
    "test:future-phases": "npm run test:phase2 && npm run test:phase3 && npm run test:phase4 && npm run test:phase5"
  }
}
```

### 2. Critical Script Implementation Notes

**Why ALL these scripts MUST exist now:**

1. **CI Matrix Compatibility**: GitHub Actions matrix strategy references
   test:phase[1-5]:coverage
2. **Prevent Workflow Failures**: Missing scripts cause the entire CI pipeline
   to fail
3. **Documentation Contract**: Multiple documents reference these exact script
   names
4. **Progressive Development**: Scripts act as contracts for future
   implementation
5. **No False Positives**: Empty directories with .gitkeep return zero tests
   (success, not failure)
6. **Developer Onboarding**: New developers can see the complete roadmap via npm
   scripts

**Implementation Priority:**

- 🚨 **CRITICAL**: Add all scripts to package.json immediately
- 🚨 **CRITICAL**: Run `npm run scaffold:all-phases` to create directory
  structure
- ✅ **SAFE**: Empty test directories won't break CI (they'll report 0 tests)

## Directory Structure Requirements

### Complete Directory Creation Commands

```bash
# One-time setup: Create all phase directories
npm run scaffold:all-phases

# Or manually create each phase:
mkdir -p src/features/dashboard/{components,hooks,stores,types,__tests__}
mkdir -p src/features/booking/{components,hooks,stores,types,__tests__}
mkdir -p src/features/financial/{components,hooks,stores,types,__tests__}
mkdir -p src/features/deployment/{components,utils,__tests__}

# Add .gitkeep files to preserve empty directories
touch src/features/dashboard/__tests__/.gitkeep
touch src/features/booking/__tests__/.gitkeep
touch src/features/financial/__tests__/.gitkeep
touch src/features/deployment/__tests__/.gitkeep

# Create placeholder type files
echo "// Phase 2 Dashboard Types\nexport {};" > src/features/dashboard/types/index.ts
echo "// Phase 3 Booking Types\nexport {};" > src/features/booking/types/index.ts
echo "// Phase 4 Financial Types\nexport {};" > src/features/financial/types/index.ts
echo "// Phase 5 Deployment Types\nexport {};" > src/features/deployment/utils/index.ts
```

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
│   │   ├── components/         # React components
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── MetricsCard.tsx
│   │   │   ├── OccupancyChart.tsx
│   │   │   ├── RevenueWidget.tsx
│   │   │   └── StaffSchedule.tsx
│   │   ├── hooks/              # Custom hooks
│   │   │   ├── useDashboard.ts
│   │   │   ├── useMetrics.ts
│   │   │   └── useRealTimeUpdates.ts
│   │   ├── stores/             # Zustand stores
│   │   │   ├── dashboardStore.ts
│   │   │   └── metricsStore.ts
│   │   ├── types/              # TypeScript types
│   │   │   ├── dashboard.types.ts
│   │   │   └── metrics.types.ts
│   │   └── __tests__/          # Test files
│   │       ├── .gitkeep
│   │       ├── DashboardLayout.test.tsx
│   │       ├── dashboard.integration.test.ts
│   │       └── dashboardStore.test.ts
│   │
│   ├── booking/                # Phase 3: Booking Management
│   │   ├── components/         # React components
│   │   │   ├── BookingForm.tsx
│   │   │   ├── BookingCalendar.tsx
│   │   │   ├── RoomSelector.tsx
│   │   │   ├── GuestDetails.tsx
│   │   │   ├── PaymentMethods.tsx  # Philippine payment integrations
│   │   │   └── BookingConfirmation.tsx
│   │   ├── hooks/              # Custom hooks
│   │   │   ├── useBooking.ts
│   │   │   ├── useAvailability.ts
│   │   │   ├── useOptimisticBooking.ts
│   │   │   └── usePricing.ts
│   │   ├── stores/             # Zustand stores
│   │   │   ├── bookingStore.ts
│   │   │   ├── availabilityStore.ts
│   │   │   └── guestStore.ts
│   │   ├── types/              # TypeScript types
│   │   │   ├── booking.types.ts
│   │   │   ├── room.types.ts
│   │   │   └── payment.types.ts
│   │   └── __tests__/          # Test files
│   │       ├── .gitkeep
│   │       ├── BookingForm.test.tsx
│   │       ├── booking.integration.test.ts
│   │       └── optimisticBooking.test.ts
│   │
│   ├── financial/              # Phase 4: Financial Features
│   │   ├── components/         # React components
│   │   │   ├── ExpenseForm.tsx
│   │   │   ├── RevenueReport.tsx
│   │   │   ├── PaymentProcessor.tsx
│   │   │   ├── BIRCompliance.tsx    # Philippine BIR requirements
│   │   │   ├── ReceiptGenerator.tsx
│   │   │   ├── TaxCalculator.tsx
│   │   │   └── ApprovalWorkflow.tsx
│   │   ├── hooks/              # Custom hooks
│   │   │   ├── useFinancial.ts
│   │   │   ├── useReceipts.ts
│   │   │   ├── useTaxCalculation.ts
│   │   │   └── useApprovals.ts
│   │   ├── stores/             # Zustand stores
│   │   │   ├── financialStore.ts
│   │   │   ├── expenseStore.ts
│   │   │   ├── revenueStore.ts
│   │   │   └── approvalStore.ts
│   │   ├── types/              # TypeScript types
│   │   │   ├── financial.types.ts
│   │   │   ├── expense.types.ts
│   │   │   ├── tax.types.ts
│   │   │   └── receipt.types.ts
│   │   └── __tests__/          # Test files
│   │       ├── .gitkeep
│   │       ├── ExpenseForm.test.tsx
│   │       ├── BIRCompliance.test.tsx
│   │       ├── financial.integration.test.ts
│   │       └── taxCalculation.test.ts
│   │
│   └── deployment/             # Phase 5: Deployment Tools
│       ├── components/         # React components
│       │   ├── HealthCheck.tsx
│       │   ├── MaintenanceMode.tsx
│       │   ├── OfflineIndicator.tsx
│       │   ├── SyncStatus.tsx
│       │   └── UpdateNotification.tsx
│       ├── utils/              # Utility functions
│       │   ├── deployment.utils.ts
│       │   ├── serviceWorker.ts
│       │   ├── offlineQueue.ts
│       │   └── pwaConfig.ts
│       └── __tests__/          # Test files
│           ├── .gitkeep
│           ├── HealthCheck.test.tsx
│           ├── offlineSync.test.ts
│           └── pwa.e2e.test.ts
```

### File Naming Conventions

#### Component Files

- **Components**: `PascalCase.tsx` (e.g., `BookingForm.tsx`)
- **Hooks**: `camelCase.ts` starting with `use` (e.g., `useBooking.ts`)
- **Stores**: `camelCase.ts` ending with `Store` (e.g., `bookingStore.ts`)
- **Types**: `camelCase.types.ts` (e.g., `booking.types.ts`)
- **Tests**: Match source file with `.test.{ts,tsx}` extension

#### Test File Patterns

- **Unit Tests**: `ComponentName.test.tsx` or `fileName.test.ts`
- **Integration Tests**: `feature.integration.test.ts`
- **E2E Tests**: `feature.e2e.test.ts`

#### Import Aliases

```typescript
// tsconfig.json paths configuration
{
  "paths": {
    "@/features/dashboard/*": ["src/features/dashboard/*"],
    "@/features/booking/*": ["src/features/booking/*"],
    "@/features/financial/*": ["src/features/financial/*"],
    "@/features/deployment/*": ["src/features/deployment/*"]
  }
}
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

### Issue: Scaffolding scripts fail on Windows

**Problem**: Bash scripts using brace expansion don't work on Windows CMD or
PowerShell

**Solution**: Use the Node.js scaffolding script instead:

```bash
# Instead of bash scripts with brace expansion
npm run scaffold:phase2:bash  # Won't work on Windows

# Use the cross-platform Node.js script
npm run scaffold:phase2  # Works everywhere
```

### Issue: "require is not defined" error when running scaffold script

**Problem**: The project uses ES modules (`"type": "module"` in package.json)

**Solution**: The script is named with `.cjs` extension to use CommonJS:

```bash
node scripts/scaffold-phase.cjs 2  # Correct - uses .cjs extension
```

### Issue: Permission denied when running scaffold script

**Solution**: The script doesn't need execute permissions. Run with Node.js:

```bash
node scripts/scaffold-phase.cjs 2  # No chmod needed
```

## Phase Dependencies and Integration Points

### Phase Dependency Matrix

| Phase | Depends On | Provides To | Integration Points                                 |
| ----- | ---------- | ----------- | -------------------------------------------------- |
| 1     | None       | All         | Auth context, User session, JWT tokens             |
| 2     | Phase 1    | 3, 4, 5     | Metrics API, Dashboard widgets, Real-time updates  |
| 3     | 1, 2       | 4, 5        | Booking data, Availability state, Guest management |
| 4     | 1, 2, 3    | 5           | Financial records, Tax calculations, Receipts      |
| 5     | All        | -           | PWA features, Offline sync, Performance monitoring |

### Store Dependencies

```typescript
// Example of store dependencies across phases
// Phase 2: Dashboard uses auth from Phase 1
import { useAuthStore } from "@/features/auth/stores/authStore";
import { useDashboardStore } from "@/features/dashboard/stores/dashboardStore";

// Phase 3: Booking uses auth and dashboard
import { useBookingStore } from "@/features/booking/stores/bookingStore";

// Phase 4: Financial uses all previous stores
import { useFinancialStore } from "@/features/financial/stores/financialStore";
```

## Phase Timeline Estimates

| Phase | Feature        | Duration | Start Week | Dependencies  | Critical Path |
| ----- | -------------- | -------- | ---------- | ------------- | ------------- |
| 1     | Authentication | 1 week   | Week 1     | None          | ✅ Critical   |
| 2     | Dashboard      | 1 week   | Week 2     | Phase 1       | ✅ Critical   |
| 3     | Booking        | 2 weeks  | Week 3-4   | Phase 1, 2    | ✅ Critical   |
| 4     | Financial      | 2 weeks  | Week 5-6   | Phase 1, 2, 3 | ✅ Critical   |
| 5     | Deployment     | 3 days   | Week 7     | All phases    | ✅ Critical   |

## Implementation Checklist

### Immediate Actions Required

- [ ] Add all phase scripts to package.json
- [ ] Run `npm run scaffold:all-phases` to create directories
- [ ] Verify CI pipeline recognizes all scripts
- [ ] Create phase README files in docs/implementation/phases/
- [ ] Update CI matrix configuration if needed

### Per-Phase Checklist Template

```markdown
## Phase [X] Implementation Checklist

### Setup

- [ ] Run `npm run scaffold:phase[X]`
- [ ] Create initial test files
- [ ] Configure store boilerplate
- [ ] Set up types definitions

### RED Phase

- [ ] Write failing component tests
- [ ] Write failing integration tests
- [ ] Write failing store tests
- [ ] Verify all tests fail correctly

### GREEN Phase

- [ ] Implement minimal components
- [ ] Implement store logic
- [ ] Connect to TanStack Query
- [ ] All tests passing

### REFACTOR Phase

- [ ] Optimize performance
- [ ] Add error boundaries
- [ ] Implement loading states
- [ ] Add accessibility features
```

## Implementation Reference

For detailed implementation guidance, see:

### Primary Reference

- **[SCAFFOLD_SCRIPTS_REFERENCE.md](./SCAFFOLD_SCRIPTS_REFERENCE.md)** -
  Complete scaffold command reference with exact syntax, directory structures,
  and TDD workflow integration

### Supporting Documentation

- [PHASE_PROGRESSION_STRATEGY.md](./PHASE_PROGRESSION_STRATEGY.md) - Detailed
  phase progression and dependencies
- [Agent_Delegation_Matrix.md](./Agent_Delegation_Matrix.md) - Agent assignments
- [TDD_Master_Plan.md](./TDD_Master_Plan.md) - Overall strategy
- [Verification_Protocol.md](./Verification_Protocol.md) - Quality gates
- [phases/](./phases/) - Phase-specific documentation

### Quick Start Commands

```bash
# View complete script documentation
cat docs/implementation/SCAFFOLD_SCRIPTS_REFERENCE.md

# Create all phase directories at once
npm run scaffold:all-phases

# Create individual phase directories
npm run scaffold:phase2
npm run scaffold:phase3
npm run scaffold:phase4
npm run scaffold:phase5
```

---

_Document Owner: zustand-tanstack-resort-architect_  
_Review Status: Ready for Implementation_  
_Priority: HIGH - Enables CI Matrix Testing_  
_Implementation Guide:
[SCAFFOLD_SCRIPTS_REFERENCE.md](./SCAFFOLD_SCRIPTS_REFERENCE.md)_
