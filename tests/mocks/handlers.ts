/**
 * MSW request handlers for authentication API mocking
 * Provides realistic API responses with Philippine-specific data
 */

import { http, HttpResponse } from "msw";
import { MOCK_USERS, TEST_CONSTANTS, philippineTestData } from "../utils/test-utils";
import type { User, Booking, Project, ProjectMembership } from "@/types/common";

// Enhanced mock database for comprehensive testing
let mockDatabase = {
  users: new Map<string, User>([
    [MOCK_USERS.OWNER.id, MOCK_USERS.OWNER],
    [MOCK_USERS.MANAGER.id, MOCK_USERS.MANAGER],
    [MOCK_USERS.STAFF.id, MOCK_USERS.STAFF],
  ]),
  sessions: new Map<string, { userId: string; expiresAt: number }>(),
  refreshTokens: new Map<string, { userId: string; expiresAt: number }>(),
  rateLimits: new Map<string, { count: number; resetAt: number }>(),
  auditLogs: [] as Array<{ event: string; userId?: string; timestamp: number; details?: any }>,
  bookings: new Map<string, Booking>([
    [
      "booking-1",
      {
        id: "booking-1",
        propertyId: "property-boracay-1",
        guestName: "Juan Dela Cruz",
        guestEmail: "juan@gmail.com",
        guestPhone: "+639171234567",
        checkIn: "2024-12-25",
        checkOut: "2024-12-28",
        guests: 2,
        status: "CONFIRMED",
        source: "Walk-in",
        totalAmount: 15000,
        paidAmount: 7500,
        paymentMethod: "GCash",
        notes: "Christmas holiday booking",
        specialRequests: "Late check-in requested",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      },
    ],
    [
      "booking-2",
      {
        id: "booking-2",
        propertyId: "property-palawan-1",
        guestName: "Maria Santos",
        guestEmail: "maria@yahoo.com.ph",
        guestPhone: "+639281234567",
        checkIn: "2024-01-15",
        checkOut: "2024-01-18",
        guests: 4,
        status: "CHECKED_OUT",
        source: "Online",
        totalAmount: 25000,
        paidAmount: 25000,
        paymentMethod: "Bank Transfer",
        notes: "Family vacation",
        specialRequests: "Extra beds for children",
        createdAt: new Date("2024-01-10"),
        updatedAt: new Date("2024-01-18"),
      },
    ],
  ]),
  projects: new Map<string, Project>([
    [
      "project-boracay-1",
      {
        id: "project-boracay-1",
        name: "Okaeri Boracay Resort",
        type: "BEACH_RESORT",
        description: "Premium beachfront resort in Boracay Station 2",
        status: "ACTIVE",
        currency: "PHP",
        timezone: "Asia/Manila",
        locale: "en-PH",
        ownerId: MOCK_USERS.OWNER.id,
        config: {
          businessHours: "8:00-18:00",
          checkInTime: "14:00",
          checkOutTime: "12:00",
          allowOnlineBooking: true,
          requireDeposit: true,
          depositPercentage: 50,
        },
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-15"),
      },
    ],
  ]),
  projectMembers: new Map<string, ProjectMembership>([
    [
      "membership-1",
      {
        id: "membership-1",
        projectId: "project-boracay-1",
        userId: MOCK_USERS.OWNER.id,
        role: "OWNER",
        permissions: ["ALL"],
        invitedBy: null,
        joinedAt: new Date("2024-01-01"),
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      },
    ],
  ]),
};

// Helper functions
const delay = (ms: number = 100) => new Promise((resolve) => setTimeout(resolve, ms));

const generateToken = (userId: string, role: string) => {
  const header = btoa(JSON.stringify({ typ: "JWT", alg: "HS256" }));
  const payload = btoa(
    JSON.stringify({
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      role,
      iat: Math.floor(Date.now() / 1000),
    })
  );
  const signature = "mock-signature";
  return `${header}.${payload}.${signature}`;
};

const generateRefreshToken = () => {
  return `refresh_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
};

const isRateLimited = (key: string, limit: number = 5, windowMs: number = 300000) => {
  const now = Date.now();
  const rateLimitEntry = mockDatabase.rateLimits.get(key);

  if (!rateLimitEntry || now > rateLimitEntry.resetAt) {
    mockDatabase.rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, retryAfter: 0 };
  }

  if (rateLimitEntry.count >= limit) {
    return {
      limited: true,
      retryAfter: Math.ceil((rateLimitEntry.resetAt - now) / 1000),
    };
  }

  rateLimitEntry.count++;
  return { limited: false, retryAfter: 0 };
};

const findUserByEmail = (email: string): User | undefined => {
  return Array.from(mockDatabase.users.values()).find((user) => user.email === email);
};

export const handlers = [
  // Auth endpoints
  http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/login`, async ({ request }) => {
    await delay();

    const { email, password } = (await request.json()) as { email: string; password: string };

    // Check rate limiting
    const rateLimit = isRateLimited(`login:${email}`, 5, 300000);
    if (rateLimit.limited) {
      return HttpResponse.json(
        { error: "Too many login attempts", retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    // Find user
    const user = findUserByEmail(email);
    if (!user) {
      return HttpResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Mock password validation (in real app, compare hashed passwords)
    if (password === "wrong-password") {
      return HttpResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Generate tokens
    const token = generateToken(user.id, user.role);
    const refreshToken = generateRefreshToken();

    // Store session
    mockDatabase.sessions.set(token, { userId: user.id, expiresAt: Date.now() + 3600000 });
    mockDatabase.refreshTokens.set(refreshToken, {
      userId: user.id,
      expiresAt: Date.now() + 7 * 24 * 3600000,
    });

    // Log audit event
    mockDatabase.auditLogs.push({
      event: "LOGIN_SUCCESS",
      userId: user.id,
      timestamp: Date.now(),
      details: { email, userAgent: "test-agent" },
    });

    return HttpResponse.json({
      user,
      token,
      refreshToken,
    });
  }),

  http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/register`, async ({ request }) => {
    await delay();

    const { email, password, name, projectName, phone } = (await request.json()) as {
      email: string;
      password: string;
      name: string;
      projectName?: string;
      phone?: string;
    };

    // Check if user already exists
    if (findUserByEmail(email)) {
      return HttpResponse.json({ error: "User already exists" }, { status: 409 });
    }

    // Check rate limiting
    const rateLimit = isRateLimited(`register:${email}`, 3, 3600000);
    if (rateLimit.limited) {
      return HttpResponse.json(
        { error: "Too many registration attempts", retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    // Create new user
    const newUser: User = {
      id: `user-${Date.now()}`,
      email,
      name,
      role: "OWNER", // First user becomes owner
      phone: phone || null,
      projectId: `project-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockDatabase.users.set(newUser.id, newUser);

    // Generate tokens
    const token = generateToken(newUser.id, newUser.role);
    const refreshToken = generateRefreshToken();

    // Store session
    mockDatabase.sessions.set(token, { userId: newUser.id, expiresAt: Date.now() + 3600000 });
    mockDatabase.refreshTokens.set(refreshToken, {
      userId: newUser.id,
      expiresAt: Date.now() + 7 * 24 * 3600000,
    });

    // Log audit event
    mockDatabase.auditLogs.push({
      event: "REGISTER_SUCCESS",
      userId: newUser.id,
      timestamp: Date.now(),
      details: { email, projectName },
    });

    return HttpResponse.json({
      user: newUser,
      token,
      refreshToken,
    });
  }),

  http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/refresh`, async ({ request }) => {
    await delay();

    const { refreshToken } = (await request.json()) as { refreshToken: string };

    // Validate refresh token
    const refreshEntry = mockDatabase.refreshTokens.get(refreshToken);
    if (!refreshEntry || Date.now() > refreshEntry.expiresAt) {
      return HttpResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    }

    // Get user
    const user = mockDatabase.users.get(refreshEntry.userId);
    if (!user) {
      return HttpResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate new tokens
    const newToken = generateToken(user.id, user.role);
    const newRefreshToken = generateRefreshToken();

    // Update sessions
    mockDatabase.refreshTokens.delete(refreshToken);
    mockDatabase.sessions.set(newToken, { userId: user.id, expiresAt: Date.now() + 3600000 });
    mockDatabase.refreshTokens.set(newRefreshToken, {
      userId: user.id,
      expiresAt: Date.now() + 7 * 24 * 3600000,
    });

    // Log audit event
    mockDatabase.auditLogs.push({
      event: "TOKEN_REFRESH_SUCCESS",
      userId: user.id,
      timestamp: Date.now(),
    });

    return HttpResponse.json({
      token: newToken,
      refreshToken: newRefreshToken,
    });
  }),

  http.get(`${TEST_CONSTANTS.API_BASE_URL}/auth/me`, async ({ request }) => {
    await delay();

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return HttpResponse.json({ error: "No authorization token provided" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const session = mockDatabase.sessions.get(token);

    if (!session || Date.now() > session.expiresAt) {
      return HttpResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const user = mockDatabase.users.get(session.userId);
    if (!user) {
      return HttpResponse.json({ error: "User not found" }, { status: 404 });
    }

    return HttpResponse.json(user);
  }),

  http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/logout`, async ({ request }) => {
    await delay();

    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const session = mockDatabase.sessions.get(token);

      if (session) {
        // Remove session
        mockDatabase.sessions.delete(token);

        // Log audit event
        mockDatabase.auditLogs.push({
          event: "LOGOUT_SUCCESS",
          userId: session.userId,
          timestamp: Date.now(),
        });
      }
    }

    return HttpResponse.json({ message: "Logged out successfully" });
  }),

  http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/reset-password`, async ({ request }) => {
    await delay();

    const { email } = (await request.json()) as { email: string };

    // Check rate limiting
    const rateLimit = isRateLimited(`password-reset:${email}`, 3, 3600000);
    if (rateLimit.limited) {
      return HttpResponse.json(
        { error: "Too many password reset attempts", retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    const user = findUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists or not for security
      return HttpResponse.json({ message: "If the email exists, a reset link has been sent" });
    }

    // Log audit event
    mockDatabase.auditLogs.push({
      event: "PASSWORD_RESET_REQUEST",
      userId: user.id,
      timestamp: Date.now(),
      details: { email },
    });

    return HttpResponse.json({ message: "Password reset email sent" });
  }),

  http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/update-password`, async ({ request }) => {
    await delay();

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return HttpResponse.json({ error: "No authorization token provided" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const session = mockDatabase.sessions.get(token);

    if (!session || Date.now() > session.expiresAt) {
      return HttpResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const { currentPassword, newPassword } = (await request.json()) as {
      currentPassword: string;
      newPassword: string;
    };

    // Mock current password validation
    if (currentPassword === "wrong-current-password") {
      return HttpResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    // Log audit event
    mockDatabase.auditLogs.push({
      event: "PASSWORD_CHANGE_SUCCESS",
      userId: session.userId,
      timestamp: Date.now(),
    });

    return HttpResponse.json({ message: "Password updated successfully" });
  }),

  http.patch(`${TEST_CONSTANTS.API_BASE_URL}/auth/profile`, async ({ request }) => {
    await delay();

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return HttpResponse.json({ error: "No authorization token provided" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const session = mockDatabase.sessions.get(token);

    if (!session || Date.now() > session.expiresAt) {
      return HttpResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const user = mockDatabase.users.get(session.userId);
    if (!user) {
      return HttpResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updates = (await request.json()) as Partial<User>;

    // Update user
    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date(),
    };

    mockDatabase.users.set(user.id, updatedUser);

    // Log audit event
    mockDatabase.auditLogs.push({
      event: "PROFILE_UPDATE_SUCCESS",
      userId: user.id,
      timestamp: Date.now(),
      details: updates,
    });

    return HttpResponse.json(updatedUser);
  }),

  // Health check endpoint
  http.get(`${TEST_CONSTANTS.API_BASE_URL}/health/check`, async () => {
    await delay(50);
    return HttpResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: "test",
    });
  }),

  // Mock error scenarios for testing
  http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/login-slow`, async () => {
    await delay(5000); // Simulate slow response
    return HttpResponse.json({ error: "Request timeout" }, { status: 408 });
  }),

  http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/login-server-error`, async () => {
    await delay();
    return HttpResponse.json({ error: "Internal server error" }, { status: 500 });
  }),

  http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/login-network-error`, async () => {
    // Simulate network error
    return HttpResponse.error();
  }),

  // Booking endpoints
  http.get(`${TEST_CONSTANTS.API_BASE_URL}/bookings`, ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const propertyId = url.searchParams.get("propertyId");
    const paymentStatus = url.searchParams.getAll("paymentStatus");

    let bookings = Array.from(mockDatabase.bookings.values());

    // Apply filters
    if (propertyId) {
      bookings = bookings.filter((b) => b.propertyId === propertyId);
    }

    if (paymentStatus.length > 0) {
      bookings = bookings.filter((b) => {
        const status =
          b.paidAmount >= b.totalAmount ? "PAID" : b.paidAmount > 0 ? "PARTIAL" : "UNPAID";
        return paymentStatus.includes(status);
      });
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedBookings = bookings.slice(startIndex, endIndex);

    return HttpResponse.json({
      data: paginatedBookings,
      meta: {
        page,
        limit,
        total: bookings.length,
        pages: Math.ceil(bookings.length / limit),
      },
      stats: {
        totalBookings: bookings.length,
        confirmedBookings: bookings.filter((b) => b.status === "CONFIRMED").length,
        todayCheckIns: 0,
        todayCheckOuts: 1,
        totalRevenue: bookings.reduce((sum, b) => sum + b.totalAmount, 0),
        totalPaid: bookings.reduce((sum, b) => sum + b.paidAmount, 0),
        avgStayLength: 2.7,
        avgGuests: 2.3,
      },
    });
  }),

  http.get(`${TEST_CONSTANTS.API_BASE_URL}/bookings/:id`, ({ params }) => {
    const booking = mockDatabase.bookings.get(params.id as string);
    if (!booking) {
      return HttpResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    return HttpResponse.json(booking);
  }),

  http.post(`${TEST_CONSTANTS.API_BASE_URL}/bookings/create`, async ({ request }) => {
    await delay();
    const data = (await request.json()) as any;

    // Validate required fields
    if (!data.propertyId || !data.guestName || !data.checkIn || !data.checkOut) {
      return HttpResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate Philippine phone number if provided
    if (
      data.guestPhone &&
      !philippineTestData.validPhoneNumbers.some(
        (valid) => valid.replace(/\D/g, "") === data.guestPhone.replace(/\D/g, "")
      )
    ) {
      return HttpResponse.json(
        { error: "Invalid Philippine phone number format" },
        { status: 400 }
      );
    }

    // Validate dates
    const checkIn = new Date(data.checkIn);
    const checkOut = new Date(data.checkOut);
    if (checkOut <= checkIn) {
      return HttpResponse.json({ error: "Check-out must be after check-in" }, { status: 400 });
    }

    // Create new booking
    const newBooking = {
      id: `booking-${Date.now()}`,
      ...data,
      status: data.status || "PENDING",
      paidAmount: data.paidAmount || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockDatabase.bookings.set(newBooking.id, newBooking);
    return HttpResponse.json(newBooking, { status: 201 });
  }),

  http.put(`${TEST_CONSTANTS.API_BASE_URL}/bookings/:id`, async ({ params, request }) => {
    await delay();
    const bookingId = params.id as string;
    const updates = (await request.json()) as any;
    const booking = mockDatabase.bookings.get(bookingId);

    if (!booking) {
      return HttpResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Validate phone number if updating
    if (
      updates.guestPhone &&
      !philippineTestData.validPhoneNumbers.some(
        (valid) => valid.replace(/\D/g, "") === updates.guestPhone.replace(/\D/g, "")
      )
    ) {
      return HttpResponse.json(
        { error: "Invalid Philippine phone number format" },
        { status: 400 }
      );
    }

    // Update booking
    const updatedBooking = {
      ...booking,
      ...updates,
      updatedAt: new Date(),
    };

    mockDatabase.bookings.set(bookingId, updatedBooking);
    return HttpResponse.json(updatedBooking);
  }),

  http.delete(`${TEST_CONSTANTS.API_BASE_URL}/bookings/:id`, async ({ params }) => {
    await delay();
    const bookingId = params.id as string;

    if (!mockDatabase.bookings.has(bookingId)) {
      return HttpResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    mockDatabase.bookings.delete(bookingId);
    return HttpResponse.json({ message: "Booking cancelled successfully" });
  }),

  http.get(`${TEST_CONSTANTS.API_BASE_URL}/bookings/check-availability`, ({ request }) => {
    const url = new URL(request.url);
    const propertyId = url.searchParams.get("propertyId");
    const checkIn = url.searchParams.get("checkIn");
    const checkOut = url.searchParams.get("checkOut");
    const excludeBookingId = url.searchParams.get("excludeBookingId");

    if (!propertyId || !checkIn || !checkOut) {
      return HttpResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Check for conflicts
    const conflicts = Array.from(mockDatabase.bookings.values()).filter(
      (booking) =>
        booking.id !== excludeBookingId &&
        booking.propertyId === propertyId &&
        booking.status !== "CANCELLED" &&
        !(
          new Date(booking.checkOut) <= new Date(checkIn) ||
          new Date(booking.checkIn) >= new Date(checkOut)
        )
    );

    return HttpResponse.json({
      available: conflicts.length === 0,
      conflicts,
    });
  }),

  http.get(`${TEST_CONSTANTS.API_BASE_URL}/bookings/calendar`, ({ request }) => {
    const url = new URL(request.url);
    const propertyId = url.searchParams.get("propertyId");
    const month = parseInt(url.searchParams.get("month") || "1");
    const year = parseInt(url.searchParams.get("year") || "2024");

    let calendarBookings = Array.from(mockDatabase.bookings.values()).map((booking) => ({
      id: booking.id,
      propertyId: booking.propertyId,
      propertyName: `Property ${booking.propertyId.split("-")[1]}`,
      guestName: booking.guestName,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      status: booking.status,
    }));

    if (propertyId) {
      calendarBookings = calendarBookings.filter((b) => b.propertyId === propertyId);
    }

    // Filter by month/year
    calendarBookings = calendarBookings.filter((booking) => {
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      return (
        (checkIn.getFullYear() === year && checkIn.getMonth() + 1 === month) ||
        (checkOut.getFullYear() === year && checkOut.getMonth() + 1 === month)
      );
    });

    return HttpResponse.json({ bookings: calendarBookings });
  }),

  http.post(`${TEST_CONSTANTS.API_BASE_URL}/bookings/import-csv`, async ({ request }) => {
    await delay();
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return HttpResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".csv")) {
      return HttpResponse.json({ error: "File must be CSV format" }, { status: 400 });
    }

    // Simulate CSV processing with Philippine-specific validation errors
    return HttpResponse.json({
      imported: 5,
      failed: 1,
      errors: [{ row: 3, error: "Invalid Philippine phone number format" }],
    });
  }),

  // Project endpoints
  http.get(`${TEST_CONSTANTS.API_BASE_URL}/projects`, ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search");
    const status = url.searchParams.get("status");

    let projects = Array.from(mockDatabase.projects.values());

    if (search) {
      projects = projects.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.description?.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (status) {
      projects = projects.filter((p) => p.status === status);
    }

    return HttpResponse.json(projects);
  }),

  http.get(`${TEST_CONSTANTS.API_BASE_URL}/projects/paginated`, ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const search = url.searchParams.get("search");

    let projects = Array.from(mockDatabase.projects.values());

    if (search) {
      projects = projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProjects = projects.slice(startIndex, endIndex);

    return HttpResponse.json({
      data: paginatedProjects,
      meta: {
        page,
        limit,
        total: projects.length,
        pages: Math.ceil(projects.length / limit),
      },
    });
  }),

  http.get(`${TEST_CONSTANTS.API_BASE_URL}/projects/:id`, ({ params }) => {
    const project = mockDatabase.projects.get(params.id as string);
    if (!project) {
      return HttpResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return HttpResponse.json(project);
  }),

  http.post(`${TEST_CONSTANTS.API_BASE_URL}/projects`, async ({ request }) => {
    await delay();
    const data = (await request.json()) as any;

    // Validate required fields
    if (!data.name || !data.type) {
      return HttpResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check for duplicate name
    const existingProject = Array.from(mockDatabase.projects.values()).find(
      (p) => p.name === data.name && p.status !== "ARCHIVED"
    );
    if (existingProject) {
      return HttpResponse.json({ error: "Project name already exists" }, { status: 409 });
    }

    // Create new project with Philippine defaults
    const newProject = {
      id: `project-${Date.now()}`,
      name: data.name,
      type: data.type,
      description: data.description || null,
      status: "ACTIVE",
      currency: data.currency || "PHP",
      timezone: data.timezone || "Asia/Manila",
      locale: data.locale || "en-PH",
      ownerId: MOCK_USERS.OWNER.id,
      config: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockDatabase.projects.set(newProject.id, newProject);
    return HttpResponse.json(newProject, { status: 201 });
  }),

  http.patch(`${TEST_CONSTANTS.API_BASE_URL}/projects/:id`, async ({ params, request }) => {
    await delay();
    const projectId = params.id as string;
    const updates = (await request.json()) as any;
    const project = mockDatabase.projects.get(projectId);

    if (!project) {
      return HttpResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Update project
    const updatedProject = {
      ...project,
      ...updates,
      updatedAt: new Date(),
    };

    mockDatabase.projects.set(projectId, updatedProject);
    return HttpResponse.json(updatedProject);
  }),

  http.delete(`${TEST_CONSTANTS.API_BASE_URL}/projects/:id`, async ({ params }) => {
    await delay();
    const projectId = params.id as string;

    if (!mockDatabase.projects.has(projectId)) {
      return HttpResponse.json({ error: "Project not found" }, { status: 404 });
    }

    mockDatabase.projects.delete(projectId);
    return HttpResponse.json({ message: "Project deleted successfully" });
  }),

  http.post(`${TEST_CONSTANTS.API_BASE_URL}/projects/:id/archive`, async ({ params }) => {
    await delay();
    const projectId = params.id as string;
    const project = mockDatabase.projects.get(projectId);

    if (!project) {
      return HttpResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const archivedProject = {
      ...project,
      status: "ARCHIVED",
      updatedAt: new Date(),
    };

    mockDatabase.projects.set(projectId, archivedProject);
    return HttpResponse.json(archivedProject);
  }),

  http.post(`${TEST_CONSTANTS.API_BASE_URL}/projects/:id/restore`, async ({ params }) => {
    await delay();
    const projectId = params.id as string;
    const project = mockDatabase.projects.get(projectId);

    if (!project) {
      return HttpResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const restoredProject = {
      ...project,
      status: "ACTIVE",
      updatedAt: new Date(),
    };

    mockDatabase.projects.set(projectId, restoredProject);
    return HttpResponse.json(restoredProject);
  }),

  http.get(`${TEST_CONSTANTS.API_BASE_URL}/projects/:id/stats`, ({ params }) => {
    const project = mockDatabase.projects.get(params.id as string);
    if (!project) {
      return HttpResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Mock project statistics with Philippine resort data
    return HttpResponse.json({
      totalBookings: 156,
      totalRevenue: 2340000,
      occupancyRate: 0.78,
      averageRating: 4.6,
      totalGuests: 387,
      repeatCustomers: 23,
      monthlyGrowth: 0.12,
      topPaymentMethods: ["GCash", "Bank Transfer", "Cash"],
      peakSeason: {
        months: ["December", "January", "April", "May"],
        multiplier: 1.3,
      },
    });
  }),

  http.get(`${TEST_CONSTANTS.API_BASE_URL}/projects/:id/members`, ({ params }) => {
    const members = Array.from(mockDatabase.projectMembers.values()).filter(
      (m) => m.projectId === params.id
    );
    return HttpResponse.json(members);
  }),

  http.post(
    `${TEST_CONSTANTS.API_BASE_URL}/projects/:id/members/invite`,
    async ({ params, request }) => {
      await delay();
      const data = (await request.json()) as any;

      // Validate email format
      if (!data.email.includes("@")) {
        return HttpResponse.json({ error: "Invalid email format" }, { status: 400 });
      }

      // Check if user already exists in project
      const existingMember = Array.from(mockDatabase.projectMembers.values()).find(
        (m) => m.projectId === params.id && m.userId === data.email
      );
      if (existingMember) {
        return HttpResponse.json({ error: "User already member of project" }, { status: 409 });
      }

      // Create new membership
      const newMembership = {
        id: `membership-${Date.now()}`,
        projectId: params.id as string,
        userId: `user-${Date.now()}`, // Mock user ID
        role: data.role,
        permissions: data.permissions || [],
        invitedBy: MOCK_USERS.OWNER.id,
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.projectMembers.set(newMembership.id, newMembership);
      return HttpResponse.json(newMembership, { status: 201 });
    }
  ),

  http.delete(
    `${TEST_CONSTANTS.API_BASE_URL}/projects/:projectId/members/:userId`,
    async ({ params }) => {
      await delay();
      const { projectId, userId } = params;

      const membership = Array.from(mockDatabase.projectMembers.entries()).find(
        ([id, m]) => m.projectId === projectId && m.userId === userId
      );

      if (!membership) {
        return HttpResponse.json({ error: "Member not found" }, { status: 404 });
      }

      // Don't allow removing the owner
      if (membership[1].role === "OWNER") {
        return HttpResponse.json({ error: "Cannot remove project owner" }, { status: 403 });
      }

      mockDatabase.projectMembers.delete(membership[0]);
      return HttpResponse.json({ message: "Member removed successfully" });
    }
  ),

  http.patch(
    `${TEST_CONSTANTS.API_BASE_URL}/projects/:projectId/members/:userId`,
    async ({ params, request }) => {
      await delay();
      const { projectId, userId } = params;
      const updates = (await request.json()) as any;

      const membershipEntry = Array.from(mockDatabase.projectMembers.entries()).find(
        ([id, m]) => m.projectId === projectId && m.userId === userId
      );

      if (!membershipEntry) {
        return HttpResponse.json({ error: "Member not found" }, { status: 404 });
      }

      const [membershipId, membership] = membershipEntry;

      // Don't allow changing owner role
      if (membership.role === "OWNER") {
        return HttpResponse.json({ error: "Cannot change owner role" }, { status: 403 });
      }

      // Update membership
      const updatedMembership = {
        ...membership,
        role: updates.role,
        permissions: updates.permissions || membership.permissions,
        updatedAt: new Date(),
      };

      mockDatabase.projectMembers.set(membershipId, updatedMembership);
      return HttpResponse.json(updatedMembership);
    }
  ),

  http.get(`${TEST_CONSTANTS.API_BASE_URL}/projects/:id/activity`, ({ request, params }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    // Mock activity logs with Philippine context
    const activityLogs = [
      {
        id: "activity-1",
        projectId: params.id,
        userId: MOCK_USERS.OWNER.id,
        action: "PROJECT_CREATED",
        description: "Project created",
        metadata: { projectName: "Okaeri Resort" },
        createdAt: new Date("2024-01-01"),
      },
      {
        id: "activity-2",
        projectId: params.id,
        userId: MOCK_USERS.MANAGER.id,
        action: "BOOKING_CREATED",
        description: "New booking created for Juan Dela Cruz",
        metadata: {
          bookingId: "booking-123",
          guestName: "Juan Dela Cruz",
          amount: 15000,
          paymentMethod: "GCash",
        },
        createdAt: new Date("2024-01-15"),
      },
    ];

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedLogs = activityLogs.slice(startIndex, endIndex);

    return HttpResponse.json({
      data: paginatedLogs,
      meta: {
        page,
        limit,
        total: activityLogs.length,
        pages: Math.ceil(activityLogs.length / limit),
      },
    });
  }),

  // Fallback handler for unhandled requests
  http.all("*", ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`);
    return HttpResponse.json(
      { error: `Unhandled request: ${request.method} ${request.url}` },
      { status: 404 }
    );
  }),
];

// Export mock database for testing utilities
export { mockDatabase };

// Helper functions for test setup
export const mockHelpers = {
  reset: () => {
    mockDatabase = {
      users: new Map([
        [MOCK_USERS.OWNER.id, MOCK_USERS.OWNER],
        [MOCK_USERS.MANAGER.id, MOCK_USERS.MANAGER],
        [MOCK_USERS.STAFF.id, MOCK_USERS.STAFF],
      ]),
      sessions: new Map(),
      refreshTokens: new Map(),
      rateLimits: new Map(),
      auditLogs: [],
      bookings: new Map([
        [
          "booking-1",
          {
            id: "booking-1",
            propertyId: "property-boracay-1",
            guestName: "Juan Dela Cruz",
            guestEmail: "juan@gmail.com",
            guestPhone: "+639171234567",
            checkIn: "2024-12-25",
            checkOut: "2024-12-28",
            guests: 2,
            status: "CONFIRMED",
            source: "Walk-in",
            totalAmount: 15000,
            paidAmount: 7500,
            paymentMethod: "GCash",
            notes: "Christmas holiday booking",
            specialRequests: "Late check-in requested",
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
          },
        ],
        [
          "booking-2",
          {
            id: "booking-2",
            propertyId: "property-palawan-1",
            guestName: "Maria Santos",
            guestEmail: "maria@yahoo.com.ph",
            guestPhone: "+639281234567",
            checkIn: "2024-01-15",
            checkOut: "2024-01-18",
            guests: 4,
            status: "CHECKED_OUT",
            source: "Online",
            totalAmount: 25000,
            paidAmount: 25000,
            paymentMethod: "Bank Transfer",
            notes: "Family vacation",
            specialRequests: "Extra beds for children",
            createdAt: new Date("2024-01-10"),
            updatedAt: new Date("2024-01-18"),
          },
        ],
      ]),
      projects: new Map([
        [
          "project-boracay-1",
          {
            id: "project-boracay-1",
            name: "Okaeri Boracay Resort",
            type: "BEACH_RESORT",
            description: "Premium beachfront resort in Boracay Station 2",
            status: "ACTIVE",
            currency: "PHP",
            timezone: "Asia/Manila",
            locale: "en-PH",
            ownerId: MOCK_USERS.OWNER.id,
            config: {
              businessHours: "8:00-18:00",
              checkInTime: "14:00",
              checkOutTime: "12:00",
              allowOnlineBooking: true,
              requireDeposit: true,
              depositPercentage: 50,
            },
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-15"),
          },
        ],
      ]),
      projectMembers: new Map([
        [
          "membership-1",
          {
            id: "membership-1",
            projectId: "project-boracay-1",
            userId: MOCK_USERS.OWNER.id,
            role: "OWNER",
            permissions: ["ALL"],
            invitedBy: null,
            joinedAt: new Date("2024-01-01"),
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
          },
        ],
      ]),
    };
  },

  addUser: (user: User) => {
    mockDatabase.users.set(user.id, user);
  },

  removeUser: (userId: string) => {
    mockDatabase.users.delete(userId);
  },

  setRateLimit: (key: string, count: number, resetAt: number) => {
    mockDatabase.rateLimits.set(key, { count, resetAt });
  },

  getAuditLogs: () => mockDatabase.auditLogs,

  clearAuditLogs: () => {
    mockDatabase.auditLogs = [];
  },
};
