import imageCompression from "browser-image-compression";

/**
 * Compress and validate file for upload
 * - Converts HEIC/HEIF to JPEG (iOS compatibility)
 * - Compresses images > 500KB
 * - Enforces 2MB max size (free tier bandwidth optimization)
 * - Validates MIME types
 */
export async function compressAndValidateFile(file: File): Promise<File> {
  // Step 1: Convert HEIC/HEIF to JPEG (iOS photos) with lazy loading
  if (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif")
  ) {
    try {
      // Lazy load heic2any only when needed (reduces main bundle size by ~300KB)
      const heic2any = (await import(/* webpackChunkName: "heic2any" */ "heic2any")).default;
      const convertedBlob = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.9,
      });

      // Handle array of blobs (heic2any can return multiple)
      const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

      file = new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
        type: "image/jpeg",
      });
    } catch (error) {
      console.error("HEIC conversion failed:", error);
      throw new Error("Failed to convert HEIC image. Please use JPG or PNG format.");
    }
  }

  // Step 2: Validate file type
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`File type ${file.type} not allowed. Please use JPG, PNG, WebP, or PDF.`);
  }

  // Step 3: Compress images if > 500KB using Web Worker (non-blocking)
  if (file.type.startsWith("image/") && file.size > 500_000) {
    try {
      file = await imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 1920,
        useWebWorker: true, // Offloads compression to Web Worker (prevents UI jank)
        fileType: file.type as "image/jpeg" | "image/png" | "image/webp",
        initialQuality: 0.9,
        maxIteration: 10, // Adjust quality up to 10 times to hit target size
      });
    } catch (error) {
      console.error("Compression failed:", error);
      throw new Error("Failed to compress image. Please try a smaller file.");
    }
  }

  // Step 4: Enforce 2MB limit (free tier bandwidth optimization)
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("File size must be less than 2MB after compression.");
  }

  return file;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Alias for compressAndValidateFile for backward compatibility
 */
export const compressImage = compressAndValidateFile;
