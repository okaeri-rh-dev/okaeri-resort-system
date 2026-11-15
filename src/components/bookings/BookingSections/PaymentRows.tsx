import { useState } from "react";

import { Link, useNavigate } from "@tanstack/react-router";
import { FileText, Paperclip } from "lucide-react";
import { toast } from "sonner";

import { LazyPaymentProofView } from "@/components/admin/LazyPaymentProofView";
import {
  ActionMenu,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Dialog,
  DialogContent,
  DialogTitle,
  StatusBadge,
  type ActionMenuAction,
} from "@/components/patterns";
import { useUserRole } from "@/hooks";
import { paymentProofKind, usePaymentProofUrl } from "@/hooks/usePaymentProofUrl";
import { useSoftDeletePayment } from "@/hooks/usePayments";
import { formatCurrency } from "@/lib/formatters";
import { statusTone } from "@/lib/status-tone";
import { formatPhilippineDate } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { Booking, PaymentRecordStatus } from "@/types";
import type { Payment as PaymentRow } from "@/types/entity-detail.types";

const paidAt = (payment: PaymentRow) => payment.payment_date ?? payment.created_at;

const UNCOUNTED_LABEL: Partial<Record<PaymentRecordStatus, string>> = {
  Deleted: "Removed",
  Refunded: "Refunded",
};

/** Every payment on the booking in date order; removed and refunded ones stay, muted. */
export function PaymentRows({
  payments,
  readOnly = false,
}: {
  payments: PaymentRow[];
  /** Hides the row menus, as on an anonymized booking. */
  readOnly?: boolean;
}) {
  const [proofToView, setProofToView] = useState<string | null>(null);
  const [paymentToRemove, setPaymentToRemove] = useState<PaymentRow | null>(null);
  const softDeletePayment = useSoftDeletePayment();

  if (payments.length === 0) return null;
  const inDateOrder = [...payments].sort((a, b) =>
    (paidAt(a) ?? "").localeCompare(paidAt(b) ?? "")
  );

  const remove = (payment: PaymentRow) =>
    softDeletePayment.mutate(payment.payment_id, {
      onError: () => toast.error("Failed to remove payment. Please try again."),
    });

  return (
    <>
      <ul aria-label="Payments" className="divide-y border-b">
        {inDateOrder.map((payment) => (
          <PaymentRowItem
            key={payment.payment_id}
            payment={payment}
            onViewProof={setProofToView}
            onRemove={setPaymentToRemove}
            readOnly={readOnly}
          />
        ))}
      </ul>

      <PaymentProofDialog
        path={proofToView}
        open={!!proofToView}
        onOpenChange={(open) => !open && setProofToView(null)}
      />

      <AlertDialog
        open={!!paymentToRemove}
        onOpenChange={(open) => !open && setPaymentToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove payment</AlertDialogTitle>
            <AlertDialogDescription>
              The payment of {paymentToRemove && formatCurrency(paymentToRemove.amount)} will stop
              counting toward Received. An owner can restore it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep payment</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => paymentToRemove && remove(paymentToRemove)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PaymentRowItem({
  payment,
  onViewProof,
  onRemove,
  readOnly,
}: {
  payment: PaymentRow;
  onViewProof: (path: string) => void;
  onRemove: (payment: PaymentRow) => void;
  readOnly: boolean;
}) {
  const navigate = useNavigate();
  const { canEdit, canSoftDelete } = useUserRole();
  const uncounted = UNCOUNTED_LABEL[payment.status as PaymentRecordStatus];
  const amount = formatCurrency(payment.amount);
  const paymentId = payment.payment_id;

  const actions: ActionMenuAction[] = [
    ...(payment.proof_url
      ? [{ label: "View proof", onClick: () => onViewProof(payment.proof_url as string) }]
      : []),
    ...(canEdit && !uncounted
      ? [
          {
            label: "Edit",
            onClick: () =>
              void navigate({ to: "/admin/payments/$paymentId/edit", params: { paymentId } }),
          },
        ]
      : []),
    ...(canSoftDelete && !uncounted
      ? [{ label: "Remove", onClick: () => onRemove(payment), variant: "destructive" as const }]
      : []),
  ];

  const date = paidAt(payment);
  const details = [
    payment.payment_method,
    date && formatPhilippineDate(new Date(date), "MMM d, yyyy"),
    payment.kind === "online_downpayment" ? "Online downpayment" : "Payment",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className={cn("flex items-start gap-2 py-2", uncounted && "text-muted-foreground")}>
      <Link
        to="/admin/payments/$paymentId"
        params={{ paymentId }}
        className="hover:bg-muted/50 -mx-1 min-w-0 flex-1 rounded px-1 text-sm"
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("font-semibold tabular-nums", uncounted && "line-through")}>
            {amount}
          </span>
          {uncounted && (
            <StatusBadge tone={statusTone(payment.status)} size="compact">
              {uncounted}
            </StatusBadge>
          )}
          {payment.proof_url && (
            <Paperclip className="size-3.5" role="img" aria-label="Has payment proof" />
          )}
          <span className="text-muted-foreground text-xs">{details}</span>
        </span>
        {payment.notes && (
          <span className="text-muted-foreground block text-xs break-words">{payment.notes}</span>
        )}
      </Link>
      {!readOnly && actions.length > 0 && (
        <ActionMenu actions={actions} label={`Actions for payment ${amount}`} />
      )}
    </li>
  );
}

function PaymentProofDialog({
  path,
  open,
  onOpenChange,
}: {
  path: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: url, isError } = usePaymentProofUrl(open ? path : null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90dvh] max-w-4xl overflow-y-auto"
        aria-describedby={undefined}
      >
        <DialogTitle>Payment proof</DialogTitle>
        {isError && <p className="text-muted-foreground text-sm">Payment proof unavailable</p>}
        {url && path && <LazyPaymentProofView url={url} kind={paymentProofKind(path)} />}
      </DialogContent>
    </Dialog>
  );
}

function PaymentProofThumbnail({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const { data: url, isError } = usePaymentProofUrl(path);

  if (isError) return <p className="text-muted-foreground text-sm">Payment proof unavailable</p>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!url}
        aria-label="View payment proof"
        className="bg-muted focus-visible:ring-ring flex h-32 w-full items-center justify-center overflow-hidden rounded-md border focus-visible:ring-2 focus-visible:outline-none"
      >
        {url && paymentProofKind(path) === "image" ? (
          <img src={url} alt="" width={448} height={128} className="h-full w-full object-cover" />
        ) : (
          <span className="text-muted-foreground flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4" aria-hidden />
            Payment proof (PDF)
          </span>
        )}
      </button>
      <PaymentProofDialog path={path} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** What the guest sent with an online booking: the method while Pending, and the proof. */
export function GuestPaymentChoice({ booking }: { booking: Booking }) {
  return (
    <>
      {booking.booking_status === "Pending" && booking.payment_method && (
        <p className="text-muted-foreground text-sm">Guest chose {booking.payment_method}</p>
      )}
      {booking.payment_proof_url && <PaymentProofThumbnail path={booking.payment_proof_url} />}
    </>
  );
}
