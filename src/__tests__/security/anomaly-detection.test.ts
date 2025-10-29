/**
 * Anomaly Detection Security Tests
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { detectAnomalies, logSecurityEvent, shouldAutoBlock } from "@/lib/security-monitoring";
import { supabase } from "@/lib/supabase";

// Mock Supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("Anomaly Detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("detectAnomalies", () => {
    it("should detect multiple failed booking attempts", async () => {
      const mockLogs = [
        {
          audit_id: "1",
          action: "guest_booking_failed",
          severity: "ERROR",
          ip_address: "192.168.1.1",
          metadata: {},
          created_at: new Date().toISOString(),
        },
        {
          audit_id: "2",
          action: "guest_booking_failed",
          severity: "ERROR",
          ip_address: "192.168.1.1",
          metadata: {},
          created_at: new Date().toISOString(),
        },
        {
          audit_id: "3",
          action: "guest_booking_failed",
          severity: "ERROR",
          ip_address: "192.168.1.1",
          metadata: {},
          created_at: new Date().toISOString(),
        },
        {
          audit_id: "4",
          action: "guest_booking_failed",
          severity: "ERROR",
          ip_address: "192.168.1.1",
          metadata: {},
          created_at: new Date().toISOString(),
        },
      ];

      (supabase.from as unknown).mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockLogs,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await detectAnomalies("192.168.1.1");

      expect(result.patterns).toContainEqual(
        expect.objectContaining({
          name: "multiple_failed_bookings",
        })
      );
      expect(result.threatScore).toBeGreaterThan(0);
    });

    it("should detect rate limit violations", async () => {
      const mockLogs = [
        {
          audit_id: "1",
          action: "rate_limit_exceeded",
          severity: "WARNING",
          ip_address: "192.168.1.1",
          metadata: { rate_limited: true },
          created_at: new Date().toISOString(),
        },
        {
          audit_id: "2",
          action: "rate_limit_exceeded",
          severity: "WARNING",
          ip_address: "192.168.1.1",
          metadata: { rate_limited: true },
          created_at: new Date().toISOString(),
        },
      ];

      (supabase.from as unknown).mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockLogs,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await detectAnomalies("192.168.1.1");

      expect(result.patterns).toContainEqual(
        expect.objectContaining({
          name: "rate_limit_violation",
        })
      );
    });

    it("should detect CAPTCHA failures", async () => {
      const mockLogs = [
        {
          audit_id: "1",
          action: "captcha_failed",
          severity: "WARNING",
          ip_address: "192.168.1.1",
          metadata: { captcha_failed: true },
          created_at: new Date().toISOString(),
        },
        {
          audit_id: "2",
          action: "captcha_failed",
          severity: "WARNING",
          ip_address: "192.168.1.1",
          metadata: { captcha_failed: true },
          created_at: new Date().toISOString(),
        },
        {
          audit_id: "3",
          action: "captcha_failed",
          severity: "WARNING",
          ip_address: "192.168.1.1",
          metadata: { captcha_failed: true },
          created_at: new Date().toISOString(),
        },
      ];

      (supabase.from as unknown).mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockLogs,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await detectAnomalies("192.168.1.1");

      expect(result.patterns).toContainEqual(
        expect.objectContaining({
          name: "captcha_failures",
        })
      );
      expect(result.recommendations).toContain("Possible bot activity detected");
    });

    it("should detect email enumeration", async () => {
      const mockLogs = [
        {
          audit_id: "1",
          action: "status_check",
          severity: "INFO",
          ip_address: "192.168.1.1",
          metadata: { email: "test1@example.com" },
          created_at: new Date().toISOString(),
        },
        {
          audit_id: "2",
          action: "status_check",
          severity: "INFO",
          ip_address: "192.168.1.1",
          metadata: { email: "test2@example.com" },
          created_at: new Date().toISOString(),
        },
        {
          audit_id: "3",
          action: "status_check",
          severity: "INFO",
          ip_address: "192.168.1.1",
          metadata: { email: "test3@example.com" },
          created_at: new Date().toISOString(),
        },
        {
          audit_id: "4",
          action: "status_check",
          severity: "INFO",
          ip_address: "192.168.1.1",
          metadata: { email: "test4@example.com" },
          created_at: new Date().toISOString(),
        },
      ];

      (supabase.from as unknown).mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockLogs,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await detectAnomalies("192.168.1.1");

      expect(result.patterns).toContainEqual(
        expect.objectContaining({
          name: "email_enumeration",
        })
      );
      expect(result.recommendations).toContain("Possible email harvesting attempt");
    });

    it("should detect SQL injection attempts", async () => {
      const mockLogs = [
        {
          audit_id: "1",
          action: "guest_booking",
          severity: "WARNING",
          ip_address: "192.168.1.1",
          metadata: {
            input: "'; DROP TABLE bookings; --",
          },
          created_at: new Date().toISOString(),
        },
      ];

      (supabase.from as unknown).mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockLogs,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await detectAnomalies("192.168.1.1");

      expect(result.patterns).toContainEqual(
        expect.objectContaining({
          name: "sql_injection_attempt",
        })
      );
      expect(result.threatScore).toBeGreaterThanOrEqual(50);
      expect(result.recommendations).toContain("CRITICAL: SQL injection attempts detected");
    });

    it("should calculate threat scores correctly", async () => {
      const mockLogs = Array(60).fill({
        audit_id: "1",
        action: "request",
        severity: "INFO",
        ip_address: "192.168.1.1",
        metadata: {},
        created_at: new Date().toISOString(),
      });

      (supabase.from as unknown).mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockLogs,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await detectAnomalies("192.168.1.1");

      expect(result.patterns).toContainEqual(
        expect.objectContaining({
          name: "rapid_requests",
        })
      );
      expect(result.threatScore).toBeLessThanOrEqual(100); // Should cap at 100
    });

    it("should provide appropriate recommendations based on threat level", async () => {
      // High threat score scenario
      const mockLogs = Array(10).fill({
        audit_id: "1",
        action: "unauthorized_access",
        severity: "CRITICAL",
        ip_address: "192.168.1.1",
        metadata: { unauthorized: true },
        created_at: new Date().toISOString(),
      });

      (supabase.from as unknown).mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockLogs,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await detectAnomalies("192.168.1.1");

      expect(result.threatScore).toBeGreaterThanOrEqual(75);
      expect(result.recommendations[0]).toContain("IMMEDIATE ACTION");
    });
  });

  describe("shouldAutoBlock", () => {
    it("should recommend blocking for high threat scores", async () => {
      const mockLogs = Array(10).fill({
        audit_id: "1",
        action: "sql_injection_attempt",
        severity: "CRITICAL",
        ip_address: "192.168.1.1",
        metadata: { input: "DROP TABLE" },
        created_at: new Date().toISOString(),
      });

      (supabase.from as unknown).mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockLogs,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await shouldAutoBlock("192.168.1.1");

      expect(result.shouldBlock).toBe(true);
      expect(result.reason).toContain("threat score");
    });

    it("should block for critical patterns regardless of score", async () => {
      const mockLogs = [
        {
          audit_id: "1",
          action: "unauthorized_access",
          severity: "CRITICAL",
          ip_address: "192.168.1.1",
          metadata: { unauthorized: true },
          created_at: new Date().toISOString(),
        },
      ];

      (supabase.from as unknown).mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockLogs,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await shouldAutoBlock("192.168.1.1");

      expect(result.shouldBlock).toBe(true);
      expect(result.reason).toContain("Auto-blocked due to threat score");
    });

    it("should not block for low threat scores", async () => {
      const mockLogs = [
        {
          audit_id: "1",
          action: "normal_request",
          severity: "INFO",
          ip_address: "192.168.1.1",
          metadata: {},
          created_at: new Date().toISOString(),
        },
      ];

      (supabase.from as unknown).mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockLogs,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await shouldAutoBlock("192.168.1.1");

      expect(result.shouldBlock).toBe(false);
      expect(result.threatScore).toBeLessThan(50);
    });
  });

  describe("logSecurityEvent", () => {
    it("should log security events with correct metadata", async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });

      (supabase.from as unknown).mockReturnValue({
        insert: insertMock,
      });

      await logSecurityEvent({
        type: "rate_limit_exceeded",
        ip: "192.168.1.1",
        userAgent: "TestBot/1.0",
        metadata: { attempts: 100 },
      });

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "security_rate_limit_exceeded",
          severity: "WARNING",
          ip_address: "192.168.1.1",
          description: "Security event: rate limit exceeded",
          metadata: expect.objectContaining({
            user_agent: "TestBot/1.0",
            threat_type: "rate_limit_exceeded",
            attempts: 100,
          }),
        })
      );
    });

    it("should set critical severity for suspicious patterns", async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });

      (supabase.from as unknown).mockReturnValue({
        insert: insertMock,
      });

      await logSecurityEvent({
        type: "suspicious_pattern",
        ip: "192.168.1.1",
        userAgent: "HackBot/2.0",
        metadata: { pattern: "sql_injection" },
      });

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: "CRITICAL",
        })
      );
    });
  });
});
