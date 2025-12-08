/**
 * Smart Endpointing for VAPI
 * Dynamic voice activity detection based on call phase
 */

export type CallPhase = 
  | 'greeting'      // Initial greeting phase
  | 'ivr'           // Navigating IVR menu
  | 'human_wait'    // Waiting for human
  | 'human_active'  // Speaking with human
  | 'tool_call'     // Executing tool/function
  | 'closing';      // Ending call

export interface EndpointingConfig {
  /** Silence timeout in milliseconds before treating speech as complete */
  silenceTimeoutMs: number;
  /** Maximum duration of speech before forcing endpointing */
  maxSpeechDurationMs: number;
  /** Minimum speech duration to be considered valid */
  minSpeechDurationMs: number;
  /** Whether to use VAD (Voice Activity Detection) */
  useVAD: boolean;
  /** Sensitivity of VAD (0-1, higher = more sensitive) */
  vadSensitivity: number;
}

/**
 * Default endpointing configurations for each call phase
 */
export const PHASE_CONFIGS: Record<CallPhase, EndpointingConfig> = {
  greeting: {
    silenceTimeoutMs: 1500,
    maxSpeechDurationMs: 30000,
    minSpeechDurationMs: 200,
    useVAD: true,
    vadSensitivity: 0.5,
  },
  ivr: {
    // IVR systems have longer pauses and mechanical responses
    silenceTimeoutMs: 3000,
    maxSpeechDurationMs: 60000,
    minSpeechDurationMs: 100,
    useVAD: true,
    vadSensitivity: 0.3, // Lower sensitivity for mechanical voices
  },
  human_wait: {
    // Waiting for human - long silence acceptable
    silenceTimeoutMs: 10000,
    maxSpeechDurationMs: 120000,
    minSpeechDurationMs: 200,
    useVAD: true,
    vadSensitivity: 0.7, // Higher to detect human voice quickly
  },
  human_active: {
    // Normal conversation with human
    silenceTimeoutMs: 2000,
    maxSpeechDurationMs: 60000,
    minSpeechDurationMs: 200,
    useVAD: true,
    vadSensitivity: 0.5,
  },
  tool_call: {
    // During tool execution - very patient
    silenceTimeoutMs: 15000,
    maxSpeechDurationMs: 120000,
    minSpeechDurationMs: 100,
    useVAD: true,
    vadSensitivity: 0.4,
  },
  closing: {
    // Quick endpointing for closing
    silenceTimeoutMs: 1000,
    maxSpeechDurationMs: 15000,
    minSpeechDurationMs: 200,
    useVAD: true,
    vadSensitivity: 0.6,
  },
};

/**
 * IVR Detection patterns
 */
const IVR_PATTERNS = {
  /** Keywords that indicate IVR prompts */
  keywords: [
    'press 1',
    'press 2',
    'press 3',
    'press 4',
    'press 5',
    'press 6',
    'press 7',
    'press 8',
    'press 9',
    'press 0',
    'press star',
    'press pound',
    'press hash',
    'dial',
    'extension',
    'menu',
    'option',
    'department',
    'main menu',
    'previous menu',
    'operator',
    'representative',
    'agent',
    'hold',
    'please hold',
    'your call is important',
    'wait time',
    'queue',
    'call volume',
    'business hours',
    'leave a message',
    'voicemail',
    'at the tone',
    'after the beep',
  ],
  
  /** Patterns that indicate human speech */
  humanPatterns: [
    /^(hi|hello|hey)\s+/i,
    /how can i help/i,
    /what can i do for you/i,
    /my name is/i,
    /speaking with/i,
    /this is \w+/i,
  ],
};

/**
 * Detect if transcript indicates IVR phase
 */
export function detectIVRPhase(transcript: string): boolean {
  const lower = transcript.toLowerCase();
  
  // Check for IVR keywords
  for (const keyword of IVR_PATTERNS.keywords) {
    if (lower.includes(keyword)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Detect if transcript indicates human phase
 */
export function detectHumanPhase(transcript: string): boolean {
  // Check for human patterns
  for (const pattern of IVR_PATTERNS.humanPatterns) {
    if (pattern.test(transcript)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Smart Call State Manager
 * Tracks call phase and adjusts endpointing dynamically
 */
export class SmartCallStateManager {
  private callId: string;
  private currentPhase: CallPhase = 'greeting';
  private phaseHistory: Array<{ phase: CallPhase; timestamp: Date }> = [];
  private ivrMenuLevel: number = 0;
  private humanDetected: boolean = false;
  private lastTranscript: string = '';
  
  constructor(callId: string) {
    this.callId = callId;
    this.recordPhaseChange('greeting');
  }
  
  /**
   * Get current call phase
   */
  getPhase(): CallPhase {
    return this.currentPhase;
  }
  
  /**
   * Get endpointing config for current phase
   */
  getEndpointingConfig(): EndpointingConfig {
    return PHASE_CONFIGS[this.currentPhase];
  }
  
  /**
   * Update state based on new transcript
   */
  processTranscript(transcript: string): {
    phaseChanged: boolean;
    newPhase: CallPhase;
    config: EndpointingConfig;
  } {
    this.lastTranscript = transcript;
    const previousPhase = this.currentPhase;
    
    // Detect phase from transcript
    if (detectHumanPhase(transcript)) {
      this.humanDetected = true;
      this.transitionTo('human_active');
    } else if (detectIVRPhase(transcript)) {
      this.transitionTo('ivr');
    }
    
    return {
      phaseChanged: previousPhase !== this.currentPhase,
      newPhase: this.currentPhase,
      config: this.getEndpointingConfig(),
    };
  }
  
  /**
   * Manual phase transition
   */
  transitionTo(phase: CallPhase): void {
    if (this.currentPhase !== phase) {
      this.currentPhase = phase;
      this.recordPhaseChange(phase);
      console.log(`[SMART_ENDPOINTING] Call ${this.callId} phase: ${phase}`);
    }
  }
  
  /**
   * Mark that we're waiting for human
   */
  waitingForHuman(): void {
    this.transitionTo('human_wait');
  }
  
  /**
   * Mark tool call start
   */
  toolCallStart(): void {
    this.transitionTo('tool_call');
  }
  
  /**
   * Mark tool call end
   */
  toolCallEnd(): void {
    this.transitionTo(this.humanDetected ? 'human_active' : 'ivr');
  }
  
  /**
   * Mark call closing
   */
  closing(): void {
    this.transitionTo('closing');
  }
  
  /**
   * Get VAPI-compatible endpointing settings
   */
  getVAPISettings(): Record<string, any> {
    const config = this.getEndpointingConfig();
    
    return {
      // These map to VAPI's model configuration
      endpointing: {
        silenceTimeoutSeconds: config.silenceTimeoutMs / 1000,
        maxDurationSeconds: config.maxSpeechDurationMs / 1000,
      },
      // VAD settings (if supported)
      vad: config.useVAD ? {
        sensitivity: config.vadSensitivity,
      } : undefined,
    };
  }
  
  /**
   * Get call state summary
   */
  getSummary(): {
    callId: string;
    currentPhase: CallPhase;
    humanDetected: boolean;
    ivrMenuLevel: number;
    phaseHistory: Array<{ phase: CallPhase; timestamp: Date }>;
  } {
    return {
      callId: this.callId,
      currentPhase: this.currentPhase,
      humanDetected: this.humanDetected,
      ivrMenuLevel: this.ivrMenuLevel,
      phaseHistory: this.phaseHistory,
    };
  }
  
  private recordPhaseChange(phase: CallPhase): void {
    this.phaseHistory.push({
      phase,
      timestamp: new Date(),
    });
  }
}

// Store active call managers
const activeCallManagers: Map<string, SmartCallStateManager> = new Map();

/**
 * Get or create call state manager for a call
 */
export function getCallStateManager(callId: string): SmartCallStateManager {
  let manager = activeCallManagers.get(callId);
  
  if (!manager) {
    manager = new SmartCallStateManager(callId);
    activeCallManagers.set(callId, manager);
  }
  
  return manager;
}

/**
 * Clean up call state manager when call ends
 */
export function cleanupCallStateManager(callId: string): void {
  activeCallManagers.delete(callId);
}

/**
 * Get idle messages for different phases
 */
export function getIdleMessage(phase: CallPhase): string | null {
  const messages: Partial<Record<CallPhase, string[]>> = {
    ivr: [
      "I'm navigating through the menu options...",
      "Just a moment while I work through this...",
      "Processing the menu selection...",
    ],
    human_wait: [
      "Still waiting to be connected...",
      "I'm on hold, shouldn't be much longer...",
      "Waiting for the next available person...",
    ],
    tool_call: [
      "Just a moment while I look that up...",
      "Let me check on that for you...",
      "Working on that now...",
    ],
  };
  
  const phaseMessages = messages[phase];
  if (!phaseMessages || phaseMessages.length === 0) {
    return null;
  }
  
  // Return random message from pool
  return phaseMessages[Math.floor(Math.random() * phaseMessages.length)];
}



