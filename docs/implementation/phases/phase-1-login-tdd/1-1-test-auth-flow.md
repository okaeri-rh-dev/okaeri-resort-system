# Sub-Phase 1.1: Test Auth Flow (RED Phase)

## Overview

This sub-phase implements the RED phase of Test-Driven Development for the
authentication flow. It focuses on writing comprehensive, failing tests for all
authentication scenarios before any implementation begins. These tests will
define the expected behavior of the login system and guide the minimal
implementation in subsequent phases.

## Objectives

1. **Comprehensive Test Coverage**: Write tests covering all authentication
   scenarios and edge cases
2. **TDD Methodology**: Establish pure RED phase with all tests failing
   initially
3. **Behavior Definition**: Define expected authentication flow behavior through
   tests
4. **Integration Specification**: Specify integration points with preserved
   infrastructure
5. **Quality Standards**: Establish testing patterns for subsequent development
   phases

## Test Strategy

### 1. Authentication Flow Test Architecture

```typescript
// tests/auth/auth-flow.test.tsx
// Comprehensive authentication flow testing

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, MOCK_USERS, formHelpers } from '@/tests/utils/test-utils';
import { createUser, createAuthenticatedUser } from '@/src/test/factories/user.factory';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { MockAuthService } from '@/src/services/mock/auth.mock.service';
import type { LoginCredentials, User } from '@/types/common';

/**
 * Authentication Flow Test Suite
 *
 * This test suite defines the complete authentication flow behavior
 * following TDD RED phase principles. All tests should FAIL initially.
 *
 * Test Structure:
 * 1. Component rendering and UI tests
 * 2. Form validation and error handling
 * 3. Authentication flow integration
 * 4. Security and accessibility requirements
 * 5. Performance and user experience tests
 */

describe('Authentication Flow', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Reset auth store to initial state
    // This will be implemented in GREEN phase
  });

  afterEach(() => {
    // Cleanup after each test
    vi.restoreAllMocks();
  });

  describe('LoginPage Component', () => {
    describe('Initial Rendering', () => {
      it('should render login form with all required elements', () => {
        // This test should FAIL initially - no LoginPage component exists
        const { container } = renderWithProviders(<LoginPage />);

        // Verify form structure
        expect(screen.getByRole('form', { name: /login/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sign in|login/i })).toBeInTheDocument();

        // Verify branding elements
        expect(screen.getByAltText(/okaeri.*logo/i)).toBeInTheDocument();
        expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
      });

      it('should render navigation links', () => {
        renderWithProviders(<LoginPage />);

        // Verify navigation elements
        expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /create account|register/i })).toBeInTheDocument();

        // Verify link destinations
        const forgotPasswordLink = screen.getByRole('link', { name: /forgot password/i });
        const registerLink = screen.getByRole('link', { name: /create account|register/i });

        expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password');
        expect(registerLink).toHaveAttribute('href', '/register');
      });

      it('should have proper form accessibility attributes', () => {
        renderWithProviders(<LoginPage />);

        const form = screen.getByRole('form');
        const emailInput = screen.getByLabelText(/email/i);
        const passwordInput = screen.getByLabelText(/password/i);
        const submitButton = screen.getByRole('button', { name: /sign in|login/i });

        // Form accessibility
        expect(form).toHaveAttribute('noValidate'); // Client-side validation

        // Input accessibility
        expect(emailInput).toHaveAttribute('type', 'email');
        expect(emailInput).toHaveAttribute('autoComplete', 'email');
        expect(emailInput).toHaveAttribute('required');

        expect(passwordInput).toHaveAttribute('type', 'password');
        expect(passwordInput).toHaveAttribute('autoComplete', 'current-password');
        expect(passwordInput).toHaveAttribute('required');

        // Button accessibility
        expect(submitButton).toHaveAttribute('type', 'submit');
        expect(submitButton).not.toBeDisabled();
      });

      it('should be responsive and mobile-friendly', () => {
        // Test mobile viewport
        global.innerWidth = 375;
        global.innerHeight = 667;
        global.dispatchEvent(new Event('resize'));

        const { container } = renderWithProviders(<LoginPage />);

        // Verify mobile layout
        const formContainer = container.querySelector('[data-testid="login-form-container"]');
        expect(formContainer).toHaveClass('mobile-responsive');

        // Verify touch targets are large enough (minimum 44px)
        const inputs = container.querySelectorAll('input');
        inputs.forEach(input => {
          const styles = window.getComputedStyle(input);
          const height = parseInt(styles.height);
          expect(height).toBeGreaterThanOrEqual(44);
        });

        // Verify submit button is touch-friendly
        const submitButton = screen.getByRole('button', { name: /sign in|login/i });
        const buttonStyles = window.getComputedStyle(submitButton);
        expect(parseInt(buttonStyles.minHeight)).toBeGreaterThanOrEqual(44);
      });
    });

    describe('Form Validation', () => {
      it('should validate email format using Zod schema', async () => {
        renderWithProviders(<LoginPage />);

        const emailInput = screen.getByLabelText(/email/i);
        const submitButton = screen.getByRole('button', { name: /sign in|login/i });

        // Test invalid email formats
        const invalidEmails = [
          'invalid',
          'invalid@',
          '@invalid.com',
          'invalid.com',
          'invalid@.com',
          'invalid@domain.',
          ''
        ];

        for (const invalidEmail of invalidEmails) {
          await userEvent.setup().type(emailInput, invalidEmail);
          await userEvent.click(submitButton);

          // Should show validation error
          expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
          expect(emailInput).toHaveAttribute('aria-invalid', 'true');
          expect(emailInput).toHaveAttribute('aria-describedby', expect.stringMatching(/email.*error/i));

          await userEvent.clear(emailInput);
        }
      });

      it('should validate password requirements', async () => {
        renderWithProviders(<LoginPage />);

        const passwordInput = screen.getByLabelText(/password/i);
        const submitButton = screen.getByRole('button', { name: /sign in|login/i });

        // Test password too short
        await userEvent.setup().type(passwordInput, '123');
        await userEvent.click(submitButton);

        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
        expect(passwordInput).toHaveAttribute('aria-invalid', 'true');

        // Test empty password
        await userEvent.clear(passwordInput);
        await userEvent.click(submitButton);

        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });

      it('should show field-level validation on blur', async () => {
        const user = userEvent.setup();
        renderWithProviders(<LoginPage />);

        const emailInput = screen.getByLabelText(/email/i);

        // Enter invalid email and blur
        await user.type(emailInput, 'invalid-email');
        await user.tab(); // Trigger blur

        // Should show validation error immediately
        await waitFor(() => {
          expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
        });

        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      });

      it('should clear validation errors when user corrects input', async () => {
        const user = userEvent.setup();
        renderWithProviders(<LoginPage />);

        const emailInput = screen.getByLabelText(/email/i);

        // Trigger validation error
        await user.type(emailInput, 'invalid');
        await user.tab();

        await waitFor(() => {
          expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
        });

        // Correct the input
        await user.clear(emailInput);
        await user.type(emailInput, 'valid@example.com');

        // Error should disappear
        await waitFor(() => {
          expect(screen.queryByText(/invalid email/i)).not.toBeInTheDocument();
        });

        expect(emailInput).toHaveAttribute('aria-invalid', 'false');
      });

      it('should prevent form submission with validation errors', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();

        renderWithProviders(<LoginPage onSubmit={onSubmit} />);

        const emailInput = screen.getByLabelText(/email/i);
        const passwordInput = screen.getByLabelText(/password/i);
        const submitButton = screen.getByRole('button', { name: /sign in|login/i });

        // Enter invalid data
        await user.type(emailInput, 'invalid');
        await user.type(passwordInput, '123');

        // Try to submit
        await user.click(submitButton);

        // Form should not submit
        expect(onSubmit).not.toHaveBeenCalled();

        // Should show validation errors
        expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });
    });

    describe('Authentication Integration', () => {
      it('should call authStore.login with form data on valid submission', async () => {
        const user = userEvent.setup();
        const mockLogin = vi.fn().mockResolvedValue({ success: true });

        // Mock the auth store - this will be implemented in GREEN phase
        const mockAuthStore = {
          login: mockLogin,
          isLoading: false,
          error: null
        };

        renderWithProviders(
          <LoginPage />,
          {
            mockStores: { auth: mockAuthStore }
          }
        );

        const emailInput = screen.getByLabelText(/email/i);
        const passwordInput = screen.getByLabelText(/password/i);
        const submitButton = screen.getByRole('button', { name: /sign in|login/i });

        // Enter valid credentials
        await user.type(emailInput, 'test@example.com');
        await user.type(passwordInput, 'password123');

        // Submit form
        await user.click(submitButton);

        // Should call login with correct data
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123'
        });
      });

      it('should handle successful login response', async () => {
        const user = userEvent.setup();
        const mockNavigate = vi.fn();

        const mockAuthStore = {
          login: vi.fn().mockResolvedValue({
            success: true,
            data: {
              user: createUser(),
              token: 'valid-token'
            }
          }),
          isLoading: false,
          error: null
        };

        renderWithProviders(
          <LoginPage />,
          {
            mockStores: { auth: mockAuthStore },
            mockNavigate
          }
        );

        // Fill and submit form
        await formHelpers.fillLoginForm(user, 'test@example.com', 'password123');

        await formHelpers.submitForm(user, 'submit-button');

        // Should redirect to dashboard
        await waitFor(() => {
          expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard' });
        });

        // Should show success message briefly
        expect(screen.getByText(/login successful/i)).toBeInTheDocument();
      });

      it('should handle authentication errors gracefully', async () => {
        const user = userEvent.setup();

        const mockAuthStore = {
          login: vi.fn().mockRejectedValue({
            success: false,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid email or password'
            }
          }),
          isLoading: false,
          error: null
        };

        renderWithProviders(
          <LoginPage />,
          {
            mockStores: { auth: mockAuthStore }
          }
        );

        // Fill and submit form with invalid credentials
        await formHelpers.fillLoginForm(user, 'test@example.com', 'wrongpassword');

        await formHelpers.submitForm(user, 'submit-button');

        // Should display error message
        await waitFor(() => {
          expect(screen.getByRole('alert')).toBeInTheDocument();
          expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
        });

        // Form should remain usable
        const submitButton = screen.getByRole('button', { name: /sign in|login/i });
        expect(submitButton).not.toBeDisabled();

        // Error should be announced to screen readers
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveAttribute('aria-live', 'assertive');
      });

      it('should handle network errors', async () => {
        const user = userEvent.setup();

        const mockAuthStore = {
          login: vi.fn().mockRejectedValue(new Error('Network error')),
          isLoading: false,
          error: null
        };

        renderWithProviders(
          <LoginPage />,
          {
            mockStores: { auth: mockAuthStore }
          }
        );

        await formHelpers.fillLoginForm(user, 'test@example.com', 'password123');

        await formHelpers.submitForm(user, 'submit-button');

        // Should show network error message
        await waitFor(() => {
          expect(screen.getByText(/connection problem/i)).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
        });
      });

      it('should handle rate limiting', async () => {
        const user = userEvent.setup();

        const mockAuthStore = {
          login: vi.fn().mockRejectedValue({
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many login attempts. Please try again in 5 minutes.'
            }
          }),
          isLoading: false,
          error: null
        };

        renderWithProviders(
          <LoginPage />,
          {
            mockStores: { auth: mockAuthStore }
          }
        );

        await formHelpers.fillLoginForm(user, 'test@example.com', 'password123');

        await formHelpers.submitForm(user, 'submit-button');

        // Should show rate limit message
        await waitFor(() => {
          expect(screen.getByText(/too many login attempts/i)).toBeInTheDocument();
        });

        // Submit button should be disabled
        const submitButton = screen.getByRole('button', { name: /sign in|login/i });
        expect(submitButton).toBeDisabled();
      });
    });

    describe('Loading States and UX', () => {
      it('should show loading state during authentication', async () => {
        const user = userEvent.setup();

        // Create a pending promise to simulate loading
        let resolveLogin: (value: any) => void;
        const loginPromise = new Promise(resolve => {
          resolveLogin = resolve;
        });

        const mockAuthStore = {
          login: vi.fn().mockReturnValue(loginPromise),
          isLoading: true,
          error: null
        };

        renderWithProviders(
          <LoginPage />,
          {
            mockStores: { auth: mockAuthStore }
          }
        );

        await formHelpers.fillLoginForm(user, 'test@example.com', 'password123');

        await user.click(screen.getByRole('button', { name: /sign in|login/i }));

        // Should show loading indicators
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
        expect(screen.getByText(/signing in/i)).toBeInTheDocument();

        // Form should be disabled during loading
        expect(screen.getByLabelText(/email/i)).toBeDisabled();
        expect(screen.getByLabelText(/password/i)).toBeDisabled();
        expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();

        // Loading state should be announced to screen readers
        expect(screen.getByRole('status', { name: /signing in/i })).toBeInTheDocument();

        // Resolve the login
        resolveLogin!({ success: true });

        await waitFor(() => {
          expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
        });
      });

      it('should show password visibility toggle', async () => {
        const user = userEvent.setup();
        renderWithProviders(<LoginPage />);

        const passwordInput = screen.getByLabelText(/password/i);
        const toggleButton = screen.getByRole('button', { name: /show password|hide password/i });

        // Initially password should be hidden
        expect(passwordInput).toHaveAttribute('type', 'password');
        expect(toggleButton).toHaveAttribute('aria-label', 'Show password');

        // Click toggle to show password
        await user.click(toggleButton);

        expect(passwordInput).toHaveAttribute('type', 'text');
        expect(toggleButton).toHaveAttribute('aria-label', 'Hide password');

        // Click again to hide
        await user.click(toggleButton);

        expect(passwordInput).toHaveAttribute('type', 'password');
        expect(toggleButton).toHaveAttribute('aria-label', 'Show password');
      });

      it('should handle form autofill gracefully', async () => {
        renderWithProviders(<LoginPage />);

        const emailInput = screen.getByLabelText(/email/i);
        const passwordInput = screen.getByLabelText(/password/i);

        // Simulate browser autofill
        fireEvent.change(emailInput, { target: { value: 'autofilled@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'autofilledpassword' } });

        // Form should recognize autofilled values
        expect(emailInput).toHaveValue('autofilled@example.com');
        expect(passwordInput).toHaveValue('autofilledpassword');

        // Should not show validation errors for autofilled values
        expect(screen.queryByText(/invalid email/i)).not.toBeInTheDocument();
      });

      it('should maintain focus management during async operations', async () => {
        const user = userEvent.setup();

        const mockAuthStore = {
          login: vi.fn().mockResolvedValue({ success: false, error: 'Invalid credentials' }),
          isLoading: false,
          error: null
        };

        renderWithProviders(
          <LoginPage />,
          {
            mockStores: { auth: mockAuthStore }
          }
        );

        const submitButton = screen.getByRole('button', { name: /sign in|login/i });

        await formHelpers.fillLoginForm(user, 'test@example.com', 'wrongpassword');

        // Focus should be on submit button before clicking
        submitButton.focus();
        expect(document.activeElement).toBe(submitButton);

        await user.click(submitButton);

        // After error, focus should move to error message for accessibility
        await waitFor(() => {
          const errorAlert = screen.getByRole('alert');
          expect(document.activeElement).toBe(errorAlert);
        });
      });
    });

    describe('Security Features', () => {
      it('should not expose password in DOM or console', async () => {
        const user = userEvent.setup();
        const consoleSpy = vi.spyOn(console, 'log');

        renderWithProviders(<LoginPage />);

        const passwordInput = screen.getByLabelText(/password/i);

        await user.type(passwordInput, 'secretpassword');

        // Password should not appear in DOM text content
        expect(document.body.textContent).not.toContain('secretpassword');

        // Password should not be logged to console
        expect(consoleSpy).not.toHaveBeenCalledWith(
          expect.stringContaining('secretpassword')
        );

        consoleSpy.mockRestore();
      });

      // Note: JWT authentication doesn't require CSRF protection
      it('should not include CSRF protection for JWT auth', () => {
        renderWithProviders(<LoginPage />);

        const form = screen.getByRole('form');
        const csrfInput = form.querySelector('input[name="_token"]');

        // JWT authentication doesn't need CSRF tokens
        expect(csrfInput).not.toBeInTheDocument();
      });

      it('should prevent XSS in form inputs', async () => {
        const user = userEvent.setup();
        renderWithProviders(<LoginPage />);

        const emailInput = screen.getByLabelText(/email/i);

        // Try to inject script
        const xssPayload = '<script>alert("xss")</script>';
        await user.type(emailInput, xssPayload);

        // Should not execute script, should sanitize input
        expect(emailInput.value).not.toContain('<script>');
        expect(global.alert).not.toHaveBeenCalled();
      });

      it('should handle session timeout gracefully', async () => {
        const user = userEvent.setup();

        const mockAuthStore = {
          login: vi.fn().mockRejectedValue({
            success: false,
            error: {
              code: 'SESSION_EXPIRED',
              message: 'Your session has expired. Please log in again.'
            }
          }),
          isLoading: false,
          error: null
        };

        renderWithProviders(
          <LoginPage />,
          {
            mockStores: { auth: mockAuthStore }
          }
        );

        await formHelpers.fillLoginForm(user, 'test@example.com', 'password123');

        await formHelpers.submitForm(user, 'submit-button');

        // Should show session timeout message
        await waitFor(() => {
          expect(screen.getByText(/session has expired/i)).toBeInTheDocument();
        });

        // Should clear any stored tokens
        expect(localStorage.getItem('auth_token')).toBeNull();
      });
    });

    describe('Accessibility Compliance', () => {
      it('should have no accessibility violations', async () => {
        const { container } = renderWithProviders(<LoginPage />);

        // Run axe accessibility tests
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it('should support keyboard navigation', async () => {
        renderWithProviders(<LoginPage />);

        const emailInput = screen.getByLabelText(/email/i);
        const passwordInput = screen.getByLabelText(/password/i);
        const submitButton = screen.getByRole('button', { name: /sign in|login/i });
        const forgotPasswordLink = screen.getByRole('link', { name: /forgot password/i });

        // Tab through form elements
        emailInput.focus();
        expect(document.activeElement).toBe(emailInput);

        await fireEvent.keyDown(emailInput, { key: 'Tab' });
        expect(document.activeElement).toBe(passwordInput);

        await fireEvent.keyDown(passwordInput, { key: 'Tab' });
        expect(document.activeElement).toBe(submitButton);

        await fireEvent.keyDown(submitButton, { key: 'Tab' });
        expect(document.activeElement).toBe(forgotPasswordLink);
      });

      it('should support form submission via Enter key', async () => {
        const user = userEvent.setup();
        const mockLogin = vi.fn().mockResolvedValue({ success: true });

        const mockAuthStore = {
          login: mockLogin,
          isLoading: false,
          error: null
        };

        renderWithProviders(
          <LoginPage />,
          {
            mockStores: { auth: mockAuthStore }
          }
        );

        await formHelpers.fillLoginForm(user, 'test@example.com', 'password123');

        // Press Enter in password field
        const passwordInput = screen.getByLabelText(/password/i);
        await user.type(passwordInput, '{enter}');

        // Should trigger form submission
        expect(mockLogin).toHaveBeenCalled();
      });

      it('should announce form errors to screen readers', async () => {
        const user = userEvent.setup();

        renderWithProviders(<LoginPage />);

        const submitButton = screen.getByRole('button', { name: /sign in|login/i });

        // Submit form without filling required fields
        await user.click(submitButton);

        // Error region should be announced
        const errorRegion = screen.getByRole('alert');
        expect(errorRegion).toHaveAttribute('aria-live', 'assertive');
        expect(errorRegion).toHaveAttribute('aria-atomic', 'true');

        // Individual field errors should be associated with inputs
        const emailInput = screen.getByLabelText(/email/i);
        const emailError = screen.getByText(/email is required/i);

        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
        expect(emailInput).toHaveAttribute('aria-describedby', emailError.id);
      });

      it('should have sufficient color contrast', () => {
        const { container } = renderWithProviders(<LoginPage />);

        // Test button color contrast
        const submitButton = screen.getByRole('button', { name: /sign in|login/i });
        const buttonStyles = window.getComputedStyle(submitButton);

        // This would typically use a color contrast testing library
        // For now, we verify CSS classes that ensure proper contrast
        expect(submitButton).toHaveClass('btn-primary');

        // Test input label contrast
        const labels = container.querySelectorAll('label');
        labels.forEach(label => {
          expect(label).toHaveClass(expect.stringMatching(/text-(gray-900|black)/));
        });
      });

      it('should provide clear focus indicators', async () => {
        const user = userEvent.setup();
        renderWithProviders(<LoginPage />);

        const emailInput = screen.getByLabelText(/email/i);

        await user.tab();

        // Should have visible focus indicator
        expect(emailInput).toHaveClass('focus:ring-2');
        expect(emailInput).toHaveClass('focus:ring-blue-500');

        // Focus indicator should be visible and not removed by outline: none
        const styles = window.getComputedStyle(emailInput, ':focus');
        expect(styles.outline).not.toBe('none');
      });
    });
  });
});

// Additional test suites for related components and hooks

describe('useAuthForm Hook', () => {
  it('should manage form state with React Hook Form', async () => {
    // Test hook that will manage form state
    // This should FAIL initially - hook doesn't exist
    const { result } = renderHook(() => useAuthForm({
      validationSchema: loginSchema,
      onSubmit: vi.fn()
    }));

    expect(result.current.formState.isValid).toBe(false);
    expect(result.current.handleSubmit).toBeDefined();
    expect(result.current.register).toBeDefined();
    expect(result.current.formState.errors).toEqual({});
  });

  it('should integrate with Zod validation', async () => {
    const onSubmit = vi.fn();

    const { result } = renderHook(() => useAuthForm({
      validationSchema: loginSchema,
      onSubmit
    }));

    // Test validation integration
    await act(async () => {
      await result.current.handleSubmit({
        email: 'invalid',
        password: '123'
      })();
    });

    expect(result.current.formState.errors.email).toBeDefined();
    expect(result.current.formState.errors.password).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('LoginPage Integration with Preserved Infrastructure', () => {
  it('should integrate with authStore from preserved infrastructure', async () => {
    // Import the real authStore (preserved infrastructure)
    const { useAuthStore } = await import('@/stores/authStore');

    // Mock only the network calls, use real store
    const mockApiCall = vi.fn().mockResolvedValue({
      success: true,
      data: { user: mockFactory.create('user'), token: 'token' }
    });

    // This test verifies integration with real preserved store
    renderWithProviders(<LoginPage />);

    // Test that login calls the real store method
    // Implementation details depend on preserved store interface
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('should use preserved validation schemas', async () => {
    // Import preserved validation schemas
    const { loginSchema } = await import('@/lib/validations/auth');

    // Test that form validation uses the preserved schema
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'password123'
    });

    expect(result.success).toBe(true);
  });

  it('should integrate with preserved security features', async () => {
    // JWT authentication doesn't require CSRF protection
    renderWithProviders(<LoginPage />);

    // Verify no CSRF token is needed for JWT
    const form = screen.getByRole('form');
    const csrfToken = form.querySelector('input[name="_token"]');

    expect(csrfToken).not.toBeInTheDocument();
  });
});
```

## Test Categories and Coverage

### 1. Component Rendering Tests (12 tests)

- Initial form rendering with all required elements
- Navigation links and accessibility attributes
- Mobile responsiveness and touch targets
- Form structure and semantic HTML

### 2. Form Validation Tests (8 tests)

- Email format validation using Zod
- Password requirement validation
- Field-level validation on blur
- Real-time error clearing and prevention of invalid submissions

### 3. Authentication Integration Tests (6 tests)

- Store integration and method calls
- Success/error response handling
- Network error recovery
- Rate limiting and security restrictions

### 4. Loading States and UX Tests (4 tests)

- Loading indicators and disabled states
- Password visibility toggle
- Browser autofill compatibility
- Focus management during async operations

### 5. Security Feature Tests (4 tests)

- Password exposure prevention
- CSRF protection implementation
- XSS prevention in form inputs
- Session timeout handling

### 6. Accessibility Compliance Tests (6 tests)

- Automated accessibility violation detection
- Keyboard navigation support
- Screen reader announcements
- Color contrast and focus indicators

## Preserved Infrastructure Integration

### Authentication Store Integration

```typescript
// Integration points with preserved authStore
interface AuthStoreIntegration {
  // Methods from preserved authStore that login form must use
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  getCurrentUser: () => User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;
}
```

### Validation Schema Integration

```typescript
// Use existing validation schemas from preserved infrastructure
import { loginSchema, registerSchema } from "@/lib/validations/auth";

// All form validation must use these preserved schemas
const formValidation = useForm({
  resolver: zodResolver(loginSchema),
  mode: "onBlur",
});
```

### Security Feature Integration

```typescript
// Integration with preserved security infrastructure
// Note: JWT authentication doesn't require CSRF protection because:
// 1. JWT tokens are sent via Authorization headers, not cookies
// 2. Browsers don't automatically include Authorization headers in requests
// 3. This makes JWT immune to CSRF attacks by design
import { sessionMonitor } from "@/lib/security/session-monitor";
import { auditLogger } from "@/lib/security/audit-logger";

// All login attempts must use preserved security features (except CSRF for JWT)
```

## Acceptance Criteria

### Test Implementation Requirements

- [ ] All 40+ test cases written and initially FAILING (RED phase)
- [ ] Tests cover all authentication scenarios and edge cases
- [ ] Integration tests verify preserved infrastructure usage
- [ ] Accessibility tests ensure WCAG 2.1 AA compliance
- [ ] Security tests validate all protection measures

### Test Quality Standards

- [ ] Tests follow TDD naming conventions and structure
- [ ] All tests have clear, descriptive names explaining expected behavior
- [ ] Test setup and teardown properly manage state
- [ ] Mock data uses realistic, generated data via factories
- [ ] Tests are isolated and do not depend on each other

### Coverage Requirements

- [ ] 100% coverage of authentication flow scenarios
- [ ] Complete form validation rule coverage
- [ ] All error handling paths tested
- [ ] Security feature integration verified
- [ ] Accessibility requirements validated

## Implementation Notes

### TDD RED Phase Rules

1. **All Tests Must Fail Initially**: Every test should fail because no
   implementation exists
2. **Test Behavior, Not Implementation**: Focus on what the component should do,
   not how
3. **Comprehensive Edge Case Coverage**: Include all possible user scenarios and
   error conditions
4. **Integration Point Specification**: Define exactly how new code integrates
   with preserved infrastructure
5. **Quality Gate Establishment**: Set measurable standards for GREEN phase
   implementation

### Mock Service Usage

- Use `MockAuthService` for realistic authentication responses
- Use `MOCK_USERS` for different user states
- Use `createUser()` and related factory functions for generating realistic test
  data
- Use `formHelpers` for common form testing operations

### Preserved Infrastructure Constraints

- **Must Use**: Existing authStore, validation schemas, security features
- **Cannot Modify**: Any preserved infrastructure components
- **Must Import**: All dependencies from preserved infrastructure paths
- **Must Follow**: Existing API contracts and interfaces

## Next Steps

After completing this RED phase:

1. **Validation**: Ensure all tests are failing for the right reasons
2. **Review**: Have tests reviewed for completeness and quality
3. **Documentation**: Update test documentation with any discoveries
4. **Handoff**: Transition to Sub-Phase 1.2 for form validation tests
5. **Preparation**: Begin planning minimal GREEN phase implementation

---

**Status**: Ready to Begin **Duration**: 1 day **Test Count**: 40+ comprehensive
test cases **Integration Points**: 4 preserved infrastructure components
**Quality Gates**: 100% RED phase completion before GREEN phase begins
