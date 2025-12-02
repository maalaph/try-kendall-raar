# Voice Testing Script

This script tests all voices in the voice library against your existing VAPI agent to identify which ones fail with the "Couldn't Find 11labs Voice" error.

## Prerequisites

1. Make sure your `.env.local` file contains all required environment variables:
   - `VAPI_PRIVATE_KEY`
   - `AIRTABLE_API_KEY`
   - `AIRTABLE_BASE_ID`
   - `AIRTABLE_TABLE_ID`
   - `ELEVENLABS_API_KEY`

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Basic Usage (uses default record ID from terminal logs)
```bash
npm run test:voices
```

### With Custom Record ID
```bash
npm run test:voices recds1LsfJJP1XDCL
```

### With Custom Record ID and Agent ID Override
```bash
npm run test:voices recds1LsfJJP1XDCL f6c6123b-8f88-43b7-a507-9a3e1f3d20a4
```

## How It Works

1. **Fetches your agent**: Gets your agent ID from Airtable (using the record ID)
2. **Saves current voice**: Records the current voice configuration
3. **Tests each voice**: For each ElevenLabs voice in the library:
   - Temporarily updates your agent with that voice
   - Captures success/failure
   - **Immediately restores your original voice** (safe!)
   - Adds a small delay to avoid rate limits
4. **Generates reports**: Creates CSV and JSON files with detailed results

## Output

The script will:
- Print progress to the console
- Show a summary at the end
- Generate two files in the `scripts/` directory:
  - `voice-test-results-{timestamp}.csv` - CSV format for easy analysis
  - `voice-test-results-{timestamp}.json` - JSON format with full details

## Safety

✅ **Safe to run**: The script automatically restores your original voice after each test  
✅ **Non-destructive**: Only tests voices, doesn't change your agent permanently  
✅ **Error handling**: If something goes wrong, it attempts to restore your original voice

## Example Output

```
Starting voice testing script...

Using Airtable record ID: recds1LsfJJP1XDCL
Found agent ID: f6c6123b-8f88-43b7-a507-9a3e1f3d20a4
Current voice: 11labs - xYWUvKNK6zWCgsdAK7Wi

Loading voice library...
Loaded 188 voices

Testing 175 ElevenLabs voices (VAPI voices skipped)...

[1/175] Testing: Mahmoud – Natural Conversational (KM-OS2FRC)...
  ✓ Success

[2/175] Testing: Matthew Schmitz - Reptilian Argonian Monster (KM-XYWUVK)...
  ✗ Failed: VOICE_NOT_FOUND
    Couldn't Find 11labs Voice...

================================================================================
VOICE TEST SUMMARY
================================================================================
Total Tested: 175
Successful: 174 (99%)
Failed: 1 (1%)
...
```

## Troubleshooting

- **"Missing environment variables"**: Make sure your `.env.local` file exists and contains all required variables
- **"No agent ID found"**: Provide the agent ID as the second argument or ensure your Airtable record has a `vapi_agent_id` field
- **Rate limit errors**: The script includes delays between tests, but if you hit rate limits, wait a bit and rerun





