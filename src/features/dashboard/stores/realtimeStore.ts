/**
 * Realtime Store - Zustand store for WebSocket and real-time coordination
 * Integrates with TanStack Query for cache management
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { subscribeWithSelector } from "zustand/middleware";
import { QueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useDashboardStore } from "./dashboardStore";
import { useOptimisticStore } from "./optimisticStore";

interface WebSocketState {
  status: "connected" | "connecting" | "disconnected" | "error";
  connection: WebSocket | null;
  reconnectAttempts: number;
  reconnectDelay: number;
}

interface ConnectionMetrics {
  messagesSent: number;
  messagesReceived: number;
  connectedAt: Date | null;
  latency: number;
}

interface RealtimeStoreState {
  ws: WebSocketState;
  lastUpdate: Date | null;
  metrics: any;
  bookings: any[];
  subscriptions: Map<string, Set<(data: any) => void>>;
  messageQueue: Set<string>;
  connectionMetrics: ConnectionMetrics;
  typhoonMode: { active: boolean; signalLevel: number };
  polling: { interval: number };
  snapshots: Map<string, any>;
  peakSeason: { active: boolean; multiplier: number; reason?: string };
  compliance: any;
  financials: any;
  paymentMethods: Record<string, any>;
  schedule: any[];
  birTransactions: any[];
}

interface RealtimeStore extends RealtimeStoreState {
  // Connection management
  connect: (url: string) => void;
  disconnect: () => void;
  getConnectionMetrics: () => ConnectionMetrics;

  // Subscription management
  subscribe: (type: string, handler: (data: any) => void) => () => void;
  getActiveSubscriptions: () => Array<{ type: string; count: number }>;

  // Message handling
  send: (message: any) => void;
  applyOptimisticUpdate: (update: any) => void;

  // Query integration
  getQueryOptions: (key: string[]) => any;
  createQuery: (options: any) => any;
  createOptimisticMutation: (options: any) => any;
  prefetchRelated: (key: string[]) => Promise<void>;
  syncQueryToStore: (key: string[]) => void;
  persistQueries: () => void;
  restoreQueries: () => void;

  // State management
  reset: () => void;
  resetAll: () => void;
  broadcastUpdate: (update: any) => void;
  updateMetrics: (metrics: any) => void;
  withMiddleware: (middlewares: any[]) => any;
  createSnapshot: (name: string) => void;
  restoreSnapshot: (name: string) => void;
  transaction: (callback: (tx: any) => Promise<any>) => Promise<any>;
  hydrate: (state: any) => Promise<void>;

  // Philippine context
  updateFinancials: (data: any) => void;
  getFormattedFinancials: () => any;
  recordPayment: (payment: any) => void;
  getPaymentsByMethod: () => any;
  scheduleCheckIn: (data: any) => void;
  getTodaySchedule: () => any[];
  enableTyphoonMode: (config: any) => void;
  recordTransaction: (transaction: any) => void;
  generateBIRReport: (type: string) => any;
  setPeakSeason: (config: any) => void;
  calculateRoomPrice: (type: string, nights: number) => any;
  updateCompliance: (data: any) => void;
  getComplianceAlerts: () => any[];
}

const initialState: RealtimeStoreState = {
  ws: {
    status: "disconnected",
    connection: null,
    reconnectAttempts: 0,
    reconnectDelay: 1000,
  },
  lastUpdate: null,
  metrics: { occupancyRate: 0 },
  bookings: [],
  subscriptions: new Map(),
  messageQueue: new Set(),
  connectionMetrics: {
    messagesSent: 0,
    messagesReceived: 0,
    connectedAt: null,
    latency: 0,
  },
  typhoonMode: { active: false, signalLevel: 0 },
  polling: { interval: 5000 },
  snapshots: new Map(),
  peakSeason: { active: false, multiplier: 1 },
  compliance: {},
  financials: {},
  paymentMethods: {},
  schedule: [],
  birTransactions: [],
};

let queryClient: QueryClient | null = null;

export const useRealtimeStore = create<RealtimeStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      connect: (url: string) => {
        set((state) => {
          state.ws.status = "connecting";
        });

        const ws = new WebSocket(url);

        ws.onopen = () => {
          set((state) => {
            state.ws.status = "connected";
            state.ws.connection = ws;
            state.ws.reconnectAttempts = 0;
            state.connectionMetrics.connectedAt = new Date();
          });
        };

        ws.onclose = () => {
          set((state) => {
            state.ws.status = "disconnected";
            state.ws.connection = null;
          });

          // Exponential backoff for reconnection
          const attempts = get().ws.reconnectAttempts;
          if (attempts < 5) {
            const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
            set((state) => {
              state.ws.reconnectAttempts++;
              state.ws.reconnectDelay = delay;
            });

            setTimeout(() => {
              get().connect(url);
            }, delay);
          }
        };

        ws.onmessage = (event) => {
          const message = JSON.parse(event.data);

          // Deduplication
          if (message.messageId) {
            if (get().messageQueue.has(message.messageId)) {
              return;
            }
            set((state) => {
              state.messageQueue.add(message.messageId);
            });
          }

          // Update metrics
          set((state) => {
            state.connectionMetrics.messagesReceived++;
          });

          // Handle subscriptions
          const handlers = get().subscriptions.get(message.type);
          if (handlers) {
            handlers.forEach((handler) => handler(message.data));
          }

          // Update TanStack Query cache
          if (queryClient && message.type === "metric") {
            queryClient.invalidateQueries({ queryKey: ["metrics"] });
          }
        };

        ws.onerror = () => {
          set((state) => {
            state.ws.status = "error";
          });
        };
      },

      disconnect: () => {
        const ws = get().ws.connection;
        if (ws) {
          ws.close();
        }

        set((state) => {
          state.ws.status = "disconnected";
          state.ws.connection = null;
          state.subscriptions.clear();
        });
      },

      getConnectionMetrics: () => {
        return { ...get().connectionMetrics };
      },

      subscribe: (type: string, handler: (data: any) => void) => {
        set((state) => {
          if (!state.subscriptions.has(type)) {
            state.subscriptions.set(type, new Set());
          }
          state.subscriptions.get(type)?.add(handler);
        });

        // Return unsubscribe function
        return () => {
          set((state) => {
            state.subscriptions.get(type)?.delete(handler);
          });
        };
      },

      getActiveSubscriptions: () => {
        const subs: Array<{ type: string; count: number }> = [];
        get().subscriptions.forEach((handlers, type) => {
          subs.push({ type, count: handlers.size });
        });
        return subs;
      },

      send: (message: any) => {
        const ws = get().ws.connection;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
          set((state) => {
            state.connectionMetrics.messagesSent++;
          });
        }
      },

      applyOptimisticUpdate: (update: any) => {
        // Coordinate with optimistic store
        useOptimisticStore.getState().addUpdate(update);
      },

      getQueryOptions: (key: string[]) => {
        const isConnected = get().ws.status === "connected";
        const keyStr = key[0];

        // Different cache times based on data type
        const gcTimes: Record<string, number> = {
          bookings: 5 * 60 * 1000,
          metrics: 10 * 60 * 1000,
          financial: 30 * 60 * 1000,
        };

        return {
          staleTime: isConnected ? Infinity : 5 * 60 * 1000,
          gcTime: gcTimes[keyStr] || 10 * 60 * 1000,
        };
      },

      createQuery: (options: any) => {
        return useQuery(options);
      },

      createOptimisticMutation: (options: any) => {
        return useMutation({
          ...options,
          onMutate: async (variables: any) => {
            // Apply optimistic update
            useOptimisticStore.getState().addUpdate({
              id: Date.now().toString(),
              changes: variables,
            });

            if (options.onMutate) {
              return await options.onMutate(variables);
            }
          },
          onSuccess: (data: any, variables: any, context: any) => {
            // Clear optimistic update
            useOptimisticStore.getState().clearUpdates();

            if (options.onSuccess) {
              options.onSuccess(data, variables, context);
            }
          },
          onError: (error: any, variables: any, context: any) => {
            // Rollback optimistic update
            useOptimisticStore.getState().clearUpdates();

            if (options.onError) {
              options.onError(error, variables, context);
            }
          },
        });
      },

      prefetchRelated: async (key: string[]) => {
        if (!queryClient) return;

        // Predictive prefetching
        if (key[1] === "current") {
          await queryClient.prefetchQuery({
            queryKey: ["bookings", "upcoming"],
            queryFn: async () => {
              // Fetch upcoming bookings
              return [];
            },
          });
        }
      },

      syncQueryToStore: (key: string[]) => {
        if (!queryClient) return;

        const data = queryClient.getQueryData(key);
        if (data && key[0] === "metrics") {
          useDashboardStore.getState().updateMetrics?.(data as any);
        }
      },

      persistQueries: () => {
        if (!queryClient) return;

        const cache = queryClient.getQueryCache().getAll();
        const serialized = cache.map((query) => ({
          key: query.queryKey,
          data: query.state.data,
        }));

        localStorage.setItem("queryCache", JSON.stringify(serialized));
      },

      restoreQueries: () => {
        if (!queryClient) return;

        const cached = localStorage.getItem("queryCache");
        if (cached) {
          const queries = JSON.parse(cached);
          queries.forEach((query: any) => {
            queryClient.setQueryData(query.key, query.data);
          });
        }
      },

      reset: () => {
        set(() => initialState);
      },

      resetAll: () => {
        // Reset all stores
        useRealtimeStore.getState().reset();
        useDashboardStore.getState().reset();
        useOptimisticStore.getState().reset();
      },

      broadcastUpdate: (update: any) => {
        if (update.type === "METRICS_UPDATE") {
          useDashboardStore.getState().updateMetrics?.(update.payload);
        }
      },

      updateMetrics: (metrics: any) => {
        set((state) => {
          state.metrics = { ...state.metrics, ...metrics };
        });
      },

      withMiddleware: (middlewares: any[]) => {
        // Middleware composition would be implemented here
        return get();
      },

      createSnapshot: (name: string) => {
        const snapshot = {
          metrics: get().metrics,
          bookings: get().bookings,
          ws: { ...get().ws },
        };
        set((state) => {
          state.snapshots.set(name, snapshot);
        });
      },

      restoreSnapshot: (name: string) => {
        const snapshot = get().snapshots.get(name);
        if (snapshot) {
          set((state) => {
            state.metrics = snapshot.metrics;
            state.bookings = snapshot.bookings;
          });
        }
      },

      transaction: async (callback: (tx: any) => Promise<any>) => {
        const originalState = { ...get() };

        const tx = {
          updateMetrics: (metrics: any) => get().updateMetrics(metrics),
          addBooking: (booking: any) => {
            set((state) => {
              state.bookings.push(booking);
            });
          },
          getState: () => get(),
          commit: () => true,
        };

        try {
          return await callback(tx);
        } catch (error) {
          // Rollback
          set(() => originalState);
          return { success: false, error };
        }
      },

      hydrate: async (serverState: any) => {
        set((state) => {
          if (serverState.metrics) state.metrics = serverState.metrics;
          if (serverState.bookings) state.bookings = serverState.bookings;
          if (serverState.connection?.status) state.ws.status = serverState.connection.status;
        });
      },

      updateFinancials: (data: any) => {
        set((state) => {
          state.financials = { ...state.financials, ...data };
        });
      },

      getFormattedFinancials: () => {
        const financials = get().financials;
        const formatter = new Intl.NumberFormat("en-PH", {
          style: "currency",
          currency: "PHP",
        });

        return {
          dailyRevenue: formatter.format(financials.dailyRevenue || 0),
          pendingPayments: formatter.format(financials.pendingPayments || 0),
          expenses: formatter.format(financials.expenses || 0),
          netRevenue: formatter.format((financials.dailyRevenue || 0) - (financials.expenses || 0)),
        };
      },

      recordPayment: (payment: any) => {
        set((state) => {
          const method = payment.method;
          if (!state.paymentMethods[method]) {
            state.paymentMethods[method] = { total: 0, count: 0, payments: [] };
          }
          state.paymentMethods[method].total += payment.amount;
          state.paymentMethods[method].count++;
          state.paymentMethods[method].payments.push(payment);
        });
      },

      getPaymentsByMethod: () => {
        const methods = get().paymentMethods;
        const total = Object.values(methods).reduce((sum, method: any) => sum + method.total, 0);

        const result: any = {};
        Object.keys(methods).forEach((method) => {
          result[method] = {
            ...methods[method],
            percentage: total > 0 ? (methods[method].total / total) * 100 : 0,
          };
        });

        return result;
      },

      scheduleCheckIn: (data: any) => {
        set((state) => {
          state.schedule.push({
            ...data,
            localTime: new Date(`2024-01-01T${data.scheduledTime}`).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }),
            timezone: "Asia/Manila",
          });
        });
      },

      getTodaySchedule: () => {
        return get().schedule;
      },

      enableTyphoonMode: (config: any) => {
        set((state) => {
          state.typhoonMode = {
            active: true,
            signalLevel: config.signalLevel,
          };
          // Adjust connection parameters for typhoon conditions
          state.ws.reconnectDelay = 10000; // Increase reconnect delay
          state.polling.interval = 60000; // Reduce polling frequency
        });
      },

      recordTransaction: (transaction: any) => {
        set((state) => {
          state.birTransactions.push(transaction);
        });
      },

      generateBIRReport: (type: string) => {
        const transactions = get().birTransactions;
        const grossSales = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        const vatCollected = transactions.reduce((sum, t) => sum + (t.vatAmount || 0), 0);

        return {
          grossSales,
          vatCollected,
          netSales: grossSales - vatCollected,
        };
      },

      setPeakSeason: (config: any) => {
        set((state) => {
          state.peakSeason = config;
        });
      },

      calculateRoomPrice: (type: string, nights: number) => {
        const basePrice = type === "standard" ? 3500 : 5000;
        const season = get().peakSeason;

        const peakAdjustment = season.active ? basePrice * (season.multiplier - 1) : 0;
        const totalPrice = (basePrice + peakAdjustment) * nights;

        return {
          basePrice: basePrice * nights,
          peakAdjustment: peakAdjustment * nights,
          totalPrice,
        };
      },

      updateCompliance: (data: any) => {
        set((state) => {
          state.compliance = data;
        });
      },

      getComplianceAlerts: () => {
        const compliance = get().compliance;
        const alerts: any[] = [];

        Object.entries(compliance).forEach(([key, value]: [string, any]) => {
          if (value.status === "due_soon") {
            alerts.push({
              type: "warning",
              message: `${key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())} inspection due soon`,
            });
          }
        });

        return alerts;
      },
    }))
  )
);

// Set query client for integration
export function setQueryClient(client: QueryClient) {
  queryClient = client;
}
