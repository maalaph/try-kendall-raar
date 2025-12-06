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
  });

  // Add nodes
  workflow.addNode("context_retrieval", contextRetrievalNode);
  workflow.addNode("function_selection", functionSelectionNode);
  workflow.addNode("function_execution", functionExecutionNode);
  workflow.addNode("response_generation", responseGenerationNode);

  // Set entry point
  workflow.setEntryPoint("context_retrieval");

  // Add edges
  workflow.addEdge("context_retrieval", "function_selection");
  workflow.addConditionalEdges(
    "function_selection",
    shouldCallFunctions,
    {
      call: "function_execution",
      skip: "response_generation",
    }
  );
  workflow.addConditionalEdges(
    "function_execution",
    shouldContinue,
    {
      continue: "function_selection",
      end: "response_generation",
    }
  );
  workflow.addEdge("response_generation", END);

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
    
    return result;
  } catch (error) {
    console.error('[AGENT] LangGraph execution failed:', error);
    // Return state with error message
    return {
      ...state,
      response: "I encountered an error processing your request. Please try again.",
    };
  }
}

