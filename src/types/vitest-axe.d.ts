/// <reference types="vitest-axe" />
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
    toHaveNoViolations(): any;
  }
}

declare global {
  namespace Vi {
    interface Assertion<T = any> {
      toHaveNoViolations(): T;
    }
    interface AsymmetricMatchersContaining {
      toHaveNoViolations(): any;
    }
  }
}

export {};
