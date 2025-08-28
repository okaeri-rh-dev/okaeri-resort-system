/**
 * Zod Validation Schemas
 *
 * Comprehensive runtime validation schemas for the Okaeri Resort Management System.
 * These schemas ensure data integrity, provide business rule enforcement, and include
 * Philippine-specific validations for phone numbers, currency, and locale requirements.
 */

import { z } from "zod";
import {
  USER_ROLES,
  BOOKING_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  EXPENSE_STATUS,
  AUDIT_CATEGORIES,
  AUDIT_SEVERITIES,
  DATABASE_LIMITS,
  PHILIPPINE_CONSTANTS,
} from "./database";

// ====================================
// BASE VALIDATION SCHEMAS
// ====================================

/**
 * UUID validation schema
 */
export const UuidSchema = z.string().uuid({
  message: "Invalid UUID format",
});

/**
 * ISO datetime validation schema
 */
export const TimestampSchema = z.string().datetime({
  message: "Invalid ISO datetime format",
});

/**
 * Philippine peso amount validation schema
 */
export const PhpAmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Invalid PHP amount format (must be decimal with up to 2 places)")
  .refine((val) => {
    const amount = parseFloat(val);
    return amount >= 0 && amount <= 999999999.99;
  }, "Amount must be between 0 and 999,999,999.99");

/**
 * Philippine phone number validation schema
 */
export const PhilippinePhoneSchema = z
  .string()
  .regex(
    /^(\+63|63|0)?[89]\d{9}$|^(\+63|63|0)?[2-8]\d{7}$/,
    "Invalid Philippine phone number format"
  )
  .transform((phone) => {
    // Normalize phone number to +63 format
    let normalized = phone.replace(/^0/, "63");
    if (!normalized.startsWith("+")) {
      normalized = `+${normalized}`;
    }
    if (normalized.startsWith("+630")) {
      normalized = normalized.replace("+630", "+63");
    }
    return normalized;
  });

/**
 * Email validation schema
 */
export const EmailSchema = z
  .string()
  .email("Invalid email format")
  .max(
    DATABASE_LIMITS.EMAIL_MAX_LENGTH,
    `Email must be ${DATABASE_LIMITS.EMAIL_MAX_LENGTH} characters or less`
  );

/**
 * Slug validation schema
 */
export const SlugSchema = z
  .string()
  .min(1, "Slug is required")
  .max(
    DATABASE_LIMITS.SLUG_MAX_LENGTH,
    `Slug must be ${DATABASE_LIMITS.SLUG_MAX_LENGTH} characters or less`
  )
  .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
  .refine(
    (val) => !val.startsWith("-") && !val.endsWith("-"),
    "Slug cannot start or end with hyphen"
  )
  .refine((val) => !val.includes("--"), "Slug cannot contain consecutive hyphens");

/**
 * Password validation schema
 */
export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be 128 characters or less")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    "Password must contain at least one uppercase letter, one lowercase letter, and one number"
  );

/**
 * Coordinates validation schema
 */
export const CoordinatesSchema = z.object({
  lat: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  lng: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
});

// ====================================
// ENUM SCHEMAS
// ====================================

export const UserRoleSchema = z.enum(Object.values(USER_ROLES) as [string, ...string[]]);
export const BookingStatusSchema = z.enum(Object.values(BOOKING_STATUS) as [string, ...string[]]);
export const PaymentStatusSchema = z.enum(Object.values(PAYMENT_STATUS) as [string, ...string[]]);
export const PaymentMethodSchema = z.enum(Object.values(PAYMENT_METHODS) as [string, ...string[]]);
export const ExpenseStatusSchema = z.enum(Object.values(EXPENSE_STATUS) as [string, ...string[]]);
export const AuditCategorySchema = z.enum(Object.values(AUDIT_CATEGORIES) as [string, ...string[]]);
export const AuditSeveritySchema = z.enum(Object.values(AUDIT_SEVERITIES) as [string, ...string[]]);

// ====================================
// USER SCHEMAS
// ====================================

export const UserPreferencesSchema = z.object({
  language: z.enum(["en", "fil"]).optional(),
  timezone: z.string().optional(),
  notifications: z
    .object({
      email: z.boolean(),
      sms: z.boolean(),
      push: z.boolean(),
    })
    .optional(),
});

export const LoginAttemptSchema = z.object({
  timestamp: TimestampSchema,
  ipAddress: z.string().ip(),
  userAgent: z.string(),
  success: z.boolean(),
});

export const UserSchema = z.object({
  id: UuidSchema,
  email: EmailSchema,
  passwordHash: z.string(),
  firstName: z.string().min(1, "First name is required").max(DATABASE_LIMITS.NAME_MAX_LENGTH),
  lastName: z.string().min(1, "Last name is required").max(DATABASE_LIMITS.NAME_MAX_LENGTH),
  phone: PhilippinePhoneSchema.nullable(),
  avatarUrl: z.string().url().nullable(),
  isActive: z.boolean(),
  isEmailVerified: z.boolean(),
  emailVerificationToken: z.string().nullable(),
  emailVerificationExpiry: TimestampSchema.nullable(),
  passwordResetToken: z.string().nullable(),
  passwordResetExpiry: TimestampSchema.nullable(),
  lastLoginAt: TimestampSchema.nullable(),
  loginAttempts: z.array(LoginAttemptSchema),
  preferences: UserPreferencesSchema,
  metadata: z.record(z.unknown()),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateUserSchema = UserSchema.pick({
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
}).extend({
  password: PasswordSchema,
  avatarUrl: z.string().url().optional(),
  preferences: UserPreferencesSchema.optional(),
});

export const UpdateUserSchema = CreateUserSchema.partial()
  .omit({ password: true })
  .extend({
    currentPassword: z.string().min(1).optional(),
    newPassword: PasswordSchema.optional(),
  })
  .refine(
    (data) => {
      // If newPassword is provided, currentPassword is required
      if (data.newPassword && !data.currentPassword) {
        return false;
      }
      return true;
    },
    {
      message: "Current password is required when setting a new password",
      path: ["currentPassword"],
    }
  );

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, "Password is required"),
});

export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: PasswordSchema,
});

// ====================================
// PROJECT SCHEMAS
// ====================================

export const ProjectSocialMediaSchema = z.object({
  facebook: z.string().url().optional(),
  instagram: z.string().url().optional(),
  twitter: z.string().url().optional(),
});

export const ProjectBookingRulesSchema = z.object({
  advanceBookingDays: z.number().int().min(0).max(365).optional(),
  cancellationHours: z.number().int().min(DATABASE_LIMITS.MIN_CANCELLATION_HOURS).optional(),
  requireDeposit: z.boolean().optional(),
  depositPercentage: z.number().min(0).max(DATABASE_LIMITS.MAX_DEPOSIT_PERCENTAGE).optional(),
});

export const ProjectPaymentMethodsSchema = z.object({
  cash: z.boolean().optional(),
  gcash: z.boolean().optional(),
  bankTransfer: z.boolean().optional(),
  creditCard: z.boolean().optional(),
});

export const ProjectNotificationSettingsSchema = z.object({
  bookingConfirmation: z.boolean().optional(),
  paymentReceived: z.boolean().optional(),
  dailyReport: z.boolean().optional(),
});

export const ProjectSettingsSchema = z.object({
  bookingRules: ProjectBookingRulesSchema.optional(),
  paymentMethods: ProjectPaymentMethodsSchema.optional(),
  notifications: ProjectNotificationSettingsSchema.optional(),
});

export const ProjectSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1, "Project name is required").max(DATABASE_LIMITS.SLUG_MAX_LENGTH),
  slug: SlugSchema,
  schemaName: z.string().min(1).max(DATABASE_LIMITS.SCHEMA_NAME_MAX_LENGTH),
  ownerId: UuidSchema,
  businessType: z.string().default("resort"),
  description: z.string().nullable(),
  logo: z.string().url().nullable(),
  coverImage: z.string().url().nullable(),
  businessName: z.string().max(DATABASE_LIMITS.SLUG_MAX_LENGTH).nullable(),
  businessRegistrationNumber: z.string().max(100).nullable(),
  taxIdentificationNumber: z.string().max(100).nullable(),
  address: z.string().nullable(),
  city: z.string().max(100).nullable(),
  province: z.string().max(100).nullable(),
  postalCode: z.string().max(10).nullable(),
  country: z.string().length(2).default(PHILIPPINE_CONSTANTS.COUNTRY_CODE),
  coordinates: CoordinatesSchema.nullable(),
  contactEmail: EmailSchema.nullable(),
  contactPhone: PhilippinePhoneSchema.nullable(),
  website: z.string().url().nullable(),
  socialMedia: ProjectSocialMediaSchema,
  currency: z.string().length(3).default(PHILIPPINE_CONSTANTS.CURRENCY),
  timezone: z.string().default(PHILIPPINE_CONSTANTS.TIMEZONE),
  settings: ProjectSettingsSchema,
  isActive: z.boolean(),
  isPaid: z.boolean(),
  trialEndsAt: TimestampSchema.nullable(),
  suspendedAt: TimestampSchema.nullable(),
  suspensionReason: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateProjectSchema = ProjectSchema.pick({
  name: true,
  businessType: true,
  description: true,
  logo: true,
  coverImage: true,
  businessName: true,
  businessRegistrationNumber: true,
  taxIdentificationNumber: true,
  address: true,
  city: true,
  province: true,
  postalCode: true,
  coordinates: true,
  contactEmail: true,
  contactPhone: true,
  website: true,
  socialMedia: true,
  currency: true,
  timezone: true,
  settings: true,
}).extend({
  slug: SlugSchema,
});

export const UpdateProjectSchema = CreateProjectSchema.partial().omit({ slug: true });

// ====================================
// USER PROJECT PERMISSION SCHEMAS
// ====================================

export const PermissionActionsSchema = z.object({
  view: z.boolean().optional(),
  create: z.boolean().optional(),
  update: z.boolean().optional(),
  delete: z.boolean().optional(),
});

export const ResourcePermissionsSchema = z.object({
  bookings: PermissionActionsSchema.optional(),
  payments: PermissionActionsSchema.optional(),
  expenses: PermissionActionsSchema.optional(),
  reports: z
    .object({
      view: z.boolean().optional(),
      export: z.boolean().optional(),
    })
    .optional(),
  settings: z
    .object({
      view: z.boolean().optional(),
      update: z.boolean().optional(),
    })
    .optional(),
  users: z
    .object({
      view: z.boolean().optional(),
      invite: z.boolean().optional(),
      remove: z.boolean().optional(),
      updateRoles: z.boolean().optional(),
    })
    .optional(),
});

export const UserProjectPermissionSchema = z.object({
  userId: UuidSchema,
  projectId: UuidSchema,
  role: UserRoleSchema,
  permissions: ResourcePermissionsSchema,
  invitedBy: UuidSchema.nullable(),
  invitedAt: TimestampSchema.nullable(),
  acceptedAt: TimestampSchema.nullable(),
  invitationToken: z.string().nullable(),
  invitationExpiry: TimestampSchema.nullable(),
  isActive: z.boolean(),
  lastAccessedAt: TimestampSchema.nullable(),
  metadata: z.record(z.unknown()),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateUserProjectPermissionSchema = UserProjectPermissionSchema.pick({
  userId: true,
  projectId: true,
  role: true,
  permissions: true,
  invitedBy: true,
});

export const UpdateUserProjectPermissionSchema = CreateUserProjectPermissionSchema.partial().omit({
  userId: true,
  projectId: true,
});

export const InviteUserSchema = z.object({
  email: EmailSchema,
  role: UserRoleSchema,
  permissions: ResourcePermissionsSchema.optional(),
  message: z.string().max(500).optional(),
});

// ====================================
// BOOKING SCHEMAS
// ====================================

export const BookingSchema = z
  .object({
    id: UuidSchema,
    bookingCode: z.string().min(1),
    guestName: z.string().min(1, "Guest name is required").max(DATABASE_LIMITS.SLUG_MAX_LENGTH),
    guestEmail: EmailSchema.nullable(),
    guestPhone: PhilippinePhoneSchema,
    guestAddress: z.string().nullable(),
    numberOfGuests: z
      .number()
      .int()
      .min(1, "At least 1 guest is required")
      .max(50, "Maximum 50 guests allowed"),
    numberOfChildren: z.number().int().min(0).max(20),
    checkInDate: z.string().date("Invalid check-in date"),
    checkOutDate: z.string().date("Invalid check-out date"),
    checkInTime: z.string().time().nullable(),
    checkOutTime: z.string().time().nullable(),
    roomType: z.string().max(100).nullable(),
    roomNumber: z.string().max(50).nullable(),
    basePrice: PhpAmountSchema,
    additionalCharges: PhpAmountSchema,
    discountAmount: PhpAmountSchema,
    taxAmount: PhpAmountSchema,
    totalAmount: PhpAmountSchema,
    depositAmount: PhpAmountSchema,
    paidAmount: PhpAmountSchema,
    balanceAmount: PhpAmountSchema,
    status: BookingStatusSchema,
    paymentStatus: PaymentStatusSchema,
    specialRequests: z.string().nullable(),
    internalNotes: z.string().nullable(),
    cancellationReason: z.string().nullable(),
    cancelledAt: TimestampSchema.nullable(),
    cancelledBy: UuidSchema.nullable(),
    source: z.string().max(50).default("direct"),
    metadata: z.record(z.unknown()),
    createdBy: UuidSchema.nullable(),
    updatedBy: UuidSchema.nullable(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .refine(
    (data) => {
      // Check-out date must be after check-in date
      const checkIn = new Date(data.checkInDate);
      const checkOut = new Date(data.checkOutDate);
      return checkOut > checkIn;
    },
    {
      message: "Check-out date must be after check-in date",
      path: ["checkOutDate"],
    }
  )
  .refine(
    (data) => {
      // Total amount should equal base price + additional charges - discount + tax
      const calculated =
        parseFloat(data.basePrice) +
        parseFloat(data.additionalCharges) -
        parseFloat(data.discountAmount) +
        parseFloat(data.taxAmount);
      const total = parseFloat(data.totalAmount);
      return Math.abs(calculated - total) < 0.01; // Allow for rounding differences
    },
    {
      message: "Total amount calculation is incorrect",
      path: ["totalAmount"],
    }
  )
  .refine(
    (data) => {
      // Balance amount should equal total - paid amount
      const balance = parseFloat(data.totalAmount) - parseFloat(data.paidAmount);
      return Math.abs(balance - parseFloat(data.balanceAmount)) < 0.01;
    },
    {
      message: "Balance amount calculation is incorrect",
      path: ["balanceAmount"],
    }
  );

export const CreateBookingSchema = BookingSchema.pick({
  guestName: true,
  guestEmail: true,
  guestPhone: true,
  guestAddress: true,
  numberOfGuests: true,
  numberOfChildren: true,
  checkInDate: true,
  checkOutDate: true,
  checkInTime: true,
  checkOutTime: true,
  roomType: true,
  roomNumber: true,
  basePrice: true,
  additionalCharges: true,
  discountAmount: true,
  taxAmount: true,
  totalAmount: true,
  depositAmount: true,
  specialRequests: true,
  internalNotes: true,
  source: true,
}).extend({
  // Auto-calculate these fields
  paidAmount: PhpAmountSchema.default("0.00"),
  balanceAmount: PhpAmountSchema.optional(), // Will be calculated from total - paid
});

export const UpdateBookingSchema = CreateBookingSchema.partial().extend({
  status: BookingStatusSchema.optional(),
  paymentStatus: PaymentStatusSchema.optional(),
  cancellationReason: z.string().optional(),
});

// ====================================
// PAYMENT SCHEMAS
// ====================================

export const PaymentSchema = z
  .object({
    id: UuidSchema,
    bookingId: UuidSchema.nullable(),
    paymentCode: z.string().min(1),
    amount: PhpAmountSchema.refine(
      (val) => parseFloat(val) > 0,
      "Payment amount must be greater than 0"
    ),
    paymentMethod: PaymentMethodSchema,
    paymentType: z.enum(["deposit", "partial", "full", "refund"]),
    transactionId: z.string().max(100).nullable(),
    referenceNumber: z.string().max(100).nullable(),
    gcashReferenceNumber: z.string().max(50).nullable(),
    gcashAccountName: z.string().max(DATABASE_LIMITS.SLUG_MAX_LENGTH).nullable(),
    gcashAccountNumber: PhilippinePhoneSchema.nullable(),
    bankName: z.string().max(100).nullable(),
    bankAccountNumber: z.string().max(50).nullable(),
    bankAccountName: z.string().max(DATABASE_LIMITS.SLUG_MAX_LENGTH).nullable(),
    status: PaymentStatusSchema,
    verifiedAt: TimestampSchema.nullable(),
    verifiedBy: UuidSchema.nullable(),
    receiptNumber: z.string().max(50).nullable(),
    receiptUrl: z.string().url().nullable(),
    notes: z.string().nullable(),
    failureReason: z.string().nullable(),
    metadata: z.record(z.unknown()),
    processedBy: UuidSchema.nullable(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .refine(
    (data) => {
      // GCash payments should have GCash-specific fields
      if (data.paymentMethod === "gcash") {
        return data.gcashAccountNumber || data.gcashReferenceNumber;
      }
      return true;
    },
    {
      message: "GCash payments require account number or reference number",
      path: ["gcashAccountNumber"],
    }
  )
  .refine(
    (data) => {
      // Bank transfer payments should have bank-specific fields
      if (data.paymentMethod === "bank_transfer") {
        return data.bankName && data.bankAccountNumber;
      }
      return true;
    },
    {
      message: "Bank transfer payments require bank name and account number",
      path: ["bankName"],
    }
  );

export const CreatePaymentSchema = PaymentSchema.pick({
  bookingId: true,
  amount: true,
  paymentMethod: true,
  paymentType: true,
  transactionId: true,
  referenceNumber: true,
  gcashReferenceNumber: true,
  gcashAccountName: true,
  gcashAccountNumber: true,
  bankName: true,
  bankAccountNumber: true,
  bankAccountName: true,
  receiptNumber: true,
  receiptUrl: true,
  notes: true,
});

export const UpdatePaymentSchema = CreatePaymentSchema.partial().extend({
  status: PaymentStatusSchema.optional(),
  failureReason: z.string().optional(),
});

// ====================================
// EXPENSE CATEGORY SCHEMAS
// ====================================

export const ExpenseCategorySchema = z.object({
  id: UuidSchema,
  name: z.string().min(1, "Category name is required").max(100),
  slug: SlugSchema,
  description: z.string().nullable(),
  parentId: UuidSchema.nullable(),
  icon: z.string().max(50).nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex code")
    .nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0),
  metadata: z.record(z.unknown()),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateExpenseCategorySchema = ExpenseCategorySchema.pick({
  name: true,
  slug: true,
  description: true,
  parentId: true,
  icon: true,
  color: true,
  sortOrder: true,
});

export const UpdateExpenseCategorySchema = CreateExpenseCategorySchema.partial();

// ====================================
// EXPENSE SCHEMAS
// ====================================

export const ExpenseAttachmentSchema = z.object({
  url: z.string().url(),
  filename: z.string().min(1),
  size: z
    .number()
    .int()
    .min(1)
    .max(DATABASE_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024),
  mimeType: z.string().min(1),
});

export const ExpenseSchema = z
  .object({
    id: UuidSchema,
    expenseCode: z.string().min(1),
    categoryId: UuidSchema,
    description: z.string().min(1, "Description is required"),
    amount: PhpAmountSchema.refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
    quantity: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .default("1.00"),
    unitPrice: PhpAmountSchema.nullable(),
    paymentMethod: PaymentMethodSchema.nullable(),
    paymentStatus: z.enum(["pending", "paid", "partial"]).default("paid"),
    paidAt: TimestampSchema.nullable(),
    vendorName: z.string().max(DATABASE_LIMITS.SLUG_MAX_LENGTH).nullable(),
    vendorContact: z.string().max(DATABASE_LIMITS.SLUG_MAX_LENGTH).nullable(),
    invoiceNumber: z.string().max(100).nullable(),
    invoiceDate: z.string().date().nullable(),
    dueDate: z.string().date().nullable(),
    status: ExpenseStatusSchema,
    approvedBy: UuidSchema.nullable(),
    approvedAt: TimestampSchema.nullable(),
    rejectionReason: z.string().nullable(),
    receiptUrl: z.string().url().nullable(),
    attachments: z.array(ExpenseAttachmentSchema),
    isRecurring: z.boolean(),
    recurringFrequency: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]).nullable(),
    nextRecurringDate: z.string().date().nullable(),
    notes: z.string().nullable(),
    tags: z.array(z.string()),
    metadata: z.record(z.unknown()),
    createdBy: UuidSchema.nullable(),
    updatedBy: UuidSchema.nullable(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .refine(
    (data) => {
      // If recurring, frequency is required
      if (data.isRecurring && !data.recurringFrequency) {
        return false;
      }
      return true;
    },
    {
      message: "Recurring frequency is required for recurring expenses",
      path: ["recurringFrequency"],
    }
  )
  .refine(
    (data) => {
      // If invoice date is provided, due date should be after or equal
      if (data.invoiceDate && data.dueDate) {
        return new Date(data.dueDate) >= new Date(data.invoiceDate);
      }
      return true;
    },
    {
      message: "Due date must be after or equal to invoice date",
      path: ["dueDate"],
    }
  );

export const CreateExpenseSchema = ExpenseSchema.pick({
  categoryId: true,
  description: true,
  amount: true,
  quantity: true,
  unitPrice: true,
  paymentMethod: true,
  paymentStatus: true,
  paidAt: true,
  vendorName: true,
  vendorContact: true,
  invoiceNumber: true,
  invoiceDate: true,
  dueDate: true,
  receiptUrl: true,
  attachments: true,
  isRecurring: true,
  recurringFrequency: true,
  notes: true,
  tags: true,
});

export const UpdateExpenseSchema = CreateExpenseSchema.partial().extend({
  status: ExpenseStatusSchema.optional(),
  rejectionReason: z.string().optional(),
});

// ====================================
// INCOME SCHEMAS
// ====================================

export const IncomeSchema = z.object({
  id: UuidSchema,
  incomeCode: z.string().min(1),
  source: z.string().max(100),
  bookingId: UuidSchema.nullable(),
  description: z.string().min(1, "Description is required"),
  amount: PhpAmountSchema.refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
  quantity: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .default("1.00"),
  unitPrice: PhpAmountSchema.nullable(),
  paymentMethod: PaymentMethodSchema.nullable(),
  paymentStatus: z.enum(["pending", "received", "refunded"]).default("received"),
  receivedAt: TimestampSchema,
  customerName: z.string().max(DATABASE_LIMITS.SLUG_MAX_LENGTH).nullable(),
  customerContact: z.string().max(DATABASE_LIMITS.SLUG_MAX_LENGTH).nullable(),
  receiptNumber: z.string().max(50).nullable(),
  receiptUrl: z.string().url().nullable(),
  category: z.string().max(100).nullable(),
  tags: z.array(z.string()),
  notes: z.string().nullable(),
  metadata: z.record(z.unknown()),
  recordedBy: UuidSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CreateIncomeSchema = IncomeSchema.pick({
  source: true,
  bookingId: true,
  description: true,
  amount: true,
  quantity: true,
  unitPrice: true,
  paymentMethod: true,
  paymentStatus: true,
  receivedAt: true,
  customerName: true,
  customerContact: true,
  receiptNumber: true,
  receiptUrl: true,
  category: true,
  tags: true,
  notes: true,
});

export const UpdateIncomeSchema = CreateIncomeSchema.partial();

// ====================================
// AUDIT LOG SCHEMAS
// ====================================

export const AuditLogSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema.nullable(),
  projectId: UuidSchema.nullable(),
  action: z.string().max(100),
  category: AuditCategorySchema,
  severity: AuditSeveritySchema,
  ipAddress: z.string().ip({ version: "v4" }).nullable(),
  userAgent: z.string().nullable(),
  requestMethod: z.string().max(10).nullable(),
  requestPath: z.string().nullable(),
  requestId: UuidSchema.nullable(),
  entityType: z.string().max(50).nullable(),
  entityId: UuidSchema.nullable(),
  oldValues: z.record(z.unknown()),
  newValues: z.record(z.unknown()),
  success: z.boolean(),
  errorMessage: z.string().nullable(),
  errorStack: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: TimestampSchema,
});

export const CreateAuditLogSchema = AuditLogSchema.pick({
  userId: true,
  projectId: true,
  action: true,
  category: true,
  severity: true,
  ipAddress: true,
  userAgent: true,
  requestMethod: true,
  requestPath: true,
  requestId: true,
  entityType: true,
  entityId: true,
  oldValues: true,
  newValues: true,
  success: true,
  errorMessage: true,
  errorStack: true,
  metadata: true,
});

// ====================================
// PAGINATION SCHEMAS
// ====================================

export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(DATABASE_LIMITS.MAX_PAGE_SIZE)
    .default(DATABASE_LIMITS.DEFAULT_PAGE_SIZE),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const FilterParamsSchema = z.object({
  search: z.string().optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  status: z.array(z.string()).optional(),
});

export const PaginationMetaSchema = z.object({
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  totalPages: z.number().int().min(0),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    meta: PaginationMetaSchema,
  });

// ====================================
// FILE UPLOAD SCHEMAS
// ====================================

export const FileUploadSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  size: z
    .number()
    .int()
    .min(1)
    .max(
      DATABASE_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024,
      `File size must not exceed ${DATABASE_LIMITS.MAX_FILE_SIZE_MB}MB`
    ),
  mimeType: z.string().min(1),
  url: z.string().url(),
});

export const ImageUploadSchema = FileUploadSchema.extend({
  mimeType: z.enum(DATABASE_LIMITS.ALLOWED_IMAGE_TYPES as [string, ...string[]]),
});

export const DocumentUploadSchema = FileUploadSchema.extend({
  mimeType: z.enum(DATABASE_LIMITS.ALLOWED_DOCUMENT_TYPES as [string, ...string[]]),
});

// ====================================
// SEARCH AND FILTER SCHEMAS
// ====================================

export const BookingSearchSchema = FilterParamsSchema.extend({
  status: z.array(BookingStatusSchema).optional(),
  paymentStatus: z.array(PaymentStatusSchema).optional(),
  source: z.string().optional(),
  guestName: z.string().optional(),
  roomType: z.string().optional(),
});

export const PaymentSearchSchema = FilterParamsSchema.extend({
  status: z.array(PaymentStatusSchema).optional(),
  method: z.array(PaymentMethodSchema).optional(),
  type: z.array(z.enum(["deposit", "partial", "full", "refund"])).optional(),
  bookingId: UuidSchema.optional(),
});

export const ExpenseSearchSchema = FilterParamsSchema.extend({
  status: z.array(ExpenseStatusSchema).optional(),
  categoryId: UuidSchema.optional(),
  paymentMethod: z.array(PaymentMethodSchema).optional(),
  paymentStatus: z.array(z.enum(["pending", "paid", "partial"])).optional(),
  vendorName: z.string().optional(),
  isRecurring: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export const IncomeSearchSchema = FilterParamsSchema.extend({
  source: z.string().optional(),
  category: z.string().optional(),
  paymentMethod: z.array(PaymentMethodSchema).optional(),
  paymentStatus: z.array(z.enum(["pending", "received", "refunded"])).optional(),
  bookingId: UuidSchema.optional(),
  tags: z.array(z.string()).optional(),
});

export const UserSearchSchema = FilterParamsSchema.extend({
  role: z.array(UserRoleSchema).optional(),
  isActive: z.boolean().optional(),
  isEmailVerified: z.boolean().optional(),
});

export const ProjectSearchSchema = FilterParamsSchema.extend({
  businessType: z.string().optional(),
  isActive: z.boolean().optional(),
  isPaid: z.boolean().optional(),
  ownerId: UuidSchema.optional(),
});

// ====================================
// BATCH OPERATION SCHEMAS
// ====================================

export const BatchDeleteSchema = z.object({
  ids: z
    .array(UuidSchema)
    .min(1, "At least one ID is required")
    .max(100, "Maximum 100 items can be deleted at once"),
});

export const BatchUpdateStatusSchema = z.object({
  ids: z
    .array(UuidSchema)
    .min(1, "At least one ID is required")
    .max(100, "Maximum 100 items can be updated at once"),
  status: z.string().min(1, "Status is required"),
});

// ====================================
// TYPE INFERENCE EXPORTS
// ====================================

export type UserInput = z.infer<typeof UserSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export type ProjectInput = z.infer<typeof ProjectSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export type UserProjectPermissionInput = z.infer<typeof UserProjectPermissionSchema>;
export type CreateUserProjectPermissionInput = z.infer<typeof CreateUserProjectPermissionSchema>;
export type UpdateUserProjectPermissionInput = z.infer<typeof UpdateUserProjectPermissionSchema>;
export type InviteUserInput = z.infer<typeof InviteUserSchema>;

export type BookingInput = z.infer<typeof BookingSchema>;
export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;
export type UpdateBookingInput = z.infer<typeof UpdateBookingSchema>;

export type PaymentInput = z.infer<typeof PaymentSchema>;
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof UpdatePaymentSchema>;

export type ExpenseCategoryInput = z.infer<typeof ExpenseCategorySchema>;
export type CreateExpenseCategoryInput = z.infer<typeof CreateExpenseCategorySchema>;
export type UpdateExpenseCategoryInput = z.infer<typeof UpdateExpenseCategorySchema>;

export type ExpenseInput = z.infer<typeof ExpenseSchema>;
export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>;

export type IncomeInput = z.infer<typeof IncomeSchema>;
export type CreateIncomeInput = z.infer<typeof CreateIncomeSchema>;
export type UpdateIncomeInput = z.infer<typeof UpdateIncomeSchema>;

export type AuditLogInput = z.infer<typeof AuditLogSchema>;
export type CreateAuditLogInput = z.infer<typeof CreateAuditLogSchema>;

export type PaginationParams = z.infer<typeof PaginationParamsSchema>;
export type FilterParams = z.infer<typeof FilterParamsSchema>;
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

export type FileUpload = z.infer<typeof FileUploadSchema>;
export type ImageUpload = z.infer<typeof ImageUploadSchema>;
export type DocumentUpload = z.infer<typeof DocumentUploadSchema>;

export type BookingSearchParams = z.infer<typeof BookingSearchSchema>;
export type PaymentSearchParams = z.infer<typeof PaymentSearchSchema>;
export type ExpenseSearchParams = z.infer<typeof ExpenseSearchSchema>;
export type IncomeSearchParams = z.infer<typeof IncomeSearchSchema>;
export type UserSearchParams = z.infer<typeof UserSearchSchema>;
export type ProjectSearchParams = z.infer<typeof ProjectSearchSchema>;

export type BatchDeleteInput = z.infer<typeof BatchDeleteSchema>;
export type BatchUpdateStatusInput = z.infer<typeof BatchUpdateStatusSchema>;
