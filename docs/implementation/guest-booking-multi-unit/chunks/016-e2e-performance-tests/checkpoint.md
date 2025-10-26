# Chunk 016: E2E and Performance Tests - Checkpoint

## Automated Checks

Run these commands to verify implementation correctness:

### 1. Playwright E2E Tests

```bash
# Run all E2E tests
npx playwright test

# Expected: All tests passing
# ✓ guest-booking-multi-unit.spec.ts (5 tests)
# ✓ admin-assignment.spec.ts (5 tests)
```

**Success Criteria**:

- All 10+ E2E tests pass
- No timeout errors
- Screenshots captured for failures (if any)

### 2. Concurrency Tests

```bash
# Run concurrency stress tests
npx vitest run tests/concurrency/admin-assignment-race.test.ts
```

**Success Criteria**:

- PostgreSQL EXCLUDE constraint blocks double-booking
- Exactly 1 of 2 concurrent assignments succeeds
- Error code 23P01 (exclusion violation) returned for blocked attempt

### 3. Load Testing

```bash
# Ensure dev server running
npm run dev

# In another terminal, run k6 load test
k6 run tests/performance/load-test.js
```

**Success Criteria**:

- All thresholds passed (p95 < 1s, error rate < 0.5%)
- 10 concurrent users handled
- No connection errors
- All booking requests processed successfully

### 4. Performance Regression Test

```bash
# Run regression comparison vs baseline
npx tsx tests/performance/regression-test.ts
```

**Success Criteria**:

- Baseline file exists in `performance-baselines/`
- All metrics within acceptable thresholds (+20%)
- No red flags (>50% regression)
- Report generated successfully

### 5. Rollback Acceptance Tests (Staging Only)

```bash
# Set staging environment variables
export STAGING_SUPABASE_URL="your-staging-url"
export STAGING_SUPABASE_SERVICE_KEY="your-staging-key"

# Run rollback acceptance tests
npx vitest run tests/rollback/acceptance.test.ts
```

**Success Criteria**:

- Zero data loss (all bookings preserved)
- Multi-unit tables removed
- Legacy single-unit booking works
- API endpoints functional

### 6. Code Quality

```bash
# TypeScript compilation
npm run type-check

# Linting
npm run lint

# All tests (unit + integration + E2E)
npm run test:all
```

**Success Criteria**:

- No TypeScript errors
- No linting errors
- All test suites passing

---

## Manual Checks

### E2E Guest Booking Flow

1. **Start application**: `npm run dev`
2. **Open Playwright UI**: `npx playwright test --ui`
3. **Run "complete multi-unit booking" test**
4. **Verify**:
   - [ ] Form navigates through all 5 steps
   - [ ] Units can be added dynamically
   - [ ] Pricing preview updates in real-time
   - [ ] Payment proof uploads successfully
   - [ ] Confirmation page displays booking reference

### E2E Admin Assignment Flow

1. **Run "assign units to multi-unit booking" test in Playwright UI**
2. **Verify**:
   - [ ] Admin can login successfully
   - [ ] Pending bookings queue displays
   - [ ] Assignment modal opens with correct unit count
   - [ ] All-or-nothing enforcement works (cannot select partial)
   - [ ] Success message displays after assignment

### Concurrency Verification

1. **Review concurrency test output**
2. **Verify**:
   - [ ] Exactly 1 of 2 concurrent assignments succeeds
   - [ ] Failed assignment returns error code 23P01
   - [ ] Error message contains "no_double_booking"
   - [ ] No data corruption (no partial assignments)

### Load Test Results

1. **Review k6 output**
2. **Verify**:
   - [ ] http_req_duration p(95) < 1000ms
   - [ ] error rate < 0.5%
   - [ ] All checks passed (status 201, booking reference present)
   - [ ] No connection timeouts or refused connections

### Performance Regression

1. **Review regression report output**
2. **Verify**:
   - [ ] Baseline comparison shown for each metric
   - [ ] Regression percentage calculated
   - [ ] Status indicators (✅/⚠️/❌) displayed
   - [ ] Overall pass/fail status clear

### Rollback Dry-Run

1. **Review rollback test output (staging environment)**
2. **Verify**:
   - [ ] Booking count matches pre-rollback count
   - [ ] Multi-unit tables no longer exist
   - [ ] Test booking can be created with legacy format
   - [ ] API endpoints return 200 OK

---

## Success Criteria Checklist

### E2E Test Coverage

- [ ] **Guest Booking**: Complete multi-unit booking (3 units, 7 nights)
- [ ] **Discount Verification**: 5% discount for 7-night stay
- [ ] **Discount Verification**: 10% discount for 14-night stay
- [ ] **Validation**: Maximum 10 units enforced
- [ ] **Validation**: Maximum 20 guests per unit enforced
- [ ] **Admin Assignment**: All-or-nothing enforcement works
- [ ] **Admin Assignment**: Partial assignment blocked
- [ ] **Admin Assignment**: Conflict detection (unit already booked)
- [ ] **Admin Queue**: Sorted by urgency score
- [ ] **Payment Verification**: Proof upload and approval flow

### Performance & Load Testing

- [ ] **Baseline**: Performance baseline exists and is valid
- [ ] **Regression**: Booking creation within +20% of baseline
- [ ] **Regression**: API response time within +20% of baseline
- [ ] **Load Test**: 10 concurrent bookings handled successfully
- [ ] **Load Test**: p95 response time < 1 second
- [ ] **Load Test**: Error rate < 0.5%

### Concurrency & Data Integrity

- [ ] **Concurrency**: PostgreSQL EXCLUDE constraint blocks double-booking
- [ ] **Concurrency**: Exactly 1 of 2 concurrent assignments succeeds
- [ ] **Concurrency**: Idempotency prevents duplicate bookings under load
- [ ] **Concurrency**: Transaction rollback works (all-or-nothing)

### Rollback Verification

- [ ] **Rollback**: Dry-run completed on staging environment
- [ ] **Rollback**: Zero data loss (all bookings preserved)
- [ ] **Rollback**: Multi-unit tables removed successfully
- [ ] **Rollback**: Legacy API endpoints functional
- [ ] **Rollback**: Total rollback time < 1 hour

### Code Quality

- [ ] **TypeScript**: No compilation errors
- [ ] **Linting**: No linting errors
- [ ] **Tests**: All unit tests passing (chunk 015)
- [ ] **Tests**: All integration tests passing (chunk 015)
- [ ] **Tests**: All E2E tests passing (chunk 016)

---

## Status Tracking

Use this table to track verification progress:

| Check Category             | Status            | Time Taken | Notes                   | Issues |
| -------------------------- | ----------------- | ---------- | ----------------------- | ------ |
| **Playwright E2E Tests**   | ⬜ Pass / ⬜ Fail | \_\_\_ min | \_\_\_ tests passed     |        |
| **Concurrency Tests**      | ⬜ Pass / ⬜ Fail | \_\_\_ min | Double-booking blocked? |        |
| **Load Testing (k6)**      | ⬜ Pass / ⬜ Fail | \_\_\_ min | p95 < 1s? Error rate?   |        |
| **Performance Regression** | ⬜ Pass / ⬜ Fail | \_\_\_ min | Within +20%?            |        |
| **Rollback Dry-Run**       | ⬜ Pass / ⬜ Fail | \_\_\_ min | Data loss? Timing?      |        |
| **Code Quality**           | ⬜ Pass / ⬜ Fail | \_\_\_ min | TS/Lint/Tests?          |        |

**Overall Status**: ⬜ Complete / ⬜ In Progress / ⬜ Blocked

**Total Time Spent**: **\_\_\_** minutes

---

## If Any Check Fails

### E2E Tests Fail

**Symptom**: Playwright tests timeout or fail
**Action**:

1. Check `troubleshooting.md` section on Playwright issues
2. Review test output and screenshots (in `playwright-report/`)
3. Verify test environment (dev server running, database accessible)
4. Check for race conditions or timing issues

### Concurrency Tests Fail

**Symptom**: Both concurrent assignments succeed (no blocking)
**Action**:

1. Verify PostgreSQL EXCLUDE constraint exists: `\d booking_units` in psql
2. Check constraint definition includes `unit_id` and `daterange`
3. Review chunk 003 (Security, RLS, and Constraints) implementation
4. Confirm database isolation level is correct

### Load Test Fails

**Symptom**: High error rate or timeouts
**Action**:

1. Check database connection pool settings
2. Verify rate limiting not too aggressive
3. Review API logs for specific errors
4. Consider increasing timeout thresholds temporarily for debugging

### Performance Regression Exceeds Threshold

**Symptom**: Regression report shows >20% degradation
**Action**:

1. Profile slow queries with `EXPLAIN ANALYZE`
2. Check if database indexes are present
3. Review pricing function optimization opportunities
4. Consider if regression is acceptable for added functionality

### Rollback Dry-Run Fails

**Symptom**: Data loss or errors during rollback
**Action**:

1. ⚠️ **CRITICAL**: Stop immediately, do not proceed
2. Review rollback script for errors
3. Restore staging database from backup
4. Escalate to senior developer before proceeding

### Load Test Connection Errors

**Symptom**: k6 shows "connection refused" or timeouts
**Action**:

1. Verify dev server is running on correct port
2. Check firewall/network settings
3. Review rate limiting configuration
4. Ensure database accepts connections under load

---

## When All Checks Pass

### Celebrate! 🎉

You've completed comprehensive E2E and performance testing for the multi-unit guest booking system.

### Commit Your Work

```bash
# Stage all E2E and performance test files
git add e2e/ tests/performance/ tests/concurrency/ tests/rollback/
git add playwright.config.ts performance-baselines/

# Commit with descriptive message
git commit -m "test: complete chunk 016-e2e-performance-tests

- Add 10+ Playwright E2E tests for guest booking and admin flows
- Implement concurrency stress tests with PostgreSQL EXCLUDE constraint
- Create k6 load testing suite (10 concurrent users)
- Add performance regression testing vs baseline
- Verify rollback procedures with acceptance tests

All tests passing. System ready for production deployment."

# Tag the commit
git tag chunk-016

# Push to remote
git push origin main --tags
```

### Test Coverage Summary

After this chunk, your test coverage should be:

| Test Layer              | Test Count | Coverage | Purpose                          |
| ----------------------- | ---------- | -------- | -------------------------------- |
| Unit Tests (015)        | 50+        | 75%      | Component correctness            |
| Integration Tests (015) | 20+        | 20%      | API contracts, constraints       |
| E2E Tests (016)         | 10+        | 5%       | Critical user journeys           |
| Performance Tests (016) | 2          | N/A      | Baseline + regression            |
| Concurrency Tests (016) | 3          | N/A      | Database constraint verification |
| **TOTAL**               | **85+**    | **100%** | **Full test pyramid**            |

### Next Steps

**Proceed to Chunk 017: Deployment and Monitoring**

Prerequisites verified:

- ✅ All tests passing (unit + integration + E2E)
- ✅ Performance within acceptable thresholds
- ✅ Concurrency safety verified
- ✅ Rollback procedure validated
- ✅ System ready for production

Chunk 017 will cover:

- Production database migration
- Cloudflare Pages/Workers deployment
- Monitoring setup (Grafana Cloud, UptimeRobot)
- Alert configuration
- Admin training session
- Post-deployment verification

---

**Chunk**: 016/017
**Status**: ✅ Ready for Sign-Off
**Next Chunk**: 017 (Deployment and Monitoring)
