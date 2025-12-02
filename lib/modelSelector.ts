/**
 * Smart Model Selection for Cost Optimization
 * Routes requests to appropriate models based on complexity
 */

import { analyzeSentiment } from './sentiment';

export type ModelType = 'gpt-4o' | 'gpt-4o-mini';

interface TaskComplexity {
  isComplex: boolean;
  reason?: string;
}

/**
 * Determine if a task requires GPT-4o or can use GPT-4o-mini
 * GPT-4o-mini is ~10x cheaper, use it for simple tasks
 */
export function selectModel(
  message: string,
  contextLength: number = 0,
  taskType: 'chat' | 'analysis' | 'pattern' | 'memory' | 'suggestion' = 'chat'
): ModelType {
  // Use mini for simple, routine tasks
  if (taskType === 'suggestion' || taskType === 'pattern' || taskType === 'memory') {
    return 'gpt-4o-mini';
  }

  // Analyze message complexity
  const complexity = analyzeComplexity(message, contextLength);

  // Use GPT-4o for complex reasoning, mini for simple responses
  return complexity.isComplex ? 'gpt-4o' : 'gpt-4o-mini';
}

/**
 * Analyze if a message requires complex reasoning
 */
function analyzeComplexity(message: string, contextLength: number): TaskComplexity {
  const lowerMessage = message.toLowerCase();

  // Simple indicators (use mini)
  const simpleIndicators = [
    /^(hi|hey|hello|thanks|thank you|ok|okay|yes|no|got it|sure|yep|nope)/i,
    /^(call|schedule|remind|check|show|tell|send)/i,
    message.length < 50, // Short messages
  ];

  // Complex indicators (use GPT-4o)
  const complexIndicators = [
    /(analyze|explain|how does|why|compare|plan|design|build|create|write|code|debug)/i,
    /(complex|difficult|challenge|problem|issue|error|help me understand)/i,
    message.includes('?') && message.length > 100, // Long questions
    contextLength > 2000, // Long context requires better model
  ];

  // Check for code/technical content
  const hasCode = /```|function|const |let |var |class |import |export /i.test(message);
  
  // Check for multi-step instructions
  const hasMultipleSteps = /(then|after|next|and then|also|additionally)/i.test(message);

  // Count complex indicators
  const simpleCount = simpleIndicators.filter(ind => 
    typeof ind === 'boolean' ? ind : ind.test(message)
  ).length;

  const complexCount = complexIndicators.filter(ind => 
    typeof ind === 'boolean' ? ind : ind.test(message)
  ).length;

  // Quality-first decision logic: Conservative approach
  // Only use mini for clearly simple, non-critical tasks
  
  // Always use GPT-4o for complex tasks
  if (hasCode || hasMultipleSteps || complexCount > 0) {
    return { isComplex: true, reason: 'Requires advanced reasoning' };
  }

  // Only use mini for very simple, single-action tasks
  if (simpleCount > 0 && complexCount === 0 && !hasCode && message.length < 100 && !message.includes('?')) {
    return { isComplex: false, reason: 'Very simple task' };
  }

  // Default to GPT-4o for quality - conservative approach
  return { isComplex: true, reason: 'Default to GPT-4o for quality' };
}

/**
 * Get token estimates for cost calculation
 */
export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

/**
 * Calculate estimated cost for a request
 */
export function estimateCost(
  model: ModelType,
  inputTokens: number,
  outputTokens: number
): number {
  // GPT-4o pricing (per million tokens)
  const GPT4O_INPUT = 2.50;
  const GPT4O_OUTPUT = 10.00;
  
  // GPT-4o-mini pricing (per million tokens) - much cheaper!
  const GPT4O_MINI_INPUT = 0.15;
  const GPT4O_MINI_OUTPUT = 0.60;

  if (model === 'gpt-4o-mini') {
    return (inputTokens / 1_000_000) * GPT4O_MINI_INPUT + 
           (outputTokens / 1_000_000) * GPT4O_MINI_OUTPUT;
  }

  return (inputTokens / 1_000_000) * GPT4O_INPUT + 
         (outputTokens / 1_000_000) * GPT4O_OUTPUT;
}

