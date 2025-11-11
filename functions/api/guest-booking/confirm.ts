import { z } from "zod";

import { createResendClient, sendUploadConfirmation } from "@/lib/email";
import { getFileMetadata, validateFileContent, validateFileSize } from "@/lib/file-validation";
import { checkKVRateLimit } from "@/lib/kv-rate-limit";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getClientIp } from "@/lib/turnstile";

// Environment type
interface Env {
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_URL: string;
  RESEND_API_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
}

// Request validation schema
const confirmSchema = z.object({
  booking_id: z.string().uuid(),
  file_path: z.string(),
  file_size: z.number(),
});

// CORS headers helper
function getCorsHeaders(origin?: string | null) {
  const allowedOrigins = [
    "https://okaeri-resort-system.pages.dev",
    /^https:\/\/[a-z0-9-]+\.okaeri-resort-system\.pages\.dev$/,
  ];

  const isAllowed =
    origin &&
    allowedOrigins.some((allowed) =>
      typeof allowed === "string" ? allowed === origin : allowed.test(origin)
    );

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://okaeri-resort-system.pages.dev",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// Handle OPTIONS request
export async function onRequestOptions(context: { request: Request }): Promise<Response> {
  const corsHeaders = getCorsHeaders(context.request.headers.get("Origin"));
  return new Response(null, { headers: corsHeaders });
}

// Handle POST request for upload confirmation
export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request.headers.get("Origin"));

  try {
    // Rate limiting (10 confirmations per hour per IP)
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkKVRateLimit(env.RATE_LIMIT_KV, clientIp, {
      limit: 10,
      windowSeconds: 3600,
      environment: env.ENVIRONMENT, // Development bypass enabled
    });

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: "Too many requests",
          message: "Please wait before confirming another upload",
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

    // Parse and validate request
    const body = await request.json();
    const validationResult = confirmSchema.safeParse(body);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: "Validation error",
          errors: validationResult.error.errors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = validationResult.data;

    // Create Supabase admin client
    const supabaseAdmin = createSupabaseAdmin(env);

    // Validate file content (magic bytes check)
    const validation = await validateFileContent(supabaseAdmin, "payment-proofs", data.file_path);

    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          error: "INVALID_FILE_CONTENT",
          message: validation.error || "File validation failed",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify file size
    const metadata = await getFileMetadata(supabaseAdmin, "payment-proofs", data.file_path);

    if (metadata.size && !validateFileSize(metadata.size, 2)) {
      return new Response(
        JSON.stringify({
          error: "FILE_TOO_LARGE",
          message: "File exceeds 2MB limit",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update booking with proof URL
    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({
        payment_proof_url: data.file_path,
        upload_status: "uploaded",
        updated_at: new Date().toISOString(),
      })
      .eq("booking_id", data.booking_id)
      .eq("is_guest_booking", true);

    if (updateError) {
      console.error("Failed to update booking:", updateError);
      return new Response(
        JSON.stringify({
          error: "Failed to confirm upload",
          message: "Upload completed but booking update failed",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create payment record (initial placeholder)
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

    // Get booking details for email
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("email, guest_name, booking_reference")
      .eq("booking_id", data.booking_id)
      .single();

    // Send upload confirmation email (async)
    if (booking) {
      const resend = createResendClient(env.RESEND_API_KEY);
      sendUploadConfirmation(resend, {
        to: booking.email,
        guestName: booking.guest_name,
        bookingReference: booking.booking_reference,
      }).catch(console.error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Upload confirmed successfully. Your payment will be verified within 24 hours.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Confirmation error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: "Failed to confirm upload",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
