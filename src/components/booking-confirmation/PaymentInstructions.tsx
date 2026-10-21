import { AlertCircle, Building2 } from "lucide-react";

import { PaymentMethodsDisplay } from "@/components/payments/PaymentMethodsDisplay";
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

        {/* Dynamic Payment Methods from database */}
        <PaymentMethodsDisplay variant="compact" title="Send Payment To" />

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
              After payment, please upload your payment screenshot. You can do this now or later by
              contacting us with your booking reference.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
