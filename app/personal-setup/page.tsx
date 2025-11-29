'use client';

import { useState, Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { colors } from '@/lib/config';
import OnboardingWizard, { WizardData } from '@/components/OnboardingWizard';
import AnimatedBackground from '@/components/AnimatedBackground';
import confetti from 'canvas-confetti';

function PersonalSetupPageContent() {
  const searchParams = useSearchParams();
  const editRecordId = searchParams?.get('edit') || null;
  const [isEditMode] = useState(!!editRecordId);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [initialData, setInitialData] = useState<WizardData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Load existing data when in edit mode
  useEffect(() => {
    if (isEditMode && editRecordId && !initialData && !isLoadingData) {
      setIsLoadingData(true);
      
      fetch(`/api/getMyKendall?recordId=${encodeURIComponent(editRecordId)}`)
        .then(async (response) => {
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to load your Kendall data');
          }
          return response.json();
        })
        .then((data) => {
          if (data.success && data.record?.fields) {
            const fields = data.record.fields;
            
            // Map Airtable record to WizardData format
            const mappedData: WizardData = {
              fullName: fields.fullName || '',
              email: fields.email || '',
              mobileNumber: fields.mobileNumber || '',
              nickname: fields.nickname || undefined,
              kendallName: fields.kendallName || 'Kendall',
              selectedTraits: fields.personalityChoices 
                ? (typeof fields.personalityChoices === 'string' 
                  ? fields.personalityChoices.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0)
                  : Array.isArray(fields.personalityChoices) 
                    ? fields.personalityChoices.map((t: string) => String(t).trim()).filter((t: string) => t.length > 0)
                    : [])
                : [],
              useCaseChoice: fields.useCaseChoice || '',
              boundaryChoices: fields.boundaryChoices
                ? (typeof fields.boundaryChoices === 'string'
                  ? fields.boundaryChoices.split(',').map((b: string) => b.trim()).filter((b: string) => b.length > 0)
                  : Array.isArray(fields.boundaryChoices)
                    ? fields.boundaryChoices.map((b: string) => String(b).trim()).filter((b: string) => b.length > 0)
                    : [])
                : [],
              userContextAndRules: [
                fields.userContext || '',
                fields.additionalInstructions || ''
              ].filter(Boolean).join('\n\n'),
              forwardCalls: fields.forwardCalls === 'Y' || fields.forwardCalls === true,
              voiceChoice: fields.voiceChoice || undefined,
              attachedFileUrls: fields.attachedFiles 
                ? (Array.isArray(fields.attachedFiles) 
                  ? fields.attachedFiles
                      .map((file: any) => {
                        // Handle Airtable attachment format: { id, url, filename, size, type }
                        if (typeof file === 'object' && file !== null) {
                          return {
                            url: file.url || '',
                            filename: file.filename || 'file',
                          };
                        }
                        // Fallback for string URLs
                        if (typeof file === 'string') {
                          return {
                            url: file,
                            filename: 'file',
                          };
                        }
                        return null;
                      })
                      .filter((f: any) => f !== null && f.url) // Remove invalid entries
                  : [])
                : undefined,
              fileUsageInstructions: fields.fileUsageInstructions || undefined,
            };
            
            setInitialData(mappedData);
          } else {
            throw new Error('Invalid data format received');
          }
        })
        .catch((error) => {
          console.error('Error loading edit data:', error);
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load your Kendall data. Please try again.');
          setSubmitStatus('error');
        })
        .finally(() => {
          setIsLoadingData(false);
        });
    }
  }, [isEditMode, editRecordId, initialData, isLoadingData]);

  // Confetti effect on success
  const triggerConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

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
  };

  const handleSubmit = async (data: WizardData) => {
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      // Use update endpoint if in edit mode, otherwise create endpoint
      const endpoint = isEditMode && editRecordId ? '/api/updateMyKendall' : '/api/createMyKendall';
      const method = isEditMode && editRecordId ? 'PATCH' : 'POST';
      
      const requestBody: any = {
        fullName: data.fullName.trim(),
        email: data.email.trim(),
        mobileNumber: data.mobileNumber.trim(),
        kendallName: data.kendallName.trim(),
        nickname: data.nickname?.trim() || undefined,
        selectedTraits: data.selectedTraits,
        useCaseChoice: data.useCaseChoice,
        boundaryChoices: data.boundaryChoices,
        userContextAndRules: data.userContextAndRules.trim(),
        forwardCalls: data.forwardCalls || false,
        voiceChoice: data.voiceChoice || undefined,
        attachedFileUrls: data.attachedFileUrls || undefined,
        fileUsageInstructions: data.fileUsageInstructions?.trim() || undefined,
      };

      // Add recordId for update requests
      if (isEditMode && editRecordId) {
        requestBody.recordId = editRecordId;
      }

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();

      if (!response.ok || !responseData.success) {
        throw new Error(responseData.error || 'Failed to save your information');
      }

      // Success
      setSubmitStatus('success');
      triggerConfetti();
      
      if (!isEditMode) {
        console.log('My Kendall created successfully:', {
          agentId: responseData.agentId,
          phoneNumber: responseData.phoneNumber,
          recordId: responseData.recordId,
        });
        
        // Store recordId in localStorage for "Edit MyKendall" link
        if (responseData.recordId) {
          localStorage.setItem('myKendallRecordId', responseData.recordId);
        }
      } else if (editRecordId) {
        // Also store recordId when updating (in case it wasn't stored before)
        localStorage.setItem('myKendallRecordId', editRecordId);
      }
    } catch (error) {
      setSubmitStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main 
      className="min-h-screen flex flex-col items-center px-6 sm:px-8 lg:px-12 xl:px-16 pb-12 sm:pb-16 lg:pb-24" 
      style={{ 
        paddingTop: 'clamp(100px, 15vw, 150px)', 
        position: 'relative', 
        zIndex: 10,
        backgroundColor: colors.primary,
      }}
    >
      <AnimatedBackground />
      <div className="w-full max-w-[1400px] flex flex-col items-center justify-center" style={{ position: 'relative', zIndex: 10, minHeight: 'calc(100vh - 200px)' }}>
        {/* Edit MyKendall Header - Between navbar and wizard (only in edit mode) */}
        {isEditMode && !isLoadingData && (
          <div className="w-full text-center" style={{ marginTop: 'clamp(2rem, 5vw, 4rem)', marginBottom: 'clamp(2rem, 5vw, 4rem)' }}>
            <h1 
              style={{
                fontFamily: 'var(--font-league-spartan), sans-serif',
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                fontWeight: 700,
                color: colors.text,
              }}
            >
              Edit <span style={{ color: colors.text }}>My</span><span style={{ color: colors.accent }}>Kendall</span>
            </h1>
          </div>
        )}
        
        {/* Success Message - Centered and bigger */}
        {submitStatus === 'success' && (
          <div
            className="text-center rounded-xl"
            style={{
              backgroundColor: `${colors.accent}15`,
              border: `6px solid ${colors.accent}`,
              color: colors.text,
              boxShadow: `0 8px 32px ${colors.accent}40, 0 0 60px ${colors.accent}30`,
              padding: 'clamp(3rem, 6vw, 5rem) clamp(4rem, 8vw, 6rem)',
              maxWidth: '600px',
              width: '100%',
            }}
          >
            <div className="mb-6" style={{ fontSize: '4rem' }}>
              <span style={{ color: colors.accent, fontWeight: 600 }}>✓</span>
            </div>
            <div className="text-2xl sm:text-3xl font-medium">
              {isEditMode 
                ? (
                  <>
                    <div>My<span style={{ color: colors.accent, fontFamily: 'var(--font-league-spartan), sans-serif', fontWeight: 700 }}>Kendall</span></div>
                    <div style={{ marginTop: '1rem' }}>has been updated!</div>
                  </>
                )
                : (
                  <>
                    <div>My<span style={{ color: colors.accent, fontFamily: 'var(--font-league-spartan), sans-serif', fontWeight: 700 }}>Kendall</span></div>
                    <div style={{ marginTop: '1rem' }}>has been set up successfully!</div>
                  </>
                )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {submitStatus === 'error' && (
          <div
            className="mb-8 px-6 py-4 text-center rounded-lg"
            style={{
              backgroundColor: '#ef444420',
              border: '1px solid #ef4444',
              color: '#ef4444',
            }}
          >
            <p className="text-sm">
              {errorMessage || 'An error occurred. Please try again.'}
            </p>
          </div>
        )}

        {/* Show wizard unless we're in success state */}
        {submitStatus !== 'success' && (
          isLoadingData ? (
            <div className="text-center py-12">
              <p style={{ color: colors.text, opacity: 0.8 }}>Loading your Kendall configuration...</p>
            </div>
          ) : (
            <OnboardingWizard 
              onSubmit={handleSubmit} 
              isSubmitting={isSubmitting}
              initialData={initialData || undefined}
              isEditMode={isEditMode}
            />
          )
        )}
      </div>
    </main>
  );
}

export default function PersonalSetupPage() {
  return (
    <Suspense fallback={
      <main 
        className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8" 
        style={{ 
          paddingTop: 'clamp(120px, 18vw, 180px)', 
          position: 'relative', 
          zIndex: 10,
          backgroundColor: colors.primary,
        }}
      >
        <AnimatedBackground />
        <div className="text-center" style={{ position: 'relative', zIndex: 10 }}>
          <p style={{ color: colors.text, opacity: 0.8 }}>Loading...</p>
        </div>
      </main>
    }>
      <PersonalSetupPageContent />
    </Suspense>
  );
}
