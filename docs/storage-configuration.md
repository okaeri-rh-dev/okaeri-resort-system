# Storage Configuration Guide

## Overview

This guide covers the complete setup and configuration of Supabase Storage for the Okaeri Resort System, specifically for handling payment proof uploads via signed URLs and receipt management.

## Key Features

- **Signed URL Uploads**: Guests can upload payment proofs without authentication
- **Automatic CORS Handling**: Supabase manages CORS headers automatically
- **Secure File Access**: Files require authentication or signed URLs to access
- **Admin Management**: Full CRUD operations for authenticated admin users

## Buckets

### 1. payment-proofs

- **Purpose**: Stores payment proof images uploaded by guests
- **Access**: Public uploads via signed URLs, private downloads
- **File Types**: PNG, JPEG, JPG (max 5MB)
- **Path Structure**: `/bookings/{bookingId}/{year}/{month}/{timestamp}_{randomId}.{ext}`

### 2. receipts

- **Purpose**: Stores expense receipts uploaded by admin users
- **Access**: Authenticated users only
- **File Types**: PNG, JPEG, JPG, PDF (max 5MB)
- **Path Structure**: `/expenses/{expenseId}/{year}/{month}/{timestamp}_{randomId}.{ext}`

## Setup Instructions

### Step 1: Create Storage Buckets

1. Go to [Supabase Dashboard](https://app.supabase.com) → Storage
2. Create the `payment-proofs` bucket:
   ```
   Name: payment-proofs
   Public: OFF (keep it private)
   File size limit: 5MB
   Allowed MIME types: image/png, image/jpeg, image/jpg
   ```
3. Create the `receipts` bucket:
   ```
   Name: receipts
   Public: OFF (keep it private)
   File size limit: 5MB
   Allowed MIME types: image/png, image/jpeg, image/jpg, application/pdf
   ```

### Step 2: Apply Storage Policies

#### Option A: Via SQL Editor (Recommended)

1. Open Supabase Dashboard → SQL Editor
2. Copy and run the entire contents of `/database/storage-policies.sql`
3. Verify policies were created:
   ```sql
   SELECT policyname, cmd, roles
   FROM pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
   ORDER BY policyname;
   ```

#### Option B: Via Dashboard UI

1. Go to Storage → Select bucket → Policies tab
2. For `payment-proofs` bucket, create these policies:

   **Upload Policy (INSERT)**:
   - Name: "Allow uploads via signed URLs"
   - Allowed operation: INSERT
   - Target roles: public
   - WITH CHECK: `bucket_id = 'payment-proofs'`

   **View Policy (SELECT)**:
   - Name: "Authenticated users can view"
   - Allowed operation: SELECT
   - Target roles: authenticated
   - USING: `bucket_id = 'payment-proofs'`

   **Update Policy (UPDATE)**:
   - Name: "Authenticated users can update"
   - Allowed operation: UPDATE
   - Target roles: authenticated
   - USING: `bucket_id = 'payment-proofs'`
   - WITH CHECK: `bucket_id = 'payment-proofs'`

   **Delete Policy (DELETE)**:
   - Name: "Authenticated users can delete"
   - Allowed operation: DELETE
   - Target roles: authenticated
   - USING: `bucket_id = 'payment-proofs'`

### Step 3: Configure Environment Variables

Ensure these are set in your environment:

```env
# .env.local (for development)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# For production (Cloudflare Workers)
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

### Step 4: Test the Configuration

#### Test Signed URL Upload (Guest Flow)

1. **Generate signed URL** (backend):

   ```typescript
   const { path, token, bucket } = await generateSignedUploadUrl(
     supabaseAdmin,
     "payment-proofs",
     `bookings/${bookingId}/${filename}`,
     3600
   );
   ```

2. **Upload file** (frontend):

   ```typescript
   const { data, error } = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file);
   ```

3. **Verify upload**:
   - Check Supabase Dashboard → Storage → payment-proofs
   - File should appear at the specified path

#### Test Authenticated Access

1. **Login as admin user**
2. **List files**:

   ```typescript
   const { data, error } = await supabase.storage.from("payment-proofs").list("bookings");
   ```

3. **Download file**:
   ```typescript
   const { data, error } = await supabase.storage.from("payment-proofs").download("path/to/file");
   ```

## CORS Configuration

### Important: CORS is Automatic!

Supabase Storage automatically handles CORS for all operations:

- **Automatic Headers**: Supabase adds appropriate CORS headers to all storage requests
- **No Configuration Needed**: You don't need to configure CORS in your application
- **Supported Origins**: All origins are allowed by default (`Access-Control-Allow-Origin: *`)

### Application-Level Configuration

Your application's CSP (Content Security Policy) in `/functions/_middleware.ts` already allows:

- Connections to `https://*.supabase.co`
- Image sources from any HTTPS URL
- Blob URLs for file previews

## Security Considerations

### File Upload Security

1. **File Size Validation**: Enforced both client-side and server-side (5MB max)
2. **File Type Validation**: Only allowed MIME types can be uploaded
3. **Path Sanitization**: Filenames are sanitized to prevent path traversal
4. **Unique Filenames**: Timestamps and UUIDs prevent collisions
5. **No Overwrites**: `upsert: false` prevents accidental overwrites

### Access Control

1. **Signed URLs Expire**: Default 1-hour expiry for upload URLs
2. **Private by Default**: Buckets are not publicly accessible
3. **RLS Protection**: Row Level Security enforces access policies
4. **Service Role Only**: Signed URL generation requires service role key

## Troubleshooting

### Issue: "Failed to upload payment proof"

**Possible Causes**:

1. Signed URL expired (default 1 hour)
2. File size exceeds 5MB limit
3. Invalid file type
4. Network connectivity issues

**Solutions**:

- Regenerate signed URL if expired
- Compress images before upload
- Verify file type is PNG/JPEG
- Check network connection

### Issue: "CORS error when uploading"

**This should not happen** as Supabase handles CORS automatically. If it does:

1. **Verify Supabase URL**: Ensure using correct project URL
2. **Check Browser Console**: Look for specific error messages
3. **Test Direct Upload**: Try uploading directly via Supabase Dashboard
4. **Review CSP Headers**: Ensure middleware isn't blocking Supabase domains

### Issue: "Policy violation: new row violates RLS"

**Possible Causes**:

1. Storage policies not applied correctly
2. Bucket doesn't exist
3. Invalid bucket name in code

**Solutions**:

1. Re-run `/database/storage-policies.sql`
2. Verify bucket exists in Dashboard
3. Check bucket name matches exactly (case-sensitive)

### Issue: "Unauthorized" when generating signed URL

**Possible Causes**:

1. Missing or invalid `SUPABASE_SERVICE_ROLE_KEY`
2. Using anon key instead of service role key

**Solutions**:

1. Verify service role key is set correctly
2. Ensure using `createSupabaseAdmin()` not regular client

## Monitoring & Maintenance

### Regular Tasks

1. **Monitor Storage Usage**: Check Dashboard → Storage → Usage
2. **Clean Up Old Files**: Implement retention policies
3. **Review Access Logs**: Monitor for unusual access patterns
4. **Update File Size Limits**: Adjust based on user needs

### Performance Optimization

1. **Image Compression**: Compress images before upload
2. **Lazy Loading**: Load images only when visible
3. **CDN Caching**: Supabase automatically caches via CDN
4. **Batch Operations**: Use batch delete for cleanup

## Code Examples

### Backend: Generate Signed Upload URL

```typescript
// /functions/api/guest-booking.ts
import { generateSignedUploadUrl } from "@/lib/supabase-admin";

const uploadUrl = await generateSignedUploadUrl(
  supabaseAdmin,
  "payment-proofs",
  `bookings/${bookingId}/payment-${Date.now()}.jpg`,
  3600 // 1 hour expiry
);

return {
  upload: {
    path: uploadUrl.path,
    token: uploadUrl.token,
    bucket: uploadUrl.bucket,
    expires_at: uploadUrl.expires_at,
  },
};
```

### Frontend: Upload File

```typescript
// /src/components/GuestBookingForm.tsx
const { data, error } = await supabase.storage
  .from(uploadData.bucket)
  .uploadToSignedUrl(uploadData.path, uploadData.token, file, { contentType: file.type });
```

### Admin: List and Download Files

```typescript
// List all payment proofs for a booking
const { data: files } = await supabase.storage.from("payment-proofs").list(`bookings/${bookingId}`);

// Generate signed URL for download
const { data: signedUrl } = await supabase.storage
  .from("payment-proofs")
  .createSignedUrl(filePath, 3600);
```

## Related Documentation

- [Supabase Storage Guide](https://supabase.com/docs/guides/storage)
- [RLS Policies Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Security Best Practices](https://supabase.com/docs/guides/storage/security)
- Project Files:
  - `/database/storage-policies.sql` - Storage RLS policies
  - `/database/enable-rls.sql` - Database RLS setup
  - `/src/lib/storage-security.ts` - Client-side validation
  - `/src/lib/supabase-admin.ts` - Server-side storage functions
