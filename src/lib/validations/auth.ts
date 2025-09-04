/**
 * Authentication form validation schemas using Zod
 * Designed for Philippine context with proper password requirements
 */

import { z } from "zod";

// Common email validation
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .max(100, "Email must be less than 100 characters")
  .toLowerCase()
  .trim();

// Password validation with breach checking support
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be less than 128 characters")
  .refine(
    (password) => {
      // Check for at least one uppercase letter
      return /[A-Z]/.test(password);
    },
    { message: "Password must contain at least one uppercase letter" }
  )
  .refine(
    (password) => {
      // Check for at least one lowercase letter
      return /[a-z]/.test(password);
    },
    { message: "Password must contain at least one lowercase letter" }
  )
  .refine(
    (password) => {
      // Check for at least one number
      return /\d/.test(password);
    },
    { message: "Password must contain at least one number" }
  )
  .refine(
    (password) => {
      // Check for at least one special character
      return /[@$!%*?&#]/.test(password);
    },
    { message: "Password must contain at least one special character (@$!%*?&#)" }
  );

// Basic password (for current password fields)
export const basicPasswordSchema = z
  .string()
  .min(1, "Password is required")
  .max(128, "Password is too long");

// Name validation
export const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name must be less than 100 characters")
  .transform((val) => val.trim())
  .refine((val) => val.length >= 2, "Name must be at least 2 characters");

// Project/resort name validation
export const projectNameSchema = z
  .string()
  .max(100, "Project name must be less than 100 characters")
  .transform((val) => val.trim())
  .optional();

// Phone number validation
export const phoneSchema = z
  .string()
  .regex(/^[+]?[0-9\s\-()]+$/, "Please enter a valid phone number")
  .optional();

// Reset token validation
export const resetTokenSchema = z
  .string()
  .min(1, "Reset token is required")
  .max(500, "Invalid reset token");

// Login form schema
export const loginSchema = z.object({
  email: emailSchema,
  password: basicPasswordSchema,
  rememberMe: z.boolean().default(false),
});

// Registration form schema
export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
    projectName: projectNameSchema,
    phone: phoneSchema,
    acceptTerms: z
      .boolean()
      .refine((val) => val === true, "You must accept the terms and conditions"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// Forgot password form schema
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

// Reset password form schema
export const resetPasswordSchema = z
  .object({
    token: resetTokenSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// Update password form schema
export const updatePasswordSchema = z
  .object({
    currentPassword: basicPasswordSchema,
    newPassword: passwordSchema,
    confirmNewPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "New passwords do not match",
    path: ["confirmNewPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

// Profile update schema
export const profileUpdateSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  projectName: projectNameSchema,
});

// Type exports for TypeScript
export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>;
export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;

// Password strength checker
export const checkPasswordStrength = (password: string) => {
  const checks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: /[@$!%*?&]/.test(password),
  };

  const passedChecks = Object.values(checks).filter(Boolean).length;

  let strength: "weak" | "fair" | "good" | "strong" = "weak";
  let score = 0;

  if (passedChecks >= 5) {
    strength = "strong";
    score = 100;
  } else if (passedChecks >= 4) {
    strength = "good";
    score = 75;
  } else if (passedChecks >= 3) {
    strength = "fair";
    score = 50;
  } else {
    strength = "weak";
    score = 25;
  }

  return {
    strength,
    score,
    checks,
    passedChecks,
    suggestions: generatePasswordSuggestions(checks),
  };
};

const generatePasswordSuggestions = (checks: Record<string, boolean>) => {
  const suggestions = [];

  if (!checks.minLength) {
    suggestions.push("Use at least 8 characters");
  }
  if (!checks.hasUppercase) {
    suggestions.push("Include at least one uppercase letter (A-Z)");
  }
  if (!checks.hasLowercase) {
    suggestions.push("Include at least one lowercase letter (a-z)");
  }
  if (!checks.hasNumber) {
    suggestions.push("Include at least one number (0-9)");
  }
  if (!checks.hasSpecialChar) {
    suggestions.push("Include at least one special character (@$!%*?&)");
  }

  return suggestions;
};
