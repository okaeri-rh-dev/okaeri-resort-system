// PROTOTYPE (throwaway, branch prototype/visual-identity): candidate visual identities for
// map #27 / ticket #31. Never merge. Tokens are applied as scoped CSS variables on a wrapper,
// overriding the Tailwind v4 @theme vars (--color-*, --radius-*) the real shadcn primitives read.

export type Mode = "light" | "dark";

type StatusPair = { fg: string; bg: string };

export interface Palette {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  brand: string;
  brandText: string;
  shell: string;
  shellForeground: string;
  success: StatusPair;
  warning: StatusPair;
  danger: StatusPair;
  info: StatusPair;
}

export interface Direction {
  key: string;
  name: string;
  reading: string;
  thesis: string;
  fonts: { display: string; body: string; mono: string; googleQuery: string };
  displayCase: "upper" | "normal";
  radius: number;
  surface: { cardShadow: { light: string; dark: string }; cardBorder: boolean; rule: string };
  palettes: Record<Mode, Palette>;
}

export const directions: Direction[] = [
  {
    key: "engawa",
    name: "Engawa",
    reading: "Japanese restraint",
    thesis:
      "The veranda you cross to come home. Ink does the work, sand is a thin line, space is the luxury.",
    fonts: {
      display: "'Jost', sans-serif",
      body: "'Zen Kaku Gothic New', sans-serif",
      mono: "'IBM Plex Mono', monospace",
      googleQuery:
        "family=Jost:wght@400;500;600&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500",
    },
    displayCase: "upper",
    radius: 3,
    surface: {
      cardShadow: { light: "none", dark: "none" },
      cardBorder: true,
      rule: "Flat. 1px hairlines separate, never shadows. Sand appears only as a 2px rule or focus ring.",
    },
    palettes: {
      light: {
        background: "#f6f6f4",
        foreground: "#16161a",
        card: "#ffffff",
        cardForeground: "#16161a",
        primary: "#1a1a1f",
        primaryForeground: "#fafaf8",
        secondary: "#ececea",
        secondaryForeground: "#16161a",
        muted: "#efefec",
        mutedForeground: "#5e5e66",
        accent: "#ececea",
        accentForeground: "#16161a",
        destructive: "#a8322d",
        destructiveForeground: "#ffffff",
        border: "#e2e2de",
        input: "#8c8c94",
        ring: "#a9703f",
        brand: "#d19c70",
        brandText: "#8b5a2b",
        shell: "#ffffff",
        shellForeground: "#16161a",
        success: { fg: "#3f6b4a", bg: "#eef3ee" },
        warning: { fg: "#7a5a12", bg: "#f7f1e3" },
        danger: { fg: "#a8322d", bg: "#f8ecea" },
        info: { fg: "#2f4e7a", bg: "#ecf0f6" },
      },
      dark: {
        background: "#121214",
        foreground: "#ededea",
        card: "#18181b",
        cardForeground: "#ededea",
        primary: "#d19c70",
        primaryForeground: "#1a1408",
        secondary: "#232327",
        secondaryForeground: "#ededea",
        muted: "#1e1e22",
        mutedForeground: "#a0a0a8",
        accent: "#232327",
        accentForeground: "#ededea",
        destructive: "#c9453d",
        destructiveForeground: "#ffffff",
        border: "#2a2a2f",
        input: "#6a6a72",
        ring: "#d19c70",
        brand: "#d19c70",
        brandText: "#d19c70",
        shell: "#18181b",
        shellForeground: "#ededea",
        success: { fg: "#8fc29c", bg: "#1b2a20" },
        warning: { fg: "#e2b65c", bg: "#2c2414" },
        danger: { fg: "#f08a82", bg: "#331a19" },
        info: { fg: "#9db6e0", bg: "#18202e" },
      },
    },
  },
  {
    key: "hearth",
    name: "Hearth",
    reading: "Home warmth",
    thesis:
      "The lit kitchen at the end of the trip. Timber-brown leads, warm stone holds, soft depth instead of lines.",
    fonts: {
      display: "'Bricolage Grotesque', sans-serif",
      body: "'Figtree', sans-serif",
      mono: "'Figtree', sans-serif",
      googleQuery:
        "family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Figtree:wght@400;500;600;700",
    },
    displayCase: "normal",
    radius: 10,
    surface: {
      cardShadow: {
        light: "0 1px 2px rgb(60 40 25 / 0.06), 0 6px 16px -4px rgb(60 40 25 / 0.10)",
        dark: "0 1px 2px rgb(0 0 0 / 0.4), 0 8px 20px -6px rgb(0 0 0 / 0.5)",
      },
      cardBorder: false,
      rule: "Soft layered shadows on white cards over warm stone; no visible card borders. Numbers in tabular figures of the body face.",
    },
    palettes: {
      light: {
        background: "#f5f1ec",
        foreground: "#2a2421",
        card: "#ffffff",
        cardForeground: "#2a2421",
        primary: "#8a5530",
        primaryForeground: "#ffffff",
        secondary: "#efe8e0",
        secondaryForeground: "#2a2421",
        muted: "#f5f1ec",
        mutedForeground: "#6b5f57",
        accent: "#f3e6d8",
        accentForeground: "#2a2421",
        destructive: "#b23a2e",
        destructiveForeground: "#ffffff",
        border: "#e8e1d8",
        input: "#a68f7c",
        ring: "#8a5530",
        brand: "#d19c70",
        brandText: "#8a5530",
        shell: "#2a2421",
        shellForeground: "#f2ebe4",
        success: { fg: "#2f7a4f", bg: "#eaf4ee" },
        warning: { fg: "#8a5800", bg: "#fbf1df" },
        danger: { fg: "#b23a2e", bg: "#fbecea" },
        info: { fg: "#2b6a8f", bg: "#e8f2f7" },
      },
      dark: {
        background: "#1c1816",
        foreground: "#f2ebe4",
        card: "#26201d",
        cardForeground: "#f2ebe4",
        primary: "#d9a77c",
        primaryForeground: "#2a1d12",
        secondary: "#302824",
        secondaryForeground: "#f2ebe4",
        muted: "#2a2320",
        mutedForeground: "#b3a69b",
        accent: "#3a2e26",
        accentForeground: "#f2ebe4",
        destructive: "#d0574a",
        destructiveForeground: "#1c1816",
        border: "#3a312c",
        input: "#7a6c62",
        ring: "#d9a77c",
        brand: "#d9a77c",
        brandText: "#d9a77c",
        shell: "#141110",
        shellForeground: "#f2ebe4",
        success: { fg: "#86cfa2", bg: "#1d2c23" },
        warning: { fg: "#e9b45a", bg: "#2f2414" },
        danger: { fg: "#f2948a", bg: "#36201d" },
        info: { fg: "#8cc4e4", bg: "#1a2a33" },
      },
    },
  },
  {
    key: "bahay",
    name: "Bahay",
    reading: "Local Filipino warmth",
    thesis:
      "A family house in the sun. Sand is a filled surface with ink on it, shapes are round and friendly, nothing whispers.",
    fonts: {
      display: "'Plus Jakarta Sans', sans-serif",
      body: "'Plus Jakarta Sans', sans-serif",
      mono: "'DM Mono', monospace",
      googleQuery: "family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500",
    },
    displayCase: "normal",
    radius: 16,
    surface: {
      cardShadow: { light: "none", dark: "none" },
      cardBorder: false,
      rule: "Tinted sand surfaces instead of shadows or lines; pill buttons; the sand fill is reserved for the one primary action per view.",
    },
    palettes: {
      light: {
        background: "#ffffff",
        foreground: "#1a1410",
        card: "#fbf4ec",
        cardForeground: "#1a1410",
        primary: "#d19c70",
        primaryForeground: "#1a1410",
        secondary: "#1a1410",
        secondaryForeground: "#fbf4ec",
        muted: "#fbf4ec",
        mutedForeground: "#665a50",
        accent: "#f5e4d2",
        accentForeground: "#1a1410",
        destructive: "#b42318",
        destructiveForeground: "#ffffff",
        border: "#efe2d4",
        input: "#8a7a6c",
        ring: "#1a1410",
        brand: "#d19c70",
        brandText: "#8a5a2e",
        shell: "#1a1410",
        shellForeground: "#fbf4ec",
        success: { fg: "#2e7d46", bg: "#e9f5ec" },
        warning: { fg: "#9a5a00", bg: "#fff1db" },
        danger: { fg: "#b42318", bg: "#fdecea" },
        info: { fg: "#1f6f8b", bg: "#e6f3f7" },
      },
      dark: {
        background: "#17120e",
        foreground: "#f6eee6",
        card: "#231b15",
        cardForeground: "#f6eee6",
        primary: "#d19c70",
        primaryForeground: "#1a1410",
        secondary: "#f6eee6",
        secondaryForeground: "#17120e",
        muted: "#231b15",
        mutedForeground: "#b8a898",
        accent: "#33271e",
        accentForeground: "#f6eee6",
        destructive: "#e0574a",
        destructiveForeground: "#17120e",
        border: "#3a2d23",
        input: "#8a7a6c",
        ring: "#d19c70",
        brand: "#d19c70",
        brandText: "#e0b48c",
        shell: "#0f0b08",
        shellForeground: "#f6eee6",
        success: { fg: "#7fd39a", bg: "#16291d" },
        warning: { fg: "#f2b64f", bg: "#2e2210" },
        danger: { fg: "#ff958a", bg: "#381a17" },
        info: { fg: "#7fcbe6", bg: "#132a33" },
      },
    },
  },
];

function luminance(hex: string) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function contrastPairs(p: Palette) {
  return [
    { label: "Body text / page", fg: p.foreground, bg: p.background, min: 4.5 },
    { label: "Body text / card", fg: p.cardForeground, bg: p.card, min: 4.5 },
    { label: "Muted text / page", fg: p.mutedForeground, bg: p.background, min: 4.5 },
    { label: "Muted text / card", fg: p.mutedForeground, bg: p.card, min: 4.5 },
    { label: "Primary button", fg: p.primaryForeground, bg: p.primary, min: 4.5 },
    { label: "Brand text / card", fg: p.brandText, bg: p.card, min: 4.5 },
    { label: "Shell text / shell", fg: p.shellForeground, bg: p.shell, min: 4.5 },
    { label: "Input border / card", fg: p.input, bg: p.card, min: 3 },
    { label: "Focus ring / page", fg: p.ring, bg: p.background, min: 3 },
    { label: "Success", fg: p.success.fg, bg: p.success.bg, min: 4.5 },
    { label: "Warning", fg: p.warning.fg, bg: p.warning.bg, min: 4.5 },
    { label: "Danger", fg: p.danger.fg, bg: p.danger.bg, min: 4.5 },
    { label: "Info", fg: p.info.fg, bg: p.info.bg, min: 4.5 },
  ];
}

export function scopedVars(d: Direction, mode: Mode): React.CSSProperties {
  const p = d.palettes[mode];
  const r = d.radius;
  const vars: Record<string, string> = {
    "--color-background": p.background,
    "--color-foreground": p.foreground,
    "--color-card": p.card,
    "--color-card-foreground": p.cardForeground,
    "--color-popover": p.card,
    "--color-popover-foreground": p.cardForeground,
    "--color-primary": p.primary,
    "--color-primary-foreground": p.primaryForeground,
    "--color-secondary": p.secondary,
    "--color-secondary-foreground": p.secondaryForeground,
    "--color-muted": p.muted,
    "--color-muted-foreground": p.mutedForeground,
    "--color-accent": p.accent,
    "--color-accent-foreground": p.accentForeground,
    "--color-destructive": p.destructive,
    "--color-destructive-foreground": p.destructiveForeground,
    "--color-border": p.border,
    "--color-input": p.input,
    "--color-ring": p.ring,
    "--radius-lg": `${r}px`,
    "--radius-md": `${Math.max(r - 2, 0)}px`,
    "--radius-sm": `${Math.max(r - 4, 0)}px`,
    "--radius-xl": `${r + 4}px`,
    "--proto-brand": p.brand,
    "--proto-brand-text": p.brandText,
    "--proto-shell": p.shell,
    "--proto-shell-fg": p.shellForeground,
    "--proto-success": p.success.fg,
    "--proto-success-bg": p.success.bg,
    "--proto-warning": p.warning.fg,
    "--proto-warning-bg": p.warning.bg,
    "--proto-danger": p.danger.fg,
    "--proto-danger-bg": p.danger.bg,
    "--proto-info": p.info.fg,
    "--proto-info-bg": p.info.bg,
    "--proto-card-shadow": d.surface.cardShadow[mode],
    "--proto-card-border": d.surface.cardBorder ? "1px" : "0px",
    "--proto-display": d.fonts.display,
    "--proto-mono": d.fonts.mono,
    "--font-sans": d.fonts.body,
  };
  return { ...vars, fontFamily: d.fonts.body, colorScheme: mode } as React.CSSProperties;
}
