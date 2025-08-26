# Multi-Project Architecture & Database Schema - Detailed Serverless Plan

## Overview

The multi-project architecture enables complete data isolation between different
business ventures while maintaining a unified user management system. This
design supports horizontal scaling for family business expansion across
different property types and business models using **modern serverless
patterns**.

## Architecture Principles

### Core Design Philosophy

- **Complete Data Isolation:** Each project operates as an independent business
  entity
- **Serverless-First:** Zero server management with edge-optimized performance
- **Horizontal Scalability:** Easy addition of new projects without affecting
  existing ones
- **Unified Experience:** Single interface with seamless project switching
- **Cost-Optimized:** Pay-per-request pricing with intelligent connection
  management

### Modern Serverless Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORMS Serverless Platform                     │
├─────────────────────────────────────────────────────────────────┤
│                   Vercel Edge Network                           │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐ │
│  │ Static Assets   │ │ Vite Frontend   │ │ API Routes (Edge)   │ │
│  │ (Global CDN)    │ │ (React 19)      │ │ (Serverless Funcs)  │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                Serverless Database Layer                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │           Neon PostgreSQL (Serverless)                     │ │
│  │  • Auto-scaling compute & storage separation               │ │
│  │  • Instant connection pooling                              │ │
│  │  • Schema-based project isolation                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                   Storage & Services                            │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐ │
│  │ Cloudflare R2   │ │ JWT Auth        │ │ Background Tasks    │ │
│  │ (File Storage)  │ │ (Stateless)     │ │ (Vercel Cron)       │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Serverless Database Design Strategy

### Schema Isolation with Neon PostgreSQL

**Selected Method:** Database schemas with serverless connection pooling

- Each project gets its own schema namespace
- Global tables for user management and project metadata
- Project-specific tables within dedicated schemas
- Intelligent connection pooling optimized for serverless

### Modern Database Architecture

```sql
-- Global Schema (public) - Shared across all projects
├── users                    -- User authentication & profiles
├── projects                -- Project registry & metadata
├── user_project_permissions -- Role-based access control
├── global_settings         -- Platform-wide configuration
└── audit_logs              -- Security & compliance logging

-- Project Schema Pattern (project_okaeri_resort)
├── bookings                -- Project-specific bookings
├── payments               -- Payment tracking & history
├── expenses               -- Financial expense management
├── income                 -- Revenue tracking
├── expense_categories     -- Customizable expense categories
├── booking_timeline       -- Workflow state management
├── project_settings       -- Project-specific configuration
└── project_reports_cache  -- Performance optimization
```

## Modern Serverless API Architecture

### Vercel API Routes Structure

```
api/                           # Serverless function directory
├── auth/                      # Authentication endpoints
│   ├── login.js              # POST /api/auth/login
│   ├── register.js           # POST /api/auth/register
│   ├── me.js                 # GET /api/auth/me
│   └── logout.js             # POST /api/auth/logout
│
├── projects/                  # Project management
│   ├── index.js              # GET /api/projects (list)
│   ├── create.js             # POST /api/projects (create)
│   └── [id]/                 # Dynamic project routes
│       ├── index.js          # GET /api/projects/[id]
│       ├── settings.js       # PUT /api/projects/[id]/settings
│       └── users.js          # GET/POST /api/projects/[id]/users
│
├── [projectId]/              # Project-scoped endpoints
│   ├── bookings/
│   │   ├── index.js         # GET/POST /api/[projectId]/bookings
│   │   ├── import.js        # POST /api/[projectId]/bookings/import
│   │   └── [id]/
│   │       ├── index.js     # GET/PUT/DELETE /api/[projectId]/bookings/[id]
│   │       └── payments.js  # POST /api/[projectId]/bookings/[id]/payments
│   │
│   ├── expenses/
│   │   ├── index.js         # GET/POST /api/[projectId]/expenses
│   │   ├── categories.js    # GET/POST /api/[projectId]/expenses/categories
│   │   └── [id].js          # GET/PUT/DELETE /api/[projectId]/expenses/[id]
│   │
│   ├── reports/
│   │   ├── monthly.js       # GET /api/[projectId]/reports/monthly
│   │   ├── custom.js        # POST /api/[projectId]/reports/custom
│   │   └── export.js        # POST /api/[projectId]/reports/export
│   │
│   └── dashboard.js         # GET /api/[projectId]/dashboard
│
└── upload/                   # File handling endpoints
    ├── receipt.js           # POST /api/upload/receipt
    └── csv.js               # POST /api/upload/csv
```

### Serverless Function Example

**File:** `api/[projectId]/bookings/index.js`

```javascript
import { neon } from "@neondatabase/serverless";
import {
  authenticateUser,
  checkProjectAccess,
} from "../../../lib/auth-middleware";
import { validateBookingData } from "../../../lib/validations";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  try {
    // Authenticate user (JWT-based)
    const user = await authenticateUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Extract project ID from URL
    const { projectId } = req.query;

    // Check project access permissions
    const hasAccess = await checkProjectAccess(
      user.id,
      projectId,
      "bookings.read"
    );
    if (!hasAccess) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (req.method === "GET") {
      // List bookings with pagination and filtering
      const { page = 1, limit = 20, status, source } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT b.*, u.first_name as created_by_name
        FROM project_${projectId.replace(/[^a-z0-9_]/gi, "_")}.bookings b
        LEFT JOIN users u ON u.id = b.created_by
        WHERE 1=1
      `;
      const params = [];

      if (status) {
        params.push(status);
        query += ` AND b.booking_status = $${params.length}`;
      }

      if (source) {
        params.push(source);
        query += ` AND b.source = $${params.length}`;
      }

      params.push(limit, offset);
      query += ` ORDER BY b.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

      const bookings = await sql.query(query, params);

      return res.status(200).json({
        bookings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: bookings.length === parseInt(limit),
        },
      });
    }

    if (req.method === "POST") {
      // Create new booking
      const hasCreateAccess = await checkProjectAccess(
        user.id,
        projectId,
        "bookings.create"
      );
      if (!hasCreateAccess) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const bookingData = validateBookingData(req.body);

      const [newBooking] = await sql`
        INSERT INTO project_${sql.unsafe(projectId.replace(/[^a-z0-9_]/gi, "_"))}.bookings (
          booking_reference, source, guest_name, guest_email, guest_phone,
          checkin_date, checkout_date, guest_count, total_amount,
          booking_status, created_by, created_at
        ) VALUES (
          ${bookingData.bookingReference}, ${bookingData.source}, ${bookingData.guestName},
          ${bookingData.guestEmail}, ${bookingData.guestPhone}, ${bookingData.checkinDate},
          ${bookingData.checkoutDate}, ${bookingData.guestCount}, ${bookingData.totalAmount},
          'pending', ${user.id}, NOW()
        )
        RETURNING *
      `;

      return res.status(201).json({ booking: newBooking });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
```

## Core Database Tables

### Global Tables (Shared Across All Projects)

#### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  profile_image_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  email_verified_at TIMESTAMP,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Optimized indexes for serverless queries
CREATE INDEX idx_users_email ON users(email) WHERE is_active = true;
CREATE INDEX idx_users_last_login ON users(last_login DESC) WHERE is_active = true;
```

#### Projects Table

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  business_type VARCHAR(100), -- 'resort', 'restaurant', 'tour', etc.
  location VARCHAR(300),
  schema_name VARCHAR(100) UNIQUE NOT NULL,
  currency VARCHAR(3) DEFAULT 'PHP',
  timezone VARCHAR(50) DEFAULT 'Asia/Manila',
  settings JSONB DEFAULT '{}', -- Project-specific configuration
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Performance indexes for project queries
CREATE INDEX idx_projects_active ON projects(is_active, created_at DESC);
CREATE INDEX idx_projects_created_by ON projects(created_by) WHERE is_active = true;
CREATE INDEX idx_projects_schema_name ON projects(schema_name) WHERE is_active = true;
```

#### User Project Permissions Table

```sql
CREATE TABLE user_project_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- 'owner', 'manager', 'staff'
  permissions JSONB DEFAULT '{}', -- Granular permission settings
  is_active BOOLEAN DEFAULT true,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- Optional permission expiration

  UNIQUE(user_id, project_id)
);

-- Critical indexes for auth queries
CREATE INDEX idx_user_project_permissions_active
  ON user_project_permissions(user_id, project_id)
  WHERE is_active = true;
CREATE INDEX idx_user_project_permissions_role
  ON user_project_permissions(project_id, role)
  WHERE is_active = true;
```

### Serverless Connection Management

#### Database Connection Utility

**File:** `lib/db.js`

```javascript
import { neon, Pool } from "@neondatabase/serverless";

// Global connection instance (reused across function calls)
let globalConnection = null;

export function getConnection() {
  if (!globalConnection) {
    globalConnection = neon(process.env.DATABASE_URL, {
      // Serverless-optimized configuration
      fetchOptions: {
        priority: "high", // Prioritize database calls
      },
      arrayMode: false, // Return objects instead of arrays
      fullResults: false, // Lightweight results for faster responses
    });
  }
  return globalConnection;
}

// For transaction support (when needed)
export function getPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1, // Minimal pool size for serverless
  });
}

// Schema-aware query helper
export function createProjectQuery(projectId) {
  const sql = getConnection();
  const schemaName = `project_${projectId.replace(/[^a-z0-9_]/gi, "_")}`;

  return {
    // Safe schema-scoped queries
    query: (strings, ...values) => {
      // Replace table references with schema-prefixed versions
      const query = strings.join("?").replace(/\b(\w+)\./g, `${schemaName}.$1`);
      return sql.query(query, values);
    },

    // Direct SQL template with schema prefix
    sql: (strings, ...values) => {
      const query = strings.raw
        .join("?")
        .replace(/FROM (\w+)/g, `FROM ${schemaName}.$1`);
      return sql.query(query, values);
    },
  };
}
```

### Project-Specific Tables Template

#### Bookings Table (per project schema)

```sql
CREATE TABLE ${project_schema}.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference VARCHAR(100) UNIQUE NOT NULL,
  source VARCHAR(50) NOT NULL, -- 'airbnb', 'facebook', 'direct'
  guest_name VARCHAR(200) NOT NULL,
  guest_email VARCHAR(255),
  guest_phone VARCHAR(50),
  guest_details JSONB DEFAULT '{}', -- Additional guest information
  checkin_date DATE NOT NULL,
  checkout_date DATE NOT NULL,
  nights INTEGER GENERATED ALWAYS AS (checkout_date - checkin_date) STORED,
  guest_count INTEGER NOT NULL,
  room_type VARCHAR(100),
  total_amount DECIMAL(10,2) NOT NULL,
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  balance_amount DECIMAL(10,2) GENERATED ALWAYS AS (total_amount - deposit_amount) STORED,
  booking_status VARCHAR(50) DEFAULT 'pending',
  special_requests TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_dates CHECK (checkout_date > checkin_date),
  CONSTRAINT valid_amounts CHECK (total_amount >= 0 AND deposit_amount >= 0),
  CONSTRAINT valid_guest_count CHECK (guest_count > 0)
);

-- Serverless-optimized indexes
CREATE INDEX idx_bookings_status_date ON ${project_schema}.bookings(booking_status, checkin_date DESC);
CREATE INDEX idx_bookings_source_date ON ${project_schema}.bookings(source, created_at DESC);
CREATE INDEX idx_bookings_checkin ON ${project_schema}.bookings(checkin_date) WHERE booking_status IN ('confirmed', 'checked_in');
```

## Serverless Middleware Stack

### Authentication Middleware

**File:** `lib/auth-middleware.js`

```javascript
import jwt from "jsonwebtoken";
import { getConnection } from "./db.js";

const sql = getConnection();

export async function authenticateUser(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user data (with caching consideration)
    const [user] = await sql`
      SELECT id, email, first_name, last_name, is_active
      FROM users 
      WHERE id = ${decoded.userId} AND is_active = true
    `;

    return user || null;
  } catch (error) {
    console.error("Auth error:", error);
    return null;
  }
}

export async function checkProjectAccess(userId, projectId, permission) {
  try {
    const [access] = await sql`
      SELECT 
        upp.role,
        upp.permissions,
        p.is_active as project_active
      FROM user_project_permissions upp
      JOIN projects p ON p.id = upp.project_id
      WHERE upp.user_id = ${userId} 
        AND upp.project_id = ${projectId}
        AND upp.is_active = true
        AND p.is_active = true
    `;

    if (!access) return false;

    // Check role-based permissions
    if (access.role === "owner") return true;

    // Check granular permissions
    if (access.permissions && access.permissions[permission]) {
      return access.permissions[permission] === true;
    }

    // Default role permissions
    const rolePermissions = {
      manager: [
        "bookings.read",
        "bookings.create",
        "bookings.update",
        "expenses.read",
        "expenses.create",
      ],
      staff: ["bookings.read", "expenses.create"],
    };

    return rolePermissions[access.role]?.includes(permission) || false;
  } catch (error) {
    console.error("Permission check error:", error);
    return false;
  }
}
```

## Project Management System

### Dynamic Schema Creation

**File:** `lib/project-manager.js`

```javascript
import { getConnection } from "./db.js";

const sql = getConnection();

export async function createProject(userId, projectData) {
  try {
    // Start transaction for atomic project creation
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Create project record
      const [project] = await client.query(
        `
        INSERT INTO projects (name, description, business_type, location, schema_name, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
        [
          projectData.name,
          projectData.description,
          projectData.businessType,
          projectData.location,
          generateSchemaName(projectData.name),
          userId,
        ]
      );

      // Create dedicated schema
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${project.schema_name}`);

      // Deploy table structure from template
      await deployProjectSchema(client, project.schema_name);

      // Grant owner permissions
      await client.query(
        `
        INSERT INTO user_project_permissions (user_id, project_id, role, granted_by)
        VALUES ($1, $2, 'owner', $1)
      `,
        [userId, project.id]
      );

      await client.query("COMMIT");
      return project;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Project creation error:", error);
    throw new Error("Failed to create project");
  }
}

function generateSchemaName(projectName) {
  return `project_${projectName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;
}

async function deployProjectSchema(client, schemaName) {
  // Deploy all project-specific tables
  const tables = [
    "bookings",
    "payments",
    "expenses",
    "income",
    "expense_categories",
    "booking_timeline",
    "project_settings",
  ];

  for (const table of tables) {
    await client.query(await getTableSchema(table, schemaName));
  }
}
```

## Performance Optimization

### Serverless-Specific Optimizations

#### Connection Pooling Strategy

```javascript
// lib/connection-pool.js
import { neonConfig } from "@neondatabase/serverless";

// Configure for optimal serverless performance
neonConfig.fetchOptions = {
  priority: "high",
  cache: "no-store", // Prevent stale data in edge caches
};

// Enable experimental poolQueryViaFetch for better performance
neonConfig.poolQueryViaFetch = true;

// Optimize for Vercel edge regions
neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
```

#### Intelligent Caching

```javascript
// lib/cache-helpers.js
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function withCache(key, fetcher, ttl = CACHE_TTL) {
  return async (...args) => {
    const cacheKey = `${key}:${JSON.stringify(args)}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }

    const data = await fetcher(...args);
    cache.set(cacheKey, { data, timestamp: Date.now() });

    // Cleanup old entries
    if (cache.size > 100) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    return data;
  };
}
```

### Database Query Optimization

```sql
-- Optimized indexes for common serverless query patterns

-- User authentication (frequent)
CREATE INDEX CONCURRENTLY idx_users_auth
  ON users(email, password_hash)
  WHERE is_active = true;

-- Project access checks (frequent)
CREATE INDEX CONCURRENTLY idx_permissions_check
  ON user_project_permissions(user_id, project_id, is_active)
  INCLUDE (role, permissions);

-- Dashboard queries (frequent)
CREATE INDEX CONCURRENTLY idx_bookings_dashboard
  ON project_schema.bookings(created_at DESC, booking_status)
  WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Financial reporting (periodic)
CREATE INDEX CONCURRENTLY idx_expenses_reporting
  ON project_schema.expenses(expense_date DESC, category_id)
  INCLUDE (amount, currency);
```

## Security Implementation

### Serverless Security Patterns

#### JWT Authentication

```javascript
// lib/jwt-auth.js
import jwt from "jsonwebtoken";

export function generateTokens(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    version: user.token_version || 1,
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "15m",
    issuer: "orms-platform",
    audience: "orms-client",
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
    issuer: "orms-platform",
    audience: "orms-client",
  });

  return { accessToken, refreshToken };
}

export function verifyToken(token, secret = process.env.JWT_SECRET) {
  try {
    return jwt.verify(token, secret, {
      issuer: "orms-platform",
      audience: "orms-client",
    });
  } catch (error) {
    return null;
  }
}
```

#### Input Validation & Sanitization

```javascript
// lib/validations.js
import { z } from "zod";

export const BookingSchema = z
  .object({
    guestName: z.string().min(1).max(200),
    guestEmail: z.string().email().optional(),
    guestPhone: z.string().max(50).optional(),
    checkinDate: z.string().pipe(z.coerce.date()),
    checkoutDate: z.string().pipe(z.coerce.date()),
    guestCount: z.number().int().min(1).max(50),
    totalAmount: z.number().min(0),
    source: z.enum(["airbnb", "facebook", "direct"]),
    bookingReference: z.string().min(1).max(100),
  })
  .refine((data) => data.checkoutDate > data.checkinDate, {
    message: "Check-out date must be after check-in date",
  });

export function validateBookingData(data) {
  return BookingSchema.parse(data);
}
```

## Monitoring & Observability

### Serverless Monitoring

```javascript
// lib/monitoring.js
export function logPerformance(operation, duration, metadata = {}) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      operation,
      duration,
      ...metadata,
      level: "performance",
    })
  );
}

export function logError(error, context = {}) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      ...context,
      level: "error",
    })
  );
}
```

## Scalability & Cost Optimization

### Auto-Scaling Configuration

- **Database:** Neon auto-scales compute based on demand
- **Functions:** Vercel scales from 0 to thousands instantly
- **Storage:** Cloudflare R2 scales infinitely with usage-based pricing
- **CDN:** Global edge network for optimal performance

### Cost Management

- **Database:** $0/month (Neon free tier: 0.5GB storage, 3GB transfer)
- **Functions:** $0/month (Vercel free tier: unlimited functions, 100GB
  bandwidth)
- **Storage:** ~$0.01-0.50/month (R2 storage costs)
- **Total:** **$1-3/month** for typical family resort operations

---

_This modern serverless architecture provides enterprise-level capabilities
while maintaining minimal operational costs and zero server management overhead.
The design enables unlimited business expansion through complete project
isolation and intelligent resource scaling._

## Phase Verification Steps

### Phase 1: Database Architecture Setup ✓

**Verification Checklist:**

- [ ] Neon PostgreSQL instance created
- [ ] Connection pooling configured
- [ ] Global schema created successfully
- [ ] Project schemas isolated properly
- [ ] Foreign key relationships established
- [ ] Database migrations tracked

**Testing Commands:**

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT version()"

# Verify schema isolation
psql $DATABASE_URL -c "\dn"

# Check foreign keys
psql $DATABASE_URL -c "SELECT * FROM information_schema.referential_constraints"

# Test connection pooling
npm run test:db-connections -- --concurrent 100
```

### Phase 2: Authentication & Authorization ✓

**Verification Checklist:**

- [ ] JWT token generation working
- [ ] Token validation middleware functional
- [ ] Project access controls enforced
- [ ] Role-based permissions active
- [ ] Session management secure
- [ ] Password hashing implemented

**Security Testing:**

```bash
# Test authentication flow
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password"}'

# Test token validation
curl -H "Authorization: Bearer INVALID_TOKEN" \
  http://localhost:3000/api/projects

# Test project access control
curl -H "Authorization: Bearer $USER_A_TOKEN" \
  http://localhost:3000/api/project-b/bookings
```

### Phase 3: Multi-Project Data Isolation ✓

**Verification Checklist:**

- [ ] Projects completely isolated
- [ ] Cross-project queries blocked
- [ ] Schema permissions enforced
- [ ] Project switching seamless
- [ ] Data leakage prevented
- [ ] Audit logging functional

**Isolation Testing:**

1. Create data in Project A
2. Switch to Project B - data not visible
3. Attempt cross-project query - should fail
4. Check audit logs for attempts
5. Verify no data mixing in UI

### Phase 4: API Route Implementation ✓

**Verification Checklist:**

- [ ] All CRUD operations working
- [ ] Dynamic routing functional
- [ ] Request validation active
- [ ] Error handling consistent
- [ ] Response formats standardized
- [ ] Rate limiting implemented

**API Testing:**

```bash
# Test all endpoints
npm run test:api

# Load test API routes
npm run test:load -- --endpoint /api/[projectId]/bookings

# Test rate limiting
for i in {1..200}; do
  curl http://localhost:3000/api/projects
done
```

### Phase 5: Serverless Function Optimization ✓

**Verification Checklist:**

- [ ] Cold start time < 1 second
- [ ] Function size < 50MB
- [ ] Memory usage optimized
- [ ] Timeout handling proper
- [ ] Error recovery working
- [ ] Logging configured

**Performance Testing:**

```bash
# Measure cold start
vercel dev --debug

# Check function size
du -sh api/**/*.js

# Monitor memory usage
vercel logs --follow

# Test timeout scenarios
npm run test:timeouts
```

### Phase 6: File Storage Integration ✓

**Verification Checklist:**

- [ ] R2 bucket configured
- [ ] File upload working
- [ ] File retrieval functional
- [ ] Access controls enforced
- [ ] Signed URLs working
- [ ] File size limits enforced

**Storage Testing:**

```bash
# Test file upload
curl -X POST http://localhost:3000/api/upload \
  -F "file=@test-receipt.jpg"

# Verify R2 storage
wrangler r2 object list receipts

# Test signed URL generation
curl http://localhost:3000/api/files/generate-url

# Check storage limits
npm run test:storage-limits
```

### Phase 7: Connection Management ✓

**Verification Checklist:**

- [ ] Connection pooling working
- [ ] Pool size optimized
- [ ] Connection reuse effective
- [ ] Timeout handling proper
- [ ] Error recovery automatic
- [ ] Monitoring active

**Connection Testing:**

```bash
# Monitor connection pool
neon connection-stats

# Test concurrent connections
npm run test:concurrent -- --connections 50

# Check connection leaks
npm run test:connection-leaks

# Verify pool configuration
psql $DATABASE_URL -c "SHOW max_connections"
```

### Integration Testing

**Multi-Project Scenarios:**

1. **Project Creation Flow:**
   - [ ] Create new project
   - [ ] Schema auto-created
   - [ ] Initial data seeded
   - [ ] Access permissions set
   - [ ] Settings configured

2. **Project Switching:**
   - [ ] User switches projects
   - [ ] Data context changes
   - [ ] No data leakage
   - [ ] Performance maintained
   - [ ] UI updates correctly

3. **Cross-Project Operations:**
   - [ ] User manages multiple projects
   - [ ] Dashboard shows aggregate data
   - [ ] Reports span projects (if permitted)
   - [ ] Billing aggregated correctly

### Performance Benchmarks

**Target Metrics:**

- [ ] API response time < 200ms (p95)
- [ ] Database query time < 50ms (p95)
- [ ] File upload < 3 seconds for 5MB
- [ ] Project switch < 1 second
- [ ] Dashboard load < 2 seconds
- [ ] Concurrent users > 100

**Performance Testing:**

```bash
# Run performance suite
npm run test:performance

# Benchmark database queries
npm run benchmark:db

# Load test with K6
k6 run scripts/load-test.js

# Profile slow queries
psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10"
```

### Security Verification

**Security Checklist:**

- [ ] SQL injection prevented
- [ ] XSS attacks blocked
- [ ] CSRF protection enabled
- [ ] Authentication secure
- [ ] Authorization enforced
- [ ] Data encrypted at rest

**Security Testing:**

```bash
# SQL injection test
npm run test:security -- --sql-injection

# XSS vulnerability scan
npm run test:security -- --xss

# Authentication bypass attempts
npm run test:security -- --auth-bypass

# Check security headers
curl -I http://localhost:3000
```

### Scalability Testing

**Scalability Verification:**

- [ ] Handle 10 concurrent projects
- [ ] Support 1000+ bookings per project
- [ ] Process 100 concurrent requests
- [ ] Scale to 10GB+ data
- [ ] Maintain sub-second response
- [ ] Zero downtime deployment

**Scalability Testing:**

```bash
# Create multiple projects
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/projects \
    -d "name=Project$i"
done

# Seed large dataset
npm run seed:large -- --bookings 1000

# Concurrent request test
npm run test:concurrent -- --requests 100

# Monitor during load
vercel logs --follow
```

### Monitoring & Observability

**Monitoring Checklist:**

- [ ] Error tracking configured
- [ ] Performance metrics collected
- [ ] Database metrics tracked
- [ ] Function metrics monitored
- [ ] User analytics implemented
- [ ] Alerts configured

**Monitoring Setup:**

```bash
# View function logs
vercel logs --follow

# Check error rates
vercel logs --filter error

# Database performance
neon metrics

# Setup alerts
vercel env add SLACK_WEBHOOK
```

### Disaster Recovery

**Recovery Checklist:**

- [ ] Database backups automated
- [ ] Point-in-time recovery tested
- [ ] Project data exportable
- [ ] File backups configured
- [ ] Recovery procedures documented
- [ ] RTO/RPO targets met

**Recovery Testing:**

```bash
# Test database backup
neon backup create

# Restore from backup
neon backup restore --id backup-123

# Export project data
npm run export:project -- --id project-123

# Verify file backups
wrangler r2 object list backups
```

### Cost Optimization

**Cost Monitoring:**

- [ ] Database usage within limits
- [ ] Function invocations tracked
- [ ] Bandwidth usage monitored
- [ ] Storage costs optimized
- [ ] Alert on cost spikes
- [ ] Monthly budget adhered

**Cost Analysis:**

```bash
# Check Vercel usage
vercel billing

# Monitor Neon usage
neon usage

# R2 storage costs
wrangler r2 bucket metrics receipts

# Generate cost report
npm run report:costs -- --month current
```

This comprehensive verification ensures the multi-project architecture meets all
security, performance, and scalability requirements while maintaining cost
efficiency.
