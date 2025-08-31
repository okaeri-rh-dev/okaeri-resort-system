# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

Okaeri Resort System - A Progressive Web Application (PWA) for comprehensive
resort management, designed for Okaeri Resort in La Union, Philippines. Built
with a serverless-first, cost-optimized architecture targeting $1-3/month
operational costs for family business operations.

## Tech Stack

- **Frontend**: React 19, TypeScript 5.8 (strict mode), Vite 7, TanStack Router
  (file-based routing)
- **State Management**: Zustand with Immer, TanStack Query for server state,
  React Hook Form + Zod
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **Backend**: Vercel Serverless Functions (Node.js 20.x), Neon PostgreSQL,
  Drizzle ORM
- **Authentication**: JWT with HTTP-only cookies, refresh token rotation
- **Infrastructure**: Upstash Redis for rate limiting, Edge-optimized deployment

## Essential Commands

### Development

```bash
npm run dev                    # Start development server (port 5173)
npm run build                  # Production build
npm run preview                # Preview production build
npm run type-check             # Run TypeScript validation
```

### Testing (TDD Approach - Always run before committing)

```bash
npm test                       # Run tests in watch mode
npm run test:coverage          # Generate coverage report (90% threshold required)
npm run test:ui                # Open Vitest UI
npm run test:phase1            # Run Phase 1 authentication tests
npm run test:db                # Run database tests
```

### Code Quality (Run before submitting code)

```bash
npm run lint                   # ESLint check
npm run lint:fix               # Auto-fix linting issues
npm run format                 # Prettier formatting
npm run verify:all             # Complete verification suite
```

### Database

```bash
npm run db:generate            # Generate Drizzle migrations
npm run db:migrate             # Apply migrations
npm run db:seed                # Seed development data
npm run db:studio              # Open Drizzle Studio GUI
```

## Architecture Patterns

### Multi-Tenant Database Architecture

- **Schema-based isolation**: Each project gets its own PostgreSQL schema
- **Row-level security**: Additional data protection layer
- **Connection pattern**: Always use `getProjectDb(projectId)` for
  tenant-specific queries
- **Migration strategy**: Migrations apply to all project schemas automatically

### Authentication & Security

- **JWT Storage**: ONLY via HTTP-only cookies (never localStorage)
- **Token Lifecycle**: 15-minute access tokens, 7-day refresh tokens with
  rotation
- **Session Management**: 60-minute timeout with activity tracking
- **Rate Limiting**: Implemented via Upstash Redis (5 attempts/15 minutes for
  login)
- **Security Headers**: Comprehensive CSP, HSTS, X-Frame-Options configured in
  `vercel.json` and middleware

### State Management Strategy

```typescript
// Zustand stores (src/stores/)
authStore     // Authentication state, user session
projectStore  // Multi-project context switching
bookingStore  // Reservation management with optimistic updates
expenseStore  // Financial tracking with offline support
uiStore       // Theme, notifications, loading states

// TanStack Query patterns
- Use for all server state
- Implement optimistic updates for better UX
- Configure stale time based on data volatility
- Use mutation hooks for data modifications
```

### API Route Structure

```
api/
├── _lib/middleware.ts         # Shared auth, CORS, rate limiting
├── auth/[action].ts          # Authentication endpoints
├── [resource]/[action].ts    # RESTful resource endpoints
```

All API routes must:

1. Use middleware from `api/_lib/middleware.ts`
2. Validate input with Zod schemas
3. Return consistent error responses
4. Include proper TypeScript types

### Form Handling Pattern

```typescript
// Always use React Hook Form + Zod
const schema = z.object({...})
const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema)
})
```

## Testing Requirements

### Test Coverage Standards

- **Business Logic**: 90% coverage required
- **API Routes**: Integration tests required
- **Components**: Testing Library for user interactions
- **Database**: Test transactions and rollbacks

### Test File Locations

- Unit tests: `src/**/__tests__/*.test.{ts,tsx}`
- Integration: `tests/integration/`
- E2E: Playwright configuration
- Database: `tests/db/`

### Testing Best Practices

1. Use deterministic data (seeded random values)
2. Mock external services with MSW
3. Test error states and edge cases
4. Verify accessibility with Testing Library queries

## Security Compliance

### Philippine Data Privacy Act (DPA)

- Implement audit logging for all data access
- Ensure data retention policies (configurable per project)
- Include privacy notices in user-facing features
- Encrypt sensitive data at rest

### Financial Compliance

- BIR tax calculation requirements for Philippine operations
- Receipt generation with proper formatting
- Audit trail for all financial transactions

## Performance Optimization

### Bundle Size Management

- Keep initial bundle under 200KB
- Lazy load routes and heavy components
- Use dynamic imports for modals and forms
- Monitor with `npm run analyze`

### Database Query Optimization

- Use connection pooling appropriate for serverless
- Implement cursor-based pagination for large datasets
- Cache frequently accessed data in Redis
- Batch operations where possible

### PWA & Offline Support

- Service worker handles offline caching
- IndexedDB for offline data persistence
- Background sync for deferred actions
- Optimistic UI updates for perceived performance

## Deployment Configuration

### Vercel Settings

- Runtime: Node.js 20.x
- Regions: Cleveland (cle1), Tokyo (hnd1)
- Function memory: 1024MB
- Timeout: 25 seconds
- Environment variables required:
  - `DATABASE_URL` (Neon PostgreSQL)
  - `JWT_SECRET` (Authentication)
  - `UPSTASH_REDIS_REST_URL` (Rate limiting)
  - `UPSTASH_REDIS_REST_TOKEN`

### Build Optimization

- Vite handles code splitting automatically
- Images optimized with responsive loading
- Fonts preloaded for performance
- Critical CSS inlined

## Development Workflow

### Feature Development

1. Create feature branch from `main`
2. Implement with TDD approach
3. Run `npm run verify:all` before committing
4. Ensure 90% test coverage for new code
5. Update relevant documentation

### API Development

1. Define Zod schema for validation
2. Implement endpoint in `api/` directory
3. Add integration tests
4. Update TypeScript types
5. Document in API routes section

### Component Development

1. Check existing components in `src/components/`
2. Follow shadcn/ui patterns
3. Implement with accessibility in mind
4. Add Storybook story (if applicable)
5. Include unit tests

## Common Patterns

### Error Handling

```typescript
// API routes
try {
  // operation
} catch (error) {
  return ApiError.handle(error, context);
}

// Frontend
const { error } = useQuery({
  retry: 3,
  onError: (error) => toast.error(error.message),
});
```

### Data Fetching

```typescript
// Use TanStack Query
const { data, isLoading } = useQuery({
  queryKey: ["resource", id],
  queryFn: () => api.resource.get(id),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

### Form Submission

```typescript
const mutation = useMutation({
  mutationFn: api.resource.create,
  onSuccess: () => {
    queryClient.invalidateQueries(["resource"]);
    toast.success("Created successfully");
  },
});
```

## Important Notes

- **Never commit secrets**: All sensitive data via environment variables
- **Always use TypeScript strict mode**: No `any` types without justification
- **Follow TDD**: Write tests first for business logic
- **Maintain offline support**: Consider offline scenarios for all features
- **Optimize for mobile**: Resort staff primarily use mobile devices
- **Consider costs**: Every architectural decision should consider the
  $1-3/month budget target
