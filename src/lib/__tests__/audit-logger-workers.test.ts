// src/lib/__tests__/audit-logger-workers.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logAuditEventWithIP } from "../audit-logger-workers";
import { AuditCategory, AuditSeverity } from "@/types/database.types";

// Mock Supabase module
vi.mock("../supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

describe("logAuditEventWithIP", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Mock global fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    // Clean up
    vi.restoreAllMocks();
  });

  it("should return error if no active session", async () => {
    // Mock getSession to return null session
    const { supabase } = await import("../supabase");
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const result = await logAuditEventWithIP({
      tableName: "authentication",
      description: "Test event",
      category: AuditCategory.AUTHENTICATION,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("No active session");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should construct valid request with proper headers and body", async () => {
    // Mock getSession to return valid session
    const mockSession = {
      expires_at: Date.now() + 3600000,
      expires_in: 3600,
      token_type: "bearer" as const,
      access_token: "test-token-123",
      refresh_token: "refresh-token-456",
      user: {
        id: "user-1",
        email: "test@okaeri.com",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      },
    };

    const { supabase } = await import("../supabase");
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    // Mock successful fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, audit_id: "audit-123" }),
    });

    await logAuditEventWithIP({
      tableName: "bookings",
      recordId: "booking-456",
      description: "Booking created",
      category: AuditCategory.BOOKING,
      severity: AuditSeverity.INFO,
      metadata: { guest_name: "John Doe" },
      oldData: null,
      newData: { status: "confirmed" },
    });

    // Verify fetch was called with correct parameters
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/audit/log-with-ip",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-token-123",
        }),
      })
    );

    // Verify request body structure
    const callArgs = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(callArgs[1].body);

    expect(requestBody).toEqual({
      tableName: "bookings",
      recordId: "booking-456",
      description: "Booking created",
      category: AuditCategory.BOOKING,
      severity: AuditSeverity.INFO,
      metadata: { guest_name: "John Doe" },
      oldData: null,
      newData: { status: "confirmed" },
    });
  });

  it("should return error if Worker endpoint returns non-ok response", async () => {
    // Mock getSession to return valid session
    const mockSession = {
      expires_at: Date.now() + 3600000,
      expires_in: 3600,
      token_type: "bearer" as const,
      access_token: "test-token-123",
      refresh_token: "refresh-token-456",
      user: {
        id: "user-1",
        email: "test@okaeri.com",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      },
    };

    const { supabase } = await import("../supabase");
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    // Mock failed fetch response
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Database error" }),
    });

    const result = await logAuditEventWithIP({
      tableName: "payments",
      description: "Payment processed",
      category: AuditCategory.PAYMENT,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Database error");
  });

  it("should handle network errors gracefully", async () => {
    // Mock getSession to return valid session
    const mockSession = {
      expires_at: Date.now() + 3600000,
      expires_in: 3600,
      token_type: "bearer" as const,
      access_token: "test-token-123",
      refresh_token: "refresh-token-456",
      user: {
        id: "user-1",
        email: "test@okaeri.com",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      },
    };

    const { supabase } = await import("../supabase");
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    // Mock network error
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await logAuditEventWithIP({
      tableName: "authentication",
      description: "Login attempt",
      category: AuditCategory.AUTHENTICATION,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network error");
  });

  it("should return success when Worker endpoint succeeds", async () => {
    // Mock getSession to return valid session
    const mockSession = {
      expires_at: Date.now() + 3600000,
      expires_in: 3600,
      token_type: "bearer" as const,
      access_token: "test-token-123",
      refresh_token: "refresh-token-456",
      user: {
        id: "user-1",
        email: "test@okaeri.com",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      },
    };

    const { supabase } = await import("../supabase");
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    // Mock successful fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, audit_id: "audit-789" }),
    });

    const result = await logAuditEventWithIP({
      tableName: "expenses",
      recordId: "expense-101",
      description: "Expense created",
      category: AuditCategory.EXPENSE,
      severity: AuditSeverity.INFO,
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
