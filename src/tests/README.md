# 🧪 Testing Suite

## Overview

The `/src/tests/` directory contains comprehensive test suites for the Okaeri Resort System, focusing on mobile responsiveness, security validation, and critical business logic testing.

## 📁 Directory Structure

```
tests/
├── mobile-responsive.test.tsx   # Mobile UI testing (17.3KB)
├── security-validation.test.ts  # Security testing (11KB)
└── README.md                    # This file
```

## 📦 Test Suites

### `mobile-responsive.test.tsx` - Mobile UI Testing
**Purpose**: Comprehensive testing for mobile and responsive design

**Test Coverage**:
```typescript
describe('Mobile Responsive Tests', () => {
  describe('Viewport Testing', () => {
    test.each([
      { device: 'iPhone SE', width: 375, height: 667 },
      { device: 'iPhone 12', width: 390, height: 844 },
      { device: 'Samsung Galaxy S20', width: 412, height: 915 },
      { device: 'iPad', width: 768, height: 1024 },
    ])('renders correctly on $device', async ({ width, height }) => {
      window.resizeTo(width, height)

      const { container } = render(<App />)

      // Test responsive layout
      expect(container.querySelector('.mobile-menu')).toBeInTheDocument()
      expect(container.querySelector('.desktop-sidebar')).not.toBeInTheDocument()

      // Test touch interactions
      const menuButton = screen.getByRole('button', { name: /menu/i })
      fireEvent.touchStart(menuButton)
      fireEvent.touchEnd(menuButton)

      expect(screen.getByRole('navigation')).toBeVisible()
    })
  })

  describe('Touch Interactions', () => {
    test('handles swipe gestures', async () => {
      const { getByTestId } = render(<BookingCalendar />)
      const calendar = getByTestId('calendar-container')

      // Simulate swipe left
      fireEvent.touchStart(calendar, {
        touches: [{ clientX: 300, clientY: 200 }]
      })
      fireEvent.touchMove(calendar, {
        touches: [{ clientX: 100, clientY: 200 }]
      })
      fireEvent.touchEnd(calendar)

      // Verify month changed
      expect(screen.getByText('Next Month')).toBeInTheDocument()
    })

    test('handles pinch-to-zoom', async () => {
      const { getByTestId } = render(<UnitImage />)
      const image = getByTestId('zoomable-image')

      // Simulate pinch gesture
      const touch1 = { identifier: 1, clientX: 100, clientY: 100 }
      const touch2 = { identifier: 2, clientX: 200, clientY: 200 }

      fireEvent.touchStart(image, { touches: [touch1, touch2] })

      // Spread fingers apart (zoom in)
      fireEvent.touchMove(image, {
        touches: [
          { ...touch1, clientX: 50, clientY: 50 },
          { ...touch2, clientX: 250, clientY: 250 }
        ]
      })

      expect(image).toHaveStyle({ transform: 'scale(1.5)' })
    })
  })

  describe('Responsive Forms', () => {
    test('adjusts form layout for mobile', () => {
      window.resizeTo(375, 667)

      const { container } = render(<BookingForm />)

      // Forms stack vertically on mobile
      const formGroups = container.querySelectorAll('.form-group')
      formGroups.forEach(group => {
        expect(group).toHaveStyle({ width: '100%' })
      })

      // Input font size is larger for mobile
      const inputs = container.querySelectorAll('input')
      inputs.forEach(input => {
        const styles = getComputedStyle(input)
        expect(parseInt(styles.fontSize)).toBeGreaterThanOrEqual(16)
      })
    })

    test('shows mobile-optimized date picker', () => {
      window.resizeTo(375, 667)

      render(<DatePicker />)
      const dateInput = screen.getByRole('textbox', { name: /date/i })

      // Uses native date input on mobile
      expect(dateInput).toHaveAttribute('type', 'date')
    })
  })

  describe('Performance on Mobile', () => {
    test('lazy loads images on scroll', async () => {
      const { getAllByRole } = render(<UnitGallery images={mockImages} />)
      const images = getAllByRole('img')

      // Initially only first few images load
      expect(images[0]).toHaveAttribute('loading', 'eager')
      expect(images[5]).toHaveAttribute('loading', 'lazy')

      // Simulate scroll
      fireEvent.scroll(window, { target: { scrollY: 1000 } })

      await waitFor(() => {
        expect(images[5]).toHaveAttribute('src')
      })
    })

    test('virtualizes long lists', () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`
      }))

      const { container } = render(<VirtualList items={items} />)

      // Only renders visible items
      const renderedItems = container.querySelectorAll('.list-item')
      expect(renderedItems.length).toBeLessThan(50)
    })
  })

  describe('Offline Functionality', () => {
    test('shows offline indicator', async () => {
      // Simulate offline
      window.dispatchEvent(new Event('offline'))

      await waitFor(() => {
        expect(screen.getByText(/offline mode/i)).toBeInTheDocument()
      })

      // Simulate back online
      window.dispatchEvent(new Event('online'))

      await waitFor(() => {
        expect(screen.queryByText(/offline mode/i)).not.toBeInTheDocument()
      })
    })

    test('queues actions when offline', async () => {
      // Go offline
      window.navigator.onLine = false

      const { getByRole } = render(<BookingForm />)

      // Submit form while offline
      fireEvent.click(getByRole('button', { name: /submit/i }))

      // Check action queued
      expect(screen.getByText(/queued for sync/i)).toBeInTheDocument()

      // Go back online
      window.navigator.onLine = true
      window.dispatchEvent(new Event('online'))

      // Verify sync happens
      await waitFor(() => {
        expect(screen.getByText(/synced successfully/i)).toBeInTheDocument()
      })
    })
  })
})
```

### `security-validation.test.ts` - Security Testing
**Purpose**: Validate security measures and input sanitization

**Test Coverage**:
```typescript
describe('Security Validation Tests', () => {
  describe('XSS Prevention', () => {
    test('sanitizes HTML in user inputs', () => {
      const maliciousInput = '<script>alert("XSS")</script>Hello'

      const sanitized = sanitizeHTML(maliciousInput)

      expect(sanitized).toBe('Hello')
      expect(sanitized).not.toContain('<script>')
    })

    test('prevents event handler injection', () => {
      const input = '<div onclick="alert(1)">Click me</div>'

      const sanitized = sanitizeHTML(input)

      expect(sanitized).not.toContain('onclick')
      expect(sanitized).toBe('<div>Click me</div>')
    })

    test('escapes dangerous protocols', () => {
      const input = '<a href="javascript:alert(1)">Link</a>'

      const sanitized = sanitizeHTML(input)

      expect(sanitized).not.toContain('javascript:')
    })
  })

  describe('SQL Injection Prevention', () => {
    test('escapes SQL special characters', () => {
      const inputs = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM users --"
      ]

      inputs.forEach(input => {
        const safe = sanitizeSQLParameter(input)
        expect(safe).not.toContain('DROP')
        expect(safe).not.toContain('UNION')
        expect(safe).not.toContain('--')
      })
    })

    test('validates parameterized queries', () => {
      const query = buildSecureQuery(
        'SELECT * FROM bookings WHERE id = ?',
        ['123; DROP TABLE bookings']
      )

      expect(query.text).toBe('SELECT * FROM bookings WHERE id = $1')
      expect(query.values[0]).toBe('123')
    })
  })

  describe('Authentication & Authorization', () => {
    test('validates JWT tokens', async () => {
      const validToken = generateTestToken({ userId: '123', role: 'admin' })
      const invalidToken = 'invalid.token.here'

      expect(await validateToken(validToken)).toBeTruthy()
      expect(await validateToken(invalidToken)).toBeFalsy()
    })

    test('enforces role-based access', () => {
      const adminUser = { role: 'admin' }
      const regularUser = { role: 'user' }

      expect(canAccess('/admin', adminUser)).toBeTruthy()
      expect(canAccess('/admin', regularUser)).toBeFalsy()
    })

    test('prevents privilege escalation', async () => {
      const user = { id: '123', role: 'user' }

      const attempt = await updateUserRole(user.id, 'admin', user)

      expect(attempt.error).toBe('Unauthorized')
      expect(attempt.success).toBeFalsy()
    })
  })

  describe('Input Validation', () => {
    test('validates email format', () => {
      const validEmails = [
        'user@example.com',
        'test.user+tag@domain.co.uk'
      ]

      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user@.com'
      ]

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBeTruthy()
      })

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBeFalsy()
      })
    })

    test('validates Philippine phone numbers', () => {
      const validNumbers = [
        '+639123456789',
        '09123456789',
        '639123456789'
      ]

      const invalidNumbers = [
        '123456789',
        '+1234567890',
        'notanumber'
      ]

      validNumbers.forEach(number => {
        expect(validatePhilippinePhone(number)).toBeTruthy()
      })

      invalidNumbers.forEach(number => {
        expect(validatePhilippinePhone(number)).toBeFalsy()
      })
    })
  })

  describe('File Upload Security', () => {
    test('validates file types', () => {
      const allowedFile = new File([''], 'image.jpg', { type: 'image/jpeg' })
      const maliciousFile = new File([''], 'script.exe', { type: 'application/x-executable' })

      expect(validateFileType(allowedFile)).toBeTruthy()
      expect(validateFileType(maliciousFile)).toBeFalsy()
    })

    test('checks file size limits', () => {
      const smallFile = new File(['x'.repeat(1000)], 'small.jpg')
      const largeFile = new File(['x'.repeat(10000000)], 'large.jpg')

      expect(validateFileSize(smallFile, 5 * 1024 * 1024)).toBeTruthy()
      expect(validateFileSize(largeFile, 5 * 1024 * 1024)).toBeFalsy()
    })

    test('verifies magic bytes', async () => {
      // Create fake JPEG with correct magic bytes
      const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF])
      const jpegFile = new File([jpegBytes], 'image.jpg', { type: 'image/jpeg' })

      // Create fake executable disguised as image
      const exeBytes = new Uint8Array([0x4D, 0x5A]) // MZ header
      const fakeImage = new File([exeBytes], 'image.jpg', { type: 'image/jpeg' })

      expect(await verifyMagicBytes(jpegFile)).toBeTruthy()
      expect(await verifyMagicBytes(fakeImage)).toBeFalsy()
    })
  })

  describe('Rate Limiting', () => {
    test('limits API requests', async () => {
      const results = []

      // Make 10 rapid requests
      for (let i = 0; i < 10; i++) {
        results.push(await makeAPIRequest('/api/bookings'))
      }

      // First 5 should succeed
      expect(results.slice(0, 5).every(r => r.status === 200)).toBeTruthy()

      // Later requests should be rate limited
      expect(results.slice(5).some(r => r.status === 429)).toBeTruthy()
    })

    test('implements exponential backoff', async () => {
      const attempts = []

      for (let i = 0; i < 3; i++) {
        const start = Date.now()
        await retryWithBackoff(() => Promise.reject(), i)
        const duration = Date.now() - start
        attempts.push(duration)
      }

      // Each retry should take longer
      expect(attempts[1]).toBeGreaterThan(attempts[0])
      expect(attempts[2]).toBeGreaterThan(attempts[1])
    })
  })
})
```

## 🧪 Test Utilities

### Mobile Testing Helpers
```typescript
// Test utilities for mobile testing
export const mobileTestUtils = {
  setViewport: (width: number, height: number) => {
    window.resizeTo(width, height)
    window.dispatchEvent(new Event('resize'))
  },

  simulateTouch: (element: Element, type: 'start' | 'move' | 'end', x: number, y: number) => {
    fireEvent[`touch${type.charAt(0).toUpperCase()}${type.slice(1)}`](element, {
      touches: [{ clientX: x, clientY: y }]
    })
  },

  simulateSwipe: (element: Element, direction: 'left' | 'right' | 'up' | 'down') => {
    const start = { x: 150, y: 150 }
    const end = {
      x: direction === 'left' ? 50 : direction === 'right' ? 250 : 150,
      y: direction === 'up' ? 50 : direction === 'down' ? 250 : 150
    }

    this.simulateTouch(element, 'start', start.x, start.y)
    this.simulateTouch(element, 'move', end.x, end.y)
    this.simulateTouch(element, 'end', end.x, end.y)
  },

  mockOrientation: (orientation: 'portrait' | 'landscape') => {
    Object.defineProperty(window.screen, 'orientation', {
      value: { type: orientation },
      writable: true
    })
  }
}
```

### Security Testing Helpers
```typescript
export const securityTestUtils = {
  generateMaliciousInputs: () => [
    '<script>alert("XSS")</script>',
    '"><script>alert("XSS")</script>',
    "'; DROP TABLE users; --",
    '../../../etc/passwd',
    'javascript:alert(1)',
    '<img src=x onerror=alert(1)>',
  ],

  mockAuthentication: (role: string = 'user') => {
    const token = jwt.sign({ role }, 'test-secret')
    localStorage.setItem('auth-token', token)
    return token
  },

  clearAuthentication: () => {
    localStorage.removeItem('auth-token')
    sessionStorage.clear()
  },

  simulateBruteForce: async (endpoint: string, attempts: number = 10) => {
    const results = []
    for (let i = 0; i < attempts; i++) {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          username: 'admin',
          password: `attempt${i}`
        })
      })
      results.push(res.status)
    }
    return results
  }
}
```

## 🚀 Running Tests

### Commands
```bash
# Run all tests
npm test

# Run mobile tests
npm test mobile-responsive

# Run security tests
npm test security-validation

# Run with coverage
npm run test:coverage

# Watch mode
npm test -- --watch

# Debug mode
npm test -- --inspect
```

### CI/CD Integration
```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'

      - run: npm ci
      - run: npm test
      - run: npm run test:coverage

      - uses: codecov/codecov-action@v2
        with:
          files: ./coverage/lcov.info
```

## 📊 Coverage Requirements

```javascript
// vitest.config.ts
export default {
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
      exclude: [
        'node_modules',
        'test',
        '**/*.test.{ts,tsx}',
        '**/*.config.{ts,js}'
      ]
    }
  }
}
```

## 🔧 Test Configuration

```typescript
// test-setup.ts
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  vi.clearAllMocks()
})

// Mock window.matchMedia
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})
```

## 📚 Best Practices

1. **Test Real Scenarios**: Focus on user workflows
2. **Mock External Dependencies**: Don't hit real APIs
3. **Test Edge Cases**: Include error scenarios
4. **Maintain Test Data**: Use factories for consistency
5. **Keep Tests Fast**: Optimize for quick feedback
6. **Document Complex Tests**: Add comments for clarity
7. **Review Test Coverage**: Ensure critical paths are tested