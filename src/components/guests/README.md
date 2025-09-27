# 👥 Guest Management Components

## Overview

The Guest Management module provides comprehensive functionality for managing resort guests, including registration, profile management, booking history, and guest analytics. This module integrates with the booking system to maintain guest relationships and improve customer service.

## 📁 Component Structure

```
guests/
├── GuestQuickForm.tsx      # Quick guest registration form (13.3KB)
├── GuestsTable.tsx         # Guest list with filters (23.5KB)
├── GuestEditDialog.tsx     # Guest profile editing (4KB)
├── GuestDetailModal.tsx    # Detailed guest view (8.1KB)
├── GuestsTable/           # Table sub-components
│   ├── columns.tsx        # Table column definitions
│   ├── filters.tsx        # Advanced filter components
│   └── actions.tsx        # Row action handlers
└── index.ts               # Component exports
```

## 📦 Component Documentation

### `GuestQuickForm` - Guest Registration
**Purpose**: Rapid guest registration during booking process

**Features**:
- Quick registration mode for walk-ins
- Validation with Philippine formats
- Duplicate detection
- Auto-save functionality

**Props**:
```typescript
interface GuestQuickFormProps {
  mode?: 'inline' | 'modal' | 'standalone'
  onSubmit?: (guest: Guest) => void
  onCancel?: () => void
  defaultValues?: Partial<Guest>
  autoFocus?: boolean
}
```

**Usage**:
```tsx
import { GuestQuickForm } from '@/components/guests'

function BookingProcess() {
  const handleGuestCreated = (guest: Guest) => {
    // Link guest to booking
    updateBooking({ guest_id: guest.guest_id })
  }

  return (
    <GuestQuickForm
      mode="inline"
      onSubmit={handleGuestCreated}
      autoFocus
    />
  )
}
```

**Form Fields**:
- First Name* (required)
- Last Name* (required)
- Email* (with validation)
- Phone* (Philippine format: +639XX)
- Address (optional)
- City (optional)
- Country (with dropdown)
- ID Type & Number
- Date of Birth
- Nationality
- Guest Preferences

### `GuestsTable` - Guest Management Table
**Purpose**: Comprehensive guest list with search, filters, and actions

**Features**:
- Server-side pagination
- Advanced filtering
- Column sorting
- Bulk actions
- Export functionality
- Real-time updates

**Props**:
```typescript
interface GuestsTableProps {
  initialFilter?: GuestFilter
  onGuestSelect?: (guest: Guest) => void
  selectionMode?: 'single' | 'multiple' | 'none'
  compactMode?: boolean
  showActions?: boolean
}
```

**Filter Options**:
- Text search (name, email, phone)
- VIP status filter
- Country filter
- Date range (registration date)
- Booking count range
- Total spent range

**Column Configuration**:
```typescript
const columns = [
  { key: 'name', label: 'Guest Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'phone', label: 'Phone' },
  { key: 'country', label: 'Country', filterable: true },
  { key: 'total_bookings', label: 'Bookings', sortable: true },
  { key: 'total_spent', label: 'Total Spent', sortable: true },
  { key: 'is_vip', label: 'VIP', filterable: true },
  { key: 'created_at', label: 'Member Since', sortable: true }
]
```

**Row Actions**:
- View Details
- Edit Profile
- View Booking History
- Send Message
- Mark as VIP
- Delete Guest

### `GuestDetailModal` - Guest Profile View
**Purpose**: Comprehensive guest information display

**Features**:
- Guest profile summary
- Booking history timeline
- Payment history
- Preferences and notes
- Activity log

**Props**:
```typescript
interface GuestDetailModalProps {
  guestId: string
  isOpen: boolean
  onClose: () => void
  onEdit?: () => void
  showBookingHistory?: boolean
}
```

**Sections**:
1. **Profile Header**: Photo, name, VIP status
2. **Contact Information**: Email, phone, address
3. **Statistics**: Total bookings, spent, last visit
4. **Booking History**: List of all bookings
5. **Preferences**: Room preferences, dietary restrictions
6. **Internal Notes**: Staff notes and comments

### `GuestEditDialog` - Profile Editor
**Purpose**: Edit guest information with validation

**Features**:
- Form validation
- Change history tracking
- Photo upload
- Preference management

**Props**:
```typescript
interface GuestEditDialogProps {
  guest: Guest
  isOpen: boolean
  onClose: () => void
  onSave: (updated: Guest) => Promise<void>
}
```

## 🏗️ State Management

### Store Integration
```typescript
// Using with guest store
import { useGuestStore } from '@/stores/useGuestStore'

function GuestManager() {
  const {
    guests,
    isLoading,
    fetchGuests,
    createGuest,
    updateGuest
  } = useGuestStore()

  return (
    <GuestsTable
      data={guests}
      loading={isLoading}
      onRefresh={fetchGuests}
    />
  )
}
```

### Query Integration
```typescript
// Using with TanStack Query
import { useQuery } from '@tanstack/react-query'

function GuestProfile({ guestId }) {
  const { data: guest } = useQuery({
    queryKey: ['guest', guestId],
    queryFn: () => db.guests.byId(guestId)
  })

  return <GuestDetailModal guest={guest} />
}
```

## 🎨 Styling Patterns

### Theme Variables
```scss
// Guest status colors
--vip-gold: #FFD700
--regular-blue: #4A90E2
--inactive-gray: #A0A0A0

// Component spacing
--guest-card-padding: 1.5rem
--table-row-height: 60px
```

### Responsive Design
```tsx
// Mobile-optimized guest card
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {guests.map(guest => (
    <GuestCard key={guest.id} {...guest} />
  ))}
</div>
```

## 🔒 Security & Validation

### Data Sanitization
- All text inputs sanitized with DOMPurify
- Email validation with regex
- Phone validation for Philippine formats
- SQL injection prevention

### Privacy Considerations
- PII data encrypted at rest
- Sensitive fields masked in logs
- GDPR compliance for data export
- Audit trail for profile changes

## 📊 Analytics Integration

### Guest Metrics
```typescript
interface GuestMetrics {
  totalGuests: number
  newGuestsThisMonth: number
  vipPercentage: number
  averageLifetimeValue: number
  repeatGuestRate: number
}
```

### Tracking Events
- Guest registration
- Profile updates
- VIP status changes
- Booking conversions

## 🧪 Testing

### Component Tests
```typescript
describe('GuestQuickForm', () => {
  it('validates Philippine phone format', () => {
    const { getByLabelText } = render(<GuestQuickForm />)
    const phoneInput = getByLabelText('Phone')

    fireEvent.change(phoneInput, {
      target: { value: '+639123456789' }
    })

    expect(phoneInput).toHaveClass('valid')
  })
})
```

### Integration Tests
- Guest creation flow
- Duplicate detection
- Search functionality
- Filter combinations

## 🚀 Performance Optimizations

- Virtual scrolling for large guest lists
- Debounced search (300ms)
- Lazy loading of booking history
- Optimistic UI updates
- Image lazy loading for guest photos

## 📚 Related Components

- [BookingForm](/src/components/bookings/README.md) - Guest selection
- [PaymentsTable](/src/components/payments/README.md) - Payment history
- [Dashboard](/src/components/dashboard/README.md) - Guest analytics

## 🔧 Configuration

### Environment Variables
```env
VITE_MAX_GUEST_PHOTO_SIZE=5MB
VITE_GUEST_SEARCH_DEBOUNCE=300
VITE_GUESTS_PER_PAGE=20
```

### Feature Flags
```typescript
const features = {
  enableGuestPhotos: true,
  enableVIPProgram: true,
  enableGuestExport: true,
  enableBulkOperations: false // Phase 3
}
```