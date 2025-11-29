// Error monitoring utility
// For production, integrate with Sentry or similar service

interface ErrorContext {
  [key: string]: any;
}

/**
 * Log error with context
 * In production, this would send to Sentry or similar service
 */
export function logError(error: Error | unknown, context?: ErrorContext): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Log to console (in production, this would go to Sentry)
  console.error('[ERROR]', {
    message: errorMessage,
    stack: errorStack,
    context,
    timestamp: new Date().toISOString(),
  });

  // TODO: In production, integrate with Sentry:
  // if (typeof window === 'undefined') {
  //   // Server-side
  //   Sentry.captureException(error, { extra: context });
  // } else {
  //   // Client-side
  //   Sentry.captureException(error, { extra: context });
  // }
}

/**
 * Log API error with request context
 */
export function logAPIError(
  error: Error | unknown,
  endpoint: string,
  method: string,
  context?: ErrorContext
): void {
  logError(error, {
    ...context,
    endpoint,
    method,
    type: 'api_error',
  });
}

/**
 * Initialize error monitoring (call this in your app initialization)
 * For now, just sets up console logging
 * In production, initialize Sentry here
 */
export function initErrorMonitoring(): void {
  // Set up global error handlers
  if (typeof window !== 'undefined') {
    // Client-side error handling
    window.addEventListener('error', (event) => {
      logError(event.error || event.message, {
        type: 'client_error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      logError(event.reason, {
        type: 'unhandled_promise_rejection',
      });
    });
  }

  // TODO: Initialize Sentry in production
  // Sentry.init({
  //   dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  //   environment: process.env.NODE_ENV,
  //   // ... other config
  // });
}








