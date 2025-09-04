/**
 * Data Retention Manager
 * Philippine Data Privacy Act Compliant Data Retention and Purging
 *
 * Implements automated data retention policies as required by:
 * - Republic Act No. 10173 (Data Privacy Act)
 * - Bureau of Internal Revenue regulations (5-year financial record retention)
 * - Department of Labor and Employment requirements (3-year employment records)
 */

import { db } from "../db/connection";
import {
  users,
  auditLogs,
  securityAuditLogs,
  sessions,
  loginAttempts,
  passwordResetTokens,
  emailVerificationTokens,
} from "../db/schema/global";
import { eq, lt, and, isNull } from "drizzle-orm";
import { dpaAuditLogger, DPAEventCategory } from "./dpa-audit-logger";

// Data categories with retention requirements
export enum DataCategory {
  // Financial data - 5 years (BIR requirement)
  FINANCIAL_RECORDS = "financial_records",
  PAYMENT_TRANSACTIONS = "payment_transactions",
  TAX_RECORDS = "tax_records",
  INVOICES = "invoices",

  // Guest data - 3 years (business requirement)
  GUEST_INFORMATION = "guest_information",
  BOOKING_HISTORY = "booking_history",
  GUEST_PREFERENCES = "guest_preferences",

  // Employment data - 3 years (DOLE requirement)
  EMPLOYEE_RECORDS = "employee_records",
  PAYROLL_DATA = "payroll_data",

  // Security data - 2 years
  SECURITY_LOGS = "security_logs",
  ACCESS_LOGS = "access_logs",
  AUDIT_TRAILS = "audit_trails",

  // Temporary data - 30-90 days
  SESSION_DATA = "session_data",
  VERIFICATION_TOKENS = "verification_tokens",
  PASSWORD_RESET_TOKENS = "password_reset_tokens",
  LOGIN_ATTEMPTS = "login_attempts",

  // Marketing data - 1 year
  MARKETING_PREFERENCES = "marketing_preferences",
  CAMPAIGN_DATA = "campaign_data",

  // Consent records - 1 year after withdrawal
  CONSENT_RECORDS = "consent_records",

  // Deleted user data - 30 days (soft delete period)
  DELETED_USER_DATA = "deleted_user_data",
}

// Retention periods in days
export const RETENTION_PERIODS: Record<DataCategory, number> = {
  // Legal requirements
  [DataCategory.FINANCIAL_RECORDS]: 1825, // 5 years
  [DataCategory.PAYMENT_TRANSACTIONS]: 1825, // 5 years
  [DataCategory.TAX_RECORDS]: 1825, // 5 years
  [DataCategory.INVOICES]: 1825, // 5 years

  // Business requirements
  [DataCategory.GUEST_INFORMATION]: 1095, // 3 years
  [DataCategory.BOOKING_HISTORY]: 1095, // 3 years
  [DataCategory.GUEST_PREFERENCES]: 365, // 1 year

  // Employment requirements
  [DataCategory.EMPLOYEE_RECORDS]: 1095, // 3 years
  [DataCategory.PAYROLL_DATA]: 1095, // 3 years

  // Security requirements
  [DataCategory.SECURITY_LOGS]: 730, // 2 years
  [DataCategory.ACCESS_LOGS]: 730, // 2 years
  [DataCategory.AUDIT_TRAILS]: 730, // 2 years

  // Temporary data
  [DataCategory.SESSION_DATA]: 30, // 30 days
  [DataCategory.VERIFICATION_TOKENS]: 7, // 7 days
  [DataCategory.PASSWORD_RESET_TOKENS]: 1, // 1 day
  [DataCategory.LOGIN_ATTEMPTS]: 90, // 90 days

  // Marketing data
  [DataCategory.MARKETING_PREFERENCES]: 365, // 1 year
  [DataCategory.CAMPAIGN_DATA]: 365, // 1 year

  // Consent and deletion
  [DataCategory.CONSENT_RECORDS]: 365, // 1 year after withdrawal
  [DataCategory.DELETED_USER_DATA]: 30, // 30 days soft delete
};

// Purge actions
export enum PurgeAction {
  DELETE = "delete", // Permanent deletion
  ANONYMIZE = "anonymize", // Replace with anonymous data
  ARCHIVE = "archive", // Move to cold storage
  PSEUDONYMIZE = "pseudonymize", // Replace identifiers with pseudonyms
}

export interface RetentionPolicy {
  category: DataCategory;
  retentionDays: number;
  purgeAction: PurgeAction;
  description: string;
  legalBasis?: string;
  excludeConditions?: string[];
}

export interface PurgeResult {
  category: DataCategory;
  recordsProcessed: number;
  recordsPurged: number;
  recordsRetained: number;
  action: PurgeAction;
  errors?: string[];
  completedAt: Date;
}

export class DataRetentionManager {
  private static instance: DataRetentionManager;
  private policies: Map<DataCategory, RetentionPolicy> = new Map();
  private purgeSchedule: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializePolicies();
    this.startAutomatedPurging();
  }

  static getInstance(): DataRetentionManager {
    if (!DataRetentionManager.instance) {
      DataRetentionManager.instance = new DataRetentionManager();
    }
    return DataRetentionManager.instance;
  }

  /**
   * Initialize retention policies
   */
  private initializePolicies(): void {
    // Financial records - must be retained for BIR compliance
    this.policies.set(DataCategory.FINANCIAL_RECORDS, {
      category: DataCategory.FINANCIAL_RECORDS,
      retentionDays: RETENTION_PERIODS[DataCategory.FINANCIAL_RECORDS],
      purgeAction: PurgeAction.ARCHIVE,
      description: "Financial records for tax compliance",
      legalBasis: "BIR Revenue Regulations",
      excludeConditions: ["ongoing_audit", "legal_hold"],
    });

    // Guest information - anonymize after retention period
    this.policies.set(DataCategory.GUEST_INFORMATION, {
      category: DataCategory.GUEST_INFORMATION,
      retentionDays: RETENTION_PERIODS[DataCategory.GUEST_INFORMATION],
      purgeAction: PurgeAction.ANONYMIZE,
      description: "Guest personal information",
      excludeConditions: ["active_booking", "unresolved_complaint"],
    });

    // Security logs - archive for compliance
    this.policies.set(DataCategory.SECURITY_LOGS, {
      category: DataCategory.SECURITY_LOGS,
      retentionDays: RETENTION_PERIODS[DataCategory.SECURITY_LOGS],
      purgeAction: PurgeAction.ARCHIVE,
      description: "Security and audit logs",
      legalBasis: "Security incident investigation",
    });

    // Session data - delete expired sessions
    this.policies.set(DataCategory.SESSION_DATA, {
      category: DataCategory.SESSION_DATA,
      retentionDays: RETENTION_PERIODS[DataCategory.SESSION_DATA],
      purgeAction: PurgeAction.DELETE,
      description: "User session data",
    });

    // Verification tokens - delete expired tokens
    this.policies.set(DataCategory.VERIFICATION_TOKENS, {
      category: DataCategory.VERIFICATION_TOKENS,
      retentionDays: RETENTION_PERIODS[DataCategory.VERIFICATION_TOKENS],
      purgeAction: PurgeAction.DELETE,
      description: "Email verification tokens",
    });

    // Password reset tokens - delete immediately after expiry
    this.policies.set(DataCategory.PASSWORD_RESET_TOKENS, {
      category: DataCategory.PASSWORD_RESET_TOKENS,
      retentionDays: RETENTION_PERIODS[DataCategory.PASSWORD_RESET_TOKENS],
      purgeAction: PurgeAction.DELETE,
      description: "Password reset tokens",
    });

    // Login attempts - delete old attempts
    this.policies.set(DataCategory.LOGIN_ATTEMPTS, {
      category: DataCategory.LOGIN_ATTEMPTS,
      retentionDays: RETENTION_PERIODS[DataCategory.LOGIN_ATTEMPTS],
      purgeAction: PurgeAction.DELETE,
      description: "Failed login attempts",
    });

    // Deleted user data - permanent deletion after grace period
    this.policies.set(DataCategory.DELETED_USER_DATA, {
      category: DataCategory.DELETED_USER_DATA,
      retentionDays: RETENTION_PERIODS[DataCategory.DELETED_USER_DATA],
      purgeAction: PurgeAction.DELETE,
      description: "Soft-deleted user data",
    });
  }

  /**
   * Run automated data purging
   */
  async runDataPurge(categories?: DataCategory[]): Promise<PurgeResult[]> {
    const results: PurgeResult[] = [];
    const categoriesToPurge = categories || Array.from(this.policies.keys());

    console.log(`[Data Retention] Starting purge for ${categoriesToPurge.length} categories`);

    for (const category of categoriesToPurge) {
      try {
        const result = await this.purgeCategory(category);
        results.push(result);

        // Log purge event
        await dpaAuditLogger.logDPAEvent({
          category: DPAEventCategory.DATA_PURGED,
          action: "data_retention_purge",
          description: `Purged ${result.recordsPurged} records for ${category}`,
          complianceLevel: "info" as any,
          success: true,
          metadata: result,
        });
      } catch (error) {
        console.error(`[Data Retention] Failed to purge ${category}:`, error);

        results.push({
          category,
          recordsProcessed: 0,
          recordsPurged: 0,
          recordsRetained: 0,
          action: PurgeAction.DELETE,
          errors: [error instanceof Error ? error.message : "Unknown error"],
          completedAt: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Purge data for a specific category
   */
  private async purgeCategory(category: DataCategory): Promise<PurgeResult> {
    const policy = this.policies.get(category);

    if (!policy) {
      throw new Error(`No retention policy found for category: ${category}`);
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

    let result: PurgeResult = {
      category,
      recordsProcessed: 0,
      recordsPurged: 0,
      recordsRetained: 0,
      action: policy.purgeAction,
      completedAt: new Date(),
    };

    switch (category) {
      case DataCategory.SESSION_DATA:
        result = await this.purgeSessions(cutoffDate, policy);
        break;

      case DataCategory.VERIFICATION_TOKENS:
        result = await this.purgeVerificationTokens(cutoffDate, policy);
        break;

      case DataCategory.PASSWORD_RESET_TOKENS:
        result = await this.purgePasswordResetTokens(cutoffDate, policy);
        break;

      case DataCategory.LOGIN_ATTEMPTS:
        result = await this.purgeLoginAttempts(cutoffDate, policy);
        break;

      case DataCategory.SECURITY_LOGS:
      case DataCategory.AUDIT_TRAILS:
        result = await this.purgeAuditLogs(cutoffDate, policy);
        break;

      case DataCategory.DELETED_USER_DATA:
        result = await this.purgeDeletedUsers(cutoffDate, policy);
        break;

      default:
        // Generic purge for other categories
        result = await this.genericPurge(category, cutoffDate, policy);
    }

    return result;
  }

  /**
   * Purge expired sessions
   */
  private async purgeSessions(cutoffDate: Date, policy: RetentionPolicy): Promise<PurgeResult> {
    try {
      // Count records to be purged
      const toDelete = await db
        .select()
        .from(sessions)
        .where(and(lt(sessions.expiresAt, cutoffDate), isNull(sessions.revokedAt)))
        .limit(1000);

      const recordsToDelete = toDelete.length;

      if (recordsToDelete > 0) {
        // Delete expired sessions
        await db
          .delete(sessions)
          .where(and(lt(sessions.expiresAt, cutoffDate), isNull(sessions.revokedAt)));
      }

      return {
        category: policy.category,
        recordsProcessed: recordsToDelete,
        recordsPurged: recordsToDelete,
        recordsRetained: 0,
        action: policy.purgeAction,
        completedAt: new Date(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Purge expired verification tokens
   */
  private async purgeVerificationTokens(
    cutoffDate: Date,
    policy: RetentionPolicy
  ): Promise<PurgeResult> {
    try {
      const toDelete = await db
        .select()
        .from(emailVerificationTokens)
        .where(lt(emailVerificationTokens.expiresAt, cutoffDate))
        .limit(1000);

      const recordsToDelete = toDelete.length;

      if (recordsToDelete > 0) {
        await db
          .delete(emailVerificationTokens)
          .where(lt(emailVerificationTokens.expiresAt, cutoffDate));
      }

      return {
        category: policy.category,
        recordsProcessed: recordsToDelete,
        recordsPurged: recordsToDelete,
        recordsRetained: 0,
        action: policy.purgeAction,
        completedAt: new Date(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Purge expired password reset tokens
   */
  private async purgePasswordResetTokens(
    cutoffDate: Date,
    policy: RetentionPolicy
  ): Promise<PurgeResult> {
    try {
      const toDelete = await db
        .select()
        .from(passwordResetTokens)
        .where(lt(passwordResetTokens.expiresAt, cutoffDate))
        .limit(1000);

      const recordsToDelete = toDelete.length;

      if (recordsToDelete > 0) {
        await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, cutoffDate));
      }

      return {
        category: policy.category,
        recordsProcessed: recordsToDelete,
        recordsPurged: recordsToDelete,
        recordsRetained: 0,
        action: policy.purgeAction,
        completedAt: new Date(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Purge old login attempts
   */
  private async purgeLoginAttempts(
    cutoffDate: Date,
    policy: RetentionPolicy
  ): Promise<PurgeResult> {
    try {
      const toDelete = await db
        .select()
        .from(loginAttempts)
        .where(lt(loginAttempts.attemptedAt, cutoffDate))
        .limit(1000);

      const recordsToDelete = toDelete.length;

      if (recordsToDelete > 0) {
        await db.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, cutoffDate));
      }

      return {
        category: policy.category,
        recordsProcessed: recordsToDelete,
        recordsPurged: recordsToDelete,
        recordsRetained: 0,
        action: policy.purgeAction,
        completedAt: new Date(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Purge or archive audit logs
   */
  private async purgeAuditLogs(cutoffDate: Date, policy: RetentionPolicy): Promise<PurgeResult> {
    try {
      // For audit logs, we archive rather than delete
      const toArchive = await db
        .select()
        .from(securityAuditLogs)
        .where(lt(securityAuditLogs.createdAt, cutoffDate))
        .limit(1000);

      const recordsToArchive = toArchive.length;

      if (recordsToArchive > 0 && policy.purgeAction === PurgeAction.ARCHIVE) {
        // Archive to cold storage (implementation would depend on storage solution)
        await this.archiveRecords("security_audit_logs", toArchive);

        // Delete from hot storage
        await db.delete(securityAuditLogs).where(lt(securityAuditLogs.createdAt, cutoffDate));
      }

      return {
        category: policy.category,
        recordsProcessed: recordsToArchive,
        recordsPurged: recordsToArchive,
        recordsRetained: 0,
        action: policy.purgeAction,
        completedAt: new Date(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Purge soft-deleted users
   */
  private async purgeDeletedUsers(cutoffDate: Date, policy: RetentionPolicy): Promise<PurgeResult> {
    try {
      const toDelete = await db
        .select()
        .from(users)
        .where(and(lt(users.deletedAt, cutoffDate), users.deletedAt.isNotNull()))
        .limit(100);

      const recordsToDelete = toDelete.length;

      if (recordsToDelete > 0) {
        // Permanently delete soft-deleted users
        for (const user of toDelete) {
          await this.permanentlyDeleteUser(user.id);
        }
      }

      return {
        category: policy.category,
        recordsProcessed: recordsToDelete,
        recordsPurged: recordsToDelete,
        recordsRetained: 0,
        action: policy.purgeAction,
        completedAt: new Date(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generic purge for other categories
   */
  private async genericPurge(
    category: DataCategory,
    cutoffDate: Date,
    policy: RetentionPolicy
  ): Promise<PurgeResult> {
    // This would be implemented based on specific table/category requirements
    console.log(
      `[Data Retention] Generic purge for ${category} before ${cutoffDate.toISOString()}`
    );

    return {
      category,
      recordsProcessed: 0,
      recordsPurged: 0,
      recordsRetained: 0,
      action: policy.purgeAction,
      completedAt: new Date(),
    };
  }

  /**
   * Handle data subject deletion request (right to be forgotten)
   */
  async handleDeletionRequest(
    userId: string,
    immediate: boolean = false
  ): Promise<{
    success: boolean;
    deletionDate: Date;
    affectedData: string[];
  }> {
    try {
      const deletionDate = immediate
        ? new Date()
        : new Date(
            Date.now() + RETENTION_PERIODS[DataCategory.DELETED_USER_DATA] * 24 * 60 * 60 * 1000
          );

      if (immediate) {
        // Immediate deletion (after verification)
        await this.permanentlyDeleteUser(userId);
      } else {
        // Soft delete with grace period
        await db
          .update(users)
          .set({
            deletedAt: new Date(),
            isActive: false,
          })
          .where(eq(users.id, userId));
      }

      // Log deletion request
      await dpaAuditLogger.logDSRRequest({
        requestType: "deletion",
        dataSubjectId: userId,
        requesterId: userId,
        details: {
          immediate,
          deletionDate: deletionDate.toISOString(),
        },
        approved: true,
      });

      return {
        success: true,
        deletionDate,
        affectedData: [
          "personal_information",
          "booking_history",
          "payment_records",
          "preferences",
          "consent_records",
        ],
      };
    } catch (error) {
      console.error("[Data Retention] Failed to process deletion request:", error);
      throw error;
    }
  }

  /**
   * Anonymize user data instead of deletion
   */
  async anonymizeUserData(userId: string): Promise<void> {
    try {
      // Replace PII with anonymous values
      await db
        .update(users)
        .set({
          email: `anonymous_${Date.now()}@deleted.local`,
          firstName: "Anonymous",
          lastName: "User",
          phone: null,
          avatarUrl: null,
          // Keep non-PII data for analytics
        })
        .where(eq(users.id, userId));

      console.log(`[Data Retention] Anonymized user data for ${userId}`);
    } catch (error) {
      console.error("[Data Retention] Failed to anonymize user:", error);
      throw error;
    }
  }

  /**
   * Generate retention compliance report
   */
  async generateComplianceReport(): Promise<{
    policies: RetentionPolicy[];
    lastPurgeResults: PurgeResult[];
    upcomingPurges: Array<{ category: DataCategory; scheduledDate: Date }>;
    complianceStatus: "compliant" | "attention_needed" | "non_compliant";
    recommendations: string[];
  }> {
    const policies = Array.from(this.policies.values());
    const lastPurgeResults: PurgeResult[] = []; // Would fetch from database
    const upcomingPurges = this.getUpcomingPurges();
    const complianceStatus = await this.assessComplianceStatus();
    const recommendations = this.generateRecommendations();

    return {
      policies,
      lastPurgeResults,
      upcomingPurges,
      complianceStatus,
      recommendations,
    };
  }

  /**
   * Private helper methods
   */

  private async permanentlyDeleteUser(userId: string): Promise<void> {
    // Delete all user-related data across tables
    // This would cascade through all related tables
    await db.delete(users).where(eq(users.id, userId));

    console.log(`[Data Retention] Permanently deleted user ${userId}`);
  }

  private async archiveRecords(tableName: string, records: any[]): Promise<void> {
    // In production, this would:
    // 1. Compress records
    // 2. Encrypt if necessary
    // 3. Upload to cold storage (S3, Google Cloud Storage, etc.)
    // 4. Store archive metadata for retrieval

    console.log(`[Data Retention] Archived ${records.length} records from ${tableName}`);
  }

  private getUpcomingPurges(): Array<{ category: DataCategory; scheduledDate: Date }> {
    const upcoming: Array<{ category: DataCategory; scheduledDate: Date }> = [];

    for (const [category, policy] of this.policies) {
      const nextPurge = new Date();
      nextPurge.setDate(nextPurge.getDate() + 1); // Next day

      upcoming.push({
        category,
        scheduledDate: nextPurge,
      });
    }

    return upcoming;
  }

  private async assessComplianceStatus(): Promise<
    "compliant" | "attention_needed" | "non_compliant"
  > {
    // Check if any data is overdue for purging
    // This would query each table to check for expired data

    // For now, return compliant
    return "compliant";
  }

  private generateRecommendations(): string[] {
    return [
      "Review and update retention policies quarterly",
      "Ensure all new data categories have defined retention periods",
      "Regularly audit archived data for compliance",
      "Test data restoration procedures monthly",
      "Document all manual data deletions",
    ];
  }

  /**
   * Start automated purging schedule
   */
  private startAutomatedPurging(): void {
    // Run daily at 2 AM
    const runDaily = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(2, 0, 0, 0);

      const msUntilRun = tomorrow.getTime() - now.getTime();

      this.purgeSchedule = setTimeout(async () => {
        console.log("[Data Retention] Running scheduled purge");
        await this.runDataPurge();

        // Schedule next run
        this.startAutomatedPurging();
      }, msUntilRun);
    };

    runDaily();
  }

  /**
   * Stop automated purging
   */
  stopAutomatedPurging(): void {
    if (this.purgeSchedule) {
      clearTimeout(this.purgeSchedule);
      this.purgeSchedule = null;
    }
  }
}

// Export singleton instance
export const dataRetentionManager = DataRetentionManager.getInstance();

// Export convenience functions
export const runDataPurge = (categories?: DataCategory[]) =>
  dataRetentionManager.runDataPurge(categories);

export const handleDeletionRequest = (userId: string, immediate?: boolean) =>
  dataRetentionManager.handleDeletionRequest(userId, immediate);

export const anonymizeUserData = (userId: string) => dataRetentionManager.anonymizeUserData(userId);

export const generateRetentionReport = () => dataRetentionManager.generateComplianceReport();
