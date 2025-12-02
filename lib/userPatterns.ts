/**
 * User Patterns and Memory Management
 * Stores and retrieves user behavior patterns, preferences, and long-term memory
 */

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const USER_PATTERNS_TABLE_ID = process.env.AIRTABLE_USER_PATTERNS_TABLE_ID;
const USER_MEMORY_TABLE_ID = process.env.AIRTABLE_USER_MEMORY_TABLE_ID;

const USER_PATTERNS_API_URL = AIRTABLE_BASE_ID && USER_PATTERNS_TABLE_ID
  ? `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${USER_PATTERNS_TABLE_ID}`
  : '';

const USER_MEMORY_API_URL = AIRTABLE_BASE_ID && USER_MEMORY_TABLE_ID
  ? `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${USER_MEMORY_TABLE_ID}`
  : '';

const getHeaders = () => ({
  'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json',
});

/**
 * User Pattern Types
 */
export interface UserPattern {
  id?: string;
  recordId: string; // Link to main user record
  patternType: 'recurring_call' | 'time_based_action' | 'preferred_contact' | 'behavior' | 'preference';
  patternData: {
    description: string;
    frequency?: 'daily' | 'weekly' | 'monthly' | 'custom';
    dayOfWeek?: number; // 0-6 (Sunday-Saturday)
    timeOfDay?: string; // HH:MM format
    contactName?: string;
    contactPhone?: string;
    metadata?: Record<string, any>;
  };
  confidence?: number; // 0-1, how confident we are in this pattern
  lastObserved?: string; // ISO timestamp
  createdAt?: string;
  updatedAt?: string;
}

/**
 * User Memory Types
 */
export interface UserMemory {
  id?: string;
  recordId: string; // Link to main user record
  memoryType: 'fact' | 'preference' | 'relationship' | 'reminder' | 'important_date' | 'instruction';
  key: string; // Unique key for this memory
  value: string; // The actual memory content
  context?: string; // Additional context about this memory
  importance?: 'low' | 'medium' | 'high';
  expiresAt?: string; // ISO timestamp - when this memory expires (optional)
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Create or update a user pattern
 */
export async function upsertUserPattern(pattern: UserPattern): Promise<UserPattern> {
  try {
    if (!USER_PATTERNS_API_URL) {
      console.warn('[USER PATTERNS] USER_PATTERNS_TABLE_ID not configured. Pattern will not be saved.');
      return pattern;
    }

    const fields: Record<string, any> = {
      recordId: [pattern.recordId], // Linked record
      patternType: pattern.patternType,
      patternData: JSON.stringify(pattern.patternData),
      confidence: pattern.confidence || 0.5,
      lastObserved: pattern.lastObserved || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (pattern.createdAt) {
      fields.createdAt = pattern.createdAt;
    } else {
      fields.createdAt = new Date().toISOString();
    }

    // Try to find existing pattern first
    if (pattern.id) {
      // Update existing
      const url = `${USER_PATTERNS_API_URL}/${pattern.id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ fields }),
      });

      if (response.ok) {
        const result = await response.json();
        return parsePatternFromRecord(result);
      }
    }

    // Create new
    const response = await fetch(USER_PATTERNS_API_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `Failed to create pattern: ${response.status}`;
      console.error('[USER PATTERNS] Failed to create pattern:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        patternType: pattern.patternType,
        recordId: pattern.recordId,
        hasTableId: !!USER_PATTERNS_TABLE_ID,
        tableId: USER_PATTERNS_TABLE_ID,
      });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[USER PATTERNS] Successfully saved pattern:', {
      patternType: pattern.patternType,
      recordId: pattern.recordId,
      patternId: result.id,
      confidence: pattern.confidence,
    });
    return parsePatternFromRecord(result);
  } catch (error) {
    console.error('[USER PATTERNS] Failed to upsert pattern:', error);
    console.error('[USER PATTERNS] Error details:', {
      patternType: pattern.patternType,
      recordId: pattern.recordId,
      hasTableId: !!USER_PATTERNS_TABLE_ID,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Get user patterns for a specific user
 */
export async function getUserPatterns(recordId: string, patternType?: UserPattern['patternType']): Promise<UserPattern[]> {
  try {
    if (!USER_PATTERNS_API_URL) {
      return [];
    }

    let filterFormula = `{recordId} = "${recordId}"`;
    if (patternType) {
      filterFormula += ` AND {patternType} = "${patternType}"`;
    }

    const url = `${USER_PATTERNS_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=lastObserved&sort[0][direction]=desc`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[USER PATTERNS] Failed to get patterns:', errorData);
      return [];
    }

    const result = await response.json();
    return (result.records || []).map(parsePatternFromRecord);
  } catch (error) {
    console.error('[USER PATTERNS] Failed to get patterns:', error);
    return [];
  }
}

/**
 * Create or update a user memory
 */
export async function upsertUserMemory(memory: UserMemory): Promise<UserMemory> {
  try {
    if (!USER_MEMORY_API_URL) {
      console.warn('[USER MEMORY] USER_MEMORY_TABLE_ID not configured. Memory will not be saved.');
      return memory;
    }

    // Check if memory with this key already exists
    const existing = await getUserMemoryByKey(memory.recordId, memory.key);
    
    const fields: Record<string, any> = {
      recordId: [memory.recordId], // Linked record
      memoryType: memory.memoryType,
      key: memory.key,
      value: memory.value,
      importance: memory.importance || 'medium',
      updatedAt: new Date().toISOString(),
    };

    if (memory.context) {
      fields.context = memory.context;
    }

    if (memory.expiresAt) {
      fields.expiresAt = memory.expiresAt;
    }

    if (existing) {
      // Update existing
      const url = `${USER_MEMORY_API_URL}/${existing.id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ fields }),
      });

      if (response.ok) {
        const result = await response.json();
        return parseMemoryFromRecord(result);
      }
    } else {
      // Create new
      fields.createdAt = new Date().toISOString();
      
      const response = await fetch(USER_MEMORY_API_URL, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ fields }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to create memory: ${response.status}`);
      }

      const result = await response.json();
      return parseMemoryFromRecord(result);
    }

    return memory;
  } catch (error) {
    console.error('[USER MEMORY] Failed to upsert memory:', error);
    throw error;
  }
}

/**
 * Get user memory by key
 */
export async function getUserMemoryByKey(recordId: string, key: string): Promise<UserMemory | null> {
  try {
    if (!USER_MEMORY_API_URL) {
      return null;
    }

    const filterFormula = `{recordId} = "${recordId}" AND {key} = "${key}"`;
    const url = `${USER_MEMORY_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    const records = result.records || [];
    
    if (records.length > 0) {
      return parseMemoryFromRecord(records[0]);
    }

    return null;
  } catch (error) {
    console.error('[USER MEMORY] Failed to get memory by key:', error);
    return null;
  }
}

/**
 * Get all user memories
 */
export async function getUserMemories(
  recordId: string,
  memoryType?: UserMemory['memoryType'],
  importance?: UserMemory['importance']
): Promise<UserMemory[]> {
  try {
    if (!USER_MEMORY_API_URL) {
      return [];
    }

    let filterFormula = `{recordId} = "${recordId}"`;
    
    if (memoryType) {
      filterFormula += ` AND {memoryType} = "${memoryType}"`;
    }
    
    if (importance) {
      filterFormula += ` AND {importance} = "${importance}"`;
    }

    // Filter out expired memories
    const now = new Date().toISOString();
    filterFormula += ` OR ISBLANK({expiresAt}) OR {expiresAt} > "${now}"`;

    const url = `${USER_MEMORY_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=importance&sort[0][direction]=desc&sort[1][field]=createdAt&sort[1][direction]=desc`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[USER MEMORY] Failed to get memories:', errorData);
      return [];
    }

    const result = await response.json();
    const memories = (result.records || []).map(parseMemoryFromRecord);
    
    // Filter out expired memories client-side as well
    return memories.filter(m => {
      if (!m.expiresAt) return true;
      return new Date(m.expiresAt) > new Date();
    });
  } catch (error) {
    console.error('[USER MEMORY] Failed to get memories:', error);
    return [];
  }
}

/**
 * Delete a user memory
 */
export async function deleteUserMemory(memoryId: string): Promise<void> {
  try {
    if (!USER_MEMORY_API_URL) {
      return;
    }

    const url = `${USER_MEMORY_API_URL}/${memoryId}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Failed to delete memory: ${response.status}`);
    }
  } catch (error) {
    console.error('[USER MEMORY] Failed to delete memory:', error);
    throw error;
  }
}

/**
 * Helper: Parse pattern from Airtable record
 */
function parsePatternFromRecord(record: any): UserPattern {
  return {
    id: record.id,
    recordId: Array.isArray(record.fields?.recordId) 
      ? record.fields.recordId[0] 
      : record.fields?.recordId || '',
    patternType: record.fields?.patternType || 'behavior',
    patternData: typeof record.fields?.patternData === 'string'
      ? JSON.parse(record.fields.patternData)
      : record.fields?.patternData || {},
    confidence: record.fields?.confidence || 0.5,
    lastObserved: record.fields?.lastObserved || record.fields?.createdAt,
    createdAt: record.fields?.createdAt,
    updatedAt: record.fields?.updatedAt,
  };
}

/**
 * Helper: Parse memory from Airtable record
 */
function parseMemoryFromRecord(record: any): UserMemory {
  return {
    id: record.id,
    recordId: Array.isArray(record.fields?.recordId)
      ? record.fields.recordId[0]
      : record.fields?.recordId || '',
    memoryType: record.fields?.memoryType || 'fact',
    key: record.fields?.key || '',
    value: record.fields?.value || '',
    context: record.fields?.context,
    importance: record.fields?.importance || 'medium',
    expiresAt: record.fields?.expiresAt,
    createdAt: record.fields?.createdAt,
    updatedAt: record.fields?.updatedAt,
  };
}

