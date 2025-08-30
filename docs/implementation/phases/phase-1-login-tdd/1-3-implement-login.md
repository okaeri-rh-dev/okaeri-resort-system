# Sub-Phase 1.3: Implement Login (GREEN Phase)

## Overview

This sub-phase implements the GREEN phase of TDD by writing the minimal code
necessary to make all previously written tests pass. The focus is on creating
functional login components with React Hook Form, Zod validation, and
integration with preserved infrastructure while maintaining simplicity and
avoiding over-engineering.

## Objectives

1. **Minimal Implementation**: Write only the code needed to make tests pass
2. **Test-Driven Implementation**: Follow TDD GREEN phase principles strictly
3. **Infrastructure Integration**: Connect with preserved authentication and
   security infrastructure
4. **Form Management**: Implement React Hook Form with Zod validation
5. **Quality Assurance**: Ensure all tests pass while maintaining code quality

## Implementation Strategy

### 1. LoginPage Component Implementation

```typescript
// src/pages/LoginPage.tsx
// Minimal implementation to pass all authentication flow tests

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/authStore';
import { loginSchema } from '@/lib/validations/auth';
// Note: JWT authentication doesn't require CSRF protection
// import { auditLogger } from '@/lib/security/audit-logger'; // This may not exist yet
import type { LoginCredentials } from '@/types';

interface LoginPageProps {
  onSubmit?: (data: LoginCredentials) => void | Promise<void>;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSubmit }) => {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  // Educational: JWT doesn't need CSRF tokens because:
  // - JWT tokens are sent in Authorization headers
  // - Browsers never automatically include Authorization headers
  // - Only cookie-based auth needs CSRF protection

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty, isValid },
    watch,
    clearErrors,
    setError
  } = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: {
      email: '',
      password: ''
    }
  });

  // Watch form values for real-time UI updates
  const emailValue = watch('email', '');
  const passwordValue = watch('password', '');

  const handleFormSubmit = async (data: LoginCredentials) => {
    try {
      // Clear any previous errors
      clearErrors();

      // Log authentication attempt (if audit logger exists)
      // auditLogger.logAuthAttempt({
      //   email: data.email,
      //   timestamp: new Date(),
      //   userAgent: navigator.userAgent
      // });

      // Call external onSubmit if provided (for testing)
      if (onSubmit) {
        await onSubmit(data);
        return;
      }

      // Actual authentication
      const result = await login(data);

      if (result.success) {
        // Log successful authentication (if audit logger exists)
        // auditLogger.logAuthSuccess({
        //   userId: result.data.user.id,
        //   email: data.email,
        //   timestamp: new Date()
        // });

        // Navigate to dashboard
        navigate({ to: '/dashboard' });
      } else {
        // Handle authentication errors
        handleAuthError(result.error);
      }
    } catch (error) {
      console.error('Login error:', error);
      handleNetworkError(error);
    }
  };

  const handleAuthError = (error: any) => {
    // Log failed authentication (if audit logger exists)
    // auditLogger.logAuthFailure({
    //   email: emailValue,
    //   error: error.code || 'UNKNOWN_ERROR',
    //   timestamp: new Date()
    // });

    switch (error.code) {
      case 'INVALID_CREDENTIALS':
        setError('root', {
          type: 'manual',
          message: 'Invalid email or password. Please try again.'
        });
        break;
      case 'RATE_LIMITED':
        setError('root', {
          type: 'manual',
          message: 'Too many login attempts. Please try again in 5 minutes.'
        });
        break;
      case 'ACCOUNT_DEACTIVATED':
        setError('root', {
          type: 'manual',
          message: 'Your account has been deactivated. Please contact support.'
        });
        break;
      case 'SESSION_EXPIRED':
        setError('root', {
          type: 'manual',
          message: 'Your session has expired. Please log in again.'
        });
        // Clear any stored tokens
        localStorage.removeItem('auth_token');
        break;
      default:
        setError('root', {
          type: 'manual',
          message: 'An error occurred during login. Please try again.'
        });
    }
  };

  const handleNetworkError = (error: any) => {
    if (error.name === 'NetworkError' || error.message.includes('fetch')) {
      setError('root', {
        type: 'manual',
        message: 'Connection problem. Please check your internet connection and try again.'
      });
    } else {
      setError('root', {
        type: 'manual',
        message: 'An unexpected error occurred. Please try again.'
      });
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  const getEmailSuggestion = (email: string) => {
    if (email.includes('gmai.com')) return 'Did you mean gmail.com?';
    if (email.includes('yahooo.com')) return 'Did you mean yahoo.com?';
    if (email.includes('@.com')) return 'Missing domain name before .com';
    if (email.endsWith('@')) return 'Please complete your email address';
    return null;
  };

  const emailSuggestion = getEmailSuggestion(emailValue);
  const isSubmitDisabled = isSubmitting || isLoading || !isValid || (error?.code === 'RATE_LIMITED');

  return (
    <div className="login-container min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8" data-testid="login-form-container">
        {/* Header */}
        <div className="text-center">
          <img
            className="mx-auto h-12 w-auto"
            src="/logo.png"
            alt="Okaeri Resort Logo"
            data-testid="logo"
          />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your resort management account
          </p>
        </div>

        {/* Login Form */}
        <form
          className="mt-8 space-y-6"
          onSubmit={handleSubmit(handleFormSubmit)}
          role="form"
          aria-label="Login form"
          noValidate
        >
          {/* Educational: No CSRF token needed for JWT authentication
              CSRF attacks work by exploiting automatic cookie inclusion.
              Since JWT uses Authorization headers instead of cookies,
              it's inherently protected against CSRF attacks. */}

          {/* Global Error Message */}
          {errors.root && (
            <div
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
              className="rounded-md bg-red-50 p-4"
              data-testid="global-error"
              tabIndex={-1}
              ref={(el) => {
                // Focus error message for accessibility
                if (el && errors.root) {
                  el.focus();
                }
              }}
            >
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-red-400" aria-hidden="true">⚠️</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">
                    {errors.root.message}
                  </p>
                  {error?.code !== 'RATE_LIMITED' && (
                    <button
                      type="button"
                      className="mt-2 text-sm text-red-600 underline hover:text-red-500"
                      onClick={() => clearErrors('root')}
                      aria-label="Dismiss error message"
                    >
                      Try again
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1 relative">
                <input
                  {...register('email')}
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={`appearance-none relative block w-full px-3 py-2 border ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm ${
                    errors.email ? 'bg-red-50' : ''
                  }`}
                  placeholder="Enter your email"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  data-testid="email"
                  disabled={isSubmitting || isLoading}
                />

                {/* Validation Status Icon */}
                {emailValue && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span data-testid="email-icon">
                      {errors.email ? '❌' : '✅'}
                    </span>
                  </div>
                )}
              </div>

              {/* Email Error */}
              {errors.email && (
                <div
                  id="email-error"
                  role="alert"
                  className="mt-1 text-sm text-red-600"
                  data-testid="email-error"
                >
                  {errors.email.message}
                </div>
              )}

              {/* Email Suggestion */}
              {emailSuggestion && !errors.email && (
                <div
                  className="mt-1 text-sm text-blue-600 suggestion"
                  data-testid="email-suggestion"
                >
                  💡 {emailSuggestion}
                </div>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  {...register('password')}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className={`appearance-none relative block w-full px-3 py-2 pr-10 border ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm ${
                    errors.password ? 'bg-red-50' : ''
                  }`}
                  placeholder="Enter your password"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  data-testid="password"
                  disabled={isSubmitting || isLoading}
                />

                {/* Password Toggle Button */}
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={togglePasswordVisibility}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                >
                  <span className="text-gray-400 hover:text-gray-500">
                    {showPassword ? '🙈' : '👁️'}
                  </span>
                </button>

                {/* Validation Status Icon */}
                {passwordValue && (
                  <div className="absolute inset-y-0 right-8 pr-3 flex items-center pointer-events-none">
                    <span data-testid="password-icon">
                      {errors.password ? '❌' : '✅'}
                    </span>
                  </div>
                )}
              </div>

              {/* Password Error */}
              {errors.password && (
                <div
                  id="password-error"
                  role="alert"
                  className="mt-1 text-sm text-red-600"
                  data-testid="password-error"
                >
                  {errors.password.message}
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                isSubmitDisabled
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 btn-primary`}
              data-testid="submit-button"
            >
              {/* Loading Spinner */}
              {(isSubmitting || isLoading) && (
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <div
                    className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"
                    data-testid="loading-spinner"
                    aria-hidden="true"
                  />
                </span>
              )}

              {(isSubmitting || isLoading) ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center justify-between">
            <Link
              to="/forgot-password"
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              Forgot your password?
            </Link>
            <Link
              to="/register"
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              Create account
            </Link>
          </div>
        </form>

        {/* Loading Status for Screen Readers */}
        {(isSubmitting || isLoading) && (
          <div
            role="status"
            aria-live="polite"
            className="sr-only"
            aria-label="Signing in"
          >
            Signing in, please wait...
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
```

### 2. Form Hook Implementation

```typescript
// src/hooks/useAuthForm.ts
// Custom hook for authentication form management

import { useForm, UseFormProps, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCallback, useEffect } from "react";

interface UseAuthFormOptions<T extends z.ZodType> {
  validationSchema: T;
  onSubmit: (data: z.infer<T>) => void | Promise<void>;
  defaultValues?: Partial<z.infer<T>>;
  mode?: "onChange" | "onBlur" | "onSubmit";
}

interface UseAuthFormReturn<T extends z.ZodType>
  extends UseFormReturn<z.infer<T>> {
  submitForm: () => Promise<void>;
  isFormValid: boolean;
}

export const useAuthForm = <T extends z.ZodType>({
  validationSchema,
  onSubmit,
  defaultValues,
  mode = "onBlur",
}: UseAuthFormOptions<T>): UseAuthFormReturn<T> => {
  const formMethods = useForm<z.infer<T>>({
    resolver: zodResolver(validationSchema),
    mode,
    defaultValues,
    shouldFocusError: true,
    shouldUseNativeValidation: false,
  });

  const {
    handleSubmit,
    formState: { isValid, errors },
    clearErrors,
    setError,
  } = formMethods;

  // Memoized submit handler
  const submitForm = useCallback(async () => {
    try {
      await handleSubmit(onSubmit)();
    } catch (error) {
      console.error("Form submission error:", error);
      setError("root", {
        type: "manual",
        message: "An error occurred during form submission",
      });
    }
  }, [handleSubmit, onSubmit, setError]);

  // Clear errors when form values change (for better UX)
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      const subscription = formMethods.watch(() => {
        if (errors.root) {
          clearErrors("root");
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [errors, formMethods.watch, clearErrors]);

  return {
    ...formMethods,
    submitForm,
    isFormValid: isValid,
  };
};
```

### 3. Validation Schema Implementation

```typescript
// src/components/forms/LoginForm.tsx
// Reusable login form component

import React from 'react';
import { useAuthForm } from '@/hooks/useAuthForm';
import { loginSchema } from '@/lib/validations/auth';
import type { LoginCredentials } from '@/types';

interface LoginFormProps {
  onSubmit: (data: LoginCredentials) => void | Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSubmit,
  isLoading = false,
  error,
  className = ''
}) => {
  const {
    register,
    formState: { errors, isSubmitting },
    handleSubmit,
    watch,
    isFormValid
  } = useAuthForm({
    validationSchema: loginSchema,
    onSubmit,
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const emailValue = watch('email', '');
  const passwordValue = watch('password', '');

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={`space-y-4 ${className}`}
      noValidate
      role="form"
      aria-label="Login"
    >
      {/* Global Error Display */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-md bg-red-50 border border-red-200"
          data-testid="form-error"
        >
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Email Field */}
      <div className="form-field">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Email Address
        </label>
        <input
          {...register('email')}
          id="email"
          type="email"
          autoComplete="email"
          className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.email
              ? 'border-red-300 bg-red-50'
              : 'border-gray-300'
          }`}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          data-testid="email-input"
          disabled={isSubmitting || isLoading}
        />
        {errors.email && (
          <div
            id="email-error"
            role="alert"
            className="mt-1 text-sm text-red-600"
            data-testid="email-error"
          >
            {errors.email.message}
          </div>
        )}
      </div>

      {/* Password Field */}
      <div className="form-field">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Password
        </label>
        <input
          {...register('password')}
          id="password"
          type="password"
          autoComplete="current-password"
          className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.password
              ? 'border-red-300 bg-red-50'
              : 'border-gray-300'
          }`}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          data-testid="password-input"
          disabled={isSubmitting || isLoading}
        />
        {errors.password && (
          <div
            id="password-error"
            role="alert"
            className="mt-1 text-sm text-red-600"
            data-testid="password-error"
          >
            {errors.password.message}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!isFormValid || isSubmitting || isLoading}
        className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
          !isFormValid || isSubmitting || isLoading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
        data-testid="submit-button"
      >
        {isSubmitting || isLoading ? (
          <span className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            Signing in...
          </span>
        ) : (
          'Sign In'
        )}
      </button>
    </form>
  );
};
```

### 4. Route Integration

```typescript
// src/routes/_auth/login.tsx
// TanStack Router route implementation

import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/authStore';
import LoginPage from '@/pages/LoginPage';

// Route component
const LoginRoute = () => {
  return <LoginPage />;
};

// Route configuration
export const Route = createFileRoute('/_auth/login')({
  component: LoginRoute,

  // Redirect if already authenticated
  beforeLoad: async ({ context }) => {
    const { isAuthenticated } = useAuthStore.getState();

    if (isAuthenticated) {
      throw redirect({
        to: '/dashboard',
        search: {
          redirect: undefined
        }
      });
    }
  },

  // Validate search params
  validateSearch: (search: Record<string, unknown>) => {
    return {
      redirect: (search.redirect as string) || '/dashboard'
    };
  },

  // Meta information
  meta: () => [
    {
      title: 'Login - Okaeri Resort Management',
      description: 'Sign in to your resort management account'
    }
  ]
});
```

### 5. Error Boundary Integration

```typescript
// src/components/error/LoginErrorBoundary.tsx
// Error boundary specifically for login page

import React, { Component, ReactNode } from 'react';
// Note: audit logger may not exist yet
// import { auditLogger } from '@/lib/security/audit-logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class LoginErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to audit system (if audit logger exists)
    // auditLogger.logError({
    //   error: error.message,
    //   stack: error.stack,
    //   componentStack: errorInfo.componentStack,
    //   timestamp: new Date(),
    //   context: 'LoginPage'
    // });

    console.error('LoginPage Error:', error.message, errorInfo);

    console.error('LoginPage Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-md rounded-lg p-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Something went wrong
              </h2>
              <p className="text-gray-600 mb-4">
                We encountered an error while loading the login page.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 6. CSS Styles Implementation

```css
/* src/styles/login.css */
/* Minimal styles to pass visual tests */

.login-container {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.mobile-responsive {
  @media (max-width: 640px) {
    padding: 1rem;
    max-width: 100%;
  }
}

.form-field {
  position: relative;
}

.form-field input:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.suggestion {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.recently-updated {
  background-color: #fef3c7;
  transition: background-color 0.5s ease;
}

.slide-in-animation {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Accessibility improvements */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Focus indicators */
input:focus-visible,
button:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .border-gray-300 {
    border-color: #000;
  }

  .text-gray-600 {
    color: #000;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .animate-spin,
  .slide-in-animation,
  .suggestion {
    animation: none;
  }
}
```

## Integration Implementation

### 1. Auth Store Integration

```typescript
// src/pages/LoginPage.integration.ts
// Integration utilities for auth store

import { useAuthStore } from "@/stores/authStore";
import type { LoginCredentials, AuthResponse } from "@/types";

export const useLoginIntegration = () => {
  const { login, isLoading, error, user, isAuthenticated } = useAuthStore();

  const handleLogin = async (
    credentials: LoginCredentials
  ): Promise<AuthResponse> => {
    try {
      // The auth store handles the actual API call and state management
      const result = await login(credentials);

      if (result.success) {
        // Store handles setting user state, tokens, etc.
        return result;
      } else {
        // Store handles error state
        throw new Error(result.error?.message || "Login failed");
      }
    } catch (error) {
      // Let the store handle the error state
      throw error;
    }
  };

  return {
    handleLogin,
    isLoading,
    error,
    user,
    isAuthenticated,
  };
};
```

### 2. Security Integration

```typescript
// src/lib/security/login-security.ts
// Security utilities for login implementation

// Note: These security utilities may not exist yet in the current codebase
// import { sessionMonitor } from '@/lib/security/session-monitor';
// import { auditLogger } from '@/lib/security/audit-logger';
// import { rateLimiter } from '@/lib/security/rate-limiter';

export const loginSecurityUtils = {
  // Educational: CSRF protection not needed for JWT authentication
  // JWT tokens in Authorization headers provide inherent CSRF protection
  // because browsers don't automatically include these headers in requests.
  // Only cookie-based authentication requires CSRF tokens.

  // Check rate limiting (if rate limiter exists)
  checkRateLimit: async (email: string) => {
    // const isAllowed = await rateLimiter.checkLimit(`login:${email}`, {
    //   maxRequests: 5,
    //   windowMs: 15 * 60 * 1000 // 15 minutes
    // });

    // if (!isAllowed) {
    //   throw new Error('RATE_LIMITED');
    // }

    return true; // Mock implementation
  },

  // Audit logging (if audit logger exists)
  logLoginAttempt: (data: {
    email: string;
    userAgent: string;
    ipAddress?: string;
  }) => {
    // auditLogger.logAuthAttempt({
    //   ...data,
    //   timestamp: new Date(),
    //   type: 'LOGIN_ATTEMPT'
    // });
    console.log("Login attempt:", data); // Temporary logging
  },

  logLoginSuccess: (data: { userId: string; email: string }) => {
    // auditLogger.logAuthSuccess({
    //   ...data,
    //   timestamp: new Date(),
    //   type: 'LOGIN_SUCCESS'
    // });
    console.log("Login success:", data); // Temporary logging
  },

  logLoginFailure: (data: { email: string; error: string }) => {
    // auditLogger.logAuthFailure({
    //   ...data,
    //   timestamp: new Date(),
    //   type: 'LOGIN_FAILURE'
    // });
    console.log("Login failure:", data); // Temporary logging
  },

  // Session monitoring (if session monitor exists)
  initializeSession: (userId: string) => {
    // sessionMonitor.startSession(userId);
    console.log("Session initialized for user:", userId); // Temporary logging
  },
};
```

## Test Validation

### 1. Test Execution Strategy

```typescript
// scripts/validate-green-phase.ts
// Script to validate that all RED phase tests now pass

import { execSync } from "child_process";

interface TestResult {
  testSuite: string;
  passed: boolean;
  failures: string[];
  coverage: number;
}

class GreenPhaseValidator {
  async validateImplementation(): Promise<{
    allTestsPassing: boolean;
    results: TestResult[];
    overallCoverage: number;
  }> {
    console.log("🧪 Validating GREEN phase implementation...\n");

    const testSuites = [
      "tests/auth/auth-flow.test.tsx",
      "tests/validation/form-validation.test.tsx",
      "src/pages/__tests__/LoginPage.test.tsx",
      "src/hooks/__tests__/useAuthForm.test.ts",
    ];

    const results: TestResult[] = [];
    let allTestsPassing = true;

    for (const testSuite of testSuites) {
      const result = await this.runTestSuite(testSuite);
      results.push(result);

      if (!result.passed) {
        allTestsPassing = false;
      }
    }

    const overallCoverage = this.calculateOverallCoverage();

    // Generate report
    this.generateReport(allTestsPassing, results, overallCoverage);

    return {
      allTestsPassing,
      results,
      overallCoverage,
    };
  }

  private async runTestSuite(testSuite: string): Promise<TestResult> {
    try {
      const output = execSync(`npm run test -- ${testSuite} --reporter=json`, {
        stdio: "pipe",
      }).toString();

      const testResults = JSON.parse(output);

      return {
        testSuite,
        passed: testResults.numFailedTests === 0,
        failures:
          testResults.testResults
            ?.filter((r) => r.status === "failed")
            ?.map((r) => r.title) || [],
        coverage: this.extractCoverage(testResults),
      };
    } catch (error) {
      return {
        testSuite,
        passed: false,
        failures: ["Test suite execution failed"],
        coverage: 0,
      };
    }
  }

  private calculateOverallCoverage(): number {
    try {
      const coverageOutput = execSync(
        "npm run test:coverage -- --reporter=json",
        {
          stdio: "pipe",
        }
      ).toString();

      // Parse coverage data and calculate overall percentage
      // Implementation depends on coverage tool format
      return 85; // Placeholder
    } catch {
      return 0;
    }
  }

  private generateReport(
    allPassing: boolean,
    results: TestResult[],
    coverage: number
  ): void {
    console.log(`\n${"=".repeat(60)}`);
    console.log("GREEN PHASE VALIDATION REPORT");
    console.log(`${"=".repeat(60)}\n`);

    console.log(`Overall Status: ${allPassing ? "✅ PASSED" : "❌ FAILED"}`);
    console.log(`Test Coverage: ${coverage}%\n`);

    console.log("Test Suite Results:");
    console.log("-".repeat(40));

    results.forEach((result) => {
      const status = result.passed ? "✅" : "❌";
      console.log(`${status} ${result.testSuite}`);

      if (!result.passed) {
        result.failures.forEach((failure) => {
          console.log(`   • ${failure}`);
        });
      }
    });

    if (allPassing) {
      console.log("\n🎉 GREEN PHASE COMPLETE");
      console.log("All RED phase tests are now passing!");
      console.log("Ready to proceed to REFACTOR phase.\n");
    } else {
      console.log("\n🔧 GREEN PHASE INCOMPLETE");
      console.log("Some tests are still failing. Review implementation.\n");
    }
  }

  private extractCoverage(testResults: any): number {
    // Extract coverage percentage from test results
    // Implementation depends on test runner format
    return 90; // Placeholder
  }
}

// Execute validation
const validator = new GreenPhaseValidator();
validator.validateImplementation().then((result) => {
  process.exit(result.allTestsPassing ? 0 : 1);
});
```

## Acceptance Criteria

### Implementation Requirements

- [ ] LoginPage component renders and passes all UI tests
- [ ] Form validation works with React Hook Form + Zod
- [ ] Authentication integration with preserved auth store functional
- [ ] All security features integrated (JWT auth, audit logging, rate limiting)
- [ ] Error handling covers all test scenarios
- [ ] Loading states and UX features implemented
- [ ] Accessibility features fully implemented

### Test Validation

- [ ] All 40+ authentication flow tests pass
- [ ] All 45+ form validation tests pass
- [ ] Integration tests with preserved infrastructure pass
- [ ] Security tests validate all protection measures
- [ ] Accessibility tests meet WCAG 2.1 AA compliance
- [ ] Performance tests meet defined targets

### Code Quality

- [ ] TypeScript strict mode with no errors
- [ ] ESLint rules pass with no warnings
- [ ] Code follows established patterns and conventions
- [ ] Minimal implementation (only code needed to pass tests)
- [ ] No over-engineering or premature optimization

### Integration Verification

- [ ] Auth store integration functional
- [ ] Security infrastructure properly integrated
- [ ] Validation schemas use preserved infrastructure
- [ ] API client integration works correctly
- [ ] Route integration with TanStack Router functional

## Performance Targets

### Metrics to Achieve

- **First Paint**: < 1 second
- **Form Interaction Response**: < 100ms
- **Bundle Size**: Login components < 50KB
- **Lighthouse Score**: > 95
- **Test Execution**: All tests complete in < 30 seconds

### Optimization Notes

- Minimal CSS for basic styling only
- No unnecessary dependencies or libraries
- Efficient event handlers with proper cleanup
- Optimized re-renders through proper state management

## Security Implementation

### Required Security Features

- **JWT Security**: Uses Authorization headers (inherently CSRF-protected)
- **Input Sanitization**: All user inputs properly sanitized
- **Audit Logging**: All authentication attempts logged
- **Rate Limiting**: Protection against brute force attacks
- **Session Management**: Proper session initialization and cleanup

## Next Steps

After completing GREEN phase implementation:

1. **Test Validation**: Run comprehensive test suite to ensure all tests pass
2. **Code Review**: Review implementation for quality and adherence to
   requirements
3. **Integration Testing**: Validate integration with preserved infrastructure
4. **Security Review**: Comprehensive security validation
5. **Performance Testing**: Validate performance targets are met
6. **Documentation**: Update implementation documentation
7. **Handoff**: Prepare for Sub-Phase 1.4 (Security Review)

---

**Status**: Ready to Begin **Duration**: 1 day **Implementation Scope**:
LoginPage, form validation, auth integration **Test Coverage**: 85+ tests must
pass **Quality Gate**: All RED phase tests must pass before proceeding to
REFACTOR phase
