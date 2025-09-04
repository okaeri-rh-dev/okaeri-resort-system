/**
 * Field-Level Encryption Manager
 * Philippine Data Privacy Act Compliant Encryption for PII
 *
 * Implements field-level encryption for sensitive personal information
 * as required by Republic Act No. 10173 Section 20-26 (Security Measures)
 */

import crypto from "crypto";
import type { PIType } from "./dpa-audit-logger";
import { dpaAuditLogger } from "./dpa-audit-logger";

// Encryption algorithms
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const KEY_DERIVATION_ITERATIONS = 100000;
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Fields that require encryption
export enum EncryptedField {
  // Government IDs
  TIN = "tin", // Tax Identification Number
  SSS = "sss", // Social Security System
  PHILHEALTH = "philhealth", // PhilHealth Number
  PAGIBIG = "pagibig", // Pag-IBIG Number
  DRIVERS_LICENSE = "drivers_license",
  PASSPORT = "passport",
  VOTERS_ID = "voters_id",

  // Financial Information
  CREDIT_CARD = "credit_card",
  BANK_ACCOUNT = "bank_account",

  // Health Information
  MEDICAL_HISTORY = "medical_history",
  ALLERGIES = "allergies",
  MEDICATIONS = "medications",

  // Sensitive Personal Data
  RELIGION = "religion",
  POLITICAL_AFFILIATION = "political_affiliation",
  SEXUAL_ORIENTATION = "sexual_orientation",

  // Biometric Data
  FINGERPRINT = "fingerprint",
  FACE_SCAN = "face_scan",

  // Contact Information (when required)
  PHONE = "phone",
  ADDRESS = "address",

  // Custom sensitive fields
  CUSTOM_SENSITIVE = "custom_sensitive",
}

// Encryption context for audit trail
export interface EncryptionContext {
  userId?: string;
  projectId?: string;
  purpose: string;
  legalBasis: string;
  dataSubjectId: string;
  fieldType: EncryptedField;
  piType: PIType;
}

// Encrypted data format
export interface EncryptedData {
  algorithm: string;
  encrypted: string;
  iv: string;
  tag: string;
  salt: string;
  keyId: string;
  version: number;
  metadata?: {
    encryptedAt: string;
    expiresAt?: string;
    purpose?: string;
  };
}

export class FieldEncryptionManager {
  private static instance: FieldEncryptionManager;
  private masterKey: Buffer;
  private keyCache: Map<string, { key: Buffer; expires: number }> = new Map();
  private readonly KEY_CACHE_TTL = 3600000; // 1 hour
  private readonly CURRENT_VERSION = 1;

  private constructor() {
    this.masterKey = this.getMasterKey();
    this.startKeyCacheCleanup();
  }

  static getInstance(): FieldEncryptionManager {
    if (!FieldEncryptionManager.instance) {
      FieldEncryptionManager.instance = new FieldEncryptionManager();
    }
    return FieldEncryptionManager.instance;
  }

  /**
   * Encrypt a field value
   */
  async encryptField(
    value: string,
    field: EncryptedField,
    context: EncryptionContext
  ): Promise<EncryptedData> {
    try {
      // Validate input
      if (!value || typeof value !== "string") {
        throw new Error("Invalid value for encryption");
      }

      // Generate field-specific key
      const salt = crypto.randomBytes(SALT_LENGTH);
      const fieldKey = await this.deriveFieldKey(field, salt);

      // Generate IV and encrypt
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, fieldKey, iv);

      const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);

      const tag = cipher.getAuthTag();

      // Create encrypted data object
      const encryptedData: EncryptedData = {
        algorithm: ENCRYPTION_ALGORITHM,
        encrypted: encrypted.toString("base64"),
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
        salt: salt.toString("base64"),
        keyId: this.generateKeyId(field),
        version: this.CURRENT_VERSION,
        metadata: {
          encryptedAt: new Date().toISOString(),
          purpose: context.purpose,
        },
      };

      // Log encryption event
      await this.logEncryption(field, context, true);

      return encryptedData;
    } catch (error) {
      // Log encryption failure
      await this.logEncryption(field, context, false, error);
      throw error;
    }
  }

  /**
   * Decrypt a field value
   */
  async decryptField(
    encryptedData: EncryptedData,
    field: EncryptedField,
    context: EncryptionContext
  ): Promise<string> {
    try {
      // Validate encrypted data
      this.validateEncryptedData(encryptedData);

      // Check version compatibility
      if (encryptedData.version > this.CURRENT_VERSION) {
        throw new Error("Encrypted data version not supported");
      }

      // Derive field key
      const salt = Buffer.from(encryptedData.salt, "base64");
      const fieldKey = await this.deriveFieldKey(field, salt);

      // Decrypt
      const iv = Buffer.from(encryptedData.iv, "base64");
      const tag = Buffer.from(encryptedData.tag, "base64");
      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, fieldKey, iv);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedData.encrypted, "base64")),
        decipher.final(),
      ]);

      // Log decryption event
      await this.logDecryption(field, context, true);

      return decrypted.toString("utf8");
    } catch (error) {
      // Log decryption failure
      await this.logDecryption(field, context, false, error);
      throw error;
    }
  }

  /**
   * Encrypt multiple fields in a batch
   */
  async encryptBatch(
    fields: Array<{ value: string; field: EncryptedField }>,
    context: EncryptionContext
  ): Promise<Map<EncryptedField, EncryptedData>> {
    const results = new Map<EncryptedField, EncryptedData>();

    for (const { value, field } of fields) {
      try {
        const encrypted = await this.encryptField(value, field, context);
        results.set(field, encrypted);
      } catch (error) {
        console.error(`[Encryption] Failed to encrypt ${field}:`, error);
        // Continue with other fields
      }
    }

    return results;
  }

  /**
   * Search encrypted data (using blind indexing)
   */
  async createSearchableHash(value: string, field: EncryptedField): Promise<string> {
    // Create a deterministic hash for searching
    // This allows searching without decrypting all records

    const normalizedValue = this.normalizeValue(value, field);
    const salt = this.getSearchSalt(field);

    const hash = crypto.pbkdf2Sync(normalizedValue, salt, 10000, 32, "sha256").toString("base64");

    return hash;
  }

  /**
   * Rotate encryption keys
   */
  async rotateKeys(
    oldData: EncryptedData,
    field: EncryptedField,
    context: EncryptionContext
  ): Promise<EncryptedData> {
    try {
      // Decrypt with old key
      const decrypted = await this.decryptField(oldData, field, context);

      // Re-encrypt with new key
      const newEncrypted = await this.encryptField(decrypted, field, {
        ...context,
        purpose: "key_rotation",
      });

      // Log key rotation
      await dpaAuditLogger.logDPAEvent({
        category: "security_monitoring" as any,
        action: "key_rotation",
        description: `Rotated encryption key for ${field}`,
        userId: context.userId,
        dataSubjectId: context.dataSubjectId,
        piType: context.piType,
        complianceLevel: "info" as any,
        success: true,
      });

      return newEncrypted;
    } catch (error) {
      console.error("[Encryption] Key rotation failed:", error);
      throw error;
    }
  }

  /**
   * Check if a field should be encrypted
   */
  shouldEncrypt(fieldName: string, value: any): boolean {
    // Check if field is in encrypted fields list
    const isEncryptedField = Object.values(EncryptedField).includes(fieldName as EncryptedField);

    // Check if value contains sensitive patterns
    const hasSensitivePattern = this.detectSensitivePattern(value);

    return isEncryptedField || hasSensitivePattern;
  }

  /**
   * Encrypt object fields based on sensitivity
   */
  async encryptObject<T extends Record<string, any>>(
    obj: T,
    context: EncryptionContext
  ): Promise<T> {
    const encrypted = { ...obj };

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string" && this.shouldEncrypt(key, value)) {
        const field = this.mapToEncryptedField(key);
        const encryptedData = await this.encryptField(value, field, context);
        encrypted[key] = JSON.stringify(encryptedData);
      }
    }

    return encrypted;
  }

  /**
   * Decrypt object fields
   */
  async decryptObject<T extends Record<string, any>>(
    obj: T,
    context: EncryptionContext
  ): Promise<T> {
    const decrypted = { ...obj };

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string" && this.isEncryptedData(value)) {
        try {
          const encryptedData = JSON.parse(value) as EncryptedData;
          const field = this.mapToEncryptedField(key);
          decrypted[key] = await this.decryptField(encryptedData, field, context);
        } catch (error) {
          console.error(`[Encryption] Failed to decrypt ${key}:`, error);
          // Leave as encrypted if decryption fails
        }
      }
    }

    return decrypted;
  }

  /**
   * Generate encryption status report
   */
  async generateEncryptionReport(): Promise<{
    encryptedFields: EncryptedField[];
    keyRotationSchedule: Date;
    encryptionVersion: number;
    complianceStatus: "compliant" | "needs_attention";
    recommendations: string[];
  }> {
    return {
      encryptedFields: Object.values(EncryptedField),
      keyRotationSchedule: this.getNextKeyRotationDate(),
      encryptionVersion: this.CURRENT_VERSION,
      complianceStatus: "compliant",
      recommendations: [
        "Rotate encryption keys every 90 days",
        "Review and update encrypted fields list quarterly",
        "Test encryption/decryption procedures monthly",
        "Maintain secure key backup and recovery procedures",
      ],
    };
  }

  /**
   * Private helper methods
   */

  private getMasterKey(): Buffer {
    // In production, this would retrieve from secure key management service
    // (AWS KMS, Google Cloud KMS, HashiCorp Vault, etc.)
    const key = process.env.ENCRYPTION_MASTER_KEY;

    if (!key) {
      // Generate a temporary key for development
      console.warn("[Encryption] No master key found, using temporary key");
      return crypto.randomBytes(32);
    }

    return Buffer.from(key, "base64");
  }

  private async deriveFieldKey(field: EncryptedField, salt: Buffer): Promise<Buffer> {
    const cacheKey = `${field}_${salt.toString("base64")}`;

    // Check cache
    const cached = this.keyCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.key;
    }

    // Derive new key
    const key = crypto.pbkdf2Sync(
      this.masterKey,
      Buffer.concat([salt, Buffer.from(field)]),
      KEY_DERIVATION_ITERATIONS,
      32,
      "sha256"
    );

    // Cache key
    this.keyCache.set(cacheKey, {
      key,
      expires: Date.now() + this.KEY_CACHE_TTL,
    });

    return key;
  }

  private generateKeyId(field: EncryptedField): string {
    return `${field}_v${this.CURRENT_VERSION}_${Date.now()}`;
  }

  private validateEncryptedData(data: EncryptedData): void {
    if (!data.encrypted || !data.iv || !data.tag || !data.salt) {
      throw new Error("Invalid encrypted data format");
    }

    if (data.algorithm !== ENCRYPTION_ALGORITHM) {
      throw new Error(`Unsupported encryption algorithm: ${data.algorithm}`);
    }
  }

  private normalizeValue(value: string, field: EncryptedField): string {
    // Normalize value for consistent searching
    let normalized = value.toLowerCase().trim();

    // Field-specific normalization
    switch (field) {
      case EncryptedField.PHONE:
        // Remove non-numeric characters
        normalized = normalized.replace(/\D/g, "");
        break;
      case EncryptedField.TIN:
      case EncryptedField.SSS:
        // Remove dashes and spaces
        normalized = normalized.replace(/[-\s]/g, "");
        break;
    }

    return normalized;
  }

  private getSearchSalt(field: EncryptedField): Buffer {
    // Field-specific salt for search hashing
    // This should be stored securely and consistently
    return Buffer.from(`search_salt_${field}_v1`);
  }

  private detectSensitivePattern(value: any): boolean {
    if (typeof value !== "string") return false;

    // Philippine ID patterns
    const patterns = [
      /^\d{3}-\d{2}-\d{4}$/, // SSS format
      /^\d{12}$/, // TIN format
      /^\d{2}-\d{9}-\d$/, // PhilHealth format
      /^\d{4}-\d{4}-\d{4}-\d{4}$/, // Credit card format
    ];

    return patterns.some((pattern) => pattern.test(value));
  }

  private mapToEncryptedField(fieldName: string): EncryptedField {
    // Map field names to encrypted field types
    const mapping: Record<string, EncryptedField> = {
      tin: EncryptedField.TIN,
      taxIdentificationNumber: EncryptedField.TIN,
      sss: EncryptedField.SSS,
      socialSecurity: EncryptedField.SSS,
      philhealth: EncryptedField.PHILHEALTH,
      pagibig: EncryptedField.PAGIBIG,
      driversLicense: EncryptedField.DRIVERS_LICENSE,
      passport: EncryptedField.PASSPORT,
      votersId: EncryptedField.VOTERS_ID,
      creditCard: EncryptedField.CREDIT_CARD,
      bankAccount: EncryptedField.BANK_ACCOUNT,
      phone: EncryptedField.PHONE,
      address: EncryptedField.ADDRESS,
    };

    return mapping[fieldName] || EncryptedField.CUSTOM_SENSITIVE;
  }

  private isEncryptedData(value: string): boolean {
    try {
      const parsed = JSON.parse(value);
      return parsed.algorithm && parsed.encrypted && parsed.iv && parsed.tag;
    } catch {
      return false;
    }
  }

  private async logEncryption(
    field: EncryptedField,
    context: EncryptionContext,
    success: boolean,
    error?: any
  ): Promise<void> {
    await dpaAuditLogger.logPIAccess({
      userId: context.userId || "system",
      dataSubjectId: context.dataSubjectId,
      piType: context.piType,
      fields: [field],
      purpose: `encryption_${context.purpose}`,
      legalBasis: context.legalBasis,
      projectId: context.projectId,
      success,
    });
  }

  private async logDecryption(
    field: EncryptedField,
    context: EncryptionContext,
    success: boolean,
    error?: any
  ): Promise<void> {
    await dpaAuditLogger.logPIAccess({
      userId: context.userId || "system",
      dataSubjectId: context.dataSubjectId,
      piType: context.piType,
      fields: [field],
      purpose: `decryption_${context.purpose}`,
      legalBasis: context.legalBasis,
      projectId: context.projectId,
      success,
    });
  }

  private getNextKeyRotationDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 90); // 90 days
    return date;
  }

  private startKeyCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.keyCache.entries()) {
        if (value.expires < now) {
          this.keyCache.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }
}

// Export singleton instance
export const fieldEncryptionManager = FieldEncryptionManager.getInstance();

// Export convenience functions
export const encryptField = (value: string, field: EncryptedField, context: EncryptionContext) =>
  fieldEncryptionManager.encryptField(value, field, context);

export const decryptField = (
  encryptedData: EncryptedData,
  field: EncryptedField,
  context: EncryptionContext
) => fieldEncryptionManager.decryptField(encryptedData, field, context);

export const encryptObject = <T extends Record<string, any>>(obj: T, context: EncryptionContext) =>
  fieldEncryptionManager.encryptObject(obj, context);

export const decryptObject = <T extends Record<string, any>>(obj: T, context: EncryptionContext) =>
  fieldEncryptionManager.decryptObject(obj, context);

export const createSearchableHash = (value: string, field: EncryptedField) =>
  fieldEncryptionManager.createSearchableHash(value, field);
