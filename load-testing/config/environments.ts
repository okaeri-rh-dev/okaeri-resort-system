/**
 * Load Testing Environment Configuration
 *
 * Defines target environments and their specific settings for load testing.
 * Each environment has different base URLs, rate limits, and VU configurations.
 */

export interface EnvironmentConfig {
  name: string;
  baseUrl: string;
  rateLimit: {
    bookingsPerHourPerIP: number;
    statusChecksPerHourPerIP: number;
  };
  defaultVUs: number;
  maxVUs: number;
}

export const environments: Record<string, EnvironmentConfig> = {
  development: {
    name: "Development",
    baseUrl: "http://localhost:8788",
    rateLimit: {
      bookingsPerHourPerIP: 5,
      statusChecksPerHourPerIP: 10,
    },
    defaultVUs: 5,
    maxVUs: 20,
  },

  preview: {
    name: "Preview",
    baseUrl: "https://preview.okaeri-resort.pages.dev",
    rateLimit: {
      bookingsPerHourPerIP: 5,
      statusChecksPerHourPerIP: 10,
    },
    defaultVUs: 10,
    maxVUs: 50,
  },

  production: {
    name: "Production",
    baseUrl: "https://okaeri-resort.pages.dev",
    rateLimit: {
      bookingsPerHourPerIP: 5,
      statusChecksPerHourPerIP: 10,
    },
    defaultVUs: 10,
    maxVUs: 100,
  },
};

/**
 * Get environment config from K6_ENV variable or default to development
 */
export function getEnvironment(): EnvironmentConfig {
  const envName = __ENV.K6_ENV || "development";
  const config = environments[envName];

  if (!config) {
    console.warn(`Unknown environment: ${envName}, falling back to development`);
    return environments.development;
  }

  return config;
}
