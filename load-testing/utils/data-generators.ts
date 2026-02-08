/**
 * Test Data Generators for Load Testing
 *
 * Provides realistic test data for load testing scenarios.
 * Generates valid Philippine phone numbers, names, and booking data.
 */

import { randomIntBetween, randomItem } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

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
  const baseName = name?.toLowerCase().replace(/\s+/g, ".") || generateName().toLowerCase().replace(/\s+/g, ".");
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
 * Generate a mock file for payment proof upload
 */
export function generatePaymentProof(): { fileName: string; fileType: string; fileSize: number } {
  const fileTypes = [
    { ext: "jpg", type: "image/jpeg", minSize: 50000, maxSize: 500000 },
    { ext: "png", type: "image/png", minSize: 100000, maxSize: 800000 },
    { ext: "pdf", type: "application/pdf", minSize: 30000, maxSize: 200000 },
  ];

  const fileInfo = randomItem(fileTypes);
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);

  return {
    fileName: `payment_proof_${timestamp}_${randomId}.${fileInfo.ext}`,
    fileType: fileInfo.type,
    fileSize: randomIntBetween(fileInfo.minSize, fileInfo.maxSize),
  };
}

/**
 * Generate a complete guest booking request body
 */
export function generateGuestBookingData(unitId: string): Record<string, unknown> {
  const name = generateName();
  const dates = generateBookingDates();
  const paymentProof = generatePaymentProof();

  return {
    guest_name: name,
    email: generateEmail(name),
    phone_number: generatePhoneNumber(),
    unit_id: unitId,
    check_in: dates.checkIn,
    check_out: dates.checkOut,
    num_guests: generateGuestCount(),
    special_requests: generateSpecialRequests(),
    turnstile_token: "mock-turnstile-token-for-testing",
    file_name: paymentProof.fileName,
    file_type: paymentProof.fileType,
    file_size: paymentProof.fileSize,
  };
}

/**
 * Generate a unique idempotency key
 */
export function generateIdempotencyKey(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `load-test-${timestamp}-${random}`;
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
