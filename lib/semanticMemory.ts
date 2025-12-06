/**
 * Semantic Memory Service
 * Provides semantic search and context retrieval using vector embeddings
 */

import { generateEmbedding, generateBatchEmbeddings } from './embeddings';
import { 
  storeEmbedding, 
  searchSimilarEmbeddings, 
  Embedding,
  SimilarEmbedding 
} from './database';
import { getUserPatterns, getUserMemories, UserPattern, UserMemory } from './database';

export interface SemanticContext {
  similarMessages: Array<{
    content: string;
    similarity: number;
    threadId?: string;
    timestamp?: string;
  }>;
  relevantMemories: UserMemory[];
  relevantPatterns: UserPattern[];
  combinedContext: string;
}

/**
 * Retrieve relevant context using semantic search
 */
export async function retrieveRelevantContext(
  recordId: string,
  query: string,
  options: {
    limit?: number;
    similarityThreshold?: number;
    threadId?: string;
    includeMemories?: boolean;
    includePatterns?: boolean;
  } = {}
): Promise<SemanticContext> {
  try {
    const limit = options.limit || 10;
    const threshold = options.similarityThreshold || 0.7;
    const includeMemories = options.includeMemories !== false;
    const includePatterns = options.includePatterns !== false;

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Search for similar embeddings
    const similarEmbeddings = await searchSimilarEmbeddings(recordId, queryEmbedding, {
      limit,
      threshold,
      threadId: options.threadId,
    });

    // Format similar messages
    const similarMessages = similarEmbeddings.map(emb => ({
      content: emb.content,
      similarity: emb.similarity,
      threadId: emb.threadId,
      timestamp: emb.createdAt,
    }));

    // Get relevant memories and patterns
    let relevantMemories: UserMemory[] = [];
    let relevantPatterns: UserPattern[] = [];

    if (includeMemories) {
      // Get all memories (we could enhance this with semantic search later)
      relevantMemories = await getUserMemories(recordId);
      
      // Filter to most important/recent memories
      relevantMemories = relevantMemories
        .filter(m => m.importance === 'high' || !m.expiresAt || new Date(m.expiresAt) > new Date())
        .slice(0, 5);
    }

    if (includePatterns) {
      // Get all patterns
      relevantPatterns = await getUserPatterns(recordId);
      
      // Filter to high confidence patterns
      relevantPatterns = relevantPatterns
        .filter(p => (p.confidence || 0) >= 0.6)
        .slice(0, 5);
    }

    // Combine context into a readable format
    const combinedContext = buildCombinedContext({
      similarMessages,
      relevantMemories,
      relevantPatterns,
    });

    return {
      similarMessages,
      relevantMemories,
      relevantPatterns,
      combinedContext,
    };
  } catch (error) {
    console.error('[SEMANTIC MEMORY] retrieveRelevantContext failed:', error);
    
    // Return empty context on error
    return {
      similarMessages: [],
      relevantMemories: [],
      relevantPatterns: [],
      combinedContext: '',
    };
  }
}

/**
 * Index a message with embeddings
 */
export async function indexMessage(
  recordId: string,
  threadId: string,
  messageId: string,
  content: string,
  metadata?: Record<string, any>
): Promise<Embedding | null> {
  try {
    if (!content || content.trim().length === 0) {
      return null;
    }

    // Generate embedding
    const embedding = await generateEmbedding(content);

    // Store in database
    const stored = await storeEmbedding({
      recordId,
      threadId,
      messageId,
      content,
      embedding,
      metadata: {
        ...metadata,
        indexedAt: new Date().toISOString(),
      },
    });

    return stored;
  } catch (error) {
    console.error('[SEMANTIC MEMORY] indexMessage failed:', error);
    // Don't throw - indexing failures shouldn't break the flow
    return null;
  }
}

/**
 * Index a memory with embeddings
 */
export async function indexMemory(
  recordId: string,
  memory: UserMemory
): Promise<Embedding | null> {
  try {
    // Combine key and value for better semantic search
    const content = `${memory.key}: ${memory.value}${memory.context ? ` (${memory.context})` : ''}`;

    // Generate embedding
    const embedding = await generateEmbedding(content);

    // Store in database
    const stored = await storeEmbedding({
      recordId,
      content,
      embedding,
      metadata: {
        memoryType: memory.memoryType,
        memoryKey: memory.key,
        importance: memory.importance,
        indexedAt: new Date().toISOString(),
      },
    });

    return stored;
  } catch (error) {
    console.error('[SEMANTIC MEMORY] indexMemory failed:', error);
    return null;
  }
}

/**
 * Batch index multiple messages
 */
export async function batchIndexMessages(
  messages: Array<{
    recordId: string;
    threadId: string;
    messageId: string;
    content: string;
    metadata?: Record<string, any>;
  }>
): Promise<Embedding[]> {
  try {
    if (messages.length === 0) {
      return [];
    }

    // Filter out empty contents
    const validMessages = messages.filter(m => m.content && m.content.trim().length > 0);
    
    if (validMessages.length === 0) {
      return [];
    }

    // Generate embeddings in batch
    const contents = validMessages.map(m => m.content);
    const embeddings = await generateBatchEmbeddings(contents);

    // Store embeddings
    const stored: Embedding[] = [];
    for (let i = 0; i < validMessages.length && i < embeddings.length; i++) {
      try {
        const storedEmbedding = await storeEmbedding({
          recordId: validMessages[i].recordId,
          threadId: validMessages[i].threadId,
          messageId: validMessages[i].messageId,
          content: validMessages[i].content,
          embedding: embeddings[i],
          metadata: validMessages[i].metadata,
        });
        stored.push(storedEmbedding);
      } catch (error) {
        console.error(`[SEMANTIC MEMORY] Failed to store embedding for message ${validMessages[i].messageId}:`, error);
        // Continue with other messages
      }
    }

    return stored;
  } catch (error) {
    console.error('[SEMANTIC MEMORY] batchIndexMessages failed:', error);
    return [];
  }
}

/**
 * Build combined context string from semantic search results
 */
function buildCombinedContext(context: {
  similarMessages: Array<{ content: string; similarity: number; timestamp?: string }>;
  relevantMemories: UserMemory[];
  relevantPatterns: UserPattern[];
}): string {
  const parts: string[] = [];

  // Add similar messages
  if (context.similarMessages.length > 0) {
    parts.push('## Relevant Past Conversations:');
    context.similarMessages.forEach((msg, idx) => {
      parts.push(`${idx + 1}. [Similarity: ${(msg.similarity * 100).toFixed(1)}%] ${msg.content}`);
    });
  }

  // Add relevant memories
  if (context.relevantMemories.length > 0) {
    parts.push('\n## Relevant Memories:');
    context.relevantMemories.forEach((memory, idx) => {
      parts.push(`${idx + 1}. [${memory.memoryType}] ${memory.key}: ${memory.value}`);
      if (memory.context) {
        parts.push(`   Context: ${memory.context}`);
      }
    });
  }

  // Add relevant patterns
  if (context.relevantPatterns.length > 0) {
    parts.push('\n## Relevant Patterns:');
    context.relevantPatterns.forEach((pattern, idx) => {
      const confidence = (pattern.confidence || 0) * 100;
      parts.push(`${idx + 1}. [${pattern.patternType}, Confidence: ${confidence.toFixed(0)}%] ${pattern.patternData.description || 'Pattern detected'}`);
    });
  }

  return parts.join('\n');
}

/**
 * Search for similar content across all users (admin function)
 */
export async function searchSimilarContent(
  queryEmbedding: number[],
  options: {
    limit?: number;
    threshold?: number;
    recordId?: string;
  } = {}
): Promise<SimilarEmbedding[]> {
  try {
    const limit = options.limit || 10;
    const threshold = options.threshold || 0.7;

    return await searchSimilarEmbeddings(
      options.recordId || '',
      queryEmbedding,
      {
        limit,
        threshold,
      }
    );
  } catch (error) {
    console.error('[SEMANTIC MEMORY] searchSimilarContent failed:', error);
    return [];
  }
}

