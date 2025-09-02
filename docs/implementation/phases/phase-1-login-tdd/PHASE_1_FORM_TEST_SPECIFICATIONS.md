# Phase 1 Form Test Specifications

## Executive Summary

This document provides comprehensive test specifications for all authentication
forms in Phase 1, following strict TDD methodology. Each form test suite is
designed to be written BEFORE implementation (RED phase), ensuring proper
contract definition and behavior specification.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Login Form Tests](#login-form-tests)
3. [Registration Form Tests](#registration-form-tests)
4. [Password Reset Form Tests](#password-reset-form-tests)
5. [Two-Factor Authentication Tests](#two-factor-authentication-tests)
6. [Cross-Cutting Form Tests](#cross-cutting-form-tests)
7. [Test Data Requirements](#test-data-requirements)
8. [Mock Service Interactions](#mock-service-interactions)
9. [Accessibility Requirements](#accessibility-requirements)

## Testing Philosophy

### TDD Cycle for Forms

1. **RED Phase**: Write comprehensive test specifications (this document)
2. **GREEN Phase**: Implement minimal code to pass all tests
3. **REFACTOR Phase**: Enhance UX, performance, and accessibility

### Form Testing Principles

- **Contract-First**: Tests define the form behavior contract
- **User-Centric**: Tests mirror actual user interactions
- **Philippine Context**: Validation appropriate for Filipino users
- **Security-First**: All security scenarios tested
- **Accessibility**: WCAG 2.1 AA compliance verified

## Login Form Tests

### Test Suite: `LoginForm.test.tsx`

```typescript
describe("LoginForm Component", () => {
  // RED: Define behavior before implementation
});
```

#### Field Rendering and Labeling

```typescript
describe("Form Structure", () => {
  it("should render email input with proper label and attributes", () => {
    // RED: Email field exists with correct aria-labels
    // RED: Input type="email" for mobile keyboard
    // RED: Required attribute present
    // RED: Autocomplete="email" for autofill
  });

  it("should render password input with proper label and attributes", () => {
    // RED: Password field exists with correct aria-labels
    // RED: Input type="password" initially
    // RED: Required attribute present
    // RED: Autocomplete="current-password"
  });

  it("should render remember me checkbox with proper labeling", () => {
    // RED: Checkbox input with proper label association
    // RED: Default unchecked state
    // RED: Proper ARIA attributes
  });

  it("should render submit button with proper states", () => {
    // RED: Submit button exists and is initially disabled until form is valid
    // RED: Button text is "Sign In"
    // RED: Type="submit" for form submission
    // RED: Button becomes enabled when all fields are valid
  });

  it("should render password visibility toggle", () => {
    // RED: Toggle button exists
    // RED: Proper aria-labels for screen readers
    // RED: Icon indicates current state
  });
});
```

#### Email Validation Scenarios

```typescript
describe("Email Validation", () => {
  it("should show error for empty email field", () => {
    // RED: Submit form with empty email
    // RED: Error message: "Email is required"
    // RED: Field marked with aria-invalid="true"
  });

  it("should show error for invalid email format", () => {
    // RED: Enter "invalid-email"
    // RED: Error message: "Please enter a valid email address"
    // RED: Real-time validation on blur
  });

  it("should show error for email too long", () => {
    // RED: Enter 101 character email
    // RED: Error message: "Email must be less than 100 characters"
  });

  it("should normalize email to lowercase", () => {
    // RED: Enter "TEST@EXAMPLE.COM"
    // RED: Value should be "test@example.com"
    // RED: Trim whitespace automatically
  });

  it("should accept valid Filipino email formats", () => {
    // RED: Test common PH domains: gmail.com, yahoo.com, outlook.ph
    // RED: No validation errors shown
    // RED: Form should be submittable
  });
});
```

#### Password Validation Scenarios

```typescript
describe("Password Validation", () => {
  it("should show error for empty password field", () => {
    // RED: Submit form with empty password
    // RED: Error message: "Password is required"
    // RED: Field marked with aria-invalid="true"
  });

  it("should show error for password too long", () => {
    // RED: Enter 129 character password
    // RED: Error message: "Password is too long"
  });

  it("should toggle password visibility", () => {
    // RED: Click visibility toggle
    // RED: Input type changes to "text"
    // RED: Icon changes to "hide" state
    // RED: Aria-label updates appropriately
  });

  it("should handle password with special characters", () => {
    // RED: Enter password with emojis, accented chars
    // RED: Should accept any UTF-8 characters
    // RED: No validation errors
  });
});
```

#### Submit Button States

```typescript
describe("Submit Button Behavior", () => {
  it("should be enabled when form is valid", () => {
    // RED: Fill valid email and password
    // RED: Button should be enabled
    // RED: No visual disabled styling
  });

  it("should show loading state during submission", () => {
    // RED: Submit valid form
    // RED: Button shows spinner/loading text
    // RED: Button is disabled during submission
    // RED: Loading text: "Signing in..."
  });

  it("should prevent double submission", () => {
    // RED: Submit form rapidly multiple times
    // RED: Only one API call should be made
    // RED: Button remains disabled until response
  });
});
```

#### Error Message Display

```typescript
describe("Error Handling", () => {
  it("should display field-level validation errors", () => {
    // RED: Individual field errors under each input
    // RED: Proper color coding (red text)
    // RED: Icons for error state
    // RED: Errors clear when field becomes valid
  });

  it("should display server-side authentication errors", () => {
    // RED: Mock 401 response
    // RED: Error message: "Invalid email or password"
    // RED: Error displayed above form
    // RED: Focus remains on form
  });

  it("should display rate limiting errors", () => {
    // RED: Mock 429 response
    // RED: Error message includes retry time
    // RED: Submit button disabled until retry allowed
  });

  it("should display network errors gracefully", () => {
    // RED: Mock network failure
    // RED: Error message: "Network error. Please try again."
    // RED: Retry button or automatic retry after delay
  });
});
```

#### Success Redirect Flow

```typescript
describe("Success Flow", () => {
  it("should redirect to dashboard after successful login", () => {
    // RED: Mock successful login response
    // RED: User redirected to /dashboard
    // RED: Auth state updated in store
    // RED: Token stored securely
  });

  it("should redirect to intended page after login", () => {
    // RED: Access protected page while logged out
    // RED: Redirect to login with returnUrl parameter
    // RED: After login, redirect to original page
  });

  it("should handle remember me functionality", () => {
    // RED: Check remember me box
    // RED: Submit successful login
    // RED: Longer token expiry stored
    // RED: User stays logged in after browser close
  });
});
```

#### Rate Limiting Display

```typescript
describe("Security Features", () => {
  it("should show rate limiting countdown", () => {
    // RED: Trigger rate limit (5 failed attempts)
    // RED: Display countdown timer
    // RED: Submit button disabled during countdown
    // RED: Clear message about why disabled
  });

  it("should prevent XSS in error messages", () => {
    // RED: Mock error response with script tags
    // RED: Content should be escaped/sanitized
    // RED: No script execution
  });

  it("should use JWT authentication without CSRF tokens", () => {
    // RED: Verify JWT is sent via Authorization header
    // RED: Confirm NO CSRF token is needed (JWT is CSRF-immune)
    // RED: JWT provides better security than CSRF tokens
  });
});
```

## Registration Form Tests

### Test Suite: `RegistrationForm.test.tsx`

#### Multi-Step Form Testing

```typescript
describe("Registration Multi-Step Flow", () => {
  it("should render step 1: Basic Information", () => {
    // RED: Name, email, password fields visible
    // RED: Step indicator shows step 1 of 3
    // RED: Next button enabled when valid
    // RED: Progress bar shows 33%
  });

  it("should render step 2: Business Details", () => {
    // RED: Project name and phone fields
    // RED: Step indicator shows step 2 of 3
    // RED: Back button navigates to step 1
    // RED: Progress bar shows 66%
  });

  it("should render step 3: Terms and Confirmation", () => {
    // RED: Terms checkbox and summary
    // RED: Step indicator shows step 3 of 3
    // RED: Submit button says "Create Account"
    // RED: Progress bar shows 100%
  });
});
```

#### Business Name Validation (Philippine Context)

```typescript
describe("Business Name Validation", () => {
  it("should accept common Filipino business name formats", () => {
    // RED: Test "Bahay ni Juan Resort"
    // RED: Test "D' Beach Haven"
    // RED: Test "Villa María"
    // RED: Accept accented characters
    // RED: Accept apostrophes and hyphens
  });

  it("should reject invalid characters in business names", () => {
    // RED: Test names with @#$%^&* characters
    // RED: Error: "Project name contains invalid characters"
    // RED: Show allowed character examples
  });

  it("should handle empty business name gracefully", () => {
    // RED: Business name is optional field
    // RED: No validation error for empty
    // RED: Form can be submitted without it
  });
});
```

#### Password Strength Requirements

```typescript
describe("Password Strength Validation", () => {
  it("should show real-time password strength indicator", () => {
    // RED: Password strength meter visible
    // RED: Updates as user types
    // RED: Color coding: red (weak), yellow (fair), green (strong)
    // RED: Text feedback for each strength level
  });

  it("should enforce minimum password requirements", () => {
    // RED: Test password "weak123"
    // RED: Error: Must contain uppercase letter
    // RED: Error: Must contain special character
    // RED: Submit button disabled until strong
  });

  it("should show helpful password suggestions", () => {
    // RED: Weak password shows specific suggestions
    // RED: "Include at least one uppercase letter (A-Z)"
    // RED: "Include at least one special character (@$!%*?&)"
    // RED: Suggestions update dynamically
  });

  it("should accept strong passwords with Filipino context", () => {
    // RED: Test "MayBahay2024!"
    // RED: Test "Bagong-Simula123@"
    // RED: Green strength indicator
    // RED: No validation errors
  });
});
```

#### Password Confirmation Matching

```typescript
describe("Password Confirmation", () => {
  it("should show error when passwords do not match", () => {
    // RED: Enter different password and confirmation
    // RED: Error: "Passwords do not match"
    // RED: Error shown under confirm password field
    // RED: Real-time validation on change
  });

  it("should clear error when passwords match", () => {
    // RED: Fix mismatched passwords
    // RED: Error message disappears
    // RED: Green checkmark indicator
    // RED: Field marked as valid
  });
});
```

#### Terms Acceptance Testing

```typescript
describe("Terms and Conditions", () => {
  it("should require terms acceptance before submission", () => {
    // RED: Complete form without checking terms
    // RED: Submit button disabled
    // RED: Error: "You must accept the terms and conditions"
    // RED: Focus moves to terms checkbox
  });

  it("should enable submission when terms accepted", () => {
    // RED: Check terms and conditions checkbox
    // RED: Submit button becomes enabled (when all fields valid)
    // RED: No validation errors shown
    // RED: Button remains disabled if other fields invalid
  });

  it("should open terms in modal/new tab", () => {
    // RED: Click "Terms and Conditions" link
    // RED: Modal opens with full terms text
    // RED: OR new tab opens (external link)
    // RED: Focus management handled properly
  });
});
```

#### Email Uniqueness Validation

```typescript
describe("Email Uniqueness", () => {
  it("should check email uniqueness on blur", () => {
    // RED: Enter existing email address
    // RED: Debounced API call after 500ms
    // RED: Error: "This email is already registered"
    // RED: Link to login page provided
  });

  it("should handle email uniqueness check errors", () => {
    // RED: Mock API error during uniqueness check
    // RED: Allow form submission (don't block)
    // RED: Warning message about check failure
  });
});
```

#### Success Flow with Auto-Login

```typescript
describe("Registration Success Flow", () => {
  it("should auto-login user after successful registration", () => {
    // RED: Submit successful registration
    // RED: User automatically logged in
    // RED: Auth tokens stored
    // RED: Redirect to onboarding or dashboard
  });

  it("should show welcome message with user name", () => {
    // RED: Success message includes user's name
    // RED: "Welcome to Okaeri, Juan!"
    // RED: Next steps guidance provided
  });
});
```

## Password Reset Form Tests

### Test Suite: `PasswordResetForm.test.tsx`

#### Email Lookup Validation

```typescript
describe("Password Reset Request", () => {
  it("should validate email format before submission", () => {
    // RED: Enter invalid email format
    // RED: Client-side validation prevents submission
    // RED: Error message shown immediately
  });

  it("should handle email not found gracefully", () => {
    // RED: Enter email not in system
    // RED: Generic success message (security)
    // RED: "If email exists, reset link sent"
    // RED: No indication if email was found or not
  });

  it("should show success message for valid emails", () => {
    // RED: Enter registered email address
    // RED: Success message displayed
    // RED: Instructions to check email
    // RED: Estimated delivery time shown
  });
});
```

#### Success Message Display

```typescript
describe("Success State", () => {
  it("should display email sent confirmation", () => {
    // RED: Success message with email address
    // RED: "Reset link sent to user@example.com"
    // RED: Check spam folder instruction
    // RED: Didn't receive email? link
  });

  it("should provide resend functionality", () => {
    // RED: "Didn't receive email?" link
    // RED: Click to resend (with rate limiting)
    // RED: Confirmation of resend
    // RED: Countdown until next resend allowed
  });
});
```

#### Rate Limiting for Requests

```typescript
describe("Rate Limiting", () => {
  it("should enforce rate limit on reset requests", () => {
    // RED: Send multiple reset requests rapidly
    // RED: After 3 requests, show rate limit error
    // RED: Countdown timer until next allowed
    // RED: Clear messaging about limit
  });

  it("should reset rate limit after timeout", () => {
    // RED: Wait for rate limit timeout
    // RED: Reset request should be allowed
    // RED: Form fully functional again
  });
});
```

#### Token Expiry Handling

```typescript
describe("Reset Token Validation", () => {
  it("should validate token format in URL", () => {
    // RED: Visit reset page with invalid token format
    // RED: Error: "Invalid reset link"
    // RED: Option to request new reset link
  });

  it("should handle expired tokens", () => {
    // RED: Visit reset page with expired token
    // RED: Error: "Reset link has expired"
    // RED: Redirect to request new link
    // RED: Form pre-filled if email known
  });

  it("should handle already used tokens", () => {
    // RED: Use same reset token twice
    // RED: Error: "Reset link already used"
    // RED: Option to request new link
  });
});
```

#### Password Update Flow

```typescript
describe("Password Reset Completion", () => {
  it("should enforce strong password requirements", () => {
    // RED: Same password validation as registration
    // RED: Strength indicator visible
    // RED: All security requirements enforced
  });

  it("should require password confirmation match", () => {
    // RED: Password and confirmation must match
    // RED: Real-time validation feedback
    // RED: Clear error messaging
  });

  it("should auto-login after password reset", () => {
    // RED: Successful password reset
    // RED: User automatically logged in
    // RED: Redirect to dashboard
    // RED: Success message shown
  });
});
```

## Two-Factor Authentication Tests

### Test Suite: `TwoFactorAuthForm.test.tsx`

#### Code Input Formatting

```typescript
describe("2FA Code Input", () => {
  it("should render 6-digit code input fields", () => {
    // RED: 6 separate input fields
    // RED: Each accepts single digit
    // RED: Numeric input type for mobile
    // RED: Proper spacing between fields
  });

  it("should format code input automatically", () => {
    // RED: Typing advances to next field
    // RED: Backspace returns to previous field
    // RED: Paste distributes across fields
    // RED: Non-numeric characters rejected
  });

  it("should handle paste operations correctly", () => {
    // RED: Paste "123456" in first field
    // RED: Code distributed across all fields
    // RED: Form ready for submission
    // RED: Focus on last field after paste
  });
});
```

#### Auto-Focus Patterns

```typescript
describe("Focus Management", () => {
  it("should auto-focus first input on load", () => {
    // RED: First input field focused on page load
    // RED: Virtual keyboard appears on mobile
    // RED: Proper focus indicators visible
  });

  it("should advance focus on digit entry", () => {
    // RED: Enter digit in first field
    // RED: Focus automatically moves to second field
    // RED: Continue until all fields filled
    // RED: Submit automatically when complete
  });

  it("should handle backspace navigation", () => {
    // RED: Backspace in empty field moves to previous
    // RED: Backspace in filled field clears and stays
    // RED: Proper cursor positioning
  });
});
```

#### Resend Code Functionality

```typescript
describe("Code Resend Feature", () => {
  it("should show resend option after timeout", () => {
    // RED: Resend link disabled initially
    // RED: Countdown timer shows remaining time
    // RED: "Didn't receive code?" message
    // RED: Link enabled after 60 seconds
  });

  it("should handle successful code resend", () => {
    // RED: Click resend link
    // RED: New code sent to device
    // RED: Success confirmation shown
    // RED: Input fields cleared
    // RED: Timer resets
  });

  it("should limit resend attempts", () => {
    // RED: After 3 resend attempts
    // RED: Resend disabled permanently
    // RED: Option to start over with login
  });
});
```

#### Expiry Countdown Display

```typescript
describe("Code Expiry", () => {
  it("should show code expiry countdown", () => {
    // RED: Countdown timer visible
    // RED: Format: "Code expires in 4:32"
    // RED: Timer updates every second
    // RED: Color changes as expiry approaches
  });

  it("should handle code expiry", () => {
    // RED: When timer reaches 0:00
    // RED: Input fields disabled
    // RED: Error message about expiry
    // RED: Option to request new code
  });
});
```

#### Backup Code Entry

```typescript
describe("Backup Codes", () => {
  it("should provide backup code option", () => {
    // RED: "Use backup code" link visible
    // RED: Switches to backup code input
    // RED: Single text field for backup code
    // RED: Different validation rules
  });

  it("should validate backup code format", () => {
    // RED: Backup codes are 8 alphanumeric chars
    // RED: Case insensitive validation
    // RED: Proper error messaging
  });

  it("should handle used backup codes", () => {
    // RED: Submit previously used backup code
    // RED: Error: "Backup code already used"
    // RED: Option to try different code
  });
});
```

#### Success Verification Flow

```typescript
describe("2FA Success Flow", () => {
  it("should complete authentication with valid code", () => {
    // RED: Enter valid 6-digit code
    // RED: Auto-submit when complete
    // RED: Success animation/feedback
    // RED: Redirect to dashboard
  });

  it("should update device trust status", () => {
    // RED: Option to trust device for 30 days
    // RED: Checkbox with clear explanation
    // RED: Trust status stored securely
  });
});
```

## Cross-Cutting Form Tests

### Test Suite: `FormAccessibility.test.tsx`

#### Keyboard Navigation

```typescript
describe("Keyboard Navigation", () => {
  it("should support tab navigation through all forms", () => {
    // RED: Tab key moves through all interactive elements
    // RED: Proper tab order (visual order)
    // RED: Skip links for long forms
    // RED: Focus indicators always visible
  });

  it("should support Enter key submission", () => {
    // RED: Enter key submits valid forms
    // RED: Enter in multi-step advances step
    // RED: Proper form validation before submission
  });

  it("should support Escape key to cancel/close", () => {
    // RED: Escape closes modals/overlays
    // RED: Escape clears form errors
    // RED: Return focus to trigger element
  });
});
```

#### Screen Reader Compatibility

```typescript
describe("Screen Reader Support", () => {
  it("should provide proper ARIA labels for all inputs", () => {
    // RED: All inputs have accessible names
    // RED: aria-label or associated label elements
    // RED: aria-describedby for help text
    // RED: aria-invalid for error states
  });

  it("should announce form validation errors", () => {
    // RED: Errors announced when they appear
    // RED: aria-live regions for dynamic content
    // RED: Proper error-field association
  });

  it("should provide form completion status", () => {
    // RED: Multi-step forms announce progress
    // RED: "Step 2 of 3" announced
    // RED: Completion percentage available
  });
});
```

#### Mobile Touch Interactions

```typescript
describe("Mobile Touch Support", () => {
  it("should have proper touch targets", () => {
    // RED: All buttons minimum 44px touch target
    // RED: Adequate spacing between elements
    // RED: No accidental activation
  });

  it("should handle mobile keyboard types", () => {
    // RED: Email fields show email keyboard
    // RED: Phone fields show numeric keyboard
    // RED: URL fields show URL keyboard
  });

  it("should support swipe gestures in multi-step forms", () => {
    // RED: Swipe left/right changes steps
    // RED: Only when step is valid
    // RED: Visual feedback for swipe action
  });
});
```

#### Form Persistence on Refresh

```typescript
describe("Form State Persistence", () => {
  it("should save form data on page refresh", () => {
    // RED: Fill form partially
    // RED: Refresh page
    // RED: Data restored (except sensitive fields)
    // RED: Cursor position maintained
  });

  it("should clear sensitive data appropriately", () => {
    // RED: Passwords not persisted
    // RED: 2FA codes not persisted
    // RED: Clear after successful submission
  });

  it("should handle session expiry during form fill", () => {
    // RED: Session expires while filling form
    // RED: Form data preserved
    // RED: User prompted to re-authenticate
    // RED: Return to form after auth
  });
});
```

#### Network Error Recovery

```typescript
describe("Network Error Handling", () => {
  it("should handle network failures gracefully", () => {
    // RED: Network error during submission
    // RED: Form data preserved
    // RED: Clear error messaging
    // RED: Retry button available
  });

  it("should implement progressive enhancement", () => {
    // RED: Forms work without JavaScript
    // RED: Enhanced experience with JS
    // RED: Graceful degradation
  });

  it("should show connection status", () => {
    // RED: Offline indicator when network lost
    // RED: Queue submissions when offline
    // RED: Process queue when back online
  });
});
```

#### Offline Queue Behavior

```typescript
describe("Offline Support", () => {
  it("should queue form submissions when offline", () => {
    // RED: Submit form while offline
    // RED: Submission queued locally
    // RED: User notified of queued status
    // RED: Process when connection restored
  });

  it("should handle conflicts when back online", () => {
    // RED: Data changed on server while offline
    // RED: User prompted about conflicts
    // RED: Option to merge or overwrite
  });
});
```

## Test Data Requirements

### Authentication Test Data

```typescript
// Mock user accounts for testing
export const testUsers = {
  validUser: {
    email: "juan@okaeri.test",
    password: "ValidPass123!",
    name: "Juan dela Cruz",
    projectName: "Bahay ni Juan Resort",
    phone: "+639171234567",
  },

  existingUser: {
    email: "existing@okaeri.test",
    password: "ExistingPass123!",
  },

  lockedAccount: {
    email: "locked@okaeri.test",
    password: "LockedPass123!",
  },

  filipinoNames: [
    "Maria Santos",
    "José Rizal Jr.",
    "Ana María González",
    "Miguel Ángel Pérez",
  ],

  businessNames: [
    "Bahay Kubo Resort",
    "Villa María Beach Resort",
    "D' Paradise Island",
    "Sunset Bay Resort & Spa",
  ],
};
```

### Validation Test Cases

```typescript
export const validationTestCases = {
  emails: {
    valid: ["user@gmail.com", "test.user@yahoo.com.ph", "admin@okaeri.ph"],
    invalid: [
      "invalid-email",
      "@domain.com",
      "user@",
      "user..double@domain.com",
    ],
  },

  passwords: {
    weak: ["123456", "password", "qwerty"],
    fair: ["Password123", "MyPass123"],
    strong: ["StrongPass123!", "Secure@2024"],
    tooLong: "a".repeat(129),
  },

  phoneNumbers: {
    valid: ["+639171234567", "09171234567", "639171234567", "9171234567"],
    invalid: ["123456789", "+1234567890", "not-a-phone"],
  },
};
```

## Mock Service Interactions

### Authentication Service Mocks

```typescript
export class MockAuthService {
  // Login scenarios
  async login(credentials: LoginCredentials) {
    await simulateDelay(300, 800);

    if (credentials.email === testUsers.lockedAccount.email) {
      throw new ApiError(423, "Account locked due to failed login attempts");
    }

    if (
      credentials.email === testUsers.validUser.email &&
      credentials.password === testUsers.validUser.password
    ) {
      return {
        user: testUsers.validUser,
        accessToken: "mock-jwt-token",
        refreshToken: "mock-refresh-token",
      };
    }

    throw new ApiError(401, "Invalid email or password");
  }

  // Registration scenarios
  async register(userData: RegisterFormData) {
    await simulateDelay(500, 1200);

    if (userData.email === testUsers.existingUser.email) {
      throw new ApiError(409, "Email already registered");
    }

    // Simulate validation errors randomly for testing
    if (Math.random() < 0.1) {
      throw new ApiError(400, "Validation failed", {
        fieldErrors: {
          email: "Email domain not allowed",
        },
      });
    }

    return {
      user: { ...userData, id: generateMockId() },
      accessToken: "mock-jwt-token",
      refreshToken: "mock-refresh-token",
    };
  }

  // Password reset scenarios
  async requestPasswordReset(email: string) {
    await simulateDelay(200, 500);

    // Always return success for security
    return {
      message: "If email exists, reset link has been sent",
      rateLimitReset: Date.now() + 300000, // 5 minutes
    };
  }

  // 2FA scenarios
  async verifyTwoFactor(code: string) {
    await simulateDelay(100, 300);

    if (code === "123456") {
      return { verified: true };
    }

    if (code === "000000") {
      throw new ApiError(400, "Invalid verification code");
    }

    throw new ApiError(429, "Too many verification attempts");
  }
}
```

### Rate Limiting Mock

```typescript
export class MockRateLimiter {
  private attempts = new Map<string, number>();
  private lockouts = new Map<string, number>();

  checkRateLimit(key: string, maxAttempts: number = 5): void {
    const now = Date.now();
    const lockoutUntil = this.lockouts.get(key);

    if (lockoutUntil && now < lockoutUntil) {
      throw new ApiError(
        429,
        `Rate limited. Try again in ${Math.ceil((lockoutUntil - now) / 1000)} seconds`
      );
    }

    const currentAttempts = this.attempts.get(key) || 0;
    if (currentAttempts >= maxAttempts) {
      this.lockouts.set(key, now + 300000); // 5 minute lockout
      throw new ApiError(429, "Too many attempts. Account temporarily locked.");
    }

    this.attempts.set(key, currentAttempts + 1);
  }
}
```

## Accessibility Requirements

### WCAG 2.1 AA Compliance Checklist

#### Perceivable

- [ ] All form inputs have visible labels
- [ ] Color is not the only way to convey information
- [ ] Text has sufficient contrast (4.5:1 minimum)
- [ ] Content is readable and functional at 200% zoom
- [ ] Non-text content has text alternatives

#### Operable

- [ ] All functionality available via keyboard
- [ ] No content flashes more than 3 times per second
- [ ] Users can skip blocks of repeated content
- [ ] Page titles describe page topic or purpose
- [ ] Focus order follows meaningful sequence

#### Understandable

- [ ] Language of page is programmatically determined
- [ ] Navigation mechanisms are consistent
- [ ] Form inputs have labels and instructions
- [ ] Error identification and correction assistance
- [ ] Changes of context are initiated only by user request

#### Robust

- [ ] Content works with assistive technologies
- [ ] Markup validates and follows standards
- [ ] ARIA attributes used correctly
- [ ] Dynamic content updates are announced

### Screen Reader Testing Requirements

```typescript
describe("Screen Reader Compatibility", () => {
  it("should work with NVDA screen reader", () => {
    // RED: Test with NVDA on Windows
    // RED: All content readable
    // RED: Navigation logical
    // RED: Errors announced appropriately
  });

  it("should work with JAWS screen reader", () => {
    // RED: Test with JAWS on Windows
    // RED: Forms fully accessible
    // RED: Proper role announcements
  });

  it("should work with VoiceOver", () => {
    // RED: Test with VoiceOver on macOS/iOS
    // RED: Touch navigation works
    // RED: Rotor navigation functional
  });
});
```

### Mobile Accessibility Requirements

```typescript
describe("Mobile Accessibility", () => {
  it("should support iOS VoiceOver gestures", () => {
    // RED: Swipe navigation works
    // RED: Double-tap activation works
    // RED: Three-finger scroll works
  });

  it("should support Android TalkBack", () => {
    // RED: Explore by touch works
    // RED: Linear navigation works
    // RED: Reading controls work
  });

  it("should support Switch Control", () => {
    // RED: Switch navigation works
    // RED: Proper focus groupings
    // RED: Auto-scanning functional
  });
});
```

## Success Criteria Summary

### Coverage Requirements

- **Unit Test Coverage**: 95% minimum for form components
- **Integration Test Coverage**: 100% of form submission flows
- **Accessibility Test Coverage**: 100% WCAG 2.1 AA compliance
- **Security Test Coverage**: 100% of authentication scenarios

### Performance Benchmarks

- **First Paint**: Forms render within 100ms
- **Interaction Ready**: Forms interactive within 200ms
- **Validation Response**: Real-time validation within 50ms
- **Submission Response**: Progress indication within 100ms

### Quality Gates

- [ ] All tests pass consistently (no flaky tests)
- [ ] Forms work without JavaScript (progressive enhancement)
- [ ] Screen readers can complete all form workflows
- [ ] Mobile users can complete forms with touch/voice
- [ ] Network errors handled gracefully with recovery options
- [ ] Forms persist data appropriately across sessions
- [ ] Security requirements met (XSS prevention, JWT auth, rate limiting)
- [ ] Performance budgets met for all form interactions

This comprehensive test specification ensures that Phase 1 authentication forms
are built with quality, accessibility, and user experience as primary concerns,
following strict TDD methodology to guarantee reliable, maintainable code.
