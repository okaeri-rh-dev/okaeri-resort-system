# Deployment Guide: Base Occupancy and Extra Person Rate

## Overview

This migration adds support for base/max occupancy pricing with extra person rates to the resort management system.

## Changes Implemented

### Database Schema

- Added `base_occupancy` column to units table
- Added `extra_person_rate` column to units table
- Updated constraints to ensure base_occupancy <= max_occupancy
- Created indexes for performance optimization

### Application Updates

- **TypeScript Types**: Updated Unit interface with new fields
- **Validation**: Added Zod schemas with cross-field validation
- **Pricing Logic**: Simplified calculation using base occupancy + extra person rate
- **UI Components**:
  - Unit management form includes base occupancy and extra person rate fields
  - Booking form shows pricing breakdown with extra person charges
  - Tables display occupancy as "base/max" format

## Deployment Steps

### 1. Database Migration

```bash
# Connect to your database
psql -U your_user -d your_database

# Run the migration
\i database/migrations/004-add-occupancy-pricing.sql

# Verify the migration
SELECT unit_name, base_occupancy, max_occupancy, extra_person_rate
FROM units;
```

### 2. Environment Variables

No new environment variables required.

### 3. Build and Deploy

```bash
# Install dependencies (if any new ones)
npm install

# Build the application
npm run build

# Run tests
npm test

# Deploy to Vercel
vercel --prod
```

## Testing Checklist

### Unit Management

- [ ] Create new unit with base/max occupancy values
- [ ] Edit existing unit occupancy settings
- [ ] Verify base_occupancy <= max_occupancy validation
- [ ] Check extra person rate displays correctly

### Booking Flow

- [ ] Unit selection shows "2/4 guests" format
- [ ] Number of guests field shows extra person info
- [ ] Pricing breakdown displays correctly:
  - Base room rate for included guests
  - Extra person charges when applicable
  - Total calculation is accurate

### Reports & Exports

- [ ] CSV exports include new columns
- [ ] Unit table displays occupancy correctly
- [ ] Mobile views show updated information

## Rollback Instructions

If issues occur, use this rollback script:

```sql
-- Rollback migration 004
ALTER TABLE units
DROP CONSTRAINT IF EXISTS chk_base_occupancy,
DROP CONSTRAINT IF EXISTS chk_extra_person_rate;

ALTER TABLE units
DROP COLUMN IF EXISTS base_occupancy,
DROP COLUMN IF EXISTS extra_person_rate;

DROP INDEX IF EXISTS idx_units_occupancy_pricing;
```

## Business Impact

### Pricing Changes

- Units now charge base rate for guests up to base_occupancy
- Additional guests are charged extra_person_rate per person per night
- Weekend rates remain separate from extra person charges

### Example Pricing

**Unit: Garden View (One Bedroom)**

- Base Occupancy: 2 guests
- Max Occupancy: 4 guests
- Base Rate: ₱3,500/night
- Weekend Rate: ₱4,000/night
- Extra Person: ₱750/night

**Scenario: 3 guests for 2 nights (1 weekday, 1 weekend)**

- Weekday: ₱3,500 + ₱750 = ₱4,250
- Weekend: ₱4,000 + ₱750 = ₱4,750
- Total: ₱9,000

## Known Issues

### TypeScript Compilation

Some existing mock data may need updating to include the new fields:

```typescript
// Add to any Unit mock objects
base_occupancy: 2,
extra_person_rate: 500
```

## Support

For issues during deployment, check:

1. Database migration logs
2. TypeScript compilation errors
3. Browser console for runtime errors

## Version

- Migration Version: 004
- Date: 2025-01-23
- Compatible with: Okaeri Resort System v1.0.0+
