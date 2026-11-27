/**
 * The logo width of each LogoLoader size. `full` matches the boot splash in `index.html`.
 * Tests read it, so a size change edits this file and `index.html` only.
 *
 * @example
 * ```tsx
 * expect(svg).toHaveClass(logoLoaderSizes.full);
 * ```
 */
export const logoLoaderSizes = {
  full: "w-[clamp(160px,60vw,360px)]",
  content: "w-32",
} as const;
