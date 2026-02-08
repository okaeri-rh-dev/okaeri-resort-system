/**
 * Rate Limiting Security Tests
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkKVRateLimit, createAdvancedFingerprint, getClientIp } from "@/lib/kv-rate-limit";

// Mock KV namespace
const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
} as unknown as KVNamespace;

describe("Rate Limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkKVRateLimit", () => {
    it("should allow requests within limit", async () => {
      mockKV.get = vi.fn().mockResolvedValue(null); // No existing count

      const result = await checkKVRateLimit(mockKV, "test-ip", {
        limit: 5,
        windowSeconds: 3600,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.retryAfter).toBe(0);
      expect(mockKV.put).toHaveBeenCalledOnce();
    });

    it("should block requests over limit", async () => {
      mockKV.get = vi.fn().mockResolvedValue("5"); // Already at limit

      const result = await checkKVRateLimit(mockKV, "test-ip", {
        limit: 5,
        windowSeconds: 3600,
        trackViolations: false, // Disable violation tracking for this test
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(mockKV.put).not.toHaveBeenCalled();
    });

    it("should track violations when rate limit exceeded", async () => {
      mockKV.get = vi.fn().mockResolvedValue("5"); // Already at limit

      const result = await checkKVRateLimit(mockKV, "test-ip", {
        limit: 5,
        windowSeconds: 3600,
        trackViolations: true, // Enable violation tracking
      });

      expect(result.allowed).toBe(false);
      expect(result.violationTracked).toBe(true);
      // Violations should be tracked via kv.put calls
      expect(mockKV.put).toHaveBeenCalled();
    });

    it("should use coarse window strategy", async () => {
      const now = Math.floor(Date.now() / 1000);
      const windowKey = Math.floor(now / 3600);

      mockKV.get = vi.fn().mockResolvedValue("2");

      await checkKVRateLimit(mockKV, "test-ip", {
        limit: 5,
        windowSeconds: 3600,
      });

      expect(mockKV.get).toHaveBeenCalledWith(`rate-limit:test-ip:${windowKey}`);
    });

    it("should set appropriate TTL on keys", async () => {
      mockKV.get = vi.fn().mockResolvedValue(null);

      await checkKVRateLimit(mockKV, "test-ip", {
        limit: 5,
        windowSeconds: 3600,
      });

      expect(mockKV.put).toHaveBeenCalledWith(
        expect.any(String),
        "1",
        expect.objectContaining({
          expirationTtl: 3660, // windowSeconds + 60
        })
      );
    });
  });

  describe("createAdvancedFingerprint", () => {
    it("should create consistent fingerprint for same request", async () => {
      const headers = new Headers({
        "CF-Connecting-IP": "192.168.1.1",
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "en-US",
      });

      const request1 = new Request("https://example.com", { headers });
      const request2 = new Request("https://example.com", { headers });

      const fp1 = await createAdvancedFingerprint(request1);
      const fp2 = await createAdvancedFingerprint(request2);

      expect(fp1).toBe(fp2);
      expect(fp1).toHaveLength(16); // SHA-256 truncated to 16 chars
    });

    it("should create different fingerprints for different IPs", async () => {
      const request1 = new Request("https://example.com", {
        headers: new Headers({ "CF-Connecting-IP": "192.168.1.1" }),
      });

      const request2 = new Request("https://example.com", {
        headers: new Headers({ "CF-Connecting-IP": "192.168.1.2" }),
      });

      const fp1 = await createAdvancedFingerprint(request1);
      const fp2 = await createAdvancedFingerprint(request2);

      expect(fp1).not.toBe(fp2);
    });

    it("should include multiple factors in fingerprint", async () => {
      const headers = new Headers({
        "CF-Connecting-IP": "192.168.1.1",
        "User-Agent": "TestBot/1.0",
        "Accept-Language": "en-US",
        "Accept-Encoding": "gzip",
        "Sec-CH-UA": '"Chromium";v="122"',
        "CF-IPCountry": "US",
      });

      const request = new Request("https://example.com", { headers });
      const fingerprint = await createAdvancedFingerprint(request);

      expect(fingerprint).toBeDefined();
      expect(fingerprint).toMatch(/^[a-f0-9]{16}$/);
    });
  });

  describe("getClientIp", () => {
    it("should extract IP from CF-Connecting-IP header", () => {
      const request = new Request("https://example.com", {
        headers: new Headers({ "CF-Connecting-IP": "192.168.1.1" }),
      });

      const ip = getClientIp(request);
      expect(ip).toBe("192.168.1.1");
    });

    it("should fallback to X-Forwarded-For", () => {
      const request = new Request("https://example.com", {
        headers: new Headers({ "X-Forwarded-For": "192.168.1.2, 10.0.0.1" }),
      });

      const ip = getClientIp(request);
      expect(ip).toBe("192.168.1.2");
    });

    it("should return unknown if no IP headers", () => {
      const request = new Request("https://example.com");

      const ip = getClientIp(request);
      expect(ip).toBe("unknown");
    });
  });
});
