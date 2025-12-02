import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord, getOrCreateThreadId, createChatMessage, getChatMessages, createOutboundCallRequest } from '@/lib/airtable';
import { buildSystemPrompt } from '@/lib/promptBlocks';
import { formatPhoneNumberToE164 } from '@/lib/vapi';
import { extractPatternsFromMessage } from '@/lib/patternExtractor';
import { extractContactFromMessage } from '@/lib/contactExtractor';
import { analyzeSentiment, getResponseTone } from '@/lib/sentiment';
import { selectModel } from '@/lib/modelSelector';
import { checkRateLimit } from '@/lib/rateLimiter';
import OpenAI from 'openai';

const CHAT_FUNCTIONS = [
  {
    name: 'make_outbound_call',
    description: 'Make an outbound call to a specified phone number and deliver a message on behalf of the owner. Use this when the owner requests an immediate call. EXECUTE IMMEDIATELY when you have phone_number and message - do not ask for additional information.',
    parameters: {
      type: 'object',
      properties: {
        phone_number: {
          type: 'string',
          description: 'The phone number to call. Can be in any format (10 digits: 8149969612, formatted: (814) 996-9612, with country code: +18149969612, etc.). The system will normalize it automatically. Extract the phone number directly from the user\'s message if provided.',
        },
        message: {
          type: 'string',
          description: 'The message to deliver during the call',
        },
        caller_name: {
          type: 'string',
          description: 'Optional: The name of the recipient being called (e.g., "Ali", "John"). Extract this from the user\'s message if mentioned (e.g., "call Ali", "tell John"). If not provided, the call will still proceed.',
        },
      },
      required: ['phone_number', 'message'],
    },
  },
  {
    name: 'schedule_outbound_call',
    description: 'Schedule an outbound call to a specified phone number for a future date/time. Use this when the owner requests a call to be made at a specific time.',
    parameters: {
      type: 'object',
      properties: {
        phone_number: {
          type: 'string',
          description: 'The phone number to call. Can be in any format (10 digits: 8149969612, formatted: (814) 996-9612, with country code: +18149969612, etc.). The system will normalize it automatically. Extract the phone number directly from the user\'s message if provided.',
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
          description: 'Optional: The name of the recipient being called (e.g., "Ali", "John"). Extract this from the user\'s message if mentioned. If not provided, the call will still proceed.',
        },
      },
      required: ['phone_number', 'message', 'scheduled_time'],
    },
  },
  {
    name: 'get_calendar_events',
    description: 'Get calendar events from the user\'s Google Calendar. Use this when the user asks about their schedule, upcoming events, what they have today/tomorrow/this week, or any calendar-related questions.',
    parameters: {
      type: 'object',
      properties: {
        recordId: {
          type: 'string',
          description: 'The user\'s recordId (required to identify which user\'s calendar to access)',
        },
        startDate: {
          type: 'string',
          description: 'Optional: Start date in ISO format (YYYY-MM-DD) or ISO 8601 datetime. If not provided, defaults to now.',
        },
        endDate: {
          type: 'string',
          description: 'Optional: End date in ISO format (YYYY-MM-DD) or ISO 8601 datetime. If not provided, fetches upcoming events.',
        },
        maxResults: {
          type: 'number',
          description: 'Optional: Maximum number of events to return (default: 10)',
        },
      },
      required: ['recordId'],
    },
  },
  {
    name: 'get_gmail_messages',
    description: 'Get Gmail messages from the user\'s inbox. Use this when the user asks about their emails, unread messages, recent emails, or any email-related questions.',
    parameters: {
      type: 'object',
      properties: {
        recordId: {
          type: 'string',
          description: 'The user\'s recordId (required to identify which user\'s Gmail to access)',
        },
        unread: {
          type: 'boolean',
          description: 'Optional: If true, only return unread messages (default: false)',
        },
        maxResults: {
          type: 'number',
          description: 'Optional: Maximum number of messages to return (default: 10)',
        },
      },
      required: ['recordId'],
    },
  },
];

/**
 * Generate chat response using OpenAI with agent's system prompt and function calling
 */
async function generateChatResponse(
  agentRecordId: string,
  incomingMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  isFirstMessage: boolean = false
): Promise<{ response: string; functionCalls?: Array<{ name: string; arguments: any }>; kendallName?: string }> {
  try {
    // Get agent data from Airtable
    const agentRecord = await getUserRecord(agentRecordId);
    if (!agentRecord || !agentRecord.fields) {
      throw new Error('Agent record not found');
    }
    
    const fields = agentRecord.fields;
    const fullName = fields.fullName;
    const nickname = fields.nickname;
    const kendallName = fields.kendallName || 'Kendall';
    const selectedTraits = Array.isArray(fields.selectedTraits) ? fields.selectedTraits : [];
    const useCaseChoice = fields.useCaseChoice || 'Mixed / Everything';
    const boundaryChoices = Array.isArray(fields.boundaryChoices) ? fields.boundaryChoices : [];
    const userContextAndRules = fields.userContextAndRules || '';
    const analyzedFileContent = fields.analyzedFileContent || '';
    const fileUsageInstructions = fields.fileUsageInstructions || '';
    const mobileNumber = fields.mobileNumber;
    
    // Build system prompt
    const systemPrompt = buildSystemPrompt({
      kendallName: String(kendallName),
      fullName: String(fullName),
      nickname: nickname ? String(nickname) : undefined,
      selectedTraits: selectedTraits.map(String),
      useCaseChoice: String(useCaseChoice),
      boundaryChoices: boundaryChoices.map(String),
      userContextAndRules: String(userContextAndRules),
      analyzedFileContent: analyzedFileContent ? String(analyzedFileContent) : undefined,
      fileUsageInstructions: fileUsageInstructions ? String(fileUsageInstructions) : undefined,
      ownerPhoneNumber: mobileNumber ? String(mobileNumber) : undefined,
    });
    
    // Use isFirstMessage passed as parameter (determined in POST handler)
    const fullNameStr = fullName ? String(fullName) : 'there';
    const nicknameStr = nickname && String(nickname).trim() ? String(nickname).trim() : null;
    const nicknameOrFullName = nicknameStr || fullNameStr;
    
    // Add chat-specific instructions
    const chatSystemPrompt = `${systemPrompt}

=== CHAT INTERFACE INSTRUCTIONS ===
🚨 CRITICAL: This is a CHAT interface, NOT a phone call. Do NOT use phone call scripts or ask phone call questions.

CHAT-SPECIFIC BEHAVIOR:
- Speak naturally and casually - like you're texting with the owner, not a formal phone call
- This is a text conversation, NOT a phone call script
- Be concise but friendly - chat allows for quick back-and-forth
- Use natural language patterns - "What's up?" is fine, you don't need to say "How may I assist you?"
- When the owner gives instructions, acknowledge naturally without over-explaining

${isFirstMessage ? `FIRST MESSAGE ONLY - CASUAL GREETING (MANDATORY):
🚨🚨🚨 YOU MUST ALWAYS USE CASUAL GREETING FORMAT - THIS IS ABSOLUTELY REQUIRED 🚨🚨🚨
- This is the FIRST message in the conversation - you MUST greet ${nicknameOrFullName} by name using CASUAL format
- Use their nickname if available (${nicknameStr ? `"${nicknameStr}"` : 'not available'}), otherwise use their full name ("${fullNameStr}")
- You MUST use one of these casual greeting formats - NO EXCEPTIONS:
  * "Hi ${nicknameOrFullName}! What's up?"
  * "Hey ${nicknameOrFullName}! What's up?"
  * "What's up ${nicknameOrFullName}?"
  
🚫 ABSOLUTELY FORBIDDEN - NEVER USE THESE:
- "Hello! How can I help you today?" ❌
- "Hello! How can I assist you?" ❌
- "How can I help you?" ❌
- Any formal or corporate greeting ❌
- Generic greetings without their name ❌

✅ REQUIRED: Use casual, friendly greeting with their name - think texting a friend, not a business call
- After this first greeting, don't repeatedly use their name - be conversational (e.g., "Got it!" not "Got it, ${nicknameOrFullName}!")` : `- DON'T repeatedly use the owner's name - just be conversational (e.g., "Got it!" not "Got it, ${nicknameOrFullName}!")`}

PHONE NUMBER RECOGNITION AND VALIDATION:
- When the owner provides a phone number (in any format: 8149969612, (814) 996-9612, 814-996-9612, +18149969612), extract it immediately
- VALIDATE phone number format before calling function:
  * Valid: 10 digits (8149969612), 11 digits starting with 1 (18149969612), formatted (814) 996-9612
  * Invalid: More than 11 digits, less than 10 digits, clearly wrong format
- If phone number format looks invalid or unclear, ask: "I need a valid phone number format. Can you provide it as 10 digits (like 8149969612) or formatted (like (814) 996-9612)?"
- Don't call the function if phone number format is clearly wrong - ask user to clarify first

CALL FUNCTIONALITY - CRITICAL RULES:
🚨 THIS IS CHAT - EXECUTE IMMEDIATELY, DO NOT ASK UNNECESSARY QUESTIONS:
- NEVER ask "Would you like me to make the call immediately or schedule it for a specific time?" - this is a phone call script, NOT for chat
- NEVER ask "Should I call them now or later?" - just execute based on what the user says
- NEVER ask for information you already have - if the user provided phone number and message, EXECUTE IMMEDIATELY
- If the user says "call X" or "make a call" without a time → use make_outbound_call immediately
- If the user specifies a time (e.g., "call at 3pm" or "schedule a call for Friday") → use schedule_outbound_call
- When owner requests a call, extract: phone number, message to deliver, recipient name (if mentioned)
- EXECUTE THE FUNCTION IMMEDIATELY after extracting information - do NOT ask for confirmation or additional details
- Be direct and action-oriented - execute the function call, then say "I'll call them now" or similar
- If you have phone number AND message, you MUST execute the call - do NOT ask for anything else

OUTBOUND CALL SUMMARIES - CRITICAL KNOWLEDGE:
🚨 IMPORTANT: When you make outbound calls, you AUTOMATICALLY receive a summary/transcript when the call ends.
- The system automatically posts call summaries to this chat when calls complete
- You DO receive call transcripts and summaries - you don't need to ask for them
- When a user asks "what did they say?" or "what happened on the call?", you should respond: "I'll share the call summary once it completes" or "The call summary will appear here automatically when the call ends"
- NEVER say "I can't get responses" or "I'm only set up to deliver messages, not receive them" - this is INCORRECT
- You WILL receive and can share call summaries automatically
- If a call just completed, check the conversation history - the summary may already be posted

RECIPIENT NAME HANDLING - OPTIONAL BUT PREFERRED:
- PREFER to have recipient name, but DO NOT block execution if name is missing
- Extract name from context if possible: "Ali" from "call Ali", "tell John", "message Sarah"
- If name is clearly stated in the message, use it in the caller_name parameter
- If name is NOT provided, you can still execute the call - just omit caller_name or use a generic value
- ONLY ask for name if it's truly unclear AND you think it's critical - but prioritize execution over asking
- CRITICAL: If you asked "What's their name?" and the user responds with a name (e.g., "Ali"), that IS the recipient name - extract it and execute the call IMMEDIATELY
- Use conversation history - if the user provided phone number and message in previous messages, combine that with the name from current message and execute
- NEVER ask for information you already have from the conversation history

TONE ADJUSTMENT:
- Less formal than phone calls - this is a text conversation
- More casual, friendly, and efficient
- Skip unnecessary pleasantries after the first message
- Get to the point quickly while staying helpful
- Remember: Chat interface, not phone call - no phone call scripts!

=== RESPONSE FORMATTING & READABILITY ===
🚨 CRITICAL: When you respond, ALWAYS use clear structure and formatting like ChatGPT, but DO NOT restrict how much you write. You are allowed to be detailed, expressive, and show personality. You are a personal assistant who can help with anything — product work, coding, planning, business tasks, research, homework, or random life questions.

Follow these formatting rules for EVERY response unless explicitly told otherwise:

1. USE CLEAR HEADINGS (H2/H3)
   - Break your answer into helpful sections using markdown headings
   - Examples: ## Overview, ## What You Should Know, ## Step-by-Step Instructions, ## Issues Found, ## Improvements, ## Final Notes
   - Headings should mimic ChatGPT's structured, clean communication style
   - Use ## for main sections, ### for subsections

2. USE SHORT SECTIONS, NOT SHORT PARAGRAPHS
   - You are NOT limited in length - write as much as needed
   - You can write long explanations, use multiple paragraphs, add details when helpful
   - The only rule: break content into readable sections instead of one giant block
   - Each section should focus on one main idea

3. USE BULLETS AND NUMBERED LISTS LIBERALLY
   - Use them for: steps, options, pros/cons, key points, instructions
   - This increases readability the same way ChatGPT does
   - Lists help break up dense information

4. CODE BLOCKS ONLY FOR CODE
   - When showing code, schemas, or API examples, use code blocks with language tags:
     \`\`\`typescript
     // example code
     \`\`\`
   - Never place explanations or descriptions inside code blocks

5. MAINTAIN A WARM, HELPFUL PERSONALITY
   - You are not robotic - be warm, friendly, supportive, helpful
   - Be slightly conversational when appropriate
   - But still structured and clear
   - Maintain your personality traits (${selectedTraits.length > 0 ? selectedTraits.join(', ') : 'warm and professional'})

6. NO CONTENT LIMITS
   - Do NOT shorten yourself unnecessarily
   - Do NOT be overly concise if detail helps
   - Do NOT restrict detail - if a longer explanation helps, write it
   - Your only responsibility is clarity, not brevity

7. ALWAYS END WITH A "FINAL ANSWER" OR "SUMMARY"
   - End every major response with:
     ## Final Answer
     [A 2-4 sentence high-level summary of the key output]
   - This helps users quickly understand the takeaway

8. ASK CLARIFYING QUESTIONS WHEN NEEDED
   - If the request is unclear or you need more detail, ask before executing
   - Use structured formatting even for questions

9. FOCUS ON READABILITY
   - Break down complex topics into digestible sections
   - Use whitespace effectively
   - Make it easy to scan and understand
   - Structure helps even with casual, friendly tone

Use this formatting style for ALL responses unless explicitly told otherwise.`;
    
    // Initialize OpenAI client
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Build conversation messages
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: chatSystemPrompt },
      ...conversationHistory,
      { role: 'user', content: incomingMessage },
    ];
    
    // Quality-first: Smart model selection (conservative - default to GPT-4o)
    // Only use mini for clearly simple tasks to maintain quality
    const model = selectModel(incomingMessage, messages.length, 'chat');
    
    // Quality note: We don't cache conversational responses as they need to be contextual
    // Caching is only used for deterministic operations (suggestions, patterns, etc.)

    // Generate response with function calling enabled
    const completion = await openai.chat.completions.create({
      model, // Smart selection: GPT-4o for complex, GPT-4o-mini only for clearly simple
      messages: messages as any,
      tools: CHAT_FUNCTIONS.map(fn => ({
        type: 'function' as const,
        function: fn,
      })),
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 4000, // Keep full 4K for quality - mini will naturally use less
    });
    
    const message = completion.choices[0]?.message;
    
    // Check for function calls
    const functionCalls: Array<{ name: string; arguments: any }> = [];
    if (message?.tool_calls && Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls) {
        try {
          const args = typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function?.arguments;
          if (tc.function?.name) {
            functionCalls.push({
              name: tc.function.name,
              arguments: args || {},
            });
          }
        } catch (e) {
          console.error('[CHAT ERROR] Failed to parse function call arguments:', e);
        }
      }
    }
    
    // Handle function-call-only responses (no text content)
    let response = message?.content || '';
    if (!response && functionCalls.length > 0) {
      // Generate personalized confirmation message for function calls
      const firstCall = functionCalls[0];
      if (firstCall.name === 'make_outbound_call' || firstCall.name === 'schedule_outbound_call') {
        response = `Sounds good, I'll make the call. Do you need anything else?`;
      } else {
        response = `Sounds good, I'll take care of that. Do you need anything else?`;
      }
    } else if (!response) {
      // Fallback error message (should rarely happen)
      response = `I apologize, but I couldn't generate a response. Please try again.`;
    }
    
    return { 
      response, 
      functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      kendallName: String(kendallName)
    };
  } catch (error) {
    console.error('[CHAT ERROR] Failed to generate chat response:', error);
    throw error;
  }
}

/**
 * POST /api/chat/send
 * Send message to agent and get immediate response
 */
export async function POST(request: NextRequest) {
  try {
    // ✅ Early validation: Check required environment variables
    if (!process.env.OPENAI_API_KEY) {
      console.error('[API ERROR] OPENAI_API_KEY environment variable is missing');
      return NextResponse.json(
        {
          success: false,
          error: 'Server configuration error: OpenAI API key is missing',
        },
        { status: 500 }
      );
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('[API ERROR] Failed to parse request body:', parseError);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body. Expected JSON.',
        },
        { status: 400 }
      );
    }

    const { recordId, message, threadId: providedThreadId } = body;

    // ✅ Validate required fields
    if (!recordId || !message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'recordId and message are required. Message must be a non-empty string.',
        },
        { status: 400 }
      );
    }

    // ✅ Get user record with error handling
    let userRecord;
    try {
      userRecord = await getUserRecord(recordId);
    } catch (airtableError) {
      console.error('[API ERROR] Failed to fetch user record:', airtableError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch user record. Please check your recordId.',
          details: airtableError instanceof Error ? airtableError.message : 'Unknown Airtable error',
        },
        { status: 500 }
      );
    }

    if (!userRecord || !userRecord.fields) {
      return NextResponse.json(
        {
          success: false,
          error: `User record not found for recordId: ${recordId}`,
        },
        { status: 404 }
      );
    }

    const agentId = userRecord.fields.vapi_agent_id;
    if (!agentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Agent not found for this user. Please ensure your Kendall agent has been created.',
        },
        { status: 404 }
      );
    }

    // ✅ Get or create threadId with error handling
    let threadId: string;
    try {
      if (providedThreadId) {
        threadId = providedThreadId;
      } else {
        threadId = await getOrCreateThreadId(recordId);
      }
    } catch (threadError) {
      console.error('[API ERROR] Failed to get or create threadId:', threadError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to initialize chat thread',
          details: threadError instanceof Error ? threadError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // ✅ Get recent conversation history with error handling
    let recentMessages;
    try {
      recentMessages = await getChatMessages({
        threadId,
        limit: 20,
      });
    } catch (messagesError) {
      // If Chat Messages table doesn't exist or isn't configured, log but continue
      const errorMessage = messagesError instanceof Error ? messagesError.message : 'Unknown error';
      
      if (errorMessage.includes('Chat Messages Airtable URL is not configured') || 
          errorMessage.includes('AIRTABLE_CHAT_MESSAGES_TABLE_ID')) {
        console.warn('[API WARNING] Chat Messages table not configured, continuing without history:', errorMessage);
        recentMessages = { messages: [], hasMore: false };
      } else {
        console.error('[API ERROR] Failed to fetch chat messages:', messagesError);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to fetch chat history',
            details: errorMessage,
          },
          { status: 500 }
        );
      }
    }

    // Build conversation history for OpenAI
    const conversationHistory = recentMessages.messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.message,
    }));

    // Determine if this is the first message (check actual history, not just length)
    const isFirstMessage = conversationHistory.length === 0;

    // ✅ Generate agent response with error handling
    let agentResponse: string;
    let functionCalls: Array<{ name: string; arguments: any }> | undefined;
    let kendallName: string | undefined;
    
    try {
      const responseData = await generateChatResponse(
        recordId,
        message.trim(),
        conversationHistory,
        isFirstMessage
      );
      agentResponse = responseData.response;
      functionCalls = responseData.functionCalls;
      kendallName = responseData.kendallName;
    } catch (openaiError) {
      console.error('[API ERROR] Failed to generate chat response:', openaiError);
      const errorMessage = openaiError instanceof Error ? openaiError.message : 'Unknown OpenAI error';
      
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate agent response',
          details: errorMessage,
        },
        { status: 500 }
      );
    }

    // ✅ Create user message with error handling
    try {
      // Validate environment variables before attempting to save
      if (!process.env.AIRTABLE_BASE_ID || !process.env.AIRTABLE_CHAT_MESSAGES_TABLE_ID) {
        console.warn('[CHAT API] Chat messages table not configured. Set AIRTABLE_BASE_ID and AIRTABLE_CHAT_MESSAGES_TABLE_ID to enable message storage.');
      } else {
        await createChatMessage({
          recordId,
          agentId: String(agentId),
          threadId,
          message: message.trim(),
          role: 'user',
        });
        console.log('[CHAT API] User message saved to Airtable:', { recordId, threadId, messageLength: message.trim().length });
      }

      // Extract patterns and contacts from user message (async, don't block)
      const timestamp = new Date().toISOString();
      
      Promise.all([
        extractPatternsFromMessage(
          recordId,
          message.trim(),
          'user',
          timestamp,
          conversationHistory.map(m => ({
            message: m.content,
            role: m.role,
            timestamp: new Date().toISOString(),
          }))
        ).then(() => {
          console.log('[PATTERN EXTRACTION] Successfully extracted patterns for message:', message.substring(0, 50));
        }).catch(err => {
          console.error('[PATTERN EXTRACTION] Failed to extract patterns:', err);
          console.error('[PATTERN EXTRACTION] Error details:', {
            recordId,
            messageLength: message.trim().length,
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          });
        }),
        extractContactFromMessage(
          recordId,
          message.trim(),
          timestamp
        ).catch(err => {
          console.warn('[CONTACT EXTRACTION] Failed to extract contact:', err);
        }),
      ]);
    } catch (userMsgError) {
      // Log but don't fail - we still want to return the response
      const errorMessage = userMsgError instanceof Error ? userMsgError.message : String(userMsgError);
      console.error('[CHAT API ERROR] Failed to save user message to Airtable:', {
        error: errorMessage,
        recordId,
        threadId,
        agentId: String(agentId),
        messageLength: message.trim().length,
        hasBaseId: !!process.env.AIRTABLE_BASE_ID,
        hasTableId: !!process.env.AIRTABLE_CHAT_MESSAGES_TABLE_ID,
      });
    }

    // ✅ Create agent response message with error handling
    let agentMessage;
    try {
      // Validate environment variables before attempting to save
      if (!process.env.AIRTABLE_BASE_ID || !process.env.AIRTABLE_CHAT_MESSAGES_TABLE_ID) {
        console.warn('[CHAT API] Chat messages table not configured. Set AIRTABLE_BASE_ID and AIRTABLE_CHAT_MESSAGES_TABLE_ID to enable message storage.');
      } else {
        agentMessage = await createChatMessage({
          recordId,
          agentId: String(agentId),
          threadId,
          message: agentResponse,
          role: 'assistant',
        });
        console.log('[CHAT API] Agent message saved to Airtable:', { recordId, threadId, messageLength: agentResponse.length });
      }
    } catch (agentMsgError) {
      // Log but don't fail - we still want to return the response
      const errorMessage = agentMsgError instanceof Error ? agentMsgError.message : String(agentMsgError);
      console.error('[CHAT API ERROR] Failed to save agent message to Airtable:', {
        error: errorMessage,
        recordId,
        threadId,
        agentId: String(agentId),
        messageLength: agentResponse.length,
        hasBaseId: !!process.env.AIRTABLE_BASE_ID,
        hasTableId: !!process.env.AIRTABLE_CHAT_MESSAGES_TABLE_ID,
      });
    }

    // ✅ Handle function calls (e.g., outbound call requests, Google Calendar/Gmail)
    let callRequestId: string | undefined;
    let callStatus: { success: boolean; message: string } | undefined;
    let functionResults: Array<{ name: string; result: any }> = [];
    
    if (functionCalls && functionCalls.length > 0) {
      for (const fc of functionCalls) {
        // Handle Google Calendar requests
        if (fc.name === 'get_calendar_events') {
          try {
            const { recordId: calendarRecordId, startDate, endDate, maxResults } = fc.arguments;
            const params = new URLSearchParams({ recordId: calendarRecordId || recordId });
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (maxResults) params.append('maxResults', String(maxResults));
            
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
            
            // Try with retry logic for transient errors
            let calendarResponse;
            let calendarData;
            let retryCount = 0;
            const maxRetries = 1;
            
            while (retryCount <= maxRetries) {
              try {
                calendarResponse = await fetch(`${baseUrl}/api/google/calendar?${params.toString()}`);
                calendarData = await calendarResponse.json();
                
                // If successful, break out of retry loop
                if (calendarResponse.ok && calendarData.success) {
                  break;
                }
                
                // If it's a 401 "not connected" error, don't retry
                if (calendarResponse.status === 401 && calendarData.error === 'Google account not connected') {
                  break;
                }
                
                // For other errors, retry once if we haven't already
                if (retryCount < maxRetries) {
                  console.log(`[CHAT] Calendar API error, retrying... (attempt ${retryCount + 1}/${maxRetries + 1})`);
                  retryCount++;
                  await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
                  continue;
                }
                
                break;
              } catch (fetchError) {
                console.error(`[CHAT] Calendar fetch error (attempt ${retryCount + 1}):`, fetchError);
                if (retryCount < maxRetries) {
                  retryCount++;
                  await new Promise(resolve => setTimeout(resolve, 500));
                  continue;
                }
                throw fetchError;
              }
            }
            
            if (calendarResponse.ok && calendarData.success) {
              functionResults.push({
                name: 'get_calendar_events',
                result: calendarData,
              });
              
              // Update agent response with calendar information
              if (calendarData.events && calendarData.events.length > 0) {
                const eventsList = calendarData.events.map((e: any) => {
                  const start = e.start ? new Date(e.start).toLocaleString() : 'TBD';
                  return `- ${e.summary} at ${start}${e.location ? ` (${e.location})` : ''}`;
                }).join('\n');
                agentResponse = `Here's what you have coming up:\n\n${eventsList}`;
              } else {
                agentResponse = "You don't have any events scheduled for that time period.";
              }
            } else {
              // Only show "not connected" message for actual 401 errors
              if (calendarResponse.status === 401 && calendarData.error === 'Google account not connected') {
                agentResponse = `I couldn't access your calendar. ${calendarData.message || 'Please connect your Google account in the Integrations page.'}`;
              } else {
                // For other errors, show generic retry message
                console.error('[CHAT] Calendar API error:', {
                  status: calendarResponse.status,
                  error: calendarData.error,
                  message: calendarData.message,
                });
                agentResponse = "I'm having trouble accessing your calendar right now. Please try again in a moment.";
              }
            }
          } catch (error) {
            console.error('[CHAT] Error fetching calendar events:', error);
            agentResponse = "I encountered an error while trying to access your calendar. Please try again.";
          }
          continue;
        }
        
        // Handle Gmail requests
        if (fc.name === 'get_gmail_messages') {
          try {
            const { recordId: gmailRecordId, unread, maxResults } = fc.arguments;
            const params = new URLSearchParams({ recordId: gmailRecordId || recordId });
            if (unread) params.append('unread', 'true');
            if (maxResults) params.append('maxResults', String(maxResults));
            
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
            
            // Try with retry logic for transient errors
            let gmailResponse;
            let gmailData;
            let retryCount = 0;
            const maxRetries = 1;
            
            while (retryCount <= maxRetries) {
              try {
                gmailResponse = await fetch(`${baseUrl}/api/google/gmail?${params.toString()}`);
                gmailData = await gmailResponse.json();
                
                // If successful, break out of retry loop
                if (gmailResponse.ok && gmailData.success) {
                  break;
                }
                
                // If it's a 401 "not connected" error, don't retry
                if (gmailResponse.status === 401 && gmailData.error === 'Google account not connected') {
                  break;
                }
                
                // For other errors, retry once if we haven't already
                if (retryCount < maxRetries) {
                  console.log(`[CHAT] Gmail API error, retrying... (attempt ${retryCount + 1}/${maxRetries + 1})`);
                  retryCount++;
                  await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
                  continue;
                }
                
                break;
              } catch (fetchError) {
                console.error(`[CHAT] Gmail fetch error (attempt ${retryCount + 1}):`, fetchError);
                if (retryCount < maxRetries) {
                  retryCount++;
                  await new Promise(resolve => setTimeout(resolve, 500));
                  continue;
                }
                throw fetchError;
              }
            }
            
            if (gmailResponse.ok && gmailData.success) {
              functionResults.push({
                name: 'get_gmail_messages',
                result: gmailData,
              });
              
              // Update agent response with Gmail information
              if (gmailData.messages && gmailData.messages.length > 0) {
                const messagesList = gmailData.messages.map((m: any) => {
                  return `- From: ${m.from} | Subject: ${m.subject} | ${m.date}`;
                }).join('\n');
                agentResponse = `Here are your ${unread ? 'unread ' : ''}emails:\n\n${messagesList}`;
              } else {
                agentResponse = `You don't have any ${unread ? 'unread ' : ''}emails.`;
              }
            } else {
              // Only show "not connected" message for actual 401 errors
              if (gmailResponse.status === 401 && gmailData.error === 'Google account not connected') {
                agentResponse = `I couldn't access your Gmail. ${gmailData.message || 'Please connect your Google account in the Integrations page.'}`;
              } else {
                // For other errors, show generic retry message
                console.error('[CHAT] Gmail API error:', {
                  status: gmailResponse.status,
                  error: gmailData.error,
                  message: gmailData.message,
                });
                agentResponse = "I'm having trouble accessing your Gmail right now. Please try again in a moment.";
              }
            }
          } catch (error) {
            console.error('[CHAT] Error fetching Gmail messages:', error);
            agentResponse = "I encountered an error while trying to access your Gmail. Please try again.";
          }
          continue;
        }
        
        // Handle outbound call requests
        if (fc.name === 'make_outbound_call' || fc.name === 'schedule_outbound_call') {
          try {
            // Normalize phone number before making call
            const rawPhoneNumber = fc.arguments.phone_number;
            const normalizedPhone = formatPhoneNumberToE164(rawPhoneNumber);
            
            // Check for duplicate calls: prevent making the same call twice in quick succession
            // Check recent chat messages for the same call request
            try {
              const recentMessages = await getChatMessages({
                threadId,
                limit: 10,
              });
              
              // Extract phone number digits for comparison (last 10 digits)
              const phoneDigits = normalizedPhone.replace(/^\+1/, '').replace(/\D/g, '');
              
              const recentCallMessages = recentMessages.messages.filter(msg => {
                if (msg.role !== 'assistant') return false;
                const msgText = msg.message.toLowerCase();
                // Check if message mentions calling and contains the phone number digits
                return (msgText.includes('successfully called') || msgText.includes('called')) && 
                       phoneDigits.length >= 7 && 
                       msgText.includes(phoneDigits.substring(phoneDigits.length - 7)); // Last 7 digits for matching
              });
              
              // If we just made a call to this number in the last 2 minutes, don't make another
              if (recentCallMessages.length > 0) {
                const mostRecentCall = recentCallMessages[0];
                const callTimestamp = new Date(mostRecentCall.timestamp).getTime();
                const now = Date.now();
                const timeSinceLastCall = now - callTimestamp;
                
                // If call was made less than 2 minutes ago, it's likely a duplicate
                if (timeSinceLastCall < 120000) { // 2 minutes in milliseconds
                  console.log('[CHAT] Duplicate call prevented - recent call found:', {
                    phoneNumber: normalizedPhone,
                    timeSinceLastCall: `${Math.round(timeSinceLastCall / 1000)}s`,
                  });
                  callStatus = {
                    success: false,
                    message: `I just called that number ${Math.round(timeSinceLastCall / 1000)} seconds ago. The call summary will appear here once it completes.`
                  };
                  agentResponse = `I just called that number recently. The call summary will appear here automatically once it completes.`;
                  continue;
                }
              }
            } catch (duplicateCheckError) {
              // If duplicate check fails, log but continue with call
              console.warn('[CHAT] Failed to check for duplicate calls, proceeding anyway:', duplicateCheckError);
            }
            
            // Validate phone number before making call
            if (!normalizedPhone) {
              console.error('[CHAT ERROR] Invalid phone number format:', rawPhoneNumber);
              // Update agent response to ask for proper format - don't execute call
              // We'll modify the response to ask user for correct format
              callStatus = {
                success: false,
                message: `I need a valid phone number format. Can you provide it as 10 digits (like 8149969612) or formatted (like (814) 996-9612)?`
              };
              // Also update the response to include this message
              agentResponse = `${agentResponse}\n\nI need a valid phone number format. Can you provide it as 10 digits (like 8149969612) or formatted (like (814) 996-9612)?`;
              continue;
            }
            
            // Additional validation: E.164 format should be exactly 12 characters (+1XXXXXXXXXX)
            if (normalizedPhone.length !== 12 || !normalizedPhone.startsWith('+1')) {
              console.error('[CHAT ERROR] Invalid E.164 format after normalization:', normalizedPhone, 'Length:', normalizedPhone.length);
              callStatus = {
                success: false,
                message: `I need a valid phone number format. Can you provide it as 10 digits (like 8149969612) or formatted (like (814) 996-9612)?`
              };
              // Override the response to ask for proper format
              agentResponse = `I need a valid phone number format. Can you provide it as 10 digits (like 8149969612) or formatted (like (814) 996-9612)?`;
              continue;
            }

            // Call the make-call API
            const makeCallResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/make-call`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                phone_number: normalizedPhone, // Use normalized phone number
                message: fc.arguments.message,
                scheduled_time: fc.arguments.scheduled_time,
                owner_agent_id: String(agentId),
                recordId: recordId, // Pass recordId for chat relay
                threadId: threadId, // Pass threadId for chat relay
              }),
            });

            if (makeCallResponse.ok) {
              const callResult = await makeCallResponse.json();
              callRequestId = callResult.call_id || callResult.task_id;
              const phoneDisplay = normalizedPhone.replace(/^\+1/, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
              callStatus = {
                success: true,
                message: `${kendallName || 'I'} successfully called ${phoneDisplay}.`
              };
              console.log('[CHAT SUCCESS] Outbound call initiated:', { normalizedPhone, callRequestId });
              
              // Store call request context for immediate calls (not scheduled)
              // This links the VAPI call completion webhook back to this chat thread
              if (fc.name === 'make_outbound_call' && callResult.call_id && !callResult.scheduled) {
                try {
                  await createOutboundCallRequest({
                    callId: callResult.call_id,
                    recordId: recordId,
                    threadId: threadId,
                    status: 'pending',
                    phoneNumber: normalizedPhone,
                  });
                  console.log('[CHAT] Stored outbound call request for chat integration:', {
                    callId: callResult.call_id,
                    recordId,
                    threadId,
                  });
                } catch (error) {
                  // Log but don't fail - call request storage is optional
                  console.warn('[CHAT WARNING] Failed to store outbound call request:', error);
                }
              }
            } else {
              const errorData = await makeCallResponse.json().catch(() => ({}));
              console.error('[CHAT ERROR] Failed to make call:', errorData);
              
              // Extract better error message from VAPI response
              let errorMsg = 'Please try again.';
              if (errorData.message && Array.isArray(errorData.message)) {
                errorMsg = errorData.message[0] || errorMsg;
              } else if (errorData.message && typeof errorData.message === 'string') {
                errorMsg = errorData.message;
              } else if (errorData.error) {
                errorMsg = errorData.error;
              }
              
              // Check if it's a phone number format error
              if (errorMsg.includes('E.164') || errorMsg.includes('phone number') || errorMsg.includes('country code')) {
                callStatus = {
                  success: false,
                  message: `I need a valid phone number format. Can you provide it as 10 digits (like 8149969612) or formatted (like (814) 996-9612)?`
                };
              } else {
                callStatus = {
                  success: false,
                  message: `${kendallName || 'I'} couldn't make the call. ${errorMsg}`
                };
              }
            }
          } catch (error) {
            // Log but don't fail - function calls are optional
            console.error('[CHAT WARNING] Failed to execute function call:', error);
            callStatus = {
              success: false,
              message: `${kendallName || 'I'} encountered an error while trying to make the call. Please try again.`
            };
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: agentMessage,
      response: agentResponse,
      functionCalls: functionCalls || undefined,
      kendallName: kendallName,
      callStatus: callStatus,
    });
  } catch (error) {
    // ✅ Catch-all error handler with detailed logging
    console.error('[API ERROR] POST /api/chat/send failed with unexpected error:', error);
    console.error('[API ERROR] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message',
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.stack : undefined)
          : undefined,
      },
      { status: 500 }
    );
  }
}

