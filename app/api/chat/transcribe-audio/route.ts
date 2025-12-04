import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

/**
 * POST /api/chat/transcribe-audio
 * Transcribe audio to text using OpenAI Whisper
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { audio, mimeType } = body;

    if (!audio) {
      return NextResponse.json(
        { success: false, error: 'Audio data is required' },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audio, 'base64');
    
    // Create a File-like object for OpenAI API
    const audioFile = new File([audioBuffer], 'audio.webm', { type: mimeType || 'audio/webm' });

    // Transcribe using Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
    });

    return NextResponse.json({
      success: true,
      transcript: transcription.text,
    });
  } catch (error) {
    console.error('[API ERROR] POST /api/chat/transcribe-audio failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to transcribe audio',
      },
      { status: 500 }
    );
  }
}




