/**
 * Test data constants for E2E tests
 * Contains test credentials, mock data, and common test values
 */

import { toManilaDateString } from "../../src/lib/timezone";

// Test account credentials - configure in your test environment
// See .env.test for actual values (jasonacido+role@gmail.com / 12345678)
export const TEST_USERS = {
  owner: {
    email: process.env.TEST_OWNER_EMAIL || "owner@okaeri.test",
    password: process.env.TEST_OWNER_PASSWORD || "test-password",
    role: "owner",
  },
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || "admin@okaeri.test",
    password: process.env.TEST_ADMIN_PASSWORD || "test-password",
    role: "admin",
  },
  manager: {
    email: process.env.TEST_MANAGER_EMAIL || "manager@okaeri.test",
    password: process.env.TEST_MANAGER_PASSWORD || "test-password",
    role: "manager",
  },
  staff: {
    email: process.env.TEST_STAFF_EMAIL || "staff@okaeri.test",
    password: process.env.TEST_STAFF_PASSWORD || "test-password",
    role: "staff",
  },
} as const;

// Invalid credentials for negative tests
export const INVALID_CREDENTIALS = {
  wrongEmail: "nonexistent@example.com",
  wrongPassword: "wrong-password-123",
  malformedEmail: "not-an-email",
};

// Guest booking test data
export const TEST_GUEST = {
  name: "Test Guest",
  email: "testguest@example.com",
  phone: "+639171234567", // Philippine format
};

// Booking test data
export const TEST_BOOKING = {
  guestCount: 2,
  paymentMethod: "GCash",
  specialRequests: "Test booking - please ignore",
};

// Date utilities for booking tests
export function getFutureDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return toManilaDateString(date);
}

export function getCheckInDate(): string {
  return getFutureDate(7); // 1 week from now
}

export function getCheckOutDate(): string {
  return getFutureDate(10); // 10 days from now (3-night stay)
}

// Common routes
export const ROUTES = {
  // Public routes
  public: {
    home: "/",
    booking: "/booking",
    bookingConfirmation: (ref: string) => `/booking/confirmation/${ref}`,
    checkStatus: "/booking/check-status",
    login: "/login",
    forgotPassword: "/forgot-password",
    resetPassword: "/reset-password",
    privacyPolicy: "/privacy-policy",
    termsAndConditions: "/terms-and-conditions",
  },
  // Admin routes
  admin: {
    dashboard: "/admin/dashboard",
    bookings: "/admin/bookings",
    bookingDetail: (id: string) => `/admin/bookings/${id}`,
    bookingEdit: (id: string) => `/admin/bookings/${id}/edit`,
    bookingAssignUnits: (id: string) => `/admin/bookings/${id}/assign-units`,
    newMultiBooking: "/admin/bookings/new-multi",
    bookingsQueue: "/admin/bookings/queue",
    units: "/admin/units",
    unitDetail: (id: string) => `/admin/units/${id}`,
    unitEdit: (id: string) => `/admin/units/${id}/edit`,
    unitsPricing: "/admin/units/pricing",
    guests: "/admin/guests",
    guestDetail: (id: string) => `/admin/guests/${id}`,
    guestEdit: (id: string) => `/admin/guests/${id}/edit`,
    payments: "/admin/payments",
    paymentDetail: (id: string) => `/admin/payments/${id}`,
    verifyPayment: (bookingId: string) => `/admin/verify-payment/${bookingId}`,
    expenses: "/admin/expenses",
    expenseDetail: (id: string) => `/admin/expenses/${id}`,
    availability: "/admin/availability",
    auditLogs: "/admin/audit-logs",
    roles: "/admin/roles",
  },
} as const;

// Booking status values
export const BOOKING_STATUS = {
  pending: "pending",
  confirmed: "confirmed",
  checkedIn: "checked_in",
  checkedOut: "checked_out",
  cancelled: "cancelled",
  noShow: "no_show",
} as const;

// Payment status values
export const PAYMENT_STATUS = {
  pending: "pending",
  partial: "partial",
  paid: "paid",
  refunded: "refunded",
} as const;

// Unit status values
export const UNIT_STATUS = {
  available: "available",
  maintenance: "maintenance",
  inactive: "inactive",
} as const;

// Test file path for payment proof upload
export const TEST_FILES = {
  // Will be created during test setup if needed
  paymentProofPng: "e2e/fixtures/test-receipt.png",
  paymentProofPdf: "e2e/fixtures/test-receipt.pdf",
};

// Timeout configurations
export const TIMEOUTS = {
  short: 5000,
  medium: 10000,
  long: 30000,
  navigation: 30000,
  fileUpload: 15000,
};

// Viewport sizes for responsive testing
export const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
  largeDesktop: { width: 1920, height: 1080 },
};
