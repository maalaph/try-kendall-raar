/**
 * Message Templates Library
 * Pre-defined and user-created message templates
 */

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  category?: 'call' | 'message' | 'follow-up' | 'reminder' | 'custom';
  variables?: string[]; // Placeholder variables like {{name}}, {{time}}
  createdBy?: 'system' | 'user';
  createdAt?: string;
  updatedAt?: string;
}

const SYSTEM_TEMPLATES: MessageTemplate[] = [
  {
    id: 'call-follow-up',
    name: 'Call Follow-up',
    content: 'Just following up on our earlier conversation. Do you need anything else?',
    category: 'follow-up',
    createdBy: 'system',
  },
  {
    id: 'call-reminder',
    name: 'Call Reminder',
    content: 'Reminder: You have a call scheduled with {{name}} at {{time}}.',
    category: 'reminder',
    variables: ['name', 'time'],
    createdBy: 'system',
  },
  {
    id: 'quick-check-in',
    name: 'Quick Check-in',
    content: 'Hey! Just checking in - everything going okay?',
    category: 'message',
    createdBy: 'system',
  },
  {
    id: 'schedule-confirmation',
    name: 'Schedule Confirmation',
    content: 'I\'ve scheduled {{task}} for {{date}} at {{time}}. Let me know if you need any changes!',
    category: 'message',
    variables: ['task', 'date', 'time'],
    createdBy: 'system',
  },
];

/**
 * Get all templates (system + user)
 */
export function getAllTemplates(userTemplates: MessageTemplate[] = []): MessageTemplate[] {
  return [...SYSTEM_TEMPLATES, ...userTemplates];
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
  category: MessageTemplate['category'],
  userTemplates: MessageTemplate[] = []
): MessageTemplate[] {
  return getAllTemplates(userTemplates).filter(t => t.category === category);
}

/**
 * Render template with variables
 */
export function renderTemplate(template: MessageTemplate, variables: Record<string, string>): string {
  let content = template.content;

  if (template.variables) {
    template.variables.forEach(variable => {
      const value = variables[variable] || `{{${variable}}}`;
      content = content.replace(new RegExp(`\\{\\{${variable}\\}\\}`, 'g'), value);
    });
  }

  // Also replace any remaining {{variable}} patterns
  content = content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match;
  });

  return content;
}

/**
 * Extract variables from template content
 */
export function extractVariables(content: string): string[] {
  const matches = content.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];

  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
}

