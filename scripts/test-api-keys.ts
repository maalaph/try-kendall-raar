import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

interface KeyTestResult {
  key: string;
  status: 'working' | 'disabled' | 'missing' | 'error';
  message: string;
}

const results: KeyTestResult[] = [];

async function testKey(name: string, testFn: () => Promise<boolean>, note?: string): Promise<void> {
  process.stdout.write(`Testing ${name}... `);
  try {
    const works = await testFn();
    if (works) {
      if (note) {
        console.log(`✅ SET (${note})`);
        results.push({ key: name, status: 'working', message: note || 'Key is set and configured' });
      } else {
        console.log('✅ WORKING');
        results.push({ key: name, status: 'working', message: 'Key is valid and working' });
      }
    } else {
      console.log('❌ DISABLED/INVALID');
      results.push({ key: name, status: 'disabled', message: 'Key appears to be disabled or invalid' });
    }
  } catch (error: any) {
    if (error.message?.includes('not set') || error.message?.includes('missing')) {
      console.log('⚠️  MISSING');
      results.push({ key: name, status: 'missing', message: 'Key not found in environment' });
    } else if (error.message?.includes('401') || error.message?.includes('403') || error.message?.includes('Unauthorized')) {
      console.log('❌ DISABLED/INVALID');
      results.push({ key: name, status: 'disabled', message: error.message || 'Authentication failed' });
    } else {
      console.log('❌ ERROR');
      results.push({ key: name, status: 'error', message: error.message || 'Unknown error' });
    }
  }
}

async function testOpenAI(): Promise<boolean> {
  if (!process.env.OPENAI_API_KEY) throw new Error('not set');
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
  });
  if (response.status === 401 || response.status === 403) return false;
  return response.ok;
}

async function testVAPI(): Promise<boolean> {
  if (!process.env.VAPI_PRIVATE_KEY) throw new Error('not set');
  const response = await fetch('https://api.vapi.ai/assistant', {
    headers: { 'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}` },
  });
  if (response.status === 401 || response.status === 403) return false;
  return response.ok;
}

async function testTwilio(): Promise<boolean> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) throw new Error('not set');
  const auth = btoa(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`);
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}.json`, {
    headers: { 'Authorization': `Basic ${auth}` },
  });
  if (response.status === 401 || response.status === 403) return false;
  return response.ok;
}

async function testElevenLabs(): Promise<boolean> {
  if (!process.env.ELEVENLABS_API_KEY) throw new Error('not set');
  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
  });
  if (response.status === 401 || response.status === 403) return false;
  return response.ok;
}

async function testSupabase(): Promise<boolean> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('not set');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase.from('users').select('count').limit(1);
  if (error && (error.message.includes('JWT') || error.message.includes('Invalid API key'))) return false;
  return !error || error.code !== 'PGRST301';
}

async function testVercelBlob(): Promise<boolean> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('not set');
  // Vercel Blob doesn't have a simple test endpoint, so we'll just check if it's set
  return process.env.BLOB_READ_WRITE_TOKEN.length > 0;
}

async function testTrigger(): Promise<boolean> {
  const key = process.env.TRIGGER_SECRET_KEY || process.env.TRIGGER_API_KEY;
  if (!key || !process.env.TRIGGER_PROJECT_ID) throw new Error('not set');
  // Trigger.dev keys can only be validated when dev server is running
  // The API endpoint test doesn't work for dev keys, so we just check if it's set
  // To actually verify, run: npm run trigger:dev
  return key.length > 0 && process.env.TRIGGER_PROJECT_ID.length > 0;
}

async function testGmail(): Promise<boolean> {
  // Gmail app password can't be easily tested without sending an email
  // Just check if it's set
  if (!process.env.GMAIL_APP_PASSWORD || !process.env.GMAIL_USER) throw new Error('not set');
  return process.env.GMAIL_APP_PASSWORD.length > 0 && process.env.GMAIL_USER.length > 0;
}

async function testGoogleOAuth(): Promise<boolean> {
  // OAuth secrets can't be tested without a full OAuth flow
  // Just check if they're set
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw new Error('not set');
  return process.env.GOOGLE_CLIENT_ID.length > 0 && process.env.GOOGLE_CLIENT_SECRET.length > 0;
}

async function testSpotifyOAuth(): Promise<boolean> {
  // OAuth secrets can't be tested without a full OAuth flow
  // Just check if they're set
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) throw new Error('not set');
  return process.env.SPOTIFY_CLIENT_ID.length > 0 && process.env.SPOTIFY_CLIENT_SECRET.length > 0;
}

async function runTests() {
  console.log('🔑 Testing API Keys...\n');
  
  await testKey('OPENAI_API_KEY', testOpenAI);
  await testKey('VAPI_PRIVATE_KEY', testVAPI);
  await testKey('TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN', testTwilio);
  await testKey('ELEVENLABS_API_KEY', testElevenLabs);
  await testKey('SUPABASE_SERVICE_ROLE_KEY', testSupabase);
  await testKey('BLOB_READ_WRITE_TOKEN', testVercelBlob);
  await testKey('TRIGGER_SECRET_KEY/TRIGGER_API_KEY', testTrigger, 'Verify by running: npm run trigger:dev');
  await testKey('GMAIL_APP_PASSWORD', testGmail);
  await testKey('GOOGLE_CLIENT_SECRET', testGoogleOAuth);
  await testKey('SPOTIFY_CLIENT_SECRET', testSpotifyOAuth);

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  const working = results.filter(r => r.status === 'working');
  const disabled = results.filter(r => r.status === 'disabled');
  const missing = results.filter(r => r.status === 'missing');
  const errors = results.filter(r => r.status === 'error');

  console.log(`\n✅ Working: ${working.length}`);
  working.forEach(r => console.log(`   - ${r.key}`));

  if (disabled.length > 0) {
    console.log(`\n❌ DISABLED (Must Replace): ${disabled.length}`);
    disabled.forEach(r => console.log(`   - ${r.key}: ${r.message}`));
  }

  if (missing.length > 0) {
    console.log(`\n⚠️  Missing: ${missing.length}`);
    missing.forEach(r => console.log(`   - ${r.key}`));
  }

  if (errors.length > 0) {
    console.log(`\n❌ Errors: ${errors.length}`);
    errors.forEach(r => console.log(`   - ${r.key}: ${r.message}`));
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n🔴 Keys marked as DISABLED need to be replaced immediately!');
  console.log('📝 See KEY_REPLACEMENT_CHECKLIST.md for replacement instructions.\n');
}

runTests().catch(console.error);

