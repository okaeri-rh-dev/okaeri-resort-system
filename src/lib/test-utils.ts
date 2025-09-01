/**
 * Test Utilities for Deterministic Mock Services
 * Provides environment-aware utilities for consistent testing behavior
 */

import type { MockServiceConfig } from "@/test/types/test-interfaces";

// ====================================
// BASE64 UTILITIES (ENVIRONMENT-AWARE)
// ====================================

/**
 * Environment-aware base64 encoding
 * Works in both browser (btoa) and Node.js environments
 */
export function base64Encode(str: string): string {
  if (typeof btoa !== "undefined") {
    // Browser environment
    return btoa(str);
  } else {
    // Node.js environment
    return Buffer.from(str, "utf-8").toString("base64");
  }
}

/**
 * Environment-aware base64 decoding
 * Works in both browser (atob) and Node.js environments
 */
export function base64Decode(str: string): string {
  if (typeof atob !== "undefined") {
    // Browser environment
    return atob(str);
  } else {
    // Node.js environment
    return Buffer.from(str, "base64").toString("utf-8");
  }
}

// ====================================
// DETERMINISTIC RANDOM UTILITIES
// ====================================

/**
 * Seeded random number generator using Linear Congruential Generator (LCG)
 * Provides deterministic pseudo-random numbers for testing
 */
export class SeededRandom {
  private seed: number;
  private readonly a = 1664525; // LCG multiplier
  private readonly c = 1013904223; // LCG increment
  private readonly m = 2 ** 32; // LCG modulus (2^32)

  constructor(seed: string | number) {
    this.seed = typeof seed === "string" ? this.stringToSeed(seed) : seed;
  }

  /**
   * Generate next pseudo-random number between 0 and 1
   */
  next(): number {
    this.seed = (this.a * this.seed + this.c) % this.m;
    return this.seed / this.m;
  }

  /**
   * Generate pseudo-random integer between min and max (inclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Generate pseudo-random boolean
   */
  nextBoolean(): boolean {
    return this.next() < 0.5;
  }

  /**
   * Generate pseudo-random string of given length
   */
  nextString(
    length: number,
    charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  ): string {
    let result = "";
    for (let i = 0; i < length; i++) {
      result += charset.charAt(this.nextInt(0, charset.length - 1));
    }
    return result;
  }

  /**
   * Reset the generator to initial seed
   */
  reset(seed?: string | number): void {
    this.seed = typeof seed === "string" ? this.stringToSeed(seed) : (seed ?? this.seed);
  }

  /**
   * Convert string to numerical seed
   * Uses same algorithm as src/test/setup.ts for consistency
   */
  private stringToSeed(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return hash || 123456789;
  }
}

// ====================================
// DETERMINISTIC DELAY UTILITIES
// ====================================

/**
 * Deterministic delay generator for consistent testing
 */
export class DeterministicDelay {
  private random: SeededRandom;

  constructor(config: MockServiceConfig) {
    this.random = new SeededRandom(config.seed || "default-delay-seed");
  }

  /**
   * Calculate delay based on configuration
   */
  calculate(minMs: number, maxMs: number, deterministic?: boolean): number {
    if (deterministic === false) {
      // Use real Math.random for non-deterministic behavior
      return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    }

    // Use seeded random for deterministic behavior
    return this.random.nextInt(minMs, maxMs);
  }

  /**
   * Execute delay with optional deterministic override
   */
  async execute(minMs: number, maxMs: number, deterministic?: boolean): Promise<void> {
    const delay = this.calculate(minMs, maxMs, deterministic);
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  /**
   * Reset the delay generator with new configuration
   */
  reset(config: MockServiceConfig): void {
    this.random.reset(config.seed || "default-delay-seed");
  }
}

// ====================================
// ERROR SIMULATION UTILITIES
// ====================================

/**
 * Deterministic error simulator for consistent testing
 */
export class DeterministicErrorSimulator {
  private random: SeededRandom;
  private config: MockServiceConfig;

  constructor(config: MockServiceConfig) {
    this.config = config;
    this.random = new SeededRandom(config.seed || "default-error-seed");
  }

  /**
   * Determine if error should be simulated
   */
  shouldSimulateError(scenario?: string): boolean {
    // Force specific scenarios
    if (this.config.forceScenarios && scenario && this.config.forceScenarios.includes(scenario)) {
      return true;
    }

    // Use configured error rate with deterministic random
    if (this.config.deterministic) {
      return this.random.next() < this.config.errorRate;
    }

    // Use real Math.random for non-deterministic behavior
    return Math.random() < this.config.errorRate;
  }

  /**
   * Update configuration
   */
  updateConfig(config: MockServiceConfig): void {
    this.config = config;
    this.random.reset(config.seed || "default-error-seed");
  }

  /**
   * Reset error simulator
   */
  reset(): void {
    this.random.reset(this.config.seed || "default-error-seed");
  }
}

// ====================================
// MOCK TOKEN GENERATION
// ====================================

/**
 * Deterministic JWT-like token generator for testing
 */
export class MockTokenGenerator {
  private random: SeededRandom;

  constructor(seed?: string) {
    this.random = new SeededRandom(seed || "default-token-seed");
  }

  /**
   * Generate mock JWT token
   */
  generateToken(userId: string, role: string, expiresIn: number): string {
    const header = base64Encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));

    const payload = base64Encode(
      JSON.stringify({
        sub: userId,
        role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + expiresIn,
        projectId: "project-1", // Mock project ID
      })
    );

    // Generate deterministic signature using seeded random
    const signature = base64Encode(`mock-signature-${userId}-${this.random.nextString(16)}`);

    return `${header}.${payload}.${signature}`;
  }

  /**
   * Generate mock refresh token
   */
  generateRefreshToken(userId: string): string {
    const randomSuffix = this.random.nextString(12);
    return `refresh-${userId}-${Date.now()}-${randomSuffix}`;
  }

  /**
   * Validate mock token (basic format check)
   */
  isValidToken(token: string): boolean {
    if (!token) return false;

    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        // JWT format
        const payload = JSON.parse(base64Decode(parts[1]));
        return payload.exp > Math.floor(Date.now() / 1000);
      } else if (token.startsWith("refresh-")) {
        // Refresh token format
        return true; // In mock, all refresh tokens are valid
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Extract user ID from token
   */
  extractUserId(token: string): string {
    try {
      if (token.includes(".")) {
        // JWT format
        const parts = token.split(".");
        const payload = JSON.parse(base64Decode(parts[1]));
        return payload.sub;
      } else if (token.startsWith("refresh-")) {
        // Refresh token format
        return token.split("-")[1];
      }
      throw new Error("Invalid token format");
    } catch (error) {
      throw new Error(`Cannot extract user ID from token: ${error.message}`);
    }
  }

  /**
   * Reset token generator with new seed
   */
  reset(seed?: string): void {
    this.random.reset(seed || "default-token-seed");
  }
}

// ====================================
// MOCK SERVICE BASE UTILITIES
// ====================================

/**
 * Base utilities for all mock services
 */
export class MockServiceUtils {
  public delayCalculator: DeterministicDelay;
  public errorSimulator: DeterministicErrorSimulator;
  public tokenGenerator: MockTokenGenerator;
  public config: MockServiceConfig;

  constructor(config: MockServiceConfig) {
    this.config = config;
    this.delayCalculator = new DeterministicDelay(config);
    this.errorSimulator = new DeterministicErrorSimulator(config);
    this.tokenGenerator = new MockTokenGenerator(config.seed);
  }

  /**
   * Execute operation with delay and error simulation
   */
  async executeWithSimulation<T>(
    operation: () => Promise<T>,
    minDelay: number = this.config.networkDelay.min,
    maxDelay: number = this.config.networkDelay.max,
    errorScenario?: string
  ): Promise<T> {
    // Simulate network delay
    await this.delayCalculator.execute(minDelay, maxDelay, this.config.deterministic);

    // Simulate error if configured
    if (this.errorSimulator.shouldSimulateError(errorScenario)) {
      throw new Error(`Simulated error for scenario: ${errorScenario || "generic"}`);
    }

    // Execute the actual operation
    return await operation();
  }

  /**
   * Update configuration and reset all utilities
   */
  updateConfig(config: MockServiceConfig): void {
    this.config = config;
    this.delayCalculator.reset(config);
    this.errorSimulator.updateConfig(config);
    this.tokenGenerator.reset(config.seed);
  }

  /**
   * Reset all utilities to initial state
   */
  reset(): void {
    this.delayCalculator.reset(this.config);
    this.errorSimulator.reset();
    this.tokenGenerator.reset(this.config.seed);
  }
}

// ====================================
// FACTORY FUNCTIONS
// ====================================

/**
 * Create mock service utilities with configuration
 */
export function createMockServiceUtils(config: MockServiceConfig): MockServiceUtils {
  return new MockServiceUtils(config);
}

/**
 * Create seeded random generator
 */
export function createSeededRandom(seed: string): SeededRandom {
  return new SeededRandom(seed);
}

/**
 * Create deterministic delay calculator
 */
export function createDeterministicDelay(config: MockServiceConfig): DeterministicDelay {
  return new DeterministicDelay(config);
}

/**
 * Create error simulator
 */
export function createErrorSimulator(config: MockServiceConfig): DeterministicErrorSimulator {
  return new DeterministicErrorSimulator(config);
}

/**
 * Create token generator
 */
export function createTokenGenerator(seed?: string): MockTokenGenerator {
  return new MockTokenGenerator(seed);
}

// ====================================
// DEFAULT CONFIGURATIONS
// ====================================

/**
 * Default stable configuration for unit tests
 */
export const DEFAULT_STABLE_CONFIG: MockServiceConfig = {
  deterministic: true,
  errorRate: 0,
  networkDelay: { min: 0, max: 10 },
  seed: "stable-test-seed",
  forceScenarios: [],
};

/**
 * Default realistic configuration for integration tests
 */
export const DEFAULT_REALISTIC_CONFIG: MockServiceConfig = {
  deterministic: true,
  errorRate: 0.05,
  networkDelay: { min: 100, max: 300 },
  seed: "realistic-test-seed",
  forceScenarios: [],
};

/**
 * Default development configuration (non-deterministic)
 */
export const DEFAULT_DEVELOPMENT_CONFIG: MockServiceConfig = {
  deterministic: false,
  errorRate: 0.05,
  networkDelay: { min: 200, max: 800 },
  seed: undefined,
  forceScenarios: [],
};

// ====================================
// EXPORTS
// ====================================

export default {
  // Classes
  SeededRandom,
  DeterministicDelay,
  DeterministicErrorSimulator,
  MockTokenGenerator,
  MockServiceUtils,

  // Utility functions
  base64Encode,
  base64Decode,
  createMockServiceUtils,
  createSeededRandom,
  createDeterministicDelay,
  createErrorSimulator,
  createTokenGenerator,

  // Default configurations
  DEFAULT_STABLE_CONFIG,
  DEFAULT_REALISTIC_CONFIG,
  DEFAULT_DEVELOPMENT_CONFIG,
};
