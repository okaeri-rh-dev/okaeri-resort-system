# Chunk 012: Payment Verification UI

## At a Glance

| Property | Value |
|----------|-------|
| **Chunk Number** | 012 |
| **Chunk Name** | payment-verification-ui |
| **Phase** | Phase 3: Admin Interface |
| **Estimated Time** | 85 minutes |
| **Milestone** | Admin can verify or reject payment proofs securely |
| **Can Skip?** | ❌ No - Required for chunk 013 (unit assignment blocked without payment verification) |
| **Prerequisites** | Chunks 001-011 completed (esp. 008 for file uploads, 011 for queue navigation) |

## What You're Building

This chunk creates the **payment verification interface** - the critical security checkpoint between booking submission and unit assignment. Admin must verify payment before assigning units (enforced by database CHECK constraint).

### New Components (2)

1. **`PaymentProofViewer`** (`src/components/admin/PaymentProofViewer.tsx`)
   - Displays uploaded payment proof (image or PDF)
   - Image zoom/pan controls for detailed inspection
   - PDF viewer with page navigation
   - Signed URL fetching (5-minute expiry, auto-renewable)
   - Verify/Reject action buttons
   - Rejection reason modal
   - Audit trail integration

2. **Storage Utility** (`src/lib/storage-utils.ts`)
   - `generateSignedUrl()` - Fetches signed URL from Supabase Storage
   - `renewSignedUrl()` - Auto-renews before expiry (4-minute timer)
   - Private bucket access configuration
   - Error handling for missing files

### New API Endpoints (2)

3. **`POST /api/admin/verify-payment`** (`functions/api/admin/verify-payment.ts`)
   - Accepts `{ booking_id, action: 'verify' | 'reject', reason?: string }`
   - Updates `bookings.payment_status` to 'Verified' or 'Rejected'
   - Writes audit log entry with admin ID, timestamp, reason
   - JWT authentication required
   - Admin role verification
   - Idempotent (cannot verify/reject twice)

4. **`GET /api/admin/bookings/[bookingId]`** (`functions/api/admin/bookings/[bookingId].ts`)
   - Fetches detailed booking information for verification page
   - Returns booking reference, guest details, dates, amounts, payment status
   - JWT authentication required
   - Admin role verification

### New Route (1)

5. **Payment Verification Route** (`src/routes/admin/verify-payment/$bookingId.tsx`)
   - TanStack Router route at `/admin/verify-payment/{bookingId}`
   - Fetches booking details + payment proof path
   - Authentication guard (redirects if not admin)
   - Layout integration with existing admin UI

### Updated Components (1)

6. **Admin Queue Navigation** - Update chunk 011's `PendingBookingsQueue.tsx`
   - Change "Assign Units" button behavior:
     - If `payment_status = 'Verified'` → Navigate to `/admin/assign-units/{bookingId}`
     - If `payment_status != 'Verified'` → Navigate to `/admin/verify-payment/{bookingId}`

## Why This Matters

### Business Value

- **Fraud Prevention** - Admin visually verifies payment before assignment
- **Audit Trail** - Every verify/reject action logged with timestamp, admin ID, reason
- **Manual Contact Workflow** - Admin calls guest after verification (no email automation)
- **Payment-Before-Assignment** - Database enforces verified payment required for unit assignment
- **Dispute Resolution** - Immutable audit log provides evidence for payment disputes

### Operational Value

- **Secure Access** - Signed URLs (5-minute expiry) protect private payment proofs
- **View-Only** - Admin can inspect but not download (prevents unauthorized distribution)
- **Auto-Renewal** - Signed URLs refresh automatically, no manual re-loading
- **Rejection Workflow** - Optional notes field for clear communication with guests
- **Idempotent Actions** - Cannot verify/reject twice, prevents accidental double-processing

### Technical Value

- **Security-First** - Private Supabase Storage bucket, no public access
- **Compliance** - Audit trail satisfies financial record-keeping requirements
- **Database Enforcement** - CHECK constraint prevents assignment without verification
- **Performance Optimized** - Lazy-load images/PDFs, signed URLs generated on-demand
- **Mobile Accessible** - Responsive design, touch-friendly zoom controls

### Payment Verification Workflow

**Admin Workflow**:
1. Admin views queue (chunk 011)
2. Sees booking with payment_status = 'Pending'
3. Clicks "Verify Payment" (navigates to verification page)
4. Views payment proof (image zoom/pan or PDF scroll)
5. Clicks "Verify" or "Reject"
6. If reject: enters reason (e.g., "Amount mismatch - ₱10k shown, ₱30k required")
7. Action logged to audit trail
8. Booking payment_status updated
9. Returns to queue

**If Verified**:
- Payment status → 'Verified'
- Booking now eligible for unit assignment (chunk 013)
- Audit log: `{ action: 'payment.verified', admin_id, booking_id, timestamp }`

**If Rejected**:
- Payment status → 'Rejected'
- Reason saved in audit log
- Booking remains in queue (guest can re-upload)
- Admin manually contacts guest (phone/SMS)
- Audit log: `{ action: 'payment.rejected', admin_id, booking_id, reason, timestamp }`

## Before You Start

### Prerequisites Checklist

Verify you have completed:

- [ ] **Chunk 001**: Database schema with `bookings.payment_status` column
- [ ] **Chunk 003**: RLS policies for Supabase Storage, CHECK constraint for payment-before-assignment
- [ ] **Chunk 008**: Payment proof upload (files exist in `booking-files` bucket)
- [ ] **Chunk 011**: Admin queue (navigation to verification)
- [ ] Supabase Storage bucket `booking-files` configured as private
- [ ] Supabase service_role key in `.env.local`
- [ ] Audit logging system operational (test with `src/lib/audit-logger.ts`)
- [ ] You have read `docs/implementation/guest-booking-multi-unit/04-admin-interface.md` lines 201-350

### Knowledge Requirements

You should understand:

- React 19 with TypeScript
- Supabase Storage signed URLs
- TanStack Query v5 (useQuery, useMutation)
- shadcn/ui Dialog component
- PDF rendering (react-pdf library)
- Image zoom/pan (react-zoom-pan-pinch library)
- Audit logging patterns

### Tools Required

- Code editor (VS Code recommended)
- Browser with React DevTools
- Supabase dashboard access (to verify RLS policies)
- Test payment proof files (JPEG, PNG, PDF)

### Time Commitment

- **Signed URL utility**: 10 minutes
- **Payment proof viewer component**: 30 minutes
- **Verify payment API endpoint**: 15 minutes
- **Booking detail API endpoint**: 10 minutes
- **Route + queue integration**: 10 minutes
- **Verification**: 10 minutes

**Total**: ~85 minutes for complete implementation and verification

## What Happens Next

### Immediate Outcomes

After completing this chunk:

✅ Admin can view uploaded payment proofs securely
✅ Admin can zoom/pan images for detailed inspection
✅ Admin can scroll through PDF proofs
✅ Admin can verify payment (status → 'Verified')
✅ Admin can reject payment with reason
✅ All actions logged to audit trail
✅ Signed URLs auto-renew every 4 minutes
✅ Mobile responsive (touch-friendly zoom)
✅ Authentication enforced (admin role required)

### What You Can Do

- ✅ Navigate to `/admin/verify-payment/{bookingId}` from queue
- ✅ View payment proof (image or PDF)
- ✅ Zoom/pan images to inspect details (account numbers, amounts)
- ✅ Verify payment (updates status, enables unit assignment)
- ✅ Reject payment with reason (guest can re-upload)
- ✅ View audit log of verification actions

### What You Cannot Do Yet

- ❌ Assign units to bookings (Chunk 013 - Unit Assignment System)
- ❌ View assignment history (Chunk 014 - Admin API endpoints)
- ❌ Send automated emails (Manual contact workflow, email deferred post-launch)

### Next Chunk

**Chunk 013: Unit Assignment System** - Implements all-or-nothing unit assignment with availability checking, conflict detection, and transaction-based atomic operations. Requires payment verification (this chunk) to proceed.

**Dependencies for Chunk 013**: Requires `payment_status = 'Verified'` to assign units (enforced by CHECK constraint).

## Key Files Created/Modified

```
src/
├── components/
│   └── admin/
│       └── PaymentProofViewer.tsx              [NEW - ~300 lines]
│           ├── Signed URL fetching with auto-renewal
│           ├── Image zoom/pan controls (react-zoom-pan-pinch)
│           ├── PDF viewer integration (react-pdf)
│           ├── Verify/Reject action buttons
│           ├── Rejection reason modal (Dialog)
│           └── Audit logging integration
│
├── lib/
│   └── storage-utils.ts                        [NEW - ~80 lines]
│       ├── generateSignedUrl() function
│       ├── renewSignedUrl() function
│       ├── Private bucket configuration
│       └── Error handling for missing files
│
├── routes/
│   └── admin/
│       └── verify-payment/
│           └── $bookingId.tsx                  [NEW - ~100 lines]
│               ├── TanStack Router route with booking ID param
│               ├── Fetch booking details + payment proof path
│               ├── Authentication guard
│               └── Layout integration
│
└── components/
    └── admin/
        └── PendingBookingsQueue.tsx            [MODIFIED - update navigation logic]

functions/
└── api/
    └── admin/
        ├── verify-payment.ts                   [NEW - ~180 lines]
        │   ├── POST endpoint handler
        │   ├── Payment status update (Verified/Rejected)
        │   ├── Audit log integration
        │   ├── JWT authentication middleware
        │   ├── Admin role verification
        │   └── Idempotency check (cannot verify/reject twice)
        │
        └── bookings/
            └── [bookingId].ts                  [NEW - ~150 lines]
                ├── GET endpoint handler
                ├── Fetch booking details by ID
                ├── JWT authentication middleware
                └── Admin role verification
```

## Related Documentation

### Source Documentation

- **Primary**: `docs/implementation/guest-booking-multi-unit/04-admin-interface.md` (lines 201-350)
  - Payment proof viewer specification
  - Signed URL patterns (5-minute expiry, renewable)
  - Verify/reject workflow
  - Audit logging requirements

- **Secondary**: `docs/implementation/guest-booking-multi-unit/chunks/008-payment-proof-upload/README.md`
  - File upload context (storage bucket, file paths)
  - Supported file types (JPEG, PNG, PDF)
  - Security patterns (magic number validation)

- **Database**: `docs/implementation/guest-booking-multi-unit/01-database-schema.md`
  - `payment_status` column definition
  - CHECK constraint for payment-before-assignment
  - Audit logging tables

- **Architecture**: `docs/implementation/guest-booking-multi-unit/CHUNKING-STRATEGY.md` (lines 410-444)
  - Chunk 012 specification
  - Dependencies graph
  - Security-first principles

- **Implementation Decisions**: `docs/implementation/guest-booking-multi-unit/09-implementation-decisions.md`
  - Manual contact workflow (no email notifications)
  - Payment-before-assignment decision
  - Audit trail requirements

### Codebase Patterns

- **Storage**: `src/lib/supabase.ts`
  - Supabase Storage client initialization
  - Private bucket access patterns

- **Audit Logging**: `src/lib/audit-logger.ts`
  - `logAuditEvent()` function signature
  - Audit event structure
  - Metadata patterns

- **Admin Auth**: `functions/api/admin/pending-bookings.ts` (from chunk 011)
  - JWT token verification
  - Admin role checking
  - Authentication patterns

- **Modal Patterns**: `src/components/ui/dialog.tsx`
  - shadcn/ui Dialog component
  - Form handling in modals
  - Controlled state patterns

## Success Criteria

This chunk is complete when:

- [ ] `src/lib/storage-utils.ts` created with signed URL functions
- [ ] `src/components/admin/PaymentProofViewer.tsx` created with zoom/pan + PDF support
- [ ] `functions/api/admin/verify-payment.ts` created with authentication
- [ ] `functions/api/admin/bookings/[bookingId].ts` created for booking details
- [ ] `src/routes/admin/verify-payment/$bookingId.tsx` created with route definition
- [ ] `PendingBookingsQueue.tsx` updated with conditional navigation
- [ ] `npm install react-pdf react-zoom-pan-pinch` completed
- [ ] `npm run type-check` passes (no TypeScript errors)
- [ ] `npm run lint` passes (no ESLint warnings)
- [ ] Payment proof displays (image + PDF tested)
- [ ] Zoom/pan controls work on images
- [ ] PDF renders correctly with pages
- [ ] Verify button updates payment status to 'Verified'
- [ ] Reject button prompts for reason
- [ ] Rejection reason saved in audit log
- [ ] Audit log entry created for all actions
- [ ] Signed URL auto-renews before expiry
- [ ] Cannot verify/reject twice (idempotent)
- [ ] Mobile responsive (tested at 375px viewport)
- [ ] Admin authentication enforced
- [ ] All checkpoint tests pass (see `checkpoint.md`)

## Quick Start

Ready to begin? Follow these steps:

1. **Read this README completely** (you are here)
2. **Install dependencies**: `npm install react-pdf react-zoom-pan-pinch`
3. **Open `instructions.md`** - Follow step-by-step implementation guide
4. **Create files** - Signed URL utility, viewer component, API endpoint, routes
5. **Test manually** - Upload test payment proof, view, verify/reject
6. **Run checkpoints** - Verify everything works (`checkpoint.md`)
7. **Troubleshoot if needed** - Common issues and solutions (`troubleshooting.md`)
8. **Commit changes** - `git commit -m "feat: complete chunk 012-payment-verification-ui"`
9. **Move to Chunk 013** - Unit Assignment System (requires payment verification)

---

**Ready?** Open `instructions.md` to begin implementation.
