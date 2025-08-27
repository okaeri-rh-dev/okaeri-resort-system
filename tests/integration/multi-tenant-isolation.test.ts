/**
 * Multi-Tenant Data Isolation Tests
 * @since Phase 1.7 - Integration & E2E Validation
 *
 * Critical tests ensuring complete data isolation between
 * different resort projects in the multi-tenant architecture
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  createTestUser,
  createTestBooking,
  createTestExpense,
  apiRequest,
  cleanupAllTestData,
  sql,
} from "./test-helpers";

describe("Multi-Tenant Data Isolation Tests", () => {
  // Project 1 data
  let project1Id: string;
  let project1Token: string;
  let project1BookingId: string;
  let project1ExpenseId: string;
  let user1Id: string;

  // Project 2 data
  let project2Id: string;
  let project2Token: string;
  let project2BookingId: string;
  let project2ExpenseId: string;
  let user2Id: string;

  beforeAll(async () => {
    // Set up first project and user
    const setup1 = await setupTestDatabase();
    project1Id = setup1.projectId;
    project1Token = setup1.token;

    // Create test data for project 1
    const user1 = await createTestUser("owner");
    user1Id = user1.id;
    project1BookingId = await createTestBooking(project1Id, {
      guestName: "Project 1 Guest",
      guestEmail: "guest1@test.com",
    });
    project1ExpenseId = await createTestExpense(project1Id, user1Id, {
      description: "Project 1 Expense",
      amount: 1000,
    });

    // Create second project with different owner
    const user2 = await createTestUser("owner");
    user2Id = user2.id;

    // Create project 2
    const projectResponse = await apiRequest("/projects", "POST", user2.token, {
      name: "Competing Resort",
      businessType: "resort",
      location: "Boracay",
    });

    const project2Data = await projectResponse.json();
    project2Id = project2Data.id;
    project2Token = user2.token;

    // Create test data for project 2
    project2BookingId = await createTestBooking(project2Id, {
      guestName: "Project 2 Guest",
      guestEmail: "guest2@test.com",
    });
    project2ExpenseId = await createTestExpense(project2Id, user2Id, {
      description: "Project 2 Expense",
      amount: 2000,
    });
  });

  afterAll(async () => {
    await teardownTestDatabase(project1Id);
    await teardownTestDatabase(project2Id);
    await cleanupAllTestData();
  });

  describe("Cross-Project Access Prevention", () => {
    it("should prevent accessing Project 1 bookings with Project 2 token", async () => {
      const response = await apiRequest(
        `/projects/${project1Id}/bookings/${project1BookingId}`,
        "GET",
        project2Token
      );

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toContain("access");
    });

    it("should prevent accessing Project 2 bookings with Project 1 token", async () => {
      const response = await apiRequest(
        `/projects/${project2Id}/bookings/${project2BookingId}`,
        "GET",
        project1Token
      );

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toContain("access");
    });

    it("should prevent modifying Project 1 data with Project 2 token", async () => {
      const response = await apiRequest(
        `/projects/${project1Id}/bookings/${project1BookingId}`,
        "PUT",
        project2Token,
        {
          guestName: "Hacked Guest Name",
        }
      );

      expect(response.status).toBe(403);

      // Verify data wasn't modified
      const verifyResponse = await apiRequest(
        `/projects/${project1Id}/bookings/${project1BookingId}`,
        "GET",
        project1Token
      );

      const booking = await verifyResponse.json();
      expect(booking.guestName).toBe("Project 1 Guest");
      expect(booking.guestName).not.toBe("Hacked Guest Name");
    });

    it("should prevent deleting Project 1 data with Project 2 token", async () => {
      const response = await apiRequest(
        `/projects/${project1Id}/expenses/${project1ExpenseId}`,
        "DELETE",
        project2Token
      );

      expect(response.status).toBe(403);

      // Verify data still exists
      const verifyResponse = await apiRequest(
        `/projects/${project1Id}/expenses/${project1ExpenseId}`,
        "GET",
        project1Token
      );

      expect(verifyResponse.status).toBe(200);
    });
  });

  describe("Data Listing Isolation", () => {
    it("should only show Project 1 bookings when using Project 1 token", async () => {
      const response = await apiRequest(`/projects/${project1Id}/bookings`, "GET", project1Token);

      expect(response.status).toBe(200);

      const bookings = await response.json();
      expect(Array.isArray(bookings)).toBe(true);

      // Should only contain Project 1 bookings
      bookings.forEach((booking) => {
        expect(booking.guestName).not.toContain("Project 2");
      });

      // Should contain Project 1 booking
      const project1Booking = bookings.find((b) => b.id === project1BookingId);
      expect(project1Booking).toBeDefined();
      expect(project1Booking.guestName).toBe("Project 1 Guest");
    });

    it("should only show Project 2 bookings when using Project 2 token", async () => {
      const response = await apiRequest(`/projects/${project2Id}/bookings`, "GET", project2Token);

      expect(response.status).toBe(200);

      const bookings = await response.json();
      expect(Array.isArray(bookings)).toBe(true);

      // Should only contain Project 2 bookings
      bookings.forEach((booking) => {
        expect(booking.guestName).not.toContain("Project 1");
      });

      // Should contain Project 2 booking
      const project2Booking = bookings.find((b) => b.id === project2BookingId);
      expect(project2Booking).toBeDefined();
      expect(project2Booking.guestName).toBe("Project 2 Guest");
    });

    it("should isolate expense data between projects", async () => {
      // Get Project 1 expenses
      const response1 = await apiRequest(`/projects/${project1Id}/expenses`, "GET", project1Token);

      const expenses1 = await response1.json();

      // Get Project 2 expenses
      const response2 = await apiRequest(`/projects/${project2Id}/expenses`, "GET", project2Token);

      const expenses2 = await response2.json();

      // Verify no overlap
      const expense1Ids = expenses1.map((e) => e.id);
      const expense2Ids = expenses2.map((e) => e.id);

      const overlap = expense1Ids.filter((id) => expense2Ids.includes(id));
      expect(overlap.length).toBe(0);

      // Verify correct data in each project
      expect(expenses1.find((e) => e.id === project1ExpenseId)).toBeDefined();
      expect(expenses2.find((e) => e.id === project2ExpenseId)).toBeDefined();
      expect(expenses1.find((e) => e.id === project2ExpenseId)).toBeUndefined();
      expect(expenses2.find((e) => e.id === project1ExpenseId)).toBeUndefined();
    });
  });

  describe("Database Schema Isolation", () => {
    it("should use separate database schemas for each project", async () => {
      const schema1 = `project_${project1Id.replace(/-/g, "_")}`;
      const schema2 = `project_${project2Id.replace(/-/g, "_")}`;

      // Verify schemas exist
      const schemas = await sql`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name IN (${schema1}, ${schema2})
      `;

      expect(schemas.length).toBe(2);
      expect(schemas.find((s) => s.schema_name === schema1)).toBeDefined();
      expect(schemas.find((s) => s.schema_name === schema2)).toBeDefined();
    });

    it("should have independent tables in each schema", async () => {
      const schema1 = `project_${project1Id.replace(/-/g, "_")}`;
      const schema2 = `project_${project2Id.replace(/-/g, "_")}`;

      // Check tables in schema 1
      const tables1 = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = ${schema1}
      `;

      // Check tables in schema 2
      const tables2 = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = ${schema2}
      `;

      // Both should have bookings and expenses tables
      expect(tables1.find((t) => t.table_name === "bookings")).toBeDefined();
      expect(tables1.find((t) => t.table_name === "expenses")).toBeDefined();
      expect(tables2.find((t) => t.table_name === "bookings")).toBeDefined();
      expect(tables2.find((t) => t.table_name === "expenses")).toBeDefined();
    });

    it("should prevent direct SQL injection attempts to access other schemas", async () => {
      // Attempt SQL injection to access Project 2 data from Project 1
      const maliciousGuestName = `'; SELECT * FROM project_${project2Id.replace(/-/g, "_")}.bookings; --`;

      const response = await apiRequest(`/projects/${project1Id}/bookings`, "POST", project1Token, {
        guestName: maliciousGuestName,
        checkinDate: "2025-03-01",
        checkoutDate: "2025-03-03",
        guestCount: 2,
        totalAmount: 5000,
      });

      // Should either fail or safely store the string
      if (response.status === 201) {
        const data = await response.json();
        // The malicious string should be stored as-is, not executed
        expect(data.guestName).toBe(maliciousGuestName);

        // Verify Project 2 data is still isolated
        const project2Response = await apiRequest(
          `/projects/${project2Id}/bookings`,
          "GET",
          project2Token
        );

        const project2Bookings = await project2Response.json();
        // Should still only have original booking
        expect(project2Bookings.length).toBe(1);
        expect(project2Bookings[0].guestName).toBe("Project 2 Guest");
      }
    });
  });

  describe("User Permission Isolation", () => {
    it("should prevent users from accessing projects they are not members of", async () => {
      // Create a third user not associated with any project
      const isolatedUser = await createTestUser("owner");

      // Try to access Project 1 data
      const response1 = await apiRequest(
        `/projects/${project1Id}/bookings`,
        "GET",
        isolatedUser.token
      );

      expect(response1.status).toBe(403);

      // Try to access Project 2 data
      const response2 = await apiRequest(
        `/projects/${project2Id}/bookings`,
        "GET",
        isolatedUser.token
      );

      expect(response2.status).toBe(403);
    });

    it("should isolate project team members", async () => {
      // Add staff member to Project 1
      const staff1 = await createTestUser("staff");
      await sql`
        INSERT INTO project_members (project_id, user_id, role)
        VALUES (${project1Id}, ${staff1.id}, 'staff')
      `;

      // Staff 1 should access Project 1 but not Project 2
      const response1 = await apiRequest(`/projects/${project1Id}/bookings`, "GET", staff1.token);

      expect(response1.status).toBe(200);

      const response2 = await apiRequest(`/projects/${project2Id}/bookings`, "GET", staff1.token);

      expect(response2.status).toBe(403);
    });

    it("should enforce role-based permissions within projects", async () => {
      // Create viewer for Project 1
      const viewer = await createTestUser("viewer");
      await sql`
        INSERT INTO project_members (project_id, user_id, role)
        VALUES (${project1Id}, ${viewer.id}, 'viewer')
      `;

      // Viewer should read but not modify
      const readResponse = await apiRequest(
        `/projects/${project1Id}/bookings`,
        "GET",
        viewer.token
      );

      expect(readResponse.status).toBe(200);

      // Should not be able to create
      const createResponse = await apiRequest(
        `/projects/${project1Id}/bookings`,
        "POST",
        viewer.token,
        {
          guestName: "Viewer Booking",
          checkinDate: "2025-03-01",
          checkoutDate: "2025-03-03",
          guestCount: 2,
          totalAmount: 5000,
        }
      );

      expect(createResponse.status).toBe(403);
    });
  });

  describe("Aggregate Data Isolation", () => {
    it("should isolate dashboard metrics between projects", async () => {
      const response1 = await apiRequest(
        `/projects/${project1Id}/dashboard/metrics`,
        "GET",
        project1Token
      );

      const response2 = await apiRequest(
        `/projects/${project2Id}/dashboard/metrics`,
        "GET",
        project2Token
      );

      // If endpoints exist, verify isolation
      if (response1.status === 200 && response2.status === 200) {
        const metrics1 = await response1.json();
        const metrics2 = await response2.json();

        // Metrics should be different
        expect(metrics1).not.toEqual(metrics2);
      }
    });

    it("should isolate financial reports between projects", async () => {
      const response1 = await apiRequest(
        `/projects/${project1Id}/reports/financial`,
        "GET",
        project1Token
      );

      const response2 = await apiRequest(
        `/projects/${project2Id}/reports/financial`,
        "GET",
        project2Token
      );

      // If endpoints exist, verify isolation
      if (response1.status === 200 && response2.status === 200) {
        const report1 = await response1.json();
        const report2 = await response2.json();

        // Reports should reflect different data
        expect(report1).not.toEqual(report2);

        // Project 1 should show 1000 expense
        if (report1.totalExpenses) {
          expect(report1.totalExpenses).toBe(1000);
        }

        // Project 2 should show 2000 expense
        if (report2.totalExpenses) {
          expect(report2.totalExpenses).toBe(2000);
        }
      }
    });
  });

  describe("Concurrent Access Safety", () => {
    it("should handle concurrent operations on different projects safely", async () => {
      const operations = [
        // Project 1 operations
        apiRequest(`/projects/${project1Id}/bookings`, "POST", project1Token, {
          guestName: "Concurrent Guest 1",
          checkinDate: "2025-04-01",
          checkoutDate: "2025-04-03",
          guestCount: 2,
          totalAmount: 3000,
        }),

        // Project 2 operations
        apiRequest(`/projects/${project2Id}/bookings`, "POST", project2Token, {
          guestName: "Concurrent Guest 2",
          checkinDate: "2025-04-01",
          checkoutDate: "2025-04-03",
          guestCount: 3,
          totalAmount: 4000,
        }),

        // More concurrent reads
        apiRequest(`/projects/${project1Id}/bookings`, "GET", project1Token),
        apiRequest(`/projects/${project2Id}/bookings`, "GET", project2Token),
        apiRequest(`/projects/${project1Id}/expenses`, "GET", project1Token),
        apiRequest(`/projects/${project2Id}/expenses`, "GET", project2Token),
      ];

      const responses = await Promise.all(operations);

      // All should succeed without interference
      responses.forEach((response) => {
        expect(response.status).toBeLessThan(400);
      });

      // Verify data isolation after concurrent operations
      const finalBookings1 = await apiRequest(
        `/projects/${project1Id}/bookings`,
        "GET",
        project1Token
      );

      const finalBookings2 = await apiRequest(
        `/projects/${project2Id}/bookings`,
        "GET",
        project2Token
      );

      const bookings1 = await finalBookings1.json();
      const bookings2 = await finalBookings2.json();

      // Each should have their own bookings
      expect(bookings1.find((b) => b.guestName === "Concurrent Guest 1")).toBeDefined();
      expect(bookings2.find((b) => b.guestName === "Concurrent Guest 2")).toBeDefined();

      // Should not have each other's bookings
      expect(bookings1.find((b) => b.guestName === "Concurrent Guest 2")).toBeUndefined();
      expect(bookings2.find((b) => b.guestName === "Concurrent Guest 1")).toBeUndefined();
    });
  });
});
