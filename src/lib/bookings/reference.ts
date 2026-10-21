// Online guest bookings are BK-YYYYMM-XXXXXX. BK-YYYY-XXXXXX stays valid for older references.
const GUEST_BOOKING_REFERENCE_PATTERN = /^BK-\d{4}(?:\d{2})?-[A-Z0-9]{6}$/;
const REFERENCE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export const isGuestBookingReference = (value: string) =>
  GUEST_BOOKING_REFERENCE_PATTERN.test(value);

export function generateGuestBookingReference(now = new Date()) {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const randomPart = Array.from(
    crypto.getRandomValues(new Uint32Array(6)),
    (value) => REFERENCE_CHARACTERS[value % REFERENCE_CHARACTERS.length]
  ).join("");
  return `BK-${now.getUTCFullYear()}${month}-${randomPart}`;
}
