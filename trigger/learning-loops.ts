/**
 * Trigger.dev Learning Loop Tasks
 * Async tasks for pattern extraction, memory consolidation, and learning
 */

import { task } from "@trigger.dev/sdk/v3";
import { extractPatternsFromMessage } from "@/lib/patternExtractor";
import { getUserPatterns, getUserMemories, upsertUserMemory, UserPattern, UserMemory } from "@/lib/database";
import { getChatMessages } from "@/lib/database";
import { batchIndexMessages, indexMemory } from "@/lib/semanticMemory";

/**
 * Extract patterns from a user message asynchronously
 */
export const extractPatternsTask = task({
  id: "extract-patterns",
  run: async (payload: {
    recordId: string;
    message: string;
    role: 'user' | 'assistant';
    timestamp: string;
    previousMessages?: Array<{
      message: string;
      role: 'user' | 'assistant';
      timestamp: string;
    }>;
  }) => {
    try {
      console.log('[TRIGGER] Starting pattern extraction task:', {
        recordId: payload.recordId,
        messageLength: payload.message.length,
      });

      await extractPatternsFromMessage(
        payload.recordId,
        payload.message,
        payload.role,
        payload.timestamp,
        payload.previousMessages || []
      );

      console.log('[TRIGGER] Pattern extraction completed successfully');
      return { success: true };
    } catch (error) {
      console.error('[TRIGGER] Pattern extraction failed:', error);
      throw error;
    }
  },
});

/**
 * Batch extract patterns from multiple messages
 */
export const batchExtractPatternsTask = task({
  id: "batch-extract-patterns",
  run: async (payload: {
    recordId: string;
    messages: Array<{
      message: string;
      role: 'user' | 'assistant';
      timestamp: string;
    }>;
  }) => {
    try {
      console.log('[TRIGGER] Starting batch pattern extraction:', {
        recordId: payload.recordId,
        messageCount: payload.messages.length,
      });

      const results = [];
      for (const msg of payload.messages) {
        try {
          await extractPatternsFromMessage(
            payload.recordId,
            msg.message,
            msg.role,
            msg.timestamp,
            payload.messages.filter(m => m.timestamp < msg.timestamp)
          );
          results.push({ success: true, message: msg.message.substring(0, 50) });
        } catch (error) {
          console.error('[TRIGGER] Failed to extract patterns for message:', error);
          results.push({ success: false, error: error instanceof Error ? error.message : String(error) });
        }
      }

      return { results, total: payload.messages.length, successful: results.filter(r => r.success).length };
    } catch (error) {
      console.error('[TRIGGER] Batch pattern extraction failed:', error);
      throw error;
    }
  },
});

/**
 * Consolidate and update user memories
 */
export const consolidateMemoriesTask = task({
  id: "consolidate-memories",
  run: async (payload: {
    recordId: string;
  }) => {
    try {
      console.log('[TRIGGER] Starting memory consolidation:', {
        recordId: payload.recordId,
      });

      const memories = await getUserMemories(payload.recordId);
      
      // Group similar memories by key prefix
      const memoryGroups = new Map<string, UserMemory[]>();
      
      for (const memory of memories) {
        // Extract base key (before any suffix)
        const baseKey = memory.key.split('_')[0] || memory.key;
        
        if (!memoryGroups.has(baseKey)) {
          memoryGroups.set(baseKey, []);
        }
        memoryGroups.get(baseKey)!.push(memory);
      }

      // Consolidate similar memories
      let consolidated = 0;
      for (const [baseKey, group] of memoryGroups.entries()) {
        if (group.length > 1) {
          // Find the most important/recent memory
          const primary = group.sort((a, b) => {
            const importanceOrder = { high: 3, medium: 2, low: 1 };
            const aImp = importanceOrder[a.importance || 'medium'];
            const bImp = importanceOrder[b.importance || 'medium'];
            if (aImp !== bImp) return bImp - aImp;
            
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          })[0];

          // Merge context from other memories
          const contexts = group
            .filter(m => m.id !== primary.id && m.context)
            .map(m => m.context)
            .filter(Boolean);
          
          if (contexts.length > 0) {
            primary.context = [primary.context, ...contexts].filter(Boolean).join('; ');
          }

          // Update primary memory
          await upsertUserMemory(primary);

          // Mark others for deletion (or update to point to primary)
          consolidated += group.length - 1;
        }
      }

      // Clean up expired memories
      const now = new Date();
      const expired = memories.filter(m => m.expiresAt && new Date(m.expiresAt) < now);
      
      // Note: We don't have a delete function in database.ts yet, so we'll just log
      console.log(`[TRIGGER] Found ${expired.length} expired memories (cleanup not implemented yet)`);

      console.log('[TRIGGER] Memory consolidation completed:', {
        totalMemories: memories.length,
        consolidated,
        expired: expired.length,
      });

      return {
        success: true,
        totalMemories: memories.length,
        consolidated,
        expired: expired.length,
      };
    } catch (error) {
      console.error('[TRIGGER] Memory consolidation failed:', error);
      throw error;
    }
  },
});

/**
 * Update pattern confidence scores based on recent observations
 */
export const updatePatternConfidenceTask = task({
  id: "update-pattern-confidence",
  run: async (payload: {
    recordId: string;
  }) => {
    try {
      console.log('[TRIGGER] Starting pattern confidence update:', {
        recordId: payload.recordId,
      });

      const patterns = await getUserPatterns(payload.recordId);
      
      // Get recent messages to check pattern matches
      const threadId = await require('@/lib/database').getOrCreateThreadId(payload.recordId);
      const recentMessages = await getChatMessages({
        threadId,
        limit: 100,
      });

      let updated = 0;
      for (const pattern of patterns) {
        let matches = 0;
        
        // Check if pattern matches recent messages
        for (const msg of recentMessages.messages) {
          const msgLower = msg.message.toLowerCase();
          const patternDesc = pattern.patternData.description?.toLowerCase() || '';
          
          // Simple matching logic (can be enhanced)
          if (patternDesc && msgLower.includes(patternDesc.split(' ')[0])) {
            matches++;
          }
        }

        // Update confidence based on matches
        if (matches > 0) {
          const newConfidence = Math.min(1, (pattern.confidence || 0.5) + (matches * 0.1));
          if (newConfidence !== pattern.confidence) {
            await require('@/lib/database').upsertUserPattern({
              ...pattern,
              confidence: newConfidence,
              lastObserved: new Date().toISOString(),
            });
            updated++;
          }
        } else {
          // Decrease confidence if no recent matches
          const newConfidence = Math.max(0.1, (pattern.confidence || 0.5) - 0.05);
          if (newConfidence !== pattern.confidence) {
            await require('@/lib/database').upsertUserPattern({
              ...pattern,
              confidence: newConfidence,
            });
            updated++;
          }
        }
      }

      console.log('[TRIGGER] Pattern confidence update completed:', {
        totalPatterns: patterns.length,
        updated,
      });

      return {
        success: true,
        totalPatterns: patterns.length,
        updated,
      };
    } catch (error) {
      console.error('[TRIGGER] Pattern confidence update failed:', error);
      throw error;
    }
  },
});

