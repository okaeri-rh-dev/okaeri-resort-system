/**
 * RegisterForm Component Tests
 * Comprehensive tests including form validation, password strength, accessibility, and user interactions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterForm } from "@/components/auth/RegisterForm";
import {
  renderWithProviders,
  MOCK_AUTH_STATES,
  TEST_IDS,
  formHelpers,
  checkA11y,
  philippineTestData,
} from "@tests/utils/test-utils";

// Mock TanStack Router
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, className, ...props }: any) => (
    <a href={to} className={className} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

// Mock auth store
const mockRegister = vi.fn();
const mockClearError = vi.fn();

vi.mock("@/stores/authStore", () => ({
  useAuthStore: vi.fn(() => ({
    register: mockRegister,
    isLoading: false,
    error: null,
    clearError: mockClearError,
  })),
}));

import { useAuthStore } from "@/stores/authStore";

describe("RegisterForm Component", () => {
  const user = userEvent.setup();

  const validRegistrationData = {
    name: "Juan Dela Cruz",
    email: "juan@okaeriresort.ph",
    password: "StrongPassword123!",
    confirmPassword: "StrongPassword123!",
    projectName: "Okaeri Beach Resort",
    phone: "+639171234567",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementation
    (useAuthStore as any).mockReturnValue({
      register: mockRegister,
      isLoading: false,
      error: null,
      clearError: mockClearError,
    });
  });

  describe("Rendering and Initial State", () => {
    it("should render all form elements correctly", () => {
      renderWithProviders(<RegisterForm />);

      // Check title and description
      expect(screen.getByText("Create Your Resort Account")).toBeInTheDocument();
      expect(screen.getByText(/Join Okaeri to start managing your resort/i)).toBeInTheDocument();

      // Check form fields
      expect(screen.getByLabelText("Full Name")).toBeInTheDocument();
      expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
      expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
      expect(screen.getByLabelText("Resort/Project Name")).toBeInTheDocument();
      expect(screen.getByLabelText("Phone Number")).toBeInTheDocument();
      expect(screen.getByLabelText(/I agree to the Terms/)).toBeInTheDocument();

      // Check buttons and links
      expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
      expect(screen.getByText("Already have an account?")).toBeInTheDocument();
      expect(screen.getByText("Sign in here")).toBeInTheDocument();
    });

    it("should have proper form field attributes", () => {
      renderWithProviders(<RegisterForm />);

      const nameInput = screen.getByLabelText("Full Name");
      const emailInput = screen.getByLabelText("Email Address");
      const passwordInput = screen.getByLabelText("Password");
      const confirmPasswordInput = screen.getByLabelText("Confirm Password");
      const phoneInput = screen.getByLabelText("Phone Number");
      const termsCheckbox = screen.getByLabelText(/I agree to the Terms/);

      // Name field attributes
      expect(nameInput).toHaveAttribute("type", "text");
      expect(nameInput).toHaveAttribute("autoComplete", "name");
      expect(nameInput).toHaveAttribute("placeholder", "Enter your full name");

      // Email field attributes
      expect(emailInput).toHaveAttribute("type", "email");
      expect(emailInput).toHaveAttribute("autoComplete", "email");
      expect(emailInput).toHaveAttribute("autoCapitalize", "none");

      // Password fields
      expect(passwordInput).toHaveAttribute("type", "password");
      expect(passwordInput).toHaveAttribute("autoComplete", "new-password");
      expect(confirmPasswordInput).toHaveAttribute("type", "password");
      expect(confirmPasswordInput).toHaveAttribute("autoComplete", "new-password");

      // Phone field
      expect(phoneInput).toHaveAttribute("type", "tel");
      expect(phoneInput).toHaveAttribute("placeholder", "+63 917 123 4567");

      // Terms checkbox
      expect(termsCheckbox).toHaveAttribute("type", "checkbox");
    });

    it("should pass accessibility audit", async () => {
      const { container } = renderWithProviders(<RegisterForm />);
      await checkA11y(container);
    });
  });

  describe("Form Validation", () => {
    it("should validate required fields", async () => {
      renderWithProviders(<RegisterForm />);

      const submitButton = screen.getByRole("button", { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Name is required")).toBeInTheDocument();
        expect(screen.getByText("Email is required")).toBeInTheDocument();
        expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
        expect(screen.getByText("Please confirm your password")).toBeInTheDocument();
        expect(screen.getByText("You must accept the terms and conditions")).toBeInTheDocument();
      });

      expect(mockRegister).not.toHaveBeenCalled();
    });

    it("should validate email format", async () => {
      renderWithProviders(<RegisterForm />);

      const emailInput = screen.getByLabelText("Email Address");
      const submitButton = screen.getByRole("button", { name: /create account/i });

      await user.type(emailInput, "invalid-email");
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Please enter a valid email address")).toBeInTheDocument();
      });
    });

    it("should validate password strength requirements", async () => {
      renderWithProviders(<RegisterForm />);

      const passwordInput = screen.getByLabelText("Password");
      const submitButton = screen.getByRole("button", { name: /create account/i });

      // Test weak password
      await user.type(passwordInput, "weak");
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Password must contain at least one uppercase letter/)
        ).toBeInTheDocument();
      });
    });

    it("should validate password confirmation match", async () => {
      renderWithProviders(<RegisterForm />);

      const passwordInput = screen.getByLabelText("Password");
      const confirmPasswordInput = screen.getByLabelText("Confirm Password");
      const submitButton = screen.getByRole("button", { name: /create account/i });

      await user.type(passwordInput, "StrongPassword123!");
      await user.type(confirmPasswordInput, "DifferentPassword456!");
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
      });
    });

    it("should validate Filipino names", async () => {
      renderWithProviders(<RegisterForm />);

      const nameInput = screen.getByLabelText("Full Name");

      // Test valid Filipino names
      for (const name of philippineTestData.validNames) {
        await user.clear(nameInput);
        await user.type(nameInput, name);

        // Should not show validation error
        expect(screen.queryByText(/Name can only contain/)).not.toBeInTheDocument();
      }

      // Test invalid names
      for (const name of philippineTestData.invalidNames.slice(0, 2)) {
        // Test first 2 to avoid too many tests
        await user.clear(nameInput);
        await user.type(nameInput, name);
        await user.tab(); // Trigger validation

        if (name.length > 0) {
          // Skip empty string test
          await waitFor(() => {
            expect(screen.getByText(/Name can only contain/)).toBeInTheDocument();
          });
        }
      }
    });

    it("should validate Philippine phone numbers", async () => {
      renderWithProviders(<RegisterForm />);

      const phoneInput = screen.getByLabelText("Phone Number");

      // Test valid phone numbers
      for (const phone of philippineTestData.validPhoneNumbers) {
        await user.clear(phoneInput);
        await user.type(phoneInput, phone);

        // Should not show validation error
        expect(
          screen.queryByText(/Please enter a valid Philippine phone number/)
        ).not.toBeInTheDocument();
      }

      // Test invalid phone numbers
      for (const phone of philippineTestData.invalidPhoneNumbers.slice(0, 2)) {
        await user.clear(phoneInput);
        await user.type(phoneInput, phone);
        await user.tab(); // Trigger validation

        await waitFor(() => {
          expect(
            screen.getByText("Please enter a valid Philippine phone number")
          ).toBeInTheDocument();
        });
      }
    });

    it("should require terms acceptance", async () => {
      renderWithProviders(<RegisterForm />);

      // Fill all required fields except terms
      await user.type(screen.getByLabelText("Full Name"), validRegistrationData.name);
      await user.type(screen.getByLabelText("Email Address"), validRegistrationData.email);
      await user.type(screen.getByLabelText("Password"), validRegistrationData.password);
      await user.type(
        screen.getByLabelText("Confirm Password"),
        validRegistrationData.confirmPassword
      );

      await user.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText("You must accept the terms and conditions")).toBeInTheDocument();
      });
    });
  });

  describe("Password Strength Indicator", () => {
    it("should show password strength indicator", async () => {
      renderWithProviders(<RegisterForm />);

      const passwordInput = screen.getByLabelText("Password");

      // Type a weak password
      await user.type(passwordInput, "weak");

      // Should show strength indicator
      await waitFor(() => {
        expect(screen.getByTestId("password-strength")).toBeInTheDocument();
        expect(screen.getByText(/weak/i)).toBeInTheDocument();
      });
    });

    it("should update strength indicator dynamically", async () => {
      renderWithProviders(<RegisterForm />);

      const passwordInput = screen.getByLabelText("Password");

      // Start with weak password
      await user.type(passwordInput, "weak");
      await waitFor(() => {
        expect(screen.getByText(/weak/i)).toBeInTheDocument();
      });

      // Improve to strong password
      await user.clear(passwordInput);
      await user.type(passwordInput, "StrongPassword123!");

      await waitFor(() => {
        expect(screen.getByText(/strong/i)).toBeInTheDocument();
      });
    });

    it("should show password requirements", async () => {
      renderWithProviders(<RegisterForm />);

      const passwordInput = screen.getByLabelText("Password");

      await user.type(passwordInput, "incomplete");

      await waitFor(() => {
        expect(screen.getByTestId("password-requirements")).toBeInTheDocument();
        expect(screen.getByText(/Include at least one uppercase letter/)).toBeInTheDocument();
        expect(screen.getByText(/Include at least one number/)).toBeInTheDocument();
        expect(screen.getByText(/Include at least one special character/)).toBeInTheDocument();
      });
    });

    it("should hide requirements when password is strong", async () => {
      renderWithProviders(<RegisterForm />);

      const passwordInput = screen.getByLabelText("Password");

      await user.type(passwordInput, "StrongPassword123!");

      await waitFor(() => {
        expect(screen.getByText(/strong/i)).toBeInTheDocument();
        expect(screen.queryByText(/Include at least one uppercase letter/)).not.toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should toggle password visibility", async () => {
      renderWithProviders(<RegisterForm />);

      const passwordInput = screen.getByLabelText("Password");
      const passwordToggle = screen
        .getAllByLabelText(/password/i)
        .find((el) => el.getAttribute("aria-label")?.includes("Show"));

      // Initially password should be hidden
      expect(passwordInput).toHaveAttribute("type", "password");

      // Click toggle to show password
      if (passwordToggle) {
        await user.click(passwordToggle);
        expect(passwordInput).toHaveAttribute("type", "text");
      }
    });

    it("should handle phone number formatting", async () => {
      renderWithProviders(<RegisterForm />);

      const phoneInput = screen.getByLabelText("Phone Number");

      // Type a raw Philippine number
      await user.type(phoneInput, "9171234567");

      // Should format to proper Philippine format
      await waitFor(() => {
        expect(phoneInput).toHaveValue("+639171234567");
      });
    });

    it("should submit form with valid data", async () => {
      renderWithProviders(<RegisterForm />);

      // Fill all form fields
      await user.type(screen.getByLabelText("Full Name"), validRegistrationData.name);
      await user.type(screen.getByLabelText("Email Address"), validRegistrationData.email);
      await user.type(screen.getByLabelText("Password"), validRegistrationData.password);
      await user.type(
        screen.getByLabelText("Confirm Password"),
        validRegistrationData.confirmPassword
      );
      await user.type(
        screen.getByLabelText("Resort/Project Name"),
        validRegistrationData.projectName
      );
      await user.type(screen.getByLabelText("Phone Number"), validRegistrationData.phone);
      await user.click(screen.getByLabelText(/I agree to the Terms/));

      await user.click(screen.getByRole("button", { name: /create account/i }));

      expect(mockClearError).toHaveBeenCalled();
      expect(mockRegister).toHaveBeenCalledWith({
        name: validRegistrationData.name,
        email: validRegistrationData.email.toLowerCase(),
        password: validRegistrationData.password,
        projectName: validRegistrationData.projectName,
        phone: validRegistrationData.phone,
      });
    });

    it("should handle form submission with Enter key", async () => {
      renderWithProviders(<RegisterForm />);

      // Fill required fields
      await user.type(screen.getByLabelText("Full Name"), validRegistrationData.name);
      await user.type(screen.getByLabelText("Email Address"), validRegistrationData.email);
      await user.type(screen.getByLabelText("Password"), validRegistrationData.password);
      await user.type(
        screen.getByLabelText("Confirm Password"),
        validRegistrationData.confirmPassword
      );
      await user.click(screen.getByLabelText(/I agree to the Terms/));

      await user.keyboard("{Enter}");

      expect(mockRegister).toHaveBeenCalled();
    });

    it("should work with optional fields empty", async () => {
      renderWithProviders(<RegisterForm />);

      // Fill only required fields
      await user.type(screen.getByLabelText("Full Name"), validRegistrationData.name);
      await user.type(screen.getByLabelText("Email Address"), validRegistrationData.email);
      await user.type(screen.getByLabelText("Password"), validRegistrationData.password);
      await user.type(
        screen.getByLabelText("Confirm Password"),
        validRegistrationData.confirmPassword
      );
      await user.click(screen.getByLabelText(/I agree to the Terms/));

      await user.click(screen.getByRole("button", { name: /create account/i }));

      expect(mockRegister).toHaveBeenCalledWith({
        name: validRegistrationData.name,
        email: validRegistrationData.email.toLowerCase(),
        password: validRegistrationData.password,
      });
    });
  });

  describe("Loading States", () => {
    it("should show loading state during form submission", async () => {
      (useAuthStore as any).mockReturnValue({
        register: mockRegister,
        isLoading: true,
        error: null,
        clearError: mockClearError,
      });

      renderWithProviders(<RegisterForm />);

      // Check loading state
      expect(screen.getByText("Creating Account...")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /creating account/i })).toBeDisabled();

      // Check that form fields are disabled
      expect(screen.getByLabelText("Full Name")).toBeDisabled();
      expect(screen.getByLabelText("Email Address")).toBeDisabled();
      expect(screen.getByLabelText("Password")).toBeDisabled();
    });

    it("should disable password toggles during loading", () => {
      (useAuthStore as any).mockReturnValue({
        register: mockRegister,
        isLoading: true,
        error: null,
        clearError: mockClearError,
      });

      renderWithProviders(<RegisterForm />);

      const passwordToggles = screen
        .getAllByLabelText(/password/i)
        .filter((el) => el.getAttribute("aria-label")?.includes("Show"));

      passwordToggles.forEach((toggle) => {
        expect(toggle).toBeDisabled();
      });
    });
  });

  describe("Error Handling", () => {
    it("should display global error from auth store", () => {
      (useAuthStore as any).mockReturnValue({
        register: mockRegister,
        isLoading: false,
        error: "Registration failed. Email already exists.",
        clearError: mockClearError,
      });

      renderWithProviders(<RegisterForm />);

      expect(screen.getByText("Registration failed. Email already exists.")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("should handle registration errors", async () => {
      mockRegister.mockRejectedValueOnce(new Error("Email already exists"));

      renderWithProviders(<RegisterForm />);

      // Fill and submit form
      await user.type(screen.getByLabelText("Full Name"), validRegistrationData.name);
      await user.type(screen.getByLabelText("Email Address"), "existing@example.com");
      await user.type(screen.getByLabelText("Password"), validRegistrationData.password);
      await user.type(
        screen.getByLabelText("Confirm Password"),
        validRegistrationData.confirmPassword
      );
      await user.click(screen.getByLabelText(/I agree to the Terms/));

      await user.click(screen.getByRole("button", { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText("Email already exists")).toBeInTheDocument();
      });
    });

    it("should clear errors when form is resubmitted", async () => {
      renderWithProviders(<RegisterForm />);

      await user.type(screen.getByLabelText("Full Name"), validRegistrationData.name);
      await user.type(screen.getByLabelText("Email Address"), validRegistrationData.email);
      await user.type(screen.getByLabelText("Password"), validRegistrationData.password);
      await user.type(
        screen.getByLabelText("Confirm Password"),
        validRegistrationData.confirmPassword
      );
      await user.click(screen.getByLabelText(/I agree to the Terms/));

      await user.click(screen.getByRole("button", { name: /create account/i }));

      expect(mockClearError).toHaveBeenCalled();
    });
  });

  describe("Accessibility Features", () => {
    it("should have proper heading structure", () => {
      renderWithProviders(<RegisterForm />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveTextContent("Create Your Resort Account");
    });

    it("should have proper form labels", () => {
      renderWithProviders(<RegisterForm />);

      const requiredFields = ["Full Name", "Email Address", "Password", "Confirm Password"];

      requiredFields.forEach((label) => {
        expect(screen.getByLabelText(label)).toBeInTheDocument();
      });
    });

    it("should have proper error associations", async () => {
      renderWithProviders(<RegisterForm />);

      const submitButton = screen.getByRole("button", { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        const nameInput = screen.getByLabelText("Full Name");
        const emailInput = screen.getByLabelText("Email Address");

        expect(nameInput).toHaveAttribute("aria-describedby", expect.stringContaining("error"));
        expect(emailInput).toHaveAttribute("aria-describedby", expect.stringContaining("error"));
      });
    });

    it("should support keyboard navigation", async () => {
      renderWithProviders(<RegisterForm />);

      // Tab through form elements
      await user.tab();
      expect(screen.getByLabelText("Full Name")).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText("Email Address")).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText("Password")).toHaveFocus();
    });

    it("should announce password strength to screen readers", async () => {
      renderWithProviders(<RegisterForm />);

      const passwordInput = screen.getByLabelText("Password");
      await user.type(passwordInput, "weak");

      await waitFor(() => {
        const strengthIndicator = screen.getByTestId("password-strength");
        expect(strengthIndicator).toHaveAttribute("aria-live", "polite");
      });
    });
  });

  describe("Security Features", () => {
    it("should have proper autocomplete attributes", () => {
      renderWithProviders(<RegisterForm />);

      expect(screen.getByLabelText("Full Name")).toHaveAttribute("autoComplete", "name");
      expect(screen.getByLabelText("Email Address")).toHaveAttribute("autoComplete", "email");
      expect(screen.getByLabelText("Password")).toHaveAttribute("autoComplete", "new-password");
      expect(screen.getByLabelText("Confirm Password")).toHaveAttribute(
        "autoComplete",
        "new-password"
      );
    });

    it("should prevent email capitalization", () => {
      renderWithProviders(<RegisterForm />);

      const emailInput = screen.getByLabelText("Email Address");
      expect(emailInput).toHaveAttribute("autoCapitalize", "none");
    });

    it("should use proper input types", () => {
      renderWithProviders(<RegisterForm />);

      expect(screen.getByLabelText("Full Name")).toHaveAttribute("type", "text");
      expect(screen.getByLabelText("Email Address")).toHaveAttribute("type", "email");
      expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
      expect(screen.getByLabelText("Phone Number")).toHaveAttribute("type", "tel");
    });
  });

  describe("Mobile Responsiveness", () => {
    it("should have responsive classes", () => {
      const { container } = renderWithProviders(<RegisterForm />);

      const card = container.querySelector(".max-w-md");
      expect(card).toHaveClass("w-full", "max-w-md", "mx-auto");
    });

    it("should handle mobile form interactions", async () => {
      // Mock mobile viewport
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithProviders(<RegisterForm />);

      const emailInput = screen.getByLabelText("Email Address");
      await user.type(emailInput, "mobile@test.com");

      expect(emailInput).toHaveValue("mobile@test.com");
    });
  });

  describe("Performance", () => {
    it("should not cause excessive re-renders", async () => {
      const renderCount = vi.fn();

      function TestWrapper() {
        renderCount();
        return <RegisterForm />;
      }

      renderWithProviders(<TestWrapper />);

      const initialRenderCount = renderCount.mock.calls.length;

      // Type in name field
      const nameInput = screen.getByLabelText("Full Name");
      await user.type(nameInput, "Test Name");

      // Should not cause excessive re-renders
      expect(renderCount.mock.calls.length - initialRenderCount).toBeLessThan(50);
    });
  });
});
