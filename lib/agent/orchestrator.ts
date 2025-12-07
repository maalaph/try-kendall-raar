/**
 * LangGraph Agent Orchestrator
 * Advanced agent orchestration using LangGraph state graphs with checkpointing
 * 
 * CRITICAL: Uses PostgresCheckpointer for state persistence.
 * Without checkpointing, the graph's state disappears after each API response.
 */

import { StateGraph, END } from "@langchain/langgraph";
import { HumanMessage, BaseMessage } from "@langchain/core/messages";
import type { AgentState } from "./types";
import { contextRetrievalNode } from "./nodes";
import { functionSelectionNode } from "./nodes";
import { functionExecutionNode } from "./nodes";
import { responseGenerationNode } from "./nodes";
import { shouldCallFunctions, shouldContinue } from "./edges";
import { getCheckpointer, getCheckpointConfig } from "./checkpointer";

/**
 * Create the agent graph with checkpointing
 * Uses LangGraph v2 API with proper state management and persistence
 */
export async function createAgentGraph(checkpointer?: any) {
  // Create state graph with proper reducer functions
  // Using 'as any' to bypass LangGraph v2 API type changes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workflow = new StateGraph<AgentState>({
    channels: {
      messages: {
        reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
        default: () => [],
      },
      context: {
        reducer: (x: any, y: any) => ({ ...x, ...y }),
        default: () => ({}),
      },
      functionCalls: {
        reducer: (x: any[], y: any[]) => x.concat(y),
        default: () => [],
      },
      functionResults: {
        reducer: (x: any[], y: any[]) => x.concat(y),
        default: () => [],
      },
      response: {
        default: () => "",
      },
      recordId: {
        default: () => "",
      },
      threadId: {
        default: () => "",
      },
      systemPrompt: {
        default: () => "",
      },
      availableFunctions: {
        default: () => [],
      },
    },
  } as any);

  // Add nodes
  workflow.addNode("context_retrieval", contextRetrievalNode);
  workflow.addNode("function_selection", functionSelectionNode);
  workflow.addNode("function_execution", functionExecutionNode);
  workflow.addNode("response_generation", responseGenerationNode);

  // Add edges (using __start__ for entry point in LangGraph v2)
  // Cast to any to bypass strict typing in newer LangGraph versions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graph = workflow as any;
  graph.addEdge("__start__", "context_retrieval");
  graph.addEdge("context_retrieval", "function_selection");
  graph.addConditionalEdges(
    "function_selection",
    shouldCallFunctions,
    {
      call: "function_execution",
      skip: "response_generation",
    }
  );
  graph.addConditionalEdges(
    "function_execution",
    shouldContinue,
    {
      continue: "function_selection",
      end: "response_generation",
    }
  );
  graph.addEdge("response_generation", END);

  // Compile graph with checkpointer for state persistence
  // If checkpointer is not provided, try to get it (may fail if SUPABASE_DB_URL not set)
  let store = checkpointer;
  if (!store) {
    try {
      store = await getCheckpointer();
      console.log("[AGENT] Using Postgres checkpointer for state persistence");
    } catch (error) {
      console.warn(
        "[AGENT] Checkpointer not available, graph will run without state persistence:",
        error instanceof Error ? error.message : String(error)
      );
      // Continue without checkpointing (graceful degradation)
    }
  }

  return workflow.compile({ checkpointer: store });
}

/**
 * Run the agent with initial state
 * Uses checkpointing to persist state across executions
 */
export async function runAgent(
  state: AgentState
): Promise<AgentState> {
  try {
    const graph = await createAgentGraph();
    
    // Get checkpoint config using threadId from state
    // This associates the execution with a specific thread for state persistence
    const config = state.threadId 
      ? getCheckpointConfig(state.threadId)
      : undefined;

    // Invoke graph with checkpoint config
    // If config is provided, state will be persisted and can be resumed later
    const result = await graph.invoke(state, config);
    
    return result as AgentState;
  } catch (error) {
    console.error('[AGENT] LangGraph execution failed:', error);
    
    // If it's a database connection error, provide more helpful message
    if (error instanceof Error && error.message.includes('ENOTFOUND')) {
      console.error('[AGENT] Database connection failed. Check SUPABASE_DB_URL and network connectivity.');
    }
    
    // Throw error instead of returning error state - let caller handle fallback
    throw error;
  }
}

