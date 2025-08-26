/**
 * Check email availability API endpoint
 * GET /api/auth/check-email
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { queryOne } from "../lib/db";
import { successResponse, errorResponse, ValidationError } from "../_lib/types";

// Query validation schema
const checkEmailSchema = z.object({
  email: z.string().email("Invalid email format"),
});

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
      allowed: ["GET"],
    });
  }

  try {
    // Validate query parameters
    const validation = checkEmailSchema.safeParse(req.query);
    if (!validation.success) {
      return res
        .status(400)
        .json(errorResponse(new ValidationError("Validation failed", validation.error.errors)));
    }

    const { email } = validation.data;

    // Check if email exists
    const existingUser = await queryOne<{ id: string }>(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    return res.status(200).json(
      successResponse({
        available: !existingUser,
        email: email.toLowerCase(),
      })
    );
  } catch (error) {
    console.error("[CheckEmail] Error:", error);
    return res.status(500).json(errorResponse(new Error("Failed to check email availability")));
  }
}

// Export handler
export default handler;
