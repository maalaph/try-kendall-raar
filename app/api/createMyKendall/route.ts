import { createUserRecord, updateUserRecord, getUserRecord, formatAttachmentField, updateCanadianNumberMapping } from '@/lib/airtable';
import { createAgent, createAgentFromTemplate, purchaseNumber, updateAgent, updateAgentFromTemplate } from '@/lib/vapi';
import { parseUserContext } from '@/lib/promptBlocks';
import { sendKendallWelcomeEmail } from '@/lib/email';
import { rateLimit, getClientIP } from '@/lib/rateLimit';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Rate limiting: 5 requests per 15 minutes per IP
  const clientIP = getClientIP(request);
  const rateLimitResult = rateLimit(clientIP, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  });

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many requests. Please try again later.',
      },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
        },
      }
    );
  }

  let recordId: string | null = null;

  try {
    // Parse request body
    const body = await request.json();
    
    // Detect which format we're using (new wizard format vs old format)
    const isNewFormat = body.kendallName !== undefined && body.userContextAndRules !== undefined;
    
    let fullName, email, mobileNumber, forwardCalls, personalityChoices, personalityText, 
        customizationOptions, userContext, additionalInstructions, attachedFiles, voiceChoice,
        kendallName, nickname, selectedTraits, useCaseChoice, boundaryChoices, userContextAndRules,
        attachedFileUrls, fileUsageInstructions; // Array of { url: string, filename: string }
    
    if (isNewFormat) {
      // New wizard format
      ({
        fullName,
        email,
        mobileNumber,
        forwardCalls,
        kendallName,
        nickname,
        selectedTraits,
        useCaseChoice,
        boundaryChoices,
        userContextAndRules,
        voiceChoice,
        attachedFileUrls, // Array of file URLs from frontend
        fileUsageInstructions,
      } = body);
      
      // Parse userContextAndRules into context and instructions
      const parsed = parseUserContext(userContextAndRules || '');
      userContext = parsed.userContext;
      additionalInstructions = parsed.additionalInstructions;
      
      // Convert new format to old format for Airtable
      personalityChoices = selectedTraits || [];
      personalityText = ''; // Not used in new format
      customizationOptions = [];
      
      // Validate required fields for new format
      if (!fullName || !email || !mobileNumber || !kendallName || !useCaseChoice || !userContextAndRules) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Missing required fields: fullName, email, mobileNumber, kendallName, useCaseChoice, and userContextAndRules are required' 
          },
          { status: 400 }
        );
      }
    } else {
      // Old format (backward compatibility)
      ({
        fullName,
        email,
        mobileNumber,
        forwardCalls,
        personalityChoices,
        personalityText,
        customizationOptions,
        userContext,
        additionalInstructions,
        attachedFiles,
        voiceChoice,
      } = body);
      
      // Validate required fields for old format
      if (!fullName || !email || !mobileNumber || !userContext) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Missing required fields: fullName, email, mobileNumber, and userContext are required' 
          },
          { status: 400 }
        );
      }
    }

    // Step 1: Create initial Airtable record with status "processing"
    // Note: Files will be attached AFTER agent creation (as per requirements)
    const initialFields: Record<string, any> = {
      fullName,
      email,
      mobileNumber,
      forwardCalls: forwardCalls ? 'Y' : 'N',
      personalityChoices: (personalityChoices && Array.isArray(personalityChoices) 
        ? personalityChoices 
        : (selectedTraits || [])).join(', '),
      personality: personalityText || '',
      customizationOptions: customizationOptions && customizationOptions.length > 0 
        ? customizationOptions.join(', ') 
        : '',
      userContext: userContext || (isNewFormat ? parseUserContext(userContextAndRules).userContext : ''),
      additionalInstructions: additionalInstructions || (isNewFormat ? parseUserContext(userContextAndRules).additionalInstructions : ''),
      status: 'processing',
    };
    
    // Add new format fields if present
    if (isNewFormat && kendallName) {
      initialFields.kendallName = kendallName;
    }
    if (nickname) {
      initialFields.nickname = nickname;
    }
    if (useCaseChoice) {
      initialFields.useCaseChoice = useCaseChoice;
    }
    if (boundaryChoices && boundaryChoices.length > 0) {
      initialFields.boundaryChoices = boundaryChoices.join(', ');
    }
    if (fileUsageInstructions && fileUsageInstructions.trim()) {
      initialFields.fileUsageInstructions = fileUsageInstructions.trim();
    }

    // Don't attach files yet - will be done after agent creation
    // Don't set analyzedFileContent - Airtable field agent will populate it automatically
    // Note: voiceChoice will be saved separately after record creation to avoid failures if field doesn't exist

    const airtableRecord = await createUserRecord(initialFields);
    
    // Try to save voiceChoice separately (optional field - don't fail if it doesn't exist)
    if (voiceChoice && voiceChoice.trim()) {
      try {
        await updateUserRecord(airtableRecord.id, { voiceChoice: voiceChoice.trim() });
        console.log('[API DEBUG] createMyKendall saved voiceChoice to Airtable:', voiceChoice);
      } catch (error) {
        // voiceChoice field might not exist in Airtable - that's okay, just log it
        console.warn('[API WARNING] Could not save voiceChoice to Airtable (field may not exist):', voiceChoice);
        console.warn('[API WARNING] Error details:', error instanceof Error ? error.message : error);
        // Don't throw - this is optional, the voice is still being sent to VAPI
      }
    } else {
      console.warn('[API WARNING] createMyKendall received empty/undefined voiceChoice');
    }
    recordId = airtableRecord.id;

    // Populate new fields with default content (examples, instructions, edgeCases)
    try {
      await updateUserRecord(recordId, {
        examples: `Example Responses for Common Questions:

1. When asked "What does [Name] do?":
   - Start with information from "WHO THEY ARE" section
   - List ALL companies and roles from "WORK EXPERIENCE" section
   - Include specific achievements with numbers from "KEY ACHIEVEMENTS"
   - Mention leadership roles from "LEADERSHIP & ACTIVITIES"
   - Example format: "At [Company 1] as [Role], they [achievement with numbers]. At [Company 2], they [achievement]."

2. When asked about education:
   - Only mention exact institution, degree, and year from "EDUCATION" section
   - Do NOT mention other schools not in the file content
   - Example: "They graduated from [University Name] with a [Degree] in [Year]."

3. When asked about work experience:
   - Reference ALL work experiences, not just one
   - Use exact company names, job titles, dates
   - Cite specific achievements with numbers
   - Example: "They worked at [Company 1] as [Title] where they [achievement]. Then at [Company 2] as [Title] where they [achievement]."

4. When asked about skills or achievements:
   - Pull from "KEY ACHIEVEMENTS" section
   - Use exact numbers and percentages
   - Example: "They achieved [specific metric] at [Company], increasing [metric] by [percentage]."`,
        
        instructions: `Data Access Strategy & When to Fetch Information:

**PRIORITY 1: Information Already in Prompt**
You already have access to:
- Owner name, nickname, your name (kendallName)
- Personality traits and tone (demonstrate, don't state)
- Use case context
- Boundaries and rules
- File content (resume, documents) - in "PRIMARY INFORMATION SOURCE" section
- User context - in "ABOUT {{full_name}}" section

**PRIORITY 2: Provided Variables (for outbound calls)**
Use variableValues/metadata when available: message, ownerName, kendallName, recipientName

**PRIORITY 3: Airtable Functions (fetch when needed)**
- get_user_context() → General owner background (if not in prompt)
- get_user_context("examples") → Example responses for common questions
- get_user_context("instructions") → This document - specific instructions
- get_user_context("edgecases") → How to handle unusual situations
- get_user_contacts(name) → Find phone numbers, contact info  
- get_user_documents(query) → Additional documents not in prompt

**WHEN TO FETCH:**
- If asked about owner and info missing from prompt → get_user_context()
- If unsure how to respond → get_user_context("examples")
- If unusual situation → get_user_context("edgecases")
- If need specific instructions → get_user_context("instructions")
- If owner wants to call someone → get_user_contacts(name)
- If asked about documents → get_user_documents(query)

**RULE: Don't fetch if information is already in the prompt above.**

Available Functions for Voice Calls:
- check_if_owner() → Check if caller is owner (inbound calls only, call immediately at start)
- capture_note() → Take messages from callers (requires note_content and caller_phone)
- make_outbound_call() → Make immediate call (owner only, requires phone_number and message)
- schedule_outbound_call() → Schedule future call (owner only, requires phone_number, message, scheduled_time)
- get_user_context(topic) → Fetch owner info, examples, instructions, edgecases
- get_user_contacts(name) → Find contact phone numbers
- get_user_documents(query) → Search uploaded documents

**Note:** get_calendar_events() and get_gmail_messages() are available during voice calls—use them whenever the owner asks for calendar or email help.

**PRIORITY ORDER FOR KNOWLEDGE:**
1. Airtable prompt context (files, user context, owner rules)
2. Variables/metadata passed into the call
3. Your own model knowledge for public/famous topics, general facts, or math

Error Handling:
- If get_user_context() returns "No user context available" → Use information from prompt
- If get_user_contacts() returns "No contacts found" → Ask owner for phone number
- If get_user_documents() returns "No documents found" → Ask owner what to do next
- If function fails → Try again or handle gracefully without exposing system errors

Specific Instructions:

1. Outbound Call Message Delivery:
   - Start by identifying yourself: "Hi [recipientName], it's [kendallName], [ownerName]'s assistant."
   - Read variableValues.message word-for-word.
   - Deliver EXACTLY as written - no improvisation or added resume/work context.
   - After delivering the message, immediately ask for their reply or confirmation for [ownerName].
   - Your job is to deliver the owner's message and capture their response; do NOT offer additional help unless they explicitly ask.
   - Example: If message says "dinner on Friday", say exactly that, then ask "What should I let [ownerName] know?" - don't mention "meeting with Beyond Consulting".

2. Owner Greeting:
   - Always use nickname or full name in greeting
   - Never just say "How can I help you?" without identifying owner
   - Format: "Hi [nickname or full name], how can I assist you?"

3. Personality Trait Expression:
   - NEVER explicitly state traits like "I'm sassy and witty"
   - Demonstrate through behavior, tone, and word choice
   - If asked about personality, deflect naturally
   - Example WRONG: "I'm Jean-Paul, your sassy and witty assistant"
   - Example RIGHT: Just be sassy and witty through natural speech

4. Information Retrieval:
   - If asked about owner and info is missing from file content, use get_user_context() function
   - If still missing, use get_user_context("examples") for example responses
   - Never make up information

5. General Knowledge & Public Questions:
   - Start with Airtable context for anything about [ownerName], their contacts, or uploaded files.
   - If someone asks about famous people, public companies, trends, news, or math, answer immediately using your own knowledge (no need to fetch unless owner-specific context is required).
   - Only decline when it violates an explicit boundary or needs an integration you truly don't have.
   - Keep responses fast—don't say "I can't" just because it isn't in Airtable.`,
        
        edgeCases: `Edge Case Handling:

1. Confused Caller (inbound/non-owner only):
   - Use check_if_owner() and context clues to confirm they aren't the owner or someone you're calling on behalf of the owner.
   - Briefly explain who you are: "I'm [kendallName], [ownerName]'s assistant."
   - If they reached out to Kendall, offer to help with what they need and guide them calmly.
   - Be patient and clear.
   - Skip this flow during outbound owner-requested calls - those should just deliver the owner's message and capture the reply.

2. Angry Caller:
   - Stay calm and professional
   - Acknowledge their frustration: "I understand this is frustrating"
   - Offer to take a message or help resolve issue
   - Don't take it personally

3. Missing Information:
   - First check if info is in the prompt (file content section, user context)
   - If missing, use get_user_context() to fetch additional details
   - If still unavailable, use get_user_context("examples") for guidance
   - If still no info, politely deflect: "I don't have that specific information, but I can help with something else"
   - Don't guess or make up information

4. Questions About Documents:
   - Use get_user_documents() function
   - Search by query term if provided
   - Return max 5 relevant document summaries
   - If no documents found, check if info is in prompt's file content section

5. Caller Asks to Speak to Owner:
   - Take a message using capture_note() function
   - Say: "I'll make sure [ownerName] gets this message"
   - Don't commit owner to calling back unless explicitly instructed

6. Function Errors/Timeouts:
   - If get_user_context() fails → Use information from prompt
   - If get_user_contacts() fails → Ask owner for phone number directly
   - If get_user_documents() fails → Check prompt's file content section
   - Never mention the error to the caller - handle gracefully
   - Continue conversation naturally

7. Owner Asks About Calendar/Emails:
   - Use get_calendar_events() to check availability, add events, or share upcoming commitments while on the call.
   - Use get_gmail_messages() to read, summarize, or draft emails when the owner asks.
   - Confirm the action and next steps before moving on.
   - If a function fails, let them know you'll take a note or follow up another way.

8. Unclear Requests:
   - Ask clarifying questions
   - Use get_user_context("examples") if unsure how to respond
   - Use get_user_context("edgecases") if situation is unusual`,
      });
      console.log('[API] Populated examples, instructions, and edgeCases fields for new user');
    } catch (error) {
      // Fields might not exist yet - that's okay, just log it
      console.warn('[API WARNING] Could not populate examples/instructions/edgeCases fields (fields may not exist in Airtable yet):', error instanceof Error ? error.message : error);
      // Don't throw - this is optional, the agent creation can continue
    }

    // Generate and store threadId for chat functionality
    try {
      const { getOrCreateThreadId } = await import('@/lib/airtable');
      const threadId = await getOrCreateThreadId(recordId);
      console.log('[API] Generated threadId for user:', threadId);
    } catch (error) {
      console.warn('[API WARNING] Failed to generate threadId (non-critical):', error);
      // Don't fail the request - threadId can be generated later
    }

    // Log voice choice received from frontend
    console.log('[API DEBUG] createMyKendall received voiceChoice:', {
      voiceChoice: voiceChoice,
      type: typeof voiceChoice,
      isNewFormat: isNewFormat,
      fullName: fullName,
    });

    // CRITICAL: Validate voice before creating agent - prevent agent creation if voice is invalid
    if (voiceChoice && voiceChoice.trim()) {
      try {
        // Import validation function directly
        const { validateVoiceForVAPI } = await import('../validateVoiceForVAPI/route');
        const validateData = await validateVoiceForVAPI(voiceChoice.trim());
        
        if (!validateData.valid) {
          console.error('[API ERROR] Voice validation failed:', validateData);
          
          // Update Airtable status to error
          if (recordId) {
            await updateUserRecord(recordId, { 
              status: 'error',
            });
          }
          
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid voice selected',
              message: validateData.error || 'The selected voice cannot be used. Please select a different voice.',
              details: validateData.details,
            },
            { status: 400 }
          );
        }
        
        console.log('[API DEBUG] Voice validated successfully:', {
          voiceId: voiceChoice,
          voiceConfig: validateData.voiceConfig,
          voiceName: validateData.voiceName,
        });
      } catch (validationError) {
        console.error('[API ERROR] Voice validation check failed:', validationError);
        
        // If validation endpoint fails, we should still proceed but log warning
        // This prevents blocking agent creation if validation service is down
        console.warn('[API WARNING] Proceeding with agent creation despite validation check failure');
      }
    }

    // Step 2: Create VAPI agent with personalized instructions
    // Note: analyzedFileContent will be populated by Airtable field agent after files are attached
    let agent;
    if (isNewFormat) {
      // Use new template-based system
      agent = await createAgentFromTemplate({
        fullName,
        nickname,
        kendallName: kendallName || 'Kendall',
        mobileNumber: mobileNumber || '',
        selectedTraits: selectedTraits || [],
        useCaseChoice: useCaseChoice || '',
        boundaryChoices: boundaryChoices || [],
        userContextAndRules: userContextAndRules || '',
        forwardCalls: forwardCalls || false,
        voiceChoice: voiceChoice || '',
        analyzedFileContent: '', // Will be populated by Airtable field agent
        fileUsageInstructions: fileUsageInstructions?.trim() || undefined,
      });
    } else {
      // Use old system (backward compatibility)
      // Extract kendallName from body if available, otherwise default to 'Kendall'
      const assistantName = body.kendallName || 'Kendall';
      agent = await createAgent({
        fullName,
        forwardCalls: forwardCalls || false,
        mobileNumber: mobileNumber || '',
        personalityChoices: personalityChoices && Array.isArray(personalityChoices) ? personalityChoices : [],
        personalityText: personalityText || '',
        customizationOptions: customizationOptions || [],
        userContext,
        additionalInstructions: additionalInstructions || '',
        voiceChoice: voiceChoice || '',
        analyzedFileContent: '', // Will be populated by Airtable field agent
        kendallName: assistantName,
      });
    }
    const agentId = agent.id || agent.agentId;

    // Log agent creation response to verify voice was set
    console.log('[API DEBUG] VAPI agent created:', {
      agentId: agentId,
      agentVoice: agent.voice,
      agentVoiceId: agent.voice?.voiceId,
      agentVoiceProvider: agent.voice?.provider,
      fullAgentResponse: JSON.stringify(agent, null, 2).substring(0, 500), // First 500 chars
    });

    if (!agentId) {
      console.error("[VAPI ERROR] No agent ID returned:", agent);
      if (recordId) {
        await updateUserRecord(recordId, { status: "error" });
      }
      return NextResponse.json(
        { success: false, message: "Vapi did not return an agent ID" },
        { status: 500 }
      );
    }

    // Step 3: Purchase and assign Canadian phone number in one call
    // Pass fullName as the label for the phone number in Vapi dashboard
    let phoneData;
    try {
      phoneData = await purchaseNumber(agentId, undefined, fullName); // agentId from createAgent(), fullName as label
      console.log("[VAPI INFO] Final phone number returned:", phoneData);
    } catch (phoneError) {
      console.error("[VAPI ERROR] Failed to purchase Canadian phone number:", phoneError);
      // Update status to error but don't fail the entire request
      if (recordId) {
        await updateUserRecord(recordId, { 
          status: "error",
          vapi_agent_id: agentId, // Still store the agent ID even if phone purchase failed
        });
      }
      // Continue - phone can be provisioned later manually
      phoneData = null;
    }

    // Extract phone number details if purchase was successful
    let phoneNumberValue: string | undefined = undefined;
    let vapiPhoneNumberId: string | undefined = undefined;
    let twilioSid: string | undefined = undefined;
    
    if (phoneData) {
      phoneNumberValue = phoneData.phone;
      vapiPhoneNumberId = phoneData.id;
      twilioSid = phoneData.twilioSid;
      
      // If phone is the fallback message, that means we couldn't extract the actual number
      // Check if it looks like a valid phone number (starts with + or is a number format)
      if (!phoneNumberValue || phoneNumberValue.includes("Number purchased") || phoneNumberValue.includes("check Vapi dashboard")) {
        console.warn("[VAPI WARNING] Actual phone number not found, storing fallback message");
        phoneNumberValue = `Number purchased (ID: ${phoneData.id}) - check Vapi dashboard`;
      } else {
        console.log("[VAPI SUCCESS] Valid Canadian phone number extracted:", phoneNumberValue);
      }
    } else {
      console.warn("[VAPI WARNING] Phone number purchase failed, continuing without phone number");
    }

    // Automatically verify owner's phone number in Twilio (for trial accounts)
    if (mobileNumber && phoneData) {
      try {
        const { verifyOwnerPhoneNumber } = await import('@/lib/vapi');
        const verificationResult = await verifyOwnerPhoneNumber(mobileNumber);
        if (verificationResult.success) {
          console.log('[VAPI INFO] Phone verification initiated for owner:', mobileNumber);
          console.log('[VAPI INFO] Owner will receive a verification call - they need to enter the code');
        } else {
          console.warn('[VAPI WARNING] Could not initiate phone verification:', verificationResult.error);
          // Don't fail agent creation - verification is optional
        }
      } catch (error) {
        console.warn('[VAPI WARNING] Error initiating phone verification:', error);
        // Don't fail agent creation - verification is optional
      }
    }

    if (!recordId) {
      console.error("[AIRTABLE ERROR] No record ID available for update");
      throw new Error("Failed to update Airtable record - no record ID");
    }

    // Step 4: Update Airtable record with agent info and file attachments
    const updateFields: Record<string, any> = {
      vapi_agent_id: agentId,
      status: phoneData ? "active" : "error", // Set to error if phone purchase failed
    };
    
    // Store phone number details if available
    if (phoneNumberValue && vapiPhoneNumberId) {
      // Use the new helper function to store all phone number details
      try {
        await updateCanadianNumberMapping(recordId, phoneNumberValue, vapiPhoneNumberId, twilioSid);
      } catch (mappingError) {
        console.error("[AIRTABLE ERROR] Failed to update Canadian number mapping:", mappingError);
        // Fallback to basic update
        updateFields.vapi_number = phoneNumberValue;
        if (vapiPhoneNumberId) {
          updateFields.vapi_phone_number_id = vapiPhoneNumberId;
        }
        if (twilioSid) {
          updateFields.twilio_phone_sid = twilioSid;
        }
      }
    } else if (phoneNumberValue) {
      // If we have phone number but not ID, store what we have
      updateFields.vapi_number = phoneNumberValue;
    }

    // Attach files AFTER agent creation (as per requirements)
    // This will trigger Airtable field agent to analyze files and populate analyzedFileContent
    if (attachedFileUrls && Array.isArray(attachedFileUrls) && attachedFileUrls.length > 0) {
      updateFields.attachedFiles = formatAttachmentField(attachedFileUrls);
      console.log('[AIRTABLE] Attaching files to record:', attachedFileUrls.length, 'files');
    }

    // Only update if we have fields to update (phone number mapping was already done above if successful)
    if (Object.keys(updateFields).length > 0) {
      await updateUserRecord(recordId, updateFields);
    }
    
    // Try to save voiceChoice separately (optional field - don't fail if it doesn't exist)
    if (voiceChoice && voiceChoice.trim()) {
      try {
        await updateUserRecord(recordId, { voiceChoice: voiceChoice.trim() });
        console.log('[API DEBUG] createMyKendall preserved voiceChoice in final update:', voiceChoice);
      } catch (error) {
        // voiceChoice field might not exist in Airtable - that's okay, just log it
        console.warn('[API WARNING] Could not save voiceChoice to Airtable (field may not exist):', voiceChoice);
        // Don't throw - this is optional, the voice is still being sent to VAPI
      }
    }

    // Step 4.5: Wait for Airtable field agent to analyze files, then update VAPI agent
    if (attachedFileUrls && Array.isArray(attachedFileUrls) && attachedFileUrls.length > 0) {
      console.log('[AIRTABLE] Waiting for field agent to analyze files...');
      
      // Poll Airtable for analyzed content (with retries)
      let analyzedContent = '';
      const maxRetries = 30; // Increased from 10 to 30 (60 seconds total)
      const retryDelay = 2000; // 2 seconds
      
      for (let i = 0; i < maxRetries; i++) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        try {
          const updatedRecord = await getUserRecord(recordId);
          const rawContent = updatedRecord.fields?.analyzedFileContent;
          
          // Convert to string safely, handling all possible types from Airtable
          if (rawContent == null) {
            // null or undefined
            analyzedContent = '';
          } else if (typeof rawContent === 'string') {
            // Already a string (most common case)
            analyzedContent = rawContent;
          } else if (Array.isArray(rawContent)) {
            // Array - join with newlines, handling objects in array
            analyzedContent = rawContent.map(item => {
              if (typeof item === 'string') return item;
              if (typeof item === 'object' && item !== null) {
                // Try to extract text from object properties
                return item.text || item.content || item.value || JSON.stringify(item);
              }
              return String(item);
            }).join('\n');
          } else if (typeof rawContent === 'object') {
            // Object - check if it's a loading state
            console.log('[AIRTABLE DEBUG] Raw content is an object:', JSON.stringify(rawContent).substring(0, 500));
            
            // Check if field agent is still loading
            // Airtable field agents can have states: "loading", "ready", "complete", "error", etc.
            if (rawContent.state === 'loading' || rawContent.state === 'pending' || 
                (rawContent.value === null && rawContent.state !== 'ready' && rawContent.state !== 'complete' && rawContent.state !== 'generated')) {
              console.log('[AIRTABLE DEBUG] Field agent is still loading, state:', rawContent.state, 'value:', rawContent.value ? 'present' : 'null');
              analyzedContent = ''; // Treat as not ready yet
            } else if (rawContent.state === 'ready' || rawContent.state === 'complete' || rawContent.state === 'generated' || rawContent.value != null) {
              // Field agent is done, extract the actual content
              const extractedValue = rawContent.value || rawContent.text || rawContent.content;
              if (typeof extractedValue === 'string') {
                analyzedContent = extractedValue;
                console.log('[AIRTABLE DEBUG] Extracted string content, length:', analyzedContent.length);
              } else if (extractedValue != null) {
                // If value is still an object, try to stringify it
                analyzedContent = JSON.stringify(extractedValue);
                console.log('[AIRTABLE DEBUG] Extracted object content, stringified length:', analyzedContent.length);
              } else {
                analyzedContent = '';
              }
            } else {
              // Unknown state, try to extract anyway
              console.log('[AIRTABLE DEBUG] Unknown state, attempting to extract:', rawContent.state);
              const extractedValue = rawContent.value || rawContent.text || rawContent.content;
              if (typeof extractedValue === 'string') {
                analyzedContent = extractedValue;
              } else if (extractedValue != null) {
                analyzedContent = JSON.stringify(extractedValue);
              } else {
                analyzedContent = '';
              }
            }
          } else {
            // Number, boolean, etc. - convert to string
            analyzedContent = String(rawContent);
          }
          
          // Only proceed if we have actual content (not loading state, not [object Object])
          if (analyzedContent && 
              analyzedContent.trim() && 
              analyzedContent !== '[object Object]' &&
              analyzedContent.length > 20) { // Minimum reasonable length
            console.log('[AIRTABLE] Field agent analyzed files. Updating VAPI agent...');
            console.log('[AIRTABLE DEBUG] Retrieved content length:', analyzedContent.length);
            console.log('[AIRTABLE DEBUG] Content preview (first 500 chars):', analyzedContent.substring(0, 500));
            console.log('[AIRTABLE DEBUG] Content includes WORK EXPERIENCE:', analyzedContent.includes('WORK EXPERIENCE'));
            console.log('[AIRTABLE DEBUG] Content includes WHO THEY ARE:', analyzedContent.includes('WHO THEY ARE'));
            console.log('[AIRTABLE DEBUG] Content includes KEY ACHIEVEMENTS:', analyzedContent.includes('KEY ACHIEVEMENTS'));
            break;
          }
          
          // Still loading or invalid content, continue waiting
          const stateInfo = typeof rawContent === 'object' && rawContent !== null 
            ? `state: ${rawContent.state || 'unknown'}, value: ${rawContent.value ? 'present' : 'null'}`
            : 'unknown';
          console.log(`[AIRTABLE] Waiting for analysis... (attempt ${i + 1}/${maxRetries}) - ${stateInfo}`);
        } catch (fetchError) {
          console.warn(`[AIRTABLE] Error fetching record (attempt ${i + 1}):`, fetchError);
          // Continue retrying
        }
      }
      
      // Update VAPI agent with analyzed content if we got it
      // Ensure analyzedContent is a string before checking trim
      const contentString = typeof analyzedContent === 'string' 
        ? analyzedContent 
        : String(analyzedContent || '');
      
      if (contentString && contentString.trim()) {
        console.log('[VAPI DEBUG] Content being sent to VAPI:');
        console.log('[VAPI DEBUG] - Content length:', contentString.length);
        console.log('[VAPI DEBUG] - First 500 chars:', contentString.substring(0, 500));
        console.log('[VAPI DEBUG] - Includes WHO THEY ARE:', contentString.includes('WHO THEY ARE'));
        console.log('[VAPI DEBUG] - Includes WORK EXPERIENCE:', contentString.includes('WORK EXPERIENCE'));
        console.log('[VAPI DEBUG] - Includes KEY ACHIEVEMENTS:', contentString.includes('KEY ACHIEVEMENTS'));
        console.log('[VAPI DEBUG] - Agent ID:', agentId);
        
        try {
          // Rebuild the same parameters used to create the agent
          if (isNewFormat) {
            await updateAgentFromTemplate({
              agentId,
              fullName,
              nickname,
              kendallName: kendallName || 'Kendall',
              mobileNumber: mobileNumber || '',
              selectedTraits: selectedTraits || [],
              useCaseChoice: useCaseChoice || '',
              boundaryChoices: boundaryChoices || [],
              userContextAndRules: userContextAndRules || '',
              forwardCalls: forwardCalls || false,
              voiceChoice: voiceChoice || '',
              analyzedFileContent: contentString.trim(),
              fileUsageInstructions: fileUsageInstructions?.trim() || undefined,
            });
          } else {
            await updateAgent({
              agentId,
              fullName,
              forwardCalls: forwardCalls || false,
              mobileNumber: mobileNumber || '',
              personalityChoices: personalityChoices && Array.isArray(personalityChoices) ? personalityChoices : [],
              personalityText: personalityText || '',
              customizationOptions: customizationOptions || [],
              userContext,
              additionalInstructions: additionalInstructions || '',
              voiceChoice: voiceChoice || '',
              kendallName: body.kendallName || 'Kendall',
              analyzedFileContent: contentString.trim(),
            });
          }
          console.log('[VAPI] Agent updated with analyzed file content');
          console.log('[VAPI DEBUG] Update completed successfully');
        } catch (updateError) {
          console.error('[VAPI ERROR] Failed to update agent with analyzed content:', updateError);
          console.error('[VAPI ERROR] Update error details:', {
            message: updateError instanceof Error ? updateError.message : String(updateError),
            stack: updateError instanceof Error ? updateError.stack : undefined,
            agentId,
            contentLength: contentString.length,
          });
          // Don't fail the request - agent was created successfully
        }
      } else {
        console.warn('[AIRTABLE] Field agent did not analyze files within timeout. Agent created without file content.');
        console.warn('[AIRTABLE DEBUG] Final analyzedContent value:', analyzedContent);
        console.warn('[AIRTABLE DEBUG] Content string value:', contentString);
        console.warn('[AIRTABLE DEBUG] Content string length:', contentString.length);
      }
    }

    console.log("[VAPI SUCCESS] Assistant + phone number creation complete.");

    // Step 5: Send welcome email with phone number, edit link, and chat link
    // Generate edit link using Airtable record ID
    const editLink = `/personal-setup?edit=${recordId}`;
    const chatLink = `/chat?recordId=${recordId}`;
    
    // Only send email if we have a valid phone number
    if (phoneNumberValue && !phoneNumberValue.includes("Number purchased") && !phoneNumberValue.includes("check Vapi dashboard")) {
      try {
        await sendKendallWelcomeEmail({
          to: email,
          fullName,
          phoneNumber: phoneNumberValue,
          editLink,
          chatLink,
          recordId,
        });
        console.log("[EMAIL SUCCESS] Welcome email sent to:", email);
      } catch (emailError) {
        // Log email error but don't fail the request - phone number creation was successful
        console.error("[EMAIL ERROR] Failed to send welcome email:", emailError);
        // Continue with successful response even if email fails
      }
    } else {
      console.warn("[EMAIL WARNING] Skipping email send - phone number not yet available");
    }

    // Get base URL for links
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';

    return NextResponse.json({
      success: true,
      agentId,
      phoneNumber: phoneData.phone,
      recordId, // Include recordId for potential edit functionality
      editLink: `${baseUrl}/personal-setup?edit=${recordId}`,
      chatLink: `${baseUrl}/chat?recordId=${recordId}`,
    });
  } catch (error) {
    console.error('[ERROR] createMyKendall failed:', error);

    // Update Airtable status to "error" on any failure
    if (recordId) {
      try {
        await updateUserRecord(recordId, { status: 'error' });
      } catch (updateError) {
        console.error('[AIRTABLE ERROR] Failed to update status to error:', updateError);
      }
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create My Kendall' 
      },
      { status: 500 }
    );
  }
}

