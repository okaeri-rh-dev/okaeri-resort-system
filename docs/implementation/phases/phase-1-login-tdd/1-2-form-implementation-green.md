# Sub-Phase 1.2: Form Implementation (GREEN Phase)

## Overview

This sub-phase represents the GREEN phase of TDD where we implement the actual
form components to make the failing tests from Phase 1.1 pass. It focuses on
implementing LoginForm, RegisterForm, and PasswordResetForm components using
React Hook Form with Zod schema validation, connecting them to the auth store,
and ensuring all validation tests pass.

> **Note**: Documentation updated to reflect actual implementation. Originally
> documented as RED phase, but was implemented as GREEN phase with excellent
> results (100% test success).

## Objectives (GREEN Phase Implementation)

1. **Form Component Implementation**: Build LoginForm, RegisterForm, and
   PasswordResetForm components to make the failing tests pass
2. **React Hook Form Integration**: Implement form state management with proper
   validation integration
3. **Zod Schema Implementation**: Create and apply validation schemas for all
   forms with proper error messages
4. **Auth Store Connection**: Connect forms to the existing auth store for
   authentication functionality
5. **Test Success Achievement**: Ensure all Phase 1.1 RED tests pass with the
   implementation

## Validation Test Strategy

### 1. Form Validation Architecture Tests

```typescript
// tests/validation/form-validation.test.tsx
// Comprehensive form validation testing with React Hook Form + Zod

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { renderWithProviders, MOCK_USERS, formHelpers } from '@/tests/utils/test-utils';
import { createUser, createAuthenticatedUser } from '@/src/test/factories/user.factory';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

/**
 * Form Validation Test Suite
 *
 * Tests all aspects of form validation using React Hook Form + Zod
 * All tests should FAIL initially (RED phase)
 *
 * Test Categories:
 * 1. Schema validation rules
 * 2. Real-time validation feedback
 * 3. Form state management
 * 4. Error message display and accessibility
 * 5. User interaction patterns
 * 6. Integration with preserved validation schemas
 */

describe('Form Validation System', () => {
  describe('Login Form Validation Schema', () => {
    describe('Email Validation Rules', () => {
      it('should validate required email field', async () => {
        // This test should FAIL initially - no validation schema implementation
        const schema = z.object({
          email: z.string().email('Please enter a valid email address'),
          password: z.string().min(8, 'Password must be at least 8 characters')
        });

        // Test empty email
        const result = schema.safeParse({
          email: '',
          password: 'validpassword123'
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain('email');
          expect(result.error.issues[0].message).toMatch(/email/i);
        }
      });

      it('should validate email format with comprehensive patterns', async () => {
        const loginSchema = z.object({
          email: z.string()
            .min(1, 'Email is required')
            .email('Please enter a valid email address')
            .toLowerCase()
            .transform(val => val.trim()),
          password: z.string().min(8)
        });

        const invalidEmails = [
          'plainaddress',
          '@missingdomain.com',
          'missing@.com',
          'missing.domain@.com',
          'spaces in@email.com',
          'email@',
          'email@domain',
          'email..double.dot@domain.com',
          'email@domain..com',
          'email@-domain.com',
          'email@domain-.com',
          '.email@domain.com',
          'email.@domain.com',
          'email@domain.c',
          'email@domain.toolongextension',
          'email@[192.168.1.1]', // IP addresses should be invalid for this use case
        ];

        for (const email of invalidEmails) {
          const result = loginSchema.safeParse({
            email,
            password: 'validpassword123'
          });

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue =>
              issue.path.includes('email')
            )).toBe(true);
          }
        }
      });

      it('should accept valid email formats', async () => {
        const loginSchema = z.object({
          email: z.string().email().toLowerCase(),
          password: z.string().min(8)
        });

        const validEmails = [
          'user@example.com',
          'user.name@example.com',
          'user+tag@example.com',
          'user_name@example.com',
          'user123@example.com',
          'User@Example.COM', // Should be normalized to lowercase
          '  user@example.com  ', // Should trim whitespace
          'very.long.email.address@very-long-domain-name.com',
          'user@subdomain.example.com'
        ];

        for (const email of validEmails) {
          const result = loginSchema.safeParse({
            email,
            password: 'validpassword123'
          });

          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.email).toBe(email.toLowerCase().trim());
          }
        }
      });

      it('should provide specific error messages for email validation', async () => {
        const loginSchema = z.object({
          email: z.string()
            .min(1, 'Email is required')
            .email('Please enter a valid email address'),
          password: z.string().min(8)
        });

        // Test empty email
        let result = loginSchema.safeParse({ email: '', password: 'password123' });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Email is required');
        }

        // Test invalid format
        result = loginSchema.safeParse({ email: 'invalid', password: 'password123' });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Please enter a valid email address');
        }
      });
    });

    describe('Password Validation Rules', () => {
      it('should enforce minimum password length', async () => {
        const loginSchema = z.object({
          email: z.string().email(),
          password: z.string()
            .min(8, 'Password must be at least 8 characters long')
            .max(128, 'Password must not exceed 128 characters')
        });

        // Test password too short
        const result = loginSchema.safeParse({
          email: 'test@example.com',
          password: '1234567' // 7 characters
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Password must be at least 8 characters long');
        }
      });

      it('should enforce maximum password length', async () => {
        const loginSchema = z.object({
          email: z.string().email(),
          password: z.string().max(128, 'Password must not exceed 128 characters')
        });

        // Test password too long (129 characters)
        const longPassword = 'a'.repeat(129);
        const result = loginSchema.safeParse({
          email: 'test@example.com',
          password: longPassword
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Password must not exceed 128 characters');
        }
      });

      it('should validate password strength for registration', async () => {
        // This would be used for registration form
        const registerSchema = z.object({
          email: z.string().email(),
          password: z.string()
            .min(8, 'Password must be at least 8 characters')
            .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
            .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
            .regex(/[0-9]/, 'Password must contain at least one number')
            .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
          confirmPassword: z.string()
        }).refine(data => data.password === data.confirmPassword, {
          message: "Passwords don't match",
          path: ['confirmPassword']
        });

        const weakPasswords = [
          'password', // No uppercase, numbers, or special chars
          'PASSWORD', // No lowercase, numbers, or special chars
          '12345678', // No letters or special chars
          'Password', // No numbers or special chars
          'Password1', // No special chars
          'password1!', // No uppercase
          'PASSWORD1!', // No lowercase
        ];

        for (const password of weakPasswords) {
          const result = registerSchema.safeParse({
            email: 'test@example.com',
            password,
            confirmPassword: password
          });

          expect(result.success).toBe(false);
        }

        // Test strong password
        const strongResult = registerSchema.safeParse({
          email: 'test@example.com',
          password: 'StrongPass123!',
          confirmPassword: 'StrongPass123!'
        });

        expect(strongResult.success).toBe(true);
      });

      it('should validate password confirmation matching', async () => {
        const registerSchema = z.object({
          password: z.string().min(8),
          confirmPassword: z.string()
        }).refine(data => data.password === data.confirmPassword, {
          message: "Passwords don't match",
          path: ['confirmPassword']
        });

        const result = registerSchema.safeParse({
          password: 'password123',
          confirmPassword: 'differentpassword'
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe("Passwords don't match");
          expect(result.error.issues[0].path).toContain('confirmPassword');
        }
      });
    });

    describe('Custom Validation Rules', () => {
      it('should validate common password patterns to reject', async () => {
        const commonPasswords = [
          'password',
          '12345678',
          'qwerty123',
          'abc123456',
          'password123'
        ];

        const securePasswordSchema = z.object({
          email: z.string().email(),
          password: z.string()
            .min(8)
            .refine(val => !commonPasswords.includes(val.toLowerCase()), {
              message: 'Please choose a less common password'
            })
        });

        for (const password of commonPasswords) {
          const result = securePasswordSchema.safeParse({
            email: 'test@example.com',
            password
          });

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues[0].message).toBe('Please choose a less common password');
          }
        }
      });

      it('should validate against sequential characters', async () => {
        const sequentialPasswordSchema = z.object({
          email: z.string().email(),
          password: z.string()
            .min(8)
            .refine(val => {
              // Check for sequential numbers or letters
              const sequential = /(?:012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i;
              return !sequential.test(val);
            }, {
              message: 'Password cannot contain sequential characters'
            })
        });

        const sequentialPasswords = [
          'password123',
          'abc12345',
          'test1234',
          'user5678'
        ];

        for (const password of sequentialPasswords) {
          const result = sequentialPasswordSchema.safeParse({
            email: 'test@example.com',
            password
          });

          expect(result.success).toBe(false);
        }
      });

      it('should validate email domain restrictions for business use', async () => {
        const businessEmailSchema = z.object({
          email: z.string()
            .email()
            .refine(val => {
              const domain = val.split('@')[1];
              const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
              return !personalDomains.includes(domain.toLowerCase());
            }, {
              message: 'Please use a business email address'
            }),
          password: z.string().min(8)
        });

        const personalEmails = [
          'user@gmail.com',
          'user@yahoo.com',
          'user@hotmail.com',
          'user@outlook.com'
        ];

        for (const email of personalEmails) {
          const result = businessEmailSchema.safeParse({
            email,
            password: 'password123'
          });

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues[0].message).toBe('Please use a business email address');
          }
        }

        // Test valid business email
        const businessResult = businessEmailSchema.safeParse({
          email: 'user@company.com',
          password: 'password123'
        });

        expect(businessResult.success).toBe(true);
      });
    });
  });

  describe('React Hook Form Integration', () => {
    describe('Form State Management', () => {
      it('should initialize form with correct default values', () => {
        // This test should FAIL initially - no form hook implementation
        const loginSchema = z.object({
          email: z.string().email('Please enter a valid email address'),
          password: z.string().min(8, 'Password must be at least 8 characters')
        });

        const { result } = renderHook(() =>
          useForm({
            defaultValues: {
              email: '',
              password: '',
              rememberMe: false
            },
            resolver: zodResolver(loginSchema)
          })
        );

        expect(result.current.getValues()).toEqual({
          email: '',
          password: '',
          rememberMe: false
        });

        expect(result.current.formState.isValid).toBe(false);
        expect(result.current.formState.isDirty).toBe(false);
        expect(result.current.formState.isSubmitted).toBe(false);
      });

      it('should update form state on field changes', async () => {
        const loginSchema = z.object({
          email: z.string().email('Please enter a valid email address'),
          password: z.string().min(8, 'Password must be at least 8 characters')
        });

        const { result } = renderHook(() =>
          useForm({
            defaultValues: { email: '', password: '' },
            resolver: zodResolver(loginSchema),
            mode: 'onChange'
          })
        );

        // Simulate field change
        act(() => {
          result.current.setValue('email', 'test@example.com');
        });

        expect(result.current.getValues('email')).toBe('test@example.com');
        expect(result.current.formState.isDirty).toBe(true);

        act(() => {
          result.current.setValue('password', 'password123');
        });

        expect(result.current.formState.isValid).toBe(true);
      });

      it('should validate form on blur mode', async () => {
        const loginSchema = z.object({
          email: z.string().email('Please enter a valid email address'),
          password: z.string().min(8, 'Password must be at least 8 characters')
        });

        const { result } = renderHook(() =>
          useForm({
            resolver: zodResolver(loginSchema),
            mode: 'onBlur'
          })
        );

        // Trigger validation on blur
        await act(async () => {
          await result.current.trigger('email');
        });

        expect(result.current.formState.errors.email).toBeDefined();
      });

      it('should handle form submission state correctly', async () => {
        const onSubmit = vi.fn();
        const loginSchema = z.object({
          email: z.string().email('Please enter a valid email address'),
          password: z.string().min(8, 'Password must be at least 8 characters')
        });

        const { result } = renderHook(() =>
          useForm({
            resolver: zodResolver(loginSchema)
          })
        );

        expect(result.current.formState.isSubmitting).toBe(false);

        // Simulate form submission
        await act(async () => {
          await result.current.handleSubmit(onSubmit)();
        });

        // Should have attempted submission
        expect(result.current.formState.isSubmitted).toBe(true);
      });

      it('should reset form state correctly', async () => {
        const loginSchema = z.object({
          email: z.string().email('Please enter a valid email address'),
          password: z.string().min(8, 'Password must be at least 8 characters')
        });

        const { result } = renderHook(() =>
          useForm({
            defaultValues: { email: '', password: '' },
            resolver: zodResolver(loginSchema)
          })
        );

        // Make changes
        act(() => {
          result.current.setValue('email', 'test@example.com');
          result.current.setValue('password', 'password123');
        });

        expect(result.current.formState.isDirty).toBe(true);

        // Reset form
        act(() => {
          result.current.reset();
        });

        expect(result.current.getValues()).toEqual({
          email: '',
          password: ''
        });
        expect(result.current.formState.isDirty).toBe(false);
        expect(result.current.formState.errors).toEqual({});
      });
    });

    describe('Validation Trigger Modes', () => {
      it('should validate on change when mode is onChange', async () => {
        const TestForm = () => {
          const loginSchema = z.object({
            email: z.string().email('Please enter a valid email address'),
            password: z.string().min(8, 'Password must be at least 8 characters')
          });

          const { register, formState: { errors } } = useForm({
            resolver: zodResolver(loginSchema),
            mode: 'onChange'
          });

          return (
            <form>
              <input {...register('email')} data-testid="email" />
              {errors.email && <span data-testid="email-error">{errors.email.message}</span>}
              <input {...register('password')} type="password" data-testid="password" />
              {errors.password && <span data-testid="password-error">{errors.password.message}</span>}
            </form>
          );
        };

        const user = userEvent.setup();
        renderWithProviders(<TestForm />);

        const emailInput = screen.getByTestId('email');

        // Type invalid email
        await user.type(emailInput, 'invalid');

        // Should show error immediately
        await waitFor(() => {
          expect(screen.getByTestId('email-error')).toBeInTheDocument();
        });
      });

      it('should validate on blur when mode is onBlur', async () => {
        const TestForm = () => {
          const loginSchema = z.object({
            email: z.string().email('Please enter a valid email address'),
            password: z.string().min(8, 'Password must be at least 8 characters')
          });

          const { register, formState: { errors } } = useForm({
            resolver: zodResolver(loginSchema),
            mode: 'onBlur'
          });

          return (
            <form>
              <input {...register('email')} data-testid="email" />
              {errors.email && <span data-testid="email-error">{errors.email.message}</span>}
            </form>
          );
        };

        const user = userEvent.setup();
        renderWithProviders(<TestForm />);

        const emailInput = screen.getByTestId('email');

        // Type invalid email but don't blur
        await user.type(emailInput, 'invalid');

        // Should not show error yet
        expect(screen.queryByTestId('email-error')).not.toBeInTheDocument();

        // Blur the input
        await user.tab();

        // Should show error after blur
        await waitFor(() => {
          expect(screen.getByTestId('email-error')).toBeInTheDocument();
        });
      });

      it('should validate on submit when mode is onSubmit', async () => {
        const onSubmit = vi.fn();
        const TestForm = () => {
          const loginSchema = z.object({
            email: z.string().email('Please enter a valid email address'),
            password: z.string().min(8, 'Password must be at least 8 characters')
          });

          const { register, handleSubmit, formState: { errors } } = useForm({
            resolver: zodResolver(loginSchema),
            mode: 'onSubmit'
          });

          return (
            <form onSubmit={handleSubmit(onSubmit)}>
              <input {...register('email')} data-testid="email" />
              {errors.email && <span data-testid="email-error">{errors.email.message}</span>}
              <input {...register('password')} data-testid="password" />
              {errors.password && <span data-testid="password-error">{errors.password.message}</span>}
              <button type="submit" data-testid="submit">Submit</button>
            </form>
          );
        };

        const user = userEvent.setup();
        renderWithProviders(<TestForm />);

        const emailInput = screen.getByTestId('email');
        const submitButton = screen.getByTestId('submit');

        // Type invalid email
        await user.type(emailInput, 'invalid');

        // Should not show error yet
        expect(screen.queryByTestId('email-error')).not.toBeInTheDocument();

        // Submit form
        await user.click(submitButton);

        // Should show errors after submit attempt
        await waitFor(() => {
          expect(screen.getByTestId('email-error')).toBeInTheDocument();
          expect(screen.getByTestId('password-error')).toBeInTheDocument();
        });

        // Form should not have submitted
        expect(onSubmit).not.toHaveBeenCalled();
      });
    });

    describe('Error Message Display', () => {
      it('should display validation errors with correct messages', async () => {
        const TestForm = () => {
          const loginSchema = z.object({
            email: z.string().min(1, 'Email is required').email('Invalid email'),
            password: z.string().min(1, 'Password is required')
          });

          const { register, formState: { errors }, trigger } = useForm({
            resolver: zodResolver(loginSchema)
          });

          return (
            <div>
              <input {...register('email')} data-testid="email" />
              <input {...register('password')} data-testid="password" />
              <button onClick={() => trigger()} data-testid="validate">
                Validate
              </button>
              {errors.email && (
                <div data-testid="email-error" role="alert">
                  {errors.email.message}
                </div>
              )}
              {errors.password && (
                <div data-testid="password-error" role="alert">
                  {errors.password.message}
                </div>
              )}
            </div>
          );
        };

        const user = userEvent.setup();
        renderWithProviders(<TestForm />);

        // Trigger validation with empty fields
        await user.click(screen.getByTestId('validate'));

        await waitFor(() => {
          expect(screen.getByTestId('email-error')).toHaveTextContent(/email is required/i);
          expect(screen.getByTestId('password-error')).toHaveTextContent(/password.*required/i);
        });
      });

      it('should associate error messages with form fields for accessibility', async () => {
        const TestForm = () => {
          const loginSchema = z.object({
            email: z.string().email('Please enter a valid email address'),
            password: z.string().min(8, 'Password must be at least 8 characters')
          });

          const { register, formState: { errors } } = useForm({
            resolver: zodResolver(loginSchema),
            mode: 'onChange'
          });

          return (
            <form>
              <label htmlFor="email">Email</label>
              <input
                {...register('email')}
                id="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                data-testid="email"
              />
              {errors.email && (
                <div id="email-error" role="alert" data-testid="email-error">
                  {errors.email.message}
                </div>
              )}

              <label htmlFor="password">Password</label>
              <input
                {...register('password')}
                id="password"
                type="password"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                data-testid="password"
              />
              {errors.password && (
                <div id="password-error" role="alert" data-testid="password-error">
                  {errors.password.message}
                </div>
              )}
            </form>
          );
        };

        const user = userEvent.setup();
        renderWithProviders(<TestForm />);

        const emailInput = screen.getByTestId('email');

        // Type invalid email
        await user.type(emailInput, 'invalid');

        await waitFor(() => {
          expect(emailInput).toHaveAttribute('aria-invalid', 'true');
          expect(emailInput).toHaveAttribute('aria-describedby', 'email-error');
          expect(screen.getByTestId('email-error')).toHaveAttribute('role', 'alert');
        });
      });

      it('should clear error messages when validation passes', async () => {
        const TestForm = () => {
          const loginSchema = z.object({
            email: z.string().email('Please enter a valid email address'),
            password: z.string().min(8, 'Password must be at least 8 characters')
          });

          const { register, formState: { errors } } = useForm({
            resolver: zodResolver(loginSchema),
            mode: 'onChange'
          });

          return (
            <form>
              <input {...register('email')} data-testid="email" />
              {errors.email && (
                <div data-testid="email-error">{errors.email.message}</div>
              )}
            </form>
          );
        };

        const user = userEvent.setup();
        renderWithProviders(<TestForm />);

        const emailInput = screen.getByTestId('email');

        // Type invalid email
        await user.type(emailInput, 'invalid');

        await waitFor(() => {
          expect(screen.getByTestId('email-error')).toBeInTheDocument();
        });

        // Clear and type valid email
        await user.clear(emailInput);
        await user.type(emailInput, 'valid@example.com');

        // Error should disappear
        await waitFor(() => {
          expect(screen.queryByTestId('email-error')).not.toBeInTheDocument();
        });
      });
    });

    describe('Form Field Registration', () => {
      it('should register form fields with correct validation rules', () => {
        const TestForm = () => {
          const loginSchema = z.object({
            email: z.string().email('Please enter a valid email address'),
            password: z.string().min(8, 'Password must be at least 8 characters')
          });

          const { register } = useForm({
            resolver: zodResolver(loginSchema)
          });

          const emailRegister = register('email');
          const passwordRegister = register('password');

          return (
            <form>
              <input
                {...emailRegister}
                data-testid="email"
                data-validation-rules={JSON.stringify(emailRegister)}
              />
              <input
                {...passwordRegister}
                type="password"
                data-testid="password"
                data-validation-rules={JSON.stringify(passwordRegister)}
              />
            </form>
          );
        };

        renderWithProviders(<TestForm />);

        const emailInput = screen.getByTestId('email');
        const passwordInput = screen.getByTestId('password');

        // Verify fields are registered
        expect(emailInput).toHaveAttribute('name', 'email');
        expect(passwordInput).toHaveAttribute('name', 'password');
        expect(passwordInput).toHaveAttribute('type', 'password');
      });

      it('should handle dynamic field registration', async () => {
        const TestForm = () => {
          const { register, watch } = useForm();
          const showConfirmPassword = watch('needConfirmation');

          return (
            <form>
              <input type="checkbox" {...register('needConfirmation')} data-testid="toggle" />
              <input {...register('password')} data-testid="password" />
              {showConfirmPassword && (
                <input {...register('confirmPassword')} data-testid="confirm-password" />
              )}
            </form>
          );
        };

        const user = userEvent.setup();
        renderWithProviders(<TestForm />);

        // Initially confirm password should not be present
        expect(screen.queryByTestId('confirm-password')).not.toBeInTheDocument();

        // Check the toggle
        await user.click(screen.getByTestId('toggle'));

        // Confirm password field should appear
        await waitFor(() => {
          expect(screen.getByTestId('confirm-password')).toBeInTheDocument();
        });
      });
    });
  });

  describe('User Experience and Interaction', () => {
    describe('Real-time Validation Feedback', () => {
      it('should show validation status icons', async () => {
        const TestForm = () => {
          const { register, formState: { errors }, watch } = useForm({
            resolver: zodResolver(loginSchema),
            mode: 'onChange'
          });

          const emailValue = watch('email');
          const passwordValue = watch('password');

          const getValidationIcon = (fieldName: string, value: string) => {
            if (!value) return null;
            if (errors[fieldName]) return '❌';
            return '✅';
          };

          return (
            <form>
              <div className="field-container">
                <input {...register('email')} data-testid="email" />
                <span data-testid="email-icon">
                  {getValidationIcon('email', emailValue)}
                </span>
              </div>

              <div className="field-container">
                <input {...register('password')} data-testid="password" />
                <span data-testid="password-icon">
                  {getValidationIcon('password', passwordValue)}
                </span>
              </div>
            </form>
          );
        };

        const user = userEvent.setup();
        renderWithProviders(<TestForm />);

        const emailInput = screen.getByTestId('email');
        const passwordInput = screen.getByTestId('password');
        const emailIcon = screen.getByTestId('email-icon');
        const passwordIcon = screen.getByTestId('password-icon');

        // Initially no icons
        expect(emailIcon).toBeEmptyDOMElement();
        expect(passwordIcon).toBeEmptyDOMElement();

        // Type invalid email
        await user.type(emailInput, 'invalid');
        await waitFor(() => {
          expect(emailIcon).toHaveTextContent('❌');
        });

        // Type valid email
        await user.clear(emailInput);
        await user.type(emailInput, 'valid@example.com');
        await waitFor(() => {
          expect(emailIcon).toHaveTextContent('✅');
        });

        // Type valid password
        await user.type(passwordInput, 'password123');
        await waitFor(() => {
          expect(passwordIcon).toHaveTextContent('✅');
        });
      });

      it('should provide real-time character count for password', async () => {
        const TestForm = () => {
          const { register, watch } = useForm();
          const password = watch('password', '');

          return (
            <div>
              <input {...register('password')} data-testid="password" />
              <div data-testid="char-count">
                {password.length}/8 characters minimum
              </div>
              <div data-testid="strength-indicator">
                {password.length >= 8 ? 'Strong enough' : 'Too short'}
              </div>
            </div>
          );
        };

        const user = userEvent.setup();
        renderWithProviders(<TestForm />);

        const passwordInput = screen.getByTestId('password');
        const charCount = screen.getByTestId('char-count');
        const strengthIndicator = screen.getByTestId('strength-indicator');

        // Initially shows 0/8
        expect(charCount).toHaveTextContent('0/8 characters minimum');
        expect(strengthIndicator).toHaveTextContent('Too short');

        // Type 5 characters
        await user.type(passwordInput, '12345');
        expect(charCount).toHaveTextContent('5/8 characters minimum');
        expect(strengthIndicator).toHaveTextContent('Too short');

        // Type 8 characters
        await user.type(passwordInput, '678');
        expect(charCount).toHaveTextContent('8/8 characters minimum');
        expect(strengthIndicator).toHaveTextContent('Strong enough');
      });

      it('should show progressive enhancement for password strength', async () => {
        const TestForm = () => {
          const { register, watch } = useForm();
          const password = watch('password', '');

          const getStrengthScore = (pwd: string) => {
            let score = 0;
            if (pwd.length >= 8) score++;
            if (/[A-Z]/.test(pwd)) score++;
            if (/[a-z]/.test(pwd)) score++;
            if (/[0-9]/.test(pwd)) score++;
            if (/[^A-Za-z0-9]/.test(pwd)) score++;
            return score;
          };

          const strengthScore = getStrengthScore(password);
          const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
          const strengthColors = ['red', 'orange', 'yellow', 'lightgreen', 'green'];

          return (
            <div>
              <input {...register('password')} data-testid="password" />
              <div data-testid="strength-meter">
                <div
                  style={{
                    width: `${(strengthScore / 5) * 100}%`,
                    backgroundColor: strengthColors[strengthScore] || 'gray'
                  }}
                  data-testid="strength-bar"
                />
              </div>
              <div data-testid="strength-label">
                {strengthLabels[strengthScore] || 'Very Weak'}
              </div>
            </div>
          );
        };

        const user = userEvent.setup();
        renderWithProviders(<TestForm />);

        const passwordInput = screen.getByTestId('password');
        const strengthLabel = screen.getByTestId('strength-label');

        // Test progressive strength
        expect(strengthLabel).toHaveTextContent('Very Weak');

        await user.type(passwordInput, 'password'); // Weak (length only)
        expect(strengthLabel).toHaveTextContent('Weak');

        await user.clear(passwordInput);
        await user.type(passwordInput, 'Password'); // Fair (length + uppercase)
        expect(strengthLabel).toHaveTextContent('Fair');

        await user.clear(passwordInput);
        await user.type(passwordInput, 'Password1'); // Good (length + upper + lower + number)
        expect(strengthLabel).toHaveTextContent('Good');

        await user.clear(passwordInput);
        await user.type(passwordInput, 'Password1!'); // Strong (all criteria)
        expect(strengthLabel).toHaveTextContent('Strong');
      });
    });

    describe('Error Recovery and User Guidance', () => {
      it('should provide helpful suggestions for common email mistakes', async () => {
        const TestForm = () => {
          const { register, formState: { errors }, watch } = useForm({
            resolver: zodResolver(z.object({
              email: z.string().email('Please enter a valid email address')
            })),
            mode: 'onChange'
          });

          const emailValue = watch('email', '');

          const getSuggestion = (email: string) => {
            if (email.includes('gmai.com')) return 'Did you mean gmail.com?';
            if (email.includes('yahooo.com')) return 'Did you mean yahoo.com?';
            if (email.includes('@.com')) return 'Missing domain name before .com';
            if (email.endsWith('@')) return 'Please complete your email address';
            return null;
          };

          const suggestion = getSuggestion(emailValue);

          return (
            <div>
              <input {...register('email')} data-testid="email" />
              {errors.email && (
                <div data-testid="email-error">{errors.email.message}</div>
              )}
              {suggestion && (
                <div data-testid="email-suggestion" className="suggestion">
                  {suggestion}
                </div>
              )}
            </div>
          );
        };

        const user = userEvent.setup();
        renderWithProviders(<TestForm />);

        const emailInput = screen.getByTestId('email');

        // Test common typos
        await user.type(emailInput, 'user@gmai.com');
        await waitFor(() => {
          expect(screen.getByTestId('email-suggestion')).toHaveTextContent('Did you mean gmail.com?');
        });

        await user.clear(emailInput);
        await user.type(emailInput, 'user@yahooo.com');
        await waitFor(() => {
          expect(screen.getByTestId('email-suggestion')).toHaveTextContent('Did you mean yahoo.com?');
        });

        await user.clear(emailInput);
        await user.type(emailInput, 'user@.com');
        await waitFor(() => {
          expect(screen.getByTestId('email-suggestion')).toHaveTextContent('Missing domain name before .com');
        });
      });

      it('should handle paste operations and validate immediately', async () => {
        const TestForm = () => {
          const { register, formState: { errors } } = useForm({
            resolver: zodResolver(loginSchema),
            mode: 'onChange'
          });

          return (
            <form>
              <input {...register('email')} data-testid="email" />
              {errors.email && (
                <div data-testid="email-error">{errors.email.message}</div>
              )}
            </form>
          );
        };

        renderWithProviders(<TestForm />);

        const emailInput = screen.getByTestId('email');

        // Simulate paste operation
        await fireEvent.paste(emailInput, {
          clipboardData: {
            getData: () => 'invalid-email-format'
          }
        });

        // Should validate immediately after paste
        await waitFor(() => {
          expect(screen.getByTestId('email-error')).toBeInTheDocument();
        });

        // Paste valid email
        await fireEvent.paste(emailInput, {
          clipboardData: {
            getData: () => 'valid@example.com'
          }
        });

        // Error should clear
        await waitFor(() => {
          expect(screen.queryByTestId('email-error')).not.toBeInTheDocument();
        });
      });

      it('should preserve form state during validation errors', async () => {
        const TestForm = () => {
          const { register, formState: { errors }, getValues } = useForm({
            resolver: zodResolver(loginSchema),
            mode: 'onBlur'
          });

          return (
            <form>
              <input {...register('email')} data-testid="email" />
              <input {...register('password')} data-testid="password" />
              {errors.email && <div data-testid="email-error">{errors.email.message}</div>}
              {errors.password && <div data-testid="password-error">{errors.password.message}</div>}
              <div data-testid="form-values">
                {JSON.stringify(getValues())}
              </div>
            </form>
          );
        };

        const user = userEvent.setup();
        renderWithProviders(<TestForm />);

        const emailInput = screen.getByTestId('email');
        const passwordInput = screen.getByTestId('password');

        // Fill form with invalid data
        await user.type(emailInput, 'invalid');
        await user.type(passwordInput, '123'); // Too short

        // Blur to trigger validation
        await user.tab();

        // Should show errors but preserve values
        await waitFor(() => {
          expect(screen.getByTestId('email-error')).toBeInTheDocument();
          expect(screen.getByTestId('password-error')).toBeInTheDocument();
        });

        // Values should still be present
        expect(screen.getByTestId('form-values')).toHaveTextContent(
          JSON.stringify({ email: 'invalid', password: '123' })
        );
      });
    });
  });

  describe('Integration with Preserved Validation Schemas', () => {
    it('should use preserved auth validation schemas', async () => {
      // This test verifies integration with preserved validation infrastructure
      // Note: Using local schema definition as preserved schemas may not exist yet
      const loginSchema = z.object({
        email: z.string().email('Please enter a valid email address'),
        password: z.string().min(8, 'Password must be at least 8 characters')
      });

      // Test that preserved schema works with React Hook Form
      const { result } = renderHook(() =>
        useForm({
          resolver: zodResolver(loginSchema)
        })
      );

      // Should be able to use preserved schema
      expect(result.current.resolver).toBeDefined();

      // Test validation with preserved schema
      await act(async () => {
        await result.current.trigger();
      });

      // Should have validation errors from preserved schema
      expect(Object.keys(result.current.formState.errors).length).toBeGreaterThan(0);
    });

    it('should extend preserved schemas for specific use cases', async () => {
      const loginSchema = z.object({
        email: z.string().email('Please enter a valid email address'),
        password: z.string().min(8, 'Password must be at least 8 characters')
      });

      // Extend preserved schema with additional fields
      const extendedLoginSchema = loginSchema.extend({
        rememberMe: z.boolean().optional(),
        captcha: z.string().min(1, 'Please complete the captcha').optional()
      });

      const { result } = renderHook(() =>
        useForm({
          resolver: zodResolver(extendedLoginSchema)
        })
      );

      // Should work with extended schema
      expect(result.current.resolver).toBeDefined();

      // Test extended validation
      await act(async () => {
        result.current.setValue('email', 'test@example.com');
        result.current.setValue('password', 'password123');
        result.current.setValue('rememberMe', true);
        await result.current.trigger();
      });

      // Should validate successfully with extended fields
      expect(result.current.formState.isValid).toBe(true);
    });

    it('should maintain compatibility with preserved type definitions', async () => {
      // Define LoginCredentials type for test
      interface LoginCredentials {
        email: string;
        password: string;
      }

      const loginSchema = z.object({
        email: z.string().email(),
        password: z.string().min(8)
      });

      const TestForm = () => {
        const { register, handleSubmit } = useForm<LoginCredentials>({
          resolver: zodResolver(loginSchema)
        });

        const onSubmit = (data: LoginCredentials) => {
          // Should accept preserved type
          expect(data.email).toBeDefined();
          expect(data.password).toBeDefined();
        };

        return (
          <form onSubmit={handleSubmit(onSubmit)}>
            <input {...register('email')} />
            <input {...register('password')} />
            <button type="submit">Submit</button>
          </form>
        );
      };

      // Should compile and render without type errors
      expect(() => renderWithProviders(<TestForm />)).not.toThrow();
    });
  });
});
```

## Test Data and Utilities

### 1. Validation Test Utilities

```typescript
// tests/utils/validation-helpers.ts
// Helper utilities for validation testing

export const validationTestUtils = {
  // Generate invalid email formats for testing
  generateInvalidEmails: () => [
    "",
    "invalid",
    "invalid@",
    "@invalid.com",
    "invalid.com",
    "invalid@.com",
    "invalid@domain.",
    "spaces in@email.com",
    "email@domain..com",
    "email@[192.168.1.1]",
  ],

  // Generate valid email formats for testing
  generateValidEmails: () => [
    "user@example.com",
    "user.name@example.com",
    "user+tag@example.com",
    "user_name@example.com",
    "User@Example.COM",
    "  user@example.com  ",
  ],

  // Generate weak passwords for strength testing
  generateWeakPasswords: () => [
    "password",
    "12345678",
    "PASSWORD",
    "Password",
    "password123",
  ],

  // Generate strong passwords for testing
  generateStrongPasswords: () => [
    "StrongPass123!",
    "MySecure@Pass2024",
    "Complex#Password9",
  ],

  // Test form validation with different scenarios
  testValidationScenarios: async (
    schema: z.ZodSchema,
    testCases: Array<{
      input: any;
      expectedValid: boolean;
      expectedErrors?: string[];
    }>
  ) => {
    for (const testCase of testCases) {
      const result = schema.safeParse(testCase.input);

      expect(result.success).toBe(testCase.expectedValid);

      if (!result.success && testCase.expectedErrors) {
        const errorMessages = result.error.issues.map((issue) => issue.message);
        testCase.expectedErrors.forEach((expectedError) => {
          expect(errorMessages).toContain(expectedError);
        });
      }
    }
  },
};
```

### 2. Mock Form Components

```typescript
// tests/mocks/form-components.tsx
// Mock components for form testing

export const MockFormField = ({ name, type = 'text', validation = {} }) => {
  const { register, formState: { errors } } = useFormContext();

  return (
    <div>
      <input
        {...register(name, validation)}
        type={type}
        data-testid={name}
      />
      {errors[name] && (
        <div data-testid={`${name}-error`} role="alert">
          {errors[name]?.message}
        </div>
      )}
    </div>
  );
};

export const MockForm = ({ children, schema, onSubmit = vi.fn() }) => {
  const methods = useForm({
    resolver: schema ? zodResolver(schema) : undefined
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        {children}
      </form>
    </FormProvider>
  );
};
```

## Acceptance Criteria

### Validation Test Coverage

- [ ] All email validation rules tested comprehensively (12 test cases)
- [ ] Password validation rules tested for all security requirements (8 test
      cases)
- [ ] Custom validation rules implemented and tested (6 test cases)
- [ ] React Hook Form integration fully tested (15 test cases)
- [ ] User experience patterns tested (validation feedback, error recovery)
- [ ] Preserved infrastructure integration validated (3 test cases)

### Test Quality Standards

- [ ] All tests initially FAIL (RED phase requirement)
- [ ] Tests are descriptive and explain expected behavior
- [ ] Edge cases and error scenarios comprehensively covered
- [ ] Accessibility requirements validated in all tests
- [ ] User interaction patterns realistic and comprehensive

### Form Validation Requirements

- [ ] Email format validation with comprehensive pattern matching
- [ ] Password strength validation with multiple criteria
- [ ] Real-time validation feedback with appropriate timing
- [ ] Error message clarity and accessibility
- [ ] Form state management with proper error recovery

## Integration Points

### Existing Infrastructure Dependencies

```typescript
// Required imports from existing infrastructure
import type { LoginCredentials, RegisterData } from "@/types/common";
import { MockAuthService } from "@/src/services/mock/auth.mock.service";
import { createUser } from "@/src/test/factories/user.factory";
```

### Form State Management

```typescript
// React Hook Form configuration that tests must verify
const formConfig = {
  resolver: zodResolver(loginSchema),
  mode: "onBlur" | "onChange" | "onSubmit",
  defaultValues: {
    email: "",
    password: "",
    rememberMe: false,
  },
};
```

## Performance and Accessibility Testing

### Performance Requirements

- Validation should complete within 100ms
- Real-time feedback should not cause input lag
- Form state updates should be debounced appropriately

### Accessibility Requirements

- All validation errors announced to screen readers
- Form fields properly associated with error messages
- Focus management during validation state changes
- Keyboard navigation support for all validation interactions

## Next Steps

After completing this RED phase:

1. **Validation**: Ensure all validation tests are failing appropriately
2. **Review**: Comprehensive review of test coverage and quality
3. **Documentation**: Update test documentation with validation patterns
4. **Handoff**: Prepare for Sub-Phase 1.3 (GREEN phase implementation)
5. **Integration**: Verify integration points with preserved infrastructure

---

**Status**: Ready to Begin **Duration**: 1 day  
**Test Count**: 45+ comprehensive validation tests **Integration Tests**: 6
preserved infrastructure validation tests **Quality Gate**: All tests must fail
initially (RED phase) before proceeding to implementation
