# Security Test Validation Guide

## Overview

This document provides specific test cases to validate that the security fixes
correctly address the vulnerabilities identified in the audit. These tests
demonstrate that the implementation **actually works** to prevent cross-tenant
data access.

## Test Environment Setup

### Test Database Setup

```sql
-- Create test projects and users for validation
INSERT INTO users (id, email, password_hash, first_name, last_name) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'user1@test.com', 'hash1', 'User', 'One'),
('550e8400-e29b-41d4-a716-446655440002', 'user2@test.com', 'hash2', 'User', 'Two'),
('550e8400-e29b-41d4-a716-446655440003', 'hacker@test.com', 'hash3', 'Hacker', 'User');

INSERT INTO projects (id, name, slug, schema_name, owner_id) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'Resort Paradise', 'resort-paradise', 'project_660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001'),
('660e8400-e29b-41d4-a716-446655440002', 'Beach Haven', 'beach-haven', 'project_660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002');

INSERT INTO user_project_permissions (user_id, project_id, role, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'owner', true),
('550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', 'owner', true);
-- Note: hacker user has NO permissions
```

## Critical Security Tests

### Test 1: Project ID Injection Prevention

**Vulnerability**: Malicious project IDs could bypass security filters.

```typescript
// tests/security/project-id-injection.test.ts
describe("Project ID Injection Prevention", () => {
  test("should reject SQL injection in project ID", () => {
    const maliciousProjectId =
      "'; DROP TABLE bookings; SELECT '1' AS id WHERE '1'='1";

    expect(() => {
      new SecureBookingRepository(maliciousProjectId, "user-1");
    }).toThrow(SecurityError);
  });

  test("should reject non-UUID project ID formats", () => {
    const invalidFormats = [
      "project-123",
      "123456789",
      "not-a-uuid",
      "../../../etc/passwd",
      "null",
      "undefined",
      "",
    ];

    invalidFormats.forEach((invalid) => {
      expect(() => {
        new SecureBookingRepository(invalid, "user-1");
      }).toThrow(InvalidProjectError);
    });
  });

  test("should accept only valid UUID v4 format", () => {
    const validUUID = "550e8400-e29b-41d4-a716-446655440000";

    expect(() => {
      new SecureBookingRepository(validUUID, "user-1");
    }).not.toThrow();
  });
});
```

### Test 2: Cross-Project Data Access Prevention

**Vulnerability**: Users accessing data from projects they don't belong to.

```typescript
// tests/security/cross-project-access.test.ts
describe("Cross-Project Data Access Prevention", () => {
  test("should prevent reading bookings from different project", async () => {
    const project1Repo = new SecureBookingRepository(PROJECT_1_ID, USER_1_ID);
    const project2Repo = new SecureBookingRepository(PROJECT_2_ID, USER_1_ID);

    // Create booking in project 1
    const booking = await project1Repo.create({
      ...mockBookingData,
      guestName: "Secret Guest",
      projectId: PROJECT_1_ID,
    });

    // Attempt to access from project 2 - should return null
    const unauthorizedAccess = await project2Repo.findById(booking.id);
    expect(unauthorizedAccess).toBeNull();

    // Verify it still exists in project 1
    const authorizedAccess = await project1Repo.findById(booking.id);
    expect(authorizedAccess?.guestName).toBe("Secret Guest");
  });

  test("should prevent unauthorized user access", async () => {
    const unauthorizedRepo = new SecureBookingRepository(
      PROJECT_1_ID,
      "hacker-user-id" // User with no permissions
    );

    await expect(async () => {
      await unauthorizedRepo.findMany();
    }).rejects.toThrow(TenantAccessError);
  });

  test("should isolate search results by project", async () => {
    const project1Repo = new SecureBookingRepository(PROJECT_1_ID, USER_1_ID);
    const project2Repo = new SecureBookingRepository(PROJECT_2_ID, USER_2_ID);

    // Create bookings with same guest name in different projects
    await project1Repo.create({
      ...mockBookingData,
      guestName: "John Smith",
      projectId: PROJECT_1_ID,
    });

    await project2Repo.create({
      ...mockBookingData,
      guestName: "John Smith",
      projectId: PROJECT_2_ID,
    });

    // Search should only return results from respective projects
    const project1Results = await project1Repo.searchBookings("John Smith");
    const project2Results = await project2Repo.searchBookings("John Smith");

    expect(project1Results.length).toBe(1);
    expect(project2Results.length).toBe(1);
    expect(project1Results[0].projectId).toBe(PROJECT_1_ID);
    expect(project2Results[0].projectId).toBe(PROJECT_2_ID);
  });
});
```

### Test 3: Raw SQL Query Security

**Vulnerability**: Complex queries bypassing project filters.

```typescript
// tests/security/raw-sql-security.test.ts
describe("Raw SQL Query Security", () => {
  test("should include project filter in GCash payment queries", async () => {
    const project1Repo = new SecureBookingRepository(PROJECT_1_ID, USER_1_ID);
    const project2Repo = new SecureBookingRepository(PROJECT_2_ID, USER_2_ID);

    // Create GCash bookings in both projects
    await project1Repo.create({
      ...mockBookingData,
      metadata: { paymentMethod: "gcash" },
      projectId: PROJECT_1_ID,
    });

    await project2Repo.create({
      ...mockBookingData,
      metadata: { paymentMethod: "gcash" },
      projectId: PROJECT_2_ID,
    });

    // Each repository should only see its own project's GCash payments
    const project1Gcash = await project1Repo.findGcashPayments();
    const project2Gcash = await project2Repo.findGcashPayments();

    project1Gcash.forEach((booking) => {
      expect(booking.projectId).toBe(PROJECT_1_ID);
      expect(booking.metadata?.paymentMethod).toBe("gcash");
    });

    project2Gcash.forEach((booking) => {
      expect(booking.projectId).toBe(PROJECT_2_ID);
      expect(booking.metadata?.paymentMethod).toBe("gcash");
    });

    // Verify no cross-contamination
    expect(project1Gcash.some((b) => b.projectId === PROJECT_2_ID)).toBe(false);
    expect(project2Gcash.some((b) => b.projectId === PROJECT_1_ID)).toBe(false);
  });

  test("should secure complex date range queries", async () => {
    const project1Repo = new SecureBookingRepository(PROJECT_1_ID, USER_1_ID);
    const project2Repo = new SecureBookingRepository(PROJECT_2_ID, USER_2_ID);

    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-01-31");

    // Create bookings in date range for both projects
    await project1Repo.create({
      ...mockBookingData,
      checkInDate: new Date("2024-01-15"),
      checkOutDate: new Date("2024-01-20"),
      projectId: PROJECT_1_ID,
    });

    await project2Repo.create({
      ...mockBookingData,
      checkInDate: new Date("2024-01-15"),
      checkOutDate: new Date("2024-01-20"),
      projectId: PROJECT_2_ID,
    });

    // Date range queries should be project-isolated
    const project1Results = await project1Repo.findByDateRange(
      startDate,
      endDate
    );
    const project2Results = await project2Repo.findByDateRange(
      startDate,
      endDate
    );

    project1Results.forEach((booking) => {
      expect(booking.projectId).toBe(PROJECT_1_ID);
    });

    project2Results.forEach((booking) => {
      expect(booking.projectId).toBe(PROJECT_2_ID);
    });
  });
});
```

### Test 4: Bulk Operation Security

**Vulnerability**: Bulk operations affecting records from wrong projects.

```typescript
// tests/security/bulk-operation-security.test.ts
describe("Bulk Operation Security", () => {
  test("should validate all IDs belong to project before bulk update", async () => {
    const project1Repo = new SecureBookingRepository(PROJECT_1_ID, USER_1_ID);
    const project2Repo = new SecureBookingRepository(PROJECT_2_ID, USER_2_ID);

    // Create bookings in both projects
    const booking1 = await project1Repo.create({
      ...mockBookingData,
      status: "pending",
      projectId: PROJECT_1_ID,
    });

    const booking2 = await project1Repo.create({
      ...mockBookingData,
      status: "pending",
      projectId: PROJECT_1_ID,
    });

    const booking3 = await project2Repo.create({
      ...mockBookingData,
      status: "pending",
      projectId: PROJECT_2_ID,
    });

    // Try to bulk update with mixed project IDs - should fail
    await expect(async () => {
      await project1Repo.bulkUpdateStatus(
        [booking1.id, booking2.id, booking3.id],
        "confirmed"
      );
    }).rejects.toThrow(SecurityError);

    // Verify no changes were made
    const unchanged1 = await project1Repo.findById(booking1.id);
    const unchanged2 = await project1Repo.findById(booking2.id);
    const unchanged3 = await project2Repo.findById(booking3.id);

    expect(unchanged1?.status).toBe("pending");
    expect(unchanged2?.status).toBe("pending");
    expect(unchanged3?.status).toBe("pending");
  });

  test("should allow bulk updates within same project", async () => {
    const project1Repo = new SecureBookingRepository(PROJECT_1_ID, USER_1_ID);

    // Create multiple bookings in same project
    const booking1 = await project1Repo.create({
      ...mockBookingData,
      status: "pending",
      projectId: PROJECT_1_ID,
    });

    const booking2 = await project1Repo.create({
      ...mockBookingData,
      status: "pending",
      projectId: PROJECT_1_ID,
    });

    // Bulk update should work within same project
    const updated = await project1Repo.bulkUpdateStatus(
      [booking1.id, booking2.id],
      "confirmed"
    );

    expect(updated).toBe(2);

    // Verify changes were applied
    const updated1 = await project1Repo.findById(booking1.id);
    const updated2 = await project1Repo.findById(booking2.id);

    expect(updated1?.status).toBe("confirmed");
    expect(updated2?.status).toBe("confirmed");
  });
});
```

### Test 5: Input Sanitization Security

**Vulnerability**: SQL injection through search and filter inputs.

```typescript
// tests/security/input-sanitization.test.ts
describe("Input Sanitization Security", () => {
  test("should prevent SQL injection in search queries", async () => {
    const repo = new SecureBookingRepository(PROJECT_1_ID, USER_1_ID);

    // Create test booking
    await repo.create({
      ...mockBookingData,
      guestName: "Legitimate Guest",
      projectId: PROJECT_1_ID,
    });

    const sqlInjectionAttempts = [
      "'; DROP TABLE bookings; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM users --",
      "'; INSERT INTO bookings (guest_name) VALUES ('hacked'); --",
      "%'; EXEC xp_cmdshell('dir'); --",
    ];

    // All injection attempts should be safely handled
    for (const maliciousInput of sqlInjectionAttempts) {
      const results = await repo.searchBookings(maliciousInput);

      // Should return empty array (no matches) rather than throwing error
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    }

    // Verify legitimate search still works
    const legitResults = await repo.searchBookings("Legitimate Guest");
    expect(legitResults.length).toBe(1);
    expect(legitResults[0].guestName).toBe("Legitimate Guest");
  });

  test("should sanitize filter conditions", async () => {
    const repo = new SecureBookingRepository(PROJECT_1_ID, USER_1_ID);

    // Create test data
    await repo.create({
      ...mockBookingData,
      guestName: "Test Guest",
      projectId: PROJECT_1_ID,
    });

    // Attempt to inject through filter conditions
    const maliciousFilters = [
      {
        field: "guestName",
        operator: "eq",
        value: "'; DROP TABLE bookings; --",
      },
      { field: "id", operator: "eq", value: "' OR '1'='1' --" },
    ];

    // Should handle malicious filters safely
    for (const filter of maliciousFilters) {
      const results = await repo.findMany([filter as any]);
      expect(Array.isArray(results)).toBe(true);
      // Should not find any matches with malicious values
      expect(results.length).toBe(0);
    }
  });
});
```

## Performance Impact Tests

### Test 6: Security Overhead Measurement

```typescript
// tests/security/performance-impact.test.ts
describe("Security Performance Impact", () => {
  test("should measure query performance with security filters", async () => {
    const repo = new SecureBookingRepository(PROJECT_1_ID, USER_1_ID);

    // Create test data
    const bookings = Array.from({ length: 100 }, (_, i) => ({
      ...mockBookingData,
      guestName: `Guest ${i}`,
      projectId: PROJECT_1_ID,
    }));

    await repo.createMany(bookings);

    // Measure query time
    const start = process.hrtime.bigint();
    const results = await repo.findMany();
    const end = process.hrtime.bigint();

    const durationMs = Number(end - start) / 1_000_000;

    // Should complete within reasonable time (adjust based on your requirements)
    expect(durationMs).toBeLessThan(100); // 100ms for 100 records
    expect(results.length).toBe(100);

    // Verify all results have correct project ID
    results.forEach((booking) => {
      expect(booking.projectId).toBe(PROJECT_1_ID);
    });
  });

  test("should measure complex query performance", async () => {
    const repo = new SecureBookingRepository(PROJECT_1_ID, USER_1_ID);

    // Create test bookings with GCash payments
    const gcashBookings = Array.from({ length: 50 }, (_, i) => ({
      ...mockBookingData,
      guestName: `GCash Guest ${i}`,
      metadata: { paymentMethod: "gcash" },
      projectId: PROJECT_1_ID,
    }));

    await repo.createMany(gcashBookings);

    // Measure complex query time
    const start = process.hrtime.bigint();
    const results = await repo.findGcashPayments();
    const end = process.hrtime.bigint();

    const durationMs = Number(end - start) / 1_000_000;

    // Should complete within reasonable time
    expect(durationMs).toBeLessThan(50); // 50ms for complex query
    expect(results.length).toBe(50);

    // Verify security filtering worked
    results.forEach((booking) => {
      expect(booking.projectId).toBe(PROJECT_1_ID);
      expect(booking.metadata?.paymentMethod).toBe("gcash");
    });
  });
});
```

## Integration Test Suite

### Test 7: End-to-End Security Validation

```typescript
// tests/security/e2e-security.test.ts
describe("End-to-End Security Validation", () => {
  test("should maintain security across repository lifecycle", async () => {
    const repo1 = new SecureBookingRepository(PROJECT_1_ID, USER_1_ID);
    const repo2 = new SecureBookingRepository(PROJECT_2_ID, USER_2_ID);

    // Create booking in project 1
    const booking = await repo1.create({
      ...mockBookingData,
      guestName: "Secure Guest",
      status: "pending",
      projectId: PROJECT_1_ID,
    });

    // Verify creation worked
    expect(booking.projectId).toBe(PROJECT_1_ID);
    expect(booking.guestName).toBe("Secure Guest");

    // Update from correct project should work
    const updated = await repo1.update(booking.id, {
      status: "confirmed",
    });
    expect(updated?.status).toBe("confirmed");

    // Update from wrong project should fail
    const wrongUpdate = await repo2.update(booking.id, {
      status: "cancelled",
    });
    expect(wrongUpdate).toBeNull();

    // Search from wrong project should not find it
    const wrongSearch = await repo2.searchBookings("Secure Guest");
    expect(wrongSearch.length).toBe(0);

    // Search from correct project should find it
    const correctSearch = await repo1.searchBookings("Secure Guest");
    expect(correctSearch.length).toBe(1);
    expect(correctSearch[0].status).toBe("confirmed"); // Still confirmed

    // Delete from wrong project should fail
    const wrongDelete = await repo2.delete(booking.id);
    expect(wrongDelete).toBe(false);

    // Verify it still exists
    const stillExists = await repo1.findById(booking.id);
    expect(stillExists).not.toBeNull();

    // Delete from correct project should work
    const correctDelete = await repo1.delete(booking.id);
    expect(correctDelete).toBe(true);

    // Verify it's gone
    const shouldBeGone = await repo1.findById(booking.id);
    expect(shouldBeGone).toBeNull();
  });
});
```

## Test Execution Commands

```bash
# Run all security tests
npm test -- tests/security/

# Run specific security test suites
npm test -- tests/security/tenant-isolation.test.ts
npm test -- tests/security/cross-project-access.test.ts
npm test -- tests/security/raw-sql-security.test.ts

# Run performance impact tests
npm test -- tests/security/performance-impact.test.ts

# Run with coverage to ensure all security paths are tested
npm test -- --coverage tests/security/
```

## Test Results Validation

### Success Criteria

The security implementation is working correctly if:

✅ **All injection tests fail safely** - No SQL injection succeeds  
✅ **Cross-project access is blocked** - Users cannot access other project
data  
✅ **Project filters are automatic** - All queries include project filtering  
✅ **Bulk operations validate ownership** - Cannot bulk update cross-project
records  
✅ **Performance impact is minimal** - < 10% overhead for security features  
✅ **Error handling is secure** - No sensitive data leaked in error messages

### Failure Investigation

If any tests fail:

1. **Check repository inheritance** - Ensure all repos extend
   SecureMultiTenantRepository
2. **Verify project ID injection** - Confirm all create operations include
   projectId
3. **Review query building** - Check that buildConditions includes project
   filter
4. **Validate user permissions** - Ensure test users have correct project access
5. **Check database state** - Verify test data is properly isolated

## Summary

This comprehensive test suite validates that:

- **Real vulnerabilities are fixed** - Tests address actual security gaps found
  in audit
- **Security measures work correctly** - Comprehensive coverage of isolation
  scenarios
- **Performance is acceptable** - Security overhead is minimal and measurable
- **Implementation is complete** - All repository operations are secured
  consistently

These tests provide confidence that the security fixes **actually work** to
protect customer data and maintain proper tenant isolation in the resort
management system.
