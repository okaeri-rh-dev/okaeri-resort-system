# 🛣️ Routing Architecture

## Overview

The Okaeri Resort System uses TanStack Router v1 with file-based routing for type-safe, performant navigation. Routes are automatically generated from the file structure, providing excellent developer experience with TypeScript support.

## 📁 Route Structure

```
routes/
├── __root.tsx              # Root layout wrapper
├── index.tsx               # Home page (/)
├── login.tsx               # Login page (/login)
├── _404.tsx                # 404 error page
├── _authenticated.tsx      # Protected route layout
└── _authenticated/         # Protected routes
    ├── index.tsx           # Dashboard (/dashboard)
    ├── bookings/
    │   ├── index.tsx       # Bookings list (/bookings)
    │   ├── new.tsx         # New booking (/bookings/new)
    │   └── $bookingId.tsx  # Booking detail (/bookings/:bookingId)
    ├── guests/
    │   ├── index.tsx       # Guests list (/guests)
    │   └── $guestId.tsx    # Guest detail (/guests/:guestId)
    ├── units/
    │   ├── index.tsx       # Units list (/units)
    │   └── $unitId.tsx     # Unit detail (/units/:unitId)
    ├── payments/
    │   └── index.tsx       # Payments (/payments)
    ├── expenses/
    │   └── index.tsx       # Expenses (/expenses)
    └── settings/
        └── index.tsx       # Settings (/settings)
```

## 🔐 Route Authentication

### Protected Route Layout
```typescript
// _authenticated.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { validateAuth } from '@/lib/auth'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    const user = await validateAuth()

    if (!user) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }

    return { user }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext()

  return (
    <div className="authenticated-layout">
      <Header user={user} />
      <Sidebar />
      <main>
        <Outlet />
      </main>
    </div>
  )
}
```

## 📍 Route Definitions

### Root Route (`__root.tsx`)
```typescript
import { createRootRoute } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'

export const Route = createRootRoute({
  component: RootComponent,
  beforeLoad: () => {
    return {
      queryClient: new QueryClient(),
    }
  },
  errorComponent: ErrorBoundary,
  pendingComponent: LoadingSpinner,
})
```

### Dynamic Routes
```typescript
// $bookingId.tsx - Dynamic parameter route
export const Route = createFileRoute(
  '/_authenticated/bookings/$bookingId'
)({
  parseParams: (params) => ({
    bookingId: z.string().parse(params.bookingId),
  }),
  stringifyParams: ({ bookingId }) => ({ bookingId }),
  loader: async ({ params }) => {
    const booking = await db.bookings.byId(params.bookingId)
    if (!booking) throw new Error('Booking not found')
    return booking
  },
  component: BookingDetail,
})
```

### Search Parameters
```typescript
// bookings/index.tsx - With search params
export const Route = createFileRoute('/_authenticated/bookings/')({
  validateSearch: z.object({
    page: z.number().optional().default(1),
    status: z.enum(['all', 'pending', 'confirmed']).optional(),
    search: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps }) => {
    return await fetchBookings(deps.search)
  },
  component: BookingsList,
})
```

## 🎯 Route Navigation

### Programmatic Navigation
```typescript
import { useNavigate } from '@tanstack/react-router'

function BookingForm() {
  const navigate = useNavigate()

  const handleSubmit = async (data) => {
    const booking = await createBooking(data)

    // Navigate to booking detail
    await navigate({
      to: '/bookings/$bookingId',
      params: { bookingId: booking.id },
    })
  }
}
```

### Link Components
```tsx
import { Link } from '@tanstack/react-router'

// Type-safe links
<Link
  to="/bookings/$bookingId"
  params={{ bookingId: booking.id }}
  className="booking-link"
  activeProps={{
    className: 'active',
  }}
>
  View Booking
</Link>

// With search params
<Link
  to="/bookings"
  search={{
    page: 2,
    status: 'confirmed',
  }}
>
  Confirmed Bookings
</Link>
```

## 🔄 Route Loading

### Data Loading Patterns
```typescript
// Parallel data loading
export const Route = createFileRoute('/_authenticated/dashboard')({
  loader: async () => {
    const [metrics, bookings, guests] = await Promise.all([
      fetchDashboardMetrics(),
      fetchRecentBookings(),
      fetchRecentGuests(),
    ])

    return { metrics, bookings, guests }
  },
  component: Dashboard,
  errorComponent: DashboardError,
  pendingComponent: DashboardSkeleton,
})
```

### Route Context
```typescript
// Share data between routes
export const Route = createFileRoute('/_authenticated')({
  loader: async () => {
    const [user, settings, notifications] = await Promise.all([
      fetchCurrentUser(),
      fetchUserSettings(),
      fetchNotifications(),
    ])

    return { user, settings, notifications }
  },
})

// Access in child routes
function ChildComponent() {
  const { user, settings } = Route.useRouteContext()
  return <div>Welcome, {user.name}</div>
}
```

## 🎨 Route Transitions

### Loading States
```typescript
export const Route = createFileRoute('/bookings')({
  pendingComponent: () => (
    <div className="animate-pulse">
      <BookingTableSkeleton />
    </div>
  ),
  pendingMs: 200, // Show after 200ms
  pendingMinMs: 500, // Show for at least 500ms
})
```

### Error Boundaries
```typescript
export const Route = createFileRoute('/units/$unitId')({
  errorComponent: ({ error, reset }) => (
    <ErrorPage
      error={error}
      reset={reset}
      message="Failed to load unit details"
    />
  ),
})
```

## 🔍 Route Search & Filters

### Persistent Filters
```typescript
// Maintain filter state across navigation
export const Route = createFileRoute('/_authenticated/guests')({
  validateSearch: guestFilterSchema,
  preSearchFilters: [
    // Persist these search params
    (search) => ({
      page: search.page,
      sort: search.sort,
    }),
  ],
  component: GuestList,
})
```

## 🏗️ Route Patterns

### Modal Routes
```typescript
// Modal as a route
export const Route = createFileRoute(
  '/_authenticated/bookings/$bookingId/edit'
)({
  component: () => {
    const navigate = useNavigate()
    const { bookingId } = Route.useParams()

    return (
      <Modal
        isOpen
        onClose={() => navigate({ to: '..' })}
      >
        <BookingEditForm bookingId={bookingId} />
      </Modal>
    )
  },
})
```

### Nested Layouts
```typescript
// units/__layout.tsx
export const Route = createFileRoute('/_authenticated/units')({
  component: () => (
    <div className="units-layout">
      <UnitsHeader />
      <Outlet />
      <UnitsFooter />
    </div>
  ),
})
```

## ⚡ Route Optimization

### Code Splitting
```typescript
// Lazy load heavy components
const ExpenseReports = lazy(() => import('./ExpenseReports'))

export const Route = createFileRoute('/_authenticated/expenses/reports')({
  component: () => (
    <Suspense fallback={<ReportsSkeleton />}>
      <ExpenseReports />
    </Suspense>
  ),
})
```

### Prefetching
```typescript
// Prefetch on hover
<Link
  to="/units/$unitId"
  params={{ unitId }}
  preload="intent" // Prefetch on hover
  preloadDelay={200}
>
  View Unit
</Link>
```

## 🧪 Testing Routes

```typescript
import { createMemoryHistory, createRouter } from '@tanstack/react-router'

describe('Route Navigation', () => {
  it('redirects to login when not authenticated', async () => {
    const router = createRouter({
      history: createMemoryHistory({
        initialEntries: ['/bookings'],
      }),
      routeTree,
    })

    await router.load()

    expect(router.state.location.pathname).toBe('/login')
  })
})
```

## 📚 Route Utilities

### Route Helpers
```typescript
// Get current route
import { useRouter } from '@tanstack/react-router'

function useCurrentRoute() {
  const router = useRouter()
  return router.state.location
}

// Check active route
function useIsActive(to: string) {
  const router = useRouter()
  return router.matchRoute({ to })
}
```

### Route Guards
```typescript
// Role-based route guard
export const adminGuard = async ({ context }) => {
  if (!context.user?.isAdmin) {
    throw redirect({
      to: '/unauthorized',
    })
  }
}

// Apply to route
export const Route = createFileRoute('/_authenticated/admin')({
  beforeLoad: adminGuard,
  component: AdminPanel,
})
```

## 🔧 Configuration

### Router Setup
```typescript
// main.tsx
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadDelay: 200,
  defaultGcTime: 10 * 60 * 1000, // 10 minutes
  context: {
    queryClient,
    auth: undefined!,
  },
})

// Type registration
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

## 📝 Route Metadata

```typescript
export const Route = createFileRoute('/bookings')({
  meta: ({ data }) => [
    { title: `Bookings (${data?.total || 0})` },
    { name: 'description', content: 'Manage resort bookings' },
  ],
})
```

## 🎯 Best Practices

1. **Use Type-Safe Navigation**: Always use typed `Link` components
2. **Implement Loading States**: Provide feedback during navigation
3. **Handle Errors Gracefully**: Use error boundaries
4. **Optimize with Code Splitting**: Lazy load heavy routes
5. **Prefetch Critical Routes**: Use `preload` for better UX
6. **Validate Search Params**: Use Zod schemas
7. **Share Context Wisely**: Use route context for shared data