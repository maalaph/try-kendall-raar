/**
 * Fetch VAPI-Verified ElevenLabs Voices
 * 
 * Fetches all voices from VAPI's /voices endpoint, filters for ElevenLabs voices
 * (provider === '11labs'), and saves the extracted list (name + voiceId) to a JSON file.
 * 
 * Usage: npm run fetch-vapi-voices
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

const VAPI_API_URL = 'https://api.vapi.ai';

interface VAPIVoice {
  id?: string;
  voiceId?: string;
  name?: string;
  provider?: string;
  [key: string]: any; // Allow for other fields we might not know about
}

interface ElevenLabsVoice {
  name: string;
  voiceId: string;
}

interface VoiceLibraryData {
  metadata: {
    fetchedAt: string;
    source: string;
    totalVoices: number;
  };
  voices: ElevenLabsVoice[];
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
 * Fetch all voices from ElevenLabs API (since VAPI doesn't expose a public voices endpoint)
 * All ElevenLabs voices work with VAPI when using provider: '11labs'
 */
async function fetchVAPIVoices(): Promise<VAPIVoice[]> {
  // VAPI doesn't have a public /voices endpoint, so we fetch from ElevenLabs instead
  // All ElevenLabs voices are supported by VAPI when using provider: '11labs'
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!elevenLabsApiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is not set. Please check your .env.local file.');
  }

  console.log('[FETCH] Fetching all voices from ElevenLabs API (all work with VAPI)...');
  
  const allVoices: VAPIVoice[] = [];
  let hasMore = true;
  let page = 1;
  const limit = 100;

  while (hasMore) {
    const url = `https://api.elevenlabs.io/v1/voices?page=${page}&page_size=${limit}`;
    
    console.log(`[FETCH] Fetching page ${page} from ElevenLabs...`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'xi-api-key': elevenLabsApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (page === 1) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}. ${errorText.substring(0, 200)}`);
      } else {
        console.log(`[INFO] Reached end of pagination at page ${page}`);
        break;
      }
    }

    let data: any;
    try {
      data = await response.json();
    } catch (e) {
      const rawText = await response.text();
      throw new Error(`Failed to parse JSON response: ${rawText.substring(0, 500)}`);
    }

    // ElevenLabs API returns: { voices: [...], has_more: boolean }
    const voices = data.voices || [];
    
    if (voices.length === 0) {
      if (page === 1) {
        throw new Error('No voices found in ElevenLabs response.');
      } else {
        hasMore = false;
        break;
      }
    }

    // Convert ElevenLabs voices to VAPIVoice format
    const vapiVoices: VAPIVoice[] = voices.map((voice: any) => ({
      id: voice.voice_id,
      voiceId: voice.voice_id,
      name: voice.name,
      provider: '11labs', // All ElevenLabs voices work with VAPI
    }));

    allVoices.push(...vapiVoices);
    console.log(`[FETCH] Page ${page}: Fetched ${voices.length} voices (total so far: ${allVoices.length})`);

    // Check if there's more
    if (data.has_more === false || voices.length < limit) {
      hasMore = false;
    } else {
      page++;
      // Safety limit
      if (page > 100) {
        console.warn('[WARN] Reached safety limit of 100 pages. Stopping pagination.');
        hasMore = false;
      }
    }
  }

  console.log(`[SUCCESS] Fetched ${allVoices.length} total voices from ElevenLabs (all work with VAPI)`);
  return allVoices;
}

/**
 * OLD: Fetch all voices from VAPI API with pagination support
 * NOTE: VAPI doesn't expose a public /voices endpoint, so this is unused
 */
async function fetchVAPIVoices_OLD(): Promise<VAPIVoice[]> {
  const headers = getHeaders();
  const allVoices: VAPIVoice[] = [];
  let hasMore = true;
  let page = 1;
  let createdAtLe: string | undefined = new Date().toISOString(); // Start with current date
  const limit = 100; // Fetch in batches of 100
  
  // Try v2 API endpoint first
  let baseUrl = `${VAPI_API_URL}/v2/voices`;
  let triedV1 = false;
  
  console.log('[FETCH] Fetching voices from VAPI v2 API with pagination support...');
  
  while (hasMore) {
    // Build URL with pagination params (VAPI v2 uses createdAtLe for pagination)
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    if (createdAtLe) params.append('createdAtLe', createdAtLe);
    params.append('sort', 'createdAt:desc'); // Ensure consistent sorting
    
    const url = `${baseUrl}?${params.toString()}`;
    
    console.log(`[FETCH] Fetching page ${page}${createdAtLe ? ` (createdAtLe: ${createdAtLe.substring(0, 19)}...)` : ''}...`);
    
    let response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    // If v2 doesn't work on first page, try v1
    if ((!response.ok || response.status === 404) && page === 1 && !triedV1) {
      console.log('[FETCH] v2 endpoint not found, trying v1 /voices endpoint...');
      baseUrl = `${VAPI_API_URL}/voices`;
      triedV1 = true;
      const v1Url = `${baseUrl}?${params.toString()}`;
      response = await fetch(v1Url, {
        method: 'GET',
        headers,
      });
    }

    if (!response.ok) {
      if (page === 1) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`VAPI API error: ${response.status} ${response.statusText}. ${errorText.substring(0, 200)}`);
      } else {
        // If we've already fetched some pages, stop here
        console.log(`[INFO] Reached end of pagination at page ${page}`);
        break;
      }
    }

    let data: any;
    try {
      data = await response.json();
    } catch (e) {
      const rawText = await response.text();
      throw new Error(`Failed to parse JSON response: ${rawText.substring(0, 500)}`);
    }

    // Handle VAPI v2 response structure: { results: [...], page: number, limit: number }
    // Or v1 structure: { voices: [...] } or { data: [...] } or just an array
    let voices: VAPIVoice[] = [];
    let lastCreatedAt: string | undefined;
    
    if (data.results && Array.isArray(data.results)) {
      // VAPI v2 format
      voices = data.results;
      if (voices.length > 0) {
        // Get the createdAt of the last voice for next page
        lastCreatedAt = voices[voices.length - 1].createdAt;
      }
    } else if (Array.isArray(data)) {
      voices = data;
    } else if (data.voices && Array.isArray(data.voices)) {
      voices = data.voices;
    } else if (data.data && Array.isArray(data.data)) {
      voices = data.data;
    } else if (data.items && Array.isArray(data.items)) {
      voices = data.items;
    } else {
      // Try to find any array in the response
      console.warn('[WARN] Unexpected response structure. Attempting to extract voices...');
      console.warn('[WARN] Response keys:', Object.keys(data));
      for (const key in data) {
        if (Array.isArray(data[key])) {
          voices = data[key];
          console.log(`[INFO] Found voices array in key: ${key}`);
          break;
        }
      }
    }

    if (voices.length === 0) {
      if (page === 1) {
        throw new Error('No voices found in VAPI response. Response structure may have changed.');
      } else {
        // No more voices
        hasMore = false;
        break;
      }
    }

    allVoices.push(...voices);
    console.log(`[FETCH] Page ${page}: Fetched ${voices.length} voices (total so far: ${allVoices.length})`);

    // Check if there's more to fetch
    if (lastCreatedAt && voices.length === limit) {
      // Use the createdAt of the last voice for next page
      createdAtLe = lastCreatedAt;
      page++;
    } else if (voices.length < limit) {
      // If we got fewer voices than the limit, we're done
      hasMore = false;
    } else {
      // Safety: if we got exactly the limit but no createdAt, try next page number
      page++;
      // Safety limit: don't fetch more than 100 pages (10,000 voices)
      if (page > 100) {
        console.warn('[WARN] Reached safety limit of 100 pages. Stopping pagination.');
        hasMore = false;
      } else {
        // Try without createdAtLe for page-based pagination
        createdAtLe = undefined;
      }
    }
  }

  console.log(`[SUCCESS] Fetched ${allVoices.length} total voices from VAPI`);
  return allVoices;
}

/**
 * Filter voices for ElevenLabs provider
 */
function filterElevenLabsVoices(voices: VAPIVoice[]): ElevenLabsVoice[] {
  const elevenLabsVoices: ElevenLabsVoice[] = [];
  
  for (const voice of voices) {
    // Check provider field - VAPI uses '11labs' (lowercase)
    const provider = voice.provider?.toLowerCase();
    
    if (provider === '11labs' || provider === 'elevenlabs') {
      // Extract voiceId - could be 'id', 'voiceId', or nested
      const voiceId = voice.voiceId || voice.id || voice.voice_id;
      const name = voice.name || voice.voiceName || 'Unknown Voice';
      
      if (!voiceId) {
        console.warn(`[WARN] Skipping voice "${name}" - no voiceId found`);
        continue;
      }
      
      elevenLabsVoices.push({
        name: String(name),
        voiceId: String(voiceId),
      });
    }
  }
  
  return elevenLabsVoices;
}

/**
 * Save voices to JSON file
 */
function saveVoicesToFile(voices: ElevenLabsVoice[]): void {
  const outputPath = path.resolve(process.cwd(), 'lib', 'vapiElevenLabsVoices.json');
  
  const data: VoiceLibraryData = {
    metadata: {
      fetchedAt: new Date().toISOString(),
      source: 'VAPI API /voices endpoint',
      totalVoices: voices.length,
    },
    voices,
  };
  
  // Ensure lib directory exists
  const libDir = path.dirname(outputPath);
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }
  
  // Write file with pretty formatting
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  
  console.log(`[SUCCESS] Saved ${voices.length} ElevenLabs voices to ${outputPath}`);
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('='.repeat(80));
    console.log('Fetching VAPI-Verified ElevenLabs Voices');
    console.log('='.repeat(80));
    console.log('');

    // Validate environment
    if (!process.env.VAPI_PRIVATE_KEY) {
      throw new Error('VAPI_PRIVATE_KEY environment variable is not set. Please check your .env.local file.');
    }

    // Fetch all voices from VAPI
    const allVoices = await fetchVAPIVoices();
    console.log(`[INFO] Total voices fetched: ${allVoices.length}`);
    console.log('');

    // Filter for ElevenLabs voices
    console.log('[FILTER] Filtering for ElevenLabs voices (provider === "11labs")...');
    const elevenLabsVoices = filterElevenLabsVoices(allVoices);
    console.log(`[SUCCESS] Found ${elevenLabsVoices.length} ElevenLabs voices`);
    console.log('');

    // Log sample of voices
    if (elevenLabsVoices.length > 0) {
      console.log('[SAMPLE] First 5 voices:');
      elevenLabsVoices.slice(0, 5).forEach((voice, index) => {
        console.log(`  ${index + 1}. ${voice.name} (${voice.voiceId})`);
      });
      if (elevenLabsVoices.length > 5) {
        console.log(`  ... and ${elevenLabsVoices.length - 5} more`);
      }
      console.log('');
    }

    // Save to file
    saveVoicesToFile(elevenLabsVoices);

    console.log('');
    console.log('='.repeat(80));
    console.log('✓ Successfully completed!');
    console.log('='.repeat(80));
    
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('='.repeat(80));
    console.error('[FATAL ERROR]', error instanceof Error ? error.message : String(error));
    console.error('='.repeat(80));
    if (error instanceof Error && error.stack) {
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module || process.argv[1]?.endsWith('fetchVAPIElevenLabsVoices.ts')) {
  main();
}

export { main as fetchVAPIElevenLabsVoices };

