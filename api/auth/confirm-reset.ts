/**
 * Confirm password reset API endpoint
 * POST /api/auth/confirm-reset
 * Used when user clicks the reset link and submits new password
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { hashPassword, validatePassword } from "../lib/password";
import { verifyPasswordResetToken } from "../lib/jwt";
import { transaction, db } from "../lib/db";
import {
  successResponse,
  errorResponse,
  ValidationError,
  AuthenticationError,
} from "../_lib/types";

// Request validation schema
const confirmResetSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type _ConfirmResetRequest = z.infer<typeof confirmResetSchema>;

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      allowed: ["POST"],
    });
  }

  try {
    // Validate request body
    const validation = confirmResetSchema.safeParse(req.body);
    if (!validation.success) {
      return res
        .status(400)
        .json(errorResponse(new ValidationError("Validation failed", validation.error.errors)));
    }

    const { token, newPassword } = validation.data;

    // Verify reset token
    let tokenData: { userId: string; email: string };
    try {
      tokenData = verifyPasswordResetToken(token);
    } catch {
      return res
        .status(400)
        .json(errorResponse(new AuthenticationError("Invalid or expired reset token")));
    }

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res
        .status(400)
        .json(
          errorResponse(
            new ValidationError("Password validation failed", passwordValidation.errors)
          )
        );
    }

    // Execute password reset in transaction
    await transaction(async (client) => {
      // Verify reset token exists and is not expired
      const resetResult = await client.query(
        `SELECT id, user_id, expires_at, used_at 
         FROM password_resets 
         WHERE user_id = $1 AND token_hash = $2`,
        [tokenData.userId, token]
      );

      if (resetResult.rows.length === 0) {
        throw new AuthenticationError("Invalid reset token");
      }

      const reset = resetResult.rows[0];

      if (reset.used_at) {
        throw new AuthenticationError("Reset token has already been used");
      }

      if (new Date(reset.expires_at) < new Date()) {
        throw new AuthenticationError("Reset token has expired");
      }

      // Hash new password
      const passwordHash = await hashPassword(newPassword);

      // Update user password
      const updateQuery = db.buildUpdateQuery(
        "users",
        {
          password_hash: passwordHash,
          password_changed_at: new Date(),
          updated_at: new Date(),
        },
        { id: tokenData.userId }
      );

      await client.query(updateQuery.text, updateQuery.values);

      // Mark reset token as used
      await client.query("UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = $1", [
        reset.id,
      ]);

      // Invalidate all existing sessions for security
      await client.query("DELETE FROM sessions WHERE user_id = $1", [tokenData.userId]);

      // Log password reset
      await client.query(
        `INSERT INTO activity_logs 
          (user_id, action, resource, details, ip_address, user_agent, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
          tokenData.userId,
          "PASSWORD_RESET_COMPLETED",
          "auth",
          { email: tokenData.email, resetId: reset.id },
          req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
          req.headers["user-agent"],
        ]
      );

      // Send confirmation email (stub for now)
      // console.log(`[ConfirmReset] Password reset completed for ${tokenData.email}`);
      // TODO: Send email notification about password change
    });

    return res
      .status(200)
      .json(
        successResponse(
          null,
          "Password has been reset successfully. You can now log in with your new password."
        )
      );
  } catch (error) {
    console.error("[ConfirmReset] Error:", error);

    if (error instanceof AuthenticationError) {
      return res.status(400).json(errorResponse(error));
    }

    if (error instanceof ValidationError) {
      return res.status(400).json(errorResponse(error));
    }

    return res
      .status(500)
      .json(
        errorResponse(
          new Error("Failed to reset password. Please try again or request a new reset link.")
        )
      );
  }
}

// Export handler
export default handler;
