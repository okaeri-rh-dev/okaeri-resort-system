# Detail & Edit Pages - Entity-Specific Implementation Guides

## Overview

This document provides detailed implementation requirements for each entity's detail and edit pages, including data requirements, UI specifications, and clickable navigation mappings.

---

## 1. Bookings

### Detail Page (`/bookings/:bookingId`)

#### Data Requirements

**Primary Data**:

```typescript
{
  booking_id: string
  booking_reference: string  // e.g., "BK-2024-001"
  booking_status: 'Pending' | 'Confirmed' | 'CheckedIn' | 'CheckedOut' | 'Cancelled'
  check_in: string  // ISO date
  check_out: string  // ISO date
  num_guests: number
  total_amount: number
  payment_method: 'Cash' | 'GCash' | 'BankTransfer' | 'Card'
  payment_status: 'Pending' | 'Partial' | 'Paid'
  special_requests?: string
  created_at: string
}
```

**Related Data** (prefetch in loader):

- Guest info: `guest_id`, `guest_name`, `email`, `contact_number`
- Unit info: `unit_id`, `unit_name`, `unit_code`, `unit_type`
- Payments: Array of payment records for this booking
- Audit logs: Filtered by `entity_type: 'booking'`, `entity_id: bookingId`

#### UI Sections

**1. Header**:

- Title: `Booking #${booking_reference}`
- Subtitle: `Created ${formatFullDate(created_at)}`
- Status badge: Shows booking_status
- Actions: Edit button (navigate to `/bookings/:id/edit`)

**2. Booking Overview** (2-column grid):

- Check-in Date: `formatFullDate(check_in)`
- Check-out Date: `formatFullDate(check_out)`
- Number of Guests: `num_guests`
- Total Amount: `formatCurrency(total_amount)` (monospace, bold)

**3. Guest Information** (clickable):

- Guest Name: **RelatedEntityLink** to `/guests/:guestId`
- Email: Plain text
- Contact Number: `formatPhone(contact_number)`

**4. Unit Information** (clickable):

- Unit: **RelatedEntityLink** to `/units/:unitId` with unit_code badge
- Unit Type: Plain text

**5. Payment Details**:

- Payment Method: Badge or text
- Payment Status: Status badge
- List of payments (if multiple)

**6. Special Requests** (if exists):

- Display sanitized text

**7. Audit Trail**:

- DetailAuditSection with `entityType: 'booking'`, `entityId: bookingId`

#### Navigation Mappings

**From Bookings Table**:

- Clicking `booking_reference` → Navigate to `/bookings/:bookingId`
- Clicking `guest_name` → Navigate to `/guests/:guestId`

**From Booking Detail**:

- Clicking guest name → Navigate to `/guests/:guestId`
- Clicking unit name → Navigate to `/units/:unitId`
- Clicking payment entry → Navigate to `/payments/:paymentId`

### Edit Page (`/bookings/:bookingId/edit`)

#### Route Guards

```typescript
beforeLoad: async ({ params }) => {
  // Check user permissions
  const canEdit = await isCurrentUserManagerOrAbove()
  if (!canEdit) throw redirect(...)

  // Check booking status
  const booking = await db.bookings.byId(params.bookingId)
  if (booking.booking_status === 'CheckedOut' || booking.booking_status === 'Cancelled') {
    throw redirect(...) // Cannot edit finalized bookings
  }
}
```

#### Form Fields (React Hook Form + Zod)

**Guest Information**:

- Guest Name: Text input (required)
- Email: Email input (required, validated)
- Contact Number: Phone input (required, formatted)

**Booking Dates**:

- Check-in Date: Date picker (required, future date validation)
- Check-out Date: Date picker (required, must be after check-in)

**Unit Selection**:

- Unit: Select dropdown (required, shows available units for dates)
- Number of Guests: Number input (required, min 1, max unit.max_occupancy)

**Payment Information**:

- Payment Method: Select (Cash, GCash, BankTransfer, Card)
- Payment Amount: Number input (optional, currency formatting)

**Special Requests**:

- Textarea (optional, sanitized with DOMPurify)

#### Submission Flow

1. Validate form with `zodResolver(bookingEditSchema)`
2. Call `useEntityEdit('booking', bookingId)` mutation
3. Optimistic update in cache
4. Log audit event: `booking.updated` with before/after changes
5. On success: Navigate to `/bookings/:bookingId`
6. On error: Rollback, show toast

---

## 2. Units

### Detail Page (`/units/:unitId`)

#### Data Requirements

**Primary Data**:

```typescript
{
  unit_id: string
  unit_name: string  // e.g., "Deluxe Villa 1"
  unit_code: string  // e.g., "DV-001"
  unit_type: string  // e.g., "Villa", "Room", "Suite"
  max_occupancy: number
  base_rate: number
  weekend_rate?: number
  extra_person_rate?: number
  cleaning_fee?: number
  amenities?: string[]
  status: 'Available' | 'Occupied' | 'Maintenance'
  created_at: string
}
```

**Related Data**:

- Current booking (if occupied): Booking details
- Upcoming bookings: Next 5 bookings
- Revenue stats: Total bookings, total revenue, occupancy rate
- Audit logs

#### UI Sections

**1. Header**:

- Title: `${unit_name} (${unit_code})`
- Subtitle: Unit type
- Status badge: Shows availability status
- Actions: Edit button

**2. Unit Specifications** (2-column grid):

- Unit Code: Monospace text
- Unit Type: Plain text
- Max Occupancy: `${max_occupancy} guests`
- Status: Status badge

**3. Pricing Information** (monospace, right-aligned):

- Base Rate: `formatCurrency(base_rate)` per night
- Weekend Rate: `formatCurrency(weekend_rate)` (if exists)
- Extra Person Rate: `formatCurrency(extra_person_rate)` (if exists)
- Cleaning Fee: `formatCurrency(cleaning_fee)` (if exists)

**4. Amenities** (if exists):

- Display as badges or bullet list

**5. Current/Upcoming Bookings**:

- Card-based list of bookings
- Each booking: **RelatedEntityLink** to `/bookings/:bookingId`

**6. Revenue Statistics**:

- Total Bookings: Count
- Total Revenue: `formatCurrency(total_revenue)`
- Occupancy Rate: `formatPercentage(rate)`

**7. Audit Trail**:

- DetailAuditSection with `entityType: 'unit'`

#### Navigation Mappings

**From Units Table**:

- Clicking `unit_name` → Navigate to `/units/:unitId`

**From Unit Detail**:

- Clicking booking reference → Navigate to `/bookings/:bookingId`

### Edit Page (`/units/:unitId/edit`)

#### Form Fields

**Basic Information**:

- Unit Name: Text input (required)
- Unit Code: Text input (required, uppercase)
- Unit Type: Select or text (required)
- Max Occupancy: Number input (required, min 1, max 20)

**Pricing**:

- Base Rate: Currency input (required, ₱ symbol)
- Weekend Rate: Currency input (optional)
- Extra Person Rate: Currency input (optional)
- Cleaning Fee: Currency input (optional)

**Amenities**:

- Multi-select or tag input (optional)

**Availability**:

- Status: Select (Available, Occupied, Maintenance)

---

## 3. Guests

### Detail Page (`/guests/:guestId`)

#### Data Requirements

**Primary Data**:

```typescript
{
  guest_id: string
  guest_name: string
  email: string
  contact_number: string
  address?: string
  notes?: string
  created_at: string
}
```

**Related Data**:

- All bookings by this guest (sorted by date desc)
- Statistics: total_spent, total_bookings, average_booking_value
- Audit logs

#### UI Sections

**1. Header**:

- Title: Guest name
- Subtitle: Member since `formatFullDate(created_at)`
- Actions: Edit button, Create Booking button

**2. Contact Information** (2-column grid):

- Email: Plain text (mailto link)
- Phone: `formatPhone(contact_number)` (tel link)
- Address: Plain text (if exists)

**3. Guest Statistics**:

- Total Bookings: Count
- Total Spent: `formatCurrency(total_spent)` (monospace, bold)
- Average Booking Value: `formatCurrency(average)`

**4. Booking History**:

- Table or card list of all bookings
- Columns: Booking Reference, Check-in, Check-out, Amount, Status
- Each booking: **RelatedEntityLink** to `/bookings/:bookingId`

**5. Notes** (if exists):

- Display internal notes (sanitized)

**6. Audit Trail**:

- DetailAuditSection with `entityType: 'guest'`

#### Navigation Mappings

**From Guests Table**:

- Clicking `guest_name` → Navigate to `/guests/:guestId`

**From Bookings Table/Detail**:

- Clicking `guest_name` → Navigate to `/guests/:guestId`

**From Guest Detail**:

- Clicking booking reference → Navigate to `/bookings/:bookingId`

### Edit Page (`/guests/:guestId/edit`)

#### Form Fields

**Personal Information**:

- Guest Name: Text input (required)
- Email: Email input (required)
- Contact Number: Phone input (required)

**Additional Information**:

- Address: Textarea (optional, sanitized)
- Notes: Textarea (optional, sanitized)

---

## 4. Payments

### Detail Page (`/payments/:paymentId`)

#### Data Requirements

**Primary Data**:

```typescript
{
  payment_id: string
  booking_id: string
  payment_amount: number
  payment_method: 'Cash' | 'GCash' | 'BankTransfer' | 'Card'
  payment_date: string
  payment_status: 'Pending' | 'Verified' | 'Failed'
  payment_proof_url?: string
  notes?: string
  created_at: string
}
```

**Related Data**:

- Associated booking: Full booking details
- Audit logs

#### UI Sections

**1. Header**:

- Title: `Payment #${payment_id.slice(0, 8)}`
- Subtitle: `Date: ${formatFullDate(payment_date)}`
- Status badge: Shows payment_status
- Actions: Edit button (limited - status/notes only)

**2. Payment Overview** (2-column grid):

- Amount: `formatCurrency(payment_amount)` (monospace, large, bold)
- Method: Badge or text
- Status: Status badge
- Date: `formatDateTime(payment_date)`

**3. Related Booking** (clickable):

- Booking Reference: **RelatedEntityLink** to `/bookings/:bookingId`
- Guest Name: Text (or link to guest)
- Check-in/Check-out: Date range

**4. Payment Proof** (if exists):

- Image viewer for `payment_proof_url`
- Download/open in new tab buttons

**5. Transaction Notes** (if exists):

- Display sanitized notes

**6. Audit Trail**:

- DetailAuditSection with `entityType: 'payment'`
- Shows verification history, status changes

#### Navigation Mappings

**From Payments Table**:

- Clicking `booking_reference` → Navigate to `/bookings/:bookingId`

**From Payment Detail**:

- Clicking booking reference → Navigate to `/bookings/:bookingId`

**From Booking Detail**:

- Clicking payment entry → Navigate to `/payments/:paymentId`

### Edit Page (`/payments/:paymentId/edit`)

#### Form Fields (Limited Editing)

**Transaction Details** (read-only if verified):

- Amount: Currency input (disabled if status = 'Verified')
- Method: Select (disabled if status = 'Verified')

**Status Management**:

- Payment Status: Select (Pending, Verified, Failed)
- Verification Notes: Textarea (for manager comments)

**Proof of Payment**:

- Upload proof image (if not exists)
- Replace proof (with approval)

#### Route Guards

```typescript
beforeLoad: async () => {
  const canEditPayments = await isCurrentUserManagerOrAbove()
  if (!canEditPayments) throw redirect(...)

  // Prevent editing verified payments
  const payment = await db.payments.byId(paymentId)
  if (payment.payment_status === 'Verified' && !isCurrentUserAdmin()) {
    throw redirect(...) // Only admins can edit verified payments
  }
}
```

---

## 5. Expenses

### Detail Page (`/expenses/:expenseId`)

#### Data Requirements

**Primary Data**:

```typescript
{
  expense_id: string
  description: string
  amount: number
  expense_date: string
  category: string  // e.g., "Maintenance", "Utilities", "Supplies"
  receipt_url?: string
  unit_id?: string
  notes?: string
  created_by: string  // user_id
  created_at: string
}
```

**Related Data**:

- Unit (if linked): Unit details
- Created by user: User name
- Audit logs

#### UI Sections

**1. Header**:

- Title: Expense description (truncated if long)
- Subtitle: `${category} • ${formatFullDate(expense_date)}`
- Actions: Edit button, Delete button (with confirmation)

**2. Expense Overview** (2-column grid):

- Amount: `formatCurrency(amount)` (monospace, large, bold)
- Category: Badge
- Date: `formatFullDate(expense_date)`
- Created By: User name

**3. Description**:

- Full description text (sanitized)

**4. Related Unit** (if exists):

- Unit: **RelatedEntityLink** to `/units/:unitId`

**5. Receipt** (if exists):

- Image viewer for `receipt_url`
- Download button

**6. Internal Notes** (if exists):

- Display sanitized notes

**7. Audit Trail**:

- DetailAuditSection with `entityType: 'expense'`

#### Navigation Mappings

**From Expenses Table**:

- Clicking `description` → Navigate to `/expenses/:expenseId`

**From Expense Detail**:

- Clicking unit name → Navigate to `/units/:unitId`

### Edit Page (`/expenses/:expenseId/edit`)

#### Form Fields

**Expense Details**:

- Description: Text input (required, max 200 chars)
- Amount: Currency input (required, ₱ symbol)
- Date: Date picker (required)
- Category: Select or text (required)

**Association**:

- Related Unit: Select dropdown (optional)

**Documentation**:

- Receipt Upload: File input (optional, images only)
- Internal Notes: Textarea (optional, sanitized)

#### Route Guards

```typescript
beforeLoad: async () => {
  const expense = await db.expenses.byId(expenseId)

  // Only creator or managers can edit
  const isCreator = expense.created_by === currentUserId
  const isManager = await isCurrentUserManagerOrAbove()

  if (!isCreator && !isManager) {
    throw redirect(...)
  }
}
```

---

## Table Column Updates Summary

### Required Changes to Existing Tables

#### 1. BookingsTable (`src/components/bookings/BookingsTable/`)

**File**: `components/BookingColumns.tsx`

**Changes**:

```typescript
// Guest Name column - make clickable
{
  accessorKey: 'guest_name',
  header: 'Guest',
  cell: ({ row }) => (
    <Link
      to="/guests/$guestId"
      params={{ guestId: row.original.guest_id }}
      className="text-blue-600 hover:underline font-medium"
    >
      {row.getValue('guest_name')}
    </Link>
  ),
}

// Booking Reference - link to detail page
{
  accessorKey: 'booking_reference',
  header: 'Booking',
  cell: ({ row }) => (
    <Link
      to="/bookings/$bookingId"
      params={{ bookingId: row.original.booking_id }}
      className="font-mono text-blue-600 hover:underline"
    >
      {row.getValue('booking_reference')}
    </Link>
  ),
}
```

#### 2. UnitsTable (`src/components/units/UnitsTable/`)

**File**: `components/UnitColumns.tsx`

**Changes**:

```typescript
{
  accessorKey: 'unit_name',
  header: 'Unit',
  cell: ({ row }) => (
    <Link
      to="/units/$unitId"
      params={{ unitId: row.original.unit_id }}
      className="text-blue-600 hover:underline font-medium"
    >
      {row.getValue('unit_name')}
    </Link>
  ),
}
```

#### 3. GuestsTable (`src/components/guests/GuestsTable/`)

**File**: `components/GuestColumns.tsx`

**Changes**:

```typescript
{
  accessorKey: 'guest_name',
  header: 'Guest Name',
  cell: ({ row }) => (
    <Link
      to="/guests/$guestId"
      params={{ guestId: row.original.guest_id }}
      className="text-blue-600 hover:underline font-medium"
    >
      {row.getValue('guest_name')}
    </Link>
  ),
}
```

#### 4. PaymentsTable (`src/components/payments/PaymentsTable/`)

**File**: `components/PaymentColumns.tsx`

**Changes**:

```typescript
{
  accessorKey: 'booking_reference',
  header: 'Booking',
  cell: ({ row }) => (
    <Link
      to="/bookings/$bookingId"
      params={{ bookingId: row.original.booking_id }}
      className="font-mono text-blue-600 hover:underline"
    >
      {row.getValue('booking_reference')}
    </Link>
  ),
}
```

#### 5. ExpensesTable (`src/components/expenses/ExpensesTable/`)

**File**: `components/ExpenseColumns.tsx`

**Changes**:

```typescript
{
  accessorKey: 'description',
  header: 'Description',
  cell: ({ row }) => {
    const description = row.getValue('description') as string
    const truncated = description.length > 50
      ? description.slice(0, 50) + '...'
      : description

    return (
      <Link
        to="/expenses/$expenseId"
        params={{ expenseId: row.original.expense_id }}
        className="text-blue-600 hover:underline"
        title={description}  // Show full text on hover
      >
        {truncated}
      </Link>
    )
  },
}
```

---

## Audit Trail Integration

### Common Pattern for All Entities

Every detail page includes audit trail section:

```typescript
import { DetailAuditSection } from '@/components/entity-detail'

<DetailAuditSection
  entityType="booking"  // or 'unit', 'guest', 'payment', 'expense'
  entityId={entityId}
  title="Change History"
  defaultCollapsed={false}  // Expanded on desktop, collapsed on mobile
/>
```

### Audit Events to Log

**Booking**:

- `booking.created`
- `booking.updated`
- `booking.status_changed`
- `booking.cancelled`

**Unit**:

- `unit.created`
- `unit.updated`
- `unit.status_changed`

**Guest**:

- `guest.created`
- `guest.updated`

**Payment**:

- `payment.created`
- `payment.verified`
- `payment.status_changed`

**Expense**:

- `expense.created`
- `expense.updated`
- `expense.deleted`

---

## Mobile Responsive Patterns

### Common Breakpoints for All Entities

**Desktop (1024px+)**:

- 2-column grid for detail fields
- Horizontal breadcrumbs
- Side-by-side sections where applicable

**Tablet (768-1023px)**:

- 2-column grid (narrower)
- Compact spacing
- Sections stack vertically

**Mobile (<768px)**:

- Single column layout
- Full-width fields
- Collapsible audit trail
- Simplified header with back button

### Example Responsive Grid

```typescript
// Desktop: 2 columns, Mobile: 1 column
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <DetailField label="Field 1" value="..." />
  <DetailField label="Field 2" value="..." />
</div>

// Desktop: 3 columns, Tablet: 2 columns, Mobile: 1 column
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <DetailSection>...</DetailSection>
  <DetailSection>...</DetailSection>
  <DetailSection>...</DetailSection>
</div>
```

---

## Implementation Checklist

### Per Entity (5 entities × checklist)

- [ ] Create detail route file (`$entityId.tsx`)
- [ ] Create edit route file (`$entityId.edit.tsx`)
- [ ] Implement loader with data prefetching
- [ ] Add route guards (auth, permissions, status checks)
- [ ] Build detail page component with all sections
- [ ] Build edit form component with validation
- [ ] Integrate audit trail on detail page
- [ ] Add responsive design for mobile
- [ ] Update table columns with clickable links
- [ ] Add loading skeletons
- [ ] Add error boundaries
- [ ] Write unit tests
- [ ] Test cross-entity navigation

### Complete Implementation Order

1. **Bookings** (reference implementation)
2. **Guests** (linked from bookings)
3. **Units** (linked from bookings)
4. **Payments** (linked from bookings)
5. **Expenses** (standalone, optional unit link)

---

## Summary

This entity guide provides:

- ✅ **Detailed data requirements** for each entity
- ✅ **UI section specifications** with formatting
- ✅ **Navigation mappings** for clickable fields
- ✅ **Form field definitions** for edit pages
- ✅ **Route guard patterns** for permissions
- ✅ **Table update instructions** for all 5 tables
- ✅ **Audit trail integration** standards
- ✅ **Mobile responsive patterns** for all pages

Each entity follows the same architectural patterns established in the routing, UI, and TypeScript guides, ensuring consistency across the entire system.
