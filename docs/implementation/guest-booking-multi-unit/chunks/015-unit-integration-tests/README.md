# Chunk 015: Unit and Integration Tests

## At a Glance

| Property | Value |
|----------|-------|
| **Chunk Number** | 015 |
| **Chunk Name** | unit-integration-tests |
| **Phase** | Phase 4: Testing & Launch |
| **Estimated Time** | 140 minutes |
| **Milestone** | Complete test suite with >80% coverage |
| **Can I Skip This?** | ❌ **NO** - Testing is critical for data integrity and regression prevention |

**Prerequisites:**
- ✅ Chunks 001-014 completed (all implementation done)
- ✅ Database migrations applied and working
- ✅ API endpoints functional
- ✅ Test environment configured (`.env.test`)
- ✅ Vitest and testing libraries installed

## What You're Building

A comprehensive test suite that validates the multi-unit guest booking system's correctness, performance, and reliability:

### 1. **Database Constraint Tests**
Verify that PostgreSQL constraints enforce business rules:
- `payment_before_assignment` - Cannot assign units without payment verification
- `all_or_nothing_assignment` - Must assign ALL requested units or NONE
- `no_double_booking` - PostgreSQL EXCLUDE constraint prevents overlapping bookings
- `guests_per_unit > 0` - Basic validation constraints

### 2. **PostgreSQL Pricing Engine Tests**
Test the **AUTHORITATIVE** server-side pricing calculator:
- Base price calculations (unit × nights × rate)
- All 4 discount types (duration, date-range, advance-booking, unit-count)
- Best-of discount policy (highest wins, no stacking)
- Weekend surcharge application
- Extra person fees calculation
- Edge cases (1 night, 10 units, max capacity)

### 3. **API Integration Tests**
Validate API endpoints and request/response contracts using native fetch():
- `POST /api/guest-booking` - Multi-unit booking creation
- `POST /api/guest-booking/preview-pricing` - Server-side pricing preview
- `GET /api/guest-booking/rates` - Static rates display
- `GET /api/guest-booking/discount-rules` - Active discounts
- Input validation and error handling
- Rate limiting enforcement

### 4. **Idempotency and Concurrency Tests**
Ensure system handles duplicates and concurrent operations:
- Idempotency key duplicate detection (48-hour window)
- Concurrent unit assignment conflicts (PostgreSQL EXCLUDE constraint)
- Optimistic locking verification
- Transaction rollback scenarios

### 5. **Property-Based Tests**
Validate pricing invariants hold for ALL possible inputs:
- Total price is never negative
- Downpayment is always 50% of total
- Discount never exceeds subtotal
- More nights always costs more (monotonicity)

### 6. **Test Fixtures**
Reusable test data for consistent testing:
- Sample booking payloads (single-unit, multi-unit, edge cases)
- Pricing configuration data
- Discount rule fixtures
- Mock images/PDFs for file upload tests

## Why This Matters

### Business Value
1. **Data Integrity** - Prevent invalid bookings that could cause operational chaos
2. **Revenue Protection** - Ensure pricing calculations are always correct
3. **Guest Trust** - Guarantee consistent booking behavior
4. **Compliance** - Validate business rules are enforced by database

### Technical Value
1. **Regression Prevention** - Catch bugs before production
2. **Refactoring Safety** - Make future changes confidently
3. **Documentation** - Tests serve as executable specifications
4. **Debugging Speed** - Reproduce issues quickly with test cases

### Critical Path Coverage
| Component | Target Coverage | Business Risk if Untested |
|-----------|----------------|---------------------------|
| Pricing Engine | 100% | Incorrect charges, revenue loss |
| Constraints | 100% | Double-bookings, data corruption |
| Idempotency | 95% | Duplicate bookings, inventory issues |
| Validation | 95% | Security vulnerabilities, data quality |
| API Endpoints | 90% | Integration failures, errors |

## Before You Start

### ✅ Prerequisites Checklist

**Environment Setup:**
- [ ] Node.js 18+ installed
- [ ] Test database accessible (can use same as development)
- [ ] `.env.test` file created with test credentials
- [ ] Vitest and testing libraries installed (`npm ci`)

**Implementation Complete:**
- [ ] Chunk 001: Database schema with constraints
- [ ] Chunk 002: PostgreSQL pricing function working
- [ ] Chunk 003: Security and RLS policies applied
- [ ] Chunk 004: Core API endpoints functional
- [ ] Chunk 005: Idempotency system implemented
- [ ] Chunks 006-014: All UI and admin features complete

**Test Environment:**
- [ ] Can run `npm test` without errors
- [ ] Can connect to test database
- [ ] Supabase test credentials valid
- [ ] Turnstile test tokens configured

**Knowledge Requirements:**
- Basic Vitest syntax (describe, test, expect)
- Understanding of async/await testing
- Familiarity with Supabase client API
- PostgreSQL constraint error codes (23514, 23P01)

### 🚨 Important Notes

**Server-Side Pricing Authority:**
All pricing tests call the PostgreSQL `calculate_booking_pricing()` function - **never test client-side calculations** because the client doesn't calculate pricing.

**Array-Based Data Model:**
Test payloads use `unit_requests` array where each element = 1 unit:
```json
{
  "unit_requests": [
    { "guests_per_unit": 2 },  // Unit 1
    { "guests_per_unit": 3 }   // Unit 2
  ]
}
```
Total units = `array.length` (NOT a `quantity` field).

**Test Isolation:**
- Each test should be independent (no shared state)
- Use unique idempotency keys (`crypto.randomUUID()`)
- Clean up test data after each test (or use transactions)

## What Happens Next

### Immediate Outcomes (After This Chunk)
- ✅ 50+ comprehensive tests covering critical paths
- ✅ Coverage report showing >80% for pricing, validation, constraints
- ✅ Automated test suite runs in <5 minutes
- ✅ Test fixtures available for future development
- ✅ Regression protection for multi-unit features

### Next Chunk (016: E2E and Performance Tests)
- End-to-end tests with Playwright (guest booking flow, admin assignment)
- Load testing with k6 (concurrent bookings, performance baseline)
- Concurrency stress tests (PostgreSQL EXCLUDE constraint under load)
- Rollback testing (dry-run on staging environment)

### Deployment Readiness
After this chunk + chunk 016:
- All tests passing (`npm run test:all`)
- Performance within targets (p95 < 1s API response)
- Ready for chunk 017 (Production Deployment)

## Key Files Created/Modified

**Note**: Test data fixtures go in `tests/fixtures/`, while test code goes in `__tests__/`. This separation keeps data separate from executable tests.

```
tests/
├── fixtures/                              # Test data fixtures (JSON, images, PDFs)
│   ├── bookings/
│   │   ├── valid-single-unit.json         # ← Created
│   │   ├── valid-multi-unit.json          # ← Created
│   │   ├── invalid-dates.json             # ← Created
│   │   └── invalid-capacity.json          # ← Created
│   ├── images/
│   │   ├── payment-proof-valid.jpg        # ← Generated
│   │   ├── payment-proof-large.jpg        # ← Generated
│   │   └── payment-proof-invalid.txt      # ← Created
│   └── discount-rules.json                # ← Created

__tests__/                                  # Test code (separate from fixtures)
├── database/
│   └── constraints.test.ts                # ← Created (10 tests)
├── integration/
│   ├── pricing-api.test.ts                # ← Created (10 tests)
│   ├── booking-api.test.ts                # ← Created (8 tests)
│   ├── idempotency.test.ts                # ← Created (4 tests)
│   └── backward-compatibility.test.ts     # ← Created (3 tests)
└── properties/
    └── pricing-properties.test.ts         # ← Created (4 property tests)

Total: ~50+ tests, ~1500 lines of test code
```

## Related Documentation

### Source Documentation
- **Primary**: `docs/implementation/guest-booking-multi-unit/07-testing-strategy.md`
  - Lines 1-300: Pricing API tests
  - Lines 467-691: Constraint tests
  - Lines 1487-1636: Property-based tests
- **Fixtures**: `docs/implementation/guest-booking-multi-unit/11-test-fixtures.md`
  - Lines 1-100: Pricing configuration
  - Lines 100-200: Complete booking fixtures
- **Decisions**: `docs/implementation/guest-booking-multi-unit/09-implementation-decisions.md`
  - Lines 9-40: Array-based data model rationale
  - Lines 42-62: Server-side pricing authority
  - Lines 64-92: All-or-nothing assignment

### Testing Strategy References
- **Testing Pyramid**: 75% unit, 20% integration, 5% E2E (line 239, 07-testing-strategy.md)
- **Coverage Targets**: Table at lines 1446-1455, 07-testing-strategy.md
- **Test Data Management**: Lines 1459-1486, 07-testing-strategy.md

### Architectural Principles
- **Server-Side Pricing**: PostgreSQL function is SOLE authority (lines 42-62, 09-implementation-decisions.md)
- **Array-Based Model**: Each row = 1 unit, NO quantity field (lines 9-40, 09-implementation-decisions.md)
- **All-or-Nothing**: Admin assigns ALL units or NONE (lines 64-92, 09-implementation-decisions.md)
- **Constraints**: Database enforces business rules (lines 330-348, 09-implementation-decisions.md)

### Test Organization Philosophy

This chunk follows a **layered testing strategy**:

1. **Unit Tests** (Database constraints, pricing functions)
   - Fast execution (<1 second per test)
   - No external dependencies (uses test database)
   - Validates business logic in isolation
   - Examples: constraint violations, pricing calculations

2. **Integration Tests** (API endpoints, idempotency)
   - Moderate execution (<5 seconds per test)
   - Requires running API server
   - Validates component interactions
   - Examples: booking creation flow, duplicate detection

3. **Property-Based Tests** (Pricing invariants)
   - Slower execution (~30-60 seconds total)
   - Tests with random inputs (50+ combinations)
   - Validates invariants hold for ALL inputs
   - Examples: price never negative, downpayment always 50%

**Why This Matters**: This organization makes it easy to run fast tests during development (unit tests) and comprehensive tests before deployment (all tests). You can run `npm run test:run __tests__/database/` for quick feedback or `npm run test:run` for full coverage.

## Success Criteria

### Automated Verification
- [ ] All unit tests pass: `npm run test:run`
- [ ] Coverage >80% for critical paths: `npm run test:coverage`
- [ ] Integration tests pass: `npm run test:integration`
- [ ] No linting errors: `npm run lint`
- [ ] TypeScript compiles: `npm run type-check`

### Test Quality Metrics
- [ ] Pricing engine: 100% branch coverage
- [ ] Constraint tests: All 4 constraints verified
- [ ] API tests: All endpoints covered
- [ ] Idempotency: Duplicate detection works
- [ ] Property tests: All invariants hold (100 runs each)

### Documentation Quality
- [ ] All test files have descriptive names
- [ ] Test descriptions clearly state expected behavior
- [ ] Edge cases documented in comments
- [ ] Fixtures have explanatory comments

## Estimated Timeline

| Step | Description | Time |
|------|-------------|------|
| 1 | Set up test fixtures | 15 min |
| 2 | Database constraint tests | 25 min |
| 3 | PostgreSQL pricing engine tests | 25 min |
| 4 | API integration tests | 20 min |
| 5 | Idempotency and concurrency tests | 15 min |
| 6 | Property-based tests | 15 min |
| 7 | Backward compatibility tests | 10 min |
| 8 | Run full suite and verify coverage | 15 min |
| **Total** | | **140 minutes** |

## Next Steps

1. **Read** `instructions.md` for step-by-step implementation guide
2. **Follow** each step carefully, running tests as you go
3. **Verify** using `checkpoint.md` after completion
4. **Troubleshoot** any issues using `troubleshooting.md`
5. **Commit** with message: `feat: complete chunk 015-unit-integration-tests`
6. **Proceed** to chunk 016 (E2E and Performance Tests)

---

**Version**: 1.0
**Chunk**: 015/017
**Phase**: 4 (Testing & Launch)
**Status**: Ready for Implementation
