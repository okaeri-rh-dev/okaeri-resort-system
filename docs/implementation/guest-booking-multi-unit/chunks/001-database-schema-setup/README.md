# Chunk 001: Database Schema Setup

## At a Glance

| Property | Value |
|----------|-------|
| **Chunk Number** | 001 |
| **Chunk Name** | database-schema-setup |
| **Phase** | Phase 1: Database & Backend Core |
| **Estimated Time** | 90 minutes |
| **Milestone** | Foundation for multi-unit guest booking system |
| **Can Skip?** | ❌ No - Required for all subsequent chunks |
| **Prerequisites** | Supabase project setup, database access |

## What You're Building

This chunk establishes the **complete database foundation** for the multi-unit guest booking system. You'll create:

### New Tables (4)

1. **`pricing_config`** - Single source of truth for all pricing and capacity settings (singleton table with CHECK constraint ensuring only one row)
2. **`guest_booking_unit_requests`** - Array-based model where each row = 1 unit request (NO quantity column)
3. **`discount_rules`** - Flexible discount system with JSONB conditions supporting all discount types
4. **`idempotency_keys`** - Prevents duplicate bookings with 48-hour expiry window

### Extended Tables (1)

5. **`bookings`** - Add 9 new columns for multi-unit support (is_multi_unit, requested_unit_count, discount_percent, unit_assignment_status, etc.)

### PostgreSQL Functions (5)

All functions implement **server-side authority** - the database is the single source of truth for pricing and business logic.

1. **`calculate_booking_pricing()`** - **PLACEHOLDER** pricing function (minimal stub, full implementation in Chunk 002)
2. **`create_guest_booking()`** - Atomic booking creation with idempotency checking
3. **`assign_units_to_booking()`** - All-or-nothing unit assignment with payment verification
4. **`cleanup_expired_idempotency_keys()`** - Daily cleanup cron (2:00 AM UTC)
5. **`cleanup_expired_payment_proofs()`** - Weekly cleanup cron (Sunday 3:00 AM UTC)

### Database Constraints (3)

Business rules enforced at database level (cannot be bypassed by buggy code):

1. **All-or-nothing assignment** - Admin must assign ALL requested units or NONE
2. **Payment-before-assignment** - Payment verification required before unit assignment
3. **No double-booking** - PostgreSQL EXCLUDE constraint prevents overlapping bookings

### Security & Performance

- Row Level Security (RLS) policies for all new tables
- 11 performance indexes (partial, GIN, GiST)
- Proper foreign key constraints and cascades

## Why This Matters

### Business Value

- **Prevents revenue loss** - Double-booking prevention is bulletproof at database level
- **Ensures pricing accuracy** - Server-side pricing eliminates client/server sync issues
- **Supports compliance** - Immutable pricing snapshots for historical accuracy
- **Enables flexibility** - Admin can add new discount types post-launch without code changes

### Technical Value

- **Single source of truth** - `pricing_config` table centralizes all settings (no scattered configuration)
- **Atomic operations** - Functions prevent orphaned records and partial updates
- **Extensible architecture** - JSONB conditions support any discount type (unit_count, seasonal, loyalty, etc.)
- **Performance optimized** - Indexes designed for serverless Neon PostgreSQL with connection pooling

### Architectural Principles Enforced

This chunk implements the **core architectural decisions** from `09-implementation-decisions.md`:

✅ **Array-based model** - Each `guest_booking_unit_requests` row = 1 unit (NOT quantity-based)
✅ **Server-side pricing authority** - PostgreSQL function is SOLE calculator (client only displays)
✅ **All-or-nothing assignment** - Database CHECK constraint enforces complete assignment
✅ **Centralized configuration** - `pricing_config` singleton table for all pricing/capacity
✅ **Flexible discounts** - Engine supports 4 types (duration, date-range, advance-booking, unit-count)
✅ **Security-first** - RLS policies, idempotency, concurrency control

## Before You Start

### Prerequisites Checklist

Verify you have completed:

- [ ] Supabase project is provisioned and accessible
- [ ] You have database admin credentials (service_role key)
- [ ] Existing schema is in production (units, bookings, guests tables exist)
- [ ] You have tested database connection via Supabase dashboard or SQL editor
- [ ] You have read `docs/implementation/guest-booking-multi-unit/01-database-schema.md` (source documentation)
- [ ] You have read `docs/implementation/guest-booking-multi-unit/CHUNKING-STRATEGY.md` (architectural principles)

### Knowledge Requirements

You should understand:

- Basic PostgreSQL SQL syntax (CREATE TABLE, ALTER TABLE)
- PostgreSQL functions (PL/pgSQL language)
- Database constraints (CHECK, EXCLUDE, FOREIGN KEY)
- JSONB data type and GIN indexes
- Row Level Security (RLS) concepts

### Tools Required

- Supabase SQL Editor (web-based) OR
- `psql` command-line client OR
- Database GUI tool (TablePlus, pgAdmin, DBeaver)

### Time Commitment

- **SQL execution**: 15-20 minutes (copy-paste migrations)
- **Verification**: 15-20 minutes (run all checkpoints)
- **Troubleshooting buffer**: 30-40 minutes (if constraints fail)
- **Documentation**: 10 minutes (read and understand what was created)

**Total**: ~90 minutes for complete implementation and verification

## What Happens Next

### Immediate Outcomes

After completing this chunk:

✅ Database has all tables for multi-unit bookings
✅ Pricing function returns accurate calculations for any booking scenario
✅ Discount rules are configured (4 duration-based rules as defaults)
✅ All constraints prevent invalid data states
✅ Indexes are optimized for common queries
✅ RLS policies secure multi-tenant data

### What You Can Do

- ✅ Test pricing calculations via SQL (see checkpoint.md)
- ✅ Verify discount logic with different date ranges
- ✅ Test constraint violations (should fail gracefully)
- ✅ Query all new tables via Supabase dashboard

### What You Cannot Do Yet

- ❌ Create bookings via API (Chunk 004 - API endpoints)
- ❌ Accept guest bookings via frontend (Chunk 006-010 - Guest booking flow)
- ❌ Assign units via admin UI (Chunk 011-014 - Admin interface)

### Next Chunk

**Chunk 002: PostgreSQL Pricing Engine** - Replaces the placeholder pricing function with the complete authoritative pricing calculator including all 4 discount types (duration, date-range, advance-booking, unit-count), weekend rate logic, extra person fees, and best-of discount policy.

**Dependencies for Chunk 002**: Requires `pricing_config`, `discount_rules`, and `guest_booking_unit_requests` tables, plus placeholder `calculate_booking_pricing()` function created in this chunk.

## Key Files Created/Modified

```
database/
├── migrations/
│   └── 021-multi-unit-guest-booking-schema.sql   [NEW - 550 lines]
│       ├── pricing_config table
│       ├── guest_booking_unit_requests table
│       ├── discount_rules table (with 4 default rules)
│       ├── idempotency_keys table
│       ├── bookings table extensions (9 new columns)
│       ├── calculate_booking_pricing() function
│       ├── create_guest_booking() function
│       ├── assign_units_to_booking() function
│       ├── cleanup_expired_idempotency_keys() function
│       ├── cleanup_expired_payment_proofs() function
│       ├── 3 database constraints
│       ├── 11 performance indexes
│       └── RLS policies
│
src/types/
└── database.types.ts   [MODIFIED - will regenerate after migration]
    └── Add types for new tables/columns
```

## Related Documentation

### Source Documentation

- **Primary**: `docs/implementation/guest-booking-multi-unit/01-database-schema.md` (lines 1-706)
  - Complete table definitions with comments
  - Constraint explanations
  - Function implementations
  - Migration order

- **Secondary**: `docs/implementation/guest-booking-multi-unit/09-implementation-decisions.md` (lines 1-485)
  - Array-based model rationale (lines 9-32)
  - Server-side pricing authority (lines 40-63)
  - All-or-nothing assignment decision (lines 65-92)
  - Discount system architecture (lines 94-143)

- **Architecture**: `docs/implementation/guest-booking-multi-unit/CHUNKING-STRATEGY.md` (lines 624-681)
  - Architectural principles applied throughout
  - Dependencies graph
  - Implementation workflow

### Codebase Patterns

- **Database conventions**: `database/CLAUDE.md`
  - Row Level Security patterns
  - Index optimization strategies
  - Migration best practices
  - Connection pooling for Neon PostgreSQL

- **Type safety**: `CLAUDE.md` (Type System section)
  - Generated types from Supabase
  - Strict TypeScript configuration

## Success Criteria

This chunk is complete when:

- [ ] All 4 new tables exist in database
- [ ] `bookings` table has 9 new multi-unit columns
- [ ] All 5 PostgreSQL functions execute without errors
- [ ] `pricing_config` table has exactly 1 row (default configuration)
- [ ] `discount_rules` table has exactly 4 rows (duration discounts)
- [ ] All 3 constraints are active (test via checkpoint.md)
- [ ] All 11 indexes exist and are used in query plans
- [ ] RLS policies are enabled and tested
- [ ] `calculate_booking_pricing()` placeholder returns valid JSONB with version '1.0.0-stub' (full implementation in Chunk 002)
- [ ] `npm run type-check` passes (regenerated database types)
- [ ] All checkpoint tests pass (see `checkpoint.md`)

## Quick Start

Ready to begin? Follow these steps:

1. **Read this README completely** (you are here)
2. **Open `instructions.md`** - Follow step-by-step SQL migration guide
3. **Execute migration** - Copy-paste SQL into Supabase SQL Editor
4. **Run checkpoints** - Verify everything works (`checkpoint.md`)
5. **Troubleshoot if needed** - Common issues and solutions (`troubleshooting.md`)
6. **Commit changes** - `git commit -m "feat: complete chunk 001-database-schema-setup"`
7. **Move to Chunk 002** - PostgreSQL Pricing Engine (requires this chunk)

---

**Ready?** Open `instructions.md` to begin implementation.
