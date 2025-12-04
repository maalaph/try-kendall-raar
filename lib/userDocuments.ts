/**
 * User Documents Management
 * Stores and retrieves user documents in separate table for scalability
 * This replaces storing documents in the Users table (analyzedFileContent, attachedFiles)
 */

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const USER_DOCUMENTS_TABLE_ID = process.env.AIRTABLE_USER_DOCUMENTS_TABLE_ID;

const USER_DOCUMENTS_API_URL = AIRTABLE_BASE_ID && USER_DOCUMENTS_TABLE_ID
  ? `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${USER_DOCUMENTS_TABLE_ID}`
  : '';

const getHeaders = () => ({
  'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json',
});

export interface UserDocument {
  id?: string;
  userId: string; // Link to Users table (single link, not array)
  file: Array<{ url: string; filename: string }>; // Airtable attachment format
  fileType?: string; // resume, cv, menu, invoice, document, image, other
  fileName: string;
  originalText?: string; // Extracted text (optional, for OCR)
  summary?: string; // LLM-generated summary
  embeddings?: string; // JSON string (optional, for future semantic search)
  uploadSource?: string; // chat, email, website, manual
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Create a new document record
 */
export async function createUserDocument(document: UserDocument): Promise<UserDocument> {
  try {
    if (!USER_DOCUMENTS_API_URL) {
      console.warn('[USER DOCUMENTS] USER_DOCUMENTS_TABLE_ID not configured. Document will not be saved.');
      return document;
    }

    const fields: Record<string, any> = {
      userId: [document.userId], // Link field expects array
      file: document.file, // Airtable attachment format
      fileName: document.fileName,
      updatedAt: new Date().toISOString(),
    };

    if (document.fileType) fields.fileType = document.fileType;
    if (document.originalText) fields.originalText = document.originalText;
    if (document.summary) fields.summary = document.summary;
    if (document.embeddings) fields.embeddings = document.embeddings;
    if (document.uploadSource) fields.uploadSource = document.uploadSource;

    // Create new document record
    fields.createdAt = new Date().toISOString();

    const response = await fetch(USER_DOCUMENTS_API_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Failed to create document: ${response.status}`);
    }

    const result = await response.json();
    return parseDocumentFromRecord(result);
  } catch (error) {
    console.error('[USER DOCUMENTS] Failed to create document:', error);
    throw error;
  }
}

/**
 * Get documents for a user (with optional query and fileType filter)
 * Returns max 5 documents (for voice-first performance)
 */
export async function getUserDocuments(
  userId: string,
  query?: string,
  fileType?: string,
  limit: number = 5
): Promise<UserDocument[]> {
  try {
    if (!USER_DOCUMENTS_API_URL) return [];

    // Build filter formula
    let filterFormula = `{userId} = "${userId}"`;
    
    if (fileType) {
      filterFormula += ` AND {fileType} = "${fileType}"`;
    }

    // Note: Query filtering by content would require semantic search or full-text search
    // For now, we'll filter by fileName if query is provided (simple keyword matching)
    if (query && query.trim()) {
      filterFormula += ` AND FIND(LOWER("${query.toLowerCase()}"), LOWER({fileName})) > 0`;
    }

    const url = `${USER_DOCUMENTS_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=createdAt&sort[0][direction]=desc&maxRecords=${limit}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      console.error('[USER DOCUMENTS] Failed to get documents:', response.status);
      return [];
    }

    const result = await response.json();
    return (result.records || []).map(parseDocumentFromRecord);
  } catch (error) {
    console.error('[USER DOCUMENTS] Failed to get documents:', error);
    return [];
  }
}

/**
 * Get document summaries formatted for voice agent
 * Returns max 5 summaries as numbered bullets
 */
export async function getDocumentSummaries(
  userId: string,
  query?: string,
  limit: number = 5
): Promise<string> {
  try {
    const documents = await getUserDocuments(userId, query, undefined, limit);

    if (documents.length === 0) {
      return 'No documents found.';
    }

    // Format as numbered bullets (max 5)
    const summaries = documents
      .filter(doc => doc.summary && doc.summary.trim())
      .slice(0, limit)
      .map((doc, index) => {
        const fileName = doc.fileName || 'Document';
        const summary = doc.summary || 'No summary available';
        // Truncate summary to 200 chars for voice-first
        const truncatedSummary = summary.length > 200 
          ? summary.substring(0, 200) + '...' 
          : summary;
        return `${index + 1}. ${fileName}: ${truncatedSummary}`;
      });

    if (summaries.length === 0) {
      return 'No document summaries available.';
    }

    return summaries.join(' ');
  } catch (error) {
    console.error('[USER DOCUMENTS] Failed to get document summaries:', error);
    return 'No documents found.';
  }
}

/**
 * Update document summary
 */
export async function updateDocumentSummary(
  documentId: string,
  summary: string,
  originalText?: string
): Promise<void> {
  try {
    if (!USER_DOCUMENTS_API_URL) return;

    const fields: Record<string, any> = {
      summary,
      updatedAt: new Date().toISOString(),
    };

    if (originalText) {
      fields.originalText = originalText;
    }

    const url = `${USER_DOCUMENTS_API_URL}/${documentId}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      console.error('[USER DOCUMENTS] Failed to update document summary:', response.status);
    }
  } catch (error) {
    console.error('[USER DOCUMENTS] Failed to update document summary:', error);
  }
}

/**
 * Helper: Parse document from Airtable record
 */
function parseDocumentFromRecord(record: any): UserDocument {
  return {
    id: record.id,
    userId: Array.isArray(record.fields?.userId) 
      ? record.fields.userId[0] 
      : record.fields?.userId || '',
    file: Array.isArray(record.fields?.file) 
      ? record.fields.file.map((f: any) => ({
          url: f.url,
          filename: f.filename,
        }))
      : [],
    fileType: record.fields?.fileType,
    fileName: record.fields?.fileName || '',
    originalText: record.fields?.originalText,
    summary: record.fields?.summary,
    embeddings: record.fields?.embeddings,
    uploadSource: record.fields?.uploadSource,
    createdAt: record.fields?.createdAt,
    updatedAt: record.fields?.updatedAt,
  };
}




