# 🔍 Okaeri Resort System - Audit Logging Master Plan

**Version:** 1.0.0  
**Status:** Planning  
**Target Completion:** 4-6 weeks  
**Estimated Effort:** 40-50 hours

---

## 📋 Executive Summary

This master plan outlines the implementation of a comprehensive audit logging system combining **database-level triggers** (automatic, failsafe) with **application-level context enrichment** (rich metadata, business logic). The system will provide complete visibility into all data changes while maintaining the project's core constraints: low cost, high reliability, and ease of maintenance.

### Key Objectives

1. **Automatic audit trail** for all database operations (INSERT, UPDATE, DELETE)
2. **Rich contextual logging** for critical business operations
3. **Admin-friendly audit viewer** with filtering and diff visualization
4. **Zero-cost implementation** within Supabase free tier
5. **Production-ready security** with RLS and retention policies

---

## 🏗️ Architecture Overview

### Dual-Layer Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT APPLICATION                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  React Components (Bookings, Units, Expenses, etc.)   │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────▼─────────────────────────────────┐ │
│  │         Application Audit Layer (Layer 2)              │ │
│  │  • auditedOperation() wrapper                          │ │
│  │  • logAuditEvent() for auth/business events            │ │
│  │  • React hooks for audit log viewing                   │ │
│  └──────────────────────┬─────────────────────────────────┘ │
└─────────────────────────┼─────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE (PostgreSQL)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Database Audit Layer (Layer 1)               │ │
│  │  • PostgreSQL triggers on all tables                   │ │
│  │  • Automatic change capture (old/new data)             │ │
│  │  • User context from auth.uid()                        │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────▼─────────────────────────────────┐ │
│  │              audit_logs Table                          │ │
│  │  • Merged data from both layers                        │ │
│  │  • Indexed for fast querying                           │ │
│  │  • Protected with RLS policies                         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Action** → React component
2. **Application Layer** → Captures business context (optional for critical operations)
3. **Supabase Client** → Executes database operation
4. **Database Trigger** → Automatically logs change details
5. **Audit Log** → Stored with combined context from both layers

---

## 🎯 Implementation Phases

### Phase 1: Database Foundation (Week 1)

**Effort:** 8-10 hours  
**Status:** Not Started

Build the automatic audit trail infrastructure at the database level.

**Deliverables:**

- ✅ `audit_logs` table schema
- ✅ Generic audit trigger function
- ✅ Triggers on all existing tables
- ✅ Database migration scripts
- ✅ Indexes for performance

**Files Created:**

- `database/migrations/audit-system/001-audit-tables.sql`
- `database/migrations/audit-system/002-audit-triggers.sql`
- `database/migrations/audit-system/003-audit-indexes.sql`

**Documentation:**

- [Phase 1 Detailed Guide](./AUDIT_PHASE_1_DATABASE.md)

---

### Phase 2: Application Layer (Week 2-3)

**Effort:** 16-20 hours  
**Status:** Not Started

Build TypeScript utilities for enriched audit logging with business context.

**Deliverables:**

- ✅ TypeScript types and interfaces
- ✅ `auditedOperation()` wrapper for Supabase calls
- ✅ `logAuditEvent()` for standalone events
- ✅ React hooks for audit log queries
- ✅ Integration with existing auth system
- ✅ Unit tests for audit utilities

**Files Created:**

- `src/lib/audit/index.ts`
- `src/lib/audit/types.ts`
- `src/lib/audit/logger.ts`
- `src/lib/audit/wrapper.ts`
- `src/lib/audit/hooks.ts`
- `src/lib/audit/constants.ts`
- `src/__tests__/audit/audit-logger.test.ts`

**Documentation:**

- [Phase 2 Detailed Guide](./AUDIT_PHASE_2_APPLICATION.md)

---

### Phase 3: UI & Visualization (Week 3-4)

**Effort:** 12-16 hours  
**Status:** Not Started

Build admin interface for viewing and analyzing audit logs.

**Deliverables:**

- ✅ Audit logs page with table view
- ✅ Advanced filters (user, table, action, date range)
- ✅ Diff viewer for before/after comparison
- ✅ Timeline visualization
- ✅ Export functionality (CSV)
- ✅ Mobile-responsive design

**Files Created:**

- `src/pages/audit-logs/index.tsx`
- `src/components/audit/AuditLogViewer.tsx`
- `src/components/audit/AuditDiffViewer.tsx`
- `src/components/audit/AuditFilters.tsx`
- `src/components/audit/AuditTimeline.tsx`
- `src/components/audit/AuditExporter.tsx`

**Documentation:**

- [Phase 3 Detailed Guide](./AUDIT_PHASE_3_UI.md)

---

### Phase 4: Security & Optimization (Week 5-6)

**Effort:** 8-10 hours  
**Status:** Not Started

Harden security, implement retention policies, and optimize performance.

**Deliverables:**

- ✅ Row-Level Security (RLS) policies
- ✅ Audit log retention policy (archive old logs)
- ✅ Performance optimization (query tuning)
- ✅ Anomaly detection (suspicious activity alerts)
- ✅ Integration tests
- ✅ Production deployment checklist

**Files Created:**

- `database/migrations/audit-system/004-audit-rls.sql`
- `database/migrations/audit-system/005-audit-retention.sql`
- `src/lib/audit/monitoring.ts`
- `src/__tests__/audit/audit-integration.test.ts`

**Documentation:**

- [Phase 4 Detailed Guide](./AUDIT_PHASE_4_SECURITY.md)

---

## 📊 Schema Overview

### Core Audit Logs Table

```sql
CREATE TABLE audit_logs (
    -- Identity
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- What changed
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),

    -- Who made the change
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    user_role TEXT,

    -- Change details
    old_data JSONB,
    new_data JSONB,
    changed_fields TEXT[],

    -- Application context (Layer 2)
    description TEXT,
    category VARCHAR(50),
    severity VARCHAR(20),
    metadata JSONB,

    -- Client context
    ip_address INET,
    user_agent TEXT,

    -- Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Indexes
    INDEX idx_audit_table_record (table_name, record_id),
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_created (created_at DESC),
    INDEX idx_audit_action (action),
    INDEX idx_audit_category (category)
);
```

### Audit Categories

```typescript
export enum AuditCategory {
  // Authentication
  AUTH_LOGIN = "auth:login",
  AUTH_LOGOUT = "auth:logout",
  AUTH_FAILED = "auth:failed",

  // Bookings
  BOOKING_CREATE = "booking:create",
  BOOKING_UPDATE = "booking:update",
  BOOKING_STATUS = "booking:status",
  BOOKING_CANCEL = "booking:cancel",

  // Payments
  PAYMENT_RECORD = "payment:record",
  PAYMENT_REFUND = "payment:refund",

  // Units
  UNIT_CREATE = "unit:create",
  UNIT_UPDATE = "unit:update",
  UNIT_STATUS = "unit:status",

  // Expenses
  EXPENSE_CREATE = "expense:create",
  EXPENSE_UPDATE = "expense:update",
  EXPENSE_DELETE = "expense:delete",

  // System
  SYSTEM_CONFIG = "system:config",
  SYSTEM_MAINTENANCE = "system:maintenance",
}
```

---

## 🔧 Integration Points

### Existing Code Modifications

1. **Authentication Layer** (`src/lib/auth.ts`)
   - Add audit logging to login/logout
   - Track failed login attempts
   - Log session refresh events

2. **Booking Operations** (`src/pages/bookings/*`)
   - Wrap CRUD operations with `auditedOperation()`
   - Log status changes explicitly
   - Track payment recordings

3. **Unit Management** (`src/pages/units/*`)
   - Audit status changes
   - Log rate modifications

4. **Expense Tracking** (`src/pages/expenses/*`)
   - Log all expense operations
   - Track receipt uploads

5. **Navigation** (`src/layouts/*`)
   - Add "Audit Logs" menu item for owners/managers

---

## 🧪 Testing Strategy

### Unit Tests

- Audit logger functionality
- Audit wrapper operations
- Type validations
- Hook behavior

### Integration Tests

- Database trigger execution
- End-to-end audit flow
- RLS policy enforcement
- Performance under load

### Manual Testing Checklist

- [ ] Create booking → Verify audit log
- [ ] Update booking status → Verify change tracking
- [ ] Delete expense → Verify deletion log
- [ ] Login/logout → Verify auth logs
- [ ] View audit logs as owner → Verify access
- [ ] View audit logs as staff → Verify restricted access
- [ ] Filter audit logs by date range → Verify results
- [ ] Export audit logs to CSV → Verify format

---

## 💰 Cost Analysis

### Storage Estimates

**Assumptions:**

- 50 bookings/month
- 30 expenses/month
- 20 unit updates/month
- Each audit log ≈ 2KB (with JSONB data)

**Monthly Storage:**

```
(50 + 30 + 20) × 2KB = 200KB/month
Annual: 200KB × 12 = 2.4MB/year
```

**Supabase Free Tier:** 500MB database storage  
**Cost:** **$0/month** (well within free tier)

### Query Performance

**Expected Query Volume:**

- Audit log writes: ~100/day = 3,000/month
- Audit log reads: ~20/day = 600/month

**Supabase Free Tier:** Unlimited queries  
**Cost:** **$0/month**

---

## 🚀 Deployment Strategy

### Development Environment

1. Run migrations locally
2. Test triggers on dev database
3. Verify application layer integration

### Staging Environment

1. Deploy to Supabase preview environment
2. Run full integration tests
3. Load testing with realistic data

### Production Deployment

1. Backup existing database
2. Run migrations during low-traffic window
3. Monitor error logs for 24 hours
4. Enable RLS policies after verification

---

## 📈 Success Metrics

### Phase Completion Criteria

**Phase 1:**

- [ ] All tables have audit triggers
- [ ] Sample audit logs generated successfully
- [ ] No performance degradation (<50ms overhead)

**Phase 2:**

- [ ] All critical operations use audit wrappers
- [ ] 100% test coverage for audit utilities
- [ ] Auth events logged correctly

**Phase 3:**

- [ ] Audit logs page accessible to owners/managers
- [ ] Filters and search working
- [ ] Diff viewer shows changes clearly

**Phase 4:**

- [ ] RLS policies prevent unauthorized access
- [ ] Retention policy runs successfully
- [ ] No security vulnerabilities identified

### Long-term KPIs

- **Audit Coverage:** 100% of database changes logged
- **Response Time:** <100ms audit log insertion
- **Query Performance:** <500ms audit log page load
- **Storage Growth:** <10MB/year
- **Zero Cost:** Stays within Supabase free tier

---

## 🛠️ Development Guidelines

### Code Standards

1. **TypeScript Strict Mode:** All audit code must pass strict type checking
2. **Error Handling:** Never fail the main operation due to audit logging
3. **Performance:** Audit operations should be asynchronous and non-blocking
4. **Testing:** Minimum 80% code coverage for audit utilities
5. **Documentation:** All public functions must have JSDoc comments

### File Organization

```
src/lib/audit/
├── index.ts              # Main exports
├── types.ts              # TypeScript definitions
├── logger.ts             # Core logging functions
├── wrapper.ts            # Supabase operation wrapper
├── hooks.ts              # React hooks
├── constants.ts          # Audit categories & severities
└── monitoring.ts         # Anomaly detection

src/components/audit/
├── AuditLogViewer.tsx    # Main table component
├── AuditDiffViewer.tsx   # Before/after diff
├── AuditFilters.tsx      # Filter controls
├── AuditTimeline.tsx     # Timeline visualization
└── AuditExporter.tsx     # Export functionality

database/migrations/audit-system/
├── 001-audit-tables.sql  # Create audit_logs table
├── 002-audit-triggers.sql # Create triggers
├── 003-audit-indexes.sql  # Performance indexes
├── 004-audit-rls.sql      # Security policies
└── 005-audit-retention.sql # Retention policy
```

---

## 🔗 Next Steps

### Immediate Actions

1. **Review this master plan** with team/stakeholders
2. **Read [Phase 1 Guide](./AUDIT_PHASE_1_DATABASE.md)** for database setup
3. **Set up development environment** with local Supabase instance
4. **Create feature branch:** `feature/audit-logging-system`

### Phase Kickoff Checklist

- [ ] Master plan approved
- [ ] Development database ready
- [ ] Feature branch created
- [ ] Phase 1 documentation reviewed
- [ ] Initial migration scripts prepared

---

## 📚 Related Documentation

- [Phase 1: Database Foundation](./AUDIT_PHASE_1_DATABASE.md)
- [Phase 2: Application Layer](./AUDIT_PHASE_2_APPLICATION.md)
- [Phase 3: UI & Visualization](./AUDIT_PHASE_3_UI.md)
- [Phase 4: Security & Optimization](./AUDIT_PHASE_4_SECURITY.md)
- [API Reference](./AUDIT_API_REFERENCE.md)
- [Troubleshooting Guide](./AUDIT_TROUBLESHOOTING.md)

---

## ✅ Sign-off

**Created by:** AI Development Team  
**Date:** October 1, 2025  
**Version:** 1.0.0

**Approved by:**

- [ ] Project Owner
- [ ] Technical Lead
- [ ] Security Reviewer

---

_This audit system will provide the Okaeri Resort System with enterprise-grade change tracking while maintaining the project's core values of simplicity, reliability, and cost-effectiveness._
