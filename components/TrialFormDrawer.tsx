'use client';

import { useState } from 'react';
import { colors } from '@/lib/config';

interface TrialFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    fullName: string;
    businessName: string;
    phone: string;
    email: string;
    website?: string;
    bookingSystem?: string;
  }) => void;
}

export default function TrialFormDrawer({ isOpen, onClose, onSubmit }: TrialFormDrawerProps) {
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [bookingSystem, setBookingSystem] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    onSubmit({
      fullName,
      businessName,
      phone,
      email,
      website: website || undefined,
      bookingSystem: bookingSystem || undefined,
    });

    // Reset form
    setFullName('');
    setBusinessName('');
    setPhone('');
    setEmail('');
    setWebsite('');
    setBookingSystem('');
    setShowOptional(false);
    setIsSubmitting(false);
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    border: `2px solid ${colors.accent}40`,
    backgroundColor: `${colors.accent}10`,
    color: colors.text,
    fontFamily: 'var(--font-inter), sans-serif',
    fontSize: '1rem',
    outline: 'none',
    transition: 'all 0.25s ease',
  } as React.CSSProperties;

  const labelStyle = {
    display: 'block',
    color: colors.text,
    fontSize: '0.875rem',
    fontFamily: 'var(--font-inter), sans-serif',
    marginBottom: '0.5rem',
    fontWeight: 500,
  } as React.CSSProperties;

  const FormFields = () => (
    <>
      <div>
        <label style={labelStyle}>
          Full Name <span style={{ color: colors.accent }}>*</span>
        </label>
        <input
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = colors.accent;
            e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}30`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = `${colors.accent}40`;
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      <div>
        <label style={labelStyle}>
          Business Name <span style={{ color: colors.accent }}>*</span>
        </label>
        <input
          type="text"
          required
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = colors.accent;
            e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}30`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = `${colors.accent}40`;
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      <div>
        <label style={labelStyle}>
          Phone <span style={{ color: colors.accent }}>*</span>
        </label>
        <input
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = colors.accent;
            e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}30`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = `${colors.accent}40`;
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      <div>
        <label style={labelStyle}>
          Email <span style={{ color: colors.accent }}>*</span>
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = colors.accent;
            e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}30`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = `${colors.accent}40`;
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      <button
        type="button"
        onClick={() => setShowOptional(!showOptional)}
        style={{
          background: 'transparent',
          border: 'none',
          color: colors.accent,
          fontSize: '0.875rem',
          fontFamily: 'var(--font-inter), sans-serif',
          cursor: 'pointer',
          textAlign: 'left',
          padding: 0,
          opacity: 0.8,
          transition: 'opacity 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.8';
        }}
      >
        {showOptional ? '−' : '+'} Optional Fields
      </button>

      {showOptional && (
        <>
          <div>
            <label style={{ ...labelStyle, opacity: 0.8 }}>
              Website
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.accent;
                e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}30`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = `${colors.accent}40`;
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          <div>
            <label style={{ ...labelStyle, opacity: 0.8 }}>
              Booking System
            </label>
            <input
              type="text"
              value={bookingSystem}
              onChange={(e) => setBookingSystem(e.target.value)}
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.accent;
                e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}30`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = `${colors.accent}40`;
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          marginTop: '1rem',
          padding: '1rem 2rem',
          borderRadius: '12px',
          border: `2px solid ${colors.accent}`,
          backgroundColor: `${colors.accent}15`,
          color: colors.text,
          fontFamily: 'var(--font-inter), sans-serif',
          fontSize: '1rem',
          fontWeight: 500,
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
          transition: 'all 0.3s ease',
          boxShadow: `0 0 40px ${colors.accent}70, 0 0 80px ${colors.accent}50`,
          opacity: isSubmitting ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isSubmitting) {
            e.currentTarget.style.boxShadow = `0 0 60px ${colors.accent}90, 0 0 120px ${colors.accent}70`;
            e.currentTarget.style.backgroundColor = `${colors.accent}25`;
          }
        }}
        onMouseLeave={(e) => {
          if (!isSubmitting) {
            e.currentTarget.style.boxShadow = `0 0 40px ${colors.accent}70, 0 0 80px ${colors.accent}50`;
            e.currentTarget.style.backgroundColor = `${colors.accent}15`;
          }
        }}
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </>
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          animation: 'fadeIn 0.3s ease',
        }}
      />
      
      {/* Bottom drawer - ALL screen sizes */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: '90vh',
          backgroundColor: colors.primary,
          zIndex: 9999,
          boxShadow: `0 -4px 40px rgba(0, 0, 0, 0.3)`,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInUp 0.3s ease',
          overflowY: 'auto',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
        }}
      >
        <div style={{ padding: '2rem', position: 'relative', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'transparent',
              border: 'none',
              color: colors.text,
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.5rem',
              opacity: 0.7,
              transition: 'opacity 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7';
            }}
          >
            ×
          </button>

          <h2
            style={{
              color: colors.text,
              fontSize: '1.5rem',
              fontWeight: 500,
              fontFamily: 'var(--font-inter), sans-serif',
              marginBottom: '2rem',
            }}
          >
            Start Your Free Trial
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <FormFields />
          </form>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideInUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
