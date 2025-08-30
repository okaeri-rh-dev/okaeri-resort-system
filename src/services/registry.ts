/**
 * Service Registry - Type-safe service factory for Vite-compatible service creation
 *
 * This registry provides explicit service mapping without dynamic imports that
 * can break with Vite bundling. It ensures type-safe service creation and clear
 * separation between mock and real service implementations.
 *
 * @fileoverview Service registry with explicit service mapping for Vite compatibility
 */

import { getApiMode, isUsingMocks, environment, logger } from "@/config/environment";
import type { BaseService } from "./base.service";
import type { MockServiceConfig } from "@/test/types/test-interfaces";
import { getEnvironmentConfig } from "@/test/config/mock-service-config";

// Import mock services explicitly (Vite-friendly)
import { MockAuthService } from "./mock/auth.mock.service";
import { MockBookingService } from "./mock/booking.mock.service";

// Import API services explicitly (when implemented)
// import { AuthApiService } from './api/auth.api.service';
// import { BookingApiService } from './api/booking.api.service';

/**
 * Service type definitions
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
 * Service implementation mode
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
  /** Skip caching for this service instance */
  skipCache?: boolean;
}

/**
 * Service constructor interface
 */
interface ServiceConstructor<T = any, CreateDTO = any, UpdateDTO = any> {
  new (config?: MockServiceConfig | Record<string, any>): BaseService<T, CreateDTO, UpdateDTO>;
}

/**
 * Service cache entry
 */
interface CacheEntry<T = any, CreateDTO = any, UpdateDTO = any> {
  service: BaseService<T, CreateDTO, UpdateDTO>;
  timestamp: number;
  accessCount: number;
  implementation: ServiceImplementation;
}

/**
 * Mock service registry - explicit mapping for Vite compatibility
 */
const mockServices: Record<ServiceType, ServiceConstructor | null> = {
  auth: MockAuthService,
  booking: MockBookingService,
  guest: null, // Not implemented yet
  expense: null, // Not implemented yet
  property: null, // Not implemented yet
  payment: null, // Not implemented yet
  report: null, // Not implemented yet
  user: null, // Not implemented yet
  project: null, // Not implemented yet
};

/**
 * API service registry - explicit mapping for Vite compatibility
 */
const apiServices: Record<ServiceType, ServiceConstructor | null> = {
  auth: null, // Not implemented yet - will be AuthApiService
  booking: null, // Not implemented yet - will be BookingApiService
  guest: null, // Not implemented yet
  expense: null, // Not implemented yet
  property: null, // Not implemented yet
  payment: null, // Not implemented yet
  report: null, // Not implemented yet
  user: null, // Not implemented yet
  project: null, // Not implemented yet
};

/**
 * Service cache manager with TTL and size limits
 */
class ServiceCacheManager {
  private cache = new Map<string, CacheEntry>();
  private readonly MAX_CACHE_SIZE = 20;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  get<T = any, CreateDTO = any, UpdateDTO = any>(
    key: string
  ): BaseService<T, CreateDTO, UpdateDTO> | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if cache entry has expired
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return undefined;
    }

    entry.accessCount++;
    return entry.service as BaseService<T, CreateDTO, UpdateDTO>;
  }

  set<T = any, CreateDTO = any, UpdateDTO = any>(
    key: string,
    service: BaseService<T, CreateDTO, UpdateDTO>,
    implementation: ServiceImplementation
  ): void {
    // Clean up old entries if cache is getting full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.cleanup();
    }

    this.cache.set(key, {
      service,
      timestamp: Date.now(),
      accessCount: 0,
      implementation,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  getStats(): { size: number; implementations: Record<ServiceImplementation, number> } {
    const implementations = { mock: 0, api: 0 };
    for (const entry of this.cache.values()) {
      implementations[entry.implementation]++;
    }

    return {
      size: this.cache.size,
      implementations,
    };
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
 * Singleton service cache
 */
const serviceCache = new ServiceCacheManager();

/**
 * Determine which implementation to use based on configuration and availability
 */
function determineImplementation(
  serviceName: ServiceType,
  options?: ServiceFactoryOptions
): ServiceImplementation {
  // 1. Check if forced implementation
  if (options?.forceImplementation) {
    return options.forceImplementation;
  }

  // 2. Use environment configuration
  return isUsingMocks() ? "mock" : "api";
}

/**
 * Get service constructor from registry
 */
function getServiceConstructor<T = any, CreateDTO = any, UpdateDTO = any>(
  serviceName: ServiceType,
  implementation: ServiceImplementation
): ServiceConstructor<T, CreateDTO, UpdateDTO> | null {
  const registry = implementation === "mock" ? mockServices : apiServices;
  return registry[serviceName] as ServiceConstructor<T, CreateDTO, UpdateDTO> | null;
}

/**
 * Create or retrieve a service instance with type safety
 *
 * @template T - The entity type
 * @template CreateDTO - The create DTO type
 * @template UpdateDTO - The update DTO type
 * @param serviceName - The service name to create
 * @param options - Service creation options
 * @returns Promise resolving to the service instance
 */
export async function createService<T = any, CreateDTO = any, UpdateDTO = any>(
  serviceName: ServiceType,
  options?: ServiceFactoryOptions
): Promise<BaseService<T, CreateDTO, UpdateDTO>> {
  const implementation = determineImplementation(serviceName, options);
  const cacheKey = `${serviceName}-${implementation}`;

  // Check cache first (unless skipCache is set)
  if (!options?.skipCache) {
    const cachedService = serviceCache.get<T, CreateDTO, UpdateDTO>(cacheKey);
    if (cachedService) {
      logger.debug(`Using cached ${implementation} service for ${serviceName}`);
      return cachedService;
    }
  }

  // Get service constructor
  const ServiceConstructor = getServiceConstructor<T, CreateDTO, UpdateDTO>(
    serviceName,
    implementation
  );

  if (!ServiceConstructor) {
    const errorMessage = `${implementation === "mock" ? "Mock" : "API"} service not available for ${serviceName}`;

    // Try fallback to mock if API service is not available in development
    if (implementation === "api" && environment.app.isDevelopment) {
      logger.warn(`${errorMessage}, falling back to mock service`);
      const mockConstructor = getServiceConstructor<T, CreateDTO, UpdateDTO>(serviceName, "mock");

      if (mockConstructor) {
        // Use mock configuration for fallback mock service
        const mockConfig = options?.mockConfig || getEnvironmentConfig();
        const mockService = new mockConstructor(mockConfig);
        logger.info(`Created fallback mock service for ${serviceName}`);
        return mockService;
      }
    }

    throw new Error(errorMessage);
  }

  try {
    // Prepare configuration based on implementation type
    let serviceConfig: MockServiceConfig | Record<string, any> | undefined;

    if (implementation === "mock") {
      // For mock services, use MockServiceConfig with fallback
      serviceConfig = options?.mockConfig || getEnvironmentConfig();

      // Log deterministic configuration info
      if (environment.development.enableDevtools) {
        const mockConfig = serviceConfig as MockServiceConfig;
        logger.debug(
          `Mock service config for ${serviceName}: deterministic=${mockConfig.deterministic}, errorRate=${mockConfig.errorRate}`
        );
      }
    } else {
      // For API services, use regular config
      serviceConfig = options?.config;
    }

    // Create service instance
    const service = new ServiceConstructor(serviceConfig);

    // Validate service implements required interface
    if (!service || typeof service.list !== "function" || typeof service.get !== "function") {
      throw new Error(`Service ${serviceName} does not implement BaseService interface`);
    }

    // Cache the instance (unless skipCache is set)
    if (!options?.skipCache) {
      serviceCache.set(cacheKey, service, implementation);
    }

    // Log service creation in development
    if (environment.development.enableDevtools) {
      logger.info(`Created ${implementation} service for ${serviceName}`);
    }

    return service;
  } catch (error) {
    logger.error(`Failed to create service ${serviceName}:`, error);
    throw error;
  }
}

/**
 * Type-safe service factory functions for each service type
 */
export const ServiceRegistry = {
  /**
   * Create authentication service
   */
  auth: <T = any, CreateDTO = any, UpdateDTO = any>(options?: ServiceFactoryOptions) =>
    createService<T, CreateDTO, UpdateDTO>("auth", options),

  /**
   * Create booking service
   */
  booking: <T = any, CreateDTO = any, UpdateDTO = any>(options?: ServiceFactoryOptions) =>
    createService<T, CreateDTO, UpdateDTO>("booking", options),

  /**
   * Create guest service
   */
  guest: <T = any, CreateDTO = any, UpdateDTO = any>(options?: ServiceFactoryOptions) =>
    createService<T, CreateDTO, UpdateDTO>("guest", options),

  /**
   * Create expense service
   */
  expense: <T = any, CreateDTO = any, UpdateDTO = any>(options?: ServiceFactoryOptions) =>
    createService<T, CreateDTO, UpdateDTO>("expense", options),

  /**
   * Create property service
   */
  property: <T = any, CreateDTO = any, UpdateDTO = any>(options?: ServiceFactoryOptions) =>
    createService<T, CreateDTO, UpdateDTO>("property", options),

  /**
   * Create payment service
   */
  payment: <T = any, CreateDTO = any, UpdateDTO = any>(options?: ServiceFactoryOptions) =>
    createService<T, CreateDTO, UpdateDTO>("payment", options),

  /**
   * Create report service
   */
  report: <T = any, CreateDTO = any, UpdateDTO = any>(options?: ServiceFactoryOptions) =>
    createService<T, CreateDTO, UpdateDTO>("report", options),

  /**
   * Create user service
   */
  user: <T = any, CreateDTO = any, UpdateDTO = any>(options?: ServiceFactoryOptions) =>
    createService<T, CreateDTO, UpdateDTO>("user", options),

  /**
   * Create project service
   */
  project: <T = any, CreateDTO = any, UpdateDTO = any>(options?: ServiceFactoryOptions) =>
    createService<T, CreateDTO, UpdateDTO>("project", options),
} as const;

/**
 * Service registry utility functions
 */
export const ServiceRegistryUtils = {
  /**
   * Clear the service cache
   */
  clearCache(): void {
    serviceCache.clear();
    logger.debug("Service cache cleared");
  },

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; implementations: Record<ServiceImplementation, number> } {
    return serviceCache.getStats();
  },

  /**
   * Get all cached service keys
   */
  getCachedServices(): string[] {
    return serviceCache.keys();
  },

  /**
   * Check if a service is available in the current mode
   */
  isServiceAvailable(serviceName: ServiceType, implementation?: ServiceImplementation): boolean {
    const impl = implementation || determineImplementation(serviceName);
    return getServiceConstructor(serviceName, impl) !== null;
  },

  /**
   * Get list of available services
   */
  getAvailableServices(): Record<ServiceType, { mock: boolean; api: boolean }> {
    const services: Record<string, { mock: boolean; api: boolean }> = {};

    for (const serviceName of Object.keys(mockServices) as ServiceType[]) {
      services[serviceName] = {
        mock: mockServices[serviceName] !== null,
        api: apiServices[serviceName] !== null,
      };
    }

    return services as Record<ServiceType, { mock: boolean; api: boolean }>;
  },

  /**
   * Preload services for better performance
   */
  async preloadServices(services: ServiceType[], options?: ServiceFactoryOptions): Promise<void> {
    const promises = services.map((serviceName) =>
      createService(serviceName, options).catch((error) => {
        logger.error(`Failed to preload ${serviceName}:`, error);
      })
    );

    await Promise.all(promises);
    logger.info(`Preloaded ${services.length} services`);
  },

  /**
   * Force refresh a service (clear cache and recreate)
   */
  async refreshService<T = any, CreateDTO = any, UpdateDTO = any>(
    serviceName: ServiceType,
    options?: ServiceFactoryOptions
  ): Promise<BaseService<T, CreateDTO, UpdateDTO>> {
    return createService<T, CreateDTO, UpdateDTO>(serviceName, {
      ...options,
      skipCache: true,
    });
  },
};

/**
 * Export types for use in other modules
 */
export type ServiceRegistryType = typeof ServiceRegistry;
export type ServiceRegistryUtilsType = typeof ServiceRegistryUtils;

// Default export
export default ServiceRegistry;
