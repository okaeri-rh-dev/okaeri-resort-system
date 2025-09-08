/**
 * Money Utility for Philippine Peso
 * Handles all monetary calculations with precision using decimal.js
 * Prevents floating-point errors in financial calculations
 */

import Decimal from "decimal.js";

// Configure Decimal for financial calculations
// 10 significant digits, round half up (banking rounding)
Decimal.set({
  precision: 10,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -9,
  toExpPos: 9,
});

/**
 * Philippine tax and discount rates
 */
export const RATES = {
  VAT: 0.12, // 12% VAT
  SENIOR_DISCOUNT: 0.2, // 20% Senior Citizen discount
  PWD_DISCOUNT: 0.2, // 20% PWD discount
  SERVICE_CHARGE: 0.1, // 10% service charge (common in resorts)
  WITHHOLDING_TAX: 0.05, // 5% withholding tax for rentals
} as const;

/**
 * Currency configuration
 */
export const CURRENCY = {
  code: "PHP",
  symbol: "₱",
  locale: "en-PH",
  decimalPlaces: 2,
} as const;

/**
 * Money class for handling monetary values
 */
export class Money {
  private value: Decimal;

  constructor(amount: number | string | Decimal) {
    this.value = new Decimal(amount);
  }

  /**
   * Create Money from cents/centavos
   */
  static fromCents(cents: number): Money {
    return new Money(new Decimal(cents).div(100));
  }

  /**
   * Get the raw Decimal value
   */
  getDecimal(): Decimal {
    return this.value;
  }

  /**
   * Get the numeric value
   */
  toNumber(): number {
    return this.value.toNumber();
  }

  /**
   * Get value in cents/centavos
   */
  toCents(): number {
    return this.value.mul(100).toNumber();
  }

  /**
   * Format as currency string
   */
  format(options?: Intl.NumberFormatOptions): string {
    const formatter = new Intl.NumberFormat(CURRENCY.locale, {
      style: "currency",
      currency: CURRENCY.code,
      minimumFractionDigits: CURRENCY.decimalPlaces,
      maximumFractionDigits: CURRENCY.decimalPlaces,
      ...options,
    });
    return formatter.format(this.toNumber());
  }

  /**
   * Format with custom symbol
   */
  formatWithSymbol(): string {
    return `${CURRENCY.symbol}${this.value.toFixed(CURRENCY.decimalPlaces)}`;
  }

  /**
   * Add another money amount
   */
  add(other: Money | number | string): Money {
    const otherValue = other instanceof Money ? other.value : new Decimal(other);
    return new Money(this.value.add(otherValue));
  }

  /**
   * Subtract another money amount
   */
  subtract(other: Money | number | string): Money {
    const otherValue = other instanceof Money ? other.value : new Decimal(other);
    return new Money(this.value.sub(otherValue));
  }

  /**
   * Multiply by a factor
   */
  multiply(factor: number | string | Decimal): Money {
    return new Money(this.value.mul(factor));
  }

  /**
   * Divide by a factor
   */
  divide(factor: number | string | Decimal | Money): Money {
    const divisor = factor instanceof Money ? factor.value : factor;
    return new Money(this.value.div(divisor));
  }

  /**
   * Calculate percentage
   */
  percentage(percent: number): Money {
    return new Money(this.value.mul(percent).div(100));
  }

  /**
   * Apply VAT (12%)
   */
  addVAT(): Money {
    return new Money(this.value.mul(1 + RATES.VAT));
  }

  /**
   * Remove VAT (get pre-VAT amount from VAT-inclusive amount)
   */
  removeVAT(): Money {
    return new Money(this.value.div(1 + RATES.VAT));
  }

  /**
   * Calculate VAT amount only
   */
  getVATAmount(): Money {
    const preVAT = this.removeVAT();
    return this.subtract(preVAT);
  }

  /**
   * Apply Senior Citizen discount (20% discount on VAT-exclusive amount)
   * Note: In the Philippines, senior discount is applied before VAT and VAT-exempt
   */
  applySeniorDiscount(): Money {
    const preVAT = this.removeVAT();
    return new Money(preVAT.value.mul(1 - RATES.SENIOR_DISCOUNT));
  }

  /**
   * Apply PWD discount (20% discount on VAT-exclusive amount)
   * Note: In the Philippines, PWD discount is applied before VAT and VAT-exempt
   */
  applyPWDDiscount(): Money {
    const preVAT = this.removeVAT();
    return new Money(preVAT.value.mul(1 - RATES.PWD_DISCOUNT));
  }

  /**
   * Apply service charge (10%)
   */
  addServiceCharge(): Money {
    return new Money(this.value.mul(1 + RATES.SERVICE_CHARGE));
  }

  /**
   * Calculate withholding tax
   */
  calculateWithholdingTax(): Money {
    return new Money(this.value.mul(RATES.WITHHOLDING_TAX));
  }

  /**
   * Round to nearest peso
   */
  roundToPeso(): Money {
    return new Money(this.value.round());
  }

  /**
   * Round to nearest 5 pesos (common practice in Philippines)
   */
  roundToNearest5(): Money {
    const rounded = this.value.div(5).round().mul(5);
    return new Money(rounded);
  }

  /**
   * Check if amount is zero
   */
  isZero(): boolean {
    return this.value.isZero();
  }

  /**
   * Check if amount is positive
   */
  isPositive(): boolean {
    return this.value.isPositive();
  }

  /**
   * Check if amount is negative
   */
  isNegative(): boolean {
    return this.value.isNegative();
  }

  /**
   * Compare with another money amount
   */
  equals(other: Money | number | string): boolean {
    const otherValue = other instanceof Money ? other.value : new Decimal(other);
    return this.value.equals(otherValue);
  }

  /**
   * Check if greater than another amount
   */
  greaterThan(other: Money | number | string): boolean {
    const otherValue = other instanceof Money ? other.value : new Decimal(other);
    return this.value.greaterThan(otherValue);
  }

  /**
   * Check if less than another amount
   */
  lessThan(other: Money | number | string): boolean {
    const otherValue = other instanceof Money ? other.value : new Decimal(other);
    return this.value.lessThan(otherValue);
  }

  /**
   * Get absolute value
   */
  abs(): Money {
    return new Money(this.value.abs());
  }

  /**
   * Get minimum of two amounts
   */
  static min(a: Money, b: Money): Money {
    return a.lessThan(b) ? a : b;
  }

  /**
   * Get maximum of two amounts
   */
  static max(a: Money, b: Money): Money {
    return a.greaterThan(b) ? a : b;
  }

  /**
   * Sum an array of money amounts
   */
  static sum(amounts: Money[]): Money {
    const total = amounts.reduce((sum, amount) => sum.add(amount.value), new Decimal(0));
    return new Money(total);
  }

  /**
   * Calculate average of money amounts
   */
  static average(amounts: Money[]): Money {
    if (amounts.length === 0) return new Money(0);
    return Money.sum(amounts).divide(amounts.length);
  }

  /**
   * Parse string amount (handles currency symbols)
   */
  static parse(value: string): Money {
    if (typeof value !== "string") {
      throw new Error(`Invalid input: expected string, got ${typeof value}`);
    }

    // Remove currency symbols and whitespace
    const cleaned = value
      .trim()
      .replace(/[₱$,\s]/g, "")
      .replace(/^-/, "NEG") // Temporarily replace negative sign
      .replace(/[^\d.-]/g, "") // Remove non-numeric except decimal and negative
      .replace("NEG", "-"); // Restore negative sign

    if (!cleaned || cleaned === "-") {
      return new Money(0);
    }

    // Validate decimal format
    const decimalCount = (cleaned.match(/\./g) || []).length;
    if (decimalCount > 1) {
      throw new Error(`Invalid decimal format: ${value}`);
    }

    try {
      return new Money(cleaned);
    } catch (error: any) {
      throw new Error(`Failed to parse money value "${value}": ${error.message}`);
    }
  }

  /**
   * Validate if string is a valid money amount
   */
  static isValid(value: string): boolean {
    try {
      Money.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert to JSON (for serialization)
   */
  toJSON(): number {
    return this.toNumber();
  }

  /**
   * String representation
   */
  toString(): string {
    return this.value.toFixed(CURRENCY.decimalPlaces);
  }
}

/**
 * Utility functions for common calculations
 */
export const MoneyUtils = {
  /**
   * Calculate room rate with occupancy
   */
  calculateRoomRate(
    baseRate: Money,
    nights: number,
    adults: number,
    children: number = 0,
    extraPersonCharge: Money = new Money(500)
  ): Money {
    const baseOccupancy = 2; // Typical base occupancy for rooms
    const extraPersons = Math.max(0, adults + children - baseOccupancy);
    const roomCharge = baseRate.multiply(nights);
    const extraCharge = extraPersonCharge.multiply(extraPersons).multiply(nights);
    return roomCharge.add(extraCharge);
  },

  /**
   * Calculate commission (for OTA bookings)
   */
  calculateCommission(amount: Money, commissionRate: number): Money {
    return amount.percentage(commissionRate);
  },

  /**
   * Calculate net amount after commission
   */
  calculateNetAmount(grossAmount: Money, commissionRate: number): Money {
    const commission = MoneyUtils.calculateCommission(grossAmount, commissionRate);
    return grossAmount.subtract(commission);
  },

  /**
   * Format amount range
   */
  formatRange(min: Money, max: Money): string {
    return `${min.format()} - ${max.format()}`;
  },

  /**
   * Calculate seasonal rate adjustment
   */
  applySeasonalRate(baseRate: Money, seasonMultiplier: number): Money {
    return baseRate.multiply(seasonMultiplier);
  },

  /**
   * Calculate package deal discount
   */
  applyPackageDiscount(components: Money[], discountPercent: number): Money {
    const total = Money.sum(components);
    const discount = total.percentage(discountPercent);
    return total.subtract(discount);
  },

  /**
   * Split bill among guests
   */
  splitBill(total: Money, numberOfGuests: number): Money[] {
    const perPerson = total.divide(numberOfGuests);
    const remainder = total.subtract(perPerson.multiply(numberOfGuests));

    const splits: Money[] = [];
    for (let i = 0; i < numberOfGuests; i++) {
      if (i === 0 && !remainder.isZero()) {
        // Add remainder to first person
        splits.push(perPerson.add(remainder));
      } else {
        splits.push(perPerson);
      }
    }

    return splits;
  },

  /**
   * Calculate deposit amount (typically 50% for Philippine resorts)
   */
  calculateDeposit(total: Money, depositPercent: number = 50): Money {
    return total.percentage(depositPercent).roundToPeso();
  },
};

// Export convenience functions
export function money(amount: number | string | Decimal): Money {
  return new Money(amount);
}

export function formatPHP(amount: number | string | Decimal): string {
  return new Money(amount).format();
}

export default Money;
