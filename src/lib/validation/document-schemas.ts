import { z } from "zod";

import { sanitizeText } from "@/lib/security/sanitize";

// ============================================
// RECIPIENT SCHEMA
// ============================================

export const recipientSchema = z.object({
  name: z
    .string()
    .min(1, "Recipient name is required")
    .max(200, "Name too long")
    .transform((val) => sanitizeText(val)),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z
    .string()
    .max(30, "Phone too long")
    .transform((val) => sanitizeText(val))
    .optional()
    .or(z.literal("")),
  address: z
    .string()
    .max(500, "Address too long")
    .transform((val) => sanitizeText(val))
    .optional()
    .or(z.literal("")),
  company_name: z
    .string()
    .max(200, "Company name too long")
    .transform((val) => sanitizeText(val))
    .optional()
    .or(z.literal("")),
  tin: z
    .string()
    .max(30, "TIN too long")
    .transform((val) => sanitizeText(val))
    .optional()
    .or(z.literal("")),
});

// ============================================
// LINE ITEM SCHEMA
// ============================================

export const lineItemSchema = z.object({
  id: z.string(),
  type: z.enum(["accommodation", "service", "fee", "custom"]),
  description: z
    .string()
    .min(1, "Description is required")
    .max(500, "Description too long")
    .transform((val) => sanitizeText(val)),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unit_label: z.string().min(1, "Unit label is required"),
  unit_price: z.number().min(0, "Unit price cannot be negative"),
  amount: z.number(),
});

// ============================================
// PRICING SCHEMA
// ============================================

export const pricingSchema = z.object({
  subtotal: z.number(),
  discount_label: z
    .string()
    .max(100)
    .transform((val) => sanitizeText(val))
    .optional()
    .or(z.literal("")),
  discount_amount: z.number().min(0, "Discount cannot be negative"),
  taxable_amount: z.number(),
  vat_rate: z.number().min(0).max(1, "VAT rate should be between 0 and 1"),
  vat_amount: z.number(),
  total_amount: z.number(),
});

// ============================================
// DOCUMENT FORM SCHEMA
// ============================================

export const documentFormSchema = z.object({
  document_type: z.enum(["quotation", "invoice"]),
  document_date: z.string().min(1, "Document date is required"),
  valid_until: z.string().optional().or(z.literal("")),
  recipient: recipientSchema,
  line_items: z.array(lineItemSchema).min(1, "At least one line item is required"),
  pricing: pricingSchema,
  notes: z
    .string()
    .max(2000, "Notes too long")
    .transform((val) => sanitizeText(val))
    .optional()
    .or(z.literal("")),
  payment_terms: z
    .string()
    .max(2000, "Payment terms too long")
    .transform((val) => sanitizeText(val))
    .optional()
    .or(z.literal("")),
  cancellation_policy: z
    .string()
    .max(2000, "Cancellation policy too long")
    .transform((val) => sanitizeText(val))
    .optional()
    .or(z.literal("")),
});

export type DocumentFormValues = z.infer<typeof documentFormSchema>;
