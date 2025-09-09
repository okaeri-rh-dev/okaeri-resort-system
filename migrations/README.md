# Database Migrations

> **⚠️ LEGACY COMPLIANCE WARNING**
> 
> This document has been updated to reflect the current system scope as an internal family business management tool.
> Previous Philippine business compliance references have been transformed to reflect internal operational requirements.
> The system handles only staff data and internal operations, not customer personal data or regulatory compliance.

This directory contains all database migrations for the Okaeri Resort Management System, specifically designed for Neon PostgreSQL with internal operational requirements.

## Structure

```
migrations/
├── meta/                           # Drizzle migration metadata
│   └── _journal.json              # Migration journal tracking
├── rollback/                      # Rollback scripts for migrations
│   ├── *.down.sql                # Rollback files for each migration
├── 0001_initial_global_schema.sql # Initial global schema setup
├── 0002_project_schema_template.sql # Template for project schemas
├── 001_auth_tables.sql            # Enhanced authentication tables (Phase 1.6)
├── 002_auth_indexes.sql           # Performance indexes for auth system
├── 003_auth_triggers.sql          # Security triggers and audit functions
├── seed_auth_data.sql             # Development seed data (test users & resorts)
├── run_auth_migrations.sql        # Complete auth migration runner
└── README.md                      # This file
```

## Migration Naming Convention

- `NNNN_description_type.sql` where:
  - `NNNN` = 4-digit sequential number
  - `description` = snake_case description of the migration
  - `type` = `global` or `project` (optional, for clarity)

## Available Commands

### Create a New Migration
```bash
npm run db:migrate:create
```
Interactive CLI that helps you create new migration files with proper structure.

### Run Migrations (Global Schema)
```bash
npm run db:migrate:up
```
Applies all pending migrations to the global schema.

### Run Project Migrations
```typescript
// In your application code
import { runProjectMigrations } from './lib/db/migrate';

await runProjectMigrations('project_schema_name', {
  verbose: true
});
```

### Rollback Last Migration
```bash
npm run db:migrate:down
```
Rolls back the most recent migration.

### Check Migration Status
```bash
npm run db:migrate:status
```
Shows which migrations have been applied and which are pending.

### Seed Database
```bash
# Development environment with test data
npm run db:seed

# Production environment (minimal data only)
npm run db:seed:prod
```

## Migration Types

### 1. Global Migrations
Affect the public schema and core system tables:
- Users
- Projects
- User permissions
- Audit logs

### 2. Project Migrations
Affect individual project schemas:
- Bookings
- Payments
- Expenses
- Income
- Project settings

## Writing Migrations

### Global Migration Example
```sql
-- Migration: 0003_add_user_preferences_global.sql
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'light';

CREATE INDEX IF NOT EXISTS idx_users_theme 
ON users(theme);
```

### Project Migration Example
```sql
-- Migration: 0004_add_booking_notes_project.sql
-- Use {SCHEMA_NAME} placeholder for project schemas

ALTER TABLE {SCHEMA_NAME}.bookings 
ADD COLUMN IF NOT EXISTS staff_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_{SCHEMA_NAME}_bookings_staff_notes 
ON {SCHEMA_NAME}.bookings(staff_notes) 
WHERE staff_notes IS NOT NULL;
```

## Best Practices

1. **Always Test First**: Run migrations in development before production
2. **Create Rollbacks**: Every migration should have a corresponding rollback
3. **Use Transactions**: Wrap related changes in transactions when possible
4. **Document Changes**: Include clear comments explaining the purpose
5. **Check Dependencies**: Ensure migrations run in the correct order
6. **Idempotent Migrations**: Use `IF NOT EXISTS` and `IF EXISTS` clauses
7. **Data Migration**: Handle existing data carefully when modifying columns

## Migration Safety

### Before Running Migrations

1. **Backup Database**: Always backup production data first
2. **Review Changes**: Double-check migration SQL for errors
3. **Test Locally**: Run migrations in a local environment
4. **Check Rollback**: Ensure rollback script works correctly

### During Migration

- Monitor for errors
- Check connection pool usage
- Verify data integrity

### After Migration

1. **Verify Schema**: Check that changes were applied correctly
2. **Test Application**: Ensure application works with new schema
3. **Monitor Performance**: Watch for query performance issues
4. **Update Documentation**: Document any breaking changes

## Troubleshooting

### Migration Failed
```bash
# Check migration status
npm run db:migrate:status

# Review error logs
# Rollback if needed
npm run db:migrate:down

# Fix migration file and retry
npm run db:migrate:up
```

### Schema Out of Sync
```bash
# Generate fresh migration from Drizzle schema
npm run db:generate

# Compare with existing migrations
# Manually reconcile differences
```

### Connection Issues
- Check DATABASE_URL environment variable
- Verify Neon connection string
- Check network connectivity
- Review connection pool settings

## Environment Variables

Required environment variables:
```env
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
NODE_ENV=development|staging|production
DEFAULT_ADMIN_EMAIL=admin@okaeri.ph
DEFAULT_ADMIN_PASSWORD=SecurePassword123!
```

## Authentication System Migrations (Phase 1.6)

### 🔐 Enhanced Security Features
- **Enhanced Users Table**: Philippine timezone (Asia/Manila), PHP currency, E.164 phone format (+63)
- **Sessions Table**: Comprehensive session tracking with device information and security
- **Security Audit Logs**: 5-year retention for BIR compliance with monthly partitioning
- **Login Attempts**: Rate limiting and suspicious activity detection with geolocation
- **Token Management**: Secure password reset and email verification with expiration

### 🏢 Internal Business Context
- Default timezone: `Asia/Manila` for all timestamps
- Default currency: `PHP` (Philippine Peso) with DECIMAL(12,2) precision
- Phone format: E.164 with +63 country code validation
- Locale support: `en-PH` (English-Philippines), `fil-PH` (Filipino-Philippines)
- Internal audit: 5-year audit log retention requirement
- Internal payment method integration ready

### ⚡ Serverless Optimizations for Neon PostgreSQL
- Connection pooling configuration optimized for serverless functions
- Partitioned audit logs by month for better query performance
- Strategic indexes for frequent authentication queries
- Automated cleanup procedures for expired tokens and sessions
- Connection warm-up functions for cold start mitigation

### 🛡️ Security Features
- Bcrypt password hashing with configurable rounds (default: 10)
- Account lockout: 5 failed attempts = 30 minute lock
- Session token management with configurable expiration
- Two-factor authentication (TOTP) support structure
- Comprehensive audit trail with risk scoring
- Row-level security policies for sensitive data

### Quick Start - Authentication Migration
```bash
# Run complete authentication system migration
psql -d your_database -f migrations/run_auth_migrations.sql

# Or run individual files in sequence:
psql -d your_database -f migrations/001_auth_tables.sql
psql -d your_database -f migrations/002_auth_indexes.sql  
psql -d your_database -f migrations/003_auth_triggers.sql

# Seed development data (DEVELOPMENT ONLY - never in production)
psql -d your_database -f migrations/seed_auth_data.sql
```

### Test Accounts (Development Only)
```
Resort Owner: owner@bayanresort.ph / ResortOwner123!
Admin User:   admin@okaeri.ph / AdminUser123!  
Staff Member: staff@bayanresort.ph / StaffUser123!
Unverified:   unverified@example.ph / UnverifiedUser123!
Locked User:  locked@example.ph / LockedUser123! (account locked)
```

### Test Resorts Included
- **Bayan Beach Resort** (Batangas) - Beachfront resort with full amenities
- **Mountain View Lodge** (Tagaytay) - Mountain retreat perfect for families

### Monitoring & Analytics Views
```sql
-- User security overview
SELECT * FROM v_user_security_status;

-- Active session monitoring
SELECT * FROM v_session_monitoring;

-- Security event analytics
SELECT * FROM v_security_analytics;

-- Login pattern analysis
SELECT * FROM v_login_analysis;
```

### Helper Functions Available
```sql
-- Check if user has valid active session
SELECT has_valid_session('user-uuid');

-- Calculate user's security score (0-100)
SELECT get_user_security_score('user-uuid');

-- Generate cryptographically secure tokens
SELECT generate_secure_token(32);

-- Run daily maintenance (cleanup expired data)
SELECT daily_auth_maintenance();
```

## Internal Operational Considerations

Our migrations include comprehensive support for internal operational requirements:
- Currency fields using DECIMAL(12,2) for Philippine Peso precision
- Timezone settings defaulting to Asia/Manila with proper conversion
- GCash payment method support in project payment settings
- Local province/city data structure for addresses
- Internal audit trail with 5-year retention requirement
- E.164 phone number validation with +63 country code
- Bilingual support for English and Filipino languages

## Security Notes

1. **Never commit sensitive data** in migrations
2. **Use environment variables** for configuration
3. **Restrict schema creation** permissions in production
4. **Audit all schema changes** through migration system
5. **Encrypt sensitive fields** where appropriate

## Support

For migration issues or questions:
1. Check this README first
2. Review migration logs
3. Consult the team lead
4. Document any new patterns discovered