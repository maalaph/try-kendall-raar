/**
 * Base Integration Class
 * Abstract class that all integrations extend
 */

import {
  Integration,
  IntegrationConfig,
  IntegrationFunction,
  IntegrationResult,
  IntegrationError,
  ExecutionContext,
  RetryOptions,
  RateLimitOptions,
} from './types';
import { IntegrationErrorHandler, createErrorHandler } from './errorHandler';
import { withRetry, RetryPresets } from './retry';
import { IntegrationRateLimiter, getRateLimiter, RateLimitPresets } from './rateLimiter';

export abstract class BaseIntegration implements Integration {
  abstract config: IntegrationConfig;
  abstract functions: IntegrationFunction[];
  
  protected errorHandler: IntegrationErrorHandler;
  protected rateLimiter: IntegrationRateLimiter;
  protected retryOptions: RetryOptions;
  protected initialized: boolean = false;
  
  constructor() {
    // Will be set up in initialize()
    this.errorHandler = null as any;
    this.rateLimiter = null as any;
    this.retryOptions = RetryPresets.standard;
  }
  
  /**
   * Initialize the integration
   * Must be called before use
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Set up error handler
    this.errorHandler = createErrorHandler(this.config.id);
    
    // Set up rate limiter
    const rateLimitOptions: Partial<RateLimitOptions> = this.config.rateLimit
      ? { requestsPerMinute: this.config.rateLimit }
      : RateLimitPresets.standard;
    this.rateLimiter = getRateLimiter(this.config.id, rateLimitOptions);
    
    // Run integration-specific setup
    await this.setup();
    
    this.initialized = true;
    console.log(`[${this.config.id}] Integration initialized`);
  }
  
  /**
   * Integration-specific setup (override in subclass)
   */
  protected async setup(): Promise<void> {
    // Override in subclass if needed
  }
  
  /**
   * Check if user is connected (override in subclass)
   */
  abstract isConnected(userId: string): Promise<boolean>;
  
  /**
   * Execute a function with error handling, retry, and rate limiting
   */
  async execute(
    functionName: string,
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<IntegrationResult> {
    const startTime = Date.now();
    
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Find function
    const func = this.functions.find(f => f.name === functionName);
    if (!func) {
      return {
        success: false,
        error: {
          code: 'FUNCTION_NOT_FOUND',
          message: `Function ${functionName} not found in ${this.config.id}`,
          retryable: false,
        },
      };
    }
    
    // Check rate limit
    const rateLimitResult = this.rateLimiter.acquire(context.userId);
    if (!rateLimitResult.success) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded. Please try again in ${Math.ceil((rateLimitResult.waitMs || 0) / 1000)} seconds.`,
          retryable: true,
          details: { waitMs: rateLimitResult.waitMs },
        },
        metadata: {
          duration: Date.now() - startTime,
        },
      };
    }
    
    // Check if connected (for OAuth integrations)
    if (this.config.authType === 'oauth2') {
      const connected = await this.isConnected(context.userId);
      if (!connected) {
        return {
          success: false,
          error: {
            code: 'NOT_CONNECTED',
            message: `Please connect your ${this.config.name} account first.`,
            retryable: false,
          },
          metadata: {
            duration: Date.now() - startTime,
          },
        };
      }
    }
    
    // Execute with retry
    const { result, error, state } = await withRetry(
      () => this.executeFunction(functionName, args, context),
      (err) => this.errorHandler.categorize(err),
      this.retryOptions
    );
    
    const duration = Date.now() - startTime;
    
    if (error) {
      this.errorHandler.log(error, { functionName, args, context });
      return {
        success: false,
        error,
        metadata: {
          duration,
          retries: state.attempt - 1,
        },
      };
    }
    
    return {
      success: true,
      data: result,
      metadata: {
        duration,
        retries: state.attempt - 1,
      },
    };
  }
  
  /**
   * Execute a specific function (override in subclass)
   */
  protected abstract executeFunction(
    functionName: string,
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any>;
  
  /**
   * Get function schemas for agent
   */
  getFunctionSchemas(): Array<{
    name: string;
    description: string;
    parameters: IntegrationFunction['parameters'];
  }> {
    return this.functions.map(f => ({
      name: `${this.config.id}_${f.name}`,
      description: f.description,
      parameters: f.parameters,
    }));
  }
  
  /**
   * Get functions that require approval
   */
  getApprovalRequiredFunctions(): IntegrationFunction[] {
    return this.functions.filter(f => f.requiresApproval);
  }
  
  /**
   * Validate function parameters
   */
  protected validateParams(
    func: IntegrationFunction,
    args: Record<string, any>
  ): IntegrationError | null {
    const { properties, required } = func.parameters;
    
    // Check required fields
    for (const field of required) {
      if (args[field] === undefined || args[field] === null) {
        return {
          code: 'INVALID_PARAMETERS',
          message: `Missing required parameter: ${field}`,
          retryable: false,
          details: { field, expected: properties[field] },
        };
      }
    }
    
    // Type validation
    for (const [key, value] of Object.entries(args)) {
      const schema = properties[key];
      if (!schema) continue;
      
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      const expectedType = schema.type;
      
      if (actualType !== expectedType && expectedType !== 'any') {
        return {
          code: 'INVALID_PARAMETERS',
          message: `Parameter ${key} should be ${expectedType}, got ${actualType}`,
          retryable: false,
          details: { field: key, expected: expectedType, actual: actualType },
        };
      }
      
      // Enum validation
      if (schema.enum && !schema.enum.includes(value)) {
        return {
          code: 'INVALID_PARAMETERS',
          message: `Parameter ${key} must be one of: ${schema.enum.join(', ')}`,
          retryable: false,
          details: { field: key, allowed: schema.enum, actual: value },
        };
      }
    }
    
    return null;
  }
  
  /**
   * Helper to create successful result
   */
  protected success<T>(data: T): IntegrationResult<T> {
    return { success: true, data };
  }
  
  /**
   * Helper to create error result
   */
  protected failure(error: IntegrationError): IntegrationResult {
    return { success: false, error };
  }
  
  /**
   * Set retry options
   */
  setRetryOptions(options: Partial<RetryOptions>): void {
    this.retryOptions = { ...this.retryOptions, ...options };
  }
}

/**
 * Helper to create a simple integration without class
 */
export function createSimpleIntegration(
  config: IntegrationConfig,
  functions: IntegrationFunction[],
  executor: (
    functionName: string,
    args: Record<string, any>,
    context: ExecutionContext
  ) => Promise<any>,
  isConnected: (userId: string) => Promise<boolean> = async () => true
): Integration {
  class SimpleIntegration extends BaseIntegration {
    config = config;
    functions = functions;
    
    async isConnected(userId: string): Promise<boolean> {
      return isConnected(userId);
    }
    
    protected async executeFunction(
      functionName: string,
      args: Record<string, any>,
      context: ExecutionContext
    ): Promise<any> {
      return executor(functionName, args, context);
    }
  }
  
  return new SimpleIntegration();
}



