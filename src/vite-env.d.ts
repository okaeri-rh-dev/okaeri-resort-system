/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /**
   * @deprecated Phase 4: Use app_roles table instead.
   * This environment variable is no longer used for role management.
   * Roles are now managed in the database via the app_roles table.
   */
  readonly VITE_OWNER_EMAILS?: string; // Optional - kept for backwards compatibility only
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
