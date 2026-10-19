import { useId, useState, type ReactNode } from "react";

import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export interface DetailSectionProps {
  title: string;
  icon?: ReactNode;
  /** A header action, such as an edit button. Hidden when the section is collapsible. */
  action?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /** Placement only (grid column, margin). */
  className?: string;
}

/**
 * A card that groups related fields on a detail page under an `h2` section heading.
 * A collapsible section gets a toggle button tied to its content with `aria-expanded`.
 *
 * @example
 * ```tsx
 * <DetailSection title="Guest" icon={<User className="size-4" aria-hidden="true" />}>
 *   <div className="grid grid-cols-2 gap-4">…</div>
 * </DetailSection>
 * ```
 */
export function DetailSection({
  title,
  icon,
  action,
  children,
  collapsible = false,
  defaultCollapsed = false,
  className,
}: DetailSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const contentId = useId();

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
            {icon}
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {!collapsible && action}
            {collapsible && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCollapsed(!isCollapsed)}
                aria-label={isCollapsed ? `Expand ${title}` : `Collapse ${title}`}
                aria-expanded={!isCollapsed}
                aria-controls={contentId}
              >
                {isCollapsed ? (
                  <ChevronDown className="size-4" aria-hidden="true" />
                ) : (
                  <ChevronUp className="size-4" aria-hidden="true" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent id={contentId} className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  );
}
