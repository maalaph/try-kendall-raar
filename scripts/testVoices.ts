/**
 * Voice Testing Script
 * Tests all voices against an existing VAPI agent to identify which ones fail
 * with "Couldn't Find 11labs Voice" error
 * 
 * Usage: npm run test:voices [recordId] [agentId]
 * Example: npm run test:voices recds1LsfJJP1XDCL
 */

// Load environment variables from .env.local
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.warn('[WARN] .env.local not found. Make sure environment variables are set.');
}

import { getUserRecord } from '../lib/airtable';
import { initializeVoiceLibrary, getAllCuratedVoices, CuratedVoice } from '../lib/voiceLibrary';
import { getVoiceConfigForVAPI } from '../lib/voiceConfigHelper';

const VAPI_API_URL = 'https://api.vapi.ai';

interface TestResult {
  voiceId: string;
  voiceName: string;
  elevenLabsVoiceId?: string;
  success: boolean;
  error?: string;
  errorMessage?: string;
}

interface TestReport {
  timestamp: string;
  agentId: string;
  originalVoice?: {
    provider: string;
    voiceId: string;
  };
  totalTested: number;
  successful: number;
  failed: number;
  results: TestResult[];
}

const getHeaders = () => {
  const apiKey = process.env.VAPI_PRIVATE_KEY;
  
  if (!apiKey) {
    throw new Error('VAPI_PRIVATE_KEY environment variable is not configured');
  }
  
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
};

/**
 * Get current agent configuration from VAPI
 */
async function getAgentConfig(agentId: string): Promise<any> {
  const response = await fetch(`${VAPI_API_URL}/assistant/${agentId}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to get agent config: ${errorData.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Update agent with a specific voice (minimal update - just voice)
 */
async function updateAgentVoice(
  agentId: string,
  voiceConfig: { provider: '11labs' | 'vapi'; voiceId: string },
  originalAgentConfig: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // Create minimal update request - only update voice, keep everything else the same
    const requestBody: any = {
      voice: voiceConfig,
    };

    const response = await fetch(`${VAPI_API_URL}/assistant/${agentId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || response.statusText;
      
      // Check if it's the specific error we're looking for
      if (errorMessage.includes("Couldn't Find 11labs Voice") || 
          errorMessage.includes("Couldn't find 11labs voice") ||
          errorMessage.includes("Couldn't Find 11labs voice")) {
        return {
          success: false,
          error: 'VOICE_NOT_FOUND',
          errorMessage: errorMessage,
        };
      }
      
      return {
        success: false,
        error: 'UPDATE_FAILED',
        errorMessage: errorMessage,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: 'EXCEPTION',
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Restore original voice configuration
 */
async function restoreOriginalVoice(
  agentId: string,
  originalVoiceConfig: { provider: string; voiceId: string } | null
): Promise<void> {
  if (!originalVoiceConfig) {
    console.warn('[WARN] No original voice config to restore');
    return;
  }

  try {
    const requestBody: any = {
      voice: {
        provider: originalVoiceConfig.provider === '11labs' ? '11labs' : 'vapi',
        voiceId: originalVoiceConfig.voiceId,
      },
    };

    const response = await fetch(`${VAPI_API_URL}/assistant/${agentId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[ERROR] Failed to restore original voice:', errorData.message || response.statusText);
      throw new Error(`Failed to restore voice: ${errorData.message || response.statusText}`);
    }

    console.log('[SUCCESS] Original voice restored');
  } catch (error) {
    console.error('[ERROR] Exception restoring original voice:', error);
    throw error;
  }
}

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test a single voice
 */
async function testVoice(
  voice: CuratedVoice,
  agentId: string,
  originalVoiceConfig: { provider: string; voiceId: string } | null
): Promise<TestResult> {
  // Skip VAPI voices - they should always work
  if (voice.source === 'vapi') {
    return {
      voiceId: voice.id,
      voiceName: voice.name,
      success: true,
      error: 'SKIPPED',
      errorMessage: 'VAPI voices not tested (assumed to work)',
    };
  }

  // Only test ElevenLabs voices
  if (!voice.elevenLabsVoiceId) {
    return {
      voiceId: voice.id,
      voiceName: voice.name,
      success: false,
      error: 'NO_VOICE_ID',
      errorMessage: 'No ElevenLabs voice ID found',
    };
  }

  // Get voice config for VAPI
  const voiceConfig = await getVoiceConfigForVAPI(voice.id);
  if (!voiceConfig) {
    return {
      voiceId: voice.id,
      voiceName: voice.name,
      elevenLabsVoiceId: voice.elevenLabsVoiceId,
      success: false,
      error: 'NO_CONFIG',
      errorMessage: 'Could not generate voice config',
    };
  }

  try {
    // Test the voice
    const testResult = await updateAgentVoice(agentId, voiceConfig, null);
    
    // Immediately restore original voice
    await restoreOriginalVoice(agentId, originalVoiceConfig);
    
    // Small delay to avoid rate limits
    await delay(1500);

    return {
      voiceId: voice.id,
      voiceName: voice.name,
      elevenLabsVoiceId: voice.elevenLabsVoiceId,
      success: testResult.success,
      error: testResult.error,
      errorMessage: testResult.errorMessage,
    };
  } catch (error) {
    // Try to restore original voice even if test failed
    try {
      await restoreOriginalVoice(agentId, originalVoiceConfig);
    } catch (restoreError) {
      console.error('[CRITICAL] Failed to restore voice after test failure:', restoreError);
    }

    return {
      voiceId: voice.id,
      voiceName: voice.name,
      elevenLabsVoiceId: voice.elevenLabsVoiceId,
      success: false,
      error: 'TEST_EXCEPTION',
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate CSV report
 */
function generateCSVReport(report: TestReport): string {
  const lines: string[] = [
    'Voice ID,Voice Name,ElevenLabs Voice ID,Status,Error,Error Message',
  ];

  for (const result of report.results) {
    const status = result.success ? 'SUCCESS' : 'FAILED';
    const error = result.error || '';
    const errorMsg = result.errorMessage ? `"${result.errorMessage.replace(/"/g, '""')}"` : '';
    const voiceId = result.elevenLabsVoiceId || '';
    
    lines.push(
      `"${result.voiceId}","${result.voiceName.replace(/"/g, '""')}","${voiceId}",${status},"${error}",${errorMsg}`
    );
  }

  return lines.join('\n');
}

/**
 * Generate JSON report
 */
function generateJSONReport(report: TestReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Print console summary
 */
function printSummary(report: TestReport): void {
  console.log('\n' + '='.repeat(80));
  console.log('VOICE TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Agent ID: ${report.agentId}`);
  if (report.originalVoice) {
    console.log(`Original Voice: ${report.originalVoice.provider} - ${report.originalVoice.voiceId}`);
  }
  console.log(`Total Tested: ${report.totalTested}`);
  console.log(`Successful: ${report.successful} (${Math.round((report.successful / report.totalTested) * 100)}%)`);
  console.log(`Failed: ${report.failed} (${Math.round((report.failed / report.totalTested) * 100)}%)`);
  
  const failedVoices = report.results.filter(r => !r.success && r.error === 'VOICE_NOT_FOUND');
  if (failedVoices.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log(`VOICES THAT FAILED WITH "Couldn't Find 11labs Voice" ERROR (${failedVoices.length}):`);
    console.log('-'.repeat(80));
    for (const voice of failedVoices) {
      console.log(`  - ${voice.voiceName} (${voice.voiceId})`);
      if (voice.elevenLabsVoiceId) {
        console.log(`    ElevenLabs ID: ${voice.elevenLabsVoiceId}`);
      }
      if (voice.errorMessage) {
        console.log(`    Error: ${voice.errorMessage}`);
      }
    }
  }

  const otherFailures = report.results.filter(r => !r.success && r.error !== 'VOICE_NOT_FOUND');
  if (otherFailures.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log(`OTHER FAILURES (${otherFailures.length}):`);
    console.log('-'.repeat(80));
    for (const voice of otherFailures) {
      console.log(`  - ${voice.voiceName} (${voice.voiceId}): ${voice.error || 'Unknown error'}`);
    }
  }

  const successful = report.results.filter(r => r.success);
  if (successful.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log(`SUCCESSFUL VOICES (${successful.length}):`);
    console.log('-'.repeat(80));
    console.log(`  All ${successful.length} voices passed the test!`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Main test function
 */
async function main() {
  try {
    console.log('Starting voice testing script...\n');

    // Validate required environment variables
    const requiredEnvVars = ['VAPI_PRIVATE_KEY', 'AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID', 'AIRTABLE_TABLE_ID', 'ELEVENLABS_API_KEY'];
    const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
    
    if (missingEnvVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}\nMake sure .env.local exists and contains all required variables.`);
    }

    // Get agent ID from command line arguments
    // Usage: npm run test:voices [agentId] OR npm run test:voices [recordId] [agentId]
    const firstArg = process.argv[2];
    const secondArg = process.argv[3];
    
    let agentId: string | undefined;
    let recordId: string | undefined;

    // Check if first argument is an agent ID (contains hyphens, typical UUID format)
    if (firstArg && firstArg.includes('-') && firstArg.length > 30) {
      agentId = firstArg;
      console.log(`Using agent ID directly: ${agentId}\n`);
    } else if (firstArg) {
      // First arg is a record ID, try to get agent ID from Airtable
      recordId = firstArg;
      agentId = secondArg; // Optional override
      
      console.log(`Using Airtable record ID: ${recordId}`);
      console.log('Fetching user record from Airtable...');
      
      try {
        const userRecord = await getUserRecord(recordId);
        agentId = agentId || userRecord.fields.vapi_agent_id;
        console.log(`Found agent ID from Airtable: ${agentId}\n`);
      } catch (error) {
        console.error('[WARN] Failed to fetch from Airtable:', error instanceof Error ? error.message : error);
        if (!agentId) {
          throw new Error('Failed to get agent ID from Airtable. Please provide agent ID directly as first argument.');
        }
        console.log(`Using provided agent ID: ${agentId}\n`);
      }
    } else {
      // No arguments - try to use agent ID from terminal logs
      agentId = 'f6c6123b-8f88-43b7-a507-9a3e1f3d20a4';
      console.log(`No arguments provided. Using default agent ID from terminal logs: ${agentId}\n`);
    }

    if (!agentId) {
      throw new Error('No agent ID found. Usage: npm run test:voices [agentId] OR npm run test:voices [recordId] [agentId]');
    }

    // Get current agent configuration
    console.log('Fetching current agent configuration...');
    const agentConfig = await getAgentConfig(agentId);
    const originalVoice = agentConfig.voice || null;

    if (originalVoice) {
      console.log(`Current voice: ${originalVoice.provider} - ${originalVoice.voiceId}\n`);
    } else {
      console.log('No current voice found (will skip restoration if needed)\n');
    }

    // Initialize voice library
    console.log('Loading voice library...');
    let voices = getAllCuratedVoices();
    if (voices.length === 0) {
      voices = await initializeVoiceLibrary();
    }
    console.log(`Loaded ${voices.length} voices\n`);

    // Filter to only ElevenLabs voices
    const elevenLabsVoices = voices.filter(v => v.source === 'elevenlabs' && v.elevenLabsVoiceId);
    console.log(`Testing ${elevenLabsVoices.length} ElevenLabs voices (VAPI voices skipped)...\n`);

    // Test each voice
    const results: TestResult[] = [];
    let currentIndex = 0;

    for (const voice of elevenLabsVoices) {
      currentIndex++;
      const progress = `[${currentIndex}/${elevenLabsVoices.length}]`;
      console.log(`${progress} Testing: ${voice.name} (${voice.id})...`);

      const result = await testVoice(voice, agentId, originalVoice);
      results.push(result);

      if (result.success) {
        console.log(`  ✓ Success`);
      } else {
        console.log(`  ✗ Failed: ${result.error || 'Unknown error'}`);
        if (result.errorMessage) {
          console.log(`    ${result.errorMessage.substring(0, 100)}${result.errorMessage.length > 100 ? '...' : ''}`);
        }
      }
      console.log('');
    }

    // Generate report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const report: TestReport = {
      timestamp: new Date().toISOString(),
      agentId,
      originalVoice: originalVoice ? {
        provider: originalVoice.provider || 'unknown',
        voiceId: originalVoice.voiceId || 'unknown',
      } : undefined,
      totalTested: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };

    // Print summary
    printSummary(report);

    // Save reports
    const csvContent = generateCSVReport(report);
    const jsonContent = generateJSONReport(report);

    const csvFilename = `voice-test-results-${timestamp}.csv`;
    const jsonFilename = `voice-test-results-${timestamp}.json`;

    // Save reports in scripts directory
    const scriptsDir = path.resolve(process.cwd(), 'scripts');
    const csvPath = path.join(scriptsDir, csvFilename);
    const jsonPath = path.join(scriptsDir, jsonFilename);

    fs.writeFileSync(csvPath, csvContent, 'utf-8');
    fs.writeFileSync(jsonPath, jsonContent, 'utf-8');

    console.log(`Reports saved:`);
    console.log(`  CSV: ${csvPath}`);
    console.log(`  JSON: ${jsonPath}`);
    console.log('');

    // Exit with appropriate code
    if (report.failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('\n[FATAL ERROR]', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module || process.argv[1]?.endsWith('testVoices.ts')) {
  main();
}

export { main as testVoices };

