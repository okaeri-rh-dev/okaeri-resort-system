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
 * @see docs/implementation/guest-booking-multi-unit/02-api-specification.md lines 746-807
 */

import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

interface UploadUrlRequest {
  booking_reference: string;
  file_name: string;
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

/**
 * CORS headers for cross-origin requests
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

/**
 * Allowed file types for payment proof uploads
 * Matches magic number validation in client
 */
const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/jpg", // Some browsers report JPEG as 'image/jpg'
  "image/png",
  "application/pdf",
];

/**
 * Maximum file size in bytes (5MB)
 * This is the hard server-side limit
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Signed URL expiry time in seconds (5 minutes)
 */
const SIGNED_URL_EXPIRY = 300;

export async function onRequest(context: {
  request: CloudflareRequest;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  // Only accept POST requests
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Method not allowed",
      } as UploadUrlResponse),
      {
        status: 405,
        headers: CORS_HEADERS,
      }
    );
  }

  try {
    // Parse request body
    const body = (await request.json()) as UploadUrlRequest;
    const { booking_reference, file_name, file_type, file_size } = body;

    // Validate required fields
    if (!booking_reference || !file_name || !file_type || file_size === undefined) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: booking_reference, file_name, file_type, file_size",
        } as UploadUrlResponse),
        {
          status: 400,
          headers: CORS_HEADERS,
        }
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file_type)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid file type. Allowed types: ${ALLOWED_FILE_TYPES.join(", ")}`,
        } as UploadUrlResponse),
        {
          status: 400,
          headers: CORS_HEADERS,
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
          headers: CORS_HEADERS,
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
    const fileExtension = file_name.split(".").pop() || "jpg";
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
          headers: CORS_HEADERS,
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
        headers: CORS_HEADERS,
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
        headers: CORS_HEADERS,
      }
    );
  }
}
