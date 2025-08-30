# Deterministic Mock Services Implementation

## Problem Fixed

The mock services were using `Math.random()` causing non-deterministic tests
with a 5% failure rate. This created unreliable CI/CD runs and made debugging
difficult.

## Solution Overview

Implemented deterministic configuration system that eliminates `Math.random()`
usage and provides seeded pseudo-random number generation for consistent test
behavior.

## Files Modified

### 1. Created New Utilities (`/src/lib/test-utils.ts`)

**Key Components:**

- **Environment-aware Base64 utilities**: Work in both browser and Node.js
  environments
- **SeededRandom class**: Deterministic pseudo-random number generator using
  Linear Congruential Generator (LCG)
- **DeterministicDelay class**: Consistent timing behavior for tests
- **DeterministicErrorSimulator**: Predictable error simulation
- **MockTokenGenerator**: Deterministic JWT-like token generation
- **MockServiceUtils**: Unified utilities for all mock services

**Features:**

- Deterministic random number generation with string seeds
- Environment-aware base64 encoding/decoding (Node.js + browser)
- Configurable error rates and network delays
- Token generation that's consistent across test runs
- Comprehensive error simulation scenarios

### 2. Updated Auth Mock Service (`/src/services/mock/auth.mock.service.ts`)

**Changes:**

- Replaced all `Math.random()` calls with seeded random generation
- Replaced `btoa/atob` with environment-aware base64 utilities
- Added configuration parameter to constructor
- Implemented `executeWithSimulation()` pattern for consistent behavior
- Added configuration update methods for testing
- Added proper error scenario simulation

**Before:**

```typescript
async function simulateDelay(
  minMs: number = 200,
  maxMs: number = 800
): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

async function simulateNetworkError(
  errorRate: number = 0.05
): Promise<boolean> {
  return Math.random() < errorRate;
}
```

**After:**

```typescript
return this.utils.executeWithSimulation(
  async () => {
    // Business logic here
  },
  this.DELAY_MS.min,
  this.DELAY_MS.max,
  "networkError"
);
```

### 3. Updated Booking Mock Service (`/src/services/mock/booking.mock.service.ts`)

**Changes:**

- Same deterministic patterns as auth service
- Replaced `Math.random()` with seeded generation
- Added configuration support
- Implemented consistent error simulation
- Added reset functionality for test isolation

### 4. Updated Service Registry (`/src/services/registry.ts`)

**Changes:**

- Added `MockServiceConfig` support in `ServiceFactoryOptions`
- Pass deterministic configuration to mock service constructors
- Enhanced logging for configuration debugging
- Proper fallback configuration handling

### 5. Updated Service Factory (`/src/services/service.factory.ts`)

**Changes:**

- Added `mockConfig` parameter to `ServiceFactoryOptions`
- Automatic environment-based configuration selection
- Enhanced logging for mock service creation
- Proper configuration passing to constructors

### 6. Created Comprehensive Tests (`/src/test/mock-services-deterministic.test.ts`)

**Test Coverage:**

- Token generation consistency
- Error rate stability
- Configuration updates
- Reset functionality
- Deterministic error simulation
- Performance consistency validation

## Configuration Examples

### Stable Testing (Unit Tests)

```typescript
const stableConfig = {
  deterministic: true,
  errorRate: 0,
  networkDelay: { min: 0, max: 10 },
  seed: "stable-test-seed",
  forceScenarios: [],
};
```

### Realistic Testing (Integration Tests)

```typescript
const realisticConfig = {
  deterministic: true,
  errorRate: 0.05,
  networkDelay: { min: 100, max: 300 },
  seed: "realistic-test-seed",
  forceScenarios: [],
};
```

### Error-focused Testing

```typescript
const errorConfig = {
  deterministic: true,
  errorRate: 1.0,
  networkDelay: { min: 50, max: 100 },
  seed: "error-test-seed",
  forceScenarios: ["networkError", "validationError"],
};
```

## Benefits Achieved

### ✅ **Eliminates Non-deterministic Failures**

- No more 5% random test failures
- Consistent CI/CD pipeline results
- Reliable testing environment

### ✅ **Environment Compatibility**

- Works in both browser and Node.js environments
- Proper base64 handling without btoa/atob dependencies
- Cross-platform consistency

### ✅ **Enhanced Debugging**

- Reproducible error scenarios
- Seeded random generation for consistent behavior
- Configuration can be updated dynamically for testing

### ✅ **Maintainable Architecture**

- Centralized mock utilities
- Clean separation of concerns
- Backward compatibility maintained during transition

### ✅ **Comprehensive Error Simulation**

- Deterministic error rates
- Forced error scenarios for testing
- Network condition simulation

## Usage Examples

### Basic Service Creation

```typescript
import { MockAuthService } from "@/services/mock/auth.mock.service";
import { CONFIG_PRESETS } from "@/test/config/mock-service-config";

// Stable testing
const authService = new MockAuthService(CONFIG_PRESETS.UNIT_TESTS);

// Realistic conditions
const authService = new MockAuthService(CONFIG_PRESETS.E2E_TESTS);
```

### Dynamic Configuration Updates

```typescript
const service = new MockAuthService(stableConfig);

// Update for error testing
service.updateConfig({
  ...stableConfig,
  errorRate: 0.5,
  forceScenarios: ["networkError"],
});
```

### Service Registry Integration

```typescript
import { ServiceRegistry } from "@/services/registry";

const authService = await ServiceRegistry.auth({
  mockConfig: CONFIG_PRESETS.INTEGRATION_TESTS,
});
```

## Impact on Test Reliability

### Before

- ❌ 5% random test failures
- ❌ Non-reproducible errors
- ❌ CI/CD pipeline instability
- ❌ Time-dependent behavior

### After

- ✅ 0% random failures with stable configuration
- ✅ Fully reproducible test scenarios
- ✅ Stable CI/CD pipelines
- ✅ Deterministic behavior across runs

## Migration Notes

### Backward Compatibility

- Existing mock service calls continue to work
- Configuration is optional (falls back to environment defaults)
- Gradual migration path available

### Breaking Changes

- **None** - All changes are additive and backward compatible
- Existing tests continue to work without modification

### Recommended Updates

1. Update service creation to use configuration:

   ```typescript
   // Old way (still works)
   const service = new MockAuthService();

   // New way (recommended)
   const service = new MockAuthService(CONFIG_PRESETS.UNIT_TESTS);
   ```

2. Use service registry with mock configuration:
   ```typescript
   const service = await ServiceRegistry.auth({
     mockConfig: CONFIG_PRESETS.INTEGRATION_TESTS,
   });
   ```

## Configuration Reference

See `/src/test/config/mock-service-config.ts` for:

- `TEST_SCENARIOS` - Predefined configuration scenarios
- `CONFIG_PRESETS` - Ready-to-use configurations for different test types
- `ERROR_SCENARIOS` - Standardized error simulation scenarios
- `MockConfigBuilder` - Fluent API for custom configurations

## Summary

This implementation completely eliminates the non-deterministic behavior that
was causing 5% test failures. All mock services now use seeded pseudo-random
number generation, environment-aware utilities, and configurable behavior
patterns. The solution is backward compatible, fully tested, and provides a
solid foundation for reliable testing across all environments.
