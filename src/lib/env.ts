/**
 * Environment Variable Validation for Okaeri Resort System
 * Phase 5.2 Day 3 - Enhanced with Secrets Management & Rotation
 *
 * Features:
 * - Comprehensive secret validation and rotation tracking
 * - Philippine business compliance monitoring
 * - Automated rotation intervals with notifications
 * - Integration with Redis for secret age tracking
 * - Production-ready secret strength validation
 */

import { z } from "zod";
import { logger } from "./logger";
import { getRedisClient } from "./cache/redis";
import { isServer, getEnvVar, getEnvMode } from "./env-client";

// Define the schema for all environment variables
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Database configuration
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .url("DATABASE_URL must be a valid URL")
    .refine(
      (url) => url.startsWith("postgres://") || url.startsWith("postgresql://"),
      "DATABASE_URL must be a PostgreSQL connection string"
    ),

  // Authentication secrets
  NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET must be at least 32 characters").optional(),

  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL").optional(),

  // JWT configuration
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters").optional(),

  // Cloudflare R2 (optional for file storage)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),

  // Email configuration (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),

  // Payment gateway (optional - for future GCash integration)
  GCASH_CLIENT_ID: z.string().optional(),
  GCASH_CLIENT_SECRET: z.string().optional(),

  // API rate limiting (optional)
  RATE_LIMIT_MAX: z.string().transform(Number).default("100"),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default("900000"), // 15 minutes

  // Upstash Redis (optional - for rate limiting)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Vercel specific (optional)
  VERCEL_URL: z.string().optional(),
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),

  // Feature flags (optional)
  ENABLE_ANALYTICS: z.string().transform(Boolean).default("false"),
  ENABLE_PWA: z.string().transform(Boolean).default("true"),
  ENABLE_OFFLINE_MODE: z.string().transform(Boolean).default("true"),
});

// Export the validated environment type
export type Env = z.infer<typeof envSchema>;

/**
 * Secrets Rotation Configuration for Okaeri Resort System
 * Rotation intervals optimized for small family business operations
 */
export interface SecretRotationConfig {
  name: string;
  rotationIntervalDays: number;
  warningDays: number;
  criticalDays: number;
  strengthRequirements: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    excludeCommonPatterns: boolean;
  };
  complianceRequirements?: {
    philippineDPA?: boolean;
    birCompliance?: boolean;
    bspCircular808?: boolean;
  };
}

export interface SecretRotationStatus {
  secretName: string;
  lastRotated: number;
  nextRotation: number;
  daysUntilRotation: number;
  status: "healthy" | "warning" | "critical" | "expired";
  strengthScore: number;
  complianceStatus: "compliant" | "warning" | "non-compliant";
  lastChecked: number;
}

export interface SecretRotationNotification {
  type: "warning" | "critical" | "expired" | "compliance";
  secretName: string;
  message: string;
  daysRemaining: number;
  actionRequired: string;
  complianceContext?: {
    regulation: string;
    requirement: string;
    deadline?: number;
  };
}

/**
 * Philippine Business Compliance Secret Requirements
 * Optimized for resort operations and regulatory compliance
 */
export const PHILIPPINE_COMPLIANCE_SECRETS: Record<string, SecretRotationConfig> = {
  JWT_SECRET: {
    name: "JWT Authentication Secret",
    rotationIntervalDays: 30, // Monthly rotation for high-security auth tokens
    warningDays: 7,
    criticalDays: 3,
    strengthRequirements: {
      minLength: 64, // Strong JWT secrets for guest data protection
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      excludeCommonPatterns: true,
    },
    complianceRequirements: {
      philippineDPA: true, // Data Privacy Act compliance
      birCompliance: false,
      bspCircular808: true, // Payment security compliance
    },
  },

  DATABASE_URL: {
    name: "Database Connection Secret",
    rotationIntervalDays: 90, // Quarterly rotation for operational stability
    warningDays: 14,
    criticalDays: 7,
    strengthRequirements: {
      minLength: 32,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      excludeCommonPatterns: true,
    },
    complianceRequirements: {
      philippineDPA: true,
      birCompliance: true, // BIR financial data protection
      bspCircular808: false,
    },
  },

  UPSTASH_REDIS_REST_TOKEN: {
    name: "Redis Cache Access Token",
    rotationIntervalDays: 60, // Bi-monthly rotation for session management
    warningDays: 10,
    criticalDays: 5,
    strengthRequirements: {
      minLength: 32,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false, // API tokens may not support special chars
      excludeCommonPatterns: true,
    },
    complianceRequirements: {
      philippineDPA: true,
      birCompliance: false,
      bspCircular808: false,
    },
  },

  NEXTAUTH_SECRET: {
    name: "NextAuth Session Secret",
    rotationIntervalDays: 30,
    warningDays: 7,
    criticalDays: 3,
    strengthRequirements: {
      minLength: 32,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      excludeCommonPatterns: true,
    },
    complianceRequirements: {
      philippineDPA: true,
      birCompliance: false,
      bspCircular808: true,
    },
  },

  GCASH_CLIENT_SECRET: {
    name: "GCash Payment Gateway Secret",
    rotationIntervalDays: 45, // More frequent for payment processing
    warningDays: 10,
    criticalDays: 5,
    strengthRequirements: {
      minLength: 32,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      excludeCommonPatterns: true,
    },
    complianceRequirements: {
      philippineDPA: true,
      birCompliance: true, // Payment data for BIR reporting
      bspCircular808: true, // BSP electronic payment compliance
    },
  },

  SMTP_PASSWORD: {
    name: "Email Service Password",
    rotationIntervalDays: 60,
    warningDays: 10,
    criticalDays: 5,
    strengthRequirements: {
      minLength: 16,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      excludeCommonPatterns: true,
    },
    complianceRequirements: {
      philippineDPA: true, // Email contains guest communications
      birCompliance: false,
      bspCircular808: false,
    },
  },

  R2_SECRET_ACCESS_KEY: {
    name: "Cloudflare R2 Storage Secret",
    rotationIntervalDays: 90,
    warningDays: 14,
    criticalDays: 7,
    strengthRequirements: {
      minLength: 32,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      excludeCommonPatterns: true,
    },
    complianceRequirements: {
      philippineDPA: true, // File storage may contain personal data
      birCompliance: true, // Financial documents storage
      bspCircular808: false,
    },
  },
} as const;

class EnvironmentValidator {
  private _env: Env | null = null;
  private _isValidated = false;
  private redis = getRedisClient();
  private secretsRotationCache: Map<string, SecretRotationStatus> = new Map();

  /**
   * Validate environment variables
   */
  validate(): Env {
    if (this._isValidated && this._env) {
      return this._env;
    }

    logger.info("Validating environment variables...");

    try {
      // Parse and validate environment variables
      // In browser, create a limited env object with only VITE_ prefixed vars
      const envObject = isServer
        ? process.env
        : Object.keys(import.meta.env).reduce(
            (acc, key) => {
              acc[key] = import.meta.env[key];
              return acc;
            },
            {} as Record<string, any>
          );

      this._env = envSchema.parse(envObject);
      this._isValidated = true;

      // Log successful validation in development
      if (this._env.NODE_ENV === "development") {
        logger.debug("Environment validation successful", {
          nodeEnv: this._env.NODE_ENV,
          hasDatabase: !!this._env.DATABASE_URL,
          hasAuth: !!this._env.NEXTAUTH_SECRET,
          hasStorage: !!this._env.R2_ACCOUNT_ID,
          hasEmail: !!this._env.SMTP_HOST,
        });
      }

      return this._env;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const missingVars = error.errors
          .map((err) => `${err.path.join(".")}: ${err.message}`)
          .join("\n  ");

        const errorMessage = `Environment validation failed:\n  ${missingVars}`;

        logger.error("Environment validation failed", {
          errors: error.errors,
          missingVariables: error.errors.map((e) => e.path.join(".")),
        });

        // In development, provide helpful guidance
        if (getEnvMode() === "development") {
          logger.info("💡 Environment Setup Guide:", {
            message: "Create a .env.local file with the following required variables:",
            required: [
              "DATABASE_URL=postgresql://username:password@host:port/database",
              "NEXTAUTH_SECRET=your-32-character-secret-here",
              "NEXTAUTH_URL=http://localhost:3000",
            ],
            optional: [
              "R2_ACCOUNT_ID=your-cloudflare-r2-account-id",
              "R2_ACCESS_KEY_ID=your-r2-access-key",
              "R2_SECRET_ACCESS_KEY=your-r2-secret-key",
              "R2_BUCKET_NAME=your-bucket-name",
            ],
          });
        }

        throw new Error(errorMessage);
      }

      logger.error("Unexpected error during environment validation", error as Error);
      throw error;
    }
  }

  /**
   * Get validated environment variables (lazy validation)
   */
  get env(): Env {
    if (!this._isValidated || !this._env) {
      return this.validate();
    }
    return this._env;
  }

  /**
   * Check if running in production
   */
  get isProduction(): boolean {
    return this.env.NODE_ENV === "production";
  }

  /**
   * Check if running in development
   */
  get isDevelopment(): boolean {
    return this.env.NODE_ENV === "development";
  }

  /**
   * Check if running in test
   */
  get isTest(): boolean {
    return this.env.NODE_ENV === "test";
  }

  /**
   * Get database URL with validation
   */
  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(
    feature: keyof Pick<Env, "ENABLE_ANALYTICS" | "ENABLE_PWA" | "ENABLE_OFFLINE_MODE">
  ): boolean {
    return this.env[feature] as boolean;
  }

  /**
   * Get CORS origin for the current environment
   */
  get corsOrigin(): string | string[] {
    if (this.isDevelopment) {
      return ["http://localhost:3000", "http://127.0.0.1:3000"];
    }

    if (this.env.VERCEL_URL) {
      // For production, only allow the specific Vercel URL (no wildcard)
      return [`https://${this.env.VERCEL_URL}`];
    }

    // Default production origins - specific domain only
    return ["https://okaeri-resort.vercel.app"];
  }

  /**
   * Validate secret strength according to Philippine compliance requirements
   */
  private validateSecretStrength(secret: string, config: SecretRotationConfig): number {
    let score = 0;
    const requirements = config.strengthRequirements;

    // Length check (0-30 points)
    if (secret.length >= requirements.minLength) {
      score += 30;
    } else {
      score += (secret.length / requirements.minLength) * 30;
    }

    // Character variety checks (10 points each)
    if (requirements.requireUppercase && /[A-Z]/.test(secret)) score += 10;
    if (requirements.requireLowercase && /[a-z]/.test(secret)) score += 10;
    if (requirements.requireNumbers && /[0-9]/.test(secret)) score += 10;
    if (requirements.requireSpecialChars && /[!@#$%^&*(),.?":{}|<>]/.test(secret)) score += 10;

    // Common pattern checks (20 points)
    if (requirements.excludeCommonPatterns) {
      const commonPatterns = [
        /^(.)\1+$/, // Same character repeated
        /123|abc|password|secret|admin|guest|okaeri/i, // Common words
        /^.*(.)(.)(.).*\3\2\1.*$/, // Palindromes
      ];

      const hasCommonPattern = commonPatterns.some((pattern) => pattern.test(secret));
      if (!hasCommonPattern) {
        score += 20;
      }
    } else {
      score += 20; // Full points if pattern checking not required
    }

    // Entropy bonus (10 points for high entropy)
    const entropy = this.calculateEntropy(secret);
    if (entropy > 4) score += 10;

    return Math.min(100, score);
  }

  /**
   * Calculate Shannon entropy of a string
   */
  private calculateEntropy(str: string): number {
    const charCounts = new Map<string, number>();
    for (const char of str) {
      charCounts.set(char, (charCounts.get(char) || 0) + 1);
    }

    let entropy = 0;
    const length = str.length;
    for (const count of charCounts.values()) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  /**
   * Check and update secret rotation status
   */
  async checkSecretRotationStatus(secretName: string): Promise<SecretRotationStatus> {
    const config = PHILIPPINE_COMPLIANCE_SECRETS[secretName];
    if (!config) {
      throw new Error(`No rotation configuration found for secret: ${secretName}`);
    }

    const secret = this.env[secretName as keyof Env] as string;
    if (!secret) {
      throw new Error(`Secret ${secretName} is not configured`);
    }

    // Check Redis for last rotation timestamp
    const rotationKey = `secret_rotation:${secretName}`;
    const lastRotatedStr = await this.redis.get(rotationKey);
    const lastRotated = lastRotatedStr ? parseInt(lastRotatedStr) : Date.now();

    // Calculate rotation dates
    const rotationInterval = config.rotationIntervalDays * 24 * 60 * 60 * 1000;
    const nextRotation = lastRotated + rotationInterval;
    const now = Date.now();
    const daysUntilRotation = Math.ceil((nextRotation - now) / (24 * 60 * 60 * 1000));

    // Determine status
    let status: SecretRotationStatus["status"] = "healthy";
    if (daysUntilRotation < 0) {
      status = "expired";
    } else if (daysUntilRotation <= config.criticalDays) {
      status = "critical";
    } else if (daysUntilRotation <= config.warningDays) {
      status = "warning";
    }

    // Validate strength
    const strengthScore = this.validateSecretStrength(secret, config);

    // Check compliance
    const complianceStatus = this.checkComplianceStatus(config, strengthScore, daysUntilRotation);

    const rotationStatus: SecretRotationStatus = {
      secretName,
      lastRotated,
      nextRotation,
      daysUntilRotation,
      status,
      strengthScore,
      complianceStatus,
      lastChecked: now,
    };

    // Cache the status
    this.secretsRotationCache.set(secretName, rotationStatus);

    // Log in production for audit trail
    if (this.isProduction && (status === "critical" || status === "expired")) {
      logger.warn(`Secret rotation required for ${config.name}`, {
        secretName,
        status,
        daysUntilRotation,
        strengthScore,
        complianceStatus,
      });
    }

    return rotationStatus;
  }

  /**
   * Check compliance status based on Philippine regulations
   */
  private checkComplianceStatus(
    config: SecretRotationConfig,
    strengthScore: number,
    daysUntilRotation: number
  ): "compliant" | "warning" | "non-compliant" {
    // Minimum strength requirement for compliance
    if (strengthScore < 70) {
      return "non-compliant";
    }

    // Philippine DPA compliance - stronger requirements
    if (config.complianceRequirements?.philippineDPA && strengthScore < 85) {
      return "non-compliant";
    }

    // BSP Circular 808 compliance - payment security
    if (config.complianceRequirements?.bspCircular808 && strengthScore < 90) {
      return "non-compliant";
    }

    // Warning for upcoming expiration with compliance requirements
    if (config.complianceRequirements && daysUntilRotation <= config.warningDays) {
      return "warning";
    }

    return "compliant";
  }

  /**
   * Get all secrets rotation status
   */
  async getAllSecretsRotationStatus(): Promise<SecretRotationStatus[]> {
    const statuses = await Promise.allSettled(
      Object.keys(PHILIPPINE_COMPLIANCE_SECRETS).map((secretName) =>
        this.checkSecretRotationStatus(secretName)
      )
    );

    return statuses
      .filter(
        (result): result is PromiseFulfilledResult<SecretRotationStatus> =>
          result.status === "fulfilled"
      )
      .map((result) => result.value);
  }

  /**
   * Get rotation notifications for admin dashboard
   */
  async getRotationNotifications(): Promise<SecretRotationNotification[]> {
    const statuses = await this.getAllSecretsRotationStatus();
    const notifications: SecretRotationNotification[] = [];

    for (const status of statuses) {
      const config = PHILIPPINE_COMPLIANCE_SECRETS[status.secretName];

      // Expired secrets
      if (status.status === "expired") {
        notifications.push({
          type: "expired",
          secretName: status.secretName,
          message: `${config.name} has expired and must be rotated immediately`,
          daysRemaining: status.daysUntilRotation,
          actionRequired: "Rotate secret immediately to maintain security",
          complianceContext: this.getComplianceContext(config),
        });
      }

      // Critical warnings
      if (status.status === "critical") {
        notifications.push({
          type: "critical",
          secretName: status.secretName,
          message: `${config.name} expires in ${status.daysUntilRotation} days`,
          daysRemaining: status.daysUntilRotation,
          actionRequired: "Schedule secret rotation within next 24 hours",
          complianceContext: this.getComplianceContext(config),
        });
      }

      // Warning notifications
      if (status.status === "warning") {
        notifications.push({
          type: "warning",
          secretName: status.secretName,
          message: `${config.name} should be rotated soon (${status.daysUntilRotation} days remaining)`,
          daysRemaining: status.daysUntilRotation,
          actionRequired: "Plan secret rotation within the next week",
          complianceContext: this.getComplianceContext(config),
        });
      }

      // Compliance warnings
      if (status.complianceStatus === "non-compliant") {
        notifications.push({
          type: "compliance",
          secretName: status.secretName,
          message: `${config.name} does not meet Philippine compliance requirements`,
          daysRemaining: status.daysUntilRotation,
          actionRequired: "Update secret to meet compliance standards",
          complianceContext: this.getComplianceContext(config),
        });
      }
    }

    // Sort by severity: expired > critical > compliance > warning
    const severityOrder = { expired: 0, critical: 1, compliance: 2, warning: 3 };
    notifications.sort((a, b) => severityOrder[a.type] - severityOrder[b.type]);

    return notifications;
  }

  /**
   * Get compliance context for notifications
   */
  private getComplianceContext(config: SecretRotationConfig) {
    if (config.complianceRequirements?.philippineDPA) {
      return {
        regulation: "Philippine Data Privacy Act of 2012",
        requirement: "Adequate security measures for personal data protection",
        deadline: undefined,
      };
    }
    if (config.complianceRequirements?.bspCircular808) {
      return {
        regulation: "BSP Circular No. 808",
        requirement: "Electronic payment security standards",
        deadline: undefined,
      };
    }
    if (config.complianceRequirements?.birCompliance) {
      return {
        regulation: "BIR Revenue Regulations",
        requirement: "Secure storage of financial and tax records",
        deadline: undefined,
      };
    }
    return undefined;
  }

  /**
   * Record secret rotation in Redis for tracking
   */
  async recordSecretRotation(secretName: string): Promise<void> {
    if (!PHILIPPINE_COMPLIANCE_SECRETS[secretName]) {
      throw new Error(`No rotation configuration found for secret: ${secretName}`);
    }

    const rotationKey = `secret_rotation:${secretName}`;
    const now = Date.now();

    try {
      await this.redis.set(rotationKey, now.toString(), "EX", 365 * 24 * 60 * 60); // Store for 1 year

      // Update cache
      if (this.secretsRotationCache.has(secretName)) {
        const status = this.secretsRotationCache.get(secretName)!;
        const config = PHILIPPINE_COMPLIANCE_SECRETS[secretName];
        const rotationInterval = config.rotationIntervalDays * 24 * 60 * 60 * 1000;

        status.lastRotated = now;
        status.nextRotation = now + rotationInterval;
        status.daysUntilRotation = config.rotationIntervalDays;
        status.status = "healthy";
        status.lastChecked = now;
      }

      logger.info(`Secret rotation recorded for ${secretName}`, {
        secretName,
        rotatedAt: now,
        environment: this.env.NODE_ENV,
      });
    } catch (error) {
      logger.error(`Failed to record secret rotation for ${secretName}`, error as Error);
      throw error;
    }
  }

  /**
   * Initialize secrets rotation monitoring (call during app startup)
   */
  async initializeSecretsRotationMonitoring(): Promise<void> {
    if (this.isTest) {
      return; // Skip in test environment
    }

    try {
      // Check all secrets on startup
      const statuses = await this.getAllSecretsRotationStatus();
      const criticalSecrets = statuses.filter(
        (s) => s.status === "expired" || s.status === "critical"
      );

      if (criticalSecrets.length > 0) {
        logger.warn("Critical secrets requiring immediate attention detected", {
          criticalSecrets: criticalSecrets.map((s) => ({
            name: s.secretName,
            status: s.status,
            daysRemaining: s.daysUntilRotation,
          })),
        });
      }

      // Schedule periodic checks (every 6 hours in production)
      if (this.isProduction) {
        setInterval(
          async () => {
            try {
              const notifications = await this.getRotationNotifications();
              if (notifications.length > 0) {
                logger.info("Secrets rotation notifications available", {
                  count: notifications.length,
                  notifications: notifications.map((n) => ({
                    type: n.type,
                    secret: n.secretName,
                    daysRemaining: n.daysRemaining,
                  })),
                });
              }
            } catch (error) {
              logger.error("Error during periodic secrets rotation check", error as Error);
            }
          },
          6 * 60 * 60 * 1000
        ); // 6 hours
      }
    } catch (error) {
      logger.warn("Failed to initialize secrets rotation monitoring", error as Error);
    }
  }
}

// Create singleton instance
const envValidator = new EnvironmentValidator();

// Export validated environment
export const { env } = envValidator;

// Export utility functions
export const {
  isProduction,
  isDevelopment,
  isTest,
  databaseUrl,
  corsOrigin,
  isFeatureEnabled,
  checkSecretRotationStatus,
  getAllSecretsRotationStatus,
  getRotationNotifications,
  recordSecretRotation,
  initializeSecretsRotationMonitoring,
} = envValidator;

// Export validator instance for advanced usage
export { envValidator };

// Validate environment on module load in non-test environments
if (getEnvMode() !== "test") {
  try {
    envValidator.validate();

    // Initialize secrets rotation monitoring after validation
    envValidator.initializeSecretsRotationMonitoring().catch((error) => {
      logger.warn("Failed to initialize secrets rotation monitoring", error as Error);
    });
  } catch (error) {
    // In production, fail fast
    if (getEnvMode() === "production") {
      logger.error("Environment validation failed in production. Exiting...", error as Error);
      process.exit(1);
    } else {
      // In development, warn but allow the app to start
      logger.warn(
        "Environment validation failed in development. Some features may not work correctly."
      );
    }
  }
}
