# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development

```bash
npm run dev              # Start development server (Vite on port 5173)
npm run build            # Type-check and build for production
npm run preview          # Preview production build
npm run clean            # Clean build artifacts
```

### Code Quality

```bash
npm run type-check       # TypeScript type checking
npm run lint             # ESLint code linting
npm run lint:fix         # Auto-fix linting issues
npm run format           # Prettier code formatting
npm run verify           # Run type-check, lint, and tests
npm run verify:fix       # Auto-fix formatting and linting
```

### Testing

```bash
npm test                 # Run tests in watch mode (Vitest)
npm run test:run         # Run all tests once
npm run test:coverage    # Run tests with coverage report
npm run test:ui          # Launch Vitest UI
npm run test:e2e         # Run Playwright E2E tests
npm run test:performance # Run performance tests
npm run test:security    # Run security tests
npm run test:all         # Run both unit and E2E tests
npm run test:watch       # Run tests in watch mode

# Run specific test files
npx vitest run src/components/bookings/__tests__/BookingForm.test.tsx
npx vitest run --grep "should validate payment amount"
```

### Build Analysis

```bash
npm run build:analyze    # Build and open bundle analyzer
npm run build:size       # Analyze bundle size
npm run build:dev        # Development build with TypeScript checking
```

## Architecture Overview

### Tech Stack Core

- **Frontend**: React 19 + TypeScript + Vite 7
- **Routing**: TanStack Router v1 with file-based routing
- **State Management**: Zustand + TanStack Query (v5)
- **UI Framework**: shadcn/ui + Radix UI + Tailwind CSS v4 (beta)
- **Forms**: React Hook Form + Zod validation
- **Backend**: Supabase (PostgreSQL) + Vercel serverless functions

### Project Structure

```
src/
├── components/         # React components organized by feature
│   ├── ui/            # Reusable shadcn/ui components
│   ├── bookings/      # Booking management components
│   ├── guests/        # Guest management components
│   ├── payments/      # Payment processing components
│   └── units/         # Unit management components
├── stores/            # Zustand state stores
├── routes/            # TanStack Router route definitions
├── lib/               # Core utilities and configurations
│   └── supabase.ts    # Database client and typed helpers
├── types/             # TypeScript type definitions
├── hooks/             # Custom React hooks
└── utils/             # Utility functions
```

### State Management Architecture

The application uses a hybrid state management pattern:

- **Zustand**: Client-side application state and UI state
- **TanStack Query**: Server state caching, synchronization, and mutations
- **React Hook Form**: Form state and validation
- **Supabase Realtime**: Real-time data subscriptions

### Database Architecture

Supabase PostgreSQL with optimized queries via `src/lib/supabase.ts`:

- Typed database client with helper methods (`db.units`, `db.bookings`, etc.)
- Row Level Security (RLS) policies
- Real-time subscriptions for live updates
- Cached availability calculations for performance
- File storage integration

### Key Modules

#### Booking Management

- Real-time availability checking with optimized database functions
- Automated booking reference generation
- Multi-unit availability searches
- Optimistic UI updates for better UX

#### State Stores

- `useBookingStore`: Booking management with TanStack Query integration
- `usePaymentStore`: Payment processing and status tracking
- Individual stores follow consistent patterns with optimistic updates

#### Type System

- Generated types from Supabase: `database.types.ts`
- Application types: `src/types/index.ts`
- Strict TypeScript configuration with progressive enhancement

## Development Workflow

### File Organization Patterns

- Components are organized by domain (bookings, guests, payments, units)
- Each feature module includes its own types, hooks, and utilities
- UI components follow shadcn/ui conventions
- Stores are co-located with their related components when possible

### State Management Patterns

```typescript
// Zustand store with TanStack Query integration pattern
const useFeatureStore = create<FeatureState>()(
  devtools(
    persist(
      (set, get) => ({
        // state
        items: [],
        isLoading: false,

        // actions with optimistic updates
        updateItem: async (id, updates) => {
          // Optimistic update
          set((state) => ({
            items: state.items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
          }));

          // Actual update
          const { error } = await db.items.update(id, updates);
          if (error) {
            // Rollback on error
            queryClient.invalidateQueries(["items"]);
          }
        },
      }),
      { name: "feature-store" }
    )
  )
);

// TanStack Query with Zustand
const useFeatureQuery = () =>
  useQuery({
    queryKey: ["feature"],
    queryFn: () => db.feature.all(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

// Mutation with optimistic updates
const mutation = useMutation({
  mutationFn: (data) => db.bookings.create(data),
  onMutate: async (newData) => {
    await queryClient.cancelQueries(["bookings"]);
    const previous = queryClient.getQueryData(["bookings"]);
    queryClient.setQueryData(["bookings"], (old) => [...old, newData]);
    return { previous };
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(["bookings"], context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries(["bookings"]);
  },
});
```

### Database Query Patterns

Use the typed helpers from `src/lib/supabase.ts`:

```typescript
// Preferred typed helpers approach
const { data, error } = await db.bookings.byId(bookingId);
const { data, error } = await db.units.available();
const { data, error } = await db.payments.byBooking(bookingId);

// Real-time subscriptions
const subscription = supabase
  .channel("bookings-changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, (payload) => {
    // Handle real-time updates
    queryClient.invalidateQueries(["bookings"]);
  })
  .subscribe();

// Direct supabase client when needed for complex queries
const { data, error } = await supabase
  .from("bookings")
  .select("*, unit:units(*), guest:guests(*)")
  .gte("check_in_date", startDate)
  .lte("check_out_date", endDate);
```

### Component Patterns

- Use shadcn/ui components as base building blocks
- Follow React Hook Form + Zod for form handling
- Implement loading states and error boundaries
- Use Tailwind CSS v4 features and design tokens

### Form Validation Patterns

```typescript
// Zod schema with custom validations
const bookingSchema = z.object({
  check_in_date: z
    .string()
    .refine((date) => new Date(date) >= new Date(), "Check-in date must be in the future"),
  guest_count: z.number().min(1).max(10),
  payment_amount: z.number().positive(),
  notes: z.string().transform((val) => DOMPurify.sanitize(val)),
});

// React Hook Form integration
const form = useForm<BookingFormData>({
  resolver: zodResolver(bookingSchema),
  defaultValues: {
    /* ... */
  },
});
```

### Security Patterns

```typescript
// XSS Prevention with DOMPurify
import DOMPurify from "dompurify";

// Sanitize user input
const sanitizedHTML = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ["b", "i", "em", "strong", "a"],
  ALLOWED_ATTR: ["href"],
});

// Validate and sanitize in Zod schemas
const secureSchema = z.object({
  description: z.string().transform((val) => DOMPurify.sanitize(val)),
});
```

## Performance Considerations

### Build Optimization

- Manual chunk splitting for vendor libraries configured in `vite.config.ts`
- Bundle analysis available via `npm run build:analyze`
- Optimized for Vercel deployment with chunk size limits
- TypeScript warnings suppressed during Phase 2 build (see `vite.config.ts`)
- Chunk strategy splits by: react, ui, data, supabase, utils, forms, icons

### Database Performance

- Availability queries use cached functions and indexes
- Real-time subscriptions are scoped to minimize data transfer
- Optimistic updates reduce perceived latency
- Use database helper methods for type safety and performance

### Code Quality Standards

- Pre-commit hooks enforce formatting and linting
- TypeScript strict mode progressively enabled
- Comprehensive test coverage for critical paths
- ESLint with TypeScript and React rules

## Environment Setup

Required environment variables in `.env.local`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Vercel API Functions

The `/api` directory contains serverless functions:

```
api/
├── health.ts           # Health check endpoint
├── cron/              # Scheduled tasks (not deployed in Phase 2)
└── workflows.phase3-4/ # Advanced workflow APIs (future phases)
```

### Creating New API Endpoints

```typescript
// api/example.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers if needed
  res.setHeader("Access-Control-Allow-Origin", "*");

  // API logic
  return res.status(200).json({ success: true });
}
```

## Phase-Based Development

The codebase follows a phased development approach:

- Phase 1-2: Core functionality and security hardening (completed)
- Phase 3-4: Advanced features (some components suffixed with `.phase3-4`)
- Phase 5: Enhanced UX and modal implementations (current)

Files excluded from TypeScript compilation during Phase 2:

- `**/*.phase3-4.*`
- `api/workflows.phase3-4/**`
- `api/cron/*.phase3-4.*`

## Testing Strategy

- Unit tests for utilities and hooks
- Integration tests for database operations
- E2E tests for critical user workflows
- Performance tests for availability calculations
- Security tests for data validation and XSS prevention

### Running Specific Tests

```bash
# Test a specific component
npx vitest run src/components/bookings/__tests__/BookingForm.test.tsx

# Test by pattern matching
npx vitest run --grep "payment validation"

# Test with coverage for specific path
npx vitest run --coverage src/stores/

# Debug test in UI mode
npx vitest --ui --inspect
```

## Important Notes

- Always run `npm run verify` before committing changes
- Use the typed database helpers instead of raw Supabase queries when possible
- Follow the existing component patterns and file organization
- Maintain backwards compatibility when refactoring stores or types
- Phase 3-4 components may have different patterns - check file suffixes
- Build warnings for TypeScript are expected during Phase 2 development
- Always sanitize user input with DOMPurify for XSS prevention
- Use optimistic updates for better perceived performance
