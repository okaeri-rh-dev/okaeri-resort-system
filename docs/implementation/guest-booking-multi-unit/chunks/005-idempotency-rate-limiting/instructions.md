# Implementation Instructions: Idempotency and Rate Limiting

**Estimated Time**: 90 minutes

Follow these steps in order. Each step includes verification commands to confirm success before proceeding.

---

## Step 1: Set Up Cloudflare Turnstile (10 minutes)

Turnstile provides bot protection for the guest booking form. We'll create site keys for both development and production.

### 1.1 Access Turnstile Dashboard

```bash
# Open Cloudflare dashboard
# Navigate to: Websites > Select your site > Turnstile
# Or direct URL: https://dash.cloudflare.com/?to=/:account/turnstile
```

### 1.2 Create Turnstile Site

**Click "Add Site" button:**

| Field           | Value                                         |
| --------------- | --------------------------------------------- |
| **Site name**   | `Okaeri Resort - Guest Booking`               |
| **Domain**      | `your-domain.com` (production)                |
| **Widget Mode** | `Managed` (recommended - adaptive challenges) |

**For Development:**

| Field           | Value                                 |
| --------------- | ------------------------------------- |
| **Site name**   | `Okaeri Resort - Guest Booking (Dev)` |
| **Domain**      | `localhost`                           |
| **Widget Mode** | `Managed`                             |

### 1.3 Copy Keys

After creating, you'll see:

- **Site Key** (public) - Used in frontend, safe to commit
- **Secret Key** (private) - Used in API, NEVER commit

**Save these securely:**

```bash
# Add to .env.local (for local development)
VITE_TURNSTILE_SITE_KEY=your_site_key_here
TURNSTILE_SECRET_KEY=your_secret_key_here
```

### 1.4 Add Secret to Cloudflare Workers

```bash
# Set Turnstile secret in Cloudflare Workers
wrangler secret put TURNSTILE_SECRET_KEY
# Paste your secret key when prompted (will not echo)

# Verify secret is set
wrangler secret list
# Expected output should include: TURNSTILE_SECRET_KEY
```

**✅ Verification:**

```bash
# Check that secret exists
wrangler secret list | grep TURNSTILE_SECRET_KEY
# Expected: TURNSTILE_SECRET_KEY appears in list
```

---

## Step 2: Create KV Namespace for Rate Limiting (5 minutes)

Cloudflare KV stores rate limit counters per IP address.

### 2.1 Create KV Namespace

```bash
# Create production KV namespace
wrangler kv:namespace create "RATE_LIMIT"
# Output will show: { binding = "RATE_LIMIT", id = "abc123..." }

# Create preview namespace (for development)
wrangler kv:namespace create "RATE_LIMIT" --preview
# Output: { binding = "RATE_LIMIT", preview_id = "def456..." }
```

**⚠️ IMPORTANT**: Copy the `id` and `preview_id` values - you'll need them in Step 2.2

### 2.2 Update wrangler.toml

Add KV namespace binding to `wrangler.toml`:

```toml
# Add to wrangler.toml after [vars] section

[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "abc123..."              # Replace with your production ID from Step 2.1
preview_id = "def456..."      # Replace with your preview ID from Step 2.1
```

**✅ Verification:**

```bash
# Check wrangler.toml syntax
wrangler whoami
# If no errors, configuration is valid

# List KV namespaces
wrangler kv:namespace list
# Expected: RATE_LIMIT namespace appears
```

---

## Step 3: Implement Turnstile Verification (15 minutes)

Add Turnstile token validation to the guest booking API endpoint.

### 3.1 Create Turnstile Verification Helper

**File**: `functions/lib/verify-turnstile.ts` (NEW)

```typescript
/**
 * Verifies Cloudflare Turnstile token
 * @param token - Token from frontend Turnstile widget
 * @param secret - Turnstile secret key from environment
 * @param ip - Client IP address (optional, for additional validation)
 * @returns Promise<boolean> - true if token valid, false otherwise
 */
export async function verifyTurnstile(
  token: string,
  secret: string,
  ip?: string
): Promise<{ success: boolean; error?: string }> {
  if (!token) {
    return { success: false, error: "Turnstile token missing" };
  }

  if (!secret) {
    console.error("[TURNSTILE] Secret key not configured");
    return { success: false, error: "Server configuration error" };
  }

  try {
    const formData = new FormData();
    formData.append("secret", secret);
    formData.append("response", token);
    if (ip) {
      formData.append("remoteip", ip);
    }

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!result.success) {
      console.warn("[TURNSTILE] Verification failed:", result["error-codes"]);
      return {
        success: false,
        error: `Verification failed: ${result["error-codes"]?.join(", ")}`,
      };
    }

    console.log("[TURNSTILE] Verification successful");
    return { success: true };
  } catch (error) {
    console.error("[TURNSTILE] Verification error:", error);
    return { success: false, error: "Verification service unavailable" };
  }
}
```

### 3.2 Add Turnstile Check to Guest Booking Endpoint

**File**: `functions/api/guest-booking.ts` (MODIFY)

Add import and verification:

```typescript
import { verifyTurnstile } from "../lib/verify-turnstile";

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}) {
  const { request, env } = context;

  // ... existing CORS handling ...

  if (request.method === "POST") {
    try {
      const data = await request.json();

      // **NEW**: Verify Turnstile token
      const turnstileResult = await verifyTurnstile(
        data.turnstile_token,
        env.TURNSTILE_SECRET_KEY,
        request.headers.get("CF-Connecting-IP") || undefined
      );

      if (!turnstileResult.success) {
        return new Response(
          JSON.stringify({
            error: "CAPTCHA verification failed",
            message: turnstileResult.error || "Please complete the security challenge",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // ... rest of booking creation logic ...
    }
  }
}
```

**✅ Verification:**

```bash
# Test Turnstile validation (should fail without token)
curl -X POST https://your-domain.com/api/guest-booking \
  -H "Content-Type: application/json" \
  -d '{"guest_name": "Test", "turnstile_token": "invalid"}'

# Expected: 403 Forbidden with "CAPTCHA verification failed" message
```

---

## Step 4: Implement Rate Limiting with KV (20 minutes)

Prevent abuse by limiting booking submissions to 5 per hour per IP address.

### 4.1 Create Rate Limiting Helper

**File**: `functions/lib/check-rate-limit.ts` (NEW)

```typescript
interface RateLimitResult {
  allowed: boolean;
  remaining?: number;
  resetAt?: number;
}

/**
 * Checks rate limit using Cloudflare KV
 * @param kv - KV namespace binding from environment
 * @param ip - Client IP address
 * @param limit - Maximum requests per hour (default: 5)
 * @returns RateLimitResult - allowed status and metadata
 */
export async function checkRateLimit(
  kv: KVNamespace,
  ip: string,
  limit: number = 5
): Promise<RateLimitResult> {
  // Create hourly bucket key
  const hourBucket = Math.floor(Date.now() / 3600000); // Rounds to current hour
  const key = `ratelimit:${ip}:${hourBucket}`;

  try {
    // Get current count from KV
    const currentCount = parseInt((await kv.get(key)) || "0", 10);

    if (currentCount >= limit) {
      // Rate limit exceeded
      const resetAt = (hourBucket + 1) * 3600000; // Next hour boundary
      console.warn(`[RATE_LIMIT] IP ${ip} exceeded limit (${currentCount}/${limit})`);
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    // Increment counter
    const newCount = currentCount + 1;
    // TTL: expire at end of current hour + 1 hour buffer
    const ttl = Math.ceil((3600000 - (Date.now() % 3600000)) / 1000) + 3600;

    await kv.put(key, newCount.toString(), { expirationTtl: ttl });

    console.log(`[RATE_LIMIT] IP ${ip} request ${newCount}/${limit}`);
    return {
      allowed: true,
      remaining: limit - newCount,
      resetAt: (hourBucket + 1) * 3600000,
    };
  } catch (error) {
    console.error("[RATE_LIMIT] KV error:", error);
    // Fail open - allow request if rate limit check fails
    // This prevents rate limit system failure from blocking legitimate users
    return { allowed: true };
  }
}
```

### 4.2 Add Rate Limiting to Guest Booking Endpoint

**File**: `functions/api/guest-booking.ts` (MODIFY)

Add import and rate limit check:

```typescript
import { checkRateLimit } from "../lib/check-rate-limit";

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: Record<string, string>;
}) {
  const { request, env } = context;

  if (request.method === "POST") {
    try {
      // Get client IP
      const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";

      // **NEW**: Check rate limit (BEFORE Turnstile to prevent wasting tokens)
      const rateLimitResult = await checkRateLimit(env.RATE_LIMIT, clientIP, 5);

      if (!rateLimitResult.allowed) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded",
            message: "Too many booking attempts. Please try again later.",
            resetAt: rateLimitResult.resetAt,
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Retry-After": "3600", // 1 hour in seconds
            },
          }
        );
      }

      // ... Continue with Turnstile verification and booking creation ...
    }
  }
}
```

**✅ Verification:**

```bash
# Test rate limiting (make 6 rapid requests)
for i in {1..6}; do
  echo "Request $i:"
  curl -X POST https://your-domain.com/api/guest-booking \
    -H "Content-Type: application/json" \
    -d '{"test": "rate_limit"}'
  echo "\n---"
done

# Expected:
# Requests 1-5: Process normally (might fail on other validation)
# Request 6: 429 Rate limit exceeded
```

---

## Step 5: Create Idempotency Cleanup Cron Worker (15 minutes)

Daily cron job to delete expired idempotency keys (>48 hours old).

### 5.1 Create PostgreSQL Cleanup Function

**File**: Add to existing migration or run directly in database

```sql
-- Function to cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete keys where expires_at is in the past
  DELETE FROM idempotency_keys
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Cleaned up % expired idempotency keys', deleted_count;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_idempotency_keys IS
  'Deletes expired idempotency keys (called daily by cron worker)';
```

**Run migration:**

```bash
# Apply function to database
psql $DATABASE_URL -c "$(cat path/to/cleanup-function.sql)"

# Test function manually
psql $DATABASE_URL -c "SELECT cleanup_expired_idempotency_keys();"
# Expected: Returns count of deleted keys (may be 0 if none expired)
```

### 5.2 Create Idempotency Cleanup Worker

**File**: `functions/scheduled/cleanup-idempotency.ts` (NEW)

```typescript
import { createClient } from "@supabase/supabase-js";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

/**
 * Cleanup expired idempotency keys (daily cron: 2 AM UTC)
 * Deletes keys where expires_at < NOW()
 * Retention: 48 hours from creation
 */
export async function cleanupIdempotency(env: Env): Promise<void> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 60000; // 1 minute

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

      // Call PostgreSQL cleanup function
      const { data, error } = await supabase.rpc("cleanup_expired_idempotency_keys");

      if (error) throw error;

      const deletedCount = data || 0;

      // Alert if unusual cleanup volume
      // >1000 keys suggests potential issue (double-booking attempts or system problem)
      if (deletedCount > 1000) {
        console.warn(
          `[ALERT] High idempotency key cleanup: ${deletedCount} keys deleted. ` +
            `Investigate for possible double-booking attempts or system issues.`
        );
      }

      console.log(`[CRON] Idempotency cleanup: ${deletedCount} expired keys removed`);
      return; // Success - exit retry loop
    } catch (error) {
      console.error(
        `[ERROR] Idempotency cleanup failed (attempt ${attempt}/${MAX_RETRIES}):`,
        error
      );

      if (attempt === MAX_RETRIES) {
        // Final failure - log critical error for admin investigation
        console.error(
          `[CRITICAL] Idempotency cleanup failed after all retries. ` +
            `Check: database connectivity, permissions, function exists`
        );
        throw error;
      }

      // Wait before retry with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
}
```

### 5.3 Create Payment Proof Cleanup Worker

**File**: `functions/scheduled/cleanup-payment-proofs.ts` (NEW)

First, create the PostgreSQL function:

```sql
-- Function to cleanup expired payment proofs from storage
CREATE OR REPLACE FUNCTION cleanup_expired_payment_proofs()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_deleted_count INTEGER := 0;
  v_storage_freed_bytes BIGINT := 0;
  v_booking RECORD;
  v_file_path TEXT;
BEGIN
  -- Find bookings with expired payment proofs
  -- Retention rules:
  -- 1. Completed bookings: 90 days after check-out
  -- 2. Cancelled bookings: 30 days after cancellation
  FOR v_booking IN
    SELECT
      booking_id,
      payment_proof_url,
      booking_status,
      check_out_date,
      updated_at
    FROM bookings
    WHERE payment_proof_url IS NOT NULL
      AND (
        -- Completed: 90 days after check-out
        (booking_status = 'Completed' AND check_out_date < NOW() - INTERVAL '90 days')
        OR
        -- Cancelled: 30 days after cancellation
        (booking_status = 'Cancelled' AND updated_at < NOW() - INTERVAL '30 days')
      )
  LOOP
    -- Extract file path from URL
    -- Assumes format: https://.../storage/v1/object/public/payment-proofs/path/to/file.jpg
    v_file_path := regexp_replace(v_booking.payment_proof_url, '.*payment-proofs/', '');

    -- Note: Actual file deletion would be done via Supabase Storage API
    -- This function only tracks which files should be deleted
    -- The Worker will handle actual deletion

    -- Clear payment_proof_url from booking
    UPDATE bookings
    SET payment_proof_url = NULL
    WHERE booking_id = v_booking.booking_id;

    v_deleted_count := v_deleted_count + 1;
    -- Approximate storage freed (actual size would need Storage API query)
    v_storage_freed_bytes := v_storage_freed_bytes + 2097152; -- Assume ~2MB per file
  END LOOP;

  v_result := jsonb_build_object(
    'deleted_count', v_deleted_count,
    'storage_freed_bytes', v_storage_freed_bytes
  );

  RAISE NOTICE 'Cleaned up % expired payment proofs', v_deleted_count;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_payment_proofs IS
  'Marks expired payment proofs for deletion (90 days post-checkout or 30 days post-cancellation)';
```

Then create the Worker:

```typescript
import { createClient } from "@supabase/supabase-js";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

/**
 * Cleanup expired payment proofs (weekly cron: Sunday 3 AM UTC)
 * Deletes files from storage for:
 * - Completed bookings: 90 days after check-out
 * - Cancelled bookings: 30 days after cancellation
 */
export async function cleanupPaymentProofs(env: Env): Promise<void> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 60000; // 1 minute

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

      // Call PostgreSQL cleanup function
      const { data, error } = await supabase.rpc("cleanup_expired_payment_proofs");

      if (error) throw error;

      const { deleted_count, storage_freed_bytes } = data || {
        deleted_count: 0,
        storage_freed_bytes: 0,
      };

      // Alert if unusual cleanup volume
      // >50 deletions per week suggests bulk cancellations or data issues
      if (deleted_count > 50) {
        console.warn(
          `[ALERT] High payment proof cleanup: ${deleted_count} files deleted. ` +
            `Verify: retention policy changes, bulk cancellations, or data issues.`
        );
      }

      console.log(
        `[CRON] Payment proof cleanup: ${deleted_count} files deleted, ` +
          `${(storage_freed_bytes / 1024 / 1024).toFixed(2)} MB freed`
      );
      return; // Success - exit retry loop
    } catch (error) {
      console.error(
        `[ERROR] Payment proof cleanup failed (attempt ${attempt}/${MAX_RETRIES}):`,
        error
      );

      if (attempt === MAX_RETRIES) {
        console.error(
          `[CRITICAL] Payment proof cleanup failed after all retries. ` +
            `Check: database connectivity, storage permissions, function exists`
        );
        throw error;
      }

      // Wait before retry with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }
}
```

---

## Step 6: Configure Cron Triggers in wrangler.toml (5 minutes)

### 6.1 Update Main Worker to Handle Cron Events

**File**: `functions/_worker.ts` (MODIFY)

Add cron event handler and imports:

```typescript
import { cleanupIdempotency } from "./scheduled/cleanup-idempotency";
import { cleanupPaymentProofs } from "./scheduled/cleanup-payment-proofs";

interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  RATE_LIMIT: KVNamespace;
}

export default {
  // **NEW**: Handle scheduled events
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log(`[CRON] Starting scheduled task: ${event.cron}`);

    try {
      switch (event.cron) {
        case "0 2 * * *":
          // Daily at 2 AM UTC: Cleanup idempotency keys
          await cleanupIdempotency(env);
          break;

        case "0 3 * * 0":
          // Weekly Sunday at 3 AM UTC: Cleanup payment proofs
          await cleanupPaymentProofs(env);
          break;

        default:
          console.warn(`[WARN] Unknown cron schedule: ${event.cron}`);
      }

      console.log(`[CRON] Completed: ${event.cron}`);
    } catch (error) {
      console.error(`[CRON ERROR] Failed: ${event.cron}`, error);
      // TODO: Send alert to admin (email/SMS)
    }
  },

  // ... existing fetch handler ...
};
```

### 6.2 Add Cron Triggers to wrangler.toml

**File**: `wrangler.toml` (MODIFY)

Add cron configuration:

```toml
# ... existing configuration ...

# Cron triggers (free tier: 3/day, using 2/3)
[triggers]
crons = [
  "0 2 * * *",   # Daily: Cleanup idempotency keys (2:00 AM UTC)
  "0 3 * * 0"    # Weekly: Cleanup payment proofs (Sunday 3:00 AM UTC)
]
```

**Cron Schedule Explanation:**

| Schedule    | Frequency       | Time (UTC) | Purpose                         |
| ----------- | --------------- | ---------- | ------------------------------- |
| `0 2 * * *` | Daily           | 2:00 AM    | Delete expired idempotency keys |
| `0 3 * * 0` | Weekly (Sunday) | 3:00 AM    | Delete old payment proofs       |

**✅ Verification:**

```bash
# Validate wrangler.toml syntax
wrangler whoami
# Expected: No errors (if errors, check TOML syntax)
```

---

## Step 7: Deploy and Test (10 minutes)

### 7.1 Deploy All Changes

```bash
# Deploy Workers with cron triggers
wrangler deploy

# Verify deployment
wrangler deployments list
# Expected: New deployment with timestamp
```

### 7.2 Verify Cron Triggers Registered

```bash
# View scheduled triggers in Cloudflare dashboard
# Navigate to: Workers & Pages > Your Worker > Triggers > Cron Triggers
# Expected: 2 cron triggers listed (2 AM daily, 3 AM Sunday)

# Or check via wrangler
wrangler tail --format json
# Wait for next scheduled execution (may need to wait up to 24 hours)
```

### 7.3 Test Idempotency

Create a test script to verify duplicate prevention:

**File**: `test-idempotency.sh` (temporary test file)

```bash
#!/bin/bash

# Generate UUID for idempotency key
IDEMPOTENCY_KEY=$(uuidgen)

echo "Testing idempotency with key: $IDEMPOTENCY_KEY"
echo "---"

# First request (should create booking)
echo "Request 1 (should succeed):"
RESPONSE1=$(curl -s -X POST https://your-domain.com/api/guest-booking \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "guest_name": "Idempotency Test",
    "email": "test@example.com",
    "phone_number": "+1234567890",
    "check_in": "2025-03-01T14:00:00Z",
    "check_out": "2025-03-08T11:00:00Z",
    "unit_requests": [{"guests_per_unit": 2}],
    "turnstile_token": "test-token",
    "terms_accepted": true
  }')

echo "$RESPONSE1" | jq '.'
echo "---"

# Second request with SAME key (should return existing booking)
echo "Request 2 (should return same booking):"
RESPONSE2=$(curl -s -X POST https://your-domain.com/api/guest-booking \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "guest_name": "Different Name",
    "email": "different@example.com",
    "check_in": "2025-04-01T14:00:00Z",
    "unit_requests": [{"guests_per_unit": 5}],
    "turnstile_token": "test-token",
    "terms_accepted": true
  }')

echo "$RESPONSE2" | jq '.'
echo "---"

# Compare booking IDs (should be identical)
BOOKING_ID_1=$(echo "$RESPONSE1" | jq -r '.booking.booking_id')
BOOKING_ID_2=$(echo "$RESPONSE2" | jq -r '.booking.booking_id')

if [ "$BOOKING_ID_1" == "$BOOKING_ID_2" ]; then
  echo "✅ PASS: Idempotency working - same booking returned"
else
  echo "❌ FAIL: Idempotency broken - different bookings created"
fi
```

**Run test:**

```bash
chmod +x test-idempotency.sh
./test-idempotency.sh

# Expected output:
# Request 1: Booking created (or may fail on Turnstile)
# Request 2: Same booking returned (is_duplicate: true)
# ✅ PASS: Idempotency working
```

### 7.4 Test Rate Limiting

```bash
# Make 6 rapid requests from same IP
for i in {1..6}; do
  echo "Request $i:"
  curl -s -X POST https://your-domain.com/api/guest-booking \
    -H "Content-Type: application/json" \
    -d '{"test": "rate_limit"}' \
    | jq '.error // "Success"'
done

# Expected:
# Requests 1-5: May fail on other validation (Turnstile, etc.)
# Request 6: "Rate limit exceeded"
```

### 7.5 Manually Trigger Cron (Optional)

For immediate testing without waiting 24 hours:

```bash
# Trigger cron via Cloudflare dashboard
# Navigate to: Workers & Pages > Your Worker > Triggers > Cron Triggers
# Click "Run Cron Trigger" button next to each schedule

# Or use wrangler tail to see cron execution
wrangler tail --format json | grep CRON
# Wait for scheduled execution time
```

---

## Step 8: Frontend Integration (5 minutes)

Add UUID generation to the guest booking form (Chunk 006 will complete this, but set up now).

### 8.1 Client-Side UUID Generation

**File**: `src/lib/api/guest-booking-client.ts` (CREATE or MODIFY)

```typescript
/**
 * Generates idempotency key for booking submission
 * Stored in sessionStorage to survive page refreshes
 */
export function getOrCreateIdempotencyKey(): string {
  const storageKey = "booking_idempotency_key";

  // Check if key exists in sessionStorage
  let key = sessionStorage.getItem(storageKey);

  if (!key) {
    // Generate new UUID
    key = crypto.randomUUID();
    sessionStorage.setItem(storageKey, key);
  }

  return key;
}

/**
 * Clears idempotency key after successful booking
 */
export function clearIdempotencyKey(): void {
  sessionStorage.removeItem("booking_idempotency_key");
}

/**
 * Submits guest booking with idempotency protection
 */
export async function submitGuestBooking(bookingData: GuestBookingRequest) {
  const idempotencyKey = getOrCreateIdempotencyKey();

  const response = await fetch("/api/guest-booking", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      ...bookingData,
      idempotency_key: idempotencyKey, // Also in body for PostgreSQL function
    }),
  });

  if (response.ok) {
    // Clear key after successful submission
    clearIdempotencyKey();
  }

  return response.json();
}
```

**✅ Verification:**

```bash
# Test UUID generation in browser console
# Open: http://localhost:5173 (or your dev server)
# Console:
crypto.randomUUID();
// Expected: Valid UUID (e.g., "550e8400-e29b-41d4-a716-446655440000")
```

---

## Done! ✅

You've successfully implemented:

- ✅ **Idempotency system** - Prevents duplicate bookings
- ✅ **Turnstile CAPTCHA** - Blocks bots from submitting bookings
- ✅ **Rate limiting** - Prevents abuse (5 requests/hour)
- ✅ **Automated cleanup** - Daily/weekly cron jobs maintain free tier compliance

### Next Steps

1. **Verify all checks in `checkpoint.md`** - Ensure everything is working
2. **Commit your changes**:

```bash
git add functions/ wrangler.toml src/
git commit -m "feat: complete chunk 005-idempotency-rate-limiting

- Add Turnstile CAPTCHA verification
- Implement KV-based rate limiting (5 req/hour)
- Create cron workers for cleanup (daily/weekly)
- Add client-side UUID generation
- Configure wrangler.toml with cron triggers

Phase 1 backend complete (chunks 001-005)."
```

3. **Tag milestone**:

```bash
git tag chunk-005
git push origin main --tags
```

4. **Proceed to Chunk 006**: Date and Unit Selection UI (Phase 2 begins!)

### Troubleshooting

If you encounter issues, see `troubleshooting.md` for common problems and solutions.
