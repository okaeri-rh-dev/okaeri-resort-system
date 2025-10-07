// src/components/entity-detail/DetailSection.tsx

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Props for DetailSection component
 */
export interface DetailSectionProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
}

/**
 * Card-based section container for grouping related information
 *
 * Features:
 * - Optional icon in title
 * - Optional action button in header
 * - Collapsible functionality
 * - Consistent padding and spacing
 *
 * @example
 * ```typescript
 * <DetailSection
 *   title="Booking Information"
 *   icon={<FileText className="h-5 w-5" />}
 *   action={<Button variant="ghost" size="sm">Edit</Button>}
 *   collapsible
 * >
 *   <div className="grid grid-cols-2 gap-4">
 *     {/* Section content *\/}
 *   </div>
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

  return (
    <Card className={cn("border-neutral-200", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            {icon}
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {!collapsible && action}
            {collapsible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="h-8 w-8 p-0"
                aria-label={isCollapsed ? "Expand section" : "Collapse section"}
              >
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {!isCollapsed && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}
