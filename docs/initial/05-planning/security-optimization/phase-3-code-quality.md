# Phase 3: Code Quality & Architecture

## Implementation Guide

**Phase Duration:** 2 Days
**Priority:** HIGH - P1
**Prerequisites:** Phase 1 & 2 Complete
**Dependencies:** ESLint, Prettier, React DevTools

---

## Overview

Phase 3 addresses architectural debt, component organization, and code quality issues. This phase will improve maintainability, reduce complexity, and establish robust error handling throughout the application.

---

## Major Refactoring Tasks

### 1. Split Large Components (800+ Lines)

#### Current Problem: BookingForm.tsx - 800+ lines

```typescript
// CURRENT STRUCTURE - Monolithic component
/src/components/bookings/BookingForm.tsx (800+ lines)
  - Step 1: Unit selection
  - Step 2: Guest information
  - Step 3: Payment details
  - Step 4: Review
  - Validation logic
  - State management
  - API calls
```

#### Solution: Component Decomposition

```typescript
// NEW STRUCTURE - Modular components
/src/components/bookings/
  ├── BookingForm/
  │   ├── index.tsx (Main orchestrator - 150 lines)
  │   ├── types.ts (Shared types)
  │   ├── hooks/
  │   │   ├── useBookingForm.ts
  │   │   ├── useBookingValidation.ts
  │   │   └── useBookingCalculations.ts
  │   ├── steps/
  │   │   ├── UnitSelection.tsx
  │   │   ├── GuestInformation.tsx
  │   │   ├── PaymentDetails.tsx
  │   │   └── BookingReview.tsx
  │   ├── components/
  │   │   ├── StepIndicator.tsx
  │   │   ├── BookingSummary.tsx
  │   │   └── PricingBreakdown.tsx
  │   └── utils/
  │       ├── validation.ts
  │       └── calculations.ts

// File: /src/components/bookings/BookingForm/index.tsx
import { useState, useCallback } from 'react';
import { useBookingForm } from './hooks/useBookingForm';
import { StepIndicator } from './components/StepIndicator';
import { UnitSelection } from './steps/UnitSelection';
import { GuestInformation } from './steps/GuestInformation';
import { PaymentDetails } from './steps/PaymentDetails';
import { BookingReview } from './steps/BookingReview';
import type { BookingFormProps, FormStep } from './types';

const STEPS = {
  1: UnitSelection,
  2: GuestInformation,
  3: PaymentDetails,
  4: BookingReview,
} as const;

export function BookingForm({
  onSuccess,
  onCancel,
  initialData,
  bookingId,
  className,
}: BookingFormProps) {
  const [currentStep, setCurrentStep] = useState<FormStep>(1);

  const {
    form,
    isSubmitting,
    calculatedTotal,
    handleSubmit,
    validateStep,
  } = useBookingForm({
    initialData,
    bookingId,
    onSuccess,
  });

  const handleNextStep = useCallback(async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < 4) {
      setCurrentStep(prev => (prev + 1) as FormStep);
    }
  }, [currentStep, validateStep]);

  const handlePreviousStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => (prev - 1) as FormStep);
    }
  }, [currentStep]);

  const CurrentStepComponent = STEPS[currentStep];

  return (
    <div className={className}>
      <StepIndicator currentStep={currentStep} totalSteps={4} />

      <CurrentStepComponent
        form={form}
        onNext={handleNextStep}
        onPrevious={handlePreviousStep}
        onSubmit={handleSubmit}
        calculatedTotal={calculatedTotal}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

// File: /src/components/bookings/BookingForm/hooks/useBookingForm.ts
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useCallback } from 'react';
import { useCreateBooking, useUpdateBooking } from '@/stores/useBookingStore';
import { completeBookingSchema } from '@/lib/validations';
import { calculateBookingTotal } from '../utils/calculations';
import { validateStepData } from '../utils/validation';
import type { CompleteBookingData, UseBookingFormProps } from '../types';

export function useBookingForm({
  initialData,
  bookingId,
  onSuccess,
}: UseBookingFormProps) {
  const isEditMode = !!bookingId;
  const createMutation = useCreateBooking();
  const updateMutation = useUpdateBooking();

  const form = useForm<CompleteBookingData>({
    resolver: zodResolver(completeBookingSchema),
    defaultValues: {
      unit_id: '',
      check_in: new Date(),
      check_out: new Date(Date.now() + 24 * 60 * 60 * 1000),
      num_guests: 1,
      guest_name: '',
      email: '',
      contact_number: '',
      special_requests: '',
      payment_method: undefined,
      ...initialData,
    },
    mode: 'onBlur',
  });

  const watchedFields = form.watch();

  const calculatedTotal = useMemo(
    () => calculateBookingTotal(watchedFields),
    [watchedFields]
  );

  const validateStep = useCallback(
    async (step: number) => {
      return validateStepData(step, form.getValues());
    },
    [form]
  );

  const handleSubmit = useCallback(
    async (data: CompleteBookingData) => {
      const bookingData = {
        ...data,
        total_amount: calculatedTotal,
      };

      const mutation = isEditMode ? updateMutation : createMutation;

      await mutation.mutateAsync(
        isEditMode
          ? { bookingId, updates: bookingData }
          : bookingData
      );

      onSuccess?.(bookingData);
    },
    [isEditMode, bookingId, calculatedTotal, onSuccess, createMutation, updateMutation]
  );

  return {
    form,
    isSubmitting: createMutation.isPending || updateMutation.isPending,
    calculatedTotal,
    handleSubmit,
    validateStep,
  };
}
```

---

### 2. Implement Component-Level Error Boundaries

```typescript
// File: /src/components/bookings/BookingForm/index.tsx - UPDATED
import { ErrorBoundary } from '@/components/ErrorBoundary';

export function BookingFormWithErrorBoundary(props: BookingFormProps) {
  return (
    <ErrorBoundary
      level="component"
      fallback={
        <div className="p-4 border border-red-200 rounded-md">
          <p className="text-red-600">
            Failed to load booking form. Please refresh the page.
          </p>
        </div>
      }
    >
      <BookingForm {...props} />
    </ErrorBoundary>
  );
}

// File: /src/components/dashboard/DashboardWithErrorBoundary.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Dashboard } from './Dashboard';

export function DashboardWithErrorBoundary() {
  return (
    <ErrorBoundary
      level="page"
      onError={(error, errorInfo) => {
        // Log to error tracking service
        console.error('Dashboard error:', error, errorInfo);
      }}
    >
      <Dashboard />
    </ErrorBoundary>
  );
}

// File: /src/components/data-table/DataTableWithErrorBoundary.tsx
export function DataTableWithErrorBoundary<T>({
  data,
  columns,
  onError,
  ...props
}: DataTableProps<T>) {
  return (
    <ErrorBoundary
      level="component"
      onError={onError}
      fallback={
        <div className="p-8 text-center">
          <p className="text-gray-500">Failed to load data table</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
          >
            Reload
          </button>
        </div>
      }
    >
      <DataTable data={data} columns={columns} {...props} />
    </ErrorBoundary>
  );
}
```

---

### 3. Fix useEffect Cleanup Issues

```typescript
// File: /src/components/guests/GuestQuickForm.tsx - FIX
// File: /src/hooks/useSearch.ts - FIX
import { useEffect, useEffect, useRef, useRef } from "react";

export function GuestQuickForm() {
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  useEffect(
    () => {
      // Line 392 - Add proper cleanup
      const handler = setTimeout(() => {
        // Debounced logic
      }, 300);

      debounceTimerRef.current = handler;

      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    },
    [
      /* dependencies */
    ]
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);
}

export function useSearch() {
  const debounceTimer = useRef<NodeJS.Timeout>();

  const debouncedSearch = useCallback((query: string) => {
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer
    debounceTimer.current = setTimeout(() => {
      performSearch(query);
    }, 300);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return { debouncedSearch };
}

// File: /src/hooks/useEventListener.ts - NEW UTILITY HOOK
export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element: Window | HTMLElement = window,
  options?: AddEventListenerOptions
) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const eventListener = (event: Event) => {
      savedHandler.current(event as WindowEventMap[K]);
    };

    element.addEventListener(eventName, eventListener, options);

    return () => {
      element.removeEventListener(eventName, eventListener, options);
    };
  }, [eventName, element, options]);
}

// File: /src/hooks/useInterval.ts - NEW UTILITY HOOK
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => {
      savedCallback.current();
    }, delay);

    return () => clearInterval(id);
  }, [delay]);
}
```

---

### 4. Establish Coding Standards

```typescript
// File: /.eslintrc.json - ENHANCED CONFIGURATION
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    // Enforce component size
    "max-lines": ["error", {
      "max": 300,
      "skipBlankLines": true,
      "skipComments": true
    }],

    // Enforce function complexity
    "complexity": ["error", 10],

    // Require cleanup in useEffect
    "react-hooks/exhaustive-deps": "error",

    // No any types
    "@typescript-eslint/no-explicit-any": "error",

    // Require explicit return types
    "@typescript-eslint/explicit-function-return-type": ["error", {
      "allowExpressions": true,
      "allowTypedFunctionExpressions": true
    }],

    // Enforce naming conventions
    "@typescript-eslint/naming-convention": [
      "error",
      {
        "selector": "interface",
        "format": ["PascalCase"],
        "prefix": ["I"]
      },
      {
        "selector": "typeAlias",
        "format": ["PascalCase"]
      },
      {
        "selector": "enum",
        "format": ["PascalCase"]
      }
    ],

    // Require error handling
    "no-unhandled-promise-rejection": "error",

    // Enforce consistent imports
    "import/order": ["error", {
      "groups": [
        "builtin",
        "external",
        "internal",
        "parent",
        "sibling",
        "index"
      ],
      "newlines-between": "always",
      "alphabetize": {
        "order": "asc"
      }
    }]
  }
}

// File: /src/utils/component-standards.ts - NEW STANDARDS GUIDE
export const COMPONENT_STANDARDS = {
  maxLines: 300,
  maxComplexity: 10,
  maxProps: 8,
  requireMemo: true,
  requireErrorBoundary: ['forms', 'tables', 'charts'],
  namingConventions: {
    components: 'PascalCase',
    hooks: 'camelCase with use prefix',
    utils: 'camelCase',
    constants: 'UPPER_SNAKE_CASE',
  },
} as const;
```

---

### 5. Create Reusable Patterns

```typescript
// File: /src/patterns/form-pattern.tsx - NEW REUSABLE PATTERN
import { ReactNode } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface FormWrapperProps<T> {
  form: UseFormReturn<T>;
  onSubmit: (data: T) => Promise<void>;
  children: ReactNode;
  className?: string;
}

export function FormWrapper<T>({
  form,
  onSubmit,
  children,
  className,
}: FormWrapperProps<T>) {
  return (
    <ErrorBoundary level="component">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={className}
        noValidate
      >
        {children}
      </form>
    </ErrorBoundary>
  );
}

// File: /src/patterns/data-fetching-pattern.tsx
interface DataFetchingWrapperProps<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error;
  children: (data: T) => ReactNode;
  loadingComponent?: ReactNode;
  errorComponent?: ReactNode;
}

export function DataFetchingWrapper<T>({
  data,
  isLoading,
  isError,
  error,
  children,
  loadingComponent = <DefaultLoader />,
  errorComponent = <DefaultError error={error} />,
}: DataFetchingWrapperProps<T>) {
  if (isLoading) return <>{loadingComponent}</>;
  if (isError) return <>{errorComponent}</>;
  if (!data) return null;

  return (
    <ErrorBoundary level="component">
      {children(data)}
    </ErrorBoundary>
  );
}

// File: /src/patterns/modal-pattern.tsx
interface ModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function ModalWrapper({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}: ModalWrapperProps) {
  // Cleanup on unmount
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle escape key
  useEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen) {
      onClose();
    }
  });

  if (!isOpen) return null;

  return (
    <ErrorBoundary level="component">
      <Portal>
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />

          {/* Modal */}
          <div className={`modal-${size}`}>
            <div className="modal-header">
              <h2>{title}</h2>
              <button onClick={onClose}>×</button>
            </div>
            <div className="modal-body">
              {children}
            </div>
          </div>
        </div>
      </Portal>
    </ErrorBoundary>
  );
}
```

---

## Architecture Improvements

### Folder Structure Reorganization

```
/src/
├── components/           # UI components
│   ├── common/          # Shared components
│   ├── forms/           # Form components
│   ├── tables/          # Data tables
│   └── modals/          # Modal components
├── features/            # Feature-based modules
│   ├── bookings/
│   ├── guests/
│   ├── units/
│   └── payments/
├── hooks/               # Custom hooks
│   ├── api/            # API hooks
│   ├── ui/             # UI hooks
│   └── utils/          # Utility hooks
├── lib/                 # External libraries config
├── patterns/            # Reusable patterns
├── services/            # API services
├── stores/              # State management
├── types/               # TypeScript types
├── utils/               # Utility functions
└── routes/              # Route components
```

---

## Testing Requirements

### Component Testing

```typescript
// File: /src/components/bookings/BookingForm/__tests__/BookingForm.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookingForm } from '../index';

describe('BookingForm', () => {
  it('should not exceed 300 lines', () => {
    const componentLines = getComponentLineCount('BookingForm/index.tsx');
    expect(componentLines).toBeLessThanOrEqual(300);
  });

  it('should handle errors gracefully', async () => {
    const onError = jest.fn();

    render(
      <BookingForm
        onError={onError}
        initialData={invalidData}
      />
    );

    await waitFor(() => {
      expect(onError).not.toHaveBeenCalled();
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('should clean up on unmount', () => {
    const { unmount } = render(<BookingForm />);
    const cleanupSpy = jest.spyOn(window, 'clearTimeout');

    unmount();

    expect(cleanupSpy).toHaveBeenCalled();
  });
});
```

---

## Success Criteria

### Phase 3 Complete When:

- [ ] No components > 300 lines
- [ ] All forms wrapped in error boundaries
- [ ] All data tables have error boundaries
- [ ] All useEffect hooks have cleanup
- [ ] No timers without cleanup
- [ ] All event listeners removed on unmount
- [ ] ESLint rules passing
- [ ] Code coverage > 80%
- [ ] Reusable patterns documented

---

## Next Steps

1. Run ESLint with new rules
2. Measure component complexity
3. Verify error boundary coverage
4. Test cleanup functions
5. Proceed to Phase 4

---

**Document Version:** 1.0.0
**Phase Owner:** Frontend Architect
**Review Required By:** Tech Lead, QA Team
**Estimated Completion:** 2 days from start
