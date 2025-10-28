# Supabase Storage Setup for Payment Proof Upload

This document provides step-by-step instructions for configuring Supabase Storage for chunk 008 payment proof uploads.

## Prerequisites

- Supabase project created
- Project URL and anon key configured in `.env.local`
- Admin access to Supabase Dashboard

## Step 1: Create Storage Bucket

### Via Supabase Dashboard (Recommended)

1. Navigate to your Supabase project: `https://app.supabase.com/project/<your-project-id>`
2. In the left sidebar, click **Storage**
3. Click **New bucket** button
4. Configure bucket settings:
   - **Name**: `booking-files`
   - **Public bucket**: ❌ **UNCHECKED** (must be private!)
   - **File size limit**: `5242880` (5MB in bytes)
   - **Allowed MIME types**: Leave empty (we validate in code)
5. Click **Create bucket**

### Via Supabase CLI (Alternative)

```bash
# Create private bucket
supabase storage create booking-files --private

# Set file size limit
supabase storage update booking-files --file-size-limit 5242880
```

**Verification:**

```bash
# List all buckets
supabase storage list

# Expected output:
# booking-files (private)
```

---

## Step 2: Configure RLS Policies

### Policy 1: Allow Signed URL Uploads

This policy allows uploads via signed URLs for the `payment-proofs` folder.

**SQL:**

```sql
-- Allow uploads via signed URLs
CREATE POLICY "Allow signed uploads to payment-proofs"
ON storage.objects
FOR INSERT
TO authenticated, anon
WITH CHECK (
  bucket_id = 'booking-files'
  AND (storage.foldername(name))[1] = 'payment-proofs'
);
```

**Explanation:**

- `TO authenticated, anon`: Allows both authenticated users and anonymous users (guests)
- `bucket_id = 'booking-files'`: Restricts to our specific bucket
- `(storage.foldername(name))[1] = 'payment-proofs'`: Only allows uploads to the `payment-proofs` subfolder

---

### Policy 2: Allow Authenticated Users to Read

This policy allows admin users to view payment proofs for verification.

**SQL:**

```sql
-- Allow authenticated users (admin) to read payment proofs
CREATE POLICY "Allow authenticated read of payment-proofs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'booking-files'
  AND (storage.foldername(name))[1] = 'payment-proofs'
);
```

**Explanation:**

- `TO authenticated`: Only logged-in users (admin) can read files
- Guests who uploaded the file cannot read it back (intentional - prevents abuse)
- Admin fetches files via signed URLs in the dashboard

---

### Policy 3: Prevent Direct Deletion

We want to control deletion through cleanup cron jobs only.

**SQL:**

```sql
-- Prevent direct deletion by users
-- Deletion handled by cleanup cron jobs with service_role key
CREATE POLICY "Prevent direct deletion"
ON storage.objects
FOR DELETE
TO authenticated, anon
USING (false); -- Always deny
```

**Explanation:**

- `USING (false)`: Unconditionally denies deletion attempts
- Cleanup cron jobs use `service_role` key which bypasses RLS
- Prevents accidental or malicious deletion of payment proofs

---

## Step 3: Execute RLS Policies

### Via Supabase Dashboard

1. Go to: `https://app.supabase.com/project/<your-project>/sql/new`
2. Copy all 3 policy SQL statements from Step 2
3. Paste into SQL Editor
4. Click **Run** button
5. Verify success message: "Success. No rows returned"

### Via Supabase CLI

```bash
# Create file with policies
cat > setup-storage-policies.sql << 'EOF'
-- Allow uploads via signed URLs
CREATE POLICY "Allow signed uploads to payment-proofs"
ON storage.objects
FOR INSERT
TO authenticated, anon
WITH CHECK (
  bucket_id = 'booking-files'
  AND (storage.foldername(name))[1] = 'payment-proofs'
);

-- Allow authenticated read
CREATE POLICY "Allow authenticated read of payment-proofs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'booking-files'
  AND (storage.foldername(name))[1] = 'payment-proofs'
);

-- Prevent direct deletion
CREATE POLICY "Prevent direct deletion"
ON storage.objects
FOR DELETE
TO authenticated, anon
USING (false);
EOF

# Execute policies
supabase db push setup-storage-policies.sql
```

**Verification:**

```sql
-- Check policies exist
SELECT *
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%payment-proofs%';

-- Expected: 3 rows (Insert, Select, Delete policies)
```

---

## Step 4: Test Signed URL Generation

Test that the upload URL endpoint can generate signed URLs correctly.

### Manual Test (curl)

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

**Expected Response:**

```json
{
  "success": true,
  "upload_url": "https://<project>.supabase.co/storage/v1/upload/sign/booking-files/payment-proofs/BK-TEST-001_1234567890.jpg?token=...",
  "file_path": "payment-proofs/BK-TEST-001_1234567890.jpg",
  "expires_in": 300
}
```

**If Errors:**

- **404 "Bucket not found"**: Bucket name is not exactly `booking-files`
- **403 "Permission denied"**: RLS policy for INSERT not configured correctly
- **500 "Internal error"**: Check Supabase credentials in `.env.local`

---

## Step 5: Test File Upload

Test uploading a file to the signed URL.

### Prepare Test File

```bash
# Create a small test JPEG (1KB)
echo "fake jpeg" > test-receipt.jpg

# Or use a real image file
cp /path/to/real/image.jpg test-receipt.jpg
```

### Upload to Signed URL

```bash
# Step 1: Get signed URL
RESPONSE=$(curl -s -X POST http://localhost:5173/api/guest-booking/upload-url \
  -H "Content-Type: application/json" \
  -d '{
    "booking_reference": "BK-TEST-002",
    "file_name": "test-receipt.jpg",
    "file_type": "image/jpeg",
    "file_size": 1024
  }')

# Step 2: Extract upload URL
UPLOAD_URL=$(echo $RESPONSE | jq -r '.upload_url')

# Step 3: Upload file
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: image/jpeg" \
  --data-binary @test-receipt.jpg

# Expected: Empty response with HTTP 200
```

---

## Step 6: Verify File in Storage

### Via Supabase Dashboard

1. Go to: Storage > booking-files > payment-proofs
2. Look for files matching pattern: `BK-TEST-*_*.jpg`
3. Click on file to preview
4. Should see file details (size, type, created date)

### Via Supabase CLI

```bash
# List files in payment-proofs folder
supabase storage ls booking-files/payment-proofs

# Expected output:
# BK-TEST-001_1234567890.jpg  1.0 KB  2025-01-28 12:34:56
# BK-TEST-002_1234567891.jpg  1.0 KB  2025-01-28 12:35:10
```

---

## Step 7: CORS Configuration (if needed)

If uploads fail with CORS errors, configure allowed origins.

### Via Supabase Dashboard

1. Go to: Storage > Settings (gear icon)
2. Scroll to **CORS Configuration**
3. Add allowed origins:
   ```json
   {
     "allowedOrigins": [
       "http://localhost:5173",
       "http://localhost:8788",
       "https://your-domain.pages.dev"
     ],
     "allowedMethods": ["GET", "POST", "PUT"],
     "allowedHeaders": ["Content-Type", "Authorization"]
   }
   ```
4. Click **Save**

### Via Supabase CLI

```bash
supabase storage update booking-files \
  --cors '{
    "allowedOrigins": ["http://localhost:5173", "https://your-domain.pages.dev"],
    "allowedMethods": ["GET", "POST", "PUT"],
    "allowedHeaders": ["Content-Type", "Authorization"]
  }'
```

---

## Step 8: Cleanup Test Files

After testing, clean up test files to avoid clutter.

### Via Supabase Dashboard

1. Go to: Storage > booking-files > payment-proofs
2. Select all files starting with `BK-TEST-`
3. Click **Delete** button
4. Confirm deletion

### Via Supabase CLI

```bash
# Delete specific test file
supabase storage rm booking-files/payment-proofs/BK-TEST-001_*.jpg

# Or delete all files in folder (CAREFUL!)
supabase storage rm -r booking-files/payment-proofs/BK-TEST-*
```

---

## Production Checklist

Before deploying to production, verify:

- [ ] **Bucket Privacy**: `booking-files` bucket is **private** (not public)
- [ ] **RLS Policies**: All 3 policies created (Insert, Select, Delete)
- [ ] **File Size Limit**: 5MB limit enforced
- [ ] **CORS Configuration**: Allowed origins include production domain
- [ ] **Signed URL Expiry**: 5-minute expiry working correctly
- [ ] **Cleanup Cron**: Weekly cleanup job configured (Chunk 005)
- [ ] **Environment Variables**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set in production
- [ ] **Service Role Key**: `SUPABASE_SERVICE_ROLE_KEY` set for cron jobs

---

## Troubleshooting

### Upload Fails with "Permission Denied"

**Cause**: RLS policy not allowing signed URL uploads

**Fix**:

```sql
-- Verify INSERT policy exists
SELECT * FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname = 'Allow signed uploads to payment-proofs';

-- If missing, recreate policy (see Step 2)
```

---

### Upload Fails with "Bucket Not Found"

**Cause**: Bucket name mismatch

**Fix**:

```bash
# List all buckets
supabase storage list

# Ensure bucket name is exactly "booking-files" (case-sensitive)
```

---

### CORS Errors in Browser

**Cause**: Origin not allowed in CORS configuration

**Fix**:

1. Check browser console for exact origin (e.g., `http://localhost:5173`)
2. Add that origin to CORS configuration (Step 7)
3. Clear browser cache and retry

---

### File Upload Succeeds but Not Visible

**Cause**: Uploaded to wrong folder or bucket

**Fix**:

```bash
# Check file path in response
# Should be: "payment-proofs/BK-*_*.{ext}"

# List all files in bucket
supabase storage ls booking-files --recursive

# Verify file is in correct location
```

---

## Security Notes

1. **Private Bucket**: Payment proofs contain sensitive financial data. NEVER make bucket public.
2. **Signed URLs**: 5-minute expiry prevents URL reuse. Do not extend beyond 10 minutes.
3. **Magic Number Validation**: Client validates file headers before upload (prevents spoofing).
4. **Server Validation**: API endpoint re-validates file type and size (defense-in-depth).
5. **No Public Access**: Only admin can view files via signed URLs (guest cannot retrieve their own uploads).
6. **Retention Policy**: Files auto-deleted after 90 days (compliance, storage optimization).

---

## Next Steps

After completing setup:

1. ✅ Mark chunk 008 Supabase setup as complete
2. ➡️ Proceed to checkpoint verification (checkpoint.md)
3. ➡️ Test upload workflow in dev environment
4. ➡️ Ready for chunk 009: Form Validation and Submission

---

**Last Updated**: 2025-01-28
**Chunk**: 008 - Payment Proof Upload
