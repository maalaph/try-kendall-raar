/**
 * Trigger.dev Client Utilities
 * Helper functions for checking Trigger.dev connection and status
 */

/**
 * Check if Trigger.dev is properly configured
 * Verifies environment variables are set
 */
export function isTriggerDevConfigured(): boolean {
  return !!(
    process.env.TRIGGER_API_KEY &&
    process.env.TRIGGER_PROJECT_ID &&
    process.env.TRIGGER_API_KEY.trim() !== '' &&
    process.env.TRIGGER_PROJECT_ID.trim() !== ''
  );
}

/**
 * Check Trigger.dev API connection
 * Attempts to ping the Trigger.dev API to verify connectivity
 */
export async function checkTriggerDevConnection(): Promise<boolean> {
  if (!isTriggerDevConfigured()) {
    return false;
  }

  // Try to ping Trigger.dev API
  try {
    const response = await fetch(
      `https://api.trigger.dev/v1/projects/${process.env.TRIGGER_PROJECT_ID}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TRIGGER_API_KEY}`,
        },
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Log Trigger.dev configuration status
 * Useful for startup diagnostics
 */
export async function logTriggerDevStatus(): Promise<void> {
  const configured = isTriggerDevConfigured();
  console.log('[TRIGGER DEV] Configuration:', {
    configured,
    hasApiKey: !!process.env.TRIGGER_API_KEY,
    hasProjectId: !!process.env.TRIGGER_PROJECT_ID,
    projectId: process.env.TRIGGER_PROJECT_ID || 'not set',
  });

  if (configured) {
    const connected = await checkTriggerDevConnection();
    console.log('[TRIGGER DEV] API Connection:', {
      connected,
      status: connected ? '✅ Connected' : '❌ Failed to connect',
    });
  } else {
    console.warn(
      '[TRIGGER DEV] Not configured. Set TRIGGER_API_KEY and TRIGGER_PROJECT_ID in .env.local'
    );
  }
}

