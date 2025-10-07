# Agent Assignment Matrix

## Overview

This document defines clear responsibilities for each specialized AI agent in the multi-unit booking implementation. Each agent is accountable for specific deliverables and success criteria.

## Agent Responsibility Matrix

| Agent                               | Primary Responsibilities                      | Phases     | Deliverables                                |
| ----------------------------------- | --------------------------------------------- | ---------- | ------------------------------------------- |
| `postgres-serverless-architect`     | Database schema, migrations, RLS, performance | Phase 1    | Schema DDL, migration scripts, RLS policies |
| `cloudflare-resort-api-architect`   | API endpoints, serverless functions, Workers  | Phase 2    | API specs, endpoint implementations         |
| `serverless-saas-architect`         | Multi-tenancy, architecture decisions         | Phase 1-2  | Architecture diagrams, design patterns      |
| `zustand-tanstack-resort-architect` | State management, TanStack Query hooks        | Phase 3    | Store implementations, query hooks          |
| `typescript-react-quality-expert`   | Type safety, code quality, patterns           | Phase 3-4  | Type definitions, quality standards         |
| `resort-ui-designer`                | Component design, UX flows, accessibility     | Phase 4    | Component specs, wireframes                 |
| `tailwind-v4-design-expert`         | Styling, design tokens, responsive design     | Phase 4    | Design system updates, CSS                  |
| `modern-form-validation-expert`     | Form handling, Zod schemas, validation        | Phase 4    | Form schemas, validation logic              |
| `tanstack-router-expert`            | Routing updates, route guards                 | Phase 4    | Route configurations                        |
| `code-quality-reviewer`             | Code review, quality assurance                | Phase 5    | Review reports, refactoring recommendations |
| `pwa-performance-optimizer`         | Performance testing, optimization             | Phase 5    | Performance benchmarks, optimization plan   |
| `security-compliance-auditor`       | Security review, compliance checks            | All Phases | Security audit reports                      |
| `cloudflare-deployment-optimizer`   | Deployment strategy, rollback procedures      | Phase 6    | Deployment plans, backup/restore procedures |

---

## Phase 1: Database Foundation

### Lead Agent: `postgres-serverless-architect`

**Primary Responsibilities:**

- Design junction table schema (`booking_units`, `guest_assignments`)
- Create migration scripts with rollback capability
- Implement database functions for multi-unit operations
- Optimize indexes for Neon PostgreSQL serverless
- Design RLS policies for new tables
- Create data integrity constraints and triggers

**Supporting Agents:**

- `serverless-saas-architect`: Multi-tenancy architecture review
- `security-compliance-auditor`: Security review of database design

**Deliverables:**

- [ ] `database/migrations/018-multi-unit-schema.sql`
- [ ] `database/migrations/018-rollback.sql`
- [ ] Database performance benchmarks document
- [ ] RLS policy specifications
- [ ] Data migration validation scripts

**Success Criteria:**

- ✅ Migration runs successfully on staging without errors
- ✅ Aggressive availability blocking (Confirmed + CheckedIn only) implemented
- ✅ Performance tests show <100ms query time for availability checks
- ✅ RLS policies prevent unauthorized access
- ✅ Rollback script verified working
- ✅ next_available_date returns per-unit, same-length stays

**Estimated Duration:** Week 1 (5 days)

---

## Phase 2: Backend API

### Lead Agent: `cloudflare-resort-api-architect`

**Primary Responsibilities:**

- Design RESTful API endpoints for multi-unit operations
- Implement Cloudflare Workers for new endpoints
- Create batch operation functions
- Implement availability checking for multiple units
- Update payment processing logic
- Create API compatibility layer

**Supporting Agents:**

- `serverless-saas-architect`: Architecture patterns, scalability
- `postgres-serverless-architect`: Query optimization
- `security-compliance-auditor`: API security review

**Deliverables:**

- [ ] `functions/api/bookings/multi-unit.ts` (with idempotency support)
- [ ] `functions/api/bookings/add-unit.ts`
- [ ] `functions/api/bookings/remove-unit.ts`
- [ ] `functions/api/availability/multi-unit.ts`
- [ ] `functions/api/pricing/quote.ts` (centralized pricing)
- [ ] `functions/api/bookings/[id]/payments/capture.ts` (unified payment)
- [ ] `functions/api/bookings/[id]/payments/refund.ts`
- [ ] Payment status state machine implementation
- [ ] API documentation (OpenAPI spec)
- [ ] API integration tests

**Success Criteria:**

- ✅ All endpoints return <200ms response time
- ✅ Atomic transactions for multi-unit creation
- ✅ Idempotency keys prevent duplicate bookings
- ✅ Payment state machine enforces valid transitions
- ✅ Comprehensive error handling implemented
- ✅ API tests achieve 95% coverage

**Estimated Duration:** Week 2 (5 days)

---

## Phase 3: State Management

### Lead Agent: `zustand-tanstack-resort-architect`

**Primary Responsibilities:**

- Design Zustand store for multi-unit bookings
- Implement TanStack Query hooks for CRUD operations
- Create optimistic update patterns
- Implement offline support with queue management
- Design conflict resolution strategies
- Create state synchronization logic

**Supporting Agents:**

- `typescript-react-quality-expert`: Type safety, code quality
- `cloudflare-resort-api-architect`: API integration

**Deliverables:**

- [ ] `src/stores/useMultiUnitBookingStore.ts`
- [ ] `src/hooks/useMultiUnitBookingQueries.ts`
- [ ] `src/hooks/useOptimisticMultiUnit.ts`
- [ ] `src/utils/migrateToMultiUnit.ts`
- [ ] State management documentation
- [ ] Unit tests for stores and hooks

**Success Criteria:**

- ✅ Type-safe store implementation
- ✅ Optimistic updates work correctly
- ✅ Offline queue processes successfully
- ✅ Conflict resolution handles concurrent edits
- ✅ 95%+ test coverage for state logic

**Estimated Duration:** Week 3 (5 days)

---

## Phase 4: UI Components

### Lead Agent: `resort-ui-designer`

**Primary Responsibilities:**

- Design multi-unit selection interface
- Create component specifications with wireframes
- Ensure accessibility compliance (WCAG 2.1 AA)
- Design mobile-responsive layouts
- Create user flows for add/remove units
- Design guest assignment interface

**Supporting Agents:**

- `tailwind-v4-design-expert`: Styling, design system
- `modern-form-validation-expert`: Form handling
- `tanstack-router-expert`: Routing integration
- `typescript-react-quality-expert`: Component quality

**Deliverables:**

- [ ] `src/components/bookings/MultiUnitSelector.tsx`
- [ ] `src/components/bookings/UnitCardList.tsx`
- [ ] `src/components/bookings/GuestAssignment.tsx`
- [ ] `src/components/bookings/MultiUnitPricingSummary.tsx`
- [ ] Updated `src/components/bookings/BookingForm/`
- [ ] Component Storybook stories
- [ ] Accessibility audit report

**Success Criteria:**

- ✅ Mobile-responsive on all screen sizes
- ✅ WCAG 2.1 AA compliance verified
- ✅ Touch-friendly interface (<44px touch targets)
- ✅ Loading states and error handling
- ✅ Visual regression tests passing

**Estimated Duration:** Week 4-5 (10 days)

---

## Phase 5: Integration & Testing

### Lead Agent: `code-quality-reviewer`

**Primary Responsibilities:**

- Comprehensive code review of all changes
- Integration testing coordination
- E2E test scenario creation
- Performance testing validation
- Security testing oversight
- Quality assurance sign-off

**Supporting Agents:**

- `pwa-performance-optimizer`: Performance benchmarks
- `security-compliance-auditor`: Security testing
- All feature agents: Bug fixes

**Deliverables:**

- [ ] `src/__tests__/e2e/multi-unit-booking-flow.test.ts`
- [ ] `src/__tests__/integration/multi-unit-api.test.ts`
- [ ] Performance benchmark report
- [ ] Security audit report
- [ ] Code quality review report
- [ ] Bug tracker with resolutions

**Success Criteria:**

- ✅ All E2E tests passing
- ✅ 90%+ code coverage
- ✅ No critical or high severity bugs
- ✅ Performance benchmarks met
- ✅ Security audit approved

**Estimated Duration:** Week 6 (5 days)

---

## Phase 6: Migration & Rollout

### Lead Agent: `cloudflare-deployment-optimizer`

**Primary Responsibilities:**

- Create direct deployment plan with rollback procedures
- Monitor performance metrics
- Coordinate greenfield deployment (wipe → migrate → deploy)
- Create runbooks for incidents
- Train stakeholders

**Supporting Agents:**

- `postgres-serverless-architect`: Database monitoring
- `cloudflare-resort-api-architect`: API monitoring
- `security-compliance-auditor`: Post-deployment audit

**Deliverables:**

- [ ] Direct deployment runbook
- [ ] Backup/restore procedures
- [ ] Rollback validation
- [ ] Monitoring dashboard setup
- [ ] User documentation
- [ ] Training materials
- [ ] Post-deployment report

**Success Criteria:**

- ✅ Clean deployment achieved (no downtime acceptable for greenfield)
- ✅ Monitoring alerts configured
- ✅ Rollback tested and ready (backup restore <15 min)
- ✅ All smoke tests passing

**Estimated Duration:** Week 7 (5 days)

---

## Cross-Cutting Responsibilities

### Security Compliance: `security-compliance-auditor`

**Continuous Responsibilities:**

- Security review at each phase gate
- RLS policy validation
- Input validation review
- Authentication/authorization review
- Data privacy compliance check
- Audit trail verification

**Phase-Specific Reviews:**

- Phase 1: Database security, RLS policies
- Phase 2: API security, input validation
- Phase 3: State management security
- Phase 4: XSS prevention, CSRF protection
- Phase 5: Penetration testing
- Phase 6: Production security audit

### Architecture Oversight: `serverless-saas-architect`

**Continuous Responsibilities:**

- Architecture decision reviews
- Scalability analysis
- Cost optimization recommendations
- Multi-tenancy pattern enforcement
- Performance architecture validation

---

## Escalation Path

### Phase-Level Issues

1. **Technical Blocker**: Escalate to phase lead agent
2. **Cross-Phase Dependency**: Escalate to `serverless-saas-architect`
3. **Security Concern**: Immediate escalation to `security-compliance-auditor`
4. **Performance Issue**: Escalate to `pwa-performance-optimizer`

### Project-Level Issues

1. **Timeline Risk**: Project Manager
2. **Resource Conflict**: Project Manager
3. **Scope Change**: Stakeholder review required

---

## Accountability Framework

### Definition of Done (DoD)

Each agent must ensure their deliverables meet these criteria:

**Code Deliverables:**

- [ ] Follows TypeScript strict mode
- [ ] 90%+ test coverage
- [ ] Documentation comments (JSDoc/TSDoc)
- [ ] Reviewed by `code-quality-reviewer`
- [ ] No linting errors
- [ ] Performance benchmarks met

**Database Deliverables:**

- [ ] Migration script tested on staging
- [ ] Rollback script verified
- [ ] Index optimization completed
- [ ] RLS policies tested
- [ ] Performance benchmarks met

**Documentation Deliverables:**

- [ ] Clear and comprehensive
- [ ] Examples provided
- [ ] Architecture diagrams included
- [ ] Reviewed for accuracy

### Review Process

1. **Self-Review**: Agent reviews own work against DoD
2. **Peer Review**: Another agent reviews (when applicable)
3. **Quality Gate**: `code-quality-reviewer` final approval
4. **Security Gate**: `security-compliance-auditor` approval (if applicable)

---

## Communication Protocol

### Daily Updates

- Each phase lead agent provides progress update
- Blockers identified and escalated
- Dependencies tracked

### Weekly Reviews

- Phase completion status
- Risk assessment
- Timeline adjustments

### Phase Gate Reviews

- Deliverable sign-off
- Success criteria validation
- Go/No-Go decision for next phase

---

## Version History

| Version | Date       | Changes                   |
| ------- | ---------- | ------------------------- |
| 1.0     | 2025-01-XX | Initial agent assignments |
