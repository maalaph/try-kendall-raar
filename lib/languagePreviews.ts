/**
 * Language preview texts for voice generation
 * All texts are professional and showcase voice quality
 * ElevenLabs multilingual_v2 supports 70+ languages
 */

export interface LanguagePreview {
  code: string;
  name: string;
  text: string;
}

export const LANGUAGE_PREVIEWS: Record<string, LanguagePreview> = {
  'en': {
    code: 'en',
    name: 'English',
    text: "Hello, this is how your Kendall will sound. I'm here to help manage your calls and represent you professionally.",
  },
  'es': {
    code: 'es',
    name: 'Spanish',
    text: "Hola, así es como sonará tu Kendall. Estoy aquí para ayudar a gestionar tus llamadas y representarte profesionalmente.",
  },
  'ar': {
    code: 'ar',
    name: 'Arabic',
    text: "مرحباً، هكذا سيبدو صوت كيندال الخاص بك. أنا هنا للمساعدة في إدارة مكالماتك وتمثيلك بشكل احترافي.",
  },
  'fr': {
    code: 'fr',
    name: 'French',
    text: "Bonjour, voici comment votre Kendall sonnera. Je suis ici pour vous aider à gérer vos appels et vous représenter professionnellement.",
  },
  'de': {
    code: 'de',
    name: 'German',
    text: "Hallo, so wird Ihre Kendall klingen. Ich bin hier, um Ihnen bei der Verwaltung Ihrer Anrufe zu helfen und Sie professionell zu vertreten.",
  },
  'it': {
    code: 'it',
    name: 'Italian',
    text: "Ciao, ecco come suonerà la tua Kendall. Sono qui per aiutarti a gestire le tue chiamate e rappresentarti professionalmente.",
  },
  'pt': {
    code: 'pt',
    name: 'Portuguese',
    text: "Olá, é assim que sua Kendall vai soar. Estou aqui para ajudar a gerenciar suas chamadas e representá-lo profissionalmente.",
  },
  'zh': {
    code: 'zh',
    name: 'Chinese',
    text: "你好，这就是你的Kendall的声音。我在这里帮助您管理电话并专业地代表您。",
  },
  'ja': {
    code: 'ja',
    name: 'Japanese',
    text: "こんにちは、これがあなたのケンダルの音です。私はあなたの電話を管理し、あなたを専門的に代表するためにここにいます。",
  },
  'ko': {
    code: 'ko',
    name: 'Korean',
    text: "안녕하세요, 이것이 당신의 켄달의 소리입니다. 전화를 관리하고 전문적으로 대표하는 데 도움을 드리기 위해 여기에 있습니다.",
  },
  'hi': {
    code: 'hi',
    name: 'Hindi',
    text: "नमस्ते, यह आपकी केंडल की आवाज़ होगी। मैं यहाँ आपकी कॉल प्रबंधित करने और आपका पेशेवर रूप से प्रतिनिधित्व करने में मदद करने के लिए हूँ।",
  },
  'nl': {
    code: 'nl',
    name: 'Dutch',
    text: "Hallo, zo zal uw Kendall klinken. Ik ben hier om u te helpen bij het beheren van uw oproepen en u professioneel te vertegenwoordigen.",
  },
  'pl': {
    code: 'pl',
    name: 'Polish',
    text: "Cześć, tak będzie brzmieć twoja Kendall. Jestem tutaj, aby pomóc w zarządzaniu twoimi połączeniami i profesjonalnie cię reprezentować.",
  },
  'ru': {
    code: 'ru',
    name: 'Russian',
    text: "Привет, так будет звучать твоя Кендалл. Я здесь, чтобы помочь управлять твоими звонками и профессионально представлять тебя.",
  },
  'tr': {
    code: 'tr',
    name: 'Turkish',
    text: "Merhaba, Kendall'ınız böyle seslenecek. Aramalarınızı yönetmenize ve sizi profesyonelce temsil etmenize yardımcı olmak için buradayım.",
  },
};

/**
 * Get preview text for a language code
 */
export function getLanguagePreview(languageCode: string): string {
  const preview = LANGUAGE_PREVIEWS[languageCode.toLowerCase()];
  if (preview) {
    return preview.text;
  }
  // Fallback to English
  return LANGUAGE_PREVIEWS['en'].text;
}

/**
 * Get all available language codes
 */
export function getAvailableLanguages(): string[] {
  return Object.keys(LANGUAGE_PREVIEWS);
}

/**
 * Get language name for display
 */
export function getLanguageName(languageCode: string): string {
  const preview = LANGUAGE_PREVIEWS[languageCode.toLowerCase()];
  return preview ? preview.name : 'English';
}










