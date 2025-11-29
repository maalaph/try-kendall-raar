'use client';

import React, { useState, useRef, useEffect } from 'react';
import QuestionCard from './QuestionCard';
import { colors } from '@/lib/config';
import { Heart, Briefcase, Crown, Sparkles, Zap, MessageSquare, Lightbulb, CheckCircle, Play, Loader2, Volume2, X } from 'lucide-react';

interface PersonalityTraitCardsProps {
  selectedTraits: string[];
  onSelectionChange: (traits: string[]) => void;
  maxSelections?: number;
  traitDescriptions?: Record<string, string>; // Map of trait -> description
  onTraitDescriptionChange?: (trait: string, description: string) => void;
}

const PERSONALITY_TRAITS = [
  'Friendly',
  'Professional',
  'Confident',
  'Witty',
  'Rude',
  'Sarcastic',
  'Arrogant',
  'Blunt',
  'Sassy',
];

// Custom speech bubble icon for Rude trait
const RudeIcon = ({ className = '', size = 32, color = colors.text, strokeWidth = 2 }: { className?: string; size?: number; color?: string; strokeWidth?: number }) => {
  const iconColor = color || colors.text;
  return (
    <div className={className} style={{ position: 'relative', width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Speech bubble - wider to fit text better */}
        <path
          d="M6 4C3.23858 4 1 6.23858 1 9V27C1 29.7614 3.23858 32 6 32H12V40L20 32H38C40.7614 32 43 29.7614 43 27V9C43 6.23858 40.7614 4 38 4H6Z"
          stroke={iconColor}
          strokeWidth={strokeWidth * 1.3}
          fill="transparent"
        />
        {/* Triangle tail - larger */}
        <path
          d="M12 32L4 40V32H12Z"
          stroke={iconColor}
          strokeWidth={strokeWidth * 1.3}
          fill="transparent"
        />
        {/* Text - larger and better positioned with more space */}
        <text
          x="22"
          y="22"
          fontSize="14"
          fontWeight="700"
          fill={iconColor}
          fontFamily="var(--font-inter), sans-serif"
          textAnchor="middle"
        >
          F***
        </text>
      </svg>
    </div>
  );
};

// Custom "Ha ha" text icon for Sarcastic trait
const SarcasticIcon = ({ className = '', size = 32, color = colors.text, strokeWidth = 2 }: { className?: string; size?: number; color?: string; strokeWidth?: number }) => {
  // Always use full opacity accent color for vibrant text
  const iconColor = colors.accent;
  return (
    <div className={className} style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 70 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        {/* Ha ha text - larger and vibrant, fully visible */}
        <text
          x="35"
          y="30"
          fontSize="24"
          fontWeight="700"
          fill={iconColor}
          fillOpacity="1"
          fontFamily="var(--font-inter), sans-serif"
          textAnchor="middle"
          letterSpacing="2"
        >
          Ha ha
        </text>
      </svg>
    </div>
  );
};

// Tilted crown icon wrapper for Arrogant trait
const ArrogantIcon = ({ className = '', size = 32, color = colors.text, strokeWidth = 2 }: { className?: string; size?: number; color?: string; strokeWidth?: number }) => {
  return (
    <div className={className} style={{ position: 'relative', width: size, height: size, transform: 'rotate(-18deg)' }}>
      <Crown size={size} color={color} strokeWidth={strokeWidth} />
    </div>
  );
};


// Custom nail polish icon for Sassy trait
const SassyIcon = ({ className = '', size = 32, color = colors.text, strokeWidth = 2 }: { className?: string; size?: number; color?: string; strokeWidth?: number }) => {
  const iconColor = color || colors.text;
  return (
    <div className={className} style={{ position: 'relative', width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Hand outline */}
        <path
          d="M16 38 L16 34 L18 30 L20 26 L22 22 L24 18 L26 14 L28 12 L30 10 L32 8 L34 10 L36 12 L38 14 L38 16 L36 18 L34 20 L32 22 L30 24 L28 26 L26 28 L24 30 L22 32 L20 34 L18 36 L16 38 Z"
          stroke={iconColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Thumb */}
        <path
          d="M16 38 Q14 36 12 36 Q10 38 12 40 Q14 42 16 40"
          stroke={iconColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Polished nails - rounded rectangles at fingertips */}
        <rect x="26" y="8" width="6" height="4" rx="1" fill={iconColor} opacity="0.9" />
        <rect x="30" y="12" width="6" height="4" rx="1" fill={iconColor} opacity="0.9" />
        <rect x="32" y="16" width="5" height="4" rx="1" fill={iconColor} opacity="0.9" />
        <rect x="34" y="20" width="4" height="4" rx="1" fill={iconColor} opacity="0.9" />
        <rect x="12" y="38" width="5" height="3" rx="1" fill={iconColor} opacity="0.9" />
        {/* Wrist band/line */}
        <line
          x1="18"
          y1="38"
          x2="22"
          y2="38"
          stroke={iconColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

// Function to get icon for a trait
const getTraitIcon = (trait: string): React.ReactNode => {
  const iconProps = { size: 40 }; // Increased from 32 to 40 for better prominence
  
  switch (trait) {
    case 'Friendly':
      return <Heart {...iconProps} />;
    case 'Professional':
      return <Briefcase {...iconProps} />;
    case 'Confident':
      return <CheckCircle {...iconProps} />;
    case 'Witty':
      return <Lightbulb {...iconProps} />;
    case 'Rude':
      return <RudeIcon {...iconProps} />;
    case 'Sarcastic':
      return <SarcasticIcon {...iconProps} />;
    case 'Arrogant':
      return <ArrogantIcon {...iconProps} />;
    case 'Blunt':
      return <Zap {...iconProps} />;
    case 'Sassy':
      return <Sparkles {...iconProps} />;
    default:
      return null;
  }
};

export default function PersonalityTraitCards({
  selectedTraits,
  onSelectionChange,
  maxSelections = 3,
  traitDescriptions = {},
  onTraitDescriptionChange,
}: PersonalityTraitCardsProps) {
  const [expandedTraits, setExpandedTraits] = useState<Set<string>>(new Set());
  const [generatingSamples, setGeneratingSamples] = useState<Set<string>>(new Set());
  const [playingSamples, setPlayingSamples] = useState<Set<string>>(new Set());
  const [traitSamples, setTraitSamples] = useState<Record<string, Array<{ id: string; audioBase64: string; name: string }>>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  // Cleanup audio on unmount or when traits are deselected
  useEffect(() => {
    return () => {
      // Cleanup all audio on unmount
      Object.keys(audioRefs.current).forEach(key => {
        if (audioRefs.current[key]) {
          try {
            audioRefs.current[key]?.pause();
            audioRefs.current[key] = null;
          } catch (e) {
            console.warn('[TRAIT SAMPLES] Cleanup error:', e);
          }
        }
      });
    };
  }, []);

  // Cleanup audio when traits are deselected
  useEffect(() => {
    // Remove samples and cleanup audio for deselected traits
    const currentTraits = new Set(selectedTraits);
    
    // Get traits that were deselected
    const previousTraits = Object.keys(traitSamples);
    const deselectedTraits = previousTraits.filter(trait => !currentTraits.has(trait));
    
    if (deselectedTraits.length > 0) {
      // Cleanup audio for deselected traits
      deselectedTraits.forEach(trait => {
        if (audioRefs.current[trait]) {
          try {
            audioRefs.current[trait]?.pause();
            audioRefs.current[trait] = null;
          } catch (e) {
            console.warn('[TRAIT SAMPLES] Cleanup error:', e);
          }
        }
      });
      
      // Remove from samples
      const newSamples = { ...traitSamples };
      deselectedTraits.forEach(trait => {
        delete newSamples[trait];
      });
      setTraitSamples(newSamples);
      
      // Remove from expanded
      const newExpanded = new Set(expandedTraits);
      deselectedTraits.forEach(trait => {
        newExpanded.delete(trait);
      });
      setExpandedTraits(newExpanded);
      
      // Remove from playing
      setPlayingSamples(prev => {
        const newPlaying = new Set(prev);
        deselectedTraits.forEach(trait => {
          newPlaying.delete(trait);
        });
        return newPlaying;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTraits]);

  const handleTraitClick = (trait: string) => {
    // Validate trait
    if (!trait || typeof trait !== 'string' || !trait.trim()) {
      console.error('[TRAIT CARDS] Invalid trait:', trait);
      return;
    }

    if (selectedTraits.includes(trait)) {
      // Deselect
      onSelectionChange(selectedTraits.filter(t => t !== trait));
      // Clean up audio
      if (audioRefs.current[trait]) {
        try {
          audioRefs.current[trait]?.pause();
          audioRefs.current[trait] = null;
        } catch (e) {
          console.warn('[TRAIT CARDS] Error stopping audio:', e);
        }
      }
      // Remove from expanded
      const newExpanded = new Set(expandedTraits);
      newExpanded.delete(trait);
      setExpandedTraits(newExpanded);
      // Remove from playing
      setPlayingSamples(new Set([...playingSamples].filter(t => t !== trait)));
    } else {
      // Select if under max
      if (selectedTraits.length < maxSelections) {
        onSelectionChange([...selectedTraits, trait]);
        // Auto-expand when selected
        setExpandedTraits(new Set([...expandedTraits, trait]));
      }
    }
  };

  const toggleExpanded = (trait: string) => {
    const newExpanded = new Set(expandedTraits);
    if (newExpanded.has(trait)) {
      newExpanded.delete(trait);
    } else {
      newExpanded.add(trait);
    }
    setExpandedTraits(newExpanded);
  };

  const handleGenerateSamples = async (trait: string) => {
    // Validate trait
    if (!trait || typeof trait !== 'string' || !trait.trim()) {
      console.error('[TRAIT SAMPLES] Invalid trait:', trait);
      alert('Invalid trait selected. Please try again.');
      return;
    }

    // Prevent duplicate requests
    if (generatingSamples.has(trait)) {
      console.warn('[TRAIT SAMPLES] Generation already in progress for:', trait);
      return;
    }

    const description = (traitDescriptions[trait] || '').trim();
    
    // Validate description
    if (!description) {
      alert('Please enter a description of how you want this trait to sound.');
      return;
    }

    if (description.length < 10) {
      alert('Please provide a more detailed description (at least 10 characters).');
      return;
    }

    if (description.length > 500) {
      alert('Description is too long. Please keep it under 500 characters.');
      return;
    }

    // Build voice description combining trait + user description
    // Sanitize trait name to avoid issues
    const sanitizedTrait = trait.toLowerCase().trim().replace(/[^a-z0-9\s-]/gi, '');
    const fullDescription = `${sanitizedTrait} voice, ${description}`;

    // Validate final description length (RAAR requires 20-1000 chars)
    if (fullDescription.length < 20) {
      alert('The description is too short. Please add more details about how you want this trait to sound.');
      return;
    }

    if (fullDescription.length > 1000) {
      alert('The description is too long. Please shorten it.');
      return;
    }

    setGeneratingSamples(new Set([...generatingSamples, trait]));

    try {
      const response = await fetch('/api/generateVoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: fullDescription }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate voice samples.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          
          // Provide helpful error messages
          if (errorData.requirements) {
            if (errorData.requirements.minLength && fullDescription.length < errorData.requirements.minLength) {
              errorMessage += `\n\nMinimum length: ${errorData.requirements.minLength} characters.`;
            }
            if (errorData.requirements.maxLength && fullDescription.length > errorData.requirements.maxLength) {
              errorMessage += `\n\nMaximum length: ${errorData.requirements.maxLength} characters.`;
            }
            if (errorData.requirements.message) {
              errorMessage += `\n\n${errorData.requirements.message}`;
            }
          }
          
          if (errorData.suggestion) {
            errorMessage += `\n\nSuggestion: ${errorData.suggestion}`;
          }
        } catch (parseError) {
          console.error('[TRAIT SAMPLES] Failed to parse error response:', parseError);
          errorMessage = `Server error (${response.status}). Please try again.`;
        }
        
        alert(errorMessage);
        return;
      }

      const data = await response.json();
      
      // Validate response structure
      if (!data || typeof data !== 'object') {
        console.error('[TRAIT SAMPLES] Invalid response data:', data);
        alert('Received invalid response from server. Please try again.');
        return;
      }

      if (!data.success) {
        const errorMsg = data.error || data.message || 'Voice generation was unsuccessful.';
        alert(errorMsg);
        return;
      }

      if (!data.voices || !Array.isArray(data.voices)) {
        console.error('[TRAIT SAMPLES] No voices in response:', data);
        alert('No voice samples were generated. Please try a different description.');
        return;
      }

      // Filter and validate samples
      const validSamples = data.voices
        .filter((v: any) => {
          // Validate each voice object
          if (!v || typeof v !== 'object') return false;
          if (!v.audioBase64 || typeof v.audioBase64 !== 'string' || v.audioBase64.trim().length === 0) {
            console.warn('[TRAIT SAMPLES] Voice missing audioBase64:', v);
            return false;
          }
          return true;
        })
        .map((v: any, index: number) => {
          // Ensure we have valid IDs
          const id = v.generatedVoiceId || v.id || `sample-${trait}-${index}-${Date.now()}`;
          return {
            id: String(id),
            audioBase64: String(v.audioBase64).trim(),
            name: `Sample ${index + 1}`,
          };
        });

      if (validSamples.length === 0) {
        alert('Voice samples were generated but are missing audio data. Please try again with a different description.');
        return;
      }

      // Update state with validated samples
      setTraitSamples({
        ...traitSamples,
        [trait]: validSamples,
      });
    } catch (error) {
      console.error('[TRAIT SAMPLES] Error generating samples:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to generate voice samples.';
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
      }
      
      alert(errorMessage);
    } finally {
      // Always remove from generating set
      setGeneratingSamples(new Set([...generatingSamples].filter(t => t !== trait)));
    }
  };

  const handlePlaySample = async (trait: string, sample: { id: string; audioBase64: string }) => {
    // Validate inputs
    if (!trait || !sample || !sample.audioBase64) {
      console.error('[TRAIT SAMPLES] Invalid play parameters:', { trait, sample });
      alert('Invalid audio sample. Please regenerate the samples.');
      return;
    }

    // Prevent playing if already playing this sample
    if (playingSamples.has(trait) && audioRefs.current[trait]) {
      handleStopSample(trait);
      return;
    }

    // Stop any currently playing audio for this trait
    if (audioRefs.current[trait]) {
      try {
        audioRefs.current[trait]?.pause();
        audioRefs.current[trait] = null;
      } catch (e) {
        console.warn('[TRAIT SAMPLES] Error stopping previous audio:', e);
      }
    }

    // Stop all other playing samples
    Object.keys(audioRefs.current).forEach(key => {
      if (key !== trait && audioRefs.current[key]) {
        try {
          audioRefs.current[key]?.pause();
          audioRefs.current[key] = null;
        } catch (e) {
          console.warn('[TRAIT SAMPLES] Error stopping other audio:', e);
        }
      }
    });
    setPlayingSamples(new Set());

    try {
      // Validate base64 string
      const base64String = String(sample.audioBase64).trim();
      if (!base64String || base64String.length === 0) {
        throw new Error('Audio data is empty');
      }

      // Decode base64 with error handling
      let audioData: string;
      try {
        audioData = atob(base64String);
      } catch (decodeError) {
        console.error('[TRAIT SAMPLES] Base64 decode error:', decodeError);
        throw new Error('Invalid audio data format. Please regenerate the samples.');
      }

      if (!audioData || audioData.length === 0) {
        throw new Error('Decoded audio data is empty');
      }

      // Convert to Uint8Array with validation
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        const charCode = audioData.charCodeAt(i);
        if (isNaN(charCode) || charCode < 0 || charCode > 255) {
          throw new Error('Invalid audio data character');
        }
        audioArray[i] = charCode;
      }

      // Create blob with error handling
      let audioBlob: Blob;
      try {
        audioBlob = new Blob([audioArray], { type: 'audio/mpeg' });
      } catch (blobError) {
        console.error('[TRAIT SAMPLES] Blob creation error:', blobError);
        throw new Error('Failed to create audio file. Please regenerate the samples.');
      }

      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('Audio file is empty');
      }

      const audioUrl = URL.createObjectURL(audioBlob);

      // Create audio element with error handling
      let audio: HTMLAudioElement;
      try {
        audio = new Audio(audioUrl);
      } catch (audioError) {
        URL.revokeObjectURL(audioUrl);
        console.error('[TRAIT SAMPLES] Audio creation error:', audioError);
        throw new Error('Failed to create audio player. Please try again.');
      }

      // Store reference
      audioRefs.current[trait] = audio;

      // Set up event handlers
      audio.onplay = () => {
        setPlayingSamples(new Set([trait]));
      };

      audio.onended = () => {
        setPlayingSamples(new Set());
        try {
          URL.revokeObjectURL(audioUrl);
        } catch (e) {
          console.warn('[TRAIT SAMPLES] Error revoking URL:', e);
        }
        audioRefs.current[trait] = null;
      };

      audio.onerror = (event) => {
        console.error('[TRAIT SAMPLES] Audio playback error:', event);
        setPlayingSamples(new Set());
        try {
          URL.revokeObjectURL(audioUrl);
        } catch (e) {
          console.warn('[TRAIT SAMPLES] Error revoking URL on error:', e);
        }
        audioRefs.current[trait] = null;
        
        // Provide user-friendly error message
        const errorMsg = audio.error 
          ? `Audio error: ${audio.error.message || 'Unknown error'}`
          : 'Failed to play audio sample. Please try again.';
        alert(errorMsg);
      };

      // Attempt to play with error handling for browser autoplay policies
      try {
        await audio.play();
      } catch (playError: any) {
        console.error('[TRAIT SAMPLES] Play error:', playError);
        
        // Clean up
        try {
          URL.revokeObjectURL(audioUrl);
        } catch (e) {
          console.warn('[TRAIT SAMPLES] Error revoking URL on play error:', e);
        }
        audioRefs.current[trait] = null;
        setPlayingSamples(new Set());

        // Handle specific browser errors
        if (playError.name === 'NotAllowedError') {
          alert('Audio playback was blocked by your browser. Please interact with the page first, then try again.');
        } else if (playError.name === 'NotSupportedError') {
          alert('Audio format not supported by your browser. Please try a different browser.');
        } else {
          alert(`Failed to play audio: ${playError.message || 'Unknown error'}. Please try again.`);
        }
      }
    } catch (error) {
      console.error('[TRAIT SAMPLES] Error playing sample:', error);
      
      // Clean up on error
      if (audioRefs.current[trait]) {
        audioRefs.current[trait] = null;
      }
      setPlayingSamples(new Set());

      // Provide user-friendly error message
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to play audio sample. Please try again.';
      alert(errorMessage);
    }
  };

  const handleStopSample = (trait: string) => {
    if (!trait) return;
    
    if (audioRefs.current[trait]) {
      try {
        audioRefs.current[trait]?.pause();
        audioRefs.current[trait] = null;
      } catch (e) {
        console.warn('[TRAIT SAMPLES] Error stopping sample:', e);
      }
      setPlayingSamples(new Set([...playingSamples].filter(t => t !== trait)));
    }
  };

  const isMaxedOut = selectedTraits.length >= maxSelections;

  return (
    <div className="w-full" style={{ paddingBottom: '2rem' }}>
      {/* Selection counter */}
      {selectedTraits.length > 0 && (
        <div
          className="mb-6 text-center"
          style={{
            color: colors.accent,
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: 'clamp(0.875rem, 2vw, 1rem)',
          }}
        >
          {selectedTraits.length} of {maxSelections} selected
          {selectedTraits.length === maxSelections && (
            <span className="ml-2">✓</span>
          )}
        </div>
      )}
      
      {/* Cards grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        style={{ width: '100%' }}
      >
        {PERSONALITY_TRAITS.map((trait) => {
          const isSelected = selectedTraits.includes(trait);
          const isDisabled = isMaxedOut && !isSelected;
          
          // Progressive darkening based on number of selections
          // 1 selected: 0.7, 2 selected: 0.5, 3 selected: 0.4
          let cardOpacity: number | undefined = undefined;
          if (!isSelected && selectedTraits.length > 0) {
            if (selectedTraits.length === 1) {
              cardOpacity = 0.7; // Slightly darker
            } else if (selectedTraits.length === 2) {
              cardOpacity = 0.5; // Darker
            } else if (selectedTraits.length === 3) {
              cardOpacity = 0.4; // Darkest (maxed out)
            }
          }
          
          return (
            <QuestionCard
              key={trait}
              label={trait}
              icon={getTraitIcon(trait)}
              selected={isSelected}
              onClick={() => handleTraitClick(trait)}
              disabled={isDisabled}
              opacity={cardOpacity}
            />
          );
        })}
      </div>

      {/* Voice Description Sections for Selected Traits */}
      {selectedTraits.length > 0 && (
        <div className="mt-8 space-y-6">
          <div
            className="text-center mb-6"
            style={{
              color: colors.text,
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: 'clamp(0.875rem, 2vw, 1rem)',
              opacity: 0.8,
            }}
          >
            Describe how you want each trait to sound, then generate voice samples
          </div>

          {selectedTraits.map((trait) => {
            const isExpanded = expandedTraits.has(trait);
            const description = traitDescriptions[trait] || '';
            const isGenerating = generatingSamples.has(trait);
            const isPlaying = playingSamples.has(trait);
            const samples = traitSamples[trait] || [];

            return (
              <div
                key={trait}
                className="rounded-lg p-4 sm:p-6 transition-all duration-300"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${isExpanded ? colors.accent : 'rgba(255, 255, 255, 0.1)'}`,
                  backdropFilter: 'blur(10px)',
                }}
              >
                {/* Trait Header */}
                <div
                  className="flex items-center justify-between cursor-pointer mb-4"
                  onClick={() => toggleExpanded(trait)}
                >
                  <div className="flex items-center gap-3">
                    {getTraitIcon(trait)}
                    <h3
                      style={{
                        color: colors.text,
                        fontFamily: 'var(--font-inter), sans-serif',
                        fontSize: '1.125rem',
                        fontWeight: 500,
                      }}
                    >
                      {trait}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(trait);
                    }}
                    style={{
                      color: colors.text,
                      opacity: 0.6,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {isExpanded ? <X size={20} /> : <Volume2 size={20} />}
                  </button>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="space-y-4">
                    {/* Description Input */}
                    <div>
                      <label
                        className="block mb-2 text-sm"
                        style={{
                          color: colors.text,
                          opacity: 0.8,
                          fontFamily: 'var(--font-inter), sans-serif',
                        }}
                      >
                        How should this {trait.toLowerCase()} trait sound?
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          // Limit to 500 characters
                          if (newValue.length <= 500) {
                            if (onTraitDescriptionChange) {
                              onTraitDescriptionChange(trait, newValue);
                            }
                          }
                        }}
                        placeholder={`Describe how you want ${trait.toLowerCase()} to sound. For example: "playful and light-hearted" or "sharp and direct"`}
                        className="w-full p-3 rounded-lg resize-none"
                        style={{
                          backgroundColor: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: colors.text,
                          fontFamily: 'var(--font-inter), sans-serif',
                          fontSize: '0.875rem',
                          minHeight: '80px',
                        }}
                        rows={3}
                        maxLength={500}
                      />
                      <div
                        className="text-xs mt-1 text-right"
                        style={{
                          color: colors.text,
                          opacity: 0.5,
                          fontFamily: 'var(--font-inter), sans-serif',
                        }}
                      >
                        {description.length}/500 characters
                      </div>
                    </div>

                    {/* Generate Samples Button */}
                    <button
                      type="button"
                      onClick={() => handleGenerateSamples(trait)}
                      disabled={isGenerating || !description.trim()}
                      className="w-full py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
                      style={{
                        backgroundColor: isGenerating || !description.trim()
                          ? 'rgba(168, 85, 247, 0.2)'
                          : colors.accent,
                        color: colors.text,
                        border: 'none',
                        cursor: isGenerating || !description.trim() ? 'not-allowed' : 'pointer',
                        opacity: isGenerating || !description.trim() ? 0.5 : 1,
                        fontFamily: 'var(--font-inter), sans-serif',
                        fontWeight: 500,
                      }}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Generating samples...
                        </>
                      ) : (
                        <>
                          <Play size={18} />
                          Generate Voice Samples
                        </>
                      )}
                    </button>

                    {/* Samples Display */}
                    {samples.length > 0 && (
                      <div className="space-y-2">
                        <div
                          className="text-sm mb-2"
                          style={{
                            color: colors.text,
                            opacity: 0.7,
                            fontFamily: 'var(--font-inter), sans-serif',
                          }}
                        >
                          Voice Samples:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {samples.map((sample, index) => (
                            <button
                              key={sample.id}
                              type="button"
                              onClick={() => {
                                if (isPlaying && playingSamples.has(trait)) {
                                  handleStopSample(trait);
                                } else {
                                  handlePlaySample(trait, sample);
                                }
                              }}
                              className="p-3 rounded-lg transition-all duration-300 flex items-center justify-between gap-2"
                              style={{
                                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                                border: `1px solid ${isPlaying ? colors.accent : 'rgba(255, 255, 255, 0.1)'}`,
                                color: colors.text,
                                fontFamily: 'var(--font-inter), sans-serif',
                                fontSize: '0.875rem',
                              }}
                            >
                              <span>{sample.name}</span>
                              {isPlaying && playingSamples.has(trait) ? (
                                <Volume2 size={16} style={{ color: colors.accent }} />
                              ) : (
                                <Play size={16} />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

