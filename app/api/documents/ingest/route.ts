/**
 * Document Ingest API Endpoint
 * Upload and process documents for AI analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { loadDocument, getDocumentSummary } from '@/lib/documents/loader';
import { extractProfileData, generateProfileSummary } from '@/lib/documents/extractor';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for document processing

/**
 * POST /api/documents/ingest
 * Upload and process a document
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;
    const documentType = (formData.get('documentType') as string) || 'general';
    const extractProfile = formData.get('extractProfile') !== 'false';
    
    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { error: 'file is required' },
        { status: 400 }
      );
    }
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }
    
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }
    
    // Get file info
    const fileName = file.name;
    const mimeType = file.type;
    const fileSize = file.size;
    
    console.log('[DOCUMENT] Processing upload:', {
      fileName,
      mimeType,
      fileSize,
      userId,
      documentType,
    });
    
    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Load and parse document
    const loadResult = await loadDocument(buffer, fileName, mimeType);
    
    if (!loadResult.success || !loadResult.document) {
      return NextResponse.json(
        { error: loadResult.error || 'Failed to load document' },
        { status: 400 }
      );
    }
    
    const { content, metadata } = loadResult.document;
    
    // Generate summary
    const summary = getDocumentSummary(loadResult.document);
    
    // Create document record
    const { data: docRecord, error: insertError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        file_name: fileName,
        file_type: metadata.fileType,
        file_size: fileSize,
        content,
        summary,
        status: 'processing',
        metadata: {
          wordCount: metadata.wordCount,
          characterCount: metadata.characterCount,
          originalMimeType: mimeType,
          documentType,
        },
      })
      .select('*')
      .single();
    
    if (insertError) {
      console.error('[DOCUMENT] Failed to create record:', insertError);
      return NextResponse.json(
        { error: 'Failed to save document' },
        { status: 500 }
      );
    }
    
    // Extract profile data if requested
    let extractedData = null;
    let profileSummary = null;
    
    if (extractProfile) {
      try {
        const extractResult = await extractProfileData(
          content,
          documentType as 'resume' | 'profile' | 'general'
        );
        
        if (extractResult.success && extractResult.profile) {
          extractedData = extractResult.profile;
          profileSummary = generateProfileSummary(extractResult.profile);
          
          // Update document with extracted data
          await supabase
            .from('documents')
            .update({
              extracted_data: extractedData,
              status: 'completed',
              processed_at: new Date().toISOString(),
            })
            .eq('id', docRecord.id);
          
          // Update user profile_data
          await supabase
            .from('users')
            .update({
              profile_data: extractedData,
              extracted_skills: extractedData.skills || [],
              industry: extractedData.industry,
              updated_at: new Date().toISOString(),
            })
            .eq('record_id', userId);
          
          console.log('[DOCUMENT] Profile data extracted and saved:', {
            userId,
            skillsCount: extractedData.skills?.length || 0,
            industry: extractedData.industry,
          });
        }
      } catch (extractError) {
        console.error('[DOCUMENT] Profile extraction failed:', extractError);
        // Mark as completed even if extraction failed
        await supabase
          .from('documents')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            metadata: {
              ...docRecord.metadata,
              extractionError: extractError instanceof Error ? extractError.message : 'Extraction failed',
            },
          })
          .eq('id', docRecord.id);
      }
    } else {
      // Mark as completed without extraction
      await supabase
        .from('documents')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', docRecord.id);
    }
    
    return NextResponse.json({
      success: true,
      document: {
        id: docRecord.id,
        fileName,
        fileType: metadata.fileType,
        wordCount: metadata.wordCount,
        summary,
        status: 'completed',
      },
      profile: extractedData ? {
        ...extractedData,
        summary: profileSummary,
      } : null,
    });
  } catch (error) {
    console.error('[API] POST /api/documents/ingest error:', error);
    return NextResponse.json(
      { error: 'Failed to process document', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents/ingest
 * Get user's documents
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const documentId = searchParams.get('id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    if (!userId && !documentId) {
      return NextResponse.json(
        { error: 'userId or id is required' },
        { status: 400 }
      );
    }
    
    // Get single document
    if (documentId) {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();
      
      if (error || !data) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        document: {
          id: data.id,
          fileName: data.file_name,
          fileType: data.file_type,
          fileSize: data.file_size,
          summary: data.summary,
          extractedData: data.extracted_data,
          status: data.status,
          createdAt: data.created_at,
          processedAt: data.processed_at,
        },
      });
    }
    
    // Get user's documents
    let query = supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return NextResponse.json({
      documents: (data || []).map(doc => ({
        id: doc.id,
        fileName: doc.file_name,
        fileType: doc.file_type,
        fileSize: doc.file_size,
        summary: doc.summary,
        status: doc.status,
        createdAt: doc.created_at,
        processedAt: doc.processed_at,
      })),
    });
  } catch (error) {
    console.error('[API] GET /api/documents/ingest error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/ingest
 * Delete a document
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('id');
    const userId = searchParams.get('userId');
    
    if (!documentId) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }
    
    // Build delete query
    let query = supabase
      .from('documents')
      .delete()
      .eq('id', documentId);
    
    // If userId provided, ensure user owns document
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { error } = await query;
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] DELETE /api/documents/ingest error:', error);
    return NextResponse.json(
      { error: 'Failed to delete document', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}



