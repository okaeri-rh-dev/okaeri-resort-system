import type * as React from "react";

import { cn } from "@/lib/utils";

import { usePageBottomBarRef } from "./published-height";

export interface PageBottomBarProps {
  children: React.ReactNode;
  /** Placement only (flex position of the children). */
  className?: string;
}

/**
 * A page's own action bar, fixed to the screen foot below `expanded`: directly above the admin bottom
 * nav on compact, and beside the rail on medium with the safe area added. It publishes its height,
 * so toasts stack above it. Hidden from expanded, where the page shows the same actions inline.
 *
 * @example
 * ```tsx
 * <PageBottomBar className="justify-between">
 *   <p>₱4,500</p>
 *   <Button size="lg">Next</Button>
 * </PageBottomBar>
 * ```
 */
export function PageBottomBar({ children, className }: PageBottomBarProps) {
  return (
    <div
      ref={usePageBottomBarRef()}
      className={cn(
        "bg-background expanded:hidden medium:bottom-0 medium:left-20 medium:pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] fixed right-0 bottom-(--admin-bottom-bar-height) left-0 z-40 flex items-center gap-2 border-t p-3",
        className
      )}
    >
      {children}
    </div>
  );
}
