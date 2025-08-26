-- =============================================
-- Migration: 001_auth_tables.sql
-- Description: Enhanced authentication tables for Okaeri Resort Management System
-- Author: System
-- Date: 2025-01-26
-- =============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- ENHANCED USERS TABLE
-- =============================================

-- Drop existing constraints if they exist (for migration safety)
ALTER TABLE IF EXISTS users 
  DROP CONSTRAINT IF EXISTS users_email_key,
  DROP CONSTRAINT IF EXISTS users_phone_check;

-- Add new authentication columns to users table
ALTER TABLE users 
  -- Verification timestamps
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
  
  -- Authentication tracking
  ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  
  -- Two-factor authentication
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
  
  -- Session management
  ADD COLUMN IF NOT EXISTS remember_token TEXT,
  
  -- Philippine localization
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Manila' NOT NULL,
  ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'en-PH' NOT NULL,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'PHP' NOT NULL,
  
  -- Soft delete support
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add check constraints for users table
ALTER TABLE users
  ADD CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  ADD CONSTRAINT users_phone_format CHECK (phone IS NULL OR phone ~ '^\+[1-9]\d{1,14}$'),
  ADD CONSTRAINT users_currency_check CHECK (currency IN ('PHP', 'USD', 'EUR')),
  ADD CONSTRAINT users_locale_check CHECK (locale IN ('en-PH', 'fil-PH', 'en-US')),
  ADD CONSTRAINT users_failed_login_check CHECK (failed_login_attempts >= 0),
  ADD CONSTRAINT users_login_count_check CHECK (login_count >= 0);

-- =============================================
-- SESSIONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  
  -- Session details
  ip_address INET,
  user_agent TEXT,
  
  -- Activity tracking
  last_activity TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Revocation
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  
  -- Device information
  device_info JSONB DEFAULT '{}' NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT sessions_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT sessions_token_length CHECK (LENGTH(token) >= 32)
);

-- =============================================
-- PASSWORD RESET TOKENS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  
  -- Token lifecycle
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  
  -- Request details
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT password_reset_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT password_reset_token_length CHECK (LENGTH(token) >= 32),
  CONSTRAINT password_reset_used_check CHECK (used_at IS NULL OR used_at >= created_at)
);

-- =============================================
-- EMAIL VERIFICATION TOKENS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  token TEXT NOT NULL UNIQUE,
  
  -- Token lifecycle
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  
  -- Request details
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT email_verification_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT email_verification_token_length CHECK (LENGTH(token) >= 32),
  CONSTRAINT email_verification_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT email_verification_verified_check CHECK (verified_at IS NULL OR verified_at >= created_at)
);

-- =============================================
-- USER SESSIONS TABLE (Activity Tracking)
-- =============================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  
  -- Session metadata
  login_method VARCHAR(50), -- password, oauth, sso, magic_link
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  
  -- Activity tracking
  pages_viewed INTEGER DEFAULT 0 NOT NULL,
  actions_performed INTEGER DEFAULT 0 NOT NULL,
  last_page_visited TEXT,
  
  -- Security
  suspicious_activity BOOLEAN DEFAULT FALSE NOT NULL,
  risk_score INTEGER DEFAULT 0 NOT NULL,
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ended_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT user_sessions_pages_check CHECK (pages_viewed >= 0),
  CONSTRAINT user_sessions_actions_check CHECK (actions_performed >= 0),
  CONSTRAINT user_sessions_risk_check CHECK (risk_score >= 0 AND risk_score <= 100),
  CONSTRAINT user_sessions_ended_check CHECK (ended_at IS NULL OR ended_at >= started_at),
  CONSTRAINT user_sessions_login_method_check CHECK (
    login_method IN ('password', 'oauth', 'sso', 'magic_link', 'two_factor')
  )
);

-- =============================================
-- LOGIN ATTEMPTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  
  -- Attempt details
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  
  -- Failure tracking
  failure_reason VARCHAR(100),
  error_code VARCHAR(50),
  
  -- Security scoring
  risk_score INTEGER DEFAULT 0 NOT NULL,
  blocked BOOLEAN DEFAULT FALSE NOT NULL,
  
  -- Geographic info
  geo_location JSONB DEFAULT '{}' NOT NULL,
  
  -- Timestamp
  attempted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT login_attempts_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT login_attempts_risk_check CHECK (risk_score >= 0 AND risk_score <= 100),
  CONSTRAINT login_attempts_failure_reason_check CHECK (
    (success = TRUE AND failure_reason IS NULL) OR 
    (success = FALSE)
  )
);

-- =============================================
-- SECURITY AUDIT LOGS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS security_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  
  -- Event classification
  event_type VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id TEXT,
  action VARCHAR(100) NOT NULL,
  
  -- Security context
  ip_address INET,
  user_agent TEXT,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  
  -- Risk assessment
  risk_score INTEGER DEFAULT 0 NOT NULL,
  threat_level VARCHAR(20), -- low, medium, high, critical
  
  -- Result
  success BOOLEAN NOT NULL,
  error_message TEXT,
  
  -- Additional context
  metadata JSONB DEFAULT '{}' NOT NULL,
  
  -- Compliance (5 years retention for Philippine requirements)
  retention_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 years') NOT NULL,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT security_audit_logs_risk_check CHECK (risk_score >= 0 AND risk_score <= 100),
  CONSTRAINT security_audit_logs_threat_check CHECK (
    threat_level IS NULL OR threat_level IN ('low', 'medium', 'high', 'critical')
  ),
  CONSTRAINT security_audit_logs_event_type_check CHECK (
    event_type IN (
      'login', 'logout', 'register', 'password_reset', 'password_change',
      'email_verification', 'two_factor_enable', 'two_factor_disable',
      'account_locked', 'account_unlocked', 'permission_granted', 'permission_revoked',
      'data_access', 'data_modification', 'data_deletion', 'configuration_change',
      'suspicious_activity', 'security_breach'
    )
  )
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for audit logs (for better performance)
-- Creating partitions for the next 12 months
CREATE TABLE IF NOT EXISTS security_audit_logs_2025_01 PARTITION OF security_audit_logs
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS security_audit_logs_2025_02 PARTITION OF security_audit_logs
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE IF NOT EXISTS security_audit_logs_2025_03 PARTITION OF security_audit_logs
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- Add comment documentation
COMMENT ON TABLE users IS 'Core user authentication table with Philippine business context support';
COMMENT ON TABLE sessions IS 'Active user sessions for stateless authentication';
COMMENT ON TABLE password_reset_tokens IS 'Secure password reset tokens with expiration';
COMMENT ON TABLE email_verification_tokens IS 'Email verification tokens for account activation';
COMMENT ON TABLE user_sessions IS 'Detailed session activity tracking for security monitoring';
COMMENT ON TABLE login_attempts IS 'Login attempt tracking for rate limiting and security analysis';
COMMENT ON TABLE security_audit_logs IS 'Comprehensive security audit trail with 5-year retention for compliance';

COMMENT ON COLUMN users.timezone IS 'User timezone, defaults to Asia/Manila for Philippine users';
COMMENT ON COLUMN users.currency IS 'User preferred currency, defaults to PHP';
COMMENT ON COLUMN users.phone IS 'Phone number in E.164 format, typically +63 for Philippines';
COMMENT ON COLUMN users.two_factor_secret IS 'Encrypted TOTP secret for 2FA authentication';
COMMENT ON COLUMN security_audit_logs.retention_date IS 'Automatic deletion date for compliance (5 years for Philippine BIR requirements)';