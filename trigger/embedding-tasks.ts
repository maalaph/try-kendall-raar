/**
 * Trigger.dev Embedding Tasks
 * Async tasks for generating and indexing embeddings
 */

import { task } from "@trigger.dev/sdk/v3";
import { indexMessage, batchIndexMessages, indexMemory } from "@/lib/semanticMemory";
import { getChatMessages } from "@/lib/database";
import { getUserMemories } from "@/lib/database";

/**
 * Index a single message with embeddings
 */
export const indexMessageTask = task({
  id: "index-message",
  run: async (payload: {
    recordId: string;
    threadId: string;
    messageId: string;
    content: string;
    metadata?: Record<string, any>;
  }) => {
    try {
      console.log('[TRIGGER] Starting message indexing:', {
        recordId: payload.recordId,
        messageId: payload.messageId,
        contentLength: payload.content.length,
      });

      const result = await indexMessage(
        payload.recordId,
        payload.threadId,
        payload.messageId,
        payload.content,
        payload.metadata
      );

      if (result) {
        console.log('[TRIGGER] Message indexed successfully:', {
          embeddingId: result.id,
        });
        return { success: true, embeddingId: result.id };
      } else {
        console.warn('[TRIGGER] Message indexing returned null (empty content?)');
        return { success: false, reason: 'empty_content' };
      }
    } catch (error) {
      console.error('[TRIGGER] Message indexing failed:', error);
      throw error;
    }
  },
});

/**
 * Batch index multiple messages
 */
export const batchIndexMessagesTask = task({
  id: "batch-index-messages",
  run: async (payload: {
    messages: Array<{
      recordId: string;
      threadId: string;
      messageId: string;
      content: string;
      metadata?: Record<string, any>;
    }>;
  }) => {
    try {
      console.log('[TRIGGER] Starting batch message indexing:', {
        messageCount: payload.messages.length,
      });

      const results = await batchIndexMessages(payload.messages);

      console.log('[TRIGGER] Batch indexing completed:', {
        total: payload.messages.length,
        indexed: results.length,
      });

      return {
        success: true,
        total: payload.messages.length,
        indexed: results.length,
        results: results.map(r => ({ id: r.id, recordId: r.recordId })),
      };
    } catch (error) {
      console.error('[TRIGGER] Batch message indexing failed:', error);
      throw error;
    }
  },
});

/**
 * Index all messages for a user (backfill)
 */
export const backfillUserEmbeddingsTask = task({
  id: "backfill-user-embeddings",
  run: async (payload: {
    recordId: string;
    limit?: number;
  }) => {
    try {
      console.log('[TRIGGER] Starting embedding backfill:', {
        recordId: payload.recordId,
        limit: payload.limit || 100,
      });

      const threadId = await require('@/lib/database').getOrCreateThreadId(payload.recordId);
      const messages = await getChatMessages({
        threadId,
        limit: payload.limit || 100,
      });

      if (messages.messages.length === 0) {
        return { success: true, indexed: 0, total: 0 };
      }

      // Filter out messages that might already be indexed
      // (In production, you'd check the embeddings table)
      const messagesToIndex = messages.messages.map(msg => ({
        recordId: payload.recordId,
        threadId,
        messageId: msg.id,
        content: msg.message,
        metadata: {
          role: msg.role,
          timestamp: msg.timestamp,
          backfilled: true,
        },
      }));

      const results = await batchIndexMessages(messagesToIndex);

      console.log('[TRIGGER] Embedding backfill completed:', {
        total: messages.messages.length,
        indexed: results.length,
      });

      return {
        success: true,
        total: messages.messages.length,
        indexed: results.length,
      };
    } catch (error) {
      console.error('[TRIGGER] Embedding backfill failed:', error);
      throw error;
    }
  },
});

/**
 * Index a memory with embeddings
 */
export const indexMemoryTask = task({
  id: "index-memory",
  run: async (payload: {
    recordId: string;
    memory: {
      id?: string;
      recordId: string;
      memoryType: 'fact' | 'preference' | 'relationship' | 'reminder' | 'important_date' | 'instruction';
      key: string;
      value: string;
      context?: string;
      importance?: 'low' | 'medium' | 'high';
      expiresAt?: string;
    };
  }) => {
    try {
      console.log('[TRIGGER] Starting memory indexing:', {
        recordId: payload.recordId,
        memoryKey: payload.memory.key,
      });

      const result = await indexMemory(payload.recordId, payload.memory);

      if (result) {
        console.log('[TRIGGER] Memory indexed successfully:', {
          embeddingId: result.id,
        });
        return { success: true, embeddingId: result.id };
      } else {
        console.warn('[TRIGGER] Memory indexing returned null');
        return { success: false };
      }
    } catch (error) {
      console.error('[TRIGGER] Memory indexing failed:', error);
      throw error;
    }
  },
});

/**
 * Index all memories for a user
 */
export const indexAllMemoriesTask = task({
  id: "index-all-memories",
  run: async (payload: {
    recordId: string;
  }) => {
    try {
      console.log('[TRIGGER] Starting memory indexing for user:', {
        recordId: payload.recordId,
      });

      const memories = await getUserMemories(payload.recordId);
      
      const results = [];
      for (const memory of memories) {
        try {
          const result = await indexMemory(payload.recordId, memory);
          if (result) {
            results.push({ success: true, memoryKey: memory.key, embeddingId: result.id });
          } else {
            results.push({ success: false, memoryKey: memory.key, reason: 'indexing_failed' });
          }
        } catch (error) {
          console.error(`[TRIGGER] Failed to index memory ${memory.key}:`, error);
          results.push({ success: false, memoryKey: memory.key, error: error instanceof Error ? error.message : String(error) });
        }
      }

      console.log('[TRIGGER] Memory indexing completed:', {
        total: memories.length,
        successful: results.filter(r => r.success).length,
      });

      return {
        success: true,
        total: memories.length,
        successful: results.filter(r => r.success).length,
        results,
      };
    } catch (error) {
      console.error('[TRIGGER] Memory indexing failed:', error);
      throw error;
    }
  },
});

