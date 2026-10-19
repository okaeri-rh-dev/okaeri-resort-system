import { Banknote, Building2, CreditCard, Smartphone, Wallet, type LucideIcon } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivePaymentMethods } from "@/hooks/usePaymentMethods";
import type { PaymentMethodConfig } from "@/types";

// Map icon_name strings from the database to Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  Smartphone,
  Building2,
  CreditCard,
  Wallet,
  Banknote,
};

function getIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || CreditCard;
}

interface PaymentMethodsDisplayProps {
  /** "card" for guest booking form style, "compact" for confirmation page */
  variant?: "card" | "compact";
  /** Optional heading override */
  title?: string;
}

export function PaymentMethodsDisplay({ variant = "card", title }: PaymentMethodsDisplayProps) {
  const { data: methods, isLoading, isError } = useActivePaymentMethods();

  if (isLoading) {
    return <PaymentMethodsSkeleton variant={variant} />;
  }

  if (isError || !methods?.length) {
    return null;
  }

  if (variant === "compact") {
    return <CompactPaymentMethods methods={methods} />;
  }

  return <CardPaymentMethods methods={methods} title={title} />;
}

/** Full card variant used in the guest booking form */
function CardPaymentMethods({
  methods,
  title,
}: {
  methods: PaymentMethodConfig[];
  title?: string;
}) {
  return (
    <div className="space-y-4">
      {title && <p className="text-muted-foreground text-sm">{title}</p>}
      <p className="text-muted-foreground text-sm">
        Send your payment to any of the following accounts:
      </p>

      {methods.map((method, index) => (
        <div key={method.id}>
          {index > 0 && <Separator className="my-4" />}
          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <MethodIcon method={method} size="sm" />
                {method.display_name}
              </div>
              <MethodDetails method={method} />
            </div>
            <QrCodeDisplay method={method} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Compact variant used in the booking confirmation page */
function CompactPaymentMethods({ methods }: { methods: PaymentMethodConfig[] }) {
  return (
    <div className="space-y-4">
      {methods.map((method, index) => (
        <div key={method.id}>
          {index > 0 && <Separator />}
          <div className={index > 0 ? "pt-4" : ""}>
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <MethodIcon method={method} size="sm" />
              {method.display_name}
            </h3>
            <div className="bg-muted space-y-2 rounded-lg p-4 text-sm">
              {method.account_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {method.method_type === "e-wallet" ? "Name:" : "Account Name:"}
                  </span>
                  <span className="font-medium">{method.account_name}</span>
                </div>
              )}
              {method.account_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {method.method_type === "e-wallet" ? "Number:" : "Account Number:"}
                  </span>
                  <span className="font-mono font-medium">{method.account_number}</span>
                </div>
              )}
              {method.bank_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bank:</span>
                  <span className="font-medium">{method.bank_name}</span>
                </div>
              )}
            </div>
            {method.qr_code_url && (
              <div className="mt-3 flex justify-center">
                <img
                  src={method.qr_code_url}
                  alt={`${method.display_name} QR Code`}
                  className="h-32 w-32 rounded-lg border object-contain"
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Renders a payment method's icon */
function MethodIcon({ method, size = "sm" }: { method: PaymentMethodConfig; size?: "sm" | "md" }) {
  const Icon = getIcon(method.icon_name);
  const sizeClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return <Icon className={`${sizeClass} ${method.icon_color}`} />;
}

/** Renders account details (name, number, bank) */
function MethodDetails({ method }: { method: PaymentMethodConfig }) {
  return (
    <div className="space-y-1 pl-6 text-sm">
      {method.account_number && (
        <p>
          <span className="text-muted-foreground">
            {method.method_type === "e-wallet" ? "Number:" : "Account Number:"}
          </span>{" "}
          {method.account_number}
        </p>
      )}
      {method.account_name && (
        <p>
          <span className="text-muted-foreground">
            {method.method_type === "e-wallet" ? "Name:" : "Account Name:"}
          </span>{" "}
          {method.account_name}
        </p>
      )}
      {method.bank_name && (
        <p>
          <span className="text-muted-foreground">Bank:</span> {method.bank_name}
        </p>
      )}
      {method.instructions && (
        <p className="text-muted-foreground mt-1 italic">{method.instructions}</p>
      )}
    </div>
  );
}

/** Renders QR code image or placeholder */
function QrCodeDisplay({ method }: { method: PaymentMethodConfig }) {
  if (method.qr_code_url) {
    return (
      <img
        src={method.qr_code_url}
        alt={`${method.display_name} QR Code`}
        className="h-24 w-24 rounded-lg border object-contain"
      />
    );
  }

  return (
    <div className="text-muted-foreground bg-muted flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed text-xs">
      {method.provider_name} QR
    </div>
  );
}

/** Loading skeleton */
function PaymentMethodsSkeleton({ variant }: { variant: "card" | "compact" }) {
  const count = 2;
  if (variant === "compact") {
    return (
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i}>
            {i > 0 && <Separator />}
            <div className={i > 0 ? "pt-4" : ""}>
              <Skeleton className="mb-3 h-5 w-32" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-64" />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          {i > 0 && <Separator className="my-4" />}
          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="ml-6 h-4 w-48" />
              <Skeleton className="ml-6 h-4 w-40" />
            </div>
            <Skeleton className="h-24 w-24 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
