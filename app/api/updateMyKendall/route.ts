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

