/**
 * Update password API endpoint
 * POST /api/auth/update-password
 */

import type { VercelRequest as _VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { hashPassword, verifyPassword, validatePassword } from "../lib/password";
import { transaction, db } from "../lib/db";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import {
  successResponse,
  errorResponse,
  ValidationError,
  AuthenticationError,
} from "../_lib/types";

// Request validation schema
const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

type _UpdatePasswordRequest = z.infer<typeof updatePasswordSchema>;

async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      allowed: ["POST"],
    });
  }

  if (!req.user?.userId) {
    return res.status(401).json(errorResponse(new AuthenticationError("Authentication required")));
  }

  try {
    // Validate request body
    const validation = updatePasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res
        .status(400)
        .json(errorResponse(new ValidationError("Validation failed", validation.error.errors)));
    }

    const { currentPassword, newPassword } = validation.data;

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

    // Execute password update in transaction
    await transaction(async (client) => {
      // Get current user password hash
      const userResult = await client.query("SELECT id, password_hash FROM users WHERE id = $1", [
        req.user.userId,
      ]);

      if (userResult.rows.length === 0) {
        throw new AuthenticationError("User not found");
      }

      const user = userResult.rows[0];

      // Verify current password
      const isValidPassword = await verifyPassword(currentPassword, user.password_hash);
      if (!isValidPassword) {
        throw new AuthenticationError("Current password is incorrect");
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update password
      const updateQuery = db.buildUpdateQuery(
        "users",
        {
          password_hash: newPasswordHash,
          password_changed_at: new Date(),
          updated_at: new Date(),
        },
        { id: req.user.userId }
      );

      await client.query(updateQuery.text, updateQuery.values);

      // Invalidate all existing sessions (optional - forces re-login)
      // This is a security measure to ensure old sessions can't be used
      await client.query("DELETE FROM sessions WHERE user_id = $1", [req.user.userId]);

      // Log password change
      await client.query(
        `INSERT INTO activity_logs 
          (user_id, action, resource, details, ip_address, user_agent, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [
          req.user.userId,
          "PASSWORD_CHANGED",
          "auth",
          { method: "user_initiated" },
          req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
          req.headers["user-agent"],
        ]
      );

      // Send notification email (stub for now)
      // TODO: Implement email notification
      // console.log(`[UpdatePassword] Password changed for user ${req.user.userId}`);
    });

    // Clear authentication cookies (force re-login)
    res.setHeader("Set-Cookie", [
      "token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
      "refreshToken=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
    ]);

    return res
      .status(200)
      .json(
        successResponse(
          null,
          "Password updated successfully. Please log in with your new password."
        )
      );
  } catch (error) {
    console.error("[UpdatePassword] Error:", error);

    if (error instanceof AuthenticationError) {
      return res.status(401).json(errorResponse(error));
    }

    if (error instanceof ValidationError) {
      return res.status(400).json(errorResponse(error));
    }

    return res
      .status(500)
      .json(errorResponse(new Error("Failed to update password. Please try again.")));
  }
}

// Export with authentication required
export default requireAuth(handler);
