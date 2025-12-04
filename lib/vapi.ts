/**
 * VAPI helper functions for My Kendall agent creation and phone number management
 */

import { buildSystemPrompt, buildLeanSystemPrompt } from './promptBlocks';
import { getElevenLabsMapping } from './voiceMapping';

const VAPI_API_URL = 'https://api.vapi.ai';

/**
 * Format phone number to E.164 format (e.g., +1XXXXXXXXXX)
 * E.164 format requires: +[country code][number] with no spaces or special characters
 */
export function formatPhoneNumberToE164(phone: string): string | null {
  if (!phone || typeof phone !== 'string') {
    return null;
  }
  
  const trimmed = phone.trim();
  if (!trimmed) {
    return null;
  }
  
  let cleaned = trimmed;
  
  if (cleaned.startsWith('+')) {
    const digits = cleaned.replace(/\D/g, '');
    // E.164 format for US: +1XXXXXXXXXX (12 digits total)
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    if (digits.length >= 10) {
      // If it's already 10+ digits with +, validate it's properly formatted
      if (digits.length === 11 && digits.startsWith('1')) {
        return `+${digits}`;
      }
      // If starts with + but wrong length, return as-is (let API handle validation)
      return `+${digits}`;
    }
    return null;
  }
  
  const digits = cleaned.replace(/\D/g, '');
  
  if (digits.length < 10) {
    return null;
  }
  
  // Exactly 10 digits: add +1 prefix
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // 11 digits starting with 1: add + prefix only
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // 11 digits NOT starting with 1: assume typo, take last 10 digits
  if (digits.length === 11 && !digits.startsWith('1')) {
    const lastTen = digits.slice(-10);
    return `+1${lastTen}`;
  }
  
  // More than 11 digits: invalid, return null
  if (digits.length > 11) {
    return null;
  }
  
  // Fallback: should not reach here, but if we do, treat as 10 digits
  if (digits.length >= 10) {
    const lastTen = digits.slice(-10);
    return `+1${lastTen}`;
  }
  
  return null;
}

/**
 * VAPI function definition for checking if the caller is the owner
 */
const CHECK_IF_OWNER_FUNCTION = {
  name: 'check_if_owner',
  description: 'Call this function at the very start of every conversation to check if the caller is the owner. This will help you greet the owner by name immediately.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

/**
 * VAPI function definition for capturing notes/messages from callers
 */
const CAPTURE_NOTE_FUNCTION = {
  name: 'capture_note',
  description: 'Call this function when the caller wants to leave a message or asks you to pass something along to the person whose number this is.',
  parameters: {
    type: 'object',
    properties: {
      note_content: {
        type: 'string',
        description: 'The message or note that the caller wants to leave',
      },
      caller_phone: {
        type: 'string',
        description: 'The caller\'s phone number',
      },
    },
    required: ['note_content', 'caller_phone'],
  },
};

/**
 * VAPI function definition for making outbound calls
 */
const MAKE_OUTBOUND_CALL_FUNCTION = {
  name: 'make_outbound_call',
  description: 'Make an outbound call to a specified phone number and deliver a message on behalf of the owner. Use this when the owner requests an immediate call that should execute RIGHT NOW during the current call. Do NOT use this for "after we hang up" requests - use schedule_outbound_call instead.',
  parameters: {
    type: 'object',
    properties: {
      phone_number: {
        type: 'string',
        description: 'The phone number to call in E.164 format (e.g., +14155551234)',
      },
      message: {
        type: 'string',
        description: 'The message to deliver during the call',
      },
      caller_name: {
        type: 'string',
        description: 'Optional: The name of the person making the request (the owner)',
      },
      scheduled_time: {
        type: 'string',
        description: 'Optional: ISO 8601 format timestamp for scheduling the call. If not provided, call is made immediately.',
      },
    },
    required: ['phone_number', 'message'],
  },
};

/**
 * VAPI function definition for scheduling outbound calls
 */
const SCHEDULE_OUTBOUND_CALL_FUNCTION = {
  name: 'schedule_outbound_call',
  description: 'Schedule an outbound call to a specified phone number for a future date/time. Use this when the owner requests a call to be made at a specific time (e.g., "in 15 minutes", "tomorrow at 8pm") OR when they say "after we hang up" or "after we get off the phone" - in that case, schedule for 1-2 minutes in the future.',
  parameters: {
    type: 'object',
    properties: {
      phone_number: {
        type: 'string',
        description: 'The phone number to call in E.164 format (e.g., +14155551234)',
      },
      message: {
        type: 'string',
        description: 'The message to deliver during the call',
      },
      scheduled_time: {
        type: 'string',
        description: 'ISO 8601 format timestamp for when the call should be made',
      },
      caller_name: {
        type: 'string',
        description: 'Optional: The name of the person making the request (the owner)',
      },
    },
    required: ['phone_number', 'message', 'scheduled_time'],
  },
};

/**
 * VAPI function definition for getting user context
 */
const GET_USER_CONTEXT_FUNCTION = {
  name: 'get_user_context',
  description: 'Get information about the user. ALWAYS call this before making claims about the user\'s background, history, or experience.',
  parameters: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'Specific topic to retrieve (optional)',
      },
    },
    required: [],
  },
};

/**
 * VAPI function definition for getting user contacts
 */
const GET_USER_CONTACTS_FUNCTION = {
  name: 'get_user_contacts',
  description: 'Search for a contact by name. ALWAYS call this when the user asks to call someone or find a phone number.',
  parameters: {
    type: 'object',
    properties: {
      contactName: {
        type: 'string',
        description: 'Name of the contact',
      },
    },
    required: [],
  },
};

/**
 * VAPI function definition for getting user documents
 */
const GET_USER_DOCUMENTS_FUNCTION = {
  name: 'get_user_documents',
  description: 'Get information from user\'s uploaded documents. ALWAYS call this when user asks about documents, files, resumes, menus, invoices, or any uploaded content. Returns max 5 document summaries.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'What to search for in documents (e.g., "resume", "menu", "invoice", "document")',
      },
    },
    required: [],
  },
};

const getHeaders = () => {
  const apiKey = process.env.VAPI_PRIVATE_KEY;
  
  if (!apiKey) {
    console.error('[VAPI ERROR] VAPI_PRIVATE_KEY is not set in environment variables');
    throw new Error('VAPI_PRIVATE_KEY environment variable is not configured');
  }
  
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
};

/**
 * Build personality description using hybrid logic:
 * - Prioritizes custom text if provided
 * - Falls back to choice-based defaults
 * - Enhances with customization options
 */
function buildPersonality({ 
  choices, 
  customText, 
  options 
}: { 
  choices?: string[]; 
  customText?: string; 
  options?: string[] 
}): string {
  let personality = '';
  
  // Primary personality source: custom text takes precedence
  if (customText && customText.trim().length > 0) {
    personality = customText.trim();
  } else if (choices && choices.length > 0) {
    // Combine multiple personality choices
    const choiceDescriptions: Record<string, string> = {
      'Friendly & Casual': 'Friendly and approachable. Use casual, warm language. Match the caller\'s energy. It\'s okay to be conversational.',
      'Professional & Polished': 'Professional and polished. Use formal, courteous language. Maintain professional tone throughout.',
      'Warm & Personal': 'Warm and personable. Show genuine interest in helping. Use empathetic language.',
      'Direct & Brief': 'Direct and efficient. Get to the point quickly. Be clear and concise.',
      'Rude & Blunt': 'Rude and blunt. Be straightforward and unapologetically direct. Don\'t sugarcoat things. Be brutally honest.',
      'Sarcastic & Mean': 'Sarcastic and mean-spirited. Use sarcasm, wit, and sharp humor. Be snarky and dismissive when appropriate.',
    };
    
    // Combine descriptions for selected choices
    const descriptions = choices
      .map(choice => choiceDescriptions[choice])
      .filter(desc => desc !== undefined);
    
    if (descriptions.length > 0) {
      // Combine multiple personality traits intelligently
      if (descriptions.length === 1) {
        personality = descriptions[0];
      } else {
        // For multiple selections, combine them naturally
        personality = descriptions.join(' Also, ').replace(/\. Also, /g, '. Additionally, ');
        // Add context about combining traits
        personality += ` Balance these ${descriptions.length} personality aspects naturally in conversation.`;
      }
    } else {
      personality = 'Warm, professional, and helpful';
    }
  } else {
    personality = 'Warm, professional, and helpful';
  }
  
  // Enhance with customization options
  if (options && options.length > 0) {
    const enhancements: string[] = [];
    
    if (options.includes('Keep conversations brief (under 2 minutes)')) {
      enhancements.push('Keep responses brief and focused. Minimize small talk.');
    }
    if (options.includes('Allow longer conversations (5+ minutes if needed)')) {
      enhancements.push('Allow for detailed conversations when needed. Take time to fully understand the caller\'s needs.');
    }
    if (options.includes('Match caller\'s energy level')) {
      enhancements.push('Match the caller\'s energy and communication style.');
    }
    if (options.includes('Use more formal language')) {
      enhancements.push('Use formal language and professional tone.');
    }
    if (options.includes('Use casual, friendly language')) {
      enhancements.push('Use casual, friendly language. It\'s okay to be relaxed and conversational.');
    }
    if (options.includes('Ask clarifying questions when uncertain')) {
      enhancements.push('If uncertain about anything, ask clarifying questions rather than making assumptions.');
    }
    if (options.includes('Be more direct and to-the-point')) {
      enhancements.push('Be direct and to-the-point. Get to the core of what the caller needs quickly.');
    }
    
    if (enhancements.length > 0) {
      personality += '\n\nAdditional Behaviors:\n' + enhancements.join('\n');
    }
  }
  
  return personality;
}

export async function createAgent({
  fullName,
  forwardCalls,
  mobileNumber,
  personalityChoices,
  personalityText,
  customizationOptions,
  userContext,
  additionalInstructions,
  voiceChoice,
  analyzedFileContent,
  kendallName,
}: {
  fullName: string;
  forwardCalls?: boolean;
  mobileNumber?: string;
  personalityChoices?: string[];
  personalityText?: string;
  customizationOptions?: string[];
  userContext: string;
  additionalInstructions?: string;
  voiceChoice?: string;
  analyzedFileContent?: string;
  kendallName?: string;
}) {
  try {
    // Build personality using hybrid logic
    const personality = buildPersonality({
      choices: personalityChoices,
      customText: personalityText,
      options: customizationOptions,
    });

    // Build call forwarding rules based on user preference
    const callForwardingRules = forwardCalls
      ? `When callers request to speak directly with ${fullName}, forward the call to ${fullName}'s mobile number.`
      : `Do not forward calls. Handle all inquiries yourself as ${fullName}'s personal assistant.`;

    // Use provided kendallName or default to 'Kendall'
    const assistantName = (kendallName && kendallName.trim()) || 'Kendall';

    // Build purpose description
    const purposeDescription = `You are ${assistantName}, the personal AI assistant for ${fullName}. Your purpose is to represent ${fullName} professionally and handle calls on their behalf. Use the context about ${fullName} to answer questions accurately and naturally. Be helpful, professional, and make every caller feel valued.`;

    // Build file content section if available with explicit instructions
    const fileContentSection = analyzedFileContent && analyzedFileContent.trim()
      ? `=== DETAILED INFORMATION ABOUT ${fullName} ===
The following information comes from ${fullName}'s professional documents (resume, CV, portfolio). This is your PRIMARY source of specific information about ${fullName}.

${analyzedFileContent}

⚠️ MANDATORY INSTRUCTIONS FOR USING THIS INFORMATION:

1. When asked ANY question about ${fullName}'s experience, background, achievements, or skills, you MUST reference the specific information from the sections above.

2. CRITICAL: Use ALL information from the sections, not just a subset:
   - From "WORK EXPERIENCE": Mention ALL companies and roles listed (e.g., if there are 3 companies, mention all 3)
   - From "KEY ACHIEVEMENTS": Reference multiple achievements, not just one
   - From "EDUCATION": Use exact institution, degree, and graduation year
   - From "LEADERSHIP & ACTIVITIES": Mention all leadership roles and activities listed

3. Use EXACT details from the sections:
   - Use exact company names, job titles, dates, and achievements with numbers
   - Cite specific achievements with exact numbers/percentages
   - Reference specific roles and achievements

4. SPEAK NATURALLY using the information:
   - GOOD FORMAT: "At [Company Name] as [Job Title], ${fullName} [specific achievement with numbers]. At [Another Company], they [another achievement]."
   - BAD: "They have consulting experience" or mentioning only one company
   - CRITICAL: Only use company names, institutions, and organizations that are explicitly listed in the sections above

5. When asked general questions like "What does ${fullName} do?" or "Tell me about ${fullName}":
   - Start with information from "WHO THEY ARE"
   - Then share ALL work experiences from "WORK EXPERIENCE" section - list each company, role, and key achievements
   - Include multiple specific achievements with numbers from "KEY ACHIEVEMENTS"
   - Mention leadership roles and activities from "LEADERSHIP & ACTIVITIES"
   - CRITICAL: Do not mention only one experience - you MUST share ALL experiences, companies, and achievements listed

6. NEVER say "I don't have that information" - the sections above contain your information source.

7. ALWAYS cite specific company names, job titles, dates, and numbers when available.

🚫 ABSOLUTELY FORBIDDEN - DO NOT:
- Make up, invent, or guess information that is NOT explicitly stated in the sections above
- Use generic information like "graduated from a university" - use the EXACT institution and year from "EDUCATION" section
- Say information that contradicts what's in the sections above (e.g., if EDUCATION says "Penn State, 2026", DO NOT say "UCLA, 2020" or "Lebanese American University")
- Use placeholder or generic information - ONLY use what is explicitly written in the sections above
- Mention universities, schools, organizations, or activities that are NOT explicitly listed in the "EDUCATION" or "LEADERSHIP & ACTIVITIES" sections
- For EDUCATION: ONLY mention the exact institution, degree, and year from the "EDUCATION" section - do NOT mention any other schools or universities, even if they seem related
- For LEADERSHIP & ACTIVITIES: ONLY mention roles and activities explicitly listed in the "LEADERSHIP & ACTIVITIES" section - do NOT invent organizations like "Lebanese Scout" or roles like "choir president" if they are not in the sections
- If asked about something NOT in the sections above, deflect naturally and professionally (e.g., "I'm not sure about that specific detail" or "Let me help you with something else I can tell you about" or redirect to relevant information you DO know) - DO NOT mention "files" or "documents" and maintain your role as their assistant

`
      : '';

    // Build system prompt in required format
    const systemPrompt = `Identity & Context:
You are ${assistantName}, the personal AI assistant for ${fullName}.

About ${fullName}:
${userContext}${fileContentSection}

⚠️ CRITICAL: The "DETAILED INFORMATION ABOUT ${fullName}" section above contains your PRIMARY source of specific information. When answering ANY question about ${fullName}'s experience, background, achievements, or skills, you MUST reference the exact details from that section. Use specific company names, job titles, dates, numbers, and percentages. Never be vague or generic.

🚫 CRITICAL RULE: NEVER make up, invent, or guess information. ONLY use information that is explicitly stated in the "DETAILED INFORMATION ABOUT ${fullName}" section above. If asked about something not in that section, deflect naturally and professionally (e.g., "I'm not sure about that specific detail" or redirect to relevant information you DO know) - DO NOT mention "files" or "documents" and maintain your role as their assistant.

Speech Style:
Direct, clear, and human.
One question at a time.
Never ramble.

Personality & Communication Style:
${personality}

${additionalInstructions ? `Additional Instructions:\n${additionalInstructions}\n\n` : ''}Your Purpose:
${purposeDescription}

Call Forwarding Rules:
${callForwardingRules}

You must never give:
Medical, legal, or financial advice
Emotional counseling
Technical explanations of internal models
Claims about having feelings or intentions.

End of System Prompt`;

    // Build voice configuration - handle both ElevenLabs and VAPI voices
    const trimmedVoiceChoice = voiceChoice && typeof voiceChoice === 'string' ? voiceChoice.trim() : '';
    
    let voiceConfig: { provider: '11labs' | 'vapi'; voiceId: string } | undefined;
    let voiceMapping: any = undefined; // Initialize outside the if block for logging
    
    if (trimmedVoiceChoice) {
      // Try to get voice config using helper (handles curated library IDs)
      const { getVoiceConfigForVAPI } = await import('./voiceConfigHelper');
      voiceConfig = await getVoiceConfigForVAPI(trimmedVoiceChoice);
      
      // Fallback: Check legacy mapping system
      if (!voiceConfig) {
        voiceMapping = getElevenLabsMapping(trimmedVoiceChoice);
        if (voiceMapping?.elevenLabsVoiceId) {
          voiceConfig = {
            provider: '11labs',
            voiceId: voiceMapping.elevenLabsVoiceId,
          };
        } else {
          // Check if it looks like an ElevenLabs voice ID (long alphanumeric string)
          // ElevenLabs IDs are typically 17-20 characters, alphanumeric
          const looksLikeElevenLabsId = /^[a-zA-Z0-9]{15,}$/.test(trimmedVoiceChoice) && 
                                         trimmedVoiceChoice.length >= 15 && 
                                         trimmedVoiceChoice.length <= 25;
          
          if (looksLikeElevenLabsId) {
            // It's an ElevenLabs voice ID - use 11labs provider
            voiceConfig = {
              provider: '11labs',
              voiceId: trimmedVoiceChoice,
            };
          } else {
            // Assume VAPI voice name (short, simple names like "Elliot", "Kylie")
            voiceConfig = {
              provider: 'vapi',
              voiceId: trimmedVoiceChoice,
            };
          }
        }
        
        // Log fallback logic for debugging
        console.log('[VAPI DEBUG] Voice config fallback logic:', {
          trimmedVoiceChoice,
          hasMapping: !!voiceMapping,
          looksLikeElevenLabsId: /^[a-zA-Z0-9]{15,}$/.test(trimmedVoiceChoice) && 
                                 trimmedVoiceChoice.length >= 15 && 
                                 trimmedVoiceChoice.length <= 25,
          finalProvider: voiceConfig?.provider,
          finalVoiceId: voiceConfig?.voiceId,
        });
      }
    }

    // Log voice configuration for debugging
    console.log('[VAPI DEBUG] createAgent voice configuration:', {
      voiceChoice: voiceChoice,
      trimmedVoiceChoice: trimmedVoiceChoice,
      voiceMapping: voiceMapping,
      voiceConfig: voiceConfig,
      hasVoiceConfig: !!voiceConfig,
      provider: voiceConfig?.provider,
    });

    // Create the assistant with proper API structure
    const requestBody: any = {
      name: `My ${assistantName} - ${fullName}`,
      model: {
        provider: 'openai',
        model: process.env.VAPI_DEFAULT_MODEL || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
        ],
      },
      // Removed firstMessage to allow check_if_owner function to be called first
      // firstMessage: 'Hello!',
      // Explicitly set background sound to Off by default
      backgroundSound: 'off',
    };

    // CRITICAL: Always add voice config if provided - this ensures voice is set correctly
    if (voiceConfig) {
      requestBody.voice = voiceConfig;
      console.log('[VAPI DEBUG] Voice config added to request body:', voiceConfig);
    } else {
      console.warn('[VAPI WARNING] No voice config - voiceChoice was:', voiceChoice);
    }

    // Add forwarding phone number if call forwarding is enabled and valid
    // Vapi requires forwardingPhoneNumber to be a string in E.164 format (e.g., "+14155552671")
    // OR an object of shape { phone: string, country?: string }
    // IMPORTANT: Only add this field if we have a valid value - never add undefined/null/empty
    if (forwardCalls && mobileNumber) {
      const trimmedMobile = typeof mobileNumber === 'string' ? mobileNumber.trim() : String(mobileNumber).trim();
      
      if (trimmedMobile.length === 0) {
        console.warn('[VAPI WARNING] Call forwarding enabled but mobile number is empty');
        // Don't add forwardingPhoneNumber - Vapi will handle calls without forwarding
      } else {
        const formattedNumber = formatPhoneNumberToE164(trimmedMobile);
        
        // Only set forwardingPhoneNumber if we have a valid, non-empty string that starts with +
        if (formattedNumber && 
            typeof formattedNumber === 'string' && 
            formattedNumber.trim().length >= 11 && 
            formattedNumber.trim().startsWith('+')) {
          const cleanNumber = formattedNumber.trim();
          requestBody.forwardingPhoneNumber = cleanNumber;
          console.log('[VAPI INFO] Setting forwardingPhoneNumber to:', cleanNumber);
        } else {
          console.warn('[VAPI WARNING] Invalid formatted number - not adding forwardingPhoneNumber:', {
            original: trimmedMobile,
            formatted: formattedNumber,
            type: typeof formattedNumber
          });
          // Explicitly do NOT add forwardingPhoneNumber - leave it undefined
        }
      }
    }
    // If forwardCalls is false or mobileNumber is missing, forwardingPhoneNumber is not added to requestBody

    // Log the request body for debugging (remove sensitive data in production)
    console.log('[VAPI DEBUG] Assistant creation request body:', {
      name: requestBody.name,
      voice: requestBody.voice,
      backgroundSound: requestBody.backgroundSound,
      hasSystemPrompt: !!requestBody.model?.messages?.[0]?.content,
      systemPromptLength: requestBody.model?.messages?.[0]?.content?.length || 0,
      forwardingPhoneNumber: requestBody.forwardingPhoneNumber,
    });

    const response = await fetch(`${VAPI_API_URL}/assistant`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || `VAPI API error: ${response.status} ${response.statusText}`;
      console.error('[VAPI ERROR] createAgent failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        fullName,
        voiceConfig: requestBody.voice,
      });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    
    // Log the response to verify voice was set correctly
    console.log('[VAPI DEBUG] createAgent response:', {
      agentId: result.id || result.agentId,
      voice: result.voice,
      voiceId: result.voice?.voiceId,
      voiceProvider: result.voice?.provider,
    });
    
    return result;
  } catch (error) {
    console.error('[VAPI ERROR] createAgent failed:', error);
    throw error;
  }
}

/**
 * Create agent using the new template-based system
 */
export async function createAgentFromTemplate({
  fullName,
  nickname,
  kendallName,
  mobileNumber,
  selectedTraits,
  useCaseChoice,
  boundaryChoices,
  userContextAndRules,
  forwardCalls = false,
  voiceChoice,
  analyzedFileContent,
  fileUsageInstructions,
}: {
  fullName: string;
  nickname?: string;
  kendallName: string;
  mobileNumber: string;
  selectedTraits: string[];
  useCaseChoice: string;
  boundaryChoices: string[];
  userContextAndRules: string;
  forwardCalls?: boolean;
  voiceChoice?: string;
  analyzedFileContent?: string;
  fileUsageInstructions?: string;
}) {
  try {
    // Use provided kendallName or default to 'Kendall'
    const assistantName = (kendallName && kendallName.trim()) || 'Kendall';
    
    // Format owner phone number for prompt (use E.164 format for consistency)
    const ownerPhoneNumber = mobileNumber ? (formatPhoneNumberToE164(mobileNumber) || mobileNumber) : undefined;
    
    // Build full detailed system prompt (~300 lines)
    const systemPrompt = buildSystemPrompt({
      kendallName: assistantName,
      fullName,
      nickname,
      selectedTraits,
      useCaseChoice,
      boundaryChoices,
      userContextAndRules,
      analyzedFileContent,
      fileUsageInstructions,
      ownerPhoneNumber,
    });

    // Build voice configuration - handle both ElevenLabs and VAPI voices
    const trimmedVoiceChoice = voiceChoice && typeof voiceChoice === 'string' ? voiceChoice.trim() : '';
    
    let voiceConfig: { provider: '11labs' | 'vapi'; voiceId: string } | undefined;
    let voiceMapping: any = undefined; // Initialize outside the if block for logging
    
    if (trimmedVoiceChoice) {
      // Try to get voice config using helper (handles curated library IDs)
      const { getVoiceConfigForVAPI } = await import('./voiceConfigHelper');
      voiceConfig = await getVoiceConfigForVAPI(trimmedVoiceChoice);
      
      // Fallback: Check legacy mapping system
      if (!voiceConfig) {
        voiceMapping = getElevenLabsMapping(trimmedVoiceChoice);
        if (voiceMapping?.elevenLabsVoiceId) {
          voiceConfig = {
            provider: '11labs',
            voiceId: voiceMapping.elevenLabsVoiceId,
          };
        } else {
          // Check if it looks like an ElevenLabs voice ID (long alphanumeric string)
          // ElevenLabs IDs are typically 17-20 characters, alphanumeric
          const looksLikeElevenLabsId = /^[a-zA-Z0-9]{15,}$/.test(trimmedVoiceChoice) && 
                                         trimmedVoiceChoice.length >= 15 && 
                                         trimmedVoiceChoice.length <= 25;
          
          if (looksLikeElevenLabsId) {
            // It's an ElevenLabs voice ID - use 11labs provider
            voiceConfig = {
              provider: '11labs',
              voiceId: trimmedVoiceChoice,
            };
          } else {
            // Assume VAPI voice name (short, simple names like "Elliot", "Kylie")
            voiceConfig = {
              provider: 'vapi',
              voiceId: trimmedVoiceChoice,
            };
          }
        }
        
        // Log fallback logic for debugging
        console.log('[VAPI DEBUG] Voice config fallback logic:', {
          trimmedVoiceChoice,
          hasMapping: !!voiceMapping,
          looksLikeElevenLabsId: /^[a-zA-Z0-9]{15,}$/.test(trimmedVoiceChoice) && 
                                 trimmedVoiceChoice.length >= 15 && 
                                 trimmedVoiceChoice.length <= 25,
          finalProvider: voiceConfig?.provider,
          finalVoiceId: voiceConfig?.voiceId,
        });
      }
    }

    // Log voice configuration for debugging
    console.log('[VAPI DEBUG] createAgentFromTemplate voice configuration:', {
      voiceChoice: voiceChoice,
      trimmedVoiceChoice: trimmedVoiceChoice,
      voiceMapping: voiceMapping,
      voiceConfig: voiceConfig,
      hasVoiceConfig: !!voiceConfig,
      provider: voiceConfig?.provider,
      fullName: fullName,
    });

    // Get webhook URL for serverless functions
    const webhookUrl = process.env.VAPI_WEBHOOK_URL || process.env.NEXT_PUBLIC_WEBHOOK_URL;
    
    // Create function definitions with explicit serverUrl for real-time execution
    // VAPI requires serverUrl on each function for real-time webhook calls
    const functionsWithServerUrl = [
      { ...CHECK_IF_OWNER_FUNCTION, serverUrl: webhookUrl },
      { ...CAPTURE_NOTE_FUNCTION, serverUrl: webhookUrl },
      { ...MAKE_OUTBOUND_CALL_FUNCTION, serverUrl: webhookUrl },
      { ...SCHEDULE_OUTBOUND_CALL_FUNCTION, serverUrl: webhookUrl },
      { ...GET_USER_CONTEXT_FUNCTION, serverUrl: webhookUrl },
      { ...GET_USER_CONTACTS_FUNCTION, serverUrl: webhookUrl },
      { ...GET_USER_DOCUMENTS_FUNCTION, serverUrl: webhookUrl },
    ].filter(fn => fn.serverUrl); // Only include functions if webhookUrl is available

    // Create the assistant with proper API structure
    const requestBody: any = {
      name: `My ${assistantName} - ${fullName}`,
      model: {
        provider: 'openai',
        model: process.env.VAPI_DEFAULT_MODEL || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
        ],
        functions: functionsWithServerUrl.length > 0 ? functionsWithServerUrl : [CHECK_IF_OWNER_FUNCTION, CAPTURE_NOTE_FUNCTION, MAKE_OUTBOUND_CALL_FUNCTION, SCHEDULE_OUTBOUND_CALL_FUNCTION, GET_USER_CONTEXT_FUNCTION, GET_USER_CONTACTS_FUNCTION, GET_USER_DOCUMENTS_FUNCTION],
      },
      // Removed firstMessage to allow check_if_owner function to be called first
      // firstMessage: 'Hello!',
      backgroundSound: 'off',
    };

    // CRITICAL: Always add voice config if provided - this ensures voice is set correctly
    if (voiceConfig) {
      requestBody.voice = voiceConfig;
      console.log('[VAPI DEBUG] Voice config added to request body:', voiceConfig);
    } else {
      console.warn('[VAPI WARNING] No voice config in createAgentFromTemplate - voiceChoice was:', voiceChoice);
    }

    // Add server URL for webhook (for end-of-call events and fallback)
    if (webhookUrl) {
      requestBody.serverUrl = webhookUrl;
      console.log('[VAPI INFO] Setting serverUrl to:', webhookUrl);
      console.log('[VAPI INFO] Functions configured with serverUrl for real-time execution:', functionsWithServerUrl.map(f => f.name));
    } else {
      console.warn('[VAPI WARNING] No webhook URL configured - functions will not work in real-time');
    }

    // Add forwarding phone number if call forwarding is enabled
    if (forwardCalls && mobileNumber) {
      const trimmedMobile = typeof mobileNumber === 'string' ? mobileNumber.trim() : String(mobileNumber).trim();
      
      if (trimmedMobile.length > 0) {
        const formattedNumber = formatPhoneNumberToE164(trimmedMobile);
        
        if (formattedNumber && 
            typeof formattedNumber === 'string' && 
            formattedNumber.trim().length >= 11 && 
            formattedNumber.trim().startsWith('+')) {
          requestBody.forwardingPhoneNumber = formattedNumber.trim();
        }
      }
    }

    // Log the full request body (redact system prompt for brevity)
    console.log('[VAPI DEBUG] createAgentFromTemplate request body:', {
      name: requestBody.name,
      voice: requestBody.voice,
      backgroundSound: requestBody.backgroundSound,
      hasSystemPrompt: !!requestBody.model?.messages?.[0]?.content,
      systemPromptLength: requestBody.model?.messages?.[0]?.content?.length || 0,
    });

    const response = await fetch(`${VAPI_API_URL}/assistant`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || `VAPI API error: ${response.status} ${response.statusText}`;
      console.error('[VAPI ERROR] createAgentFromTemplate failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        fullName,
        voiceConfig: requestBody.voice,
      });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    
    // Log the response to verify voice was set correctly
    console.log('[VAPI DEBUG] createAgentFromTemplate response:', {
      agentId: result.id || result.agentId,
      voice: result.voice,
      voiceId: result.voice?.voiceId,
      voiceProvider: result.voice?.provider,
    });
    
    return result;
  } catch (error) {
    console.error('[VAPI ERROR] createAgentFromTemplate failed:', error);
    throw error;
  }
}

/**
 * Update an existing VAPI assistant agent using template system (new format)
 */
export async function updateAgentFromTemplate({
  agentId,
  fullName,
  nickname,
  kendallName,
  mobileNumber,
  selectedTraits,
  useCaseChoice,
  boundaryChoices,
  userContextAndRules,
  forwardCalls = false,
  voiceChoice,
  analyzedFileContent,
  fileUsageInstructions,
}: {
  agentId: string;
  fullName: string;
  nickname?: string;
  kendallName: string;
  mobileNumber: string;
  selectedTraits: string[];
  useCaseChoice: string;
  boundaryChoices: string[];
  userContextAndRules: string;
  forwardCalls?: boolean;
  voiceChoice?: string;
  analyzedFileContent?: string;
  fileUsageInstructions?: string;
}) {
  try {
    // Use provided kendallName or default to 'Kendall'
    const assistantName = (kendallName && kendallName.trim()) || 'Kendall';
    
    console.log('[VAPI DEBUG] updateAgentFromTemplate called with:');
    console.log('[VAPI DEBUG] - agentId:', agentId);
    console.log('[VAPI DEBUG] - fullName:', fullName);
    console.log('[VAPI DEBUG] - analyzedFileContent length:', analyzedFileContent?.length || 0);
    console.log('[VAPI DEBUG] - analyzedFileContent preview:', analyzedFileContent?.substring(0, 200) || 'EMPTY');
    console.log('[VAPI DEBUG] - analyzedFileContent includes WHO THEY ARE:', analyzedFileContent?.includes('WHO THEY ARE') || false);
    console.log('[VAPI DEBUG] - analyzedFileContent includes WORK EXPERIENCE:', analyzedFileContent?.includes('WORK EXPERIENCE') || false);
    
    // Format owner phone number for prompt (use E.164 format for consistency)
    const ownerPhoneNumber = mobileNumber ? (formatPhoneNumberToE164(mobileNumber) || mobileNumber) : undefined;
    
    // Build full detailed system prompt (~300 lines)
    const systemPrompt = buildSystemPrompt({
      kendallName: assistantName,
      fullName,
      nickname,
      selectedTraits,
      useCaseChoice,
      boundaryChoices,
      userContextAndRules,
      analyzedFileContent,
      fileUsageInstructions,
      ownerPhoneNumber,
    });
    
    console.log('[VAPI DEBUG] Lean system prompt built:');
    console.log('[VAPI DEBUG] - System prompt length:', systemPrompt.length);
    console.log('[VAPI DEBUG] - System prompt token estimate:', Math.ceil(systemPrompt.length / 4));

    // Build voice configuration - handle both ElevenLabs and VAPI voices
    const trimmedVoiceChoice = voiceChoice && typeof voiceChoice === 'string' ? voiceChoice.trim() : '';
    
    let voiceConfig: { provider: '11labs' | 'vapi'; voiceId: string } | undefined;
    let voiceMapping: any = undefined; // Initialize outside the if block for logging
    
    if (trimmedVoiceChoice) {
      // Try to get voice config using helper (handles curated library IDs)
      const { getVoiceConfigForVAPI } = await import('./voiceConfigHelper');
      voiceConfig = await getVoiceConfigForVAPI(trimmedVoiceChoice);
      
      // Fallback: Check legacy mapping system
      if (!voiceConfig) {
        voiceMapping = getElevenLabsMapping(trimmedVoiceChoice);
        if (voiceMapping?.elevenLabsVoiceId) {
          voiceConfig = {
            provider: '11labs',
            voiceId: voiceMapping.elevenLabsVoiceId,
          };
        } else {
          // Check if it looks like an ElevenLabs voice ID (long alphanumeric string)
          // ElevenLabs IDs are typically 17-20 characters, alphanumeric
          const looksLikeElevenLabsId = /^[a-zA-Z0-9]{15,}$/.test(trimmedVoiceChoice) && 
                                         trimmedVoiceChoice.length >= 15 && 
                                         trimmedVoiceChoice.length <= 25;
          
          if (looksLikeElevenLabsId) {
            // It's an ElevenLabs voice ID - use 11labs provider
            voiceConfig = {
              provider: '11labs',
              voiceId: trimmedVoiceChoice,
            };
          } else {
            // Assume VAPI voice name (short, simple names like "Elliot", "Kylie")
            voiceConfig = {
              provider: 'vapi',
              voiceId: trimmedVoiceChoice,
            };
          }
        }
        
        // Log fallback logic for debugging
        console.log('[VAPI DEBUG] Voice config fallback logic:', {
          trimmedVoiceChoice,
          hasMapping: !!voiceMapping,
          looksLikeElevenLabsId: /^[a-zA-Z0-9]{15,}$/.test(trimmedVoiceChoice) && 
                                 trimmedVoiceChoice.length >= 15 && 
                                 trimmedVoiceChoice.length <= 25,
          finalProvider: voiceConfig?.provider,
          finalVoiceId: voiceConfig?.voiceId,
        });
      }
    }

    // Log voice configuration for debugging
    console.log('[VAPI DEBUG] updateAgentFromTemplate voice configuration:', {
      agentId: agentId,
      voiceChoice: voiceChoice,
      trimmedVoiceChoice: trimmedVoiceChoice,
      voiceMapping: voiceMapping,
      voiceConfig: voiceConfig,
      hasVoiceConfig: !!voiceConfig,
      provider: voiceConfig?.provider,
      fullName: fullName,
    });

    // Get webhook URL for serverless functions
    const webhookUrl = process.env.VAPI_WEBHOOK_URL || process.env.NEXT_PUBLIC_WEBHOOK_URL;
    
    // Create function definitions with explicit serverUrl for real-time execution
    const functionsWithServerUrl = [
      { ...CHECK_IF_OWNER_FUNCTION, serverUrl: webhookUrl },
      { ...CAPTURE_NOTE_FUNCTION, serverUrl: webhookUrl },
      { ...MAKE_OUTBOUND_CALL_FUNCTION, serverUrl: webhookUrl },
      { ...SCHEDULE_OUTBOUND_CALL_FUNCTION, serverUrl: webhookUrl },
      { ...GET_USER_CONTEXT_FUNCTION, serverUrl: webhookUrl },
      { ...GET_USER_CONTACTS_FUNCTION, serverUrl: webhookUrl },
      { ...GET_USER_DOCUMENTS_FUNCTION, serverUrl: webhookUrl },
    ].filter(fn => fn.serverUrl); // Only include functions if webhookUrl is available

    // Build update request body
    const requestBody: any = {
      name: `My ${assistantName} - ${fullName}`,
      model: {
        provider: 'openai',
        model: process.env.VAPI_DEFAULT_MODEL || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
        ],
        functions: functionsWithServerUrl.length > 0 ? functionsWithServerUrl : [CHECK_IF_OWNER_FUNCTION, CAPTURE_NOTE_FUNCTION, MAKE_OUTBOUND_CALL_FUNCTION, SCHEDULE_OUTBOUND_CALL_FUNCTION, GET_USER_CONTEXT_FUNCTION, GET_USER_CONTACTS_FUNCTION, GET_USER_DOCUMENTS_FUNCTION],
      },
      backgroundSound: 'off',
      firstMessage: null, // Explicitly remove firstMessage to allow check_if_owner to be called first
    };

    // CRITICAL: Always add voice config if provided - this ensures voice is set correctly
    if (voiceConfig) {
      requestBody.voice = voiceConfig;
      console.log('[VAPI DEBUG] Voice config added to update request body:', voiceConfig);
    } else {
      console.warn('[VAPI WARNING] No voice config in updateAgentFromTemplate - voiceChoice was:', voiceChoice);
    }

    // Add forwarding phone number if call forwarding is enabled and valid
    if (forwardCalls && mobileNumber) {
      const trimmedMobile = typeof mobileNumber === 'string' ? mobileNumber.trim() : String(mobileNumber).trim();
      
      if (trimmedMobile.length > 0) {
        const formattedNumber = formatPhoneNumberToE164(trimmedMobile);
        
        if (formattedNumber && 
            typeof formattedNumber === 'string' && 
            formattedNumber.trim().length >= 11 && 
            formattedNumber.trim().startsWith('+')) {
          const cleanNumber = formattedNumber.trim();
          requestBody.forwardingPhoneNumber = cleanNumber;
          console.log('[VAPI INFO] Setting forwardingPhoneNumber to:', cleanNumber);
        } else {
          console.warn('[VAPI WARNING] Invalid formatted number - not adding forwardingPhoneNumber:', {
            original: trimmedMobile,
            formatted: formattedNumber,
          });
        }
      }
    } else if (!forwardCalls) {
      // Explicitly remove forwarding if disabled
      requestBody.forwardingPhoneNumber = null;
    }

    // Add server URL for webhook (for end-of-call events and fallback)
    if (webhookUrl) {
      requestBody.serverUrl = webhookUrl;
      console.log('[VAPI INFO] Setting serverUrl to:', webhookUrl);
      console.log('[VAPI INFO] Functions configured with serverUrl for real-time execution:', functionsWithServerUrl.map(f => f.name));
    } else {
      console.warn('[VAPI WARNING] No webhook URL configured - functions will not work in real-time');
    }

    console.log('[VAPI DEBUG] Assistant update (template) request body:', {
      name: requestBody.name,
      voice: requestBody.voice,
      backgroundSound: requestBody.backgroundSound,
      hasSystemPrompt: !!requestBody.model?.messages?.[0]?.content,
      systemPromptLength: requestBody.model?.messages?.[0]?.content?.length || 0,
    });

    // Use PATCH to update existing assistant
    const response = await fetch(`${VAPI_API_URL}/assistant/${agentId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || `VAPI API error: ${response.status} ${response.statusText}`;
      console.error('[VAPI ERROR] updateAgentFromTemplate failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        agentId,
        fullName,
        voiceConfig: requestBody.voice,
      });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    
    // Log the response to verify voice was set correctly
    console.log('[VAPI DEBUG] updateAgentFromTemplate response:', {
      agentId: result.id || result.agentId || agentId,
      voice: result.voice,
      voiceId: result.voice?.voiceId,
      voiceProvider: result.voice?.provider,
    });
    
    return result;
  } catch (error) {
    console.error('[VAPI ERROR] updateAgentFromTemplate failed:', error);
    throw error;
  }
}

/**
 * Update an existing VAPI assistant agent
 */
export async function updateAgent({
  agentId,
  fullName,
  forwardCalls,
  mobileNumber,
  personalityChoices,
  personalityText,
  customizationOptions,
  userContext,
  additionalInstructions,
  voiceChoice,
  kendallName,
  analyzedFileContent,
}: {
  agentId: string;
  fullName: string;
  forwardCalls?: boolean;
  mobileNumber?: string;
  personalityChoices?: string[];
  personalityText?: string;
  customizationOptions?: string[];
  userContext: string;
  additionalInstructions?: string;
  voiceChoice?: string;
  kendallName?: string;
  analyzedFileContent?: string;
}) {
  try {
    // Use provided kendallName or default to 'Kendall'
    const assistantName = (kendallName && kendallName.trim()) || 'Kendall';
    
    // Build personality using hybrid logic (same as createAgent)
    const personality = buildPersonality({
      choices: personalityChoices,
      customText: personalityText,
      options: customizationOptions,
    });

    // Build call forwarding rules
    const callForwardingRules = forwardCalls
      ? `When callers request to speak directly with ${fullName}, forward the call to ${fullName}'s mobile number.`
      : `Do not forward calls. Handle all inquiries yourself as ${fullName}'s personal assistant.`;

    // Build purpose description
    const purposeDescription = `You are ${assistantName}, the personal AI assistant for ${fullName}. Your purpose is to represent ${fullName} professionally and handle calls on their behalf. Use the context about ${fullName} to answer questions accurately and naturally. Be helpful, professional, and make every caller feel valued.`;

    // Build file content section if available with explicit instructions
    const fileContentSection = analyzedFileContent && analyzedFileContent.trim()
      ? `=== DETAILED INFORMATION ABOUT ${fullName} ===
The following information comes from ${fullName}'s professional documents (resume, CV, portfolio). This is your PRIMARY source of specific information about ${fullName}.

${analyzedFileContent}

⚠️ MANDATORY INSTRUCTIONS FOR USING THIS INFORMATION:

1. When asked ANY question about ${fullName}'s experience, background, achievements, or skills, you MUST reference the specific information from the sections above.

2. CRITICAL: Use ALL information from the sections, not just a subset:
   - From "WORK EXPERIENCE": Mention ALL companies and roles listed (e.g., if there are 3 companies, mention all 3)
   - From "KEY ACHIEVEMENTS": Reference multiple achievements, not just one
   - From "EDUCATION": Use exact institution, degree, and graduation year
   - From "LEADERSHIP & ACTIVITIES": Mention all leadership roles and activities listed

3. Use EXACT details from the sections:
   - Use exact company names, job titles, dates, and achievements with numbers
   - Cite specific achievements with exact numbers/percentages
   - Reference specific roles and achievements

4. SPEAK NATURALLY using the information:
   - GOOD FORMAT: "At [Company Name] as [Job Title], ${fullName} [specific achievement with numbers]. At [Another Company], they [another achievement]."
   - BAD: "They have consulting experience" or mentioning only one company
   - CRITICAL: Only use company names, institutions, and organizations that are explicitly listed in the sections above

5. When asked general questions like "What does ${fullName} do?" or "Tell me about ${fullName}":
   - Start with information from "WHO THEY ARE"
   - Then share ALL work experiences from "WORK EXPERIENCE" section - list each company, role, and key achievements
   - Include multiple specific achievements with numbers from "KEY ACHIEVEMENTS"
   - Mention leadership roles and activities from "LEADERSHIP & ACTIVITIES"
   - CRITICAL: Do not mention only one experience - you MUST share ALL experiences, companies, and achievements listed

6. NEVER say "I don't have that information" - the sections above contain your information source.

7. ALWAYS cite specific company names, job titles, dates, and numbers when available.

🚫 ABSOLUTELY FORBIDDEN - DO NOT:
- Make up, invent, or guess information that is NOT explicitly stated in the sections above
- Use generic information like "graduated from a university" - use the EXACT institution and year from "EDUCATION" section
- Say information that contradicts what's in the sections above (e.g., if EDUCATION says "Penn State, 2026", DO NOT say "UCLA, 2020" or "Lebanese American University")
- Use placeholder or generic information - ONLY use what is explicitly written in the sections above
- Mention universities, schools, organizations, or activities that are NOT explicitly listed in the "EDUCATION" or "LEADERSHIP & ACTIVITIES" sections
- For EDUCATION: ONLY mention the exact institution, degree, and year from the "EDUCATION" section - do NOT mention any other schools or universities, even if they seem related
- For LEADERSHIP & ACTIVITIES: ONLY mention roles and activities explicitly listed in the "LEADERSHIP & ACTIVITIES" section - do NOT invent organizations like "Lebanese Scout" or roles like "choir president" if they are not in the sections
- If asked about something NOT in the sections above, deflect naturally and professionally (e.g., "I'm not sure about that specific detail" or "Let me help you with something else I can tell you about" or redirect to relevant information you DO know) - DO NOT mention "files" or "documents" and maintain your role as their assistant

`
      : '';

    // Build system prompt (same as createAgent)
    const systemPrompt = `Identity & Context:
You are ${assistantName}, the personal AI assistant for ${fullName}.

About ${fullName}:
${userContext}${fileContentSection}

⚠️ CRITICAL: The "DETAILED INFORMATION ABOUT ${fullName}" section above contains your PRIMARY source of specific information. When answering ANY question about ${fullName}'s experience, background, achievements, or skills, you MUST reference the exact details from that section. Use specific company names, job titles, dates, numbers, and percentages. Never be vague or generic.

🚫 CRITICAL RULE: NEVER make up, invent, or guess information. ONLY use information that is explicitly stated in the "DETAILED INFORMATION ABOUT ${fullName}" section above. If asked about something not in that section, deflect naturally and professionally (e.g., "I'm not sure about that specific detail" or redirect to relevant information you DO know) - DO NOT mention "files" or "documents" and maintain your role as their assistant.

⚠️ CRITICAL: The "DETAILED INFORMATION ABOUT ${fullName}" section above contains your PRIMARY source of specific information. When answering ANY question about ${fullName}'s experience, background, achievements, or skills, you MUST reference the exact details from that section. Use specific company names, job titles, dates, numbers, and percentages. Never be vague or generic.

Speech Style:
Direct, clear, and human.
One question at a time.
Never ramble.

Personality & Communication Style:
${personality}

${additionalInstructions ? `Additional Instructions:\n${additionalInstructions}\n\n` : ''}Your Purpose:
${purposeDescription}

Call Forwarding Rules:
${callForwardingRules}

You must never give:
Medical, legal, or financial advice
Emotional counseling
Technical explanations of internal models
Claims about having feelings or intentions.

End of System Prompt`;

    // Build voice configuration - handle both ElevenLabs and VAPI voices
    const trimmedVoiceChoice = voiceChoice && typeof voiceChoice === 'string' ? voiceChoice.trim() : '';
    
    let voiceConfig: { provider: '11labs' | 'vapi'; voiceId: string } | undefined;
    let voiceMapping: any = undefined; // Initialize outside the if block for logging
    
    if (trimmedVoiceChoice) {
      // Try to get voice config using helper (handles curated library IDs)
      const { getVoiceConfigForVAPI } = await import('./voiceConfigHelper');
      voiceConfig = await getVoiceConfigForVAPI(trimmedVoiceChoice);
      
      // Fallback: Check legacy mapping system
      if (!voiceConfig) {
        voiceMapping = getElevenLabsMapping(trimmedVoiceChoice);
        if (voiceMapping?.elevenLabsVoiceId) {
          voiceConfig = {
            provider: '11labs',
            voiceId: voiceMapping.elevenLabsVoiceId,
          };
        } else {
          // Check if it looks like an ElevenLabs voice ID (long alphanumeric string)
          // ElevenLabs IDs are typically 17-20 characters, alphanumeric
          const looksLikeElevenLabsId = /^[a-zA-Z0-9]{15,}$/.test(trimmedVoiceChoice) && 
                                         trimmedVoiceChoice.length >= 15 && 
                                         trimmedVoiceChoice.length <= 25;
          
          if (looksLikeElevenLabsId) {
            // It's an ElevenLabs voice ID - use 11labs provider
            voiceConfig = {
              provider: '11labs',
              voiceId: trimmedVoiceChoice,
            };
          } else {
            // Assume VAPI voice name (short, simple names like "Elliot", "Kylie")
            voiceConfig = {
              provider: 'vapi',
              voiceId: trimmedVoiceChoice,
            };
          }
        }
        
        // Log fallback logic for debugging
        console.log('[VAPI DEBUG] Voice config fallback logic:', {
          trimmedVoiceChoice,
          hasMapping: !!voiceMapping,
          looksLikeElevenLabsId: /^[a-zA-Z0-9]{15,}$/.test(trimmedVoiceChoice) && 
                                 trimmedVoiceChoice.length >= 15 && 
                                 trimmedVoiceChoice.length <= 25,
          finalProvider: voiceConfig?.provider,
          finalVoiceId: voiceConfig?.voiceId,
        });
      }
    }

    // Log voice configuration for debugging
    console.log('[VAPI DEBUG] updateAgent voice configuration:', {
      agentId: agentId,
      voiceChoice: voiceChoice,
      trimmedVoiceChoice: trimmedVoiceChoice,
      voiceMapping: voiceMapping,
      voiceConfig: voiceConfig,
      hasVoiceConfig: !!voiceConfig,
      provider: voiceConfig?.provider,
      fullName: fullName,
    });

    // Build update request body
    const requestBody: any = {
      name: `My ${assistantName} - ${fullName}`,
      model: {
        provider: 'openai',
        model: process.env.VAPI_DEFAULT_MODEL || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
        ],
      },
      // Explicitly set background sound to Off by default
      backgroundSound: 'off',
      firstMessage: null, // Explicitly remove firstMessage to allow check_if_owner to be called first
    };

    // CRITICAL: Always add voice config if provided - this ensures voice is set correctly
    if (voiceConfig) {
      requestBody.voice = voiceConfig;
      console.log('[VAPI DEBUG] Voice config added to update request body:', voiceConfig);
    } else {
      console.warn('[VAPI WARNING] No voice config in updateAgent - voiceChoice was:', voiceChoice);
    }

    // Add forwarding phone number if call forwarding is enabled and valid
    if (forwardCalls && mobileNumber) {
      const trimmedMobile = typeof mobileNumber === 'string' ? mobileNumber.trim() : String(mobileNumber).trim();
      
      if (trimmedMobile.length > 0) {
        const formattedNumber = formatPhoneNumberToE164(trimmedMobile);
        
        if (formattedNumber && 
            typeof formattedNumber === 'string' && 
            formattedNumber.trim().length >= 11 && 
            formattedNumber.trim().startsWith('+')) {
          const cleanNumber = formattedNumber.trim();
          requestBody.forwardingPhoneNumber = cleanNumber;
          console.log('[VAPI INFO] Setting forwardingPhoneNumber to:', cleanNumber);
        } else {
          console.warn('[VAPI WARNING] Invalid formatted number - not adding forwardingPhoneNumber:', {
            original: trimmedMobile,
            formatted: formattedNumber,
          });
        }
      }
    } else if (!forwardCalls) {
      // Explicitly remove forwarding if disabled
      requestBody.forwardingPhoneNumber = null;
    }

    console.log('[VAPI DEBUG] Assistant update request body:', {
      name: requestBody.name,
      voice: requestBody.voice,
      backgroundSound: requestBody.backgroundSound,
      hasSystemPrompt: !!requestBody.model?.messages?.[0]?.content,
      systemPromptLength: requestBody.model?.messages?.[0]?.content?.length || 0,
      forwardingPhoneNumber: requestBody.forwardingPhoneNumber,
    });

    // Use PATCH to update existing assistant
    const response = await fetch(`${VAPI_API_URL}/assistant/${agentId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || `VAPI API error: ${response.status} ${response.statusText}`;
      console.error('[VAPI ERROR] updateAgent failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        agentId,
        fullName,
        voiceConfig: requestBody.voice,
      });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    
    // Log the response to verify voice was set correctly
    console.log('[VAPI DEBUG] updateAgent response:', {
      agentId: result.id || result.agentId || agentId,
      voice: result.voice,
      voiceId: result.voice?.voiceId,
      voiceProvider: result.voice?.provider,
    });
    
    return result;
  } catch (error) {
    console.error('[VAPI ERROR] updateAgent failed:', error);
    throw error;
  }
}

/**
 * Update background sound setting for an agent
 */
export async function updateAgentBackgroundSound(agentId: string, backgroundSound: 'off' | 'office' = 'off') {
  try {
    const response = await fetch(`${VAPI_API_URL}/assistant/${agentId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        backgroundSound,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || `VAPI API error: ${response.status} ${response.statusText}`;
      console.error('[VAPI ERROR] updateAgentBackgroundSound failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        agentId,
      });
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log(`[VAPI SUCCESS] Background sound set to '${backgroundSound}' for agent ${agentId}`);
    return result;
  } catch (error) {
    console.error('[VAPI ERROR] updateAgentBackgroundSound failed:', error);
    throw error;
  }
}

/**
 * Reassign a phone number to a different agent
 * This ensures that when an agent is updated, the phone number stays connected to the correct agent
 */
export async function reassignPhoneNumber(phoneNumber: string, agentId: string) {
  try {
    // Normalize phone number format - try both with and without + prefix
    const normalizePhone = (pn: string): string => {
      const cleaned = pn.replace(/\D/g, '');
      if (cleaned.length === 10) {
        return `+1${cleaned}`;
      } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
        return `+${cleaned}`;
      } else if (pn.startsWith('+')) {
        return pn;
      } else {
        return `+${cleaned}`;
      }
    };

    const normalizedNumber = normalizePhone(phoneNumber);
    console.log(`[VAPI INFO] Reassigning phone number ${normalizedNumber} to agent ${agentId}`);

    // First, try to list all phone numbers and find the one we need
    const listResponse = await fetch(`${VAPI_API_URL}/phone-number`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!listResponse.ok) {
      const errorData = await listResponse.json().catch(() => ({}));
      console.error('[VAPI ERROR] Failed to list phone numbers:', errorData);
      throw new Error(`Failed to list phone numbers: ${listResponse.status}`);
    }

    const listData = await listResponse.json();
    
    // VAPI might return phoneNumbers array or a different structure
    const phoneNumbers = listData.phoneNumbers || listData.data || (Array.isArray(listData) ? listData : []);
    
    // Find the phone number record - try multiple field names
    const phoneNumberRecord = phoneNumbers.find((pn: any) => {
      const pnNumber = pn.number || pn.phoneNumber || pn.phone_number || '';
      const pnNormalized = normalizePhone(pnNumber);
      const inputNormalized = normalizePhone(phoneNumber);
      
      // Compare normalized versions
      return pnNormalized === inputNormalized || 
             pnNormalized.replace(/\D/g, '') === inputNormalized.replace(/\D/g, '') ||
             pnNumber === phoneNumber ||
             pnNumber === normalizedNumber;
    });

    if (!phoneNumberRecord) {
      console.warn(`[VAPI WARNING] Phone number ${phoneNumber} (normalized: ${normalizedNumber}) not found in VAPI`);
      console.warn(`[VAPI DEBUG] Available phone numbers:`, phoneNumbers.map((pn: any) => pn.number || pn.phoneNumber || pn.phone_number || 'unknown'));
      return null;
    }

    const phoneNumberId = phoneNumberRecord.id;
    
    if (!phoneNumberId) {
      throw new Error(`Phone number ${phoneNumber} found but no ID returned`);
    }

    console.log(`[VAPI INFO] Found phone number ID: ${phoneNumberId}`);

    // Update the phone number to point to the new agent
    const updateResponse = await fetch(`${VAPI_API_URL}/phone-number/${phoneNumberId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        assistantId: agentId,
      }),
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json().catch(() => ({}));
      console.error('[VAPI ERROR] Failed to reassign phone number:', {
        status: updateResponse.status,
        statusText: updateResponse.statusText,
        errorData,
        phoneNumberId,
        agentId,
      });
      throw new Error(`Failed to reassign phone number: ${JSON.stringify(errorData)}`);
    }

    const updateResult = await updateResponse.json();
    console.log(`[VAPI SUCCESS] Phone number ${phoneNumber} reassigned to agent ${agentId}`);
    return updateResult;
  } catch (error) {
    console.error('[VAPI ERROR] reassignPhoneNumber failed:', error);
    throw error;
  }
}

/**
 * Purchase a phone number via Twilio and import it into Vapi
 * 
 * IMPORTANT: Vapi's API for Twilio provider only supports importing existing phone numbers,
 * not purchasing new ones directly. This function:
 * 1. First purchases a number via Twilio API (if credentials available)
 * 2. Then imports that number into Vapi
 * 
 * If you already have a Twilio number, you can import it directly by providing phoneNumber parameter.
 */
export async function purchaseNumber(assistantId: string, existingPhoneNumber?: string, label?: string) {
  try {
    console.log("[VAPI INFO] Setting up phone number for assistant:", assistantId);

    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!twilioAccountSid) {
      throw new Error("TWILIO_ACCOUNT_SID environment variable is required for phone number purchase");
    }
    
    // CRITICAL: The TWILIO_ACCOUNT_SID must match the Account SID configured in your Vapi dashboard
    // (Phone Numbers / Providers section). Vapi will verify the number exists in that specific account.
    console.log("[VAPI WARNING] Ensure TWILIO_ACCOUNT_SID matches the Account SID in Vapi dashboard settings");

    let phoneNumberToImport: string;
    let twilioSid: string | undefined = undefined;

    // If phone number is provided, use it directly
    if (existingPhoneNumber) {
      phoneNumberToImport = existingPhoneNumber;
      console.log("[VAPI INFO] Using provided phone number:", phoneNumberToImport);
    } 
    // Otherwise, try to purchase a new number via Twilio API first
    else if (twilioAuthToken) {
      console.log("[VAPI INFO] Purchasing new Canadian phone number via Twilio API...");
      
      // Retry logic for number purchase with exponential backoff
      const maxRetries = 3;
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Purchase phone number via Twilio API
          // Search for available Canadian numbers (no area code filtering - use any available)
          const searchParams = new URLSearchParams();
          searchParams.append('Limit', '1');
          
          // Use Canadian numbers instead of US
          const searchUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/AvailablePhoneNumbers/CA/Local.json?${searchParams.toString()}`;
          const searchResponse = await fetch(searchUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')}`,
            },
          });

          if (!searchResponse.ok) {
            const errorData = await searchResponse.json().catch(() => ({}));
            throw new Error(`Twilio search failed: ${JSON.stringify(errorData)}`);
          }

          const searchData = await searchResponse.json();
          // Twilio returns available_phone_numbers array
          const availableNumbers = searchData.available_phone_numbers || [];

          if (!availableNumbers || availableNumbers.length === 0) {
            throw new Error("No available Canadian phone numbers found in Twilio inventory");
          }

          const selectedNumber = availableNumbers[0].phone_number;
          console.log("[VAPI INFO] Found available Canadian number:", selectedNumber);

          // Purchase the number
          const purchaseUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers.json`;
          const purchaseResponse = await fetch(purchaseUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              PhoneNumber: selectedNumber,
            }),
          });

          if (!purchaseResponse.ok) {
            const errorData = await purchaseResponse.json().catch(() => ({}));
            throw new Error(`Twilio purchase failed: ${JSON.stringify(errorData)}`);
          }

          const purchaseData = await purchaseResponse.json();
          // Twilio returns phone_number in E.164 format (e.g., "+14165550123")
          phoneNumberToImport = purchaseData.phone_number;
          twilioSid = purchaseData.sid; // Store Twilio SID for later use
          console.log("[VAPI INFO] Successfully purchased Canadian number from Twilio:", phoneNumberToImport);
          console.log("[VAPI INFO] Twilio SID:", twilioSid);
          console.log("[VAPI DEBUG] Twilio purchase response:", JSON.stringify(purchaseData, null, 2));
          
          // Configure SMS webhook URL automatically
          if (twilioSid) {
            try {
              const smsWebhookUrl = process.env.SMS_WEBHOOK_URL || 
                (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                (process.env.NEXT_PUBLIC_BASE_URL || 'https://your-domain.com') + '/api/twilio-sms-webhook';
              
              console.log("[VAPI INFO] Configuring SMS webhook URL:", smsWebhookUrl);
              
              const updateUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers/${twilioSid}.json`;
              const updateResponse = await fetch(updateUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')}`,
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  SmsUrl: smsWebhookUrl,
                  SmsMethod: 'POST',
                }),
              });
              
              if (updateResponse.ok) {
                const updateData = await updateResponse.json();
                console.log("[VAPI SUCCESS] SMS webhook configured successfully");
                console.log("[VAPI DEBUG] Update response:", JSON.stringify(updateData, null, 2));
              } else {
                const errorData = await updateResponse.json().catch(() => ({}));
                console.warn("[VAPI WARNING] Failed to configure SMS webhook:", JSON.stringify(errorData));
                // Don't throw - webhook config is optional, number purchase was successful
              }
            } catch (webhookError) {
              console.warn("[VAPI WARNING] Error configuring SMS webhook:", webhookError);
              // Don't throw - webhook config is optional, number purchase was successful
            }
          }
          
          // Success - break out of retry loop
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.error(`[VAPI ERROR] Canadian number purchase attempt ${attempt}/${maxRetries} failed:`, lastError.message);
          
          if (attempt < maxRetries) {
            // Exponential backoff: wait 2^attempt seconds
            const delayMs = Math.pow(2, attempt) * 1000;
            console.log(`[VAPI INFO] Retrying in ${delayMs / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
      }
      
      // If all retries failed, throw the last error
      if (!phoneNumberToImport) {
        throw new Error(`Failed to purchase Canadian number after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
      }
      
      // Wait a moment for Twilio to fully provision the number before importing to Vapi
      // Sometimes there's a brief delay between purchase and availability
      console.log("[VAPI INFO] Waiting for Twilio to provision number...");
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      // Verify the number exists in Twilio before importing
      const verifyUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumberToImport)}`;
      let verified = false;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (!verified && attempts < maxAttempts) {
        attempts++;
        const verifyResponse = await fetch(verifyUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')}`,
          },
        });
        
        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.json();
          if (verifyData.incoming_phone_numbers && verifyData.incoming_phone_numbers.length > 0) {
            verified = true;
            console.log("[VAPI INFO] Number verified in Twilio account");
            break;
          }
        }
        
        if (attempts < maxAttempts) {
          console.log(`[VAPI INFO] Number not yet available, retrying (${attempts}/${maxAttempts})...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between retries
        }
      }
      
      if (!verified) {
        console.warn("[VAPI WARNING] Could not verify number in Twilio, proceeding with import anyway");
      }
    } else {
      throw new Error("TWILIO_AUTH_TOKEN environment variable is required to purchase new numbers. Alternatively, provide an existing phone number to import.");
    }

    // Format phone number to E.164 if needed
    // If number came from Twilio API, it's already in E.164 format
    const formatToE164 = (phone: string): string => {
      // If already in E.164 format (starts with +), use as-is
      if (phone.startsWith('+')) {
        return phone;
      }
      
      // Remove all non-digit characters
      const digits = phone.replace(/\D/g, '');
      // If it doesn't start with country code, add +1 for US/Canada (both use +1)
      if (digits.length === 10) {
        return `+1${digits}`;
      } else if (digits.length === 11 && digits.startsWith('1')) {
        return `+${digits}`;
      } else {
        return `+${digits}`;
      }
    };

    const e164Number = formatToE164(phoneNumberToImport);
    console.log("[VAPI INFO] Formatted to E.164:", e164Number);
    console.log("[VAPI INFO] Using Twilio Account SID:", twilioAccountSid);

    // Now import the number into Vapi using the correct API structure
    // Vapi API for Twilio provider only supports importing existing numbers
    // Note: label and smsEnabled cannot be set in POST - must be updated via PATCH after import
    const importPayload: Record<string, any> = {
      provider: "twilio",
      twilioAccountSid: twilioAccountSid, // Required: must be a string
      number: e164Number, // Must be E.164 format and must already exist in Twilio account (field name is "number", not "phoneNumber")
      assistantId: assistantId, // Include assistantId in POST - Vapi will wire it automatically
    };
    
    // Add Twilio Auth Token if available (required by dashboard form, might be needed for API too)
    if (twilioAuthToken) {
      importPayload.twilioAuthToken = twilioAuthToken;
    }
    
    // DO NOT include label or smsEnabled in POST - these must be set via PATCH after import

    console.log("[VAPI INFO] Importing Canadian phone number to Vapi:", importPayload);

    // Import number into Vapi using /phone-number endpoint with retry logic
    let response: Response;
    let data: any;
    let importAttempts = 0;
    const maxImportRetries = 3;
    let lastImportError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxImportRetries; attempt++) {
      try {
        response = await fetch("https://api.vapi.ai/phone-number", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.VAPI_PRIVATE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(importPayload),
        });
        
        data = await response.json();
        
        if (response.ok) {
          // Success - break out of retry loop
          importAttempts = attempt;
          break;
        }
        
        // If it's a non-retryable error (like authentication), throw immediately
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Vapi authentication/authorization error: ${JSON.stringify(data)}`);
        }
        
        // For other errors, try again
        lastImportError = new Error(`Vapi import failed (attempt ${attempt}/${maxImportRetries}): ${JSON.stringify(data)}`);
        console.warn(`[VAPI WARNING] Import attempt ${attempt}/${maxImportRetries} failed:`, lastImportError.message);
        
        if (attempt < maxImportRetries) {
          // Exponential backoff: wait 2^attempt seconds
          const delayMs = Math.pow(2, attempt) * 1000;
          console.log(`[VAPI INFO] Retrying import in ${delayMs / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        lastImportError = error instanceof Error ? error : new Error(String(error));
        console.error(`[VAPI ERROR] Import attempt ${attempt}/${maxImportRetries} exception:`, lastImportError.message);
        
        if (attempt < maxImportRetries) {
          // Exponential backoff: wait 2^attempt seconds
          const delayMs = Math.pow(2, attempt) * 1000;
          console.log(`[VAPI INFO] Retrying import in ${delayMs / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    // If all retries failed, throw error but keep the Twilio number (don't release it)
    if (!response! || !response!.ok) {
      const errorMsg = `Failed to import Canadian number to Vapi after ${maxImportRetries} attempts: ${lastImportError?.message || JSON.stringify(data)}`;
      console.error("[VAPI ERROR]", errorMsg);
      console.warn("[VAPI WARNING] Twilio number purchased but not imported to Vapi. Number SID:", twilioSid);
      console.warn("[VAPI WARNING] Manual intervention may be required to import the number or release it from Twilio.");
      
      // Provide helpful error message for common issues
      if (data && data.message && typeof data.message === 'string' && data.message.includes('Number Not Found')) {
        throw new Error(
          `${errorMsg}\n\n` +
          `TROUBLESHOOTING: The phone number was not found in the Twilio account.\n` +
          `1. Ensure TWILIO_ACCOUNT_SID matches the Account SID configured in Vapi dashboard (Phone Numbers / Providers)\n` +
          `2. Verify the number exists in your Twilio account: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming\n` +
          `3. Check that the number is in E.164 format: ${e164Number}\n` +
          `4. The number must be purchased in the SAME Twilio account that's configured in Vapi dashboard\n` +
          `5. Twilio number SID: ${twilioSid || 'N/A'} - you may need to manually import or release this number`
        );
      }
      
      throw new Error(errorMsg);
    }

    const normalizePhoneNumber = (details: any): string | null => {
      if (!details) return null;
      if (typeof details === "string") return details;

      // Check phoneNumber first (expected field name from Vapi response)
      const candidates = [
        details.phoneNumber, // Primary field name from Vapi API
        details.phone,
        details.number,
        details.phone_number,
        details.value,
        details.e164,
        details.national,
      ];

      for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) return candidate;
        if (candidate && typeof candidate === "object") {
          const nested = normalizePhoneNumber(candidate);
          if (nested) return nested;
        }
      }

      if (Array.isArray(details.phoneNumbers)) {
        for (const pn of details.phoneNumbers) {
          const nested = normalizePhoneNumber(pn);
          if (nested) return nested;
        }
      }

      return null;
    };

    console.log(`[VAPI DEBUG] Raw import response (attempt ${importAttempts}):`, JSON.stringify(data, null, 2));
    console.log("[VAPI DEBUG] Response keys:", Object.keys(data));

    if (!data.id) {
      throw new Error("Vapi did not return a phone number ID: " + JSON.stringify(data));
    }

    console.log("[VAPI INFO] Phone number imported to Vapi with ID:", data.id);
    console.log("[VAPI INFO] Phone number automatically assigned to assistant (assistantId in POST body)");

    // Update phone number label via PATCH request (if label provided)
    // This sets the label that appears in Vapi dashboard (e.g., user's full name)
    if (label && data.id) {
      try {
        // Determine the label to use
        const phoneLabel = label || process.env.VAPI_PHONE_LABEL || `Kendall - ${assistantId.substring(0, 8)}`;
        
        const updatePayload: Record<string, any> = {
          label: phoneLabel, // Set the label (user's full name from form)
          smsEnabled: true, // Enable SMS for Canadian numbers (supports both voice and SMS)
        };
        
        console.log("[VAPI INFO] Updating phone number label to:", phoneLabel);
        const updateResponse = await fetch(`${VAPI_API_URL}/phone-number/${data.id}`, {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify(updatePayload),
        });
        
        if (updateResponse.ok) {
          const updateData = await updateResponse.json().catch(() => ({}));
          console.log("[VAPI SUCCESS] Phone number label updated successfully:", phoneLabel);
          console.log("[VAPI DEBUG] Update response:", JSON.stringify(updateData, null, 2));
        } else {
          const updateError = await updateResponse.json().catch(() => ({}));
          console.warn("[VAPI WARNING] Failed to update phone number label:", JSON.stringify(updateError));
          // Don't throw error - label update is optional, import was successful
        }
      } catch (updateError) {
        console.warn("[VAPI WARNING] Error updating phone number label:", updateError);
        // Don't throw error - label update is optional, import was successful
      }
    }

    // Extract phone number from response
    // The response should include phoneNumber field (E.164 format) since assistantId was in POST
    let phoneNumber = normalizePhoneNumber(data);
    
    // If phone number not immediately available, try fetching details
    // (Sometimes provisioning takes a moment)
    if (!phoneNumber) {
      console.log("[VAPI INFO] Phone number not in initial response, fetching details...");
      const detailsResponse = await fetch(`${VAPI_API_URL}/phone-number/${data.id}`, {
        method: "GET",
        headers: getHeaders(),
      });

      if (detailsResponse.ok) {
        const phoneNumberDetails = await detailsResponse.json();
        console.log("[VAPI DEBUG] Phone number details:", JSON.stringify(phoneNumberDetails, null, 2));
        phoneNumber = normalizePhoneNumber(phoneNumberDetails);
      } else {
        console.warn("[VAPI WARNING] Failed to fetch phone number details, using purchase response");
      }
    }
    
    if (!phoneNumber) {
      console.warn("[VAPI WARNING] Phone number not found in response. It may still be provisioning.");
      console.warn("[VAPI WARNING] Response data:", JSON.stringify(data, null, 2));
    } else {
      console.log("[VAPI SUCCESS] Phone number extracted:", phoneNumber);
    }

    // Return phone number object
    // Note: Number is already assigned to assistant via assistantId in POST body
    // Use the phone number we imported, or extract from response, or use fallback
    const finalPhoneNumber = phoneNumber || e164Number || `Number imported (ID: ${data.id}) - check Vapi dashboard`;
    
    return {
      id: data.id,
      phone: finalPhoneNumber,
      country: data.country || "CA", // Default to CA for Canadian numbers
      twilioSid: twilioSid, // Include Twilio SID if available
    };

  } catch (error) {
    console.error("[VAPI ERROR] purchaseNumber failed:", error);
    throw error;
  }
}

/**
 * Cancel/end an active VAPI call
 * @param callId - The VAPI call ID to cancel
 * @returns Success/error status
 */
export async function cancelCall(callId: string): Promise<{ success: boolean; message: string }> {
  try {
    const apiKey = process.env.VAPI_PRIVATE_KEY;
    if (!apiKey) {
      throw new Error('VAPI_PRIVATE_KEY environment variable is not configured');
    }

    // CORRECT ENDPOINT: POST /call/{callId}/actions/end (NOT PATCH)
    const response = await fetch(`${VAPI_API_URL}/call/${callId}/actions/end`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || `Failed to cancel call: ${response.status} ${response.statusText}`;
      console.error('[VAPI ERROR] Failed to cancel call:', errorData);
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[VAPI] Call cancelled successfully:', callId);
    
    return {
      success: true,
      message: 'Call cancelled successfully',
    };
  } catch (error) {
    console.error('[VAPI ERROR] Failed to cancel call:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify owner's phone number in Twilio (for trial accounts)
 * This initiates a verification call to the owner's number
 */
export async function verifyOwnerPhoneNumber(phoneNumber: string): Promise<{ success: boolean; verificationSid?: string; error?: string }> {
  try {
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!twilioAccountSid || !twilioAuthToken) {
      return { success: false, error: 'Twilio credentials not configured' };
    }
    
    // Format phone number to E.164
    const formatPhoneNumberToE164 = (phone: string): string | null => {
      if (!phone || typeof phone !== 'string') return null;
      const trimmed = phone.trim();
      if (!trimmed) return null;
      
      if (trimmed.startsWith('+')) {
        const digits = trimmed.replace(/\D/g, '');
        if (digits.length >= 10) return `+${digits}`;
        return null;
      }
      
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length < 10) return null;
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
      return `+1${digits}`;
    };
    
    const formattedPhone = formatPhoneNumberToE164(phoneNumber);
    if (!formattedPhone) {
      return { success: false, error: 'Invalid phone number format' };
    }
    
    // Use Twilio's Outgoing Caller IDs API to verify the number
    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/OutgoingCallerIds.json`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        PhoneNumber: formattedPhone,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || `Twilio API error: ${response.status}`;
      console.warn('[VAPI WARNING] Failed to initiate phone verification:', errorMessage);
      return { success: false, error: errorMessage };
    }
    
    const data = await response.json();
    console.log('[VAPI SUCCESS] Phone verification initiated:', {
      phoneNumber: formattedPhone,
      verificationSid: data.sid,
      status: data.status,
    });
    
    return { success: true, verificationSid: data.sid };
  } catch (error) {
    console.error('[VAPI ERROR] Exception while verifying phone number:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
