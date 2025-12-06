/**
 * PostgreSQL Database Functions (Supabase)
 * Replaces Airtable for all data operations
 */

import { supabase } from './supabase';
import { formatPhoneNumberToE164 } from './vapi';

// ============================================================================
// USER FUNCTIONS
// ============================================================================

// UserRecord interface matches Airtable format (camelCase) for compatibility
export interface UserRecord {
  id: string;
  record_id: string;
  fullName?: string;
  nickname?: string;
  email?: string;
  mobileNumber?: string;
  kendallName?: string;
  selectedTraits?: string[];
  useCaseChoice?: string;
  boundaryChoices?: string[];
  userContextAndRules?: string;
  analyzedFileContent?: string;
  fileUsageInstructions?: string;
  vapi_agent_id?: string;
  timeZone?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Get user record by recordId (replaces Airtable getUserRecord)
 */
export async function getUserRecord(recordId: string): Promise<{ fields: UserRecord }> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('record_id', recordId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        throw new Error(`User record not found for recordId: ${recordId}`);
      }
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data) {
      throw new Error(`User record not found for recordId: ${recordId}`);
    }

    // Transform to match Airtable format for compatibility
    return {
      fields: {
        id: data.id,
        record_id: data.record_id,
        fullName: data.full_name,
        nickname: data.nickname,
        email: data.email,
        mobileNumber: data.mobile_number,
        kendallName: data.kendall_name,
        selectedTraits: data.selected_traits,
        useCaseChoice: data.use_case_choice,
        boundaryChoices: data.boundary_choices,
        userContextAndRules: data.user_context_and_rules,
        analyzedFileContent: data.analyzed_file_content,
        fileUsageInstructions: data.file_usage_instructions,
        vapi_agent_id: data.vapi_agent_id,
        timeZone: data.time_zone,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      } as any,
    };
  } catch (error) {
    console.error('[DATABASE ERROR] getUserRecord failed:', error);
    throw error;
  }
}

/**
 * Create user record (replaces Airtable createUserRecord)
 */
export async function createUserRecord(data: Record<string, any>): Promise<{ id: string }> {
  try {
    // Transform Airtable field names to database column names
    const dbData: any = {
      record_id: data.recordId || data.id || `rec${Date.now()}`,
      full_name: data.fullName,
      nickname: data.nickname,
      email: data.email,
      mobile_number: data.mobileNumber,
      kendall_name: data.kendallName || 'Kendall',
      selected_traits: Array.isArray(data.selectedTraits) ? data.selectedTraits : [],
      use_case_choice: data.useCaseChoice,
      boundary_choices: Array.isArray(data.boundaryChoices) ? data.boundaryChoices : [],
      user_context_and_rules: data.userContextAndRules,
      analyzed_file_content: data.analyzedFileContent,
      file_usage_instructions: data.fileUsageInstructions,
      vapi_agent_id: data.vapi_agent_id,
      time_zone: data.timeZone || 'UTC',
    };

    const { data: result, error } = await supabase
      .from('users')
      .insert(dbData)
      .select('id, record_id')
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return { id: result.record_id };
  } catch (error) {
    console.error('[DATABASE ERROR] createUserRecord failed:', error);
    throw error;
  }
}

/**
 * Update user record (replaces Airtable updateUserRecord)
 */
export async function updateUserRecord(recordId: string, data: Record<string, any>): Promise<{ id: string }> {
  try {
    // Transform Airtable field names to database column names
    const updateData: any = {};
    
    if (data.fullName !== undefined) updateData.full_name = data.fullName;
    if (data.nickname !== undefined) updateData.nickname = data.nickname;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.mobileNumber !== undefined) updateData.mobile_number = data.mobileNumber;
    if (data.kendallName !== undefined) updateData.kendall_name = data.kendallName;
    if (data.selectedTraits !== undefined) updateData.selected_traits = Array.isArray(data.selectedTraits) ? data.selectedTraits : [];
    if (data.useCaseChoice !== undefined) updateData.use_case_choice = data.useCaseChoice;
    if (data.boundaryChoices !== undefined) updateData.boundary_choices = Array.isArray(data.boundaryChoices) ? data.boundaryChoices : [];
    if (data.userContextAndRules !== undefined) updateData.user_context_and_rules = data.userContextAndRules;
    if (data.analyzedFileContent !== undefined) updateData.analyzed_file_content = data.analyzedFileContent;
    if (data.fileUsageInstructions !== undefined) updateData.file_usage_instructions = data.fileUsageInstructions;
    if (data.vapi_agent_id !== undefined) updateData.vapi_agent_id = data.vapi_agent_id;
    if (data.timeZone !== undefined) updateData.time_zone = data.timeZone;

    const { data: result, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('record_id', recordId)
      .select('id, record_id')
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return { id: result.record_id };
  } catch (error) {
    console.error('[DATABASE ERROR] updateUserRecord failed:', error);
    throw error;
  }
}

// ============================================================================
// THREAD FUNCTIONS
// ============================================================================

/**
 * Get or create thread ID (replaces Airtable getOrCreateThreadId)
 */
export async function getOrCreateThreadId(recordId: string): Promise<string> {
  try {
    // Try to get existing thread
    const { data: existingThread, error: fetchError } = await supabase
      .from('threads')
      .select('thread_id')
      .eq('record_id', recordId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingThread && !fetchError) {
      return existingThread.thread_id;
    }

    // Create new thread
    const threadId = `thread_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const { error: insertError } = await supabase
      .from('threads')
      .insert({
        record_id: recordId,
        thread_id: threadId,
      });

    if (insertError) {
      throw new Error(`Database error: ${insertError.message}`);
    }

    return threadId;
  } catch (error) {
    console.error('[DATABASE ERROR] getOrCreateThreadId failed:', error);
    throw error;
  }
}

// ============================================================================
// CHAT MESSAGE FUNCTIONS
// ============================================================================

export interface ChatMessage {
  id: string;
  record_id: string;
  thread_id: string;
  agent_id?: string;
  message: string;
  role: 'user' | 'assistant';
  timestamp: string;
}

/**
 * Get chat messages (replaces Airtable getChatMessages)
 */
export async function getChatMessages(options: {
  threadId: string;
  limit?: number;
  lastMessageId?: string;
}): Promise<{ messages: ChatMessage[]; hasMore: boolean; lastMessageId?: string }> {
  try {
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', options.threadId)
      .order('timestamp', { ascending: false })
      .limit((options.limit || 50) + 1); // Fetch one extra to check if there's more

    if (options.lastMessageId) {
      // Get messages before this ID
      const { data: lastMessage } = await supabase
        .from('chat_messages')
        .select('timestamp')
        .eq('id', options.lastMessageId)
        .single();

      if (lastMessage) {
        query = query.lt('timestamp', lastMessage.timestamp);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return { messages: [], hasMore: false };
    }

    const hasMore = data.length > (options.limit || 50);
    const messages = data.slice(0, options.limit || 50).reverse(); // Reverse to get chronological order

    // Transform to match expected format
    const transformedMessages: ChatMessage[] = messages.map((msg: any) => ({
      id: msg.id,
      record_id: msg.record_id,
      thread_id: msg.thread_id,
      agent_id: msg.agent_id,
      message: msg.message,
      role: msg.role,
      timestamp: msg.timestamp,
    }));

    return {
      messages: transformedMessages,
      hasMore,
      lastMessageId: transformedMessages[transformedMessages.length - 1]?.id,
    };
  } catch (error) {
    console.error('[DATABASE ERROR] getChatMessages failed:', error);
    throw error;
  }
}

/**
 * Create chat message (replaces Airtable createChatMessage)
 */
export async function createChatMessage(data: {
  recordId: string;
  agentId?: string;
  threadId: string;
  message: string;
  role: 'user' | 'assistant';
  timestamp?: string;
}): Promise<ChatMessage> {
  try {
    const { data: result, error } = await supabase
      .from('chat_messages')
      .insert({
        record_id: data.recordId,
        agent_id: data.agentId,
        thread_id: data.threadId,
        message: data.message,
        role: data.role,
        timestamp: data.timestamp || new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return {
      id: result.id,
      record_id: result.record_id,
      thread_id: result.thread_id,
      agent_id: result.agent_id,
      message: result.message,
      role: result.role,
      timestamp: result.timestamp,
    };
  } catch (error) {
    console.error('[DATABASE ERROR] createChatMessage failed:', error);
    throw error;
  }
}

// ============================================================================
// CONTACT FUNCTIONS
// ============================================================================

export interface Contact {
  id?: string;
  recordId: string;
  name: string;
  phone?: string;
  email?: string;
  relationship?: string;
  notes?: string;
  lastContacted?: string;
  contactCount?: number;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Upsert contact (replaces Airtable upsertContact)
 */
export async function upsertContact(contact: Contact): Promise<Contact> {
  try {
    const updateData: any = {
      name: contact.name,
      updated_at: new Date().toISOString(),
    };

    if (contact.phone) updateData.phone = contact.phone;
    if (contact.email) updateData.email = contact.email;
    if (contact.relationship) updateData.relationship = contact.relationship;
    if (contact.notes) updateData.notes = contact.notes;
    if (contact.lastContacted) updateData.last_contacted = contact.lastContacted;
    else updateData.last_contacted = new Date().toISOString();

    // Try to find existing contact by name (unique per user)
    const { data: existing } = await supabase
      .from('contacts')
      .select('*')
      .eq('record_id', contact.recordId)
      .eq('name', contact.name)
      .single();

    if (existing) {
      // Update existing
      const { data: result, error } = await supabase
        .from('contacts')
        .update(updateData)
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) throw new Error(`Database error: ${error.message}`);

      return {
        id: result.id,
        recordId: result.record_id,
        name: result.name,
        phone: result.phone,
        email: result.email,
        relationship: result.relationship,
        notes: result.notes,
        lastContacted: result.last_contacted,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };
    } else {
      // Create new
      const { data: result, error } = await supabase
        .from('contacts')
        .insert({
          record_id: contact.recordId,
          ...updateData,
        })
        .select('*')
        .single();

      if (error) throw new Error(`Database error: ${error.message}`);

      return {
        id: result.id,
        recordId: result.record_id,
        name: result.name,
        phone: result.phone,
        email: result.email,
        relationship: result.relationship,
        notes: result.notes,
        lastContacted: result.last_contacted,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };
    }
  } catch (error) {
    console.error('[DATABASE ERROR] upsertContact failed:', error);
    throw error;
  }
}

/**
 * Get contact by name (replaces Airtable getContactByName)
 * Returns first matching contact or null (matches original behavior)
 * Also handles phone number lookups (for compatibility with existing code)
 */
export async function getContactByName(recordId: string, name: string): Promise<Contact | null> {
  try {
    // Check if name is actually a phone number (for compatibility with existing code)
    const phoneDigits = name.replace(/\D/g, '');
    if (phoneDigits.length >= 10) {
      // Looks like a phone number, search by phone instead
      const normalizedPhone = formatPhoneNumberToE164(name);
      if (normalizedPhone) {
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .eq('record_id', recordId)
          .eq('phone', normalizedPhone)
          .limit(1)
          .single();

        if (!error && data) {
          return {
            id: data.id,
            recordId: data.record_id,
            name: data.name,
            phone: data.phone,
            email: data.email,
            relationship: data.relationship,
            notes: data.notes,
            lastContacted: data.last_contacted,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
        }
      }
    }

    const nameLower = name.toLowerCase().trim();
    
    // Get all contacts and do client-side matching (more reliable, matches original behavior)
    const { data: allContacts, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('record_id', recordId)
      .order('last_contacted', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!allContacts || allContacts.length === 0) {
      return null;
    }

    // Try exact match first (case-insensitive)
    for (const contact of allContacts) {
      if (contact.name && contact.name.toLowerCase().trim() === nameLower) {
        if (contact.phone) {
          // Prefer contacts with phone numbers
          return {
            id: contact.id,
            recordId: contact.record_id,
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
            relationship: contact.relationship,
            notes: contact.notes,
            lastContacted: contact.last_contacted,
            createdAt: contact.created_at,
            updatedAt: contact.updated_at,
          };
        }
      }
    }

    // Try partial match
    for (const contact of allContacts) {
      if (contact.name) {
        const contactNameLower = contact.name.toLowerCase().trim();
        if (contactNameLower.includes(nameLower) || nameLower.includes(contactNameLower)) {
          return {
            id: contact.id,
            recordId: contact.record_id,
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
            relationship: contact.relationship,
            notes: contact.notes,
            lastContacted: contact.last_contacted,
            createdAt: contact.created_at,
            updatedAt: contact.updated_at,
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[DATABASE ERROR] getContactByName failed:', error);
    return null;
  }
}

/**
 * Get contact by email (replaces Airtable getContactByEmail)
 */
export async function getContactByEmail(recordId: string, email: string): Promise<Contact | null> {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('record_id', recordId)
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data) return null;

    return {
      id: data.id,
      recordId: data.record_id,
      name: data.name,
      phone: data.phone,
      email: data.email,
      relationship: data.relationship,
      notes: data.notes,
      lastContacted: data.last_contacted,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('[DATABASE ERROR] getContactByEmail failed:', error);
    return null;
  }
}

/**
 * Get all user contacts (replaces Airtable getUserContacts)
 */
export async function getUserContacts(recordId: string): Promise<Contact[]> {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('record_id', recordId)
      .order('last_contacted', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return (data || []).map((c: any) => ({
      id: c.id,
      recordId: c.record_id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      relationship: c.relationship,
      notes: c.notes,
      lastContacted: c.last_contacted,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
  } catch (error) {
    console.error('[DATABASE ERROR] getUserContacts failed:', error);
    return [];
  }
}

// ============================================================================
// PATTERN & MEMORY FUNCTIONS
// ============================================================================

export interface UserPattern {
  id?: string;
  recordId: string;
  patternType: 'recurring_call' | 'time_based_action' | 'preferred_contact' | 'behavior' | 'preference';
  patternData: {
    description: string;
    frequency?: 'daily' | 'weekly' | 'monthly' | 'custom';
    dayOfWeek?: number;
    timeOfDay?: string;
    contactName?: string;
    contactPhone?: string;
    metadata?: Record<string, any>;
  };
  confidence?: number;
  lastObserved?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserMemory {
  id?: string;
  recordId: string;
  memoryType: 'fact' | 'preference' | 'relationship' | 'reminder' | 'important_date' | 'instruction';
  key: string;
  value: string;
  context?: string;
  importance?: 'low' | 'medium' | 'high';
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Get user patterns (replaces Airtable getUserPatterns)
 */
export async function getUserPatterns(recordId: string, patternType?: UserPattern['patternType']): Promise<UserPattern[]> {
  try {
    let query = supabase
      .from('user_patterns')
      .select('*')
      .eq('record_id', recordId)
      .order('last_observed', { ascending: false });

    if (patternType) {
      query = query.eq('pattern_type', patternType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[DATABASE ERROR] getUserPatterns failed:', error);
      return [];
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      recordId: p.record_id,
      patternType: p.pattern_type,
      patternData: typeof p.pattern_data === 'string' ? JSON.parse(p.pattern_data) : p.pattern_data,
      confidence: p.confidence,
      lastObserved: p.last_observed,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));
  } catch (error) {
    console.error('[DATABASE ERROR] getUserPatterns failed:', error);
    return [];
  }
}

/**
 * Upsert user pattern (replaces Airtable upsertUserPattern)
 */
export async function upsertUserPattern(pattern: UserPattern): Promise<UserPattern> {
  try {
    const patternData = {
      record_id: pattern.recordId,
      pattern_type: pattern.patternType,
      pattern_data: pattern.patternData,
      confidence: pattern.confidence || 0.5,
      last_observed: pattern.lastObserved || new Date().toISOString(),
    };

    if (pattern.id) {
      // Update existing
      const { data: result, error } = await supabase
        .from('user_patterns')
        .update(patternData)
        .eq('id', pattern.id)
        .select('*')
        .single();

      if (error) throw new Error(`Database error: ${error.message}`);

      return {
        id: result.id,
        recordId: result.record_id,
        patternType: result.pattern_type,
        patternData: typeof result.pattern_data === 'string' ? JSON.parse(result.pattern_data) : result.pattern_data,
        confidence: result.confidence,
        lastObserved: result.last_observed,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };
    } else {
      // Create new
      const { data: result, error } = await supabase
        .from('user_patterns')
        .insert(patternData)
        .select('*')
        .single();

      if (error) throw new Error(`Database error: ${error.message}`);

      return {
        id: result.id,
        recordId: result.record_id,
        patternType: result.pattern_type,
        patternData: typeof result.pattern_data === 'string' ? JSON.parse(result.pattern_data) : result.pattern_data,
        confidence: result.confidence,
        lastObserved: result.last_observed,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };
    }
  } catch (error) {
    console.error('[DATABASE ERROR] upsertUserPattern failed:', error);
    throw error;
  }
}

/**
 * Get user memories (replaces Airtable getUserMemories)
 */
export async function getUserMemories(
  recordId: string,
  memoryType?: UserMemory['memoryType'],
  importance?: UserMemory['importance']
): Promise<UserMemory[]> {
  try {
    let query = supabase
      .from('user_memories')
      .select('*')
      .eq('record_id', recordId)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false });

    if (memoryType) {
      query = query.eq('memory_type', memoryType);
    }

    if (importance) {
      query = query.eq('importance', importance);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[DATABASE ERROR] getUserMemories failed:', error);
      return [];
    }

    // Filter out expired memories
    const now = new Date();
    return (data || [])
      .filter((m: any) => !m.expires_at || new Date(m.expires_at) > now)
      .map((m: any) => ({
        id: m.id,
        recordId: m.record_id,
        memoryType: m.memory_type,
        key: m.key,
        value: m.value,
        context: m.context,
        importance: m.importance,
        expiresAt: m.expires_at,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      }));
  } catch (error) {
    console.error('[DATABASE ERROR] getUserMemories failed:', error);
    return [];
  }
}

/**
 * Upsert user memory (replaces Airtable upsertUserMemory)
 */
export async function upsertUserMemory(memory: UserMemory): Promise<UserMemory> {
  try {
    const memoryData: any = {
      record_id: memory.recordId,
      memory_type: memory.memoryType,
      key: memory.key,
      value: memory.value,
      importance: memory.importance || 'medium',
    };

    if (memory.context) memoryData.context = memory.context;
    if (memory.expiresAt) memoryData.expires_at = memory.expiresAt;

    // Check if exists
    const { data: existing } = await supabase
      .from('user_memories')
      .select('id')
      .eq('record_id', memory.recordId)
      .eq('key', memory.key)
      .single();

    if (existing) {
      // Update
      const { data: result, error } = await supabase
        .from('user_memories')
        .update(memoryData)
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) throw new Error(`Database error: ${error.message}`);

      return {
        id: result.id,
        recordId: result.record_id,
        memoryType: result.memory_type,
        key: result.key,
        value: result.value,
        context: result.context,
        importance: result.importance,
        expiresAt: result.expires_at,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };
    } else {
      // Create
      const { data: result, error } = await supabase
        .from('user_memories')
        .insert(memoryData)
        .select('*')
        .single();

      if (error) throw new Error(`Database error: ${error.message}`);

      return {
        id: result.id,
        recordId: result.record_id,
        memoryType: result.memory_type,
        key: result.key,
        value: result.value,
        context: result.context,
        importance: result.importance,
        expiresAt: result.expires_at,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };
    }
  } catch (error) {
    console.error('[DATABASE ERROR] upsertUserMemory failed:', error);
    throw error;
  }
}

// ============================================================================
// VECTOR EMBEDDING FUNCTIONS
// ============================================================================

export interface Embedding {
  id: string;
  recordId: string;
  threadId?: string;
  messageId?: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, any>;
  createdAt?: string;
}

export interface SimilarEmbedding extends Embedding {
  similarity: number;
}

/**
 * Store an embedding in the database
 */
export async function storeEmbedding(data: {
  recordId: string;
  threadId?: string;
  messageId?: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, any>;
}): Promise<Embedding> {
  try {
    // Convert embedding array to PostgreSQL vector format
    // pgvector expects the format: [1,2,3] as a string
    const embeddingString = `[${data.embedding.join(',')}]`;

    const { data: result, error } = await supabase
      .from('embeddings')
      .insert({
        record_id: data.recordId,
        thread_id: data.threadId || null,
        message_id: data.messageId || null,
        content: data.content,
        embedding: embeddingString,
        metadata: data.metadata || null,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Parse embedding back from string format
    const embeddingArray = result.embedding 
      ? (typeof result.embedding === 'string' 
          ? JSON.parse(result.embedding) 
          : result.embedding)
      : [];

    return {
      id: result.id,
      recordId: result.record_id,
      threadId: result.thread_id,
      messageId: result.message_id,
      content: result.content,
      embedding: embeddingArray,
      metadata: result.metadata,
      createdAt: result.created_at,
    };
  } catch (error) {
    console.error('[DATABASE ERROR] storeEmbedding failed:', error);
    throw error;
  }
}

/**
 * Search for similar embeddings using cosine similarity
 * Uses pgvector's cosine distance operator (<=>)
 */
export async function searchSimilarEmbeddings(
  recordId: string,
  queryEmbedding: number[],
  options: {
    limit?: number;
    threshold?: number;
    threadId?: string;
  } = {}
): Promise<SimilarEmbedding[]> {
  try {
    const limit = options.limit || 10;
    const threshold = options.threshold || 0.7;

    // Convert embedding array to PostgreSQL vector format
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    // Use the SQL function we created for similarity search
    // We'll use RPC call to the search_similar_embeddings function
    const { data, error } = await supabase.rpc('search_similar_embeddings', {
      query_embedding: embeddingString,
      record_id_filter: recordId,
      similarity_threshold: threshold,
      result_limit: limit,
    });

    if (error) {
      // If the function doesn't exist, fall back to direct query
      console.warn('[DATABASE] search_similar_embeddings function not found, using direct query');
      
      // Direct query using cosine distance
      let query = supabase
        .from('embeddings')
        .select('*')
        .eq('record_id', recordId)
        .not('embedding', 'is', null)
        .order('embedding', { ascending: true, foreignTable: 'embeddings' })
        .limit(limit);

      if (options.threadId) {
        query = query.eq('thread_id', options.threadId);
      }

      const { data: directData, error: directError } = await query;

      if (directError) {
        throw new Error(`Database error: ${directError.message}`);
      }

      // Calculate similarity manually (1 - cosine_distance)
      // Note: This is less efficient than using the SQL function
      const results: SimilarEmbedding[] = (directData || []).map((item: any) => {
        const itemEmbedding = typeof item.embedding === 'string' 
          ? JSON.parse(item.embedding) 
          : item.embedding;
        
        // Simple cosine similarity calculation
        // For production, use the SQL function for better performance
        const similarity = calculateCosineSimilarity(queryEmbedding, itemEmbedding);

        return {
          id: item.id,
          recordId: item.record_id,
          threadId: item.thread_id,
          messageId: item.message_id,
          content: item.content,
          embedding: itemEmbedding,
          metadata: item.metadata,
          createdAt: item.created_at,
          similarity,
        };
      }).filter((item: SimilarEmbedding) => item.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      return results;
    }

    // Parse results from function
    return (data || []).map((item: any) => ({
      id: item.id,
      recordId: item.record_id,
      threadId: item.thread_id,
      messageId: item.message_id,
      content: item.content,
      embedding: typeof item.embedding === 'string' 
        ? JSON.parse(item.embedding) 
        : item.embedding,
      metadata: item.metadata,
      createdAt: item.created_at,
      similarity: item.similarity,
    }));
  } catch (error) {
    console.error('[DATABASE ERROR] searchSimilarEmbeddings failed:', error);
    return [];
  }
}

/**
 * Helper function to calculate cosine similarity
 * Used as fallback when SQL function is not available
 */
function calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    return 0;
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Delete embeddings for a specific message
 */
export async function deleteEmbeddingByMessageId(messageId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('embeddings')
      .delete()
      .eq('message_id', messageId);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  } catch (error) {
    console.error('[DATABASE ERROR] deleteEmbeddingByMessageId failed:', error);
    throw error;
  }
}

/**
 * Get embeddings count for a user
 */
export async function getEmbeddingsCount(recordId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('embeddings')
      .select('*', { count: 'exact', head: true })
      .eq('record_id', recordId);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return count || 0;
  } catch (error) {
    console.error('[DATABASE ERROR] getEmbeddingsCount failed:', error);
    return 0;
  }
}

