import "vitest-axe";

/**
 * Type declarations for vitest-axe accessibility testing matchers
 * Extends both vitest and Vi.Assertion interfaces for compatibility
 */

declare module "vitest" {
  interface Assertion<T = any> {
    toHaveNoViolations(): T;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): unknown;
  }
}

declare global {
  namespace Vi {
    interface Assertion<T = any> {
      toHaveNoViolations(): T;
    }
    interface AsymmetricMatchersContaining {
      toHaveNoViolations(): unknown;
    }
  }
}

export {};
