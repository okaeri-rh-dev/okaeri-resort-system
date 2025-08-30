# Sub-Phase 1.5: Database Schema Implementation

## Overview

This sub-phase implements the multi-tenant database architecture using Neon
PostgreSQL. It establishes the schema design for complete project isolation,
user management, and the foundation for all data operations with serverless
optimization.

## Objectives

1. Setup Neon PostgreSQL with serverless configuration
2. Implement multi-tenant schema architecture
3. Create global and project-specific tables
4. Setup migration system and version control
5. Implement connection pooling and optimization

## Technical Requirements

### Core Dependencies

```json
{
  "dependencies": {
    "@neondatabase/serverless": "^0.10.0",
    "@prisma/client": "^6.0.0",
    "@prisma/adapter-neon": "^6.0.0",
    "drizzle-orm": "^0.38.0",
    "drizzle-kit": "^0.30.0",
    "postgres": "^3.5.0"
  },
```

## Test-First Development Process

### Step 1: Define Test Specifications

- Agent writes comprehensive test suite based on requirements
- Tests cover expected input/output pairs for database schema
- Include edge cases, error scenarios, and Philippine-specific requirements
- Reference test templates from `/tests/templates/`

### Step 2: Validate Tests Fail

- Run test suite to confirm all tests fail (no implementation exists)
- Command: `npm test database-schema.test.ts`
- Expected: All tests should fail with clear error messages
- NO implementation code should be written at this stage

### Step 3: Commit Test Suite

- Tests are committed as the immutable specification
- Commit message: "test: add failing tests for database schema"
- These tests CANNOT be modified during implementation

### Step 4: Implement Feature

- Agent writes minimal code to pass ALL tests
- Tests remain unchanged - implementation must adapt
- Use repository patterns from `/src/lib/repositories/`
- Apply dependency injection for testability

### Step 5: Independent Verification

- Different specialized agent reviews implementation
- Ensures no overfitting to test cases
- Validates general solution beyond test scenarios
- Confirms best practices and patterns are followed

## Original Technical Requirements (continued)

### Core Dependencies (continued)

```json
  "dependencies": {
    "@neondatabase/serverless": "^0.10.0",
    "@prisma/client": "^6.0.0",
    "@prisma/adapter-neon": "^6.0.0",
    "drizzle-orm": "^0.38.0",
    "drizzle-kit": "^0.30.0",
    "postgres": "^3.5.0"
  },
  "devDependencies": {
    "prisma": "^6.0.0",
    "@types/pg": "^8.11.0"
  }
}
```

### Database Architecture

```
Neon PostgreSQL Database
├── Public Schema (Global)
│   ├── users
│   ├── projects
│   ├── user_project_permissions
│   ├── audit_logs
│   └── system_settings
└── Project Schemas (Isolated)
    ├── project_[id]_schema
    │   ├── bookings
    │   ├── payments
    │   ├── expenses
    │   ├── expense_categories
    │   ├── income
    │   ├── booking_timeline
    │   ├── project_settings
    │   └── project_audit_logs
    └── project_[id2]_schema
        └── [same structure]
```

## Implementation

### Database Connection Setup

```typescript
// lib/db/connection.ts
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Configure for serverless
neonConfig.fetchOptions = {
  priority: "high",
};

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });

// Raw SQL client for complex queries
export const rawSql = sql;

// Transaction support
export async function transaction<T>(
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  // Neon serverless doesn't support traditional transactions
  // Use optimistic locking or saga pattern instead
  return callback(db);
}
```

### Global Schema Tables

```sql
-- users table
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
  token_version INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email) WHERE is_active = true;
CREATE INDEX idx_users_last_login ON users(last_login DESC) WHERE is_active = true;
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) UNIQUE NOT NULL,
  description TEXT,
  business_type VARCHAR(100) NOT NULL,
  location VARCHAR(300),
  schema_name VARCHAR(100) UNIQUE NOT NULL,
  currency VARCHAR(3) DEFAULT 'PHP',
  timezone VARCHAR(50) DEFAULT 'Asia/Manila',
  settings JSONB DEFAULT '{}',
  features JSONB DEFAULT '{"bookings": true, "expenses": true, "reports": true}',
  is_active BOOLEAN DEFAULT true,
  is_demo BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_projects_active ON projects(is_active, created_at DESC);
CREATE INDEX idx_projects_created_by ON projects(created_by) WHERE is_active = true;
CREATE INDEX idx_projects_slug ON projects(slug) WHERE is_active = true;

-- user_project_permissions table
CREATE TABLE user_project_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'manager', 'staff', 'viewer')),
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  last_accessed TIMESTAMP,
  UNIQUE(user_id, project_id)
);

CREATE INDEX idx_upp_user_project ON user_project_permissions(user_id, project_id)
  WHERE is_active = true;
CREATE INDEX idx_upp_project_role ON user_project_permissions(project_id, role)
  WHERE is_active = true;

-- audit_logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  project_id UUID REFERENCES projects(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_project ON audit_logs(project_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- system_settings table
CREATE TABLE system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Project Schema Template

```sql
-- Function to create project schema
CREATE OR REPLACE FUNCTION create_project_schema(project_id UUID, schema_name TEXT)
RETURNS void AS $$
BEGIN
  -- Create schema
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

  -- Create bookings table
  EXECUTE format('
    CREATE TABLE %I.bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_reference VARCHAR(100) UNIQUE NOT NULL,
      source VARCHAR(50) NOT NULL,
      platform_booking_id VARCHAR(100),
      guest_name VARCHAR(200) NOT NULL,
      guest_email VARCHAR(255),
      guest_phone VARCHAR(50),
      guest_details JSONB DEFAULT ''{}'',
      checkin_date DATE NOT NULL,
      checkout_date DATE NOT NULL,
      checkin_time TIME DEFAULT ''14:00'',
      checkout_time TIME DEFAULT ''11:00'',
      nights INTEGER GENERATED ALWAYS AS (checkout_date - checkin_date) STORED,
      guest_count INTEGER NOT NULL,
      adult_count INTEGER,
      child_count INTEGER DEFAULT 0,
      room_type VARCHAR(100),
      room_numbers TEXT[],
      total_amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(3) DEFAULT ''PHP'',
      deposit_amount DECIMAL(10,2) DEFAULT 0,
      balance_amount DECIMAL(10,2) GENERATED ALWAYS AS (total_amount - deposit_amount) STORED,
      booking_status VARCHAR(50) DEFAULT ''pending'',
      payment_status VARCHAR(50) DEFAULT ''pending'',
      special_requests TEXT,
      internal_notes TEXT,
      tags TEXT[],
      metadata JSONB DEFAULT ''{}'',
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      cancelled_at TIMESTAMP,
      cancellation_reason TEXT,
      CONSTRAINT valid_dates CHECK (checkout_date > checkin_date),
      CONSTRAINT valid_amounts CHECK (total_amount >= 0 AND deposit_amount >= 0),
      CONSTRAINT valid_guest_count CHECK (guest_count > 0)
    )', schema_name);

  -- Create indexes
  EXECUTE format('CREATE INDEX idx_%I_bookings_status ON %I.bookings(booking_status, checkin_date DESC)',
    schema_name, schema_name);
  EXECUTE format('CREATE INDEX idx_%I_bookings_dates ON %I.bookings(checkin_date, checkout_date)',
    schema_name, schema_name);
  EXECUTE format('CREATE INDEX idx_%I_bookings_reference ON %I.bookings(booking_reference)',
    schema_name, schema_name);

  -- Create payments table
  EXECUTE format('
    CREATE TABLE %I.payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID REFERENCES %I.bookings(id) ON DELETE CASCADE,
      expense_id UUID,
      payment_type VARCHAR(50) NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(3) DEFAULT ''PHP'',
      reference_number VARCHAR(100),
      payment_date TIMESTAMP NOT NULL,
      receipt_url VARCHAR(500),
      notes TEXT,
      metadata JSONB DEFAULT ''{}'',
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )', schema_name, schema_name);

  -- Create expenses table
  EXECUTE format('
    CREATE TABLE %I.expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      expense_date DATE NOT NULL,
      category_id UUID,
      category_name VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(3) DEFAULT ''PHP'',
      payment_method VARCHAR(50),
      vendor_name VARCHAR(200),
      receipt_url VARCHAR(500),
      is_recurring BOOLEAN DEFAULT false,
      recurrence_pattern JSONB,
      tags TEXT[],
      metadata JSONB DEFAULT ''{}'',
      created_by UUID REFERENCES users(id),
      approved_by UUID REFERENCES users(id),
      approved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )', schema_name);

  -- Create expense_categories table
  EXECUTE format('
    CREATE TABLE %I.expense_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      color VARCHAR(7),
      icon VARCHAR(50),
      parent_id UUID REFERENCES %I.expense_categories(id),
      is_active BOOLEAN DEFAULT true,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )', schema_name, schema_name);

  -- Create income table
  EXECUTE format('
    CREATE TABLE %I.income (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      income_date DATE NOT NULL,
      source VARCHAR(100) NOT NULL,
      booking_id UUID REFERENCES %I.bookings(id),
      description TEXT,
      amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(3) DEFAULT ''PHP'',
      payment_method VARCHAR(50),
      reference_number VARCHAR(100),
      tags TEXT[],
      metadata JSONB DEFAULT ''{}'',
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )', schema_name, schema_name);

  -- Create booking_timeline table
  EXECUTE format('
    CREATE TABLE %I.booking_timeline (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID REFERENCES %I.bookings(id) ON DELETE CASCADE,
      event_type VARCHAR(100) NOT NULL,
      event_data JSONB DEFAULT ''{}'',
      notes TEXT,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    )', schema_name, schema_name);

  -- Create project_settings table
  EXECUTE format('
    CREATE TABLE %I.project_settings (
      key VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL,
      category VARCHAR(50),
      description TEXT,
      updated_by UUID REFERENCES users(id),
      updated_at TIMESTAMP DEFAULT NOW()
    )', schema_name);

  -- Insert default expense categories
  EXECUTE format('
    INSERT INTO %I.expense_categories (name, description, color, icon, sort_order) VALUES
    (''Utilities'', ''Electricity, water, internet'', ''#3B82F6'', ''zap'', 1),
    (''Supplies'', ''Cleaning, toiletries, consumables'', ''#10B981'', ''package'', 2),
    (''Maintenance'', ''Repairs and maintenance'', ''#F59E0B'', ''wrench'', 3),
    (''Marketing'', ''Advertising and promotions'', ''#8B5CF6'', ''megaphone'', 4),
    (''Staff'', ''Wages and benefits'', ''#EF4444'', ''users'', 5),
    (''Food & Beverage'', ''F&B supplies and services'', ''#EC4899'', ''coffee'', 6),
    (''Other'', ''Miscellaneous expenses'', ''#6B7280'', ''more-horizontal'', 99)
  ', schema_name);

END;
$$ LANGUAGE plpgsql;
```

### Drizzle ORM Schema

```typescript
// lib/db/schema/global.ts
import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  jsonb,
  integer,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    profileImageUrl: varchar("profile_image_url", { length: 500 }),
    isActive: boolean("is_active").default(true),
    emailVerifiedAt: timestamp("email_verified_at"),
    lastLogin: timestamp("last_login"),
    tokenVersion: integer("token_version").default(1),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    emailIdx: index("idx_users_email")
      .on(table.email)
      .where(sql`${table.isActive} = true`),
    lastLoginIdx: index("idx_users_last_login")
      .on(table.lastLogin)
      .where(sql`${table.isActive} = true`),
  })
);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  description: text("description"),
  businessType: varchar("business_type", { length: 100 }).notNull(),
  location: varchar("location", { length: 300 }),
  schemaName: varchar("schema_name", { length: 100 }).notNull().unique(),
  currency: varchar("currency", { length: 3 }).default("PHP"),
  timezone: varchar("timezone", { length: 50 }).default("Asia/Manila"),
  settings: jsonb("settings").default({}),
  features: jsonb("features").default({
    bookings: true,
    expenses: true,
    reports: true,
  }),
  isActive: boolean("is_active").default(true),
  isDemo: boolean("is_demo").default(false),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const userProjectPermissions = pgTable(
  "user_project_permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    role: varchar("role", { length: 50 }).notNull(),
    permissions: jsonb("permissions").default({}),
    isActive: boolean("is_active").default(true),
    grantedBy: uuid("granted_by").references(() => users.id),
    grantedAt: timestamp("granted_at").defaultNow(),
    expiresAt: timestamp("expires_at"),
    lastAccessed: timestamp("last_accessed"),
  },
  (table) => ({
    userProjectUnique: unique().on(table.userId, table.projectId),
    userProjectIdx: index("idx_upp_user_project")
      .on(table.userId, table.projectId)
      .where(sql`${table.isActive} = true`),
  })
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  permissions: many(userProjectPermissions),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  creator: one(users, {
    fields: [projects.createdBy],
    references: [users.id],
  }),
  permissions: many(userProjectPermissions),
}));
```

### Migration System

```typescript
// lib/db/migrate.ts
import { migrate } from "drizzle-orm/neon-http/migrator";
import { db } from "./connection";

export async function runMigrations() {
  console.log("Running migrations...");

  try {
    await migrate(db, {
      migrationsFolder: "./migrations",
    });

    console.log("Migrations completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

// Migration file example
// migrations/0001_initial_schema.sql
```

### Database Utilities

```typescript
// lib/db/utils.ts
import { db, rawSql } from "./connection";
import { projects } from "./schema/global";
import { eq } from "drizzle-orm";

export async function createProjectSchema(
  projectId: string,
  projectName: string
) {
  const schemaName = `project_${projectName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}`;

  // Create project record
  const [project] = await db
    .insert(projects)
    .values({
      id: projectId,
      name: projectName,
      slug: projectName.toLowerCase().replace(/\s+/g, "-"),
      schemaName,
      businessType: "resort",
    })
    .returning();

  // Create schema using raw SQL
  await rawSql`SELECT create_project_schema(${projectId}::uuid, ${schemaName})`;

  return project;
}

export async function getProjectDb(projectId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new Error("Project not found");
  }

  return {
    schema: project.schemaName,
    query: <T = any>(query: string, params: any[] = []) => {
      // Replace table references with schema prefix
      const prefixedQuery = query.replace(
        /FROM\s+(\w+)/gi,
        `FROM ${project.schemaName}.$1`
      );
      return rawSql(prefixedQuery, params) as Promise<T[]>;
    },
  };
}

export async function checkProjectAccess(
  userId: string,
  projectId: string,
  requiredRole?: string
): Promise<boolean> {
  const result = await rawSql`
    SELECT role, permissions
    FROM user_project_permissions
    WHERE user_id = ${userId}::uuid
      AND project_id = ${projectId}::uuid
      AND is_active = true
    LIMIT 1
  `;

  if (!result.length) return false;

  const { role } = result[0];

  if (!requiredRole) return true;

  const roleHierarchy = ["viewer", "staff", "manager", "owner"];
  const userRoleIndex = roleHierarchy.indexOf(role);
  const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);

  return userRoleIndex >= requiredRoleIndex;
}
```

## Type Definitions

### Database Types

```typescript
// src/types/database.ts
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  profileImageUrl?: string;
  isActive: boolean;
  emailVerifiedAt?: Date;
  lastLogin?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  businessType: string;
  location?: string;
  schemaName: string;
  currency: string;
  timezone: string;
  settings: Record<string, any>;
  features: {
    bookings: boolean;
    expenses: boolean;
    reports: boolean;
  };
  isActive: boolean;
  isDemo: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProjectPermission {
  id: string;
  userId: string;
  projectId: string;
  role: "owner" | "manager" | "staff" | "viewer";
  permissions: Record<string, boolean>;
  isActive: boolean;
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
  lastAccessed?: Date;
}
```

## Test Requirements

### Database Testing

````typescript
// tests/db/schema.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createProjectSchema, getProjectDb, checkProjectAccess } from '@/lib/db/utils'
import { db } from '@/lib/db/connection'
import { users, projects } from '@/lib/db/schema/global'

describe('Database Schema', () => {
  let testUserId: string
  let testProjectId: string

  beforeAll(async () => {
    // Create test user
    const [user] = await db.insert(users).values({
      email: 'test@example.com',
      passwordHash: 'hashed',
      firstName: 'Test',
      lastName: 'User',
    }).returning()

    testUserId = user.id
  })

  afterAll(async () => {
    // Cleanup
    await db.delete(users).where(eq(users.id, testUserId))
  })

  describe('Project Schema Creation', () => {
    it('creates project and schema', async () => {
      const project = await createProjectSchema(
        'test-project-id',
        'Test Project'
      )

      expect(project).toBeDefined()
      expect(project.schemaName).toMatch(/^project_test_project_/)

      testProjectId = project.id
    })

    it('creates all required tables', async () => {
      const projectDb = await getProjectDb(testProjectId)

      const tables = await projectDb.query<{ tablename: string }>(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = $1
      `, [projectDb.schema])

      const tableNames = tables.map(t => t.tablename)

      expect(tableNames).toContain('bookings')
      expect(tableNames).toContain('payments')
      expect(tableNames).toContain('expenses')
      expect(tableNames).toContain('expense_categories')
    })
  })

  describe('Access Control', () => {
    it('checks project access correctly', async () => {
      // Grant access
      await db.insert(userProjectPermissions).values({
        userId: testUserId,
        projectId: testProjectId,
        role: 'manager',
      })

      const hasAccess = await checkProjectAccess(
        testUserId,
        testProjectId,
        'staff'
      )

      expect(hasAccess).toBe(true)

      const hasOwnerAccess = await checkProjectAccess(
        testUserId,
        testProjectId,
        'owner'
      )

      expect(hasOwnerAccess).toBe(false)
    })
  })
})\n```

## Agent Validation Checklist

### postgres-serverless-architect Validation
- [ ] Multi-tenant schema properly isolated
- [ ] Connection pooling optimized for serverless
- [ ] Indexes strategically placed for performance
- [ ] Schema naming conventions consistent
- [ ] Proper foreign key relationships
- [ ] Generated columns for computed values
- [ ] JSONB used appropriately for flexibility
- [ ] Audit logging comprehensive

### security-compliance-auditor Validation
- [ ] Row-level security considerations
- [ ] Sensitive data properly protected
- [ ] Audit trails comprehensive
- [ ] Access control at database level
- [ ] SQL injection prevention
- [ ] Data encryption at rest configured
- [ ] Backup and recovery strategy defined
- [ ] GDPR compliance considerations

## Success Criteria
1. **Database Setup** - Neon PostgreSQL configured and connected
2. **Schema Design** - Multi-tenant architecture implemented
3. **Tables Created** - All global and project tables defined
4. **Indexes Optimized** - Performance indexes in place
5. **Migrations Working** - Version control for schema changes
6. **Type Safety** - Full TypeScript types for all tables
7. **Access Control** - Permission system functional
8. **Performance** - Query response < 50ms average

## Deliverables
- [ ] Neon PostgreSQL database configured
- [ ] Complete schema implementation
- [ ] Migration system setup
- [ ] Database utilities and helpers
- [ ] TypeScript types for all entities
- [ ] Connection pooling optimized
- [ ] Comprehensive database tests
- [ ] Performance benchmarks documented

## Completion Checklist
- [ ] Database connection established
- [ ] All tables created with proper structure
- [ ] Indexes optimized for common queries
- [ ] Migration system operational
- [ ] Project schema creation automated
- [ ] Access control functions working
- [ ] All tests passing
- [ ] Agent validations passed
- [ ] Documentation complete
- [ ] Ready for Sub-Phase 1.6

---

*Sub-Phase 1.5 establishes a robust, scalable database foundation with complete multi-tenant isolation and serverless optimization.*
````
