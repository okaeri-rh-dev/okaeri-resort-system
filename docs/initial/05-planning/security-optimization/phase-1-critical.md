# Phase 1: Critical Security & Memory Fixes

## Implementation Guide

**Phase Duration:** 2 Days
**Priority:** CRITICAL - P0
**Prerequisites:** None
**Dependencies:** DOMPurify package

---

## Overview

Phase 1 addresses the most critical security vulnerabilities and memory leaks that pose immediate risks to production deployment. These issues can lead to data breaches, application crashes, and system exploitation.

---

## Critical Issues to Resolve

### 1. Memory Leak in Optimistic Updates

#### Current Problem

```typescript
// CURRENT - MEMORY LEAK
// File: /src/stores/useBookingStore.ts:56-98
optimisticBookings: new Map(), // Never cleaned up
addOptimisticBooking: (booking) => // Grows indefinitely
```

#### Solution Implementation

```typescript
// Initialize cleanup on app start
// File: /src/main.tsx
import { useBookingStore } from "@/stores/useBookingStore";

// SOLUTION - Add TTL and cleanup mechanism
// File: /src/stores/useBookingStore.ts

interface OptimisticEntry {
  booking: Booking;
  timestamp: number;
}

interface BookingStore {
  optimisticBookings: Map<string, OptimisticEntry>;
  cleanupInterval: NodeJS.Timeout | null;
  // ... existing properties

  startCleanupTimer: () => void;
  stopCleanupTimer: () => void;
}

// Implementation
const OPTIMISTIC_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_OPTIMISTIC_ENTRIES = 100;

export const useBookingStore = create<BookingStore>()(
  devtools(
    persist((set, get) => ({
      // ... existing state
      cleanupInterval: null,

      startCleanupTimer: () => {
        const interval = setInterval(() => {
          const now = Date.now();
          const state = get();
          const newMap = new Map<string, OptimisticEntry>();

          // Keep only recent entries
          state.optimisticBookings.forEach((entry, id) => {
            if (now - entry.timestamp < OPTIMISTIC_TTL) {
              newMap.set(id, entry);
            }
          });

          // Enforce size limit
          if (newMap.size > MAX_OPTIMISTIC_ENTRIES) {
            const sortedEntries = Array.from(newMap.entries())
              .sort((a, b) => b[1].timestamp - a[1].timestamp)
              .slice(0, MAX_OPTIMISTIC_ENTRIES);
            newMap.clear();
            sortedEntries.forEach(([id, entry]) => newMap.set(id, entry));
          }

          set({ optimisticBookings: newMap });
        }, 60000); // Run every minute

        set({ cleanupInterval: interval });
      },

      stopCleanupTimer: () => {
        const state = get();
        if (state.cleanupInterval) {
          clearInterval(state.cleanupInterval);
          set({ cleanupInterval: null });
        }
      },

      addOptimisticBooking: (booking) =>
        set((state) => {
          const newMap = new Map(state.optimisticBookings);
          newMap.set(booking.booking_id, {
            booking,
            timestamp: Date.now(),
          });
          return { optimisticBookings: newMap };
        }),
    }))
  )
);

// In App component or main initialization
useEffect(() => {
  const { startCleanupTimer, stopCleanupTimer } = useBookingStore.getState();
  startCleanupTimer();

  return () => stopCleanupTimer();
}, []);
```

---

### 2. Authentication Security Vulnerabilities

#### Current Problems

1. Predictable session refresh (line 108-126)
2. Unvalidated redirects (line 119)
3. Information leakage (line 32)

#### Solution Implementation

```typescript
// File: /src/lib/auth.ts

import { supabase } from "./supabase";

// Add route validation
const VALID_ROUTES = [
  "/login",
  "/dashboard",
  "/bookings",
  "/units",
  "/guests",
  "/expenses",
  "/payments",
];

function isValidRoute(route: string): boolean {
  return VALID_ROUTES.some((validRoute) => route.startsWith(validRoute));
}

// Add secure random interval generator
function getRandomRefreshInterval(): number {
  // Random interval between 45-55 minutes
  const min = 45 * 60 * 1000;
  const max = 55 * 60 * 1000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

class AuthService {
  private refreshTimeout: NodeJS.Timeout | null = null;

  async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Sanitized error message - no details leaked
        if (process.env.NODE_ENV === "development") {
          console.error("Auth error:", error.message);
        }
        throw new Error("Authentication failed. Please check your credentials.");
      }

      return data;
    } catch (error) {
      // Ensure consistent error messages
      throw new Error("Authentication failed. Please check your credentials.");
    }
  }

  startSessionRefresh() {
    const scheduleNextRefresh = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.refreshSession();

        if (error || !session) {
          this.handleSessionExpired();
          return;
        }

        // Schedule next refresh with random interval
        const interval = getRandomRefreshInterval();
        this.refreshTimeout = setTimeout(scheduleNextRefresh, interval);
      } catch (error) {
        this.handleSessionExpired();
      }
    };

    // Start with random initial interval
    const initialInterval = getRandomRefreshInterval();
    this.refreshTimeout = setTimeout(scheduleNextRefresh, initialInterval);
  }

  private handleSessionExpired() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }

    // Validate redirect route
    const loginRoute = "/login";
    if (isValidRoute(loginRoute)) {
      // Clear sensitive data before redirect
      sessionStorage.clear();
      localStorage.removeItem("auth_token"); // Clear any stored tokens

      // Use location.replace to prevent back button access
      window.location.replace(loginRoute);
    }
  }

  stopSessionRefresh() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }

  async initialize() {
    const session = await this.getSession();

    if (session) {
      this.startSessionRefresh();
    }

    this.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        this.startSessionRefresh();
      } else if (event === "SIGNED_OUT") {
        this.stopSessionRefresh();
        // Secure cleanup
        this.secureCleanup();
      }
    });

    return session;
  }

  private secureCleanup() {
    // Clear all sensitive data
    sessionStorage.clear();
    localStorage.clear();

    // Clear cookies if any
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
  }
}

export const auth = new AuthService();
```

---

### 3. XSS Prevention Implementation

#### Install DOMPurify

```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

#### Create Sanitization Utility

```typescript
// File: /src/lib/security/sanitize.ts

import DOMPurify from "dompurify";

// Configure DOMPurify for strict sanitization
const purifyConfig = {
  ALLOWED_TAGS: [], // No HTML tags allowed by default
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
  RETURN_TRUSTED_TYPE: false,
};

// For plain text fields (names, emails, etc.)
export function sanitizeText(input: string): string {
  if (!input) return "";
  // Remove all HTML and scripts
  return DOMPurify.sanitize(input, purifyConfig);
}

// For rich text fields (descriptions, notes)
export function sanitizeRichText(input: string): string {
  if (!input) return "";
  // Allow basic formatting tags only
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "ul", "ol", "li"],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
}

// For URLs
export function sanitizeUrl(url: string): string {
  if (!url) return "";

  // Only allow http, https, and relative URLs
  const sanitized = DOMPurify.sanitize(url, purifyConfig);

  try {
    const urlObj = new URL(sanitized, window.location.origin);
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return "";
    }
    return urlObj.toString();
  } catch {
    // If not a valid URL, treat as relative path
    return sanitized.startsWith("/") ? sanitized : "";
  }
}

// For form data objects
export function sanitizeFormData<T extends Record<string, any>>(
  data: T,
  richTextFields: string[] = []
): T {
  const sanitized = { ...data };

  Object.keys(sanitized).forEach((key) => {
    const value = sanitized[key];

    if (typeof value === "string") {
      if (richTextFields.includes(key)) {
        sanitized[key] = sanitizeRichText(value);
      } else if (key.toLowerCase().includes("url") || key.toLowerCase().includes("link")) {
        sanitized[key] = sanitizeUrl(value);
      } else {
        sanitized[key] = sanitizeText(value);
      }
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeFormData(value, richTextFields);
    }
  });

  return sanitized;
}

// React hook for sanitized input
export function useSanitizedInput(initialValue = "") {
  const [value, setValue] = useState(initialValue);

  const handleChange = useCallback((newValue: string) => {
    setValue(sanitizeText(newValue));
  }, []);

  return [value, handleChange] as const;
}
```

#### Update BookingForm with Sanitization

```typescript
// File: /src/components/bookings/BookingForm.tsx

import { sanitizeFormData, sanitizeText } from "@/lib/security/sanitize";

// In onSubmit function (line 225)
const onSubmit = async (data: CompleteBookingData) => {
  try {
    // Sanitize all form data before submission
    const sanitizedData = sanitizeFormData(data, ["special_requests"]);

    const bookingData = {
      ...sanitizedData,
      check_in: data.check_in.toISOString(),
      check_out: data.check_out.toISOString(),
      total_amount: calculatedTotal,
      contact_number: formatPhoneNumber(sanitizeText(data.contact_number)),
    };

    if (isEditMode) {
      await updateBookingMutation.mutateAsync({
        bookingId: bookingId!,
        updates: bookingData,
      });
      toast.success("Booking updated successfully!");
    } else {
      await createBookingMutation.mutateAsync(bookingData);
      toast.success("Booking created successfully!");
    }

    onSuccess?.(bookingData);
  } catch (error) {
    // Safe error handling
    const errorMessage = isEditMode
      ? "Failed to update booking. Please try again."
      : "Failed to create booking. Please try again.";

    toast.error(errorMessage);

    if (process.env.NODE_ENV === "development") {
      console.error(`Booking ${isEditMode ? "update" : "creation"} error:`, error);
    }
  }
};
```

---

## Testing Checklist

### Memory Leak Testing

- [ ] Run application for 1 hour with continuous operations
- [ ] Monitor browser memory usage (Chrome DevTools Performance Monitor)
- [ ] Verify Map size stays under 100 entries
- [ ] Check cleanup timer executes every minute
- [ ] Confirm old entries are removed after 5 minutes

### Authentication Security Testing

- [ ] Session refresh occurs at random intervals (45-55 min)
- [ ] Invalid routes are blocked on redirect
- [ ] Error messages don't leak sensitive information
- [ ] Session cleanup removes all sensitive data
- [ ] Back button doesn't access protected pages after logout

### XSS Prevention Testing

- [ ] Test script injection in all form fields
- [ ] Verify HTML tags are stripped from text inputs
- [ ] Confirm rich text fields allow only safe tags
- [ ] Test URL sanitization with javascript: protocol
- [ ] Validate nested object sanitization

### Test Payloads

```javascript
// XSS Test Payloads
const xssPayloads = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert("XSS")>',
  'javascript:alert("XSS")',
  '<svg onload=alert("XSS")>',
  '"><script>alert("XSS")</script>',
  '<iframe src=javascript:alert("XSS")>',
];

// SQL Injection Test Payloads
const sqlPayloads = [
  "'; DROP TABLE bookings; --",
  "1' OR '1' = '1",
  "admin'--",
  "1' UNION SELECT * FROM users--",
];
```

---

## Rollback Plan

If issues occur during implementation:

1. **Immediate Rollback**

   ```bash
   git revert HEAD~1
   npm run build
   npm run test
   ```

2. **Data Recovery**
   - Restore from session storage backup
   - Clear corrupted optimistic updates
   - Reset authentication state

3. **Emergency Patches**
   - Disable optimistic updates temporarily
   - Revert to fixed session intervals
   - Enable basic HTML escaping as fallback

---

## Success Criteria

### Phase 1 Complete When:

- [ ] No memory leaks detected in 24-hour test
- [ ] Zero security vulnerabilities in OWASP scan
- [ ] All form inputs properly sanitized
- [ ] Authentication flow secure and validated
- [ ] Error messages sanitized in production
- [ ] All tests passing (100% coverage)

---

## Next Steps

After completing Phase 1:

1. Deploy to staging environment
2. Run security penetration testing
3. Monitor for 24 hours
4. Proceed to Phase 2 if stable

---

**Document Version:** 1.0.0
**Phase Owner:** Security Lead
**Review Required By:** CTO, Security Team
**Estimated Completion:** 2 days from start
