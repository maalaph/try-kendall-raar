'use client';

import { useState, useEffect } from 'react';
import { colors } from '@/lib/config';

interface MessageLeft {
  id: string;
  callerPhone: string;
  note: string;
  timestamp: string;
  read: boolean;
}

interface MessagesLeftPanelProps {
  recordId: string;
  onMessageClick?: (message: MessageLeft) => void;
}

export default function MessagesLeftPanel({ recordId, onMessageClick }: MessagesLeftPanelProps) {
  const [messages, setMessages] = useState<MessageLeft[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false); // Collapsible - starts collapsed by default

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/chat/messages-left?recordId=${encodeURIComponent(recordId)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setMessages(data.messages || []);
          }
        }
      } catch (error) {
        console.error('Failed to fetch messages left:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, [recordId]);

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleMessageClick = async (message: MessageLeft) => {
    if (onMessageClick) {
      onMessageClick(message);
    }
    
    // Mark as read
    try {
      await fetch(`/api/call-notes?recordId=${encodeURIComponent(recordId)}&markAsRead=true`);
      setMessages(prev => prev.map(m => m.id === message.id ? { ...m, read: true } : m));
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  };

  const unreadCount = messages.filter(m => !m.read).length;

  return (
    <div 
      className="h-full flex flex-col flex-shrink-0" 
      style={{ 
        backgroundColor: colors.secondary, 
        borderRight: `1px solid ${colors.accent}30`,
        width: isOpen ? '320px' : 'auto',
        minWidth: isOpen ? '320px' : 'auto',
      }}
    >
      {/* Collapsible Header - Mobile & Desktop */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 lg:p-3 flex items-center justify-between gap-2 transition-all flex-shrink-0"
        style={{
          backgroundColor: isOpen ? colors.secondary : colors.secondary,
          borderBottom: isOpen ? `1px solid ${colors.accent}30` : 'none',
          color: colors.text,
          width: isOpen ? '100%' : '60px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = `${colors.accent}10`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = colors.secondary;
        }}
      >
        <span style={{ fontFamily: 'var(--font-inter), sans-serif', fontWeight: 500, fontSize: '0.8125rem', opacity: 0.7, whiteSpace: 'nowrap' }}>
          {isOpen ? 'Messages Left' : 'Messages'}
          {unreadCount > 0 && ` (${unreadCount})`}
        </span>
        <span style={{ fontSize: '0.75rem', opacity: 0.5, flexShrink: 0 }}>{isOpen ? '▼' : '▶'}</span>
      </button>

      {/* Panel Content */}
      {isOpen && (
        <div
          className="flex-1 overflow-y-auto"
          style={{
            width: '100%',
            minWidth: '320px',
          }}
        >
        <div className="p-4">
          <h3
            className="mb-4"
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '1rem',
              fontWeight: 600,
              color: colors.text,
              opacity: 0.9,
            }}
          >
            Messages Left for You
          </h3>

          {loading ? (
            <div className="text-center py-8" style={{ color: colors.text, opacity: 0.6 }}>
              Loading...
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8" style={{ color: colors.text, opacity: 0.6 }}>
              No messages
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((message) => (
                <button
                  key={message.id}
                  onClick={() => handleMessageClick(message)}
                  className="w-full text-left p-3 rounded-lg transition-all"
                  style={{
                    backgroundColor: message.read ? 'transparent' : `${colors.accent}20`,
                    border: `1px solid ${message.read ? colors.accent + '20' : colors.accent + '50'}`,
                    color: colors.text,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${colors.accent}30`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = message.read ? 'transparent' : `${colors.accent}20`;
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-sm font-medium"
                      style={{ color: colors.accent }}
                    >
                      {formatPhone(message.callerPhone)}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: colors.text, opacity: 0.6 }}
                    >
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                  <p
                    className="text-sm line-clamp-2"
                    style={{
                      color: colors.text,
                      opacity: 0.9,
                      fontFamily: 'var(--font-inter), sans-serif',
                    }}
                  >
                    {message.note}
                  </p>
                  {!message.read && (
                    <div
                      className="mt-2 w-2 h-2 rounded-full"
                      style={{ backgroundColor: colors.accent }}
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

