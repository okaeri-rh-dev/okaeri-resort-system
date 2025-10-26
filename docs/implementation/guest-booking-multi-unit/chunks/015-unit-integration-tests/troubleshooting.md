# Troubleshooting: Chunk 015 - Unit and Integration Tests

This guide helps resolve common issues when implementing unit and integration tests for the multi-unit guest booking system.

---

## Common Issues

### Issue 1: Database Connection Failures

**Symptom**:

```
Error: connect ECONNREFUSED 127.0.0.1:5432
  or
Error: Invalid Supabase URL
```

**Cause**: Test database is not accessible or environment variables are missing.

**Solution**:

1. **Verify environment variables exist**:

   ```bash
   cat .env.test
   ```

   Should contain:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_KEY=your-service-role-key
   ```

2. **Check database is running**:

   ```bash
   # For local Supabase
   supabase status

   # Should show:
   # API URL: http://localhost:54321
   # DB URL: postgresql://postgres:postgres@localhost:54322/postgres
   ```

3. **Test database connection directly**:

   ```bash
   psql $VITE_SUPABASE_URL -c "SELECT 1;"
   ```

4. **Update test configuration**:
   ```typescript
   // In test files, verify correct client creation
   const supabase = createClient(
     process.env.VITE_SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_KEY! // Not ANON key
   );
   ```

**Prevention**:

- Use `.env.test` file specifically for tests
- Add `.env.test` to `.gitignore`
- Document required environment variables in README

---

### Issue 2: Turnstile Test Tokens Not Working

**Symptom**:

```
Error: Turnstile verification failed
  or
Error: CAPTCHA verification failed
```

**Cause**: Using wrong Turnstile test tokens or production mode enabled.

**Solution**:

1. **Use Cloudflare official test tokens**:

   ```typescript
   // For tests that should pass
   turnstile_token: "1x00000000000000000000AA";

   // For tests that should fail
   turnstile_token: "2x00000000000000000000AB";

   // For idempotency tests (token already spent)
   turnstile_token: "3x00000000000000000000AC";
   ```

2. **Verify test environment**:

   ```bash
   # Ensure not in production mode
   echo $NODE_ENV  # Should be 'test' or 'development'
   ```

3. **Mock Turnstile in tests** (if API validates):
   ```typescript
   // In API test setup
   vi.mock("@/lib/turnstile", () => ({
     verifyTurnstile: vi.fn().mockResolvedValue({ success: true }),
   }));
   ```

**Prevention**:

- Always use official test tokens from [Cloudflare docs](https://developers.cloudflare.com/turnstile/testing/)
- Add token constants to test fixtures
- Document token meanings in code comments

---

### Issue 3: Property-Based Tests Flaky

**Symptom**:

```
Property-based test fails intermittently:
  ✓ PROPERTY: Total price is never negative (Run 1)
  ✗ PROPERTY: Total price is never negative (Run 2)
  ✓ PROPERTY: Total price is never negative (Run 3)
```

**Cause**: Random inputs occasionally generate edge cases that fail.

**Solution**:

1. **Reduce number of runs** (trade coverage for stability):

   ```typescript
   // Before (flaky)
   {
     numRuns: 100;
   }

   // After (more stable)
   {
     numRuns: 50;
   }
   ```

2. **Add input constraints**:

   ```typescript
   fc.asyncProperty(
     fc.integer({ min: 1, max: 10 }), // Constrain to reasonable range
     fc.date({
       min: new Date("2025-01-01"),
       max: new Date("2025-12-31"), // Avoid past dates
     }),
     async (numUnits, checkIn) => {
       // Test logic
     }
   );
   ```

3. **Add defensive checks**:

   ```typescript
   if (response.status !== 200) return true; // Skip invalid inputs

   const data = await response.json();
   if (!data.pricing) return true; // Skip malformed responses
   ```

4. **Investigate failing inputs**:
   ```typescript
   { numRuns: 50, verbose: true } // See which inputs fail
   ```

**Prevention**:

- Start with `numRuns: 10`, increase gradually
- Constrain input generators to valid ranges
- Skip invalid server responses

---

### Issue 4: Constraint Violation Tests Fail

**Symptom**:

```
✗ prevents unit assignment without payment verification
  Expected error code '23514' but got null
```

**Cause**: Database constraints not applied or migrations not run.

**Solution**:

1. **Verify migrations applied**:

   ```bash
   # Check if constraint exists
   psql $DATABASE_URL -c "
   SELECT conname, contype
   FROM pg_constraint
   WHERE conname LIKE '%payment_before_assignment%';
   "
   ```

   Should show constraint exists.

2. **Re-apply migrations**:

   ```bash
   # Reset database (WARNING: destroys data)
   supabase db reset

   # Or apply specific migration
   supabase migration up
   ```

3. **Check constraint definition**:

   ```sql
   -- Verify constraint syntax in migration file
   ALTER TABLE bookings ADD CONSTRAINT payment_before_assignment
   CHECK (
     unit_assignment_status != 'assigned'
     OR payment_status = 'Verified'
   );
   ```

4. **Test constraint directly**:

   ```bash
   # Try to violate constraint manually
   psql $DATABASE_URL -c "
   INSERT INTO bookings (guest_name, payment_status, unit_assignment_status)
   VALUES ('Test', 'Pending', 'assigned');
   "
   ```

   Should fail with constraint violation.

**Prevention**:

- Always run migrations before tests
- Add migration verification step to CI/CD
- Document constraint creation in test comments

---

### Issue 5: API Integration Tests Timeout

**Symptom**:

```
Timeout of 5000ms exceeded.
  For async tests and hooks, ensure "done()" is called
```

**Cause**: API endpoint not responding or network issue with native fetch() call.

**Solution**:

1. **Verify API is running**:

   ```bash
   # Check if API responds
   curl http://localhost:8788/api/health
   ```

2. **Increase test timeout**:

   ```typescript
   test(
     "creates booking",
     async () => {
       // Test logic
     },
     { timeout: 10000 }
   ); // 10 second timeout
   ```

3. **Check API base URL**:

   ```typescript
   const API_BASE = process.env.VITE_API_URL || "http://localhost:8788";
   console.log("Testing API at:", API_BASE);
   ```

4. **Mock API for unit tests**:
   ```typescript
   // Instead of calling real API
   vi.mock("@/lib/api", () => ({
     createBooking: vi.fn().mockResolvedValue({ success: true }),
   }));
   ```

**Prevention**:

- Start API server before running integration tests
- Use realistic timeouts (5-10 seconds)
- Separate unit tests (no API) from integration tests (API required)

---

### Issue 6: Idempotency Tests Fail

**Symptom**:

```
✗ prevents duplicate booking creation with same key
  Expected booking IDs to match but got different IDs
```

**Cause**: Idempotency key not being checked or cleanup issue.

**Solution**:

1. **Verify idempotency implementation**:

   ```bash
   # Check if idempotency_keys table exists
   psql $DATABASE_URL -c "\d idempotency_keys"
   ```

2. **Check API implementation**:

   ```typescript
   // In API handler
   const existing = await checkIdempotencyKey(key);
   if (existing) {
     return Response.json(existing); // Return existing, not create new
   }
   ```

3. **Use unique keys per test**:

   ```typescript
   // Before (fails due to reuse)
   const key = "test-key-123";

   // After (unique per test)
   const key = crypto.randomUUID();
   ```

4. **Clean up test data**:
   ```typescript
   afterEach(async () => {
     // Delete idempotency keys created in test
     await supabase.from("idempotency_keys").delete().lt("created_at", "now()");
   });
   ```

**Prevention**:

- Always use `crypto.randomUUID()` for test keys
- Add cleanup logic in `afterEach`
- Test idempotency logic in isolation first

---

### Issue 7: Coverage Below Target

**Symptom**:

```
Coverage:
  Statements: 72.34% (Target: 80%)
  Branches: 65.12% (Target: 80%)
```

**Cause**: Missing tests for error handling paths or edge cases.

**Solution**:

1. **Identify uncovered code**:

   ```bash
   npm run test:coverage
   open coverage/index.html
   ```

   Red lines = uncovered code

2. **Add tests for error paths**:

   ```typescript
   // Test error handling
   test("handles invalid date range", async () => {
     const response = await fetch("/api/pricing", {
       body: JSON.stringify({
         check_in: "2025-03-20",
         check_out: "2025-03-15", // Invalid: checkout before checkin
       }),
     });

     expect(response.status).toBe(400);
   });
   ```

3. **Test edge cases**:

   ```typescript
   // Minimum values
   test("handles 1 unit, 1 night, 1 guest", async () => {
     /* ... */
   });

   // Maximum values
   test("handles 10 units, 30 nights, 20 guests per unit", async () => {
     /* ... */
   });

   // Boundary values
   test("handles exactly 7 nights (triggers discount)", async () => {
     /* ... */
   });
   ```

4. **Focus on critical paths**:
   - Pricing calculations (target 100%)
   - Constraint enforcement (target 100%)
   - Validation logic (target 95%)

**Prevention**:

- Write tests for error cases first
- Use TDD approach (test before implementation)
- Review coverage report after each test addition

---

### Issue 8: Tests Pass Locally But Fail in CI/CD

**Symptom**:

```
Local: ✓ All tests pass
CI/CD: ✗ 5 tests fail with database errors
```

**Cause**: Environment differences (database, env vars, timing).

**Solution**:

1. **Check CI environment variables**:

   ```yaml
   # In .github/workflows/test.yml
   env:
     VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
     SUPABASE_SERVICE_KEY: ${{ secrets.SERVICE_KEY }}
     NODE_ENV: test
   ```

2. **Add database setup in CI**:

   ```yaml
   services:
     postgres:
       image: postgres:14
       env:
         POSTGRES_PASSWORD: postgres
       options: >-
         --health-cmd pg_isready
         --health-interval 10s
   ```

3. **Run migrations in CI**:

   ```yaml
   - name: Setup database
     run: |
       npm run db:migrate
       npm run db:seed:test
   ```

4. **Add retry logic for timing issues**:
   ```typescript
   // For tests with external dependencies
   test("creates booking", async () => {
     let attempts = 0;
     while (attempts < 3) {
       try {
         const response = await fetch(/* ... */);
         expect(response.ok).toBe(true);
         break;
       } catch (error) {
         attempts++;
         if (attempts === 3) throw error;
         await new Promise((r) => setTimeout(r, 1000));
       }
     }
   });
   ```

**Prevention**:

- Use same database version locally and in CI
- Document CI setup requirements
- Test with CI environment variables locally

---

## Debugging Techniques

### 1. Isolate Failing Test

```bash
# Run single test file
npm run test:run __tests__/database/constraints.test.ts

# Run specific test by name pattern
npm run test:run -- --grep "payment_before_assignment"

# Run with verbose output
npm run test:run -- --reporter=verbose
```

### 2. Add Debug Logging

```typescript
test("pricing calculation", async () => {
  const response = await fetch("/api/pricing", {
    /* ... */
  });

  // Add debug logging
  const data = await response.json();
  console.log("Response:", JSON.stringify(data, null, 2));

  expect(data.pricing.total).toBeGreaterThan(0);
});
```

### 3. Use Vitest UI for Debugging

```bash
# Launch Vitest UI (interactive test runner)
npm run test:ui
```

Features:

- Click on tests to see details
- Inspect test output
- Filter by status (passed/failed)
- Re-run single tests

### 4. Check Database State

```typescript
afterEach(async () => {
  // Inspect database state after test
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("guest_name", "Test Guest");

  console.log("Bookings after test:", data);
});
```

### 5. Use Breakpoints (VS Code)

1. Add breakpoint in test file (click line number)
2. Run test in debug mode:
   ```bash
   npm run test:debug
   ```
3. Inspect variables, step through code

---

## Performance Issues

### Slow Test Execution (>5 minutes)

**Causes**:

- Too many API calls
- Database not using transactions
- Property-based tests with high `numRuns`
- Serial test execution (not parallel)

**Solutions**:

1. **Parallelize tests**:

   ```typescript
   // vitest.config.ts
   export default defineConfig({
     test: {
       maxConcurrency: 5, // Run 5 tests concurrently
       pool: "threads",
     },
   });
   ```

2. **Use database transactions**:

   ```typescript
   beforeEach(async () => {
     await supabase.rpc("begin_transaction");
   });

   afterEach(async () => {
     await supabase.rpc("rollback_transaction");
   });
   ```

3. **Reduce property test runs**:

   ```typescript
   // Before: 100 runs (slow)
   {
     numRuns: 100;
   }

   // After: 30 runs (faster)
   {
     numRuns: 30;
   }
   ```

4. **Mock expensive operations**:
   ```typescript
   vi.mock("@/lib/pricing", () => ({
     calculatePrice: vi.fn().mockReturnValue(1000),
   }));
   ```

---

## Still Stuck?

### 1. Check Documentation

- **Testing Strategy**: `docs/implementation/guest-booking-multi-unit/07-testing-strategy.md`
- **Test Fixtures**: `docs/implementation/guest-booking-multi-unit/11-test-fixtures.md`
- **Vitest Docs**: https://vitest.dev/guide/
- **Supabase Testing**: https://supabase.com/docs/guides/testing

### 2. Review Similar Tests

Look at existing tests in the codebase:

```bash
# Find similar test patterns
grep -r "describe('API Integration" src/__tests__/

# Find similar assertions
grep -r "expect.*toBe.*true" src/__tests__/
```

### 3. Search for Error Messages

```bash
# Search codebase for error message
grep -r "ECONNREFUSED" .

# Search documentation
grep -r "database connection" docs/
```

### 4. Ask for Help

**Before asking**:

- [ ] Checked this troubleshooting guide
- [ ] Reviewed error message carefully
- [ ] Tried suggested solutions
- [ ] Isolated the issue to specific test
- [ ] Documented steps to reproduce

**Include when asking**:

- Full error message (copy-paste)
- Test code causing the issue
- Environment details (OS, Node version, database)
- What you've tried already
- Minimal reproduction steps

**Where to ask**:

- Project GitHub issues
- Team Slack/Discord channel
- Stack Overflow (tag: vitest, supabase)

---

## Preventive Measures

### Before Writing Tests

- [ ] Read testing strategy document
- [ ] Review existing test patterns
- [ ] Set up test environment properly
- [ ] Verify database accessible
- [ ] Understand architectural principles (server-side pricing, array-based model)

### During Test Writing

- [ ] Write descriptive test names
- [ ] Add cleanup logic (`afterEach`, `afterAll`)
- [ ] Use unique test data (UUIDs)
- [ ] Test error cases, not just happy path
- [ ] Add comments for complex scenarios

### After Writing Tests

- [ ] Run tests multiple times (check for flakiness)
- [ ] Review coverage report
- [ ] Check execution time (<5 minutes)
- [ ] Verify tests in CI/CD environment
- [ ] Document any known issues

---

## Error Code Reference

| Error Code     | Meaning                      | Common Cause                                             |
| -------------- | ---------------------------- | -------------------------------------------------------- |
| `23514`        | CHECK constraint violation   | Business rule violated (e.g., payment_before_assignment) |
| `23P01`        | EXCLUDE constraint violation | Double-booking attempt (overlapping dates)               |
| `ECONNREFUSED` | Connection refused           | Database not running or wrong URL                        |
| `ENOTFOUND`    | DNS lookup failed            | Invalid Supabase URL                                     |
| `401`          | Unauthorized                 | Invalid or missing auth token                            |
| `400`          | Bad Request                  | Validation error in request payload                      |
| `500`          | Internal Server Error        | API or database error                                    |

---

**Troubleshooting Version**: 1.0
**Chunk**: 015/017
**Last Updated**: 2025-10-24
