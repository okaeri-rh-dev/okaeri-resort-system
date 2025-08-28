/**
 * Authentication Validation Schema Tests
 * Comprehensive tests for all auth validation schemas with Philippine-specific data
 */

import { describe, it, expect } from "vitest";
import {
  emailSchema,
  passwordSchema,
  basicPasswordSchema,
  nameSchema,
  projectNameSchema,
  phoneSchema,
  resetTokenSchema,
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updatePasswordSchema,
  profileUpdateSchema,
  checkPasswordStrength,
} from "../auth";
import { philippineTestData } from "@tests/utils/test-utils";

describe("Auth Validation Schemas", () => {
  describe("emailSchema", () => {
    it("should validate correct email formats", () => {
      const validEmails = [
        "test@example.com",
        "user.name@domain.co.uk",
        "user+tag@example.org",
        "user123@example.com",
        "TEST@EXAMPLE.COM", // Should be converted to lowercase
        "  test@example.com  ", // Should be trimmed
        ...philippineTestData.validEmails,
      ];

      validEmails.forEach((email) => {
        const result = emailSchema.safeParse(email);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(email.toLowerCase().trim());
        }
      });
    });

    it("should reject invalid email formats", () => {
      const invalidEmails = [
        "",
        "invalid",
        "invalid@",
        "@invalid.com",
        "invalid@.com",
        "invalid@com.",
        "invalid..email@example.com",
        "invalid@example",
        "user@domain..com",
        `${"a".repeat(95)}@example.com`, // Too long
        null,
        undefined,
      ];

      invalidEmails.forEach((email) => {
        const result = emailSchema.safeParse(email);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0);
        }
      });
    });

    it("should handle email case normalization", () => {
      const testEmail = "Test.User+Tag@EXAMPLE.COM";
      const result = emailSchema.safeParse(testEmail);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("test.user+tag@example.com");
      }
    });

    it("should trim whitespace", () => {
      const result = emailSchema.safeParse("  test@example.com  ");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("test@example.com");
      }
    });
  });

  describe("passwordSchema (strong password)", () => {
    it("should validate strong passwords", () => {
      const validPasswords = [
        "StrongPass123!",
        "MyP@ssw0rd",
        "C0mpl3x!P@ssw0rd",
        "8CharPas!",
        "TestPassword123@",
        "Ph1l1pp1n3s!",
        "Okaeri2024#Resort",
      ];

      validPasswords.forEach((password) => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(true);
      });
    });

    it("should reject weak passwords", () => {
      const invalidPasswords = [
        "short", // Too short
        "nouppercase123!", // No uppercase
        "NOLOWERCASE123!", // No lowercase
        "NoNumbers!", // No numbers
        "NoSpecialChars123", // No special chars
        "a".repeat(130), // Too long
        "simplepass", // Too simple
        "", // Empty
      ];

      invalidPasswords.forEach((password) => {
        const result = passwordSchema.safeParse(password);
        expect(result.success).toBe(false);
      });
    });

    it("should validate password length requirements", () => {
      const sevenCharPassword = "Short1!";
      const eightCharPassword = "LongPass1!";
      const maxLengthPassword = `${"a".repeat(125)}A1!`;
      const tooLongPassword = "a".repeat(130);

      expect(passwordSchema.safeParse(sevenCharPassword).success).toBe(false);
      expect(passwordSchema.safeParse(eightCharPassword).success).toBe(true);
      expect(passwordSchema.safeParse(maxLengthPassword).success).toBe(true);
      expect(passwordSchema.safeParse(tooLongPassword).success).toBe(false);
    });
  });

  describe("basicPasswordSchema (for current password)", () => {
    it("should accept any non-empty password", () => {
      const passwords = ["simple", "123", "password", "any string here", "CurrentP@ss123!"];

      passwords.forEach((password) => {
        const result = basicPasswordSchema.safeParse(password);
        expect(result.success).toBe(true);
      });
    });

    it("should reject empty passwords", () => {
      const invalidPasswords = [
        "",
        null,
        undefined,
        "a".repeat(130), // Too long
      ];

      invalidPasswords.forEach((password) => {
        const result = basicPasswordSchema.safeParse(password);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("nameSchema (Philippine-specific)", () => {
    it("should validate Filipino names", () => {
      philippineTestData.validNames.forEach((name) => {
        const result = nameSchema.safeParse(name);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(name.trim());
        }
      });
    });

    it("should reject invalid names", () => {
      philippineTestData.invalidNames.forEach((name) => {
        const result = nameSchema.safeParse(name);
        expect(result.success).toBe(false);
      });
    });

    it("should handle special Filipino characters", () => {
      const filipinoNames = [
        "José María",
        "Niño Gabriel",
        "María Concepción",
        "Juan Paolo",
        "Ana Sofía",
        "Piña Colada", // Not a name but tests ñ
      ];

      filipinoNames.forEach((name) => {
        const result = nameSchema.safeParse(name);
        expect(result.success).toBe(true);
      });
    });

    it("should reject names with numbers or special characters", () => {
      const invalidNames = [
        "Juan123",
        "Maria@Santos",
        "John#Doe",
        "User_Name",
        "Name with * special",
        "Name with % percent",
      ];

      invalidNames.forEach((name) => {
        const result = nameSchema.safeParse(name);
        expect(result.success).toBe(false);
      });
    });

    it("should trim and validate minimum length", () => {
      const shortName = "A";
      const validName = "  Juan Dela Cruz  ";

      expect(nameSchema.safeParse(shortName).success).toBe(false);

      const result = nameSchema.safeParse(validName);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("Juan Dela Cruz");
      }
    });
  });

  describe("projectNameSchema", () => {
    it("should validate resort/project names", () => {
      philippineTestData.validProjectNames.forEach((projectName) => {
        const result = projectNameSchema.safeParse(projectName);
        expect(result.success).toBe(true);
      });
    });

    it("should be optional", () => {
      const result = projectNameSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });

    it("should handle empty string as valid", () => {
      const result = projectNameSchema.safeParse("");
      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });

    it("should reject invalid project names", () => {
      const invalidNames = [
        "Project@Name",
        "Project#Name",
        "Project*Name",
        "Project_Name_With_Underscores",
        "a".repeat(105), // Too long
      ];

      invalidNames.forEach((name) => {
        const result = projectNameSchema.safeParse(name);
        expect(result.success).toBe(false);
      });
    });

    it("should allow business-appropriate characters", () => {
      const validNames = [
        "Okaeri Beach Resort & Spa",
        "Paradise Bay Resort (Boracay)",
        "Sunset Villa-Palawan",
        "The Royal Garden Hotel",
        "Blue Waters Resort Co.",
        "Villa Esperanza 2024",
      ];

      validNames.forEach((name) => {
        const result = projectNameSchema.safeParse(name);
        expect(result.success).toBe(true);
      });
    });
  });

  describe("phoneSchema (Philippine numbers)", () => {
    it("should validate Philippine phone numbers", () => {
      philippineTestData.validPhoneNumbers.forEach((phone) => {
        const result = phoneSchema.safeParse(phone);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toMatch(/^\+639\d{9}$/);
        }
      });
    });

    it("should reject invalid phone numbers", () => {
      philippineTestData.invalidPhoneNumbers.forEach((phone) => {
        const result = phoneSchema.safeParse(phone);
        expect(result.success).toBe(false);
      });
    });

    it("should normalize phone number formats", () => {
      const testCases = [
        { input: "09171234567", expected: "+639171234567" },
        { input: "639171234567", expected: "+639171234567" },
        { input: "+639171234567", expected: "+639171234567" },
        { input: "9171234567", expected: "+639171234567" },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = phoneSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(expected);
        }
      });
    });

    it("should be optional", () => {
      const result = phoneSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });

    it("should handle Globe and Smart prefixes", () => {
      const validPrefixes = [
        "09171234567", // Globe
        "09281234567", // Smart
        "09351234567", // Globe
        "09391234567", // Smart
        "09951234567", // Globe
        "09981234567", // Smart
      ];

      validPrefixes.forEach((phone) => {
        const result = phoneSchema.safeParse(phone);
        expect(result.success).toBe(true);
      });
    });
  });

  describe("resetTokenSchema", () => {
    it("should validate reset tokens", () => {
      const validTokens = [
        "abc123def456",
        "reset-token-12345",
        "a".repeat(50),
        "TOKEN_WITH_UNDERSCORES",
        "token.with.dots",
      ];

      validTokens.forEach((token) => {
        const result = resetTokenSchema.safeParse(token);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid tokens", () => {
      const invalidTokens = [
        "",
        null,
        undefined,
        "a".repeat(501), // Too long
      ];

      invalidTokens.forEach((token) => {
        const result = resetTokenSchema.safeParse(token);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("loginSchema", () => {
    it("should validate complete login data", () => {
      const validData = {
        email: "test@okaeriresort.ph",
        password: "mypassword123",
        rememberMe: true,
      };

      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("test@okaeriresort.ph");
        expect(result.data.password).toBe("mypassword123");
        expect(result.data.rememberMe).toBe(true);
      }
    });

    it("should have default value for rememberMe", () => {
      const data = {
        email: "test@example.com",
        password: "password123",
      };

      const result = loginSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rememberMe).toBe(false);
      }
    });

    it("should reject invalid login data", () => {
      const invalidData = [
        { email: "invalid", password: "pass" },
        { email: "", password: "" },
        { password: "onlypassword" },
        { email: "only@email.com" },
      ];

      invalidData.forEach((data) => {
        const result = loginSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("registerSchema", () => {
    it("should validate complete registration data", () => {
      const validData = {
        name: "Juan Dela Cruz",
        email: "juan@okaeriresort.ph",
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
        projectName: "Okaeri Beach Resort",
        phone: "+639171234567",
        acceptTerms: true,
      };

      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject mismatched passwords", () => {
      const data = {
        name: "Juan Dela Cruz",
        email: "juan@example.com",
        password: "StrongPassword123!",
        confirmPassword: "DifferentPassword456!",
        acceptTerms: true,
      };

      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) => issue.message === "Passwords do not match")
        ).toBe(true);
      }
    });

    it("should require terms acceptance", () => {
      const data = {
        name: "Juan Dela Cruz",
        email: "juan@example.com",
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
        acceptTerms: false,
      };

      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) => issue.message === "You must accept the terms and conditions"
          )
        ).toBe(true);
      }
    });

    it("should work with optional fields", () => {
      const data = {
        name: "Maria Santos",
        email: "maria@example.com",
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
        acceptTerms: true,
      };

      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("forgotPasswordSchema", () => {
    it("should validate forgot password data", () => {
      const validData = {
        email: "forgot@example.com",
      };

      const result = forgotPasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const invalidData = {
        email: "invalid-email",
      };

      const result = forgotPasswordSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("resetPasswordSchema", () => {
    it("should validate reset password data", () => {
      const validData = {
        token: "valid-reset-token-123",
        password: "NewStrongPassword123!",
        confirmPassword: "NewStrongPassword123!",
      };

      const result = resetPasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject mismatched passwords", () => {
      const data = {
        token: "valid-token",
        password: "Password123!",
        confirmPassword: "Different123!",
      };

      const result = resetPasswordSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) => issue.message === "Passwords do not match")
        ).toBe(true);
      }
    });
  });

  describe("updatePasswordSchema", () => {
    it("should validate password update data", () => {
      const validData = {
        currentPassword: "oldpassword",
        newPassword: "NewStrongPassword123!",
        confirmNewPassword: "NewStrongPassword123!",
      };

      const result = updatePasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject same current and new passwords", () => {
      const data = {
        currentPassword: "SamePassword123!",
        newPassword: "SamePassword123!",
        confirmNewPassword: "SamePassword123!",
      };

      const result = updatePasswordSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) => issue.message === "New password must be different from current password"
          )
        ).toBe(true);
      }
    });

    it("should reject mismatched new passwords", () => {
      const data = {
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword123!",
        confirmNewPassword: "DifferentPassword123!",
      };

      const result = updatePasswordSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) => issue.message === "New passwords do not match")
        ).toBe(true);
      }
    });
  });

  describe("profileUpdateSchema", () => {
    it("should validate profile update data", () => {
      const validData = {
        name: "Updated Name",
        email: "updated@example.com",
        phone: "+639171234567",
        projectName: "Updated Resort Name",
      };

      const result = profileUpdateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should work with partial data", () => {
      const partialData = {
        name: "New Name Only",
        email: "newemail@example.com",
      };

      const result = profileUpdateSchema.safeParse(partialData);
      expect(result.success).toBe(true);
    });
  });

  describe("checkPasswordStrength", () => {
    it("should return strong for complex passwords", () => {
      const strongPasswords = ["ComplexPassword123!", "MyStr0ng@P@ssw0rd", "Secure123#Password"];

      strongPasswords.forEach((password) => {
        const result = checkPasswordStrength(password);
        expect(result.strength).toBe("strong");
        expect(result.score).toBe(100);
        expect(result.passedChecks).toBe(5);
        expect(result.suggestions).toHaveLength(0);
      });
    });

    it("should return weak for simple passwords", () => {
      const weakPasswords = ["password", "123456", "simple"];

      weakPasswords.forEach((password) => {
        const result = checkPasswordStrength(password);
        expect(result.strength).toBe("weak");
        expect(result.score).toBe(25);
        expect(result.passedChecks).toBeLessThan(3);
        expect(result.suggestions.length).toBeGreaterThan(0);
      });
    });

    it("should return good for decent passwords", () => {
      const goodPassword = "Password123!"; // 4 criteria met
      const result = checkPasswordStrength(goodPassword);

      expect(result.strength).toBe("good");
      expect(result.score).toBe(75);
      expect(result.passedChecks).toBe(4);
    });

    it("should return fair for mediocre passwords", () => {
      const fairPassword = "Password123"; // 3 criteria met
      const result = checkPasswordStrength(fairPassword);

      expect(result.strength).toBe("fair");
      expect(result.score).toBe(50);
      expect(result.passedChecks).toBe(3);
    });

    it("should provide helpful suggestions", () => {
      const weakPassword = "pass";
      const result = checkPasswordStrength(weakPassword);

      expect(result.suggestions).toContain("Use at least 8 characters");
      expect(result.suggestions).toContain("Include at least one uppercase letter (A-Z)");
      expect(result.suggestions).toContain("Include at least one number (0-9)");
      expect(result.suggestions).toContain("Include at least one special character (@$!%*?&)");
    });

    it("should check individual criteria", () => {
      const testCases = [
        {
          password: "toolong",
          checks: {
            minLength: false,
            hasUppercase: false,
            hasLowercase: true,
            hasNumber: false,
            hasSpecialChar: false,
          },
        },
        {
          password: "UPPERCASE123!",
          checks: {
            minLength: true,
            hasUppercase: true,
            hasLowercase: false,
            hasNumber: true,
            hasSpecialChar: true,
          },
        },
        {
          password: "lowercase123!",
          checks: {
            minLength: true,
            hasUppercase: false,
            hasLowercase: true,
            hasNumber: true,
            hasSpecialChar: true,
          },
        },
        {
          password: "NoNumbers!",
          checks: {
            minLength: true,
            hasUppercase: true,
            hasLowercase: true,
            hasNumber: false,
            hasSpecialChar: true,
          },
        },
        {
          password: "NoSpecialChars123",
          checks: {
            minLength: true,
            hasUppercase: true,
            hasLowercase: true,
            hasNumber: true,
            hasSpecialChar: false,
          },
        },
      ];

      testCases.forEach(({ password, checks }) => {
        const result = checkPasswordStrength(password);
        expect(result.checks).toEqual(checks);
      });
    });

    it("should handle edge cases", () => {
      const edgeCases = [
        "",
        " ",
        "a",
        "A1!a", // Exactly meets minimum length
      ];

      edgeCases.forEach((password) => {
        const result = checkPasswordStrength(password);
        expect(result).toHaveProperty("strength");
        expect(result).toHaveProperty("score");
        expect(result).toHaveProperty("checks");
        expect(result).toHaveProperty("passedChecks");
        expect(result).toHaveProperty("suggestions");
        expect(Array.isArray(result.suggestions)).toBe(true);
      });
    });
  });

  describe("Schema Error Messages", () => {
    it("should provide clear error messages for email validation", () => {
      const result = emailSchema.safeParse("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Email is required");
      }

      const result2 = emailSchema.safeParse("invalid");
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error.issues[0].message).toBe("Please enter a valid email address");
      }
    });

    it("should provide clear error messages for password validation", () => {
      const result = passwordSchema.safeParse("short");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Password must be at least 8 characters");
      }

      const result2 = passwordSchema.safeParse("nouppercase123!");
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error.issues[0].message).toContain("Password must contain at least");
      }
    });

    it("should provide clear error messages for name validation", () => {
      const result = nameSchema.safeParse("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Name is required");
      }

      const result2 = nameSchema.safeParse("Name123");
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(result2.error.issues[0].message).toContain("Name can only contain");
      }
    });

    it("should provide clear error messages for phone validation", () => {
      const result = phoneSchema.safeParse("1234567890");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Please enter a valid Philippine phone number");
      }
    });
  });

  describe("Schema Type Safety", () => {
    it("should infer correct types from schemas", () => {
      const loginData = {
        email: "test@example.com",
        password: "password123",
        rememberMe: true,
      };

      const result = loginSchema.safeParse(loginData);
      if (result.success) {
        // These should be properly typed
        const { email } = result.data;
        const { password } = result.data;
        const { rememberMe } = result.data;

        expect(typeof email).toBe("string");
        expect(typeof password).toBe("string");
        expect(typeof rememberMe).toBe("boolean");
      }
    });
  });
});
