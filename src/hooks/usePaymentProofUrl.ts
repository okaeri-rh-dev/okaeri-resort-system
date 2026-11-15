import { queryOptions, useQuery } from "@tanstack/react-query";

import { paymentProofKeys } from "@/lib/query-keys";
import { generateSignedUrl } from "@/lib/storage-utils";

// Signed URLs live 5 minutes (storage-utils); fetch a fresh one a minute before that
const RENEW_EVERY_MS = 4 * 60 * 1000;

// A manual payment stores the proof's public URL, an online booking its storage path
const proofStoragePath = (proof: string) =>
  decodeURIComponent(proof.split("?")[0]).replace(
    /^.*\/storage\/v1\/object\/(public|sign|authenticated)\/payment-proofs\//,
    ""
  );

/** A short-lived signed URL for a payment proof, renewed before it expires. */
export const usePaymentProofUrl = (path: string | null | undefined) =>
  useQuery(
    queryOptions({
      queryKey: paymentProofKeys.url(path),
      queryFn: async () => {
        const { url, error } = await generateSignedUrl(proofStoragePath(path as string));
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
  proofStoragePath(path).split(".").pop()?.toLowerCase() === "pdf" ? "pdf" : "image";
