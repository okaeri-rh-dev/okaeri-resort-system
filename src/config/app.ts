/**
 * App Configuration Stub
 * Simple stub for testing - will be mocked by tests
 */

export const config = {
  cache: {
    availabilityTtl: 300, // 5 minutes
    calendarTtl: 600, // 10 minutes
    bulkTtl: 180, // 3 minutes
  },
  performance: {
    maxPropertiesPerQuery: 50,
    maxDaysPerQuery: 365,
    queryTimeout: 30000,
  },
};
