# Database Migrations - Legacy Reference

## ⚠️ MIGRATION WORKFLOW UPDATE (Nov 4, 2025)

**All new migrations should use the Supabase CLI workflow:**

```bash
# Create a new migration
supabase migration new <descriptive_name>

# Apply all pending migrations
supabase db reset

# Or push to remote
supabase db push
```

**Migration files are now stored in:** `supabase/migrations/` with timestamp prefixes (e.g., `20251104184719_migration_name.sql`)

This directory (`database/migrations/`) contains legacy migrations that have been integrated into the Supabase workflow or are kept for reference.

---

## Overview
These migrations fix critical misalignments between the database schema and TypeScript implementation discovered during Phase 2 validation.

## Migrations Included

### 021-multi-unit-guest-booking-schema.sql ✅
**Status**: Integrated into Supabase CLI workflow as `20251104184719_multi_unit_guest_booking_schema.sql`
**Applied**: Nov 4, 2025 (Local database)

**Purpose**: Multi-unit guest booking system with pricing engine
- Creates `pricing_config` singleton table (₱3,000 base, ₱3,500 weekend rates)
- Creates `guest_booking_unit_requests` table for multi-unit booking requests
- Creates `discount_rules` table with 4 default duration discounts (5%, 10%, 15%, 20%)
- Creates `idempotency_keys` table for duplicate prevention
- Extends `bookings` table with 9 new columns (multi-unit support, discount tracking)
- Adds PostgreSQL functions:
  - `calculate_booking_pricing()` - Pricing engine with discount evaluation
  - `create_guest_booking()` - Atomic booking creation
  - `assign_units_to_booking()` - All-or-nothing unit assignment
  - `cleanup_expired_idempotency_keys()` - Daily cleanup (cron)
  - `cleanup_expired_payment_proofs()` - Weekly cleanup (cron)
- Enables Row Level Security on all new tables
- Creates 11 performance indexes

**Breaking Changes**: None (additive migration)

---

### 001-fix-payment-status.sql
**Purpose**: Aligns payment status values between database and code
- Changes `Unpaid` → `Pending`
- Changes `Paid` → `Completed`
- Updates constraint and default value

### 002-fix-unit-types.sql
**Purpose**: Updates unit types to match TypeScript definitions
- Changes `Studio` → `Standard`
- Changes `One Bedroom` → `Deluxe`
- Changes `Two Bedroom` → `Suite`
- Keeps `Villa` unchanged

### 003-add-guest-statistics-triggers.sql
**Purpose**: Adds automatic update triggers for guest statistics
- Maintains `total_bookings` count
- Maintains `total_spent` amount
- Updates automatically on booking changes

## How to Apply Migrations

### Option 1: Run All Migrations (Recommended)
```bash
cd database/migrations
psql -U your_username -d okaeri_resort -f run-migrations.sql
```

### Option 2: Run Individual Migrations
```bash
# Run each migration separately
psql -U your_username -d okaeri_resort -f 001-fix-payment-status.sql
psql -U your_username -d okaeri_resort -f 002-fix-unit-types.sql
psql -U your_username -d okaeri_resort -f 003-add-guest-statistics-triggers.sql
```

### Option 3: Using Supabase CLI
```bash
# If using Supabase
supabase db push database/migrations/001-fix-payment-status.sql
supabase db push database/migrations/002-fix-unit-types.sql
supabase db push database/migrations/003-add-guest-statistics-triggers.sql
```

## Pre-Migration Checklist
- [ ] Backup database before running migrations
- [ ] Ensure no active users in the system
- [ ] Review current data for any custom values

## Post-Migration Verification

### 1. Check Payment Statuses
```sql
SELECT payment_status, COUNT(*)
FROM bookings
GROUP BY payment_status;
```
Expected values: `Pending`, `Partial`, `Completed`, `Refunded`

### 2. Check Unit Types
```sql
SELECT unit_type, COUNT(*)
FROM units
GROUP BY unit_type;
```
Expected values: `Standard`, `Deluxe`, `Suite`, `Villa`

### 3. Verify Guest Statistics Trigger
```sql
-- Create a test booking and check if guest stats update
INSERT INTO bookings (guest_id, ...) VALUES (...);
SELECT total_bookings, total_spent FROM guests WHERE guest_id = '...';
```

## Rollback Scripts
If you need to rollback these migrations, use the scripts in the `rollback/` directory:
- `rollback-001-payment-status.sql`
- `rollback-002-unit-types.sql`
- `rollback-003-guest-triggers.sql`

## Impact on Application
After running these migrations:
1. The application will work correctly with TypeScript type definitions
2. New bookings will use `Pending` status instead of `Unpaid`
3. Payment completion will use `Completed` instead of `Paid`
4. Unit creation will accept new type values
5. Guest statistics will update automatically

## Support
For issues or questions about these migrations, please refer to:
- Phase 2 Business Logic Validation Report
- Technical documentation in `/docs`