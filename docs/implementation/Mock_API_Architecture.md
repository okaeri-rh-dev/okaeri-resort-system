# Mock API Architecture

## Overview

This document defines the comprehensive mock API architecture for the TDD-first
development of the Okaeri Resort Management System. The mock layer enables
complete frontend development and testing before backend implementation, with
seamless migration paths to production APIs.

## Architecture Principles

### Core Design Principles

1. **API Parity**: Mocks must exactly match planned production API structure
2. **Realistic Behavior**: Include delays, errors, and edge cases
3. **Type Safety**: Full TypeScript coverage with shared types
4. **Environment-Based Configuration**: Simple ENV variables for mock/real
   switching
5. **Testability**: Predictable responses for testing with deterministic mode
6. **State Persistence**: Local storage for development continuity

## Service Maturity Levels

### Level Definitions

Mock services progress through three maturity levels as features develop:

#### Level 1 (L1): Basic CRUD Operations

**Purpose**: Enable basic feature development and unit testing

**Capabilities**:

- Create, Read, Update, Delete operations
- Basic validation (required fields, data types)
- Simple success/error responses
- Deterministic test data
- No delays or complex scenarios

**Example**:

```typescript
class L1MockService {
  async create(data: any) {
    if (!data.name) throw new Error("Name required");
    return { id: 1, ...data };
  }
  async get(id: number) {
    return { id, name: "Test" };
  }
}
```

#### Level 2 (L2): Business Logic Simulation

**Purpose**: Support integration testing and complex workflows

**Capabilities**:

- All L1 features plus:
- Business rule validation
- Calculated fields and derived data
- Related data handling (joins, references)
- Basic error scenarios (404, 409 conflicts)
- Pagination and filtering
- State transitions

**Example**:

```typescript
class L2MockService extends L1MockService {
  async calculateTotal(items: any[]) {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  async validateBusinessRules(booking: any) {
    if (booking.checkOut <= booking.checkIn) {
      throw new Error("Check-out must be after check-in");
    }
    if (booking.guests > booking.room.capacity) {
      throw new Error("Guest count exceeds room capacity");
    }
  }
}
```

#### Level 3 (L3): Production Simulation

**Purpose**: Complete E2E testing with production-like behavior

**Capabilities**:

- All L2 features plus:
- Network delays and latency simulation
- Rate limiting and throttling
- Complex error scenarios (timeouts, retries)
- Edge cases and race conditions
- Performance characteristics
- Security features (auth tokens, permissions)
- Webhooks and async operations
- Data consistency and transactions

**Example**:

```typescript
class L3MockService extends L2MockService {
  private requestCount = 0;
  private readonly rateLimit = 100;

  async processWithDelay(operation: () => Promise<any>) {
    // Rate limiting
    if (this.requestCount++ > this.rateLimit) {
      throw new Error("Rate limit exceeded");
    }

    // Network latency simulation
    const delay = this.config.scenario === "SLOW" ? 2000 : 100;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Random failures for chaos testing
    if (Math.random() < 0.01 && this.config.scenario === "UNSTABLE") {
      throw new Error("Service temporarily unavailable");
    }

    return operation();
  }

  async authenticate(token: string) {
    // Token expiry simulation
    const decoded = jwt.decode(token);
    if (decoded.exp < Date.now() / 1000) {
      throw new Error("Token expired");
    }

    // Permission checking
    if (!decoded.permissions.includes(requiredPermission)) {
      throw new Error("Insufficient permissions");
    }
  }
}
```

### Maturity Level Requirements by Phase

| Phase                   | Service  | Required Level | Justification                                   |
| ----------------------- | -------- | -------------- | ----------------------------------------------- |
| **Phase 1: Login**      | auth     | L3             | Critical security features need full simulation |
| **Phase 2: Dashboard**  | auth     | L2             | Session management complexity                   |
|                         | property | L1             | Basic property list display                     |
|                         | metrics  | L1             | Simple aggregation display                      |
| **Phase 3: Booking**    | booking  | L3             | Complex business rules and state management     |
|                         | payment  | L2             | Payment flow simulation needed                  |
|                         | guest    | L1             | Basic guest information                         |
| **Phase 4: Financial**  | expense  | L3             | Financial accuracy critical                     |
|                         | report   | L2             | Complex aggregations and calculations           |
|                         | payment  | L3             | Complete payment processing                     |
| **Phase 5: Production** | ALL      | L3             | Full production parity required                 |

### Implementation Status

Current mock service maturity levels:

| Service  | Current Level | Target for Next Phase | Gap Analysis                      |
| -------- | ------------- | --------------------- | --------------------------------- |
| auth     | L3 ✅         | L3                    | Ready for Phase 1                 |
| booking  | L2 ⚠️         | L3                    | Add rate limiting, complex errors |
| guest    | Not Started   | L1                    | Need basic CRUD                   |
| expense  | Not Started   | L1                    | Need basic CRUD                   |
| property | Not Started   | L1                    | Need basic CRUD                   |
| payment  | Not Started   | L2                    | Need payment flow simulation      |
| report   | Not Started   | L1                    | Need basic generation             |
| user     | Not Started   | L1                    | Need role management              |
| project  | Not Started   | L1                    | Need tenant isolation             |

## Complete Service Registry

### All Available Services (9 Total)

The Okaeri Resort System provides the following services, each with mock and
production implementations:

| Service      | Purpose                    | Mock Status    | API Status | Key Features                     |
| ------------ | -------------------------- | -------------- | ---------- | -------------------------------- |
| **auth**     | Authentication & sessions  | ✅ Implemented | ✅ Ready   | JWT, refresh tokens, MFA         |
| **booking**  | Reservation management     | ✅ Implemented | ✅ Ready   | Calendar, availability, payments |
| **guest**    | Guest profiles & history   | ⚠️ Pending     | ⚠️ Pending | Profiles, preferences, loyalty   |
| **expense**  | Expense tracking           | ⚠️ Pending     | ✅ Ready   | Receipts, categories, approval   |
| **property** | Room & property management | ⚠️ Pending     | ✅ Ready   | Inventory, maintenance, rates    |
| **payment**  | Payment processing         | ⚠️ Pending     | ⚠️ Pending | GCash, cards, invoicing          |
| **report**   | Report generation          | ⚠️ Pending     | ⚠️ Pending | Financial, occupancy, analytics  |
| **user**     | User management            | ⚠️ Pending     | ⚠️ Pending | Roles, permissions, teams        |
| **project**  | Multi-tenant management    | ⚠️ Pending     | ⚠️ Pending | Isolation, switching, settings   |

### Service Registry Implementation

```typescript
// src/services/registry.ts
import { MockAuthService } from "./mock/auth.mock.service";
import { MockBookingService } from "./mock/booking.mock.service";
import { MockGuestService } from "./mock/guest.mock.service";
import { MockExpenseService } from "./mock/expense.mock.service";
import { MockPropertyService } from "./mock/property.mock.service";
import { MockPaymentService } from "./mock/payment.mock.service";
import { MockReportService } from "./mock/report.mock.service";
import { MockUserService } from "./mock/user.mock.service";
import { MockProjectService } from "./mock/project.mock.service";

export type ServiceType =
  | "auth"
  | "booking"
  | "guest"
  | "expense"
  | "property"
  | "payment"
  | "report"
  | "user"
  | "project";

interface ServiceRegistry {
  auth: AuthService | null;
  booking: BookingService | null;
  guest: GuestService | null;
  expense: ExpenseService | null;
  property: PropertyService | null;
  payment: PaymentService | null;
  report: ReportService | null;
  user: UserService | null;
  project: ProjectService | null;
}

class ServiceManager {
  private registry: ServiceRegistry = {
    auth: null,
    booking: null,
    guest: null,
    expense: null,
    property: null,
    payment: null,
    report: null,
    user: null,
    project: null,
  };

  initialize(useMocks: boolean = process.env.VITE_USE_MOCKS === "true") {
    if (useMocks) {
      this.registry.auth = new MockAuthService();
      this.registry.booking = new MockBookingService();
      this.registry.guest = new MockGuestService();
      this.registry.expense = new MockExpenseService();
      this.registry.property = new MockPropertyService();
      this.registry.payment = new MockPaymentService();
      this.registry.report = new MockReportService();
      this.registry.user = new MockUserService();
      this.registry.project = new MockProjectService();
    } else {
      // Production services would be initialized here
      this.registry.auth = new ApiAuthService();
      this.registry.booking = new ApiBookingService();
      // ... etc
    }
  }

  get<T extends ServiceType>(service: T): ServiceRegistry[T] {
    if (!this.registry[service]) {
      throw new Error(`Service ${service} not initialized`);
    }
    return this.registry[service];
  }
}

export const serviceManager = new ServiceManager();
```

## Service Layer Architecture

### Base Service Interface

```typescript
// src/services/base.service.ts
export interface BaseService<T, CreateDTO, UpdateDTO> {
  // Read operations
  list(filters?: Record<string, any>): Promise<PaginatedResponse<T>>;
  get(id: string): Promise<T>;
  search(query: string): Promise<T[]>;

  // Write operations
  create(data: CreateDTO): Promise<T>;
  update(id: string, data: UpdateDTO): Promise<T>;
  delete(id: string): Promise<void>;

  // Batch operations
  batchCreate(data: CreateDTO[]): Promise<T[]>;
  batchUpdate(updates: { id: string; data: UpdateDTO }[]): Promise<T[]>;
  batchDelete(ids: string[]): Promise<void>;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}
```

### Service Implementation Strategy

```typescript
// src/services/registry.ts
import { getApiMode } from "@/config/environment";
import { ServiceRegistry } from "@/services/registry";

// Type-safe service creation with explicit service mapping (Vite-friendly)
export function createService<T, CreateDTO, UpdateDTO>(
  serviceName: string
): BaseService<T, CreateDTO, UpdateDTO> {
  // Simple environment-based switching using import.meta.env
  const apiMode = getApiMode(); // 'mock', 'real', or 'test'

  // Explicit service mapping - no dynamic imports that break with Vite bundling
  // All services must be statically imported and registered
  if (apiMode === "mock" || apiMode === "test") {
    // Mock services are explicitly imported at build time
    return ServiceRegistry.booking<T, CreateDTO, UpdateDTO>();
  } else {
    // API services are explicitly imported at build time
    return ServiceRegistry.booking<T, CreateDTO, UpdateDTO>({
      forceImplementation: "api",
    });
  }
}

// Usage with type safety
const bookingService = await ServiceRegistry.booking<
  Booking,
  CreateBookingDTO,
  UpdateBookingDTO
>();
```

## Mock Service Implementations

### Authentication Service

```typescript
// src/services/mock/auth.mock.service.ts
import { simulateDelay, simulateNetworkError } from "@/lib/mock-utils";
import { mockUsers } from "@/mocks/auth-data";

export class MockAuthService implements AuthService {
  private readonly DELAY_MS = { min: 200, max: 800 };
  private readonly ERROR_RATE = 0.05; // 5% error rate for testing

  async login(email: string, password: string): Promise<LoginResponse> {
    await simulateDelay(this.DELAY_MS.min, this.DELAY_MS.max);

    if (await simulateNetworkError(this.ERROR_RATE)) {
      throw new Error("Network error: Unable to connect to server");
    }

    const user = mockUsers.find((u) => u.email === email);

    if (!user || user.password !== password) {
      await simulateDelay(500, 1000); // Extra delay for failed attempts
      throw new AuthError("Invalid credentials", 401);
    }

    return {
      user: omit(user, "password"),
      token: this.generateMockToken(user.id),
      refreshToken: this.generateMockRefreshToken(user.id),
      expiresIn: 3600,
    };
  }

  async logout(): Promise<void> {
    await simulateDelay(100, 300);
    localStorage.removeItem("mock_auth_token");
    localStorage.removeItem("mock_refresh_token");
  }

  async refresh(refreshToken: string): Promise<TokenResponse> {
    await simulateDelay(200, 400);

    if (!this.isValidMockToken(refreshToken)) {
      throw new AuthError("Invalid refresh token", 401);
    }

    const userId = this.extractUserIdFromToken(refreshToken);
    return {
      token: this.generateMockToken(userId),
      refreshToken: this.generateMockRefreshToken(userId),
      expiresIn: 3600,
    };
  }

  private generateMockToken(userId: string): string {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(
      JSON.stringify({
        sub: userId,
        iat: Date.now(),
        exp: Date.now() + 3600000,
        role: "user",
      })
    );
    const signature = btoa(`mock-signature-${userId}`);
    return `${header}.${payload}.${signature}`;
  }
}
```

### Booking Service

```typescript
// src/services/mock/booking.mock.service.ts
import { mockBookings } from "@/mocks/booking-data";
import { BookingStatus } from "@/types/booking";

export class MockBookingService implements BookingService {
  private bookings: Booking[] = [...mockBookings];

  async list(filters?: BookingFilters): Promise<PaginatedResponse<Booking>> {
    await simulateDelay(300, 600);

    let filtered = [...this.bookings];

    // Apply filters
    if (filters?.status) {
      filtered = filtered.filter((b) => b.status === filters.status);
    }

    if (filters?.propertyId) {
      filtered = filtered.filter((b) => b.propertyId === filters.propertyId);
    }

    if (filters?.dateRange) {
      const { start, end } = filters.dateRange;
      filtered = filtered.filter((b) => {
        const checkIn = new Date(b.checkIn);
        return checkIn >= new Date(start) && checkIn <= new Date(end);
      });
    }

    // Apply pagination
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const start = (page - 1) * limit;
    const end = start + limit;

    const paginatedData = filtered.slice(start, end);

    return {
      data: paginatedData,
      meta: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit),
        hasMore: end < filtered.length,
      },
    };
  }

  async checkAvailability(
    propertyId: string,
    checkIn: string,
    checkOut: string
  ): Promise<AvailabilityResponse> {
    await simulateDelay(400, 800);

    const conflicts = this.bookings.filter((booking) => {
      if (booking.propertyId !== propertyId) return false;
      if (booking.status === BookingStatus.CANCELLED) return false;

      const reqStart = new Date(checkIn);
      const reqEnd = new Date(checkOut);
      const bookStart = new Date(booking.checkIn);
      const bookEnd = new Date(booking.checkOut);

      return reqStart < bookEnd && reqEnd > bookStart;
    });

    return {
      available: conflicts.length === 0,
      conflicts: conflicts.map((b) => ({
        id: b.id,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        guestName: b.guestName,
      })),
      suggestedDates:
        conflicts.length > 0
          ? this.findAlternativeDates(propertyId, checkIn, checkOut)
          : [],
    };
  }

  async create(data: CreateBookingDTO): Promise<Booking> {
    await simulateDelay(500, 1000);

    // Simulate validation
    if (!data.guestEmail || !data.guestEmail.includes("@")) {
      throw new ValidationError("Invalid email address");
    }

    // Simulate availability check
    const availability = await this.checkAvailability(
      data.propertyId,
      data.checkIn,
      data.checkOut
    );

    if (!availability.available) {
      throw new BusinessError("Property not available for selected dates");
    }

    // Create booking
    const newBooking: Booking = {
      id: `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      status: BookingStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      confirmationCode: this.generateConfirmationCode(),
      totalAmount: this.calculateTotalAmount(data),
      paidAmount: 0,
      balance: 0,
    };

    newBooking.balance = newBooking.totalAmount;

    this.bookings.push(newBooking);
    this.persistToLocalStorage();

    return newBooking;
  }

  private calculateTotalAmount(booking: Partial<Booking>): number {
    const nights = Math.ceil(
      (new Date(booking.checkOut!).getTime() -
        new Date(booking.checkIn!).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const baseRate = 8000; // Mock base rate
    const subtotal = baseRate * nights;
    const tax = subtotal * 0.12; // 12% VAT
    const serviceCharge = subtotal * 0.1; // 10% service charge

    return Math.round(subtotal + tax + serviceCharge);
  }

  private generateConfirmationCode(): string {
    return `OKR${Date.now().toString(36).toUpperCase().substr(-6)}`;
  }

  private persistToLocalStorage(): void {
    localStorage.setItem("mock_bookings", JSON.stringify(this.bookings));
  }
}
```

### Financial Service

```typescript
// src/services/mock/financial.mock.service.ts
export class MockFinancialService implements FinancialService {
  private expenses: Expense[] = [...mockExpenses];
  private income: Income[] = [...mockIncome];

  async getExpenses(
    filters?: ExpenseFilters
  ): Promise<PaginatedResponse<Expense>> {
    await simulateDelay(200, 500);

    let filtered = [...this.expenses];

    if (filters?.category) {
      filtered = filtered.filter((e) => e.category === filters.category);
    }

    if (filters?.dateRange) {
      filtered = filtered.filter((e) => {
        const date = new Date(e.date);
        return (
          date >= new Date(filters.dateRange.start) &&
          date <= new Date(filters.dateRange.end)
        );
      });
    }

    return this.paginate(filtered, filters?.page, filters?.limit);
  }

  async createExpense(data: CreateExpenseDTO): Promise<Expense> {
    await simulateDelay(300, 600);

    // Simulate file upload for receipts
    if (data.receipt) {
      await simulateDelay(1000, 2000); // Extra delay for "upload"
      data.receiptUrl = `mock://receipts/${Date.now()}.jpg`;
    }

    const expense: Expense = {
      id: `expense-${Date.now()}`,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "pending_approval",
    };

    this.expenses.push(expense);
    this.persistToLocalStorage();

    return expense;
  }

  async generateReport(type: ReportType, period: DateRange): Promise<Report> {
    await simulateDelay(1000, 2000); // Longer delay for "processing"

    const expenses = this.expenses.filter((e) => {
      const date = new Date(e.date);
      return date >= new Date(period.start) && date <= new Date(period.end);
    });

    const income = this.income.filter((i) => {
      const date = new Date(i.date);
      return date >= new Date(period.start) && date <= new Date(period.end);
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);

    return {
      id: `report-${Date.now()}`,
      type,
      period,
      generatedAt: new Date().toISOString(),
      data: {
        totalIncome,
        totalExpenses,
        netProfit: totalIncome - totalExpenses,
        expensesByCategory: this.groupExpensesByCategory(expenses),
        incomeBySource: this.groupIncomeBySource(income),
        dailyBreakdown: this.generateDailyBreakdown(expenses, income, period),
      },
      format: "json",
    };
  }
}
```

### Guest Service

```typescript
// src/services/mock/guest.mock.service.ts
export class MockGuestService implements GuestService {
  private guests: Guest[] = [...mockGuests];

  async createGuest(data: CreateGuestDTO): Promise<Guest> {
    await simulateDelay(200, 400);

    const guest: Guest = {
      id: `guest-${Date.now()}`,
      ...data,
      loyaltyPoints: 0,
      totalStays: 0,
      totalSpent: 0,
      preferences: data.preferences || {},
      tags: data.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.guests.push(guest);
    return guest;
  }

  async getGuestHistory(guestId: string): Promise<GuestHistory> {
    await simulateDelay(300, 600);

    return {
      guestId,
      bookings: [], // Would fetch from booking service
      totalNights: 0,
      favoriteRoom: null,
      lastVisit: null,
      upcomingBookings: [],
    };
  }
}
```

### Expense Service

```typescript
// src/services/mock/expense.mock.service.ts
export class MockExpenseService implements ExpenseService {
  private expenses: Expense[] = [...mockExpenses];

  async createExpense(data: CreateExpenseDTO): Promise<Expense> {
    await simulateDelay(300, 600);

    // Simulate receipt upload processing
    let receiptUrl: string | undefined;
    if (data.receiptFile) {
      await simulateDelay(1000, 2000); // Upload delay
      receiptUrl = `mock://receipts/${Date.now()}-${data.receiptFile.name}`;
    }

    const expense: Expense = {
      id: `exp-${Date.now()}`,
      ...data,
      receiptUrl,
      amount: parseFloat(data.amount), // Ensure number type per Currency Standard
      vatAmount: data.amount * 0.12,
      status: "pending_approval",
      approvedBy: null,
      approvedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.expenses.push(expense);
    return expense;
  }

  async bulkImportFromCSV(file: File): Promise<ImportResult> {
    await simulateDelay(2000, 4000); // Simulate processing

    return {
      success: true,
      imported: 25,
      failed: 2,
      errors: [
        { row: 5, error: "Invalid amount format" },
        { row: 12, error: "Missing required field: category" },
      ],
    };
  }
}
```

### Property Service

```typescript
// src/services/mock/property.mock.service.ts
export class MockPropertyService implements PropertyService {
  private properties: Property[] = [...mockProperties];
  private rooms: Room[] = [...mockRooms];

  async getAvailability(
    propertyId: string,
    dateRange: DateRange
  ): Promise<AvailabilityCalendar> {
    await simulateDelay(400, 800);

    const rooms = this.rooms.filter((r) => r.propertyId === propertyId);
    const availability: AvailabilityCalendar = {};

    // Generate mock availability for date range
    const current = new Date(dateRange.start);
    const end = new Date(dateRange.end);

    while (current <= end) {
      const dateStr = current.toISOString().split("T")[0];
      availability[dateStr] = {
        available: Math.random() > 0.3,
        price: 5000 + Math.random() * 3000,
        minStay: Math.random() > 0.5 ? 2 : 1,
      };
      current.setDate(current.getDate() + 1);
    }

    return availability;
  }

  async updateRates(propertyId: string, rates: RateUpdate[]): Promise<void> {
    await simulateDelay(500, 1000);

    // Simulate rate update
    rates.forEach((rate) => {
      console.log(`Updated rate for ${rate.date}: ₱${rate.price}`);
    });
  }
}
```

### Payment Service

```typescript
// src/services/mock/payment.mock.service.ts
export class MockPaymentService implements PaymentService {
  private payments: Payment[] = [...mockPayments];

  async processPayment(data: ProcessPaymentDTO): Promise<Payment> {
    await simulateDelay(1000, 3000); // Simulate payment gateway

    // Simulate payment gateway responses
    if (Math.random() < 0.1) {
      throw new PaymentError("Payment declined", "DECLINED");
    }

    const payment: Payment = {
      id: `pay-${Date.now()}`,
      bookingId: data.bookingId,
      amount: data.amount,
      method: data.method,
      status: "completed",
      reference: `REF-${Date.now()}`,
      gatewayResponse: {
        transactionId: `TXN-${Date.now()}`,
        status: "SUCCESS",
        message: "Payment successful",
      },
      processedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    this.payments.push(payment);
    return payment;
  }

  async processGCashPayment(data: GCashPaymentDTO): Promise<Payment> {
    await simulateDelay(2000, 4000); // GCash takes longer

    return this.processPayment({
      ...data,
      method: "gcash",
      metadata: {
        mobileNumber: data.mobileNumber,
        accountName: data.accountName,
      },
    });
  }
}
```

### Report Service

```typescript
// src/services/mock/report.mock.service.ts
export class MockReportService implements ReportService {
  async generateFinancialReport(
    period: DateRange,
    options?: ReportOptions
  ): Promise<FinancialReport> {
    await simulateDelay(2000, 4000); // Report generation

    return {
      id: `report-${Date.now()}`,
      type: "financial",
      period,
      generatedAt: new Date().toISOString(),
      data: {
        revenue: {
          rooms: 150000,
          services: 25000,
          total: 175000,
        },
        expenses: {
          operations: 50000,
          maintenance: 15000,
          supplies: 20000,
          total: 85000,
        },
        netIncome: 90000,
        occupancyRate: 0.75,
        adr: 5000, // Average Daily Rate
        revpar: 3750, // Revenue Per Available Room
      },
      format: options?.format || "json",
    };
  }

  async generateBIRReport(month: string, year: number): Promise<BIRReport> {
    await simulateDelay(3000, 5000); // Complex calculation

    return {
      id: `bir-${Date.now()}`,
      period: `${year}-${month}`,
      form: "2550M", // Monthly VAT
      grossSales: 175000,
      vatableSales: 156250,
      vatAmount: 18750,
      withholdingTax: 3500,
      netVAT: 15250,
      generatedAt: new Date().toISOString(),
    };
  }
}
```

### User Service

```typescript
// src/services/mock/user.mock.service.ts
export class MockUserService implements UserService {
  private users: User[] = [...mockUsers];

  async updateUserRole(userId: string, role: UserRole): Promise<User> {
    await simulateDelay(300, 600);

    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    user.role = role;
    user.updatedAt = new Date().toISOString();

    return user;
  }

  async inviteUser(data: InviteUserDTO): Promise<Invitation> {
    await simulateDelay(500, 1000);

    return {
      id: `invite-${Date.now()}`,
      email: data.email,
      role: data.role,
      projectId: data.projectId,
      invitedBy: data.invitedBy,
      status: "pending",
      token: btoa(`${data.email}-${Date.now()}`),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };
  }
}
```

### Project Service (Multi-tenant)

```typescript
// src/services/mock/project.mock.service.ts
export class MockProjectService implements ProjectService {
  private projects: Project[] = [...mockProjects];
  private currentProjectId: string | null = null;

  async switchProject(projectId: string): Promise<void> {
    await simulateDelay(500, 1000);

    const project = this.projects.find((p) => p.id === projectId);
    if (!project) {
      throw new NotFoundError("Project not found");
    }

    this.currentProjectId = projectId;
    localStorage.setItem("current_project", projectId);

    // Simulate context switch
    await this.clearProjectCache();
    await this.loadProjectContext(projectId);
  }

  async getCurrentProject(): Promise<Project | null> {
    if (!this.currentProjectId) {
      return null;
    }

    return this.projects.find((p) => p.id === this.currentProjectId) || null;
  }

  private async clearProjectCache(): Promise<void> {
    // Clear all project-specific data from localStorage
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith("project_")) {
        localStorage.removeItem(key);
      }
    });
  }

  private async loadProjectContext(projectId: string): Promise<void> {
    // Load project-specific settings and data
    await simulateDelay(200, 400);
    console.log(`Loaded context for project: ${projectId}`);
  }
}
```

## Mock Data Management

### Data Generation

```typescript
// src/mocks/generators/booking.generator.ts
import { faker } from "@faker-js/faker";

export function generateMockBooking(overrides?: Partial<Booking>): Booking {
  const checkIn = faker.date.future();
  const nights = faker.number.int({ min: 1, max: 7 });
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + nights);

  return {
    id: faker.string.uuid(),
    propertyId: faker.helpers.arrayElement(["villa-1", "villa-2", "cottage-1"]),
    guestName: faker.person.fullName(),
    guestEmail: faker.internet.email(),
    guestPhone: faker.phone.number("+639#########"),
    checkIn: checkIn.toISOString().split("T")[0],
    checkOut: checkOut.toISOString().split("T")[0],
    guestCount: faker.number.int({ min: 1, max: 6 }),
    status: faker.helpers.arrayElement(["confirmed", "pending", "cancelled"]),
    totalAmount: faker.number.int({ min: 5000, max: 50000 }),
    paidAmount: 0,
    balance: 0,
    notes: faker.lorem.sentence(),
    source: faker.helpers.arrayElement(["airbnb", "booking.com", "direct"]),
    createdAt: faker.date.past().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Generate bulk data
export function generateMockBookings(count: number): Booking[] {
  return Array.from({ length: count }, () => generateMockBooking());
}
```

### Data Persistence

```typescript
// src/mocks/persistence/mock-db.ts
class MockDatabase {
  private readonly STORAGE_PREFIX = "mock_db_";

  async get<T>(collection: string): Promise<T[]> {
    const data = localStorage.getItem(`${this.STORAGE_PREFIX}${collection}`);
    return data ? JSON.parse(data) : [];
  }

  async set<T>(collection: string, data: T[]): Promise<void> {
    localStorage.setItem(
      `${this.STORAGE_PREFIX}${collection}`,
      JSON.stringify(data)
    );
  }

  async clear(collection?: string): Promise<void> {
    if (collection) {
      localStorage.removeItem(`${this.STORAGE_PREFIX}${collection}`);
    } else {
      // Clear all mock data
      Object.keys(localStorage)
        .filter((key) => key.startsWith(this.STORAGE_PREFIX))
        .forEach((key) => localStorage.removeItem(key));
    }
  }

  async seed(): Promise<void> {
    // Seed with initial data
    await this.set("bookings", generateMockBookings(50));
    await this.set("expenses", generateMockExpenses(100));
    await this.set("properties", mockProperties);
    await this.set("users", mockUsers);
  }

  async reset(): Promise<void> {
    await this.clear();
    await this.seed();
  }
}

export const mockDb = new MockDatabase();
```

## Error Simulation

### Deterministic Testing Mode

The mock API architecture includes a deterministic testing mode (activated via
`VITE_API_MODE=test`) that eliminates flaky tests caused by random error rates.
This ensures reliable and repeatable test execution.

```typescript
// src/mocks/errors/test-scenario-config.ts
export interface TestScenarioConfig {
  deterministic: boolean;
  errorRate: number;
  networkDelay: { min: number; max: number };
  seed?: string; // For deterministic randomness
  forceScenarios?: string[]; // Force specific error scenarios
}

export const TEST_SCENARIOS = {
  // No errors - for happy path testing
  STABLE: {
    deterministic: true,
    errorRate: 0,
    networkDelay: { min: 10, max: 50 },
    seed: "stable-test-seed",
  },

  // Controlled error testing
  ERROR_PRONE: {
    deterministic: true,
    errorRate: 0.1, // 10% controlled error rate
    networkDelay: { min: 100, max: 200 },
    seed: "error-test-seed",
  },

  // Network simulation
  SLOW_NETWORK: {
    deterministic: true,
    errorRate: 0.05,
    networkDelay: { min: 1000, max: 2000 },
    seed: "slow-network-seed",
  },

  // Development mode - realistic but non-deterministic
  DEVELOPMENT: {
    deterministic: false,
    errorRate: 0.05,
    networkDelay: { min: 200, max: 800 },
  },

  // Auto-detect based on environment
  CURRENT:
    import.meta.env.VITE_API_MODE === "test"
      ? TEST_SCENARIOS.STABLE
      : TEST_SCENARIOS.DEVELOPMENT,
} as const;
```

### Enhanced Error Scenarios

```typescript
// src/mocks/errors/error-simulator.ts
export class ErrorSimulator {
  private config: TestScenarioConfig;
  private seededRandom: () => number;
  private errorScenarios = {
    networkError: {
      probability: 0.05,
      error: new Error("Network request failed"),
    },
    timeout: {
      probability: 0.02,
      error: new Error("Request timeout"),
    },
    serverError: {
      probability: 0.03,
      error: new Error("Internal server error"),
    },
    validationError: {
      probability: 0.1,
      error: new ValidationError("Validation failed"),
    },
    authError: {
      probability: 0.02,
      error: new AuthError("Unauthorized", 401),
    },
    rateLimitError: {
      probability: 0.01,
      error: new Error("Rate limit exceeded"),
    },
  };

  constructor(config?: TestScenarioConfig) {
    // Auto-select scenario based on environment
    this.config = config || TEST_SCENARIOS.CURRENT;

    // Initialize seeded random for deterministic tests
    if (this.config.deterministic && this.config.seed) {
      this.seededRandom = this.createSeededRandom(this.config.seed);
    } else {
      this.seededRandom = Math.random;
    }
  }

  async simulate(scenario?: keyof typeof this.errorScenarios): Promise<void> {
    // Check for forced scenarios (test-specific)
    if (this.config.forceScenarios?.includes(scenario || "")) {
      throw this.errorScenarios[scenario!].error;
    }

    // In deterministic mode, use configured error rate
    if (this.config.deterministic) {
      const shouldError = this.seededRandom() < this.config.errorRate;
      if (shouldError && scenario) {
        throw this.errorScenarios[scenario].error;
      }
      return;
    }

    // Original random simulation for development
    if (scenario) {
      const { probability, error } = this.errorScenarios[scenario];
      if (this.seededRandom() < probability) {
        throw error;
      }
    } else {
      // Random error simulation
      for (const [key, { probability, error }] of Object.entries(
        this.errorScenarios
      )) {
        if (this.seededRandom() < probability) {
          throw error;
        }
      }
    }
  }

  async simulateNetworkConditions(
    type: "slow-3g" | "fast-3g" | "4g" | "wifi"
  ): Promise<void> {
    const delays = {
      "slow-3g": { min: 2000, max: 5000 },
      "fast-3g": { min: 500, max: 1500 },
      "4g": { min: 100, max: 500 },
      wifi: { min: 50, max: 200 },
    };

    const delay = this.config.deterministic
      ? this.config.networkDelay
      : delays[type];

    await this.simulateDelay(delay.min, delay.max);
  }

  /**
   * Create seeded random number generator for deterministic tests
   * Uses the same LCG algorithm as src/test/setup.ts for consistency
   */
  private createSeededRandom(seed: string): () => number {
    // Convert seed string to numeric value (same as setup.ts)
    let seedNum = 0;
    for (let i = 0; i < seed.length; i++) {
      seedNum = (seedNum * 31 + seed.charCodeAt(i)) >>> 0;
    }

    // Simple Linear Congruential Generator for deterministic random
    let state = seedNum || 123456789;
    return () => {
      // Numerical Recipes LCG parameters (same as setup.ts)
      state = (1664525 * state + 1013904223) >>> 0;
      return (state & 0xffffffff) / 0x100000000;
    };
  }

  /**
   * Simulate delay with deterministic or random timing
   */
  private async simulateDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = this.config.deterministic
      ? minMs // Use minimum delay for faster tests
      : Math.floor(this.seededRandom() * (maxMs - minMs + 1)) + minMs;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Set test scenario configuration
   */
  setScenario(scenario: keyof typeof TEST_SCENARIOS): void {
    this.config = TEST_SCENARIOS[scenario];
    if (this.config.deterministic && this.config.seed) {
      this.seededRandom = this.createSeededRandom(this.config.seed);
    } else {
      this.seededRandom = Math.random;
    }
  }

  /**
   * Force specific error for testing
   */
  forceError(scenario: keyof typeof this.errorScenarios): void {
    if (this.config.deterministic) {
      throw this.errorScenarios[scenario].error;
    }
  }

  /**
   * Reset to default state
   */
  reset(): void {
    this.setScenario("DEVELOPMENT");
  }
}
```

## Environment-Based Configuration

### Vite-Compatible Environment Configuration

```typescript
// src/config/environment.ts
import { z } from "zod";

export type ApiMode = "mock" | "real" | "test";
export type TestScenario = "STABLE" | "ERROR_PRONE" | "SLOW_NETWORK";

// Environment variable schema with Vite-compatible naming
// All browser-accessible variables must have VITE_ prefix
const environmentSchema = z.object({
  // Core API Configuration
  VITE_API_MODE: z.enum(["mock", "real", "test"]).default("mock"),
  VITE_API_URL: z.string().default("/api"),

  // Test Configuration (for deterministic testing)
  VITE_TEST_SCENARIO: z
    .enum(["STABLE", "ERROR_PRONE", "SLOW_NETWORK"])
    .default("STABLE"),
  VITE_TEST_SEED: z.string().default("stable-test-seed"),

  // Application Settings
  VITE_APP_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  VITE_SHOW_MOCK_INDICATOR: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  VITE_ENABLE_DEVTOOLS: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  // ... other environment variables
});

// Parse and validate using import.meta.env (Vite-specific)
function parseEnvironment() {
  try {
    return environmentSchema.parse(import.meta.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Invalid environment variables:", error.errors);
      throw new Error("Failed to load environment configuration");
    }
    throw error;
  }
}

const env = parseEnvironment();

// Helper functions
export function getApiMode(): ApiMode {
  return env.VITE_API_MODE;
}

export function isUsingMocks(): boolean {
  return env.VITE_API_MODE === "mock" || env.VITE_API_MODE === "test";
}

export function isDeterministicMode(): boolean {
  return env.VITE_API_MODE === "test";
}

export function getTestScenario() {
  const scenario = env.VITE_TEST_SCENARIO;
  return TEST_SCENARIOS[scenario];
}

// Environment configuration object
export const environment = {
  api: {
    mode: env.VITE_API_MODE,
    url: env.VITE_API_URL,
  },
  app: {
    env: env.VITE_APP_ENV,
    isDevelopment: env.VITE_APP_ENV === "development",
    isProduction: env.VITE_APP_ENV === "production",
  },
  development: {
    enableDevtools: env.VITE_ENABLE_DEVTOOLS,
    showMockIndicator: env.VITE_SHOW_MOCK_INDICATOR && isUsingMocks(),
  },
  test: {
    scenario: env.VITE_TEST_SCENARIO,
    seed: env.VITE_TEST_SEED,
    isDeterministic: isDeterministicMode(),
  },
} as const;
```

### Environment Variables Setup

```bash
# .env.development - Local development with mocks
VITE_API_MODE=mock
VITE_API_URL=/api
VITE_TEST_SCENARIO=STABLE
VITE_TEST_SEED=stable-test-seed
VITE_SHOW_MOCK_INDICATOR=true
VITE_ENABLE_DEVTOOLS=true

# .env.staging - Staging environment with real API
VITE_API_MODE=real
VITE_API_URL=https://api-staging.okaeri.ph
VITE_SHOW_MOCK_INDICATOR=false
VITE_ENABLE_DEVTOOLS=false

# .env.production - Production environment
VITE_API_MODE=real
VITE_API_URL=https://api.okaeri.ph
VITE_SHOW_MOCK_INDICATOR=false
VITE_ENABLE_DEVTOOLS=false

# .env.test - Testing environment with deterministic mocks
VITE_API_MODE=test
VITE_API_URL=/api
VITE_TEST_SCENARIO=STABLE
VITE_TEST_SEED=stable-test-seed
VITE_SHOW_MOCK_INDICATOR=false
VITE_ENABLE_DEVTOOLS=false
```

### Service Registry with Explicit Mapping

```typescript
// src/services/registry.ts
import { getApiMode, environment } from "@/config/environment";
import { ServiceRegistry, ServiceRegistryUtils } from "@/services/registry";

// Explicit service mapping (no dynamic imports for Vite compatibility)
// All services are imported at build time
export class ServiceManager {
  private static instance: ServiceManager;

  static getInstance(): ServiceManager {
    if (!this.instance) {
      this.instance = new ServiceManager();
    }
    return this.instance;
  }

  // Type-safe service creation using ServiceRegistry
  async getService<T>(serviceName: string): Promise<T> {
    switch (serviceName.toLowerCase()) {
      case "auth":
        return ServiceRegistry.auth() as Promise<T>;
      case "booking":
        return ServiceRegistry.booking() as Promise<T>;
      case "expense":
        return ServiceRegistry.expense() as Promise<T>;
      default:
        throw new Error(`Service ${serviceName} not found in registry`);
    }
  }

  // Clear service cache
  clearCache(): void {
    ServiceRegistryUtils.clearCache();
  }

  // Get cache statistics
  getCacheStats() {
    return ServiceRegistryUtils.getCacheStats();
  }

  // Check service availability
  isServiceAvailable(
    serviceName: string,
    implementation?: "mock" | "api"
  ): boolean {
    return ServiceRegistryUtils.isServiceAvailable(
      serviceName as any,
      implementation
    );
  }
}

// Usage with enhanced type safety
const serviceManager = ServiceManager.getInstance();
const bookingService =
  await serviceManager.getService<BookingService>("Booking");

// Direct usage (preferred)
const bookingService = await ServiceRegistry.booking<
  Booking,
  CreateBookingDTO,
  UpdateBookingDTO
>();
```

## Testing with Mocks

### Deterministic Testing Patterns

The updated mock architecture supports three distinct testing modes:

1. **Unit Tests**: Fast, deterministic, zero-error mode
2. **Integration Tests**: Controlled error scenarios
3. **E2E Tests**: Realistic network conditions

```typescript
// src/test/utils/test-scenarios.ts
export const setupTestScenario = {
  // Unit testing - fast and reliable
  unit: () => ({
    errorSimulator: new ErrorSimulator(TEST_SCENARIOS.STABLE),
    networkDelay: { min: 0, max: 10 },
    deterministic: true,
  }),

  // Integration testing - controlled errors
  integration: () => ({
    errorSimulator: new ErrorSimulator(TEST_SCENARIOS.ERROR_PRONE),
    networkDelay: { min: 50, max: 100 },
    deterministic: true,
  }),

  // E2E testing - realistic conditions
  e2e: () => ({
    errorSimulator: new ErrorSimulator(TEST_SCENARIOS.SLOW_NETWORK),
    networkDelay: { min: 200, max: 500 },
    deterministic: true,
  }),
};
```

### Enhanced Test Utilities

```typescript
// src/test/utils/mock-utils.ts
import { TEST_SCENARIOS, ErrorSimulator } from "@/mocks/errors/error-simulator";
import { TestDataSeeder } from "@/test/utils/test-data-seeder";

export class MockServiceUtils {
  private errorSimulator: ErrorSimulator;
  private dataSeeder: TestDataSeeder;

  constructor(scenario: keyof typeof TEST_SCENARIOS = "STABLE") {
    this.errorSimulator = new ErrorSimulator(TEST_SCENARIOS[scenario]);
    this.dataSeeder = new TestDataSeeder();
  }

  // Reset all mock data with deterministic seeding
  async resetMocks(): Promise<void> {
    await mockDb.reset();
    localStorage.clear();
    sessionStorage.clear();
    this.errorSimulator.reset();
    await this.dataSeeder.reset();
  }

  // Set specific test scenario
  async setScenario(scenario: keyof typeof TEST_SCENARIOS): Promise<void> {
    this.errorSimulator.setScenario(scenario);

    switch (scenario) {
      case "STABLE":
        await this.dataSeeder.seedStableData();
        break;
      case "ERROR_PRONE":
        await this.dataSeeder.seedMinimalData();
        break;
      case "SLOW_NETWORK":
        await this.dataSeeder.seedRealisticData();
        break;
    }
  }

  // Force specific error for testing
  forceError(scenario: string): void {
    this.errorSimulator.forceError(scenario as any);
  }

  // Create deterministic test data
  async createTestData(
    type: "minimal" | "standard" | "comprehensive"
  ): Promise<void> {
    switch (type) {
      case "minimal":
        await this.dataSeeder.seedMinimalData();
        break;
      case "standard":
        await this.dataSeeder.seedStandardData();
        break;
      case "comprehensive":
        await this.dataSeeder.seedComprehensiveData();
        break;
    }
  }

  // Verify mock service calls (with deterministic tracking)
  getServiceCalls(service: string, method: string): any[] {
    return mockCallTracker.getCalls(service, method);
  }

  // Override mock responses for specific tests
  async overrideMock(
    service: string,
    method: string,
    response: any,
    scenario?: "success" | "error" | "timeout"
  ): Promise<void> {
    const mockService = await import(`@/services/mock/${service}.mock.service`);

    if (scenario === "error") {
      mockService.default.prototype[method] = async () => {
        this.forceError("validationError");
      };
    } else if (scenario === "timeout") {
      mockService.default.prototype[method] = async () => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return response;
      };
    } else {
      mockService.default.prototype[method] = async () => response;
    }
  }
}
```

### Integration Testing

```typescript
// src/tests/integration/booking-flow.test.ts
describe("Booking Flow with Mocks", () => {
  beforeEach(async () => {
    await mockServiceUtils.resetMocks();
    await mockServiceUtils.setScenario("full");
  });

  it("should complete booking flow with mock services", async () => {
    const bookingService = new MockBookingService();

    // Check availability
    const availability = await bookingService.checkAvailability(
      "villa-1",
      "2024-12-25",
      "2024-12-30"
    );
    expect(availability.available).toBe(true);

    // Create booking
    const booking = await bookingService.create({
      propertyId: "villa-1",
      guestName: "Test Guest",
      guestEmail: "test@example.com",
      checkIn: "2024-12-25",
      checkOut: "2024-12-30",
      guestCount: 2,
    });

    expect(booking.id).toBeDefined();
    expect(booking.confirmationCode).toMatch(/^OKR/);
    expect(booking.totalAmount).toBeGreaterThan(0);
  });

  it("should handle error scenarios", async () => {
    const bookingService = new MockBookingService();

    // Test validation error
    await expect(
      bookingService.create({
        propertyId: "villa-1",
        guestName: "Test",
        guestEmail: "invalid-email", // Invalid email
        checkIn: "2024-12-25",
        checkOut: "2024-12-30",
        guestCount: 2,
      })
    ).rejects.toThrow("Invalid email address");
  });
});
```

## Development Tools

### Mock Data Inspector

```typescript
// src/components/dev/MockDataInspector.tsx
import { config } from '@/config/environment'

export function MockDataInspector() {
  if (!config.showMockIndicator) return null

  const [isOpen, setIsOpen] = useState(false)
  const [mockData, setMockData] = useState<any>({})

  useEffect(() => {
    const loadMockData = async () => {
      const data = {
        bookings: await mockDb.get('bookings'),
        expenses: await mockDb.get('expenses'),
        users: await mockDb.get('users')
      }
      setMockData(data)
    }
    loadMockData()
  }, [])

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-yellow-500 text-black px-4 py-2 rounded"
      >
        Mock Data ({Object.keys(mockData).length})
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-96 max-h-96 overflow-auto bg-white shadow-lg rounded p-4">
          <h3 className="font-bold mb-2">Mock Data Inspector</h3>
          <pre className="text-xs">{JSON.stringify(mockData, null, 2)}</pre>
          <div className="mt-4 space-x-2">
            <button onClick={() => mockDb.reset()} className="btn btn-sm">
              Reset
            </button>
            <button onClick={() => mockDb.clear()} className="btn btn-sm">
              Clear
            </button>
            <button onClick={() => mockDb.seed()} className="btn btn-sm">
              Seed
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

## Contract Testing Integration

### API Contract Validation

```typescript
// src/test/contracts/contract-validator.ts
import { isDeterministicMode } from "@/config/environment";

export class ContractValidator {
  private contracts: Map<string, ApiContract> = new Map();

  registerContract(serviceName: string, contract: ApiContract): void {
    this.contracts.set(serviceName, contract);
  }

  async validateResponse(
    serviceName: string,
    method: string,
    response: any
  ): Promise<void> {
    if (!isDeterministicMode()) return; // Only validate in test mode

    const contract = this.contracts.get(serviceName);
    if (!contract) return;

    const schema = contract.methods[method]?.responseSchema;
    if (!schema) return;

    const validation = schema.safeParse(response);
    if (!validation.success) {
      console.error(
        `Contract violation in ${serviceName}.${method}:`,
        validation.error
      );
      throw new Error(
        `Response does not match contract: ${validation.error.message}`
      );
    }
  }

  async validateRequest(
    serviceName: string,
    method: string,
    request: any
  ): Promise<void> {
    if (!isDeterministicMode()) return;

    const contract = this.contracts.get(serviceName);
    if (!contract) return;

    const schema = contract.methods[method]?.requestSchema;
    if (!schema) return;

    const validation = schema.safeParse(request);
    if (!validation.success) {
      throw new Error(
        `Request does not match contract: ${validation.error.message}`
      );
    }
  }
}

// Usage in mock services
export class MockBookingService {
  private validator = new ContractValidator();

  constructor() {
    this.validator.registerContract("booking", bookingContract);
  }

  async create(data: CreateBookingDTO): Promise<Booking> {
    // Validate request
    await this.validator.validateRequest("booking", "create", data);

    // ... mock implementation ...

    // Validate response
    await this.validator.validateResponse("booking", "create", result);

    return result;
  }
}
```

## Testing Environment Configuration

### localStorage and jsdom Setup

The mock API architecture relies on localStorage for data persistence. To ensure
compatibility with testing environments, configure your test setup as follows:

#### Vitest Configuration (vitest.config.ts)

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom", // Essential for localStorage support
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
```

#### Test Setup File (src/test/setup.ts)

```typescript
// Ensure localStorage is available in test environment
import "jsdom";

// Optional: Mock localStorage if needed
if (typeof global.localStorage === "undefined") {
  global.localStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  };
}

// Initialize mock database for each test
beforeEach(async () => {
  // Clear localStorage before each test
  localStorage.clear();

  // Reset mock database
  await mockDb.reset();
});
```

#### Alternative: localStorage Polyfill

If you prefer not to use jsdom, you can provide a localStorage polyfill:

```typescript
// src/test/polyfills/localStorage.ts
export class LocalStoragePolyfill {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }
}

// Apply polyfill
if (typeof global !== "undefined" && !global.localStorage) {
  global.localStorage = new LocalStoragePolyfill();
}
```

## Usage Examples

### Switching Between Mock and Real APIs

```typescript
// src/App.tsx
import { environment } from "@/config/environment";
import { ServiceRegistry } from "@/services/registry";

function App() {
  useEffect(() => {
    // Log current mode for debugging
    console.log(`Running in ${environment.api.mode} mode`);

    // Show indicator in development
    if (environment.development.showMockIndicator) {
      console.log("Using mock APIs - data is not persisted");
    }
  }, []);

  // Services automatically use correct implementation based on VITE_API_MODE
  const handleBooking = async () => {
    const bookingService = await ServiceRegistry.booking<
      Booking,
      CreateBookingDTO,
      UpdateBookingDTO
    >();

    // This will use mock or real based on VITE_API_MODE environment variable
    const bookings = await bookingService.list();
  };

  // Force specific implementation if needed
  const handleBookingWithMock = async () => {
    const bookingService = await ServiceRegistry.booking({
      forceImplementation: "mock",
    });

    const bookings = await bookingService.list();
  };
}
```

### Testing with Deterministic Mode

```typescript
// src/test/setup.ts
import { ServiceRegistryUtils } from "@/services/registry";
import { environment } from "@/config/environment";

// Test environment automatically uses deterministic mocks via VITE_API_MODE=test
beforeEach(() => {
  // Clear service cache between tests
  ServiceRegistryUtils.clearCache();

  // Reset mock data
  mockDb.reset();

  // Verify we're in test mode
  expect(environment.api.mode).toBe("test");
  expect(environment.test.isDeterministic).toBe(true);
});

// Your tests run with predictable, deterministic mocks
test("booking creation", async () => {
  const service = await ServiceRegistry.booking<
    Booking,
    CreateBookingDTO,
    UpdateBookingDTO
  >();

  // This will use deterministic mock with no random failures (VITE_API_MODE=test)
  const booking = await service.create({
    propertyId: "villa-1",
    guestName: "Test Guest",
    guestEmail: "test@example.com",
    checkIn: "2024-12-25",
    checkOut: "2024-12-30",
    guestCount: 2,
  });

  expect(booking.id).toBeDefined();
  expect(booking.confirmationCode).toMatch(/^OKR/);
});

// Test with specific scenario
test("booking creation with error scenario", async () => {
  // Override test scenario for this test
  // Note: Cannot modify import.meta.env at runtime in browser
  // Use service configuration override instead
  const mockConfig = { ...TEST_SCENARIOS.ERROR_PRONE };

  const service = await ServiceRegistry.booking({
    skipCache: true, // Force recreation with new scenario
  });

  // Test error handling
  await expect(
    service.create({
      propertyId: "villa-1",
      guestName: "Test Guest",
      guestEmail: "invalid-email",
      checkIn: "2024-12-25",
      checkOut: "2024-12-30",
      guestCount: 2,
    })
  ).rejects.toThrow("Invalid email address");
});
```

## Conclusion

This standardized mock API architecture provides a robust foundation for
Vite-based development with proper TypeScript support and environment
configuration. The Vite-compatible environment configuration makes it easy to:

1. **Develop locally** with mocks (`VITE_API_MODE=mock`)
2. **Test reliably** with deterministic mocks (`VITE_API_MODE=test`)
3. **Deploy confidently** to staging/production (`VITE_API_MODE=real`)

### Key Features:

- **Vite Compatibility**: All browser-accessible variables use `VITE_` prefix
- **Type Safety**: Full TypeScript coverage with Zod validation
- **Explicit Service Mapping**: No dynamic imports that break with Vite bundling
- **Deterministic Testing**: Controllable test scenarios with seeded randomness
- **Environment Separation**: Clear distinction between client and server
  variables
- **Service Registry**: Centralized, type-safe service creation and caching

### Migration Path:

The architecture supports seamless migration from mock to real services:

1. Implement API services in `/src/services/api/` directory
2. Update service registry imports in `/src/services/registry.ts`
3. Change `VITE_API_MODE=real` in environment variables
4. No application code changes required

The architecture maintains all the benefits of comprehensive mocking while
ensuring Vite compatibility and proper TypeScript support, making it perfect for
a solo developer managing a family-owned resort system with varying development
skill levels.
