/**
 * Types Usage Examples
 *
 * This file demonstrates proper usage of the comprehensive TypeScript types
 * and Zod validation schemas in the Okaeri Resort Management System.
 *
 * These examples show real-world patterns for type-safe development.
 */

import { z } from "zod";
import {
  // Database types
  User,
  Booking,
  Payment,
  CreateUserInput,
  CreateBookingInput,
  CreatePaymentInput,
  EntityId,

  // Validation schemas
  UserSchema,
  CreateUserSchema,
  CreateBookingSchema,
  CreatePaymentSchema,
  PhilippinePhoneSchema,

  // API types
  ApiSuccessResponse,
  ApiPaginatedResponse,
  ApiError,
  createSuccessResponse,
  createErrorResponse,
  handleApiResponse,

  // Type guards
  isValidEntityId,
  isValidPhpAmount,
  hasAuditFields,
  isApiSuccessResponse,

  // Constants
  DATABASE_LIMITS,
  PHILIPPINE_CONSTANTS,
  API_ERROR_CODES,

  // Utility functions
  extractApiData,
} from "../types";

// ====================================
// 1. DATABASE ENTITY EXAMPLES
// ====================================

/**
 * Example: Creating a new user with proper typing
 */
function createUserExample() {
  // Type-safe user input with validation
  const userInput: CreateUserInput = {
    email: "john.doe@example.com",
    firstName: "John",
    lastName: "Doe",
    phone: "+639123456789", // Will be normalized to Philippine format
    password: "SecurePass123!",
    preferences: {
      language: "en",
      timezone: PHILIPPINE_CONSTANTS.TIMEZONE,
      notifications: {
        email: true,
        sms: false,
        push: true,
      },
    },
  };

  // Runtime validation ensures data integrity
  try {
    const validatedInput = CreateUserSchema.parse(userInput);
    console.log("✅ User input is valid:", validatedInput.email);

    // TypeScript knows the exact shape of validatedInput
    return validatedInput;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Validation failed:", error.issues);
      throw new Error(`Invalid user data: ${error.issues[0].message}`);
    }
    throw error;
  }
}

/**
 * Example: Creating a booking with business rule validation
 */
function createBookingExample() {
  const bookingInput: CreateBookingInput = {
    guestName: "Maria Santos",
    guestEmail: "maria@example.com",
    guestPhone: "09123456789", // Will be normalized to +639123456789
    numberOfGuests: 2,
    numberOfChildren: 1,
    checkInDate: "2024-03-01",
    checkOutDate: "2024-03-03",
    checkInTime: "14:00",
    checkOutTime: "12:00",
    roomType: "Deluxe Suite",
    basePrice: "3000.00",
    additionalCharges: "500.00",
    discountAmount: "200.00",
    taxAmount: "396.00", // 12% VAT on net amount
    totalAmount: "3696.00", // Will be validated for correct calculation
    depositAmount: "1000.00",
    specialRequests: "Late check-out requested",
    source: "website",
  };

  try {
    // This will validate:
    // - Date formats and logic (check-out after check-in)
    // - Philippine phone number format
    // - Amount calculations
    // - Required field presence
    const validatedBooking = CreateBookingSchema.parse(bookingInput);

    console.log("✅ Booking is valid for guest:", validatedBooking.guestName);
    return validatedBooking;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Booking validation failed:");
      error.issues.forEach((issue) => {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      });
    }
    throw error;
  }
}

// ====================================
// 2. API RESPONSE HANDLING EXAMPLES
// ====================================

/**
 * Example: Type-safe API response creation
 */
function createApiResponseExample() {
  const user: User = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    email: "user@example.com",
    passwordHash: "hashed_password",
    firstName: "John",
    lastName: "Doe",
    phone: "+639123456789",
    avatarUrl: null,
    isActive: true,
    isEmailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpiry: null,
    passwordResetToken: null,
    passwordResetExpiry: null,
    lastLoginAt: null,
    loginAttempts: [],
    preferences: {},
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Create type-safe success response
  const successResponse: ApiSuccessResponse<User> = createSuccessResponse(
    user,
    "User retrieved successfully",
    "req-123"
  );

  // Create type-safe error response
  const errorResponse = createErrorResponse(
    API_ERROR_CODES.RESOURCE_NOT_FOUND,
    "User not found",
    { userId: "invalid-id" },
    "id",
    "req-123",
    "/api/users/invalid-id"
  );

  return { successResponse, errorResponse };
}

/**
 * Example: Handling API responses with proper error handling
 */
async function handleApiResponseExample() {
  // Simulate API responses
  const responses = createApiResponseExample();

  // Handle success response
  if (isApiSuccessResponse(responses.successResponse)) {
    console.log("✅ User data:", responses.successResponse.data.email);

    // Type-safe data extraction
    const userData = extractApiData(responses.successResponse);
    console.log("User created at:", userData.createdAt);
  }

  // Handle error response
  try {
    // This will throw an ApiError
    handleApiResponse(responses.errorResponse);
  } catch (error) {
    if (error instanceof ApiError) {
      console.error("❌ API Error Details:");
      console.error(`  Code: ${error.code}`);
      console.error(`  Message: ${error.message}`);
      console.error(`  Field: ${error.field}`);
      console.error(`  Request ID: ${error.requestId}`);

      // Handle specific error types
      if (error.isNotFoundError()) {
        console.log("🔍 Resource not found - show 404 page");
      } else if (error.isValidationError()) {
        console.log("📝 Validation error - show form errors");
      }
    }
  }
}

// ====================================
// 3. TYPE GUARD EXAMPLES
// ====================================

/**
 * Example: Using type guards for runtime type checking
 */
function typeGuardExamples() {
  const unknownId: unknown = "550e8400-e29b-41d4-a716-446655440000";
  const unknownAmount: unknown = "1500.00";
  const unknownEntity: unknown = {
    id: "123",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // UUID validation
  if (isValidEntityId(unknownId)) {
    // TypeScript knows unknownId is EntityId (string)
    console.log("✅ Valid UUID:", unknownId);
    // Safe to use in database queries
  } else {
    console.log("❌ Invalid UUID format");
  }

  // PHP amount validation
  if (isValidPhpAmount(unknownAmount)) {
    // TypeScript knows unknownAmount is PhpAmount (string)
    const numericValue = parseFloat(unknownAmount);
    console.log("✅ Valid amount: ₱", numericValue.toLocaleString());
  }

  // Audit fields check
  if (hasAuditFields(unknownEntity)) {
    // TypeScript knows the entity has id, createdAt, updatedAt
    console.log("📅 Entity created:", unknownEntity.createdAt);
  }
}

// ====================================
// 4. PAGINATION EXAMPLE
// ====================================

/**
 * Example: Working with paginated API responses
 */
function paginationExample() {
  // Simulate paginated bookings response
  const paginatedResponse: ApiPaginatedResponse<Booking> = {
    success: true,
    data: [], // Array of bookings would be here
    meta: {
      total: 150,
      page: 2,
      limit: 20,
      totalPages: 8,
      hasNext: true,
      hasPrev: true,
    },
    message: "Bookings retrieved successfully",
    timestamp: new Date().toISOString(),
    requestId: "req-456",
  };

  if (isApiSuccessResponse(paginatedResponse)) {
    const { data, meta } = paginatedResponse;

    console.log(`📄 Page ${meta.page} of ${meta.totalPages}`);
    console.log(`📊 Showing ${data.length} of ${meta.total} bookings`);

    if (meta.hasNext) {
      console.log("➡️ Next page available");
    }

    if (meta.hasPrev) {
      console.log("⬅️ Previous page available");
    }
  }
}

// ====================================
// 5. VALIDATION WITH CUSTOM RULES
// ====================================

/**
 * Example: Custom validation schema extending base schemas
 */
function customValidationExample() {
  // Extend booking schema with additional business rules
  const ExtendedBookingSchema = CreateBookingSchema.extend({
    // Add custom field
    promocode: z.string().optional(),
    // Add metadata
    bookingSource: z.enum(["website", "mobile", "phone", "walk-in"]),
  }).refine(
    (data) => {
      // Custom business rule: VIP guests get minimum 20% discount
      if (
        data.guestName.includes("VIP") &&
        parseFloat(data.discountAmount) < parseFloat(data.basePrice) * 0.2
      ) {
        return false;
      }
      return true;
    },
    {
      message: "VIP guests must receive at least 20% discount",
      path: ["discountAmount"],
    }
  );

  const vipBookingData = {
    guestName: "VIP Guest John Doe",
    guestPhone: "+639123456789",
    checkInDate: "2024-03-01",
    checkOutDate: "2024-03-03",
    basePrice: "5000.00",
    discountAmount: "500.00", // Only 10%, should fail validation
    totalAmount: "4500.00",
    // ... other required fields
    promocode: "VIP2024",
    bookingSource: "website" as const,
  };

  try {
    const validatedBooking = ExtendedBookingSchema.parse(vipBookingData);
    console.log("✅ VIP booking validated");
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ VIP booking validation failed:");
      error.issues.forEach((issue) => {
        console.error(`  - ${issue.message}`);
      });
    }
  }
}

// ====================================
// 6. INTEGRATION WITH ZUSTAND/TANSTACK QUERY
// ====================================

/**
 * Example: Type-safe store state and actions
 */
interface BookingStoreState {
  bookings: Booking[];
  loading: boolean;
  error: ApiError | null;

  // Actions with proper typing
  fetchBookings: (filters?: { status?: string; limit?: number }) => Promise<void>;
  createBooking: (data: CreateBookingInput) => Promise<Booking>;
  updateBooking: (id: EntityId, data: Partial<CreateBookingInput>) => Promise<Booking>;
}

/**
 * Example: Mock implementation showing type safety
 */
class MockBookingService {
  async fetchBookings(filters?: {
    status?: string;
    limit?: number;
  }): Promise<ApiPaginatedResponse<Booking>> {
    // In real implementation, this would make HTTP request
    return {
      success: true,
      data: [], // Array of validated bookings
      meta: {
        total: 0,
        page: 1,
        limit: filters?.limit || DATABASE_LIMITS.DEFAULT_PAGE_SIZE,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async createBooking(data: CreateBookingInput): Promise<ApiSuccessResponse<Booking>> {
    // Validate input before sending to API
    const validatedData = CreateBookingSchema.parse(data);

    // In real implementation, this would make HTTP request
    const booking: Booking = {
      id: crypto.randomUUID(),
      bookingCode: "BK-" + Date.now(),
      ...validatedData,
      status: "pending",
      paymentStatus: "pending",
      paidAmount: "0.00",
      balanceAmount: validatedData.totalAmount,
      cancelledAt: null,
      cancelledBy: null,
      metadata: {},
      createdBy: null,
      updatedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return createSuccessResponse(booking, "Booking created successfully");
  }
}

// ====================================
// 7. EXPORT EXAMPLES FOR TESTING
// ====================================

export const examples = {
  createUserExample,
  createBookingExample,
  createApiResponseExample,
  handleApiResponseExample,
  typeGuardExamples,
  paginationExample,
  customValidationExample,
  MockBookingService,
};

// Run examples if this file is executed directly
if (require.main === module) {
  console.log("🚀 Running TypeScript Types Examples\n");

  console.log("1. User Creation:");
  createUserExample();

  console.log("\n2. Booking Creation:");
  createBookingExample();

  console.log("\n3. API Response Handling:");
  createApiResponseExample();

  console.log("\n4. Type Guards:");
  typeGuardExamples();

  console.log("\n5. Pagination:");
  paginationExample();

  console.log("\n6. Custom Validation:");
  customValidationExample();

  console.log("\n✅ All examples completed successfully!");
}
