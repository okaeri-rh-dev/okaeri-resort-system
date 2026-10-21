import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  buttonVariants,
  Callout,
  Input,
  Label,
} from "@/components/patterns";
import { anonymizeBlockers, type RetentionBooking } from "@/lib/guests/retention";

interface AnonymizeGuestDialogProps {
  guestName: string;
  bookings: RetentionBooking[];
  onConfirm: () => void;
  isPending: boolean;
}

export function AnonymizeGuestDialog({
  guestName,
  bookings,
  onConfirm,
  isPending,
}: AnonymizeGuestDialogProps) {
  const [typedName, setTypedName] = useState("");
  const { hasCurrentOrFutureBooking, openBalanceCount } = anonymizeBlockers(bookings, new Date());

  return (
    <div className="flex flex-col items-end gap-1">
      <AlertDialog onOpenChange={() => setTypedName("")}>
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={hasCurrentOrFutureBooking || isPending}>
            Anonymize guest
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anonymize guest</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {guestName}&apos;s name, contact details, notes and payment proofs from
              this guest, their bookings and the audit trail. Amounts and dates stay. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {openBalanceCount > 0 && (
            <Callout tone="warning">
              {openBalanceCount === 1
                ? "1 booking has an unpaid balance."
                : `${openBalanceCount} bookings have an unpaid balance.`}{" "}
              You will not be able to contact this guest about it.
            </Callout>
          )}
          <div className="grid gap-2">
            <Label htmlFor="anonymize-confirm-name">Type the guest&apos;s name to confirm</Label>
            <Input
              id="anonymize-confirm-name"
              value={typedName}
              onChange={(event) => setTypedName(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={typedName.trim() !== guestName.trim() || isPending}
              onClick={onConfirm}
              className={buttonVariants({ variant: "destructive" })}
            >
              Anonymize
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {hasCurrentOrFutureBooking && (
        <p className="text-muted-foreground text-xs">
          Cancel or finish the upcoming booking first.
        </p>
      )}
    </div>
  );
}
