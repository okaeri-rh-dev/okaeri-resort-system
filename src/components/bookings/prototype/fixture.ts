/**
 * PROTOTYPE — throwaway fixture for the bookings page overhaul (docs/plans/2026-10-21-bookings-overhaul.md).
 * Lives on branch proto/bookings-overhaul only. Dates are relative to today; nothing touches the DB.
 */
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";

export type ProtoStatus = "Pending" | "Confirmed" | "CheckedIn" | "CheckedOut" | "Cancelled";
export type ProtoSource = "guest" | "walk-in";

export interface ProtoBooking {
  id: string;
  reference: string;
  guestName: string;
  contact: string;
  guests: number;
  checkIn: string;
  checkOut: string;
  status: ProtoStatus;
  source: ProtoSource;
  /** Cabin codes. Empty for a pending guest booking until payment is verified. */
  cabins: string[];
  requestedCabins: number;
  total: number;
  paid: number;
  proofUploaded: boolean;
  createdAt: string;
}

export const CABINS = [
  { code: "C1", name: "Cabin 1" },
  { code: "C2", name: "Cabin 2" },
  { code: "C3", name: "Cabin 3" },
] as const;

const NIGHTLY_RATE = 9000;

export const today = startOfDay(new Date());
export const dayKey = (offset: number) => format(addDays(today, offset), "yyyy-MM-dd");
export const TODAY = dayKey(0);

export const nightsOf = (b: Pick<ProtoBooking, "checkIn" | "checkOut">) =>
  differenceInCalendarDays(parseISO(b.checkOut), parseISO(b.checkIn));

export const balanceOf = (b: ProtoBooking) => Math.max(0, b.total - b.paid);

interface Seed {
  guestName: string;
  from: number;
  to: number;
  status: ProtoStatus;
  cabins?: string[];
  requested?: number;
  source?: ProtoSource;
  /** Share of the total already paid. */
  paidShare?: number;
  guests?: number;
  proof?: boolean;
  createdDaysAgo?: number;
}

const seeds: Seed[] = [
  // In-house
  { guestName: "Maria Santos", from: -2, to: 1, status: "CheckedIn", cabins: ["C1"], paidShare: 1 },
  {
    guestName: "Jose Ramirez",
    from: -1,
    to: 0,
    status: "CheckedIn",
    cabins: ["C2"],
    paidShare: 0.5,
    guests: 4,
  },
  {
    guestName: "Liza Mendoza",
    from: -3,
    to: 2,
    status: "CheckedIn",
    cabins: ["C3"],
    paidShare: 1,
    guests: 6,
  },
  // Arriving today, downpayment only
  {
    guestName: "Paolo Garcia",
    from: 0,
    to: 2,
    status: "Confirmed",
    cabins: ["C2"],
    paidShare: 0.5,
    guests: 5,
  },
  // This week
  {
    guestName: "Ma. Concepcion Dela Cruz-Villanueva y Bautista",
    from: 1,
    to: 3,
    status: "Confirmed",
    cabins: ["C1"],
    paidShare: 1,
  },
  { guestName: "Ramon Aquino", from: 2, to: 4, status: "Confirmed", cabins: ["C2"], paidShare: 1 },
  {
    guestName: "Reyes family reunion",
    from: 3,
    to: 5,
    status: "Confirmed",
    cabins: ["C1", "C3"],
    paidShare: 0.5,
    guests: 14,
  },
  {
    guestName: "Tess Villanueva",
    from: 4,
    to: 6,
    status: "Pending",
    cabins: ["C2"],
    source: "walk-in",
    paidShare: 0,
    guests: 3,
  },
  // Pending guest bookings, cabins not assigned yet
  {
    guestName: "Andrea Lim",
    from: 2,
    to: 3,
    status: "Pending",
    requested: 1,
    proof: true,
    createdDaysAgo: 0,
  },
  {
    guestName: "Carlo Navarro",
    from: 5,
    to: 7,
    status: "Pending",
    requested: 1,
    proof: true,
    createdDaysAgo: 1,
  },
  {
    guestName: "Bea Fernandez",
    from: 10,
    to: 12,
    status: "Pending",
    requested: 2,
    proof: true,
    guests: 12,
    createdDaysAgo: 2,
  },
  {
    guestName: "Miguel Torres",
    from: 20,
    to: 22,
    status: "Pending",
    requested: 1,
    proof: false,
    createdDaysAgo: 3,
  },
  // Later
  {
    guestName: "Grace Castillo",
    from: 8,
    to: 10,
    status: "Confirmed",
    cabins: ["C3"],
    paidShare: 0.5,
  },
  {
    guestName: "Nico Bautista",
    from: 9,
    to: 11,
    status: "Confirmed",
    cabins: ["C1"],
    paidShare: 1,
  },
  {
    guestName: "Joy Soriano",
    from: 12,
    to: 14,
    status: "Confirmed",
    cabins: ["C2"],
    paidShare: 0.5,
  },
  {
    guestName: "Acme Corp team outing",
    from: 18,
    to: 20,
    status: "Confirmed",
    cabins: ["C1", "C2", "C3"],
    paidShare: 0.5,
    guests: 22,
  },
  {
    guestName: "Ellen Ocampo",
    from: 25,
    to: 27,
    status: "Confirmed",
    cabins: ["C3"],
    source: "walk-in",
    paidShare: 1,
  },
  {
    guestName: "Dennis Panganiban",
    from: 30,
    to: 33,
    status: "Confirmed",
    cabins: ["C2"],
    paidShare: 0.5,
  },
  { guestName: "Rica Manalo", from: 40, to: 42, status: "Confirmed", cabins: ["C1"], paidShare: 1 },
  {
    guestName: "Leo Salazar",
    from: 45,
    to: 46,
    status: "Confirmed",
    cabins: ["C3"],
    paidShare: 0.5,
  },
  { guestName: "Hannah Uy", from: 60, to: 62, status: "Confirmed", cabins: ["C2"], paidShare: 0.5 },
  // Cancelled
  { guestName: "Marco Dizon", from: 14, to: 16, status: "Cancelled", cabins: ["C1"], paidShare: 0 },
  {
    guestName: "Sheila Robles",
    from: -10,
    to: -8,
    status: "Cancelled",
    cabins: ["C2"],
    paidShare: 0,
  },
  { guestName: "Paulo Cruz", from: 6, to: 8, status: "Cancelled", requested: 1, paidShare: 0 },
  {
    guestName: "Vince Morales",
    from: -20,
    to: -18,
    status: "Cancelled",
    cabins: ["C3"],
    source: "walk-in",
    paidShare: 0,
  },
  // Checked out, one still owes a balance
  {
    guestName: "Arnel Pascual",
    from: -5,
    to: -3,
    status: "CheckedOut",
    cabins: ["C1"],
    paidShare: 0.5,
  },
];

const pastGuests = [
  "Tina Gomez",
  "Edwin Javier",
  "Karen Lopez",
  "Rodel Santiago",
  "Mylene Rivera",
  "Allan Mercado",
  "Precy Valdez",
  "Jun Ignacio",
  "Lorna Tan",
  "Bong Ramos",
  "Cecil Aguilar",
  "Fe De Guzman",
  "Ruben Flores",
  "Nora Medina",
];

pastGuests.forEach((guestName, index) => {
  const from = -7 - index * 3;
  seeds.push({
    guestName,
    from,
    to: from + 2,
    status: "CheckedOut",
    cabins: [CABINS[index % CABINS.length].code],
    paidShare: 1,
    source: index % 4 === 0 ? "walk-in" : "guest",
  });
});

function buildBooking(seed: Seed, index: number): ProtoBooking {
  const cabinCount = seed.cabins?.length || seed.requested || 1;
  const nights = seed.to - seed.from;
  const total = nights * NIGHTLY_RATE * cabinCount;
  return {
    id: `proto-${index + 1}`,
    reference: `OKR-${String(2100 + index).padStart(4, "0")}`,
    guestName: seed.guestName,
    contact: `+63917${String(1000000 + index * 7919).slice(-7)}`,
    guests: seed.guests ?? 2 + (index % 4),
    checkIn: dayKey(seed.from),
    checkOut: dayKey(seed.to),
    status: seed.status,
    source: seed.source ?? "guest",
    cabins: seed.cabins ?? [],
    requestedCabins: cabinCount,
    total,
    paid: Math.round(total * (seed.paidShare ?? 0)),
    proofUploaded: seed.proof ?? false,
    createdAt: dayKey(-(seed.createdDaysAgo ?? 7 + (index % 10))),
  };
}

export type Scenario = "full" | "quiet";

/** "quiet" drops everyone in-house, to show the empty In-house case. */
export function buildFixture(scenario: Scenario): ProtoBooking[] {
  const all = seeds.map(buildBooking);
  return scenario === "quiet" ? all.filter((b) => b.status !== "CheckedIn") : all;
}

export type PrimaryAction = "verify" | "confirm" | "check-in" | "check-out";

export function primaryActionOf(b: ProtoBooking): PrimaryAction | null {
  if (b.status === "Pending") return b.source === "guest" ? "verify" : "confirm";
  if (b.status === "Confirmed" && b.checkIn <= TODAY) return "check-in";
  if (b.status === "CheckedIn") return "check-out";
  return null;
}

export const primaryActionLabel: Record<PrimaryAction, string> = {
  verify: "Verify payment",
  confirm: "Confirm",
  "check-in": "Check in",
  "check-out": "Check out",
};

export const hasBalanceDue = (b: ProtoBooking) =>
  (b.status === "Confirmed" || b.status === "CheckedIn" || b.status === "CheckedOut") &&
  balanceOf(b) > 0;

export function needsAction(b: ProtoBooking) {
  if (b.status === "Pending") return true;
  if (b.status === "Confirmed") return b.checkIn <= TODAY;
  if (b.status === "CheckedIn") return b.checkOut <= TODAY;
  if (b.status === "CheckedOut") return hasBalanceDue(b);
  return false;
}

export const isUpcoming = (b: ProtoBooking) =>
  (b.status === "Confirmed" || b.status === "Pending") && b.checkOut > TODAY;

export function cabinIsFree(
  bookings: ProtoBooking[],
  cabin: string,
  checkIn: string,
  checkOut: string
) {
  return !bookings.some(
    (b) =>
      (b.status === "Confirmed" || b.status === "CheckedIn" || b.status === "Pending") &&
      b.cabins.includes(cabin) &&
      b.checkIn < checkOut &&
      checkIn < b.checkOut
  );
}

export interface ProtoFilters {
  q?: string;
  cabin?: string;
  pay?: "due" | "paid";
  src?: ProtoSource;
}

export function matchesFilters(b: ProtoBooking, f: ProtoFilters) {
  const query = f.q?.trim().toLowerCase();
  if (
    query &&
    !b.guestName.toLowerCase().includes(query) &&
    !b.reference.toLowerCase().includes(query) &&
    !b.contact.includes(query)
  )
    return false;
  if (f.cabin && !b.cabins.includes(f.cabin)) return false;
  if (f.pay === "due" && !hasBalanceDue(b)) return false;
  if (f.pay === "paid" && balanceOf(b) > 0) return false;
  if (f.src && b.source !== f.src) return false;
  return true;
}

export const activeFilterCount = (f: ProtoFilters) =>
  [f.cabin, f.pay, f.src].filter(Boolean).length;

export function formatStay(b: Pick<ProtoBooking, "checkIn" | "checkOut">) {
  const inDate = parseISO(b.checkIn);
  const outDate = parseISO(b.checkOut);
  const sameMonth = inDate.getMonth() === outDate.getMonth();
  return `${format(inDate, "EEE MMM d")} → ${format(outDate, sameMonth ? "d" : "MMM d")}`;
}

export function relativeDay(date: string) {
  const diff = differenceInCalendarDays(parseISO(date), today);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}
