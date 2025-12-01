# Chunk 008: Payment Proof Upload

## At a Glance

| Property | Value |
|----------|-------|
| **Estimated Time** | 90 minutes |
| **Milestone** | Secure File Upload System Complete |
| **Prerequisites** | ✅ Chunk 004 (`POST /api/guest-booking/upload-url` endpoint operational)<br>✅ Supabase Storage bucket `booking-files` configured<br>✅ Chunk 006 (form state management for file path storage) |
| **Can Skip?** | ❌ No - Required for payment verification workflow |
| **Phase** | Phase 2: Guest Booking Flow (3 of 5) |

## What You're Building

This chunk implements the **secure payment proof upload system** with client-side compression and server-side validation. This is a critical security component that handles potentially malicious file uploads while providing excellent UX.

### 1. PaymentProofUpload Component
- **Drag-and-Drop Interface**: Modern file selection with visual feedback
- **Multiple Selection Methods**: Click-to-browse fallback for accessibility
- **Real-Time Validation**: Instant feedback on file type and size
- **Upload Progress**: Visual progress bar during upload
- **File Preview**: Display uploaded image/PDF for confirmation

### 2. Two-Tier Security Strategy
- **Client Tier (~2MB Target)**:
  - Compresses images using Canvas API
  - Progressive quality reduction (0.9 → 0.5)
  - Maintains aspect ratio
  - Converts to JPEG for consistency
- **Server Tier (5MB Hard Limit)**:
  - Magic number validation (file header check)
  - MIME type verification
  - Size enforcement
  - Signed URL generation with 5-minute expiry

### 3. File Validation Pipeline
```
User selects file
    ↓
1. MIME type check (JPEG/PNG/PDF only)
    ↓
2. Size pre-check (<5MB)
    ↓
3. Magic number validation (file header)
    ↓
4. Image compression (if needed, target ~2MB)
    ↓
5. Request signed URL from server
    ↓
6. Upload to Supabase Storage
    ↓
7. Store file path in form state
    ↓
8. Display preview
```

### 4. Supported File Types
- **JPEG**: `image/jpeg`, `image/jpg` - Magic bytes: `FF D8 FF`
- **PNG**: `image/png` - Magic bytes: `89 50 4E 47`
- **PDF**: `application/pdf` - Magic bytes: `25 50 44 46` (`%PDF`)

### 5. Storage Architecture
- **Bucket**: `booking-files` (private, not publicly accessible)
- **Path Structure**: `payment-proofs/{booking_reference}_{timestamp}.{ext}`
- **Access Method**: Signed URLs (5-minute expiry)
- **Cleanup**: Weekly cron job deletes proofs >90 days old (implemented in Chunk 005)

## Why This Matters

### Business Impact
- **Payment Verification**: Admin can review payment proof before unit assignment
- **Audit Trail**: All payment proofs stored and linked to bookings
- **Manual Contact Workflow**: No email automation, admin contacts guests directly
- **Fraud Prevention**: Magic number validation prevents file tampering
- **Trust Building**: Guests can upload payment proof immediately, no wait for email

### Technical Benefits
- **Security First**: Magic number validation prevents MIME type spoofing
- **Bandwidth Optimization**: Client compression reduces upload time and storage costs
- **Free Tier Friendly**: 5MB limit keeps within Supabase free tier storage quotas
- **Progressive Enhancement**: Fallback for browsers without Canvas API support
- **Privacy Protected**: Private bucket ensures payment proofs not publicly accessible

### User Experience Principles

**Instant Feedback**:
- File type validated immediately on selection
- Clear error messages ("Only JPEG, PNG, PDF allowed")
- Compression progress shown for large images
- Upload progress bar with percentage

**Error Prevention**:
- Drag-and-drop visual cues (hover state, drop zone)
- File size warnings before upload attempt
- Compression reduces rejection rate
- Clear "maximum 5MB" messaging

**Transparency**:
- Shows compressed file size vs original
- Displays compression ratio percentage
- Preview uploaded file before submission
- Signed URL expiry countdown (optional enhancement)

## Before You Start

### Prerequisites Checklist

**Supabase Storage (Critical):**
- [ ] `booking-files` bucket created in Supabase dashboard
- [ ] Bucket privacy set to **private** (not public)
- [ ] Storage RLS policies configured for signed URLs
- [ ] Test signed URL generation works: `supabase.storage.from('booking-files').createSignedUploadUrl()`

**API Endpoint (from Chunk 004):**
- [ ] `POST /api/guest-booking/upload-url` endpoint deployed
- [ ] Endpoint validates file type and size
- [ ] Endpoint returns signed URL with 5-minute expiry
- [ ] Endpoint enforces 5MB hard limit
- [ ] See 02-api-specification.md lines 746-807

**Frontend Dependencies:**
- [ ] React 19 with hooks support
- [ ] shadcn/ui components: Button, Card, Alert, Progress
- [ ] lucide-react icons: Upload, FileImage, FileText, X, CheckCircle
- [ ] TypeScript configured
- [ ] Form state management (React Hook Form from Chunk 006)

**Development Environment:**
- [ ] Browser supports Canvas API (for image compression)
- [ ] CORS configured for Supabase Storage domain
- [ ] Environment variables set (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

### Verify Prerequisites

```bash
# 1. Check Supabase bucket exists
supabase storage list
# Expected: "booking-files" in list

# 2. Test signed URL generation
curl -X POST https://your-domain.com/api/guest-booking/upload-url \
  -H "Content-Type: application/json" \
  -d '{
    "booking_reference": "BK-TEST-123",
    "file_name": "receipt.jpg",
    "file_type": "image/jpeg",
    "file_size": 1048576
  }'

# Expected response:
# {
#   "success": true,
#   "upload_url": "https://<project>.supabase.co/storage/v1/upload/sign/...",
#   "file_path": "payment-proofs/BK-TEST-123_1234567890.jpg",
#   "expires_in": 300
# }

# 3. Verify RLS policies allow signed upload
# In Supabase dashboard > Storage > booking-files > Policies
# Should see policy allowing INSERT with signed URLs

# 4. Test Canvas API support (browser console)
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
console.log(ctx ? 'Canvas API supported ✓' : 'Canvas API NOT supported ✗');
```

## What Happens Next

After completing this chunk successfully:

### Immediate Outcomes
- ✅ **Secure file upload** - Magic number validation prevents tampering
- ✅ **Optimized uploads** - Images compressed to ~2MB for faster transfers
- ✅ **Private storage** - Payment proofs in non-public bucket
- ✅ **Signed URLs** - 5-minute expiry prevents unauthorized access
- ✅ **File preview** - Guest can verify uploaded proof before submission
- ✅ **Error handling** - Clear messages for all failure scenarios
- ✅ **Progress tracking** - Visual feedback during upload

### Integration Points
- **Chunk 009 (next)**: Form submission includes `payment_proof_url` field
- **Admin UI** (Chunk 012): Admin views uploaded proof via signed URL
- **Cleanup Cron** (Chunk 005): Weekly deletion of old payment proofs

### Next Steps
- **Ready for Chunk 009**: Form Validation and Submission
  - Will include `payment_proof_url` in booking payload
  - Server validates file exists before creating booking
  - Payment proof linked to booking record
- **Admin Workflow**:
  - Admin sees payment proof in pending bookings queue
  - Admin verifies payment before unit assignment
  - Admin can download proof via signed URL

### System State After Completion
```
Phase 1: Database & Backend Core ✅ COMPLETE
├── 001: Database schema ✅
├── 002: PostgreSQL pricing engine ✅
├── 003: Security, RLS, constraints ✅
├── 004: Core API endpoints ✅
└── 005: Idempotency & rate limiting ✅

Phase 2: Guest Booking Flow (In Progress)
├── 006: Date and Unit Selection UI ✅
├── 007: Payment Summary with Preview ✅
├── 008: Payment Proof Upload ✅ (YOU ARE HERE)
├── 009: Form Validation and Submission (NEXT)
└── 010: Booking Confirmation Flow
```

## Key Files Created/Modified

```
okaeri-resort/
├── src/
│   ├── components/
│   │   └── guest-booking/
│   │       ├── PaymentProofUpload.tsx       # NEW - File upload component
│   │       └── FilePreview.tsx              # NEW - Image/PDF preview
│   ├── lib/
│   │   └── file-validation.ts               # NEW - Magic number validation
│   └── types/
│       └── guest-booking-multi-unit.ts      # MODIFIED - Add file upload types
├── functions/
│   └── api/
│       └── guest-booking/
│           └── upload-url.ts                # VERIFY - Signed URL endpoint exists
└── __tests__/
    └── lib/
        └── file-validation.test.ts          # NEW - Validation tests
```

### File Purposes

**`PaymentProofUpload.tsx`** (NEW - ~300 lines):
- Drag-and-drop file upload interface
- File selection and validation workflow
- Client-side image compression
- Upload progress tracking
- Error state management
- File preview display
- Integration with React Hook Form

**`FilePreview.tsx`** (NEW - ~100 lines):
- Display uploaded image (JPEG/PNG)
- Display PDF filename with icon
- Remove file button
- Compressed size display
- Responsive layout

**`file-validation.ts`** (NEW - ~200 lines):
- Magic number constants for JPEG/PNG/PDF
- `validateFileContent()` - Read file header and check magic numbers
- `compressImage()` - Canvas API compression with progressive quality
- `formatFileSize()` - Human-readable size display
- Type definitions for validation errors

**`guest-booking-multi-unit.ts`** (MODIFIED):
- Add `FileUploadError` type
- Add `CompressedFileResult` type
- Export file validation utilities

**`upload-url.ts`** (VERIFY ONLY):
- Already implemented in Chunk 004
- Verify endpoint exists and works
- No modifications needed

**`file-validation.test.ts`** (NEW - ~150 lines):
- Test magic number validation for each file type
- Test compression algorithm
- Test file size limits
- Mock File and Canvas APIs

## Related Documentation

### Source Documentation
- **CHUNKING-STRATEGY.md lines 270-302**: Chunk 008 specification and scope
- **03-frontend-components.md lines 140-379**: Complete file upload component specification
  - Lines 170-238: Magic number validation implementation
  - Lines 186-237: Image compression with Canvas API
  - Lines 240-339: Comprehensive error handling
- **02-api-specification.md lines 738-807**: Upload URL endpoint specification
  - Lines 750-771: File type and size validation
  - Lines 782-788: Signed URL generation
  - Lines 774-779: 5MB hard limit enforcement
- **README.md lines 162-168**: Two-tier file upload strategy overview

### Architectural Decisions
- **Two-Tier Strategy** (README.md lines 162-164): Why client compression + server validation
- **Magic Number Validation** (03-frontend-components.md lines 171-176): Why not just MIME type
- **Private Bucket** (CHUNKING-STRATEGY.md lines 291-292): Security and privacy considerations
- **5MB Hard Limit** (README.md lines 163-164): Free tier optimization
- **Signed URLs** (02-api-specification.md lines 786-788): 5-minute expiry rationale

### Integration Points
- **Chunk 004**: Created `/api/guest-booking/upload-url` endpoint
- **Chunk 005**: Weekly cleanup cron job for old payment proofs
- **Chunk 006**: Form state stores `payment_proof_url`
- **Chunk 009** (next): Booking submission includes payment proof
- **Chunk 012** (future): Admin views payment proof for verification

## Implementation Notes

### File Upload Workflow

```
User drags file into drop zone
    ↓
onDrop handler triggered
    ↓
1. Extract File object
2. Validate MIME type (allowlist)
3. Check file size (<5MB pre-validation)
    ↓
4. Read file header (first 4 bytes)
5. Compare to magic number constants
6. Reject if mismatch (corrupted/tampered)
    ↓
7. Compress image (if JPEG/PNG)
   - Create Canvas element
   - Draw image at original dimensions
   - Export with quality 0.9 → 0.5 (progressive)
   - Stop when size <2MB or quality ≤0.5
    ↓
8. Call API: POST /api/guest-booking/upload-url
   - Send: booking_reference, file_name, file_type, file_size
   - Receive: signed_url, file_path, expires_in
    ↓
9. Upload to signed URL (PUT request)
   - Send compressed file as binary
   - Track upload progress (ProgressEvent)
   - Update progress bar percentage
    ↓
10. On success:
    - Store file_path in form state
    - Display preview
    - Show success message
    ↓
11. On error:
    - Display specific error message
    - Allow retry
    - Clear invalid file
```

### Magic Number Validation

**Why Magic Numbers?**
- MIME type can be spoofed (just metadata)
- Magic numbers are file content signatures
- First few bytes identify file format
- Cannot be faked without corrupting file

**Example: JPEG Detection**
```typescript
const MAGIC_NUMBERS = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],  // All JPEG files start with these bytes
  'image/png': [0x89, 0x50, 0x4E, 0x47],  // PNG signature
  'application/pdf': [0x25, 0x50, 0x44, 0x46],  // "%PDF" in hex
};

async function validateFileContent(file: File): Promise<boolean> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const magic = MAGIC_NUMBERS[file.type];

  if (!magic) return false;  // Unknown type

  return magic.every((byte, i) => bytes[i] === byte);  // Compare header
}
```

### Image Compression Algorithm

**Progressive Quality Reduction:**
```typescript
async function compressImage(file: File): Promise<File> {
  const targetSize = 2 * 1024 * 1024; // 2MB
  if (file.size <= targetSize) return file; // Already small

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();

  return new Promise((resolve, reject) => {
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      let quality = 0.9;  // Start high

      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (blob && (blob.size <= targetSize || quality <= 0.5)) {
              resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            } else {
              quality -= 0.1;  // Reduce quality
              tryCompress();  // Retry
            }
          },
          'image/jpeg',
          quality
        );
      };

      tryCompress();
    };

    img.onerror = () => reject(new Error('Image load failed'));
    img.src = URL.createObjectURL(file);
  });
}
```

**Why This Works:**
- JPEG quality 0.9 is visually identical to original
- Reduces file size by ~40-60%
- Progressive reduction ensures 2MB target
- Falls back to quality 0.5 minimum (still readable)
- Preserves dimensions (no resizing unless needed)

### Error Handling Strategy

**Error Categories:**
1. **FILE_TYPE_INVALID**: Not JPEG/PNG/PDF
2. **FILE_SIZE_EXCEEDED**: >5MB hard limit
3. **FILE_CONTENT_INVALID**: Magic number mismatch (corrupted/tampered)
4. **COMPRESSION_FAILED**: Canvas API error
5. **UPLOAD_FAILED**: Network error or signed URL expired
6. **VALIDATION_FAILED**: Generic validation error

**User-Friendly Messages:**
```typescript
const ERROR_MESSAGES = {
  FILE_TYPE_INVALID: 'Only JPEG, PNG, and PDF files are allowed',
  FILE_SIZE_EXCEEDED: 'File too large. Maximum size is 5MB',
  FILE_CONTENT_INVALID: 'File appears corrupted or tampered with',
  COMPRESSION_FAILED: 'Image compression failed. Try a smaller file',
  UPLOAD_FAILED: 'Upload failed. Please check your connection and try again',
  VALIDATION_FAILED: 'File validation failed. Please try another file',
};
```

## Security Considerations

### Multi-Layer Validation

**Layer 1: MIME Type (Client)**
- Quick check before reading file
- Prevents obvious mistakes
- NOT security boundary (can be spoofed)

**Layer 2: Magic Numbers (Client)**
- Reads file content (first 4 bytes)
- Cannot be spoofed without corrupting file
- Primary client-side security check

**Layer 3: Server Validation (API)**
- Re-validates MIME type
- Enforces 5MB hard limit
- Generates signed URL (5-minute expiry)
- See 02-api-specification.md lines 762-779

**Layer 4: Storage RLS (Supabase)**
- Private bucket (not publicly accessible)
- Row Level Security policies
- Only signed URLs can write

### Attack Mitigation

**File Type Spoofing:**
- ✅ Prevented by magic number validation
- Attacker changes `.exe` to `.jpg`
- MIME type may say `image/jpeg`
- Magic numbers reveal true type (EXE header)
- File rejected before upload

**Oversized Files:**
- ✅ Client pre-check (<5MB)
- ✅ Server hard limit enforcement
- ✅ Compression reduces file size
- Prevents storage quota exhaustion

**Malware Uploads:**
- ⚠️ Phase 1: Manual admin review (primary defense)
- 📋 Phase 2: Add VirusTotal API scanning
- Admin sees file before accepting payment
- Payment proof only accessed by admin

**Signed URL Expiry:**
- ✅ 5-minute window prevents replay attacks
- ✅ URL cannot be reused after expiry
- ✅ Prevents unauthorized access to bucket

### Privacy Protection

**Private Bucket:**
- Payment proofs contain sensitive financial info
- NOT publicly accessible
- Admin fetches via signed URL for viewing
- Auto-deleted after 90 days (cleanup cron)

**No PII in Filenames:**
- Path: `payment-proofs/{booking_reference}_{timestamp}.ext`
- Booking reference is public-safe identifier
- No guest names, emails, or phone numbers in path

## Performance Considerations

### Client-Side Compression

**Benefits:**
- Reduces upload time (2MB vs 5MB = 60% faster)
- Reduces storage costs
- Reduces bandwidth for Supabase free tier

**Trade-offs:**
- CPU usage on client device
- Older devices may be slower
- Fallback: Upload uncompressed if compression fails

**Expected Metrics:**
- Compression time: ~500ms for 5MB image
- Upload time: ~2-3s for 2MB file (good connection)
- Total time: ~3-4s for full workflow

### Storage Optimization

**Free Tier Limits (Supabase):**
- Storage: 1GB total
- Bandwidth: 2GB/month

**Expected Usage:**
- Average file size: ~2MB (after compression)
- Bookings per month: ~20 (small resort)
- Monthly storage: ~40MB
- Cleanup cron deletes files >90 days old
- **Result**: Well within free tier

### Upload Progress

**Why Show Progress:**
- Slow connections may take 10-20s
- User needs feedback to prevent abandonment
- Progress bar reduces perceived wait time

**Implementation:**
```typescript
const xhr = new XMLHttpRequest();
xhr.upload.addEventListener('progress', (event) => {
  if (event.lengthComputable) {
    const percentage = (event.loaded / event.total) * 100;
    setUploadProgress(percentage);
  }
});
```

## Common Questions

**Q: Why compress client-side instead of server-side?**
A: Reduces upload time and bandwidth costs. Compression before upload means faster transfers and lower Supabase bandwidth usage (free tier: 2GB/month).

**Q: What if browser doesn't support Canvas API?**
A: Fallback to uploading uncompressed file (if <5MB). Canvas API supported in all modern browsers (Chrome, Firefox, Safari, Edge).

**Q: Why 5MB limit instead of 10MB or 20MB?**
A: Balances user needs (payment receipts are typically <1MB) with storage costs. Higher limits would allow abuse (uploading non-receipt files).

**Q: Can malware be uploaded via payment proof?**
A: Phase 1: Admin reviews before accepting payment (manual defense). Phase 2: Add VirusTotal API scanning. Payment proofs only accessed by admin, not executed.

**Q: Why signed URLs instead of public bucket?**
A: Payment proofs contain sensitive financial info (bank transfers, account numbers). Private bucket + signed URLs prevent unauthorized access.

**Q: What if upload fails halfway?**
A: User can retry. Signed URL valid for 5 minutes. Failed uploads don't consume storage (incomplete files not stored).

**Q: Why PDF support if images are recommended?**
A: Some payment processors send PDF receipts. Supporting PDF reduces friction (guest doesn't need to screenshot).

**Q: What prevents uploading random files (not payment proofs)?**
A: Admin reviews file before accepting payment. If file is invalid, admin rejects booking and requests proper proof.

**Q: Why 2MB compression target instead of 1MB or 500KB?**
A: 2MB balances quality (high-DPI phone screenshots) with upload speed. Lower targets risk unreadable text in payment proofs.

---

**Ready to implement?** Proceed to `instructions.md` for step-by-step implementation guide.
