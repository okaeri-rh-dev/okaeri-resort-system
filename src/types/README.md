# 📝 TypeScript Type Definitions

## Overview

The `/src/types/` directory contains TypeScript type definitions, interfaces, and enums that provide type safety throughout the Okaeri Resort System. These types ensure consistency, prevent runtime errors, and improve developer experience with auto-completion.

## 📁 Directory Structure

```
types/
├── index.ts        # Core application types
├── supabase.ts     # Database-related type extensions
└── reporting.ts    # Report and analytics types
```

## 📦 Type Modules

### `index.ts` - Core Application Types
**File Size**: 6.4KB
**Purpose**: Central type definitions for the application

**Key Types**:

```typescript
// Booking Types
export interface Booking {
  booking_id: string
  booking_reference: string
  unit_id: string
  guest_id: string
  check_in_date: string
  check_out_date: string
  guest_count: number
  total_amount: number
  status: BookingStatus
  payment_status: PaymentStatus
  notes?: string
  created_at: string
  updated_at: string
}

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'

// Guest Types
export interface Guest {
  guest_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  address?: string
  city?: string
  country?: string
  identification_type?: IdentificationType
  identification_number?: string
  date_of_birth?: string
  nationality?: string
  preferences?: GuestPreferences
  is_vip: boolean
  total_bookings: number
  total_spent: number
  created_at: string
  updated_at: string
}

export type IdentificationType =
  | 'passport'
  | 'drivers_license'
  | 'national_id'
  | 'other'

// Payment Types
export interface Payment {
  payment_id: string
  booking_id: string
  amount: number
  payment_method: PaymentMethod
  payment_date: string
  status: PaymentStatus
  reference_number?: string
  receipt_url?: string
  notes?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export type PaymentMethod =
  | 'cash'
  | 'credit_card'
  | 'debit_card'
  | 'bank_transfer'
  | 'gcash'
  | 'paypal'
  | 'other'

export type PaymentStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'partially_paid'

// Unit Types
export interface Unit {
  unit_id: string
  unit_name: string
  unit_type: UnitType
  max_occupancy: number
  base_price: number
  description?: string
  amenities: string[]
  images: string[]
  floor?: number
  building?: string
  view_type?: ViewType
  size_sqm?: number
  created_at: string
  updated_at: string
}

export type UnitType =
  | 'standard'
  | 'deluxe'
  | 'suite'
  | 'villa'
  | 'penthouse'

// Derived from blocks and bookings, never stored (ADR 0005)
export type CabinState = 'Blocked' | 'Booked' | 'Free'

// Expense Types
export interface Expense {
  expense_id: string
  category: ExpenseCategory
  amount: number
  description: string
  expense_date: string
  vendor?: string
  receipt_url?: string
  payment_method?: PaymentMethod
  reference_number?: string
  approved_by?: string
  status: ExpenseStatus
  created_by: string
  created_at: string
  updated_at: string
}

export type ExpenseCategory =
  | 'utilities'
  | 'maintenance'
  | 'supplies'
  | 'salaries'
  | 'marketing'
  | 'food_beverage'
  | 'equipment'
  | 'other'

export type ExpenseStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'paid'
  | 'reimbursed'
```

**Utility Types**:
```typescript
// Form Types
export type FormMode = 'create' | 'edit' | 'view'

export interface FormState<T> {
  data: T
  errors: Partial<Record<keyof T, string>>
  isSubmitting: boolean
  isDirty: boolean
}

// API Response Types
export interface ApiResponse<T> {
  data: T | null
  error: string | null
  status: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// Filter Types
export interface FilterState {
  search?: string
  status?: string[]
  dateRange?: DateRange
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface DateRange {
  start: Date | string
  end: Date | string
}
```

### `supabase.ts` - Database Type Extensions
**File Size**: 10.2KB
**Purpose**: Extends and customizes Supabase auto-generated types

**Key Extensions**:
```typescript
import { Database } from '@/database.types'

// Extend database types with relations
export type BookingWithRelations =
  Database['public']['Tables']['bookings']['Row'] & {
    unit: Database['public']['Tables']['units']['Row']
    guest: Database['public']['Tables']['guests']['Row']
    payments: Database['public']['Tables']['payments']['Row'][]
  }

// Table insert types
export type BookingInsert =
  Database['public']['Tables']['bookings']['Insert']

export type BookingUpdate =
  Database['public']['Tables']['bookings']['Update']

// View types
export type BookingCalendarView = {
  id: string
  title: string
  start: Date
  end: Date
  resource: string
  color: string
  extendedProps: {
    bookingId: string
    guestName: string
    status: BookingStatus
    amount: number
  }
}

// Function return types
export type AvailabilityCheckResult =
  Database['public']['Functions']['check_availability']['Returns']

// Enum mappings
export const StatusColors: Record<BookingStatus, string> = {
  pending: 'yellow',
  confirmed: 'green',
  checked_in: 'blue',
  checked_out: 'gray',
  cancelled: 'red'
}

// Type guards
export function isBookingWithRelations(
  booking: any
): booking is BookingWithRelations {
  return booking &&
    typeof booking === 'object' &&
    'unit' in booking &&
    'guest' in booking
}
```

### `reporting.ts` - Analytics & Reporting Types
**File Size**: 11.4KB
**Purpose**: Types for reports, analytics, and data visualization

**Report Types**:
```typescript
// Dashboard Metrics
export interface DashboardMetrics {
  totalBookings: number
  totalRevenue: number
  occupancyRate: number
  averageDailyRate: number
  totalGuests: number
  repeatGuestRate: number
  period: TimePeriod
}

// Financial Reports
export interface FinancialReport {
  revenue: RevenueBreakdown
  expenses: ExpenseBreakdown
  profit: ProfitAnalysis
  period: TimePeriod
  generatedAt: string
}

export interface RevenueBreakdown {
  roomRevenue: number
  extraCharges: number
  cancellationFees: number
  total: number
  byCategory: Record<string, number>
  byMonth: MonthlyRevenue[]
}

export interface ExpenseBreakdown {
  operational: number
  maintenance: number
  salaries: number
  utilities: number
  total: number
  byCategory: Record<ExpenseCategory, number>
  byMonth: MonthlyExpense[]
}

// Occupancy Reports
export interface OccupancyReport {
  occupancyRate: number
  availableRooms: number
  occupiedRooms: number
  blockedRooms: number
  averageStayLength: number
  byUnitType: Record<UnitType, number>
  forecast: OccupancyForecast[]
}

// Guest Analytics
export interface GuestAnalytics {
  totalGuests: number
  newGuests: number
  returningGuests: number
  vipGuests: number
  averageLifetimeValue: number
  topGuests: GuestRanking[]
  demographics: GuestDemographics
}

export interface GuestDemographics {
  byCountry: Record<string, number>
  byAgeGroup: Record<string, number>
  bySource: Record<string, number>
}

// Chart Data Types
export interface ChartData {
  labels: string[]
  datasets: Dataset[]
}

export interface Dataset {
  label: string
  data: number[]
  backgroundColor?: string | string[]
  borderColor?: string | string[]
  fill?: boolean
}

// Export Types
export interface ExportOptions {
  format: 'csv' | 'xlsx' | 'pdf' | 'json'
  dateRange?: DateRange
  filters?: FilterState
  columns?: string[]
  includeHeaders?: boolean
}
```

## 🏗️ Type Patterns

### Discriminated Unions
Use discriminated unions for type safety:
```typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string }

function handleResult(result: Result<Booking>) {
  if (result.success) {
    // TypeScript knows result.data exists
    console.log(result.data.booking_id)
  } else {
    // TypeScript knows result.error exists
    console.error(result.error)
  }
}
```

### Type Guards
Implement type guards for runtime checks:
```typescript
function isBooking(value: any): value is Booking {
  return value &&
    typeof value.booking_id === 'string' &&
    typeof value.check_in_date === 'string'
}

// Usage
if (isBooking(data)) {
  // TypeScript knows data is a Booking
  processBooking(data)
}
```

### Generic Types
Use generics for reusable types:
```typescript
interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

// Usage
const bookingState: AsyncState<Booking> = {
  data: null,
  loading: true,
  error: null
}
```

### Utility Types
Leverage TypeScript utility types:
```typescript
// Make all properties optional
type PartialBooking = Partial<Booking>

// Pick specific properties
type BookingSummary = Pick<Booking,
  'booking_id' | 'guest_id' | 'total_amount'
>

// Omit properties
type BookingWithoutDates = Omit<Booking,
  'created_at' | 'updated_at'
>

// Make properties required
type RequiredGuest = Required<Guest>
```

## 🚀 Best Practices

1. **Use Strict Types**
   ```typescript
   // ✅ Good - Specific types
   function processStatus(status: BookingStatus) {}

   // ❌ Avoid - Generic types
   function processStatus(status: string) {}
   ```

2. **Avoid `any`**
   ```typescript
   // ✅ Good - Unknown for truly unknown types
   function processData(data: unknown) {
     if (isBooking(data)) {
       // Type narrowed to Booking
     }
   }

   // ❌ Avoid - any disables type checking
   function processData(data: any) {}
   ```

3. **Export Types Separately**
   ```typescript
   // ✅ Good - Export type separately
   export type { Booking, Guest }

   // This allows tree-shaking of types
   ```

4. **Document Complex Types**
   ```typescript
   /**
    * Represents a booking with all related entities loaded
    * @property unit - The booked unit details
    * @property guest - Guest information
    * @property payments - List of associated payments
    */
   export interface BookingComplete {
     // ...
   }
   ```

## 🔒 Type Safety Features

- **Strict Null Checks**: Enabled in tsconfig
- **No Implicit Any**: Prevents accidental any types
- **Strict Property Initialization**: Ensures all properties are initialized
- **No Unused Parameters**: Keeps code clean

## 📊 Type Coverage

Current type coverage statistics:
- **Core Types**: 100% typed
- **API Responses**: 100% typed
- **Database Queries**: 100% typed (via Supabase generation)
- **Component Props**: 98% typed
- **Utility Functions**: 95% typed

## 📚 Related Documentation

- [Database Types](./database.types.ts) - Generated Supabase types with narrowed columns
- [Component Props](/src/components/README.md) - Component prop types
- [Store Types](/src/stores/README.md) - State management types
- [API Types](/api/README.md) - API request/response types

## 🔧 Type Generation

`npm run gen:types` writes `database.generated.ts` from the local migrations (needs `supabase start`). Never edit it by hand.

Import from `database.types.ts` instead: it re-exports the generated types with CHECK-constrained text columns narrowed (`booking_status` → `BookingStatus`). A lint rule blocks direct imports of the generated file, and `src/__tests__/architecture/booking-status-parity.test.ts` keeps `BOOKING_STATUSES` equal to the CHECK constraint.

## 🎯 Type Hierarchy

```
Database.types (Generated)
    ↓
supabase.ts (Extensions)
    ↓
index.ts (Application Types)
    ↓
Component Props / Store Types / API Types
```