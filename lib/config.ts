import raarConfig from '../raar_master.json';

// Type definitions for RAAR config
export interface RAARConfig {
  brand: {
    name: string;
    platforms: string[];
    link_in_bio_role: string;
    voice: {
      tone: string;
      style: string;
      avoid: string[];
    };
    visual: {
      palette: {
        primary: string;
        accent: string;
        secondary: string;
        text: string;
      };
      vibe: string;
      calendar_style: string;
    };
    philosophy: {
      belief: string;
      obsession: string;
      emotional_reaction_target: string[];
      identity: string;
    };
  };
  product: {
    name: string;
    type: string;
    phone_number?: string;
    personality: {
      tone: string;
      jokes: string;
      goals: string[];
    };
    core_capabilities: string[];
    current_state: {
      backend: string;
      dashboard: string;
      landing_page: string;
      demo_video: string;
      sales_assets: string[];
      stack: string[];
    };
  };
  target_market: {
    ideal_clients: string[];
    dominant_pain_points: string[];
    emotional_drivers: string[];
  };
  positioning: {
    differentiation: string[];
    core_pitch: string;
  };
  landing_page: {
    purpose: string;
    hero: {
      layout: string;
      left: string;
      right: {
        headline: string;
        bullets: string[];
        cta: string;
      };
    };
    booking_section: {
      headline: string;
      fields_required_before_demo: string[];
      calendar_ui: string;
      notes: string;
    };
  };
  demo_process: {
    info_needed: string[];
    flow: string[];
    signature_moment: string;
  };
  lead_quality: {
    red_flags: string[];
    ideal_flags: string[];
  };
  what_raar_is_not: string[];
  future: {
    '12_month_goal': string;
    long_term: string[];
  };
}

export const config: RAARConfig = raarConfig as RAARConfig;

// Export commonly used values for convenience
export const colors = config.brand.visual.palette;
export const heroContent = config.landing_page.hero;
export const bookingContent = config.landing_page.booking_section;
export const brandVoice = config.brand.voice;
export const kendallPhoneNumber = config.product.phone_number || '';

