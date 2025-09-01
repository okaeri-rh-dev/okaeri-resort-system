/**
 * JWT generation and validation utilities for Vercel serverless functions
 * Handles access and refresh token management with secure defaults
 */

import jwt, { type JwtPayload, type SignOptions, type VerifyOptions } from "jsonwebtoken";
import type { TokenPayload } from "../_lib/types";

// Token expiration times
export const TOKEN_EXPIRY = {
  ACCESS: "15m", // 15 minutes for access tokens
  REFRESH: "7d", // 7 days for refresh tokens
  REMEMBER_ME: "30d", // 30 days when remember me is checked
  PASSWORD_RESET: "1h", // 1 hour for password reset
  EMAIL_VERIFICATION: "24h", // 24 hours for email verification
} as const;

// JWT signing options with secure defaults
const defaultSignOptions: SignOptions = {
  algorithm: "HS256",
  issuer: process.env.JWT_ISSUER || "okaeri-resort",
  audience: process.env.JWT_AUDIENCE || "okaeri-api",
};

// JWT verify options with secure defaults
const defaultVerifyOptions: VerifyOptions = {
  algorithms: ["HS256"],
  issuer: process.env.JWT_ISSUER || "okaeri-resort",
  audience: process.env.JWT_AUDIENCE || "okaeri-api",
};

/**
 * Generate an access token
 */
export function generateAccessToken(
  payload: TokenPayload,
  expiresIn: string = TOKEN_EXPIRY.ACCESS
): string {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is not configured");
  }

  const tokenData = {
    ...payload,
    type: "access",
    iat: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(tokenData, process.env.JWT_SECRET, {
    ...defaultSignOptions,
    expiresIn,
  });
}

/**
 * Generate a refresh token
 */
export function generateRefreshToken(
  userId: string,
  expiresIn: string = TOKEN_EXPIRY.REFRESH
): string {
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error("JWT_REFRESH_SECRET environment variable is not configured");
  }

  const tokenData = {
    userId,
    type: "refresh",
    iat: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(tokenData, process.env.JWT_REFRESH_SECRET, {
    ...defaultSignOptions,
    expiresIn,
  });
}

/**
 * Generate a password reset token
 */
export function generatePasswordResetToken(userId: string, email: string): string {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is not configured");
  }

  const tokenData = {
    userId,
    email,
    type: "password_reset",
    iat: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(tokenData, process.env.JWT_SECRET, {
    ...defaultSignOptions,
    expiresIn: TOKEN_EXPIRY.PASSWORD_RESET,
  });
}

/**
 * Verify an access token
 */
export function verifyAccessToken(token: string): TokenPayload {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is not configured");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, defaultVerifyOptions) as JwtPayload;

    if (decoded.type !== "access") {
      throw new Error("Invalid token type");
    }

    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      projectId: decoded.projectId,
      permissions: decoded.permissions || [],
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Token has expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid token");
    }
    throw error;
  }
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token: string): { userId: string } {
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error("JWT_REFRESH_SECRET environment variable is not configured");
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_REFRESH_SECRET,
      defaultVerifyOptions
    ) as JwtPayload;

    if (decoded.type !== "refresh") {
      throw new Error("Invalid token type");
    }

    return { userId: decoded.userId };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Refresh token has expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid refresh token");
    }
    throw error;
  }
}

/**
 * Verify a password reset token
 */
export function verifyPasswordResetToken(token: string): { userId: string; email: string } {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is not configured");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, defaultVerifyOptions) as JwtPayload;

    if (decoded.type !== "password_reset") {
      throw new Error("Invalid token type");
    }

    return {
      userId: decoded.userId,
      email: decoded.email,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Password reset token has expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid password reset token");
    }
    throw error;
  }
}

/**
 * Decode a token without verification (useful for extracting claims)
 */
export function decodeToken(token: string): JwtPayload | null {
  return jwt.decode(token) as JwtPayload | null;
}

/**
 * Generate token pair (access + refresh)
 */
export function generateTokenPair(
  payload: TokenPayload,
  rememberMe: boolean = false
): {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} {
  const accessExpiresIn = rememberMe ? TOKEN_EXPIRY.REMEMBER_ME : TOKEN_EXPIRY.ACCESS;
  const refreshExpiresIn = rememberMe ? "30d" : TOKEN_EXPIRY.REFRESH;

  const accessToken = generateAccessToken(payload, accessExpiresIn);
  const refreshToken = generateRefreshToken(payload.userId, refreshExpiresIn);

  // Calculate expiration in seconds
  const expiresIn = rememberMe ? 30 * 24 * 60 * 60 : 15 * 60;

  return {
    accessToken,
    refreshToken,
    expiresIn,
  };
}

/**
 * Rotate refresh token (generate new one, invalidate old)
 */
export function rotateRefreshToken(userId: string): string {
  // In production, you would also invalidate the old token in a blacklist/database
  return generateRefreshToken(userId);
}

/**
 * Extract token from authorization header only (JWT-only auth)
 */
export function extractToken(authHeader?: string): string | null {
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  // JWT-only auth: Never check cookies for tokens
  return null;
}
