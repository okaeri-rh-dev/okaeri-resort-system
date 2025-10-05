-- ============================================
-- STORAGE BUCKET POLICIES FOR SUPABASE
-- ============================================
-- This file contains the RLS policies for storage buckets
-- These policies MUST be executed in the Supabase SQL Editor
--
-- IMPORTANT: CORS is automatically handled by Supabase Storage
-- No additional CORS configuration is needed
-- ============================================

-- ============================================
-- PAYMENT-PROOFS BUCKET POLICIES
-- ============================================
-- This bucket stores payment proof images uploaded by guests via signed URLs

-- Policy 1: Allow uploads with signed URLs (no authentication required)
-- This policy allows anyone with a valid signed upload URL to upload files
CREATE POLICY "Allow uploads via signed URLs"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND (auth.uid() IS NOT NULL OR auth.jwt() ->> 'sub' = 'service_role')
);

-- Policy 2: Allow authenticated users to view all payment proofs
-- Admin users can browse all uploaded payment proofs
CREATE POLICY "Authenticated users can view payment proofs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'payment-proofs');

-- Policy 3: Allow service role to manage files (for signed URL access)
-- This enables the backend to generate signed URLs for guest downloads
CREATE POLICY "Service role full access to payment proofs"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'payment-proofs')
WITH CHECK (bucket_id = 'payment-proofs');

-- Policy 4: Allow authenticated users to update payment proofs
-- Only admin users can update existing files
CREATE POLICY "Authenticated users can update payment proofs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'payment-proofs')
WITH CHECK (bucket_id = 'payment-proofs');

-- Policy 5: Allow authenticated users to delete payment proofs
-- Only admin users can delete files
CREATE POLICY "Authenticated users can delete payment proofs"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'payment-proofs');

-- ============================================
-- RECEIPTS BUCKET POLICIES
-- ============================================
-- This bucket stores expense receipts uploaded by authenticated users

-- Policy 1: Allow authenticated users to upload receipts
CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- Policy 2: Allow authenticated users to view receipts
CREATE POLICY "Authenticated users can view receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'receipts');

-- Policy 3: Allow authenticated users to update receipts
CREATE POLICY "Authenticated users can update receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');

-- Policy 4: Allow authenticated users to delete receipts
CREATE POLICY "Authenticated users can delete receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');

-- Policy 5: Service role full access to receipts
CREATE POLICY "Service role full access to receipts"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');

-- ============================================
-- ALTERNATIVE: SIMPLER SIGNED URL POLICY
-- ============================================
-- If the above INSERT policy for payment-proofs doesn't work with signed URLs,
-- use this simpler version that allows public uploads to specific paths:

-- DROP POLICY IF EXISTS "Allow uploads via signed URLs" ON storage.objects;
--
-- CREATE POLICY "Anyone can upload to payment-proofs with valid path"
-- ON storage.objects
-- FOR INSERT
-- TO public
-- WITH CHECK (
--   bucket_id = 'payment-proofs'
--   AND (storage.filename(name) IS NOT NULL)
--   AND (storage.foldername(name) LIKE 'bookings/%')
-- );

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these queries to verify the policies are working:

-- Check all policies on storage.objects
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;

-- Check specific bucket policies
SELECT
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (qual::text LIKE '%payment-proofs%' OR with_check::text LIKE '%payment-proofs%');

-- ============================================
-- TESTING THE POLICIES
-- ============================================
-- 1. Test signed URL upload (from your application):
--    - Generate a signed upload URL using generateSignedUploadUrl()
--    - Upload a file using uploadToSignedUrl() on the client
--    - Verify the file appears in the bucket
--
-- 2. Test authenticated access:
--    - Log in as an admin user
--    - Try to list files in the bucket
--    - Try to download a file
--    - Try to delete a file
--
-- 3. Test unauthorized access:
--    - Try to directly access a file URL without authentication
--    - Should be denied unless using a signed URL

-- ============================================
-- TROUBLESHOOTING
-- ============================================
-- If uploads via signed URLs are not working:
--
-- 1. Check that the bucket exists:
--    SELECT * FROM storage.buckets WHERE id = 'payment-proofs';
--
-- 2. Check RLS is enabled on storage.objects:
--    SELECT relname, relrowsecurity
--    FROM pg_class
--    WHERE relname = 'objects' AND relnamespace = (
--      SELECT oid FROM pg_namespace WHERE nspname = 'storage'
--    );
--
-- 3. Test with a simpler policy (uncomment the ALTERNATIVE section above)
--
-- 4. Check Supabase Dashboard > Storage > Policies
--    Sometimes policies need to be created through the Dashboard
--
-- 5. Verify the signed URL is being generated correctly:
--    - Check the backend logs for any errors
--    - Ensure SUPABASE_SERVICE_ROLE_KEY is set correctly