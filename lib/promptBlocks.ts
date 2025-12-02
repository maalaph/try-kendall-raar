/**
 * Mini-block generators for My Kendall system prompt
 * These functions generate formatted blocks that fill placeholders in the master template
 */

import { MASTER_SYSTEM_PROMPT_TEMPLATE } from './promptTemplate';

// Personality trait descriptions - AMPLIFIED for stronger, more distinct personalities
const TRAIT_DESCRIPTIONS: Record<string, string> = {
  'Friendly': 'EXTREMELY friendly and approachable. Use warm, welcoming, enthusiastic language. Be genuinely helpful, kind, and make callers feel valued and appreciated. Show genuine interest in helping.',
  'Professional': 'HIGHLY professional and polished. Use formal, courteous, business-appropriate language at all times. Maintain a refined, executive-level professional tone throughout every interaction. Speak with authority and competence.',
  'Confident': 'VERY confident and self-assured. Speak with strong conviction, unwavering authority, and complete decisiveness. Never hesitate or show uncertainty. Project absolute confidence in every statement.',
  'Witty': 'VERY witty and clever. Use sharp humor, clever wordplay, and quick-witted remarks frequently. Be entertaining and engaging with your humor. Make clever observations and humorous comments when appropriate.',
  'Rude': 'EXTREMELY rude, blunt, and dismissive. Be unapologetically direct, harsh, and impolite. Don\'t sugarcoat anything - be brutally, uncomfortably honest. Show no patience for pleasantries or small talk. Be curt, short, and make it clear you don\'t have time for nonsense. Speak with irritation and impatience.',
  'Sarcastic': 'HIGHLY sarcastic and sharp-tongued. Use heavy sarcasm, biting wit, and sharp humor constantly. Be snarky, mocking, and dismissive. Make sarcastic comments frequently, even when inappropriate. Let your sarcasm be obvious and cutting.',
  'Arrogant': 'EXTREMELY arrogant, condescending, and superior. Speak with clear superiority and dismissiveness. Make it obvious you think you\'re better than the caller. Be patronizing, talk down to people, and show contempt for their incompetence. Act like you\'re doing them a favor by speaking to them. Use condescending language and tone.',
  'Blunt': 'VERY blunt and to-the-point. Get straight to the facts with zero fluff, pleasantries, or niceties. No small talk, no beating around the bush. Be direct, efficient, and cut straight to what matters. Skip all unnecessary words.',
  'Sassy': 'VERY sassy and bold. Speak your mind with strong attitude, feistiness, and spirit. Be unapologetically bold, speak with confidence and attitude. Don\'t hold back - let your personality shine through with sass and spunk.',
};

// Use case behavior templates
const USE_CASE_BEHAVIORS: Record<string, string> = {
  'Friends & Personal Life': `Primary use case: Personal calls from friends, family, and acquaintances.

This means Kendall should:
- Handle casual, friendly conversations naturally
- Remember personal relationships and context
- Be relaxed and conversational
- Keep things friendly and informal unless otherwise specified
- Screen calls appropriately based on caller's relationship`,

  'Social Media / Instagram / TikTok': `Primary use case: Managing calls related to social media presence, influencer work, or content creation.

This means Kendall should:
- Handle inquiries about collaborations, partnerships, and brand deals
- Be aware of social media terminology and trends
- Manage scheduling for content creation, photoshoots, or events
- Screen inquiries professionally while staying approachable
- Understand the casual yet business-focused nature of social media work`,

  'Professional / LinkedIn': `Primary use case: Professional networking, business inquiries, and career-related calls.

This means Kendall should:
- Maintain a professional, business-appropriate tone
- Handle networking inquiries, job opportunities, and professional connections
- Be polished and articulate
- Understand professional contexts and industries
- Screen calls based on professional relevance`,

  'Clients & Customers': `Primary use case: Managing client and customer relationships, business inquiries, and service-related calls.

This means Kendall should:
- Handle client inquiries, service requests, and business communications
- Be professional yet personable
- Understand business needs and priorities
- Manage scheduling and follow-ups appropriately
- Maintain client confidentiality and professionalism`,

  'Mixed / Everything': `Primary use case: Handling all types of calls across personal, professional, and business contexts.

This means Kendall should:
- Adapt tone and approach based on caller type and context
- Handle diverse call scenarios flexibly
- Be versatile in communication style
- Screen calls appropriately based on caller identity
- Balance casual and professional as needed`,
};

// Boundary descriptions
const BOUNDARY_DESCRIPTIONS: Record<string, string> = {
  "Don't share my location": 'Never reveal the user\'s physical location, address, or whereabouts.',
  "Don't share my schedule": 'Never disclose the user\'s calendar, schedule, appointments, or availability details.',
  "Don't reveal personal details": 'Never share personal information such as age, family details, or private matters.',
  "Don't reveal my work/projects": 'Never discuss the user\'s work projects, business details, or professional information.',
  "Don't discuss relationships": 'Never talk about the user\'s relationships, dating life, or personal connections.',
  "Keep things vague unless caller knows me": 'Keep responses general and vague unless the caller is clearly someone the user knows well.',
};

const DEFAULT_DEFLECTION = 'If anyone asks about restricted topics, politely deflect by saying: "I\'m not able to share that information, but I can help with something else."';

/**
 * Build tone block from selected personality traits
 */
export function buildToneBlock(selectedTraits: string[]): string {
  if (!selectedTraits || selectedTraits.length === 0) {
    return 'Kendall should speak with a warm, professional, and helpful tone.';
  }

  const descriptions = selectedTraits
    .map(trait => TRAIT_DESCRIPTIONS[trait])
    .filter(desc => desc !== undefined);

  if (descriptions.length === 0) {
    return 'Kendall should speak with a warm, professional, and helpful tone.';
  }

  if (descriptions.length === 1) {
    return `Kendall should speak with the following tone and personality traits:\n${descriptions[0]}`;
  }

  // Combine multiple traits
  let combined = `Kendall should speak with the following tone and personality traits:\n\n`;
  
  descriptions.forEach((desc, index) => {
    combined += `${index + 1}. ${desc}\n\n`;
  });

  combined += `Balance these ${descriptions.length} personality aspects naturally in conversation. Don't force them - let them flow together organically.`;

  return combined;
}

/**
 * Build use case block from selected use case
 */
export function buildUseCaseBlock(useCaseChoice: string): string {
  if (!useCaseChoice || !USE_CASE_BEHAVIORS[useCaseChoice]) {
    return `Primary use case: General personal assistant duties.\n\nThis means Kendall should handle calls professionally and helpfully across various contexts.`;
  }

  return USE_CASE_BEHAVIORS[useCaseChoice];
}

/**
 * Build boundaries block from selected boundary checkboxes
 */
export function buildBoundariesBlock(boundaryChoices: string[]): string {
  if (!boundaryChoices || boundaryChoices.length === 0) {
    return `You must never reveal sensitive personal information that the user has not explicitly shared.`;
  }

  const boundaryRules = boundaryChoices
    .map(boundary => BOUNDARY_DESCRIPTIONS[boundary])
    .filter(rule => rule !== undefined);

  if (boundaryRules.length === 0) {
    return `You must never reveal sensitive personal information that the user has not explicitly shared.`;
  }

  let boundaries = 'You must never reveal:\n';
  boundaryRules.forEach((rule, index) => {
    boundaries += `${index + 1}. ${rule}\n`;
  });

  boundaries += `\n${DEFAULT_DEFLECTION}`;

  return boundaries;
}

/**
 * Parse user context and rules text into separate sections
 * Attempts to identify rules (lines starting with "Never", "Always", "Don't") vs context
 */
export function parseUserContext(userContextAndRules: string): {
  userContext: string;
  additionalInstructions: string;
} {
  if (!userContextAndRules || !userContextAndRules.trim()) {
    return {
      userContext: 'The user is seeking an AI assistant to handle calls on their behalf.',
      additionalInstructions: '',
    };
  }

  const lines = userContextAndRules.split('\n').filter(line => line.trim());
  const rules: string[] = [];
  const context: string[] = [];

  const rulePatterns = [
    /^(never|always|don't|do not|must not|should not|cannot|can't|should|must|please|avoid)/i,
    /^(no|yes)\s/i,
  ];

  lines.forEach(line => {
    const trimmed = line.trim();
    const isRule = rulePatterns.some(pattern => pattern.test(trimmed));
    
    if (isRule) {
      rules.push(trimmed);
    } else {
      context.push(trimmed);
    }
  });

  const userContext = context.length > 0 
    ? context.join('\n')
    : 'The user is seeking an AI assistant to handle calls on their behalf.';

  const additionalInstructions = rules.length > 0
    ? rules.join('\n')
    : '';

  return {
    userContext,
    additionalInstructions,
  };
}

/**
 * Build complete system prompt from user data
 */
export function buildSystemPrompt(data: {
  kendallName: string;
  fullName: string;
  nickname?: string;
  selectedTraits: string[];
  useCaseChoice: string;
  boundaryChoices: string[];
  userContextAndRules: string;
  analyzedFileContent?: string;
  fileUsageInstructions?: string;
  ownerPhoneNumber?: string;
}): string {
  const { userContext, additionalInstructions } = parseUserContext(data.userContextAndRules);
  const nicknameOrFullName = data.nickname && data.nickname.trim() 
    ? data.nickname.trim() 
    : data.fullName;

  const toneBlock = buildToneBlock(data.selectedTraits);
  const useCaseBlock = buildUseCaseBlock(data.useCaseChoice);
  const boundariesBlock = buildBoundariesBlock(data.boundaryChoices);

  // Handle file content section with explicit instructions to use specific details
  const fileContentSection = data.analyzedFileContent && data.analyzedFileContent.trim()
    ? `=== DETAILED INFORMATION ABOUT ${data.fullName} ===
The following information comes from ${data.fullName}'s professional documents (resume, CV, portfolio). This is your PRIMARY source of specific information about ${data.fullName}.

${data.analyzedFileContent}
${data.fileUsageInstructions && data.fileUsageInstructions.trim() ? `\n📝 USER INSTRUCTIONS FOR USING THIS INFORMATION:\n${data.fileUsageInstructions.trim()}\n` : ''}
⚠️ MANDATORY INSTRUCTIONS FOR USING THIS INFORMATION:

1. When asked ANY question about ${data.fullName}'s experience, background, achievements, or skills, you MUST reference the specific information from the sections above.

2. CRITICAL: Use ALL information from the sections, not just a subset:
   - From "WORK EXPERIENCE": Mention ALL companies and roles listed (e.g., if there are 3 companies, mention all 3)
   - From "KEY ACHIEVEMENTS": Reference multiple achievements, not just one
   - From "EDUCATION": Use exact institution, degree, and graduation year
   - From "LEADERSHIP & ACTIVITIES": Mention all leadership roles and activities listed

3. Use EXACT details from the sections:
   - Use exact company names, job titles, dates, and achievements with numbers
   - Cite specific achievements with exact numbers/percentages
   - Reference specific roles and achievements

4. SPEAK NATURALLY using the information:
   - GOOD FORMAT: "At [Company Name] as [Job Title], ${data.fullName} [specific achievement with numbers]. At [Another Company], they [another achievement]."
   - BAD: "They have consulting experience" or mentioning only one company
   - CRITICAL: Only use company names, institutions, and organizations that are explicitly listed in the sections above

5. When asked general questions like "What does ${data.fullName} do?" or "Tell me about ${data.fullName}":
   - Start with information from "WHO THEY ARE"
   - Then share ALL work experiences from "WORK EXPERIENCE" section - list each company, role, and key achievements
   - Include multiple specific achievements with numbers from "KEY ACHIEVEMENTS"
   - Mention leadership roles and activities from "LEADERSHIP & ACTIVITIES"
   - CRITICAL: Do not mention only one experience - you MUST share ALL experiences, companies, and achievements listed

6. NEVER say "I don't have that information" - the sections above contain your information source.

7. ALWAYS cite specific company names, job titles, dates, and numbers when available.

🚫 ABSOLUTELY FORBIDDEN:
- NEVER make up, invent, or guess information that is not in the sections above
- NEVER use generic or placeholder information (e.g., "graduated from a university", "worked at various companies")
- NEVER say information that contradicts what's in the file content section
- NEVER mention universities, schools, organizations, or activities that are NOT explicitly listed in the "EDUCATION" or "LEADERSHIP & ACTIVITIES" sections
- If information is NOT in the file content section, deflect naturally and professionally without mentioning files or documents (e.g., "I'm not sure about that specific detail" or redirect to what you DO know)
- ONLY use information that is explicitly stated in the sections above
- For EDUCATION: ONLY mention the exact institution, degree, and year from the "EDUCATION" section - do NOT mention any other schools or universities
- For LEADERSHIP & ACTIVITIES: ONLY mention roles and activities explicitly listed in the "LEADERSHIP & ACTIVITIES" section - do NOT invent or add any organizations or roles

`
    : '';

  // Format owner phone number for display (use provided or default message)
  const ownerPhoneNumber = data.ownerPhoneNumber || 'NOT PROVIDED - Owner recognition will not work until phone number is configured';

  let prompt = MASTER_SYSTEM_PROMPT_TEMPLATE
    .replace(/\{\{kendall_name\}\}/g, data.kendallName || 'Kendall')
    .replace(/\{\{full_name\}\}/g, data.fullName)
    .replace(/\{\{nickname_or_full_name\}\}/g, nicknameOrFullName)
    .replace(/\{\{tone_block\}\}/g, toneBlock)
    .replace(/\{\{use_case_block\}\}/g, useCaseBlock)
    .replace(/\{\{user_context\}\}/g, userContext)
    .replace(/\{\{file_content_section\}\}/g, fileContentSection)
    .replace(/\{\{boundaries_block\}\}/g, boundariesBlock)
    .replace(/\{\{owner_phone_number\}\}/g, ownerPhoneNumber);

  // Handle additional instructions section
  const additionalInstructionsSection = additionalInstructions
    ? `\n=== ADDITIONAL INSTRUCTIONS ===\n${additionalInstructions}\n`
    : '';

  prompt = prompt.replace(/\{\{additional_instructions_section\}\}/g, additionalInstructionsSection);

  return prompt;
}

/**
 * Build ultra-lean voice-first system prompt (100-180 tokens)
 * Voice-first format: no bullets, short sentences, essential instructions only
 */
export function buildLeanSystemPrompt(data: {
  kendallName: string;
  fullName: string;
  nickname?: string;
  selectedTraits: string[];
  boundaryChoices: string[];
}): string {
  const assistantName = data.kendallName || 'Kendall';
  const nicknameOrFullName = data.nickname && data.nickname.trim() 
    ? data.nickname.trim() 
    : data.fullName;

  // Build concise personality description (1-2 lines max)
  let personality = '';
  if (data.selectedTraits && data.selectedTraits.length > 0) {
    const traitNames = data.selectedTraits.slice(0, 3).join(', ');
    personality = `Personality: ${traitNames}.`;
  }

  // Build high-level boundaries (2-3 lines max)
  let boundaries = '';
  if (data.boundaryChoices && data.boundaryChoices.length > 0) {
    const boundarySummary = data.boundaryChoices.slice(0, 2).join(', ');
    boundaries = `Never reveal: ${boundarySummary}.`;
  }

  // Build voice-first prompt (single paragraph, no bullets, short sentences)
  const prompt = `You are ${assistantName}, assistant for ${nicknameOrFullName}. Keep responses short, one sentence at a time. Never pause more than 1 second. ${personality} You can make calls, take notes, read calendar, search contacts, get user context. Always call get_user_contacts when user asks to call someone. Always call get_user_context before making claims about user's background. At call start, call check_if_owner() immediately. If owner: greet by name, allow outbound calls. If not owner: greet normally. Only owner can request calls. Gather phone, message, when to call. Use make_outbound_call for immediate, schedule_outbound_call for future. ${boundaries} Never give medical, legal, or financial advice.`;

  return prompt.trim();
}

