# Backend Implementation Guide

## Overview

This guide covers the server-side implementation of the guest booking system, including API endpoints, signed URL generation, and database operations.

## Prerequisites

- Supabase service role key
- Vercel account configured
- Environment variables set up
- Node.js 18+

## Environment Setup

### Required Environment Variables

```env
# .env.local (for development)
# .env (for Vercel production)

# Supabase Configuration
VITE_SUPABASE_URL=https://gxgpdlvathotgqtszabo.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Critical: Never expose to frontend

# Security Services
RECAPTCHA_SECRET_KEY=6Le...
RECAPTCHA_SITE_KEY=6Le...  # For frontend

# Email Service (Choose one)
RESEND_API_KEY=re_...
# OR
SENDGRID_API_KEY=SG...

# Rate Limiting
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Application
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production
```

## Core Implementation

### 1. Supabase Admin Client

**File**: `src/lib/supabase-admin.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/database.types";

// Validate environment variables
if (!process.env.VITE_SUPABASE_URL) {
  throw new Error("Missing VITE_SUPABASE_URL");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

/**
 * Supabase client with service role for backend operations
 * NEVER use this client in frontend code
 */
export const supabaseAdmin = createClient<Database>(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
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
  }
);

/**
 * Generate a signed upload URL for guest bookings
 */
export async function generateSignedUploadUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<{ signedUrl: string; token: string; path: string }> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path, {
    expiresIn,
    upsert: false,
  });

  if (error) {
    console.error("Failed to generate signed URL:", error);
    throw new Error("Failed to generate upload URL");
  }

  return {
    signedUrl: data.signedUrl,
    token: data.token,
    path: path,
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

### 2. Guest Booking API Endpoint

**File**: `api/guest-booking.ts`

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { supabaseAdmin, generateSignedUploadUrl } from "@/lib/supabase-admin";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendBookingConfirmation } from "@/lib/email";
import { generateBookingReference } from "@/utils/booking";
import DOMPurify from "isomorphic-dompurify";

// Request validation schema
const guestBookingSchema = z.object({
  // Guest Information
  guest_name: z
    .string()
    .min(2)
    .max(100)
    .transform((val) => DOMPurify.sanitize(val)),
  email: z.string().email().toLowerCase(),
  phone_number: z
    .string()
    .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,10}$/),

  // Booking Details
  unit_id: z.string().uuid(),
  check_in: z.string().datetime(),
  check_out: z.string().datetime(),
  num_guests: z.number().min(1).max(20),

  // Optional Fields
  special_requests: z
    .string()
    .max(500)
    .optional()
    .transform((val) => (val ? DOMPurify.sanitize(val) : undefined)),

  // Security
  captcha_token: z.string(),

  // File Information
  file_name: z.string().max(255),
  file_type: z.enum(["image/jpeg", "image/png", "image/jpg", "application/pdf"]),
  file_size: z.number().max(5 * 1024 * 1024), // 5MB max
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers for browser requests
  res.setHeader("Access-Control-Allow-Origin", process.env.NEXT_PUBLIC_APP_URL || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only accept POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      message: "This endpoint only accepts POST requests",
    });
  }

  try {
    // Get client IP for rate limiting
    const clientIp =
      (req.headers["x-forwarded-for"] as string) ||
      (req.headers["x-real-ip"] as string) ||
      req.socket.remoteAddress ||
      "unknown";

    // Check rate limit (5 requests per hour per IP)
    const rateLimitResult = await checkRateLimit(clientIp, {
      requests: 5,
      window: "1h",
    });

    if (!rateLimitResult.success) {
      return res.status(429).json({
        error: "Too many requests",
        message: "Please wait before submitting another booking",
        retryAfter: rateLimitResult.retryAfter,
      });
    }

    // Parse and validate request body
    const validationResult = guestBookingSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        errors: validationResult.error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      });
    }

    const data = validationResult.data;

    // Verify CAPTCHA
    const captchaValid = await verifyRecaptcha(data.captcha_token);
    if (!captchaValid) {
      return res.status(403).json({
        error: "CAPTCHA verification failed",
        message: "Please complete the CAPTCHA challenge",
      });
    }

    // Check unit availability
    const { data: availabilityCheck, error: availabilityError } = await supabaseAdmin.rpc(
      "check_unit_availability",
      {
        p_unit_id: data.unit_id,
        p_check_in: data.check_in,
        p_check_out: data.check_out,
      }
    );

    if (availabilityError || !availabilityCheck) {
      return res.status(400).json({
        error: "Unit not available",
        message: "The selected unit is not available for these dates",
      });
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
        is_guest_booking: true, // Custom field to identify guest bookings
        guest_verification_token: crypto.randomUUID(), // For email verification
      })
      .select()
      .single();

    if (bookingError || !booking) {
      console.error("Failed to create booking:", bookingError);
      return res.status(500).json({
        error: "Failed to create booking",
        message: "Could not process your booking request",
      });
    }

    // Generate signed upload URL
    const fileExt = data.file_name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${Date.now()}_${crypto.randomUUID().substring(0, 8)}.${fileExt}`;
    const filePath = `guest-bookings/${booking.booking_id}/${fileName}`;

    const uploadUrl = await generateSignedUploadUrl(
      "payment-proofs",
      filePath,
      3600 // 1 hour expiry
    );

    // Send confirmation email (async, don't wait)
    sendBookingConfirmation({
      to: data.email,
      bookingReference: bookingReference,
      guestName: data.guest_name,
      checkIn: checkIn.toLocaleDateString(),
      checkOut: checkOut.toLocaleDateString(),
      totalAmount: totalAmount,
      verificationToken: booking.guest_verification_token,
    }).catch((error) => {
      console.error("Failed to send confirmation email:", error);
      // Don't fail the request if email fails
    });

    // Return success response
    return res.status(201).json({
      success: true,
      booking: {
        booking_id: booking.booking_id,
        booking_reference: bookingReference,
        total_amount: totalAmount,
      },
      upload: {
        url: uploadUrl.signedUrl,
        token: uploadUrl.token,
        path: uploadUrl.path,
        expires_in: 3600,
      },
      message: "Booking created successfully. Please upload your payment proof.",
    });
  } catch (error) {
    console.error("Guest booking error:", error);

    return res.status(500).json({
      error: "Internal server error",
      message: "An unexpected error occurred. Please try again later.",
    });
  }
}

// Vercel configuration
export const config = {
  runtime: "nodejs20.x",
  maxDuration: 30,
  regions: ["sin1"], // Singapore for APAC
};
```

### 3. Upload Confirmation Endpoint

**File**: `api/guest-booking/confirm.ts`

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendUploadConfirmation } from "@/lib/email";

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

### 4. Rate Limiting Implementation

**File**: `src/lib/rate-limit.ts`

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Create rate limiter instances for different purposes
const rateLimiters = {
  booking: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1h"), // 5 requests per hour
    analytics: true,
    prefix: "rl:booking",
  }),

  status: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1m"), // 20 requests per minute
    analytics: true,
    prefix: "rl:status",
  }),

  upload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1h"), // 10 uploads per hour
    analytics: true,
    prefix: "rl:upload",
  }),
};

export async function checkRateLimit(
  identifier: string,
  type: keyof typeof rateLimiters = "booking"
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  retryAfter?: number;
}> {
  const rateLimiter = rateLimiters[type];
  const { success, limit, remaining, reset } = await rateLimiter.limit(identifier);

  return {
    success,
    limit,
    remaining,
    retryAfter: success ? undefined : Math.floor((reset - Date.now()) / 1000),
  };
}

// Alternative implementation using Vercel KV if you don't have Upstash
export async function simpleRateLimit(
  identifier: string,
  maxRequests: number = 5,
  windowMs: number = 3600000 // 1 hour
): Promise<boolean> {
  // This is a simplified in-memory rate limiter
  // In production, use Redis or similar persistent storage
  const key = `rate_limit:${identifier}`;
  const now = Date.now();

  // This would need to be replaced with actual KV storage operations
  // For example, using Vercel KV:
  // const requests = await kv.get(key) || [];
  // const recentRequests = requests.filter(time => now - time < windowMs);
  //
  // if (recentRequests.length >= maxRequests) {
  //   return false;
  // }
  //
  // await kv.set(key, [...recentRequests, now], { ex: windowMs / 1000 });
  // return true;

  // Placeholder return for example
  return true;
}
```

### 5. CAPTCHA Verification

**File**: `src/lib/recaptcha.ts`

```typescript
export async function verifyRecaptcha(token: string): Promise<boolean> {
  if (!process.env.RECAPTCHA_SECRET_KEY) {
    console.warn("RECAPTCHA_SECRET_KEY not configured, skipping verification");
    return true; // Skip in development
  }

  try {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`,
    });

    const data = await response.json();

    // For reCAPTCHA v3, you might also want to check the score
    // return data.success && data.score > 0.5;

    return data.success === true;
  } catch (error) {
    console.error("CAPTCHA verification error:", error);
    return false;
  }
}

// Alternative: hCaptcha implementation
export async function verifyHCaptcha(token: string): Promise<boolean> {
  if (!process.env.HCAPTCHA_SECRET_KEY) {
    return true; // Skip in development
  }

  try {
    const response = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `secret=${process.env.HCAPTCHA_SECRET_KEY}&response=${token}`,
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error("hCaptcha verification error:", error);
    return false;
  }
}
```

### 6. Email Service Integration

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
  verificationToken?: string;
}

export async function sendBookingConfirmation(data: BookingConfirmationData) {
  const { to, bookingReference, guestName, checkIn, checkOut, totalAmount, verificationToken } =
    data;

  const verificationUrl = verificationToken
    ? `${process.env.NEXT_PUBLIC_APP_URL}/verify-booking?token=${verificationToken}`
    : null;

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

          ${
            verificationUrl
              ? `
            <p>Please verify your email address to complete your booking:</p>
            <center>
              <a href="${verificationUrl}" class="cta-button">Verify Email</a>
            </center>
          `
              : ""
          }

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

## Deployment

### Vercel Deployment

1. **Set Environment Variables**:

   ```bash
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add RECAPTCHA_SECRET_KEY
   vercel env add RESEND_API_KEY
   vercel env add UPSTASH_REDIS_REST_URL
   vercel env add UPSTASH_REDIS_REST_TOKEN
   ```

2. **Deploy**:
   ```bash
   vercel --prod
   ```

### Monitoring

- Set up Vercel Analytics for API monitoring
- Configure Sentry for error tracking
- Use Upstash Redis analytics for rate limiting metrics

## Security Checklist

- [ ] Service role key only in backend environment
- [ ] Input validation on all fields
- [ ] Rate limiting configured and tested
- [ ] CAPTCHA verification working
- [ ] File type and size validation
- [ ] XSS prevention with DOMPurify
- [ ] SQL injection prevention (Supabase handles this)
- [ ] CORS properly configured
- [ ] Error messages don't leak sensitive info
- [ ] Logging configured for audit trail

---

_Document Version: 1.0.0_
_Last Updated: January 2025_
