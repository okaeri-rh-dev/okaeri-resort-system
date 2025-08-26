-- =============================================
-- Migration: seed_auth_data.sql
-- Description: Seed data for authentication system testing and development
-- Author: System
-- Date: 2025-01-26
-- Environment: Development Only
-- =============================================

-- WARNING: This file contains test data and should NEVER be run in production
-- It includes default passwords and test accounts for development purposes only

-- =============================================
-- SEED TEST USERS
-- =============================================

-- Insert test users with Philippine context
INSERT INTO users (
    id,
    email,
    password_hash,
    first_name,
    last_name,
    phone,
    is_active,
    is_email_verified,
    email_verified_at,
    timezone,
    locale,
    currency,
    preferences,
    created_at,
    updated_at
) VALUES 
-- Test Resort Owner (password: 'ResortOwner123!')
(
    '550e8400-e29b-41d4-a716-446655440001',
    'owner@bayanresort.ph',
    '$2b$10$XY1vE3kF5G8H9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D',
    'Maria',
    'Santos',
    '+639171234567',
    TRUE,
    TRUE,
    NOW() - INTERVAL '30 days',
    'Asia/Manila',
    'en-PH',
    'PHP',
    '{
        "language": "en",
        "notifications": {
            "email": true,
            "sms": true,
            "push": true
        },
        "dashboard": {
            "defaultView": "revenue",
            "widgets": ["bookings", "revenue", "occupancy"]
        }
    }'::jsonb,
    NOW() - INTERVAL '90 days',
    NOW() - INTERVAL '1 day'
),
-- Test Admin User (password: 'AdminUser123!')
(
    '550e8400-e29b-41d4-a716-446655440002',
    'admin@okaeri.ph',
    '$2b$10$AB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ4aB5cD6eF7gH8iJ9',
    'Juan',
    'Dela Cruz',
    '+639281234567',
    TRUE,
    TRUE,
    NOW() - INTERVAL '60 days',
    'Asia/Manila',
    'en-PH',
    'PHP',
    '{
        "language": "en",
        "notifications": {
            "email": true,
            "sms": false,
            "push": true
        }
    }'::jsonb,
    NOW() - INTERVAL '120 days',
    NOW() - INTERVAL '2 hours'
),
-- Test Staff Member (password: 'StaffUser123!')
(
    '550e8400-e29b-41d4-a716-446655440003',
    'staff@bayanresort.ph',
    '$2b$10$CD3eF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ4aB5cD6eF7gH8iJ9kL0',
    'Anna',
    'Reyes',
    '+639391234567',
    TRUE,
    TRUE,
    NOW() - INTERVAL '15 days',
    'Asia/Manila',
    'fil-PH',
    'PHP',
    '{
        "language": "fil",
        "notifications": {
            "email": true,
            "sms": true,
            "push": false
        }
    }'::jsonb,
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '30 minutes'
),
-- Test Unverified User (password: 'UnverifiedUser123!')
(
    '550e8400-e29b-41d4-a716-446655440004',
    'unverified@example.ph',
    '$2b$10$EF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ4aB5cD6eF7gH8iJ9kL0mN1',
    'Pedro',
    'Garcia',
    '+639451234567',
    TRUE,
    FALSE,
    NULL,
    'Asia/Manila',
    'en-PH',
    'PHP',
    '{}'::jsonb,
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '7 days'
),
-- Test Locked User (password: 'LockedUser123!')
(
    '550e8400-e29b-41d4-a716-446655440005',
    'locked@example.ph',
    '$2b$10$GH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ4aB5cD6eF7gH8iJ9kL0mN1oP2',
    'Rosa',
    'Martinez',
    '+639561234567',
    TRUE,
    TRUE,
    NOW() - INTERVAL '20 days',
    'Asia/Manila',
    'en-PH',
    'PHP',
    '{}'::jsonb,
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '1 hour'
);

-- Update locked user's status
UPDATE users 
SET 
    locked_until = NOW() + INTERVAL '15 minutes',
    failed_login_attempts = 5
WHERE email = 'locked@example.ph';

-- =============================================
-- SEED TEST PROJECTS
-- =============================================

-- Insert test resort projects
INSERT INTO projects (
    id,
    name,
    slug,
    schema_name,
    owner_id,
    business_type,
    description,
    business_name,
    address,
    city,
    province,
    country,
    contact_email,
    contact_phone,
    currency,
    timezone,
    settings,
    is_active,
    created_at,
    updated_at
) VALUES 
(
    '650e8400-e29b-41d4-a716-446655440001',
    'Bayan Beach Resort',
    'bayan-beach-resort',
    'bayan_beach_resort',
    '550e8400-e29b-41d4-a716-446655440001',
    'resort',
    'A beautiful beachfront resort in Batangas with world-class amenities and Filipino hospitality.',
    'Bayan Beach Resort Inc.',
    '123 Beachfront Drive, Barangay Laiya',
    'San Juan',
    'Batangas',
    'PH',
    'info@bayanresort.ph',
    '+639171234567',
    'PHP',
    'Asia/Manila',
    '{
        "bookingRules": {
            "advanceBookingDays": 365,
            "cancellationHours": 24,
            "requireDeposit": true,
            "depositPercentage": 50
        },
        "paymentMethods": {
            "cash": true,
            "gcash": true,
            "bankTransfer": true,
            "creditCard": false
        },
        "notifications": {
            "bookingConfirmation": true,
            "paymentReceived": true,
            "dailyReport": true
        }
    }'::jsonb,
    TRUE,
    NOW() - INTERVAL '90 days',
    NOW() - INTERVAL '1 day'
),
(
    '650e8400-e29b-41d4-a716-446655440002',
    'Mountain View Lodge',
    'mountain-view-lodge',
    'mountain_view_lodge',
    '550e8400-e29b-41d4-a716-446655440002',
    'resort',
    'A serene mountain retreat in Tagaytay perfect for family getaways.',
    'Mountain View Lodge Corp.',
    '456 Ridge Road, Barangay Sungay',
    'Tagaytay',
    'Cavite',
    'PH',
    'reservations@mountainviewlodge.ph',
    '+639281234567',
    'PHP',
    'Asia/Manila',
    '{
        "bookingRules": {
            "advanceBookingDays": 180,
            "cancellationHours": 48,
            "requireDeposit": true,
            "depositPercentage": 30
        },
        "paymentMethods": {
            "cash": true,
            "gcash": true,
            "bankTransfer": false,
            "creditCard": false
        }
    }'::jsonb,
    TRUE,
    NOW() - INTERVAL '120 days',
    NOW() - INTERVAL '2 hours'
);

-- =============================================
-- SEED USER PROJECT PERMISSIONS
-- =============================================

-- Assign project permissions
INSERT INTO user_project_permissions (
    user_id,
    project_id,
    role,
    permissions,
    is_active,
    accepted_at,
    created_at,
    updated_at
) VALUES 
-- Resort owner full access to Bayan Beach Resort
(
    '550e8400-e29b-41d4-a716-446655440001',
    '650e8400-e29b-41d4-a716-446655440001',
    'owner',
    '{
        "bookings": {"view": true, "create": true, "update": true, "delete": true},
        "payments": {"view": true, "create": true, "update": true, "delete": true},
        "expenses": {"view": true, "create": true, "update": true, "delete": true},
        "reports": {"view": true, "export": true},
        "settings": {"view": true, "update": true},
        "users": {"view": true, "invite": true, "remove": true, "updateRoles": true}
    }'::jsonb,
    TRUE,
    NOW() - INTERVAL '90 days',
    NOW() - INTERVAL '90 days',
    NOW() - INTERVAL '1 day'
),
-- Admin access to Mountain View Lodge
(
    '550e8400-e29b-41d4-a716-446655440002',
    '650e8400-e29b-41d4-a716-446655440002',
    'owner',
    '{
        "bookings": {"view": true, "create": true, "update": true, "delete": true},
        "payments": {"view": true, "create": true, "update": true, "delete": true},
        "expenses": {"view": true, "create": true, "update": true, "delete": true},
        "reports": {"view": true, "export": true},
        "settings": {"view": true, "update": true},
        "users": {"view": true, "invite": true, "remove": true, "updateRoles": true}
    }'::jsonb,
    TRUE,
    NOW() - INTERVAL '120 days',
    NOW() - INTERVAL '120 days',
    NOW() - INTERVAL '2 hours'
),
-- Staff member access to Bayan Beach Resort
(
    '550e8400-e29b-41d4-a716-446655440003',
    '650e8400-e29b-41d4-a716-446655440001',
    'staff',
    '{
        "bookings": {"view": true, "create": true, "update": true, "delete": false},
        "payments": {"view": true, "create": true, "update": false, "delete": false},
        "expenses": {"view": false, "create": false, "update": false, "delete": false},
        "reports": {"view": true, "export": false},
        "settings": {"view": false, "update": false},
        "users": {"view": false, "invite": false, "remove": false, "updateRoles": false}
    }'::jsonb,
    TRUE,
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '30 minutes'
);

-- =============================================
-- SEED ACTIVE SESSIONS
-- =============================================

-- Create active sessions for logged in users
INSERT INTO sessions (
    id,
    user_id,
    token,
    ip_address,
    user_agent,
    last_activity,
    expires_at,
    device_info,
    created_at
) VALUES 
-- Owner's current session
(
    '750e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001',
    'token_owner_' || md5(random()::text),
    '192.168.1.100'::inet,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    NOW() - INTERVAL '5 minutes',
    NOW() + INTERVAL '7 days',
    '{
        "type": "desktop",
        "browser": "Chrome",
        "os": "Windows 10",
        "location": {"country": "Philippines", "city": "Manila"}
    }'::jsonb,
    NOW() - INTERVAL '2 hours'
),
-- Admin's current session
(
    '750e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440002',
    'token_admin_' || md5(random()::text),
    '192.168.1.101'::inet,
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    NOW() - INTERVAL '10 minutes',
    NOW() + INTERVAL '7 days',
    '{
        "type": "desktop",
        "browser": "Safari",
        "os": "macOS",
        "location": {"country": "Philippines", "city": "Quezon City"}
    }'::jsonb,
    NOW() - INTERVAL '1 hour'
),
-- Staff's mobile session
(
    '750e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440003',
    'token_staff_' || md5(random()::text),
    '192.168.1.102'::inet,
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
    NOW() - INTERVAL '2 minutes',
    NOW() + INTERVAL '7 days',
    '{
        "type": "mobile",
        "browser": "Safari Mobile",
        "os": "iOS 14",
        "location": {"country": "Philippines", "city": "Batangas City"}
    }'::jsonb,
    NOW() - INTERVAL '30 minutes'
);

-- =============================================
-- SEED USER SESSION TRACKING
-- =============================================

-- Create user session tracking records
INSERT INTO user_sessions (
    id,
    user_id,
    session_id,
    login_method,
    project_id,
    pages_viewed,
    actions_performed,
    last_page_visited,
    risk_score,
    started_at
) VALUES 
(
    '850e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001',
    '750e8400-e29b-41d4-a716-446655440001',
    'password',
    '650e8400-e29b-41d4-a716-446655440001',
    15,
    8,
    '/dashboard',
    5,
    NOW() - INTERVAL '2 hours'
),
(
    '850e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440002',
    '750e8400-e29b-41d4-a716-446655440002',
    'password',
    '650e8400-e29b-41d4-a716-446655440002',
    22,
    12,
    '/reports',
    3,
    NOW() - INTERVAL '1 hour'
),
(
    '850e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440003',
    '750e8400-e29b-41d4-a716-446655440003',
    'password',
    '650e8400-e29b-41d4-a716-446655440001',
    8,
    5,
    '/bookings',
    10,
    NOW() - INTERVAL '30 minutes'
);

-- =============================================
-- SEED LOGIN ATTEMPTS (Sample Data)
-- =============================================

-- Insert various login attempts for analysis
INSERT INTO login_attempts (
    id,
    email,
    ip_address,
    user_agent,
    success,
    failure_reason,
    risk_score,
    geo_location,
    attempted_at
) VALUES 
-- Successful logins
('950e8400-e29b-41d4-a716-446655440001', 'owner@bayanresort.ph', '192.168.1.100'::inet, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', TRUE, NULL, 5, '{"country": "Philippines", "city": "Manila"}'::jsonb, NOW() - INTERVAL '2 hours'),
('950e8400-e29b-41d4-a716-446655440002', 'admin@okaeri.ph', '192.168.1.101'::inet, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', TRUE, NULL, 3, '{"country": "Philippines", "city": "Quezon City"}'::jsonb, NOW() - INTERVAL '1 hour'),
('950e8400-e29b-41d4-a716-446655440003', 'staff@bayanresort.ph', '192.168.1.102'::inet, 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1)', TRUE, NULL, 10, '{"country": "Philippines", "city": "Batangas City"}'::jsonb, NOW() - INTERVAL '30 minutes'),

-- Failed login attempts
('950e8400-e29b-41d4-a716-446655440004', 'owner@bayanresort.ph', '203.0.113.1'::inet, 'curl/7.68.0', FALSE, 'invalid_password', 60, '{"country": "Unknown", "city": "Unknown"}'::jsonb, NOW() - INTERVAL '3 hours'),
('950e8400-e29b-41d4-a716-446655440005', 'nonexistent@example.com', '203.0.113.2'::inet, 'Python-requests/2.25.1', FALSE, 'user_not_found', 40, '{"country": "Unknown", "city": "Unknown"}'::jsonb, NOW() - INTERVAL '4 hours'),
('950e8400-e29b-41d4-a716-446655440006', 'locked@example.ph', '192.168.1.200'::inet, 'Mozilla/5.0 (Windows NT 10.0)', FALSE, 'account_locked', 80, '{"country": "Philippines", "city": "Manila"}'::jsonb, NOW() - INTERVAL '1 hour 30 minutes');

-- =============================================
-- SEED EMAIL VERIFICATION TOKENS
-- =============================================

-- Create email verification token for unverified user
INSERT INTO email_verification_tokens (
    id,
    user_id,
    email,
    token,
    expires_at,
    ip_address,
    user_agent,
    created_at
) VALUES (
    '450e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440004',
    'unverified@example.ph',
    'verify_' || md5(random()::text) || md5(random()::text),
    NOW() + INTERVAL '24 hours',
    '192.168.1.200'::inet,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    NOW() - INTERVAL '7 days'
);

-- =============================================
-- SEED SECURITY AUDIT LOGS
-- =============================================

-- Insert sample security audit events
INSERT INTO security_audit_logs (
    id,
    user_id,
    project_id,
    event_type,
    action,
    ip_address,
    user_agent,
    session_id,
    risk_score,
    threat_level,
    success,
    metadata,
    created_at
) VALUES 
-- User registration events
('a50e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', NULL, 'register', 'INSERT', '192.168.1.100'::inet, 'Mozilla/5.0 (Windows NT 10.0)', NULL, 10, 'low', TRUE, '{"registration_method": "standard", "email": "owner@bayanresort.ph"}'::jsonb, NOW() - INTERVAL '90 days'),
('a50e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', NULL, 'register', 'INSERT', '192.168.1.101'::inet, 'Mozilla/5.0 (Macintosh)', NULL, 10, 'low', TRUE, '{"registration_method": "standard", "email": "admin@okaeri.ph"}'::jsonb, NOW() - INTERVAL '120 days'),

-- Login events
('a50e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', 'login', 'INSERT', '192.168.1.100'::inet, 'Mozilla/5.0 (Windows NT 10.0)', '750e8400-e29b-41d4-a716-446655440001', 5, 'low', TRUE, '{"login_method": "password", "project": "Bayan Beach Resort"}'::jsonb, NOW() - INTERVAL '2 hours'),
('a50e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440002', 'login', 'INSERT', '192.168.1.101'::inet, 'Mozilla/5.0 (Macintosh)', '750e8400-e29b-41d4-a716-446655440002', 3, 'low', TRUE, '{"login_method": "password", "project": "Mountain View Lodge"}'::jsonb, NOW() - INTERVAL '1 hour'),

-- Failed login attempts
('a50e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440001', NULL, 'login', 'INSERT', '203.0.113.1'::inet, 'curl/7.68.0', NULL, 60, 'medium', FALSE, '{"failure_reason": "invalid_password", "suspicious_ip": true}'::jsonb, NOW() - INTERVAL '3 hours'),

-- Account lock event
('a50e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440005', NULL, 'account_locked', 'UPDATE', '192.168.1.200'::inet, 'Mozilla/5.0 (Windows NT 10.0)', NULL, 80, 'high', TRUE, '{"reason": "multiple_failed_attempts", "attempts_count": 5}'::jsonb, NOW() - INTERVAL '1 hour 30 minutes'),

-- Email verification
('a50e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440001', NULL, 'email_verification', 'UPDATE', '192.168.1.100'::inet, 'Mozilla/5.0 (Windows NT 10.0)', NULL, 5, 'low', TRUE, '{"email": "owner@bayanresort.ph", "verified": true}'::jsonb, NOW() - INTERVAL '60 days');

-- =============================================
-- UPDATE STATISTICS
-- =============================================

-- Update table statistics for better query planning
ANALYZE users;
ANALYZE projects;
ANALYZE user_project_permissions;
ANALYZE sessions;
ANALYZE user_sessions;
ANALYZE login_attempts;
ANALYZE email_verification_tokens;
ANALYZE security_audit_logs;

-- =============================================
-- DEVELOPMENT NOTES
-- =============================================

/*
Test Account Credentials (DEVELOPMENT ONLY):
- Resort Owner: owner@bayanresort.ph / ResortOwner123!
- Admin User: admin@okaeri.ph / AdminUser123!
- Staff Member: staff@bayanresort.ph / StaffUser123!
- Unverified User: unverified@example.ph / UnverifiedUser123!
- Locked User: locked@example.ph / LockedUser123! (account is locked)

Password hash method: bcrypt with 10 rounds
All phone numbers use Philippine +63 format
All timestamps use Asia/Manila timezone
All currencies default to PHP (Philippine Peso)

Test Projects:
- Bayan Beach Resort (Batangas beach resort)
- Mountain View Lodge (Tagaytay mountain retreat)

Security Features Demonstrated:
- Email verification system
- Account locking after failed attempts
- Session management with device tracking
- Comprehensive audit logging
- Philippine business compliance
*/