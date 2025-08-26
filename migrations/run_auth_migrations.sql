-- =============================================
-- Migration Runner: run_auth_migrations.sql
-- Description: Execute all authentication migrations in correct order
-- Author: System
-- Date: 2025-01-26
-- =============================================

-- Begin transaction to ensure atomicity
BEGIN;

-- Set timezone for consistent timestamps
SET timezone = 'Asia/Manila';

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- STEP 1: Create/Update Authentication Tables
-- =============================================

\echo 'Running authentication tables migration...'
\i 001_auth_tables.sql

-- =============================================
-- STEP 2: Create Performance Indexes
-- =============================================

\echo 'Creating performance indexes...'
\i 002_auth_indexes.sql

-- =============================================
-- STEP 3: Create Triggers and Functions
-- =============================================

\echo 'Creating triggers and security functions...'
\i 003_auth_triggers.sql

-- =============================================
-- STEP 4: Create Migration Log Table
-- =============================================

CREATE TABLE IF NOT EXISTS migration_log (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    description TEXT,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    execution_time_ms INTEGER,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    checksum VARCHAR(64)
);

-- =============================================
-- STEP 5: Log Migration Execution
-- =============================================

INSERT INTO migration_log (
    migration_name,
    version,
    description,
    executed_at,
    execution_time_ms,
    success
) VALUES 
('001_auth_tables', '1.6.0', 'Enhanced authentication tables with Philippine business context', NOW(), 0, TRUE),
('002_auth_indexes', '1.6.0', 'Performance indexes for authentication tables', NOW(), 0, TRUE),
('003_auth_triggers', '1.6.0', 'Security triggers and audit functions', NOW(), 0, TRUE);

-- =============================================
-- STEP 6: Create Security Views
-- =============================================

-- View for user security status
CREATE OR REPLACE VIEW v_user_security_status AS
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.is_active,
    u.is_email_verified,
    u.email_verified_at,
    u.phone_verified_at,
    u.two_factor_enabled,
    u.locked_until,
    u.failed_login_attempts,
    u.last_login_at,
    u.login_count,
    CASE 
        WHEN u.locked_until IS NOT NULL AND u.locked_until > NOW() THEN 'locked'
        WHEN u.is_email_verified = FALSE THEN 'unverified'
        WHEN u.two_factor_enabled = TRUE THEN 'secured'
        ELSE 'standard'
    END AS security_status,
    -- Recent login attempts
    (SELECT COUNT(*) FROM login_attempts la 
     WHERE la.email = u.email 
       AND la.attempted_at > NOW() - INTERVAL '24 hours'
       AND la.success = FALSE) AS failed_attempts_24h,
    -- Active sessions count
    (SELECT COUNT(*) FROM sessions s 
     WHERE s.user_id = u.id 
       AND s.expires_at > NOW() 
       AND s.revoked_at IS NULL) AS active_sessions,
    u.created_at,
    u.updated_at
FROM users u
WHERE u.deleted_at IS NULL;

-- View for session monitoring
CREATE OR REPLACE VIEW v_session_monitoring AS
SELECT 
    s.id,
    s.user_id,
    u.email,
    u.first_name,
    u.last_name,
    s.ip_address,
    s.user_agent,
    s.last_activity,
    s.expires_at,
    s.revoked_at,
    s.device_info,
    us.login_method,
    us.project_id,
    p.name as project_name,
    us.pages_viewed,
    us.actions_performed,
    us.risk_score,
    us.suspicious_activity,
    EXTRACT(EPOCH FROM (NOW() - s.last_activity))/60 AS minutes_inactive,
    CASE 
        WHEN s.revoked_at IS NOT NULL THEN 'revoked'
        WHEN s.expires_at < NOW() THEN 'expired'
        WHEN EXTRACT(EPOCH FROM (NOW() - s.last_activity))/60 > 30 THEN 'inactive'
        ELSE 'active'
    END AS session_status,
    s.created_at
FROM sessions s
JOIN users u ON s.user_id = u.id
LEFT JOIN user_sessions us ON s.id = us.session_id
LEFT JOIN projects p ON us.project_id = p.id
ORDER BY s.last_activity DESC;

-- View for security analytics
CREATE OR REPLACE VIEW v_security_analytics AS
SELECT 
    DATE(created_at) as date,
    event_type,
    COUNT(*) as event_count,
    COUNT(*) FILTER (WHERE success = TRUE) as successful_events,
    COUNT(*) FILTER (WHERE success = FALSE) as failed_events,
    AVG(risk_score) as avg_risk_score,
    COUNT(*) FILTER (WHERE threat_level = 'critical') as critical_threats,
    COUNT(*) FILTER (WHERE threat_level = 'high') as high_threats,
    COUNT(DISTINCT user_id) as affected_users,
    COUNT(DISTINCT ip_address) as unique_ips
FROM security_audit_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), event_type
ORDER BY date DESC, event_count DESC;

-- View for login attempt analysis
CREATE OR REPLACE VIEW v_login_analysis AS
SELECT 
    DATE(attempted_at) as date,
    email,
    ip_address,
    COUNT(*) as total_attempts,
    COUNT(*) FILTER (WHERE success = TRUE) as successful_attempts,
    COUNT(*) FILTER (WHERE success = FALSE) as failed_attempts,
    MAX(CASE WHEN success = TRUE THEN attempted_at END) as last_success,
    MAX(CASE WHEN success = FALSE THEN attempted_at END) as last_failure,
    AVG(risk_score) as avg_risk_score,
    bool_or(blocked) as was_blocked
FROM login_attempts
WHERE attempted_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(attempted_at), email, ip_address
ORDER BY date DESC, total_attempts DESC;

-- =============================================
-- STEP 7: Create Helper Functions
-- =============================================

-- Function to check if user has valid session
CREATE OR REPLACE FUNCTION has_valid_session(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS(
        SELECT 1 FROM sessions 
        WHERE user_id = user_uuid 
          AND expires_at > NOW() 
          AND revoked_at IS NULL
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get user's security score
CREATE OR REPLACE FUNCTION get_user_security_score(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 50; -- Base score
    user_record RECORD;
BEGIN
    SELECT * INTO user_record FROM users WHERE id = user_uuid;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Email verified (+20)
    IF user_record.is_email_verified THEN
        score := score + 20;
    END IF;
    
    -- Phone verified (+15)
    IF user_record.phone_verified_at IS NOT NULL THEN
        score := score + 15;
    END IF;
    
    -- Two-factor enabled (+25)
    IF user_record.two_factor_enabled THEN
        score := score + 25;
    END IF;
    
    -- Recent login activity (+10)
    IF user_record.last_login_at > NOW() - INTERVAL '7 days' THEN
        score := score + 10;
    END IF;
    
    -- Account locked (-50)
    IF user_record.locked_until IS NOT NULL AND user_record.locked_until > NOW() THEN
        score := score - 50;
    END IF;
    
    -- Recent failed attempts penalty
    score := score - (user_record.failed_login_attempts * 5);
    
    -- Ensure score is between 0 and 100
    RETURN GREATEST(0, LEAST(100, score));
END;
$$ LANGUAGE plpgsql;

-- Function to generate secure token
CREATE OR REPLACE FUNCTION generate_secure_token(length INTEGER DEFAULT 32)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(length), 'hex');
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- STEP 8: Create Scheduled Job Functions
-- =============================================

-- Function for daily maintenance
CREATE OR REPLACE FUNCTION daily_auth_maintenance()
RETURNS TEXT AS $$
DECLARE
    result TEXT := '';
    deleted_sessions INTEGER := 0;
    deleted_tokens INTEGER := 0;
    unlocked_users INTEGER := 0;
BEGIN
    -- Clean up expired sessions
    WITH deleted_sess AS (
        DELETE FROM sessions 
        WHERE expires_at < NOW() - INTERVAL '1 day'
          AND revoked_at IS NULL
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_sessions FROM deleted_sess;
    
    -- Clean up expired password reset tokens
    WITH deleted_pwd AS (
        DELETE FROM password_reset_tokens 
        WHERE expires_at < NOW() - INTERVAL '1 day'
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_tokens FROM deleted_pwd;
    
    -- Clean up expired email verification tokens
    WITH deleted_email AS (
        DELETE FROM email_verification_tokens 
        WHERE expires_at < NOW() - INTERVAL '1 day'
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_tokens FROM deleted_email;
    
    -- Unlock expired account locks
    WITH unlocked AS (
        UPDATE users 
        SET locked_until = NULL, updated_at = NOW()
        WHERE locked_until IS NOT NULL AND locked_until < NOW()
        RETURNING id
    )
    SELECT COUNT(*) INTO unlocked_users FROM unlocked;
    
    result := format('Daily maintenance completed: %s expired sessions cleaned, %s expired tokens cleaned, %s accounts unlocked',
                     deleted_sessions, deleted_tokens, unlocked_users);
    
    -- Log maintenance activity
    INSERT INTO security_audit_logs (
        event_type, action, success, risk_score, metadata, created_at
    ) VALUES (
        'maintenance', 'SYSTEM', TRUE, 1,
        jsonb_build_object(
            'expired_sessions_deleted', deleted_sessions,
            'expired_tokens_deleted', deleted_tokens,
            'accounts_unlocked', unlocked_users
        ),
        NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- STEP 9: Grant Permissions
-- =============================================

-- Grant necessary permissions (adjust role names as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- =============================================
-- FINAL VALIDATION
-- =============================================

\echo 'Validating migration results...'

-- Check table existence
DO $$
DECLARE
    tables TEXT[] := ARRAY[
        'users', 'sessions', 'password_reset_tokens', 
        'email_verification_tokens', 'user_sessions', 
        'login_attempts', 'security_audit_logs'
    ];
    table_name TEXT;
    table_count INTEGER;
BEGIN
    FOREACH table_name IN ARRAY tables LOOP
        SELECT COUNT(*) INTO table_count 
        FROM information_schema.tables 
        WHERE table_name = table_name AND table_schema = 'public';
        
        IF table_count = 0 THEN
            RAISE EXCEPTION 'Table % was not created successfully', table_name;
        END IF;
        
        RAISE NOTICE 'Table % exists: OK', table_name;
    END LOOP;
    
    RAISE NOTICE 'All authentication tables created successfully!';
END $$;

-- Check indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'sessions', 'password_reset_tokens', 'email_verification_tokens', 'user_sessions', 'login_attempts', 'security_audit_logs')
ORDER BY tablename, indexname;

-- Commit transaction
COMMIT;

\echo 'Authentication system migration completed successfully!'
\echo ''
\echo 'Summary:'
\echo '- Enhanced users table with Philippine business context'
\echo '- Created comprehensive session management system'
\echo '- Implemented secure token management'
\echo '- Added detailed audit logging with 5-year retention'
\echo '- Created performance indexes for all tables'
\echo '- Implemented security triggers and functions'
\echo '- Added monitoring views and helper functions'
\echo '- Ready for Phase 1.6 authentication system implementation'