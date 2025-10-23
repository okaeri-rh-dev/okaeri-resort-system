# 05: Simplified Pricing Engine (REMOVED)

## Status: Deprecated

This document was removed from the implementation plan.

## Reason for Removal

The original plan included a client-side TypeScript pricing engine for preview calculations. This approach was replaced with a **server-side only** pricing strategy to ensure consistency and eliminate synchronization issues.

## Current Implementation

All pricing calculations are performed by the **PostgreSQL `calculate_booking_pricing()` function**, which serves as the single source of truth.

**For pricing implementation details, see:**

- **Database Function**: `01-database-schema.md` (lines 135-328)
- **API Endpoint**: `02-api-specification.md` - POST `/api/guest-booking/preview-pricing`
- **Frontend Display**: `03-frontend-components.md` - `PaymentSummary` component

## Architecture Decision

This decision is documented in:

- **ADR**: `10-architecture-decisions-record.md` - ADR-005: Simplified Pricing
- **Implementation Decisions**: `09-implementation-decisions.md` - "Pricing Authority: Server-Side Only"

## Migration Note

If you're looking for pricing logic:

1. ✅ **Use**: PostgreSQL function in database migrations
2. ✅ **Call**: API endpoint `/api/guest-booking/preview-pricing` for real-time previews
3. ❌ **Don't**: Create client-side pricing calculations
