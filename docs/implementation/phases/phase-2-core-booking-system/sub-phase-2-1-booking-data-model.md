# Sub-Phase 2.1: Booking Data Model & API Design

## Overview
This sub-phase establishes the comprehensive data model for the booking system, including database schemas, TypeScript interfaces, API specifications, and validation rules. It creates the foundation for handling multi-source bookings with payment tracking.

## Objectives
1. Design complete booking and payment database schemas
2. Create TypeScript interfaces with full type safety
3. Define API endpoint specifications
4. Implement Zod validation schemas
5. Setup multi-source booking support architecture

## Technical Requirements

### Core Dependencies
```json
{
  "dependencies": {
    "zod": "^3.24.0",
    "date-fns": "^4.1.0",
    "nanoid": "^5.0.0",
    "decimal.js": "^10.4.0"
  },
  "devDependencies": {
    "@types/decimal.js": "^7.4.0"
  }
}
```

## Database Schema Design

### Booking Table Schema
```sql
-- Project-specific booking table (in project schema)
CREATE TABLE bookings (
  -- Primary identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference VARCHAR(100) UNIQUE NOT NULL,
  
  -- Source information
  source VARCHAR(50) NOT NULL CHECK (source IN ('airbnb', 'facebook', 'direct', 'booking.com', 'agoda')),
  platform_booking_id VARCHAR(200), -- External platform's booking ID
  platform_confirmation_code VARCHAR(100),
  
  -- Guest information
  guest_name VARCHAR(200) NOT NULL,
  guest_email VARCHAR(255),
  guest_phone VARCHAR(50),
  guest_country VARCHAR(100),
  guest_language VARCHAR(10) DEFAULT 'en',
  guest_id_type VARCHAR(50), -- passport, driver_license, national_id
  guest_id_number VARCHAR(100),
  guest_details JSONB DEFAULT '{}',
  
  -- Booking dates and times
  booking_date TIMESTAMP NOT NULL DEFAULT NOW(),
  checkin_date DATE NOT NULL,
  checkout_date DATE NOT NULL,
  checkin_time TIME DEFAULT '14:00',
  checkout_time TIME DEFAULT '11:00',
  nights INTEGER GENERATED ALWAYS AS (checkout_date - checkin_date) STORED,
  
  -- Guest counts
  guest_count INTEGER NOT NULL CHECK (guest_count > 0),
  adult_count INTEGER NOT NULL DEFAULT 1,
  child_count INTEGER DEFAULT 0,
  infant_count INTEGER DEFAULT 0,
  
  -- Room/Property details
  room_type VARCHAR(100),
  room_numbers TEXT[], -- Array of assigned room numbers
  property_id UUID, -- For multi-property support
  
  -- Pricing
  base_amount DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  service_fee DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PHP',
  exchange_rate DECIMAL(10,6) DEFAULT 1.0,
  
  -- Payment tracking
  deposit_required DECIMAL(10,2) DEFAULT 0,
  deposit_paid DECIMAL(10,2) DEFAULT 0,
  balance_amount DECIMAL(10,2) GENERATED ALWAYS AS (total_amount - deposit_paid) STORED,
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded')),
  payment_due_date DATE,
  
  -- Status tracking
  booking_status VARCHAR(50) DEFAULT 'pending' CHECK (booking_status IN (
    'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'
  )),
  confirmation_sent_at TIMESTAMP,
  reminder_sent_at TIMESTAMP,
  
  -- Special requests and notes
  special_requests TEXT,
  dietary_restrictions TEXT,
  arrival_method VARCHAR(50), -- car, taxi, bus, flight
  arrival_details TEXT,
  internal_notes TEXT,
  
  -- Metadata
  tags TEXT[],
  custom_fields JSONB DEFAULT '{}',
  channel_commission DECIMAL(5,2), -- Platform commission percentage
  net_amount DECIMAL(10,2) GENERATED ALWAYS AS (
    total_amount - (total_amount * COALESCE(channel_commission, 0) / 100)
  ) STORED,
  
  -- Audit fields
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Cancellation fields
  cancelled_at TIMESTAMP,
  cancelled_by UUID REFERENCES users(id),
  cancellation_reason TEXT,
  cancellation_fee DECIMAL(10,2),
  refund_amount DECIMAL(10,2),
  
  -- Constraints
  CONSTRAINT valid_dates CHECK (checkout_date > checkin_date),
  CONSTRAINT valid_amounts CHECK (
    total_amount >= 0 AND 
    deposit_required >= 0 AND 
    deposit_paid >= 0 AND
    deposit_paid <= total_amount
  ),
  CONSTRAINT valid_guest_counts CHECK (
    guest_count = adult_count + child_count + infant_count
  )
);

-- Indexes for performance
CREATE INDEX idx_bookings_checkin_date ON bookings(checkin_date);
CREATE INDEX idx_bookings_checkout_date ON bookings(checkout_date);
CREATE INDEX idx_bookings_status ON bookings(booking_status) WHERE booking_status != 'cancelled';
CREATE INDEX idx_bookings_source ON bookings(source);
CREATE INDEX idx_bookings_guest_name ON bookings(guest_name);
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);
CREATE INDEX idx_bookings_date_range ON bookings(checkin_date, checkout_date);
```

### Payment Table Schema
```sql
CREATE TABLE payments (
  -- Primary identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  payment_reference VARCHAR(100) UNIQUE NOT NULL,
  
  -- Payment details
  payment_type VARCHAR(50) NOT NULL CHECK (payment_type IN ('deposit', 'balance', 'additional', 'refund')),
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN (
    'cash', 'gcash', 'bank_transfer', 'credit_card', 'paypal', 'paymaya', 'grab_pay'
  )),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PHP',
  
  -- Transaction details
  transaction_id VARCHAR(200), -- External transaction ID
  transaction_date TIMESTAMP NOT NULL DEFAULT NOW(),
  confirmation_number VARCHAR(100),
  
  -- Receipt/Proof
  receipt_url VARCHAR(500),
  receipt_uploaded_at TIMESTAMP,
  receipt_metadata JSONB DEFAULT '{}',
  
  -- Status
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN (
    'pending', 'processing', 'completed', 'failed', 'refunded'
  )),
  verified_at TIMESTAMP,
  verified_by UUID REFERENCES users(id),
  
  -- Notes
  notes TEXT,
  
  -- Audit fields
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_status ON payments(payment_status);
CREATE INDEX idx_payments_transaction_date ON payments(transaction_date DESC);
```

### Booking Timeline Events Table
```sql
CREATE TABLE booking_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  
  event_type VARCHAR(100) NOT NULL,
  event_title VARCHAR(200) NOT NULL,
  event_description TEXT,
  event_data JSONB DEFAULT '{}',
  
  -- Event metadata
  severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'success')),
  is_system_generated BOOLEAN DEFAULT false,
  
  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_timeline_booking_id ON booking_timeline(booking_id);
CREATE INDEX idx_timeline_created_at ON booking_timeline(created_at DESC);
```

## TypeScript Type Definitions

### Core Booking Types
```typescript
// src/types/booking.ts
import { z } from 'zod'
import { Decimal } from 'decimal.js'

export type BookingSource = 'airbnb' | 'facebook' | 'direct' | 'booking.com' | 'agoda'
export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded'
export type PaymentType = 'deposit' | 'balance' | 'additional' | 'refund'
export type PaymentMethod = 'cash' | 'gcash' | 'bank_transfer' | 'credit_card' | 'paypal' | 'paymaya' | 'grab_pay'

export interface Booking {
  id: string
  bookingReference: string
  
  // Source
  source: BookingSource
  platformBookingId?: string
  platformConfirmationCode?: string
  
  // Guest
  guestName: string
  guestEmail?: string
  guestPhone?: string
  guestCountry?: string
  guestLanguage: string
  guestIdType?: string
  guestIdNumber?: string
  guestDetails: Record<string, any>
  
  // Dates
  bookingDate: Date
  checkinDate: Date
  checkoutDate: Date
  checkinTime: string
  checkoutTime: string
  nights: number
  
  // Counts
  guestCount: number
  adultCount: number
  childCount: number
  infantCount: number
  
  // Room
  roomType?: string
  roomNumbers: string[]
  propertyId?: string
  
  // Pricing
  baseAmount: Decimal
  discountAmount: Decimal
  taxAmount: Decimal
  serviceFee: Decimal
  totalAmount: Decimal
  currency: string
  exchangeRate: Decimal
  
  // Payment
  depositRequired: Decimal
  depositPaid: Decimal
  balanceAmount: Decimal
  paymentStatus: PaymentStatus
  paymentDueDate?: Date
  
  // Status
  bookingStatus: BookingStatus
  confirmationSentAt?: Date
  reminderSentAt?: Date
  
  // Additional
  specialRequests?: string
  dietaryRestrictions?: string
  arrivalMethod?: string
  arrivalDetails?: string
  internalNotes?: string
  
  // Metadata
  tags: string[]
  customFields: Record<string, any>
  channelCommission?: number
  netAmount: Decimal
  
  // Audit
  createdBy: string
  updatedBy?: string
  createdAt: Date
  updatedAt: Date
  
  // Cancellation
  cancelledAt?: Date
  cancelledBy?: string
  cancellationReason?: string
  cancellationFee?: Decimal
  refundAmount?: Decimal
}

export interface Payment {
  id: string
  bookingId: string
  paymentReference: string
  
  paymentType: PaymentType
  paymentMethod: PaymentMethod
  amount: Decimal
  currency: string
  
  transactionId?: string
  transactionDate: Date
  confirmationNumber?: string
  
  receiptUrl?: string
  receiptUploadedAt?: Date
  receiptMetadata: Record<string, any>
  
  paymentStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
  verifiedAt?: Date
  verifiedBy?: string
  
  notes?: string
  
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface BookingTimelineEvent {
  id: string
  bookingId: string
  
  eventType: string
  eventTitle: string
  eventDescription?: string
  eventData: Record<string, any>
  
  severity: 'info' | 'warning' | 'error' | 'success'
  isSystemGenerated: boolean
  
  createdBy?: string
  createdAt: Date
}
```

### Data Transfer Objects (DTOs)
```typescript
// src/types/booking-dto.ts
export interface CreateBookingDto {
  source: BookingSource
  platformBookingId?: string
  
  guestName: string
  guestEmail?: string
  guestPhone?: string
  guestCount: number
  
  checkinDate: string // ISO date string
  checkoutDate: string // ISO date string
  
  roomType?: string
  totalAmount: number
  depositRequired?: number
  
  specialRequests?: string
  internalNotes?: string
}

export interface UpdateBookingDto {
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  guestCount?: number
  
  checkinDate?: string
  checkoutDate?: string
  
  roomType?: string
  roomNumbers?: string[]
  
  bookingStatus?: BookingStatus
  paymentStatus?: PaymentStatus
  
  specialRequests?: string
  internalNotes?: string
  tags?: string[]
}

export interface CreatePaymentDto {
  bookingId: string
  paymentType: PaymentType
  paymentMethod: PaymentMethod
  amount: number
  
  transactionId?: string
  confirmationNumber?: string
  notes?: string
}

export interface BookingFilterDto {
  status?: BookingStatus
  source?: BookingSource
  checkinDateFrom?: string
  checkinDateTo?: string
  checkoutDateFrom?: string
  checkoutDateTo?: string
  guestName?: string
  paymentStatus?: PaymentStatus
  tags?: string[]
}
```

## Zod Validation Schemas

### Booking Validation
```typescript
// src/lib/validations/booking.ts
import { z } from 'zod'
import { isValid, parseISO, isBefore, isAfter } from 'date-fns'

const BookingSourceEnum = z.enum(['airbnb', 'facebook', 'direct', 'booking.com', 'agoda'])
const BookingStatusEnum = z.enum(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'])
const PaymentStatusEnum = z.enum(['pending', 'partial', 'paid', 'refunded'])

export const CreateBookingSchema = z.object({
  source: BookingSourceEnum,
  platformBookingId: z.string().optional(),
  
  guestName: z.string().min(1).max(200),
  guestEmail: z.string().email().optional().or(z.literal('')),
  guestPhone: z.string().regex(/^[+\d\s()-]+$/).optional().or(z.literal('')),
  
  checkinDate: z.string().refine((date) => isValid(parseISO(date)), {
    message: 'Invalid check-in date',
  }),
  checkoutDate: z.string().refine((date) => isValid(parseISO(date)), {
    message: 'Invalid check-out date',
  }),
  
  guestCount: z.number().int().min(1).max(50),
  adultCount: z.number().int().min(1).default(1),
  childCount: z.number().int().min(0).default(0),
  infantCount: z.number().int().min(0).default(0),
  
  roomType: z.string().optional(),
  
  baseAmount: z.number().positive(),
  discountAmount: z.number().min(0).default(0),
  taxAmount: z.number().min(0).default(0),
  serviceFee: z.number().min(0).default(0),
  totalAmount: z.number().positive(),
  
  depositRequired: z.number().min(0).optional(),
  
  specialRequests: z.string().max(1000).optional(),
  dietaryRestrictions: z.string().max(500).optional(),
  arrivalMethod: z.string().optional(),
  internalNotes: z.string().max(1000).optional(),
  
  tags: z.array(z.string()).optional(),
}).refine((data) => {
  const checkin = parseISO(data.checkinDate)
  const checkout = parseISO(data.checkoutDate)
  return isAfter(checkout, checkin)
}, {
  message: 'Check-out date must be after check-in date',
  path: ['checkoutDate'],
}).refine((data) => {
  return data.guestCount === (data.adultCount + data.childCount + data.infantCount)
}, {
  message: 'Guest count must equal sum of adults, children, and infants',
  path: ['guestCount'],
})

export const UpdateBookingSchema = CreateBookingSchema.partial().extend({
  bookingStatus: BookingStatusEnum.optional(),
  paymentStatus: PaymentStatusEnum.optional(),
  roomNumbers: z.array(z.string()).optional(),
})

export const BookingFilterSchema = z.object({
  status: BookingStatusEnum.optional(),
  source: BookingSourceEnum.optional(),
  checkinDateFrom: z.string().optional(),
  checkinDateTo: z.string().optional(),
  checkoutDateFrom: z.string().optional(),
  checkoutDateTo: z.string().optional(),
  guestName: z.string().optional(),
  paymentStatus: PaymentStatusEnum.optional(),
  tags: z.array(z.string()).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['checkinDate', 'checkoutDate', 'createdAt', 'guestName', 'totalAmount']).default('checkinDate'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})
```

### Payment Validation
```typescript
// src/lib/validations/payment.ts
import { z } from 'zod'

const PaymentTypeEnum = z.enum(['deposit', 'balance', 'additional', 'refund'])
const PaymentMethodEnum = z.enum(['cash', 'gcash', 'bank_transfer', 'credit_card', 'paypal', 'paymaya', 'grab_pay'])

export const CreatePaymentSchema = z.object({
  bookingId: z.string().uuid(),
  paymentType: PaymentTypeEnum,
  paymentMethod: PaymentMethodEnum,
  amount: z.number().positive(),
  currency: z.string().length(3).default('PHP'),
  
  transactionId: z.string().optional(),
  confirmationNumber: z.string().optional(),
  
  notes: z.string().max(500).optional(),
})

export const UpdatePaymentSchema = z.object({
  paymentStatus: z.enum(['pending', 'processing', 'completed', 'failed', 'refunded']).optional(),
  transactionId: z.string().optional(),
  confirmationNumber: z.string().optional(),
  receiptUrl: z.string().url().optional(),
  notes: z.string().max(500).optional(),
})
```

## API Endpoint Specifications

### Booking Endpoints
```typescript
// API Route Specifications
interface BookingAPIEndpoints {
  // List bookings with filters
  'GET /api/projects/:projectId/bookings': {
    query: BookingFilterDto
    response: {
      data: Booking[]
      meta: PaginationMeta
    }
  }
  
  // Get single booking
  'GET /api/projects/:projectId/bookings/:id': {
    response: Booking
  }
  
  // Create booking
  'POST /api/projects/:projectId/bookings': {
    body: CreateBookingDto
    response: Booking
  }
  
  // Update booking
  'PUT /api/projects/:projectId/bookings/:id': {
    body: UpdateBookingDto
    response: Booking
  }
  
  // Delete booking
  'DELETE /api/projects/:projectId/bookings/:id': {
    response: { success: boolean }
  }
  
  // Bulk import bookings
  'POST /api/projects/:projectId/bookings/import': {
    body: {
      source: BookingSource
      data: CreateBookingDto[]
    }
    response: {
      imported: number
      failed: number
      errors: ImportError[]
    }
  }
  
  // Get booking availability
  'GET /api/projects/:projectId/bookings/availability': {
    query: {
      startDate: string
      endDate: string
      roomType?: string
    }
    response: {
      dates: AvailabilityDate[]
    }
  }
}

// Payment Endpoints
interface PaymentAPIEndpoints {
  // List payments for booking
  'GET /api/projects/:projectId/bookings/:bookingId/payments': {
    response: Payment[]
  }
  
  // Create payment
  'POST /api/projects/:projectId/payments': {
    body: CreatePaymentDto
    response: Payment
  }
  
  // Update payment
  'PUT /api/projects/:projectId/payments/:id': {
    body: UpdatePaymentSchema
    response: Payment
  }
  
  // Upload receipt
  'POST /api/projects/:projectId/payments/:id/receipt': {
    body: FormData // File upload
    response: {
      receiptUrl: string
    }
  }
}
```

## Test Requirements

### Unit Tests
```typescript
// tests/unit/validations/booking.test.ts
import { describe, it, expect } from 'vitest'
import { CreateBookingSchema } from '@/lib/validations/booking'

describe('Booking Validation', () => {
  it('validates correct booking data', () => {
    const validData = {
      source: 'airbnb',
      guestName: 'John Doe',
      guestEmail: 'john@example.com',
      checkinDate: '2025-02-01',
      checkoutDate: '2025-02-03',
      guestCount: 2,
      adultCount: 2,
      childCount: 0,
      infantCount: 0,
      baseAmount: 5000,
      totalAmount: 5000,
    }
    
    const result = CreateBookingSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })
  
  it('rejects invalid date range', () => {
    const invalidData = {
      source: 'direct',
      guestName: 'Jane Doe',
      checkinDate: '2025-02-03',
      checkoutDate: '2025-02-01', // Before check-in
      guestCount: 1,
      adultCount: 1,
      childCount: 0,
      infantCount: 0,
      totalAmount: 3000,
    }
    
    const result = CreateBookingSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toContain('checkoutDate')
  })
  
  it('validates guest count consistency', () => {
    const inconsistentData = {
      source: 'facebook',
      guestName: 'Test Guest',
      checkinDate: '2025-02-01',
      checkoutDate: '2025-02-02',
      guestCount: 5,
      adultCount: 2,
      childCount: 1,
      infantCount: 0, // Sum is 3, not 5
      totalAmount: 4000,
    }
    
    const result = CreateBookingSchema.safeParse(inconsistentData)
    expect(result.success).toBe(false)
  })
})
```

## Agent Validation Checklist

### postgres-serverless-architect Validation
- [ ] Database schema optimized for serverless
- [ ] Proper indexing for common queries
- [ ] Computed columns for derived values
- [ ] Referential integrity maintained
- [ ] JSONB used appropriately for flexibility
- [ ] Check constraints comprehensive
- [ ] Performance considerations addressed
- [ ] Multi-tenant isolation ensured

### vercel-resort-api-architect Validation
- [ ] API endpoints follow RESTful conventions
- [ ] Request/response types fully defined
- [ ] Error handling specifications complete
- [ ] Pagination strategy implemented
- [ ] Filtering and sorting capabilities
- [ ] Bulk operations supported
- [ ] File upload handling specified
- [ ] Rate limiting considerations

## Success Criteria
1. **Database Schema** - All tables created with proper constraints
2. **Type Safety** - 100% TypeScript coverage with no any types
3. **Validation** - Zod schemas covering all input scenarios
4. **API Design** - RESTful endpoints with clear specifications
5. **Multi-Source** - Support for all booking sources
6. **Payment Tracking** - Comprehensive payment data model
7. **Performance** - Indexes optimized for common queries
8. **Documentation** - Complete API and type documentation

## Deliverables
- [ ] Complete database schema SQL
- [ ] TypeScript type definitions
- [ ] Zod validation schemas
- [ ] API endpoint specifications
- [ ] Test suite for validations
- [ ] Migration scripts
- [ ] API documentation
- [ ] Data model diagram

## Completion Checklist
- [ ] All database tables created
- [ ] TypeScript types defined
- [ ] Validation schemas complete
- [ ] API specifications documented
- [ ] Unit tests passing
- [ ] Indexes optimized
- [ ] Constraints verified
- [ ] Agent validations passed
- [ ] Documentation complete
- [ ] Ready for Sub-Phase 2.2

---

*Sub-Phase 2.1 establishes the robust data foundation for the entire booking system, ensuring type safety, data integrity, and scalability.*