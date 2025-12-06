/**
 * Fix schema and re-migrate messages for a user
 * Run the SQL migration first, then this script
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
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

const AIRTABLE_CHAT_MESSAGES_URL = process.env.AIRTABLE_CHAT_MESSAGES_TABLE_ID
  ? `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_CHAT_MESSAGES_TABLE_ID}`
  : '';

const getAirtableHeaders = () => ({
  'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json',
});

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
    
    if (offset) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  } while (offset);

  return allRecords;
}

async function remigrateMessages(recordId: string) {
  console.log(`\n🔄 Re-migrating messages for user: ${recordId}...`);

  if (!AIRTABLE_CHAT_MESSAGES_URL) {
    console.log('⚠️  Chat messages table not configured');
    return;
  }

  // Delete existing messages for this user
  const { error: deleteError } = await supabase
    .from('chat_messages')
    .delete()
    .eq('record_id', recordId);

  if (deleteError) {
    console.error('⚠️  Failed to delete existing messages:', deleteError.message);
  } else {
    console.log('✅ Deleted existing messages');
  }

  // Fetch all messages from Airtable
  console.log('Fetching all chat messages from Airtable...');
  const allMessages = await fetchAllAirtableRecords(AIRTABLE_CHAT_MESSAGES_URL);

  // Filter messages for this user
  const userMessages = allMessages.filter((record: any) => {
    const recordIdField = record.fields?.recordId;
    if (Array.isArray(recordIdField)) {
      return recordIdField.includes(recordId) || 
             recordIdField.some((r: any) => (typeof r === 'string' ? r : r.id) === recordId);
    }
    return recordIdField === recordId;
  });

  console.log(`Found ${userMessages.length} messages to migrate`);

  // Group by thread
  const threadsMap = new Map<string, any[]>();
  for (const msg of userMessages) {
    const threadId = msg.fields?.threadId;
    if (!threadId) continue;

    if (!threadsMap.has(threadId)) {
      threadsMap.set(threadId, []);
    }
    threadsMap.get(threadId)!.push(msg);
  }

  // Migrate messages
  let totalMessagesMigrated = 0;
  for (const [threadId, messages] of threadsMap.entries()) {
    // Ensure thread exists
    await supabase
      .from('threads')
      .upsert({
        record_id: recordId,
        thread_id: threadId,
      }, { onConflict: 'thread_id' });

    // Sort messages
    messages.sort((a, b) => {
      const timeA = a.fields?.createdAt || a.fields?.timestamp || '';
      const timeB = b.fields?.createdAt || b.fields?.timestamp || '';
      return new Date(timeA).getTime() - new Date(timeB).getTime();
    });

    // Migrate messages
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

  console.log(`✅ Re-migrated ${totalMessagesMigrated} messages across ${threadsMap.size} threads`);
}

const recordId = process.argv[2] || 'recDlJgYuwuaxYcoM';

console.log('\n⚠️  IMPORTANT: Make sure you\'ve run the SQL migration first!');
console.log('   Run this in Supabase SQL Editor:');
console.log('   ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT \'text\';');
console.log('   ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;');
console.log('\nPress Enter to continue...');

remigrateMessages(recordId)
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });

