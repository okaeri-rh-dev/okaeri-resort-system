/**
 * Deadline Monitor
 *
 * Specialized service for tracking Philippine business compliance deadlines including:
 * - BIR tax filing deadlines (VAT, withholding, income tax)
 * - Business permit renewals (mayor's permit, health certificate, etc.)
 * - Tourism compliance deadlines (DOT accreditation, local registration)
 * - Safety and environmental permits
 *
 * Generates proactive alerts with 5-day advance warnings and escalating urgency.
 */

import { Decimal } from "decimal.js";
import { logger } from "../../logger";
import type {
  ComplianceDeadlineAlert,
  ComplianceAlertSeverity,
  ComplianceCategory,
  TaxFilingType,
  PermitType,
  TaxFilingDeadline,
  PermitExpiryTracker,
  ComplianceMonitoringConfig,
  ComplianceAlertStatus,
} from "../types";

/**
 * Philippine BIR tax filing deadlines configuration
 */
const BIR_TAX_DEADLINES: Record<TaxFilingType, TaxFilingDeadline> = {
  VAT_MONTHLY: {
    filingType: "VAT_MONTHLY",
    formNumber: "2550M",
    description: "Monthly VAT Return",
    frequency: "MONTHLY",
    dueDayOfMonth: 20,
    gracePeriod: 0,
    penaltyRate: new Decimal("0.25"), // 25% per month
    nextDueDate: new Date(),
    reminderDays: [15, 7, 3, 1],
    isEnabled: true,
    applicableBusinessTypes: ["VAT_REGISTERED"],
  },
  VAT_QUARTERLY: {
    filingType: "VAT_QUARTERLY",
    formNumber: "2550Q",
    description: "Quarterly VAT Return",
    frequency: "QUARTERLY",
    dueDayOfMonth: 25,
    dueDayOfQuarter: 25,
    gracePeriod: 0,
    penaltyRate: new Decimal("0.25"),
    nextDueDate: new Date(),
    reminderDays: [15, 7, 3, 1],
    isEnabled: true,
    applicableBusinessTypes: ["VAT_REGISTERED"],
  },
  WITHHOLDING_MONTHLY: {
    filingType: "WITHHOLDING_MONTHLY",
    formNumber: "1601C",
    description: "Monthly Withholding Tax Return",
    frequency: "MONTHLY",
    dueDayOfMonth: 10,
    gracePeriod: 0,
    penaltyRate: new Decimal("0.25"),
    nextDueDate: new Date(),
    reminderDays: [15, 7, 3, 1],
    isEnabled: true,
    applicableBusinessTypes: ["ALL"],
  },
  WITHHOLDING_QUARTERLY: {
    filingType: "WITHHOLDING_QUARTERLY",
    formNumber: "1601EQ",
    description: "Quarterly Withholding Tax Return",
    frequency: "QUARTERLY",
    dueDayOfMonth: 15,
    dueDayOfQuarter: 15,
    gracePeriod: 0,
    penaltyRate: new Decimal("0.25"),
    nextDueDate: new Date(),
    reminderDays: [15, 7, 3, 1],
    isEnabled: true,
    applicableBusinessTypes: ["ALL"],
  },
  ANNUAL_ITR: {
    filingType: "ANNUAL_ITR",
    formNumber: "1700/1701",
    description: "Annual Income Tax Return",
    frequency: "ANNUALLY",
    dueDayOfMonth: 15, // April 15
    gracePeriod: 30,
    penaltyRate: new Decimal("0.25"),
    nextDueDate: new Date(),
    reminderDays: [30, 15, 7, 3, 1],
    isEnabled: true,
    applicableBusinessTypes: ["ALL"],
  },
  PERCENTAGE_TAX: {
    filingType: "PERCENTAGE_TAX",
    formNumber: "2551M",
    description: "Monthly Percentage Tax Return",
    frequency: "MONTHLY",
    dueDayOfMonth: 20,
    gracePeriod: 0,
    penaltyRate: new Decimal("0.25"),
    nextDueDate: new Date(),
    reminderDays: [15, 7, 3, 1],
    isEnabled: true,
    applicableBusinessTypes: ["NON_VAT_REGISTERED"],
  },
  EXPANDED_WITHHOLDING: {
    filingType: "EXPANDED_WITHHOLDING",
    formNumber: "1601E",
    description: "Expanded Withholding Tax Return",
    frequency: "MONTHLY",
    dueDayOfMonth: 10,
    gracePeriod: 0,
    penaltyRate: new Decimal("0.25"),
    nextDueDate: new Date(),
    reminderDays: [15, 7, 3, 1],
    isEnabled: true,
    applicableBusinessTypes: ["ALL"],
  },
};

/**
 * Philippine business permit renewal tracking
 */
const PERMIT_RENEWAL_SCHEDULE: Record<PermitType, Partial<PermitExpiryTracker>> = {
  MAYORS_PERMIT: {
    permitType: "MAYORS_PERMIT",
    issuingAuthority: "Local Government Unit",
    renewalRequiredBy: new Date(),
    renewalProcess: [
      "Prepare business documents",
      "Pay local taxes",
      "Submit application to City/Municipal Hall",
      "Await approval and issuance",
    ],
    estimatedRenewalTime: 7, // days
    renewalCost: new Decimal("5000"),
    documentsRequired: [
      "DTI Business Registration",
      "SEC Certificate (for corporations)",
      "Barangay Clearance",
      "Tax Clearance",
      "Fire Safety Certificate",
      "Sanitary Permit",
    ],
  },
  BUSINESS_PERMIT: {
    permitType: "BUSINESS_PERMIT",
    issuingAuthority: "Local Government Unit",
    renewalRequiredBy: new Date(),
    renewalProcess: [
      "Update business registration",
      "Pay business taxes",
      "Submit renewal application",
      "Schedule inspection if required",
    ],
    estimatedRenewalTime: 5,
    renewalCost: new Decimal("3000"),
    documentsRequired: [
      "Previous year's permit",
      "Business tax receipts",
      "Updated business registration",
      "Compliance certificates",
    ],
  },
  FIRE_SAFETY_CERTIFICATE: {
    permitType: "FIRE_SAFETY_CERTIFICATE",
    issuingAuthority: "Bureau of Fire Protection",
    renewalRequiredBy: new Date(),
    renewalProcess: [
      "Schedule fire safety inspection",
      "Address inspection findings",
      "Submit compliance report",
      "Pay fees and obtain certificate",
    ],
    estimatedRenewalTime: 14,
    renewalCost: new Decimal("2000"),
    documentsRequired: [
      "Building occupancy permit",
      "Electrical plans and permits",
      "Fire safety equipment certificates",
      "Evacuation plan",
    ],
  },
  HEALTH_CERTIFICATE: {
    permitType: "HEALTH_CERTIFICATE",
    issuingAuthority: "Department of Health",
    renewalRequiredBy: new Date(),
    renewalProcess: [
      "Schedule health inspection",
      "Prepare sanitation compliance",
      "Submit application with requirements",
      "Pay fees and obtain certificate",
    ],
    estimatedRenewalTime: 10,
    renewalCost: new Decimal("1500"),
    documentsRequired: [
      "Sanitary permit",
      "Water quality test results",
      "Food handlers' health certificates",
      "Waste management compliance",
    ],
  },
  DOT_ACCREDITATION: {
    permitType: "DOT_ACCREDITATION",
    issuingAuthority: "Department of Tourism",
    renewalRequiredBy: new Date(),
    renewalProcess: [
      "Submit DOT accreditation renewal",
      "Schedule tourism facility inspection",
      "Comply with DOT standards",
      "Pay accreditation fees",
    ],
    estimatedRenewalTime: 30,
    renewalCost: new Decimal("10000"),
    documentsRequired: [
      "Tourism business registration",
      "Facility compliance certificate",
      "Guest safety protocols",
      "Tourism tax clearance",
    ],
  },
  LOCAL_TOURISM_REGISTRATION: {
    permitType: "LOCAL_TOURISM_REGISTRATION",
    issuingAuthority: "Provincial/Municipal Tourism Office",
    renewalRequiredBy: new Date(),
    renewalProcess: [
      "Update tourism registration",
      "Pay tourism fees",
      "Submit compliance documents",
      "Obtain renewed registration",
    ],
    estimatedRenewalTime: 7,
    renewalCost: new Decimal("2500"),
    documentsRequired: [
      "DOT accreditation",
      "Business permit",
      "Tourism facility certification",
      "Local tax clearance",
    ],
  },
  ENVIRONMENTAL_COMPLIANCE: {
    permitType: "ENVIRONMENTAL_COMPLIANCE",
    issuingAuthority: "Department of Environment and Natural Resources",
    renewalRequiredBy: new Date(),
    renewalProcess: [
      "Submit environmental compliance report",
      "Schedule environmental inspection",
      "Address compliance issues",
      "Pay fees and obtain clearance",
    ],
    estimatedRenewalTime: 21,
    renewalCost: new Decimal("7500"),
    documentsRequired: [
      "Environmental impact assessment",
      "Waste management plan",
      "Water discharge permits",
      "Tree cutting permits (if applicable)",
    ],
  },
  OCCUPANCY_PERMIT: {
    permitType: "OCCUPANCY_PERMIT",
    issuingAuthority: "Local Building Official",
    renewalRequiredBy: new Date(),
    renewalProcess: [
      "Schedule building inspection",
      "Submit structural compliance report",
      "Address safety issues",
      "Obtain renewed permit",
    ],
    estimatedRenewalTime: 14,
    renewalCost: new Decimal("5000"),
    documentsRequired: [
      "Building plans as-built",
      "Structural integrity certificate",
      "Electrical safety certification",
      "Fire safety compliance",
    ],
  },
  BIR_PERMIT_TO_USE: {
    permitType: "BIR_PERMIT_TO_USE",
    issuingAuthority: "Bureau of Internal Revenue",
    renewalRequiredBy: new Date(),
    renewalProcess: [
      "Apply for new permit to use",
      "Submit cash register/POS documentation",
      "Pay BIR fees",
      "Obtain renewed permit and stickers",
    ],
    estimatedRenewalTime: 10,
    renewalCost: new Decimal("3000"),
    documentsRequired: [
      "Cash register/POS certificate",
      "Tax compliance certificates",
      "Business registration updates",
      "Receipt/invoice samples",
    ],
  },
  SANITARY_PERMIT: {
    permitType: "SANITARY_PERMIT",
    issuingAuthority: "Local Health Office",
    renewalRequiredBy: new Date(),
    renewalProcess: [
      "Schedule sanitary inspection",
      "Submit food safety protocols",
      "Address inspection findings",
      "Pay fees and obtain permit",
    ],
    estimatedRenewalTime: 7,
    renewalCost: new Decimal("1000"),
    documentsRequired: [
      "Food handlers' health certificates",
      "Sanitation compliance checklist",
      "Water quality test results",
      "Pest control certificates",
    ],
  },
};

export class DeadlineMonitor {
  private readonly logger = logger.child({ service: "DeadlineMonitor" });

  /**
   * Check upcoming tax filing deadlines
   */
  async checkTaxDeadlines(config: ComplianceMonitoringConfig): Promise<ComplianceDeadlineAlert[]> {
    const alerts: ComplianceDeadlineAlert[] = [];
    const now = new Date();

    try {
      // Get applicable tax deadlines based on business type
      const applicableDeadlines = this.getApplicableTaxDeadlines(config);

      for (const deadline of applicableDeadlines) {
        const nextDue = this.calculateNextDueDate(deadline);
        const daysUntil = this.getDaysUntilDeadline(nextDue);

        // Only create alerts for deadlines within the next 30 days
        if (daysUntil <= 30) {
          const severity = this.calculateDeadlineSeverity(daysUntil);

          alerts.push({
            alertId: `tax-${deadline.filingType}-${nextDue.toISOString().split("T")[0]}`,
            category: "TAX_FILING" as ComplianceCategory,
            severity,
            title: `${deadline.description} Due`,
            description: `Form ${deadline.formNumber} must be filed by ${nextDue.toLocaleDateString()}`,
            deadlineDate: nextDue,
            daysUntilDeadline: daysUntil,
            filingType: deadline.filingType,
            affectedEntity: config.taxSettings.tin,
            actionRequired: [
              `Prepare Form ${deadline.formNumber}`,
              "Gather required supporting documents",
              "Calculate tax liability",
              "Submit to BIR before deadline",
              "Pay any tax due",
            ],
            estimatedTimeToComplete: this.estimatePreparationTime(deadline.filingType),
            potentialPenalty: this.calculatePotentialPenalty(deadline, daysUntil),
            status: "ACTIVE" as ComplianceAlertStatus,
            createdAt: now,
            updatedAt: now,
            metadata: {
              formNumber: deadline.formNumber,
              frequency: deadline.frequency,
              penaltyRate: deadline.penaltyRate.toString(),
              gracePeriod: deadline.gracePeriod,
            },
          });
        }
      }

      this.logger.info("Tax deadlines checked", {
        projectId: config.projectId,
        deadlinesChecked: applicableDeadlines.length,
        alertsGenerated: alerts.length,
      });

      return alerts.sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline);
    } catch (error) {
      this.logger.error("Failed to check tax deadlines", {
        projectId: config.projectId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Check upcoming permit expiry deadlines
   */
  async checkPermitDeadlines(
    config: ComplianceMonitoringConfig
  ): Promise<ComplianceDeadlineAlert[]> {
    const alerts: ComplianceDeadlineAlert[] = [];
    const now = new Date();

    try {
      // Get permit expiry data from database (mock implementation)
      const permitTrackers = await this.getPermitTrackers(config.projectId);

      for (const permit of permitTrackers) {
        const daysUntilExpiry = this.getDaysUntilDeadline(permit.expiryDate);
        const renewalDeadline = permit.renewalRequiredBy || permit.expiryDate;
        const daysUntilRenewal = this.getDaysUntilDeadline(renewalDeadline);

        // Alert based on renewal deadline (usually earlier than expiry)
        if (daysUntilRenewal <= 60) {
          // Start reminding 60 days before
          const severity = this.calculatePermitSeverity(daysUntilRenewal, permit.permitType);

          alerts.push({
            alertId: `permit-${permit.permitType}-${permit.permitId}`,
            category: "PERMIT_RENEWAL" as ComplianceCategory,
            severity,
            title: `${this.formatPermitName(permit.permitType)} Renewal Required`,
            description: `Permit expires on ${permit.expiryDate.toLocaleDateString()}. Renewal must begin by ${renewalDeadline.toLocaleDateString()}.`,
            deadlineDate: renewalDeadline,
            daysUntilDeadline: daysUntilRenewal,
            permitType: permit.permitType,
            affectedEntity: permit.permitNumber || config.projectId,
            actionRequired: permit.renewalProcess || [
              "Prepare renewal documents",
              "Pay required fees",
              "Submit application",
              "Schedule inspection if required",
            ],
            estimatedTimeToComplete: (permit.estimatedRenewalTime || 7) * 24 * 60, // Convert days to minutes
            potentialPenalty: this.calculatePermitPenalty(permit.permitType, daysUntilExpiry),
            status: "ACTIVE" as ComplianceAlertStatus,
            createdAt: now,
            updatedAt: now,
            metadata: {
              permitNumber: permit.permitNumber,
              issuingAuthority: permit.issuingAuthority,
              expiryDate: permit.expiryDate.toISOString(),
              renewalCost: permit.renewalCost?.toString(),
              documentsRequired: permit.documentsRequired,
            },
          });
        }
      }

      this.logger.info("Permit deadlines checked", {
        projectId: config.projectId,
        permitsChecked: permitTrackers.length,
        alertsGenerated: alerts.length,
      });

      return alerts.sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline);
    } catch (error) {
      this.logger.error("Failed to check permit deadlines", {
        projectId: config.projectId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  // Private helper methods

  private getApplicableTaxDeadlines(config: ComplianceMonitoringConfig): TaxFilingDeadline[] {
    const deadlines: TaxFilingDeadline[] = [];
    const businessType = config.taxSettings.registrationType;

    Object.values(BIR_TAX_DEADLINES).forEach((deadline) => {
      if (this.isDeadlineApplicable(deadline, businessType)) {
        deadlines.push(deadline);
      }
    });

    // Add custom deadlines from configuration
    deadlines.push(...config.customDeadlines);

    return deadlines;
  }

  private isDeadlineApplicable(deadline: TaxFilingDeadline, businessType: string): boolean {
    if (deadline.applicableBusinessTypes.includes("ALL")) return true;

    const typeMap: Record<string, string[]> = {
      VAT: ["VAT_REGISTERED"],
      NON_VAT: ["NON_VAT_REGISTERED"],
      PERCENTAGE: ["NON_VAT_REGISTERED"],
    };

    const applicableTypes = typeMap[businessType] || [];
    return deadline.applicableBusinessTypes.some(
      (type) => applicableTypes.includes(type) || type === "ALL"
    );
  }

  private calculateNextDueDate(deadline: TaxFilingDeadline): Date {
    const now = new Date();
    const nextDue = new Date();

    if (deadline.frequency === "MONTHLY") {
      // For monthly filings, due date is in the following month
      nextDue.setMonth(now.getMonth() + 1, deadline.dueDayOfMonth);
      nextDue.setHours(23, 59, 59, 999); // End of day

      // If we've already passed this month's deadline, move to next month
      if (nextDue <= now) {
        nextDue.setMonth(nextDue.getMonth() + 1);
      }
    } else if (deadline.frequency === "QUARTERLY") {
      // Calculate next quarter end
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const nextQuarterMonth = (currentQuarter + 1) * 3;

      nextDue.setMonth(nextQuarterMonth, deadline.dueDayOfQuarter || deadline.dueDayOfMonth);
      nextDue.setHours(23, 59, 59, 999);

      if (nextDue <= now) {
        nextDue.setMonth(nextDue.getMonth() + 3);
      }
    } else if (deadline.frequency === "ANNUALLY") {
      // Annual filing - typically April 15 for ITR
      nextDue.setMonth(3, 15); // April 15
      nextDue.setHours(23, 59, 59, 999);

      // If April 15 has passed, move to next year
      if (nextDue <= now) {
        nextDue.setFullYear(nextDue.getFullYear() + 1);
      }
    }

    return nextDue;
  }

  private getDaysUntilDeadline(deadline: Date): number {
    const now = new Date();
    const diffTime = deadline.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private calculateDeadlineSeverity(daysUntil: number): ComplianceAlertSeverity {
    if (daysUntil < 0) return "CRITICAL"; // Past due
    if (daysUntil <= 2) return "CRITICAL"; // 2 days or less
    if (daysUntil <= 5) return "HIGH"; // 3-5 days
    if (daysUntil <= 15) return "MEDIUM"; // 6-15 days
    return "LOW"; // 16+ days
  }

  private calculatePermitSeverity(
    daysUntil: number,
    permitType: PermitType
  ): ComplianceAlertSeverity {
    // Some permits are more critical than others
    const criticalPermits: PermitType[] = ["BUSINESS_PERMIT", "MAYORS_PERMIT", "BIR_PERMIT_TO_USE"];

    const isCritical = criticalPermits.includes(permitType);

    if (daysUntil < 0) return "CRITICAL"; // Expired
    if (daysUntil <= 7) return "CRITICAL"; // One week or less
    if (daysUntil <= 15) return isCritical ? "HIGH" : "MEDIUM";
    if (daysUntil <= 30) return isCritical ? "MEDIUM" : "LOW";
    return "LOW";
  }

  private estimatePreparationTime(filingType: TaxFilingType): number {
    // Estimated minutes to prepare each type of filing
    const timeEstimates: Record<TaxFilingType, number> = {
      VAT_MONTHLY: 120, // 2 hours
      VAT_QUARTERLY: 180, // 3 hours
      WITHHOLDING_MONTHLY: 90, // 1.5 hours
      WITHHOLDING_QUARTERLY: 150, // 2.5 hours
      ANNUAL_ITR: 480, // 8 hours
      PERCENTAGE_TAX: 60, // 1 hour
      EXPANDED_WITHHOLDING: 90, // 1.5 hours
    };

    return timeEstimates[filingType] || 120;
  }

  private calculatePotentialPenalty(
    deadline: TaxFilingDeadline,
    daysUntil: number
  ): Decimal | undefined {
    if (daysUntil >= 0) return undefined; // No penalty if not yet due

    // Mock calculation - would need actual tax data
    const estimatedTax = new Decimal("50000"); // ₱50,000 estimated tax
    const monthsLate = Math.abs(Math.floor(daysUntil / 30));
    const penalty = estimatedTax.mul(deadline.penaltyRate || new Decimal("0.25")).mul(monthsLate);

    return penalty;
  }

  private calculatePermitPenalty(permitType: PermitType, daysOverdue: number): Decimal | undefined {
    if (daysOverdue >= 0) return undefined;

    // Basic penalty calculation - varies by permit type
    const basePenalties: Record<PermitType, number> = {
      MAYORS_PERMIT: 1000,
      BUSINESS_PERMIT: 2000,
      FIRE_SAFETY_CERTIFICATE: 500,
      HEALTH_CERTIFICATE: 300,
      DOT_ACCREDITATION: 5000,
      LOCAL_TOURISM_REGISTRATION: 1500,
      ENVIRONMENTAL_COMPLIANCE: 10000,
      OCCUPANCY_PERMIT: 3000,
      BIR_PERMIT_TO_USE: 2500,
      SANITARY_PERMIT: 200,
    };

    const basePenalty = basePenalties[permitType] || 1000;
    const weeksOverdue = Math.floor(Math.abs(daysOverdue) / 7);

    return new Decimal(basePenalty * Math.max(1, weeksOverdue));
  }

  private formatPermitName(permitType: PermitType): string {
    const nameMap: Record<PermitType, string> = {
      MAYORS_PERMIT: "Mayor's Permit",
      BUSINESS_PERMIT: "Business Permit",
      FIRE_SAFETY_CERTIFICATE: "Fire Safety Certificate",
      HEALTH_CERTIFICATE: "Health Certificate",
      DOT_ACCREDITATION: "DOT Accreditation",
      LOCAL_TOURISM_REGISTRATION: "Local Tourism Registration",
      ENVIRONMENTAL_COMPLIANCE: "Environmental Compliance Certificate",
      OCCUPANCY_PERMIT: "Occupancy Permit",
      BIR_PERMIT_TO_USE: "BIR Permit to Use",
      SANITARY_PERMIT: "Sanitary Permit",
    };

    return nameMap[permitType] || permitType.replace(/_/g, " ");
  }

  private async getPermitTrackers(projectId: string): Promise<PermitExpiryTracker[]> {
    // Mock implementation - would fetch from database
    const now = new Date();
    const trackers: PermitExpiryTracker[] = [];

    // Generate sample permit trackers for demonstration
    Object.entries(PERMIT_RENEWAL_SCHEDULE).forEach(([type, template], index) => {
      const expiryDate = new Date();
      expiryDate.setDate(now.getDate() + (30 - index * 5)); // Staggered expiry dates

      const renewalDate = new Date(expiryDate);
      renewalDate.setDate(renewalDate.getDate() - (template.estimatedRenewalTime || 7));

      trackers.push({
        permitId: `permit-${type}-${projectId}`,
        permitType: type as PermitType,
        permitNumber: `${type}-${projectId}-2024`,
        issuingAuthority: template.issuingAuthority || "Local Authority",
        issueDate: new Date(now.getFullYear(), 0, 1), // January 1st this year
        expiryDate,
        renewalRequiredBy: renewalDate,
        renewalProcess: template.renewalProcess || [],
        estimatedRenewalTime: template.estimatedRenewalTime || 7,
        renewalCost: template.renewalCost,
        documentsRequired: template.documentsRequired || [],
        status: renewalDate <= now ? "RENEWAL_IN_PROGRESS" : "ACTIVE",
        remindersSent: [],
        notes: `Sample ${type} permit for project ${projectId}`,
      });
    });

    return trackers;
  }
}
