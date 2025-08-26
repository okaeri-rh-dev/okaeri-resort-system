-- =============================================
-- Migration: 003_auth_triggers.sql
-- Description: Database triggers for authentication system
-- Author: System
-- Date: 2025-01-26
-- =============================================

-- =============================================
-- TRIGGER FUNCTIONS
-- =============================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Login count increment function
CREATE OR REPLACE FUNCTION increment_login_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Only increment on successful login attempts (new sessions)
    UPDATE users 
    SET 
        login_count = login_count + 1,
        last_login_at = NOW(),
        failed_login_attempts = 0,  -- Reset failed attempts on successful login
        updated_at = NOW()
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Security audit logging function
CREATE OR REPLACE FUNCTION log_auth_security_event()
RETURNS TRIGGER AS $$
DECLARE
    event_type_val TEXT;
    success_val BOOLEAN;
    metadata_val JSONB;
    risk_score_val INTEGER;
BEGIN
    -- Determine event type based on table
    CASE TG_TABLE_NAME
        WHEN 'users' THEN
            IF TG_OP = 'INSERT' THEN
                event_type_val := 'register';
                success_val := TRUE;
                risk_score_val := 10;
                metadata_val := jsonb_build_object(
                    'user_id', NEW.id,
                    'email', NEW.email,
                    'registration_method', 'standard'
                );
            ELSIF TG_OP = 'UPDATE' THEN
                -- Check specific field changes
                IF OLD.password_hash != NEW.password_hash THEN
                    event_type_val := 'password_change';
                    success_val := TRUE;
                    risk_score_val := 25;
                ELSIF OLD.is_email_verified = FALSE AND NEW.is_email_verified = TRUE THEN
                    event_type_val := 'email_verification';
                    success_val := TRUE;
                    risk_score_val := 5;
                ELSIF OLD.two_factor_enabled != NEW.two_factor_enabled THEN
                    event_type_val := CASE WHEN NEW.two_factor_enabled THEN 'two_factor_enable' ELSE 'two_factor_disable' END;
                    success_val := TRUE;
                    risk_score_val := CASE WHEN NEW.two_factor_enabled THEN 5 ELSE 20 END;
                ELSIF OLD.locked_until IS NULL AND NEW.locked_until IS NOT NULL THEN
                    event_type_val := 'account_locked';
                    success_val := TRUE;
                    risk_score_val := 60;
                ELSIF OLD.locked_until IS NOT NULL AND NEW.locked_until IS NULL THEN
                    event_type_val := 'account_unlocked';
                    success_val := TRUE;
                    risk_score_val := 15;
                ELSE
                    RETURN NULL; -- Skip non-security related updates
                END IF;
                
                metadata_val := jsonb_build_object(
                    'user_id', NEW.id,
                    'email', NEW.email,
                    'changed_fields', jsonb_build_object(
                        'password_changed', OLD.password_hash != NEW.password_hash,
                        'email_verified', OLD.is_email_verified = FALSE AND NEW.is_email_verified = TRUE,
                        'two_factor_changed', OLD.two_factor_enabled != NEW.two_factor_enabled,
                        'account_locked', OLD.locked_until IS NULL AND NEW.locked_until IS NOT NULL,
                        'account_unlocked', OLD.locked_until IS NOT NULL AND NEW.locked_until IS NULL
                    )
                );
            END IF;
            
        WHEN 'sessions' THEN
            IF TG_OP = 'INSERT' THEN
                event_type_val := 'login';
                success_val := TRUE;
                risk_score_val := 5;
                metadata_val := jsonb_build_object(
                    'user_id', NEW.user_id,
                    'session_id', NEW.id,
                    'ip_address', NEW.ip_address::TEXT,
                    'device_info', NEW.device_info
                );
            ELSIF TG_OP = 'UPDATE' AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
                event_type_val := 'logout';
                success_val := TRUE;
                risk_score_val := 5;
                metadata_val := jsonb_build_object(
                    'user_id', NEW.user_id,
                    'session_id', NEW.id,
                    'revocation_reason', NEW.revocation_reason
                );
            END IF;
            
        WHEN 'password_reset_tokens' THEN
            IF TG_OP = 'INSERT' THEN
                event_type_val := 'password_reset';
                success_val := TRUE;
                risk_score_val := 15;
                metadata_val := jsonb_build_object(
                    'user_id', NEW.user_id,
                    'token_id', NEW.id,
                    'ip_address', NEW.ip_address::TEXT
                );
            END IF;
    END CASE;
    
    -- Only insert if we have a valid event
    IF event_type_val IS NOT NULL THEN
        INSERT INTO security_audit_logs (
            user_id,
            event_type,
            action,
            success,
            risk_score,
            ip_address,
            metadata,
            created_at
        ) VALUES (
            COALESCE(NEW.user_id, NEW.id),
            event_type_val,
            TG_OP,
            success_val,
            risk_score_val,
            NEW.ip_address,
            metadata_val,
            NOW()
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Failed login attempt tracking function
CREATE OR REPLACE FUNCTION track_failed_login()
RETURNS TRIGGER AS $$
BEGIN
    -- Only track failed attempts
    IF NEW.success = FALSE THEN
        -- Increment failed login attempts for the user if they exist
        UPDATE users 
        SET 
            failed_login_attempts = failed_login_attempts + 1,
            updated_at = NOW()
        WHERE email = NEW.email;
        
        -- Check if account should be locked (5 failed attempts in 15 minutes)
        IF (
            SELECT COUNT(*) 
            FROM login_attempts 
            WHERE email = NEW.email 
                AND success = FALSE 
                AND attempted_at > NOW() - INTERVAL '15 minutes'
        ) >= 5 THEN
            -- Lock the account for 30 minutes
            UPDATE users 
            SET 
                locked_until = NOW() + INTERVAL '30 minutes',
                updated_at = NOW()
            WHERE email = NEW.email;
            
            -- Log the account lock event
            INSERT INTO security_audit_logs (
                user_id,
                event_type,
                action,
                success,
                risk_score,
                threat_level,
                ip_address,
                metadata,
                created_at
            ) SELECT 
                u.id,
                'account_locked',
                'UPDATE',
                TRUE,
                80,
                'high',
                NEW.ip_address,
                jsonb_build_object(
                    'reason', 'multiple_failed_attempts',
                    'attempts_count', 5,
                    'time_window', '15 minutes',
                    'lock_duration', '30 minutes'
                ),
                NOW()
            FROM users u WHERE u.email = NEW.email;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Session cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark expired sessions as revoked
    UPDATE sessions 
    SET 
        revoked_at = NOW(),
        revocation_reason = 'expired'
    WHERE expires_at < NOW() 
        AND revoked_at IS NULL;
        
    -- End corresponding user sessions
    UPDATE user_sessions 
    SET ended_at = NOW()
    WHERE session_id IN (
        SELECT id FROM sessions 
        WHERE expires_at < NOW() AND revoked_at IS NOT NULL
    ) AND ended_at IS NULL;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Token cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS VOID AS $$
BEGIN
    -- Clean up expired password reset tokens
    DELETE FROM password_reset_tokens 
    WHERE expires_at < NOW() - INTERVAL '1 day';
    
    -- Clean up expired email verification tokens
    DELETE FROM email_verification_tokens 
    WHERE expires_at < NOW() - INTERVAL '1 day';
    
    -- Clean up old login attempts (keep for 30 days)
    DELETE FROM login_attempts 
    WHERE attempted_at < NOW() - INTERVAL '30 days';
    
    -- Log cleanup activity
    INSERT INTO security_audit_logs (
        event_type,
        action,
        success,
        risk_score,
        metadata,
        created_at
    ) VALUES (
        'data_cleanup',
        'DELETE',
        TRUE,
        1,
        jsonb_build_object(
            'cleanup_type', 'expired_tokens',
            'timestamp', NOW()
        ),
        NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Auto-unlock accounts function
CREATE OR REPLACE FUNCTION unlock_expired_locks()
RETURNS VOID AS $$
BEGIN
    UPDATE users 
    SET 
        locked_until = NULL,
        updated_at = NOW()
    WHERE locked_until IS NOT NULL 
        AND locked_until < NOW();
        
    -- Log unlock events
    INSERT INTO security_audit_logs (
        user_id,
        event_type,
        action,
        success,
        risk_score,
        metadata,
        created_at
    )
    SELECT 
        id,
        'account_unlocked',
        'UPDATE',
        TRUE,
        10,
        jsonb_build_object(
            'reason', 'lock_expired',
            'unlock_time', NOW()
        ),
        NOW()
    FROM users 
    WHERE locked_until IS NOT NULL 
        AND locked_until < NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGER ASSIGNMENTS
-- =============================================

-- Updated at triggers
CREATE TRIGGER users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Login tracking trigger
CREATE TRIGGER sessions_login_count 
    AFTER INSERT ON sessions 
    FOR EACH ROW EXECUTE FUNCTION increment_login_count();

-- Security audit triggers
CREATE TRIGGER users_security_audit 
    AFTER INSERT OR UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION log_auth_security_event();

CREATE TRIGGER sessions_security_audit 
    AFTER INSERT OR UPDATE ON sessions 
    FOR EACH ROW EXECUTE FUNCTION log_auth_security_event();

CREATE TRIGGER password_reset_security_audit 
    AFTER INSERT ON password_reset_tokens 
    FOR EACH ROW EXECUTE FUNCTION log_auth_security_event();

-- Failed login tracking trigger
CREATE TRIGGER login_attempts_tracking 
    AFTER INSERT ON login_attempts 
    FOR EACH ROW EXECUTE FUNCTION track_failed_login();

-- =============================================
-- SCHEDULED JOBS (Using pg_cron if available)
-- =============================================

-- Note: These require pg_cron extension to be installed
-- If not available, these should be run via cron jobs or scheduled tasks

-- Schedule session cleanup every 5 minutes
-- SELECT cron.schedule('cleanup-expired-sessions', '*/5 * * * *', 'SELECT cleanup_expired_sessions()');

-- Schedule token cleanup daily at 2 AM
-- SELECT cron.schedule('cleanup-expired-tokens', '0 2 * * *', 'SELECT cleanup_expired_tokens()');

-- Schedule account unlock check every minute
-- SELECT cron.schedule('unlock-expired-accounts', '* * * * *', 'SELECT unlock_expired_locks()');

-- =============================================
-- PARTITION MAINTENANCE
-- =============================================

-- Function to create next month's audit log partition
CREATE OR REPLACE FUNCTION create_next_audit_partition()
RETURNS VOID AS $$
DECLARE
    next_month DATE;
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
BEGIN
    next_month := DATE_TRUNC('month', NOW() + INTERVAL '1 month');
    partition_name := 'security_audit_logs_' || TO_CHAR(next_month, 'YYYY_MM');
    start_date := TO_CHAR(next_month, 'YYYY-MM-DD');
    end_date := TO_CHAR(next_month + INTERVAL '1 month', 'YYYY-MM-DD');
    
    EXECUTE FORMAT('CREATE TABLE IF NOT EXISTS %I PARTITION OF security_audit_logs 
                    FOR VALUES FROM (%L) TO (%L)', 
                   partition_name, start_date, end_date);
    
    -- Create indexes on the new partition
    EXECUTE FORMAT('CREATE INDEX IF NOT EXISTS %I ON %I(user_id) WHERE user_id IS NOT NULL', 
                   'idx_' || partition_name || '_user_id', partition_name);
    EXECUTE FORMAT('CREATE INDEX IF NOT EXISTS %I ON %I(event_type)', 
                   'idx_' || partition_name || '_event_type', partition_name);
    EXECUTE FORMAT('CREATE INDEX IF NOT EXISTS %I ON %I(created_at DESC)', 
                   'idx_' || partition_name || '_created_at', partition_name);
END;
$$ LANGUAGE plpgsql;

-- Schedule partition creation for first day of each month
-- SELECT cron.schedule('create-audit-partition', '0 0 1 * *', 'SELECT create_next_audit_partition()');

-- =============================================
-- SECURITY POLICIES (Row Level Security)
-- =============================================

-- Enable RLS on sensitive tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies for sessions (users can only access their own sessions)
CREATE POLICY sessions_user_policy ON sessions
    FOR ALL TO authenticated_users
    USING (user_id = current_user_id());

-- Policies for password reset tokens (users can only access their own tokens)
CREATE POLICY password_reset_user_policy ON password_reset_tokens
    FOR ALL TO authenticated_users
    USING (user_id = current_user_id());

-- Policies for email verification tokens (users can only access their own tokens)
CREATE POLICY email_verification_user_policy ON email_verification_tokens
    FOR ALL TO authenticated_users
    USING (user_id = current_user_id());

-- Policies for audit logs (users can only see their own logs, admins can see all)
CREATE POLICY audit_logs_user_policy ON security_audit_logs
    FOR SELECT TO authenticated_users
    USING (user_id = current_user_id() OR is_admin());

-- Note: current_user_id() and is_admin() functions need to be implemented
-- based on your authentication system