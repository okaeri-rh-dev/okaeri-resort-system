-- Rollback: 0001_initial_global_schema
-- Description: Rollback initial global schema setup
-- Created: 2025-08-26
-- Author: Okaeri Development Team

-- ============================================
-- ROLLBACK GLOBAL SCHEMA MIGRATION
-- ============================================
-- WARNING: This will remove all global tables and data!
-- Only run this in development or if you need to completely reset the database

-- Drop triggers first
DROP TRIGGER IF EXISTS update_user_project_permissions_updated_at ON user_project_permissions;
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Drop functions
DROP FUNCTION IF EXISTS drop_project_schema(VARCHAR);
DROP FUNCTION IF EXISTS create_project_schema(VARCHAR);
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS user_project_permissions CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop indexes (already dropped with tables, but included for completeness)
-- These are automatically dropped when tables are dropped

-- Drop enum types
DROP TYPE IF EXISTS audit_severity CASCADE;
DROP TYPE IF EXISTS audit_category CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS project_business_type CASCADE;
DROP TYPE IF EXISTS user_language CASCADE;

-- Drop extensions (optional - only if you want complete rollback)
-- DROP EXTENSION IF EXISTS "pgcrypto";
-- DROP EXTENSION IF EXISTS "uuid-ossp";

-- ============================================
-- END OF ROLLBACK
-- ============================================