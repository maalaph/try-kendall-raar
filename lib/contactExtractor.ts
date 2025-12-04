/**
 * Contact Extraction from Conversations
 * Automatically extracts contact information from messages
 */

import { upsertContact, Contact } from './contacts';
import { formatPhoneNumberToE164 } from './vapi';

// Common words to exclude from name extraction
const EXCLUDED_WORDS = new Set([
  'for', 'my', 'call', 'text', 'message', 'tell', 'contact', 'reach', 'out', 'to',
  'the', 'a', 'an', 'his', 'her', 'their', 'number', 'phone', 'at', 'on', 'is',
  'me', 'you', 'him', 'she', 'they', 'this', 'that', 'with', 'from', 'and', 'or',
  'need', 'want', 'can', 'will', 'should', 'would', 'could', 'please', 'ask', 'give'
]);

// Action words that might appear before names but shouldn't be part of the name
const ACTION_WORDS = new Set([
  'call', 'text', 'message', 'tell', 'contact', 'reach', 'email', 'send', 'give',
  'ask', 'need', 'want', 'can', 'will', 'should', 'would', 'could'
]);

/**
 * Validate if a potential name is valid
 */
function isValidName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  
  const trimmed = name.trim();
  
  // Must be 2-30 characters (increased from 20 to handle longer names)
  if (trimmed.length < 2 || trimmed.length > 30) return false;
  
  // Must start with capital letter (case-insensitive check - we'll capitalize if needed)
  const firstChar = trimmed[0];
  if (!/[A-Za-z]/.test(firstChar)) return false;
  
  // Must not be in excluded words list
  if (EXCLUDED_WORDS.has(trimmed.toLowerCase())) return false;
  
  // Must contain only letters, spaces, hyphens, and apostrophes (for names like "John Smith", "Mary-Jane", "O'Brien")
  if (!/^[A-Za-z]+(?:[\s\-'][A-Za-z]+)*$/.test(trimmed)) return false;
  
  return true;
}

/**
 * Extract contact information from a message
 */
export async function extractContactFromMessage(
  recordId: string,
  message: string,
  timestamp: string
): Promise<Contact | null> {
  if (!message || typeof message !== 'string') {
    return null;
  }

  // Phone number patterns
  const phonePatterns = [
    /\b(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})\b/g,
    /\b(\+\d{1,2}\s?\(\d{3}\)\s?\d{3}[-.\s]?\d{4})\b/g,
    /\b(\d{10})\b/g,
    /\b(\d{11})\b/g, // 11 digits (with country code)
  ];

  // Improved name patterns - excludes common words
  // CRITICAL: Only capture 1-2 words (first name, optionally last name)
  // Order matters: more specific patterns first, then simpler ones
  const namePatterns = [
    // Pattern 1: "call my friend Ali" or "email my friend Ryan" - captures relationship and name (1-2 words only)
    /(?:call|text|message|tell|contact|reach\s+out\s+to|email|send\s+(?:an?\s+)?email\s+to)\s+(?:my\s+)?(?:friend|colleague|brother|sister|dad|mom|father|mother|aunt|uncle|cousin|boss|manager|client|customer|neighbor)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:\s+(?:his|her|their|the|ask|if|can|come|for|dinner|tmr|tomorrow|to|at|on|with|about|when|where|how|what|why|will|would|should|could|may|might|please|need|want|tell|give|send|call|text|message|email))/i,
    // Pattern 2: "Ali his number is" or "Ryan his email is" - name before contact info (1-2 words only)
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:his|her|their|the)\s+(?:number|phone|email)\s+is/i,
    // Pattern 3: "email Ryan at email@..." or "call Ali at 814..." - action + name + at + contact (1-2 words only)
    /(?:email|call|text|message)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+at\s+(?:phone|number|\d|@)/i,
    // Pattern 4: Simple "call Ali" or "email Ryan" or "Call Ali" - most common format (1-2 words only)
    // This should match "Call Ali" even if it's at the start of message
    // CRITICAL: Stop immediately after name - don't capture rest of sentence
    /(?:^|\s)(?:call|text|message|tell|email|send)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:\s+(?:ask|if|can|come|for|dinner|tmr|tomorrow|to|at|on|with|about|when|where|how|what|why|will|would|should|could|may|might|please|need|want|tell|give|send|call|text|message|email|his|her|their|the|number|phone|email)|$|,|\.|and\s)/i,
    // Pattern 5: "Ali at 814..." or "Ryan at email@..." - name + at + contact (without action verb, 1-2 words only)
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:at|on)\s+(?:phone|number|\d|@)/i,
    // Pattern 6: Just a capitalized word that looks like a name (fallback, single word only)
    // This catches cases like "Call Ali" where the pattern might have missed it
    /(?:^|\s)([A-Z][a-z]{1,29})(?:\s+(?:ask|if|can|come|for|dinner|tmr|tomorrow|to|at|on|with|about|when|where|how|what|why|will|would|should|could|may|might|please|need|want|tell|give|send|call|text|message|email|his|her|their|the|number|phone|email)|$|,|\.|and\s)/,
  ];

  // Relationship extraction patterns
  // "my friend", "my colleague", "a friend", etc.
  const relationshipPatterns = [
    /(?:my|a|an)\s+(friend|colleague|brother|sister|dad|mom|father|mother|aunt|uncle|cousin|boss|manager|client|customer|neighbor|brother-in-law|sister-in-law)/i,
  ];

  let contact: Partial<Contact> | null = null;
  let extractedName: string | null = null;
  let extractedRelationship: string | null = null;
  let extractedPhone: string | null = null;

  // Extract phone number first
  for (const pattern of phonePatterns) {
    const matches = message.match(pattern);
    if (matches && matches.length > 0) {
      const phoneRaw = matches[0].replace(/[^\d+]/g, '');
      if (phoneRaw.length >= 10) {
        // Normalize to E.164 format
        extractedPhone = formatPhoneNumberToE164(phoneRaw);
        if (extractedPhone) {
          contact = { phone: extractedPhone };
          break;
        }
      }
    }
  }

  // Extract name with improved patterns
  // Try each pattern and take the first valid name found
  for (const pattern of namePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      let name = match[1].trim();
      
      // Filter out action words that might have been captured (e.g., "Call" from "Call Ali")
      const nameWords = name.split(/\s+/).filter(word => {
        const wordLower = word.toLowerCase();
        return !ACTION_WORDS.has(wordLower) && !EXCLUDED_WORDS.has(wordLower);
      });
      
      if (nameWords.length === 0) {
        continue; // Skip if all words were filtered out
      }
      
      name = nameWords.join(' ');
      
      // CRITICAL: Limit to first 1-2 words only (first name, optionally last name)
      // This prevents capturing full sentences like "Ali If He Come Dinner Tmr"
      const nameParts = name.split(/\s+/);
      if (nameParts.length > 2) {
        name = nameParts.slice(0, 2).join(' '); // Only keep first 2 words
        console.log('[CONTACT EXTRACTION] Limited name to first 2 words:', name);
      }
      
      // Capitalize first letter of each word if needed (handles "ali" -> "Ali")
      name = name.split(/\s+/).map(word => {
        if (word.length === 0) return word;
        return word[0].toUpperCase() + word.slice(1).toLowerCase();
      }).join(' ');
      
      if (isValidName(name)) {
        extractedName = name;
        if (!contact) contact = {};
        contact.name = name;
        console.log('[CONTACT EXTRACTION] Extracted name:', name, 'from pattern match');
        break; // Take first valid name found
      } else {
        console.log('[CONTACT EXTRACTION] Name validation failed for:', name);
      }
    }
  }
  
  // Log if no name was extracted
  if (!extractedName) {
    console.log('[CONTACT EXTRACTION] No name extracted from message:', message.substring(0, 100));
  }

  // Extract relationship
  for (const pattern of relationshipPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const relationship = match[1].toLowerCase();
      extractedRelationship = relationship;
      if (!contact) contact = {};
      contact.relationship = relationship;
      break; // Take first relationship found
    }
  }

  // Extract email
  const emailPattern = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
  const emailMatch = message.match(emailPattern);
  if (emailMatch && emailMatch[0]) {
    if (!contact) contact = {};
    contact.email = emailMatch[0];
  }

  // Extract notes (the message itself, truncated if too long)
  if (message && message.length > 0) {
    const notes = message.length > 500 ? message.substring(0, 500) + '...' : message;
    if (!contact) contact = {};
    contact.notes = notes;
  }

  // Only create contact if we have at least a name or phone
  // Don't create contacts with "Unknown" name - skip instead
  if (contact && (contact.name || contact.phone)) {
    // Don't create contact if name is "Unknown" - this means extraction failed
    if (contact.name === 'Unknown' || !contact.name) {
      console.log('[CONTACT EXTRACTION] Skipping contact creation - no valid name extracted');
      // Still return the contact object if we have phone/email for lookup purposes
      if (contact.phone || contact.email) {
        return contact as Contact;
      }
      return null;
    }
    
    try {
      const createdContact = await upsertContact({
        recordId,
        name: contact.name, // We know this is not "Unknown" at this point
        phone: contact.phone,
        email: contact.email,
        relationship: contact.relationship,
        notes: contact.notes,
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
