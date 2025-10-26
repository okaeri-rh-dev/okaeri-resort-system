# Checkpoint: Payment Proof Upload

Use this checklist to verify that chunk 008 has been implemented correctly.

---

## Automated Checks

Run these commands to verify technical implementation:

### 1. TypeScript Compilation

```bash
npm run type-check
```

**Expected Output:**

```
✓ No TypeScript errors
✓ src/lib/file-validation.ts compiles without errors
✓ src/components/guest-booking/PaymentProofUpload.tsx compiles without errors
```

**Status**: [ ] Pass / [ ] Fail

**Issues**: ******************************\_\_\_******************************

---

### 2. ESLint Validation

```bash
npm run lint
```

**Expected Output:**

```
✓ No linting errors
✓ No unused imports
✓ Consistent code style
```

**Status**: [ ] Pass / [ ] Fail

**Issues**: ******************************\_\_\_******************************

---

### 3. Unit Tests (Optional)

```bash
npm run test:run src/lib/__tests__/file-validation.test.ts
```

**Expected Output:**

```
✓ validateFileContent - validates JPEG magic number
✓ validateFileContent - validates PNG magic number
✓ validateFileContent - validates PDF magic number
✓ validateFileContent - rejects invalid magic number
✓ formatFileSize - formats bytes correctly
```

**Status**: [ ] Pass / [ ] Fail / [ ] Skipped

**Issues**: ******************************\_\_\_******************************

---

### 4. Supabase Storage Bucket Exists

```bash
# Via Supabase CLI
supabase storage list
```

**Expected Output:**

```
booking-files (private)
```

**Alternative: Manual Check**

- Navigate to: `https://app.supabase.com/project/<your-project>/storage/buckets`
- Verify: `booking-files` bucket exists
- Verify: Privacy set to **private** (not public)

**Status**: [ ] Pass / [ ] Fail

**Issues**: ******************************\_\_\_******************************

---

### 5. RLS Policies Configured

```bash
# Via Supabase SQL Editor
# Run: SELECT * FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%signed%';
```

**Expected Output:**

```
"Allow signed uploads" policy exists
Applies to INSERT operations
Checks bucket_id = 'booking-files'
```

**Alternative: Manual Check**

- Navigate to: Storage > booking-files > Policies
- Verify: "Allow signed uploads" policy exists

**Status**: [ ] Pass / [ ] Fail

**Issues**: ******************************\_\_\_******************************

---

### 6. Upload URL Endpoint Working

```bash
# Test signed URL generation
curl -X POST http://localhost:5173/api/guest-booking/upload-url \
  -H "Content-Type: application/json" \
  -d '{
    "booking_reference": "BK-TEST-001",
    "file_name": "test-receipt.jpg",
    "file_type": "image/jpeg",
    "file_size": 1048576
  }'
```

**Expected Output:**

```json
{
  "success": true,
  "upload_url": "https://<project>.supabase.co/storage/v1/upload/sign/...",
  "file_path": "payment-proofs/BK-TEST-001_<timestamp>.jpg",
  "expires_in": 300
}
```

**Status**: [ ] Pass / [ ] Fail

**Issues**: ******************************\_\_\_******************************

---

## Manual Checks

Perform these manual verification steps in the browser:

### 1. Component Renders

**Steps:**

1. Start dev server: `npm run dev`
2. Navigate to booking form page
3. Scroll to "Payment Proof" section

**Expected:**

- [ ] PaymentProofUpload component visible
- [ ] Drag-and-drop zone displays with upload icon
- [ ] Text: "Drop payment proof here or click to browse"
- [ ] File type info: "JPEG, PNG, or PDF (max 5MB)"
- [ ] No console errors

**Status**: [ ] Pass / [ ] Fail

**Issues**: ******************************\_\_\_******************************

---

### 2. Drag-and-Drop Works

**Steps:**

1. Find a JPEG image file on your computer
2. Drag it into the upload zone
3. Drop the file

**Expected:**

- [ ] Drop zone highlights on hover
- [ ] "Validating file..." message appears briefly
- [ ] File name and size displayed
- [ ] "Upload" and "Remove" buttons visible
- [ ] No errors shown (if valid file)

**Status**: [ ] Pass / [ ] Fail

**Issues**: ******************************\_\_\_******************************

---

### 3. Click-to-Browse Works

**Steps:**

1. Click on upload zone (anywhere in the drop area)
2. File picker dialog opens
3. Select a JPEG file
4. Click "Open"

**Expected:**

- [ ] File picker opens
- [ ] Only shows JPEG/PNG/PDF files (filtered)
- [ ] Selected file appears in upload zone
- [ ] Same behavior as drag-and-drop

**Status**: [ ] Pass / [ ] Fail

**Issues**: ******************************\_\_\_******************************

---

### 4. Image Compression Works

**Steps:**

1. Select a large image (e.g., 5MB JPEG from phone)
2. Wait for validation to complete

**Expected:**

- [ ] Compression info message appears
- [ ] Shows original size and compressed size
- [ ] Displays compression ratio (e.g., "Compressed by 45%")
- [ ] Compressed size is significantly smaller (~2MB)
- [ ] Alert: "Image compressed by X% for faster upload"

**Status**: [ ] Pass / [ ] Fail

**Compression Ratio**: **\_\_**%

**Issues**: ******************************\_\_\_******************************

---

### 5. File Size Validation (Reject Oversized)

**Steps:**

1. Create or find a file larger than 5MB
2. Try to upload it

**Expected:**

- [ ] Error alert appears immediately
- [ ] Error message: "File size (X.XXMB) exceeds 5MB limit"
- [ ] File is NOT uploaded
- [ ] User can select a different file

**Status**: [ ] Pass / [ ] Fail

**Issues**: ******************************\_\_\_******************************

---

### 6. File Type Validation (Reject Invalid Types)

**Steps:**

1. Try to upload a .txt, .doc, or .zip file
2. If file picker filters work, try renaming a .txt file to .jpg

**Expected:**

- [ ] File picker doesn't show invalid file types (filtered by accept attribute)
- [ ] If renamed file uploaded: Error "Only JPEG, PNG, and PDF files are allowed"
- [ ] Invalid file rejected

**Status**: [ ] Pass / [ ] Fail

**Issues**: ******************************\_\_\_******************************

---

### 7. Magic Number Validation (Reject Tampered Files)

**Steps:**

1. Create a text file: `echo "fake image" > fake.jpg`
2. Try to upload `fake.jpg`

**Expected:**

- [ ] Error alert appears
- [ ] Error message: "File appears corrupted or tampered with"
- [ ] Upload blocked
- [ ] Console logs magic number mismatch

**Status**: [ ] Pass / [ ] Fail

**Issues**: ******************************\_\_\_******************************

---

### 8. Upload Progress Tracking

**Steps:**

1. Select a 2-3MB image
2. Click "Upload" button
3. Watch progress bar

**Expected:**

- [ ] "Upload" button changes to "Uploading... 0%"
- [ ] Progress bar appears
- [ ] Percentage increases (0% → 100%)
- [ ] Upload completes (green checkmark appears)
- [ ] File preview shown after upload

**Status**: [ ] Pass / [ ] Fail

**Upload Time**: **\_\_** seconds

**Issues**: ******************************\_\_\_******************************

---

### 9. PDF Upload Works

**Steps:**

1. Select a PDF file (<5MB)
2. Upload the file

**Expected:**

- [ ] Validation passes (no compression for PDFs)
- [ ] PDF icon displayed (not image icon)
- [ ] File name shown
- [ ] Upload succeeds
- [ ] File appears in Supabase Storage

**Status**: [ ] Pass / [ ] Fail

**Issues**: ******************************\_\_\_******************************

---

### 10. File Stored in Supabase Storage

**Steps:**

1. Upload a file successfully
2. Open Supabase Dashboard
3. Navigate to: Storage > booking-files > payment-proofs

**Expected:**

- [ ] Uploaded file appears in list
- [ ] File name matches pattern: `BK-*_<timestamp>.<ext>`
- [ ] File size matches uploaded size
- [ ] File can be previewed (click to view)

**Status**: [ ] Pass / [ ] Fail

**File Path**: ******************************\_\_\_******************************

**Issues**: ******************************\_\_\_******************************

---

### 11. Remove File Works

**Steps:**

1. Select a file (don't upload yet)
2. Click "Remove" button

**Expected:**

- [ ] Selected file cleared
- [ ] Upload zone returns to initial state
- [ ] Compression info cleared
- [ ] No errors

**Status**: [ ] Pass / [ ] Fail

**Issues**: ******************************\_\_\_******************************

---

### 12. Uploaded File Preview

**Steps:**

1. Upload a JPEG image successfully
2. Verify preview display

**Expected:**

- [ ] Green checkmark icon shown
- [ ] File name displayed
- [ ] File size displayed
- [ ] Compression info shown (if compressed)
- [ ] Preview card has green border/background
- [ ] "X" button to remove file

**Status**: [ ] Pass / [ ] Fail

**Issues**: ******************************\_\_\_******************************

---

### 13. Form Integration

**Steps:**

1. Fill booking form (dates, units, contact info)
2. Upload payment proof
3. Inspect form state (React DevTools or console)

**Expected:**

- [ ] `payment_proof_url` field populated with file path
- [ ] File path format: `payment-proofs/BK-*_<timestamp>.<ext>`
- [ ] Form validation passes when file uploaded
- [ ] Form can be submitted with payment proof

**Status**: [ ] Pass / [ ] Fail

**File Path in Form State**: ******************************\_\_\_******************************

**Issues**: ******************************\_\_\_******************************

---

### 14. Error Handling: Network Failure

**Steps:**

1. Open DevTools > Network tab
2. Set throttling to "Offline"
3. Try to upload a file

**Expected:**

- [ ] Upload fails (as expected)
- [ ] Error message displayed
- [ ] User can retry after re-enabling network
- [ ] No console errors (gracefully handled)

**Status**: [ ] Pass / [ ] Fail

**Issues**: ******************************\_\_\_******************************

---

## Success Criteria

All of the following must be true to mark chunk 008 as complete:

### Core Functionality

- [ ] Can upload JPEG files successfully
- [ ] Can upload PNG files successfully
- [ ] Can upload PDF files successfully
- [ ] Files >5MB are rejected with clear error
- [ ] Images are compressed to ~2MB before upload
- [ ] Upload progress bar displays correctly

### Security & Validation

- [ ] Magic number validation blocks tampered files
- [ ] File type validation rejects invalid types
- [ ] Supabase Storage bucket is private (not public)
- [ ] Signed URLs expire after 5 minutes
- [ ] RLS policies configured correctly

### User Experience

- [ ] Drag-and-drop works smoothly
- [ ] Click-to-browse works as fallback
- [ ] Compression info displayed for compressed images
- [ ] File preview shown after upload
- [ ] Remove file button works
- [ ] Error messages are clear and actionable

### Integration

- [ ] Component integrates with booking form
- [ ] `payment_proof_url` stored in form state
- [ ] Form validation includes payment proof
- [ ] Upload endpoint (chunk 004) works correctly

### Code Quality

- [ ] TypeScript compiles without errors
- [ ] ESLint passes without warnings
- [ ] No console errors during normal operation
- [ ] Code follows existing project patterns

**Overall Status**: [ ] All Criteria Met / [ ] Some Failures

---

## If Any Check Fails

### Common Issues and Solutions

**TypeScript Errors:**

- Run `npm run type-check` to see specific errors
- Check import paths are correct
- Verify all types are exported from `file-validation.ts`
- See `troubleshooting.md` for type error solutions

**Upload Fails:**

- Verify Supabase bucket exists and is named `booking-files`
- Check RLS policies allow signed URL uploads
- Verify upload endpoint (chunk 004) is deployed
- Check CORS configuration for Supabase Storage
- See `troubleshooting.md` section "File upload failed"

**Compression Not Working:**

- Check browser supports Canvas API (all modern browsers do)
- Verify image file is >2MB (small files skip compression)
- Check for console errors during compression
- See `troubleshooting.md` section "Compression failed"

**Magic Number Validation Fails:**

- Verify magic number constants are correct
- Check file is not corrupted
- Ensure file type matches extension
- See `troubleshooting.md` section "Invalid file type"

---

## When All Checks Pass

### 1. Record Completion

**Time Taken**: **\_\_** minutes (target: 90 minutes)

**Date Completed**: ********\_\_********

**Completed By**: ********\_\_********

**Notes**: ******************************\_\_\_******************************

---

---

---

### 2. Commit Changes

```bash
git add src/lib/file-validation.ts
git add src/components/guest-booking/PaymentProofUpload.tsx
git add src/types/guest-booking-multi-unit.ts
git add src/components/guest-booking/MultiUnitGuestBookingForm.tsx
git add src/lib/__tests__/file-validation.test.ts  # if created

git commit -m "feat: implement payment proof upload with client compression

- Add magic number validation for JPEG/PNG/PDF
- Implement Canvas API image compression (~2MB target)
- Create PaymentProofUpload component with drag-and-drop
- Add upload progress tracking
- Integrate with Supabase Storage (private bucket)
- Add comprehensive error handling
- Implement file size and type validation

Completes chunk 008-payment-proof-upload
Resolves integration with booking form (chunk 006)
Prepares for form submission (chunk 009)"

# Optional: Tag the commit
git tag -a chunk-008 -m "Chunk 008: Payment Proof Upload complete"
```

---

### 3. Update Progress Tracker

Update your implementation progress tracker:

```markdown
## Phase 2: Guest Booking Flow

- [x] Chunk 006: Date and Unit Selection UI
- [x] Chunk 007: Payment Summary with Preview
- [x] Chunk 008: Payment Proof Upload ✅ COMPLETE
- [ ] Chunk 009: Form Validation and Submission (NEXT)
- [ ] Chunk 010: Booking Confirmation Flow
```

---

### 4. Prepare for Next Chunk

**Chunk 009: Form Validation and Submission**

**Prerequisites for Chunk 009:**

- ✅ Form state includes all fields (from chunks 006, 007, 008)
- ✅ `payment_proof_url` populated after upload
- ✅ All form fields validated client-side
- ✅ API endpoint `POST /api/guest-booking` operational

**Next Steps:**

1. Review `chunks/009-form-validation-submission/README.md`
2. Verify prerequisites met
3. Begin implementation

---

### 5. Optional: Create Test Data

For testing Chunk 009 (form submission):

```bash
# Create test payment proof images (use real images or generate test files)

# JPEG (2MB)
# Use a real photo or screenshot

# PNG (3MB)
# Use a real screenshot

# PDF (1MB)
# Create a fake receipt PDF

# Upload these during Chunk 009 testing to verify end-to-end workflow
```

---

## Troubleshooting

If you encountered issues during this chunk:

1. **Review troubleshooting.md** for specific error solutions
2. **Check Supabase logs** for storage-related errors
3. **Verify endpoint** (`/api/guest-booking/upload-url`) works standalone
4. **Test with different file types** to isolate validation issues
5. **Check browser console** for detailed error messages

---

**Chunk 008 Status**: [ ] Complete / [ ] Incomplete

**Ready for Chunk 009**: [ ] Yes / [ ] No

**Issues to Resolve**: ******************************\_\_\_******************************

---

---

---

**Congratulations!** 🎉

You've completed chunk 008: Payment Proof Upload. The system can now:

- ✅ Securely validate and upload payment proofs
- ✅ Compress images for faster uploads
- ✅ Prevent file tampering with magic number validation
- ✅ Store files in private Supabase bucket
- ✅ Track upload progress with visual feedback

**Next**: Proceed to Chunk 009 to implement form validation and submission, completing the guest booking flow.
