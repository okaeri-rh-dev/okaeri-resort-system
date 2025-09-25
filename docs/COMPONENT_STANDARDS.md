# Component Standards & Architecture Guidelines

## Phase 3 Code Quality Standards Implementation

### Overview

This document defines the component architecture standards implemented during Phase 3 of the Okaeri Resort System development. These standards ensure consistent, maintainable, and high-quality code across the application.

---

## 📏 Component Size Standards

### Maximum Lines Per Component

| Component Type       | Max Lines | Rationale                                         |
| -------------------- | --------- | ------------------------------------------------- |
| UI Components        | 250       | Ensures focused, single-responsibility components |
| Container Components | 300       | Allows for orchestration logic                    |
| Page Components      | 350       | Accommodates layout and routing logic             |
| Utility Hooks        | 150       | Keeps hooks focused and testable                  |
| Patterns             | 400       | Allows for comprehensive examples                 |

### Decomposition Strategy

When a component exceeds its line limit:

1. **Extract Custom Hooks**: Move business logic to hooks
2. **Create Sub-components**: Break down UI into smaller pieces
3. **Use Composition**: Leverage component composition patterns
4. **Separate Concerns**: Split data fetching, UI, and logic

Example structure from UnitsTable refactoring:

```
UnitsTable/
├── index.tsx (150 lines) - Main orchestrator
├── components/
│   ├── InlineEdit.tsx - Inline editing functionality
│   ├── UnitColumns.tsx - Column definitions
│   └── TableHeader.tsx - Header with filters
├── hooks/
│   └── useUnitsTable.ts - Table logic
└── utils/
    └── export.ts - Export functionality
```

---

## 🛡️ Error Handling Standards

### Error Boundary Implementation

Every component must be wrapped with appropriate error boundaries:

```typescript
// Page-level components
export const DashboardPage = withRouteWrapper(Dashboard, {
  title: "Dashboard",
  level: "page",
});

// Component-level
export const BookingForm = withErrorBoundary(BookingFormComponent, {
  level: "component",
});
```

### Error Boundary Levels

| Level       | Usage                     | Recovery Strategy           |
| ----------- | ------------------------- | --------------------------- |
| `app`       | Root application boundary | Full page reload            |
| `page`      | Route/page components     | Page refresh or navigation  |
| `component` | Individual components     | Component retry or fallback |

---

## 🧹 useEffect Cleanup Standards

### Required Cleanup Patterns

All `useEffect` hooks must properly clean up:

```typescript
// ❌ BAD - No cleanup
useEffect(() => {
  const timer = setTimeout(() => {
    doSomething();
  }, 1000);
}, []);

// ✅ GOOD - Proper cleanup
useEffect(() => {
  const timer = setTimeout(() => {
    doSomething();
  }, 1000);

  return () => clearTimeout(timer);
}, []);
```

### Use Custom Hooks for Common Patterns

```typescript
import { useInterval, useTimeout, useEventListener } from "@/hooks/useCleanup";

// Instead of manual cleanup, use utility hooks
useInterval(() => {
  fetchData();
}, 5000);

useEventListener("resize", handleResize);
```

---

## 📦 Component Organization

### Folder Structure

```
src/
├── components/          # Presentational components
│   ├── common/         # Shared UI components
│   ├── forms/          # Form-specific components
│   ├── tables/         # Table components
│   └── modals/         # Modal components
├── patterns/           # Reusable component patterns
├── hooks/              # Custom React hooks
├── stores/             # State management (Zustand)
├── lib/                # External library configurations
├── utils/              # Utility functions
└── types/              # TypeScript type definitions
```

### File Naming Conventions

| Type       | Convention                  | Example             |
| ---------- | --------------------------- | ------------------- |
| Components | PascalCase                  | `BookingForm.tsx`   |
| Hooks      | camelCase with 'use' prefix | `useBookings.ts`    |
| Utils      | camelCase                   | `formatCurrency.ts` |
| Types      | PascalCase                  | `Booking.ts`        |
| Constants  | UPPER_SNAKE_CASE            | `API_ENDPOINTS.ts`  |

---

## 🎨 Pattern Usage

### Available Patterns

1. **FormWrapper**: Consistent form handling with error boundaries
2. **DataFetchingWrapper**: Loading, error, and empty states
3. **TableWrapper**: Sortable, filterable tables with pagination
4. **ModalWrapper**: Accessible modals with cleanup
5. **RouteWrapper**: Page-level error boundaries and loading

### Pattern Implementation Example

```typescript
// Using FormWrapper pattern
<FormWrapper
  form={form}
  onSubmit={handleSubmit}
  sanitize={true}
>
  <FormFields />
</FormWrapper>

// Using DataFetchingWrapper pattern
<DataFetchingWrapper
  data={bookings}
  isLoading={isLoading}
  isError={isError}
  error={error}
>
  {(data) => <BookingsList bookings={data} />}
</DataFetchingWrapper>
```

---

## 🔒 Security Standards

### Input Sanitization

All user inputs must be sanitized:

```typescript
import { sanitizeFormData } from "@/lib/security/sanitize";

const handleSubmit = (data: FormData) => {
  const sanitized = sanitizeFormData(data);
  // Process sanitized data
};
```

### XSS Prevention

- Use DOMPurify for HTML content
- Avoid `dangerouslySetInnerHTML`
- Sanitize all dynamic content

---

## 📊 Performance Standards

### React.memo Usage

Memoize components that:

- Render frequently
- Have expensive render logic
- Are in lists

```typescript
export const ExpensiveComponent = memo(
  ({ data }) => {
    // Component logic
  },
  (prevProps, nextProps) => {
    // Custom comparison
    return prevProps.data.id === nextProps.data.id;
  }
);
```

### Code Splitting

All routes must be lazy loaded:

```typescript
const Dashboard = lazy(() => import("./Dashboard").then((m) => ({ default: m.Dashboard })));
```

---

## ✅ Type Safety Standards

### No Any Types

```typescript
// ❌ BAD
const processData = (data: any) => {};

// ✅ GOOD
const processData = <T extends Record<string, unknown>>(data: T) => {};
```

### Explicit Return Types

Public APIs must have explicit return types:

```typescript
// ✅ Required for public APIs
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

---

## 🧪 Testing Requirements

### Component Testing Checklist

- [ ] Component renders without errors
- [ ] Error boundaries catch errors
- [ ] Cleanup functions are called
- [ ] Component stays within size limits
- [ ] Accessibility requirements met

### Test File Structure

```typescript
describe("ComponentName", () => {
  it("should not exceed 300 lines", () => {
    // Size validation
  });

  it("should handle errors gracefully", () => {
    // Error boundary testing
  });

  it("should clean up on unmount", () => {
    // Cleanup verification
  });
});
```

---

## 📝 Documentation Requirements

### Component Documentation

Every component must have:

````typescript
/**
 * ComponentName
 *
 * Purpose: Brief description of what the component does
 *
 * Props:
 * - prop1: Description
 * - prop2: Description
 *
 * Usage:
 * ```tsx
 * <ComponentName prop1="value" />
 * ```
 */
````

### Hook Documentation

````typescript
/**
 * useHookName
 *
 * Purpose: What the hook does
 *
 * Parameters:
 * - param1: Description
 *
 * Returns:
 * - return1: Description
 *
 * Example:
 * ```tsx
 * const { data, loading } = useHookName(params);
 * ```
 */
````

---

## 🚀 Migration Guide

### Refactoring Large Components

1. **Analyze**: Identify responsibilities
2. **Plan**: Design new structure
3. **Extract**: Move logic to hooks
4. **Decompose**: Create sub-components
5. **Test**: Verify functionality
6. **Document**: Update documentation

### Progressive Enhancement

1. Start with error boundaries
2. Add loading states
3. Implement cleanup
4. Optimize performance
5. Add accessibility

---

## 📋 Compliance Checklist

Before marking a component as Phase 3 compliant:

- [ ] Component < 300 lines
- [ ] Error boundary implemented
- [ ] useEffect cleanup verified
- [ ] No any types
- [ ] React.memo where appropriate
- [ ] Proper file organization
- [ ] Documentation complete
- [ ] Tests passing

---

## 🔍 Review Process

### Code Review Checklist

1. **Size**: Does the component exceed line limits?
2. **Errors**: Are error boundaries in place?
3. **Cleanup**: Do all effects have cleanup?
4. **Types**: Are types properly defined?
5. **Patterns**: Are reusable patterns utilized?
6. **Security**: Is input sanitization implemented?
7. **Performance**: Are optimizations applied?
8. **Documentation**: Is documentation complete?

---

## 📚 Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [ESLint Rules](./eslint.config.phase3.js)
- [Component Patterns](./src/patterns/)

---

## 🎯 Success Metrics

| Metric                  | Target | Current     |
| ----------------------- | ------ | ----------- |
| Components > 300 lines  | 0      | TBD         |
| Error boundary coverage | 100%   | In Progress |
| useEffect cleanup       | 100%   | In Progress |
| Type coverage           | 100%   | In Progress |
| Test coverage           | > 80%  | TBD         |

---

**Last Updated**: September 25, 2025
**Phase**: 3 - Code Quality & Architecture
**Status**: Implementation In Progress
