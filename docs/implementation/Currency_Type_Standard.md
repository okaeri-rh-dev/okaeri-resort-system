# Currency Type Standard for Okaeri Resort System

## Executive Summary

This document establishes the definitive standard for handling monetary values
throughout the Okaeri Resort Management System. All monetary values MUST be
stored and processed using the **Money class** with `Decimal.js` for precision
throughout all application layers, preventing floating-point errors and ensuring
accurate financial calculations.

## Core Principle

**All Monetary Values Use Money Class - Never Plain Numbers or Strings**

The Money class (`src/lib/money.ts`) provides:

- Decimal.js precision preventing 0.1 + 0.2 !== 0.3 problems
- Philippine-specific business rules (VAT, senior/PWD discounts, service
  charges)
- Type-safe monetary operations with immutable design
- Built-in formatting and parsing capabilities
- Consistent rounding behavior for financial calculations

## Layer-Specific Standards

### 1. Domain Layer (Business Logic)

All monetary values in services, models, and business logic MUST use the `Money`
class from `src/lib/money.ts`.

```typescript
import { Money } from "@/lib/money";

// CORRECT - Domain models use Money class
interface Booking {
  totalAmount: Money; // Money instance with Decimal.js precision
  paidAmount: Money; // Money instance
  balanceAmount: Money; // Money instance
  vatAmount: Money; // Money instance
  serviceCharge: Money; // Money instance
}

interface Expense {
  amount: Money; // Money instance
  vatAmount: Money; // Money instance
  netAmount: Money; // Money instance
}

interface Payment {
  amount: Money; // Money instance
  processingFee: Money; // Money instance
  netAmount: Money; // Money instance
}

// Business logic operations use Money methods
class BookingService {
  calculateTotal(baseAmount: Money, serviceCharge: Money): Money {
    // Type-safe operations with proper precision
    return baseAmount.add(serviceCharge).addVAT();
  }

  applyDiscount(amount: Money, discountPercent: number): Money {
    const discount = amount.percentage(discountPercent);
    return amount.subtract(discount);
  }
}
```

### 2. Database Layer

PostgreSQL DECIMAL types store the raw numeric values, which are converted to
Money instances at the application boundary.

```sql
-- All monetary columns use DECIMAL for precision
CREATE TABLE bookings (
  total_amount DECIMAL(12, 2) NOT NULL,     -- Stored as DECIMAL, converted to Money
  paid_amount DECIMAL(12, 2) DEFAULT 0,     -- Stored as DECIMAL, converted to Money
  vat_amount DECIMAL(12, 2) DEFAULT 0,      -- Stored as DECIMAL, converted to Money
  service_charge DECIMAL(12, 2) DEFAULT 0   -- Stored as DECIMAL, converted to Money
);
```

```typescript
// Database layer conversion
class BookingRepository {
  async findById(id: string): Promise<Booking> {
    const row = await db.query("SELECT * FROM bookings WHERE id = $1", [id]);

    // Convert database decimals to Money instances
    return {
      id: row.id,
      totalAmount: new Money(row.total_amount), // Convert DECIMAL to Money
      paidAmount: new Money(row.paid_amount), // Convert DECIMAL to Money
      vatAmount: new Money(row.vat_amount), // Convert DECIMAL to Money
      serviceCharge: new Money(row.service_charge), // Convert DECIMAL to Money
    };
  }

  async save(booking: Booking): Promise<void> {
    // Convert Money instances to numbers for database storage
    await db.query(
      `
      INSERT INTO bookings (total_amount, paid_amount, vat_amount, service_charge)
      VALUES ($1, $2, $3, $4)
    `,
      [
        booking.totalAmount.toNumber(), // Convert Money to number
        booking.paidAmount.toNumber(), // Convert Money to number
        booking.vatAmount.toNumber(), // Convert Money to number
        booking.serviceCharge.toNumber(), // Convert Money to number
      ]
    );
  }
}
```

### 3. Zod Validation Schemas

Zod schemas should validate input data and transform it to Money instances.

```typescript
import { Money } from "@/lib/money";
import { z } from "zod";

// Custom Money validator
const MoneySchema = z
  .union([
    z.number().transform((val) => new Money(val)),
    z.string().transform((val) => Money.parse(val)),
    z.instanceof(Money),
  ])
  .refine((val) => val instanceof Money, {
    message: "Must be a valid Money instance",
  });

// CORRECT - Zod schemas transform to Money instances
export const BookingSchema = z.object({
  totalAmount: MoneySchema,
  paidAmount: MoneySchema,
  balanceAmount: MoneySchema,
  vatAmount: MoneySchema,
  serviceCharge: MoneySchema,
});

export const ExpenseSchema = z.object({
  amount: MoneySchema.refine((money) => money.isPositive(), {
    message: "Amount must be positive",
  }),
  vatAmount: MoneySchema,
  netAmount: MoneySchema,
});

// For API input that accepts various formats
export const CreateBookingSchema = z.object({
  // Accepts number, string, or Money - converts to Money
  totalAmount: z
    .union([z.number().nonnegative(), z.string(), z.instanceof(Money)])
    .transform((val) => {
      if (val instanceof Money) return val;
      if (typeof val === "string") return Money.parse(val);
      return new Money(val);
    }),

  paidAmount: z
    .union([z.number().nonnegative(), z.string(), z.instanceof(Money)])
    .transform((val) => {
      if (val instanceof Money) return val;
      if (typeof val === "string") return Money.parse(val);
      return new Money(val);
    })
    .optional()
    .default(() => new Money(0)),

  // ... other fields
});

// Alternative: Reusable Money field validator
const createMoneyField = (required = true) => {
  const base = z
    .union([
      z.number().nonnegative(),
      z.string().refine(Money.isValid, "Invalid money format"),
      z.instanceof(Money),
    ])
    .transform((val) => {
      if (val instanceof Money) return val;
      if (typeof val === "string") return Money.parse(val);
      return new Money(val);
    });

  return required ? base : base.optional();
};

export const SimplifiedBookingSchema = z.object({
  totalAmount: createMoneyField(),
  paidAmount: createMoneyField(false),
  vatAmount: createMoneyField(false),
  serviceCharge: createMoneyField(false),
});
```

### 4. API Layer (Input/Output)

APIs should accept various input formats and work with Money instances
internally, serializing appropriately for output.

```typescript
import { Money } from "@/lib/money";

// API Input Handler
export class BookingController {
  async createBooking(dto: CreateBookingDto) {
    // Validation schema converts inputs to Money instances
    const validatedData = CreateBookingSchema.parse(dto);

    // Service layer works with Money instances
    return this.bookingService.create(validatedData);
  }

  async getBooking(id: string) {
    const booking = await this.bookingService.findById(id);

    // Convert to API response format
    return {
      ...booking,
      // Include both raw numbers and formatted strings
      totalAmount: booking.totalAmount.toNumber(),
      paidAmount: booking.paidAmount.toNumber(),
      balanceAmount: booking.balanceAmount.toNumber(),

      // Formatted versions for display
      totalAmountFormatted: booking.totalAmount.format(),
      paidAmountFormatted: booking.paidAmount.format(),
      balanceAmountFormatted: booking.balanceAmount.format(),
    };
  }
}

// API Response DTO
export class BookingResponseDto {
  // Raw numbers for calculations
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;

  // Formatted strings for display
  totalAmountFormatted: string;
  paidAmountFormatted: string;
  balanceAmountFormatted: string;

  static fromDomain(booking: Booking): BookingResponseDto {
    return {
      ...booking,
      totalAmount: booking.totalAmount.toNumber(),
      paidAmount: booking.paidAmount.toNumber(),
      balanceAmount: booking.balanceAmount.toNumber(),
      totalAmountFormatted: booking.totalAmount.format(),
      paidAmountFormatted: booking.paidAmount.format(),
      balanceAmountFormatted: booking.balanceAmount.format(),
    };
  }
}

// Input DTO accepts flexible formats
export class CreateBookingDto {
  // Can be number, string like "5000", or formatted like "₱5,000.00"
  totalAmount: string | number;
  paidAmount?: string | number;
  // ... other fields
}
```

### 5. UI/Display Layer

Use Money class methods for formatting. Never convert to numbers in the UI
layer.

```typescript
import { Money, formatPHP } from '@/lib/money';

// CORRECT - Use Money class formatting methods
export function BookingCard({ booking }: { booking: Booking }) {
  return (
    <div>
      {/* Use built-in Money formatting */}
      <p>Total: {booking.totalAmount.format()}</p>
      <p>Paid: {booking.paidAmount.format()}</p>
      <p>Balance: {booking.balanceAmount.format()}</p>

      {/* Or use convenience function */}
      <p>Service Charge: {formatPHP(booking.serviceCharge)}</p>

      {/* Custom formatting options */}
      <p>VAT: {booking.vatAmount.format({ minimumFractionDigits: 2 })}</p>

      {/* Simple peso symbol formatting */}
      <p>Simple: {booking.totalAmount.formatWithSymbol()}</p>
    </div>
  );
}

// Form input handling
export function PaymentForm() {
  const [amount, setAmount] = useState('');

  const handleAmountChange = (value: string) => {
    // Store raw input string until validation
    setAmount(value);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    try {
      // Parse user input to Money instance
      const paymentAmount = Money.parse(amount);

      // Validate
      if (!paymentAmount.isPositive()) {
        throw new Error('Amount must be positive');
      }

      // Submit with Money instance
      onSubmit({ amount: paymentAmount });

    } catch (error) {
      // Handle parsing errors
      setError('Invalid amount format');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={amount}
        onChange={(e) => handleAmountChange(e.target.value)}
        placeholder="₱5,000.00"
      />
      {/* Show formatted preview */}
      {Money.isValid(amount) && (
        <p>Preview: {Money.parse(amount).format()}</p>
      )}
    </form>
  );
}

// Display calculations in real-time
export function BookingCalculator({ baseRate }: { baseRate: Money }) {
  const [nights, setNights] = useState(1);
  const [guests, setGuests] = useState(2);

  // Calculate totals using Money methods
  const roomTotal = baseRate.multiply(nights);
  const withService = roomTotal.addServiceCharge();
  const finalAmount = withService.addVAT();
  const vatAmount = finalAmount.getVATAmount();

  return (
    <div>
      <div>
        <label>Nights: {nights}</label>
        <input
          type="range"
          min="1"
          max="14"
          value={nights}
          onChange={(e) => setNights(Number(e.target.value))}
        />
      </div>

      <div className="calculation-breakdown">
        <p>Room ({nights} nights): {roomTotal.format()}</p>
        <p>Service Charge (10%): {roomTotal.percentage(10).format()}</p>
        <p>Subtotal: {withService.format()}</p>
        <p>VAT (12%): {vatAmount.format()}</p>
        <p><strong>Total: {finalAmount.format()}</strong></p>
      </div>
    </div>
  );
}
```

### 6. CSV Import/Export

Use Money.parse() for import and Money formatting for export.

```typescript
import { Money } from "@/lib/money";

// CSV Import
export class CSVImporter {
  parseBookingRow(row: CSVRow): Booking {
    return {
      guestName: row.guestName,
      // Use Money.parse() which handles currency symbols, commas, etc.
      totalAmount: Money.parse(row.totalAmount || "0"),
      paidAmount: Money.parse(row.paidAmount || "0"),
      vatAmount: Money.parse(row.vatAmount || "0"),
      serviceCharge: Money.parse(row.serviceCharge || "0"),
      // ... other fields
    };
  }

  // Validate CSV data
  validateRow(row: CSVRow): string[] {
    const errors: string[] = [];

    if (!Money.isValid(row.totalAmount)) {
      errors.push(`Invalid total amount: ${row.totalAmount}`);
    }

    if (row.paidAmount && !Money.isValid(row.paidAmount)) {
      errors.push(`Invalid paid amount: ${row.paidAmount}`);
    }

    return errors;
  }
}

// CSV Export
export class CSVExporter {
  exportBookings(bookings: Booking[]): string {
    const rows = bookings.map((booking) => ({
      guestName: booking.guestName,
      // Export as properly formatted strings
      totalAmount: booking.totalAmount.toString(), // "5000.00"
      paidAmount: booking.paidAmount.toString(), // "3000.00"
      balanceAmount: booking.balanceAmount.toString(), // "2000.00"

      // Or with currency formatting for readability
      totalAmountFormatted: booking.totalAmount.format(), // "₱5,000.00"
      paidAmountFormatted: booking.paidAmount.format(), // "₱3,000.00"
      balanceAmountFormatted: booking.balanceAmount.format(), // "₱2,000.00"

      // ... other fields
    }));

    return this.convertToCSV(rows);
  }

  // Export for accounting software (plain numbers)
  exportForAccounting(bookings: Booking[]): string {
    const rows = bookings.map((booking) => ({
      guestName: booking.guestName,
      // Plain number strings for accounting imports
      totalAmount: booking.totalAmount.toNumber(),
      paidAmount: booking.paidAmount.toNumber(),
      balanceAmount: booking.balanceAmount.toNumber(),
      vatAmount: booking.vatAmount.toNumber(),
      serviceCharge: booking.serviceCharge.toNumber(),
    }));

    return this.convertToCSV(rows);
  }
}

// Excel/Google Sheets integration
export class SpreadsheetSync {
  // Import from Google Sheets
  async importFromSheets(sheetData: any[][]): Promise<Booking[]> {
    return sheetData.map((row) => ({
      guestName: row[0],
      // Handle various formats from spreadsheets
      totalAmount: Money.parse(row[1]?.toString() || "0"),
      paidAmount: Money.parse(row[2]?.toString() || "0"),
      // ...
    }));
  }

  // Export to Google Sheets with proper formatting
  async exportToSheets(bookings: Booking[]): Promise<any[][]> {
    return bookings.map((booking) => [
      booking.guestName,
      booking.totalAmount.toNumber(), // Numbers for calculations
      booking.paidAmount.toNumber(),
      booking.balanceAmount.toNumber(),
      booking.totalAmount.format(), // Formatted strings for display
      booking.paidAmount.format(),
      booking.balanceAmount.format(),
    ]);
  }
}
```

## Philippine Business Calculations

The Money class includes built-in methods for Philippine business rules and
calculations.

### VAT Calculations

```typescript
import { Money } from "@/lib/money";

// Built-in VAT methods in Money class
const roomRate = new Money(5000);

// Add VAT (for VAT-exclusive amounts)
const withVAT = roomRate.addVAT(); // ₱5,600.00

// Remove VAT (from VAT-inclusive amounts)
const vatInclusiveAmount = new Money(5600);
const preVAT = vatInclusiveAmount.removeVAT(); // ₱5,000.00

// Get VAT amount only
const vatAmount = vatInclusiveAmount.getVATAmount(); // ₱600.00

// Custom balance calculations using MoneyUtils
class BookingCalculations {
  static calculateRoomCharges(
    baseRate: Money,
    nights: number,
    adults: number,
    children: number = 0
  ): {
    roomTotal: Money;
    serviceCharge: Money;
    vatAmount: Money;
    grandTotal: Money;
  } {
    // Use MoneyUtils for complex room calculations
    const roomTotal = MoneyUtils.calculateRoomRate(
      baseRate,
      nights,
      adults,
      children
    );

    // Add service charge
    const withService = roomTotal.addServiceCharge();

    // Add VAT
    const grandTotal = withService.addVAT();
    const vatAmount = grandTotal.getVATAmount();
    const serviceCharge = roomTotal.percentage(10);

    return {
      roomTotal,
      serviceCharge,
      vatAmount,
      grandTotal,
    };
  }
}
```

### Philippine Discounts

```typescript
// Senior Citizen Discount (20% on pre-VAT amount, VAT-exempt)
const seniorTotal = roomRate.applySeniorDiscount();

// PWD Discount (20% on pre-VAT amount, VAT-exempt)
const pwdTotal = roomRate.applyPWDDiscount();

// Custom discount calculations
class DiscountCalculations {
  static applyMultipleDiscounts(
    amount: Money,
    isSenior: boolean,
    isPWD: boolean,
    groupDiscount: number = 0
  ): Money {
    let discountedAmount = amount;

    // Apply senior/PWD discount (mutually exclusive, take higher)
    if (isSenior && isPWD) {
      // Both qualify - use whichever gives better discount
      const seniorDiscount = amount.applySeniorDiscount();
      const pwdDiscount = amount.applyPWDDiscount();
      discountedAmount = Money.min(seniorDiscount, pwdDiscount);
    } else if (isSenior) {
      discountedAmount = amount.applySeniorDiscount();
    } else if (isPWD) {
      discountedAmount = amount.applyPWDDiscount();
    }

    // Apply additional group discount on remaining amount
    if (groupDiscount > 0) {
      const additionalDiscount = discountedAmount.percentage(groupDiscount);
      discountedAmount = discountedAmount.subtract(additionalDiscount);
    }

    return discountedAmount;
  }
}
```

### Commission and Fee Calculations

```typescript
// OTA Commission calculations
const bookingAmount = new Money(10000);
const commission = MoneyUtils.calculateCommission(bookingAmount, 15); // 15%
const netAmount = MoneyUtils.calculateNetAmount(bookingAmount, 15);

// Withholding tax
const withholdingTax = bookingAmount.calculateWithholdingTax(); // 5%

// Package deals
const packageComponents = [
  new Money(5000), // Room
  new Money(1500), // Meals
  new Money(800), // Activities
];
const packageTotal = MoneyUtils.applyPackageDiscount(packageComponents, 10);

// Split billing
const totalBill = new Money(12000);
const splitAmounts = MoneyUtils.splitBill(totalBill, 4); // 4 guests
// Returns [Money(3000), Money(3000), Money(3000), Money(3000)]
```

### Multi-Currency Support

```typescript
import { Money } from '@/lib/money';

// Currency conversion using Money class
class CurrencyConverter {
  static convert(
    amount: Money,
    fromCurrency: string,
    toCurrency: string,
    rate: number
  ): Money {
    // Money class handles precise decimal operations
    return amount.multiply(rate);
  }

  // Exchange rate with Money amounts
  interface ExchangeRate {
    fromCurrency: string;
    toCurrency: string;
    rate: Money;         // Use Money for exchange rates too
    effectiveDate: Date;
  }

  // Example: Convert USD to PHP
  static convertUSDToPHP(usdAmount: Money): Money {
    const exchangeRate = new Money(56.75); // Example rate
    return usdAmount.multiply(exchangeRate);
  }

  // Reverse conversion with proper precision
  static convertPHPToUSD(phpAmount: Money): Money {
    const exchangeRate = new Money(56.75);
    return phpAmount.divide(exchangeRate);
  }
}
```

## Test Data Factories

Test factories should generate Money instances, not numbers or strings.

```typescript
import { Money, MoneyUtils } from "@/lib/money";
import { faker } from "@faker-js/faker";

export function createBooking(overrides?: Partial<Booking>): Booking {
  const nights = faker.number.int({ min: 1, max: 7 });
  const adults = faker.number.int({ min: 1, max: 4 });
  const children = faker.number.int({ min: 0, max: 2 });
  const baseRate = new Money(3000); // PHP 3000 per night

  // Use Money class for all calculations
  const roomTotal = MoneyUtils.calculateRoomRate(
    baseRate,
    nights,
    adults,
    children
  );
  const withService = roomTotal.addServiceCharge();
  const totalAmount = withService.addVAT();
  const vatAmount = totalAmount.getVATAmount();
  const serviceCharge = roomTotal.percentage(10);

  return {
    id: faker.string.uuid(),
    guestName: faker.person.fullName(),
    totalAmount, // Money instance
    paidAmount: new Money(0), // Money instance
    balanceAmount: totalAmount, // Money instance
    vatAmount, // Money instance
    serviceCharge, // Money instance
    checkIn: faker.date.future(),
    checkOut: faker.date.future(),
    ...overrides,
  };
}

export function createPayment(overrides?: Partial<Payment>): Payment {
  // Generate realistic payment amounts
  const baseAmount = faker.number.float({
    min: 1000,
    max: 50000,
    fractionDigits: 2,
  });
  const amount = new Money(baseAmount);

  // Calculate processing fees using Money methods
  const processingFee = amount.percentage(2.5);
  const netAmount = amount.subtract(processingFee);

  return {
    id: faker.string.uuid(),
    amount, // Money instance
    processingFee, // Money instance
    netAmount, // Money instance
    paymentMethod: faker.helpers.arrayElement([
      "cash",
      "card",
      "bank_transfer",
    ]),
    paymentDate: faker.date.recent(),
    ...overrides,
  };
}

export function createExpense(overrides?: Partial<Expense>): Expense {
  const baseAmount = faker.number.float({
    min: 500,
    max: 25000,
    fractionDigits: 2,
  });
  const amount = new Money(baseAmount);

  // Calculate VAT using Money methods
  const preVATAmount = amount.removeVAT();
  const vatAmount = amount.getVATAmount();

  return {
    id: faker.string.uuid(),
    description: faker.commerce.productDescription(),
    amount, // Money instance (VAT-inclusive)
    vatAmount, // Money instance
    netAmount: preVATAmount, // Money instance (VAT-exclusive)
    category: faker.helpers.arrayElement([
      "utilities",
      "maintenance",
      "supplies",
      "marketing",
    ]),
    expenseDate: faker.date.recent(),
    ...overrides,
  };
}

// Factory for creating booking with realistic payment history
export function createBookingWithPayments(
  bookingOverrides?: Partial<Booking>,
  paymentCount: number = 2
): { booking: Booking; payments: Payment[] } {
  const booking = createBooking(bookingOverrides);

  // Create partial payments that add up to less than total
  const payments: Payment[] = [];
  const paymentPercentages = [0.3, 0.4, 0.3]; // 30%, 40%, 30%
  let totalPaid = new Money(0);

  for (let i = 0; i < Math.min(paymentCount, paymentPercentages.length); i++) {
    const paymentAmount = booking.totalAmount.percentage(
      paymentPercentages[i] * 100
    );
    totalPaid = totalPaid.add(paymentAmount);

    payments.push(
      createPayment({
        amount: paymentAmount,
        bookingId: booking.id,
      })
    );
  }

  // Update booking with payments
  const updatedBooking = {
    ...booking,
    paidAmount: totalPaid,
    balanceAmount: booking.totalAmount.subtract(totalPaid),
  };

  return { booking: updatedBooking, payments };
}

// Seasonal rate factory
export function createSeasonalBooking(
  season: "peak" | "regular" | "low",
  overrides?: Partial<Booking>
): Booking {
  const baseRate = new Money(3000);
  const seasonMultipliers = {
    peak: 1.5,
    regular: 1.0,
    low: 0.75,
  };

  const seasonalRate = MoneyUtils.applySeasonalRate(
    baseRate,
    seasonMultipliers[season]
  );

  return createBooking({
    ...overrides,
    // Recalculate totals with seasonal rate
    totalAmount: seasonalRate.multiply(2).addServiceCharge().addVAT(),
  });
}
```

## Common Anti-Patterns to Avoid

### ❌ WRONG: Using Plain Numbers

```typescript
// NEVER DO THIS - Plain numbers cause floating-point errors
interface Booking {
  totalAmount: number; // 5000.50 - WRONG! Floating-point issues
  paidAmount: number; // 3000.30 - WRONG!
}

// NEVER DO THIS - Direct number arithmetic
function calculateTotal(nights: number, rate: number): number {
  return nights * rate * 1.12; // Floating-point errors - WRONG!
}

// Example of floating-point error:
const result = 0.1 + 0.2; // 0.30000000000000004 - WRONG!
```

### ❌ WRONG: Storing as Strings

```typescript
// NEVER DO THIS - Strings in domain layer
interface Booking {
  totalAmount: string; // "5000.00" - WRONG!
  paidAmount: string; // "3000.00" - WRONG!
}

// NEVER DO THIS - String arithmetic
function calculateTotal(nights: number, rate: string): string {
  return (nights * parseFloat(rate)).toFixed(2); // Returns string - WRONG!
}
```

### ❌ WRONG: Mixed Types

```typescript
// NEVER DO THIS - Inconsistent types
interface Payment {
  amount: Money; // Money instance
  processingFee: number; // Plain number - WRONG!
  netAmount: string; // String - WRONG!
}
```

### ❌ WRONG: Converting to Numbers in Business Logic

```typescript
// NEVER DO THIS - Converting Money to numbers for calculations
function calculateBalance(booking: Booking): number {
  return booking.totalAmount.toNumber() - booking.paidAmount.toNumber();
  // Should return Money instance - WRONG!
}

// NEVER DO THIS - Manual decimal arithmetic
function addVAT(amount: Money): Money {
  const number = amount.toNumber();
  const withVAT = number * 1.12;
  return new Money(Math.round(withVAT * 100) / 100);
  // Use amount.addVAT() instead - WRONG!
}
```

### ❌ WRONG: Ignoring Money Class Methods

```typescript
// NEVER DO THIS - Reinventing Money class functionality
function formatCurrency(amount: Money): string {
  const number = amount.toNumber();
  return `₱${number.toLocaleString("en-PH")}`;
  // Use amount.format() instead - WRONG!
}

// NEVER DO THIS - Manual percentage calculations
function calculateDiscount(amount: Money, percent: number): Money {
  const discountAmount = amount.toNumber() * (percent / 100);
  return new Money(discountAmount);
  // Use amount.percentage(percent) instead - WRONG!
}
```

## Migration Guide

For existing code using plain numbers or strings for monetary values:

### 1. Update TypeScript Interfaces

```typescript
// Before (WRONG)
interface Booking {
  totalAmount: number;
  paidAmount: number;
}

// After (CORRECT)
interface Booking {
  totalAmount: Money;
  paidAmount: Money;
}
```

### 2. Update Zod Schemas

```typescript
// Before (WRONG)
export const BookingSchema = z.object({
  totalAmount: z.number().nonnegative(),
});

// After (CORRECT)
export const BookingSchema = z.object({
  totalAmount: z.union([
    z.number().transform((val) => new Money(val)),
    z.string().transform((val) => Money.parse(val)),
    z.instanceof(Money),
  ]),
});
```

### 3. Update Business Logic

```typescript
// Before (WRONG - floating-point errors)
function calculateTotal(baseAmount: number, taxRate: number): number {
  return baseAmount * (1 + taxRate);
}

// After (CORRECT - precise calculations)
function calculateTotal(baseAmount: Money, taxRate: number): Money {
  return baseAmount.multiply(1 + taxRate);
  // Or use built-in method: baseAmount.addVAT()
}
```

### 4. Update Database Interactions

```typescript
// Before (WRONG)
class BookingRepository {
  async save(booking: { totalAmount: number }) {
    await db.query("INSERT INTO bookings (total_amount) VALUES ($1)", [
      booking.totalAmount,
    ]);
  }
}

// After (CORRECT)
class BookingRepository {
  async save(booking: { totalAmount: Money }) {
    await db.query("INSERT INTO bookings (total_amount) VALUES ($1)", [
      booking.totalAmount.toNumber(),
    ]);
  }

  async findById(id: string): Promise<Booking> {
    const row = await db.query("SELECT * FROM bookings WHERE id = $1", [id]);
    return {
      ...row,
      totalAmount: new Money(row.total_amount),
    };
  }
}
```

### 5. Update Test Factories

```typescript
// Before (WRONG)
export function createBooking(): Booking {
  return {
    totalAmount: 5000,
    paidAmount: 0,
  };
}

// After (CORRECT)
export function createBooking(): Booking {
  return {
    totalAmount: new Money(5000),
    paidAmount: new Money(0),
  };
}
```

### 6. Update UI Components

```typescript
// Before (WRONG - manual formatting)
function BookingCard({ booking }: { booking: Booking }) {
  return <div>Total: ₱{booking.totalAmount.toFixed(2)}</div>;
}

// After (CORRECT - use Money formatting)
function BookingCard({ booking }: { booking: Booking }) {
  return <div>Total: {booking.totalAmount.format()}</div>;
}
```

## Testing Guidelines

```typescript
import { Money } from "@/lib/money";

describe("Monetary Calculations", () => {
  it("should handle amounts as Money instances", () => {
    const booking = {
      totalAmount: new Money(5000),
      paidAmount: new Money(3000),
      balanceAmount: new Money(2000),
    };

    expect(booking.totalAmount).toBeInstanceOf(Money);
    expect(
      booking.balanceAmount.equals(
        booking.totalAmount.subtract(booking.paidAmount)
      )
    ).toBe(true);
  });

  it("should prevent floating-point errors", () => {
    const amount1 = new Money(0.1);
    const amount2 = new Money(0.2);
    const sum = amount1.add(amount2);

    // Money class gives exact result
    expect(sum.equals(new Money(0.3))).toBe(true);

    // Compare with floating-point error
    const floatingSum = 0.1 + 0.2;
    expect(floatingSum).not.toBe(0.3); // Demonstrates the problem
    expect(sum.toNumber()).toBe(0.3); // Money class solves it
  });

  it("should format for display", () => {
    const amount = new Money(5000);
    const formatted = amount.format();

    expect(formatted).toBe("₱5,000.00");
    expect(typeof formatted).toBe("string");
  });

  it("should handle Philippine business rules", () => {
    const roomRate = new Money(5000);

    // Balance calculation
    const withVAT = roomRate.addVAT();
    expect(withVAT.equals(new Money(5600))).toBe(true);

    // Senior discount
    const seniorRate = roomRate.applySeniorDiscount();
    expect(seniorRate.equals(new Money(4000))).toBe(true);

    // Service charge
    const withService = roomRate.addServiceCharge();
    expect(withService.equals(new Money(5500))).toBe(true);
  });

  it("should parse various input formats", () => {
    expect(Money.parse("5000").equals(new Money(5000))).toBe(true);
    expect(Money.parse("₱5,000.00").equals(new Money(5000))).toBe(true);
    expect(Money.parse("5000.50").equals(new Money(5000.5))).toBe(true);
    expect(Money.parse("  ₱ 1,234.56  ").equals(new Money(1234.56))).toBe(true);
  });

  it("should validate input formats", () => {
    expect(Money.isValid("5000")).toBe(true);
    expect(Money.isValid("₱5,000.00")).toBe(true);
    expect(Money.isValid("invalid")).toBe(false);
    expect(Money.isValid("₱₱5000")).toBe(false);
  });

  it("should handle Money operations in test factories", () => {
    const booking = createBooking();

    expect(booking.totalAmount).toBeInstanceOf(Money);
    expect(booking.paidAmount).toBeInstanceOf(Money);
    expect(booking.balanceAmount).toBeInstanceOf(Money);

    // Test realistic calculations
    expect(
      booking.balanceAmount.equals(
        booking.totalAmount.subtract(booking.paidAmount)
      )
    ).toBe(true);
  });
});

// Custom Jest matchers for Money
declare global {
  namespace jest {
    interface Matchers<R> {
      toEqualMoney(expected: Money): R;
      toBePositiveMoney(): R;
      toBeNegativeMoney(): R;
      toBeZeroMoney(): R;
    }
  }
}

// Implement custom matchers
expect.extend({
  toEqualMoney(received: Money, expected: Money) {
    const pass = received.equals(expected);
    return {
      message: () =>
        `expected ${received.format()} ${pass ? "not " : ""}to equal ${expected.format()}`,
      pass,
    };
  },

  toBePositiveMoney(received: Money) {
    const pass = received.isPositive();
    return {
      message: () =>
        `expected ${received.format()} ${pass ? "not " : ""}to be positive`,
      pass,
    };
  },
});

// Usage of custom matchers
describe("Money Custom Matchers", () => {
  it("should use custom matchers", () => {
    const amount = new Money(5000);
    const sameAmount = new Money(5000);

    expect(amount).toEqualMoney(sameAmount);
    expect(amount).toBePositiveMoney();
    expect(new Money(0)).toBeZeroMoney();
  });
});
```

## Compliance Checklist

- [ ] All domain models use `Money` class for monetary fields
- [ ] All Zod schemas transform inputs to `Money` instances
- [ ] Database layer converts between DECIMAL and Money at boundaries
- [ ] API layer accepts multiple formats but works with Money internally
- [ ] UI layer uses Money formatting methods, never .toNumber()
- [ ] Test factories generate Money instances, not numbers or strings
- [ ] No plain number or string arithmetic in business logic
- [ ] All calculations use Money class methods (add, subtract, multiply, etc.)
- [ ] Philippine business rules use built-in Money methods (VAT, discounts)
- [ ] Input parsing uses Money.parse() for string inputs
- [ ] Currency formatting uses Money.format() methods
- [ ] Import/export systems use Money.parse() and Money formatting
- [ ] Custom Jest matchers implemented for Money testing
- [ ] No floating-point arithmetic in monetary calculations

## Why Money Class is Superior

### Prevents Floating-Point Errors

```typescript
// Plain numbers (WRONG)
const result = 0.1 + 0.2; // 0.30000000000000004

// Money class (CORRECT)
const result = new Money(0.1).add(new Money(0.2)); // exactly 0.30
```

### Built-in Philippine Business Rules

```typescript
// Manual calculations (WRONG - error-prone)
const withVAT = amount * 1.12;
const seniorDiscount = (amount / 1.12) * 0.8; // Complex senior discount logic

// Money class (CORRECT - tested business rules)
const withVAT = amount.addVAT();
const seniorDiscount = amount.applySeniorDiscount();
```

### Type Safety and Immutability

```typescript
// Plain numbers (WRONG - mutable, error-prone)
let total = 5000;
total += 600; // Did we add VAT? Service charge? Unknown intent

// Money class (CORRECT - immutable, intent-clear)
const baseAmount = new Money(5000);
const totalWithVAT = baseAmount.addVAT(); // Clear intent
const totalWithService = baseAmount.addServiceCharge(); // Chainable, clear
```

### Consistent Formatting

```typescript
// Manual formatting (WRONG - inconsistent)
const formatted = `₱${amount.toFixed(2)}`;

// Money class (CORRECT - consistent, locale-aware)
const formatted = amount.format();
```

## Summary

This standard ensures:

1. **Mathematical Accuracy**: Decimal.js precision eliminates floating-point
   errors
2. **Type Safety**: Money class prevents accidental number/string mixing
3. **Business Rule Compliance**: Built-in Philippine VAT, discount, and tax
   calculations
4. **Maintainability**: Clear, self-documenting monetary operations
5. **Performance**: Optimized decimal operations with minimal overhead
6. **Developer Experience**: Immutable operations with method chaining
7. **Testing**: Comprehensive test utilities and custom Jest matchers

**IMPORTANT**: The Money class (`src/lib/money.ts`) is the ONLY approved way to
handle monetary values in the Okaeri Resort Management System. Plain numbers and
strings for monetary values are strictly prohibited.

All team members and AI agents working on the Okaeri Resort System must follow
this standard without exception.
