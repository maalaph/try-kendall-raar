import { NextRequest, NextResponse } from 'next/server';
import { uploadFileToBlob } from '@/lib/blobStorage';
import { getUserRecord, getOrCreateThreadId, createChatMessage } from '@/lib/airtable';
import { createUserDocument, updateDocumentSummary } from '@/lib/userDocuments';
import OpenAI from 'openai';

/**
 * POST /api/chat/upload-document
 * Upload a document and store it as a chat message
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const recordId = formData.get('recordId') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: 'recordId is required' },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Get user record
    const userRecord = await getUserRecord(recordId);
    if (!userRecord || !userRecord.fields) {
      return NextResponse.json(
        { success: false, error: 'User record not found' },
        { status: 404 }
      );
    }

    const agentId = userRecord.fields.vapi_agent_id;
    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'Agent not found for this user' },
        { status: 404 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Check if BLOB_READ_WRITE_TOKEN is available
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('[BLOB UPLOAD ERROR] BLOB_READ_WRITE_TOKEN is not set');
      return NextResponse.json(
        { 
          success: false,
          error: 'Blob storage not configured',
          details: 'BLOB_READ_WRITE_TOKEN environment variable is missing'
        },
        { status: 500 }
      );
    }

    // Upload to Vercel Blob storage
    console.log(`[CHAT DOCUMENT UPLOAD] Uploading file: ${file.name} (${file.type}, ${file.size} bytes)`);
    const uploadedFile = await uploadFileToBlob(file, buffer);

    console.log(`[CHAT DOCUMENT UPLOAD] Successfully uploaded file. URL: ${uploadedFile.url}`);

    // Get threadId from form data or create new one
    const providedThreadId = formData.get('threadId') as string | null;
    let threadId: string;
    if (providedThreadId) {
      threadId = providedThreadId;
    } else {
      threadId = await getOrCreateThreadId(recordId);
    }

    // Create chat message with the uploaded document
    const chatMessage = await createChatMessage({
      recordId,
      agentId: String(agentId),
      threadId,
      message: `Uploaded file: ${file.name}`,
      role: 'user',
      attachments: [{
        url: uploadedFile.url,
        filename: uploadedFile.filename,
      }],
    });

    // Determine file type
    const getFileType = (fileName: string, mimeType: string): string => {
      const name = fileName.toLowerCase();
      if (name.includes('resume') || name.includes('cv')) return 'resume';
      if (name.includes('menu')) return 'menu';
      if (name.includes('invoice') || name.includes('bill')) return 'invoice';
      if (mimeType.startsWith('image/')) return 'image';
      return 'document';
    };

    const fileType = getFileType(file.name, file.type);

    // Analyze file if it's an image or document
    let analysisResult: string | null = null;
    const isImage = file.type.startsWith('image/');
    
    if (isImage && process.env.OPENAI_API_KEY) {
      try {
        // Use OpenAI Vision API for image analysis
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        // Convert buffer to base64
        const base64 = buffer.toString('base64');
        
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analyze this image and extract all important information. Include text (OCR), objects, people, context, and any actionable information. Format clearly.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${file.type};base64,${base64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 1000,
        });

        analysisResult = response.choices[0]?.message?.content || null;
      } catch (error) {
        console.error('[FILE ANALYSIS] Image analysis failed:', error);
        // Continue without analysis
      }
    }

    // Store document in User Documents table (NEW - replaces storing in Users table)
    try {
      const documentRecord = await createUserDocument({
        userId: recordId,
        file: [{
          url: uploadedFile.url,
          filename: uploadedFile.filename,
        }],
        fileType,
        fileName: file.name,
        originalText: analysisResult || undefined,
        summary: analysisResult ? analysisResult.substring(0, 500) : undefined, // Truncate summary
        uploadSource: 'chat',
      });

      // If we got analysis later, update the summary
      if (analysisResult && documentRecord.id) {
        await updateDocumentSummary(documentRecord.id, analysisResult.substring(0, 500), analysisResult);
      }

      console.log(`[USER DOCUMENTS] Created document record: ${documentRecord.id}`);
    } catch (error) {
      console.error('[USER DOCUMENTS] Failed to create document record:', error);
      // Continue - document is still in chat, just not in User Documents table
    }

    // Send automated assistant response about the file
    const kendallName = userRecord.fields.kendallName || 'Kendall';
    let assistantResponse = `Got it! I've saved "${file.name}".`;
    
    if (analysisResult) {
      assistantResponse += `\n\n## Image Analysis\n\n${analysisResult}\n\nWhat would you like to do with this information?`;
    } else {
      assistantResponse += ` You can ask me questions about it or have me analyze it. What would you like to know?`;
    }
    
    // Create assistant message about the upload
    await createChatMessage({
      recordId,
      agentId: String(agentId),
      threadId,
      message: assistantResponse,
      role: 'assistant',
    });

    return NextResponse.json({
      success: true,
      file: {
        filename: uploadedFile.filename,
        type: uploadedFile.type,
        size: uploadedFile.size,
        url: uploadedFile.url,
      },
      message: chatMessage,
    });
  } catch (error) {
    console.error('[API ERROR] POST /api/chat/upload-document failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to upload document',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

