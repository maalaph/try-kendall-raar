'use client';

import { useState, useEffect } from 'react';
import { colors } from '@/lib/config';

interface ActiveCallBannerProps {
  callId: string;
  status: 'ringing' | 'in-progress' | 'ended' | 'cancelled' | 'failed';
  phoneNumber: string;
  contactName?: string;
  startTime: string; // ISO timestamp
  onCancel: () => void;
  onDismiss: () => void;
}

export default function ActiveCallBanner({
  callId,
  status,
  phoneNumber,
  contactName,
  startTime,
  onCancel,
  onDismiss,
}: ActiveCallBannerProps) {
  const [timer, setTimer] = useState('00:00');
  const [isCancelling, setIsCancelling] = useState(false);

  // Format phone number for display
  const formatPhoneNumber = (phone: string): string => {
    // Remove +1 prefix if present
    const cleaned = phone.replace(/^\+1/, '').replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const displayName = contactName || formatPhoneNumber(phoneNumber);

  // Timer calculation - client-side
  useEffect(() => {
    if (status === 'ended' || status === 'cancelled' || status === 'failed') {
      // Auto-dismiss after 2 seconds
      const timer = setTimeout(() => {
        onDismiss();
      }, 2000);
      return () => clearTimeout(timer);
    }

    if (status === 'in-progress') {
      // Update timer every second during active call
      const interval = setInterval(() => {
        const start = new Date(startTime).getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - start) / 1000); // seconds
        
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        setTimer(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      }, 1000);

      // Initial calculation
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - start) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      setTimer(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);

      return () => clearInterval(interval);
    } else if (status === 'ringing' || status === 'queued') {
      // During ringing or queued, show time since call started
      const interval = setInterval(() => {
        const start = new Date(startTime).getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - start) / 1000);
        
        if (elapsed > 0) {
          const minutes = Math.floor(elapsed / 60);
          const seconds = elapsed % 60;
          setTimer(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, startTime, onDismiss]);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await onCancel();
    } finally {
      setIsCancelling(false);
    }
  };

  // Don't render if ended/cancelled/failed (will auto-dismiss)
  if (status === 'ended' || status === 'cancelled' || status === 'failed') {
    return (
      <div
        className="sticky top-0 z-50 mx-auto mb-4 max-w-2xl transition-opacity duration-500"
        style={{ opacity: 0 }}
      >
        <div
          className="rounded-xl px-5 py-3.5 text-center"
          style={{
            backgroundColor: '#1a1a1a',
            color: colors.text,
            border: `1px solid ${colors.accent}20`,
          }}
        >
          <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '14px' }}>
            {status === 'cancelled' ? 'Call cancelled' : status === 'failed' ? 'Call failed' : 'Call ended'}
          </div>
        </div>
      </div>
    );
  }

  const isRinging = status === 'ringing';
  const isInProgress = status === 'in-progress';

  return (
    <div
      className="sticky top-0 z-50 mx-auto mb-4 max-w-2xl"
      style={{
        animation: 'slide-down 0.3s ease-out',
      }}
    >
      <div
        className="rounded-xl px-5 py-3.5 flex items-center justify-between gap-4"
        style={{
          backgroundColor: '#1a1a1a',
          color: colors.text,
          border: isRinging 
            ? `2px solid ${colors.accent}` 
            : `1px solid ${colors.accent}40`,
          boxShadow: isRinging
            ? `0 0 20px ${colors.accent}30, 0 0 40px ${colors.accent}20`
            : `0 2px 8px rgba(0, 0, 0, 0.2)`,
          animation: isRinging ? 'pulse-border 2s ease-in-out infinite' : 'none',
        }}
      >
        {/* Left: Status Icon and Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Phone Icon */}
          <div
            className="flex-shrink-0"
            style={{
              animation: isRinging ? 'bounce-phone 1s ease-in-out infinite' : 'none',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.accent}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </div>

          {/* Status Text and Timer */}
          <div className="flex-1 min-w-0">
            <div
              style={{
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '15px',
                fontWeight: 500,
                marginBottom: '2px',
              }}
            >
              {isRinging ? `Ringing ${displayName}...` : `Call with ${displayName}`}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '13px',
                opacity: 0.7,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>{timer}</span>
              {isRinging && (
                <span
                  style={{
                    display: 'inline-block',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: colors.accent,
                    animation: 'pulse-dot 1.5s ease-in-out infinite',
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right: Cancel Button */}
        <button
          onClick={handleCancel}
          disabled={isCancelling}
          className="flex-shrink-0 px-4 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: isRinging ? 'rgba(239, 68, 68, 0.15)' : 'rgba(168, 85, 247, 0.15)',
            border: `1px solid ${isRinging ? 'rgba(239, 68, 68, 0.4)' : colors.accent + '40'}`,
            color: isRinging ? '#ef4444' : colors.accent,
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '14px',
            fontWeight: 500,
          }}
          onMouseEnter={(e) => {
            if (!isCancelling) {
              e.currentTarget.style.backgroundColor = isRinging 
                ? 'rgba(239, 68, 68, 0.25)' 
                : 'rgba(168, 85, 247, 0.25)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isCancelling) {
              e.currentTarget.style.backgroundColor = isRinging 
                ? 'rgba(239, 68, 68, 0.15)' 
                : 'rgba(168, 85, 247, 0.15)';
            }
          }}
        >
          {isCancelling ? 'Cancelling...' : isRinging ? 'Cancel' : 'End Call'}
        </button>
      </div>

    </div>
  );
}

