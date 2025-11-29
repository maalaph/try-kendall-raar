import { NextResponse } from 'next/server';

/**
 * Comprehensive test endpoint to find VAPI's voice preview functionality
 * Tests multiple approaches: chat sessions, call creation, underlying providers
 */
export async function GET(request: Request) {
  try {
    const apiKey = process.env.VAPI_PRIVATE_KEY;
    const { searchParams } = new URL(request.url);
    const voiceId = searchParams.get('voiceId') || 'Elliot';
    const testText = searchParams.get('text') || 'Hello, this is how your Kendall will sound.';
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'VAPI_PRIVATE_KEY not found' },
        { status: 500 }
      );
    }

    const results: any[] = [];
    const baseUrl = 'https://api.vapi.ai';
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    // Approach 1: Try creating a chat session (text-based, might generate audio)
    try {
      console.log('[TEST] Attempting to create chat session...');
      
      // First create a temporary assistant
      const assistantResponse = await fetch(`${baseUrl}/assistant`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Temp Voice Preview Assistant',
          model: {
            provider: 'openai',
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: `You are a voice preview assistant. When you receive any message, respond with only this exact text: "${testText}"`,
              },
            ],
          },
          voice: {
            provider: 'vapi',
            voiceId: voiceId,
          },
          firstMessage: testText,
          backgroundSound: 'off',
        }),
      });

      let assistantData: any;
      try {
        assistantData = await assistantResponse.json();
      } catch {
        assistantData = { error: 'Failed to parse assistant response' };
      }

      if (assistantResponse.ok && assistantData.id) {
        const assistantId = assistantData.id;
        results.push({
          approach: 'Assistant Creation',
          success: true,
          assistantId: assistantId,
        });

        // Try creating a chat session (correct format with 'input' field)
        try {
          const chatResponse = await fetch(`${baseUrl}/chat`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              assistantId: assistantId,
              input: testText,
            }),
          });

          let chatData: any;
          try {
            chatData = await chatResponse.json();
          } catch {
            const chatText = await chatResponse.text();
            chatData = { raw: chatText.substring(0, 1000) };
          }

          results.push({
            approach: 'Chat Session Creation',
            success: chatResponse.ok,
            status: chatResponse.status,
            error: !chatResponse.ok ? chatData : undefined,
            hasAudio: chatResponse.headers.get('content-type')?.includes('audio'),
            chatId: chatData.id || chatData.chatId,
            messages: chatData.messages,
            audioUrl: chatData.audioUrl || chatData.audio,
            fullResponse: chatData,
            note: chatResponse.ok ? 'Chat session created - check if messages contain audio URLs' : 'Chat endpoint error - check error details',
          });

          // Try getting chat messages which might have audio
          if (chatResponse.ok && chatData.id) {
            try {
              const messagesResponse = await fetch(`${baseUrl}/chat/${chatData.id}/message`, {
                method: 'GET',
                headers,
              });

              let messagesData: any;
              try {
                messagesData = await messagesResponse.json();
              } catch {
                messagesData = { error: 'Failed to parse' };
              }

              results.push({
                approach: 'Get Chat Messages',
                success: messagesResponse.ok,
                messages: messagesData,
                note: 'Check messages for audio URLs or transcription with audio',
              });
            } catch (error) {
              // Ignore
            }
          }
        } catch (error) {
          results.push({
            approach: 'Chat Session Creation',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }

        // Cleanup: delete temp assistant
        try {
          await fetch(`${baseUrl}/assistant/${assistantId}`, {
            method: 'DELETE',
            headers,
          });
          results.push({
            approach: 'Cleanup',
            note: 'Temporary assistant deleted',
          });
        } catch (e) {
          // Ignore cleanup errors
        }
      } else {
        results.push({
          approach: 'Assistant Creation',
          success: false,
          error: assistantData,
        });
      }
    } catch (error) {
      results.push({
        approach: 'Assistant/Chat Flow',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Approach 2: Check if we can get audio from an existing assistant's first message
    try {
      // Create assistant with specific firstMessage
      const assistantResponse = await fetch(`${baseUrl}/assistant`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Temp First Message Test',
          model: {
            provider: 'openai',
            model: 'gpt-4o',
            messages: [{ role: 'system', content: 'Say only: ' + testText }],
          },
          voice: {
            provider: 'vapi',
            voiceId: voiceId,
          },
          firstMessage: testText,
          backgroundSound: 'off',
        }),
      });

      if (assistantResponse.ok) {
        const assistantData = await assistantResponse.json();
        
        // Check if assistant response contains audio or preview URL
        results.push({
          approach: 'Assistant First Message',
          assistantId: assistantData.id,
          hasFirstMessageAudio: !!assistantData.firstMessageAudio,
          firstMessageAudio: assistantData.firstMessageAudio,
          note: 'Check if assistant response contains firstMessage audio data',
        });

        // Cleanup
        if (assistantData.id) {
          try {
            await fetch(`${baseUrl}/assistant/${assistantData.id}`, {
              method: 'DELETE',
              headers,
            });
          } catch (e) {
            // Ignore
          }
        }
      }
    } catch (error) {
      // Ignore
    }

    // Approach 3: Try to get voice details from assistant to see underlying provider
    try {
      // Create assistant and inspect its voice config
      const assistantResponse = await fetch(`${baseUrl}/assistant`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Temp Voice Inspect',
          model: {
            provider: 'openai',
            model: 'gpt-4o',
            messages: [{ role: 'system', content: 'Test' }],
          },
          voice: {
            provider: 'vapi',
            voiceId: voiceId,
          },
        }),
      });

      if (assistantResponse.ok) {
        const assistantData = await assistantResponse.json();
        results.push({
          approach: 'Voice Configuration Inspection',
          voiceConfig: assistantData.voice,
          note: 'Inspect voice object to see if it reveals underlying provider details',
        });

        // Cleanup
        if (assistantData.id) {
          try {
            await fetch(`${baseUrl}/assistant/${assistantData.id}`, {
              method: 'DELETE',
              headers,
            });
          } catch (e) {
            // Ignore
          }
        }
      }
    } catch (error) {
      // Ignore
    }

    return NextResponse.json({
      summary: {
        voiceTested: voiceId,
        textTested: testText,
        approachesTested: results.length,
        successful: results.filter(r => r.success).length,
      },
      results,
      recommendation: 'Check results to see if any approach provides audio URLs or reveals how to generate previews',
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

