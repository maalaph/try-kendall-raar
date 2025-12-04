import { calendar_v3, gmail_v1 } from 'googleapis';
import { getGmailClient } from '@/lib/google/api';
import { getUserEvents } from '@/lib/google/calendar';

export type CalendarEventSummary = {
  summary: string;
  start: string | null;
  end: string | null;
  location: string | null;
};

export type GmailMessageSummary = {
  id: string;
  from: string;
  subject: string;
  date: string;
};

export type CalendarFetchOptions = {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
};

export type GmailFetchOptions = {
  unread?: boolean;
  maxResults?: number;
};

export type GmailSendOptions = {
  to: string;
  subject: string;
  body: string;
};

export class GoogleIntegrationError extends Error {
  constructor(
    public reason:
      | 'NOT_CONNECTED'
      | 'TOKEN_REFRESH_FAILED'
      | 'INSUFFICIENT_PERMISSIONS'
      | 'UNKNOWN',
    message: string,
  ) {
    super(message);
    this.name = 'GoogleIntegrationError';
  }
}

function normalizeEvent(
  event: calendar_v3.Schema$Event,
): CalendarEventSummary {
  return {
    summary: event.summary || 'Untitled event',
    start: event.start?.dateTime || event.start?.date || null,
    end: event.end?.dateTime || event.end?.date || null,
    location: event.location || null,
  };
}

function normalizeMessage(
  message: gmail_v1.Schema$Message,
): GmailMessageSummary {
  const headers = message.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
      ?.value || '';

  return {
    id: message.id || '',
    from: getHeader('From'),
    subject: getHeader('Subject'),
    date: getHeader('Date'),
  };
}

function handleGoogleError(error: any): never {
  const message = error?.message || 'Unknown Google integration error';
  const lowerMessage = message.toLowerCase();
  const hasInsufficientPermission =
    lowerMessage.includes('insufficient permission') ||
    lowerMessage.includes('insufficient authentication scopes') ||
    error?.response?.status === 403 ||
    error?.code === 403 ||
    Boolean(
      error?.response?.data?.error?.errors?.some(
        (err: { reason?: string }) =>
          err.reason === 'insufficientPermissions' ||
          err.reason === 'insufficientPermissions',
      ),
    );

  if (message.includes('not connected')) {
    throw new GoogleIntegrationError(
      'NOT_CONNECTED',
      'Google account not connected',
    );
  }

  if (message.includes('Failed to refresh access token')) {
    throw new GoogleIntegrationError(
      'TOKEN_REFRESH_FAILED',
      'Failed to refresh Google access token',
    );
  }

  if (hasInsufficientPermission) {
    throw new GoogleIntegrationError(
      'INSUFFICIENT_PERMISSIONS',
      'Google account is missing the required Gmail permissions. Please reconnect Google with Gmail send access.',
    );
  }

  throw new GoogleIntegrationError('UNKNOWN', message);
}

export async function fetchCalendarEvents(
  recordId: string,
  options: CalendarFetchOptions = {},
): Promise<CalendarEventSummary[]> {
  try {
    const events =
      (await getUserEvents(
        recordId,
        options.timeMin || new Date().toISOString(),
        options.timeMax ||
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      )) || [];

    const normalized = events.map(normalizeEvent);
    if (options.maxResults && options.maxResults > 0) {
      return normalized.slice(0, options.maxResults);
    }
    return normalized;
  } catch (error) {
    handleGoogleError(error);
  }
}

export async function fetchGmailMessages(
  recordId: string,
  options: GmailFetchOptions = {},
): Promise<GmailMessageSummary[]> {
  try {
    const gmail = await getGmailClient(recordId);
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: options.maxResults ?? 10,
      labelIds: options.unread ? ['UNREAD'] : undefined,
    });

    const messageRefs = response.data.messages || [];
    if (messageRefs.length === 0) {
      return [];
    }

    const messages = await Promise.all(
      messageRefs.map(async (m) => {
        if (!m.id) return null;
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: m.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });
        return normalizeMessage(msg.data);
      }),
    );

    return messages.filter(Boolean) as GmailMessageSummary[];
  } catch (error) {
    handleGoogleError(error);
  }
}

export async function sendGmailMessage(
  recordId: string,
  { to, subject, body }: GmailSendOptions,
): Promise<{ messageId: string }> {
  try {
    const gmail = await getGmailClient(recordId);
    const message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });

    return { messageId: response.data.id || '' };
  } catch (error: any) {
    if (error?.response?.status === 403) {
      const apiMessage =
        error?.response?.data?.error?.message ||
        error?.message ||
        'Insufficient Permission';
      throw new GoogleIntegrationError(
        'INSUFFICIENT_PERMISSIONS',
        apiMessage,
      );
    }
    handleGoogleError(error);
  }
}


