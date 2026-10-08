# 🎣 Entity Hooks - Reusable Entity Management

## Overview

The Entity hooks library provides **type-safe, generic hooks** for managing entity data operations across all entity types (bookings, guests, units, payments, expenses). These hooks eliminate code duplication by providing a unified interface for common CRUD operations with TanStack Query integration.

**Impact**: Used by **10+ edit pages** and detail views, reducing per-entity hook implementation from ~200 lines to ~20 lines.

## 📁 Directory Structure

```
entity/
├── useEntityEdit.ts           # Update entity with optimistic UI
├── useEntityAudit.ts          # Fetch audit logs for entity
├── useEntityNavigation.ts     # Type-safe navigation helpers
├── useDetailPageState.ts      # URL-synced UI state (tabs)
├── __tests__/                 # Comprehensive hook tests
└── index.ts                   # Barrel export
```

## 📦 Core Hooks

### 2. useEntityEdit

**Purpose**: Generic hook for updating entities with optimistic updates, automatic rollback, and audit logging.

**Features**:
- **Optimistic updates** for instant UI feedback
- **Automatic rollback** on error (restores previous state)
- **Audit trail logging** for all mutations (fire-and-forget)
- **Toast notifications** for success/error states
- **Query cache invalidation** on success
- **Custom callbacks** (onSuccess, onError)
- Type-safe update data based on entity type

**Hook Signature**:
```typescript
function useEntityEdit<T extends EntityType>(
  entityType: T,
  entityId: string,
  options?: {
    onSuccess?: (data: EntityUpdateData<T>) => void;
    onError?: (error: Error) => void;
  }
): UseMutationResult<EntityUpdateData<T>, Error, EntityUpdateData<T>>
```

**Entity Update Data Types**:
```typescript
type EntityUpdateData<T> =
  | T extends 'booking' ? Partial<Booking>
  | T extends 'unit' ? Partial<Unit>
  | T extends 'guest' ? Partial<Guest>
  | T extends 'payment' ? Partial<Payment>
  | T extends 'expense' ? Partial<Expense>
```

**Mutation Flow**:
1. **onMutate**: Cancel in-flight queries, snapshot current data, optimistically update cache
2. **mutationFn**: Execute database update, log audit event
3. **onError**: Rollback cache to snapshot, show error toast, call custom error handler
4. **onSuccess**: Invalidate queries, show success toast, call custom success handler

**Real-World Usage**: `src/components/guests/GuestEdit/index.tsx:47-51`

---

### 3. useEntityAudit

**Purpose**: Fetch audit logs filtered by entity type and ID.

**Features**:
- Queries `audit_logs` table with flexible filtering
- Filters by entity type and ID (required)
- Optional filters: action, user_id, date range
- Ordered by created_at (descending)
- Limited to 50 most recent entries
- 10-second stale time (audit logs don't change frequently)

**Hook Signature**:
```typescript
function useEntityAudit(
  filters: {
    entity_type: EntityType;
    entity_id: string;
    action?: string;
    user_id?: string;
    date_from?: Date;
    date_to?: Date;
  }
): UseQueryResult<AuditLog[]>
```

**Real-World Usage**: Used by `DetailAuditSection` component - `src/components/entity-detail/DetailAuditSection.tsx`

---

### 4. useEntityNavigation

**Purpose**: Type-safe programmatic navigation helper for entities.

**Features**:
- Three navigation methods: `navigateToDetail`, `navigateToEdit`, `navigateToList`
- Type-safe route params based on entity type
- Optional search params support
- Centralized route configuration

**Hook Signature**:
```typescript
function useEntityNavigation(): {
  navigateToDetail: <T extends EntityType>(
    entityType: T,
    entityId: string,
    search?: Record<string, unknown>
  ) => void;
  navigateToEdit: <T extends EntityType>(entityType: T, entityId: string) => void;
  navigateToList: (entityType: EntityType) => void;
}
```

**Route Mappings**:
```typescript
// Detail routes
{
  booking: '/bookings/$bookingId',
  unit: '/units/$unitId',
  guest: '/guests/$guestId',
  payment: '/payments/$paymentId',
  expense: '/expenses/$expenseId',
}

// Edit routes
{
  booking: '/bookings/$bookingId/edit',
  unit: '/units/$unitId/edit',
  guest: '/guests/$guestId/edit',
  payment: '/payments/$paymentId/edit',
  expense: '/expenses/$expenseId/edit',
}

// List routes
{
  booking: '/bookings',
  unit: '/units',
  guest: '/guests',
  payment: '/payments',
  expense: '/expenses',
}
```

**Real-World Usage**: Used in detail/edit pages for navigation after operations

---

### 5. useDetailPageState

**Purpose**: Manage detail page UI state (tabs) synced with URL search params.

**Features**:
- Reads active tab from URL search params
- Updates URL on tab change (with replace navigation to avoid history clutter)
- Preserves other search params
- Default tab: `'details'`

**Hook Signature**:
```typescript
function useDetailPageState(): {
  activeTab: TabValue; // "details" | "payments" | "audit" | "history"
  setActiveTab: (tab: TabValue) => void;
}
```

**Tab Values**: `'details' | 'payments' | 'audit' | 'history'`

**URL Behavior**:
- Tab state persisted in URL: `/bookings/123?tab=payments`
- Uses `replace: true` navigation (doesn't clutter browser history)
- Defaults to `'details'` if no `?tab` param

**Real-World Usage**: Detail pages with tabbed navigation

---

## 🎯 Architecture Pattern

### Entity Management Flow

```
┌─────────────────────────────────────────────────────────┐
│ Edit Page Component                                      │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 1. Route Loader                                    │ │
│  │    - Prefetches entity data                        │ │
│  │    - Uses db.[entity].byId()                       │ │
│  │    - Cached by TanStack Query                      │ │
│  └────────────────────────────────────────────────────┘ │
│               │                                          │
│               ▼                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 2. useEntityEdit Hook                              │ │
│  │    - Setup mutation                                │ │
│  │    - Configure onSuccess callback (navigate)       │ │
│  └────────────────────────────────────────────────────┘ │
│               │                                          │
│               ▼                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 3. Form Submit Handler                             │ │
│  │    - updateEntity.mutate(formData)                 │ │
│  └────────────────────────────────────────────────────┘ │
│               │                                          │
│               ▼                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 4. Mutation Flow                                   │ │
│  │    ┌─────────────────────────────────────────────┐ │ │
│  │    │ onMutate:                                   │ │ │
│  │    │  • Cancel queries                           │ │ │
│  │    │  • Snapshot current data                    │ │ │
│  │    │  • Optimistically update cache              │ │ │
│  │    └─────────────────────────────────────────────┘ │ │
│  │    ┌─────────────────────────────────────────────┐ │ │
│  │    │ mutationFn:                                 │ │ │
│  │    │  • Execute db.[entity].update()             │ │ │
│  │    │  • Log audit event (fire-and-forget)        │ │ │
│  │    └─────────────────────────────────────────────┘ │ │
│  │    ┌─────────────────────────────────────────────┐ │ │
│  │    │ onSuccess:                                  │ │ │
│  │    │  • Invalidate entity cache                  │ │ │
│  │    │  • Invalidate list cache                    │ │ │
│  │    │  • Show success toast                       │ │ │
│  │    │  • Navigate to detail page                  │ │ │
│  │    └─────────────────────────────────────────────┘ │ │
│  │    ┌─────────────────────────────────────────────┐ │ │
│  │    │ onError:                                    │ │ │
│  │    │  • Rollback to snapshot                     │ │ │
│  │    │  • Show error toast                         │ │ │
│  │    │  • Call custom error handler                │ │ │
│  │    └─────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Pattern Benefits

1. **Code Reduction**: ~90% less code for entity operations
2. **Type Safety**: Full TypeScript support with proper entity typing
3. **Consistency**: Identical behavior across all entities
4. **Optimistic UX**: Instant UI feedback before server confirmation
5. **Error Handling**: Automatic rollback and user notifications
6. **Audit Trail**: Automatic logging for compliance

---

## 🚀 Best Practices

### 1. useEntityEdit Integration

**✅ DO**: Use with navigation callback
```typescript
const updateBooking = useEntityEdit('booking', bookingId, {
  onSuccess: () => {
    navigate({ to: '/bookings/$bookingId', params: { bookingId } });
  },
});

const handleSubmit = (data: BookingFormData) => {
  updateBooking.mutate(data);
};
```

**✅ DO**: Check mutation state for loading indicators
```typescript
const updateGuest = useEntityEdit('guest', guestId);

<Button
  type="submit"
  disabled={updateGuest.isPending}
>
  {updateGuest.isPending ? 'Saving...' : 'Save Changes'}
</Button>
```

**❌ DON'T**: Create separate mutations for each entity
```typescript
// ❌ Bad - duplicates logic
const updateBooking = useMutation({
  mutationFn: (data) => db.bookings.update(bookingId, data),
  // ... repeat optimistic updates, rollback, audit, etc.
});

// ✅ Good - use generic hook
const updateBooking = useEntityEdit('booking', bookingId);
```

### 2. useEntityNavigation Usage

**✅ DO**: Use type-safe navigation helpers
```typescript
const { navigateToDetail, navigateToEdit } = useEntityNavigation();

// Navigate after successful creation
const handleCreateGuest = async (data: GuestFormData) => {
  const newGuest = await createGuest(data);
  navigateToDetail('guest', newGuest.guest_id);
};

// Navigate to edit page
const handleEditClick = () => {
  navigateToEdit('booking', bookingId);
};
```

**❌ DON'T**: Use manual route strings
```typescript
// ❌ Bad - not type-safe, easy to break
navigate({ to: `/bookings/${bookingId}` });

// ✅ Good - type-safe, centralized
navigateToDetail('booking', bookingId);
```

### 3. useDetailPageState for Tabs

**✅ DO**: Sync tab state with URL
```typescript
const { activeTab, setActiveTab } = useDetailPageState();

<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="details">Details</TabsTrigger>
    <TabsTrigger value="payments">Payments</TabsTrigger>
    <TabsTrigger value="audit">Audit Trail</TabsTrigger>
  </TabsList>
  <TabsContent value="details">{/* Details content */}</TabsContent>
  <TabsContent value="payments">{/* Payments content */}</TabsContent>
  <TabsContent value="audit">{/* Audit content */}</TabsContent>
</Tabs>
```

**Benefits**:
- URL becomes shareable: `/bookings/123?tab=payments`
- Browser back/forward works with tabs
- Preserves tab selection on page refresh

### 4. useEntityAudit Filtering

**✅ DO**: Use specific filters for performance
```typescript
// Basic - all logs for entity
const { data: auditLogs } = useEntityAudit({
  entity_type: 'booking',
  entity_id: bookingId,
});

// Advanced - filtered by action and date
const { data: paymentLogs } = useEntityAudit({
  entity_type: 'payment',
  entity_id: paymentId,
  action: 'payment.verified',
  date_from: startOfMonth,
  date_to: endOfMonth,
});
```

### 6. Error Handling

**✅ DO**: Provide custom error handlers when needed
```typescript
const updatePayment = useEntityEdit('payment', paymentId, {
  onSuccess: () => {
    navigate({ to: '/payments' });
  },
  onError: (error) => {
    // Custom error handling (in addition to toast)
    console.error('[Payment Update Failed]:', error);
    logErrorToService(error);
  },
});
```

**✅ DO**: Let built-in toast handle user notifications
```typescript
// Built-in toasts:
// ✅ Success: "payment updated successfully"
// ❌ Error: "Failed to update payment: [error message]"
```

### 7. Optimistic Updates

**✅ DO**: Trust the optimistic update behavior
```typescript
// When user submits form:
// 1. UI updates instantly (optimistic)
// 2. Request sent to server
// 3a. If success: UI stays updated, cache invalidated
// 3b. If error: UI reverts to previous state, error shown

const updateUnit = useEntityEdit('unit', unitId);

// No need to manually manage loading states - optimistic update handles it
<DetailField label="Unit Name" value={unit.unit_name} />
```

**Pattern**: The optimistic update makes the UI feel instant while maintaining data consistency through automatic rollback on errors.

---

## 🧪 Testing

### Test Coverage

All hooks have comprehensive test suites in `__tests__/`:

```typescript
// useEntityEdit.test.tsx
- ✅ Performs optimistic updates
- ✅ Rolls back on error
- ✅ Invalidates queries on success
- ✅ Logs audit events
- ✅ Shows toast notifications
- ✅ Calls custom callbacks

// useEntityAudit.test.tsx
- ✅ Filters by entity type and ID
- ✅ Applies optional filters (action, user, dates)
- ✅ Limits to 50 entries
- ✅ Orders by created_at desc

// useEntityNavigation.test.ts
- ✅ Navigates to correct detail routes
- ✅ Navigates to correct edit routes
- ✅ Navigates to correct list routes
- ✅ Type safety for route params

// useDetailPageState.test.ts
- ✅ Reads tab from URL search params
- ✅ Defaults to 'details' tab
- ✅ Updates URL on tab change
- ✅ Uses replace navigation
```

### Running Tests

```bash
# Run all entity hook tests
npx vitest run src/hooks/entity/__tests__/

# Run specific test file
npx vitest run src/hooks/entity/__tests__/useEntityEdit.test.tsx

# Run tests in watch mode
npx vitest run src/hooks/entity/__tests__/ --watch
```

---

## 🔗 Related Documentation

- **Entity Detail Components**: [src/components/entity-detail/README.md](../../components/entity-detail/README.md) - UI components using these hooks
- **TanStack Query**: Query key management and caching strategies
- **Database Helpers**: [src/lib/supabase.ts](../../lib/supabase.ts) - Typed database client (db.*)
- **Audit Logger**: [src/lib/audit-logger.ts](../../lib/audit-logger.ts) - Audit trail logging
- **Type Definitions**: [src/types/entity-detail.types.ts](../../types/entity-detail.types.ts) - Entity types

---

## 📈 Impact Metrics

### Code Reduction
- **Before hooks**: ~200 lines per entity for CRUD operations
- **After hooks**: ~20 lines per entity (90% reduction)
- **Total reduction**: ~900 lines eliminated across 5 entities

### Entities Using Hooks
1. Bookings (`src/components/bookings/BookingEdit/`)
2. Guests (`src/components/guests/GuestEdit/`)
3. Units (`src/components/units/UnitEdit/`)
4. Payments (`src/components/payments/PaymentEdit/`)
5. Expenses (`src/components/expenses/ExpenseEdit.tsx`)

### Benefits Delivered
- ✅ Type-safe operations across all entities
- ✅ Consistent optimistic UI updates
- ✅ Automatic error handling and rollback
- ✅ Built-in audit trail logging
- ✅ Centralized route management
- ✅ URL-synced UI state

---

## 🎓 How to Add a New Entity

To add support for a new entity type:

1. **Add entity type to type definitions**:
```typescript
// src/types/entity-detail.types.ts
export type EntityType =
  | 'booking'
  | 'unit'
  | 'guest'
  | 'payment'
  | 'expense'
  | 'property'; // New entity
```

2. **Add database helper**:
```typescript
// src/lib/supabase.ts
export const db = {
  // ... existing
  properties: {
    byId: (id: string) => supabase.from('properties').select('*').eq('property_id', id).single(),
    update: (id: string, data: Partial<Property>) =>
      supabase.from('properties').update(data).eq('property_id', id).select().single(),
  },
};
```

3. **Add a key factory**: `propertyKeys` in `src/lib/query-keys.ts`, registered in `entityKeyFactories`, and a `propertyDetailQuery` (`queryOptions`) next to the entity's hooks

4. **Update useEntityEdit**:
```typescript
// src/hooks/entity/useEntityEdit.ts
case 'property':
  return db.properties.update(entityId, updateData as Partial<Property>);
```

5. **Update useEntityNavigation**:
```typescript
// src/hooks/entity/useEntityNavigation.ts
property: { to: '/properties/$propertyId', params: { propertyId: entityId } }
```

6. **Use in edit page** ✅

---

## 💻 Development Notes

### Hook Design Philosophy
- **Generic by default**: One hook works for all entities
- **Type-safe**: TypeScript ensures correct usage
- **Composable**: Hooks work together seamlessly
- **Optimistic first**: Instant UI feedback is the default

### TanStack Query Integration
- All hooks use standard TanStack Query patterns
- Query keys are centralized in `lib/query-keys.ts`
- Cache invalidation happens automatically on mutations
- Stale times are configured per hook based on data characteristics

### Performance Considerations
- Optimistic updates prevent loading states for mutations
- Query deduplication via TanStack Query
- Automatic garbage collection of unused queries
- Background refetching keeps data fresh

### Future Enhancements
- [ ] Add bulk operations (update multiple entities)
- [ ] Add soft delete support
- [ ] Add undo/redo for mutations
- [ ] Add conflict resolution for concurrent edits
- [ ] Add optimistic delete with rollback

---

**Last Updated**: January 2025
**Maintained by**: Okaeri Development Team
**Questions?**: See [CLAUDE.md](../../../CLAUDE.md) for development guidelines
