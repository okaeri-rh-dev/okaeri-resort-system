/**
 * Booking Data Seeder
 * Creates realistic booking data for Philippine resort operations
 */

import type { Booking } from "@/types/common";
import { BookingStatus, PaymentStatus, BookingSource, PaymentMethod } from "@/types/common";
import { testProjects } from "./projects";

/**
 * Generate realistic booking data with Philippine context
 */
function generateBookingData(): Booking[] {
  const bookings: Booking[] = [];
  let bookingCounter = 1;

  // Helper to create booking ID
  const createBookingId = () => `booking_${String(bookingCounter++).padStart(3, "0")}`;

  // Helper to create dates relative to today
  const daysFromNow = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  };

  // Okaeri Beach Resort bookings (Main property)
  const mainResortBookings: Booking[] = [
    // Confirmed upcoming bookings
    {
      id: createBookingId(),
      projectId: testProjects.mainResort.id,
      propertyId: "property_villa_001",
      guestName: "Juan Carlos Dela Cruz",
      guestEmail: "juan.delacruz@gmail.com",
      guestPhone: "+639171234567",
      checkIn: daysFromNow(3),
      checkOut: daysFromNow(6),
      nights: 3,
      guests: 2,
      status: BookingStatus.CONFIRMED,
      source: BookingSource.DIRECT,
      totalAmount: 22500, // ₱7,500 per night
      paidAmount: 11250, // 50% deposit
      paymentStatus: PaymentStatus.PARTIAL,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      notes: "Anniversary celebration. Requested oceanview villa.",
      specialRequests: "Late check-in around 8PM, flower arrangement for room",
      createdAt: "2024-01-10T14:30:00.000Z",
      updatedAt: "2024-01-12T09:15:00.000Z",
    },
    {
      id: createBookingId(),
      projectId: testProjects.mainResort.id,
      propertyId: "property_suite_001",
      guestName: "Maria Elena Santos-Reyes",
      guestEmail: "maria.santos@yahoo.com.ph",
      guestPhone: "+639281234567",
      checkIn: daysFromNow(7),
      checkOut: daysFromNow(11),
      nights: 4,
      guests: 4,
      status: BookingStatus.CONFIRMED,
      source: BookingSource.AIRBNB,
      totalAmount: 40000, // ₱10,000 per night
      paidAmount: 40000, // Fully paid
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      notes: "Family vacation with teenage children. Booked through Airbnb.",
      specialRequests: "Extra towels, refrigerator stocking, airport transfer",
      createdAt: "2024-01-08T10:45:00.000Z",
      updatedAt: "2024-01-14T16:20:00.000Z",
    },
    {
      id: createBookingId(),
      projectId: testProjects.mainResort.id,
      propertyId: "property_room_001",
      guestName: "Michael John Taylor",
      guestEmail: "michael.taylor@gmail.com",
      guestPhone: "+639171234568",
      checkIn: daysFromNow(14),
      checkOut: daysFromNow(21),
      nights: 7,
      guests: 1,
      status: BookingStatus.CONFIRMED,
      source: BookingSource.BOOKING_COM,
      totalAmount: 35000, // ₱5,000 per night (weekly discount)
      paidAmount: 17500, // 50% deposit
      paymentStatus: PaymentStatus.PARTIAL,
      paymentMethod: PaymentMethod.PAYPAL,
      notes: "Solo traveler from Australia. Long-term booking.",
      specialRequests: "Quiet room, work desk, strong WiFi for remote work",
      createdAt: "2024-01-05T08:20:00.000Z",
      updatedAt: "2024-01-06T11:30:00.000Z",
    },

    // Recent check-outs
    {
      id: createBookingId(),
      projectId: testProjects.mainResort.id,
      propertyId: "property_villa_002",
      guestName: "Robert James Mendoza",
      guestEmail: "robert.mendoza@hotmail.com",
      guestPhone: "+639191234567",
      checkIn: daysFromNow(-5),
      checkOut: daysFromNow(-2),
      nights: 3,
      guests: 3,
      status: BookingStatus.CHECKED_OUT,
      source: BookingSource.WEBSITE,
      totalAmount: 24000, // ₱8,000 per night
      paidAmount: 24000, // Fully paid
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      notes: "Business retreat with colleagues. Excellent stay.",
      specialRequests: "Conference setup for 3 people, printing services",
      createdAt: "2024-01-01T12:00:00.000Z",
      updatedAt: daysFromNow(-2) + "T12:00:00.000Z",
    },
    {
      id: createBookingId(),
      projectId: testProjects.mainResort.id,
      propertyId: "property_room_002",
      guestName: "Anna Marie Cruz-Gonzales",
      guestEmail: "anna.cruz@gmail.com",
      guestPhone: "+639281234568",
      checkIn: daysFromNow(-10),
      checkOut: daysFromNow(-7),
      nights: 3,
      guests: 2,
      status: BookingStatus.CHECKED_OUT,
      source: BookingSource.WALK_IN,
      totalAmount: 18000, // ₱6,000 per night
      paidAmount: 18000, // Paid in cash upon arrival
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.CASH,
      notes: "Walk-in guests from Manila. Emergency accommodation.",
      specialRequests: "None",
      createdAt: daysFromNow(-10) + "T15:30:00.000Z",
      updatedAt: daysFromNow(-7) + "T11:00:00.000Z",
    },

    // Holiday season bookings (December/January)
    {
      id: createBookingId(),
      projectId: testProjects.mainResort.id,
      propertyId: "property_villa_003",
      guestName: "Carlos Antonio Rivera",
      guestEmail: "carlos.rivera@corp.ph",
      guestPhone: "+639171234569",
      checkIn: "2024-12-23",
      checkOut: "2024-12-27",
      nights: 4,
      guests: 6,
      status: BookingStatus.CONFIRMED,
      source: BookingSource.DIRECT,
      totalAmount: 60000, // ₱15,000 per night (peak season)
      paidAmount: 30000, // 50% deposit
      paymentStatus: PaymentStatus.PARTIAL,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      notes: "Christmas family reunion. Large extended family.",
      specialRequests: "Crib for infant, high chairs for toddlers, Christmas decorations",
      createdAt: "2024-11-15T09:00:00.000Z",
      updatedAt: "2024-11-20T14:30:00.000Z",
    },
    {
      id: createBookingId(),
      projectId: testProjects.mainResort.id,
      propertyId: "property_suite_002",
      guestName: "Lisa Mae Fernandez",
      guestEmail: "lisa.fernandez@company.com",
      guestPhone: "+639281234569",
      checkIn: "2024-12-30",
      checkOut: "2025-01-03",
      nights: 4,
      guests: 2,
      status: BookingStatus.CONFIRMED,
      source: BookingSource.EXPEDIA,
      totalAmount: 80000, // ₱20,000 per night (New Year premium)
      paidAmount: 80000, // Fully paid
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      notes: "New Year celebration. Honeymoon couple.",
      specialRequests: "Champagne setup, romantic dinner arrangement, spa booking",
      createdAt: "2024-10-05T16:45:00.000Z",
      updatedAt: "2024-10-08T10:20:00.000Z",
    },

    // Cancelled bookings
    {
      id: createBookingId(),
      projectId: testProjects.mainResort.id,
      propertyId: "property_room_003",
      guestName: "Patricia Anne Villanueva",
      guestEmail: "patricia.villanueva@email.com",
      guestPhone: "+639171234570",
      checkIn: daysFromNow(20),
      checkOut: daysFromNow(23),
      nights: 3,
      guests: 2,
      status: BookingStatus.CANCELLED,
      source: BookingSource.BOOKING_COM,
      totalAmount: 18000,
      paidAmount: 0,
      paymentStatus: PaymentStatus.REFUNDED,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      notes: "Cancelled due to travel restrictions. Full refund processed.",
      specialRequests: "None",
      createdAt: "2024-01-12T11:30:00.000Z",
      updatedAt: "2024-01-14T09:15:00.000Z",
    },

    // Pending payment booking
    {
      id: createBookingId(),
      projectId: testProjects.mainResort.id,
      propertyId: "property_villa_004",
      guestName: "David Chen Lim",
      guestEmail: "david.lim@business.ph",
      guestPhone: "+639281234570",
      checkIn: daysFromNow(30),
      checkOut: daysFromNow(35),
      nights: 5,
      guests: 4,
      status: BookingStatus.PENDING,
      source: BookingSource.DIRECT,
      totalAmount: 50000, // ₱10,000 per night
      paidAmount: 0, // No payment yet
      paymentStatus: PaymentStatus.PENDING,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      notes: "Corporate booking. Waiting for company payment processing.",
      specialRequests: "Meeting room setup, projector, catering for 4",
      createdAt: "2024-01-15T13:45:00.000Z",
      updatedAt: "2024-01-15T13:45:00.000Z",
    },
  ];

  // Okaeri Island Retreat bookings (Smaller property)
  const islandRetreatBookings: Booking[] = [
    {
      id: createBookingId(),
      projectId: testProjects.islandRetreat.id,
      propertyId: "property_island_villa_001",
      guestName: "Sophia Grace Tan",
      guestEmail: "sophia.tan@travel.com",
      guestPhone: "+639171234571",
      checkIn: daysFromNow(5),
      checkOut: daysFromNow(10),
      nights: 5,
      guests: 2,
      status: BookingStatus.CONFIRMED,
      source: BookingSource.DIRECT,
      totalAmount: 75000, // ₱15,000 per night (premium eco-luxury)
      paidAmount: 37500, // 50% deposit
      paymentStatus: PaymentStatus.PARTIAL,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      notes: "Eco-tourism enthusiasts from Singapore. Interested in island hopping.",
      specialRequests: "Vegetarian meals, yoga mat, snorkeling gear",
      createdAt: "2024-01-08T14:20:00.000Z",
      updatedAt: "2024-01-10T11:30:00.000Z",
    },
    {
      id: createBookingId(),
      projectId: testProjects.islandRetreat.id,
      propertyId: "property_island_bungalow_001",
      guestName: "James Wesley Santos",
      guestEmail: "james.santos@email.ph",
      guestPhone: "+639281234571",
      checkIn: daysFromNow(-3),
      checkOut: daysFromNow(2),
      nights: 5,
      guests: 1,
      status: BookingStatus.CHECKED_IN,
      source: BookingSource.WEBSITE,
      totalAmount: 60000, // ₱12,000 per night
      paidAmount: 60000, // Fully paid
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.PAYPAL,
      notes: "Digital nomad from Canada. Extended work-vacation.",
      specialRequests: "Strong WiFi, work desk, quiet environment",
      createdAt: "2024-01-05T09:30:00.000Z",
      updatedAt: daysFromNow(-3) + "T14:00:00.000Z",
    },
  ];

  // Okaeri City Hotel bookings (Business travelers)
  const cityHotelBookings: Booking[] = [
    {
      id: createBookingId(),
      projectId: testProjects.cityHotel.id,
      propertyId: "property_business_suite_001",
      guestName: "Alexandra Marie Rodriguez",
      guestEmail: "alexandra.rodriguez@corporation.com",
      guestPhone: "+639171234572",
      checkIn: daysFromNow(1),
      checkOut: daysFromNow(4),
      nights: 3,
      guests: 1,
      status: BookingStatus.CONFIRMED,
      source: BookingSource.DIRECT,
      totalAmount: 21000, // ₱7,000 per night (business rate)
      paidAmount: 21000, // Corporate billing
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      notes: "Corporate executive attending business conference.",
      specialRequests: "Express check-in, business center access, airport transfer",
      createdAt: "2024-01-13T16:30:00.000Z",
      updatedAt: "2024-01-14T08:45:00.000Z",
    },
    {
      id: createBookingId(),
      projectId: testProjects.cityHotel.id,
      propertyId: "property_executive_room_001",
      guestName: "Francisco Miguel Reyes",
      guestEmail: "francisco.reyes@law.ph",
      guestPhone: "+639281234572",
      checkIn: daysFromNow(-2),
      checkOut: daysFromNow(0),
      nights: 2,
      guests: 1,
      status: BookingStatus.CHECKED_IN,
      source: BookingSource.BOOKING_COM,
      totalAmount: 12000, // ₱6,000 per night
      paidAmount: 12000, // Paid upon check-in
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      notes: "Lawyer attending court hearings in Makati.",
      specialRequests: "Late checkout, laundry service, quiet room",
      createdAt: "2024-01-12T19:15:00.000Z",
      updatedAt: daysFromNow(-2) + "T15:00:00.000Z",
    },
  ];

  return [...mainResortBookings, ...islandRetreatBookings, ...cityHotelBookings];
}

export const bookingSeeds: Booking[] = generateBookingData();

/**
 * Quick access to different types of bookings for testing
 */
export const testBookings = {
  upcoming: bookingSeeds.filter(
    (b) => new Date(b.checkIn) > new Date() && b.status === BookingStatus.CONFIRMED
  ),
  checkedIn: bookingSeeds.filter((b) => b.status === BookingStatus.CHECKED_IN),
  checkedOut: bookingSeeds.filter((b) => b.status === BookingStatus.CHECKED_OUT),
  cancelled: bookingSeeds.filter((b) => b.status === BookingStatus.CANCELLED),
  pending: bookingSeeds.filter((b) => b.status === BookingStatus.PENDING),
  mainResort: bookingSeeds.filter((b) => b.projectId === testProjects.mainResort.id),
  islandRetreat: bookingSeeds.filter((b) => b.projectId === testProjects.islandRetreat.id),
  cityHotel: bookingSeeds.filter((b) => b.projectId === testProjects.cityHotel.id),
};
