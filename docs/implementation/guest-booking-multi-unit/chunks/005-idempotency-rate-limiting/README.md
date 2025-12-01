# Chunk 005: Idempotency and Rate Limiting

## At a Glance

| Property | Value |
|----------|-------|
| **Estimated Time** | 90 minutes |
| **Milestone** | Duplicate Prevention & Bot Protection Complete |
| **Prerequisites** | ✅ Chunk 001 (idempotency_keys table exists)<br>✅ Chunk 004 (API endpoints operational)<br>✅ Cloudflare account with Workers access |
| **Can Skip?** | ❌ No - Critical for production reliability |
| **Phase** | Phase 1: Database & Backend Core (5 of 5) |

## What You're Building

This chunk implements the critical **duplicate prevention** and **abuse protection** mechanisms for the multi-unit guest booking system:

### 1. Idempotency System
- **Client-Generated UUIDs**: Frontend generates unique keys for each booking attempt
- **Duplicate Detection**: Server checks idempotency keys before creating bookings
- **48-Hour Expiry Window**: Keys expire after 48 hours, cleaned daily
- **Retry Safety**: Network failures can safely retry without creating duplicates

### 2. Bot Protection
- **Cloudflare Turnstile**: CAPTCHA challenge on booking submission
- **Token Verification**: Server validates Turnstile tokens before processing
- **Free Tier**: Unlimited requests on Cloudflare's free tier

### 3. Rate Limiting
- **IP-Based Limiting**: 5 requests per hour per IP address
- **Cloudflare KV Storage**: Fast, distributed rate limit tracking
- **Abuse Prevention**: Blocks automated booking attempts

### 4. Automated Cleanup
- **Daily Cron (2 AM UTC)**: Delete expired idempotency keys (>48 hours old)
- **Weekly Cron (Sunday 3 AM UTC)**: Delete expired payment proofs (90 days post-checkout)
- **Free Tier Compliance**: Uses 2 of 3 available cron triggers

## Why This Matters

### Business Impact
- **Prevents Double-Bookings**: Guests can't accidentally submit the same booking twice
- **Reduces Support Load**: No duplicate payment confusion or refund requests
- **Professional Image**: Handles network issues gracefully without creating chaos
- **Protects Revenue**: Prevents automated scrapers from blocking real guests

### Technical Benefits
- **Free Tier Compliance**: Automated cleanup keeps KV storage within limits
- **Network Resilience**: Safe retries on connection failures
- **Security Hardening**: Multiple layers of abuse protection
- **Operational Efficiency**: No manual cleanup required

### Real-World Scenarios Prevented

**Scenario 1: Double-Click Submission**
- Guest clicks "Submit Booking" button twice rapidly
- Without idempotency: 2 identical bookings created, 2 payments required
- With idempotency: Second click returns existing booking, no duplicate

**Scenario 2: Network Retry**
- Guest submits booking, network times out before response
- Browser retries request automatically
- Without idempotency: Duplicate booking created
- With idempotency: Retry returns original booking

**Scenario 3: Bot Attack**
- Automated script attempts 1000 bookings per hour
- Without rate limiting: Database overwhelmed, real guests blocked
- With rate limiting: Bot blocked at 5 requests, real guests unaffected

## Before You Start

### Prerequisites Checklist

**Database (from Chunk 001):**
- [ ] `idempotency_keys` table exists with TTL index
- [ ] Table has columns: `key`, `booking_id`, `created_at`, `expires_at`
- [ ] Index on `expires_at` for cleanup performance

**API (from Chunk 004):**
- [ ] `POST /api/guest-booking` endpoint deployed
- [ ] `create_guest_booking()` PostgreSQL function includes idempotency checking (implemented in Chunk 001)
- [ ] Cloudflare Workers operational

**Cloudflare Account:**
- [ ] Cloudflare account with Workers enabled (free tier OK)
- [ ] Turnstile enabled in Cloudflare dashboard
- [ ] KV namespace creation permissions
- [ ] Cron trigger access (free tier: 3 triggers/day, we'll use 2)

**Environment Variables:**
- [ ] `SUPABASE_URL` set in wrangler secrets
- [ ] `SUPABASE_SERVICE_KEY` set in wrangler secrets
- [ ] Ready to add `TURNSTILE_SECRET_KEY`

### Verify Prerequisites

```bash
# Check database table exists
psql $DATABASE_URL -c "\d idempotency_keys"
# Expected: Table definition with key, booking_id, created_at, expires_at columns

# Check API endpoint responds
curl -I https://your-domain.com/api/guest-booking
# Expected: 405 Method Not Allowed (OPTIONS required, POST available)

# Check Cloudflare Workers deployed
wrangler deployments list
# Expected: Recent deployment listed
```

## What Happens Next

After completing this chunk successfully:

### Immediate Outcomes
- ✅ **Duplicate bookings impossible** - Idempotency prevents accidental double-submissions
- ✅ **Bot protection active** - Turnstile blocks automated booking attempts
- ✅ **Rate limits enforced** - 5 requests/hour prevents abuse
- ✅ **Automated cleanup running** - Daily/weekly cron jobs maintain free tier compliance
- ✅ **Phase 1 complete** - All backend infrastructure ready for guest-facing UI

### Next Steps
- **Ready for Chunk 006**: Date and Unit Selection UI (Phase 2 begins)
- **Guest booking flow** can now be built on secure, reliable backend
- **Admin interface** (Phase 3) will inherit all security protections

### System State After Completion
```
Phase 1: Database & Backend Core ✅ COMPLETE
├── 001: Database schema ✅
├── 002: PostgreSQL pricing engine ✅
├── 003: Security, RLS, constraints ✅
├── 004: Core API endpoints ✅
└── 005: Idempotency & rate limiting ✅ (YOU ARE HERE)

Phase 2: Guest Booking Flow (Next)
└── 006: Date and Unit Selection UI (STARTS HERE)
```

## Key Files Created/Modified

```
okaeri-resort/
├── functions/
│   ├── lib/                                # NEW SECTION
│   │   ├── verify-turnstile.ts            # NEW - Turnstile verification
│   │   └── check-rate-limit.ts            # NEW - Rate limiting logic
│   ├── scheduled/
│   │   ├── cleanup-idempotency.ts          # NEW - Daily cron (2 AM UTC)
│   │   └── cleanup-payment-proofs.ts       # NEW - Weekly cron (Sun 3 AM UTC)
│   ├── api/
│   │   └── guest-booking/
│   │       └── index.ts                    # MODIFIED - Add Turnstile + rate limiting
│   └── _worker.ts                          # MODIFIED - Add cron schedule handler
├── wrangler.toml                           # MODIFIED - Add cron triggers
└── src/
    └── lib/
        └── api/
            └── guest-booking-client.ts     # MODIFIED - Add UUID generation
```

### File Purposes

**`verify-turnstile.ts`** (NEW):
- Turnstile token verification helper
- Calls Cloudflare's siteverify API
- Returns success/failure with error messages
- IP address validation support

**`check-rate-limit.ts`** (NEW):
- KV-based rate limiting logic
- Hourly bucket calculation
- TTL-based automatic expiry
- Fail-open on KV errors (allows request if rate limit check fails)

**`cleanup-idempotency.ts`** (NEW):
- PostgreSQL function call to delete expired keys
- Runs daily at 2:00 AM UTC
- Retry logic with exponential backoff
- Alert logging for unusual cleanup volumes

**`cleanup-payment-proofs.ts`** (NEW):
- PostgreSQL function call to delete old payment proofs
- Runs weekly Sunday at 3:00 AM UTC
- 90-day retention for completed bookings
- 30-day retention for cancelled bookings

**`guest-booking/index.ts`** (MODIFIED):
- Add Turnstile token validation
- Add rate limiting check via KV
- Idempotency key handling (already in PostgreSQL function)

**`_worker.ts`** (MODIFIED):
- Add cron event handler
- Route cron schedules to correct cleanup functions

**`wrangler.toml`** (MODIFIED):
- Add cron trigger configuration
- Bind KV namespace for rate limiting

## Related Documentation

### Source Documentation
- **CHUNKING-STRATEGY.md lines 172-201**: Chunk 005 specification and scope
- **README.md lines 165-175**: Idempotency architectural overview
- **06-migration-guide.md lines 936-1315**: Complete cron worker implementation patterns
- **02-api-specification.md**: Rate limiting and Turnstile integration details
- **09-implementation-decisions.md lines 226-259**: Idempotency design decisions

### Architectural Decisions
- **Client-Generated UUIDs**: ADR-004 (why client, not server)
- **48-Hour Expiry**: Balances retry window with storage costs
- **Daily Cleanup**: Chosen over TTL for explicit control
- **Best-Of 3 Cron Triggers**: 2/3 free tier limit used (1 reserved for future)

### Integration Points
- **Chunk 001**: Uses `idempotency_keys` table created in database schema
- **Chunk 004**: Extends guest-booking API endpoint with security layers
- **Chunk 006** (next): Frontend will generate and pass idempotency keys

## Implementation Notes

### Idempotency Flow

```
Client Request
    ↓
1. Generate UUID (crypto.randomUUID())
    ↓
2. Pass in request header: "Idempotency-Key: <uuid>"
    ↓
3. API receives request
    ↓
4. Check Turnstile token (NEW in this chunk)
    ↓
5. Check rate limit (NEW in this chunk)
    ↓
6. PostgreSQL function checks idempotency key (from Chunk 001)
    ↓
7a. Key exists? → Return existing booking
7b. Key new? → Create booking + store key
    ↓
8. Return response to client
```

### Rate Limiting Strategy

**Key Format**: `ratelimit:${ip}:${hourBucket}`

```typescript
// Example: IP 192.168.1.1 at 2025-01-15 14:35:22 UTC
const hourBucket = Math.floor(Date.now() / 3600000); // 498765
const key = `ratelimit:192.168.1.1:498765`;

// KV stores count: 1, 2, 3, 4, 5
// 6th request within same hour → blocked
```

**Automatic Expiry**: Keys expire after 1 hour (set TTL on KV write)

### Cron Schedule Mapping

| Schedule | Function | Purpose | Frequency |
|----------|----------|---------|-----------|
| `0 2 * * *` | `cleanupIdempotency()` | Delete keys >48h old | Daily 2 AM UTC |
| `0 3 * * 0` | `cleanupPaymentProofs()` | Delete expired proofs | Weekly Sun 3 AM UTC |

**Why These Times?**
- **2 AM UTC**: Low traffic time for most timezones
- **Sunday 3 AM UTC**: Weekend cleanup for weekly tasks
- **1-hour gap**: Prevents overlapping executions

## Security Considerations

### Turnstile Token Security
- **Secret key never exposed**: Only stored in Cloudflare Workers secrets
- **One-time use**: Tokens validated then discarded
- **Expiry**: Tokens expire after 5 minutes
- **Challenge variety**: Cloudflare rotates challenge types automatically

### Rate Limiting Bypass Prevention
- **IP-based**: Uses `CF-Connecting-IP` header (Cloudflare-provided, not spoofable)
- **No user bypass**: Cannot reset limit by logging in/out
- **Distributed storage**: KV replicates globally, all workers see same counts

### Idempotency Key Security
- **UUID v4**: Cryptographically random, not guessable
- **Client-generated**: Reduces server state, improves performance
- **TTL-based expiry**: Automatic cleanup prevents indefinite storage

## Performance Impact

### Expected Metrics
- **Idempotency check**: +2-5ms per booking request (database lookup)
- **Turnstile verification**: +50-100ms per request (external API call)
- **Rate limit check**: +1-3ms per request (KV lookup)
- **Total overhead**: ~60-110ms per booking submission

**Acceptable?** Yes - Guest booking submission is not latency-sensitive (guests expect 1-2s processing time)

### Free Tier Usage
- **KV Reads**: ~200/day (100 bookings × 2 checks)
- **KV Writes**: ~100/day (100 bookings)
- **Cron Executions**: 2/day (daily + weekly/7)
- **Workers Requests**: Same as before (no increase)

**Well within free tier limits** (100k reads, 1k writes, 3 crons/day)

## Common Questions

**Q: Why 48-hour expiry instead of 24 hours?**
A: Accommodates guests who start booking process on Day 1, get interrupted, return Day 2. Prevents frustration from "booking lost" scenarios.

**Q: Why daily cleanup instead of database TTL?**
A: Explicit control over cleanup timing, easier monitoring, ability to add custom cleanup logic (e.g., archiving before deletion).

**Q: Can guests bypass rate limiting with VPN?**
A: Yes, but that's acceptable - rate limit is per-IP, so changing IP resets count. This protects against accidental retries and basic bots, not determined attackers. Turnstile catches sophisticated bots.

**Q: What if cron fails to run?**
A: Keys continue expiring naturally (expires_at column), old proofs remain harmless. Next cron run catches up. Alert sent to admin for investigation.

**Q: Why not Redis for rate limiting?**
A: Cloudflare KV is free, globally distributed, and sufficient for our scale (< 1000 bookings/day). Redis adds cost and complexity.

---

**Ready to implement?** Proceed to `instructions.md` for step-by-step implementation guide.
