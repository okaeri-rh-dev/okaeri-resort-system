/**
 * Supabase Storage Utility Functions
 *
 * Handles signed URL generation for private payment proof files
 * Features:
 * - 5-minute signed URL expiry
 * - Auto-renewal before expiry
 * - Private bucket access
 *
 * Source: vault note [[04-admin-interface]]
 */

import { logger } from "@/lib/logger";

import { supabase } from "./supabase";

// ============================================
// Constants
// ============================================

const SIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes
const BUCKET_NAME = "payment-proofs";

// ============================================
// Types
// ============================================

export interface SignedUrlResult {
  url: string;
  expiresAt: Date;
  error?: string;
}

// ============================================
// Signed URL Generation
// ============================================

/**
 * Generates a signed URL for a private file in Supabase Storage
 *
 * @param filePath - Path to file in storage bucket (e.g., "TEST-ABC123_1234567890.jpg")
 * @param expirySeconds - Optional expiry time in seconds (default: 300 = 5 minutes)
 * @returns Signed URL with expiry timestamp
 *
 * @example
 * const { url, expiresAt, error } = await generateSignedUrl('TEST-ABC123_1234567890.jpg', 3600);
 * if (error) {
 *   console.error('Failed to generate URL:', error);
 * } else {
 *   logger.info('URL expires at:', expiresAt);
 *   // Use URL in <img src={url} /> or <embed src={url} />
 * }
 */
export async function generateSignedUrl(
  filePath: string,
  expirySeconds: number = SIGNED_URL_EXPIRY_SECONDS
): Promise<SignedUrlResult> {
  try {
    // Generate signed URL from Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, expirySeconds);

    if (error) {
      console.error("Supabase signed URL error:", error);
      return {
        url: "",
        expiresAt: new Date(),
        error: error.message,
      };
    }

    if (!data?.signedUrl) {
      return {
        url: "",
        expiresAt: new Date(),
        error: "No signed URL returned",
      };
    }

    // Calculate expiry timestamp
    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    return {
      url: data.signedUrl,
      expiresAt,
    };
  } catch (err) {
    console.error("Unexpected error generating signed URL:", err);
    return {
      url: "",
      expiresAt: new Date(),
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Checks if a signed URL needs renewal
 *
 * @param expiresAt - Expiry timestamp from generateSignedUrl()
 * @param thresholdSeconds - Renew this many seconds before expiry (default: 60 = 1 minute)
 * @returns True if URL should be renewed
 */
export function shouldRenewSignedUrl(expiresAt: Date, thresholdSeconds: number = 60): boolean {
  const now = Date.now();
  const expiryTime = expiresAt.getTime();
  const renewalThreshold = expiryTime - thresholdSeconds * 1000;

  return now >= renewalThreshold;
}

/**
 * Auto-renews signed URL if approaching expiry
 *
 * Usage pattern:
 * ```typescript
 * const { url, expiresAt } = await renewSignedUrl(filePath, 3600);
 * setSignedUrl(url);
 * setUrlExpiry(expiresAt);
 * ```
 *
 * @param filePath - Path to file
 * @param expirySeconds - Optional expiry time in seconds (default: 300 = 5 minutes)
 * @returns SignedUrlResult with new URL and expiry
 */
export async function renewSignedUrl(
  filePath: string,
  expirySeconds: number = SIGNED_URL_EXPIRY_SECONDS
): Promise<SignedUrlResult> {
  logger.info("Renewing signed URL for:", { filePath });

  const result = await generateSignedUrl(filePath, expirySeconds);

  if (result.error) {
    console.error("Failed to renew signed URL:", result.error);
  } else {
    logger.info("Signed URL renewed, expires at:", { expiresAt: result.expiresAt });
  }

  return result;
}
