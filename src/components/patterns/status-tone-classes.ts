/** The domain-free status vocabulary patterns accept (DESIGN.md, Vocabulary). */
export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

/** The tinted fill and text, and the border, of each tone: shared by StatusBadge and Callout. */
export const toneClasses: Record<StatusTone, { fill: string; border: string }> = {
  success: { fill: "bg-success text-success-foreground", border: "border-success-foreground/30" },
  warning: { fill: "bg-warning text-warning-foreground", border: "border-warning-foreground/30" },
  danger: { fill: "bg-danger text-danger-foreground", border: "border-danger-foreground/30" },
  info: { fill: "bg-info text-info-foreground", border: "border-info-foreground/30" },
  neutral: { fill: "bg-muted text-muted-foreground", border: "border-border" },
};
