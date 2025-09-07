/**
 * Document Monitor
 *
 * Comprehensive service for monitoring document completeness and compliance.
 * Tracks required documents, approvals, expiry dates, and ensures all
 * necessary documentation is maintained per Philippine business requirements.
 *
 * Monitors:
 * - Business registration documents
 * - Tax clearances and certificates
 * - Permit applications and renewals
 * - Insurance and bonding requirements
 * - Employment and safety documents
 * - Guest data and privacy compliance
 */

import { Decimal } from "decimal.js";
import { logger } from "../../logger";
import type {
  DocumentComplianceCheck,
  DocumentComplianceStatus,
  RequiredDocument,
  ExpiredDocument,
  PendingApproval,
  DocumentIssue,
  ComplianceDeadlineAlert,
  ComplianceAlertSeverity,
  ComplianceCategory,
  PermitType,
} from "../types";

/**
 * Philippine business document requirements by category
 */
const REQUIRED_DOCUMENTS: Record<string, RequiredDocument[]> = {
  BUSINESS_REGISTRATION: [
    {
      documentName: "DTI Business Registration",
      documentType: "REGISTRATION",
      required: true,
      frequency: "ANNUALLY",
      expiryMonths: 12,
      issuingAuthority: "Department of Trade and Industry",
    },
    {
      documentName: "SEC Certificate of Incorporation",
      documentType: "REGISTRATION",
      required: true,
      frequency: "ONCE",
      issuingAuthority: "Securities and Exchange Commission",
    },
    {
      documentName: "BIR Registration Certificate",
      documentType: "TAX_REGISTRATION",
      required: true,
      frequency: "ONCE",
      issuingAuthority: "Bureau of Internal Revenue",
    },
    {
      documentName: "SSS Registration",
      documentType: "EMPLOYMENT",
      required: true,
      frequency: "ONCE",
      issuingAuthority: "Social Security System",
    },
    {
      documentName: "PhilHealth Registration",
      documentType: "EMPLOYMENT",
      required: true,
      frequency: "ONCE",
      issuingAuthority: "Philippine Health Insurance Corporation",
    },
    {
      documentName: "Pag-IBIG Registration",
      documentType: "EMPLOYMENT",
      required: true,
      frequency: "ONCE",
      issuingAuthority: "Home Development Mutual Fund",
    },
  ],

  LOCAL_PERMITS: [
    {
      documentName: "Mayor's Permit",
      documentType: "PERMIT",
      required: true,
      frequency: "ANNUAL",
      expiryMonths: 12,
      issuingAuthority: "Local Government Unit",
    },
    {
      documentName: "Business Permit",
      documentType: "PERMIT",
      required: true,
      frequency: "ANNUAL",
      expiryMonths: 12,
      issuingAuthority: "Local Government Unit",
    },
    {
      documentName: "Barangay Business Clearance",
      documentType: "CLEARANCE",
      required: true,
      frequency: "ANNUAL",
      expiryMonths: 12,
      issuingAuthority: "Barangay Office",
    },
    {
      documentName: "Zoning Compliance Certificate",
      documentType: "PERMIT",
      required: true,
      frequency: "ONCE",
      issuingAuthority: "Local Planning Office",
    },
  ],

  SAFETY_HEALTH: [
    {
      documentName: "Fire Safety Certificate",
      documentType: "SAFETY",
      required: true,
      frequency: "ANNUAL",
      expiryMonths: 12,
      issuingAuthority: "Bureau of Fire Protection",
    },
    {
      documentName: "Sanitary Permit",
      documentType: "HEALTH",
      required: true,
      frequency: "ANNUAL",
      expiryMonths: 12,
      issuingAuthority: "Local Health Office",
    },
    {
      documentName: "Health Certificate (Food Handlers)",
      documentType: "HEALTH",
      required: true,
      frequency: "ANNUAL",
      expiryMonths: 6, // Every 6 months for food handlers
      issuingAuthority: "Local Health Office",
    },
    {
      documentName: "Building Occupancy Permit",
      documentType: "SAFETY",
      required: true,
      frequency: "ONCE",
      issuingAuthority: "Local Building Official",
    },
  ],

  TOURISM: [
    {
      documentName: "DOT Accreditation Certificate",
      documentType: "ACCREDITATION",
      required: true,
      frequency: "ANNUAL",
      expiryMonths: 36, // 3 years
      issuingAuthority: "Department of Tourism",
    },
    {
      documentName: "Tourism Enterprise Registration",
      documentType: "REGISTRATION",
      required: true,
      frequency: "ANNUAL",
      expiryMonths: 12,
      issuingAuthority: "Provincial Tourism Office",
    },
    {
      documentName: "Resort Classification Certificate",
      documentType: "CLASSIFICATION",
      required: false,
      frequency: "ANNUAL",
      expiryMonths: 24,
      issuingAuthority: "Department of Tourism",
    },
  ],

  ENVIRONMENTAL: [
    {
      documentName: "Environmental Compliance Certificate",
      documentType: "ENVIRONMENTAL",
      required: true,
      frequency: "ONCE",
      issuingAuthority: "Department of Environment and Natural Resources",
    },
    {
      documentName: "Water Pollution Control Clearance",
      documentType: "ENVIRONMENTAL",
      required: true,
      frequency: "ANNUAL",
      expiryMonths: 12,
      issuingAuthority: "Laguna Lake Development Authority",
    },
    {
      documentName: "Waste Management Plan Approval",
      documentType: "ENVIRONMENTAL",
      required: true,
      frequency: "ANNUAL",
      expiryMonths: 12,
      issuingAuthority: "Local Environment Office",
    },
  ],

  FINANCIAL: [
    {
      documentName: "Bank Account Certificate",
      documentType: "FINANCIAL",
      required: true,
      frequency: "ANNUAL",
      expiryMonths: 12,
      issuingAuthority: "Bank",
    },
    {
      documentName: "Audited Financial Statements",
      documentType: "FINANCIAL",
      required: true,
      frequency: "ANNUAL",
      expiryMonths: 12,
      issuingAuthority: "Independent Auditor",
    },
    {
      documentName: "Tax Clearance Certificate",
      documentType: "TAX",
      required: true,
      frequency: "ANNUAL",
      expiryMonths: 12,
      issuingAuthority: "Bureau of Internal Revenue",
    },
  ],

  INSURANCE: [
    {
      documentName: "General Liability Insurance",
      documentType: "INSURANCE",
      required: true,
      frequency: "ANNUAL",
      expiryMonths: 12,
      issuingAuthority: "Insurance Company",
    },
    {
      documentName: "Property Insurance",
      documentType: "INSURANCE",
      required: true,
      frequency: "ANNUAL",
      expiryMonths: 12,
      issuingAuthority: "Insurance Company",
    },
    {
      documentName: "Workers Compensation Insurance",
      documentType: "INSURANCE",
      required: true,
      frequency: "ANNUAL",
      expiryMonths: 12,
      issuingAuthority: "Insurance Company",
    },
  ],
};

/**
 * Document urgency classification
 */
const DOCUMENT_URGENCY_RULES = {
  CRITICAL_DAYS: 7, // Document expires within 7 days
  HIGH_DAYS: 30, // Document expires within 30 days
  MEDIUM_DAYS: 90, // Document expires within 90 days
  LOW_DAYS: 180, // Document expires within 180 days
};

export class DocumentMonitor {
  private readonly logger = logger.child({ service: "DocumentMonitor" });

  /**
   * Check compliance documents for completeness and validity
   */
  async checkComplianceDocuments(projectId: string): Promise<DocumentComplianceCheck[]> {
    const startTime = Date.now();

    this.logger.info("Checking document compliance", { projectId });

    try {
      const checks: DocumentComplianceCheck[] = [];

      // Check each document category
      for (const [category, documents] of Object.entries(REQUIRED_DOCUMENTS)) {
        const check = await this.checkDocumentCategory(projectId, category, documents);
        checks.push(check);
      }

      // Calculate overall compliance metrics
      const overallCheck = this.calculateOverallCompliance(projectId, checks);
      checks.unshift(overallCheck);

      const executionTime = Date.now() - startTime;
      this.logger.info("Document compliance check completed", {
        projectId,
        executionTime,
        categoriesChecked: checks.length - 1,
        overallScore: overallCheck.complianceScore,
      });

      return checks;
    } catch (error) {
      this.logger.error("Failed to check document compliance", {
        projectId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Generate document compliance alerts
   */
  async generateDocumentAlerts(
    projectId: string,
    checks: DocumentComplianceCheck[]
  ): Promise<ComplianceDeadlineAlert[]> {
    const alerts: ComplianceDeadlineAlert[] = [];
    const now = new Date();

    for (const check of checks) {
      // Critical missing documents
      if (check.missingDocuments.length > 0) {
        const criticalMissing = check.missingDocuments.filter((docName) =>
          this.isDocumentCritical(docName, check.requiredDocuments)
        );

        if (criticalMissing.length > 0) {
          alerts.push({
            alertId: `doc-missing-${check.documentType}-${criticalMissing.length}`,
            category: "DOCUMENT_INTEGRITY" as ComplianceCategory,
            severity: "CRITICAL" as ComplianceAlertSeverity,
            title: "Critical Documents Missing",
            description: `${criticalMissing.length} critical documents missing for ${check.documentType}`,
            deadlineDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
            daysUntilDeadline: 7,
            affectedEntity: check.documentType,
            actionRequired: [
              "Obtain missing required documents",
              "Submit applications where needed",
              "Follow up on pending approvals",
              "Ensure document storage and tracking",
            ],
            estimatedTimeToComplete: criticalMissing.length * 120, // 2 hours per document
            status: "ACTIVE",
            createdAt: now,
            updatedAt: now,
            metadata: {
              category: check.documentType,
              missingCount: criticalMissing.length,
              missingDocuments: criticalMissing,
            },
          });
        }
      }

      // Expired documents
      for (const expiredDoc of check.expiredDocuments) {
        const severity = this.calculateExpiryUrgency(expiredDoc.daysExpired);

        alerts.push({
          alertId: `doc-expired-${check.documentType}-${expiredDoc.documentId}`,
          category: "DOCUMENT_INTEGRITY" as ComplianceCategory,
          severity,
          title: `${expiredDoc.documentName} Expired`,
          description: `Document expired ${expiredDoc.daysExpired} days ago${expiredDoc.renewalRequired ? " - renewal required" : ""}`,
          deadlineDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days to resolve
          daysUntilDeadline: 3,
          affectedEntity: expiredDoc.documentName,
          actionRequired: expiredDoc.renewalProcess || [
            "Prepare renewal application",
            "Gather required supporting documents",
            "Submit renewal request",
            "Follow up with issuing authority",
          ],
          estimatedTimeToComplete: 240, // 4 hours
          potentialPenalty: this.calculateDocumentPenalty(expiredDoc),
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now,
          metadata: {
            documentId: expiredDoc.documentId,
            expiryDate: expiredDoc.expiryDate.toISOString(),
            daysExpired: expiredDoc.daysExpired,
            urgency: expiredDoc.urgency,
          },
        });
      }

      // Pending approvals taking too long
      const overdueApprovals = check.pendingApprovals.filter((approval) => {
        const daysPending = Math.ceil(
          (now.getTime() - approval.submittedDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysPending > 30; // Over 30 days pending
      });

      for (const approval of overdueApprovals) {
        const daysPending = Math.ceil(
          (now.getTime() - approval.submittedDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        alerts.push({
          alertId: `doc-approval-overdue-${approval.approvalId}`,
          category: "DOCUMENT_INTEGRITY" as ComplianceCategory,
          severity: daysPending > 60 ? "HIGH" : "MEDIUM",
          title: `Approval Overdue: ${approval.documentType}`,
          description: `${approval.documentType} approval pending for ${daysPending} days with ${approval.approvingAuthority}`,
          deadlineDate: approval.followUpDate || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          daysUntilDeadline: approval.followUpDate
            ? Math.ceil((approval.followUpDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : 7,
          affectedEntity: approval.documentType,
          actionRequired: [
            "Contact approving authority for status update",
            "Verify all requirements are submitted",
            "Escalate to supervisor if necessary",
            "Consider alternative processing options",
          ],
          estimatedTimeToComplete: 60, // 1 hour for follow-up
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now,
          metadata: {
            approvalId: approval.approvalId,
            submittedDate: approval.submittedDate.toISOString(),
            daysPending,
            approvingAuthority: approval.approvingAuthority,
            referenceNumber: approval.referenceNumber,
          },
        });
      }
    }

    return alerts.sort((a, b) => {
      const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  // Private helper methods

  private async checkDocumentCategory(
    projectId: string,
    category: string,
    requiredDocs: RequiredDocument[]
  ): Promise<DocumentComplianceCheck> {
    const checkId = `doc-check-${category}-${projectId}-${Date.now()}`;
    const now = new Date();

    // Get current document status (mock implementation)
    const documentStatuses = await this.getDocumentStatuses(projectId, category, requiredDocs);

    // Identify missing documents
    const missingDocuments = requiredDocs
      .filter((doc) => doc.required && !documentStatuses.has(doc.documentName))
      .map((doc) => doc.documentName);

    // Check for expired documents
    const expiredDocuments: ExpiredDocument[] = [];
    for (const [docName, status] of documentStatuses) {
      if (status.expiryDate && status.expiryDate < now) {
        const daysExpired = Math.ceil(
          (now.getTime() - status.expiryDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const requiredDoc = requiredDocs.find((d) => d.documentName === docName);

        expiredDocuments.push({
          documentName: docName,
          documentId: status.documentId,
          expiryDate: status.expiryDate,
          daysExpired,
          renewalRequired: requiredDoc?.frequency !== "ONCE",
          renewalProcess: this.getDocumentRenewalProcess(docName),
          urgency: this.calculateExpiryUrgency(daysExpired),
        });
      }
    }

    // Check pending approvals
    const pendingApprovals = await this.getPendingApprovals(projectId, category);

    // Identify document issues
    const issues = this.identifyDocumentIssues(
      requiredDocs,
      missingDocuments,
      expiredDocuments,
      documentStatuses
    );

    // Calculate compliance score
    const complianceScore = this.calculateCategoryComplianceScore(
      requiredDocs,
      missingDocuments,
      expiredDocuments,
      issues
    );

    // Generate recommendations
    const recommendations = this.generateCategoryRecommendations(
      category,
      missingDocuments,
      expiredDocuments,
      issues
    );

    return {
      checkId,
      documentType: category,
      documentId: `category-${category}`,
      status: this.determineOverallStatus(
        complianceScore,
        missingDocuments.length,
        expiredDocuments.length
      ),
      requiredDocuments: requiredDocs,
      missingDocuments,
      expiredDocuments,
      pendingApprovals,
      complianceScore,
      lastChecked: now,
      nextCheckDate: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Check daily
      issues,
      recommendations,
    };
  }

  private calculateOverallCompliance(
    projectId: string,
    categoryChecks: DocumentComplianceCheck[]
  ): DocumentComplianceCheck {
    const now = new Date();
    const allRequired = categoryChecks.reduce(
      (sum, check) => sum + check.requiredDocuments.length,
      0
    );
    const allMissing = categoryChecks.reduce(
      (sum, check) => sum + check.missingDocuments.length,
      0
    );
    const allExpired = categoryChecks.reduce(
      (sum, check) => sum + check.expiredDocuments.length,
      0
    );

    const overallScore = categoryChecks.reduce((sum, check, index) => {
      const weight = check.requiredDocuments.length / allRequired;
      return sum + check.complianceScore * weight;
    }, 0);

    const allIssues: DocumentIssue[] = categoryChecks.flatMap((check) => check.issues);
    const allRecommendations = categoryChecks.flatMap((check) => check.recommendations);

    return {
      checkId: `overall-${projectId}-${Date.now()}`,
      documentType: "OVERALL_COMPLIANCE",
      documentId: `overall-${projectId}`,
      status: this.determineOverallStatus(overallScore, allMissing, allExpired),
      requiredDocuments: categoryChecks.flatMap((check) => check.requiredDocuments),
      missingDocuments: categoryChecks.flatMap((check) => check.missingDocuments),
      expiredDocuments: categoryChecks.flatMap((check) => check.expiredDocuments),
      pendingApprovals: categoryChecks.flatMap((check) => check.pendingApprovals),
      complianceScore: Math.round(overallScore),
      lastChecked: now,
      nextCheckDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      issues: allIssues,
      recommendations: allRecommendations,
    };
  }

  private async getDocumentStatuses(
    projectId: string,
    category: string,
    requiredDocs: RequiredDocument[]
  ): Promise<
    Map<
      string,
      {
        documentId: string;
        status: DocumentComplianceStatus;
        expiryDate?: Date;
        issueDate?: Date;
      }
    >
  > {
    // Mock implementation - would query document database
    const statuses = new Map();
    const now = new Date();

    // Simulate some documents existing, some missing, some expired
    requiredDocs.forEach((doc, index) => {
      // 80% of documents exist
      if (Math.random() > 0.2) {
        const issueDate = new Date(now.getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000);
        let expiryDate: Date | undefined;

        if (doc.expiryMonths) {
          expiryDate = new Date(issueDate.getTime() + doc.expiryMonths * 30 * 24 * 60 * 60 * 1000);
        }

        statuses.set(doc.documentName, {
          documentId: `doc-${category}-${index}`,
          status: expiryDate && expiryDate < now ? "EXPIRED" : "COMPLIANT",
          expiryDate,
          issueDate,
        });
      }
    });

    return statuses;
  }

  private async getPendingApprovals(
    projectId: string,
    category: string
  ): Promise<PendingApproval[]> {
    // Mock implementation - would query approval tracking system
    const approvals: PendingApproval[] = [];
    const now = new Date();

    // Generate sample pending approvals
    const sampleApprovals = [
      { type: "Fire Safety Certificate", authority: "Bureau of Fire Protection", days: 25 },
      { type: "Health Certificate", authority: "Local Health Office", days: 15 },
      { type: "Tourism Registration", authority: "Provincial Tourism Office", days: 45 },
    ];

    sampleApprovals.forEach((sample, index) => {
      if (Math.random() > 0.7) {
        // 30% chance of pending approval
        const submittedDate = new Date(now.getTime() - sample.days * 24 * 60 * 60 * 1000);

        approvals.push({
          approvalId: `approval-${category}-${index}`,
          documentType: sample.type,
          submittedDate,
          expectedDecisionDate: new Date(submittedDate.getTime() + 30 * 24 * 60 * 60 * 1000),
          approvingAuthority: sample.authority,
          status: sample.days > 30 ? "UNDER_REVIEW" : "SUBMITTED",
          followUpDate:
            sample.days > 45 ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined,
          referenceNumber: `REF-${category.toUpperCase()}-${index + 1000}`,
        });
      }
    });

    return approvals;
  }

  private isDocumentCritical(docName: string, requiredDocs: RequiredDocument[]): boolean {
    const criticalTypes = ["REGISTRATION", "PERMIT", "TAX_REGISTRATION"];
    const doc = requiredDocs.find((d) => d.documentName === docName);
    return doc ? criticalTypes.includes(doc.documentType) : false;
  }

  private calculateExpiryUrgency(daysExpired: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
    if (daysExpired < 0) return "LOW"; // Not expired yet
    if (daysExpired <= DOCUMENT_URGENCY_RULES.CRITICAL_DAYS) return "CRITICAL";
    if (daysExpired <= DOCUMENT_URGENCY_RULES.HIGH_DAYS) return "HIGH";
    if (daysExpired <= DOCUMENT_URGENCY_RULES.MEDIUM_DAYS) return "MEDIUM";
    return "LOW";
  }

  private calculateDocumentPenalty(expiredDoc: ExpiredDocument): Decimal | undefined {
    if (expiredDoc.daysExpired <= 0) return undefined;

    // Basic penalty calculation based on document type and days expired
    const basePenalties: Record<string, number> = {
      "Mayor's Permit": 1000,
      "Business Permit": 2000,
      "Fire Safety Certificate": 500,
      "Sanitary Permit": 300,
      "DOT Accreditation Certificate": 5000,
    };

    const basePenalty = basePenalties[expiredDoc.documentName] || 1000;
    const monthsExpired = Math.ceil(expiredDoc.daysExpired / 30);

    return new Decimal(basePenalty * monthsExpired);
  }

  private getDocumentRenewalProcess(docName: string): string[] {
    const processes: Record<string, string[]> = {
      "Mayor's Permit": [
        "Prepare business documents",
        "Pay local taxes",
        "Submit application to City Hall",
        "Await approval and issuance",
      ],
      "Fire Safety Certificate": [
        "Schedule fire safety inspection",
        "Address inspection findings",
        "Submit compliance report",
        "Pay fees and obtain certificate",
      ],
    };

    return (
      processes[docName] || [
        "Prepare renewal application",
        "Gather required documents",
        "Submit to issuing authority",
        "Follow up for approval",
      ]
    );
  }

  private identifyDocumentIssues(
    requiredDocs: RequiredDocument[],
    missingDocs: string[],
    expiredDocs: ExpiredDocument[],
    statuses: Map<string, any>
  ): DocumentIssue[] {
    const issues: DocumentIssue[] = [];

    // Missing document issues
    missingDocs.forEach((docName) => {
      const doc = requiredDocs.find((d) => d.documentName === docName);
      issues.push({
        issueType: "MISSING",
        severity: this.isDocumentCritical(docName, requiredDocs) ? "HIGH" : "MEDIUM",
        description: `Required document "${docName}" is missing`,
        documentName: docName,
        potentialImpact: doc?.required
          ? "Cannot operate legally without this document"
          : "May affect compliance score",
        resolutionSteps: [
          "Obtain application form from issuing authority",
          "Prepare required supporting documents",
          "Submit application with fees",
          "Follow up on processing status",
        ],
        estimatedResolutionTime: 8, // hours
      });
    });

    // Expired document issues
    expiredDocs.forEach((expiredDoc) => {
      issues.push({
        issueType: "EXPIRED",
        severity: expiredDoc.urgency as any,
        description: `${expiredDoc.documentName} expired ${expiredDoc.daysExpired} days ago`,
        documentName: expiredDoc.documentName,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days to resolve
        potentialImpact: "May face penalties or business interruption",
        resolutionSteps: expiredDoc.renewalProcess || [
          "Prepare renewal application immediately",
          "Pay any penalties for late renewal",
          "Submit to issuing authority",
          "Expedite processing if possible",
        ],
        estimatedResolutionTime: expiredDoc.renewalRequired ? 16 : 8, // hours
      });
    });

    return issues;
  }

  private calculateCategoryComplianceScore(
    requiredDocs: RequiredDocument[],
    missingDocs: string[],
    expiredDocs: ExpiredDocument[],
    issues: DocumentIssue[]
  ): number {
    let score = 100;
    const totalRequired = requiredDocs.filter((doc) => doc.required).length;

    if (totalRequired === 0) return 100;

    // Deduct for missing documents
    const missingPenalty = (missingDocs.length / totalRequired) * 50;
    score -= missingPenalty;

    // Deduct for expired documents
    const expiredPenalty = (expiredDocs.length / totalRequired) * 30;
    score -= expiredPenalty;

    // Additional penalty for critical issues
    const criticalIssues = issues.filter(
      (issue) => issue.severity === "HIGH" || issue.severity === "CRITICAL"
    );
    const criticalPenalty = criticalIssues.length * 5;
    score -= criticalPenalty;

    return Math.max(Math.round(score), 0);
  }

  private determineOverallStatus(
    score: number,
    missingCount: number,
    expiredCount: number
  ): DocumentComplianceStatus {
    if (missingCount > 0 || expiredCount > 0) {
      if (score < 70) return "INVALID";
      if (score < 85) return "REQUIRES_UPDATE";
      return "EXPIRED";
    }

    if (score >= 95) return "COMPLIANT";
    if (score >= 85) return "REQUIRES_UPDATE";
    return "INVALID";
  }

  private generateCategoryRecommendations(
    category: string,
    missingDocs: string[],
    expiredDocs: ExpiredDocument[],
    issues: DocumentIssue[]
  ): string[] {
    const recommendations: string[] = [];

    if (missingDocs.length > 0) {
      recommendations.push(
        `Obtain ${missingDocs.length} missing ${category} documents immediately`
      );
      recommendations.push("Set up document tracking system to prevent future gaps");
    }

    if (expiredDocs.length > 0) {
      recommendations.push(`Renew ${expiredDocs.length} expired documents within 30 days`);
      recommendations.push("Implement automatic renewal reminders");
    }

    const criticalIssues = issues.filter(
      (issue) => issue.severity === "HIGH" || issue.severity === "CRITICAL"
    );
    if (criticalIssues.length > 0) {
      recommendations.push("Address critical compliance issues within 7 days");
      recommendations.push("Consider legal consultation for complex requirements");
    }

    if (recommendations.length === 0) {
      recommendations.push("Maintain current document compliance standards");
      recommendations.push("Continue regular monitoring and renewal processes");
    }

    return recommendations;
  }
}
