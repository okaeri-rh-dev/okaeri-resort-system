/**
 * Client-side file validation utilities for payment proof uploads
 *
 * Implements two-tier security strategy:
 * 1. Magic number validation (prevents MIME type spoofing)
 * 2. Client-side image compression (reduces upload time and bandwidth)
 *
 * @module file-validation-client
 * @see docs/implementation/guest-booking-multi-unit/chunks/008-payment-proof-upload/README.md
 */

/**
 * Magic number signatures for supported file types
 *
 * These are the first few bytes of each file format's header.
 * Cannot be spoofed without corrupting the file.
 *
 * References:
 * - JPEG: https://en.wikipedia.org/wiki/JPEG#Syntax_and_structure
 * - PNG: https://en.wikipedia.org/wiki/PNG#File_header
 * - PDF: https://en.wikipedia.org/wiki/PDF#File_format
 */
export const MAGIC_NUMBERS = {
  "image/jpeg": [0xff, 0xd8, 0xff], // All JPEG files start with FF D8 FF
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // PNG signature
  "application/pdf": [0x25, 0x50, 0x44, 0x46], // %PDF in hex
} as const;

export type AllowedFileType = keyof typeof MAGIC_NUMBERS;

/**
 * Validation error types for structured error handling
 */
export interface FileValidationError {
  type: "FILE_TYPE_INVALID" | "FILE_SIZE_EXCEEDED" | "FILE_CONTENT_INVALID" | "VALIDATION_FAILED";
  message: string;
  severity: "error" | "warning" | "info";
}

/**
 * Result of image compression operation
 */
export interface CompressedFileResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number; // Percentage
  wasCompressed: boolean;
}

/**
 * Validate file content by checking magic number (file header)
 *
 * This prevents MIME type spoofing attacks where malicious files
 * are renamed with image/PDF extensions.
 *
 * @param file - File to validate
 * @returns Promise<boolean> - true if magic number matches MIME type
 *
 * @example
 * ```typescript
 * const isValid = await validateFileContent(file);
 * if (!isValid) {
 *   console.error('File appears corrupted or tampered with');
 * }
 * ```
 */
export async function validateFileContent(file: File): Promise<boolean> {
  try {
    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Get expected magic number for this file type
    const magic = MAGIC_NUMBERS[file.type as AllowedFileType];

    if (!magic) {
      console.warn("[FILE_VALIDATION] Unknown file type:", file.type);
      return false;
    }

    // Compare file header bytes to expected magic number
    const isValid = magic.every((byte, i) => bytes[i] === byte);

    if (!isValid) {
      console.error("[FILE_VALIDATION] Magic number mismatch:", {
        expected: magic,
        actual: Array.from(bytes.slice(0, magic.length)),
        fileType: file.type,
        fileName: file.name,
      });
    }

    return isValid;
  } catch (error) {
    console.error("[FILE_VALIDATION] Error reading file:", error);
    return false;
  }
}

/**
 * Compress image file using Canvas API
 *
 * Targets ~2MB for optimal upload speed while maintaining quality.
 * Uses progressive quality reduction (0.9 → 0.5) until target size reached.
 *
 * @param file - Image file to compress (JPEG/PNG)
 * @returns Promise<CompressedFileResult> - Compressed file with metadata
 *
 * @example
 * ```typescript
 * const result = await compressImage(file);
 * console.log(`Compressed ${result.compressionRatio.toFixed(0)}%`);
 * console.log(`${formatFileSize(result.originalSize)} → ${formatFileSize(result.compressedSize)}`);
 * ```
 */
export async function compressImage(file: File): Promise<CompressedFileResult> {
  const originalSize = file.size;

  // Skip compression for PDFs (can't compress PDFs with Canvas API)
  if (file.type === "application/pdf") {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
      wasCompressed: false,
    };
  }

  const targetSize = 2 * 1024 * 1024; // 2MB target

  // Already small enough, no compression needed
  if (file.size <= targetSize) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
      wasCompressed: false,
    };
  }

  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    if (!ctx) {
      throw new Error("Canvas API not supported");
    }

    const compressedFile = await new Promise<File>((resolve, reject) => {
      img.onload = () => {
        // Maintain original dimensions (no resizing)
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        let quality = 0.9; // Start with high quality (90%)

        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Canvas toBlob failed"));
                return;
              }

              // Success conditions:
              // 1. File size under target (~2MB), OR
              // 2. Quality reduced to minimum threshold (0.5)
              if (blob.size <= targetSize || quality <= 0.5) {
                resolve(new File([blob], file.name, { type: "image/jpeg" }));
              } else {
                quality -= 0.1; // Reduce quality by 10%
                tryCompress(); // Retry with lower quality
              }
            },
            "image/jpeg", // Convert all images to JPEG for consistency
            quality
          );
        };

        tryCompress();
      };

      img.onerror = () => reject(new Error("Image load failed"));

      // Load image from file
      img.src = URL.createObjectURL(file);
    });

    const compressionRatio = ((originalSize - compressedFile.size) / originalSize) * 100;

    return {
      file: compressedFile,
      originalSize,
      compressedSize: compressedFile.size,
      compressionRatio,
      wasCompressed: true,
    };
  } catch (error) {
    console.error("[FILE_VALIDATION] Compression failed:", error);

    // Fallback: Return uncompressed if under 5MB hard limit
    if (file.size <= 5 * 1024 * 1024) {
      console.warn("[FILE_VALIDATION] Using uncompressed file (compression failed)");
      return {
        file,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 0,
        wasCompressed: false,
      };
    }

    throw new Error("File too large and compression failed");
  }
}

/**
 * Format file size in human-readable format
 *
 * @param bytes - File size in bytes
 * @returns string - Formatted size (e.g., "2.5 MB", "1.2 KB")
 *
 * @example
 * ```typescript
 * formatFileSize(2560000) // "2.44 MB"
 * formatFileSize(1024) // "1 KB"
 * ```
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Validate file before upload
 *
 * Checks:
 * 1. File type (JPEG/PNG/PDF only)
 * 2. File size (<5MB hard limit)
 * 3. Content validity (magic number check)
 *
 * @param file - File to validate
 * @returns Promise<FileValidationError | null> - Error object or null if valid
 *
 * @example
 * ```typescript
 * const error = await validateFile(file);
 * if (error) {
 *   console.error(error.message);
 *   return;
 * }
 * // File is valid, proceed with upload
 * ```
 */
export async function validateFile(file: File): Promise<FileValidationError | null> {
  const allowedTypes: AllowedFileType[] = ["image/jpeg", "image/png", "application/pdf"];

  // 1. Check file type (MIME type)
  if (!allowedTypes.includes(file.type as AllowedFileType)) {
    return {
      type: "FILE_TYPE_INVALID",
      message: "Only JPEG, PNG, and PDF files are allowed",
      severity: "error",
    };
  }

  // 2. Check file size (5MB hard limit)
  const maxSize = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > maxSize) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    return {
      type: "FILE_SIZE_EXCEEDED",
      message: `File size (${sizeMB}MB) exceeds 5MB limit`,
      severity: "error",
    };
  }

  // 3. Validate magic number (file header)
  const isValid = await validateFileContent(file);
  if (!isValid) {
    return {
      type: "FILE_CONTENT_INVALID",
      message: "File appears corrupted or tampered with",
      severity: "error",
    };
  }

  return null; // Valid file
}
