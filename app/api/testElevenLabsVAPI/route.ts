import { NextRequest, NextResponse } from 'next/server';

const VAPI_API_URL = 'https://api.vapi.ai';

/**
 * Test endpoint to check if VAPI API accepts new ElevenLabs User API Key format
 * Tests multiple approaches to configure ElevenLabs credentials
 */
export async function POST(request: NextRequest) {
  try {
    const vapiPrivateKey = process.env.VAPI_PRIVATE_KEY;
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!vapiPrivateKey) {
      return NextResponse.json(
        { error: 'VAPI_PRIVATE_KEY not found in environment variables' },
        { status: 500 }
      );
    }

    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not found in environment variables' },
        { status: 500 }
      );
    }

    const results: any = {
      timestamp: new Date().toISOString(),
      elevenLabsKeyFormat: {
        length: elevenLabsApiKey.length,
        startsWith: elevenLabsApiKey.substring(0, 10),
        endsWith: elevenLabsApiKey.substring(elevenLabsApiKey.length - 10),
        isHexString: /^[0-9a-f]+$/i.test(elevenLabsApiKey),
      },
      tests: [],
    };

    const headers = {
      'Authorization': `Bearer ${vapiPrivateKey}`,
      'Content-Type': 'application/json',
    };

    // Test 1: Try account-level configuration (if endpoint exists)
    console.log('[TEST] Attempting account-level ElevenLabs configuration...');
    try {
      const accountConfigResponse = await fetch(`${VAPI_API_URL}/account`, {
        method: 'GET',
        headers,
      });

      if (accountConfigResponse.ok) {
        const accountData = await accountConfigResponse.json();
        results.tests.push({
          test: 'Account Configuration Check',
          success: true,
          message: 'Account endpoint exists',
          data: accountData,
        });
      } else {
        results.tests.push({
          test: 'Account Configuration Check',
          success: false,
          message: `Account endpoint returned ${accountConfigResponse.status}`,
          status: accountConfigResponse.status,
        });
      }
    } catch (error) {
      results.tests.push({
        test: 'Account Configuration Check',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 2: Try to configure ElevenLabs via account settings endpoint
    console.log('[TEST] Attempting to set ElevenLabs credentials via account settings...');
    try {
      const settingsResponse = await fetch(`${VAPI_API_URL}/account`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          elevenLabsApiKey: elevenLabsApiKey,
        }),
      });

      const settingsData = await settingsResponse.json();
      results.tests.push({
        test: 'Account Settings Configuration',
        success: settingsResponse.ok,
        status: settingsResponse.status,
        message: settingsResponse.ok ? 'Credentials configured successfully' : 'Configuration failed',
        data: settingsData,
      });
    } catch (error) {
      results.tests.push({
        test: 'Account Settings Configuration',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 3: Try creating agent with ElevenLabs key in voice config
    console.log('[TEST] Attempting agent creation with ElevenLabs key in voice config...');
    try {
      const testAgentBody = {
        name: 'Test ElevenLabs Voice Agent',
        model: {
          provider: 'openai',
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a test assistant.',
            },
          ],
        },
        firstMessage: 'Hello, this is a test.',
        voice: {
          provider: '11labs',
          voiceId: 'CwhRBWXzGAHq8TQ4Fs17', // Roger voice ID
          // Try passing API key directly in voice config
          apiKey: elevenLabsApiKey,
        },
      };

      const agentResponse = await fetch(`${VAPI_API_URL}/assistant`, {
        method: 'POST',
        headers,
        body: JSON.stringify(testAgentBody),
      });

      const agentData = await agentResponse.json();
      results.tests.push({
        test: 'Agent Creation with API Key in Voice Config',
        success: agentResponse.ok,
        status: agentResponse.status,
        message: agentResponse.ok ? 'Agent created successfully' : 'Agent creation failed',
        data: agentData,
        agentId: agentData.id,
      });

      // If agent was created, try to delete it
      if (agentResponse.ok && agentData.id) {
        try {
          await fetch(`${VAPI_API_URL}/assistant/${agentData.id}`, {
            method: 'DELETE',
            headers,
          });
          results.tests[results.tests.length - 1].cleanup = 'Test agent deleted';
        } catch (cleanupError) {
          results.tests[results.tests.length - 1].cleanup = 'Failed to delete test agent';
        }
      }
    } catch (error) {
      results.tests.push({
        test: 'Agent Creation with API Key in Voice Config',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 4: Try creating agent with ElevenLabs key in different location
    console.log('[TEST] Attempting agent creation with ElevenLabs key in root level...');
    try {
      const testAgentBody2 = {
        name: 'Test ElevenLabs Voice Agent 2',
        model: {
          provider: 'openai',
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a test assistant.',
            },
          ],
        },
        firstMessage: 'Hello, this is a test.',
        voice: {
          provider: '11labs',
          voiceId: 'CwhRBWXzGAHq8TQ4Fs17',
        },
        // Try passing API key at root level
        elevenLabsApiKey: elevenLabsApiKey,
      };

      const agentResponse2 = await fetch(`${VAPI_API_URL}/assistant`, {
        method: 'POST',
        headers,
        body: JSON.stringify(testAgentBody2),
      });

      const agentData2 = await agentResponse2.json();
      results.tests.push({
        test: 'Agent Creation with API Key at Root Level',
        success: agentResponse2.ok,
        status: agentResponse2.status,
        message: agentResponse2.ok ? 'Agent created successfully' : 'Agent creation failed',
        data: agentData2,
        agentId: agentData2.id,
      });

      // If agent was created, try to delete it
      if (agentResponse2.ok && agentData2.id) {
        try {
          await fetch(`${VAPI_API_URL}/assistant/${agentData2.id}`, {
            method: 'DELETE',
            headers,
          });
          results.tests[results.tests.length - 1].cleanup = 'Test agent deleted';
        } catch (cleanupError) {
          results.tests[results.tests.length - 1].cleanup = 'Failed to delete test agent';
        }
      }
    } catch (error) {
      results.tests.push({
        test: 'Agent Creation with API Key at Root Level',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 5: Try creating agent WITHOUT passing key (rely on account-level config)
    console.log('[TEST] Attempting agent creation relying on account-level config...');
    try {
      const testAgentBody3 = {
        name: 'Test ElevenLabs Voice Agent 3',
        model: {
          provider: 'openai',
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a test assistant.',
            },
          ],
        },
        firstMessage: 'Hello, this is a test.',
        voice: {
          provider: '11labs',
          voiceId: 'CwhRBWXzGAHq8TQ4Fs17',
          // Don't pass API key - rely on account-level config
        },
      };

      const agentResponse3 = await fetch(`${VAPI_API_URL}/assistant`, {
        method: 'POST',
        headers,
        body: JSON.stringify(testAgentBody3),
      });

      const agentData3 = await agentResponse3.json();
      results.tests.push({
        test: 'Agent Creation Relying on Account Config',
        success: agentResponse3.ok,
        status: agentResponse3.status,
        message: agentResponse3.ok ? 'Agent created successfully (account config works)' : 'Agent creation failed - account config may not be set',
        data: agentData3,
        agentId: agentData3.id,
      });

      // If agent was created, try to delete it
      if (agentResponse3.ok && agentData3.id) {
        try {
          await fetch(`${VAPI_API_URL}/assistant/${agentData3.id}`, {
            method: 'DELETE',
            headers,
          });
          results.tests[results.tests.length - 1].cleanup = 'Test agent deleted';
        } catch (cleanupError) {
          results.tests[results.tests.length - 1].cleanup = 'Failed to delete test agent';
        }
      }
    } catch (error) {
      results.tests.push({
        test: 'Agent Creation Relying on Account Config',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Summary
    const successfulTests = results.tests.filter((t: any) => t.success);
    const failedTests = results.tests.filter((t: any) => !t.success);

    results.summary = {
      totalTests: results.tests.length,
      successful: successfulTests.length,
      failed: failedTests.length,
      recommendation: successfulTests.length > 0
        ? 'At least one method worked! Check the successful test to see which approach to use.'
        : 'None of the tested methods worked. VAPI API may not support new ElevenLabs key format yet.',
    };

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error('[TEST ERROR]', error);
    return NextResponse.json(
      {
        error: 'Test failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}






