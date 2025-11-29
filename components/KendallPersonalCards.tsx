'use client';

import { colors } from '@/lib/config';
import { User, Phone, Sparkles, Shield, Zap } from 'lucide-react';

export default function KendallPersonalCards() {
  const cards = [
    {
      icon: <User className="w-6 h-6" />,
      title: 'Bio & CV Assistant',
      description: (
        <>
          Put <span style={{ color: colors.accent, fontFamily: 'var(--font-league-spartan), sans-serif', fontWeight: 700 }}>Kendall</span> in your LinkedIn or Instagram bio. She introduces you, explains who you are, and forwards opportunities to you.
        </>
      ),
    },
    {
      icon: <Phone className="w-6 h-6" />,
      title: 'Your Second Number',
      description: (
        <>
          A clean, separate number for your socials, CV, dating apps, or website. <span style={{ color: colors.accent, fontFamily: 'var(--font-league-spartan), sans-serif', fontWeight: 700 }}>Kendall</span> answers so you don't have to.
        </>
      ),
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: 'Talks Like You',
      description: (
        <>
          <span style={{ color: colors.accent, fontFamily: 'var(--font-league-spartan), sans-serif', fontWeight: 700 }}>Kendall</span> mirrors your tone and vibe — friendly, professional, sarcastic, or anything in between.
        </>
      ),
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Handle Awkward Calls',
      description: (
        <>
          Let <span style={{ color: colors.accent, fontFamily: 'var(--font-league-spartan), sans-serif', fontWeight: 700 }}>Kendall</span> pick up when you'd rather not. She filters, softens the interaction, and keeps you unbothered.
        </>
      ),
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Instant Call Forwarding',
      description: (
        <>
          <span style={{ color: colors.accent, fontFamily: 'var(--font-league-spartan), sans-serif', fontWeight: 700 }}>Kendall</span> can forward important calls straight to your real phone — only when you want.
        </>
      ),
    },
  ];

  return (
    <section 
      id="personal-section" 
      className="w-full relative overflow-hidden"
      style={{ 
        padding: 'clamp(4rem, 8vw, 8rem) clamp(2rem, 6vw, 8rem)',
        backgroundColor: colors.primary,
      }}
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 lg:mb-16">
          <h2
            style={{ 
              color: colors.text, 
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: 'clamp(2.5rem, 5vw, 4rem)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              lineHeight: '1.2',
              margin: 0,
              marginBottom: '1rem',
            }}
          >
            <span style={{ color: colors.text }}>My</span><span style={{ color: colors.accent, fontFamily: 'var(--font-league-spartan), sans-serif', fontWeight: 700 }}>Kendall</span>
          </h2>
          <p
            style={{
              color: colors.text,
              opacity: 0.9,
              fontSize: '1rem',
              fontFamily: 'var(--font-inter), sans-serif',
              margin: 0,
            }}
          >
            A smarter number for your everyday life.
          </p>
        </div>

        {/* Card Grid */}
        {/* First Row: 3 cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-8 mb-8">
          {cards.slice(0, 3).map((card, index) => (
            <div
              key={index}
              className="bg-white/5 border border-purple-500/20 rounded-xl p-6 sm:p-8 lg:p-12 shadow-lg shadow-purple-500/10 flex flex-col gap-4 text-center lg:text-left"
              style={{ color: colors.text }}
            >
              <div className="flex justify-center lg:justify-start" style={{ color: colors.accent }}>
                {card.icon}
              </div>
              <h3 className="text-lg font-semibold tracking-tight" style={{ color: colors.text }}>
                {card.title}
              </h3>
              <p className="text-sm text-white/70">
                {card.description}
              </p>
            </div>
          ))}
        </div>

        {/* Second Row: 2 cards centered */}
        <div className="flex flex-col lg:flex-row lg:justify-center gap-8 mb-10">
          {cards.slice(3, 5).map((card, index) => (
            <div
              key={index + 3}
              className="bg-white/5 border border-purple-500/20 rounded-xl p-6 sm:p-8 lg:p-12 shadow-lg shadow-purple-500/10 flex flex-col gap-4 text-center lg:text-left w-full lg:w-auto"
              style={{ color: colors.text, maxWidth: '750px' }}
            >
              <div className="flex justify-center lg:justify-start" style={{ color: colors.accent }}>
                {card.icon}
              </div>
              <h3 className="text-lg font-semibold tracking-tight" style={{ color: colors.text }}>
                {card.title}
              </h3>
              <p className="text-sm text-white/70">
                {card.description}
              </p>
            </div>
          ))}
        </div>

        {/* Micro Benefits Row */}
        <p className="text-sm text-white/60 text-center mt-10" style={{ opacity: 0.7 }}>
          No subscriptions · Pay-as-you-go · Instant activation · Fully customizable
        </p>
      </div>
    </section>
  );
}

