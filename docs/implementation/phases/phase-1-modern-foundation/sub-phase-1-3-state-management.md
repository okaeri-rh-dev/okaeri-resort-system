# Sub-Phase 1.3: State Management Infrastructure

## Overview

This sub-phase implements a modern state management architecture using Zustand
for local/UI state and TanStack Query for server state. It establishes patterns
for data fetching, caching, optimistic updates, and offline support that will be
used throughout the application.

## Objectives

1. Setup Zustand stores with TypeScript for local state management
2. Configure TanStack Query for server state and caching
3. Implement persistence layer for offline support
4. Create reusable hooks and patterns for data fetching
5. Establish optimistic update patterns with React 19 features

## Technical Requirements

### Core Dependencies

```json
{
  "dependencies": {
    "zustand": "^5.0.2",
    "immer": "^10.1.0",
    "@tanstack/react-query": "^5.71.10",
    "@tanstack/react-query-devtools": "^5.71.10",
    "@tanstack/query-sync-storage-persister": "^5.71.10",
    "@tanstack/react-query-persist-client": "^5.71.10",
    "idb": "^8.0.0",
    "zod": "^3.24.0"
  }
}
```

### Zustand Store Architecture

```typescript
// src/stores/authStore.ts
import { create } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { User, AuthTokens } from "@/types/auth";

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          // State
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,

          // Actions
          login: async (credentials) => {
            set((state) => {
              state.isLoading = true;
              state.error = null;
            });

            try {
              const response = await authApi.login(credentials);

              set((state) => {
                state.user = response.user;
                state.tokens = response.tokens;
                state.isAuthenticated = true;
                state.isLoading = false;
              });
            } catch (error) {
              set((state) => {
                state.error =
                  error instanceof Error ? error.message : "Login failed";
                state.isLoading = false;
              });
            }
          },

          logout: () => {
            set((state) => {
              state.user = null;
              state.tokens = null;
              state.isAuthenticated = false;
              state.error = null;
            });
          },

          refreshToken: async () => {
            const { tokens } = get();
            if (!tokens?.refreshToken) return;

            try {
              const response = await authApi.refresh(tokens.refreshToken);

              set((state) => {
                state.tokens = response.tokens;
              });
            } catch (error) {
              // If refresh fails, logout user
              get().logout();
            }
          },

          updateUser: (updates) => {
            set((state) => {
              if (state.user) {
                Object.assign(state.user, updates);
              }
            });
          },

          clearError: () => {
            set((state) => {
              state.error = null;
            });
          },
        }))
      ),
      {
        name: "auth-storage",
        partialize: (state) => ({
          user: state.user,
          tokens: state.tokens,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    {
      name: "AuthStore",
    }
  )
);
```

### Project Store

```typescript
// src/stores/projectStore.ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Project } from '@/types/project'

interface ProjectState {
  projects: Project[]
  currentProjectId: string | null
  currentProject: Project | null
  isLoading: boolean
  error: string | null
}

interface ProjectActions {
  setProjects: (projects: Project[]) => void
  addProject: (project: Project) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void
  setCurrentProject: (id: string) => void
  clearCurrentProject: () => void
}

export const useProjectStore = create<ProjectState & ProjectActions>()(
  devtools(
    persist(
      immer((set, get) => ({
        // State
        projects: [],
        currentProjectId: null,
        currentProject: null,
        isLoading: false,
        error: null,

        // Actions
        setProjects: (projects) => {
          set((state) => {
            state.projects = projects
            // Update current project if it exists in new list
            if (state.currentProjectId) {
              state.currentProject = projects.find(p => p.id === state.currentProjectId) || null
            }
          })
        },

        addProject: (project) => {
          set((state) => {
            state.projects.push(project)
          })
        },

        updateProject: (id, updates) => {
          set((state) => {
            const index = state.projects.findIndex(p => p.id === id)
            if (index !== -1) {
              Object.assign(state.projects[index], updates)

              // Update current project if it's the one being updated
              if (state.currentProjectId === id) {
                Object.assign(state.currentProject!, updates)
              }
            }
          })
        },

        deleteProject: (id) => {
          set((state) => {
            state.projects = state.projects.filter(p => p.id !== id)

            // Clear current project if it was deleted
            if (state.currentProjectId === id) {
              state.currentProjectId = null
              state.currentProject = null
            }
          })
        },

        setCurrentProject: (id) => {
          set((state) => {
            state.currentProjectId = id
            state.currentProject = state.projects.find(p => p.id === id) || null
          })
        },

        clearCurrentProject: () => {
          set((state) => {
            state.currentProjectId = null
            state.currentProject = null
          })
        },
      }))
    ),
    {
      name: 'project-storage',
      partialize: (state) => ({
        currentProjectId: state.currentProjectId,
      }),
    }
  ),
  {
    name: 'ProjectStore',
  }
  )
)
```

### TanStack Query Configuration

```typescript
// src/lib/query-client.ts
import { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && error.message.includes("4")) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: "always",
    },
    mutations: {
      retry: false,
      onError: (error) => {
        // Global error handling
        console.error("Mutation error:", error);
      },
    },
  },
});

// Setup persistence for offline support
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "ORMS_QUERY_CACHE",
});

persistQueryClient({
  queryClient,
  persister,
  maxAge: 1000 * 60 * 60 * 24, // 24 hours
});
```

### Query Hooks with Optimistic Updates

```typescript
// src/hooks/queries/useBookings.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOptimistic } from "react";
import { bookingsApi } from "@/api/bookings";
import { useProjectStore } from "@/stores/projectStore";
import type { Booking, CreateBookingDto } from "@/types/booking";

export function useBookings(options?: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  const projectId = useProjectStore((state) => state.currentProjectId);

  return useQuery({
    queryKey: ["bookings", projectId, options],
    queryFn: () => bookingsApi.list(projectId!, options),
    enabled: !!projectId,
    placeholderData: (previousData) => previousData,
  });
}

export function useBooking(bookingId: string) {
  const projectId = useProjectStore((state) => state.currentProjectId);

  return useQuery({
    queryKey: ["bookings", projectId, bookingId],
    queryFn: () => bookingsApi.get(projectId!, bookingId),
    enabled: !!projectId && !!bookingId,
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  const projectId = useProjectStore((state) => state.currentProjectId);

  return useMutation({
    mutationFn: (data: CreateBookingDto) =>
      bookingsApi.create(projectId!, data),

    onMutate: async (newBooking) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["bookings", projectId],
      });

      // Snapshot previous value
      const previousBookings = queryClient.getQueryData<Booking[]>([
        "bookings",
        projectId,
      ]);

      // Optimistically update
      queryClient.setQueryData<Booking[]>(
        ["bookings", projectId],
        (old = []) => [
          {
            ...newBooking,
            id: `temp-${Date.now()}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as Booking,
          ...old,
        ]
      );

      return { previousBookings };
    },

    onError: (err, newBooking, context) => {
      // Rollback on error
      if (context?.previousBookings) {
        queryClient.setQueryData(
          ["bookings", projectId],
          context.previousBookings
        );
      }
    },

    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: ["bookings", projectId],
      });
    },
  });
}
```

### React 19 useOptimistic Integration

```typescript
// src/hooks/useOptimisticBookings.ts
import { useOptimistic, useTransition } from "react";
import { useBookings, useCreateBooking } from "./queries/useBookings";
import type { Booking, CreateBookingDto } from "@/types/booking";

export function useOptimisticBookings() {
  const { data: bookings = [], isLoading } = useBookings();
  const createMutation = useCreateBooking();
  const [isPending, startTransition] = useTransition();

  const [optimisticBookings, addOptimisticBooking] = useOptimistic(
    bookings,
    (state: Booking[], newBooking: CreateBookingDto) => [
      {
        ...newBooking,
        id: `optimistic-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "pending",
      } as Booking,
      ...state,
    ]
  );

  const createBooking = (data: CreateBookingDto) => {
    startTransition(async () => {
      addOptimisticBooking(data);
      await createMutation.mutateAsync(data);
    });
  };

  return {
    bookings: optimisticBookings,
    isLoading: isLoading || isPending,
    createBooking,
  };
}
```

## Implementation Steps

### Step 1: Install Dependencies

```bash
pnpm add zustand immer @tanstack/react-query @tanstack/react-query-devtools \
  @tanstack/query-sync-storage-persister @tanstack/react-query-persist-client \
  idb zod
```

### Step 2: Setup Query Client Provider

```typescript
// src/main.tsx
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from '@/lib/query-client'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
```

### Step 3: Create Store Selectors

```typescript
// src/stores/selectors.ts
import { useAuthStore } from "./authStore";
import { useProjectStore } from "./projectStore";

// Auth selectors
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () =>
  useAuthStore((state) => state.isAuthenticated);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);

// Project selectors
export const useCurrentProject = () =>
  useProjectStore((state) => state.currentProject);
export const useProjects = () => useProjectStore((state) => state.projects);
export const useCurrentProjectId = () =>
  useProjectStore((state) => state.currentProjectId);
```

## Type Definitions

### Store Types

```typescript
// src/types/stores.ts
export interface StoreState<T> {
  data: T;
  isLoading: boolean;
  error: string | null;
}

export interface StoreActions<T> {
  set: (data: T) => void;
  update: (updates: Partial<T>) => void;
  reset: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export type Store<T> = StoreState<T> & StoreActions<T>;
```

### Query Types

```typescript
// src/types/queries.ts
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface QueryOptions {
  page?: number;
  limit?: number;
  sort?: string;
  filter?: Record<string, unknown>;
}

export interface MutationCallbacks<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
}
```

## Test Requirements

### Store Testing

```typescript
// tests/unit/stores/authStore.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuthStore } from "@/stores/authStore";

describe("AuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it("handles login successfully", async () => {
    const { result } = renderHook(() => useAuthStore());

    await act(async () => {
      await result.current.login({
        email: "test@example.com",
        password: "password",
      });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toBeDefined();
    expect(result.current.tokens).toBeDefined();
  });

  it("handles logout", () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.tokens).toBeNull();
  });
});
```

### Query Hook Testing

```typescript
// tests/unit/hooks/useBookings.test.tsx
import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useBookings } from '@/hooks/queries/useBookings'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useBookings', () => {
  it('fetches bookings successfully', async () => {
    const { result } = renderHook(() => useBookings(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeDefined()
    expect(Array.isArray(result.current.data)).toBe(true)
  })
})
```

## Agent Validation Checklist

### zustand-tanstack-resort-architect Validation

- [ ] Zustand stores properly structured with TypeScript
- [ ] TanStack Query configured for optimal caching
- [ ] Optimistic updates implemented correctly
- [ ] Offline support with persistence
- [ ] Proper error handling in mutations
- [ ] React 19 hooks integrated (useOptimistic, useTransition)
- [ ] Query invalidation strategies defined
- [ ] State synchronization patterns established

### typescript-react-quality-expert Validation

- [ ] All stores fully typed with no `any`
- [ ] Query hooks with proper generic types
- [ ] Discriminated unions for complex states
- [ ] Type-safe selectors and actions
- [ ] Zod schemas for runtime validation
- [ ] Consistent error handling types
- [ ] Proper use of TypeScript utility types
- [ ] Module augmentation where needed

## Success Criteria

1. **State Management** - Zustand stores operational with persistence
2. **Server State** - TanStack Query handling all API calls
3. **Type Safety** - 100% TypeScript coverage with strict mode
4. **Optimistic UI** - Instant feedback for user actions
5. **Offline Support** - Critical data cached and available offline
6. **Performance** - No unnecessary re-renders or API calls
7. **Developer Experience** - DevTools integration working

## Deliverables

- [ ] Zustand stores for auth and projects
- [ ] TanStack Query configuration with persistence
- [ ] Complete set of query and mutation hooks
- [ ] Optimistic update patterns implemented
- [ ] Offline support with IndexedDB
- [ ] Comprehensive test coverage
- [ ] DevTools configured for debugging
- [ ] Documentation for state patterns

## Completion Checklist

- [ ] All stores created with TypeScript
- [ ] Query client configured with persistence
- [ ] Auth flow with token refresh working
- [ ] Project switching functionality complete
- [ ] Optimistic updates for all mutations
- [ ] Offline mode tested and working
- [ ] All tests passing with > 80% coverage
- [ ] Agent validations passed
- [ ] Documentation updated
- [ ] Ready for Sub-Phase 1.4

---

_Sub-Phase 1.3 establishes modern state management patterns that ensure
excellent user experience with instant feedback and offline capabilities._
