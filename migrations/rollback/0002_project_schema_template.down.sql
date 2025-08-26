-- Rollback: 0002_project_schema_template
-- Description: Rollback project-specific schema
-- Created: 2025-08-26
-- Author: Okaeri Development Team

-- ============================================
-- ROLLBACK PROJECT SCHEMA MIGRATION
-- ============================================
-- Replace {SCHEMA_NAME} with the actual project schema name
-- WARNING: This will remove all project data!

-- Drop views first
DROP VIEW IF EXISTS {SCHEMA_NAME}.monthly_financial_summary CASCADE;
DROP VIEW IF EXISTS {SCHEMA_NAME}.booking_summary CASCADE;

-- Drop triggers
DROP TRIGGER IF EXISTS update_{SCHEMA_NAME}_project_settings_updated_at ON {SCHEMA_NAME}.project_settings;
DROP TRIGGER IF EXISTS update_{SCHEMA_NAME}_income_updated_at ON {SCHEMA_NAME}.income;
DROP TRIGGER IF EXISTS update_{SCHEMA_NAME}_expenses_updated_at ON {SCHEMA_NAME}.expenses;
DROP TRIGGER IF EXISTS update_{SCHEMA_NAME}_expense_categories_updated_at ON {SCHEMA_NAME}.expense_categories;
DROP TRIGGER IF EXISTS update_{SCHEMA_NAME}_payments_updated_at ON {SCHEMA_NAME}.payments;
DROP TRIGGER IF EXISTS update_{SCHEMA_NAME}_bookings_updated_at ON {SCHEMA_NAME}.bookings;

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS {SCHEMA_NAME}.project_settings CASCADE;
DROP TABLE IF EXISTS {SCHEMA_NAME}.booking_timeline CASCADE;
DROP TABLE IF EXISTS {SCHEMA_NAME}.income CASCADE;
DROP TABLE IF EXISTS {SCHEMA_NAME}.expenses CASCADE;
DROP TABLE IF EXISTS {SCHEMA_NAME}.expense_categories CASCADE;
DROP TABLE IF EXISTS {SCHEMA_NAME}.payments CASCADE;
DROP TABLE IF EXISTS {SCHEMA_NAME}.bookings CASCADE;

-- Drop enum types
DROP TYPE IF EXISTS {SCHEMA_NAME}.income_source CASCADE;
DROP TYPE IF EXISTS {SCHEMA_NAME}.expense_status CASCADE;
DROP TYPE IF EXISTS {SCHEMA_NAME}.payment_method CASCADE;
DROP TYPE IF EXISTS {SCHEMA_NAME}.payment_status CASCADE;
DROP TYPE IF EXISTS {SCHEMA_NAME}.booking_status CASCADE;

-- Drop the schema itself (optional - only if you want to completely remove the project)
-- DROP SCHEMA IF EXISTS {SCHEMA_NAME} CASCADE;

-- ============================================
-- END OF ROLLBACK
-- ============================================