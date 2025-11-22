'use client';

import { useState, FormEvent } from 'react';
import { colors, bookingContent } from '@/lib/config';

export default function Form() {
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    business_website: '',
  });
  const [errors, setErrors] = useState<{ 
    full_name?: string; 
    phone?: string; 
    email?: string; 
    business_website?: string 
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateEmail = (email: string): boolean => {
    if (!email) return false;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email.trim());
  };

  const validatePhone = (phone: string): boolean => {
    if (!phone) return false;
    // Allow various phone formats: (123) 456-7890, 123-456-7890, 123.456.7890, +1 123 456 7890, etc.
    const phonePattern = /^[\d\s\(\)\.\-\+]{10,}$/;
    return phonePattern.test(phone.trim().replace(/\s/g, ''));
  };

  const validateWebsite = (url: string): boolean => {
    if (!url) return false;
    // URL validation - must be a valid URL starting with http:// or https://
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      // If URL constructor fails, check if it starts with http:// or https://
      const urlPattern = /^https?:\/\/.+/;
      return urlPattern.test(url.trim());
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const newErrors: { 
      full_name?: string; 
      phone?: string; 
      email?: string; 
      business_website?: string 
    } = {};

    // Validate full name
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Name is required';
    }

    // Validate phone
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    // Validate email
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Validate business website
    if (!formData.business_website.trim()) {
      newErrors.business_website = 'Business website is required';
    } else if (!validateWebsite(formData.business_website)) {
      newErrors.business_website = 'Please enter a valid URL (e.g., https://yourbusiness.com)';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsSubmitting(false);
      return;
    }

    // Log form data (client-side only, no backend)
    console.log('Form submitted:', formData);
    
    // Scroll to calendar after successful submission
    setTimeout(() => {
      const calendarElement = document.querySelector('[data-calendar-embed]');
      if (calendarElement) {
        calendarElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setIsSubmitting(false);
      // Keep form data filled for user reference
    }, 500);
  };

  const handleChange = (field: 'full_name' | 'phone' | 'email' | 'business_website', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
      <div>
        <label 
          htmlFor="full_name"
          className="block text-xs sm:text-sm font-light mb-2"
          style={{ color: colors.text, opacity: 0.8 }}
        >
          Full Name
        </label>
        <input
          type="text"
          id="full_name"
          name="full_name"
          value={formData.full_name}
          onChange={(e) => handleChange('full_name', e.target.value)}
          className="w-full px-4 py-3 text-sm sm:text-base font-light transition-all duration-200 focus:outline-none"
          style={{
            backgroundColor: colors.secondary,
            color: colors.text,
            border: `1px solid ${errors.full_name ? '#ef4444' : 'transparent'}`,
            borderRadius: '0',
          }}
          placeholder="Your name"
          disabled={isSubmitting}
          onFocus={(e) => {
            if (!errors.full_name) {
              e.currentTarget.style.borderColor = colors.accent;
            }
          }}
          onBlur={(e) => {
            if (!errors.full_name) {
              e.currentTarget.style.borderColor = 'transparent';
            }
          }}
        />
        {errors.full_name && (
          <p className="mt-1.5 text-xs sm:text-sm" style={{ color: '#ef4444' }}>
            {errors.full_name}
          </p>
        )}
      </div>

      <div>
        <label 
          htmlFor="phone"
          className="block text-xs sm:text-sm font-light mb-2"
          style={{ color: colors.text, opacity: 0.8 }}
        >
          Phone Number
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          className="w-full px-4 py-3 text-sm sm:text-base font-light transition-all duration-200 focus:outline-none"
          style={{
            backgroundColor: colors.secondary,
            color: colors.text,
            border: `1px solid ${errors.phone ? '#ef4444' : 'transparent'}`,
            borderRadius: '0',
          }}
          placeholder="(123) 456-7890"
          disabled={isSubmitting}
          onFocus={(e) => {
            if (!errors.phone) {
              e.currentTarget.style.borderColor = colors.accent;
            }
          }}
          onBlur={(e) => {
            if (!errors.phone) {
              e.currentTarget.style.borderColor = 'transparent';
            }
          }}
        />
        {errors.phone && (
          <p className="mt-1.5 text-xs sm:text-sm" style={{ color: '#ef4444' }}>
            {errors.phone}
          </p>
        )}
      </div>

      <div>
        <label 
          htmlFor="email"
          className="block text-xs sm:text-sm font-light mb-2"
          style={{ color: colors.text, opacity: 0.8 }}
        >
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          className="w-full px-4 py-3 text-sm sm:text-base font-light transition-all duration-200 focus:outline-none"
          style={{
            backgroundColor: colors.secondary,
            color: colors.text,
            border: `1px solid ${errors.email ? '#ef4444' : 'transparent'}`,
            borderRadius: '0',
          }}
          placeholder="your@email.com"
          disabled={isSubmitting}
          onFocus={(e) => {
            if (!errors.email) {
              e.currentTarget.style.borderColor = colors.accent;
            }
          }}
          onBlur={(e) => {
            if (!errors.email) {
              e.currentTarget.style.borderColor = 'transparent';
            }
          }}
        />
        {errors.email && (
          <p className="mt-1.5 text-xs sm:text-sm" style={{ color: '#ef4444' }}>
            {errors.email}
          </p>
        )}
      </div>

      <div>
        <label 
          htmlFor="business_website"
          className="block text-xs sm:text-sm font-light mb-2"
          style={{ color: colors.text, opacity: 0.8 }}
        >
          Business Website
        </label>
        <input
          type="url"
          id="business_website"
          name="business_website"
          value={formData.business_website}
          onChange={(e) => handleChange('business_website', e.target.value)}
          className="w-full px-4 py-3 text-sm sm:text-base font-light transition-all duration-200 focus:outline-none"
          style={{
            backgroundColor: colors.secondary,
            color: colors.text,
            border: `1px solid ${errors.business_website ? '#ef4444' : 'transparent'}`,
            borderRadius: '0',
          }}
          placeholder="https://yourbusiness.com"
          disabled={isSubmitting}
          onFocus={(e) => {
            if (!errors.business_website) {
              e.currentTarget.style.borderColor = colors.accent;
            }
          }}
          onBlur={(e) => {
            if (!errors.business_website) {
              e.currentTarget.style.borderColor = 'transparent';
            }
          }}
        />
        {errors.business_website && (
          <p className="mt-1.5 text-xs sm:text-sm" style={{ color: '#ef4444' }}>
            {errors.business_website}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 sm:py-3.5 text-sm sm:text-base font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          color: colors.text,
          backgroundColor: isSubmitting ? colors.secondary : colors.accent,
          border: `1px solid ${colors.accent}`,
          borderRadius: '0',
        }}
        onMouseEnter={(e) => {
          if (!isSubmitting) {
            e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}40`;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {isSubmitting ? 'Submitting...' : 'Continue to Calendar'}
      </button>
    </form>
  );
}

