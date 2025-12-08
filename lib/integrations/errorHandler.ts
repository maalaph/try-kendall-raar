/**
 * Unified Error Handler for Integrations
 * Standardized error handling across all integrations
 */

import { IntegrationError } from './types';

export type ErrorCategory = 
  | 'AUTH'           // Authentication/authorization errors
  | 'RATE_LIMIT'     // Rate limit exceeded
  | 'VALIDATION'     // Invalid parameters
  | 'NOT_FOUND'      // Resource not found
  | 'PERMISSION'     // Permission denied
  | 'NETWORK'        // Network/connection errors
  | 'TIMEOUT'        // Request timeout
  | 'SERVICE'        // External service error
  | 'INTERNAL'       // Internal error
  | 'UNKNOWN';       // Unknown error

export interface ErrorMapping {
  category: ErrorCategory;
  retryable: boolean;
  userMessage: string;
}

const ERROR_MAPPINGS: Record<string, ErrorMapping> = {
  // OAuth/Auth errors
  'NOT_CONNECTED': {
    category: 'AUTH',
    retryable: false,
    userMessage: 'Please connect your account first.',
  },
  'TOKEN_EXPIRED': {
    category: 'AUTH',
    retryable: true,
    userMessage: 'Your session has expired. Please reconnect.',
  },
  'TOKEN_REFRESH_FAILED': {
    category: 'AUTH',
    retryable: false,
    userMessage: 'Failed to refresh your connection. Please reconnect.',
  },
  'INSUFFICIENT_PERMISSIONS': {
    category: 'PERMISSION',
    retryable: false,
    userMessage: 'Missing required permissions. Please reconnect with full access.',
  },
  
  // Rate limiting
  'RATE_LIMIT_EXCEEDED': {
    category: 'RATE_LIMIT',
    retryable: true,
    userMessage: 'Too many requests. Please try again in a moment.',
  },
  
  // Network errors
  'NETWORK_ERROR': {
    category: 'NETWORK',
    retryable: true,
    userMessage: 'Network error. Please check your connection.',
  },
  'TIMEOUT': {
    category: 'TIMEOUT',
    retryable: true,
    userMessage: 'Request timed out. Please try again.',
  },
  'SERVICE_UNAVAILABLE': {
    category: 'SERVICE',
    retryable: true,
    userMessage: 'Service temporarily unavailable. Please try again later.',
  },
  
  // Validation
  'INVALID_PARAMETERS': {
    category: 'VALIDATION',
    retryable: false,
    userMessage: 'Invalid request parameters.',
  },
  'NOT_FOUND': {
    category: 'NOT_FOUND',
    retryable: false,
    userMessage: 'Resource not found.',
  },
};

export class IntegrationErrorHandler {
  private integrationName: string;
  
  constructor(integrationName: string) {
    this.integrationName = integrationName;
  }
  
  /**
   * Categorize an error and return standardized IntegrationError
   */
  categorize(error: unknown): IntegrationError {
    // Handle known IntegrationError
    if (this.isIntegrationError(error)) {
      return error;
    }
    
    // Handle Error objects
    if (error instanceof Error) {
      return this.fromError(error);
    }
    
    // Handle HTTP response errors
    if (this.isHttpError(error)) {
      return this.fromHttpError(error);
    }
    
    // Handle string errors
    if (typeof error === 'string') {
      return this.fromString(error);
    }
    
    // Unknown error
    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
      retryable: false,
      details: { originalError: String(error) },
    };
  }
  
  /**
   * Create IntegrationError from Error object
   */
  private fromError(error: Error): IntegrationError {
    const message = error.message.toLowerCase();
    
    // Check for known error patterns
    for (const [code, mapping] of Object.entries(ERROR_MAPPINGS)) {
      if (message.includes(code.toLowerCase().replace(/_/g, ' '))) {
        return {
          code,
          message: mapping.userMessage,
          retryable: mapping.retryable,
          details: { originalMessage: error.message, stack: error.stack },
        };
      }
    }
    
    // Check for specific error patterns
    if (message.includes('not connected') || message.includes('unauthorized')) {
      return {
        code: 'NOT_CONNECTED',
        message: ERROR_MAPPINGS['NOT_CONNECTED'].userMessage,
        retryable: false,
        details: { originalMessage: error.message },
      };
    }
    
    if (message.includes('rate limit') || message.includes('429')) {
      return {
        code: 'RATE_LIMIT_EXCEEDED',
        message: ERROR_MAPPINGS['RATE_LIMIT_EXCEEDED'].userMessage,
        retryable: true,
        details: { originalMessage: error.message },
      };
    }
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return {
        code: 'TIMEOUT',
        message: ERROR_MAPPINGS['TIMEOUT'].userMessage,
        retryable: true,
        details: { originalMessage: error.message },
      };
    }
    
    if (message.includes('network') || message.includes('econnrefused') || message.includes('enotfound')) {
      return {
        code: 'NETWORK_ERROR',
        message: ERROR_MAPPINGS['NETWORK_ERROR'].userMessage,
        retryable: true,
        details: { originalMessage: error.message },
      };
    }
    
    if (message.includes('permission') || message.includes('forbidden') || message.includes('403')) {
      return {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: ERROR_MAPPINGS['INSUFFICIENT_PERMISSIONS'].userMessage,
        retryable: false,
        details: { originalMessage: error.message },
      };
    }
    
    // Default to internal error
    return {
      code: 'INTERNAL_ERROR',
      message: `Error in ${this.integrationName}: ${error.message}`,
      retryable: false,
      details: { originalMessage: error.message, stack: error.stack },
    };
  }
  
  /**
   * Create IntegrationError from HTTP error
   */
  private fromHttpError(error: { status?: number; statusText?: string; message?: string }): IntegrationError {
    const status = error.status || 0;
    
    switch (status) {
      case 400:
        return {
          code: 'INVALID_PARAMETERS',
          message: ERROR_MAPPINGS['INVALID_PARAMETERS'].userMessage,
          retryable: false,
          details: { status, statusText: error.statusText },
        };
      case 401:
        return {
          code: 'NOT_CONNECTED',
          message: ERROR_MAPPINGS['NOT_CONNECTED'].userMessage,
          retryable: false,
          details: { status },
        };
      case 403:
        return {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: ERROR_MAPPINGS['INSUFFICIENT_PERMISSIONS'].userMessage,
          retryable: false,
          details: { status },
        };
      case 404:
        return {
          code: 'NOT_FOUND',
          message: ERROR_MAPPINGS['NOT_FOUND'].userMessage,
          retryable: false,
          details: { status },
        };
      case 429:
        return {
          code: 'RATE_LIMIT_EXCEEDED',
          message: ERROR_MAPPINGS['RATE_LIMIT_EXCEEDED'].userMessage,
          retryable: true,
          details: { status },
        };
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          code: 'SERVICE_UNAVAILABLE',
          message: ERROR_MAPPINGS['SERVICE_UNAVAILABLE'].userMessage,
          retryable: true,
          details: { status },
        };
      default:
        return {
          code: 'UNKNOWN_ERROR',
          message: error.message || 'An unexpected error occurred',
          retryable: status >= 500,
          details: { status, statusText: error.statusText },
        };
    }
  }
  
  /**
   * Create IntegrationError from string
   */
  private fromString(error: string): IntegrationError {
    const lower = error.toLowerCase();
    
    for (const [code, mapping] of Object.entries(ERROR_MAPPINGS)) {
      if (lower.includes(code.toLowerCase().replace(/_/g, ' '))) {
        return {
          code,
          message: mapping.userMessage,
          retryable: mapping.retryable,
          details: { originalMessage: error },
        };
      }
    }
    
    return {
      code: 'UNKNOWN_ERROR',
      message: error,
      retryable: false,
    };
  }
  
  /**
   * Type guard for IntegrationError
   */
  private isIntegrationError(error: unknown): error is IntegrationError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      'retryable' in error
    );
  }
  
  /**
   * Type guard for HTTP error
   */
  private isHttpError(error: unknown): error is { status?: number; statusText?: string; message?: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      ('status' in error || 'statusText' in error)
    );
  }
  
  /**
   * Log error with context
   */
  log(error: IntegrationError, context?: Record<string, any>): void {
    const logData = {
      integration: this.integrationName,
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      },
      context,
      timestamp: new Date().toISOString(),
    };
    
    if (error.retryable) {
      console.warn(`[${this.integrationName}] Retryable error:`, logData);
    } else {
      console.error(`[${this.integrationName}] Error:`, logData);
    }
  }
}

/**
 * Create error handler for an integration
 */
export function createErrorHandler(integrationName: string): IntegrationErrorHandler {
  return new IntegrationErrorHandler(integrationName);
}



