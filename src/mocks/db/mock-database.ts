/**
 * Mock Database Service
 * High-level database operations that simulate PostgreSQL behavior
 */

import { mockDB, type PaginatedResult } from "./indexeddb-client";
import type {
  User,
  Project,
  ProjectMembership,
  Property,
  Booking,
  Expense,
  Payment,
  Guest,
  ActivityLog,
  UserRole,
  ProjectRole,
  BookingStatus,
  PaymentStatus,
  BookingSource,
  ExpenseCategory,
  ExpenseStatus,
  PaymentMethod,
  PaginationParams,
  FilterParams,
} from "@/types/common";
import type { QueryOptions, QueryFilter } from "./schema";

/**
 * Philippine-specific data validation utilities
 */
export class PhilippineValidators {
  static validatePhoneNumber(phone: string): boolean {
    // Philippine mobile number formats: +639XXXXXXXXX, 09XXXXXXXXX, 639XXXXXXXXX
    const patterns = [
      /^\+639\d{9}$/, // +639XXXXXXXXX
      /^09\d{9}$/, // 09XXXXXXXXX
      /^639\d{9}$/, // 639XXXXXXXXX
    ];
    return patterns.some((pattern) => pattern.test(phone));
  }

  static normalizePhoneNumber(phone: string): string {
    // Convert to +639XXXXXXXXX format
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("09")) {
      return `+63${cleaned.substring(1)}`;
    }
    if (cleaned.startsWith("639")) {
      return `+${cleaned}`;
    }
    if (cleaned.startsWith("63")) {
      return `+${cleaned}`;
    }
    return phone; // Return as-is if format is unknown
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  }
}

/**
 * Mock Database Service Class
 */
export class MockDatabaseService {
  /**
   * Initialize the database service
   */
  async initialize(): Promise<void> {
    await mockDB.initialize();
    console.log("[MockDB Service] Database service initialized");
  }

  // ==================== USER OPERATIONS ====================

  async createUser(userData: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User> {
    const now = new Date().toISOString();
    const user: User = {
      ...userData,
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    };

    // Validate email format
    if (!PhilippineValidators.validateEmail(user.email)) {
      throw new Error("Invalid email format");
    }

    // Check for duplicate email
    const existingUsers = await this.queryUsers({
      filters: [{ field: "email", operator: "=", value: user.email }],
    });
    if (existingUsers.data.length > 0) {
      throw new Error("Email already exists");
    }

    return await mockDB.create("users", user);
  }

  async getUserById(id: string): Promise<User | null> {
    const user = await mockDB.get("users", id);
    return user || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.queryUsers({
      filters: [{ field: "email", operator: "=", value: email }],
      limit: 1,
    });
    return result.data[0] || null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const updated = await mockDB.update("users", id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    return updated;
  }

  async queryUsers(
    options: {
      filters?: Array<{ field: string; operator: string; value: any }>;
      limit?: number;
      offset?: number;
      orderBy?: { field: string; direction: "asc" | "desc" };
    } = {}
  ): Promise<PaginatedResult<User>> {
    return await mockDB.query("users", options as QueryOptions);
  }

  // ==================== PROJECT OPERATIONS ====================

  async createProject(
    projectData: Omit<Project, "id" | "createdAt" | "updatedAt" | "slug">
  ): Promise<Project> {
    const now = new Date().toISOString();
    const slug = this.generateSlug(projectData.name);

    const project: Project = {
      ...projectData,
      id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      slug,
      createdAt: now,
      updatedAt: now,
    };

    // Check for duplicate slug
    const existing = await this.queryProjects({
      filters: [{ field: "slug", operator: "=", value: slug }],
    });
    if (existing.data.length > 0) {
      throw new Error("Project name already exists");
    }

    return await mockDB.create("projects", project);
  }

  async getProjectById(id: string): Promise<Project | null> {
    const project = await mockDB.get("projects", id);
    return project || null;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    return await mockDB.update("projects", id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  async queryProjects(
    options: {
      filters?: Array<{ field: string; operator: string; value: any }>;
      limit?: number;
      offset?: number;
      orderBy?: { field: string; direction: "asc" | "desc" };
    } = {}
  ): Promise<PaginatedResult<Project>> {
    return await mockDB.query("projects", options as QueryOptions);
  }

  async getUserProjects(userId: string): Promise<Project[]> {
    // Get projects through memberships
    const memberships = await this.queryProjectMemberships({
      filters: [{ field: "userId", operator: "=", value: userId }],
    });

    const projectIds = memberships.data.map((m) => m.projectId);
    if (projectIds.length === 0) return [];

    const projects = await this.queryProjects({
      filters: [{ field: "id", operator: "in", value: projectIds }],
    });

    return projects.data;
  }

  // ==================== PROJECT MEMBERSHIP OPERATIONS ====================

  async createProjectMembership(
    membershipData: Omit<ProjectMembership, "id" | "joinedAt">
  ): Promise<ProjectMembership> {
    const membership: ProjectMembership = {
      ...membershipData,
      id: `membership_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      joinedAt: new Date().toISOString(),
    };

    // Check for duplicate membership
    const existing = await this.queryProjectMemberships({
      filters: [
        { field: "projectId", operator: "=", value: membership.projectId },
        { field: "userId", operator: "=", value: membership.userId },
      ],
    });

    if (existing.data.length > 0) {
      throw new Error("User is already a member of this project");
    }

    return await mockDB.create("projectMemberships", membership);
  }

  async queryProjectMemberships(
    options: {
      filters?: Array<{ field: string; operator: string; value: any }>;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<PaginatedResult<ProjectMembership>> {
    return await mockDB.query("projectMemberships", options as QueryOptions);
  }

  async getUserProjectRole(userId: string, projectId: string): Promise<ProjectRole | null> {
    const memberships = await this.queryProjectMemberships({
      filters: [
        { field: "projectId", operator: "=", value: projectId },
        { field: "userId", operator: "=", value: userId },
      ],
      limit: 1,
    });

    return memberships.data[0]?.role || null;
  }

  // ==================== BOOKING OPERATIONS ====================

  async createBooking(
    bookingData: Omit<Booking, "id" | "nights" | "paymentStatus" | "createdAt" | "updatedAt">
  ): Promise<Booking> {
    const now = new Date().toISOString();
    const checkIn = new Date(bookingData.checkIn);
    const checkOut = new Date(bookingData.checkOut);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate payment status
    let paymentStatus: PaymentStatus;
    if (bookingData.paidAmount >= bookingData.totalAmount) {
      paymentStatus = PaymentStatus.PAID;
    } else if (bookingData.paidAmount > 0) {
      paymentStatus = PaymentStatus.PARTIAL;
    } else {
      paymentStatus = PaymentStatus.PENDING;
    }

    const booking: Booking = {
      ...bookingData,
      id: `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      nights,
      paymentStatus,
      createdAt: now,
      updatedAt: now,
    };

    // Validate Philippine phone number if provided
    if (booking.guestPhone && !PhilippineValidators.validatePhoneNumber(booking.guestPhone)) {
      booking.guestPhone = PhilippineValidators.normalizePhoneNumber(booking.guestPhone);
    }

    // Check for booking conflicts
    await this.checkBookingAvailability(booking.propertyId, booking.checkIn, booking.checkOut);

    return await mockDB.create("bookings", booking);
  }

  async getBookingById(id: string): Promise<Booking | null> {
    const booking = await mockDB.get("bookings", id);
    return booking || null;
  }

  async updateBooking(id: string, updates: Partial<Booking>): Promise<Booking | null> {
    const updatedData = { ...updates, updatedAt: new Date().toISOString() };

    // Recalculate payment status if amounts changed
    if ("paidAmount" in updates || "totalAmount" in updates) {
      const current = await this.getBookingById(id);
      if (current) {
        const totalAmount = updates.totalAmount ?? current.totalAmount;
        const paidAmount = updates.paidAmount ?? current.paidAmount;

        if (paidAmount >= totalAmount) {
          updatedData.paymentStatus = PaymentStatus.PAID;
        } else if (paidAmount > 0) {
          updatedData.paymentStatus = PaymentStatus.PARTIAL;
        } else {
          updatedData.paymentStatus = PaymentStatus.PENDING;
        }
      }
    }

    return await mockDB.update("bookings", id, updatedData);
  }

  async queryBookings(
    options: {
      filters?: Array<{ field: string; operator: string; value: any }>;
      limit?: number;
      offset?: number;
      orderBy?: { field: string; direction: "asc" | "desc" };
    } = {}
  ): Promise<PaginatedResult<Booking>> {
    return await mockDB.query("bookings", options as QueryOptions);
  }

  async checkBookingAvailability(
    propertyId: string,
    checkIn: string,
    checkOut: string,
    excludeBookingId?: string
  ): Promise<{ available: boolean; conflicts: Booking[] }> {
    const filters: QueryFilter[] = [
      { field: "propertyId", operator: "=", value: propertyId },
      { field: "status", operator: "!=", value: BookingStatus.CANCELLED },
    ];

    if (excludeBookingId) {
      filters.push({ field: "id", operator: "!=", value: excludeBookingId });
    }

    const existingBookings = await this.queryBookings({ filters });

    const conflicts = existingBookings.data.filter((booking) => {
      const existingCheckIn = new Date(booking.checkIn);
      const existingCheckOut = new Date(booking.checkOut);
      const newCheckIn = new Date(checkIn);
      const newCheckOut = new Date(checkOut);

      // Check for date overlap
      return !(newCheckOut <= existingCheckIn || newCheckIn >= existingCheckOut);
    });

    return {
      available: conflicts.length === 0,
      conflicts,
    };
  }

  // ==================== EXPENSE OPERATIONS ====================

  async createExpense(
    expenseData: Omit<Expense, "id" | "status" | "createdAt" | "updatedAt">
  ): Promise<Expense> {
    const now = new Date().toISOString();
    const expense: Expense = {
      ...expenseData,
      id: `expense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: ExpenseStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    };

    return await mockDB.create("expenses", expense);
  }

  async getExpenseById(id: string): Promise<Expense | null> {
    const expense = await mockDB.get("expenses", id);
    return expense || null;
  }

  async updateExpense(id: string, updates: Partial<Expense>): Promise<Expense | null> {
    return await mockDB.update("expenses", id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  async queryExpenses(
    options: {
      filters?: Array<{ field: string; operator: string; value: any }>;
      limit?: number;
      offset?: number;
      orderBy?: { field: string; direction: "asc" | "desc" };
    } = {}
  ): Promise<PaginatedResult<Expense>> {
    return await mockDB.query("expenses", options as QueryOptions);
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Generate a URL-friendly slug from a name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s-]/g, "") // Remove special characters
      .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ""); // Trim hyphens from start/end
  }

  /**
   * Simulate database transaction delay
   */
  private async simulateDelay(minMs: number = 50, maxMs: number = 200): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Check if database is empty and needs seeding
   */
  async needsSeeding(): Promise<boolean> {
    return await mockDB.isEmpty();
  }

  /**
   * Clear all data (for testing)
   */
  async clearAllData(): Promise<void> {
    const storeNames = [
      "users",
      "projects",
      "projectMemberships",
      "properties",
      "bookings",
      "expenses",
      "payments",
      "guests",
      "activityLogs",
    ] as const;

    for (const storeName of storeNames) {
      await mockDB.clear(storeName);
    }

    console.log("[MockDB Service] All data cleared");
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<Record<string, number>> {
    const stats: Record<string, number> = {};
    const storeNames = [
      "users",
      "projects",
      "projectMemberships",
      "properties",
      "bookings",
      "expenses",
      "payments",
      "guests",
      "activityLogs",
    ] as const;

    for (const storeName of storeNames) {
      stats[storeName] = await mockDB.count(storeName);
    }

    return stats;
  }

  /**
   * Export data for backup/sharing
   */
  async exportData(): Promise<Record<string, any[]>> {
    const data: Record<string, any[]> = {};
    const storeNames = [
      "users",
      "projects",
      "projectMemberships",
      "properties",
      "bookings",
      "expenses",
      "payments",
      "guests",
    ] as const;

    for (const storeName of storeNames) {
      data[storeName] = await mockDB.getAll(storeName);
    }

    return data;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await mockDB.close();
  }
}

/**
 * Singleton instance
 */
export const mockDatabase = new MockDatabaseService();
