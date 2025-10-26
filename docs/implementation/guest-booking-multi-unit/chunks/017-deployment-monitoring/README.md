# Chunk 017: Deployment and Monitoring

## At a Glance

| Attribute | Value |
|-----------|-------|
| **Estimated Time** | 90 minutes |
| **Phase** | Phase 4: Testing & Launch (Final Chunk) |
| **Milestone** | Production Deployment & Operational Readiness |
| **Prerequisites** | Chunks 001-016 completed, all tests passing |
| **Can Skip?** | ⛔ **NO** - Critical for production launch |

**Status**: Final implementation chunk - system goes live after this

---

## What You're Building

This chunk transitions the multi-unit guest booking system from tested code to operational production reality. You'll deploy the complete system to production infrastructure and establish monitoring to ensure ongoing operational health.

**Core Deliverables**:

1. **Production Database Migration**: Execute schema changes on production PostgreSQL
2. **Cloudflare Infrastructure Deployment**:
   - Workers API with scheduled cron jobs
   - Pages frontend with optimized build
3. **Monitoring Infrastructure**:
   - Grafana Cloud dashboard for metrics
   - UptimeRobot for uptime/health checks
   - Alert rules for critical thresholds
4. **Admin Training**: 2-hour session with operational handoff
5. **Rollback Documentation**: Accessible emergency procedures

**Deployment Sequence**:

```
Staging Validation → Production Database Migration → API Deployment →
Frontend Deployment → Monitoring Setup → Admin Training → Go-Live
```

**Success Definition**: System operational with:
- Zero downtime deployment
- Zero data loss
- Real-time monitoring active
- Alerts configured and tested
- Admin trained and operational

---

## Why This Matters

### Business Impact

**Without This Chunk**:
- ❌ System remains in testing environment (no real bookings)
- ❌ No operational visibility into system health
- ❌ No alerts for critical issues (queue backlogs, errors)
- ❌ Admin unprepared for production workflows
- ❌ No rollback plan if issues occur

**With This Chunk**:
- ✅ Multi-unit bookings available to guests immediately
- ✅ Real-time monitoring of all critical metrics
- ✅ Proactive alerts before issues become critical
- ✅ Admin confidently managing bookings
- ✅ <1 hour rollback capability if needed

### Technical Value

**Operational Excellence**:
- **Observability**: Full visibility into system behavior (requests, errors, queue length)
- **Reliability**: Automated health checks with 5-minute resolution
- **Maintainability**: Centralized metrics for troubleshooting
- **Scalability**: Baseline performance captured for future optimization

**Free Tier Infrastructure**:
- Grafana Cloud: Free plan (10k series, 14-day retention)
- UptimeRobot: Free plan (50 monitors, 5-min intervals)
- Cloudflare Workers: Free plan (100k requests/day)
- Total monthly cost: **$0**

---

## Before You Start

### Prerequisites Checklist

Verify these requirements before proceeding:

#### Code Readiness
- [ ] **All tests passing**: Run `npm run test:all` - must be 100% pass
- [ ] **No TypeScript errors**: Run `npm run type-check` - zero errors
- [ ] **No linting issues**: Run `npm run lint` - zero warnings
- [ ] **Chunks 001-016 completed**: All previous chunks implemented and verified
- [ ] **Performance baselines captured**: Chunk 016 baseline file exists
- [ ] **Cron cleanup functions exist** (from chunk 005): `functions/scheduled/cleanup-idempotency.ts` and `cleanup-payment-proofs.ts` must be implemented

#### Environment Setup
- [ ] **Staging environment validated**: Staging deployment successful with smoke tests passing
- [ ] **Production database accessible**: Connection string verified
- [ ] **Cloudflare account ready**: Workers + Pages deployment permissions
- [ ] **Monitoring accounts created**: Grafana Cloud and UptimeRobot accounts active

#### Backup & Safety
- [ ] **Database backup completed**: Full production backup created and verified
- [ ] **Backup restoration tested**: Backup can be restored successfully
- [ ] **Rollback procedure reviewed**: Team familiar with emergency rollback steps
- [ ] **Rollback window confirmed**: Maintenance window scheduled (if needed)

#### Team Coordination
- [ ] **Admin availability confirmed**: Admin available for 2-hour training session
- [ ] **Deployment team ready**: Developer + Product Manager available during deployment
- [ ] **Communication channels open**: Slack/email/phone for coordination
- [ ] **Go-live date finalized**: Stakeholders notified of launch timeline

### Time Breakdown

| Activity | Duration | When |
|----------|----------|------|
| Pre-deployment prep | 15 min | Day 1 morning |
| Database migration (staging) | 10 min | Day 1 morning |
| Database migration (production) | 10 min | Day 1 afternoon |
| API deployment | 15 min | Day 1 afternoon |
| Frontend deployment | 10 min | Day 1 afternoon |
| Monitoring setup | 20 min | Day 1 afternoon |
| Admin training session | 2 hours | Day 2 |
| **Total** | **~3 hours** | **Over 2 days** |

**Note**: 90-minute estimate is hands-on deployment time (excluding 2-hour training session)

---

## What Happens Next

### Immediate Outcomes (Within 1 Hour)

After completing this chunk:

1. **System Live in Production**:
   - Guest booking form accessible at production URL
   - Multi-unit bookings can be created by real guests
   - Admin queue displays pending bookings in real-time

2. **Monitoring Active**:
   - Grafana Cloud ingesting metrics every 1 minute
   - UptimeRobot checking health every 5 minutes
   - Alerts configured and tested with sample scenarios

3. **Admin Operational**:
   - Training completed with signed documentation
   - Admin can independently process 3 booking scenarios
   - Contact templates and quick reference guide available

4. **Rollback Ready**:
   - Emergency rollback procedure documented
   - Rollback authority established (who can trigger)
   - Rollback script validated on staging

### Post-Go-Live (First 24 Hours)

**Monitoring Checklist**:
- [ ] Watch Grafana dashboard for anomalies
- [ ] Monitor alert channels (email/Slack)
- [ ] Check queue length every 4 hours
- [ ] Review error logs for unexpected patterns
- [ ] Validate first real booking end-to-end

**Success Metrics** (24-hour targets):
- Zero downtime incidents
- All guest bookings processed within 2 hours
- No critical alerts triggered
- Admin queue length < 5 bookings
- Zero data corruption issues

### First Week Goals

- [ ] **Performance Baseline**: Capture 7-day performance data for trending
- [ ] **Admin Feedback**: Daily check-ins on workflow issues
- [ ] **Guest Feedback**: Monitor for booking abandonment rates
- [ ] **Alert Tuning**: Adjust thresholds based on actual traffic patterns
- [ ] **Documentation Updates**: Refine based on real operational issues

---

## Key Files Created/Modified

### New Files

```
functions/
├── _worker.ts                           # Main worker with cron handlers
├── scheduled/
│   ├── cleanup-idempotency.ts          # Daily idempotency key cleanup
│   └── cleanup-payment-proofs.ts       # Weekly payment proof cleanup
└── api/
    └── health.ts                        # Health check endpoint

monitoring/
├── grafana-dashboard.json               # Grafana Cloud dashboard config
├── uptime-robot-config.json            # UptimeRobot monitor definitions
└── alert-rules.yaml                    # Alert threshold definitions

docs/implementation/guest-booking-multi-unit/admin-training/
├── quick-reference-guide.pdf            # 1-page admin cheat sheet
├── video-walkthrough.mp4                # 15-min training video
├── admin-faq.md                         # 15 common admin questions
└── workflow-checklist.pdf               # Daily operational checklist
```

### Modified Files

```
wrangler.toml                           # Add cron triggers and production config
.env.production                         # Production environment variables
database/migrations/
└── 020-guest-booking-multi-unit.sql    # Applied to production database
```

---

## Key Architectural Principles

This chunk enforces the following architectural decisions from the chunking strategy:

### 1. Staging-First Deployment

**Decision**: All changes deployed to staging first, validated, then promoted to production.

**Implementation**:
- Database migration runs on staging with full validation
- Smoke tests executed on staging before production
- Issues resolved on staging environment first

### 2. Zero-Downtime Migration

**Decision**: Database migration designed for zero downtime.

**Implementation**:
- Additive-only schema changes (no column drops)
- New tables created without locking existing tables
- Constraints added after data validation
- Backward-compatible API during migration window

### 3. Free-Tier Monitoring

**Decision**: Use free-tier tools to minimize operational costs.

**Implementation**:
- Grafana Cloud: 10k series, 14-day retention
- UptimeRobot: 50 monitors, 5-min checks
- Cloudflare Workers: Built-in analytics
- Total cost: $0/month

### 4. Manual Contact Workflow

**Decision**: NO email automation - admin contacts guests manually.

**Training Focus**:
- Phone/SMS templates for confirmations
- Payment verification via uploaded proofs
- Unit assignment communication scripts
- Edge case handling (insufficient units, payment issues)

### 5. Array-Based Data Model

**Deployment Verification**:
- Confirm `guest_booking_unit_requests` table created (NO `quantity` column)
- Validate array-based booking creation via smoke tests
- Verify admin UI displays unit cards correctly

### 6. Server-Side Pricing Authority

**Deployment Verification**:
- Confirm `calculate_booking_pricing()` PostgreSQL function deployed
- Validate `/api/guest-booking/preview-pricing` calls function
- Verify pricing snapshot stored in JSONB column

### 7. All-or-Nothing Assignment

**Monitoring Setup**:
- Alert on partial assignments (constraint violations)
- Dashboard widget for assignment status distribution
- Admin training emphasizes no partial fulfillment

---

## Related Documentation

### Source Documentation (Reference During Implementation)

- **[06-migration-guide.md](../../06-migration-guide.md)**:
  - Complete migration script (lines 87-550)
  - Rollback procedures (lines 701-768)
  - Cron job configuration (lines 936-1315)
  - Admin training content (lines 1397-1676)

- **[09-implementation-decisions.md](../../09-implementation-decisions.md)**:
  - Monitoring metrics definitions (lines 433-447)
  - Alert threshold rationale (lines 441-447)

- **[CHUNKING-STRATEGY.md](../../CHUNKING-STRATEGY.md)**:
  - Chunk 017 scope definition (lines 586-621)
  - Dependencies and prerequisites (line 590)
  - Success criteria (lines 610-620)

### Related Chunks (Prerequisites)

- **Chunk 001-003**: Database schema, pricing function, constraints (must be working)
- **Chunk 004-005**: API endpoints, idempotency (must be tested)
- **Chunk 006-010**: Guest booking UI (must be functional)
- **Chunk 011-014**: Admin interface (must be operational)
- **Chunk 015-016**: All tests passing (mandatory before deployment)

### Post-Deployment References

- **[CLAUDE.md](../../../../../CLAUDE.md)**: Development workflow, testing commands
- **[README.md](../../README.md)**: System overview, architecture decisions
- **Rollback script**: `database/migrations/rollback-020.sql` (if needed)

---

## Success Indicators

### Technical Success

- ✅ Database migration completes without errors
- ✅ All API endpoints return 2xx status codes
- ✅ Frontend loads without console errors
- ✅ Monitoring ingests data within 5 minutes
- ✅ Test booking completes end-to-end
- ✅ Cron jobs execute on schedule

### Operational Success

- ✅ Admin completes 3 practice bookings independently
- ✅ Quick reference guide and FAQ accessible
- ✅ Alert channels tested with sample scenarios
- ✅ Queue urgency scoring displays correctly
- ✅ Payment verification workflow understood

### Business Success

- ✅ First real multi-unit booking processed successfully
- ✅ Guest receives confirmation (via manual contact)
- ✅ Admin assigns units within 2-hour SLA
- ✅ Zero booking errors in first 24 hours
- ✅ Stakeholder approval for go-live

---

## Risk Mitigation

### High-Risk Scenarios

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Database migration fails | Low | Critical | Staging validation, rollback script tested |
| API deployment breaks existing bookings | Low | High | Backward compatibility, staged rollout |
| Monitoring setup incomplete | Medium | Medium | Pre-configured dashboards, validation checklist |
| Admin unprepared for production | Medium | High | 2-hour training, practice scenarios, FAQ |
| Alert storm (too many false positives) | Medium | Low | Conservative thresholds, tuning period |

### Rollback Decision Criteria

**Roll back immediately if**:
- Database migration fails with data loss
- Critical API endpoints return 5xx errors
- Guest booking form completely non-functional
- Data corruption detected

**Continue with hotfix if**:
- Non-critical UI bugs (cosmetic)
- Alert tuning needed (false positives)
- Admin workflow confusion (training gap)
- Performance degradation <50%

**Target**: <1 hour rollback time (as specified in CHUNKING-STRATEGY.md line 828)

---

## Notes for Implementation

### Critical Paths

**Must succeed for launch**:
1. Database migration with zero data loss
2. API health check returns 200 OK
3. Guest booking form loads and submits successfully
4. Admin can login and view queue

**Nice to have (can fix post-launch)**:
- Perfect alert threshold tuning
- Complete admin training video
- Detailed monitoring dashboards
- Optimized cron job timing

### Deployment Windows

**Recommended timing**:
- **Database migration**: Off-peak hours (2-4 AM local time)
- **API/Frontend deployment**: Business hours (for immediate validation)
- **Monitoring setup**: Anytime (no production impact)
- **Admin training**: Business hours (when admin available)

**Avoid**:
- Peak booking hours (10 AM - 2 PM, 6 PM - 10 PM)
- Friday evenings (limited rollback support)
- Holiday periods (limited admin availability)

---

**Next**: Proceed to `instructions.md` for step-by-step deployment commands.
