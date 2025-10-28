import { useState } from "react";

import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copyToClipboard } from "@/lib/utils/copy-to-clipboard";

interface BookingReferenceDisplayProps {
  reference: string;
}

export function BookingReferenceDisplay({ reference }: BookingReferenceDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(reference);

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } else {
      alert("Failed to copy. Please copy manually: " + reference);
    }
  };

  return (
    <Card className="border-primary bg-primary/5">
      <CardContent className="pt-6">
        <div className="text-center">
          <p className="text-muted-foreground mb-2 text-sm font-medium tracking-wide uppercase">
            Your Booking Reference
          </p>

          {/* Large, prominent reference number */}
          <div className="my-4">
            <p className="font-mono text-4xl font-bold tracking-wider md:text-5xl lg:text-6xl">
              {reference}
            </p>
          </div>

          {/* Copy button with feedback */}
          <Button onClick={handleCopy} variant="outline" className="gap-2">
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy to Clipboard
              </>
            )}
          </Button>

          <p className="text-muted-foreground mt-4 text-sm">
            Please save this reference number. You'll need it for payment and future correspondence.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
