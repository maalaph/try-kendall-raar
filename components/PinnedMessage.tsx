'use client';

import { useState } from 'react';
import { colors } from '@/lib/config';
import { Pin, PinOff } from 'lucide-react';

interface PinnedMessageProps {
  messageId: string;
  message: string;
  isPinned: boolean;
  onTogglePin: (messageId: string, pinned: boolean) => void;
  timestamp: string;
}

export default function PinnedMessage({ 
  messageId, 
  message, 
  isPinned, 
  onTogglePin,
  timestamp 
}: PinnedMessageProps) {
  const handleToggle = () => {
    onTogglePin(messageId, !isPinned);
  };

  if (!isPinned) return null;

  return (
    <div
      className="mb-4 p-4 rounded-xl border-l-4"
      style={{
        backgroundColor: `${colors.accent}10`,
        borderLeftColor: colors.accent,
        border: `1px solid ${colors.accent}30`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Pin size={16} style={{ color: colors.accent }} />
            <span
              className="text-xs font-medium"
              style={{
                color: colors.accent,
                fontFamily: 'var(--font-inter), sans-serif',
              }}
            >
              Pinned Message
            </span>
          </div>
          <div
            className="text-sm"
            style={{
              color: colors.text,
              fontFamily: 'var(--font-inter), sans-serif',
            }}
          >
            {message.substring(0, 200)}{message.length > 200 ? '...' : ''}
          </div>
          <div
            className="text-xs mt-2"
            style={{
              color: colors.text,
              opacity: 0.5,
            }}
          >
            {new Date(timestamp).toLocaleString()}
          </div>
        </div>
        <button
          onClick={handleToggle}
          className="p-2 rounded-lg transition-all"
          style={{
            color: colors.accent,
            backgroundColor: `${colors.accent}15`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${colors.accent}25`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `${colors.accent}15`;
          }}
        >
          <PinOff size={16} />
        </button>
      </div>
    </div>
  );
}




