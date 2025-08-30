# Phase 4.2: Test Income Management (RED Phase)

## Overview

This document defines comprehensive test specifications for income management,
focusing on Philippine resort revenue streams, payment processing, and
multi-currency support. All tests must fail initially as no implementation
exists yet.

## Agent Responsibility

**Financial Systems Architect**: Design and validate all income-related test
cases ensuring accurate revenue tracking, payment processing, and Philippine tax
compliance.

## Test Categories

### 1. Income Recording and Categorization

#### Test Suite: IncomeManagement

```typescript
describe("IncomeManagement", () => {
  describe("Income Creation", () => {
    it("should record income from room bookings", async () => {
      const booking = {
        bookingId: "BK-2025-001",
        checkInDate: new Date("2025-02-01"),
        checkOutDate: new Date("2025-02-03"),
        roomType: "Deluxe",
        numberOfNights: 2,
        roomRate: 3500.0,
        totalAmount: 7000.0,
        guestName: "John Smith",
        guestCount: 2,
        source: "DIRECT",
        paymentStatus: "FULLY_PAID",
        vatAmount: 750.0,
        netAmount: 6250.0,
      };

      const income = await incomeService.recordBooking(booking);

      expect(income.id).toBeDefined();
      expect(income.category).toBe("ACCOMMODATION");
      expect(income.amount).toBe(7000.0);
      expect(income.vatAmount).toBe(750.0);
      expect(income.revenueDate).toEqual(new Date("2025-02-01"));
    });

    it("should handle Airbnb bookings with service fees", async () => {
      const airbnbBooking = {
        platform: "AIRBNB",
        grossAmount: 8000.0,
        serviceFee: 240.0, // 3% Airbnb fee
        netPayout: 7760.0,
        payoutDate: new Date("2025-02-05"),
        confirmationCode: "HMXYZABC123",
      };

      const income = await incomeService.recordPlatformBooking(airbnbBooking);

      expect(income.grossRevenue).toBe(8000.0);
      expect(income.platformFees).toBe(240.0);
      expect(income.netRevenue).toBe(7760.0);
      expect(income.revenueRecognition).toBe("CHECK_IN_DATE");
    });

    it("should categorize all resort income streams", async () => {
      const incomeCategories = await incomeService.getCategories();

      expect(incomeCategories).toEqual(
        expect.arrayContaining([
          { code: "ACCOMMODATION", name: "Room Revenue", taxable: true },
          { code: "F&B", name: "Food & Beverage", taxable: true },
          { code: "ACTIVITIES", name: "Tours & Activities", taxable: true },
          { code: "RENTALS", name: "Equipment Rentals", taxable: true },
          { code: "SPA", name: "Spa Services", taxable: true },
          { code: "VENUE", name: "Event Venue", taxable: true },
          { code: "TRANSPORT", name: "Airport Transfers", taxable: true },
          { code: "LAUNDRY", name: "Laundry Services", taxable: true },
          { code: "MINIBAR", name: "Minibar Sales", taxable: true },
          { code: "OTHER", name: "Other Income", taxable: true },
        ])
      );
    });

    it("should track service charges separately", async () => {
      const fnbSale = {
        category: "F&B",
        items: [{ description: "Dinner for 2", amount: 2500.0 }],
        serviceCharge: 250.0, // 10% service charge
        vat: 300.0,
        totalAmount: 3050.0,
      };

      const income = await incomeService.recordSale(fnbSale);

      expect(income.baseAmount).toBe(2500.0);
      expect(income.serviceCharge).toBe(250.0);
      expect(income.vatAmount).toBe(300.0);
      expect(income.totalAmount).toBe(3050.0);
    });
  });

  describe("Package Deals and Bundles", () => {
    it("should allocate package revenue to categories", async () => {
      const package = {
        name: "Weekend Getaway Package",
        totalPrice: 15000.0,
        components: [
          { category: "ACCOMMODATION", allocation: 0.6 }, // 9000
          { category: "F&B", allocation: 0.25 }, // 3750
          { category: "ACTIVITIES", allocation: 0.15 }, // 2250
        ],
      };

      const allocations = await incomeService.allocatePackage(package);

      expect(allocations).toEqual([
        { category: "ACCOMMODATION", amount: 9000.0, vatAmount: 964.29 },
        { category: "F&B", amount: 3750.0, vatAmount: 401.79 },
        { category: "ACTIVITIES", amount: 2250.0, vatAmount: 241.07 },
      ]);
    });

    it("should handle all-inclusive rates", async () => {
      const allInclusive = {
        guestCount: 4,
        nights: 3,
        ratePerPersonPerNight: 3500.0,
        totalAmount: 42000.0,
        inclusions: ["Accommodation", "All Meals", "Selected Activities"],
      };

      const booking = await incomeService.recordAllInclusive(allInclusive);

      expect(booking.revenueType).toBe("ALL_INCLUSIVE");
      expect(booking.totalAmount).toBe(42000.0);
      expect(booking.recognitionMethod).toBe("DAILY_ACCRUAL");
      expect(booking.dailyRevenue).toBe(14000.0);
    });
  });

  describe("Seasonal Pricing", () => {
    it("should apply peak season rates", async () => {
      const peakBooking = {
        checkInDate: new Date("2025-12-24"), // Christmas peak
        roomType: "Deluxe",
        nights: 3,
        seasonType: "PEAK",
      };

      const pricing = await incomeService.calculatePricing(peakBooking);

      expect(pricing.baseRate).toBe(3500.0);
      expect(pricing.seasonalMultiplier).toBe(1.5); // 50% peak surcharge
      expect(pricing.adjustedRate).toBe(5250.0);
      expect(pricing.totalAmount).toBe(15750.0);
    });

    it("should apply off-peak discounts", async () => {
      const offPeakBooking = {
        checkInDate: new Date("2025-09-15"), // Off-peak
        roomType: "Deluxe",
        nights: 2,
        seasonType: "OFF_PEAK",
      };

      const pricing = await incomeService.calculatePricing(offPeakBooking);

      expect(pricing.baseRate).toBe(3500.0);
      expect(pricing.seasonalMultiplier).toBe(0.8); // 20% off-peak discount
      expect(pricing.adjustedRate).toBe(2800.0);
      expect(pricing.totalAmount).toBe(5600.0);
    });
  });
});
```

### 2. Payment Processing

#### Test Suite: PaymentProcessing

```typescript
describe("PaymentProcessing", () => {
  describe("Payment Methods", () => {
    it("should process cash payments", async () => {
      const cashPayment = {
        bookingId: "BK-2025-001",
        amount: 7000.0,
        currency: "PHP",
        method: "CASH",
        receivedBy: "Front Desk Staff",
        receiptNumber: "OR-2025-0001",
      };

      const payment = await paymentService.processCash(cashPayment);

      expect(payment.status).toBe("COMPLETED");
      expect(payment.receiptGenerated).toBe(true);
      expect(payment.cashDrawerUpdated).toBe(true);
    });

    it("should process GCash payments", async () => {
      const gcashPayment = {
        bookingId: "BK-2025-002",
        amount: 5000.0,
        gcashRefNumber: "GC123456789",
        senderNumber: "09171234567",
        senderName: "Juan Dela Cruz",
      };

      const payment = await paymentService.processGCash(gcashPayment);

      expect(payment.status).toBe("PENDING_VERIFICATION");
      expect(payment.verificationMethod).toBe("MANUAL");
      expect(payment.expectedClearance).toBe("INSTANT");
    });

    it("should process bank transfers", async () => {
      const bankTransfer = {
        bookingId: "BK-2025-003",
        amount: 15000.0,
        bankName: "BDO",
        accountNumber: "*****6789",
        referenceNumber: "BTR202501150001",
        depositSlip: "deposit-slip.jpg",
      };

      const payment = await paymentService.processBankTransfer(bankTransfer);

      expect(payment.status).toBe("PENDING_VERIFICATION");
      expect(payment.verificationRequired).toBe(true);
      expect(payment.clearanceDays).toBe(1);
    });

    it("should process credit card payments", async () => {
      const cardPayment = {
        bookingId: "BK-2025-004",
        amount: 10000.0,
        cardType: "VISA",
        lastFourDigits: "1234",
        authorizationCode: "AUTH123456",
        processorFee: 250.0, // 2.5% MDR
      };

      const payment = await paymentService.processCreditCard(cardPayment);

      expect(payment.grossAmount).toBe(10000.0);
      expect(payment.processorFee).toBe(250.0);
      expect(payment.netAmount).toBe(9750.0);
      expect(payment.settlementDays).toBe(3);
    });

    it("should handle PayMaya payments", async () => {
      const paymayaPayment = {
        bookingId: "BK-2025-005",
        amount: 8000.0,
        paymentId: "PM_123456789",
        status: "SUCCESS",
      };

      const payment = await paymentService.processPayMaya(paymayaPayment);

      expect(payment.status).toBe("COMPLETED");
      expect(payment.instantSettlement).toBe(false);
      expect(payment.settlementDays).toBe(2);
    });
  });

  describe("Deposit and Balance Handling", () => {
    it("should handle partial deposits", async () => {
      const deposit = {
        bookingId: "BK-2025-006",
        totalAmount: 20000.0,
        depositAmount: 5000.0,
        depositPercent: 25,
        balanceDue: 15000.0,
        dueDate: new Date("2025-02-01"),
      };

      const booking = await paymentService.recordDeposit(deposit);

      expect(booking.paymentStatus).toBe("PARTIALLY_PAID");
      expect(booking.depositReceived).toBe(5000.0);
      expect(booking.remainingBalance).toBe(15000.0);
      expect(booking.balanceReminder).toBeDefined();
    });

    it("should track payment installments", async () => {
      const installment = {
        bookingId: "BK-2025-007",
        totalAmount: 30000.0,
        installments: [
          { amount: 10000.0, dueDate: new Date("2025-01-15"), status: "PAID" },
          {
            amount: 10000.0,
            dueDate: new Date("2025-02-01"),
            status: "PENDING",
          },
          {
            amount: 10000.0,
            dueDate: new Date("2025-02-15"),
            status: "PENDING",
          },
        ],
      };

      const schedule = await paymentService.createInstallmentPlan(installment);

      expect(schedule.totalInstallments).toBe(3);
      expect(schedule.paidInstallments).toBe(1);
      expect(schedule.nextDueDate).toEqual(new Date("2025-02-01"));
      expect(schedule.remainingBalance).toBe(20000.0);
    });

    it("should handle refunds and cancellations", async () => {
      const refund = {
        bookingId: "BK-2025-008",
        originalAmount: 10000.0,
        refundAmount: 8000.0,
        cancellationFee: 2000.0,
        reason: "Guest cancellation",
        refundMethod: "BANK_TRANSFER",
      };

      const result = await paymentService.processRefund(refund);

      expect(result.refundAmount).toBe(8000.0);
      expect(result.retainedAmount).toBe(2000.0);
      expect(result.refundStatus).toBe("PENDING_PROCESSING");
      expect(result.estimatedDays).toBe(5);
    });
  });

  describe("Payment Reconciliation", () => {
    it("should reconcile daily cash drawer", async () => {
      const cashDrawer = {
        date: new Date("2025-01-15"),
        openingBalance: 5000.0,
        cashSales: 25000.0,
        cashPayouts: 2000.0,
        expectedClosing: 28000.0,
        actualCount: 27950.0,
      };

      const reconciliation =
        await paymentService.reconcileCashDrawer(cashDrawer);

      expect(reconciliation.variance).toBe(-50.0);
      expect(reconciliation.status).toBe("SHORT");
      expect(reconciliation.requiresInvestigation).toBe(false); // Within tolerance
    });

    it("should match bank deposits with payments", async () => {
      const bankStatement = {
        date: new Date("2025-01-15"),
        deposits: [
          { amount: 15000.0, reference: "DEP123" },
          { amount: 8000.0, reference: "DEP124" },
        ],
      };

      const matching = await paymentService.matchBankDeposits(bankStatement);

      expect(matching.matched).toHaveLength(2);
      expect(matching.unmatched).toHaveLength(0);
      expect(matching.reconciled).toBe(true);
    });

    it("should verify digital wallet settlements", async () => {
      const gcashSettlement = {
        settlementDate: new Date("2025-01-16"),
        transactions: [
          { refNumber: "GC001", amount: 3000.0 },
          { refNumber: "GC002", amount: 5000.0 },
        ],
        totalSettlement: 7920.0, // After 1% MDR
        mdrFee: 80.0,
      };

      const verification =
        await paymentService.verifyWalletSettlement(gcashSettlement);

      expect(verification.grossAmount).toBe(8000.0);
      expect(verification.netAmount).toBe(7920.0);
      expect(verification.feePercentage).toBe(0.01);
      expect(verification.allMatched).toBe(true);
    });
  });
});
```

### 3. Multi-Currency Support

#### Test Suite: MultiCurrencyManagement

```typescript
describe("MultiCurrencyManagement", () => {
  describe("Currency Conversion", () => {
    it("should convert USD to PHP at current rates", async () => {
      const usdAmount = {
        amount: 100.0,
        currency: "USD",
        conversionDate: new Date("2025-01-15"),
      };

      const conversion = await currencyService.convert(usdAmount, "PHP");

      expect(conversion.originalAmount).toBe(100.0);
      expect(conversion.originalCurrency).toBe("USD");
      expect(conversion.exchangeRate).toBeCloseTo(56.25, 2);
      expect(conversion.convertedAmount).toBeCloseTo(5625.0, 2);
      expect(conversion.targetCurrency).toBe("PHP");
      expect(conversion.rateSource).toBe("BSP"); // Bangko Sentral ng Pilipinas
    });

    it("should handle common tourist currencies", async () => {
      const currencies = await currencyService.getSupportedCurrencies();

      expect(currencies).toEqual(
        expect.arrayContaining([
          { code: "PHP", name: "Philippine Peso", symbol: "₱" },
          { code: "USD", name: "US Dollar", symbol: "$" },
          { code: "EUR", name: "Euro", symbol: "€" },
          { code: "JPY", name: "Japanese Yen", symbol: "¥" },
          { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
          { code: "KRW", name: "Korean Won", symbol: "₩" },
          { code: "AUD", name: "Australian Dollar", symbol: "A$" },
          { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
        ])
      );
    });

    it("should apply forex margin for cash exchanges", async () => {
      const cashExchange = {
        amount: 1000.0,
        fromCurrency: "USD",
        toCurrency: "PHP",
        type: "CASH_EXCHANGE",
      };

      const exchange = await currencyService.exchangeCash(cashExchange);

      expect(exchange.bankRate).toBeCloseTo(56.25, 2);
      expect(exchange.marginPercent).toBe(2); // 2% margin
      expect(exchange.effectiveRate).toBeCloseTo(55.125, 3);
      expect(exchange.phpAmount).toBeCloseTo(55125.0, 2);
    });

    it("should track exchange rate history", async () => {
      const rateHistory = await currencyService.getRateHistory("USD", {
        from: new Date("2025-01-01"),
        to: new Date("2025-01-31"),
      });

      expect(rateHistory).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            date: expect.any(Date),
            currency: "USD",
            buyRate: expect.any(Number),
            sellRate: expect.any(Number),
            midRate: expect.any(Number),
          }),
        ])
      );
    });
  });

  describe("Foreign Currency Accounting", () => {
    it("should record foreign currency transactions", async () => {
      const usdBooking = {
        bookingId: "BK-2025-009",
        amount: 200.0,
        currency: "USD",
        paymentDate: new Date("2025-01-15"),
        exchangeRate: 56.25,
      };

      const transaction = await incomeService.recordForeignCurrency(usdBooking);

      expect(transaction.originalAmount).toBe(200.0);
      expect(transaction.originalCurrency).toBe("USD");
      expect(transaction.phpEquivalent).toBe(11250.0);
      expect(transaction.exchangeRate).toBe(56.25);
      expect(transaction.rateDate).toEqual(new Date("2025-01-15"));
    });

    it("should calculate forex gains/losses", async () => {
      const payment = {
        bookingDate: new Date("2025-01-01"),
        bookingRate: 55.0,
        bookingAmount: 100.0, // USD
        paymentDate: new Date("2025-01-15"),
        paymentRate: 56.25,
      };

      const forexResult = await currencyService.calculateForexGainLoss(payment);

      expect(forexResult.bookingValue).toBe(5500.0); // PHP
      expect(forexResult.paymentValue).toBe(5625.0); // PHP
      expect(forexResult.gainLoss).toBe(125.0); // PHP gain
      expect(forexResult.type).toBe("GAIN");
    });

    it("should generate forex report for tax purposes", async () => {
      const taxYear = 2025;

      const forexReport = await currencyService.generateForexReport(taxYear);

      expect(forexReport).toEqual({
        totalGains: expect.any(Number),
        totalLosses: expect.any(Number),
        netGainLoss: expect.any(Number),
        transactions: expect.any(Array),
        taxImplication: expect.any(String),
      });
    });
  });
});
```

### 4. Senior/PWD Discount Handling

#### Test Suite: DiscountCompliance

```typescript
describe("DiscountCompliance", () => {
  describe("Senior Citizen Discount", () => {
    it("should apply 20% senior discount with VAT exemption", async () => {
      const sale = {
        items: [{ description: "Room Night", amount: 3000.0 }],
        customerType: "SENIOR",
        idNumber: "SC-123456",
        idPresented: true,
      };

      const invoice = await discountService.applySeniorDiscount(sale);

      expect(invoice.originalAmount).toBe(3000.0);
      expect(invoice.discount).toBe(600.0); // 20% of 3000
      expect(invoice.discountedAmount).toBe(2400.0);
      expect(invoice.vatAmount).toBe(0); // VAT exempt
      expect(invoice.totalDue).toBe(2400.0);
      expect(invoice.compliance).toBe("RA 9994"); // Expanded Senior Citizens Act
    });

    it("should limit senior discount to personal use only", async () => {
      const bulkPurchase = {
        items: [{ description: "Room Night", amount: 3000.0, quantity: 5 }],
        customerType: "SENIOR",
      };

      const invoice = await discountService.applySeniorDiscount(bulkPurchase);

      expect(invoice.discountAppliedTo).toBe(1); // Only 1 unit
      expect(invoice.discount).toBe(600.0); // 20% of 3000 (1 unit only)
      expect(invoice.totalDue).toBe(12400.0); // 2400 + (4 × 3000)
    });

    it("should generate senior citizen discount report", async () => {
      const month = "2025-01";

      const report = await discountService.generateSeniorReport(month);

      expect(report).toEqual({
        totalTransactions: expect.any(Number),
        totalDiscounts: expect.any(Number),
        vatExemption: expect.any(Number),
        customers: expect.arrayContaining([
          {
            date: expect.any(Date),
            name: expect.any(String),
            idNumber: expect.any(String),
            discountAmount: expect.any(Number),
            vatExempted: expect.any(Number),
          },
        ]),
      });
    });
  });

  describe("PWD Discount", () => {
    it("should apply 20% PWD discount with VAT exemption", async () => {
      const sale = {
        items: [{ description: "Spa Service", amount: 2000.0 }],
        customerType: "PWD",
        idNumber: "PWD-789012",
        idPresented: true,
      };

      const invoice = await discountService.applyPWDDiscount(sale);

      expect(invoice.originalAmount).toBe(2000.0);
      expect(invoice.discount).toBe(400.0); // 20% of 2000
      expect(invoice.discountedAmount).toBe(1600.0);
      expect(invoice.vatAmount).toBe(0); // VAT exempt
      expect(invoice.totalDue).toBe(1600.0);
      expect(invoice.compliance).toBe("RA 10754"); // PWD Law
    });

    it("should validate PWD ID requirements", async () => {
      const invalidSale = {
        customerType: "PWD",
        idNumber: null,
        amount: 2000.0,
      };

      await expect(
        discountService.applyPWDDiscount(invalidSale)
      ).rejects.toThrow("PWD ID required for discount");
    });
  });

  describe("Discount Documentation", () => {
    it("should maintain discount logbook for BIR", async () => {
      const discount = {
        date: new Date("2025-01-15"),
        type: "SENIOR",
        customerName: "Juan Dela Cruz",
        idNumber: "SC-123456",
        originalAmount: 5000.0,
        discountAmount: 1000.0,
        vatExempted: 107.14,
      };

      const entry = await discountService.logDiscount(discount);

      expect(entry.logNumber).toMatch(/^DL-2025-\d{6}$/);
      expect(entry.birCompliant).toBe(true);
      expect(entry.attachments).toContain("id-copy.jpg");
    });

    it("should generate BIR-required discount summary", async () => {
      const quarter = "Q1-2025";

      const summary = await discountService.generateQuarterlySummary(quarter);

      expect(summary).toEqual({
        seniorDiscounts: expect.any(Number),
        pwdDiscounts: expect.any(Number),
        totalDiscounts: expect.any(Number),
        vatExempted: expect.any(Number),
        transactionCount: expect.any(Number),
        birForm: "Attachment to Monthly VAT Declaration",
      });
    });
  });
});
```

### 5. Commission and Fee Tracking

#### Test Suite: CommissionTracking

```typescript
describe("CommissionTracking", () => {
  describe("OTA Commissions", () => {
    it("should calculate Airbnb host service fee", async () => {
      const booking = {
        platform: "AIRBNB",
        grossBookingAmount: 10000.0,
        hostServiceFeeRate: 0.03, // 3%
      };

      const commission = await commissionService.calculateAirbnb(booking);

      expect(commission.grossAmount).toBe(10000.0);
      expect(commission.serviceFee).toBe(300.0);
      expect(commission.netPayout).toBe(9700.0);
      expect(commission.payoutSchedule).toBe("48_HOURS_AFTER_CHECKIN");
    });

    it("should calculate Booking.com commission", async () => {
      const booking = {
        platform: "BOOKING_COM",
        roomRevenue: 8000.0,
        commissionRate: 0.15, // 15%
      };

      const commission = await commissionService.calculateBookingCom(booking);

      expect(commission.roomRevenue).toBe(8000.0);
      expect(commission.commission).toBe(1200.0);
      expect(commission.netRevenue).toBe(6800.0);
      expect(commission.invoiceRequired).toBe(true);
    });

    it("should track Agoda commissions and payments", async () => {
      const booking = {
        platform: "AGODA",
        bookingValue: 12000.0,
        commissionRate: 0.18, // 18%
        paymentModel: "AGENCY", // Agoda collects payment
      };

      const commission = await commissionService.calculateAgoda(booking);

      expect(commission.bookingValue).toBe(12000.0);
      expect(commission.agodaCommission).toBe(2160.0);
      expect(commission.netRemittance).toBe(9840.0);
      expect(commission.settlementPeriod).toBe("MONTHLY");
    });
  });

  describe("Payment Gateway Fees", () => {
    it("should calculate credit card processing fees", async () => {
      const transaction = {
        amount: 5000.0,
        cardType: "VISA",
        mdrRate: 0.025, // 2.5% MDR
      };

      const fees = await feeService.calculateCardFees(transaction);

      expect(fees.transactionAmount).toBe(5000.0);
      expect(fees.mdrFee).toBe(125.0);
      expect(fees.netAmount).toBe(4875.0);
      expect(fees.settlementDays).toBe(3);
    });

    it("should calculate PayMongo transaction fees", async () => {
      const payment = {
        amount: 10000.0,
        paymentMethod: "GCASH",
        paymongoRates: {
          percentage: 0.025, // 2.5%
          fixed: 15.0, // PHP 15 fixed
        },
      };

      const fees = await feeService.calculatePayMongoFees(payment);

      expect(fees.grossAmount).toBe(10000.0);
      expect(fees.percentageFee).toBe(250.0);
      expect(fees.fixedFee).toBe(15.0);
      expect(fees.totalFees).toBe(265.0);
      expect(fees.netAmount).toBe(9735.0);
    });
  });

  describe("Commission Reconciliation", () => {
    it("should reconcile OTA statements", async () => {
      const statement = {
        platform: "AIRBNB",
        period: "2025-01",
        reportedBookings: 15,
        reportedRevenue: 150000.0,
        reportedCommission: 4500.0,
      };

      const reconciliation =
        await commissionService.reconcileStatement(statement);

      expect(reconciliation.systemBookings).toBe(15);
      expect(reconciliation.systemRevenue).toBe(150000.0);
      expect(reconciliation.systemCommission).toBe(4500.0);
      expect(reconciliation.matched).toBe(true);
      expect(reconciliation.variance).toBe(0);
    });

    it("should generate commission summary report", async () => {
      const month = "2025-01";

      const report = await commissionService.generateMonthlyReport(month);

      expect(report).toEqual({
        totalRevenue: expect.any(Number),
        byPlatform: {
          airbnb: {
            revenue: expect.any(Number),
            commission: expect.any(Number),
          },
          bookingCom: {
            revenue: expect.any(Number),
            commission: expect.any(Number),
          },
          agoda: {
            revenue: expect.any(Number),
            commission: expect.any(Number),
          },
          direct: { revenue: expect.any(Number), commission: 0 },
        },
        totalCommissions: expect.any(Number),
        netRevenue: expect.any(Number),
        effectiveCommissionRate: expect.any(Number),
      });
    });
  });
});
```

## Test Data Preparation

### Sample Booking Data

```typescript
export const testBookings = {
  cashBooking: {
    id: "BK-2025-001",
    guestName: "Maria Santos",
    checkIn: "2025-02-01",
    checkOut: "2025-02-03",
    roomType: "Standard",
    amount: 6000.0,
    paymentMethod: "CASH",
  },
  airbnbBooking: {
    id: "BK-2025-002",
    confirmationCode: "HMXYZ123",
    guestName: "John Smith",
    checkIn: "2025-02-05",
    checkOut: "2025-02-08",
    grossAmount: 12000.0,
    serviceFee: 360.0,
    netPayout: 11640.0,
  },
  groupBooking: {
    id: "BK-2025-003",
    groupName: "Company Outing",
    rooms: 5,
    guests: 15,
    totalAmount: 35000.0,
    deposit: 10000.0,
    balance: 25000.0,
  },
};
```

### Exchange Rate Mock Data

```typescript
export const exchangeRates = {
  "2025-01-15": {
    USD: { buy: 56.0, sell: 56.5, mid: 56.25 },
    EUR: { buy: 61.0, sell: 61.75, mid: 61.375 },
    JPY: { buy: 0.38, sell: 0.39, mid: 0.385 },
    CNY: { buy: 7.7, sell: 7.85, mid: 7.775 },
  },
};
```

## Performance Requirements

### Transaction Processing

```typescript
describe("Performance Benchmarks", () => {
  it("should process 100 payments in under 3 seconds", async () => {
    const payments = generateBulkPayments(100);
    const start = Date.now();

    await paymentService.bulkProcess(payments);

    expect(Date.now() - start).toBeLessThan(3000);
  });

  it("should calculate daily revenue in under 1 second", async () => {
    const start = Date.now();

    await incomeService.calculateDailyRevenue("2025-01-15");

    expect(Date.now() - start).toBeLessThan(1000);
  });

  it("should generate income statement in under 3 seconds", async () => {
    const start = Date.now();

    await reportService.generateIncomeStatement("2025-01");

    expect(Date.now() - start).toBeLessThan(3000);
  });
});
```

## Integration Test Requirements

### Payment Gateway Integration

```typescript
describe("Payment Gateway Integration", () => {
  it("should integrate with PayMongo API", async () => {
    const payment = {
      amount: 5000.0,
      currency: "PHP",
      description: "Room booking",
    };

    const result = await paymongoService.createPaymentIntent(payment);

    expect(result.id).toBeDefined();
    expect(result.status).toBe("awaiting_payment_method");
    expect(result.amount).toBe(500000); // In centavos
  });

  it("should verify GCash payment status", async () => {
    const referenceNumber = "GC123456789";

    const status = await gcashService.verifyPayment(referenceNumber);

    expect(status).toEqual({
      verified: true,
      amount: expect.any(Number),
      sender: expect.any(String),
      timestamp: expect.any(Date),
    });
  });
});
```

## Success Criteria

### Coverage Requirements

- Unit test coverage: 95% for all financial calculations
- Integration test coverage: 100% for payment methods
- E2E test coverage: Core booking and payment flows
- Edge case coverage: All discount scenarios and tax calculations

### Accuracy Requirements

- Financial calculations accurate to centavo (0.01 PHP)
- Exchange rate precision to 4 decimal places
- Tax calculations compliant with BIR requirements
- Commission calculations match platform statements

### Performance Targets

- Payment processing: < 500ms per transaction
- Report generation: < 3s for monthly reports
- Currency conversion: < 100ms per calculation
- Revenue calculation: < 1s for daily totals

## Next Steps

After completing all income management tests in RED phase, proceed to Phase 4.3
for implementation that makes these tests pass.

---

**Phase Lead**: Financial Systems Architect **Document Status**: RED Phase -
Test Specification **Tests Written**: 0 **Tests Passing**: 0 **Target**:
Complete test coverage before implementation
