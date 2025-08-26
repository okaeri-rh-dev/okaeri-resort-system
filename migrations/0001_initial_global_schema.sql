-- Migration: 0001_initial_global_schema
-- Description: Initial global schema setup for Okaeri Resort Management System
-- Created: 2025-08-26
-- Author: Okaeri Development Team

-- Enable necessary PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types for better type safety
DO $$ BEGIN
    CREATE TYPE user_language AS ENUM ('en', 'fil');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE project_business_type AS ENUM ('resort', 'hotel', 'vacation_rental', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('owner', 'admin', 'manager', 'staff', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_category AS ENUM ('auth', 'booking', 'payment', 'expense', 'user', 'settings', 'system');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_severity AS ENUM ('info', 'warning', 'error', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Users table: Core authentication and user management
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
    login_attempts JSONB DEFAULT '[]'::jsonb,
    preferences JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_phone CHECK (phone IS NULL OR phone ~ '^\+?[1-9]\d{1,14}$')
);

-- Create indexes for users table
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(email_verification_token) WHERE email_verification_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(password_reset_token) WHERE password_reset_token IS NOT NULL;

-- Projects table: Multi-tenant business entities
CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    schema_name VARCHAR(63) NOT NULL UNIQUE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    business_type VARCHAR(50) NOT NULL DEFAULT 'resort',
    description TEXT,
    logo TEXT,
    cover_image TEXT,
    
    -- Business Information
    business_name VARCHAR(255),
    business_registration_number VARCHAR(100),
    tax_identification_number VARCHAR(100),
    
    -- Location
    address TEXT,
    city VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(10),
    country VARCHAR(2) DEFAULT 'PH' NOT NULL,
    coordinates JSONB,
    
    -- Contact Information
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    website TEXT,
    social_media JSONB DEFAULT '{}'::jsonb,
    
    -- Settings
    currency VARCHAR(3) DEFAULT 'PHP' NOT NULL,
    timezone VARCHAR(50) DEFAULT 'Asia/Manila' NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb,
    
    -- Status
    is_active BOOLEAN DEFAULT true NOT NULL,
    is_paid BOOLEAN DEFAULT false NOT NULL,
    trial_ends_at TIMESTAMP,
    suspended_at TIMESTAMP,
    suspension_reason TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    
    CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT valid_schema_name CHECK (schema_name ~ '^[a-z][a-z0-9_]*$'),
    CONSTRAINT valid_country CHECK (country ~ '^[A-Z]{2}$'),
    CONSTRAINT valid_currency CHECK (currency ~ '^[A-Z]{3}$')
);

-- Create indexes for projects table
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON projects(LOWER(slug));
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_schema_name ON projects(schema_name);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_business_type ON projects(business_type);
CREATE INDEX IF NOT EXISTS idx_projects_trial ON projects(trial_ends_at) WHERE trial_ends_at IS NOT NULL;

-- User project permissions table: RBAC for multi-tenancy
CREATE TABLE IF NOT EXISTS user_project_permissions (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    permissions JSONB DEFAULT '{}'::jsonb,
    
    -- Invitation tracking
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    invited_at TIMESTAMP,
    accepted_at TIMESTAMP,
    invitation_token TEXT,
    invitation_expiry TIMESTAMP,
    
    -- Status
    is_active BOOLEAN DEFAULT true NOT NULL,
    last_accessed_at TIMESTAMP,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    
    PRIMARY KEY (user_id, project_id),
    CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'manager', 'staff', 'viewer'))
);

-- Create indexes for user_project_permissions table
CREATE INDEX IF NOT EXISTS idx_user_project_permissions_user ON user_project_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_project_permissions_project ON user_project_permissions(project_id);
CREATE INDEX IF NOT EXISTS idx_user_project_permissions_role ON user_project_permissions(role);
CREATE INDEX IF NOT EXISTS idx_user_project_permissions_invitation ON user_project_permissions(invitation_token) WHERE invitation_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_project_permissions_active ON user_project_permissions(is_active, project_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_project_permissions_last_access ON user_project_permissions(last_accessed_at DESC);

-- Audit logs table: System-wide security and compliance tracking
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    
    -- Request details
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_method VARCHAR(10),
    request_path TEXT,
    request_id UUID,
    
    -- Change tracking
    entity_type VARCHAR(50),
    entity_id UUID,
    old_values JSONB DEFAULT '{}'::jsonb,
    new_values JSONB DEFAULT '{}'::jsonb,
    
    -- Result
    success BOOLEAN NOT NULL,
    error_message TEXT,
    error_stack TEXT,
    
    -- Additional context
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    
    CONSTRAINT valid_category CHECK (category IN ('auth', 'booking', 'payment', 'expense', 'user', 'settings', 'system')),
    CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    CONSTRAINT valid_ip CHECK (ip_address IS NULL OR ip_address ~ '^([0-9]{1,3}\.){3}[0-9]{1,3}$' OR ip_address ~ '^([0-9a-f]{0,4}:){7}[0-9a-f]{0,4}$')
);

-- Create indexes for audit_logs table
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_project ON audit_logs(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id) WHERE entity_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success, created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables with updated_at column
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_project_permissions_updated_at
    BEFORE UPDATE ON user_project_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function for safe schema creation
CREATE OR REPLACE FUNCTION create_project_schema(p_schema_name VARCHAR)
RETURNS VOID AS $$
BEGIN
    -- Validate schema name
    IF p_schema_name !~ '^[a-z][a-z0-9_]*$' THEN
        RAISE EXCEPTION 'Invalid schema name: %', p_schema_name;
    END IF;
    
    -- Check if schema already exists
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = p_schema_name) THEN
        EXECUTE format('CREATE SCHEMA %I', p_schema_name);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for safe schema deletion
CREATE OR REPLACE FUNCTION drop_project_schema(p_schema_name VARCHAR)
RETURNS VOID AS $$
BEGIN
    -- Validate schema name
    IF p_schema_name !~ '^[a-z][a-z0-9_]*$' THEN
        RAISE EXCEPTION 'Invalid schema name: %', p_schema_name;
    END IF;
    
    -- Check if schema exists
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = p_schema_name) THEN
        EXECUTE format('DROP SCHEMA %I CASCADE', p_schema_name);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions (adjust based on your database user)
-- GRANT USAGE ON SCHEMA public TO your_app_user;
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_app_user;

-- Add comments for documentation
COMMENT ON TABLE users IS 'Global users table for authentication and user management across all projects';
COMMENT ON TABLE projects IS 'Multi-tenant projects representing individual resort businesses';
COMMENT ON TABLE user_project_permissions IS 'Role-based access control for users within projects';
COMMENT ON TABLE audit_logs IS 'System-wide audit trail for security and compliance tracking';

COMMENT ON COLUMN users.preferences IS 'User preferences including language, timezone, and notification settings';
COMMENT ON COLUMN projects.settings IS 'Project-specific settings including booking rules, payment methods, and notifications';
COMMENT ON COLUMN user_project_permissions.permissions IS 'Granular permissions for specific actions within the project';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional contextual information for the audit event';