/**
 * LangGraph Checkpointer for State Persistence
 * 
 * CRITICAL: Without checkpointing, LangGraph is stateless by default.
 * In a Next.js API route, the graph's memory (State) disappears as soon as the response is sent.
 * This makes multi-turn conversations, complex workflows, and stateful agent behavior impossible.
 * 
 * This checkpointer saves graph state to Supabase PostgreSQL automatically after each node execution.
 * It enables "Human-in-the-Loop" scenarios (e.g., asking user "Shall I send this email?")
 * and allows the graph to resume exactly where it left off hours/days later.
 */

import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

let checkpointerInstance: PostgresSaver | null = null;

/**
 * Get or create the Postgres checkpointer instance
 * Uses Supabase PostgreSQL connection from environment variables
 */
export async function getCheckpointer(): Promise<PostgresSaver> {
  if (checkpointerInstance) {
    return checkpointerInstance;
  }

  if (!process.env.SUPABASE_DB_URL) {
    throw new Error(
      "SUPABASE_DB_URL environment variable is required for LangGraph checkpointing. " +
      "Set it to your Supabase PostgreSQL connection string."
    );
  }

  try {
    // Initialize PostgresSaver with the connection string
    // PostgresSaver handles connection pooling internally
    checkpointerInstance = await PostgresSaver.fromConnString(
      process.env.SUPABASE_DB_URL
    );

    // Set up the database schema (creates checkpoint tables if they don't exist)
    // This only needs to run once, but it's safe to call multiple times
    await checkpointerInstance.setup();

    console.log("[CHECKPOINTER] Postgres checkpointer initialized successfully");
    return checkpointerInstance;
  } catch (error) {
    console.error("[CHECKPOINTER] Failed to initialize Postgres checkpointer:", error);
    throw new Error(
      `Failed to initialize checkpointer: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get checkpoint configuration for a specific thread
 * This associates the graph execution with a thread_id for state persistence
 */
export function getCheckpointConfig(threadId: string): {
  configurable: { thread_id: string };
} {
  return {
    configurable: {
      thread_id: threadId,
    },
  };
}

/**
 * Reset the checkpointer instance (useful for testing or reconnection)
 */
export function resetCheckpointer(): void {
  checkpointerInstance = null;
}

