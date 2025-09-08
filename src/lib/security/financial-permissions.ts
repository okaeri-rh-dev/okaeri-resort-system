/**
 * Granular Financial Permissions System
 * CRITICAL SECURITY: Fine-grained access control for financial operations
 *
 * Implements a hierarchical permission model for financial data:
 * - VIEW: Can see masked financial amounts
 * - VIEW_FULL: Can see actual financial amounts
 * - EDIT: Can modify financial records
 * - APPROVE: Can approve financial transactions
 * - DELETE: Can delete/void financial records
 * - AUDIT: Can access financial audit logs
 *
 * Philippine Compliance:
 * - BIR requirements for financial record access
 * - Data Privacy Act compliance for financial PII
 * - Audit trail requirements for tax compliance
 */

import { z } from "zod";
import { createSecureAuditLog } from "./database-encryption";

// ================================================================
// PERMISSION DEFINITIONS
// ================================================================

/**
 * Financial operation permissions
 */
export enum FinancialPermission {
  // Viewing permissions
  VIEW_MASKED = "financial:view:masked", // See that data exists, but amounts masked
  VIEW_SUMMARY = "financial:view:summary", // See aggregated data only
  VIEW_FULL = "financial:view:full", // See actual amounts

  // Editing permissions
  EDIT_DRAFT = "financial:edit:draft", // Create/edit draft records
  EDIT_SUBMITTED = "financial:edit:submitted", // Edit submitted records
  EDIT_APPROVED = "financial:edit:approved", // Edit approved records (dangerous)

  // Approval permissions
  APPROVE_SMALL = "financial:approve:small", // Approve < ₱10,000
  APPROVE_MEDIUM = "financial:approve:medium", // Approve < ₱50,000
  APPROVE_LARGE = "financial:approve:large", // Approve < ₱500,000
  APPROVE_UNLIMITED = "financial:approve:unlimited", // Approve any amount

  // Special operations
  DELETE = "financial:delete", // Delete/void records
  EXPORT = "financial:export", // Export financial data
  AUDIT = "financial:audit", // Access audit logs
  RECONCILE = "financial:reconcile", // Perform reconciliation

  // Report permissions
  REPORT_VIEW = "financial:report:view", // View financial reports
  REPORT_GENERATE = "financial:report:generate", // Generate new reports
  REPORT_SHARE = "financial:report:share", // Share reports externally

  // Configuration permissions
  CONFIG_CATEGORIES = "financial:config:categories", // Manage expense categories
  CONFIG_VENDORS = "financial:config:vendors", // Manage vendors
  CONFIG_APPROVAL = "financial:config:approval", // Configure approval workflows
  CONFIG_KEYS = "financial:config:keys", // Manage encryption keys (CRITICAL)
}

/**
 * Permission groups for role-based assignment
 */
export const FinancialRoles = {
  VIEWER: [
    FinancialPermission.VIEW_MASKED,
    FinancialPermission.VIEW_SUMMARY,
    FinancialPermission.REPORT_VIEW,
  ],

  BOOKKEEPER: [
    FinancialPermission.VIEW_FULL,
    FinancialPermission.EDIT_DRAFT,
    FinancialPermission.EDIT_SUBMITTED,
    FinancialPermission.REPORT_VIEW,
    FinancialPermission.REPORT_GENERATE,
    FinancialPermission.CONFIG_CATEGORIES,
    FinancialPermission.CONFIG_VENDORS,
  ],

  MANAGER: [
    FinancialPermission.VIEW_FULL,
    FinancialPermission.EDIT_DRAFT,
    FinancialPermission.EDIT_SUBMITTED,
    FinancialPermission.APPROVE_SMALL,
    FinancialPermission.APPROVE_MEDIUM,
    FinancialPermission.REPORT_VIEW,
    FinancialPermission.REPORT_GENERATE,
    FinancialPermission.REPORT_SHARE,
    FinancialPermission.CONFIG_CATEGORIES,
    FinancialPermission.CONFIG_VENDORS,
    FinancialPermission.CONFIG_APPROVAL,
  ],

  FINANCE_DIRECTOR: [
    FinancialPermission.VIEW_FULL,
    FinancialPermission.EDIT_DRAFT,
    FinancialPermission.EDIT_SUBMITTED,
    FinancialPermission.EDIT_APPROVED,
    FinancialPermission.APPROVE_LARGE,
    FinancialPermission.DELETE,
    FinancialPermission.EXPORT,
    FinancialPermission.RECONCILE,
    FinancialPermission.REPORT_VIEW,
    FinancialPermission.REPORT_GENERATE,
    FinancialPermission.REPORT_SHARE,
    FinancialPermission.CONFIG_CATEGORIES,
    FinancialPermission.CONFIG_VENDORS,
    FinancialPermission.CONFIG_APPROVAL,
  ],

  OWNER: [
    // Owners have all permissions
    ...Object.values(FinancialPermission),
  ],

  AUDITOR: [
    FinancialPermission.VIEW_FULL,
    FinancialPermission.AUDIT,
    FinancialPermission.REPORT_VIEW,
    FinancialPermission.EXPORT,
  ],
} as const;

/**
 * Approval limits by permission level (in Philippine Pesos)
 */
export const ApprovalLimits = {
  [FinancialPermission.APPROVE_SMALL]: 10000,
  [FinancialPermission.APPROVE_MEDIUM]: 50000,
  [FinancialPermission.APPROVE_LARGE]: 500000,
  [FinancialPermission.APPROVE_UNLIMITED]: Number.MAX_SAFE_INTEGER,
} as const;

// ================================================================
// PERMISSION CHECKING
// ================================================================

export class FinancialPermissionService {
  private static instance: FinancialPermissionService;
  private userPermissionsCache: Map<string, Set<FinancialPermission>> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes

  private constructor() {}

  static getInstance(): FinancialPermissionService {
    if (!FinancialPermissionService.instance) {
      FinancialPermissionService.instance = new FinancialPermissionService();
    }
    return FinancialPermissionService.instance;
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(
    userId: string,
    permission: FinancialPermission,
    context?: {
      projectId?: string;
      amount?: number;
      recordStatus?: string;
    }
  ): Promise<boolean> {
    try {
      // Get user permissions
      const userPermissions = await this.getUserPermissions(userId);

      // Check base permission
      if (!userPermissions.has(permission)) {
        await this.logPermissionDenied(userId, permission, context);
        return false;
      }

      // Check context-specific rules
      if (context) {
        const contextCheck = await this.checkContextualPermission(userId, permission, context);

        if (!contextCheck) {
          await this.logPermissionDenied(userId, permission, context);
          return false;
        }
      }

      // Log successful permission check for audit
      await this.logPermissionGranted(userId, permission, context);
      return true;
    } catch (error) {
      console.error("[Permissions] Error checking permission:", error);
      // Fail closed - deny access on error
      return false;
    }
  }

  /**
   * Check if user can approve a specific amount
   */
  async canApproveAmount(userId: string, amount: number, projectId: string): Promise<boolean> {
    // Check each approval level from highest to lowest
    const approvalPermissions = [
      FinancialPermission.APPROVE_UNLIMITED,
      FinancialPermission.APPROVE_LARGE,
      FinancialPermission.APPROVE_MEDIUM,
      FinancialPermission.APPROVE_SMALL,
    ];

    for (const permission of approvalPermissions) {
      const hasPermission = await this.hasPermission(userId, permission, {
        projectId,
        amount,
      });

      if (hasPermission) {
        const limit = ApprovalLimits[permission];
        if (amount <= limit) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get maximum approval amount for user
   */
  async getMaxApprovalAmount(userId: string): Promise<number> {
    const userPermissions = await this.getUserPermissions(userId);

    if (userPermissions.has(FinancialPermission.APPROVE_UNLIMITED)) {
      return Number.MAX_SAFE_INTEGER;
    }

    if (userPermissions.has(FinancialPermission.APPROVE_LARGE)) {
      return ApprovalLimits[FinancialPermission.APPROVE_LARGE];
    }

    if (userPermissions.has(FinancialPermission.APPROVE_MEDIUM)) {
      return ApprovalLimits[FinancialPermission.APPROVE_MEDIUM];
    }

    if (userPermissions.has(FinancialPermission.APPROVE_SMALL)) {
      return ApprovalLimits[FinancialPermission.APPROVE_SMALL];
    }

    return 0;
  }

  /**
   * Check if user can view financial data
   */
  async canViewFinancialData(
    userId: string,
    dataType: "masked" | "summary" | "full"
  ): Promise<boolean> {
    const permissionMap = {
      masked: FinancialPermission.VIEW_MASKED,
      summary: FinancialPermission.VIEW_SUMMARY,
      full: FinancialPermission.VIEW_FULL,
    };

    return this.hasPermission(userId, permissionMap[dataType]);
  }

  /**
   * Check if user can edit financial records
   */
  async canEditFinancialRecord(
    userId: string,
    recordStatus: "draft" | "submitted" | "approved"
  ): Promise<boolean> {
    const permissionMap = {
      draft: FinancialPermission.EDIT_DRAFT,
      submitted: FinancialPermission.EDIT_SUBMITTED,
      approved: FinancialPermission.EDIT_APPROVED,
    };

    return this.hasPermission(userId, permissionMap[recordStatus], { recordStatus });
  }

  /**
   * Filter financial data based on user permissions
   */
  async filterFinancialData<T extends Record<string, any>>(
    userId: string,
    data: T,
    sensitiveFields: string[] = ["amount", "total_amount", "paid_amount", "net_amount"]
  ): Promise<T> {
    const canViewFull = await this.canViewFinancialData(userId, "full");

    if (canViewFull) {
      return data; // No filtering needed
    }

    const canViewMasked = await this.canViewFinancialData(userId, "masked");

    if (!canViewMasked) {
      // Remove all sensitive fields
      const filtered = { ...data };
      for (const field of sensitiveFields) {
        delete filtered[field];
      }
      return filtered;
    }

    // Mask sensitive fields
    const masked = { ...data };
    for (const field of sensitiveFields) {
      if (field in masked && masked[field] !== null) {
        masked[field] = this.maskAmount(masked[field]);
      }
    }

    return masked;
  }

  /**
   * Validate permission configuration
   */
  validatePermissionSet(permissions: FinancialPermission[]): {
    valid: boolean;
    conflicts: string[];
    missing: string[];
    suggestions: string[];
  } {
    const conflicts: string[] = [];
    const missing: string[] = [];
    const suggestions: string[] = [];

    // Check for logical conflicts
    if (
      permissions.includes(FinancialPermission.APPROVE_LARGE) &&
      !permissions.includes(FinancialPermission.VIEW_FULL)
    ) {
      conflicts.push("Cannot approve large amounts without full view permission");
    }

    if (
      permissions.includes(FinancialPermission.EDIT_APPROVED) &&
      !permissions.includes(FinancialPermission.AUDIT)
    ) {
      missing.push("Editing approved records should include audit permission");
    }

    if (
      permissions.includes(FinancialPermission.DELETE) &&
      !permissions.includes(FinancialPermission.AUDIT)
    ) {
      missing.push("Delete permission should include audit permission");
    }

    // Check for incomplete permission sets
    if (
      permissions.includes(FinancialPermission.APPROVE_MEDIUM) &&
      !permissions.includes(FinancialPermission.APPROVE_SMALL)
    ) {
      suggestions.push("Consider adding APPROVE_SMALL for consistency");
    }

    return {
      valid: conflicts.length === 0,
      conflicts,
      missing,
      suggestions,
    };
  }

  /**
   * Get permission requirements for an operation
   */
  getRequiredPermissions(operation: string): FinancialPermission[] {
    const requirements: Record<string, FinancialPermission[]> = {
      view_expense_list: [FinancialPermission.VIEW_MASKED],
      view_expense_detail: [FinancialPermission.VIEW_FULL],
      create_expense: [FinancialPermission.EDIT_DRAFT],
      edit_expense: [FinancialPermission.EDIT_SUBMITTED],
      approve_expense: [FinancialPermission.APPROVE_SMALL],
      delete_expense: [FinancialPermission.DELETE, FinancialPermission.AUDIT],
      export_financial_report: [FinancialPermission.EXPORT, FinancialPermission.VIEW_FULL],
      view_audit_logs: [FinancialPermission.AUDIT],
      manage_encryption_keys: [FinancialPermission.CONFIG_KEYS],
    };

    return requirements[operation] || [];
  }

  // ================================================================
  // PRIVATE METHODS
  // ================================================================

  private async getUserPermissions(userId: string): Promise<Set<FinancialPermission>> {
    // Check cache
    const cached = this.userPermissionsCache.get(userId);
    if (cached) {
      return cached;
    }

    // In production, this would query the database
    // For now, return a mock set based on user ID pattern
    let permissions: FinancialPermission[] = [];

    if (userId.includes("owner")) {
      permissions = [...FinancialRoles.OWNER];
    } else if (userId.includes("manager")) {
      permissions = [...FinancialRoles.MANAGER];
    } else if (userId.includes("bookkeeper")) {
      permissions = [...FinancialRoles.BOOKKEEPER];
    } else if (userId.includes("auditor")) {
      permissions = [...FinancialRoles.AUDITOR];
    } else {
      permissions = [...FinancialRoles.VIEWER];
    }

    const permissionSet = new Set(permissions);

    // Cache the result
    this.userPermissionsCache.set(userId, permissionSet);

    // Clear cache after TTL
    setTimeout(() => {
      this.userPermissionsCache.delete(userId);
    }, this.CACHE_TTL);

    return permissionSet;
  }

  private async checkContextualPermission(
    userId: string,
    permission: FinancialPermission,
    context: {
      projectId?: string;
      amount?: number;
      recordStatus?: string;
    }
  ): Promise<boolean> {
    // Check amount-based permissions
    if (permission.startsWith("financial:approve:") && context.amount) {
      const limit = ApprovalLimits[permission];
      if (context.amount > limit) {
        return false;
      }
    }

    // Check status-based edit permissions
    if (permission.startsWith("financial:edit:") && context.recordStatus) {
      const requiredStatus = permission.split(":")[2];
      if (requiredStatus !== context.recordStatus && requiredStatus !== "approved") {
        return false;
      }
    }

    // Additional project-based checks would go here
    // For example, checking if user has access to the specific project

    return true;
  }

  private maskAmount(amount: number | string): string {
    if (typeof amount === "string") {
      amount = parseFloat(amount);
    }

    if (isNaN(amount)) {
      return "₱*,***.**";
    }

    // Show range instead of exact amount
    if (amount < 1000) {
      return "< ₱1,000";
    } else if (amount < 10000) {
      return "₱1,000 - ₱10,000";
    } else if (amount < 50000) {
      return "₱10,000 - ₱50,000";
    } else if (amount < 100000) {
      return "₱50,000 - ₱100,000";
    } else {
      return "> ₱100,000";
    }
  }

  private async logPermissionGranted(
    userId: string,
    permission: FinancialPermission,
    context?: any
  ): Promise<void> {
    // Log successful permission check
    await createSecureAuditLog({
      projectId: context?.projectId || "00000000-0000-0000-0000-000000000000",
      entityType: "user",
      entityId: userId,
      action: "VIEW",
      userId,
      userName: "System",
      userRole: "permission_check",
      fieldName: "permission",
      newValue: permission,
      changeReason: "Permission granted",
    });
  }

  private async logPermissionDenied(
    userId: string,
    permission: FinancialPermission,
    context?: any
  ): Promise<void> {
    // Log permission denial for security monitoring
    console.warn(`[Permissions] Access denied for user ${userId} to ${permission}`);

    await createSecureAuditLog({
      projectId: context?.projectId || "00000000-0000-0000-0000-000000000000",
      entityType: "user",
      entityId: userId,
      action: "VIEW",
      userId,
      userName: "System",
      userRole: "permission_check",
      fieldName: "permission",
      newValue: permission,
      changeReason: "Permission denied - insufficient privileges",
    });
  }
}

// ================================================================
// PERMISSION DECORATORS (for class methods)
// ================================================================

/**
 * Decorator to check financial permissions before method execution
 */
export function RequireFinancialPermission(permission: FinancialPermission) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Extract userId from context (this would come from auth context)
      const userId = (this as any).userId || args[0]?.userId;

      if (!userId) {
        throw new Error("User ID required for permission check");
      }

      const service = FinancialPermissionService.getInstance();
      const hasPermission = await service.hasPermission(userId, permission);

      if (!hasPermission) {
        throw new Error(`Insufficient permissions: ${permission} required`);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Decorator to mask financial data based on permissions
 */
export function MaskFinancialData(sensitiveFields?: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);

      // Extract userId from context
      const userId = (this as any).userId || args[0]?.userId;

      if (!userId || !result) {
        return result;
      }

      const service = FinancialPermissionService.getInstance();

      if (Array.isArray(result)) {
        return Promise.all(
          result.map((item) => service.filterFinancialData(userId, item, sensitiveFields))
        );
      } else {
        return service.filterFinancialData(userId, result, sensitiveFields);
      }
    };

    return descriptor;
  };
}

// ================================================================
// EXPORTS
// ================================================================

export const financialPermissions = FinancialPermissionService.getInstance();

// Convenience functions
export const hasFinancialPermission = (
  userId: string,
  permission: FinancialPermission,
  context?: any
) => financialPermissions.hasPermission(userId, permission, context);

export const canApproveAmount = (userId: string, amount: number, projectId: string) =>
  financialPermissions.canApproveAmount(userId, amount, projectId);

export const canViewFinancialData = (userId: string, dataType: "masked" | "summary" | "full") =>
  financialPermissions.canViewFinancialData(userId, dataType);

export const filterFinancialData = <T extends Record<string, any>>(
  userId: string,
  data: T,
  sensitiveFields?: string[]
) => financialPermissions.filterFinancialData(userId, data, sensitiveFields);
