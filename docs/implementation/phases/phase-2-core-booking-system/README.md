# Phase 2: Core Booking System (Weeks 4-6)

## Phase Overview
Phase 2 implements the comprehensive booking management system for the Okaeri Resort, handling multiple booking sources (Airbnb, Facebook Messenger, Direct), payment tracking, and interactive timeline visualization. This phase leverages modern React 19 features for optimistic updates and real-time synchronization.

## Phase Objectives
1. **Multi-Source Booking Support** - Unified handling of Airbnb CSV, Google Sheets, and direct bookings
2. **Payment Management** - 50% deposit + 50% balance tracking with receipt storage
3. **Real-Time Updates** - Optimistic UI with TanStack Query and React 19 hooks
4. **Interactive Timeline** - Visual booking management with drag-and-drop capabilities
5. **Data Integration** - Seamless import/export with validation and conflict resolution

## Agent-Driven TDD Workflow

This phase follows strict Test-Driven Development methodology with agent delegation:

### 1. Test Definition Phase (RED)
- The relevant specialized agent writes comprehensive tests based on expected input/output pairs
- Tests must cover ALL acceptance criteria, edge cases, and error scenarios
- Tests are written WITHOUT any implementation code existing
- Tests should use the test utilities and templates from `/tests/utils/tdd-helpers.ts`

### 2. Test Validation Phase
- Agent runs all tests to confirm they FAIL (proving no implementation exists)
- NO implementation code should be written at this stage
- All tests must fail with clear, meaningful error messages
- This validates that tests are actually testing the intended functionality

### 3. Test Commit Phase
- Once the agent is satisfied with test coverage and quality, tests are committed
- Commit message: "test: add failing tests for [feature]"
- These tests become the immutable contract that implementation must fulfill
- Tests serve as the living specification for the feature

### 4. Implementation Phase (GREEN)
- Agent writes the MINIMAL code necessary to make tests pass
- Tests MUST NOT be modified during implementation
- Keep iterating on implementation until ALL tests pass
- No shortcuts, workarounds, or test-specific hacks allowed
- Use repository patterns for database operations (see `/src/lib/repositories/`)

### 5. Verification Phase
- An independent specialized agent reviews the implementation to ensure:
  - Code isn't overfitting to specific test cases
  - Solution is general and handles cases beyond the tests
  - Implementation follows project best practices and patterns
  - No test-specific hacks or hardcoded values were used
  - Code is maintainable and follows SOLID principles

### TDD Compliance Requirements
- ❌ NEVER write implementation before tests
- ❌ NEVER modify tests to make them pass
- ✅ ALWAYS commit tests before implementation
- ✅ ALWAYS have independent verification
- ✅ ALWAYS maintain 80% minimum code coverage

## Sub-Phases Structure

### [Sub-Phase 2.1: Booking Data Model & API Design](./sub-phase-2-1-booking-data-model.md)
**Duration:** 2 days  
**Dependencies:** Phase 1 Complete  
**Validation Agents:** `postgres-serverless-architect`, `vercel-resort-api-architect`  
- Design comprehensive booking and payment schemas
- Create API endpoint specifications
- Implement Zod validation schemas
- Setup multi-source booking support

### [Sub-Phase 2.2: Booking CRUD Operations](./sub-phase-2-2-booking-crud-operations.md)
**Duration:** 2 days  
**Dependencies:** Sub-Phase 2.1  
**Validation Agents:** `modern-form-validation-expert`, `zustand-tanstack-resort-architect`, `typescript-react-quality-expert`  
- Implement CRUD API endpoints
- Create TanStack Query hooks with caching
- Setup Zustand store for booking UI state
- Implement optimistic updates

### [Sub-Phase 2.3: CSV Import System](./sub-phase-2-3-csv-import-system.md)
**Duration:** 3 days  
**Dependencies:** Sub-Phase 2.2  
**Validation Agents:** `vercel-resort-api-architect`, `resort-finance-architect`  
- Build Airbnb CSV parser
- Implement intelligent field mapping
- Create bulk import with progress tracking
- Handle duplicates and conflicts

### [Sub-Phase 2.4: Google Sheets Integration](./sub-phase-2-4-google-sheets-integration.md)
**Duration:** 3 days  
**Dependencies:** Sub-Phase 2.2  
**Validation Agents:** `serverless-saas-architect`, `security-compliance-auditor`  
- Setup Google Sheets API integration
- Create form submission pipeline
- Implement webhook support
- Build FB Messenger booking workflow

### [Sub-Phase 2.5: Payment Tracking System](./sub-phase-2-5-payment-tracking.md)
**Duration:** 2 days  
**Dependencies:** Sub-Phase 2.2  
**Validation Agents:** `resort-finance-architect`, `security-compliance-auditor`  
- Implement deposit/balance workflow
- Support multiple payment methods
- Create receipt upload to R2
- Build payment notifications

### [Sub-Phase 2.6: Interactive Booking Timeline](./sub-phase-2-6-booking-timeline-ui.md)
**Duration:** 2 days  
**Dependencies:** Sub-Phases 2.1-2.5  
**Validation Agents:** `resort-ui-designer`, `pwa-performance-optimizer`  
- Build timeline visualization component
- Implement drag-and-drop functionality
- Create calendar view with availability
- Ensure mobile responsiveness

### [Sub-Phase 2.7: Integration & Testing](./sub-phase-2-7-integration-validation.md)
**Duration:** 2 days  
**Dependencies:** All previous sub-phases  
**Validation Agents:** All relevant agents  
- Complete booking flow E2E testing
- CSV import performance validation
- Payment workflow testing
- Multi-source integration verification

## Technical Architecture

### Data Flow
```
Booking Sources
├── Airbnb CSV → Parser → Validation → Database
├── Google Sheets → API → Transform → Database
└── Direct Input → Form → Validation → Database
                            ↓
                    Unified Booking Store
                            ↓
                    TanStack Query Cache
                            ↓
                    React Components
                    ├── Booking List
                    ├── Timeline View
                    ├── Calendar View
                    └── Detail Modal
```

### State Management Architecture
```typescript
// Local UI State (Zustand)
BookingUIStore {
  selectedBookingId
  filterStatus
  filterSource
  viewMode
  csvImportProgress
  paymentModal
}

// Server State (TanStack Query)
useBookings() → List of bookings with caching
useBooking(id) → Single booking details
useCreateBooking() → Optimistic creation
useUpdateBooking() → Optimistic updates
useDeleteBooking() → Optimistic deletion
useImportCSV() → Bulk import with progress
```

## Success Criteria

### Functional Requirements
- [ ] Create, read, update, delete bookings
- [ ] Import Airbnb bookings via CSV
- [ ] Sync Facebook Messenger bookings via Google Sheets
- [ ] Track 50% deposit + 50% balance payments
- [ ] Upload and store payment receipts
- [ ] Visual timeline with drag-and-drop
- [ ] Calendar view with availability
- [ ] Multi-source booking deduplication
- [ ] Real-time optimistic updates

### Performance Benchmarks
- [ ] CSV import: < 2s for 100 bookings
- [ ] Booking list load: < 500ms
- [ ] Search/filter: < 100ms
- [ ] Payment update: < 200ms
- [ ] Timeline render: < 1s for 50 bookings
- [ ] Drag-and-drop: 60fps animation
- [ ] Mobile performance: Lighthouse > 90

### Quality Standards
- [ ] 100% TypeScript coverage
- [ ] Zero runtime type errors
- [ ] 85% test coverage minimum
- [ ] All Zod validations passing
- [ ] Accessibility WCAG 2.1 AA
- [ ] Mobile-first responsive design
- [ ] Offline capability for critical ops

## Testing Requirements

All testing follows the Agent-Driven TDD Workflow outlined above, with tests written before implementation and serving as the specification contract.

### Unit Testing
- Booking validation logic
- CSV parser functions
- Payment calculations
- Date/time utilities
- Filter and search logic

### Integration Testing
- API endpoint testing
- Database operations
- Google Sheets sync
- Cloudflare R2 uploads
- Webhook handling

### E2E Testing
- Complete booking creation flow
- CSV import workflow
- Payment tracking flow
- Timeline interactions
- Multi-source booking sync

### Performance Testing
- CSV import with 1000+ records
- Concurrent booking operations
- Timeline with 100+ bookings
- Search across large datasets
- Mobile performance metrics

## Risk Mitigation

### Technical Risks
1. **CSV Format Variations**
   - Mitigation: Flexible parser with field mapping UI
   - Fallback: Manual field selection

2. **Google Sheets API Limits**
   - Mitigation: Batch operations, caching
   - Monitoring: Rate limit tracking

3. **Large Dataset Performance**
   - Mitigation: Pagination, virtual scrolling
   - Optimization: Database indexing

4. **Payment Data Security**
   - Mitigation: Encryption, secure storage
   - Compliance: PCI DSS guidelines

### Process Risks
1. **Integration Complexity**
   - Mitigation: Incremental integration
   - Testing: Comprehensive mocks

2. **Data Migration**
   - Mitigation: Validation before import
   - Rollback: Transaction support

## Key Technologies

### Frontend
- **React 19.1** - Latest hooks (useOptimistic, useActionState)
- **Zustand 5.0.2** - Lightweight state management
- **TanStack Query 5.71.10** - Server state with caching
- **shadcn/ui** - Accessible component library
- **React Hook Form 7.54.0** - Form handling
- **Zod 3.24.0** - Runtime validation
- **Papa Parse 5.4.0** - CSV parsing
- **date-fns 4.1.0** - Date manipulation

### Backend
- **Vercel API Routes** - Serverless functions
- **Neon PostgreSQL** - Serverless database
- **Google Sheets API v4** - Sheets integration
- **Cloudflare R2** - File storage
- **Webhooks** - Real-time updates

## Deliverables

### Code Deliverables
- Booking CRUD API endpoints
- CSV import functionality
- Google Sheets integration
- Payment tracking system
- Interactive timeline component
- Calendar view component
- Mobile-optimized UI

### Documentation Deliverables
- API documentation with examples
- CSV format specification
- Google Sheets setup guide
- Payment workflow documentation
- Component usage guide
- Integration test results

### Validation Reports
- Agent validation for each sub-phase
- Performance benchmark results
- Security audit for payment data
- Accessibility compliance report
- Test coverage report

## Phase Completion Checklist

### Pre-Completion Requirements
- [ ] All sub-phases completed and validated
- [ ] All tests passing with required coverage
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] Documentation complete

### Agent Sign-offs Required
- [ ] `postgres-serverless-architect` - Database design approval
- [ ] `vercel-resort-api-architect` - API architecture validation
- [ ] `zustand-tanstack-resort-architect` - State management approval
- [ ] `resort-finance-architect` - Payment system validation
- [ ] `resort-ui-designer` - UI/UX approval
- [ ] `security-compliance-auditor` - Security validation
- [ ] `pwa-performance-optimizer` - Performance approval

### Handoff to Phase 3
- [ ] Booking system fully operational
- [ ] Import/export functionality tested
- [ ] Payment tracking verified
- [ ] Timeline UI complete
- [ ] Team trained on booking features
- [ ] Phase 3 dependencies identified

## Timeline Summary

| Week | Sub-Phases | Key Milestones |
|------|------------|----------------|
| Week 4 | 2.1, 2.2, 2.3 (partial) | Data model, CRUD ops, CSV import start |
| Week 5 | 2.3 (complete), 2.4, 2.5 | CSV complete, Google Sheets, Payments |
| Week 6 | 2.6, 2.7 | Timeline UI, Integration testing |

## Notes for Development Team

### Best Practices
1. **Optimistic Updates** - Use React 19's useOptimistic for instant feedback
2. **Error Boundaries** - Implement for each major component
3. **Loading States** - Skeleton screens for better UX
4. **Validation** - Client and server-side with Zod
5. **Accessibility** - Test with screen readers

### Critical Paths
1. Data model must be finalized before CRUD operations
2. CRUD operations required for all import features
3. Payment system depends on booking structure
4. Timeline UI requires all data sources integrated

### Resources
- [React 19 Documentation](https://react.dev/blog)
- [TanStack Query Docs](https://tanstack.com/query)
- [Google Sheets API](https://developers.google.com/sheets)
- [Papa Parse Documentation](https://www.papaparse.com/docs)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2)

---

*Phase 2 establishes the core booking functionality that drives the resort's primary operations. Success here directly impacts guest management efficiency and revenue tracking accuracy.*