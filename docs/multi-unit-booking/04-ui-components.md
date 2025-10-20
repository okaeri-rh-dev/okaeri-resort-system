# Phase 4: UI Components

**Phase Duration:** October 28 - November 8, 2025 (Weeks 4-5 - 10 days)
**Lead Agent:** `resort-ui-designer`
**Status:** Not Started
**Dependencies:** Phase 3 (State Management) must be complete

---

## Phase Overview

### Objectives

Design and implement user interface components for multi-unit booking with professional enterprise design, mobile responsiveness, and WCAG 2.1 AA accessibility compliance.

### Success Criteria

- [ ] All components implemented and styled with shadcn/ui + Tailwind CSS v4
- [ ] Mobile responsive (320px - 1920px viewports)
- [ ] WCAG 2.1 Level AA compliance verified
- [ ] Touch-friendly interface (≥44px touch targets)
- [ ] Loading states and comprehensive error handling
- [ ] Visual regression tests passing
- [ ] User testing feedback ≥4.5/5
- [ ] Component Storybook stories complete
- [ ] Performance: <1.5s FCP, <2.5s LCP

### Key Deliverables

1. Multi-unit selector component
2. Unit card list component
3. Guest assignment interface
4. Multi-unit pricing summary
5. Updated booking form with multi-step flow
6. Mobile optimizations
7. Accessibility implementation
8. Component documentation and Storybook stories

---

## Agent Assignments

### Lead: `resort-ui-designer`

**Primary Responsibilities:**

- Design multi-unit selection interface with enterprise patterns
- Create component specifications and wireframes
- Implement all UI components with shadcn/ui
- Ensure WCAG 2.1 AA accessibility compliance
- Design mobile-responsive layouts
- Create user flows for multi-unit operations
- Implement loading states and error handling

**Deliverables:**

- `src/components/bookings/MultiUnitSelector.tsx`
- `src/components/bookings/UnitCardList.tsx`
- `src/components/bookings/GuestAssignment.tsx`
- `src/components/bookings/MultiUnitPricingSummary.tsx`
- Updated `src/components/bookings/BookingForm/`
- Component Storybook stories
- Accessibility audit report

### Supporting: `tailwind-v4-design-expert`

**Responsibilities:**

- Design system updates for multi-unit components
- Tailwind CSS v4 styling implementation
- Responsive design patterns
- Design token management

**Deliverables:**

- Design token updates
- Responsive utility classes
- CSS performance optimization

### Supporting: `modern-form-validation-expert`

**Responsibilities:**

- React Hook Form integration
- Zod validation schemas
- Form state management
- Error handling patterns

**Deliverables:**

- Form validation schemas
- Custom form hooks
- Validation error components

### Supporting: `tanstack-router-expert`

**Responsibilities:**

- Route integration for multi-unit booking
- Navigation patterns
- Route guards and validation

**Deliverables:**

- Route configurations
- Navigation hooks

### Supporting: `typescript-react-quality-expert`

**Responsibilities:**

- Component type safety
- Props interface design
- Code quality review

**Deliverables:**

- Component type definitions
- Quality review sign-off

---

## Component Specifications

### 1. MultiUnitSelector Component

**File:** `src/components/bookings/MultiUnitSelector.tsx`

**Purpose:** Allow users to browse and select multiple units for a booking

#### Visual Design

```
┌─────────────────────────────────────────────────────────┐
│  Available Units (3 units selected)        [Grid/List]  │
├─────────────────────────────────────────────────────────┤
│  Filters: [Unit Type ▼] [Occupancy ▼] [Price Range ▼]  │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ [Image]      │  │ [Image]      │  │ [Image]      │  │
│  │              │  │              │  │              │  │
│  │ Deluxe Cabin │  │ Family Unit  │  │ Beach House  │  │
│  │ Max: 4 pax   │  │ Max: 6 pax   │  │ Max: 8 pax   │  │
│  │ ₱2,500/night │  │ ₱3,500/night │  │ ₱5,000/night │  │
│  │              │  │              │  │              │  │
│  │ ✓ Available  │  │ ✓ Available  │  │ ✗ Unavailable│  │
│  │ [Remove]     │  │ [Add to Bkng]│  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  Showing 12 of 24 units            [Load More Units]    │
└─────────────────────────────────────────────────────────┘
```

#### Component API

```typescript
interface MultiUnitSelectorProps {
  // Available units from API
  units: Unit[];

  // Currently selected units
  selectedUnits: BookingUnit[];

  // Date range for availability checking
  checkIn: string;
  checkOut: string;

  // Callbacks
  onAddUnit: (unit: Unit) => void;
  onRemoveUnit: (unitId: string) => void;
  onViewDetails: (unitId: string) => void;

  // Configuration
  maxUnits?: number; // Default: 10
  enableFilters?: boolean; // Default: true
  viewMode?: "grid" | "list"; // Default: 'grid'

  // State
  isLoading?: boolean;
  error?: string | null;
}

export function MultiUnitSelector({
  units,
  selectedUnits,
  checkIn,
  checkOut,
  onAddUnit,
  onRemoveUnit,
  onViewDetails,
  maxUnits = 10,
  enableFilters = true,
  viewMode = "grid",
  isLoading,
  error,
}: MultiUnitSelectorProps) {
  // Implementation
}
```

#### Implementation

```typescript
import { useState, useMemo } from 'react';
import { Grid3x3, List, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/validations';
import { cn } from '@/lib/utils';

export function MultiUnitSelector({
  units,
  selectedUnits,
  checkIn,
  checkOut,
  onAddUnit,
  onRemoveUnit,
  onViewDetails,
  maxUnits = 10,
  enableFilters = true,
  viewMode: initialViewMode = 'grid',
  isLoading,
  error,
}: MultiUnitSelectorProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(initialViewMode);
  const [filters, setFilters] = useState({
    unitType: 'all',
    maxOccupancy: 'all',
    maxRate: 'all',
  });

  // Filter units based on criteria
  const filteredUnits = useMemo(() => {
    return units.filter((unit) => {
      if (filters.unitType !== 'all' && unit.unit_type !== filters.unitType) return false;
      if (filters.maxOccupancy !== 'all' && unit.max_occupancy < parseInt(filters.maxOccupancy)) return false;
      if (filters.maxRate !== 'all' && unit.base_rate > parseInt(filters.maxRate)) return false;
      return true;
    });
  }, [units, filters]);

  const canAddMore = selectedUnits.length < maxUnits;
  const isSelected = (unitId: string) => selectedUnits.some((u) => u.unit_id === unitId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            Select Units
          </h2>
          <p className="text-sm text-muted-foreground">
            {selectedUnits.length} of {maxUnits} units selected
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      {enableFilters && (
        <div className="flex flex-wrap gap-4">
          <Select
            value={filters.unitType}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, unitType: value }))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Unit Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Cabin">Cabin</SelectItem>
              <SelectItem value="Villa">Villa</SelectItem>
              <SelectItem value="Cottage">Cottage</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.maxOccupancy}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, maxOccupancy: value }))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Occupancy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Occupancy</SelectItem>
              <SelectItem value="2">2+ guests</SelectItem>
              <SelectItem value="4">4+ guests</SelectItem>
              <SelectItem value="6">6+ guests</SelectItem>
              <SelectItem value="8">8+ guests</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.maxRate}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, maxRate: value }))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Max Price" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Price</SelectItem>
              <SelectItem value="3000">Under ₱3,000</SelectItem>
              <SelectItem value="5000">Under ₱5,000</SelectItem>
              <SelectItem value="10000">Under ₱10,000</SelectItem>
            </SelectContent>
          </Select>

          {(filters.unitType !== 'all' || filters.maxOccupancy !== 'all' || filters.maxRate !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters({ unitType: 'all', maxOccupancy: 'all', maxRate: 'all' })}
            >
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className={cn(
          'grid gap-4',
          viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'
        )}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-48 w-full mb-4" />
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Unit Grid/List */}
      {!isLoading && (
        <div className={cn(
          'grid gap-4',
          viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'
        )}>
          {filteredUnits.map((unit) => (
            <UnitCard
              key={unit.unit_id}
              unit={unit}
              isSelected={isSelected(unit.unit_id)}
              canSelect={canAddMore || isSelected(unit.unit_id)}
              viewMode={viewMode}
              onAdd={() => onAddUnit(unit)}
              onRemove={() => onRemoveUnit(unit.unit_id)}
              onViewDetails={() => onViewDetails(unit.unit_id)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredUnits.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No units match your filters</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setFilters({ unitType: 'all', maxOccupancy: 'all', maxRate: 'all' })}
          >
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
}

// Unit Card Component
function UnitCard({
  unit,
  isSelected,
  canSelect,
  viewMode,
  onAdd,
  onRemove,
  onViewDetails,
}: {
  unit: Unit;
  isSelected: boolean;
  canSelect: boolean;
  viewMode: 'grid' | 'list';
  onAdd: () => void;
  onRemove: () => void;
  onViewDetails: () => void;
}) {
  return (
    <Card className={cn(
      'transition-all hover:shadow-lg',
      isSelected && 'ring-2 ring-primary'
    )}>
      <CardContent className="p-4">
        {/* Unit Image */}
        <div className="relative h-48 bg-muted rounded-md mb-4">
          {/* Image would go here */}
          {isSelected && (
            <Badge className="absolute top-2 right-2">Selected</Badge>
          )}
        </div>

        {/* Unit Info */}
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">{unit.unit_name}</h3>
          <p className="text-sm text-muted-foreground">
            {unit.unit_type} • Max {unit.max_occupancy} guests
          </p>
          <p className="text-lg font-semibold text-primary">
            {formatCurrency(unit.base_rate)}/night
          </p>

          {/* Availability Badge */}
          <Badge variant={unit.unit_status === 'Available' ? 'success' : 'destructive'}>
            {unit.unit_status === 'Available' ? '✓ Available' : '✗ Unavailable'}
          </Badge>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 p-4 pt-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onViewDetails}
          className="flex-1"
        >
          Details
        </Button>

        {isSelected ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={onRemove}
            className="flex-1"
          >
            Remove
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={onAdd}
            disabled={!canSelect || unit.unit_status !== 'Available'}
            className="flex-1"
          >
            Add to Booking
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
```

---

### 2. UnitCardList Component

**File:** `src/components/bookings/UnitCardList.tsx`

**Purpose:** Display selected units with editing capabilities

```typescript
interface UnitCardListProps {
  units: BookingUnit[];
  onRemove: (unitId: string) => void;
  onUpdateGuestCount: (unitId: string, count: number) => void;
  onAssignGuests?: (unitId: string) => void;
  editable?: boolean;
}

export function UnitCardList({
  units,
  onRemove,
  onUpdateGuestCount,
  onAssignGuests,
  editable = true,
}: UnitCardListProps) {
  if (units.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No units selected
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {units.map((unit, index) => (
        <Card key={unit.unit_id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              {/* Unit Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{index + 1}</Badge>
                  <h3 className="font-semibold">{unit.unit_name}</h3>
                </div>

                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{unit.unit_code} • {unit.unit_type}</p>
                  <p>Max {unit.max_occupancy} guests</p>
                </div>

                {/* Guest Count Input */}
                {editable && (
                  <div className="mt-4 flex items-center gap-2">
                    <label className="text-sm font-medium">Guests:</label>
                    <NumberInput
                      min={1}
                      max={unit.max_occupancy}
                      value={unit.guest_assignment?.num_guests || unit.base_occupancy}
                      onChange={(value) => onUpdateGuestCount(unit.unit_id, value)}
                      className="w-24"
                    />

                    {onAssignGuests && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAssignGuests(unit.unit_id)}
                      >
                        Assign Guests
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Pricing */}
              <div className="text-right">
                <p className="text-2xl font-semibold">
                  {formatCurrency(unit.pricing.unit_total)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {unit.pricing.nights} nights
                </p>

                {editable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(unit.unit_id)}
                    className="mt-2 text-destructive hover:text-destructive"
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>

            {/* Pricing Breakdown (Collapsible) */}
            <Collapsible className="mt-4">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span className="text-xs">Pricing Breakdown</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Base ({unit.pricing.nights} nights × {formatCurrency(unit.base_rate)})</span>
                  <span>{formatCurrency(unit.pricing.base_total)}</span>
                </div>
                {unit.pricing.weekend_surcharge > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Weekend surcharge</span>
                    <span>+{formatCurrency(unit.pricing.weekend_surcharge)}</span>
                  </div>
                )}
                {unit.pricing.extra_person_fee > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Extra persons</span>
                    <span>+{formatCurrency(unit.pricing.extra_person_fee)}</span>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

---

### 3. MultiUnitPricingSummary Component

**File:** `src/components/bookings/MultiUnitPricingSummary.tsx`

**Purpose:** Show comprehensive pricing breakdown for all units

```typescript
interface MultiUnitPricingSummaryProps {
  units: BookingUnit[];
  discount?: number;
  showBreakdown?: boolean;
}

export function MultiUnitPricingSummary({
  units,
  discount = 0,
  showBreakdown = true,
}: MultiUnitPricingSummaryProps) {
  const subtotal = units.reduce((sum, unit) => sum + unit.pricing.unit_total, 0);
  const total = subtotal - discount;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showBreakdown && units.map((unit, index) => (
          <div key={unit.unit_id} className="space-y-1">
            <div className="flex justify-between font-medium">
              <span>Unit {index + 1}: {unit.unit_name}</span>
              <span className="font-mono">{formatCurrency(unit.pricing.unit_total)}</span>
            </div>
            <div className="text-sm text-muted-foreground pl-4">
              {unit.pricing.nights} nights × {formatCurrency(unit.base_rate)}
              {unit.pricing.weekend_surcharge > 0 && ` + ${formatCurrency(unit.pricing.weekend_surcharge)} weekend`}
              {unit.pricing.extra_person_fee > 0 && ` + ${formatCurrency(unit.pricing.extra_person_fee)} extra persons`}
            </div>
          </div>
        ))}

        <Separator />

        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-mono">{formatCurrency(subtotal)}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Bulk Discount</span>
              <span className="font-mono">-{formatCurrency(discount)}</span>
            </div>
          )}

          <Separator />

          <div className="flex justify-between text-lg font-semibold">
            <span>TOTAL</span>
            <span className="font-mono">{formatCurrency(total)}</span>
          </div>
        </div>

        {units.length >= 3 && discount === 0 && (
          <Alert>
            <AlertDescription>
              💡 Book 3+ units to get a bulk discount!
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## Accessibility Implementation

### WCAG 2.1 AA Compliance Checklist

**Perceivable:**

- [ ] All images have alt text
- [ ] Color contrast ratio ≥4.5:1 for text
- [ ] Text resizable up to 200% without loss of functionality
- [ ] Content adaptable to different orientations

**Operable:**

- [ ] All functionality keyboard accessible
- [ ] Focus indicators visible (ring-2 ring-primary)
- [ ] Touch targets ≥44px × 44px
- [ ] No keyboard traps

**Understandable:**

- [ ] Clear, concise labels and instructions
- [ ] Error messages specific and helpful
- [ ] Consistent navigation patterns
- [ ] Predictable interactions

**Robust:**

- [ ] Valid semantic HTML
- [ ] ARIA labels where appropriate
- [ ] Screen reader tested (NVDA/JAWS)
- [ ] Supports assistive technologies

### ARIA Implementation Example

```typescript
// Accessible Unit Card
<Card
  role="article"
  aria-label={`${unit.unit_name}, ${unit.unit_type}, ${formatCurrency(unit.base_rate)} per night`}
  aria-selected={isSelected}
>
  <Button
    onClick={onAdd}
    aria-label={`Add ${unit.unit_name} to booking`}
    aria-disabled={!canSelect}
  >
    Add to Booking
  </Button>
</Card>

// Accessible form field
<FormField
  control={form.control}
  name="num_guests"
  render={({ field }) => (
    <FormItem>
      <FormLabel id="guests-label">Number of Guests</FormLabel>
      <FormControl>
        <NumberInput
          {...field}
          aria-labelledby="guests-label"
          aria-describedby="guests-description"
          aria-invalid={!!errors.num_guests}
        />
      </FormControl>
      <FormDescription id="guests-description">
        Maximum {unit.max_occupancy} guests
      </FormDescription>
      <FormMessage role="alert" />
    </FormItem>
  )}
/>
```

---

## Mobile Optimizations

### Responsive Breakpoints

```typescript
// Tailwind CSS v4 breakpoints
const breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
  '2xl': '1536px', // Extra large
};

// Component responsive patterns
<div className="
  grid
  grid-cols-1       // Mobile: Stack vertically
  md:grid-cols-2    // Tablet: 2 columns
  lg:grid-cols-3    // Desktop: 3 columns
  gap-4
">
```

### Touch-Friendly Patterns

```typescript
// Minimum touch target size
<Button
  size="lg"  // h-12 = 48px (≥44px minimum)
  className="touch-manipulation w-full"
>
  Add to Booking
</Button>

// Swipeable unit cards (mobile)
import { useSwipeable } from 'react-swipeable';

const handlers = useSwipeable({
  onSwipedLeft: () => onRemove(unit.unit_id),
  onSwipedRight: () => onAdd(unit),
});

<div {...handlers} className="touch-none select-none">
  <UnitCard unit={unit} />
</div>
```

### Bottom Sheet for Filters (Mobile)

```typescript
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

<Sheet>
  <SheetTrigger asChild>
    <Button size="lg" className="lg:hidden">
      <Filter className="mr-2 h-5 w-5" />
      Filters
    </Button>
  </SheetTrigger>
  <SheetContent side="bottom" className="h-[80vh]">
    <FilterPanel />
  </SheetContent>
</Sheet>
```

---

## Testing Requirements

### Component Tests

```typescript
// MultiUnitSelector.test.tsx
describe('MultiUnitSelector', () => {
  it('renders available units', () => {
    render(<MultiUnitSelector units={mockUnits} ... />);
    expect(screen.getAllByRole('article')).toHaveLength(mockUnits.length);
  });

  it('allows adding unit when under limit', () => {
    const onAddUnit = vi.fn();
    render(<MultiUnitSelector onAddUnit={onAddUnit} selectedUnits={[]} maxUnits={10} ... />);

    const addButton = screen.getByRole('button', { name: /add.*to booking/i });
    fireEvent.click(addButton);

    expect(onAddUnit).toHaveBeenCalledTimes(1);
  });

  it('prevents adding unit when at max limit', () => {
    render(<MultiUnitSelector selectedUnits={Array(10)} maxUnits={10} ... />);

    const addButton = screen.getByRole('button', { name: /add.*to booking/i });
    expect(addButton).toBeDisabled();
  });

  it('filters units by type', async () => {
    render(<MultiUnitSelector units={mockUnits} ... />);

    const typeFilter = screen.getByRole('combobox', { name: /unit type/i });
    await userEvent.selectOptions(typeFilter, 'Cabin');

    const visibleUnits = screen.getAllByRole('article');
    expect(visibleUnits.every(unit => unit.textContent?.includes('Cabin'))).toBe(true);
  });
});
```

### Accessibility Tests

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

it('should have no accessibility violations', async () => {
  const { container } = render(<MultiUnitSelector ... />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Visual Regression Tests

```typescript
// Using Chromatic or Percy
import { expect, test } from "@playwright/test";

test("MultiUnitSelector visual regression", async ({ page }) => {
  await page.goto("/bookings/new");
  await expect(page).toHaveScreenshot("multi-unit-selector.png");
});
```

---

## Performance Optimization

### Code Splitting

```typescript
// Lazy load heavy components
const GuestAssignment = lazy(() => import('./GuestAssignment'));

<Suspense fallback={<Skeleton className="h-96" />}>
  <GuestAssignment />
</Suspense>
```

### Virtualized Lists

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualizedUnitList({ units }: { units: Unit[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: units.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,  // Estimated row height
  });

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <UnitCard unit={units[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Acceptance Criteria

### Phase Completion Checklist

- [ ] All components implemented and styled
- [ ] Mobile responsive (320px - 1920px)
- [ ] WCAG 2.1 AA compliance verified
- [ ] Touch targets ≥44px
- [ ] Loading states implemented
- [ ] Error handling comprehensive
- [ ] Visual regression tests passing
- [ ] Accessibility audit passed
- [ ] User testing ≥4.5/5
- [ ] Storybook stories complete
- [ ] Performance benchmarks met

### Sign-Off Requirements

- [ ] `resort-ui-designer` - UI implementation complete
- [ ] `tailwind-v4-design-expert` - Styling approved
- [ ] `modern-form-validation-expert` - Form handling approved
- [ ] `typescript-react-quality-expert` - Component quality approved
- [ ] `pwa-performance-optimizer` - Performance benchmarks met

---

## Next Phase Dependencies

**Phase 5 (Integration & Testing) depends on:**

- [ ] All UI components implemented
- [ ] Component tests passing
- [ ] Accessibility compliance verified
- [ ] Mobile experience validated

---

## References

- shadcn/ui Documentation: https://ui.shadcn.com/
- Tailwind CSS v4: https://tailwindcss.com/
- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
- React Hook Form: https://react-hook-form.com/
- TanStack Virtual: https://tanstack.com/virtual/latest
