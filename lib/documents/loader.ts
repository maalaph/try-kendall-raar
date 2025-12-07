/**
 * Document Loader
 * Parse PDF, DOCX, and other document types
 */

export interface LoadedDocument {
  content: string;
  metadata: {
    fileName: string;
    fileType: string;
    pageCount?: number;
    wordCount?: number;
    characterCount?: number;
  };
}

export interface LoaderResult {
  success: boolean;
  document?: LoadedDocument;
  error?: string;
}

/**
 * Extract text content from a file buffer
 */
export async function loadDocument(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<LoaderResult> {
  try {
    const fileType = getFileType(mimeType, fileName);
    let content: string;
    
    switch (fileType) {
      case 'pdf':
        content = await loadPDF(buffer);
        break;
      case 'docx':
        content = await loadDocx(buffer);
        break;
      case 'txt':
        content = buffer.toString('utf-8');
        break;
      default:
        return {
          success: false,
          error: `Unsupported file type: ${fileType}`,
        };
    }
    
    // Clean and normalize content
    content = normalizeContent(content);
    
    return {
      success: true,
      document: {
        content,
        metadata: {
          fileName,
          fileType,
          wordCount: countWords(content),
          characterCount: content.length,
        },
      },
    };
  } catch (error) {
    console.error('[LOADER] Error loading document:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load document',
    };
  }
}

/**
 * Determine file type from MIME type or extension
 */
function getFileType(mimeType: string, fileName: string): string {
  // Check MIME type first
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (mimeType === 'application/msword') return 'doc';
  if (mimeType === 'text/plain') return 'txt';
  
  // Fall back to extension
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'doc') return 'doc';
  if (ext === 'txt') return 'txt';
  
  return 'unknown';
}

/**
 * Load PDF content
 * Uses simple text extraction - for production, consider pdf-parse or similar
 */
async function loadPDF(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import to avoid issues in environments where pdf-parse isn't available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParseModule = await import('pdf-parse') as any;
    const pdfParse = pdfParseModule.default || pdfParseModule;
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    // Fallback: Try basic text extraction
    console.warn('[LOADER] pdf-parse not available, using basic extraction');
    return extractBasicPDFText(buffer);
  }
}

/**
 * Basic PDF text extraction fallback
 * Extracts readable text strings from PDF binary
 */
function extractBasicPDFText(buffer: Buffer): string {
  const str = buffer.toString('latin1');
  const textMatches: string[] = [];
  
  // Look for text between common PDF text markers
  const patterns = [
    /\(([^\)]{2,})\)/g,  // Text in parentheses
    /BT\s*([\s\S]*?)\s*ET/g,  // Text between BT/ET markers (using [\s\S] instead of 's' flag)
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(str)) !== null) {
      const text = match[1];
      // Filter out binary garbage
      if (/^[\x20-\x7E\s]+$/.test(text) && text.length > 2) {
        textMatches.push(text);
      }
    }
  }
  
  return textMatches.join(' ');
}

/**
 * Load DOCX content
 * Uses mammoth or basic extraction
 */
async function loadDocx(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    // Fallback: Try basic XML extraction
    console.warn('[LOADER] mammoth not available, using basic extraction');
    return extractBasicDocxText(buffer);
  }
}

/**
 * Basic DOCX text extraction fallback
 * DOCX files are ZIP archives with XML content
 */
async function extractBasicDocxText(buffer: Buffer): Promise<string> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    
    // Get document.xml which contains the main text
    const documentXml = await zip.file('word/document.xml')?.async('string');
    if (!documentXml) {
      throw new Error('Could not find document.xml in DOCX');
    }
    
    // Extract text from XML (basic approach)
    // Remove XML tags and decode entities
    let text = documentXml
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    
    return text;
  } catch (error) {
    console.error('[LOADER] Basic DOCX extraction failed:', error);
    return '';
  }
}

/**
 * Normalize and clean extracted content
 */
function normalizeContent(content: string): string {
  return content
    // Normalize whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    // Remove excessive whitespace
    .replace(/[ ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    // Remove non-printable characters (except newlines)
    .replace(/[^\x20-\x7E\n]/g, '')
    // Trim
    .trim();
}

/**
 * Count words in content
 */
function countWords(content: string): number {
  return content.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Chunk content into smaller pieces for processing
 */
export function chunkContent(
  content: string,
  maxChunkSize: number = 4000,
  overlap: number = 200
): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < content.length) {
    let end = start + maxChunkSize;
    
    // Try to break at sentence or paragraph boundary
    if (end < content.length) {
      const breakPoints = ['\n\n', '.\n', '. ', '\n', ' '];
      for (const breakPoint of breakPoints) {
        const breakIndex = content.lastIndexOf(breakPoint, end);
        if (breakIndex > start + maxChunkSize / 2) {
          end = breakIndex + breakPoint.length;
          break;
        }
      }
    }
    
    chunks.push(content.slice(start, end).trim());
    start = end - overlap;
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Get summary of document for storage
 */
export function getDocumentSummary(document: LoadedDocument, maxLength: number = 500): string {
  const content = document.content;
  
  if (content.length <= maxLength) {
    return content;
  }
  
  // Try to break at sentence boundary
  const truncated = content.slice(0, maxLength);
  const lastSentence = truncated.lastIndexOf('. ');
  
  if (lastSentence > maxLength / 2) {
    return truncated.slice(0, lastSentence + 1) + '...';
  }
  
  return truncated + '...';
}

