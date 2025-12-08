/**
 * Integration Registry Type Definitions
 * Standardized interfaces for all integrations
 */

export type IntegrationCategory = 
  | 'communication'  // Gmail, SMS, etc.
  | 'calendar'       // Google Calendar, etc.
  | 'music'          // Spotify, Apple Music, etc.
  | 'productivity'   // Notion, Todoist, etc.
  | 'financial'      // Plaid, Stripe, etc.
  | 'social'         // Twitter, LinkedIn, etc.
  | 'commerce'       // Amazon, Shopify, etc.
  | 'utility'        // Weather, Maps, etc.
  | 'custom';        // User-defined

export type AuthType = 'oauth2' | 'api_key' | 'basic' | 'none';

export interface IntegrationConfig {
  /** Unique identifier for the integration */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Category for grouping */
  category: IntegrationCategory;
  /** Authentication type required */
  authType: AuthType;
  /** Icon URL or emoji */
  icon?: string;
  /** Whether this integration is enabled */
  enabled: boolean;
  /** Rate limit: requests per minute */
  rateLimit?: number;
  /** Required scopes for OAuth */
  scopes?: string[];
  /** Environment variables required */
  requiredEnvVars?: string[];
}

export interface IntegrationFunction {
  /** Function name (used in agent calls) */
  name: string;
  /** Human-readable description */
  description: string;
  /** JSON schema for parameters */
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      default?: any;
    }>;
    required: string[];
  };
  /** Whether this function requires approval before execution */
  requiresApproval?: boolean;
  /** Approval type if requires approval */
  approvalType?: 'purchase' | 'payment' | 'transfer' | 'booking' | 'subscription' | 'financial' | 'irreversible';
  /** Estimated cost category */
  costCategory?: 'free' | 'low' | 'medium' | 'high';
}

export interface IntegrationError {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, any>;
}

export interface IntegrationResult<T = any> {
  success: boolean;
  data?: T;
  error?: IntegrationError;
  metadata?: {
    duration?: number;
    cached?: boolean;
    retries?: number;
  };
}

export interface Integration {
  /** Configuration */
  config: IntegrationConfig;
  
  /** Available functions */
  functions: IntegrationFunction[];
  
  /** Initialize the integration */
  initialize(): Promise<void>;
  
  /** Check if user is connected/authenticated */
  isConnected(userId: string): Promise<boolean>;
  
  /** Execute a function */
  execute(
    functionName: string,
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<IntegrationResult>;
  
  /** Get OAuth URL (if applicable) */
  getAuthUrl?(userId: string, redirectUrl: string): Promise<string>;
  
  /** Handle OAuth callback (if applicable) */
  handleAuthCallback?(userId: string, code: string): Promise<void>;
  
  /** Disconnect/revoke access */
  disconnect?(userId: string): Promise<void>;
}

export interface ExecutionContext {
  userId: string;
  recordId: string;
  threadId?: string;
  agentId?: string;
  /** For approval workflow */
  approvalId?: string;
  /** Request metadata */
  requestId?: string;
  timestamp?: Date;
}

export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

export interface RateLimitOptions {
  requestsPerMinute: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    'RATE_LIMIT',
    'TIMEOUT',
    'SERVICE_UNAVAILABLE',
    'NETWORK_ERROR',
  ],
};

export const DEFAULT_RATE_LIMIT: RateLimitOptions = {
  requestsPerMinute: 60,
  requestsPerHour: 1000,
  requestsPerDay: 10000,
};



