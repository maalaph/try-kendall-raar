/**
 * Batch Language Preview Generation
 * Generate previews in multiple languages simultaneously
 * Returns all language previews at once for instant language switching
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLanguagePreview } from '@/lib/languagePreviews';
import { getOptimalVoiceSettings } from '@/lib/voiceSettingsOptimizer';
import { enhanceVoiceDescription } from '@/lib/enhanceVoiceDescription';

export async function POST(request: NextRequest) {
  try {
    const { voiceId, languageCodes } = await request.json();

    if (!voiceId || !languageCodes || !Array.isArray(languageCodes) || languageCodes.length === 0) {
      return NextResponse.json(
        { error: 'voiceId and languageCodes array are required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not found in environment variables' },
        { status: 500 }
      );
    }

    // Validate language codes
    const validLanguages = ['en', 'es', 'ar', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'hi', 'nl', 'pl', 'ru', 'tr'];
    const validLanguageCodes = languageCodes.filter((code: string) => 
      validLanguages.includes(code.toLowerCase())
    );

    if (validLanguageCodes.length === 0) {
      return NextResponse.json(
        { error: 'No valid language codes provided' },
        { status: 400 }
      );
    }

    // Generate previews in parallel for all languages
    const previewPromises = validLanguageCodes.map(async (langCode: string) => {
      try {
        const previewText = getLanguagePreview(langCode);
        
        // Optimize voice settings based on preview text
        const { extractedElements } = enhanceVoiceDescription(previewText);
        const voiceSettings = getOptimalVoiceSettings(previewText, extractedElements);

        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          {
            method: 'POST',
            headers: {
              'Accept': 'audio/mpeg',
              'Content-Type': 'application/json',
              'xi-api-key': apiKey,
            },
            body: JSON.stringify({
              text: previewText,
              model_id: 'eleven_multilingual_v2',
              voice_settings: voiceSettings,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return {
            language: langCode,
            success: false,
            error: errorData.error?.message || `Failed to generate preview for ${langCode}`,
          };
        }

        const audioBuffer = await response.arrayBuffer();
        const audioBase64 = Buffer.from(audioBuffer).toString('base64');

        return {
          language: langCode,
          success: true,
          audioBase64,
          text: previewText,
        };
      } catch (error) {
        console.error(`[MULTI-LANGUAGE PREVIEW] Error generating ${langCode}:`, error);
        return {
          language: langCode,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Wait for all previews to complete
    const results = await Promise.all(previewPromises);

    // Separate successful and failed previews
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return NextResponse.json({
      success: true,
      previews: successful,
      failed: failed.length > 0 ? failed : undefined,
      totalRequested: validLanguageCodes.length,
      totalGenerated: successful.length,
    });
  } catch (error) {
    console.error('[MULTI-LANGUAGE PREVIEW] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate multi-language previews',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}













