# Database Tests

Comprehensive test suite for the Okaeri Resort Management System database layer.

## Test Structure

### Test Files

1. **connection.test.ts** - Database connection tests
   - Connection establishment and pooling
   - Retry logic verification
   - Schema-specific connections
   - Transaction support
   - Error handling

2. **schema.test.ts** - Schema validation tests
   - Global table structure verification
   - Project schema creation
   - Foreign key relationships
   - Index effectiveness
   - Philippine-specific fields (Peso, GCash)

3. **isolation.test.ts** - Multi-tenant isolation tests
   - Data isolation between projects
   - Cross-schema query prevention
   - Permission boundaries
   - Schema switching safety
   - Audit trail isolation

4. **performance.test.ts** - Performance benchmarks
   - Query response times
   - Connection pool efficiency
   - Bulk operation performance
   - Index usage verification
   - Optimization strategies

5. **utils.test.ts** - Utility function tests
   - createProjectSchema function
   - checkProjectAccess validation
   - Audit logging
   - Code generation utilities
   - Sanitization functions

6. **fixtures.ts** - Test fixtures and helpers
   - Data factories for all entities
   - Database cleanup utilities
   - Performance tracking tools
   - Mock data generators

## Setup

### Prerequisites

1. PostgreSQL database (local or Neon)
2. Node.js 18+ and npm
3. Environment variables configured

### Configuration

1. Copy the test environment file:
```bash
cp .env.test .env.test.local
```

2. Update with your test database credentials:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/test_db
```

3. Install dependencies:
```bash
npm install
```

### Running Tests

Run all database tests:
```bash
npm run test:db
```

Run specific test suites:
```bash
npm run test:db:connection   # Connection tests only
npm run test:db:schema       # Schema tests only
npm run test:db:isolation    # Isolation tests only
npm run test:db:performance  # Performance tests only
npm run test:db:utils        # Utility tests only
```

Run with coverage:
```bash
npm run test:coverage -- tests/db
```

Run with UI:
```bash
npm run test:ui
```

## Test Database Management

### Setup Test Database

The tests automatically create and clean up test schemas. Each test run uses isolated schemas prefixed with `test_`.

### Manual Cleanup

If tests fail and leave orphaned schemas:

```sql
-- List all test schemas
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name LIKE 'test_%';

-- Drop all test schemas (CAUTION!)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schema_name 
              FROM information_schema.schemata 
              WHERE schema_name LIKE 'test_%') 
    LOOP
        EXECUTE 'DROP SCHEMA IF EXISTS ' || quote_ident(r.schema_name) || ' CASCADE';
    END LOOP;
END $$;
```

## Performance Benchmarks

The performance tests track key metrics:

### Expected Performance Targets

- Simple queries: < 50ms average
- Indexed queries: < 100ms average  
- Date range queries: < 200ms average
- Aggregation queries: < 300ms average
- Complex joins: < 300ms average
- Bulk insert (1000 records): < 5s
- Bulk update (500 records): < 1s
- Bulk delete (500 records): < 1s

### Performance Monitoring

Performance test results are logged after each run:

```
=== Performance Test Summary ===
simple_query:
  Count: 20
  Avg: 12.34ms
  Median: 11.50ms
  P95: 18.90ms
  Min: 9.20ms
  Max: 22.10ms
```

## Writing New Tests

### Test Structure

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseCleaner, TestDatabaseSetup } from './fixtures';

describe('Feature Name', () => {
  let cleaner: DatabaseCleaner;
  let setup: TestDatabaseSetup;

  beforeAll(() => {
    cleaner = new DatabaseCleaner();
    setup = new TestDatabaseSetup();
  });

  afterAll(async () => {
    await cleaner.cleanup();
  });

  it('should test specific behavior', async () => {
    // Arrange
    const { user, project, cleanup } = await setup.setupTestProject({
      createSchema: true,
    });

    // Act
    // ... test logic

    // Assert
    expect(result).toBe(expected);

    // Cleanup
    await cleanup();
  });
});
```

### Using Factories

```typescript
import { userFactory, projectFactory, bookingFactory } from './fixtures';

// Create single entity
const user = userFactory.create({
  email: 'custom@test.com'
});

// Create multiple entities
const bookings = bookingFactory.createMany(10);
```

### Performance Testing

```typescript
import { PerformanceTracker } from './fixtures';

const tracker = new PerformanceTracker();

const stop = tracker.start('operation_name');
// ... perform operation
stop();

const stats = tracker.getStats('operation_name');
console.log(`Average: ${stats.avg}ms`);
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on others
2. **Cleanup**: Always clean up test data using the provided utilities
3. **Timeouts**: Use TEST_TIMEOUT constant for long operations
4. **Schemas**: Use unique schema names to avoid conflicts
5. **Performance**: Track performance metrics for critical operations
6. **Assertions**: Use specific assertions for better error messages

## Troubleshooting

### Connection Errors

If you see connection errors:
1. Verify DATABASE_URL is correct
2. Check PostgreSQL is running
3. Ensure test database exists
4. Verify network connectivity (for cloud databases)

### Schema Conflicts

If tests fail due to schema conflicts:
1. Run manual cleanup SQL above
2. Check for concurrent test runs
3. Verify schema name generation is unique

### Performance Issues

If tests are slow:
1. Check database indexes exist
2. Verify connection pooling is working
3. Look for N+1 query problems
4. Consider using batch operations

### Memory Issues

If tests consume too much memory:
1. Ensure cleanup functions are called
2. Limit concurrent test execution
3. Use smaller datasets for unit tests
4. Profile memory usage with Node.js tools

## CI/CD Integration

For CI environments, ensure:

1. Test database is available
2. DATABASE_URL is set in CI secrets
3. Migrations run before tests
4. Cleanup runs after tests
5. Timeout is appropriate for CI resources

Example GitHub Actions:

```yaml
- name: Setup Test Database
  run: |
    psql -c "CREATE DATABASE test_db;"
  env:
    PGPASSWORD: ${{ secrets.DB_PASSWORD }}

- name: Run Database Tests
  run: npm run test:db
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
```

## Contributing

When adding new database features:

1. Write schema tests first
2. Add isolation tests for multi-tenant features
3. Include performance benchmarks
4. Update factories for new entities
5. Document expected behavior
6. Add cleanup utilities