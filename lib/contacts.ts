/**
 * Contact Management System
 * Stores and manages user contacts extracted from conversations
 */

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const CONTACTS_TABLE_ID = process.env.AIRTABLE_CONTACTS_TABLE_ID;

const CONTACTS_API_URL = AIRTABLE_BASE_ID && CONTACTS_TABLE_ID
  ? `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${CONTACTS_TABLE_ID}`
  : '';

const getHeaders = () => ({
  'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json',
});

export interface Contact {
  id?: string;
  recordId: string; // Link to main user record
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
 * Create or update a contact
 */
export async function upsertContact(contact: Contact): Promise<Contact> {
  try {
    if (!CONTACTS_API_URL) {
      console.warn('[CONTACTS] CONTACTS_TABLE_ID not configured. Contact will not be saved.');
      return contact;
    }

    const fields: Record<string, any> = {
      recordId: [contact.recordId],
      name: contact.name,
      updatedAt: new Date().toISOString(),
    };

    if (contact.phone) fields.phone = contact.phone;
    if (contact.email) fields.email = contact.email;
    if (contact.relationship) fields.relationship = contact.relationship;
    if (contact.notes) fields.notes = contact.notes;
    if (contact.lastContacted) fields.lastContacted = contact.lastContacted;
    if (contact.contactCount !== undefined) fields.contactCount = contact.contactCount;
    if (contact.tags && contact.tags.length > 0) fields.tags = contact.tags.join(',');

    // Try to find existing contact by name + phone
    if (contact.phone) {
      const existing = await getContactByPhone(contact.recordId, contact.phone);
      if (existing) {
        // Update existing
        const url = `${CONTACTS_API_URL}/${existing.id}`;
        const response = await fetch(url, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ fields }),
        });

        if (response.ok) {
          const result = await response.json();
          return parseContactFromRecord(result);
        }
      }
    }

    // Create new
    fields.createdAt = new Date().toISOString();
    fields.contactCount = contact.contactCount || 1;

    const response = await fetch(CONTACTS_API_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Failed to create contact: ${response.status}`);
    }

    const result = await response.json();
    return parseContactFromRecord(result);
  } catch (error) {
    console.error('[CONTACTS] Failed to upsert contact:', error);
    throw error;
  }
}

/**
 * Get contact by phone number
 */
export async function getContactByPhone(recordId: string, phone: string): Promise<Contact | null> {
  try {
    if (!CONTACTS_API_URL) return null;

    const filterFormula = `{recordId} = "${recordId}" AND {phone} = "${phone}"`;
    const url = `${CONTACTS_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) return null;

    const result = await response.json();
    const records = result.records || [];
    
    if (records.length > 0) {
      return parseContactFromRecord(records[0]);
    }

    return null;
  } catch (error) {
    console.error('[CONTACTS] Failed to get contact by phone:', error);
    return null;
  }
}

/**
 * Get all contacts for a user
 */
export async function getUserContacts(recordId: string): Promise<Contact[]> {
  try {
    if (!CONTACTS_API_URL) return [];

    const filterFormula = `{recordId} = "${recordId}"`;
    const url = `${CONTACTS_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=lastContacted&sort[0][direction]=desc`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      console.error('[CONTACTS] Failed to get contacts:', response.status);
      return [];
    }

    const result = await response.json();
    return (result.records || []).map(parseContactFromRecord);
  } catch (error) {
    console.error('[CONTACTS] Failed to get contacts:', error);
    return [];
  }
}

/**
 * Update contact last contacted time
 */
export async function updateContactLastContacted(contactId: string, incrementCount: boolean = true): Promise<void> {
  try {
    if (!CONTACTS_API_URL) return;

    const fields: Record<string, any> = {
      lastContacted: new Date().toISOString(),
    };

    if (incrementCount) {
      // Get current contact to increment count
      const url = `${CONTACTS_API_URL}/${contactId}`;
      const getResponse = await fetch(url, {
        method: 'GET',
        headers: getHeaders(),
      });

      if (getResponse.ok) {
        const current = await getResponse.json();
        const currentCount = current.fields?.contactCount || 0;
        fields.contactCount = currentCount + 1;
      }
    }

    const updateUrl = `${CONTACTS_API_URL}/${contactId}`;
    await fetch(updateUrl, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ fields }),
    });
  } catch (error) {
    console.error('[CONTACTS] Failed to update last contacted:', error);
  }
}

/**
 * Helper: Parse contact from Airtable record
 */
function parseContactFromRecord(record: any): Contact {
  return {
    id: record.id,
    recordId: Array.isArray(record.fields?.recordId) 
      ? record.fields.recordId[0] 
      : record.fields?.recordId || '',
    name: record.fields?.name || '',
    phone: record.fields?.phone,
    email: record.fields?.email,
    relationship: record.fields?.relationship,
    notes: record.fields?.notes,
    lastContacted: record.fields?.lastContacted,
    contactCount: record.fields?.contactCount || 0,
    tags: record.fields?.tags ? String(record.fields.tags).split(',').map(t => t.trim()) : [],
    createdAt: record.fields?.createdAt,
    updatedAt: record.fields?.updatedAt,
  };
}

