# Chunk 016: E2E and Performance Tests

## At a Glance

| Property | Value |
|----------|-------|
| **Chunk Number** | 016 |
| **Chunk Name** | e2e-performance-tests |
| **Phase** | Phase 4: Testing & Launch |
| **Estimated Time** | 145 minutes |
| **Milestone** | Production-ready test coverage with performance validation |
| **Can I Skip This?** | ❌ **NO** - Required for production deployment confidence |

**Prerequisites:**
- ✅ Chunk 015 completed (unit tests passing, fixtures created)
- ✅ Playwright installed (`npx playwright install`)
- ✅ k6 installed (`brew install k6` or equivalent)
- ✅ Staging environment accessible
- ✅ Pre-implementation baseline captured (see Step 1 in instructions.md)

## What You're Building

This chunk adds the final testing layer before production deployment - comprehensive end-to-end tests, performance validation, and rollback verification:

### 1. **Performance Baseline Capture (Week 0 - Pre-Implementation)**
Establish baseline metrics BEFORE implementing multi-unit features:
- Current single-unit booking performance (p95 response time)
- Database query performance (avg, p95, p99)
- API endpoint throughput (requests/second)
- Error rate baseline (should be near 0%)
- Save as `performance-baseline-YYYY-MM-DD.json` for regression comparison

**Critical Timing**: This must be captured on the **current production system** (single-unit booking) BEFORE any multi-unit database migrations or code changes.

### 2. **Guest Booking E2E Flow (Playwright)**
Complete user journey from landing page to confirmation:
- **Multi-step form navigation** (5 steps: dates → units → contact → payment → review)
- **Real-time pricing preview** (calls server-side PostgreSQL function)
- **Discount calculation verification** (7-night = 5%, 14-night = 10%)
- **Payment proof upload** (image compression, file validation)
- **Turnstile CAPTCHA integration** (test token flow)
- **Booking confirmation** (reference display, status tracking)

### 3. **Admin Assignment E2E Flow (Playwright)**
Admin workflow from login to unit assignment completion:
- **Pending bookings queue** (sorted by urgency score)
- **Payment verification UI** (view proof, approve/reject)
- **Unit assignment interface** (all-or-nothing enforcement)
- **Available units checker** (for booking date range)
- **Conflict detection** (unit already assigned error handling)
- **Success confirmation** (audit trail verification)

### 4. **Concurrency Stress Tests**
Verify PostgreSQL EXCLUDE constraint prevents double-booking:
- **Simultaneous admin assignments** (2+ admins, same unit)
- **Race condition simulation** (rapid concurrent requests)
- **Transaction rollback verification** (all-or-nothing atomicity)
- **Constraint error handling** (23P01 exclusion violation)
- **Optimistic locking validation** (version conflicts)

### 5. **Load Testing with k6**
Performance under realistic concurrent load:
- **10 concurrent booking requests** (target throughput)
- **Sustained load for 5 minutes** (stability verification)
- **Idempotency under load** (duplicate detection works)
- **Error rate monitoring** (target: <0.5%)
- **Response time distribution** (p95 < 1s target)

### 6. **Performance Regression Testing**
Compare post-implementation metrics to baseline:
- **Booking creation time** (acceptable: +20%, red flag: +50%)
- **Pricing calculation** (acceptable: +30%, red flag: +100%)
- **Database query performance** (acceptable: +15%, red flag: +40%)
- **API response time** (acceptable: +20%, red flag: +50%)
- **Generate comparison report** (automated pass/fail)

### 7. **Rollback Dry-Run on Staging**
Verify rollback procedures work correctly:
- **Execute rollback script** (database migration reversal)
- **Zero data loss verification** (all bookings preserved)
- **API compatibility check** (legacy endpoints functional)
- **Performance validation** (no degradation post-rollback)
- **Timing measurement** (target: <1 hour total)

## Why This Matters

### Business Value
1. **Guest Confidence** - End-to-end tests ensure booking flow works perfectly
2. **Revenue Protection** - Performance tests prevent slow/broken checkout experiences
3. **Operational Safety** - Rollback testing ensures quick recovery if issues arise
4. **Admin Efficiency** - Assignment flow tests validate workflow usability

### Technical Value
1. **Production Readiness** - E2E tests validate real user scenarios
2. **Regression Protection** - Performance baseline catches degradation
3. **Concurrency Safety** - Stress tests verify database constraints work under load
4. **Deployment Confidence** - Rollback verification provides safety net

### Risk Mitigation
| Risk | Without E2E/Performance Tests | With Complete Testing |
|------|-------------------------------|----------------------|
| Booking flow broken | Users cannot complete bookings → revenue loss | Caught in pre-production |
| Slow performance | Poor UX → cart abandonment | Baseline comparison catches regression |
| Double-booking | Operational chaos, guest complaints | Concurrency tests verify constraint |
| Failed deployment | Extended downtime, panic rollback | Tested rollback procedure (<1 hour) |

## Before You Start

### ✅ Prerequisites Checklist

**Testing Infrastructure:**
- [ ] Playwright installed: `npx playwright install --with-deps`
- [ ] k6 installed: `brew install k6` (macOS) or equivalent
- [ ] Staging environment accessible (separate from production)
- [ ] Test database with realistic data volume (50+ bookings)

**Baseline Captured (Week 0 - Critical):**
- [ ] Pre-implementation baseline exists (`performance-baseline-YYYY-MM-DD.json`)
- [ ] Baseline includes: booking creation time, pricing calculation time, API response times
- [ ] Baseline captured on **current production system** (single-unit booking)
- [ ] If not captured: Stop and capture baseline before proceeding (see instructions.md Step 1)

**Previous Chunks Complete:**
- [ ] Chunk 015: Unit tests passing (50+ tests)
- [ ] Test fixtures created (`tests/fixtures/`)
- [ ] Coverage >80% for critical paths
- [ ] All integration tests passing

**Environment Configuration:**
- [ ] `.env.test` configured with test credentials
- [ ] Turnstile test tokens configured (1x00000000000000000000AA for passing)
- [ ] Supabase test database accessible
- [ ] Cloudflare Workers test endpoints available

**Knowledge Requirements:**
- Basic Playwright syntax (page.click, page.fill, expect)
- Understanding of k6 load testing concepts
- Familiarity with performance metrics (p95, p99, throughput)
- Database concurrency concepts (EXCLUDE constraint, optimistic locking)

### 🚨 Critical Warnings

**Performance Baseline Timing:**
❌ **DO NOT** capture baseline after database migrations
❌ **DO NOT** capture baseline after multi-unit code changes
✅ **DO** capture baseline on current single-unit system (Week 0)
✅ **DO** save baseline file for regression comparison

**Rollback Dry-Run:**
⚠️ **ONLY** run rollback dry-run on **staging environment**
⚠️ **NEVER** run rollback dry-run on production
⚠️ If data loss detected during dry-run: **STOP** and escalate immediately

**Test Data:**
- Use **separate test database** for E2E tests (not production)
- Clean up test data after E2E runs (or use transactions)
- Ensure realistic data volume (50+ bookings for queue tests)

## What Happens Next

### Immediate Outcomes (After This Chunk)
- ✅ Complete E2E test suite (guest + admin flows)
- ✅ Performance regression report (vs baseline)
- ✅ Load test results (10 concurrent bookings handled)
- ✅ Concurrency verification (PostgreSQL EXCLUDE constraint working)
- ✅ Rollback procedure validated (dry-run <1 hour)
- ✅ Production deployment confidence level: **HIGH**

### Test Coverage Summary
| Test Layer | Coverage | Purpose |
|------------|----------|---------|
| Unit Tests (015) | 75% | Component correctness |
| Integration Tests (015) | 20% | API contracts, database constraints |
| E2E Tests (016) | 5% | Critical user journeys |
| Performance Tests (016) | Baseline + Regression | Performance validation |
| Concurrency Tests (016) | Edge cases | Database constraint verification |

### Performance Acceptance Criteria
| Metric | Baseline | Acceptable Regression | Red Flag |
|--------|----------|----------------------|----------|
| Booking creation (p95) | ___ ms | +20% | +50% |
| Pricing calc (p95) | ___ ms | +30% | +100% |
| Database query (avg) | ___ ms | +15% | +40% |
| API response (p95) | ___ ms | +20% | +50% |
| Error rate | ___% | +0.5% | +1% |
| Throughput | ___ req/s | -10% | -25% |

### Next Chunk (017: Deployment and Monitoring)
Prerequisites after this chunk:
- ✅ All tests passing (unit + integration + E2E)
- ✅ Performance within acceptable thresholds
- ✅ Rollback procedure verified
- ✅ Staging environment validated

Deployment chunk will include:
- Production database migration
- Cloudflare Pages/Workers deployment
- Monitoring setup (Grafana Cloud, UptimeRobot)
- Admin training session
- Post-deployment verification

## Key Files Created/Modified

```
e2e/
├── guest-booking-multi-unit.spec.ts     # ← Created (guest E2E flow)
├── admin-assignment.spec.ts             # ← Created (admin E2E flow)
└── page-objects/                        # ← Created (reusable page models)
    ├── GuestBookingPage.ts
    └── AdminAssignmentPage.ts

tests/
├── performance/
│   ├── load-test.js                     # ← Created (k6 load test)
│   ├── baseline-capture.ts              # ← Created (pre-implementation)
│   └── regression-test.ts               # ← Created (comparison script)
├── concurrency/
│   └── admin-assignment-race.test.ts    # ← Created (concurrent assignments)
└── rollback/
    ├── database-rollback.test.ts        # ← Created (rollback verification)
    └── acceptance.test.ts               # ← Created (post-rollback checks)

performance-baselines/
└── baseline-2025-01-23.json             # ← Generated (pre-implementation metrics)

Total: ~10 test files, ~800 lines of test code
```

## Related Documentation

### Source Documentation
- **Primary**: `docs/implementation/guest-booking-multi-unit/07-testing-strategy.md`
  - Lines 301-600: E2E test scenarios with Playwright
  - Lines 1010-1208: Performance testing and baseline capture
  - Lines 1906-2305: Rollback testing and acceptance criteria
- **Fixtures**: `docs/implementation/guest-booking-multi-unit/11-test-fixtures.md`
  - Lines 1-100: Reuse test data from chunk 015
- **Migration**: `docs/implementation/guest-booking-multi-unit/06-migration-guide.md`
  - Rollback section: Database rollback procedures

### Testing Strategy References
- **E2E Test Patterns**: Lines 870-1003, 07-testing-strategy.md
- **Load Testing**: Lines 1078-1141, 07-testing-strategy.md (k6 script example)
- **Performance Targets**: Lines 1161-1169, 07-testing-strategy.md
- **Rollback Timeline**: Lines 2243-2257, 07-testing-strategy.md

### Architectural Principles
- **PostgreSQL EXCLUDE Constraint**: Primary concurrency mechanism (lines 330-348, 09-implementation-decisions.md)
- **Server-Side Pricing**: E2E tests verify server calculations (lines 42-62, 09-implementation-decisions.md)
- **All-or-Nothing Assignment**: Admin E2E tests validate enforcement (lines 64-92, 09-implementation-decisions.md)

## Success Criteria

### Automated Verification
- [ ] All Playwright E2E tests pass: `npx playwright test`
- [ ] Load test completes successfully: `k6 run tests/performance/load-test.js`
- [ ] Performance regression within thresholds: `npm run test:performance:regression`
- [ ] Concurrency tests block double-booking: `npm run test:concurrency`
- [ ] Rollback acceptance tests pass: `npm run test:rollback`

### E2E Test Coverage
- [ ] Guest booking flow: Complete multi-unit booking (5 steps)
- [ ] Discount verification: 7-night and 14-night discounts applied
- [ ] Admin assignment: All-or-nothing enforcement validated
- [ ] Conflict detection: Unit already assigned error handled
- [ ] Payment verification: Upload and approval flow works

### Performance Metrics
- [ ] Baseline captured before implementation (pre-Week 1)
- [ ] Regression report generated and reviewed
- [ ] Booking creation time: Within +20% of baseline
- [ ] API response time (p95): < 1 second
- [ ] Load test: 10 concurrent bookings handled
- [ ] Error rate under load: < 0.5%

### Rollback Verification
- [ ] Rollback dry-run completed on staging
- [ ] Zero data loss confirmed
- [ ] Rollback timing: < 1 hour total
- [ ] Legacy API endpoints functional post-rollback
- [ ] Performance no worse after rollback

## Estimated Timeline

| Step | Description | Time |
|------|-------------|------|
| 1 | Performance baseline capture (or verify existing) | 15 min |
| 2 | E2E test setup (Playwright configuration) | 20 min |
| 3 | Guest booking E2E flow | 30 min |
| 4 | Admin assignment E2E flow | 25 min |
| 5 | Concurrency stress tests | 15 min |
| 6 | Load testing with k6 | 15 min |
| 7 | Performance regression testing | 10 min |
| 8 | Rollback dry-run on staging | 15 min |
| **Total** | | **145 minutes** |

**Note**: If baseline not yet captured, add 30 minutes to capture on pre-implementation system.

## Next Steps

1. **Read** `instructions.md` for step-by-step implementation guide
2. **Follow** each step carefully, especially baseline capture timing
3. **Verify** using `checkpoint.md` after completion
4. **Troubleshoot** any issues using `troubleshooting.md`
5. **Commit** with message: `test: complete chunk 016-e2e-performance-tests`
6. **Proceed** to chunk 017 (Deployment and Monitoring)

---

**Version**: 1.0
**Chunk**: 016/017
**Phase**: 4 (Testing & Launch)
**Status**: Ready for Implementation
