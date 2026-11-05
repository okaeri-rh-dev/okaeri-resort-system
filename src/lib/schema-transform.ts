import { z } from "zod";

// Guest booking form data type (frontend)
export interface GuestBookingFormData {
  guest_name: string;
  email: string;
  phone_number: string;
  unit_id: string;
  check_in: Date;
  check_out: Date;
  num_guests: number;
  special_requests?: string;
  payment_proof: File;
}

/**
 * Transform frontend form data to backend API format
 * Ensures date serialization and file metadata extraction
 */
export function transformToAPIFormat(formData: GuestBookingFormData): Record<string, unknown> {
  return {
    // Guest information (same format)
    guest_name: formData.guest_name,
    email: formData.email,
    phone_number: formData.phone_number,

    // Booking details
    unit_id: formData.unit_id,
    num_guests: formData.num_guests,
    special_requests: formData.special_requests,

    // Date transformation: Date → ISO string (UTC)
    // Note: Dates are interpreted as Asia/Manila, converted to UTC for storage
    check_in: formData.check_in.toISOString(),
    check_out: formData.check_out.toISOString(),

    // File metadata extraction (don't send File object)
    file_name: formData.payment_proof.name,
    file_type: formData.payment_proof.type as
      "image/jpeg" | "image/png" | "image/jpg" | "image/webp" | "application/pdf",
    file_size: formData.payment_proof.size,

    // CAPTCHA token (added separately in form submission)
    // turnstile_token: string // Added by onSubmit handler
  };
}

/**
 * Validate API response against expected schema
 * Prevents runtime errors from backend changes
 */
export const apiResponseSchema = z.object({
  success: z.boolean(),
  booking: z.object({
    booking_id: z.guid(),
    booking_reference: z.string(),
    total_amount: z.number(),
  }),
  upload: z.object({
    path: z.string(),
    token: z.string(),
    bucket: z.string(),
    expires_at: z.string().datetime(),
  }),
  message: z.string().optional(),
});

export type ApiResponse = z.infer<typeof apiResponseSchema>;

export function validateAPIResponse(data: unknown): ApiResponse {
  return apiResponseSchema.parse(data);
}

/**
 * Guest booking status check response schema, the body of POST /api/guest-booking/status.
 * `unit_name` and `unit_type` are comma-joined and empty until cabins are assigned.
 */
export const statusResponseSchema = z.object({
  booking_reference: z.string(),
  status: z.string().nullable(),
  payment_status: z.string().nullable(),
  check_in: z.string(),
  check_out: z.string(),
  total_amount: z.number(),
  num_guests: z.number(),
  unit_name: z.string(),
  unit_type: z.string(),
  created_at: z.string().nullable(),
  upload_status: z.string(),
  special_requests: z.string().nullable(),
  message: z.string(),
});

export type StatusResponse = z.infer<typeof statusResponseSchema>;

export function validateStatusResponse(data: unknown): StatusResponse {
  return statusResponseSchema.parse(data);
}
