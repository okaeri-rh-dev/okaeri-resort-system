/**
 * DDoS Protection Integration Tests
 * Phase 5.2 Security Hardening - Simple integration tests for DDoS protection
 */

import { describe, it, expect } from "vitest";
import { checkDDoSProtection } from "../../../api/_lib/ddos-protection";

describe("DDoS Protection Module", () => {
  describe("checkDDoSProtection", () => {
    it("should handle disabled state gracefully (fail open)", async () => {
      // When Redis is not configured, DDoS protection should fail open
      const result = await checkDDoSProtection();

      expect(result.allowed).toBe(true);
      // When disabled, reason may not be set
    });

    it("should return a proper protection result structure", async () => {
      const result = await checkDDoSProtection();

      // Verify the result has the expected structure
      expect(result).toHaveProperty("allowed");
      expect(typeof result.allowed).toBe("boolean");

      if (result.currentLimits) {
        expect(result.currentLimits).toHaveProperty("bandwidthUsed");
        expect(result.currentLimits).toHaveProperty("executionHoursUsed");
      }
    });

    it("should be safe to call multiple times", async () => {
      const result1 = await checkDDoSProtection();
      const result2 = await checkDDoSProtection();

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1.allowed).toBe(result2.allowed);
    });
  });
});
