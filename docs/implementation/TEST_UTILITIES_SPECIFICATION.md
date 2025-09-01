# Test Utilities Specification

## Overview

This document specifies comprehensive test utilities for the Okaeri Resort
System, focusing on accessibility testing patterns, provider setup utilities,
and resort-specific testing contexts. All utilities ensure type safety,
Philippine business context compliance, and mobile-first accessibility
standards.

## Core Philosophy

### Testing Principles for Resort Management

1. **Accessibility-First**: Every component must pass WCAG 2.1 AA standards
2. **Mobile-Responsive**: Test on mobile viewports (resort staff use phones
   primarily)
3. **Philippine Context**: Support peso currency, GCash, and Filipino language
4. **Role-Based Access**: Test different user permission levels
5. **Offline-Ready**: Verify offline functionality and sync patterns
6. **Performance-Aware**: Test loading states and optimistic updates

### Test Coverage Requirements

```
Integration Tests (70%) → Full provider stack + user interactions
Unit Tests (20%) → Isolated utility functions and hooks
Accessibility Tests (10%) → WCAG compliance and screen reader support
```

## Test Render Utilities

### Core renderWithProviders

**Pattern**: Provide consistent test environment with all necessary providers.

```typescript
import React, { ReactElement } from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from '@tanstack/react-router';
import { ThemeProvider } from '@/components/ui/theme-provider';
import type { User, ProjectContext } from '@/types/common';

/**
 * Enhanced test render options for resort management context
 */
interface ResortTestRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial route for router testing */
  initialRoute?: string;
  /** Mock authenticated user */
  user?: User | null;
  /** Project context for multi-tenant testing */
  projectContext?: ProjectContext;
  /** Custom query client */
  queryClient?: QueryClient;
  /** Theme preference for testing */
  theme?: 'light' | 'dark' | 'system';
  /** Viewport size for responsive testing */
  viewport?: 'mobile' | 'tablet' | 'desktop';
  /** Philippine locale settings */
  locale?: 'en-PH' | 'fil-PH';
  /** Simulate offline mode */
  offline?: boolean;
  /** Mock GCash payment provider */
  mockPayments?: boolean;
}

/**
 * All providers wrapper for resort management tests
 */
export function ResortProviders({
  children,
  initialRoute = '/',
  user = null,
  projectContext,
  queryClient = createTestQueryClient(),
  theme = 'light',
  viewport = 'mobile',
  locale = 'en-PH',
  offline = false,
  mockPayments = true,
}: {
  children: React.ReactNode;
} & ResortTestRenderOptions) {

  // Set up viewport for responsive testing
  React.useEffect(() => {
    const viewportSizes = {
      mobile: { width: 375, height: 667 },
      tablet: { width: 768, height: 1024 },
      desktop: { width: 1920, height: 1080 }
    };

    const size = viewportSizes[viewport];
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: size.width,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: size.height,
    });

    // Trigger resize event
    window.dispatchEvent(new Event('resize'));
  }, [viewport]);

  // Mock auth store if user is provided
  if (user) {
    (window as any).__TEST_USER__ = user;
    (window as any).__TEST_PROJECT__ = projectContext;
  }

  // Mock offline status
  if (offline) {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  }

  // Mock payment providers for GCash testing
  if (mockPayments) {
    (window as any).__MOCK_GCASH__ = {
      available: true,
      simulate: vi.fn(),
    };
  }

  // Set Philippine locale
  (window as any).__TEST_LOCALE__ = locale;

  // Create memory router with test routes
  const router = createMemoryRouter({
    routes: [
      {
        path: '*',
        component: () => <>{children}</>,
      },
    ],
    history: {
      initialEntries: [initialRoute],
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme={theme} storageKey="resort-ui-theme">
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * Enhanced render function for resort management components
 */
export function renderWithProviders(
  ui: ReactElement,
  options: ResortTestRenderOptions = {}
) {
  const {
    initialRoute = '/',
    user = null,
    projectContext,
    queryClient = createTestQueryClient(),
    theme = 'light',
    viewport = 'mobile',
    locale = 'en-PH',
    offline = false,
    mockPayments = true,
    ...renderOptions
  } = options;

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <ResortProviders
      initialRoute={initialRoute}
      user={user}
      projectContext={projectContext}
      queryClient={queryClient}
      theme={theme}
      viewport={viewport}
      locale={locale}
      offline={offline}
      mockPayments={mockPayments}
    >
      {children}
    </ResortProviders>
  );

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}
```

### Specialized Render Utilities

#### renderWithTheme

**Pattern**: Test components in different theme contexts.

```typescript
/**
 * Render component with specific theme for theme-aware testing
 */
export function renderWithTheme(
  ui: ReactElement,
  theme: "light" | "dark" = "light",
  options: Omit<ResortTestRenderOptions, "theme"> = {}
) {
  return renderWithProviders(ui, { ...options, theme });
}

/**
 * Test component in both light and dark themes
 */
export function renderInBothThemes(
  ui: ReactElement,
  options: ResortTestRenderOptions = {}
) {
  return {
    light: renderWithTheme(ui, "light", options),
    dark: renderWithTheme(ui, "dark", options),
  };
}
```

#### renderWithForm

**Pattern**: Test form components with React Hook Form context.

```typescript
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodSchema } from 'zod';

/**
 * Render form component with React Hook Form context
 */
export function renderWithForm<T extends Record<string, any>>(
  ui: ReactElement,
  options: {
    defaultValues?: Partial<T>;
    schema?: ZodSchema<T>;
    onSubmit?: (data: T) => void;
  } & ResortTestRenderOptions = {}
) {
  const { defaultValues, schema, onSubmit, ...renderOptions } = options;

  const FormWrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm<T>({
      defaultValues,
      resolver: schema ? zodResolver(schema) : undefined,
    });

    const handleSubmit = methods.handleSubmit(onSubmit || (() => {}));

    return (
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit}>
          {children}
        </form>
      </FormProvider>
    );
  };

  return renderWithProviders(
    <FormWrapper>{ui}</FormWrapper>,
    renderOptions
  );
}
```

#### renderWithAuth

**Pattern**: Test components with specific authentication states.

```typescript
import { createResortUser } from "@/test/factories/user.factory";

/**
 * Render component with authenticated user
 */
export function renderWithAuth(
  ui: ReactElement,
  userRole: "owner" | "manager" | "staff" = "staff",
  options: Omit<ResortTestRenderOptions, "user"> = {}
) {
  const user = createResortUser({ role: userRole });
  return renderWithProviders(ui, { ...options, user });
}

/**
 * Render component without authentication (guest state)
 */
export function renderAsGuest(
  ui: ReactElement,
  options: Omit<ResortTestRenderOptions, "user"> = {}
) {
  return renderWithProviders(ui, { ...options, user: null });
}
```

## Accessibility Testing Patterns

### Basic Accessibility Validation

**Pattern**: Ensure all components pass fundamental accessibility checks.

```typescript
import { axe, toHaveNoViolations } from "jest-axe";

// Extend Jest matchers
expect.extend(toHaveNoViolations);

/**
 * Basic accessibility test for any component
 */
export async function testAccessibility(
  ui: ReactElement,
  options: ResortTestRenderOptions = {}
) {
  const { container } = renderWithProviders(ui, options);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
  return { container, results };
}

/**
 * Test component accessibility across different themes
 */
export async function testAccessibilityInThemes(
  ui: ReactElement,
  options: ResortTestRenderOptions = {}
) {
  const results = {
    light: await testAccessibility(ui, { ...options, theme: "light" }),
    dark: await testAccessibility(ui, { ...options, theme: "dark" }),
  };
  return results;
}

/**
 * Test component accessibility on mobile viewport
 */
export async function testMobileAccessibility(
  ui: ReactElement,
  options: ResortTestRenderOptions = {}
) {
  return testAccessibility(ui, { ...options, viewport: "mobile" });
}
```

### Custom WCAG Rules for Resort Context

**Pattern**: Additional accessibility rules specific to resort management.

```typescript
/**
 * Custom accessibility configuration for resort management
 */
export const resortA11yConfig = {
  rules: {
    // Ensure currency amounts are properly labeled
    "currency-label": { enabled: true },
    // Verify payment method accessibility
    "payment-method-focus": { enabled: true },
    // Check booking status indicators
    "status-indicator-contrast": { enabled: true },
    // Verify Filipino language support
    "lang-attribute": { enabled: true, tags: ["fil-PH"] },
  },
  tags: ["wcag2a", "wcag2aa", "section508"],
};

/**
 * Run axe with resort-specific configuration
 */
export async function testResortAccessibility(
  ui: ReactElement,
  options: ResortTestRenderOptions = {}
) {
  const { container } = renderWithProviders(ui, options);
  const results = await axe(container, resortA11yConfig);
  expect(results).toHaveNoViolations();
  return { container, results };
}
```

### Focus Management Testing

**Pattern**: Test keyboard navigation and focus management.

```typescript
import userEvent from "@testing-library/user-event";

/**
 * Test tab order and focus management
 */
export async function testFocusManagement(
  ui: ReactElement,
  expectedFocusOrder: string[],
  options: ResortTestRenderOptions = {}
) {
  const user = userEvent.setup();
  renderWithProviders(ui, options);

  // Test tab navigation
  for (const selector of expectedFocusOrder) {
    await user.tab();
    const focusedElement = document.activeElement;
    expect(focusedElement).toMatch(selector);
  }
}

/**
 * Test focus trap in modal dialogs
 */
export async function testFocusTrap(
  ui: ReactElement,
  modalTrigger: string,
  options: ResortTestRenderOptions = {}
) {
  const user = userEvent.setup();
  const { container } = renderWithProviders(ui, options);

  // Open modal
  const trigger = container.querySelector(modalTrigger);
  await user.click(trigger!);

  // Test focus trap
  const modal = container.querySelector('[role="dialog"]');
  expect(modal).toBeInTheDocument();

  // Focus should be within modal
  const focusedElement = document.activeElement;
  expect(modal).toContainElement(focusedElement);
}
```

### Screen Reader Testing

**Pattern**: Verify screen reader announcements and ARIA attributes.

```typescript
/**
 * Test screen reader announcements for dynamic content
 */
export function testScreenReaderAnnouncements(
  ui: ReactElement,
  expectedAnnouncements: string[],
  options: ResortTestRenderOptions = {}
) {
  const { container } = renderWithProviders(ui, options);

  // Check for live regions
  const liveRegions = container.querySelectorAll("[aria-live]");
  expect(liveRegions.length).toBeGreaterThan(0);

  // Verify announcements
  expectedAnnouncements.forEach((announcement) => {
    expect(container).toHaveTextContent(announcement);
  });
}

/**
 * Test ARIA attributes for form validation
 */
export function testFormValidationAria(
  ui: ReactElement,
  fieldName: string,
  options: ResortTestRenderOptions = {}
) {
  const { container } = renderWithProviders(ui, options);

  const field = container.querySelector(`[name="${fieldName}"]`);
  const errorMessage = container.querySelector(`[id*="${fieldName}-error"]`);

  if (errorMessage) {
    expect(field).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining("error")
    );
    expect(field).toHaveAttribute("aria-invalid", "true");
  }
}
```

## Mobile Accessibility Considerations

### Touch Target Testing

**Pattern**: Ensure touch targets meet mobile accessibility standards.

```typescript
/**
 * Test touch target sizes for mobile accessibility
 */
export function testTouchTargets(
  ui: ReactElement,
  options: ResortTestRenderOptions = {}
) {
  const { container } = renderWithProviders(ui, {
    ...options,
    viewport: "mobile",
  });

  // Find all interactive elements
  const interactiveElements = container.querySelectorAll(
    'button, a, input, select, textarea, [role="button"], [tabindex="0"]'
  );

  interactiveElements.forEach((element) => {
    const rect = element.getBoundingClientRect();
    const minSize = 44; // WCAG AA minimum touch target size

    expect(rect.width).toBeGreaterThanOrEqual(minSize);
    expect(rect.height).toBeGreaterThanOrEqual(minSize);
  });
}

/**
 * Test gesture accessibility
 */
export async function testGestureAccessibility(
  ui: ReactElement,
  gestureAlternatives: Record<string, string>,
  options: ResortTestRenderOptions = {}
) {
  renderWithProviders(ui, { ...options, viewport: "mobile" });

  // Verify gesture alternatives exist
  Object.entries(gestureAlternatives).forEach(([gesture, alternative]) => {
    const alternativeElement = screen.getByRole("button", {
      name: alternative,
    });
    expect(alternativeElement).toBeInTheDocument();
  });
}
```

### Viewport Testing Utilities

**Pattern**: Test responsive behavior across different viewport sizes.

```typescript
/**
 * Test component across multiple viewports
 */
export function testResponsiveAccessibility(
  ui: ReactElement,
  options: ResortTestRenderOptions = {}
) {
  const viewports = ["mobile", "tablet", "desktop"] as const;
  const results: Record<string, any> = {};

  viewports.forEach((viewport) => {
    results[viewport] = renderWithProviders(ui, { ...options, viewport });

    // Verify accessibility in each viewport
    testTouchTargets(ui, { ...options, viewport });
  });

  return results;
}
```

## Philippine Language Support Testing

### Bilingual Content Testing

**Pattern**: Test English and Filipino language support.

```typescript
/**
 * Test component in both English and Filipino
 */
export function testBilingualContent(
  ui: ReactElement,
  options: ResortTestRenderOptions = {}
) {
  const english = renderWithProviders(ui, { ...options, locale: "en-PH" });
  const filipino = renderWithProviders(ui, { ...options, locale: "fil-PH" });

  return { english, filipino };
}

/**
 * Test language switching
 */
export async function testLanguageSwitching(
  ui: ReactElement,
  options: ResortTestRenderOptions = {}
) {
  const user = userEvent.setup();
  renderWithProviders(ui, options);

  // Find language switcher
  const languageSwitcher = screen.getByRole("button", { name: /language/i });
  await user.click(languageSwitcher);

  // Verify language options
  expect(screen.getByText("English")).toBeInTheDocument();
  expect(screen.getByText("Filipino")).toBeInTheDocument();
}

/**
 * Test currency formatting in Philippine context
 */
export function testPhilippineCurrency(
  ui: ReactElement,
  expectedAmount: number,
  options: ResortTestRenderOptions = {}
) {
  renderWithProviders(ui, { ...options, locale: "en-PH" });

  // Verify peso formatting
  const formattedAmount = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(expectedAmount);

  expect(screen.getByText(formattedAmount)).toBeInTheDocument();
}
```

## Component Test Helpers

### Mock Data Generators for Resort Entities

```typescript
import { faker } from "@faker-js/faker/locale/en_PH";

/**
 * Create realistic Philippine resort booking data
 */
export function createPhilippineBooking(overrides: Partial<any> = {}) {
  return {
    id: faker.string.uuid(),
    guestName: faker.person.fullName(),
    guestEmail: faker.internet.email(),
    guestPhone: faker.phone.number("+63 9## ### ####"),
    checkInDate: faker.date.future(),
    checkOutDate: faker.date.future(),
    numberOfGuests: faker.number.int({ min: 1, max: 8 }),
    numberOfChildren: faker.number.int({ min: 0, max: 4 }),
    roomType: faker.helpers.arrayElement([
      "Standard",
      "Deluxe",
      "Family Room",
      "Beach Front",
    ]),
    totalAmount: faker.number.int({ min: 2500, max: 15000 }), // Philippine peso amounts
    paymentMethod: faker.helpers.arrayElement([
      "GCash",
      "Bank Transfer",
      "Cash",
    ]),
    status: faker.helpers.arrayElement([
      "pending",
      "confirmed",
      "checked-in",
      "checked-out",
      "cancelled",
    ]),
    specialRequests: faker.lorem.sentence(),
    ...overrides,
  };
}

/**
 * Create Philippine expense data
 */
export function createPhilippineExpense(overrides: Partial<any> = {}) {
  return {
    id: faker.string.uuid(),
    description: faker.helpers.arrayElement([
      "Utility Bills - Electricity",
      "Food Supplies",
      "Maintenance - Pool Cleaning",
      "Staff Salaries",
      "Marketing - Facebook Ads",
      "Transportation - Jeepney Fare",
    ]),
    amount: faker.number.int({ min: 500, max: 25000 }),
    category: faker.helpers.arrayElement([
      "Utilities",
      "Food",
      "Maintenance",
      "Payroll",
      "Marketing",
      "Transportation",
    ]),
    date: faker.date.recent(),
    paymentMethod: faker.helpers.arrayElement([
      "GCash",
      "Cash",
      "Bank Transfer",
    ]),
    receipt: faker.image.url(),
    ...overrides,
  };
}

/**
 * Create Philippine user with resort context
 */
export function createResortUser(overrides: Partial<any> = {}) {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    phone: faker.phone.number("+63 9## ### ####"),
    role: faker.helpers.arrayElement(["owner", "manager", "staff"]),
    permissions: ["bookings.view", "expenses.create"],
    lastLogin: faker.date.recent(),
    ...overrides,
  };
}
```

### User Event Helpers for Common Interactions

```typescript
/**
 * Fill booking form with Philippine data
 */
export async function fillBookingForm(
  data: ReturnType<typeof createPhilippineBooking>
) {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText(/guest name/i), data.guestName);
  await user.type(screen.getByLabelText(/email/i), data.guestEmail);
  await user.type(screen.getByLabelText(/phone/i), data.guestPhone);
  await user.type(
    screen.getByLabelText(/check-in/i),
    data.checkInDate.toISOString().split("T")[0]
  );
  await user.type(
    screen.getByLabelText(/check-out/i),
    data.checkOutDate.toISOString().split("T")[0]
  );
  await user.clear(screen.getByLabelText(/guests/i));
  await user.type(
    screen.getByLabelText(/guests/i),
    data.numberOfGuests.toString()
  );

  // Select payment method
  const paymentSelect = screen.getByLabelText(/payment method/i);
  await user.click(paymentSelect);
  await user.click(screen.getByText(data.paymentMethod));
}

/**
 * Fill expense form with Philippine business data
 */
export async function fillExpenseForm(
  data: ReturnType<typeof createPhilippineExpense>
) {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText(/description/i), data.description);
  await user.clear(screen.getByLabelText(/amount/i));
  await user.type(screen.getByLabelText(/amount/i), data.amount.toString());

  // Select category
  const categorySelect = screen.getByLabelText(/category/i);
  await user.click(categorySelect);
  await user.click(screen.getByText(data.category));

  // Select payment method
  const paymentSelect = screen.getByLabelText(/payment method/i);
  await user.click(paymentSelect);
  await user.click(screen.getByText(data.paymentMethod));
}

/**
 * Simulate GCash payment flow
 */
export async function simulateGCashPayment(amount: number) {
  const user = userEvent.setup();

  // Select GCash payment method
  const paymentSelect = screen.getByLabelText(/payment method/i);
  await user.click(paymentSelect);
  await user.click(screen.getByText("GCash"));

  // Verify amount display in peso
  const formattedAmount = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
  expect(screen.getByText(formattedAmount)).toBeInTheDocument();

  // Mock GCash API response
  (window as any).__MOCK_GCASH__?.simulate({ success: true, amount });
}
```

### Viewport Testing Utilities

```typescript
/**
 * Test component at different viewport sizes
 */
export function createViewportTest(ui: ReactElement, testName: string) {
  const viewports = [
    { name: "mobile", width: 375, height: 667 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1920, height: 1080 },
  ];

  return viewports.map(({ name, width, height }) => ({
    name: `${testName} - ${name}`,
    test: () => {
      // Set viewport
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        value: width,
      });
      Object.defineProperty(window, "innerHeight", {
        writable: true,
        value: height,
      });
      window.dispatchEvent(new Event("resize"));

      return renderWithProviders(ui, {
        viewport: name as "mobile" | "tablet" | "desktop",
      });
    },
  }));
}

/**
 * Test mobile-first responsive behavior
 */
export async function testMobileFirst(
  ui: ReactElement,
  options: ResortTestRenderOptions = {}
) {
  // Start with mobile
  const mobile = renderWithProviders(ui, { ...options, viewport: "mobile" });

  // Verify mobile accessibility
  await testMobileAccessibility(ui, options);

  // Test touch interactions
  testTouchTargets(ui, { ...options, viewport: "mobile" });

  return mobile;
}
```

## TypeScript Types for Test Utilities

### Test Utility Types

```typescript
/**
 * Core test configuration types
 */
export interface TestConfig {
  /** Fixed timestamp for deterministic tests */
  fixedTime: string;
  /** Seeded random generator state */
  randomSeed: string;
  /** Philippine timezone */
  timezone: "Asia/Manila";
  /** Test scenario type */
  scenario: "STABLE" | "ERROR" | "SLOW";
}

/**
 * Resort-specific test context
 */
export interface ResortTestContext {
  /** Current authenticated user */
  user: User | null;
  /** Active project/resort */
  project: ProjectContext;
  /** Philippine locale settings */
  locale: "en-PH" | "fil-PH";
  /** Currency settings */
  currency: {
    code: "PHP";
    symbol: "₱";
    formatter: Intl.NumberFormat;
  };
  /** Payment method availability */
  paymentMethods: {
    gcash: boolean;
    bankTransfer: boolean;
    cash: boolean;
  };
}

/**
 * Accessibility test results
 */
export interface AccessibilityTestResult {
  /** Axe test results */
  axeResults: any;
  /** Manual accessibility checks */
  manualChecks: {
    focusManagement: boolean;
    touchTargets: boolean;
    screenReaderSupport: boolean;
    colorContrast: boolean;
  };
  /** Viewport-specific results */
  viewportResults: Record<"mobile" | "tablet" | "desktop", any>;
}

/**
 * Mock service configuration
 */
export interface MockServiceConfig {
  /** API response delay simulation */
  responseDelay: number;
  /** Error simulation rate (0-1) */
  errorRate: number;
  /** Offline mode simulation */
  offline: boolean;
  /** GCash mock configuration */
  gcash: {
    enabled: boolean;
    successRate: number;
    apiKey: string;
  };
}
```

### Factory Function Types

```typescript
/**
 * Factory function type for creating test data
 */
export type FactoryFunction<T> = (overrides?: Partial<T>) => T;

/**
 * Philippine booking factory type
 */
export type PhilippineBookingFactory = FactoryFunction<{
  id: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkInDate: Date;
  checkOutDate: Date;
  numberOfGuests: number;
  numberOfChildren: number;
  roomType: "Standard" | "Deluxe" | "Family Room" | "Beach Front";
  totalAmount: number;
  paymentMethod: "GCash" | "Bank Transfer" | "Cash";
  status: "pending" | "confirmed" | "checked-in" | "checked-out" | "cancelled";
  specialRequests?: string;
}>;

/**
 * Philippine expense factory type
 */
export type PhilippineExpenseFactory = FactoryFunction<{
  id: string;
  description: string;
  amount: number;
  category:
    | "Utilities"
    | "Food"
    | "Maintenance"
    | "Payroll"
    | "Marketing"
    | "Transportation";
  date: Date;
  paymentMethod: "GCash" | "Cash" | "Bank Transfer";
  receipt?: string;
}>;

/**
 * Resort user factory type
 */
export type ResortUserFactory = FactoryFunction<{
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "owner" | "manager" | "staff";
  permissions: string[];
  lastLogin: Date;
}>;
```

### Test Assertion Types

```typescript
/**
 * Custom Jest matchers for resort testing
 */
declare global {
  namespace jest {
    interface Matchers<R> {
      /** Verify Philippine peso currency formatting */
      toBePhilippineCurrency(): R;
      /** Verify GCash payment format */
      toBeValidGCashAmount(): R;
      /** Check WCAG accessibility compliance */
      toPassWCAGAA(): R;
      /** Verify touch target size for mobile */
      toHaveValidTouchTarget(): R;
      /** Check Filipino language support */
      toSupportFilipinoLanguage(): R;
    }
  }
}
```

## Usage Examples in Resort Management Context

### Testing a Booking Form for Accessibility

```typescript
import { testResortAccessibility, renderWithProviders, fillBookingForm } from '@/test/utilities';
import { BookingForm } from '@/components/BookingForm';
import { createPhilippineBooking } from '@/test/factories';

describe('BookingForm Accessibility', () => {
  it('should meet WCAG AA standards on mobile', async () => {
    await testMobileAccessibility(<BookingForm />, {
      viewport: 'mobile',
      locale: 'en-PH',
    });
  });

  it('should support bilingual labels', async () => {
    const { english, filipino } = testBilingualContent(<BookingForm />);

    // English labels
    expect(english.getByLabelText('Guest Name')).toBeInTheDocument();

    // Filipino labels
    expect(filipino.getByLabelText('Pangalan ng Bisita')).toBeInTheDocument();
  });

  it('should have proper focus management', async () => {
    await testFocusManagement(
      <BookingForm />,
      ['[name="guestName"]', '[name="guestEmail"]', '[name="checkIn"]', '[type="submit"]']
    );
  });

  it('should announce validation errors to screen readers', async () => {
    const { container } = renderWithProviders(<BookingForm />);

    // Trigger validation
    const submitButton = screen.getByRole('button', { name: /create booking/i });
    await userEvent.click(submitButton);

    // Check for proper ARIA attributes
    testFormValidationAria(<BookingForm />, 'guestName');

    // Verify live regions for announcements
    testScreenReaderAnnouncements(
      <BookingForm />,
      ['Guest name is required', 'Please enter a valid email']
    );
  });
});
```

### Testing a Financial Dashboard for Screen Readers

```typescript
import { testScreenReaderAnnouncements, renderWithAuth } from '@/test/utilities';
import { FinancialDashboard } from '@/components/FinancialDashboard';

describe('FinancialDashboard Screen Reader Support', () => {
  it('should announce financial data changes', () => {
    testScreenReaderAnnouncements(
      <FinancialDashboard />,
      [
        'Total revenue: ₱125,500',
        'Monthly expenses: ₱45,200',
        'Profit margin: 64%',
      ]
    );
  });

  it('should provide accessible data tables', async () => {
    const { container } = renderWithAuth(<FinancialDashboard />, 'manager');

    const table = container.querySelector('[role="table"]');
    expect(table).toHaveAttribute('aria-label', 'Financial summary');

    // Check for proper table headers
    const headers = container.querySelectorAll('[role="columnheader"]');
    expect(headers).toHaveLength(4);
  });

  it('should support keyboard navigation for charts', async () => {
    await testFocusManagement(
      <FinancialDashboard />,
      ['[role="img"][aria-label*="Revenue chart"]', '[role="button"][aria-label*="Download"]']
    );
  });
});
```

### Testing Mobile-Responsive Resort Components

```typescript
import { testResponsiveAccessibility, createViewportTest } from '@/test/utilities';
import { ResortNavigation } from '@/components/ResortNavigation';

describe('ResortNavigation Responsive Accessibility', () => {
  it('should be accessible across all viewports', () => {
    testResponsiveAccessibility(<ResortNavigation />);
  });

  it('should adapt navigation for mobile staff use', async () => {
    const mobile = await testMobileFirst(<ResortNavigation />, {
      user: createResortUser({ role: 'staff' }),
      viewport: 'mobile',
    });

    // Verify bottom navigation for thumbs
    expect(mobile.container.querySelector('[data-testid="bottom-nav"]')).toBeInTheDocument();

    // Test touch targets
    testTouchTargets(<ResortNavigation />, { viewport: 'mobile' });
  });

  const viewportTests = createViewportTest(<ResortNavigation />, 'Navigation');

  viewportTests.forEach(({ name, test }) => {
    it(name, () => {
      const result = test();
      // Verify navigation works in each viewport
      expect(result.container.querySelector('nav')).toBeInTheDocument();
    });
  });
});
```

### Testing with Philippine Locale/Language

```typescript
import { testPhilippineCurrency, testBilingualContent, simulateGCashPayment } from '@/test/utilities';
import { PaymentForm } from '@/components/PaymentForm';

describe('PaymentForm Philippine Context', () => {
  it('should format amounts in Philippine peso', () => {
    testPhilippineCurrency(<PaymentForm amount={5000} />, 5000);
  });

  it('should support GCash payments', async () => {
    renderWithProviders(<PaymentForm amount={3500} />, {
      mockPayments: true,
      locale: 'en-PH',
    });

    await simulateGCashPayment(3500);

    // Verify GCash integration
    expect(screen.getByText(/gcash payment successful/i)).toBeInTheDocument();
  });

  it('should display bilingual payment instructions', () => {
    const { english, filipino } = testBilingualContent(
      <PaymentForm amount={2500} />
    );

    // English instructions
    expect(english.getByText('Select payment method')).toBeInTheDocument();

    // Filipino instructions
    expect(filipino.getByText('Pumili ng paraan ng pagbabayad')).toBeInTheDocument();
  });

  it('should handle offline payment queuing', async () => {
    renderWithProviders(<PaymentForm amount={1500} />, {
      offline: true,
      locale: 'en-PH',
    });

    // Verify offline message
    expect(screen.getByText(/payment will be queued/i)).toBeInTheDocument();

    // Test offline accessibility
    await testMobileAccessibility(<PaymentForm amount={1500} />, {
      offline: true,
      viewport: 'mobile',
    });
  });
});
```

## Best Practices

### Test Organization

1. **Group by Feature**: Organize tests by resort management features (bookings,
   expenses, reporting)
2. **Accessibility First**: Always test accessibility before functionality
3. **Mobile Priority**: Test mobile viewport first, then scale up
4. **Philippine Context**: Include currency, language, and payment method
   testing
5. **Role-Based Testing**: Test different user permission levels

### Performance Considerations

1. **Reuse Query Clients**: Use shared test query clients to avoid overhead
2. **Mock External Services**: Always mock GCash, bank transfers, and API calls
3. **Deterministic Data**: Use seeded random data for consistent test results
4. **Cleanup Resources**: Properly cleanup test resources and event listeners

### Accessibility Standards

1. **WCAG 2.1 AA Compliance**: All components must pass Level AA standards
2. **Screen Reader Support**: Test with NVDA, JAWS, and VoiceOver patterns
3. **Touch Target Sizes**: Minimum 44px touch targets for mobile
4. **Color Contrast**: 4.5:1 ratio for normal text, 3:1 for large text
5. **Keyboard Navigation**: Full keyboard accessibility without mouse dependency

---

_This specification provides comprehensive testing utilities for building
accessible, mobile-first resort management interfaces that serve Philippine
business contexts while maintaining international accessibility standards._
