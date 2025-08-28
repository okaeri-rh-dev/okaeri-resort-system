/**
 * In-Memory Repository Implementations for TDD Testing
 * These implementations store data in memory without database dependency
 */

import type {
  IBaseRepository,
  FilterCondition,
  PaginationOptions,
  PaginatedResult,
  TransactionContext,
} from "../../../src/lib/repositories/base.repository";

import type {
  IBookingRepository,
  Booking,
  NewBooking,
  UpdateBooking,
  AvailabilityCheckParams,
  BookingConflict,
  BookingTimeline,
  BookingRevenueSummary,
} from "../../../src/lib/repositories/booking.repository";

import type {
  IPaymentRepository,
  Payment,
  NewPayment,
  UpdatePayment,
  GCashPaymentDetails,
  BankTransferDetails,
  BalanceCalculation,
  DailyPaymentReport,
  PaymentSummary,
} from "../../../src/lib/repositories/payment.repository";

import type { BookingStatus, PaymentStatus, PaymentMethod } from "../../../src/lib/db/schema";

/**
 * Generic in-memory base repository
 */
export class InMemoryBaseRepository<T extends { id: string }, TInsert, TUpdate>
  implements IBaseRepository<T, TInsert, TUpdate>
{
  protected data: Map<string, T> = new Map();
  protected idCounter = 1;

  /**
   * Generate unique ID
   */
  protected generateId(): string {
    return `test-${this.idCounter++}-${Date.now()}`;
  }

  /**
   * Apply filters to an item
   */
  protected matchesFilters(item: T, filters: FilterCondition<T>[]): boolean {
    return filters.every((filter) => {
      const value = item[filter.field as keyof T];

      switch (filter.operator) {
        case "eq":
          return value === filter.value;
        case "ne":
          return value !== filter.value;
        case "gt":
          return value > filter.value;
        case "gte":
          return value >= filter.value;
        case "lt":
          return value < filter.value;
        case "lte":
          return value <= filter.value;
        case "like":
          return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
        case "in":
          return Array.isArray(filter.value) && filter.value.includes(value);
        case "notIn":
          return Array.isArray(filter.value) && !filter.value.includes(value);
        case "isNull":
          return value === null || value === undefined;
        case "isNotNull":
          return value !== null && value !== undefined;
        default:
          return false;
      }
    });
  }

  /**
   * Deep clone an object
   */
  protected clone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  async findById(id: string): Promise<T | null> {
    return this.data.get(id) || null;
  }

  async findOne(filters: FilterCondition<T>[]): Promise<T | null> {
    for (const item of this.data.values()) {
      if (this.matchesFilters(item, filters)) {
        return this.clone(item);
      }
    }
    return null;
  }

  async findMany(filters?: FilterCondition<T>[]): Promise<T[]> {
    const items: T[] = [];
    for (const item of this.data.values()) {
      if (!filters || this.matchesFilters(item, filters)) {
        items.push(this.clone(item));
      }
    }
    return items;
  }

  async findPaginated(
    options: PaginationOptions,
    filters?: FilterCondition<T>[]
  ): Promise<PaginatedResult<T>> {
    const items = await this.findMany(filters);

    // Sort items
    if (options.orderBy) {
      items.sort((a, b) => {
        const aValue = a[options.orderBy as keyof T];
        const bValue = b[options.orderBy as keyof T];
        const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        return options.orderDirection === "desc" ? -comparison : comparison;
      });
    }

    const total = items.length;
    const start = (options.page - 1) * options.pageSize;
    const end = start + options.pageSize;
    const paginatedItems = items.slice(start, end);

    return {
      data: paginatedItems,
      total,
      page: options.page,
      pageSize: options.pageSize,
      totalPages: Math.ceil(total / options.pageSize),
    };
  }

  async create(data: TInsert): Promise<T> {
    const id = this.generateId();
    const now = new Date();
    const item = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    } as T;

    this.data.set(id, this.clone(item));
    return this.clone(item);
  }

  async createMany(data: TInsert[]): Promise<T[]> {
    const items: T[] = [];
    for (const itemData of data) {
      const item = await this.create(itemData);
      items.push(item);
    }
    return items;
  }

  async update(id: string, data: TUpdate): Promise<T | null> {
    const existing = this.data.get(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    } as T;

    this.data.set(id, updated);
    return this.clone(updated);
  }

  async updateMany(filters: FilterCondition<T>[], data: TUpdate): Promise<number> {
    let count = 0;
    for (const [id, item] of this.data.entries()) {
      if (this.matchesFilters(item, filters)) {
        await this.update(id, data);
        count++;
      }
    }
    return count;
  }

  async delete(id: string): Promise<boolean> {
    return this.data.delete(id);
  }

  async deleteMany(filters: FilterCondition<T>[]): Promise<number> {
    let count = 0;
    const toDelete: string[] = [];

    for (const [id, item] of this.data.entries()) {
      if (this.matchesFilters(item, filters)) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      if (this.data.delete(id)) {
        count++;
      }
    }

    return count;
  }

  async exists(filters: FilterCondition<T>[]): Promise<boolean> {
    for (const item of this.data.values()) {
      if (this.matchesFilters(item, filters)) {
        return true;
      }
    }
    return false;
  }

  async count(filters?: FilterCondition<T>[]): Promise<number> {
    if (!filters) {
      return this.data.size;
    }

    let count = 0;
    for (const item of this.data.values()) {
      if (this.matchesFilters(item, filters)) {
        count++;
      }
    }
    return count;
  }

  async transaction<R>(callback: (tx: TransactionContext) => Promise<R>): Promise<R> {
    // In-memory implementation doesn't need real transactions
    // Just execute the callback with a mock transaction context
    return callback({} as TransactionContext);
  }

  /**
   * Clear all data (useful for test cleanup)
   */
  clear(): void {
    this.data.clear();
    this.idCounter = 1;
  }
}

/**
 * In-memory booking repository for testing
 */
export class InMemoryBookingRepository
  extends InMemoryBaseRepository<Booking, NewBooking, UpdateBooking>
  implements IBookingRepository
{
  private bookingCodeCounter = 1;

  async findByBookingCode(code: string): Promise<Booking | null> {
    return this.findOne([{ field: "bookingCode", operator: "eq", value: code }]);
  }

  async checkAvailability(params: AvailabilityCheckParams): Promise<boolean> {
    const conflicts = await this.findConflictingBookings(params);
    return conflicts.length === 0;
  }

  async findConflictingBookings(params: AvailabilityCheckParams): Promise<BookingConflict[]> {
    const conflicts: BookingConflict[] = [];

    for (const booking of this.data.values()) {
      // Skip cancelled and no-show bookings
      if (booking.status === "cancelled" || booking.status === "no_show") {
        continue;
      }

      // Skip excluded booking
      if (params.excludeBookingId && booking.id === params.excludeBookingId) {
        continue;
      }

      // Check date overlap
      const checkIn = new Date(booking.checkInDate);
      const checkOut = new Date(booking.checkOutDate);
      const paramCheckIn = new Date(params.checkInDate);
      const paramCheckOut = new Date(params.checkOutDate);

      const hasDateOverlap =
        (paramCheckIn >= checkIn && paramCheckIn < checkOut) ||
        (paramCheckOut > checkIn && paramCheckOut <= checkOut) ||
        (paramCheckIn <= checkIn && paramCheckOut >= checkOut);

      if (!hasDateOverlap) {
        continue;
      }

      // Check room constraints
      if (params.roomNumber && booking.roomNumber !== params.roomNumber) {
        continue;
      }

      if (params.roomType && booking.roomType !== params.roomType) {
        continue;
      }

      conflicts.push({
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        guestName: booking.guestName,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        roomNumber: booking.roomNumber,
        roomType: booking.roomType,
      });
    }

    return conflicts;
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Booking[]> {
    const bookings: Booking[] = [];

    for (const booking of this.data.values()) {
      const checkIn = new Date(booking.checkInDate);
      const checkOut = new Date(booking.checkOutDate);

      const isInRange =
        (checkIn >= startDate && checkIn <= endDate) ||
        (checkOut >= startDate && checkOut <= endDate) ||
        (checkIn <= startDate && checkOut >= endDate);

      if (isInRange) {
        bookings.push(this.clone(booking));
      }
    }

    return bookings.sort(
      (a, b) => new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime()
    );
  }

  async findByStatus(status: BookingStatus): Promise<Booking[]> {
    return this.findMany([{ field: "status", operator: "eq", value: status }]);
  }

  async findByPaymentStatus(status: PaymentStatus): Promise<Booking[]> {
    return this.findMany([{ field: "paymentStatus", operator: "eq", value: status }]);
  }

  async findUpcomingCheckIns(days: number): Promise<Booking[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    const bookings: Booking[] = [];

    for (const booking of this.data.values()) {
      if (booking.status !== "confirmed") continue;

      const checkIn = new Date(booking.checkInDate);
      if (checkIn >= today && checkIn <= futureDate) {
        bookings.push(this.clone(booking));
      }
    }

    return bookings.sort(
      (a, b) => new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime()
    );
  }

  async findUpcomingCheckOuts(days: number): Promise<Booking[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    const bookings: Booking[] = [];

    for (const booking of this.data.values()) {
      if (booking.status !== "checked_in") continue;

      const checkOut = new Date(booking.checkOutDate);
      if (checkOut >= today && checkOut <= futureDate) {
        bookings.push(this.clone(booking));
      }
    }

    return bookings.sort(
      (a, b) => new Date(a.checkOutDate).getTime() - new Date(b.checkOutDate).getTime()
    );
  }

  async findOverduePayments(): Promise<Booking[]> {
    const today = new Date();
    const bookings: Booking[] = [];

    for (const booking of this.data.values()) {
      const checkIn = new Date(booking.checkInDate);
      const hasBalance = parseFloat(booking.balanceAmount) > 0;
      const isOverdue =
        checkIn <= today &&
        hasBalance &&
        (booking.paymentStatus === "pending" || booking.paymentStatus === "partial");

      if (isOverdue) {
        bookings.push(this.clone(booking));
      }
    }

    return bookings.sort((a, b) => parseFloat(b.balanceAmount) - parseFloat(a.balanceAmount));
  }

  async getBookingTimeline(startDate: Date, endDate: Date): Promise<BookingTimeline[]> {
    const bookings = await this.findByDateRange(startDate, endDate);
    const timeline: Map<string, BookingTimeline> = new Map();

    // Initialize dates
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split("T")[0];
      timeline.set(dateKey, {
        date: new Date(currentDate),
        bookings: [],
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Populate bookings
    bookings.forEach((booking) => {
      const checkInKey = new Date(booking.checkInDate).toISOString().split("T")[0];
      const checkOutKey = new Date(booking.checkOutDate).toISOString().split("T")[0];

      if (timeline.has(checkInKey)) {
        timeline.get(checkInKey)!.bookings.push({
          id: booking.id,
          bookingCode: booking.bookingCode,
          guestName: booking.guestName,
          status: booking.status,
          roomNumber: booking.roomNumber,
          checkIn: true,
          checkOut: false,
        });
      }

      if (timeline.has(checkOutKey) && checkInKey !== checkOutKey) {
        timeline.get(checkOutKey)!.bookings.push({
          id: booking.id,
          bookingCode: booking.bookingCode,
          guestName: booking.guestName,
          status: booking.status,
          roomNumber: booking.roomNumber,
          checkIn: false,
          checkOut: true,
        });
      }
    });

    return Array.from(timeline.values());
  }

  async getMonthlyBookingSummary(year: number, month: number): Promise<BookingRevenueSummary> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    let totalRevenue = 0;
    let paidAmount = 0;
    let pendingAmount = 0;
    let bookingCount = 0;

    for (const booking of this.data.values()) {
      const checkIn = new Date(booking.checkInDate);
      const checkOut = new Date(booking.checkOutDate);

      const isInMonth =
        (checkIn >= startDate && checkIn <= endDate) ||
        (checkOut >= startDate && checkOut <= endDate);

      if (isInMonth && booking.status !== "cancelled") {
        totalRevenue += parseFloat(booking.totalAmount);
        paidAmount += parseFloat(booking.paidAmount);
        pendingAmount += parseFloat(booking.balanceAmount);
        bookingCount++;
      }
    }

    return {
      totalRevenue,
      paidAmount,
      pendingAmount,
      bookingCount,
      averageBookingValue: bookingCount > 0 ? totalRevenue / bookingCount : 0,
      occupancyRate: 50, // Mock value for testing
    };
  }

  async searchBookings(query: string): Promise<Booking[]> {
    const searchTerm = query.toLowerCase();
    const bookings: Booking[] = [];

    for (const booking of this.data.values()) {
      if (
        booking.guestName.toLowerCase().includes(searchTerm) ||
        booking.guestPhone.includes(searchTerm) ||
        (booking.guestEmail && booking.guestEmail.toLowerCase().includes(searchTerm)) ||
        booking.bookingCode.toLowerCase().includes(searchTerm)
      ) {
        bookings.push(this.clone(booking));
      }
    }

    return bookings
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);
  }

  async bulkUpdateStatus(bookingIds: string[], status: BookingStatus): Promise<number> {
    let count = 0;
    for (const id of bookingIds) {
      const result = await this.update(id, { status, updatedAt: new Date() });
      if (result) count++;
    }
    return count;
  }

  async bulkUpdatePaymentStatus(bookingIds: string[], status: PaymentStatus): Promise<number> {
    let count = 0;
    for (const id of bookingIds) {
      const result = await this.update(id, { paymentStatus: status, updatedAt: new Date() });
      if (result) count++;
    }
    return count;
  }

  async findGcashPayments(): Promise<Booking[]> {
    const bookings: Booking[] = [];

    for (const booking of this.data.values()) {
      if (booking.metadata?.paymentMethod === "gcash") {
        bookings.push(this.clone(booking));
      }
    }

    return bookings;
  }

  async calculateVatAmount(bookingId: string): Promise<number> {
    const booking = await this.findById(bookingId);
    if (!booking) return 0;

    const vatRate = 0.12;
    const totalAmount = parseFloat(booking.totalAmount);
    const vatAmount = totalAmount - totalAmount / (1 + vatRate);

    return Math.round(vatAmount * 100) / 100;
  }

  async generateBookingCode(): Promise<string> {
    const code = `BK${Date.now().toString(36).toUpperCase()}${this.bookingCodeCounter++}`;
    return code;
  }

  async create(data: NewBooking): Promise<Booking> {
    const bookingData = {
      ...data,
      bookingCode: data.bookingCode || (await this.generateBookingCode()),
    };
    return super.create(bookingData);
  }
}

/**
 * In-memory payment repository for testing
 */
export class InMemoryPaymentRepository
  extends InMemoryBaseRepository<Payment, NewPayment, UpdatePayment>
  implements IPaymentRepository
{
  private paymentCodeCounter = 1;

  async findByPaymentCode(code: string): Promise<Payment | null> {
    return this.findOne([{ field: "paymentCode", operator: "eq", value: code }]);
  }

  async findByBookingId(bookingId: string): Promise<Payment[]> {
    return this.findMany([{ field: "bookingId", operator: "eq", value: bookingId }]);
  }

  async findGCashPayments(startDate?: Date, endDate?: Date): Promise<Payment[]> {
    const payments: Payment[] = [];

    for (const payment of this.data.values()) {
      if (payment.paymentMethod !== "gcash") continue;

      if (startDate && endDate) {
        const createdAt = new Date(payment.createdAt);
        if (createdAt < startDate || createdAt > endDate) continue;
      }

      payments.push(this.clone(payment));
    }

    return payments.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async findBankTransfers(startDate?: Date, endDate?: Date): Promise<Payment[]> {
    const payments: Payment[] = [];

    for (const payment of this.data.values()) {
      if (payment.paymentMethod !== "bank_transfer") continue;

      if (startDate && endDate) {
        const createdAt = new Date(payment.createdAt);
        if (createdAt < startDate || createdAt > endDate) continue;
      }

      payments.push(this.clone(payment));
    }

    return payments.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async findCashPayments(startDate?: Date, endDate?: Date): Promise<Payment[]> {
    const payments: Payment[] = [];

    for (const payment of this.data.values()) {
      if (payment.paymentMethod !== "cash") continue;

      if (startDate && endDate) {
        const createdAt = new Date(payment.createdAt);
        if (createdAt < startDate || createdAt > endDate) continue;
      }

      payments.push(this.clone(payment));
    }

    return payments.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async verifyGCashPayment(
    paymentId: string,
    details: GCashPaymentDetails,
    verifiedBy: string
  ): Promise<Payment | null> {
    return this.update(paymentId, {
      gcashReferenceNumber: details.referenceNumber,
      gcashAccountName: details.accountName,
      gcashAccountNumber: details.accountNumber,
      status: "completed",
      verifiedAt: new Date(),
      verifiedBy,
      updatedAt: new Date(),
    });
  }

  async findUnverifiedGCashPayments(): Promise<Payment[]> {
    const payments: Payment[] = [];

    for (const payment of this.data.values()) {
      if (
        payment.paymentMethod === "gcash" &&
        (payment.status === "pending" || payment.status === "processing") &&
        !payment.verifiedAt
      ) {
        payments.push(this.clone(payment));
      }
    }

    return payments.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  async matchGCashReference(referenceNumber: string): Promise<Payment | null> {
    return this.findOne([
      { field: "gcashReferenceNumber", operator: "eq", value: referenceNumber },
    ]);
  }

  async verifyBankTransfer(
    paymentId: string,
    details: BankTransferDetails,
    verifiedBy: string
  ): Promise<Payment | null> {
    return this.update(paymentId, {
      bankName: details.bankName,
      bankAccountNumber: details.accountNumber,
      bankAccountName: details.accountName,
      referenceNumber: details.referenceNumber,
      status: "completed",
      verifiedAt: new Date(),
      verifiedBy,
      updatedAt: new Date(),
    });
  }

  async findUnverifiedBankTransfers(): Promise<Payment[]> {
    const payments: Payment[] = [];

    for (const payment of this.data.values()) {
      if (
        payment.paymentMethod === "bank_transfer" &&
        (payment.status === "pending" || payment.status === "processing") &&
        !payment.verifiedAt
      ) {
        payments.push(this.clone(payment));
      }
    }

    return payments.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  async calculateBookingBalance(bookingId: string): Promise<BalanceCalculation> {
    const payments = await this.findByBookingId(bookingId);

    let paidAmount = 0;
    let pendingAmount = 0;
    let lastPaymentDate: Date | null = null;

    for (const payment of payments) {
      const amount = parseFloat(payment.amount);

      if (payment.status === "completed") {
        if (payment.paymentType === "refund") {
          paidAmount -= amount;
        } else {
          paidAmount += amount;
          if (!lastPaymentDate || payment.createdAt > lastPaymentDate) {
            lastPaymentDate = payment.createdAt;
          }
        }
      } else if (payment.status === "pending" || payment.status === "processing") {
        pendingAmount += amount;
      }
    }

    // Mock total amount for testing
    const totalAmount = 10000;
    const balanceAmount = totalAmount - paidAmount;

    return {
      bookingId,
      totalAmount,
      paidAmount,
      pendingAmount,
      balanceAmount,
      isFullyPaid: balanceAmount <= 0,
      lastPaymentDate,
    };
  }

  async findOverduePayments(daysOverdue: number): Promise<Payment[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

    const payments: Payment[] = [];

    for (const payment of this.data.values()) {
      if (
        (payment.status === "pending" || payment.status === "processing") &&
        payment.createdAt <= cutoffDate
      ) {
        payments.push(this.clone(payment));
      }
    }

    return payments.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  async reconcilePayments(bookingId: string): Promise<boolean> {
    const balance = await this.calculateBookingBalance(bookingId);
    return balance.isFullyPaid;
  }

  async getDailyReport(date: Date): Promise<DailyPaymentReport> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    let totalAmount = 0;
    let paymentCount = 0;
    const methodBreakdown: Map<PaymentMethod, { amount: number; count: number }> = new Map();
    const dailyPayments: Payment[] = [];

    for (const payment of this.data.values()) {
      const createdAt = new Date(payment.createdAt);
      if (createdAt >= startOfDay && createdAt <= endOfDay && payment.status === "completed") {
        const amount = parseFloat(payment.amount);
        totalAmount += amount;
        paymentCount++;
        dailyPayments.push(this.clone(payment));

        const methodData = methodBreakdown.get(payment.paymentMethod) || { amount: 0, count: 0 };
        methodData.amount += amount;
        methodData.count++;
        methodBreakdown.set(payment.paymentMethod, methodData);
      }
    }

    const methods = Array.from(methodBreakdown.entries()).map(([method, data]) => ({
      method,
      amount: data.amount,
      count: data.count,
    }));

    const topPayments = dailyPayments
      .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
      .slice(0, 5);

    return {
      date,
      totalAmount,
      paymentCount,
      methods,
      topPayments,
    };
  }

  async getMonthlyRevenue(year: number, month: number): Promise<PaymentSummary> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    let totalAmount = 0;
    let completedAmount = 0;
    let pendingAmount = 0;
    let refundedAmount = 0;
    let paymentCount = 0;
    const methodBreakdown = {
      cash: 0,
      gcash: 0,
      bankTransfer: 0,
      creditCard: 0,
    };

    for (const payment of this.data.values()) {
      const createdAt = new Date(payment.createdAt);
      if (createdAt >= startDate && createdAt <= endDate) {
        const amount = parseFloat(payment.amount);
        totalAmount += amount;
        paymentCount++;

        if (payment.status === "completed") {
          completedAmount += amount;

          switch (payment.paymentMethod) {
            case "cash":
              methodBreakdown.cash += amount;
              break;
            case "gcash":
              methodBreakdown.gcash += amount;
              break;
            case "bank_transfer":
              methodBreakdown.bankTransfer += amount;
              break;
            case "credit_card":
              methodBreakdown.creditCard += amount;
              break;
          }
        } else if (payment.status === "pending" || payment.status === "processing") {
          pendingAmount += amount;
        }

        if (payment.paymentType === "refund") {
          refundedAmount += amount;
        }
      }
    }

    return {
      totalAmount,
      completedAmount,
      pendingAmount,
      refundedAmount,
      paymentCount,
      averagePaymentAmount: paymentCount > 0 ? totalAmount / paymentCount : 0,
      methodBreakdown,
    };
  }

  async getPaymentsByDateRange(startDate: Date, endDate: Date): Promise<Payment[]> {
    const payments: Payment[] = [];

    for (const payment of this.data.values()) {
      const createdAt = new Date(payment.createdAt);
      if (createdAt >= startDate && createdAt <= endDate) {
        payments.push(this.clone(payment));
      }
    }

    return payments.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async processRefund(
    originalPaymentId: string,
    refundAmount: number,
    reason: string,
    processedBy: string
  ): Promise<Payment> {
    const originalPayment = await this.findById(originalPaymentId);
    if (!originalPayment) {
      throw new Error("Original payment not found");
    }

    const refundPayment: NewPayment = {
      bookingId: originalPayment.bookingId,
      paymentCode: `PAY${Date.now()}${this.paymentCodeCounter++}`,
      amount: refundAmount.toString(),
      paymentMethod: originalPayment.paymentMethod,
      paymentType: "refund",
      transactionId: null,
      referenceNumber: `REFUND-${originalPayment.paymentCode}`,
      gcashReferenceNumber: originalPayment.gcashReferenceNumber,
      gcashAccountName: originalPayment.gcashAccountName,
      gcashAccountNumber: originalPayment.gcashAccountNumber,
      bankName: originalPayment.bankName,
      bankAccountNumber: originalPayment.bankAccountNumber,
      bankAccountName: originalPayment.bankAccountName,
      status: "completed",
      verifiedAt: new Date(),
      verifiedBy: processedBy,
      receiptNumber: null,
      receiptUrl: null,
      notes: `Refund for payment ${originalPayment.paymentCode}: ${reason}`,
      failureReason: null,
      metadata: {
        originalPaymentId,
        refundReason: reason,
      },
      processedBy,
    };

    return this.create(refundPayment);
  }

  async findRefunds(startDate?: Date, endDate?: Date): Promise<Payment[]> {
    const refunds: Payment[] = [];

    for (const payment of this.data.values()) {
      if (payment.paymentType !== "refund") continue;

      if (startDate && endDate) {
        const createdAt = new Date(payment.createdAt);
        if (createdAt < startDate || createdAt > endDate) continue;
      }

      refunds.push(this.clone(payment));
    }

    return refunds.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async generateOfficialReceipt(paymentId: string): Promise<string> {
    const payment = await this.findById(paymentId);
    if (!payment) {
      throw new Error("Payment not found");
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const receiptNumber = `OR-${year}-${month}-${String(this.paymentCodeCounter++).padStart(6, "0")}`;

    await this.update(paymentId, { receiptNumber });

    return receiptNumber;
  }

  async calculateWithholdingTax(paymentId: string, rate: number): Promise<number> {
    const payment = await this.findById(paymentId);
    if (!payment) {
      throw new Error("Payment not found");
    }

    const amount = parseFloat(payment.amount);
    const withholdingTax = amount * rate;

    return Math.round(withholdingTax * 100) / 100;
  }

  async create(data: NewPayment): Promise<Payment> {
    const paymentData = {
      ...data,
      paymentCode: data.paymentCode || `PAY${Date.now()}${this.paymentCodeCounter++}`,
    };
    return super.create(paymentData);
  }
}

/**
 * Factory function to create test repositories
 */
export function createTestRepositories() {
  return {
    booking: new InMemoryBookingRepository(),
    payment: new InMemoryPaymentRepository(),
  };
}

/**
 * Test data generators
 */
export const testDataGenerators = {
  booking: (overrides?: Partial<NewBooking>): NewBooking => ({
    bookingCode: `BK${Date.now()}`,
    guestName: "John Doe",
    guestEmail: "john@example.com",
    guestPhone: "09171234567",
    guestAddress: "123 Main St, Manila",
    numberOfGuests: 2,
    numberOfChildren: 0,
    checkInDate: new Date("2024-01-15"),
    checkOutDate: new Date("2024-01-17"),
    checkInTime: "14:00",
    checkOutTime: "12:00",
    roomType: "Deluxe",
    roomNumber: "101",
    basePrice: "5000",
    additionalCharges: "0",
    discountAmount: "0",
    taxAmount: "600",
    totalAmount: "5600",
    depositAmount: "2000",
    paidAmount: "2000",
    balanceAmount: "3600",
    status: "confirmed" as BookingStatus,
    paymentStatus: "partial" as PaymentStatus,
    specialRequests: null,
    internalNotes: null,
    cancellationReason: null,
    cancelledAt: null,
    cancelledBy: null,
    source: "direct",
    metadata: {},
    createdBy: null,
    updatedBy: null,
    ...overrides,
  }),

  payment: (overrides?: Partial<NewPayment>): NewPayment => ({
    bookingId: "test-booking-1",
    paymentCode: `PAY${Date.now()}`,
    amount: "2000",
    paymentMethod: "cash" as PaymentMethod,
    paymentType: "deposit",
    transactionId: null,
    referenceNumber: null,
    gcashReferenceNumber: null,
    gcashAccountName: null,
    gcashAccountNumber: null,
    bankName: null,
    bankAccountNumber: null,
    bankAccountName: null,
    status: "completed" as PaymentStatus,
    verifiedAt: new Date(),
    verifiedBy: "test-user",
    receiptNumber: null,
    receiptUrl: null,
    notes: null,
    failureReason: null,
    metadata: {},
    processedBy: "test-user",
    ...overrides,
  }),
};
