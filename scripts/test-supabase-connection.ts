/**
 * Test Supabase Connection
 * 
 * This script tests both REST API and direct database connections
 * to help diagnose connection issues.
 */

import { createClient } from '@supabase/supabase-js';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testSupabaseConnection() {
  console.log('=== Supabase Connection Test ===\n');

  // Test 1: REST API Connection
  console.log('1. Testing Supabase REST API...');
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
    } else {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      const { data, error } = await supabase.from('users').select('count').limit(1);
      
      if (error && error.code === 'PGRST116') {
        console.log('✅ REST API: Connected (table may not exist yet)');
      } else if (error) {
        console.log('⚠️  REST API: Connected but error:', error.message);
      } else {
        console.log('✅ REST API: Connected successfully');
      }
    }
  } catch (err) {
    console.log('❌ REST API: Failed -', err instanceof Error ? err.message : String(err));
  }

  // Test 2: Direct Database Connection (Port 5432)
  console.log('\n2. Testing Direct Database Connection (Port 5432)...');
  try {
    if (!process.env.SUPABASE_DB_URL) {
      console.log('❌ SUPABASE_DB_URL not set');
    } else {
      const checkpointer = await PostgresSaver.fromConnString(process.env.SUPABASE_DB_URL);
      await checkpointer.setup();
      console.log('✅ Direct Connection: Connected successfully');
    }
  } catch (err) {
    console.log('❌ Direct Connection: Failed -', err instanceof Error ? err.message : String(err));
    
    // Test 3: Connection Pooler (Port 6543)
    console.log('\n3. Testing Connection Pooler (Port 6543)...');
    try {
      if (process.env.SUPABASE_DB_URL) {
        // Replace port 5432 with 6543 and add pgbouncer parameter
        const poolerUrl = process.env.SUPABASE_DB_URL.replace(':5432/', ':6543/') + '?pgbouncer=true';
        console.log('   Trying pooler URL...');
        
        const checkpointer = await PostgresSaver.fromConnString(poolerUrl);
        await checkpointer.setup();
        console.log('✅ Connection Pooler: Connected successfully');
        console.log('\n💡 Solution: Update SUPABASE_DB_URL to use port 6543:');
        console.log(`   ${poolerUrl.replace(/:[^:@]+@/, ':***@')}`);
      }
    } catch (poolerErr) {
      console.log('❌ Connection Pooler: Failed -', poolerErr instanceof Error ? poolerErr.message : String(poolerErr));
      console.log('\n💡 Troubleshooting:');
      console.log('   1. Check if Supabase project is active (not paused)');
      console.log('   2. Verify SUPABASE_DB_URL format is correct');
      console.log('   3. Check network connectivity');
      console.log('   4. Try: nslookup db.kwlkbuatidinolgfsxst.supabase.co');
    }
  }

  // Test 4: DNS Resolution
  console.log('\n4. Testing DNS Resolution...');
  const { execSync } = require('child_process');
  try {
    const hostname = process.env.SUPABASE_DB_URL?.match(/@([^:]+):/)?.[1];
    if (hostname) {
      const result = execSync(`nslookup ${hostname}`, { encoding: 'utf-8', timeout: 5000 });
      if (result.includes('Non-authoritative answer')) {
        console.log('✅ DNS: Resolved successfully');
      } else {
        console.log('⚠️  DNS: May have issues');
        console.log(result);
      }
    }
  } catch (err) {
    console.log('❌ DNS: Failed to resolve');
  }

  console.log('\n=== Test Complete ===');
}

testSupabaseConnection().catch(console.error);




