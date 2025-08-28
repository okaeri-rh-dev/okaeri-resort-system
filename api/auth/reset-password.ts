/**
 * Password reset request API endpoint
 * POST /api/auth/reset-password
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { generatePasswordResetToken } from "../lib/jwt";
import { queryOne, execute } from "../lib/db";
import { rateLimit } from "../middleware/rate-limit";
import { successResponse, errorResponse, ValidationError } from "../_lib/types";

// Request validation schema
const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});

type _ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      allowed: ["POST"],
    });
  }

  try {
    // Validate request body
    const validation = resetPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res
        .status(400)
        .json(errorResponse(new ValidationError("Validation failed", validation.error.errors)));
    }

    const { email } = validation.data;

    // Find user by email
    const user = await queryOne<{ id: string; name: string; email: string }>(
      "SELECT id, name, email FROM users WHERE LOWER(email) = LOWER($1) AND is_active = true",
      [email]
    );

    // Always return success to prevent email enumeration
    if (!user) {
      // console.log(`[ResetPassword] User not found for email: ${email}`);
      return res
        .status(200)
        .json(
          successResponse(
            null,
            "If an account exists with this email, you will receive a password reset link"
          )
        );
    }

    // Generate reset token
    const resetToken = generatePasswordResetToken(user.id, user.email);
    const resetId = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store reset token in database
    await execute(
      `INSERT INTO password_resets 
        (id, user_id, token_hash, expires_at, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        token_hash = $3,
        expires_at = $4,
        created_at = CURRENT_TIMESTAMP`,
      [resetId, user.id, resetToken, expiresAt]
    );

    // Log password reset request
    await execute(
      `INSERT INTO activity_logs 
        (user_id, action, resource, details, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        user.id,
        "PASSWORD_RESET_REQUEST",
        "auth",
        { email, resetId },
        req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
        req.headers["user-agent"],
      ]
    );

    // Send reset email (stub for now)
    const _resetUrl = `${process.env.APP_URL || "https://app.okaeri.ph"}/reset-password?token=${resetToken}`;

    // TODO: Implement email sending
    // console.log(`[ResetPassword] Reset URL for ${email}: ${resetUrl}`);

    // In production, you would send an email like this:
    // await sendPasswordResetEmail({
    //   to: user.email,
    //   name: user.name,
    //   resetUrl,
    //   expiresIn: "1 hour",
    // });

    return res
      .status(200)
      .json(
        successResponse(
          null,
          "If an account exists with this email, you will receive a password reset link"
        )
      );
  } catch (error) {
    console.error("[ResetPassword] Error:", error);

    // Don't leak any information about the error
    return res
      .status(200)
      .json(
        successResponse(
          null,
          "If an account exists with this email, you will receive a password reset link"
        )
      );
  }
}

// Export with rate limiting (3 attempts per hour)
export default rateLimit("resetPassword")(handler);
