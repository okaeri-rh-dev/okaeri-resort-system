/**
 * API Integration Tests
 * @since Phase 1.7 - Integration & E2E Validation
 *
 * Comprehensive integration testing for all API endpoints
 * covering authentication, bookings, expenses, and projects
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  createTestUser,
  createTestBooking,
  createTestExpense,
  apiRequest,
  cleanupAllTestData,
  verifyDatabaseConnection,
  TestUser,
  PerformanceTimer,
} from "./test-helpers";

describe("API Integration Tests", () => {
  let testProjectId: string;
  let authToken: string;
  let testUser: TestUser;
  const timer = new PerformanceTimer();

  beforeAll(async () => {
    // Verify database connection
    const isConnected = await verifyDatabaseConnection();
    if (!isConnected) {
      throw new Error("Database connection failed - cannot run integration tests");
    }

    // Set up test database and get auth token
    const setup = await setupTestDatabase();
    testProjectId = setup.projectId;
    authToken = setup.token;

    // Create additional test user
    testUser = await createTestUser("admin");

    timer.mark("setup-complete");
  });

  afterAll(async () => {
    await teardownTestDatabase(testProjectId);
    await cleanupAllTestData();

    // Log performance report
    console.log("Integration Test Performance:", timer.getReport());
  });

  describe("Authentication Endpoints", () => {
    it("should login with valid credentials", async () => {
      const response = await apiRequest("/auth/login", "POST", undefined, {
        email: "test@okaeri.ph",
        password: "TestPassword123!",
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("accessToken");
      expect(data).toHaveProperty("refreshToken");
      expect(data.user).toHaveProperty("email", "test@okaeri.ph");

      timer.mark("auth-login");
    });

    it("should reject invalid credentials", async () => {
      const response = await apiRequest("/auth/login", "POST", undefined, {
        email: "test@okaeri.ph",
        password: "wrongpassword",
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty("error");
    });

    it("should register new user", async () => {
      const response = await apiRequest("/auth/register", "POST", undefined, {
        email: "newuser@okaeri.ph",
        password: "SecurePass123!",
        firstName: "New",
        lastName: "User",
        projectName: "New Resort",
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data).toHaveProperty("accessToken");
      expect(data.user).toHaveProperty("email", "newuser@okaeri.ph");

      // Clean up
      await apiRequest("/auth/logout", "POST", data.accessToken);
    });

    it("should refresh access token", async () => {
      // First login to get tokens
      const loginResponse = await apiRequest("/auth/login", "POST", undefined, {
        email: "test@okaeri.ph",
        password: "TestPassword123!",
      });

      const { refreshToken } = await loginResponse.json();

      // Use refresh token
      const response = await apiRequest("/auth/refresh", "POST", undefined, {
        refreshToken,
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("accessToken");
      expect(data).toHaveProperty("refreshToken");
    });

    it("should get current user info", async () => {
      const response = await apiRequest("/auth/me", "GET", authToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("email", "test@okaeri.ph");
      expect(data).toHaveProperty("role", "owner");
    });

    it("should handle logout", async () => {
      const response = await apiRequest("/auth/logout", "POST", authToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("message", "Logged out successfully");
    });
  });

  describe("Booking Endpoints", () => {
    let bookingId: string;

    beforeEach(async () => {
      // Create a test booking for each test
      bookingId = await createTestBooking(testProjectId);
    });

    it("should create a new booking", async () => {
      const bookingData = {
        guestName: "John Doe",
        guestEmail: "john@example.com",
        checkinDate: "2025-03-01",
        checkoutDate: "2025-03-03",
        guestCount: 2,
        totalAmount: 5000,
        source: "direct",
        status: "confirmed",
      };

      const response = await apiRequest(
        `/projects/${testProjectId}/bookings`,
        "POST",
        authToken,
        bookingData
      );

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data).toHaveProperty("id");
      expect(data.guestName).toBe("John Doe");
      expect(data.totalAmount).toBe(5000);

      timer.mark("booking-create");
    });

    it("should get all bookings", async () => {
      const response = await apiRequest(`/projects/${testProjectId}/bookings`, "GET", authToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      // Verify booking structure
      const booking = data[0];
      expect(booking).toHaveProperty("id");
      expect(booking).toHaveProperty("guestName");
      expect(booking).toHaveProperty("totalAmount");
    });

    it("should get specific booking", async () => {
      const response = await apiRequest(
        `/projects/${testProjectId}/bookings/${bookingId}`,
        "GET",
        authToken
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("id", bookingId);
      expect(data).toHaveProperty("guestName", "Test Guest");
    });

    it("should update booking", async () => {
      const updateData = {
        guestCount: 3,
        totalAmount: 6000,
        status: "modified",
      };

      const response = await apiRequest(
        `/projects/${testProjectId}/bookings/${bookingId}`,
        "PUT",
        authToken,
        updateData
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.guestCount).toBe(3);
      expect(data.totalAmount).toBe(6000);
      expect(data.status).toBe("modified");
    });

    it("should delete booking", async () => {
      const response = await apiRequest(
        `/projects/${testProjectId}/bookings/${bookingId}`,
        "DELETE",
        authToken
      );

      expect(response.status).toBe(204);

      // Verify deletion
      const verifyResponse = await apiRequest(
        `/projects/${testProjectId}/bookings/${bookingId}`,
        "GET",
        authToken
      );

      expect(verifyResponse.status).toBe(404);
    });

    it("should filter bookings by date range", async () => {
      const response = await apiRequest(
        `/projects/${testProjectId}/bookings?startDate=2025-01-01&endDate=2025-12-31`,
        "GET",
        authToken
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);

      // All bookings should be within date range
      data.forEach((booking) => {
        const checkinDate = new Date(booking.checkinDate);
        expect(checkinDate.getFullYear()).toBe(2025);
      });
    });
  });

  describe("Expense Endpoints", () => {
    let expenseId: string;

    beforeEach(async () => {
      // Create a test expense
      expenseId = await createTestExpense(testProjectId, testUser.id);
    });

    it("should create a new expense", async () => {
      const expenseData = {
        description: "Office supplies",
        amount: 2500,
        category: "supplies",
        expenseDate: "2025-02-01",
        receiptUrl: "https://example.com/receipt.jpg",
      };

      const response = await apiRequest(
        `/projects/${testProjectId}/expenses`,
        "POST",
        authToken,
        expenseData
      );

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data).toHaveProperty("id");
      expect(data.description).toBe("Office supplies");
      expect(data.amount).toBe(2500);

      timer.mark("expense-create");
    });

    it("should get all expenses", async () => {
      const response = await apiRequest(`/projects/${testProjectId}/expenses`, "GET", authToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      const expense = data[0];
      expect(expense).toHaveProperty("id");
      expect(expense).toHaveProperty("description");
      expect(expense).toHaveProperty("amount");
    });

    it("should get specific expense", async () => {
      const response = await apiRequest(
        `/projects/${testProjectId}/expenses/${expenseId}`,
        "GET",
        authToken
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("id", expenseId);
      expect(data).toHaveProperty("description", "Test Expense");
    });

    it("should update expense", async () => {
      const updateData = {
        amount: 3000,
        description: "Updated expense description",
      };

      const response = await apiRequest(
        `/projects/${testProjectId}/expenses/${expenseId}`,
        "PUT",
        authToken,
        updateData
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.amount).toBe(3000);
      expect(data.description).toBe("Updated expense description");
    });

    it("should delete expense", async () => {
      const response = await apiRequest(
        `/projects/${testProjectId}/expenses/${expenseId}`,
        "DELETE",
        authToken
      );

      expect(response.status).toBe(204);

      // Verify deletion
      const verifyResponse = await apiRequest(
        `/projects/${testProjectId}/expenses/${expenseId}`,
        "GET",
        authToken
      );

      expect(verifyResponse.status).toBe(404);
    });

    it("should filter expenses by category", async () => {
      const response = await apiRequest(
        `/projects/${testProjectId}/expenses?category=supplies`,
        "GET",
        authToken
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);

      // All expenses should be in supplies category
      data.forEach((expense) => {
        expect(expense.category).toBe("supplies");
      });
    });
  });

  describe("Project Management", () => {
    it("should create a new project", async () => {
      const projectData = {
        name: "Beach Paradise Resort",
        businessType: "resort",
        location: "Palawan",
        currency: "PHP",
      };

      const response = await apiRequest("/projects", "POST", authToken, projectData);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data).toHaveProperty("id");
      expect(data.name).toBe("Beach Paradise Resort");
      expect(data.businessType).toBe("resort");
    });

    it("should get all user projects", async () => {
      const response = await apiRequest("/projects", "GET", authToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      const project = data[0];
      expect(project).toHaveProperty("id");
      expect(project).toHaveProperty("name");
      expect(project).toHaveProperty("schemaName");
    });

    it("should get specific project details", async () => {
      const response = await apiRequest(`/projects/${testProjectId}`, "GET", authToken);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("id", testProjectId);
      expect(data).toHaveProperty("name", "Test Resort");
      expect(data).toHaveProperty("businessType", "resort");
    });

    it("should update project settings", async () => {
      const updateData = {
        name: "Updated Resort Name",
        location: "Boracay",
      };

      const response = await apiRequest(`/projects/${testProjectId}`, "PUT", authToken, updateData);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.name).toBe("Updated Resort Name");
      expect(data.location).toBe("Boracay");
    });

    it("should switch between projects", async () => {
      // Create second project
      const projectResponse = await apiRequest("/projects", "POST", authToken, {
        name: "Second Resort",
        businessType: "hotel",
      });

      const newProject = await projectResponse.json();

      // Switch to new project
      const switchResponse = await apiRequest(
        `/projects/${newProject.id}/switch`,
        "POST",
        authToken
      );

      expect(switchResponse.status).toBe(200);

      const data = await switchResponse.json();
      expect(data).toHaveProperty("projectId", newProject.id);
      expect(data).toHaveProperty("token");
    });
  });

  describe("Performance Benchmarks", () => {
    it("should meet API response time targets", async () => {
      const endpoints = [
        { path: "/auth/me", method: "GET" },
        { path: `/projects/${testProjectId}/bookings`, method: "GET" },
        { path: `/projects/${testProjectId}/expenses`, method: "GET" },
      ];

      for (const endpoint of endpoints) {
        const startTime = Date.now();
        const response = await apiRequest(endpoint.path, endpoint.method, authToken);
        const responseTime = Date.now() - startTime;

        expect(response.status).toBeLessThan(400);
        expect(responseTime).toBeLessThan(500); // Target: < 500ms

        console.log(`${endpoint.path}: ${responseTime}ms`);
      }
    });

    it("should handle concurrent requests efficiently", async () => {
      const concurrentRequests = 10;
      const requests = Array(concurrentRequests)
        .fill(null)
        .map(() => apiRequest(`/projects/${testProjectId}/bookings`, "GET", authToken));

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      const avgTime = totalTime / concurrentRequests;
      expect(avgTime).toBeLessThan(200); // Target: < 200ms average

      console.log(
        `Concurrent requests (${concurrentRequests}): ${totalTime}ms total, ${avgTime}ms avg`
      );
    });
  });

  describe("Error Handling", () => {
    it("should return 401 for unauthenticated requests", async () => {
      const response = await apiRequest(`/projects/${testProjectId}/bookings`, "GET");

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty("error");
    });

    it("should return 403 for unauthorized access", async () => {
      // Create a viewer user with limited permissions
      const viewerUser = await createTestUser("viewer");

      // Try to create booking with viewer token (should be forbidden)
      const response = await apiRequest(
        `/projects/${testProjectId}/bookings`,
        "POST",
        viewerUser.token,
        {
          guestName: "Test",
          checkinDate: "2025-03-01",
          checkoutDate: "2025-03-03",
          guestCount: 2,
          totalAmount: 5000,
        }
      );

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty("error");
    });

    it("should return 404 for non-existent resources", async () => {
      const fakeId = "123e4567-e89b-12d3-a456-426614174000";

      const response = await apiRequest(
        `/projects/${testProjectId}/bookings/${fakeId}`,
        "GET",
        authToken
      );

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty("error");
    });

    it("should return 400 for invalid input", async () => {
      const invalidBooking = {
        guestName: "", // Empty name
        checkinDate: "invalid-date",
        checkoutDate: "2025-01-01",
        guestCount: -1, // Negative count
        totalAmount: "not-a-number",
      };

      const response = await apiRequest(
        `/projects/${testProjectId}/bookings`,
        "POST",
        authToken,
        invalidBooking
      );

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty("error");
      expect(data).toHaveProperty("details");
    });

    it("should handle database connection errors gracefully", async () => {
      // This would typically be tested by mocking database failures
      // For now, we'll test with an invalid project ID format
      const response = await apiRequest(`/projects/invalid-project-id/bookings`, "GET", authToken);

      expect(response.status).toBeGreaterThanOrEqual(400);

      const data = await response.json();
      expect(data).toHaveProperty("error");
    });
  });
});
