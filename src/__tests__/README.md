# 🧪 Testing Strategy Documentation

## Overview

The Okaeri Resort System implements **comprehensive test coverage** across unit, integration, E2E, performance, and security testing. This multi-layered testing approach ensures code quality, security, performance, and reliability while maintaining confidence in deployments.

Testing stack: **Vitest** (unit/integration), **Playwright** (E2E), custom utilities for performance and security testing.

## 🏗️ Test Architecture

```
__tests__/
├── e2e/                          # End-to-end tests (Playwright)
│   └── guest-booking-flow.test.ts    # Complete booking workflow
├── performance/                  # Performance benchmarks
│   └── file-processing.test.ts       # File upload performance
├── security/                     # Security validation tests
│   ├── auth-security.test.ts         # Authentication security
│   └── xss-prevention.test.tsx       # XSS prevention tests
└── (component tests)             # Distributed alongside components
```

## 📊 Test Coverage Requirements

### Coverage Targets

| Category | Target | Current |
|----------|--------|---------|
| Overall | 80% | ~75% |
| Critical paths | 100% | 95% |
| Security utilities | 100% | 100% |
| API endpoints | 90% | 85% |
| UI components | 70% | 65% |

### Critical Paths (100% Coverage Required)

- Payment processing
- Booking creation
- Guest authentication
- Input sanitization
- Availability checking
- Audit logging
- Rate limiting

## 🎯 Testing Layers

### 1. Unit Tests

**Purpose**: Test individual functions and components in isolation.

**Location**: Alongside source files (`*.test.ts`, `*.test.tsx`)

```typescript
// src/utils/__tests__/pricing.test.ts
describe('calculatePricing', () => {
  it('calculates base rate correctly', () => {
    const result = calculatePricing(unit, {
      checkIn: new Date('2024-12-20'),
      checkOut: new Date('2024-12-22'),  // 2 nights
      guestCount: 2
    })

    expect(result.baseRate).toBe(2000)
    expect(result.totalAmount).toBe(4000)  // 2 nights × ₱2000
  })

  it('adds weekend surcharge', () => {
    const result = calculatePricing(unit, {
      checkIn: new Date('2024-12-20'),  // Friday
      checkOut: new Date('2024-12-22'),  // Sunday
      guestCount: 2
    })

    // Friday: ₱2000, Saturday: ₱2500 (weekend)
    expect(result.totalAmount).toBe(4500)
  })

  it('adds extra person charges', () => {
    const unit = { base_occupancy: 2, extra_person_rate: 500 }
    const result = calculatePricing(unit, {
      checkIn: new Date('2024-12-20'),
      checkOut: new Date('2024-12-22'),  // 2 nights
      guestCount: 4  // 2 extra persons
    })

    // Base: 2 nights × ₱2000 = ₱4000
    // Extra: 2 persons × ₱500 × 2 nights = ₱2000
    expect(result.totalAmount).toBe(6000)
  })
})
```

### 2. Integration Tests

**Purpose**: Test component interactions and data flow.

```typescript
// src/components/bookings/__tests__/BookingForm.integration.test.tsx
describe('BookingForm Integration', () => {
  it('creates booking with all steps', async () => {
    const { user } = renderWithProviders(<BookingForm />)

    // Step 1: Unit Selection
    await user.selectOptions(screen.getByLabelText(/unit/i), 'unit-1')
    await user.click(screen.getByLabelText(/check-in/i))
    // ... select dates
    await user.click(screen.getByText(/next/i))

    // Step 2: Guest Information
    await user.type(screen.getByLabelText(/name/i), 'John Doe')
    await user.type(screen.getByLabelText(/email/i), 'john@example.com')
    await user.click(screen.getByText(/next/i))

    // Step 3: Payment Details
    await user.selectOptions(screen.getByLabelText(/payment/i), 'cash')
    await user.click(screen.getByText(/next/i))

    // Step 4: Review & Confirm
    expect(screen.getByText(/john doe/i)).toBeInTheDocument()
    await user.click(screen.getByText(/confirm/i))

    // Verify API call
    await waitFor(() => {
      expect(mockCreateBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          guest_name: 'John Doe',
          unit_id: 'unit-1'
        })
      )
    })
  })
})
```

### 3. End-to-End Tests (E2E)

**Purpose**: Test complete user workflows in browser environment.

**Tool**: Playwright

```typescript
// src/__tests__/e2e/guest-booking-flow.test.ts
import { test, expect } from '@playwright/test'

test('complete guest booking flow', async ({ page }) => {
  await page.goto('/guest-booking')

  // Fill booking form
  await page.fill('[name="guest_name"]', 'John Doe')
  await page.fill('[name="email"]', 'john@example.com')
  await page.fill('[name="phone_number"]', '+63 912 345 6789')

  // Select unit
  await page.selectOption('[name="unit_id"]', 'beach-cottage')

  // Select dates
  await page.click('[aria-label="check-in"]')
  await page.click('[aria-label="Dec 20, 2024"]')
  await page.click('[aria-label="Dec 22, 2024"]')

  // Upload payment proof
  await page.setInputFiles('[type="file"]', 'tests/fixtures/receipt.jpg')

  // Complete Turnstile (mocked in test environment)
  await page.waitForSelector('[data-turnstile-verified]')

  // Submit form
  await page.click('button[type="submit"]')

  // Verify success
  await expect(page.locator('text=Booking Confirmed')).toBeVisible()
  await expect(page.locator('[data-booking-reference]')).toHaveText(/BKG-2024-/)
})

test('prevents double submission', async ({ page }) => {
  await page.goto('/guest-booking')

  // Fill and submit form
  await fillBookingForm(page)
  await page.click('button[type="submit"]')

  // Try submitting again immediately
  await page.click('button[type="submit"]')

  // Verify only one booking created
  const bookingRefs = await page.locator('[data-booking-reference]').count()
  expect(bookingRefs).toBe(1)
})
```

### 4. Performance Tests

**Purpose**: Ensure acceptable performance under various conditions.

```typescript
// src/__tests__/performance/file-processing.test.ts
describe('File Upload Performance', () => {
  it('compresses large images within 2 seconds', async () => {
    const largeImage = generateLargeImage(5 * 1024 * 1024)  // 5MB

    const startTime = performance.now()
    const compressed = await compressAndValidateFile(largeImage)
    const duration = performance.now() - startTime

    expect(duration).toBeLessThan(2000)  // 2 seconds
    expect(compressed.size).toBeLessThan(500 * 1024)  // < 500KB
  })

  it('handles concurrent uploads efficiently', async () => {
    const files = Array.from({ length: 10 }, () => generateImage(1024 * 1024))

    const startTime = performance.now()
    await Promise.all(files.map(file => compressAndValidateFile(file)))
    const duration = performance.now() - startTime

    expect(duration).toBeLessThan(5000)  // 5 seconds for 10 files
  })

  it('renders large booking table without lag', async () => {
    const bookings = generateBookings(1000)

    const startTime = performance.now()
    render(<BookingsTable data={bookings} />)
    const renderTime = performance.now() - startTime

    expect(renderTime).toBeLessThan(500)  // 500ms
  })
})
```

### 5. Security Tests

**Purpose**: Validate security measures and prevent vulnerabilities.

```typescript
// src/__tests__/security/xss-prevention.test.tsx
describe('XSS Prevention', () => {
  it('sanitizes malicious script tags', () => {
    const malicious = '<script>alert("XSS")</script>Normal text'
    const sanitized = sanitizeInput(malicious)

    expect(sanitized).not.toContain('<script>')
    expect(sanitized).toContain('Normal text')
  })

  it('escapes dangerous attributes', () => {
    const malicious = '<img src=x onerror="alert(1)">'
    const sanitized = sanitizeHTML(malicious, { ALLOWED_TAGS: ['img'] })

    expect(sanitized).not.toContain('onerror')
  })

  it('prevents formula injection in CSV export', () => {
    const malicious = [
      { name: '=1+1', email: 'test@example.com' },
      { name: '@SUM(A1:A10)', email: 'test2@example.com' }
    ]

    const csv = exportToCSV(malicious, 'test')

    expect(csv).toContain("'=1+1")  // Escaped with single quote
    expect(csv).toContain("'@SUM")  // Escaped with single quote
  })
})

// src/__tests__/security/auth-security.test.ts
describe('Authentication Security', () => {
  it('blocks unauthenticated access to protected routes', async () => {
    const response = await fetch('/api/admin/bookings')

    expect(response.status).toBe(401)
  })

  it('validates JWT tokens', async () => {
    const invalidToken = 'invalid.jwt.token'
    const response = await fetch('/api/admin/bookings', {
      headers: { Authorization: `Bearer ${invalidToken}` }
    })

    expect(response.status).toBe(401)
  })

  it('enforces rate limiting', async () => {
    // Make 6 requests (limit is 5/hour)
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        fetch('/api/guest-booking', { method: 'POST', body: mockData })
      )
    )

    const last = responses[responses.length - 1]
    expect(last.status).toBe(429)
    expect(last.headers.get('Retry-After')).toBeTruthy()
  })
})
```

## 🛠️ Test Utilities

### Custom Render Helpers

```typescript
// src/test-utils.tsx
export function renderWithProviders(
  ui: React.ReactElement,
  options?: RenderOptions
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...options }),
    queryClient,
  }
}
```

### Mock Data Generators

```typescript
// src/test-utils/factories.ts
export function generateBooking(overrides = {}): Booking {
  return {
    booking_id: faker.string.uuid(),
    booking_reference: `BKG-2024-${faker.string.numeric(3)}`,
    guest_name: faker.person.fullName(),
    email: faker.internet.email(),
    contact_number: '+63 912 345 6789',
    unit_id: faker.string.uuid(),
    check_in: faker.date.future(),
    check_out: faker.date.future(),
    num_guests: faker.number.int({ min: 1, max: 10 }),
    total_amount: faker.number.int({ min: 2000, max: 10000 }),
    status: 'confirmed',
    ...overrides,
  }
}

export function generateBookings(count: number): Booking[] {
  return Array.from({ length: count }, () => generateBooking())
}
```

## 📋 Running Tests

### All Tests

```bash
# Run all tests
npm test

# Run tests once (no watch)
npm run test:run

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run performance tests
npm run test:performance

# Run security tests
npm run test:security
```

### Specific Tests

```bash
# Run specific file
npx vitest run src/components/bookings/__tests__/BookingForm.test.tsx

# Run by pattern
npx vitest run --grep "payment"

# Run with UI
npm run test:ui

# Run in debug mode
npx vitest --inspect
```

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
open coverage/index.html
```

## 🎯 Testing Best Practices

### 1. Test Organization

```typescript
describe('ComponentName', () => {
  describe('rendering', () => {
    it('displays initial state correctly', () => {})
    it('shows loading state', () => {})
  })

  describe('interactions', () => {
    it('handles button click', () => {})
    it('submits form with valid data', () => {})
  })

  describe('edge cases', () => {
    it('handles empty data', () => {})
    it('recovers from errors', () => {})
  })
})
```

### 2. Arrange-Act-Assert Pattern

```typescript
it('creates booking successfully', async () => {
  // Arrange: Set up test data and mocks
  const mockData = generateBooking()
  const mockCreateBooking = jest.fn()

  // Act: Perform the action
  render(<BookingForm onSuccess={mockCreateBooking} />)
  await fillAndSubmitForm(mockData)

  // Assert: Verify the results
  expect(mockCreateBooking).toHaveBeenCalledWith(
    expect.objectContaining({ guest_name: mockData.guest_name })
  )
})
```

### 3. Test Independence

```typescript
// ❌ Bad: Tests depend on each other
it('creates booking', () => {
  booking = createBooking(data)
})

it('updates booking', () => {
  updateBooking(booking.id, updates)  // Depends on previous test
})

// ✅ Good: Each test is independent
it('creates booking', () => {
  const booking = createBooking(data)
  expect(booking).toBeDefined()
})

it('updates booking', () => {
  const booking = createBooking(data)  // Create fresh data
  const updated = updateBooking(booking.id, updates)
  expect(updated).toBeDefined()
})
```

### 4. Mock External Dependencies

```typescript
// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        data: mockBookings,
        error: null
      }))
    }))
  }
}))

// Mock Turnstile
vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({ onSuccess }: any) => {
    onSuccess('mock-token')
    return <div data-testid="turnstile-mock" />
  }
}))
```

## 📚 Related Documentation

- [Validation Utilities](/src/lib/validation/README.md) - Input validation testing
- Security Guidelines: vault note [[security README]]
- [API Endpoints](/functions/api/README.md) - API integration testing
- [Component Documentation](/src/components/README.md) - Component testing examples

## 🔧 CI/CD Integration

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:coverage
      - run: npm run test:e2e
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

## 📈 Coverage Requirements

### Pre-commit Checks

```bash
# Run before committing
npm run verify

# Includes:
# - Type checking
# - Linting
# - Unit tests
# - Coverage threshold check (80%)
```

### Pull Request Requirements

- ✅ All tests passing
- ✅ Coverage >= 80%
- ✅ No security vulnerabilities
- ✅ Performance benchmarks met
- ✅ E2E tests passing

## 🚨 Common Testing Pitfalls

1. ❌ Testing implementation details instead of behavior
2. ❌ Flaky tests (timing-dependent, order-dependent)
3. ❌ Overly complex mocks that don't match reality
4. ❌ Tests that don't fail when code is broken
5. ❌ Insufficient edge case coverage
6. ❌ Missing error state testing
7. ❌ No accessibility testing
8. ❌ Ignoring console warnings/errors in tests

## ✅ Testing Checklist

- [ ] Unit tests for all utilities
- [ ] Integration tests for data flows
- [ ] E2E tests for critical paths
- [ ] Performance tests for bottlenecks
- [ ] Security tests for vulnerabilities
- [ ] Accessibility tests
- [ ] Error handling tests
- [ ] Edge case coverage
- [ ] Mock external dependencies
- [ ] Test independence verified
- [ ] Coverage >= 80%
- [ ] All tests passing
