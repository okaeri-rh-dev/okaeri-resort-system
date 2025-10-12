/**
 * Idempotency Key Hook (Phase 4.5)
 *
 * Generates and persists idempotency keys for mutation operations.
 * Prevents duplicate bookings from retry attempts or double-submits.
 *
 * @module useIdempotencyKey
 */

import { useState, useEffect } from "react";

/**
 * Generate and persist an idempotency key for the current operation
 *
 * The key is:
 * - Generated once per component mount using crypto.randomUUID()
 * - Persisted in sessionStorage (survives page refresh during retry)
 * - Removed on component unmount (new mount = new operation)
 *
 * Use this hook at the top of forms that submit mutations to prevent duplicate submissions.
 *
 * @returns Idempotency key (UUID v4)
 *
 * @example
 * function BookingForm() {
 *   const idempotencyKey = useIdempotencyKey();
 *   const createBooking = useMutation({
 *     mutationFn: async (data) => {
 *       return fetch('/api/bookings', {
 *         method: 'POST',
 *         headers: {
 *           'Content-Type': 'application/json',
 *           'Idempotency-Key': idempotencyKey, // ✅ Include in request
 *         },
 *         body: JSON.stringify(data),
 *       });
 *     },
 *   });
 *
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 *
 * @example
 * // Multi-unit booking with idempotency key
 * const idempotencyKey = useIdempotencyKey();
 * await createBooking.mutateAsync({
 *   ...bookingData,
 *   idempotency_key: idempotencyKey,
 * });
 */
export function useIdempotencyKey(): string {
  // Generate key once on mount
  const [key] = useState(() => {
    // Check if there's a persisted key from a retry
    const existingKey = sessionStorage.getItem("current_idempotency_key");

    // Use existing key if retrying, otherwise generate new one
    return existingKey || crypto.randomUUID();
  });

  // Persist key across retries but regenerate on unmount
  useEffect(() => {
    // Store key for retry scenarios (e.g., network failure, user hits retry)
    sessionStorage.setItem("current_idempotency_key", key);

    // Cleanup on unmount (new mount = new operation = new key)
    return () => {
      sessionStorage.removeItem("current_idempotency_key");
    };
  }, [key]);

  return key;
}

/**
 * Clear the current idempotency key
 *
 * Use this when you want to force a new operation (e.g., after successful submission).
 *
 * @example
 * const idempotencyKey = useIdempotencyKey();
 *
 * const handleSubmit = async () => {
 *   await createBooking.mutateAsync({ ...data, idempotency_key: idempotencyKey });
 *
 *   // Clear key after successful submission
 *   clearIdempotencyKey();
 * };
 */
export function clearIdempotencyKey(): void {
  sessionStorage.removeItem("current_idempotency_key");
}

/**
 * Get the current idempotency key from storage
 *
 * Useful for debugging or manual key retrieval.
 *
 * @returns Current idempotency key or null
 */
export function getCurrentIdempotencyKey(): string | null {
  return sessionStorage.getItem("current_idempotency_key");
}
