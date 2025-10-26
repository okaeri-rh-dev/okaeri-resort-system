# Troubleshooting: Payment Proof Upload

Common issues and solutions for chunk 008 implementation.

---

## File Upload Failed

### Symptom

Upload button shows error: "Upload failed. Please check your connection and try again"

### Possible Causes & Solutions

#### 1. Supabase Bucket Doesn't Exist

**Check:**

```bash
supabase storage list
```

**Fix:**

```bash
# Create bucket
supabase storage create booking-files --private

# OR via Supabase Dashboard:
# Storage > New bucket > name: "booking-files", private: checked
```

---

#### 2. RLS Policies Not Configured

**Check:**

```sql
-- In Supabase SQL Editor
SELECT * FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%signed%';
```

**Fix:**

```sql
-- Create policy for signed URL uploads
CREATE POLICY "Allow signed uploads"
ON storage.objects
FOR INSERT
TO authenticated, anon
WITH CHECK (
  bucket_id = 'booking-files'
  AND (storage.foldername(name))[1] = 'payment-proofs'
);
```

**Verify:**

- Go to: Storage > booking-files > Policies
- Should see "Allow signed uploads" policy listed

---

#### 3. CORS Configuration Issues

**Symptom:**
Browser console shows: `CORS policy: No 'Access-Control-Allow-Origin' header`

**Check:**

```bash
# In browser DevTools > Network tab
# Look for preflight OPTIONS request
# Check response headers
```

**Fix:**

Update Supabase Storage CORS settings:

```bash
# Via Supabase CLI
supabase storage update booking-files \
  --cors '{"allowedOrigins": ["http://localhost:5173", "https://your-domain.com"], "allowedMethods": ["GET", "POST", "PUT"]}'
```

**OR via Dashboard:**

1. Storage > booking-files > Settings
2. CORS configuration:
   ```json
   {
     "allowedOrigins": ["http://localhost:5173", "https://your-domain.com"],
     "allowedMethods": ["GET", "POST", "PUT"],
     "allowedHeaders": ["*"]
   }
   ```

---

#### 4. Signed URL Expired

**Symptom:**
Error: "Upload failed" after waiting >5 minutes

**Explanation:**
Signed URLs expire after 5 minutes (security feature)

**Fix:**

- User should retry upload (new signed URL generated)
- No code changes needed
- Consider adding "Expired - please retry" message

**Code Enhancement (Optional):**

```typescript
// Add expiry timer warning
const [expiryTime, setExpiryTime] = useState<number | null>(null);

// When signed URL received
setExpiryTime(Date.now() + 300000); // 5 minutes

// Show warning at 4 minutes
useEffect(() => {
  if (!expiryTime) return;

  const warningTimer = setTimeout(() => {
    toast.warning("Upload URL expiring soon. Please upload now.");
  }, 240000); // 4 minutes

  return () => clearTimeout(warningTimer);
}, [expiryTime]);
```

---

#### 5. Upload Endpoint Not Working

**Check endpoint:**

```bash
curl -X POST http://localhost:5173/api/guest-booking/upload-url \
  -H "Content-Type: application/json" \
  -d '{
    "booking_reference": "BK-TEST",
    "file_name": "test.jpg",
    "file_type": "image/jpeg",
    "file_size": 1024
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "upload_url": "https://...",
  "file_path": "payment-proofs/BK-TEST_...",
  "expires_in": 300
}
```

**If 404 Error:**

- Verify endpoint file exists: `functions/api/guest-booking/upload-url.ts`
- Check Cloudflare Pages deployment
- Verify wrangler.toml routes configuration

**If 500 Error:**

- Check server logs for error details
- Verify Supabase credentials in environment variables
- Test Supabase connection: `supabase.storage.from('booking-files').list()`

---

## Image Compression Failed

### Symptom

Error: "Image compression failed. Try a smaller file"

### Possible Causes & Solutions

#### 1. Canvas API Not Supported

**Check:**

```javascript
// In browser console
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
console.log(ctx ? "Supported ✓" : "NOT supported ✗");
```

**Fix:**

- Canvas API supported in all modern browsers
- If user on very old browser, fallback should trigger automatically
- Fallback: Upload uncompressed file if <5MB

**Verify Fallback Code:**

```typescript
// In compressImage() catch block
if (file.size <= 5 * 1024 * 1024) {
  console.warn("Using uncompressed file (compression failed)");
  return {
    file,
    originalSize: file.size,
    compressedSize: file.size,
    compressionRatio: 0,
    wasCompressed: false,
  };
}
```

---

#### 2. Image Load Failed

**Symptom:**
Console error: "Image load failed"

**Causes:**

- Corrupted image file
- Invalid image format
- Browser security restrictions

**Fix:**

```typescript
// Add better error handling in compressImage()
img.onerror = (error) => {
  console.error("[COMPRESSION] Image load error:", error);
  reject(new Error("Image load failed. File may be corrupted."));
};
```

**User Action:**

- Try a different image file
- Ensure image is valid JPEG/PNG
- Re-download or re-screenshot image

---

#### 3. Out of Memory (Very Large Images)

**Symptom:**
Browser tab crashes or freezes during compression

**Cause:**
Extremely large images (>20MB, >10000px dimensions)

**Fix:**

Add dimension check before compression:

```typescript
// In compressImage(), after image loads
const MAX_DIMENSION = 8000; // pixels

if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
  // Resize to max dimension first
  const scale = MAX_DIMENSION / Math.max(img.width, img.height);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
} else {
  canvas.width = img.width;
  canvas.height = img.height;
}
```

**Prevention:**

- Client-side dimension check before compression
- Reject images >8000px width/height
- Show error: "Image dimensions too large. Please resize image."

---

## Magic Number Validation Failed

### Symptom

Error: "File appears corrupted or tampered with"

### Possible Causes & Solutions

#### 1. File Actually Corrupted

**Verify:**

```bash
# Check file with `file` command (macOS/Linux)
file suspicious-image.jpg

# Expected output for JPEG:
# suspicious-image.jpg: JPEG image data, JFIF standard

# If output says "data" or "ASCII text", file is not a real JPEG
```

**Fix:**

- User should re-download or re-screenshot
- Ensure original file is valid image

---

#### 2. File Extension Doesn't Match Content

**Example:**
User renamed `document.txt` to `document.jpg`

**Detection:**
Magic number check catches this (working as intended)

**User Action:**

- Use a real JPEG/PNG/PDF file
- Don't rename files to bypass validation

**Developer Action:**
None needed - this is correct behavior

---

#### 3. Incorrect Magic Number Constants

**Verify:**

```typescript
// In file-validation.ts
export const MAGIC_NUMBERS = {
  "image/jpeg": [0xff, 0xd8, 0xff], // Correct
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // Correct
  "application/pdf": [0x25, 0x50, 0x44, 0x46], // Correct (%PDF)
};
```

**Test:**

```bash
# JPEG magic number
xxd -l 10 test-image.jpg
# Should start with: ff d8 ff

# PNG magic number
xxd -l 10 test-image.png
# Should start with: 89 50 4e 47 0d 0a 1a 0a

# PDF magic number
xxd -l 10 test.pdf
# Should start with: 25 50 44 46 (%PDF in ASCII)
```

---

#### 4. MIME Type Mismatch

**Symptom:**
File uploads via other means but fails magic number check

**Cause:**
Browser reported wrong MIME type

**Debug:**

```typescript
// Add logging in validateFileContent()
console.log("[VALIDATION] File type:", file.type);
console.log("[VALIDATION] Expected magic:", magic);
console.log("[VALIDATION] Actual bytes:", Array.from(bytes.slice(0, 8)));
```

**Fix:**

- Ensure file.type matches file content
- Browser should set correct MIME type based on extension
- If mismatch, file is likely incorrectly renamed

---

## File Size Validation Issues

### Symptom

Files rejected despite being <5MB

### Possible Causes & Solutions

#### 1. Size Reported Incorrectly

**Check:**

```typescript
// Log actual file size
console.log("[VALIDATION] File size:", file.size, "bytes");
console.log("[VALIDATION] File size MB:", (file.size / 1024 / 1024).toFixed(2));
```

**Compare to system file size:**

```bash
# macOS/Linux
ls -lh payment-proof.jpg

# Windows
dir payment-proof.jpg
```

---

#### 2. Size Limit Calculation Error

**Verify:**

```typescript
// In validateFile()
const maxSize = 5 * 1024 * 1024; // 5,242,880 bytes = 5MB
console.log("[VALIDATION] Max size:", maxSize);
```

**Common Mistake:**

```typescript
// WRONG - this is 5,000 bytes, not 5MB
const maxSize = 5 * 1000 * 1000; // Don't use decimal multipliers

// CORRECT - binary multipliers (1024)
const maxSize = 5 * 1024 * 1024;
```

---

## TypeScript Errors

### Error: `Cannot find module '@/lib/file-validation'`

**Cause:**
File not created or path alias not configured

**Fix:**

```bash
# Verify file exists
ls src/lib/file-validation.ts

# Check tsconfig.json path alias
cat tsconfig.json | grep '@'
```

**Expected in tsconfig.json:**

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

### Error: `Property 'toBlob' does not exist on type 'HTMLCanvasElement'`

**Cause:**
TypeScript lib doesn't include Canvas API types

**Fix:**

Add to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  }
}
```

---

### Error: `Type 'string' is not assignable to type 'AllowedFileType'`

**Cause:**
File type string not typed as `AllowedFileType`

**Fix:**

```typescript
// Cast to AllowedFileType
const magic = MAGIC_NUMBERS[file.type as AllowedFileType];

// OR type guard
if (!(file.type in MAGIC_NUMBERS)) {
  return false;
}
```

---

## Upload Progress Not Showing

### Symptom

Progress bar stuck at 0% or doesn't appear

### Solutions

#### 1. Using Fetch Instead of XMLHttpRequest

**Problem:**
Fetch API doesn't support upload progress tracking

**Fix:**
Use XMLHttpRequest (as in instructions):

```typescript
// WRONG - no progress tracking
await fetch(upload_url, {
  method: "PUT",
  body: selectedFile,
});

// CORRECT - with progress tracking
const xhr = new XMLHttpRequest();
xhr.upload.addEventListener("progress", (event) => {
  if (event.lengthComputable) {
    const percentage = (event.loaded / event.total) * 100;
    setUploadProgress(percentage);
  }
});
xhr.open("PUT", upload_url);
xhr.send(selectedFile);
```

---

#### 2. Progress Event Not Firing

**Check:**

```typescript
// Add debug logging
xhr.upload.addEventListener("progress", (event) => {
  console.log("[UPLOAD] Progress event:", event.loaded, "/", event.total);
  // ...
});
```

**Possible Causes:**

- File too small (uploads instantly, progress skipped)
- Network too fast (progress completes before UI updates)
- Event listener not attached before send()

---

## Drag-and-Drop Not Working

### Symptom

Files can't be dropped into upload zone

### Solutions

#### 1. preventDefault Not Called

**Fix:**

```typescript
const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
  event.preventDefault(); // REQUIRED
  event.stopPropagation(); // REQUIRED

  const file = event.dataTransfer.files?.[0];
  // ...
};

const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
  event.preventDefault(); // REQUIRED
  event.stopPropagation(); // REQUIRED
};
```

**Without preventDefault:**

- Browser opens file in new tab (default behavior)
- File not captured by component

---

#### 2. Drop Zone Not Registered

**Verify:**

```typescript
<div
  onDrop={handleDrop}
  onDragOver={handleDragOver}
  // Make sure both handlers are attached
>
```

---

## Form Integration Issues

### Symptom

`payment_proof_url` not populated in form state

### Solutions

#### 1. setValue Not Called

**Check:**

```typescript
const handleUploadComplete = (filePath: string) => {
  console.log("[FORM] Upload complete, file path:", filePath);
  form.setValue("payment_proof_url", filePath);
  console.log("[FORM] Form state updated:", form.getValues("payment_proof_url"));
};
```

**If not logging:**

- `onUploadComplete` prop not passed to PaymentProofUpload
- Callback not triggered after successful upload

---

#### 2. Field Not in Schema

**Verify:**

```typescript
// In guest-booking-multi-unit.ts
export const multiUnitBookingSchema = z.object({
  // ... existing fields ...
  payment_proof_url: z.string().min(1, "Payment proof is required").optional(),
});
```

**Check form initialization:**

```typescript
const form = useForm<MultiUnitBookingRequest>({
  defaultValues: {
    // ... existing defaults ...
    payment_proof_url: "", // Must be initialized
  },
});
```

---

## Still Stuck?

### Debug Checklist

1. **Check browser console** for detailed error messages
2. **Check Supabase logs**:
   - Project > Logs > Storage
   - Look for 403/500 errors
3. **Check network tab** in DevTools:
   - Upload URL request (POST /api/guest-booking/upload-url)
   - File upload request (PUT to signed URL)
   - Response status and headers
4. **Enable verbose logging**:
   ```typescript
   // Add to file-validation.ts
   console.log("[FILE_VALIDATION] Starting validation...");
   console.log("[FILE_VALIDATION] File:", file.name, file.type, file.size);
   // ... more logs ...
   ```

### Get Help

**Check documentation:**

- 02-api-specification.md lines 738-807 (upload endpoint spec)
- 03-frontend-components.md lines 140-379 (component implementation)
- Supabase Storage docs: https://supabase.com/docs/guides/storage

**Search GitHub issues:**

- Supabase Storage: https://github.com/supabase/storage-api/issues
- React Hook Form: https://github.com/react-hook-form/react-hook-form/issues

**Common search terms:**

- "Supabase Storage upload failed"
- "Canvas API toBlob not working"
- "React drag and drop file upload"
- "XMLHttpRequest upload progress"

### Escalation

If issue persists after trying all solutions:

1. **Document the issue**:
   - Exact error message
   - Steps to reproduce
   - Browser and version
   - Supabase project ID
   - Screenshots of error

2. **Check Prerequisites**:
   - All previous chunks (001-007) completed?
   - Supabase project configured correctly?
   - Environment variables set?

3. **Contact Support**:
   - Supabase Support: https://supabase.com/support
   - Project maintainer (if applicable)
   - Stack Overflow with tag `supabase` + `file-upload`

---

**Last Updated**: 2025-10-24
**Chunk Version**: 008
