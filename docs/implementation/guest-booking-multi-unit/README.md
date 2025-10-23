# Multi-Unit Guest Booking System

## Executive Summary

Comprehensive implementation plan for the Okaeri Resort System's multi-unit guest booking feature. Allows unauthenticated guests to request multiple units in a single transaction with administrative unit assignment.

**Core Design**: Guests select NUMBER of units only (no unit types shown). Admin assigns specific units post-booking based on availability and business logic.

## Documentation Structure

| Document | Purpose |
|----------|---------|
| [00-IMPORTANT-CLARIFICATION.md](./00-IMPORTANT-CLARIFICATION.md) | **START HERE** - Critical architectural clarifications |
| [01-database-schema.md](./01-database-schema.md) | Complete database design with PostgreSQL functions |
| [02-api-specification.md](./02-api-specification.md) | API contracts including preview endpoint |
| [03-frontend-components.md](./03-frontend-components.md) | React components with array-based model |
| [04-admin-interface.md](./04-admin-interface.md) | Admin workflow for unit assignment |
| [05-simplified-pricing-engine.md](./05-simplified-pricing-engine.md) | **DEPRECATED** - See 01-database-schema.md (PostgreSQL function) |
| [06-migration-guide.md](./06-migration-guide.md) | Complete migration and deployment guide |
| [07-testing-strategy.md](./07-testing-strategy.md) | Comprehensive testing approach |
| [08-implementation-priorities.md](./08-implementation-priorities.md) | Phased implementation roadmap |
| [09-implementation-decisions.md](./09-implementation-decisions.md) | Definitive architectural decisions |
| [10-architecture-decisions-record.md](./10-architecture-decisions-record.md) | ADR with context and alternatives |

## Business Requirements

### Problem Statement

- **Single Unit Only**: Guests create separate bookings for multiple units
- **Multiple Payments**: Each booking requires separate payment proof
- **Poor Group Experience**: Coordination overhead for families/groups
- **Lost Revenue**: Group bookings abandoned due to complexity

### Solution

- ✅ **Unified Booking**: Single transaction for multiple units
- ✅ **Simplified Selection**: Choose quantity and guests per unit only
- ✅ **Single Payment**: One payment proof for entire booking
- ✅ **Admin Flexibility**: Manager assigns specific units after booking
- ✅ **Flexible Discounts**: Duration-based, date-range, advance-booking

### User Journey

```
Guest Visits Site → Selects Dates → Specifies Units & Guests per Unit →
Enters Contact Info → Reviews Payment Summary → Uploads Payment Proof →
Receives Booking Confirmation → Admin Assigns Units → Guest Receives Confirmation
```

**Contact Method**: All guest notifications handled **manually via phone/SMS** (no email automation).

## Core Architecture Decisions

### Array-Based Data Model

Each `guest_booking_unit_requests` row = 1 unit. **NO `quantity` column.**

```typescript
interface GuestUnitRequest {
  guests_per_unit: number;  // Guests in this unit
  // NO quantity field
  // NO unit_type field
}

// Example: 3 units
unit_requests: [
  { guests_per_unit: 2 },  // Unit 1
  { guests_per_unit: 3 },  // Unit 2
  { guests_per_unit: 2 },  // Unit 3
]

// Total units = array.length = 3
// Total guests = 2 + 3 + 2 = 7
```

### Server-Side Pricing Authority

**PostgreSQL `calculate_booking_pricing()` function is the SOLE pricing calculator.**

- **Single source of truth**: All pricing/capacity configuration in `pricing_config` table
- **Server-side ONLY**: PostgreSQL function fetches from `pricing_config` for all calculations
- **No client-side pricing**: Frontend displays static rates only via `/api/guest-booking/rates`
- **Centralized updates**: Admin changes pricing in one place, affects everything immediately

**Configuration**: Single row in `pricing_config` table controls all pricing and capacity settings.

### All-or-Nothing Assignment

Admin must assign ALL requested units or NONE. Only 2 statuses: `pending` → `assigned`.

```sql
ALTER TABLE bookings
ADD CONSTRAINT all_or_nothing_assignment CHECK (
    unit_assignment_status != 'assigned' OR (
        (SELECT COUNT(*) FROM booking_units WHERE booking_id = bookings.booking_id AND status = 'confirmed') =
        (SELECT COUNT(*) FROM guest_booking_unit_requests WHERE booking_id = bookings.booking_id)
    )
);
```

### Flexible Discount System

JSONB conditions supporting duration, date-range, advance-booking, and unit-count discounts.

```typescript
// Duration discount
{
  conditions: [{"type": "min_nights", "value": 7}],
  discount_value: 5.00,  // 5%
  discount_type: "percentage"
}

// Date range discount
{
  conditions: [{"type": "date_range", "value": ["2025-12-20", "2026-01-05"]}],
  discount_value: 10.00,
  discount_type: "percentage"
}

// Unit count discount (engine supports, not configured in Phase 1)
{
  conditions: [{"type": "unit_count", "value": 5}],
  discount_value: 8.00,
  discount_type: "percentage"
}
```

**Discount Engine**: Supports all discount types (duration, date-range, advance-booking, unit-count). **Phase 1 Configuration**: Only duration-based discounts pre-configured. Additional discount types can be added post-launch via database inserts without code changes.

**Best-of policy**: Single highest discount applies (no stacking).

### Capacity Validation

Validate `guests_per_unit` against centralized configuration. **Do NOT validate unit availability (booking status).**

**What we DO validate:**
- ✅ `guests_per_unit` ≤ `pricing_config.max_capacity_per_unit` (physical capacity)
- ✅ Total requested units ≤ COUNT(units) in system
- ✅ Check-in/check-out date validity

**What we DON'T validate:**
- ❌ Unit availability (whether units are already booked)
- ❌ Specific unit assignments

**Key Distinction:**
- **Capacity** = Physical limit (can guests fit?) → **✅ Validate**
- **Availability** = Booking status (is unit booked?) → **❌ Don't validate**

**Reasoning**: Admin handles actual unit assignment and availability. Validation only prevents physically impossible requests.

### Manual Contact Workflow

**NO email automation**. Admin contacts guests manually via phone/SMS.

**Current Workflow:**
1. Guest submits booking
2. Admin sees notification in queue
3. Admin verifies payment manually
4. Admin assigns units
5. Admin calls/texts guest with confirmation

**Note**: Email notification roadmap available at end of this document.

### Idempotency

Client generates UUID with 24-48 hour expiry window via daily cleanup.

```typescript
const idempotencyKey = crypto.randomUUID();  // Client-side

// API checks key before creating booking
const existing = await checkIdempotencyKey(idempotencyKey);
if (existing) return existing;  // Return existing booking
```

### Concurrency Control

PostgreSQL EXCLUDE constraint as primary mechanism.

```sql
CREATE EXTENSION btree_gist;

ALTER TABLE booking_units
ADD CONSTRAINT no_double_booking EXCLUDE USING gist (
    unit_id WITH =,
    daterange(check_in_date, check_out_date, '[]') WITH &&
) WHERE (status != 'cancelled');
```

## Key Database Tables

### pricing_config (Single Source of Truth)

```sql
CREATE TABLE pricing_config (
    id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
    base_rate DECIMAL(10, 2) NOT NULL CHECK (base_rate > 0),
    weekend_rate DECIMAL(10, 2) NOT NULL CHECK (weekend_rate > 0),
    extra_person_rate DECIMAL(10, 2) NOT NULL DEFAULT 500.00,
    base_occupancy INTEGER NOT NULL DEFAULT 2,
    max_capacity_per_unit INTEGER NOT NULL DEFAULT 20,
    downpayment_percent DECIMAL(5, 2) NOT NULL DEFAULT 50.00,
    currency TEXT NOT NULL DEFAULT 'PHP',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose**: Centralized configuration for all pricing and capacity settings. Single row table that controls all system-wide pricing and limits.

### guest_booking_unit_requests (Array-Based)

```sql
CREATE TABLE guest_booking_unit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    guests_per_unit INTEGER NOT NULL CHECK (guests_per_unit > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### discount_rules (Flexible Conditions)

```sql
CREATE TABLE discount_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    conditions JSONB NOT NULL,
    discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed', 'per_night')),
    discount_value DECIMAL(10, 2) NOT NULL,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### idempotency_keys

```sql
CREATE TABLE idempotency_keys (
    key UUID PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);
```

## API Contract

### POST /api/guest-booking

```typescript
interface MultiUnitGuestBookingRequest {
  guest_name: string;
  email: string;
  phone_number: string;
  check_in: string; // ISO datetime
  check_out: string; // ISO datetime
  unit_requests: Array<{
    guests_per_unit: number; // Guests in this unit
    // NO quantity field
  }>;
  special_requests?: string;
  payment_proof_url?: string;
  idempotency_key?: string; // Optional, server generates if missing
  turnstile_token: string;
  terms_accepted: boolean;
}

interface MultiUnitGuestBookingResponse {
  success: boolean;
  booking: {
    booking_id: string;
    booking_reference: string;
    total_amount: number;
    downpayment_amount: number; // Configurable via pricing_config.downpayment_percent (default: 50%)
    discount_applied?: {
      percent: number;
      amount: number;
      rule_name: string;
    };
  };
  unit_requests: Array<{
    guests_per_unit: number;
  }>;
}
```

## Implementation Phases

### Phase 1: Core Functionality (Week 1)

- Database schema (array-based model, NO `quantity` column)
- PostgreSQL functions (AUTHORITATIVE pricing)
- Database constraints (all-or-nothing, payment-before-assignment)
- Security (Turnstile, DOMPurify, JWT, RLS)
- Idempotency system

### Phase 2: Guest Booking Flow (Week 2)

- API endpoints (server-side pricing via PostgreSQL)
- Frontend components (array-based UnitRequestCard, static rate display)
- Form validation (dynamic capacity, NO availability checking)
- Rate limiting (checkKVRateLimit + Turnstile)

### Phase 3: Admin Interface (Week 3)

- Pending bookings queue (urgency scoring, assumes <100 pending bookings)
- Unit assignment interface (all-or-nothing enforcement)
- Payment verification UI
- Manual contact workflow documentation

### Phase 4: Testing & Deployment (Week 4)

- Unit tests (pricing, constraints, idempotency)
- Integration tests (API, database, all-or-nothing)
- E2E tests (complete guest and admin flows)
- Deployment (staging → production)
- Monitoring (queue length, assignment time, idempotency collisions)

## Security & Compliance

### Input Validation

- Zod schema validation
- DOMPurify sanitization
- Turnstile CAPTCHA verification
- JWT claim verification (admin)

### File Security

- Private storage bucket (Supabase)
- Signed URLs (5-minute expiry for upload)
- File type validation (JPEG, PNG, PDF)
- Size limits: Client compresses images to <2MB automatically, Server enforces 5MB hard limit

### Database Security

- Row Level Security policies
- Service role for sensitive operations
- Parameterized queries
- Audit logging

## Performance Optimization

### Database

- Indexes on foreign keys
- GiST index for EXCLUDE constraint
- GIN index for JSONB conditions
- Partial indexes for active bookings

### API

- Supabase connection pooling
- Pricing function consistency (STABLE volatility)
- Signed URL pre-generation
- Rate limiting on public endpoints

### Frontend

- Debounced pricing preview
- Optimistic UI updates
- Component code splitting
- Service worker caching

## Monitoring & Alerts

### Monitoring Stack (Free Tier Compatible)

**Recommended Tools**:
- **Cloudflare Analytics** (Free) - Workers performance, cron execution
- **Supabase Dashboard** (Free) - Database metrics, query performance
- **Grafana Cloud** (Free tier: 14-day retention) - Custom dashboards
- **UptimeRobot** (Free tier: 50 monitors) - Uptime monitoring
- **PagerDuty Free** (Optional) - Alerting

### Key Metrics

#### Business Metrics

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| **Pending Queue Length** | Bookings awaiting assignment | < 5 | > 10 bookings |
| **Average Assignment Time** | Time from booking to unit assignment | < 4 hours | > 24 hours |
| **Payment Verification Time** | Time from upload to verification | < 2 hours | > 48 hours |
| **Booking Conversion Rate** | Completed bookings / total attempts | > 85% | < 70% |
| **Discount Application Rate** | Bookings with discounts applied | Track only | N/A |

#### Technical Metrics

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| **API Response Time (p95)** | 95th percentile response time | < 800ms | > 2000ms |
| **Database Query Time (avg)** | Average query duration | < 100ms | > 500ms |
| **Error Rate** | Failed requests / total requests | < 0.5% | > 2% |
| **Idempotency Collisions** | Duplicate key attempts | < 5/day | > 20/day |
| **Constraint Violations** | Database constraint failures | 0 | > 5/day |
| **Cron Success Rate** | Scheduled job success | 100% | < 95% |

### Monitoring Dashboard Setup

**Grafana Cloud Dashboard** (Free Tier):

```yaml
# dashboard-config.yml
apiVersion: 1
providers:
  - name: 'Okaeri Resort Monitoring'
    orgId: 1
    folder: ''
    type: file
    options:
      path: /var/lib/grafana/dashboards

datasources:
  - name: Supabase
    type: postgres
    url: $SUPABASE_URL
    database: postgres
    user: monitoring_user
    secureJsonData:
      password: $MONITORING_PASSWORD

  - name: Cloudflare Workers
    type: cloudflare-workers
    jsonData:
      accountId: $CLOUDFLARE_ACCOUNT_ID
      apiToken: $CLOUDFLARE_API_TOKEN
```

**Key Panels**:

1. **Booking Queue Panel**
```sql
-- Pending bookings by urgency
SELECT
  COUNT(*) FILTER (WHERE urgency_score >= 80) AS high_urgency,
  COUNT(*) FILTER (WHERE urgency_score BETWEEN 50 AND 79) AS medium_urgency,
  COUNT(*) FILTER (WHERE urgency_score < 50) AS normal_urgency
FROM bookings
WHERE unit_assignment_status = 'pending';
```

2. **Assignment Time Panel**
```sql
-- Average time to assignment (in hours)
SELECT
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) AS avg_hours
FROM bookings
WHERE unit_assignment_status = 'assigned'
  AND DATE(created_at) >= CURRENT_DATE - INTERVAL '7 days';
```

3. **Error Rate Panel**
```sql
-- Error rate over time
SELECT
  DATE_TRUNC('hour', timestamp) AS hour,
  COUNT(*) FILTER (WHERE status_code >= 400) * 100.0 / COUNT(*) AS error_rate
FROM api_logs
GROUP BY hour
ORDER BY hour DESC
LIMIT 24;
```

### Alert Configuration

#### Initial Baseline Thresholds

**Recommendation**: Start with conservative thresholds, then adjust after 2 weeks of operational data.

```yaml
# Initial thresholds (tune after collecting baseline metrics)
thresholds:
  pending_queue:
    warning: 5     # Based on expected admin capacity (~1 assignment every 2 hours)
    critical: 10   # Requires immediate attention

  assignment_time:
    warning: 12h   # 50% above target SLO of 8 hours
    critical: 24h  # 100% above target SLO

  payment_verification:
    warning: 4h    # Early warning for verification delays
    critical: 48h  # Business hours + buffer

  api_error_rate:
    warning: 1%    # 1 error per 100 requests
    critical: 2%   # Indicates systematic issues

  database_cpu:
    warning: 60%   # Resource pressure building
    critical: 80%  # Imminent performance degradation
```

**Tuning Guidelines**:
- Monitor for first 14 days without alerts
- Review p50, p95, p99 metrics for each threshold
- Adjust thresholds to match actual operational patterns
- Set warning at p95, critical at p99 + 20%

#### Critical Alerts (Immediate Action Required)

**1. High Queue Backlog**
```yaml
alert: HighPendingQueue
expr: booking_queue_length > 10
for: 15m
labels:
  severity: critical
annotations:
  summary: "Pending booking queue exceeds threshold"
  description: "{{ $value }} bookings pending for >15 minutes"
  action: "Review admin availability, escalate if needed"
```

**2. Database Constraint Violations**
```yaml
alert: ConstraintViolations
expr: rate(database_constraint_errors[5m]) > 0
labels:
  severity: critical
annotations:
  summary: "Database constraint violations detected"
  description: "Check logs for concurrency or data integrity issues"
  action: "Investigate immediately - potential data corruption"
```

**3. Cron Job Failures**
```yaml
alert: CronFailure
expr: cron_success_rate < 0.95
for: 1h
labels:
  severity: critical
annotations:
  summary: "Scheduled cleanup jobs failing"
  description: "Idempotency or payment proof cleanup not running"
  action: "Check Cloudflare Workers logs, verify wrangler.toml"
```

#### Warning Alerts (Action Within 24 Hours)

**4. Slow Assignment Time**
```yaml
alert: SlowAssignments
expr: avg_assignment_time_hours > 24
for: 2h
labels:
  severity: warning
annotations:
  summary: "Booking assignments taking >24 hours"
  description: "Review admin workload and queue priorities"
```

**5. High API Latency**
```yaml
alert: HighLatency
expr: api_response_time_p95 > 2000
for: 10m
labels:
  severity: warning
annotations:
  summary: "API response time degraded"
  description: "Check database connection pool, query performance"
```

### Notification Channels

**Free Tier Setup**:

1. **Email Notifications** (Free)
   - Grafana Cloud → Email alerts
   - Configure SMTP or use Grafana's email service
   - Send to: admin@okaeriresort.com

2. **SMS Alerts** (Critical Only)
   - Twilio Free Trial: 15 credits
   - Reserve for critical alerts only
   - Configure in Grafana: Twilio integration

3. **Slack/Discord** (Free)
   - Create webhook URL
   - Add to Grafana notification channels
   - Use for all alerts (low cost)

**Example Slack Alert**:
```json
{
  "text": "🚨 CRITICAL: Pending Queue > 10 Bookings",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Alert*: High Pending Queue\n*Value*: 12 bookings\n*Action*: Review admin availability"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "View Queue"
          },
          "url": "https://admin.okaeriresort.com/queue"
        }
      ]
    }
  ]
}
```

### Uptime Monitoring

**UptimeRobot Configuration** (Free Tier):

| Monitor | Type | URL | Interval | Alert |
|---------|------|-----|----------|-------|
| API Health | HTTP(S) | `/api/health` | 5 min | Admin email |
| Guest Booking | HTTP(S) | `/api/guest-booking` (POST) | 15 min | Admin + SMS |
| Admin Dashboard | HTTP(S) | `/admin/bookings` | 5 min | Admin email |
| Database | Custom | Supabase health endpoint | 5 min | Critical alert |

**Health Check Endpoint**:

```typescript
// functions/api/health.ts
export async function onRequest() {
  const checks = {
    database: await checkDatabase(),
    workers: await checkWorkers(),
    storage: await checkStorage(),
  };

  const allHealthy = Object.values(checks).every(c => c.status === 'ok');

  return new Response(
    JSON.stringify({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    }),
    {
      status: allHealthy ? 200 : 503,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
```

### Cost-Free Monitoring Summary

**Free Services Used**:
- ✅ Cloudflare Analytics (included with Workers)
- ✅ Supabase Dashboard (included with database)
- ✅ Grafana Cloud Free (14-day retention, 10k series)
- ✅ UptimeRobot Free (50 monitors, 5-min checks)
- ✅ Email notifications (Grafana included)

**Total Monthly Cost**: $0 (all free tiers)

**Upgrade Triggers**:
- Grafana: If need >14-day retention or >10k series
- UptimeRobot: If need <5-min checks or >50 monitors
- SMS: After Twilio trial credits exhausted (~$5-10/month for essentials)

## Rollback Plan

### Immediate Actions

- Database rollback script available
- API rollback via Cloudflare Workers
- Frontend rollback via Cloudflare Pages
- Preserve existing multi-unit bookings

### Data Handling

- Multi-unit bookings remain in system
- Admin manually processes pending bookings
- No data loss or corruption

## Success Metrics

### Primary KPIs

- Booking conversion rate: Target 15% increase
- Average booking value: Target 40% increase per transaction
- Customer satisfaction: Target NPS > 8

### Secondary KPIs

- Support ticket volume: Target < 5% increase
- Admin processing time: Target < 10 minutes per booking
- Payment success rate: Target > 95%

## Related Documentation

- [Multi-Unit Booking System (Authenticated)](/docs/multi-unit-booking/README.md)
- [Database Schema Documentation](/docs/database/schema.md)
- [API Standards Guide](/docs/api/standards.md)
- [Testing Best Practices](/docs/testing/best-practices.md)

## Glossary

### Core Concepts

- **Array-Based Model**: Each row in `guest_booking_unit_requests` = 1 unit (NO `quantity` column)
- **Unit Request**: One row representing guest count for a single unit (field name: `guests_per_unit`)
- **Unit Selection**: AVOID - use "Unit Request" instead for consistency

### Capacity vs Availability (Critical Distinction)

- **Capacity**: Physical limit - maximum number of guests a unit can accommodate (validated via `pricing_config.max_capacity_per_unit`)
- **Availability**: Booking status - whether a unit is already booked for given dates (NOT validated during booking creation, admin handles during assignment)
- **guests_per_unit**: Database field name for number of guests in one unit request
- **Guest Count**: Business/UI term for number of guests (synonymous with guests_per_unit value)
- **Occupancy**: Can mean base occupancy (included in base rate) OR total guest count - use sparingly to avoid confusion

### Pricing & Discounts

- **Downpayment**: Configurable percentage of total booking (default 50%, stored in `pricing_config.downpayment_percent`)
- **Server-Side Pricing**: PostgreSQL `calculate_booking_pricing()` function is SOLE authoritative calculator
- **Pricing Authority**: Single source of truth = `pricing_config` table + `calculate_booking_pricing()` function
- **Flexible Discounts**: JSONB conditions support duration, date_range, unit_count, advance_booking types
- **Best-Of Policy**: Single highest discount applies (no stacking multiple discounts)

### Assignment & Status

- **Assignment Status**: Only 2 values (`pending`, `assigned`), NO intermediate statuses like `assigning` or `partial`
- **All-or-Nothing**: Admin must assign ALL requested units or NONE (no partial assignments allowed)
- **Pending**: Booking created, awaiting admin unit assignment
- **Assigned**: All units assigned to booking by admin

### Communication & Security

- **Manual Contact**: Admin contacts guests via phone/SMS (no email automation initially)
- **Idempotency**: Client-supplied UUIDs prevent duplicate bookings, 24-hour expiry, retry allowed for failed bookings
- **Concurrency**: PostgreSQL EXCLUDE constraint prevents double-booking at database level (primary mechanism)
- **Rate Limiting**: checkKVRateLimit (5 req/hour) + Turnstile CAPTCHA for public endpoints

### File Handling

- **File Upload**: Client compression targets ~2MB, Server enforces 5MB hard limit
- **Payment Proof**: Receipt image/PDF uploaded to private Supabase storage bucket
- **Retention Policy**: 90 days post-checkout for completed bookings

---

## Future: Email Notifications (Post-Launch)

**Status**: NOT IMPLEMENTED - Manual contact only

**Timeline**: Q2 2025 (tentative)

### Provider Comparison

| Feature | Resend | SendGrid |
|---------|--------|----------|
| **Free Tier** | 100 emails/day | 100 emails/day |
| **Setup Complexity** | Low | Medium |
| **Developer Experience** | Excellent (modern API) | Good (established) |
| **Template System** | React Email | HTML templates |
| **Deliverability** | Excellent | Excellent |
| **Pricing (paid)** | $20/month (50k emails) | $20/month (40k emails) |
| **Philippine Support** | Yes | Yes |
| **Recommendation** | ✅ **Preferred** | Alternative |

**Decision**: Resend for modern DX and React Email templates

### Notification Types

**Guest Notifications**:

1. **Booking Confirmation** (Immediate)
   - Booking reference number
   - Requested units and guest counts
   - Check-in/check-out dates
   - Total amount and downpayment required
   - Payment instructions
   - "Pending assignment" status message

2. **Unit Assignment Notification** (After admin assigns)
   - Assigned unit numbers/names
   - Final confirmation details
   - Check-in instructions
   - Contact information
   - Cancellation policy

3. **Payment Verification** (After admin verifies)
   - Payment confirmed
   - Amount verified
   - Balance due (if applicable)
   - Receipt attached/linked

4. **Pre-Arrival Reminder** (24 hours before check-in)
   - Reminder of booking details
   - Check-in time and location
   - Contact person at resort
   - What to bring checklist

**Admin Notifications**:

1. **New Booking Alert** (Real-time)
   - New booking submitted
   - Urgency score
   - Link to admin panel
   - Mobile-friendly format

2. **Payment Proof Uploaded** (Real-time)
   - Guest uploaded payment proof
   - Link to view/verify
   - Booking reference

3. **Queue Alert** (Daily digest)
   - Pending bookings count
   - Bookings approaching urgency threshold
   - Action required summary

### Template Requirements

**Design Principles**:
- Mobile-first (70% of guests use mobile)
- Philippine localization (PHP currency, GMT+8 timezone)
- Brand colors and logo
- Clear call-to-action buttons
- Plain text fallback for all emails

**React Email Components** (with Resend):

```tsx
// components/emails/BookingConfirmation.tsx
import { Html, Head, Body, Container, Section, Text, Button } from '@react-email/components';

export default function BookingConfirmation({ booking }) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif' }}>
        <Container>
          <Section>
            <Text>Thank you for your booking!</Text>
            <Text>Reference: {booking.reference}</Text>
            <Text>Units requested: {booking.unit_count}</Text>
            <Text>Check-in: {formatDate(booking.check_in)}</Text>
            <Button href={`${baseUrl}/booking/${booking.reference}`}>
              View Booking Status
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

### Implementation Phases

**Phase 1: Guest Confirmations** (Week 1)
- [ ] Resend account setup
- [ ] Email templates created
- [ ] Booking confirmation email
- [ ] Unit assignment notification
- [ ] Test with staging bookings

**Phase 2: Admin Alerts** (Week 2)
- [ ] Real-time new booking alerts
- [ ] Payment proof notifications
- [ ] Admin dashboard integration
- [ ] SMS fallback (Twilio) for urgent alerts

**Phase 3: Pre-Arrival & Reminders** (Week 3)
- [ ] 24-hour reminder cron job
- [ ] Pre-arrival checklist email
- [ ] Post-checkout survey (optional)
- [ ] Review request automation

### Integration Points

```typescript
// functions/api/guest-booking.ts
async function sendBookingConfirmation(booking: Booking) {
  if (!process.env.RESEND_API_KEY) {
    console.log('Email not configured - manual contact required');
    return;
  }

  const { data, error } = await resend.emails.send({
    from: 'Okaeri Resort <bookings@okaeriresort.com>',
    to: [booking.email],
    subject: `Booking Confirmation - ${booking.reference}`,
    react: BookingConfirmation({ booking }),
  });

  if (error) {
    console.error('Email send failed:', error);
    // Fallback to manual contact
  }
}
```

### Metrics to Track

- Email delivery rate (target: >98%)
- Open rate (industry avg: 20-25%)
- Click-through rate (target: >15%)
- Bounce rate (target: <2%)
- Guest satisfaction with communication
- Time saved vs manual contact

### Cost Estimation

**Assuming 50 bookings/month**:

| Scenario | Emails/Month | Cost |
|----------|--------------|------|
| Guest only (3 emails/booking) | 150 | Free tier |
| Guest + Admin (5 emails/booking) | 250 | Free tier |
| With reminders (7 emails/booking) | 350 | $20/month |

**Free tier sufficient** for first 6 months at current volume.

---

**Status**: Implementation Ready
**Owner**: Okaeri Development Team
