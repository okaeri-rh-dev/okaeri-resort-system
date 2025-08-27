import { useState, useCallback } from "react";
import { useToast } from "@/stores/uiStore";

export interface UseAsyncSubmitOptions {
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

export function useAsyncSubmit<T>(
  onSubmit: (data: T) => Promise<void>,
  options: UseAsyncSubmitOptions = {}
) {
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const {
    successMessage = "Operation completed successfully",
    errorMessage = "Operation failed. Please try again.",
    onSuccess,
    onError,
  } = options;

  const handleSubmit = useCallback(
    async (data: T) => {
      setIsLoading(true);
      try {
        await onSubmit(data);
        toast.success(successMessage);
        onSuccess?.();
      } catch (error) {
        console.error("Async submit error:", error);
        toast.error(errorMessage);
        onError?.(error);
      } finally {
        setIsLoading(false);
      }
    },
    [onSubmit, toast, successMessage, errorMessage, onSuccess, onError]
  );

  return {
    handleSubmit,
    isLoading,
    reset: () => setIsLoading(false),
  };
}
