'use client';

import { colors } from '@/lib/config';
import MarkdownRenderer from './MarkdownRenderer';
import { useState, useEffect, useRef } from 'react';

interface ChatMessageProps {
  message: string;
  role: 'user' | 'assistant';
  timestamp: string;
  attachments?: Array<{ url: string; filename: string }>;
  isNewMessage?: boolean;
  isConsecutive?: boolean;
  isTyping?: boolean;
}

export default function ChatMessage({ 
  message, 
  role, 
  timestamp, 
  attachments, 
  isNewMessage = false,
  isConsecutive = false,
  isTyping = false
}: ChatMessageProps) {
  const isUser = role === 'user';
  const [displayedText, setDisplayedText] = useState('');
  const [showHover, setShowHover] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  const parallaxRef = useRef<HTMLDivElement>(null);
  
  // Format timestamp with relative time
  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };
  
  const formattedTime = formatTimestamp(timestamp);

  // Typewriter effect for new assistant messages
  useEffect(() => {
    if (isUser || !isNewMessage || isTyping) {
      setDisplayedText(message);
      return;
    }

    let currentIndex = 0;
    setDisplayedText('');
    
    const typeInterval = setInterval(() => {
      if (currentIndex < message.length) {
        setDisplayedText(message.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typeInterval);
      }
    }, 15); // 15ms delay for smooth typing

    return () => clearInterval(typeInterval);
  }, [message, isUser, isNewMessage, isTyping]);

  // Parallax effect on scroll (subtle, non-intrusive)
  useEffect(() => {
    if (isUser || !parallaxRef.current) return;

    const messageContainer = parallaxRef.current.closest('[data-messages-container]') || 
                             document.querySelector('[data-messages-container]');
    
    if (!messageContainer) return;

    const handleScroll = () => {
      if (!parallaxRef.current) return;
      const rect = parallaxRef.current.getBoundingClientRect();
      const containerRect = (messageContainer as HTMLElement).getBoundingClientRect();
      
      // Calculate position relative to container viewport
      const relativeTop = rect.top - containerRect.top;
      const containerHeight = containerRect.height;
      const scrollProgress = relativeTop / containerHeight;
      
      // Very subtle parallax transform (max 1px) - doesn't affect functionality
      const parallaxOffset = Math.sin(scrollProgress * Math.PI) * 1;
      parallaxRef.current.style.transform = `translateY(${parallaxOffset}px)`;
    };

    messageContainer.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial call

    return () => {
      messageContainer.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isUser]);

  // Determine spacing based on consecutive messages
  const marginBottom = isConsecutive ? 'mb-3' : 'mb-8';
  
  // Determine aura animation based on state
  const auraAnimation = isTyping 
    ? 'pulse-aura-typing' 
    : showHover 
    ? 'pulse-aura-hover' 
    : 'pulse-aura';

  const finalMessage = isUser || !isNewMessage || isTyping ? message : displayedText;

  return (
    <div
      ref={parallaxRef}
      className={`flex w-full ${marginBottom} group`}
      style={{
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        alignItems: 'flex-end',
        paddingLeft: 'clamp(1rem, 4vw, 2rem)',
        paddingRight: 'clamp(1rem, 4vw, 2rem)',
        willChange: isUser ? 'auto' : 'transform',
        animation: 'slide-in-message 0.3s ease-out',
      }}
      onMouseEnter={() => setShowHover(true)}
      onMouseLeave={() => setShowHover(false)}
    >
      <div
        ref={messageRef}
        className="relative max-w-[75%] sm:max-w-[65%] rounded-xl px-5 py-3.5 transition-all duration-300"
        style={{
          backgroundColor: isUser 
            ? 'rgba(168, 85, 247, 0.15)'
            : '#1a1a1a',
          color: colors.text,
          border: isUser 
            ? `1px solid rgba(168, 85, 247, 0.3)` 
            : `1px solid ${colors.accent}20`,
          // 3D depth with layered shadows
          boxShadow: showHover
            ? (isUser
                ? '0 8px 32px rgba(168, 85, 247, 0.3), 0 4px 16px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3)'
                : '0 8px 32px rgba(168, 85, 247, 0.2), 0 4px 16px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3)')
            : '0 2px 8px rgba(0, 0, 0, 0.2), 0 1px 4px rgba(0, 0, 0, 0.1)',
          transform: showHover ? 'translateY(-2px)' : 'translateY(0)',
          backfaceVisibility: 'hidden',
        }}
      >
        {/* Subtle pulsing purple aura for assistant messages */}
        {!isUser && (
          <div
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: `radial-gradient(circle at center, ${colors.accent}15 0%, transparent 70%)`,
              animation: `${auraAnimation} 2s ease-in-out infinite`,
              zIndex: 0,
            }}
          />
        )}

        {/* Message content - above aura */}
        <div className="relative z-10">
          {/* Message text */}
          <div
            className="break-words"
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '15px',
              lineHeight: '1.7',
              fontWeight: 400,
              letterSpacing: '-0.01em',
              color: colors.text,
              marginBottom: '8px',
            }}
          >
            {!isUser && (finalMessage.includes('##') || finalMessage.includes('*') || finalMessage.includes('```')) ? (
              <MarkdownRenderer content={finalMessage} />
            ) : (
              <div className="whitespace-pre-wrap" style={{ lineHeight: '1.7' }}>
                {isTyping ? (
                  <div className="flex items-center gap-1">
                    <span>{finalMessage}</span>
                    <span 
                      className="inline-block w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: colors.accent,
                        animation: 'typing-dots 1.4s ease-in-out infinite',
                      }}
                    />
                  </div>
                ) : (
                  finalMessage
                )}
              </div>
            )}
          </div>

        {/* Attachments */}
        {attachments && attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {attachments.map((attachment, idx) => (
              <a
                key={idx}
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-lg transition-all"
                style={{
                  backgroundColor: isUser 
                    ? 'rgba(0, 0, 0, 0.2)' 
                    : `${colors.accent}15`,
                  textDecoration: 'none',
                  color: colors.text,
                  border: `1px solid ${colors.accent}30`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isUser 
                    ? 'rgba(0, 0, 0, 0.3)' 
                    : `${colors.accent}25`;
                  e.currentTarget.style.borderColor = colors.accent;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isUser 
                    ? 'rgba(0, 0, 0, 0.2)' 
                    : `${colors.accent}15`;
                  e.currentTarget.style.borderColor = `${colors.accent}30`;
                }}
              >
                <span 
                  className="text-sm flex items-center gap-2"
                  style={{
                    color: colors.text,
                    opacity: 0.9,
                  }}
                >
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {attachment.filename}
                </span>
              </a>
            ))}
          </div>
        )}

          {/* Timestamp */}
          <div
            className="text-xs relative z-10"
            style={{
              color: colors.text,
              opacity: 0.4,
              textAlign: isUser ? 'right' : 'left',
              fontFamily: 'var(--font-inter), sans-serif',
              fontWeight: 400,
              letterSpacing: '0.01em',
              marginTop: '4px',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.4'}
          >
            {formattedTime}
          </div>
        </div>
      </div>
    </div>
  );
}
