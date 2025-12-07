/**
 * DTMF Tool for VAPI
 * RFC 2833 DTMF signaling for IVR navigation
 */

/**
 * Valid DTMF digits
 */
export type DTMFDigit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '*' | '#';

/**
 * DTMF sequence with optional wait commands
 * w = wait 500ms
 * W = wait 1000ms (long wait)
 * , = wait 500ms (pause)
 */
export type DTMFSequence = string;

/**
 * Parse and validate DTMF sequence
 */
export function parseDTMFSequence(sequence: string): {
  valid: boolean;
  digits: Array<{ type: 'digit' | 'wait'; value: string; durationMs: number }>;
  error?: string;
} {
  const result: Array<{ type: 'digit' | 'wait'; value: string; durationMs: number }> = [];
  const validDigits = '0123456789*#';
  const waitChars: Record<string, number> = {
    'w': 500,
    'W': 1000,
    ',': 500,
  };
  
  for (const char of sequence) {
    if (validDigits.includes(char)) {
      result.push({ type: 'digit', value: char, durationMs: 100 });
    } else if (waitChars[char]) {
      result.push({ type: 'wait', value: char, durationMs: waitChars[char] });
    } else if (char === ' ' || char === '-') {
      // Ignore formatting characters
      continue;
    } else {
      return {
        valid: false,
        digits: [],
        error: `Invalid character in DTMF sequence: ${char}`,
      };
    }
  }
  
  return { valid: true, digits: result };
}

/**
 * Calculate total duration of DTMF sequence
 */
export function calculateSequenceDuration(sequence: string): number {
  const parsed = parseDTMFSequence(sequence);
  if (!parsed.valid) return 0;
  
  return parsed.digits.reduce((total, item) => total + item.durationMs, 0);
}

/**
 * Common IVR navigation patterns
 */
export const IVR_PATTERNS = {
  /** Press 0 for operator */
  OPERATOR: '0',
  /** Press 0, wait, press 0 again (persistent operator request) */
  OPERATOR_REPEAT: '0w0w0',
  /** Extension format: wait, then extension */
  EXTENSION: (ext: string) => `W${ext}#`,
  /** Menu selection */
  MENU: (option: string) => option,
  /** Return to main menu */
  MAIN_MENU: '*',
  /** Previous menu */
  PREVIOUS: '#',
  /** Repeat options */
  REPEAT: '9',
};

/**
 * VAPI Function Definition for DTMF
 */
export const SEND_DTMF_FUNCTION = {
  name: 'send_dtmf',
  description: `Send DTMF tones to navigate phone menus (IVR systems). Use this when you hear automated prompts like "Press 1 for...", "Enter your extension", etc.

DTMF sequences can include:
- Digits: 0-9, * (star), # (pound/hash)
- Waits: w (500ms wait), W (1000ms wait), , (pause)

Examples:
- "1" - Press 1 for an option
- "0" - Press 0 for operator
- "123#" - Enter extension 123 and confirm
- "1w2" - Press 1, wait, press 2
- "0w0w0" - Keep pressing 0 for operator`,
  parameters: {
    type: 'object' as const,
    properties: {
      digits: {
        type: 'string',
        description: 'DTMF sequence to send (digits 0-9, *, #, w for wait)',
      },
      reason: {
        type: 'string',
        description: 'Why you are sending this DTMF (for logging)',
      },
    },
    required: ['digits'],
  },
};

/**
 * Process DTMF request from agent
 */
export interface DTMFRequest {
  digits: string;
  reason?: string;
  callId?: string;
}

export interface DTMFResult {
  success: boolean;
  sequenceSent?: string;
  durationMs?: number;
  error?: string;
}

/**
 * Execute DTMF command (to be called in VAPI webhook handler)
 * Note: Actual DTMF sending is handled by VAPI's infrastructure
 * This function validates and formats the request
 */
export async function processDTMFRequest(request: DTMFRequest): Promise<DTMFResult> {
  const { digits, reason, callId } = request;
  
  // Validate sequence
  const parsed = parseDTMFSequence(digits);
  if (!parsed.valid) {
    return {
      success: false,
      error: parsed.error,
    };
  }
  
  // Log the request
  console.log('[DTMF] Processing request:', {
    callId,
    digits,
    reason,
    parsedDigits: parsed.digits.length,
  });
  
  // Calculate duration
  const durationMs = calculateSequenceDuration(digits);
  
  return {
    success: true,
    sequenceSent: digits,
    durationMs,
  };
}

/**
 * Generate VAPI tool call response for DTMF
 * This formats the response that VAPI expects for DTMF tones
 */
export async function generateDTMFResponse(request: DTMFRequest): Promise<{
  type: 'tool_call_result';
  result: Record<string, any>;
  dtmf?: string;
}> {
  const processed = await processDTMFRequest(request);
  
  if (!processed.success) {
    return {
      type: 'tool_call_result',
      result: {
        success: false,
        error: processed.error,
      },
    };
  }
  
  return {
    type: 'tool_call_result',
    result: {
      success: true,
      message: request.reason 
        ? `Sending DTMF "${request.digits}" - ${request.reason}`
        : `Sending DTMF "${request.digits}"`,
      durationMs: processed.durationMs,
    },
    // VAPI will use this to send the actual DTMF tones
    dtmf: request.digits,
  };
}

/**
 * Suggest DTMF action based on transcript
 */
export function suggestDTMFAction(transcript: string): {
  suggested: boolean;
  digits?: string;
  confidence: number;
  reason?: string;
} {
  const lower = transcript.toLowerCase();
  
  // Pattern matching for common IVR prompts
  const patterns: Array<{
    regex: RegExp;
    extract?: (match: RegExpMatchArray) => string;
    digits?: string;
    reason: string;
  }> = [
    // "Press 1 for sales, press 2 for support"
    {
      regex: /press (\d) for/i,
      extract: (m) => m[1],
      reason: 'Menu option selection',
    },
    // "Enter your extension followed by pound"
    {
      regex: /enter (?:your )?extension/i,
      reason: 'Extension entry prompt detected',
    },
    // "For operator, press 0"
    {
      regex: /(?:for )?operator[,\s]+press (\d)/i,
      extract: (m) => m[1],
      reason: 'Operator option',
    },
    // "Press 0 to speak to a representative"
    {
      regex: /press (\d) to speak/i,
      extract: (m) => m[1],
      reason: 'Representative option',
    },
    // "To repeat these options, press 9"
    {
      regex: /repeat (?:these )?options[,\s]+press (\d)/i,
      extract: (m) => m[1],
      reason: 'Repeat options',
    },
    // "Please hold" - don't send any DTMF
    {
      regex: /please hold|your call is important/i,
      reason: 'On hold - no action needed',
    },
  ];
  
  for (const pattern of patterns) {
    const match = lower.match(pattern.regex);
    if (match) {
      const digits = pattern.extract ? pattern.extract(match) : pattern.digits;
      return {
        suggested: !!digits,
        digits,
        confidence: 0.8,
        reason: pattern.reason,
      };
    }
  }
  
  return {
    suggested: false,
    confidence: 0,
  };
}

/**
 * Helper to parse extension from user request
 */
export function parseExtensionFromText(text: string): string | null {
  // Match patterns like "extension 123", "ext 456", "dial 789"
  const patterns = [
    /extension\s*(\d{2,6})/i,
    /ext\.?\s*(\d{2,6})/i,
    /dial\s*(\d{2,6})/i,
    /connect (?:me )?to\s*(\d{2,6})/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

