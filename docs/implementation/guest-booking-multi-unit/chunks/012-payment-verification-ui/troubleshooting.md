# Troubleshooting: Chunk 012

## Common Issues and Solutions

This document provides solutions to common issues encountered during chunk 012 implementation.

---

## Issue 1: Signed URL Returns 403 Forbidden

**Symptom**:

- Payment proof viewer shows error
- Browser console error: `403 Forbidden` when loading image/PDF
- Signed URL generated but file not accessible

**Possible Causes**:

### Cause A: Incorrect Bucket Name

**Debugging**:

```typescript
// Check bucket name in storage-utils.ts
const BUCKET_NAME = "booking-files"; // Should match Supabase bucket
```

**Solution**: Verify bucket name matches Supabase Storage:

1. Go to Supabase Dashboard → Storage
2. Check bucket name (should be `booking-files`)
3. Update `BUCKET_NAME` constant in `storage-utils.ts` if different

### Cause B: RLS Policies Blocking Access

**Debugging**:

```sql
-- Check RLS policies on booking-files bucket
SELECT * FROM storage.policies WHERE bucket_id = 'booking-files';
```

**Solution**: Add RLS policy for admin access:

```sql
-- Allow admins to read all files in booking-files bucket
CREATE POLICY "Admins can read booking files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'booking-files' AND
  (auth.jwt() ->> 'role')::text = 'admin'
);
```

### Cause C: Using Anon Key Instead of Service Role

**Debugging**:

```typescript
// Verify using service role in API endpoint
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
```

**Solution**: Ensure API endpoint uses `SUPABASE_SERVICE_ROLE_KEY`, not `SUPABASE_ANON_KEY`.

In `functions/api/admin/verify-payment.ts`, check:

```typescript
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
  },
});
```

---

## Issue 2: Image Doesn't Display

**Symptom**:

- Signed URL generated successfully
- No 403 error
- Image placeholder or broken image icon

**Possible Causes**:

### Cause A: Incorrect File Path Format

**Debugging**:

```sql
-- Check payment proof path format
SELECT booking_reference, payment_proof_path
FROM bookings
WHERE payment_proof_path IS NOT NULL
LIMIT 5;
```

**Expected Format**: `payment-proofs/BOOKING-REF_timestamp.ext`

**Solution**: Verify file path does NOT include bucket name:

```typescript
// CORRECT
const filePath = "payment-proofs/TEST-ABC123_1234567890.jpg";

// INCORRECT (includes bucket name)
const filePath = "booking-files/payment-proofs/TEST-ABC123.jpg";
```

### Cause B: File Doesn't Exist in Storage

**Solution**: Upload test file to Supabase Storage:

1. Supabase Dashboard → Storage → `booking-files` bucket
2. Navigate to `payment-proofs/` folder (create if needed)
3. Upload test image (JPEG, PNG, or PDF)
4. Copy file name (e.g., `test_proof.jpg`)
5. Update booking record:

```sql
UPDATE bookings
SET payment_proof_path = 'payment-proofs/test_proof.jpg'
WHERE booking_reference = 'TEST-BOOKING-123';
```

### Cause C: CORS Issue

**Symptom**: Browser console error: `CORS policy blocked`

**Solution**: Configure CORS in Supabase Storage:

1. Supabase Dashboard → Storage → `booking-files` → Settings
2. Add allowed origin: `http://localhost:5173` (development) or your production domain
3. Save settings

---

## Issue 3: PDF Viewer Shows Blank Page

**Symptom**:

- PDF component renders
- Page navigation visible
- PDF content doesn't display (blank white page)

**Possible Causes**:

### Cause A: PDF Worker Not Configured

**Debugging**:

```bash
# Check if PDF worker exists
ls -lah public/pdf.worker.js
```

**Solution**: Copy PDF worker file:

```bash
# Create public directory
mkdir -p public

# Copy worker from node_modules
cp node_modules/pdfjs-dist/build/pdf.worker.min.js public/pdf.worker.js

# Verify file size (should be 1-2 MB)
ls -lh public/pdf.worker.js
```

In `PaymentProofViewer.tsx`, ensure worker configured:

```typescript
import { pdfjs } from "react-pdf";

// Configure worker path
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.js";
```

### Cause B: PDF File Corrupted

**Debugging**: Download PDF directly from Supabase Storage and try opening in Adobe Reader.

**Solution**: Re-upload valid PDF file.

### Cause C: react-pdf Version Mismatch

**Solution**: Ensure compatible versions:

```bash
npm install react-pdf@^7.0.0 pdfjs-dist@^3.11.0
```

---

## Issue 4: Zoom Controls Not Working

**Symptom**:

- Zoom buttons visible
- Clicking zoom buttons does nothing
- Image doesn't zoom

**Possible Causes**:

### Cause A: react-zoom-pan-pinch Not Installed

**Debugging**:

```bash
npm list react-zoom-pan-pinch
```

**Solution**: Install package:

```bash
npm install react-zoom-pan-pinch
```

### Cause B: TransformWrapper Not Wrapping Image

**Solution**: Verify component structure:

```typescript
<TransformWrapper initialScale={1} minScale={0.5} maxScale={4}>
  {({ zoomIn, zoomOut, resetTransform }) => (
    <>
      {/* Controls */}
      <div>
        <Button onClick={() => zoomIn()}>Zoom In</Button>
        <Button onClick={() => zoomOut()}>Zoom Out</Button>
      </div>

      {/* Image MUST be inside TransformComponent */}
      <TransformComponent>
        <img src={signedUrl.url} alt="Payment proof" />
      </TransformComponent>
    </>
  )}
</TransformWrapper>
```

### Cause C: CSS Conflicts

**Solution**: Add container styles:

```typescript
<TransformComponent
  wrapperStyle={{ width: '100%', height: '600px' }}
  contentStyle={{ width: '100%', height: '100%' }}
>
  <img src={signedUrl.url} alt="Payment proof" />
</TransformComponent>
```

---

## Issue 5: Verify Action Fails

**Symptom**:

- Click "Verify Payment"
- API request fails
- Error message displayed

**Possible Causes**:

### Cause A: Payment Already Verified

**Debugging**: Check current payment status:

```sql
SELECT booking_reference, payment_status
FROM bookings
WHERE booking_id = 'your-booking-id';
```

**Solution**: This is expected behavior (idempotent). If status is not 'Pending', verification will fail with 409 Conflict.

To reset for testing:

```sql
UPDATE bookings
SET payment_status = 'Pending'
WHERE booking_id = 'your-booking-id';
```

### Cause B: Missing Authorization Header

**Debugging**: Check browser DevTools → Network tab → Request headers

Expected:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Solution**: Verify auth token stored:

```javascript
// Browser console
console.log(localStorage.getItem("auth_token"));
// Should return JWT string, not null
```

Re-login if token missing.

### Cause C: Database Connection Error

**Debugging**: Check API endpoint logs (if using Wrangler dev):

```bash
# Terminal running npm run dev
# Look for error messages
```

**Solution**: Verify `.env.local` has correct Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Issue 6: Audit Log Not Writing

**Symptom**:

- Payment verified successfully
- No audit log entry in database

**Possible Causes**:

### Cause A: audit_logs Table Missing

**Debugging**:

```sql
-- Check if audit_logs table exists
SELECT * FROM information_schema.tables
WHERE table_name = 'audit_logs';
```

**Solution**: Create audit_logs table (should be from chunk 001):

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  user_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Cause B: Non-Fatal Audit Error Logged

**Debugging**: Check API endpoint logs for audit errors:

```typescript
if (auditError) {
  console.error("Failed to write audit log:", auditError);
  // Non-fatal - continues anyway
}
```

**Solution**: Fix audit log schema or RLS policies.

### Cause C: Incorrect Column Names

**Solution**: Verify audit log INSERT matches table schema:

```typescript
await supabase.from("audit_logs").insert({
  action: "payment.verified",
  entity_type: "booking",
  entity_id: booking_id,
  user_id: user.id,
  metadata: {
    /* ... */
  },
  created_at: new Date().toISOString(),
});
```

---

## Issue 7: Signed URL Expired (403 After 5 Minutes)

**Symptom**:

- Payment proof displays initially
- After 5 minutes, image/PDF returns 403
- No auto-renewal

**Possible Causes**:

### Cause A: Auto-Renewal Not Implemented

**Debugging**: Check if renewal interval set:

```typescript
// In PaymentProofViewer.tsx useEffect
const renewalInterval = setInterval(() => {
  if (signedUrl && shouldRenewSignedUrl(signedUrl.expiresAt)) {
    renewSignedUrl(paymentProofPath, setSignedUrl);
  }
}, 30000); // Should be 30000 (30 seconds)

return () => clearInterval(renewalInterval);
```

**Solution**: Ensure cleanup function returns `clearInterval`.

### Cause B: shouldRenewSignedUrl Logic Incorrect

**Debugging**: Add console logs:

```typescript
export function shouldRenewSignedUrl(expiresAt: Date): boolean {
  const now = Date.now();
  const expiryTime = expiresAt.getTime();
  const oneMinuteBeforeExpiry = expiryTime - 60 * 1000;

  console.log("Now:", new Date(now));
  console.log("Expires:", new Date(expiryTime));
  console.log("Should renew:", now >= oneMinuteBeforeExpiry);

  return now >= oneMinuteBeforeExpiry;
}
```

**Solution**: Verify logic renews 1 minute before expiry (not after).

---

## Issue 8: Rejection Reason Not Saved

**Symptom**:

- Reject payment with reason
- Status updates to 'Rejected'
- Audit log doesn't contain reason

**Possible Causes**:

### Cause A: Metadata Structure Incorrect

**Debugging**: Check audit log metadata:

```sql
SELECT metadata FROM audit_logs
WHERE action = 'payment.rejected'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected**:

```json
{
  "admin_id": "uuid",
  "admin_email": "admin@example.com",
  "rejection_reason": "Amount mismatch - ₱10k shown, ₱30k required",
  "timestamp": "2025-10-24T..."
}
```

**Solution**: Verify API endpoint builds metadata correctly:

```typescript
const auditMetadata: Record<string, any> = {
  admin_id: user.id,
  admin_email: user.email,
  timestamp: new Date().toISOString(),
};

if (action === "reject") {
  auditMetadata.rejection_reason = reason; // ← Must include this
}
```

---

## Issue 9: Cannot Verify/Reject Twice (Idempotent) Not Working

**Symptom**:

- Can verify payment multiple times
- No 409 Conflict error

**Possible Causes**:

### Cause A: Idempotency Check Missing

**Debugging**: Check API endpoint has idempotency check:

```typescript
// Check if already verified/rejected
if (booking.payment_status !== "Pending") {
  return new Response(
    JSON.stringify({
      error: `Payment already ${booking.payment_status.toLowerCase()}`,
      current_status: booking.payment_status,
    }),
    {
      status: 409, // ← Must be 409 Conflict
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
```

**Solution**: Add idempotency check before update.

---

## Issue 10: Mobile Layout Broken

**Symptom**:

- Payment proof viewer overflows on mobile
- Buttons overlap
- Horizontal scroll appears

**Possible Causes**:

### Cause A: Missing Responsive Classes

**Solution**: Add responsive classes to action buttons:

```typescript
<div className="flex flex-col sm:flex-row gap-4 pt-4">
  <Button size="lg" className="flex-1">Verify Payment</Button>
  <Button size="lg" className="flex-1">Reject Payment</Button>
</div>
```

### Cause B: Fixed Width on Image Container

**Solution**: Use responsive width:

```typescript
<TransformComponent
  wrapperStyle={{ width: '100%', height: '400px' }} // ← 100% width
  contentStyle={{ width: '100%', height: '100%' }}
>
  <img src={signedUrl.url} className="max-w-full h-auto" />
</TransformComponent>
```

---

## General Debugging Steps

If none of the above solutions work:

### 1. Check Browser Console

```
F12 → Console tab
```

Look for:

- Red error messages
- Network errors (failed API calls, 403/404 errors)
- React warnings

### 2. Check Network Tab

```
F12 → Network tab → Filter: Fetch/XHR
```

Verify:

- API request sent to `/api/admin/verify-payment`
- Request payload correct (`booking_id`, `action`, `reason`)
- Response status (200 = success, 401/403 = auth, 409 = conflict)
- Response body (error messages)

### 3. Check Supabase Logs

```
Supabase Dashboard → Logs → API
```

Look for:

- RLS policy violations
- Database errors
- Storage access errors

### 4. Verify Environment Variables

```bash
# Check .env.local exists
cat .env.local

# Verify Supabase variables set
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY
```

### 5. Check Dependencies Installed

```bash
npm list react-pdf
npm list react-zoom-pan-pinch
npm list pdfjs-dist
```

All should show installed versions.

### 6. Restart Dev Server

```bash
# Stop dev server (Ctrl+C)
# Clear cache
rm -rf node_modules/.vite

# Restart
npm run dev
```

---

## Still Stuck?

### Escalation Path

1. **Review checkpoint.md** - Ensure all checks completed
2. **Review instructions.md** - Re-read step-by-step guide
3. **Check source documentation**:
   - `docs/implementation/guest-booking-multi-unit/04-admin-interface.md` (lines 201-350)
   - `docs/implementation/guest-booking-multi-unit/CHUNKING-STRATEGY.md` (lines 410-444)
4. **Compare with existing patterns**:
   - `src/lib/supabase.ts` (Supabase Storage patterns)
   - `src/lib/audit-logger.ts` (Audit logging patterns)
5. **Check GitHub issues** (if project has public repo)
6. **Seek help**:
   - Project maintainer
   - Team lead
   - Developer forum

### Information to Provide When Asking for Help

```
**Issue Summary**: [One-sentence description]

**Chunk**: 012 - Payment Verification UI

**Step**: [Which step in instructions.md]

**Error Message**:
```

[Exact error text from console/terminal]

```

**What I've Tried**:
- [List troubleshooting steps attempted]

**Environment**:
- Node version: [Run: node --version]
- npm version: [Run: npm --version]
- OS: [macOS/Windows/Linux]
- Browser: [Chrome/Firefox/Safari with version]

**Screenshots**: [Attach if visual issue]

**Network Request** (if API error):
- Request URL: [e.g., POST /api/admin/verify-payment]
- Request payload: [Copy from DevTools]
- Response status: [e.g., 403]
- Response body: [Copy error response]
```

---

**Remember**: Most issues are configuration, missing files, or incorrect paths. Triple-check file paths, bucket names, and environment variables first.
