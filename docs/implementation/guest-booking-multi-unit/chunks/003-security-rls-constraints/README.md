# Chunk 003: Security, RLS, and Constraints

## At a Glance

| Property | Value |
|----------|-------|
| **Chunk Number** | 003 |
| **Chunk Name** | security-rls-constraints |
| **Phase** | Phase 1: Database & Backend Core |
| **Estimated Time** | 90 minutes |
| **Milestone** | Bulletproof security and business rule enforcement |
| **Can Skip?** | ❌ No - Critical for data integrity and compliance |
| **Prerequisites** | Chunk 001 completed (tables must exist) |

## What You're Building

This chunk implements the **complete security and business rule enforcement layer** for the multi-unit guest booking system. You'll add:

### Database Constraints (3)

1. **Concurrency Control** - PostgreSQL EXCLUDE constraint prevents double-booking at commit time (race-condition-free)
2. **All-or-Nothing Assignment** - CHECK constraint ensures admin assigns ALL requested units or NONE
3. **Payment Verification** - CHECK constraint enforces payment verification before unit assignment (already created in Chunk 001, will verify)

### Audit Logging System

4. **Immutable Audit Trail** - Triggers automatically log all critical data mutations (booking creation, payment verification, unit assignment) for compliance

### Row Level Security

5. **RLS Policy Verification** - Confirm multi-tenant data isolation policies work correctly (policies created in Chunk 001)

## Why This Matters

### Business Value

- **Prevents Revenue Loss** - EXCLUDE constraint makes double-booking **mathematically impossible** (even under high concurrency)
- **Ensures Regulatory Compliance** - Audit trail provides immutable record for Philippine business regulations (BIR, DTI)
- **Protects Customer Trust** - All-or-nothing assignment prevents partial fulfillment confusion
- **Reduces Admin Errors** - Database enforces business rules automatically (no manual checking needed)

### Technical Value

- **Database-Level Enforcement** - Constraints cannot be bypassed by buggy application code (bulletproof)
- **Zero Race Conditions** - EXCLUDE constraint uses PostgreSQL's MVCC (Multi-Version Concurrency Control) for atomic checks
- **Performance Optimized** - GiST indexes make EXCLUDE constraint checks O(log n) time complexity
- **Compliance Ready** - Audit trail timestamps are PostgreSQL-generated (tamper-proof)

### Security Value

- **Multi-Tenant Isolation** - RLS policies prevent data leakage between different user sessions
- **Privilege Separation** - Service role vs authenticated vs anonymous access controls
- **Attack Surface Reduction** - Constraints limit what malicious actors can do even with SQL injection
- **Defense in Depth** - Multiple layers (RLS + constraints + audit logging)

### Input Validation Foundation

These database constraints serve as the **authoritative input validation layer** for the multi-unit booking system. Unlike application-level validation (which can be bypassed by bugs, outdated clients, or direct database access), database constraints guarantee data integrity at the persistence layer. Every business rule is enforced before data is committed, making invalid data states mathematically impossible regardless of how data enters the system.

## Before You Start

### Prerequisites Checklist

Verify you have completed:

- [ ] **Chunk 001** is fully complete (all checkpoint tests passing)
- [ ] `pricing_config` table exists with default row
- [ ] `guest_booking_unit_requests` table exists
- [ ] `bookings` table has multi-unit columns (is_multi_unit, unit_assignment_status, etc.)
- [ ] `booking_units` table exists (from base schema) - **CRITICAL for EXCLUDE constraint**
- [ ] PostgreSQL extension `btree_gist` is installed (run: `SELECT * FROM pg_extension WHERE extname = 'btree_gist';`)
- [ ] You have database admin access (service_role key)
- [ ] You have read `01-database-schema.md` lines 191-265 (constraints section)

### Knowledge Requirements

You should understand:

- **CHECK Constraints** - SQL constraints that validate data before insert/update
- **EXCLUDE Constraints** - PostgreSQL-specific constraints for preventing overlapping ranges
- **GiST Indexes** - Generalized Search Tree indexes for geometric/range queries
- **Database Triggers** - Functions that execute automatically on data changes
- **Row Level Security (RLS)** - PostgreSQL feature for row-based access control
- **Concurrency Control** - How databases handle simultaneous conflicting operations

### Tools Required

- Supabase SQL Editor (web-based) OR
- `psql` command-line client OR
- Database GUI tool (TablePlus, pgAdmin, DBeaver)

### Time Commitment

- **SQL execution**: 20 minutes (copy-paste migrations)
- **Verification**: 25 minutes (run all constraint tests)
- **Troubleshooting buffer**: 30 minutes (if constraints fail)
- **Documentation**: 15 minutes (understand what was created)

**Total**: ~90 minutes for complete implementation and verification

## What Happens Next

### Immediate Outcomes

After completing this chunk:

✅ Double-booking is **impossible** (EXCLUDE constraint enforces at database level)
✅ Partial assignments are **blocked** (all-or-nothing CHECK constraint)
✅ Payment verification is **required** before assignment (payment-before-assignment CHECK constraint)
✅ All critical operations are **logged** (audit triggers create immutable trail)
✅ RLS policies **verified working** (multi-tenant isolation confirmed)

### What You Can Do

- ✅ Test concurrent booking attempts (should fail with conflict error)
- ✅ Verify assignment without payment fails (constraint blocks)
- ✅ Verify partial assignment fails (constraint blocks)
- ✅ Query audit logs for compliance reporting
- ✅ Confirm RLS policies block unauthorized access

### What You Cannot Do Yet

- ❌ Create bookings via API (Chunk 004 - API endpoints)
- ❌ Test full guest booking flow (Chunk 006-010 - Guest booking UI)
- ❌ Assign units via admin interface (Chunk 011-014 - Admin UI)

### Next Chunk

**Chunk 004: Core API Endpoints** - Implements REST API for guest bookings with Cloudflare Workers, leveraging the security foundation built in this chunk.

**Dependencies for Chunk 004**: Requires constraints and RLS policies created in this chunk to enforce business rules at API layer.

## Key Files Created/Modified

```
database/
├── migrations/
│   └── 022-security-constraints-audit.sql   [NEW - 350 lines]
│       ├── EXCLUDE constraint (no double-booking)
│       ├── All-or-nothing assignment CHECK constraint
│       ├── Audit triggers (booking_created, payment_verified, units_assigned)
│       └── Constraint verification tests
│
src/
└── (No application code changes - database-only chunk)
```

**Note:** This chunk modifies existing database objects created in Chunk 001. No new tables are created.

## Related Documentation

### Source Documentation

- **Primary**: `docs/implementation/guest-booking-multi-unit/01-database-schema.md`
  - Lines 191-205: EXCLUDE constraint for concurrency control
  - Lines 206-231: Business rule constraints (payment-before-assignment, all-or-nothing)
  - Lines 603-657: Row Level Security policies

- **Secondary**: `docs/implementation/guest-booking-multi-unit/09-implementation-decisions.md`
  - Lines 262-289: Concurrency control decision (EXCLUDE constraint rationale)
  - Lines 331-347: Database constraint enforcement philosophy
  - Lines 387-407: Security considerations

- **Architecture**: `docs/implementation/guest-booking-multi-unit/CHUNKING-STRATEGY.md`
  - Lines 112-138: Chunk 003 specification
  - Lines 624-681: Architectural principles (security-first, all-or-nothing)

### Codebase Patterns

- **Database Security**: `CLAUDE.md` (Row Level Security patterns)
- **Audit Logging**: `lib/audit-logger.ts` (application-level audit pattern - database triggers complement this)
- **Constraint Patterns**: `database/migrations/` (existing CHECK constraint examples)

## Success Criteria

This chunk is complete when:

- [ ] EXCLUDE constraint exists on `booking_units` table (prevents double-booking)
- [ ] All-or-nothing assignment CHECK constraint exists on `bookings` table
- [ ] Payment-before-assignment CHECK constraint exists (verify from Chunk 001)
- [ ] Audit triggers fire on booking creation, payment verification, unit assignment
- [ ] Concurrent booking attempts fail with conflict error (tested)
- [ ] Assignment without payment fails with constraint error (tested)
- [ ] Partial assignment fails with constraint error (tested)
- [ ] RLS policies verified working (authenticated vs anon access tested)
- [ ] All checkpoint tests pass (see `checkpoint.md`)

## Architectural Principles Enforced

This chunk implements core architectural decisions:

### 1. Security-First Approach

From `CHUNKING-STRATEGY.md` lines 660-668:

- **Turnstile CAPTCHA** on all public endpoints (API layer, not database)
- **DOMPurify sanitization** for all text inputs (application layer)
- **Row Level Security (RLS)** for multi-tenant isolation (✅ **this chunk**)
- **JWT authentication** for admin endpoints (API layer)
- **Signed URLs** for file uploads (application layer)
- **File type validation** via magic numbers (application layer)

**This chunk focuses on database-level security** (RLS, constraints, audit logging).

### 2. All-or-Nothing Assignment

From `CHUNKING-STRATEGY.md` lines 640-644:

- Admin assigns ALL requested units or NONE
- No partial assignments allowed
- **Enforced by database CHECK constraint** (✅ **this chunk**)
- UI validation is secondary (database is authoritative)

### 3. Concurrency Control

From `09-implementation-decisions.md` lines 262-289:

- **PostgreSQL EXCLUDE constraint as primary mechanism** (✅ **this chunk**)
- Bulletproof at commit time (race-condition-free)
- No application-level locking required
- Optimistic locking for admin UI updates (application layer)

### 4. Payment Before Assignment

From `01-database-schema.md` lines 206-217:

- Payment must be verified before unit assignment
- **Enforced by database CHECK constraint** (created in Chunk 001, verified in this chunk)
- Cannot be bypassed by application bugs

## Quick Start

Ready to begin? Follow these steps:

1. **Read this README completely** (you are here)
2. **Verify prerequisites** - Chunk 001 must be complete
3. **Open `instructions.md`** - Follow step-by-step SQL migration guide
4. **Execute migrations** - Copy-paste SQL into Supabase SQL Editor
5. **Run checkpoints** - Verify all constraints work (`checkpoint.md`)
6. **Troubleshoot if needed** - Common issues and solutions (`troubleshooting.md`)
7. **Commit changes** - `git commit -m "feat: complete chunk 003-security-rls-constraints"`
8. **Move to Chunk 004** - Core API Endpoints

---

**Ready?** Open `instructions.md` to begin securing your database.
