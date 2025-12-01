# Phase 1: Backend Implementation

> **Database function and API endpoint for public availability data**

**Estimated Time**: 2 days (16 hours)
**Prerequisites**: Supabase access, Cloudflare Workers deployment access
**Deliverables**: Functional API endpoint returning availability data

---

## Overview

Phase 1 builds the backend infrastructure for the public availability calendar. This includes:

0. **Infrastructure Setup**: Cloudflare KV namespaces and optional Turnstile configuration
1. **Database Function**: `get_public_aggregate_availability()` - Aggregates booking + blackout data safely with multi-unit support
2. **API Endpoint**: `/api/public/v1/availability` - Public HTTP interface with strict date validation
3. **Caching Strategy**: CDN headers with 5-minute TTL (no Realtime updates)
4. **Rate Limiting**: DDoS protection and cost control (free tier safe)
5. **Middleware Integration**: Reuses existing patterns from `guest-booking.ts`
6. **Type Generation**: Post-migration workflow for database types
7. **Timezone Handling**: Asia/Manila (UTC+8) date normalization
8. **Testing**: Comprehensive API testing

`★ Insight ─────────────────────────────────────`
**SECURITY DEFINER is critical**: Anonymous users can't query the bookings table due to RLS policies, but we need to expose aggregated availability. SECURITY DEFINER lets the function run with owner privileges while only returning safe, aggregated data.

**IMPORTANT**: This endpoint exposes ONLY availability counts. NO pricing, NO guest information, NO booking details. This is a VIEW-ONLY calendar supporting a manager-mediated booking process.
`─────────────────────────────────────────────────`

---

## Step 0: Infrastructure Prerequisites

Before creating the database function and API endpoint, ensure the following infrastructure is set up:

### 0.1 Cloudflare KV Namespaces

The public availability API uses KV namespaces for rate limiting and IP blocking. These should already exist from the guest booking system, but verify they're configured:

**Required KV Namespaces**:

1. `RATE_LIMIT_KV` - Stores rate limit counters per IP address
2. `BLOCKED_IPS_KV` - Stores blocked IPs for DDoS protection

**Setup Instructions**:

```bash
# List existing KV namespaces
npx wrangler kv:namespace list

# If missing, create them
npx wrangler kv:namespace create "RATE_LIMIT_KV"
npx wrangler kv:namespace create "BLOCKED_IPS_KV"
```

**Bind to Worker** (add to `wrangler.toml` if not already present):

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-rate-limit-kv-id"
preview_id = "your-rate-limit-preview-id"

[[kv_namespaces]]
binding = "BLOCKED_IPS_KV"
id = "your-blocked-ips-kv-id"
preview_id = "your-blocked-ips-preview-id"
```

**Verify Bindings**:

```bash
# Check wrangler.toml includes KV namespaces
cat wrangler.toml | grep -A 2 "kv_namespaces"
```

### 0.2 Cloudflare Turnstile (Optional but Recommended)

Turnstile provides bot protection for public endpoints. For the availability calendar, use **invisible mode** to avoid user friction.

**Setup Steps**:

1. **Create Turnstile Site**:
   - Go to Cloudflare Dashboard → Turnstile
   - Click "Add Site"
   - **Site name**: "Okaeri Public Calendar"
   - **Domain**: `okaeri-resort.com`
   - **Widget type**: **Invisible** (no CAPTCHA challenge)
   - Click "Create"

2. **Get API Keys**:
   - Copy **Site Key** (for frontend)
   - Copy **Secret Key** (for backend verification)

3. **Add to Environment Variables**:

```bash
# Add to .env.local (development)
TURNSTILE_SITE_KEY=your_site_key_here
TURNSTILE_SECRET_KEY=your_secret_key_here

# Add to Cloudflare Workers secrets (production)
npx wrangler secret put TURNSTILE_SECRET_KEY
# Paste your secret key when prompted
```

4. **Add to `wrangler.toml`** (non-secret site key):

```toml
[vars]
TURNSTILE_SITE_KEY = "your_site_key_here"
```

**Verification**:

```bash
# Verify secret is set
npx wrangler secret list
# Should show: TURNSTILE_SECRET_KEY
```

**Note**: Turnstile (invisible mode) is **recommended** for consistency with the `/api/guest-booking` endpoint. The rate limiting in Step 4 provides basic DDoS protection, but Turnstile adds an additional security layer without user friction.

### 0.3 Environment Variables Checklist

Verify all required environment variables are set:

```bash
# Required (should already exist from main system)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Optional (for Turnstile bot protection)
TURNSTILE_SECRET_KEY=your_turnstile_secret
TURNSTILE_SITE_KEY=your_turnstile_site_key
```

**Verification Command**:

```bash
# Check local environment
cat .env.local | grep -E "(SUPABASE|TURNSTILE)"

# Check Cloudflare Workers secrets
npx wrangler secret list
```

---

## Step 1: Database Function Creation

### 1.1 Connect to Supabase SQL Editor

1. Navigate to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `okaeri-resort`
3. Click **SQL Editor** in left sidebar
4. Click **New Query**

### 1.2 Create the Function

Copy and execute this SQL:

```sql
-- ============================================================================
-- PUBLIC AVAILABILITY FUNCTION (Option C Hybrid Model)
-- Safely exposes aggregated availability counts without revealing guest data
-- VIEW-ONLY: No pricing, no guest info, no booking details
-- Supports manager-mediated booking flow (guest contacts manager after viewing)
--
-- UNIT STATUS MODEL:
-- - units.unit_status: Static per unit ('Available', 'Maintenance', 'Retired')
-- - availability_blackouts: Date-specific unavailability per unit
-- - Formula: total_available_units - (booked_units + blackout_units)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_public_aggregate_availability(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  date DATE,
  available_count INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_total_units INT;
  v_today DATE := CURRENT_DATE;
  v_max_future_date DATE := v_today + INTERVAL '1 year';
BEGIN
  -- Validate input dates
  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'Start and end dates are required';
  END IF;

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'End date must be after or equal to start date';
  END IF;

  -- Prevent querying past dates (guests can't book the past)
  IF p_start_date < v_today THEN
    RAISE EXCEPTION 'Cannot query past dates. Start date must be today or later.';
  END IF;

  -- Limit future queries to 1 year ahead (prevents abuse and irrelevant far-future queries)
  IF p_end_date > v_max_future_date THEN
    RAISE EXCEPTION 'Cannot query more than 1 year in the future';
  END IF;

  -- Limit date range to 180 days to prevent abuse
  IF (p_end_date - p_start_date) > 180 THEN
    RAISE EXCEPTION 'Date range cannot exceed 180 days';
  END IF;

  -- Query total available units dynamically (not hardcoded)
  -- Only count units with status='Available' (excludes Maintenance/Retired)
  SELECT COUNT(*) INTO v_total_units
  FROM units
  WHERE unit_status = 'Available';

  -- If no units are available at all, return all zeros
  IF v_total_units = 0 THEN
    RETURN QUERY
    SELECT
      generate_series(p_start_date, p_end_date, '1 day'::interval)::date as date,
      0 as available_count;
    RETURN;
  END IF;

  RETURN QUERY
  WITH date_series AS (
    -- Generate all dates in the requested range
    SELECT generate_series(
      p_start_date,
      p_end_date,
      '1 day'::interval
    )::date as date
  ),
  occupied_per_day AS (
    -- Count booked units per day (only from Available units)
    -- Supports BOTH single-unit bookings (bookings.unit_id) AND multi-unit bookings (booking_units table)
    SELECT
      ds.date,
      COUNT(DISTINCT booked_unit_id) as booked_count
    FROM date_series ds
    LEFT JOIN (
      -- UNION of single-unit and multi-unit booking patterns
      -- This makes the function compatible with the multi-unit booking feature
      SELECT
        b.booking_id,
        b.unit_id as booked_unit_id,
        b.booking_status,
        b.check_in,
        b.check_out
      FROM bookings b
      WHERE b.unit_id IS NOT NULL  -- Single-unit bookings (current pattern)

      UNION ALL

      SELECT
        bu.booking_id,
        bu.unit_id as booked_unit_id,
        b.booking_status,
        b.check_in,
        b.check_out
      FROM booking_units bu
      JOIN bookings b ON bu.booking_id = b.booking_id
      WHERE bu.unit_id IS NOT NULL  -- Multi-unit bookings (future pattern)
    ) booked_units ON (
      booked_units.booked_unit_id IN (SELECT unit_id FROM units WHERE unit_status = 'Available')
      AND booked_units.booking_status IN ('Confirmed', 'CheckedIn', 'Hold')
      -- Hold status counts as occupied to prevent overbooking
      -- Guest occupies unit from check-in (inclusive) to check-out (exclusive)
      AND ds.date >= booked_units.check_in::date
      AND ds.date < booked_units.check_out::date  -- Checkout day is available
    )
    GROUP BY ds.date
  ),
  blackout_per_day AS (
    -- Count blackout units per day (only from Available units)
    SELECT
      ds.date,
      COUNT(DISTINCT ab.unit_id) as blackout_count
    FROM date_series ds
    LEFT JOIN availability_blackouts ab ON (
      ab.unit_id IN (SELECT unit_id FROM units WHERE unit_status = 'Available')
      AND ds.date >= ab.start_date::date
      AND ds.date < ab.end_date::date
    )
    GROUP BY ds.date
  )
  SELECT
    opd.date,
    -- Calculate available units: total - booked - blackouts (never negative)
    GREATEST(
      0,
      v_total_units - COALESCE(opd.booked_count, 0) - COALESCE(bpd.blackout_count, 0)
    ) as available_count
  FROM occupied_per_day opd
  JOIN blackout_per_day bpd ON opd.date = bpd.date
  ORDER BY opd.date;
END;
$$;

-- ============================================================================
-- GRANT PUBLIC ACCESS
-- ============================================================================
-- Allow anonymous (unauthenticated) users to execute this function
GRANT EXECUTE ON FUNCTION get_public_aggregate_availability(DATE, DATE) TO anon;

-- ============================================================================
-- ADD FUNCTION COMMENT
-- ============================================================================
COMMENT ON FUNCTION get_public_aggregate_availability(DATE, DATE) IS
  'Returns aggregated availability counts for public calendar (bookings + blackouts). ' ||
  'Uses Option C hybrid model: static unit_status + date-specific blackouts. ' ||
  'SECURITY DEFINER bypasses RLS to safely expose availability without revealing guest data.';
```

### 1.3 Generate TypeScript Types

After creating the function, regenerate database types:

```bash
# From project root
npx supabase gen types typescript --local > src/types/database.types.ts

# Or if using hosted Supabase:
npx supabase gen types typescript --project-id your-project-ref > src/types/database.types.ts
```

**Verify the function appears in generated types**:

```typescript
// src/types/database.types.ts should now include:
export type Database = {
  public: {
    Functions: {
      get_public_aggregate_availability: {
        Args: {
          p_start_date: string;
          p_end_date: string;
        };
        Returns: Array<{
          date: string;
          available_count: number;
        }>;
      };
    };
  };
};
```

### 1.4 Verify Function Creation

Run this test query:

```sql
-- Test for current month
SELECT * FROM get_public_aggregate_availability(
  DATE_TRUNC('month', CURRENT_DATE)::date,
  (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date
);
```

**Expected Output**:

```
date         | available_count
-------------+----------------
2025-01-01   | 3
2025-01-02   | 3
2025-01-15   | 2
2025-01-20   | 0
...
```

### 1.5 Verify Required Index Exists

Check if the required index exists:

```sql
-- Verify booking index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'bookings'
  AND indexname = 'idx_bookings_status_dates';

-- If missing, create it:
CREATE INDEX IF NOT EXISTS idx_bookings_status_dates
  ON bookings (booking_status, check_in, check_out)
  WHERE booking_status IN ('Confirmed', 'CheckedIn');
```

### 1.6 Performance Testing

Check query performance with EXPLAIN ANALYZE:

```sql
EXPLAIN ANALYZE
SELECT * FROM get_public_aggregate_availability('2025-01-01', '2025-01-31');
```

**Performance Targets** (Free Tier Safe):

- **Execution time**: < 100ms for 31-day range
- **Planning time**: < 5ms
- **Rows returned**: Equal to days in range
- **Expected traffic**: 500 views/month = ~10 DB queries/day (cached)
- **Connection pool**: Well below 60 concurrent connection limit

**Optimization Notes**:

- Function uses `idx_bookings_status_dates` index for booking lookups
- `STABLE` keyword allows query planner to cache results during transaction
- `LEFT JOIN` ensures all dates appear even if no bookings/blackouts exist
- Dynamic unit count query runs once per function call (fast lookup)

---

## Step 2: API Endpoint Creation

### 2.1 Create Endpoint File

Create `/functions/api/public/v1/availability.ts`:

```typescript
/**
 * Public Availability Calendar API Endpoint
 *
 * Returns aggregated availability counts for Okaeri Resort's 3 units.
 * This is a public, unauthenticated endpoint with aggressive caching.
 *
 * VIEW-ONLY: No pricing information, no guest data, no booking details.
 * Supports manager-mediated booking (guest contacts manager after viewing).
 *
 * @endpoint GET /api/public/v1/availability
 * @query start - Start date (ISO 8601, YYYY-MM-DD)
 * @query end - End date (ISO 8601, YYYY-MM-DD)
 * @returns JSON with availability data
 */

import { createClient } from "@supabase/supabase-js";

interface Env {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  ENVIRONMENT: "production" | "development";
}

interface AvailabilityDay {
  date: string;
  available_count: number;
}

type AvailabilityStatus = "full" | "moderate" | "limited" | "booked";

export async function onRequest(context: {
  request: Request;
  env: Env;
  waitUntil: (promise: Promise<any>) => void;
}) {
  const { request, env, waitUntil } = context;

  // CORS headers for public access
  // Use specific origins instead of wildcard for better security
  // Specific origins only (no wildcard) for better security
  const allowedOrigins = [
    "https://okaeri-resort.com",
    "https://www.okaeri-resort.com",
    env.ENVIRONMENT === "development" ? "http://localhost:5173" : null,
  ].filter(Boolean) as string[];

  const origin = request.headers.get("Origin");
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  const corsHeaders = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "false",
  };

  // Handle preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  // Only allow GET requests
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Parse query parameters
    const url = new URL(request.url);
    const startParam = url.searchParams.get("start");
    const endParam = url.searchParams.get("end");

    // Default to current month if no parameters provided
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const startDate = startParam || defaultStart.toISOString().split("T")[0];
    const endDate = endParam || defaultEnd.toISOString().split("T")[0];

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return new Response(
        JSON.stringify({
          error: "Invalid date format. Use YYYY-MM-DD (ISO 8601)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return new Response(JSON.stringify({ error: "Invalid date values" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (end < start) {
      return new Response(
        JSON.stringify({ error: "End date must be after or equal to start date" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prevent querying past dates (guests can't book the past)
    if (start < today) {
      return new Response(
        JSON.stringify({
          error: "Cannot query past dates. Start date must be today or later.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Limit future queries to 1 year ahead
    const oneYearFromNow = new Date(today);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    if (end > oneYearFromNow) {
      return new Response(
        JSON.stringify({ error: "Cannot query more than 1 year in the future" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Limit range to 180 days
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 180) {
      return new Response(JSON.stringify({ error: "Date range cannot exceed 180 days" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with anon key (public access)
    const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

    // Call database function (renamed to clarify aggregate nature)
    const { data, error } = await supabase.rpc("get_public_aggregate_availability", {
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) {
      console.error("[Availability API] Database error:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch availability data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transform database response to API format
    const availability = (data as AvailabilityDay[]).map((day) => ({
      date: day.date,
      availableCount: day.available_count,
      status: getAvailabilityStatus(day.available_count),
    }));

    // Build API response
    const response = {
      totalUnits: 3,
      dateRange: {
        start: startDate,
        end: endDate,
      },
      availability,
      metadata: {
        generatedAt: new Date().toISOString(),
        cacheMaxAge: 300, // 5 minutes in seconds
        version: "v1",
      },
    };

    // Generate ETag for cache validation
    const etag = `"availability-${startDate}-${endDate}-${Date.now()}"`;

    // Return successful response with aggressive caching
    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        // CDN caching: 5 minutes fresh, 2 minutes stale-while-revalidate
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120",
        ETag: etag,
        // Vary header ensures proper caching by query params
        Vary: "Accept-Encoding",
      },
      status: 200,
    });
  } catch (error) {
    console.error("[Availability API] Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

/**
 * Map available count to status string
 */
function getAvailabilityStatus(count: number): AvailabilityStatus {
  if (count === 3) return "full"; // All 3 units available
  if (count === 2) return "moderate"; // 2 units available
  if (count === 1) return "limited"; // Only 1 unit available
  return "booked"; // Fully booked (0 available)
}
```

### 2.2 Add TypeScript Types (Optional but Recommended)

Create `/functions/api/public/v1/availability.types.ts`:

```typescript
export interface AvailabilityRequest {
  start?: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD
}

export interface AvailabilityDay {
  date: string;
  availableCount: number;
  status: "full" | "moderate" | "limited" | "booked";
}

export interface AvailabilityResponse {
  totalUnits: number;
  dateRange: {
    start: string;
    end: string;
  };
  availability: AvailabilityDay[];
  metadata: {
    generatedAt: string;
    cacheMaxAge: number;
    version: string;
  };
}

export interface ErrorResponse {
  error: string;
}
```

---

## Step 2.3: Add Turnstile Bot Protection (Optional but Recommended)

To match security patterns with other public endpoints (like `guest-booking.ts`), add Turnstile invisible mode:

```typescript
// Add to onRequest function, after CORS check

// Import Turnstile verification
import { verifyTurnstile } from "@/lib/turnstile";

// In onRequest, before calling database:
const turnstileToken = url.searchParams.get("cf_turnstile_token");

if (turnstileToken) {
  const isValid = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY, {
    remoteip: request.headers.get("cf-connecting-ip"),
    expectedAction: "view-availability",
  });

  if (!isValid) {
    return new Response(JSON.stringify({ error: "Bot verification failed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
```

**Note**: Turnstile is **optional for view-only calendar** but recommended for consistency with other public endpoints. Use invisible mode to avoid user friction.

### 2.4 Middleware Integration Notes

This endpoint integrates with existing middleware patterns:

**Reuse from `functions/api/guest-booking.ts`**:

- CORS header patterns (lines 52-69 in guest-booking.ts)
- Rate limiting with KV (lines 86-108)
- Turnstile verification (lines 150-168)

**Reuse from `functions/_middleware.ts`**:

- Global auth bypass for `/api/public/*` routes
- Request logging patterns
- Error handling conventions

**Add to `functions/_middleware.ts` whitelist**:

```typescript
// Allow public routes without auth
const publicRoutes = [
  "/api/health",
  "/api/guest-booking",
  "/api/public/v1/availability", // ← Add this
];
```

### 2.5 Timezone Handling

The Okaeri Resort operates in **Philippine Time (Asia/Manila, UTC+8)**. All dates in the calendar must be normalized to this timezone to ensure consistency.

**Database Layer** (PostgreSQL):

- Supabase stores all `timestamptz` fields in UTC
- When querying dates, PostgreSQL's `CURRENT_DATE` automatically uses the server timezone (UTC)
- The database function compares dates using PostgreSQL's date arithmetic (timezone-agnostic for date comparisons)

**API Layer** (Cloudflare Workers):

- Cloudflare Workers run at the edge in various timezones globally
- JavaScript `new Date()` uses the local timezone of the edge server (varies by location)
- **Solution**: Normalize all date comparisons to UTC by using `setHours(0, 0, 0, 0)`

**Frontend Layer** (React - Phase 2):

- User's browser timezone may differ from Philippine Time
- **Solution**: Use `date-fns-tz` to convert all dates to Asia/Manila timezone before display and API calls
- Format dates as ISO 8601 strings (`YYYY-MM-DD`) for API requests (timezone-neutral)

**Timezone Normalization Pattern** (API):

```typescript
// ✅ GOOD - Normalize to start of day (UTC-agnostic)
const today = new Date();
today.setHours(0, 0, 0, 0); // 00:00:00 UTC

const start = new Date(startDate); // Parse ISO date string (YYYY-MM-DD)
start.setHours(0, 0, 0, 0);

// Compare normalized dates
if (start < today) {
  // Past date validation
}

// ❌ BAD - Don't compare times directly
const today = new Date(); // Includes hours, minutes, seconds
const start = new Date(startDate);
if (start < today) {
  // May incorrectly reject today's date if hours differ
}
```

**Why This Works**:

- ISO 8601 date strings (`YYYY-MM-DD`) are parsed as midnight UTC
- Normalizing to `00:00:00` ensures date-only comparisons
- Database function receives date strings (`DATE` type), automatically converted to server timezone
- Frontend (Phase 2) converts user-selected dates to ISO strings before API calls

**Important Notes**:

1. **No explicit timezone conversion needed in API**: ISO date strings are timezone-neutral
2. **Database handles timezone conversions**: `CURRENT_DATE` uses server timezone (UTC), compared against date strings
3. **Frontend must use `date-fns-tz`**: Converts Asia/Manila dates to ISO strings for API calls (covered in Phase 2)

### 2.6 Audit Logging (Optional)

For security monitoring and debugging, you can optionally log API requests to the `audit_logs` table.

**Implementation** (add to endpoint):

```typescript
// Import audit logger
import { logAuditEvent } from "@/lib/audit-logger-workers";

// After successful response (use waitUntil for non-blocking)
waitUntil(
  logAuditEvent({
    action: "public_calendar.viewed",
    entity_type: "calendar",
    entity_id: null,
    user_id: null, // Public endpoint - no authenticated user
    severity: "INFO",
    ip_address: request.headers.get("cf-connecting-ip"),
    user_agent: request.headers.get("user-agent"),
    metadata: {
      start_date: startDate,
      end_date: endDate,
      days_queried: daysDiff,
      origin: request.headers.get("origin"),
    },
  }).catch(console.error)
);
```

**Benefits**:

- Track calendar usage patterns (peak query times, popular date ranges)
- Detect suspicious activity (rapid repeated queries, abuse patterns)
- Debug issues (correlate errors with specific requests)
- Monitor free tier usage (total queries per day)

**Storage Cost**:

- **Expected volume**: ~500 calendar views/month = ~500 audit log rows/month
- **Row size**: ~300 bytes (metadata JSON)
- **Monthly storage**: ~0.15 MB/month (well within Supabase free tier 500 MB)
- **Retention**: Configure auto-cleanup after 90 days (optional)

**Query Example** (find top-queried date ranges):

```sql
SELECT
  metadata->>'start_date' as start_date,
  metadata->>'end_date' as end_date,
  COUNT(*) as view_count
FROM audit_logs
WHERE action = 'public_calendar.viewed'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY metadata->>'start_date', metadata->>'end_date'
ORDER BY view_count DESC
LIMIT 10;
```

---

## Step 3: Local Testing

### 3.1 Test with cURL

```bash
# Test current month (default)
curl http://localhost:8788/api/public/v1/availability

# Test specific date range
curl "http://localhost:8788/api/public/v1/availability?start=2025-01-01&end=2025-01-31"

# Test error handling (invalid date)
curl "http://localhost:8788/api/public/v1/availability?start=invalid&end=2025-01-31"

# Test error handling (range too large)
curl "http://localhost:8788/api/public/v1/availability?start=2025-01-01&end=2026-01-01"

# Test error handling (past date - should reject)
curl "http://localhost:8788/api/public/v1/availability?start=2024-01-01&end=2024-01-31"

# Test error handling (too far in future - should reject)
curl "http://localhost:8788/api/public/v1/availability?start=2026-06-01&end=2026-06-30"

# Test CORS preflight
curl -X OPTIONS http://localhost:8788/api/public/v1/availability
```

### 3.2 Test with Postman

Create a new request collection:

**Request 1: Happy Path**

```
GET http://localhost:8788/api/public/v1/availability?start=2025-01-01&end=2025-01-31
```

**Expected Response (200 OK)**:

```json
{
  "totalUnits": 3,
  "dateRange": {
    "start": "2025-01-01",
    "end": "2025-01-31"
  },
  "availability": [
    {
      "date": "2025-01-01",
      "availableCount": 3,
      "status": "full"
    },
    ...
  ],
  "metadata": {
    "generatedAt": "2025-01-10T10:30:00.000Z",
    "cacheMaxAge": 300,
    "version": "v1"
  }
}
```

**Request 2: Validation Error**

```
GET http://localhost:8788/api/public/v1/availability?start=2025-01-31&end=2025-01-01
```

**Expected Response (400 Bad Request)**:

```json
{
  "error": "End date must be after or equal to start date"
}
```

---

## Step 4: Rate Limiting (Optional but Recommended)

### 4.1 Add Rate Limiting Middleware

Create `/functions/api/public/v1/_middleware.ts`:

```typescript
/**
 * Rate limiting middleware for public availability API
 * Limits requests to 100 per minute per IP address
 */

interface Env {
  RATE_LIMIT_KV: KVNamespace;
}

const RATE_LIMIT = 60; // 30-60 requests per window (CDN caching handles normal traffic)
const WINDOW_SIZE = 60; // seconds

export async function onRequest(context: {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}) {
  const { request, env, next } = context;

  // Skip rate limiting for OPTIONS requests
  if (request.method === "OPTIONS") {
    return next();
  }

  // Get client IP from Cloudflare headers
  const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `ratelimit:availability:${clientIP}`;

  try {
    // Get current request count
    const current = await env.RATE_LIMIT_KV.get(key);
    const requestCount = current ? parseInt(current) : 0;

    // Check if rate limit exceeded
    if (requestCount >= RATE_LIMIT) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: WINDOW_SIZE,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": WINDOW_SIZE.toString(),
            "X-RateLimit-Limit": RATE_LIMIT.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": (Date.now() + WINDOW_SIZE * 1000).toString(),
          },
        }
      );
    }

    // Increment request count
    await env.RATE_LIMIT_KV.put(key, (requestCount + 1).toString(), { expirationTtl: WINDOW_SIZE });

    // Add rate limit headers to response
    const response = await next();
    const newResponse = new Response(response.body, response);
    newResponse.headers.set("X-RateLimit-Limit", RATE_LIMIT.toString());
    newResponse.headers.set("X-RateLimit-Remaining", (RATE_LIMIT - requestCount - 1).toString());

    return newResponse;
  } catch (error) {
    console.error("[Rate Limit] Error:", error);
    // On error, allow request through (fail open)
    return next();
  }
}
```

### 4.2 Configure Cloudflare KV Namespace

1. Go to Cloudflare Dashboard → Workers → KV
2. Create namespace: `RATE_LIMIT_KV`
3. Bind to worker in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-kv-namespace-id"
```

---

## Step 5: Deployment to Production

### 5.1 Deploy Database Function

Already done in Step 1! Function is automatically available in production.

### 5.2 Deploy Cloudflare Worker

```bash
# From project root
cd functions

# Deploy to production
npx wrangler deploy api/public/v1/availability.ts

# Verify deployment
curl https://okaeri-resort.com/api/public/v1/availability
```

### 5.3 Verify CDN Caching

```bash
# First request (cache miss)
curl -I https://okaeri-resort.com/api/public/v1/availability?start=2025-01-01&end=2025-01-31

# Check for cache headers
# Expected: Cache-Control: public, max-age=300, stale-while-revalidate=600
# Expected: CF-Cache-Status: MISS

# Second request (cache hit)
curl -I https://okaeri-resort.com/api/public/v1/availability?start=2025-01-01&end=2025-01-31

# Expected: CF-Cache-Status: HIT
```

---

## Step 6: Monitoring & Validation

### 6.1 Set Up Cloudflare Workers Analytics

1. Go to Cloudflare Dashboard → Workers → Analytics
2. Monitor:
   - **Requests**: Total requests per hour
   - **Error rate**: Should be <1%
   - **Duration**: P50, P95, P99 (target: P95 <500ms)
   - **Cache hit ratio**: Target >80%

### 6.2 Set Up Alerts

Create alert rules:

- **High error rate**: >5% errors over 5 minutes
- **High latency**: P95 >1 second over 5 minutes
- **Low cache hit ratio**: <50% over 15 minutes

---

## Testing Checklist

### Functional Testing

- [ ] **Database function exists**: Can execute `SELECT get_public_aggregate_availability(...)`
- [ ] **Function returns data**: Returns non-empty result set
- [ ] **Date validation works**: Rejects invalid dates
- [ ] **Past date validation works**: Rejects dates before today
- [ ] **Future date validation works**: Rejects dates >1 year from today
- [ ] **Range limit works**: Rejects ranges >180 days
- [ ] **Checkout logic correct**: Checkout date shows as available
- [ ] **Multi-unit support**: Correctly counts bookings from both `bookings.unit_id` and `booking_units` table
- [ ] **API endpoint accessible**: Can call via HTTP
- [ ] **CORS headers present**: OPTIONS request succeeds with specific origin
- [ ] **Error handling**: Returns proper 400/500 responses
- [ ] **Cache headers set**: Response includes Cache-Control
- [ ] **Rate limiting works**: 101st request returns 429

### Performance Testing

- [ ] **Database query fast**: <100ms for 31-day range
- [ ] **API response fast**: <500ms total latency
- [ ] **CDN caching works**: Second request shows HIT
- [ ] **Cache hit ratio high**: >80% after first hour

### Security Testing

- [ ] **No SQL injection**: Try malicious date inputs
- [ ] **No guest data exposed**: Response only contains counts
- [ ] **RLS enforced**: Anonymous users can't query bookings directly
- [ ] **Rate limiting effective**: Can't overwhelm API with spam

---

## Troubleshooting

### Function Not Found

**Error**: `function get_public_aggregate_availability(date, date) does not exist`

**Solution**:

```sql
-- Check if function exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'get_public_aggregate_availability';

-- Recreate if missing
-- (run Step 1.2 again)
```

### Permission Denied

**Error**: `permission denied for function get_public_aggregate_availability`

**Solution**:

```sql
-- Grant execute permission to anon role
GRANT EXECUTE ON FUNCTION get_public_aggregate_availability(DATE, DATE) TO anon;
```

### Slow Query Performance

**Error**: Query takes >1 second

**Solution**:

```sql
-- Check if index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'bookings'
  AND indexdef LIKE '%booking_status%';

-- Create index if missing (should already exist)
CREATE INDEX IF NOT EXISTS idx_bookings_status_dates
  ON bookings (booking_status, check_in, check_out)
  WHERE booking_status NOT IN ('Cancelled', 'CheckedOut');
```

### CDN Not Caching

**Error**: `CF-Cache-Status: BYPASS`

**Solution**:

- Verify `Cache-Control` header is set in response
- Check Cloudflare cache settings (Caching → Configuration)
- Ensure query params are included in cache key

---

## Next Steps

✅ **Phase 1 Complete!** Backend is now ready.

**Move to**: [Phase 2: Frontend Implementation](./02-phase-2-frontend.md)

---

**Estimated Completion Time**: 2 days
**Actual Time Spent**: _[Track here]_
**Blockers**: _[Document any issues]_
**Sign-off**: _[Tech lead approval]_
