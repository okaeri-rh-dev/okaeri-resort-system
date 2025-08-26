#!/usr/bin/env node
import * as dotenv from "dotenv";
import { sql } from "../src/lib/db/connection";

// Load environment variables
dotenv.config();

async function initDatabase() {
  console.log("🚀 Initializing Okaeri Resort Management Database...");

  try {
    // Test connection
    console.log("Testing database connection...");
    const result = await sql`SELECT version()`;
    console.log("✅ Connected to PostgreSQL:", result[0].version);

    // Create global tables
    console.log("\nCreating global tables...");

    // Users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        avatar_url TEXT,
        is_active BOOLEAN DEFAULT true NOT NULL,
        is_email_verified BOOLEAN DEFAULT false NOT NULL,
        email_verification_token TEXT,
        email_verification_expiry TIMESTAMP,
        password_reset_token TEXT,
        password_reset_expiry TIMESTAMP,
        last_login_at TIMESTAMP,
        login_attempts JSONB DEFAULT '[]',
        preferences JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    console.log("  ✅ Users table created");

    // Create indexes for users
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email)`;
    await sql`CREATE INDEX IF NOT EXISTS users_phone_idx ON users(phone)`;
    await sql`CREATE INDEX IF NOT EXISTS users_last_login_idx ON users(last_login_at)`;
    await sql`CREATE INDEX IF NOT EXISTS users_created_at_idx ON users(created_at)`;

    // Projects table
    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        schema_name VARCHAR(63) NOT NULL UNIQUE,
        owner_id UUID NOT NULL REFERENCES users(id),
        business_type VARCHAR(50) NOT NULL DEFAULT 'resort',
        description TEXT,
        logo TEXT,
        cover_image TEXT,
        business_name VARCHAR(255),
        business_registration_number VARCHAR(100),
        tax_identification_number VARCHAR(100),
        address TEXT,
        city VARCHAR(100),
        province VARCHAR(100),
        postal_code VARCHAR(10),
        country VARCHAR(2) DEFAULT 'PH' NOT NULL,
        coordinates JSONB,
        contact_email VARCHAR(255),
        contact_phone VARCHAR(20),
        website TEXT,
        social_media JSONB DEFAULT '{}',
        currency VARCHAR(3) DEFAULT 'PHP' NOT NULL,
        timezone VARCHAR(50) DEFAULT 'Asia/Manila' NOT NULL,
        settings JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true NOT NULL,
        is_paid BOOLEAN DEFAULT false NOT NULL,
        trial_ends_at TIMESTAMP,
        suspended_at TIMESTAMP,
        suspension_reason TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    console.log("  ✅ Projects table created");

    // Create indexes for projects
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS projects_slug_idx ON projects(slug)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS projects_schema_name_idx ON projects(schema_name)`;
    await sql`CREATE INDEX IF NOT EXISTS projects_owner_idx ON projects(owner_id)`;
    await sql`CREATE INDEX IF NOT EXISTS projects_is_active_idx ON projects(is_active)`;
    await sql`CREATE INDEX IF NOT EXISTS projects_created_at_idx ON projects(created_at)`;

    // User project permissions table
    await sql`
      CREATE TABLE IF NOT EXISTS user_project_permissions (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        permissions JSONB DEFAULT '{}',
        invited_by UUID REFERENCES users(id),
        invited_at TIMESTAMP,
        accepted_at TIMESTAMP,
        invitation_token TEXT,
        invitation_expiry TIMESTAMP,
        is_active BOOLEAN DEFAULT true NOT NULL,
        last_accessed_at TIMESTAMP,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        PRIMARY KEY (user_id, project_id)
      )
    `;
    console.log("  ✅ User project permissions table created");

    // Create indexes for user_project_permissions
    await sql`CREATE INDEX IF NOT EXISTS user_project_permissions_user_idx ON user_project_permissions(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS user_project_permissions_project_idx ON user_project_permissions(project_id)`;
    await sql`CREATE INDEX IF NOT EXISTS user_project_permissions_role_idx ON user_project_permissions(role)`;
    await sql`CREATE INDEX IF NOT EXISTS user_project_permissions_invitation_token_idx ON user_project_permissions(invitation_token)`;

    // Audit logs table
    await sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES users(id),
        project_id UUID REFERENCES projects(id),
        action VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        request_method VARCHAR(10),
        request_path TEXT,
        request_id UUID,
        entity_type VARCHAR(50),
        entity_id UUID,
        old_values JSONB DEFAULT '{}',
        new_values JSONB DEFAULT '{}',
        success BOOLEAN NOT NULL,
        error_message TEXT,
        error_stack TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    console.log("  ✅ Audit logs table created");

    // Create indexes for audit_logs
    await sql`CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON audit_logs(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS audit_logs_project_idx ON audit_logs(project_id)`;
    await sql`CREATE INDEX IF NOT EXISTS audit_logs_category_idx ON audit_logs(category)`;
    await sql`CREATE INDEX IF NOT EXISTS audit_logs_severity_idx ON audit_logs(severity)`;
    await sql`CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id)`;
    await sql`CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at)`;
    await sql`CREATE INDEX IF NOT EXISTS audit_logs_request_id_idx ON audit_logs(request_id)`;

    // Create updated_at trigger function
    await sql`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `;
    console.log("  ✅ Updated_at trigger function created");

    // Apply updated_at trigger to tables
    const tables = ["users", "projects", "user_project_permissions"];
    for (const table of tables) {
      await sql`
        DROP TRIGGER IF EXISTS update_${sql(table)}_updated_at ON ${sql(table)}
      `;
      await sql`
        CREATE TRIGGER update_${sql(table)}_updated_at
        BEFORE UPDATE ON ${sql(table)}
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
      `;
    }
    console.log("  ✅ Updated_at triggers applied");

    console.log("\n✨ Database initialization complete!");
    console.log("\nNext steps:");
    console.log("1. Create a .env file with your DATABASE_URL");
    console.log('2. Run "npm run db:push" to sync schema with database');
    console.log('3. Run "npm run db:studio" to open Drizzle Studio for data management');

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Database initialization failed:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase();
}

export { initDatabase };
