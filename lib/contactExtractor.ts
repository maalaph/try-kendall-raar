/**
 * Contact Extraction from Conversations
 * Automatically extracts contact information from messages
 */

import { upsertContact, Contact } from './contacts';

/**
 * Extract contact information from a message
 */
export async function extractContactFromMessage(
  recordId: string,
  message: string,
  timestamp: string
): Promise<Contact | null> {
  // Phone number patterns
  const phonePatterns = [
    /\b(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})\b/g,
    /\b(\+\d{1,2}\s?\(\d{3}\)\s?\d{3}[-.\s]?\d{4})\b/g,
    /\b(\d{10})\b/g,
  ];

  // Name patterns (before phone numbers)
  const namePatterns = [
    /(?:call|text|message|contact|reach out to|tell)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:at|on|phone|number)/i,
  ];

  let contact: Partial<Contact> | null = null;

  // Extract phone number
  for (const pattern of phonePatterns) {
    const matches = message.match(pattern);
    if (matches && matches.length > 0) {
      const phone = matches[0].replace(/[^\d+]/g, '');
      if (phone.length >= 10) {
        contact = { phone };
        break;
      }
    }
  }

  // Extract name
  for (const pattern of namePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length > 1 && name.length < 50) {
        if (!contact) contact = {};
        contact.name = name;
      }
    }
  }

  // Extract email
  const emailPattern = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
  const emailMatch = message.match(emailPattern);
  if (emailMatch && emailMatch[0]) {
    if (!contact) contact = {};
    contact.email = emailMatch[0];
  }

  // Only create contact if we have at least a name or phone
  if (contact && (contact.name || contact.phone)) {
    try {
      const createdContact = await upsertContact({
        recordId,
        name: contact.name || 'Unknown',
        phone: contact.phone,
        email: contact.email,
        lastContacted: timestamp,
      });
      return createdContact;
    } catch (error) {
      console.error('[CONTACT EXTRACTION] Failed to save contact:', error);
      return null;
    }
  }

  return null;
}

