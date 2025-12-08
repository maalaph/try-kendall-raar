/**
 * PostgreSQL Database Functions (Supabase)
 * Replaces Airtable for all data operations
 */

import { supabase } from './supabase';
import { formatPhoneNumberToE164 } from './vapi';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format file URLs for attachment field (utility function, kept for compatibility)
 */
export function formatAttachmentField(files: Array<{ url: string; filename: string }>): Array<{ url: string; filename: string }> {
  return files.map(file => ({
    url: file.url,
    filename: file.filename,
  }));
}

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
  // OAuth tokens
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleTokenExpiresAt?: string;
  spotifyAccessToken?: string;
  spotifyRefreshToken?: string;
  spotifyTokenExpiresAt?: string;
  // Phone number fields
  vapiNumber?: string;
  vapiPhoneNumberId?: string;
  twilioPhoneSid?: string;
}

/**
 * Search user records by email or full name (replaces Airtable searchUserRecords)
 */
export async function searchUserRecords(searchTerm: string): Promise<{ records: Array<{ id: string; fields: UserRecord }> }> {
  try {
    const searchLower = searchTerm.toLowerCase();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .or(`email.ilike.%${searchLower}%,full_name.ilike.%${searchLower}%`);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    const records = (data || []).map((item: any) => ({
      id: item.record_id,
      fields: {
        id: item.id,
        record_id: item.record_id,
        fullName: item.full_name,
        nickname: item.nickname,
        email: item.email,
        mobileNumber: item.mobile_number,
        kendallName: item.kendall_name,
        selectedTraits: item.selected_traits,
        useCaseChoice: item.use_case_choice,
        boundaryChoices: item.boundary_choices,
        userContextAndRules: item.user_context_and_rules,
        analyzedFileContent: item.analyzed_file_content,
        fileUsageInstructions: item.file_usage_instructions,
        vapi_agent_id: item.vapi_agent_id,
        timeZone: item.time_zone,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        googleAccessToken: item.google_access_token,
        googleRefreshToken: item.google_refresh_token,
        googleTokenExpiresAt: item.google_token_expires_at,
        spotifyAccessToken: item.spotify_access_token,
        spotifyRefreshToken: item.spotify_refresh_token,
        spotifyTokenExpiresAt: item.spotify_token_expires_at,
        vapiNumber: item.vapi_number,
        vapiPhoneNumberId: item.vapi_phone_number_id,
        twilioPhoneSid: item.twilio_phone_sid,
      } as any,
    }));

    return { records };
  } catch (error) {
    console.error('[DATABASE ERROR] searchUserRecords failed:', error);
    throw error;
  }
}

/**
 * Get all user records (replaces Airtable getAllUserRecords)
 */
export async function getAllUserRecords(): Promise<{ records: Array<{ id: string; fields: UserRecord }> }> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*');

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    const records = (data || []).map((item: any) => ({
      id: item.record_id,
      fields: {
        id: item.id,
        record_id: item.record_id,
        fullName: item.full_name,
        nickname: item.nickname,
        email: item.email,
        mobileNumber: item.mobile_number,
        kendallName: item.kendall_name,
        selectedTraits: item.selected_traits,
        useCaseChoice: item.use_case_choice,
        boundaryChoices: item.boundary_choices,
        userContextAndRules: item.user_context_and_rules,
        analyzedFileContent: item.analyzed_file_content,
        fileUsageInstructions: item.file_usage_instructions,
        vapi_agent_id: item.vapi_agent_id,
        timeZone: item.time_zone,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        googleAccessToken: item.google_access_token,
        googleRefreshToken: item.google_refresh_token,
        googleTokenExpiresAt: item.google_token_expires_at,
        spotifyAccessToken: item.spotify_access_token,
        spotifyRefreshToken: item.spotify_refresh_token,
        spotifyTokenExpiresAt: item.spotify_token_expires_at,
        vapiNumber: item.vapi_number,
        vapiPhoneNumberId: item.vapi_phone_number_id,
        twilioPhoneSid: item.twilio_phone_sid,
      } as any,
    }));

    return { records };
  } catch (error) {
    console.error('[DATABASE ERROR] getAllUserRecords failed:', error);
    throw error;
  }
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
        // OAuth tokens
        googleAccessToken: data.google_access_token,
        googleRefreshToken: data.google_refresh_token,
        googleTokenExpiresAt: data.google_token_expires_at,
        spotifyAccessToken: data.spotify_access_token,
        spotifyRefreshToken: data.spotify_refresh_token,
        spotifyTokenExpiresAt: data.spotify_token_expires_at,
        // Phone number fields
        vapiNumber: data.vapi_number,
        vapiPhoneNumberId: data.vapi_phone_number_id,
        twilioPhoneSid: data.twilio_phone_sid,
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
    
    // OAuth tokens
    if (data.googleAccessToken !== undefined) updateData.google_access_token = data.googleAccessToken;
    if (data.googleRefreshToken !== undefined) updateData.google_refresh_token = data.googleRefreshToken;
    if (data.googleTokenExpiresAt !== undefined) updateData.google_token_expires_at = data.googleTokenExpiresAt;
    if (data.spotifyAccessToken !== undefined) updateData.spotify_access_token = data.spotifyAccessToken;
    if (data.spotifyRefreshToken !== undefined) updateData.spotify_refresh_token = data.spotifyRefreshToken;
    if (data.spotifyTokenExpiresAt !== undefined) updateData.spotify_token_expires_at = data.spotifyTokenExpiresAt;
    
    // Phone number fields
    if (data.vapiNumber !== undefined || data.vapi_number !== undefined) updateData.vapi_number = data.vapiNumber || data.vapi_number;
    if (data.vapiPhoneNumberId !== undefined || data.vapi_phone_number_id !== undefined) updateData.vapi_phone_number_id = data.vapiPhoneNumberId || data.vapi_phone_number_id;
    if (data.twilioPhoneSid !== undefined || data.twilio_phone_sid !== undefined) updateData.twilio_phone_sid = data.twilioPhoneSid || data.twilio_phone_sid;

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
    
    const { data: insertedThread, error: insertError } = await supabase
      .from('threads')
      .insert({
        record_id: recordId,
        thread_id: threadId,
      })
      .select('thread_id')
      .single();

    if (insertError) {
      console.error('[DATABASE ERROR] Failed to create thread:', {
        error: insertError.message,
        recordId,
        threadId,
      });
      throw new Error(`Database error: ${insertError.message}`);
    }

    // Verify thread was created
    if (!insertedThread || !insertedThread.thread_id) {
      throw new Error('Thread was created but not returned from database');
    }

    return insertedThread.thread_id;
  } catch (error) {
    console.error('[DATABASE ERROR] getOrCreateThreadId failed:', error);
    throw error;
  }
}

/**
 * Create a new thread (replaces Airtable createNewThread)
 */
export async function createNewThread(recordId: string): Promise<string> {
  try {
    // Generate new threadId
    const newThreadId = `thread_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Create thread record
    const { data, error } = await supabase
      .from('threads')
      .insert({
        record_id: recordId,
        thread_id: newThreadId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return newThreadId;
  } catch (error) {
    console.error('[DATABASE ERROR] createNewThread failed:', error);
    throw error;
  }
}

/**
 * Get all chat threads for a user (replaces Airtable getAllChatThreads)
 */
export async function getAllChatThreads(recordId: string): Promise<Array<{
  threadId: string;
  title: string;
  lastMessageAt: string;
  messageCount: number;
  preview: string;
}>> {
  try {
    // Get all threads for this user (exclude deleted ones - soft delete for UI organization only)
    // Try with deleted filter first, fallback to all threads if column doesn't exist
    let threads: any[] | null = null;
    let threadsError: any = null;
    
    // First, try querying with deleted filter
    const filteredQuery = supabase
      .from('threads')
      .select('thread_id, title, updated_at')
      .eq('record_id', recordId)
      .or('deleted.is.null,deleted.eq.false')
      .order('updated_at', { ascending: false });
    
    const filteredResult = await filteredQuery;
    threads = filteredResult.data;
    threadsError = filteredResult.error;
    
    // If error is about missing column, retry without the filter
    if (threadsError && threadsError.message?.includes('column') && threadsError.message?.includes('does not exist')) {
      const { data: allThreads, error: retryError } = await supabase
        .from('threads')
        .select('thread_id, title, updated_at')
        .eq('record_id', recordId)
        .order('updated_at', { ascending: false });
      
      if (retryError) {
        throw new Error(`Database error: ${retryError.message}`);
      }
      
      threads = allThreads;
    } else if (threadsError) {
      throw new Error(`Database error: ${threadsError.message}`);
    }

    // Get message counts and last message for each thread
    const threadsWithMetadata = await Promise.all(
      (threads || []).map(async (thread) => {
        const { data: messages, error: messagesError } = await supabase
          .from('chat_messages')
          .select('message, timestamp')
          .eq('thread_id', thread.thread_id)
          .order('timestamp', { ascending: false })
          .limit(1);

        const lastMessage = messages && messages.length > 0 ? messages[0] : null;
        const messageCount = await supabase
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('thread_id', thread.thread_id);

        return {
          threadId: thread.thread_id,
          title: thread.title || 'Untitled',
          lastMessageAt: lastMessage?.timestamp || thread.updated_at,
          messageCount: messageCount.count || 0,
          preview: lastMessage?.message?.substring(0, 100) || '',
        };
      })
    );

    return threadsWithMetadata;
  } catch (error) {
    console.error('[DATABASE ERROR] getAllChatThreads failed:', error);
    return [];
  }
}

/**
 * Update thread title (replaces Airtable updateThreadTitle)
 */
export async function updateThreadTitle(params: {
  recordId: string;
  threadId: string;
  agentId: string;
  title: string;
}): Promise<void> {
  try {
    const { error } = await supabase
      .from('threads')
      .update({ title: params.title })
      .eq('thread_id', params.threadId)
      .eq('record_id', params.recordId);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  } catch (error) {
    console.error('[DATABASE ERROR] updateThreadTitle failed:', error);
    throw error;
  }
}

/**
 * Mark thread as deleted (soft delete) - keeps data in Supabase for AI learning
 * This is for UI organization only, data remains available for pattern recognition
 * 
 * Note: If the 'deleted' column doesn't exist yet, this will fail silently.
 * You'll need to add the column to the threads table:
 *   ALTER TABLE threads ADD COLUMN deleted BOOLEAN DEFAULT false;
 *   ALTER TABLE threads ADD COLUMN deleted_at TIMESTAMPTZ;
 */
export async function markThreadAsDeleted(recordId: string, threadId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('threads')
      .update({ deleted: true, deleted_at: new Date().toISOString() })
      .eq('thread_id', threadId)
      .eq('record_id', recordId);

    if (error) {
      // If column doesn't exist, log warning but don't throw (backward compatibility)
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        console.warn('[DATABASE WARNING] deleted column does not exist in threads table. Thread marking skipped.');
        return;
      }
      throw new Error(`Database error: ${error.message}`);
    }
  } catch (error) {
    console.error('[DATABASE ERROR] markThreadAsDeleted failed:', error);
    throw error;
  }
}

/**
 * Mark multiple threads as deleted (soft delete) - keeps data in Supabase for AI learning
 * This is for UI organization only, data remains available for pattern recognition
 * 
 * Note: If the 'deleted' column doesn't exist yet, this will fail silently.
 * You'll need to add the column to the threads table:
 *   ALTER TABLE threads ADD COLUMN deleted BOOLEAN DEFAULT false;
 *   ALTER TABLE threads ADD COLUMN deleted_at TIMESTAMPTZ;
 */
export async function markThreadsAsDeleted(recordId: string, threadIds: string[]): Promise<void> {
  try {
    const { error } = await supabase
      .from('threads')
      .update({ deleted: true, deleted_at: new Date().toISOString() })
      .in('thread_id', threadIds)
      .eq('record_id', recordId);

    if (error) {
      // If column doesn't exist, log warning but don't throw (backward compatibility)
      if (error.message?.includes('column') && error.message?.includes('does not exist')) {
        console.warn('[DATABASE WARNING] deleted column does not exist in threads table. Thread marking skipped.');
        return;
      }
      throw new Error(`Database error: ${error.message}`);
    }
  } catch (error) {
    console.error('[DATABASE ERROR] markThreadsAsDeleted failed:', error);
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
    // Verify thread exists before creating message (foreign key constraint)
    // Use limit(1) instead of .single() to handle 0 or multiple results gracefully
    const { data: threadData, error: threadCheckError } = await supabase
      .from('threads')
      .select('thread_id')
      .eq('thread_id', data.threadId)
      .limit(1);

    const threadExists = threadData && threadData.length > 0;

    if (threadCheckError || !threadExists) {
      console.error('[DATABASE ERROR] Thread does not exist before creating message:', {
        threadId: data.threadId,
        recordId: data.recordId,
        threadCheckError: threadCheckError?.message,
      });
      
      // Try to create the thread if it doesn't exist
      const { error: createThreadError } = await supabase
        .from('threads')
        .insert({
          record_id: data.recordId,
          thread_id: data.threadId,
        });

      if (createThreadError) {
        throw new Error(`Thread does not exist and could not be created: ${createThreadError.message}`);
      }
      
      console.log('[DATABASE] Created missing thread:', data.threadId);
    }

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
    // Build query - try with importance ordering first, fallback if column missing
    let query = supabase
      .from('user_memories')
      .select('*')
      .eq('record_id', recordId);

    if (memoryType) {
      query = query.eq('memory_type', memoryType);
    }

    // Try to order by importance, but handle gracefully if column doesn't exist
    let { data, error } = await query.order('importance', { ascending: false }).order('created_at', { ascending: false });

    // If error is about missing 'importance' column, retry without it
    // Check both error.type, error.code, and error.message for Supabase error structure
    const isImportanceError = error && (
      (error as any).type === 'UNKNOWN_FIELD_NAME' ||
      (error as any).code === '42703' || // PostgreSQL undefined column error
      (error?.message && (
        error.message.includes('importance') || 
        error.message.includes('Unknown field') ||
        (error.message.includes('column') && error.message.includes('does not exist'))
      ))
    );

    if (isImportanceError) {
      console.warn('[DATABASE] user_memories table missing "importance" column. Querying without importance ordering.');
      query = supabase
        .from('user_memories')
        .select('*')
        .eq('record_id', recordId)
        .order('created_at', { ascending: false });
      
      if (memoryType) {
        query = query.eq('memory_type', memoryType);
      }
      
      const retryResult = await query;
      if (retryResult.error) {
        console.error('[DATABASE ERROR] getUserMemories failed:', retryResult.error);
        return [];
      }
      data = retryResult.data;
      error = null;
    } else if (error) {
      console.error('[DATABASE ERROR] getUserMemories failed:', error);
      return [];
    }

    // Filter by importance in memory if column exists and filter requested
    if (data && importance) {
      data = data.filter((m: any) => m.importance === importance);
    }

    // Sort by importance in memory if column exists (fallback if DB ordering failed)
    if (data && data.length > 0 && data[0].importance) {
      data.sort((a: any, b: any) => {
        const importanceOrder = { high: 3, medium: 2, low: 1 };
        const aOrder = importanceOrder[a.importance as keyof typeof importanceOrder] || 0;
        const bOrder = importanceOrder[b.importance as keyof typeof importanceOrder] || 0;
        return bOrder - aOrder;
      });
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
      
      // Direct query - get all embeddings and calculate similarity in memory
      // Note: Can't order by vector column directly in Supabase query
      let query = supabase
        .from('embeddings')
        .select('*')
        .eq('record_id', recordId)
        .not('embedding', 'is', null)
        .limit(limit * 2); // Get more results to filter by similarity

      if (options.threadId) {
        query = query.eq('thread_id', options.threadId);
      }

      const { data: directData, error: directError } = await query;

      if (directError) {
        // If embeddings table doesn't exist or query fails, return empty results gracefully
        console.warn('[DATABASE] Embeddings query failed, returning empty results:', directError.message);
        return [];
      }

      if (!directData || directData.length === 0) {
        return [];
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

// ============================================================================
// CALL NOTES FUNCTIONS
// ============================================================================

export interface CallNote {
  id: string;
  agent_id: string;
  call_id?: string;
  caller_phone: string;
  note: string;
  timestamp: string;
  owner_phone?: string;
  sms_sent: boolean;
  call_duration?: number;
  read: boolean;
  call_type?: 'inbound' | 'outbound';
  created_at: string;
}

/**
 * Create a call note (replaces Airtable createCallNote)
 */
export async function createCallNote(data: {
  callId?: string;
  agentId: string;
  callerPhone: string;
  note: string;
  timestamp?: string;
  ownerPhone?: string;
  smsSent?: boolean;
  callDuration?: number;
  read?: boolean;
  callType?: 'inbound' | 'outbound';
}): Promise<CallNote> {
  try {
    const { data: result, error } = await supabase
      .from('call_notes')
      .insert({
        agent_id: data.agentId,
        call_id: data.callId,
        caller_phone: data.callerPhone,
        note: data.note,
        timestamp: data.timestamp || new Date().toISOString(),
        owner_phone: data.ownerPhone,
        sms_sent: data.smsSent || false,
        call_duration: data.callDuration,
        read: data.read || false,
        call_type: data.callType,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return {
      id: result.id,
      agent_id: result.agent_id,
      call_id: result.call_id,
      caller_phone: result.caller_phone,
      note: result.note,
      timestamp: result.timestamp,
      owner_phone: result.owner_phone,
      sms_sent: result.sms_sent,
      call_duration: result.call_duration,
      read: result.read,
      call_type: result.call_type,
      created_at: result.created_at,
    };
  } catch (error) {
    console.error('[DATABASE ERROR] createCallNote failed:', error);
    throw error;
  }
}

/**
 * Get call notes for an agent (replaces Airtable getCallNotes)
 */
export async function getCallNotes(agentId: string, options?: {
  limit?: number;
  callType?: 'inbound' | 'outbound';
  read?: boolean;
}): Promise<CallNote[]> {
  try {
    let query = supabase
      .from('call_notes')
      .select('*')
      .eq('agent_id', agentId)
      .order('timestamp', { ascending: false });

    if (options?.callType) {
      query = query.eq('call_type', options.callType);
    }

    if (options?.read !== undefined) {
      query = query.eq('read', options.read);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      agent_id: item.agent_id,
      call_id: item.call_id,
      caller_phone: item.caller_phone,
      note: item.note,
      timestamp: item.timestamp,
      owner_phone: item.owner_phone,
      sms_sent: item.sms_sent,
      call_duration: item.call_duration,
      read: item.read,
      call_type: item.call_type,
      created_at: item.created_at,
    }));
  } catch (error) {
    console.error('[DATABASE ERROR] getCallNotes failed:', error);
    throw error;
  }
}

/**
 * Get recent call notes for an agent (replaces Airtable getRecentCallNotes)
 */
export async function getRecentCallNotes(agentId: string, limit: number = 10): Promise<CallNote[]> {
  return getCallNotes(agentId, { limit });
}

/**
 * Get unread call notes for an agent (replaces Airtable getUnreadCallNotes)
 */
export async function getUnreadCallNotes(agentId: string): Promise<CallNote[]> {
  return getCallNotes(agentId, { read: false });
}

/**
 * Get all call notes for an agent (replaces Airtable getAllCallNotes)
 */
export async function getAllCallNotes(agentId: string, limit: number = 100): Promise<CallNote[]> {
  return getCallNotes(agentId, { limit });
}

/**
 * Mark call notes as read (replaces Airtable markCallNotesAsRead)
 */
export async function markCallNotesAsRead(noteIds: string[]): Promise<void> {
  try {
    if (noteIds.length === 0) {
      return;
    }

    const { error } = await supabase
      .from('call_notes')
      .update({ read: true })
      .in('id', noteIds);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  } catch (error) {
    console.error('[DATABASE ERROR] markCallNotesAsRead failed:', error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Delete a call note (replaces Airtable deleteCallNote)
 */
export async function deleteCallNote(callNoteId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('call_notes')
      .delete()
      .eq('id', callNoteId);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  } catch (error) {
    console.error('[DATABASE ERROR] deleteCallNote failed:', error);
    throw error;
  }
}

/**
 * Get call statistics for an agent (replaces Airtable getCallStats)
 */
export async function getCallStats(agentId: string): Promise<{
  totalCalls: number;
  totalCallMinutes: number;
  averageCallDuration: number;
}> {
  try {
    const { data, error } = await supabase
      .from('call_notes')
      .select('call_duration')
      .eq('agent_id', agentId);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    const records = data || [];
    const callsWithDuration = records.filter((r: any) => r.call_duration && r.call_duration > 0);
    const totalCalls = records.length;
    const totalCallSeconds = callsWithDuration.reduce((sum: number, r: any) => sum + (r.call_duration || 0), 0);
    const totalCallMinutes = totalCallSeconds / 60;
    const averageCallDuration = callsWithDuration.length > 0 ? totalCallSeconds / callsWithDuration.length : 0;

    return {
      totalCalls,
      totalCallMinutes: Math.round(totalCallMinutes * 100) / 100,
      averageCallDuration: Math.round(averageCallDuration),
    };
  } catch (error) {
    console.error('[DATABASE ERROR] getCallStats failed:', error);
    throw error;
  }
}

// ============================================================================
// SCHEDULED CALLS FUNCTIONS
// ============================================================================

export interface ScheduledCall {
  id: string;
  agent_id: string;
  recipient_name?: string;
  recipient_phone: string;
  scheduled_time: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  call_type: string;
  phone_number_id?: string;
  message?: string;
  caller_name?: string;
  record_id?: string;
  thread_id?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Create a scheduled call task (replaces Airtable createScheduledCallTask)
 */
export async function createScheduledCallTask(data: {
  phone_number: string;
  message: string;
  scheduled_time: string;
  owner_agent_id: string;
  caller_name?: string;
  phone_number_id?: string;
  recipient_name?: string;
  status?: 'pending' | 'executing' | 'completed' | 'failed';
  recordId?: string;
  threadId?: string;
}): Promise<ScheduledCall> {
  try {
    const { data: result, error } = await supabase
      .from('scheduled_calls')
      .insert({
        agent_id: data.owner_agent_id,
        recipient_phone: data.phone_number,
        scheduled_time: data.scheduled_time,
        status: data.status || 'pending',
        call_type: 'outbound',
        phone_number_id: data.phone_number_id,
        message: data.message,
        caller_name: data.caller_name,
        recipient_name: data.recipient_name,
        record_id: data.recordId,
        thread_id: data.threadId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return {
      id: result.id,
      agent_id: result.agent_id,
      recipient_name: result.recipient_name,
      recipient_phone: result.recipient_phone,
      scheduled_time: result.scheduled_time,
      status: result.status,
      call_type: result.call_type,
      phone_number_id: result.phone_number_id,
      message: result.message,
      caller_name: result.caller_name,
      record_id: result.record_id,
      thread_id: result.thread_id,
      created_at: result.created_at,
      updated_at: result.updated_at,
    };
  } catch (error) {
    console.error('[DATABASE ERROR] createScheduledCallTask failed:', error);
    throw error;
  }
}

/**
 * Get scheduled call tasks (replaces Airtable getScheduledCallTasks)
 */
export async function getScheduledCallTasks(options?: {
  agentId?: string;
  status?: 'pending' | 'executing' | 'completed' | 'failed';
  limit?: number;
}): Promise<ScheduledCall[]> {
  try {
    let query = supabase
      .from('scheduled_calls')
      .select('*')
      .order('scheduled_time', { ascending: true });

    if (options?.agentId) {
      query = query.eq('agent_id', options.agentId);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      agent_id: item.agent_id,
      recipient_name: item.recipient_name,
      recipient_phone: item.recipient_phone,
      scheduled_time: item.scheduled_time,
      status: item.status,
      call_type: item.call_type,
      phone_number_id: item.phone_number_id,
      message: item.message,
      caller_name: item.caller_name,
      record_id: item.record_id,
      thread_id: item.thread_id,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  } catch (error) {
    console.error('[DATABASE ERROR] getScheduledCallTasks failed:', error);
    throw error;
  }
}

/**
 * Update scheduled call task (replaces Airtable updateScheduledCallTask)
 */
export async function updateScheduledCallTask(
  taskId: string,
  updates: {
    status?: 'pending' | 'executing' | 'completed' | 'failed';
    scheduled_time?: string;
    phone_number_id?: string;
    message?: string;
    error_message?: string;
    call_id?: string;
  }
): Promise<ScheduledCall> {
  try {
    const updateData: any = {};

    if (updates.status) {
      updateData.status = updates.status;
    }
    if (updates.scheduled_time) {
      updateData.scheduled_time = updates.scheduled_time;
    }
    if (updates.phone_number_id !== undefined) {
      updateData.phone_number_id = updates.phone_number_id;
    }
    if (updates.message) {
      updateData.message = updates.message;
    }
    if (updates.error_message !== undefined) {
      updateData.error_message = updates.error_message;
    }
    if (updates.call_id !== undefined) {
      updateData.call_id = updates.call_id;
    }

    const { data: result, error } = await supabase
      .from('scheduled_calls')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return {
      id: result.id,
      agent_id: result.agent_id,
      recipient_name: result.recipient_name,
      recipient_phone: result.recipient_phone,
      scheduled_time: result.scheduled_time,
      status: result.status,
      call_type: result.call_type,
      phone_number_id: result.phone_number_id,
      message: result.message,
      caller_name: result.caller_name,
      record_id: result.record_id,
      thread_id: result.thread_id,
      created_at: result.created_at,
      updated_at: result.updated_at,
    };
  } catch (error) {
    console.error('[DATABASE ERROR] updateScheduledCallTask failed:', error);
    throw error;
  }
}

/**
 * Update scheduled call task atomically (replaces Airtable updateScheduledCallTaskAtomically)
 * Uses a transaction-like approach with status check
 */
export async function updateScheduledCallTaskAtomically(
  taskId: string,
  expectedStatus: 'pending' | 'executing' | 'completed' | 'failed',
  updates: {
    status?: 'pending' | 'executing' | 'completed' | 'failed';
    scheduled_time?: string;
    phone_number_id?: string;
    message?: string;
  }
): Promise<ScheduledCall | null> {
  try {
    // First, check current status
    const { data: current, error: fetchError } = await supabase
      .from('scheduled_calls')
      .select('status')
      .eq('id', taskId)
      .single();

    if (fetchError || !current) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (current.status !== expectedStatus) {
      console.warn(`[DATABASE] Task ${taskId} status mismatch. Expected ${expectedStatus}, got ${current.status}`);
      return null;
    }

    // Update if status matches
    return await updateScheduledCallTask(taskId, updates);
  } catch (error) {
    console.error('[DATABASE ERROR] updateScheduledCallTaskAtomically failed:', error);
    throw error;
  }
}

// ============================================================================
// OUTBOUND CALL REQUESTS FUNCTIONS
// ============================================================================

export interface OutboundCallRequest {
  id: string;
  agent_id?: string;
  call_id: string;
  record_id: string;
  thread_id: string;
  recipient_name?: string;
  recipient_phone?: string;
  status: 'pending' | 'in-call' | 'completed' | 'failed' | 'voicemail';
  phone_number?: string;
  created_at: string;
  completed_at?: string;
  updated_at: string;
}

/**
 * Create outbound call request (replaces Airtable createOutboundCallRequest)
 */
export async function createOutboundCallRequest(data: {
  callId: string;
  recordId: string;
  threadId: string;
  status?: 'pending' | 'in-call' | 'completed' | 'failed' | 'voicemail';
  phoneNumber?: string;
  agentId?: string;
  recipientName?: string;
  recipientPhone?: string;
}): Promise<OutboundCallRequest> {
  try {
    const { data: result, error } = await supabase
      .from('outbound_call_requests')
      .insert({
        call_id: data.callId,
        record_id: data.recordId,
        thread_id: data.threadId,
        status: data.status || 'pending',
        phone_number: data.phoneNumber,
        agent_id: data.agentId,
        recipient_name: data.recipientName,
        recipient_phone: data.recipientPhone,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return {
      id: result.id,
      agent_id: result.agent_id,
      call_id: result.call_id,
      record_id: result.record_id,
      thread_id: result.thread_id,
      recipient_name: result.recipient_name,
      recipient_phone: result.recipient_phone,
      status: result.status,
      phone_number: result.phone_number,
      created_at: result.created_at,
      completed_at: result.completed_at,
      updated_at: result.updated_at,
    };
  } catch (error) {
    console.error('[DATABASE ERROR] createOutboundCallRequest failed:', error);
    throw error;
  }
}

/**
 * Get outbound call request by call ID (replaces Airtable getOutboundCallRequestByCallId)
 */
export async function getOutboundCallRequestByCallId(callId: string): Promise<OutboundCallRequest | null> {
  try {
    const { data, error } = await supabase
      .from('outbound_call_requests')
      .select('*')
      .eq('call_id', callId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Database error: ${error.message}`);
    }

    return {
      id: data.id,
      agent_id: data.agent_id,
      call_id: data.call_id,
      record_id: data.record_id,
      thread_id: data.thread_id,
      recipient_name: data.recipient_name,
      recipient_phone: data.recipient_phone,
      status: data.status,
      phone_number: data.phone_number,
      created_at: data.created_at,
      completed_at: data.completed_at,
      updated_at: data.updated_at,
    };
  } catch (error) {
    console.error('[DATABASE ERROR] getOutboundCallRequestByCallId failed:', error);
    return null;
  }
}

/**
 * Update outbound call request (replaces Airtable updateOutboundCallRequest)
 */
export async function updateOutboundCallRequest(
  callId: string,
  updates: {
    status?: 'pending' | 'in-call' | 'completed' | 'failed' | 'voicemail';
    completedAt?: string;
  }
): Promise<OutboundCallRequest | null> {
  try {
    const updateData: any = {};

    if (updates.status) {
      updateData.status = updates.status;
    }
    if (updates.completedAt) {
      updateData.completed_at = updates.completedAt;
    }

    const { data: result, error } = await supabase
      .from('outbound_call_requests')
      .update(updateData)
      .eq('call_id', callId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Database error: ${error.message}`);
    }

    return {
      id: result.id,
      agent_id: result.agent_id,
      call_id: result.call_id,
      record_id: result.record_id,
      thread_id: result.thread_id,
      recipient_name: result.recipient_name,
      recipient_phone: result.recipient_phone,
      status: result.status,
      phone_number: result.phone_number,
      created_at: result.created_at,
      completed_at: result.completed_at,
      updated_at: result.updated_at,
    };
  } catch (error) {
    console.error('[DATABASE ERROR] updateOutboundCallRequest failed:', error);
    throw error;
  }
}

// ============================================================================
// PHONE NUMBER MAPPINGS FUNCTIONS
// ============================================================================

export interface PhoneNumberMapping {
  id: string;
  agent_id: string;
  canadian_phone?: string;
  phone_number_id?: string;
  twilio_sid?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get Canadian number by agent ID (replaces Airtable getCanadianNumberByAgentId)
 */
export async function getCanadianNumberByAgentId(agentId: string): Promise<{
  phoneNumber: string;
  vapiPhoneNumberId?: string;
  twilioSid?: string;
} | null> {
  try {
    // First try phone_number_mappings table
    const { data: mapping, error: mappingError } = await supabase
      .from('phone_number_mappings')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (!mappingError && mapping && mapping.canadian_phone) {
      return {
        phoneNumber: mapping.canadian_phone,
        vapiPhoneNumberId: mapping.phone_number_id,
        twilioSid: mapping.twilio_sid,
      };
    }

    // Fallback to users table vapi_number field
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('vapi_number, vapi_phone_number_id, twilio_phone_sid')
      .eq('vapi_agent_id', agentId)
      .single();

    if (userError || !user || !user.vapi_number) {
      return null;
    }

    return {
      phoneNumber: user.vapi_number,
      vapiPhoneNumberId: user.vapi_phone_number_id,
      twilioSid: user.twilio_phone_sid,
    };
  } catch (error) {
    console.error('[DATABASE ERROR] getCanadianNumberByAgentId failed:', error);
    return null;
  }
}

/**
 * Get agent by Canadian phone number (replaces Airtable getAgentByCanadianNumber)
 */
export async function getAgentByCanadianNumber(phoneNumber: string): Promise<{
  agentId: string;
  fullName: string;
  mobileNumber: string;
  recordId: string;
  vapiPhoneNumberId?: string;
  twilioSid?: string;
} | null> {
  try {
    // Normalize phone number
    const normalizePhone = (pn: string): string => {
      if (!pn || typeof pn !== 'string') return '';
      let digits = pn.replace(/\D/g, '');
      if (digits.length === 11 && digits.startsWith('1')) {
        digits = digits.substring(1);
      }
      return digits.length === 10 ? digits : '';
    };

    const normalizedInput = normalizePhone(phoneNumber);
    if (!normalizedInput) {
      return null;
    }

    // Try phone_number_mappings table first
    const { data: mappings, error: mappingError } = await supabase
      .from('phone_number_mappings')
      .select('agent_id, canadian_phone, phone_number_id, twilio_sid');

    if (!mappingError && mappings) {
      for (const mapping of mappings) {
        if (mapping.canadian_phone && normalizePhone(mapping.canadian_phone) === normalizedInput) {
          // Get user info
          const { data: user, error: userError } = await supabase
            .from('users')
            .select('record_id, full_name, mobile_number')
            .eq('vapi_agent_id', mapping.agent_id)
            .single();

          if (!userError && user) {
            return {
              agentId: mapping.agent_id,
              fullName: user.full_name || '',
              mobileNumber: user.mobile_number || '',
              recordId: user.record_id,
              vapiPhoneNumberId: mapping.phone_number_id,
              twilioSid: mapping.twilio_sid,
            };
          }
        }
      }
    }

    // Fallback to users table
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('record_id, full_name, mobile_number, vapi_agent_id, vapi_number, vapi_phone_number_id, twilio_phone_sid');

    if (!userError && users) {
      for (const user of users) {
        if (user.vapi_number && normalizePhone(user.vapi_number) === normalizedInput) {
          return {
            agentId: user.vapi_agent_id || '',
            fullName: user.full_name || '',
            mobileNumber: user.mobile_number || '',
            recordId: user.record_id,
            vapiPhoneNumberId: user.vapi_phone_number_id,
            twilioSid: user.twilio_phone_sid,
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[DATABASE ERROR] getAgentByCanadianNumber failed:', error);
    return null;
  }
}

/**
 * Update Canadian number mapping (replaces Airtable updateCanadianNumberMapping)
 */
export async function updateCanadianNumberMapping(
  agentId: string,
  data: {
    canadianPhone?: string;
    phoneNumberId?: string;
    twilioSid?: string;
  }
): Promise<PhoneNumberMapping> {
  try {
    // Check if mapping exists
    const { data: existing, error: fetchError } = await supabase
      .from('phone_number_mappings')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    const updateData: any = {};
    if (data.canadianPhone !== undefined) {
      updateData.canadian_phone = data.canadianPhone;
    }
    if (data.phoneNumberId !== undefined) {
      updateData.phone_number_id = data.phoneNumberId;
    }
    if (data.twilioSid !== undefined) {
      updateData.twilio_sid = data.twilioSid;
    }

    if (fetchError || !existing) {
      // Create new mapping
      const { data: result, error } = await supabase
        .from('phone_number_mappings')
        .insert({
          agent_id: agentId,
          ...updateData,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        id: result.id,
        agent_id: result.agent_id,
        canadian_phone: result.canadian_phone,
        phone_number_id: result.phone_number_id,
        twilio_sid: result.twilio_sid,
        created_at: result.created_at,
        updated_at: result.updated_at,
      };
    } else {
      // Update existing mapping
      const { data: result, error } = await supabase
        .from('phone_number_mappings')
        .update(updateData)
        .eq('agent_id', agentId)
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        id: result.id,
        agent_id: result.agent_id,
        canadian_phone: result.canadian_phone,
        phone_number_id: result.phone_number_id,
        twilio_sid: result.twilio_sid,
        created_at: result.created_at,
        updated_at: result.updated_at,
      };
    }
  } catch (error) {
    console.error('[DATABASE ERROR] updateCanadianNumberMapping failed:', error);
    throw error;
  }
}

// ============================================================================
// OWNER LOOKUP FUNCTIONS
// ============================================================================

/**
 * Get owner phone by agent ID (replaces Airtable getOwnerPhoneByAgentId)
 */
export async function getOwnerPhoneByAgentId(agentId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('mobile_number')
      .eq('vapi_agent_id', agentId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.mobile_number || null;
  } catch (error) {
    console.error('[DATABASE ERROR] getOwnerPhoneByAgentId failed:', error);
    return null;
  }
}

/**
 * Get owner info by agent ID (replaces Airtable getOwnerInfoByAgentId)
 */
export async function getOwnerInfoByAgentId(agentId: string): Promise<{
  fullName: string;
  kendallName: string;
  mobileNumber: string;
  recordId: string;
} | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('record_id, full_name, kendall_name, mobile_number')
      .eq('vapi_agent_id', agentId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      fullName: data.full_name || '',
      kendallName: data.kendall_name || 'Kendall',
      mobileNumber: data.mobile_number || '',
      recordId: data.record_id,
    };
  } catch (error) {
    console.error('[DATABASE ERROR] getOwnerInfoByAgentId failed:', error);
    return null;
  }
}

/**
 * Get user record by agent ID (replaces Airtable getUserRecordByAgentId)
 */
export async function getUserRecordByAgentId(agentId: string): Promise<{ id: string; fields: UserRecord } | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('vapi_agent_id', agentId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.record_id || data.id,
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
    console.error('[DATABASE ERROR] getUserRecordByAgentId failed:', error);
    return null;
  }
}

/**
 * Get owner by phone number (replaces Airtable getOwnerByPhoneNumber)
 */
export async function getOwnerByPhoneNumber(phoneNumber: string): Promise<{
  fullName: string;
  mobileNumber: string;
  agentId?: string;
  recordId: string;
} | null> {
  try {
    // Normalize phone number
    const normalizePhone = (pn: string): string => {
      if (!pn || typeof pn !== 'string') return '';
      let digits = pn.replace(/\D/g, '');
      if (digits.length === 11 && digits.startsWith('1')) {
        digits = digits.substring(1);
      }
      return digits.length === 10 ? digits : '';
    };

    const normalizedInput = normalizePhone(phoneNumber);
    if (!normalizedInput) {
      return null;
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('record_id, full_name, mobile_number, vapi_agent_id');

    if (error || !users) {
      return null;
    }

    for (const user of users) {
      if (user.mobile_number && normalizePhone(user.mobile_number) === normalizedInput) {
        return {
          fullName: user.full_name || '',
          mobileNumber: user.mobile_number,
          agentId: user.vapi_agent_id,
          recordId: user.record_id,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('[DATABASE ERROR] getOwnerByPhoneNumber failed:', error);
    return null;
  }
}

// ============================================================================
// BUSINESS TRIALS FUNCTIONS
// ============================================================================

export interface BusinessTrial {
  id: string;
  record_id?: string;
  full_name: string;
  email?: string;
  phone?: string;
  business_website?: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

/**
 * Create business trial record (replaces Airtable createBusinessTrialRecord)
 */
export async function createBusinessTrialRecord(data: Record<string, any>): Promise<{ id: string }> {
  try {
    const { data: result, error } = await supabase
      .from('business_trials')
      .insert({
        record_id: data.recordId || data.id,
        full_name: data.fullName || data.full_name,
        email: data.email,
        phone: data.phone,
        business_website: data.businessWebsite || data.business_website,
        status: data.status || 'pending',
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return { id: result.id };
  } catch (error) {
    console.error('[DATABASE ERROR] createBusinessTrialRecord failed:', error);
    throw error;
  }
}

/**
 * Get business trial record (replaces Airtable getBusinessTrialRecord)
 */
export async function getBusinessTrialRecord(recordId: string): Promise<BusinessTrial | null> {
  try {
    const { data, error } = await supabase
      .from('business_trials')
      .select('*')
      .eq('record_id', recordId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Database error: ${error.message}`);
    }

    return {
      id: data.id,
      record_id: data.record_id,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone,
      business_website: data.business_website,
      status: data.status,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  } catch (error) {
    console.error('[DATABASE ERROR] getBusinessTrialRecord failed:', error);
    return null;
  }
}

/**
 * Update business trial record (replaces Airtable updateBusinessTrialRecord)
 */
export async function updateBusinessTrialRecord(recordId: string, data: Record<string, any>): Promise<{ id: string }> {
  try {
    const updateData: any = {};

    if (data.fullName !== undefined || data.full_name !== undefined) {
      updateData.full_name = data.fullName || data.full_name;
    }
    if (data.email !== undefined) {
      updateData.email = data.email;
    }
    if (data.phone !== undefined) {
      updateData.phone = data.phone;
    }
    if (data.businessWebsite !== undefined || data.business_website !== undefined) {
      updateData.business_website = data.businessWebsite || data.business_website;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    const { data: result, error } = await supabase
      .from('business_trials')
      .update(updateData)
      .eq('record_id', recordId)
      .select('id')
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return { id: result.id };
  } catch (error) {
    console.error('[DATABASE ERROR] updateBusinessTrialRecord failed:', error);
    throw error;
  }
}

// ============================================================================
// CALENDAR EVENTS FUNCTIONS
// ============================================================================

export interface CalendarEvent {
  id: string;
  record_id: string;
  event_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  time_zone: string;
  all_day: boolean;
  location?: string;
  attendees?: string[];
  status: 'Active' | 'Updated' | 'Cancelled';
  source?: string;
  event_url?: string;
  calendar_id?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Upsert calendar event record (replaces Airtable upsertCalendarEventRecord)
 */
export async function upsertCalendarEventRecord(data: {
  googleEventId: string;
  userRecordId: string;
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  timeZone: string;
  allDay?: boolean;
  location?: string;
  attendees?: string[];
  status?: 'Active' | 'Updated' | 'Cancelled';
  source?: string;
  eventUrl?: string;
  calendarId?: string;
}): Promise<CalendarEvent> {
  try {
    // Check if event exists
    const { data: existing, error: fetchError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('record_id', data.userRecordId)
      .eq('event_id', data.googleEventId)
      .single();

    const eventData: any = {
      record_id: data.userRecordId,
      event_id: data.googleEventId,
      title: data.summary,
      description: data.description,
      start_time: data.startDateTime,
      end_time: data.endDateTime,
      time_zone: data.timeZone || 'UTC',
      all_day: data.allDay || false,
      location: data.location,
      attendees: data.attendees,
      status: data.status || 'Active',
      source: data.source,
      event_url: data.eventUrl,
      calendar_id: data.calendarId,
    };

    if (fetchError || !existing) {
      // Insert new event
      const { data: result, error } = await supabase
        .from('calendar_events')
        .insert(eventData)
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        id: result.id,
        record_id: result.record_id,
        event_id: result.event_id,
        title: result.title,
        description: result.description,
        start_time: result.start_time,
        end_time: result.end_time,
        time_zone: result.time_zone,
        all_day: result.all_day,
        location: result.location,
        attendees: result.attendees,
        status: result.status,
        source: result.source,
        event_url: result.event_url,
        calendar_id: result.calendar_id,
        created_at: result.created_at,
        updated_at: result.updated_at,
      };
    } else {
      // Update existing event
      const { data: result, error } = await supabase
        .from('calendar_events')
        .update(eventData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        id: result.id,
        record_id: result.record_id,
        event_id: result.event_id,
        title: result.title,
        description: result.description,
        start_time: result.start_time,
        end_time: result.end_time,
        time_zone: result.time_zone,
        all_day: result.all_day,
        location: result.location,
        attendees: result.attendees,
        status: result.status,
        source: result.source,
        event_url: result.event_url,
        calendar_id: result.calendar_id,
        created_at: result.created_at,
        updated_at: result.updated_at,
      };
    }
  } catch (error) {
    console.error('[DATABASE ERROR] upsertCalendarEventRecord failed:', error);
    throw error;
  }
}

// ============================================================================
// OAUTH TOKEN HELPERS
// ============================================================================

/**
 * Update user record with OAuth tokens (extends updateUserRecord)
 * This is handled by the existing updateUserRecord function, but we add helpers here
 */
export async function updateUserOAuthTokens(
  recordId: string,
  tokens: {
    google?: {
      accessToken: string;
      refreshToken: string;
      expiresAt: string;
    };
    spotify?: {
      accessToken: string;
      refreshToken: string;
      expiresAt: string;
    };
  }
): Promise<void> {
  try {
    const updateData: any = {};

    if (tokens.google) {
      updateData.google_access_token = tokens.google.accessToken;
      updateData.google_refresh_token = tokens.google.refreshToken;
      updateData.google_token_expires_at = tokens.google.expiresAt;
    }

    if (tokens.spotify) {
      updateData.spotify_access_token = tokens.spotify.accessToken;
      updateData.spotify_refresh_token = tokens.spotify.refreshToken;
      updateData.spotify_token_expires_at = tokens.spotify.expiresAt;
    }

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('record_id', recordId);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  } catch (error) {
    console.error('[DATABASE ERROR] updateUserOAuthTokens failed:', error);
    throw error;
  }
}

/**
 * Get OAuth tokens for a user
 */
export async function getUserOAuthTokens(recordId: string): Promise<{
  google?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  };
  spotify?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  };
}> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('google_access_token, google_refresh_token, google_token_expires_at, spotify_access_token, spotify_refresh_token, spotify_token_expires_at')
      .eq('record_id', recordId)
      .single();

    if (error || !data) {
      return {};
    }

    const result: any = {};

    if (data.google_access_token) {
      result.google = {
        accessToken: data.google_access_token,
        refreshToken: data.google_refresh_token || '',
        expiresAt: data.google_token_expires_at || '',
      };
    }

    if (data.spotify_access_token) {
      result.spotify = {
        accessToken: data.spotify_access_token,
        refreshToken: data.spotify_refresh_token || '',
        expiresAt: data.spotify_token_expires_at || '',
      };
    }

    return result;
  } catch (error) {
    console.error('[DATABASE ERROR] getUserOAuthTokens failed:', error);
    return {};
  }
}
