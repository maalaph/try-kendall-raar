import { createUserRecord, updateUserRecord, getUserRecord, formatAttachmentField } from '@/lib/airtable';
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

        const validateData = await validateResponse.json();
        
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

    // Step 3: Purchase and assign US phone number in one call
    // Pass fullName as the label for the phone number in Vapi dashboard
    const phoneData = await purchaseNumber(agentId, undefined, fullName); // agentId from createAgent(), fullName as label

    console.log("[VAPI INFO] Final phone number returned:", phoneData);

    // Extract phone number - check if it's a valid phone number or fallback message
    let phoneNumberValue = phoneData.phone;
    
    // If phone is the fallback message, that means we couldn't extract the actual number
    // Check if it looks like a valid phone number (starts with + or is a number format)
    if (!phoneNumberValue || phoneNumberValue.includes("Number purchased") || phoneNumberValue.includes("check Vapi dashboard")) {
      console.warn("[VAPI WARNING] Actual phone number not found, storing fallback message");
      phoneNumberValue = `Number purchased (ID: ${phoneData.id}) - check Vapi dashboard`;
    } else {
      console.log("[VAPI SUCCESS] Valid phone number extracted:", phoneNumberValue);
    }

    if (!recordId) {
      console.error("[AIRTABLE ERROR] No record ID available for update");
      throw new Error("Failed to update Airtable record - no record ID");
    }

    // Step 4: Update Airtable record with agent info and file attachments
    const updateFields: Record<string, any> = {
      vapi_agent_id: agentId,
      vapi_number: phoneNumberValue,    // Store phone number or fallback message
      status: "active",
    };

    // Attach files AFTER agent creation (as per requirements)
    // This will trigger Airtable field agent to analyze files and populate analyzedFileContent
    if (attachedFileUrls && Array.isArray(attachedFileUrls) && attachedFileUrls.length > 0) {
      updateFields.attachedFiles = formatAttachmentField(attachedFileUrls);
      console.log('[AIRTABLE] Attaching files to record:', attachedFileUrls.length, 'files');
    }

    await updateUserRecord(recordId, updateFields);
    
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

    // Step 5: Send welcome email with phone number and edit link
    // Generate edit link using Airtable record ID
    const editLink = `/personal-setup?edit=${recordId}`;
    
    // Only send email if we have a valid phone number
    if (phoneNumberValue && !phoneNumberValue.includes("Number purchased") && !phoneNumberValue.includes("check Vapi dashboard")) {
      try {
        await sendKendallWelcomeEmail({
          to: email,
          fullName,
          phoneNumber: phoneNumberValue,
          editLink,
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

    return NextResponse.json({
      success: true,
      agentId,
      phoneNumber: phoneData.phone,
      recordId, // Include recordId for potential edit functionality
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

