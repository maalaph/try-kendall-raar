/**
 * File analysis using OpenAI
 * Extracts and analyzes content from uploaded files (PDFs, DOCX, images, etc.)
 * 
 * @deprecated This file is no longer used. File analysis is now handled by Airtable's field agent.
 * Files are uploaded to Vercel Blob storage and attached to Airtable records.
 * Airtable's field agent automatically analyzes files and populates the analyzedFileContent field.
 */

// Note: pdf-parse and mammoth will be dynamically imported when needed

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn('[FILE ANALYSIS] OPENAI_API_KEY not set. File analysis will be disabled.');
}

interface AnalyzeFileResult {
  success: boolean;
  analyzedContent?: string;
  error?: string;
}

/**
 * Analyze a file using OpenAI's vision/assistant API
 * Supports: PDFs, DOCX, images, text files
 */
export async function analyzeFile(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<AnalyzeFileResult> {
  if (!OPENAI_API_KEY) {
    return {
      success: false,
      error: 'OpenAI API key not configured',
    };
  }

  try {
    // Convert buffer to base64 for OpenAI API
    const base64 = fileBuffer.toString('base64');

    // Determine if it's an image or document
    const isImage = mimeType.startsWith('image/');
    const isPDF = mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');
    const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                   filename.toLowerCase().endsWith('.docx');
    const isText = mimeType.startsWith('text/') || 
                   filename.toLowerCase().endsWith('.txt') ||
                   filename.toLowerCase().endsWith('.md');

    let analyzedContent = '';

    if (isImage) {
      // Use vision API for images
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Extract ALL important information from this image/document. Include:
- Exact company names and organization names
- Specific job titles and roles
- Quantifiable achievements (numbers, percentages, metrics)
- Detailed bullet points and responsibilities
- Specific projects, technologies, and skills mentioned
- Dates, locations, and other concrete details

Format as a comprehensive, detailed summary that preserves all specific information. Include all bullet points, achievements, and quantifiable results. Do not summarize or generalize - include the actual details.`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      analyzedContent = data.choices[0]?.message?.content || '';
    } else if (isPDF || isDocx || isText) {
      // For PDFs, DOCX, and text files - extract text first, then analyze
      let textContent = '';
      
      if (isText) {
        // For text files, just read the buffer
        textContent = fileBuffer.toString('utf-8');
      } else if (isPDF) {
        // For PDFs, extract text using pdfjs-dist v3.x legacy build (no workers needed)
        console.log('[FILE ANALYSIS] Extracting text from PDF...');
        try {
          // Dynamically import pdfjs-dist v3.x (standard build)
          const pdfjsLib = await import('pdfjs-dist');
          const { createRequire } = await import('module');
          
          // Configure worker for server-side usage
          // Use createRequire to get require in ES module context
          const require = createRequire(import.meta.url);
          const pdfjsWorkerPath = require.resolve('pdfjs-dist/build/pdf.worker.js');
          pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerPath;
          
          // Load the PDF document (convert Buffer to Uint8Array as required by pdfjs-dist)
          const uint8Array = new Uint8Array(fileBuffer);
          const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
          const pdfDocument = await loadingTask.promise;
          
          // Extract text from all pages
          const numPages = pdfDocument.numPages;
          const pageTexts: string[] = [];
          
          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdfDocument.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            // Combine text items from the page
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(' ');
            
            pageTexts.push(pageText);
          }
          
          // Combine all pages into single text content
          textContent = pageTexts.join('\n\n');
          
          if (!textContent || textContent.trim().length === 0) {
            return {
              success: false,
              error: 'No text could be extracted from the PDF file',
            };
          }
          
          console.log(`[FILE ANALYSIS] Extracted ${textContent.length} characters from PDF (${numPages} pages)`);
        } catch (pdfError) {
          console.error('[FILE ANALYSIS] PDF extraction error:', pdfError);
          return {
            success: false,
            error: `Failed to extract text from PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`,
          };
        }
      } else if (isDocx) {
        // For DOCX files, extract text using mammoth
        console.log('[FILE ANALYSIS] Extracting text from DOCX...');
        // Dynamically import mammoth (CommonJS module)
        const mammothModule = await import('mammoth');
        // mammoth exports the object directly, not as default
        const mammothLib = (mammothModule as any).default || mammothModule;
        const result = await mammothLib.extractRawText({ buffer: fileBuffer });
        textContent = result.value;
        
        if (!textContent || textContent.trim().length === 0) {
          return {
            success: false,
            error: 'No text could be extracted from the DOCX file',
          };
        }
        console.log(`[FILE ANALYSIS] Extracted ${textContent.length} characters from DOCX`);
      }

      // Analyze the extracted text content using OpenAI chat completions
      if (textContent && textContent.trim().length > 0) {
        console.log('[FILE ANALYSIS] Sending extracted text to OpenAI for analysis...');
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: 'You are an expert at extracting and summarizing information from documents. Extract all key details including company names, job titles, achievements, bullet points, and quantifiable metrics.',
              },
              {
                role: 'user',
                content: `Extract ALL important information from this document. Include:
- Exact company names and organization names
- Specific job titles and roles
- Quantifiable achievements (numbers, percentages, metrics)
- Detailed bullet points and responsibilities
- Specific projects, technologies, and skills mentioned
- Dates, locations, and other concrete details

Format as a comprehensive, detailed summary that preserves all specific information. Include all bullet points, achievements, and quantifiable results. Do not summarize or generalize - include the actual details.

Document content:
${textContent.substring(0, 100000)}`, // Limit to 100k chars
              },
            ],
            max_tokens: 4000,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        analyzedContent = data.choices[0]?.message?.content || '';
        console.log(`[FILE ANALYSIS] Analysis complete. Extracted ${analyzedContent.length} characters of analyzed content.`);
      }
    } else {
      // For other file types (DOCX, etc.), try to use vision API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Extract ALL important information from this document. Include:
- Exact company names and organization names
- Specific job titles and roles
- Quantifiable achievements (numbers, percentages, metrics)
- Detailed bullet points and responsibilities
- Specific projects, technologies, and skills mentioned
- Dates, locations, and other concrete details

Format as a comprehensive, detailed summary that preserves all specific information. Include all bullet points, achievements, and quantifiable results. Do not summarize or generalize - include the actual details.`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      analyzedContent = data.choices[0]?.message?.content || '';
    }

    if (!analyzedContent || analyzedContent.trim().length === 0) {
      return {
        success: false,
        error: 'No content extracted from file',
      };
    }

    return {
      success: true,
      analyzedContent: analyzedContent.trim(),
    };
  } catch (error) {
    console.error('[FILE ANALYSIS ERROR]', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze file',
    };
  }
}

