import { useState } from "react";

import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { LazyPaymentProofView } from "@/components/admin/LazyPaymentProofView";
import {
  Button,
  Callout,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Skeleton,
  toast,
} from "@/components/patterns";
import { paymentProofKind, usePaymentProofUrl } from "@/hooks/usePaymentProofUrl";
import { afterWrite, type TableName } from "@/lib/after-write";
import { isPaymentReceived } from "@/lib/bookings";
import { pluralize } from "@/lib/formatters";
import { availabilityKeys } from "@/lib/query-keys";
import { db, handleSupabaseError } from "@/lib/supabase";
import type { Booking, PaymentStatus } from "@/types";

// Tables verify_and_confirm_booking writes
const VERIFY_WRITES = [
  "payments",
  "booking_units",
  "booking_unit_availability",
  "bookings",
] as const satisfies readonly TableName[];

const freeCabinsQuery = (checkIn: string, checkOut: string) =>
  queryOptions({
    queryKey: [...availabilityKeys.multiUnit.all, "free-cabins", checkIn, checkOut],
    queryFn: async () => {
      const { data: units, error } = await db.units.all().order("unit_code");
      if (error) throw new Error(handleSupabaseError(error));
      const { data: availability, error: availabilityError } =
        await db.bookings.checkMultiUnitAvailability(checkIn, checkOut, {
          unitIds: units.map((unit) => unit.unit_id),
        });
      if (availabilityError) throw new Error(handleSupabaseError(availabilityError));
      const free = new Set(availability.filter((a) => a.is_available).map((a) => a.unit_id));
      return units.filter((unit) => free.has(unit.unit_id));
    },
  });

interface VerifyPaymentDialogProps {
  booking: Booking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Verify payment for an online booking: proof, then exactly the requested cabins, then confirm. */
export function VerifyPaymentDialog({ booking, open, onOpenChange }: VerifyPaymentDialogProps) {
  const needsPayment = !isPaymentReceived(booking.payment_status as PaymentStatus);
  const requested = booking.requested_unit_count ?? booking.unit_count ?? 1;
  const [selected, setSelected] = useState<string[]>([]);

  const freeCabins = useQuery({
    ...freeCabinsQuery(booking.check_in, booking.check_out),
    enabled: open,
  });

  const verify = useMutation({
    mutationFn: async () => {
      const { error } = await db.bookings.verifyAndConfirm(booking.booking_id, selected);
      if (error) throw new Error(handleSupabaseError(error));
    },
    onSuccess: () => {
      toast.success(`Booking ${booking.booking_reference} confirmed`);
      setSelected([]);
      onOpenChange(false);
    },
    onSettled: () => afterWrite(...VERIFY_WRITES),
  });

  const toggle = (unitId: string, checked: boolean) =>
    setSelected((prev) => (checked ? [...prev, unitId] : prev.filter((id) => id !== unitId)));

  const shortOfCabins = !!freeCabins.data && freeCabins.data.length < requested;
  const cabins = (count: number) => `${count} ${pluralize(count, "cabin")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{needsPayment ? "Verify payment" : "Confirm booking"}</DialogTitle>
          <DialogDescription>
            {booking.booking_reference} · {booking.guest_name} asked for {cabins(requested)}.
          </DialogDescription>
        </DialogHeader>

        {needsPayment && <ProofSection path={booking.payment_proof_url} />}

        <section aria-labelledby="verify-cabins-heading" className="space-y-3">
          <h3 id="verify-cabins-heading" className="font-display text-lg font-semibold">
            Choose {cabins(requested)}
          </h3>
          {freeCabins.isLoading && <Skeleton className="h-24 w-full" />}
          {freeCabins.isError && (
            <Callout tone="danger">Could not load the free cabins. Close and try again.</Callout>
          )}
          {shortOfCabins && (
            <Callout tone="warning">
              Only {cabins(freeCabins.data.length)} free on these nights. Edit the dates or cancel
              the booking.
            </Callout>
          )}
          {freeCabins.data && freeCabins.data.length > 0 && (
            <ul className="medium:grid-cols-3 grid grid-cols-2 gap-2">
              {freeCabins.data.map((unit) => {
                const checked = selected.includes(unit.unit_id);
                const id = `verify-cabin-${unit.unit_id}`;
                return (
                  <li key={unit.unit_id} className="flex items-center gap-2 rounded-md border p-3">
                    <Checkbox
                      id={id}
                      checked={checked}
                      disabled={!checked && selected.length >= requested}
                      onCheckedChange={(value) => toggle(unit.unit_id, value === true)}
                    />
                    <Label htmlFor={id} className="min-w-0 truncate">
                      {unit.unit_code || unit.unit_name}
                    </Label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {verify.isError && <Callout tone="danger">{verify.error.message}</Callout>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => verify.mutate()}
            disabled={shortOfCabins || selected.length !== requested || verify.isPending}
          >
            {verify.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {needsPayment ? "Verify and confirm" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProofSection({ path }: { path: string | null | undefined }) {
  const { data: url, isError, isLoading } = usePaymentProofUrl(path);

  return (
    <section aria-labelledby="verify-proof-heading" className="space-y-3">
      <h3 id="verify-proof-heading" className="font-display text-lg font-semibold">
        Payment proof
      </h3>
      {!path && <Callout tone="warning">The guest has not uploaded a payment proof.</Callout>}
      {isError && <Callout tone="danger">Payment proof unavailable. Close and try again.</Callout>}
      {isLoading && <Skeleton className="h-64 w-full" />}
      {path && url && (
        <LazyPaymentProofView
          url={url}
          kind={paymentProofKind(path)}
          fallback={<Skeleton className="h-64 w-full" />}
        />
      )}
    </section>
  );
}
