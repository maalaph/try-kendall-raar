/**
 * Workflow execution engine
 * Handles multi-step workflows with conditional logic
 */

export interface WorkflowStep {
  id: string;
  type: 'call' | 'message' | 'schedule' | 'wait' | 'condition' | 'action';
  config: Record<string, any>;
  onSuccess?: string; // Next step ID on success
  onFailure?: string; // Next step ID on failure
  condition?: {
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
    value: any;
  };
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  enabled: boolean;
}

/**
 * Execute a workflow step by step
 */
export async function executeWorkflow(
  workflow: Workflow,
  context: Record<string, any>
): Promise<{
  success: boolean;
  results: Array<{ stepId: string; success: boolean; result?: any; error?: string }>;
}> {
  const results: Array<{ stepId: string; success: boolean; result?: any; error?: string }> = [];
  let currentStepId: string | undefined = workflow.steps[0]?.id;
  const executedSteps = new Set<string>();

  while (currentStepId && !executedSteps.has(currentStepId)) {
    const step = workflow.steps.find(s => s.id === currentStepId);
    if (!step) break;

    executedSteps.add(currentStepId);

    try {
      // Check condition if present
      if (step.condition) {
        const fieldValue = context[step.condition.field];
        let conditionMet = false;

        switch (step.condition.operator) {
          case 'equals':
            conditionMet = fieldValue === step.condition.value;
            break;
          case 'contains':
            conditionMet = String(fieldValue).includes(String(step.condition.value));
            break;
          case 'greater_than':
            conditionMet = Number(fieldValue) > Number(step.condition.value);
            break;
          case 'less_than':
            conditionMet = Number(fieldValue) < Number(step.condition.value);
            break;
        }

        if (!conditionMet) {
          results.push({
            stepId: step.id,
            success: true,
            result: { skipped: true, reason: 'Condition not met' },
          });
          currentStepId = step.onFailure || undefined;
          continue;
        }
      }

      // Execute step based on type
      let stepResult: any;

      switch (step.type) {
        case 'wait':
          await new Promise(resolve => setTimeout(resolve, (step.config.duration || 0) * 1000));
          stepResult = { waited: step.config.duration };
          break;

        case 'action':
          // Generic action - would be executed based on config
          stepResult = { action: step.config.action, executed: true };
          break;

        default:
          stepResult = { type: step.type, config: step.config };
      }

      results.push({
        stepId: step.id,
        success: true,
        result: stepResult,
      });

      // Move to next step
      currentStepId = step.onSuccess || undefined;
    } catch (error) {
      results.push({
        stepId: step.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Move to failure handler or stop
      currentStepId = step.onFailure || undefined;
    }
  }

  return {
    success: results.every(r => r.success || r.result?.skipped),
    results,
  };
}




