import { useEffect, useState } from "react";

import { useMutation } from "@tanstack/react-query";
// Note: CSS imports removed as they cause build issues
// import "react-pdf/dist/esm/Page/AnnotationLayer.css";
// import "react-pdf/dist/esm/Page/TextLayer.css";

import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

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
import { isPaymentReceived } from "@/lib/bookings";
import { afterBookingPaymentChange } from "@/lib/query-invalidation";
import { generateSignedUrl, renewSignedUrl, shouldRenewSignedUrl } from "@/lib/storage-utils";
import type { PaymentStatus } from "@/types";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.js";

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

  // State management
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlExpiry, setUrlExpiry] = useState<Date | null>(null);
  const [fileType, setFileType] = useState<"pdf" | "image" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showVerifyConfirm, setShowVerifyConfirm] = useState(false);

  // Determine file type from path extension
  useEffect(() => {
    if (!paymentProofPath) return;

    const extension = paymentProofPath.split(".").pop()?.toLowerCase();
    if (extension === "pdf") {
      setFileType("pdf");
    } else if (["jpg", "jpeg", "png"].includes(extension || "")) {
      setFileType("image");
    }
  }, [paymentProofPath]);

  // Generate initial signed URL
  useEffect(() => {
    if (!paymentProofPath) return;

    const initializeSignedUrl = async () => {
      const {
        url,
        expiresAt,
        error: signError,
      } = await generateSignedUrl(
        paymentProofPath,
        3600 // 1 hour
      );
      if (signError) {
        setError("Failed to load payment proof. Please try again.");
        return;
      }
      setSignedUrl(url);
      setUrlExpiry(expiresAt);
      setError(null);
    };

    void initializeSignedUrl();
  }, [paymentProofPath]);

  // Auto-renewal of signed URL
  useEffect(() => {
    if (!paymentProofPath || !urlExpiry) return;

    const checkAndRenew = async () => {
      if (shouldRenewSignedUrl(urlExpiry, 60)) {
        // Renew 1 minute before expiry
        const { url, expiresAt, error: renewError } = await renewSignedUrl(paymentProofPath, 3600);
        if (renewError) {
          setError("Session expired. Please refresh the page.");
          return;
        }
        setSignedUrl(url);
        setUrlExpiry(expiresAt);
      }
    };

    const interval = setInterval(() => void checkAndRenew(), 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [paymentProofPath, urlExpiry]);

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
      afterBookingPaymentChange();
      onStatusChange?.(variables.action);
      setShowVerifyConfirm(false);
      setIsRejectDialogOpen(false);
      setRejectionReason("");
    },
    onError: (error: Error) => {
      console.error("Payment verification error:", error);
      setError(error.message);
    },
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

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setCurrentPage(1);
  };

  // Render status badge
  const renderStatusBadge = () => {
    if (isPaymentReceived(currentPaymentStatus)) {
      return <Callout tone="success">Payment verified - Ready for cabin assignment</Callout>;
    }

    return <Callout tone="info">Payment pending verification - Review proof below</Callout>;
  };

  // Render image viewer
  const renderImageViewer = () => {
    if (!signedUrl) return null;

    return (
      <TransformWrapper initialScale={1} minScale={0.5} maxScale={3} centerOnInit>
        {({ zoomIn, zoomOut, resetTransform }) => (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => zoomIn()}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
              >
                <ZoomIn className="h-4 w-4" />
                Zoom In
              </Button>
              <Button
                onClick={() => zoomOut()}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
              >
                <ZoomOut className="h-4 w-4" />
                Zoom Out
              </Button>
              <Button
                onClick={() => resetTransform()}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
            <div className="bg-muted overflow-hidden rounded-lg border">
              <TransformComponent
                wrapperStyle={{
                  width: "100%",
                  height: "600px",
                }}
                contentStyle={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={signedUrl}
                  alt="Payment proof"
                  width={800}
                  height={600}
                  className="max-h-full max-w-full object-contain"
                />
              </TransformComponent>
            </div>
          </div>
        )}
      </TransformWrapper>
    );
  };

  // Render PDF viewer
  const renderPdfViewer = () => {
    if (!signedUrl) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
              size="sm"
              variant="outline"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-muted-foreground text-sm tabular-nums">
              Page {currentPage} of {numPages || "?"}
            </span>
            <Button
              onClick={() => setCurrentPage((prev) => Math.min(numPages || prev, prev + 1))}
              disabled={currentPage >= (numPages || 1)}
              size="sm"
              variant="outline"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="bg-muted overflow-auto rounded-lg border">
          <div className="flex justify-center p-4">
            <Document
              file={signedUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={(error) => {
                console.error("PDF load error:", error);
                setError("Failed to load PDF. Please try again.");
              }}
            >
              <Page pageNumber={currentPage} width={800} />
            </Document>
          </div>
        </div>
      </div>
    );
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

          {signedUrl && fileType === "image" && renderImageViewer()}
          {signedUrl && fileType === "pdf" && renderPdfViewer()}

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
