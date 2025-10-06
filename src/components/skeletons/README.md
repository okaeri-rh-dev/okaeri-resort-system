# ⏳ Loading Skeletons Documentation

## Overview

The Loading Skeletons module provides **professional loading states** for all major components in the Okaeri Resort System. These skeleton screens maintain layout stability, reduce perceived load time, and provide visual feedback during data fetching, creating a polished user experience aligned with the **Professional Enterprise Design System**.

## 🏗️ Module Architecture

```
skeletons/
└── index.tsx                     # All skeleton components (666 lines)
```

## 📋 Skeleton Components

### 1. Bookings Table Skeleton

**Purpose**: Loading state for the bookings table with desktop and mobile views.

#### Usage

```tsx
import { BookingsTableSkeleton } from '@/components/skeletons'

function BookingsPage() {
  const { data: bookings, isLoading } = useQuery(['bookings'], fetchBookings)

  if (isLoading) {
    return <BookingsTableSkeleton isMobile={isMobile} rows={8} />
  }

  return <BookingsTable data={bookings} />
}
```

#### Props

```typescript
interface BookingsTableSkeletonProps {
  isMobile?: boolean;       // Show mobile card layout
  rows?: number;            // Number of skeleton rows (default: 8)
  className?: string;       // Additional CSS classes
}
```

#### Features

- **Desktop**: Full table skeleton with 9 columns
- **Mobile**: Card-based skeleton layout
- **Filters**: Search, date filters, action buttons
- **Pagination**: Complete pagination skeleton

### 2. Units Table Skeleton

**Purpose**: Loading state for the units table with list and grid views.

#### Usage

```tsx
import { UnitsTableSkeleton } from '@/components/skeletons'

function UnitsPage() {
  const { data: units, isLoading } = useQuery(['units'], fetchUnits)

  if (isLoading) {
    return <UnitsTableSkeleton isMobile={isMobile} viewMode="list" rows={6} />
  }

  return <UnitsTable data={units} />
}
```

#### Props

```typescript
interface UnitsTableSkeletonProps {
  isMobile?: boolean;       // Show mobile layout
  viewMode?: 'list' | 'grid'; // Display mode (default: 'list')
  rows?: number;            // Number of skeleton rows (default: 6)
  className?: string;       // Additional CSS classes
}
```

#### Features

- **List View**: Table with checkbox column
- **Grid View**: Card-based grid layout
- **Inline Edit Mode**: Edit mode toggle skeleton
- **Selection**: Checkbox skeletons for batch operations

### 3. Guests Table Skeleton

**Purpose**: Loading state for the guests table with avatar support.

#### Usage

```tsx
import { GuestsTableSkeleton } from '@/components/skeletons'

function GuestsPage() {
  const { data: guests, isLoading } = useQuery(['guests'], fetchGuests)

  if (isLoading) {
    return <GuestsTableSkeleton isMobile={isMobile} rows={6} />
  }

  return <GuestsTable data={guests} />
}
```

#### Features

- **Avatar Skeletons**: Circular avatar placeholders
- **Contact Info**: Email and phone number placeholders
- **Booking History**: Expandable section skeleton
- **Action Buttons**: View and Edit button skeletons

### 4. Expenses Table Skeleton

**Purpose**: Loading state for the expenses table with nested filter card.

#### Usage

```tsx
import { ExpensesTableSkeleton } from '@/components/skeletons'

function ExpensesPage() {
  const { data: expenses, isLoading } = useQuery(['expenses'], fetchExpenses)

  if (isLoading) {
    return <ExpensesTableSkeleton isMobile={isMobile} rows={8} />
  }

  return <ExpensesTable data={expenses} />
}
```

#### Features

- **Nested Cards**: Filters card + table card structure
- **Desktop**: 6-column table skeleton
- **Mobile**: Compact expense cards
- **Professional Styling**: Matches enterprise design system

### 5. Dashboard Stats Skeleton

**Purpose**: Loading state for KPI dashboard cards.

#### Usage

```tsx
import { DashboardStatsSkeleton } from '@/components/skeletons'

function Dashboard() {
  const { data: stats, isLoading } = useQuery(['stats'], fetchStats)

  if (isLoading) {
    return <DashboardStatsSkeleton cardCount={4} />
  }

  return <DashboardStats data={stats} />
}
```

#### Props

```typescript
interface DashboardStatsSkeletonProps {
  cardCount?: number;       // Number of KPI cards (default: 4)
  className?: string;       // Additional CSS classes
}
```

#### Features

- **Responsive Grid**: 1/2/4 column responsive layout
- **Icon Placeholders**: Circular icon skeletons
- **Value Skeletons**: Large number placeholders
- **Label Skeletons**: Descriptive text placeholders

### 6. Booking Form Skeleton

**Purpose**: Loading state for multi-step booking form.

#### Usage

```tsx
import { BookingFormSkeleton } from '@/components/skeletons'

function BookingFormPage() {
  const { data: formConfig, isLoading } = useQuery(['form-config'], fetchConfig)

  if (isLoading) {
    return <BookingFormSkeleton currentStep={1} />
  }

  return <BookingForm config={formConfig} />
}
```

#### Props

```typescript
interface BookingFormSkeletonProps {
  currentStep?: number;     // Current form step (1-4, default: 1)
  className?: string;       // Additional CSS classes
}
```

#### Features

- **Step Progress**: 4-step progress indicator
- **Dynamic Fields**: Different field layouts per step
- **Form Actions**: Previous/Next button skeletons
- **Step-Specific**: Unique skeleton for each step

### 7. Main Layout Skeleton

**Purpose**: Loading state for entire application layout.

#### Usage

```tsx
import { MainLayoutSkeleton } from '@/components/skeletons'

function App() {
  const { data: session, isLoading } = useQuery(['session'], fetchSession)

  if (isLoading) {
    return <MainLayoutSkeleton showSidebar={true} />
  }

  return <MainLayout session={session} />
}
```

#### Features

- **Navigation Bar**: Top nav with logo and user area
- **Sidebar**: Left sidebar with navigation items
- **Content Area**: Main content placeholders
- **Responsive**: Mobile-friendly layout

### 8. Page Transition Skeleton

**Purpose**: Loading state for route transitions.

#### Usage

```tsx
import { PageTransitionSkeleton } from '@/components/skeletons'

// TanStack Router integration
<Router
  defaultPendingComponent={PageTransitionSkeleton}
>
  <Routes />
</Router>
```

#### Features

- **Full-Screen Overlay**: White background covering viewport
- **Centered Spinner**: Animated loading spinner
- **Loading Text**: Optional loading message
- **Z-Index**: Covers all content during transition

## 🎨 Base Skeleton Components

### Skeleton (Base Component)

```tsx
import { Skeleton } from '@/components/ui/skeleton'

// Default rectangular skeleton
<Skeleton className="h-4 w-32" />

// Circular skeleton
<Skeleton variant="circle" className="h-8 w-8" />

// Sharp corners
<Skeleton variant="sharp" className="h-10 w-full" />

// Rounded skeleton
<Skeleton variant="rounded" className="h-20 w-full" />
```

### TextSkeleton

```tsx
<TextSkeleton lines={3} className="max-w-md" />

// Renders 3 lines of text skeleton with varying widths
```

### AvatarSkeleton

```tsx
<AvatarSkeleton size="sm" />  // 32px
<AvatarSkeleton size="md" />  // 40px (default)
<AvatarSkeleton size="lg" />  // 48px
<AvatarSkeleton size="xl" />  // 64px
```

### ButtonSkeleton

```tsx
<ButtonSkeleton size="sm" className="w-20" />
<ButtonSkeleton size="md" variant="outline" className="w-32" />
<ButtonSkeleton size="lg" className="w-full" />
```

### KPICardSkeleton

```tsx
<KPICardSkeleton
  hasIcon={true}
  className="border border-neutral-200 shadow-sm"
/>
```

### TableSkeleton

```tsx
<TableSkeleton
  rows={10}
  columns={[120, 200, 150, 100, 80]}  // Column widths
  hasHeader={true}
  showCheckbox={true}
  showActions={true}
/>
```

### MobileCardSkeleton

```tsx
<MobileCardSkeleton
  hasActions={true}
  rowCount={4}
  className="border border-neutral-200"
/>
```

### FormSkeleton

```tsx
<FormSkeleton
  fields={6}
  hasActions={true}
  className="max-w-2xl"
/>
```

### StepFormSkeleton

```tsx
<StepFormSkeleton
  steps={4}
  currentStep={2}
  hasActions={true}
/>
```

### NavigationSkeleton

```tsx
<NavigationSkeleton
  items={5}
  showLogo={true}
  showUser={true}
  className="sticky top-0 z-50"
/>
```

## 🎯 Design Patterns

### Skeleton Animation

```css
/* CSS animation for shimmer effect */
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.skeleton {
  background: linear-gradient(
    90deg,
    hsl(0 0% 90%) 0%,
    hsl(0 0% 95%) 50%,
    hsl(0 0% 90%) 100%
  );
  background-size: 1000px 100%;
  animation: shimmer 2s infinite linear;
}
```

### Layout Preservation

```tsx
// Skeleton matches actual component dimensions
<div className="h-14">  {/* Actual table row is 56px */}
  <Skeleton className="h-14 w-full" />
</div>
```

### Conditional Rendering

```tsx
function DataTable() {
  const { data, isLoading, error } = useQuery(...)

  if (isLoading) return <TableSkeleton rows={10} />
  if (error) return <ErrorState error={error} />
  if (!data?.length) return <EmptyState />

  return <Table data={data} />
}
```

## 🧪 Testing

### Skeleton Tests

```typescript
describe('BookingsTableSkeleton', () => {
  it('renders desktop skeleton', () => {
    render(<BookingsTableSkeleton isMobile={false} rows={5} />)

    // Verify table structure
    expect(screen.getByRole('table')).toBeInTheDocument()

    // Verify row count (5 data rows + 1 header)
    expect(screen.getAllByRole('row')).toHaveLength(6)
  })

  it('renders mobile skeleton', () => {
    render(<BookingsTableSkeleton isMobile={true} rows={3} />)

    // Verify card structure
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    // Verify card count
    const cards = screen.getAllByTestId('mobile-card-skeleton')
    expect(cards).toHaveLength(3)
  })

  it('shows pagination skeleton', () => {
    render(<BookingsTableSkeleton rows={5} />)

    expect(screen.getByTestId('pagination-skeleton')).toBeInTheDocument()
  })
})
```

## 🎨 Customization

### Custom Skeleton Colors

```tsx
// Adjust skeleton base color
<Skeleton
  className="h-4 w-32"
  style={{
    background: 'linear-gradient(90deg, #e0e0e0 0%, #f0f0f0 50%, #e0e0e0 100%)'
  }}
/>
```

### Custom Animation Speed

```tsx
<Skeleton
  className="h-4 w-32 animate-pulse"  // Use Tailwind's pulse
  style={{ animationDuration: '1s' }}  // Faster animation
/>
```

### Disable Animation

```tsx
<Skeleton className="h-4 w-32 animate-none" />
```

## 🎯 Best Practices

1. ✅ **Match actual dimensions** to prevent layout shift
2. ✅ **Use appropriate row counts** based on viewport height
3. ✅ **Include all major UI elements** (filters, buttons, pagination)
4. ✅ **Respect responsive breakpoints** (desktop/mobile variants)
5. ✅ **Maintain semantic structure** (tables, lists, forms)
6. ✅ **Show skeleton immediately** on component mount
7. ✅ **Transition smoothly** from skeleton to content
8. ✅ **Use consistent animation** across all skeletons
9. ✅ **Avoid over-skeletonizing** - keep it simple
10. ✅ **Test loading states** in all viewports

## 📚 Related Documentation

- [UI Components](/src/components/ui/README.md) - Base skeleton component
- [Table Utilities](/src/components/tables/README.md) - Table skeleton patterns
- [Bookings Table](/src/components/bookings/BookingsTable/README.md) - Usage example
- [Dashboard](/src/components/dashboard/README.md) - KPI skeleton usage

## 🔧 Configuration

### Default Skeleton Counts

```typescript
const SKELETON_DEFAULTS = {
  tableRows: 8,
  gridCards: 6,
  kpiCards: 4,
  formFields: 6,
  navItems: 5,
  paginationButtons: 5,
}
```

### Skeleton Sizes

```typescript
const SKELETON_SIZES = {
  avatar: {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
  },
  button: {
    sm: { height: 32, padding: '0 12px' },
    md: { height: 40, padding: '0 16px' },
    lg: { height: 48, padding: '0 24px' },
  },
  table: {
    rowHeight: 56,  // 14 spacing units
    headerHeight: 48,
  },
}
```

## 📈 Performance

- **Component Size**: ~15KB total (all skeletons)
- **Render Time**: < 10ms for most skeletons
- **Animation Impact**: Minimal (CSS-only)
- **Bundle Impact**: Shared with base Skeleton component
- **Lazy Loadable**: Yes (split by route)

## 🎨 Accessibility

### ARIA Attributes

```tsx
<div role="status" aria-live="polite" aria-label="Loading...">
  <TableSkeleton rows={5} />
  <span className="sr-only">Loading table data...</span>
</div>
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
  }
}
```

## 🚨 Common Issues

### Issue: Layout shift when content loads

**Cause**: Skeleton dimensions don't match actual content

**Solution**:
```tsx
// Match exact dimensions
<Skeleton className="h-14 w-full" />  // If row is h-14
<Skeleton className="h-[56px] w-full" />  // Explicit height
```

### Issue: Skeleton flashes briefly before content

**Cause**: Immediate transition from skeleton to content

**Solution**:
```tsx
const [showSkeleton, setShowSkeleton] = useState(true)

useEffect(() => {
  if (data && showSkeleton) {
    // Delay hiding skeleton for smooth transition
    setTimeout(() => setShowSkeleton(false), 150)
  }
}, [data, showSkeleton])
```

### Issue: Skeleton shows on every refetch

**Cause**: Using `isLoading` instead of `isInitialLoading`

**Solution**:
```tsx
const { data, isLoading, isRefetching } = useQuery(...)

// Only show skeleton on initial load
if (isLoading && !isRefetching) {
  return <TableSkeleton />
}

// Show actual content during refetch
return <Table data={data} isRefreshing={isRefetching} />
```

## 🔄 Future Enhancements

- [ ] Skeleton variants (light, dark, gradient)
- [ ] Custom animation patterns
- [ ] Skeleton builder utility
- [ ] Auto-detection of component dimensions
- [ ] Skeleton recording/replay for design
- [ ] Progressive skeleton reveal
- [ ] Skeleton with error states
- [ ] Skeleton theming system
