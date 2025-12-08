/**
 * Integration Registry
 * Central registry for all integrations
 */

import {
  Integration,
  IntegrationConfig,
  IntegrationFunction,
  IntegrationResult,
  ExecutionContext,
} from './types';

interface RegistryEntry {
  integration: Integration;
  registered: Date;
}

/**
 * Central registry for managing integrations
 */
class IntegrationRegistry {
  private integrations: Map<string, RegistryEntry> = new Map();
  private initialized: boolean = false;
  
  /**
   * Register an integration
   */
  register(integration: Integration): void {
    const { id } = integration.config;
    
    if (this.integrations.has(id)) {
      console.warn(`[REGISTRY] Integration ${id} already registered, replacing...`);
    }
    
    this.integrations.set(id, {
      integration,
      registered: new Date(),
    });
    
    console.log(`[REGISTRY] Registered integration: ${id}`);
  }
  
  /**
   * Unregister an integration
   */
  unregister(id: string): boolean {
    return this.integrations.delete(id);
  }
  
  /**
   * Get an integration by ID
   */
  get(id: string): Integration | undefined {
    return this.integrations.get(id)?.integration;
  }
  
  /**
   * Get all registered integrations
   */
  getAll(): Integration[] {
    return Array.from(this.integrations.values()).map(e => e.integration);
  }
  
  /**
   * Get integrations by category
   */
  getByCategory(category: string): Integration[] {
    return this.getAll().filter(i => i.config.category === category);
  }
  
  /**
   * Get enabled integrations
   */
  getEnabled(): Integration[] {
    return this.getAll().filter(i => i.config.enabled);
  }
  
  /**
   * Initialize all registered integrations
   */
  async initializeAll(): Promise<void> {
    if (this.initialized) return;
    
    const integrations = this.getAll();
    console.log(`[REGISTRY] Initializing ${integrations.length} integrations...`);
    
    const results = await Promise.allSettled(
      integrations.map(i => i.initialize())
    );
    
    results.forEach((result, index) => {
      const id = integrations[index].config.id;
      if (result.status === 'rejected') {
        console.error(`[REGISTRY] Failed to initialize ${id}:`, result.reason);
      }
    });
    
    this.initialized = true;
    console.log('[REGISTRY] All integrations initialized');
  }
  
  /**
   * Execute a function from an integration
   */
  async execute(
    integrationId: string,
    functionName: string,
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<IntegrationResult> {
    const integration = this.get(integrationId);
    
    if (!integration) {
      return {
        success: false,
        error: {
          code: 'INTEGRATION_NOT_FOUND',
          message: `Integration ${integrationId} not found`,
          retryable: false,
        },
      };
    }
    
    if (!integration.config.enabled) {
      return {
        success: false,
        error: {
          code: 'INTEGRATION_DISABLED',
          message: `Integration ${integrationId} is currently disabled`,
          retryable: false,
        },
      };
    }
    
    return integration.execute(functionName, args, context);
  }
  
  /**
   * Get all function schemas for agent
   */
  getAllFunctionSchemas(): Array<{
    integration: string;
    name: string;
    description: string;
    parameters: IntegrationFunction['parameters'];
    requiresApproval?: boolean;
    approvalType?: string;
  }> {
    const schemas: Array<{
      integration: string;
      name: string;
      description: string;
      parameters: IntegrationFunction['parameters'];
      requiresApproval?: boolean;
      approvalType?: string;
    }> = [];
    
    for (const integration of this.getEnabled()) {
      for (const func of integration.functions) {
        schemas.push({
          integration: integration.config.id,
          name: `${integration.config.id}_${func.name}`,
          description: `[${integration.config.name}] ${func.description}`,
          parameters: func.parameters,
          requiresApproval: func.requiresApproval,
          approvalType: func.approvalType,
        });
      }
    }
    
    return schemas;
  }
  
  /**
   * Get functions that require approval
   */
  getApprovalRequiredFunctions(): Array<{
    integration: string;
    functionName: string;
    approvalType: string;
  }> {
    const functions: Array<{
      integration: string;
      functionName: string;
      approvalType: string;
    }> = [];
    
    for (const integration of this.getEnabled()) {
      for (const func of integration.functions) {
        if (func.requiresApproval && func.approvalType) {
          functions.push({
            integration: integration.config.id,
            functionName: func.name,
            approvalType: func.approvalType,
          });
        }
      }
    }
    
    return functions;
  }
  
  /**
   * Check if a function requires approval
   */
  requiresApproval(integrationId: string, functionName: string): boolean {
    const integration = this.get(integrationId);
    if (!integration) return false;
    
    const func = integration.functions.find(f => f.name === functionName);
    return func?.requiresApproval || false;
  }
  
  /**
   * Get integration configs for UI
   */
  getConfigs(): IntegrationConfig[] {
    return this.getAll().map(i => i.config);
  }
  
  /**
   * Check connection status for user
   */
  async getConnectionStatus(userId: string): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {};
    
    for (const integration of this.getAll()) {
      try {
        status[integration.config.id] = await integration.isConnected(userId);
      } catch (error) {
        status[integration.config.id] = false;
      }
    }
    
    return status;
  }
}

// Singleton instance
let registryInstance: IntegrationRegistry | null = null;

/**
 * Get the global integration registry
 */
export function getIntegrationRegistry(): IntegrationRegistry {
  if (!registryInstance) {
    registryInstance = new IntegrationRegistry();
  }
  return registryInstance;
}

/**
 * Register an integration with the global registry
 */
export function registerIntegration(integration: Integration): void {
  getIntegrationRegistry().register(integration);
}

/**
 * Execute an integration function
 */
export async function executeIntegration(
  integrationId: string,
  functionName: string,
  args: Record<string, any>,
  context: ExecutionContext
): Promise<IntegrationResult> {
  return getIntegrationRegistry().execute(integrationId, functionName, args, context);
}

// Re-export types
export * from './types';
export { BaseIntegration, createSimpleIntegration } from './base';
export { createErrorHandler, IntegrationErrorHandler } from './errorHandler';
export { withRetry, RetryPresets } from './retry';
export { getRateLimiter, RateLimitPresets, IntegrationRateLimiter } from './rateLimiter';



