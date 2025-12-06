/**
 * LangGraph Agent Nodes
 * Individual nodes for the agent workflow
 */

import { Node } from "@langchain/langgraph";
import type { AgentState } from "./types";
import { retrieveRelevantContext } from "@/lib/semanticMemory";
import { getUserPatterns, getUserMemories } from "@/lib/database";
import { getChatMessages } from "@/lib/database";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { getFunctionRegistry } from "./functions";

/**
 * Context Retrieval Node
 * Fetches semantic memory, patterns, and conversation history
 */
export const contextRetrievalNode: Node<AgentState> = async (state: AgentState) => {
  try {
    const { recordId, threadId, messages } = state;
    
    if (!recordId) {
      return {
        ...state,
        context: {
          ...state.context,
          semanticContext: "",
          memories: [],
          patterns: [],
          conversationHistory: [],
        },
      };
    }

    // Get the last user message for semantic search
    const lastUserMessage = messages
      .filter((m: any) => m.constructor.name === 'HumanMessage')
      .slice(-1)[0];
    
    const query = lastUserMessage?.content?.toString() || "";

    // Retrieve semantic context
    let semanticContext = "";
    let memories: any[] = [];
    let patterns: any[] = [];

    try {
      const semanticResults = await retrieveRelevantContext(recordId, query, {
        limit: 5,
        similarityThreshold: 0.7,
        threadId,
        includeMemories: true,
        includePatterns: true,
      });

      semanticContext = semanticResults.combinedContext;
      memories = semanticResults.relevantMemories;
      patterns = semanticResults.relevantPatterns;
    } catch (error) {
      console.error('[AGENT] Failed to retrieve semantic context:', error);
    }

    // Get conversation history
    let conversationHistory: any[] = [];
    try {
      if (threadId) {
        const history = await getChatMessages({ threadId, limit: 20 });
        conversationHistory = history.messages || [];
      }
    } catch (error) {
      console.error('[AGENT] Failed to retrieve conversation history:', error);
    }

    return {
      ...state,
      context: {
        semanticContext,
        memories,
        patterns,
        conversationHistory,
      },
    };
  } catch (error) {
    console.error('[AGENT] Context retrieval node failed:', error);
    return state;
  }
};

/**
 * Function Selection Node
 * Determines which functions to call based on context
 */
export const functionSelectionNode: Node<AgentState> = async (state: AgentState) => {
  try {
    const { messages, context, systemPrompt, availableFunctions } = state;
    
    if (!availableFunctions || availableFunctions.length === 0) {
      return {
        ...state,
        functionCalls: [],
      };
    }

    const llm = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.3,
    });

    // Build messages for function selection
    const systemMsg = systemPrompt 
      ? new SystemMessage(systemPrompt + (context.semanticContext ? `\n\n${context.semanticContext}` : ''))
      : new SystemMessage("You are a helpful assistant. Determine which functions to call based on the user's request.");

    const selectionMessages = [
      systemMsg,
      ...messages,
      new HumanMessage("Based on the conversation, which functions should be called? Return a JSON array of function calls with 'name' and 'arguments' fields."),
    ];

    // Use LLM to determine function calls
    // For now, we'll use a simple approach - in production, use structured outputs
    const response = await llm.invoke(selectionMessages);
    
    // Parse function calls from response
    // This is a simplified version - in production, use structured outputs or function calling
    let functionCalls: Array<{ name: string; arguments: any }> = [];
    
    try {
      const content = response.content.toString();
      // Try to extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        functionCalls = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.warn('[AGENT] Failed to parse function calls from response:', error);
    }

    // Validate function calls against available functions
    const validFunctionCalls = functionCalls.filter(fc => 
      availableFunctions.some((af: any) => af.name === fc.name)
    );

    return {
      ...state,
      functionCalls: validFunctionCalls,
    };
  } catch (error) {
    console.error('[AGENT] Function selection node failed:', error);
    return {
      ...state,
      functionCalls: [],
    };
  }
};

/**
 * Function Execution Node
 * Executes the selected functions
 */
export const functionExecutionNode: Node<AgentState> = async (state: AgentState) => {
  try {
    const { functionCalls, recordId, availableFunctions } = state;
    
    if (!functionCalls || functionCalls.length === 0) {
      return {
        ...state,
        functionResults: [],
      };
    }

    const functionRegistry = getFunctionRegistry();
    const results: Array<{ name: string; result: any }> = [];

    for (const funcCall of functionCalls) {
      try {
        const func = functionRegistry.get(funcCall.name);
        if (!func) {
          results.push({
            name: funcCall.name,
            result: { error: `Function ${funcCall.name} not found` },
          });
          continue;
        }

        // Execute function with recordId if needed
        const args = {
          ...funcCall.arguments,
          recordId: funcCall.arguments.recordId || recordId,
        };

        const result = await func.execute(args);
        results.push({
          name: funcCall.name,
          result,
        });
      } catch (error) {
        console.error(`[AGENT] Function execution failed for ${funcCall.name}:`, error);
        results.push({
          name: funcCall.name,
          result: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    // Add function results to messages
    const functionMessages = results.map(r => 
      new AIMessage(`Function ${r.name} returned: ${JSON.stringify(r.result)}`)
    );

    return {
      ...state,
      functionResults: results,
      messages: [...state.messages, ...functionMessages],
    };
  } catch (error) {
    console.error('[AGENT] Function execution node failed:', error);
    return state;
  }
};

/**
 * Response Generation Node
 * Generates the final response using all context
 */
export const responseGenerationNode: Node<AgentState> = async (state: AgentState) => {
  try {
    const { messages, context, systemPrompt, functionResults } = state;

    const llm = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.3,
      maxTokens: 4000,
    });

    // Build system prompt with context
    let fullSystemPrompt = systemPrompt || "You are a helpful assistant.";
    
    if (context.semanticContext) {
      fullSystemPrompt += `\n\n${context.semanticContext}`;
    }

    if (functionResults && functionResults.length > 0) {
      fullSystemPrompt += `\n\nFunction execution results:\n${functionResults.map(r => 
        `${r.name}: ${JSON.stringify(r.result)}`
      ).join('\n')}`;
    }

    const systemMsg = new SystemMessage(fullSystemPrompt);
    const responseMessages = [systemMsg, ...messages];

    const response = await llm.invoke(responseMessages);
    const responseText = response.content.toString();

    return {
      ...state,
      response: responseText,
      messages: [...state.messages, response],
    };
  } catch (error) {
    console.error('[AGENT] Response generation node failed:', error);
    return {
      ...state,
      response: "I apologize, but I encountered an error generating a response. Please try again.",
    };
  }
};

