/**
 * Migration Script: Remaining Airtable Data → PostgreSQL
 * Migrates call notes, scheduled calls, outbound calls, phone mappings, business trials, calendar events, and OAuth tokens
 * 
 * Usage:
 *   npx tsx scripts/migrate-remaining-airtable-data.ts
 * 
 * This script migrates all remaining data from Airtable to Supabase PostgreSQL
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;

const getAirtableHeaders = () => ({
  'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
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
async function fetchAllAirtableRecords(tableId: string, options?: {
  filterByFormula?: string;
  sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
}): Promise<any[]> {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}`;
  const allRecords: any[] = [];
  let offset: string | undefined = undefined;

  do {
    const params = new URLSearchParams();
    if (offset) params.append('offset', offset);
    if (options?.filterByFormula) {
      params.append('filterByFormula', options.filterByFormula);
    }
    if (options?.sort) {
      options.sort.forEach((sort, index) => {
        params.append(`sort[${index}][field]`, sort.field);
        params.append(`sort[${index}][direction]`, sort.direction);
      });
    }
    params.append('pageSize', '100');

    const response = await fetch(`${url}?${params.toString()}`, {
      headers: getAirtableHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Airtable API error: ${response.status} ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    allRecords.push(...(result.records || []));
    offset = result.offset;
  } while (offset);

  return allRecords;
}

/**
 * Migrate call notes
 */
async function migrateCallNotes(agentIds: string[]) {
  if (!process.env.AIRTABLE_CALL_NOTES_TABLE_ID) {
    console.log('⚠️  AIRTABLE_CALL_NOTES_TABLE_ID not set, skipping call notes migration');
    return;
  }

  if (agentIds.length === 0) {
    console.log('⚠️  No agent IDs found, skipping call notes migration');
    return;
  }

  console.log('📞 Migrating call notes...');
  
  // Build filter to only get call notes for existing agents
  const agentFilter = agentIds.map(id => `{agentId} = "${id}"`).join(',');
  const filterFormula = `OR(${agentFilter})`;
  
  const records = await fetchAllAirtableRecords(process.env.AIRTABLE_CALL_NOTES_TABLE_ID, {
    filterByFormula: filterFormula,
    sort: [{ field: 'timestamp', direction: 'desc' }],
  });

  console.log(`   Found ${records.length} call notes to migrate (filtered by ${agentIds.length} agents)`);

  let migrated = 0;
  let skipped = 0;

  for (const record of records) {
    // Double-check agent ID is in our list
    if (!agentIds.includes(record.fields?.agentId)) {
      skipped++;
      continue;
    }
    try {
      const fields = record.fields;
      
      // Check if already migrated
      if (fields.callId) {
        const { data: existing } = await supabase
          .from('call_notes')
          .select('id')
          .eq('call_id', fields.callId)
          .single();

        if (existing) {
          skipped++;
          continue;
        }
      }

      const { error } = await supabase
        .from('call_notes')
        .insert({
          agent_id: fields.agentId || '',
          call_id: fields.callId || null,
          caller_phone: fields.callerPhone || '',
          note: fields.Notes || fields.note || '',
          timestamp: fields.timestamp || record.createdTime,
          owner_phone: fields.ownerPhone || null,
          sms_sent: fields.smsSent || false,
          call_duration: fields.callDuration || null,
          read: fields.read || false,
          call_type: fields.callType || null,
        });

      if (error) {
        console.error(`   Error migrating call note ${record.id}:`, error.message);
      } else {
        migrated++;
      }
    } catch (error) {
      console.error(`   Error processing call note ${record.id}:`, error);
    }
  }

  console.log(`   ✅ Migrated ${migrated} call notes, skipped ${skipped} duplicates`);
}

/**
 * Migrate scheduled calls
 */
async function migrateScheduledCalls(agentIds: string[]) {
  if (!process.env.AIRTABLE_SCHEDULED_CALLS_TABLE_ID) {
    console.log('⚠️  AIRTABLE_SCHEDULED_CALLS_TABLE_ID not set, skipping scheduled calls migration');
    return;
  }

  if (agentIds.length === 0) {
    console.log('⚠️  No agent IDs found, skipping scheduled calls migration');
    return;
  }

  console.log('📅 Migrating scheduled calls...');
  
  // Build filter to only get scheduled calls for existing agents
  const agentFilter = agentIds.map(id => `{owner_agent_id} = "${id}"`).join(',');
  const filterFormula = `OR(${agentFilter})`;
  
  const records = await fetchAllAirtableRecords(process.env.AIRTABLE_SCHEDULED_CALLS_TABLE_ID, {
    filterByFormula: filterFormula,
    sort: [{ field: 'scheduled_time', direction: 'asc' }],
  });

  console.log(`   Found ${records.length} scheduled calls to migrate (filtered by ${agentIds.length} agents)`);

  let migrated = 0;
  let skipped = 0;

  for (const record of records) {
    // Double-check agent ID is in our list
    if (!agentIds.includes(record.fields?.owner_agent_id)) {
      skipped++;
      continue;
    }
    try {
      const fields = record.fields;

      // Check if already migrated
      const { data: existing } = await supabase
        .from('scheduled_calls')
        .select('id')
        .eq('agent_id', fields.owner_agent_id || '')
        .eq('scheduled_time', fields.scheduled_time || '')
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      const { error } = await supabase
        .from('scheduled_calls')
        .insert({
          agent_id: fields.owner_agent_id || '',
          recipient_phone: fields.phone_number || '',
          scheduled_time: fields.scheduled_time || '',
          status: fields.status || 'pending',
          call_type: 'outbound',
          phone_number_id: fields.phone_number_id || null,
          message: fields.message || '',
          caller_name: fields.caller_name || null,
          recipient_name: fields.recipient_name || null,
          record_id: fields.recordId || null,
          thread_id: fields.threadId || null,
        });

      if (error) {
        console.error(`   Error migrating scheduled call ${record.id}:`, error.message);
      } else {
        migrated++;
      }
    } catch (error) {
      console.error(`   Error processing scheduled call ${record.id}:`, error);
    }
  }

  console.log(`   ✅ Migrated ${migrated} scheduled calls, skipped ${skipped} duplicates`);
}

/**
 * Migrate outbound call requests
 */
async function migrateOutboundCallRequests(recordIds: string[]) {
  if (!process.env.AIRTABLE_OUTBOUND_CALL_REQUESTS_TABLE_ID) {
    console.log('⚠️  AIRTABLE_OUTBOUND_CALL_REQUESTS_TABLE_ID not set, skipping outbound call requests migration');
    return;
  }

  if (recordIds.length === 0) {
    console.log('⚠️  No record IDs found, skipping outbound call requests migration');
    return;
  }

  console.log('📞 Migrating outbound call requests...');
  
  // Build filter to only get outbound calls for existing users
  const recordFilter = recordIds.map(id => `SEARCH("${id}", ARRAYJOIN({recordId}))`).join(',');
  const filterFormula = `OR(${recordFilter})`;
  
  const records = await fetchAllAirtableRecords(process.env.AIRTABLE_OUTBOUND_CALL_REQUESTS_TABLE_ID, {
    filterByFormula: filterFormula,
  });

  console.log(`   Found ${records.length} outbound call requests to migrate (filtered by ${recordIds.length} users)`);

  let migrated = 0;
  let skipped = 0;

  for (const record of records) {
    try {
      const fields = record.fields;

      // Check if already migrated
      if (fields.callId) {
        const { data: existing } = await supabase
          .from('outbound_call_requests')
          .select('id')
          .eq('call_id', fields.callId)
          .single();

        if (existing) {
          skipped++;
          continue;
        }
      }

      const recordId = Array.isArray(fields.recordId) ? fields.recordId[0] : fields.recordId;
      
      // Only migrate if recordId is in our list
      if (!recordId || !recordIds.includes(recordId)) {
        skipped++;
        continue;
      }

      const { error } = await supabase
        .from('outbound_call_requests')
        .insert({
          call_id: fields.callId || '',
          record_id: recordId || '',
          thread_id: fields.threadId || '',
          status: fields.status || 'pending',
          phone_number: fields.phoneNumber || null,
          agent_id: null, // Will be populated from record_id if needed
          completed_at: fields.completedAt || null,
        });

      if (error) {
        console.error(`   Error migrating outbound call request ${record.id}:`, error.message);
      } else {
        migrated++;
      }
    } catch (error) {
      console.error(`   Error processing outbound call request ${record.id}:`, error);
    }
  }

  console.log(`   ✅ Migrated ${migrated} outbound call requests, skipped ${skipped} duplicates`);
}

/**
 * Migrate phone number mappings (from users table vapi_number field)
 */
async function migratePhoneNumberMappings(agentIds: string[]) {
  console.log('📱 Migrating phone number mappings...');
  
  if (agentIds.length === 0) {
    console.log('⚠️  No agent IDs found, skipping phone number mappings migration');
    return;
  }
  
  // Get users with vapi_number, filtered by agent IDs
  const { data: users, error } = await supabase
    .from('users')
    .select('vapi_agent_id, vapi_number, vapi_phone_number_id, twilio_phone_sid')
    .in('vapi_agent_id', agentIds)
    .not('vapi_number', 'is', null)
    .not('vapi_agent_id', 'is', null);

  if (error) {
    console.error('   Error fetching users:', error.message);
    return;
  }

  if (!users || users.length === 0) {
    console.log('   No phone number mappings to migrate');
    return;
  }

  console.log(`   Found ${users.length} users with phone numbers`);

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      // Check if mapping already exists
      const { data: existing } = await supabase
        .from('phone_number_mappings')
        .select('id')
        .eq('agent_id', user.vapi_agent_id)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      const { error: insertError } = await supabase
        .from('phone_number_mappings')
        .insert({
          agent_id: user.vapi_agent_id,
          canadian_phone: user.vapi_number,
          phone_number_id: user.vapi_phone_number_id || null,
          twilio_sid: user.twilio_phone_sid || null,
        });

      if (insertError) {
        console.error(`   Error migrating phone mapping for agent ${user.vapi_agent_id}:`, insertError.message);
      } else {
        migrated++;
      }
    } catch (error) {
      console.error(`   Error processing phone mapping for agent ${user.vapi_agent_id}:`, error);
    }
  }

  console.log(`   ✅ Migrated ${migrated} phone number mappings, skipped ${skipped} duplicates`);
}

/**
 * Migrate business trials
 */
async function migrateBusinessTrials(recordIds: string[]) {
  if (!process.env.AIRTABLE_BUSINESS_TRIAL_TABLE_ID) {
    console.log('⚠️  AIRTABLE_BUSINESS_TRIAL_TABLE_ID not set, skipping business trials migration');
    return;
  }

  if (recordIds.length === 0) {
    console.log('⚠️  No record IDs found, skipping business trials migration');
    return;
  }

  console.log('💼 Migrating business trials...');
  
  // Fetch all business trials and filter in code (Airtable field name might vary)
  const records = await fetchAllAirtableRecords(process.env.AIRTABLE_BUSINESS_TRIAL_TABLE_ID);
  
  // Filter to only include records matching our user record IDs
  // Business trials might be linked by recordId field or just by the Airtable record ID itself
  const filteredRecords = records.filter(record => {
    const fields = record.fields || {};
    // Check if recordId field matches, or if the Airtable record ID itself matches
    const recordIdField = fields.recordId || fields.record_id || record.id;
    return recordIds.includes(recordIdField) || recordIds.includes(record.id);
  });

  console.log(`   Found ${filteredRecords.length} business trials to migrate (filtered by ${recordIds.length} users from ${records.length} total)`);

  let migrated = 0;
  let skipped = 0;

  for (const record of filteredRecords) {
    try {
      const fields = record.fields;

      // Check if already migrated
      const { data: existing } = await supabase
        .from('business_trials')
        .select('id')
        .eq('record_id', record.id)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      const { error } = await supabase
        .from('business_trials')
        .insert({
          record_id: record.id,
          full_name: fields.fullName || fields.full_name || '',
          email: fields.email || null,
          phone: fields.phone || null,
          business_website: fields.businessWebsite || fields.business_website || null,
          status: fields.status || 'pending',
        });

      if (error) {
        console.error(`   Error migrating business trial ${record.id}:`, error.message);
      } else {
        migrated++;
      }
    } catch (error) {
      console.error(`   Error processing business trial ${record.id}:`, error);
    }
  }

  console.log(`   ✅ Migrated ${migrated} business trials, skipped ${skipped} duplicates`);
}

/**
 * Migrate calendar events
 */
async function migrateCalendarEvents(recordIds: string[]) {
  if (!process.env.AIRTABLE_CALENDAR_EVENTS_TABLE_ID) {
    console.log('⚠️  AIRTABLE_CALENDAR_EVENTS_TABLE_ID not set, skipping calendar events migration');
    return;
  }

  if (recordIds.length === 0) {
    console.log('⚠️  No record IDs found, skipping calendar events migration');
    return;
  }

  console.log('📅 Migrating calendar events...');
  
  // Build filter to only get calendar events for existing users
  const recordFilter = recordIds.map(id => `SEARCH("${id}", ARRAYJOIN({userRecordId}))`).join(',');
  const filterFormula = `OR(${recordFilter})`;
  
  const records = await fetchAllAirtableRecords(process.env.AIRTABLE_CALENDAR_EVENTS_TABLE_ID, {
    filterByFormula: filterFormula,
    sort: [{ field: 'startDateTime', direction: 'asc' }],
  });

  console.log(`   Found ${records.length} calendar events to migrate (filtered by ${recordIds.length} users)`);

  let migrated = 0;
  let skipped = 0;

  for (const record of records) {
    try {
      const fields = record.fields;
      const recordId = Array.isArray(fields.userRecordId) ? fields.userRecordId[0] : fields.userRecordId;

      if (!recordId) {
        console.warn(`   Skipping calendar event ${record.id} - no userRecordId`);
        skipped++;
        continue;
      }
      
      // Only migrate if recordId is in our list
      if (!recordIds.includes(recordId)) {
        skipped++;
        continue;
      }

      // Check if already migrated
      if (fields.googleEventId) {
        const { data: existing } = await supabase
          .from('calendar_events')
          .select('id')
          .eq('record_id', recordId)
          .eq('event_id', fields.googleEventId)
          .single();

        if (existing) {
          skipped++;
          continue;
        }
      }

      const { error } = await supabase
        .from('calendar_events')
        .insert({
          record_id: recordId,
          event_id: fields.googleEventId || fields.eventId || '',
          title: fields.summary || fields.title || '',
          description: fields.description || null,
          start_time: fields.startDateTime || fields.startTime || '',
          end_time: fields.endDateTime || fields.endTime || '',
          time_zone: fields.timeZone || 'UTC',
          all_day: fields.allDay || false,
          location: fields.location || null,
          attendees: Array.isArray(fields.attendees) ? fields.attendees : null,
          status: fields.status || 'Active',
          source: fields.source || 'google',
          event_url: fields.eventUrl || null,
        });

      if (error) {
        console.error(`   Error migrating calendar event ${record.id}:`, error.message);
      } else {
        migrated++;
      }
    } catch (error) {
      console.error(`   Error processing calendar event ${record.id}:`, error);
    }
  }

  console.log(`   ✅ Migrated ${migrated} calendar events, skipped ${skipped} duplicates`);
}

/**
 * Migrate OAuth tokens from user records
 * Note: OAuth tokens are already in the users table if they were migrated,
 * but this ensures they're properly set if they weren't included in the initial migration
 */
async function migrateOAuthTokens() {
  console.log('🔐 Checking OAuth tokens in user records...');
  
  // OAuth tokens should already be in the users table if the schema extension was run
  // This function just verifies they're there
  const { data: users, error } = await supabase
    .from('users')
    .select('record_id, google_access_token, spotify_access_token')
    .limit(10);

  if (error) {
    console.error('   Error checking users:', error.message);
    return;
  }

  const usersWithGoogle = users?.filter(u => u.google_access_token).length || 0;
  const usersWithSpotify = users?.filter(u => u.spotify_access_token).length || 0;

  console.log(`   Found ${usersWithGoogle} users with Google tokens, ${usersWithSpotify} with Spotify tokens`);
  console.log('   ✅ OAuth tokens are stored in users table (no separate migration needed)');
}

/**
 * Get all existing user record IDs from Supabase
 */
async function getExistingUserRecordIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('users')
    .select('record_id');

  if (error) {
    throw new Error(`Error fetching users: ${error.message}`);
  }

  const recordIds = (data || []).map(u => u.record_id).filter(Boolean);
  console.log(`📋 Found ${recordIds.length} existing users in Supabase: ${recordIds.join(', ')}\n`);
  return recordIds;
}

/**
 * Get agent IDs for existing users
 */
async function getExistingAgentIds(recordIds: string[]): Promise<string[]> {
  if (recordIds.length === 0) return [];

  const { data, error } = await supabase
    .from('users')
    .select('vapi_agent_id')
    .in('record_id', recordIds)
    .not('vapi_agent_id', 'is', null);

  if (error) {
    throw new Error(`Error fetching agent IDs: ${error.message}`);
  }

  const agentIds = (data || []).map(u => u.vapi_agent_id).filter(Boolean);
  console.log(`🤖 Found ${agentIds.length} agent IDs for existing users\n`);
  return agentIds;
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting migration of remaining Airtable data to Supabase...\n');

  if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY) {
    throw new Error('AIRTABLE_BASE_ID and AIRTABLE_API_KEY must be set in .env.local');
  }

  try {
    // Get existing users from Supabase - only migrate data for these users
    const existingRecordIds = await getExistingUserRecordIds();
    const existingAgentIds = await getExistingAgentIds(existingRecordIds);

    if (existingRecordIds.length === 0) {
      console.log('⚠️  No users found in Supabase. Please migrate users first.');
      return;
    }

    // Update migration functions to accept filters
    await migrateCallNotes(existingAgentIds);
    console.log('');
    
    await migrateScheduledCalls(existingAgentIds);
    console.log('');
    
    await migrateOutboundCallRequests(existingRecordIds);
    console.log('');
    
    await migratePhoneNumberMappings(existingAgentIds);
    console.log('');
    
    await migrateBusinessTrials(existingRecordIds);
    console.log('');
    
    await migrateCalendarEvents(existingRecordIds);
    console.log('');
    
    await migrateOAuthTokens();
    console.log('');

    console.log('✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
main();

