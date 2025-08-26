/**
 * Resend email verification API endpoint
 * POST /api/auth/resend-verification
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { queryOne, execute } from "../lib/db";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { successResponse, errorResponse, ValidationError } from "../_lib/types";

// Request validation schema (optional email for non-authenticated requests)
const resendVerificationSchema = z.object({
  email: z.string().email("Invalid email format").optional(),
});

type ResendVerificationRequest = z.infer<typeof resendVerificationSchema>;

async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      allowed: ["POST"],
    });
  }

  try {
    // Validate request body
    const validation = resendVerificationSchema.safeParse(req.body);
    if (!validation.success) {
      return res
        .status(400)
        .json(errorResponse(new ValidationError("Validation failed", validation.error.errors)));
    }

    const { email } = validation.data;

    // Determine which email to use
    let userEmail: string;
    let userId: string;

    if (req.user?.userId) {
      // Authenticated request - use user from token
      const user = await queryOne<{ id: string; email: string; email_verified: boolean }>(
        "SELECT id, email, email_verified FROM users WHERE id = $1",
        [req.user.userId]
      );

      if (!user) {
        return res.status(404).json(errorResponse(new Error("User not found")));
      }

      if (user.email_verified) {
        return res.status(200).json(successResponse(null, "Email is already verified"));
      }

      userId = user.id;
      userEmail = user.email;
    } else if (email) {
      // Non-authenticated request with email
      const user = await queryOne<{ id: string; email: string; email_verified: boolean }>(
        "SELECT id, email, email_verified FROM users WHERE LOWER(email) = LOWER($1)",
        [email]
      );

      // Always return success to prevent email enumeration
      if (!user) {
        return res
          .status(200)
          .json(
            successResponse(
              null,
              "If an account exists with this email, a verification link will be sent"
            )
          );
      }

      if (user.email_verified) {
        return res.status(200).json(successResponse(null, "Email is already verified"));
      }

      userId = user.id;
      userEmail = user.email;
    } else {
      return res.status(400).json(errorResponse(new ValidationError("Email is required")));
    }

    // Generate verification token
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET not configured");
    }

    const verificationToken = jwt.sign(
      {
        userId,
        email: userEmail,
        type: "email_verification",
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Log verification resend
    await execute(
      `INSERT INTO activity_logs 
        (user_id, action, resource, details, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        userId,
        "EMAIL_VERIFICATION_RESENT",
        "auth",
        { email: userEmail },
        req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
        req.headers["user-agent"],
      ]
    );

    // Send verification email (stub for now)
    const verificationUrl = `${process.env.APP_URL || "https://app.okaeri.ph"}/verify-email?token=${verificationToken}`;

    // TODO: Implement email sending
    console.log(`[ResendVerification] Verification URL for ${userEmail}: ${verificationUrl}`);

    // In production, you would send an email like this:
    // await sendVerificationEmail({
    //   to: userEmail,
    //   verificationUrl,
    //   expiresIn: "24 hours",
    // });

    return res
      .status(200)
      .json(
        successResponse(
          null,
          req.user
            ? "Verification email sent successfully"
            : "If an account exists with this email, a verification link will be sent"
        )
      );
  } catch (error) {
    console.error("[ResendVerification] Error:", error);

    return res
      .status(500)
      .json(errorResponse(new Error("Failed to send verification email. Please try again.")));
  }
}

// Export with rate limiting (3 attempts per hour)
// Use custom rate limit that works for both authenticated and non-authenticated requests
export default rateLimit("resetPassword")(handler);
