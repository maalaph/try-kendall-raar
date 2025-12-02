/**
 * Sentiment Analysis
 * Analyzes user messages to understand mood, urgency, and emotional state
 */

export interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent' | 'frustrated';
  confidence: number;
  urgency?: 'low' | 'medium' | 'high';
  mood?: string;
  keywords?: string[];
}

/**
 * Analyze sentiment of a message
 */
export function analyzeSentiment(message: string): SentimentResult {
  const lowerMessage = message.toLowerCase();

  // Urgency indicators
  const urgentKeywords = ['urgent', 'asap', 'immediately', 'right now', 'hurry', 'emergency', 'important', 'critical'];
  const urgentCount = urgentKeywords.filter(kw => lowerMessage.includes(kw)).length;
  const isUrgent = urgentCount > 0;

  // Frustration indicators
  const frustrationKeywords = ['frustrated', 'annoyed', 'angry', 'upset', 'disappointed', 'problem', 'issue', 'wrong', 'broken'];
  const frustrationCount = frustrationKeywords.filter(kw => lowerMessage.includes(kw)).length;
  const isFrustrated = frustrationCount > 0;

  // Positive indicators
  const positiveKeywords = ['thanks', 'thank you', 'great', 'awesome', 'perfect', 'love', 'happy', 'excited', 'amazing'];
  const positiveCount = positiveKeywords.filter(kw => lowerMessage.includes(kw)).length;
  const isPositive = positiveCount > 0 && !isFrustrated;

  // Negative indicators
  const negativeKeywords = ['no', 'not', "don't", "can't", 'unable', 'failed', 'error', 'bad', 'worst'];
  const negativeCount = negativeKeywords.filter(kw => lowerMessage.includes(kw)).length;
  const isNegative = negativeCount > 2 || isFrustrated;

  // Determine sentiment
  let sentiment: SentimentResult['sentiment'] = 'neutral';
  let urgency: 'low' | 'medium' | 'high' = 'low';
  let confidence = 0.5;

  if (isUrgent) {
    sentiment = 'urgent';
    urgency = urgentCount > 1 ? 'high' : 'medium';
    confidence = Math.min(0.9, 0.6 + urgentCount * 0.1);
  } else if (isFrustrated) {
    sentiment = 'frustrated';
    urgency = frustrationCount > 2 ? 'high' : 'medium';
    confidence = Math.min(0.9, 0.7 + frustrationCount * 0.1);
  } else if (isPositive) {
    sentiment = 'positive';
    urgency = 'low';
    confidence = Math.min(0.9, 0.6 + positiveCount * 0.1);
  } else if (isNegative) {
    sentiment = 'negative';
    urgency = negativeCount > 3 ? 'medium' : 'low';
    confidence = Math.min(0.9, 0.6 + negativeCount * 0.05);
  } else {
    sentiment = 'neutral';
    urgency = 'low';
    confidence = 0.5;
  }

  // Extract keywords
  const keywords: string[] = [];
  if (urgentCount > 0) keywords.push(...urgentKeywords.filter(kw => lowerMessage.includes(kw)));
  if (frustrationCount > 0) keywords.push(...frustrationKeywords.filter(kw => lowerMessage.includes(kw)));
  if (positiveCount > 0) keywords.push(...positiveKeywords.filter(kw => lowerMessage.includes(kw)));

  return {
    sentiment,
    confidence,
    urgency,
    keywords: keywords.slice(0, 5), // Top 5 keywords
  };
}

/**
 * Get suggested response tone based on sentiment
 */
export function getResponseTone(sentiment: SentimentResult): {
  tone: 'calm' | 'empathetic' | 'enthusiastic' | 'supportive' | 'efficient';
  priority: 'low' | 'medium' | 'high';
} {
  switch (sentiment.sentiment) {
    case 'urgent':
      return { tone: 'efficient', priority: 'high' };
    case 'frustrated':
      return { tone: 'empathetic', priority: 'high' };
    case 'negative':
      return { tone: 'supportive', priority: 'medium' };
    case 'positive':
      return { tone: 'enthusiastic', priority: 'low' };
    default:
      return { tone: 'calm', priority: 'low' };
  }
}

