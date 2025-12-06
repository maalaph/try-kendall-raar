/**
 * Embedding Generation Service
 * Generates vector embeddings using OpenAI's text-embedding-3-small model
 */

import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is not set');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Embedding model configuration
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

// Rate limiting configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const BATCH_SIZE = 100; // OpenAI allows up to 2048, but we'll use smaller batches for reliability

/**
 * Generate a single embedding for text content
 */
export async function generateEmbedding(content: string): Promise<number[]> {
  if (!content || content.trim().length === 0) {
    throw new Error('Content cannot be empty');
  }

  // Truncate content if too long (OpenAI has token limits)
  // text-embedding-3-small supports up to 8191 tokens
  // We'll truncate to ~6000 characters to be safe
  const maxLength = 6000;
  const truncatedContent = content.length > maxLength 
    ? content.substring(0, maxLength) + '...'
    : content;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: truncatedContent,
        dimensions: EMBEDDING_DIMENSIONS,
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data returned from OpenAI');
      }

      return response.data[0].embedding;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if it's a rate limit error
      if (error instanceof Error && error.message.includes('rate limit')) {
        const delay = RETRY_DELAY * Math.pow(2, attempt); // Exponential backoff
        console.warn(`[EMBEDDINGS] Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // For other errors, retry with exponential backoff
      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAY * Math.pow(2, attempt);
        console.warn(`[EMBEDDINGS] Error generating embedding, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES}):`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw new Error(`Failed to generate embedding after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Generate embeddings for multiple texts in batches
 * Handles rate limiting and batching automatically
 */
export async function generateBatchEmbeddings(contents: string[]): Promise<number[][]> {
  if (!contents || contents.length === 0) {
    return [];
  }

  // Filter out empty contents
  const validContents = contents.filter(c => c && c.trim().length > 0);
  
  if (validContents.length === 0) {
    return [];
  }

  const results: number[][] = [];
  const errors: Array<{ index: number; error: Error }> = [];

  // Process in batches
  for (let i = 0; i < validContents.length; i += BATCH_SIZE) {
    const batch = validContents.slice(i, i + BATCH_SIZE);
    
    try {
      // Truncate each content in the batch
      const truncatedBatch = batch.map(content => {
        const maxLength = 6000;
        return content.length > maxLength 
          ? content.substring(0, maxLength) + '...'
          : content;
      });

      let lastError: Error | null = null;
      let batchResults: number[][] = [];

      // Retry logic for batch
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const response = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: truncatedBatch,
            dimensions: EMBEDDING_DIMENSIONS,
          });

          if (!response.data || response.data.length !== batch.length) {
            throw new Error(`Expected ${batch.length} embeddings, got ${response.data?.length || 0}`);
          }

          batchResults = response.data.map(item => item.embedding);
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          if (error instanceof Error && error.message.includes('rate limit')) {
            const delay = RETRY_DELAY * Math.pow(2, attempt);
            console.warn(`[EMBEDDINGS] Rate limit hit in batch, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          if (attempt < MAX_RETRIES - 1) {
            const delay = RETRY_DELAY * Math.pow(2, attempt);
            console.warn(`[EMBEDDINGS] Error in batch, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES}):`, lastError.message);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
      }

      if (batchResults.length > 0) {
        results.push(...batchResults);
      } else {
        // All items in batch failed
        for (let j = 0; j < batch.length; j++) {
          errors.push({
            index: i + j,
            error: lastError || new Error('Failed to generate embedding'),
          });
        }
      }

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < validContents.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      // Batch failed completely
      const batchError = error instanceof Error ? error : new Error(String(error));
      for (let j = 0; j < batch.length; j++) {
        errors.push({
          index: i + j,
          error: batchError,
        });
      }
    }
  }

  // Log errors but don't fail completely
  if (errors.length > 0) {
    console.error(`[EMBEDDINGS] Failed to generate ${errors.length} embeddings out of ${contents.length}`);
    errors.forEach(({ index, error }) => {
      console.error(`[EMBEDDINGS] Error at index ${index}:`, error.message);
    });
  }

  // Return results, with null placeholders for failed embeddings
  const finalResults: number[][] = [];
  let resultIndex = 0;
  
  for (let i = 0; i < contents.length; i++) {
    if (!contents[i] || contents[i].trim().length === 0) {
      // Empty content, skip
      continue;
    }
    
    if (resultIndex < results.length) {
      finalResults.push(results[resultIndex]);
      resultIndex++;
    } else {
      // Missing result, this shouldn't happen but handle gracefully
      console.warn(`[EMBEDDINGS] Missing result for content at index ${i}`);
    }
  }

  return finalResults;
}

/**
 * Get embedding dimensions for the configured model
 */
export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}

/**
 * Get the embedding model name
 */
export function getEmbeddingModel(): string {
  return EMBEDDING_MODEL;
}

