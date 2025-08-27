# Okaeri Resort Management System

A modern, cost-optimized resort management system designed for Okaeri Resort in La Union, Philippines. Built with a serverless-first architecture to deliver enterprise-grade features at family business costs.

## Overview

The Okaeri Resort Management System is a Progressive Web Application (PWA) that provides comprehensive resort management capabilities including booking management, financial tracking, and multi-project support for business expansion. The system integrates with Airbnb for automated booking imports and Facebook Messenger for seamless communication with guests.

### Key Features

- **Booking Management**: Handle reservations from multiple channels (Airbnb, direct bookings, walk-ins)
- **Financial Tracking**: Monitor income, expenses, and generate financial reports
- **Multi-Project Support**: Manage multiple properties/projects with complete data isolation
- **Offline Capability**: Full PWA support for reliable operation even with intermittent connectivity
- **Mobile-First Design**: Optimized for mobile devices used by staff on-the-go
- **Bilingual Support**: English and Filipino language options

## Technology Stack

### Frontend
- **Framework**: React 19 with TypeScript 5.8
- **Build Tool**: Vite 7 for lightning-fast development
- **State Management**: Zustand for efficient state handling
- **Data Fetching**: TanStack Query (React Query) for server state management
- **Routing**: TanStack Router for type-safe routing
- **UI Components**: Custom components with Radix UI primitives
- **Styling**: Tailwind CSS v4 with shadcn/ui design system
- **Forms**: React Hook Form with Zod validation

### Backend (Planned)
- **API**: Vercel Serverless Functions
- **Database**: Neon PostgreSQL with schema-based multi-tenancy
- **Storage**: Cloudflare R2 for cost-effective file storage
- **Authentication**: JWT-based with refresh token rotation

### DevOps & Tools
- **Hosting**: Vercel (optimized for $1-3/month operational costs)
- **Version Control**: Git with conventional commits
- **Code Quality**: ESLint, Prettier, Husky pre-commit hooks
- **Testing**: Vitest with React Testing Library
- **Type Checking**: TypeScript strict mode

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/okaeri-dev/okaeri-resort-system.git
cd okaeri-resort-system
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your environment variables in `.env.local` according to your needs.

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

### Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Generate test coverage
npm run test:coverage

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check
```

## Project Structure

```
okaeri-resort-system/
├── .claude/                 # AI assistant configurations
│   └── agents/             # Specialized AI agents for different domains
├── docs/                   # Project documentation
│   └── implementation/     # Implementation plans and specifications
├── public/                 # Static assets
├── src/                    # Source code
│   ├── app/               # Application core
│   │   ├── bookings/      # Booking management module
│   │   ├── finances/      # Financial management module
│   │   ├── projects/      # Multi-project management
│   │   └── settings/      # Application settings
│   ├── components/        # Reusable UI components
│   │   ├── ui/           # Base UI components
│   │   └── features/     # Feature-specific components
│   ├── config/           # Application configuration
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility libraries
│   ├── services/         # API and external services
│   ├── stores/           # Zustand state stores
│   ├── styles/           # Global styles
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── .env.example          # Environment variables template
├── .env.development      # Development environment settings
└── vite.config.ts        # Vite configuration
```

## Architecture Overview

### Multi-Tenant Architecture
The system implements schema-based multi-tenancy with complete data isolation between projects:
- Each resort/property operates as a separate project
- Row-level security ensures data privacy
- Project switching maintains security boundaries
- Maximum 5 projects per account for optimal performance

### State Management Strategy
- **Zustand**: Global application state (user, project context)
- **TanStack Query**: Server state and cache management
- **React Hook Form**: Form state with validation
- **Local Storage**: Offline data persistence

### Performance Optimizations
- Code splitting at the route level
- Lazy loading of heavy components
- Image optimization with responsive loading
- Service Worker for offline functionality
- Edge caching with Vercel's CDN

### Security Measures
- JWT authentication with secure HTTP-only cookies
- Role-based access control (Owner, Manager, Staff)
- Input validation with Zod schemas
- XSS protection with Content Security Policy
- Rate limiting on API endpoints

## Development Workflow

### Branch Strategy
- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: New features
- `fix/*`: Bug fixes
- `release/*`: Release preparation

### Commit Convention
We follow [Conventional Commits](https://www.conventionalcommits.org/):
```
type(scope): description

feat: New feature
fix: Bug fix
docs: Documentation changes
style: Code style changes
refactor: Code refactoring
test: Test additions or changes
chore: Build process or auxiliary tool changes
```

### Code Review Process
1. Create feature branch from `develop`
2. Implement changes with tests
3. Run linting and tests locally
4. Create pull request with description
5. Address review feedback
6. Merge after approval

## Testing Strategy

### Unit Tests
- Components with React Testing Library
- Utility functions with Vitest
- Store actions and selectors

### Integration Tests
- API endpoint testing
- Database operations
- Authentication flows

### E2E Tests (Planned)
- Critical user journeys
- Booking flow
- Financial reporting

## Deployment

### Production Deployment
```bash
# Build production bundle
npm run build

# Deploy to Vercel
vercel --prod
```

### Environment-Specific Builds
- Development: `.env.development`
- Staging: `.env.staging`
- Production: `.env.production`

## Monitoring & Maintenance

### Performance Monitoring
- Core Web Vitals tracking
- API response time monitoring
- Error rate tracking
- User session recording (planned)

### Backup Strategy
- Daily database backups (when implemented)
- File storage redundancy with R2
- Configuration backups in Git

## Test-Driven Development (TDD)

This project follows Test-Driven Development practices to ensure reliability and maintainability of our resort management system. TDD is critical for financial calculations, booking logic, and data integrity - areas where bugs can have significant business impact.

### Quick Start Commands

```bash
# Run tests in watch mode (recommended for TDD)
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests with UI interface
npm run test:ui

# Run specific test file
npm test booking.test.ts

# Run tests matching pattern
npm test --grep "booking calculation"
```

### Test File Naming Conventions

```
src/
├── components/
│   └── BookingForm/
│       ├── BookingForm.tsx
│       └── __tests__/
│           └── BookingForm.test.tsx
├── services/
│   └── __tests__/
│       ├── booking.service.test.ts
│       └── payment.service.test.ts
├── hooks/
│   └── queries/
│       └── __tests__/
│           └── use-bookings.test.ts
└── stores/
    └── __tests__/
        └── bookingStore.test.ts
```

### TDD Workflow Example

Here's a basic example of writing a test first for a booking feature:

```typescript
// 1. RED: Write failing test
describe('BookingCalculation', () => {
  it('should calculate total with Philippine tax and service charge', () => {
    const booking = {
      baseAmount: 5000,
      nights: 3,
      taxRate: 0.12,      // Philippines VAT
      serviceRate: 0.10    // Service charge
    };
    
    const result = calculateBookingTotal(booking);
    
    expect(result.subtotal).toBe(15000);  // 5000 * 3
    expect(result.tax).toBe(1800);        // 15000 * 0.12
    expect(result.service).toBe(1500);    // 15000 * 0.10
    expect(result.total).toBe(18300);     // 15000 + 1800 + 1500
  });
});

// 2. GREEN: Write minimal implementation
function calculateBookingTotal(booking) {
  const subtotal = booking.baseAmount * booking.nights;
  const tax = subtotal * booking.taxRate;
  const service = subtotal * booking.serviceRate;
  return {
    subtotal,
    tax,
    service,
    total: subtotal + tax + service
  };
}

// 3. REFACTOR: Improve while keeping tests green
```

### Comprehensive TDD Guide

For detailed implementation patterns, testing strategies, and real-world examples specific to resort management systems, see our [TDD Implementation Guide](/docs/implementation/TDD_Implementation_Guide.md).

The guide covers:
- **Business case** for TDD in resort/hospitality systems
- **TypeScript-first TDD** approach with type safety
- **React component testing** patterns with accessibility
- **Zustand store testing** with multi-tenant considerations  
- **TanStack Query integration** testing
- **Booking and payment processing** examples
- **Philippine market-specific** features and validations

### Team TDD Expectations

**For New Features:**
1. **Write tests first** - Start with failing tests that describe the desired behavior
2. **Test business logic** - Focus on calculations, validations, and data transformations
3. **Test edge cases** - Handle Philippine holidays, peak seasons, currency formatting
4. **Maintain coverage** - Aim for 80%+ coverage on business-critical code
5. **Document test intent** - Use descriptive test names explaining the business scenario

**Pull Request Requirements:**
- All new features must include tests
- Tests must pass in CI/CD pipeline
- Coverage reports reviewed during code review
- Integration tests for multi-component features

**TDD Benefits for Resort Management:**
- **Financial accuracy** - Prevents booking calculation errors
- **Seasonal reliability** - Handles peak season edge cases  
- **Multi-tenant safety** - Ensures data isolation between projects
- **Regulatory compliance** - Validates Philippine tax calculations
- **Customer confidence** - Reduces booking errors and disputes

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is proprietary software developed for Okaeri Resort. All rights reserved.

## Support

For support and questions:
- Technical Issues: Create an issue in the repository
- Business Inquiries: Contact the Okaeri Resort management team

## Acknowledgments

- Built with modern web technologies for optimal performance
- Designed for the Philippine resort industry context
- Optimized for cost-effective family business operations

---

**Version**: 1.0.0  
**Last Updated**: December 2024  
**Maintained By**: Okaeri Development Team