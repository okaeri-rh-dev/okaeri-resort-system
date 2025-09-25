import type { Guest } from "@/types";

export interface GuestsTableProps {
  onViewGuest?: (guest: Guest) => void;
  onEditGuest?: (guest: Guest) => void;
  className?: string;
}

export interface GuestCardProps {
  guest: Guest;
  onView: () => void;
  onEdit: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export interface GuestFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onExport: () => void;
}
