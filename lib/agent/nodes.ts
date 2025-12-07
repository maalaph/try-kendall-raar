/**
 * LangGraph Agent Nodes
 * Individual nodes for the agent workflow
 */

import type { AgentState } from "./types";
import { retrieveRelevantContext } from "@/lib/semanticMemory";
import { getUserPatterns, getUserMemories } from "@/lib/database";
import { getChatMessages } from "@/lib/database";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { getFunctionRegistry } from "./functions";

// Node function type for LangGraph
type NodeFunction<T> = (state: T) => Promise<Partial<T>>;

/**
 * Context Retrieval Node
 * Fetches semantic memory, patterns, and conversation history
 */
export const contextRetrievalNode: NodeFunction<AgentState> = async (state: AgentState) => {
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
 * Determines which functions to call based on context using OpenAI function calling
 */
export const functionSelectionNode: NodeFunction<AgentState> = async (state: AgentState) => {
  try {
    const { messages, context, systemPrompt, availableFunctions } = state;
    
    if (!availableFunctions || availableFunctions.length === 0) {
      console.log('[AGENT] No available functions, skipping function selection');
      return {
        ...state,
        functionCalls: [],
      };
    }

    // Define full function schemas for OpenAI function calling
    const functionSchemas = [
      {
        name: 'get_user_location',
        description: 'Get the user\'s current location. ALWAYS use this when the user asks about nearby places, restaurants, directions, recommendations based on location, "what\'s around me", "places near me", coffee shops, or any location-based query.',
        parameters: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              description: 'Brief explanation of why location is needed (e.g., "find nearby coffee shops", "get directions")',
            },
          },
          required: ['reason'],
        },
      },
      {
        name: 'make_outbound_call',
        description: 'Make an immediate outbound phone call. Only use after you have the person\'s name, phone number, and exact message.',
        parameters: {
          type: 'object',
          properties: {
            phoneNumber: { type: 'string', description: 'Phone number to call' },
            contactName: { type: 'string', description: 'Name of person to call' },
            message: { type: 'string', description: 'Message to deliver' },
          },
          required: ['phoneNumber', 'contactName', 'message'],
        },
      },
      {
        name: 'schedule_outbound_call',
        description: 'Schedule a call for later.',
        parameters: {
          type: 'object',
          properties: {
            phoneNumber: { type: 'string' },
            contactName: { type: 'string' },
            message: { type: 'string' },
            scheduledTime: { type: 'string' },
          },
          required: ['phoneNumber', 'contactName', 'message', 'scheduledTime'],
        },
      },
      {
        name: 'show_places_nearby',
        description: 'Show an interactive map with nearby places.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Type of place to find' },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
          },
          required: ['query', 'latitude', 'longitude'],
        },
      },
    ];

    // Filter to only functions that are available
    const tools = functionSchemas
      .filter(fn => availableFunctions.some((af: any) => af.name === fn.name))
      .map(fn => ({
        type: 'function' as const,
        function: fn,
      }));

    if (tools.length === 0) {
      console.log('[AGENT] No matching function schemas found');
      return {
        ...state,
        functionCalls: [],
      };
    }

    const llm = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.3,
    });

    // Bind tools to LLM for proper function calling
    const llmWithTools = llm.bind({ tools, tool_choice: 'auto' });

    // Build messages for function selection
    const systemMsg = systemPrompt 
      ? new SystemMessage(systemPrompt + (context.semanticContext ? `\n\n${context.semanticContext}` : ''))
      : new SystemMessage("You are a helpful assistant. Use the available functions when appropriate to help the user. For location-based queries like 'near me', 'nearby', 'around here', etc., ALWAYS use get_user_location first.");

    const selectionMessages = [
      systemMsg,
      ...messages,
    ];

    console.log('[AGENT] Invoking LLM with tools:', tools.map(t => t.function.name));

    // Use LLM with function calling
    const response = await llmWithTools.invoke(selectionMessages);
    
    // Extract tool calls from response
    let functionCalls: Array<{ name: string; arguments: any }> = [];
    
    // Check for tool_calls in the response (OpenAI format)
    const toolCalls = (response as any).tool_calls || (response as any).additional_kwargs?.tool_calls;
    
    if (toolCalls && Array.isArray(toolCalls)) {
      console.log('[AGENT] Tool calls detected:', toolCalls.length);
      functionCalls = toolCalls.map((tc: any) => ({
        name: tc.function?.name || tc.name,
        arguments: typeof tc.function?.arguments === 'string' 
          ? JSON.parse(tc.function.arguments) 
          : (tc.function?.arguments || tc.arguments || {}),
      }));
    }

    console.log('[AGENT] Function calls selected:', functionCalls.map(fc => fc.name));

    return {
      ...state,
      functionCalls,
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
export const functionExecutionNode: NodeFunction<AgentState> = async (state: AgentState) => {
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
export const responseGenerationNode: NodeFunction<AgentState> = async (state: AgentState) => {
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


