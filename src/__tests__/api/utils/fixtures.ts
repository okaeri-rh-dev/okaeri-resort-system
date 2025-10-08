/**
 * Test Data Fixtures for API Testing
 *
 * Provides consistent, reusable test data for all API tests
 */

/**
 * Test Units
 */
export const testUnits = [
  {
    unit_id: "123e4567-e89b-12d3-a456-426614174000",
    unit_name: "Deluxe Cabin",
    unit_code: "DEL-1",
    unit_type: "Deluxe",
    base_occupancy: 2,
    max_occupancy: 4,
    base_rate: 2000,
    weekend_rate: 2500,
    extra_person_rate: 500,
    amenities: "WiFi, AC, Kitchen",
    is_active: true,
  },
  {
    unit_id: "123e4567-e89b-12d3-a456-426614174001",
    unit_name: "Standard Cabin",
    unit_code: "STD-1",
    unit_type: "Standard",
    base_occupancy: 2,
    max_occupancy: 4,
    base_rate: 1500,
    weekend_rate: 1800,
    extra_person_rate: 400,
    amenities: "WiFi, AC",
    is_active: true,
  },
  {
    unit_id: "123e4567-e89b-12d3-a456-426614174002",
    unit_name: "Premium Villa",
    unit_code: "PREM-1",
    unit_type: "Premium",
    base_occupancy: 4,
    max_occupancy: 6,
    base_rate: 3500,
    weekend_rate: 4500,
    extra_person_rate: 800,
    amenities: "WiFi, AC, Kitchen, Pool",
    is_active: true,
  },
];

/**
 * Test Guest
 */
export const testGuest = {
  guest_id: "223e4567-e89b-12d3-a456-426614174000",
  guest_name: "John Doe",
  email: "john.doe@example.com",
  phone_number: "+63 912 345 6789",
  created_at: "2025-10-01T10:00:00Z",
};

/**
 * Multi-Unit Booking Request Data
 */
export const testBookingRequest = {
  primary_guest: {
    guest_name: "John Doe",
    email: "john.doe@example.com",
    contact_number: "+63 912 345 6789",
  },
  units: [
    {
      unit_id: testUnits[0].unit_id,
      guests: 2,
    },
    {
      unit_id: testUnits[1].unit_id,
      guests: 3, // 1 extra person
    },
  ],
  check_in: "2025-12-20T06:00:00Z", // Friday
  check_out: "2025-12-22T04:00:00Z", // Sunday (2 nights, includes Saturday)
  special_requests: "Early check-in if possible",
};

/**
 * Expected Booking Response
 */
export const testBookingResponse = {
  booking_id: "323e4567-e89b-12d3-a456-426614174000",
  booking_reference: "BK-2025001",
  guest_id: testGuest.guest_id,
  booking_status: "Pending",
  payment_status: "Unpaid",
  total_amount: 9700, // Calculated: (2500 + 1800) * 2 nights + 400 extra person
  ...testBookingRequest,
  created_at: "2025-10-08T10:00:00Z",
  is_multi_unit: true,
};

/**
 * Booking Units (joined data)
 */
export const testBookingUnits = [
  {
    booking_unit_id: "423e4567-e89b-12d3-a456-426614174000",
    booking_id: testBookingResponse.booking_id,
    unit_id: testUnits[0].unit_id,
    unit_name: testUnits[0].unit_name,
    unit_code: testUnits[0].unit_code,
    guest_count: 2,
    nightly_rate: 2500, // Weekend rate
    subtotal: 5000, // 2 nights * 2500
    extra_person_charge: 0,
  },
  {
    booking_unit_id: "423e4567-e89b-12d3-a456-426614174001",
    booking_id: testBookingResponse.booking_id,
    unit_id: testUnits[1].unit_id,
    unit_name: testUnits[1].unit_name,
    unit_code: testUnits[1].unit_code,
    guest_count: 3,
    nightly_rate: 1800, // Weekend rate
    subtotal: 3600, // 2 nights * 1800
    extra_person_charge: 800, // 2 nights * 400
  },
];

/**
 * Payment Record
 */
export const testPayment = {
  payment_id: "523e4567-e89b-12d3-a456-426614174000",
  booking_id: testBookingResponse.booking_id,
  payment_method: "GCash",
  amount: 5000, // Total payment amount (for refund validation)
  amount_paid: 5000,
  payment_status: "Paid",
  payment_date: "2025-10-08T11:00:00Z",
  proof_url: "https://test.supabase.co/storage/v1/object/public/payment-proofs/test-receipt.jpg",
  notes: "Initial payment",
};

/**
 * Pricing Quote Request
 */
export const testPricingRequest = {
  units: [
    { unit_id: testUnits[0].unit_id, guests: 2 },
    { unit_id: testUnits[1].unit_id, guests: 3 },
  ],
  check_in: "2025-12-20T06:00:00Z",
  check_out: "2025-12-22T04:00:00Z",
};

/**
 * Pricing Quote Response
 */
export const testPricingResponse = {
  total_amount: 9700,
  nights: 2,
  units: [
    {
      unit_id: testUnits[0].unit_id,
      base_amount: 5000, // 2 nights * 2500
      weekend_surcharge: 1000, // (2500 - 2000) * 2 nights
      extra_person_charge: 0,
      subtotal: 5000,
    },
    {
      unit_id: testUnits[1].unit_id,
      base_amount: 3600, // 2 nights * 1800
      weekend_surcharge: 600, // (1800 - 1500) * 2 nights
      extra_person_charge: 800, // 2 nights * 400 (1 extra person)
      subtotal: 4400,
    },
  ],
};

/**
 * Availability Check Request
 */
export const testAvailabilityRequest = {
  unit_ids: [testUnits[0].unit_id, testUnits[1].unit_id],
  check_in: "2025-12-20T06:00:00Z",
  check_out: "2025-12-22T04:00:00Z",
};

/**
 * Availability Check Response (all available)
 */
export const testAvailabilityResponse = {
  summary: {
    total: 2,
    available: 2,
    unavailable: 0,
  },
  units: [
    {
      unit_id: testUnits[0].unit_id,
      unit_name: testUnits[0].unit_name,
      unit_code: testUnits[0].unit_code,
      is_available: true,
      next_available_date: null,
    },
    {
      unit_id: testUnits[1].unit_id,
      unit_name: testUnits[1].unit_name,
      unit_code: testUnits[1].unit_code,
      is_available: true,
      next_available_date: null,
    },
  ],
};

/**
 * Add Unit Request
 */
export const testAddUnitRequest = {
  unit_id: testUnits[2].unit_id, // Premium Villa
  guests: 4,
  unit_notes: "Added by guest request",
};

/**
 * Remove Unit Request
 */
export const testRemoveUnitRequest = {
  unit_id: testUnits[1].unit_id,
  removal_reason: "Guest requested change",
};

/**
 * Record Payment Request
 */
export const testRecordPaymentRequest = {
  payment_method: "GCash",
  amount_paid: 5000,
  proof_url: "https://test.supabase.co/storage/v1/object/public/payment-proofs/gcash-receipt.jpg",
  notes: "Partial payment via GCash",
};

/**
 * Refund Request
 */
export const testRefundRequest = {
  refund_amount: 2000,
  refund_reason: "Cancellation",
  refund_notes: "Guest requested cancellation",
};

/**
 * Generate date helpers for testing
 */
export const dateHelpers = {
  /**
   * Get ISO date N days from now
   */
  daysFromNow: (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  },

  /**
   * Get ISO date for specific day of week (0 = Sunday, 6 = Saturday)
   */
  nextDayOfWeek: (dayOfWeek: number): string => {
    const date = new Date();
    const currentDay = date.getDay();
    const daysUntil = (dayOfWeek + 7 - currentDay) % 7;
    date.setDate(date.getDate() + daysUntil);
    return date.toISOString();
  },

  /**
   * Get Friday-Sunday weekend dates for testing
   */
  nextWeekend: (): { checkIn: string; checkOut: string } => {
    const friday = dateHelpers.nextDayOfWeek(5); // Friday
    const sunday = new Date(friday);
    sunday.setDate(sunday.getDate() + 2);
    return {
      checkIn: friday,
      checkOut: sunday.toISOString(),
    };
  },

  /**
   * Get weekday dates (Monday-Wednesday) for testing
   */
  nextWeekdays: (): { checkIn: string; checkOut: string } => {
    const monday = dateHelpers.nextDayOfWeek(1); // Monday
    const wednesday = new Date(monday);
    wednesday.setDate(wednesday.getDate() + 2);
    return {
      checkIn: monday,
      checkOut: wednesday.toISOString(),
    };
  },
};
