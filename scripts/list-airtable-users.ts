/**
 * List all users from Airtable to find record IDs for migration
 */

import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const AIRTABLE_API_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`;

const getHeaders = () => ({
  'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json',
});

async function listAllUsers() {
  try {
    const allRecords: any[] = [];
    let offset: string | undefined = undefined;

    do {
      const url = offset ? `${AIRTABLE_API_URL}?offset=${offset}` : AIRTABLE_API_URL;
      const response = await fetch(url, {
        method: 'GET',
        headers: getHeaders(),
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

    console.log(`\n📋 Found ${allRecords.length} users in Airtable:\n`);
    console.log('='.repeat(80));
    
    for (const record of allRecords) {
      const fields = record.fields;
      console.log(`\nRecord ID: ${record.id}`);
      console.log(`  Name: ${fields.fullName || 'N/A'}`);
      console.log(`  Email: ${fields.email || 'N/A'}`);
      console.log(`  Phone: ${fields.mobileNumber || 'N/A'}`);
      console.log(`  Agent ID: ${fields.vapi_agent_id || 'N/A'}`);
      console.log('-'.repeat(80));
    }
    
    console.log(`\n✅ Total: ${allRecords.length} users\n`);
    console.log('To migrate a user, run:');
    console.log(`  npx tsx scripts/migrate-airtable-to-postgres.ts <recordId>\n`);
    
    return allRecords;
  } catch (error) {
    console.error('❌ Error listing users:', error);
    throw error;
  }
}

listAllUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

