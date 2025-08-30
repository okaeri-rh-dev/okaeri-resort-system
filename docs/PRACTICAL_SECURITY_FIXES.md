# Practical Security Fixes for Okaeri Resort System

## Executive Summary

This document addresses the **real vulnerabilities** identified in the security
audit and provides practical, implementable fixes appropriate for a small resort
management application. These fixes focus on addressing actual security gaps
without over-engineering the solution.

## Critical Vulnerabilities Identified

### 1. Missing Project-ID Enforcement

**Risk Level**: HIGH  
**Impact**: Users can access data from other projects  
**Root Cause**: Repository queries don't automatically filter by project_id

### 2. Schema-Only Isolation Issues

**Risk Level**: MEDIUM  
**Impact**: Potential cross-schema data access  
**Root Cause**: Schema names can be manipulated, no runtime validation

### 3. Raw SQL Bypasses Security

**Risk Level**: MEDIUM  
**Impact**: Complex queries bypass tenant isolation  
**Root Cause**: Raw SQL queries don't include project_id filters

---

## Security Fix Implementation Guide

### Fix 1: Automatic Project-ID Filtering

**Problem**: Repository queries don't automatically include project filtering.

**Solution**: Extend the MultiTenantRepository to enforce project_id in all
queries.

#### Implementation

```typescript
// src/lib/repositories/secure-base.repository.ts
export abstract class SecureMultiTenantRepository<
  T extends { projectId?: string },
  TInsert = T,
  TUpdate = Partial<T>,
> extends MultiTenantRepository<T, TInsert, TUpdate> {
  /**
   * Override buildConditions to always include project_id filter
   */
  protected buildConditions(
    filters: FilterCondition<T>[] = []
  ): SQL | undefined {
    // Always add project_id filter for tenant isolation
    const projectFilter: FilterCondition<T> = {
      field: "projectId" as keyof T,
      operator: "eq",
      value: this.projectId,
    };

    const secureFilters = [...filters, projectFilter];
    return super.buildConditions(secureFilters);
  }

  /**
   * Override findById to include project_id check
   */
  async findById(id: string, tx?: TransactionContext): Promise<T | null> {
    const result = await this.findOne(
      [{ field: "id" as keyof T, operator: "eq", value: id }],
      tx
    );
    return result;
  }

  /**
   * Override create to inject project_id
   */
  async create(data: TInsert, tx?: TransactionContext): Promise<T> {
    const secureData = {
      ...data,
      projectId: this.projectId,
    } as TInsert;

    return super.create(secureData, tx);
  }

  /**
   * Override update to verify project ownership
   */
  async update(
    id: string,
    data: TUpdate,
    tx?: TransactionContext
  ): Promise<T | null> {
    // First verify the record belongs to this project
    const existing = await this.findById(id, tx);
    if (!existing) {
      return null;
    }

    return super.update(id, data, tx);
  }

  /**
   * Override delete to verify project ownership
   */
  async delete(id: string, tx?: TransactionContext): Promise<boolean> {
    // First verify the record belongs to this project
    const existing = await this.findById(id, tx);
    if (!existing) {
      return false;
    }

    return super.delete(id, tx);
  }
}
```

### Fix 2: Runtime Schema Validation

**Problem**: Schema names can be manipulated without validation.

**Solution**: Add runtime schema access validation.

#### Implementation

```typescript
// src/lib/repositories/validation.ts
export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityError";
  }
}

export class TenantSecurityValidator {
  /**
   * Validate schema name matches expected pattern
   */
  static validateSchemaName(schemaName: string, projectId: string): boolean {
    const expectedSchema = `project_${projectId}`;

    if (schemaName !== expectedSchema) {
      throw new SecurityError(
        `Invalid schema access: expected ${expectedSchema}, got ${schemaName}`
      );
    }

    // Additional validation: project_id format
    const projectIdPattern =
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    if (!projectIdPattern.test(projectId)) {
      throw new SecurityError("Invalid project ID format");
    }

    return true;
  }

  /**
   * Validate project exists and user has access
   */
  static async validateProjectAccess(
    projectId: string,
    userId: string,
    db: any
  ): Promise<boolean> {
    const access = await db
      .select()
      .from(userProjectPermissions)
      .where(
        and(
          eq(userProjectPermissions.projectId, projectId),
          eq(userProjectPermissions.userId, userId),
          eq(userProjectPermissions.isActive, true)
        )
      )
      .limit(1);

    if (access.length === 0) {
      throw new SecurityError(
        "Access denied: User does not have permission for this project"
      );
    }

    return true;
  }
}
```

#### Updated MultiTenantRepository with Validation

```typescript
// Update existing MultiTenantRepository
export abstract class SecureMultiTenantRepository<
  T,
  TInsert = T,
  TUpdate = Partial<T>,
> extends BaseRepository<T, TInsert, TUpdate> {
  protected projectId: string;
  protected userId?: string;

  constructor(projectId: string, userId?: string) {
    super();
    this.projectId = projectId;
    this.userId = userId;
    this.schemaName = `project_${projectId}`;

    // Validate schema name on construction
    TenantSecurityValidator.validateSchemaName(this.schemaName, this.projectId);
  }

  /**
   * Validate access before any database operation
   */
  protected async validateAccess(tx?: TransactionContext): Promise<void> {
    if (this.userId) {
      await TenantSecurityValidator.validateProjectAccess(
        this.projectId,
        this.userId,
        this.getDb(tx)
      );
    }
  }

  // Override all methods to include validation...
  async findMany(
    filters?: FilterCondition<T>[],
    tx?: TransactionContext
  ): Promise<T[]> {
    await this.validateAccess(tx);
    return super.findMany(filters, tx);
  }

  // Similar validation for other methods...
}
```

### Fix 3: Secure Complex Query Patterns

**Problem**: Raw SQL queries bypass tenant isolation.

**Solution**: Create secure patterns for complex queries that always include
project filtering.

#### Implementation

```typescript
// src/lib/repositories/secure-query-builder.ts
export class SecureQueryBuilder {
  constructor(
    private projectId: string,
    private table: any,
    private db: any
  ) {}

  /**
   * Build secure raw SQL with automatic project filtering
   */
  buildSecureRawQuery(baseCondition: SQL, additionalConditions?: SQL[]): SQL {
    const projectCondition = eq(this.table.projectId, this.projectId);

    const allConditions = [projectCondition, baseCondition];
    if (additionalConditions) {
      allConditions.push(...additionalConditions);
    }

    return and(...allConditions);
  }

  /**
   * Execute complex query with automatic project filtering
   */
  async executeSecureQuery(
    selectFields: any,
    conditions: SQL,
    orderBy?: SQL,
    limit?: number
  ): Promise<any[]> {
    let query = this.db
      .select(selectFields)
      .from(this.table)
      .where(this.buildSecureRawQuery(conditions));

    if (orderBy) {
      query = query.orderBy(orderBy);
    }

    if (limit) {
      query = query.limit(limit);
    }

    return await query;
  }
}
```

#### Updated BookingRepository with Secure Patterns

```typescript
// Update BookingRepository to use secure patterns
export class SecureBookingRepository extends SecureMultiTenantRepository<
  Booking,
  NewBooking,
  UpdateBooking
> {
  private secureQueryBuilder: SecureQueryBuilder;

  constructor(projectId: string, userId?: string) {
    super(projectId, userId);
    const schema = createProjectSchema(this.schemaName);
    this.table = schema.bookings;
    this.secureQueryBuilder = new SecureQueryBuilder(
      this.projectId,
      this.table,
      this.getDb()
    );
  }

  /**
   * SECURE VERSION: Find bookings with GCash payments
   */
  async findGcashPayments(tx?: TransactionContext): Promise<Booking[]> {
    await this.validateAccess(tx);

    const gcashCondition = sql`${this.table.metadata}->>'paymentMethod' = 'gcash'`;

    return await this.secureQueryBuilder.executeSecureQuery(
      {}, // Select all fields
      gcashCondition,
      desc(this.table.createdAt)
    );
  }

  /**
   * SECURE VERSION: Complex availability check
   */
  async findConflictingBookings(
    params: AvailabilityCheckParams,
    tx?: TransactionContext
  ): Promise<BookingConflict[]> {
    await this.validateAccess(tx);

    const dateOverlapCondition = and(
      lte(this.table.checkInDate, params.checkOutDate),
      gte(this.table.checkOutDate, params.checkInDate),
      ne(this.table.status, "cancelled"),
      ne(this.table.status, "no_show")
    );

    // Add room-specific conditions
    const additionalConditions: SQL[] = [];
    if (params.roomNumber) {
      additionalConditions.push(eq(this.table.roomNumber, params.roomNumber));
    }
    if (params.roomType) {
      additionalConditions.push(eq(this.table.roomType, params.roomType));
    }
    if (params.excludeBookingId) {
      additionalConditions.push(ne(this.table.id, params.excludeBookingId));
    }

    const selectFields = {
      bookingId: this.table.id,
      bookingCode: this.table.bookingCode,
      guestName: this.table.guestName,
      checkInDate: this.table.checkInDate,
      checkOutDate: this.table.checkOutDate,
      roomNumber: this.table.roomNumber,
      roomType: this.table.roomType,
    };

    return await this.secureQueryBuilder.executeSecureQuery(
      selectFields,
      dateOverlapCondition,
      undefined,
      100 // Reasonable limit
    );
  }

  /**
   * SECURE VERSION: Bulk operations with project validation
   */
  async bulkUpdateStatus(
    bookingIds: string[],
    status: BookingStatus,
    tx?: TransactionContext
  ): Promise<number> {
    await this.validateAccess(tx);

    // Verify all booking IDs belong to this project first
    const verification = await this.findMany(
      [{ field: "id", operator: "in", value: bookingIds }],
      tx
    );

    if (verification.length !== bookingIds.length) {
      throw new SecurityError("Some booking IDs do not belong to this project");
    }

    const db = this.getDb(tx);
    const result = await db
      .update(this.table)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(this.table.projectId, this.projectId),
          sql`${this.table.id} = ANY(${bookingIds})`
        )
      );

    return result.length;
  }
}
```

---

## Migration Plan

### Phase 1: Update Base Repository (1-2 days)

1. Create `SecureMultiTenantRepository` class
2. Add `TenantSecurityValidator` utility
3. Create `SecureQueryBuilder` for complex queries
4. Write unit tests for security functions

### Phase 2: Update Existing Repositories (2-3 days)

1. Migrate `BookingRepository` to use secure base
2. Migrate `PaymentRepository` to use secure base
3. Update all raw SQL queries to use secure patterns
4. Add project validation to all operations

### Phase 3: Integration Testing (1-2 days)

1. Test cross-project access attempts
2. Verify all queries include project filtering
3. Test error handling for invalid access
4. Performance testing with security overhead

### Phase 4: Production Deployment (1 day)

1. Deploy security updates
2. Monitor for security errors
3. Verify audit logs capture violations
4. Update monitoring alerts

---

## Testing Requirements

### Security Test Cases

```typescript
// tests/security/tenant-isolation.test.ts
describe("Tenant Isolation Security", () => {
  test("should prevent cross-project data access", async () => {
    const project1Repo = new SecureBookingRepository("project-1", "user-1");
    const project2Repo = new SecureBookingRepository("project-2", "user-1");

    const booking = await project1Repo.create(mockBooking);

    // Attempt to access from different project should fail
    const crossAccess = await project2Repo.findById(booking.id);
    expect(crossAccess).toBeNull();
  });

  test("should validate schema names", () => {
    expect(() => {
      new SecureBookingRepository("invalid-project", "user-1");
    }).toThrow(SecurityError);
  });

  test("should prevent SQL injection in project IDs", async () => {
    const maliciousProjectId = "'; DROP TABLE bookings; --";

    expect(() => {
      new SecureBookingRepository(maliciousProjectId, "user-1");
    }).toThrow(SecurityError);
  });

  test("should enforce project filtering in complex queries", async () => {
    const repo = new SecureBookingRepository("project-1", "user-1");

    // Mock query that should include project filter
    const gcashPayments = await repo.findGcashPayments();

    // Verify all results belong to correct project
    gcashPayments.forEach((booking) => {
      expect(booking.projectId).toBe("project-1");
    });
  });
});
```

---

## Monitoring and Maintenance

### Security Metrics to Track

1. **Cross-Project Access Attempts**
   - Alert on any SecurityError exceptions
   - Log failed project access attempts

2. **Query Performance Impact**
   - Monitor query execution time with security filters
   - Track connection pool usage

3. **Audit Trail Completeness**
   - Verify all data operations are logged
   - Check retention policy compliance

### Ongoing Security Practices

#### Monthly Security Reviews

- Review audit logs for anomalies
- Check for new SQL injection patterns
- Validate project isolation is working

#### Quarterly Security Updates

- Update dependency security patches
- Review and test backup/restore procedures
- Validate user permissions are current

#### Annual Security Audit

- External security review of critical functions
- Penetration testing of multi-tenant isolation
- Compliance audit for data retention

---

## Implementation Checklist

### Pre-Implementation

- [ ] Review current codebase for all repository usage
- [ ] Identify all raw SQL queries that need updating
- [ ] Prepare test data for security validation
- [ ] Plan deployment rollback strategy

### Implementation

- [ ] Create secure base repository classes
- [ ] Add validation utilities and error handling
- [ ] Update all repository implementations
- [ ] Implement secure query patterns
- [ ] Add comprehensive security tests

### Post-Implementation

- [ ] Deploy to staging environment
- [ ] Run full security test suite
- [ ] Performance testing with security overhead
- [ ] Monitor production logs for issues
- [ ] Update documentation and training

---

## Cost-Benefit Analysis

### Implementation Cost

- **Development Time**: 1-2 weeks
- **Testing Time**: 3-5 days
- **Performance Impact**: < 5% query overhead
- **Maintenance**: 2-4 hours/month

### Security Benefits

- **Eliminates cross-project data access**
- **Prevents SQL injection in tenant isolation**
- **Provides audit trail for compliance**
- **Protects customer data privacy**

### Risk Reduction

- **High**: Data breach between projects
- **Medium**: SQL injection vulnerabilities
- **Medium**: Compliance violations
- **Low**: Reputation damage from security issues

---

## Conclusion

These practical security fixes address the real vulnerabilities identified in
the audit while maintaining the simplicity needed for a small resort management
application. The implementation:

✅ **Fixes actual security gaps** - Not theoretical vulnerabilities  
✅ **Appropriate for internal app** - Not over-engineered for the use case  
✅ **Maintainable by small team** - Clear patterns, good documentation  
✅ **Cost-effective** - Reasonable development and maintenance cost  
✅ **Performance conscious** - Minimal impact on application speed

The security improvements provide robust tenant isolation without the complexity
or false claims of "military-grade" security. This is appropriate, practical
security for a family-owned resort business managing 1-3 properties.
