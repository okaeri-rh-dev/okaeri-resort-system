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
- Real-time availability tracking
- Multi-unit reservation system
- Automated booking confirmations
- Calendar view with drag-and-drop functionality
- Booking status workflow (Pending → Confirmed → Checked-in → Completed)

#### 👥 **Guest Management**
- Comprehensive guest profiles
- Booking history tracking
- Quick check-in/check-out
- Guest communication logs
- Repeat guest identification

#### 💳 **Payment Processing**
- Multiple payment method support
- Payment receipt uploads
- Partial payment tracking
- Automated balance calculations
- Internal reporting compliance

#### 📊 **Financial Management**
- Expense tracking with receipt uploads
- Revenue analytics dashboard
- Occupancy rate calculations
- Financial reporting tools
- Multi-currency support (PHP primary)

#### 🏠 **Unit Management**
- Property and unit configuration
- Amenity tracking
- Maintenance scheduling
- Pricing management
- Availability calendars

#### 📱 **Progressive Web App (PWA)**
- Offline functionality
- Mobile-optimized interface
- Push notifications
- App-like experience
- Cross-platform compatibility

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
- **Database**: Supabase (PostgreSQL)
- **Serverless**: Vercel Functions
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage
- **Real-time**: Supabase Realtime subscriptions

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
git clone https://github.com/yourusername/okaeri-resort-system.git
cd okaeri-resort-system
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

```
okaeri-resort-system/
├── .claude/              # Claude AI agent configurations
├── api/                  # Serverless API functions
│   ├── cron/            # Scheduled tasks
│   ├── health.ts        # Health check endpoint
│   └── workflows/       # Business workflow APIs
├── database/            # Database schema and migrations
│   ├── migrations/      # SQL migration files
│   └── schema.sql       # Core database schema
├── docs/                # Comprehensive documentation
│   ├── architecture/    # System design documents
│   ├── deployment/      # Deployment guides
│   └── testing/         # Testing documentation
├── src/                 # Application source code
│   ├── components/      # React components
│   │   ├── bookings/   # Booking-related components
│   │   ├── guests/     # Guest management components
│   │   ├── payments/   # Payment components
│   │   └── ui/         # Reusable UI components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility libraries
│   ├── pages/          # Page components
│   ├── routes/         # Route definitions
│   ├── stores/         # Zustand state stores
│   ├── styles/         # Global styles
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Utility functions
├── public/             # Static assets
└── types/              # Global TypeScript types
```

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

See [Deployment Guide](./docs/deployment/PRODUCTION.md) for detailed instructions.

### Production Considerations

- **Database**: Ensure RLS policies are enabled
- **Environment**: Use production environment variables
- **Monitoring**: Set up error tracking and analytics
- **Backups**: Configure automated database backups

## 📚 Documentation

Comprehensive documentation is available in the `/docs` directory:

- [Architecture Overview](./docs/architecture/SYSTEM_DESIGN.md)
- [API Documentation](./api/README.md)
- [Component Library](./src/components/ui/README.md)
- [State Management](./src/stores/README.md)
- [Database Schema](./database/SCHEMA.md)
- [Deployment Guide](./docs/deployment/PRODUCTION.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details on:

- Code of Conduct
- Development workflow
- Commit conventions
- Pull request process
- Code review guidelines

## 🐛 Known Issues

- TypeScript strict mode is being progressively enabled
- Some Phase 3-4 features are in development
- Mobile PWA features are being optimized

## 📞 Support

For support, please:

1. Check the [Troubleshooting Guide](./docs/TROUBLESHOOTING.md)
2. Review existing [GitHub Issues](https://github.com/yourusername/okaeri-resort-system/issues)
3. Contact the development team

## 📄 License

This project is proprietary software. All rights reserved.

---

<div align="center">
  <strong>Built with ❤️ for the Philippine hospitality industry</strong>
  <br>
  <sub>© 2024 Okaeri Resort System. All rights reserved.</sub>
</div>