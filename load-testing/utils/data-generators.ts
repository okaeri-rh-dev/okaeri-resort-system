/**
 * Test Data Generators for Load Testing
 *
 * Provides realistic test data for load testing scenarios.
 * Generates valid Philippine phone numbers, names, and booking data.
 */

import { randomIntBetween, randomItem, uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";
import http from "k6/http";

// Common Philippine first names
const firstNames = [
  "Juan",
  "Maria",
  "Jose",
  "Ana",
  "Pedro",
  "Rosa",
  "Antonio",
  "Carmen",
  "Manuel",
  "Luz",
  "Carlos",
  "Elena",
  "Miguel",
  "Patricia",
  "Rafael",
  "Teresa",
  "Fernando",
  "Cristina",
  "Ricardo",
  "Angela",
];

// Common Philippine last names
const lastNames = [
  "Santos",
  "Reyes",
  "Cruz",
  "Garcia",
  "Ramos",
  "Mendoza",
  "Torres",
  "Flores",
  "Gonzales",
  "Lopez",
  "Hernandez",
  "Perez",
  "Martinez",
  "Rodriguez",
  "De Leon",
  "Aquino",
  "Villanueva",
  "Castillo",
  "Bautista",
  "Dizon",
];

// Email domains
const emailDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com"];

// Philippine mobile prefixes (Globe, Smart, Sun, etc.)
const phonePrefixes = ["917", "918", "919", "920", "927", "928", "929", "930", "936", "977"];

/**
 * Generate a random Philippine name
 */
export function generateName(): string {
  const firstName = randomItem(firstNames);
  const lastName = randomItem(lastNames);
  return `${firstName} ${lastName}`;
}

/**
 * Generate a random email address
 */
export function generateEmail(name?: string): string {
  const baseName =
    name?.toLowerCase().replace(/\s+/g, ".") || generateName().toLowerCase().replace(/\s+/g, ".");
  const randomNum = randomIntBetween(1, 999);
  const domain = randomItem(emailDomains);
  return `${baseName}${randomNum}@${domain}`;
}

/**
 * Generate a random Philippine phone number
 */
export function generatePhoneNumber(): string {
  const prefix = randomItem(phonePrefixes);
  const number = String(randomIntBetween(1000000, 9999999));
  return `+63 ${prefix} ${number.slice(0, 3)} ${number.slice(3)}`;
}

/**
 * Generate check-in and check-out dates
 * Check-in: 1-30 days from now
 * Check-out: 1-7 days after check-in
 */
export function generateBookingDates(): { checkIn: string; checkOut: string } {
  const now = new Date();
  const checkInDays = randomIntBetween(1, 30);
  const stayDays = randomIntBetween(1, 7);

  const checkIn = new Date(now);
  checkIn.setDate(checkIn.getDate() + checkInDays);
  checkIn.setHours(14, 0, 0, 0); // 2 PM check-in

  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + stayDays);
  checkOut.setHours(11, 0, 0, 0); // 11 AM check-out

  return {
    checkIn: checkIn.toISOString(),
    checkOut: checkOut.toISOString(),
  };
}

/**
 * Generate a random number of guests
 */
export function generateGuestCount(): number {
  return randomIntBetween(1, 6);
}

/**
 * Generate random special requests
 */
export function generateSpecialRequests(): string | undefined {
  const requests = [
    "Early check-in if possible",
    "Late check-out requested",
    "Need extra pillows",
    "Allergic to seafood",
    "Celebrating anniversary",
    "Need baby crib",
    "Quiet room preferred",
    "High floor preferred",
    undefined, // No special request
    undefined,
    undefined, // Weight toward no request
  ];
  return randomItem(requests);
}

/**
 * Generate check-in and check-out days (`YYYY-MM-DD`) for a booking request.
 * Check-in is 1-30 days out, so it is today or later in Manila time.
 */
function generateStayDays(): { checkIn: string; checkOut: string } {
  const dayMs = 24 * 60 * 60 * 1000;
  const checkIn = Date.now() + randomIntBetween(1, 30) * dayMs;
  const checkOut = checkIn + randomIntBetween(1, 7) * dayMs;
  // Manila is UTC+8 with no DST; k6 cannot import @/lib/timezone.
  const toDay = (ms: number) => {
    const manila = new Date(ms + 8 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${manila.getUTCFullYear()}-${pad(manila.getUTCMonth() + 1)}-${pad(manila.getUTCDate())}`;
  };
  return { checkIn: toDay(checkIn), checkOut: toDay(checkOut) };
}

/**
 * Generate a POST /api/guest-booking/multi-unit request body
 */
function generateMultiUnitBookingData(): Record<string, unknown> {
  const name = generateName();
  const stay = generateStayDays();

  return {
    guest_name: name,
    email: generateEmail(name),
    phone_number: generatePhoneNumber(),
    check_in: stay.checkIn,
    check_out: stay.checkOut,
    unit_requests: Array.from({ length: randomIntBetween(1, 2) }, () => ({
      guests_per_unit: generateGuestCount(),
    })),
    special_requests: generateSpecialRequests(),
    turnstile_token: "mock-turnstile-token-for-testing",
    terms_accepted: true,
    idempotency_key: uuidv4(),
  };
}

/**
 * POST a generated booking to /api/guest-booking/multi-unit
 */
export function postMultiUnitBooking(baseUrl: string, tags: Record<string, string>) {
  // 429 is the endpoint's own rate limiter (5/hour per IP), so it is an expected result.
  return http.post(
    `${baseUrl}/api/guest-booking/multi-unit`,
    JSON.stringify(generateMultiUnitBookingData()),
    {
      headers: { "Content-Type": "application/json" },
      tags,
      responseCallback: http.expectedStatuses(200, 201, 429),
    }
  );
}

/**
 * Whether a multi-unit booking response body carries a booking reference
 */
export function hasBookingReference(body: unknown): boolean {
  try {
    return !!JSON.parse(body as string).booking?.booking_reference;
  } catch {
    return false;
  }
}

/**
 * Unit IDs for testing (replace with actual unit IDs from your database)
 * These should be configured in test environment
 */
export const testUnitIds = [
  "00000000-0000-0000-0000-000000000001", // Placeholder - replace with actual
  "00000000-0000-0000-0000-000000000002",
  "00000000-0000-0000-0000-000000000003",
];

/**
 * Get a random test unit ID
 */
export function getRandomUnitId(): string {
  // Check for environment-provided unit IDs
  if (__ENV.TEST_UNIT_IDS) {
    const ids = __ENV.TEST_UNIT_IDS.split(",");
    return randomItem(ids);
  }
  return randomItem(testUnitIds);
}

export interface StatusLookup {
  booking_reference: string;
  email: string;
}

/**
 * Reference/email pairs of real bookings for status checks, read from TEST_BOOKINGS
 * ("BK-202611-ABC123:guest@example.com,...").
 */
export function getStatusLookups(): StatusLookup[] {
  if (!__ENV.TEST_BOOKINGS) {
    throw new Error("Set TEST_BOOKINGS to reference:email pairs of existing bookings");
  }
  return __ENV.TEST_BOOKINGS.split(",").map((pair) => {
    const [booking_reference, email] = pair.split(":");
    return { booking_reference, email };
  });
}
