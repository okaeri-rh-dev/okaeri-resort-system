export const DUPLICATE_CONFIRMATION_CODE_MESSAGE =
  "This Airbnb confirmation code is already on another booking. Search the bookings for it, or check the code.";

export class DuplicateConfirmationCodeError extends Error {
  constructor() {
    super(DUPLICATE_CONFIRMATION_CODE_MESSAGE);
    this.name = "DuplicateConfirmationCodeError";
  }
}

const UNIQUE_VIOLATION = "23505";

export const isDuplicateConfirmationCode = (error: { code?: string; message?: string } | null) =>
  error?.code === UNIQUE_VIOLATION &&
  !!error.message?.includes("bookings_airbnb_confirmation_code_key");
