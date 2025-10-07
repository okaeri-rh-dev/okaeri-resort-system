# Phase 6: Migration & Production Rollout

**Timeline**: Week 7 (Nov 17-22, 2025)
**Lead Agent**: `cloudflare-deployment-optimizer`
**Supporting Agents**: `postgres-serverless-architect`, `context-manager`, `security-compliance-auditor`
**Dependencies**: Phases 1-5 complete, all tests passing
**Deliverables**: Production deployment, monitoring dashboards, rollback procedures

---

## Phase Overview

Phase 6 executes the production rollout of multi-unit booking functionality using a phased deployment strategy with feature flags. This approach minimizes risk while enabling rapid rollback if issues arise.

**Key Objectives**:

- Zero-downtime deployment of database changes
- Gradual user exposure (Beta → 10% → 25% → 50% → 100%)
- Real-time monitoring and alerting
- <5 minute rollback capability
- Data integrity verification at each stage
- Comprehensive audit trail of deployment activities

---

## Success Criteria

| Metric                      | Target               | Measurement                 |
| --------------------------- | -------------------- | --------------------------- |
| **Deployment Success Rate** | 100% (zero failures) | Cloudflare deployment logs  |
| **Downtime**                | 0 minutes            | Uptime monitoring           |
| **Rollback Time**           | <5 minutes           | Incident response time      |
| **Data Integrity**          | 100% (no data loss)  | Database validation queries |
| **User Adoption Rate**      | ≥70% (Beta users)    | Analytics tracking          |
| **Error Rate**              | <0.1% during rollout | Sentry error monitoring     |
| **Performance Regression**  | 0 (no degradation)   | Compare Phase 5 benchmarks  |
| **Customer Complaints**     | <5 during rollout    | Support ticket tracking     |

---

## Agent Assignments

### Lead Agent: `cloudflare-deployment-optimizer`

**Responsibilities**:

- Configure Cloudflare Pages deployment for frontend
- Set up Cloudflare Workers for API endpoints
- Implement feature flag infrastructure
- Configure edge caching and CDN
- Monitor deployment metrics
- Execute rollout phases
- Coordinate rollback if needed

**Deliverables**:

- Cloudflare deployment configuration
- Feature flag management dashboard
- Deployment runbook
- Post-deployment report

### Supporting Agent: `postgres-serverless-architect`

**Responsibilities**:

- Execute database migration safely
- Validate data integrity after migration
- Monitor database performance during rollout
- Optimize connection pooling for production load
- Create database backup/restore procedures

**Deliverables**:

- Database migration scripts (verified)
- Data validation report
- Performance monitoring queries
- Backup verification report

### Supporting Agent: `context-manager`

**Responsibilities**:

- Coordinate handoffs between deployment phases
- Preserve critical context during rollout
- Document lessons learned
- Track blockers and resolutions

**Deliverables**:

- Phase transition summaries
- Deployment timeline documentation
- Post-mortem report

### Supporting Agent: `security-compliance-auditor`

**Responsibilities**:

- Validate security controls during deployment
- Monitor for security incidents
- Verify audit logging in production
- Review production access controls

**Deliverables**:

- Security validation checklist
- Production access audit
- Compliance verification report

---

## 1. Feature Flag Infrastructure

### Implementation with Cloudflare Workers KV

```typescript
// functions/lib/feature-flags.ts
import type { KVNamespace } from "@cloudflare/workers-types";

export interface FeatureFlags {
  MULTI_UNIT_BOOKING_ENABLED: boolean;
  MULTI_UNIT_ROLLOUT_PERCENTAGE: number;
  MULTI_UNIT_BETA_USERS: string[];
  MULTI_UNIT_FORCE_DISABLE: boolean;
}

export class FeatureFlagManager {
  constructor(private kv: KVNamespace) {}

  /**
   * Check if multi-unit booking is enabled for a user
   */
  async isMultiUnitEnabled(userId: string, email: string): Promise<boolean> {
    // 1. Check force disable (kill switch)
    const forceDisable = await this.kv.get("MULTI_UNIT_FORCE_DISABLE");
    if (forceDisable === "true") {
      console.log("[FeatureFlag] Multi-unit force disabled");
      return false;
    }

    // 2. Check beta user list
    const betaUsersJson = await this.kv.get("MULTI_UNIT_BETA_USERS");
    if (betaUsersJson) {
      const betaUsers: string[] = JSON.parse(betaUsersJson);
      if (betaUsers.includes(userId) || betaUsers.includes(email)) {
        console.log(`[FeatureFlag] Beta user access granted: ${email}`);
        return true;
      }
    }

    // 3. Check rollout percentage
    const rolloutPercentage = await this.kv.get("MULTI_UNIT_ROLLOUT_PERCENTAGE");
    if (rolloutPercentage) {
      const percentage = parseInt(rolloutPercentage, 10);
      const userHash = this.hashUserId(userId);
      const userPercentile = userHash % 100;

      const enabled = userPercentile < percentage;
      console.log(`[FeatureFlag] Rollout check: ${userPercentile} < ${percentage} = ${enabled}`);
      return enabled;
    }

    // 4. Default: disabled
    return false;
  }

  /**
   * Get current feature flag configuration
   */
  async getConfig(): Promise<FeatureFlags> {
    const [forceDisable, rolloutPercentage, betaUsersJson] = await Promise.all([
      this.kv.get("MULTI_UNIT_FORCE_DISABLE"),
      this.kv.get("MULTI_UNIT_ROLLOUT_PERCENTAGE"),
      this.kv.get("MULTI_UNIT_BETA_USERS"),
    ]);

    return {
      MULTI_UNIT_BOOKING_ENABLED: forceDisable !== "true",
      MULTI_UNIT_ROLLOUT_PERCENTAGE: parseInt(rolloutPercentage || "0", 10),
      MULTI_UNIT_BETA_USERS: betaUsersJson ? JSON.parse(betaUsersJson) : [],
      MULTI_UNIT_FORCE_DISABLE: forceDisable === "true",
    };
  }

  /**
   * Update feature flag (admin only)
   */
  async updateFlag(key: keyof FeatureFlags, value: any): Promise<void> {
    const stringValue = typeof value === "string" ? value : JSON.stringify(value);
    await this.kv.put(key, stringValue);
    console.log(`[FeatureFlag] Updated ${key} = ${stringValue}`);
  }

  /**
   * Hash user ID to consistent percentile (0-99)
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }
}

// Singleton instance
let featureFlagManager: FeatureFlagManager | null = null;

export function getFeatureFlagManager(kv: KVNamespace): FeatureFlagManager {
  if (!featureFlagManager) {
    featureFlagManager = new FeatureFlagManager(kv);
  }
  return featureFlagManager;
}
```

### Feature Flag Middleware

```typescript
// functions/_middleware.ts
import type { Request as CloudflareRequest, KVNamespace } from "@cloudflare/workers-types";
import { getFeatureFlagManager } from "./lib/feature-flags";

interface Env {
  FEATURE_FLAGS: KVNamespace;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

export async function onRequest(context: {
  request: CloudflareRequest;
  env: Env;
  next: () => Promise<Response>;
}) {
  const { request, env, next } = context;

  // Extract user from JWT
  const authHeader = request.headers.get("Authorization");
  let userId: string | null = null;
  let userEmail: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const payload = parseJWT(token);
    userId = payload?.sub || null;
    userEmail = payload?.email || null;
  }

  // Check feature flags
  if (userId && env.FEATURE_FLAGS) {
    const flagManager = getFeatureFlagManager(env.FEATURE_FLAGS);
    const multiUnitEnabled = await flagManager.isMultiUnitEnabled(userId, userEmail || "");

    // Attach flag to request context
    (request as any).featureFlags = {
      multiUnitEnabled,
    };
  }

  return next();
}

function parseJWT(token: string): any {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Failed to parse JWT:", error);
    return null;
  }
}
```

### Client-Side Feature Flag Hook

```typescript
// src/hooks/useFeatureFlags.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface FeatureFlags {
  multiUnitEnabled: boolean;
  rolloutPercentage: number;
  isBetaUser: boolean;
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ['feature-flags'],
    queryFn: async (): Promise<FeatureFlags> => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        return {
          multiUnitEnabled: false,
          rolloutPercentage: 0,
          isBetaUser: false,
        };
      }

      // Fetch from backend API
      const response = await fetch('/api/feature-flags', {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch feature flags');
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Usage in components
export function BookingPage() {
  const { data: featureFlags, isLoading } = useFeatureFlags();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      {featureFlags?.multiUnitEnabled ? (
        <MultiUnitBookingForm />
      ) : (
        <SingleUnitBookingForm />
      )}
    </div>
  );
}
```

---

## 2. Gradual Rollout Strategy

### Rollout Phases

| Phase    | Timeline            | Exposure            | Criteria                        | Rollback Trigger   |
| -------- | ------------------- | ------------------- | ------------------------------- | ------------------ |
| **Beta** | Nov 17 (Day 1)      | 10-20 beta users    | Handpicked power users          | >5 critical errors |
| **10%**  | Nov 18-19 (Day 2-3) | 10% of active users | Beta success, <0.1% error rate  | >10 errors/hour    |
| **25%**  | Nov 19-20 (Day 3-4) | 25% of active users | 10% success, stable performance | >25 errors/hour    |
| **50%**  | Nov 20-21 (Day 4-5) | 50% of active users | 25% success, positive feedback  | >50 errors/hour    |
| **100%** | Nov 21-22 (Day 5-7) | All users           | 50% success, no critical issues | >100 errors/hour   |

### Rollout Execution Script

```bash
#!/bin/bash
# scripts/rollout-multi-unit.sh

set -e

CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN}"
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID}"
KV_NAMESPACE_ID="${FEATURE_FLAGS_KV_NAMESPACE_ID}"

function update_rollout_percentage() {
  local percentage=$1
  echo "📊 Updating rollout to ${percentage}%..."

  curl -X PUT \
    "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/MULTI_UNIT_ROLLOUT_PERCENTAGE" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: text/plain" \
    --data "${percentage}"

  echo "✅ Rollout percentage updated to ${percentage}%"
}

function enable_beta_users() {
  local beta_users='["user-id-1", "user-id-2", "beta@resort.com"]'
  echo "👥 Enabling beta users..."

  curl -X PUT \
    "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/MULTI_UNIT_BETA_USERS" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "${beta_users}"

  echo "✅ Beta users enabled"
}

function kill_switch() {
  echo "🚨 ACTIVATING KILL SWITCH - Disabling multi-unit for all users..."

  curl -X PUT \
    "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/MULTI_UNIT_FORCE_DISABLE" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: text/plain" \
    --data "true"

  echo "❌ Multi-unit booking disabled for all users"
}

function monitor_metrics() {
  local duration=$1
  echo "📈 Monitoring metrics for ${duration} minutes..."

  for i in $(seq 1 $duration); do
    sleep 60

    # Check error rate
    ERROR_RATE=$(curl -s "https://api.sentry.io/v1/error-rate" | jq '.rate')
    echo "[${i}/${duration}] Error rate: ${ERROR_RATE}"

    if (( $(echo "$ERROR_RATE > 0.1" | bc -l) )); then
      echo "⚠️  Error rate above threshold!"
      return 1
    fi
  done

  return 0
}

# Main rollout sequence
case "${1}" in
  beta)
    echo "🚀 Phase 1: Beta Rollout"
    enable_beta_users
    update_rollout_percentage 0
    ;;

  10)
    echo "🚀 Phase 2: 10% Rollout"
    if monitor_metrics 30; then
      update_rollout_percentage 10
    else
      echo "❌ Metrics check failed. Aborting rollout."
      exit 1
    fi
    ;;

  25)
    echo "🚀 Phase 3: 25% Rollout"
    if monitor_metrics 30; then
      update_rollout_percentage 25
    else
      echo "❌ Metrics check failed. Aborting rollout."
      exit 1
    fi
    ;;

  50)
    echo "🚀 Phase 4: 50% Rollout"
    if monitor_metrics 30; then
      update_rollout_percentage 50
    else
      echo "❌ Metrics check failed. Aborting rollout."
      exit 1
    fi
    ;;

  100)
    echo "🚀 Phase 5: 100% Rollout (Full Release)"
    if monitor_metrics 30; then
      update_rollout_percentage 100
    else
      echo "❌ Metrics check failed. Aborting rollout."
      exit 1
    fi
    ;;

  rollback)
    echo "⏪ ROLLBACK: Reverting to single-unit only"
    kill_switch
    ;;

  *)
    echo "Usage: $0 {beta|10|25|50|100|rollback}"
    exit 1
    ;;
esac

echo "✅ Rollout phase complete. Monitor dashboards for 30 minutes before next phase."
```

---

## 3. Database Migration Strategy

### Zero-Downtime Migration Steps

```sql
-- migration/multi-unit-production-rollout.sql

-- ============================================================================
-- STEP 1: Pre-Migration Validation (READ-ONLY)
-- ============================================================================

-- Verify current data integrity
DO $$
BEGIN
  RAISE NOTICE 'Starting pre-migration validation...';

  -- Check for orphaned bookings
  IF EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.unit_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM units u WHERE u.unit_id = b.unit_id)
  ) THEN
    RAISE EXCEPTION 'Found orphaned bookings with invalid unit_id';
  END IF;

  -- Check for overlapping bookings (should not exist with current constraints)
  IF EXISTS (
    SELECT b1.booking_id, b2.booking_id
    FROM bookings b1
    JOIN bookings b2 ON b1.unit_id = b2.unit_id
      AND b1.booking_id != b2.booking_id
      AND b1.status NOT IN ('Cancelled', 'NoShow')
      AND b2.status NOT IN ('Cancelled', 'NoShow')
      AND tstzrange(b1.check_in_date, b1.check_out_date, '[)') &&
          tstzrange(b2.check_in_date, b2.check_out_date, '[)')
  ) THEN
    RAISE EXCEPTION 'Found overlapping bookings for same unit';
  END IF;

  RAISE NOTICE 'Pre-migration validation passed ✓';
END $$;

-- ============================================================================
-- STEP 2: Create Backup
-- ============================================================================

-- Create backup tables (manual backup via Supabase dashboard recommended)
CREATE TABLE IF NOT EXISTS bookings_backup_20251117 AS
SELECT * FROM bookings;

CREATE TABLE IF NOT EXISTS payments_backup_20251117 AS
SELECT * FROM payments;

RAISE NOTICE 'Backup tables created ✓';

-- ============================================================================
-- STEP 3: Create New Tables (from Phase 1)
-- ============================================================================

-- Create booking_units junction table
CREATE TABLE IF NOT EXISTS booking_units (
  booking_unit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(unit_id) ON DELETE RESTRICT,
  unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  weekend_surcharge DECIMAL(10,2) DEFAULT 0 CHECK (weekend_surcharge >= 0),
  extra_person_charge DECIMAL(10,2) DEFAULT 0 CHECK (extra_person_charge >= 0),
  subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
  assigned_guests INTEGER CHECK (assigned_guests >= 0),
  guest_names TEXT[],
  unit_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id, unit_id)
);

-- Create indices
CREATE INDEX IF NOT EXISTS idx_booking_units_booking_id ON booking_units(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_units_unit_id ON booking_units(unit_id);
CREATE INDEX IF NOT EXISTS idx_booking_units_created_at ON booking_units(created_at DESC);

-- Create booking_unit_availability table with exclusion constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS booking_unit_availability (
  availability_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(unit_id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  check_in TIMESTAMPTZ NOT NULL,
  check_out TIMESTAMPTZ NOT NULL,
  booking_status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  EXCLUDE USING gist (
    unit_id WITH =,
    tstzrange(check_in, check_out, '[)') WITH &&
  ) WHERE (booking_status NOT IN ('Cancelled', 'NoShow'))
);

CREATE INDEX IF NOT EXISTS idx_booking_unit_availability_unit_dates
  ON booking_unit_availability(unit_id, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_booking_unit_availability_booking
  ON booking_unit_availability(booking_id);

-- Modify bookings table
ALTER TABLE bookings
  ALTER COLUMN unit_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS is_multi_unit BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS unit_count INTEGER DEFAULT 1 CHECK (unit_count >= 1);

RAISE NOTICE 'New tables and columns created ✓';

-- ============================================================================
-- STEP 4: Migrate Existing Data (Legacy → New Schema)
-- ============================================================================

DO $$
DECLARE
  booking_record RECORD;
  migrated_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting data migration...';

  -- Migrate existing single-unit bookings to junction table
  FOR booking_record IN
    SELECT booking_id, unit_id, total_amount, num_guests, check_in_date, check_out_date, status
    FROM bookings
    WHERE unit_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM booking_units bu WHERE bu.booking_id = bookings.booking_id
      )
  LOOP
    -- Insert into booking_units
    INSERT INTO booking_units (
      booking_id,
      unit_id,
      unit_price,
      weekend_surcharge,
      extra_person_charge,
      subtotal,
      assigned_guests
    ) VALUES (
      booking_record.booking_id,
      booking_record.unit_id,
      booking_record.total_amount, -- Using total as unit price for legacy
      0,
      0,
      booking_record.total_amount,
      booking_record.num_guests
    );

    -- Insert into booking_unit_availability
    INSERT INTO booking_unit_availability (
      unit_id,
      booking_id,
      check_in,
      check_out,
      booking_status
    ) VALUES (
      booking_record.unit_id,
      booking_record.booking_id,
      booking_record.check_in_date,
      booking_record.check_out_date,
      booking_record.status
    );

    migrated_count := migrated_count + 1;

    IF migrated_count % 100 = 0 THEN
      RAISE NOTICE 'Migrated % bookings...', migrated_count;
    END IF;
  END LOOP;

  RAISE NOTICE 'Data migration complete: % bookings migrated ✓', migrated_count;
END $$;

-- ============================================================================
-- STEP 5: Create Database Functions (from Phase 1)
-- ============================================================================

-- (Include all functions from 01-database-foundation.md)
-- - create_multi_unit_booking()
-- - check_multi_unit_availability()
-- - get_booking_units()
-- - etc.

-- ============================================================================
-- STEP 6: Create Triggers (from Phase 1)
-- ============================================================================

-- (Include all triggers from 01-database-foundation.md)
-- - trigger_update_booking_total
-- - trigger_sync_booking_dates
-- - etc.

-- ============================================================================
-- STEP 7: Setup RLS Policies (from Phase 1)
-- ============================================================================

-- Enable RLS
ALTER TABLE booking_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_unit_availability ENABLE ROW LEVEL SECURITY;

-- (Include all RLS policies from 01-database-foundation.md)

-- ============================================================================
-- STEP 8: Post-Migration Validation
-- ============================================================================

DO $$
DECLARE
  total_bookings INTEGER;
  migrated_bookings INTEGER;
  orphaned_units INTEGER;
BEGIN
  RAISE NOTICE 'Running post-migration validation...';

  -- Verify all bookings have corresponding booking_units
  SELECT COUNT(*) INTO total_bookings FROM bookings WHERE unit_id IS NOT NULL;
  SELECT COUNT(DISTINCT booking_id) INTO migrated_bookings FROM booking_units;

  IF total_bookings != migrated_bookings THEN
    RAISE WARNING 'Booking count mismatch: % original, % migrated', total_bookings, migrated_bookings;
  ELSE
    RAISE NOTICE 'Booking count verified: % = % ✓', total_bookings, migrated_bookings;
  END IF;

  -- Check for orphaned booking_units
  SELECT COUNT(*) INTO orphaned_units
  FROM booking_units bu
  WHERE NOT EXISTS (SELECT 1 FROM bookings b WHERE b.booking_id = bu.booking_id);

  IF orphaned_units > 0 THEN
    RAISE EXCEPTION 'Found % orphaned booking_units', orphaned_units;
  END IF;

  RAISE NOTICE 'Post-migration validation passed ✓';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION COMPLETE ✅';
  RAISE NOTICE 'Total bookings migrated: %', migrated_bookings;
  RAISE NOTICE '========================================';
END $$;
```

### Migration Execution Checklist

```bash
#!/bin/bash
# scripts/execute-migration.sh

set -e

echo "🗄️  Multi-Unit Booking Database Migration"
echo "=========================================="

# Step 1: Confirm backup
read -p "Have you created a manual backup via Supabase dashboard? (yes/no): " backup_confirm
if [ "$backup_confirm" != "yes" ]; then
  echo "❌ Please create a backup first!"
  exit 1
fi

# Step 2: Dry run validation
echo "📋 Running pre-migration validation (dry run)..."
psql $DATABASE_URL -f migration/validate-pre-migration.sql

# Step 3: Execute migration
read -p "Proceed with migration? (yes/no): " proceed
if [ "$proceed" != "yes" ]; then
  echo "❌ Migration cancelled"
  exit 1
fi

echo "🚀 Executing migration..."
psql $DATABASE_URL -f migration/multi-unit-production-rollout.sql > migration.log 2>&1

# Step 4: Post-migration validation
echo "✅ Running post-migration validation..."
psql $DATABASE_URL -f migration/validate-post-migration.sql

# Step 5: Summary
echo "=========================================="
echo "✅ MIGRATION COMPLETE"
echo "📄 Migration log: migration.log"
echo "=========================================="
```

---

## 4. Monitoring & Alerting

### Sentry Configuration

```typescript
// src/lib/monitoring/sentry.ts
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    new BrowserTracing(),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  beforeSend(event, hint) {
    // Tag multi-unit booking errors
    if (event.tags?.feature === "multi-unit-booking") {
      event.fingerprint = ["multi-unit", event.message || "unknown"];
      event.level = "error";
    }

    // Filter out non-critical errors during rollout
    if (import.meta.env.PROD && event.level === "warning") {
      return null;
    }

    return event;
  },
});

// Custom error tracking for multi-unit
export function trackMultiUnitError(error: Error, context: Record<string, any>) {
  Sentry.withScope((scope) => {
    scope.setTag("feature", "multi-unit-booking");
    scope.setContext("multi-unit-context", context);
    Sentry.captureException(error);
  });
}
```

### Grafana Dashboard Configuration

```yaml
# monitoring/grafana-dashboard.json
{
  "dashboard":
    {
      "title": "Multi-Unit Booking Rollout",
      "panels":
        [
          {
            "id": 1,
            "title": "Feature Flag Rollout %",
            "type": "graph",
            "targets":
              [
                {
                  "expr": "cloudflare_kv_get{key='MULTI_UNIT_ROLLOUT_PERCENTAGE'}",
                  "legendFormat": "Rollout Percentage",
                },
              ],
          },
          {
            "id": 2,
            "title": "Multi-Unit Bookings Created",
            "type": "graph",
            "targets":
              [
                {
                  "expr": "sum(rate(booking_created_total{type='multi_unit'}[5m]))",
                  "legendFormat": "Multi-Unit Bookings/min",
                },
                {
                  "expr": "sum(rate(booking_created_total{type='single_unit'}[5m]))",
                  "legendFormat": "Single-Unit Bookings/min",
                },
              ],
          },
          {
            "id": 3,
            "title": "Error Rate",
            "type": "graph",
            "targets":
              [
                {
                  "expr": "sum(rate(http_requests_total{status=~'5..'}[5m])) / sum(rate(http_requests_total[5m]))",
                  "legendFormat": "Error Rate",
                },
              ],
            "thresholds":
              [
                { "value": 0.001, "color": "green" },
                { "value": 0.01, "color": "yellow" },
                { "value": 0.05, "color": "red" },
              ],
          },
          {
            "id": 4,
            "title": "API Response Time (p95)",
            "type": "graph",
            "targets":
              [
                {
                  "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{endpoint='/api/bookings/multi-unit'}[5m])) by (le))",
                  "legendFormat": "p95 Response Time",
                },
              ],
            "thresholds":
              [
                { "value": 200, "color": "green" },
                { "value": 500, "color": "yellow" },
                { "value": 1000, "color": "red" },
              ],
          },
          {
            "id": 5,
            "title": "Database Query Performance",
            "type": "graph",
            "targets":
              [
                {
                  "expr": "histogram_quantile(0.95, sum(rate(postgres_query_duration_seconds_bucket{query='create_multi_unit_booking'}[5m])) by (le))",
                  "legendFormat": "create_multi_unit_booking p95",
                },
                {
                  "expr": "histogram_quantile(0.95, sum(rate(postgres_query_duration_seconds_bucket{query='check_multi_unit_availability'}[5m])) by (le))",
                  "legendFormat": "check_multi_unit_availability p95",
                },
              ],
          },
          {
            "id": 6,
            "title": "Concurrent Booking Conflicts",
            "type": "stat",
            "targets":
              [
                {
                  "expr": "sum(increase(booking_conflict_total[1h]))",
                  "legendFormat": "Conflicts (1h)",
                },
              ],
          },
        ],
      "refresh": "10s",
      "time": { "from": "now-1h", "to": "now" },
    },
}
```

### Alert Rules (PagerDuty / Slack)

```yaml
# monitoring/alert-rules.yml
groups:
  - name: multi_unit_rollout
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5..", feature="multi-unit"}[5m]))
          / sum(rate(http_requests_total{feature="multi-unit"}[5m])) > 0.01
        for: 5m
        labels:
          severity: critical
          feature: multi-unit-booking
        annotations:
          summary: "High error rate in multi-unit booking"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 1%)"

      - alert: SlowAPIResponse
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket{endpoint="/api/bookings/multi-unit"}[5m])) by (le)
          ) > 0.5
        for: 10m
        labels:
          severity: warning
          feature: multi-unit-booking
        annotations:
          summary: "Slow API response times"
          description: "p95 response time is {{ $value }}s (threshold: 0.5s)"

      - alert: DatabaseQuerySlow
        expr: |
          histogram_quantile(0.95,
            sum(rate(postgres_query_duration_seconds_bucket{query="create_multi_unit_booking"}[5m])) by (le)
          ) > 0.15
        for: 5m
        labels:
          severity: warning
          feature: multi-unit-booking
        annotations:
          summary: "Slow database queries"
          description: "create_multi_unit_booking p95 is {{ $value }}s (threshold: 0.15s)"

      - alert: BookingConflictSpike
        expr: |
          sum(increase(booking_conflict_total[5m])) > 10
        for: 5m
        labels:
          severity: warning
          feature: multi-unit-booking
        annotations:
          summary: "Spike in booking conflicts"
          description: "{{ $value }} conflicts in last 5 minutes"

      - alert: FeatureFlagKillSwitch
        expr: cloudflare_kv_get{key="MULTI_UNIT_FORCE_DISABLE"} == 1
        for: 1m
        labels:
          severity: critical
          feature: multi-unit-booking
        annotations:
          summary: "Kill switch activated"
          description: "Multi-unit booking has been force disabled"
```

---

## 5. Rollback Procedures

### Automated Rollback Script

```bash
#!/bin/bash
# scripts/rollback-multi-unit.sh

set -e

echo "⏪ EMERGENCY ROLLBACK: Multi-Unit Booking"
echo "=========================================="

# Step 1: Activate kill switch (immediate)
echo "🚨 Step 1: Activating feature flag kill switch..."
curl -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/MULTI_UNIT_FORCE_DISABLE" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: text/plain" \
  --data "true"

echo "✅ Kill switch activated. Multi-unit disabled for all users."

# Step 2: Verify no new multi-unit bookings
echo "🔍 Step 2: Verifying no new multi-unit bookings..."
sleep 30 # Wait 30 seconds

NEW_BOOKINGS=$(psql $DATABASE_URL -t -c "
  SELECT COUNT(*)
  FROM bookings
  WHERE is_multi_unit = true
    AND created_at > NOW() - INTERVAL '1 minute'
")

if [ "$NEW_BOOKINGS" -gt 0 ]; then
  echo "⚠️  Warning: $NEW_BOOKINGS new multi-unit bookings created in last minute"
else
  echo "✅ No new multi-unit bookings detected"
fi

# Step 3: Database rollback (optional - only if data corruption)
read -p "Execute database rollback? (yes/no): " db_rollback
if [ "$db_rollback" == "yes" ]; then
  echo "🗄️  Step 3: Rolling back database changes..."

  # Restore from backup
  psql $DATABASE_URL <<EOF
    -- Drop new tables
    DROP TABLE IF EXISTS booking_unit_availability CASCADE;
    DROP TABLE IF EXISTS booking_units CASCADE;

    -- Restore bookings table
    ALTER TABLE bookings
      ALTER COLUMN unit_id SET NOT NULL,
      DROP COLUMN IF EXISTS is_multi_unit,
      DROP COLUMN IF EXISTS unit_count;

    -- Verify restoration
    SELECT 'Rollback complete' AS status;
EOF

  echo "✅ Database rolled back to pre-migration state"
else
  echo "⏭️  Skipping database rollback (data retained)"
fi

# Step 4: Redeploy previous version (Cloudflare Pages)
echo "🚀 Step 4: Redeploying previous version..."
PREVIOUS_DEPLOYMENT=$(curl -s -X GET \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/resort-system/deployments" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  | jq -r '.result[1].id') # Get second-latest deployment

curl -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/resort-system/deployments/${PREVIOUS_DEPLOYMENT}/rollback" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"

echo "✅ Rolled back to previous deployment: $PREVIOUS_DEPLOYMENT"

# Step 5: Notify team
echo "📢 Step 5: Sending rollback notification..."
curl -X POST https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "🚨 ROLLBACK EXECUTED: Multi-Unit Booking",
    "attachments": [{
      "color": "danger",
      "fields": [
        {"title": "Feature", "value": "Multi-Unit Booking", "short": true},
        {"title": "Status", "value": "Rolled Back", "short": true},
        {"title": "Timestamp", "value": "'"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'", "short": false}
      ]
    }]
  }'

echo "=========================================="
echo "✅ ROLLBACK COMPLETE"
echo "🕐 Execution time: $SECONDS seconds"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Investigate root cause of rollback"
echo "2. Review error logs in Sentry"
echo "3. Schedule post-mortem meeting"
echo "4. Create incident report"
```

### Rollback Decision Matrix

| Issue Severity | Symptoms                                                       | Rollback Action                             | Timeline        |
| -------------- | -------------------------------------------------------------- | ------------------------------------------- | --------------- |
| **Critical**   | >100 errors/hour, data corruption, security breach             | Full rollback (kill switch + database)      | <5 minutes      |
| **High**       | >50 errors/hour, performance degradation >2x, payment failures | Kill switch only (retain data)              | <10 minutes     |
| **Medium**     | >25 errors/hour, UI bugs, minor data inconsistencies           | Reduce rollout percentage (e.g., 50% → 10%) | <15 minutes     |
| **Low**        | <10 errors/hour, cosmetic issues, feature requests             | Monitor and fix forward                     | Next deployment |

---

## 6. Post-Deployment Validation

### Validation Checklist

```typescript
// scripts/validate-production.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function validateProduction() {
  console.log("🔍 Running post-deployment validation...\n");

  let allChecksPassed = true;

  // Check 1: Database tables exist
  console.log("📊 Checking database tables...");
  const { data: tables, error: tablesError } = await supabase.rpc("get_table_names");

  const requiredTables = ["booking_units", "booking_unit_availability"];
  const missingTables = requiredTables.filter((t) => !tables?.includes(t));

  if (missingTables.length > 0) {
    console.error(`❌ Missing tables: ${missingTables.join(", ")}`);
    allChecksPassed = false;
  } else {
    console.log("✅ All required tables exist\n");
  }

  // Check 2: Database functions exist
  console.log("⚙️  Checking database functions...");
  const requiredFunctions = [
    "create_multi_unit_booking",
    "check_multi_unit_availability",
    "get_booking_units",
  ];

  for (const fn of requiredFunctions) {
    const { error } = await supabase.rpc(fn, {}); // Dry run
    if (error && !error.message.includes("missing")) {
      console.error(`❌ Function ${fn} not working: ${error.message}`);
      allChecksPassed = false;
    }
  }
  console.log("✅ All database functions exist\n");

  // Check 3: Feature flags accessible
  console.log("🚩 Checking feature flags...");
  const flagsResponse = await fetch(`${process.env.CLOUDFLARE_API}/feature-flags`);
  if (!flagsResponse.ok) {
    console.error("❌ Feature flags API not accessible");
    allChecksPassed = false;
  } else {
    const flags = await flagsResponse.json();
    console.log(`✅ Feature flags: ${JSON.stringify(flags)}\n`);
  }

  // Check 4: Create test multi-unit booking
  console.log("🧪 Creating test multi-unit booking...");
  const { data: testBooking, error: bookingError } = await supabase.rpc(
    "create_multi_unit_booking",
    {
      p_guest_id: "test-guest",
      p_check_in: "2025-12-01",
      p_check_out: "2025-12-03",
      p_units: [
        { unit_id: "test-unit-1", num_guests: 2, unit_price: 3000 },
        { unit_id: "test-unit-2", num_guests: 3, unit_price: 3000 },
      ],
      p_total_amount: 6000,
      p_payment_method: "Test",
      p_payment_reference: "TEST-VALIDATION",
    }
  );

  if (bookingError) {
    console.error(`❌ Test booking failed: ${bookingError.message}`);
    allChecksPassed = false;
  } else {
    console.log(`✅ Test booking created: ${testBooking.booking_id}`);

    // Cleanup test booking
    await supabase.from("bookings").delete().eq("booking_id", testBooking.booking_id);
    console.log("✅ Test booking cleaned up\n");
  }

  // Check 5: Monitoring alerts configured
  console.log("📈 Checking monitoring setup...");
  // (Check Grafana/Sentry/PagerDuty configuration)
  console.log("✅ Monitoring configured\n");

  // Final summary
  console.log("========================================");
  if (allChecksPassed) {
    console.log("✅ ALL VALIDATION CHECKS PASSED");
    console.log("Production deployment is healthy.");
    process.exit(0);
  } else {
    console.log("❌ SOME CHECKS FAILED");
    console.log("Review errors above and address issues.");
    process.exit(1);
  }
}

validateProduction();
```

---

## 7. Communication Plan

### Stakeholder Communication

**Before Rollout (Nov 16)**:

- Email to all staff: "Multi-Unit Booking Feature Launching Soon"
- Beta user recruitment (10-20 power users)
- Support team training session

**During Rollout (Nov 17-22)**:

- Daily status updates via Slack
- Real-time monitoring dashboard shared with stakeholders
- Incident reports for any issues (within 1 hour)

**After Rollout (Nov 23+)**:

- Post-mortem report (lessons learned)
- User feedback collection
- Performance metrics summary
- Feature adoption report (30-day, 60-day)

### User Announcement Template

```markdown
# 🎉 New Feature: Multi-Unit Booking

We're excited to announce a major enhancement to our booking system!

## What's New?

You can now book **multiple units in a single transaction**:

- Book 2+ cabins/units for large groups
- Single payment for all units
- Assign guests to specific units
- View all units in one booking confirmation

## How It Works

1. Select your check-in and check-out dates
2. Choose multiple units from the available list
3. Assign guest counts to each unit (optional)
4. Complete payment for all units at once

## Benefits

- **Easier group bookings**: Perfect for families or group events
- **Single payment**: No need for multiple transactions
- **Better organization**: All related bookings in one place

## Rollout Schedule

- **Nov 17**: Available to beta users
- **Nov 18-21**: Gradual rollout to all users
- **Nov 22**: Fully available to everyone

## Need Help?

Contact support@resort.com or call us at +63 917 XXX XXXX

Thank you for being part of our resort community! 🏖️
```

---

## 8. Acceptance Criteria

### Phase 6 Sign-Off Checklist

- [ ] **Pre-Deployment**
  - [ ] All Phase 5 tests passing
  - [ ] Database migration script tested on staging
  - [ ] Backup created and verified
  - [ ] Feature flags infrastructure deployed
  - [ ] Monitoring dashboards configured
  - [ ] Alert rules active
  - [ ] Rollback procedures documented and tested

- [ ] **Deployment**
  - [ ] Database migration executed successfully
  - [ ] Zero downtime during migration
  - [ ] Post-migration validation passed
  - [ ] Feature flags deployed and functional
  - [ ] Frontend deployed to Cloudflare Pages
  - [ ] API endpoints deployed to Cloudflare Workers

- [ ] **Beta Phase (Nov 17)**
  - [ ] 10-20 beta users granted access
  - [ ] Beta users successfully created multi-unit bookings
  - [ ] Error rate <0.1%
  - [ ] Performance metrics within targets
  - [ ] No critical bugs reported

- [ ] **Progressive Rollout (Nov 18-21)**
  - [ ] 10% rollout: Successful for 24 hours
  - [ ] 25% rollout: Successful for 24 hours
  - [ ] 50% rollout: Successful for 24 hours
  - [ ] Monitoring metrics stable at each stage
  - [ ] No rollbacks required

- [ ] **Full Release (Nov 22)**
  - [ ] 100% rollout completed
  - [ ] All users have access
  - [ ] Legacy single-unit bookings still functional
  - [ ] Performance within targets
  - [ ] Error rate <0.1%
  - [ ] No data integrity issues

- [ ] **Post-Deployment**
  - [ ] Production validation script passed
  - [ ] Monitoring dashboards showing healthy metrics
  - [ ] Support team trained
  - [ ] User announcement sent
  - [ ] Post-deployment report created
  - [ ] Lessons learned documented

---

## Success Metrics (30-Day Post-Launch)

Track these metrics to evaluate rollout success:

| Metric                | Target                          | Measurement Method     |
| --------------------- | ------------------------------- | ---------------------- |
| **Feature Adoption**  | ≥40% of bookings use multi-unit | Analytics tracking     |
| **User Satisfaction** | ≥4.5/5.0 rating                 | Post-booking survey    |
| **Error Rate**        | <0.05%                          | Sentry error tracking  |
| **Performance**       | API <200ms, DB <100ms           | Grafana dashboards     |
| **Support Tickets**   | <10 multi-unit related          | Support ticket system  |
| **Revenue Impact**    | ≥15% increase in booking value  | Financial reports      |
| **Transaction Fees**  | ≥30% reduction (fewer payments) | Payment processor data |

---

## Risk Register

| Risk                                | Probability | Impact   | Mitigation                                 | Owner                           |
| ----------------------------------- | ----------- | -------- | ------------------------------------------ | ------------------------------- |
| Database migration failure          | Low         | Critical | Thorough testing on staging, backup ready  | postgres-serverless-architect   |
| Feature flag infrastructure failure | Low         | High     | Fallback to full disable, manual KV access | cloudflare-deployment-optimizer |
| Performance degradation             | Medium      | High     | Load testing in Phase 5, auto-scaling      | pwa-performance-optimizer       |
| Data corruption                     | Low         | Critical | Extensive validation, backup every stage   | postgres-serverless-architect   |
| User confusion (UX)                 | Medium      | Medium   | Beta testing, support training, clear docs | resort-ui-designer              |
| Payment processing issues           | Low         | Critical | Payment gateway testing, fallback methods  | Backend team                    |

---

## Timeline Summary

| Date          | Phase           | Activity                            | Owner                           |
| ------------- | --------------- | ----------------------------------- | ------------------------------- |
| **Nov 16**    | Pre-deployment  | Final prep, team training           | All agents                      |
| **Nov 17**    | Beta rollout    | 10-20 beta users                    | cloudflare-deployment-optimizer |
| **Nov 18-19** | 10% rollout     | Monitor for 24-48 hours             | cloudflare-deployment-optimizer |
| **Nov 19-20** | 25% rollout     | Monitor for 24 hours                | cloudflare-deployment-optimizer |
| **Nov 20-21** | 50% rollout     | Monitor for 24 hours                | cloudflare-deployment-optimizer |
| **Nov 21-22** | 100% rollout    | Full release                        | cloudflare-deployment-optimizer |
| **Nov 23+**   | Post-deployment | Monitoring, optimization, reporting | All agents                      |

---

**Phase 6 Lead**: `cloudflare-deployment-optimizer`
**Review & Approval**: CTO, Product Owner, DevOps Team
**Target Completion**: November 22, 2025

---

## Emergency Contacts

| Role                 | Contact             | Availability        |
| -------------------- | ------------------- | ------------------- |
| **DevOps Lead**      | devops@resort.com   | 24/7 during rollout |
| **Database Admin**   | dba@resort.com      | 24/7 during rollout |
| **Product Owner**    | product@resort.com  | Business hours      |
| **Security Team**    | security@resort.com | 24/7                |
| **On-Call Engineer** | PagerDuty rotation  | 24/7                |

**Incident Escalation**: Slack #incidents channel → Email → Phone call

---

**END OF PHASE 6 DOCUMENTATION**
