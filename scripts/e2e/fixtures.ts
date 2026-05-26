// Single source of truth for E2E fixtures.
// Imported by seed.ts, cleanup.ts, and the Playwright spec.

export const E2E_REFERENCE_PREFIX = "E2E-";

// Dedicated auth user for the E2E spec. Created by seed, removed by cleanup.
export const E2E_USER = {
  email: "e2e-owner@e2e.local",
  password: "e2e-test-password-12345",
  role: "owner" as const,
};

// Static UUIDs so seed is idempotent and cleanup can target them directly.
export const E2E_GUEST_ID = "00000000-0000-0000-0000-0000000000e2";
export const E2E_UNIT_ID = "00000000-0000-0000-0000-000000000ee2";

export const E2E_GUEST = {
  guest_id: E2E_GUEST_ID,
  guest_name: "E2E Test Guest",
  email: "guest@e2e.local",
  phone_number: "+639170000000",
};

export const E2E_UNIT = {
  unit_id: E2E_UNIT_ID,
  unit_code: "E2E1",
  unit_name: "E2E Test Unit",
  unit_type: "Standard",
  base_occupancy: 2,
  max_occupancy: 4,
  base_rate: 2500,
  weekend_rate: 3000,
  extra_person_rate: 500,
  unit_status: "Available",
};

export interface E2EBookingFixture {
  booking_reference: string;
  booking_status: "Pending" | "Confirmed" | "Cancelled";
  payment_status: "Pending" | "Completed";
  check_in: string;
  check_out: string;
  total_amount: number;
  num_guests: number;
}

// booking_reference is varchar(20); keep all references ≤ 20 chars.
export const E2E_REF = {
  PENDING: "E2E-PENDING",
  CONFIRMED: "E2E-CONFIRMED",
  CONF_PAID: "E2E-CONF-PAID",
  CANCELLED: "E2E-CANCELLED",
} as const;

export const E2E_BOOKINGS: E2EBookingFixture[] = [
  {
    booking_reference: E2E_REF.PENDING,
    booking_status: "Pending",
    payment_status: "Pending",
    check_in: "2099-06-26",
    check_out: "2099-06-27",
    total_amount: 2500,
    num_guests: 1,
  },
  {
    booking_reference: E2E_REF.CONFIRMED,
    booking_status: "Confirmed",
    payment_status: "Pending",
    check_in: "2099-06-28",
    check_out: "2099-06-29",
    total_amount: 2500,
    num_guests: 2,
  },
  {
    booking_reference: E2E_REF.CONF_PAID,
    booking_status: "Confirmed",
    payment_status: "Completed",
    check_in: "2099-06-30",
    check_out: "2099-07-02",
    total_amount: 5000,
    num_guests: 2,
  },
  {
    booking_reference: E2E_REF.CANCELLED,
    booking_status: "Cancelled",
    payment_status: "Pending",
    check_in: "2099-07-05",
    check_out: "2099-07-06",
    total_amount: 2500,
    num_guests: 1,
  },
];
