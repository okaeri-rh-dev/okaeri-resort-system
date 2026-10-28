import type { LetterheadConfig } from "./types";

export const DEFAULT_VAT_RATE = 0.12;

export const DOCUMENT_PREFIX_MAP = {
  quotation: "QUO",
  invoice: "INV",
} as const;

export const DEFAULT_LETTERHEAD: LetterheadConfig = {
  resort_name: "Okaeri Resort",
  tagline: "Your Home Away From Home",
  address_line_1: "Amita St., Brgy. Taboc",
  address_line_2: "M8QQ+HF",
  city: "San Juan",
  province: "La Union",
  zip_code: "2514",
  // Phone and email come from the visible Contact channels once they load.
  phone: "",
  email: "",
  website: "",
};

export const DEFAULT_PAYMENT_TERMS =
  "A 50% deposit is required upon booking confirmation. The remaining balance is due on or before check-in. Payments may be made via GCash, bank transfer, or cash.";

export const DEFAULT_CANCELLATION_POLICY =
  "Cancellations made 7 days or more before check-in will receive a full refund. Cancellations within 3-6 days will be charged 50%. No refund for cancellations within 48 hours of check-in.";

export const UNIT_LABEL_OPTIONS = ["night", "pax", "unit", "hour", "piece", "set"] as const;

export const LINE_ITEM_TYPE_LABELS: Record<string, string> = {
  accommodation: "Accommodation",
  service: "Service",
  fee: "Fee",
  custom: "Custom",
};

export const FORM_SYNC_DEBOUNCE_MS = 300;

export const LOGO_MAX_SIZE_BYTES = 500 * 1024; // 500KB
export const LOGO_COMPRESSED_MAX_BYTES = 200 * 1024; // 200KB target after compression
export const LOGO_BASE64_MAX_BYTES = 300 * 1024; // ~300KB base64 limit for localStorage safety

/** Validate that a base64 string is a safe raster image data URI (blocks SVG to prevent XSS) */
export function isValidImageDataUri(src: string | undefined): src is string {
  return !!src && src.startsWith("data:image/") && !src.startsWith("data:image/svg");
}
