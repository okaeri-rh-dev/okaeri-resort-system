/**
 * Service Factory
 * Creates the appropriate service implementation (mock or real) based on configuration
 * Enables seamless switching between development and production environments
 */

import { config } from "@/config";
import type { BaseService } from "./base.service";
import type { MockServiceConfig } from "@/test/types/test-interfaces";
import { getEnvironmentConfig } from "@/test/config/mock-service-config";

/**
 * Service type definitions for factory
 */
export type ServiceType =
  | "auth"
  | "booking"
  | "guest"
  | "expense"
  | "property"
  | "payment"
  | "report"
  | "user"
  | "project";

/**
 * Service implementation type
 */
export type ServiceImplementation = "mock" | "api";

/**
 * Service factory options
 */
export interface ServiceFactoryOptions {
  /** Force a specific implementation type */
  forceImplementation?: ServiceImplementation;
  /** Mock service configuration for deterministic testing */
  mockConfig?: MockServiceConfig;
  /** Additional configuration for the service */
  config?: Record<string, any>;
}

/**
 * Service cache entry
 */
interface CacheEntry {
  service: any;
  timestamp: number;
  accessCount: number;
}

/**
 * Service cache manager with TTL and size limits
 */
class ServiceCacheManager {
  private cache = new Map<string, CacheEntry>();
  private readonly MAX_CACHE_SIZE = 50;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  get(key: string): any {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if cache entry has expired
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return undefined;
    }

    entry.accessCount++;
    return entry.service;
  }

  set(key: string, service: any): void {
    // Clean up old entries if cache is getting full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.cleanup();
    }

    this.cache.set(key, {
      service,
      timestamp: Date.now(),
      accessCount: 0,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  private cleanup(): void {
    const now = Date.now();

    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }

    // If still too full, remove least recently accessed
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries()).sort(
        ([, a], [, b]) => a.accessCount - b.accessCount
      );

      // Remove bottom 30% least accessed entries
      const toRemove = Math.floor(this.MAX_CACHE_SIZE * 0.3);
      for (let i = 0; i < toRemove && i < entries.length; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }
}

/**
 * Singleton service instance cache
 */
const serviceCache = new ServiceCacheManager();

/**
 * Determine which implementation to use based on configuration
 */
function getImplementationType(
  serviceName: ServiceType,
  options?: ServiceFactoryOptions
): ServiceImplementation {
  // 1. Check if forced implementation
  if (options?.forceImplementation) {
    return options.forceImplementation;
  }

  // 2. Check service-specific feature flag
  const serviceFeatureFlag = `mock${serviceName.charAt(0).toUpperCase()}${serviceName.slice(1)}`;
  if ((config.features as any)[serviceFeatureFlag] !== undefined) {
    return (config.features as any)[serviceFeatureFlag] ? "mock" : "api";
  }

  // 3. Check global mock flag
  if (config.development.enableMockData) {
    return "mock";
  }

  // 4. Default based on environment
  return config.app.isDevelopment ? "mock" : "api";
}

/**
 * Create or retrieve a service instance
 * @template T - The entity type
 * @template CreateDTO - The create DTO type
 * @template UpdateDTO - The update DTO type
 */
export async function createService<T, CreateDTO, UpdateDTO>(
  serviceName: ServiceType,
  options?: ServiceFactoryOptions
): Promise<BaseService<T, CreateDTO, UpdateDTO>> {
  const implementationType = getImplementationType(serviceName, options);
  const cacheKey = `${serviceName}-${implementationType}`;

  // Check cache first
  const cachedService = serviceCache.get(cacheKey);
  if (cachedService && !options?.forceImplementation) {
    return cachedService;
  }

  let service: BaseService<T, CreateDTO, UpdateDTO>;

  try {
    if (implementationType === "mock") {
      // Dynamically import mock service
      const mockModule = await import(`./mock/${serviceName}.mock.service`);
      const MockServiceClass =
        mockModule.default || mockModule[`Mock${capitalize(serviceName)}Service`];

      // CRITICAL: Validate service class exists and is a constructor
      if (!MockServiceClass || typeof MockServiceClass !== "function") {
        throw new Error(`Mock service class not found or invalid for ${serviceName}`);
      }

      // Use mock configuration with fallback to environment config
      const mockConfig = options?.mockConfig || getEnvironmentConfig();
      service = new MockServiceClass(mockConfig);

      // Log configuration for debugging
      if (config.app.isDevelopment) {
        console.log(
          `[ServiceFactory] Created mock service ${serviceName} with deterministic=${mockConfig.deterministic}, errorRate=${mockConfig.errorRate}`
        );
      }

      // Validate service implements required interface
      if (!service || typeof service.list !== "function" || typeof service.get !== "function") {
        throw new Error(`Mock service ${serviceName} does not implement BaseService interface`);
      }
    } else {
      // Dynamically import API service
      const apiModule = await import(`./api/${serviceName}.api.service`);
      const ApiServiceClass =
        apiModule.default || apiModule[`${capitalize(serviceName)}ApiService`];

      // CRITICAL: Validate service class exists and is a constructor
      if (!ApiServiceClass || typeof ApiServiceClass !== "function") {
        throw new Error(`API service class not found or invalid for ${serviceName}`);
      }

      service = new ApiServiceClass(options?.config);

      // Validate service implements required interface
      if (!service || typeof service.list !== "function" || typeof service.get !== "function") {
        throw new Error(`API service ${serviceName} does not implement BaseService interface`);
      }
    }

    // Cache the instance
    if (!options?.forceImplementation) {
      serviceCache.set(cacheKey, service);
    }

    // Log service creation in development
    if (config.app.isDevelopment) {
      console.log(`[ServiceFactory] Created ${implementationType} service for ${serviceName}`);
    }

    return service;
  } catch (error) {
    console.error(`[ServiceFactory] Failed to create service ${serviceName}:`, error);

    // Fall back to mock service if API service fails in development
    if (config.app.isDevelopment && implementationType === "api") {
      console.warn(`[ServiceFactory] Falling back to mock service for ${serviceName}`);
      return createService<T, CreateDTO, UpdateDTO>(serviceName, {
        ...options,
        forceImplementation: "mock",
        mockConfig: options?.mockConfig || getEnvironmentConfig(),
      });
    }

    throw error;
  }
}

/**
 * Clear the service cache (useful for testing)
 */
export function clearServiceCache(): void {
  serviceCache.clear();
}

/**
 * Get all cached services (useful for debugging)
 */
export function getCachedServices(): string[] {
  return serviceCache.keys();
}

/**
 * Preload services for better performance
 */
export async function preloadServices(
  services: ServiceType[],
  options?: ServiceFactoryOptions
): Promise<void> {
  const promises = services.map((serviceName) =>
    createService(serviceName, options).catch((error) => {
      console.error(`[ServiceFactory] Failed to preload ${serviceName}:`, error);
    })
  );

  await Promise.all(promises);
}

/**
 * Utility function to capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Service factory convenience functions for specific services
 */
export const ServiceFactory = {
  auth: <T, CreateDTO, UpdateDTO>(options?: ServiceFactoryOptions) =>
    createService<T, CreateDTO, UpdateDTO>("auth", options),

  booking: <T, CreateDTO, UpdateDTO>(options?: ServiceFactoryOptions) =>
    createService<T, CreateDTO, UpdateDTO>("booking", options),

  guest: <T, CreateDTO, UpdateDTO>(options?: ServiceFactoryOptions) =>
    createService<T, CreateDTO, UpdateDTO>("guest", options),

  expense: <T, CreateDTO, UpdateDTO>(options?: ServiceFactoryOptions) =>
    createService<T, CreateDTO, UpdateDTO>("expense", options),

  property: <T, CreateDTO, UpdateDTO>(options?: ServiceFactoryOptions) =>
    createService<T, CreateDTO, UpdateDTO>("property", options),

  payment: <T, CreateDTO, UpdateDTO>(options?: ServiceFactoryOptions) =>
    createService<T, CreateDTO, UpdateDTO>("payment", options),

  report: <T, CreateDTO, UpdateDTO>(options?: ServiceFactoryOptions) =>
    createService<T, CreateDTO, UpdateDTO>("report", options),

  user: <T, CreateDTO, UpdateDTO>(options?: ServiceFactoryOptions) =>
    createService<T, CreateDTO, UpdateDTO>("user", options),

  project: <T, CreateDTO, UpdateDTO>(options?: ServiceFactoryOptions) =>
    createService<T, CreateDTO, UpdateDTO>("project", options),
} as const;
