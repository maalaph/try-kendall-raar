/**
 * Curated Voice Sample Text Templates
 * Fixed templates per voice type for consistent, natural sample text
 * These are manually curated to ensure quality and consistency
 */

interface VoiceTemplateKey {
  ageGroup: 'young' | 'middle-aged' | 'older';
  gender: 'male' | 'female' | 'neutral';
  accent?: string;
  tone?: string; // Voice tone: 'energetic', 'calm', 'deep', 'bright', etc.
  character?: string; // Character type: 'pirate', 'detective', etc.
  clear?: boolean; // Clear/slow speech requested
  wisdom?: boolean; // Wisdom/thoughtful speech requested
}

/**
 * Get sample text template based on voice characteristics
 * Returns natural, conversational text that showcases the voice
 */
export function getVoiceSampleText(params: {
  ageGroup?: 'young' | 'middle-aged' | 'older';
  gender?: 'male' | 'female' | 'neutral';
  accent?: string;
  tone?: string; // Voice tone/energy
  character?: string; // Character type
  clear?: boolean; // Clear/slow speech
  wisdom?: boolean; // Wisdom/thoughtful
}): string {
  const { ageGroup = 'middle-aged', gender = 'neutral', accent, tone, character, clear, wisdom } = params;
  
  // Character-specific templates (highest priority)
  if (character) {
    const charLower = character.toLowerCase();
    if (charLower === 'pirate') {
      return "Ahoy there, matey! Welcome aboard this fine vessel. Let me tell you about the treasures we seek and the adventures that await us on the open seas. The wind is in our sails, and we're ready to set course for whatever destination you have in mind. What say you, friend?";
    }
    if (charLower === 'detective') {
      return "Let me walk you through the details of this case. I've been investigating this matter carefully, and I believe we're getting closer to the truth. Every piece of information matters, and I want to make sure we have all the facts before we proceed. What can you tell me about what happened?";
    }
    if (charLower === 'wizard' || charLower === 'wizard') {
      return "Greetings, traveler. I have been studying the ancient arts for many years, and I believe I can help you with your quest. The path ahead may be challenging, but with the right knowledge and guidance, we shall overcome any obstacle. What is it that you seek?";
    }
    if (charLower === 'ninja') {
      return "Silence is the key to understanding. I have trained in the ways of the shadow, and I can help you navigate the challenges ahead. Let us proceed with caution and precision, for every action must be deliberate and well-planned. What is your mission?";
    }
    if (charLower === 'narrator' || charLower === 'announcer') {
      return "Welcome, listeners. Today we have an important story to share with you. This tale has been carefully crafted to capture your attention and guide you through an experience that will both inform and inspire. Let us begin this journey together, step by step.";
    }
  }
  
  // Clear/slow speech templates (high priority)
  if (clear || wisdom) {
    if (ageGroup === 'older') {
      if (gender === 'male') {
        return "Let me speak with you clearly and thoughtfully. I've learned over the years that taking your time and choosing your words carefully makes all the difference. When we communicate with wisdom and patience, we can truly understand one another. Let me help you with that today, speaking slowly and deliberately so that every word is heard and understood.";
      } else if (gender === 'female') {
        return "Hello there, I want to make sure we communicate clearly today. I believe in speaking thoughtfully and taking the time to express ourselves properly. Let me help you with whatever you need, and I'll speak slowly and clearly so that we can have a meaningful conversation together.";
      }
      return "I want to speak with you clearly and thoughtfully today. Taking our time and choosing our words carefully will help us understand each other better. Let me help you with that, speaking slowly and deliberately so that every detail is clear and understood.";
    }
    // Clear/slow for other ages
    if (gender === 'male') {
      return "Let me speak with you clearly and carefully today. I want to make sure we understand each other completely, so I'll take my time and speak deliberately. Every word matters, and I want to ensure that you hear and understand everything I'm saying. How can I help you today?";
    } else if (gender === 'female') {
      return "Hello there, I want to communicate with you clearly and thoughtfully. I'll speak slowly and deliberately so that we can have a meaningful conversation. Let me help you with whatever you need, and I'll make sure to express myself clearly so that you understand everything I'm saying.";
    }
    return "Let me speak with you clearly and thoughtfully today. I want to make sure we understand each other completely, so I'll take my time and speak deliberately. Every word matters, and I want to ensure that you hear and understand everything I'm saying.";
  }
  
  // Template selection logic
  // Priority: age + gender + accent + tone combinations
  
  // Elderly/Older voices
  if (ageGroup === 'older') {
    if (gender === 'male') {
      return "Let me tell you a little story. When I was younger, the world felt a bit slower. But there's always something comforting about a calm conversation like this one. I've learned that taking your time and speaking clearly makes all the difference in how people understand you.";
    } else if (gender === 'female') {
      return "Hello there, it's so nice to speak with you today. I've always believed that a warm, clear conversation can make someone's day just a little bit better. Let me help you with whatever you need.";
    }
    return "I've been around long enough to know that good communication is about clarity and patience. Let me help you with that today, taking our time to make sure everything is understood perfectly.";
  }
  
  // Young voices
  if (ageGroup === 'young') {
    if (gender === 'male') {
      if (tone === 'energetic' || tone === 'bright') {
        return "Hey! It's really great to talk with you today. I'm excited to help you out and get things sorted. What can I do for you right now? Let's make this happen!";
      }
      return "Hey there! It's nice to connect with you today. I'm here to help with whatever you need, so just let me know how I can assist you. I'm ready when you are.";
    } else if (gender === 'female') {
      if (tone === 'energetic' || tone === 'bright') {
        return "Hey! It's really nice to talk with you today. I always like starting the day with a cheerful conversation and a relaxed tone. What can I help you with? I'm excited to assist!";
      }
      return "Hello! It's wonderful to speak with you. I'm here to help you today, so feel free to let me know what you need. I'll make sure we get everything sorted out for you.";
    }
    return "Hey there! I'm here to help you today. Let me know what you need and we'll get it sorted out together. I'm ready when you are.";
  }
  
  // Middle-aged voices (default)
  if (gender === 'male') {
    if (accent?.toLowerCase().includes('british')) {
      return "Right, hello there. I'd be delighted to help you with that today. Let me see what I can do for you. How may I assist you?";
    }
    if (accent?.toLowerCase().includes('indian')) {
      return "Hello! I'm excited to assist you today. Let me help you with whatever you need. What can I do for you right now?";
    }
    if (tone === 'deep' || tone === 'calm') {
      return "Hello there. I'm here to help you today with whatever you need. Take your time, and let me know how I can assist you. I'll make sure we get everything sorted.";
    }
    return "Hello, I'm here to help you today. What can I do for you? Let me know what you need and I'll take care of it for you.";
  } else if (gender === 'female') {
    if (accent?.toLowerCase().includes('british')) {
      return "Hello there, I'd be happy to help you with that. Let me see what I can do for you today. How may I assist you?";
    }
    if (tone === 'warm' || tone === 'calm') {
      return "Hello! It's so nice to speak with you today. I'm here to help you with whatever you need. Let me know how I can assist you, and we'll get everything sorted out.";
    }
    return "Hello there! I'm here to help you today. What can I do for you? Feel free to let me know what you need, and I'll make sure we take care of it.";
  }
  
  // Default/neutral
  return "Hello, I'm here to help you today. What can I do for you? Let me know what you need and I'll assist you with that. I'm ready when you are.";
}

/**
 * Generate sample text for voice preview
 * Ensures minimum 150 characters for ElevenLabs Voice Design API
 */
export function generateVoiceSampleText(params: {
  ageGroup?: 'young' | 'middle-aged' | 'older';
  gender?: 'male' | 'female' | 'neutral';
  accent?: string;
  tone?: string;
  character?: string;
  clear?: boolean;
  wisdom?: boolean;
}): string {
  let sampleText = getVoiceSampleText(params);
  
  // Ensure minimum 150 characters (ElevenLabs requirement)
  while (sampleText.length < 150) {
    sampleText += " This additional text ensures we have enough content to really demonstrate the voice characteristics and natural speaking pattern you're looking for.";
  }
  
  return sampleText;
}

