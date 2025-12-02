'use client';

import { useState, useRef, useEffect } from 'react';
import { colors } from '@/lib/config';
import { 
  Paperclip, 
  Mic, 
  ArrowUp,
  Sparkles
} from 'lucide-react';
import VoiceRecorder from './VoiceRecorder';

// Helper function to get placeholder text for pending actions
function getPendingActionPlaceholder(action: string): string {
  switch (action) {
    case 'make-call':
      return 'Enter phone number and message...';
    case 'schedule-call':
      return 'Enter phone number, message, and time...';
    case 'quick-message':
      return 'Enter message to send...';
    default:
      return 'Enter details...';
  }
}

interface ChatInputProps {
  onSend: (message: string) => void;
  onFileUpload: (files: File[]) => void;
  isSending?: boolean;
  isUploading?: boolean;
  assistantName?: string;
  pendingAction?: string | null;
  onClearPendingAction?: () => void;
  onVoiceMessage?: (audioBlob: Blob, transcript?: string) => void;
}

export default function ChatInput({ onSend, onFileUpload, isSending = false, isUploading = false, assistantName = 'Kendall', pendingAction, onClearPendingAction, onVoiceMessage }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 200; // Max 200px (~8 lines)
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      if (scrollHeight > maxHeight) {
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.overflowY = 'hidden';
      }
    }
  }, [message]);

  // Focus textarea when pending action is set
  useEffect(() => {
    if (pendingAction && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [pendingAction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isSending) {
      onSend(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      // Clear pending action after sending
      if (onClearPendingAction) {
        onClearPendingAction();
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFileUpload(files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="w-full flex justify-center px-4" style={{ paddingBottom: '40px', paddingTop: '20px' }}>
      <form onSubmit={handleSubmit} className="w-full max-w-6xl">
        {/* Main Container */}
        <div
          className="relative flex items-center gap-4 rounded-3xl transition-colors duration-300"
          style={{
            backgroundColor: isFocused ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.02)',
            border: `2px solid ${isFocused ? `${colors.accent}60` : 'rgba(255, 255, 255, 0.1)'}`,
            boxShadow: isFocused 
              ? `0 12px 48px rgba(0, 0, 0, 0.4)` 
              : '0 8px 32px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(16px)',
            padding: '20px 0',
            animation: isFocused 
              ? 'chat-input-breathe-focused 4s ease-in-out infinite' 
              : 'chat-input-breathe 4s ease-in-out infinite',
          }}
        >
          {/* Left side - minimal icons */}
          <div className="flex items-center gap-3 pl-6 flex-shrink-0" style={{ transform: 'translateY(-1px)' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isSending}
              className="p-2.5 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed group"
              style={{
                color: colors.accent,
                opacity: 0.7,
              }}
              onMouseEnter={(e) => {
                if (!isUploading && !isSending) {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.backgroundColor = `${colors.accent}15`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isUploading && !isSending) {
                  e.currentTarget.style.opacity = '0.7';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Paperclip size={24} />
            </button>

            <button
              type="button"
              onClick={() => {
                if (onVoiceMessage) {
                  setShowVoiceRecorder(true);
                }
              }}
              className="p-2.5 rounded-xl transition-all duration-200 group"
              style={{
                color: colors.accent,
                opacity: 0.7,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.backgroundColor = `${colors.accent}15`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.7';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Mic size={24} />
            </button>
          </div>

          {/* Textarea */}
          <div className="flex-1 min-w-0 flex items-center">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder={pendingAction ? getPendingActionPlaceholder(pendingAction) : `Message ${assistantName}...`}
              disabled={isSending || isUploading}
              rows={1}
              className="w-full bg-transparent border-0 outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed scrollbar-thin placeholder:opacity-50"
              style={{
                color: colors.text,
                fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: '18px',
                lineHeight: '1.6',
                padding: '0',
                minHeight: '28px',
                maxHeight: '240px',
                transition: 'height 0.2s ease-out',
              }}
            />
          </div>

          {/* Send Button */}
          <div className="pr-6 flex-shrink-0">
            <button
              type="submit"
              disabled={!message.trim() || isSending || isUploading}
              className="group relative rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
              style={{
                backgroundColor: message.trim() && !isSending 
                  ? colors.accent 
                  : 'rgba(255, 255, 255, 0.08)',
                color: message.trim() && !isSending 
                  ? '#ffffff' 
                  : colors.text,
                width: '52px',
                height: '52px',
                padding: '0',
              }}
              onMouseEnter={(e) => {
                if (message.trim() && !isSending) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = `0 4px 16px ${colors.accent}50`;
                }
              }}
              onMouseLeave={(e) => {
                if (message.trim() && !isSending) {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              {isSending ? (
                <div 
                  className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" 
                />
              ) : message.trim() ? (
                <ArrowUp size={24} strokeWidth={2.5} />
              ) : (
                <Sparkles size={24} style={{ opacity: 0.6 }} />
              )}
            </button>
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.txt,.doc,.docx"
        />

        {/* Pending action indicator */}
        {pendingAction && (
          <div 
            className="mt-3 px-4 py-2 rounded-lg text-sm transition-opacity duration-200 flex items-center justify-between gap-2"
            style={{ 
              backgroundColor: `${colors.accent}15`,
              border: `1px solid ${colors.accent}40`,
              color: colors.text,
              fontFamily: 'var(--font-inter), sans-serif',
            }}
          >
            <span style={{ opacity: 0.9 }}>
              {pendingAction === 'make-call' && '✓ Ready to make a call...'}
              {pendingAction === 'schedule-call' && '✓ Ready to schedule a call...'}
              {pendingAction === 'quick-message' && '✓ Ready to send a message...'}
            </span>
            {onClearPendingAction && (
              <button
                onClick={onClearPendingAction}
                className="px-2 py-1 rounded text-xs transition-all hover:bg-white/10"
                style={{ opacity: 0.7 }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.7';
                }}
              >
                Cancel
              </button>
            )}
          </div>
        )}

        {/* Helper text - centered */}
        {!isFocused && !message && !pendingAction && (
          <div 
            className="mt-4 text-center text-sm transition-opacity duration-200"
            style={{ 
              color: colors.text, 
              opacity: 0.35,
              fontFamily: 'var(--font-inter), sans-serif',
            }}
          >
            Press Enter to send, Shift + Enter for new line
          </div>
        )}

        {/* Voice Recorder Modal */}
        {showVoiceRecorder && onVoiceMessage && (
          <VoiceRecorder
            assistantName={assistantName}
            onRecordingComplete={(audioBlob, transcript) => {
              setShowVoiceRecorder(false);
              if (transcript) {
                onSend(transcript);
              } else if (onVoiceMessage) {
                onVoiceMessage(audioBlob);
              }
            }}
            onCancel={() => setShowVoiceRecorder(false)}
          />
        )}
      </form>
    </div>
  );
}
