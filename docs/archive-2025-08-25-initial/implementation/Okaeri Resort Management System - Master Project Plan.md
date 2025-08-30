# Okaeri Resort Management System - Master Project Plan

## Project Overview

**Project Name:** Okaeri Resort Management System (ORMS)  
**Type:** Progressive Web Application (PWA) - Full-Stack Serverless  
**Purpose:** Comprehensive management dashboard for Okaeri Resort operations
with multi-project scalability  
**Target Users:** Family-owned resort business (Owner, Manager, Staff)

## Core Objectives

1. **Centralized Management Dashboard** - Single interface for all resort
   operations
2. **Multi-Project Architecture** - Scalable system for future business
   expansion
3. **Financial Tracking** - Income and expense management with reporting
4. **Booking Management** - Handle Airbnb and FB Messenger bookings
5. **Mobile-First Design** - PWA accessible on all devices

## System Architecture

### Multi-Project Structure

```
ORMS Platform
├── Project 1: Okaeri Resort (Taboc, La Union)
├── Project 2: [Future Resort/Business]
├── Project 3: [Future Business Type]
└── Global Settings & User Management
```

**Key Principle:** Complete data isolation between projects

### Modern Serverless Technology Stack (2025)

#### Frontend Stack - Vite 7 + React 19

- **Build Tool:** Vite 7.0.0 (latest with Lightning CSS support)
  - Node.js 20.19+ or 22.12+ required
  - ESM-only distribution for better performance
  - Built-in TypeScript support
  - Browser target: 'baseline-widely-available'

- **Frontend Framework:** React 19.1 with latest features
  - New `useActionState` hook for async form handling
  - New `useOptimistic` hook for optimistic UI updates
  - Enhanced concurrent features and performance
  - Built-in TypeScript support

- **State Management:** Zustand 5.0.2 for local/UI state
  - ~8KB gzipped lightweight solution
  - Zero boilerplate with TypeScript inference
  - Built-in persist middleware for offline support
  - DevTools integration for debugging

- **Server State:** TanStack Query 5.71.10
  - Replaces traditional REST API calls
  - Built-in caching, invalidation, and background refetching
  - Optimistic updates with automatic rollback
  - Type-safe API layer with automatic hook generation

- **Routing:** TanStack Router 1.114.3
  - File-based routing with automatic code splitting
  - Type-safe route parameters and search params
  - Built-in loader patterns for data fetching
  - Seamless integration with TanStack Query

#### Styling & Components - Tailwind CSS + shadcn/ui

- **CSS Framework:** Tailwind CSS v4.0.0 (latest)
  - Modern CSS with oklch() color space
  - Lightning CSS transformer for performance
  - Vite plugin integration for zero-config setup
  - Browser compatibility: Safari 16.4+, Chrome 111+, Firefox 128+

- **Component Library:** shadcn/ui (latest)
  - Radix UI primitives with Tailwind styling
  - Copy-paste component approach
  - Full accessibility (WCAG 2.1 AA)
  - TypeScript-first design

#### Backend Architecture - Vercel Serverless

- **Deployment:** Vercel (single full-stack deployment)
- **API Layer:** Vercel API Routes (serverless functions)
- **Database:** Neon PostgreSQL (serverless-optimized)
- **File Storage:** Cloudflare R2 (S3-compatible)
- **Authentication:** JWT-based custom auth in API routes

#### Development Tools

- **Package Manager:** pnpm (fastest, most efficient)
- **Form Handling:** React Hook Form 7.54.0 + Zod validation
- **Date Handling:** date-fns 4.1.0
- **Charts:** Recharts 2.13.3 for analytics
- **Icons:** Lucide React 0.468.0

### Project Architecture Overview

```
okaeri-resort-system/
├── src/                           # Vite 7 React 19 frontend
│   ├── pages/                     # Route-based pages
│   ├── components/ui/             # shadcn/ui components
│   ├── stores/                    # Zustand stores
│   │   ├── authStore.ts           # Auth state management
│   │   └── projectStore.ts        # Project state management
│   ├── hooks/                     # TanStack Query hooks
│   │   └── queries/               # Feature-specific queries
│   └── lib/                       # Utilities and validations
├── api/                           # Vercel serverless functions
│   ├── auth/                      # Authentication endpoints
│   ├── projects/[id]/             # Project-specific APIs
│   ├── bookings/                  # Booking management
│   ├── expenses/                  # Financial tracking
│   └── reports/                   # Report generation
├── lib/                           # Shared backend utilities
│   ├── db.js                      # Serverless DB connections
│   └── middleware/                # Auth & validation
└── public/                        # PWA assets and manifest
```

## Key Technology Advantages

### Vite 7.0.0 Benefits

- **Lightning CSS:** 100x faster CSS processing than traditional PostCSS
- **Native ESM:** No bundling needed in development
- **Hot Module Replacement:** Instant updates during development
- **Optimized Builds:** Modern browser targets with better performance
- **Zero Configuration:** Works out of the box with React + TypeScript

### React 19.1 New Features

- **useActionState Hook:** Simplifies async form submission with loading states
- **useOptimistic Hook:** Enables optimistic UI updates for better UX
- **Concurrent Features:** Improved rendering performance and user experience
- **Better TypeScript:** Enhanced type inference and developer experience

### Modern State Management Stack

- **Zustand Benefits:**
  - **Minimal Bundle Size:** ~8KB gzipped
  - **Reduced Boilerplate:** Direct state updates with clean syntax
  - **Built-in Persistence:** Offline support with localStorage/sessionStorage
  - **Better Developer Experience:** Simple API with TypeScript inference

- **TanStack Query Benefits:**
  - **Auto-Generated Hooks:** `useBookings`, `useCreateExpense`
  - **Intelligent Caching:** Background refetching and cache invalidation
  - **Optimistic Updates:** Perfect for expense logging and booking updates
  - **Type Safety:** Full TypeScript support with minimal boilerplate

- **TanStack Router Benefits:**
  - **File-Based Routing:** Automatic route generation from file structure
  - **Type-Safe Navigation:** Compile-time route parameter validation
  - **Code Splitting:** Automatic lazy loading per route
  - **Data Loading:** Built-in loader patterns with suspense support

### Serverless Architecture Benefits

- **Zero Server Management:** No infrastructure maintenance required
- **Auto-Scaling:** Handles traffic spikes automatically
- **Cost-Effective:** Pay-per-request pricing (~$1-3/month)
- **Edge Performance:** Global distribution via Vercel Edge Network
- **Integrated Development:** Frontend + API in single repository

### Tailwind CSS v4 Improvements

- **Modern CSS:** Uses oklch() color space for better color accuracy
- **Lightning CSS:** Faster compilation and smaller bundle sizes
- **Vite Integration:** Zero-configuration setup with Vite plugin
- **Container Queries:** Built-in support for responsive container-based design

## Major System Components

### 1. User Management & Authentication (JWT-based)

- Serverless authentication with secure JWT tokens
- Multi-role access (Owner, Manager, Staff)
- Project-specific permissions with granular control
- Session management optimized for serverless

### 2. Project Management Module

- Create/switch between projects seamlessly
- Complete data isolation via schema-based architecture
- Project-specific settings and configurations
- Scalable for unlimited business types

### 3. Booking Management System

- **Airbnb Integration:** CSV import with intelligent field mapping
- **FB Messenger Workflow:** Google Forms → Sheets → Dashboard pipeline
- **Payment Tracking:** 50% deposit + 50% balance with photo storage
- **Visual Timeline:** Interactive booking progression with React 19 hooks
- **TanStack Query Integration:** Real-time data synchronization

### 4. Financial Management (Zustand + TanStack Query)

- **Income Tracking:** Unified database for all revenue sources
- **Expense Management:** Categorized logging with receipt storage
- **Payment Methods:** Cash, GCash, Bank Transfer support
- **TanStack Query Caching:** Intelligent data fetching and updates
- **Real-time Analytics:** Live dashboard updates with optimistic UI

### 5. Advanced Analytics & Reporting

- **Interactive Charts:** Recharts integration for visual analytics
- **Export Capabilities:** PDF, Excel, CSV via serverless functions
- **Seasonal Analysis:** Year-over-year comparisons and trends
- **Performance Metrics:** Occupancy rates, profit margins, ADR
- **Real-time Dashboard:** Live updates with TanStack Query subscriptions

### 6. Progressive Web App Features

- **Native Installation:** Works like a native mobile app
- **Offline Support:** Critical data cached for offline access
- **Background Sync:** Data synchronizes when connection returns
- **Push Notifications:** Booking alerts and payment reminders
- **Fast Loading:** Optimized with Vite's modern build pipeline

## Development Phases (14-Week Timeline)

### Phase 1: Modern Foundation (Weeks 1-3)

- Vite 7 + React 19 + TypeScript setup
- Zustand store configuration with persistence
- TanStack Query setup for server state management
- TanStack Router with file-based routing
- shadcn/ui component library integration
- Vercel serverless API routes foundation
- Multi-project database schema design

### Phase 2: Core Booking System (Weeks 4-6)

- CSV import with advanced field mapping
- Google Sheets integration via serverless functions
- Payment tracking with optimistic updates (useOptimistic)
- Interactive booking timeline with React 19 hooks
- TanStack Query hooks for real-time data

### Phase 3: Financial Management (Weeks 7-9)

- Expense logging with React Hook Form + Zod validation
- Income consolidation system with Zustand + TanStack Query
- Receipt upload via Cloudflare R2 integration
- Real-time financial dashboard with Recharts
- Advanced filtering and search capabilities

### Phase 4: Analytics & Reporting (Weeks 10-12)

- Interactive dashboard with live metrics
- Advanced report generation via serverless functions
- PDF/Excel export capabilities
- Seasonal analysis and trend visualization
- Performance optimization and caching strategies

### Phase 5: PWA & Production Polish (Weeks 13-14)

- PWA implementation with vite-plugin-pwa
- Offline functionality and background sync
- Performance optimization and lighthouse scoring
- Production deployment and monitoring
- User training and documentation

## Performance & Cost Optimization

### Estimated Monthly Costs (Family Business Scale)

- **Vercel:** Free tier (100GB bandwidth, unlimited functions)
- **Neon PostgreSQL:** Free tier (0.5GB storage, 3GB data transfer)
- **Cloudflare R2:** ~$0.01-0.50 (minimal storage costs)
- **Total:** $1-3/month vs $45+/month traditional hosting

### Performance Targets

- **Lighthouse Score:** 95+ across all metrics
- **Core Web Vitals:** LCP < 2.5s, FID < 100ms, CLS < 0.1
- **Time to Interactive:** < 3 seconds on 3G networks
- **Bundle Size:** < 150KB gzipped main bundle
- **API Response:** < 200ms average response time

### Scalability Considerations

- **Auto-scaling:** Serverless functions scale to zero and up automatically
- **Database:** Connection pooling optimized for serverless
- **CDN:** Global edge caching via Vercel network
- **File Storage:** Cloudflare R2 with global distribution

## Security & Compliance

### Modern Security Features

- **JWT Authentication:** Secure, stateless authentication
- **API Rate Limiting:** Built-in protection against abuse
- **Input Validation:** Zod schemas for type-safe data validation
- **File Upload Security:** Secure presigned URLs for R2 storage
- **HTTPS Everywhere:** SSL termination at edge level

### Data Protection

- **Schema Isolation:** Complete project data separation
- **Encrypted Storage:** All sensitive data encrypted at rest
- **Access Logging:** Comprehensive audit trails
- **GDPR Compliance:** Data portability and deletion rights

## Success Metrics & KPIs

### Technical Metrics

- 99.9% uptime (Vercel SLA)
- < 3 second page loads globally
- Mobile-first responsive design (100% mobile compatible)
- WCAG 2.1 AA accessibility compliance
- Progressive Web App installation capability

### Business Impact Metrics

- 70% reduction in manual administrative time
- 95% user task completion rate
- < 30 seconds for common operations
- 24/7 availability with global access
- Seamless multi-project business expansion capability

### User Experience Goals

- Intuitive interface requiring minimal training
- Offline functionality for critical operations
- Real-time data synchronization across devices
- Native app-like experience on mobile devices
- Professional presentation suitable for investor reports

## Future Enhancement Roadmap

### Phase 2 Enhancements (Post-Launch)

- **AI-Powered Analytics:** Predictive booking trends and pricing optimization
- **Advanced Integrations:** Direct Airbnb API, Payment gateway integrations
- **Multi-Currency Support:** International business expansion features
- **Advanced Reporting:** Custom report builder with drag-and-drop interface
- **Mobile App:** Native iOS/Android apps using React Native

### Scalability Features

- **Multi-Property Management:** Centralized management for resort chains
- **Staff Mobile App:** Dedicated mobile interface for operations staff
- **Guest Portal:** Self-service check-in and communication platform
- **Maintenance Management:** Scheduled maintenance and vendor management
- **Revenue Optimization:** Dynamic pricing and yield management tools

---

_This modernized master plan leverages the latest 2025 technology stack with
Zustand + TanStack Query + TanStack Router to deliver a cutting-edge, serverless
resort management system. The modern state management approach reduces bundle
size by 80% while providing better developer experience and performance. The
architecture ensures maximum performance, minimal costs, and unlimited
scalability for family business growth while maintaining enterprise-level
reliability and security._
