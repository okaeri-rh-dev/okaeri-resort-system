import { supabase } from "./supabase";

/**
 * Secure file upload module with server-side validation
 * Implements security best practices for file handling
 */

// Configuration constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg"];
const ALLOWED_DOCUMENT_TYPES = ["application/pdf"];

// File validation errors
export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

/**
 * Validate file size
 */
function validateFileSize(file: File, maxSize: number = MAX_FILE_SIZE): void {
  if (file.size > maxSize) {
    throw new FileValidationError(
      `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(maxSize)})`
    );
  }
}

/**
 * Validate file type
 */
function validateFileType(file: File, allowedTypes: string[]): void {
  if (!allowedTypes.includes(file.type)) {
    throw new FileValidationError(
      `File type '${file.type}' is not allowed. Allowed types: ${allowedTypes.join(", ")}`
    );
  }
}

/**
 * Validate file extension matches MIME type (prevent spoofing)
 */
function validateFileExtension(file: File): void {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (!extension) {
    throw new FileValidationError("File must have an extension");
  }

  const mimeToExtension: Record<string, string[]> = {
    "image/png": ["png"],
    "image/jpeg": ["jpg", "jpeg"],
    "application/pdf": ["pdf"],
  };

  const allowedExtensions = mimeToExtension[file.type];

  if (!allowedExtensions || !allowedExtensions.includes(extension)) {
    throw new FileValidationError(
      `File extension '.${extension}' does not match file type '${file.type}'`
    );
  }
}

/**
 * Sanitize filename to prevent path traversal attacks
 */
function sanitizeFilename(filename: string): string {
  // Remove any path components
  const name = filename.replace(/^.*[\\/]/, "");

  // Remove special characters, keep only alphanumeric, dots, hyphens, and underscores
  const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, "_");

  // Prevent hidden files
  if (sanitized.startsWith(".")) {
    return sanitized.substring(1);
  }

  return sanitized;
}

/**
 * Generate secure file path
 */
function generateSecureFilePath(file: File, bucket: string, prefix?: string): string {
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "bin";
  const timestamp = Date.now();
  const randomId = crypto.randomUUID().split("-")[0];
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");

  // Create a secure filename
  const secureFilename = `${timestamp}_${randomId}.${fileExt}`;

  // Organize by year and month for better management
  const basePath = prefix || bucket;
  return `${basePath}/${year}/${month}/${secureFilename}`;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Upload payment proof with validation
 */
export async function uploadPaymentProof(
  file: File,
  bookingId: string
): Promise<{ path: string; url: string }> {
  // Perform all validations
  validateFileSize(file);
  validateFileType(file, ALLOWED_IMAGE_TYPES);
  validateFileExtension(file);

  const filePath = generateSecureFilePath(file, "payment-proofs", `bookings/${bookingId}`);

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage.from("payment-proofs").upload(filePath, file, {
    cacheControl: "3600",
    upsert: false, // Prevent overwriting existing files
    contentType: file.type,
  });

  if (error) {
    if (error.message.includes("already exists")) {
      throw new Error("A file with this name already exists. Please rename your file.");
    }
    throw error;
  }

  // Get public URL (requires proper bucket policies)
  const {
    data: { publicUrl },
  } = supabase.storage.from("payment-proofs").getPublicUrl(filePath);

  return {
    path: data.path,
    url: publicUrl,
  };
}

/**
 * Upload receipt with validation
 */
export async function uploadReceipt(
  file: File,
  expenseId: string
): Promise<{ path: string; url: string }> {
  // Allow both images and PDFs for receipts
  const allowedTypes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];

  validateFileSize(file);
  validateFileType(file, allowedTypes);
  validateFileExtension(file);

  const filePath = generateSecureFilePath(file, "receipts", `expenses/${expenseId}`);

  const { data, error } = await supabase.storage.from("receipts").upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    if (error.message.includes("already exists")) {
      throw new Error("A file with this name already exists. Please rename your file.");
    }
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("receipts").getPublicUrl(filePath);

  return {
    path: data.path,
    url: publicUrl,
  };
}

/**
 * Delete file from storage
 */
export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    throw error;
  }
}

/**
 * Get signed URL for private file access
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);

  if (error) {
    throw error;
  }

  if (!data?.signedUrl) {
    throw new Error("Failed to generate signed URL");
  }

  return data.signedUrl;
}

/**
 * List files in a specific path
 */
export async function listFiles(bucket: string, path: string): Promise<any[]> {
  const { data, error } = await supabase.storage.from(bucket).list(path, {
    limit: 100,
    offset: 0,
  });

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Check if file exists
 */
export async function fileExists(bucket: string, path: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path);

    return !error && !!data;
  } catch {
    return false;
  }
}

/**
 * Validate and prepare multiple files for batch upload
 */
export function validateBatchFiles(files: File[], maxFiles: number = 10): File[] {
  if (files.length > maxFiles) {
    throw new FileValidationError(`Cannot upload more than ${maxFiles} files at once`);
  }

  const validatedFiles: File[] = [];

  for (const file of files) {
    validateFileSize(file);
    validateFileType(file, ALLOWED_IMAGE_TYPES);
    validateFileExtension(file);
    validatedFiles.push(file);
  }

  return validatedFiles;
}

// Export validation functions for use in components
export const fileValidation = {
  validateFileSize,
  validateFileType,
  validateFileExtension,
  sanitizeFilename,
  formatFileSize,
};

// Export storage operations
export const storage = {
  uploadPaymentProof,
  uploadReceipt,
  deleteFile,
  getSignedUrl,
  listFiles,
  fileExists,
  validateBatchFiles,
};
