'use client';

import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { colors } from '@/lib/config';

interface ConfiguratorData {
  businessType: string | null;
  callVolume: number;
  callDuration: number;
  selectedAddOns: string[];
  phoneLines: number;
  recommendedPlan: string;
}

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
  configuratorData: ConfiguratorData | null;
}

export default function TrialFormDrawer({ isOpen, onClose, onSubmit, configuratorData }: TrialFormDrawerProps) {
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [bookingSystem, setBookingSystem] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const [honeypot, setHoneypot] = useState(''); // Honeypot field for spam prevention
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    businessName?: string;
    phone?: string;
    email?: string;
  }>({});
  const isTypingRef = useRef(false);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      return () => {
        // Restore scroll position
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // Handle keyboard events when drawer is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle ESC key to close drawer
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      // Prevent spacebar from scrolling when drawer is open (only if not in an input)
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  // Normalize website URL - add https:// if missing
  const normalizeWebsite = (url: string): string | undefined => {
    if (!url || !url.trim()) return undefined;
    const trimmed = url.trim();
    if (!trimmed) return undefined;
    
    // If it already starts with http:// or https://, return as-is
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    
    // Otherwise, add https://
    return `https://${trimmed}`;
  };

  // Validate email format
  const validateEmail = (email: string): boolean => {
    if (!email || !email.trim()) return false;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email.trim());
  };

  // Validate phone number (must be exactly 10 digits, or 11 if starts with 1)
  const validatePhone = (phone: string): boolean => {
    if (!phone || !phone.trim()) return false;
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    // Must be exactly 10 digits, or 11 if it starts with 1 (then treat as 10)
    if (digits.length === 11 && digits.startsWith('1')) {
      return true; // 11 digits starting with 1 is valid (country code)
    }
    return digits.length === 10; // Exactly 10 digits
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setFieldErrors({});

    // Honeypot check - if filled, it's likely a bot
    if (honeypot) {
      console.warn('[SPAM DETECTED] Honeypot field was filled');
      // Silently fail - don't show error to user
      return;
    }

    const errors: {
      fullName?: string;
      businessName?: string;
      phone?: string;
      email?: string;
    } = {};

    // Validate all fields and collect all errors
    if (!fullName || !fullName.trim()) {
      errors.fullName = 'Full name is required';
    }

    if (!businessName || !businessName.trim()) {
      errors.businessName = 'Business name is required';
    }

    if (!phone || !phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!validatePhone(phone)) {
      errors.phone = 'Please enter a valid phone number (10 digits)';
    }

    if (!email || !email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      errors.email = 'Please enter a valid email address';
    }

    // If there are any errors, show them all and don't submit
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/createBusinessTrial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName,
          businessName,
          phone,
          email,
          website: normalizeWebsite(website),
          bookingSystem: bookingSystem || undefined,
          // Include configurator data if available
          ...(configuratorData && {
            businessType: configuratorData.businessType || null,
            callVolume: configuratorData.callVolume,
            callDuration: configuratorData.callDuration,
            selectedAddOns: configuratorData.selectedAddOns.join(','), // Comma-separated for Airtable
            phoneLines: configuratorData.phoneLines,
            recommendedPlan: configuratorData.recommendedPlan,
          }),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit trial signup');
      }

      // Success - trigger confetti
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      setSuccess(true);
      setIsSubmitting(false);

    // Reset form
    setFullName('');
    setBusinessName('');
    setPhone('');
    setEmail('');
    setWebsite('');
    setBookingSystem('');
    setShowOptional(false);

      // Call parent onSubmit handler (for tracking, but don't close drawer)
      onSubmit({
        fullName,
        businessName,
        phone,
        email,
        website: website || undefined,
        bookingSystem: bookingSystem || undefined,
      });
      
      // Keep drawer open to show success message and confetti
    } catch (err) {
      console.error('Trial form submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.');
    setIsSubmitting(false);
    }
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
    boxSizing: 'border-box' as const,
    WebkitAppearance: 'none' as const,
    MozAppearance: 'textfield' as const,
  } as React.CSSProperties;

  const labelStyle = {
    display: 'block',
    color: colors.text,
    fontSize: '0.875rem',
    fontFamily: 'var(--font-inter), sans-serif',
    marginBottom: '0.5rem',
    fontWeight: 500,
  } as React.CSSProperties;


  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={(e) => {
          // Only close if not currently typing
          if (!isTypingRef.current) {
            onClose();
          }
        }}
        onMouseDown={(e) => {
          // Prevent closing if clicking started inside the drawer
          if ((e.target as HTMLElement).closest('[data-drawer-content]')) {
            e.preventDefault();
          }
        }}
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
        data-drawer-content
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
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

          <form 
            onSubmit={handleSubmit} 
            onKeyDown={(e) => {
              // Prevent form submission on Enter unless it's the submit button
              if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') {
                e.preventDefault();
              }
              // Stop all keyboard events from bubbling
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
          >
            {error && (
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  fontSize: '0.875rem',
                }}
              >
                {error}
              </div>
            )}
            {success && (
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  backgroundColor: `${colors.accent}15`,
                  border: `1px solid ${colors.accent}40`,
                  color: colors.accent,
                  fontSize: '1rem',
                  fontWeight: 500,
                  textAlign: 'center',
                }}
              >
                Success. Check your email for next steps.
              </div>
            )}
            <div>
              <label style={labelStyle}>
                Full Name <span style={{ color: colors.accent }}>*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (fieldErrors.fullName) {
                    setFieldErrors(prev => ({ ...prev, fullName: undefined }));
                  }
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  isTypingRef.current = true;
                }}
                onKeyUp={(e) => {
                  e.stopPropagation();
                  isTypingRef.current = false;
                }}
                onFocus={(e) => {
                  isTypingRef.current = true;
                  e.currentTarget.style.borderColor = colors.accent;
                  e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}30`;
                }}
                onBlur={(e) => {
                  setTimeout(() => {
                    isTypingRef.current = false;
                  }, 100);
                  e.currentTarget.style.borderColor = fieldErrors.fullName ? '#ef4444' : `${colors.accent}40`;
                  e.currentTarget.style.boxShadow = 'none';
                }}
                style={{
                  ...inputStyle,
                  borderColor: fieldErrors.fullName ? '#ef4444' : `${colors.accent}40`,
                }}
                autoComplete="name"
              />
              {fieldErrors.fullName && (
                <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {fieldErrors.fullName}
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>
                Business Name <span style={{ color: colors.accent }}>*</span>
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => {
                  setBusinessName(e.target.value);
                  if (fieldErrors.businessName) {
                    setFieldErrors(prev => ({ ...prev, businessName: undefined }));
                  }
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  isTypingRef.current = true;
                }}
                onKeyUp={(e) => {
                  e.stopPropagation();
                  isTypingRef.current = false;
                }}
                onFocus={(e) => {
                  isTypingRef.current = true;
                  e.currentTarget.style.borderColor = colors.accent;
                  e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}30`;
                }}
                onBlur={(e) => {
                  setTimeout(() => {
                    isTypingRef.current = false;
                  }, 100);
                  e.currentTarget.style.borderColor = fieldErrors.businessName ? '#ef4444' : `${colors.accent}40`;
                  e.currentTarget.style.boxShadow = 'none';
                }}
                style={{
                  ...inputStyle,
                  borderColor: fieldErrors.businessName ? '#ef4444' : `${colors.accent}40`,
                }}
                autoComplete="organization"
              />
              {fieldErrors.businessName && (
                <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {fieldErrors.businessName}
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>
                Phone <span style={{ color: colors.accent }}>*</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (fieldErrors.phone) {
                    setFieldErrors(prev => ({ ...prev, phone: undefined }));
                  }
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  isTypingRef.current = true;
                }}
                onKeyUp={(e) => {
                  e.stopPropagation();
                  isTypingRef.current = false;
                }}
                onFocus={(e) => {
                  isTypingRef.current = true;
                  e.currentTarget.style.borderColor = colors.accent;
                  e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}30`;
                }}
                onBlur={(e) => {
                  setTimeout(() => {
                    isTypingRef.current = false;
                  }, 100);
                  e.currentTarget.style.borderColor = fieldErrors.phone ? '#ef4444' : `${colors.accent}40`;
                  e.currentTarget.style.boxShadow = 'none';
                }}
                style={{
                  ...inputStyle,
                  borderColor: fieldErrors.phone ? '#ef4444' : `${colors.accent}40`,
                }}
                autoComplete="tel"
              />
              {fieldErrors.phone && (
                <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {fieldErrors.phone}
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>
                Email <span style={{ color: colors.accent }}>*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors(prev => ({ ...prev, email: undefined }));
                  }
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  isTypingRef.current = true;
                }}
                onKeyUp={(e) => {
                  e.stopPropagation();
                  isTypingRef.current = false;
                }}
                onFocus={(e) => {
                  isTypingRef.current = true;
                  e.currentTarget.style.borderColor = colors.accent;
                  e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}30`;
                }}
                onBlur={(e) => {
                  setTimeout(() => {
                    isTypingRef.current = false;
                  }, 100);
                  e.currentTarget.style.borderColor = fieldErrors.email ? '#ef4444' : `${colors.accent}40`;
                  e.currentTarget.style.boxShadow = 'none';
                }}
                style={{
                  ...inputStyle,
                  borderColor: fieldErrors.email ? '#ef4444' : `${colors.accent}40`,
                }}
                autoComplete="email"
              />
              {fieldErrors.email && (
                <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {fieldErrors.email}
                </div>
              )}
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

            {/* Honeypot field - hidden from users, should remain empty */}
            <input
              type="text"
              name="website_url"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              style={{
                position: 'absolute',
                left: '-9999px',
                width: '1px',
                height: '1px',
                opacity: 0,
                pointerEvents: 'none',
                tabIndex: -1,
              }}
              autoComplete="off"
              tabIndex={-1}
            />

            {showOptional && (
              <>
                <div>
                  <label style={{ ...labelStyle, opacity: 0.8 }}>
                    Website
                  </label>
                  <input
                    type="text"
                    value={website}
                    placeholder="www.example.com or https://example.com"
                    onChange={(e) => {
                      setWebsite(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      isTypingRef.current = true;
                    }}
                    onKeyUp={(e) => {
                      e.stopPropagation();
                      isTypingRef.current = false;
                    }}
                    onFocus={(e) => {
                      isTypingRef.current = true;
                      e.currentTarget.style.borderColor = colors.accent;
                      e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}30`;
                    }}
                    onBlur={(e) => {
                      setTimeout(() => {
                        isTypingRef.current = false;
                      }, 100);
                      e.currentTarget.style.borderColor = `${colors.accent}40`;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    style={inputStyle}
                    autoComplete="url"
                  />
                </div>

                <div>
                  <label style={{ ...labelStyle, opacity: 0.8 }}>
                    Booking System
                  </label>
                  <input
                    type="text"
                    value={bookingSystem}
                    onChange={(e) => {
                      setBookingSystem(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      isTypingRef.current = true;
                    }}
                    onKeyUp={(e) => {
                      e.stopPropagation();
                      isTypingRef.current = false;
                    }}
                    onFocus={(e) => {
                      isTypingRef.current = true;
                      e.currentTarget.style.borderColor = colors.accent;
                      e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}30`;
                    }}
                    onBlur={(e) => {
                      setTimeout(() => {
                        isTypingRef.current = false;
                      }, 100);
                      e.currentTarget.style.borderColor = `${colors.accent}40`;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    style={inputStyle}
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
