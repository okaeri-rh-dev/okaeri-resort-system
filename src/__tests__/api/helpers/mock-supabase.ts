/**
 * Supabase Mock Builder
 *
 * Fluent API for building type-safe Supabase client mocks for testing.
 * Supports table operations, RPC functions, and complex query chains.
 *
 * @example
 * const mockClient = new SupabaseMockBuilder()
 *   .table('units', testUnits)
 *   .table('bookings', testBookings)
 *   .rpc('check_multi_unit_availability', (params) => {
 *     return params.p_unit_ids.map(id => ({ unit_id: id, is_available: true }));
 *   })
 *   .build();
 */

import { vi } from "vitest";

export type MockData = Record<string, any>;
export type RpcFunction = (params: any) => any;

/**
 * Table-specific primary key mappings
 * Maps table names to their primary key field names
 */
const TABLE_PRIMARY_KEYS: Record<string, string> = {
  bookings: "booking_id",
  booking_units: "booking_unit_id",
  units: "unit_id",
  guests: "guest_id",
  payments: "payment_id",
  payment_adjustments: "adjustment_id",
  audit_logs: "log_id",
};

/**
 * Builder class for creating Supabase client mocks
 */
export class SupabaseMockBuilder {
  private tableData: Map<string, any[]> = new Map();
  private tableErrors: Map<string, any> = new Map();
  private rpcFunctions: Map<string, RpcFunction> = new Map();
  private rpcErrors: Map<string, any> = new Map();

  /**
   * Add mock data for a table
   */
  table(tableName: string, data: any[] | null, error: any = null): this {
    if (data !== null) {
      this.tableData.set(tableName, data);
    }
    if (error) {
      this.tableErrors.set(tableName, error);
    }
    return this;
  }

  /**
   * Add mock RPC function
   */
  rpc(functionName: string, handler: RpcFunction | any[], error: any = null): this {
    if (typeof handler === "function") {
      this.rpcFunctions.set(functionName, handler);
    } else {
      // Static data response
      this.rpcFunctions.set(functionName, () => handler);
    }
    if (error) {
      this.rpcErrors.set(functionName, error);
    }
    return this;
  }

  /**
   * Build the mock Supabase client
   */
  build() {
    const tableData = this.tableData;
    const tableErrors = this.tableErrors;
    const rpcFunctions = this.rpcFunctions;
    const rpcErrors = this.rpcErrors;

    return {
      from: vi.fn((table: string) => {
        const data = tableData.get(table) || [];
        const error = tableErrors.get(table) || null;

        return {
          select: vi.fn((columns = "*") => {
            const selectResult = {
              eq: vi.fn((column: string, value: any) => {
                const filtered = data.filter((item: any) => item[column] === value);

                // Create recursive eq result that supports chaining multiple .eq() calls
                const createEqResult = (currentData: any[]): any => ({
                  eq: vi.fn((nextColumn: string, nextValue: any) => {
                    const furtherFiltered = currentData.filter(
                      (item: any) => item[nextColumn] === nextValue
                    );
                    return createEqResult(furtherFiltered);
                  }),
                  single: vi.fn(() => ({
                    data: currentData[0] || null,
                    error: currentData[0] ? null : error,
                  })),
                  order: vi.fn((column: string, options?: { ascending?: boolean }) => ({
                    limit: vi.fn((count: number) => ({
                      single: vi.fn(() => ({
                        data: currentData.slice(0, count)[0] || null,
                        error: currentData.slice(0, count)[0] ? null : error,
                      })),
                      data: currentData.slice(0, count),
                      error,
                    })),
                    data: currentData,
                    error,
                  })),
                  data: currentData,
                  error,
                });

                return createEqResult(filtered);
              }),

              in: vi.fn((column: string, values: any[]) => {
                const filtered = data.filter((item: any) => values.includes(item[column]));
                return {
                  data: filtered,
                  error,
                };
              }),

              gte: vi.fn((column: string, value: any) => ({
                lte: vi.fn((column2: string, value2: any) => ({
                  data: data.filter(
                    (item: any) => item[column] >= value && item[column2] <= value2
                  ),
                  error,
                })),
              })),

              order: vi.fn((column: string, options?: { ascending?: boolean }) => ({
                limit: vi.fn((count: number) => ({
                  single: vi.fn(() => ({
                    data: data.slice(0, count)[0] || null,
                    error: data.slice(0, count)[0] ? null : error,
                  })),
                  data: data.slice(0, count),
                  error,
                })),
                data,
                error,
              })),

              // Direct data/error for simple select()
              data,
              error,
            };
            return selectResult;
          }),

          insert: vi.fn((insertData: any) => {
            // Get table-specific primary key field name, or default to 'id'
            const primaryKeyField = TABLE_PRIMARY_KEYS[table] || "id";
            const generateId = (index?: number) =>
              `mock-${primaryKeyField}-${Date.now()}${index !== undefined ? `-${index}` : ""}`;

            return {
              select: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: Array.isArray(insertData)
                    ? { ...insertData[0], [primaryKeyField]: generateId(0) }
                    : { ...insertData, [primaryKeyField]: generateId() },
                  error,
                })),
                data: Array.isArray(insertData)
                  ? insertData.map((item, i) => ({ ...item, [primaryKeyField]: generateId(i) }))
                  : [{ ...insertData, [primaryKeyField]: generateId() }],
                error,
              })),
              data: Array.isArray(insertData) ? insertData : [insertData],
              error,
            };
          }),

          update: vi.fn((updateData: any) => ({
            eq: vi.fn((column: string, value: any) => ({
              select: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: { ...updateData, updated_at: new Date().toISOString() },
                  error,
                })),
              })),
            })),
          })),

          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              data: null,
              error,
            })),
            in: vi.fn(() => ({
              data: null,
              error,
            })),
          })),
        };
      }),

      rpc: vi.fn((functionName: string, params?: any) => {
        const error = rpcErrors.get(functionName);
        if (error) {
          return Promise.resolve({ data: null, error });
        }

        const handler = rpcFunctions.get(functionName);
        if (handler) {
          const result = handler(params);
          return Promise.resolve({ data: result, error: null });
        }

        // Default empty response
        return Promise.resolve({ data: null, error: null });
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
  }
}

/**
 * Convenience function to create a basic mock client
 */
export function createMockSupabaseClient(config?: {
  tables?: Record<string, any[]>;
  rpcs?: Record<string, RpcFunction | any[]>;
  errors?: {
    tables?: Record<string, any>;
    rpcs?: Record<string, any>;
  };
}) {
  const builder = new SupabaseMockBuilder();

  // Add tables
  if (config?.tables) {
    for (const [tableName, data] of Object.entries(config.tables)) {
      const error = config.errors?.tables?.[tableName];
      builder.table(tableName, data, error);
    }
  }

  // Add RPCs
  if (config?.rpcs) {
    for (const [funcName, handler] of Object.entries(config.rpcs)) {
      const error = config.errors?.rpcs?.[funcName];
      builder.rpc(funcName, handler, error);
    }
  }

  return builder.build();
}
