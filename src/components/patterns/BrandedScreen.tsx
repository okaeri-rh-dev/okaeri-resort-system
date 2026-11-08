import type { ReactNode } from "react";

import { RESORT_NAME } from "@/config/settings";

import { Logo } from "./Logo";

export interface BrandedScreenProps {
  /** One line under the logo, such as the login screen's purpose. */
  subtitle?: string;
  /** The screen's own card or content, with its own title. */
  children: ReactNode;
}

/**
 * The layout for every screen outside the shell (sign-in flow, pending approval, 404): a centred
 * column on the page background with the full logo on top and the screen's content below.
 *
 * @example
 * ```tsx
 * <BrandedScreen subtitle="Sign in to access the resort management dashboard">
 *   <LoginForm />
 * </BrandedScreen>
 * ```
 */
export function BrandedScreen({ subtitle, children }: BrandedScreenProps) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-foreground mt-6">
          <Logo label={RESORT_NAME} className="mx-auto w-60" />
          {subtitle && <p className="text-muted-foreground mt-2 text-center text-sm">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
