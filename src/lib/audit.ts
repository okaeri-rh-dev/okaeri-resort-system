/**
 * Audit Logging Utility
 *
 * Provides comprehensive audit trail for all system operations
 * with focus on financial transactions and compliance.
 */

import { db } from "@/lib/db";
import { financialAuditTrail } from "@/lib/db/schema/financial-audit.schema";
import { createHash } from "crypto";

interface AuditLogInput {
  userId: string;
  userName?: string;
  userRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  entityCode?: string;
  amount?: number;
  previousAmount?: number;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  severity?: "info" | "warning" | "error" | "critical";
}

interface ChangeSetItem {
  field: string;
  oldValue: any;
  newValue: any;
  dataType: string;
}

export async function auditLog(input: AuditLogInput): Promise<void> {
  try {
    // Generate event ID
    const eventId = generateEventId();

    // Determine event category based on entity type
    const eventCategory = getEventCategory(input.entityType);

    // Calculate amount difference if applicable
    let amountDifference: string | undefined;
    if (input.amount !== undefined && input.previousAmount !== undefined) {
      amountDifference = (input.amount - input.previousAmount).toFixed(2);
    }

    // Generate checksum for critical fields
    const checksum = generateChecksum({
      eventId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      amount: input.amount,
      timestamp: new Date().toISOString(),
    });

    // Determine if BIR reportable based on action and entity type
    const birReportable = isBirReportable(input.action, input.entityType);

    // Create audit trail entry
    await db.insert(financialAuditTrail).values({
      projectId: input.metadata?.projectId || getCurrentProjectId(),
      eventId,
      eventType: input.action,
      eventCategory,
      eventSeverity: input.severity || "info",
      entityType: input.entityType,
      entityId: input.entityId,
      entityCode: input.entityCode,
      monetaryAmount: input.amount?.toString(),
      previousAmount: input.previousAmount?.toString(),
      amountDifference,
      userId: input.userId,
      userName: input.userName,
      userRole: input.userRole,
      sessionId: input.sessionId,
      action: input.action,
      actionMethod: getActionMethod(),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      requestId: input.requestId,
      changeSet: extractChangeSet(input.metadata),
      previousState: input.metadata?.previousState || {},
      newState: input.metadata?.newState || {},
      requiresReview: requiresReview(input.action, input.amount),
      birReportable,
      birFormType: getBirFormType(input.action, input.entityType),
      complianceFlags: getComplianceFlags(input),
      checksum,
      metadata: input.metadata || {},
      tags: generateTags(input),
    });

    // Check for critical events that need immediate attention
    if (input.severity === "critical" || requiresImmediate(input.action)) {
      await notifyCriticalEvent(input);
    }
  } catch (error) {
    // Log audit failures to error tracking but don't throw
    // Audit failures should not break the main operation
    console.error("Audit log failed:", error);
    // Could send to external monitoring service
  }
}

/**
 * Generate unique event ID
 */
function generateEventId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `evt_${timestamp}_${random}`;
}

/**
 * Get event category based on entity type
 */
function getEventCategory(entityType: string): string {
  const categoryMap: Record<string, string> = {
    expense: "expense",
    income: "income",
    payment: "payment",
    vendor: "vendor",
    booking: "booking",
    user: "user",
    tax: "tax",
    discount: "discount",
  };

  return categoryMap[entityType] || "other";
}

/**
 * Determine action method (api, ui, batch, system)
 */
function getActionMethod(): string {
  // This would typically check the request context
  // For now, default to "api"
  if (typeof window !== "undefined") {
    return "ui";
  }
  return "api";
}

/**
 * Extract change set from metadata
 */
function extractChangeSet(metadata?: Record<string, any>): ChangeSetItem[] {
  if (!metadata?.changes) return [];

  const changeSet: ChangeSetItem[] = [];
  const changes = metadata.changes;

  for (const [field, newValue] of Object.entries(changes)) {
    if (metadata.previousValues?.[field] !== undefined) {
      changeSet.push({
        field,
        oldValue: metadata.previousValues[field],
        newValue,
        dataType: typeof newValue,
      });
    }
  }

  return changeSet;
}

/**
 * Generate SHA-512 checksum for data integrity
 */
function generateChecksum(data: Record<string, any>): string {
  const jsonString = JSON.stringify(data, Object.keys(data).sort());
  return createHash("sha512").update(jsonString).digest("hex");
}

/**
 * Check if action is BIR reportable
 */
function isBirReportable(action: string, entityType: string): boolean {
  const reportableActions = [
    "expense.approved",
    "payment.processed",
    "income.recorded",
    "tax.calculated",
    "withholding.generated",
    "receipt.issued",
    "invoice.generated",
  ];

  const reportableEntities = ["expense", "income", "payment", "tax"];

  return reportableActions.includes(action) || reportableEntities.includes(entityType);
}

/**
 * Get BIR form type based on action
 */
function getBirFormType(action: string, entityType: string): string | undefined {
  if (action.includes("withholding")) return "2307";
  if (action.includes("vat")) return "2550M";
  if (entityType === "income" && action.includes("quarterly")) return "2550Q";
  if (entityType === "income" && action.includes("annual")) return "1702RT";
  return undefined;
}

/**
 * Get compliance flags based on input
 */
function getComplianceFlags(input: AuditLogInput): string[] {
  const flags: string[] = [];

  if (input.amount && input.amount > 500000) {
    flags.push("large_transaction");
  }

  if (input.action.includes("delete") || input.action.includes("void")) {
    flags.push("requires_review");
  }

  if (input.entityType === "tax" || input.entityType === "withholding") {
    flags.push("tax_related");
  }

  if (input.metadata?.seniorDiscount || input.metadata?.pwdDiscount) {
    flags.push("discount_applied");
  }

  return flags;
}

/**
 * Check if action requires review
 */
function requiresReview(action: string, amount?: number): boolean {
  // High-value transactions
  if (amount && amount > 100000) return true;

  // Sensitive actions
  const sensitiveActions = [
    "expense.deleted",
    "payment.cancelled",
    "tax.adjusted",
    "audit.modified",
    "user.elevated",
  ];

  return sensitiveActions.some((a) => action.includes(a));
}

/**
 * Check if action requires immediate notification
 */
function requiresImmediate(action: string): boolean {
  const immediateActions = [
    "security.breach",
    "payment.failed",
    "compliance.violation",
    "audit.tampered",
  ];

  return immediateActions.some((a) => action.includes(a));
}

/**
 * Generate tags for the audit entry
 */
function generateTags(input: AuditLogInput): string[] {
  const tags: string[] = [];

  // Add entity type tag
  tags.push(`entity:${input.entityType}`);

  // Add action category
  const actionCategory = input.action.split(".")[0];
  tags.push(`action:${actionCategory}`);

  // Add amount range if applicable
  if (input.amount) {
    if (input.amount < 1000) tags.push("amount:small");
    else if (input.amount < 10000) tags.push("amount:medium");
    else if (input.amount < 100000) tags.push("amount:large");
    else tags.push("amount:very_large");
  }

  // Add severity
  tags.push(`severity:${input.severity || "info"}`);

  return tags;
}

/**
 * Notify critical events (placeholder for actual implementation)
 */
async function notifyCriticalEvent(input: AuditLogInput): Promise<void> {
  // This would typically send notifications via:
  // - Email
  // - SMS
  // - Push notifications
  // - Slack/Teams
  // - External monitoring service

  console.warn("CRITICAL EVENT:", {
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    amount: input.amount,
    userId: input.userId,
  });
}

/**
 * Get current project ID from context (placeholder)
 */
function getCurrentProjectId(): string {
  // This would typically get from auth context or request context
  // For now, return a placeholder
  return process.env.DEFAULT_PROJECT_ID || "default";
}

/**
 * Specialized audit functions for specific operations
 */

export async function auditFinancialTransaction(params: {
  userId: string;
  transactionType: "expense" | "income" | "payment";
  transactionId: string;
  amount: number;
  description: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  await auditLog({
    userId: params.userId,
    action: `${params.transactionType}.processed`,
    entityType: params.transactionType,
    entityId: params.transactionId,
    amount: params.amount,
    metadata: {
      ...params.metadata,
      description: params.description,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function auditApproval(params: {
  userId: string;
  entityType: string;
  entityId: string;
  action: "approved" | "rejected";
  reason?: string;
  amount?: number;
}): Promise<void> {
  await auditLog({
    userId: params.userId,
    action: `${params.entityType}.${params.action}`,
    entityType: params.entityType,
    entityId: params.entityId,
    amount: params.amount,
    metadata: {
      reason: params.reason,
      approvalTimestamp: new Date().toISOString(),
    },
    severity: params.action === "rejected" ? "warning" : "info",
  });
}

export async function auditTaxCalculation(params: {
  userId: string;
  calculationType: "vat" | "withholding" | "percentage";
  entityId: string;
  grossAmount: number;
  taxAmount: number;
  taxRate: number;
}): Promise<void> {
  await auditLog({
    userId: params.userId,
    action: `tax.calculated.${params.calculationType}`,
    entityType: "tax",
    entityId: params.entityId,
    amount: params.taxAmount,
    metadata: {
      calculationType: params.calculationType,
      grossAmount: params.grossAmount,
      taxAmount: params.taxAmount,
      taxRate: params.taxRate,
      calculatedAt: new Date().toISOString(),
    },
  });
}
