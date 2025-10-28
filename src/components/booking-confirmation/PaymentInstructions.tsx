import { AlertCircle, Building2, Smartphone } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface PaymentInstructionsProps {
  downpaymentAmount: number;
  bookingReference: string;
  paymentProofUploaded: boolean;
}

export function PaymentInstructions({
  downpaymentAmount,
  bookingReference,
  paymentProofUploaded,
}: PaymentInstructionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Payment Instructions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Downpayment Amount */}
        <div>
          <p className="text-muted-foreground mb-2 text-sm">Required Downpayment (50%)</p>
          <p className="text-3xl font-bold">₱{downpaymentAmount.toLocaleString("en-PH")}</p>
        </div>

        <Separator />

        {/* Bank Transfer */}
        <div>
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Building2 className="h-4 w-4" />
            Bank Transfer
          </h3>
          <div className="bg-muted space-y-2 rounded-lg p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account Name:</span>
              <span className="font-medium">Okaeri Resort</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account Number:</span>
              <span className="font-mono font-medium">1234-5678-9012-3456</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bank:</span>
              <span className="font-medium">BDO Savings</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* GCash */}
        <div>
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Smartphone className="h-4 w-4" />
            GCash
          </h3>
          <div className="bg-muted space-y-2 rounded-lg p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Number:</span>
              <span className="font-mono font-medium">0917-123-4567</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name:</span>
              <span className="font-medium">Okaeri Resort</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Payment Reference */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> When making payment, use your booking reference{" "}
            <span className="font-mono font-bold">{bookingReference}</span> as the payment reference
            or description.
          </AlertDescription>
        </Alert>

        {/* Upload Reminder */}
        {!paymentProofUploaded && (
          <Alert>
            <AlertDescription>
              After payment, please upload your payment proof. You can do this now or later by
              contacting us with your booking reference.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
