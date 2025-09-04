/**
 * Privacy Consent Manager
 * Philippine Data Privacy Act (DPA) Compliant Consent Management
 *
 * Implements comprehensive consent tracking as required by Republic Act No. 10173
 * including explicit consent, withdrawal mechanisms, and version tracking
 */

import { z } from "zod";
import { db } from "../db/connection";
import { dpaAuditLogger, DPAEventCategory, PIType } from "./dpa-audit-logger";

// Consent purposes aligned with DPA legitimate purposes
export enum ConsentPurpose {
  // Core service provision
  BOOKING_PROCESSING = "booking_processing",
  PAYMENT_PROCESSING = "payment_processing",
  GUEST_COMMUNICATION = "guest_communication",
  SERVICE_DELIVERY = "service_delivery",

  // Marketing and promotion
  MARKETING_EMAILS = "marketing_emails",
  PROMOTIONAL_SMS = "promotional_sms",
  PERSONALIZED_OFFERS = "personalized_offers",
  NEWSLETTER = "newsletter",

  // Data sharing
  THIRD_PARTY_BOOKING = "third_party_booking", // Airbnb, Booking.com
  ANALYTICS = "analytics",
  PARTNER_SERVICES = "partner_services",

  // Legal and compliance
  LEGAL_COMPLIANCE = "legal_compliance",
  TAX_REPORTING = "tax_reporting",
  SECURITY_MONITORING = "security_monitoring",

  // Additional services
  LOYALTY_PROGRAM = "loyalty_program",
  FEEDBACK_SURVEYS = "feedback_surveys",
  PHOTO_USAGE = "photo_usage",
}

// Legal basis for processing (DPA Article IV)
export enum LegalBasis {
  CONSENT = "consent", // Explicit consent
  CONTRACT = "contract", // Necessary for contract performance
  LEGAL_OBLIGATION = "legal_obligation", // Required by law
  VITAL_INTERESTS = "vital_interests", // Protect vital interests
  PUBLIC_TASK = "public_task", // Public interest task
  LEGITIMATE_INTERESTS = "legitimate_interests", // Legitimate business interests
}

// Consent status
export enum ConsentStatus {
  GRANTED = "granted",
  WITHDRAWN = "withdrawn",
  EXPIRED = "expired",
  PENDING = "pending",
}

// Consent record schema
export const ConsentRecordSchema = z.object({
  userId: z.string().uuid(),
  purpose: z.nativeEnum(ConsentPurpose),
  legalBasis: z.nativeEnum(LegalBasis),
  status: z.nativeEnum(ConsentStatus),
  version: z.string(),
  grantedAt: z.date().optional(),
  withdrawnAt: z.date().optional(),
  expiresAt: z.date().optional(),
  scope: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional(),
});

export type ConsentRecord = z.infer<typeof ConsentRecordSchema>;

// Consent preferences schema
export const ConsentPreferencesSchema = z.object({
  marketing: z.object({
    emails: z.boolean().default(false),
    sms: z.boolean().default(false),
    personalized: z.boolean().default(false),
    newsletter: z.boolean().default(false),
  }),
  dataSharing: z.object({
    thirdPartyBooking: z.boolean().default(false),
    analytics: z.boolean().default(false),
    partners: z.boolean().default(false),
  }),
  additional: z.object({
    loyaltyProgram: z.boolean().default(false),
    surveys: z.boolean().default(false),
    photoUsage: z.boolean().default(false),
  }),
});

export type ConsentPreferences = z.infer<typeof ConsentPreferencesSchema>;

export class PrivacyConsentManager {
  private static instance: PrivacyConsentManager;

  // Current consent policy version
  private readonly CURRENT_VERSION = "2.0.0"; // Updated for DPA compliance

  // Consent expiration periods (in days)
  private readonly CONSENT_EXPIRY = {
    marketing: 365, // 1 year for marketing
    dataSharing: 730, // 2 years for data sharing
    general: 1095, // 3 years for general consent
    sensitive: 180, // 6 months for sensitive data
  };

  // Required consents for core functionality
  private readonly REQUIRED_CONSENTS = [
    ConsentPurpose.BOOKING_PROCESSING,
    ConsentPurpose.PAYMENT_PROCESSING,
    ConsentPurpose.GUEST_COMMUNICATION,
    ConsentPurpose.LEGAL_COMPLIANCE,
    ConsentPurpose.TAX_REPORTING,
  ];

  private constructor() {}

  static getInstance(): PrivacyConsentManager {
    if (!PrivacyConsentManager.instance) {
      PrivacyConsentManager.instance = new PrivacyConsentManager();
    }
    return PrivacyConsentManager.instance;
  }

  /**
   * Grant consent for specific purposes
   */
  async grantConsent(params: {
    userId: string;
    purposes: ConsentPurpose[];
    legalBasis?: LegalBasis;
    expiryDays?: number;
    metadata?: Record<string, any>;
  }): Promise<ConsentRecord[]> {
    const records: ConsentRecord[] = [];

    try {
      for (const purpose of params.purposes) {
        const record: ConsentRecord = {
          userId: params.userId,
          purpose,
          legalBasis: params.legalBasis || this.determineLegalBasis(purpose),
          status: ConsentStatus.GRANTED,
          version: this.CURRENT_VERSION,
          grantedAt: new Date(),
          expiresAt: this.calculateExpiry(purpose, params.expiryDays),
          scope: this.getPurposeScope(purpose),
          metadata: {
            ...params.metadata,
            ipAddress: params.metadata?.ipAddress,
            userAgent: params.metadata?.userAgent,
            grantedVia: params.metadata?.grantedVia || "web_form",
          },
        };

        // Store consent record (would use database in production)
        await this.storeConsentRecord(record);
        records.push(record);

        // Log consent grant
        await dpaAuditLogger.logConsent({
          userId: params.userId,
          action: "grant",
          consentId: this.generateConsentId(params.userId, purpose),
          consentVersion: this.CURRENT_VERSION,
          scope: record.scope,
          metadata: record.metadata,
        });
      }

      return records;
    } catch (error) {
      console.error("[Consent Manager] Failed to grant consent:", error);
      throw error;
    }
  }

  /**
   * Withdraw consent for specific purposes
   */
  async withdrawConsent(params: {
    userId: string;
    purposes: ConsentPurpose[];
    reason?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      for (const purpose of params.purposes) {
        // Check if withdrawal is allowed
        if (this.REQUIRED_CONSENTS.includes(purpose)) {
          throw new Error(`Cannot withdraw consent for required purpose: ${purpose}`);
        }

        // Update consent record
        await this.updateConsentStatus(params.userId, purpose, ConsentStatus.WITHDRAWN);

        // Log consent withdrawal
        await dpaAuditLogger.logConsent({
          userId: params.userId,
          action: "withdraw",
          consentId: this.generateConsentId(params.userId, purpose),
          consentVersion: this.CURRENT_VERSION,
          scope: this.getPurposeScope(purpose),
          metadata: {
            reason: params.reason,
            ...params.metadata,
          },
        });

        // Trigger data processing cessation
        await this.ceaseDataProcessing(params.userId, purpose);
      }
    } catch (error) {
      console.error("[Consent Manager] Failed to withdraw consent:", error);
      throw error;
    }
  }

  /**
   * Get user's consent status
   */
  async getConsentStatus(userId: string): Promise<{
    consents: ConsentRecord[];
    preferences: ConsentPreferences;
    requiredConsentsGranted: boolean;
    lastUpdated: Date;
  }> {
    try {
      // Fetch user's consent records
      const consents = await this.fetchUserConsents(userId);

      // Build preferences from consents
      const preferences = this.buildPreferences(consents);

      // Check if all required consents are granted
      const requiredConsentsGranted = this.checkRequiredConsents(consents);

      // Find last update time
      const lastUpdated = this.getLastUpdateTime(consents);

      return {
        consents,
        preferences,
        requiredConsentsGranted,
        lastUpdated,
      };
    } catch (error) {
      console.error("[Consent Manager] Failed to get consent status:", error);
      throw error;
    }
  }

  /**
   * Check if user has valid consent for a specific purpose
   */
  async hasValidConsent(
    userId: string,
    purpose: ConsentPurpose,
    checkExpiry: boolean = true
  ): Promise<boolean> {
    try {
      const consents = await this.fetchUserConsents(userId);
      const consent = consents.find((c) => c.purpose === purpose);

      if (!consent) return false;
      if (consent.status !== ConsentStatus.GRANTED) return false;
      if (checkExpiry && consent.expiresAt && consent.expiresAt < new Date()) {
        // Mark as expired
        await this.updateConsentStatus(userId, purpose, ConsentStatus.EXPIRED);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[Consent Manager] Failed to check consent:", error);
      return false;
    }
  }

  /**
   * Record consent for data access
   */
  async recordDataAccess(params: {
    userId: string;
    dataSubjectId: string;
    purpose: ConsentPurpose;
    piType: PIType;
    fields: string[];
    success: boolean;
  }): Promise<void> {
    try {
      // Check consent before recording
      const hasConsent = await this.hasValidConsent(params.userId, params.purpose);

      if (!hasConsent && params.success) {
        // Log unauthorized access
        await dpaAuditLogger.logDPAEvent({
          category: DPAEventCategory.UNAUTHORIZED_ACCESS,
          action: "unconsented_data_access",
          description: `Attempted to access data without valid consent for ${params.purpose}`,
          userId: params.userId,
          dataSubjectId: params.dataSubjectId,
          piType: params.piType,
          piFields: params.fields,
          complianceLevel: "high" as any,
          success: false,
        });

        throw new Error("No valid consent for data access");
      }

      // Log consented access
      await dpaAuditLogger.logPIAccess({
        userId: params.userId,
        dataSubjectId: params.dataSubjectId,
        piType: params.piType,
        fields: params.fields,
        purpose: params.purpose,
        legalBasis: hasConsent ? "consent" : "legitimate_interests",
        success: params.success,
      });
    } catch (error) {
      console.error("[Consent Manager] Failed to record data access:", error);
      throw error;
    }
  }

  /**
   * Generate privacy notice for user
   */
  generatePrivacyNotice(language: "en" | "fil" = "en"): {
    title: string;
    sections: Array<{
      heading: string;
      content: string;
      purposes?: ConsentPurpose[];
      required?: boolean;
    }>;
    version: string;
    lastUpdated: Date;
  } {
    const notices = {
      en: {
        title: "Privacy Notice - Okaeri Resort",
        sections: [
          {
            heading: "Data We Collect",
            content:
              "We collect personal information necessary to provide resort services including your name, contact details, payment information, and stay preferences.",
            purposes: [ConsentPurpose.BOOKING_PROCESSING, ConsentPurpose.SERVICE_DELIVERY],
            required: true,
          },
          {
            heading: "How We Use Your Data",
            content:
              "Your data is used to process bookings, communicate about your stay, ensure safety and security, and comply with legal obligations.",
            purposes: [ConsentPurpose.GUEST_COMMUNICATION, ConsentPurpose.SECURITY_MONITORING],
            required: true,
          },
          {
            heading: "Marketing Communications",
            content:
              "With your consent, we may send promotional offers, newsletters, and personalized recommendations.",
            purposes: [ConsentPurpose.MARKETING_EMAILS, ConsentPurpose.PROMOTIONAL_SMS],
            required: false,
          },
          {
            heading: "Data Sharing",
            content:
              "We may share your data with booking platforms, payment processors, and service partners only as necessary and with your consent.",
            purposes: [ConsentPurpose.THIRD_PARTY_BOOKING, ConsentPurpose.PARTNER_SERVICES],
            required: false,
          },
          {
            heading: "Your Rights",
            content:
              "Under the Data Privacy Act of 2012, you have the right to access, correct, delete, and port your personal data. You may also object to processing and withdraw consent.",
          },
          {
            heading: "Data Retention",
            content:
              "We retain your data only as long as necessary for legal compliance and service provision. Financial records are kept for 5 years as required by law.",
          },
          {
            heading: "Contact Us",
            content:
              "For privacy concerns or to exercise your rights, contact our Data Protection Officer at privacy@okaeri-resort.com",
          },
        ],
        version: this.CURRENT_VERSION,
        lastUpdated: new Date("2024-01-01"),
      },
      fil: {
        title: "Abiso sa Privacy - Okaeri Resort",
        sections: [
          {
            heading: "Datos na Kinokolekta Namin",
            content:
              "Kinokolekta namin ang personal na impormasyon na kailangan para makapagbigay ng serbisyo sa resort.",
            purposes: [ConsentPurpose.BOOKING_PROCESSING, ConsentPurpose.SERVICE_DELIVERY],
            required: true,
          },
          // Additional Filipino translations...
        ],
        version: this.CURRENT_VERSION,
        lastUpdated: new Date("2024-01-01"),
      },
    };

    return notices[language];
  }

  /**
   * Export user consent data (for GDPR/DPA compliance)
   */
  async exportConsentData(userId: string): Promise<{
    user: { id: string; email?: string };
    consents: ConsentRecord[];
    history: Array<{
      action: string;
      timestamp: Date;
      details: Record<string, any>;
    }>;
    exportDate: Date;
  }> {
    try {
      const consents = await this.fetchUserConsents(userId);
      const history = await this.fetchConsentHistory(userId);

      // Log data export
      await dpaAuditLogger.logDSRRequest({
        requestType: "portability",
        dataSubjectId: userId,
        requesterId: userId,
        details: { format: "json", includeHistory: true },
        approved: true,
      });

      return {
        user: { id: userId },
        consents,
        history,
        exportDate: new Date(),
      };
    } catch (error) {
      console.error("[Consent Manager] Failed to export consent data:", error);
      throw error;
    }
  }

  /**
   * Bulk update consent preferences
   */
  async updatePreferences(userId: string, preferences: ConsentPreferences): Promise<void> {
    try {
      const purposes: ConsentPurpose[] = [];
      const withdrawals: ConsentPurpose[] = [];

      // Process marketing preferences
      if (preferences.marketing.emails) {
        purposes.push(ConsentPurpose.MARKETING_EMAILS);
      } else {
        withdrawals.push(ConsentPurpose.MARKETING_EMAILS);
      }

      if (preferences.marketing.sms) {
        purposes.push(ConsentPurpose.PROMOTIONAL_SMS);
      } else {
        withdrawals.push(ConsentPurpose.PROMOTIONAL_SMS);
      }

      if (preferences.marketing.personalized) {
        purposes.push(ConsentPurpose.PERSONALIZED_OFFERS);
      } else {
        withdrawals.push(ConsentPurpose.PERSONALIZED_OFFERS);
      }

      if (preferences.marketing.newsletter) {
        purposes.push(ConsentPurpose.NEWSLETTER);
      } else {
        withdrawals.push(ConsentPurpose.NEWSLETTER);
      }

      // Process data sharing preferences
      if (preferences.dataSharing.thirdPartyBooking) {
        purposes.push(ConsentPurpose.THIRD_PARTY_BOOKING);
      } else {
        withdrawals.push(ConsentPurpose.THIRD_PARTY_BOOKING);
      }

      if (preferences.dataSharing.analytics) {
        purposes.push(ConsentPurpose.ANALYTICS);
      } else {
        withdrawals.push(ConsentPurpose.ANALYTICS);
      }

      if (preferences.dataSharing.partners) {
        purposes.push(ConsentPurpose.PARTNER_SERVICES);
      } else {
        withdrawals.push(ConsentPurpose.PARTNER_SERVICES);
      }

      // Process additional preferences
      if (preferences.additional.loyaltyProgram) {
        purposes.push(ConsentPurpose.LOYALTY_PROGRAM);
      } else {
        withdrawals.push(ConsentPurpose.LOYALTY_PROGRAM);
      }

      if (preferences.additional.surveys) {
        purposes.push(ConsentPurpose.FEEDBACK_SURVEYS);
      } else {
        withdrawals.push(ConsentPurpose.FEEDBACK_SURVEYS);
      }

      if (preferences.additional.photoUsage) {
        purposes.push(ConsentPurpose.PHOTO_USAGE);
      } else {
        withdrawals.push(ConsentPurpose.PHOTO_USAGE);
      }

      // Grant new consents
      if (purposes.length > 0) {
        await this.grantConsent({
          userId,
          purposes,
          metadata: { source: "preference_center" },
        });
      }

      // Withdraw removed consents
      if (withdrawals.length > 0) {
        // Filter out any that weren't previously granted
        const currentConsents = await this.fetchUserConsents(userId);
        const validWithdrawals = withdrawals.filter((purpose) =>
          currentConsents.some((c) => c.purpose === purpose && c.status === ConsentStatus.GRANTED)
        );

        if (validWithdrawals.length > 0) {
          await this.withdrawConsent({
            userId,
            purposes: validWithdrawals,
            reason: "preference_update",
            metadata: { source: "preference_center" },
          });
        }
      }

      // Log preference update
      await dpaAuditLogger.logConsent({
        userId,
        action: "update",
        consentId: this.generateConsentId(userId, "preferences"),
        consentVersion: this.CURRENT_VERSION,
        scope: [...purposes, ...withdrawals].map((p) => p.toString()),
        metadata: { preferences },
      });
    } catch (error) {
      console.error("[Consent Manager] Failed to update preferences:", error);
      throw error;
    }
  }

  /**
   * Check consent before processing sensitive data
   */
  async checkSensitiveDataConsent(
    userId: string,
    dataType: PIType,
    purpose: ConsentPurpose
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // Sensitive data requires explicit consent
      if (dataType === PIType.SENSITIVE || dataType === PIType.PRIVILEGED) {
        const hasConsent = await this.hasValidConsent(userId, purpose);

        if (!hasConsent) {
          return {
            allowed: false,
            reason: "No valid consent for processing sensitive personal information",
          };
        }

        // Check if consent is recent enough for sensitive data
        const consents = await this.fetchUserConsents(userId);
        const consent = consents.find((c) => c.purpose === purpose);

        if (consent && consent.grantedAt) {
          const daysSinceConsent = Math.floor(
            (Date.now() - consent.grantedAt.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysSinceConsent > this.CONSENT_EXPIRY.sensitive) {
            return {
              allowed: false,
              reason: "Consent for sensitive data has expired and needs renewal",
            };
          }
        }
      }

      return { allowed: true };
    } catch (error) {
      console.error("[Consent Manager] Failed to check sensitive data consent:", error);
      return {
        allowed: false,
        reason: "Failed to verify consent status",
      };
    }
  }

  /**
   * Private helper methods
   */

  private determineLegalBasis(purpose: ConsentPurpose): LegalBasis {
    // Determine appropriate legal basis based on purpose
    switch (purpose) {
      case ConsentPurpose.BOOKING_PROCESSING:
      case ConsentPurpose.PAYMENT_PROCESSING:
      case ConsentPurpose.SERVICE_DELIVERY:
        return LegalBasis.CONTRACT;

      case ConsentPurpose.LEGAL_COMPLIANCE:
      case ConsentPurpose.TAX_REPORTING:
        return LegalBasis.LEGAL_OBLIGATION;

      case ConsentPurpose.SECURITY_MONITORING:
        return LegalBasis.LEGITIMATE_INTERESTS;

      case ConsentPurpose.MARKETING_EMAILS:
      case ConsentPurpose.PROMOTIONAL_SMS:
      case ConsentPurpose.PERSONALIZED_OFFERS:
      case ConsentPurpose.NEWSLETTER:
      case ConsentPurpose.THIRD_PARTY_BOOKING:
      case ConsentPurpose.ANALYTICS:
      case ConsentPurpose.PARTNER_SERVICES:
      case ConsentPurpose.LOYALTY_PROGRAM:
      case ConsentPurpose.FEEDBACK_SURVEYS:
      case ConsentPurpose.PHOTO_USAGE:
      default:
        return LegalBasis.CONSENT;
    }
  }

  private calculateExpiry(purpose: ConsentPurpose, customDays?: number): Date {
    const days = customDays || this.getDefaultExpiryDays(purpose);
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return expiry;
  }

  private getDefaultExpiryDays(purpose: ConsentPurpose): number {
    if (
      [
        ConsentPurpose.MARKETING_EMAILS,
        ConsentPurpose.PROMOTIONAL_SMS,
        ConsentPurpose.PERSONALIZED_OFFERS,
        ConsentPurpose.NEWSLETTER,
      ].includes(purpose)
    ) {
      return this.CONSENT_EXPIRY.marketing;
    }

    if (
      [
        ConsentPurpose.THIRD_PARTY_BOOKING,
        ConsentPurpose.ANALYTICS,
        ConsentPurpose.PARTNER_SERVICES,
      ].includes(purpose)
    ) {
      return this.CONSENT_EXPIRY.dataSharing;
    }

    return this.CONSENT_EXPIRY.general;
  }

  private getPurposeScope(purpose: ConsentPurpose): string[] {
    // Define data scope for each purpose
    const scopes: Record<ConsentPurpose, string[]> = {
      [ConsentPurpose.BOOKING_PROCESSING]: ["name", "email", "phone", "dates", "room_preferences"],
      [ConsentPurpose.PAYMENT_PROCESSING]: ["name", "billing_address", "payment_method"],
      [ConsentPurpose.GUEST_COMMUNICATION]: ["name", "email", "phone", "language_preference"],
      [ConsentPurpose.SERVICE_DELIVERY]: ["name", "room_assignment", "special_requests"],
      [ConsentPurpose.MARKETING_EMAILS]: ["email", "name", "preferences", "booking_history"],
      [ConsentPurpose.PROMOTIONAL_SMS]: ["phone", "name", "preferences"],
      [ConsentPurpose.PERSONALIZED_OFFERS]: ["booking_history", "preferences", "demographics"],
      [ConsentPurpose.NEWSLETTER]: ["email", "name"],
      [ConsentPurpose.THIRD_PARTY_BOOKING]: ["name", "email", "phone", "booking_details"],
      [ConsentPurpose.ANALYTICS]: ["usage_data", "preferences", "demographics"],
      [ConsentPurpose.PARTNER_SERVICES]: ["name", "contact_info", "service_requests"],
      [ConsentPurpose.LEGAL_COMPLIANCE]: ["all_required_by_law"],
      [ConsentPurpose.TAX_REPORTING]: ["name", "address", "tax_id", "payment_records"],
      [ConsentPurpose.SECURITY_MONITORING]: ["access_logs", "ip_address", "device_info"],
      [ConsentPurpose.LOYALTY_PROGRAM]: ["name", "email", "points", "tier", "history"],
      [ConsentPurpose.FEEDBACK_SURVEYS]: ["email", "stay_details", "feedback"],
      [ConsentPurpose.PHOTO_USAGE]: ["photos", "name", "consent_details"],
    };

    return scopes[purpose] || [];
  }

  private generateConsentId(userId: string, purpose: ConsentPurpose | string): string {
    return `consent_${userId}_${purpose}_${Date.now()}`;
  }

  private async storeConsentRecord(record: ConsentRecord): Promise<void> {
    // In production, this would store in database
    // For now, store in memory or local storage
    console.log("[Consent Manager] Storing consent record:", record);
  }

  private async updateConsentStatus(
    userId: string,
    purpose: ConsentPurpose,
    status: ConsentStatus
  ): Promise<void> {
    // In production, update database record
    console.log("[Consent Manager] Updating consent status:", { userId, purpose, status });
  }

  private async fetchUserConsents(userId: string): Promise<ConsentRecord[]> {
    // In production, fetch from database
    // For now, return mock data
    return [];
  }

  private async fetchConsentHistory(userId: string): Promise<any[]> {
    // In production, fetch from audit logs
    return [];
  }

  private buildPreferences(consents: ConsentRecord[]): ConsentPreferences {
    const activeConsents = consents.filter((c) => c.status === ConsentStatus.GRANTED);

    return {
      marketing: {
        emails: activeConsents.some((c) => c.purpose === ConsentPurpose.MARKETING_EMAILS),
        sms: activeConsents.some((c) => c.purpose === ConsentPurpose.PROMOTIONAL_SMS),
        personalized: activeConsents.some((c) => c.purpose === ConsentPurpose.PERSONALIZED_OFFERS),
        newsletter: activeConsents.some((c) => c.purpose === ConsentPurpose.NEWSLETTER),
      },
      dataSharing: {
        thirdPartyBooking: activeConsents.some(
          (c) => c.purpose === ConsentPurpose.THIRD_PARTY_BOOKING
        ),
        analytics: activeConsents.some((c) => c.purpose === ConsentPurpose.ANALYTICS),
        partners: activeConsents.some((c) => c.purpose === ConsentPurpose.PARTNER_SERVICES),
      },
      additional: {
        loyaltyProgram: activeConsents.some((c) => c.purpose === ConsentPurpose.LOYALTY_PROGRAM),
        surveys: activeConsents.some((c) => c.purpose === ConsentPurpose.FEEDBACK_SURVEYS),
        photoUsage: activeConsents.some((c) => c.purpose === ConsentPurpose.PHOTO_USAGE),
      },
    };
  }

  private checkRequiredConsents(consents: ConsentRecord[]): boolean {
    const activeConsents = consents.filter((c) => c.status === ConsentStatus.GRANTED);

    return this.REQUIRED_CONSENTS.every((required) =>
      activeConsents.some((c) => c.purpose === required)
    );
  }

  private getLastUpdateTime(consents: ConsentRecord[]): Date {
    const dates = consents
      .map((c) => [c.grantedAt, c.withdrawnAt])
      .flat()
      .filter(Boolean) as Date[];

    return dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : new Date();
  }

  private async ceaseDataProcessing(userId: string, purpose: ConsentPurpose): Promise<void> {
    // Implement data processing cessation
    // This would trigger workflows to stop using data for the withdrawn purpose
    console.log("[Consent Manager] Ceasing data processing:", { userId, purpose });
  }
}

// Export singleton instance
export const privacyConsentManager = PrivacyConsentManager.getInstance();

// Export convenience functions
export const grantConsent = (params: Parameters<typeof privacyConsentManager.grantConsent>[0]) =>
  privacyConsentManager.grantConsent(params);

export const withdrawConsent = (
  params: Parameters<typeof privacyConsentManager.withdrawConsent>[0]
) => privacyConsentManager.withdrawConsent(params);

export const getConsentStatus = (userId: string) => privacyConsentManager.getConsentStatus(userId);

export const hasValidConsent = (userId: string, purpose: ConsentPurpose) =>
  privacyConsentManager.hasValidConsent(userId, purpose);

export const updateConsentPreferences = (userId: string, preferences: ConsentPreferences) =>
  privacyConsentManager.updatePreferences(userId, preferences);
