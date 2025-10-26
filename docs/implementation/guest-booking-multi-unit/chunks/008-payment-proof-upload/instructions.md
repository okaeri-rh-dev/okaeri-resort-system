# Implementation Instructions: Payment Proof Upload

Follow these steps to implement secure payment proof file upload with client-side compression and magic number validation.

**Total Time**: ~90 minutes

---

## Step 1: Setup Supabase Storage (15 minutes)

### 1.1 Create Storage Bucket

**Via Supabase Dashboard:**

1. Navigate to: `https://app.supabase.com/project/<your-project>/storage/buckets`
2. Click **"New bucket"**
3. Configure bucket:
   - **Name**: `booking-files`
   - **Public bucket**: ❌ **Unchecked** (private bucket)
   - **File size limit**: 5MB
   - **Allowed MIME types**: Leave empty (we validate in code)
4. Click **"Create bucket"**

**Via Supabase CLI (Alternative):**

```bash
# Create private bucket
supabase storage create booking-files --private

# Set file size limit (optional)
supabase storage update booking-files --file-size-limit 5242880
```

### 1.2 Configure RLS Policies

**Create policy for signed URL uploads:**

```sql
-- Allow uploads via signed URLs
CREATE POLICY "Allow signed uploads"
ON storage.objects
FOR INSERT
TO authenticated, anon
WITH CHECK (
  bucket_id = 'booking-files'
  AND (storage.foldername(name))[1] = 'payment-proofs'
);

-- Allow authenticated users to read their own files (for admin)
CREATE POLICY "Allow authenticated read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'booking-files');
```

**Execute in Supabase SQL Editor:**

1. Go to: `https://app.supabase.com/project/<your-project>/sql/new`
2. Paste SQL above
3. Click **"Run"**

### 1.3 Verify Bucket Configuration

```bash
# Test signed URL generation (requires upload-url endpoint from Chunk 004)
curl -X POST http://localhost:5173/api/guest-booking/upload-url \
  -H "Content-Type: application/json" \
  -d '{
    "booking_reference": "BK-TEST-001",
    "file_name": "test-receipt.jpg",
    "file_type": "image/jpeg",
    "file_size": 1048576
  }'

# Expected output:
# {
#   "success": true,
#   "upload_url": "https://<project>.supabase.co/storage/v1/upload/sign/...",
#   "file_path": "payment-proofs/BK-TEST-001_1234567890.jpg",
#   "expires_in": 300
# }
```

**If error "Bucket not found"**: Verify bucket name is exactly `booking-files`
**If error "Permission denied"**: Check RLS policies created correctly

✅ **Checkpoint**: Signed URL generation endpoint returns valid URL

---

## Step 2: Create File Validation Utilities (20 minutes)

### 2.1 Create `file-validation.ts`

**File**: `src/lib/file-validation.ts`

```typescript
/**
 * File validation utilities for payment proof uploads
 * Implements magic number validation and client-side image compression
 */

/**
 * Magic number signatures for supported file types
 * These are the first few bytes of each file format's header
 */
export const MAGIC_NUMBERS = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "application/pdf": [0x25, 0x50, 0x44, 0x46], // %PDF
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
 * This prevents MIME type spoofing attacks
 *
 * @param file - File to validate
 * @returns Promise<boolean> - true if magic number matches MIME type
 */
export async function validateFileContent(file: File): Promise<boolean> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
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
 * Targets ~2MB for optimal upload speed while maintaining quality
 *
 * @param file - Image file to compress (JPEG/PNG)
 * @returns Promise<CompressedFileResult> - Compressed file with metadata
 */
export async function compressImage(file: File): Promise<CompressedFileResult> {
  const originalSize = file.size;

  // Skip compression for PDFs
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
        // Maintain original dimensions
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        let quality = 0.9; // Start with high quality

        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Canvas toBlob failed"));
                return;
              }

              // Success conditions:
              // 1. File size under target, OR
              // 2. Quality reduced to minimum threshold (0.5)
              if (blob.size <= targetSize || quality <= 0.5) {
                resolve(new File([blob], file.name, { type: "image/jpeg" }));
              } else {
                quality -= 0.1; // Reduce quality by 10%
                tryCompress(); // Retry
              }
            },
            "image/jpeg",
            quality
          );
        };

        tryCompress();
      };

      img.onerror = () => reject(new Error("Image load failed"));
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

    // Fallback: Return uncompressed if under 5MB
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
 * @returns string - Formatted size (e.g., "2.5 MB")
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
 * Checks type, size, and content (magic number)
 *
 * @param file - File to validate
 * @returns Promise<FileValidationError | null> - Error object or null if valid
 */
export async function validateFile(file: File): Promise<FileValidationError | null> {
  const allowedTypes: AllowedFileType[] = ["image/jpeg", "image/png", "application/pdf"];

  // 1. Check file type
  if (!allowedTypes.includes(file.type as AllowedFileType)) {
    return {
      type: "FILE_TYPE_INVALID",
      message: "Only JPEG, PNG, and PDF files are allowed",
      severity: "error",
    };
  }

  // 2. Check file size (5MB hard limit)
  const maxSize = 5 * 1024 * 1024;
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
```

### 2.2 Verify File Validation

```bash
# Type-check the new file
npm run type-check

# Expected: No errors in src/lib/file-validation.ts
```

✅ **Checkpoint**: File validation utilities compile without errors

---

## Step 3: Build PaymentProofUpload Component (30 minutes)

### 3.1 Create Component File

**File**: `src/components/guest-booking/PaymentProofUpload.tsx`

```typescript
import { useCallback, useState } from 'react';

import { AlertCircle, CheckCircle, FileImage, FileText, Loader2, Upload, X } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  compressImage,
  formatFileSize,
  validateFile,
  type FileValidationError,
} from '@/lib/file-validation';

interface PaymentProofUploadProps {
  bookingReference: string; // For file path naming
  onUploadComplete: (filePath: string) => void;
  onUploadError?: (error: string) => void;
  disabled?: boolean;
}

export function PaymentProofUpload({
  bookingReference,
  onUploadComplete,
  onUploadError,
  disabled,
}: PaymentProofUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<FileValidationError | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<{
    originalSize: number;
    compressedSize: number;
    ratio: number;
  } | null>(null);

  // Handle file selection (click or drag-and-drop)
  const handleFileSelect = useCallback(
    async (file: File) => {
      setError(null);
      setIsValidating(true);
      setCompressionInfo(null);

      try {
        // 1. Validate file (type, size, magic number)
        const validationError = await validateFile(file);
        if (validationError) {
          setError(validationError);
          setIsValidating(false);
          return;
        }

        // 2. Compress image if needed
        const result = await compressImage(file);

        if (result.wasCompressed) {
          setCompressionInfo({
            originalSize: result.originalSize,
            compressedSize: result.compressedSize,
            ratio: result.compressionRatio,
          });
        }

        // 3. Set file for upload
        setSelectedFile(result.file);
        setError(null);
      } catch (err) {
        console.error('[UPLOAD] File validation error:', err);
        setError({
          type: 'VALIDATION_FAILED',
          message: 'Failed to validate file. Please try again.',
          severity: 'error',
        });
      } finally {
        setIsValidating(false);
      }
    },
    []
  );

  // Handle file input change
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag-and-drop
  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const file = event.dataTransfer.files?.[0];
      if (file && !disabled) {
        handleFileSelect(file);
      }
    },
    [disabled, handleFileSelect]
  );

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  // Upload file to Supabase Storage
  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Step 1: Get signed upload URL from API
      const urlResponse = await fetch('/api/guest-booking/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_reference: bookingReference,
          file_name: selectedFile.name,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
        }),
      });

      if (!urlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const urlData = await urlResponse.json();

      if (!urlData.success) {
        throw new Error(urlData.error || 'Upload URL generation failed');
      }

      const { upload_url, file_path } = urlData;

      // Step 2: Upload file to signed URL using XMLHttpRequest (for progress tracking)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentage = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percentage);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        xhr.open('PUT', upload_url);
        xhr.setRequestHeader('Content-Type', selectedFile.type);
        xhr.send(selectedFile);
      });

      // Step 3: Success - store file path
      setUploadedFilePath(file_path);
      onUploadComplete(file_path);
    } catch (err) {
      console.error('[UPLOAD] Upload error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError({
        type: 'VALIDATION_FAILED',
        message: errorMessage,
        severity: 'error',
      });
      onUploadError?.(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Remove selected file
  const handleRemove = () => {
    setSelectedFile(null);
    setUploadedFilePath(null);
    setError(null);
    setCompressionInfo(null);
  };

  // Render uploaded file preview
  const renderPreview = () => {
    if (!uploadedFilePath) return null;

    const isImage = selectedFile?.type.startsWith('image/');

    return (
      <Card className="mt-4">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {isImage ? (
              <FileImage className="h-8 w-8 text-green-600" />
            ) : (
              <FileText className="h-8 w-8 text-green-600" />
            )}
            <div>
              <p className="font-medium text-sm">{selectedFile?.name}</p>
              <p className="text-muted-foreground text-xs">
                {formatFileSize(selectedFile?.size || 0)}
                {compressionInfo && (
                  <span className="ml-2 text-green-600">
                    (Compressed by {compressionInfo.ratio.toFixed(0)}%)
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <Button variant="ghost" size="icon" onClick={handleRemove} disabled={disabled}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Upload Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {/* File uploaded - show preview */}
      {uploadedFilePath ? (
        renderPreview()
      ) : (
        <>
          {/* Drag-and-Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className={`
              rounded-lg border-2 border-dashed p-8 text-center transition-colors
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary'}
              ${selectedFile ? 'border-green-500 bg-green-50' : 'border-gray-300'}
            `}
          >
            {isValidating ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Validating file...</p>
              </div>
            ) : selectedFile ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2">
                  {selectedFile.type.startsWith('image/') ? (
                    <FileImage className="h-8 w-8 text-green-600" />
                  ) : (
                    <FileText className="h-8 w-8 text-green-600" />
                  )}
                  <div className="text-left">
                    <p className="font-medium text-sm">{selectedFile.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatFileSize(selectedFile.size)}
                      {compressionInfo && (
                        <span className="ml-2 text-green-600">
                          Compressed from {formatFileSize(compressionInfo.originalSize)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {compressionInfo && (
                  <Alert>
                    <AlertDescription className="text-xs">
                      Image compressed by {compressionInfo.ratio.toFixed(0)}% for faster upload
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleUpload} disabled={isUploading || disabled}>
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading... {uploadProgress}%
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleRemove} disabled={isUploading || disabled}>
                    <X className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </div>

                {isUploading && (
                  <Progress value={uploadProgress} className="w-full" />
                )}
              </div>
            ) : (
              <label htmlFor="file-input" className="cursor-pointer">
                <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="mb-2 text-sm font-medium">Drop payment proof here or click to browse</p>
                <p className="text-muted-foreground text-xs">JPEG, PNG, or PDF (max 5MB)</p>
                <input
                  id="file-input"
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={handleInputChange}
                  className="hidden"
                  disabled={disabled}
                />
              </label>
            )}
          </div>

          {/* Info Alert */}
          {!selectedFile && !error && (
            <Alert>
              <AlertDescription className="text-xs">
                Upload a screenshot or photo of your payment (bank transfer, GCash, etc.). Images are
                automatically compressed for faster upload.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
```

### 3.2 Export Component

**File**: `src/components/guest-booking/index.ts` (create if doesn't exist)

```typescript
export { PaymentProofUpload } from "./PaymentProofUpload";
export { PaymentSummary } from "./PaymentSummary";
export { UnitRequestCard } from "./UnitRequestCard";
export { UnitRequestSelector } from "./UnitRequestSelector";
```

### 3.3 Verify Component

```bash
# Type-check
npm run type-check

# Expected: No errors in PaymentProofUpload.tsx
```

✅ **Checkpoint**: Component compiles without TypeScript errors

---

## Step 4: Integrate with Booking Form (15 minutes)

### 4.1 Update Form Schema

**File**: `src/types/guest-booking-multi-unit.ts` (add to existing schema)

```typescript
import { z } from "zod";

// ... existing imports and types ...

// Extend booking schema with payment proof
export const multiUnitBookingSchema = z.object({
  // ... existing fields ...
  payment_proof_url: z.string().min(1, "Payment proof is required").optional(),
});
// ... existing refinements ...
```

### 4.2 Add to Booking Form

**File**: `src/components/guest-booking/MultiUnitGuestBookingForm.tsx`

```typescript
import { PaymentProofUpload } from './PaymentProofUpload';

// Inside form component
export function MultiUnitGuestBookingForm() {
  // ... existing state ...
  const [bookingReference] = useState(() => generateTempBookingRef()); // Generate temp ref

  const form = useForm<MultiUnitBookingRequest>({
    // ... existing config ...
    defaultValues: {
      // ... existing defaults ...
      payment_proof_url: '',
    },
  });

  const handleUploadComplete = (filePath: string) => {
    form.setValue('payment_proof_url', filePath);
  };

  const handleUploadError = (error: string) => {
    console.error('[FORM] Upload error:', error);
    // Optional: Show toast notification
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* ... existing form fields ... */}

        {/* Payment Proof Upload (after Payment Summary) */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Payment Proof</h2>
          <FormField
            control={form.control}
            name="payment_proof_url"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <PaymentProofUpload
                    bookingReference={bookingReference}
                    onUploadComplete={handleUploadComplete}
                    onUploadError={handleUploadError}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ... existing submit button ... */}
      </form>
    </Form>
  );
}

// Helper: Generate temporary booking reference for file upload
// (Final reference generated server-side at booking creation)
function generateTempBookingRef(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BK-TEMP-${timestamp}-${random}`;
}
```

### 4.3 Test Form Integration

```bash
# Start dev server
npm run dev

# Open browser to booking form
# Test:
# 1. Form renders PaymentProofUpload component
# 2. Upload component appears after Payment Summary section
# 3. Component is disabled when form is submitting
```

✅ **Checkpoint**: Upload component integrated into booking form

---

## Step 5: Testing & Verification (10 minutes)

### 5.1 Test File Upload Workflow

**Test Case 1: JPEG Upload**

1. Open booking form in browser
2. Drag a JPEG image (>2MB) into drop zone
3. Verify:
   - ✅ "Validating file..." message appears
   - ✅ Compression info shows (e.g., "Compressed by 45%")
   - ✅ File size shown as reduced
   - ✅ "Upload" button enabled

**Test Case 2: File Size Validation**

1. Select a 6MB image
2. Verify:
   - ✅ Error: "File size (6.00MB) exceeds 5MB limit"
   - ✅ File not uploaded

**Test Case 3: Magic Number Validation**

1. Rename a `.txt` file to `.jpg`
2. Try to upload
3. Verify:
   - ✅ Error: "File appears corrupted or tampered with"
   - ✅ Upload blocked

**Test Case 4: Upload Progress**

1. Select a 2MB image
2. Click "Upload"
3. Verify:
   - ✅ Progress bar appears
   - ✅ Percentage increases (0% → 100%)
   - ✅ "Uploading... X%" message shows
   - ✅ Success state with green checkmark after upload

**Test Case 5: PDF Upload**

1. Select a PDF file (<5MB)
2. Verify:
   - ✅ Validation passes
   - ✅ No compression (PDFs not compressed)
   - ✅ Upload succeeds
   - ✅ PDF icon shown instead of image icon

### 5.2 Verify Supabase Storage

```bash
# Check uploaded file exists in Supabase
# Navigate to: Storage > booking-files > payment-proofs
# Verify: File appears with correct naming pattern

# Test signed URL download (optional)
# In Supabase dashboard, click file > "Get signed URL"
# Paste URL in browser
# Verify: File downloads correctly
```

### 5.3 Test Error Scenarios

**Network Error:**

1. Disable network in DevTools
2. Try to upload file
3. Verify:
   - ✅ Error: "Upload failed. Please check your connection and try again"
   - ✅ User can retry after re-enabling network

**Signed URL Expiry:**

1. Get signed URL
2. Wait 6 minutes (past 5-minute expiry)
3. Try to upload
4. Verify:
   - ✅ Error displayed
   - ✅ User can retry (new signed URL generated)

### 5.4 Run Automated Tests (Optional)

**Create test file**: `src/lib/__tests__/file-validation.test.ts`

```typescript
import { beforeEach, describe, expect, it } from "vitest";

import { formatFileSize, MAGIC_NUMBERS, validateFileContent } from "../file-validation";

describe("file-validation", () => {
  describe("validateFileContent", () => {
    it("should validate JPEG magic number", async () => {
      // Create mock JPEG file
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const file = new File([jpegBytes], "test.jpg", { type: "image/jpeg" });

      const isValid = await validateFileContent(file);
      expect(isValid).toBe(true);
    });

    it("should reject invalid magic number", async () => {
      // Create mock file with wrong header
      const invalidBytes = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      const file = new File([invalidBytes], "test.jpg", { type: "image/jpeg" });

      const isValid = await validateFileContent(file);
      expect(isValid).toBe(false);
    });
  });

  describe("formatFileSize", () => {
    it("should format bytes correctly", () => {
      expect(formatFileSize(0)).toBe("0 Bytes");
      expect(formatFileSize(1024)).toBe("1 KB");
      expect(formatFileSize(1048576)).toBe("1 MB");
      expect(formatFileSize(2560000)).toBe("2.44 MB");
    });
  });
});
```

```bash
# Run tests
npm run test:run src/lib/__tests__/file-validation.test.ts

# Expected: All tests pass
```

---

## Done! ✅

You've successfully implemented secure payment proof upload with:

- ✅ Magic number validation (prevents file spoofing)
- ✅ Client-side image compression (~2MB target)
- ✅ Server-side 5MB hard limit enforcement
- ✅ Drag-and-drop interface
- ✅ Upload progress tracking
- ✅ Private Supabase Storage integration
- ✅ Comprehensive error handling

### Next Steps

**Commit your changes:**

```bash
git add src/lib/file-validation.ts
git add src/components/guest-booking/PaymentProofUpload.tsx
git add src/types/guest-booking-multi-unit.ts
git add src/components/guest-booking/MultiUnitGuestBookingForm.tsx

git commit -m "feat: implement payment proof upload with client compression

- Add magic number validation for JPEG/PNG/PDF
- Implement Canvas API image compression (~2MB target)
- Create PaymentProofUpload component with drag-and-drop
- Add upload progress tracking
- Integrate with Supabase Storage (private bucket)
- Add comprehensive error handling
- Implement file size and type validation

Completes chunk 008-payment-proof-upload"
```

**Proceed to Checkpoint:**

- Run verification steps in `checkpoint.md`
- Ensure all success criteria met
- Mark chunk as complete

**Ready for Chunk 009:**

- Form Validation and Submission
- Will include `payment_proof_url` in booking payload
- Server validates file exists before creating booking

---

**Troubleshooting?** See `troubleshooting.md` for common issues and solutions.
