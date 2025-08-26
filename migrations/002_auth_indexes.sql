-- =============================================
-- Migration: 002_auth_indexes.sql
-- Description: Performance indexes for authentication tables
-- Author: System
-- Date: 2025-01-26
-- =============================================

-- =============================================
-- USERS TABLE INDEXES
-- =============================================

-- Core lookup indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_remember_token ON users(remember_token) WHERE remember_token IS NOT NULL;

-- Authentication indexes
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_locked ON users(locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_two_factor ON users(two_factor_enabled) WHERE two_factor_enabled = TRUE;

-- Verification status indexes
CREATE INDEX IF NOT EXISTS idx_users_email_unverified ON users(email) 
  WHERE is_email_verified = FALSE AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active, deleted_at) 
  WHERE is_active = TRUE;

-- Soft delete support
CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_users_auth_lookup ON users(email, password_hash, is_active) 
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- =============================================
-- SESSIONS TABLE INDEXES
-- =============================================

-- Primary lookup indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Activity and expiration indexes
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at) 
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity DESC) 
  WHERE revoked_at IS NULL;

-- Cleanup indexes
CREATE INDEX IF NOT EXISTS idx_sessions_revoked ON sessions(revoked_at) 
  WHERE revoked_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expires_at) 
  WHERE expires_at < NOW() AND revoked_at IS NULL;

-- Composite index for session validation
CREATE INDEX IF NOT EXISTS idx_sessions_validation ON sessions(user_id, token, expires_at) 
  WHERE revoked_at IS NULL;

-- =============================================
-- PASSWORD RESET TOKENS INDEXES
-- =============================================

-- Primary lookup indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens(user_id);

-- Expiration and usage indexes
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at) 
  WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_password_reset_unused ON password_reset_tokens(user_id, expires_at) 
  WHERE used_at IS NULL;

-- Cleanup index
CREATE INDEX IF NOT EXISTS idx_password_reset_cleanup ON password_reset_tokens(created_at) 
  WHERE used_at IS NOT NULL OR expires_at < NOW();

-- =============================================
-- EMAIL VERIFICATION TOKENS INDEXES
-- =============================================

-- Primary lookup indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verification_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_user_id ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_email ON email_verification_tokens(email);

-- Status indexes
CREATE INDEX IF NOT EXISTS idx_email_verification_pending ON email_verification_tokens(user_id, expires_at) 
  WHERE verified_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_verification_expired ON email_verification_tokens(expires_at) 
  WHERE verified_at IS NULL AND expires_at < NOW();

-- =============================================
-- USER SESSIONS INDEXES
-- =============================================

-- Primary relationships
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_project_id ON user_sessions(project_id) 
  WHERE project_id IS NOT NULL;

-- Activity tracking
CREATE INDEX IF NOT EXISTS idx_user_sessions_started ON user_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, started_at) 
  WHERE ended_at IS NULL;

-- Security monitoring
CREATE INDEX IF NOT EXISTS idx_user_sessions_suspicious ON user_sessions(user_id, risk_score) 
  WHERE suspicious_activity = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_sessions_high_risk ON user_sessions(risk_score DESC) 
  WHERE risk_score > 50;

-- =============================================
-- LOGIN ATTEMPTS INDEXES
-- =============================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts(attempted_at DESC);

-- Rate limiting composite index
CREATE INDEX IF NOT EXISTS idx_login_attempts_rate_limit ON login_attempts(email, ip_address, attempted_at DESC);

-- Security monitoring indexes
CREATE INDEX IF NOT EXISTS idx_login_attempts_failed ON login_attempts(email, attempted_at) 
  WHERE success = FALSE;
CREATE INDEX IF NOT EXISTS idx_login_attempts_blocked ON login_attempts(email, ip_address) 
  WHERE blocked = TRUE;
CREATE INDEX IF NOT EXISTS idx_login_attempts_high_risk ON login_attempts(risk_score DESC) 
  WHERE risk_score > 70;

-- Cleanup index for old attempts
CREATE INDEX IF NOT EXISTS idx_login_attempts_cleanup ON login_attempts(attempted_at) 
  WHERE attempted_at < NOW() - INTERVAL '30 days';

-- =============================================
-- SECURITY AUDIT LOGS INDEXES
-- =============================================

-- Primary lookup indexes (applied to parent table, inherited by partitions)
CREATE INDEX IF NOT EXISTS idx_security_audit_user_id ON security_audit_logs(user_id) 
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_security_audit_project_id ON security_audit_logs(project_id) 
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_security_audit_session_id ON security_audit_logs(session_id) 
  WHERE session_id IS NOT NULL;

-- Event tracking indexes
CREATE INDEX IF NOT EXISTS idx_security_audit_event_type ON security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_resource ON security_audit_logs(resource_type, resource_id) 
  WHERE resource_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_security_audit_created ON security_audit_logs(created_at DESC);

-- Security analysis indexes
CREATE INDEX IF NOT EXISTS idx_security_audit_failures ON security_audit_logs(event_type, created_at) 
  WHERE success = FALSE;
CREATE INDEX IF NOT EXISTS idx_security_audit_high_risk ON security_audit_logs(risk_score DESC, created_at DESC) 
  WHERE risk_score > 70;
CREATE INDEX IF NOT EXISTS idx_security_audit_critical ON security_audit_logs(threat_level, created_at DESC) 
  WHERE threat_level = 'critical';

-- Compliance and retention
CREATE INDEX IF NOT EXISTS idx_security_audit_retention ON security_audit_logs(retention_date);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_security_audit_user_activity ON security_audit_logs(user_id, event_type, created_at DESC) 
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_security_audit_project_activity ON security_audit_logs(project_id, event_type, created_at DESC) 
  WHERE project_id IS NOT NULL;

-- =============================================
-- PARTIAL INDEXES FOR PERFORMANCE
-- =============================================

-- Index for finding locked accounts that should be unlocked
CREATE INDEX IF NOT EXISTS idx_users_unlock_pending ON users(locked_until) 
  WHERE locked_until IS NOT NULL AND locked_until < NOW();

-- Index for finding expired sessions to clean up
CREATE INDEX IF NOT EXISTS idx_sessions_cleanup_pending ON sessions(expires_at) 
  WHERE expires_at < NOW() AND revoked_at IS NULL;

-- Index for finding expired tokens to clean up
CREATE INDEX IF NOT EXISTS idx_tokens_cleanup_pending ON password_reset_tokens(expires_at) 
  WHERE expires_at < NOW() AND used_at IS NULL;

-- =============================================
-- STATISTICS UPDATE
-- =============================================

-- Update table statistics for query planner optimization
ANALYZE users;
ANALYZE sessions;
ANALYZE password_reset_tokens;
ANALYZE email_verification_tokens;
ANALYZE user_sessions;
ANALYZE login_attempts;
ANALYZE security_audit_logs;