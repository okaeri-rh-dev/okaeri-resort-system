# Database Migrations - Phase 2 Critical Fixes

## Overview
These migrations fix critical misalignments between the database schema and TypeScript implementation discovered during Phase 2 validation.

## Migrations Included

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