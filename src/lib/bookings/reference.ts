// Guest bookings are BK-YYYYMM-XXXXXX (functions/api/guest-booking/multi-unit.ts);
// BK-YYYY-XXXXXX is the form the status lookup API accepts.
const BOOKING_REFERENCE_PATTERN = /^BK-\d{4}(?:\d{2})?-[A-Z0-9]{6}$/;

export const isBookingReference = (value: string) => BOOKING_REFERENCE_PATTERN.test(value);
