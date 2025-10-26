# Checkpoint: Chunk 015 - Unit and Integration Tests

Use this checklist to verify that the unit and integration tests have been implemented correctly and meet all requirements.

---

## Automated Checks

Run these commands to verify implementation. All should pass before marking chunk complete.

### 1. Run All Unit Tests

```bash
npm run test:run
```

**Expected Result**:

```
✓ __tests__/database/constraints.test.ts (10 tests)
✓ __tests__/integration/pricing-api.test.ts (10 tests)
✓ __tests__/integration/booking-api.test.ts (8 tests)
✓ __tests__/integration/idempotency.test.ts (4 tests)
✓ __tests__/properties/pricing-properties.test.ts (4 tests)
✓ __tests__/integration/backward-compatibility.test.ts (3 tests)

Test Files  6 passed (6)
     Tests  39 passed (39)
```

**✅ Pass Criteria**: All tests pass, 0 failures

### 2. Generate Coverage Report

```bash
npm run test:coverage
```

**Expected Result**:

```
File                                    | % Stmts | % Branch | % Funcs | % Lines
----------------------------------------|---------|----------|---------|--------
All files                               |   85.12 |    82.45 |   88.32 |   84.98
 functions/api/guest-booking.ts         |   92.34 |    88.21 |   95.12 |   91.87
 functions/api/preview-pricing.ts       |   94.12 |    90.45 |   96.34 |   93.78
 __tests__/database/constraints.test.ts |  100.00 |   100.00 |  100.00 |  100.00
```

**✅ Pass Criteria**:

- Overall coverage >80%
- Pricing engine >95%
- Constraints >95%
- API endpoints >90%

### 3. Type Check

```bash
npm run type-check
```

**Expected Result**:

```
✓ No TypeScript errors found
```

**✅ Pass Criteria**: No TypeScript errors

### 4. Lint Check

```bash
npm run lint
```

**Expected Result**:

```
✓ 0 errors, 0 warnings
```

**✅ Pass Criteria**: No linting errors (warnings acceptable)

### 5. Verify Test Execution Time

```bash
time npm run test:run
```

**Expected Result**:

```
real    0m45.123s
user    0m38.456s
sys     0m4.789s
```

**✅ Pass Criteria**: Total time < 5 minutes (300 seconds)

### 6. Check for Flaky Tests

```bash
# Run tests 3 times consecutively
npm run test:run && npm run test:run && npm run test:run
```

**Expected Result**: All 3 runs should pass with identical results

**✅ Pass Criteria**: No test failures across 3 consecutive runs

---

## Manual Checks

Perform these manual verification steps to ensure quality and completeness.

### 1. Review Test Fixtures

```bash
# Verify fixture directory structure
tree tests/fixtures
```

**Expected Structure**:

```
tests/fixtures
├── bookings
│   ├── invalid-capacity.json
│   ├── invalid-dates.json
│   ├── valid-multi-unit.json
│   └── valid-single-unit.json
├── discount-rules.json
└── images
    ├── payment-proof-invalid.txt
    ├── payment-proof-large.jpg
    └── payment-proof-valid.jpg
```

**✅ Checklist**:

- [ ] All JSON fixtures are valid JSON (no syntax errors)
- [ ] Fixtures use correct array-based structure (`unit_requests`)
- [ ] Idempotency keys are unique across fixtures
- [ ] Turnstile tokens use test tokens (`1x00000000000000000000AA`)

### 2. Review Test Coverage Gaps

```bash
# Open coverage report
open coverage/index.html
```

**Check for uncovered code**:

- [ ] Error handling paths covered
- [ ] Edge cases covered (0 units, max units, etc.)
- [ ] Discount calculation branches covered
- [ ] Constraint violation paths covered

**✅ Pass Criteria**: No critical business logic paths uncovered

### 3. Verify Database Constraint Tests

**Review constraint test results**:

- [ ] `payment_before_assignment` prevents assignment without verified payment
- [ ] `payment_before_assignment` allows assignment with verified payment
- [ ] `all_or_nothing_assignment` prevents partial assignment
- [ ] `all_or_nothing_assignment` allows complete assignment
- [ ] `no_double_booking` prevents overlapping bookings
- [ ] `no_double_booking` allows consecutive bookings
- [ ] `guests_per_unit > 0` prevents zero guests
- [ ] `guests_per_unit > 0` prevents negative guests

**✅ Checklist**: All 8+ constraint tests pass

### 4. Verify Pricing Engine Tests

**Review pricing test results**:

- [ ] Base price calculation correct for array-based requests
- [ ] 5% discount applied for 7-night stays
- [ ] 10% discount applied for 14-night stays
- [ ] NO discount for short stays (<7 nights)
- [ ] Weekend surcharge applies for Friday-Sunday
- [ ] Extra person fees calculated correctly
- [ ] Single night booking handled
- [ ] Maximum 10 units handled
- [ ] Invalid date range rejected
- [ ] Pricing from `pricing_config` table verified

**✅ Checklist**: All 10+ pricing tests pass

### 5. Verify API Integration Tests

**Review API test results**:

- [ ] Multi-unit booking creation successful
- [ ] Single-unit booking creation successful
- [ ] Duration discount applied via API
- [ ] Input validation works (rejects invalid data)
- [ ] Guest capacity validation enforced
- [ ] Static rates endpoint works
- [ ] Discount rules endpoint works

**✅ Checklist**: All 7+ API tests pass

### 6. Verify Idempotency Tests

**Review idempotency test results**:

- [ ] Duplicate booking prevented with same key
- [ ] New booking allowed with different key
- [ ] Concurrent unit assignment conflict detected
- [ ] Concurrent assignment of different units allowed

**✅ Checklist**: All 4 idempotency/concurrency tests pass

### 7. Verify Property-Based Tests

**Review property test results**:

- [ ] Total price never negative (tested across 50 random inputs)
- [ ] Downpayment always 50% of total
- [ ] Discount never exceeds subtotal
- [ ] More nights costs more or equal

**✅ Checklist**: All 4 property tests pass (may take 30-60 seconds)

### 8. Code Quality Review

**Review test code**:

- [ ] Test names clearly describe expected behavior
- [ ] Tests are independent (no shared state between tests)
- [ ] Cleanup logic present (afterEach, afterAll)
- [ ] Comments explain complex test scenarios
- [ ] No hardcoded values (use constants/fixtures)
- [ ] Test data uses realistic values
- [ ] Error assertions check specific error codes/messages

**✅ Pass Criteria**: Code follows testing best practices

---

## Success Criteria

### Critical Requirements (Must Pass)

- [x] **All automated checks pass** (tests, coverage, type-check, lint)
- [x] **Coverage >80%** for critical paths
- [x] **Pricing engine coverage 100%**
- [x] **Constraint tests 100%**
- [x] **No test failures** across 3 consecutive runs
- [x] **Test execution time < 5 minutes**
- [x] **All fixtures valid JSON**
- [x] **Property-based tests pass** (invariants hold)

### Quality Requirements (Should Pass)

- [ ] No code coverage gaps in error handling
- [ ] Test names follow descriptive pattern
- [ ] All tests have cleanup logic
- [ ] Comments explain complex scenarios
- [ ] No flaky tests detected
- [ ] Test data uses realistic values

### Documentation Requirements (Should Complete)

- [ ] Test fixtures documented with comments
- [ ] Complex test scenarios explained
- [ ] Edge cases documented
- [ ] Known limitations noted

---

## If Any Check Fails

### Test Failures

**Symptom**: Some tests fail when running `npm run test:run`

**Solution**:

1. Check error message for specific test failure
2. Review test code for logic errors
3. Verify database connection (test database accessible)
4. Check environment variables (`.env.test` configured)
5. Consult `troubleshooting.md` for specific error patterns

**Common Causes**:

- Database not running or inaccessible
- Missing environment variables
- Fixture data invalid
- API endpoints not running (for integration tests)

### Coverage Below Target

**Symptom**: Coverage report shows <80% for critical modules

**Solution**:

1. Open coverage report: `open coverage/index.html`
2. Identify uncovered lines (highlighted in red)
3. Add tests for uncovered paths
4. Focus on:
   - Error handling branches
   - Edge cases (min/max values)
   - Discount calculation logic
   - Constraint violation paths

**Priority Coverage Areas**:

- Pricing function: Target 100%
- Constraint enforcement: Target 100%
- API validation: Target >95%

### Type Errors

**Symptom**: `npm run type-check` shows TypeScript errors

**Solution**:

1. Review error messages
2. Check test file imports (use correct types from `@supabase/supabase-js`)
3. Ensure Vitest types installed: `npm install -D @vitest/ui`
4. Check `tsconfig.json` includes test directories

**Common Type Issues**:

- Missing type imports
- Incorrect Supabase client types
- Missing `@types` packages

### Flaky Tests

**Symptom**: Tests pass sometimes but fail on reruns

**Solution**:

1. Identify flaky test by running multiple times
2. Check for:
   - Shared state between tests
   - Missing cleanup (afterEach, afterAll)
   - Timing issues (add waits/retries)
   - Non-unique test data (use `crypto.randomUUID()`)
3. Isolate test and run repeatedly: `npm run test:run -- path/to/test.ts`

**Common Causes**:

- Database state not cleaned between tests
- Concurrent test execution conflicts
- Timing-dependent assertions
- Reused idempotency keys

### Slow Test Execution

**Symptom**: Tests take >5 minutes to run

**Solution**:

1. Identify slow tests: `npm run test:run -- --reporter=verbose`
2. Optimize:
   - Reduce property-based test `numRuns` (from 100 to 50)
   - Parallelize tests (Vitest default)
   - Use database transactions for faster cleanup
   - Mock API calls where appropriate
3. Check for infinite loops or blocking calls

---

## When All Checks Pass

### 1. Final Verification

Run complete verification suite:

```bash
# Run all checks together
npm run verify
```

**Expected**: All checks pass (type-check, lint, tests)

### 2. Commit Changes

```bash
git add .
git commit -m "feat: complete chunk 015-unit-integration-tests

- Add 50+ comprehensive tests for multi-unit booking
- Implement database constraint tests (payment_before_assignment, all_or_nothing, no_double_booking)
- Create pricing engine tests (server-side authority validation)
- Add API integration tests (booking creation, preview, rates)
- Implement idempotency and concurrency tests
- Add property-based tests for pricing invariants
- Create backward compatibility tests
- Establish test fixtures and infrastructure
- Achieve >80% coverage on critical paths

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### 3. Tag Milestone

```bash
git tag chunk-015
git push origin main --tags
```

### 4. Update Progress Tracker

Mark chunk 015 as complete in your project tracking system.

### 5. Proceed to Next Chunk

**Next**: Chunk 016 - E2E and Performance Tests

- End-to-end tests with Playwright
- Load testing with k6
- Concurrency stress tests
- Performance baseline capture
- Rollback dry-run testing

**Estimated Time**: 120 minutes

---

## Status Tracking

Use this table to track checkpoint progress:

| Check Category             | Status                             | Time Taken     | Issues | Notes           |
| -------------------------- | ---------------------------------- | -------------- | ------ | --------------- |
| **Automated Checks**       |                                    |                |        |                 |
| All tests pass             | ⬜ Pass / ❌ Fail / 🟡 In Progress | \_\_\_ min     |        |                 |
| Coverage >80%              | ⬜ Pass / ❌ Fail / 🟡 In Progress | \_\_\_ min     |        |                 |
| Type check                 | ⬜ Pass / ❌ Fail / 🟡 In Progress | \_\_\_ min     |        |                 |
| Lint check                 | ⬜ Pass / ❌ Fail / 🟡 In Progress | \_\_\_ min     |        |                 |
| Execution time <5min       | ⬜ Pass / ❌ Fail / 🟡 In Progress | \_\_\_ min     |        |                 |
| No flaky tests             | ⬜ Pass / ❌ Fail / 🟡 In Progress | \_\_\_ min     |        |                 |
| **Manual Checks**          |                                    |                |        |                 |
| Fixtures valid             | ⬜ Pass / ❌ Fail / 🟡 In Progress | \_\_\_ min     |        |                 |
| Coverage gaps reviewed     | ⬜ Pass / ❌ Fail / 🟡 In Progress | \_\_\_ min     |        |                 |
| Constraint tests verified  | ⬜ Pass / ❌ Fail / 🟡 In Progress | \_\_\_ min     |        |                 |
| Pricing tests verified     | ⬜ Pass / ❌ Fail / 🟡 In Progress | \_\_\_ min     |        |                 |
| API tests verified         | ⬜ Pass / ❌ Fail / 🟡 In Progress | \_\_\_ min     |        |                 |
| Idempotency tests verified | ⬜ Pass / ❌ Fail / 🟡 In Progress | \_\_\_ min     |        |                 |
| Property tests verified    | ⬜ Pass / ❌ Fail / 🟡 In Progress | \_\_\_ min     |        |                 |
| Code quality reviewed      | ⬜ Pass / ❌ Fail / 🟡 In Progress | \_\_\_ min     |        |                 |
| **Overall**                |                                    |                |        |                 |
| **Total Time**             |                                    | **\_\_\_ min** |        | Target: 120 min |
| **All Checks Pass**        | ⬜ Yes / ❌ No                     |                |        |                 |
| **Ready for Next Chunk**   | ⬜ Yes / ❌ No                     |                |        |                 |

---

**Checkpoint Version**: 1.0
**Chunk**: 015/017
**Phase**: 4 (Testing & Launch)
**Status**: Ready for Verification
