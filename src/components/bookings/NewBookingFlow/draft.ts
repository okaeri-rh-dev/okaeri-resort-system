import type { StaffBookingSource } from "@/lib/bookings";
import type { PaymentMethod, Unit } from "@/types";

export const NEW_BOOKING_STEPS = ["stay", "guest", "payment", "review"] as const;
export type Step = (typeof NEW_BOOKING_STEPS)[number];
export const STEP_TITLES: Record<Step, string> = {
  stay: "Stay",
  guest: "Guest",
  payment: "Payment",
  review: "Review",
};

export const METHODS = [
  { value: "GCash", label: "GCash" },
  { value: "BankTransfer", label: "Bank transfer" },
  { value: "Cash", label: "Cash" },
] as const satisfies readonly { value: PaymentMethod; label: string }[];

export interface Draft {
  source: StaffBookingSource;
  checkIn?: string;
  checkOut?: string;
  cabins: { unitId: string; guests: number }[];
  guestId?: string;
  guestName: string;
  phone: string;
  email: string;
  isNewGuest: boolean;
  method?: (typeof METHODS)[number]["value"];
  payout: string;
  confirmationCode: string;
  notes: string;
}

export type Update = (patch: Partial<Draft>) => void;

export const EMPTY_DRAFT: Draft = {
  source: "Direct",
  cabins: [],
  guestName: "",
  phone: "",
  email: "",
  isNewGuest: false,
  payout: "",
  confirmationCode: "",
  notes: "",
};

export interface CabinLine {
  unitId: string;
  guests: number;
  unit: Unit;
  subtotal: number;
}

interface StepCheck {
  draft: Draft;
  nights: number;
  lines: CabinLine[];
  hasAvailability: boolean;
  takenCabin?: CabinLine;
}

/** Why the step cannot move on yet, or null when it can. */
export const STEP_PROBLEMS: Record<Step, (check: StepCheck) => string | null> = {
  stay: ({ nights, lines, hasAvailability, takenCabin }) => {
    if (nights <= 0) return "Pick the check-in and check-out dates";
    if (lines.length === 0) return "Add at least one cabin";
    if (!hasAvailability) return "Checking which cabins are free";
    if (takenCabin) {
      return `${takenCabin.unit.unit_name} is not free on these dates. Remove it or change the dates.`;
    }
    return null;
  },
  guest: ({ draft }) => {
    if (draft.guestName.trim().length < 2)
      return "Enter the guest's name or pick an existing guest";
    if (!draft.guestId && !draft.isNewGuest) return "Pick an existing guest or choose New guest";
    if (!draft.guestId && draft.source !== "Airbnb" && !draft.phone.trim()) {
      return "Enter a phone number";
    }
    return null;
  },
  payment: ({ draft }) => {
    if (draft.source === "Airbnb") {
      return Number(draft.payout) > 0 ? null : "Enter the Airbnb payout";
    }
    return draft.method ? null : "Pick how the guest pays";
  },
  review: () => null,
};
