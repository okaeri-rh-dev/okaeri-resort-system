# Backend Implementation Guide (Cloudflare Pages)

## Overview

This guide covers the server-side implementation of the guest booking system using **Cloudflare Pages Functions**, including API endpoints, Cloudflare KV rate limiting, Turnstile verification, and Supabase signed URL generation.

**Platform**: Cloudflare Pages with Workers runtime
**Cost**: $0/month (free tier)

**⚠️ Critical Runtime Constraint**: Cloudflare Workers use the V8 JavaScript engine with Web standard APIs only. **No Node.js APIs** are available. All code must be Workers-compatible using `fetch`, `context.env`, and Web standards.

## Prerequisites

- Supabase service role key
- Cloudflare account (free tier)
- Wrangler CLI installed (`npm install -g wrangler`)
- Cloudflare KV namespace created
- Turnstile site keys (free)
- Node.js 18+

## Environment Setup

### Required Environment Variables

```env
# .env.local (for local development with Wrangler)
# Set in Cloudflare Pages dashboard for production

# Supabase Configuration
VITE_SUPABASE_URL=https://gxgpdlvathotgqtszabo.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...  # Public anon key
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Critical: Backend only, never expose to frontend

# Cloudflare Turnstile (free, unlimited)
TURNSTILE_SECRET_KEY=0x...  # Backend verification
VITE_TURNSTILE_SITE_KEY=0x...  # Frontend widget

# Email Service (Resend free tier: 100/day)
RESEND_API_KEY=re_...

# Application
VITE_APP_URL=https://yourdomain.pages.dev
NODE_ENV=production
```

### Wrangler Configuration

```toml
# wrangler.toml
name = "okaeri-resort"
compatibility_date = "2025-09-29"
pages_build_output_dir = "dist"

# KV Namespace for rate limiting
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-kv-namespace-id"  # Get from `wrangler kv:namespace create RATE_LIMIT_KV`

# Production environment variables
[env.production.vars]
ENVIRONMENT = "production"
```

## Core Implementation

### 1. Supabase Admin Client

**File**: `src/lib/supabase-admin.ts`

**Note**: This helper can be used in both Cloudflare Functions and regular app code. In Cloudflare Functions, environment variables come from `context.env`.

```typescript
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/database.types";

/**
 * Creates Supabase admin client for backend operations
 * Can accept env object (for Cloudflare Functions) or use process.env
 */
export function createSupabaseAdmin(env?: Record<string, string>) {
  const supabaseUrl = env?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const serviceRoleKey = env?.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing VITE_SUPABASE_URL");
  }
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "x-application-name": "okaeri-resort-backend",
      },
    },
  });
}

/**
 * Generate a token-based signed upload URL for guest bookings
 * Returns structured credentials for use with uploadToSignedUrl() on client
 */
export async function generateSignedUploadUrl(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  bucket: string,
  path: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<{ path: string; token: string; bucket: string; expires_at: string }> {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUploadUrl(path, expiresIn);

  if (error) {
    console.error("Failed to generate signed URL:", error);
    throw new Error("Failed to generate upload URL");
  }

  return {
    path: data.path,
    token: data.token,
    bucket,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}

/**
 * Generate a signed download URL for receipts
 */
export async function generateSignedDownloadUrl(
  bucket: string,
  path: string,
  expiresIn: number = 86400 // 24 hours default
): Promise<string> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, expiresIn);

  if (error) {
    console.error("Failed to generate download URL:", error);
    throw new Error("Failed to generate download URL");
  }

  return data.signedUrl;
}
```

### 2. Guest Booking API Endpoint (Cloudflare Function)

**File**: `functions/api/guest-booking.ts`

**Key Differences from Vercel:**

- Uses `onRequest` instead of `export default handler`
- Environment via `context.env` instead of `process.env`
- Returns Web standard `Response` objects
- KV binding via `context.env.RATE_LIMIT_KV`

```typescript
import DOMPurify from "isomorphic-dompurify";
import { z } from "zod";

import { sendBookingConfirmation } from "@/lib/email";
import { checkKVRateLimit } from "@/lib/kv-rate-limit";
import { createSupabaseAdmin, generateSignedUploadUrl } from "@/lib/supabase-admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { generateBookingReference } from "@/utils/booking";

// Environment type for Cloudflare
interface Env {
  SUPABASE_SERVICE_ROLE_KEY: string;
  VITE_SUPABASE_URL: string;
  TURNSTILE_SECRET_KEY: string;
  RESEND_API_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
}

// Request validation schema (same as before)
const guestBookingSchema = z.object({
  guest_name: z
    .string()
    .min(2)
    .max(100)
    .transform((val) => DOMPurify.sanitize(val)),
  email: z.string().email().toLowerCase(),
  phone_number: z
    .string()
    .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,10}$/),
  unit_id: z.string().uuid(),
  check_in: z.string().datetime(),
  check_out: z.string().datetime(),
  num_guests: z.number().min(1).max(20),
  special_requests: z
    .string()
    .max(500)
    .optional()
    .transform((val) => (val ? DOMPurify.sanitize(val) : undefined)),
  turnstile_token: z.string(), // Changed from captcha_token
  file_name: z.string().max(255),
  file_type: z.enum(["image/jpeg", "image/png", "image/jpg", "image/webp", "application/pdf"]),
  file_size: z.number().max(2 * 1024 * 1024), // 2MB max (reduced for free tier)
});

// Cloudflare Pages Function handler
export async function onRequest(context: EventContext<Env, any, Record<string, unknown>>) {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle OPTIONS request
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Get client IP (Cloudflare provides this in headers)
    const clientIp =
      request.headers.get("CF-Connecting-IP") ||
      request.headers.get("X-Forwarded-For") ||
      "unknown";

    // Check KV rate limit (5 bookings per hour per IP)
    const rateLimitResult = await checkKVRateLimit(env.RATE_LIMIT_KV, clientIp, {
      limit: 5,
      windowSeconds: 3600, // 1 hour
    });

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: "Too many requests",
          message: "Please wait before submitting another booking",
          retryAfter: rateLimitResult.retryAfter,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(rateLimitResult.retryAfter),
          },
        }
      );
    }

    // Parse request body
    const body = await request.json();
    const validationResult = guestBookingSchema.safeParse(body);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: "Validation failed",
          errors: validationResult.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = validationResult.data;

    // Verify Turnstile CAPTCHA
    const turnstileValid = await verifyTurnstile(data.turnstile_token, env.TURNSTILE_SECRET_KEY);
    if (!turnstileValid) {
      return new Response(
        JSON.stringify({
          error: "CAPTCHA verification failed",
          message: "Please complete the CAPTCHA challenge",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client with env
    const supabaseAdmin = createSupabaseAdmin(env);

    // CRITICAL: Check unit availability ATOMICALLY before creating booking
    const { data: availabilityCheck, error: availErr } = await supabaseAdmin.rpc(
      "check_unit_availability",
      {
        p_unit_id: data.unit_id,
        p_check_in: data.check_in,
        p_check_out: data.check_out,
      }
    );

    if (availErr || !availabilityCheck) {
      return new Response(
        JSON.stringify({
          error: "AVAILABILITY_CONFLICT",
          message: "The selected unit is not available for these dates",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Start database transaction
    const bookingReference = generateBookingReference();

    // Check if guest exists or create new
    let guestId: string | null = null;

    const { data: existingGuest } = await supabaseAdmin
      .from("guests")
      .select("guest_id")
      .eq("email", data.email)
      .single();

    if (existingGuest) {
      guestId = existingGuest.guest_id;
    } else {
      const { data: newGuest, error: guestError } = await supabaseAdmin
        .from("guests")
        .insert({
          guest_name: data.guest_name,
          email: data.email,
          phone_number: data.phone_number,
        })
        .select("guest_id")
        .single();

      if (guestError) {
        console.error("Failed to create guest:", guestError);
        return res.status(500).json({
          error: "Failed to process booking",
          message: "Could not create guest record",
        });
      }

      guestId = newGuest.guest_id;
    }

    // Calculate total amount
    const { data: unit, error: unitError } = await supabaseAdmin
      .from("units")
      .select("base_rate, weekend_rate, extra_person_rate, base_occupancy")
      .eq("unit_id", data.unit_id)
      .single();

    if (unitError || !unit) {
      return res.status(400).json({
        error: "Invalid unit",
        message: "Could not find unit details",
      });
    }

    const checkIn = new Date(data.check_in);
    const checkOut = new Date(data.check_out);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    // Simple rate calculation (you may want to enhance this)
    const baseTotal = nights * unit.base_rate;
    const extraPersonCharges =
      Math.max(0, data.num_guests - unit.base_occupancy) * unit.extra_person_rate * nights;
    const totalAmount = baseTotal + extraPersonCharges;

    // Create booking record
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        booking_reference: bookingReference,
        unit_id: data.unit_id,
        guest_id: guestId,
        guest_name: data.guest_name,
        contact_number: data.phone_number,
        email: data.email,
        num_guests: data.num_guests,
        check_in: data.check_in,
        check_out: data.check_out,
        total_amount: totalAmount,
        booking_status: "Pending",
        payment_status: "Pending",
        special_requests: data.special_requests,
        is_guest_booking: true, // Identifies guest bookings (admin pre-screened)
      })
      .select()
      .single();

    if (bookingError || !booking) {
      console.error("Failed to create booking:", bookingError);
      return new Response(
        JSON.stringify({
          error: "BOOKING_CREATE_FAILED",
          message: "Could not process your booking request",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate signed upload URL with token-based approach
    const fileExt = data.file_name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${Date.now()}_${crypto.randomUUID().substring(0, 8)}.${fileExt}`;
    const filePath = `guest-bookings/${booking.booking_id}/${fileName}`;

    const uploadCredentials = await generateSignedUploadUrl(
      supabaseAdmin,
      "payment-proofs",
      filePath,
      3600 // 1 hour expiry
    );

    // Send confirmation email (async, don't wait)
    // Note: No email verification - admin pre-screening handles trust
    sendBookingConfirmation({
      to: data.email,
      bookingReference: bookingReference,
      guestName: data.guest_name,
      checkIn: checkIn.toLocaleDateString(),
      checkOut: checkOut.toLocaleDateString(),
      totalAmount: totalAmount,
    }).catch((error) => {
      console.error("Failed to send confirmation email:", error);
      // Don't fail the request if email fails
    });

    // Return success response with token-based upload credentials
    return new Response(
      JSON.stringify({
        success: true,
        booking: {
          booking_id: booking.booking_id,
          booking_reference: bookingReference,
          total_amount: totalAmount,
        },
        upload: {
          path: uploadCredentials.path,
          token: uploadCredentials.token,
          bucket: uploadCredentials.bucket,
          expires_at: uploadCredentials.expires_at,
        },
        message: "Booking created successfully. Please upload your payment proof (max 2MB).",
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Guest booking error:", error);

    return new Response(
      JSON.stringify({
        error: "INTERNAL_ERROR",
        message: "An unexpected error occurred. Please try again later.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
```

### 3. Upload Confirmation Endpoint

**File**: `api/guest-booking/confirm.ts`

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";

import { sendUploadConfirmation } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabase-admin";

const confirmSchema = z.object({
  booking_id: z.string().uuid(),
  file_path: z.string(),
  file_size: z.number(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const data = confirmSchema.parse(req.body);

    // Verify the file exists in storage
    const { data: file, error: fileError } = await supabaseAdmin.storage
      .from("payment-proofs")
      .list(data.file_path.split("/").slice(0, -1).join("/"), {
        limit: 1,
        search: data.file_path.split("/").pop(),
      });

    if (fileError || !file || file.length === 0) {
      return res.status(400).json({
        error: "Upload verification failed",
        message: "Could not verify file upload",
      });
    }

    // Update booking with proof URL
    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({
        payment_proof_url: data.file_path,
        updated_at: new Date().toISOString(),
      })
      .eq("booking_id", data.booking_id);

    if (updateError) {
      console.error("Failed to update booking:", updateError);
      return res.status(500).json({
        error: "Failed to confirm upload",
        message: "Upload completed but booking update failed",
      });
    }

    // Create payment record
    const { error: paymentError } = await supabaseAdmin.from("payments").insert({
      booking_id: data.booking_id,
      amount: 0, // Will be updated when payment is verified
      payment_method: "Pending",
      payment_date: new Date().toISOString(),
      proof_url: data.file_path,
      notes: "Guest booking - pending verification",
    });

    if (paymentError) {
      console.error("Failed to create payment record:", paymentError);
      // Don't fail the request, payment record can be created manually
    }

    // Send upload confirmation email
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("email, guest_name, booking_reference")
      .eq("booking_id", data.booking_id)
      .single();

    if (booking) {
      sendUploadConfirmation({
        to: booking.email,
        guestName: booking.guest_name,
        bookingReference: booking.booking_reference,
      }).catch(console.error);
    }

    return res.status(200).json({
      success: true,
      message: "Upload confirmed successfully",
    });
  } catch (error) {
    console.error("Confirmation error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to confirm upload",
    });
  }
}
```

### 4. Rate Limiting Implementation (Cloudflare KV)

**File**: `src/lib/kv-rate-limit.ts`

**Approach**: Coarse-window strategy to minimize KV writes and stay within free tier limits.

**Why Coarse Windows**: The free KV tier allows only **1,000 writes/day**. A per-request write strategy would exhaust this quickly. Instead, we use hourly time windows where each unique IP gets at most 24 writes/day (one per hour), allowing ~40 unique IPs/day.

```typescript
/**
 * Cloudflare KV-based rate limiting with coarse-window strategy
 * Free tier: 100k reads/day, 1k writes/day (critical constraint)
 *
 * Strategy: Use hourly time windows instead of per-request writes
 * Result: ~24 writes/day per unique IP vs ~N writes/day with sliding window
 */

interface RateLimitOptions {
  limit: number; // Max requests allowed per window
  windowSeconds: number; // Time window in seconds
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // Seconds until retry
}

export async function checkKVRateLimit(
  kv: KVNamespace,
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = options;
  const now = Math.floor(Date.now() / 1000);

  // Coarse window approach: divide time into fixed windows
  const windowKey = Math.floor(now / windowSeconds);
  const key = `rate-limit:${identifier}:${windowKey}`;

  // Get current count for this window (single read)
  const current = await kv.get(key);
  const count = current ? parseInt(current) : 0;

  // Check if limit exceeded
  if (count >= limit) {
    const windowEnd = (windowKey + 1) * windowSeconds;
    const retryAfter = windowEnd - now;

    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(retryAfter, 1),
    };
  }

  // Increment counter (single write per window, not per request)
  await kv.put(key, String(count + 1), {
    expirationTtl: windowSeconds + 60, // Auto-cleanup after window + buffer
  });

  return {
    allowed: true,
    remaining: limit - (count + 1),
    retryAfter: 0,
  };
}

// Usage example in Cloudflare Function:
// const result = await checkKVRateLimit(env.RATE_LIMIT_KV, clientIp, {
//   limit: 5,
//   windowSeconds: 3600 // 1 hour window = 24 writes max per IP/day
// });
```

### 5. Turnstile CAPTCHA Verification (Cloudflare)

**File**: `src/lib/turnstile.ts`

**Benefits over reCAPTCHA**:

- ✅ Free, unlimited verifications
- ✅ No quota limits
- ✅ Better privacy (no Google tracking)
- ✅ Integrated with Cloudflare ecosystem
- ✅ Workers-native (no external dependencies)

```typescript
/**
 * Cloudflare Turnstile verification (Workers-native)
 * Free tier: Unlimited verifications
 *
 * IMPORTANT: Must use URLSearchParams (not FormData) for Workers compatibility
 */

interface TurnstileResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
  action?: string;
  cdata?: string;
}

export async function verifyTurnstile(
  token: string,
  secretKey: string,
  options?: {
    remoteip?: string;
    expectedHostname?: string;
    expectedAction?: string;
  }
): Promise<boolean> {
  if (!secretKey) {
    console.warn("TURNSTILE_SECRET_KEY not configured, skipping verification");
    return true; // Skip in development
  }

  try {
    // Use URLSearchParams for Workers compatibility (not FormData)
    const formData = new URLSearchParams({
      secret: secretKey,
      response: token,
      ...(options?.remoteip ? { remoteip: options.remoteip } : {}),
    });

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
    });

    const data: TurnstileResponse = await response.json();

    // Enhanced security validation
    if (!data.success) {
      console.warn("Turnstile verification failed:", data["error-codes"]);
      return false;
    }

    // Verify hostname matches expected domain (prevents token reuse from other sites)
    if (options?.expectedHostname && data.hostname) {
      if (!data.hostname.includes(options.expectedHostname)) {
        console.warn(
          `Hostname mismatch: expected ${options.expectedHostname}, got ${data.hostname}`
        );
        return false;
      }
    }

    // Verify action matches expected value (prevents token reuse across different forms)
    if (options?.expectedAction && data.action) {
      if (data.action !== options.expectedAction) {
        console.warn(`Action mismatch: expected ${options.expectedAction}, got ${data.action}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return false;
  }
}

// Usage in Cloudflare Function (Enhanced Security):
// const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
// const isValid = await verifyTurnstile(
//   data.turnstile_token,
//   env.TURNSTILE_SECRET_KEY,
//   {
//     remoteip: clientIp,
//     expectedHostname: 'your-domain.pages.dev',
//     expectedAction: 'guest-booking'
//   }
// );
```

**Security Benefits**:

- **Hostname validation**: Prevents token theft/reuse from other domains
- **Action validation**: Ensures token was generated for guest booking form specifically
- **IP binding**: Associates token with request origin for additional verification

### 6. Idempotency Pattern

**Problem**: Network retries or double-clicks can create duplicate bookings even with rate limiting.

**Solution**: Store request fingerprints in KV with 10-minute TTL.

**File**: `src/lib/idempotency.ts`

```typescript
/**
 * Idempotency handler using Cloudflare KV
 * Prevents duplicate bookings from retry attempts or double-submits
 */

export interface IdempotencyResult {
  isProcessed: boolean;
  response?: string; // Cached response if already processed
}

export async function checkIdempotency(kv: KVNamespace, key: string): Promise<IdempotencyResult> {
  const cached = await kv.get(key);

  if (cached) {
    return {
      isProcessed: true,
      response: cached,
    };
  }

  return { isProcessed: false };
}

export async function setIdempotencyResult(
  kv: KVNamespace,
  key: string,
  response: string,
  ttlSeconds: number = 600 // 10 minutes default
): Promise<void> {
  await kv.put(key, response, {
    expirationTtl: ttlSeconds,
  });
}
```

**Usage in Guest Booking Endpoint**:

```typescript
// In functions/api/guest-booking.ts

export async function onRequest(context: EventContext<Env, any, Record<string, unknown>>) {
  const { request, env } = context;

  // Generate idempotency key from request body hash + client IP
  const idempotencyKey =
    request.headers.get("x-idempotency-key") || (await generateRequestHash(request));

  // Check if already processed
  const idempotencyCheck = await checkIdempotency(
    env.RATE_LIMIT_KV,
    `idempotency:${idempotencyKey}`
  );

  if (idempotencyCheck.isProcessed && idempotencyCheck.response) {
    // Return cached response
    return new Response(idempotencyCheck.response, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Cached": "true",
      },
    });
  }

  // ... process booking ...

  // Cache successful response
  const successResponse = JSON.stringify({ success: true, booking, upload });
  await setIdempotencyResult(env.RATE_LIMIT_KV, `idempotency:${idempotencyKey}`, successResponse);

  return new Response(successResponse, {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

// Helper to generate hash from request
async function generateRequestHash(request: Request): Promise<string> {
  const body = await request.clone().text();
  const encoder = new TextEncoder();
  const data = encoder.encode(body);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 16);
}
```

**Key Features**:

- **Optional client-provided key**: Frontend can send `X-Idempotency-Key` header
- **Automatic fallback**: Hash request body if no key provided
- **KV storage**: Uses same namespace as rate limiting (no extra resource)
- **10-minute window**: Balances protection vs. legitimate retry attempts

### 7. File Magic Byte Validation

**Problem**: Clients can send malicious files with fake `Content-Type` headers (e.g., executable disguised as JPEG).

**Solution**: Validate file content on upload confirmation by checking magic bytes (file signatures).

**File**: `src/lib/file-validation.ts`

```typescript
/**
 * File magic byte validation for security
 * Prevents content-type spoofing and malicious uploads
 */

interface FileSignature {
  mimeType: string;
  extension: string;
  magicBytes: number[][];
}

const ALLOWED_FILE_SIGNATURES: FileSignature[] = [
  {
    mimeType: "image/jpeg",
    extension: "jpg",
    magicBytes: [[0xff, 0xd8, 0xff]],
  },
  {
    mimeType: "image/png",
    extension: "png",
    magicBytes: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  },
  {
    mimeType: "image/webp",
    extension: "webp",
    magicBytes: [
      [0x52, 0x49, 0x46, 0x46], // RIFF
      // followed by WEBP at offset 8 (checked separately)
    ],
  },
  {
    mimeType: "application/pdf",
    extension: "pdf",
    magicBytes: [[0x25, 0x50, 0x44, 0x46]], // %PDF
  },
];

export async function validateFileContent(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  bucket: string,
  path: string
): Promise<{ valid: boolean; detectedType?: string; error?: string }> {
  try {
    // Download first 32 bytes for signature check
    const { data, error } = await supabaseAdmin.storage.from(bucket).download(path, {
      transform: {
        width: undefined,
        height: undefined,
        quality: undefined,
      },
    });

    if (error || !data) {
      return { valid: false, error: "Failed to read file" };
    }

    // Read first 32 bytes
    const arrayBuffer = await data.slice(0, 32).arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Check against allowed signatures
    for (const signature of ALLOWED_FILE_SIGNATURES) {
      for (const magicBytes of signature.magicBytes) {
        if (matchesMagicBytes(bytes, magicBytes)) {
          // Special case for WebP: check for "WEBP" at offset 8
          if (signature.mimeType === "image/webp") {
            const webpMarker = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
            if (bytes.length >= 12 && matchesMagicBytes(bytes.slice(8), webpMarker)) {
              return { valid: true, detectedType: signature.mimeType };
            }
          } else {
            return { valid: true, detectedType: signature.mimeType };
          }
        }
      }
    }

    return {
      valid: false,
      error: "File type not allowed or content-type mismatch",
    };
  } catch (error) {
    console.error("File validation error:", error);
    return { valid: false, error: "Validation failed" };
  }
}

function matchesMagicBytes(fileBytes: Uint8Array, magicBytes: number[]): boolean {
  if (fileBytes.length < magicBytes.length) {
    return false;
  }

  for (let i = 0; i < magicBytes.length; i++) {
    if (fileBytes[i] !== magicBytes[i]) {
      return false;
    }
  }

  return true;
}

// Get file metadata for additional validation
export async function getFileMetadata(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  bucket: string,
  path: string
): Promise<{ size?: number; mimeType?: string; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .list(path.split("/").slice(0, -1).join("/"), {
        limit: 1,
        search: path.split("/").pop(),
      });

    if (error || !data || data.length === 0) {
      return { error: "File not found" };
    }

    const file = data[0];
    return {
      size: file.metadata?.size,
      mimeType: file.metadata?.mimetype,
    };
  } catch (error) {
    console.error("Failed to get file metadata:", error);
    return { error: "Metadata retrieval failed" };
  }
}
```

**Integration in Confirm Endpoint** (`functions/api/guest-booking/confirm.ts`):

```typescript
// After receiving confirmation request

// Step 1: Validate magic bytes
const validation = await validateFileContent(supabaseAdmin, "payment-proofs", data.file_path);

if (!validation.valid) {
  return new Response(
    JSON.stringify({
      error: "INVALID_FILE_CONTENT",
      message: validation.error || "File validation failed",
    }),
    { status: 400, headers: corsHeaders }
  );
}

// Step 2: Verify file size
const metadata = await getFileMetadata(supabaseAdmin, "payment-proofs", data.file_path);
if (metadata.size && metadata.size > 2 * 1024 * 1024) {
  return new Response(
    JSON.stringify({
      error: "FILE_TOO_LARGE",
      message: "File exceeds 2MB limit",
    }),
    { status: 400, headers: corsHeaders }
  );
}

// Step 3: Update booking with validated proof
const { error: updateError } = await supabaseAdmin
  .from("bookings")
  .update({
    payment_proof_url: data.file_path,
    upload_status: "confirmed",
    updated_at: new Date().toISOString(),
  })
  .eq("booking_id", data.booking_id)
  .eq("is_guest_booking", true);
```

**Security Benefits**:

- Prevents executable/script files disguised as images
- Validates actual file content, not just extension or header
- Defense-in-depth strategy
- Minimal performance impact (checks only first 32 bytes)

### 8. Cleanup Strategy (Orphaned Uploads)

**Problem**: Failed uploads leave database records without files, cluttering the system.

**Solution**: Scheduled cleanup job that deletes expired pending bookings.

**File**: `functions/cron/cleanup-guest-bookings.ts`

```typescript
/**
 * Scheduled cleanup for expired guest booking uploads
 * Run hourly via Cloudflare Scheduled Triggers
 */

export async function onRequestGet(context: EventContext<Env, any, Record<string, unknown>>) {
  const { env } = context;
  const supabaseAdmin = createSupabaseAdmin(env);

  try {
    // Find expired uploads (1 hour upload window + 30 min buffer)
    const expiryTime = new Date(Date.now() - 90 * 60 * 1000).toISOString();

    const { data: expiredBookings, error } = await supabaseAdmin
      .from("bookings")
      .select("booking_id, payment_proof_url")
      .eq("is_guest_booking", true)
      .eq("upload_status", "pending")
      .lt("upload_expires_at", expiryTime);

    if (error) {
      console.error("Failed to fetch expired bookings:", error);
      return new Response(JSON.stringify({ error: "Query failed" }), { status: 500 });
    }

    if (!expiredBookings || expiredBookings.length === 0) {
      return new Response(JSON.stringify({ message: "No expired bookings found", count: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Cleanup logic
    const deleted = [];
    for (const booking of expiredBookings) {
      // Delete file if exists
      if (booking.payment_proof_url) {
        await supabaseAdmin.storage
          .from("payment-proofs")
          .remove([booking.payment_proof_url])
          .catch((err) => console.warn(`Failed to delete file: ${err.message}`));
      }

      // Delete or mark booking as expired
      const { error: deleteError } = await supabaseAdmin
        .from("bookings")
        .delete()
        .eq("booking_id", booking.booking_id);

      if (!deleteError) {
        deleted.push(booking.booking_id);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Cleanup completed",
        expired: expiredBookings.length,
        deleted: deleted.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
```

**Cloudflare Scheduled Trigger Setup**:

```toml
# wrangler.toml
[triggers]
crons = ["0 * * * *"]  # Run hourly
```

**Alternative: GitHub Actions** (if Scheduled Triggers unavailable):

```yaml
# .github/workflows/cleanup-guest-bookings.yml
name: Cleanup Expired Guest Bookings
on:
  schedule:
    - cron: "0 * * * *" # Hourly
  workflow_dispatch: # Manual trigger

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger cleanup endpoint
        run: |
          curl -X GET "https://your-domain.pages.dev/cron/cleanup-guest-bookings" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### 9. Booking Reference Generation (ULID-Based)

**File**: `src/utils/booking-reference.ts`

```typescript
import { ulid } from "ulid";

/**
 * Generate secure, non-sequential booking reference
 * Format: BK-YYYY-XXXXXX (e.g., BK-2025-X7K9M2)
 *
 * Properties:
 * - High entropy: ~1 billion combinations per year (32^6)
 * - Non-sequential: Prevents enumeration attacks
 * - Human-friendly: Easy to communicate over phone/email
 * - Collision-resistant: ULID timestamp + randomness
 */
export function generateBookingReference(): string {
  // Generate ULID (Universally Unique Lexicographically Sortable Identifier)
  const id = ulid();

  // Extract last 6 characters (base32, high entropy)
  const randomSuffix = id.slice(-6).toUpperCase();

  // Format with current year
  const year = new Date().getFullYear();

  return `BK-${year}-${randomSuffix}`;
}

// Examples of generated references:
// BK-2025-X7K9M2
// BK-2025-P4QW8N
// BK-2025-ZN3T5R
// BK-2025-M8K4VT
```

**Installation**:

```bash
npm install ulid
```

**Why ULID Over UUID**:

- **Lexicographically sortable**: Can sort by creation time
- **No hyphens in random part**: Cleaner appearance
- **Timestamp-prefixed**: Built-in collision resistance
- **Base32 encoding**: URL-safe, human-readable

### 10. Resend Email DNS Configuration

**Purpose**: Ensure high deliverability for booking confirmation emails by properly configuring email authentication records.

**Resend Dashboard Setup**:

1. **Sign up at resend.com** (free tier: 100 emails/day)
2. **Verify domain** → Go to Domains → Add Domain
3. **Add DNS records** provided by Resend:

**Required DNS Records**:

**SPF Record** (TXT):

```
Name: @
Type: TXT
Value: v=spf1 include:_spf.resend.com ~all
TTL: 3600
```

**DKIM Records** (3 CNAME records provided by Resend):

```
Name: resend._domainkey
Type: CNAME
Value: resend1.resend.com
TTL: 3600

Name: resend2._domainkey
Type: CNAME
Value: resend2.resend.com
TTL: 3600

Name: resend3._domainkey
Type: CNAME
Value: resend3.resend.com
TTL: 3600
```

**DMARC Policy** (TXT - recommended):

```
Name: _dmarc
Type: TXT
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com; ruf=mailto:dmarc@yourdomain.com; sp=quarantine; adkim=r; aspf=r
TTL: 3600
```

**DMARC Policy Explanation**:

- `p=quarantine`: Quarantine suspicious emails (start with `p=none` for monitoring only)
- `rua`: Aggregate reports email address
- `ruf`: Forensic reports email address
- `adkim=r`: Relaxed DKIM alignment
- `aspf=r`: Relaxed SPF alignment

**Verification Steps**:

1. Add all DNS records to your domain provider (Cloudflare, Namecheap, etc.)
2. Wait for DNS propagation (up to 48 hours, usually 10-30 minutes)
3. Verify in Resend dashboard → Domains → Verify
4. Test email sending:
   ```bash
   curl -X POST https://api.resend.com/emails \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "from": "bookings@yourdomain.com",
       "to": "your-test-email@gmail.com",
       "subject": "Test",
       "html": "<p>Test email</p>"
     }'
   ```

**Sender Address Format**:

```typescript
// In sendBookingConfirmation()
const { data, error } = await resend.emails.send({
  from: "Okaeri Resort <bookings@yourdomain.com>", // Use verified domain
  to: data.to,
  subject: `Booking Confirmation - ${data.bookingReference}`,
  html: emailTemplate,
  replyTo: "support@yourdomain.com",
});
```

**Common Issues**:

- **"Domain not verified"**: DNS records not propagated yet, wait 30 min
- **"SPF fail"**: Ensure `include:_spf.resend.com` in SPF record
- **Emails in spam**: Add DMARC record and test email content score
- **DKIM fail**: Verify all 3 DKIM CNAME records are correct

**Testing Tools**:

- `mail-tester.com` - Overall deliverability score
- `mxtoolbox.com/dmarc` - DMARC validation
- `dmarcian.com` - DMARC monitoring

### 11. Email Service Integration

**File**: `src/lib/email.ts`

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface BookingConfirmationData {
  to: string;
  bookingReference: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
}

export async function sendBookingConfirmation(data: BookingConfirmationData) {
  const { to, bookingReference, guestName, checkIn, checkOut, totalAmount } = data;

  // Note: No email verification - admin pre-screening handles trust

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0066cc; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; margin-top: 20px; }
        .booking-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .cta-button { display: inline-block; padding: 12px 24px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Booking Confirmation</h1>
          <p>Reference: ${bookingReference}</p>
        </div>

        <div class="content">
          <p>Dear ${guestName},</p>
          <p>Thank you for your booking! We have received your reservation request and are processing your payment proof.</p>

          <div class="booking-details">
            <h3>Booking Details</h3>
            <div class="detail-row">
              <span><strong>Check-in:</strong></span>
              <span>${checkIn}</span>
            </div>
            <div class="detail-row">
              <span><strong>Check-out:</strong></span>
              <span>${checkOut}</span>
            </div>
            <div class="detail-row">
              <span><strong>Total Amount:</strong></span>
              <span>₱${totalAmount.toLocaleString()}</span>
            </div>
            <div class="detail-row">
              <span><strong>Status:</strong></span>
              <span>Pending Verification</span>
            </div>
          </div>

          <p><strong>Next Steps:</strong></p>
          <ol>
            <li>Upload your payment proof (if not already done)</li>
            <li>Wait for payment verification (usually within 24 hours)</li>
            <li>Receive final confirmation once payment is verified</li>
          </ol>

          <p>You can check your booking status anytime using your reference number: <strong>${bookingReference}</strong></p>
        </div>

        <div class="footer">
          <p>If you have any questions, please contact us at support@okaeri-resort.com</p>
          <p>© 2025 Okaeri Resort. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const { error } = await resend.emails.send({
    from: "Okaeri Resort <bookings@okaeri-resort.com>",
    to: [to],
    subject: `Booking Confirmation - ${bookingReference}`,
    html,
  });

  if (error) {
    throw error;
  }
}

export async function sendUploadConfirmation(data: {
  to: string;
  guestName: string;
  bookingReference: string;
}) {
  const { to, guestName, bookingReference } = data;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif;">
      <h2>Payment Proof Received</h2>
      <p>Dear ${guestName},</p>
      <p>We have successfully received your payment proof for booking ${bookingReference}.</p>
      <p>Our team will verify your payment within 24 hours and send you a final confirmation.</p>
      <p>Thank you for choosing Okaeri Resort!</p>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: "Okaeri Resort <bookings@okaeri-resort.com>",
    to: [to],
    subject: `Payment Proof Received - ${bookingReference}`,
    html,
  });
}
```

## Database Helpers

**File**: `src/lib/guest-booking-helpers.ts`

```typescript
import { supabaseAdmin } from "./supabase-admin";

export async function findGuestByEmail(email: string) {
  const { data, error } = await supabaseAdmin
    .from("guests")
    .select("*")
    .eq("email", email.toLowerCase())
    .single();

  if (error && error.code !== "PGRST116") {
    // Not found is ok
    throw error;
  }

  return data;
}

export async function createGuest(guest: {
  guest_name: string;
  email: string;
  phone_number: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("guests")
    .insert({
      ...guest,
      email: guest.email.toLowerCase(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function checkBookingStatus(bookingReference: string, email: string) {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      `
      booking_id,
      booking_reference,
      booking_status,
      payment_status,
      check_in,
      check_out,
      total_amount,
      unit:units(unit_name, unit_type)
    `
    )
    .eq("booking_reference", bookingReference)
    .eq("email", email.toLowerCase())
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    throw error;
  }

  return data;
}
```

## Error Handling

```typescript
// Centralized error handler
export function handleApiError(error: unknown, res: VercelResponse) {
  console.error("API Error:", error);

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: "Validation error",
      errors: error.errors,
    });
  }

  if (error instanceof Error) {
    // Don't expose internal error messages to client
    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "An error occurred processing your request";

    return res.status(500).json({
      error: "Internal server error",
      message,
    });
  }

  return res.status(500).json({
    error: "Internal server error",
    message: "An unexpected error occurred",
  });
}
```

## Testing the Backend

### Local Testing

```bash
# Start Vercel dev server
vercel dev

# Test the endpoint
curl -X POST http://localhost:3000/api/guest-booking \
  -H "Content-Type: application/json" \
  -d '{
    "guest_name": "John Doe",
    "email": "john@example.com",
    "phone_number": "+1234567890",
    "unit_id": "uuid-here",
    "check_in": "2025-02-01T14:00:00Z",
    "check_out": "2025-02-03T11:00:00Z",
    "num_guests": 2,
    "captcha_token": "test-token",
    "file_name": "receipt.jpg",
    "file_type": "image/jpeg",
    "file_size": 1024000
  }'
```

### Unit Tests

```typescript
// __tests__/api/guest-booking.test.ts
import { createMocks } from "node-mocks-http";

import handler from "@/api/guest-booking";

describe("/api/guest-booking", () => {
  it("should create a booking with valid data", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: {
        // ... valid booking data
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(201);
    expect(JSON.parse(res._getData())).toHaveProperty("booking.booking_id");
  });

  it("should reject invalid email", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: {
        email: "invalid-email",
        // ... other data
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
  });
});
```

## Deployment (Cloudflare Pages)

### Cloudflare Pages Deployment

1. **Create KV Namespace**:

   ```bash
   # Create KV namespace for rate limiting
   wrangler kv:namespace create "RATE_LIMIT_KV"

   # Copy the ID to wrangler.toml
   # Output: { binding = "RATE_LIMIT_KV", id = "abc123..." }
   ```

2. **Set Environment Variables** (in Cloudflare Dashboard):

   Navigate to **Settings** > **Environment variables**:
   - `SUPABASE_SERVICE_ROLE_KEY` (secret)
   - `VITE_SUPABASE_URL` (public)
   - `VITE_SUPABASE_ANON_KEY` (public)
   - `TURNSTILE_SECRET_KEY` (secret)
   - `VITE_TURNSTILE_SITE_KEY` (public)
   - `RESEND_API_KEY` (secret)

3. **Deploy**:

   ```bash
   npm run build
   npm run deploy

   # Or manually with Wrangler
   wrangler pages deploy dist
   ```

### Monitoring (Free Tier Options)

- Use Cloudflare Analytics (built-in, free)
- Monitor KV operations in Cloudflare Dashboard
- Basic error logging via `console.error()` (view in Logs)
- Optional: Free Sentry tier for error tracking (5k events/month)

## Audit Trail Integration

The guest booking system integrates with the implemented audit trail system for comprehensive activity tracking. Audit logging happens at two levels: automatic database triggers and enriched application events.

### 1. Automatic Database Auditing

All database operations are automatically logged by the audit triggers installed in Phase 1:

```typescript
// No code needed! Database triggers automatically log:
// - Guest record creation in `guests` table
// - Booking creation in `bookings` table with is_guest_booking = true
// - Status updates when admin confirms/cancels
// - Payment record updates
```

### 2. Application-Level Audit Events

Add enriched audit logging to capture business context and metadata:

**File**: `functions/api/guest-booking.ts` (enhanced with audit logging)

```typescript
import { AuditCategory, AuditSeverity, EventType } from "@/database.types";
import { logAuditEventWithIp } from "@/lib/audit-logger-workers";

export async function onRequest(context: EventContext<Env, any, Record<string, unknown>>) {
  const { request, env } = context;

  // ... existing code ...

  try {
    // After successful Turnstile verification
    await logAuditEventWithIp(
      {
        action: EventType.guest_booking_attempt,
        category: AuditCategory.BOOKING,
        severity: AuditSeverity.INFO,
        description: `Guest booking attempt for unit ${data.unit_id}`,
        metadata: {
          unit_id: data.unit_id,
          check_in: data.check_in,
          check_out: data.check_out,
          guest_email: data.email, // Will be redacted
          turnstile_verified: true,
          source: "guest_portal",
        },
      },
      request.headers.get("CF-Connecting-IP") || "unknown",
      request.headers.get("User-Agent") || "unknown"
    );

    // ... availability check ...

    // After successful booking creation
    await logAuditEventWithIp(
      {
        action: EventType.guest_booking_created,
        category: AuditCategory.BOOKING,
        severity: AuditSeverity.INFO,
        description: `Guest booking created: ${bookingReference}`,
        metadata: {
          booking_id: booking.booking_id,
          booking_reference: bookingReference,
          total_amount: totalAmount,
          upload_expiry: uploadCredentials.expires_at,
          is_guest_booking: true,
        },
      },
      request.headers.get("CF-Connecting-IP") || "unknown",
      request.headers.get("User-Agent") || "unknown"
    );

    // ... rest of the function ...
  } catch (error) {
    // Log failures for security monitoring
    await logAuditEventWithIp(
      {
        action: EventType.guest_booking_failed,
        category: AuditCategory.BOOKING,
        severity: AuditSeverity.WARNING,
        description: `Guest booking failed: ${error.message}`,
        metadata: {
          error_type: error.name,
          unit_id: data?.unit_id,
          ip_blocked: rateLimitResult?.allowed === false,
        },
      },
      request.headers.get("CF-Connecting-IP") || "unknown",
      request.headers.get("User-Agent") || "unknown"
    );

    // ... error response ...
  }
}
```

### 3. Upload Confirmation Auditing

**File**: `functions/api/guest-booking/confirm.ts`

```typescript
import { logAuditEvent } from "@/lib/audit-logger";

export async function onRequest(context: EventContext<Env, any, Record<string, unknown>>) {
  // ... existing validation ...

  // Log successful upload
  await logAuditEvent({
    action: EventType.payment_proof_uploaded,
    category: AuditCategory.PAYMENT,
    severity: AuditSeverity.INFO,
    description: `Payment proof uploaded for booking ${data.booking_id}`,
    metadata: {
      booking_id: data.booking_id,
      file_size: data.file_size,
      file_path: "[REDACTED]", // Don't log actual paths
      upload_duration_ms: Date.now() - uploadStartTime,
    },
  });

  // Update booking status with audit trail
  const { error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({
      upload_status: "uploaded",
      payment_proof_path: data.file_path,
    })
    .eq("booking_id", data.booking_id);
  // ^ This UPDATE triggers automatic database audit log
}
```

### 4. Admin Review Auditing

When admins review guest bookings, track their actions:

```typescript
// In admin booking review endpoint
import { logAuditEvent } from "@/lib/audit-logger";

export async function reviewGuestBooking(bookingId: string, adminEmail: string) {
  // Log admin starting review
  await logAuditEvent({
    action: EventType.admin_review_started,
    category: AuditCategory.BOOKING,
    severity: AuditSeverity.INFO,
    description: `Admin reviewing guest booking ${bookingId}`,
    metadata: {
      booking_id: bookingId,
      admin_email: adminEmail,
      review_timestamp: new Date().toISOString(),
    },
  });

  // ... review logic ...

  // Log approval/rejection
  await logAuditEvent({
    action: EventType.booking_status_change,
    category: AuditCategory.BOOKING,
    severity: AuditSeverity.INFO,
    description: `Guest booking ${approved ? "approved" : "rejected"} by admin`,
    metadata: {
      booking_id: bookingId,
      new_status: approved ? "Confirmed" : "Cancelled",
      admin_email: adminEmail,
      adjustment_notes: adjustmentNotes,
    },
  });
}
```

### 5. Querying Guest Booking Audit Logs

Admins can query audit logs to track guest bookings:

```typescript
// In admin dashboard
import { useAuditLogs } from "@/lib/audit-hooks";

function GuestBookingAuditTrail({ bookingId }: { bookingId: string }) {
  // Get all audit events for a specific guest booking
  const { data: auditLogs } = useAuditLogs({
    filters: {
      table: "bookings",
      recordId: bookingId
    }
  });

  // Filter for guest-specific events
  const guestEvents = auditLogs?.filter(log =>
    log.metadata?.is_guest_booking === true ||
    log.metadata?.source === "guest_portal"
  );

  return (
    <Timeline>
      {guestEvents?.map(event => (
        <TimelineEvent
          key={event.audit_id}
          timestamp={event.created_at}
          action={event.action}
          description={event.description}
          user={event.user_email || "Guest"}
        />
      ))}
    </Timeline>
  );
}
```

### 6. Audit Event Types for Guest Bookings

Define these event types in your database types:

```typescript
// Add to EventType enum
export enum EventType {
  // ... existing types ...

  // Guest booking events
  guest_booking_attempt = "guest_booking_attempt",
  guest_booking_created = "guest_booking_created",
  guest_booking_failed = "guest_booking_failed",
  payment_proof_uploaded = "payment_proof_uploaded",
  payment_proof_validated = "payment_proof_validated",
  admin_review_started = "admin_review_started",
  booking_dates_adjusted = "booking_dates_adjusted",
  guest_booking_confirmed = "guest_booking_confirmed",
  guest_booking_cancelled = "guest_booking_cancelled",
  guest_email_sent = "guest_email_sent",
}
```

### 7. Security Benefits

The audit trail provides critical security benefits for guest bookings:

1. **Fraud Detection**: Track patterns of failed bookings from same IP
2. **Admin Accountability**: Log which admin approved each guest booking
3. **Compliance**: Maintain audit trail for payment proofs
4. **Troubleshooting**: Debug issues with complete event history
5. **Analytics**: Analyze guest booking conversion funnel

### 8. Performance Considerations

- Audit logging is **asynchronous** - doesn't block main request
- Database triggers have minimal overhead (~5ms)
- Application events use background processing
- Sensitive data automatically redacted
- Audit logs indexed for fast querying

## Security Checklist

- [ ] Service role key only in Cloudflare environment (never in frontend)
- [ ] Cloudflare KV namespace created and bound
- [ ] Turnstile site keys configured (frontend + backend)
- [ ] Input validation on all fields (Zod + DOMPurify)
- [ ] KV rate limiting configured and tested
- [ ] Turnstile CAPTCHA verification working
- [ ] File type and size validation (2MB max)
- [ ] XSS prevention with DOMPurify
- [ ] SQL injection prevention (Supabase handles this)
- [ ] CORS properly configured in Functions
- [ ] Error messages don't leak sensitive info
- [ ] Basic logging configured (console.error)
- [ ] Environment variables set in Cloudflare Pages dashboard
- [ ] Audit logging integrated for all guest booking events
- [ ] Sensitive guest data redacted in audit logs
- [ ] Admin actions tracked with audit trail

---

_Document Version: 2.0.0 (Cloudflare Free-Tier Adaptation)_
_Last Updated: January 2025_
_Platform: Cloudflare Pages + Supabase Free Tier_
