import { updateUserRecord, getUserRecord } from '@/lib/airtable';
import { updateAgent, updateAgentFromTemplate, reassignPhoneNumber } from '@/lib/vapi';
import { parseUserContext } from '@/lib/promptBlocks';
import { rateLimit, getClientIP } from '@/lib/rateLimit';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(request: NextRequest) {
  // Rate limiting: 20 requests per 15 minutes per IP (increased for setup flow)
  const clientIP = getClientIP(request);
  const rateLimitResult = rateLimit(clientIP, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 20, // Increased to allow for setup flow with multiple saves
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
        attachedFileUrls, fileUsageInstructions;
    
    recordId = body.recordId;

    // Log voice choice received from frontend
    console.log('[API DEBUG] updateMyKendall received voiceChoice:', {
      voiceChoice: body.voiceChoice,
      type: typeof body.voiceChoice,
      isNewFormat: isNewFormat,
      recordId: recordId,
    });

    // Validate required fields
    if (!recordId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'recordId is required for updates' 
        },
        { status: 400 }
      );
    }

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
        attachedFileUrls,
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
        fileUsageInstructions,
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

    // Get existing record to retrieve agent ID and phone number
    const existingRecord = await getUserRecord(recordId);
    const existingFields = existingRecord.fields;
    const existingAgentId = existingFields.vapi_agent_id;
    const existingPhoneNumber = existingFields.vapi_number;

    if (!existingAgentId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No existing agent ID found. Cannot update.' 
        },
        { status: 400 }
      );
    }

    // Prepare attachment field - Airtable expects array of objects with url property
    const attachmentArray = (isNewFormat ? attachedFileUrls : attachedFiles) && (isNewFormat ? attachedFileUrls : attachedFiles).length > 0
      ? (isNewFormat ? attachedFileUrls : attachedFiles).map((file: { url: string }) => ({ url: file.url }))
      : [];

    // Step 1: Update Airtable record
    const updateFields: Record<string, any> = {
      fullName,
      email,
      mobileNumber,
      forwardCalls: forwardCalls ? 'Y' : 'N',
      personalityChoices: personalityChoices && Array.isArray(personalityChoices) 
        ? personalityChoices.join(', ') 
        : '',
      personality: personalityText || '',
      customizationOptions: customizationOptions && customizationOptions.length > 0 
        ? customizationOptions.join(', ') 
        : '',
      userContext: userContext || (isNewFormat ? parseUserContext(userContextAndRules).userContext : ''),
      additionalInstructions: additionalInstructions || (isNewFormat ? parseUserContext(userContextAndRules).additionalInstructions : ''),
      status: 'active', // Keep as active
    };

    // Add new format fields if present
    if (isNewFormat && kendallName) {
      updateFields.kendallName = kendallName;
    }
    if (nickname) {
      updateFields.nickname = nickname;
    }
    if (useCaseChoice) {
      updateFields.useCaseChoice = useCaseChoice;
    }
    if (boundaryChoices && boundaryChoices.length > 0) {
      updateFields.boundaryChoices = boundaryChoices.join(', ');
    }
    if (fileUsageInstructions && fileUsageInstructions.trim()) {
      updateFields.fileUsageInstructions = fileUsageInstructions.trim();
    }
    
    // Only add attachedFiles if there are files
    if (attachmentArray.length > 0) {
      updateFields.attachedFiles = attachmentArray;
    }

    // Step 1a: Update Airtable record (without voiceChoice first to avoid failures)
    await updateUserRecord(recordId, updateFields);

    // Step 1b: Try to save voiceChoice separately (optional field - don't fail if it doesn't exist)
    if (voiceChoice && voiceChoice.trim()) {
      try {
        await updateUserRecord(recordId, { voiceChoice: voiceChoice.trim() });
        console.log('[API DEBUG] updateMyKendall saved voiceChoice to Airtable:', voiceChoice);
      } catch (error) {
        // voiceChoice field might not exist in Airtable - that's okay, just log it
        console.warn('[API WARNING] Could not save voiceChoice to Airtable (field may not exist):', voiceChoice);
        console.warn('[API WARNING] Error details:', error instanceof Error ? error.message : error);
        // Don't throw - this is optional, the voice is still being sent to VAPI
      }
    } else {
      console.warn('[API WARNING] updateMyKendall received empty/undefined voiceChoice');
    }

    // Step 1c: Populate new fields with default content if they're empty (examples, instructions, edgeCases)
    try {
      const currentRecord = await getUserRecord(recordId);
      const currentFields = currentRecord.fields || {};
      
      // Only populate if fields are empty or missing
      const fieldsToPopulate: Record<string, string> = {};
      
      if (!currentFields.examples || !currentFields.examples.trim()) {
        fieldsToPopulate.examples = `Example Responses for Common Questions:

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
   - Example: "They achieved [specific metric] at [Company], increasing [metric] by [percentage]."`;
      }
      
      if (!currentFields.instructions || !currentFields.instructions.trim()) {
        fieldsToPopulate.instructions = `Data Access Strategy & When to Fetch Information:

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

**Note:** get_calendar_events() and get_gmail_messages() are NOT available in voice calls - only in chat.

Error Handling:
- If get_user_context() returns "No user context available" → Use information from prompt
- If get_user_contacts() returns "No contacts found" → Ask owner for phone number
- If functions timeout or fail → Continue conversation naturally, don't mention the error
- If information is missing → Use get_user_context("examples") for guidance
- If function returns error message → Don't repeat it verbatim, handle gracefully

Specific Instructions:

1. Outbound Call Message Delivery:
   - Read variableValues.message word-for-word
   - Deliver EXACTLY as written, no interpretation
   - Don't add context from resume or work experience
   - Example: If message says "dinner on Friday", say exactly that - don't mention "meeting with Beyond Consulting"

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
   - Never make up information`;
      }
      
      if (!currentFields.edgeCases || !currentFields.edgeCases.trim()) {
        fieldsToPopulate.edgeCases = `Edge Case Handling:

1. Confused Caller:
   - Briefly explain who you are: "I'm [kendallName], [ownerName]'s assistant"
   - Offer to help with what they need
   - Be patient and clear

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
   - Explain: "I can help with your calendar and emails in chat, but not during voice calls"
   - Offer to take a note or help with something else

8. Unclear Requests:
   - Ask clarifying questions
   - Use get_user_context("examples") if unsure how to respond
   - Use get_user_context("edgecases") if situation is unusual`;
      }
      
      // Only update if there are fields to populate
      if (Object.keys(fieldsToPopulate).length > 0) {
        await updateUserRecord(recordId, fieldsToPopulate);
        console.log('[API] Populated empty examples/instructions/edgeCases fields during update:', Object.keys(fieldsToPopulate));
      }
    } catch (error) {
      // Fields might not exist yet - that's okay, just log it
      console.warn('[API WARNING] Could not populate examples/instructions/edgeCases fields during update (fields may not exist in Airtable yet):', error instanceof Error ? error.message : error);
      // Don't throw - this is optional, the update can continue
    }

    // Step 2: Update VAPI agent with new personalized instructions
    // Log voiceChoice before sending to VAPI
    console.log('[API DEBUG] updateMyKendall sending voiceChoice to VAPI:', {
      voiceChoice: voiceChoice,
      trimmed: voiceChoice ? voiceChoice.trim() : '',
      agentId: existingAgentId,
    });
    
    if (isNewFormat) {
      // Use new template-based system
      await updateAgentFromTemplate({
        agentId: existingAgentId,
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
        analyzedFileContent: '', // Will be populated by Airtable field agent if files are attached
        fileUsageInstructions: fileUsageInstructions?.trim() || undefined,
      });
    } else {
      // Use old system (backward compatibility)
      await updateAgent({
        agentId: existingAgentId, // Pass the existing agent ID
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
      });
    }
    
    // Log after update to verify voice was set
    console.log('[API DEBUG] updateMyKendall completed - voiceChoice was:', voiceChoice);

    // Step 2.5: Wait for Airtable field agent to analyze files, then update VAPI agent (if files were attached)
    if (isNewFormat && attachedFileUrls && Array.isArray(attachedFileUrls) && attachedFileUrls.length > 0) {
      console.log('[AIRTABLE] Waiting for field agent to analyze files...');
      
      // Poll Airtable for analyzed content (with retries)
      let analyzedContent = '';
      const maxRetries = 30; // 60 seconds total
      const retryDelay = 2000; // 2 seconds
      
      for (let i = 0; i < maxRetries; i++) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        try {
          const updatedRecord = await getUserRecord(recordId);
          const rawContent = updatedRecord.fields?.analyzedFileContent;
          
          // Convert to string safely, handling all possible types from Airtable
          if (rawContent == null) {
            analyzedContent = '';
          } else if (typeof rawContent === 'string') {
            analyzedContent = rawContent;
          } else if (Array.isArray(rawContent)) {
            analyzedContent = rawContent.map(item => {
              if (typeof item === 'string') return item;
              if (typeof item === 'object' && item !== null) {
                return item.text || item.content || item.value || JSON.stringify(item);
              }
              return String(item);
            }).join('\n');
          } else if (typeof rawContent === 'object') {
            if (rawContent.state === 'loading' || rawContent.state === 'pending' || 
                (rawContent.value === null && rawContent.state !== 'ready' && rawContent.state !== 'complete' && rawContent.state !== 'generated')) {
              analyzedContent = '';
            } else if (rawContent.state === 'ready' || rawContent.state === 'complete' || rawContent.state === 'generated' || rawContent.value != null) {
              const extractedValue = rawContent.value || rawContent.text || rawContent.content;
              if (typeof extractedValue === 'string') {
                analyzedContent = extractedValue;
              } else if (extractedValue != null) {
                analyzedContent = JSON.stringify(extractedValue);
              } else {
                analyzedContent = '';
              }
            } else {
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
            analyzedContent = String(rawContent);
          }
          
          // Only proceed if we have actual content
          if (analyzedContent && 
              analyzedContent.trim() && 
              analyzedContent !== '[object Object]' &&
              analyzedContent.length > 20) {
            console.log('[AIRTABLE] Field agent analyzed files. Updating VAPI agent...');
            break;
          }
          
          const stateInfo = typeof rawContent === 'object' && rawContent !== null 
            ? `state: ${rawContent.state || 'unknown'}, value: ${rawContent.value ? 'present' : 'null'}`
            : 'unknown';
          console.log(`[AIRTABLE] Waiting for analysis... (attempt ${i + 1}/${maxRetries}) - ${stateInfo}`);
        } catch (fetchError) {
          console.warn(`[AIRTABLE] Error fetching record (attempt ${i + 1}):`, fetchError);
        }
      }
      
      // Update VAPI agent with analyzed content if we got it
      const contentString = typeof analyzedContent === 'string' 
        ? analyzedContent 
        : String(analyzedContent || '');
      
      if (contentString && contentString.trim()) {
        try {
          console.log('[API DEBUG] updateMyKendall second update (after file analysis) - voiceChoice:', voiceChoice);
          await updateAgentFromTemplate({
            agentId: existingAgentId,
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
          console.log('[VAPI] Agent updated with analyzed file content');
        } catch (updateError) {
          console.error('[VAPI ERROR] Failed to update agent with analyzed content:', updateError);
          // Don't fail the request - agent was updated successfully
        }
      } else {
        console.warn('[AIRTABLE] Field agent did not analyze files within timeout. Agent updated without file content.');
      }
    }
    
    // Step 3: Reassign phone number to the updated agent (ensures it stays connected)
    if (existingPhoneNumber) {
      try {
        await reassignPhoneNumber(existingPhoneNumber, existingAgentId);
        console.log("[VAPI SUCCESS] Phone number reassigned to updated agent");
      } catch (error) {
        console.error("[VAPI WARNING] Failed to reassign phone number:", error);
        // Don't fail the whole update if phone reassignment fails - user can fix manually in dashboard
      }
    }
    
    // No need to check for new agent ID - we're updating the existing one
    console.log("[VAPI SUCCESS] My Kendall updated successfully.");

    return NextResponse.json({
      success: true,
      agentId: existingAgentId, // Return the same agent ID
      phoneNumber: existingPhoneNumber, // Return existing phone number (not purchasing new one)
      recordId,
    });
  } catch (error) {
    console.error('[ERROR] updateMyKendall failed:', error);

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
        error: error instanceof Error ? error.message : 'Failed to update My Kendall' 
      },
      { status: 500 }
    );
  }
}

