import { Building2 } from "lucide-react";

import {
  Callout,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
} from "@/components/patterns";
import { PaymentMethodsDisplay } from "@/components/payments/PaymentMethodsDisplay";

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
        <Callout tone="info">
          <strong>Important:</strong> When making payment, use your booking reference{" "}
          <span className="font-bold tabular-nums">{bookingReference}</span> as the payment
          reference or description.
        </Callout>

        {/* Upload Reminder */}
        {!paymentProofUploaded && (
          <Callout tone="neutral">
            After payment, please upload your payment screenshot. You can do this now or later by
            contacting us with your booking reference.
          </Callout>
        )}
      </CardContent>
    </Card>
  );
}
