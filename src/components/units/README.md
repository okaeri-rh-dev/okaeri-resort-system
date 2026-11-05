# 🏠 Unit Management Components

## Overview

The Unit Management module handles all aspects of resort accommodation units, including unit configuration, availability management, pricing, amenities, and maintenance scheduling. This module is central to the resort's inventory management.

## 📁 Component Structure

```
units/
├── UnitForm.tsx          # Unit creation/editing form (13.9KB)
├── UnitsTable.tsx        # Unit inventory table (25.2KB)
├── UnitDetailModal.tsx   # Detailed unit view (6.6KB)
├── UnitsTable/          # Table sub-components
│   ├── columns.tsx      # Column definitions
│   ├── filters.tsx      # Filter components
│   ├── availability.tsx # Availability indicators
│   └── pricing.tsx      # Pricing display
└── index.ts             # Component exports
```

## 📦 Component Documentation

### `UnitForm` - Unit Configuration
**Purpose**: Create and edit accommodation units with comprehensive details

**Features**:
- Multi-step form wizard
- Image upload gallery
- Amenity selection
- Dynamic pricing rules
- Availability calendar

**Props**:
```typescript
interface UnitFormProps {
  unit?: Unit  // For editing
  onSubmit: (unit: Unit) => Promise<void>
  onCancel: () => void
  mode?: 'create' | 'edit' | 'duplicate'
}
```

**Usage**:
```tsx
import { UnitForm } from '@/components/units'

function AddUnit() {
  const handleSubmit = async (unitData: Unit) => {
    const { data, error } = await db.units.create(unitData)
    if (data) {
      toast.success('Unit created successfully')
      router.push(`/units/${data.unit_id}`)
    }
  }

  return (
    <UnitForm
      mode="create"
      onSubmit={handleSubmit}
    />
  )
}
```

**Form Sections**:
1. **Basic Information**
   - Unit Name*
   - Unit Type (Standard/Deluxe/Suite/Villa)
   - Building/Floor
   - View Type

2. **Capacity & Size**
   - Max Occupancy*
   - Size (sqm)
   - Number of Beds
   - Bed Configuration

3. **Pricing**
   - Base Price*
   - Seasonal Rates
   - Weekend Rates
   - Extra Person Charge

4. **Amenities**
   - WiFi, AC, TV
   - Kitchen facilities
   - Bathroom amenities
   - Special features

5. **Images**
   - Main photo
   - Gallery (up to 10)
   - 360° view URL

### `UnitsTable` - Unit Inventory
**Purpose**: Comprehensive unit management interface

**Features**:
- Real-time availability status
- Advanced filtering
- Bulk operations
- Quick actions
- Calendar view toggle

**Props**:
```typescript
interface UnitsTableProps {
  filters?: UnitFilters
  onUnitSelect?: (unit: Unit) => void
  viewMode?: 'table' | 'grid' | 'calendar'
  showAvailability?: boolean
}
```

**Columns**:
```typescript
const columns = [
  { key: 'unit_name', label: 'Unit', sortable: true },
  { key: 'unit_type', label: 'Type', filterable: true },
  { key: 'status', label: 'Status', badge: true },
  { key: 'max_occupancy', label: 'Capacity' },
  { key: 'base_price', label: 'Price', sortable: true },
  { key: 'availability', label: 'Available', component: AvailabilityIndicator },
  { key: 'actions', label: '', component: UnitActions }
]
```

**Status Indicators**:
```tsx
const statusConfig = {
  available: { color: 'green', icon: '✅', label: 'Available' },
  occupied: { color: 'blue', icon: '🏠', label: 'Occupied' },
  maintenance: { color: 'orange', icon: '🔧', label: 'Maintenance' },
  blocked: { color: 'red', icon: '🚫', label: 'Blocked' }
}
```

### `UnitDetailModal` - Unit Details View
**Purpose**: Comprehensive unit information display

**Features**:
- Image gallery viewer
- Availability calendar
- Booking history
- Maintenance log
- Revenue analytics

**Props**:
```typescript
interface UnitDetailModalProps {
  unitId: string
  isOpen: boolean
  onClose: () => void
  onEdit?: () => void
  showBookings?: boolean
}
```

**Modal Sections**:
1. **Gallery**: Image carousel with fullscreen view
2. **Details**: Complete unit specifications
3. **Availability**: 3-month calendar view
4. **Bookings**: Current and upcoming bookings
5. **Maintenance**: Scheduled and completed maintenance
6. **Analytics**: Occupancy rate, revenue trends

## 🏗️ Unit Management Features

### Availability Management
```typescript
interface AvailabilityConfig {
  unit_id: string
  blocked_dates: DateRange[]
  maintenance_schedule: MaintenanceSchedule[]
  seasonal_availability: SeasonalRule[]
}

// Check availability
const isAvailable = await checkUnitAvailability(
  unitId,
  { start: checkIn, end: checkOut }
)

// Block dates
await blockUnitDates(unitId, {
  start: '2024-12-24',
  end: '2024-12-26',
  reason: 'Holiday closure'
})
```

### Dynamic Pricing
```typescript
interface PricingRule {
  base_price: number
  seasonal_rates: SeasonalRate[]
  weekend_multiplier: number
  extra_person_charge: number
  minimum_stay?: number
  early_bird_discount?: number
}

// Calculate price for dates
const price = calculateUnitPrice(unit, {
  checkIn,
  checkOut,
  guestCount,
  applyDiscounts: true
})
```

### Unit Categories
```typescript
const unitTypes = {
  standard: {
    label: 'Standard Room',
    icon: '🏠',
    baseOccupancy: 2,
    description: 'Comfortable room with essential amenities'
  },
  deluxe: {
    label: 'Deluxe Room',
    icon: '⭐',
    baseOccupancy: 3,
    description: 'Spacious room with premium amenities'
  },
  suite: {
    label: 'Suite',
    icon: '👑',
    baseOccupancy: 4,
    description: 'Luxury suite with separate living area'
  },
  villa: {
    label: 'Villa',
    icon: '🏡',
    baseOccupancy: 6,
    description: 'Private villa with exclusive facilities'
  }
}
```

## 🎨 UI Components

### Unit Card (Grid View)
```tsx
<UnitCard>
  <UnitImage src={unit.images[0]} />
  <UnitInfo>
    <UnitName>{unit.unit_name}</UnitName>
    <UnitType type={unit.unit_type} />
    <UnitPrice amount={unit.base_price} />
    <UnitCapacity max={unit.max_occupancy} />
  </UnitInfo>
  <StatusBadge {...statusBadgeProps(cabinStates.get(unit.unit_id)?.state, 'Free')} />
  <UnitActions unit={unit} />
</UnitCard>
```

### Availability Calendar
```tsx
<AvailabilityCalendar
  unitId={unit.unit_id}
  view="month"
  onDateSelect={handleDateSelect}
  blockedDates={unit.blocked_dates}
  bookings={unit.bookings}
/>
```

### Amenity Icons
```tsx
const amenityIcons = {
  wifi: '📶',
  aircon: '❄️',
  tv: '📺',
  kitchen: '🍳',
  parking: '🚗',
  pool: '🏊',
  gym: '💪',
  breakfast: '🍳'
}
```

## 📊 Analytics & Reporting

### Unit Metrics
```typescript
interface UnitMetrics {
  occupancyRate: number
  averageDailyRate: number
  revenuePerAvailable: number
  totalRevenue: number
  bookingCount: number
  averageStayLength: number
}

const metrics = await calculateUnitMetrics(
  unitId,
  { start: startDate, end: endDate }
)
```

### Performance Indicators
```tsx
<UnitPerformance>
  <MetricCard
    label="Occupancy"
    value={`${metrics.occupancyRate}%`}
    trend={metrics.occupancyTrend}
  />
  <MetricCard
    label="ADR"
    value={formatCurrency(metrics.averageDailyRate)}
    trend={metrics.adrTrend}
  />
</UnitPerformance>
```

## 🔧 Maintenance Management

### Maintenance Scheduling
```typescript
interface MaintenanceSchedule {
  unit_id: string
  type: 'routine' | 'repair' | 'upgrade'
  description: string
  scheduled_date: Date
  estimated_duration: number
  assigned_to?: string
  status: 'scheduled' | 'in_progress' | 'completed'
}

// Schedule maintenance
await scheduleMaintenance({
  unit_id: unit.unit_id,
  type: 'routine',
  description: 'Deep cleaning and AC service',
  scheduled_date: nextMonday,
  estimated_duration: 4 // hours
})
```

## 🔒 Security & Validation

### Input Validation
- Unit name uniqueness check
- Price range validation (min: 1000, max: 100000)
- Occupancy limits (max: 20)
- Image file validation (max 5MB, JPEG/PNG only)

### Access Control
- Only admins can create/delete units
- Staff can update availability
- All users can view units

## 🧪 Testing

### Component Tests
```typescript
describe('UnitForm', () => {
  it('validates required fields', async () => {
    const { getByRole, findByText } = render(<UnitForm />)

    fireEvent.click(getByRole('button', { name: 'Save' }))

    await findByText('Unit name is required')
    await findByText('Base price is required')
  })

  it('uploads images correctly', async () => {
    // Test image upload functionality
  })
})
```

## 🚀 Performance Optimization

- Image lazy loading with blur placeholders
- Virtual scrolling for large unit lists
- Optimistic UI updates
- Cached availability calculations
- Debounced search (300ms)

## 📚 Related Documentation

- [Booking Components](/src/components/bookings/README.md)
- [Availability Engine](/src/lib/availability.ts)
- [Unit Store](/src/stores/useUnitStore.ts)
- [Database Schema](/database/SCHEMA.md#units-table)

## 🔧 Configuration

```typescript
export const unitConfig = {
  maxImagesPerUnit: 10,
  imageMaxSize: 5 * 1024 * 1024, // 5MB
  minPrice: 1000,
  maxPrice: 100000,
  maxOccupancy: 20,
  defaultCurrency: 'PHP',
  maintenanceBlockDays: 1,
  advanceBookingDays: 365
}
```