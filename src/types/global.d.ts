/**
 * Global type definitions for the Okaeri Resort Management System
 * This file contains ambient module declarations and global type extensions
 */

/// <reference types="vite/client" />
/// <reference types="vitest" />
/// <reference types="@testing-library/jest-dom" />

declare global {
  /**
   * Environment variables interface for type safety
   */
  interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
    readonly VITE_APP_TITLE: string;
    readonly VITE_APP_VERSION: string;
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_ANON_KEY?: string;
    readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
    readonly VITE_GOOGLE_MAPS_API_KEY?: string;
    readonly VITE_SENTRY_DSN?: string;
    readonly VITE_ANALYTICS_ID?: string;
    readonly MODE: "development" | "production" | "test";
    readonly DEV: boolean;
    readonly PROD: boolean;
    readonly SSR: boolean;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  /**
   * Window interface extensions for third-party integrations
   */
  interface Window {
    // Google Maps API
    google?: typeof google;
    // Stripe
    Stripe?: stripe.StripeStatic;
    // Analytics
    gtag?: (...args: unknown[]) => void;
    // Development tools
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: typeof compose;
  }

  /**
   * Custom JSX namespace for React 19 compatibility
   */
  namespace JSX {
    interface IntrinsicElements {
      // Custom elements can be added here if needed
    }
  }

  /**
   * Module augmentations for third-party libraries
   */
  declare module "*.svg" {
    import type React from "react";
    const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
    const src: string;
    export { ReactComponent };
    export default src;
  }

  declare module "*.png" {
    const src: string;
    export default src;
  }

  declare module "*.jpg" {
    const src: string;
    export default src;
  }

  declare module "*.jpeg" {
    const src: string;
    export default src;
  }

  declare module "*.gif" {
    const src: string;
    export default src;
  }

  declare module "*.webp" {
    const src: string;
    export default src;
  }

  declare module "*.avif" {
    const src: string;
    export default src;
  }

  declare module "*.ico" {
    const src: string;
    export default src;
  }

  declare module "*.bmp" {
    const src: string;
    export default src;
  }

  declare module "*.svg?react" {
    import type React from "react";
    const Component: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
    export default Component;
  }

  declare module "*.css" {
    const classes: Record<string, string>;
    export default classes;
  }

  declare module "*.module.css" {
    const classes: Record<string, string>;
    export default classes;
  }

  declare module "*.scss" {
    const classes: Record<string, string>;
    export default classes;
  }

  declare module "*.module.scss" {
    const classes: Record<string, string>;
    export default classes;
  }

  declare module "*.sass" {
    const classes: Record<string, string>;
    export default classes;
  }

  declare module "*.module.sass" {
    const classes: Record<string, string>;
    export default classes;
  }

  /**
   * Utility types for better DX
   */
  type Prettify<T> = {
    [K in keyof T]: T[K];
  } & Record<string, never>;

  type NonEmptyArray<T> = [T, ...T[]];

  type RequiredKeys<T> = {
    [K in keyof T]-?: Record<string, never> extends Pick<T, K> ? never : K;
  }[keyof T];

  type OptionalKeys<T> = {
    [K in keyof T]-?: Record<string, never> extends Pick<T, K> ? K : never;
  }[keyof T];

  type PickRequired<T> = Pick<T, RequiredKeys<T>>;
  type PickOptional<T> = Pick<T, OptionalKeys<T>>;

  /**
   * Brand types for better type safety
   */
  type Brand<T, B> = T & { __brand: B };

  // Common branded types
  type UserId = Brand<string, "UserId">;
  type GuestId = Brand<string, "GuestId">;
  type BookingId = Brand<string, "BookingId">;
  type RoomId = Brand<string, "RoomId">;
  type PaymentId = Brand<string, "PaymentId">;
  type InvoiceId = Brand<string, "InvoiceId">;

  /**
   * Date types for better temporal handling
   */
  type ISODateString = Brand<string, "ISODateString">;
  type Timestamp = Brand<number, "Timestamp">;

  /**
   * Currency and monetary types
   */
  type CurrencyCode = "USD" | "EUR" | "GBP" | "JPY" | "AUD" | "CAD";
  type MoneyAmount = Brand<number, "MoneyAmount">;

  /**
   * Result type for error handling
   */
  type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

  /**
   * API Response wrapper
   */
  type ApiResponse<T> = Result<
    T,
    {
      code: string;
      message: string;
      details?: Record<string, unknown>;
    }
  >;

  /**
   * Pagination types
   */
  interface PaginationParams {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }

  interface PaginatedResponse<T> {
    data: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }

  /**
   * Event emitter types for better event handling
   */
  interface EventMap {
    [key: string]: (...args: unknown[]) => void;
  }

  /**
   * Form types
   */
  interface FormFieldError {
    type: string;
    message: string;
  }

  type FormErrors<T> = Partial<Record<keyof T, FormFieldError>>;
}

export type {};
