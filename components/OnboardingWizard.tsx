'use client';

import { useState, useRef, useEffect } from 'react';
import { colors } from '@/lib/config';
import ProgressIndicator from './ProgressIndicator';
import WizardStep from './WizardStep';
import PersonalityTraitCards from './PersonalityTraitCards';
import UseCaseCards from './UseCaseCards';
import VoiceSelectionStep from './VoiceSelectionStep';
import Toggle from './Toggle';
import { generatePreviewText } from '@/lib/generatePreviewText';
import { Play, Loader2, Volume2, Paperclip, AlertCircle, CheckCircle, X, Lock } from 'lucide-react';

interface OnboardingWizardProps {
  onSubmit: (data: WizardData) => Promise<void>;
  isSubmitting?: boolean;
  initialData?: WizardData;
  isEditMode?: boolean;
}

export interface WizardData {
  fullName: string;
  email: string;
  mobileNumber: string;
  nickname?: string;
  kendallName: string;
  selectedTraits: string[];
  traitDescriptions?: Record<string, string>; // Map of trait -> voice description
  useCaseChoice: string;
  boundaryChoices: string[];
  userContextAndRules: string;
  forwardCalls: boolean;
  voiceChoice?: string; // VAPI voice ID (e.g., "Elliot", "Leah")
  attachedFileUrls?: Array<{ url: string; filename: string }>; // File URLs for Airtable attachment field
  fileUsageInstructions?: string; // Instructions on how to use attached files
}

interface WizardNavProps {
  currentStep: number;
  totalSteps: number;
  canGoBack: boolean;
  canContinue: boolean;
  onBack: () => void;
  onNext: () => void;
  isLoading: boolean;
}

// Function to get placeholder examples based on use case
function getPlaceholderExamples(useCase: string | undefined): string {
  const examples: Record<string, string> = {
    'Friends & Personal Life': "I'm a freelancer. Friends and family call about weekend plans, dinner invites, and social events. Always check my calendar before confirming anything. Never share my work address or personal schedule. If someone asks where I am, keep it vague and say I'll get back to them.",
    'Social Media / Instagram / TikTok': "I'm a content creator with my phone number in my Instagram bio. Fans call to chat, ask questions about my content, or just want to connect. Be friendly and engaging with fans. If someone asks for personal details, politely redirect to talking about my content instead.",
    'Professional / LinkedIn': "You are my personal secretary. When someone calls, assume it may be a recruiter, employer, or business contact. Give an introduction of my background, keep everything professional, and notify me about any opportunities or important messages. Give them details specifically from my attached resume when needed.",
    'Clients & Customers': "I'm a freelance designer running my own business. Clients call about project inquiries, rates, and availability. Never share my personal email or phone number. If they ask about pricing, say I'll send a detailed quote via email. Always confirm all project details via email.",
    'Mixed / Everything': "I'm a freelancer who handles both personal and professional calls. Friends call about plans, clients call about work, and sometimes it's hard to tell which is which. Screen calls based on what they're asking about - if it's personal, be casual and friendly. If it's work-related, keep it professional. Never share my personal schedule or location with anyone.",
  };

  const defaultExample = "I'm a freelancer. Friends and family call about weekend plans, dinner invites, and social events. Always check my calendar before confirming anything. Never share my work address or personal schedule. If someone asks where I am, keep it vague and say I'll get back to them.";

  if (useCase && examples[useCase]) {
    return examples[useCase];
  }
  
  return defaultExample;
}

function WizardNav({
  currentStep,
  totalSteps,
  canGoBack,
  canContinue,
  onBack,
  onNext,
  isLoading,
}: WizardNavProps) {
  return (
    <div className="flex items-center justify-between mt-12 sm:mt-16">
      {canGoBack ? (
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 text-sm sm:text-base transition-all duration-300"
          style={{
            color: colors.text,
            opacity: 0.7,
            backgroundColor: 'transparent',
            border: 'none',
            fontFamily: 'var(--font-inter), sans-serif',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.7';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          ← Back
        </button>
      ) : (
        <div />
      )}
      
      <button
        type="button"
        onClick={onNext}
        disabled={!canContinue || isLoading}
        className="px-8 py-3 sm:px-10 sm:py-3.5 text-sm sm:text-base font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed relative"
        style={{
          color: colors.text,
          backgroundColor: canContinue && !isLoading ? `${colors.accent}15` : colors.secondary,
          border: `2px solid ${canContinue && !isLoading ? colors.accent : 'rgba(255, 255, 255, 0.1)'}`,
          borderRadius: '8px',
          fontFamily: 'var(--font-inter), sans-serif',
          minWidth: '120px',
          boxShadow: canContinue && !isLoading
            ? `0 8px 32px ${colors.accent}50, 0 0 30px ${colors.accent}40, inset 0 0 20px ${colors.accent}10`
            : 'none',
          backdropFilter: 'blur(10px)',
        }}
        onMouseEnter={(e) => {
          if (canContinue && !isLoading) {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = `0 8px 32px ${colors.accent}60, 0 0 40px ${colors.accent}50, inset 0 0 20px ${colors.accent}15`;
          }
        }}
        onMouseLeave={(e) => {
          if (canContinue && !isLoading) {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = `0 8px 32px ${colors.accent}50, 0 0 30px ${colors.accent}40, inset 0 0 20px ${colors.accent}10`;
          }
        }}
      >
        {isLoading ? 'Loading...' : currentStep === totalSteps ? 'Complete Setup' : 'Continue'}
      </button>
    </div>
  );
}

export default function OnboardingWizard({ onSubmit, isSubmitting = false, initialData, isEditMode = false }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 7;
  
  // Form data state - pre-populate with initialData if provided
  const [formData, setFormData] = useState<Partial<WizardData>>(() => {
    if (initialData) {
      return {
        fullName: initialData.fullName || '',
        email: initialData.email || '',
        mobileNumber: initialData.mobileNumber || '',
        nickname: initialData.nickname || '',
        kendallName: initialData.kendallName || 'Kendall',
        selectedTraits: initialData.selectedTraits || [],
        traitDescriptions: initialData.traitDescriptions || {},
        useCaseChoice: initialData.useCaseChoice || '',
        boundaryChoices: initialData.boundaryChoices || [],
        userContextAndRules: initialData.userContextAndRules || '',
        forwardCalls: initialData.forwardCalls || false,
        voiceChoice: initialData.voiceChoice || '',
        attachedFileUrls: initialData.attachedFileUrls || [],
        fileUsageInstructions: initialData.fileUsageInstructions || '',
      };
    }
    return {
      fullName: '',
      email: '',
      mobileNumber: '',
      nickname: '',
      kendallName: 'Kendall',
      selectedTraits: [],
      traitDescriptions: {},
      useCaseChoice: '',
      boundaryChoices: [],
      userContextAndRules: '',
      forwardCalls: false,
      voiceChoice: '',
      attachedFileUrls: [],
      fileUsageInstructions: '',
    };
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationState, setValidationState] = useState<Record<string, 'valid' | 'invalid' | null>>({});
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ filename: string; size: number; url: string; type: string }>>(() => {
    // Pre-populate uploadedFiles from initialData if provided
    if (initialData?.attachedFileUrls && initialData.attachedFileUrls.length > 0) {
      return initialData.attachedFileUrls.map(file => ({
        filename: file.filename || 'file',
        size: 0, // Size not stored in Airtable
        url: file.url,
        type: 'application/pdf', // Default type, could be improved with actual detection
      }));
    }
    return [];
  });
  
  // Voice preview state for Step 7
  const [isPreviewingContent, setIsPreviewingContent] = useState(false);
  const [isPlayingContent, setIsPlayingContent] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const contentAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Focus management ref
  const stepContentRef = useRef<HTMLDivElement | null>(null);

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;
    
    setUploadingFiles(true);
    const newFileUrls: Array<{ url: string; filename: string }> = [];
    const newFileInfo: Array<{ filename: string; size: number; url: string; type: string }> = [];
    
    try {
      for (const file of files) {
        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          alert(`File "${file.name}" is too large. Maximum size is 10MB.`);
          continue;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/uploadFile', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          // Combine error and details for better error message
          let errorMessage = errorData.error || `Failed to upload ${file.name}`;
          if (errorData.details) {
            errorMessage += `: ${errorData.details}`;
          }
          console.error('[FILE UPLOAD ERROR]', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            filename: file.name,
          });
          throw new Error(errorMessage);
        }
        
        const result = await response.json();
        
        if (result.url && result.filename) {
          // File successfully uploaded to Blob storage
          newFileUrls.push({
            url: result.url,
            filename: result.filename,
          });
          newFileInfo.push({
            filename: result.filename,
            size: result.size,
            url: result.url,
            type: result.type || 'application/octet-stream',
          });
          console.log(`[FILE UPLOAD] Successfully uploaded: ${result.filename} -> ${result.url}`);
        } else {
          throw new Error(`Invalid response from upload API for ${file.name}`);
        }
      }
      
      // Update form data with file URLs
      setFormData(prev => ({
        ...prev,
        attachedFileUrls: [...(prev.attachedFileUrls || []), ...newFileUrls],
      }));
      
      // Update uploaded files list
      setUploadedFiles(prev => [...prev, ...newFileInfo]);
    } catch (error) {
      console.error('File upload error:', error);
      alert(`Failed to upload files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploadingFiles(false);
    }
  };

  // Real-time validation helper
  const validateField = (field: string, value: string): 'valid' | 'invalid' | null => {
    if (!value || value.trim().length === 0) return null;
    
    if (field === 'fullName') {
      return value.trim().length >= 2 ? 'valid' : 'invalid';
    }
    
    if (field === 'nickname') {
      return value.trim().length >= 1 ? 'valid' : 'invalid';
    }
    
    if (field === 'email') {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailPattern.test(value.trim()) ? 'valid' : 'invalid';
    }
    
    if (field === 'mobileNumber') {
      const phonePattern = /^[\d\s\(\)\.\-\+]{10,}$/;
      return phonePattern.test(value.replace(/\s/g, '')) ? 'valid' : 'invalid';
    }
    
    return null;
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (step === 1) {
      if (!formData.fullName?.trim()) newErrors.fullName = 'Full name is required';
      if (!formData.email?.trim()) newErrors.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }
      if (!formData.mobileNumber?.trim()) newErrors.mobileNumber = 'Phone number is required';
      else if (!/^[\d\s\(\)\.\-\+]{10,}$/.test(formData.mobileNumber.replace(/\s/g, ''))) {
        newErrors.mobileNumber = 'Please enter a valid phone number';
      }
    } else if (step === 2) {
      // Voice selection is optional, no validation needed
    } else if (step === 4) {
      if (!formData.selectedTraits || formData.selectedTraits.length === 0) {
        newErrors.selectedTraits = 'Please select at least one personality trait';
      }
    } else if (step === 5) {
      if (!formData.useCaseChoice) {
        newErrors.useCaseChoice = 'Please select a use case';
      }
    } else if (step === 6) {
      if (!formData.userContextAndRules?.trim()) {
        newErrors.userContextAndRules = 'Please tell Kendall about yourself and any rules';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
      } else {
        // Submit on last step
        handleSubmit();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      // Clear errors when going back
      setErrors({});
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(totalSteps)) return;
    
    if (!formData.fullName || !formData.email || !formData.mobileNumber || !formData.useCaseChoice || !formData.userContextAndRules) {
      return;
    }
    
    // Log voice choice before submitting
    console.log('[FRONTEND DEBUG] Submitting form with voiceChoice:', {
      voiceChoice: formData.voiceChoice,
      type: typeof formData.voiceChoice,
      hasVoiceChoice: !!formData.voiceChoice,
      fullName: formData.fullName,
    });
    
    await onSubmit({
      fullName: formData.fullName,
      email: formData.email,
      mobileNumber: formData.mobileNumber,
      nickname: formData.nickname || undefined,
      kendallName: formData.kendallName?.trim() || 'Kendall',
      selectedTraits: formData.selectedTraits || [],
      traitDescriptions: formData.traitDescriptions || {},
      useCaseChoice: formData.useCaseChoice,
      boundaryChoices: formData.boundaryChoices || [],
      userContextAndRules: formData.userContextAndRules,
      forwardCalls: formData.forwardCalls || false,
      voiceChoice: formData.voiceChoice || undefined,
      attachedFileUrls: formData.attachedFileUrls && formData.attachedFileUrls.length > 0 ? formData.attachedFileUrls : undefined,
      fileUsageInstructions: formData.fileUsageInstructions?.trim() || undefined,
    });
  };

  const canContinue = () => {
    if (currentStep === 1) {
      // In edit mode, locked fields are always valid since they're pre-filled
      if (isEditMode) {
        return true; // Locked fields are already validated and filled
      }
      return !!(formData.fullName?.trim() && formData.email?.trim() && formData.mobileNumber?.trim());
    } else if (currentStep === 2) {
      // Voice selection is optional, allow to continue
      return true;
    } else if (currentStep === 3) {
      // Allow empty kendallName (will default to 'Kendall' in backend)
      return true;
    } else if (currentStep === 4) {
      return !!(formData.selectedTraits && formData.selectedTraits.length > 0);
    } else if (currentStep === 5) {
      return !!(formData.useCaseChoice);
    } else if (currentStep === 6) {
      return !!(formData.userContextAndRules?.trim());
    } else if (currentStep === 7) {
      // Review step - can always continue to submit
      return true;
    }
    return false;
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (contentAudioRef.current) {
        contentAudioRef.current.pause();
        contentAudioRef.current = null;
      }
    };
  }, []);

  // Focus management - focus first interactive element when step changes
  useEffect(() => {
    if (stepContentRef.current) {
      // Find first focusable element (input, button, textarea, select, or element with tabIndex >= 0)
      const focusableSelectors = 'input, button, textarea, select, [tabindex]:not([tabindex="-1"])';
      const firstFocusable = stepContentRef.current.querySelector(focusableSelectors) as HTMLElement;
      
      if (firstFocusable) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          firstFocusable.focus();
        }, 100);
      }
    }
  }, [currentStep]);

  // Handle Enter key to advance to next step
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if Enter is pressed and not in an input/textarea
      if (e.key === 'Enter' && !e.shiftKey) {
        const target = e.target as HTMLElement;
        const tagName = target.tagName;
        const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA';
        
        // Don't trigger if user is typing in an input/textarea
        if (isInput) {
          return;
        }
        
        // On step 4 (Personalize), if we have at least 1 selection, advance instead of toggling cards
        if (currentStep === 4 && formData.selectedTraits && formData.selectedTraits.length > 0) {
          // If it's a button (likely a card), prevent its default behavior and advance
          if (tagName === 'BUTTON') {
            e.preventDefault();
            e.stopPropagation();
            if (canContinue()) {
              handleNext();
            }
            return;
          }
        }
        
        // For other buttons on other steps, let them handle their own behavior
        if (tagName === 'BUTTON') {
          return;
        }
        
        // Only proceed if we can continue
        if (canContinue()) {
          e.preventDefault();
          handleNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase to intercept before button handlers
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, formData]);

  // Generate preview text based on user's configuration (personality-focused)
  const getPreviewText = (): string => {
    return generatePreviewText({
      kendallName: formData.kendallName || 'Kendall',
      selectedTraits: formData.selectedTraits || [],
      useCaseChoice: formData.useCaseChoice || '',
      // Removed userContextAndRules - focusing on personality showcase
    });
  };

  // Handle voice preview with personality showcase
  const handlePreviewContent = async () => {
    if (!formData.voiceChoice) {
      alert('Please select a voice first. You can go back to Step 2 to choose one.');
      return;
    }

    // Stop current preview if playing
    if (contentAudioRef.current) {
      contentAudioRef.current.pause();
      contentAudioRef.current = null;
    }

    // If already playing, stop it
    if (isPlayingContent) {
      setIsPlayingContent(false);
      setIsPreviewingContent(false);
      return;
    }

    setIsLoadingContent(true);
    setIsPreviewingContent(true);

    try {
      const previewText = getPreviewText();
      
      // Call our API endpoint to generate preview
      const response = await fetch('/api/generateVoicePreview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voiceId: formData.voiceChoice,
          text: previewText,
          traits: formData.selectedTraits || [], // Pass traits for personality-based voice settings
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to generate content preview:', errorData);
        alert(`Failed to generate voice preview: ${errorData.error || 'Unknown error'}`);
        setIsLoadingContent(false);
        setIsPreviewingContent(false);
        return;
      }

      // Get audio blob
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create audio element and play
      const audio = new Audio(audioUrl);
      contentAudioRef.current = audio;

      audio.onplay = () => {
        setIsLoadingContent(false);
        setIsPlayingContent(true);
      };

      audio.onended = () => {
        setIsPlayingContent(false);
        setIsPreviewingContent(false);
        URL.revokeObjectURL(audioUrl); // Clean up
        contentAudioRef.current = null;
      };

      audio.onerror = (error) => {
        console.error('Audio playback error:', error);
        setIsLoadingContent(false);
        setIsPlayingContent(false);
        setIsPreviewingContent(false);
        URL.revokeObjectURL(audioUrl); // Clean up
        contentAudioRef.current = null;
      };

      await audio.play();
    } catch (error) {
      console.error('Error generating content preview:', error);
      alert('Failed to generate voice preview. Please try again.');
      setIsLoadingContent(false);
      setIsPlayingContent(false);
      setIsPreviewingContent(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="flex flex-col" style={{ minHeight: '100%', gap: 'clamp(2rem, 5vh, 3rem)', justifyContent: 'space-evenly' }}>
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-light mb-5"
                style={{ color: colors.text, opacity: 0.9 }}
              >
                Full Name
                {isEditMode && (
                  <Lock 
                    size={14} 
                    className="inline-block" 
                    style={{ color: colors.accent, marginLeft: '0.75rem', verticalAlign: 'baseline', marginTop: '1px' }} 
                  />
                )}
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="fullName"
                  value={formData.fullName || ''}
                  onChange={(e) => {
                    if (isEditMode) return; // Prevent editing in edit mode
                    const value = e.target.value;
                    setFormData({ ...formData, fullName: value });
                    if (value.length > 0) {
                      const validation = validateField('fullName', value);
                      setValidationState(prev => ({ ...prev, fullName: validation }));
                    } else {
                      setValidationState(prev => ({ ...prev, fullName: null }));
                    }
                  }}
                  disabled={isEditMode}
                  className="w-full px-5 py-4 pr-12 text-base font-light transition-all duration-300 focus:outline-none"
                  style={{
                    backgroundColor: isEditMode 
                      ? 'rgba(255, 255, 255, 0.03)' 
                      : errors.fullName 
                        ? 'rgba(239, 68, 68, 0.1)' 
                        : validationState.fullName === 'valid'
                        ? `${colors.accent}10`
                        : validationState.fullName === 'invalid'
                        ? 'rgba(239, 68, 68, 0.1)'
                        : 'rgba(255, 255, 255, 0.05)',
                    color: isEditMode ? `${colors.text}99` : colors.text,
                    border: `1px solid ${
                      isEditMode
                        ? 'rgba(255, 255, 255, 0.1)'
                        : errors.fullName 
                          ? '#ef4444' 
                          : validationState.fullName === 'valid'
                          ? colors.accent
                          : validationState.fullName === 'invalid'
                          ? '#ef4444'
                          : 'rgba(255, 255, 255, 0.1)'
                    }`,
                    borderRadius: '12px',
                    backdropFilter: 'blur(10px)',
                    cursor: isEditMode ? 'not-allowed' : 'text',
                    opacity: isEditMode ? 0.6 : 1,
                  }}
                  placeholder="Your full name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const value = e.currentTarget.value;
                      const validation = validateField('fullName', value);
                      setValidationState(prev => ({ ...prev, fullName: validation }));
                      e.currentTarget.blur();
                    }
                  }}
                  onFocus={(e) => {
                    if (!errors.fullName) {
                      e.currentTarget.style.borderColor = colors.accent;
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.accent}15, 0 0 20px ${colors.accent}20`;
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    const validation = validateField('fullName', value);
                    setValidationState(prev => ({ ...prev, fullName: validation }));
                    if (!errors.fullName) {
                      e.currentTarget.style.borderColor = validation === 'valid' 
                        ? colors.accent 
                        : validation === 'invalid'
                        ? '#ef4444'
                        : 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.backgroundColor = validation === 'valid'
                        ? `${colors.accent}10`
                        : validation === 'invalid'
                        ? 'rgba(239, 68, 68, 0.1)'
                        : 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                />
                {validationState.fullName && (
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                    {validationState.fullName === 'valid' ? (
                      <CheckCircle size={20} style={{ color: colors.accent }} />
                    ) : (
                      <X size={20} style={{ color: '#ef4444' }} />
                    )}
                  </div>
                )}
              </div>
              {errors.fullName && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <p className="text-sm" style={{ color: '#ef4444' }}>
                    {errors.fullName}
                  </p>
                </div>
              )}
            </div>
            
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-light mb-5"
                style={{ color: colors.text, opacity: 0.9 }}
              >
                Email
                {isEditMode && (
                  <Lock 
                    size={14} 
                    className="inline-block" 
                    style={{ color: colors.accent, marginLeft: '0.75rem', verticalAlign: 'baseline', marginTop: '1px' }} 
                  />
                )}
              </label>
              <div className="relative">
                <input
                  type="email"
                  id="email"
                  value={formData.email || ''}
                  onChange={(e) => {
                    if (isEditMode) return; // Prevent editing in edit mode
                    const value = e.target.value;
                    setFormData({ ...formData, email: value });
                    if (value.length > 0) {
                      const validation = validateField('email', value);
                      setValidationState(prev => ({ ...prev, email: validation }));
                    } else {
                      setValidationState(prev => ({ ...prev, email: null }));
                    }
                  }}
                  disabled={isEditMode}
                  className="w-full px-5 py-4 pr-12 text-base font-light transition-all duration-300 focus:outline-none"
                  style={{
                    backgroundColor: isEditMode 
                      ? 'rgba(255, 255, 255, 0.03)' 
                      : errors.email 
                        ? 'rgba(239, 68, 68, 0.1)' 
                        : validationState.email === 'valid'
                        ? `${colors.accent}10`
                        : validationState.email === 'invalid'
                        ? 'rgba(239, 68, 68, 0.1)'
                        : 'rgba(255, 255, 255, 0.05)',
                    color: isEditMode ? `${colors.text}99` : colors.text,
                    border: `1px solid ${
                      isEditMode
                        ? 'rgba(255, 255, 255, 0.1)'
                        : errors.email 
                          ? '#ef4444' 
                          : validationState.email === 'valid'
                          ? colors.accent
                          : validationState.email === 'invalid'
                          ? '#ef4444'
                          : 'rgba(255, 255, 255, 0.1)'
                    }`,
                    borderRadius: '12px',
                    backdropFilter: 'blur(10px)',
                    cursor: isEditMode ? 'not-allowed' : 'text',
                    opacity: isEditMode ? 0.6 : 1,
                  }}
                  placeholder="your@email.com"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const value = e.currentTarget.value;
                      const validation = validateField('email', value);
                      setValidationState(prev => ({ ...prev, email: validation }));
                      e.currentTarget.blur();
                    }
                  }}
                  onFocus={(e) => {
                    if (!errors.email) {
                      e.currentTarget.style.borderColor = colors.accent;
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.accent}15, 0 0 20px ${colors.accent}20`;
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    const validation = validateField('email', value);
                    setValidationState(prev => ({ ...prev, email: validation }));
                    if (!errors.email) {
                      e.currentTarget.style.borderColor = validation === 'valid' 
                        ? colors.accent 
                        : validation === 'invalid'
                        ? '#ef4444'
                        : 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.backgroundColor = validation === 'valid'
                        ? `${colors.accent}10`
                        : validation === 'invalid'
                        ? 'rgba(239, 68, 68, 0.1)'
                        : 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                />
                {validationState.email && (
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                    {validationState.email === 'valid' ? (
                      <CheckCircle size={20} style={{ color: colors.accent }} />
                    ) : (
                      <X size={20} style={{ color: '#ef4444' }} />
                    )}
                  </div>
                )}
              </div>
              {errors.email && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <p className="text-sm" style={{ color: '#ef4444' }}>
                    {errors.email}
                  </p>
                </div>
              )}
            </div>
            
            <div>
              <label
                htmlFor="mobileNumber"
                className="block text-sm font-light mb-5"
                style={{ color: colors.text, opacity: 0.9 }}
              >
                Phone Number
                {isEditMode && (
                  <Lock 
                    size={14} 
                    className="inline-block" 
                    style={{ color: colors.accent, marginLeft: '0.75rem', verticalAlign: 'baseline', marginTop: '1px' }} 
                  />
                )}
              </label>
              <div className="relative">
                <input
                  type="tel"
                  id="mobileNumber"
                  value={formData.mobileNumber || ''}
                  onChange={(e) => {
                    if (isEditMode) return; // Prevent editing in edit mode
                    const value = e.target.value;
                    setFormData({ ...formData, mobileNumber: value });
                    if (value.length > 0) {
                      const validation = validateField('mobileNumber', value);
                      setValidationState(prev => ({ ...prev, mobileNumber: validation }));
                    } else {
                      setValidationState(prev => ({ ...prev, mobileNumber: null }));
                    }
                  }}
                  disabled={isEditMode}
                  className="w-full px-5 py-4 pr-12 text-base font-light transition-all duration-300 focus:outline-none"
                  style={{
                    backgroundColor: isEditMode 
                      ? 'rgba(255, 255, 255, 0.03)' 
                      : errors.mobileNumber 
                        ? 'rgba(239, 68, 68, 0.1)' 
                        : validationState.mobileNumber === 'valid'
                        ? `${colors.accent}10`
                        : validationState.mobileNumber === 'invalid'
                        ? 'rgba(239, 68, 68, 0.1)'
                        : 'rgba(255, 255, 255, 0.05)',
                    color: isEditMode ? `${colors.text}99` : colors.text,
                    border: `1px solid ${
                      isEditMode
                        ? 'rgba(255, 255, 255, 0.1)'
                        : errors.mobileNumber 
                          ? '#ef4444' 
                          : validationState.mobileNumber === 'valid'
                          ? colors.accent
                          : validationState.mobileNumber === 'invalid'
                          ? '#ef4444'
                          : 'rgba(255, 255, 255, 0.1)'
                    }`,
                    borderRadius: '12px',
                    backdropFilter: 'blur(10px)',
                    cursor: isEditMode ? 'not-allowed' : 'text',
                    opacity: isEditMode ? 0.6 : 1,
                  }}
                  placeholder="(123) 456-7890"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const value = e.currentTarget.value;
                      const validation = validateField('mobileNumber', value);
                      setValidationState(prev => ({ ...prev, mobileNumber: validation }));
                      e.currentTarget.blur();
                    }
                  }}
                  onFocus={(e) => {
                    if (!errors.mobileNumber) {
                      e.currentTarget.style.borderColor = colors.accent;
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.accent}15, 0 0 20px ${colors.accent}20`;
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    const validation = validateField('mobileNumber', value);
                    setValidationState(prev => ({ ...prev, mobileNumber: validation }));
                    if (!errors.mobileNumber) {
                      e.currentTarget.style.borderColor = validation === 'valid' 
                        ? colors.accent 
                        : validation === 'invalid'
                        ? '#ef4444'
                        : 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.backgroundColor = validation === 'valid'
                        ? `${colors.accent}10`
                        : validation === 'invalid'
                        ? 'rgba(239, 68, 68, 0.1)'
                        : 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                />
                {validationState.mobileNumber && (
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                    {validationState.mobileNumber === 'valid' ? (
                      <CheckCircle size={20} style={{ color: colors.accent }} />
                    ) : (
                      <X size={20} style={{ color: '#ef4444' }} />
                    )}
                  </div>
                )}
              </div>
              {errors.mobileNumber && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <p className="text-sm" style={{ color: '#ef4444' }}>
                    {errors.mobileNumber}
                  </p>
                </div>
              )}
            </div>
            
            <div>
              <Toggle
                checked={formData.forwardCalls || false}
                onChange={(checked) => setFormData({ ...formData, forwardCalls: checked })}
                label="Forward calls to your phone if asked"
              />
            </div>
            
            <div>
              <label
                htmlFor="nickname"
                className="block text-sm font-light mb-5"
                style={{ color: colors.text, opacity: 0.9 }}
              >
                Nickname (optional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="nickname"
                  value={formData.nickname || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, nickname: value });
                    if (value.length > 0) {
                      const validation = validateField('nickname', value);
                      setValidationState(prev => ({ ...prev, nickname: validation }));
                    } else {
                      setValidationState(prev => ({ ...prev, nickname: null }));
                    }
                  }}
                  className="w-full px-5 py-4 pr-12 text-base font-light transition-all duration-300 focus:outline-none"
                  style={{
                    backgroundColor: validationState.nickname === 'valid'
                      ? `${colors.accent}10`
                      : 'rgba(255, 255, 255, 0.05)',
                    color: colors.text,
                    border: `1px solid ${
                      validationState.nickname === 'valid'
                        ? colors.accent
                        : 'rgba(255, 255, 255, 0.1)'
                    }`,
                    borderRadius: '12px',
                    backdropFilter: 'blur(10px)',
                  }}
                  placeholder="What should your assistant call you?"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const value = e.currentTarget.value;
                      const validation = validateField('nickname', value);
                      setValidationState(prev => ({ ...prev, nickname: validation }));
                      e.currentTarget.blur();
                    }
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = colors.accent;
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.accent}15, 0 0 20px ${colors.accent}20`;
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    const validation = validateField('nickname', value);
                    setValidationState(prev => ({ ...prev, nickname: validation }));
                    e.currentTarget.style.borderColor = validation === 'valid' 
                      ? colors.accent 
                      : 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.backgroundColor = validation === 'valid'
                      ? `${colors.accent}10`
                      : 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                {validationState.nickname && (
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                    {validationState.nickname === 'valid' ? (
                      <CheckCircle size={20} style={{ color: colors.accent }} />
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
        
      case 2:
        return (
          <VoiceSelectionStep
            selectedVoice={formData.voiceChoice || null}
            onSelectionChange={(voiceId) => setFormData({ ...formData, voiceChoice: voiceId })}
          />
        );
        
      case 3:
        return (
          <div>
            <label
              htmlFor="kendallName"
              className="block text-sm font-light mb-5"
              style={{ color: colors.text, opacity: 0.9 }}
            >
              What should your AI assistant be called?
            </label>
            <input
              type="text"
              id="kendallName"
              value={formData.kendallName || ''}
              onChange={(e) => setFormData({ ...formData, kendallName: e.target.value })}
              className="w-full px-5 py-4 text-lg font-light transition-all duration-300 focus:outline-none"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: colors.text,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
              }}
              placeholder="Kendall (or enter a custom name)"
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.accent;
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.accent}15, 0 0 20px ${colors.accent}20`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <p
              className="mt-3 text-sm"
              style={{
                color: colors.text,
                opacity: 0.6,
                fontFamily: 'var(--font-inter), sans-serif',
              }}
            >
              This is the name callers will hear when they call your assistant.
            </p>
          </div>
        );
        
      case 4:
        return (
          <PersonalityTraitCards
            selectedTraits={formData.selectedTraits || []}
            onSelectionChange={(traits) => setFormData({ ...formData, selectedTraits: traits })}
            maxSelections={3}
            traitDescriptions={formData.traitDescriptions || {}}
            onTraitDescriptionChange={(trait, description) => {
              setFormData({
                ...formData,
                traitDescriptions: {
                  ...(formData.traitDescriptions || {}),
                  [trait]: description,
                },
              });
            }}
          />
        );
        
      case 5:
        return (
          <UseCaseCards
            selectedUseCase={formData.useCaseChoice || null}
            onSelectionChange={(useCase) => setFormData({ ...formData, useCaseChoice: useCase })}
          />
        );
        
      case 6:
        return (
          <div className="space-y-16" style={{ paddingBottom: '2rem' }}>
            <div>
              <label
                htmlFor="userContextAndRules"
                className="block text-sm font-light mb-5"
                style={{ color: colors.text, opacity: 0.9 }}
              >
                Tell Kendall about yourself and any specific rules{' '}
                <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                id="userContextAndRules"
                value={formData.userContextAndRules || ''}
                onChange={(e) => setFormData({ ...formData, userContextAndRules: e.target.value })}
                rows={8}
                className="w-full px-5 py-4 text-base font-light transition-all duration-300 focus:outline-none resize-none"
                style={{
                  backgroundColor: errors.userContextAndRules 
                    ? 'rgba(239, 68, 68, 0.1)' 
                    : 'rgba(255, 255, 255, 0.05)',
                  color: colors.text,
                  border: `1px solid ${errors.userContextAndRules ? '#ef4444' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '12px',
                  minHeight: '150px',
                  backdropFilter: 'blur(10px)',
                }}
                placeholder={getPlaceholderExamples(formData.useCaseChoice) || ''}
                onFocus={(e) => {
                  if (!errors.userContextAndRules) {
                    e.currentTarget.style.borderColor = colors.accent;
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.accent}15, 0 0 20px ${colors.accent}20`;
                  }
                }}
                onBlur={(e) => {
                  if (!errors.userContextAndRules) {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              />
              {errors.userContextAndRules && (
                <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <p className="text-sm" style={{ color: '#ef4444' }}>
                    {errors.userContextAndRules}
                  </p>
                </div>
              )}
              <p
                className="mt-2 text-sm"
                style={{
                  color: colors.text,
                  opacity: 0.6,
                  fontFamily: 'var(--font-inter), sans-serif',
                }}
              >
                Include what you do, what callers might ask about, and any rules or preferences
              </p>
            </div>
            
            <div>
              <label
                className="block text-sm font-light mb-5"
                style={{ color: colors.text, opacity: 0.9 }}
              >
                Upload Files (optional)
              </label>
              <p
                className="mb-4 text-sm"
                style={{
                  color: colors.text,
                  opacity: 0.6,
                  fontFamily: 'var(--font-inter), sans-serif',
                }}
              >
                Upload documents, resumes, or any files that contain information about you. Kendall will analyze these to better understand your context.
              </p>
              
              <div
                className="border-2 border-dashed rounded-lg p-6 transition-all duration-300"
                style={{
                  borderColor: uploadingFiles ? colors.accent : 'rgba(255, 255, 255, 0.2)',
                  backgroundColor: uploadingFiles ? `${colors.accent}10` : 'rgba(255, 255, 255, 0.02)',
                  boxShadow: uploadingFiles ? `0 0 20px ${colors.accent}30` : 'none',
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!uploadingFiles) {
                    e.currentTarget.style.borderColor = colors.accent;
                    e.currentTarget.style.backgroundColor = `${colors.accent}15`;
                    e.currentTarget.style.boxShadow = `0 0 30px ${colors.accent}40`;
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }
                }}
                onDragLeave={(e) => {
                  if (!uploadingFiles) {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'scale(1)';
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!uploadingFiles) {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'scale(1)';
                    const files = Array.from(e.dataTransfer.files);
                    handleFileUpload(files);
                  }
                }}
              >
                <input
                  type="file"
                  id="fileUpload"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files ? Array.from(e.target.files) : [];
                    handleFileUpload(files);
                  }}
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                />
                <label
                  htmlFor="fileUpload"
                  className="flex flex-col items-center justify-center cursor-pointer"
                >
                  <div
                    className="mb-3 flex items-center justify-center"
                    style={{ color: colors.accent }}
                  >
                    <Paperclip size={32} style={{ color: colors.accent }} />
                  </div>
                  <p
                    className="text-sm font-medium mb-1"
                    style={{ color: uploadingFiles ? colors.accent : colors.text }}
                  >
                    {uploadingFiles ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" style={{ color: colors.accent }} />
                        Uploading files...
                      </span>
                    ) : (
                      'Click to upload or drag and drop'
                    )}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: colors.text, opacity: 0.6 }}
                  >
                    PDF, DOC, DOCX, TXT, JPG, PNG (Max 10MB per file)
                  </p>
                </label>
              </div>
              
              {uploadedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span style={{ color: colors.accent }}>
                          ✓
                        </span>
                        <span
                          className="text-sm truncate"
                          style={{ color: colors.text, opacity: 0.9 }}
                          title={file.filename}
                        >
                          {file.filename}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: colors.text, opacity: 0.5 }}
                        >
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: colors.accent, opacity: 0.8 }}
                        >
                          Uploaded
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const fileToRemove = uploadedFiles[index];
                          const newFiles = uploadedFiles.filter((_, i) => i !== index);
                          setUploadedFiles(newFiles);
                          
                          // Remove this file's URL from attachedFileUrls
                          setFormData(prev => ({
                            ...prev,
                            attachedFileUrls: (prev.attachedFileUrls || []).filter(
                              f => f.url !== fileToRemove.url
                            ),
                          }));
                        }}
                        className="ml-3 px-3 py-1 text-xs rounded transition-all duration-200"
                        style={{
                          color: '#ef4444',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* File Usage Instructions */}
              <div className="mt-6">
                <label
                  htmlFor="fileUsageInstructions"
                  className="block text-sm font-light mb-5"
                  style={{ color: colors.text, opacity: 0.9 }}
                >
                  How should Kendall use information from these files? <span style={{ color: colors.text, opacity: 0.6 }}>(optional)</span>
                </label>
                <textarea
                  id="fileUsageInstructions"
                  value={formData.fileUsageInstructions || ''}
                  onChange={(e) => setFormData({ ...formData, fileUsageInstructions: e.target.value })}
                  rows={4}
                  className="w-full px-5 py-4 text-base font-light transition-all duration-300 focus:outline-none resize-none"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: colors.text,
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    backdropFilter: 'blur(10px)',
                  }}
                  placeholder={formData.useCaseChoice === 'Clients & Customers' 
                    ? "Example: If someone asks about pricing, use the prices from the attached documents."
                    : "Example: Focus on my consulting experience from the resume, not my early jobs. The skills section is most up-to-date."}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = colors.accent;
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.accent}15, 0 0 20px ${colors.accent}20`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <p
                  className="mt-2 text-sm"
                  style={{
                    color: colors.text,
                    opacity: 0.6,
                    fontFamily: 'var(--font-inter), sans-serif',
                  }}
                >
                  Provide guidance on how your assistant should use the information from your uploaded files
                </p>
              </div>
            </div>
          </div>
        );
        
      case 7:
        // Review & Preview Step - Full version with voice preview
        const previewText = getPreviewText();
        
        return (
          <div className="flex flex-col" style={{ gap: '2rem' }}>
            <div>
              <p
                className="text-sm mb-6"
                style={{
                  color: colors.text,
                  opacity: 0.7,
                  fontFamily: 'var(--font-inter), sans-serif',
                }}
              >
                Review your selections below and listen to a sample of how your agent will speak.
              </p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className="p-4 rounded-lg"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <p className="text-xs mb-1" style={{ color: colors.text, opacity: 0.6 }}>Voice</p>
                <p className="text-sm font-medium" style={{ color: colors.text }}>
                  {formData.voiceChoice || 'Not selected'}
                </p>
              </div>
              <div
                className="p-4 rounded-lg"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <p className="text-xs mb-1" style={{ color: colors.text, opacity: 0.6 }}>Kendall Name</p>
                <p className="text-sm font-medium" style={{ color: colors.text }}>
                  {formData.kendallName || 'Kendall'}
                </p>
              </div>
              <div
                className="p-4 rounded-lg"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <p className="text-xs mb-1" style={{ color: colors.text, opacity: 0.6 }}>Personality</p>
                <p className="text-sm font-medium" style={{ color: colors.text }}>
                  {formData.selectedTraits?.join(', ') || 'None selected'}
                </p>
              </div>
              <div
                className="p-4 rounded-lg"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <p className="text-xs mb-1" style={{ color: colors.text, opacity: 0.6 }}>Use Case</p>
                <p className="text-sm font-medium" style={{ color: colors.text }}>
                  {formData.useCaseChoice || 'Not selected'}
                </p>
              </div>
            </div>

            {/* Voice Preview Section */}
            {formData.voiceChoice ? (
              <div
                className="p-6 rounded-lg"
                style={{
                  backgroundColor: `${colors.accent}10`,
                  border: `1px solid ${colors.accent}30`,
                }}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 mt-1">
                    <Volume2 
                      size={20} 
                      style={{ color: colors.accent }}
                    />
                  </div>
                  <div className="flex-1">
                    <h4
                      className="text-base font-medium mb-2"
                      style={{
                        color: colors.text,
                        fontFamily: 'var(--font-inter), sans-serif',
                      }}
                    >
                      Preview: How Your Agent Will Speak
                    </h4>
                    <p
                      className="text-sm mb-4"
                      style={{
                        color: colors.text,
                        opacity: 0.7,
                        fontFamily: 'var(--font-inter), sans-serif',
                      }}
                    >
                      Listen to a sample of how {formData.kendallName || 'Kendall'} will speak with your selected personality and voice.
                    </p>
                    
                    {/* Sample of how agent will speak */}
                    <div
                      className="p-4 mb-4 rounded-lg"
                      style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      <p
                        className="text-xs mb-2"
                        style={{
                          color: colors.text,
                          opacity: 0.6,
                          fontFamily: 'var(--font-inter), sans-serif',
                        }}
                      >
                        Sample conversation:
                      </p>
                      <p
                        className="text-sm italic"
                        style={{
                          color: colors.text,
                          opacity: 0.8,
                          fontFamily: 'var(--font-inter), sans-serif',
                          lineHeight: '1.6',
                        }}
                      >
                        "{previewText}"
                      </p>
                    </div>

                    {/* Preview button */}
                    <button
                      onClick={handlePreviewContent}
                      disabled={isLoadingContent || !formData.voiceChoice}
                      className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: isPlayingContent 
                          ? 'rgba(239, 68, 68, 0.2)' 
                          : colors.accent,
                        color: isPlayingContent ? '#ef4444' : '#000',
                        border: `1px solid ${isPlayingContent ? '#ef4444' : colors.accent}`,
                        boxShadow: isPlayingContent 
                          ? 'none'
                          : `0 0 20px ${colors.accent}60, 0 0 40px ${colors.accent}40, 0 8px 32px ${colors.accent}50`,
                      }}
                      onMouseEnter={(e) => {
                        if (!isLoadingContent && formData.voiceChoice) {
                          if (!isPlayingContent) {
                            e.currentTarget.style.backgroundColor = `${colors.accent}dd`;
                            e.currentTarget.style.boxShadow = `0 0 30px ${colors.accent}70, 0 0 60px ${colors.accent}50, 0 8px 32px ${colors.accent}60`;
                            e.currentTarget.style.transform = 'scale(1.02)';
                          }
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isLoadingContent && formData.voiceChoice) {
                          if (!isPlayingContent) {
                            e.currentTarget.style.backgroundColor = colors.accent;
                            e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}60, 0 0 40px ${colors.accent}40, 0 8px 32px ${colors.accent}50`;
                            e.currentTarget.style.transform = 'scale(1)';
                          }
                        }
                      }}
                    >
                      {isLoadingContent ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>Generating Sample...</span>
                        </>
                      ) : isPlayingContent ? (
                        <>
                          <Volume2 size={18} />
                          <span>Playing Sample...</span>
                        </>
                      ) : (
                        <>
                          <Play size={18} fill="currentColor" />
                          <span>Play Sample of How Your Agent Speaks</span>
                        </>
                      )}
                    </button>

                    <p
                      className="text-xs mt-3"
                      style={{
                        color: colors.text,
                        opacity: 0.5,
                        fontFamily: 'var(--font-inter), sans-serif',
                      }}
                    >
                      Want to change your voice? Go back to Step 2 to select a different one.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="p-6 rounded-lg flex flex-col items-center gap-3"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <Volume2 size={32} style={{ color: colors.accent, opacity: 0.7 }} />
                <div className="text-center">
                  <p
                    className="text-base font-medium mb-2"
                    style={{
                      color: colors.text,
                      fontFamily: 'var(--font-inter), sans-serif',
                    }}
                  >
                    No Voice Selected
                  </p>
                  <p
                    className="text-sm"
                    style={{
                      color: colors.text,
                      opacity: 0.7,
                      fontFamily: 'var(--font-inter), sans-serif',
                    }}
                  >
                    Please go back to Step 2 to choose a voice before completing setup.
                  </p>
                </div>
              </div>
            )}

            <p
              className="text-xs mt-4"
              style={{
                color: colors.text,
                opacity: 0.5,
                fontFamily: 'var(--font-inter), sans-serif',
                textAlign: 'center',
              }}
            >
              Step 7 of 7 - Click "Complete Setup" to finish
            </p>
          </div>
        );
        
      default:
        return null;
    }
  };

  const stepTitles = [
    'Intro MyKendall',
    'Vocalize MyKendall',
    'Name MyKendall',
    'Personalize MyKendall',
    'Use MyKendall',
    'About MyKendall',
    'Preview & Review MyKendall',
  ];

  const wizardContainerRef = useRef<HTMLDivElement | null>(null);
  const isVocalizationStep = currentStep === 2;

  // Lock background scroll while wizard is mounted
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Scroll to top when step changes
  useEffect(() => {
    if (wizardContainerRef.current) {
      wizardContainerRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }, [currentStep]);

  return (
    <div
      className={isVocalizationStep ? 'w-full max-w-[1200px] mx-auto' : 'w-full max-w-[900px] mx-auto'}
      ref={wizardContainerRef}
      style={{ paddingTop: isVocalizationStep ? '2.5rem' : 'clamp(2rem, 4vw, 3rem)' }}
    >
      <div
        className={isVocalizationStep ? 'mb-8 sm:mb-10' : 'mb-6 sm:mb-8'}
        style={{ marginTop: isVocalizationStep ? '1.5rem' : '1rem', scrollMarginTop: '120px' }}
      >
        <ProgressIndicator currentStep={currentStep} totalSteps={totalSteps} stepNames={stepTitles} />
      </div>
      <div 
        className="rounded-3xl transition-all duration-500"
        style={{
          border: `1px solid ${colors.accent}30`,
          boxShadow: `
            0 20px 60px rgba(0, 0, 0, 0.6),
            0 0 80px ${colors.accent}30,
            0 0 120px ${colors.accent}20,
            0 0 160px ${colors.accent}10
          `,
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(30px) saturate(180%)',
          transform: 'perspective(1000px) translateZ(50px) scale(1.02)',
          transformStyle: 'preserve-3d',
          padding: 'clamp(2.5rem, 5vw, 4rem)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 'calc(100vh - 200px)',
          height: 'calc(100vh - 200px)',
          maxHeight: 'calc(100vh - 200px)',
        }}
      >
      
      <div
        className={`${isVocalizationStep ? 'mb-4 sm:mb-5' : 'mb-6 sm:mb-8'} text-center`}
        style={{
          position: 'relative',
          minHeight: '50px',
        }}
      >
        <h2
          className="text-2xl sm:text-3xl lg:text-4xl font-light"
          style={{
            color: colors.text,
            fontFamily: 'var(--font-league-spartan), sans-serif',
            fontWeight: 400,
            letterSpacing: '-0.02em',
          }}
        >
          {currentStep === 1 ? (
            <>
              Intro My<span style={{ 
                color: colors.accent,
                fontFamily: 'var(--font-league-spartan), sans-serif',
                fontWeight: 700,
              }}>Kendall</span>
            </>
          ) : currentStep === 2 ? (
            <>
              Vocalize My<span style={{ 
                color: colors.accent,
                fontFamily: 'var(--font-league-spartan), sans-serif',
                fontWeight: 700,
              }}>Kendall</span>
            </>
          ) : currentStep === 3 ? (
            <>
              Name My<span style={{ 
                color: colors.accent,
                fontFamily: 'var(--font-league-spartan), sans-serif',
                fontWeight: 700,
              }}>Kendall</span>
            </>
          ) : currentStep === 4 ? (
            <>
              Personalize My<span style={{ 
                color: colors.accent,
                fontFamily: 'var(--font-league-spartan), sans-serif',
                fontWeight: 700,
              }}>Kendall</span>
            </>
          ) : currentStep === 5 ? (
            <>
              Use My<span style={{ 
                color: colors.accent,
                fontFamily: 'var(--font-league-spartan), sans-serif',
                fontWeight: 700,
              }}>Kendall</span>
            </>
          ) : currentStep === 6 ? (
            <>
              About My<span style={{ 
                color: colors.accent,
                fontFamily: 'var(--font-league-spartan), sans-serif',
                fontWeight: 700,
              }}>Kendall</span>
            </>
          ) : currentStep === 7 ? (
            <>
              Preview & Review My<span style={{ 
                color: colors.accent,
                fontFamily: 'var(--font-league-spartan), sans-serif',
                fontWeight: 700,
              }}>Kendall</span>
            </>
          ) : (
            stepTitles[currentStep - 1]
          )}
        </h2>
        {/* Helper text for Personalize MyKendall step */}
        {currentStep === 4 && (
          <p
            className="mt-4 text-center text-sm"
            style={{
              color: colors.text,
              opacity: 0.6,
              fontFamily: 'var(--font-inter), sans-serif',
            }}
          >
            Pick up to 3 traits that best describe how your agent should sound
          </p>
        )}
      </div>
      
      <div 
        ref={stepContentRef}
        style={{ 
          position: 'relative',
          flex: '1',
          minHeight: 0,
          height: '100%',
          marginTop: '1rem',
          marginBottom: '1rem',
          paddingBottom: currentStep === 6 ? '4rem' : '0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
          <WizardStep key={step} isActive={currentStep === step}>
            {renderStepContent()}
          </WizardStep>
        ))}
      </div>
      
      <WizardNav
        currentStep={currentStep}
        totalSteps={totalSteps}
        canGoBack={currentStep > 1}
        canContinue={canContinue()}
        onBack={handleBack}
        onNext={handleNext}
        isLoading={isSubmitting}
      />
      </div>
    </div>
  );
}

