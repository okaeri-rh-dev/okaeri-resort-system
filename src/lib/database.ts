/**
 * Database Connection Stub
 * Simple stub for testing - will be mocked by tests
 */

export interface DatabaseConnection {
  query: (query: string, params?: any[]) => Promise<{ rows: any[] }>;
  transaction?: (callback: (tx: any) => Promise<any>) => Promise<any>;
}

export function getDbConnection(): DatabaseConnection {
  // This will be mocked in tests
  return {
    query: async () => ({ rows: [] }),
  };
}
