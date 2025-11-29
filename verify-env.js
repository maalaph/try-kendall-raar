/**
 * Quick verification script to check if environment variables are loaded
 * Run this after starting your dev server to verify .env.local is working
 */

const requiredEnvVars = {
  AIRTABLE_API_KEY: 'Your Airtable Personal Access Token',
  AIRTABLE_BASE_ID: 'appRzrock4whokZZ7',
  AIRTABLE_TABLE_ID: 'tblEXG9wp3Dm3nPte',
  VAPI_PRIVATE_KEY: 'Your Vapi Private Key',
  VAPI_DEFAULT_MODEL: 'gpt-4o',
  VAPI_COUNTRY: 'US'
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

if (allPresent) {
  console.log('✅ All environment variables are loaded!');
  console.log('\nYou can proceed with testing Steps 4-8.');
} else {
  console.log(`❌ Missing ${missing.length} environment variable(s):`);
  missing.forEach(key => console.log(`   - ${key}`));
  console.log('\n⚠️  Make sure:');
  console.log('   1. .env.local exists in the project root');
  console.log('   2. All variables are defined without quotes');
  console.log('   3. Server was restarted after adding variables');
  process.exit(1);
}








