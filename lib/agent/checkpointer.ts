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
    const connectionString = process.env.SUPABASE_DB_URL;
    
    if (!connectionString) {
      throw new Error("SUPABASE_DB_URL is not set");
    }

    // Try direct connection first (port 5432)
    console.log("[CHECKPOINTER] Attempting direct database connection...");
    try {
      checkpointerInstance = await PostgresSaver.fromConnString(connectionString);
      await checkpointerInstance.setup();
      console.log("[CHECKPOINTER] Postgres checkpointer initialized successfully (direct connection)");
      return checkpointerInstance;
    } catch (directError) {
      const errorMsg = directError instanceof Error ? directError.message : String(directError);
      console.warn("[CHECKPOINTER] Direct connection failed:", errorMsg);
      
      // Try connection pooler (port 6543) as fallback
      if (connectionString.includes(':5432/')) {
        console.log("[CHECKPOINTER] Trying connection pooler (port 6543)...");
        try {
          const poolerUrl = connectionString.replace(':5432/', ':6543/') + '?pgbouncer=true';
          checkpointerInstance = await PostgresSaver.fromConnString(poolerUrl);
          await checkpointerInstance.setup();
          console.log("[CHECKPOINTER] Postgres checkpointer initialized successfully (connection pooler)");
          return checkpointerInstance;
        } catch (poolerError) {
          console.error("[CHECKPOINTER] Connection pooler also failed:", poolerError instanceof Error ? poolerError.message : String(poolerError));
          // Fall through to throw original error
        }
      }
      
      // If both fail, provide helpful diagnostics
      if (errorMsg.includes('ENOTFOUND')) {
        console.error("[CHECKPOINTER] DNS resolution failed. Troubleshooting:");
        console.error("  1. Check Supabase project status: https://supabase.com/dashboard");
        console.error("  2. Verify project is not paused");
        console.error("  3. Check SUPABASE_DB_URL format matches: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres");
        console.error("  4. Test DNS: nslookup db.kwlkbuatidinolgfsxst.supabase.co");
        console.error("  5. Note: LangGraph will run without checkpointing (stateless mode)");
      }
      
      throw directError;
    }
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

