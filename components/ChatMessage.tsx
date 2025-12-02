'use client';

import { colors } from '@/lib/config';
import MarkdownRenderer from './MarkdownRenderer';

interface ChatMessageProps {
  message: string;
  role: 'user' | 'assistant';
  timestamp: string;
  attachments?: Array<{ url: string; filename: string }>;
}

export default function ChatMessage({ message, role, timestamp, attachments }: ChatMessageProps) {
  const isUser = role === 'user';
  
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

  return (
    <div
      className="flex w-full mb-6 animate-in fade-in duration-300"
      style={{
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        alignItems: 'flex-end',
        paddingLeft: 'clamp(1rem, 4vw, 2rem)',
        paddingRight: 'clamp(1rem, 4vw, 2rem)',
      }}
    >
      <div
        className="max-w-[75%] sm:max-w-[65%] rounded-xl px-5 py-3.5 transition-all"
        style={{
          backgroundColor: isUser 
            ? 'rgba(168, 85, 247, 0.15)'  // Darker purple for user (matching icon opacity style)
            : '#1a1a1a',      // Dark grey for agent
          color: colors.text,
          border: isUser 
            ? `1px solid rgba(168, 85, 247, 0.3)` 
            : `1px solid ${colors.accent}20`, // Subtle border for agent
        }}
      >
        {/* Message text */}
        <div
          className="break-words"
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '15px',
            lineHeight: '1.5',
            fontWeight: isUser ? 400 : 400,
            letterSpacing: '-0.01em',
            color: colors.text,
          }}
        >
          {!isUser && (message.includes('##') || message.includes('*') || message.includes('```')) ? (
            <MarkdownRenderer content={message} />
          ) : (
            <div className="whitespace-pre-wrap">{message}</div>
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
          className="text-xs mt-2"
          style={{
            color: colors.text,
            opacity: 0.4,
            textAlign: isUser ? 'right' : 'left',
            fontFamily: 'var(--font-inter), sans-serif',
            fontWeight: 400,
            letterSpacing: '0.01em',
          }}
        >
          {formattedTime}
        </div>
      </div>
    </div>
  );
}
