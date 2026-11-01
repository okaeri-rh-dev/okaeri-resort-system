/**
 * POST /api/guest-booking/upload-url
 *
 * Generates signed upload URL for payment proof files
 *
 * Security:
 * - Public endpoint (no authentication required)
 * - File type validation (JPEG/PNG/PDF only)
 * - Size limit enforcement (5MB maximum)
 * - Signed URLs with 5-minute expiry
 * - Private bucket (not publicly accessible)
 *
 * @see vault note [[02-api-specification]]
 */

import { createClient } from "@supabase/supabase-js";

import { checkKVRateLimit, getClientIp } from "@/lib/kv-rate-limit";
import type { Database } from "@/types/database.types";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
  ENVIRONMENT?: string;
}

interface UploadUrlRequest {
  booking_reference: string;
  file_type: string;
  file_size: number;
}

interface UploadUrlResponse {
  success: boolean;
  upload_url?: string;
  file_path?: string;
  expires_in?: number;
  error?: string;
}

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

/**
 * Allowed file types for payment proof uploads, with the extension each is stored under
 * Matches magic number validation in client and the payment-proofs bucket's allowed_mime_types
 */
const FILE_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"], // Some browsers report JPEG as 'image/jpg'
  ["image/png", "png"],
  ["application/pdf", "pdf"],
]);

/**
 * Maximum file size in bytes (5MB)
 * This is the hard server-side limit
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// The guest form uploads before the booking exists: TEMP- plus the first 8 hex digits of its idempotency key
const TEMP_REFERENCE_PATTERN = /^TEMP-[0-9a-f]{8}$/;

/**
 * Signed URL expiry time in seconds (5 minutes)
 */
const SIGNED_URL_EXPIRY = 300;

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  // Only accept POST requests
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Method not allowed",
      } as UploadUrlResponse),
      {
        status: 405,
        headers: JSON_HEADERS,
      }
    );
  }

  const rateLimit = await checkKVRateLimit(
    env.RATE_LIMIT_KV,
    `upload-url:${getClientIp(request)}`,
    { limit: 10, windowSeconds: 3600, environment: env.ENVIRONMENT }
  );
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Too many uploads. Please try again later.",
      } as UploadUrlResponse),
      {
        status: 429,
        headers: { ...JSON_HEADERS, "Retry-After": String(rateLimit.retryAfter) },
      }
    );
  }

  try {
    // Parse request body
    const body = (await request.json()) as UploadUrlRequest;
    const { booking_reference, file_type, file_size } = body;

    // Validate required fields
    if (!booking_reference || !file_type || file_size === undefined) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: booking_reference, file_type, file_size",
        } as UploadUrlResponse),
        {
          status: 400,
          headers: JSON_HEADERS,
        }
      );
    }

    if (!TEMP_REFERENCE_PATTERN.test(booking_reference)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid booking reference",
        } as UploadUrlResponse),
        {
          status: 400,
          headers: JSON_HEADERS,
        }
      );
    }

    // Validate file type
    const fileExtension = FILE_EXTENSIONS.get(file_type);
    if (!fileExtension) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid file type. Allowed types: ${[...FILE_EXTENSIONS.keys()].join(", ")}`,
        } as UploadUrlResponse),
        {
          status: 400,
          headers: JSON_HEADERS,
        }
      );
    }

    // Validate file size (server-side hard limit)
    if (file_size > MAX_FILE_SIZE) {
      const sizeMB = (file_size / 1024 / 1024).toFixed(2);
      return new Response(
        JSON.stringify({
          success: false,
          error: `File size (${sizeMB}MB) exceeds 5MB limit`,
        } as UploadUrlResponse),
        {
          status: 400,
          headers: JSON_HEADERS,
        }
      );
    }

    // Initialize Supabase admin client (requires SERVICE_ROLE_KEY for storage operations)
    const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Generate unique file path within the bucket
    // Format: {booking_reference}_{timestamp}.{extension}
    const timestamp = Date.now();
    const uniqueFileName = `${booking_reference}_${timestamp}.${fileExtension}`;
    const filePath = uniqueFileName;

    // Generate signed upload URL
    // This URL allows the client to upload directly to Supabase Storage
    const { data, error } = await supabase.storage
      .from("payment-proofs")
      .createSignedUploadUrl(filePath, {
        upsert: false, // Don't allow overwriting existing files
      });

    if (error) {
      console.error("[UPLOAD_URL] Supabase error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Storage error: ${error.message || "Failed to generate upload URL"}`,
        } as UploadUrlResponse),
        {
          status: 500,
          headers: JSON_HEADERS,
        }
      );
    }

    // Return signed URL to client
    return new Response(
      JSON.stringify({
        success: true,
        upload_url: data.signedUrl,
        file_path: filePath,
        expires_in: SIGNED_URL_EXPIRY,
      } as UploadUrlResponse),
      {
        status: 200,
        headers: JSON_HEADERS,
      }
    );
  } catch (error) {
    console.error("[UPLOAD_URL] Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        error: `Server error: ${errorMessage}`,
      } as UploadUrlResponse),
      {
        status: 500,
        headers: JSON_HEADERS,
      }
    );
  }
}
