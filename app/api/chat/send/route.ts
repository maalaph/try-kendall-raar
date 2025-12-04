import { NextRequest, NextResponse } from 'next/server';
import { getUserRecord, getOrCreateThreadId, createChatMessage, getChatMessages, createOutboundCallRequest } from '@/lib/airtable';
import { buildChatSystemPrompt } from '@/lib/promptBlocks';
import { formatPhoneNumberToE164 } from '@/lib/vapi';
import { extractPatternsFromMessage } from '@/lib/patternExtractor';
import { extractContactFromMessage } from '@/lib/contactExtractor';
import { getContactByName, upsertContact } from '@/lib/contacts';
import { analyzeSentiment, getResponseTone } from '@/lib/sentiment';
import { checkRateLimit } from '@/lib/rateLimiter';
import {
  fetchCalendarEvents,
  fetchGmailMessages,
  sendGmailMessage,
  GoogleIntegrationError,
} from '@/lib/integrations/google';
import { createEvent } from '@/lib/google/calendar';
import {
  fetchSpotifyInsights,
  SpotifyIntegrationError,
} from '@/lib/integrations/spotify';
import OpenAI from 'openai';

const CHAT_FUNCTIONS = [
  {
    name: 'make_outbound_call',
    description: 'Make an immediate outbound phone call and deliver a message on behalf of the owner. ONLY call this after you already have the person’s name, their phone number, and the exact message to deliver.',
    parameters: {
      type: 'object',
      properties: {
        phone_number: {
          type: 'string',
          description: 'The phone number to call. Can be in any user format (10 digits, formatted, or with country code). The system will normalize it automatically.',
        },
        message: {
          type: 'string',
          description: 'Exactly what you will say during the call, in natural language.',
        },
        caller_name: {
          type: 'string',
          description: 'Optional: The recipient’s name (e.g., "mo money"). Use the same name you looked up or saved in contacts.',
        },
      },
      required: ['phone_number', 'message'],
    },
  },
  {
    name: 'schedule_outbound_call',
    description: 'Schedule an outbound call for a future time. ONLY call this after you have the person’s name, their phone number, the message to deliver, and a clear scheduled time.',
    parameters: {
      type: 'object',
      properties: {
        phone_number: {
          type: 'string',
          description: 'The phone number to call. Can be in any user format. The system will normalize it automatically.',
        },
        message: {
          type: 'string',
          description: 'Exactly what you will say during the call.',
        },
        scheduled_time: {
          type: 'string',
          description: 'ISO 8601 format timestamp for when the call should be made',
        },
        caller_name: {
          type: 'string',
          description: 'Optional: The recipient’s name.',
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
    name: 'create_calendar_event',
    description: 'Create a new calendar event in the user\'s Google Calendar. Use this when the user asks to add an event, schedule something, or create a calendar entry.',
    parameters: {
      type: 'object',
      properties: {
        recordId: {
          type: 'string',
          description: 'The user\'s recordId (required to identify which user\'s calendar to use). Always use the recordId from the chat context.',
        },
        summary: {
          type: 'string',
          description: 'The event title/summary (REQUIRED)',
        },
        description: {
          type: 'string',
          description: 'Optional: Event description or notes',
        },
        startDateTime: {
          type: 'string',
          description: 'Start date and time in ISO 8601 format (e.g., "2024-10-12T12:00:00-04:00"). For all-day events, use just the date (YYYY-MM-DD).',
        },
        endDateTime: {
          type: 'string',
          description: 'End date and time in ISO 8601 format. For all-day events, use just the date (YYYY-MM-DD). If not provided, defaults to 1 hour after start.',
        },
        allDay: {
          type: 'boolean',
          description: 'Whether this is an all-day event. If true, startDateTime and endDateTime should be dates only (YYYY-MM-DD).',
        },
      },
      required: ['recordId', 'summary', 'startDateTime'],
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
  {
    name: 'send_gmail',
    description: 'Send an email via Gmail on behalf of the owner. ONLY call this when you already know the recipient’s email address, subject, and full body text.',
    parameters: {
      type: 'object',
      properties: {
        recordId: {
          type: 'string',
          description: 'The user\'s recordId (required to identify which user\'s Gmail to use). Always use the recordId from the chat context, not a guessed value.',
        },
        to: {
          type: 'string',
          description: 'The recipient\'s email address (REQUIRED). If the user only gives a name, look up the contact first and, if needed, ask for the email before calling this.',
        },
        subject: {
          type: 'string',
          description: 'The email subject line',
        },
        body: {
          type: 'string',
          description: 'The email body content (can be plain text or HTML)',
        },
      },
      required: ['recordId', 'to', 'subject', 'body'],
    },
  },
  {
    name: 'get_contact_by_name',
    description: 'Look up a contact by name in the user\'s contact list. ALWAYS call this first when the user asks you to call, text, or email someone by name, before asking the user for any phone number or email address.',
    parameters: {
      type: 'object',
      properties: {
        recordId: {
          type: 'string',
          description: 'OPTIONAL: The user\'s recordId. If not provided, the system will automatically use the correct recordId from the conversation context. You do NOT need to provide this - it is handled automatically.',
        },
        name: {
          type: 'string',
          description: 'The exact full name of the contact to look up, EXACTLY as the user said it. Examples: "mo money", "Big Mike barber", "John Smith". Do NOT shorten, truncate, or modify it, and do NOT include action words or the rest of the sentence.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_spotify_insights',
    description: 'Fetch Spotify analytics (top artists, top tracks, and current mood) for the user. Use this when the user asks about their Spotify Wrapped, vibe, listening habits, or music analytics. Requires the user to have connected Spotify.',
    parameters: {
      type: 'object',
      properties: {
        timeRange: {
          type: 'string',
          enum: ['short_term', 'medium_term', 'long_term'],
          description: 'Optional Spotify time range. short_term = last 4 weeks, medium_term = last 6 months, long_term = several years. Defaults to medium_term.',
        },
        limit: {
          type: 'number',
          description: 'Number of top artists/tracks to consider (1-20, defaults to 10).',
        },
      },
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
    
    // Use isFirstMessage passed as parameter (determined in POST handler)
    const fullNameStr = fullName ? String(fullName) : 'there';
    const nicknameStr = nickname && String(nickname).trim() ? String(nickname).trim() : null;
    const nicknameOrFullName = nicknameStr || fullNameStr;
    
    // Build chat system prompt (separate from phone call prompt)
    let chatSystemPrompt = buildChatSystemPrompt({
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
    
    // Add first message greeting instructions if this is the first message
    if (isFirstMessage) {
      chatSystemPrompt += `

=== FIRST MESSAGE ONLY - CASUAL GREETING (MANDATORY) ===
🚨🚨🚨 YOU MUST ALWAYS USE CASUAL GREETING FORMAT WITH THEIR NAME - THIS IS ABSOLUTELY REQUIRED 🚨🚨🚨
- This is the FIRST message in the conversation - you MUST greet ${nicknameOrFullName} by name using CASUAL format
- Use their nickname if available (${nicknameStr ? `"${nicknameStr}"` : 'not available'}), otherwise use their full name ("${fullNameStr}")
- You MUST use one of these casual greeting formats - NO EXCEPTIONS:
  * "Hi ${nicknameOrFullName}! What's up?"
  * "Hey ${nicknameOrFullName}! What's up?"
  * "What's up ${nicknameOrFullName}?"
  * "Hey ${nicknameOrFullName}!"
  
🚫 ABSOLUTELY FORBIDDEN - NEVER USE THESE:
- "Hey there" ❌ (MUST include their name)
- "Hello! How can I help you today?" ❌
- "Hello! How can I assist you?" ❌
- "How can I help you?" ❌
- Any greeting without their name/nickname ❌
- Generic greetings like "hey there", "hi there", "hello there" ❌

✅ REQUIRED: ALWAYS include their name or nickname in the greeting - think texting a friend, not a business call
- After this first greeting, don't repeatedly use their name - be conversational (e.g., "Got it!" not "Got it, ${nicknameOrFullName}!")`;
    }
    
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
    
    // Use GPT-4o for all chat interactions to maximize reasoning and tool-use quality
    const model = 'gpt-4o';

    // Generate response with function calling enabled
    const completion = await openai.chat.completions.create({
      model,
      messages: messages as any,
      tools: CHAT_FUNCTIONS.map(fn => ({
        type: 'function' as const,
        function: fn,
      })),
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 4000,
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

      // Extract patterns from user message (async, don't block)
      const timestamp = new Date().toISOString();
      
      // NOTE: Automatic contact extraction is disabled - let AI handle contact recognition
      // through get_contact_by_name function. This prevents creating bad contacts.
      // Contact extraction will only happen when:
      // 1. User provides complete info (name + phone/email) - handled by explicit extraction
      // 2. User provides info after AI asks for it - handled by contact update logic below
      
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
        // Extract contacts only if we have high confidence (name + phone/email both present)
        // Check if message contains both a name pattern AND phone/email
        (async () => {
          const messageText = message.trim();
          const hasPhone = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{10,11}\b/.test(messageText);
          const hasEmail = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/.test(messageText);
          const hasNamePattern = /(?:call|text|email|message)\s+[A-Z][a-z]+/i.test(messageText);
          
          // Only extract if we have high confidence (name + contact method both present)
          if (hasNamePattern && (hasPhone || hasEmail)) {
            try {
              await extractContactFromMessage(recordId, messageText, timestamp);
              console.log('[CONTACT EXTRACTION] Extracted contact with complete info (name + phone/email)');
            } catch (err) {
              console.warn('[CONTACT EXTRACTION] Failed to extract contact:', err);
            }
          }
        })(),
      ]);
      
      // Extract relationship from initial message (e.g., "call my friend" → relationship="friend")
      let extractedRelationship: string | null = null;
      const relationshipPattern = /(?:my|a|an)\s+(friend|colleague|brother|sister|dad|mom|father|mother|aunt|uncle|cousin|boss|manager|client|customer|neighbor|brother-in-law|sister-in-law)/i;
      const relationshipMatch = message.match(relationshipPattern);
      if (relationshipMatch && relationshipMatch[1]) {
        extractedRelationship = relationshipMatch[1].toLowerCase();
        console.log('[CHAT] Extracted relationship from message:', extractedRelationship);
      }
      
      // Special handling: If user message is just an email address or phone number, try to link it to recent contact
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^[\d\s\(\)\.\-\+]{10,}$/; // At least 10 digits/characters
      const trimmedMessage = message.trim();
      
      if (emailRegex.test(trimmedMessage)) {
        // User provided just an email - look for recent contact mention
        try {
          const recentMessages = await getChatMessages({
            threadId,
            limit: 10,
          });
          
          // Look backwards through messages to find the most recent contact that was asked about
          for (const msg of recentMessages.messages.slice().reverse()) {
            // Check for various patterns of AI asking for email
            const emailRequestPatterns = [
              /don't have.*email address/i,
              /What's.*email address/i,
              /I don't have (.+?) in your contacts.*email/i,
            ];
            
            const isEmailRequest = emailRequestPatterns.some(pattern => pattern.test(msg.message));
            
            if (msg.role === 'assistant' && isEmailRequest) {
              // Extract contact name from various message patterns
              const nameMatch = msg.message.match(/(?:I found|don't have|What's) (\w+)(?:'s|'s)? (?:in your contacts|email)/i) ||
                               msg.message.match(/I don't have (\w+) in your contacts/i) ||
                               msg.message.match(/What's (\w+)'s email/i);
              
              if (nameMatch && nameMatch[1]) {
                const contactName = nameMatch[1];
                console.log('[CHAT] Found contact name from email-only message context:', contactName);
                
                // Update contact with email
                await upsertContact({
                  recordId,
                  name: contactName,
                  email: trimmedMessage,
                });
                console.log('[CHAT] ✅ Updated contact with email from email-only message:', { name: contactName, email: trimmedMessage });
                break;
              }
            }
          }
        } catch (emailUpdateError) {
          console.warn('[CHAT] Failed to update contact with email from email-only message:', emailUpdateError);
          // Don't fail the request if this fails
        }
      } else if (phoneRegex.test(trimmedMessage.replace(/\D/g, '')) && trimmedMessage.replace(/\D/g, '').length >= 10) {
        // User provided just a phone number - look for recent contact mention
        try {
          const recentMessages = await getChatMessages({
            threadId,
            limit: 10,
          });
          
          let contactName: string | null = null;
          let normalizedPhone: string | null = null;
          
          // Look backwards through messages to find the most recent contact that was asked about
          for (const msg of recentMessages.messages.slice().reverse()) {
            // Check for various patterns of AI asking for phone number
            const phoneRequestPatterns = [
              /don't have.*phone number/i,
              /What's.*phone number/i,
              /I don't have (.+?) in your contacts.*phone/i,
            ];
            
            const isPhoneRequest = phoneRequestPatterns.some(pattern => pattern.test(msg.message));
            
            if (msg.role === 'assistant' && isPhoneRequest) {
              // Extract contact name from assistant's message
              // The AI should have said something like "I don't have [name] in your contacts"
              // We extract the name from that message - could be "Mo", "mo money", "John Smith", etc.
              // Match any text between "don't have" and "in your contacts" - this is the name the AI mentioned
              const nameMatch = msg.message.match(/I don't have (.+?) in your contacts/i) ||
                               msg.message.match(/don't have (.+?) in your contacts/i) ||
                               msg.message.match(/What's (.+?)'s phone/i);
              
              if (nameMatch && nameMatch[1]) {
                // Use the name as-is - don't truncate or modify it
                // If AI said "I don't have mo money in your contacts", use "mo money" as the name
                contactName = nameMatch[1].trim();
                console.log('[CHAT] Found contact name from phone-only message context:', contactName);
                
                // Normalize phone number
                const phoneNormalized = formatPhoneNumberToE164(trimmedMessage);
                if (phoneNormalized && contactName) {
                  normalizedPhone = phoneNormalized;
                  
                  // Try to get relationship from earlier in conversation
                  let relationshipToStore: string | null = extractedRelationship;
                  if (!relationshipToStore) {
                    // Look for relationship in recent user messages
                    for (const msg of recentMessages.messages.slice().reverse()) {
                      if (msg.role === 'user') {
                        const relMatch = msg.message.match(/(?:my|a|an)\s+(friend|colleague|brother|sister|dad|mom|father|mother|aunt|uncle|cousin|boss|manager|client|customer|neighbor)/i);
                        if (relMatch && relMatch[1]) {
                          relationshipToStore = relMatch[1].toLowerCase();
                          break;
                        }
                      }
                    }
                  }
                  
                  // Update contact with phone and relationship (if available)
                  try {
                    const createdContact = await upsertContact({
                      recordId,
                      name: contactName,
                      phone: phoneNormalized,
                      relationship: relationshipToStore || undefined,
                      lastContacted: new Date().toISOString(),
                    });
                    console.log('[CHAT] ✅✅✅ CONTACT CREATED/UPDATED:', { 
                      name: contactName, 
                      phone: phoneNormalized,
                      relationship: relationshipToStore,
                      contactId: createdContact.id,
                      hasPhone: !!createdContact.phone
                    });
                    // Verify it was actually saved
                    if (!createdContact.id) {
                      console.error('[CHAT] ❌❌❌ CONTACT CREATION FAILED - NO ID RETURNED');
                    }
                  } catch (upsertError) {
                    console.error('[CHAT] ❌❌❌ CONTACT CREATION FAILED:', {
                      error: upsertError,
                      name: contactName,
                      phone: phoneNormalized,
                      relationship: relationshipToStore,
                      errorMessage: upsertError instanceof Error ? upsertError.message : String(upsertError)
                    });
                    // Don't throw - continue with flow
                  }
                  break;
                }
              }
            }
          }
          
          // If we updated a contact, we need to ask for message before making call
          // Store this info to prevent immediate call in post-processing
          if (contactName && normalizedPhone) {
            // Set a flag that we just created/updated a contact with phone
            // This will be checked in post-processing to override AI response
            console.log('[CHAT] Contact updated with phone, will ask for message before calling:', { contactName, phone: normalizedPhone || 'unknown' });
            // Store in a way that post-processing can access it
            // We'll check for phone-only messages in post-processing
          }
        } catch (phoneUpdateError) {
          console.warn('[CHAT] Failed to update contact with phone from phone-only message:', phoneUpdateError);
          // Don't fail the request if this fails
        }
      }
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
    let lastContactLookup: { name: string; contact?: { name?: string; phone?: string; email?: string; relationship?: string } } | null = null;
    
    if (functionCalls && functionCalls.length > 0) {
      for (const fc of functionCalls) {
        // Handle Google Calendar requests
        if (fc.name === 'get_calendar_events') {
          try {
            const { startDate, endDate, maxResults } = fc.arguments || {};
            const events = await fetchCalendarEvents(recordId, {
              timeMin: startDate ? new Date(startDate).toISOString() : undefined,
              timeMax: endDate ? new Date(endDate).toISOString() : undefined,
              maxResults: maxResults ? Number(maxResults) : undefined,
            });

            functionResults.push({
              name: 'get_calendar_events',
              result: { success: true, events },
            });

            const formatDateTime = (value: string) => {
              const date = new Date(value);
              if (Number.isNaN(date.getTime())) {
                return value;
              }
              const hasTime = value.includes('T');
              return date.toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                ...(hasTime
                  ? { hour: 'numeric', minute: '2-digit' }
                  : {}),
              });
            };

            const describeRange = () => {
              if (startDate && endDate) {
                return `between ${formatDateTime(startDate)} and ${formatDateTime(endDate)}`;
              }
              if (startDate) {
                return `after ${formatDateTime(startDate)}`;
              }
              if (endDate) {
                return `before ${formatDateTime(endDate)}`;
              }
              return 'in your upcoming schedule';
            };

            const timeframeDescription = describeRange();

            if (events.length > 0) {
              const eventsList = events
                .map((e) => {
                  const start = e.start ? new Date(e.start).toLocaleString() : 'TBD';
                  return `- ${e.summary} at ${start}${e.location ? ` (${e.location})` : ''}`;
                })
                .join('\n');
              agentResponse = `Here's what you have ${timeframeDescription}:\n\n${eventsList}`;
            } else {
              agentResponse = `I couldn't find anything ${timeframeDescription}. If that seems off, double-check which calendars are connected in Integrations or tell me to add a new event.`;
            }
          } catch (error) {
            if (error instanceof GoogleIntegrationError) {
              agentResponse =
                error.reason === 'NOT_CONNECTED'
                  ? "I couldn't access your calendar because Google isn't connected yet. You can connect it in the Integrations page."
                  : error.reason === 'TOKEN_REFRESH_FAILED'
                  ? "Your Google connection looks expired. Try reconnecting it in the Integrations page."
                  : "I'm having trouble accessing your calendar right now. Please try again in a moment.";
            } else {
              console.error('[CHAT] Error fetching calendar events:', error);
              agentResponse = "I encountered an error while trying to access your calendar. Please try again.";
            }
          }
          continue;
        }

        // Handle calendar event creation
        if (fc.name === 'create_calendar_event') {
          try {
            console.log('[CHAT] Creating calendar event with arguments:', fc.arguments);
            const { recordId: eventRecordId, summary, description, startDateTime, endDateTime, allDay } = fc.arguments || {};
            // Validate that eventRecordId is not the literal string 'recordId' - if AI passes invalid value, use actual recordId
            const eventCreateRecordId = (eventRecordId && eventRecordId !== 'recordId' && typeof eventRecordId === 'string' && eventRecordId.startsWith('rec')) 
              ? eventRecordId 
              : recordId;

            if (!summary || !startDateTime) {
              console.warn('[CHAT] Missing required fields for calendar event:', { summary, startDateTime });
              functionResults.push({
                name: 'create_calendar_event',
                result: { success: false, error: 'Summary and startDateTime are required' },
              });
              agentResponse = "I need an event title and start time to create the calendar event. Can you provide those?";
              continue;
            }

            // Parse dates
            const startDate = new Date(startDateTime);
            let endDate: Date;
            
            if (endDateTime) {
              endDate = new Date(endDateTime);
            } else if (allDay) {
              // For all-day events, end date should be the day after start date
              endDate = new Date(startDate);
              endDate.setDate(endDate.getDate() + 1);
            } else {
              // Default to 1 hour later for timed events
              endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
            }

            if (Number.isNaN(startDate.getTime())) {
              console.error('[CHAT] Invalid startDateTime format:', startDateTime);
              functionResults.push({
                name: 'create_calendar_event',
                result: { success: false, error: 'Invalid startDateTime format' },
              });
              agentResponse = "The start date/time format is invalid. Please provide a valid date and time.";
              continue;
            }

            if (Number.isNaN(endDate.getTime())) {
              console.error('[CHAT] Invalid endDateTime format:', endDateTime);
              endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Fallback to 1 hour later
            }

            // Build event data
            let eventData: any = {
              summary,
            };

            if (description) {
              eventData.description = description;
            }

            // Handle all-day events vs timed events
            if (allDay) {
              // All-day events use date only (YYYY-MM-DD)
              const startDateStr = startDate.toISOString().split('T')[0];
              // For all-day events, end date should be exclusive (next day)
              const endDateStr = endDate.toISOString().split('T')[0];
              eventData.start = { date: startDateStr };
              eventData.end = { date: endDateStr };
              console.log('[CHAT] Creating all-day event:', { startDateStr, endDateStr });
            } else {
              // Timed events use dateTime with timezone
              const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
              eventData.start = { 
                dateTime: startDate.toISOString(),
                timeZone: timeZone
              };
              eventData.end = { 
                dateTime: endDate.toISOString(),
                timeZone: timeZone
              };
              console.log('[CHAT] Creating timed event:', { 
                start: eventData.start.dateTime, 
                end: eventData.end.dateTime,
                timeZone 
              });
            }

            console.log('[CHAT] Calling createEvent with:', {
              recordId: eventCreateRecordId,
              eventData,
            });

            const createdEvent = await createEvent(eventCreateRecordId, eventData);

            functionResults.push({
              name: 'create_calendar_event',
              result: { 
                success: true, 
                eventId: createdEvent.id,
                summary: createdEvent.summary,
                start: allDay ? eventData.start.date : eventData.start.dateTime,
                end: allDay ? eventData.end.date : eventData.end.dateTime,
              },
            });

            const eventTime = allDay 
              ? startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
              : startDate.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
            
            agentResponse = `I've added "${summary}" to your calendar for ${eventTime}.`;
            
            console.log('[CHAT] ✅ Calendar event created successfully:', {
              eventId: createdEvent.id,
              summary,
              start: eventData.start,
              end: eventData.end,
              allDay,
              recordId: eventCreateRecordId,
            });
          } catch (error) {
            console.error('[CHAT] ❌ Error creating calendar event:', {
              error: error instanceof Error ? error.message : String(error),
              errorType: error instanceof GoogleIntegrationError ? error.reason : 'UNKNOWN',
              arguments: fc.arguments,
              recordId: eventCreateRecordId,
              stack: error instanceof Error ? error.stack : undefined,
            });

            if (error instanceof GoogleIntegrationError) {
              agentResponse =
                error.reason === 'NOT_CONNECTED'
                  ? "I couldn't create the event because Google isn't connected yet. You can connect it in the Integrations page."
                  : error.reason === 'TOKEN_REFRESH_FAILED'
                  ? "Your Google connection looks expired. Try reconnecting it in the Integrations page."
                  : error.message || "I'm having trouble creating the calendar event right now. Please try again in a moment.";
            } else {
              const errorMessage = error instanceof Error ? error.message : String(error);
              agentResponse = `I couldn't create the calendar event: ${errorMessage}. Please check your Google connection in the Integrations page or try again.`;
            }
            functionResults.push({
              name: 'create_calendar_event',
              result: { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            });
          }
          continue;
        }
        
        if (fc.name === 'get_spotify_insights') {
          try {
            const { timeRange, limit } = fc.arguments || {};
            const insights = await fetchSpotifyInsights(recordId, {
              timeRange: ['short_term', 'medium_term', 'long_term'].includes(timeRange)
                ? timeRange
                : undefined,
              limit: limit ? Number(limit) : undefined,
            });

            functionResults.push({
              name: 'get_spotify_insights',
              result: { success: true, insights },
            });

            const topArtistNames = insights.topArtists.slice(0, 3).map((a) => a.name);
            const topTrackNames = insights.topTracks.slice(0, 3).map((t) => `${t.name} by ${t.artists?.[0]?.name || 'Unknown artist'}`);

            const moodLine = insights.mood
              ? `Overall vibe feels **${insights.mood.mood}** (${Math.round(
                  (insights.mood.confidence || 0) * 100,
                )}% confidence) — ${insights.mood.reasoning}.`
              : "I couldn't infer a specific mood yet.";

            const artistLine =
              topArtistNames.length > 0
                ? `Top artists right now: ${topArtistNames.map((name, idx) => `${idx + 1}. ${name}`).join(' | ')}`
                : 'No standout artists yet—want me to explore something new?';
            const trackLine =
              topTrackNames.length > 0
                ? `Most-played tracks: ${topTrackNames.map((track, idx) => `${idx + 1}. ${track}`).join(' | ')}`
                : 'No recent track streaks to report.';

            const checkInSections = [
              `• Vibe check: ${moodLine.replace(/\*\*/g, '')}`,
              `• ${artistLine}`,
              `• ${trackLine}`,
            ];

            const heroTrack = insights.topTracks[0];
            const heroArtist = insights.topArtists[0];
            const spotlight =
              heroTrack && heroArtist
                ? `Spotlight: "${heroTrack.name}" by ${heroArtist.name} has been on repeat.`
                : '';

            agentResponse = `Spotify check-in:\n\n${checkInSections.join('\n')}\n${spotlight ? `\n${spotlight}` : ''}`;
          } catch (error) {
            if (error instanceof SpotifyIntegrationError) {
              agentResponse =
                error.reason === 'NOT_CONNECTED'
                  ? "I can't reach Spotify because it isn't connected yet. You can connect it from the Integrations page."
                  : error.reason === 'TOKEN_REFRESH_FAILED'
                  ? "Your Spotify connection looks expired. Try reconnecting it in the Integrations page."
                  : "I'm having trouble reaching Spotify right now. Please try again shortly.";
            } else {
              console.error('[CHAT] Error fetching Spotify insights:', error);
              agentResponse = "I ran into an error while checking Spotify. Please try again.";
            }
          }
          continue;
        }

        // Handle Gmail requests
        if (fc.name === 'get_gmail_messages') {
          try {
            const { unread, maxResults } = fc.arguments || {};
            const unreadFlag = typeof unread === 'boolean' ? unread : Boolean(unread);
            const messages = await fetchGmailMessages(recordId, {
              unread: unreadFlag,
              maxResults: maxResults ? Number(maxResults) : undefined,
            });

            functionResults.push({
              name: 'get_gmail_messages',
              result: { success: true, messages },
            });

            if (messages.length > 0) {
              const messagesList = messages
                .map((m) => `- From: ${m.from} | Subject: ${m.subject} | ${m.date}`)
                .join('\n');
              agentResponse = `Here are your ${unreadFlag ? 'unread ' : ''}emails:\n\n${messagesList}`;
            } else {
              agentResponse = `You don't have any ${unreadFlag ? 'unread ' : ''}emails.`;
            }
          } catch (error) {
            if (error instanceof GoogleIntegrationError) {
              agentResponse =
                error.reason === 'NOT_CONNECTED'
                  ? "I couldn't access your Gmail because Google isn't connected yet. You can connect it in the Integrations page."
                  : error.reason === 'TOKEN_REFRESH_FAILED'
                  ? "Your Google connection looks expired. Try reconnecting it in the Integrations page."
                  : "I'm having trouble accessing your Gmail right now. Please try again in a moment.";
            } else {
              console.error('[CHAT] Error fetching Gmail messages:', error);
              agentResponse = "I encountered an error while trying to access your Gmail. Please try again.";
            }
          }
          continue;
        }
        
        // Handle Gmail send requests
        if (fc.name === 'send_gmail') {
          try {
            const { recordId: gmailRecordId, to, subject, body } = fc.arguments;
            
            // CRITICAL: Always use the recordId from request context, ignore what agent provides
            // The agent may pass wrong values like '1', so we always use the correct one
            const gmailSendRecordId = recordId; // Always use request context recordId
            
            if (!to || !to.includes('@')) {
              agentResponse = "I need a valid email address to send the email. What's the recipient's email address?";
              continue;
            }
            
            // Extract email from message and update contact if needed
            // If user just provided an email (like "alialfaras7@gmail.com"), try to link it to recent contact
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailRegex.test(message.trim()) && message.trim().toLowerCase() === to.toLowerCase()) {
              // User just provided an email - try to find the most recently mentioned contact
              try {
                const recentMessages = await getChatMessages({
                  threadId,
                  limit: 5,
                });
                
                // Look for contact name in recent messages
                for (const msg of recentMessages.messages.slice().reverse()) {
                  if (msg.role === 'assistant' && msg.message.includes("don't have their email address")) {
                    // Extract contact name from message like "I found Ali in your contacts, but I don't have their email address"
                    const nameMatch = msg.message.match(/I found (\w+) in your contacts/);
                    if (nameMatch && nameMatch[1]) {
                      const contactName = nameMatch[1];
                      console.log('[CHAT] Found contact name from context:', contactName);
                      
                      // Update contact with email and lastContacted
                      await upsertContact({
                        recordId: gmailSendRecordId,
                        name: contactName,
                        email: to,
                        lastContacted: new Date().toISOString(),
                      });
                      console.log('[CHAT] ✅ Updated contact with email and lastContacted:', { 
                        name: contactName, 
                        email: to,
                        lastContacted: new Date().toISOString()
                      });
                      break;
                    }
                  }
                }
              } catch (contactUpdateError) {
                console.warn('[CHAT] Failed to update contact with email:', contactUpdateError);
                // Don't fail the email send if contact update fails
              }
            }
            
            const contactNameForEmail = (
              lastContactLookup?.contact?.name ||
              lastContactLookup?.name ||
              ''
            ).trim();
            const relationshipForEmail =
              lastContactLookup?.contact?.relationship ||
              (typeof extractedRelationship !== 'undefined' ? extractedRelationship : undefined) ||
              undefined;

            try {
              await sendGmailMessage(gmailSendRecordId, {
                to,
                subject: subject || '',
                body: body || '',
              });

              functionResults.push({
                name: 'send_gmail',
                result: {
                  success: true,
                  to,
                  subject: subject || '',
                },
              });

              const safeSubject = (subject || '').trim() || '(no subject)';
              const safeBody = (body || '').trim();
              const previewBody =
                safeBody.length > 140
                  ? `${safeBody.slice(0, 140)}...`
                  : safeBody || '(no body provided)';

              // Always update contact after successful email send, even if we only have email
              try {
                if (contactNameForEmail) {
                  // We have a contact name, update with full info
                  await upsertContact({
                    recordId,
                    name: contactNameForEmail,
                    email: to,
                    relationship: relationshipForEmail || undefined,
                    lastContacted: new Date().toISOString(),
                  });
                  console.log('[CHAT] ✅ Contact synced after email send:', {
                    name: contactNameForEmail,
                    email: to,
                    lastContacted: new Date().toISOString(),
                  });
                } else {
                  // No contact name found, but we have email - try to find or create contact by email
                  // Extract name from email if possible (e.g., "alialfaras7@gmail.com" -> "Ali")
                  const emailNameMatch = to.match(/^([^@]+)@/);
                  if (emailNameMatch) {
                    const potentialName = emailNameMatch[1].split(/[._0-9]/)[0];
                    if (potentialName && potentialName.length > 1) {
                      const capitalizedName = potentialName.charAt(0).toUpperCase() + potentialName.slice(1).toLowerCase();
                      await upsertContact({
                        recordId,
                        name: capitalizedName,
                        email: to,
                        lastContacted: new Date().toISOString(),
                      });
                      console.log('[CHAT] ✅ Created/updated contact from email after send:', {
                        name: capitalizedName,
                        email: to,
                        lastContacted: new Date().toISOString(),
                      });
                    }
                  }
                }
              } catch (contactSyncError) {
                console.error('[CHAT] ❌ Failed to sync contact after email send:', {
                  error: contactSyncError instanceof Error ? contactSyncError.message : String(contactSyncError),
                  name: contactNameForEmail || 'unknown',
                  email: to,
                });
              }

              lastContactLookup = null;

              agentResponse = `Sent your email to ${to} with subject "${safeSubject}". Message preview: "${previewBody}".`;
            } catch (error) {
              console.error('[CHAT] ❌ Gmail send error details:', {
                error: error instanceof Error ? error.message : String(error),
                errorType: error instanceof GoogleIntegrationError ? error.reason : 'UNKNOWN',
                recordId: gmailSendRecordId,
                to,
                subject: subject?.substring(0, 50),
                stack: error instanceof Error ? error.stack : undefined,
              });

              if (error instanceof GoogleIntegrationError) {
                agentResponse =
                  error.reason === 'NOT_CONNECTED'
                    ? "I couldn't send the email because Google isn't connected yet. You can connect it in the Integrations page."
                    : error.reason === 'TOKEN_REFRESH_FAILED'
                    ? "Your Google connection looks expired. Try reconnecting it in the Integrations page."
                    : error.reason === 'INSUFFICIENT_PERMISSIONS'
                    ? "Google is connected but missing permission to send emails. Please reconnect Google and allow Gmail access."
                    : error.message || "I'm having trouble sending the email right now. Please try again in a moment.";
              } else {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error('[CHAT] ❌ Unexpected Gmail error:', {
                  errorMessage,
                  error,
                  recordId: gmailSendRecordId,
                });
                agentResponse = `I couldn't send the email: ${errorMessage}. Please check your Google connection in the Integrations page or try again.`;
              }
              continue;
            }
          } catch (error) {
            if (error instanceof GoogleIntegrationError) {
              agentResponse =
                error.reason === 'NOT_CONNECTED'
                  ? "I couldn't send the email because Google isn't connected yet. You can connect it in the Integrations page."
                  : error.reason === 'TOKEN_REFRESH_FAILED'
                  ? "Your Google connection looks expired. Try reconnecting it in the Integrations page."
                  : "I'm having trouble sending the email right now. Please try again in a moment.";
            } else {
              console.error('[CHAT] Error sending Gmail:', error);
              agentResponse = "I encountered an error while trying to send the email. Please try again.";
            }
          }
          continue;
        }
        
        // Handle contact lookup requests
        if (fc.name === 'get_contact_by_name') {
          try {
            const { recordId: contactRecordId, name } = fc.arguments;
            // CRITICAL: Always use the recordId from request context, ignore what agent provides
            // The agent may pass wrong values like 'malph' or '1', so we always use the correct one
            const lookupRecordId = recordId; // Always use request context recordId
            
            if (!name || typeof name !== 'string' || !name.trim()) {
              functionResults.push({
                name: 'get_contact_by_name',
                result: { success: false, error: 'Name is required' },
              });
              continue;
            }
            
            // Use the name as-is - trust the AI to extract correctly
            // If user said "mo money", that's the name - don't truncate it
            const cleanName = name.trim();
            
            console.log('[CHAT] Contact lookup requested:', { providedName: name.trim(), cleanName, recordId: lookupRecordId });
            
            const contact = await getContactByName(lookupRecordId, cleanName);
            lastContactLookup = { name: cleanName, contact: contact || undefined };
            
            if (contact) {
              const result: any = {
                success: true,
                contact: {
                  name: contact.name,
                  phone: contact.phone || null,
                  email: contact.email || null,
                  relationship: contact.relationship || null,
                  notes: contact.notes || null,
                },
              };
              
              // OPTION 2: Automatically trigger call if contact has phone number and user requested a call
              // Check if the user's message contains call-related keywords
              const userMessage = message.trim().toLowerCase();
              const isCallRequest = userMessage.includes('call') || userMessage.includes('phone') || userMessage.includes('text');
              const isEmailRequest = userMessage.includes('email') || userMessage.includes('send');
              
              if (contact.phone && isCallRequest) {
                console.log('[CHAT] Auto-triggering call for contact:', { name: contact.name, phone: contact.phone });
                
                try {
                  // Extract message from user's original message
                  // Try to extract what they want to say/ask
                  let callMessage = 'Hello, this is a call on behalf of the owner.';
                  
                  // Try to extract the message/request from the user's message
                  const messagePatterns = [
                    /(?:call|text|phone).*?(?:ask|tell|say|for|about|if|can|will|to)\s+(.+)/i,
                    /(?:ask|tell|say)\s+(?:him|her|them)\s+(.+)/i,
                    /(?:for|about)\s+(.+)/i,
                  ];
                  
                  for (const pattern of messagePatterns) {
                    const match = message.match(pattern);
                    if (match && match[1]) {
                      callMessage = match[1].trim();
                      // Limit message length
                      if (callMessage.length > 200) {
                        callMessage = callMessage.substring(0, 200) + '...';
                      }
                      break;
                    }
                  }
                  
                  // If no specific message extracted, use a default based on context
                  if (callMessage === 'Hello, this is a call on behalf of the owner.') {
                    // Check if there's a specific request in the message
                    if (userMessage.includes('dinner') || userMessage.includes('tomorrow') || userMessage.includes('tmr')) {
                      callMessage = 'The owner would like to know if you can come for dinner tomorrow.';
                    } else if (userMessage.includes('come') || userMessage.includes('available')) {
                      callMessage = 'The owner would like to know if you are available.';
                    } else {
                      callMessage = 'The owner would like to speak with you.';
                    }
                  }
                  
                  // Normalize phone number
                  const normalizedPhone = formatPhoneNumberToE164(contact.phone);
                  
                  if (normalizedPhone) {
                    // Call the make-call API
                    const makeCallResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/make-call`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        phone_number: normalizedPhone,
                        message: callMessage,
                        owner_agent_id: String(agentId),
                        recordId: recordId,
                        threadId: threadId,
                      }),
                    });
                    
                    if (makeCallResponse.ok) {
                      const callResult = await makeCallResponse.json();
                      const phoneDisplay = normalizedPhone.replace(/^\+1/, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
                      
                      result.autoCallTriggered = true;
                      result.callStatus = {
                        success: true,
                        callId: callRequestId,
                        phoneNumber: phoneDisplay,
                        message: `Call to ${contact.name} (${phoneDisplay}) has been initiated.`,
                      };
                      
                      // Store call request context for chat integration
                      if (callResult.call_id && !callResult.scheduled) {
                        try {
                          await createOutboundCallRequest({
                            callId: callResult.call_id,
                            recordId: recordId,
                            threadId: threadId,
                            status: 'pending',
                            phoneNumber: normalizedPhone,
                          });
                          console.log('[CHAT] Stored outbound call request for chat integration');
                        } catch (error) {
                          console.warn('[CHAT WARNING] Failed to store outbound call request:', error);
                        }
                      }
                      
                      console.log('[CHAT] Auto-triggered call successful:', { contactName: contact.name, phone: phoneDisplay, callId: callRequestId });
                      
                      // Update agent response to reflect the call was made
                      if (!agentResponse || agentResponse.trim() === '' || agentResponse.includes("I'll take care of that")) {
                        agentResponse = `I found ${contact.name} in your contacts and called ${phoneDisplay}. The call summary will appear here once it completes.`;
                      }
                      
                      // Set call status for response
                      callStatus = {
                        success: true,
                        callId: callResult.call_id || callResult.task_id,
                        phoneNumber: phoneDisplay,
                        message: `Successfully called ${contact.name} at ${phoneDisplay}.`,
                      } as any;
                      // Update callRequestId
                      callRequestId = callResult.call_id || callResult.task_id;
                    } else {
                      const errorData = await makeCallResponse.json().catch(() => ({}));
                      console.error('[CHAT] Auto-triggered call failed:', errorData);
                      result.autoCallTriggered = false;
                      result.callError = errorData.message || 'Failed to initiate call';
                      
                      // Update agent response to reflect the error
                      if (!agentResponse || agentResponse.trim() === '') {
                        agentResponse = `I found ${contact.name} in your contacts but couldn't make the call. ${errorData.message || 'Please try again.'}`;
                      }
                    }
                  } else {
                    console.error('[CHAT] Invalid phone number format for auto-call:', contact.phone);
                    result.autoCallTriggered = false;
                    result.callError = 'Invalid phone number format';
                  }
                } catch (error) {
                  console.error('[CHAT] Error auto-triggering call:', error);
                  result.autoCallTriggered = false;
                  result.callError = 'Failed to initiate call automatically';
                  
                  // Update agent response to reflect the error
                  if (!agentResponse || agentResponse.trim() === '') {
                    agentResponse = `I found ${contact.name} in your contacts but encountered an error making the call. Please try again.`;
                  }
                }
              } else if (contact.email && isEmailRequest) {
                // OPTION 2: Automatically trigger email if contact has email and user requested email
                console.log('[CHAT] Auto-triggering email for contact:', { name: contact.name, email: contact.email });
                
                // Extract email content from user's message
                let emailSubject = 'Message from owner';
                let emailBody = 'Hello, this is a message on behalf of the owner.';
                
                // Try to extract subject/body from user's message
                const emailPatterns = [
                  /(?:email|send).*?(?:about|regarding|re:)\s+(.+?)(?:\s+(?:that|to|saying|asking|tell|say))?/i,
                  /(?:tell|say|ask)\s+(?:him|her|them)\s+(.+)/i,
                  /(?:about|regarding)\s+(.+)/i,
                ];
                
                for (const pattern of emailPatterns) {
                  const match = message.match(pattern);
                  if (match && match[1]) {
                    const extracted = match[1].trim();
                    if (extracted.length > 0 && extracted.length < 100) {
                      emailSubject = extracted;
                      emailBody = extracted;
                    } else if (extracted.length >= 100) {
                      emailBody = extracted;
                    }
                    break;
                  }
                }
                
                // Check for specific context
                const userMessage = message.trim().toLowerCase();
                if (userMessage.includes('dinner') || userMessage.includes('tomorrow') || userMessage.includes('tmr')) {
                  emailSubject = 'Dinner invitation';
                  emailBody = 'The owner would like to know if you can come for dinner tomorrow.';
                }
                
                // Note: We don't auto-send emails because we need the user to provide the email content
                // Instead, we provide the email address to the agent with clear instructions
                result.instruction = `Contact found with email ${contact.email}. IMMEDIATELY use this email address to send the email using send_gmail function. Subject: "${emailSubject}", Body: "${emailBody}". Do NOT ask for the email address - use ${contact.email} directly.`;
                result.emailReady = true;
                result.suggestedSubject = emailSubject;
                result.suggestedBody = emailBody;
              } else if (contact.phone) {
                // Contact has phone but user didn't request a call - just inform agent
                result.instruction = `Contact found with phone number ${contact.phone}. Use this phone number if the user requests a call.`;
              } else if (contact.email) {
                // Contact has email but user didn't request email - just inform agent
                result.instruction = `Contact found with email ${contact.email}. Use this email address if the user requests to send an email.`;
              } else {
                // Contact found but no phone or email - tell agent to ask
                const isEmailRequestCheck = userMessage.includes('email') || userMessage.includes('send');
                if (isEmailRequestCheck) {
                  result.instruction = `Contact "${contact.name}" found but does not have an email address. You MUST ask the user: "What's ${contact.name}'s email address?"`;
                  // Update agent response to ask for email - override generic responses
                  const genericResponses = [
                    "I'll take care of that",
                    "Sounds good",
                    "I'll make the call",
                    "I'll send the email",
                    "Do you need anything else"
                  ];
                  const isGenericResponse = !agentResponse || 
                    agentResponse.trim() === '' || 
                    genericResponses.some(phrase => agentResponse.toLowerCase().includes(phrase.toLowerCase()));
                  
                  if (isGenericResponse) {
                    agentResponse = `I found ${contact.name} in your contacts, but I don't have their email address. What's ${contact.name}'s email address?`;
                    console.log('[CHAT] Updated agent response to ask for email:', agentResponse);
                  }
                } else {
                  result.instruction = `Contact "${contact.name}" found but does not have a phone number. You MUST ask the user for the phone number if they want to make a call.`;
                }
              }
              
              functionResults.push({
                name: 'get_contact_by_name',
                result,
              });
              console.log('[CHAT] Contact lookup successful:', { name: contact.name, hasPhone: !!contact.phone, hasEmail: !!contact.email, autoCallTriggered: result.autoCallTriggered || false });
            } else {
              // Contact not found - AI should ask for phone number/email
              const userMessage = message.trim().toLowerCase();
              const isCallRequest = userMessage.includes('call') || userMessage.includes('phone') || userMessage.includes('text');
              const isEmailRequest = userMessage.includes('email') || userMessage.includes('send');
              
              functionResults.push({
                name: 'get_contact_by_name',
                result: {
                  success: false,
                  error: 'Contact not found',
                  message: `I couldn't find a contact named "${cleanName}" in your contacts.`,
                  // Add instruction for AI about what to do next
                  instruction: isCallRequest 
                    ? `Contact "${cleanName}" not found. You MUST ask the user: "I don't have ${cleanName} in your contacts. What's their phone number?"`
                    : isEmailRequest
                    ? `Contact "${cleanName}" not found. You MUST ask the user: "I don't have ${cleanName} in your contacts. What's their email address?"`
                    : `Contact "${cleanName}" not found in contacts.`,
                  requestedAction: isCallRequest ? 'call' : isEmailRequest ? 'email' : null,
                  contactName: cleanName,
                },
              });
              console.log('[CHAT] Contact lookup failed - contact not found:', cleanName, 'Requested action:', isCallRequest ? 'call' : isEmailRequest ? 'email' : 'none');
            }
          } catch (error) {
            console.error('[CHAT] Error looking up contact:', error);
            functionResults.push({
              name: 'get_contact_by_name',
              result: {
                success: false,
                error: 'Failed to lookup contact',
                message: 'I encountered an error while looking up the contact. Please try again.',
              },
            });
          }
          continue;
        }
        
        // Handle outbound call requests
        if (fc.name === 'make_outbound_call' || fc.name === 'schedule_outbound_call') {
          try {
            // Check if user just provided phone number without message
            // If message is missing or generic, ask for it before making call
            const callMessage = fc.arguments.message || '';
            const rawPhoneNumber = fc.arguments.phone_number;
            const normalizedPhone = formatPhoneNumberToE164(rawPhoneNumber);
            
            // Check if this is a phone-only message (user just provided phone after being asked)
            const phoneOnlyRegex = /^[\d\s\(\)\.\-\+]{10,}$/;
            const isPhoneOnlyMessage = phoneOnlyRegex.test(message.trim().replace(/\D/g, '')) && 
                                       message.trim().replace(/\D/g, '').length >= 10 &&
                                       (!callMessage || callMessage.trim() === '' || callMessage.length < 5);
            
            // CRITICAL: Check for missing message BEFORE making call
            if (isPhoneOnlyMessage || !callMessage || callMessage.trim() === '' || callMessage.length < 5) {
              // User just provided phone number, need to ask for message
              // Check if we recently asked for phone number
              try {
                const recentMessages = await getChatMessages({
                  threadId,
                  limit: 5,
                });
                
                const recentlyAskedForPhone = recentMessages.messages.some(msg => 
                  msg.role === 'assistant' && 
                  (msg.message.includes("phone number") || msg.message.includes("don't have"))
                );
                
                if (recentlyAskedForPhone) {
                  // Extract contact name from recent assistant messages
                  // The AI should have said "I don't have [name] in your contacts"
                  // Extract whatever name the AI mentioned - could be "Mo", "mo money", "John Smith", etc.
                  let contactName = 'them';
                  for (const msg of recentMessages.messages.slice().reverse()) {
                    if (msg.role === 'assistant' && msg.message.includes("don't have")) {
                      // Match any text between "don't have" and "in your contacts" - that's the name
                      const nameMatch = msg.message.match(/I don't have (.+?) in your contacts/i) ||
                                       msg.message.match(/don't have (.+?) in your contacts/i);
                      if (nameMatch && nameMatch[1]) {
                        contactName = nameMatch[1].trim(); // Use name as-is, don't truncate
                        break;
                      }
                    }
                  }
                  
                  // Override response to ask for message instead of making call
                  agentResponse = `Got it! What message should I deliver to ${contactName}?`;
                  callStatus = {
                    success: false,
                    message: 'Need message before making call',
                  };
                  console.log('[CHAT] Phone number provided but no message - asking for message:', { contactName, phone: normalizedPhone || 'unknown' });
                  continue; // Skip making the call - CRITICAL
                }
              } catch (error) {
                console.warn('[CHAT] Error checking recent messages for phone-only detection:', error);
              }
            }
            
            // Check for duplicate calls: prevent making the same call twice in quick succession
            // Check recent chat messages for the same call request
            try {
              if (!normalizedPhone) {
                throw new Error('Phone number not normalized');
              }
              
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

            // CRITICAL: Extract contact name from conversation context and create/update contact BEFORE making call
            let contactNameFromContext: string | null = null;
            let relationshipFromContext: string | null = null;
            
            try {
              const recentMessages = await getChatMessages({ threadId, limit: 10 });
              
              // Look for contact name in recent assistant messages
              // The AI should have said "I don't have [name] in your contacts. What's their phone number?"
              for (const msg of recentMessages.messages.slice().reverse()) {
                if (msg.role === 'assistant' && msg.message.includes("don't have")) {
                  // Match any text between "don't have" and "in your contacts" - that's the name
                  const nameMatch = msg.message.match(/I don't have (.+?) in your contacts/i) ||
                                   msg.message.match(/don't have (.+?) in your contacts/i);
                  if (nameMatch && nameMatch[1]) {
                    contactNameFromContext = nameMatch[1].trim(); // Use name as-is, don't truncate
                    break;
                  }
                }
              }
              
              // Look for relationship in recent user messages
              for (const msg of recentMessages.messages.slice().reverse()) {
                if (msg.role === 'user') {
                  const relMatch = msg.message.match(/(?:my|a|an)\s+(friend|colleague|brother|sister|dad|mom|father|mother|aunt|uncle|cousin|boss|manager|client|customer|neighbor)/i);
                  if (relMatch && relMatch[1]) {
                    relationshipFromContext = relMatch[1].toLowerCase();
                    break;
                  }
                }
              }
            } catch (error) {
              console.warn('[CHAT] Error getting contact name/relationship from context:', error);
            }

            const contactNameForCallUpdate =
              (typeof fc.arguments.caller_name === 'string' &&
                fc.arguments.caller_name.trim()) ||
              contactNameFromContext ||
              lastContactLookup?.contact?.name ||
              lastContactLookup?.name ||
              null;
            const relationshipForCallUpdate =
              relationshipFromContext ||
              lastContactLookup?.contact?.relationship ||
              (typeof extractedRelationship !== 'undefined' ? extractedRelationship : undefined) ||
              undefined;
            
            // Create/update contact BEFORE making call (backup in case phone-only handler failed)
            if (normalizedPhone && contactNameFromContext) {
              try {
                const createdContact = await upsertContact({
                  recordId,
                  name: contactNameFromContext,
                  phone: normalizedPhone,
                  relationship: relationshipFromContext || undefined,
                  lastContacted: new Date().toISOString(),
                });
                console.log('[CHAT] ✅✅✅ CONTACT CREATED WHEN CALL MADE (backup):', { 
                  name: contactNameFromContext, 
                  phone: normalizedPhone,
                  relationship: relationshipFromContext,
                  contactId: createdContact.id
                });
              } catch (error) {
                console.error('[CHAT] ❌ Failed to create contact when call made:', error);
              }
            }
            
            // Also try extraction from message (for cases where name is in the message itself)
            const messageForExtraction = `${message || ''} ${fc.arguments.caller_name ? `call ${fc.arguments.caller_name}` : ''}`.trim();
            if (messageForExtraction) {
              try {
                const timestamp = new Date().toISOString();
                const extractedContact = await extractContactFromMessage(
                  recordId,
                  messageForExtraction,
                  timestamp
                );
                if (extractedContact) {
                  console.log('[CHAT] Extracted contact before outbound call:', {
                    name: extractedContact.name,
                    phone: extractedContact.phone,
                    relationship: extractedContact.relationship,
                  });
                }
              } catch (contactError) {
                // Log but don't fail - contact extraction is non-critical
                console.warn('[CHAT WARNING] Failed to extract contact before call:', contactError);
              }
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
                callId: callResult.call_id || callResult.task_id,
                phoneNumber: phoneDisplay,
                message: `${kendallName || 'I'} successfully called ${phoneDisplay}.`
              } as any;
              console.log('[CHAT SUCCESS] Outbound call initiated:', { normalizedPhone, callRequestId });

              // Always update contact after successful call, even if we only have phone number
              const lastContactedTimestamp = new Date().toISOString();
              try {
                if (contactNameForCallUpdate) {
                  // We have a contact name, update with full info
                  await upsertContact({
                    recordId,
                    name: contactNameForCallUpdate,
                    phone: normalizedPhone,
                    relationship: relationshipForCallUpdate || undefined,
                    lastContacted: lastContactedTimestamp,
                  });
                  console.log('[CHAT] ✅ Contact synced after call:', {
                    name: contactNameForCallUpdate,
                    phone: normalizedPhone,
                    lastContacted: lastContactedTimestamp,
                  });
                } else {
                  // No contact name, but we have phone - try to find existing contact by phone
                  // If found, update it; if not, create with phone number as name placeholder
                  try {
                    const existingContacts = await getContactByName(recordId, normalizedPhone);
                    if (existingContacts && existingContacts.length > 0) {
                      // Found existing contact, update it
                      await upsertContact({
                        recordId,
                        name: existingContacts[0].name,
                        phone: normalizedPhone,
                        lastContacted: lastContactedTimestamp,
                      });
                      console.log('[CHAT] ✅ Updated existing contact after call (by phone):', {
                        name: existingContacts[0].name,
                        phone: normalizedPhone,
                        lastContacted: lastContactedTimestamp,
                      });
                    } else {
                      // No existing contact found, create one with phone as identifier
                      await upsertContact({
                        recordId,
                        name: phoneDisplay, // Use formatted phone as name placeholder
                        phone: normalizedPhone,
                        lastContacted: lastContactedTimestamp,
                      });
                      console.log('[CHAT] ✅ Created contact after call (phone only):', {
                        name: phoneDisplay,
                        phone: normalizedPhone,
                        lastContacted: lastContactedTimestamp,
                      });
                    }
                  } catch (phoneLookupError) {
                    console.warn('[CHAT] Could not lookup contact by phone, creating new contact:', phoneLookupError);
                    // Create contact with phone number as name
                    await upsertContact({
                      recordId,
                      name: phoneDisplay,
                      phone: normalizedPhone,
                      lastContacted: lastContactedTimestamp,
                    });
                  }
                }
              } catch (contactSyncError) {
                console.error('[CHAT] ❌ Failed to sync contact after call:', {
                  error: contactSyncError instanceof Error ? contactSyncError.message : String(contactSyncError),
                  name: contactNameForCallUpdate || 'unknown',
                  phone: normalizedPhone,
                });
              }
              lastContactLookup = null;
              
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

    // ✅ Post-process: Override agent response based on function results
    // This ensures we ask for missing information even if agent gave generic response
    console.log('[CHAT] Post-process check:', { 
      functionResultsCount: functionResults?.length || 0,
      agentResponse: agentResponse?.substring(0, 50),
      userMessage: message.trim().substring(0, 50)
    });
    
    if (functionResults && functionResults.length > 0) {
      for (const fr of functionResults) {
        if (fr.name === 'get_contact_by_name') {
          console.log('[CHAT] Found get_contact_by_name result:', { 
            success: fr.result?.success, 
            hasContact: !!fr.result?.contact,
            contactName: fr.result?.contact?.name,
            hasEmail: !!fr.result?.contact?.email,
            hasPhone: !!fr.result?.contact?.phone
          });
          
          if (fr.result && fr.result.success) {
            // Contact found - check if missing required info
            const contact = fr.result.contact;
            const userMessage = message.trim().toLowerCase();
            const isEmailRequest = userMessage.includes('email') || userMessage.includes('send');
            const isCallRequest = userMessage.includes('call') || userMessage.includes('phone') || userMessage.includes('text');
            
            console.log('[CHAT] Checking if should ask for missing info:', { 
              isEmailRequest, 
              isCallRequest,
              hasEmail: !!contact?.email,
              hasPhone: !!contact?.phone,
              contactName: contact?.name 
            });
            
            // If user requested email but contact doesn't have email, override response
            if (isEmailRequest && contact && !contact.email) {
              const genericResponses = [
                "I'll take care of that",
                "Sounds good",
                "I'll make the call",
                "I'll send the email",
                "Do you need anything else"
              ];
              const isGenericResponse = !agentResponse || 
                agentResponse.trim() === '' || 
                genericResponses.some(phrase => agentResponse.toLowerCase().includes(phrase.toLowerCase()));
              
              console.log('[CHAT] Should override response?', { 
                isGenericResponse, 
                currentResponse: agentResponse?.substring(0, 100) 
              });
              
              if (isGenericResponse) {
                agentResponse = `I found ${contact.name} in your contacts, but I don't have their email address. What's ${contact.name}'s email address?`;
                console.log('[CHAT] ✅ Post-process: Overrode agent response to ask for email:', agentResponse);
              }
            }
            
            // If user requested call but contact doesn't have phone, override response
            if (isCallRequest && contact && !contact.phone) {
              const genericResponses = [
                "I'll take care of that",
                "Sounds good",
                "I'll make the call",
                "I'll call them",
                "Do you need anything else"
              ];
              const isGenericResponse = !agentResponse || 
                agentResponse.trim() === '' || 
                genericResponses.some(phrase => agentResponse.toLowerCase().includes(phrase.toLowerCase()));
              
              if (isGenericResponse) {
                agentResponse = `I found ${contact.name} in your contacts, but I don't have their phone number. What's ${contact.name}'s phone number?`;
                console.log('[CHAT] ✅ Post-process: Overrode agent response to ask for phone:', agentResponse);
              }
            }
          } else if (fr.result && !fr.result.success && fr.result.instruction) {
            // Contact not found - override generic response to ask for info
            const genericResponses = [
              "I'll take care of that",
              "Sounds good",
              "I'll make the call",
              "I'll call them",
              "I'll send the email",
              "Do you need anything else"
            ];
            const isGenericResponse = !agentResponse || 
              agentResponse.trim() === '' || 
              genericResponses.some(phrase => agentResponse.toLowerCase().includes(phrase.toLowerCase()));
            
            // CRITICAL: Always override if contact not found, even if response isn't generic
            // This ensures we ALWAYS ask for phone/email when contact doesn't exist
            if (fr.result.requestedAction && fr.result.contactName) {
              const contactName = fr.result.contactName;
              if (fr.result.requestedAction === 'call') {
                agentResponse = `I don't have ${contactName} in your contacts. What's their phone number?`;
                console.log('[CHAT] ✅ Post-process: Contact not found - asking for phone:', { contactName });
              } else if (fr.result.requestedAction === 'email') {
                agentResponse = `I don't have ${contactName} in your contacts. What's their email address?`;
                console.log('[CHAT] ✅ Post-process: Contact not found - asking for email:', { contactName });
              }
            } else if (isGenericResponse && fr.result.requestedAction && fr.result.contactName) {
              // Fallback: only override if generic response
              const contactName = fr.result.contactName;
              if (fr.result.requestedAction === 'call') {
                agentResponse = `I don't have ${contactName} in your contacts. What's their phone number?`;
              } else if (fr.result.requestedAction === 'email') {
                agentResponse = `I don't have ${contactName} in your contacts. What's their email address?`;
              }
              console.log('[CHAT] ✅ Post-process: Overrode generic response to ask for contact info:', agentResponse);
            }
          }
        }
      }
    }
    
    // Post-process: Check if user provided just a phone number (after being asked)
    // If so, we should ask for message instead of making call immediately
    const phoneOnlyRegex = /^[\d\s\(\)\.\-\+]{10,}$/;
    const isPhoneOnlyMessage = phoneOnlyRegex.test(message.trim().replace(/\D/g, '')) && 
                               message.trim().replace(/\D/g, '').length >= 10 &&
                               message.trim().length < 20; // Likely just a phone number
    
    if (isPhoneOnlyMessage) {
      // Check if we recently asked for phone number
      try {
        const recentMessages = await getChatMessages({
          threadId,
          limit: 5,
        });
        
        const recentlyAskedForPhone = recentMessages.messages.some(msg => 
          msg.role === 'assistant' && 
          (msg.message.includes("phone number") || msg.message.includes("don't have"))
        );
        
        if (recentlyAskedForPhone) {
          // Extract contact name from recent assistant messages
          // The AI should have said "I don't have [name] in your contacts"
          // Extract whatever name the AI mentioned - could be "Mo", "mo money", "John Smith", etc.
          let contactName = 'them';
          for (const msg of recentMessages.messages.slice().reverse()) {
            if (msg.role === 'assistant' && msg.message.includes("don't have")) {
              // Match any text between "don't have" and "in your contacts" - that's the name
              const nameMatch = msg.message.match(/I don't have (.+?) in your contacts/i) ||
                               msg.message.match(/don't have (.+?) in your contacts/i);
              if (nameMatch && nameMatch[1]) {
                contactName = nameMatch[1].trim(); // Use name as-is, don't truncate
                break;
              }
            }
          }
          
          // Check if AI tried to make a call without message
          const triedToCall = functionCalls && functionCalls.some(fc => 
            (fc.name === 'make_outbound_call' || fc.name === 'schedule_outbound_call') &&
            (!fc.arguments?.message || fc.arguments.message.trim() === '' || fc.arguments.message.length < 5)
          );
          
          if (triedToCall) {
            // Override response to ask for message
            agentResponse = `Got it! What message should I deliver to ${contactName}?`;
            console.log('[CHAT] ✅ Post-process: Phone number provided, asking for message:', { contactName });
            
            // Remove the call function call since we don't have message yet
            if (functionCalls) {
              functionCalls = functionCalls.filter(fc => 
                fc.name !== 'make_outbound_call' && fc.name !== 'schedule_outbound_call'
              );
            }
          } else if (!agentResponse || agentResponse.includes("I'll make the call") || agentResponse.includes("Sounds good")) {
            // AI gave generic response, ask for message
            agentResponse = `Got it! What message should I deliver to ${contactName}?`;
            console.log('[CHAT] ✅ Post-process: Phone number provided, asking for message (generic response override):', { contactName });
          }
        }
      } catch (error) {
        console.warn('[CHAT] Error in phone-only post-processing:', error);
      }
    } else {
      // Agent didn't call get_contact_by_name - check if it should have
      const userMessage = message.trim().toLowerCase();
      const isEmailRequest = userMessage.includes('email') || userMessage.includes('send');
      const isCallRequest = userMessage.includes('call') || userMessage.includes('phone') || userMessage.includes('text');
      
      if ((isEmailRequest || isCallRequest) && (!functionCalls || !functionCalls.some(fc => fc.name === 'get_contact_by_name'))) {
        console.log('[CHAT] ⚠️ Agent should have called get_contact_by_name but didn\'t. User message:', userMessage);
      }
    }
    
    // Post-process: Catch generic responses when AI should have asked for contact info
    // This is a safety net - the AI should handle this via get_contact_by_name function
    // We only override if AI gave generic response AND we can see from function results that contact wasn't found
    // We do NOT extract names here - we trust the AI to do that via get_contact_by_name
    const trimmedMessage = message.trim();
    const isPhoneNumber = /^[\d\s\(\)\.\-\+]{10,}$/.test(trimmedMessage.replace(/\D/g, '')) && trimmedMessage.replace(/\D/g, '').length >= 10;
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedMessage);
    
    // Only post-process if message is NOT a phone number or email (likely a name or other text)
    if (!isPhoneNumber && !isEmail && trimmedMessage.length < 50) {
      try {
        const recentMessages = await getChatMessages({
          threadId,
          limit: 5,
        });
        
        // Check if we recently asked for a name
        const recentlyAskedForName = recentMessages.messages.some(msg => 
          msg.role === 'assistant' && 
          (msg.message.includes("friend's name") || 
           msg.message.includes("name") && (msg.message.includes("message") || msg.message.includes("call")) ||
           msg.message.includes("Who do you") ||
           msg.message.includes("Can you please provide"))
        );
        
        // Check if this is a call or email request context
        const isCallContext = recentMessages.messages.some(msg => 
          msg.role === 'user' && 
          (msg.message.toLowerCase().includes('call') || msg.message.toLowerCase().includes('phone'))
        );
        const isEmailContext = recentMessages.messages.some(msg => 
          msg.role === 'user' && 
          (msg.message.toLowerCase().includes('email') || msg.message.toLowerCase().includes('send'))
        );
        
        // Check if assistant gave generic response
        const genericResponses = [
          "I'll take care of that",
          "Sounds good",
          "I'll make the call",
          "I'll call them",
          "I'll send the email",
          "Do you need anything else"
        ];
        const isGenericResponse = !agentResponse || 
          agentResponse.trim() === '' || 
          genericResponses.some(phrase => agentResponse.toLowerCase().includes(phrase.toLowerCase()));
        
        // Only override if: we asked for name, it's a call/email context, AI gave generic response, AND get_contact_by_name wasn't called or returned not found
        const contactLookupWasCalled = functionResults && functionResults.some(fr => fr.name === 'get_contact_by_name');
        const contactNotFound = functionResults && functionResults.some(fr => 
          fr.name === 'get_contact_by_name' && fr.result && !fr.result.success
        );
        
        if (recentlyAskedForName && (isCallContext || isEmailContext) && isGenericResponse && 
            (!contactLookupWasCalled || contactNotFound)) {
          // AI should have called get_contact_by_name but didn't, or contact wasn't found
          // We can't extract the name here (that's AI's job), so we give a generic prompt
          if (isCallContext) {
            agentResponse = `I don't have that contact in your contacts. What's their phone number?`;
            console.log('[CHAT] ✅ Post-process: Generic response after name request - asking for phone (AI should have called get_contact_by_name)');
          } else if (isEmailContext) {
            agentResponse = `I don't have that contact in your contacts. What's their email address?`;
            console.log('[CHAT] ✅ Post-process: Generic response after name request - asking for email (AI should have called get_contact_by_name)');
          }
        }
      } catch (error) {
        console.warn('[CHAT] Error in post-processing:', error);
      }
    }

    // Ensure callStatus is always included if it exists (for banner visibility)
    const response: any = {
      success: true,
      message: agentMessage,
      response: agentResponse,
      functionCalls: functionCalls || undefined,
      kendallName: kendallName,
    };
    
    // Always include callStatus if it exists (even if success: false)
    if (callStatus) {
      response.callStatus = callStatus;
    }
    
    return NextResponse.json(response);
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

