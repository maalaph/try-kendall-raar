/**
 * Context Retrieval Functions for Voice Agent
 * Atomic functions with capped outputs for voice-first performance
 */

import { getUserRecord } from './airtable';
import { getUserMemories } from './userPatterns';
import { getUserContacts as getContactsFromAirtable } from './contacts';
import { getDocumentSummaries } from './userDocuments';

const FUNCTION_TIMEOUT_MS = 5000; // 5 second max

/**
 * Format context as numbered bullets (max 5)
 */
function formatContextAsBullets(context: string, maxBullets: number = 5): string {
  if (!context || !context.trim()) {
    return 'No context available.';
  }

  // Split by common delimiters (newlines, periods, semicolons)
  const sentences = context
    .split(/[.\n;]/)
    .map(s => s.trim())
    .filter(s => s.length > 10) // Filter out very short fragments
    .slice(0, maxBullets);

  if (sentences.length === 0) {
    return 'No context available.';
  }

  // Format as numbered bullets
  return sentences
    .map((sentence, index) => `${index + 1}. ${sentence}`)
    .join(' ');
}

/**
 * Get user context (userContextAndRules + analyzedFileContent)
 * Returns max 5 numbered bullets
 */
export async function getUserContext(
  recordId: string,
  topic?: string
): Promise<string> {
  try {
    const timeout = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), FUNCTION_TIMEOUT_MS)
    );

    const fetchContext = async (): Promise<string> => {
      const userRecord = await getUserRecord(recordId);
      if (!userRecord || !userRecord.fields) {
        return 'No user context available.';
      }

      const fields = userRecord.fields;
      
      // NEW: Check for topic-specific fields first
      if (topic && topic.trim()) {
        const topicLower = topic.toLowerCase();
        
        // Check for examples field
        if (topicLower === 'examples' && fields.examples) {
          return formatContextAsBullets(fields.examples, 5);
        }
        
        // Check for instructions field
        if (topicLower === 'instructions' && fields.instructions) {
          return formatContextAsBullets(fields.instructions, 5);
        }
        
        // Check for edgeCases field
        if ((topicLower === 'edgecases' || topicLower === 'edge_cases' || topicLower === 'edge cases') && fields.edgeCases) {
          return formatContextAsBullets(fields.edgeCases, 5);
        }
      }
      
      // Fallback to userContextAndRules (existing behavior)
      const userContextAndRules = fields.userContextAndRules || '';
      let combinedContext = '';
      
      if (userContextAndRules.trim()) {
        combinedContext += userContextAndRules.trim();
      }

      if (!combinedContext.trim()) {
        return 'No user context available.';
      }

      // If topic provided, try to filter within userContextAndRules
      if (topic && topic.trim()) {
        const topicLower = topic.toLowerCase();
        const lines = combinedContext.split('\n');
        const relevantLines = lines.filter(line =>
          line.toLowerCase().includes(topicLower)
        );
        if (relevantLines.length > 0) {
          combinedContext = relevantLines.join(' ');
        }
      }

      return combinedContext;
    };

    const context = await Promise.race([fetchContext(), timeout]);
    return formatContextAsBullets(context, 5);
  } catch (error) {
    console.error('[CONTEXT RETRIEVAL] Error getting user context:', error);
    throw error;
  }
}

/**
 * Get user contacts
 * Returns max 5 contacts with name, phone, notes
 */
export async function getUserContacts(
  recordId: string,
  contactName?: string
): Promise<Array<{ name: string; phone: string; notes?: string }>> {
  try {
    const timeout = new Promise<Array<{ name: string; phone: string; notes?: string }>>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), FUNCTION_TIMEOUT_MS)
    );

    const fetchContacts = async (): Promise<Array<{ name: string; phone: string; notes?: string }>> => {
      const contacts = await getContactsFromAirtable(recordId);
      
      // Filter by contactName if provided
      let filteredContacts = contacts;
      if (contactName && contactName.trim()) {
        const nameLower = contactName.toLowerCase();
        filteredContacts = contacts.filter(c => 
          c.name.toLowerCase().includes(nameLower)
        );
      }

      // Return max 5 contacts
      return filteredContacts.slice(0, 5).map(c => ({
        name: c.name,
        phone: c.phone || '',
        notes: c.notes,
      }));
    };

    const contacts = await Promise.race([fetchContacts(), timeout]);
    return contacts.slice(0, 5); // Cap to max 5
  } catch (error) {
    console.error('[CONTEXT RETRIEVAL] Error getting user contacts:', error);
    throw error;
  }
}

/**
 * Get user memory
 * Returns max 5 memories
 */
export async function getUserMemory(
  recordId: string,
  topic?: string
): Promise<string> {
  try {
    const timeout = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), FUNCTION_TIMEOUT_MS)
    );

    const fetchMemory = async (): Promise<string> => {
      const memories = await getUserMemories(recordId);

      // Filter by topic if provided (simple keyword matching)
      let relevantMemories = memories;
      if (topic && topic.trim()) {
        const topicLower = topic.toLowerCase();
        relevantMemories = memories.filter(m =>
          m.value.toLowerCase().includes(topicLower) ||
          m.key.toLowerCase().includes(topicLower)
        );
      }

      // Take top 5 by importance/date
      const topMemories = relevantMemories.slice(0, 5);

      if (topMemories.length === 0) {
        return 'No memories found.';
      }

      // Format as numbered bullets
      return topMemories
        .map((memory, index) => `${index + 1}. ${memory.value}`)
        .join(' ');
    };

    const memory = await Promise.race([fetchMemory(), timeout]);
    return memory;
  } catch (error) {
    console.error('[CONTEXT RETRIEVAL] Error getting user memory:', error);
    throw error;
  }
}

/**
 * Get user documents
 * Returns max 5 document summaries as numbered bullets
 * Replaces analyzedFileContent from Users table
 */
export async function getUserDocuments(
  recordId: string,
  query?: string
): Promise<string> {
  try {
    const timeout = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), FUNCTION_TIMEOUT_MS)
    );

    const fetchDocuments = async (): Promise<string> => {
      const summaries = await getDocumentSummaries(recordId, query, 5);
      return summaries;
    };

    const documents = await Promise.race([fetchDocuments(), timeout]);
    return documents;
  } catch (error) {
    console.error('[CONTEXT RETRIEVAL] Error getting user documents:', error);
    throw error;
  }
}

