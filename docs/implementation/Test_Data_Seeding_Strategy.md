# Test Data Seeding Strategy

## Overview

The Okaeri Resort Management System implements a comprehensive, idempotent test
data seeding strategy that ensures consistent and deterministic test data across
unit, integration, and end-to-end tests. This strategy eliminates test flakiness
while providing realistic data scenarios.

## Architecture Principles

### Core Design Principles

1. **Idempotent Seeding**: Multiple seed operations with the same parameters
   produce identical results
2. **Deterministic Generation**: Seeded random data ensures reproducible test
   runs
3. **Level-Appropriate Data**: Different data volumes and complexity for
   different test types
4. **Type-Safe Factories**: All data generation uses Zod schema validation
5. **Caching Strategy**: Efficient reuse of generated data within test sessions
6. **Realistic Scenarios**: Philippine-specific business rules and data patterns

## Seeding Levels

### Unit Test Seeding

**Purpose**: Fast, minimal data for isolated component testing

- **Data Volume**: 1-5 records per entity
- **Complexity**: Simple, valid data structures
- **Performance**: <10ms seeding time
- **Deterministic**: 100% predictable output

```typescript
// Example: Unit test seeding
const seedData = await testDataSeeder.seedMinimalData();
// Returns: 2 users, 1 booking, 1 expense, minimal relationships
```

### Integration Test Seeding

**Purpose**: Moderate data volumes for feature integration testing

- **Data Volume**: 5-30 records per entity
- **Complexity**: Related entities with realistic relationships
- **Performance**: <100ms seeding time
- **Scenarios**: Common business workflows

```typescript
// Example: Integration test seeding
const seedData = await testDataSeeder.seedStandardData();
// Returns: 5 users, 15 bookings, 25 expenses, full relationships
```

### End-to-End Test Seeding

**Purpose**: Comprehensive data for full system testing

- **Data Volume**: 20-100 records per entity
- **Complexity**: Complex relationships and edge cases
- **Performance**: <500ms seeding time
- **Scenarios**: Complete business processes

```typescript
// Example: E2E test seeding
const seedData = await testDataSeeder.seedComprehensiveData();
// Returns: 20 users, 100 bookings, 150 expenses, complete ecosystem
```

## Data Factory Architecture

### Type-Safe Factories

Each entity has a dedicated factory using Zod schemas for validation:

```typescript
// Booking Factory Example
export function createBooking(overrides?: BookingFactoryOptions): BookingInput {
  const bookingData = {
    // Generated data with Philippine business rules
    guestPhone: "+63" + seededFaker.string.numeric(10),
    totalAmount: calculateTotalAmount(nights, guests, 3000), // Returns number
    // ... other fields
  };

  // Validate with Zod schema before returning
  return BookingSchema.parse(bookingData);
}
```

### Seeded Randomness

Deterministic random generation using seeded faker:

```typescript
function createSeededFaker(seed?: string): typeof faker {
  if (seed) {
    faker.seed(
      Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0)
    );
  }
  return faker;
}
```

## Seeding Strategies

### Strategy Configuration

```typescript
export interface SeedingOptions {
  level: "unit" | "integration" | "e2e";
  scenario: "minimal" | "standard" | "comprehensive" | "stress";
  deterministic: boolean;
  seed?: string;
  clearExisting?: boolean;
}
```

### Predefined Strategies

```typescript
export const seedingStrategies = {
  unit: {
    level: "unit",
    scenario: "minimal",
    deterministic: true,
    seed: "unit-test-seed",
  },
  integration: {
    level: "integration",
    scenario: "standard",
    deterministic: true,
    seed: "integration-test-seed",
  },
  e2e: {
    level: "e2e",
    scenario: "comprehensive",
    deterministic: true,
    seed: "e2e-test-seed",
  },
};
```

## Data Relationships

### Entity Relationships

The seeder creates realistic relationships between entities:

```typescript
// Booking → Payment relationship
for (let i = 0; i < paymentsPerBooking; i++) {
  const booking = bookings[i];
  const totalAmount = booking.totalAmount; // Already a number in domain
  const paymentPlan = i % 3 === 0 ? "full" : "installments";
  const payments = createPaymentsForBooking(
    booking.id,
    totalAmount,
    paymentPlan
  );
}
```

### Business Rule Compliance

- **Philippine Tax Rules**: 12% VAT, 10% service charge
- **Payment Methods**: Cash, GCash, Bank Transfer, Credit Card
- **Phone Numbers**: +63 format validation
- **Currency**: Philippine Peso (PHP) - stored as numbers, formatted to 2
  decimal places only for display
- **Date Formats**: ISO 8601 with Philippine timezone consideration

#### Currency Handling Pattern

```typescript
// Domain Model - Always use numbers
interface Booking {
  totalAmount: number; // 5000 (not "5000.00")
  paidAmount: number; // 3000
  balanceAmount: number; // 2000
  vatAmount: number; // 600
  serviceCharge: number; // 500
}

// Zod Schema - Enforce number types
const BookingSchema = z.object({
  totalAmount: z.number().nonnegative(),
  paidAmount: z.number().nonnegative(),
  balanceAmount: z.number().nonnegative(),
  vatAmount: z.number().nonnegative(),
  serviceCharge: z.number().nonnegative(),
});

// Input Parsing - Convert strings to numbers
function parseMonetaryInput(value: string | number): number {
  if (typeof value === "number") return value;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) throw new Error("Invalid monetary value");
  return Math.round(parsed * 100) / 100; // Round to 2 decimals
}

// Display Formatting - Convert numbers to strings
function formatForDisplay(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}
```

## Cache Management

### Intelligent Caching

```typescript
class TestDataSeeder {
  private seedCache = new Map<string, SeededData>();

  async seed(options: SeedingOptions): Promise<SeededData> {
    const cacheKey = this.generateCacheKey(options);

    // Return cached data if available and deterministic
    if (options.deterministic && this.seedCache.has(cacheKey)) {
      return this.seedCache.get(cacheKey)!;
    }

    // Generate and cache new data
    const seededData = await this.generateSeededData(options);
    if (options.deterministic) {
      this.seedCache.set(cacheKey, seededData);
    }

    return seededData;
  }
}
```

### Cache Optimization

- **Memory Efficient**: Only cache deterministic data
- **Selective Caching**: Different cache keys for different scenarios
- **Automatic Cleanup**: Clear cache between test suites
- **Statistics**: Monitor cache hit rates and memory usage

## Philippine-Specific Data

### Realistic Business Data

```typescript
const PHILIPPINE_VENDORS = [
  "Meralco", // Electricity
  "Maynilad", // Water
  "PLDT", // Telecommunications
  "Globe Telecom", // Mobile services
  "Shell Philippines", // Fuel
  // ... more local vendors
];

const PHILIPPINE_BANKS = [
  "BPI (Bank of the Philippine Islands)",
  "Metrobank",
  "BDO Unibank",
  // ... more local banks
];
```

### Currency and Pricing

```typescript
// Domain layer - always use numbers for calculations
function calculateTotalAmount(
  nights: number,
  guests: number,
  baseRate: number = 3000
): number {
  const subtotal = baseRate * nights;
  const guestSurcharge = guests > 2 ? (guests - 2) * 500 * nights : 0;
  const tax = (subtotal + guestSurcharge) * 0.12; // 12% VAT
  const serviceCharge = (subtotal + guestSurcharge) * 0.1; // 10% service charge

  // Return as number for domain operations
  return subtotal + guestSurcharge + tax + serviceCharge;
}

// UI layer - format for display only
function formatCurrency(amount: number): string {
  return `₱${amount.toFixed(2)}`;
}

// CSV/Export layer - format for external systems
function formatForExport(amount: number): string {
  return amount.toFixed(2);
}
```

## Usage Patterns

### Basic Seeding

```typescript
import { testDataSeeder } from "@/test/utils/test-data-seeder";

// Before each test
beforeEach(async () => {
  await testDataSeeder.reset();
  const data = await testDataSeeder.seedMinimalData();
  // Test with seeded data
});
```

### Custom Scenarios

```typescript
// Financial testing scenario
const financialData = await testDataSeeder.seedFinancialScenario(6); // 6 months
expect(financialData.financialSummary).toHaveLength(6);

// Error scenario testing
const errorData = await testDataSeeder.seedErrorScenarios();
expect(errorData.errorData.invalidBooking.checkOutDate).toBeLessThan(
  errorData.errorData.invalidBooking.checkInDate
);
```

### Performance Testing

```typescript
// Stress test with large datasets
const stressData = await testDataSeeder.seedStressData();
expect(stressData.bookings).toHaveLength(500);
expect(stressData.expenses).toHaveLength(1000);
```

## Integration with Tests

### Vitest Integration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ["./src/test/setup.ts"],
    beforeEach: async () => {
      await testDataSeeder.reset();
    },
  },
});
```

### Playwright Integration

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    baseURL: "http://localhost:3000",
  },

  // Global setup
  globalSetup: require.resolve("./tests/global-setup.ts"),
});

// tests/global-setup.ts
import { testDataSeeder } from "../src/test/utils/test-data-seeder";

async function globalSetup() {
  // Seed E2E test data
  await testDataSeeder.seedComprehensiveData();
}

export default globalSetup;
```

## Performance Metrics

### Seeding Performance

| Test Level  | Data Volume   | Seeding Time | Memory Usage |
| ----------- | ------------- | ------------ | ------------ |
| Unit        | ~10 records   | <10ms        | <1MB         |
| Integration | ~100 records  | <100ms       | <5MB         |
| E2E         | ~500 records  | <500ms       | <20MB        |
| Stress      | ~2000 records | <2000ms      | <100MB       |

### Cache Efficiency

- **Hit Rate**: >90% for deterministic tests
- **Memory Savings**: ~80% reduction in data generation time
- **Test Speed**: 3-5x faster test execution with cached data

## Best Practices

### Test Organization

1. **Reset Before Each Test**: Ensure clean state
2. **Use Appropriate Level**: Don't over-seed unit tests
3. **Cache Deterministic Data**: Reuse stable datasets
4. **Validate Generated Data**: Use Zod schemas consistently

### Data Management

1. **Seed Naming**: Use descriptive, deterministic seeds
2. **Relationship Integrity**: Maintain referential consistency
3. **Business Rules**: Apply Philippine-specific validations
4. **Error Scenarios**: Include invalid data for negative testing

### Performance Optimization

1. **Lazy Loading**: Generate data only when needed
2. **Selective Seeding**: Seed only required entities
3. **Batch Operations**: Create related data efficiently
4. **Memory Management**: Clear unused cache entries

## Troubleshooting

### Common Issues

**Flaky Tests**

- Ensure deterministic seeding is enabled
- Use consistent seed values across test runs
- Verify faker.seed() is called before data generation

**Memory Issues**

- Clear cache between test suites
- Use appropriate data volumes for test level
- Monitor cache statistics

**Data Inconsistency**

- Validate all generated data with Zod schemas
- Check relationship integrity
- Verify business rule compliance

### Debug Tools

```typescript
// Get cache statistics
const stats = testDataSeeder.getCacheStats();
console.log("Cache size:", stats.size);
console.log("Total data points:", stats.totalDataPoints);

// Validate generated data
const isValid = await validateTestData.validateBooking(booking);
if (!isValid) {
  console.error("Invalid booking data generated");
}
```

## Migration Path

### Existing Tests

1. **Identify Current Patterns**: Document existing test data creation
2. **Gradual Migration**: Replace ad-hoc data with factory-generated data
3. **Validate Consistency**: Ensure new seeding produces expected results
4. **Performance Testing**: Verify seeding doesn't slow down tests

### Integration Steps

1. **Install Dependencies**: Ensure @faker-js/faker is available
2. **Configure Seeder**: Set up test data seeder in test setup
3. **Update Tests**: Replace manual data creation with seeded data
4. **Optimize Cache**: Configure appropriate caching strategy

## Conclusion

The Okaeri test data seeding strategy provides a robust, scalable foundation for
reliable testing across all levels of the application. By combining
deterministic data generation, intelligent caching, and Philippine-specific
business rules, it ensures that tests are both realistic and reproducible.

This approach enables confident test-driven development while maintaining the
flexibility to test complex business scenarios and edge cases specific to resort
management operations.
