/**
 * Static configuration for calendar unit slot layout.
 * Each unit gets a fixed vertical lane (C1=top, C2=middle, C3=bottom)
 * with dedicated colors so occupancy is scannable at a glance.
 */

export interface UnitSlotConfig {
  unitCode: string;
  slotIndex: number;
  bg: string;
  text: string;
  border: string;
  mobileBar: string;
  /** Darker border shade applied to Pending chips for higher contrast on white bg */
  pendingBorder: string;
}

export const UNIT_SLOTS: UnitSlotConfig[] = [
  {
    unitCode: "C1",
    slotIndex: 0,
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-300",
    mobileBar: "bg-blue-400",
    pendingBorder: "border-blue-600",
  },
  {
    unitCode: "C2",
    slotIndex: 1,
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-300",
    mobileBar: "bg-emerald-400",
    pendingBorder: "border-emerald-600",
  },
  {
    unitCode: "C3",
    slotIndex: 2,
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-300",
    mobileBar: "bg-amber-400",
    pendingBorder: "border-amber-600",
  },
];

/** Map from unit code to slot config for O(1) lookup */
export const UNIT_SLOT_MAP = new Map(UNIT_SLOTS.map((s) => [s.unitCode, s]));

/** Returns Tailwind modifier classes for the desktop chip based on booking status */
export function getStatusHintClasses(status: string): string {
  switch (status) {
    case "Confirmed":
    case "CheckedIn":
      return ""; // full solid — no modifier
    case "Pending":
      return "bg-white border-2 border-dashed";
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
