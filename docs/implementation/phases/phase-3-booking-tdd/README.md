# Phase 3: Staff Booking Management System TDD Implementation

⚠️ **LEGACY WARNING - SCOPE CONFIRMATION** ⚠️
This document correctly identifies INTERNAL USE ONLY scope but may contain 
outdated references to capabilities that exceed internal tracking requirements.

**CONFIRMED SCOPE LIMITATIONS:**
- ✅ INTERNAL staff booking management only
- ✅ NO customer-facing features  
- ❌ NO payment processing (tracking status only)
- ❌ NO compliance requirements (internal tracking only)

> ⚠️ **INTERNAL USE ONLY** - All bookings are entered and managed by resort staff. No customer self-service.

> **📊 Status**: ✅ Complete | **Components**: 3/3 | **Coverage**: 100%  
> **📍 Source of Truth**: [Master Verification Index](../MASTER_VERIFICATION_INDEX.md#phase-3-booking-system)
> **🎆 Implementation**: React 19 concurrent features with adaptive performance

## 📦 RUNTIME SCOPE FOR PHASE 3 TDD

```
IMPORTANT: Database Scope Clarification
----------------------------------------
✅ IN SCOPE:
- Testing: Use mocked database interactions (no real DB connections in tests)
- Implementation: Application-level tenant isolation (project_id filtering)
- Authority: Follow SIMPLE_DATABASE_GUIDE.md for all database patterns
- Query Pattern: Simple WHERE project_id = ? clauses on all queries

❌ NOT IN SCOPE (Reference Only):
- Row Level Security (RLS) - NOT implemented in Phase 3
- Advanced connection pooling configurations
- NEON_CONNECTION_POOLING.md - reference only for future optimization
- Complex database optimizations - post-MVP concern

📚 Authoritative Guide: docs/implementation/SIMPLE_DATABASE_GUIDE.md
```

## Overview

Phase 3 has successfully implemented a comprehensive staff-operated booking management system for the Okaeri Resort System. The implementation features a modern React 19 calendar for staff to manage bookings manually entered from phone calls, walk-ins, and partner channels.

**SCOPE CLARIFICATION**:
- ✅ Staff booking entry interface
- ✅ Manual booking management (create/edit/cancel)
- ✅ Room availability tracking
- ✅ Payment status tracking (NOT processing)
- ❌ ~~Customer self-booking~~ (NOT APPLICABLE - Internal use only)
- ❌ ~~Online booking portal~~ (NOT APPLICABLE - Internal use only)
- ❌ ~~Payment processing~~ (NOT APPLICABLE - Track status only)

## Phase Objectives

### Primary Goals ✅ ACHIEVED
- ✅ Implemented visual calendar interface with real-time availability display
- ✅ Created BookingCalendar, CalendarNavigation, and CalendarGrid components
- ✅ Designed with application-level tenant isolation using project_id filtering
- ✅ Implemented React 19 concurrent features for optimal performance
- ✅ Ensured Philippine locale support and timezone handling

### Technical Requirements
- **Database**: Simple application-level filtering (no RLS)
- **Architecture**: Tenant isolation via project_id column filtering
- **Testing**: Comprehensive test coverage (>90%) with mocked DB interactions
- **Performance**: Sub-100ms query response times
- **~~Compliance~~**: ~~Philippine tax and receipt requirements~~ (NOT APPLICABLE - Internal tracking only)

⚠️ **SCOPE LIMITATION:** All features described below are for INTERNAL staff operations only.

## Database Architecture

### Application-Level Tenant Isolation Design

```sql
-- Single public schema with application-level filtering
-- All tables include project_id column for tenant isolation
public.projects
public.users
public.user_project_roles
public.audit_logs

-- Booking tables with project_id for application-level tenant isolation
public.bookings (project_id UUID NOT NULL)
public.booking_guests (project_id UUID NOT NULL)
public.booking_payments (project_id UUID NOT NULL)
public.rooms (project_id UUID NOT NULL)
public.room_types (project_id UUID NOT NULL)
public.availability_rules (project_id UUID NOT NULL)
public.booking_status_history (project_id UUID NOT NULL)

-- Foreign key constraints ensure referential integrity
ALTER TABLE bookings ADD CONSTRAINT fk_bookings_project 
  FOREIGN KEY (project_id) REFERENCES projects(id);
```

### Application-Level Access Control Implementation

```typescript
// IMPORTANT: Connection pooling configuration shown here is REFERENCE ONLY
// Phase 3 uses simple database connections per SIMPLE_DATABASE_GUIDE.md
// Advanced pooling is a post-MVP optimization

// Service layer ensures all queries include project_id filtering
export class BookingService {
  // CRITICAL: Always validate project access before operations
  private async validateProjectAccess(userId: string, projectId: string): Promise<void> {
    const hasAccess = await db
      .select()
      .from(userProjectRoles)
      .where(
        and(
          eq(userProjectRoles.userId, userId),
          eq(userProjectRoles.projectId, projectId)
        )
      )
      .limit(1);
    
    if (!hasAccess.length) {
      throw new ForbiddenError('No access to project');
    }
  }

  // All queries MUST include explicit project_id filtering
  async getBookings(userId: string, projectId: string): Promise<Booking[]> {
    await this.validateProjectAccess(userId, projectId);
    
    return await db
      .select()
      .from(bookings)
      .where(eq(bookings.projectId, projectId)); // CRITICAL: Always filter by project_id
  }
}
```

## Pre-Implementation Setup

Before starting Phase 3 implementation, run the scaffold script to create the necessary directory structure:

> 📚 **See Also**: [Scaffold Scripts Reference](../../SCAFFOLD_SCRIPTS_REFERENCE.md) | [Composite Scripts Guide](../../COMPOSITE_SCRIPTS_GUIDE.md) | [Database Security Patterns](../../DATABASE_SECURITY_PATTERNS.md)

```bash
# Run the scaffold script for Phase 3
npm run scaffold:phase3

# This will:
# 1. Display the path to this documentation
# 2. Create all necessary directories:
#    - src/features/booking/components/
#    - src/features/booking/hooks/
#    - src/features/booking/stores/
#    - src/features/booking/types/
#    - src/features/booking/__tests__/
# 3. Add .gitkeep files to preserve empty directories
```

## NPM Scripts

### Phase 3 Specific Commands

```json
{
  "scripts": {
    // Scaffolding - Get booking system test specifications
    "scaffold:phase3": "echo 'Phase 3: Booking - See docs/implementation/phases/phase-3-booking-tdd/README.md' && npm run scaffold:phase3:dirs",
    "scaffold:phase3:dirs": "mkdir -p src/features/booking/{components,hooks,stores,types,__tests__} && touch src/features/booking/__tests__/.gitkeep",
    
    // Testing - Run Phase 3 booking tests
    "test:phase3": "vitest run src/features/booking/**/__tests__/*.test.{ts,tsx}",
    "test:phase3:coverage": "vitest run --coverage src/features/booking/**/__tests__/*.test.{ts,tsx}",
    "test:phase3:watch": "vitest watch src/features/booking/**/__tests__/*.test.{ts,tsx}"
  }
}
```

### TDD Workflow Commands

```bash
# RED Phase - Write failing tests
npm run scaffold:phase3           # Get booking test specifications
npm run test:phase3               # Run tests (should fail initially)

# GREEN Phase - Implement until tests pass
npm run test:phase3:watch         # Watch mode for rapid development
npm run test:phase3               # Verify all tests pass

# REFACTOR Phase - Optimize and improve
npm run test:phase3:coverage      # Check coverage meets 95% requirement

# Database testing
npm run test:db:booking           # Test database operations
npm run test:db:availability      # Test availability queries

# Integration with previous phases
npm run test:phase1 && npm run test:phase2 && npm run test:phase3
```

### Coverage Requirements

- **Minimum Coverage**: 95% (critical booking operations)
- **Calendar Component**: 90% coverage required
- **Availability Logic**: 95% coverage required (business critical)
- **Payment Processing**: 95% coverage required (financial critical)
- **Database Operations**: 90% coverage with transaction tests

### Common Phase 3 Testing Issues

| Issue | Solution |
|-------|---------|
| Tests not found | Ensure tests are in `src/features/booking/**/__tests__/` |
| Coverage below 95% | Add tests for edge cases in availability logic |
| Calendar tests failing | Mock date/time properly with fixed timestamps |
| Database tests failing | Use transaction rollback for test isolation |
| Conflict detection issues | Test overlapping booking scenarios thoroughly |
| Missing project_id filter | Ensure all queries include WHERE project_id clause |

### Performance Testing

```bash
# Run performance benchmarks for booking operations
npm run bench:booking              # Benchmark booking creation
npm run bench:availability         # Benchmark availability queries
npm run bench:calendar             # Benchmark calendar rendering

# Expected performance targets
# - Booking creation: <100ms
# - Availability check: <50ms
# - Calendar month load: <200ms
```

## Implementation Timeline ✅ COMPLETE

### Completed Components

1. **BookingCalendar Component** ✅
   - Main calendar with month/week/day views
   - Date and range selection support
   - Availability data integration
   - React 19 useTransition for smooth navigation
   - Suspense boundaries with skeleton loaders

2. **CalendarNavigation Component** ✅
   - Previous/Next month navigation
   - Month/Year dropdown selectors
   - Today button functionality
   - View mode toggles (month/week/day)
   - Keyboard shortcuts (Ctrl+Arrow, Ctrl+T)
   - Mobile haptic feedback

3. **CalendarGrid Component** ✅
   - Calendar day grid layout
   - Availability indicators (green/yellow/red dots)
   - Date click handlers
   - Philippine locale support
   - useDeferredValue for availability data

4. **Performance Optimizations** ✅
   - Removed 300ms artificial debouncing
   - Implemented React 19 concurrent features
   - 60fps adaptive performance
   - No limits for powerful devices
   - Graceful degradation for slower devices

5. **Verification & Testing** ✅
   - Test route at `/test-booking` working
   - Calendar displays with proper grid
   - Date selection triggers events
   - Availability indicators functional
   - No console errors or warnings

## Key Features ✅ IMPLEMENTED

### Calendar Visualization
- ✅ Monthly view fully functional (week/day views scaffolded)
- ✅ Color-coded availability status (green/yellow/red/purple indicators)
- ✅ Interactive date selection with alerts and console logging
- ✅ Range selection support for multi-day bookings
- ✅ Mobile-responsive design with touch support
- ✅ Accessibility features (ARIA labels, keyboard navigation)

### Booking Management
```typescript
interface Booking {
  id: string;
  projectId: string;  // Required for application-level tenant isolation
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

### Availability Checking with Tenant Isolation
```typescript
// Application-level tenant isolation using project_id filtering
async function checkAvailability(
  projectId: string,
  roomId: string,
  checkIn: Date,
  checkOut: Date
): Promise<boolean> {
  const conflicts = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.projectId, projectId), // CRITICAL: Always filter by project
        eq(bookings.roomId, roomId),
        ne(bookings.status, 'cancelled'),
        or(
          // Check-in date falls within existing booking
          and(
            lte(bookings.checkIn, checkIn),
            gt(bookings.checkOut, checkIn)
          ),
          // Check-out date falls within existing booking
          and(
            lt(bookings.checkIn, checkOut),
            gte(bookings.checkOut, checkOut)
          ),
          // New booking completely encompasses existing booking
          and(
            gte(bookings.checkIn, checkIn),
            lte(bookings.checkOut, checkOut)
          )
        )
      )
    )
    .limit(1);
  
  return conflicts.length === 0;
}
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

### Test Database Setup with Tenant Isolation

```typescript
// IMPORTANT: For Phase 3 TDD, use mocked database interactions
// The code below shows the pattern but tests should use mocks, not real DB
// Test fixtures with application-level tenant isolation (for reference)
export async function setupTestProject() {
  const testProjectId = 'test-project-001';
  const testUserId = 'test-user-001';
  
  // Create test project
  await db.insert(projects).values({
    id: testProjectId,
    name: 'Test Resort',
    slug: 'test-resort',
    isActive: true
  });
  
  // Create test user with project access
  await db.insert(userProjectRoles).values({
    userId: testUserId,
    projectId: testProjectId,
    role: 'admin'
  });
  
  // Insert test rooms - ALWAYS include project_id
  await db.insert(rooms).values([
    {
      id: 'room-1',
      projectId: testProjectId, // CRITICAL: Always set project_id
      name: 'Deluxe Suite A',
      typeId: 'type-deluxe',
      capacity: 4
    },
    {
      id: 'room-2',
      projectId: testProjectId, // CRITICAL: Always set project_id
      name: 'Standard Room B',
      typeId: 'type-standard',
      capacity: 2
    }
  ]);
}
```

## Performance Optimization

> **Note**: The optimizations below are for REFERENCE ONLY. Phase 3 focuses on functionality with simple queries. Performance optimization is a post-MVP concern.

### Database Indexes for Tenant-Isolated Queries (Future Reference)

```sql
-- Composite indexes with project_id as leading column for efficient tenant filtering
CREATE INDEX CONCURRENTLY idx_bookings_project_date_range 
  ON bookings(project_id, room_id, check_in, check_out)
  WHERE status != 'cancelled';

CREATE INDEX CONCURRENTLY idx_bookings_project_status 
  ON bookings(project_id, status)
  WHERE status != 'cancelled';

CREATE INDEX CONCURRENTLY idx_bookings_project_room_dates 
  ON bookings(project_id, room_id, check_in, check_out);

-- GiST index for date range queries (project_id first for partition pruning)
CREATE INDEX CONCURRENTLY idx_bookings_date_range_gist
  ON bookings USING GIST (daterange(check_in, check_out))
  WHERE project_id IS NOT NULL;

-- Ensure project_id is always indexed as the leading column
CREATE INDEX CONCURRENTLY idx_bookings_project_id ON bookings(project_id);
```

### Query Optimization (Future Reference)

```typescript
// NOTE: Advanced query optimization is POST-MVP. Phase 3 uses simple queries.
// Batched availability check with tenant isolation (reference pattern)
export class AvailabilityService {
  constructor(private bookingService: BookingService) {}

  async checkBulkAvailability(
    userId: string,
    projectId: string,
    roomIds: string[],
    dateRange: { start: Date; end: Date }
  ): Promise<Map<string, DayAvailability[]>> {
    // Validate access first
    await this.bookingService.validateProjectAccess(userId, projectId);
    
    // Query with explicit project_id filtering using Drizzle ORM
    const bookings = await db
      .select({
        roomId: bookings.roomId,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.projectId, projectId), // CRITICAL: Always filter by project
          inArray(bookings.roomId, roomIds),
          ne(bookings.status, 'cancelled'),
          or(
            and(
              lte(bookings.checkIn, dateRange.end),
              gte(bookings.checkOut, dateRange.start)
            )
          )
        )
      );
    
    // Process availability in application layer
    return this.processAvailability(roomIds, dateRange, bookings);
  }
  
  private processAvailability(
    roomIds: string[],
    dateRange: { start: Date; end: Date },
    bookings: Array<{ roomId: string; checkIn: Date; checkOut: Date }>
  ): Map<string, DayAvailability[]> {
    const availabilityMap = new Map<string, DayAvailability[]>();
    
    for (const roomId of roomIds) {
      const roomBookings = bookings.filter(b => b.roomId === roomId);
      const days: DayAvailability[] = [];
      
      for (let date = new Date(dateRange.start); date <= dateRange.end; date.setDate(date.getDate() + 1)) {
        const isAvailable = !roomBookings.some(booking => 
          date >= booking.checkIn && date < booking.checkOut
        );
        
        days.push({
          date: new Date(date),
          available: isAvailable
        });
      }
      
      availabilityMap.set(roomId, days);
    }
    
    return availabilityMap;
  }
}
```

## Internal Tracking Requirements (NO COMPLIANCE)

⚠️ **NO LEGAL COMPLIANCE:** System provides internal tracking only.

### Internal Balance Calculations (REFERENCE ONLY)

```typescript
interface InternalBookingTracking {
  // Internal tracking fields (NO LEGAL COMPLIANCE)
  receiptNumber: string;   // Internal receipt number (NOT official)
  internalId?: string;     // Internal tracking ID
  balanceAmount: Decimal;  // Internal balance calculation (NOT tax calculation)
  balanceExempt: boolean;  // Internal exemption flag
  internalDiscount?: {
    type: 'staff' | 'internal';
    referenceId: string;
    discountAmount: Decimal;
  };
}
```

### Internal Receipt Formatting with Tenant Isolation (NO COMPLIANCE)

⚠️ **INTERNAL TRACKING ONLY:** Not for legal/official use.

```sql
-- Internal receipt tracking table (NO LEGAL COMPLIANCE)
CREATE TABLE internal_booking_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  booking_id UUID REFERENCES bookings(id),
  internal_receipt_number VARCHAR(50) NOT NULL, -- NOT official receipt
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  internal_balance_amount DECIMAL(12,2), -- NOT tax amount
  total_amount DECIMAL(12,2),
  payment_method VARCHAR(50),
  metadata JSONB,
  -- Composite unique constraint per project
  CONSTRAINT unique_internal_receipt_per_project UNIQUE(project_id, internal_receipt_number)
);

-- Index for performance (project_id as leading column)
CREATE INDEX idx_booking_receipts_project ON booking_receipts(project_id, issued_at DESC);
```

```typescript
// Internal receipt service (NO COMPLIANCE)
export class InternalReceiptService {
  async generateInternalReceipt(
    userId: string,
    projectId: string,
    bookingId: string,
    receiptData: InternalReceiptData
  ): Promise<InternalReceipt> {
    // Validate staff project access
    await this.validateStaffProjectAccess(userId, projectId);
    
    // Verify booking belongs to project
    const booking = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.projectId, projectId) // CRITICAL: Verify ownership
        )
      )
      .limit(1);
    
    if (!booking.length) {
      throw new ForbiddenError('Booking not found in project');
    }
    
    // Generate internal receipt with project_id (NO LEGAL VALUE)
    return await db.insert(internalBookingReceipts).values({
      projectId, // CRITICAL: Always set project_id
      bookingId,
      internalReceiptNumber: await this.generateInternalReceiptNumber(projectId),
      internalBalanceAmount: receiptData.internalBalanceAmount, // NOT tax amount
      totalAmount: receiptData.totalAmount,
      paymentMethod: receiptData.paymentMethod,
      metadata: receiptData.metadata
    });
  }
}
```

## Security Considerations

### Application-Level Tenant Isolation Enforcement

```typescript
// Security middleware for all booking operations
export class BookingSecurityMiddleware {
  // Validate all queries include project_id filtering
  async validateQuery(query: any, projectId: string): Promise<void> {
    if (!query.where?.projectId || query.where.projectId !== projectId) {
      throw new SecurityError('Query must filter by project_id');
    }
  }
  
  // Validate all inserts include correct project_id
  async validateInsert(data: any, projectId: string): Promise<void> {
    if (data.projectId !== projectId) {
      throw new SecurityError('Insert must include correct project_id');
    }
  }
  
  // Validate updates don't change project_id
  async validateUpdate(data: any, existingProjectId: string): Promise<void> {
    if (data.projectId && data.projectId !== existingProjectId) {
      throw new SecurityError('Cannot change project_id on update');
    }
  }
}

// Example service implementation with security checks
export class SecureBookingService {
  constructor(private security: BookingSecurityMiddleware) {}
  
  async createBooking(
    userId: string,
    projectId: string,
    bookingData: CreateBookingDto
  ): Promise<Booking> {
    // Validate user has access to project
    await this.validateProjectAccess(userId, projectId);
    
    // Ensure booking data includes project_id
    const dataWithProject = {
      ...bookingData,
      projectId // CRITICAL: Always set project_id
    };
    
    // Validate insert security
    await this.security.validateInsert(dataWithProject, projectId);
    
    // Create booking with transaction for atomicity
    return await db.transaction(async (tx) => {
      const [booking] = await tx
        .insert(bookings)
        .values(dataWithProject)
        .returning();
      
      // Audit log the creation
      await this.auditLog(tx, userId, projectId, 'CREATE', 'bookings', booking.id, null, booking);
      
      return booking;
    });
  }
}
```

### Audit Trail with Tenant Isolation

```typescript
// Audit service with application-level tenant isolation
export class AuditService {
  async logAction(
    userId: string,
    projectId: string,
    action: string,
    tableName: string,
    recordId: string,
    oldValues: any,
    newValues: any,
    request: Request
  ): Promise<void> {
    await db.insert(auditLogs).values({
      projectId, // CRITICAL: Always include project_id
      userId,
      action,
      tableName,
      recordId,
      oldValues,
      newValues,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      createdAt: new Date()
    });
  }
  
  async getAuditLogs(
    userId: string,
    projectId: string,
    filters?: AuditFilters
  ): Promise<AuditLog[]> {
    // Validate access
    await this.validateProjectAccess(userId, projectId);
    
    // Query with explicit project_id filtering
    return await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.projectId, projectId), // CRITICAL: Always filter by project
          filters?.startDate ? gte(auditLogs.createdAt, filters.startDate) : undefined,
          filters?.endDate ? lte(auditLogs.createdAt, filters.endDate) : undefined,
          filters?.action ? eq(auditLogs.action, filters.action) : undefined
        )
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(filters?.limit || 100);
  }
}
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
- **Test isolation**: Use mocked database interactions in all tests
- **Race conditions**: Plan for database-level locking in implementation
- **Data inconsistency**: Enforce project_id filtering in all queries
- **Scope creep**: Defer advanced optimizations (RLS, pooling) to post-MVP

### Business Risks
- **Compliance violations**: Regular audit of balance calculations
- **Overbooking**: Implement pessimistic locking for critical sections
- **Data loss**: Regular automated backups with point-in-time recovery

## Next Steps

1. Review and approve technical design
2. Set up test database environments
3. Begin with Sub-phase 3.1: Test Calendar Component
4. Establish CI/CD pipeline for automated testing
5. Configure monitoring and alerting

## References

### Primary (Required Reading)
- [SIMPLE_DATABASE_GUIDE.md](../../SIMPLE_DATABASE_GUIDE.md) - **Authoritative database patterns for Phase 3**
- [TDD Best Practices](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- [Philippine BIR Requirements](https://www.bir.gov.ph)

### Secondary (Future Reference Only)
- [Neon PostgreSQL Documentation](https://neon.tech/docs) - Post-MVP optimization
- [PgBouncer Configuration Guide](https://www.pgbouncer.org/config.html) - Post-MVP optimization
- [NEON_CONNECTION_POOLING.md](../../NEON_CONNECTION_POOLING.md) - Reference only, NOT in Phase 3 scope