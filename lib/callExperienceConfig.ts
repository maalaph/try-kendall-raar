/**
 * Shared helpers for configuring outbound call experience.
 * Centralizes voicemail detection + start speaking plan + voicemail copy.
 */

type VoicemailDetectionConfig = {
  enabled: boolean;
  provider?: string;
  voicemailDetectionTypes?: string[];
  machineDetectionTimeout?: number;
  machineDetectionSpeechThreshold?: number;
  machineDetectionSpeechEndThreshold?: number;
  machineDetectionSilenceTimeout?: number;
};

type StartSpeakingPlan = {
  waitSeconds: number;
  smartEndpointingEnabled: boolean;
};

export type VoicemailMessageParams = {
  ownerName?: string | null;
  kendallName?: string | null;
  message?: string | null;
  ownerPhone?: string | null;
  recipientName?: string | null;
};

const DEFAULT_VOICEMAIL_TYPES = [
  'machine_start',
  'machine_end_beep',
  'machine_end_silence',
  'machine_end_other',
  'unknown',
];

function parseNumberEnv(envValue: string | undefined, fallback: number): number {
  if (!envValue) return fallback;
  const parsed = Number(envValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getVoicemailDetectionConfig(): VoicemailDetectionConfig {
  const provider = process.env.VAPI_VOICEMAIL_PROVIDER || 'twilio';
  const enabled =
    (process.env.VAPI_VOICEMAIL_ENABLED || 'true').toLowerCase() !== 'false';

  const customTypes = process.env.VAPI_VOICEMAIL_TYPES
    ? process.env.VAPI_VOICEMAIL_TYPES.split(',').map(type => type.trim()).filter(Boolean)
    : DEFAULT_VOICEMAIL_TYPES;

  return {
    enabled,
    provider,
    voicemailDetectionTypes: customTypes,
    machineDetectionTimeout: parseNumberEnv(
      process.env.VAPI_MACHINE_DETECTION_TIMEOUT,
      5
    ),
    machineDetectionSpeechThreshold: parseNumberEnv(
      process.env.VAPI_MACHINE_DETECTION_SPEECH_THRESHOLD,
      2400
    ),
    machineDetectionSpeechEndThreshold: parseNumberEnv(
      process.env.VAPI_MACHINE_DETECTION_SPEECH_END_THRESHOLD,
      1000
    ),
    machineDetectionSilenceTimeout: parseNumberEnv(
      process.env.VAPI_MACHINE_DETECTION_SILENCE_TIMEOUT,
      3000
    ),
  };
}

export function getStartSpeakingPlan(): StartSpeakingPlan {
  const waitSeconds = parseNumberEnv(
    process.env.VAPI_START_SPEAKING_WAIT_SECONDS,
    0.8
  );
  const smartEndpointingEnabled =
    (process.env.VAPI_SMART_ENDPOINTING_ENABLED || 'true').toLowerCase() !== 'false';

  return {
    waitSeconds,
    smartEndpointingEnabled,
  };
}

export function buildVoicemailMessage({
  ownerName,
  kendallName,
  message,
  ownerPhone,
  recipientName,
}: VoicemailMessageParams): string {
  const safeOwner = (ownerName || 'the owner').trim();
  const safeKendall = (kendallName || 'Kendall').trim();
  const safeRecipient = (recipientName || 'there').trim();

  const trimmedMessage = (message || '').trim();
  const messageBody =
    trimmedMessage.length > 0
      ? trimmedMessage
      : 'I was calling with a quick update for you.';

  const callbackLine = ownerPhone
    ? ` You can call or text ${ownerPhone} when you get this.`
    : '';

  return `Hi ${safeRecipient}, this is ${safeKendall} calling for ${safeOwner}. ${messageBody}${callbackLine}`.trim();
}

