'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, startTransition } from 'react';
import { colors } from '@/lib/config';
import { Volume2, Play, Loader2, CheckCircle2, Circle, FileText, Lightbulb, Globe, ChevronDown, Users, MapPin, Palette, Calendar, Tag, Search } from 'lucide-react';
import { parseVoiceDescription } from '@/lib/parseVoiceDescription';
import { getLanguagePreview, getAvailableLanguages, getLanguageName } from '@/lib/languagePreviews';
import { analyzeDescription, getQuickSuggestions } from '@/lib/descriptionSuggestions';
import { scorePromptQuality } from '@/lib/promptQualityScorer';

interface VoiceSelectionStepProps {
  selectedVoice: string | null;
  onSelectionChange: (voiceId: string | '') => void;
  onLanguageChange?: (language: string) => void;
  isEditMode?: boolean;
}

// Voice option interface matching API response - Branded as RAAR
interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  accent?: string;
  language?: string;
  ageGroup?: 'young' | 'middle-aged' | 'older';
  description?: string;
  voiceId: string; // Generic voiceId (replaces elevenLabsVoiceId)
  source?: 'raar' | 'local' | 'generated' | 'curated'; // Branded as RAAR
  generatedVoiceId?: string;
  audioBase64?: string;
  qualityScore?: number; // Phase 5.4: Quality score (0-100)
  tags?: string[]; // Curated voice tags
  tone?: string[]; // Curated voice tone descriptors
  matchDetails?: any; // Match details from curated library
  // Internal IDs for backend use only
  _internal?: {
    source?: string;
    elevenLabsVoiceId?: string;
    vapiVoiceId?: string;
    generatedVoiceId?: string;
  };
}

export default function VoiceSelectionStep({
  selectedVoice,
  onSelectionChange,
  onLanguageChange,
  isEditMode = false,
}: VoiceSelectionStepProps) {
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'male' | 'female'>('all');
  const [isScrolled, setIsScrolled] = useState(false);
  // Support all available languages
  const availableLanguages = getAvailableLanguages();
  type LanguageCode = 'all' | typeof availableLanguages[number];
  const [activeLanguage, setActiveLanguage] = useState<LanguageCode>('all');
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  
  // Enhanced filter states
  const [activeAccent, setActiveAccent] = useState<string>('all');
  const [activeStyle, setActiveStyle] = useState<string>('all');
  const [activeAgeGroup, setActiveAgeGroup] = useState<string>('all');
  
  // Dropdown states for all filters
  const [isGenderDropdownOpen, setIsGenderDropdownOpen] = useState(false);
  const [isAccentDropdownOpen, setIsAccentDropdownOpen] = useState(false);
  const [isStyleDropdownOpen, setIsStyleDropdownOpen] = useState(false);
  const [isAgeGroupDropdownOpen, setIsAgeGroupDropdownOpen] = useState(false);
  const [voiceDescription, setVoiceDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewingDescription, setIsPreviewingDescription] = useState(false);
  const [matchedVoiceId, setMatchedVoiceId] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [generatedVoices, setGeneratedVoices] = useState<VoiceOption[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);
  const [languageNote, setLanguageNote] = useState<string | null>(null);
  const [descriptionHash, setDescriptionHash] = useState<string>('');
  const [isProcessingClick, setIsProcessingClick] = useState<boolean>(false); // State to disable all cards during processing
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const descriptionAudioRef = useRef<HTMLAudioElement | null>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const stickyElementOriginalParentRef = useRef<HTMLElement | null>(null);
  const clickProcessingRef = useRef<Set<string>>(new Set()); // Track which voice IDs are currently being processed
  const isProcessingSelectionRef = useRef<boolean>(false); // Global flag to prevent any clicks during processing

  // Track if any filter dropdown is open so we can adjust layout below
  const isAnyFilterDropdownOpen =
    isLanguageDropdownOpen ||
    isGenderDropdownOpen ||
    isAccentDropdownOpen ||
    isStyleDropdownOpen ||
    isAgeGroupDropdownOpen;

  // Helper function to close all dropdowns
  const closeAllDropdowns = () => {
    setIsLanguageDropdownOpen(false);
    setIsGenderDropdownOpen(false);
    setIsAccentDropdownOpen(false);
    setIsStyleDropdownOpen(false);
    setIsAgeGroupDropdownOpen(false);
  };

  // Notify parent when language changes
  const prevLanguageRef = useRef<string>(activeLanguage === 'all' ? 'en' : activeLanguage);
  const onLanguageChangeRef = useRef(onLanguageChange);
  
  // Keep ref updated with latest callback (but don't trigger effect)
  useEffect(() => {
    onLanguageChangeRef.current = onLanguageChange;
  }, [onLanguageChange]);
  
  useEffect(() => {
    const currentLanguage = activeLanguage === 'all' ? 'en' : activeLanguage;
    
    // Only call if language actually changed
    if (prevLanguageRef.current !== currentLanguage && onLanguageChangeRef.current) {
      prevLanguageRef.current = currentLanguage;
      onLanguageChangeRef.current(currentLanguage);
    }
  }, [activeLanguage]); // Only depend on activeLanguage to prevent infinite loop

  // Get preview text based on selected language
  // Use useCallback to ensure we always get the current activeLanguage value
  const getPreviewText = React.useCallback((): string => {
    // Always read the current activeLanguage state
    const currentLanguage = activeLanguage;
    console.log('[LANGUAGE] getPreviewText called with activeLanguage:', currentLanguage);
    
    // Use language previews map for all languages
    if (currentLanguage === 'all') {
      return getLanguagePreview('en'); // Default to English for 'all'
    }
    
    return getLanguagePreview(currentLanguage);
  }, [activeLanguage]);

  // Fetch voices from API when filters change
  useEffect(() => {
    const fetchVoices = async () => {
      setIsLoadingVoices(true);
      try {
        const languageParam = activeLanguage !== 'all' ? activeLanguage : 'all';
        const genderParam = activeFilter !== 'all' ? activeFilter : 'all';
        
        const response = await fetch(
          `/api/getElevenLabsVoices?language=${languageParam}&gender=${genderParam}`
        );
        
        if (!response.ok) {
          console.error('Failed to fetch RAAR Voice Library:', await response.json().catch(() => ({})));
          setVoices([]);
          setLanguageNote(null);
          return;
        }
        
        const data = await response.json();
        console.log('[VOICE LIBRARY] Fetched voices:', data.voices?.length || 0, 'voices');
        // Transform voices to match VoiceOption interface
        const transformedVoices = (data.voices || []).map((voice: any) => ({
          ...voice,
          voiceId: voice.voiceId || voice._internal?.elevenLabsVoiceId || voice._internal?.vapiVoiceId || voice.id,
          source: voice.source || 'raar',
        }));
        setVoices(transformedVoices);
        setLanguageNote(data.note || null);
        
        if (transformedVoices.length === 0) {
          console.warn('[VOICE LIBRARY] No voices found in RAAR Voice Library. Make sure voices are added to "My Voices" in ElevenLabs.');
        }
      } catch (error) {
        console.error('Error fetching voices:', error);
        setVoices([]);
        setLanguageNote(null);
      } finally {
        setIsLoadingVoices(false);
      }
    };

    fetchVoices();
  }, [activeLanguage, activeFilter]);

  // CRITICAL: useLayoutEffect runs synchronously BEFORE React reconciliation
  // This ensures we restore the sticky element before React tries to unmount it
  useLayoutEffect(() => {
    if (!selectedVoice) {
      // When voice is deselected, immediately restore sticky element to original location
      // This must happen BEFORE React tries to unmount it
      // Use requestAnimationFrame to ensure DOM is ready and avoid conflicts
      requestAnimationFrame(() => {
        const stickyElement = document.getElementById('current-voice-sticky');
        const stickyContainer = document.getElementById('sticky-voice-container');
        
        if (stickyElement && stickyElement.parentNode) {
          // Verify element is still in DOM before manipulating
          if (!document.contains(stickyElement)) {
            stickyElementOriginalParentRef.current = null;
            return; // Element already removed, skip
          }
          
          // If element was moved to stickyContainer, restore it
          if (stickyContainer && stickyElement.parentElement === stickyContainer) {
            try {
              // Try to restore to original parent if we have it
              if (stickyElementOriginalParentRef.current) {
                const originalParent = stickyElementOriginalParentRef.current;
                if (originalParent && document.contains(originalParent)) {
                  originalParent.appendChild(stickyElement);
                } else {
                  // Original parent no longer exists, just remove from stickyContainer
                  if (stickyElement.parentNode === stickyContainer) {
                    stickyContainer.removeChild(stickyElement);
                  }
                }
              } else {
                // No original parent stored, just remove from stickyContainer
                if (stickyElement.parentNode === stickyContainer) {
                  stickyContainer.removeChild(stickyElement);
                }
              }
            } catch (e) {
              // Element might already be removed or in transition - that's okay
              // Silently fail to prevent errors
            }
          }
        }
        // Clear the ref since we're done
        stickyElementOriginalParentRef.current = null;
      });
    }
  }, [selectedVoice]);

  // Handle scroll to show/hide sticky current voice
  // Show sticky current voice in top left only when scrolled past the search button
  // Works for both personal-setup and edit mode
  useEffect(() => {
    if (!selectedVoice) {
      setIsScrolled(false);
      return;
    }
    
    // Explicitly hide sticky element on mount and store original parent
    // Use requestAnimationFrame to avoid conflicts with React reconciliation
    requestAnimationFrame(() => {
      const stickyElement = document.getElementById('current-voice-sticky');
      if (stickyElement && document.contains(stickyElement)) {
        stickyElement.style.display = 'none';
        // Store original parent if not already stored (in case element was just rendered)
        if (!stickyElementOriginalParentRef.current && stickyElement.parentElement) {
          stickyElementOriginalParentRef.current = stickyElement.parentElement as HTMLElement;
        }
      }
    });
    
    const handleScroll = () => {
      // Find the search button to detect when we've scrolled past it
      const searchButton = document.getElementById('voice-search-button');
      const stickyElement = document.getElementById('current-voice-sticky');
      const stickyContainer = document.getElementById('sticky-voice-container');
      
      if (!searchButton || !stickyElement || !stickyContainer) {
        return;
      }
      
      // Check if scrolled past the search button
      const rect = searchButton.getBoundingClientRect();
      // Only show sticky if we've actually scrolled past (element is above viewport)
      // Use a small threshold to ensure we're definitely past it
      const isScrolledPast = rect.top < -10; // 10px threshold to ensure we're past it
      
      setIsScrolled(isScrolledPast);
      
      // Move sticky element to container when scrolled past, but only if not already there
      if (isScrolledPast) {
        // Only move if not already in the container to prevent glitches
        // Verify elements are still in DOM before manipulating
        if (stickyElement.parentElement !== stickyContainer && 
            document.contains(stickyElement) && 
            document.contains(stickyContainer)) {
          try {
            // Store reference to original parent before moving (critical for restoration)
            if (!stickyElementOriginalParentRef.current && stickyElement.parentElement) {
              stickyElementOriginalParentRef.current = stickyElement.parentElement as HTMLElement;
            }
            stickyContainer.appendChild(stickyElement);
          } catch (e) {
            // If appendChild fails, just hide the element
            console.warn('Could not move sticky element:', e);
            if (document.contains(stickyElement)) {
              stickyElement.style.display = 'none';
            }
            return;
          }
        }
        if (document.contains(stickyElement)) {
          stickyElement.style.display = 'flex';
        }
      } else {
        // Hide sticky element but keep it in DOM to prevent layout shifts
        if (document.contains(stickyElement)) {
          stickyElement.style.display = 'none';
        }
      }
    };
    
    // Listen to both window scroll and any scrollable parent containers
    const scrollContainers: (Window | Element)[] = [window];
    
    // Find scrollable parent containers
    const findScrollContainers = (element: HTMLElement | null): Element[] => {
      const containers: Element[] = [];
      let current = element?.parentElement;
      while (current) {
        const style = window.getComputedStyle(current);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll' || 
            style.overflow === 'auto' || style.overflow === 'scroll') {
          containers.push(current);
        }
        current = current.parentElement;
      }
      return containers;
    };
    
    // Find scroll containers using the search button
    const searchButton = document.getElementById('voice-search-button');
    const parentContainers = findScrollContainers(searchButton);
    scrollContainers.push(...parentContainers);
    
    // Also find and listen to the voice cards scroll container specifically
    const voiceScrollContainer = document.querySelector('[data-voice-scroll-container]');
    if (voiceScrollContainer && !scrollContainers.includes(voiceScrollContainer)) {
      scrollContainers.push(voiceScrollContainer);
    }
    
    // Add scroll listeners to all scroll containers
    scrollContainers.forEach(container => {
      container.addEventListener('scroll', handleScroll, { passive: true });
    });
    
    // Also listen to window scroll
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Check initial state after DOM is ready - but ensure it starts hidden
    setTimeout(() => {
      handleScroll(); // Check scroll position after DOM is ready
    }, 100);
    
    return () => {
      // Clean up scroll listeners
      scrollContainers.forEach(container => {
        container.removeEventListener('scroll', handleScroll);
      });
      window.removeEventListener('scroll', handleScroll);
      
      // Clean up sticky element if it was moved
      // This prevents the removeChild error when deselecting
      try {
        const stickyElement = document.getElementById('current-voice-sticky');
        const stickyContainer = document.getElementById('sticky-voice-container');
        
        // If sticky element is in the stickyContainer, try to restore it
        if (stickyElement && stickyContainer && stickyElement.parentElement === stickyContainer) {
          // The element will be removed by React, so we just need to detach it safely
          // Try-catch to handle any errors gracefully
          try {
            stickyContainer.removeChild(stickyElement);
          } catch (e) {
            // Element might already be removed or in transition - that's okay
          }
        }
      } catch (e) {
        // Silently handle any cleanup errors
      }
    };
  }, [selectedVoice, isEditMode]);

  // Stop any playing audio when component unmounts and cleanup debounce
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (descriptionAudioRef.current) {
        descriptionAudioRef.current.pause();
        descriptionAudioRef.current = null;
      }
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  // Clear generated voices and hash when description changes significantly
  useEffect(() => {
    const currentHash = getDescriptionHash(voiceDescription);
    if (descriptionHash && descriptionHash !== currentHash) {
      // Description changed - clear previous generation
      setGeneratedVoices([]);
      setDescriptionHash('');
      setMatchedVoiceId(null);
      // Stop any playing audio
      if (descriptionAudioRef.current) {
        descriptionAudioRef.current.pause();
        descriptionAudioRef.current = null;
      }
      setIsPlaying(false);
      setIsPreviewingDescription(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceDescription, descriptionHash]);

  const handlePreview = async (voice: VoiceOption) => {
    // If clicking the same voice while playing, stop it
    if (previewingVoiceId === voice.id && isPlaying) {
      stopPreview();
      return;
    }

    // Otherwise, stop ANY existing audio (card or description) before starting new preview
    stopPreview();

    setIsLoading(true);
    setPreviewingVoiceId(voice.id);

    try {
      // CRITICAL: Generated voices MUST use base64 audio directly
      // They cannot use the preview API because their IDs are temporary
      // Check if it's a generated voice by checking for _internal.source === 'generated' OR has audioBase64 with no internal IDs
      const isGeneratedVoice = voice._internal?.source === 'generated' || 
                               (voice.source === 'generated' && voice.audioBase64) ||
                               (voice.audioBase64 && !voice._internal?.elevenLabsVoiceId && !voice._internal?.vapiVoiceId && voice.generatedVoiceId);
      
      if (isGeneratedVoice && voice.audioBase64) {
        // Generated voice with audioBase64 - use it directly
        try {
          // Decode base64 audio and play it
          const audioData = atob(voice.audioBase64);
          const audioArray = new Uint8Array(audioData.length);
          for (let i = 0; i < audioData.length; i++) {
            audioArray[i] = audioData.charCodeAt(i);
          }
          const audioBlob = new Blob([audioArray], { type: 'audio/mpeg' });
          const audioUrl = URL.createObjectURL(audioBlob);

          const audio = new Audio(audioUrl);
          audioRef.current = audio;

          audio.onplay = () => {
            setIsLoading(false);
            setIsPlaying(true);
          };

          audio.onended = () => {
            setIsPlaying(false);
            setPreviewingVoiceId(null);
            URL.revokeObjectURL(audioUrl);
            audioRef.current = null;
          };

          audio.onerror = (error) => {
            console.error('[VOICE PREVIEW] Audio playback error:', error);
            setIsLoading(false);
            setIsPlaying(false);
            setPreviewingVoiceId(null);
            URL.revokeObjectURL(audioUrl);
            audioRef.current = null;
            alert('Failed to play voice preview. Please try again.');
          };

          // Play audio with promise handling
          try {
            await audio.play();
          } catch (playError: any) {
            console.error('[VOICE PREVIEW] Failed to start playback:', playError);
            setIsLoading(false);
            setIsPlaying(false);
            setPreviewingVoiceId(null);
            URL.revokeObjectURL(audioUrl);
            audioRef.current = null;
            
            if (playError.name === 'NotAllowedError') {
              alert('Audio playback was blocked by your browser. Please interact with the page first, then try again.');
            } else {
              alert('Failed to play voice preview. Please try again.');
            }
          }
          return;
        } catch (decodeError) {
          console.error('[VOICE PREVIEW] Failed to decode base64 audio:', decodeError);
          setIsLoading(false);
          setIsPlaying(false);
          setPreviewingVoiceId(null);
          alert('Failed to decode audio data. Please try generating the voice again.');
          return;
        }
      } else if (isGeneratedVoice && !voice.audioBase64) {
        // Generated voice but missing audioBase64 - fall back to preview API
        console.warn('[VOICE PREVIEW] Generated voice missing audioBase64, falling back to preview API:', voice);
        // Fall through to regular voice preview handling below
      }

      // For regular voices (or generated voices without audioBase64), call our API endpoint to generate preview
      // Use the voice ID directly and preview text in selected language
      
      // Extract the correct voice ID - prioritize internal IDs for API calls
      const voiceIdForApi = voice._internal?.elevenLabsVoiceId || voice._internal?.vapiVoiceId || voice._internal?.generatedVoiceId || voice.voiceId || voice.id;
      
      if (!voiceIdForApi) {
        console.error('[VOICE PREVIEW] No valid voice ID found:', voice);
        alert('Voice ID is missing. Please try selecting a different voice.');
        setIsLoading(false);
        setPreviewingVoiceId(null);
        return;
      }
      
      console.log('[VOICE PREVIEW] Calling API with voiceId:', voiceIdForApi?.substring(0, 20) + '...', 'text length:', getPreviewText().length);
      
      const response = await fetch('/api/generateVoicePreview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voiceId: voiceIdForApi,
          text: getPreviewText(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[VOICE PREVIEW] API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          voiceId: voiceIdForApi?.substring(0, 20) + '...',
        });
        
        // Handle 404 errors (voice not found) more gracefully
        if (response.status === 404) {
          const errorMessage = errorData.error || errorData.message || 'Voice not found';
          console.warn('[VOICE PREVIEW] Voice not found in library:', voiceIdForApi);
          // Show a less intrusive error - just log and notify user
          alert(`Voice preview unavailable: ${errorMessage}\n\nThis voice may need to be synced in the voice library.`);
        } else {
          alert(`Failed to generate voice preview: ${errorData.error || errorData.message || 'Unknown error'}\n\nStatus: ${response.status} ${response.statusText}`);
        }
        setIsLoading(false);
        setPreviewingVoiceId(null);
        return;
      }

      // Get audio blob
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create audio element and play
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsLoading(false);
        setIsPlaying(true);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setPreviewingVoiceId(null);
        URL.revokeObjectURL(audioUrl); // Clean up
        audioRef.current = null;
      };

      audio.onerror = (error) => {
        console.error('[VOICE PREVIEW] Audio playback error:', error);
        setIsLoading(false);
        setIsPlaying(false);
        setPreviewingVoiceId(null);
        URL.revokeObjectURL(audioUrl); // Clean up
        audioRef.current = null;
        alert('Failed to play voice preview. Please try again.');
      };

      // Play audio with promise handling for browser autoplay policies
      try {
        await audio.play();
      } catch (playError: any) {
        console.error('[VOICE PREVIEW] Failed to start playback:', playError);
        setIsLoading(false);
        setIsPlaying(false);
        setPreviewingVoiceId(null);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        
        if (playError.name === 'NotAllowedError') {
          alert('Audio playback was blocked by your browser. Please interact with the page first, then try again.');
        } else {
          alert('Failed to play voice preview. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error generating preview:', error);
      setIsLoading(false);
      setPreviewingVoiceId(null);
      alert('Failed to generate voice preview. Please try again.');
    }
  };

  const stopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
      setPreviewingVoiceId(null);
    }
    if (descriptionAudioRef.current) {
      descriptionAudioRef.current.pause();
      descriptionAudioRef.current = null;
      setIsPlaying(false);
      setIsPreviewingDescription(false);
    }
  };

  // Generate a simple hash from description for caching
  const getDescriptionHash = (description: string): string => {
    return description.trim().toLowerCase();
  };

  // Combined handler: Search existing voices first, then generate if needed
  const handleGenerateAndPlay = async () => {
    console.log('[VOICE SEARCH] Play button clicked');
    const trimmedDescription = voiceDescription.trim();
    
    console.log('[VOICE SEARCH] Description:', trimmedDescription, 'Length:', trimmedDescription.length);
    
    if (!trimmedDescription) {
      console.log('[VOICE SEARCH] No description provided');
      return;
    }

    // Validate description length (more lenient for search, but still need minimum)
    if (trimmedDescription.length < 3) {
      console.log('[VOICE SEARCH] Description too short');
      alert(`Please enter at least 3 characters to search for voices.\n\nTip: Try "young male" or "British woman" for better results.`);
      return;
    }
    if (trimmedDescription.length > 1000) {
      console.log('[VOICE SEARCH] Description too long');
      alert(`Description must be no more than 1000 characters long.\n\nCurrent: ${trimmedDescription.length} characters\nRequired: 3-1000 characters\n\nPlease shorten your description.`);
      return;
    }
    
    console.log('[VOICE SEARCH] Starting search-first process...');

    const currentHash = getDescriptionHash(trimmedDescription);
    
    // Stop ANY existing audio (card preview or description preview) before starting new playback
    stopPreview();
    
    // If already playing the same description, stop it
    if (isPreviewingDescription && isPlaying && descriptionHash === currentHash) {
      return;
    }

    // Check if we already have matched or generated voices for this description
    // If yes, regenerate preview in the CURRENT selected language (language may have changed)
    if (descriptionHash === currentHash && (generatedVoices.length > 0 || voices.length > 0)) {
      const existingVoice = generatedVoices[0];
      
      // Always generate a fresh preview in the current selected language
      // This ensures language changes are reflected immediately
      if (existingVoice.generatedVoiceId || existingVoice.id) {
        const voiceIdToPreview = existingVoice.generatedVoiceId || existingVoice.id;
        const previewText = getPreviewText(); // Use current selected language
        
        console.log('[VOICE GENERATION] Regenerating preview in current language:', activeLanguage);
        console.log('[VOICE GENERATION] Current activeLanguage state:', activeLanguage);
        console.log('[VOICE GENERATION] Preview text being sent:', previewText);
        console.log('[VOICE GENERATION] Preview text length:', previewText.length);
        console.log('[VOICE GENERATION] Preview text first 50 chars:', previewText.substring(0, 50));
        
        setIsGenerating(true);
        setIsPreviewingDescription(true);
        
        // Stop any current audio
        if (descriptionAudioRef.current) {
          descriptionAudioRef.current.pause();
          descriptionAudioRef.current = null;
        }
        
        try {
          const previewResponse = await fetch('/api/generateVoicePreview', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              voiceId: voiceIdToPreview,
              text: previewText,
            }),
          });

          if (previewResponse.ok) {
            const audioBlob = await previewResponse.blob();
            
            if (!audioBlob || audioBlob.size === 0) {
              console.warn('[VOICE GENERATION] Preview generation returned empty audio blob, using base64 audio');
              // Fallback to base64 audio if preview fails
              if (existingVoice.audioBase64) {
                await playGeneratedAudio(existingVoice);
              } else {
                setIsGenerating(false);
                setIsPreviewingDescription(false);
                alert('Failed to generate preview. Please try again.');
              }
              return;
            }
            
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            descriptionAudioRef.current = audio;

            audio.onplay = () => {
              setIsGenerating(false);
              setIsPlaying(true);
            };

            audio.onended = () => {
              setIsPlaying(false);
              setIsPreviewingDescription(false);
              URL.revokeObjectURL(audioUrl);
              descriptionAudioRef.current = null;
            };

            audio.onerror = (error) => {
              console.error('[VOICE GENERATION] Audio playback error:', error);
              setIsGenerating(false);
              setIsPlaying(false);
              setIsPreviewingDescription(false);
              URL.revokeObjectURL(audioUrl);
              descriptionAudioRef.current = null;
              alert('Failed to play voice preview. Please try again.');
            };

            try {
              await audio.play();
            } catch (playError: any) {
              console.error('[VOICE GENERATION] Failed to start playback:', playError);
              setIsGenerating(false);
              setIsPlaying(false);
              setIsPreviewingDescription(false);
              URL.revokeObjectURL(audioUrl);
              descriptionAudioRef.current = null;
              
              if (playError.name === 'NotAllowedError') {
                alert('Audio playback was blocked by your browser. Please interact with the page first, then try again.');
              } else {
                alert('Failed to play voice preview. Please try again.');
              }
            }
          } else {
            // Fallback to base64 audio if preview generation fails
            console.warn('[VOICE GENERATION] Preview generation failed, using base64 audio');
            if (existingVoice.audioBase64) {
              await playGeneratedAudio(existingVoice);
            } else {
              const errorData = await previewResponse.json().catch(() => ({}));
              console.error('[VOICE GENERATION] Preview failed:', errorData);
              setIsGenerating(false);
              setIsPreviewingDescription(false);
              alert('Failed to generate preview. Please try again.');
            }
          }
        } catch (previewError) {
          console.error('[VOICE GENERATION] Error generating preview:', previewError);
          // Fallback to base64 audio
          if (existingVoice.audioBase64) {
            await playGeneratedAudio(existingVoice);
          } else {
            setIsGenerating(false);
            setIsPreviewingDescription(false);
            alert('Failed to generate preview. Please try again.');
          }
        }
        return;
      }
    }

    // Stop any current preview
    if (descriptionAudioRef.current) {
      descriptionAudioRef.current.pause();
      descriptionAudioRef.current = null;
    }

    setIsGenerating(true);
    setIsPreviewingDescription(true);
    console.log('[VOICE SEARCH] Set isGenerating to true');

    try {
      // STEP 1: Search for matching voices in RAAR Voice Library first
      console.log('[VOICE SEARCH] Searching for matching voices first...');
      console.log('[VOICE SEARCH] Making API call to /api/searchVoicesByDescription');
      
      const searchResponse = await fetch('/api/searchVoicesByDescription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: trimmedDescription,
        }),
      });

      let matchedVoices: VoiceOption[] = [];
      let hasGoodMatches = false;

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        console.log('[VOICE SEARCH] Search results:', searchData);
        
        if (searchData.matches && Array.isArray(searchData.matches) && searchData.matches.length > 0) {
          // Transform matched voices to VoiceOption format - Brand as RAAR
          matchedVoices = searchData.matches.map((match: any) => ({
            id: match.id || match.voiceId,
            name: match.name || 'RAAR Voice',
            gender: match.gender || 'neutral',
            accent: match.accent,
            ageGroup: match.ageGroup,
            description: match.description || trimmedDescription,
            voiceId: match.voiceId || match._internal?.elevenLabsVoiceId || match._internal?.vapiVoiceId || match.id,
            source: match._internal?.source === 'generated' ? 'generated' : (match.source || 'raar'), // Preserve generated source
            quality: match.quality || 'high', // 'high' or 'standard'
            tags: match.tags || [],
            tone: match.tone || [],
            matchDetails: match.matchDetails,
            audioBase64: match.audioBase64, // CRITICAL: Include audioBase64 for generated voices
            generatedVoiceId: match._internal?.generatedVoiceId || match._internal?.elevenLabsVoiceId, // Include generatedVoiceId
            qualityScore: match.qualityScore, // Include quality score if available
            _internal: match._internal, // Keep internal IDs for backend
          }));

          // Consider it a good match if score > 20 (lowered threshold for better matching with quality focus)
          hasGoodMatches = matchedVoices.length > 0 && (searchData.matches[0]?.score || 0) > 20;
          
          console.log('[VOICE SEARCH] Found', matchedVoices.length, 'matched voices, hasGoodMatches:', hasGoodMatches);
        }
      } else {
        console.warn('[VOICE SEARCH] Search failed, will try generation:', await searchResponse.json().catch(() => ({})));
      }

      // If we have good matches, use them and skip generation
      if (hasGoodMatches && matchedVoices.length > 0) {
        console.log('[VOICE SEARCH] Using matched voices, skipping generation');
        
        // Add matched voices to generatedVoices state so they appear prominently at the top
        // This ensures matched voices are visible even if they're not in the current filter results
        setGeneratedVoices(matchedVoices);
        setDescriptionHash(currentHash);
        
        // Auto-select the best match
        const bestMatch = matchedVoices[0];
        if (bestMatch?.id) {
          setMatchedVoiceId(bestMatch.id);
          onSelectionChange(bestMatch.id);
        }

        // Generate a preview in the user's selected language and play it
        if (bestMatch?.voiceId || bestMatch?.id) {
          const voiceIdToPreview = bestMatch.voiceId || bestMatch._internal?.elevenLabsVoiceId || bestMatch._internal?.vapiVoiceId || bestMatch.id;
          const previewText = getPreviewText();
          
          console.log('[VOICE SEARCH] Generating preview for matched voice in selected language:', activeLanguage);
          
          try {
            const previewResponse = await fetch('/api/generateVoicePreview', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                voiceId: voiceIdToPreview,
                text: previewText,
              }),
            });

            if (previewResponse.ok) {
              const audioBlob = await previewResponse.blob();
              
              if (audioBlob && audioBlob.size > 0) {
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                descriptionAudioRef.current = audio;

                audio.onplay = () => {
                  setIsGenerating(false);
                  setIsPlaying(true);
                };

                audio.onended = () => {
                  setIsPlaying(false);
                  setIsPreviewingDescription(false);
                  URL.revokeObjectURL(audioUrl);
                  descriptionAudioRef.current = null;
                };

                audio.onerror = (error) => {
                  console.error('[VOICE SEARCH] Audio playback error:', error);
                  setIsGenerating(false);
                  setIsPlaying(false);
                  setIsPreviewingDescription(false);
                  URL.revokeObjectURL(audioUrl);
                  descriptionAudioRef.current = null;
                };

                try {
                  await audio.play();
                } catch (playError: any) {
                  console.error('[VOICE SEARCH] Failed to start playback:', playError);
                  setIsGenerating(false);
                  setIsPlaying(false);
                  setIsPreviewingDescription(false);
                  URL.revokeObjectURL(audioUrl);
                  descriptionAudioRef.current = null;
                }
              } else {
                setIsGenerating(false);
                setIsPreviewingDescription(false);
              }
            } else {
              console.warn('[VOICE SEARCH] Preview generation failed for matched voice');
              setIsGenerating(false);
              setIsPreviewingDescription(false);
            }
          } catch (previewError) {
            console.error('[VOICE SEARCH] Error generating preview:', previewError);
            setIsGenerating(false);
            setIsPreviewingDescription(false);
          }
        }
        
        return; // Stop here, we found good matches
      }

      // STEP 2: No good matches found - show empty state (no voice generation)
      console.log('[VOICE SEARCH] No good matches found in library');
      setGeneratedVoices([]);
      setVoices([]);
      setDescriptionHash(currentHash);
      setIsGenerating(false);
      setIsPreviewingDescription(false);
      
      // Show user-friendly message if search returned a message
      if (searchResponse.ok) {
        const searchData = await searchResponse.json().catch(() => ({}));
        if (searchData.message) {
          // Message already shown in UI via empty state
          console.log('[VOICE SEARCH] Search returned message:', searchData.message);
        }
      }
    } catch (error) {
      console.error('[VOICE GENERATION] Error in voice search/generation:', error);
      console.error('[VOICE GENERATION] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      alert(`Failed to search or generate voices: ${error instanceof Error ? error.message : 'Unknown error'}. Please check the console for details.`);
      setGeneratedVoices([]);
      setIsGenerating(false);
      setIsPreviewingDescription(false);
    }
  };

  // Helper function to play generated audio from base64
  const playGeneratedAudio = async (voice: VoiceOption) => {
    if (!voice.audioBase64) {
      console.error('[AUDIO PLAYBACK] No audioBase64 data provided');
      setIsGenerating(false);
      setIsPlaying(false);
      setIsPreviewingDescription(false);
      alert('No audio data available to play');
      return;
    }

    // Stop any current audio
    if (descriptionAudioRef.current) {
      descriptionAudioRef.current.pause();
      descriptionAudioRef.current = null;
    }

    try {
      // Decode base64 audio data
      let audioData: string;
      try {
        audioData = atob(voice.audioBase64);
      } catch (decodeError) {
        console.error('[AUDIO PLAYBACK] Failed to decode base64:', decodeError);
        setIsGenerating(false);
        setIsPlaying(false);
        setIsPreviewingDescription(false);
        alert('Failed to decode audio data. Please try generating the voice again.');
        return;
      }

      // Convert to Uint8Array
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }

      // Create audio blob
      const audioBlob = new Blob([audioArray], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create and configure audio element
      const audio = new Audio(audioUrl);
      descriptionAudioRef.current = audio;

      // Set up event handlers
      audio.onplay = () => {
        setIsGenerating(false);
        setIsPlaying(true);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setIsPreviewingDescription(false);
        URL.revokeObjectURL(audioUrl);
        descriptionAudioRef.current = null;
      };

      audio.onerror = (error) => {
        console.error('[AUDIO PLAYBACK] Audio playback error:', error);
        setIsGenerating(false);
        setIsPlaying(false);
        setIsPreviewingDescription(false);
        URL.revokeObjectURL(audioUrl);
        descriptionAudioRef.current = null;
        alert('Failed to play voice preview. Please try again.');
      };

      // Play audio with promise handling for browser autoplay policies
      try {
        await audio.play();
      } catch (playError: any) {
        console.error('[AUDIO PLAYBACK] Failed to start playback:', playError);
        setIsGenerating(false);
        setIsPlaying(false);
        setIsPreviewingDescription(false);
        URL.revokeObjectURL(audioUrl);
        descriptionAudioRef.current = null;
        
        // Provide user-friendly error message
        if (playError.name === 'NotAllowedError') {
          alert('Audio playback was blocked by your browser. Please interact with the page first, then try again.');
        } else {
          alert('Failed to play voice preview. Please try again.');
        }
      }
    } catch (error) {
      console.error('[AUDIO PLAYBACK] Error processing audio:', error);
      setIsGenerating(false);
      setIsPlaying(false);
      setIsPreviewingDescription(false);
      alert('Failed to process audio data. Please try generating the voice again.');
    }
  };


  // Extract available filter options from voices
  const filterOptions = React.useMemo(() => {
    const allVoices = [...generatedVoices, ...voices];
    const accents = new Set<string>();
    const styles = new Set<string>();
    
    allVoices.forEach(voice => {
      if (voice.accent) accents.add(voice.accent);
      if (voice.tone && Array.isArray(voice.tone)) {
        voice.tone.forEach(t => styles.add(t));
      }
    });
    
    return {
      accents: Array.from(accents).sort(),
      styles: Array.from(styles).sort(),
    };
  }, [generatedVoices, voices]);

  // Combine regular voices with generated voices and apply all filters
  // If generated voices exist, show ONLY those (skip other filters since they're custom-generated).
  // Otherwise show full catalog with filters applied.
  // Memoize filtered voices for performance
  const filteredVoices = React.useMemo(() => {
    // If we have generated voices, show ONLY those (skip filters - they're custom for the user)
    if (generatedVoices.length > 0) {
      // Show ALL generated voices regardless of audioBase64 (preview can be generated on demand)
      // Only filter out voices that are completely invalid (no ID at all)
      const filtered = generatedVoices.filter(voice => {
        // Voice must have at least an ID (generatedVoiceId, voiceId, or id)
        const hasId = !!(voice.generatedVoiceId || voice.voiceId || voice.id);
        return hasId;
      });
      
      // Don't sort - keep voices in their original positions
      return filtered;
    }
    
    // Otherwise, show full catalog with all filters applied
    let result = [...voices];
    
    // Filter out voices with missing audio data
    result = result.filter(voice => {
      // For regular voices, they must have a valid voiceId
      const voiceId = voice._internal?.elevenLabsVoiceId || voice._internal?.vapiVoiceId || voice._internal?.generatedVoiceId || voice.voiceId || voice.id;
      return !!voiceId;
    });
    
    // Apply gender filter
    if (activeFilter !== 'all') {
      result = result.filter(voice => voice.gender === activeFilter);
    }
    
    // Apply language filter
    if (activeLanguage !== 'all') {
      // Note: All voices support all languages, but we can filter by language preference
      // For now, language filter is mainly for display purposes
    }
    
    // Apply accent filter
    if (activeAccent !== 'all') {
      result = result.filter(voice => voice.accent?.toLowerCase() === activeAccent.toLowerCase());
    }
    
    // Apply style/tone filter
    if (activeStyle !== 'all') {
      result = result.filter(voice => 
        voice.tone && Array.isArray(voice.tone) && 
        voice.tone.some(t => t.toLowerCase() === activeStyle.toLowerCase())
      );
    }
    
    // Apply age group filter
    if (activeAgeGroup !== 'all') {
      result = result.filter(voice => voice.ageGroup === activeAgeGroup);
    }
    
    // Don't sort - keep voices in their original positions
    return result;
  }, [generatedVoices, voices, activeFilter, activeLanguage, activeAccent, activeStyle, activeAgeGroup, selectedVoice]);

  // Use the SAME parsing logic as backend for 100% accuracy
  // This ensures what user types = what gets checked
  const parsedAttributes = React.useMemo(() => {
    return parseVoiceDescription(voiceDescription);
  }, [voiceDescription]);

  // Phase 5.8: Smart Description Suggestions - analyze description in real-time
  const descriptionAnalysis = React.useMemo(() => {
    if (!voiceDescription.trim()) {
      return null;
    }
    return analyzeDescription(voiceDescription);
  }, [voiceDescription]);

  // Get quality score for voice cards (not displayed in requirements circle anymore)
  const qualityScore = React.useMemo(() => {
    if (!voiceDescription.trim()) return null;
    return scorePromptQuality(voiceDescription);
  }, [voiceDescription]);

  return (
    <div 
      className="w-full" 
      style={{ 
        paddingBottom: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        width: '100%',
        flex: 1,
      }}
    >
      {/* Custom scrollbar styling - match voice library cards with purple glow */}
      <style>{`
        .voice-selection-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .voice-selection-scrollbar::-webkit-scrollbar-track {
          background: rgba(8, 8, 10, 0.92);
          border-radius: 3px;
        }
        .voice-selection-scrollbar::-webkit-scrollbar-thumb {
          background: ${colors.accent};
          border-radius: 3px;
          box-shadow: 0 0 8px ${colors.accent}80, 0 0 16px ${colors.accent}60;
        }
        .voice-selection-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${colors.accent};
          box-shadow: 0 0 12px ${colors.accent}90, 0 0 24px ${colors.accent}70;
        }
        /* For Firefox */
        .voice-selection-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: ${colors.accent} rgba(8, 8, 10, 0.92);
        }
      `}</style>
      {/* Voice Library Header */}
      <div 
        id="voice-library-header"
        style={{ 
          marginBottom: '1.5rem', 
          width: '100%', 
          flexShrink: 0,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h2
          className="text-2xl sm:text-3xl font-bold mb-3"
          style={{
            color: colors.text,
            fontFamily: 'var(--font-inter), sans-serif',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: '1.2',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-league-spartan), sans-serif',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              fontSize: '1.6em',
              marginRight: '0.5rem',
            }}
          >
            raar.
          </span>
          <span
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '1em',
            }}
          >
            Voice Library
          </span>
        </h2>
        {/* Sticky current voice placeholder - managed by OnboardingWizard title section */}
        <div id="sticky-voice-container" style={{ display: 'none' }}></div>
      </div>

      {/* Voice Description Input */}
      <div style={{ marginBottom: '1.25rem', width: '100%', flexShrink: 0 }}>
        {/* Text Input Container */}
        <div style={{ width: '100%', animation: 'fade-in-up 0.4s ease-out' }}>
          <div
            className="text-sm mb-3"
            style={{
              color: colors.text,
              opacity: 0.65,
              fontFamily: 'var(--font-inter), sans-serif',
              letterSpacing: '0.08em',
              textTransform: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
              marginBottom: '0.9rem', // extra space above the search bar
            }}
          >
            Browse our curated collection.
          </div>

          {/* Pill search bar */}
          <div className="relative w-full">
            <div
              className="absolute inset-0 pointer-events-none rounded-full"
              style={{
                background: 'linear-gradient(120deg, rgba(168,85,247,0.35), rgba(168,85,247,0.05))',
                opacity: 0.7,
                filter: 'blur(0.5px)',
              }}
            />
            <div
              id="voice-search-button"
              className="relative flex items-center gap-2"
              style={{
                height: '52px',
                borderRadius: '9999px',
                paddingLeft: '1.25rem',
                paddingRight: '0.75rem',
                backgroundColor: 'rgba(8, 8, 10, 0.9)',
                border: `1.5px solid ${voiceDescription.trim().length ? colors.accent : 'rgba(255,255,255,0.2)'}`,
                boxShadow: voiceDescription.trim().length
                  ? `0 0 0 1px rgba(168,85,247,0.3), 0 14px 40px rgba(0,0,0,0.7)`
                  : '0 10px 28px rgba(0,0,0,0.6)',
              }}
            >
              {/* Try example button - moved to left side */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setVoiceDescription('Young British male with confident tone');
                }}
                className="hidden sm:inline-flex items-center text-xs font-medium transition-all duration-200 flex-shrink-0"
                style={{
                  backgroundColor: 'transparent',
                  color: colors.accent,
                  border: 'none',
                  fontFamily: 'var(--font-inter), sans-serif',
                  whiteSpace: 'nowrap',
                  marginRight: '0.5rem',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = colors.accent;
                  e.currentTarget.style.opacity = '0.8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = colors.accent;
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Try example
              </button>

              <input
                type="text"
                value={voiceDescription}
                onChange={(e) => {
                  const value = e.target.value;
                  setVoiceDescription(value);
                  if (searchDebounceRef.current) {
                    clearTimeout(searchDebounceRef.current);
                  }
                  searchDebounceRef.current = setTimeout(() => {
                    // Reserved for future search
                  }, 300);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isGenerating && voiceDescription.trim()) {
                    e.preventDefault();
                    handleGenerateAndPlay();
                  }
                }}
                placeholder="Describe the voice you want (e.g. calm Australian female, warm and confident)"
                className="flex-1 bg-transparent text-sm sm:text-base outline-none border-none"
                style={{
                  color: colors.text,
                  fontFamily: 'var(--font-inter), sans-serif',
                }}
              />

              {/* Play Button – inline at the right end of the input */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isGenerating && voiceDescription.trim()) {
                    handleGenerateAndPlay();
                  }
                }}
                disabled={isGenerating || !voiceDescription.trim()}
                className="flex items-center justify-center transition-all duration-300 bg-transparent border-none cursor-pointer flex-shrink-0"
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: isGenerating || !voiceDescription.trim() ? 'not-allowed' : 'pointer',
                  opacity: isGenerating || !voiceDescription.trim() ? 0.4 : 1,
                  boxShadow: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isGenerating && voiceDescription.trim()) {
                    e.currentTarget.style.transform = 'scale(1.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isGenerating && voiceDescription.trim()) {
                    e.currentTarget.style.transform = 'scale(1)';
                  }
                }}
              >
                {isGenerating ? (
                  <Loader2 
                    size={20} 
                    className="animate-spin" 
                    style={{ color: colors.accent }} 
                  />
                ) : isPreviewingDescription && isPlaying ? (
                  <Volume2 
                    size={20} 
                    style={{ 
                      color: colors.accent,
                      filter: `drop-shadow(0 0 8px ${colors.accent}) drop-shadow(0 0 16px ${colors.accent}80)`,
                    }} 
                  />
                ) : (
                  <Search 
                    size={20} 
                    strokeWidth={2}
                    style={{ 
                      color: colors.accent,
                      marginLeft: '2px',
                      filter: `drop-shadow(0 0 8px ${colors.accent}) drop-shadow(0 0 16px ${colors.accent}80)`,
                    }} 
                  />
                )}
              </button>

            </div>
          </div>
          {/* Phase 5.8: Smart Description Suggestions */}
          {descriptionAnalysis && descriptionAnalysis.suggestions.length > 0 && voiceDescription.trim().length > 0 && (
            <div
              className="mt-3 p-4 rounded-lg transition-all duration-300"
              style={{
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div className="flex items-start gap-2 mb-2">
                <Lightbulb size={16} style={{ color: colors.accent, marginTop: '2px', flexShrink: 0 }} />
                <div className="flex-1">
                  <div
                    className="text-xs font-medium mb-2"
                    style={{
                      color: colors.accent,
                      fontFamily: 'var(--font-inter), sans-serif',
                    }}
                  >
                    Suggestions to improve your description:
                  </div>
                  <div className="space-y-2">
                    {descriptionAnalysis.suggestions.slice(0, 3).map((suggestion, index) => (
                      <div
                        key={index}
                        className="text-xs"
                        style={{
                          color: colors.text,
                          opacity: 0.8,
                          fontFamily: 'var(--font-inter), sans-serif',
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{suggestion.message}:</span>{' '}
                        {suggestion.suggestion}
                        {suggestion.example && (
                          <div
                            className="mt-1 p-2 rounded"
                            style={{
                              backgroundColor: 'rgba(0, 0, 0, 0.2)',
                              fontStyle: 'italic',
                              opacity: 0.7,
                            }}
                          >
                            Example: {suggestion.example}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Current Voice Section - Sticky display in top left when scrolled past Available Voices */}
      {selectedVoice && selectedVoice.trim() !== '' && (() => {
        // Find the current voice from all available voices
        const currentVoice = [...voices, ...generatedVoices].find(
          v => v.id === selectedVoice || v.voiceId === selectedVoice
        );
        
        if (currentVoice) {
          const isCurrentVoicePlaying = previewingVoiceId === currentVoice.id && isPlaying;
          const isCurrentVoiceLoading = previewingVoiceId === currentVoice.id && isLoading;
          const isCurrentVoicePreviewing = previewingVoiceId === currentVoice.id;
          
          return (
            <>
              {/* Sticky current voice (shown when scrolling past Available Voices) - positioned in top left via OnboardingWizard */}
              <div
                id="current-voice-sticky"
                className="flex items-center gap-3"
                style={{
                  display: 'none', // Hidden by default, shown via scroll detection
                  padding: '0.5rem 1rem',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(8, 8, 10, 0.95)',
                  backdropFilter: 'blur(10px)',
                  border: `1px solid rgba(255, 255, 255, 0.1)`,
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreview(currentVoice);
                  }}
                  className="flex items-center justify-center rounded-full transition-all duration-300 flex-shrink-0"
                  style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    border: `1px solid ${colors.accent}`,
                    boxShadow:
                      isCurrentVoicePreviewing && isCurrentVoicePlaying
                        ? `0 0 18px ${colors.accent}90, 0 0 32px ${colors.accent}60`
                        : `0 0 12px ${colors.accent}70`,
                  }}
                >
                  {isCurrentVoiceLoading ? (
                    <Loader2
                      size={20}
                      className="animate-spin"
                      style={{ color: colors.accent }}
                    />
                  ) : isCurrentVoicePreviewing && isCurrentVoicePlaying ? (
                    <Volume2 size={22} style={{ color: colors.accent }} />
                  ) : (
                    <Play
                      size={20}
                      fill="#000"
                      stroke={colors.accent}
                      strokeWidth={2}
                      style={{ marginLeft: '1px' }}
                    />
                  )}
                </button>
                <span
                  className="text-sm"
                  style={{
                    color: colors.text,
                    opacity: 0.7,
                    fontFamily: 'var(--font-inter), sans-serif',
                  }}
                >
                  Current Voice
                </span>
                <span
                  className="text-sm font-semibold"
                  style={{
                    color: colors.text,
                    fontFamily: 'var(--font-inter), sans-serif',
                  }}
                >
                  {currentVoice.name}
                </span>
              </div>
            </>
          );
        }
        return null;
      })()}

      {/* Voice Library Section Header - Premium Spacing */}
      <div style={{ marginBottom: '1.25rem', width: '100%', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3
            id="available-voices-heading"
            className="text-lg sm:text-xl font-semibold"
              style={{
              color: colors.text,
              fontFamily: 'var(--font-inter), sans-serif',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              lineHeight: '1.3',
            }}
          >
            {generatedVoices.length > 0 ? 'Generated Voices' : 'Available Voices'}
            {generatedVoices.length > 0 ? (
              <span style={{ opacity: 0.6, fontWeight: 400, marginLeft: '0.5rem' }}>
                ({generatedVoices.length})
              </span>
            ) : filteredVoices.length > 0 ? (
              <span style={{ opacity: 0.6, fontWeight: 400, marginLeft: '0.5rem' }}>
                ({filteredVoices.length})
              </span>
            ) : null}
          </h3>
            </div>
          </div>
          
      {/* Premium Filter Section - filters row + active chips */}
      <div
        className="flex items-start justify-between gap-3 pb-1"
        style={{
          marginBottom: '1.25rem',
          flexShrink: 0,
          paddingTop: '0.5rem',
          position: 'relative',
          zIndex: 10000, // Higher z-index to ensure dropdowns appear above everything
          overflow: 'visible',
        }}
      >
        {/* Filters row - horizontal pills, scrollable on smaller screens */}
        <div
          className="flex flex-nowrap gap-2.5 items-center overflow-x-auto voice-selection-scrollbar"
          style={{
            overflowY: 'visible',
            overflow: 'visible',
            paddingBottom: '0.25rem',
            position: 'relative',
            zIndex: 1000,
            flex: 1,
            minWidth: 0, // Allow flex shrinking
          }}
        >
        {/* Language Dropdown - Concise Premium */}
        <div className="relative" style={{ position: 'relative', zIndex: 10001, overflow: 'visible' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              closeAllDropdowns();
              setIsLanguageDropdownOpen(!isLanguageDropdownOpen);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all duration-300 rounded-full relative overflow-hidden flex-shrink-0"
            style={{
              backgroundColor: activeLanguage !== 'all' 
                ? `${colors.accent}25` 
                : 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: activeLanguage !== 'all' ? colors.accent : colors.text,
              border: `1.5px solid ${activeLanguage !== 'all' ? colors.accent : 'rgba(255, 255, 255, 0.15)'}`,
              fontFamily: 'var(--font-inter), sans-serif',
              fontWeight: 500,
              boxShadow: activeLanguage !== 'all'
                ? `0 4px 12px ${colors.accent}40, 0 0 20px ${colors.accent}25, inset 0 0 10px ${colors.accent}10`
                : '0 2px 8px rgba(0, 0, 0, 0.2)',
              transform: 'scale(1)',
              animation: 'fade-in-scale 0.4s ease-out 0.1s both',
              pointerEvents: 'auto',
              cursor: 'pointer',
              position: 'relative',
              zIndex: 10002,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.backgroundColor = activeLanguage !== 'all' 
                ? `${colors.accent}35` 
                : 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.boxShadow = activeLanguage !== 'all'
                ? `0 6px 16px ${colors.accent}50, 0 0 30px ${colors.accent}35, inset 0 0 15px ${colors.accent}15`
                : `0 4px 12px rgba(255, 255, 255, 0.1)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.backgroundColor = activeLanguage !== 'all' 
                ? `${colors.accent}25` 
                : 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.boxShadow = activeLanguage !== 'all'
                ? `0 4px 12px ${colors.accent}40, 0 0 20px ${colors.accent}25, inset 0 0 10px ${colors.accent}10`
                : '0 2px 8px rgba(0, 0, 0, 0.2)';
            }}
          >
            <Globe size={13} style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap' }}>{activeLanguage === 'all' ? 'Lang' : getLanguageName(activeLanguage).slice(0, 8)}</span>
            <ChevronDown size={11} style={{ 
              transform: isLanguageDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              flexShrink: 0,
            }} />
          </button>
          
          {/* Dropdown Menu */}
          {isLanguageDropdownOpen && (
            <>
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '0.5rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.95)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: `1.5px solid ${colors.accent}40`,
                  boxShadow: `0 12px 40px rgba(0, 0, 0, 0.6), 0 0 24px ${colors.accent}30, inset 0 0 20px ${colors.accent}10`,
                  minWidth: '150px',
                  maxHeight: '320px',
                  overflowY: 'auto',
                  zIndex: 10003, // Higher than backdrop (9998) to ensure clicks work
                  animation: 'fade-in-scale 0.2s ease-out',
                  pointerEvents: 'auto', // Ensure clicks work
                }}
                onWheel={(e) => {
                  // Scroll only inside this panel, not the wizard/cards
                  e.stopPropagation();
                }}
                onTouchStart={(e) => {
                  const container = e.currentTarget as HTMLDivElement & {
                    _touchStartY?: number;
                    _touchStartScrollTop?: number;
                  };
                  container._touchStartY = e.touches[0].clientY;
                  container._touchStartScrollTop = container.scrollTop;
                }}
                onTouchMove={(e) => {
                  const container = e.currentTarget as HTMLDivElement & {
                    _touchStartY?: number;
                    _touchStartScrollTop?: number;
                  };
                  if (container._touchStartY !== undefined && container._touchStartScrollTop !== undefined) {
                    const deltaY = container._touchStartY - e.touches[0].clientY;
                    container.scrollTop = container._touchStartScrollTop + deltaY;
                    e.stopPropagation();
                  }
                }}
                onClick={(e) => {
                  // Prevent clicks inside dropdown from closing it
                  e.stopPropagation();
                }}
              >
                {(['all', ...availableLanguages] as LanguageCode[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveLanguage(lang);
                      setIsLanguageDropdownOpen(false);
                      stopPreview();
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm transition-all duration-200"
                    style={{
                      backgroundColor: activeLanguage === lang 
                        ? 'rgba(168, 85, 247, 0.2)' 
                        : 'transparent',
                      color: activeLanguage === lang ? colors.accent : colors.text,
                      fontFamily: 'var(--font-inter), sans-serif',
                      fontWeight: activeLanguage === lang ? 500 : 400,
                      zIndex: 10004, // Higher than dropdown container to ensure clicks work
                      position: 'relative',
                      pointerEvents: 'auto', // Ensure clicks work
                      cursor: 'pointer', // Show pointer cursor
                    }}
                    onMouseEnter={(e) => {
                      if (activeLanguage !== lang) {
                        e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeLanguage !== lang) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {lang === 'all' ? 'All Languages' : getLanguageName(lang)}
                  </button>
                ))}
              </div>
              {/* Backdrop to close dropdown */}
              <div
                className="fixed inset-0"
                onClick={(e) => {
                  // Only close if clicking directly on backdrop, not on dropdown or voice cards
                  if (e.target === e.currentTarget) {
                    closeAllDropdowns();
                  }
                }}
                onMouseDown={(e) => {
                  // Prevent backdrop from blocking dropdown clicks
                  const target = e.target as HTMLElement;
                  if (target.closest('.rounded-xl') || target.closest('.voice-card')) {
                    e.preventDefault();
                  }
                }}
                style={{ cursor: 'pointer', zIndex: 9998, pointerEvents: 'auto' }}
                onPointerDown={(e) => {
                  // Allow voice card clicks to pass through
                  const target = e.target as HTMLElement;
                  if (target.closest('.voice-card')) {
                    e.stopPropagation();
                  }
                }}
              />
            </>
          )}
        </div>

        {/* Gender Dropdown - Concise Premium */}
        <div className="relative" style={{ position: 'relative', zIndex: 1000, overflow: 'visible' }}>
          <button
            onClick={() => {
              closeAllDropdowns();
              setIsGenderDropdownOpen(!isGenderDropdownOpen);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all duration-300 rounded-full relative overflow-hidden flex-shrink-0"
            style={{
              backgroundColor: activeFilter !== 'all' 
                ? `${colors.accent}25` 
                : 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: activeFilter !== 'all' ? colors.accent : colors.text,
              border: `1.5px solid ${activeFilter !== 'all' ? colors.accent : 'rgba(255, 255, 255, 0.15)'}`,
              fontFamily: 'var(--font-inter), sans-serif',
              fontWeight: 500,
              boxShadow: activeFilter !== 'all'
                ? `0 4px 12px ${colors.accent}40, 0 0 20px ${colors.accent}25, inset 0 0 10px ${colors.accent}10`
                : '0 2px 8px rgba(0, 0, 0, 0.2)',
              transform: 'scale(1)',
              animation: 'fade-in-scale 0.4s ease-out 0.15s both',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.backgroundColor = activeFilter !== 'all' 
                ? `${colors.accent}35` 
                : 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.boxShadow = activeFilter !== 'all'
                ? `0 6px 16px ${colors.accent}50, 0 0 30px ${colors.accent}35, inset 0 0 15px ${colors.accent}15`
                : `0 4px 12px rgba(255, 255, 255, 0.1)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.backgroundColor = activeFilter !== 'all' 
                ? `${colors.accent}25` 
                : 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.boxShadow = activeFilter !== 'all'
                ? `0 4px 12px ${colors.accent}40, 0 0 20px ${colors.accent}25, inset 0 0 10px ${colors.accent}10`
                : '0 2px 8px rgba(0, 0, 0, 0.2)';
            }}
          >
            <Users size={13} style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap' }}>{activeFilter === 'all' ? 'Gender' : activeFilter === 'male' ? '♂ Male' : '♀ Female'}</span>
            <ChevronDown size={11} style={{ 
              transform: isGenderDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              flexShrink: 0,
            }} />
          </button>
          
          {isGenderDropdownOpen && (
            <>
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '0.5rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.95)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: `1.5px solid ${colors.accent}40`,
                  boxShadow: `0 12px 40px rgba(0, 0, 0, 0.6), 0 0 24px ${colors.accent}30, inset 0 0 20px ${colors.accent}10`,
                  minWidth: '150px',
                  maxHeight: '320px',
                  overflowY: 'auto',
                  zIndex: 10000,
                  animation: 'fade-in-scale 0.2s ease-out',
                }}
                onWheel={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
        {(['all', 'male', 'female'] as const).map((filter) => (
          <button
            key={filter}
            onClick={(e) => {
              e.stopPropagation();
              setActiveFilter(filter);
              setIsGenderDropdownOpen(false);
              stopPreview();
            }}
                    className="w-full text-left px-4 py-2.5 text-sm transition-all duration-200"
            style={{
              backgroundColor: activeFilter === filter 
                ? 'rgba(168, 85, 247, 0.2)' 
                        : 'transparent',
              color: activeFilter === filter ? colors.accent : colors.text,
              fontFamily: 'var(--font-inter), sans-serif',
              fontWeight: activeFilter === filter ? 500 : 400,
              zIndex: 501,
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              if (activeFilter !== filter) {
                e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeFilter !== filter) {
                        e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
                    {filter === 'all' ? 'All Genders' : filter === 'male' ? '♂ Male' : '♀ Female'}
          </button>
        ))}
              </div>
              <div
                className="fixed inset-0"
                onClick={(e) => {
                  // Only close if clicking directly on backdrop, not on voice cards
                  const target = e.target as HTMLElement;
                  if (!target.closest('.voice-card') && e.target === e.currentTarget) {
                    closeAllDropdowns();
                  }
                }}
                onPointerDown={(e) => {
                  // Allow voice card clicks to pass through
                  const target = e.target as HTMLElement;
                  if (target.closest('.voice-card')) {
                    e.stopPropagation();
                  }
                }}
                style={{ cursor: 'pointer', zIndex: 9998, pointerEvents: 'auto' }}
              />
            </>
          )}
        </div>

        {/* Accent Dropdown - Concise Premium */}
        {filterOptions.accents.length > 0 && (
          <div className="relative" style={{ position: 'relative', zIndex: 1000, overflow: 'visible' }}>
            <button
              onClick={() => {
                closeAllDropdowns();
                setIsAccentDropdownOpen(!isAccentDropdownOpen);
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all duration-300 rounded-full relative overflow-hidden flex-shrink-0"
              style={{
                backgroundColor: activeAccent !== 'all' 
                  ? `${colors.accent}25` 
                  : 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                color: activeAccent !== 'all' ? colors.accent : colors.text,
                border: `1.5px solid ${activeAccent !== 'all' ? colors.accent : 'rgba(255, 255, 255, 0.15)'}`,
                fontFamily: 'var(--font-inter), sans-serif',
                fontWeight: 500,
                boxShadow: activeAccent !== 'all'
                  ? `0 4px 12px ${colors.accent}40, 0 0 20px ${colors.accent}25, inset 0 0 10px ${colors.accent}10`
                  : '0 2px 8px rgba(0, 0, 0, 0.2)',
                transform: 'scale(1)',
                animation: 'fade-in-scale 0.4s ease-out 0.2s both',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.backgroundColor = activeAccent !== 'all' 
                  ? `${colors.accent}35` 
                  : 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.boxShadow = activeAccent !== 'all'
                  ? `0 6px 16px ${colors.accent}50, 0 0 30px ${colors.accent}35, inset 0 0 15px ${colors.accent}15`
                  : `0 4px 12px rgba(255, 255, 255, 0.1)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.backgroundColor = activeAccent !== 'all' 
                  ? `${colors.accent}25` 
                  : 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.boxShadow = activeAccent !== 'all'
                  ? `0 4px 12px ${colors.accent}40, 0 0 20px ${colors.accent}25, inset 0 0 10px ${colors.accent}10`
                  : '0 2px 8px rgba(0, 0, 0, 0.2)';
              }}
            >
              <MapPin size={13} style={{ flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap' }}>{activeAccent === 'all' ? 'Accent' : activeAccent.length > 10 ? activeAccent.slice(0, 10) + '...' : activeAccent}</span>
              <ChevronDown size={11} style={{ 
                transform: isAccentDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                flexShrink: 0,
              }} />
            </button>
            
            {isAccentDropdownOpen && (
              <>
                <div
                  className="rounded-xl overflow-hidden"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '0.5rem',
                    backgroundColor: 'rgba(0, 0, 0, 0.95)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: `1.5px solid ${colors.accent}40`,
                    boxShadow: `0 12px 40px rgba(0, 0, 0, 0.6), 0 0 24px ${colors.accent}30, inset 0 0 20px ${colors.accent}10`,
                    minWidth: '150px',
                    maxHeight: '320px',
                    overflowY: 'auto',
                    zIndex: 10000,
                    animation: 'fade-in-scale 0.2s ease-out',
                  }}
                  onWheel={(e) => {
                    // Scroll only inside this panel, not the wizard/cards
                    e.stopPropagation();
                  }}
                  onTouchStart={(e) => {
                    const container = e.currentTarget as HTMLDivElement & {
                      _touchStartY?: number;
                      _touchStartScrollTop?: number;
                    };
                    container._touchStartY = e.touches[0].clientY;
                    container._touchStartScrollTop = container.scrollTop;
                  }}
                  onTouchMove={(e) => {
                    const container = e.currentTarget as HTMLDivElement & {
                      _touchStartY?: number;
                      _touchStartScrollTop?: number;
                    };
                    if (container._touchStartY !== undefined && container._touchStartScrollTop !== undefined) {
                      const deltaY = container._touchStartY - e.touches[0].clientY;
                      container.scrollTop = container._touchStartScrollTop + deltaY;
                      e.stopPropagation();
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveAccent('all');
                      setIsAccentDropdownOpen(false);
                      stopPreview();
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm transition-all duration-200"
                    style={{
                      backgroundColor: activeAccent === 'all' 
                        ? 'rgba(168, 85, 247, 0.2)' 
                        : 'transparent',
                      color: activeAccent === 'all' ? colors.accent : colors.text,
                      fontFamily: 'var(--font-inter), sans-serif',
                      fontWeight: activeAccent === 'all' ? 500 : 400,
                      zIndex: 501,
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (activeAccent !== 'all') {
                        e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeAccent !== 'all') {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    All Accents
                  </button>
                  {filterOptions.accents.map((accent) => (
              <button
                key={accent}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveAccent(accent);
                  setIsAccentDropdownOpen(false);
                  stopPreview();
                }}
                      className="w-full text-left px-4 py-2.5 text-sm transition-all duration-200"
                style={{
                  backgroundColor: activeAccent === accent 
                    ? 'rgba(168, 85, 247, 0.2)' 
                          : 'transparent',
                  color: activeAccent === accent ? colors.accent : colors.text,
                  fontFamily: 'var(--font-inter), sans-serif',
                  fontWeight: activeAccent === accent ? 500 : 400,
                  zIndex: 501,
                  position: 'relative',
                }}
                      onMouseEnter={(e) => {
                        if (activeAccent !== accent) {
                          e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeAccent !== accent) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                }}
              >
                {accent}
              </button>
            ))}
                </div>
              <div
                className="fixed inset-0"
                onClick={(e) => {
                  // Only close if clicking directly on backdrop, not on voice cards
                  const target = e.target as HTMLElement;
                  if (!target.closest('.voice-card') && e.target === e.currentTarget) {
                    closeAllDropdowns();
                  }
                }}
                onPointerDown={(e) => {
                  // Allow voice card clicks to pass through
                  const target = e.target as HTMLElement;
                  if (target.closest('.voice-card')) {
                    e.stopPropagation();
                  }
                }}
                style={{ cursor: 'pointer', zIndex: 350, pointerEvents: 'auto' }}
                />
              </>
            )}
          </div>
        )}

        {/* Style/Tone Dropdown - Concise Premium */}
        {filterOptions.styles.length > 0 && (
          <div className="relative" style={{ position: 'relative', zIndex: 1000, overflow: 'visible' }}>
            <button
              onClick={() => {
                closeAllDropdowns();
                setIsStyleDropdownOpen(!isStyleDropdownOpen);
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all duration-300 rounded-full relative overflow-hidden flex-shrink-0"
              style={{
                backgroundColor: activeStyle !== 'all' 
                  ? `${colors.accent}25` 
                  : 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                color: activeStyle !== 'all' ? colors.accent : colors.text,
                border: `1.5px solid ${activeStyle !== 'all' ? colors.accent : 'rgba(255, 255, 255, 0.15)'}`,
                fontFamily: 'var(--font-inter), sans-serif',
                fontWeight: 500,
                boxShadow: activeStyle !== 'all'
                  ? `0 4px 12px ${colors.accent}40, 0 0 20px ${colors.accent}25, inset 0 0 10px ${colors.accent}10`
                  : '0 2px 8px rgba(0, 0, 0, 0.2)',
                transform: 'scale(1)',
                animation: 'fade-in-scale 0.4s ease-out 0.25s both',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.backgroundColor = activeStyle !== 'all' 
                  ? `${colors.accent}35` 
                  : 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.boxShadow = activeStyle !== 'all'
                  ? `0 6px 16px ${colors.accent}50, 0 0 30px ${colors.accent}35, inset 0 0 15px ${colors.accent}15`
                  : `0 4px 12px rgba(255, 255, 255, 0.1)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.backgroundColor = activeStyle !== 'all' 
                  ? `${colors.accent}25` 
                  : 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.boxShadow = activeStyle !== 'all'
                  ? `0 4px 12px ${colors.accent}40, 0 0 20px ${colors.accent}25, inset 0 0 10px ${colors.accent}10`
                  : '0 2px 8px rgba(0, 0, 0, 0.2)';
              }}
            >
              <Palette size={13} style={{ flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap' }}>{activeStyle === 'all' ? 'Style' : activeStyle.length > 10 ? activeStyle.slice(0, 10) + '...' : activeStyle}</span>
              <ChevronDown size={11} style={{ 
                transform: isStyleDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                flexShrink: 0,
              }} />
            </button>
            
            {isStyleDropdownOpen && (
              <>
                <div
                  className="rounded-xl overflow-hidden"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '0.5rem',
                    backgroundColor: 'rgba(0, 0, 0, 0.95)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: `1.5px solid ${colors.accent}40`,
                    boxShadow: `0 12px 40px rgba(0, 0, 0, 0.6), 0 0 24px ${colors.accent}30, inset 0 0 20px ${colors.accent}10`,
                    minWidth: '150px',
                    maxHeight: '320px',
                    overflowY: 'auto',
                    zIndex: 10000,
                    animation: 'fade-in-scale 0.2s ease-out',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  onWheel={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveStyle('all');
                      setIsStyleDropdownOpen(false);
                      stopPreview();
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm transition-all duration-200"
                    style={{
                      backgroundColor: activeStyle === 'all' 
                        ? 'rgba(168, 85, 247, 0.2)' 
                        : 'transparent',
                      color: activeStyle === 'all' ? colors.accent : colors.text,
                      fontFamily: 'var(--font-inter), sans-serif',
                      fontWeight: activeStyle === 'all' ? 500 : 400,
                      zIndex: 501,
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (activeStyle !== 'all') {
                        e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeStyle !== 'all') {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    All Styles
                  </button>
                  {filterOptions.styles.map((style) => (
              <button
                key={style}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveStyle(style);
                  setIsStyleDropdownOpen(false);
                  stopPreview();
                }}
                      className="w-full text-left px-4 py-2.5 text-sm transition-all duration-200 capitalize"
                style={{
                  backgroundColor: activeStyle === style 
                    ? 'rgba(168, 85, 247, 0.2)' 
                          : 'transparent',
                  color: activeStyle === style ? colors.accent : colors.text,
                  fontFamily: 'var(--font-inter), sans-serif',
                  fontWeight: activeStyle === style ? 500 : 400,
                  zIndex: 501,
                  position: 'relative',
                }}
                      onMouseEnter={(e) => {
                        if (activeStyle !== style) {
                          e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeStyle !== style) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                }}
              >
                {style}
              </button>
            ))}
                </div>
              <div
                className="fixed inset-0"
                onClick={(e) => {
                  // Only close if clicking directly on backdrop, not on voice cards
                  const target = e.target as HTMLElement;
                  if (!target.closest('.voice-card') && e.target === e.currentTarget) {
                    closeAllDropdowns();
                  }
                }}
                onPointerDown={(e) => {
                  // Allow voice card clicks to pass through
                  const target = e.target as HTMLElement;
                  if (target.closest('.voice-card')) {
                    e.stopPropagation();
                  }
                }}
                style={{ cursor: 'pointer', zIndex: 350, pointerEvents: 'auto' }}
                />
              </>
            )}
          </div>
        )}

        {/* Age Group Dropdown - Concise Premium */}
        <div className="relative" style={{ position: 'relative', zIndex: 1000, overflow: 'visible' }}>
          <button
            onClick={() => {
              closeAllDropdowns();
              setIsAgeGroupDropdownOpen(!isAgeGroupDropdownOpen);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all duration-300 rounded-full relative overflow-hidden flex-shrink-0"
            style={{
              backgroundColor: activeAgeGroup !== 'all' 
                ? `${colors.accent}25` 
                : 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: activeAgeGroup !== 'all' ? colors.accent : colors.text,
              border: `1.5px solid ${activeAgeGroup !== 'all' ? colors.accent : 'rgba(255, 255, 255, 0.15)'}`,
              fontFamily: 'var(--font-inter), sans-serif',
              fontWeight: 500,
              boxShadow: activeAgeGroup !== 'all'
                ? `0 4px 12px ${colors.accent}40, 0 0 20px ${colors.accent}25, inset 0 0 10px ${colors.accent}10`
                : '0 2px 8px rgba(0, 0, 0, 0.2)',
              transform: 'scale(1)',
              animation: 'fade-in-scale 0.4s ease-out 0.3s both',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.backgroundColor = activeAgeGroup !== 'all' 
                ? `${colors.accent}35` 
                : 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.boxShadow = activeAgeGroup !== 'all'
                ? `0 6px 16px ${colors.accent}50, 0 0 30px ${colors.accent}35, inset 0 0 15px ${colors.accent}15`
                : `0 4px 12px rgba(255, 255, 255, 0.1)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.backgroundColor = activeAgeGroup !== 'all' 
                ? `${colors.accent}25` 
                : 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.boxShadow = activeAgeGroup !== 'all'
                ? `0 4px 12px ${colors.accent}40, 0 0 20px ${colors.accent}25, inset 0 0 10px ${colors.accent}10`
                : '0 2px 8px rgba(0, 0, 0, 0.2)';
            }}
          >
            <Calendar size={13} style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap' }}>{activeAgeGroup === 'all' ? 'Age' : activeAgeGroup === 'middle-aged' ? 'Mid' : activeAgeGroup}</span>
            <ChevronDown size={11} style={{ 
              transform: isAgeGroupDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              flexShrink: 0,
            }} />
          </button>
          
          {isAgeGroupDropdownOpen && (
            <>
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '0.5rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.95)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: `1.5px solid ${colors.accent}40`,
                  boxShadow: `0 12px 40px rgba(0, 0, 0, 0.6), 0 0 24px ${colors.accent}30, inset 0 0 20px ${colors.accent}10`,
                  minWidth: '150px',
                  maxHeight: '320px',
                  overflowY: 'auto',
                  zIndex: 10000,
                  animation: 'fade-in-scale 0.2s ease-out',
                }}
                onWheel={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
        {(['all', 'young', 'middle-aged', 'older'] as const).map((age) => (
          <button
            key={age}
            onClick={(e) => {
              e.stopPropagation();
              setActiveAgeGroup(age);
              setIsAgeGroupDropdownOpen(false);
              stopPreview();
            }}
                    className="w-full text-left px-4 py-2.5 text-sm transition-all duration-200 capitalize"
            style={{
              backgroundColor: activeAgeGroup === age 
                ? 'rgba(168, 85, 247, 0.2)' 
                        : 'transparent',
              color: activeAgeGroup === age ? colors.accent : colors.text,
              fontFamily: 'var(--font-inter), sans-serif',
              fontWeight: activeAgeGroup === age ? 500 : 400,
              zIndex: 501,
              position: 'relative',
            }}
                    onMouseEnter={(e) => {
                      if (activeAgeGroup !== age) {
                        e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeAgeGroup !== age) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
            }}
          >
            {age === 'all' ? 'All Ages' : age === 'middle-aged' ? 'Middle-aged' : age}
          </button>
        ))}
              </div>
              <div
                className="fixed inset-0"
                onClick={(e) => {
                  // Only close if clicking directly on backdrop, not on voice cards
                  const target = e.target as HTMLElement;
                  if (!target.closest('.voice-card') && e.target === e.currentTarget) {
                    closeAllDropdowns();
                  }
                }}
                onPointerDown={(e) => {
                  // Allow voice card clicks to pass through
                  const target = e.target as HTMLElement;
                  if (target.closest('.voice-card')) {
                    e.stopPropagation();
                  }
                }}
                style={{ cursor: 'pointer', zIndex: 9998, pointerEvents: 'auto' }}
              />
            </>
          )}
        </div>


        {/* Clear All Button - Premium */}
        {(activeFilter !== 'all' || activeLanguage !== 'all' || activeAccent !== 'all' || 
          activeStyle !== 'all' || activeAgeGroup !== 'all') && (
            <button
              onClick={() => {
              setActiveFilter('all');
              setActiveLanguage('all');
              setActiveAccent('all');
              setActiveStyle('all');
              setActiveAgeGroup('all');
              stopPreview();
            }}
            className="px-3 py-2 text-xs font-medium transition-all duration-300 rounded-full flex-shrink-0"
              style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(12px)',
              color: colors.text,
              border: '1.5px solid rgba(255, 255, 255, 0.15)',
                fontFamily: 'var(--font-inter), sans-serif',
              opacity: 0.8,
                transform: 'scale(1)',
              animation: 'fade-in-scale 0.4s ease-out 0.4s both',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.opacity = '0.8';
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Clear
            </button>
        )}
            
        {/* Active Filter Tags - Premium Design, Right of Filters */}
                <div
          className="flex flex-nowrap items-center gap-2 ml-auto"
                  style={{
            flexShrink: 0,
            overflow: 'hidden',
            maxWidth: '100%',
            marginLeft: 'auto',
          }}
        >
          {/* Language tag */}
          {activeLanguage !== 'all' && (
            <button
              type="button"
              onClick={() => setActiveLanguage('all')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 flex-shrink-0"
              style={{
                backgroundColor: `${colors.accent}30`,
                border: `1.5px solid ${colors.accent}`,
                color: colors.accent,
                fontFamily: 'var(--font-inter), sans-serif',
                fontWeight: 600,
                fontSize: '0.75rem',
                borderRadius: '8px',
                boxShadow: `0 2px 8px ${colors.accent}40, inset 0 0 8px ${colors.accent}15`,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '120px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${colors.accent}40`;
                e.currentTarget.style.boxShadow = `0 4px 12px ${colors.accent}50, inset 0 0 12px ${colors.accent}20`;
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = `${colors.accent}30`;
                e.currentTarget.style.boxShadow = `0 2px 8px ${colors.accent}40, inset 0 0 8px ${colors.accent}15`;
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <Globe size={11} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getLanguageName(activeLanguage)}
              </span>
              <span style={{ fontSize: '0.65rem', opacity: 0.9, marginLeft: '2px', flexShrink: 0 }}>×</span>
            </button>
          )}
          {/* Gender tag */}
          {activeFilter !== 'all' && (
                  <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 flex-shrink-0"
                    style={{
                backgroundColor: `${colors.accent}30`,
                border: `1.5px solid ${colors.accent}`,
                color: colors.accent,
                      fontFamily: 'var(--font-inter), sans-serif',
                fontWeight: 600,
                fontSize: '0.75rem',
                borderRadius: '8px',
                boxShadow: `0 2px 8px ${colors.accent}40, inset 0 0 8px ${colors.accent}15`,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100px',
                transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${colors.accent}40`;
                e.currentTarget.style.boxShadow = `0 4px 12px ${colors.accent}50, inset 0 0 12px ${colors.accent}20`;
                e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = `${colors.accent}30`;
                e.currentTarget.style.boxShadow = `0 2px 8px ${colors.accent}40, inset 0 0 8px ${colors.accent}15`;
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <Users size={11} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeFilter === 'male' ? 'Male' : 'Female'}
              </span>
              <span style={{ fontSize: '0.65rem', opacity: 0.9, marginLeft: '2px', flexShrink: 0 }}>×</span>
                  </button>
          )}
          {/* Accent tag */}
          {activeAccent !== 'all' && (
              <button
              type="button"
              onClick={() => setActiveAccent('all')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 flex-shrink-0"
                style={{
                backgroundColor: `${colors.accent}30`,
                border: `1.5px solid ${colors.accent}`,
                color: colors.accent,
                  fontFamily: 'var(--font-inter), sans-serif',
                fontWeight: 600,
                fontSize: '0.75rem',
                borderRadius: '8px',
                boxShadow: `0 2px 8px ${colors.accent}40, inset 0 0 8px ${colors.accent}15`,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '140px',
                transition: 'all 0.2s ease',
                }}
                      onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${colors.accent}40`;
                e.currentTarget.style.boxShadow = `0 4px 12px ${colors.accent}50, inset 0 0 12px ${colors.accent}20`;
                e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = `${colors.accent}30`;
                e.currentTarget.style.boxShadow = `0 2px 8px ${colors.accent}40, inset 0 0 8px ${colors.accent}15`;
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <MapPin size={11} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeAccent}
              </span>
              <span style={{ fontSize: '0.65rem', opacity: 0.9, marginLeft: '2px', flexShrink: 0 }}>×</span>
              </button>
          )}
          {/* Style tag */}
          {activeStyle !== 'all' && (
          <button
              type="button"
              onClick={() => setActiveStyle('all')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 flex-shrink-0"
              style={{
                backgroundColor: `${colors.accent}30`,
                border: `1.5px solid ${colors.accent}`,
                color: colors.accent,
                fontFamily: 'var(--font-inter), sans-serif',
                fontWeight: 600,
                fontSize: '0.75rem',
                borderRadius: '8px',
                boxShadow: `0 2px 8px ${colors.accent}40, inset 0 0 8px ${colors.accent}15`,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '140px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${colors.accent}40`;
                e.currentTarget.style.boxShadow = `0 4px 12px ${colors.accent}50, inset 0 0 12px ${colors.accent}20`;
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = `${colors.accent}30`;
                e.currentTarget.style.boxShadow = `0 2px 8px ${colors.accent}40, inset 0 0 8px ${colors.accent}15`;
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <Palette size={11} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeStyle}
              </span>
              <span style={{ fontSize: '0.65rem', opacity: 0.9, marginLeft: '2px', flexShrink: 0 }}>×</span>
            </button>
          )}
          {/* Age tag */}
          {activeAgeGroup !== 'all' && (
            <button
              type="button"
              onClick={() => setActiveAgeGroup('all')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 flex-shrink-0"
            style={{
                backgroundColor: `${colors.accent}30`,
                border: `1.5px solid ${colors.accent}`,
                color: colors.accent,
              fontFamily: 'var(--font-inter), sans-serif',
                fontWeight: 600,
                fontSize: '0.75rem',
                borderRadius: '8px',
                boxShadow: `0 2px 8px ${colors.accent}40, inset 0 0 8px ${colors.accent}15`,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '120px',
                transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${colors.accent}40`;
                e.currentTarget.style.boxShadow = `0 4px 12px ${colors.accent}50, inset 0 0 12px ${colors.accent}20`;
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = `${colors.accent}30`;
                e.currentTarget.style.boxShadow = `0 2px 8px ${colors.accent}40, inset 0 0 8px ${colors.accent}15`;
              e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <Calendar size={11} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeAgeGroup === 'middle-aged' ? 'Middle-aged' : activeAgeGroup}
              </span>
              <span style={{ fontSize: '0.65rem', opacity: 0.9, marginLeft: '2px', flexShrink: 0 }}>×</span>
          </button>
        )}
        </div>
        </div>
      </div>

      {/* Voice cards grid - scrollable container */}
      <div
        data-voice-scroll-container
        style={{
          width: '100%',
          position: 'relative',
          // When any dropdown is open, push cards down significantly to make room for dropdown
          marginTop: isAnyFilterDropdownOpen ? '22rem' : '0.5rem', // Large margin when dropdown open to push cards below
          paddingRight: '0.5rem',
          paddingBottom: '2.5rem',
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
          zIndex: 10001, // Above backdrop (9998) but below dropdown menus (10000+)
        }}
        className="voice-selection-scrollbar"
      >
        {isLoadingVoices ? (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '0 0.5rem' }}
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="rounded-[18px] relative flex flex-col"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '2px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '18px',
                  minHeight: '240px',
                  padding: '1.75rem',
                  position: 'relative',
                  overflow: 'hidden',
                  animation: 'fade-in-scale 0.5s ease-out',
                  animationDelay: `${index * 0.05}s`,
                  animationFillMode: 'both',
                }}
              >
                {/* Shimmer effect */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)',
                    animation: 'shimmer 2s infinite',
                    transform: 'translateX(-100%)',
                  }}
                />
                {/* Skeleton content */}
                <div className="space-y-4 relative z-10">
                  <div className="h-4 bg-white/10 rounded w-3/4" style={{ animation: 'pulse 2s infinite' }} />
                  <div className="h-3 bg-white/5 rounded w-1/2" style={{ animation: 'pulse 2s infinite 0.2s' }} />
                  <div className="flex justify-center items-center h-16">
                    <div className="w-12 h-12 bg-white/10 rounded-full" style={{ animation: 'pulse 2s infinite 0.4s' }} />
                  </div>
                  <div className="flex gap-2 justify-center">
                    <div className="h-6 bg-white/10 rounded-full w-16" style={{ animation: 'pulse 2s infinite 0.6s' }} />
                    <div className="h-6 bg-white/10 rounded-full w-20" style={{ animation: 'pulse 2s infinite 0.8s' }} />
                  </div>
                </div>
                <style>{`
                  @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                  }
                  @keyframes pulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 0.8; }
                  }
                `}</style>
              </div>
            ))}
          </div>
        ) : generatedVoices.length === 0 && filteredVoices.length === 0 && !isGenerating ? (
          <div 
            className="flex flex-col items-center justify-center py-16 gap-6"
            style={{
              animation: 'fade-in-up 0.6s ease-out',
            }}
          >
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                backdropFilter: 'blur(20px)',
                border: '2px solid rgba(168, 85, 247, 0.3)',
                marginBottom: '1rem',
              }}
            >
              <Volume2 size={40} style={{ color: colors.accent, opacity: 0.7 }} />
            </div>
            <h3
              style={{
                color: colors.text,
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '1.25rem',
                fontWeight: 600,
                marginBottom: '0.5rem',
              }}
            >
              No voices found
            </h3>
            <p style={{ 
              color: colors.text, 
              opacity: 0.7, 
              fontFamily: 'var(--font-inter), sans-serif', 
              fontSize: '0.95rem',
              textAlign: 'center',
              maxWidth: '400px',
              lineHeight: '1.6',
            }}>
              No voices match your current search. Go back to browse the full voice library.
            </p>
            <button
              onClick={() => {
                // Clear ALL search-related state to show full library
                setVoiceDescription('');
                setGeneratedVoices([]);
                setDescriptionHash('');
                setMatchedVoiceId(null);
                setIsPreviewingDescription(false);
                setIsPlaying(false);
                // Stop any playing audio
                if (descriptionAudioRef.current) {
                  descriptionAudioRef.current.pause();
                  descriptionAudioRef.current = null;
                }
                // Reset all filters
                setActiveFilter('all');
                setActiveLanguage('all');
                setActiveAccent('all');
                setActiveStyle('all');
                setActiveAgeGroup('all');
                // Scroll to voice library section to show the results
                setTimeout(() => {
                  const voiceSection = document.getElementById('available-voices-heading');
                  if (voiceSection) {
                    voiceSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  } else {
                    // Fallback: scroll to top of voice cards container
                    const voiceCardsContainer = document.querySelector('[data-voice-scroll-container]');
                    if (voiceCardsContainer) {
                      voiceCardsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }
                }, 150);
              }}
              className="px-6 py-3 rounded-full text-sm font-medium transition-all duration-300"
              style={{
                backgroundColor: 'rgba(168, 85, 247, 0.2)',
                backdropFilter: 'blur(10px)',
                border: `1px solid ${colors.accent}`,
                color: colors.accent,
                fontFamily: 'var(--font-inter), sans-serif',
                marginTop: '1rem',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.3)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.2)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Go Back to Library
            </button>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5"
            style={{ 
              width: '100%', 
              maxWidth: '1200px', 
              margin: '0 auto', 
              padding: '0 0.5rem 1rem 0.5rem',
              minHeight: 'min-content',
            }}
          >
            {filteredVoices.map((voice, index) => {
          const isSelected =
            selectedVoice === voice.voiceId ||
            selectedVoice === voice.id;
          const isPreviewing = previewingVoiceId === voice.id;
          const hasSelection = selectedVoice !== null && selectedVoice !== '';
          const isDarkened = hasSelection && !isSelected;

          // Compact tag set for card header - filter out incorrect tags
          const primaryTags: string[] = [];
          if (voice.gender) primaryTags.push(voice.gender);
          if (voice.accent) primaryTags.push(voice.accent);
          if (voice.ageGroup) primaryTags.push(voice.ageGroup.replace('-', ' '));
          if (voice.tone && voice.tone.length) primaryTags.push(voice.tone[0]);
          
          // Filter tags to only show valid ones that match the description
          // Remove incorrect tags like "Chinese" when not in description
          if (voice.tags && Array.isArray(voice.tags)) {
            const descriptionLower = voiceDescription.toLowerCase();
            const validTags = voice.tags.filter(tag => {
              const tagLower = tag.toLowerCase();
              // Only include tags that:
              // 1. Match the description keywords
              // 2. Are valid voice characteristics (gender, accent, age, tone)
              // 3. Are not generic/incorrect tags
              const isInDescription = descriptionLower.includes(tagLower);
              const isValidCharacteristic = ['male', 'female', 'neutral', 'young', 'middle-aged', 'older', 'american', 'british', 'indian', 'chinese', 'russian', 'spanish', 'french', 'german', 'italian', 'japanese', 'korean'].some(valid => tagLower.includes(valid));
              const isNotGeneric = !['voice', 'speaker', 'person', 'character'].includes(tagLower);
              
              // Include if it's in description OR is a valid characteristic
              return (isInDescription || isValidCharacteristic) && isNotGeneric;
            });
            
            // Add valid tags to primaryTags (limit to avoid clutter)
            validTags.slice(0, 2).forEach(tag => {
              if (!primaryTags.includes(tag)) {
                primaryTags.push(tag);
              }
            });
          }

          // Create stable unique key using voice ID - don't use index as it changes with filtering
          // Use voiceId or id as primary, fallback to generatedVoiceId, then index only as last resort
          const stableKey = voice.voiceId || voice.id || voice.generatedVoiceId || `voice-${index}`;
          const uniqueKey = `${voice.source || 'unknown'}-${stableKey}`;

          return (
            <div
              key={uniqueKey}
              onClick={(e) => {
                // Prevent any parent handlers from interfering
                e.stopPropagation();
                e.preventDefault();
                
                // CRITICAL: Block ALL clicks if we're processing ANY selection
                // Check both ref and state to ensure no clicks get through
                if (isProcessingSelectionRef.current || isProcessingClick) {
                  return;
                }
                
                // Prevent rapid clicks on the same card from causing multiple state updates
                const voiceIdentifier = voice.voiceId || voice.id || voice.generatedVoiceId;
                if (!voiceIdentifier) {
                  return;
                }
                
                // Set flags IMMEDIATELY and synchronously to block all subsequent clicks
                isProcessingSelectionRef.current = true;
                setIsProcessingClick(true); // This will disable pointer events on all cards
                clickProcessingRef.current.add(voiceIdentifier);
                
                // Process the selection immediately (no delay - delay was causing issues)
                startTransition(() => {
                  if (isSelected) {
                    // Deselect if already selected
                    onSelectionChange('');
                    // Clear flags after DOM settles
                    setTimeout(() => {
                      clickProcessingRef.current.delete(voiceIdentifier);
                      isProcessingSelectionRef.current = false;
                      setIsProcessingClick(false);
                    }, 600);
                  } else {
                    // Select immediately - works for both darkened and normal cards
                    if (voice.source === 'generated' && voice.generatedVoiceId) {
                      // Select with the generated ID first for immediate feedback
                      if (voice.id) {
                        onSelectionChange(voice.id);
                      }
                      // Convert in background without blocking
                      fetch('/api/createVoiceFromPreview', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          generatedVoiceId: voice.generatedVoiceId,
                          voiceName: voice.name,
                          voiceDescription: voice.description,
                        }),
                      })
                        .then(res => res.json())
                        .then(data => {
                          if (data.voiceId) {
                            // Use startTransition for the final update too
                            startTransition(() => {
                              onSelectionChange(data.voiceId);
                            });
                          }
                          // Clear flags after DOM settles
                          setTimeout(() => {
                            clickProcessingRef.current.delete(voiceIdentifier);
                            isProcessingSelectionRef.current = false;
                            setIsProcessingClick(false);
                          }, 600);
                        })
                        .catch(err => {
                          console.error('Failed to convert voice:', err);
                          clickProcessingRef.current.delete(voiceIdentifier);
                          isProcessingSelectionRef.current = false;
                          setIsProcessingClick(false);
                        });
                    } else {
                      // Regular voice - select immediately using voiceId or id
                      onSelectionChange(voiceIdentifier);
                      // Clear flags after DOM settles
                      setTimeout(() => {
                        clickProcessingRef.current.delete(voiceIdentifier);
                        isProcessingSelectionRef.current = false;
                        setIsProcessingClick(false);
                      }, 600);
                    }
                  }
                });
              }}
              className="voice-card transition-all duration-300 ease-out rounded-2xl relative flex flex-col group"
              style={{
                // Processing state - physically disable clicks and show visual feedback
                cursor: isProcessingClick ? 'not-allowed' : 'pointer',
                pointerEvents: isProcessingClick ? 'none' : 'auto', // Physically disable clicks during processing
                // Card styling
                backgroundColor: isSelected
                  ? `${colors.accent}20`
                  : isDarkened
                  ? 'rgba(0, 0, 0, 0.6)'
                  : 'rgba(8, 8, 10, 0.92)',
                backgroundImage: isSelected
                  ? `linear-gradient(135deg, ${colors.accent}40 0%, ${colors.accent}15 35%, rgba(0, 0, 0, 0.9) 100%)`
                  : isDarkened
                  ? `linear-gradient(135deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.9) 100%)`
                  : `linear-gradient(135deg, ${colors.accent}18 0%, rgba(12, 10, 24, 0.95) 45%, rgba(0, 0, 0, 0.98) 100%)`,
                border: `2px solid ${
                  isSelected
                    ? colors.accent
                    : isDarkened
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(255, 255, 255, 0.1)'
                }`,
                borderRadius: '16px',
                boxShadow: isSelected
                  ? `0 8px 32px ${colors.accent}50, 0 0 30px ${colors.accent}40, 0 0 50px ${colors.accent}30, inset 0 0 20px ${colors.accent}10`
                  : isDarkened
                  ? '0 10px 30px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(0, 0, 0, 0.5)'
                  : '0 10px 30px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(15, 23, 42, 0.9)',
                height: '100%',
                minHeight: '190px',
                padding: '1.1rem 1.2rem',
                transform: isSelected ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
                backdropFilter: 'blur(26px)',
                WebkitBackdropFilter: 'blur(26px)',
                position: 'relative',
                overflow: 'visible',
                opacity: isProcessingClick ? 0.6 : (isDarkened ? 0.4 : 1), // Processing state overrides darkened state
                zIndex: isSelected ? 10002 : 10001, // Above backdrop (9998) but below dropdown menus (10000+)
                animation: 'fade-in-scale 0.4s ease-out',
                animationDelay: `${index * 0.05}s`,
                animationFillMode: 'both',
                transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  if (isDarkened) {
                    // Keep darkened cards dark on hover - minimal hover effect only
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
                    e.currentTarget.style.opacity = '0.5'; // Slight increase for feedback
                    // Keep all dark colors - don't restore bright colors
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
                    e.currentTarget.style.backgroundImage = `linear-gradient(135deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.9) 100%)`;
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(0, 0, 0, 0.5)';
                  } else {
                    // Normal hover effect for non-darkened cards
                    e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                    e.currentTarget.style.boxShadow = `0 4px 16px ${colors.accent}30`;
                    e.currentTarget.style.backgroundColor = 'rgba(8, 8, 10, 0.92)';
                    e.currentTarget.style.backgroundImage = `linear-gradient(135deg, ${colors.accent}18 0%, rgba(12, 10, 24, 0.95) 45%, rgba(0, 0, 0, 0.98) 100%)`;
                  }
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  if (isDarkened) {
                    // Revert to darkened state (not original bright colors)
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.opacity = '0.4';
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
                    e.currentTarget.style.backgroundImage = `linear-gradient(135deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.9) 100%)`;
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(0, 0, 0, 0.5)';
                  } else {
                    // Revert to normal state for non-darkened cards
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(15, 23, 42, 0.9)';
                    e.currentTarget.style.backgroundColor = 'rgba(8, 8, 10, 0.92)';
                    e.currentTarget.style.backgroundImage = `linear-gradient(135deg, ${colors.accent}18 0%, rgba(12, 10, 24, 0.95) 45%, rgba(0, 0, 0, 0.98) 100%)`;
                  }
                }
              }}
            >
              {/* Animated glow border for selected state - matching QuestionCard exactly */}
              {isSelected && (
                <>
                  {/* Outer glow ring - matches QuestionCard structure */}
                  <div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{
                      border: `2px solid ${colors.accent}`,
                      borderRadius: '16px',
                      animation: 'glow-pulse 2s ease-in-out infinite',
                      boxShadow: `
                        0 0 20px ${colors.accent}60,
                        0 0 40px ${colors.accent}40,
                        inset 0 0 20px ${colors.accent}20
                      `,
                    }}
                  />
                  {/* Inner glow effect - matches QuestionCard structure */}
                  <div
                    className="absolute inset-[2px] rounded-xl pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at center, ${colors.accent}10 0%, transparent 70%)`,
                      animation: 'glow-inner 2s ease-in-out infinite',
                    }}
                  />
                </>
              )}

              {/* Compact header: name, tags, short description */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  alignItems: 'flex-start',
                }}
              >
                <div
                  className="text-sm sm:text-base"
                  style={{
                    color: colors.text,
                    fontFamily: 'var(--font-inter), sans-serif',
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {voice.name}
                </div>

                {primaryTags.length > 0 && (
                  <div>
                    <span
                      className="text-[11px]"
                      style={{
                        color: colors.text,
                        opacity: 0.7,
                        fontFamily: 'var(--font-inter), sans-serif',
                      }}
                    >
                      {primaryTags.slice(0, 3).join(' · ')}
                    </span>
                  </div>
                )}

                {voice.description && (
                  <p
                    className="text-xs"
                    style={{
                      color: colors.text,
                      opacity: 0.7,
                      fontFamily: 'var(--font-inter), sans-serif',
                      lineHeight: '1.4',
                      maxHeight: '2.6em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {voice.description}
                  </p>
                )}
              </div>

              {/* Play button at bottom */}
              <div
                style={{
                  marginTop: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '0.25rem',
                  paddingTop: '0.75rem',
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreview(voice);
                  }}
                  className="flex items-center justify-center rounded-full transition-all duration-300"
                  style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    border: `1px solid ${colors.accent}`,
                    boxShadow:
                      isPreviewing && isPlaying
                        ? `0 0 18px ${colors.accent}90, 0 0 32px ${colors.accent}60`
                        : `0 0 12px ${colors.accent}70`,
                    transform: 'scale(1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.15)';
                    e.currentTarget.style.boxShadow = isPreviewing && isPlaying
                      ? `0 0 24px ${colors.accent}100, 0 0 40px ${colors.accent}70`
                      : `0 0 18px ${colors.accent}85, 0 0 28px ${colors.accent}60`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = isPreviewing && isPlaying
                      ? `0 0 18px ${colors.accent}90, 0 0 32px ${colors.accent}60`
                      : `0 0 12px ${colors.accent}70`;
                  }}
                >
                  {isLoading && previewingVoiceId === voice.id ? (
                    <Loader2
                      size={20}
                      className="animate-spin"
                      style={{ color: colors.accent }}
                    />
                  ) : isPreviewing && isPlaying ? (
                    <Volume2 size={22} style={{ color: colors.accent }} />
                  ) : (
                    <Play
                      size={20}
                      fill="#000"
                      stroke={colors.accent}
                      strokeWidth={2}
                      style={{ marginLeft: '1px' }}
                    />
                  )}
              </button>
              </div>
            </div>
          );
        })}
          </div>
        )}
      </div>

      {/* Helper text */}
      <p
        className="text-center text-sm"
        style={{
          color: colors.text,
          opacity: 0.6,
          fontFamily: 'var(--font-inter), sans-serif',
          marginTop: '1rem',
          flexShrink: 0,
        }}
      >
        Select a voice that best represents your assistant. You can preview each voice before selecting.
      </p>
      
      {/* Global CSS animations */}
      <style>{`
        @keyframes filter-pulse {
          0%, 100% {
            box-shadow: 0 2px 8px rgba(168, 85, 247, 0.3), 0 0 16px rgba(168, 85, 247, 0.2);
          }
          50% {
            box-shadow: 0 2px 8px rgba(168, 85, 247, 0.4), 0 0 20px rgba(168, 85, 247, 0.3);
          }
        }
        @keyframes fade-in-scale {
          0% {
            opacity: 0;
            transform: scale(0.95);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes fade-in-up {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .voice-card {
          transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .voice-card-selected {
          z-index: 10;
        }
      `}</style>
    </div>
  );
}

