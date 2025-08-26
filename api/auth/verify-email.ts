/**
 * Email verification API endpoint
 * POST /api/auth/verify-email
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { execute, queryOne } from "../lib/db";
import {
  successResponse,
  errorResponse,
  ValidationError,
  AuthenticationError,
} from "../_lib/types";

// Request validation schema
const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

type VerifyEmailRequest = z.infer<typeof verifyEmailSchema>;

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      allowed: ["POST"],
    });
  }

  try {
    // Validate request body
    const validation = verifyEmailSchema.safeParse(req.body);
    if (!validation.success) {
      return res
        .status(400)
        .json(errorResponse(new ValidationError("Validation failed", validation.error.errors)));
    }

    const { token } = validation.data;

    // Verify token
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET not configured");
    }

    let tokenData: { userId: string; email: string; type: string };
    try {
      tokenData = jwt.verify(token, process.env.JWT_SECRET) as any;

      if (tokenData.type !== "email_verification") {
        throw new Error("Invalid token type");
      }
    } catch (error) {
      return res
        .status(400)
        .json(errorResponse(new AuthenticationError("Invalid or expired verification token")));
    }

    // Check if user exists and email matches
    const user = await queryOne<{ id: string; email: string; email_verified: boolean }>(
      "SELECT id, email, email_verified FROM users WHERE id = $1 AND email = $2",
      [tokenData.userId, tokenData.email]
    );

    if (!user) {
      return res
        .status(400)
        .json(errorResponse(new AuthenticationError("Invalid verification token")));
    }

    if (user.email_verified) {
      return res.status(200).json(successResponse(null, "Email is already verified"));
    }

    // Update user email verification status
    await execute(
      "UPDATE users SET email_verified = true, email_verified_at = CURRENT_TIMESTAMP WHERE id = $1",
      [user.id]
    );

    // Log email verification
    await execute(
      `INSERT INTO activity_logs 
        (user_id, action, resource, details, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        user.id,
        "EMAIL_VERIFIED",
        "auth",
        { email: user.email },
        req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
        req.headers["user-agent"],
      ]
    );

    return res
      .status(200)
      .json(successResponse({ email: user.email }, "Email verified successfully"));
  } catch (error) {
    console.error("[VerifyEmail] Error:", error);

    return res
      .status(500)
      .json(errorResponse(new Error("Failed to verify email. Please try again.")));
  }
}

// Export handler
export default handler;
