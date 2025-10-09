# 📂 Project Structure Guide

> **A comprehensive visual guide to the Okaeri Resort Management System architecture**

This document provides a detailed overview of the project's file organization, architecture patterns, and module relationships. Use this as your roadmap for navigating and understanding the codebase.

---

## 📋 Quick Navigation

- [Visual Overview](#-visual-overview)
- [Architecture Flow](#-architecture-flow)
- [Directory Structure](#-directory-structure)
  - [Root Level](#root-level-configuration--tooling)
  - [Source Code (`src/`)](#source-code-src)
  - [Serverless Functions (`functions/`)](#serverless-functions-functions)
  - [Database (`database/`)](#database-database)
  - [Documentation (`docs/`)](#documentation-docs)
- [Key Patterns](#-key-patterns)
- [File Naming Conventions](#-file-naming-conventions)

---

## 🎨 Visual Overview

```
okaeri-resort-system/
│
├── 📱 src/                          # React frontend application
│   ├── components/                  # UI components (feature-based)
│   │   ├── bookings/               # Booking management UI
│   │   ├── guests/                 # Guest management UI
│   │   ├── payments/               # Payment processing UI
│   │   ├── expenses/               # Expense tracking UI
│   │   ├── units/                  # Unit management UI
│   │   ├── audit/                  # Audit trail viewer
│   │   ├── dashboard/              # Analytics dashboard
│   │   ├── security/               # Security monitoring
│   │   └── ui/                     # shadcn/ui base components (29 components)
│   │
│   ├── lib/                        # Core utilities & infrastructure
│   │   ├── monitoring/             # Quota & performance monitoring (7 modules)
│   │   ├── security/               # XSS prevention & sanitization
│   │   ├── validation/             # Form validation schemas
│   │   ├── supabase.ts            # Typed database client
│   │   └── audit-logger.ts        # Audit trail system
│   │
│   ├── stores/                     # Zustand state management (10 stores)
│   │   ├── useBookingStore.ts     # Booking state + TanStack Query
│   │   ├── useGuestStore.ts       # Guest data management
│   │   ├── usePaymentStore.ts     # Payment processing state
│   │   └── useExpenseStore.ts     # Expense tracking state
│   │
│   ├── hooks/                      # Custom React hooks (19 hooks)
│   │   └── entity/                 # Reusable entity CRUD hooks
│   │
│   ├── routes/                     # TanStack Router (file-based)
│   │   └── _authenticated/         # Protected routes
│   │       ├── bookings/           # Booking routes
│   │       ├── guests/             # Guest routes
│   │       ├── payments/           # Payment routes
│   │       ├── expenses/           # Expense routes
│   │       └── units/              # Unit routes
│   │
│   └── types/                      # TypeScript definitions
│
├── ⚡ functions/                    # Cloudflare Workers / Serverless API
│   ├── api/                        # API endpoints
│   │   ├── audit/                  # Audit logging with IP tracking
│   │   ├── guest-booking/          # Public booking (unauthenticated)
│   │   └── monitoring/             # Health & quota checks
│   ├── cron/                       # Scheduled tasks
│   └── _middleware.ts              # Global auth, CORS, rate limiting
│
├── 🗄️ database/                     # PostgreSQL schema & migrations
│   ├── schema.sql                  # Core database structure
│   ├── migrations/                 # Versioned SQL migrations (60+ files)
│   │   ├── rollback/               # Migration rollback scripts
│   │   └── backups/                # Schema backups
│   └── scripts/                    # Database utilities
│       └── diagnostics/            # Health check scripts
│
├── 📚 docs/                         # Comprehensive documentation (53 README files)
│   ├── initial/                    # Architecture & planning
│   ├── implementation/             # Feature implementation guides
│   ├── releases/                   # Phase completion handoffs
│   ├── security/                   # Security audits & compliance
│   ├── verification/               # Testing & verification reports
│   └── deployment/                 # Production deployment guides
│
├── 🧪 __tests__/                    # Test suites
│   ├── e2e/                        # Playwright end-to-end tests
│   ├── performance/                # Performance benchmarks
│   └── security/                   # Security & validation tests
│
└── ⚙️ Configuration Files           # Root-level tooling setup
    ├── vite.config.ts              # Build configuration
    ├── tsconfig.json               # TypeScript settings
    ├── CLAUDE.md                   # AI agent instructions
    └── package.json                # Dependencies & scripts
```

---

## 🔄 Architecture Flow

### Data Flow: User Interaction → State → API → Database

```
┌─────────────────┐
│  User Interface │  React 19 Components (shadcn/ui + Tailwind v4)
│   (Components)  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  State Layer    │  Zustand Stores + TanStack Query v5
│   (stores/)     │  • Client state (Zustand)
│                 │  • Server cache (TanStack Query)
│                 │  • Optimistic updates
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  API Layer      │  Supabase Client + Serverless Functions
│   (lib/)        │  • Typed helpers (db.bookings, db.units)
│                 │  • Real-time subscriptions
│                 │  • Cloudflare Workers endpoints
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Database       │  Supabase PostgreSQL
│  (database/)    │  • Row Level Security (RLS)
│                 │  • Audit triggers
│                 │  • Optimized indexes
└─────────────────┘
```

### Security & Monitoring Layer (Cross-Cutting Concerns)

```
┌──────────────────────────────────────────────────────┐
│  Security Layer (lib/security/)                      │
│  • DOMPurify XSS prevention                          │
│  • Input sanitization                                │
│  • File validation                                   │
└──────────────────────────────────────────────────────┘
                         │
                         ↓
┌──────────────────────────────────────────────────────┐
│  Audit Trail (lib/audit-logger.ts)                   │
│  • All data mutations logged                         │
│  • IP tracking + User agent                          │
│  • Compliance-ready                                  │
└──────────────────────────────────────────────────────┘
                         │
                         ↓
┌──────────────────────────────────────────────────────┐
│  Monitoring (lib/monitoring/)                        │
│  • Quota tracking (KV, Email, Bandwidth)             │
│  • Performance metrics                               │
│  • Alert system                                      │
└──────────────────────────────────────────────────────┘
```

---

## 📁 Directory Structure

### Root Level: Configuration & Tooling

```
├── .claude/                 # Claude AI agent configurations
│   └── agents/              # Specialized agent definitions for development
├── .github/                 # GitHub Actions workflows
├── .husky/                  # Git hooks (pre-commit, pre-push)
├── .vscode/                 # VS Code workspace settings
│
├── CLAUDE.md                # AI development instructions (16KB guide)
├── README.md                # Project overview & quick start
├── PROJECT_STRUCTURE.md     # This file
│
├── package.json             # Dependencies & npm scripts
├── tsconfig.json            # TypeScript configuration (strict mode)
├── vite.config.ts           # Vite build configuration (manual chunking)
├── vitest.config.ts         # Test runner configuration
├── eslint.config.js         # ESLint v9 flat config
├── wrangler.toml            # Cloudflare Workers configuration
│
└── components.json          # shadcn/ui component registry
```

**Key Configuration Files:**

- **`vite.config.ts`**: Manual chunk splitting for optimal bundle size
  - Separates: react, ui, data, supabase, utils, forms, icons
  - TypeScript warnings suppressed during Phase 2 build
  - Bundle analysis available via `npm run build:analyze`

- **`tsconfig.json`**: Progressive TypeScript strict mode
  - Phase 3-4 files excluded from strict checks
  - Path aliases configured (`@/` → `src/`)

- **`CLAUDE.md`**: Comprehensive AI agent instructions
  - Essential commands & workflows
  - Architecture patterns
  - Development best practices

---

### Source Code (`src/`)

The React application source code, organized by feature and responsibility.

#### **`src/components/`** - UI Components (Feature-Based Organization)

```
components/
│
├── 📅 bookings/                    # Booking Management
│   ├── BookingForm/                # Multi-step booking creation
│   │   ├── hooks/                  # Form-specific hooks
│   │   ├── steps/                  # Step components (GuestInfo, Dates, Payment)
│   │   ├── types.ts                # Form type definitions
│   │   └── index.tsx               # Main form orchestrator
│   │
│   ├── BookingsTable/              # Advanced booking table
│   │   ├── components/             # Table cells, filters, actions
│   │   ├── hooks/                  # useBookingsTable hook
│   │   └── index.tsx               # Table wrapper
│   │
│   ├── BookingDetail/              # View booking details
│   └── BookingEdit/                # Edit existing booking
│
├── 👥 guests/                      # Guest Management
│   ├── GuestDetail/                # Guest profile view
│   ├── GuestEdit/                  # Guest profile editor
│   └── (guest list components)
│
├── 💳 payments/                    # Payment Processing
│   ├── PaymentDetail/              # Payment details view
│   ├── PaymentEdit/                # Payment editor
│   └── (payment components)
│
├── 📊 expenses/                    # Expense Tracking
│   ├── ExpensesTable/              # Expense data table
│   ├── ExpenseDetail/              # Expense view
│   └── ExpenseEdit/                # Expense editor
│
├── 🏠 units/                       # Unit Management
│   ├── UnitsTable/                 # Unit listing table
│   ├── UnitDetail/                 # Unit details view
│   └── UnitEdit/                   # Unit editor
│
├── 📋 audit/                       # Audit Trail Viewer
│   ├── AuditLogViewer.tsx          # Main audit log component
│   ├── AuditFilters.tsx            # Filter controls
│   └── __tests__/                  # Component tests
│
├── 📈 dashboard/                   # Analytics Dashboard
│   └── (dashboard components)      # KPIs, charts, metrics
│
├── 🔐 security/                    # Security Monitoring
│   └── (security dashboard)        # Threat detection, alerts
│
├── 🌐 guest-booking/               # Public Booking Portal
│   └── (public booking flow)       # Unauthenticated user booking
│
├── 🧩 entity-detail/               # Reusable Entity Patterns
│   ├── components/                 # DetailHeader, DetailCard, etc.
│   ├── utils/                      # Entity utilities
│   └── __tests__/                  # Entity tests (75+ passing)
│
├── 📊 tables/                      # Reusable Table Components
│   └── ResponsiveTableWrapper.tsx  # Mobile-first table wrapper
│
└── 🎨 ui/                          # shadcn/ui Base Components (29 total)
    ├── button.tsx                  # Radix UI Button
    ├── input.tsx                   # Form input
    ├── dialog.tsx                  # Modal dialogs
    ├── table.tsx                   # Table primitives
    └── (26+ more components)       # Complete shadcn/ui library
```

**Component Organization Principles:**

1. **Feature-Based Structure**: Components grouped by domain (bookings, guests, payments)
2. **Sub-Directory Pattern**: Complex features have subdirectories (e.g., `BookingForm/hooks/`, `BookingForm/steps/`)
3. **Reusable Patterns**: Shared patterns in `entity-detail/`, `tables/`, `ui/`
4. **Test Co-Location**: Tests in `__tests__/` directories next to components

---

#### **`src/lib/`** - Core Utilities & Infrastructure

```
lib/
│
├── 📊 monitoring/                   # Resource Monitoring (7 modules)
│   ├── quota-monitor.ts             # KV, Email, Bandwidth tracking
│   ├── alert-system.ts              # Threshold-based alerts
│   ├── cleanup-monitor.ts           # Automated cleanup tasks
│   ├── performance-monitor.ts       # Performance metrics
│   └── README.md                    # Monitoring documentation
│
├── 🔒 security/                     # Security Utilities
│   ├── sanitize.ts                  # DOMPurify XSS prevention
│   ├── sanitize-worker.ts           # Background sanitization
│   └── README.md                    # Security patterns guide
│
├── ✅ validation/                   # Form Validation Schemas
│   └── (Zod schemas for forms)      # Type-safe validation
│
├── 🗄️ supabase.ts                   # Typed Database Client
│   └── Helpers: db.bookings.*, db.units.*, db.guests.*
│
├── 📝 audit-logger.ts               # Audit Trail System
│   └── logAuditEvent() - Compliance logging
│
├── 📝 audit-logger-workers.ts       # Background Audit Processing
│
├── 🔐 auth.ts                       # Authentication Utilities
│
├── 📅 availability.ts               # Availability Engine
│   └── Real-time unit availability calculations
│
├── 📧 email.ts                      # Email Service Integration
│
├── 🎯 query-keys.ts                 # TanStack Query Keys
│   └── Centralized query key factory
│
├── 🛡️ file-validation.ts            # Upload Security
│
└── 🛠️ utils.ts                      # General Utilities
    └── cn() - Tailwind className merger
```

**Key Library Files:**

- **`supabase.ts`**: Central database client with typed helpers

  ```typescript
  // Preferred pattern
  const { data, error } = await db.bookings.byId(id);
  const { data, error } = await db.units.available();
  ```

- **`audit-logger.ts`**: Comprehensive audit trail

  ```typescript
  await logAuditEvent({
    action: "booking.created",
    entity_type: "booking",
    entity_id: booking.id,
    changes: { before: null, after: booking },
  });
  ```

- **`monitoring/`**: Free-tier quota management
  - Tracks KV operations, email sends, bandwidth usage
  - Alerts at 80% threshold
  - Automated cleanup to stay within limits

---

#### **`src/stores/`** - State Management (Zustand + TanStack Query)

```
stores/
│
├── useBookingStore.ts      # Booking state + optimistic updates
├── useGuestStore.ts        # Guest data management
├── usePaymentStore.ts      # Payment processing state
├── useExpenseStore.ts      # Expense tracking state
├── useUnitStore.ts         # Unit management state
├── useAuditStore.ts        # Audit log viewer state
├── useSearchStore.ts       # Global search state
├── useUIStore.ts           # UI state (modals, drawers, themes)
│
├── useWorkflowStore.phase3-4.ts  # Future: Workflow automation
│
└── index.ts                # Store exports
```

**State Management Pattern:**

```typescript
// Zustand store with TanStack Query integration
const useBookingStore = create<BookingState>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        bookings: [],
        isLoading: false,

        // Actions with optimistic updates
        updateBooking: async (id, updates) => {
          // Optimistic update
          set((state) => ({
            bookings: state.bookings.map((b) => (b.id === id ? { ...b, ...updates } : b)),
          }));

          // Actual update
          const { error } = await db.bookings.update(id, updates);
          if (error) {
            // Rollback on error
            queryClient.invalidateQueries(["bookings"]);
          }
        },
      }),
      { name: "booking-store" }
    )
  )
);
```

**Store Responsibilities:**

- **Client State**: UI preferences, temporary data
- **Server State**: Delegated to TanStack Query (caching, revalidation)
- **Optimistic Updates**: Immediate UI feedback with error rollback

---

#### **`src/hooks/`** - Custom React Hooks

```
hooks/
│
├── entity/                  # Reusable entity CRUD hooks
│   ├── useEntityAudit.ts   # Entity audit trail
│   ├── useEntityEdit.ts    # Entity editing logic
│   ├── useEntityDelete.ts  # Entity deletion
│   └── __tests__/          # Hook tests
│
├── useBookingForm.ts       # Booking form state
├── usePaymentForm.ts       # Payment form state
├── useAuth.ts              # Authentication hook
├── useRealtime.ts          # Supabase realtime subscriptions
│
└── (15+ more hooks)        # Feature-specific hooks
```

**Hook Patterns:**

- **Entity Hooks**: Generalized CRUD operations for reuse across entities
- **Form Hooks**: React Hook Form integration with Zod validation
- **Data Hooks**: TanStack Query wrappers for type safety

---

#### **`src/routes/`** - TanStack Router (File-Based Routing)

```
routes/
│
├── __root.tsx              # Root layout + providers
├── index.tsx               # Landing page
│
├── _authenticated/         # Protected routes (requires login)
│   ├── dashboard.tsx       # Analytics dashboard
│   ├── settings.tsx        # User settings
│   ├── audit-logs.tsx      # Audit trail viewer
│   │
│   ├── bookings/           # Booking routes
│   │   ├── index.tsx       # Booking list
│   │   ├── $id.tsx         # Booking detail
│   │   └── new.tsx         # Create booking
│   │
│   ├── guests/             # Guest routes
│   │   ├── index.tsx       # Guest list
│   │   └── $id.tsx         # Guest detail
│   │
│   ├── payments/           # Payment routes
│   │   ├── index.tsx       # Payment list
│   │   └── $id.tsx         # Payment detail
│   │
│   ├── expenses/           # Expense routes
│   │   ├── index.tsx       # Expense list
│   │   └── $id.tsx         # Expense detail
│   │
│   └── units/              # Unit routes
│       ├── index.tsx       # Unit list
│       └── $id.tsx         # Unit detail
│
└── guest-booking/          # Public routes (unauthenticated)
    └── index.tsx           # Guest booking portal
```

**Routing Conventions:**

- **File-Based**: Routes generated from file structure
- **Dynamic Routes**: `$id.tsx` for dynamic parameters
- **Route Groups**: `_authenticated/` for protected routes
- **Layouts**: `__root.tsx` provides global layout

---

#### **`src/types/`** - TypeScript Definitions

```
types/
│
├── database.types.ts       # Generated from Supabase
├── index.ts                # Application types
├── supabase.ts             # Supabase client types
│
└── (entity-specific)       # Booking, Guest, Payment, Unit types
```

**Type System:**

- **Generated Types**: `database.types.ts` auto-generated from Supabase schema
- **Application Types**: Custom types extending database types
- **Strict Mode**: Progressive enablement (Phase 3-4 files excluded during Phase 2)

---

### Serverless Functions (`functions/`)

Cloudflare Workers and serverless API endpoints for backend logic.

```
functions/
│
├── _middleware.ts          # Global middleware
│   ├── Authentication      # JWT validation
│   ├── CORS handling       # Cross-origin requests
│   └── Rate limiting       # DDoS protection
│
├── api/                    # API endpoints
│   │
│   ├── audit/              # Audit Logging API
│   │   ├── log-with-ip.ts  # IP-aware audit logging
│   │   └── README.md       # Audit API docs
│   │
│   ├── guest-booking/      # Public Booking API
│   │   ├── guest-booking.ts # Unauthenticated booking creation
│   │   └── README.md       # Public booking docs
│   │
│   ├── monitoring/         # Monitoring API
│   │   ├── check-quotas.ts # KV/Email/Bandwidth status
│   │   └── README.md       # Monitoring API docs
│   │
│   └── health.ts           # Health check endpoint
│
└── cron/                   # Scheduled Tasks
    └── (cron jobs)         # Automated cleanup, monitoring
```

**API Endpoint Pattern:**

```typescript
// functions/api/example.ts
import type { Request as CloudflareRequest } from "@cloudflare/workers-types";

export async function onRequest(context: {
  request: CloudflareRequest;
  env: Env;
  params: Record<string, string>;
}) {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // API logic
  const data = await processRequest(request, env);

  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

**Key Endpoints:**

- **`/api/audit/log-with-ip`**: IP-tracked audit logging
- **`/api/guest-booking/guest-booking`**: Public booking creation
- **`/api/monitoring/check-quotas`**: Real-time quota status
- **`/api/health`**: System health check

---

### Database (`database/`)

PostgreSQL schema, migrations, and database utilities.

```
database/
│
├── schema.sql              # Core database schema
│   ├── Tables              # bookings, guests, payments, units, expenses
│   ├── RLS Policies        # Row Level Security
│   ├── Triggers            # Audit logging, statistics
│   ├── Functions           # Availability calculations, helpers
│   └── Indexes             # Performance optimization
│
├── migrations/             # Versioned SQL migrations (60+ files)
│   ├── 001-fix-payment-status.sql
│   ├── 002-fix-unit-types.sql
│   ├── 005-create-audit-logs.sql
│   ├── 006-create-audit-triggers.sql
│   │   ...
│   │   (60+ migration files)
│   │
│   ├── rollback/           # Rollback scripts for each migration
│   │   ├── 005-rollback-audit-logs.sql
│   │   └── 006-rollback-audit-triggers.sql
│   │
│   ├── backups/            # Schema snapshots
│   │
│   └── README.md           # Migration guide
│
├── scripts/                # Database utilities
│   ├── diagnostics/        # Health check scripts
│   │   ├── check-connections.sql
│   │   ├── check-indexes.sql
│   │   └── check-rls.sql
│   │
│   └── README.md           # Scripts documentation
│
├── README.md               # Database guide
└── SCHEMA.md               # Complete schema documentation
```

**Migration Workflow:**

1. **Apply Migration**: `psql $DATABASE_URL < migrations/XXX-feature.sql`
2. **Rollback**: `psql $DATABASE_URL < migrations/rollback/XXX-rollback-feature.sql`
3. **Verify**: Run diagnostic scripts

**Key Database Features:**

- **Row Level Security (RLS)**: User-based access control
- **Audit Triggers**: Automatic audit logging for all mutations
- **Optimized Indexes**: Performance tuning for availability queries
- **Real-time Subscriptions**: Supabase Realtime integration

---

### Documentation (`docs/`)

Comprehensive project documentation (53 README files across the project).

```
docs/
│
├── initial/                # Initial Planning & Architecture
│   ├── 01-architecture/    # System design, database ERD
│   ├── 02-development/     # Testing, implementation guides
│   └── 03-deployment/      # Deployment strategies
│
├── implementation/         # Feature Implementation Guides
│   ├── audit-trail/        # Audit system implementation
│   ├── guest-booking-system/ # Public booking flow
│   └── (feature docs)      # Per-feature implementation
│
├── releases/               # Phase Completion Handoffs
│   ├── phase-1/            # Core features release
│   ├── phase-2/            # Security hardening release
│   └── phase-5/            # Enhanced UX release
│
├── security/               # Security Audits & Compliance
│   ├── security-verification.md
│   └── compliance-reports/ # Data privacy compliance
│
├── verification/           # Testing & Verification Reports
│   ├── feature-verification.md
│   └── test-coverage-reports/
│
├── deployment/             # Production Deployment Guides
│   ├── PRODUCTION.md       # Production setup
│   └── vercel-setup.md     # Vercel configuration
│
├── troubleshooting/        # Common Issues & Solutions
│
├── storage-configuration.md # File upload & R2 setup
└── multi-unit-booking/     # Multi-unit booking feature docs
```

**Documentation Categories:**

1. **Architecture**: High-level system design
2. **Implementation**: Step-by-step feature guides
3. **Releases**: Phase completion summaries
4. **Security**: Audits and compliance reports
5. **Verification**: Test results and coverage
6. **Deployment**: Production setup instructions

---

## 🔑 Key Patterns

### 1. Component Organization

**Feature-Based Structure:**

```
components/
├── [feature]/              # Domain-specific feature (e.g., bookings)
│   ├── [Feature]Table/     # Data table component
│   │   ├── components/     # Table-specific sub-components
│   │   ├── hooks/          # Table-specific hooks
│   │   └── index.tsx       # Main table component
│   │
│   ├── [Feature]Form/      # Form component
│   │   ├── steps/          # Multi-step form steps
│   │   ├── hooks/          # Form-specific hooks
│   │   ├── types.ts        # Form types
│   │   └── index.tsx       # Form orchestrator
│   │
│   ├── [Feature]Detail/    # Detail view component
│   └── [Feature]Edit/      # Edit component
```

### 2. State Management Pattern

**Hybrid Approach (Zustand + TanStack Query):**

```typescript
// 1. Define Zustand store for client state
const useBookingStore = create<BookingState>()(
  devtools(
    persist((set) => ({
      selectedBooking: null,
      setSelectedBooking: (booking) => set({ selectedBooking: booking }),
    }))
  )
);

// 2. Use TanStack Query for server state
const useBookings = () =>
  useQuery({
    queryKey: ['bookings'],
    queryFn: () => db.bookings.all(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

// 3. Combine in components
const BookingList = () => {
  const { data: bookings } = useBookings(); // Server state
  const { selectedBooking, setSelectedBooking } = useBookingStore(); // Client state

  return (/* ... */);
};
```

### 3. Database Query Pattern

**Typed Helpers (Preferred):**

```typescript
// ✅ Recommended: Use typed helpers
const { data, error } = await db.bookings.byId(bookingId);
const { data, error } = await db.units.available();
const { data, error } = await db.payments.byBooking(bookingId);

// ❌ Avoid: Direct Supabase client (unless complex query needed)
const { data, error } = await supabase.from("bookings").select("*").eq("id", bookingId);
```

### 4. Security Pattern

**Always Sanitize User Input:**

```typescript
import DOMPurify from "dompurify";

// Sanitize before saving to database
const safeData = {
  name: sanitizeInput(formData.name),
  description: DOMPurify.sanitize(formData.description, {
    ALLOWED_TAGS: ["b", "i", "em", "strong"],
  }),
};

// Validate with Zod
const validated = bookingSchema.parse(safeData);
```

### 5. Audit Logging Pattern

**Log All Data Mutations:**

```typescript
await logAuditEvent({
  action: "booking.created",
  entity_type: "booking",
  entity_id: booking.id,
  changes: {
    before: null,
    after: sanitizeForAudit(booking),
  },
  user_id: session.user.id,
  metadata: {
    ip_address: request.headers.get("cf-connecting-ip"),
    user_agent: request.headers.get("user-agent"),
  },
});
```

---

## 📛 File Naming Conventions

### Phase-Based Development

**Phase 3-4 Files (Future Features):**

Files suffixed with `.phase3-4` are marked for future releases and are **excluded from Phase 2 TypeScript compilation**:

```
src/stores/useWorkflowStore.phase3-4.ts  # Future: Workflow automation
src/components/workflow/...               # Future: Workflow UI
api/workflows.phase3-4/**                 # Future: Workflow API
```

**Exclusion Pattern in `tsconfig.json`:**

```json
{
  "exclude": ["**/*.phase3-4.*", "api/workflows.phase3-4/**", "api/cron/*.phase3-4.*"]
}
```

### Component Naming

- **PascalCase for components**: `BookingForm.tsx`, `GuestTable.tsx`
- **camelCase for utilities**: `sanitize.ts`, `audit-logger.ts`
- **kebab-case for routes**: `guest-booking/`, `audit-logs.tsx`

### Import Paths

**Use Path Aliases:**

```typescript
// ✅ Recommended: Path alias
import { db } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useBookingStore } from "@/stores/useBookingStore";

// ❌ Avoid: Relative paths
import { db } from "../../../lib/supabase";
```

---

## 🗺️ Navigation Tips

### Finding Features

1. **Component**: Look in `src/components/[feature]/`
2. **State Logic**: Check `src/stores/use[Feature]Store.ts`
3. **API Endpoint**: Navigate to `functions/api/[feature]/`
4. **Database Schema**: See `database/schema.sql` or `database/migrations/`
5. **Documentation**: Browse `docs/implementation/[feature]/`

### Common Development Tasks

| Task                 | Location                                |
| -------------------- | --------------------------------------- |
| Add new UI component | `src/components/[feature]/`             |
| Create state store   | `src/stores/use[Feature]Store.ts`       |
| Add API endpoint     | `functions/api/[feature]/`              |
| Database migration   | `database/migrations/XXX-[feature].sql` |
| Add custom hook      | `src/hooks/use[Feature].ts`             |
| Configure route      | `src/routes/_authenticated/[feature]/`  |
| Write tests          | `src/[component]/__tests__/`            |
| Add utility          | `src/lib/[utility].ts`                  |

### Documentation Lookup

| Need                  | File                                                                               |
| --------------------- | ---------------------------------------------------------------------------------- |
| Quick start           | [README.md](./README.md)                                                           |
| Architecture overview | [docs/initial/01-architecture/README.md](./docs/initial/01-architecture/README.md) |
| Security patterns     | [src/lib/security/README.md](./src/lib/security/README.md)                         |
| Testing guide         | [src/**tests**/README.md](./src/__tests__/README.md)                               |
| Database guide        | [database/README.md](./database/README.md)                                         |
| API documentation     | [functions/README.md](./functions/README.md)                                       |
| Deployment guide      | [docs/deployment/PRODUCTION.md](./docs/deployment/PRODUCTION.md)                   |

---

## 🚀 Quick Reference

### Essential npm Scripts

```bash
# Development
npm run dev              # Start dev server (Vite on port 5173)
npm run build            # Production build
npm run preview          # Preview production build

# Code Quality
npm run type-check       # TypeScript validation
npm run lint             # ESLint check
npm run lint:fix         # Auto-fix linting issues
npm run format           # Prettier formatting
npm run verify           # Type-check + lint + test

# Testing
npm test                 # Run tests in watch mode
npm run test:run         # Run all tests once
npm run test:coverage    # Generate coverage report
npm run test:e2e         # Run Playwright E2E tests

# Database
psql $DATABASE_URL < database/migrations/XXX-feature.sql  # Apply migration
```

### Key Technologies

| Category   | Technology               | Version   |
| ---------- | ------------------------ | --------- |
| Framework  | React                    | 19.0      |
| Build Tool | Vite                     | 7.1       |
| Language   | TypeScript               | 5.8       |
| Routing    | TanStack Router          | v1        |
| State      | Zustand + TanStack Query | v5        |
| UI         | shadcn/ui + Radix UI     | Latest    |
| Styling    | Tailwind CSS             | v4 (beta) |
| Database   | Supabase (PostgreSQL)    | Latest    |
| Serverless | Cloudflare Workers       | Latest    |

---

## 📞 Need Help?

- **Troubleshooting**: See [docs/troubleshooting/](./docs/troubleshooting/)
- **Development Guide**: Read [CLAUDE.md](./CLAUDE.md) for comprehensive dev instructions
- **Architecture Questions**: Check [docs/initial/01-architecture/](./docs/initial/01-architecture/)
- **Issues**: Report at GitHub Issues

---

**Built with ❤️ for the Philippine hospitality industry**

_Last updated: 2025-10-09_
