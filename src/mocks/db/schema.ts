/**
 * IndexedDB Schema Definition
 * Mirrors the PostgreSQL schema structure for consistent data modeling
 */

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
} from "@/types/common";

/**
 * Database schema version for migrations
 */
export const DB_VERSION = 1;
export const DB_NAME = "okaeri_resort_mock_db";

/**
 * IndexedDB store definitions with indexes for efficient querying
 */
export interface MockDBSchema {
  // Authentication & Users
  users: {
    key: string; // User ID
    value: User;
    indexes: {
      email: string;
      role: string;
      createdAt: string;
    };
  };

  // Project Management
  projects: {
    key: string; // Project ID
    value: Project;
    indexes: {
      ownerId: string;
      status: string;
      type: string;
      createdAt: string;
      slug: string;
    };
  };

  projectMemberships: {
    key: string; // Membership ID
    value: ProjectMembership;
    indexes: {
      projectId: string;
      userId: string;
      role: string;
      "projectId+userId": [string, string]; // Compound index
    };
  };

  // Properties
  properties: {
    key: string; // Property ID
    value: Property;
    indexes: {
      projectId: string;
      type: string;
      status: string;
      createdAt: string;
    };
  };

  // Bookings
  bookings: {
    key: string; // Booking ID
    value: Booking;
    indexes: {
      projectId: string;
      propertyId: string;
      status: string;
      paymentStatus: string;
      source: string;
      checkIn: string;
      checkOut: string;
      guestEmail: string;
      createdAt: string;
      "projectId+status": [string, string]; // Compound index
      "propertyId+checkIn": [string, string]; // Compound index
    };
  };

  // Expenses
  expenses: {
    key: string; // Expense ID
    value: Expense;
    indexes: {
      projectId: string;
      propertyId: string;
      category: string;
      status: string;
      paymentMethod: string;
      date: string;
      createdAt: string;
      "projectId+category": [string, string]; // Compound index
      "projectId+date": [string, string]; // Compound index
    };
  };

  // Payments
  payments: {
    key: string; // Payment ID
    value: Payment;
    indexes: {
      bookingId: string;
      status: string;
      method: string;
      processedAt: string;
    };
  };

  // Guests
  guests: {
    key: string; // Guest ID
    value: Guest;
    indexes: {
      projectId: string;
      email: string;
      phone: string;
      name: string;
      vipStatus: string;
      blacklisted: string;
      createdAt: string;
      "projectId+email": [string, string]; // Compound index
    };
  };

  // Activity Logs
  activityLogs: {
    key: string; // Activity ID
    value: ActivityLog;
    indexes: {
      projectId: string;
      userId: string;
      action: string;
      resource: string;
      resourceId: string;
      createdAt: string;
      "projectId+userId": [string, string]; // Compound index
      "projectId+resource": [string, string]; // Compound index
    };
  };

  // Sessions (for auth state persistence)
  sessions: {
    key: string; // Session token
    value: {
      userId: string;
      expiresAt: number;
      refreshToken: string;
      createdAt: string;
    };
    indexes: {
      userId: string;
      expiresAt: number;
    };
  };

  // Rate limits (for API simulation)
  rateLimits: {
    key: string; // Rate limit key (e.g., 'login:user@email.com')
    value: {
      count: number;
      resetAt: number;
      lastAttempt: number;
    };
    indexes: {
      resetAt: number;
    };
  };

  // Offline data queue
  offlineQueue: {
    key: string; // Queue item ID
    value: {
      id: string;
      operation: "CREATE" | "UPDATE" | "DELETE";
      table: keyof Omit<MockDBSchema, "offlineQueue">;
      data: any;
      timestamp: number;
      retryCount: number;
      lastError?: string;
    };
    indexes: {
      operation: string;
      table: string;
      timestamp: number;
      retryCount: number;
    };
  };
}

/**
 * Store configuration with index definitions
 */
export const storeConfig = {
  users: {
    keyPath: "id",
    autoIncrement: false,
    indexes: [
      { name: "email", keyPath: "email", unique: true },
      { name: "role", keyPath: "role", unique: false },
      { name: "createdAt", keyPath: "createdAt", unique: false },
    ],
  },
  projects: {
    keyPath: "id",
    autoIncrement: false,
    indexes: [
      { name: "ownerId", keyPath: "ownerId", unique: false },
      { name: "status", keyPath: "status", unique: false },
      { name: "type", keyPath: "type", unique: false },
      { name: "createdAt", keyPath: "createdAt", unique: false },
      { name: "slug", keyPath: "slug", unique: true },
    ],
  },
  projectMemberships: {
    keyPath: "id",
    autoIncrement: false,
    indexes: [
      { name: "projectId", keyPath: "projectId", unique: false },
      { name: "userId", keyPath: "userId", unique: false },
      { name: "role", keyPath: "role", unique: false },
      { name: "projectId+userId", keyPath: ["projectId", "userId"], unique: true },
    ],
  },
  properties: {
    keyPath: "id",
    autoIncrement: false,
    indexes: [
      { name: "projectId", keyPath: "projectId", unique: false },
      { name: "type", keyPath: "type", unique: false },
      { name: "status", keyPath: "status", unique: false },
      { name: "createdAt", keyPath: "createdAt", unique: false },
    ],
  },
  bookings: {
    keyPath: "id",
    autoIncrement: false,
    indexes: [
      { name: "projectId", keyPath: "projectId", unique: false },
      { name: "propertyId", keyPath: "propertyId", unique: false },
      { name: "status", keyPath: "status", unique: false },
      { name: "paymentStatus", keyPath: "paymentStatus", unique: false },
      { name: "source", keyPath: "source", unique: false },
      { name: "checkIn", keyPath: "checkIn", unique: false },
      { name: "checkOut", keyPath: "checkOut", unique: false },
      { name: "guestEmail", keyPath: "guestEmail", unique: false },
      { name: "createdAt", keyPath: "createdAt", unique: false },
      { name: "projectId+status", keyPath: ["projectId", "status"], unique: false },
      { name: "propertyId+checkIn", keyPath: ["propertyId", "checkIn"], unique: false },
    ],
  },
  expenses: {
    keyPath: "id",
    autoIncrement: false,
    indexes: [
      { name: "projectId", keyPath: "projectId", unique: false },
      { name: "propertyId", keyPath: "propertyId", unique: false },
      { name: "category", keyPath: "category", unique: false },
      { name: "status", keyPath: "status", unique: false },
      { name: "paymentMethod", keyPath: "paymentMethod", unique: false },
      { name: "date", keyPath: "date", unique: false },
      { name: "createdAt", keyPath: "createdAt", unique: false },
      { name: "projectId+category", keyPath: ["projectId", "category"], unique: false },
      { name: "projectId+date", keyPath: ["projectId", "date"], unique: false },
    ],
  },
  payments: {
    keyPath: "id",
    autoIncrement: false,
    indexes: [
      { name: "bookingId", keyPath: "bookingId", unique: false },
      { name: "status", keyPath: "status", unique: false },
      { name: "method", keyPath: "method", unique: false },
      { name: "processedAt", keyPath: "processedAt", unique: false },
    ],
  },
  guests: {
    keyPath: "id",
    autoIncrement: false,
    indexes: [
      { name: "projectId", keyPath: "projectId", unique: false },
      { name: "email", keyPath: "email", unique: false },
      { name: "phone", keyPath: "phone", unique: false },
      { name: "name", keyPath: "name", unique: false },
      { name: "vipStatus", keyPath: "vipStatus", unique: false },
      { name: "blacklisted", keyPath: "blacklisted", unique: false },
      { name: "createdAt", keyPath: "createdAt", unique: false },
      { name: "projectId+email", keyPath: ["projectId", "email"], unique: false },
    ],
  },
  activityLogs: {
    keyPath: "id",
    autoIncrement: false,
    indexes: [
      { name: "projectId", keyPath: "projectId", unique: false },
      { name: "userId", keyPath: "userId", unique: false },
      { name: "action", keyPath: "action", unique: false },
      { name: "resource", keyPath: "resource", unique: false },
      { name: "resourceId", keyPath: "resourceId", unique: false },
      { name: "createdAt", keyPath: "createdAt", unique: false },
      { name: "projectId+userId", keyPath: ["projectId", "userId"], unique: false },
      { name: "projectId+resource", keyPath: ["projectId", "resource"], unique: false },
    ],
  },
  sessions: {
    keyPath: "key",
    autoIncrement: false,
    indexes: [
      { name: "userId", keyPath: "userId", unique: false },
      { name: "expiresAt", keyPath: "expiresAt", unique: false },
    ],
  },
  rateLimits: {
    keyPath: "key",
    autoIncrement: false,
    indexes: [{ name: "resetAt", keyPath: "resetAt", unique: false }],
  },
  offlineQueue: {
    keyPath: "id",
    autoIncrement: false,
    indexes: [
      { name: "operation", keyPath: "operation", unique: false },
      { name: "table", keyPath: "table", unique: false },
      { name: "timestamp", keyPath: "timestamp", unique: false },
      { name: "retryCount", keyPath: "retryCount", unique: false },
    ],
  },
} as const;

/**
 * Type definitions for query builders
 */
export type StoreNames = keyof MockDBSchema;
export type StoreData<T extends StoreNames> = MockDBSchema[T]["value"];
export type StoreKey<T extends StoreNames> = MockDBSchema[T]["key"];

/**
 * Query builder types
 */
export interface QueryFilter<T = any> {
  field: string;
  operator: "=" | ">" | ">=" | "<" | "<=" | "!=" | "in" | "like" | "between";
  value: T | T[];
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: {
    field: string;
    direction: "asc" | "desc";
  };
  filters?: QueryFilter[];
}

/**
 * Default values for seeding
 */
export const DEFAULT_PROJECT_CONFIG = {
  currency: "PHP",
  timezone: "Asia/Manila",
  locale: "en-PH",
  fiscalYearStart: "01-01",
  features: {
    bookings: true,
    expenses: true,
    reports: true,
    analytics: true,
    googleSheets: false,
    csvImport: true,
    apiAccess: false,
  },
  limits: {
    maxProperties: 50,
    maxBookings: 1000,
    maxUsers: 10,
    maxFileStorage: 500, // 500MB
  },
};
