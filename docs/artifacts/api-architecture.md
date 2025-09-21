# API Architecture

## Okaeri Resort Management System

### 🎯 API Design Principles

- **RESTful**: Standard HTTP methods and resource-based URLs
- **Serverless**: Next.js API routes (no server management)
- **Stateless**: Each request contains all needed information
- **Error-First**: Consistent error handling and response format

---

## 📁 API Structure

### Route Organization

```
src/app/api/
├── units/
│   ├── route.ts                    # GET /api/units, POST /api/units
│   └── [id]/
│       └── route.ts                # GET/PUT/DELETE /api/units/:id
├── bookings/
│   ├── route.ts                    # GET /api/bookings, POST /api/bookings
│   ├── [id]/
│   │   └── route.ts                # GET/PUT/DELETE /api/bookings/:id
│   └── availability/
│       └── route.ts                # GET /api/bookings/availability
├── guests/
│   ├── route.ts                    # GET /api/guests, POST /api/guests
│   └── [id]/
│       └── route.ts                # GET/PUT/DELETE /api/guests/:id
└── health/
    └── route.ts                    # GET /api/health (system status)
```

### HTTP Method Conventions

```
GET    /api/units           # List all units
POST   /api/units           # Create new unit
GET    /api/units/:id       # Get specific unit
PUT    /api/units/:id       # Update specific unit
DELETE /api/units/:id       # Delete specific unit

GET    /api/bookings        # List bookings (with pagination)
POST   /api/bookings        # Create new booking
GET    /api/bookings/:id    # Get specific booking
PUT    /api/bookings/:id    # Update booking
DELETE /api/bookings/:id    # Cancel booking (soft delete)

GET    /api/guests          # List guests (with search)
POST   /api/guests          # Create/update guest
GET    /api/guests/:id      # Get specific guest
PUT    /api/guests/:id      # Update guest info

GET    /api/bookings/availability?unit_id=x&from=date&to=date
```

---

## 📊 Standard Response Format

### Success Response Pattern

```typescript
interface APIResponse<T> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    has_more?: boolean;
  };
}

// Examples:
GET /api/units -> {
  "success": true,
  "data": [
    {
      "unit_id": "uuid",
      "unit_name": "Unit 1 - Ocean View",
      "unit_code": "U1",
      "max_occupancy": 4,
      "base_rate": "2500.00",
      "unit_status": "Available"
    }
  ]
}

GET /api/bookings -> {
  "success": true,
  "data": [...],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "has_more": true
  }
}
```

### Error Response Pattern

```typescript
interface APIError {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, any>;
}

// Examples:
400 Bad Request -> {
  "success": false,
  "error": "Missing required fields",
  "code": "VALIDATION_ERROR",
  "details": {
    "missing_fields": ["guest_name", "check_in"]
  }
}

409 Conflict -> {
  "success": false,
  "error": "Unit not available for selected dates",
  "code": "BOOKING_CONFLICT",
  "details": {
    "conflicting_booking_id": "uuid",
    "suggested_alternatives": ["unit_2", "unit_3"]
  }
}

500 Internal Server Error -> {
  "success": false,
  "error": "Internal server error",
  "code": "DATABASE_ERROR"
  // No sensitive details exposed
}
```

---

## 🛠️ Core API Implementation Patterns

### 1. Database Connection Pattern

```typescript
// src/lib/db.ts
import { neon } from "@neon-tech/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Connection pooling and error handling built-in
export { sql };
```

### 2. Request Validation Pattern

```typescript
// src/lib/validation.ts
import { z } from "zod";

export const BookingCreateSchema = z
  .object({
    unit_id: z.string().uuid(),
    guest_name: z.string().min(1).max(100),
    contact_number: z.string().min(1).max(20),
    email: z.string().email(),
    num_guests: z.number().int().positive().max(10),
    check_in: z.string().datetime(),
    check_out: z.string().datetime(),
    total_amount: z.number().nonnegative(),
  })
  .refine((data) => new Date(data.check_out) > new Date(data.check_in), {
    message: "Check-out must be after check-in",
  });

// Usage in API route:
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validData = BookingCreateSchema.parse(body);
    // ... proceed with validated data
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation error",
          details: error.errors,
        },
        { status: 400 }
      );
    }
  }
}
```

### 3. Error Handling Pattern

```typescript
// src/lib/api-helpers.ts
export function handleDatabaseError(error: any) {
  // Log error for debugging
  console.error("Database error:", error);

  // Return user-friendly error based on type
  if (error.code === "23505") {
    // Unique violation
    return NextResponse.json(
      {
        success: false,
        error: "Duplicate record",
        code: "DUPLICATE_ERROR",
      },
      { status: 409 }
    );
  }

  if (error.code === "23503") {
    // Foreign key violation
    return NextResponse.json(
      {
        success: false,
        error: "Referenced record not found",
        code: "REFERENCE_ERROR",
      },
      { status: 400 }
    );
  }

  // Generic error (don't expose internal details)
  return NextResponse.json(
    {
      success: false,
      error: "Internal server error",
      code: "DATABASE_ERROR",
    },
    { status: 500 }
  );
}
```

### 4. Pagination Pattern

```typescript
// src/lib/pagination.ts
interface PaginationParams {
  page?: number;
  limit?: number;
  orderBy?: string;
  order?: "asc" | "desc";
}

export function buildPaginationQuery(params: PaginationParams) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;

  const orderBy = params.orderBy || "created_at";
  const order = params.order || "desc";

  return { page, limit, offset, orderBy, order };
}

// Usage:
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const { page, limit, offset, orderBy, order } = buildPaginationQuery({
    page: parseInt(searchParams.get("page") || "1"),
    limit: parseInt(searchParams.get("limit") || "20"),
    orderBy: searchParams.get("orderBy") || "created_at",
    order: (searchParams.get("order") as "asc" | "desc") || "desc",
  });

  const bookings = await sql`
    SELECT * FROM bookings 
    ORDER BY ${sql(orderBy)} ${sql.unsafe(order)}
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [{ count }] = await sql`SELECT COUNT(*) as count FROM bookings`;

  return NextResponse.json({
    success: true,
    data: bookings,
    meta: {
      total: parseInt(count),
      page,
      limit,
      has_more: offset + limit < parseInt(count),
    },
  });
}
```

---

## 🔄 Core Business Logic APIs

### 1. Availability Checking

```typescript
// GET /api/bookings/availability
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const unit_id = searchParams.get("unit_id");
  const check_in = searchParams.get("check_in");
  const check_out = searchParams.get("check_out");

  if (!check_in || !check_out) {
    return NextResponse.json(
      {
        success: false,
        error: "check_in and check_out dates required",
      },
      { status: 400 }
    );
  }

  // Check for conflicts
  const conflicts = await sql`
    SELECT booking_id, booking_reference, guest_name
    FROM bookings 
    WHERE unit_id = ${unit_id}
      AND booking_status NOT IN ('Cancelled')
      AND NOT (check_out <= ${check_in} OR check_in >= ${check_out})
  `;

  return NextResponse.json({
    success: true,
    data: {
      available: conflicts.length === 0,
      conflicts: conflicts,
    },
  });
}
```

### 2. Booking Reference Generation

```typescript
// src/lib/booking-helpers.ts
export function generateBookingReference(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `BK-${date}-${random}`;
}

// Example: "BK-20241125-A1B2"
```

### 3. Unit Status Management

```typescript
// PUT /api/units/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { unit_status } = body;

  // Validate status transition
  const allowedStatuses = ["Available", "Occupied", "Maintenance", "Offline"];
  if (!allowedStatuses.includes(unit_status)) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid unit status",
      },
      { status: 400 }
    );
  }

  // Check for active bookings if setting to Maintenance
  if (unit_status === "Maintenance") {
    const activeBookings = await sql`
      SELECT booking_id FROM bookings 
      WHERE unit_id = ${params.id}
        AND booking_status IN ('Confirmed', 'In Progress')
        AND check_out >= CURRENT_DATE
    `;

    if (activeBookings.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot set to maintenance: active bookings exist",
          details: { active_bookings: activeBookings.length },
        },
        { status: 409 }
      );
    }
  }

  const result = await sql`
    UPDATE units 
    SET unit_status = ${unit_status}, updated_at = NOW()
    WHERE unit_id = ${params.id}
    RETURNING *
  `;

  return NextResponse.json({
    success: true,
    data: result[0],
  });
}
```

---

## 📈 Performance & Scalability

### Connection Management

```typescript
// Database connections handled by Neon serverless
// No manual connection pooling required
// Automatic scaling based on request load
```

### Caching Strategy (Phase 2+)

```typescript
// src/lib/cache.ts
const cache = new Map();

export function getCached<T>(key: string, ttl: number = 300): T | null {
  const item = cache.get(key);
  if (!item) return null;

  if (Date.now() > item.expires) {
    cache.delete(key);
    return null;
  }

  return item.data;
}

export function setCache<T>(key: string, data: T, ttl: number = 300): void {
  cache.set(key, {
    data,
    expires: Date.now() + ttl * 1000,
  });
}

// Usage for expensive queries:
export async function GET() {
  const cacheKey = "units:available";
  let units = getCached(cacheKey);

  if (!units) {
    units = await sql`SELECT * FROM units WHERE unit_status = 'Available'`;
    setCache(cacheKey, units, 300); // 5 minutes
  }

  return NextResponse.json({ success: true, data: units });
}
```

### Rate Limiting (Phase 3+)

```typescript
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const rateLimit = new Map();

export function middleware(request: NextRequest) {
  const ip = request.ip || "anonymous";
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100;

  const userRequests = rateLimit.get(ip) || [];
  const recentRequests = userRequests.filter(
    (time: number) => now - time < windowMs
  );

  if (recentRequests.length >= maxRequests) {
    return NextResponse.json(
      {
        success: false,
        error: "Too many requests",
      },
      { status: 429 }
    );
  }

  recentRequests.push(now);
  rateLimit.set(ip, recentRequests);

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
```

---

## 🔐 Security Patterns

### Input Sanitization

```typescript
// src/lib/sanitize.ts
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .slice(0, 1000); // Prevent extremely long inputs
}

export function sanitizeEmail(input: string): string {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const cleaned = input.trim().toLowerCase();
  return emailRegex.test(cleaned) ? cleaned : "";
}
```

### SQL Injection Prevention

```typescript
// ✅ Safe: Parameterized queries with neon
const bookings = await sql`
  SELECT * FROM bookings 
  WHERE guest_name = ${guestName} 
  AND check_in >= ${checkIn}
`;

// ❌ Unsafe: String concatenation (never do this)
const query = `SELECT * FROM bookings WHERE guest_name = '${guestName}'`;
```

### CORS Configuration

```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "https://okaeri-resort.vercel.app",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,POST,PUT,DELETE,OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type,Authorization",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

---

## 📊 Monitoring & Logging

### Basic Logging Pattern

```typescript
// src/lib/logger.ts
export function logAPIRequest(method: string, path: string, duration: number, status: number) {
  const timestamp = new Date().toISOString();
  const logLine = `${timestamp} ${method} ${path} ${status} ${duration}ms`;

  if (process.env.NODE_ENV === 'development') {
    console.log(logLine);
  }

  // In production, could send to logging service
  // e.g., Vercel Analytics, LogRocket, etc.
}

// Usage in API routes:
export async function GET(request: NextRequest) {
  const start = Date.now();

  try {
    // ... API logic
    const response = NextResponse.json({...});
    logAPIRequest('GET', '/api/bookings', Date.now() - start, 200);
    return response;
  } catch (error) {
    logAPIRequest('GET', '/api/bookings', Date.now() - start, 500);
    throw error;
  }
}
```

### Health Check Endpoint

```typescript
// src/app/api/health/route.ts
export async function GET() {
  try {
    // Test database connection
    await sql`SELECT 1`;

    // Test other services if needed
    const checks = {
      database: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || "1.0.0",
    };

    return NextResponse.json({
      success: true,
      data: checks,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Health check failed",
      },
      { status: 503 }
    );
  }
}
```

---

_API Architecture v1.0 - RESTful, Scalable, Secure_
