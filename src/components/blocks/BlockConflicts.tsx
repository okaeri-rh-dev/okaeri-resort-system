import { Link } from "@tanstack/react-router";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  buttonVariants,
  Callout,
  StatusBadge,
} from "@/components/patterns";
import { conflictsHeading, stayLabel } from "@/lib/blocks";
import { statusBadgeProps } from "@/lib/status-tone";
import type { BlockConflict } from "@/lib/supabase";

export function BlockConflictList({ conflicts }: { conflicts: BlockConflict[] }) {
  const hasCheckedIn = conflicts.some((conflict) => conflict.is_checked_in);

  return (
    <section className="space-y-2" aria-label="Bookings on these nights">
      <Callout tone="warning" title={conflictsHeading(conflicts.length)}>
        {hasCheckedIn
          ? "A guest is checked in, so these bookings can't be cancelled here. Change the block dates."
          : "Change the block dates, or cancel these bookings and save the block. You can't save while bookings use these nights."}
      </Callout>
      <ul className="divide-y rounded-md border">
        {conflicts.map((conflict) => (
          <li key={conflict.booking_id} className="space-y-1 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-medium">
                {conflict.booking_reference}, {conflict.guest_name}
              </span>
              <StatusBadge {...statusBadgeProps(conflict.booking_status, "Pending")} />
            </div>
            <p className="text-muted-foreground text-xs tabular-nums">
              {conflict.unit_names.length > 0 ? conflict.unit_names.join(", ") : "No cabin yet"} ·{" "}
              {stayLabel(conflict.check_in, conflict.check_out)}
            </p>
            {conflict.is_partial && (
              <p className="text-xs">
                <StatusBadge tone="neutral">Partial</StatusBadge>{" "}
                <span className="text-muted-foreground">
                  {conflict.partial_reason}. Cancel and save cancels the whole booking. To keep part
                  of it, edit the booking.
                </span>
              </p>
            )}
            {conflict.is_checked_in && (
              <p className="text-xs font-medium">Guest is checked in: change the block dates.</p>
            )}
            <Link
              to="/admin/bookings/$bookingId"
              params={{ bookingId: conflict.booking_id }}
              className="text-primary coarse:min-h-11 inline-flex items-center text-xs underline"
            >
              Open booking
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface CancelAndSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: BlockConflict[];
  onConfirm: () => void;
}

export function CancelAndSaveDialog({
  open,
  onOpenChange,
  conflicts,
  onConfirm,
}: CancelAndSaveDialogProps) {
  const count = conflicts.length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Cancel {count} {count === 1 ? "booking" : "bookings"} and save the block?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <ul className="max-h-48 list-disc space-y-1 overflow-y-auto pl-5">
                {conflicts.map((conflict) => (
                  <li key={conflict.booking_id} className="break-words">
                    {conflict.booking_reference}, {conflict.guest_name}
                  </li>
                ))}
              </ul>
              <p>
                Payments are not changed. Refund any paid amount by hand. The guests are not told:
                contact them yourself.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep the bookings</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={onConfirm}
          >
            Cancel and save
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
