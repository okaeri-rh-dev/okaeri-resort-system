# Chunk 016: E2E and Performance Tests - Troubleshooting

## Common Issues and Solutions

---

## Issue 1: Playwright Tests Timeout

### Symptom

```
Error: Test timeout of 30000ms exceeded
```

Tests hang indefinitely or timeout after 30 seconds.

### Root Causes

1. **Slow network/API responses**
2. **Element not found (incorrect selector)**
3. **Missing wait conditions**
4. **Dev server not running**

### Solutions

**Solution 1: Increase timeout globally**

Edit `playwright.config.ts`:

```typescript
export default defineConfig({
  // ... other config
  use: {
    baseURL: "http://localhost:5173",
    timeout: 60000, // Increase to 60s
  },
});
```

**Solution 2: Add explicit waits**

```typescript
// Wait for element before interaction
await page.waitForSelector('[data-testid="add-unit-button"]', { timeout: 10000 });
await page.click('[data-testid="add-unit-button"]');

// Wait for navigation
await page.waitForURL("/guest-booking/confirmation");
```

**Solution 3: Verify dev server is running**

```bash
# Check if server is running
curl http://localhost:5173

# Restart server if needed
npm run dev
```

**Solution 4: Debug with headed mode**

```bash
# Run tests with browser visible
npx playwright test --headed --debug

# Or use UI mode
npx playwright test --ui
```

---

## Issue 2: Performance Regression Exceeds Threshold

### Symptom

```
❌ FAIL - Performance regression exceeds acceptable thresholds
booking_creation: +55.3% ❌ RED FLAG
```

Regression test shows >50% performance degradation.

### Root Causes

1. **Missing database indexes**
2. **Inefficient pricing function queries**
3. **Network latency (test environment)**
4. **Baseline captured incorrectly**

### Solutions

**Solution 1: Verify database indexes exist**

```sql
-- Check indexes on critical tables
\d bookings
\d guest_booking_unit_requests
\d pricing_config

-- Recreate indexes if missing
CREATE INDEX IF NOT EXISTS idx_bookings_dates
  ON bookings(check_in_date, check_out_date);

CREATE INDEX IF NOT EXISTS idx_unit_requests_booking
  ON guest_booking_unit_requests(booking_id);
```

**Solution 2: Profile slow queries**

```sql
-- Enable query timing
\timing

-- Run pricing function with EXPLAIN ANALYZE
EXPLAIN ANALYZE
SELECT * FROM calculate_booking_pricing(
  '[{"guests_per_unit": 2}]'::jsonb,
  '2025-03-01'::date,
  '2025-03-08'::date
);

-- Look for Seq Scan (bad), prefer Index Scan (good)
```

**Solution 3: Recapture baseline**

If baseline was captured incorrectly (e.g., on loaded system):

```bash
# Stop all background processes
# Restart dev server
npm run dev

# Recapture baseline
npx tsx tests/performance/baseline-capture.ts
```

**Solution 4: Adjust acceptable thresholds**

If regression is expected due to added functionality, update thresholds in `regression-test.ts`:

```typescript
const THRESHOLDS: Record<string, Threshold> = {
  booking_creation: { acceptable: 30, redFlag: 60 }, // Increased from 20/50
  api_response: { acceptable: 20, redFlag: 50 },
};
```

---

## Issue 3: Concurrency Test Flakiness

### Symptom

Concurrency test sometimes passes, sometimes fails:

```
✓ PostgreSQL EXCLUDE constraint prevents double-booking (345ms)
✗ PostgreSQL EXCLUDE constraint prevents double-booking (123ms)
```

### Root Causes

1. **Database isolation level not correct**
2. **Transaction timing issues**
3. **Test cleanup not working**
4. **PostgreSQL EXCLUDE constraint not created**

### Solutions

**Solution 1: Verify EXCLUDE constraint exists**

```sql
-- Check constraint definition
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'no_double_booking';

-- Should return something like:
-- EXCLUDE USING gist (unit_id WITH =, daterange(...) WITH &&)
```

If missing, recreate constraint (see chunk 003):

```sql
ALTER TABLE booking_units
ADD CONSTRAINT no_double_booking
EXCLUDE USING gist (
  unit_id WITH =,
  daterange(check_in_date, check_out_date, '[]') WITH &&
);
```

**Solution 2: Check database isolation level**

```sql
SHOW default_transaction_isolation;

-- Should be 'read committed' or higher
```

**Solution 3: Add cleanup to test**

```typescript
test("PostgreSQL EXCLUDE constraint prevents double-booking", async () => {
  const unitId = `test-unit-${Date.now()}`; // Unique per test run

  // ... test logic

  // Cleanup after test
  await supabase1.from("booking_units").delete().eq("unit_id", unitId);
});
```

**Solution 4: Increase test timeout**

```typescript
test(
  "PostgreSQL EXCLUDE constraint prevents double-booking",
  async () => {
    // ... test
  },
  { timeout: 10000 }
); // 10 seconds
```

---

## Issue 4: Load Test Connection Errors

### Symptom

```
WARN[0002] Request Failed  error="Get \"http://localhost:5173/api/guest-booking\": dial tcp [::1]:5173: connect: connection refused"
```

k6 cannot connect to development server.

### Root Causes

1. **Dev server not running**
2. **Port mismatch**
3. **Firewall blocking connections**
4. **Rate limiting too aggressive**

### Solutions

**Solution 1: Verify server is running**

```bash
# Check if server is listening
lsof -i :5173

# Should show node process
# If not, start server:
npm run dev
```

**Solution 2: Check correct port**

Verify `load-test.js` uses correct port:

```javascript
const response = http.post("http://localhost:5173/api/guest-booking", payload, params);
//                                            ^^^^
//                                            Match server port
```

**Solution 3: Test connection manually**

```bash
# Test API is reachable
curl -X POST http://localhost:5173/api/guest-booking \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Should return response (even if validation error)
```

**Solution 4: Reduce load test concurrency**

Edit `load-test.js` to reduce simultaneous users:

```javascript
export const options = {
  stages: [
    { duration: "1m", target: 2 }, // Reduced from 5
    { duration: "2m", target: 5 }, // Reduced from 10
    { duration: "2m", target: 5 },
    { duration: "1m", target: 0 },
  ],
};
```

---

## Issue 5: Rollback Dry-Run Data Loss

### Symptom

```
✗ zero data loss - all bookings preserved
Expected: > 0
Received: 0
```

Test bookings missing after rollback.

### Root Causes

1. **⚠️ CRITICAL**: Rollback script dropped tables with bookings
2. **Wrong database targeted** (production instead of staging)
3. **Cascade deletion triggered**

### Solutions

**⚠️ STOP IMMEDIATELY - This is a critical issue**

**Solution 1: Restore from backup**

```bash
# Restore staging database from backup
# (Specific command depends on your backup solution)

# Example with Supabase:
# 1. Go to Supabase dashboard
# 2. Project Settings → Backups
# 3. Restore latest backup
```

**Solution 2: Review rollback script**

Check rollback SQL script for dangerous operations:

```sql
-- ❌ BAD: Drops entire table
DROP TABLE bookings CASCADE;

-- ✅ GOOD: Removes only new columns
ALTER TABLE bookings DROP COLUMN IF EXISTS is_multi_unit;
ALTER TABLE bookings DROP COLUMN IF EXISTS requested_unit_count;

-- ✅ GOOD: Drops only new tables (not core tables)
DROP TABLE IF EXISTS guest_booking_unit_requests CASCADE;
DROP TABLE IF EXISTS discount_rules CASCADE;
```

**Solution 3: Verify correct database**

```bash
# Check environment variables
echo $STAGING_SUPABASE_URL
echo $STAGING_SUPABASE_SERVICE_KEY

# Should be staging, NOT production URLs
```

**Solution 4: Test on separate test database first**

Before running on staging, test rollback on completely separate test database:

```bash
# Create test database
createdb rollback_test_db

# Apply migrations
npx supabase db push --db-url postgresql://localhost/rollback_test_db

# Run rollback
npx supabase db reset --db-url postgresql://localhost/rollback_test_db

# Verify data preserved
psql rollback_test_db -c "SELECT COUNT(*) FROM bookings"
```

**Do NOT proceed to production until this is resolved and verified safe.**

---

## Issue 6: Baseline Not Captured

### Symptom

```
Error: No baseline file found. Run baseline capture first.
```

Regression test cannot find baseline file.

### Root Causes

1. **Baseline never captured** (skipped Step 1)
2. **Wrong directory** (baseline in wrong location)
3. **File naming mismatch**

### Solutions

**Solution 1: Capture baseline now**

```bash
# Create baseline directory
mkdir -p performance-baselines

# Run baseline capture
npx tsx tests/performance/baseline-capture.ts

# Verify file created
ls -la performance-baselines/
```

**⚠️ Important**: Baseline should be captured on **pre-implementation system** (single-unit booking) for meaningful comparison. If multi-unit already implemented, baseline will not reflect true regression.

**Solution 2: Verify file location**

```bash
# Check where baseline-capture.ts saves file
grep "filename" tests/performance/baseline-capture.ts

# Should match where regression-test.ts looks for it
grep "baselineDir" tests/performance/regression-test.ts
```

**Solution 3: Manually create baseline (fallback)**

If pre-implementation baseline cannot be captured, manually create reasonable baseline:

```json
{
  "captured_at": "2025-01-23T00:00:00.000Z",
  "system_version": "single-unit-v1",
  "metrics": {
    "booking_creation": {
      "name": "booking_creation",
      "p50": 200,
      "p95": 400,
      "p99": 600,
      "avg": 250,
      "min": 100,
      "max": 800
    },
    "api_response": {
      "name": "api_response",
      "p50": 100,
      "p95": 200,
      "p99": 300,
      "avg": 120,
      "min": 50,
      "max": 400
    }
  },
  "throughput": {
    "requests_per_second": 8.0,
    "concurrent_capacity": 10
  },
  "error_rate": 0.0
}
```

Save as `performance-baselines/baseline-2025-01-23.json`.

---

## Issue 7: E2E Test File Upload Fails

### Symptom

```
Error: ENOENT: no such file or directory, open 'tests/fixtures/images/payment-proof-valid.jpg'
```

Test cannot find payment proof image file.

### Root Causes

1. **Test fixture not created** (missing Step 1 from chunk 015)
2. **Incorrect file path**
3. **File not committed to git** (in .gitignore)

### Solutions

**Solution 1: Create test fixture**

```bash
# Create fixture directory
mkdir -p tests/fixtures/images

# Generate test image (requires ImageMagick)
convert -size 800x600 xc:white \
  -pointsize 40 \
  -draw "text 200,300 'Payment Proof'" \
  tests/fixtures/images/payment-proof-valid.jpg

# Or use existing image
cp ~/Pictures/test-image.jpg tests/fixtures/images/payment-proof-valid.jpg
```

**Solution 2: Verify file path in test**

Check `guest-booking-multi-unit.spec.ts`:

```typescript
await bookingPage.uploadPaymentProof("tests/fixtures/images/payment-proof-valid.jpg");
//                                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                                     Relative to project root
```

**Solution 3: Check .gitignore**

If fixtures are gitignored but needed for testing, either:

1. Remove from .gitignore:

   ```bash
   # Remove this line from .gitignore
   # tests/fixtures/**/*.jpg
   ```

2. Or generate fixtures in CI:
   ```yaml
   # In GitHub Actions workflow
   - name: Generate test fixtures
     run: |
       mkdir -p tests/fixtures/images
       convert -size 800x600 xc:white tests/fixtures/images/payment-proof-valid.jpg
   ```

---

## Issue 8: k6 Not Installed

### Symptom

```
bash: k6: command not found
```

Load test cannot run because k6 not installed.

### Solutions

**macOS (Homebrew)**:

```bash
brew install k6
```

**Linux (Debian/Ubuntu)**:

```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows (Chocolatey)**:

```bash
choco install k6
```

**Verify installation**:

```bash
k6 version
```

---

## Issue 9: Playwright Browser Not Installed

### Symptom

```
Error: browserType.launch: Executable doesn't exist at /path/to/browsers/chromium-1234/chrome-linux/chrome
```

Playwright cannot find browser binaries.

### Solutions

**Solution 1: Install browsers**

```bash
# Install all browsers
npx playwright install

# Or install with system dependencies
npx playwright install --with-deps
```

**Solution 2: Install specific browser**

```bash
# Install only Chromium
npx playwright install chromium
```

**Solution 3: Verify installation**

```bash
# Check installed browsers
npx playwright install --dry-run
```

---

## Issue 10: Test Database Connection Failed

### Symptom

```
Error: Connection refused (ECONNREFUSED)
```

Tests cannot connect to test database.

### Root Causes

1. **Incorrect environment variables**
2. **Database not running**
3. **Firewall blocking connection**

### Solutions

**Solution 1: Verify environment variables**

```bash
# Check .env.test file
cat .env.test

# Should contain:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Solution 2: Test connection manually**

```bash
# Test Supabase connection
curl https://your-project.supabase.co/rest/v1/

# Should return JSON response
```

**Solution 3: Use separate test database**

Create dedicated test project in Supabase for safer testing:

1. Go to Supabase dashboard
2. Create new project: "okaeri-resort-test"
3. Update `.env.test` with test project credentials
4. Run migrations on test database

---

## Still Stuck?

### Debugging Checklist

- [ ] All prerequisites installed (Playwright, k6, Node.js 18+)
- [ ] Dev server running (`npm run dev`)
- [ ] Database accessible (test connection manually)
- [ ] Environment variables correct (`.env.test`)
- [ ] Baseline file exists (`performance-baselines/`)
- [ ] Test fixtures created (`tests/fixtures/`)
- [ ] Previous chunks completed (015)

### Get Help

1. **Review chunk 015** - Ensure all unit and integration tests pass
2. **Check Playwright docs**: https://playwright.dev/docs/intro
3. **Check k6 docs**: https://k6.io/docs/
4. **Review test output** - Read error messages carefully
5. **Enable debug mode**:
   ```bash
   DEBUG=pw:api npx playwright test
   ```

### Escalation

If critical issues persist (especially **rollback data loss**):

1. **STOP** all testing immediately
2. **Document** the issue with screenshots and logs
3. **Escalate** to senior developer or team lead
4. **Do NOT** proceed to production deployment

---

**Chunk**: 016/017
**Last Updated**: 2025-01-23
