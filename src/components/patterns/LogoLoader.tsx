import { cn } from "@/lib/utils";

// Copies of the #roof paths in public/logo.svg: a <use> clone cannot animate its paths one by one
const roofPaths = [
  "M108.8 195.1 99.4 184.1 216.7 130.7 229 140z",
  "M165.1 195.1 155.7 184.1 273 130.7 285.3 140z",
  "M221.4 195.1 212 184.1 335 128.4 412.1 188 401 196.3 333.4 144.4z",
];

const sizes = {
  full: "w-[min(60vw,240px)]",
  content: "w-32",
} as const;

export interface LogoLoaderProps {
  /** `full`: the boot splash's size, for full-screen waits. `content`: for a content area. */
  size?: keyof typeof sizes;
  /** Placement only. */
  className?: string;
}

/**
 * The loading state for full-screen and content-area waits: the logo with its three roof lines
 * lighting up in turn. In-page widgets use skeletons instead (DESIGN.md, Motion). `full` matches
 * the splash in `index.html`, so the splash turns into the loader without moving. Under reduced
 * motion the roof stays lit and a "Loading…" line shows.
 *
 * @example
 * ```tsx
 * <LogoLoader />
 * <LogoLoader size="content" />
 * ```
 */
export function LogoLoader({ size = "full", className }: LogoLoaderProps) {
  return (
    <div role="status" aria-label="Loading" className={cn("text-foreground relative", className)}>
      <svg viewBox="16 124 480 236" aria-hidden="true" className={cn("block", sizes[size])}>
        <g className="logo-loader-roof fill-brand">
          {roofPaths.map((path) => (
            <path key={path} d={path} />
          ))}
        </g>
        <use href="/logo.svg#wordmark" />
      </svg>
      {/* Absolute, so the text never moves the logo off the splash's position */}
      <p
        aria-hidden="true"
        className="text-muted-foreground absolute inset-x-0 top-full mt-3 text-center text-sm motion-safe:hidden"
      >
        Loading…
      </p>
    </div>
  );
}
