# Implementation Instructions: Chunk 012

## Overview

This guide walks you through implementing the payment verification interface with secure signed URLs, image zoom, PDF viewing, and audit trail integration. All code is copy-pasteable and production-ready.

**Estimated Time**: 85 minutes total

- Step 0: Install dependencies (5 min)
- Step 1: Storage utility (10 min)
- Step 2: Payment proof viewer component (30 min)
- Step 3: Verify payment API endpoint (15 min)
- Step 4: Booking detail API endpoint (10 min)
- Step 5: Routes and queue integration (10 min)
- Step 6: Testing and verification (5 min)

---

## Step 0: Install Required Dependencies (5 minutes)

Install libraries for PDF rendering and image zoom controls.

```bash
# Install react-pdf for PDF viewing
npm install react-pdf

# Install react-zoom-pan-pinch for image zoom/pan controls
npm install react-zoom-pan-pinch

# Install pdfjs-dist (peer dependency for react-pdf)
npm install pdfjs-dist

# Type check after install
npm run type-check
```

### Configure PDF.js Worker

Create `public/pdf.worker.js` symlink or copy worker file:

```bash
# Create public directory if it doesn't exist
mkdir -p public

# Copy pdf worker from node_modules
cp node_modules/pdfjs-dist/build/pdf.worker.min.js public/pdf.worker.js
```

**Verification**: Ensure `public/pdf.worker.js` exists

---

## Step 1: Create Storage Utility (10 minutes)

Create utility functions for generating and renewing signed URLs.

### Create File: `src/lib/storage-utils.ts`

```bash
touch src/lib/storage-utils.ts
```

### Copy Complete File Content

````typescript
/**
 * Supabase Storage Utility Functions
 *
 * Handles signed URL generation for private payment proof files
 * Features:
 * - 5-minute signed URL expiry
 * - Auto-renewal before expiry
 * - Private bucket access
 *
 * Source: docs/implementation/guest-booking-multi-unit/04-admin-interface.md lines 201-350
 */

import { supabase } from "./supabase";

// ============================================
// Constants
// ============================================

const SIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes
const BUCKET_NAME = "booking-files";

// ============================================
// Types
// ============================================

export interface SignedUrlResult {
  url: string;
  expiresAt: Date;
  error?: string;
}

// ============================================
// Signed URL Generation
// ============================================

/**
 * Generates a signed URL for a private file in Supabase Storage
 *
 * @param filePath - Path to file in storage bucket (e.g., "payment-proofs/TEST-ABC123_1234567890.jpg")
 * @returns Signed URL with expiry timestamp
 *
 * @example
 * const { url, expiresAt, error } = await generateSignedUrl('payment-proofs/TEST-ABC123.jpg');
 * if (error) {
 *   console.error('Failed to generate URL:', error);
 * } else {
 *   console.log('URL expires at:', expiresAt);
 *   // Use URL in <img src={url} /> or <embed src={url} />
 * }
 */
export async function generateSignedUrl(filePath: string): Promise<SignedUrlResult> {
  try {
    // Generate signed URL from Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY_SECONDS);

    if (error) {
      console.error("Supabase signed URL error:", error);
      return {
        url: "",
        expiresAt: new Date(),
        error: error.message,
      };
    }

    if (!data?.signedUrl) {
      return {
        url: "",
        expiresAt: new Date(),
        error: "No signed URL returned",
      };
    }

    // Calculate expiry timestamp
    const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000);

    return {
      url: data.signedUrl,
      expiresAt,
    };
  } catch (err) {
    console.error("Unexpected error generating signed URL:", err);
    return {
      url: "",
      expiresAt: new Date(),
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Checks if a signed URL needs renewal (1 minute before expiry)
 *
 * @param expiresAt - Expiry timestamp from generateSignedUrl()
 * @returns True if URL should be renewed
 */
export function shouldRenewSignedUrl(expiresAt: Date): boolean {
  const now = Date.now();
  const expiryTime = expiresAt.getTime();
  const oneMinuteBeforeExpiry = expiryTime - 60 * 1000;

  return now >= oneMinuteBeforeExpiry;
}

/**
 * Auto-renews signed URL if approaching expiry
 *
 * Usage pattern:
 * ```typescript
 * const [signedUrl, setSignedUrl] = useState<SignedUrlResult | null>(null);
 *
 * useEffect(() => {
 *   // Initial URL generation
 *   generateSignedUrl(filePath).then(setSignedUrl);
 *
 *   // Auto-renewal timer
 *   const interval = setInterval(async () => {
 *     if (signedUrl && shouldRenewSignedUrl(signedUrl.expiresAt)) {
 *       const renewed = await renewSignedUrl(filePath, setSignedUrl);
 *       console.log('URL renewed:', renewed);
 *     }
 *   }, 30000); // Check every 30s
 *
 *   return () => clearInterval(interval);
 * }, [filePath, signedUrl]);
 * ```
 *
 * @param filePath - Path to file
 * @param setSignedUrl - State setter function
 * @returns True if renewal successful
 */
export async function renewSignedUrl(
  filePath: string,
  setSignedUrl: (result: SignedUrlResult) => void
): Promise<boolean> {
  console.log("Renewing signed URL for:", filePath);

  const result = await generateSignedUrl(filePath);

  if (result.error) {
    console.error("Failed to renew signed URL:", result.error);
    return false;
  }

  setSignedUrl(result);
  console.log("Signed URL renewed, expires at:", result.expiresAt);
  return true;
}
````

### Verification

```bash
# Type check
npm run type-check

# Should show no errors in storage-utils.ts
```

**Expected**: No TypeScript errors

---

## Step 2: Create Payment Proof Viewer Component (30 minutes)

Create the React component for viewing and verifying payment proofs.

### Create File: `src/components/admin/PaymentProofViewer.tsx`

```bash
mkdir -p src/components/admin
touch src/components/admin/PaymentProofViewer.tsx
```

### Copy Complete Component Code

```typescript
/**
 * Payment Proof Viewer Component
 *
 * Displays uploaded payment proofs with zoom/pan (images) or scroll (PDFs)
 * Features:
 * - Signed URL fetching with auto-renewal
 * - Image zoom/pan controls
 * - PDF viewer with page navigation
 * - Verify/Reject actions with audit logging
 * - Rejection reason modal
 *
 * Source: docs/implementation/guest-booking-multi-unit/04-admin-interface.md lines 201-350
 */

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Document, Page, pdfjs } from 'react-pdf';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { CheckCircle, XCircle, ZoomIn, ZoomOut, RotateCcw, FileText } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { generateSignedUrl, renewSignedUrl, shouldRenewSignedUrl } from '@/lib/storage-utils';
import type { SignedUrlResult } from '@/lib/storage-utils';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.js';

// ============================================
// Types
// ============================================

interface PaymentProofViewerProps {
  bookingId: string;
  paymentProofPath: string | null;
  currentPaymentStatus: 'Pending' | 'Verified' | 'Rejected';
  onStatusChange?: () => void;
}

// ============================================
// Component
// ============================================

export function PaymentProofViewer({
  bookingId,
  paymentProofPath,
  currentPaymentStatus,
  onStatusChange,
}: PaymentProofViewerProps) {
  const [signedUrl, setSignedUrl] = useState<SignedUrlResult | null>(null);
  const [fileType, setFileType] = useState<'image' | 'pdf' | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const queryClient = useQueryClient();

  // ============================================
  // Signed URL Management
  // ============================================

  useEffect(() => {
    if (!paymentProofPath) return;

    // Generate initial signed URL
    generateSignedUrl(paymentProofPath).then((result) => {
      if (result.error) {
        console.error('Failed to generate signed URL:', result.error);
      } else {
        setSignedUrl(result);

        // Determine file type from path
        const ext = paymentProofPath.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') {
          setFileType('pdf');
        } else if (['jpg', 'jpeg', 'png'].includes(ext || '')) {
          setFileType('image');
        }
      }
    });

    // Auto-renewal timer (check every 30s, renew 1 min before expiry)
    const renewalInterval = setInterval(() => {
      if (signedUrl && shouldRenewSignedUrl(signedUrl.expiresAt)) {
        renewSignedUrl(paymentProofPath, setSignedUrl);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(renewalInterval);
  }, [paymentProofPath, signedUrl]);

  // ============================================
  // Payment Verification Mutation
  // ============================================

  const verifyMutation = useMutation({
    mutationFn: async (action: 'verify' | 'reject') => {
      const response = await fetch('/api/admin/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          booking_id: bookingId,
          action,
          reason: action === 'reject' ? rejectionReason : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Verification failed');
      }

      return response.json();
    },
    onSuccess: (data, action) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['pending-multi-unit-bookings']);
      queryClient.invalidateQueries(['booking', bookingId]);

      // Close dialog if reject
      if (action === 'reject') {
        setShowRejectDialog(false);
        setRejectionReason('');
      }

      // Callback to parent
      onStatusChange?.();
    },
    onError: (error) => {
      console.error('Verification error:', error);
      alert(`Failed to ${verifyMutation.variables}: ${error.message}`);
    },
  });

  // ============================================
  // Action Handlers
  // ============================================

  const handleVerify = () => {
    if (confirm('Verify this payment? This action will be logged.')) {
      verifyMutation.mutate('verify');
    }
  };

  const handleRejectSubmit = () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    verifyMutation.mutate('reject');
  };

  // ============================================
  // Loading & Error States
  // ============================================

  if (!paymentProofPath) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Proof</CardTitle>
          <CardDescription>No payment proof uploaded</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Guest has not uploaded payment proof yet. Booking remains in queue.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!signedUrl || signedUrl.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Proof</CardTitle>
          <CardDescription className="text-destructive">
            Error loading payment proof: {signedUrl?.error || 'Unknown error'}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // ============================================
  // Payment Status Badge
  // ============================================

  const getStatusBadge = () => {
    if (currentPaymentStatus === 'Verified') {
      return (
        <Alert className="border-green-500 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Payment verified - Ready for unit assignment
          </AlertDescription>
        </Alert>
      );
    }

    if (currentPaymentStatus === 'Rejected') {
      return (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Payment rejected - Guest must re-upload proof
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <Alert variant="default">
        <AlertDescription>
          Payment pending verification - Review proof below
        </AlertDescription>
      </Alert>
    );
  };

  // ============================================
  // Main Render
  // ============================================

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Payment Proof</CardTitle>
          <CardDescription>
            File: {paymentProofPath.split('/').pop()}
            {' • '}
            Expires: {signedUrl.expiresAt.toLocaleTimeString()}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status Badge */}
          {getStatusBadge()}

          {/* Image Viewer with Zoom/Pan */}
          {fileType === 'image' && (
            <div className="border rounded-lg overflow-hidden bg-gray-50">
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={4}
                centerOnInit
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <>
                    {/* Zoom Controls */}
                    <div className="flex gap-2 p-4 bg-white border-b">
                      <Button size="sm" variant="outline" onClick={() => zoomIn()}>
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => zoomOut()}>
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => resetTransform()}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <span className="ml-auto text-sm text-muted-foreground self-center">
                        Scroll to zoom • Drag to pan
                      </span>
                    </div>

                    {/* Image */}
                    <TransformComponent
                      wrapperStyle={{ width: '100%', height: '600px' }}
                      contentStyle={{ width: '100%', height: '100%' }}
                    >
                      <img
                        src={signedUrl.url}
                        alt="Payment proof"
                        className="max-w-full h-auto"
                        style={{ cursor: 'grab' }}
                      />
                    </TransformComponent>
                  </>
                )}
              </TransformWrapper>
            </div>
          )}

          {/* PDF Viewer */}
          {fileType === 'pdf' && (
            <div className="border rounded-lg overflow-hidden bg-gray-50">
              <div className="flex gap-2 p-4 bg-white border-b items-center">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Page {pageNumber} of {numPages || '...'}
                </span>
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
                    disabled={pageNumber <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPageNumber((prev) => Math.min(numPages, prev + 1))}
                    disabled={pageNumber >= numPages}
                  >
                    Next
                  </Button>
                </div>
              </div>

              <div className="p-4 flex justify-center">
                <Document
                  file={signedUrl.url}
                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  loading={<div className="text-center py-8">Loading PDF...</div>}
                  error={<div className="text-center py-8 text-destructive">Failed to load PDF</div>}
                >
                  <Page pageNumber={pageNumber} width={800} />
                </Document>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {currentPaymentStatus === 'Pending' && (
            <div className="flex gap-4 pt-4">
              <Button
                size="lg"
                className="flex-1"
                onClick={handleVerify}
                disabled={verifyMutation.isPending}
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                {verifyMutation.isPending && verifyMutation.variables === 'verify'
                  ? 'Verifying...'
                  : 'Verify Payment'}
              </Button>
              <Button
                size="lg"
                variant="destructive"
                className="flex-1"
                onClick={() => setShowRejectDialog(true)}
                disabled={verifyMutation.isPending}
              >
                <XCircle className="h-5 w-5 mr-2" />
                Reject Payment
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rejection Reason Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payment Proof</DialogTitle>
            <DialogDescription>
              Provide a reason for rejection. This will be logged and you will need to contact the guest.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Textarea
              placeholder="e.g., Amount mismatch - ₱10,000 shown, ₱30,000 required"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={!rejectionReason.trim() || verifyMutation.isPending}
            >
              {verifyMutation.isPending && verifyMutation.variables === 'reject'
                ? 'Rejecting...'
                : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

### Verification

```bash
# Type check
npm run type-check

# Should show no errors in PaymentProofViewer.tsx
```

**Expected**: Component compiles without errors

---

## Step 3: Create API Endpoint (15 minutes)

Create the Cloudflare Worker endpoint for verifying/rejecting payments.

### Create File: `functions/api/admin/verify-payment.ts`

```bash
touch functions/api/admin/verify-payment.ts
```

### Copy Complete Endpoint Code

```typescript
/**
 * Admin API: Verify Payment
 *
 * POST /api/admin/verify-payment
 *
 * Updates payment status to Verified or Rejected with audit logging
 *
 * Authentication: JWT required (admin role)
 * Source: docs/implementation/guest-booking-multi-unit/04-admin-interface.md lines 201-350
 */

import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// ============================================
// CORS Headers
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ============================================
// Main Handler
// ============================================

export async function onRequest(context: {
  request: CloudflareRequest;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ============================================
    // Authentication Check
    // ============================================
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized - Missing or invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.substring(7);

    // Create Supabase client with service role
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
      },
    });

    // Verify JWT and extract user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized - Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const userRole = user.user_metadata?.role || user.app_metadata?.role;
    if (userRole !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden - Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================
    // Parse Request Body
    // ============================================
    const body = await request.json();
    const { booking_id, action, reason } = body;

    if (!booking_id || !action) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: booking_id, action" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!["verify", "reject"].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action - must be "verify" or "reject"' }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "reject" && !reason?.trim()) {
      return new Response(JSON.stringify({ error: "Rejection reason required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================
    // Fetch Booking
    // ============================================
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("booking_id, payment_status")
      .eq("booking_id", booking_id)
      .single();

    if (fetchError || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already verified/rejected (idempotency)
    if (booking.payment_status !== "Pending") {
      return new Response(
        JSON.stringify({
          error: `Payment already ${booking.payment_status.toLowerCase()}`,
          current_status: booking.payment_status,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ============================================
    // Update Payment Status
    // ============================================
    const newStatus = action === "verify" ? "Verified" : "Rejected";

    const { error: updateError } = await supabase
      .from("bookings")
      .update({ payment_status: newStatus })
      .eq("booking_id", booking_id);

    if (updateError) {
      console.error("Failed to update payment status:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update payment status", details: updateError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ============================================
    // Write Audit Log
    // ============================================
    const auditAction = action === "verify" ? "payment.verified" : "payment.rejected";
    const auditMetadata: Record<string, any> = {
      admin_id: user.id,
      admin_email: user.email,
      timestamp: new Date().toISOString(),
    };

    if (action === "reject") {
      auditMetadata.rejection_reason = reason;
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      action: auditAction,
      entity_type: "booking",
      entity_id: booking_id,
      user_id: user.id,
      metadata: auditMetadata,
      created_at: new Date().toISOString(),
    });

    if (auditError) {
      console.error("Failed to write audit log:", auditError);
      // Non-fatal - continue even if audit log fails
    }

    // ============================================
    // Return Success
    // ============================================
    return new Response(
      JSON.stringify({
        success: true,
        message: `Payment ${newStatus.toLowerCase()} successfully`,
        payment_status: newStatus,
        audit_logged: !auditError,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
```

### Verification

Test the endpoint locally (if Wrangler dev running):

```bash
# Start local dev server (if not running)
npm run dev

# In another terminal, test endpoint
curl http://localhost:5173/api/admin/verify-payment \
  -X POST \
  -H "Authorization: Bearer YOUR_TEST_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"booking_id":"test-uuid","action":"verify"}'

# Expected: JSON response with success: true
```

---

## Step 4: Create Booking Detail API Endpoint (10 minutes)

Create the API endpoint for fetching individual booking details.

### Create File: `functions/api/admin/bookings/[bookingId].ts`

```bash
mkdir -p functions/api/admin/bookings
touch functions/api/admin/bookings/\[bookingId\].ts
```

### Copy Complete Endpoint Code

```typescript
/**
 * Admin API: Get Booking Details
 *
 * GET /api/admin/bookings/:bookingId
 *
 * Fetches detailed booking information for payment verification
 *
 * Authentication: JWT required (admin role)
 */

import type { Request as CloudflareRequest } from "@cloudflare/workers-types";
import { createClient } from "@supabase/supabase-js";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// ============================================
// CORS Headers
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ============================================
// Main Handler
// ============================================

export async function onRequest(context: {
  request: CloudflareRequest;
  env: Env;
  params: { bookingId: string };
}): Promise<Response> {
  const { request, env, params } = context;

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept GET requests
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ============================================
    // Authentication Check
    // ============================================
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized - Missing or invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.substring(7);

    // Create Supabase client with service role
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
      },
    });

    // Verify JWT and extract user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized - Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const userRole = user.user_metadata?.role || user.app_metadata?.role;
    if (userRole !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden - Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================
    // Fetch Booking Details
    // ============================================
    const { data: booking, error: queryError } = await supabase
      .from("bookings")
      .select(
        `
        booking_id,
        booking_reference,
        guest_name,
        guest_contact,
        check_in_date,
        check_out_date,
        total_amount,
        payment_status,
        payment_proof_path,
        requested_unit_count,
        created_at
      `
      )
      .eq("booking_id", params.bookingId)
      .single();

    if (queryError || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================
    // Return Booking Details
    // ============================================
    return new Response(JSON.stringify(booking), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
```

### Verification

Test the endpoint locally:

```bash
# Start local dev server (if not running)
npm run dev

# In another terminal, test endpoint
curl http://localhost:5173/api/admin/bookings/YOUR_BOOKING_ID \
  -H "Authorization: Bearer YOUR_TEST_JWT_TOKEN"

# Expected: JSON response with booking details
```

**Expected**: Returns booking object with all required fields

---

## Step 5: Create Route and Update Queue (10 minutes)

### Create Payment Verification Route

Create file: `src/routes/admin/verify-payment/$bookingId.tsx`

```bash
mkdir -p src/routes/admin/verify-payment
touch src/routes/admin/verify-payment/\$bookingId.tsx
```

```typescript
/**
 * Admin Payment Verification Route
 *
 * Route: /admin/verify-payment/:bookingId
 * Displays payment proof viewer for booking
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentProofViewer } from '@/components/admin/PaymentProofViewer';
import { formatCurrency, formatDate } from '@/lib/utils';

export const Route = createFileRoute('/admin/verify-payment/$bookingId')({
  component: PaymentVerificationPage,
  beforeLoad: async ({ context }) => {
    // Authentication guard
    const { auth } = context;
    if (!auth.isAuthenticated || auth.user?.role !== 'admin') {
      throw new Error('Admin access required');
    }
  },
});

function PaymentVerificationPage() {
  const { bookingId } = Route.useParams();
  const navigate = useNavigate();

  // Fetch booking details
  const { data: booking, isLoading, error } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch booking');
      }

      return response.json();
    },
  });

  const handleStatusChange = () => {
    // Navigate back to queue or to unit assignment if verified
    if (booking?.payment_status === 'Verified') {
      navigate({ to: `/admin/assign-units/${bookingId}` });
    } else {
      navigate({ to: '/admin/queue' });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading booking details...</div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-destructive">
          Error loading booking: {error?.message || 'Booking not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/admin/queue' })}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Queue
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Verification</h1>
          <p className="text-muted-foreground">
            Booking: {booking.booking_reference}
          </p>
        </div>
      </div>

      {/* Booking Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Booking Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Guest</div>
            <div className="font-medium">{booking.guest_name}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Check-in</div>
            <div className="font-medium">{formatDate(booking.check_in_date)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Units Requested</div>
            <div className="font-medium">{booking.requested_unit_count}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Total Amount</div>
            <div className="font-medium font-mono">{formatCurrency(booking.total_amount)}</div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Proof Viewer */}
      <PaymentProofViewer
        bookingId={bookingId}
        paymentProofPath={booking.payment_proof_path}
        currentPaymentStatus={booking.payment_status}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
```

### Update Admin Queue Navigation

Modify `src/components/admin/PendingBookingsQueue.tsx`:

Find the "Assign Units" button (around line 270) and replace with conditional navigation:

```typescript
// OLD CODE (remove this):
<Button
  size="sm"
  onClick={() => (window.location.href = `/admin/assign-units/${booking.booking_id}`)}
>
  Assign Units
</Button>

// NEW CODE (replace with this):
<Button
  size="sm"
  onClick={() => {
    // If payment verified, go to assignment; otherwise, verify payment first
    const targetUrl =
      booking.payment_status === 'Verified'
        ? `/admin/assign-units/${booking.booking_id}`
        : `/admin/verify-payment/${booking.booking_id}`;
    window.location.href = targetUrl;
  }}
>
  {booking.payment_status === 'Verified' ? 'Assign Units' : 'Verify Payment'}
</Button>
```

---

## Step 6: Testing and Verification (5 minutes)

### Manual Testing

```bash
# 1. Start development server
npm run dev

# 2. Open browser to http://localhost:5173/admin/queue
# 3. Log in as admin user
# 4. Click "Verify Payment" on a pending booking
# 5. View payment proof (should display image or PDF)
# 6. Test zoom/pan controls (if image)
# 7. Click "Verify Payment"
# 8. Confirm booking status updated to "Verified"
```

### Create Test Booking with Payment Proof (if needed)

Use Supabase SQL Editor to create test booking with payment proof:

```sql
-- Insert test booking
INSERT INTO bookings (
  booking_reference,
  guest_name,
  guest_contact,
  check_in_date,
  check_out_date,
  total_amount,
  payment_status,
  payment_proof_path,
  is_multi_unit,
  is_guest_booking,
  requested_unit_count,
  unit_assignment_status
) VALUES (
  'TEST-PAYMENT-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)),
  'Test Guest - Payment Verification',
  '+63 917 123 4567',
  CURRENT_DATE + INTERVAL '3 days',
  CURRENT_DATE + INTERVAL '6 days',
  35000,
  'Pending',
  'payment-proofs/test_proof_12345.jpg', -- Replace with actual uploaded file path
  TRUE,
  TRUE,
  2,
  'pending'
) RETURNING booking_id, booking_reference;
```

Upload a test image to Supabase Storage:

1. Go to Supabase Dashboard → Storage → `booking-files` bucket
2. Upload a test image (e.g., screenshot of fake payment)
3. Copy the file path (e.g., `payment-proofs/test_proof_12345.jpg`)
4. Update SQL INSERT above with correct path

### Visual Checks

Verify in browser:

- [ ] Payment proof displays (image or PDF)
- [ ] Zoom controls work on images (zoom in, zoom out, reset)
- [ ] Pan works on images (drag to move)
- [ ] PDF displays with page navigation
- [ ] "Verify Payment" button clickable
- [ ] "Reject Payment" opens modal
- [ ] Rejection reason required (cannot submit empty)
- [ ] After verify, status changes to "Verified"
- [ ] After reject, status changes to "Rejected"
- [ ] Audit log entry created (check `audit_logs` table)
- [ ] Cannot verify/reject twice (shows error)
- [ ] Mobile responsive (resize browser to 375px)

### Type Check

```bash
npm run type-check
```

**Expected**: No errors

### Lint Check

```bash
npm run lint
```

**Expected**: No warnings

---

## Done! ✅

You've successfully implemented chunk 012!

### What You Built

- ✅ Storage utility (`src/lib/storage-utils.ts`)
- ✅ Payment proof viewer component (`src/components/admin/PaymentProofViewer.tsx`)
- ✅ API endpoint (`functions/api/admin/verify-payment.ts`)
- ✅ Payment verification route (`src/routes/admin/verify-payment/$bookingId.tsx`)
- ✅ Updated queue navigation (`PendingBookingsQueue.tsx`)

### Next Steps

1. **Run checkpoint.md** - Verify all automated and manual checks pass
2. **Commit changes**:
   ```bash
   git add .
   git commit -m "feat: complete chunk 012-payment-verification-ui"
   ```
3. **Move to Chunk 013** - Unit Assignment System (requires payment verification to assign units)

---

**Need help?** Check `troubleshooting.md` for common issues.
