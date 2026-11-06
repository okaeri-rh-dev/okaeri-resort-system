import { cn } from "@/lib/utils";

const views = {
  full: { viewBox: "16 124 480 236", href: "/logo.svg#logo" },
  mark: { viewBox: "96 126 320 72", href: "/logo.svg#roof" },
} as const;

export interface LogoProps {
  /** `full`: the roof over "Okaeri Rest House". `mark`: the roof alone. */
  variant?: keyof typeof views;
  /** Names the logo for screen readers. Omit when text next to it already says the name. */
  label?: string;
  /** Placement and size only (height or width; the other follows the aspect ratio). */
  className?: string;
}

/**
 * The resort logo from `public/logo.svg`. The wordmark takes the current text colour and the
 * roof the `brand` token, so it reads in both themes and on the sidebar.
 *
 * @example
 * ```tsx
 * <Logo label="Okaeri Rest House" className="w-60" />
 * <Logo variant="mark" className="h-4" />
 * ```
 */
export function Logo({ variant = "full", label, className }: LogoProps) {
  const { viewBox, href } = views[variant];
  return (
    <svg
      viewBox={viewBox}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0", className)}
    >
      <use href={href} />
    </svg>
  );
}
