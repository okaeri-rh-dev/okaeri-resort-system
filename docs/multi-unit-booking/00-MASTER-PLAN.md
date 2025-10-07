# Multi-Unit Booking: Master Implementation Plan

**Document Version:** 1.0
**Created:** October 7, 2025
**Last Updated:** October 7, 2025
**Status:** Planning Phase

---

## Executive Summary

### Objective

Transform the Okaeri Resort System from single-unit bookings (1:1 relationship) to multi-unit bookings (1:N relationship) while maintaining backwards compatibility and enabling unified payment processing for multiple units.

### Business Value

- **Primary Problem Solved**: Guests can book multiple units (e.g., 2 cabins) in a single transaction with one payment, eliminating the need for separate bookings and payments
- **Revenue Impact**: Reduced transaction fees, potential for bulk discounts to drive larger bookings
- **Customer Experience**: Simplified booking process for families and groups
- **Operational Efficiency**: Single booking reference for multiple units reduces management overhead

### Success Metrics

| Metric                        | Target                            | Measurement                          |
| ----------------------------- | --------------------------------- | ------------------------------------ |
| Multi-Unit Booking Support    | 2-10 units per booking            | System capacity test                 |
| Performance (vs. single-unit) | No degradation                    | <200ms API response, <100ms DB query |
| Payment Processing            | 50% reduction in transaction fees | Before/after comparison              |
| Data Integrity                | Zero corruption incidents         | Post-deployment monitoring (30 days) |
| User Satisfaction             | ≥4.5/5 stars                      | User feedback surveys                |
| System Availability           | 99.9% uptime                      | Monitoring during rollout            |
| Test Coverage                 | ≥90%                              | Code coverage reports                |
| Backwards Compatibility       | 100% existing bookings work       | Regression testing                   |

---

## Current State Analysis

### Existing Architecture

**Database Layer:**

```sql
-- Current: Direct 1:1 relationship
CREATE TABLE bookings (
    booking_id UUID PRIMARY KEY,
    unit_id UUID NOT NULL REFERENCES units(unit_id),  -- Single unit
    total_amount DECIMAL(10,2),
    -- ...
);
```

**Application Layer:**

- Booking form: Single unit dropdown selector
- State: `booking.unit_id` (single string)
- Pricing: Single unit calculation
- Payment: One transaction per booking/unit

**Key Limitations:**

1. ❌ Cannot book multiple units in one transaction
2. ❌ Separate payments required for each unit
3. ❌ No bulk discount capability
4. ❌ Poor UX for group bookings
5. ❌ Higher transaction fees for multiple units

### Impact Analysis

**Affected Systems:**

- Database: Schema changes (junction tables)
- Backend: API endpoints, business logic
- Frontend: UI components, forms, state management
- Payments: Consolidated payment processing
- Reports: Multi-unit booking analytics
- Audit: Logging for unit-level operations

**Affected Features:**

- **High Impact**: Booking creation, availability checking, pricing, payments
- **Medium Impact**: Dashboard metrics, reports, guest management
- **Low Impact**: Audit logs, search filters

---

## Target State Architecture

### Database Layer

**New Junction Table Pattern:**

```sql
-- Multi-unit support via junction table
CREATE TABLE booking_units (
    booking_unit_id UUID PRIMARY KEY,
    booking_id UUID REFERENCES bookings(booking_id),
    unit_id UUID REFERENCES units(unit_id),
    unit_price DECIMAL(10,2),
    assigned_guests INTEGER,
    -- ...
    UNIQUE(booking_id, unit_id)
);

-- Maintain backwards compatibility
ALTER TABLE bookings
    ALTER COLUMN unit_id DROP NOT NULL,  -- Nullable for multi-unit
    ADD COLUMN is_multi_unit BOOLEAN DEFAULT FALSE,
    ADD COLUMN unit_count INTEGER DEFAULT 1;
```

**Key Design Decisions:**

1. ✅ Junction table (`booking_units`) enables 1:N relationship
2. ✅ Maintain `bookings.unit_id` for legacy single-unit bookings
3. ✅ Denormalized availability table for fast queries
4. ✅ Exclusion constraints prevent double-booking
5. ✅ Triggers maintain data integrity

### Application Layer

**State Management:**

```typescript
interface MultiUnitBooking {
  booking_id: string;
  booking_units: Array<{
    unit_id: string;
    unit_price: number;
    assigned_guests: number;
    pricing: PricingBreakdown;
  }>;
  total_amount: number;
  is_multi_unit: boolean;
  // ...
}
```

**User Flow:**

1. User selects dates → Check-in/Check-out
2. System shows available units
3. User adds multiple units to booking (1-10 units)
4. Optional: Assign specific guests to units
5. System calculates combined pricing (with bulk discounts)
6. User makes single payment for all units
7. System creates booking with multiple unit associations

---

## Implementation Roadmap

### Timeline Overview

```
Week 1: Database Foundation (postgres-serverless-architect)
Week 2: Backend API (cloudflare-resort-api-architect)
Week 3: State Management (zustand-tanstack-resort-architect)
Week 4-5: UI Components (resort-ui-designer)
Week 6: Integration & Testing (code-quality-reviewer)
Week 7: Migration & Rollout (cloudflare-deployment-optimizer)
```

**Total Duration:** 7 weeks (35 working days)
**Target Completion:** November 25, 2025

### Phase Breakdown

| Phase                              | Dates                | Lead Agent                          | Key Deliverables                     |
| ---------------------------------- | -------------------- | ----------------------------------- | ------------------------------------ |
| **Phase 1: Database Foundation**   | Oct 7-11, 2025       | `postgres-serverless-architect`     | Schema DDL, migrations, RLS policies |
| **Phase 2: Backend API**           | Oct 14-18, 2025      | `cloudflare-resort-api-architect`   | API endpoints, serverless functions  |
| **Phase 3: State Management**      | Oct 21-25, 2025      | `zustand-tanstack-resort-architect` | Zustand stores, TanStack Query hooks |
| **Phase 4: UI Components**         | Oct 28 - Nov 8, 2025 | `resort-ui-designer`                | React components, forms, UX flows    |
| **Phase 5: Integration & Testing** | Nov 11-15, 2025      | `code-quality-reviewer`             | E2E tests, performance benchmarks    |
| **Phase 6: Migration & Rollout**   | Nov 18-22, 2025      | `cloudflare-deployment-optimizer`   | Feature flags, deployment            |

### Critical Path Dependencies

```mermaid
gantt
    title Multi-Unit Booking Implementation
    dateFormat  YYYY-MM-DD
    section Database
    Schema Design           :2025-10-07, 2d
    Migration Scripts       :2025-10-09, 2d
    RLS Policies            :2025-10-10, 2d
    section Backend
    API Design              :2025-10-14, 2d
    Endpoint Implementation :2025-10-16, 2d
    API Testing             :2025-10-17, 2d
    section State
    Store Design            :2025-10-21, 2d
    Query Hooks             :2025-10-23, 2d
    Optimistic Updates      :2025-10-24, 2d
    section UI
    Component Design        :2025-10-28, 3d
    Implementation          :2025-10-31, 5d
    Mobile Optimization     :2025-11-05, 3d
    section Testing
    Integration Tests       :2025-11-11, 3d
    Performance Tests       :2025-11-13, 2d
    section Rollout
    Feature Flags           :2025-11-18, 2d
    Deployment              :2025-11-20, 2d
    Monitoring              :2025-11-21, 2d
```

---

## Risk Analysis & Mitigation

### High-Risk Items

#### 1. Database Migration Failure

**Risk Level:** 🔴 HIGH
**Impact:** Data loss, system downtime
**Probability:** Medium

**Mitigation:**

- ✅ Full database backup before migration
- ✅ Test migration on staging with production data clone
- ✅ Rollback script tested and ready
- ✅ Migration run during low-traffic window
- ✅ Database administrator on standby

**Contingency:**

- Execute rollback script within 5 minutes
- Revert to backup if rollback fails
- Estimated recovery time: <15 minutes

#### 2. Performance Degradation

**Risk Level:** 🟡 MEDIUM
**Impact:** Slow booking process, poor UX
**Probability:** Medium

**Mitigation:**

- ✅ Load testing with 10+ units per booking
- ✅ Database query optimization (indexes, prepared statements)
- ✅ Denormalized availability table for fast lookups
- ✅ Connection pooling optimization for Neon
- ✅ Performance benchmarks before rollout

**Contingency:**

- Feature flag to disable multi-unit if performance issues
- Revert to single-unit only while optimizing
- Estimated fix time: 2-3 days

#### 3. Data Inconsistency

**Risk Level:** 🟡 MEDIUM
**Impact:** Booking/payment mismatches
**Probability:** Low

**Mitigation:**

- ✅ Atomic transactions for all multi-unit operations
- ✅ Database constraints (foreign keys, exclusion, triggers)
- ✅ Comprehensive validation at API layer
- ✅ Consistency checks in cron jobs
- ✅ Audit trail for all changes

**Contingency:**

- Manual data reconciliation procedures
- Database consistency repair scripts
- Audit log analysis for root cause

#### 4. Backwards Compatibility Broken

**Risk Level:** 🟡 MEDIUM
**Impact:** Existing bookings fail
**Probability:** Low

**Mitigation:**

- ✅ Maintain `bookings.unit_id` for single-unit bookings
- ✅ Compatibility wrapper functions
- ✅ Comprehensive regression testing
- ✅ Gradual rollout with feature flags
- ✅ Monitoring for errors on existing flows

**Contingency:**

- Feature flag to revert to old flow
- Quick hotfix deployment capability
- Customer support escalation process

#### 5. Poor User Experience

**Risk Level:** 🟢 LOW
**Impact:** User confusion, abandoned bookings
**Probability:** Medium

**Mitigation:**

- ✅ User testing with target audience
- ✅ Progressive disclosure (simple → complex)
- ✅ Clear error messages and validation
- ✅ Tutorial/onboarding for new feature
- ✅ Mobile-first responsive design

**Contingency:**

- Quick UX iteration based on feedback
- Optional fallback to single-unit mode
- In-app help and tooltips

### Medium-Risk Items

- **Payment Processing Issues**: Tested in sandbox, gradual rollout
- **Mobile Experience**: Early mobile testing, responsive design review
- **Security Vulnerabilities**: Security audit at each phase gate
- **Availability Checking Accuracy**: Comprehensive test scenarios

### Low-Risk Items

- Documentation gaps: Continuous documentation updates
- Team knowledge transfer: Pair programming, code reviews
- Monitoring blind spots: Comprehensive logging and alerts

---

## Technical Architecture

### Database Schema Changes

**New Tables:**

```sql
-- Junction table for multi-unit relationships
CREATE TABLE booking_units (
    booking_unit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(unit_id) ON DELETE RESTRICT,
    unit_price DECIMAL(10,2) NOT NULL,
    weekend_surcharge DECIMAL(10,2) DEFAULT 0,
    extra_person_charge DECIMAL(10,2) DEFAULT 0,
    subtotal DECIMAL(10,2) NOT NULL,
    assigned_guests INTEGER,
    guest_names TEXT[],
    unit_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(booking_id, unit_id)
);

-- Denormalized availability for performance
CREATE TABLE booking_unit_availability (
    availability_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(unit_id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    check_in TIMESTAMPTZ NOT NULL,
    check_out TIMESTAMPTZ NOT NULL,
    booking_status VARCHAR(20) NOT NULL,
    EXCLUDE USING gist (
        unit_id WITH =,
        tstzrange(check_in, check_out, '[)') WITH &&
    ) WHERE (booking_status NOT IN ('Cancelled', 'NoShow'))
);
```

**Modified Tables:**

```sql
ALTER TABLE bookings
    ALTER COLUMN unit_id DROP NOT NULL,  -- Nullable for multi-unit
    ADD COLUMN is_multi_unit BOOLEAN DEFAULT FALSE,
    ADD COLUMN unit_count INTEGER DEFAULT 1 CHECK (unit_count > 0),
    ADD COLUMN base_amount DECIMAL(10,2),
    ADD COLUMN total_surcharges DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0;
```

### API Endpoints

**New Endpoints:**

```
POST   /api/bookings/multi-unit          # Create multi-unit booking
POST   /api/bookings/:id/units           # Add unit to booking
DELETE /api/bookings/:id/units/:unitId   # Remove unit from booking
GET    /api/availability/multi-unit      # Check multiple units
PUT    /api/bookings/:id/guests/assign   # Assign guests to units
```

**Modified Endpoints:**

```
GET    /api/bookings/:id                 # Return units array
PUT    /api/bookings/:id                 # Support unit updates
```

### State Management Architecture

**New Stores:**

- `useMultiUnitBookingStore`: Complex multi-unit state with optimistic updates
- Offline queue for resilience
- Conflict resolution for concurrent edits

**TanStack Query Hooks:**

- `useMultiUnitBookings`: Fetch bookings with unit relationships
- `useMultiUnitAvailability`: Batch availability checking
- `useCreateMultiUnitBooking`: Optimistic creation with rollback
- `useAddUnitToBooking`: Optimistic unit addition
- `useRemoveUnitFromBooking`: Optimistic unit removal

---

## Implementation Strategy

### Backwards Compatibility Approach

**Dual-Mode Operation:**

```typescript
// Support both modes
interface Booking {
  // Legacy single-unit
  unit_id?: string;

  // New multi-unit
  is_multi_unit: boolean;
  booking_units?: BookingUnit[];
}

// Compatibility adapter
function getBookingUnits(booking: Booking): BookingUnit[] {
  if (booking.is_multi_unit) {
    return booking.booking_units || [];
  }
  // Convert legacy single-unit to array
  return booking.unit_id ? [legacyUnitToBookingUnit(booking)] : [];
}
```

### Migration Strategy

**Phase 1: Schema Migration**

1. Add new tables without breaking existing schema
2. Add nullable columns to bookings table
3. Migrate existing bookings to booking_units table
4. Validate data integrity

**Phase 2: API Layer**

1. Create new multi-unit endpoints
2. Maintain existing endpoints with adapters
3. Add feature flag for gradual rollout

**Phase 3: UI Rollout**

1. Beta users get multi-unit interface
2. A/B testing for UX validation
3. Gradual rollout to all users
4. Monitor metrics continuously

### Feature Flag Strategy

```typescript
// Feature flags for controlled rollout
const features = {
  MULTI_UNIT_BOOKING_ENABLED: process.env.VITE_MULTI_UNIT_ENABLED === "true",
  MULTI_UNIT_BETA_USERS: ["user-id-1", "user-id-2"],
  MAX_UNITS_PER_BOOKING: 10,
  BULK_DISCOUNT_THRESHOLD: 3, // 3+ units get discount
};

// Gradual rollout
function isMultiUnitEnabled(userId: string): boolean {
  if (!features.MULTI_UNIT_BOOKING_ENABLED) return false;

  // Beta users always get access
  if (features.MULTI_UNIT_BETA_USERS.includes(userId)) return true;

  // Gradual rollout: 10% → 50% → 100%
  const rolloutPercentage = parseInt(process.env.VITE_MULTI_UNIT_ROLLOUT || "0");
  return hashUserId(userId) % 100 < rolloutPercentage;
}
```

---

## Testing Strategy

### Test Coverage Requirements

| Layer            | Coverage Target     | Test Types                                  |
| ---------------- | ------------------- | ------------------------------------------- |
| Database         | 100%                | Migration scripts, RLS policies, triggers   |
| API              | 95%                 | Unit, integration, contract tests           |
| State Management | 95%                 | Unit, integration tests                     |
| UI Components    | 90%                 | Component, integration, accessibility tests |
| E2E Flows        | 100% critical paths | Playwright E2E tests                        |

### Critical Test Scenarios

**1. Multi-Unit Booking Creation**

- ✅ Create booking with 2 units
- ✅ Create booking with 10 units (max)
- ✅ Validate pricing calculation
- ✅ Verify payment processing
- ✅ Check availability for all units

**2. Availability Checking**

- ✅ All units available → proceed
- ✅ Some units unavailable → show error
- ✅ Unit becomes unavailable during booking → handle gracefully
- ✅ Concurrent bookings for same unit → prevent double-booking

**3. Guest Assignment**

- ✅ Assign guests to specific units
- ✅ Update guest assignments
- ✅ Validate guest count per unit

**4. Payment Processing**

- ✅ Unified payment for multiple units
- ✅ Payment failure handling
- ✅ Partial payment scenarios

**5. Backwards Compatibility**

- ✅ Existing single-unit bookings still work
- ✅ Migrate single-unit to multi-unit
- ✅ Mixed booking types in database

**6. Performance**

- ✅ Load test with 10 units per booking
- ✅ Concurrent multi-unit bookings
- ✅ Database query performance under load

**7. Edge Cases**

- ✅ Remove last unit from booking (should fail)
- ✅ Add duplicate unit (should fail)
- ✅ Exceed max units limit
- ✅ Offline booking creation and sync

---

## Success Criteria & Acceptance

### Phase Gate Criteria

Each phase must meet these criteria before proceeding:

**Phase 1 (Database):**

- [ ] Migration successful on staging
- [ ] All existing bookings migrated
- [ ] Performance benchmarks met (<100ms queries)
- [ ] RLS policies tested
- [ ] Rollback script verified

**Phase 2 (Backend):**

- [ ] All API endpoints implemented
- [ ] API tests achieve 95% coverage
- [ ] Response times <200ms
- [ ] Error handling comprehensive
- [ ] Backwards compatibility verified

**Phase 3 (State):**

- [ ] Stores implemented and tested
- [ ] Optimistic updates working
- [ ] Offline support functional
- [ ] 95% test coverage
- [ ] Type safety validated

**Phase 4 (UI):**

- [ ] All components implemented
- [ ] Mobile responsive
- [ ] WCAG 2.1 AA compliant
- [ ] User testing positive feedback
- [ ] Visual regression tests passing

**Phase 5 (Testing):**

- [ ] All E2E tests passing
- [ ] 90% overall code coverage
- [ ] Performance benchmarks met
- [ ] No critical/high bugs
- [ ] Security audit approved

**Phase 6 (Rollout):**

- [ ] Feature flags working
- [ ] Monitoring in place
- [ ] Rollback tested
- [ ] Zero-downtime deployment
- [ ] User satisfaction maintained

### Launch Readiness Checklist

**Technical Readiness:**

- [ ] All code merged to main branch
- [ ] All tests passing (unit, integration, E2E)
- [ ] Performance benchmarks achieved
- [ ] Security audit completed and approved
- [ ] Database backups verified
- [ ] Rollback procedures tested

**Operational Readiness:**

- [ ] Monitoring and alerts configured
- [ ] Runbooks created for common issues
- [ ] Support team trained
- [ ] User documentation published
- [ ] FAQ and help articles ready

**Business Readiness:**

- [ ] Stakeholder approval obtained
- [ ] Marketing materials prepared (if applicable)
- [ ] Customer communication plan ready
- [ ] Rollback decision criteria defined

---

## Post-Launch Plan

### Monitoring & Observability

**Key Metrics to Monitor:**

```typescript
// Performance metrics
- API response time (p50, p95, p99)
- Database query time
- Availability check latency
- Payment processing time

// Business metrics
- Multi-unit booking adoption rate
- Average units per booking
- Bulk discount redemption rate
- Transaction fee savings

// Error metrics
- API error rates
- Database errors
- Payment failures
- Availability check failures

// User experience metrics
- Booking completion rate
- Abandonment rate
- Time to complete booking
- User satisfaction scores
```

**Alert Thresholds:**

- 🔴 Critical: API errors >1%, response time >1s, downtime >1min
- 🟡 Warning: Response time >500ms, error rate >0.5%
- 🟢 Info: New feature usage milestones

### Rollback Triggers

**Immediate Rollback Criteria:**

1. Data corruption detected
2. Payment processing failures >5%
3. System downtime >5 minutes
4. Critical security vulnerability
5. Database performance degradation >50%

**Gradual Rollback Criteria:**

1. User satisfaction drops below 4.0/5
2. Booking completion rate drops >10%
3. Support tickets increase >200%
4. Non-critical bugs accumulate >20

### Continuous Improvement

**Week 1-2 Post-Launch:**

- Daily monitoring of all metrics
- Quick bug fixes and hotfixes
- User feedback collection
- Performance tuning

**Week 3-4 Post-Launch:**

- Analyze usage patterns
- Identify UX improvements
- Optimize based on real data
- Expand feature flags to 100%

**Month 2-3 Post-Launch:**

- Feature enhancements based on feedback
- Performance optimizations
- Documentation updates
- Team retrospective

---

## Resources & Dependencies

### Required Infrastructure

- Neon PostgreSQL: Existing (no additional cost)
- Cloudflare Workers: Existing (within free tier)
- Supabase: Existing (within free tier)

### External Dependencies

- btree_gist extension: Required for exclusion constraints
- Database migration tool: Existing
- Feature flag system: To be implemented

### Team Allocation

- Backend: 1 developer (postgres-serverless-architect, cloudflare-resort-api-architect)
- Frontend: 1 developer (resort-ui-designer, zustand-tanstack-resort-architect)
- QA/Testing: 1 developer (code-quality-reviewer)
- DevOps: 0.5 developer (cloudflare-deployment-optimizer)

---

## Appendices

### Glossary

- **Junction Table**: A database table that creates many-to-many relationships
- **Optimistic Update**: UI update before server confirmation
- **RLS**: Row Level Security (PostgreSQL security feature)
- **Denormalization**: Duplicating data for performance
- **Exclusion Constraint**: Database constraint preventing overlapping ranges

### References

- Database Schema: `database/schema.sql`
- Current Booking Flow: `docs/booking-flow.md`
- API Documentation: `docs/api/`
- Agent Assignments: `AGENT-ASSIGNMENTS.md`

### Version History

| Version | Date            | Author           | Changes             |
| ------- | --------------- | ---------------- | ------------------- |
| 1.0     | October 7, 2025 | System Architect | Initial master plan |

---

**Next Steps:**

1. Review and approve this master plan
2. Begin Phase 1 with `postgres-serverless-architect`
3. Set up project tracking board
4. Schedule weekly progress reviews
