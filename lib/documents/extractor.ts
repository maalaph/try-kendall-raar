/**
 * Document Data Extractor
 * AI-powered extraction of structured data from documents
 */

import OpenAI from 'openai';

export interface ExtractedProfile {
  name?: string;
  title?: string;
  summary?: string;
  skills?: string[];
  experience?: ExperienceEntry[];
  education?: EducationEntry[];
  achievements?: string[];
  certifications?: string[];
  languages?: string[];
  interests?: string[];
  contactInfo?: {
    email?: string;
    phone?: string;
    linkedin?: string;
    website?: string;
    location?: string;
  };
  industry?: string;
  yearsOfExperience?: number;
  metadata?: Record<string, any>;
}

export interface ExperienceEntry {
  company: string;
  title: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description?: string;
  achievements?: string[];
}

export interface EducationEntry {
  institution: string;
  degree?: string;
  field?: string;
  graduationYear?: string;
  gpa?: string;
  honors?: string[];
}

export interface ExtractionResult {
  success: boolean;
  profile?: ExtractedProfile;
  rawExtraction?: Record<string, any>;
  error?: string;
}

/**
 * Extract structured data from document content using AI
 */
export async function extractProfileData(
  content: string,
  documentType: 'resume' | 'profile' | 'general' = 'general'
): Promise<ExtractionResult> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  const systemPrompt = getExtractionPrompt(documentType);
  
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_EXTRACTION_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content },
      ],
      temperature: 0.1, // Low temperature for consistent extraction
      response_format: { type: 'json_object' },
    });
    
    const extractedText = response.choices[0]?.message?.content;
    if (!extractedText) {
      return {
        success: false,
        error: 'No extraction result from AI',
      };
    }
    
    const rawExtraction = JSON.parse(extractedText);
    const profile = transformToProfile(rawExtraction);
    
    return {
      success: true,
      profile,
      rawExtraction,
    };
  } catch (error) {
    console.error('[EXTRACTOR] Extraction failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Extraction failed',
    };
  }
}

/**
 * Get extraction prompt based on document type
 */
function getExtractionPrompt(documentType: string): string {
  const basePrompt = `You are a document analysis expert. Extract structured information from the provided document content.

Return a JSON object with the following fields (include only fields that have data):
- name: Person's full name
- title: Current or most recent job title
- summary: Brief professional summary (2-3 sentences)
- skills: Array of skills mentioned
- experience: Array of work experience objects with: company, title, startDate, endDate, current, description, achievements
- education: Array of education objects with: institution, degree, field, graduationYear, gpa, honors
- achievements: Array of notable achievements
- certifications: Array of certifications
- languages: Array of languages spoken
- interests: Array of professional interests
- contactInfo: Object with email, phone, linkedin, website, location
- industry: Primary industry
- yearsOfExperience: Total years of professional experience (number)

Guidelines:
- Be accurate and extract only information explicitly stated
- Format dates consistently (e.g., "Jan 2020" or "2020")
- Keep skills concise and specific
- Include quantifiable achievements where mentioned
- If a field has no data, omit it entirely`;

  if (documentType === 'resume') {
    return `${basePrompt}

This is a resume/CV document. Pay special attention to:
- Work experience with specific dates and achievements
- Education credentials
- Technical and soft skills
- Certifications and awards`;
  }
  
  if (documentType === 'profile') {
    return `${basePrompt}

This is a professional profile or bio. Focus on:
- Current role and expertise
- Key achievements and highlights
- Professional background summary`;
  }
  
  return basePrompt;
}

/**
 * Transform raw extraction to standardized profile format
 */
function transformToProfile(raw: Record<string, any>): ExtractedProfile {
  const profile: ExtractedProfile = {};
  
  // Direct mappings
  if (raw.name) profile.name = String(raw.name);
  if (raw.title) profile.title = String(raw.title);
  if (raw.summary) profile.summary = String(raw.summary);
  if (raw.industry) profile.industry = String(raw.industry);
  if (typeof raw.yearsOfExperience === 'number') {
    profile.yearsOfExperience = raw.yearsOfExperience;
  }
  
  // Array fields
  if (Array.isArray(raw.skills)) {
    profile.skills = raw.skills.map(String).filter(Boolean);
  }
  if (Array.isArray(raw.achievements)) {
    profile.achievements = raw.achievements.map(String).filter(Boolean);
  }
  if (Array.isArray(raw.certifications)) {
    profile.certifications = raw.certifications.map(String).filter(Boolean);
  }
  if (Array.isArray(raw.languages)) {
    profile.languages = raw.languages.map(String).filter(Boolean);
  }
  if (Array.isArray(raw.interests)) {
    profile.interests = raw.interests.map(String).filter(Boolean);
  }
  
  // Experience entries
  if (Array.isArray(raw.experience)) {
    profile.experience = raw.experience.map((exp: any) => ({
      company: String(exp.company || ''),
      title: String(exp.title || ''),
      startDate: exp.startDate,
      endDate: exp.endDate,
      current: exp.current || false,
      description: exp.description,
      achievements: Array.isArray(exp.achievements) 
        ? exp.achievements.map(String) 
        : undefined,
    })).filter((exp: ExperienceEntry) => exp.company || exp.title);
  }
  
  // Education entries
  if (Array.isArray(raw.education)) {
    profile.education = raw.education.map((edu: any) => ({
      institution: String(edu.institution || ''),
      degree: edu.degree,
      field: edu.field,
      graduationYear: edu.graduationYear,
      gpa: edu.gpa,
      honors: Array.isArray(edu.honors) ? edu.honors.map(String) : undefined,
    })).filter((edu: EducationEntry) => edu.institution);
  }
  
  // Contact info
  if (raw.contactInfo && typeof raw.contactInfo === 'object') {
    profile.contactInfo = {
      email: raw.contactInfo.email,
      phone: raw.contactInfo.phone,
      linkedin: raw.contactInfo.linkedin,
      website: raw.contactInfo.website,
      location: raw.contactInfo.location,
    };
    // Remove empty contact info
    if (!Object.values(profile.contactInfo).some(Boolean)) {
      delete profile.contactInfo;
    }
  }
  
  return profile;
}

/**
 * Generate a natural language summary from extracted profile
 */
export function generateProfileSummary(profile: ExtractedProfile): string {
  const parts: string[] = [];
  
  if (profile.name && profile.title) {
    parts.push(`${profile.name} is a ${profile.title}`);
  } else if (profile.name) {
    parts.push(profile.name);
  }
  
  if (profile.industry) {
    parts.push(`working in ${profile.industry}`);
  }
  
  if (profile.yearsOfExperience && profile.yearsOfExperience > 0) {
    parts.push(`with ${profile.yearsOfExperience} years of experience`);
  }
  
  if (parts.length === 0 && profile.summary) {
    return profile.summary;
  }
  
  let summary = parts.join(' ') + '.';
  
  if (profile.skills && profile.skills.length > 0) {
    const topSkills = profile.skills.slice(0, 5);
    summary += ` Key skills include ${topSkills.join(', ')}.`;
  }
  
  if (profile.experience && profile.experience.length > 0) {
    const recent = profile.experience[0];
    if (recent.current) {
      summary += ` Currently at ${recent.company}.`;
    } else {
      summary += ` Most recently at ${recent.company}.`;
    }
  }
  
  return summary;
}

/**
 * Extract skills from content using pattern matching
 * Faster alternative when AI extraction is not needed
 */
export function extractSkillsQuick(content: string): string[] {
  const commonSkills = [
    // Programming
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Ruby', 'Go', 'Rust', 'PHP', 'Swift', 'Kotlin',
    // Frameworks
    'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'Rails', 'Next.js',
    // Data
    'SQL', 'NoSQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Elasticsearch',
    // Cloud
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform',
    // Tools
    'Git', 'Jenkins', 'CI/CD', 'Jira', 'Agile', 'Scrum',
    // Soft skills
    'Leadership', 'Communication', 'Problem Solving', 'Team Management', 'Project Management',
  ];
  
  const found: string[] = [];
  const lowerContent = content.toLowerCase();
  
  for (const skill of commonSkills) {
    if (lowerContent.includes(skill.toLowerCase())) {
      found.push(skill);
    }
  }
  
  return found;
}

