# 🏗️ Entity Detail Components - Architectural Pattern

## Overview

The Entity Detail component library provides a **standardized, reusable pattern** for building detail/view pages across all entity types in the Okaeri Resort System. This architectural pattern eliminates code duplication and ensures consistent UX across bookings, guests, units, payments, and expenses.

**Impact**: Used by **15+ components** across 5 entity types, reducing per-entity implementation from ~500 lines to ~100 lines.

## 📁 Directory Structure

```
entity-detail/
├── DetailAuditSection.tsx       # Audit trail integration for detail pages
├── RelatedEntityLink.tsx        # Type-safe links to related entities
├── DetailPageSkeleton.tsx       # Loading skeleton preserving layout
├── utils/
│   └── formatters.ts            # Data formatting utilities
├── __tests__/                   # Comprehensive component tests
└── index.ts                     # Barrel export for all components
```

`DetailPageLayout`, `DetailSection` and `DetailField` moved to the kit: they live in `src/components/patterns/` and are imported from `@/components/patterns`. This folder keeps the product pieces (`DetailAuditSection`, `RelatedEntityLink`, `DetailPageSkeleton`) and the formatter re-exports.

## 📦 Core Components

### 1. DetailPageLayout

**Purpose**: Base layout wrapper providing consistent structure for all entity detail pages.

**Features**:
- Breadcrumb navigation with TanStack Router integration
- Page title with optional status badge
- Subtitle for metadata (created date, updated date, etc.)
- Optional edit button with automatic routing
- Custom action buttons (delete, download, etc.)
- Responsive layout (mobile-first)
- Accessibility-compliant breadcrumb navigation

**Props Interface**:
```typescript
interface DetailPageLayoutProps {
  children: React.ReactNode;       // DetailSection components
  title: string;                   // Page title (e.g., "Booking #BR-001")
  subtitle?: string;               // Metadata (e.g., "Created Jan 15, 2025")
  breadcrumbs: Breadcrumb[];       // Navigation path
  status?: React.ReactNode;        // Status badge component
  actions?: React.ReactNode;       // Custom action buttons
  editRoute?: {                    // Automatic edit button
    to: string;
    params: Record<string, string>;
  };
  className?: string;              // Optional styling
}

type Breadcrumb = {
  label: string;
  to?: string;  // If provided, renders as Link
};
```

**Real-World Usage**: `src/components/bookings/BookingEdit/index.tsx:85-96`

---

### 2. DetailSection

**Purpose**: Card-based section container for grouping related information within a detail page.

**Features**:
- Card-based styling with shadcn/ui
- Optional icon in title
- Optional action button in header
- Collapsible functionality with accessible controls
- Consistent padding and spacing
- ARIA labels for screen readers

**Props Interface**:
```typescript
interface DetailSectionProps {
  title: string;                   // Section title
  icon?: React.ReactNode;          // Optional icon (Lucide icon)
  action?: React.ReactNode;        // Optional action button
  children: React.ReactNode;       // Section content
  collapsible?: boolean;           // Enable collapse/expand
  defaultCollapsed?: boolean;      // Initial collapsed state
  className?: string;              // Optional styling
}
```

**Real-World Usage**: `src/components/guests/GuestEdit/index.tsx:76-125`

---

### 3. DetailField

**Purpose**: Standardized label-value pair component with professional formatting.

**Features**:
- Two layout modes: vertical (default) and horizontal
- Optional icon support
- Custom styling for values (monospace fonts for financial data, etc.)
- Responsive design
- Semantic HTML with proper label associations

**Props Interface**:
```typescript
interface DetailFieldProps {
  label: string;                   // Field label
  value: React.ReactNode;          // Field value (string, number, component)
  icon?: React.ReactNode;          // Optional icon
  valueClassName?: string;         // Custom value styling
  labelClassName?: string;         // Custom label styling
  direction?: "horizontal" | "vertical"; // Layout direction
}
```

**Design Guidelines**:
- Use **monospace fonts** (`font-mono`) for financial amounts, IDs, and references
- Use **bold** (`font-semibold` or `font-bold`) for critical financial data
- Use **larger text** (`text-lg`) for primary amounts
- Use **color coding** (green for money, blue for links, red for warnings)
- Use **icons** sparingly for visual hierarchy

---

### 4. RelatedEntityLink

**Purpose**: Type-safe, clickable links to related entities with consistent styling.

**Features**:
- Automatic route mapping based on entity type
- Icon mapping for visual consistency
- Optional badge for secondary info (e.g., unit code)
- Hover states and accessibility
- TypeScript type safety

**Props Interface**:
```typescript
interface RelatedEntityLinkProps {
  type: EntityType;              // "booking" | "unit" | "guest" | "payment" | "expense"
  id: string;                    // Entity ID
  label: string;                 // Display text
  badge?: string;                // Optional secondary info
  className?: string;            // Optional styling
}
```

**Entity Type Mappings**:
```typescript
// Automatic icon mapping
const entityIcons = {
  booking: FileText,
  unit: Home,
  guest: User,
  payment: CreditCard,
  expense: Receipt,
};

// Automatic route mapping
const entityRoutes = {
  booking: "/bookings/$bookingId",
  unit: "/units/$unitId",
  guest: "/guests/$guestId",
  payment: "/payments/$paymentId",
  expense: "/expenses/$expenseId",
};
```

**Real-World Usage**: `src/components/entity-detail/RelatedEntityLink.tsx:75-98`

---

### 5. DetailAuditSection

**Purpose**: The record's own audit history on its detail page, newest first.

**Features**:
- Reads `recentRecordAuditLogsQuery(\`${entityType}s\`, entityId)`, the query the detail loaders prefetch
- What a user sees is limited by the `audit_logs` RLS policy (admin/owner: all; manager: bookings, payments, guests, expenses; everyone: rows they wrote)
- App rows are labelled by `metadata.action` (see `ActionBadge`)
- Collapsible by default on mobile
- Configurable entry limit

**Props Interface**:
```typescript
interface DetailAuditSectionProps {
  entityType: EntityType;        // Entity type for filtering
  entityId: string;              // Entity ID for filtering
  title?: string;                // Section title (default: "Audit Trail")
  defaultCollapsed?: boolean;    // Start collapsed (default: expanded)
  limit?: number;                // Number of entries (default: 10)
  className?: string;            // Optional styling
}
```

**Mobile Behavior**: Automatically collapses on mobile devices (`max-width: 768px`) to reduce initial page height.

**Real-World Usage**: `src/components/entity-detail/DetailAuditSection.tsx`

---

### 6. DetailPageSkeleton

**Purpose**: Consistent loading skeleton that preserves layout structure during data fetching.

**Features**:
- Matches DetailPageLayout structure
- Breadcrumb skeleton
- Header with title and actions
- Three section skeletons with fields
- No props required - completely static
- Shimmer animation via shadcn/ui Skeleton

**Real-World Usage**: `src/routes/_authenticated/bookings/$bookingId/index.tsx:141`

---

## 🛠️ Utility Functions

### Formatters

Located in `utils/formatters.ts`, re-exported from `@/lib/formatters`:

```typescript
// Currency formatting (Philippine Peso)
formatCurrency(1500.50) // "₱1,500.50"

// Date formatting
formatTableDate(new Date("2025-01-15"))    // "Jan 15"
formatFullDate(new Date("2025-01-15"))     // "January 15, 2025"
formatDateTime(new Date("2025-01-15T14:30")) // "Jan 15, 2025 2:30 PM"

// Phone number formatting (Philippine mobile)
formatPhoneNumber("09171234567")  // "+63 917 123 4567"

// Percentage formatting
formatPercentage(0.15, 2)  // "15.00%"

// Text truncation
truncate("This is a very long description text", 20)  // "This is a very long..."
```

---

## 🎯 Architectural Pattern

### The Entity Detail Pattern

The entity-detail pattern standardizes how detail/view pages are structured across all entities:

```
┌─────────────────────────────────────────────────────────┐
│ DetailPageLayout                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Breadcrumbs:  Home > Bookings > BR-001              │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Header:  [Title] [Status Badge] [Edit Button]       │ │
│ │         Subtitle: Created Jan 15, 2025              │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ DetailSection: Booking Information                  │ │
│ │ ┌─────────────────┬─────────────────────────────┐   │ │
│ │ │ DetailField     │ DetailField                 │   │ │
│ │ │ Reference: BR-001│ Status: Confirmed          │   │ │
│ │ ├─────────────────┼─────────────────────────────┤   │ │
│ │ │ DetailField     │ DetailField                 │   │ │
│ │ │ Check-in: Jan 20│ Check-out: Jan 22          │   │ │
│ │ └─────────────────┴─────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ DetailSection: Guest Information                    │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ DetailField: Guest Name                         │ │ │
│ │ │ Value: RelatedEntityLink → /guests/123          │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ DetailAuditSection: Audit Trail (Collapsible)      │ │
│ │ [Collapsed on mobile, expanded on desktop]          │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Pattern Benefits

1. **Code Reduction**: ~80% less code per entity (from ~500 lines to ~100 lines)
2. **Consistency**: Identical UX across all entity types
3. **Maintainability**: Fix once, deploy everywhere
4. **Accessibility**: Centralized ARIA labels and keyboard navigation
5. **Responsive**: Mobile-first design baked into components
6. **Type Safety**: TypeScript ensures correct entity type usage

---

## 🚀 Best Practices

### 1. Component Composition

**✅ DO**: Compose components hierarchically
```typescript
<DetailPageLayout>
  <DetailSection>
    <div className="grid grid-cols-2 gap-4">
      <DetailField />
      <DetailField />
    </div>
  </DetailSection>
</DetailPageLayout>
```

**❌ DON'T**: Mix abstraction levels
```typescript
<DetailPageLayout>
  <Card>  {/* Don't use raw Card inside DetailPageLayout */}
    <DetailField />
  </Card>
</DetailPageLayout>
```

### 2. Grid Layouts for Fields

**✅ DO**: Use responsive grids for multiple fields
```typescript
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
  <DetailField label="Field 1" value="Value 1" />
  <DetailField label="Field 2" value="Value 2" />
  <DetailField label="Field 3" value="Value 3" />
</div>
```

**✅ DO**: Use space-y for vertical stacking
```typescript
<div className="space-y-4">
  <DetailField label="Description" value="Long text..." />
  <DetailField label="Notes" value="More text..." />
</div>
```

### 3. Financial Data Formatting

**✅ DO**: Use monospace fonts and semantic colors
```typescript
<DetailField
  label="Total Amount"
  value={formatCurrency(amount)}
  valueClassName="font-mono font-semibold text-lg text-green-600"
  icon={<DollarSign className="h-4 w-4 text-green-600" />}
/>
```

**✅ DO**: Highlight important financial data
```typescript
<DetailField
  label="Balance Due"
  value={formatCurrency(balance)}
  valueClassName="font-mono font-bold text-2xl text-red-600"
/>
```

### 4. Related Entity Links

**✅ DO**: Use RelatedEntityLink for all entity references
```typescript
<DetailField
  label="Guest"
  value={
    <RelatedEntityLink
      type="guest"
      id={booking.guest_id}
      label={booking.guest_name}
    />
  }
/>
```

**❌ DON'T**: Use manual Link components
```typescript
<DetailField
  label="Guest"
  value={
    <Link to={`/guests/${booking.guest_id}`}>  {/* Manual routing */}
      {booking.guest_name}
    </Link>
  }
/>
```

### 5. Section Organization

**✅ DO**: Group related fields in sections with semantic icons
```typescript
<DetailSection title="Guest Information" icon={<User className="h-5 w-5" />}>
  {/* Guest fields */}
</DetailSection>

<DetailSection title="Payment Information" icon={<CreditCard className="h-5 w-5" />}>
  {/* Payment fields */}
</DetailSection>
```

**✅ DO**: Make optional/advanced sections collapsible
```typescript
<DetailSection title="Advanced Settings" collapsible defaultCollapsed>
  {/* Advanced fields */}
</DetailSection>
```

### 6. Loading and Error States

**✅ DO**: Use DetailPageSkeleton for route pending states
```typescript
export const Route = createFileRoute("/admin/entities/$entityId/")({
  pendingComponent: DetailPageSkeleton,
});
```

### 7. Mobile Responsiveness

**✅ DO**: Use responsive grid columns
```typescript
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
  {/* Auto-stacks on mobile, 2 cols on tablet, 3 cols on desktop */}
</div>
```

**✅ DO**: Keep the audit trail last, so on a phone it sits below the record
```typescript
<DetailAuditSection entityType="booking" entityId={bookingId} />
```

### 8. Accessibility

**✅ DO**: Use semantic HTML and ARIA labels
- Breadcrumbs have `aria-label="Breadcrumb"`
- Collapsible sections have proper `aria-label` on toggle buttons
- Related links use semantic icons for context

**✅ DO**: Ensure keyboard navigation works
- All interactive elements are keyboard accessible
- Focus states are clearly visible
- Tab order is logical

---

## 🧪 Testing

### Test Coverage

All components have comprehensive test suites in `__tests__/`:

```typescript
// DetailPageLayout.test.tsx
- ✅ Renders title and subtitle
- ✅ Renders breadcrumbs with links
- ✅ Renders status badge
- ✅ Renders edit button with correct route
- ✅ Renders custom actions

// DetailSection.test.tsx
- ✅ Renders title and icon
- ✅ Collapses and expands
- ✅ Renders action button
- ✅ Accessible collapse controls

// DetailField.test.tsx
- ✅ Renders vertical layout
- ✅ Renders horizontal layout
- ✅ Renders with icon
- ✅ Applies custom value className
- ✅ Renders React node values

// RelatedEntityLink.test.tsx
- ✅ Renders correct icon for entity type
- ✅ Links to correct route
- ✅ Displays badge
- ✅ Accessible hover states

// DetailAuditSection.test.tsx
- ✅ Filters by entity type and ID
- ✅ Collapses on mobile
- ✅ Renders custom title

// DetailPageSkeleton.test.tsx
- ✅ Renders loading skeleton
- ✅ Matches layout structure
```

### Running Tests

```bash
# Run all entity-detail tests
npx vitest run src/components/entity-detail/__tests__/

# Run specific test file
npx vitest run src/components/entity-detail/__tests__/DetailPageLayout.test.tsx

# Run tests in watch mode
npx vitest run src/components/entity-detail/__tests__/ --watch
```

---

## 🔗 Related Documentation

- **TanStack Router**: [src/routes/README.md](../../routes/README.md) - Route definitions and loading data
- **Entity Hooks**: [src/hooks/entity/README.md](../../hooks/entity/README.md) - Hooks for entity management
- **Patterns kit**: [src/components/patterns/CLAUDE.md](../patterns/CLAUDE.md) - Detail and table patterns (`@/components/patterns`); formatters in `src/lib/formatters.ts`
- **Audit System**: [src/components/audit/README.md](../audit/README.md) - Audit log viewer
- **Type Definitions**: [src/types/entity-detail.types.ts](../../types/entity-detail.types.ts) - Entity type definitions

---

## 📈 Impact Metrics

### Code Reduction
- **Before pattern**: ~500 lines per entity detail page
- **After pattern**: ~100 lines per entity detail page
- **Reduction**: 80% less code

### Entities Using Pattern
1. Bookings (`src/components/bookings/BookingEdit/`)
2. Guests (`src/components/guests/GuestEdit/`)
3. Units (`src/components/units/UnitEdit/`)
4. Payments (`src/components/payments/PaymentEdit/`)
5. Expenses (`src/components/expenses/ExpenseEdit.tsx`)

### Benefits Delivered
- ✅ Consistent UX across all entities
- ✅ Centralized accessibility improvements
- ✅ Mobile responsiveness by default
- ✅ Reduced maintenance burden
- ✅ Faster development for new entities
- ✅ Type-safe entity linking

---

## 🎓 How to Add a New Entity

To add a new entity type using this pattern:

1. **Add entity type to types**:
```typescript
// src/types/entity-detail.types.ts
export type EntityType = 'booking' | 'unit' | 'guest' | 'payment' | 'expense' | 'property';
```

2. **Update RelatedEntityLink mappings**:
```typescript
// src/components/entity-detail/RelatedEntityLink.tsx
const entityIcons = {
  // ... existing
  property: Building,
};

const entityRoutes = {
  // ... existing
  property: "/properties/$propertyId",
};
```

3. **Create detail page component** using the pattern
4. **Add route with DetailPageSkeleton and an errorComponent**
5. **Test and deploy** ✅

---

## 💻 Development Notes

### Component Philosophy
- **Composition over configuration**: Components are simple and composable
- **Sensible defaults**: Works out of the box with minimal props
- **Escape hatches**: className props allow customization when needed
- **Type safety**: Full TypeScript support with prop validation

### Performance Considerations
- DetailPageSkeleton is static (no re-renders during loading)
- Components use React.memo where appropriate
- Grid layouts use CSS Grid for optimal performance
- Icons are tree-shakeable from lucide-react

### Future Enhancements
- [ ] Add print stylesheet for detail pages
- [ ] Add export to PDF functionality
- [ ] Add share/copy link functionality
- [ ] Add keyboard shortcuts (e.g., 'e' to edit)
- [ ] Add breadcrumb schema.org markup for SEO

---

**Last Updated**: January 2025
**Maintained by**: Okaeri Development Team
**Questions?**: See [CLAUDE.md](../../../CLAUDE.md) for development guidelines
