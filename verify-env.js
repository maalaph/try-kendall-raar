/**
 * Quick verification script to check if environment variables are loaded
 * Run this after starting your dev server to verify .env.local is working
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const requiredEnvVars = {
  AIRTABLE_API_KEY: 'Your Airtable Personal Access Token',
  AIRTABLE_BASE_ID: 'appRzrock4whokZZ7',
  AIRTABLE_TABLE_ID: 'tblEXG9wp3Dm3nPte',
  AIRTABLE_SCHEDULED_CALLS_TABLE_ID: 'Scheduled Calls Table ID (for outbound calls)',
  VAPI_PRIVATE_KEY: 'Your Vapi Private Key',
  VAPI_DEFAULT_MODEL: 'gpt-4o',
  VAPI_COUNTRY: 'US'
};

const optionalEnvVars = {
  VAPI_WEBHOOK_URL: 'Ngrok webhook URL (e.g., https://your-domain.ngrok.app/api/vapi-webhook)',
  NEXT_PUBLIC_WEBHOOK_URL: 'Alternative webhook URL (if VAPI_WEBHOOK_URL not set)',
  SMS_WEBHOOK_URL: 'SMS webhook URL for Twilio',
  NEXT_PUBLIC_BASE_URL: 'Base URL for the application'
};

console.log('🔍 Verifying environment variables...\n');

let allPresent = true;
const missing = [];
const present = [];

for (const [key, expected] of Object.entries(requiredEnvVars)) {
  const value = process.env[key];
  if (value) {
    present.push(key);
    // Mask sensitive values
    const displayValue = key.includes('KEY') || key.includes('PRIVATE') 
      ? `${value.substring(0, 10)}...` 
      : value;
    console.log(`✅ ${key}: ${displayValue}`);
  } else {
    missing.push(key);
    allPresent = false;
    console.log(`❌ ${key}: MISSING (expected: ${expected})`);
  }
}

console.log('\n' + '='.repeat(50));

// Check optional variables
console.log('\n📋 Optional environment variables:');
let optionalPresent = [];
let optionalMissing = [];

for (const [key, description] of Object.entries(optionalEnvVars)) {
  const value = process.env[key];
  if (value) {
    optionalPresent.push(key);
    // Mask URLs but show domain
    let displayValue = value;
    if (value.includes('ngrok.app') || value.includes('http')) {
      try {
        const url = new URL(value);
        displayValue = `${url.protocol}//${url.host}${url.pathname.substring(0, 30)}...`;
      } catch (e) {
        displayValue = value.substring(0, 50) + '...';
      }
    }
    console.log(`✅ ${key}: ${displayValue}`);
  } else {
    optionalMissing.push(key);
    console.log(`⚠️  ${key}: NOT SET (${description})`);
  }
}

// Warn if webhook URL is missing
if (!process.env.VAPI_WEBHOOK_URL && !process.env.NEXT_PUBLIC_WEBHOOK_URL) {
  console.log('\n⚠️  WARNING: No webhook URL configured!');
  console.log('   VAPI functions will not work in real-time.');
  console.log('   Set VAPI_WEBHOOK_URL or NEXT_PUBLIC_WEBHOOK_URL in .env.local');
  console.log('   Example: VAPI_WEBHOOK_URL=https://your-domain.ngrok.app/api/vapi-webhook');
}

console.log('\n' + '='.repeat(50));

if (allPresent) {
  console.log('✅ All required environment variables are loaded!');
  if (optionalMissing.length > 0) {
    console.log(`⚠️  ${optionalMissing.length} optional variable(s) not set (see above)`);
  }
  console.log('\nYou can proceed with testing Steps 4-8.');
} else {
  console.log(`❌ Missing ${missing.length} required environment variable(s):`);
  missing.forEach(key => console.log(`   - ${key}`));
  console.log('\n⚠️  Make sure:');
  console.log('   1. .env.local exists in the project root');
  console.log('   2. All variables are defined without quotes');
  console.log('   3. Server was restarted after adding variables');
  process.exit(1);
}











