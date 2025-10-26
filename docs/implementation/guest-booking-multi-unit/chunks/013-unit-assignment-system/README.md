# Chunk 013: Unit Assignment System

## At a Glance

| Property | Value |
|----------|-------|
| **Chunk Number** | 013 |
| **Chunk Name** | unit-assignment-system |
| **Phase** | Phase 3: Admin Interface |
| **Estimated Time** | 120 minutes |
| **Milestone** | Admin can assign units to multi-unit bookings with all-or-nothing enforcement |
| **Can Skip?** | ❌ No - Core admin workflow for completing multi-unit bookings |
| **Prerequisites** | Chunks 001-012 completed (esp. 001 for schema, 003 for constraints, 012 for payment verification) |

## What You're Building

This chunk creates the **unit assignment system** - the final step in converting a pending multi-unit booking into a confirmed reservation. Admin selects specific units for each requested unit, and the system assigns them atomically (all or nothing).

### New Components (1)

1. **`UnitAssignmentInterface`** (`src/components/admin/UnitAssignmentInterface.tsx`)
   - Displays unit requests summary (X units for Y guests each)
   - Fetches available units for booking date range
   - Multi-select unit picker with visual selection feedback
   - All-or-nothing validation UI (must select exact count)
   - Assignment preview before confirmation
   - Conflict detection and error display
   - Transaction-based atomic assignment
   - Mobile responsive grid layout

### New API Endpoints (2)

2. **`GET /api/admin/available-units`** (`functions/api/admin/available-units.ts`)
   - Accepts `{ check_in_date, check_out_date }` query params
   - Returns units available for date range (not booked/assigned)
   - Filters by `unit_status = 'Available'`
   - Excludes units with overlapping bookings
   - JWT authentication required
   - Admin role verification

3. **`POST /api/admin/assign-units`** (`functions/api/admin/assign-units.ts`)
   - Accepts `{ booking_id, unit_ids: UUID[] }`
   - Calls PostgreSQL `assign_units_to_booking()` function
   - Validates payment_status = 'Verified' (enforced by DB constraint)
   - Validates all-or-nothing (array length = requested count)
   - Creates `booking_units` entries atomically
   - Updates `booking_status` to 'Confirmed'
   - Audit logging integration
   - JWT authentication required

### New Database Function (1)

4. **`assign_units_to_booking()`** PostgreSQL Function
   - Accepts `p_booking_id UUID`, `p_unit_ids UUID[]`
   - Validates booking is pending and payment verified
   - Validates array length matches requested unit count
   - Inserts `booking_units` rows in single transaction
   - Updates booking status to 'Confirmed' and `unit_assignment_status` to 'assigned'
   - **All-or-nothing**: If ANY insert fails, entire transaction rolls back
   - **Concurrency**: EXCLUDE constraint prevents double-booking
   - **Timeout**: 5-second statement timeout for safety
   - Returns void on success, raises exception on failure

### New Route (1)

5. **Assignment Route** (`src/routes/admin/assign-units/$bookingId.tsx`)
   - TanStack Router route at `/admin/assign-units/{bookingId}`
   - Fetches booking details + unit requests
   - Authentication guard (redirects if not admin)
   - Payment verification check (redirects if not verified)
   - Layout integration with existing admin UI

## Why This Matters

### Business Value

- **Reservation Fulfillment** - Converts pending bookings into confirmed reservations
- **All-or-Nothing Guarantee** - Guest receives all requested units or booking remains pending
- **Conflict Prevention** - Cannot double-book same unit for overlapping dates
- **Payment Protection** - Cannot assign units until payment verified (fraud prevention)
- **Audit Trail** - All assignments logged with timestamp, admin ID, units assigned
- **Manual Control** - Admin has full flexibility in unit selection

### Operational Value

- **Quick Assignment** - Admin selects units visually, clicks once, all units assigned
- **Availability Checking** - Only shows units available for exact date range
- **Conflict Detection** - EXCLUDE constraint catches concurrent assignment attempts
- **Transaction Safety** - Partial assignments impossible (database enforces atomicity)
- **Error Recovery** - Transaction rollback ensures no orphaned records
- **Mobile Accessible** - Responsive design for tablet/phone assignment on-the-go

### Technical Value

- **Database Enforcement** - PostgreSQL function is authoritative (no client-side workarounds)
- **ACID Compliance** - Full transaction support with automatic rollback
- **Concurrency Control** - EXCLUDE constraint prevents race conditions
- **Type Safety** - TypeScript + Zod validation before database call
- **Idempotent** - Cannot assign twice (status check prevents re-assignment)
- **Performance** - Single database function call (not multiple round-trips)

### Assignment Workflow

**Admin Workflow**:
1. Admin views queue (chunk 011)
2. Sees booking with `payment_status = 'Verified'` and `unit_assignment_status = 'pending'`
3. Clicks "Assign Units" (navigates to assignment page)
4. Views unit requests (e.g., "3 units requested: 2 guests, 3 guests, 2 guests")
5. Sees available units for date range (e.g., 8 units available)
6. Selects exactly 3 units (checkboxes or click cards)
7. All-or-nothing indicator turns green (3/3 selected)
8. Clicks "Assign 3 Units"
9. Confirmation dialog appears
10. Clicks "Confirm Assignment"
11. Transaction executes atomically
12. Booking status → 'Confirmed', assignment status → 'assigned'
13. `booking_units` entries created
14. Audit log written
15. Returns to queue (booking no longer in pending list)

**Success Path**:
- All 3 units assigned simultaneously
- Booking status updated
- Guest can now check in
- Admin calls guest to confirm (manual contact workflow)

**Failure Scenarios**:
- **Concurrent conflict**: Another admin assigned a unit → Transaction rolls back, error shown
- **Partial selection**: Only 2/3 units selected → UI blocks assignment
- **Payment not verified**: DB CHECK constraint blocks → Error shown
- **Invalid unit**: Unit doesn't exist → Transaction rolls back
- **Database timeout**: >5 seconds → Transaction rolls back automatically

## Before You Start

### Prerequisites Checklist

Verify you have completed:

- [ ] **Chunk 001**: Database schema with `booking_units` table, `unit_assignment_status` column
- [ ] **Chunk 003**: EXCLUDE constraint on `booking_units` (prevents double-booking), CHECK constraints (payment-before-assignment, all-or-nothing)
- [ ] **Chunk 012**: Payment verification UI (must verify payment before assigning units)
- [ ] PostgreSQL extension `btree_gist` enabled (`CREATE EXTENSION btree_gist;`)
- [ ] `booking_units` table exists with EXCLUDE constraint
- [ ] `bookings.unit_assignment_status` column exists
- [ ] Audit logging system operational
- [ ] You have read `docs/implementation/guest-booking-multi-unit/04-admin-interface.md` lines 351-600

### Verify Prerequisites

**IMPORTANT**: Before starting chunk 013, run these verification commands to ensure all prerequisites are met. Implementing without verified prerequisites will result in cryptic errors and wasted debugging time.

**Estimated Time**: 5 minutes

#### Check 1: Verify Chunk 001 (Database Schema) Completed

```bash
npx supabase db execute "
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('booking_units', 'guest_booking_unit_requests', 'pricing_config')
ORDER BY table_name;
"
```

**Expected Output**: 3 rows
```
table_name
─────────────────────────────
booking_units
guest_booking_unit_requests
pricing_config
```

**If Check Fails**: Complete **Chunk 001: Database Schema Setup** before proceeding.

---

#### Check 2: Verify Chunk 003 (EXCLUDE Constraint) Completed

```bash
npx supabase db execute "
SELECT conname, contype, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'booking_units'::regclass
  AND contype = 'x';
"
```

**Expected Output**: 1 row with EXCLUDE constraint containing `daterange` and `&&` operator
```
conname               | contype | definition
────────────────────────────────────────────────────────────────────
no_double_booking     | x       | EXCLUDE USING gist (unit_id WITH =, daterange(check_in_date, check_out_date, '[]'::text) WITH &&) WHERE ((status <> 'cancelled'::text))
```

**If Check Fails**: Complete **Chunk 003: Security, RLS, and Constraints** before proceeding. Without this constraint, the system will allow double-booking of units.

---

#### Check 3: Verify btree_gist Extension Enabled

```bash
npx supabase db execute "
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'btree_gist';
"
```

**Expected Output**: 1 row
```
extname     | extversion
────────────────────────
btree_gist  | 1.7
```

**If Check Fails**: Run this command to enable the extension:
```bash
npx supabase db execute "CREATE EXTENSION IF NOT EXISTS btree_gist;"
```

**Why This Matters**: The EXCLUDE constraint on `booking_units` requires `btree_gist` for daterange overlap detection (`&&` operator).

---

#### Check 4: Verify unit_assignment_status Column Exists

```bash
npx supabase db execute "
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND column_name = 'unit_assignment_status';
"
```

**Expected Output**: 1 row
```
column_name            | data_type       | column_default
───────────────────────────────────────────────────────────
unit_assignment_status | character varying | 'pending'::character varying
```

**If Check Fails**: Complete **Chunk 001: Database Schema Setup** before proceeding. This column tracks assignment progress.

---

#### Check 5: Verify Chunk 012 (Payment Verification UI) Exists

```bash
# Check if payment verification component exists
ls src/components/admin/*Payment*.tsx 2>/dev/null || echo "FAIL: Payment verification component not found"
```

**Expected Output**: File path (e.g., `src/components/admin/PaymentVerificationUI.tsx`)

**Alternative Check** (if file not found):
```bash
find src/components -name "*payment*" -o -name "*Payment*" 2>/dev/null | head -5
```

**If Check Fails**: Complete **Chunk 012: Payment Verification UI** before proceeding. You need this workflow to verify payments before assigning units.

---

#### Check 6: Verify Audit Logging System Operational

```bash
npx supabase db execute "
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_name = 'audit_logs'
  AND column_name IN ('action', 'entity_type', 'entity_id', 'user_id', 'metadata')
ORDER BY ordinal_position
LIMIT 5;
"
```

**Expected Output**: 5 rows (audit_logs table exists with required columns)
```
table_name  | column_name
──────────────────────────
audit_logs  | action
audit_logs  | entity_type
audit_logs  | entity_id
audit_logs  | user_id
audit_logs  | metadata
```

**If Check Fails**: The audit logging system may not be set up. This is optional for chunk 013 implementation but recommended for production. You can proceed, but add a TODO to implement audit logging.

---

### Prerequisites Verification Summary

**All Checks Passed?**
- ✅ Check 1: Database tables exist
- ✅ Check 2: EXCLUDE constraint configured
- ✅ Check 3: btree_gist extension enabled
- ✅ Check 4: unit_assignment_status column exists
- ✅ Check 5: Payment verification UI exists
- ✅ Check 6: Audit logging operational (optional)

**If ALL checks pass**: ✅ Proceed to implementation (instructions.md)

**If ANY check fails**: ⚠️ Complete the corresponding prerequisite chunk first. Attempting to implement chunk 013 without prerequisites will result in:
- PostgreSQL function creation failures (missing tables/constraints)
- API endpoint errors (missing columns)
- UI runtime errors (missing routes/components)
- 30-60 minutes wasted debugging

---

### Knowledge Requirements

You should understand:

- React 19 with TypeScript
- TanStack Query v5 (useQuery, useMutation)
- PostgreSQL PL/pgSQL (stored functions, transactions, EXCEPTION blocks)
- PostgreSQL EXCLUDE constraints (concurrency control)
- shadcn/ui components (Card, Checkbox, Button, Alert)
- All-or-nothing transaction patterns
- Optimistic UI updates with rollback

### Tools Required

- Code editor (VS Code recommended)
- Browser with React DevTools
- PostgreSQL client (psql or Supabase SQL editor)
- Supabase dashboard access
- Test bookings with verified payments
- Multiple test units in database

### Time Commitment

- **PostgreSQL function**: 25 minutes
- **Available units API**: 15 minutes
- **Assign units API**: 20 minutes
- **UI component**: 40 minutes
- **Route + integration**: 10 minutes
- **Verification**: 10 minutes

**Total**: ~120 minutes for complete implementation and verification

## What Happens Next

### Immediate Outcomes

After completing this chunk:

✅ Admin can view available units for booking date range
✅ Admin can select specific units for assignment
✅ Admin cannot assign fewer/more units than requested (all-or-nothing enforced)
✅ Assignment is atomic (all units assigned or none)
✅ Concurrent booking conflicts prevented by EXCLUDE constraint
✅ Payment verification required before assignment (DB enforces)
✅ Booking status updates to 'Confirmed' on successful assignment
✅ Audit log captures assignment details
✅ Mobile responsive unit selection
✅ Transaction rollback on any error

### What You Can Do

- ✅ Navigate to `/admin/assign-units/{bookingId}` from queue
- ✅ View unit requests summary
- ✅ See available units for date range
- ✅ Select units with visual feedback (checkboxes + border highlight)
- ✅ Preview assignment before confirmation
- ✅ Assign all units atomically
- ✅ See success confirmation
- ✅ View assignment in booking details
- ✅ Verify audit log entry

### What You Cannot Do Yet

- ❌ View assignment history across all bookings (Chunk 014 - Admin API endpoints)
- ❌ Bulk assign multiple bookings (Post-launch feature)
- ❌ Automatically suggest optimal unit assignments (Post-launch AI feature)
- ❌ Reassign units after assignment (Requires cancellation workflow, post-launch)

### Next Chunk

**Chunk 014: Admin API Endpoints** - Implements remaining admin endpoints including pending bookings queue with urgency scores, assignment history, and admin analytics. Provides backend support for complete admin workflow.

**Dependencies for Chunk 014**: Requires completed assignment system (this chunk) to provide meaningful assignment history data.

## Key Files Created/Modified

```
src/
├── components/
│   └── admin/
│       └── UnitAssignmentInterface.tsx         [NEW - ~400 lines]
│           ├── Unit requests summary display
│           ├── Available units fetcher (TanStack Query)
│           ├── Multi-select unit picker (grid layout)
│           ├── All-or-nothing validation UI
│           ├── Assignment preview modal
│           ├── Transaction mutation with optimistic updates
│           ├── Conflict error handling
│           └── Mobile responsive design
│
├── routes/
│   └── admin/
│       └── assign-units/
│           └── $bookingId.tsx                  [NEW - ~120 lines]
│               ├── TanStack Router route with booking ID param
│               ├── Fetch booking + unit requests + payment status
│               ├── Authentication guard
│               ├── Payment verification guard
│               └── Layout integration
│
└── components/
    └── admin/
        └── PendingBookingsQueue.tsx            [MODIFIED - update button to navigate to assignment]

functions/
└── api/
    └── admin/
        ├── available-units.ts                  [NEW - ~100 lines]
        │   ├── GET endpoint handler
        │   ├── Date range query params
        │   ├── Availability query (excludes booked units)
        │   ├── JWT authentication middleware
        │   └── Admin role verification
        │
        └── assign-units.ts                     [NEW - ~200 lines]
            ├── POST endpoint handler
            ├── Calls assign_units_to_booking() function
            ├── Validates all-or-nothing
            ├── Audit log integration
            ├── JWT authentication middleware
            ├── Admin role verification
            └── Transaction error handling

supabase/
└── migrations/
    └── [timestamp]_assign_units_function.sql   [NEW - ~100 lines]
        ├── CREATE FUNCTION assign_units_to_booking()
        ├── Transaction block (BEGIN...EXCEPTION)
        ├── Payment verification check
        ├── All-or-nothing validation
        ├── INSERT booking_units loop
        ├── UPDATE bookings status
        ├── Automatic rollback on error
        └── 5-second statement timeout
```

## Related Documentation

### Source Documentation

- **Primary**: `docs/implementation/guest-booking-multi-unit/04-admin-interface.md` (lines 351-600)
  - Unit assignment interface specification
  - `assign_units_to_booking()` PostgreSQL function
  - All-or-nothing validation patterns
  - Transaction timeout configuration
  - Available units API

- **Database**: `docs/implementation/guest-booking-multi-unit/01-database-schema.md`
  - `booking_units` table structure
  - EXCLUDE constraint for concurrency
  - `unit_assignment_status` column
  - CHECK constraints (payment-before-assignment, all-or-nothing)

- **API**: `docs/implementation/guest-booking-multi-unit/02-api-specification.md`
  - Admin endpoints specification
  - JWT authentication patterns
  - Request/response schemas

- **Architecture**: `docs/implementation/guest-booking-multi-unit/CHUNKING-STRATEGY.md` (lines 447-478)
  - Chunk 013 specification
  - Dependencies graph
  - All-or-nothing principle

- **Implementation Decisions**: `docs/implementation/guest-booking-multi-unit/09-implementation-decisions.md`
  - All-or-nothing assignment decision (lines 66-92)
  - Concurrency control decision (lines 260-290)
  - Database constraints decision (lines 330-347)

### Codebase Patterns

- **Supabase RPC**: `src/lib/supabase.ts`
  - Calling PostgreSQL functions via `.rpc()`
  - Error handling patterns

- **Audit Logging**: `src/lib/audit-logger.ts`
  - `logAuditEvent()` function for assignment actions
  - Audit event structure

- **Admin Auth**: `functions/api/admin/verify-payment.ts` (from chunk 012)
  - JWT token verification pattern
  - Admin role checking
  - Authentication middleware

- **Transaction Patterns**: `docs/implementation/guest-booking-multi-unit/04-admin-interface.md` (lines 526-578)
  - PostgreSQL EXCEPTION block for automatic rollback
  - All-or-nothing validation in PL/pgSQL
  - Statement timeout configuration

## Success Criteria

This chunk is complete when:

- [ ] PostgreSQL `assign_units_to_booking()` function created
- [ ] Function has 5-second statement timeout configured
- [ ] `src/components/admin/UnitAssignmentInterface.tsx` created
- [ ] `functions/api/admin/available-units.ts` created
- [ ] `functions/api/admin/assign-units.ts` created
- [ ] `src/routes/admin/assign-units/$bookingId.tsx` created
- [ ] Queue button navigation updated (chunk 011's component)
- [ ] `npm run type-check` passes (no TypeScript errors)
- [ ] `npm run lint` passes (no ESLint warnings)
- [ ] Available units API returns correct units for date range
- [ ] Cannot select fewer than requested units (UI blocks)
- [ ] Cannot select more than requested units (UI blocks)
- [ ] Assignment is atomic (all succeed or all rollback)
- [ ] EXCLUDE constraint prevents concurrent double-booking
- [ ] Cannot assign if payment not verified (DB constraint blocks)
- [ ] Booking status updates to 'Confirmed' after assignment
- [ ] `unit_assignment_status` updates to 'assigned'
- [ ] Audit log entry created for assignment
- [ ] Cannot reassign after assignment (idempotent)
- [ ] Transaction rolls back on partial failure
- [ ] Mobile responsive (tested at 375px viewport)
- [ ] Admin authentication enforced
- [ ] All checkpoint tests pass (see `checkpoint.md`)

## Quick Start

Ready to begin? Follow these steps:

1. **Read this README completely** (you are here)
2. **Verify prerequisites** - Chunks 001, 003, 012 must be complete
3. **Open `instructions.md`** - Follow step-by-step implementation guide
4. **Create PostgreSQL function** - `assign_units_to_booking()` with transaction support
5. **Create API endpoints** - Available units + assign units
6. **Create UI component** - Unit assignment interface with all-or-nothing validation
7. **Create route** - TanStack Router route with guards
8. **Test manually** - Select units, assign, verify atomicity
9. **Run checkpoints** - Verify everything works (`checkpoint.md`)
10. **Troubleshoot if needed** - Common issues and solutions (`troubleshooting.md`)
11. **Commit changes** - `git commit -m "feat: complete chunk 013-unit-assignment-system"`
12. **Move to Chunk 014** - Admin API Endpoints (queue, history, analytics)

---

**Ready?** Open `instructions.md` to begin implementation.
