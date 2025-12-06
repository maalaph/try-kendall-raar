/**
 * Migration Script: Airtable → PostgreSQL
 * Migrates existing user data from Airtable to Supabase PostgreSQL
 * 
 * Usage:
 *   npx tsx scripts/migrate-airtable-to-postgres.ts <recordId>
 * 
 * Example:
 *   npx tsx scripts/migrate-airtable-to-postgres.ts recDlJgYuwuaxYcoM
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const AIRTABLE_API_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;
const AIRTABLE_CHAT_MESSAGES_URL = process.env.AIRTABLE_CHAT_MESSAGES_TABLE_ID
  ? `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_CHAT_MESSAGES_TABLE_ID}`
  : '';
const AIRTABLE_CONTACTS_URL = process.env.AIRTABLE_CONTACTS_TABLE_ID
  ? `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_CONTACTS_TABLE_ID}`
  : '';
const AIRTABLE_PATTERNS_URL = process.env.AIRTABLE_USER_PATTERNS_TABLE_ID
  ? `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_USER_PATTERNS_TABLE_ID}`
  : '';
const AIRTABLE_MEMORIES_URL = process.env.AIRTABLE_USER_MEMORY_TABLE_ID
  ? `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_USER_MEMORY_TABLE_ID}`
  : '';

const getAirtableHeaders = () => ({
  'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json',
});

// Initialize Supabase client
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Fetch all records from Airtable with pagination
 */
async function fetchAllAirtableRecords(url: string): Promise<any[]> {
  const allRecords: any[] = [];
  let offset: string | undefined = undefined;

  do {
    const requestUrl = offset ? `${url}?offset=${offset}` : url;
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: getAirtableHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    allRecords.push(...(result.records || []));
    offset = result.offset;
    
    // Add small delay to respect rate limits
    if (offset) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  } while (offset);

  return allRecords;
}

/**
 * Migrate user record
 */
async function migrateUser(recordId: string): Promise<void> {
  console.log(`\n📦 Migrating user: ${recordId}...`);

  // Fetch from Airtable
  const response = await fetch(`${AIRTABLE_API_URL}/${recordId}`, {
    method: 'GET',
    headers: getAirtableHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user from Airtable: ${response.status}`);
  }

  const airtableRecord = await response.json();
  const fields = airtableRecord.fields;

  // Transform to PostgreSQL format (snake_case)
  const userData: any = {
    record_id: recordId,
    full_name: fields.fullName || null,
    nickname: fields.nickname || null,
    email: fields.email || null,
    mobile_number: fields.mobileNumber || null,
    kendall_name: fields.kendallName || 'Kendall',
    selected_traits: Array.isArray(fields.selectedTraits) ? fields.selectedTraits : [],
    use_case_choice: fields.useCaseChoice || null,
    boundary_choices: Array.isArray(fields.boundaryChoices) ? fields.boundaryChoices : [],
    user_context_and_rules: fields.userContextAndRules || null,
    analyzed_file_content: fields.analyzedFileContent || null,
    file_usage_instructions: fields.fileUsageInstructions || null,
    vapi_agent_id: fields.vapi_agent_id || null,
    time_zone: fields.timeZone || fields['Time Zone'] || 'UTC',
  };

  // Insert into PostgreSQL
  const { error } = await supabase
    .from('users')
    .upsert(userData, { onConflict: 'record_id' });

  if (error) {
    throw new Error(`Failed to insert user: ${error.message}`);
  }

  console.log(`✅ User migrated successfully`);
}

/**
 * Migrate threads and chat messages
 */
async function migrateChatData(recordId: string): Promise<void> {
  console.log(`\n💬 Migrating chat data for user: ${recordId}...`);

  if (!AIRTABLE_CHAT_MESSAGES_URL) {
    console.log('⚠️  Chat messages table not configured, skipping...');
    return;
  }

  // Fetch all messages from Airtable
  console.log('Fetching all chat messages from Airtable...');
  const allMessages = await fetchAllAirtableRecords(AIRTABLE_CHAT_MESSAGES_URL);

  // Filter messages for this user
  // Handle both linked record (array) and text field formats
  const userMessages = allMessages.filter((record: any) => {
    const recordIdField = record.fields?.recordId;
    if (Array.isArray(recordIdField)) {
      // Linked record - check if recordId is in the array
      return recordIdField.includes(recordId) || 
             recordIdField.some((r: any) => (typeof r === 'string' ? r : r.id) === recordId);
    }
    // Text field - direct comparison
    return recordIdField === recordId;
  });

  console.log(`Found ${userMessages.length} messages to migrate`);

  if (userMessages.length === 0) {
    console.log('No messages to migrate');
    return;
  }

  // Group by thread
  const threadsMap = new Map<string, any[]>();
  for (const msg of userMessages) {
    const threadId = msg.fields?.threadId;
    if (!threadId) {
      console.warn('⚠️  Message missing threadId, skipping:', msg.id);
      continue;
    }

    if (!threadsMap.has(threadId)) {
      threadsMap.set(threadId, []);
    }
    threadsMap.get(threadId)!.push(msg);
  }

  console.log(`Found ${threadsMap.size} unique threads`);

  // Migrate threads and messages
  let totalMessagesMigrated = 0;
  for (const [threadId, messages] of threadsMap.entries()) {
    // Create thread
    const { error: threadError } = await supabase
      .from('threads')
      .upsert({
        record_id: recordId,
        thread_id: threadId,
      }, { onConflict: 'thread_id' });

    if (threadError) {
      console.error(`⚠️  Failed to create thread ${threadId}:`, threadError.message);
      continue;
    }

    // Sort messages by timestamp/createdAt
    messages.sort((a, b) => {
      const timeA = a.fields?.createdAt || a.fields?.timestamp || '';
      const timeB = b.fields?.createdAt || b.fields?.timestamp || '';
      return new Date(timeA).getTime() - new Date(timeB).getTime();
    });

    // Migrate messages for this thread
    for (const msg of messages) {
      const fields = msg.fields;
      const messageData: any = {
        record_id: recordId,
        thread_id: threadId,
        agent_id: fields.agentId || null,
        message: fields.message || '',
        role: fields.role || 'user',
        timestamp: fields.timestamp || fields.createdAt || new Date().toISOString(),
      };

      // Skip optional fields for now (message_type and read columns may not exist yet)
      // These can be added later via SQL migration

      const { error: msgError } = await supabase
        .from('chat_messages')
        .insert(messageData);

      if (msgError) {
        console.error(`⚠️  Failed to insert message:`, msgError.message);
      } else {
        totalMessagesMigrated++;
      }
    }
  }

  console.log(`✅ Migrated ${threadsMap.size} threads with ${totalMessagesMigrated} messages`);
}

/**
 * Migrate contacts
 */
async function migrateContacts(recordId: string): Promise<void> {
  console.log(`\n📇 Migrating contacts for user: ${recordId}...`);

  if (!AIRTABLE_CONTACTS_URL) {
    console.log('⚠️  Contacts table not configured, skipping...');
    return;
  }

  const allContacts = await fetchAllAirtableRecords(AIRTABLE_CONTACTS_URL);

  // Filter contacts for this user
  const userContacts = allContacts.filter((record: any) => {
    const recordIdField = record.fields?.recordId;
    if (Array.isArray(recordIdField)) {
      return recordIdField.includes(recordId) || 
             recordIdField.some((r: any) => (typeof r === 'string' ? r : r.id) === recordId);
    }
    return recordIdField === recordId;
  });

  console.log(`Found ${userContacts.length} contacts to migrate`);

  if (userContacts.length === 0) {
    console.log('No contacts to migrate');
    return;
  }

  let migratedCount = 0;
  for (const contact of userContacts) {
    const fields = contact.fields;
    const contactData: any = {
      record_id: recordId,
      name: fields.Name || fields.name || '',
      phone: fields.phone || null,
      email: fields.email || null,
      relationship: fields.relationship || null,
      last_contacted: fields.lastContacted || null,
      notes: fields.notes || null,
    };

    // Handle tags (may be comma-separated string or array)
    if (fields.tags) {
      if (Array.isArray(fields.tags)) {
        contactData.tags = fields.tags;
      } else if (typeof fields.tags === 'string') {
        contactData.tags = fields.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      }
    }

    const { error } = await supabase
      .from('contacts')
      .upsert(contactData, { onConflict: 'record_id,name' });

    if (error) {
      console.error(`⚠️  Failed to insert contact ${contactData.name}:`, error.message);
    } else {
      migratedCount++;
    }
  }

  console.log(`✅ Migrated ${migratedCount} contacts`);
}

/**
 * Migrate user patterns
 */
async function migratePatterns(recordId: string): Promise<void> {
  console.log(`\n🔄 Migrating patterns for user: ${recordId}...`);

  if (!AIRTABLE_PATTERNS_URL) {
    console.log('⚠️  Patterns table not configured, skipping...');
    return;
  }

  const allPatterns = await fetchAllAirtableRecords(AIRTABLE_PATTERNS_URL);

  const userPatterns = allPatterns.filter((record: any) => {
    const recordIdField = record.fields?.recordId;
    if (Array.isArray(recordIdField)) {
      return recordIdField.includes(recordId) || 
             recordIdField.some((r: any) => (typeof r === 'string' ? r : r.id) === recordId);
    }
    return recordIdField === recordId;
  });

  console.log(`Found ${userPatterns.length} patterns to migrate`);

  if (userPatterns.length === 0) {
    console.log('No patterns to migrate');
    return;
  }

  let migratedCount = 0;
  for (const pattern of userPatterns) {
    const fields = pattern.fields;
    let patternData: any;
    
    try {
      if (typeof fields.patternData === 'string') {
        patternData = JSON.parse(fields.patternData);
      } else if (fields.patternData) {
        patternData = fields.patternData;
      } else {
        patternData = {};
      }
    } catch (e) {
      console.warn(`⚠️  Failed to parse patternData for pattern ${pattern.id}, using empty object`);
      patternData = {};
    }

    const patternRecord: any = {
      record_id: recordId,
      pattern_type: fields.patternType || 'behavior',
      pattern_data: patternData,
      confidence: fields.confidence || 0.5,
      last_observed: fields.lastObserved || fields.createdAt || new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_patterns')
      .insert(patternRecord);

    if (error) {
      console.error(`⚠️  Failed to insert pattern:`, error.message);
    } else {
      migratedCount++;
    }
  }

  console.log(`✅ Migrated ${migratedCount} patterns`);
}

/**
 * Migrate user memories
 */
async function migrateMemories(recordId: string): Promise<void> {
  console.log(`\n🧠 Migrating memories for user: ${recordId}...`);

  if (!AIRTABLE_MEMORIES_URL) {
    console.log('⚠️  Memories table not configured, skipping...');
    return;
  }

  const allMemories = await fetchAllAirtableRecords(AIRTABLE_MEMORIES_URL);

  const userMemories = allMemories.filter((record: any) => {
    const recordIdField = record.fields?.recordId;
    if (Array.isArray(recordIdField)) {
      return recordIdField.includes(recordId) || 
             recordIdField.some((r: any) => (typeof r === 'string' ? r : r.id) === recordId);
    }
    return recordIdField === recordId;
  });

  console.log(`Found ${userMemories.length} memories to migrate`);

  if (userMemories.length === 0) {
    console.log('No memories to migrate');
    return;
  }

  let migratedCount = 0;
  for (const memory of userMemories) {
    const fields = memory.fields;
    const memoryRecord: any = {
      record_id: recordId,
      memory_type: fields.memoryType || 'fact',
      key: fields.key || '',
      value: fields.value || '',
      context: fields.context || null,
      importance: fields.importance || 'medium',
      expires_at: fields.expiresAt || null,
    };

    const { error } = await supabase
      .from('user_memories')
      .upsert(memoryRecord, { onConflict: 'record_id,key' });

    if (error) {
      console.error(`⚠️  Failed to insert memory:`, error.message);
    } else {
      migratedCount++;
    }
  }

  console.log(`✅ Migrated ${migratedCount} memories`);
}

/**
 * Main migration function
 */
async function migrateUserData(recordId: string) {
  console.log(`\n🚀 Starting migration for user: ${recordId}`);
  console.log('='.repeat(60));

  try {
    // Migrate in order (user first, then dependencies)
    await migrateUser(recordId);
    await migrateChatData(recordId);
    await migrateContacts(recordId);
    await migratePatterns(recordId);
    await migrateMemories(recordId);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration completed successfully!');
    console.log(`\nYour user ${recordId} is now in PostgreSQL and ready to use.`);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
const recordId = process.argv[2];

if (!recordId) {
  console.error('Usage: tsx scripts/migrate-airtable-to-postgres.ts <recordId>');
  console.error('Example: tsx scripts/migrate-airtable-to-postgres.ts recDlJgYuwuaxYcoM');
  process.exit(1);
}

migrateUserData(recordId)
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });

