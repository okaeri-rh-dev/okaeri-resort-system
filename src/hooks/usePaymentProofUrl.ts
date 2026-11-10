import { queryOptions, useQuery } from "@tanstack/react-query";

import { paymentProofKeys } from "@/lib/query-keys";
import { generateSignedUrl } from "@/lib/storage-utils";

// Signed URLs live 5 minutes (storage-utils); fetch a fresh one a minute before that
const RENEW_EVERY_MS = 4 * 60 * 1000;

/** A short-lived signed URL for a payment proof, renewed before it expires. */
export const usePaymentProofUrl = (path: string | null | undefined) =>
  useQuery(
    queryOptions({
      queryKey: paymentProofKeys.url(path),
      queryFn: async () => {
        const { url, error } = await generateSignedUrl(path as string);
        if (error) throw new Error(error);
        return url;
      },
      enabled: !!path,
      staleTime: RENEW_EVERY_MS,
      refetchInterval: RENEW_EVERY_MS,
      refetchOnWindowFocus: true,
    })
  );

export const paymentProofKind = (path: string) =>
  path.split(".").pop()?.toLowerCase() === "pdf" ? "pdf" : "image";
