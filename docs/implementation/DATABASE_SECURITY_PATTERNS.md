# Database Security Patterns for Multi-Tenant Isolation

> **CRITICAL**: This document defines the security patterns for
> application-level filtering in the Okaeri Resort System. All database
> operations MUST follow these patterns to ensure proper tenant isolation.

## Overview

The Okaeri Resort System implements multi-tenant isolation through
**application-level filtering** rather than database-level Row-Level Security
(RLS). This approach provides:

- Explicit control over data access
- Better query plan visibility and optimization
- Simplified debugging and monitoring
- Framework-agnostic implementation
- Consistent behavior across different database providers

## Core Security Principles

### 1. Always Filter by project_id

Every query accessing tenant-specific data MUST include an explicit `project_id`
filter:

```typescript
// ✅ CORRECT: Explicit project_id filtering
const bookings = await db
  .select()
  .from(bookings)
  .where(eq(bookings.projectId, projectId));

// ❌ WRONG: Missing project_id filter
const bookings = await db
  .select()
  .from(bookings)
  .where(eq(bookings.status, "confirmed"));
```

### 2. Validate Project Access Before Operations

Always validate user access to a project before performing any operations:

```typescript
export class BaseService {
  protected async validateProjectAccess(
    userId: string,
    projectId: string
  ): Promise<void> {
    const access = await db
      .select()
      .from(userProjectRoles)
      .where(
        and(
          eq(userProjectRoles.userId, userId),
          eq(userProjectRoles.projectId, projectId)
        )
      )
      .limit(1);

    if (!access.length) {
      throw new ForbiddenError("No access to project");
    }
  }
}
```

### 3. Include project_id in All Inserts

When creating new records, always include the `project_id`:

```typescript
// ✅ CORRECT: Including project_id in insert
await db.insert(bookings).values({
  id: generateId(),
  projectId, // CRITICAL: Always include
  guestName: data.guestName,
  checkIn: data.checkIn,
  checkOut: data.checkOut,
});

// ❌ WRONG: Missing project_id
await db.insert(bookings).values({
  id: generateId(),
  guestName: data.guestName,
  checkIn: data.checkIn,
  checkOut: data.checkOut,
});
```

### 4. Prevent project_id Modification

Never allow updates to change the `project_id` of existing records:

```typescript
// ✅ CORRECT: Exclude project_id from updates
const { projectId, ...updateData } = data;
await db
  .update(bookings)
  .set(updateData)
  .where(
    and(
      eq(bookings.id, bookingId),
      eq(bookings.projectId, projectId) // Verify ownership
    )
  );

// ❌ WRONG: Allowing project_id to be changed
await db
  .update(bookings)
  .set(data) // Could contain projectId
  .where(eq(bookings.id, bookingId));
```

## Implementation Patterns

### Service Layer Pattern

All services should extend a base service that enforces security:

```typescript
export abstract class SecureBaseService {
  constructor(protected db: Database) {}

  // Template method for secure queries
  protected async secureQuery<T>(
    userId: string,
    projectId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    // 1. Validate access
    await this.validateProjectAccess(userId, projectId);

    // 2. Execute operation
    const result = await operation();

    // 3. Audit if needed
    await this.auditIfRequired(userId, projectId, operation.name);

    return result;
  }

  private async validateProjectAccess(
    userId: string,
    projectId: string
  ): Promise<void> {
    const hasAccess = await this.db
      .select({ role: userProjectRoles.role })
      .from(userProjectRoles)
      .where(
        and(
          eq(userProjectRoles.userId, userId),
          eq(userProjectRoles.projectId, projectId),
          eq(userProjectRoles.isActive, true)
        )
      )
      .limit(1);

    if (!hasAccess.length) {
      throw new ForbiddenError(
        `User ${userId} has no access to project ${projectId}`
      );
    }
  }
}
```

### Repository Pattern with Security

```typescript
export class BookingRepository {
  constructor(
    private db: Database,
    private security: SecurityService
  ) {}

  async findById(
    userId: string,
    projectId: string,
    bookingId: string
  ): Promise<Booking | null> {
    // Validate access first
    await this.security.validateProjectAccess(userId, projectId);

    // Query with both bookingId AND projectId
    const [booking] = await this.db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.projectId, projectId) // CRITICAL: Verify ownership
        )
      )
      .limit(1);

    return booking || null;
  }

  async create(
    userId: string,
    projectId: string,
    data: CreateBookingDto
  ): Promise<Booking> {
    // Validate access
    await this.security.validateProjectAccess(userId, projectId);

    // Ensure project_id is set
    const bookingData = {
      ...data,
      projectId, // CRITICAL: Always set
      createdBy: userId,
      createdAt: new Date(),
    };

    // Insert with transaction for atomicity
    return await this.db.transaction(async (tx) => {
      const [booking] = await tx
        .insert(bookings)
        .values(bookingData)
        .returning();

      // Audit log
      await tx.insert(auditLogs).values({
        projectId,
        userId,
        action: "CREATE",
        tableName: "bookings",
        recordId: booking.id,
        newValues: booking,
      });

      return booking;
    });
  }
}
```

### Query Builder Pattern

Create type-safe query builders that enforce project filtering:

```typescript
export class SecureQueryBuilder<T> {
  constructor(
    private table: Table,
    private projectId: string
  ) {}

  select() {
    return this.db
      .select()
      .from(this.table)
      .where(eq(this.table.projectId, this.projectId));
  }

  insert(values: Omit<T, "projectId">) {
    return this.db.insert(this.table).values({
      ...values,
      projectId: this.projectId, // Always include
    });
  }

  update(id: string, values: Partial<Omit<T, "projectId" | "id">>) {
    return this.db
      .update(this.table)
      .set(values)
      .where(
        and(eq(this.table.id, id), eq(this.table.projectId, this.projectId))
      );
  }

  delete(id: string) {
    return this.db
      .delete(this.table)
      .where(
        and(eq(this.table.id, id), eq(this.table.projectId, this.projectId))
      );
  }
}
```

## Database Schema Requirements

### Table Design

All tenant-specific tables MUST include:

```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  -- other columns...

  -- Index on project_id for performance
  INDEX idx_bookings_project_id (project_id)
);

-- Foreign key ensures referential integrity
ALTER TABLE bookings
  ADD CONSTRAINT fk_bookings_project
  FOREIGN KEY (project_id) REFERENCES projects(id);
```

### Index Strategy

Always create indexes with `project_id` as the leading column:

```sql
-- ✅ CORRECT: project_id as leading column
CREATE INDEX idx_bookings_project_status
  ON bookings(project_id, status);

CREATE INDEX idx_bookings_project_date
  ON bookings(project_id, check_in, check_out);

-- ❌ WRONG: project_id not leading
CREATE INDEX idx_bookings_status_project
  ON bookings(status, project_id);
```

## Code Review Checklist

### Security Validation Points

- [ ] **All SELECT queries** include `WHERE project_id = ?`
- [ ] **All INSERT operations** include `project_id` in values
- [ ] **All UPDATE operations** include `project_id` in WHERE clause
- [ ] **All DELETE operations** include `project_id` in WHERE clause
- [ ] **No UPDATE operations** can modify `project_id`
- [ ] **Service methods** validate project access before operations
- [ ] **Transactions** maintain project isolation throughout
- [ ] **Joins** include project_id conditions on all tables
- [ ] **Subqueries** filter by project_id independently
- [ ] **Aggregations** group by project_id when needed

### Common Security Mistakes

#### 1. Missing project_id in Joins

```typescript
// ❌ WRONG: Join without project_id validation
const result = await db
  .select()
  .from(bookings)
  .leftJoin(rooms, eq(bookings.roomId, rooms.id))
  .where(eq(bookings.projectId, projectId));

// ✅ CORRECT: Both tables filtered by project_id
const result = await db
  .select()
  .from(bookings)
  .leftJoin(
    rooms,
    and(
      eq(bookings.roomId, rooms.id),
      eq(rooms.projectId, projectId) // Ensure room belongs to project
    )
  )
  .where(eq(bookings.projectId, projectId));
```

#### 2. Forgetting project_id in Existence Checks

```typescript
// ❌ WRONG: Checking existence without project context
const exists = await db
  .select()
  .from(rooms)
  .where(eq(rooms.id, roomId))
  .limit(1);

// ✅ CORRECT: Include project_id in existence check
const exists = await db
  .select()
  .from(rooms)
  .where(and(eq(rooms.id, roomId), eq(rooms.projectId, projectId)))
  .limit(1);
```

#### 3. Batch Operations Without Filtering

```typescript
// ❌ WRONG: Batch update without project validation
await db
  .update(bookings)
  .set({ status: "confirmed" })
  .where(inArray(bookings.id, bookingIds));

// ✅ CORRECT: Ensure all records belong to project
await db
  .update(bookings)
  .set({ status: "confirmed" })
  .where(
    and(inArray(bookings.id, bookingIds), eq(bookings.projectId, projectId))
  );
```

## Runtime Monitoring Requirements

### Query Logging

Implement query logging to detect missing project_id filters:

```typescript
export class QueryMonitor {
  private static validateQuery(sql: string, table: string): void {
    const hasProjectFilter = sql.includes("project_id");
    const isGlobalTable = ["users", "projects"].includes(table);

    if (!isGlobalTable && !hasProjectFilter) {
      console.error(
        `SECURITY WARNING: Query on ${table} missing project_id filter`
      );
      // In production, alert monitoring system
      this.alertSecurityTeam({
        type: "MISSING_PROJECT_FILTER",
        table,
        query: sql,
        timestamp: new Date(),
      });
    }
  }
}
```

### Audit Trail

All data modifications should be logged:

```typescript
export class AuditLogger {
  static async log(params: {
    userId: string;
    projectId: string;
    action: "CREATE" | "UPDATE" | "DELETE";
    table: string;
    recordId: string;
    oldValues?: any;
    newValues?: any;
  }): Promise<void> {
    await db.insert(auditLogs).values({
      ...params,
      timestamp: new Date(),
      ipAddress: getClientIp(),
      userAgent: getUserAgent(),
    });
  }
}
```

### Performance Monitoring

Track query performance by project:

```typescript
export class PerformanceMonitor {
  static async trackQuery(
    projectId: string,
    query: string,
    duration: number
  ): Promise<void> {
    if (duration > 100) {
      // Log slow queries
      await db.insert(slowQueryLog).values({
        projectId,
        query,
        duration,
        timestamp: new Date(),
      });
    }
  }
}
```

## Testing Patterns

### Unit Test Template

```typescript
describe("BookingService Security", () => {
  it("should filter bookings by project_id", async () => {
    const projectId = "project-1";
    const userId = "user-1";

    // Create bookings for multiple projects
    await createTestBooking({ projectId: "project-1" });
    await createTestBooking({ projectId: "project-2" });

    // Query should only return project-1 bookings
    const bookings = await service.getBookings(userId, projectId);

    expect(bookings).toHaveLength(1);
    expect(bookings[0].projectId).toBe(projectId);
  });

  it("should prevent cross-project updates", async () => {
    const booking = await createTestBooking({ projectId: "project-1" });

    // Attempt to update with wrong project context
    await expect(
      service.updateBooking("user-1", "project-2", booking.id, data)
    ).rejects.toThrow(ForbiddenError);
  });
});
```

### Integration Test Pattern

```typescript
describe('Multi-tenant Isolation', () => {
  it('should maintain complete project isolation', async () => {
    // Setup two projects with data
    const project1 = await setupProject('Resort A');
    const project2 = await setupProject('Resort B');

    // Create bookings in each project
    const booking1 = await createBooking(project1.id, {...});
    const booking2 = await createBooking(project2.id, {...});

    // Verify isolation
    const project1Bookings = await getBookings(project1.id);
    const project2Bookings = await getBookings(project2.id);

    expect(project1Bookings).not.toContainEqual(
      expect.objectContaining({ id: booking2.id })
    );
    expect(project2Bookings).not.toContainEqual(
      expect.objectContaining({ id: booking1.id })
    );
  });
});
```

## Migration from RLS to Application-Level

If migrating from RLS to application-level filtering:

1. **Remove RLS policies** but keep schema structure
2. **Update all queries** to include explicit project_id filters
3. **Add service layer validation** for project access
4. **Update tests** to verify application-level isolation
5. **Monitor queries** for missing filters during transition

```sql
-- Remove RLS (if previously enabled)
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_isolation ON bookings;

-- Keep foreign key constraints
ALTER TABLE bookings
  ADD CONSTRAINT fk_bookings_project
  FOREIGN KEY (project_id) REFERENCES projects(id);

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_bookings_project_id
  ON bookings(project_id);
```

## Compliance and Audit

### Philippine Data Privacy Act

Ensure audit logs capture:

- Who accessed what data (user_id, project_id)
- When the access occurred (timestamp)
- What operation was performed (action)
- IP address and user agent for tracking

### Regular Security Audits

Schedule monthly reviews of:

1. Query logs for missing project_id filters
2. Failed access attempts
3. Cross-project data access attempts
4. Slow queries that might indicate missing indexes

## Summary

Application-level filtering provides robust multi-tenant isolation when
implemented correctly. The key is consistency:

1. **Every query** must filter by project_id
2. **Every insert** must include project_id
3. **Every update** must verify project ownership
4. **Every service** must validate access before operations
5. **Every test** must verify isolation

By following these patterns, the system maintains complete data isolation
between projects while providing clear, debuggable, and performant database
operations.
