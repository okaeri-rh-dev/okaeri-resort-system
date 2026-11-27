/**
 * The logo width of each LogoLoader size. `full` matches the boot splash in `index.html`.
 *
 * @example
 * ```tsx
 * <svg className={logoLoaderSizes.content} />
 * ```
 */
export const logoLoaderSizes = {
  full: "w-[clamp(160px,60vw,360px)]",
  content: "w-32",
} as const;
