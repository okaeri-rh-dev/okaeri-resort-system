# Detail & Edit Pages - UI Component Library

## Overview

This document defines the shared component library for building consistent, professional detail and edit pages across all entities in the Okaeri Resort System.

## Design Principles

### Professional Enterprise Design System

- **Information Density**: Compact layouts, minimal whitespace, maximum data visibility
- **Monospace Financials**: All currency and numeric IDs use `font-mono` with proper alignment
- **Conservative Styling**: 1px borders, 4px border-radius, neutral color palette
- **Business Reliability**: Comprehensive error states, loading indicators, accessibility
- **Philippine Context**: ₱ currency, proper date formatting, mobile-first for staff

## Component Architecture

### File Structure

```
src/components/entity-detail/
├── DetailPageLayout.tsx       # Main layout wrapper
├── DetailPageHeader.tsx       # Header with breadcrumbs + actions
├── DetailSection.tsx          # Card-based section container
├── DetailField.tsx            # Label-value pair display
├── DetailAuditSection.tsx     # Audit trail integration
├── RelatedEntityLink.tsx      # Clickable cross-entity links
├── DetailPageSkeleton.tsx     # Loading states
├── DetailErrorBoundary.tsx    # Error handling
└── utils/
    ├── formatters.ts          # Data formatting utilities
    └── types.ts               # Shared TypeScript types
```

## Core Components

### 1. DetailPageLayout

**Purpose**: Base layout wrapper for all detail pages with consistent structure.

**Props**:

```typescript
interface DetailPageLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  breadcrumbs: Breadcrumb[];
  status?: React.ReactNode; // Status badge
  actions?: React.ReactNode; // Header actions
  editRoute?: { to: string; params: Record<string, string> };
}

type Breadcrumb = {
  label: string;
  to?: string; // If provided, renders as Link
};
```

**Implementation**:

```typescript
// src/components/entity-detail/DetailPageLayout.tsx
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ChevronRight, Edit } from 'lucide-react'

export function DetailPageLayout({
  children,
  title,
  subtitle,
  breadcrumbs,
  status,
  actions,
  editRoute,
}: DetailPageLayoutProps) {
  return (
    <div className="container mx-auto py-6 space-y-6 max-w-[1400px]">
      {/* Breadcrumbs */}
      <nav className="flex items-center space-x-2 text-sm text-neutral-600" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={index}>
            {index > 0 && <ChevronRight className="h-4 w-4" />}
            {crumb.to ? (
              <Link to={crumb.to} className="hover:text-neutral-900 transition-colors">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-neutral-900 font-medium">{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">
              {title}
            </h1>
            {status}
          </div>
          {subtitle && (
            <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {actions}
          {editRoute && (
            <Link to={editRoute.to} params={editRoute.params}>
              <Button size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">{children}</div>
    </div>
  )
}
```

**Usage**:

```typescript
<DetailPageLayout
  title={`Booking #${booking.booking_reference}`}
  subtitle={`Created ${formatDateTime(booking.created_at)}`}
  breadcrumbs={[
    { label: 'Bookings', to: '/bookings' },
    { label: booking.booking_reference },
  ]}
  status={<StatusBadge status={booking.booking_status} />}
  editRoute={{
    to: '/bookings/$bookingId/edit',
    params: { bookingId: booking.booking_id },
  }}
>
  {/* Page content */}
</DetailPageLayout>
```

### 2. DetailSection

**Purpose**: Card-based section container for grouping related information.

**Props**:

```typescript
interface DetailSectionProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
}
```

**Implementation**:

```typescript
// src/components/entity-detail/DetailSection.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

export function DetailSection({
  title,
  icon,
  action,
  children,
  collapsible = false,
  defaultCollapsed = false,
  className,
}: DetailSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            {icon}
            {title}
            {collapsible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="ml-auto"
              >
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>
            )}
          </CardTitle>
          {action && !collapsible && action}
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  )
}
```

**Usage**:

```typescript
<DetailSection
  title="Booking Information"
  icon={<FileText className="h-5 w-5" />}
  action={<Button variant="ghost" size="sm">Edit</Button>}
>
  <div className="grid grid-cols-2 gap-4">
    {/* Section content */}
  </div>
</DetailSection>
```

### 3. DetailField

**Purpose**: Standardized label-value pair with professional formatting.

**Props**:

```typescript
interface DetailFieldProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  valueClassName?: string;
  labelClassName?: string;
  direction?: "horizontal" | "vertical"; // Layout direction
}
```

**Implementation**:

```typescript
// src/components/entity-detail/DetailField.tsx
import { cn } from '@/lib/utils'

export function DetailField({
  label,
  value,
  icon,
  valueClassName,
  labelClassName,
  direction = 'vertical',
}: DetailFieldProps) {
  if (direction === 'horizontal') {
    return (
      <div className="flex items-center justify-between gap-4 py-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className={cn('text-sm font-medium text-neutral-600', labelClassName)}>
            {label}
          </span>
        </div>
        <div className={cn('text-sm text-neutral-900', valueClassName)}>
          {value}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {icon}
        <label className={cn('text-sm font-medium text-neutral-600', labelClassName)}>
          {label}
        </label>
      </div>
      <div className={cn('text-sm text-neutral-900', valueClassName)}>
        {value}
      </div>
    </div>
  )
}
```

**Usage Examples**:

```typescript
// Basic field
<DetailField label="Guest Name" value={booking.guest_name} />

// Financial field (monospace, bold)
<DetailField
  label="Total Amount"
  value={formatCurrency(booking.total_amount)}
  valueClassName="font-mono font-semibold text-lg"
/>

// Field with icon
<DetailField
  label="Check-in Date"
  value={formatFullDate(booking.check_in)}
  icon={<Calendar className="h-4 w-4 text-neutral-500" />}
/>

// Field with link
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

// Horizontal layout
<DetailField
  label="Status"
  value={<StatusBadge status={booking.booking_status} />}
  direction="horizontal"
/>
```

### 4. RelatedEntityLink

**Purpose**: Type-safe clickable links to related entities with consistent styling.

**Props**:

```typescript
type EntityType = "booking" | "unit" | "guest" | "payment" | "expense";

interface RelatedEntityLinkProps {
  type: EntityType;
  id: string;
  label: string;
  badge?: string; // Optional secondary info (e.g., unit code)
  className?: string;
}
```

**Implementation**:

```typescript
// src/components/entity-detail/RelatedEntityLink.tsx
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import {
  FileText,
  Home,
  User,
  CreditCard,
  Receipt,
} from 'lucide-react'

const entityIcons = {
  booking: FileText,
  unit: Home,
  guest: User,
  payment: CreditCard,
  expense: Receipt,
}

const entityRoutes = {
  booking: '/bookings/$bookingId',
  unit: '/units/$unitId',
  guest: '/guests/$guestId',
  payment: '/payments/$paymentId',
  expense: '/expenses/$expenseId',
} as const

export function RelatedEntityLink({
  type,
  id,
  label,
  badge,
  className,
}: RelatedEntityLinkProps) {
  const Icon = entityIcons[type]
  const routeTo = entityRoutes[type]

  // Map entity type to param name
  const paramKey = `${type}Id` as const

  return (
    <Link
      to={routeTo}
      params={{ [paramKey]: id } as any}
      className={cn(
        'inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors',
        className
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      {badge && (
        <span className="text-xs font-mono text-neutral-500">
          ({badge})
        </span>
      )}
    </Link>
  )
}
```

**Usage**:

```typescript
// Link to guest
<RelatedEntityLink
  type="guest"
  id={booking.guest_id}
  label={booking.guest_name}
/>

// Link to unit with code badge
<RelatedEntityLink
  type="unit"
  id={booking.unit_id}
  label={unit.unit_name}
  badge={unit.unit_code}
/>

// Link to booking reference
<RelatedEntityLink
  type="booking"
  id={payment.booking_id}
  label={payment.booking_reference}
/>
```

### 5. DetailAuditSection

**Purpose**: Integrate audit trail display on detail pages with entity filtering.

**Props**:

```typescript
interface DetailAuditSectionProps {
  entityType: "booking" | "unit" | "guest" | "payment" | "expense";
  entityId: string;
  title?: string;
  defaultCollapsed?: boolean;
  limit?: number; // Number of entries to show
}
```

**Implementation**:

```typescript
// src/components/entity-detail/DetailAuditSection.tsx
import { AuditLogViewer } from '@/components/audit/AuditLogViewer'
import { DetailSection } from './DetailSection'
import { History } from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'

export function DetailAuditSection({
  entityType,
  entityId,
  title = 'Change History',
  defaultCollapsed,
  limit = 10,
}: DetailAuditSectionProps) {
  const isMobile = useMediaQuery('(max-width: 768px)')

  return (
    <DetailSection
      title={title}
      icon={<History className="h-5 w-5" />}
      collapsible
      defaultCollapsed={defaultCollapsed ?? isMobile}
    >
      <AuditLogViewer
        filters={{
          table_name: entityType,
          record_id: entityId,
        }}
        limit={limit}
        compact
      />
    </DetailSection>
  )
}
```

**Usage**:

```typescript
<DetailAuditSection
  entityType="booking"
  entityId={booking.booking_id}
  title="Booking History"
  defaultCollapsed={false}
/>
```

### 6. DetailPageSkeleton

**Purpose**: Consistent loading states that preserve layout structure.

**Implementation**:

```typescript
// src/components/entity-detail/DetailPageSkeleton.tsx
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function DetailPageSkeleton() {
  return (
    <div className="container mx-auto py-6 space-y-6 max-w-[1400px]">
      {/* Breadcrumbs skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Section skeletons */}
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((j) => (
              <div key={j} className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

**Usage in Route**:

```typescript
export const Route = createFileRoute("/_authenticated/bookings/$bookingId")({
  pendingComponent: DetailPageSkeleton,
  component: BookingDetailPage,
});
```

## Data Formatting Utilities

### Formatter Functions

```typescript
// src/components/entity-detail/utils/formatters.ts

/**
 * Format currency for Philippine context
 * Rounds to whole numbers, adds ₱ symbol and comma separators
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date for dense table display
 */
export function formatTableDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

/**
 * Format full date for detail pages
 */
export function formatFullDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

/**
 * Format date with time
 */
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Format phone number for Philippines
 */
export function formatPhone(phone: string): string {
  // 09171234567 → 0917 123 4567
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("0")) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}
```

## Responsive Design Patterns

### Breakpoint System

```typescript
// src/hooks/useMediaQuery.ts
import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
```

### Responsive Grid Patterns

```typescript
// Desktop: 2-column grid
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <DetailField label="Field 1" value="..." />
  <DetailField label="Field 2" value="..." />
</div>

// Mobile: Stack vertically, Desktop: 3 columns
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <DetailSection title="Section 1">...</DetailSection>
  <DetailSection title="Section 2">...</DetailSection>
  <DetailSection title="Section 3">...</DetailSection>
</div>

// Conditional rendering for mobile
const isMobile = useMediaQuery('(max-width: 768px)')

return isMobile ? (
  <MobileLayout />
) : (
  <DesktopLayout />
)
```

## Accessibility Guidelines

### ARIA Labels

```typescript
// Breadcrumb navigation
<nav aria-label="Breadcrumb">
  {/* breadcrumb items */}
</nav>

// Section headings
<section aria-labelledby="booking-info">
  <h2 id="booking-info">Booking Information</h2>
  {/* content */}
</section>

// Action buttons
<Button
  onClick={handleEdit}
  aria-label={`Edit ${entityType} ${entityName}`}
>
  Edit
</Button>
```

### Keyboard Navigation

- All interactive elements must be keyboard accessible
- Logical tab order (breadcrumbs → actions → sections → audit)
- `Enter` and `Space` trigger buttons
- `Escape` closes collapsible sections

### Color Contrast

- Normal text: 4.5:1 contrast (text-neutral-900 on white)
- Large text: 3:1 contrast
- Interactive elements: 3:1 against adjacent colors
- Status badges: Maintain 4.5:1 contrast

## Complete Detail Page Example

```typescript
// src/components/bookings/BookingDetail/index.tsx
import { useParams, useLoaderData } from '@tanstack/react-router'
import {
  DetailPageLayout,
  DetailSection,
  DetailField,
  RelatedEntityLink,
  DetailAuditSection,
} from '@/components/entity-detail'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatCurrency, formatFullDate, formatPhone } from '@/components/entity-detail/utils/formatters'
import { Calendar, User, Home, DollarSign } from 'lucide-react'

export function BookingDetailPage() {
  const { bookingId } = useParams({ from: '/_authenticated/bookings/$bookingId' })
  const { booking } = useLoaderData({ from: '/_authenticated/bookings/$bookingId' })

  return (
    <DetailPageLayout
      title={`Booking #${booking.booking_reference}`}
      subtitle={`Created ${formatFullDate(booking.created_at)}`}
      breadcrumbs={[
        { label: 'Bookings', to: '/bookings' },
        { label: booking.booking_reference },
      ]}
      status={<StatusBadge status={booking.booking_status} />}
      editRoute={{
        to: '/bookings/$bookingId/edit',
        params: { bookingId },
      }}
    >
      {/* Overview Section */}
      <DetailSection
        title="Booking Overview"
        icon={<Calendar className="h-5 w-5" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailField
            label="Check-in Date"
            value={formatFullDate(booking.check_in)}
          />
          <DetailField
            label="Check-out Date"
            value={formatFullDate(booking.check_out)}
          />
          <DetailField
            label="Number of Guests"
            value={booking.num_guests}
          />
          <DetailField
            label="Total Amount"
            value={formatCurrency(booking.total_amount)}
            valueClassName="font-mono font-semibold text-lg"
          />
        </div>
      </DetailSection>

      {/* Guest Information */}
      <DetailSection
        title="Guest Information"
        icon={<User className="h-5 w-5" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailField
            label="Guest Name"
            value={
              <RelatedEntityLink
                type="guest"
                id={booking.guest_id}
                label={booking.guest_name}
              />
            }
          />
          <DetailField
            label="Email"
            value={booking.email}
          />
          <DetailField
            label="Contact Number"
            value={formatPhone(booking.contact_number)}
          />
        </div>
      </DetailSection>

      {/* Unit Information */}
      <DetailSection
        title="Unit Information"
        icon={<Home className="h-5 w-5" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailField
            label="Unit"
            value={
              <RelatedEntityLink
                type="unit"
                id={booking.unit_id}
                label={booking.unit.unit_name}
                badge={booking.unit.unit_code}
              />
            }
          />
          <DetailField
            label="Unit Type"
            value={booking.unit.unit_type}
          />
        </div>
      </DetailSection>

      {/* Payment Information */}
      <DetailSection
        title="Payment Details"
        icon={<DollarSign className="h-5 w-5" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailField
            label="Payment Method"
            value={booking.payment_method}
          />
          <DetailField
            label="Payment Status"
            value={<StatusBadge status={booking.payment_status} />}
          />
        </div>
      </DetailSection>

      {/* Audit Trail */}
      <DetailAuditSection
        entityType="booking"
        entityId={bookingId}
        title="Booking History"
      />
    </DetailPageLayout>
  )
}
```

## Testing Components

### Component Test Template

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DetailField } from '../DetailField'

describe('DetailField', () => {
  it('renders label and value', () => {
    render(<DetailField label="Guest Name" value="John Doe" />)

    expect(screen.getByText('Guest Name')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('applies custom className to value', () => {
    render(
      <DetailField
        label="Amount"
        value="₱5,000"
        valueClassName="font-mono"
      />
    )

    const value = screen.getByText('₱5,000')
    expect(value).toHaveClass('font-mono')
  })

  it('renders with icon', () => {
    const icon = <span data-testid="icon">📅</span>
    render(
      <DetailField
        label="Date"
        value="Dec 25, 2024"
        icon={icon}
      />
    )

    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })
})
```

## Styling Reference

### Professional Enterprise CSS Classes

```typescript
// Headers
"text-2xl font-semibold tracking-tight"; // Page title
"text-base font-semibold"; // Section title
"text-sm font-medium text-neutral-600"; // Field label

// Values
"text-sm text-neutral-900"; // Standard value
"font-mono font-semibold text-lg"; // Financial value
"font-mono text-sm text-blue-600"; // ID/Reference

// Cards
"border border-neutral-200 rounded-md"; // Card border
"p-4"; // Card padding

// Spacing
"space-y-6"; // Section spacing
"gap-4"; // Grid gap
"mt-1"; // Subtitle margin

// Links
"text-blue-600 hover:text-blue-700 hover:underline";
```

## Summary

This UI component library provides:

- ✅ **Consistent layouts** across all detail pages
- ✅ **Reusable components** for common patterns
- ✅ **Professional styling** following enterprise design
- ✅ **Type-safe navigation** with related entity links
- ✅ **Responsive design** for mobile and desktop
- ✅ **Accessibility** built-in with ARIA labels
- ✅ **Data formatting** utilities for Philippine context
- ✅ **Loading states** and error handling

All components follow the Professional Enterprise Design System with information density, monospace financials, and business reliability as core principles.
