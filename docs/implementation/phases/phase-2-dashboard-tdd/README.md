# Phase 2: Staff Operations Dashboard TDD Implementation

> ⚠️ **INTERNAL USE ONLY** - Dashboard designed for resort staff operational efficiency. No customer-facing metrics.

> **📊 Status**: ⏳ Pending | **Tests**: 0/200 | **Coverage**: 0%  
> **📍 Source of Truth**: [Master Verification Index](../MASTER_VERIFICATION_INDEX.md#phase-2-dashboard)  
> **📝 Note**: Reference patterns documented in [2-5-verification-handoff.md](./2-5-verification-handoff.md)

## Overview

Phase 2 focuses on implementing a staff operations dashboard using Test-Driven Development (TDD) methodology. The dashboard provides real-time operational metrics, occupancy tracking, and quick actions for resort staff to manage daily operations efficiently.

**SCOPE CLARIFICATION**:
- ✅ Occupancy metrics and room status overview
- ✅ Today's check-ins/check-outs
- ✅ Payment status summary (tracking only)
- ✅ Staff task assignments
- ✅ Internal operational alerts
- ❌ ~~Customer analytics~~ (NOT APPLICABLE - Internal use only)
- ❌ ~~Marketing metrics~~ (NOT APPLICABLE - No customer features)
- ❌ ~~Revenue processing~~ (NOT APPLICABLE - Tracking only)

## Phase Objectives

1. **Build a Production-Ready Dashboard**: Implement a responsive, performant dashboard with real-time data updates
2. **Establish State Management Patterns**: Create reusable Zustand stores and TanStack Query patterns
3. **Implement Real-Time Synchronization**: Establish WebSocket connections and polling strategies for live data
4. **Optimize Performance**: Implement code splitting, lazy loading, and efficient re-render strategies
5. **Ensure Test Coverage**: Maintain 90%+ test coverage with comprehensive unit and integration tests

## Technical Architecture

### Core Technologies

- **React 19**: Leveraging useOptimistic, useActionState, and Suspense boundaries
- **Zustand**: Lightweight state management for UI state and optimistic updates
- **TanStack Query**: Server state management with intelligent caching and background refetching
- **TypeScript**: Full type safety across all components and stores
- **Vitest**: Fast unit testing with React Testing Library
- **Playwright**: E2E testing for critical user flows

### State Management Strategy

```typescript
// Three-layer state architecture
1. Server State (TanStack Query)
   - Booking data
   - Financial metrics
   - Activity logs

2. UI State (Zustand)
   - Dashboard preferences
   - Filter states
   - Optimistic updates queue

3. Local State (React)
   - Form inputs
   - Temporary UI states
```

## Dashboard Components

### 1. Metrics Display Section
- **Today's Check-ins/Check-outs**: Real-time counter with guest details
- **Occupancy Rate**: Visual indicator with trend analysis
- **Revenue Metrics**: Today's revenue, pending payments, monthly comparison
- **Performance KPIs**: Average booking value, cancellation rate

### 2. Real-Time Activity Feed
- **Recent Bookings**: Last 10 bookings with guest info and room details
- **Financial Activities**: Recent payments, expenses, refunds
- **System Events**: Staff actions, system alerts, maintenance notices

### 3. Quick Actions Panel
- **New Booking**: Quick booking creation with room availability check
- **Log Expense**: Fast expense entry with receipt upload
- **Guest Check-in**: Streamlined check-in process
- **Generate Reports**: One-click report generation

### 4. Data Visualization
- **Occupancy Chart**: 7-day occupancy trend
- **Revenue Graph**: Daily revenue comparison
- **Booking Sources**: Pie chart of booking channels

## Pre-Implementation Setup

Before starting Phase 2 implementation, run the scaffold script to create the necessary directory structure:

> 📚 **See Also**: [Scaffold Scripts Reference](../../SCAFFOLD_SCRIPTS_REFERENCE.md) | [Composite Scripts Guide](../../COMPOSITE_SCRIPTS_GUIDE.md)

```bash
# Run the scaffold script for Phase 2
npm run scaffold:phase2

# This will:
# 1. Display the path to this documentation
# 2. Create all necessary directories:
#    - src/features/dashboard/components/
#    - src/features/dashboard/hooks/
#    - src/features/dashboard/stores/
#    - src/features/dashboard/types/
#    - src/features/dashboard/__tests__/
# 3. Add .gitkeep files to preserve empty directories
```

## NPM Scripts

### Phase 2 Specific Commands

```json
{
  "scripts": {
    // Scaffolding - Create directory structure and show documentation
    "scaffold:phase2": "echo 'Phase 2: Dashboard - See docs/implementation/phases/phase-2-dashboard-tdd/README.md' && npm run scaffold:phase2:dirs",
    "scaffold:phase2:dirs": "mkdir -p src/features/dashboard/{components,hooks,stores,types,__tests__} && touch src/features/dashboard/__tests__/.gitkeep",
    
    // Testing - Run Phase 2 dashboard tests
    "test:phase2": "vitest run src/features/dashboard/**/__tests__/*.test.{ts,tsx}",
    "test:phase2:coverage": "vitest run --coverage src/features/dashboard/**/__tests__/*.test.{ts,tsx}",
    "test:phase2:watch": "vitest watch src/features/dashboard/**/__tests__/*.test.{ts,tsx}"
  }
}
```

### TDD Workflow Commands

```bash
# RED Phase - Write failing tests
npm run scaffold:phase2           # Get dashboard test specifications
npm run test:phase2               # Run tests (should fail initially)

# GREEN Phase - Implement until tests pass
npm run test:phase2:watch         # Watch mode for rapid development
npm run test:phase2               # Verify all tests pass

# REFACTOR Phase - Optimize performance
npm run test:phase2:coverage      # Check coverage meets 90% requirement

# Performance verification
npm run build && npm run preview  # Test production build
npm run verify:performance        # Run Lighthouse checks

# Integration with Phase 1
npm run test:phase1 && npm run test:phase2  # Ensure auth works before dashboard
```

### Coverage Requirements

- **Minimum Coverage**: 90% (standard dashboard components)
- **Critical Paths**: 95% for financial metrics and calculations
- **Integration Tests**: 85% coverage required
- **E2E Tests**: Key user journeys (view metrics, quick actions)
- **Performance Tests**: Core Web Vitals must pass

### Common Phase 2 Testing Issues

| Issue | Solution |
|-------|---------|
| Tests not found | Ensure tests are in `src/features/dashboard/**/__tests__/` |
| Coverage below 90% | Add tests for loading and error states |
| Mock data inconsistent | Use centralized mock factories |
| WebSocket tests failing | Mock WebSocket connections properly |
| TanStack Query errors | Configure QueryClient for testing |
| Zustand store issues | Reset stores between tests |

## Implementation Phases

### Sub-Phase 2.1: Test Metrics Display (RED)
- Write comprehensive tests for all metric components
- Define data structures and TypeScript interfaces
- Create mock data generators for testing
- Establish accessibility testing patterns

### Sub-Phase 2.2: Test Real-Time Updates (RED)
- Implement WebSocket connection tests
- Create polling mechanism tests
- Test optimistic update flows
- Define error recovery scenarios

### Sub-Phase 2.3: Implement Dashboard (GREEN)
- Build minimal metric card components
- Implement Zustand stores for dashboard state
- Create TanStack Query hooks for data fetching
- Establish basic real-time connections

### Sub-Phase 2.4: Performance Optimization (REFACTOR)
- Implement code splitting with React.lazy
- Optimize Zustand subscriptions
- Configure TanStack Query caching strategies
- Add virtual scrolling for activity feeds

### Sub-Phase 2.5: Verification & Handoff
- Complete integration testing
- Performance benchmarking
- Documentation review
- Handoff to Phase 3 (Booking Management)

## Success Criteria

### Functional Requirements
- [ ] Dashboard loads in < 2 seconds on 3G connection
- [ ] All metrics update within 500ms of data change
- [ ] Real-time updates work across multiple browser tabs
- [ ] Offline mode preserves user actions and syncs when online
- [ ] Mobile responsive design works on all screen sizes

### Technical Requirements
- [ ] 90%+ test coverage for all dashboard components
- [ ] TypeScript strict mode with no any types
- [ ] Lighthouse score > 90 for performance
- [ ] Zero runtime errors in production
- [ ] Bundle size < 200KB for initial dashboard load

### Performance Metrics
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3.5s
- [ ] Cumulative Layout Shift < 0.1
- [ ] No memory leaks after 1 hour of usage
- [ ] Smooth 60fps scrolling on activity feed

## State Management Patterns

### Zustand Store Architecture

```typescript
// Dashboard UI Store
interface DashboardStore {
  // State
  dateRange: DateRange;
  activeMetrics: MetricType[];
  refreshInterval: number;
  
  // Actions
  setDateRange: (range: DateRange) => void;
  toggleMetric: (metric: MetricType) => void;
  setRefreshInterval: (interval: number) => void;
  
  // Computed
  isRealTimeEnabled: () => boolean;
}

// Optimistic Updates Store
interface OptimisticStore {
  pendingUpdates: Map<string, OptimisticUpdate>;
  addUpdate: (update: OptimisticUpdate) => void;
  resolveUpdate: (id: string) => void;
  revertUpdate: (id: string) => void;
}
```

### TanStack Query Configuration

```typescript
// Query Client Configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: true,
      retry: 3,
    },
    mutations: {
      onError: (error) => {
        // Global error handling
      },
    },
  },
});

// Real-time Synchronization
const useRealTimeMetrics = () => {
  return useQuery({
    queryKey: ['metrics', 'realtime'],
    queryFn: fetchMetrics,
    refetchInterval: 5000, // Poll every 5 seconds
    refetchIntervalInBackground: true,
  });
};
```

## Testing Strategy

### Unit Testing Focus
- Individual metric card components
- Zustand store actions and selectors
- TanStack Query hooks behavior
- Utility functions and formatters

### Integration Testing Focus
- Dashboard data flow from API to UI
- Real-time update mechanisms
- Error handling and recovery
- State synchronization across stores

### E2E Testing Focus
- Complete dashboard loading flow
- Quick action workflows
- Real-time update verification
- Performance under load

## Development Workflow

1. **RED Phase**: Write failing tests that define expected behavior
2. **GREEN Phase**: Implement minimal code to make tests pass
3. **REFACTOR Phase**: Optimize implementation while maintaining green tests
4. **REVIEW Phase**: Code review, documentation updates, and handoff preparation

## Risk Mitigation

### Technical Risks
- **WebSocket Connection Stability**: Implement automatic reconnection with exponential backoff
- **Data Consistency**: Use optimistic locking and conflict resolution strategies
- **Performance Degradation**: Implement progressive enhancement and lazy loading
- **Memory Leaks**: Regular profiling and cleanup of subscriptions

### Business Risks
- **Data Accuracy**: Implement data validation and reconciliation processes
- **User Adoption**: Focus on intuitive UX with helpful onboarding
- **Scalability**: Design for horizontal scaling from day one

## Dependencies

### External Dependencies
- `react`: ^19.0.0
- `zustand`: ^5.0.2
- `@tanstack/react-query`: ^6.0.0
- `@tanstack/react-query-devtools`: ^6.0.0
- `recharts`: ^2.15.0 (for data visualization)
- `date-fns`: ^4.1.0 (for date manipulation)

### Internal Dependencies
- Phase 1: Authentication system for user context
- API Layer: RESTful endpoints for metrics data
- WebSocket Server: Real-time event streaming
- Design System: Shared UI components

## Handoff Requirements

### To Phase 3 (Booking Management)
- [ ] Completed dashboard with all metrics functional
- [ ] Established state management patterns documented
- [ ] TanStack Query patterns for reuse
- [ ] Performance benchmarks documented
- [ ] Test suite with 90%+ coverage
- [ ] Technical debt log with prioritization

## Agent Responsibilities

### Lead Agent: React State Management Expert
- Primary implementation of Zustand stores
- TanStack Query pattern establishment
- Performance optimization strategies
- Code review and quality assurance

### Supporting Agents
- **Testing Agent**: Test case creation and validation
- **UI/UX Agent**: Component design and accessibility
- **DevOps Agent**: CI/CD pipeline updates
- **Documentation Agent**: API documentation and guides

## Timeline

- **Week 1**: Sub-phases 2.1 and 2.2 (RED phase - test creation)
- **Week 2**: Sub-phase 2.3 (GREEN phase - implementation)
- **Week 3**: Sub-phase 2.4 (REFACTOR phase - optimization)
- **Week 4**: Sub-phase 2.5 (Verification and handoff)

## Success Metrics

### Quantitative Metrics
- Test coverage > 90%
- Dashboard load time < 2 seconds
- Zero critical bugs in production
- 99.9% uptime for real-time features

### Qualitative Metrics
- User satisfaction score > 4.5/5
- Development team confidence in codebase
- Clear documentation and knowledge transfer
- Reusable patterns for future phases

## References

- [React 19 Documentation](https://react.dev)
- [Zustand Best Practices](https://github.com/pmndrs/zustand)
- [TanStack Query Documentation](https://tanstack.com/query)
- [Testing Library Best Practices](https://testing-library.com/docs/react-testing-library/intro/)
- [Web Vitals Performance Metrics](https://web.dev/vitals/)

---

**Phase Status**: Ready to Begin
**Last Updated**: 2025-01-28
**Lead Agent**: React State Management Expert
**Next Review**: End of Sub-phase 2.1