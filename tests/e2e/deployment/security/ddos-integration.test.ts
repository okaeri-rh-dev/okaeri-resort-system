/**
 * DDoS Protection Integration Tests
 * Phase 5.2 Security Hardening - Simple integration tests for implemented functionality
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("DDoS Protection Integration", () => {
  it("should test DDoS protection module structure", async () => {
    // Simple unit test that verifies the DDoS protection functions exist and work
    const { checkDDoSProtection, recordRequestCompletion } = await import(
      "../../../../api/_lib/ddos-protection.js"
    );

    expect(checkDDoSProtection).toBeDefined();
    expect(typeof checkDDoSProtection).toBe("function");
    expect(recordRequestCompletion).toBeDefined();
    expect(typeof recordRequestCompletion).toBe("function");
  });

  it("should handle DDoS protection calls without Redis configured", async () => {
    const { checkDDoSProtection, recordRequestCompletion } = await import(
      "../../../../api/_lib/ddos-protection.js"
    );

    // When Redis is not configured, should fail open
    const result = await checkDDoSProtection();
    expect(result.allowed).toBe(true);

    // Recording completion should not throw
    await expect(recordRequestCompletion()).resolves.toBeUndefined();
  });
});

describe("Security Compliance", () => {
  it("should have security.txt file accessible", () => {
    // Test that security.txt file exists
    const securityTxtPath = path.join(process.cwd(), "public/.well-known/security.txt");
    expect(fs.existsSync(securityTxtPath)).toBe(true);

    const content = fs.readFileSync(securityTxtPath, "utf8");
    expect(content).toContain("Contact:");
    expect(content).toContain("Expires:");
    expect(content).toContain("Philippine Time");
    expect(content).toContain("Philippines");
  });
});
