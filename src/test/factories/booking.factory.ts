/**
 * Booking Test Data Factory
 * Type-safe booking data generation using Zod schemas for consistent testing
 */

import { faker } from "@faker-js/faker";
import {
  CreateBookingSchema,
  BookingSchema,
  type CreateBookingInput,
  type BookingInput,
} from "@/types/schemas";
import { BOOKING_STATUS, PAYMENT_STATUS, PAYMENT_METHODS } from "@/types/database";

export interface BookingFactoryOptions {
  id?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  checkInDate?: string;
  checkOutDate?: string;
  numberOfGuests?: number;
  status?: keyof typeof BOOKING_STATUS;
  paymentStatus?: keyof typeof PAYMENT_STATUS;
  totalAmount?: string;
  paidAmount?: string;
  source?: string;
  roomType?: string;
  specialRequests?: string;
  seed?: string; // For deterministic generation
}

let bookingIdCounter = 1;

/**
 * Create deterministic faker instance with seed
 */
function createSeededFaker(seed?: string): typeof faker {
  if (seed) {
    faker.seed(Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0));
  }
  return faker;
}

/**
 * Generate a mock booking code in Philippine format
 */
function generateBookingCode(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const sequence = String(bookingIdCounter++).padStart(4, "0");
  return `OKR${year}${month}${sequence}`;
}

/**
 * Calculate nights between check-in and check-out dates
 */
function calculateNights(checkIn: string, checkOut: string): number {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  return Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate realistic total amount based on nights and guests
 */
function calculateTotalAmount(nights: number, guests: number, baseRate: number = 3000): string {
  const subtotal = baseRate * nights;
  const guestSurcharge = guests > 2 ? (guests - 2) * 500 * nights : 0;
  const tax = (subtotal + guestSurcharge) * 0.12; // 12% VAT in Philippines
  const serviceCharge = (subtotal + guestSurcharge) * 0.1; // 10% service charge

  const total = subtotal + guestSurcharge + tax + serviceCharge;
  return total.toFixed(2);
}

/**
 * Create a test booking with Zod validation
 */
export function createBooking(overrides?: BookingFactoryOptions): BookingInput {
  const seededFaker = createSeededFaker(overrides?.seed);

  // Generate dates
  const checkInDate =
    overrides?.checkInDate || seededFaker.date.future().toISOString().split("T")[0];
  const checkOutDate =
    overrides?.checkOutDate ||
    (() => {
      const checkIn = new Date(checkInDate);
      const nights = seededFaker.number.int({ min: 1, max: 7 });
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + nights);
      return checkOut.toISOString().split("T")[0];
    })();

  const nights = calculateNights(checkInDate, checkOutDate);
  const numberOfGuests = overrides?.numberOfGuests || seededFaker.number.int({ min: 1, max: 8 });
  const totalAmount = overrides?.totalAmount || calculateTotalAmount(nights, numberOfGuests);
  const paidAmount = overrides?.paidAmount || "0.00";
  const balanceAmount = (parseFloat(totalAmount) - parseFloat(paidAmount)).toFixed(2);

  const bookingData: BookingInput = {
    id: overrides?.id || `booking-test-${bookingIdCounter++}`,
    bookingCode: generateBookingCode(),
    guestName: overrides?.guestName || seededFaker.person.fullName(),
    guestEmail: overrides?.guestEmail || seededFaker.internet.email(),
    guestPhone: overrides?.guestPhone || "+63" + seededFaker.string.numeric(10),
    guestAddress: seededFaker.location.streetAddress({ useFullAddress: true }) + ", Philippines",
    numberOfGuests,
    numberOfChildren: seededFaker.number.int({ min: 0, max: Math.floor(numberOfGuests / 2) }),
    checkInDate,
    checkOutDate,
    checkInTime: "14:00:00", // Standard check-in time
    checkOutTime: "11:00:00", // Standard check-out time
    roomType:
      overrides?.roomType ||
      seededFaker.helpers.arrayElement(["Villa", "Suite", "Deluxe Room", "Family Room"]),
    roomNumber: seededFaker.helpers.arrayElement(["V1", "V2", "S1", "S2", "R101", "R102"]),
    basePrice: (parseFloat(totalAmount) * 0.8).toFixed(2), // 80% of total as base
    additionalCharges: (parseFloat(totalAmount) * 0.1).toFixed(2), // 10% additional charges
    discountAmount: "0.00",
    taxAmount: (parseFloat(totalAmount) * 0.12).toFixed(2), // 12% tax
    totalAmount,
    depositAmount: (parseFloat(totalAmount) * 0.3).toFixed(2), // 30% deposit
    paidAmount,
    balanceAmount,
    status: overrides?.status || BOOKING_STATUS.CONFIRMED,
    paymentStatus:
      parseFloat(paidAmount) === 0
        ? PAYMENT_STATUS.PENDING
        : parseFloat(paidAmount) >= parseFloat(totalAmount)
          ? PAYMENT_STATUS.PAID
          : PAYMENT_STATUS.PARTIAL,
    specialRequests: overrides?.specialRequests || seededFaker.lorem.sentence(),
    internalNotes: seededFaker.lorem.paragraph(),
    cancellationReason: null,
    cancelledAt: null,
    cancelledBy: null,
    source:
      overrides?.source ||
      seededFaker.helpers.arrayElement(["direct", "airbnb", "booking.com", "website"]),
    metadata: {
      generatedBy: "test-factory",
      seed: overrides?.seed || "default",
    },
    createdBy: null,
    updatedBy: null,
    createdAt: seededFaker.date.past().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Validate with Zod schema
  const validated = BookingSchema.parse(bookingData);
  return validated;
}

/**
 * Create booking data for creation (subset of full booking)
 */
export function createBookingData(overrides?: BookingFactoryOptions): CreateBookingInput {
  const fullBooking = createBooking(overrides);

  const createData: CreateBookingInput = {
    guestName: fullBooking.guestName,
    guestEmail: fullBooking.guestEmail,
    guestPhone: fullBooking.guestPhone,
    guestAddress: fullBooking.guestAddress,
    numberOfGuests: fullBooking.numberOfGuests,
    numberOfChildren: fullBooking.numberOfChildren,
    checkInDate: fullBooking.checkInDate,
    checkOutDate: fullBooking.checkOutDate,
    checkInTime: fullBooking.checkInTime,
    checkOutTime: fullBooking.checkOutTime,
    roomType: fullBooking.roomType,
    roomNumber: fullBooking.roomNumber,
    basePrice: fullBooking.basePrice,
    additionalCharges: fullBooking.additionalCharges,
    discountAmount: fullBooking.discountAmount,
    taxAmount: fullBooking.taxAmount,
    totalAmount: fullBooking.totalAmount,
    depositAmount: fullBooking.depositAmount,
    specialRequests: fullBooking.specialRequests,
    internalNotes: fullBooking.internalNotes,
    source: fullBooking.source,
    paidAmount: fullBooking.paidAmount,
  };

  // Validate with creation schema
  const validated = CreateBookingSchema.parse(createData);
  return validated;
}

/**
 * Create multiple bookings with sequential dates to avoid conflicts
 */
export function createBookings(count: number, overrides?: BookingFactoryOptions): BookingInput[] {
  const bookings: BookingInput[] = [];
  const baseDate = new Date();

  for (let i = 0; i < count; i++) {
    const checkInDate = new Date(baseDate);
    checkInDate.setDate(baseDate.getDate() + i * 4); // 4-day spacing

    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkInDate.getDate() + faker.number.int({ min: 1, max: 3 }));

    const booking = createBooking({
      ...overrides,
      checkInDate: checkInDate.toISOString().split("T")[0],
      checkOutDate: checkOutDate.toISOString().split("T")[0],
      seed: overrides?.seed ? `${overrides.seed}-${i}` : `booking-${i}`,
    });

    bookings.push(booking);
  }

  return bookings;
}

/**
 * Create specific booking scenarios for testing
 */
export const bookingScenarios = {
  // Confirmed booking with full payment
  confirmedPaid: (overrides?: BookingFactoryOptions): BookingInput =>
    createBooking({
      ...overrides,
      status: BOOKING_STATUS.CONFIRMED,
      paymentStatus: PAYMENT_STATUS.PAID,
      paidAmount: overrides?.totalAmount || "5000.00",
      totalAmount: overrides?.totalAmount || "5000.00",
    }),

  // Pending booking with no payment
  pendingUnpaid: (overrides?: BookingFactoryOptions): BookingInput =>
    createBooking({
      ...overrides,
      status: BOOKING_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.PENDING,
      paidAmount: "0.00",
    }),

  // Cancelled booking
  cancelled: (overrides?: BookingFactoryOptions): BookingInput =>
    createBooking({
      ...overrides,
      status: BOOKING_STATUS.CANCELLED,
      cancellationReason: "Guest requested cancellation",
      cancelledAt: new Date().toISOString(),
      cancelledBy: "user-test-1",
    }),

  // Long stay booking (7+ nights)
  longStay: (overrides?: BookingFactoryOptions): BookingInput => {
    const checkInDate = new Date().toISOString().split("T")[0];
    const checkOutDate = new Date();
    checkOutDate.setDate(checkOutDate.getDate() + 10);

    return createBooking({
      ...overrides,
      checkInDate,
      checkOutDate: checkOutDate.toISOString().split("T")[0],
      numberOfGuests: 4,
    });
  },

  // Group booking (large party)
  groupBooking: (overrides?: BookingFactoryOptions): BookingInput =>
    createBooking({
      ...overrides,
      numberOfGuests: 8,
      roomType: "Family Villa",
      specialRequests: "Large group celebration, need extra chairs and tables",
    }),

  // Last minute booking (check-in today)
  lastMinute: (overrides?: BookingFactoryOptions): BookingInput => {
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    return createBooking({
      ...overrides,
      checkInDate: today,
      checkOutDate: tomorrow.toISOString().split("T")[0],
      source: "phone",
    });
  },
};

/**
 * Reset booking ID counter for consistent testing
 */
export function resetBookingIdCounter(): void {
  bookingIdCounter = 1;
  faker.seed(123); // Reset faker seed
}

/**
 * Generate bookings for specific date range
 */
export function createBookingsInRange(
  startDate: string,
  endDate: string,
  count: number,
  overrides?: BookingFactoryOptions
): BookingInput[] {
  const bookings: BookingInput[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  for (let i = 0; i < count; i++) {
    const randomOffset = faker.number.int({ min: 0, max: Math.max(0, totalDays - 3) });
    const checkInDate = new Date(start);
    checkInDate.setDate(start.getDate() + randomOffset);

    const checkOutDate = new Date(checkInDate);
    checkOutDate.setDate(checkInDate.getDate() + faker.number.int({ min: 1, max: 3 }));

    // Ensure booking ends within range
    if (checkOutDate <= end) {
      const booking = createBooking({
        ...overrides,
        checkInDate: checkInDate.toISOString().split("T")[0],
        checkOutDate: checkOutDate.toISOString().split("T")[0],
        seed: `range-${i}`,
      });
      bookings.push(booking);
    }
  }

  return bookings;
}
