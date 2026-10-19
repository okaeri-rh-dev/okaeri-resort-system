import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ActionMenuAction {
  label: string;
  onClick: () => void;
  /** `destructive` for an irreversible action; confirm it through an `AlertDialog`. */
  variant?: "default" | "destructive";
  disabled?: boolean;
}

export interface ActionMenuProps {
  actions: ActionMenuAction[];
  /** Names the icon-only trigger, such as "Actions for OKR-1042". */
  label?: string;
  /** Placement only. */
  className?: string;
}

/**
 * A row's "more" menu: an icon button that opens a list of actions.
 *
 * @example
 * ```tsx
 * <ActionMenu
 *   label={`Actions for ${booking.booking_reference}`}
 *   actions={[{ label: "View", onClick: view }, { label: "Cancel", onClick: cancel, variant: "destructive" }]}
 * />
 * ```
 */
export function ActionMenu({ actions, label = "Actions", className }: ActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={className} aria-label={label}>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              action.variant === "destructive" && "text-destructive focus:text-destructive"
            )}
          >
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
