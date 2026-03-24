export interface RetryOptions {
  /**
   * Total operation attempts including the initial one.
   */
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  sleep?: (delayMs: number) => Promise<void>;
  shouldRetry?: (error: unknown) => boolean;
}

export class HttpRequestError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, status: number, retryable: boolean) {
    super(message);
    this.name = "HttpRequestError";
    this.status = status;
    this.retryable = retryable;
  }
}

const defaultSleep = async (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const isRetryableByDefault = (error: unknown): boolean => {
  if (error instanceof HttpRequestError) {
    return error.retryable;
  }

  return error instanceof Error;
};

export const withRetry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> => {
  const sleep = options.sleep ?? defaultSleep;
  const shouldRetry = options.shouldRetry ?? isRetryableByDefault;
  const attempts = Math.max(1, options.attempts);

  let currentAttempt = 1;
  let lastError: unknown;

  while (currentAttempt <= attempts) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const hasRemainingAttempt = currentAttempt < attempts;
      if (!hasRemainingAttempt || !shouldRetry(error)) {
        break;
      }

      const delayMs = Math.min(
        options.baseDelayMs * 2 ** (currentAttempt - 1),
        options.maxDelayMs,
      );
      await sleep(delayMs);
      currentAttempt += 1;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("Operation failed with a non-error value.");
};
