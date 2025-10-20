# Implementation Guide

## Okaeri Resort Management System

### 🎯 Implementation Philosophy

This guide transforms your comprehensive database design into a practical,
production-ready system using a **backend-first, architecture-driven approach**.

---

## 📋 Implementation Phases

### Phase 1: Foundation (Days 1-14)

**Goal**: Working CRUD system with 3 core tables **Deliverable**: API
endpoints + basic admin interface

### Phase 2: Business Logic (Days 15-28)

**Goal**: File uploads, validation, authentication **Deliverable**:
Production-ready booking system

### Phase 3: Polish (Days 29-42)

**Goal**: PWA features, multi-tenancy, optimization **Deliverable**:
Family-ready application

### Phase 4: Advanced (Days 43+)

**Goal**: Analytics, maintenance, financial reporting **Deliverable**: Complete
resort management suite

---

## 🗄️ Database Implementation Strategy

### Schema Evolution Approach

```sql
-- Phase 1: Core tables only
CREATE TABLE units (...);      -- 3 units
CREATE TABLE bookings (...);   -- Core booking workflow
CREATE TABLE guests (...);     -- Simple CRM

-- Phase 2: Essential additions
ALTER TABLE bookings ADD COLUMN payment_proof JSON;
CREATE TABLE files (...);      -- File management

-- Phase 3: Business expansion
CREATE TABLE maintenance (...); -- Property management
CREATE TABLE users (...);       -- Multi-user support

-- Phase 4: Analytics & reporting
CREATE TABLE financial_analytics (...);
CREATE MATERIALIZED VIEW monthly_metrics AS (...);
```

### Migration Strategy

```typescript
// src/lib/migrations.ts
interface Migration {
  version: string;
  up: string;
  down: string;
  description: string;
}

const migrations: Migration[] = [
  {
    version: "001",
    description: "Initial schema - units, bookings, guests",
    up: `
      CREATE TABLE units (...);
      CREATE TABLE bookings (...);
      CREATE TABLE guests (...);
      CREATE INDEX idx_bookings_unit_dates ON bookings(...);
    `,
    down: `
      DROP TABLE guests;
      DROP TABLE bookings; 
      DROP TABLE units;
    `,
  },
  // ... additional migrations
];

export async function runMigrations() {
  const appliedMigrations = await sql`
    SELECT version FROM schema_migrations ORDER BY version
  `;

  for (const migration of migrations) {
    if (!appliedMigrations.find((m) => m.version === migration.version)) {
      await sql.unsafe(migration.up);
      await sql`
        INSERT INTO schema_migrations (version, applied_at) 
        VALUES (${migration.version}, NOW())
      `;
      console.log(`✅ Applied migration ${migration.version}`);
    }
  }
}
```

---

## 🛠️ Backend Architecture Implementation

### Project Structure

```
src/
├── app/
│   ├── api/                     # API routes (serverless functions)
│   │   ├── units/
│   │   ├── bookings/
│   │   ├── guests/
│   │   └── health/
│   ├── dashboard/               # Admin interface
│   └── globals.css
├── lib/                         # Core utilities
│   ├── db.ts                   # Database connection
│   ├── validation.ts           # Zod schemas
│   ├── auth.ts                 # Authentication logic
│   ├── utils.ts                # Helper functions
│   └── types.ts                # TypeScript definitions
├── components/                  # Reusable UI components
│   ├── forms/
│   ├── tables/
│   └── ui/
├── hooks/                       # Custom React hooks
│   ├── useBookings.ts
│   ├── useUnits.ts
│   └── useOffline.ts
└── stores/                      # Zustand stores
    ├── ui-store.ts
    └── app-store.ts
```

### API Implementation Pattern

```typescript
// Template for all API routes
// src/app/api/[resource]/route.ts

import { NextRequest, NextResponse } from "next/server";

import { handleApiError, validateRequest } from "@/lib/api-helpers";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    // 1. Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "20"));

    // 2. Database query with pagination
    const results = await sql`
      SELECT * FROM [resource]
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `;

    // 3. Get total count for pagination meta
    const [{ count }] = await sql`SELECT COUNT(*) as count FROM [resource]`;

    // 4. Return consistent response format
    return NextResponse.json({
      success: true,
      data: results,
      meta: {
        total: parseInt(count),
        page,
        limit,
        has_more: page * limit < parseInt(count),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Parse and validate request body
    const body = await request.json();
    const validatedData = await validateRequest(ResourceCreateSchema, body);

    // 2. Business logic / checks
    // (availability, conflicts, etc.)

    // 3. Database insertion
    const result = await sql`
      INSERT INTO [resource] (field1, field2, field3)
      VALUES (${validatedData.field1}, ${validatedData.field2}, ${validatedData.field3})
      RETURNING *
    `;

    // 4. Success response
    return NextResponse.json(
      {
        success: true,
        data: result[0],
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## 🔧 Development Workflow

### Environment Setup

```bash
# 1. Project initialization
npx create-next-app@latest okaeri-resort --typescript --tailwind --app
cd okaeri-resort

# 2. Install backend dependencies
npm install @neon-tech/serverless pg uuid bcryptjs jsonwebtoken
npm install -D @types/pg @types/uuid @types/bcryptjs @types/jsonwebtoken

# 3. Install frontend dependencies
npm install react-hook-form @hookform/resolvers zod
npm install @tanstack/react-query zustand
npm install lucide-react date-fns

# 4. Setup environment
cp .env.example .env.local
```

### Environment Configuration

```env
# .env.local
# Database
DATABASE_URL=postgresql://user:pass@host.neon.tech/okaeri_dev

# Authentication (Phase 2+)
NEXTAUTH_SECRET=your-super-secret-jwt-key-here
NEXTAUTH_URL=http://localhost:3000

# File Storage (Phase 2+)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY=your-access-key
R2_SECRET_KEY=your-secret-key
R2_BUCKET_NAME=okaeri-files

# Feature Flags
ENABLE_ANALYTICS=false
ENABLE_MAINTENANCE_MODULE=false
```

### Development Commands

```json
// package.json scripts
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "db:migrate": "tsx scripts/migrate.ts",
    "db:seed": "tsx scripts/seed.ts",
    "db:reset": "tsx scripts/reset.ts",
    "test:api": "jest --testPathPattern=api",
    "analyze": "ANALYZE=true npm run build"
  }
}
```

---

## 📊 Business Logic Implementation

### Core Booking Workflow

```typescript
// src/lib/booking-logic.ts
export class BookingService {
  async checkAvailability(unitId: string, checkIn: Date, checkOut: Date) {
    const conflicts = await sql`
      SELECT booking_id, booking_reference, guest_name
      FROM bookings 
      WHERE unit_id = ${unitId}
        AND booking_status NOT IN ('Cancelled')
        AND NOT (check_out <= ${checkIn} OR check_in >= ${checkOut})
    `;

    return {
      available: conflicts.length === 0,
      conflicts: conflicts.map((c) => ({
        booking_reference: c.booking_reference,
        guest_name: c.guest_name,
      })),
    };
  }

  async calculatePricing(unitId: string, checkIn: Date, checkOut: Date) {
    // Get unit base rates
    const unit = await sql`SELECT * FROM units WHERE unit_id = ${unitId}`;
    if (!unit.length) throw new Error("Unit not found");

    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    let totalAmount = 0;

    // Simple pricing logic for Phase 1
    // TODO: Implement complex seasonal/weekend pricing in Phase 2
    for (let i = 0; i < nights; i++) {
      const currentDate = new Date(checkIn);
      currentDate.setDate(currentDate.getDate() + i);

      // Weekend pricing (Friday, Saturday, Sunday)
      const dayOfWeek = currentDate.getDay();
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;

      if (isWeekend && unit[0].weekend_rate) {
        totalAmount += parseFloat(unit[0].weekend_rate);
      } else {
        totalAmount += parseFloat(unit[0].base_rate);
      }
    }

    return {
      nights,
      base_amount: totalAmount,
      cleaning_fee: parseFloat(unit[0].cleaning_fee || "0"),
      total_amount: totalAmount + parseFloat(unit[0].cleaning_fee || "0"),
    };
  }

  async createBooking(bookingData: BookingCreateData) {
    // 1. Validate availability
    const availability = await this.checkAvailability(
      bookingData.unit_id,
      new Date(bookingData.check_in),
      new Date(bookingData.check_out)
    );

    if (!availability.available) {
      throw new Error("Unit not available for selected dates");
    }

    // 2. Generate booking reference
    const booking_reference = this.generateBookingReference();

    // 3. Begin transaction
    return await sql.begin(async (sql) => {
      // Create booking record
      const booking = await sql`
        INSERT INTO bookings (
          booking_reference, unit_id, guest_name, contact_number,
          email, num_guests, check_in, check_out, total_amount
        ) VALUES (
          ${booking_reference}, ${bookingData.unit_id}, ${bookingData.guest_name},
          ${bookingData.contact_number}, ${bookingData.email}, ${bookingData.num_guests},
          ${bookingData.check_in}, ${bookingData.check_out}, ${bookingData.total_amount}
        ) RETURNING *
      `;

      // Create/update guest record
      await sql`
        INSERT INTO guests (guest_name, email, phone_number)
        VALUES (${bookingData.guest_name}, ${bookingData.email}, ${bookingData.contact_number})
        ON CONFLICT (email) 
        DO UPDATE SET 
          guest_name = EXCLUDED.guest_name,
          phone_number = EXCLUDED.phone_number,
          updated_at = NOW()
      `;

      return booking[0];
    });
  }

  private generateBookingReference(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `BK-${date}-${random}`;
  }
}
```

### Status Management System

```typescript
// src/lib/status-manager.ts
export const BOOKING_STATUSES = {
  INQUIRY: "Inquiry",
  PENDING_PAYMENT: "Pending Payment",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const;

export const UNIT_STATUSES = {
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  MAINTENANCE: "Maintenance",
  OFFLINE: "Offline",
} as const;

export class StatusManager {
  async updateBookingStatus(bookingId: string, newStatus: string, userId?: string) {
    // Validate status transition
    const allowedTransitions = {
      [BOOKING_STATUSES.INQUIRY]: [BOOKING_STATUSES.PENDING_PAYMENT, BOOKING_STATUSES.CANCELLED],
      [BOOKING_STATUSES.PENDING_PAYMENT]: [BOOKING_STATUSES.CONFIRMED, BOOKING_STATUSES.CANCELLED],
      [BOOKING_STATUSES.CONFIRMED]: [BOOKING_STATUSES.IN_PROGRESS, BOOKING_STATUSES.CANCELLED],
      [BOOKING_STATUSES.IN_PROGRESS]: [BOOKING_STATUSES.COMPLETED],
      // Completed and Cancelled are terminal states
    };

    const currentBooking = await sql`
      SELECT booking_status FROM bookings WHERE booking_id = ${bookingId}
    `;

    if (!currentBooking.length) {
      throw new Error("Booking not found");
    }

    const currentStatus = currentBooking[0].booking_status;
    const allowed = allowedTransitions[currentStatus] || [];

    if (!allowed.includes(newStatus)) {
      throw new Error(`Cannot transition from ${currentStatus} to ${newStatus}`);
    }

    // Update status
    return await sql`
      UPDATE bookings 
      SET booking_status = ${newStatus}, updated_at = NOW()
      WHERE booking_id = ${bookingId}
      RETURNING *
    `;
  }

  async updateUnitStatus(unitId: string, newStatus: string) {
    // Check for conflicts (e.g., can't set to maintenance if occupied)
    if (newStatus === UNIT_STATUSES.MAINTENANCE) {
      const activeBookings = await sql`
        SELECT booking_id FROM bookings
        WHERE unit_id = ${unitId}
          AND booking_status IN (${BOOKING_STATUSES.CONFIRMED}, ${BOOKING_STATUSES.IN_PROGRESS})
          AND check_out >= CURRENT_DATE
      `;

      if (activeBookings.length > 0) {
        throw new Error("Cannot set to maintenance: active bookings exist");
      }
    }

    return await sql`
      UPDATE units 
      SET unit_status = ${newStatus}, updated_at = NOW()
      WHERE unit_id = ${unitId}
      RETURNING *
    `;
  }
}
```

---

## 🚀 Deployment Implementation

### Vercel Configuration

```javascript
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm ci",
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/dashboard/:path*",
      "destination": "/dashboard/:path*"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, PUT, DELETE, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "X-Requested-With, Content-Type, Accept, Authorization"
        }
      ]
    }
  ]
}
```

### Environment Variables Setup

```bash
# Production deployment
vercel --prod

# Set environment variables
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add R2_ACCESS_KEY production

# Deploy with environment check
vercel deploy --prod --env DATABASE_URL --env NEXTAUTH_SECRET
```

### Health Monitoring Setup

```typescript
// src/app/api/health/route.ts - Production monitoring
export async function GET() {
  const startTime = Date.now();

  try {
    // Check database connectivity
    const dbCheck = await sql`SELECT 1 as status`;
    const dbLatency = Date.now() - startTime;

    // Check external dependencies (Phase 2+)
    // const r2Check = await checkR2();
    // const emailCheck = await checkEmailService();

    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      uptime: Math.floor(process.uptime()),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      checks: {
        database: {
          status: dbCheck.length > 0 ? "ok" : "error",
          latency_ms: dbLatency,
        },
      },
    };

    return NextResponse.json(health);
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: "Health check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
```

---

## ✅ Phase-by-Phase Implementation Checklist

### Phase 1: Foundation (Days 1-14)

**Backend Tasks:**

- [ ] Setup Next.js project with TypeScript
- [ ] Configure Neon PostgreSQL database
- [ ] Implement 3 core database tables
- [ ] Create Units CRUD API routes
- [ ] Create Bookings CRUD API routes
- [ ] Create Guests CRUD API routes
- [ ] Implement availability checking logic
- [ ] Add basic input validation with Zod
- [ ] Setup error handling patterns

**Frontend Tasks:**

- [ ] Create basic dashboard layout
- [ ] Build units management interface
- [ ] Build booking creation form
- [ ] Add booking list/search interface
- [ ] Implement client-side state management
- [ ] Add loading states and error handling

**Testing & Validation:**

- [ ] Test complete booking workflow
- [ ] Validate availability checking logic
- [ ] Test error scenarios
- [ ] Mobile responsiveness check
- [ ] Basic security audit

### Phase 2: Business Features (Days 15-28)

**Backend Tasks:**

- [ ] Implement file upload system (Cloudflare R2)
- [ ] Add payment proof management
- [ ] Implement user authentication (NextAuth.js)
- [ ] Add comprehensive input validation
- [ ] Implement status management system
- [ ] Add booking modification/cancellation
- [ ] Create guest search and CRM features

**Frontend Tasks:**

- [ ] Add file upload components
- [ ] Implement authentication UI
- [ ] Build user management interface
- [ ] Add advanced booking management
- [ ] Implement guest profile pages
- [ ] Add booking status tracking

**Testing & Validation:**

- [ ] End-to-end booking workflow testing
- [ ] File upload/download testing
- [ ] Authentication flow testing
- [ ] Permission/access control testing

### Phase 3: Production Polish (Days 29-42)

**Backend Tasks:**

- [ ] Add multi-tenant architecture
- [ ] Implement comprehensive logging
- [ ] Add rate limiting and security hardening
- [ ] Setup backup and recovery procedures
- [ ] Optimize database queries and indexes
- [ ] Add health monitoring endpoints

**Frontend Tasks:**

- [ ] Implement PWA features (offline, installable)
- [ ] Add comprehensive error boundaries
- [ ] Implement advanced UI components
- [ ] Add data export functionality
- [ ] Performance optimization (bundle size, caching)

**DevOps Tasks:**

- [ ] Setup production deployment pipeline
- [ ] Configure monitoring and alerting
- [ ] Implement backup strategies
- [ ] Performance testing and optimization
- [ ] Security audit and penetration testing

---

## 📈 Success Metrics & Monitoring

### Technical KPIs

```javascript
// Key metrics to track
const metrics = {
  performance: {
    api_response_time: "< 200ms average",
    page_load_time: "< 3 seconds",
    uptime: "> 99.9%",
    error_rate: "< 0.1%",
  },

  cost: {
    monthly_spend: "< $3.00",
    database_usage: "< 0.5GB storage",
    bandwidth: "< 100GB/month",
    file_storage: "< 10GB",
  },

  business: {
    booking_completion_rate: "> 95%",
    user_task_completion_time: "< 30 seconds",
    mobile_usage: "> 80%",
    family_adoption_rate: "100%",
  },
};
```

### Monitoring Implementation

```typescript
// src/lib/analytics.ts
export function trackBusinessEvent(event: string, properties: Record<string, any>) {
  // Simple analytics for family business
  const eventData = {
    event,
    properties,
    timestamp: new Date().toISOString(),
    session_id: generateSessionId(),
    user_agent: navigator.userAgent,
  };

  // Send to simple analytics endpoint
  if (typeof window !== "undefined") {
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventData),
    }).catch(console.error);
  }
}

// Usage throughout the app:
// trackBusinessEvent('booking_created', { unit_id, guest_count, total_amount });
// trackBusinessEvent('payment_received', { booking_id, method, amount });
```

---

_Implementation Guide v1.0 - Practical, Scalable, Family-Ready_
