/**
 * Vercel Blob Storage utility for file uploads
 */

import { put } from '@vercel/blob';

export interface UploadedFile {
  url: string;
  filename: string;
  size: number;
  type: string;
}

/**
 * Upload a file to Vercel Blob storage
 * @param file - The File object from the request
 * @param buffer - The file buffer
 * @returns Object with public URL and file metadata
 */
export async function uploadFileToBlob(
  file: File,
  buffer: Buffer
): Promise<UploadedFile> {
  try {
    // Check if token is available (for debugging)
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      console.error('[BLOB UPLOAD ERROR] BLOB_READ_WRITE_TOKEN is not set in environment');
      throw new Error('BLOB_READ_WRITE_TOKEN environment variable is not configured');
    }

    // Upload to Vercel Blob
    // The @vercel/blob package automatically uses BLOB_READ_WRITE_TOKEN from env
    // Use addRandomSuffix to handle duplicate filenames
    const blob = await put(file.name, buffer, {
      access: 'public', // Make file publicly accessible (required for Airtable)
      contentType: file.type || 'application/octet-stream',
      addRandomSuffix: true, // Add random suffix to handle duplicate filenames
    });

    return {
      url: blob.url,
      filename: file.name,
      size: file.size,
      type: file.type,
    };
  } catch (error) {
    console.error('[BLOB UPLOAD ERROR]', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      filename: file.name,
      hasToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    });
    throw new Error(
      `Failed to upload file to Blob storage: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

