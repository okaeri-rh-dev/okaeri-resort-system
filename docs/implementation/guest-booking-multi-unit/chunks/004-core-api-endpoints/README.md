# Chunk 004: Core API Endpoints

## At a Glance

| Property | Value |
|----------|-------|
| **Chunk Number** | 004 |
| **Chunk Name** | core-api-endpoints |
| **Phase** | Phase 1: Database & Backend Core |
| **Estimated Time** | 120 minutes |
| **Milestone** | Public-facing and preview API for multi-unit guest booking |
| **Can Skip?** | ❌ No - Required for all frontend chunks (006-010) |
| **Prerequisites** | Chunks 001 (database schema) and 002 (pricing function) completed |

## What You're Building

This chunk implements **4 Cloudflare Workers API endpoints** that power the multi-unit guest booking system. These endpoints form the bridge between the frontend UI and the PostgreSQL database.

### New API Endpoints (4)

1. **POST `/api/guest-booking`** - Main booking creation endpoint
   - Validates Turnstile CAPTCHA token
   - Checks idempotency (prevents duplicates)
   - Validates guest capacity against `pricing_config.max_capacity_per_unit`
   - Calls PostgreSQL `calculate_booking_pricing()` function (AUTHORITATIVE)
   - Sanitizes user inputs with DOMPurify
   - Creates booking atomically via `create_guest_booking()` function
   - Returns booking reference and pricing breakdown
   - **No email notifications** (manual contact workflow)

2. **GET `/api/guest-booking/rates`** - Static rates display
   - Returns current rates from `pricing_config` table
   - Shows base rate, weekend rate, extra person fee
   - Displays max capacity per unit
   - Cached for 1 hour (public CDN caching)
   - Used by frontend to display rate card

3. **GET `/api/guest-booking/discount-rules`** - Active discounts
   - Returns only active discount rules (`is_active = true`)
   - Sorted by priority (highest first)
   - Used by frontend to display "Save X% when you book 7+ nights!"
   - Cached for 30 minutes

4. **POST `/api/guest-booking/preview-pricing`** - Real-time pricing preview
   - Calls PostgreSQL `calculate_booking_pricing()` function
   - Returns pricing breakdown as user selects dates/units
   - **NOT a separate calculator** - wraps authoritative PostgreSQL function
   - Debounced client-side (500ms) for UX
   - No caching (real-time calculations)

### Security & Performance Features

**Security Implemented:**
- ✅ Turnstile CAPTCHA verification (all POST endpoints)
- ✅ Rate limiting via Cloudflare KV (per IP address)
- ✅ DOMPurify sanitization for text inputs
- ✅ Zod schema validation
- ✅ Idempotency key checking (48-hour window)
- ✅ CORS headers with configurable origins

**Performance Optimizations:**
- ✅ `pricing_config` cached in memory (1-hour expiry)
- ✅ CDN caching for GET endpoints (rates: 1 hour, discounts: 30 min)
- ✅ Idempotency keys indexed for fast lookups
- ✅ Connection pooling for Neon PostgreSQL (via Supabase)

## Why This Matters

### Business Value

- **Prevents revenue loss** - Turnstile and rate limiting block bot spam
- **Reduces support burden** - Idempotency prevents accidental duplicate bookings
- **Enables price transparency** - Guest sees accurate pricing before booking
- **Supports compliance** - Immutable pricing snapshots for historical accuracy
- **Flexible discounts** - Admin can activate new discount rules without code changes

### Technical Value

- **Single source of truth** - All pricing from PostgreSQL (no client/server sync issues)
- **Atomic operations** - `create_guest_booking()` function prevents orphaned records
- **Edge computing** - Cloudflare Workers run at the edge (low latency globally)
- **Scalable architecture** - Stateless endpoints scale horizontally
- **Type-safe** - Zod validation ensures request/response contracts

### Architectural Principles Enforced

This chunk implements the **core API decisions** from `09-implementation-decisions.md`:

✅ **Array-based model** - API accepts `unit_requests` array (each element = 1 unit)
✅ **Server-side pricing authority** - PostgreSQL function is SOLE calculator
✅ **Centralized configuration** - Fetches from `pricing_config` singleton table
✅ **Security-first** - Turnstile, rate limiting, sanitization, idempotency
✅ **Manual contact workflow** - No email automation (admin contacts via phone/SMS)

## Before You Start

### Prerequisites Checklist

Verify you have completed:

- [ ] **Chunk 001** - Database schema created (pricing_config, guest_booking_unit_requests, etc.)
- [ ] **Chunk 002** - PostgreSQL `calculate_booking_pricing()` function implemented
- [ ] Supabase project URL and service key in environment variables
- [ ] Cloudflare Workers account setup (free tier is sufficient)
- [ ] Cloudflare Turnstile site key and secret key obtained
- [ ] Cloudflare KV namespace created for rate limiting
- [ ] You have read `docs/implementation/guest-booking-multi-unit/02-api-specification.md` (lines 1-2076)
- [ ] You have read `docs/implementation/guest-booking-multi-unit/CHUNKING-STRATEGY.md` (lines 141-169)

### Knowledge Requirements

You should understand:

- TypeScript/JavaScript syntax
- Cloudflare Workers request/response cycle
- RESTful API design patterns
- Zod schema validation
- PostgreSQL RPC calls via Supabase client
- CORS headers and preflight requests
- Rate limiting strategies
- Idempotency patterns

### Tools Required

- Code editor (VS Code recommended)
- Terminal access
- curl or Postman for API testing
- Supabase dashboard access
- Cloudflare dashboard access

### Time Commitment

- **API implementation**: 60 minutes (create 4 endpoint files)
- **Environment setup**: 15 minutes (env vars, KV namespace)
- **Testing**: 30 minutes (curl tests, verification)
- **Troubleshooting buffer**: 15 minutes (debug errors)

**Total**: ~120 minutes for complete implementation and verification

## What Happens Next

### Immediate Outcomes

After completing this chunk:

✅ POST `/api/guest-booking` creates multi-unit bookings
✅ GET `/api/guest-booking/rates` displays current pricing
✅ GET `/api/guest-booking/discount-rules` shows active discounts
✅ POST `/api/guest-booking/preview-pricing` calculates pricing in real-time
✅ Idempotency prevents duplicate bookings
✅ Turnstile blocks bot submissions
✅ Rate limiting enforces request limits

### What You Can Do

- ✅ Test booking creation via curl/Postman
- ✅ Verify pricing calculations match PostgreSQL function
- ✅ Test idempotency by submitting duplicate requests
- ✅ Verify Turnstile token validation
- ✅ Test rate limiting enforcement

### What You Cannot Do Yet

- ❌ Submit bookings via frontend UI (Chunk 006-010 - Guest booking flow)
- ❌ Assign units via admin interface (Chunk 011-014 - Admin interface)
- ❌ Upload payment proofs (Chunk 008 - Payment proof upload)
- ❌ View booking status page (Chunk 010 - Booking confirmation flow)

### Next Chunk

**Chunk 005: Idempotency and Rate Limiting** - Implements advanced rate limiting, Turnstile integration, cleanup cron jobs, and retry logic.

**Dependencies for Chunk 005**: Requires API endpoints created in this chunk to add idempotency and rate limiting middleware.

**Alternative Path**: You could skip to **Chunk 006: Date and Unit Selection UI** to start building the frontend (requires these API endpoints to be functional).

## Key Files Created/Modified

```
functions/
├── api/
│   ├── guest-booking.ts                      [NEW - 380 lines]
│   │   └── POST /api/guest-booking
│   └── guest-booking/
│       ├── rates.ts                          [NEW - 85 lines]
│       │   └── GET /api/guest-booking/rates
│       ├── discount-rules.ts                 [NEW - 75 lines]
│       │   └── GET /api/guest-booking/discount-rules
│       └── preview-pricing.ts                [NEW - 125 lines]
│           └── POST /api/guest-booking/preview-pricing
│
src/
├── lib/
│   ├── rate-limit.ts                         [NEW - 90 lines]
│   │   └── checkKVRateLimit() utility
│   └── turnstile.ts                          [NEW - 60 lines]
│       └── verifyTurnstile() helper
│
└── types/
    └── guest-booking-multi-unit.ts           [NEW - 120 lines]
        ├── multiUnitBookingSchema (Zod)
        ├── MultiUnitBookingRequest type
        ├── MultiUnitBookingResponse type
        └── DiscountRule type

wrangler.toml                                 [MODIFIED - add KV bindings]
.env.local                                    [MODIFIED - add Turnstile keys]
```

## Related Documentation

### Source Documentation

- **Primary**: `docs/implementation/guest-booking-multi-unit/02-api-specification.md` (lines 1-2076)
  - Complete endpoint specifications
  - Request/response contracts
  - Error handling patterns
  - Rate limiting configuration
  - Turnstile integration details

- **Secondary**: `docs/implementation/guest-booking-multi-unit/09-implementation-decisions.md` (lines 226-259)
  - Idempotency decision (client-supplied UUIDs, lines 226-259)
  - Concurrency control (PostgreSQL EXCLUDE constraint, lines 261-290)
  - File upload strategy (signed URLs, lines 292-317)

- **Architecture**: `docs/implementation/guest-booking-multi-unit/CHUNKING-STRATEGY.md` (lines 141-169)
  - Chunk 004 scope and dependencies
  - Server-side pricing authority principle
  - API implementation checklist

### Codebase Patterns

- **API conventions**: `CLAUDE.md` (Serverless Functions Architecture section)
  - Cloudflare Workers patterns
  - CORS middleware setup
  - Environment variable handling

- **Security patterns**: `docs/implementation/guest-booking-multi-unit/02-api-specification.md` (lines 886-1006)
  - Rate limiting implementation
  - Turnstile verification
  - Input sanitization

- **Type safety**: `CLAUDE.md` (Type System section)
  - Zod schema patterns
  - TypeScript strict mode

## Success Criteria

This chunk is complete when:

- [ ] All 4 API endpoints exist in `functions/api/guest-booking/` directory
- [ ] POST `/api/guest-booking` creates booking with correct pricing
- [ ] GET `/api/guest-booking/rates` returns pricing configuration
- [ ] GET `/api/guest-booking/discount-rules` returns active discounts
- [ ] POST `/api/guest-booking/preview-pricing` calculates pricing accurately
- [ ] Idempotency prevents duplicate submissions (same UUID returns existing booking)
- [ ] Turnstile token verification blocks invalid tokens
- [ ] Rate limiting enforces per-IP limits (429 status after threshold)
- [ ] All endpoints return consistent error responses (with error_code)
- [ ] CORS headers allow frontend origin
- [ ] `npm run type-check` passes (no TypeScript errors)
- [ ] All checkpoint tests pass (see `checkpoint.md`)

## Quick Start

Ready to begin? Follow these steps:

1. **Read this README completely** (you are here)
2. **Open `instructions.md`** - Follow step-by-step implementation guide
3. **Create API endpoints** - Copy TypeScript code for 4 endpoints
4. **Setup environment** - Configure Turnstile keys and KV namespace
5. **Test endpoints** - Use curl/Postman to verify functionality
6. **Run checkpoints** - Verify all success criteria (`checkpoint.md`)
7. **Troubleshoot if needed** - Common issues and solutions (`troubleshooting.md`)
8. **Commit changes** - `git commit -m "feat: complete chunk 004-core-api-endpoints"`
9. **Move to Chunk 005** - Idempotency and Rate Limiting (or Chunk 006 for frontend)

---

**Ready?** Open `instructions.md` to begin implementation.
