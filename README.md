# 🏖️ Okaeri Resort Management System

> **A comprehensive, enterprise-grade resort management platform built for small to medium-sized hospitality businesses in the Philippines**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-blue)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.1-646CFF)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0beta-38B2AC)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Private-red)](LICENSE)

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [Support](#-support)

## 🌟 Overview

Okaeri Resort Management System is a modern, full-stack web application designed to streamline resort operations, from booking management to expense tracking. Built with performance and user experience in mind, it provides a comprehensive solution for resort operators to manage their properties efficiently.

### 🎯 Key Objectives

- **Streamline Operations**: Automate booking, guest, and payment management
- **Financial Tracking**: Comprehensive expense and revenue monitoring
- **Mobile-First Design**: Optimized for on-the-go resort management
- **Philippine Market Focus**: Tailored for local business requirements and compliance
- **Scalable Architecture**: Built to grow with your business

## ✨ Features

### Core Modules

#### 📅 **Booking Management**
- Real-time availability tracking with optimized database functions
- Multi-unit reservation system with conflict detection
- Automated booking confirmations and notifications
- Calendar view with drag-and-drop functionality
- Booking status workflow (Pending → Confirmed → Checked-in → Completed)
- Multi-step booking form with validation
- Advanced filtering and search capabilities

#### 👥 **Guest Management**
- Comprehensive guest profiles with CRM capabilities
- Booking history tracking and analytics
- Quick check-in/check-out workflows
- Guest communication logs and notes
- Repeat guest identification and loyalty tracking
- Public guest booking portal (unauthenticated)

#### 💳 **Payment Processing**
- Multiple payment method support (Cash, GCash, Bank Transfer, Credit Card)
- Payment receipt uploads with image compression
- Partial payment tracking and balance management
- Automated balance calculations
- Internal reporting compliance (Philippine standards)
- Secure file storage with Cloudflare R2 integration

#### 📊 **Financial Management**
- Expense tracking with receipt uploads
- Revenue analytics dashboard with occupancy metrics
- Occupancy rate calculations and trend analysis
- Financial reporting tools with export capabilities
- Multi-currency support (PHP primary)
- Audit trail for all financial transactions

#### 🏠 **Unit Management**
- Property and unit configuration with amenities
- Amenity tracking and pricing
- Maintenance scheduling and tracking
- Dynamic pricing management
- Availability calendars with real-time updates
- Unit status monitoring

#### 🔒 **Security & Compliance**
- Comprehensive audit trail system with detailed logging
- XSS prevention with DOMPurify sanitization
- SQL injection protection via parameterized queries
- Row Level Security (RLS) policies
- Security monitoring dashboard
- Data privacy compliance (Philippine Data Privacy Act)
- Secure file upload with validation

#### 📈 **Monitoring & Operations**
- Real-time quota monitoring (KV, Email, Bandwidth)
- Alert system for quota thresholds
- Cleanup automation with monitoring
- Cron job health monitoring
- Performance metrics collection
- Error tracking and logging

#### 📱 **Progressive Web App (PWA)**
- Installable on desktop and mobile for authenticated staff/owners (home-screen icon, standalone display)
- Sticky install banner with snooze (7 days) and permanent dismissal, plus a sidebar escape hatch to re-show it
- iOS Safari fallback with manual "Share → Add to Home Screen" instructions (Apple doesn't expose `beforeinstallprompt`)
- Service-worker precaching of hashed JS/CSS chunks and static assets for faster repeat loads
- Multi-tab-safe update notification: in-app sonner toast appears when a new build is deployed; other open tabs auto-reload via `controllerchange` when one tab activates the new SW
- **No** caching of `/api/**` or Supabase traffic — TanStack Query remains the sole client-side cache for dynamic data, which keeps booking/payment integrity ironclad
- Mobile-optimized interface (mobile-first design)
- Cross-platform compatibility (Chrome, Edge, Android Chrome, iOS Safari; Firefox falls back to a regular web app)

See [`docs/plans/2026-05-16-pwa-design.md`](docs/plans/2026-05-16-pwa-design.md) for the design rationale and [`docs/plans/2026-05-16-pwa-rollout-checklist.md`](docs/plans/2026-05-16-pwa-rollout-checklist.md) for the manual QA gate before promoting PWA changes to production.

## 🛠 Tech Stack

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7.1
- **Routing**: TanStack Router v1
- **State Management**: Zustand v5 + TanStack Query v5
- **UI Components**: shadcn/ui with Radix UI
- **Styling**: Tailwind CSS v4 (beta)
- **Forms**: React Hook Form + Zod validation

### Backend
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Serverless**: Cloudflare Workers / Vercel Functions
- **Authentication**: Supabase Auth with JWT
- **File Storage**: Cloudflare R2 / Supabase Storage
- **Real-time**: Supabase Realtime subscriptions
- **Monitoring**: Custom quota and performance monitoring

### Development Tools
- **TypeScript**: v5.8
- **ESLint**: v9 with TypeScript support
- **Prettier**: Code formatting
- **Husky**: Git hooks for code quality
- **Lint-staged**: Pre-commit validation

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v20.0.0 or higher
- **npm**: v10.0.0 or higher
- **Git**: Latest version
- **Supabase Account**: For backend services

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/okaeri-resort.git
cd okaeri-resort
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Copy the example environment file and configure your variables:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Application Settings
VITE_APP_NAME="Okaeri Resort System"
VITE_APP_ENV=development
VITE_DEBUG=true
```

### 4. Database Setup

Run the database migrations:

```bash
# Apply schema
psql $DATABASE_URL < database/schema.sql

# Run migrations
psql $DATABASE_URL < database/migrations/*.sql
```

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## 📁 Project Structure

> **📖 A longer structure guide with diagrams lives in the vault note [[PROJECT_STRUCTURE]].**

### Quick Overview

```
okaeri-resort/
│
├── 📱 src/                          # React application source code
│   ├── components/                  # Feature-based UI components
│   │   ├── bookings/               # Booking management (forms, tables)
│   │   ├── guests/                 # Guest management
│   │   ├── payments/               # Payment processing
│   │   ├── expenses/               # Expense tracking
│   │   ├── units/                  # Unit management
│   │   ├── dashboard/              # Analytics dashboard
│   │   ├── audit/                  # Audit trail viewer
│   │   └── ui/                     # shadcn/ui components (29 total)
│   │
│   ├── lib/                        # Core utilities & infrastructure
│   │   ├── monitoring/             # Quota & performance monitoring
│   │   ├── security/               # XSS prevention & sanitization
│   │   ├── validation/             # Form validation schemas
│   │   ├── supabase.ts            # Typed database client
│   │   └── audit-logger.ts        # Audit trail system
│   │
│   ├── stores/                     # Zustand state management (10 stores)
│   ├── hooks/                      # Custom React hooks (19 total)
│   ├── routes/                     # TanStack Router (file-based)
│   └── types/                      # TypeScript definitions
│
├── ⚡ functions/                    # Cloudflare Workers / Serverless API
│   ├── api/                        # API endpoints (audit, guest-booking, monitoring)
│   └── cron/                       # Scheduled tasks
│
├── 🗄️ database/                     # PostgreSQL schema & migrations
│   ├── schema.sql                  # Core database structure
│   ├── migrations/                 # Versioned SQL migrations (60+ files)
│   └── scripts/                    # Database utilities & diagnostics
│
├── 📚 docs/                         # Comprehensive documentation (53 READMEs)
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
└── ⚙️ Configuration                 # Root-level tooling & configs
    ├── vite.config.ts              # Build configuration
    ├── tsconfig.json               # TypeScript settings
    ├── CLAUDE.md                   # AI development instructions
    └── package.json                # Dependencies & scripts
```

**Key Features:**
- **Feature-Based Organization**: Components grouped by domain (bookings, guests, payments)
- **Hybrid State Management**: Zustand (client state) + TanStack Query (server cache)
- **Security-First**: Comprehensive audit trail, XSS prevention, sanitization
- **Progressive TypeScript**: Strict mode with phased enablement
- **60+ Database Migrations**: Versioned schema with rollback support
- **53 Documentation Files**: Extensive guides throughout the codebase

## 💻 Development

### Available Scripts

```bash
# Development server with hot reload
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Code formatting
npm run format

# Production build
npm run build

# Preview production build
npm run preview
```

### Code Quality

The project uses automated code quality tools:

- **Pre-commit hooks**: Automatically format and lint staged files
- **Type checking**: Ensures TypeScript compliance
- **ESLint**: Enforces coding standards
- **Prettier**: Maintains consistent formatting

### State Management

The application uses a hybrid state management approach:

- **Zustand**: For client-side application state
- **TanStack Query**: For server state and caching
- **React Hook Form**: For form state management

Example store usage:

```typescript
// Using a Zustand store
import { useBookingStore } from '@/stores/useBookingStore'

const Component = () => {
  const { bookings, fetchBookings } = useBookingStore()
  // Component logic
}
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Testing Strategy

- **Unit Tests**: Component and utility testing
- **Integration Tests**: API and database interactions
- **E2E Tests**: Critical user workflows
- **Performance Tests**: Load and stress testing

## 🚀 Deployment

### Vercel Deployment

The application is optimized for Vercel deployment:

1. **Connect Repository**: Link your GitHub repository to Vercel
2. **Configure Environment Variables**: Set up production variables in Vercel dashboard
3. **Deploy**: Automatic deployments on push to main branch

See the [deploy-production skill](./.claude/skills/deploy-production/SKILL.md) for detailed instructions.

### Production Considerations

- **Database**: Ensure RLS policies are enabled
- **Environment**: Use production environment variables
- **Monitoring**: Set up error tracking and analytics
- **Backups**: Configure automated database backups

## 📚 Documentation

Comprehensive documentation is available throughout the repository. Long-form design, implementation, verification and audit docs live in the maintainer's notes vault (`2 Areas/Okaeri Resort System/`), cited below as vault notes.

### Core Documentation
- Architecture Overview: vault note [[01-architecture README]]
- Development Guide: vault note [[02-development README]]
- [Component Library](./src/components/ui/README.md) - UI component reference
- [State Management](./src/stores/README.md) - Zustand + TanStack Query patterns
- [Security Utilities](./src/lib/security/README.md) - XSS prevention, sanitization, and validation

### Feature Implementation
- Audit Trail System: vault note [[audit-trail README]]
- Guest Booking System: vault note [[guest-booking-multi-unit README]]
- [Monitoring Infrastructure](./src/lib/monitoring/README.md) - Quota monitoring and alert systems
- [Booking Components](./src/components/bookings/README.md) - Complex booking form and table architecture
- [Table Patterns](./src/components/tables/README.md) - Reusable table components

### API & Functions
- [Serverless Functions](./functions/README.md) - Cloudflare Workers architecture
- [API Endpoints](./functions/api/README.md) - API route documentation
- [Audit Logging API](./functions/api/audit/README.md) - Audit trail endpoints
- [Guest Booking API](./functions/api/guest-booking/README.md) - Public booking endpoints
- [Monitoring API](./functions/api/monitoring/README.md) - Health and quota monitoring

### Database
- [Database Schema](./database/SCHEMA.md) - Complete schema documentation
- [Database Guide](./database/README.md) - Migrations, RLS policies, and best practices
- [Migrations](./database/migrations/README.md) - Migration management

### Testing
- [Testing Strategy](./src/__tests__/README.md) - E2E, performance, and security testing
- Testing Guide: vault note [[testing-strategy]]

### Deployment & Operations
- [Deployment Guide](./.claude/skills/deploy-production/SKILL.md) - Production deployment instructions
- [Storage Configuration](./docs/storage-configuration.md) - File upload and R2 storage setup
- Monitoring Setup: vault note [[monitoring-setup]]

### Release & Verification
- Phase Releases: vault note [[releases README]]
- Verification Reports: vault note [[verification README]]
- Security Audits: vault note [[security README]]

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details on:

- Code of Conduct
- Development workflow
- Commit conventions
- Pull request process
- Code review guidelines

## 🐛 Known Issues & Roadmap

### Current Status: Phase 5 (Complete)
- ✅ Core functionality fully implemented and tested
- ✅ Security hardening complete with comprehensive audit trail
- ✅ Monitoring infrastructure operational
- ✅ TypeScript strict mode progressively enabled
- 🔄 Some Phase 3-4 features marked for future releases (`.phase3-4` files)
- 🔄 PWA features continuously optimized for Philippine connectivity

### Planned Enhancements
- Advanced workflow automation (Phase 3-4)
- Enhanced reporting and analytics
- Multi-language support (English/Filipino)
- Mobile app native features

## 📞 Support

For support, please:

1. Check the [Troubleshooting Guide](./docs/TROUBLESHOOTING.md)
2. Review existing [GitHub Issues](https://github.com/yourusername/okaeri-resort/issues)
3. Contact the development team

## 📄 License

This project is proprietary software. All rights reserved.

---

<div align="center">
  <strong>Built with ❤️ for the Philippine hospitality industry</strong>
  <br>
  <sub>© 2024 Okaeri Resort System. All rights reserved.</sub>
</div>