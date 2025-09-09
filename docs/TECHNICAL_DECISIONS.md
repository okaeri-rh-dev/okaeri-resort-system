# Technical Decisions - Okaeri Resort Management System

## Overview

This document records all significant technical decisions made during the
development of the Okaeri Resort Management System. Each decision includes
context, alternatives considered, and rationale for the chosen approach.

---

## 1. Authentication Strategy: JWT in Authorization Header

### Decision

Use JWT tokens in Authorization headers with memory-only storage for access
tokens.

### Context

We needed to choose between JWT in headers vs HttpOnly cookies for
authentication. Since JWT tokens in Authorization headers are CSRF-immune by
design (they're not automatically sent by browsers), this simplified our
security architecture.

### Alternatives Considered

#### Option A: JWT in Authorization Header (CHOSEN)

**Pros:**

- CSRF-immune by design - JWT tokens in Authorization headers are not
  automatically sent by browsers, eliminating CSRF attack vectors entirely
- Stateless architecture - no server-side session storage needed
- Mobile-friendly - identical implementation across web/native
- CDN-friendly - can cache responses without cookie concerns
- Microservices ready - easy token forwarding between services

**Cons:**

- XSS vulnerable if stored in localStorage (mitigated by memory-only storage)
- Manual token refresh handling required
- JWT size overhead in each request

#### Option B: HttpOnly Cookie (Not Chosen)

**Pros:**

- XSS protected - JavaScript cannot access HttpOnly cookies
- Automatic transmission by browser
- Server-side session revocation possible

**Cons:**

- CSRF vulnerability requiring additional protection mechanisms (unlike JWT in
  headers which is inherently CSRF-immune)
- Stateful - requires Redis/database for sessions
- CORS complexity for cross-domain requests
- Mobile app complexity with cookie handling

### Implementation Details

```typescript
// Access token: Stored in memory only, 15-30 minute expiry
// Refresh token: Stored in memory (production) or sessionStorage (dev only)
// Token rotation: Refresh tokens rotate on each use
// Security: Tokens bound to device fingerprint
```

### Security Measures

1. **Never store access tokens in localStorage**
2. **Short-lived access tokens** (15-30 minutes)
3. **Refresh token rotation** on each refresh
4. **Device fingerprinting** for token binding
5. **Secure token transmission** (HTTPS only)

---

## 2. Multi-Tenancy: Application-Level Filtering

### Decision

Implement simple application-level filtering with `project_id` column on all
tables. Row-Level Security (RLS) is reserved for future scaling needs beyond 3-5
properties.

### Context

Small to medium Philippine resorts need cost-effective multi-tenancy that can
scale.

### Alternatives Considered

#### Option A: Application-Level Filtering (CHOSEN)

**Pros:**

- Single schema simplifies migrations and maintenance
- Cost-effective - no schema proliferation
- Neon/Supabase optimized for connection pooling
- Easy cross-tenant analytics and reporting
- Simple backup and restore procedures

**Cons:**

- Requires consistent filtering in application code
- No database-level enforcement (acceptable for internal family business use)
- Must be careful with direct SQL queries

#### Option B: Schema-per-Tenant

**Pros:**

- Complete data isolation between tenants
- No row filtering overhead
- Easy per-tenant backup/restore

**Cons:**

- Complex migrations - must run per schema
- Connection pool exhaustion risk
- PostgreSQL schema limits
- Difficult cross-tenant analytics

#### Option C: Database-per-Tenant

**Pros:**

- Ultimate isolation and compliance
- Independent scaling per tenant

**Cons:**

- Very expensive for small resorts
- Complex operational overhead

### Implementation Strategy

```sql
-- Simple approach: Application-level filtering
-- Every table includes project_id
ALTER TABLE bookings ADD COLUMN project_id UUID NOT NULL;

-- Index for performance
CREATE INDEX idx_bookings_project_id ON bookings(project_id);
```

```typescript
// All queries filter by project_id at the service layer
const bookings = await db
  .select()
  .from(bookingsTable)
  .where(eq(bookingsTable.project_id, projectId));
```

### Migration Path

```typescript
// Start with application-level filtering for 1-3 properties
// Monitor growth and complexity
// When managing 10+ properties, consider:
//   1. Evaluate RLS benefits vs complexity
//   2. Implement RLS policies if needed
//   3. Or consider schema-per-tenant for large operations
//   4. Maintain backward compatibility
```

---

## 3. State Management: TanStack Query v5

### Decision

Use TanStack Query v5 (latest stable version) for server state management.

### Context

Documentation initially referenced v6 which doesn't exist. v5 is the current
latest major version.

### Version Clarification

- **Latest stable**: v5.62.7 (as of January 2025)
- **Our version**: v5.62.7
- **Note**: There is no v6 - documentation error has been corrected

### Key Features Utilized

- Query caching and synchronization
- Optimistic updates for better UX
- Automatic background refetching
- Parallel and dependent queries
- Offline support with retry logic

---

## 4. Currency Handling: Decimal.js

### Decision

Use decimal.js library for all monetary calculations to prevent floating-point
errors.

### Context

Financial calculations for Philippine resorts require precise decimal handling
for:

- Philippine Peso amounts
- 12% balance calculations
- Senior citizen (20%) and PWD discounts
- Multi-currency conversions

### Implementation

```typescript
import Decimal from "decimal.js";

// Configure for Philippine Peso (2 decimal places)
Decimal.set({ precision: 10, rounding: Decimal.ROUND_HALF_UP });

// Balance calculation
const addVAT = (amount: Decimal) => amount.mul(1.12);

// Senior/PWD discount
const applySeniorDiscount = (amount: Decimal) => amount.mul(0.8);
```

---

## 5. Testing Strategy: Vitest + React Testing Library

### Decision

Use Vitest for unit/integration tests with React Testing Library for component
testing.

### Rationale

- Vitest is faster than Jest with native ESM support
- Better TypeScript integration
- Compatible with Vite build system
- React Testing Library promotes testing user behavior

### Testing Standards

- Minimum 90% code coverage
- Test user interactions, not implementation
- Mock external services for unit tests
- Use MSW for API mocking

---

## 6. Build Tool: Vite

### Decision

Use Vite for development and production builds.

### Rationale

- Lightning-fast HMR (Hot Module Replacement)
- Native ESM support
- Optimized production builds
- Excellent TypeScript support
- Growing ecosystem

---

## 7. CSS Framework: Tailwind CSS v4 (Beta)

### Decision

Use Tailwind CSS v4 beta with CSS-first configuration approach.

### Context

Tailwind v4 brings significant improvements despite being in beta:

- CSS-first configuration
- Lightning CSS integration
- Improved performance
- Better custom property support

### Risk Mitigation

- Pin exact version to avoid breaking changes
- Document any beta-specific workarounds
- Prepare migration path to stable v4

---

## 8. Database: PostgreSQL with Neon

### Decision

Use Neon's serverless PostgreSQL for all environments.

### Rationale

- Serverless scaling perfect for small resorts
- Branching for development environments
- Automatic backups and point-in-time recovery
- Connection pooling with PgBouncer
- Cost-effective for variable workloads

---

## 9. Deployment: Vercel

### Decision

Deploy on Vercel's Edge Network.

### Rationale

- Excellent Next.js/React support
- Global CDN included
- Automatic SSL certificates
- GitHub integration
- Generous free tier for small businesses

---

## 10. File Storage: Cloudflare R2

### Decision

Use Cloudflare R2 for file storage (images, documents).

### Rationale

- No egress fees (critical for image-heavy resort sites)
- S3-compatible API
- Global distribution
- Cost-effective for Philippine market
- Integrates with Cloudflare CDN

---

## 11. Performance Monitoring: Lighthouse CI

### Decision

Use Lighthouse CI for all performance, accessibility, and SEO monitoring.

### Rationale

- Single tool for multiple metrics
- CI/CD integration
- Free and open source
- Industry-standard metrics
- Automated reporting

### Target Metrics

- Performance: >90
- Accessibility: >95
- Best Practices: >90
- SEO: >90

---

## 12. Error Tracking: Console Logging (Phase 1)

### Decision

Start with structured console logging, prepare for Sentry integration.

### Rationale

- Reduce initial complexity
- No additional cost for MVP
- Can upgrade to Sentry when needed
- Structured logs enable easy migration

---

## Decision Log

| Date       | Decision                     | Impact                       | Revisit Date |
| ---------- | ---------------------------- | ---------------------------- | ------------ |
| 2025-01-28 | JWT in Authorization headers | High - Security architecture | 2025-07-01   |
| 2025-01-28 | Application-level filtering  | High - Database architecture | Stable       |
| 2025-01-28 | TanStack Query v5            | Medium - State management    | 2025-06-01   |
| 2025-01-28 | Decimal.js for currency      | Medium - Financial accuracy  | Stable       |
| 2025-01-28 | Tailwind v4 beta             | Low - UI framework           | 2025-03-01   |

---

## Review Schedule

This document should be reviewed:

- **Quarterly** for major architecture decisions
- **Before each major release** for technology updates
- **When scaling thresholds are met** for infrastructure decisions

---

_Last Updated: January 28, 2025_ _Next Review: April 28, 2025_
