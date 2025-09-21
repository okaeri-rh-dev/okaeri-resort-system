import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Info } from "lucide-react";

interface PrivacyConsentProps {
  onAccept: (accepted: boolean) => void;
  isRequired?: boolean;
  showDialog?: boolean;
}

export function PrivacyConsent({
  onAccept,
  isRequired = true,
  showDialog = true,
}: PrivacyConsentProps) {
  const [isChecked, setIsChecked] = React.useState(false);

  const handleCheckChange = (checked: boolean) => {
    setIsChecked(checked);
    onAccept(checked);
  };

  const PrivacyPolicyContent = () => (
    <div className="space-y-4 text-sm">
      <h3 className="font-semibold">Data Privacy Notice</h3>
      <p>
        In compliance with the Data Privacy Act of 2012 (Republic Act No. 10173), Okaeri Resort is
        committed to protecting your personal information.
      </p>

      <div>
        <h4 className="mb-2 font-semibold">Information We Collect:</h4>
        <ul className="list-inside list-disc space-y-1">
          <li>Full name and contact information</li>
          <li>Email address and phone number</li>
          <li>Booking details and preferences</li>
          <li>Payment information for transaction processing</li>
          <li>Government-issued ID for verification (when required)</li>
        </ul>
      </div>

      <div>
        <h4 className="mb-2 font-semibold">How We Use Your Information:</h4>
        <ul className="list-inside list-disc space-y-1">
          <li>Process and confirm your bookings</li>
          <li>Communicate important updates about your reservation</li>
          <li>Comply with legal and regulatory requirements</li>
          <li>Improve our services and guest experience</li>
          <li>Send promotional materials (with your consent)</li>
        </ul>
      </div>

      <div>
        <h4 className="mb-2 font-semibold">Your Rights Under the Law:</h4>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <strong>Right to be Informed:</strong> Know how we collect and use your data
          </li>
          <li>
            <strong>Right to Access:</strong> Request copies of your personal information
          </li>
          <li>
            <strong>Right to Rectification:</strong> Correct inaccurate information
          </li>
          <li>
            <strong>Right to Erasure:</strong> Request deletion of your data
          </li>
          <li>
            <strong>Right to Data Portability:</strong> Receive your data in a readable format
          </li>
          <li>
            <strong>Right to Object:</strong> Opt-out of certain data processing
          </li>
        </ul>
      </div>

      <div>
        <h4 className="mb-2 font-semibold">Data Protection Measures:</h4>
        <p>
          We implement appropriate technical and organizational measures to protect your personal
          information against unauthorized access, alteration, disclosure, or destruction. This
          includes:
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Encrypted data transmission and storage</li>
          <li>Regular security assessments</li>
          <li>Limited access to personal information</li>
          <li>Staff training on data privacy</li>
        </ul>
      </div>

      <div>
        <h4 className="mb-2 font-semibold">Data Retention:</h4>
        <p>
          We retain your personal information only for as long as necessary to fulfill the purposes
          for which it was collected, including legal and regulatory requirements:
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Booking records: 5 years</li>
          <li>Financial transactions: 10 years (per BIR requirements)</li>
          <li>Marketing communications: Until consent is withdrawn</li>
        </ul>
      </div>

      <div>
        <h4 className="mb-2 font-semibold">Contact Information:</h4>
        <p>
          For questions or concerns about our data privacy practices, or to exercise your rights
          under the Data Privacy Act, please contact:
        </p>
        <div className="mt-2">
          <p>Data Protection Officer</p>
          <p>Okaeri Resort</p>
          <p>Email: privacy@okaeriresort.com</p>
          <p>Phone: [Resort Contact Number]</p>
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="text-muted-foreground text-xs">Last updated: September 21, 2025</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="space-y-3">
          <p className="font-medium">Data Privacy Notice</p>
          <p className="text-sm">
            By providing your personal information, you acknowledge that you have read, understood,
            and agree to our data privacy policy in accordance with the Data Privacy Act of 2012 (RA
            10173).
          </p>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="privacy-consent"
              checked={isChecked}
              onCheckedChange={handleCheckChange}
              required={isRequired}
              className="mt-1"
            />
            <label htmlFor="privacy-consent" className="text-sm leading-relaxed">
              I consent to the collection, use, and processing of my personal information as
              described in the{" "}
              {showDialog ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="link" className="h-auto p-0 font-normal underline">
                      Privacy Policy
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[80vh] max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Privacy Policy</DialogTitle>
                      <DialogDescription>Okaeri Resort Data Privacy Policy</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-[60vh] pr-4">
                      <PrivacyPolicyContent />
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              ) : (
                <a href="/privacy-policy" className="text-primary underline">
                  Privacy Policy
                </a>
              )}
              . I understand that I can withdraw my consent at any time by contacting the resort's
              Data Protection Officer.
            </label>
          </div>

          <p className="text-muted-foreground mt-2 text-xs">
            {isRequired && "* Required for booking completion"}
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}

// Standalone privacy policy dialog component
export function PrivacyPolicyDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Privacy Policy
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-2xl">
        <DialogHeader>
          <DialogTitle>Privacy Policy</DialogTitle>
          <DialogDescription>Okaeri Resort Data Privacy Policy</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-4 text-sm">{/* Full privacy policy content */}</div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
