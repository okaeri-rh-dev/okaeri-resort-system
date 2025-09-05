/**
 * React 19 Patterns - Individual hooks for useOptimistic, useActionState, startTransition
 * Phase 2.1 - TDD GREEN: Minimal implementations to pass pattern tests
 */

import {
  useOptimistic,
  useActionState,
  startTransition,
  useDeferredValue,
  useState,
  useCallback,
  useRef,
  use,
} from "react";

// useOptimisticBooking Hook
export function useOptimisticBooking() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const [optimisticBookings, addOptimisticBooking] = useOptimistic(
    bookings,
    (currentBookings, newBooking) => {
      return [...currentBookings, newBooking];
    }
  );

  const handleSetBookings = useCallback((newBookings: any[]) => {
    setBookings(newBookings);
  }, []);

  const handleAddOptimisticBooking = useCallback(
    (booking: any) => {
      startTransition(() => {
        addOptimisticBooking(booking);
        setPendingCount((prev) => prev + 1);
      });
    },
    [addOptimisticBooking]
  );

  return {
    optimisticBookings,
    pendingCount,
    setBookings: handleSetBookings,
    addOptimisticBooking: handleAddOptimisticBooking,
  };
}

// useActionStateForm Hook
export function useActionStateForm() {
  const submitAction = async (prevState: any, formData: FormData) => {
    // Basic form submission action
    const data = Object.fromEntries(formData.entries());

    // Simulate validation
    if (!data.guest || !data.room) {
      return {
        success: false,
        error: "Guest and room are required",
      };
    }

    // Simulate async processing
    await new Promise((resolve) => setTimeout(resolve, 300));

    return {
      success: true,
      data,
    };
  };

  const [state, formAction, isPending] = useActionState(submitAction, {
    success: false,
    error: null,
  });

  return {
    state,
    formAction,
    isPending,
  };
}

// useDeferredMetrics Hook
export function useDeferredMetrics() {
  const [input, setInput] = useState("");
  const [metrics, setMetrics] = useState<any[]>([]);

  const deferredInput = useDeferredValue(input);
  const deferredMetrics = useDeferredValue(metrics);

  const updateInput = useCallback((value: string) => {
    setInput(value);
  }, []);

  const updateMetrics = useCallback((newMetrics: any[]) => {
    startTransition(() => {
      setMetrics(newMetrics);
    });
  }, []);

  return {
    input,
    deferredInput,
    metrics: deferredMetrics,
    updateInput,
    updateMetrics,
    isDeferred: input !== deferredInput,
  };
}

// Generic React 19 patterns utility hooks
export function useOptimisticUpdate<T>(
  initialValue: T,
  updateFn?: (current: T, optimisticValue: T) => T
) {
  const [optimisticValue, setOptimisticValue] = useOptimistic(
    initialValue,
    updateFn || ((current, newValue) => newValue)
  );

  const updateOptimistically = useCallback(
    (newValue: T) => {
      startTransition(() => {
        setOptimisticValue(newValue);
      });
    },
    [setOptimisticValue]
  );

  return [optimisticValue, updateOptimistically] as const;
}

export function useServerAction<T extends any[], R>(action: (...args: T) => Promise<R>) {
  const [state, serverAction, isPending] = useActionState(
    async (prevState: any, ...args: T) => {
      try {
        const result = await action(...args);
        return { success: true, data: result, error: null };
      } catch (error) {
        return {
          success: false,
          data: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    { success: false, data: null, error: null }
  );

  return {
    state,
    action: serverAction,
    isPending,
    data: state.data,
    error: state.error,
    isSuccess: state.success,
  };
}

export function useConcurrentState<T>(initialValue: T) {
  const [state, setState] = useState(initialValue);
  const [isPending, setIsPending] = useState(false);

  const updateConcurrently = useCallback((newValue: T) => {
    setIsPending(true);
    startTransition(() => {
      setState(newValue);
      setIsPending(false);
    });
  }, []);

  return {
    state,
    updateConcurrently,
    isPending,
  };
}

// Suspense utilities
export function createSuspendingResource<T>(promiseFactory: () => Promise<T>, cacheKey?: string) {
  const cache = useRef<Map<string, Promise<T>>>(new Map());

  return useCallback(
    (key: string = cacheKey || "default") => {
      if (!cache.current.has(key)) {
        cache.current.set(key, promiseFactory());
      }

      const promise = cache.current.get(key)!;
      return use(promise);
    },
    [promiseFactory, cacheKey]
  );
}

// Transition utilities
export function useTransition() {
  const [isPending, setIsPending] = useState(false);

  const startTransitionWithState = useCallback((callback: () => void) => {
    setIsPending(true);
    startTransition(() => {
      try {
        callback();
      } finally {
        setIsPending(false);
      }
    });
  }, []);

  return [isPending, startTransitionWithState] as const;
}

// Error boundary utilities for Suspense
export function useSuspenseErrorBoundary() {
  const [error, setError] = useState<Error | null>(null);
  const [hasError, setHasError] = useState(false);

  const resetError = useCallback(() => {
    setError(null);
    setHasError(false);
  }, []);

  const captureError = useCallback((error: Error) => {
    setError(error);
    setHasError(true);
  }, []);

  return {
    hasError,
    error,
    resetError,
    captureError,
  };
}

// Streaming utilities
export function useStreamingData<T>(streamGenerator: () => AsyncGenerator<T, void, unknown>) {
  const [data, setData] = useState<T[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const streamRef = useRef<AsyncGenerator<T, void, unknown> | null>(null);

  const startStream = useCallback(async () => {
    if (isStreaming) return;

    setIsStreaming(true);
    streamRef.current = streamGenerator();

    try {
      for await (const chunk of streamRef.current) {
        setData((prev) => [...prev, chunk]);
      }
    } catch (error) {
      console.error("Streaming error:", error);
    } finally {
      setIsStreaming(false);
    }
  }, [streamGenerator, isStreaming]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.return();
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  return {
    data,
    isStreaming,
    startStream,
    stopStream,
  };
}

// Form utilities with React 19 patterns
export function useOptimisticForm<T extends Record<string, any>>(
  initialValues: T,
  onSubmit: (values: T) => Promise<T>
) {
  const [serverValues, setServerValues] = useState(initialValues);
  const [optimisticValues, setOptimisticValues] = useOptimistic(
    serverValues,
    (current: T, newValues: Partial<T>) => ({ ...current, ...newValues })
  );

  const updateField = useCallback(
    (field: keyof T, value: any) => {
      startTransition(() => {
        setOptimisticValues({ [field]: value } as Partial<T>);
      });
    },
    [setOptimisticValues]
  );

  const submitForm = useCallback(async () => {
    try {
      const result = await onSubmit(optimisticValues);
      setServerValues(result);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }, [optimisticValues, onSubmit]);

  return {
    values: optimisticValues,
    updateField,
    submitForm,
  };
}

// Progressive enhancement utilities
export function useProgressiveEnhancement<T>(
  serverSideRenderer: () => T,
  clientSideEnhancer: (serverData: T) => T
) {
  const [data, setData] = useState<T>(() => serverSideRenderer());
  const [isEnhanced, setIsEnhanced] = useState(false);

  const enhance = useCallback(() => {
    startTransition(() => {
      const enhanced = clientSideEnhancer(data);
      setData(enhanced);
      setIsEnhanced(true);
    });
  }, [data, clientSideEnhancer]);

  return {
    data,
    isEnhanced,
    enhance,
  };
}
