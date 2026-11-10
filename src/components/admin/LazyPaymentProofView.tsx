import { lazy, Suspense, type ReactNode } from "react";

import type { PaymentProofViewProps } from "./PaymentProofView";

// react-pdf is heavy, so it loads only when a proof shows
const PaymentProofView = lazy(() =>
  import("./PaymentProofView").then((m) => ({ default: m.PaymentProofView }))
);

export function LazyPaymentProofView({
  fallback = null,
  ...props
}: PaymentProofViewProps & { fallback?: ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <PaymentProofView {...props} />
    </Suspense>
  );
}
