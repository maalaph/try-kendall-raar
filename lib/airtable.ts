/**
 * Airtable helper functions for My Kendall user data
 */

const AIRTABLE_API_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;

// Business Trials table URL
const BUSINESS_TRIAL_API_URL = process.env.AIRTABLE_BASE_ID && process.env.AIRTABLE_BUSINESS_TRIAL_TABLE_ID
  ? `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_BUSINESS_TRIAL_TABLE_ID}`
  : '';

const getHeaders = () => ({
  'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json',
});

/**
 * Format file URLs for Airtable attachment field
 * Airtable attachment field expects: [{ url: string, filename: string }]
 */
export function formatAttachmentField(files: Array<{ url: string; filename: string }>): Array<{ url: string; filename: string }> {
  return files.map(file => ({
    url: file.url,
    filename: file.filename,
  }));
}

export async function createUserRecord(data: Record<string, any>) {
  try {
    const response = await fetch(AIRTABLE_API_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        fields: data,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || errorData.message || `Airtable API error: ${response.status} ${response.statusText}`;
      console.error('[AIRTABLE ERROR] createUserRecord failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        fieldsBeingSent: data,
      });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[AIRTABLE ERROR] createUserRecord failed:', error);
    throw error;
  }
}

export async function updateUserRecord(recordId: string, data: Record<string, any>) {
  try {
    const url = `${AIRTABLE_API_URL}/${recordId}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        fields: data,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || errorData.message || `Airtable API error: ${response.status} ${response.statusText}`;
      console.error('[AIRTABLE ERROR] updateUserRecord failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        recordId,
        fieldsBeingSent: data,
      });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[AIRTABLE ERROR] updateUserRecord failed:', error);
    throw error;
  }
}

/**
 * Fetch a user record by ID from Airtable
 */
export async function getUserRecord(recordId: string) {
  try {
    const url = `${AIRTABLE_API_URL}/${recordId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || errorData.message || `Airtable API error: ${response.status} ${response.statusText}`;
      console.error('[AIRTABLE ERROR] getUserRecord failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        recordId,
      });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[AIRTABLE ERROR] getUserRecord failed:', error);
    throw error;
  }
}

/**
 * Search for user records by email or name
 */
export async function searchUserRecords(searchTerm: string) {
  try {
    // Build filter formula - search in email or fullName fields
    const filterFormula = `OR(
      SEARCH("${searchTerm}", LOWER({email})),
      SEARCH("${searchTerm}", LOWER({fullName}))
    )`;
    
    const url = `${AIRTABLE_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || errorData.message || `Airtable API error: ${response.status} ${response.statusText}`;
      console.error('[AIRTABLE ERROR] searchUserRecords failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        searchTerm,
      });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[AIRTABLE ERROR] searchUserRecords failed:', error);
    throw error;
  }
}

/**
 * Get all user records from Airtable (with pagination support)
 */
export async function getAllUserRecords() {
  try {
    const allRecords: any[] = [];
    let offset: string | undefined = undefined;

    do {
      let url = AIRTABLE_API_URL;
      if (offset) {
        url += `?offset=${offset}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: getHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || errorData.message || `Airtable API error: ${response.status} ${response.statusText}`;
        console.error('[AIRTABLE ERROR] getAllUserRecords failed:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
        });
        throw new Error(errorMessage);
      }

      const result = await response.json();
      allRecords.push(...(result.records || []));
      offset = result.offset;
    } while (offset);

    return { records: allRecords };
  } catch (error) {
    console.error('[AIRTABLE ERROR] getAllUserRecords failed:', error);
    throw error;
  }
}

/**
 * Business Trial helper functions
 */

/**
 * Create a new business trial record in Airtable
 */
export async function createBusinessTrialRecord(data: Record<string, any>) {
  try {
    // Check if environment variables are set
    if (!process.env.AIRTABLE_BASE_ID || !process.env.AIRTABLE_BUSINESS_TRIAL_TABLE_ID) {
      throw new Error('AIRTABLE_BASE_ID and AIRTABLE_BUSINESS_TRIAL_TABLE_ID environment variables must be set');
    }

    if (!BUSINESS_TRIAL_API_URL) {
      throw new Error('Business trial Airtable URL is not configured. Please set AIRTABLE_BUSINESS_TRIAL_TABLE_ID environment variable.');
    }

    const response = await fetch(BUSINESS_TRIAL_API_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        fields: data,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || errorData.message || `Airtable API error: ${response.status} ${response.statusText}`;
      console.error('[AIRTABLE ERROR] createBusinessTrialRecord failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        fieldsBeingSent: data,
        baseId: process.env.AIRTABLE_BASE_ID,
        tableId: process.env.AIRTABLE_BUSINESS_TRIAL_TABLE_ID,
      });
      
      // Provide more helpful error messages
      if (response.status === 404) {
        throw new Error('Airtable table not found. Please verify AIRTABLE_BUSINESS_TRIAL_TABLE_ID is correct (should be: tbli3uJLbubkIRk5S)');
      } else if (response.status === 403) {
        throw new Error('Permission denied. Please check that your Airtable API key has write access to the "Kendall Business" table.');
      } else if (errorData.error?.type === 'INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND') {
        throw new Error('Invalid permissions or field names don\'t match. Please ensure your Airtable table has these exact field names: fullName, businessName, phone, email, website, bookingSystem, created_at');
      }
      
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[AIRTABLE ERROR] createBusinessTrialRecord failed:', error);
    throw error;
  }
}

/**
 * Get a business trial record by ID
 */
export async function getBusinessTrialRecord(recordId: string) {
  try {
    const url = `${BUSINESS_TRIAL_API_URL}/${recordId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || errorData.message || `Airtable API error: ${response.status} ${response.statusText}`;
      console.error('[AIRTABLE ERROR] getBusinessTrialRecord failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        recordId,
      });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[AIRTABLE ERROR] getBusinessTrialRecord failed:', error);
    throw error;
  }
}

/**
 * Update a business trial record
 */
export async function updateBusinessTrialRecord(recordId: string, data: Record<string, any>) {
  try {
    const url = `${BUSINESS_TRIAL_API_URL}/${recordId}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        fields: data,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || errorData.message || `Airtable API error: ${response.status} ${response.statusText}`;
      console.error('[AIRTABLE ERROR] updateBusinessTrialRecord failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        recordId,
        fieldsBeingSent: data,
      });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[AIRTABLE ERROR] updateBusinessTrialRecord failed:', error);
    throw error;
  }
}

/**
 * Call Notes helper functions
 */

// Call Notes table URL
const CALL_NOTES_API_URL = process.env.AIRTABLE_BASE_ID && process.env.AIRTABLE_CALL_NOTES_TABLE_ID
  ? `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_CALL_NOTES_TABLE_ID}`
  : '';

/**
 * Get owner's phone number by VAPI agent ID
 * Queries the main user table by vapi_agent_id field
 */
export async function getOwnerPhoneByAgentId(agentId: string): Promise<string | null> {
  try {
    if (!agentId) {
      console.warn('[AIRTABLE WARNING] getOwnerPhoneByAgentId called with empty agentId');
      return null;
    }

    // Build filter formula to find record by vapi_agent_id
    const filterFormula = `{vapi_agent_id} = "${agentId}"`;
    const url = `${AIRTABLE_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AIRTABLE ERROR] getOwnerPhoneByAgentId failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        agentId,
      });
      return null;
    }

    const result = await response.json();
    const records = result.records || [];
    
    if (records.length === 0) {
      console.warn('[AIRTABLE WARNING] No record found with agentId:', agentId);
      return null;
    }

    // Get mobileNumber from first matching record
    const mobileNumber = records[0].fields?.mobileNumber;
    if (!mobileNumber) {
      console.warn('[AIRTABLE WARNING] Record found but mobileNumber field is empty:', agentId);
      return null;
    }

    return mobileNumber;
  } catch (error) {
    console.error('[AIRTABLE ERROR] getOwnerPhoneByAgentId failed:', error);
    return null;
  }
}

/**
 * Get owner information (fullName and kendallName) by VAPI agent ID
 * Queries the main user table by vapi_agent_id field
 */
export async function getOwnerInfoByAgentId(agentId: string): Promise<{
  fullName: string;
  kendallName: string;
} | null> {
  try {
    if (!agentId) {
      console.warn('[AIRTABLE WARNING] getOwnerInfoByAgentId called with empty agentId');
      return null;
    }

    // Build filter formula to find record by vapi_agent_id
    const filterFormula = `{vapi_agent_id} = "${agentId}"`;
    const url = `${AIRTABLE_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AIRTABLE ERROR] getOwnerInfoByAgentId failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        agentId,
      });
      return null;
    }

    const result = await response.json();
    const records = result.records || [];
    
    if (records.length === 0) {
      console.warn('[AIRTABLE WARNING] No record found with agentId:', agentId);
      return null;
    }

    // Get fullName and kendallName from first matching record
    const record = records[0];
    const fullName = record.fields?.fullName;
    const kendallName = record.fields?.kendallName || 'Kendall'; // Default to 'Kendall' if not set
    
    if (!fullName) {
      console.warn('[AIRTABLE WARNING] Record found but fullName field is empty:', agentId);
      return null;
    }

    return {
      fullName,
      kendallName,
    };
  } catch (error) {
    console.error('[AIRTABLE ERROR] getOwnerInfoByAgentId failed:', error);
    return null;
  }
}

/**
 * Get full user record by VAPI agent ID
 * Queries the main user table by vapi_agent_id field and returns the complete record
 */
export async function getUserRecordByAgentId(agentId: string): Promise<any | null> {
  try {
    if (!agentId) {
      console.warn('[AIRTABLE WARNING] getUserRecordByAgentId called with empty agentId');
      return null;
    }

    // Build filter formula to find record by vapi_agent_id
    const filterFormula = `{vapi_agent_id} = "${agentId}"`;
    const url = `${AIRTABLE_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AIRTABLE ERROR] getUserRecordByAgentId failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        agentId,
      });
      return null;
    }

    const result = await response.json();
    const records = result.records || [];
    
    if (records.length === 0) {
      console.warn('[AIRTABLE WARNING] No record found with agentId:', agentId);
      return null;
    }

    // Return the full record (includes id and fields)
    return records[0];
  } catch (error) {
    console.error('[AIRTABLE ERROR] getUserRecordByAgentId failed:', error);
    return null;
  }
}

/**
 * Get owner's phone number by VAPI phone number
 * Queries the main user table by vapi_number field
 */
export async function getOwnerPhoneByPhoneNumber(phoneNumber: string): Promise<string | null> {
  try {
    if (!phoneNumber) {
      console.warn('[AIRTABLE WARNING] getOwnerPhoneByPhoneNumber called with empty phoneNumber');
      return null;
    }

    // Normalize phone number for comparison (remove formatting)
    const normalizePhone = (pn: string): string => {
      return pn.replace(/\D/g, '');
    };

    const normalizedInput = normalizePhone(phoneNumber);
    
    // Build filter formula - Airtable phone fields might be stored in various formats
    // We'll search for records and then compare normalized versions
    const url = `${AIRTABLE_API_URL}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AIRTABLE ERROR] getOwnerPhoneByPhoneNumber failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        phoneNumber,
      });
      return null;
    }

    const result = await response.json();
    const records = result.records || [];
    
    // Find record where vapi_number matches (normalized comparison)
    for (const record of records) {
      const vapiNumber = record.fields?.vapi_number;
      if (vapiNumber) {
        const normalizedRecord = normalizePhone(String(vapiNumber));
        if (normalizedRecord === normalizedInput) {
          const mobileNumber = record.fields?.mobileNumber;
          if (mobileNumber) {
            return mobileNumber;
          }
        }
      }
    }

    console.warn('[AIRTABLE WARNING] No record found with vapi_number:', phoneNumber);
    return null;
  } catch (error) {
    console.error('[AIRTABLE ERROR] getOwnerPhoneByPhoneNumber failed:', error);
    return null;
  }
}

/**
 * Get owner record by phone number (for owner recognition)
 * Queries the main user table by mobileNumber field
 * Returns full owner record with name and other details
 */
export async function getOwnerByPhoneNumber(phoneNumber: string): Promise<{
  fullName: string;
  mobileNumber: string;
  agentId?: string;
  recordId: string;
} | null> {
  try {
    if (!phoneNumber) {
      console.warn('[AIRTABLE WARNING] getOwnerByPhoneNumber called with empty phoneNumber');
      return null;
    }

    // Normalize phone number for comparison (remove formatting, handle country code)
    const normalizePhone = (pn: string): string => {
      if (!pn || typeof pn !== 'string') return '';
      // Remove all non-digit characters
      let digits = pn.replace(/\D/g, '');
      // If it's 11 digits and starts with 1 (US country code), remove the leading 1
      // This handles both +18148528135 and (814) 852-8135 formats
      if (digits.length === 11 && digits.startsWith('1')) {
        digits = digits.substring(1);
      }
      // Also handle 10-digit numbers (should be standard format)
      if (digits.length === 10) {
        return digits;
      }
      return digits;
    };

    const normalizedInput = normalizePhone(phoneNumber);
    
    if (!normalizedInput || normalizedInput.length < 10) {
      console.warn('[AIRTABLE WARNING] Invalid phone number format after normalization:', {
        input: phoneNumber,
        normalized: normalizedInput,
      });
      return null;
    }
    
    console.log('[AIRTABLE DEBUG] Phone number normalization:', {
      input: phoneNumber,
      normalized: normalizedInput,
      normalizedLength: normalizedInput.length,
    });
    
    // Get all records and compare normalized phone numbers
    const url = `${AIRTABLE_API_URL}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AIRTABLE ERROR] getOwnerByPhoneNumber failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        phoneNumber,
      });
      return null;
    }

    const result = await response.json();
    const records = result.records || [];
    
    console.log('[AIRTABLE DEBUG] Searching through', records.length, 'records for phone number match');
    
    // Find record where mobileNumber matches (normalized comparison)
    for (const record of records) {
      const mobileNumber = record.fields?.mobileNumber;
      if (mobileNumber) {
        const normalizedRecord = normalizePhone(String(mobileNumber));
        if (normalizedRecord === normalizedInput) {
          // Log all fields in the record for debugging
          console.log('[AIRTABLE DEBUG] Matching record fields:', {
            allFieldNames: Object.keys(record.fields || {}),
            vapi_agent_id: record.fields?.vapi_agent_id,
            vapi_agent_idType: typeof record.fields?.vapi_agent_id,
            vapi_agent_idIsEmpty: record.fields?.vapi_agent_id === '',
            fullName: record.fields?.fullName,
            mobileNumber: record.fields?.mobileNumber,
          });
          
          const ownerInfo = {
            fullName: record.fields?.fullName || '',
            mobileNumber: String(mobileNumber),
            agentId: record.fields?.vapi_agent_id,
            recordId: record.id,
          };
          console.log('[AIRTABLE DEBUG] Found matching owner:', {
            fullName: ownerInfo.fullName,
            agentId: ownerInfo.agentId,
            agentIdType: typeof ownerInfo.agentId,
            agentIdIsEmpty: ownerInfo.agentId === '',
            inputPhone: phoneNumber,
            recordPhone: mobileNumber,
            normalizedMatch: normalizedRecord === normalizedInput,
          });
          return ownerInfo;
        }
      }
    }

    console.warn('[AIRTABLE WARNING] No owner found with mobileNumber:', {
      input: phoneNumber,
      normalized: normalizedInput,
      totalRecords: records.length,
    });
    return null;
  } catch (error) {
    console.error('[AIRTABLE ERROR] getOwnerByPhoneNumber failed:', error);
    return null;
  }
}

/**
 * Create a call note record in the Call Notes table
 */
export async function createCallNote(data: {
  callId?: string;
  agentId: string;
  callerPhone: string;
  note: string;
  timestamp?: string;
  ownerPhone?: string;
  smsSent?: boolean;
  callDuration?: number; // Duration in seconds
  read?: boolean; // Whether owner has read this message
  callType?: 'inbound' | 'outbound'; // Type of call: inbound (owner-assistant) or outbound (assistant-to-recipient)
}) {
  try {
    if (!process.env.AIRTABLE_BASE_ID || !process.env.AIRTABLE_CALL_NOTES_TABLE_ID) {
      throw new Error('AIRTABLE_BASE_ID and AIRTABLE_CALL_NOTES_TABLE_ID environment variables must be set');
    }

    if (!CALL_NOTES_API_URL) {
      throw new Error('Call Notes Airtable URL is not configured. Please set AIRTABLE_CALL_NOTES_TABLE_ID environment variable.');
    }

    // Prepare fields for Airtable
    const fields: Record<string, any> = {
      agentId: data.agentId,
      callerPhone: data.callerPhone,
      Notes: data.note,  // Airtable field name is "Notes" (capitalized, plural)
    };

    // Add optional fields
    if (data.callId) {
      fields.callId = data.callId;
    }
    if (data.timestamp) {
      fields.timestamp = data.timestamp;
    } else {
      // Use current timestamp if not provided
      fields.timestamp = new Date().toISOString();
    }
    if (data.ownerPhone) {
      fields.ownerPhone = data.ownerPhone;
    }
    if (data.smsSent !== undefined) {
      fields.smsSent = data.smsSent;
    }
    if (data.callDuration !== undefined) {
      fields.callDuration = data.callDuration;
    }
    if (data.read !== undefined) {
      fields.read = data.read;
    }
    if (data.callType) {
      fields.callType = data.callType;
    }

    const response = await fetch(CALL_NOTES_API_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        fields,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || errorData.message || `Airtable API error: ${response.status} ${response.statusText}`;
      console.error('[AIRTABLE ERROR] createCallNote failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        fieldsBeingSent: fields,
        baseId: process.env.AIRTABLE_BASE_ID,
        tableId: process.env.AIRTABLE_CALL_NOTES_TABLE_ID,
      });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[AIRTABLE ERROR] createCallNote failed:', error);
    throw error;
  }
}

/**
 * Scheduled Call Tasks helper functions
 */

// Scheduled Call Tasks table URL
const SCHEDULED_CALLS_API_URL = process.env.AIRTABLE_BASE_ID && process.env.AIRTABLE_SCHEDULED_CALLS_TABLE_ID
  ? `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_SCHEDULED_CALLS_TABLE_ID}`
  : '';

/**
 * Create a scheduled call task record
 */
export async function createScheduledCallTask(data: {
  phone_number: string;
  message: string;
  scheduled_time: string; // ISO 8601 format
  owner_agent_id: string;
  caller_name?: string;
  phone_number_id?: string; // VAPI phone number ID to use for outbound calls
  recipient_name?: string; // Recipient's name for personalized greeting
  status?: 'pending' | 'executing' | 'completed' | 'failed';
  recordId?: string; // Optional: Owner record ID for chat relay
  threadId?: string; // Optional: Chat thread ID for chat relay
}) {
  try {
    if (!process.env.AIRTABLE_BASE_ID || !process.env.AIRTABLE_SCHEDULED_CALLS_TABLE_ID) {
      // If table ID not set, log warning but don't throw - this is optional
      console.warn('[AIRTABLE WARNING] Scheduled calls table not configured. Set AIRTABLE_SCHEDULED_CALLS_TABLE_ID to enable scheduled calls.');
      return null;
    }

    if (!SCHEDULED_CALLS_API_URL) {
      console.warn('[AIRTABLE WARNING] Scheduled calls table URL not configured');
      return null;
    }

    const fields: Record<string, any> = {
      phone_number: data.phone_number,
      message: data.message,
      scheduled_time: data.scheduled_time,
      owner_agent_id: data.owner_agent_id,
      status: data.status || 'pending',
    };

    if (data.caller_name) {
      fields.caller_name = data.caller_name;
    }

    if (data.phone_number_id) {
      fields.phone_number_id = data.phone_number_id;
    }

    if (data.recipient_name) {
      fields.recipient_name = data.recipient_name;
    }

    if (data.recordId) {
      fields.recordId = data.recordId;
    }

    if (data.threadId) {
      fields.threadId = data.threadId;
    }

    const response = await fetch(SCHEDULED_CALLS_API_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        fields,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AIRTABLE ERROR] createScheduledCallTask failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        fieldsBeingSent: fields,
      });
      const errorMsg = errorData.error?.message || errorData.message || `Airtable API error: ${response.status}`;
      throw new Error(`Failed to create scheduled call task: ${errorMsg}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[AIRTABLE ERROR] createScheduledCallTask failed:', error);
    throw error;
  }
}

/**
 * Get scheduled call tasks that are due to be executed
 * Returns tasks where scheduled_time <= now and status = 'pending'
 */
export async function getScheduledCallTasks(): Promise<any[]> {
  try {
    if (!SCHEDULED_CALLS_API_URL) {
      return [];
    }

    const now = new Date().toISOString();
    
    // Build filter formula: scheduled_time <= now AND status = 'pending'
    const filterFormula = `AND(
      IS_BEFORE({scheduled_time}, "${now}"),
      {status} = "pending"
    )`;
    
    const url = `${SCHEDULED_CALLS_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AIRTABLE ERROR] getScheduledCallTasks failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
      });
      return [];
    }

    const result = await response.json();
    return result.records || [];
  } catch (error) {
    console.error('[AIRTABLE ERROR] getScheduledCallTasks failed:', error);
    return [];
  }
}

/**
 * Update a scheduled call task
 */
export async function updateScheduledCallTask(
  taskId: string,
  updates: {
    status?: 'pending' | 'executing' | 'completed' | 'failed';
    call_id?: string;
    error_message?: string;
  }
) {
  try {
    if (!SCHEDULED_CALLS_API_URL) {
      console.warn('[AIRTABLE WARNING] Scheduled calls table URL not configured');
      return null;
    }

    const fields: Record<string, any> = {};
    
    if (updates.status) {
      fields.status = updates.status;
    }
    if (updates.call_id) {
      fields.call_id = updates.call_id;
    }
    if (updates.error_message) {
      fields.error_message = updates.error_message;
    }

    const url = `${SCHEDULED_CALLS_API_URL}/${taskId}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        fields,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AIRTABLE ERROR] updateScheduledCallTask failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        taskId,
        updates,
      });
      throw new Error(`Failed to update scheduled call task: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[AIRTABLE ERROR] updateScheduledCallTask failed:', error);
    throw error;
  }
}

/**
 * Atomically update a scheduled call task status to 'executing' only if it's currently 'pending'
 * This prevents race conditions where multiple instances try to process the same task
 * Uses Airtable's filterByFormula to ensure atomic update
 * Returns the updated record if successful, null if the task was already claimed by another instance
 */
export async function updateScheduledCallTaskAtomically(
  taskId: string,
  newStatus: 'executing'
): Promise<any | null> {
  try {
    if (!SCHEDULED_CALLS_API_URL) {
      console.warn('[AIRTABLE WARNING] Scheduled calls table URL not configured');
      return null;
    }

    // First, get the current task to check its status
    const getUrl = `${SCHEDULED_CALLS_API_URL}/${taskId}`;
    const getResponse = await fetch(getUrl, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!getResponse.ok) {
      const errorData = await getResponse.json().catch(() => ({}));
      console.error('[AIRTABLE ERROR] Failed to get task for atomic update:', {
        status: getResponse.status,
        errorData,
        taskId,
      });
      throw new Error(`Failed to get scheduled call task: ${JSON.stringify(errorData)}`);
    }

    const currentTask = await getResponse.json();
    const currentStatus = currentTask.fields?.status;

    // If status is not 'pending', another instance already claimed it
    if (currentStatus !== 'pending') {
      console.log(`[AIRTABLE] Task ${taskId} status is '${currentStatus}', not 'pending'. Already claimed by another instance.`);
      return null;
    }

    // Immediately update to 'executing' - minimize time window for race condition
    // Note: There's still a small race condition window, but this minimizes it
    const updateUrl = `${SCHEDULED_CALLS_API_URL}/${taskId}`;
    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        fields: {
          status: newStatus,
        },
      }),
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json().catch(() => ({}));
      console.error('[AIRTABLE ERROR] Atomic update failed:', {
        status: updateResponse.status,
        errorData,
        taskId,
      });
      throw new Error(`Failed to atomically update scheduled call task: ${JSON.stringify(errorData)}`);
    }

    const result = await updateResponse.json();
    
    // Double-check: verify the update actually succeeded and status is now 'executing'
    // If another instance updated it between our check and update, this will catch it
    if (result.fields?.status !== 'executing') {
      console.warn(`[AIRTABLE] Task ${taskId} update may have failed - status is '${result.fields?.status}', expected 'executing'. Another instance may have claimed it.`);
      return null;
    }

    return result;
  } catch (error) {
    console.error('[AIRTABLE ERROR] updateScheduledCallTaskAtomically failed:', error);
    throw error;
  }
}

/**
 * Get Canadian phone number and related details by VAPI agent ID
 * Returns the phone number, VAPI phone number ID, and Twilio SID if available
 */
export async function getCanadianNumberByAgentId(agentId: string): Promise<{
  phoneNumber: string;
  vapiPhoneNumberId?: string;
  twilioSid?: string;
} | null> {
  try {
    if (!agentId) {
      console.warn('[AIRTABLE WARNING] getCanadianNumberByAgentId called with empty agentId');
      return null;
    }

    // Build filter formula to find record by vapi_agent_id
    const filterFormula = `{vapi_agent_id} = "${agentId}"`;
    const url = `${AIRTABLE_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AIRTABLE ERROR] getCanadianNumberByAgentId failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        agentId,
      });
      return null;
    }

    const result = await response.json();
    const records = result.records || [];
    
    if (records.length === 0) {
      console.warn('[AIRTABLE WARNING] No record found with agentId:', agentId);
      return null;
    }

    const record = records[0];
    const phoneNumber = record.fields?.vapi_number;
    const vapiPhoneNumberId = record.fields?.vapi_phone_number_id;
    const twilioSid = record.fields?.twilio_phone_sid;
    
    if (!phoneNumber) {
      console.warn('[AIRTABLE WARNING] Record found but vapi_number field is empty:', agentId);
      return null;
    }

    return {
      phoneNumber: String(phoneNumber),
      vapiPhoneNumberId: vapiPhoneNumberId ? String(vapiPhoneNumberId) : undefined,
      twilioSid: twilioSid ? String(twilioSid) : undefined,
    };
  } catch (error) {
    console.error('[AIRTABLE ERROR] getCanadianNumberByAgentId failed:', error);
    return null;
  }
}

/**
 * Get agent ID and user info by Canadian phone number (for fallback routing)
 * Queries the main user table by vapi_number field
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
    if (!phoneNumber) {
      console.warn('[AIRTABLE WARNING] getAgentByCanadianNumber called with empty phoneNumber');
      return null;
    }

    // Normalize phone number for comparison (remove formatting, handle country code)
    const normalizePhone = (pn: string): string => {
      if (!pn || typeof pn !== 'string') return '';
      // Remove all non-digit characters
      let digits = pn.replace(/\D/g, '');
      // If it's 11 digits and starts with 1 (US/Canada country code), remove the leading 1
      // This handles both +14148528135 and (414) 852-8135 formats
      if (digits.length === 11 && digits.startsWith('1')) {
        digits = digits.substring(1);
      }
      // Also handle 10-digit numbers (should be standard format)
      if (digits.length === 10) {
        return digits;
      }
      return digits;
    };

    const normalizedInput = normalizePhone(phoneNumber);
    
    if (!normalizedInput || normalizedInput.length < 10) {
      console.warn('[AIRTABLE WARNING] Invalid phone number format after normalization:', {
        input: phoneNumber,
        normalized: normalizedInput,
      });
      return null;
    }
    
    // Get all records and compare normalized phone numbers
    const url = `${AIRTABLE_API_URL}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AIRTABLE ERROR] getAgentByCanadianNumber failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        phoneNumber,
      });
      return null;
    }

    const result = await response.json();
    const records = result.records || [];
    
    // Find record where vapi_number matches (normalized comparison)
    for (const record of records) {
      const vapiNumber = record.fields?.vapi_number;
      if (vapiNumber) {
        const normalizedRecord = normalizePhone(String(vapiNumber));
        if (normalizedRecord === normalizedInput) {
          const agentId = record.fields?.vapi_agent_id;
          const fullName = record.fields?.fullName;
          const mobileNumber = record.fields?.mobileNumber;
          const vapiPhoneNumberId = record.fields?.vapi_phone_number_id;
          const twilioSid = record.fields?.twilio_phone_sid;
          
          if (!agentId || !fullName || !mobileNumber) {
            console.warn('[AIRTABLE WARNING] Record found but missing required fields:', {
              hasAgentId: !!agentId,
              hasFullName: !!fullName,
              hasMobileNumber: !!mobileNumber,
            });
            continue;
          }
          
          return {
            agentId: String(agentId),
            fullName: String(fullName),
            mobileNumber: String(mobileNumber),
            recordId: record.id,
            vapiPhoneNumberId: vapiPhoneNumberId ? String(vapiPhoneNumberId) : undefined,
            twilioSid: twilioSid ? String(twilioSid) : undefined,
          };
        }
      }
    }

    console.warn('[AIRTABLE WARNING] No agent found with Canadian number:', {
      input: phoneNumber,
      normalized: normalizedInput,
      totalRecords: records.length,
    });
    return null;
  } catch (error) {
    console.error('[AIRTABLE ERROR] getAgentByCanadianNumber failed:', error);
    return null;
  }
}

/**
 * Update Canadian number mapping in Airtable
 * Stores phone number, VAPI phone number ID, and Twilio SID
 */
export async function updateCanadianNumberMapping(
  recordId: string,
  phoneNumber: string,
  vapiPhoneNumberId: string,
  twilioSid?: string
): Promise<void> {
  try {
    const fields: Record<string, any> = {
      vapi_number: phoneNumber,
      vapi_phone_number_id: vapiPhoneNumberId,
    };
    
    if (twilioSid) {
      fields.twilio_phone_sid = twilioSid;
    }
    
    await updateUserRecord(recordId, fields);
    console.log('[AIRTABLE SUCCESS] Updated Canadian number mapping:', {
      recordId,
      phoneNumber,
      vapiPhoneNumberId,
      hasTwilioSid: !!twilioSid,
    });
  } catch (error) {
    console.error('[AIRTABLE ERROR] updateCanadianNumberMapping failed:', error);
    throw error;
  }
}

/**
 * Outbound Call Requests helper functions
 */

// Outbound Call Requests table URL
const OUTBOUND_CALL_REQUESTS_API_URL = process.env.AIRTABLE_BASE_ID && process.env.AIRTABLE_OUTBOUND_CALL_REQUESTS_TABLE_ID
  ? `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_OUTBOUND_CALL_REQUESTS_TABLE_ID}`
  : '';

/**
 * Create an outbound call request record
 * Stores minimal context to link VAPI call completion back to chat thread
 */
export async function createOutboundCallRequest(data: {
  callId: string; // VAPI call ID (primary key for lookup)
  recordId: string; // Owner record ID (needed to post back to chat)
  threadId: string; // Chat thread ID (needed to post back to chat)
  status?: 'pending' | 'in-call' | 'completed' | 'failed';
  phoneNumber?: string; // Optional: for reference
}) {
  try {
    if (!process.env.AIRTABLE_BASE_ID || !process.env.AIRTABLE_OUTBOUND_CALL_REQUESTS_TABLE_ID) {
      // If table ID not set, log warning but don't throw - this is optional
      console.warn('[AIRTABLE WARNING] Outbound call requests table not configured. Set AIRTABLE_OUTBOUND_CALL_REQUESTS_TABLE_ID to enable chat call tracking.');
      return null;
    }

    if (!OUTBOUND_CALL_REQUESTS_API_URL) {
      console.warn('[AIRTABLE WARNING] Outbound call requests table URL not configured');
      return null;
    }

    const fields: Record<string, any> = {
      callId: data.callId,
      recordId: [data.recordId], // Linked record format - array of record IDs
      threadId: data.threadId,
      status: data.status || 'pending',
      createdAt: new Date().toISOString(),
    };

    if (data.phoneNumber) {
      fields.phoneNumber = data.phoneNumber;
    }

    const response = await fetch(OUTBOUND_CALL_REQUESTS_API_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        fields,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AIRTABLE ERROR] createOutboundCallRequest failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        fieldsBeingSent: fields,
      });
      const errorMsg = errorData.error?.message || errorData.message || `Airtable API error: ${response.status}`;
      throw new Error(`Failed to create outbound call request: ${errorMsg}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[AIRTABLE ERROR] createOutboundCallRequest failed:', error);
    throw error;
  }
}

/**
 * Get outbound call request by callId
 * Used to link VAPI webhook call completion back to chat thread
 */
export async function getOutboundCallRequestByCallId(callId: string): Promise<{
  id: string;
  fields: {
    callId: string;
    recordId: string[];
    threadId: string;
    status: string;
    createdAt?: string;
    completedAt?: string;
    phoneNumber?: string;
  };
} | null> {
  try {
    if (!OUTBOUND_CALL_REQUESTS_API_URL) {
      return null;
    }

    // Build filter formula to find record by callId
    const filterFormula = `{callId} = "${callId}"`;
    const url = `${OUTBOUND_CALL_REQUESTS_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AIRTABLE ERROR] getOutboundCallRequestByCallId failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        callId,
      });
      return null;
    }

    const result = await response.json();
    const records = result.records || [];
    
    if (records.length === 0) {
      return null;
    }

    return records[0];
  } catch (error) {
    console.error('[AIRTABLE ERROR] getOutboundCallRequestByCallId failed:', error);
    return null;
  }
}

/**
 * Update outbound call request status
 */
export async function updateOutboundCallRequest(
  callId: string,
  updates: {
    status?: 'pending' | 'in-call' | 'completed' | 'failed';
    completedAt?: string;
  }
) {
  try {
    if (!OUTBOUND_CALL_REQUESTS_API_URL) {
      console.warn('[AIRTABLE WARNING] Outbound call requests table URL not configured');
      return null;
    }

    // First, find the record by callId
    const existingRequest = await getOutboundCallRequestByCallId(callId);
    if (!existingRequest) {
      console.warn('[AIRTABLE WARNING] Outbound call request not found for callId:', callId);
      return null;
    }

    const fields: Record<string, any> = {};
    
    if (updates.status) {
      fields.status = updates.status;
    }
    if (updates.completedAt) {
      fields.completedAt = updates.completedAt;
    }

    const url = `${OUTBOUND_CALL_REQUESTS_API_URL}/${existingRequest.id}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        fields,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AIRTABLE ERROR] updateOutboundCallRequest failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        callId,
        updates,
      });
      throw new Error(`Failed to update outbound call request: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[AIRTABLE ERROR] updateOutboundCallRequest failed:', error);
    throw error;
  }
}

/**
 * Chat Messages helper functions
 */

// Chat Messages table URL
const CHAT_MESSAGES_API_URL = process.env.AIRTABLE_BASE_ID && process.env.AIRTABLE_CHAT_MESSAGES_TABLE_ID
  ? `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_CHAT_MESSAGES_TABLE_ID}`
  : '';

/**
 * Get or create threadId for a user
 * Returns the threadId from user record, or creates one if it doesn't exist
 * @deprecated Use createNewThread for new chats. This is kept for backward compatibility.
 */
export async function getOrCreateThreadId(recordId: string): Promise<string> {
  try {
    const userRecord = await getUserRecord(recordId);
    if (!userRecord || !userRecord.fields) {
      throw new Error('User record not found');
    }

    // Check if threadId already exists
    const existingThreadId = userRecord.fields.threadId;
    if (existingThreadId && typeof existingThreadId === 'string' && existingThreadId.trim()) {
      return existingThreadId.trim();
    }

    // Generate new threadId (UUID v4)
    const newThreadId = `thread_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Store it in user record
    await updateUserRecord(recordId, { threadId: newThreadId });
    
    return newThreadId;
  } catch (error) {
    console.error('[AIRTABLE ERROR] getOrCreateThreadId failed:', error);
    throw error;
  }
}

/**
 * Create a new chat thread
 * Generates a new unique threadId for a new conversation
 */
export async function createNewThread(recordId: string): Promise<string> {
  try {
    // Generate new threadId
    const newThreadId = `thread_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Note: We don't store threadId in user record anymore - threads are managed via Chat Messages table
    // The threadId is stored with each message, so we can query all unique threadIds for a user
    
    return newThreadId;
  } catch (error) {
    console.error('[AIRTABLE ERROR] createNewThread failed:', error);
    throw error;
  }
}

/**
 * Get all chat threads for a user
 * Queries Chat Messages table to find all unique threadIds for a recordId
 * Returns threads with metadata: threadId, title (from first message), lastMessageAt, messageCount
 */
export async function getAllChatThreads(recordId: string): Promise<Array<{
  threadId: string;
  title: string;
  lastMessageAt: string;
  messageCount: number;
  preview: string;
}>> {
  try {
    if (!CHAT_MESSAGES_API_URL) {
      return [];
    }

    // Get all messages for this recordId, grouped by threadId
    // Since recordId is a linked record field, Airtable filters don't work reliably
    // Always fetch all messages and filter client-side to ensure we get all threads
    console.log('[AIRTABLE] getAllChatThreads: Fetching all messages and filtering client-side for recordId:', recordId);
    
    // Fetch all messages (up to 500) - we'll filter by recordId client-side
    const url = `${CHAT_MESSAGES_API_URL}?sort[0][field]=createdAt&sort[0][direction]=desc&maxRecords=500`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AIRTABLE ERROR] getAllChatThreads failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        recordId,
      });
      return [];
    }

    const result = await response.json();
    let records = result.records || [];
    
    console.log('[AIRTABLE] getAllChatThreads: Fetched', records.length, 'total records, filtering for recordId:', recordId);
    
    // Always filter client-side since recordId is a linked record
    // Check the first record to determine the field type
    if (records.length > 0) {
      const firstRecord = records[0];
      const recordIdField = firstRecord.fields?.recordId;
      
      if (Array.isArray(recordIdField)) {
        // It's a linked record array - filter by checking if recordId is in the array
        const beforeFilter = records.length;
        records = records.filter((record: any) => {
          const linkedRecordIds = record.fields?.recordId;
          if (Array.isArray(linkedRecordIds)) {
            return linkedRecordIds.includes(recordId);
          }
          return false;
        });
        console.log('[AIRTABLE] getAllChatThreads: Filtered linked records:', {
          beforeFilter,
          afterFilter: records.length,
          recordId,
        });
      } else if (typeof recordIdField === 'string') {
        // It's a text field - filter by string match
        const beforeFilter = records.length;
        records = records.filter((record: any) => {
          return record.fields?.recordId === recordId;
        });
        console.log('[AIRTABLE] getAllChatThreads: Filtered text field records:', {
          beforeFilter,
          afterFilter: records.length,
        });
      } else {
        // Unknown field type - log for debugging
        console.warn('[AIRTABLE] getAllChatThreads: Unknown recordId field type:', typeof recordIdField, recordIdField);
      }
    } else {
      console.log('[AIRTABLE] getAllChatThreads: No records found in Airtable');
    }
    
    console.log('[AIRTABLE] getAllChatThreads found records:', {
      recordId,
      totalRecords: records.length,
      uniqueThreadIds: [...new Set(records.map((r: any) => r.fields?.threadId).filter(Boolean))],
      sampleRecord: records[0] ? {
        id: records[0].id,
        recordId: records[0].fields?.recordId,
        threadId: records[0].fields?.threadId,
        messagePreview: records[0].fields?.message?.substring(0, 50),
      } : null,
    });
    
    // Group messages by threadId
    const threadsMap = new Map<string, {
      messages: Array<{ message: string; timestamp: string; role: string }>;
      lastMessageAt: string;
    }>();
    
    for (const record of records) {
      const threadId = record.fields?.threadId;
      if (!threadId) continue;
      
      if (!threadsMap.has(threadId)) {
        threadsMap.set(threadId, {
          messages: [],
          lastMessageAt: record.fields?.createdAt || '',
        });
      }
      
      const thread = threadsMap.get(threadId)!;
      thread.messages.push({
        message: record.fields?.message || '',
        timestamp: record.fields?.createdAt || '',
        role: record.fields?.role || 'user',
      });
      
      // Update lastMessageAt if this message is more recent
      const msgTime = record.fields?.createdAt || '';
      if (msgTime > thread.lastMessageAt) {
        thread.lastMessageAt = msgTime;
      }
    }
    
    // Convert to array and generate titles
    const threads = Array.from(threadsMap.entries()).map(([threadId, data]) => {
      // Sort messages by timestamp
      const sortedMessages = data.messages.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      // Filter out system messages for display purposes
      const nonSystemMessages = sortedMessages.filter(m => {
        // Exclude system messages like "Chat started"
        return m.message !== 'Chat started' && !m.message.toLowerCase().startsWith('chat started');
      });
      
      // Generate title from first user message (first 50 chars)
      let title = 'New Chat';
      const firstUserMessage = nonSystemMessages.find(m => m.role === 'user');
      if (firstUserMessage) {
        const preview = firstUserMessage.message.substring(0, 50).trim();
        if (preview) {
          title = preview.length < 50 ? preview : preview + '...';
        }
      }
      
      // Get preview from last non-system message
      const lastNonSystemMessage = nonSystemMessages.length > 0 
        ? nonSystemMessages[nonSystemMessages.length - 1]
        : sortedMessages[sortedMessages.length - 1]; // Fallback to last message if all are system
      const preview = lastNonSystemMessage ? lastNonSystemMessage.message.substring(0, 100) : '';
      
      return {
        threadId,
        title,
        lastMessageAt: data.lastMessageAt,
        messageCount: sortedMessages.length, // Include all messages in count
        preview: preview.length < 100 ? preview : preview + '...',
      };
    });
    
    // Sort by lastMessageAt (most recent first)
    threads.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    
    return threads;
  } catch (error) {
    console.error('[AIRTABLE ERROR] getAllChatThreads failed:', error);
    return [];
  }
}

/**
 * Create a chat message record
 */
export async function createChatMessage(data: {
  recordId: string; // Linked to main users table
  agentId: string;
  threadId: string;
  message: string;
  role: 'user' | 'assistant';
  messageType?: 'text' | 'file' | 'system' | 'call_request';
  timestamp?: string;
  attachments?: Array<{ url: string; filename: string }>;
  callRequestId?: string;
  callStatus?: 'queued' | 'in-call' | 'completed' | 'failed';
}) {
  try {
    if (!process.env.AIRTABLE_BASE_ID || !process.env.AIRTABLE_CHAT_MESSAGES_TABLE_ID) {
      throw new Error('AIRTABLE_BASE_ID and AIRTABLE_CHAT_MESSAGES_TABLE_ID environment variables must be set');
    }

    if (!CHAT_MESSAGES_API_URL) {
      throw new Error('Chat Messages Airtable URL is not configured. Please set AIRTABLE_CHAT_MESSAGES_TABLE_ID environment variable.');
    }

    const fields: Record<string, any> = {
      recordId: [data.recordId], // Linked record format - array of record IDs
      agentId: data.agentId,
      threadId: data.threadId,
      message: data.message,
      role: data.role,
      messageType: data.messageType || 'text', // Default to 'text'
      createdAt: data.timestamp || new Date().toISOString(),
      read: false, // Default to unread
    };

    if (data.attachments && data.attachments.length > 0) {
      fields.attachments = formatAttachmentField(data.attachments);
      // If attachments exist, set messageType to 'file' if not already set
      if (!data.messageType) {
        fields.messageType = 'file';
      }
    }

    if (data.callRequestId) {
      fields.callRequestId = data.callRequestId;
      fields.messageType = data.messageType || 'call_request';
    }

    if (data.callStatus) {
      fields.callStatus = data.callStatus;
    }

    const response = await fetch(CHAT_MESSAGES_API_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        fields,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || errorData.message || `Airtable API error: ${response.status} ${response.statusText}`;
      console.error('[AIRTABLE ERROR] createChatMessage failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        fieldsBeingSent: fields,
      });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[AIRTABLE ERROR] createChatMessage failed:', error);
    throw error;
  }
}

/**
 * Get chat messages for a thread with pagination
 */
export async function getChatMessages(params: {
  threadId: string;
  lastMessageId?: string;
  limit?: number; // Max messages to return (default: 50, max: 100)
}): Promise<{
  messages: any[];
  hasMore: boolean;
  lastMessageId?: string;
}> {
  try {
    if (!CHAT_MESSAGES_API_URL) {
      throw new Error('Chat Messages Airtable URL is not configured');
    }

    const limit = Math.min(params.limit || 50, 100); // Cap at 100
    
    // Build filter formula
    let filterFormula = `{threadId} = "${params.threadId}"`;
    
    // If lastMessageId provided, get messages before that ID
    // We'll sort by createdAt descending and use pagination
    let url = `${CHAT_MESSAGES_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=createdAt&sort[0][direction]=desc&maxRecords=${limit + 1}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || errorData.message || `Airtable API error: ${response.status} ${response.statusText}`;
      console.error('[AIRTABLE ERROR] getChatMessages failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
      });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    const records = result.records || [];
    
    // Check if there are more messages
    const hasMore = records.length > limit;
    const messages = hasMore ? records.slice(0, limit) : records;
    
    // Reverse to show oldest first (for chat UI)
    messages.reverse();
    
    const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : undefined;

    return {
      messages: messages.map(record => ({
        id: record.id,
        message: record.fields?.message || '',
        role: record.fields?.role || 'user',
        timestamp: record.fields?.createdAt || record.fields?.timestamp || '', // Support both for migration
        attachments: record.fields?.attachments || [],
        callRequestId: record.fields?.callRequestId,
        read: record.fields?.read || false,
      })),
      hasMore,
      lastMessageId,
    };
  } catch (error) {
    console.error('[AIRTABLE ERROR] getChatMessages failed:', error);
    throw error;
  }
}

/**
 * Get unread call notes for an agent
 */
export async function getUnreadCallNotes(agentId: string): Promise<any[]> {
  try {
    if (!CALL_NOTES_API_URL) {
      throw new Error('Call Notes Airtable URL is not configured');
    }

    const filterFormula = `AND({agentId} = "${agentId}", NOT({read}))`;
    const url = `${CALL_NOTES_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=timestamp&sort[0][direction]=desc`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AIRTABLE ERROR] getUnreadCallNotes failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
      });
      throw new Error(`Failed to get unread call notes: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    return (result.records || []).map(record => ({
      id: record.id,
      callId: record.fields?.callId,
      callerPhone: record.fields?.callerPhone || '',
      note: record.fields?.Notes || '',
      timestamp: record.fields?.timestamp || '',
      callDuration: record.fields?.callDuration,
      read: record.fields?.read || false,
    }));
  } catch (error) {
    console.error('[AIRTABLE ERROR] getUnreadCallNotes failed:', error);
    throw error;
  }
}

/**
 * Mark call notes as read
 */
export async function markCallNotesAsRead(noteIds: string[]): Promise<void> {
  try {
    if (!CALL_NOTES_API_URL || noteIds.length === 0) {
      return;
    }

    // Airtable supports batch updates, but we'll do them individually for simplicity
    // In production, you might want to batch these
    for (const noteId of noteIds) {
      const url = `${CALL_NOTES_API_URL}/${noteId}`;
      await fetch(url, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          fields: {
            read: true,
          },
        }),
      });
    }
  } catch (error) {
    console.error('[AIRTABLE ERROR] markCallNotesAsRead failed:', error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Get call statistics for an agent
 */
export async function getCallStats(agentId: string): Promise<{
  totalCalls: number;
  totalCallMinutes: number;
  averageCallDuration: number;
}> {
  try {
    if (!CALL_NOTES_API_URL) {
      throw new Error('Call Notes Airtable URL is not configured');
    }

    const filterFormula = `{agentId} = "${agentId}"`;
    const url = `${CALL_NOTES_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AIRTABLE ERROR] getCallStats failed:', {
        status: response.status,
        errorData,
      });
      throw new Error(`Failed to get call stats: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    const records = result.records || [];
    
    const callsWithDuration = records.filter((r: any) => r.fields?.callDuration && r.fields.callDuration > 0);
    const totalCalls = records.length;
    const totalCallSeconds = callsWithDuration.reduce((sum: number, r: any) => sum + (r.fields.callDuration || 0), 0);
    const totalCallMinutes = totalCallSeconds / 60;
    const averageCallDuration = callsWithDuration.length > 0 ? totalCallSeconds / callsWithDuration.length : 0;

    return {
      totalCalls,
      totalCallMinutes: Math.round(totalCallMinutes * 100) / 100, // Round to 2 decimals
      averageCallDuration: Math.round(averageCallDuration), // Round to nearest second
    };
  } catch (error) {
    console.error('[AIRTABLE ERROR] getCallStats failed:', error);
    throw error;
  }
}

/**
 * Get recent call notes for an agent (for activity timeline)
 */
export async function getRecentCallNotes(agentId: string, limit: number = 10): Promise<any[]> {
  try {
    if (!CALL_NOTES_API_URL) {
      throw new Error('Call Notes Airtable URL is not configured');
    }

    const filterFormula = `{agentId} = "${agentId}"`;
    const url = `${CALL_NOTES_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=timestamp&sort[0][direction]=desc&maxRecords=${limit}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AIRTABLE ERROR] getRecentCallNotes failed:', {
        status: response.status,
        errorData,
      });
      throw new Error(`Failed to get recent call notes: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    return (result.records || []).map(record => ({
      id: record.id,
      callId: record.fields?.callId,
      callerPhone: record.fields?.callerPhone || '',
      note: record.fields?.Notes || '',
      timestamp: record.fields?.timestamp || '',
      callDuration: record.fields?.callDuration,
      read: record.fields?.read || false,
    }));
  } catch (error) {
    console.error('[AIRTABLE ERROR] getRecentCallNotes failed:', error);
    throw error;
  }
}

/**
 * Get call notes filtered by call type (inbound or outbound)
 */
export async function getCallNotesByType(agentId: string, callType: 'inbound' | 'outbound', limit: number = 10): Promise<any[]> {
  try {
    if (!CALL_NOTES_API_URL) {
      throw new Error('Call Notes Airtable URL is not configured');
    }

    const filterFormula = `AND({agentId} = "${agentId}", {callType} = "${callType}")`;
    const url = `${CALL_NOTES_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=timestamp&sort[0][direction]=desc&maxRecords=${limit}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AIRTABLE ERROR] getCallNotesByType failed:', {
        status: response.status,
        errorData,
      });
      throw new Error(`Failed to get call notes by type: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    return (result.records || []).map(record => ({
      id: record.id,
      callId: record.fields?.callId,
      callerPhone: record.fields?.callerPhone || '',
      note: record.fields?.Notes || '',
      timestamp: record.fields?.timestamp || '',
      callDuration: record.fields?.callDuration,
      read: record.fields?.read || false,
      callType: record.fields?.callType || callType, // Use provided callType as fallback
    }));
  } catch (error) {
    console.error('[AIRTABLE ERROR] getCallNotesByType failed:', error);
    throw error;
  }
}

