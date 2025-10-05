import type { createSupabaseAdmin } from "./supabase-admin";

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
    const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);

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

/**
 * Get file metadata for additional validation
 */
export async function getFileMetadata(
  supabaseAdmin: ReturnType<typeof createSupabaseAdmin>,
  bucket: string,
  path: string
): Promise<{ size?: number; mimeType?: string; error?: string }> {
  try {
    const pathParts = path.split("/");
    const fileName = pathParts.pop();
    const directory = pathParts.join("/");

    const { data, error } = await supabaseAdmin.storage.from(bucket).list(directory, {
      limit: 100,
      search: fileName,
    });

    if (error || !data || data.length === 0) {
      return { error: "File not found" };
    }

    const file = data.find((f) => f.name === fileName);
    if (!file) {
      return { error: "File not found in directory" };
    }

    return {
      size: file.metadata?.size,
      mimeType: file.metadata?.mimetype,
    };
  } catch (error) {
    console.error("Failed to get file metadata:", error);
    return { error: "Metadata retrieval failed" };
  }
}

/**
 * Validate file size is within limits
 */
export function validateFileSize(sizeInBytes: number, maxSizeMB: number = 2): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return sizeInBytes <= maxSizeBytes;
}
