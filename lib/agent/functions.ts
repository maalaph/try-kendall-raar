/**
 * Function Registry for LangGraph
 * Wraps existing function implementations for agent orchestration
 */

import { getContactByName } from "@/lib/database";
import { fetchCalendarEvents, sendGmailMessage, GoogleIntegrationError } from "@/lib/integrations/google";
import { createEvent } from "@/lib/google/calendar";
import { fetchSpotifyInsights, SpotifyIntegrationError } from "@/lib/integrations/spotify";
import { createOutboundCallRequest } from "@/lib/airtable";
import { formatPhoneNumberToE164 } from "@/lib/vapi";

export interface FunctionDefinition {
  name: string;
  description: string;
  execute: (args: any) => Promise<any>;
}

class FunctionRegistry {
  private functions: Map<string, FunctionDefinition> = new Map();

  register(func: FunctionDefinition) {
    this.functions.set(func.name, func);
  }

  get(name: string): FunctionDefinition | undefined {
    return this.functions.get(name);
  }

  getAll(): FunctionDefinition[] {
    return Array.from(this.functions.values());
  }

  getNames(): string[] {
    return Array.from(this.functions.keys());
  }
}

// Create singleton registry
let registryInstance: FunctionRegistry | null = null;

export function getFunctionRegistry(): FunctionRegistry {
  if (!registryInstance) {
    registryInstance = new FunctionRegistry();
    initializeFunctions(registryInstance);
  }
  return registryInstance;
}

function initializeFunctions(registry: FunctionRegistry) {
  // Register get_contact_by_name
  registry.register({
    name: 'get_contact_by_name',
    description: 'Look up a contact by name in the user\'s contact list',
    execute: async (args: { recordId: string; name: string }) => {
      const contact = await getContactByName(args.recordId, args.name);
      return {
        success: !!contact,
        contact: contact || null,
      };
    },
  });

  // Register get_calendar_events
  registry.register({
    name: 'get_calendar_events',
    description: 'Get calendar events from the user\'s Google Calendar',
    execute: async (args: { recordId: string; startDate?: string; endDate?: string; maxResults?: number }) => {
      try {
        const events = await fetchCalendarEvents(args.recordId, {
          timeMin: args.startDate ? new Date(args.startDate).toISOString() : undefined,
          timeMax: args.endDate ? new Date(args.endDate).toISOString() : undefined,
          maxResults: args.maxResults,
        });
        return {
          success: true,
          events,
        };
      } catch (error) {
        if (error instanceof GoogleIntegrationError) {
          return {
            success: false,
            error: error.reason,
            message: error.message,
          };
        }
        throw error;
      }
    },
  });

  // Register create_calendar_event
  registry.register({
    name: 'create_calendar_event',
    description: 'Create a new calendar event in the user\'s Google Calendar',
    execute: async (args: {
      recordId: string;
      summary: string;
      description?: string;
      startDateTime: string;
      endDateTime?: string;
      allDay?: boolean;
    }) => {
      try {
        const event = await createEvent(args.recordId, {
          summary: args.summary,
          description: args.description,
          start: {
            dateTime: args.allDay ? undefined : args.startDateTime,
            date: args.allDay ? args.startDateTime.split('T')[0] : undefined,
            timeZone: 'UTC',
          },
          end: {
            dateTime: args.allDay ? undefined : (args.endDateTime || args.startDateTime),
            date: args.allDay ? (args.endDateTime?.split('T')[0] || args.startDateTime.split('T')[0]) : undefined,
            timeZone: 'UTC',
          },
        });
        return {
          success: true,
          eventId: event.id,
          event,
        };
      } catch (error) {
        if (error instanceof GoogleIntegrationError) {
          return {
            success: false,
            error: error.reason,
            message: error.message,
          };
        }
        throw error;
      }
    },
  });

  // Register get_gmail_messages
  registry.register({
    name: 'get_gmail_messages',
    description: 'Get and analyze Gmail messages',
    execute: async (args: { recordId: string; unread?: boolean; maxResults?: number }) => {
      try {
        // Note: This is a placeholder - implement actual Gmail fetching
        // For now, return a structure that matches expected format
        return {
          success: true,
          messages: [],
          message: 'Gmail integration not fully implemented in function registry',
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });

  // Register send_gmail
  registry.register({
    name: 'send_gmail',
    description: 'Send an email via Gmail on behalf of the owner',
    execute: async (args: { recordId: string; to: string; subject: string; body: string }) => {
      try {
        const result = await sendGmailMessage(args.recordId, {
          to: args.to,
          subject: args.subject,
          body: args.body,
        });
        return {
          success: true,
          messageId: result.id,
        };
      } catch (error) {
        if (error instanceof GoogleIntegrationError) {
          return {
            success: false,
            error: error.reason,
            message: error.message,
          };
        }
        throw error;
      }
    },
  });

  // Register make_outbound_call
  registry.register({
    name: 'make_outbound_call',
    description: 'Make an immediate outbound phone call',
    execute: async (args: { phone_number: string; message: string; caller_name?: string }) => {
      try {
        const normalizedPhone = formatPhoneNumberToE164(args.phone_number);
        if (!normalizedPhone) {
          return {
            success: false,
            error: 'Invalid phone number format',
          };
        }

        const callRequest = await createOutboundCallRequest({
          phoneNumber: normalizedPhone,
          message: args.message,
          callerName: args.caller_name,
        });

        return {
          success: true,
          callRequestId: callRequest.id,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });

  // Register schedule_outbound_call
  registry.register({
    name: 'schedule_outbound_call',
    description: 'Schedule an outbound call for a future time',
    execute: async (args: {
      phone_number: string;
      message: string;
      scheduled_time: string;
      caller_name?: string;
    }) => {
      try {
        const normalizedPhone = formatPhoneNumberToE164(args.phone_number);
        if (!normalizedPhone) {
          return {
            success: false,
            error: 'Invalid phone number format',
          };
        }

        // Note: Implement scheduled call creation
        // For now, return a placeholder
        return {
          success: true,
          message: 'Scheduled call creation not fully implemented',
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });

  // Register get_spotify_insights
  registry.register({
    name: 'get_spotify_insights',
    description: 'Fetch Spotify analytics for the user',
    execute: async (args: { timeRange?: string; limit?: number }) => {
      try {
        const insights = await fetchSpotifyInsights({
          timeRange: (args.timeRange as any) || 'medium_term',
          limit: args.limit || 10,
        });
        return {
          success: true,
          insights,
        };
      } catch (error) {
        if (error instanceof SpotifyIntegrationError) {
          return {
            success: false,
            error: error.reason,
            message: error.message,
          };
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
}

