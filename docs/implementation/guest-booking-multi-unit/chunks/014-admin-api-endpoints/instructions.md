# Implementation Instructions: Chunk 014

## Overview

This guide provides step-by-step instructions for implementing the **Admin API Endpoints** - the complete backend API layer for multi-unit booking management.

**Estimated Time**: 90 minutes

**Prerequisites**: Chunks 001-013 completed, Supabase Auth configured, admin user created

---

## Step 1: Create Urgency Scoring Utility (15 minutes)

### 1.1 Create Urgency Scoring File

```bash
# Create the urgency scoring utility
touch src/lib/urgency-scoring.ts
```

**Time**: 1 minute

### 1.2 Implement Urgency Scoring Algorithm

Open `src/lib/urgency-scoring.ts` and add:

```typescript
/**
 * Urgency Scoring System for Multi-Unit Bookings
 *
 * Prioritizes bookings that need immediate attention on a 0-100 scale.
 *
 * Score Components:
 * - Hours to check-in: max 50 points (most critical factor)
 * - Days pending: max 20 points (aging bookings)
 * - Booking value: max 15 points (revenue prioritization)
 * - Unit count: max 15 points (complexity factor)
 *
 * Badge Thresholds:
 * - Critical (75+): Assign within 1 hour
 * - High (50-74): Assign within 4 hours
 * - Medium (25-49): Assign within 12 hours
 * - Low (<25): Assign within 24 hours
 *
 * Reference: 04-admin-interface.md lines 24-148
 */

export interface BookingForUrgency {
  booking_id: string;
  check_in_date: string;
  created_at: string;
  total_amount: number;
  requested_unit_count: number;
}

export interface UrgencyScore {
  score: number;
  badge: "critical" | "high" | "medium" | "low";
  slo_hours: 1 | 4 | 12 | 24;
}

/**
 * Calculate urgency score for a booking
 *
 * @param booking - Booking details with dates, amount, and unit count
 * @returns Urgency score (0-100) with badge and SLO
 */
export function calculateUrgencyScore(booking: BookingForUrgency): UrgencyScore {
  let score = 0;

  const now = new Date();
  const checkIn = new Date(booking.check_in_date);
  const createdAt = new Date(booking.created_at);

  // ============================================================================
  // COMPONENT 1: Hours to Check-in (max 50 points - most critical)
  // ============================================================================

  const hoursToCheckIn = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursToCheckIn < 0) {
    // Already past check-in - CRITICAL!
    return {
      score: 100,
      badge: "critical",
      slo_hours: 1,
    };
  } else if (hoursToCheckIn < 24) {
    score += 50; // Less than 24 hours - maximum urgency
  } else if (hoursToCheckIn < 48) {
    score += 35; // 24-48 hours - high urgency
  } else if (hoursToCheckIn < 72) {
    score += 20; // 48-72 hours - moderate urgency
  } else {
    score += 10; // > 72 hours - baseline urgency
  }

  // ============================================================================
  // COMPONENT 2: Days Pending (max 20 points - aging factor)
  // ============================================================================

  const daysPending = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysPending > 3) {
    score += 20; // Languishing for 3+ days
  } else if (daysPending > 2) {
    score += 15; // 2-3 days old
  } else if (daysPending > 1) {
    score += 10; // 1-2 days old
  } else {
    score += 5; // Fresh booking (<1 day)
  }

  // ============================================================================
  // COMPONENT 3: Booking Value (max 15 points - revenue prioritization)
  // ============================================================================

  if (booking.total_amount > 50000) {
    score += 15; // High-value booking (₱50,000+)
  } else if (booking.total_amount > 30000) {
    score += 10; // Mid-high value (₱30,000-50,000)
  } else if (booking.total_amount > 15000) {
    score += 5; // Mid value (₱15,000-30,000)
  } else {
    score += 2; // Low value (<₱15,000)
  }

  // ============================================================================
  // COMPONENT 4: Unit Count (max 15 points - complexity factor)
  // ============================================================================

  if (booking.requested_unit_count > 5) {
    score += 15; // Large booking (6+ units)
  } else if (booking.requested_unit_count >= 3) {
    score += 10; // Multi-unit booking (3-5 units)
  } else if (booking.requested_unit_count === 2) {
    score += 5; // Small multi-unit (2 units)
  } else {
    score += 2; // Single unit (1 unit)
  }

  // ============================================================================
  // COMPUTE BADGE AND SLO
  // ============================================================================

  const finalScore = Math.min(100, score);

  if (finalScore >= 75) {
    return { score: finalScore, badge: "critical", slo_hours: 1 };
  } else if (finalScore >= 50) {
    return { score: finalScore, badge: "high", slo_hours: 4 };
  } else if (finalScore >= 25) {
    return { score: finalScore, badge: "medium", slo_hours: 12 };
  } else {
    return { score: finalScore, badge: "low", slo_hours: 24 };
  }
}

/**
 * Get badge color for UI rendering
 */
export function getUrgencyBadgeColor(badge: UrgencyScore["badge"]): string {
  const colors = {
    critical: "destructive", // Red
    high: "warning", // Orange
    medium: "default", // Yellow
    low: "secondary", // Gray
  };
  return colors[badge];
}

/**
 * Get badge label for display
 */
export function getUrgencyBadgeLabel(badge: UrgencyScore["badge"]): string {
  const labels = {
    critical: "🔴 Critical",
    high: "🟠 High",
    medium: "🟡 Medium",
    low: "⚪ Low",
  };
  return labels[badge];
}
```

**Time**: 12 minutes

### 1.3 Verify Urgency Scoring

```bash
# Type check
npm run type-check

# Expected: No TypeScript errors for urgency-scoring.ts
```

**Time**: 2 minutes

**What you just built**: Server-side urgency scoring utility that prioritizes bookings needing immediate attention. TypeScript implementation (application layer) is faster than PostgreSQL for <100 bookings.

---

## Step 2: Create Admin Authentication Middleware (10 minutes)

### 2.1 Create Middleware File

```bash
# Create admin middleware
touch functions/api/admin/_middleware.ts
```

**Time**: 1 minute

### 2.2 Implement JWT Authentication

Open `functions/api/admin/_middleware.ts` and add:

```typescript
/**
 * Admin Authentication Middleware
 *
 * Enforces JWT authentication and admin role verification for all /api/admin/* endpoints.
 *
 * Reference: 02-api-specification.md lines 1252-1336
 */

import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

interface AdminContext {
  user_id: string;
  email: string;
  app_role: string;
}

/**
 * Verify admin authentication and authorization
 */
export async function onRequest(context: {
  request: CloudflareRequest;
  next: () => Promise<Response>;
  env: Env;
}) {
  const { request, next, env } = context;

  // Skip OPTIONS requests (CORS preflight)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // ============================================================================
  // STEP 1: Extract JWT Token
  // ============================================================================

  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unauthorized",
        error_code: "UNAUTHORIZED",
        message: "Missing or invalid Authorization header",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  const token = authHeader.substring(7); // Remove 'Bearer '

  // ============================================================================
  // STEP 2: Verify JWT with Supabase Auth
  // ============================================================================

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unauthorized",
        error_code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  // ============================================================================
  // STEP 3: Verify Admin Role
  // ============================================================================

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("app_role")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile || profile.app_role !== "admin") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Forbidden - insufficient permissions",
        error_code: "FORBIDDEN",
        message: "Admin role required",
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  // ============================================================================
  // STEP 4: Enrich Context and Proceed
  // ============================================================================

  // Attach admin context to request (for downstream handlers)
  const adminContext: AdminContext = {
    user_id: user.id,
    email: user.email || "",
    app_role: profile.app_role,
  };

  // Store in context for downstream handlers
  (request as any).adminContext = adminContext;

  // Continue to next handler
  return next();
}
```

**Time**: 8 minutes

### 2.3 Verify Middleware

```bash
# Type check
npm run type-check

# Expected: No TypeScript errors
```

**Time**: 1 minute

**What you just built**: Reusable authentication middleware that protects all admin endpoints. Verifies JWT token and checks admin role before allowing request to proceed.

---

## Step 3: Create Pending Bookings API (20 minutes)

### 3.1 Create Endpoint File

```bash
# Create pending bookings endpoint
touch functions/api/admin/pending-bookings.ts
```

**Time**: 1 minute

### 3.2 Implement Pending Bookings Handler

Open `functions/api/admin/pending-bookings.ts` and add:

```typescript
/**
 * GET /api/admin/pending-bookings
 *
 * Fetches all pending multi-unit bookings sorted by urgency score.
 *
 * Reference: 02-api-specification.md lines 1510-1541
 */

import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

import { checkKVRateLimit } from "@/lib/rate-limit";
import { calculateUrgencyScore } from "@/lib/urgency-scoring";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
}

export async function onRequest(context: { request: CloudflareRequest; env: Env }) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // ============================================================================
    // STEP 1: Rate Limiting
    // ============================================================================

    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
    const { allowed, remaining, resetTime } = await checkKVRateLimit(
      env.RATE_LIMIT_KV,
      clientIP,
      "admin-pending-bookings",
      100, // max requests
      3600 // 1 hour window
    );

    if (!allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Rate limit exceeded",
          error_code: "RATE_LIMIT_EXCEEDED",
          retry_after: resetTime - Math.floor(Date.now() / 1000),
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": resetTime.toString(),
          },
        }
      );
    }

    // ============================================================================
    // STEP 2: Fetch Pending Bookings
    // ============================================================================

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(
        `
        booking_id,
        booking_reference,
        guest_id,
        guests!inner(guest_name, email, phone_number),
        check_in_date,
        check_out_date,
        total_amount,
        downpayment_required,
        payment_status,
        payment_proof_url,
        unit_assignment_status,
        special_requests,
        created_at,
        guest_booking_unit_requests(id, guests_per_unit)
      `
      )
      .eq("is_guest_booking", true)
      .eq("is_multi_unit", true)
      .eq("unit_assignment_status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // ============================================================================
    // STEP 3: Calculate Urgency Scores
    // ============================================================================

    const bookingsWithUrgency = bookings.map((booking) => {
      const requestedUnitCount = booking.guest_booking_unit_requests?.length || 0;

      const urgency = calculateUrgencyScore({
        booking_id: booking.booking_id,
        check_in_date: booking.check_in_date,
        created_at: booking.created_at,
        total_amount: booking.total_amount,
        requested_unit_count: requestedUnitCount,
      });

      return {
        booking_id: booking.booking_id,
        booking_reference: booking.booking_reference,
        guest_id: booking.guest_id,
        guest_name: booking.guests.guest_name,
        email: booking.guests.email,
        phone_number: booking.guests.phone_number,
        check_in_date: booking.check_in_date,
        check_out_date: booking.check_out_date,
        requested_unit_count: requestedUnitCount,
        total_amount: booking.total_amount,
        downpayment_required: booking.downpayment_required,
        payment_status: booking.payment_status,
        payment_proof_url: booking.payment_proof_url,
        unit_assignment_status: booking.unit_assignment_status,
        special_requests: booking.special_requests,
        created_at: booking.created_at,
        urgency_score: urgency.score,
        urgency_badge: urgency.badge,
        urgency_slo_hours: urgency.slo_hours,
      };
    });

    // ============================================================================
    // STEP 4: Sort by Urgency (Highest First)
    // ============================================================================

    const sorted = bookingsWithUrgency.sort((a, b) => b.urgency_score - a.urgency_score);

    // ============================================================================
    // STEP 5: Return Response
    // ============================================================================

    return new Response(
      JSON.stringify({
        success: true,
        bookings: sorted,
        total: sorted.length,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": resetTime.toString(),
        },
      }
    );
  } catch (error) {
    console.error("Pending bookings error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to fetch pending bookings",
        error_code: "INTERNAL_ERROR",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
```

**Time**: 17 minutes

### 3.3 Test Pending Bookings API

```bash
# Test with admin JWT token (replace YOUR_ADMIN_JWT_TOKEN)
curl -X GET https://your-domain.com/api/admin/pending-bookings \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"

# Expected: JSON array of bookings sorted by urgency_score descending
```

**Time**: 2 minutes

**What you just built**: Admin queue endpoint that fetches pending bookings, calculates urgency scores, and returns sorted list for admin dashboard.

---

## Step 4: Create Available Units API (15 minutes)

### 4.1 Create Endpoint File

```bash
# Create available units endpoint
touch functions/api/admin/available-units.ts
```

**Time**: 1 minute

### 4.2 Implement Available Units Handler

Open `functions/api/admin/available-units.ts` and add:

```typescript
/**
 * GET /api/admin/available-units
 *
 * Returns units available for specified date range (not booked/assigned).
 *
 * Reference: 02-api-specification.md lines 1550-1635
 */

import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

import { checkKVRateLimit } from "@/lib/rate-limit";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
}

export async function onRequest(context: { request: CloudflareRequest; env: Env }) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // ============================================================================
    // STEP 1: Rate Limiting
    // ============================================================================

    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
    const { allowed, remaining, resetTime } = await checkKVRateLimit(
      env.RATE_LIMIT_KV,
      clientIP,
      "admin-available-units",
      100,
      3600
    );

    if (!allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Rate limit exceeded",
          error_code: "RATE_LIMIT_EXCEEDED",
        }),
        { status: 429, headers: corsHeaders }
      );
    }

    // ============================================================================
    // STEP 2: Parse and Validate Query Parameters
    // ============================================================================

    const url = new URL(request.url);
    const checkIn = url.searchParams.get("check_in");
    const checkOut = url.searchParams.get("check_out");

    if (!checkIn || !checkOut) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required parameters: check_in, check_out",
          error_code: "VALIDATION_ERROR",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate date format
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid date format",
          error_code: "VALIDATION_ERROR",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (checkOutDate <= checkInDate) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Check-out must be after check-in",
          error_code: "INVALID_DATE_RANGE",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ============================================================================
    // STEP 3: Query Available Units
    // ============================================================================

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    // Fetch all available units
    const { data: allUnits, error: unitsError } = await supabase
      .from("units")
      .select("unit_id, unit_number, unit_name, unit_status")
      .eq("unit_status", "Available");

    if (unitsError) throw unitsError;

    // Fetch units with overlapping bookings
    const { data: bookedUnits, error: bookedError } = await supabase
      .from("booking_units")
      .select("unit_id")
      .neq("status", "cancelled")
      .or(
        `and(check_in_date.lte.${checkIn},check_out_date.gte.${checkIn}),` +
          `and(check_in_date.lte.${checkOut},check_out_date.gte.${checkOut}),` +
          `and(check_in_date.gte.${checkIn},check_out_date.lte.${checkOut})`
      );

    if (bookedError) throw bookedError;

    // Filter out booked units
    const bookedUnitIds = new Set(bookedUnits.map((b) => b.unit_id));
    const availableUnits = allUnits.filter((unit) => !bookedUnitIds.has(unit.unit_id));

    // ============================================================================
    // STEP 4: Fetch Capacity Configuration
    // ============================================================================

    const { data: config, error: configError } = await supabase
      .from("pricing_config")
      .select("max_capacity_per_unit")
      .eq("id", "default")
      .single();

    if (configError) throw configError;

    // ============================================================================
    // STEP 5: Enrich Units with Capacity
    // ============================================================================

    const unitsWithCapacity = availableUnits.map((unit) => ({
      ...unit,
      max_capacity_per_unit: config.max_capacity_per_unit,
    }));

    // ============================================================================
    // STEP 6: Return Response
    // ============================================================================

    return new Response(
      JSON.stringify({
        success: true,
        units: unitsWithCapacity,
        total: unitsWithCapacity.length,
        date_range: {
          check_in: checkIn,
          check_out: checkOut,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "X-RateLimit-Remaining": remaining.toString(),
        },
      }
    );
  } catch (error) {
    console.error("Available units error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to fetch available units",
        error_code: "INTERNAL_ERROR",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
```

**Time**: 12 minutes

### 4.3 Test Available Units API

```bash
# Test with date range (replace YOUR_ADMIN_JWT_TOKEN)
curl -X GET "https://your-domain.com/api/admin/available-units?check_in=2025-03-01&check_out=2025-03-08" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"

# Expected: JSON array of available units for date range
```

**Time**: 2 minutes

**What you just built**: Availability checker that returns units NOT booked for specified date range, enabling admin to select units for assignment.

---

## Step 5: Create Assign Units API (15 minutes)

### 5.1 Create Endpoint File

```bash
# Create assign units endpoint
touch functions/api/admin/assign-units.ts
```

**Time**: 1 minute

### 5.2 Implement Assign Units Handler

Open `functions/api/admin/assign-units.ts` and add:

```typescript
/**
 * POST /api/admin/assign-units
 *
 * Assigns specific units to a pending booking (all-or-nothing).
 *
 * Reference: 02-api-specification.md lines 1637-1731
 */

import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

import { logAuditEvent } from "@/lib/audit-logger";
import { checkKVRateLimit } from "@/lib/rate-limit";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
}

export async function onRequest(context: { request: CloudflareRequest; env: Env }) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // ============================================================================
    // STEP 1: Rate Limiting
    // ============================================================================

    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
    const { allowed } = await checkKVRateLimit(
      env.RATE_LIMIT_KV,
      clientIP,
      "admin-assign-units",
      100,
      3600
    );

    if (!allowed) {
      return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded" }), {
        status: 429,
        headers: corsHeaders,
      });
    }

    // ============================================================================
    // STEP 2: Parse and Validate Request Body
    // ============================================================================

    const body = await request.json();
    const { booking_id, unit_ids } = body;

    if (!booking_id || !Array.isArray(unit_ids) || unit_ids.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid request: booking_id and unit_ids required",
          error_code: "VALIDATION_ERROR",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ============================================================================
    // STEP 3: Call PostgreSQL Assignment Function
    // ============================================================================

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    const { error: assignError } = await supabase.rpc("assign_units_to_booking", {
      p_booking_id: booking_id,
      p_unit_ids: unit_ids,
    });

    if (assignError) {
      // Map database errors to HTTP codes
      if (assignError.code === "23P01") {
        // EXCLUDE constraint violation
        return new Response(
          JSON.stringify({
            success: false,
            error: "One or more units already booked for these dates",
            error_code: "UNIT_ALREADY_BOOKED",
          }),
          { status: 409, headers: corsHeaders }
        );
      }

      if (assignError.message.includes("Payment must be verified")) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Payment verification required before assignment",
            error_code: "PAYMENT_NOT_VERIFIED",
          }),
          { status: 403, headers: corsHeaders }
        );
      }

      if (assignError.message.includes("All-or-nothing")) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Must assign all requested units",
            error_code: "PARTIAL_ASSIGNMENT_NOT_ALLOWED",
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Generic error
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unit assignment failed",
          error_code: "INTERNAL_ERROR",
          details: assignError.message,
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // ============================================================================
    // STEP 4: Create Audit Log Entry
    // ============================================================================

    const adminContext = (request as any).adminContext;

    await logAuditEvent({
      action: "booking.units_assigned",
      entity_type: "booking",
      entity_id: booking_id,
      changes: {
        before: { unit_assignment_status: "pending" },
        after: { unit_assignment_status: "assigned", unit_ids },
      },
      user_id: adminContext?.user_id,
      metadata: {
        ip_address: clientIP,
        user_agent: request.headers.get("user-agent"),
        unit_count: unit_ids.length,
      },
    });

    // ============================================================================
    // STEP 5: Return Success Response
    // ============================================================================

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully assigned ${unit_ids.length} units`,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Assign units error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Assignment failed",
        error_code: "INTERNAL_ERROR",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
```

**Time**: 12 minutes

### 5.3 Test Assign Units API

```bash
# Test assignment (replace YOUR_ADMIN_JWT_TOKEN, booking_id, unit_ids)
curl -X POST https://your-domain.com/api/admin/assign-units \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "uuid-here",
    "unit_ids": ["unit-uuid-1", "unit-uuid-2", "unit-uuid-3"]
  }'

# Expected: {"success": true, "message": "Successfully assigned 3 units"}
```

**Time**: 2 minutes

**What you just built**: Unit assignment endpoint that calls PostgreSQL function for atomic all-or-nothing assignment with audit logging.

---

## Step 6: Create Verify Payment API (10 minutes)

### 6.1 Create Endpoint File

```bash
# Create verify payment endpoint
touch functions/api/admin/verify-payment.ts
```

**Time**: 1 minute

### 6.2 Implement Verify Payment Handler

Open `functions/api/admin/verify-payment.ts` and add:

```typescript
/**
 * POST /api/admin/verify-payment
 *
 * Marks payment as verified or rejected for a booking.
 *
 * Reference: 02-api-specification.md lines 1733-1764
 */

import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

import { logAuditEvent } from "@/lib/audit-logger";
import { checkKVRateLimit } from "@/lib/rate-limit";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
}

export async function onRequest(context: { request: CloudflareRequest; env: Env }) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // ============================================================================
    // STEP 1: Rate Limiting
    // ============================================================================

    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
    const { allowed } = await checkKVRateLimit(
      env.RATE_LIMIT_KV,
      clientIP,
      "admin-verify-payment",
      100,
      3600
    );

    if (!allowed) {
      return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded" }), {
        status: 429,
        headers: corsHeaders,
      });
    }

    // ============================================================================
    // STEP 2: Parse and Validate Request Body
    // ============================================================================

    const body = await request.json();
    const { booking_id, verified, notes } = body;

    if (!booking_id || typeof verified !== "boolean") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid request: booking_id and verified required",
          error_code: "VALIDATION_ERROR",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ============================================================================
    // STEP 3: Update Payment Status
    // ============================================================================

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    const paymentStatus = verified ? "Verified" : "Rejected";

    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        payment_status: paymentStatus,
        payment_verification_notes: notes || null,
        payment_verified_at: verified ? new Date().toISOString() : null,
      })
      .eq("booking_id", booking_id)
      .eq("is_guest_booking", true);

    if (updateError) throw updateError;

    // ============================================================================
    // STEP 4: Create Audit Log Entry
    // ============================================================================

    const adminContext = (request as any).adminContext;

    await logAuditEvent({
      action: verified ? "booking.payment_verified" : "booking.payment_rejected",
      entity_type: "booking",
      entity_id: booking_id,
      changes: {
        before: { payment_status: "Pending" },
        after: { payment_status: paymentStatus, notes },
      },
      user_id: adminContext?.user_id,
      metadata: {
        ip_address: clientIP,
        user_agent: request.headers.get("user-agent"),
      },
    });

    // ============================================================================
    // STEP 5: Return Success Response
    // ============================================================================

    return new Response(
      JSON.stringify({
        success: true,
        message: `Payment ${paymentStatus.toLowerCase()} successfully`,
        payment_status: paymentStatus,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Verify payment error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Payment verification failed",
        error_code: "INTERNAL_ERROR",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
```

**Time**: 8 minutes

### 6.3 Test Verify Payment API

```bash
# Test verification (replace YOUR_ADMIN_JWT_TOKEN, booking_id)
curl -X POST https://your-domain.com/api/admin/verify-payment \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "uuid-here",
    "verified": true,
    "notes": "Payment confirmed via GCash screenshot"
  }'

# Expected: {"success": true, "message": "Payment verified successfully"}
```

**Time**: 1 minute

**What you just built**: Payment verification endpoint that updates payment status and creates audit log, unlocking unit assignment for verified bookings.

---

## Step 7: Update Rate Limiting Configuration (5 minutes)

### 7.1 Add Admin Endpoint Configurations

Open `src/lib/rate-limit.ts` and add admin endpoint configurations:

```typescript
// Add to existing rate limit configurations
export const RATE_LIMIT_CONFIG = {
  // ... existing configs ...

  // Admin endpoints
  "admin-pending-bookings": { max: 100, window: 3600 },
  "admin-available-units": { max: 100, window: 3600 },
  "admin-assign-units": { max: 100, window: 3600 },
  "admin-verify-payment": { max: 100, window: 3600 },
};
```

**Time**: 3 minutes

### 7.2 Verify Rate Limiting

```bash
# Type check
npm run type-check

# Expected: No errors
```

**Time**: 2 minutes

**What you just did**: Configured rate limiting for all admin endpoints to prevent API abuse while allowing normal operations.

---

## Step 8: Final Verification (10 minutes)

### 8.1 Run Type Checking

```bash
# Verify no TypeScript errors
npm run type-check

# Expected: No errors
```

**Time**: 2 minutes

### 8.2 Run Linting

```bash
# Verify no ESLint warnings
npm run lint

# Expected: No warnings
```

**Time**: 2 minutes

### 8.3 Test All Endpoints with curl

```bash
# 1. Test pending bookings
curl -X GET https://your-domain.com/api/admin/pending-bookings \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"

# 2. Test available units
curl -X GET "https://your-domain.com/api/admin/available-units?check_in=2025-03-01&check_out=2025-03-08" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"

# 3. Test verify payment
curl -X POST https://your-domain.com/api/admin/verify-payment \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"booking_id": "uuid", "verified": true}'

# 4. Test assign units
curl -X POST https://your-domain.com/api/admin/assign-units \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"booking_id": "uuid", "unit_ids": ["uuid1", "uuid2"]}'
```

**Time**: 4 minutes

### 8.4 Test Authentication

```bash
# Test without token (should return 401)
curl -X GET https://your-domain.com/api/admin/pending-bookings

# Test with invalid token (should return 401)
curl -X GET https://your-domain.com/api/admin/pending-bookings \
  -H "Authorization: Bearer invalid-token"

# Expected: {"success": false, "error": "Unauthorized", "error_code": "UNAUTHORIZED"}
```

**Time**: 2 minutes

---

## Done! ✅

You have successfully implemented all 4 admin API endpoints with authentication, rate limiting, and audit logging.

### What You Built

- ✅ Urgency scoring utility (TypeScript application layer)
- ✅ Admin authentication middleware (JWT verification + role check)
- ✅ Pending bookings API (queue with urgency scores)
- ✅ Available units API (date range availability checker)
- ✅ Assign units API (calls PostgreSQL function)
- ✅ Verify payment API (unlocks unit assignment)

### Next Steps

1. **Run checkpoint verification** - Open `checkpoint.md` and run all automated/manual checks
2. **Test with frontend** - Integrate admin UI components (chunks 011-013) with these APIs
3. **Verify audit logs** - Check that all admin actions are logged
4. **Test rate limiting** - Make >100 requests to verify rate limiting works
5. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: complete chunk 014-admin-api-endpoints"
   ```
6. **Move to Chunk 015** - Unit and Integration Tests

---

**Estimated Total Time**: 90 minutes ✅
