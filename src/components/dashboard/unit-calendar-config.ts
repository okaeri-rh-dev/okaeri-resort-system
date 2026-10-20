/**
 * Static configuration for calendar unit slot layout.
 * Each unit gets a fixed vertical lane (C1=top, C2=middle, C3=bottom)
 * with dedicated unit-lane tokens so occupancy is scannable at a glance.
 */

export interface UnitSlotConfig {
  unitCode: string;
  slotIndex: number;
  bg: string;
  text: string;
  border: string;
  mobileBar: string;
}

export const UNIT_SLOTS: UnitSlotConfig[] = [
  {
    unitCode: "C1",
    slotIndex: 0,
    bg: "bg-unit-lane-1",
    text: "text-unit-lane-1-foreground",
    border: "border-unit-lane-1-accent",
    mobileBar: "bg-unit-lane-1-accent",
  },
  {
    unitCode: "C2",
    slotIndex: 1,
    bg: "bg-unit-lane-2",
    text: "text-unit-lane-2-foreground",
    border: "border-unit-lane-2-accent",
    mobileBar: "bg-unit-lane-2-accent",
  },
  {
    unitCode: "C3",
    slotIndex: 2,
    bg: "bg-unit-lane-3",
    text: "text-unit-lane-3-foreground",
    border: "border-unit-lane-3-accent",
    mobileBar: "bg-unit-lane-3-accent",
  },
];

/** Map from unit code to slot config for O(1) lookup */
export const UNIT_SLOT_MAP = new Map(UNIT_SLOTS.map((s) => [s.unitCode, s]));

/**
 * Color overrides applied to ALL Pending bookings regardless of unit, so
 * tentative bookings read as a single cohesive status across the calendar.
 * Unit identity for Pending chips lives in the rendered unit code letter,
 * not in color.
 */
export const PENDING_CHIP_COLORS = {
  /** Desktop chip text color */
  text: "text-unit-lane-3-foreground",
  /** Desktop chip border color (pairs with border-2 border-dashed from getStatusHintClasses) */
  border: "border-unit-lane-3-accent",
  /** Mobile color-bar background */
  mobileBar: "bg-unit-lane-3-accent",
} as const;

/** Returns Tailwind modifier classes for the desktop chip based on booking status */
export function getStatusHintClasses(status: string): string {
  switch (status) {
    case "Confirmed":
    case "CheckedIn":
      return ""; // full solid — no modifier
    case "Pending":
      return "bg-card border-2 border-dashed";
    case "CheckedOut":
      return "opacity-50";
    case "Cancelled":
      return "opacity-30 line-through";
    default:
      return "";
  }
}

/**
 * Returns Tailwind modifier classes for the mobile color-bar.
 * Keeps the unit color visible (the bar is the only mobile indicator) and
 * uses opacity to signal tentative/finalised states.
 */
export function getStatusMobileBarClasses(status: string): string {
  switch (status) {
    case "Confirmed":
    case "CheckedIn":
      return ""; // full solid — no modifier
    case "Pending":
      return "opacity-70";
    case "CheckedOut":
      return "opacity-50";
    case "Cancelled":
      return "opacity-30";
    default:
      return "";
  }
}
