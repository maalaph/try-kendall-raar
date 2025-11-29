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

