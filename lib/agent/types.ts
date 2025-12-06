/**
 * Agent State Types for LangGraph
 */

import { BaseMessage } from "@langchain/core/messages";

export interface AgentState {
  messages: BaseMessage[];
  context: {
    semanticContext?: string;
    memories?: any[];
    patterns?: any[];
    conversationHistory?: any[];
  };
  functionCalls: Array<{
    name: string;
    arguments: any;
  }>;
  functionResults: Array<{
    name: string;
    result: any;
  }>;
  response: string;
  recordId: string;
  threadId: string;
  systemPrompt?: string;
  availableFunctions?: any[];
}

