export const DUPLICATE_CONFIRMATION_CODE_MESSAGE =
  "This Airbnb confirmation code is already on another booking. Search the bookings for it, or check the code.";

export class DuplicateConfirmationCodeError extends Error {
  constructor() {
    super(DUPLICATE_CONFIRMATION_CODE_MESSAGE);
    this.name = "DuplicateConfirmationCodeError";
  }
}

/** Only an Airbnb booking keeps a code; a blank code is stored as none. */
export const storedConfirmationCode = (booking: {
  booking_source?: string;
  airbnb_confirmation_code?: string;
}) => (booking.booking_source === "Airbnb" && booking.airbnb_confirmation_code) || null;

const UNIQUE_VIOLATION = "23505";

export const isDuplicateConfirmationCode = (error: { code?: string; message?: string } | null) =>
  error?.code === UNIQUE_VIOLATION &&
  !!error.message?.includes("bookings_airbnb_confirmation_code_key");
