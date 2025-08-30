# Phase 3: Booking System TDD Implementation

> **📊 Status**: ⏳ Pending | **Tests**: 0/250 | **Coverage**: 0%  
> **📍 Source of Truth**: [Master Verification Index](../MASTER_VERIFICATION_INDEX.md#phase-3-booking-system)

## Overview

Phase 3 implements a comprehensive booking management system for the Okaeri Resort System using Test-Driven Development (TDD). This phase focuses on calendar visualization, availability checking, conflict detection, and CRUD operations with multi-tenant database architecture optimized for Neon PostgreSQL.

## Phase Objectives

### Primary Goals
- Implement visual calendar interface with real-time availability
- Create robust booking CRUD operations with conflict detection
- Design multi-tenant database schema with project isolation
- Optimize for serverless deployment with connection pooling
- Ensure Philippine business compliance (BIR, tax receipts)

### Technical Requirements
- **Database**: Neon PostgreSQL with PgBouncer pooling
- **Architecture**: Schema-isolated multi-tenancy
- **Testing**: Comprehensive test coverage (>90%)
- **Performance**: Sub-100ms query response times
- **Compliance**: Philippine tax and receipt requirements

## Database Architecture

### RLS Multi-Tenant Design

```sql
-- Single Schema with RLS (Row-Level Security)
-- All tables in public schema with project_id column
public.projects
public.users
public.user_project_roles
public.audit_logs

-- Booking tables with project_id for tenant isolation
public.bookings (project_id UUID NOT NULL)
public.booking_guests (project_id UUID NOT NULL)
public.booking_payments (project_id UUID NOT NULL)
public.rooms (project_id UUID NOT NULL)
public.room_types (project_id UUID NOT NULL)
public.availability_rules (project_id UUID NOT NULL)
public.booking_status_history (project_id UUID NOT NULL)

-- RLS policies enforce project isolation
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_isolation ON bookings
  USING (project_id = current_setting('app.current_project')::uuid);
```

### Connection Strategy with RLS Context

```typescript
// Connection pooling with transaction-scoped RLS context
const poolConfig = {
  max: 8,               // Optimized for Neon free tier
  min: 1,               // Minimal idle connections
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 3000,
  statement_timeout: 30000,
  query_timeout: 30000
};

// Always use transaction-scoped context for RLS
export async function executeWithProjectContext<T>(
  projectId: string,
  userId: string,
  operation: () => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    // SET LOCAL ensures context doesn't bleed between connections
    await tx.execute(sql`SELECT set_config('app.current_project', ${projectId}, true)`);
    await tx.execute(sql`SELECT set_config('app.current_user', ${userId}, true)`);
    return await operation();
  });
}
```

## Implementation Timeline

### Sub-Phases

1. **3.1 Test Calendar Component** (2 days)
   - Calendar UI component tests
   - Date selection and navigation tests
   - Availability display tests

2. **3.2 Test Availability Logic** (3 days)
   - Availability checking algorithm tests
   - Conflict detection tests
   - Booking rules validation tests

3. **3.3 Implement Booking System** (4 days)
   - Minimal passing implementation
   - Basic CRUD operations
   - Calendar integration

4. **3.4 Database Integration** (3 days)
   - Query optimization
   - Index creation
   - Connection pooling setup

5. **3.5 Verification & Handoff** (1 day)
   - Performance testing
   - Documentation completion
   - Agent handoff

## Key Features

### Calendar Visualization
- Monthly/weekly/daily views
- Color-coded availability status
- Interactive date selection
- Booking preview on hover
- Mobile-responsive design

### Booking Management
```typescript
interface Booking {
  id: string;
  projectId: string;  // Required for RLS tenant isolation
  roomId: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  status: 'pending' | 'confirmed' | 'cancelled';
  totalAmount: Decimal;
  paidAmount: Decimal;
  paymentMethod: 'cash' | 'gcash' | 'bank_transfer';
  specialRequests?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Availability Checking with RLS
```sql
-- Efficient availability query with RLS context
WITH availability_windows AS (
  SELECT 
    room_id,
    date_range,
    COUNT(*) OVER (
      PARTITION BY room_id 
      ORDER BY check_in 
      RANGE BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING
    ) as conflicts
  FROM bookings  -- RLS automatically filters by current project
  WHERE status != 'cancelled'
    AND project_id = current_setting('app.current_project')::uuid  -- Explicit for query planner
    AND daterange(check_in, check_out) && daterange($1, $2)
)
SELECT * FROM availability_windows WHERE conflicts = 0;
```

## Testing Strategy

### Test Categories

1. **Unit Tests**
   - Component rendering
   - Date utilities
   - Validation functions
   - Business logic

2. **Integration Tests**
   - Database transactions
   - API endpoints
   - Calendar interactions
   - Payment processing

3. **E2E Tests**
   - Complete booking flow
   - Conflict scenarios
   - Payment confirmation
   - Receipt generation

### Test Database Setup with RLS

```sql
-- Test project setup with RLS
INSERT INTO projects (id, name, slug, is_active)
VALUES ('test-project-001'::uuid, 'Test Resort', 'test-resort', true);

-- Test data fixtures with project_id
BEGIN;
  -- Set context for test project
  SELECT set_config('app.current_project', 'test-project-001', true);
  SELECT set_config('app.current_user', 'test-user-001', true);
  
  -- Insert test rooms with project_id
  INSERT INTO rooms (id, project_id, name, type_id, capacity)
  VALUES 
    ('room-1'::uuid, 'test-project-001'::uuid, 'Deluxe Suite A', 'type-deluxe'::uuid, 4),
    ('room-2'::uuid, 'test-project-001'::uuid, 'Standard Room B', 'type-standard'::uuid, 2);
COMMIT;
```

## Performance Optimization

### Database Indexes for RLS Performance

```sql
-- Composite indexes with project_id for RLS performance
CREATE INDEX CONCURRENTLY idx_bookings_project_date_range 
  ON bookings(project_id) 
  INCLUDE (room_id, check_in, check_out)
  WHERE status != 'cancelled';

CREATE INDEX CONCURRENTLY idx_bookings_project_status 
  ON bookings(project_id, status)
  WHERE status != 'cancelled';

CREATE INDEX CONCURRENTLY idx_bookings_project_room_dates 
  ON bookings(project_id, room_id, check_in, check_out);

-- GiST index for date range queries
CREATE INDEX CONCURRENTLY idx_bookings_date_range_gist
  ON bookings USING GIST (project_id, daterange(check_in, check_out));
```

### Query Optimization

```typescript
// Batched availability check with RLS context
const checkBulkAvailability = async (
  projectId: string,
  userId: string,
  roomIds: string[],
  dateRange: DateRange
): Promise<AvailabilityMap> => {
  return await executeWithProjectContext(projectId, userId, async () => {
    const query = `
      SELECT 
        r.id as room_id,
        COALESCE(
          array_agg(
            jsonb_build_object(
              'date', d.date,
              'available', NOT EXISTS (
                SELECT 1 FROM bookings b
                WHERE b.room_id = r.id
                  AND b.project_id = $4::uuid  -- Explicit for query planner
                  AND b.status != 'cancelled'
                  AND d.date BETWEEN b.check_in AND b.check_out - INTERVAL '1 day'
              )
            ) ORDER BY d.date
          ),
          '{}'::jsonb[]
        ) as availability
      FROM rooms r
      CROSS JOIN generate_series($1::date, $2::date, '1 day'::interval) d(date)
      WHERE r.id = ANY($3::uuid[])
        AND r.project_id = $4::uuid  -- Explicit project filter
      GROUP BY r.id
    `;
    
    return await db.query(query, [dateRange.start, dateRange.end, roomIds, projectId]);
  });
};
```

## Philippine Business Requirements

### Tax Compliance

```typescript
interface PhilippineBookingCompliance {
  // BIR-required fields
  orNumber: string;        // Official Receipt number
  tinNumber?: string;      // Tax Identification Number
  vatAmount: Decimal;      // 12% VAT
  vatExempt: boolean;
  seniorPwdDiscount?: {
    type: 'senior' | 'pwd';
    idNumber: string;
    discountAmount: Decimal;
  };
}
```

### Receipt Generation with RLS

```sql
-- Receipt tracking table with project isolation
CREATE TABLE booking_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  booking_id UUID REFERENCES bookings(id),
  or_number VARCHAR(50) NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  vat_amount DECIMAL(12,2),
  total_amount DECIMAL(12,2),
  payment_method VARCHAR(50),
  metadata JSONB,
  -- Composite unique constraint per project
  CONSTRAINT unique_or_number_per_project UNIQUE(project_id, or_number)
);

-- Enable RLS
ALTER TABLE booking_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_isolation ON booking_receipts
  USING (project_id = current_setting('app.current_project')::uuid);

-- Index for performance
CREATE INDEX idx_booking_receipts_project ON booking_receipts(project_id);
```

## Security Considerations

### Data Isolation with RLS Policies

```sql
-- Comprehensive RLS policies for all operations
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;

-- SELECT: Can only see bookings from current project
CREATE POLICY project_isolation_select ON bookings
  FOR SELECT
  USING (project_id = current_setting('app.current_project')::uuid);

-- INSERT: Can only insert with current project_id
CREATE POLICY project_isolation_insert ON bookings
  FOR INSERT
  WITH CHECK (project_id = current_setting('app.current_project')::uuid);

-- UPDATE: Can only update current project's bookings
CREATE POLICY project_isolation_update ON bookings
  FOR UPDATE
  USING (project_id = current_setting('app.current_project')::uuid)
  WITH CHECK (project_id = current_setting('app.current_project')::uuid);

-- DELETE: Can only delete from current project
CREATE POLICY project_isolation_delete ON bookings
  FOR DELETE
  USING (project_id = current_setting('app.current_project')::uuid);
```

### Audit Trail with RLS

```sql
-- Comprehensive audit logging with proper isolation
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  user_id UUID,
  action VARCHAR(50),
  table_name VARCHAR(100),
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- Audit logs visible only to project members
CREATE POLICY project_audit_isolation ON audit_logs
  FOR SELECT
  USING (project_id = current_setting('app.current_project')::uuid);

-- Index for performance
CREATE INDEX idx_audit_logs_project_created 
  ON audit_logs(project_id, created_at DESC);
```

## Agent Responsibilities

### Lead Agent: PostgreSQL Database Architect
- Design and optimize database schemas
- Create efficient queries and indexes
- Implement connection pooling strategies
- Ensure data integrity and constraints

### Supporting Agents
- **Frontend Developer**: Calendar UI implementation
- **Backend Developer**: API endpoints and business logic
- **QA Engineer**: Test creation and validation
- **DevOps Engineer**: Deployment and monitoring

## Success Metrics

### Performance Targets
- Calendar load time: <500ms
- Availability check: <100ms
- Booking creation: <200ms
- Database connection time: <50ms

### Quality Metrics
- Test coverage: >90%
- Zero data inconsistencies
- 100% transaction atomicity
- Full audit trail coverage

## Deliverables

1. **Database Schema**
   - Complete DDL scripts
   - Migration files
   - Seed data scripts

2. **Test Suite**
   - Unit tests (>200)
   - Integration tests (>50)
   - E2E tests (>20)

3. **Implementation Code**
   - Calendar components
   - Booking services
   - API endpoints
   - Database queries

4. **Documentation**
   - API documentation
   - Database ERD
   - Query optimization guide
   - Deployment instructions

## Risk Mitigation

### Technical Risks
- **Connection exhaustion**: Implement aggressive pooling and timeout strategies
- **Race conditions**: Use database-level locking and transactions
- **Data inconsistency**: Enforce foreign key constraints and triggers
- **Performance degradation**: Monitor query performance and add indexes proactively

### Business Risks
- **Compliance violations**: Regular audit of tax calculations
- **Overbooking**: Implement pessimistic locking for critical sections
- **Data loss**: Regular automated backups with point-in-time recovery

## Next Steps

1. Review and approve technical design
2. Set up test database environments
3. Begin with Sub-phase 3.1: Test Calendar Component
4. Establish CI/CD pipeline for automated testing
5. Configure monitoring and alerting

## References

- [Neon PostgreSQL Documentation](https://neon.tech/docs)
- [PgBouncer Configuration Guide](https://www.pgbouncer.org/config.html)
- [Philippine BIR Requirements](https://www.bir.gov.ph)
- [TDD Best Practices](https://martinfowler.com/bliki/TestDrivenDevelopment.html)