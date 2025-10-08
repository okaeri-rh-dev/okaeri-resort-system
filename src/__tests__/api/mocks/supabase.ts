/**
 * Mock Supabase Client for API testing
 *
 * Provides chainable query methods that match Supabase API
 */

import { vi } from "vitest";

export interface MockSupabaseResponse<T = any> {
  data: T | null;
  error: any;
}

/**
 * Global mock data store that can be updated by tests
 */
export let globalMockData: Record<string, any> = {};

/**
 * Update global mock data (use this in tests to customize mock behavior)
 */
export function setMockData(data: Record<string, any>) {
  globalMockData = { ...data };
}

/**
 * Reset global mock data to empty state
 */
export function resetMockData() {
  globalMockData = {};
}

/**
 * Create a mock Supabase client with configurable responses
 */
export const createMockSupabaseClient = (mockData?: Record<string, any>) => {
  // Helper to get data dynamically (reads globalMockData on each call)
  const getData = () => mockData || globalMockData;

  const client = {
    from: vi.fn((table: string) => {
      // Read data dynamically on each call
      const data = getData();
      const tableData = data[table] || [];
      const hasError = data[`${table}:error`];

      return {
        select: vi.fn((columns = "*") => {
          const selectChain = {
            eq: vi.fn((column: string, value: any) => {
              const filtered = Array.isArray(tableData)
                ? tableData.filter((item: any) => item[column] === value)
                : [];

              return {
                single: vi.fn(() => ({
                  data: filtered[0] || null,
                  error: hasError || null,
                })),
                data: filtered,
                error: hasError || null,
              };
            }),
            in: vi.fn((column: string, values: any[]) => {
              const filtered = Array.isArray(tableData)
                ? tableData.filter((item: any) => values.includes(item[column]))
                : [];

              return {
                data: filtered,
                error: hasError || null,
              };
            }),
            gte: vi.fn(() => ({
              lte: vi.fn(() => ({
                data: tableData,
                error: hasError || null,
              })),
            })),
            data: tableData,
            error: hasError || null,
          };

          return selectChain;
        }),

        insert: vi.fn((insertData: any) => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: Array.isArray(insertData)
                ? { ...insertData[0], id: "mock-id-" + Date.now() }
                : { ...insertData, id: "mock-id-" + Date.now() },
              error: hasError || null,
            })),
            data: Array.isArray(insertData)
              ? insertData.map((item, i) => ({ ...item, id: `mock-id-${i}` }))
              : [{ ...insertData, id: "mock-id" }],
            error: hasError || null,
          })),
          data: Array.isArray(insertData) ? insertData : [insertData],
          error: hasError || null,
        })),

        update: vi.fn((updateData: any) => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({
                data: { ...updateData, updated_at: new Date().toISOString() },
                error: hasError || null,
              })),
            })),
          })),
        })),

        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: null,
            error: hasError || null,
          })),
          in: vi.fn(() => ({
            data: null,
            error: hasError || null,
          })),
        })),
      };
    }),

    rpc: vi.fn((functionName: string, params?: any) => {
      // Read data dynamically on each call
      const data = getData();

      // Check for custom RPC mock data
      const rpcKey = `rpc:${functionName}`;
      if (data[rpcKey]) {
        return Promise.resolve({
          data: typeof data[rpcKey] === "function" ? data[rpcKey](params) : data[rpcKey],
          error: null,
        });
      }

      // Check for RPC error
      if (data[`${rpcKey}:error`]) {
        return Promise.resolve({
          data: null,
          error: data[`${rpcKey}:error`],
        });
      }

      // Default empty response
      return Promise.resolve({
        data: null,
        error: null,
      });
    }),

    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      signIn: vi.fn(),
      signOut: vi.fn(),
    },

    storage: {
      from: vi.fn((bucket: string) => ({
        createSignedUploadUrl: vi.fn(() =>
          Promise.resolve({
            data: {
              signedUrl: `https://test.supabase.co/storage/v1/object/upload/sign/${bucket}/test-file`,
              path: `${bucket}/test-file`,
              token: "mock-upload-token",
            },
            error: null,
          })
        ),
        upload: vi.fn(),
        getPublicUrl: vi.fn(() => ({
          data: {
            publicUrl: `https://test.supabase.co/storage/v1/object/public/${bucket}/test-file`,
          },
        })),
      })),
    },
  };

  return client;
};

/**
 * Mock Supabase module for vi.mock()
 * Creates clients that read from globalMockData dynamically
 */
export const mockSupabaseModule = () => ({
  createClient: vi.fn(() => createMockSupabaseClient()),
});
