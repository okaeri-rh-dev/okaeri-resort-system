/**
 * Client-side file validation utilities for payment proof uploads
 *
 * Implements two-tier security strategy:
 * 1. Magic number validation (prevents MIME type spoofing)
 * 2. Client-side image shrinking (reduces upload time and storage)
 *
 * @module file-validation-client
 * @see vault note [[008-payment-proof-upload README]]
 */

import type { Options } from "browser-image-compression";

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

// Matches the server limit in functions/api/guest-booking/upload-url.ts.
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const SHRINKABLE_TYPES = ["image/jpeg", "image/jpg", "image/png"];

/**
 * Validation error types for structured error handling
 */
export interface FileValidationError {
  type: "FILE_TYPE_INVALID" | "FILE_SIZE_EXCEEDED" | "FILE_CONTENT_INVALID" | "VALIDATION_FAILED";
  message: string;
  severity: "error" | "warning" | "info";
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

/** Compress an image on the main thread. The library's web worker loads from a CDN, which the CSP blocks. */
export async function compressImage(
  file: File,
  options: Omit<Options, "useWebWorker">
): Promise<File> {
  const { default: imageCompression } = await import("browser-image-compression");
  return imageCompression(file, { ...options, useWebWorker: false });
}

/**
 * Shrink a JPEG or PNG to a JPEG with a 1600 px long edge and about 300 KB, so that
 * receipt text stays readable at a small stored size.
 *
 * @returns The shrunk image, or the original file for a PDF, on failure, or when shrinking does not help
 */
export async function shrinkImage(file: File): Promise<File> {
  if (!SHRINKABLE_TYPES.includes(file.type)) return file;

  try {
    const shrunk = await compressImage(file, {
      maxWidthOrHeight: 1600,
      maxSizeMB: 0.3,
      fileType: "image/jpeg",
    });
    if (shrunk.size >= file.size) return file;
    return new File([shrunk], `${file.name.replace(/\.[^.]*$/, "")}.jpg`, { type: "image/jpeg" });
  } catch (error) {
    console.warn("[FILE_VALIDATION] Image shrink failed, using the original file:", error);
    return file;
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
  if (file.size > MAX_UPLOAD_SIZE) {
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

/**
 * Shrink an image of up to 10MB, then validate the file that will be uploaded.
 * PDFs are not shrunk, so they must already be under 5MB.
 *
 * @returns The file to upload, or the reason it was rejected
 */
export async function shrinkAndValidate(file: File): Promise<File | FileValidationError> {
  const isImage = SHRINKABLE_TYPES.includes(file.type);
  if (isImage && file.size > MAX_IMAGE_SIZE) {
    return {
      type: "FILE_SIZE_EXCEEDED",
      message: "Images can be up to 10MB. Choose a smaller image.",
      severity: "error",
    };
  }

  const shrunk = await shrinkImage(file);
  if (isImage && shrunk === file && file.size > MAX_UPLOAD_SIZE) {
    return {
      type: "FILE_SIZE_EXCEEDED",
      message: "We couldn't make this image smaller. Choose an image under 5MB.",
      severity: "error",
    };
  }

  return (await validateFile(shrunk)) ?? shrunk;
}
