/**
 * API Utility Functions
 * Provides retry logic with exponential backoff for API operations
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const defaultShouldRetry = (error: unknown): boolean => {
  // Retry on network errors, 5xx errors, and timeout errors
  if (error instanceof Error) {
    return (
      error.message.includes("network") ||
      error.message.includes("timeout") ||
      error.message.includes("fetch")
    );
  }
  return false;
};

/**
 * Retry an async function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    shouldRetry = defaultShouldRetry,
  } = options;

  let lastError: unknown;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if it's the last attempt or if we shouldn't retry this error
      if (attempt === maxRetries || !shouldRetry(error)) {
        break;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, Math.min(delay, maxDelay)));

      // Increase delay for next attempt
      delay *= backoffMultiplier;
    }
  }

  throw lastError;
}

/**
 * Simulate API delays for development/testing
 */
export async function simulateApiDelay(minMs: number = 500, maxMs: number = 1500): Promise<void> {
  const delay = Math.random() * (maxMs - minMs) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Create a mock API function with configurable failure rate
 */
export function createMockApiFunction<T>(
  result: T,
  options: {
    delay?: [number, number];
    failureRate?: number;
    errorMessage?: string;
  } = {}
) {
  const { delay = [500, 1500], failureRate = 0, errorMessage = "Mock API error" } = options;

  return async (): Promise<T> => {
    // Simulate delay
    await simulateApiDelay(delay[0], delay[1]);

    // Simulate random failures
    if (Math.random() < failureRate) {
      throw new Error(errorMessage);
    }

    return result;
  };
}

/**
 * Timeout wrapper for promises
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: string = "Operation timed out"
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(timeoutError)), timeoutMs)),
  ]);
}

/**
 * Batch API calls with concurrency limit
 */
export async function batchApiCalls<T, R>(
  items: T[],
  apiCall: (item: T) => Promise<R>,
  options: {
    concurrency?: number;
    retryOptions?: RetryOptions;
  } = {}
): Promise<R[]> {
  const { concurrency = 5, retryOptions } = options;
  const results: R[] = [];

  // Process items in chunks
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);

    const chunkPromises = chunk.map((item) => {
      const operation = () => apiCall(item);
      return retryOptions ? retryWithBackoff(operation, retryOptions) : operation();
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }

  return results;
}
