import { useState } from "react";

import { useMutation } from "@tanstack/react-query";
import { CheckCircle, XCircle } from "lucide-react";

import {
  Button,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "@/components/patterns";
import { useAuthToken } from "@/hooks/useAuthToken";
import { paymentProofKind, usePaymentProofUrl } from "@/hooks/usePaymentProofUrl";
import { afterWrite, type TableName } from "@/lib/after-write";
import { isPaymentReceived } from "@/lib/bookings";
import type { PaymentStatus } from "@/types";

import { PaymentProofView } from "./PaymentProofView";

// Tables POST /api/admin/verify-payment writes
const VERIFY_PAYMENT_WRITES = ["payments"] as const satisfies readonly TableName[];

interface PaymentProofViewerProps {
  bookingId: string;
  paymentProofPath: string | null;
  currentPaymentStatus: PaymentStatus;
  onStatusChange?: (action: "verify" | "reject") => void;
}

interface VerifyPaymentPayload {
  booking_id: string;
  action: "verify" | "reject";
  reason?: string;
}

export function PaymentProofViewer({
  bookingId,
  paymentProofPath,
  currentPaymentStatus,
  onStatusChange,
}: PaymentProofViewerProps) {
  const { token: authToken, isLoading: isAuthLoading, error: authError } = useAuthToken();

  const { data: signedUrl, error: urlError } = usePaymentProofUrl(paymentProofPath);
  const [error, setError] = useState<string | null>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showVerifyConfirm, setShowVerifyConfirm] = useState(false);

  // Mutation for verify/reject actions
  const verifyMutation = useMutation({
    mutationFn: async (payload: VerifyPaymentPayload) => {
      if (!authToken) {
        throw new Error("Not authenticated. Please sign in again.");
      }

      const response = await fetch("/api/admin/verify-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string; message?: string };
        throw new Error(errorData.error || errorData.message || "Failed to process payment");
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      onStatusChange?.(variables.action);
      setShowVerifyConfirm(false);
      setIsRejectDialogOpen(false);
      setRejectionReason("");
    },
    onError: (error: Error) => {
      console.error("Payment verification error:", error);
      setError(error.message);
    },
    onSettled: () => afterWrite(...VERIFY_PAYMENT_WRITES),
  });

  // Handler functions
  const handleVerify = () => {
    verifyMutation.mutate({
      booking_id: bookingId,
      action: "verify",
    });
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      setError("Rejection reason is required");
      return;
    }

    verifyMutation.mutate({
      booking_id: bookingId,
      action: "reject",
      reason: rejectionReason,
    });
  };

  // Render status badge
  const renderStatusBadge = () => {
    if (isPaymentReceived(currentPaymentStatus)) {
      return <Callout tone="success">Payment verified - Ready for cabin assignment</Callout>;
    }

    return <Callout tone="info">Payment pending verification - Review proof below</Callout>;
  };

  // Render action buttons
  const renderActionButtons = () => {
    if (currentPaymentStatus !== "Pending") return null;

    return (
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => setShowVerifyConfirm(true)}
          size="lg"
          disabled={verifyMutation.isPending}
          className="flex items-center gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          {verifyMutation.isPending && verifyMutation.variables?.action === "verify"
            ? "Verifying..."
            : "Verify Payment"}
        </Button>
        <Button
          onClick={() => setIsRejectDialogOpen(true)}
          size="lg"
          variant="destructive"
          disabled={verifyMutation.isPending}
          className="flex items-center gap-2"
        >
          <XCircle className="h-4 w-4" />
          {verifyMutation.isPending && verifyMutation.variables?.action === "reject"
            ? "Rejecting..."
            : "Reject Payment"}
        </Button>
      </div>
    );
  };

  // Main render
  // Show auth loading state
  if (isAuthLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Proof</CardTitle>
          <CardDescription>Authenticating...</CardDescription>
        </CardHeader>
        <CardContent>
          <Callout tone="neutral">Loading authentication...</Callout>
        </CardContent>
      </Card>
    );
  }

  // Show auth error
  if (authError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Proof</CardTitle>
          <CardDescription>Authentication Error</CardDescription>
        </CardHeader>
        <CardContent>
          <Callout tone="danger">
            {authError.message || "Failed to authenticate. Please sign in again."}
          </Callout>
        </CardContent>
      </Card>
    );
  }

  if (!paymentProofPath) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Proof</CardTitle>
          <CardDescription>Review uploaded payment proof</CardDescription>
        </CardHeader>
        <CardContent>
          <Callout tone="neutral">No payment proof uploaded</Callout>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Payment Proof Verification</CardTitle>
          <CardDescription className="text-sm break-all">
            {paymentProofPath.split("/").pop()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderStatusBadge()}

          {error && <Callout tone="danger">{error}</Callout>}

          {urlError && (
            <Callout tone="danger">Failed to load payment proof. Please try again.</Callout>
          )}

          {signedUrl && (
            <PaymentProofView url={signedUrl} kind={paymentProofKind(paymentProofPath)} />
          )}

          {renderActionButtons()}
        </CardContent>
      </Card>

      {/* Verify Confirmation Dialog */}
      <Dialog open={showVerifyConfirm} onOpenChange={setShowVerifyConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment Verification</DialogTitle>
            <DialogDescription>
              Are you sure you want to verify this payment? The booking will be marked as confirmed
              and ready for cabin assignment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowVerifyConfirm(false)}
              disabled={verifyMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleVerify} disabled={verifyMutation.isPending}>
              {verifyMutation.isPending ? "Verifying..." : "Verify Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payment</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this payment. The guest will be notified and
              must re-upload proof.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false);
                setRejectionReason("");
              }}
              disabled={verifyMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={verifyMutation.isPending || !rejectionReason.trim()}
            >
              {verifyMutation.isPending ? "Rejecting..." : "Reject Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
