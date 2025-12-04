'use client';

import { useState } from 'react';
import { colors } from '@/lib/config';
import { Phone, Calendar, MessageSquare, Clock, Sparkles, X } from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  color?: string;
}

interface QuickActionsProps {
  recordId: string;
  onActionSelect: (action: string) => void;
  assistantName?: string;
  className?: string;
}

export default function QuickActions({ 
  recordId, 
  onActionSelect,
  assistantName = 'Kendall',
  className = ''
}: QuickActionsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const defaultActions: QuickAction[] = [
    {
      id: 'make-call',
      label: 'Make Call',
      icon: <Phone size={18} />,
      action: () => onActionSelect('make-call'),
      color: colors.accent,
    },
    {
      id: 'schedule-call',
      label: 'Schedule Call',
      icon: <Clock size={18} />,
      action: () => onActionSelect('schedule-call'),
      color: colors.accent,
    },
    {
      id: 'check-schedule',
      label: 'Check Schedule',
      icon: <Calendar size={18} />,
      action: () => onActionSelect('check-schedule'),
      color: colors.accent,
    },
    {
      id: 'quick-message',
      label: 'Quick Message',
      icon: <MessageSquare size={18} />,
      action: () => onActionSelect('quick-message'),
      color: colors.accent,
    },
  ];

  if (!isExpanded) {
    return (
      <div className={className}>
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all"
          style={{
            backgroundColor: `${colors.accent}15`,
            border: `1px solid ${colors.accent}40`,
            color: colors.text,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${colors.accent}25`;
            e.currentTarget.style.borderColor = colors.accent;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `${colors.accent}15`;
            e.currentTarget.style.borderColor = `${colors.accent}40`;
          }}
        >
          <Sparkles size={18} style={{ color: colors.accent }} />
          <span
            className="text-sm font-medium"
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
            }}
          >
            Quick Actions
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`${className} animate-in fade-in slide-in-from-bottom-2 duration-200`}
      style={{
        animationDelay: '50ms',
      }}
    >
      <div
        className="rounded-xl p-4"
        style={{
          backgroundColor: `${colors.accent}10`,
          border: `1px solid ${colors.accent}30`,
          backdropFilter: 'blur(10px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: colors.accent }} />
            <span
              className="text-sm font-medium"
              style={{
                color: colors.text,
                fontFamily: 'var(--font-inter), sans-serif',
              }}
            >
              Quick Actions
            </span>
          </div>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 rounded-lg transition-all hover:bg-white/5"
            style={{ color: colors.text, opacity: 0.6 }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.6';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Actions Grid */}
        <div className="grid grid-cols-2 gap-2">
          {defaultActions.map((action) => (
            <button
              key={action.id}
              onClick={() => {
                action.action();
                setIsExpanded(false);
              }}
              className="flex flex-col items-center gap-2 p-3 rounded-lg transition-all"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                border: `1px solid ${action.color || colors.accent}40`,
                color: colors.text,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                e.currentTarget.style.borderColor = action.color || colors.accent;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
                e.currentTarget.style.borderColor = `${action.color || colors.accent}40`;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ color: action.color || colors.accent }}>
                {action.icon}
              </div>
              <span
                className="text-xs font-medium text-center"
                style={{
                  fontFamily: 'var(--font-inter), sans-serif',
                }}
              >
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}




