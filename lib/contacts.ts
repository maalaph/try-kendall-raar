/**
 * Contact Management System
 * Stores and manages user contacts extracted from conversations
 */

import { formatPhoneNumberToE164 } from './vapi';

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
 * Create or update a contact with intelligent field merging
 */
export async function upsertContact(contact: Contact): Promise<Contact> {
  try {
    if (!CONTACTS_API_URL) {
      console.warn('[CONTACTS] CONTACTS_TABLE_ID not configured. Contact will not be saved.');
      return contact;
    }

    // Normalize phone number before upserting
    let normalizedPhone = contact.phone;
    if (contact.phone) {
      normalizedPhone = formatPhoneNumberToE164(contact.phone) || contact.phone;
    }

    // Always set lastContacted - use provided value or current timestamp
    const lastContactedTimestamp = contact.lastContacted || new Date().toISOString();

    const fields: Record<string, any> = {
      recordId: [contact.recordId],
      Name: contact.name, // Airtable field is "Name" (capital N), not "name"
      updatedAt: new Date().toISOString(),
      lastContacted: lastContactedTimestamp, // Always set lastContacted
    };

    if (normalizedPhone) fields.phone = normalizedPhone;
    if (contact.email) fields.email = contact.email;
    if (contact.relationship) fields.relationship = contact.relationship;
    if (contact.notes) fields.notes = contact.notes;
    if (contact.contactCount !== undefined) fields.contactCount = contact.contactCount;
    if (contact.tags && contact.tags.length > 0) fields.tags = contact.tags.join(',');

    // Try to find existing contact by normalized phone number OR email
    let existing: Contact | null = null;
    let allMatchingContacts: Contact[] = [];
    
    if (normalizedPhone) {
      existing = await getContactByPhone(contact.recordId, normalizedPhone);
    }
    
    // If not found by phone, try by email
    if (!existing && contact.email) {
      existing = await getContactByEmail(contact.recordId, contact.email);
    }
    
    // If still not found and we have both name and phone/email, try by name + phone/email combination
    if (!existing && contact.name && contact.name !== 'Unknown') {
      if (normalizedPhone) {
        existing = await getContactByNameAndPhone(contact.recordId, contact.name, normalizedPhone);
      } else if (contact.email) {
        existing = await getContactByNameAndEmail(contact.recordId, contact.name, contact.email);
      }
    }
    
    // Also find ALL contacts matching the name (for deduplication)
    // This handles cases where multiple rows exist for the same contact (e.g., "Ali", "Call Ali", "Ryan Call Ali")
    if (contact.name && contact.name !== 'Unknown') {
      allMatchingContacts = await getAllContactsByName(contact.recordId, contact.name);
      console.log('[CONTACTS] Found', allMatchingContacts.length, 'contacts matching name:', contact.name);
      
      // If we found an existing contact by phone/email, make sure it's in the matching list
      if (existing && !allMatchingContacts.find(c => c.id === existing!.id)) {
        allMatchingContacts.push(existing);
      }
      
      // If we have matching contacts but no existing by phone/email, use the first one with phone/email
      if (!existing && allMatchingContacts.length > 0) {
        // Prefer contact with phone number, then email, then any contact
        existing = allMatchingContacts.find(c => c.phone) || 
                   allMatchingContacts.find(c => c.email) || 
                   allMatchingContacts[0];
      }
    }
    
    // If we have multiple matching contacts, update ALL of them to keep them in sync
    if (allMatchingContacts.length > 1) {
      console.log('[CONTACTS] Multiple contacts found for name:', contact.name, '- updating all', allMatchingContacts.length, 'contacts');
      
      // Use the most complete contact as the base (prefer one with phone, then email)
      const baseContact = existing || allMatchingContacts.find(c => c.phone) || 
                          allMatchingContacts.find(c => c.email) || 
                          allMatchingContacts[0];
      
      // Merge all contacts' information to create the most complete version
      const mergedContact: Contact = {
        ...baseContact,
        name: contact.name || baseContact.name,
        phone: normalizedPhone || baseContact.phone,
        email: contact.email || baseContact.email,
        relationship: contact.relationship || baseContact.relationship,
      };
      
      // Update all matching contacts with merged information
      const updatePromises = allMatchingContacts.map(async (matchingContact) => {
        const mergedFields: Record<string, any> = {
          Name: mergedContact.name,
          updatedAt: new Date().toISOString(),
        };
        
        if (mergedContact.phone) mergedFields.phone = mergedContact.phone;
        if (mergedContact.email) mergedFields.email = mergedContact.email;
        if (mergedContact.relationship) mergedFields.relationship = mergedContact.relationship;
        
        // Merge notes from all contacts
        const allNotes = [
          matchingContact.notes,
          contact.notes,
          ...allMatchingContacts.map(c => c.notes).filter(Boolean)
        ].filter(Boolean);
        if (allNotes.length > 0) {
          const date = new Date().toISOString().split('T')[0];
          mergedFields.notes = allNotes.join(`\n\n--- ${date} ---\n`);
        }
        
        // Use the highest contact count + 1 (always increment when updating)
        const maxCount = Math.max(
          ...allMatchingContacts.map(c => c.contactCount || 0),
          contact.contactCount || 0
        );
        // Always increment contactCount when updating (don't use provided value, always increment)
        mergedFields.contactCount = maxCount + 1;
        console.log('[CONTACTS] Incrementing contactCount for multiple contacts:', {
          maxCount,
          newCount: mergedFields.contactCount,
          contactName: mergedContact.name,
        });
        
        if (contact.lastContacted) {
          mergedFields.lastContacted = contact.lastContacted;
        } else {
          mergedFields.lastContacted = new Date().toISOString();
        }
        
        const url = `${CONTACTS_API_URL}/${matchingContact.id}`;
        const response = await fetch(url, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ fields: mergedFields }),
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('[CONTACTS] Updated matching contact:', {
            id: matchingContact.id,
            name: mergedFields.Name,
          });
          return parseContactFromRecord(result);
        } else {
          console.error('[CONTACTS] Failed to update matching contact:', matchingContact.id);
          return null;
        }
      });
      
      const updatedContacts = await Promise.all(updatePromises);
      const successfulUpdate = updatedContacts.find(c => c !== null);
      
      if (successfulUpdate) {
        return successfulUpdate;
      }
    }
    
    if (existing) {
        // Update existing contact with intelligent merging
        const mergedFields: Record<string, any> = {
          ...fields,
        };

        // Merge name: prefer new name if it's explicitly provided and not "Unknown"
        // This ensures that if user says "email my friend Ryan" and we previously had "Ali",
        // we update to "Ryan" (the name from the current message)
        const existingName = existing.name || '';
        const newName = contact.name || '';
        if (newName && newName !== 'Unknown' && newName !== existingName) {
          // If new name is different and valid, use it (user is explicitly mentioning this name)
          mergedFields.Name = newName;
        } else if (existingName && existingName !== 'Unknown') {
          mergedFields.Name = existingName; // Keep existing name if new one is invalid or same
        }

        // Merge relationship: only update if not already set
        if (existing.relationship && !contact.relationship) {
          mergedFields.relationship = existing.relationship; // Keep existing relationship
        } else if (contact.relationship) {
          mergedFields.relationship = contact.relationship; // Use new relationship
        }

        // Merge notes: append new notes with separator
        if (existing.notes && contact.notes) {
          const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
          mergedFields.notes = `${existing.notes}\n\n--- ${date} ---\n${contact.notes}`;
        } else if (contact.notes) {
          mergedFields.notes = contact.notes; // Use new notes if existing is empty
        } else if (existing.notes) {
          mergedFields.notes = existing.notes; // Keep existing notes if new is empty
        }

        // Merge email: prefer new if provided, otherwise keep existing
        if (contact.email) {
          mergedFields.email = contact.email;
        } else if (existing.email) {
          mergedFields.email = existing.email;
        }

        // Always increment contact count (don't use provided value, always increment)
        const currentCount = existing.contactCount || 0;
        mergedFields.contactCount = currentCount + 1;
        console.log('[CONTACTS] Incrementing contactCount:', {
          existingCount: currentCount,
          newCount: mergedFields.contactCount,
          contactName: mergedFields.Name,
        });

        // Always update lastContacted - use provided value or current timestamp
        mergedFields.lastContacted = contact.lastContacted || new Date().toISOString();

        // Update existing contact
        const url = `${CONTACTS_API_URL}/${existing.id}`;
        const response = await fetch(url, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ fields: mergedFields }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log('[CONTACTS] ✅ Updated existing contact:', {
            id: existing.id,
            name: mergedFields.Name,
            phone: normalizedPhone,
            email: mergedFields.email,
            lastContacted: mergedFields.lastContacted,
            contactCount: mergedFields.contactCount,
            recordId: contact.recordId,
          });
          return parseContactFromRecord(result);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('[CONTACTS] ❌ Failed to update existing contact:', {
            id: existing.id,
            name: mergedFields.Name,
            phone: normalizedPhone,
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          });
          throw new Error(`Failed to update contact: ${response.status} ${response.statusText}`);
        }
    }

    // Create new contact
    fields.createdAt = new Date().toISOString();
    fields.contactCount = contact.contactCount || 1;
    // lastContacted is already set in fields above, but ensure it's there
    if (!fields.lastContacted) {
      fields.lastContacted = new Date().toISOString();
    }

    const response = await fetch(CONTACTS_API_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[CONTACTS] ❌ Failed to create new contact:', {
        name: fields.Name,
        phone: normalizedPhone,
        email: fields.email,
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      throw new Error(errorData.error?.message || `Failed to create contact: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('[CONTACTS] ✅ Created new contact:', {
      id: result.id,
      name: fields.Name,
      phone: normalizedPhone,
      email: fields.email,
      lastContacted: fields.lastContacted,
      contactCount: fields.contactCount,
      recordId: contact.recordId,
    });
    return parseContactFromRecord(result);
  } catch (error) {
    console.error('[CONTACTS] Failed to upsert contact:', error);
    throw error;
  }
}

/**
 * Get contact by phone number (with normalization for deduplication)
 */
export async function getContactByPhone(recordId: string, phone: string): Promise<Contact | null> {
  try {
    if (!CONTACTS_API_URL || !phone) return null;

    // Normalize phone number to E.164 format for comparison
    const normalizedPhone = formatPhoneNumberToE164(phone);
    if (!normalizedPhone) {
      console.warn('[CONTACTS] Invalid phone number format, cannot search:', phone);
      return null;
    }

    console.log('[CONTACTS] getContactByPhone: Searching for phone:', normalizedPhone, 'recordId:', recordId);

    // First try filter formula
    let filterFormula = `{recordId} = "${recordId}" AND {phone} = "${normalizedPhone}"`;
    let url = `${CONTACTS_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}`;

    let response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (response.ok) {
      const result = await response.json();
      const records = result.records || [];
      
      if (records.length > 0) {
        console.log('[CONTACTS] getContactByPhone: Found contact via filter');
        return parseContactFromRecord(records[0]);
      }
    }

    // Fallback: Use getUserContacts (which has its own fallback) and filter by phone
    console.log('[CONTACTS] getContactByPhone: Filter returned 0 results, using getUserContacts fallback');
    const allContacts = await getUserContacts(recordId);
    
    // Compare normalized phone numbers
    for (const contact of allContacts) {
      if (contact.phone) {
        const existingNormalized = formatPhoneNumberToE164(contact.phone);
        if (existingNormalized === normalizedPhone) {
          console.log('[CONTACTS] getContactByPhone: Found contact via client-side match');
          return contact;
        }
      }
    }

    console.log('[CONTACTS] getContactByPhone: No contact found with phone:', normalizedPhone);
    return null;
  } catch (error) {
    console.error('[CONTACTS] Failed to get contact by phone:', error);
    return null;
  }
}

/**
 * Get contact by email address (for deduplication)
 */
export async function getContactByEmail(recordId: string, email: string): Promise<Contact | null> {
  try {
    if (!CONTACTS_API_URL || !email) return null;

    console.log('[CONTACTS] getContactByEmail: Searching for email:', email, 'recordId:', recordId);

    // First try filter formula
    const filterFormula = `{recordId} = "${recordId}" AND {email} = "${email}"`;
    const url = `${CONTACTS_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (response.ok) {
      const result = await response.json();
      const records = result.records || [];
      
      if (records.length > 0) {
        console.log('[CONTACTS] getContactByEmail: Found contact via filter');
        return parseContactFromRecord(records[0]);
      }
    }

    // Fallback: Use getUserContacts and filter by email
    console.log('[CONTACTS] getContactByEmail: Filter returned 0 results, using getUserContacts fallback');
    const allContacts = await getUserContacts(recordId);
    
    for (const contact of allContacts) {
      if (contact.email && contact.email.toLowerCase() === email.toLowerCase()) {
        console.log('[CONTACTS] getContactByEmail: Found contact via client-side match');
        return contact;
      }
    }

    console.log('[CONTACTS] getContactByEmail: No contact found with email:', email);
    return null;
  } catch (error) {
    console.error('[CONTACTS] Failed to get contact by email:', error);
    return null;
  }
}

/**
 * Get contact by name and phone (for deduplication when phone/email don't match)
 */
export async function getContactByNameAndPhone(recordId: string, name: string, phone: string): Promise<Contact | null> {
  try {
    if (!CONTACTS_API_URL || !name || !phone) return null;

    const normalizedPhone = formatPhoneNumberToE164(phone);
    if (!normalizedPhone) return null;

    console.log('[CONTACTS] getContactByNameAndPhone: Searching for name:', name, 'phone:', normalizedPhone, 'recordId:', recordId);

    // Use getUserContacts (which has fallback) and filter by name and phone
    const allContacts = await getUserContacts(recordId);
    
    const nameLower = name.toLowerCase().trim();
    
    // Check if any match both name and normalized phone
    for (const contact of allContacts) {
      const contactNameLower = contact.name?.toLowerCase().trim() || '';
      if (contactNameLower === nameLower && contact.phone) {
        const existingNormalized = formatPhoneNumberToE164(contact.phone);
        if (existingNormalized === normalizedPhone) {
          console.log('[CONTACTS] getContactByNameAndPhone: Found contact');
          return contact;
        }
      }
    }

    console.log('[CONTACTS] getContactByNameAndPhone: No contact found');
    return null;
  } catch (error) {
    console.error('[CONTACTS] Failed to get contact by name and phone:', error);
    return null;
  }
}

/**
 * Get contact by name and email (for deduplication when phone doesn't match)
 */
export async function getContactByNameAndEmail(recordId: string, name: string, email: string): Promise<Contact | null> {
  try {
    if (!CONTACTS_API_URL || !name || !email) return null;

    console.log('[CONTACTS] getContactByNameAndEmail: Searching for name:', name, 'email:', email, 'recordId:', recordId);

    // Use getUserContacts (which has fallback) and filter by name and email
    const allContacts = await getUserContacts(recordId);
    
    const nameLower = name.toLowerCase().trim();
    const emailLower = email.toLowerCase().trim();
    
    for (const contact of allContacts) {
      const contactNameLower = contact.name?.toLowerCase().trim() || '';
      const contactEmailLower = contact.email?.toLowerCase().trim() || '';
      if (contactNameLower === nameLower && contactEmailLower === emailLower) {
        console.log('[CONTACTS] getContactByNameAndEmail: Found contact');
        return contact;
      }
    }

    console.log('[CONTACTS] getContactByNameAndEmail: No contact found');
    return null;
  } catch (error) {
    console.error('[CONTACTS] Failed to get contact by name and email:', error);
    return null;
  }
}

/**
 * Get ALL contacts matching a name (case-insensitive, partial match)
 * Returns all contacts that match the name, useful for deduplication
 */
export async function getAllContactsByName(recordId: string, name: string): Promise<Contact[]> {
  try {
    if (!CONTACTS_API_URL || !name) {
      console.log('[CONTACTS] getAllContactsByName: Missing CONTACTS_API_URL or name');
      return [];
    }

    console.log('[CONTACTS] Looking up all contacts by name:', { recordId, name });

    // Get all contacts for this recordId
    const allContacts = await getUserContacts(recordId);
    console.log('[CONTACTS] Found', allContacts.length, 'total contacts for recordId:', recordId);
    
    const nameLower = name.toLowerCase().trim();
    const matchingContacts: Contact[] = [];
    
    // Try exact match first (case-insensitive)
    for (const contact of allContacts) {
      if (contact.name && contact.name.toLowerCase().trim() === nameLower) {
        console.log('[CONTACTS] Exact match found:', contact.name);
        matchingContacts.push(contact);
      }
    }
    
    // If no exact matches, try partial match (search name contains contact name or vice versa)
    if (matchingContacts.length === 0) {
      for (const contact of allContacts) {
        const contactNameLower = contact.name?.toLowerCase().trim() || '';
        if (contactNameLower && (contactNameLower.includes(nameLower) || nameLower.includes(contactNameLower))) {
          console.log('[CONTACTS] Partial match found:', contact.name);
          matchingContacts.push(contact);
        }
      }
    }
    
    // If still no matches, try matching first word only (for "Ali" matching "Ali and" or "Ali Smith")
    if (matchingContacts.length === 0) {
      const nameFirstWord = nameLower.split(/\s+/)[0];
      for (const contact of allContacts) {
        const contactNameLower = contact.name?.toLowerCase().trim() || '';
        const contactFirstWord = contactNameLower.split(/\s+/)[0];
        if (contactFirstWord && contactFirstWord === nameFirstWord) {
          console.log('[CONTACTS] First word match found:', contact.name);
          matchingContacts.push(contact);
        }
      }
    }

    console.log('[CONTACTS] Found', matchingContacts.length, 'contacts matching name:', name);
    return matchingContacts;
  } catch (error) {
    console.error('[CONTACTS] Failed to get all contacts by name:', error);
    return [];
  }
}

/**
 * Get contact by name (case-insensitive, partial match)
 * Returns the first contact matching the name that has a phone number
 */
export async function getContactByName(recordId: string, name: string): Promise<Contact | null> {
  try {
    if (!CONTACTS_API_URL || !name) {
      console.log('[CONTACTS] getContactByName: Missing CONTACTS_API_URL or name');
      return null;
    }

    console.log('[CONTACTS] Looking up contact by name:', { recordId, name });

    // Get all contacts for this recordId and do client-side matching (more reliable than Airtable formulas)
    const allContacts = await getUserContacts(recordId);
    console.log('[CONTACTS] Found', allContacts.length, 'total contacts for recordId:', recordId);
    
    const nameLower = name.toLowerCase().trim();
    
    // Log all contact names for debugging
    const contactNames = allContacts.map(c => c.name).filter(Boolean);
    console.log('[CONTACTS] Available contact names:', contactNames);
    
    // Try exact match first (case-insensitive)
    for (const contact of allContacts) {
      if (contact.name && contact.name.toLowerCase().trim() === nameLower) {
        console.log('[CONTACTS] Exact match found:', contact.name, 'phone:', contact.phone ? 'has phone' : 'no phone');
        if (contact.phone) {
          return contact;
        }
      }
    }
    
    // Try partial match (search name contains contact name or vice versa)
    for (const contact of allContacts) {
      const contactNameLower = contact.name?.toLowerCase().trim() || '';
      if (contactNameLower && (contactNameLower.includes(nameLower) || nameLower.includes(contactNameLower))) {
        console.log('[CONTACTS] Partial match found:', contact.name, 'phone:', contact.phone ? 'has phone' : 'no phone');
        if (contact.phone) {
          return contact;
        }
      }
    }
    
    // Try matching first word only (for "Ali" matching "Ali and" or "Ali Smith")
    const nameFirstWord = nameLower.split(/\s+/)[0];
    for (const contact of allContacts) {
      const contactNameLower = contact.name?.toLowerCase().trim() || '';
      const contactFirstWord = contactNameLower.split(/\s+/)[0];
      if (contactFirstWord && contactFirstWord === nameFirstWord) {
        console.log('[CONTACTS] First word match found:', contact.name, 'phone:', contact.phone ? 'has phone' : 'no phone');
        if (contact.phone) {
          return contact;
        }
      }
    }

    console.log('[CONTACTS] No contact found matching name:', name);
    return null;
  } catch (error) {
    console.error('[CONTACTS] Failed to get contact by name:', error);
    return null;
  }
}

/**
 * Get all contacts for a user
 * Handles linked record fields by trying filter first, then falling back to client-side filtering
 */
export async function getUserContacts(recordId: string): Promise<Contact[]> {
  try {
    if (!CONTACTS_API_URL) {
      console.log('[CONTACTS] getUserContacts: CONTACTS_API_URL not configured');
      return [];
    }

    console.log('[CONTACTS] getUserContacts: Fetching contacts for recordId:', recordId);

    // Try filter formula first (works for both text and linked record fields)
    // For linked records, Airtable accepts the record ID directly
    const filterFormula = `{recordId} = "${recordId}"`;
    const url = `${CONTACTS_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=lastContacted&sort[0][direction]=desc`;

    console.log('[CONTACTS] getUserContacts: Airtable URL:', url);
    console.log('[CONTACTS] getUserContacts: Filter formula:', filterFormula);

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (response.ok) {
      const result = await response.json();
      const records = result.records || [];
      const contacts = records.map(parseContactFromRecord);
      
      console.log('[CONTACTS] getUserContacts: Filter returned', contacts.length, 'contacts');
      
      // If we got results, return them
      if (contacts.length > 0) {
        return contacts;
      }
      
      // If filter returned 0 results, try fallback: fetch all and filter client-side
      console.log('[CONTACTS] getUserContacts: Filter returned 0 results, trying fallback (fetch all)');
    } else {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[CONTACTS] getUserContacts: Filter query failed:', response.status, errorText);
      console.log('[CONTACTS] getUserContacts: Trying fallback (fetch all)');
    }

    // Fallback: Fetch ALL contacts and filter client-side
    // This handles cases where the filter formula doesn't work for linked records
    const fallbackUrl = `${CONTACTS_API_URL}?sort[0][field]=lastContacted&sort[0][direction]=desc&maxRecords=500`;
    console.log('[CONTACTS] getUserContacts: Fallback URL:', fallbackUrl);

    const fallbackResponse = await fetch(fallbackUrl, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!fallbackResponse.ok) {
      const errorText = await fallbackResponse.text().catch(() => 'Unknown error');
      console.error('[CONTACTS] getUserContacts: Fallback query failed:', fallbackResponse.status, errorText);
      return [];
    }

    const fallbackResult = await fallbackResponse.json();
    const allRecords = fallbackResult.records || [];
    console.log('[CONTACTS] getUserContacts: Fetched', allRecords.length, 'total contacts from Airtable');

    // Filter client-side by recordId
    const filteredContacts: Contact[] = [];
    for (const record of allRecords) {
      const contact = parseContactFromRecord(record);
      // Check if recordId matches (handles both string and array formats)
      const contactRecordId = Array.isArray(record.fields?.recordId) 
        ? record.fields.recordId[0] 
        : record.fields?.recordId;
      
      // Also check if it's a linked record object with id property
      const linkedRecordId = Array.isArray(record.fields?.recordId) && record.fields.recordId[0]?.id
        ? record.fields.recordId[0].id
        : null;
      
      if (contactRecordId === recordId || linkedRecordId === recordId || contact.recordId === recordId) {
        filteredContacts.push(contact);
      }
    }

    console.log('[CONTACTS] getUserContacts: Client-side filter found', filteredContacts.length, 'contacts for recordId:', recordId);
    return filteredContacts;
  } catch (error) {
    console.error('[CONTACTS] getUserContacts: Error:', error);
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
    name: record.fields?.Name || record.fields?.name || '', // Support both "Name" and "name" for compatibility
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


