# Implementation Priorities for Multi-Unit Guest Booking

## Overview

Phased implementation approach prioritizing data integrity, security, and core functionality.

## Phase 1: Core Functionality (Week 1)

### Database Schema

- [ ] Create `pricing_config` table (single source of truth for pricing and capacity)
- [ ] Create `guest_booking_unit_requests` table (array-based, NO `quantity` column)
- [ ] Extend `bookings` table with multi-unit columns
- [ ] Create `discount_rules` table with JSONB conditions
- [ ] Create `idempotency_keys` table
- [ ] Add database constraints (payment-before-assignment, all-or-nothing)
- [ ] Create PostgreSQL EXCLUDE constraint for concurrency control

### PostgreSQL Functions

- [ ] Implement `calculate_booking_pricing()` function (sole pricing authority)
- [ ] Implement `create_guest_booking()` function (atomic booking creation)
- [ ] Implement `assign_units_to_booking()` function (atomic unit assignment)
- [ ] Implement `cleanup_expired_idempotency_keys()` function (called by cron worker)
- [ ] Implement `cleanup_expired_payment_proofs()` function (called by cron worker)

### Application-Layer Functions (TypeScript)

- [ ] Implement `calculateUrgencyScore()` utility function for admin queue sorting
- [ ] Implement `getPendingMultiUnitBookings()` API endpoint with urgency scoring

### Security

- [ ] Cloudflare Turnstile integration
- [ ] Input sanitization with DOMPurify
- [ ] JWT verification for admin endpoints
- [ ] Row Level Security policies
- [ ] File upload validation (JPEG, PNG, PDF only, 5MB limit)
- [ ] Signed URLs for payment proof uploads

### Idempotency & Cleanup

- [ ] Client-side UUID generation
- [ ] Keys expire 48 hours after creation
- [ ] Duplicate detection and prevention
- [ ] Idempotency cleanup cron job (daily at 2:00 AM UTC)
- [ ] Payment proof cleanup cron job (weekly Sunday at 3:00 AM UTC) - deletes proofs 90 days post-checkout
- [ ] Complete wrangler.toml configuration:
  ```toml
  [triggers]
  crons = [
    "0 2 * * *",  # Daily: cleanup_expired_idempotency_keys()
    "0 3 * * 0"   # Weekly: cleanup_expired_payment_proofs()
  ]
  ```

### Performance Baseline (Week 0 - Pre-Implementation)

- [ ] Capture performance baseline on CURRENT system BEFORE any changes (`npm run test:performance:baseline`)
- [ ] Store baseline metrics for regression comparison: `performance-baseline-pre-multi-unit.json`
- [ ] Document current single-unit booking performance
- [ ] Identify critical performance paths

## Phase 2: Guest Booking Flow (Week 2)

### API Endpoints

- [ ] POST `/api/guest-booking` - Create multi-unit booking
- [ ] POST `/api/guest-booking/preview-pricing` - Server-side pricing preview
- [ ] GET `/api/guest-booking/rates` - Fetch base rates
- [ ] GET `/api/guest-booking/discount-rules` - Fetch active discounts
- [ ] GET `/api/guest-booking/status` - Check booking status
- [ ] POST `/api/guest-booking/upload-url` - Generate signed upload URL

### Frontend Components

- [ ] `UnitRequestCard` component (one card = one unit)
- [ ] `UnitRequestSelector` container (add/remove cards)
- [ ] `PaymentSummary` component with preview warning
- [ ] `MultiUnitGuestBookingForm` main form
- [ ] Date picker integration
- [ ] Form validation with Zod

### Frontend Rate Display (Static)

- [ ] Fetch and display static rates from API
- [ ] Show base rate, weekend rate, extra person fee
- [ ] Display discount rules (duration-based)
- [ ] No client-side pricing calculations

### Validation

- [ ] Guest capacity validation: `guests_per_unit` ≤ `pricing_config.max_capacity_per_unit`
- [ ] Booking size validation: total requested units ≤ COUNT(units) where status='Available'
- [ ] Validate check-in/check-out dates
- [ ] Turnstile token verification
- [ ] Terms acceptance enforcement
- [ ] Rate limiting (Cloudflare WAF + Turnstile)

## Phase 3: Admin Interface (Week 3)

### Admin Components

- [ ] `PendingBookingsQueue` with urgency scoring
- [ ] `UnitAssignmentInterface` with all-or-nothing validation
- [ ] Payment proof viewer
- [ ] Unit availability checker

### Admin API Endpoints (Booking Management)

- [ ] GET `/api/admin/pending-bookings` - Fetch queue
- [ ] GET `/api/admin/available-units` - Check availability
- [ ] POST `/api/admin/assign-units` - Assign units to booking
- [ ] POST `/api/admin/verify-payment` - Mark payment as verified

### Admin Workflow

- [ ] Queue displays urgency scores (0-100)
- [ ] Payment proof verification UI
- [ ] Unit selection with all-or-nothing enforcement
- [ ] Transaction-based assignment
- [ ] Manual contact workflow documentation

## Phase 4: Testing & Deployment (Week 4)

### Testing

- [ ] Create test fixtures (images, PDFs, JSON payloads) - see 07-testing-strategy.md lines 14-61
- [ ] Unit tests for pricing preview
- [ ] Integration tests for API endpoints
- [ ] Database constraint tests
- [ ] Idempotency tests
- [ ] Concurrency tests (PostgreSQL EXCLUDE)
- [ ] All-or-nothing assignment tests
- [ ] Payment verification tests
- [ ] Best-of discount policy (multiple applicable discounts, highest wins)
- [ ] Discount priority tiebreaker (equal values, highest priority wins)

### Rollback Testing (Critical)

- [ ] Rollback procedure dry-run on staging environment
- [ ] Rollback timing verification (target: <1 hour total window)
- [ ] Data integrity verification post-rollback (zero data loss)
- [ ] Rollback acceptance tests (see 07-testing-strategy.md Task 9)
- [ ] Document rollback decision tree and success criteria

### Deployment

- [ ] Database migration on staging
- [ ] API deployment to Cloudflare Workers
- [ ] Frontend deployment to Cloudflare Pages
- [ ] Admin training session
- [ ] Rollback procedure testing

### Monitoring

- [ ] Pending queue length alerts
- [ ] Assignment time tracking
- [ ] Idempotency key collision monitoring
- [ ] Payment verification metrics
- [ ] Discount application tracking

## Deferred Features (Post-Launch)

### Email Notifications

**Status:** NOT IMPLEMENTED - Manual contact only

**Future Integration:**

- Resend or SendGrid setup
- Booking confirmation emails
- Unit assignment notifications
- Payment reminders
- Admin queue alerts

**Current Workflow:** Admin contacts guests via phone/SMS

### Advanced Features

- Automated unit assignment
- Real-time availability checking
- Unit-count based discounts (engine supports, not configured in Phase 1)
- Seasonal pricing with admin UI (`pricing_seasons` table - deferred to Phase 2+)
- Multi-currency support
- Advanced reporting dashboards

### Admin Discount Rules CRUD

**Status:** Deferred to Post-Launch

**Features (when implemented):**

- Web UI for creating/editing discount rules
- Visual JSONB condition builder
- Live discount testing against sample bookings
- Activation/deactivation toggle
- Audit logging

**API Endpoints (not specified in Phase 1):**

- POST `/api/admin/discount-rules` - Create new discount rule
- GET `/api/admin/discount-rules` - List all discount rules (with filters)
- PUT `/api/admin/discount-rules/:id` - Update discount rule
- PATCH `/api/admin/discount-rules/:id/toggle` - Activate/deactivate rule
- POST `/api/admin/discount-rules/:id/test` - Test rule against sample booking

**Phase 1 Workaround:** Direct database management via Supabase dashboard

## Implementation Checklist

### Week 0: Pre-Implementation

- [ ] Capture performance baseline on CURRENT system (npm run test:performance:baseline)
- [ ] Store baseline: performance-baseline-pre-multi-unit.json
- [ ] Document current single-unit booking metrics

### Week 1: Database & Security

- [x] Array-based model decided
- [x] PostgreSQL pricing function designed
- [x] Constraints documented
- [ ] Migration script tested
- [ ] Security review completed
- [ ] RLS policies verified

### Week 2: Guest Flow

- [ ] API endpoints implemented
- [ ] Frontend components built
- [ ] Preview pricing working
- [ ] Form validation complete
- [ ] Turnstile integrated
- [ ] End-to-end guest flow tested

### Week 3: Admin Tools

- [ ] Pending queue implemented
- [ ] Assignment interface built
- [ ] Payment verification working
- [ ] All-or-nothing enforced
- [ ] Manual contact workflow documented
- [ ] Admin training materials ready

### Week 4: Launch

- [ ] All tests passing
- [ ] Staging deployment successful
- [ ] Production deployment completed
- [ ] Monitoring active
- [ ] Rollback procedure verified
- [ ] Documentation updated

## Key Decisions

**Data Model:**

- Array-based (each row = 1 unit, NO `quantity`)
- PostgreSQL `calculate_booking_pricing()` function is SOLE pricing authority
- `create_guest_booking()` function provides atomic booking creation
- Centralized config in `pricing_config` table

**Assignment:**

- Only 2 statuses: `pending`, `assigned`
- All-or-nothing (NO partial assignments)
- Payment verification required

**Discounts:**

- Engine supports: duration, unit-count, date-range, advance booking
- Phase 1 configures: duration discounts only (7, 14, 21, 28 nights)
- Best-of policy (no stacking)
- Admin can add other discount types post-launch via database

**Contact:**

- Manual workflow (phone/SMS)
- NO email notifications initially
- Future integration planned

**Validation:**

- ✅ YES: Validate `guests_per_unit` ≤ `pricing_config.max_capacity_per_unit`
- ❌ NO: Do NOT validate availability (whether units are booked)
- ❌ NO: Admin handles availability during unit assignment
