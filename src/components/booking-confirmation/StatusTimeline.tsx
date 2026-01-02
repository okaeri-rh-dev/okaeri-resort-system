import { Check, Clock, Phone, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TimelineStep {
  label: string;
  description: string;
  status: "completed" | "current" | "pending";
  icon: React.ReactNode;
}

export function StatusTimeline() {
  const steps: TimelineStep[] = [
    {
      label: "Booking Submitted",
      description: "Your booking request has been received",
      status: "completed",
      icon: <Check className="h-5 w-5" />,
    },
    {
      label: "Payment Verification",
      description: "We'll verify your payment within 4-24 hours",
      status: "current",
      icon: <Clock className="h-5 w-5" />,
    },
    {
      label: "Cabin Assignment",
      description: "We'll assign cabins based on availability",
      status: "pending",
      icon: <Users className="h-5 w-5" />,
    },
    {
      label: "Admin Contact",
      description: "We'll call/text you with confirmation details",
      status: "pending",
      icon: <Phone className="h-5 w-5" />,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>What Happens Next?</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {steps.map((step, index) => (
            <div key={index} className="flex gap-4">
              {/* Icon */}
              <div
                className={cn(
                  "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
                  {
                    "bg-primary text-primary-foreground": step.status === "completed",
                    "border-primary text-primary border-2": step.status === "current",
                    "bg-muted text-muted-foreground": step.status === "pending",
                  }
                )}
              >
                {step.icon}
              </div>

              {/* Content */}
              <div className="flex-1">
                <h4
                  className={cn("font-semibold", {
                    "text-primary": step.status === "current",
                    "text-muted-foreground": step.status === "pending",
                  })}
                >
                  {step.label}
                </h4>
                <p className="text-muted-foreground mt-1 text-sm">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Manual Contact Message */}
        <div className="bg-muted mt-6 rounded-lg p-4">
          <h4 className="mb-2 font-semibold">📞 Personal Service</h4>
          <p className="text-muted-foreground text-sm">
            No automated emails will be sent. Our team will personally contact you via phone or SMS
            to confirm your booking and provide check-in details.
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            <strong>Expected contact time:</strong> Within 24 hours of payment verification
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
