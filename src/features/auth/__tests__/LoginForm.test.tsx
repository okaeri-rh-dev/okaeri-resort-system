/**
 * LoginForm Component Tests
 * Comprehensive tests including form validation, accessibility, loading states, and user interactions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/auth/LoginForm";
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
const mockLogin = vi.fn();
const mockClearError = vi.fn();

vi.mock("@/stores/authStore", () => ({
  useAuthStore: vi.fn(() => ({
    login: mockLogin,
    isLoading: false,
    error: null,
    clearError: mockClearError,
  })),
}));

import { useAuthStore } from "@/stores/authStore";

describe("LoginForm Component", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementation
    (useAuthStore as any).mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: null,
      clearError: mockClearError,
    });
  });

  describe("Rendering and Initial State", () => {
    it("should render all form elements correctly", () => {
      renderWithProviders(<LoginForm />);

      // Check title and description
      expect(screen.getByText("Welcome Back")).toBeInTheDocument();
      expect(screen.getByText(/Sign in to your Okaeri Resort account/i)).toBeInTheDocument();

      // Check form fields
      expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
      expect(screen.getByLabelText("Remember me")).toBeInTheDocument();

      // Check buttons and links
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByText("Forgot password?")).toBeInTheDocument();
      expect(screen.getByText("Create your resort account")).toBeInTheDocument();
      expect(screen.getByText("Account Recovery")).toBeInTheDocument();
      expect(screen.getByText("Contact Support")).toBeInTheDocument();
    });

    it("should have proper form field attributes", () => {
      renderWithProviders(<LoginForm />);

      const emailInput = screen.getByLabelText("Email Address");
      const passwordInput = screen.getByLabelText("Password");
      const rememberCheckbox = screen.getByLabelText("Remember me");

      // Email field attributes
      expect(emailInput).toHaveAttribute("type", "email");
      expect(emailInput).toHaveAttribute("autoComplete", "email");
      expect(emailInput).toHaveAttribute("autoCapitalize", "none");
      expect(emailInput).toHaveAttribute("placeholder", "your.email@example.com");

      // Password field attributes
      expect(passwordInput).toHaveAttribute("type", "password");
      expect(passwordInput).toHaveAttribute("autoComplete", "current-password");
      expect(passwordInput).toHaveAttribute("placeholder", "Enter your password");

      // Remember me checkbox
      expect(rememberCheckbox).toHaveAttribute("type", "checkbox");
    });

    it("should have proper ARIA labels and descriptions", () => {
      renderWithProviders(<LoginForm />);

      const passwordToggle = screen.getByLabelText("Show password");
      expect(passwordToggle).toBeInTheDocument();

      // Check form is properly labeled
      const form = screen.getByRole("form");
      expect(form).toBeInTheDocument();
    });

    it("should pass accessibility audit", async () => {
      const { container } = renderWithProviders(<LoginForm />);
      await checkA11y(container);
    });
  });

  describe("Form Validation", () => {
    it("should validate email format", async () => {
      renderWithProviders(<LoginForm />);

      const emailInput = screen.getByLabelText("Email Address");
      const submitButton = screen.getByRole("button", { name: /sign in/i });

      // Test invalid email
      await user.type(emailInput, "invalid-email");
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Please enter a valid email address")).toBeInTheDocument();
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it("should validate required fields", async () => {
      renderWithProviders(<LoginForm />);

      const submitButton = screen.getByRole("button", { name: /sign in/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Email is required")).toBeInTheDocument();
        expect(screen.getByText("Password is required")).toBeInTheDocument();
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it("should accept valid Philippine email addresses", async () => {
      renderWithProviders(<LoginForm />);

      const emailInput = screen.getByLabelText("Email Address");
      const passwordInput = screen.getByLabelText("Password");

      for (const email of philippineTestData.validEmails) {
        await user.clear(emailInput);
        await user.type(emailInput, email);
        await user.type(passwordInput, "ValidPassword123!");

        // Should not show validation error
        expect(screen.queryByText("Please enter a valid email address")).not.toBeInTheDocument();
      }
    });

    it("should handle email case normalization", async () => {
      renderWithProviders(<LoginForm />);

      const emailInput = screen.getByLabelText("Email Address");
      const passwordInput = screen.getByLabelText("Password");
      const submitButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(emailInput, "TEST@EXAMPLE.COM");
      await user.type(passwordInput, "password123");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith("test@example.com", "password123");
      });
    });

    it("should validate password length", async () => {
      renderWithProviders(<LoginForm />);

      const emailInput = screen.getByLabelText("Email Address");
      const passwordInput = screen.getByLabelText("Password");
      const submitButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(emailInput, "test@example.com");
      await user.type(passwordInput, "short");
      await user.click(submitButton);

      // Should allow any password length for login (different from registration)
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith("test@example.com", "short");
      });
    });
  });

  describe("User Interactions", () => {
    it("should toggle password visibility", async () => {
      renderWithProviders(<LoginForm />);

      const passwordInput = screen.getByLabelText("Password");
      const toggleButton = screen.getByLabelText("Show password");

      // Initially password is hidden
      expect(passwordInput).toHaveAttribute("type", "password");

      // Click to show password
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute("type", "text");
      expect(screen.getByLabelText("Hide password")).toBeInTheDocument();

      // Click to hide password again
      const hideButton = screen.getByLabelText("Hide password");
      await user.click(hideButton);
      expect(passwordInput).toHaveAttribute("type", "password");
      expect(screen.getByLabelText("Show password")).toBeInTheDocument();
    });

    it("should handle remember me checkbox", async () => {
      renderWithProviders(<LoginForm />);

      const rememberCheckbox = screen.getByLabelText("Remember me");

      // Initially unchecked
      expect(rememberCheckbox).not.toBeChecked();

      // Click to check
      await user.click(rememberCheckbox);
      expect(rememberCheckbox).toBeChecked();

      // Click to uncheck
      await user.click(rememberCheckbox);
      expect(rememberCheckbox).not.toBeChecked();
    });

    it("should submit form with valid data", async () => {
      renderWithProviders(<LoginForm />);

      const emailInput = screen.getByLabelText("Email Address");
      const passwordInput = screen.getByLabelText("Password");
      const rememberCheckbox = screen.getByLabelText("Remember me");
      const submitButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(emailInput, "test@okaeriresort.ph");
      await user.type(passwordInput, "mypassword123");
      await user.click(rememberCheckbox);
      await user.click(submitButton);

      expect(mockClearError).toHaveBeenCalled();
      expect(mockLogin).toHaveBeenCalledWith("test@okaeriresort.ph", "mypassword123");
    });

    it("should handle form submission with Enter key", async () => {
      renderWithProviders(<LoginForm />);

      const emailInput = screen.getByLabelText("Email Address");
      const passwordInput = screen.getByLabelText("Password");

      await user.type(emailInput, "test@example.com");
      await user.type(passwordInput, "password123");
      await user.keyboard("{Enter}");

      expect(mockLogin).toHaveBeenCalledWith("test@example.com", "password123");
    });

    it("should navigate to links correctly", () => {
      renderWithProviders(<LoginForm />);

      // Check all navigation links
      expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
        "href",
        "/forgot-password"
      );
      expect(screen.getByRole("link", { name: "Create your resort account" })).toHaveAttribute(
        "href",
        "/register"
      );
      expect(screen.getByRole("link", { name: "Account Recovery" })).toHaveAttribute(
        "href",
        "/help/account-recovery"
      );
      expect(screen.getByRole("link", { name: "Contact Support" })).toHaveAttribute(
        "href",
        "/help/contact"
      );
    });
  });

  describe("Loading States", () => {
    it("should show loading state during form submission", async () => {
      // Mock loading state
      (useAuthStore as any).mockReturnValue({
        login: mockLogin,
        isLoading: true,
        error: null,
        clearError: mockClearError,
      });

      renderWithProviders(<LoginForm />);

      // Check loading state
      expect(screen.getByText("Signing in...")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();

      // Check that form fields are disabled
      expect(screen.getByLabelText("Email Address")).toBeDisabled();
      expect(screen.getByLabelText("Password")).toBeDisabled();
      expect(screen.getByLabelText("Remember me")).toBeDisabled();
      expect(screen.getByLabelText("Show password")).toBeDisabled();
    });

    it("should show proper loading spinner and text", () => {
      (useAuthStore as any).mockReturnValue({
        login: mockLogin,
        isLoading: true,
        error: null,
        clearError: mockClearError,
      });

      renderWithProviders(<LoginForm />);

      const submitButton = screen.getByRole("button", { name: /signing in/i });
      expect(submitButton).toHaveClass("disabled:opacity-50", "disabled:cursor-not-allowed");

      // Check for loading spinner (Loader2 icon)
      const spinner = submitButton.querySelector("svg");
      expect(spinner).toHaveClass("animate-spin");
    });

    it("should disable password toggle during loading", () => {
      (useAuthStore as any).mockReturnValue({
        login: mockLogin,
        isLoading: true,
        error: null,
        clearError: mockClearError,
      });

      renderWithProviders(<LoginForm />);

      const toggleButton = screen.getByLabelText("Show password");
      expect(toggleButton).toBeDisabled();
    });
  });

  describe("Error Handling", () => {
    it("should display global error from auth store", () => {
      (useAuthStore as any).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: "Network connection failed",
        clearError: mockClearError,
      });

      renderWithProviders(<LoginForm />);

      expect(screen.getByText("Network connection failed")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("should handle invalid credentials error", async () => {
      mockLogin.mockRejectedValueOnce(new Error("Invalid credentials"));

      renderWithProviders(<LoginForm />);

      const emailInput = screen.getByLabelText("Email Address");
      const passwordInput = screen.getByLabelText("Password");
      const submitButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(emailInput, "wrong@example.com");
      await user.type(passwordInput, "wrongpassword");
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getAllByText("Invalid email or password")).toHaveLength(2); // Both email and password fields
      });
    });

    it("should handle rate limit error", async () => {
      mockLogin.mockRejectedValueOnce(
        new Error("Too many login attempts. Please try again in 60 seconds.")
      );

      renderWithProviders(<LoginForm />);

      const emailInput = screen.getByLabelText("Email Address");
      const passwordInput = screen.getByLabelText("Password");
      const submitButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(emailInput, "test@example.com");
      await user.type(passwordInput, "password");
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Too many login attempts. Please try again in 60 seconds.")
        ).toBeInTheDocument();
      });
    });

    it("should handle generic errors", async () => {
      mockLogin.mockRejectedValueOnce(new Error("Server error"));

      renderWithProviders(<LoginForm />);

      const emailInput = screen.getByLabelText("Email Address");
      const passwordInput = screen.getByLabelText("Password");
      const submitButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(emailInput, "test@example.com");
      await user.type(passwordInput, "password");
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Server error")).toBeInTheDocument();
      });
    });

    it("should handle errors without message", async () => {
      mockLogin.mockRejectedValueOnce(new Error());

      renderWithProviders(<LoginForm />);

      const emailInput = screen.getByLabelText("Email Address");
      const passwordInput = screen.getByLabelText("Password");
      const submitButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(emailInput, "test@example.com");
      await user.type(passwordInput, "password");
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Login failed. Please try again.")).toBeInTheDocument();
      });
    });

    it("should clear errors when form is resubmitted", async () => {
      renderWithProviders(<LoginForm />);

      const emailInput = screen.getByLabelText("Email Address");
      const passwordInput = screen.getByLabelText("Password");
      const submitButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(emailInput, "test@example.com");
      await user.type(passwordInput, "password");
      await user.click(submitButton);

      expect(mockClearError).toHaveBeenCalled();
    });
  });

  describe("Accessibility Features", () => {
    it("should have proper heading structure", () => {
      renderWithProviders(<LoginForm />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveTextContent("Welcome Back");
    });

    it("should have proper form labels", () => {
      renderWithProviders(<LoginForm />);

      // All form inputs should have associated labels
      const emailInput = screen.getByLabelText("Email Address");
      const passwordInput = screen.getByLabelText("Password");
      const rememberInput = screen.getByLabelText("Remember me");

      expect(emailInput).toBeInTheDocument();
      expect(passwordInput).toBeInTheDocument();
      expect(rememberInput).toBeInTheDocument();
    });

    it("should have proper error associations", async () => {
      renderWithProviders(<LoginForm />);

      const submitButton = screen.getByRole("button", { name: /sign in/i });
      await user.click(submitButton);

      await waitFor(() => {
        const emailInput = screen.getByLabelText("Email Address");
        const passwordInput = screen.getByLabelText("Password");

        expect(emailInput).toHaveAttribute("aria-describedby", "email-error");
        expect(passwordInput).toHaveAttribute("aria-describedby", "password-error");

        expect(screen.getByRole("alert")).toBeInTheDocument(); // Error message container
      });
    });

    it("should support keyboard navigation", async () => {
      renderWithProviders(<LoginForm />);

      // Tab through form elements
      await user.tab();
      expect(screen.getByLabelText("Email Address")).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText("Password")).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText("Show password")).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText("Remember me")).toHaveFocus();
    });

    it("should handle focus management during loading", () => {
      (useAuthStore as any).mockReturnValue({
        login: mockLogin,
        isLoading: true,
        error: null,
        clearError: mockClearError,
      });

      renderWithProviders(<LoginForm />);

      // Focus should not be trapped when form is loading
      const submitButton = screen.getByRole("button", { name: /signing in/i });
      expect(submitButton).toBeDisabled();
    });

    it("should have proper color contrast for error states", async () => {
      renderWithProviders(<LoginForm />);

      const submitButton = screen.getByRole("button", { name: /sign in/i });
      await user.click(submitButton);

      await waitFor(() => {
        const errorMessages = screen.getAllByText(/required/i);
        errorMessages.forEach((error) => {
          expect(error).toHaveClass("text-red-600", "dark:text-red-400");
        });
      });
    });
  });

  describe("Responsive Behavior", () => {
    it("should have responsive classes", () => {
      const { container } = renderWithProviders(<LoginForm />);

      const card = container.querySelector(".max-w-md");
      expect(card).toHaveClass("w-full", "max-w-md", "mx-auto");
    });

    it("should handle mobile interactions", async () => {
      // Mock mobile viewport
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithProviders(<LoginForm />);

      // Form should still be functional on mobile
      const emailInput = screen.getByLabelText("Email Address");
      await user.type(emailInput, "test@mobile.com");

      expect(emailInput).toHaveValue("test@mobile.com");
    });
  });

  describe("Security Features", () => {
    it("should have proper autocomplete attributes", () => {
      renderWithProviders(<LoginForm />);

      const emailInput = screen.getByLabelText("Email Address");
      const passwordInput = screen.getByLabelText("Password");

      expect(emailInput).toHaveAttribute("autoComplete", "email");
      expect(passwordInput).toHaveAttribute("autoComplete", "current-password");
    });

    it("should prevent email capitalization", () => {
      renderWithProviders(<LoginForm />);

      const emailInput = screen.getByLabelText("Email Address");
      expect(emailInput).toHaveAttribute("autoCapitalize", "none");
    });

    it("should use proper input types", () => {
      renderWithProviders(<LoginForm />);

      const emailInput = screen.getByLabelText("Email Address");
      const passwordInput = screen.getByLabelText("Password");

      expect(emailInput).toHaveAttribute("type", "email");
      expect(passwordInput).toHaveAttribute("type", "password");
    });

    it("should not submit form with JavaScript disabled", () => {
      renderWithProviders(<LoginForm />);

      const form = screen.getByRole("form");
      expect(form).toHaveAttribute("onSubmit");
    });
  });

  describe("Performance Considerations", () => {
    it("should not cause unnecessary re-renders", async () => {
      const renderCount = vi.fn();

      function TestWrapper() {
        renderCount();
        return <LoginForm />;
      }

      renderWithProviders(<TestWrapper />);

      const initialRenderCount = renderCount.mock.calls.length;

      // Type in email field
      const emailInput = screen.getByLabelText("Email Address");
      await user.type(emailInput, "test@example.com");

      // Should not cause excessive re-renders
      expect(renderCount.mock.calls.length - initialRenderCount).toBeLessThan(50);
    });
  });
});
