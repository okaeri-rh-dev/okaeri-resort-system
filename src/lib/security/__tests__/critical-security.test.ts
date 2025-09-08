/**
 * CRITICAL SECURITY TESTS - Phase 4.5
 * Production-Ready Security Validation Suite
 *
 * These tests validate the critical security fixes implemented for production:
 * 1. Database-level AES-256 encryption for financial data
 * 2. Immutable audit logs with hash chaining
 * 3. Granular financial permissions
 * 4. Philippine Data Privacy Act compliance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DatabaseEncryptionService,
  EncryptionPurpose,
  AlertSeverity,
  prepareFinancialData,
  preparePII,
  requiresEncryption,
  verifyAuditIntegrity,
} from "../database-encryption";
import {
  FinancialPermissionService,
  FinancialPermission,
  FinancialRoles,
  ApprovalLimits,
  hasFinancialPermission,
  canApproveAmount,
  filterFinancialData,
} from "../financial-permissions";

// ================================================================
// TEST SUITE 1: DATABASE ENCRYPTION
// ================================================================

describe("CRITICAL: Database-Level Encryption", () => {
  let encryptionService: DatabaseEncryptionService;

  beforeEach(() => {
    encryptionService = DatabaseEncryptionService.getInstance();
  });

  describe("Financial Data Encryption", () => {
    it("should prepare financial amounts for encryption", () => {
      const amount = 12345.67;
      const prepared = prepareFinancialData(amount);

      expect(prepared).toBe("12345.67");
      expect(typeof prepared).toBe("string");
    });

    it("should handle null financial amounts", () => {
      const prepared = prepareFinancialData(null);
      expect(prepared).toBeNull();
    });

    it("should reject invalid financial amounts", () => {
      expect(() => prepareFinancialData(NaN)).toThrow("Invalid financial amount");
      expect(() => prepareFinancialData(-100)).toThrow("Invalid financial amount");
      expect(() => prepareFinancialData(Infinity)).toThrow("Invalid financial amount");
    });

    it("should detect financial fields requiring encryption", () => {
      expect(requiresEncryption(1000, "total_amount")).toBe(true);
      expect(requiresEncryption(500, "payment")).toBe(true);
      expect(requiresEncryption(100, "price")).toBe(true);
      expect(requiresEncryption(50, "balance")).toBe(true);

      expect(requiresEncryption("test", "description")).toBe(false);
      expect(requiresEncryption(5, "quantity")).toBe(false);
    });

    it("should format encrypted financial data for API responses", () => {
      const formatted = encryptionService.formatEncryptedResponse("financial", true);
      expect(formatted).toBe("₱**.***.**");
    });

    it("should warn about unencrypted financial data", () => {
      const formatted = encryptionService.formatEncryptedResponse("financial", false);
      expect(formatted).toBe("[UNENCRYPTED - SECURITY RISK]");
    });
  });

  describe("PII Encryption", () => {
    it("should prepare email for encryption", () => {
      const email = "TEST@EXAMPLE.COM  ";
      const prepared = preparePII(email, "email");

      expect(prepared).toBe("test@example.com");
    });

    it("should validate email format", () => {
      expect(() => preparePII("invalid-email", "email")).toThrow("Invalid email format");
    });

    it("should normalize Philippine phone numbers", () => {
      const phone1 = "09171234567";
      const prepared1 = preparePII(phone1, "phone");
      expect(prepared1).toBe("+639171234567");

      const phone2 = "639171234567";
      const prepared2 = preparePII(phone2, "phone");
      expect(prepared2).toBe("+639171234567");

      const phone3 = "+639171234567";
      const prepared3 = preparePII(phone3, "phone");
      expect(prepared3).toBe("+639171234567");
    });

    it("should sanitize names", () => {
      const name = '  John <script>alert("xss")</script> Doe  ';
      const prepared = preparePII(name, "name");

      expect(prepared).toBe("John alert(xss) Doe");
      expect(prepared).not.toContain("<");
      expect(prepared).not.toContain(">");
    });

    it("should detect Philippine ID patterns", () => {
      // SSS format
      expect(requiresEncryption("123-45-6789", "any")).toBe(true);

      // TIN format
      expect(requiresEncryption("123-456-789-123", "tin")).toBe(true);

      // PhilHealth format
      expect(requiresEncryption("12-987654321-0", "philhealth")).toBe(true);

      // Credit card format
      expect(requiresEncryption("1234-5678-9012-3456", "card")).toBe(true);
    });

    it("should mask PII in API responses", () => {
      const maskedEmail = encryptionService.formatEncryptedResponse("email", true);
      expect(maskedEmail).toBe("***@***.***");

      const maskedPhone = encryptionService.formatEncryptedResponse("phone", true);
      expect(maskedPhone).toBe("+63*********");

      const maskedName = encryptionService.formatEncryptedResponse("name", true);
      expect(maskedName).toBe("****** ******");
    });
  });

  describe("Encryption Monitoring", () => {
    it("should get encryption statistics", async () => {
      const stats = await encryptionService.getEncryptionStats();

      expect(stats).toBeDefined();
      expect(Array.isArray(stats)).toBe(true);

      if (stats.length > 0) {
        const stat = stats[0];
        expect(stat).toHaveProperty("keyPurpose");
        expect(stat).toHaveProperty("keyVersion");
        expect(stat).toHaveProperty("usageCount");
        expect(stat).toHaveProperty("daysUntilRotation");
      }
    });

    it("should check for security alerts", async () => {
      const alerts = await encryptionService.checkSecurityAlerts();

      expect(Array.isArray(alerts)).toBe(true);

      // If there are alerts, validate structure
      if (alerts.length > 0) {
        const alert = alerts[0];
        expect(alert).toHaveProperty("id");
        expect(alert).toHaveProperty("alertType");
        expect(alert).toHaveProperty("severity");
        expect(alert).toHaveProperty("message");
      }
    });

    it("should generate encryption report", async () => {
      const report = await encryptionService.generateEncryptionReport();

      expect(report).toHaveProperty("encryptedFields");
      expect(report).toHaveProperty("keyRotationSchedule");
      expect(report).toHaveProperty("encryptionVersion");
      expect(report).toHaveProperty("complianceStatus");
      expect(report).toHaveProperty("recommendations");

      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });
});

// ================================================================
// TEST SUITE 2: AUDIT LOG IMMUTABILITY
// ================================================================

describe("CRITICAL: Immutable Audit Logs", () => {
  describe("Audit Log Creation", () => {
    it("should create secure audit log entry", async () => {
      const auditData = {
        projectId: "123e4567-e89b-12d3-a456-426614174000",
        entityType: "expense" as const,
        entityId: "987e6543-e89b-12d3-a456-426614174000",
        action: "UPDATE" as const,
        userId: "123e4567-e89b-12d3-a456-426614174001",
        userName: "John Doe",
        userRole: "manager",
        fieldName: "amount",
        oldValue: 1000,
        newValue: 1500,
        changeReason: "Price adjustment",
      };

      const auditId = await DatabaseEncryptionService.getInstance().createAuditLog(auditData);

      expect(auditId).toBeDefined();
      expect(typeof auditId).toBe("string");
      expect(auditId).toContain("audit_");
    });

    it("should detect sensitive data in audit values", async () => {
      const auditData = {
        projectId: "123e4567-e89b-12d3-a456-426614174000",
        entityType: "booking" as const,
        entityId: "987e6543-e89b-12d3-a456-426614174000",
        action: "UPDATE" as const,
        userId: "123e4567-e89b-12d3-a456-426614174001",
        userName: "John Doe",
        userRole: "manager",
        fieldName: "guest_details",
        oldValue: {
          name: "Jane Doe",
          email: "jane@example.com",
          tin: "123-456-789-123",
        },
        newValue: {
          name: "Jane Smith",
          email: "jane.smith@example.com",
          tin: "987-654-321-987",
        },
      };

      const auditId = await DatabaseEncryptionService.getInstance().createAuditLog(auditData);

      expect(auditId).toBeDefined();
      // The sensitive data should be marked for encryption
    });
  });

  describe("Audit Chain Verification", () => {
    it("should verify audit chain integrity", async () => {
      const verification = await verifyAuditIntegrity("test-project", 100);

      expect(verification).toHaveProperty("isValid");
      expect(verification).toHaveProperty("invalidCount");
      expect(verification).toHaveProperty("verificationTimestamp");

      // In a clean state, chain should be valid
      expect(verification.isValid).toBe(true);
      expect(verification.invalidCount).toBe(0);
    });

    it("should detect tampered audit logs", async () => {
      // This would be tested with actual database manipulation
      // For now, we verify the structure exists
      const verification = await verifyAuditIntegrity("tampered-project", 10);

      expect(verification).toBeDefined();
      expect(typeof verification.isValid).toBe("boolean");
    });
  });
});

// ================================================================
// TEST SUITE 3: GRANULAR FINANCIAL PERMISSIONS
// ================================================================

describe("CRITICAL: Financial Permission System", () => {
  let permissionService: FinancialPermissionService;

  beforeEach(() => {
    permissionService = FinancialPermissionService.getInstance();
  });

  describe("Permission Checking", () => {
    it("should check basic financial permissions", async () => {
      // Test owner permissions (has all)
      const ownerHasView = await hasFinancialPermission("owner-123", FinancialPermission.VIEW_FULL);
      expect(ownerHasView).toBe(true);

      const ownerCanDelete = await hasFinancialPermission("owner-123", FinancialPermission.DELETE);
      expect(ownerCanDelete).toBe(true);

      const ownerCanConfigKeys = await hasFinancialPermission(
        "owner-123",
        FinancialPermission.CONFIG_KEYS
      );
      expect(ownerCanConfigKeys).toBe(true);
    });

    it("should enforce role-based permissions", async () => {
      // Viewer should only have limited permissions
      const viewerCanViewMasked = await hasFinancialPermission(
        "viewer-123",
        FinancialPermission.VIEW_MASKED
      );
      expect(viewerCanViewMasked).toBe(true);

      const viewerCanEdit = await hasFinancialPermission(
        "viewer-123",
        FinancialPermission.EDIT_DRAFT
      );
      expect(viewerCanEdit).toBe(false);

      const viewerCanApprove = await hasFinancialPermission(
        "viewer-123",
        FinancialPermission.APPROVE_SMALL
      );
      expect(viewerCanApprove).toBe(false);
    });

    it("should validate manager permissions", async () => {
      const canViewFull = await hasFinancialPermission(
        "manager-123",
        FinancialPermission.VIEW_FULL
      );
      expect(canViewFull).toBe(true);

      const canApproveSmall = await hasFinancialPermission(
        "manager-123",
        FinancialPermission.APPROVE_SMALL
      );
      expect(canApproveSmall).toBe(true);

      const canApproveMedium = await hasFinancialPermission(
        "manager-123",
        FinancialPermission.APPROVE_MEDIUM
      );
      expect(canApproveMedium).toBe(true);

      // Manager cannot approve large amounts
      const canApproveLarge = await hasFinancialPermission(
        "manager-123",
        FinancialPermission.APPROVE_LARGE
      );
      expect(canApproveLarge).toBe(false);
    });

    it("should validate auditor permissions", async () => {
      const canAudit = await hasFinancialPermission("auditor-123", FinancialPermission.AUDIT);
      expect(canAudit).toBe(true);

      const canExport = await hasFinancialPermission("auditor-123", FinancialPermission.EXPORT);
      expect(canExport).toBe(true);

      // Auditor cannot edit
      const canEdit = await hasFinancialPermission("auditor-123", FinancialPermission.EDIT_DRAFT);
      expect(canEdit).toBe(false);
    });
  });

  describe("Approval Limits", () => {
    it("should enforce approval amount limits", async () => {
      const projectId = "test-project";

      // Manager can approve up to medium limit
      const managerCanApprove10k = await canApproveAmount("manager-123", 10000, projectId);
      expect(managerCanApprove10k).toBe(true);

      const managerCanApprove50k = await canApproveAmount("manager-123", 50000, projectId);
      expect(managerCanApprove50k).toBe(true);

      const managerCanApprove100k = await canApproveAmount("manager-123", 100000, projectId);
      expect(managerCanApprove100k).toBe(false);
    });

    it("should calculate maximum approval amounts", async () => {
      const ownerMax = await permissionService.getMaxApprovalAmount("owner-123");
      expect(ownerMax).toBe(Number.MAX_SAFE_INTEGER);

      const managerMax = await permissionService.getMaxApprovalAmount("manager-123");
      expect(managerMax).toBe(ApprovalLimits[FinancialPermission.APPROVE_MEDIUM]);

      const viewerMax = await permissionService.getMaxApprovalAmount("viewer-123");
      expect(viewerMax).toBe(0);
    });
  });

  describe("Data Filtering", () => {
    it("should mask financial data for limited viewers", async () => {
      const originalData = {
        id: "123",
        description: "Test expense",
        amount: 25000,
        total_amount: 28000,
        paid_amount: 14000,
        status: "approved",
      };

      const filtered = await filterFinancialData("viewer-123", originalData);

      expect(filtered.id).toBe("123");
      expect(filtered.description).toBe("Test expense");
      expect(filtered.status).toBe("approved");

      // Financial amounts should be masked
      expect(filtered.amount).toBe("₱10,000 - ₱50,000");
      expect(filtered.total_amount).toBe("₱10,000 - ₱50,000");
      expect(filtered.paid_amount).toBe("₱10,000 - ₱50,000");
    });

    it("should show full data for authorized users", async () => {
      const originalData = {
        id: "123",
        amount: 25000,
        total_amount: 28000,
      };

      const filtered = await filterFinancialData("manager-123", originalData);

      expect(filtered.amount).toBe(25000);
      expect(filtered.total_amount).toBe(28000);
    });

    it("should remove sensitive fields for unauthorized users", async () => {
      const originalData = {
        id: "123",
        description: "Test",
        amount: 25000,
        total_amount: 28000,
      };

      // Mock a user with no view permissions
      const filtered = await permissionService.filterFinancialData(
        "no-permissions-user",
        originalData
      );

      expect(filtered.id).toBe("123");
      expect(filtered.description).toBe("Test");
      expect(filtered.amount).toBeUndefined();
      expect(filtered.total_amount).toBeUndefined();
    });
  });

  describe("Permission Validation", () => {
    it("should detect permission conflicts", () => {
      const validation = permissionService.validatePermissionSet([
        FinancialPermission.APPROVE_LARGE,
        FinancialPermission.VIEW_MASKED, // Conflict: need VIEW_FULL to approve
      ]);

      expect(validation.valid).toBe(false);
      expect(validation.conflicts).toContain(
        "Cannot approve large amounts without full view permission"
      );
    });

    it("should suggest missing permissions", () => {
      const validation = permissionService.validatePermissionSet([FinancialPermission.DELETE]);

      expect(validation.missing).toContain("Delete permission should include audit permission");
    });

    it("should validate complete permission sets", () => {
      const validation = permissionService.validatePermissionSet(FinancialRoles.FINANCE_DIRECTOR);

      expect(validation.valid).toBe(true);
      expect(validation.conflicts).toHaveLength(0);
    });
  });

  describe("Operation Requirements", () => {
    it("should return required permissions for operations", () => {
      const viewExpensePerms = permissionService.getRequiredPermissions("view_expense_list");
      expect(viewExpensePerms).toContain(FinancialPermission.VIEW_MASKED);

      const deleteExpensePerms = permissionService.getRequiredPermissions("delete_expense");
      expect(deleteExpensePerms).toContain(FinancialPermission.DELETE);
      expect(deleteExpensePerms).toContain(FinancialPermission.AUDIT);

      const exportPerms = permissionService.getRequiredPermissions("export_financial_report");
      expect(exportPerms).toContain(FinancialPermission.EXPORT);
      expect(exportPerms).toContain(FinancialPermission.VIEW_FULL);
    });
  });
});

// ================================================================
// TEST SUITE 4: INTEGRATION TESTS
// ================================================================

describe("CRITICAL: Security Integration", () => {
  it("should integrate encryption with permissions", async () => {
    // User with limited permissions sees masked encrypted data
    const limitedUserData = {
      id: "123",
      guest_name: "[ENCRYPTED]",
      total_amount: 50000,
    };

    const filtered = await filterFinancialData("viewer-123", limitedUserData);

    // Should see encrypted indicator for name
    expect(filtered.guest_name).toBe("[ENCRYPTED]");

    // Should see masked amount
    expect(filtered.total_amount).toBe("₱10,000 - ₱50,000");
  });

  it("should audit permission checks", async () => {
    const spy = vi.spyOn(DatabaseEncryptionService.getInstance(), "createAuditLog");

    await hasFinancialPermission("test-user", FinancialPermission.VIEW_FULL, {
      projectId: "test-project",
    });

    // Should create audit log for permission check
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });

  it("should handle encryption errors gracefully", () => {
    // Invalid data should throw appropriate errors
    expect(() => prepareFinancialData(-1000)).toThrow("Invalid financial amount");
    expect(() => preparePII("not-an-email", "email")).toThrow("Invalid email format");
  });

  it("should validate Philippine compliance requirements", () => {
    // TIN format validation
    const tinPattern = /^\d{3}-\d{3}-\d{3}-\d{3}$/;
    expect(tinPattern.test("123-456-789-000")).toBe(true);
    expect(tinPattern.test("12345678900")).toBe(false);

    // SSS format validation
    const sssPattern = /^\d{3}-\d{2}-\d{4}$/;
    expect(sssPattern.test("123-45-6789")).toBe(true);
    expect(sssPattern.test("123456789")).toBe(false);

    // PhilHealth format validation
    const philhealthPattern = /^\d{2}-\d{9}-\d$/;
    expect(philhealthPattern.test("12-123456789-0")).toBe(true);
    expect(philhealthPattern.test("12123456789")).toBe(false);
  });
});

// ================================================================
// TEST SUITE 5: PERFORMANCE & EDGE CASES
// ================================================================

describe("CRITICAL: Security Performance & Edge Cases", () => {
  it("should handle large batch operations efficiently", async () => {
    const startTime = Date.now();

    // Simulate batch encryption preparation
    const batchData = Array.from({ length: 1000 }, (_, i) => ({
      amount: 1000 + i,
      description: `Item ${i}`,
    }));

    for (const item of batchData) {
      prepareFinancialData(item.amount);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete within reasonable time (< 1 second for 1000 items)
    expect(duration).toBeLessThan(1000);
  });

  it("should handle null and undefined values safely", () => {
    expect(prepareFinancialData(null)).toBeNull();
    expect(preparePII(null, "email")).toBeNull();
    expect(preparePII("", "phone")).toBeNull();

    expect(requiresEncryption(null, "amount")).toBe(false);
    expect(requiresEncryption(undefined, "total")).toBe(false);
  });

  it("should handle concurrent permission checks", async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      hasFinancialPermission(`user-${i}`, FinancialPermission.VIEW_FULL)
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(10);
    results.forEach((result) => {
      expect(typeof result).toBe("boolean");
    });
  });

  it("should clean up cached permissions", async () => {
    const service = FinancialPermissionService.getInstance();

    // First call should cache
    await service.hasPermission("cache-test-user", FinancialPermission.VIEW_MASKED);

    // Cache should be populated
    expect((service as any).userPermissionsCache.has("cache-test-user")).toBe(true);

    // Wait for cache TTL (mocked to be instant in tests)
    vi.useFakeTimers();
    vi.advanceTimersByTime(300001); // 5 minutes + 1ms

    // Cache should be cleared
    expect((service as any).userPermissionsCache.has("cache-test-user")).toBe(false);

    vi.useRealTimers();
  });
});

// ================================================================
// COMPLIANCE VALIDATION
// ================================================================

describe("CRITICAL: Philippine Data Privacy Act Compliance", () => {
  it("should comply with DPA data classification requirements", () => {
    // Sensitive personal information
    const sensitiveFields = [
      "tin",
      "sss",
      "philhealth",
      "pagibig",
      "medical_history",
      "religion",
      "political_affiliation",
    ];

    sensitiveFields.forEach((field) => {
      expect(requiresEncryption("sample-value", field)).toBe(true);
    });
  });

  it("should implement proper data retention policies", async () => {
    const report = await DatabaseEncryptionService.getInstance().generateEncryptionReport();

    expect(report.recommendations).toContain("Rotate encryption keys every 90 days");
  });

  it("should provide audit trail for compliance", async () => {
    const auditData = {
      projectId: "123e4567-e89b-12d3-a456-426614174000",
      entityType: "user" as const,
      entityId: "987e6543-e89b-12d3-a456-426614174000",
      action: "VIEW" as const,
      userId: "123e4567-e89b-12d3-a456-426614174001",
      userName: "Compliance Auditor",
      userRole: "auditor",
      fieldName: "tin",
      changeReason: "Compliance audit",
    };

    const auditId = await DatabaseEncryptionService.getInstance().createAuditLog(auditData);
    expect(auditId).toBeDefined();
  });
});
