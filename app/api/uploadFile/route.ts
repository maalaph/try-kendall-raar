import { NextRequest, NextResponse } from 'next/server';
import { uploadFileToBlob } from '@/lib/blobStorage';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
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
          error: 'Blob storage not configured',
          details: 'BLOB_READ_WRITE_TOKEN environment variable is missing'
        },
        { status: 500 }
      );
    }

    // Upload to Vercel Blob storage
    console.log(`[BLOB UPLOAD] Uploading file: ${file.name} (${file.type}, ${file.size} bytes)`);
    const uploadedFile = await uploadFileToBlob(file, buffer);

    console.log(`[BLOB UPLOAD] Successfully uploaded file. URL: ${uploadedFile.url}`);

    // Return file info + public URL for Airtable attachment
    return NextResponse.json({
      filename: uploadedFile.filename,
      type: uploadedFile.type,
      size: uploadedFile.size,
      url: uploadedFile.url, // Public URL for Airtable attachment field
    });
  } catch (error) {
    console.error('[FILE UPLOAD ERROR]', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

