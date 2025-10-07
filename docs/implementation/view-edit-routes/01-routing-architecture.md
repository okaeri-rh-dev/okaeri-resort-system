# Detail & Edit Pages - Routing Architecture

## Overview

This document defines the routing architecture for detail and edit pages across all entities in the Okaeri Resort System using TanStack Router with file-based routing.

## Route Structure

### File Organization

```
src/routes/_authenticated/
├── bookings/
│   ├── $bookingId.tsx        # Detail: /bookings/:bookingId
│   └── $bookingId.edit.tsx   # Edit: /bookings/:bookingId/edit
├── units/
│   ├── $unitId.tsx           # Detail: /units/:unitId
│   └── $unitId.edit.tsx      # Edit: /units/:unitId/edit
├── guests/
│   ├── $guestId.tsx          # Detail: /guests/:guestId
│   └── $guestId.edit.tsx     # Edit: /guests/:guestId/edit
├── payments/
│   ├── $paymentId.tsx        # Detail: /payments/:paymentId
│   └── $paymentId.edit.tsx   # Edit: /payments/:paymentId/edit
└── expenses/
    ├── $expenseId.tsx        # Detail: /expenses/:expenseId
    └── $expenseId.edit.tsx   # Edit: /expenses/:expenseId/edit
```

### Naming Conventions

- **Dynamic segments**: Use `$paramName` (e.g., `$bookingId.tsx`)
- **Edit routes**: Append `.edit` before `.tsx` (e.g., `$bookingId.edit.tsx`)
- **Parameter names**: Match database column names for consistency

## Route Parameter Validation

### Type-Safe Route Params with Zod

Every route validates its parameters at the route level using Zod schemas:

```typescript
// src/routes/_authenticated/bookings/$bookingId.tsx
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bookingParamsSchema = z.object({
  bookingId: z.string().uuid("Invalid booking ID format"),
});

export const Route = createFileRoute("/_authenticated/bookings/$bookingId")({
  params: {
    parse: (params) => bookingParamsSchema.parse(params),
    stringify: (params) => params,
  },
});
```

### Search Param Validation

For query parameters (tabs, filters, etc.):

```typescript
const bookingSearchSchema = z.object({
  tab: z.enum(["details", "payments", "audit"]).optional().default("details"),
  showRelated: z.boolean().optional(),
});

export const Route = createFileRoute("/_authenticated/bookings/$bookingId")({
  validateSearch: bookingSearchSchema,
});
```

## Data Loading Patterns

### Loader Functions

Use loaders for data prefetching **before** component renders:

```typescript
export const Route = createFileRoute("/_authenticated/bookings/$bookingId")({
  loader: async ({ params: { bookingId }, context }) => {
    const { queryClient } = context;

    // Prefetch booking data
    const booking = await queryClient.ensureQueryData({
      queryKey: ["booking", bookingId],
      queryFn: async () => {
        const { data, error } = await db.bookings.byId(bookingId);
        if (error) throw new Error(error.message);
        if (!data) throw new Error("Booking not found");
        return data;
      },
      staleTime: 30_000, // Cache for 30 seconds
    });

    // Prefetch related data
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["audit-logs", "booking", bookingId],
        queryFn: () =>
          fetchAuditLogs({
            entity_type: "booking",
            entity_id: bookingId,
          }),
      }),
      queryClient.prefetchQuery({
        queryKey: ["payments", "booking", bookingId],
        queryFn: () => db.payments.byBooking(bookingId),
      }),
    ]);

    return { booking };
  },
});
```

### Loading States

Define pending components for loading states:

```typescript
export const Route = createFileRoute('/_authenticated/bookings/$bookingId')({
  pendingComponent: () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  ),
})
```

### Error Handling

Route-level error boundaries:

```typescript
export const Route = createFileRoute('/_authenticated/bookings/$bookingId')({
  errorComponent: ({ error, reset }) => (
    <div className="container mx-auto py-12">
      <div className="text-center space-y-4">
        <h2 className="text-xl font-semibold text-red-600">
          Failed to load booking
        </h2>
        <p className="text-neutral-600">{error.message}</p>
        <div className="flex gap-2 justify-center">
          <Button onClick={reset}>Try Again</Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            Go Back
          </Button>
        </div>
      </div>
    </div>
  ),
})
```

## Navigation Patterns

### Type-Safe Link Component

Use TanStack Router's `Link` for type-safe navigation:

```typescript
import { Link } from '@tanstack/react-router'

// Navigate to detail page
<Link
  to="/bookings/$bookingId"
  params={{ bookingId: booking.booking_id }}
  className="text-blue-600 hover:underline"
>
  {booking.booking_reference}
</Link>

// Navigate to edit page
<Link
  to="/bookings/$bookingId/edit"
  params={{ bookingId: booking.booking_id }}
>
  <Button>Edit Booking</Button>
</Link>

// Cross-entity navigation
<Link
  to="/guests/$guestId"
  params={{ guestId: booking.guest_id }}
  className="font-medium text-blue-600"
>
  {booking.guest_name}
</Link>
```

### Programmatic Navigation

Use `useNavigate()` for navigation after mutations:

```typescript
import { useNavigate } from '@tanstack/react-router'

function BookingForm() {
  const navigate = useNavigate()

  const updateBooking = useMutation({
    mutationFn: (data) => db.bookings.update(bookingId, data),
    onSuccess: () => {
      toast.success('Booking updated')
      navigate({
        to: '/bookings/$bookingId',
        params: { bookingId },
      })
    },
  })

  return <form onSubmit={handleSubmit}>...</form>
}
```

### Prefetching on Hover

Optimize perceived performance with prefetching:

```typescript
<Link
  to="/bookings/$bookingId"
  params={{ bookingId }}
  preload="intent"  // Prefetch on hover/focus
>
  {booking.booking_reference}
</Link>
```

## Route Guards

### Authentication Guard

The `_authenticated` layout already handles auth:

```typescript
// src/routes/_authenticated.tsx (existing)
beforeLoad: async ({ context, location }) => {
  if (!context.isAuthenticated) {
    throw redirect({
      to: "/login",
      search: { redirect: location.href },
    });
  }
};
```

### Permission Guards for Edit Routes

Add role-based access control:

```typescript
// src/routes/_authenticated/bookings/$bookingId.edit.tsx
import { isCurrentUserManagerOrAbove } from "@/lib/audit-roles";

export const Route = createFileRoute("/_authenticated/bookings/$bookingId/edit")({
  beforeLoad: async ({ params, context }) => {
    // Check permissions
    const canEdit = await isCurrentUserManagerOrAbove();

    if (!canEdit) {
      throw redirect({
        to: "/bookings/$bookingId",
        params: { bookingId: params.bookingId },
        search: { error: "insufficient_permissions" },
      });
    }

    // Check booking status
    const { data: booking } = await db.bookings.byId(params.bookingId);
    if (booking?.booking_status === "CheckedOut") {
      throw redirect({
        to: "/bookings/$bookingId",
        params: { bookingId: params.bookingId },
        search: { error: "cannot_edit_finalized" },
      });
    }

    return { canEdit };
  },
});
```

## Complete Route Examples

### Detail Route Template

```typescript
// src/routes/_authenticated/bookings/$bookingId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { db } from '@/lib/supabase'
import { BookingDetailPage } from '@/components/bookings/BookingDetail'

const paramsSchema = z.object({
  bookingId: z.string().uuid(),
})

const searchSchema = z.object({
  tab: z.enum(['details', 'payments', 'audit']).optional().default('details'),
})

export const Route = createFileRoute('/_authenticated/bookings/$bookingId')({
  params: {
    parse: (params) => paramsSchema.parse(params),
    stringify: (params) => params,
  },

  validateSearch: searchSchema,

  loader: async ({ params: { bookingId }, context }) => {
    const { queryClient } = context

    const booking = await queryClient.ensureQueryData({
      queryKey: ['booking', bookingId],
      queryFn: async () => {
        const { data, error } = await db.bookings.byId(bookingId)
        if (error) throw new Error(error.message)
        if (!data) throw new Error('Booking not found')
        return data
      },
      staleTime: 30_000,
    })

    return { booking }
  },

  pendingComponent: () => <div className="animate-pulse">Loading...</div>,

  errorComponent: ({ error, reset }) => (
    <div className="error-state">
      <p>{error.message}</p>
      <button onClick={reset}>Retry</button>
    </div>
  ),

  component: BookingDetailPage,
})
```

### Edit Route Template

```typescript
// src/routes/_authenticated/bookings/$bookingId.edit.tsx
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/lib/supabase";
import { BookingEditPage } from "@/components/bookings/BookingEdit";
import { isCurrentUserManagerOrAbove } from "@/lib/audit-roles";

const paramsSchema = z.object({
  bookingId: z.string().uuid(),
});

export const Route = createFileRoute("/_authenticated/bookings/$bookingId/edit")({
  params: {
    parse: (params) => paramsSchema.parse(params),
    stringify: (params) => params,
  },

  beforeLoad: async ({ params }) => {
    const canEdit = await isCurrentUserManagerOrAbove();
    if (!canEdit) {
      throw redirect({
        to: "/bookings/$bookingId",
        params: { bookingId: params.bookingId },
      });
    }
    return { canEdit };
  },

  loader: async ({ params: { bookingId } }) => {
    const { data, error } = await db.bookings.byId(bookingId);
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Booking not found");

    return {
      booking: data,
      initialValues: transformForForm(data),
    };
  },

  component: BookingEditPage,
});
```

## Cross-Entity Navigation Map

| Source Entity   | Clickable Field     | Destination Route      | Params          |
| --------------- | ------------------- | ---------------------- | --------------- |
| Bookings table  | `guest_name`        | `/guests/$guestId`     | `{ guestId }`   |
| Bookings detail | Unit name           | `/units/$unitId`       | `{ unitId }`    |
| Units table     | `unit_name`         | `/units/$unitId`       | `{ unitId }`    |
| Guests table    | `guest_name`        | `/guests/$guestId`     | `{ guestId }`   |
| Guests detail   | Booking ref         | `/bookings/$bookingId` | `{ bookingId }` |
| Payments table  | `booking_reference` | `/bookings/$bookingId` | `{ bookingId }` |
| Payments detail | Booking ref         | `/bookings/$bookingId` | `{ bookingId }` |
| Expenses table  | `description`       | `/expenses/$expenseId` | `{ expenseId }` |

## Performance Optimizations

### Code Splitting

Routes are automatically code-split by Vite:

- Each route becomes its own chunk
- Lazy loaded on navigation
- Reduces initial bundle size

### Prefetching Strategies

```typescript
// Aggressive prefetching for likely navigation
<Link to="/bookings/$bookingId" params={{bookingId}} preload="intent">
  Booking Details
</Link>

// Conditional prefetching
const prefetchBooking = useCallback(() => {
  queryClient.prefetchQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => db.bookings.byId(bookingId),
  })
}, [bookingId])

<button onMouseEnter={prefetchBooking}>
  View Booking
</button>
```

### Stale-While-Revalidate

```typescript
loader: async ({ params, context }) => {
  return context.queryClient.ensureQueryData({
    queryKey: ["booking", params.bookingId],
    queryFn: () => db.bookings.byId(params.bookingId),
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
};
```

## Testing Route Implementations

### Route Test Template

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'

describe('Booking Detail Route', () => {
  it('loads and displays booking data', async () => {
    const mockBooking = {
      booking_id: '123',
      booking_reference: 'BK-001',
      // ... mock data
    }

    vi.mock('@/lib/supabase', () => ({
      db: {
        bookings: {
          byId: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
        },
      },
    }))

    const router = createRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/bookings/123'],
      }),
    })

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByText('BK-001')).toBeInTheDocument()
    })
  })
})
```

## Migration from Modal-Based Views

### Current Implementation (Modal)

```typescript
// Old pattern - modal-based
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <BookingDetails bookingId={selectedId} />
  </DialogContent>
</Dialog>
```

### New Implementation (Route-Based)

```typescript
// New pattern - route-based
<Link to="/bookings/$bookingId" params={{ bookingId }}>
  View Details
</Link>

// The detail page is a full route
```

### Migration Strategy

1. **Phase 1**: Create new routes (coexist with modals)
2. **Phase 2**: Update table actions to use Links
3. **Phase 3**: Remove modal implementations
4. **Phase 4**: Update tests to use route-based navigation

## Troubleshooting

### Common Issues

**Issue**: Route params not validated

- **Solution**: Ensure `params.parse` is defined with Zod schema

**Issue**: Infinite loading state

- **Solution**: Check loader throws errors properly, verify data fetching

**Issue**: Navigation doesn't update URL

- **Solution**: Use `Link` component, not `<a>` tags

**Issue**: Data not prefetched

- **Solution**: Verify `queryClient` is in route context

**Issue**: Permission redirect loops

- **Solution**: Check `beforeLoad` doesn't redirect to itself

## Reference Links

- [TanStack Router Docs](https://tanstack.com/router/latest)
- [File-Based Routing Guide](https://tanstack.com/router/latest/docs/guide/file-based-routing)
- [Route Loaders](https://tanstack.com/router/latest/docs/guide/data-loading)
- [Type Safety](https://tanstack.com/router/latest/docs/guide/type-safety)
