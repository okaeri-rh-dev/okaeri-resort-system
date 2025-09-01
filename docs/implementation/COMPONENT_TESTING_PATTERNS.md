# Component Testing Patterns

## Overview

This document specifies comprehensive patterns for testing React components
using modern testing practices with React Testing Library, Vitest, and
TypeScript. All patterns ensure type safety, accessibility, and maintainability.

## Core Testing Philosophy

### Testing Principles

1. **Test behavior, not implementation details**
2. **Use semantic queries (roles, labels, text)**
3. **Test from user's perspective**
4. **Ensure accessibility compliance**
5. **Maintain type safety throughout**
6. **Use deterministic test data**

### Related Documentation

- **[TEST_UTILITIES_SPECIFICATION.md](./TEST_UTILITIES_SPECIFICATION.md)** -
  Comprehensive accessibility testing utilities, Philippine business context
  helpers, and mobile-first testing patterns
- **[COMPONENT_TESTING_PATTERNS.md](./COMPONENT_TESTING_PATTERNS.md)** - This
  document - Basic component testing patterns with React Testing Library
- **Phase-specific testing guides** - Feature-specific testing requirements and
  examples

### Component Testing Hierarchy

```
Integration Tests (70%) → Component behavior with providers
Unit Tests (20%) → Isolated component logic
E2E Tests (10%) → Critical user flows
```

## React Hook Form Testing Patterns

### Basic Form Testing

**Pattern**: Test form validation, submission, and error handling.

```typescript
import { renderWithProviders, screen } from '@/test/helpers';
// For comprehensive accessibility testing patterns, see TEST_UTILITIES_SPECIFICATION.md
import { testResortAccessibility, testMobileAccessibility } from '@/test/utilities';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import LoginForm from '@/components/LoginForm';
import { createUser } from '@/test/factories/user.factory';

describe('LoginForm', () => {
  const mockOnSubmit = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('should render form fields with proper accessibility', () => {
    renderWithProviders(<LoginForm onSubmit={mockOnSubmit} />);

    // Use semantic queries
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /remember me/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should show validation errors for invalid input', async () => {
    renderWithProviders(<LoginForm onSubmit={mockOnSubmit} />);

    const emailInput = screen.getByRole('textbox', { name: /email/i });
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    // Enter invalid data
    await user.type(emailInput, 'invalid-email');
    await user.click(submitButton);

    // Check for validation errors
    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });

    // Verify form was not submitted
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should submit form with valid data', async () => {
    renderWithProviders(<LoginForm onSubmit={mockOnSubmit} />);

    const emailInput = screen.getByRole('textbox', { name: /email/i });
    const passwordInput = screen.getByLabelText(/password/i);
    const rememberCheckbox = screen.getByRole('checkbox', { name: /remember me/i });
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    // Fill form with valid data
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(rememberCheckbox);
    await user.click(submitButton);

    // Verify submission
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        rememberMe: true
      });
    });
  });

  it('should handle server validation errors', async () => {
    const mockSubmitWithError = vi.fn().mockRejectedValue({
      status: 401,
      message: 'Invalid credentials'
    });

    renderWithProviders(<LoginForm onSubmit={mockSubmitWithError} />);

    const emailInput = screen.getByRole('textbox', { name: /email/i });
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    // Check for server error message
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
    });
  });

  it('should show loading state during submission', async () => {
    let resolveSubmit: () => void;
    const mockAsyncSubmit = vi.fn(() =>
      new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      })
    );

    renderWithProviders(<LoginForm onSubmit={mockAsyncSubmit} />);

    const emailInput = screen.getByRole('textbox', { name: /email/i });
    const passwordInput = screen.getByLabelText(/password/i });
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    // Check loading state
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();

    // Resolve submission
    resolveSubmit!();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled();
    });
  });
});
```

### Complex Form Testing

**Pattern**: Test multi-step forms with conditional fields.

```typescript
import { BookingForm } from '@/components/BookingForm';
import { createBooking } from '@/test/factories/booking.factory';

describe('BookingForm', () => {
  const mockOnSubmit = vi.fn();
  const user = userEvent.setup();

  it('should handle conditional field validation', async () => {
    renderWithProviders(<BookingForm onSubmit={mockOnSubmit} />);

    const numberOfGuestsInput = screen.getByRole('spinbutton', { name: /number of guests/i });
    const numberOfChildrenInput = screen.getByRole('spinbutton', { name: /number of children/i });

    // Set guests to 2
    await user.clear(numberOfGuestsInput);
    await user.type(numberOfGuestsInput, '2');

    // Try to set children to 3 (should fail validation)
    await user.clear(numberOfChildrenInput);
    await user.type(numberOfChildrenInput, '3');

    const submitButton = screen.getByRole('button', { name: /create booking/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Number of children cannot exceed number of guests')).toBeInTheDocument();
    });
  });

  it('should calculate total amount dynamically', async () => {
    renderWithProviders(<BookingForm onSubmit={mockOnSubmit} />);

    const checkInInput = screen.getByLabelText(/check-in date/i);
    const checkOutInput = screen.getByLabelText(/check-out date/i);
    const numberOfGuestsInput = screen.getByRole('spinbutton', { name: /number of guests/i });

    // Set dates for 3 nights
    await user.type(checkInInput, '2024-06-01');
    await user.type(checkOutInput, '2024-06-04');
    await user.clear(numberOfGuestsInput);
    await user.type(numberOfGuestsInput, '4');

    // Check calculated total
    await waitFor(() => {
      const totalAmountDisplay = screen.getByTestId('total-amount');
      // Base rate (3000) * 3 nights + surcharge for extra guests + tax
      const expectedTotal = ((3000 * 3) + (2 * 500 * 3)) * 1.22; // With 12% tax + 10% service
      expect(totalAmountDisplay).toHaveTextContent(expectedTotal.toFixed(2));
    });
  });
});
```

## Zustand Store Testing

### Store Integration Testing

**Pattern**: Test components that use Zustand stores.

```typescript
import { useAuthStore } from '@/stores/auth.store';
import { Dashboard } from '@/components/Dashboard';
import { createUser } from '@/test/factories/user.factory';

// Mock the store for testing
vi.mock('@/stores/auth.store');

describe('Dashboard with Auth Store', () => {
  const mockAuthStore = {
    user: null,
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
    updateProfile: vi.fn()
  };

  beforeEach(() => {
    vi.mocked(useAuthStore).mockReturnValue(mockAuthStore);
  });

  it('should show login prompt when not authenticated', () => {
    mockAuthStore.isAuthenticated = false;
    mockAuthStore.user = null;

    render(<Dashboard />);

    expect(screen.getByText(/please sign in to continue/i)).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-content')).not.toBeInTheDocument();
  });

  it('should show dashboard when authenticated', () => {
    const mockUser = createUser({ role: 'admin' });
    mockAuthStore.isAuthenticated = true;
    mockAuthStore.user = mockUser;

    render(<Dashboard />);

    expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
    expect(screen.getByText(`Welcome, ${mockUser.name}`)).toBeInTheDocument();
  });

  it('should call logout when logout button is clicked', async () => {
    const user = userEvent.setup();
    const mockUser = createUser({ role: 'admin' });
    mockAuthStore.isAuthenticated = true;
    mockAuthStore.user = mockUser;

    render(<Dashboard />);

    const logoutButton = screen.getByRole('button', { name: /sign out/i });
    await user.click(logoutButton);

    expect(mockAuthStore.logout).toHaveBeenCalledOnce();
  });
});
```

### Store State Testing

**Pattern**: Test store state changes in isolation.

```typescript
import { renderHook, act } from "@testing-library/react";
import { useBookingStore } from "@/stores/booking.store";
import { createBooking } from "@/test/factories/booking.factory";

describe("useBookingStore", () => {
  beforeEach(() => {
    // Reset store state between tests
    useBookingStore.getState().reset?.();
  });

  it("should add booking to store", async () => {
    const { result } = renderHook(() => useBookingStore());
    const mockBooking = createBooking();

    await act(async () => {
      await result.current.addBooking(mockBooking);
    });

    expect(result.current.bookings).toContain(mockBooking);
    expect(result.current.bookings).toHaveLength(1);
  });

  it("should update booking status", async () => {
    const { result } = renderHook(() => useBookingStore());
    const mockBooking = createBooking({ status: "pending" });

    // Add booking first
    await act(async () => {
      await result.current.addBooking(mockBooking);
    });

    // Update status
    await act(async () => {
      await result.current.updateBookingStatus(mockBooking.id, "confirmed");
    });

    const updatedBooking = result.current.bookings.find(
      (b) => b.id === mockBooking.id
    );
    expect(updatedBooking?.status).toBe("confirmed");
  });

  it("should handle error states", async () => {
    const { result } = renderHook(() => useBookingStore());

    // Mock service to throw error
    vi.spyOn(result.current, "addBooking").mockRejectedValue(
      new Error("Network error")
    );

    await act(async () => {
      try {
        await result.current.addBooking(createBooking());
      } catch (error) {
        // Error is expected
      }
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.isLoading).toBe(false);
  });
});
```

## TanStack Query Testing

### Query Testing

**Pattern**: Test components that use TanStack Query hooks.

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookingList } from '@/components/BookingList';
import { createBookings } from '@/test/factories/booking.factory';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  });
}

function renderWithQueryClient(component: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return renderWithProviders(component, { queryClient });
}

describe('BookingList with TanStack Query', () => {
  it('should show loading state initially', () => {
    renderWithQueryClient(<BookingList />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-list')).not.toBeInTheDocument();
  });

  it('should display bookings after successful fetch', async () => {
    const mockBookings = createBookings(3);

    // Mock the API call
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockBookings })
    });

    renderWithQueryClient(<BookingList />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    // Check if bookings are displayed
    expect(screen.getByTestId('booking-list')).toBeInTheDocument();
    expect(screen.getAllByTestId(/booking-item-/)).toHaveLength(3);

    // Verify specific booking data
    mockBookings.forEach(booking => {
      expect(screen.getByText(booking.guestName)).toBeInTheDocument();
    });
  });

  it('should show error state on fetch failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('API Error'));

    renderWithQueryClient(<BookingList />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/failed to load bookings/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
```

### Mutation Testing

**Pattern**: Test form components that use mutations.

```typescript
import { CreateBookingForm } from '@/components/CreateBookingForm';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('CreateBookingForm with Mutations', () => {
  let queryClient: QueryClient;
  const user = userEvent.setup();

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  function renderComponent() {
    return render(
      <QueryClientProvider client={queryClient}>
        <CreateBookingForm />
      </QueryClientProvider>
    );
  }

  it('should create booking successfully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: createBooking() })
    });

    renderComponent();

    // Fill form
    await user.type(screen.getByLabelText(/guest name/i), 'John Doe');
    await user.type(screen.getByLabelText(/guest email/i), 'john@example.com');
    await user.type(screen.getByLabelText(/check-in date/i), '2024-06-01');
    await user.type(screen.getByLabelText(/check-out date/i), '2024-06-03');

    // Submit form
    await user.click(screen.getByRole('button', { name: /create booking/i }));

    // Verify success message
    await waitFor(() => {
      expect(screen.getByText(/booking created successfully/i)).toBeInTheDocument();
    });

    // Verify API call
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/bookings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        }),
        body: expect.stringContaining('John Doe')
      })
    );
  });

  it('should handle mutation errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        message: 'Room not available for selected dates'
      })
    });

    renderComponent();

    // Fill and submit form
    await user.type(screen.getByLabelText(/guest name/i), 'John Doe');
    await user.type(screen.getByLabelText(/guest email/i), 'john@example.com');
    await user.type(screen.getByLabelText(/check-in date/i), '2024-06-01');
    await user.type(screen.getByLabelText(/check-out date/i), '2024-06-03');
    await user.click(screen.getByRole('button', { name: /create booking/i }));

    // Verify error message
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Room not available for selected dates');
    });
  });
});
```

## TanStack Router Testing

### Route Testing

**Pattern**: Test components that depend on routing.

```typescript
import { createMemoryRouter, RouterProvider } from '@tanstack/react-router';
import { BookingDetailPage } from '@/pages/BookingDetailPage';
import { createBooking } from '@/test/factories/booking.factory';

function renderWithRouter(initialEntries: string[] = ['/']) {
  const router = createMemoryRouter({
    routes: [
      {
        path: '/',
        component: () => <div>Home</div>
      },
      {
        path: '/bookings/$bookingId',
        component: BookingDetailPage
      }
    ],
    history: {
      initialEntries
    }
  });

  return renderWithProviders(<></>, { initialRoute: initialEntries[0] });
}

describe('BookingDetailPage', () => {
  it('should display booking details for valid ID', async () => {
    const mockBooking = createBooking();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockBooking })
    });

    renderWithRouter([`/bookings/${mockBooking.id}`]);

    await waitFor(() => {
      expect(screen.getByText(mockBooking.guestName)).toBeInTheDocument();
      expect(screen.getByText(mockBooking.guestEmail)).toBeInTheDocument();
    });
  });

  it('should show 404 for invalid booking ID', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404
    });

    renderWithRouter(['/bookings/invalid-id']);

    await waitFor(() => {
      expect(screen.getByText(/booking not found/i)).toBeInTheDocument();
    });
  });
});
```

### Navigation Testing

**Pattern**: Test navigation behavior.

```typescript
import { useNavigate } from '@tanstack/react-router';
import { BookingCard } from '@/components/BookingCard';

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate
}));

describe('BookingCard Navigation', () => {
  const mockBooking = createBooking();
  const user = userEvent.setup();

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('should navigate to booking detail on click', async () => {
    renderWithProviders(<BookingCard booking={mockBooking} />);

    const bookingCard = screen.getByTestId(`booking-card-${mockBooking.id}`);
    await user.click(bookingCard);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: `/bookings/${mockBooking.id}`
    });
  });

  it('should navigate to edit page on edit button click', async () => {
    renderWithProviders(<BookingCard booking={mockBooking} />);

    const editButton = screen.getByRole('button', { name: /edit/i });
    await user.click(editButton);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: `/bookings/${mockBooking.id}/edit`
    });
  });
});
```

## Accessibility Testing

### Accessibility Compliance

**Pattern**: Ensure components meet accessibility standards.

> **Note**: For comprehensive accessibility testing utilities including jest-axe
> setup, Philippine business context, and mobile-first patterns, see
> [TEST_UTILITIES_SPECIFICATION.md](./TEST_UTILITIES_SPECIFICATION.md)

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
import { testResortAccessibility, testMobileAccessibility } from '@/test/utilities';

// Add jest-axe matcher
expect.extend(toHaveNoViolations);

describe('LoginForm Accessibility', () => {
  it('should not have accessibility violations', async () => {
    const { container } = renderWithProviders(<LoginForm />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should pass resort-specific accessibility checks', async () => {
    await testResortAccessibility(<LoginForm />, {
      locale: 'en-PH',
      viewport: 'mobile',
    });
  });

  it('should be accessible on mobile devices (primary use case)', async () => {
    await testMobileAccessibility(<LoginForm />);
  });

  it('should have proper focus management', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    const emailInput = screen.getByRole('textbox', { name: /email/i });
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    // Tab through form
    await user.tab();
    expect(emailInput).toHaveFocus();

    await user.tab();
    expect(passwordInput).toHaveFocus();

    await user.tab();
    expect(submitButton).toHaveFocus();
  });

  it('should announce errors to screen readers', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    await waitFor(() => {
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveAttribute('aria-live', 'polite');
    });
  });

  it('should support touch targets on mobile', () => {
    const { container } = renderWithProviders(<LoginForm />, { viewport: 'mobile' });

    // All interactive elements should be at least 44px for touch
    const interactiveElements = container.querySelectorAll('button, input, a');
    interactiveElements.forEach(element => {
      const rect = element.getBoundingClientRect();
      expect(Math.min(rect.width, rect.height)).toBeGreaterThanOrEqual(44);
    });
  });
});
```

## Performance Testing

### Render Performance

**Pattern**: Measure component rendering performance.

```typescript
import { act, renderHook } from '@testing-library/react';
import { measureRenderTime } from '@/test/helpers';

describe('BookingList Performance', () => {
  it('should render large booking list efficiently', () => {
    const largeBookingList = createBookings(1000);

    const { duration } = measureRenderTime(() =>
      renderWithProviders(<BookingList bookings={largeBookingList} />)
    );

    // Should render in under 100ms
    expect(duration).toBeLessThan(100);
  });

  it('should not cause memory leaks on unmount', () => {
    const { unmount } = renderWithProviders(<BookingList />);

    const initialMemory = performance.memory?.usedJSHeapSize;

    act(() => {
      unmount();
    });

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = performance.memory?.usedJSHeapSize;

    // Memory should not increase significantly
    if (initialMemory && finalMemory) {
      expect(finalMemory - initialMemory).toBeLessThan(1024 * 1024); // 1MB
    }
  });
});
```

## Error Boundary Testing

### Error Handling

**Pattern**: Test error boundaries and error states.

```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Component that throws error for testing
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  // Suppress console.error for cleaner test output
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  it('should catch and display errors', () => {
    renderWithProviders(
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByText('No error')).not.toBeInTheDocument();
  });

  it('should render children when no error', () => {
    renderWithProviders(
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
```

These patterns provide comprehensive coverage for testing React components in
modern applications, ensuring reliability, accessibility, and maintainability.
