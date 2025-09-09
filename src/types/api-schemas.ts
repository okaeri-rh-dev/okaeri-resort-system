import { z } from "zod";
import {
  BookingStatus,
  BookingSource,
  PaymentStatus,
  PaymentMethod,
  PropertyStatus,
  PropertyType,
  ExpenseStatus,
  ExpenseCategory,
  UserRole,
  ProjectType,
  ProjectStatus,
  ProjectRole,
  GuestDocumentType,
} from "./common";

/**
 * API Response Validation Schemas
 * These schemas validate API responses at runtime to ensure type safety
 */

// Common schemas
export const AddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string(),
  postalCode: z.string().optional(),
  coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
});

export const PaginationMetaSchema = z.object({
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

export const PaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    meta: PaginationMetaSchema,
  });

// User and Auth schemas
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.nativeEnum(UserRole),
  avatar: z.string().url().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastLogin: z.string().datetime().optional(),
  projects: z
    .array(
      z.object({
        id: z.string().uuid(),
        projectId: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.nativeEnum(ProjectRole),
        joinedAt: z.string().datetime(),
      })
    )
    .optional(),
});

export const LoginResponseSchema = z.object({
  user: UserSchema,
  token: z.string(),
  refreshToken: z.string(),
});

export const RefreshTokenResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
});

// Project schemas
export const ProjectConfigSchema = z.object({
  currency: z.string(),
  timezone: z.string(),
  locale: z.string(),
  fiscalYearStart: z.string().optional(),
  features: z.object({
    bookings: z.boolean(),
    expenses: z.boolean(),
    reports: z.boolean(),
    analytics: z.boolean(),
    googleSheets: z.boolean(),
    csvImport: z.boolean(),
    apiAccess: z.boolean(),
  }),
  limits: z.object({
    maxProperties: z.number(),
    maxBookings: z.number(),
    maxUsers: z.number(),
    maxFileStorage: z.number(),
  }),
  customFields: z.record(z.any()).optional(),
});

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  type: z.nativeEnum(ProjectType),
  status: z.nativeEnum(ProjectStatus),
  config: ProjectConfigSchema,
  ownerId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  stats: z
    .object({
      totalBookings: z.number(),
      totalRevenue: z.number(),
      totalExpenses: z.number(),
      occupancyRate: z.number(),
      averageStayLength: z.number(),
      lastUpdated: z.string().datetime(),
    })
    .optional(),
});

// Property schemas
export const PropertyImageSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  caption: z.string().optional(),
  order: z.number(),
  isMain: z.boolean(),
});

export const SeasonalRateSchema = z.object({
  name: z.string(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  rate: z.number().positive(),
});

export const PropertyRatesSchema = z.object({
  baseRate: z.number().positive(),
  weekendRate: z.number().positive().optional(),
  seasonalRates: z.array(SeasonalRateSchema).optional(),
  minimumStay: z.number().positive().optional(),
  maximumStay: z.number().positive().optional(),
});

export const PropertySchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  type: z.nativeEnum(PropertyType),
  status: z.nativeEnum(PropertyStatus),
  address: AddressSchema.optional(),
  capacity: z.number().positive(),
  bedrooms: z.number().nonnegative().optional(),
  bathrooms: z.number().nonnegative().optional(),
  amenities: z.array(z.string()),
  rates: PropertyRatesSchema,
  images: z.array(PropertyImageSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Booking schemas
export const PaymentSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.nativeEnum(PaymentMethod),
  status: z.nativeEnum(PaymentStatus),
  transactionId: z.string().optional(),
  processedAt: z.string().datetime(),
  notes: z.string().optional(),
});

export const BookingSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  propertyId: z.string().uuid(),
  guestName: z.string(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  nights: z.number().positive(),
  guests: z.number().positive(),
  status: z.nativeEnum(BookingStatus),
  source: z.nativeEnum(BookingSource),
  totalAmount: z.number().nonnegative(),
  paidAmount: z.number().nonnegative(),
  paymentStatus: z.nativeEnum(PaymentStatus),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  notes: z.string().optional(),
  specialRequests: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  property: PropertySchema.optional(),
  payments: z.array(PaymentSchema).optional(),
});

// Expense schemas
export const ExpenseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  propertyId: z.string().uuid().optional(),
  category: z.nativeEnum(ExpenseCategory),
  amount: z.number().positive(),
  description: z.string(),
  vendor: z.string().optional(),
  date: z.string().datetime(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  receiptUrl: z.string().url().optional(),
  status: z.nativeEnum(ExpenseStatus),
  approvedBy: z.string().uuid().optional(),
  approvedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  property: PropertySchema.optional(),
});

// Dashboard schemas
export const DashboardStatsSchema = z.object({
  totalRevenue: z.number().nonnegative(),
  totalExpenses: z.number().nonnegative(),
  netIncome: z.number(),
  occupancyRate: z.number().min(0).max(100),
  averageNightlyRate: z.number().nonnegative(),
  totalBookings: z.number().nonnegative(),
  upcomingCheckIns: z.number().nonnegative(),
  upcomingCheckOuts: z.number().nonnegative(),
  revenueGrowth: z.number(),
  expenseGrowth: z.number(),
});

export const ChartDatasetSchema = z.object({
  label: z.string(),
  data: z.array(z.number()),
  backgroundColor: z.union([z.string(), z.array(z.string())]).optional(),
  borderColor: z.union([z.string(), z.array(z.string())]).optional(),
  borderWidth: z.number().optional(),
});

export const ChartDataSchema = z.object({
  labels: z.array(z.string()),
  datasets: z.array(ChartDatasetSchema),
});

// Guest schemas
export const GuestPreferencesSchema = z.object({
  roomType: z.nativeEnum(PropertyType).optional(),
  amenities: z.array(z.string()).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  specialRequests: z.array(z.string()).optional(),
  preferredFloor: z.string().optional(),
  bedType: z.string().optional(),
  smokingPreference: z.enum(["SMOKING", "NON_SMOKING"]).optional(),
});

export const GuestSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  alternatePhone: z.string().optional(),
  address: AddressSchema.optional(),
  nationality: z.string().optional(),
  documentType: z.nativeEnum(GuestDocumentType).optional(),
  documentNumber: z.string().optional(),
  birthDate: z.string().datetime().optional(),
  preferences: GuestPreferencesSchema.optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  vipStatus: z.boolean().optional(),
  blacklisted: z.boolean().optional(),
  totalBookings: z.number().nonnegative().optional(),
  totalSpent: z.number().nonnegative().optional(),
  lastBookingDate: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Export commonly used paginated response schemas
export const PaginatedBookingsSchema = PaginatedResponseSchema(BookingSchema);
export const PaginatedPropertiesSchema = PaginatedResponseSchema(PropertySchema);
export const PaginatedExpensesSchema = PaginatedResponseSchema(ExpenseSchema);
export const PaginatedGuestsSchema = PaginatedResponseSchema(GuestSchema);

// Simple arrays for recent data
export const RecentBookingsSchema = z.array(BookingSchema);
export const RecentExpensesSchema = z.array(ExpenseSchema);

// Error response schema
export const ApiErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
  timestamp: z.string().datetime(),
  path: z.string().optional(),
});

// Success response wrapper
export const SuccessResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: dataSchema,
  });

// Type exports for TypeScript usage
export type ApiUser = z.infer<typeof UserSchema>;
export type ApiLoginResponse = z.infer<typeof LoginResponseSchema>;
export type ApiProject = z.infer<typeof ProjectSchema>;
export type ApiProperty = z.infer<typeof PropertySchema>;
export type ApiBooking = z.infer<typeof BookingSchema>;
export type ApiExpense = z.infer<typeof ExpenseSchema>;
export type ApiDashboardStats = z.infer<typeof DashboardStatsSchema>;
export type ApiChartData = z.infer<typeof ChartDataSchema>;
export type ApiGuest = z.infer<typeof GuestSchema>;
export type ApiPaginatedResponse<T> = z.infer<
  ReturnType<typeof PaginatedResponseSchema<z.ZodType<T>>>
>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

/**
 * Schema registry for quick access to validation schemas by endpoint pattern
 */
export const API_SCHEMAS = {
  // Auth endpoints - Staff only
  "POST /auth/login": LoginResponseSchema,
  // "POST /auth/register" removed - staff accounts created by admin
  "POST /auth/refresh": RefreshTokenResponseSchema,
  "GET /auth/me": UserSchema,
  "PATCH /auth/profile": UserSchema,

  // Dashboard endpoints
  "GET /projects/:id/dashboard/stats": DashboardStatsSchema,
  "GET /projects/:id/dashboard/charts": ChartDataSchema,
  "GET /projects/:id/dashboard/recent-bookings": RecentBookingsSchema,
  "GET /projects/:id/dashboard/recent-expenses": RecentExpensesSchema,

  // Bookings endpoints
  "GET /projects/:id/bookings": PaginatedBookingsSchema,
  "GET /projects/:id/bookings/recent": RecentBookingsSchema,
  "GET /projects/:id/bookings/:bookingId": BookingSchema,
  "POST /projects/:id/bookings": BookingSchema,
  "PUT /projects/:id/bookings/:bookingId": BookingSchema,
  "PATCH /projects/:id/bookings/:bookingId": BookingSchema,

  // Properties endpoints
  "GET /projects/:id/properties": PaginatedPropertiesSchema,
  "GET /projects/:id/properties/:propertyId": PropertySchema,
  "POST /projects/:id/properties": PropertySchema,
  "PUT /projects/:id/properties/:propertyId": PropertySchema,
  "PATCH /projects/:id/properties/:propertyId": PropertySchema,

  // Expenses endpoints
  "GET /projects/:id/expenses": PaginatedExpensesSchema,
  "GET /projects/:id/expenses/recent": RecentExpensesSchema,
  "GET /projects/:id/expenses/:expenseId": ExpenseSchema,
  "POST /projects/:id/expenses": ExpenseSchema,
  "PUT /projects/:id/expenses/:expenseId": ExpenseSchema,
  "PATCH /projects/:id/expenses/:expenseId": ExpenseSchema,

  // Guests endpoints
  "GET /projects/:id/guests": PaginatedGuestsSchema,
  "GET /projects/:id/guests/:guestId": GuestSchema,
  "POST /projects/:id/guests": GuestSchema,
  "PUT /projects/:id/guests/:guestId": GuestSchema,
  "PATCH /projects/:id/guests/:guestId": GuestSchema,
} as const;

/**
 * Helper function to get schema for an endpoint
 */
export function getSchemaForEndpoint(method: string, path: string): z.ZodSchema | undefined {
  const normalizedPath = path
    .replace(/\/[a-f0-9-]{36}/g, "/:id")
    .replace(/\/[a-f0-9-]{36}/g, "/:id");
  const key = `${method} ${normalizedPath}` as keyof typeof API_SCHEMAS;
  return API_SCHEMAS[key];
}
