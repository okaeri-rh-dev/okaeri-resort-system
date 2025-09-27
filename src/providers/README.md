# 🔌 Context Providers

## Overview

The `/src/providers/` directory contains React Context providers that manage global application state, configuration, and cross-cutting concerns for the Okaeri Resort System.

## 📁 Directory Structure

```
providers/
├── QueryProvider.tsx    # TanStack Query configuration
└── index.tsx           # Provider exports
```

## 📦 Provider Documentation

### `QueryProvider` - React Query Configuration
**File Size**: 9.5KB
**Purpose**: Configures TanStack Query with optimized settings for the application

**Implementation**:
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: How long before data is considered stale
      staleTime: 5 * 60 * 1000, // 5 minutes

      // Cache time: How long inactive data stays in cache
      gcTime: 10 * 60 * 1000, // 10 minutes

      // Retry configuration
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false
        }
        // Retry up to 3 times for other errors
        return failureCount < 3
      },

      // Retry delay
      retryDelay: (attemptIndex) =>
        Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch on window focus
      refetchOnWindowFocus: false,

      // Refetch on reconnect
      refetchOnReconnect: 'always',
    },
    mutations: {
      // Mutation retry
      retry: false,

      // On error
      onError: (error) => {
        console.error('Mutation error:', error)
        toast.error(error.message || 'Something went wrong')
      },
    },
  },
})

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
```

## 🏗️ Provider Architecture

### Provider Hierarchy
```tsx
// App.tsx - Provider composition
function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <ThemeProvider>
          <NotificationProvider>
            <RouterProvider router={router} />
          </NotificationProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryProvider>
  )
}
```

## 🔧 Query Configuration

### Query Defaults
```typescript
// Global query defaults
const queryDefaults = {
  bookings: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  },
  units: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  },
  guests: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  },
}

// Apply defaults to specific queries
queryClient.setQueryDefaults(
  ['bookings'],
  queryDefaults.bookings
)
```

### Mutation Configuration
```typescript
// Global mutation handlers
queryClient.setMutationDefaults(['createBooking'], {
  mutationFn: createBooking,
  onMutate: async (variables) => {
    // Optimistic update
    await queryClient.cancelQueries(['bookings'])
    const previousBookings = queryClient.getQueryData(['bookings'])

    queryClient.setQueryData(['bookings'], (old) => [
      ...old,
      { ...variables, id: 'temp-id', status: 'pending' }
    ])

    return { previousBookings }
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['bookings'], context.previousBookings)
  },
  onSettled: () => {
    // Refetch after mutation
    queryClient.invalidateQueries(['bookings'])
  },
})
```

## 🎯 Custom Providers

### Auth Provider (Example)
```typescript
interface AuthContextValue {
  user: User | null
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing session
    checkSession().then(setUser).finally(() => setIsLoading(false))
  }, [])

  const login = async (credentials: LoginCredentials) => {
    const user = await authenticateUser(credentials)
    setUser(user)
    queryClient.invalidateQueries() // Refetch all queries
  }

  const logout = async () => {
    await signOut()
    setUser(null)
    queryClient.clear() // Clear all cache
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

### Theme Provider (Example)
```typescript
interface ThemeContextValue {
  theme: 'light' | 'dark'
  toggleTheme: () => void
  accentColor: string
  setAccentColor: (color: string) => void
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return localStorage.getItem('theme') as 'light' | 'dark' || 'light'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, ... }}>
      {children}
    </ThemeContext.Provider>
  )
}
```

## 🔄 Provider Patterns

### Provider Composition
```typescript
// Compose multiple providers
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <ThemeProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryProvider>
  )
}
```

### Conditional Providers
```typescript
// Only include providers when needed
export function ConditionalProvider({ children }: { children: React.ReactNode }) {
  const needsSpecialProvider = useFeatureFlag('specialFeature')

  if (needsSpecialProvider) {
    return (
      <SpecialProvider>
        {children}
      </SpecialProvider>
    )
  }

  return <>{children}</>
}
```

## 🚀 Performance Optimization

### Query Client Optimization
```typescript
// Prefetch critical data
export function QueryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Prefetch common queries
    queryClient.prefetchQuery({
      queryKey: ['units'],
      queryFn: fetchUnits,
    })

    queryClient.prefetchQuery({
      queryKey: ['settings'],
      queryFn: fetchSettings,
    })
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

### Provider Memoization
```typescript
// Memoize provider value to prevent unnecessary re-renders
export function OptimizedProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(initialState)

  const value = useMemo(() => ({
    state,
    updateState: setState,
    // Other methods
  }), [state])

  return (
    <Context.Provider value={value}>
      {children}
    </Context.Provider>
  )
}
```

## 🔒 Security Considerations

### Secure Context Values
```typescript
// Don't expose sensitive data in context
export function SecureProvider({ children }: { children: React.ReactNode }) {
  // Don't store sensitive tokens in context
  const [userRole, setUserRole] = useState<Role>()

  // Store tokens securely (httpOnly cookies, secure storage)
  const getAuthToken = useCallback(() => {
    return secureStorage.getToken()
  }, [])

  return (
    <SecureContext.Provider value={{ userRole, getAuthToken }}>
      {children}
    </SecureContext.Provider>
  )
}
```

## 🧪 Testing Providers

```typescript
import { renderHook } from '@testing-library/react-hooks'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Test wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useBookingQuery', () => {
  it('fetches booking data', async () => {
    const { result, waitFor } = renderHook(
      () => useBookingQuery('123'),
      { wrapper: createWrapper() }
    )

    await waitFor(() => result.current.isSuccess)

    expect(result.current.data).toEqual(mockBooking)
  })
})
```

## 📚 Best Practices

1. **Keep Providers Focused**: One concern per provider
2. **Use Composition**: Combine providers cleanly
3. **Memoize Values**: Prevent unnecessary re-renders
4. **Handle Loading States**: Show appropriate UI during initialization
5. **Clean Up Resources**: Clear subscriptions and timers
6. **Type Everything**: Full TypeScript support
7. **Document Dependencies**: Clear provider hierarchy

## 🔧 Configuration

### Environment-based Configuration
```typescript
const getQueryConfig = () => {
  if (process.env.NODE_ENV === 'production') {
    return {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    }
  }

  // Development settings
  return {
    staleTime: 1000,
    gcTime: 1000,
    refetchOnWindowFocus: true,
  }
}
```

## 📝 Provider Guidelines

- **Single Source of Truth**: Providers manage global state
- **Dependency Injection**: Providers inject dependencies
- **Cross-Cutting Concerns**: Handle app-wide features
- **Performance First**: Optimize for minimal re-renders
- **Type Safety**: Full TypeScript coverage