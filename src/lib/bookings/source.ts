export const BOOKING_SOURCES = ["Website", "Walk-in", "Direct", "Airbnb"] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

/** Website is set only by the public site. */
export const STAFF_BOOKING_SOURCES = ["Walk-in", "Direct", "Airbnb"] as const;
export type StaffBookingSource = (typeof STAFF_BOOKING_SOURCES)[number];
