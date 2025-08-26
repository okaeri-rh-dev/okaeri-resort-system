# Database Migrations

This directory contains all database migrations for the Okaeri Resort Management System.

## Structure

```
migrations/
├── meta/                           # Drizzle migration metadata
│   └── _journal.json              # Migration journal tracking
├── rollback/                      # Rollback scripts for migrations
│   ├── *.down.sql                # Rollback files for each migration
├── 0001_initial_global_schema.sql # Initial global schema setup
├── 0002_project_schema_template.sql # Template for project schemas
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

## Philippine-Specific Considerations

Our migrations include:
- Currency fields using DECIMAL(12,2) for Philippine Peso
- Timezone settings defaulting to Asia/Manila
- GCash payment method support
- Philippine province/city data in seed scripts
- BIR-compliant audit trail structures

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