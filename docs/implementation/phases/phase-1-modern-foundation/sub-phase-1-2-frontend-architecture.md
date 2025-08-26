# Sub-Phase 1.2: Frontend Architecture Foundation

## Overview

This sub-phase establishes the core frontend architecture using TanStack Router
for file-based routing, shadcn/ui for the component library, and Tailwind CSS v4
for styling. It creates the foundational UI structure that will support all user
interactions throughout the application.

## Objectives

1. Implement TanStack Router with type-safe file-based routing
2. Integrate shadcn/ui component library with customization
3. Configure Tailwind CSS v4 with modern features
4. Create base layout components and navigation structure
5. Establish responsive design patterns and accessibility standards

## Technical Requirements

### Core Dependencies

```json
{
  "dependencies": {
    "@tanstack/react-router": "^1.114.3",
    "@tanstack/router-devtools": "^1.114.3",
    "@tanstack/router-vite-plugin": "^1.114.3",
    "@radix-ui/react-accordion": "^1.2.0",
    "@radix-ui/react-alert-dialog": "^1.1.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-navigation-menu": "^1.2.0",
    "@radix-ui/react-popover": "^1.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-switch": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-toast": "^1.2.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.468.0",
    "tailwind-merge": "^2.7.0",
    "tailwindcss-animate": "^1.0.0"
  },
  "devDependencies": {
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "autoprefixer": "^10.4.0"
  }
}
```

### TanStack Router Configuration

```typescript
// vite.config.ts updates
import { TanStackRouterVite } from "@tanstack/router-vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
  ],
});
```

### Router Setup

```typescript
// src/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { RootLayout } from '@/components/layout/RootLayout'

export const Route = createRootRoute({
  component: () => (
    <RootLayout>
      <Outlet />
      <TanStackRouterDevtools position="bottom-right" />
    </RootLayout>
  ),
  notFoundComponent: () => <NotFoundPage />,
})
```

## Implementation Steps

### Step 1: Install and Configure TanStack Router

```typescript
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import './index.css'

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  context: {
    auth: undefined!, // Will be provided by auth context
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
```

### Step 2: Create Route Structure

```typescript
// src/routes structure
routes/
├── __root.tsx                    # Root layout
├── index.tsx                     # Home page (/)
├── login.tsx                     # Login page (/login)
├── register.tsx                  # Register page (/register)
├── dashboard/
│   ├── _layout.tsx              # Dashboard layout
│   ├── index.tsx                # Dashboard home (/dashboard)
│   └── $projectId/              # Dynamic project routes
│       ├── _layout.tsx          # Project layout
│       ├── index.tsx            # Project dashboard
│       ├── bookings/
│       │   ├── index.tsx        # Bookings list
│       │   ├── new.tsx          # New booking
│       │   └── $bookingId.tsx  # Booking details
│       ├── expenses/
│       │   ├── index.tsx        # Expenses list
│       │   ├── new.tsx          # New expense
│       │   └── $expenseId.tsx  # Expense details
│       └── reports/
│           └── index.tsx        # Reports page
```

### Step 3: Configure Tailwind CSS v4

```css
/* src/index.css */
@import "tailwindcss";

@theme {
  --font-sans: "Inter", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", monospace;

  /* Modern oklch color palette */
  --color-primary-50: oklch(97% 0.02 280);
  --color-primary-100: oklch(94% 0.04 280);
  --color-primary-200: oklch(88% 0.08 280);
  --color-primary-300: oklch(80% 0.12 280);
  --color-primary-400: oklch(68% 0.16 280);
  --color-primary-500: oklch(55% 0.2 280);
  --color-primary-600: oklch(45% 0.18 280);
  --color-primary-700: oklch(38% 0.16 280);
  --color-primary-800: oklch(32% 0.14 280);
  --color-primary-900: oklch(26% 0.12 280);

  /* Semantic colors */
  --color-background: oklch(99% 0 0);
  --color-foreground: oklch(10% 0 0);
  --color-muted: oklch(96% 0 0);
  --color-muted-foreground: oklch(45% 0 0);
  --color-card: oklch(99% 0 0);
  --color-card-foreground: oklch(10% 0 0);
  --color-border: oklch(90% 0 0);
  --color-input: oklch(90% 0 0);

  /* Radius */
  --radius-sm: 0.125rem;
  --radius: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-2xl: 1.5rem;
}

@media (prefers-color-scheme: dark) {
  @theme {
    --color-background: oklch(10% 0 0);
    --color-foreground: oklch(98% 0 0);
    --color-muted: oklch(15% 0 0);
    --color-muted-foreground: oklch(65% 0 0);
    --color-card: oklch(10% 0 0);
    --color-card-foreground: oklch(98% 0 0);
    --color-border: oklch(20% 0 0);
    --color-input: oklch(20% 0 0);
  }
}
```

```javascript
// tailwind.config.js
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
```

### Step 4: Setup shadcn/ui Components

```typescript
// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

```typescript
// src/components/ui/button.tsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

### Step 5: Create Layout Components

```typescript
// src/components/layout/RootLayout.tsx
import type { ReactNode } from 'react'
import { Toaster } from '@/components/ui/toaster'

interface RootLayoutProps {
  children: ReactNode
}

export function RootLayout({ children }: RootLayoutProps) {
  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      {children}
      <Toaster />
    </div>
  )
}
```

```typescript
// src/components/layout/DashboardLayout.tsx
import { Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { NavigationMenu } from '@/components/ui/navigation-menu'
import {
  Home,
  Calendar,
  DollarSign,
  FileText,
  Settings,
  LogOut
} from 'lucide-react'

export function DashboardLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card">
        <div className="flex h-full flex-col">
          <div className="p-6">
            <h1 className="text-2xl font-bold">Okaeri Resort</h1>
          </div>

          <nav className="flex-1 px-4">
            <ul className="space-y-2">
              <li>
                <Link
                  to="/dashboard"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
                  activeProps={{ className: 'bg-accent' }}
                >
                  <Home className="h-4 w-4" />
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  to="/dashboard/$projectId/bookings"
                  params={{ projectId: 'current' }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
                  activeProps={{ className: 'bg-accent' }}
                >
                  <Calendar className="h-4 w-4" />
                  Bookings
                </Link>
              </li>
              <li>
                <Link
                  to="/dashboard/$projectId/expenses"
                  params={{ projectId: 'current' }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
                  activeProps={{ className: 'bg-accent' }}
                >
                  <DollarSign className="h-4 w-4" />
                  Expenses
                </Link>
              </li>
              <li>
                <Link
                  to="/dashboard/$projectId/reports"
                  params={{ projectId: 'current' }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
                  activeProps={{ className: 'bg-accent' }}
                >
                  <FileText className="h-4 w-4" />
                  Reports
                </Link>
              </li>
            </ul>
          </nav>

          <div className="border-t p-4">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                // Logout logic
                navigate({ to: '/login' })
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
```

## Type Definitions

### Route Types

```typescript
// src/types/routes.ts
import type { FileRoutesByPath } from "@tanstack/react-router";

export type RoutePaths = keyof FileRoutesByPath;

export interface RouteContext {
  auth: {
    isAuthenticated: boolean;
    user: User | null;
    projectId: string | null;
  };
}

export interface SearchParams {
  page?: number;
  limit?: number;
  sort?: string;
  filter?: Record<string, unknown>;
}
```

### Component Types

```typescript
// src/types/components.ts
export interface LayoutProps {
  children: ReactNode;
}

export interface PageProps<T = unknown> {
  params?: T;
  searchParams?: SearchParams;
}

export interface NavigationItem {
  label: string;
  href: string;
  icon?: ReactNode;
  children?: NavigationItem[];
  requiredPermission?: string;
}
```

## Test Requirements

### Component Testing

```typescript
// tests/unit/components/Button.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/button'

describe('Button Component', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-primary')
  })

  it('handles click events', async () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)

    await userEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('respects disabled state', () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveClass('disabled:opacity-50')
  })
})
```

### Route Testing

```typescript
// tests/integration/routing.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'

describe('Routing', () => {
  it('navigates to dashboard', async () => {
    const router = createMemoryRouter({
      routeTree,
      initialLocation: '/dashboard',
    })

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })
  })

  it('shows 404 for unknown routes', async () => {
    const router = createMemoryRouter({
      routeTree,
      initialLocation: '/unknown-route',
    })

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByText('Page not found')).toBeInTheDocument()
    })
  })
})
```

## Agent Validation Checklist

### tailwind-v4-design-expert Validation

- [ ] Design system architecture established
- [ ] Component styling patterns defined
- [ ] Responsive breakpoints configured
- [ ] Dark mode implementation working
- [ ] Animation utilities created
- [ ] Typography scale defined
- [ ] Spacing system consistent
- [ ] Color palette properly structured

### resort-ui-designer Validation

- [ ] Mobile-first responsive design implemented
- [ ] Accessibility standards met (WCAG 2.1 AA)
- [ ] Touch-friendly interface elements
- [ ] Consistent spacing and typography
- [ ] Philippine business context considered
- [ ] Dark mode support configured
- [ ] Loading states for all async operations
- [ ] Error states with clear messaging

### pwa-performance-optimizer Validation

- [ ] Lighthouse score > 95 for performance
- [ ] First Contentful Paint < 1.5s
- [ ] Cumulative Layout Shift < 0.1
- [ ] Code splitting implemented for routes
- [ ] Images optimized and lazy loaded
- [ ] CSS purged of unused styles
- [ ] Bundle size < 150KB for initial load
- [ ] Service worker ready structure

## Success Criteria

1. **Routing** - File-based routing fully functional with type safety
2. **Components** - shadcn/ui components integrated and customized
3. **Styling** - Tailwind CSS v4 with modern features working
4. **Responsiveness** - Mobile-first design implemented
5. **Accessibility** - WCAG 2.1 AA standards met
6. **Performance** - Lighthouse scores meet targets
7. **Type Safety** - All components and routes fully typed

## Deliverables

- [ ] Complete routing structure with layouts
- [ ] shadcn/ui component library integrated
- [ ] Tailwind CSS v4 configuration
- [ ] Base layout components (Root, Dashboard, Auth)
- [ ] Navigation components with mobile support
- [ ] Comprehensive component tests
- [ ] Route testing suite
- [ ] Performance optimization implemented

## Completion Checklist

- [ ] TanStack Router configured and working
- [ ] All route files created with proper types
- [ ] shadcn/ui components installed and customized
- [ ] Tailwind CSS v4 with oklch colors configured
- [ ] Layout components responsive and accessible
- [ ] Navigation working on all screen sizes
- [ ] All tests passing with coverage > 80%
- [ ] Agent validations passed
- [ ] Documentation updated
- [ ] Ready for Sub-Phase 1.3

---

_Sub-Phase 1.2 establishes the visual and navigational foundation of the
application with modern, performant, and accessible components._
