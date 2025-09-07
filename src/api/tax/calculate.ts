/**
 * Tax Calculation API Endpoint
 * POST /api/tax/calculate
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TaxCalculatorService } from "@/features/financial/services/tax-calculator.service";
import { Money } from "@/lib/money";
import { withAuth } from "@/api/_lib/middleware";
import { ApiError } from "@/lib/api-error";

// Zod schema for tax calculation
const calculateTaxSchema = z.object({
  amount: z
    .union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.number().positive()])
    .transform((val) => new Money(val)),

  calculationType: z.enum(["VAT", "EWT", "BOTH"]),

  // VAT calculation options
  isVatInclusive: z.boolean().default(true),
  vatExempt: z.boolean().default(false),

  // EWT calculation options
  ewtType: z
    .enum([
      "PROFESSIONAL_INDIVIDUAL",
      "PROFESSIONAL_CORPORATION",
      "RENTAL_INDIVIDUAL",
      "RENTAL_CORPORATION",
      "GOODS_INDIVIDUAL",
      "GOODS_CORPORATION",
      "SERVICES_INDIVIDUAL",
      "SERVICES_CORPORATION",
    ])
    .optional(),

  // Discount options
  discounts: z
    .array(
      z.object({
        type: z.enum(["SENIOR", "PWD", "PROMOTIONAL"]),
        percentage: z.number().min(0).max(100),
        idNumber: z.string().optional(),
      })
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const authContext = await withAuth(req);
    if (!authContext) {
      return ApiError.unauthorized("Authentication required");
    }

    const body = await req.json();
    const validatedData = calculateTaxSchema.parse(body);

    const taxService = new TaxCalculatorService();
    const results: any = {
      originalAmount: validatedData.amount.toString(),
      calculations: {},
    };

    // Calculate VAT if requested
    if (validatedData.calculationType === "VAT" || validatedData.calculationType === "BOTH") {
      if (!validatedData.vatExempt) {
        const vatCalc = validatedData.isVatInclusive
          ? taxService.removeVAT(validatedData.amount)
          : taxService.addVAT(validatedData.amount);

        results.calculations.vat = {
          netAmount: vatCalc.netAmount.toString(),
          vatAmount: vatCalc.vatAmount.toString(),
          grossAmount: vatCalc.grossAmount.toString(),
          rate: "12%",
        };
      } else {
        results.calculations.vat = {
          status: "exempt",
          reason: "VAT exempt transaction",
        };
      }
    }

    // Calculate EWT if requested
    if (
      (validatedData.calculationType === "EWT" || validatedData.calculationType === "BOTH") &&
      validatedData.ewtType
    ) {
      const ewtCalc = taxService.calculateEWT(validatedData.amount, validatedData.ewtType);

      results.calculations.ewt = {
        grossAmount: validatedData.amount.toString(),
        ewtAmount: ewtCalc.ewtAmount.toString(),
        netAmount: ewtCalc.netAmount.toString(),
        rate: ewtCalc.rate,
        type: validatedData.ewtType,
      };
    }

    // Apply discounts if provided
    if (validatedData.discounts && validatedData.discounts.length > 0) {
      let discountedAmount = validatedData.amount;
      const discountDetails = [];

      for (const discount of validatedData.discounts) {
        if (discount.type === "SENIOR" || discount.type === "PWD") {
          const discountCalc = taxService.applySeniorPWDDiscount(discountedAmount, discount.type);
          discountedAmount = discountCalc.discountedAmount;

          discountDetails.push({
            type: discount.type,
            originalAmount: discountCalc.originalAmount.toString(),
            discountAmount: discountCalc.discountAmount.toString(),
            discountedAmount: discountCalc.discountedAmount.toString(),
            vatExemptAmount: discountCalc.vatExemptAmount.toString(),
            compliance: discount.type === "SENIOR" ? "RA 9994" : "RA 10754",
          });
        }
      }

      if (discountDetails.length > 0) {
        results.calculations.discounts = discountDetails;
        results.finalAmount = discountedAmount.toString();
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return ApiError.badRequest("Validation failed", error.errors);
    }
    return ApiError.handle(error, "Failed to calculate tax");
  }
}
