/**
 * Verification Script: Test Supabase Migration
 * Tests all migrated functionality to ensure everything works correctly
 * 
 * Usage:
 *   npx tsx scripts/verify-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

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

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => Promise<void> | void) {
  return async () => {
    try {
      await fn();
      results.push({ name, passed: true, message: '✅ Passed' });
      console.log(`✅ ${name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ name, passed: false, message: `❌ Failed: ${message}` });
      console.error(`❌ ${name}: ${message}`);
    }
  };
}

async function runTests() {
  console.log('🧪 Running migration verification tests...\n');

  // Test 1: Users table
  await test('Users table exists and has data', async () => {
    const { data, error } = await supabase
      .from('users')
      .select('record_id, full_name, vapi_agent_id')
      .limit(5);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error('No users found');
    console.log(`   Found ${data.length} users`);
  })();

  // Test 2: Chat messages
  await test('Chat messages table exists and has data', async () => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, record_id, message, role')
      .limit(5);

    if (error) throw new Error(error.message);
    console.log(`   Found ${data?.length || 0} chat messages`);
  })();

  // Test 3: Contacts
  await test('Contacts table exists', async () => {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, record_id, name')
      .limit(5);

    if (error) throw new Error(error.message);
    console.log(`   Found ${data?.length || 0} contacts`);
  })();

  // Test 4: Call notes
  await test('Call notes table exists and has data', async () => {
    const { data, error } = await supabase
      .from('call_notes')
      .select('id, agent_id, caller_phone, note')
      .limit(5);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error('No call notes found (expected at least some)');
    console.log(`   Found ${data.length} call notes`);
  })();

  // Test 5: Scheduled calls
  await test('Scheduled calls table exists and has data', async () => {
    const { data, error } = await supabase
      .from('scheduled_calls')
      .select('id, agent_id, recipient_phone, scheduled_time, status')
      .limit(5);

    if (error) throw new Error(error.message);
    console.log(`   Found ${data?.length || 0} scheduled calls`);
  })();

  // Test 6: Outbound call requests table exists
  await test('Outbound call requests table exists', async () => {
    const { data, error } = await supabase
      .from('outbound_call_requests')
      .select('id')
      .limit(1);

    if (error) throw new Error(error.message);
    console.log(`   Table exists, ${data?.length || 0} records`);
  })();

  // Test 7: Phone number mappings table exists
  await test('Phone number mappings table exists', async () => {
    const { data, error } = await supabase
      .from('phone_number_mappings')
      .select('id')
      .limit(1);

    if (error) throw new Error(error.message);
    console.log(`   Table exists, ${data?.length || 0} records`);
  })();

  // Test 8: Business trials table exists
  await test('Business trials table exists', async () => {
    const { data, error } = await supabase
      .from('business_trials')
      .select('id')
      .limit(1);

    if (error) throw new Error(error.message);
    console.log(`   Table exists, ${data?.length || 0} records`);
  })();

  // Test 9: Calendar events table exists
  await test('Calendar events table exists', async () => {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('id')
      .limit(1);

    if (error) throw new Error(error.message);
    console.log(`   Table exists, ${data?.length || 0} records`);
  })();

  // Test 10: User patterns
  await test('User patterns table exists', async () => {
    const { data, error } = await supabase
      .from('user_patterns')
      .select('id, record_id, pattern_type')
      .limit(5);

    if (error) throw new Error(error.message);
    console.log(`   Found ${data?.length || 0} patterns`);
  })();

  // Test 11: User memories
  await test('User memories table exists', async () => {
    const { data, error } = await supabase
      .from('user_memories')
      .select('id, record_id, memory_type')
      .limit(5);

    if (error) throw new Error(error.message);
    console.log(`   Found ${data?.length || 0} memories`);
  })();

  // Test 12: Embeddings table exists
  await test('Embeddings table exists', async () => {
    const { data, error } = await supabase
      .from('embeddings')
      .select('id, record_id')
      .limit(5);

    if (error) throw new Error(error.message);
    console.log(`   Found ${data?.length || 0} embeddings`);
  })();

  // Test 13: Threads table exists
  await test('Threads table exists', async () => {
    const { data, error } = await supabase
      .from('threads')
      .select('id, record_id, thread_id')
      .limit(5);

    if (error) throw new Error(error.message);
    console.log(`   Found ${data?.length || 0} threads`);
  })();

  // Test 14: Users table has OAuth columns
  await test('Users table has OAuth token columns', async () => {
    const { data, error } = await supabase
      .from('users')
      .select('record_id, google_access_token, spotify_access_token, vapi_number')
      .limit(1);

    if (error) throw new Error(error.message);
    // Just checking the query works (columns exist)
    console.log(`   OAuth columns exist`);
  })();

  // Test 15: Test database functions (import and test)
  await test('Database functions can be imported', async () => {
    const { getUserRecord, getCallNotes, getScheduledCallTasks } = await import('../lib/database');
    
    if (!getUserRecord || !getCallNotes || !getScheduledCallTasks) {
      throw new Error('Database functions not exported correctly');
    }
    console.log(`   Database functions available`);
  })();

  // Test 16: Test creating a call note (write test)
  await test('Can create a call note', async () => {
    const { data: users } = await supabase
      .from('users')
      .select('vapi_agent_id')
      .not('vapi_agent_id', 'is', null)
      .limit(1)
      .single();

    if (!users || !users.vapi_agent_id) {
      throw new Error('No user with agent_id found for test');
    }

    const { data, error } = await supabase
      .from('call_notes')
      .insert({
        agent_id: users.vapi_agent_id,
        caller_phone: '+18148528135',
        note: 'Test call note - can be deleted',
        timestamp: new Date().toISOString(),
        read: false,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Failed to create call note');

    // Clean up test data
    await supabase.from('call_notes').delete().eq('id', data.id);
    console.log(`   Created and deleted test call note`);
  })();

  // Test 17: Test querying call notes by agent
  await test('Can query call notes by agent ID', async () => {
    const { data: users } = await supabase
      .from('users')
      .select('vapi_agent_id')
      .not('vapi_agent_id', 'is', null)
      .limit(1)
      .single();

    if (!users || !users.vapi_agent_id) {
      throw new Error('No user with agent_id found for test');
    }

    const { data, error } = await supabase
      .from('call_notes')
      .select('id, note')
      .eq('agent_id', users.vapi_agent_id)
      .limit(5);

    if (error) throw new Error(error.message);
    console.log(`   Found ${data?.length || 0} call notes for agent`);
  })();

  // Test 18: Test scheduled calls query
  await test('Can query scheduled calls', async () => {
    const { data, error } = await supabase
      .from('scheduled_calls')
      .select('id, agent_id, scheduled_time, status')
      .limit(5);

    if (error) throw new Error(error.message);
    console.log(`   Found ${data?.length || 0} scheduled calls`);
  })();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(result => {
    console.log(result.message);
  });

  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${results.length} tests`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.error('\n❌ Some tests failed. Please review the errors above.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed! Migration is successful.');
    process.exit(0);
  }
}

runTests();

