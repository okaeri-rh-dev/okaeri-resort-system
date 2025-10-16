// Core type definitions for Okaeri Resort System

// ============================================
// UNIT TYPES
// ============================================
export type UnitType = "Standard" | "Deluxe" | "Suite" | "Villa";
export type UnitStatus = "Available" | "Occupied" | "Maintenance" | "Reserved";

export interface Unit {
  unit_id: string;
  unit_name: string;
  unit_code: string;
  unit_type: string; // Database returns string, use UnitType for validation
  base_occupancy: number;
  max_occupancy: number;
  base_rate: number;
  weekend_rate: number;
  extra_person_rate: number;
  unit_status: string | null; // Database returns nullable string
  amenities: string[] | null;
  cleaning_fee?: number | null;
  description?: string | null;
  images?: string[] | null;
  policies?: string[] | null;
  created_at: string | null; // Database can return null
  updated_at: string | null; // Database can return null
}

// ============================================
// GUEST TYPES
// ============================================
export interface Guest {
  guest_id: string;
  guest_name: string;
  email: string;
  phone_number: string;
  total_bookings: number | null;
  total_spent: number | null;
  created_at: string | null; // Database can return null
  updated_at: string | null; // Database can return null
}

// ============================================
// BOOKING TYPES
// ============================================
export type BookingStatus = "Pending" | "Confirmed" | "CheckedIn" | "CheckedOut" | "Cancelled";
export type PaymentStatus = "Pending" | "Partial" | "Completed" | "Refunded";
export type PaymentMethod = "Cash" | "GCash" | "BankTransfer" | "Card" | "Other";

// Database booking unit junction table record
export interface BookingUnitRecord {
  booking_unit_id: string;
  booking_id: string;
  unit_id: string;
  unit_price: number;
  weekend_surcharge: number | null;
  extra_person_charge: number | null;
  subtotal: number;
  assigned_guests: number | null;
  unit_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Relation to unit
  unit?: Unit;
}

export interface Booking {
  booking_id: string;
  booking_reference: string;
  guest_id?: string | null;
  guest_name: string;
  contact_number: string;
  email: string;
  num_guests: number;
  check_in: string; // Date as ISO string
  check_out: string; // Date as ISO string
  total_amount: number;
  booking_status: string | null; // Database uses nullable strings, not enums
  payment_status: string | null; // Database uses nullable strings, not enums
  payment_method?: string | null;
  payment_proof_url?: string | null;
  special_requests?: string | null;
  internal_notes?: string | null;
  is_multi_unit?: boolean | null;
  unit_count?: number | null;
  created_at: string | null;
  updated_at: string | null;
  // Relations (NEW: junction table pattern)
  booking_units?: BookingUnitRecord[];
  guest?: Guest | null;
  // Deprecated: Direct unit relation removed (use booking_units instead)
  // unit?: Unit;
}

// ============================================
// PAYMENT TYPES
// ============================================
export interface Payment {
  payment_id: string;
  booking_id: string | null;
  amount: number;
  payment_method?: string | null;
  payment_date: string | null;
  proof_url?: string | null;
  notes?: string | null;
  created_at: string | null;
  // Relations
  booking?: Booking;
}

// ============================================
// EXPENSE TYPES (Future use)
// ============================================
export interface Expense {
  expense_id: string;
  category: string;
  description: string | null;
  amount: number;
  date: string; // This maps to expense_date in our schema
  receipt_url?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// MAINTENANCE LOG TYPES (Future use)
// ============================================
export type MaintenanceStatus = "Pending" | "In Progress" | "Completed" | "Cancelled";
export type MaintenancePriority = "Low" | "Medium" | "High" | "Urgent";

export interface MaintenanceLog {
  log_id: string;
  unit_id: string;
  issue_description: string;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  reported_date: string;
  resolved_date?: string | null;
  cost?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  unit?: Unit;
}

// ============================================
// FORM INPUT TYPES
// ============================================
export interface BookingFormData {
  // Note: For single-unit bookings, use unit_id. For multi-unit, use unit_ids array.
  unit_id?: string; // Single-unit booking (legacy)
  unit_ids?: string[]; // Multi-unit booking
  guest_name: string;
  contact_number: string;
  email: string;
  num_guests: number;
  check_in: Date | string;
  check_out: Date | string;
  special_requests?: string;
  payment_method?: PaymentMethod;
}

export interface UnitFormData {
  unit_name: string;
  unit_code: string;
  unit_type: UnitType;
  base_occupancy: number;
  max_occupancy: number;
  base_rate: number;
  weekend_rate: number;
  extra_person_rate: number;
}

// ============================================
// API RESPONSE TYPES
// ============================================
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// FILTER TYPES
// ============================================
export interface BookingFilters {
  status?: BookingStatus;
  payment_status?: PaymentStatus;
  unit_id?: string;
  guest_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface UnitFilters {
  status?: UnitStatus;
  type?: UnitType;
  min_rate?: number;
  max_rate?: number;
  min_occupancy?: number;
}

// ============================================
// STATISTICS TYPES
// ============================================
export interface DashboardStats {
  totalUnits: number;
  availableUnits: number;
  totalBookings: number;
  activeBookings: number;
  totalRevenue: number;
  monthlyRevenue: number;
  averageOccupancy: number;
  upcomingCheckIns: number;
  upcomingCheckOuts: number;
}

export interface UnitStats {
  unit_id: string;
  total_revenue: number;
  total_bookings: number;
  average_booking_value: number;
  occupancy_rate: number;
  current_month_revenue: number;
}

// ============================================
// DATE UTILITY TYPES
// ============================================
export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface AvailabilityCheck {
  unit_id: string;
  check_in: string;
  check_out: string;
}

// ============================================
// FILE UPLOAD TYPES
// ============================================
export interface FileUploadResponse {
  url: string;
  path: string;
  size: number;
  type: string;
}

// ============================================
// TABLE COLUMN TYPES (For TanStack Table)
// ============================================
export interface TableState {
  sorting: any[];
  columnFilters: any[];
  columnVisibility: Record<string, boolean>;
  rowSelection: Record<string, boolean>;
  pagination: {
    pageIndex: number;
    pageSize: number;
  };
}

// ============================================
// MULTI-UNIT BOOKING TYPES (Phase 3)
// ============================================
export * from "./multi-unit-booking";
