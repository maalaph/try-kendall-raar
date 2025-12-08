/**
 * Retry Logic for Integrations
 * Exponential backoff with configurable options
 */

import { RetryOptions, DEFAULT_RETRY_OPTIONS, IntegrationError } from './types';

export interface RetryState {
  attempt: number;
  lastError?: IntegrationError;
  totalDelayMs: number;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay for next retry using exponential backoff with jitter
 */
function calculateDelay(
  attempt: number,
  options: RetryOptions
): number {
  // Exponential backoff: initialDelay * (backoffMultiplier ^ attempt)
  const exponentialDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);
  
  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);
  
  // Add jitter (±25%) to prevent thundering herd
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
  
  return Math.round(cappedDelay + jitter);
}

/**
 * Check if an error is retryable
 */
function isRetryable(error: IntegrationError, options: RetryOptions): boolean {
  // First check the error's own retryable flag
  if (!error.retryable) {
    return false;
  }
  
  // Then check if it's in the list of retryable error codes
  if (options.retryableErrors && options.retryableErrors.length > 0) {
    return options.retryableErrors.some(code => 
      error.code.toUpperCase().includes(code.toUpperCase())
    );
  }
  
  return true;
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  errorHandler: (error: unknown) => IntegrationError,
  options: Partial<RetryOptions> = {}
): Promise<{ result?: T; error?: IntegrationError; state: RetryState }> {
  const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const state: RetryState = {
    attempt: 0,
    totalDelayMs: 0,
  };
  
  while (state.attempt <= opts.maxRetries) {
    try {
      const result = await fn();
      return { result, state };
    } catch (err) {
      const error = errorHandler(err);
      state.lastError = error;
      state.attempt++;
      
      // Log attempt
      console.log(`[RETRY] Attempt ${state.attempt}/${opts.maxRetries + 1} failed:`, {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      });
      
      // Check if we should retry
      if (state.attempt > opts.maxRetries) {
        console.log('[RETRY] Max retries exceeded');
        return { error, state };
      }
      
      if (!isRetryable(error, opts)) {
        console.log('[RETRY] Error is not retryable');
        return { error, state };
      }
      
      // Calculate and apply delay
      const delay = calculateDelay(state.attempt - 1, opts);
      state.totalDelayMs += delay;
      
      console.log(`[RETRY] Waiting ${delay}ms before retry...`);
      await sleep(delay);
    }
  }
  
  // Should not reach here, but TypeScript needs this
  return { error: state.lastError, state };
}

/**
 * Create a retry wrapper for a class method
 */
export function createRetryWrapper(
  errorHandler: (error: unknown) => IntegrationError,
  options: Partial<RetryOptions> = {}
) {
  return function <T>(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const { result, error } = await withRetry(
        () => originalMethod.apply(this, args),
        errorHandler,
        options
      );
      
      if (error) {
        throw error;
      }
      
      return result;
    };
    
    return descriptor;
  };
}

/**
 * Retry options presets for common scenarios
 */
export const RetryPresets = {
  /** Fast retry for quick operations */
  fast: {
    maxRetries: 2,
    initialDelayMs: 500,
    maxDelayMs: 2000,
    backoffMultiplier: 2,
  } as RetryOptions,
  
  /** Standard retry for most operations */
  standard: DEFAULT_RETRY_OPTIONS,
  
  /** Patient retry for slow/expensive operations */
  patient: {
    maxRetries: 5,
    initialDelayMs: 2000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
  } as RetryOptions,
  
  /** Aggressive retry for critical operations */
  aggressive: {
    maxRetries: 10,
    initialDelayMs: 100,
    maxDelayMs: 30000,
    backoffMultiplier: 1.5,
  } as RetryOptions,
};



