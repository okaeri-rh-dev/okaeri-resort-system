# TDD-First Rewrite Master Plan

## Executive Summary

This document outlines the comprehensive Test-Driven Development (TDD) approach
for rebuilding the Okaeri Resort Management System. After completing Phase 1
infrastructure, we are pivoting to a strict TDD methodology to ensure quality,
maintainability, and reliability.

## Project Status

### Current State

- **Phase 1 Complete**: Infrastructure, routing, state management, security
  layers implemented
- **Challenge**: UI implementation lacks comprehensive testing and proper TDD
  approach
- **Decision**: Clean slate for UI components while preserving valuable
  infrastructure

### Infrastructure to Preserve

#### Core Technologies (Keep As-Is)

- **Build System**: Vite 7 + React 19 + TypeScript
- **Routing**: TanStack Router with file-based routing
- **State Management**: Zustand stores with security integration
- **Server State**: TanStack Query for data fetching
- **Security**: JWT auth, CSRF protection, rate limiting, audit logging
- **Database**: Neon PostgreSQL with multi-tenant schema
- **Styling**: Tailwind CSS v4 + shadcn/ui components

#### Valuable Code to Preserve

```
/src/lib/           # All infrastructure code
/src/stores/        # Zustand stores with optimistic updates
/src/types/         # TypeScript type definitions
/src/mocks/         # Mock services for development
/api/               # API route templates
/migrations/        # Database migrations
/tests/utils/       # Test utilities and helpers
```

### Components to Rewrite with TDD

#### UI Layer (Complete Rewrite)

```
/src/pages/         # All page components
/src/components/    # UI components (except /ui folder)
/src/routes/        # Route components (except __root.tsx)
/src/layouts/       # Layout components
```

## TDD Methodology

### Core Principles

1. **Red-Green-Refactor Cycle**
   - RED: Write failing tests first (define the contract)
   - GREEN: Write minimal code to pass tests
   - REFACTOR: Improve code quality while keeping tests green

2. **Test-First Development**
   - NO implementation without failing tests
   - Tests are the specification
   - Tests drive the design

3. **Agent-Driven Quality**
   - Specialized agents handle specific domains
   - Clear handoff protocols between agents
   - Verification at each transition

### Testing Requirements

#### Coverage Targets

- **Unit Tests**: 90% minimum coverage
- **Integration Tests**: All user flows covered
- **E2E Tests**: Critical business paths
- **Performance Tests**: Core Web Vitals green
- **Security Tests**: All auth flows validated
- **Accessibility Tests**: WCAG 2.1 AA compliance

#### Test Categories

1. **Component Tests**: UI behavior and rendering
2. **Store Tests**: State management logic
3. **API Tests**: Mock service validation
4. **Integration Tests**: Component + Store + API
5. **E2E Tests**: Complete user journeys

## Development Workflow

### Phase 0: Foundation & Cleanup (Week 1, Days 1-2)

**Lead Agent**: `context-manager` **Support**: `security-compliance-auditor`

#### Tasks

1. Archive previous implementation
2. Clean repository structure
3. Set up test infrastructure
4. Configure mock API layer
5. Create agent handoff protocols

#### Deliverables

- Clean repository with preserved infrastructure
- Comprehensive test setup
- Mock API architecture
- Agent assignment matrix

### Phase 1: Login System TDD (Week 1, Days 3-5)

**Test Lead**: `typescript-react-quality-expert` **Implementation Lead**:
`modern-form-validation-expert` **Polish Lead**: `resort-ui-designer`

#### Test Phase (RED)

```typescript
// Tests to write BEFORE implementation
describe("LoginPage", () => {
  it("should render login form");
  it("should validate email format");
  it("should validate password requirements");
  it("should handle successful login");
  it("should handle failed login");
  it("should show loading state");
  it("should redirect after login");
  it("should handle network errors");
  it("should prevent XSS attacks");
  it("should be accessible");
});
```

#### Implementation Phase (GREEN)

- Minimal LoginPage component
- Form validation with React Hook Form + Zod
- Connection to auth store
- Error handling

#### Refactor Phase

- Mobile optimization
- Loading states
- Accessibility enhancements
- Performance optimization

### Phase 2: Dashboard TDD (Week 2)

**Test Lead**: `typescript-react-quality-expert` **Implementation Lead**:
`zustand-tanstack-resort-architect` **Performance Lead**:
`pwa-performance-optimizer`

#### Focus Areas

- Metric cards display
- Real-time data updates
- Responsive grid layout
- Skeleton loading states
- Error boundaries

### Phase 3: Booking Calendar TDD (Week 3)

**Test Lead**: `typescript-react-quality-expert` **UI Lead**:
`resort-ui-designer` **Data Lead**: `postgres-serverless-architect`

#### Focus Areas

- Calendar component
- Availability checking
- Booking creation/editing
- Drag-and-drop interactions
- Mobile touch support

### Phase 4: Financial Management TDD (Week 4)

**Test Lead**: `typescript-react-quality-expert` **Implementation Lead**:
`resort-finance-architect` **Validation Lead**: `security-compliance-auditor`

#### Focus Areas

- Expense tracking
- Income management
- Report generation
- Philippine tax compliance
- Data export

### Phase 5: Integration & Deployment (Week 5)

**Lead**: `vercel-deployment-optimizer` **Security**:
`security-compliance-auditor` **Performance**: `pwa-performance-optimizer`

#### Focus Areas

- Production build optimization
- Security hardening
- Performance tuning
- PWA features
- Monitoring setup

## Agent Delegation Strategy

### Agent Responsibility Matrix

| Agent                               | Primary Role                           | Handoff To            |
| ----------------------------------- | -------------------------------------- | --------------------- |
| `context-manager`                   | Repository setup, context preservation | All agents            |
| `typescript-react-quality-expert`   | Test writing, type safety              | Implementation agents |
| `modern-form-validation-expert`     | Form implementation                    | UI designer           |
| `resort-ui-designer`                | UI/UX polish                           | Performance optimizer |
| `zustand-tanstack-resort-architect` | State management                       | Quality expert        |
| `postgres-serverless-architect`     | Database design                        | API architect         |
| `resort-finance-architect`          | Financial features                     | Compliance auditor    |
| `security-compliance-auditor`       | Security review                        | Deployment optimizer  |
| `pwa-performance-optimizer`         | Performance tuning                     | Deployment optimizer  |
| `vercel-deployment-optimizer`       | Production deployment                  | Complete              |

### Handoff Protocol

Each handoff must include:

1. **Completion Report**: What was accomplished
2. **Test Results**: All passing tests
3. **Known Issues**: Any technical debt
4. **Next Steps**: Clear instructions
5. **Rollback Plan**: How to revert if needed

## Mock API Architecture

### Service Layer Design

```typescript
// Base service interface
interface BaseService<T> {
  list(filters?: any): Promise<T[]>;
  get(id: string): Promise<T>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

// Mock implementation with realistic delays
class MockBookingService implements BaseService<Booking> {
  private delay = () => simulateApiDelay(200, 800);

  async list(filters?: BookingFilters) {
    await this.delay();
    return this.filterBookings(mockBookings, filters);
  }

  // Include error scenarios
  async create(data: Partial<Booking>) {
    await this.delay();
    if (Math.random() < 0.1) {
      // 10% failure rate for testing
      throw new Error("Network error");
    }
    return { ...data, id: generateId() } as Booking;
  }
}
```

### Migration Strategy

1. Start with 100% mock services
2. Implement real API endpoints incrementally
3. Use feature flags for mock/real toggle
4. Maintain both until backend stable
5. Remove mocks only after full validation

## Success Criteria

### Quality Metrics

- ✅ **Test Coverage**: >90% for all components
- ✅ **Type Coverage**: 100% strict TypeScript
- ✅ **Performance**: Lighthouse >90 all metrics
- ✅ **Security**: Zero critical vulnerabilities
- ✅ **Accessibility**: WCAG 2.1 AA compliant
- ✅ **Bundle Size**: <200KB initial load (see
  [Performance Budgets](./Performance_Budgets.md) for detailed breakdown)
- ✅ **Error Rate**: <1% in production

### Delivery Milestones

| Week | Milestone          | Success Criteria          |
| ---- | ------------------ | ------------------------- |
| 1    | Login Complete     | All auth tests passing    |
| 2    | Dashboard Complete | Real-time updates working |
| 3    | Booking Complete   | Calendar fully functional |
| 4    | Financial Complete | Reports generating        |
| 5    | Production Ready   | All metrics green         |

## Risk Mitigation

### Identified Risks

1. **Test Coverage Gaps**
   - Mitigation: Mandatory coverage reports before merge
   - Owner: `typescript-react-quality-expert`

2. **Performance Regression**
   - Mitigation: Automated performance budgets
   - Owner: `pwa-performance-optimizer`

3. **Security Vulnerabilities**
   - Mitigation: Security review at each phase
   - Owner: `security-compliance-auditor`

4. **Agent Handoff Failures**
   - Mitigation: Detailed handoff checklists
   - Owner: `context-manager`

## Implementation Timeline

### Week-by-Week Breakdown

**Week 1: Foundation + Login**

- Mon-Tue: Repository cleanup, test setup
- Wed-Thu: Login TDD implementation
- Fri: Review and iteration

**Week 2: Dashboard**

- Mon-Tue: Dashboard tests and implementation
- Wed-Thu: Real-time features
- Fri: Performance optimization

**Week 3: Booking System**

- Mon-Tue: Calendar component
- Wed-Thu: Booking CRUD
- Fri: Integration testing

**Week 4: Financial Features**

- Mon-Tue: Expense/income management
- Wed-Thu: Report generation
- Fri: Compliance review

**Week 5: Production**

- Mon-Tue: Security hardening
- Wed-Thu: Performance tuning
- Fri: Deployment

## Conclusion

This TDD-first approach ensures we build a robust, maintainable, and
high-quality resort management system. By preserving valuable infrastructure
while rewriting UI components with comprehensive testing, we achieve the best of
both worlds: rapid development with guaranteed quality.

The strict adherence to TDD principles, combined with specialized agent
delegation and clear verification protocols, will result in a production-ready
system that meets all business requirements while maintaining exceptional code
quality.
