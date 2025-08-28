/**
 * Environment Variable Validation for Okaeri Resort System
 * Validates and provides type-safe access to environment variables
 */

import { z } from "zod";
import { logger } from "./logger";

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

class EnvironmentValidator {
  private _env: Env | null = null;
  private _isValidated = false;

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
      this._env = envSchema.parse(process.env);
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
        if (process.env.NODE_ENV === "development") {
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
      return [`https://${this.env.VERCEL_URL}`, "https://*.vercel.app"];
    }

    // Default production origins
    return ["https://okaeri-resort.vercel.app"];
  }
}

// Create singleton instance
const envValidator = new EnvironmentValidator();

// Export validated environment
export const { env } = envValidator;

// Export utility functions
export const { isProduction, isDevelopment, isTest, databaseUrl, corsOrigin, isFeatureEnabled } =
  envValidator;

// Export validator instance for advanced usage
export { envValidator };

// Validate environment on module load in non-test environments
if (process.env.NODE_ENV !== "test") {
  try {
    envValidator.validate();
  } catch (error) {
    // In production, fail fast
    if (process.env.NODE_ENV === "production") {
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
