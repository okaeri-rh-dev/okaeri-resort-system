/**
 * Common type definitions used across the application
 */

// User and Authentication types
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  projects?: ProjectMembership[];
}

export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  STAFF = "STAFF",
  VIEWER = "VIEWER",
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  sessionExpiry: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Project and Multi-tenancy types
export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  type: ProjectType;
  status: ProjectStatus;
  config: ProjectConfig;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  members?: ProjectMembership[];
  stats?: ProjectStats;
}

export enum ProjectType {
  RESORT = "RESORT",
  HOTEL = "HOTEL",
  VACATION_RENTAL = "VACATION_RENTAL",
  MIXED = "MIXED",
}

export enum ProjectStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ARCHIVED = "ARCHIVED",
  TRIAL = "TRIAL",
}

export interface ProjectConfig {
  currency: string;
  timezone: string;
  locale: string;
  fiscalYearStart?: string;
  features: ProjectFeatures;
  limits: ProjectLimits;
  customFields?: Record<string, any>;
}

export interface ProjectFeatures {
  bookings: boolean;
  expenses: boolean;
  reports: boolean;
  analytics: boolean;
  googleSheets: boolean;
  csvImport: boolean;
  apiAccess: boolean;
}

export interface ProjectLimits {
  maxProperties: number;
  maxBookings: number;
  maxUsers: number;
  maxFileStorage: number; // in MB
}

export interface ProjectMembership {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  permissions: Permission[];
  joinedAt: string;
  project?: Project;
  user?: User;
}

export enum ProjectRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  MEMBER = "MEMBER",
  VIEWER = "VIEWER",
}

export interface Permission {
  resource: string;
  actions: string[];
}

export interface ProjectStats {
  totalBookings: number;
  totalRevenue: number;
  totalExpenses: number;
  occupancyRate: number;
  averageStayLength: number;
  lastUpdated: string;
}

// Property types
export interface Property {
  id: string;
  projectId: string;
  name: string;
  type: PropertyType;
  status: PropertyStatus;
  address?: Address;
  capacity: number;
  bedrooms?: number;
  bathrooms?: number;
  amenities: string[];
  rates: PropertyRates;
  images: PropertyImage[];
  createdAt: string;
  updatedAt: string;
}

export enum PropertyType {
  VILLA = "VILLA",
  APARTMENT = "APARTMENT",
  HOUSE = "HOUSE",
  CONDO = "CONDO",
  ROOM = "ROOM",
  SUITE = "SUITE",
}

export enum PropertyStatus {
  AVAILABLE = "AVAILABLE",
  OCCUPIED = "OCCUPIED",
  MAINTENANCE = "MAINTENANCE",
  BLOCKED = "BLOCKED",
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  country: string;
  postalCode?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface PropertyRates {
  baseRate: number;
  weekendRate?: number;
  seasonalRates?: SeasonalRate[];
  minimumStay?: number;
  maximumStay?: number;
}

export interface SeasonalRate {
  name: string;
  startDate: string;
  endDate: string;
  rate: number;
}

export interface PropertyImage {
  id: string;
  url: string;
  caption?: string;
  order: number;
  isMain: boolean;
}

// Booking types
export interface Booking {
  id: string;
  projectId: string;
  propertyId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  status: BookingStatus;
  source: BookingSource;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  notes?: string;
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
  property?: Property;
  payments?: Payment[];
}

export enum BookingStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  CHECKED_IN = "CHECKED_IN",
  CHECKED_OUT = "CHECKED_OUT",
  CANCELLED = "CANCELLED",
  NO_SHOW = "NO_SHOW",
}

export enum BookingSource {
  DIRECT = "DIRECT",
  AIRBNB = "AIRBNB",
  BOOKING_COM = "BOOKING_COM",
  VRBO = "VRBO",
  EXPEDIA = "EXPEDIA",
  WEBSITE = "WEBSITE",
  PHONE = "PHONE",
  WALK_IN = "WALK_IN",
  OTHER = "OTHER",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  PARTIAL = "PARTIAL",
  PAID = "PAID",
  REFUNDED = "REFUNDED",
  OVERDUE = "OVERDUE",
}

export enum PaymentMethod {
  CASH = "CASH",
  CREDIT_CARD = "CREDIT_CARD",
  DEBIT_CARD = "DEBIT_CARD",
  BANK_TRANSFER = "BANK_TRANSFER",
  PAYPAL = "PAYPAL",
  STRIPE = "STRIPE",
  OTHER = "OTHER",
}

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  processedAt: string;
  notes?: string;
}

// Financial types
export interface Expense {
  id: string;
  projectId: string;
  propertyId?: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  vendor?: string;
  date: string;
  paymentMethod: PaymentMethod;
  receiptUrl?: string;
  status: ExpenseStatus;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  property?: Property;
}

export enum ExpenseCategory {
  UTILITIES = "UTILITIES",
  MAINTENANCE = "MAINTENANCE",
  SUPPLIES = "SUPPLIES",
  CLEANING = "CLEANING",
  MARKETING = "MARKETING",
  INSURANCE = "INSURANCE",
  TAXES = "TAXES",
  SALARIES = "SALARIES",
  COMMISSIONS = "COMMISSIONS",
  OTHER = "OTHER",
}

export enum ExpenseStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  PAID = "PAID",
  REIMBURSED = "REIMBURSED",
}

// Common utility types
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface FilterParams {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string[];
  [key: string]: any;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path?: string;
}

export interface SuccessResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
}

// Form types
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface TableColumn<T = any> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (value: any, row: T) => React.ReactNode;
}

// Notification types
export interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// File upload types
export interface FileUpload {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  url?: string;
}

// Date range types
export interface DateRange {
  from: Date | string;
  to: Date | string;
}

// Availability system types
export interface DayAvailability {
  date: string; // ISO date string (YYYY-MM-DD)
  available: boolean; // Whether the property is available
  price?: number; // Optional price for the day
  bookingId?: string; // ID of booking that makes it unavailable
  minimumStay?: number; // Minimum stay requirement
  reason?: string; // Reason for unavailability
}

export interface CalendarAvailability {
  year: number;
  month: number;
  properties: Map<string, DayAvailability[]>; // propertyId -> daily availability
  totalDays: number;
}

// Dashboard types
export interface DashboardStats {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  occupancyRate: number;
  averageNightlyRate: number;
  totalBookings: number;
  upcomingCheckIns: number;
  upcomingCheckOuts: number;
  revenueGrowth: number;
  expenseGrowth: number;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
  }[];
}

// Activity log types
export interface ActivityLog {
  id: string;
  userId: string;
  projectId: string;
  action: string;
  resource: string;
  resourceId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: User;
}

// Guest types
export interface Guest {
  id: string;
  projectId: string;
  name: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  address?: Address;
  nationality?: string;
  documentType?: GuestDocumentType;
  documentNumber?: string;
  birthDate?: string;
  preferences?: GuestPreferences;
  notes?: string;
  tags?: string[];
  vipStatus?: boolean;
  blacklisted?: boolean;
  totalBookings?: number;
  totalSpent?: number;
  lastBookingDate?: string;
  createdAt: string;
  updatedAt: string;
}

export enum GuestDocumentType {
  PASSPORT = "PASSPORT",
  NATIONAL_ID = "NATIONAL_ID",
  DRIVERS_LICENSE = "DRIVERS_LICENSE",
  OTHER = "OTHER",
}

export interface GuestPreferences {
  roomType?: PropertyType;
  amenities?: string[];
  dietaryRestrictions?: string[];
  specialRequests?: string[];
  preferredFloor?: string;
  bedType?: string;
  smokingPreference?: "SMOKING" | "NON_SMOKING";
}

export interface CreateGuestData {
  name: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  address?: Address;
  nationality?: string;
  documentType?: GuestDocumentType;
  documentNumber?: string;
  birthDate?: string;
  preferences?: GuestPreferences;
  notes?: string;
  tags?: string[];
  vipStatus?: boolean;
}

export interface UpdateGuestData extends Partial<CreateGuestData> {
  blacklisted?: boolean;
}

// Extended Booking types for store
export interface CreateBookingData {
  propertyId: string;
  guestId?: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  source: BookingSource;
  totalAmount: number;
  paidAmount?: number;
  paymentMethod?: PaymentMethod;
  notes?: string;
  specialRequests?: string;
}

export interface UpdateBookingData extends Partial<CreateBookingData> {
  status?: BookingStatus;
  paymentStatus?: PaymentStatus;
}

export interface BookingCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  propertyId: string;
  propertyName: string;
  status: BookingStatus;
  guestName: string;
  totalAmount: number;
  color?: string;
}

export interface BookingTimelineData {
  propertyId: string;
  propertyName: string;
  bookings: Array<{
    id: string;
    guestName: string;
    start: Date;
    end: Date;
    status: BookingStatus;
  }>;
}

// Extended Expense types for store
export interface CreateExpenseData {
  propertyId?: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  vendor?: string;
  date: string;
  paymentMethod: PaymentMethod;
  receiptUrl?: string;
  notes?: string;
  tags?: string[];
}

export interface UpdateExpenseData extends Partial<CreateExpenseData> {
  status?: ExpenseStatus;
}

export interface ExpenseSummary {
  totalAmount: number;
  byCategory: Record<ExpenseCategory, number>;
  byMonth: Record<string, number>;
  byProperty: Record<string, number>;
  averageMonthly: number;
  topVendors: Array<{ vendor: string; amount: number; count: number }>;
}

export interface OfflineExpense {
  tempId: string;
  data: CreateExpenseData;
  timestamp: number;
  retryCount: number;
  error?: string;
}
