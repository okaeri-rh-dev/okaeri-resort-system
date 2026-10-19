# 🔧 Utility Functions Library

## Overview

The `/src/utils/` directory contains 29 utility modules providing reusable functions for common operations throughout the Okaeri Resort System. These utilities are organized by domain and purpose, offering consistent implementations for complex business logic.

## 📁 Directory Structure

```
utils/
├── Core Utilities
│   ├── validation.ts             # Input validation utilities
│   └── loadingPerformance.ts    # Performance monitoring utilities
│
├── Date & Time
│   ├── date-helpers.ts          # Date manipulation and formatting
│   └── availability.ts          # Availability calculation utilities
│
├── Business Logic
│   ├── pricing.ts               # Pricing calculations and rules
│   ├── booking-workflow.ts      # Booking state management
│   └── reports.ts               # Report generation utilities
│
├── Search & Filter
│   ├── search.ts                # Search utilities
│   ├── search-filter.ts        # Advanced filtering logic
│   ├── search-presets.ts       # Predefined search configurations
│   └── filter-builder.ts       # Dynamic filter construction
│
├── Validation
│   ├── mobile-validation.ts    # Mobile-specific validations
│   └── performance-validator.ts # Performance validation utilities
```

## 📦 Core Modules

### `date-helpers.ts` - Date Manipulation (26KB)
**Purpose**: Comprehensive date handling utilities for bookings

**Key Functions**:
```typescript
import {
  formatDate,
  parseDate,
  calculateNights,
  getDateRange,
  isValidBookingDate,
  addBusinessDays,
  formatPhilippineTime,
  getLocalTimezone
} from '@/utils/date-helpers'

// Format dates for display
const display = formatDate(date, 'MMM dd, yyyy')

// Calculate booking duration
const nights = calculateNights(checkIn, checkOut)

// Generate date range for calendar
const dates = getDateRange(startDate, endDate)

// Philippine timezone handling
const localTime = formatPhilippineTime(utcDate)
```

### `pricing.ts` - Pricing Engine (21KB)
**Purpose**: Complex pricing calculations with seasonal rates

**Key Functions**:
```typescript
import {
  calculateTotalPrice,
  applySeasonalRate,
  calculateDeposit,
  applyDiscounts,
  calculateTaxes,
  formatCurrency
} from '@/utils/pricing'

// Calculate booking total
const total = calculateTotalPrice({
  baseRate: 5000,
  nights: 3,
  guestCount: 4,
  seasonMultiplier: 1.2,
  discounts: [{ type: 'EARLY_BIRD', value: 10 }]
})

// Format for display (Philippine Peso)
const display = formatCurrency(total, 'PHP')
```

### `availability.ts` - Availability Utilities (15KB)
**Purpose**: Availability checking and conflict detection

**Key Functions**:
```typescript
import {
  checkUnitAvailability,
  findAvailableSlots,
  hasBookingConflict,
  getBlockedDates,
  calculateOccupancy
} from '@/utils/availability'

// Check availability for date range
const available = await checkUnitAvailability(
  unitId,
  dateRange
)

// Find next available slot
const nextSlot = await findAvailableSlots(unitId, {
  duration: 3,
  startingFrom: new Date()
})

// Calculate occupancy rate
const occupancy = calculateOccupancy(bookings, period)
```

### `validation.ts` - Input Validation (25KB)
**Purpose**: Comprehensive validation utilities

**Key Functions**:
```typescript
import {
  validateEmail,
  validatePhone,
  validateBooking,
  validatePayment,
  sanitizeInput,
  validateFileUpload,
  validateGuestCount
} from '@/utils/validation'

// Validate Philippine phone number
const isValid = validatePhone('+639123456789')

// Validate booking data
const errors = validateBooking({
  checkIn,
  checkOut,
  guestCount,
  unitType
})

// Sanitize user input
const safe = sanitizeInput(userInput, {
  maxLength: 500,
  allowHTML: false
})
```

### `booking-workflow.ts` - Workflow Management (20KB)
**Purpose**: Booking state transitions and workflow rules

**Key Functions**:
```typescript
import {
  getNextStatus,
  canTransitionTo,
  validateStatusChange,
  getRequiredActions,
  executeWorkflow
} from '@/utils/booking-workflow'

// Get valid next states
const nextStates = getNextStatus('confirmed')

// Validate state transition
const canProceed = canTransitionTo(
  booking,
  'checked_in'
)

// Get required actions for transition
const actions = getRequiredActions(
  'pending',
  'confirmed'
)
```

### `search-filter.ts` - Advanced Filtering (19KB)
**Purpose**: Dynamic search and filter construction

**Key Functions**:
```typescript
import {
  buildSearchQuery,
  applyFilters,
  combineFilters,
  parseSearchParams,
  createFilterPreset
} from '@/utils/search-filter'

// Build complex search query
const query = buildSearchQuery({
  text: 'deluxe',
  filters: {
    status: ['available'],
    priceRange: [5000, 10000],
    amenities: ['wifi', 'pool']
  }
})

// Apply filters to dataset
const filtered = applyFilters(items, filters)
```

### `reports.ts` - Report Generation (12KB)
**Purpose**: Data aggregation and report utilities

**Key Functions**:
```typescript
import {
  generateOccupancyReport,
  calculateRevenue,
  getBookingStatistics,
  exportToCSV,
  generateFinancialSummary
} from '@/utils/reports'

// Generate monthly report
const report = await generateOccupancyReport({
  month: 'January',
  year: 2024
})

// Export data to CSV
const csv = exportToCSV(bookings, {
  columns: ['date', 'guest', 'amount'],
  dateFormat: 'MM/DD/YYYY'
})
```

### `mobile-validation.ts` - Mobile UX Utilities (13KB)
**Purpose**: Mobile-specific validations and optimizations

**Key Functions**:
```typescript
import {
  isMobileDevice,
  validateMobileInput,
  optimizeForMobile,
  detectOrientation,
  handleMobileGestures
} from '@/utils/mobile-validation'

// Detect mobile device
if (isMobileDevice()) {
  optimizeForMobile(component)
}

// Validate mobile-friendly input
const valid = validateMobileInput(input, {
  allowAutoComplete: true,
  numericKeyboard: true
})
```

### `performance-validator.ts` - Performance Monitoring (13KB)
**Purpose**: Performance validation and optimization

**Key Functions**:
```typescript
import {
  measurePerformance,
  validateLoadTime,
  checkMemoryUsage,
  optimizeQuery,
  createPerformanceReport
} from '@/utils/performance-validator'

// Measure operation performance
const metrics = measurePerformance(() => {
  // Complex operation
})

// Validate page load time
const isAcceptable = validateLoadTime(metrics, {
  threshold: 3000 // 3 seconds
})
```

## 🏗️ Usage Patterns

### Error-Safe Pattern
All utilities follow error-safe patterns:
```typescript
// Utilities return safe defaults on error
const result = calculatePrice(data) || 0
const formatted = formatDate(date) || 'Invalid Date'
```

### Composable Functions
Utilities are designed to be composable:
```typescript
// Combine multiple utilities
const processBooking = flow(
  validateBooking,
  calculatePricing,
  applyDiscounts,
  formatForDisplay
)
```

### Type Safety
All utilities are fully typed:
```typescript
// TypeScript provides auto-completion and type checking
const result: BookingValidation = validateBooking(data)
if (result.success) {
  // result.data is typed
}
```

## 🚀 Best Practices

1. **Import Specific Functions**: Import only what you need
   ```typescript
   import { formatDate, calculateNights } from '@/utils/date-helpers'
   ```

2. **Handle Edge Cases**: Utilities handle null/undefined gracefully
   ```typescript
   formatDate(null) // Returns 'N/A' or safe default
   ```

3. **Use Constants**: Leverage exported constants
   ```typescript
   import { DATE_FORMAT, TIMEZONE } from '@/utils/date-helpers'
   ```

4. **Validate Early**: Validate inputs before processing
   ```typescript
   if (validateBooking(data).success) {
     const price = calculatePrice(data)
   }
   ```

## 🔒 Security Considerations

- All utilities sanitize inputs by default
- HTML content is escaped unless explicitly allowed
- File uploads are validated for type and size
- SQL injection prevented through parameterization

## 📊 Performance Notes

- Date utilities use memoization for expensive operations
- Search filters are optimized for large datasets
- Report generation uses streaming for large exports
- Mobile utilities implement lazy loading

## 📚 Related Documentation

- [Component Documentation](/src/components/README.md) - Components using these utilities
- [Hooks Documentation](/src/hooks/README.md) - Hooks built on these utilities
- [Type Definitions](/src/types/README.md) - Type definitions for utility functions
- [Validation Library](/src/lib/validations.ts) - Core validation schemas

## 🔧 Testing

Each utility module has corresponding tests:
```bash
# Run tests for specific utility
npm test utils/date-helpers

# Run all utility tests
npm test utils/
```

## 🎯 Module Dependency Graph

```
pricing.ts ──┐
            ├──> validation.ts ──> index.ts
date-helpers.ts ─┘

availability.ts ──> date-helpers.ts

search-filter.ts ──> filter-builder.ts ──> search-presets.ts
```