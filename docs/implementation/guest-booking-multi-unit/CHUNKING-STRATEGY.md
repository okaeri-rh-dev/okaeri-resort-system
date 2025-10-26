# Multi-Unit Guest Booking: Chunking Strategy

## Purpose

This document provides a high-level implementation chunking strategy for the multi-unit guest booking system. It breaks down the comprehensive implementation (documented in `README.md` through `11-test-fixtures.md`) into 17 sequential, verifiable chunks following the household-hub pattern.

## Chunking Methodology

### Pattern Structure

Each chunk follows the household-hub pattern with exactly 4 files:

1. **README.md** - Overview, prerequisites, what's being built, why it matters
2. **instructions.md** - Step-by-step implementation guide with commands
3. **checkpoint.md** - Automated and manual verification procedures
4. **troubleshooting.md** - Common issues and solutions specific to this chunk

### Chunk Characteristics

- **Time-boxed**: 60-120 minutes per chunk
- **Self-contained**: Completes a logical unit of work
- **Verifiable**: Clear success criteria and checkpoint tests
- **Sequential**: Clear dependencies on previous chunks
- **Atomic**: Can be rolled back independently

## Implementation Phases

### Phase 1: Database & Backend Core (Week 1)

**Goal**: Establish data foundation and server-side pricing authority

### Phase 2: Guest Booking Flow (Week 2)

**Goal**: Build public-facing booking interface

### Phase 3: Admin Interface (Week 3)

**Goal**: Create management tools for unit assignment

### Phase 4: Testing & Launch (Week 4)

**Goal**: Ensure quality and deploy to production

---

## Chunk Breakdown (17 Total)

### Phase 1: Database & Backend Core (001-005)

#### Chunk 001: Database Schema Setup

**Duration**: 90 minutes
**Source Docs**: `01-database-schema.md` lines 1-300
**Dependencies**: None (first chunk)

**Scope**:

- Create `pricing_config` table (single source of truth)
- Create `guest_booking_unit_requests` table (array-based model)
- Create `discount_rules` table with JSONB conditions
- Create `idempotency_keys` table
- Extend `bookings` table with multi-unit columns
- Create indexes for performance
- Insert default configuration data

**Key Decisions**:

- Array-based: Each row in `guest_booking_unit_requests` = 1 unit (NO `quantity` column)
- Centralized config: All pricing/capacity in `pricing_config` singleton table
- Flexible discounts: JSONB conditions support duration, date-range, advance-booking, unit-count

**Success Criteria**:

- All tables created without errors
- Indexes established
- Default data inserted (pricing_config row, 4 discount rules)
- Can query tables via Supabase dashboard

---

#### Chunk 002: PostgreSQL Pricing Engine

**Duration**: 120 minutes
**Source Docs**: `01-database-schema.md` lines 301-600, `05-simplified-pricing-engine.md`
**Dependencies**: 001 (requires tables)

**Scope**:

- Implement `calculate_booking_pricing()` function (AUTHORITATIVE pricing calculator)
- Implement discount evaluation logic (all 4 types: duration, date-range, advance-booking, unit-count)
- Implement best-of discount policy (highest discount wins, no stacking)
- Create helper functions for rate calculations
- Test pricing function with various scenarios

**Key Decisions**:

- PostgreSQL function is SOLE pricing authority (client never calculates)
- Server-side ONLY: All pricing via this function
- Best-of policy: Single highest discount applies

**Success Criteria**:

- Function executes without errors
- Returns correct pricing for single unit
- Returns correct pricing for multiple units
- Applies correct discount (best-of policy)
- Weekend rates calculated correctly
- Extra person fees calculated correctly

---

#### Chunk 003: Security, RLS, and Constraints

**Duration**: 90 minutes
**Source Docs**: `01-database-schema.md` lines 601-800
**Dependencies**: 001 (requires tables)

**Scope**:

- Database constraints (all-or-nothing assignment, payment-before-assignment)
- PostgreSQL EXCLUDE constraint for concurrency control (no double-booking)
- Row Level Security policies for multi-tenant isolation
- Input validation rules
- Audit logging triggers

**Key Decisions**:

- All-or-nothing: Admin assigns ALL units or NONE (enforced by CHECK constraint)
- Payment verification required before assignment
- Concurrency: PostgreSQL EXCLUDE constraint is primary mechanism

**Success Criteria**:

- Cannot assign units without payment verification (constraint blocks)
- Cannot partially assign units (constraint blocks)
- Cannot double-book same unit for overlapping dates (EXCLUDE constraint blocks)
- RLS policies tested (users see only their data)

---

#### Chunk 004: Core API Endpoints

**Duration**: 120 minutes
**Source Docs**: `02-api-specification.md`, `README.md` lines 251-290
**Dependencies**: 001, 002 (requires schema and pricing function)

**Scope**:

- POST `/api/guest-booking` - Create booking endpoint
- GET `/api/guest-booking/rates` - Static rates display (from `pricing_config`)
- GET `/api/guest-booking/discount-rules` - Active discounts
- POST `/api/guest-booking/preview-pricing` - Server-side pricing preview (calls PostgreSQL function)
- Cloudflare Workers setup
- API request/response validation

**Key Decisions**:

- Server-side pricing: API calls `calculate_booking_pricing()` PostgreSQL function
- Client displays static rates only (no client-side calculations)
- Preview endpoint required for real-time pricing display

**Success Criteria**:

- All endpoints respond with correct status codes
- POST `/api/guest-booking` creates booking with correct pricing
- Preview endpoint returns accurate pricing calculations
- Rates endpoint returns current configuration
- Discount rules endpoint returns active rules only

---

#### Chunk 005: Idempotency and Rate Limiting

**Duration**: 90 minutes
**Source Docs**: `README.md` lines 165-175, `06-migration-guide.md` cron section
**Dependencies**: 001, 004 (requires schema and API)

**Scope**:

- Client-side UUID generation
- Idempotency key checking in API
- Turnstile CAPTCHA integration
- Rate limiting with Cloudflare KV store
- Cleanup cron jobs (daily 2 AM UTC, weekly Sunday 3 AM UTC)
- Retry logic for failed bookings

**Key Decisions**:

- Client generates UUID (not server)
- 48-hour expiry window for idempotency keys
- Daily cleanup at 2:00 AM UTC (idempotency keys)
- Weekly cleanup Sunday 3:00 AM UTC (payment proofs)

**Success Criteria**:

- Duplicate request returns existing booking (not new one)
- Turnstile token required and validated
- Rate limiting blocks excessive requests
- Cron jobs configured in wrangler.toml
- Cleanup functions tested

---

### Phase 2: Guest Booking Flow (006-010)

#### Chunk 006: Date and Unit Selection UI

**Duration**: 90 minutes
**Source Docs**: `03-frontend-components.md` lines 1-200
**Dependencies**: 004 (requires `/api/guest-booking/rates` endpoint for static rate display)

**Scope**:

- Date picker component (check-in/check-out)
- Unit request selector (array-based model)
- `UnitRequestCard` component (one card = one unit)
- Add/remove unit cards dynamically
- Guest count per unit input
- Capacity validation against `pricing_config.max_capacity_per_unit`

**Key Decisions**:

- Array-based UI: One card per unit (not "quantity" input)
- Dynamic add/remove cards (up to 10 units)
- Client validates capacity only (NOT availability)

**Success Criteria**:

- Can select date range
- Can add up to 10 unit cards
- Can remove unit cards
- Guest count per unit validates against max capacity
- UI shows total units and total guests
- No availability checking (admin assigns later)

---

#### Chunk 007: Payment Summary with Preview

**Duration**: 75 minutes
**Source Docs**: `03-frontend-components.md` lines 201-350
**Dependencies**: 004, 006 (requires preview API and form state)

**Scope**:

- `PaymentSummary` component
- Real-time pricing preview (calls `/api/guest-booking/preview-pricing`)
- Discount display (if applicable)
- Downpayment calculation (configurable percentage)
- Preview warning banner ("Final amount calculated at booking")
- Loading states during preview fetch

**Key Decisions**:

- Server calculates all pricing (client only displays)
- Preview endpoint debounced (500ms delay)
- Shows warning: pricing subject to change until booking confirmed

**Success Criteria**:

- Summary updates when dates or units change
- Calls preview API endpoint
- Displays base amount, discount, and total
- Shows downpayment amount (50% default)
- Preview warning visible
- Loading state during calculation

---

#### Chunk 008: Payment Proof Upload

**Duration**: 90 minutes
**Source Docs**: `README.md` lines 162-168, `02-api-specification.md` file upload section
**Dependencies**: 004 (requires signed URL endpoint)

**Scope**:

- File upload component with drag-and-drop
- Client-side image compression (Canvas API, target ~2MB)
- Signed URL generation endpoint
- File type validation (JPEG, PNG, PDF via magic numbers)
- 5MB server-side hard limit enforcement
- Private Supabase storage bucket integration
- Upload progress indicator

**Key Decisions**:

- Two-tier strategy: Client compresses to ~2MB, server rejects >5MB
- Magic number validation (not just MIME type)
- Signed URLs with 5-minute expiry
- Private bucket (not public)

**Success Criteria**:

- Can drag and drop file
- Can click to select file
- Images auto-compressed before upload
- Large files rejected with clear error
- Upload shows progress bar
- File stored in private bucket
- Signed URL expires after 5 minutes

---

#### Chunk 009: Form Validation and Submission

**Duration**: 120 minutes
**Source Docs**: `03-frontend-components.md` lines 351-600
**Dependencies**: 004, 006, 007, 008 (requires all form pieces)

**Scope**:

- React Hook Form + Zod schema integration
- Multi-step form wizard (dates → units → contact → payment → review)
- Contact information validation
- Terms acceptance checkbox (required)
- DOMPurify sanitization for text inputs
- Turnstile token verification
- Form submission with optimistic UI
- Error handling and display

**Key Decisions**:

- Multi-step wizard (5 steps)
- Sanitize all text inputs (DOMPurify)
- Turnstile required at submission
- Terms must be explicitly accepted

**Success Criteria**:

- All 5 steps navigate correctly
- Form validates each step before proceeding
- Contact info validated (email, phone format)
- Text inputs sanitized
- Terms checkbox required
- Turnstile token verified
- Submission creates booking
- Optimistic UI shows success before API response

---

#### Chunk 010: Booking Confirmation Flow

**Duration**: 60 minutes
**Source Docs**: `03-frontend-components.md` lines 601-700
**Dependencies**: 009 (requires successful submission)

**Scope**:

- Confirmation page component
- Booking reference display (large, copy-able)
- Payment instructions
- Unit request summary (X units for Y guests)
- Status tracking UI (pending assignment)
- Manual contact workflow documentation
- Print/download confirmation option

**Key Decisions**:

- Manual contact workflow (no email initially)
- Booking reference prominently displayed
- Clear "pending assignment" status

**Success Criteria**:

- Confirmation page loads after submission
- Booking reference displayed
- Payment instructions clear
- Unit request summary accurate
- Status shows "pending"
- Can copy booking reference
- Can print confirmation

---

### Phase 3: Admin Interface (011-014)

#### Chunk 011: Admin Queue with Urgency Scoring

**Duration**: 90 minutes
**Source Docs**: `04-admin-interface.md` lines 1-200
**Dependencies**: 004 (requires bookings to exist)

**Scope**:

- `PendingBookingsQueue` component
- Urgency score calculation (`calculateUrgencyScore()` utility)
- Queue sorting (high urgency first)
- Queue filtering (by date, status, urgency)
- Real-time updates with TanStack Query
- Mobile-responsive table
- Color-coded urgency indicators

**Key Decisions**:

- Urgency score: 0-100 (booking proximity, payment status, total amount)
- Assumes <100 pending bookings (no pagination initially)
- Real-time updates every 30 seconds

**Success Criteria**:

- Queue displays all pending multi-unit bookings
- Urgency scores calculated correctly
- Sorted by urgency (high to low)
- Can filter by date range
- Updates automatically every 30 seconds
- Mobile responsive
- Color coding visible (red = high, yellow = medium, green = low)

---

#### Chunk 012: Payment Verification UI

**Duration**: 75 minutes
**Source Docs**: `04-admin-interface.md` lines 201-350
**Dependencies**: 011 (requires queue to select booking)

**Scope**:

- Payment proof viewer component
- Signed URL fetching for private files
- Image zoom/pan controls
- PDF viewer integration
- Verify/reject controls
- Payment status update API call
- Audit logging integration
- Rejection reason input (optional notes)

**Key Decisions**:

- Uses signed URLs (5-minute expiry, renewable)
- Admin can view but not download (security)
- Audit log captures verify/reject actions

**Success Criteria**:

- Can view uploaded image/PDF
- Can zoom and pan images
- PDF renders correctly
- Verify button updates payment status
- Reject button prompts for reason
- Status persists to database
- Audit log entry created

---

#### Chunk 013: Unit Assignment System

**Duration**: 120 minutes
**Source Docs**: `04-admin-interface.md` lines 351-600
**Dependencies**: 012 (requires payment verification)

**Scope**:

- `UnitAssignmentInterface` component
- Available units checker (for date range)
- All-or-nothing validation UI
- Multi-select unit picker (must select exact number requested)
- Transaction-based assignment (atomic operation)
- Conflict detection (unit already assigned)
- Assignment preview before confirmation

**Key Decisions**:

- All-or-nothing: Must assign ALL requested units (UI enforces)
- Payment must be verified before assignment (UI blocks otherwise)
- Transaction ensures atomicity (all succeed or all fail)

**Success Criteria**:

- Shows available units for booking dates
- Can select multiple units
- Cannot select fewer/more than requested count
- Cannot assign if payment not verified (UI blocks)
- Assignment is atomic (all or nothing)
- Conflict errors caught and displayed
- Preview shows which units will be assigned

---

#### Chunk 014: Admin API Endpoints

**Duration**: 90 minutes
**Source Docs**: `02-api-specification.md` admin section
**Dependencies**: 011, 012, 013 (requires admin UI components)

**Scope**:

- GET `/api/admin/pending-bookings` - Queue endpoint with urgency scores
- GET `/api/admin/available-units` - Availability checker for date range
- POST `/api/admin/assign-units` - Assignment endpoint (calls PostgreSQL function)
- POST `/api/admin/verify-payment` - Payment verification endpoint
- JWT authentication middleware
- Admin role verification
- Rate limiting for admin endpoints

**Key Decisions**:

- JWT required for all admin endpoints
- Admin role checked via JWT claims
- Assignment calls `assign_units_to_booking()` PostgreSQL function

**Success Criteria**:

- Pending bookings endpoint returns sorted queue
- Available units endpoint filters by date correctly
- Assign units endpoint enforces all-or-nothing
- Verify payment endpoint updates status
- JWT authentication blocks unauthenticated requests
- Non-admin users blocked

---

### Phase 4: Testing & Launch (015-017)

#### Chunk 015: Unit and Integration Tests

**Duration**: 120 minutes
**Source Docs**: `07-testing-strategy.md` lines 1-300, `11-test-fixtures.md`
**Dependencies**: All previous chunks

**Scope**:

- Create test fixtures (images, PDFs, JSON payloads)
- Unit tests for pricing calculations (`calculate_booking_pricing()`)
- Discount rule evaluation tests (all 4 types)
- Best-of discount policy tests
- Idempotency tests (duplicate detection)
- Constraint violation tests (all-or-nothing, payment-before-assignment)
- API endpoint integration tests
- Mock data generation utilities

**Key Decisions**:

- Test fixtures committed to repo (`__tests__/fixtures/`)
- Uses Vitest for unit tests
- Supertest for API integration tests

**Success Criteria**:

- All unit tests pass (`npm run test:run`)
- Pricing function tests cover edge cases
- Discount tests cover all condition types
- Idempotency tests verify duplicate prevention
- Constraint tests verify database rules
- API tests verify request/response contracts
- Coverage >80% for critical paths

---

#### Chunk 016: E2E and Performance Tests

**Duration**: 145 minutes
**Source Docs**: `07-testing-strategy.md` lines 301-600
**Dependencies**: 015 (requires test fixtures)

**Scope**:

- Complete guest booking E2E flow (Playwright)
- Admin assignment E2E flow (Playwright)
- Concurrency tests (PostgreSQL EXCLUDE constraint)
- Performance baseline capture (before multi-unit)
- Performance regression tests (after multi-unit)
- Load testing with multiple simultaneous bookings
- Rollback procedure dry-run on staging

**Key Decisions**:

- Playwright for E2E tests
- Performance baseline captured PRE-implementation
- Load test: 10 concurrent bookings
- Rollback tested on staging (not production)

**Success Criteria**:

- E2E guest booking flow passes
- E2E admin assignment flow passes
- Concurrency test prevents double-booking
- Performance regression within acceptable thresholds (15-30% per metric, see 07-testing-strategy.md lines 1041-1048)
- Load test handles 10 concurrent bookings
- Rollback dry-run successful (<1 hour)
- All tests pass: `npm run test:all`

---

#### Chunk 017: Deployment and Monitoring

**Duration**: 90 minutes
**Source Docs**: `06-migration-guide.md`, `README.md` monitoring section
**Dependencies**: 016 (requires passing tests)

**Scope**:

- Cloudflare Pages deployment (frontend)
- Cloudflare Workers deployment (API)
- Database migration on production
- Monitoring dashboard setup (Grafana Cloud / UptimeRobot)
- Alert configuration (queue length, assignment time, errors)
- Admin training session (2 hours - comprehensive workflow training)
- Rollback procedure documentation
- Post-deployment verification

**Key Decisions**:

- Deploy to staging first, then production
- Monitoring uses free tier tools (Grafana Cloud, UptimeRobot)
- Alerts sent to admin email + Slack
- Rollback procedure documented and tested

**Success Criteria**:

- Frontend deployed to Cloudflare Pages
- API deployed to Cloudflare Workers
- Database migration successful (no errors)
- Monitoring dashboard live
- Alerts configured and tested
- Admin training completed
- Rollback procedure documented
- Post-deployment checks pass
- System operational

---

## Architectural Principles (Applied Throughout)

### 1. Array-Based Data Model

- Each `guest_booking_unit_requests` row = 1 unit
- NO `quantity` column exists
- Total units = COUNT(rows) for booking

### 2. Server-Side Pricing Authority

- PostgreSQL `calculate_booking_pricing()` is SOLE pricing calculator
- Client NEVER calculates pricing
- Client only displays server-calculated results
- Preview endpoint required for real-time display

### 3. All-or-Nothing Assignment

- Admin assigns ALL requested units or NONE
- No partial assignments allowed
- Enforced by database CHECK constraint + UI validation

### 4. Payment-Before-Assignment

- Payment must be verified before unit assignment
- Enforced by database CHECK constraint

### 5. Flexible Discount System

- JSONB conditions support all discount types:
  - Duration (`min_nights`)
  - Date range (`date_range`)
  - Advance booking (`advance_booking`)
  - Unit count (`unit_count`)
- Best-of policy: Highest discount wins (no stacking)
- Admin can add new rules post-launch without code changes

### 6. Security-First Approach

- Turnstile CAPTCHA on all public endpoints
- DOMPurify sanitization for all text inputs
- Row Level Security (RLS) for multi-tenant isolation
- JWT authentication for admin endpoints
- Signed URLs for file uploads (5-minute expiry)
- File type validation via magic numbers

### 7. Manual Contact Workflow

- NO email automation initially
- Admin contacts guests via phone/SMS
- Email notifications deferred to post-launch

### 8. Idempotency and Concurrency

- Client-generated UUID keys prevent duplicates
- 48-hour expiry window (cleaned daily)
- PostgreSQL EXCLUDE constraint prevents double-booking
- Optimistic locking for admin UI updates

---

## Chunk Dependencies Graph

```
Phase 1: Database & Backend
001 (Schema) → 002 (Pricing) ↘
                              → 004 (API Core) → 005 (Idempotency)
               003 (Security) ↗                        ↓

Phase 2: Guest Booking Flow
006 (Date/Unit UI) → 007 (Summary) → 008 (Upload) → 009 (Validation) → 010 (Confirmation)
       ↑                  ↑                ↑               ↑
       └──────────────────┴────────────────┴───────────────┘
                    (All require API from 004)

Phase 3: Admin Interface
011 (Queue) → 012 (Verification) → 013 (Assignment) ← 014 (Admin API)
     ↑              ↑                     ↑                  ↑
     └──────────────┴─────────────────────┴──────────────────┘
                (All require API from 004)

Phase 4: Testing & Launch
015 (Unit Tests) → 016 (E2E Tests) → 017 (Deployment)
     ↑                   ↑                   ↑
     └───────────────────┴───────────────────┘
        (Require all chunks 001-014)
```

---

## Source Documentation Reference

| Chunk(s)                | Primary Source Docs                                                            |
| ----------------------- | ------------------------------------------------------------------------------ |
| 001, 002, 003           | `01-database-schema.md`                                                        |
| 002                     | `05-simplified-pricing-engine.md`                                              |
| 004, 014                | `02-api-specification.md`                                                      |
| 006, 007, 008, 009, 010 | `03-frontend-components.md`                                                    |
| 011, 012, 013           | `04-admin-interface.md`                                                        |
| 017                     | `06-migration-guide.md`                                                        |
| 015, 016                | `07-testing-strategy.md`, `11-test-fixtures.md`                                |
| All                     | `README.md`, `00-IMPORTANT-CLARIFICATION.md`, `09-implementation-decisions.md` |

---

## Time Estimates

| Phase                       | Chunks        | Total Time      |
| --------------------------- | ------------- | --------------- |
| Phase 1: Database & Backend | 001-005       | ~8.5 hours      |
| Phase 2: Guest Flow         | 006-010       | ~7.5 hours      |
| Phase 3: Admin Interface    | 011-014       | ~6.5 hours      |
| Phase 4: Testing & Launch   | 015-017       | ~7.0 hours      |
| **Total**                   | **17 chunks** | **~29.5 hours** |

_Note: These are focused implementation times. Include buffer for debugging and integration. Chunk 017's 90-minute deployment estimate does not include the 2-hour admin training session._

---

## Implementation Workflow

### For Each Chunk:

1. **Prepare**
   - Review source documentation
   - Verify prerequisites completed
   - Check current system state

2. **Create** (using implementation prompt - see below)
   - Generate 4 files (README, instructions, checkpoint, troubleshooting)
   - Reference this CHUNKING-STRATEGY.md
   - Include architectural principles

3. **Implement**
   - Follow instructions.md step-by-step
   - Test at each step
   - Handle errors using troubleshooting.md

4. **Verify**
   - Run checkpoint.md automated checks
   - Complete manual verification steps
   - Confirm success criteria met

5. **Commit**
   - Commit message: `feat: complete chunk [NUMBER]-[NAME]`
   - Tag commit if milestone: `chunk-[NUMBER]`

6. **Next**
   - Update progress tracker
   - Move to next chunk
   - Repeat workflow

---

## Success Metrics

### Per-Chunk Success

- [ ] All checkpoint tests pass
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Committed with proper message
- [ ] Documentation updated

### Phase Completion Success

- [ ] All phase chunks completed
- [ ] Integration tests pass
- [ ] Performance within targets
- [ ] Security review passed (Phase 1)
- [ ] User acceptance testing passed (Phases 2-3)

### Overall Launch Success

- [ ] All 17 chunks completed
- [ ] All tests passing (`npm run test:all`)
- [ ] Deployed to production
- [ ] Monitoring active
- [ ] Rollback procedure verified
- [ ] Admin training completed

---

## Rollback Strategy

### Per-Chunk Rollback

- Revert commit for specific chunk
- Drop tables/functions added in that chunk
- Remove API endpoints added in that chunk
- Restore previous state

### Phase Rollback

- Revert all commits in phase
- Run rollback migration script
- Restore previous API deployment
- Restore previous frontend deployment

### Full Rollback (Emergency)

- Follow `06-migration-guide.md` rollback section
- Database rollback script (preserves existing bookings)
- API rollback via Cloudflare Workers
- Frontend rollback via Cloudflare Pages
- Target: <1 hour total rollback time

---

## Notes for AI Implementation

When creating chunks using this strategy:

1. **Reference this document** for scope and decisions
2. **Follow household-hub pattern** exactly (4 files per chunk)
3. **Include architectural principles** in each chunk's README
4. **Cross-reference source docs** with line numbers
5. **Make checkpoints specific** to chunk scope
6. **Include troubleshooting** for common errors in that chunk
7. **Respect dependencies** - don't skip prerequisite chunks
8. **Time-box strictly** - if chunk exceeds estimate, split it

---

**Version**: 1.0
**Last Updated**: 2025-10-24
**Status**: Ready for Implementation
