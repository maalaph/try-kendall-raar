/**
 * LangGraph Agent Edges
 * Conditional routing logic for the agent workflow
 */

import type { AgentState } from "./types";

/**
 * Determine if functions should be called
 */
export function shouldCallFunctions(state: AgentState): "call" | "skip" {
  const { functionCalls } = state;
  
  // If there are function calls to make, route to function execution
  if (functionCalls && functionCalls.length > 0) {
    return "call";
  }
  
  // Otherwise, skip to response generation
  return "skip";
}

/**
 * Determine if we should continue with more function calls or end
 */
export function shouldContinue(state: AgentState): "continue" | "end" {
  const { functionResults, functionCalls } = state;
  
  // If we have function results and there might be follow-up calls needed
  // For now, we'll end after one round of function calls
  // In a more advanced implementation, we could check if results indicate more calls are needed
  
  if (functionResults && functionResults.length > 0) {
    // Check if any function result indicates we need more information
    const needsMoreInfo = functionResults.some((result: any) => {
      if (result.result && typeof result.result === 'object') {
        // Check for common patterns that indicate more info is needed
        const resultStr = JSON.stringify(result.result).toLowerCase();
        return resultStr.includes('missing') || 
               resultStr.includes('required') || 
               resultStr.includes('not found') ||
               resultStr.includes('error');
      }
      return false;
    });

    // If we need more info and haven't made too many calls, continue
    if (needsMoreInfo && (functionCalls?.length || 0) < 3) {
      return "continue";
    }
  }
  
  // End and generate response
  return "end";
}

