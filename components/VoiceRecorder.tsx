'use client';

import { useState, useRef, useEffect } from 'react';
import { colors } from '@/lib/config';
import { Mic, Square, Send } from 'lucide-react';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, transcript?: string) => void;
  onCancel?: () => void;
  assistantName?: string;
}

export default function VoiceRecorder({ 
  onRecordingComplete, 
  onCancel,
  assistantName = 'Kendall'
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Set up audio context for waveform visualization
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      microphone.connect(analyser);
      analyserRef.current = analyser;
      
      // Start waveform animation
      let isAnimating = true;
      const updateWaveform = () => {
        if (!analyserRef.current || !isAnimating) return;
        
        const dataArray = new Uint8Array(analyser.fftSize);
        analyser.getByteFrequencyData(dataArray);
        
        // Extract 7 bars from frequency data
        const barCount = 7;
        const step = Math.floor(dataArray.length / barCount);
        const bars = Array.from({ length: barCount }, (_, i) => {
          const index = i * step;
          return dataArray[index] / 255; // Normalize to 0-1
        });
        
        setWaveformData(bars);
        if (isAnimating) {
          animationFrameRef.current = requestAnimationFrame(updateWaveform);
        }
      };
      
      // Store cleanup function
      const cleanup = () => {
        isAnimating = false;
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
      
      updateWaveform();
      
      // Store cleanup for later use
      (mediaRecorderRef.current as any).__cleanupWaveform = cleanup;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        setAudioBlob(blob);
        
        // Stop waveform animation
        if ((mediaRecorderRef.current as any).__cleanupWaveform) {
          (mediaRecorderRef.current as any).__cleanupWaveform();
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        setWaveformData([]);
        
        // Stop all tracks
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        analyserRef.current = null;
        audioContext.close();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop waveform animation
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setWaveformData([]);
    }
  };

  const handleSend = async () => {
    if (!audioBlob) return;

    setIsTranscribing(true);
    
    try {
      // Convert audio to base64 for transcription
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      // Send to transcription API
      const response = await fetch('/api/chat/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: base64,
          mimeType: 'audio/webm',
        }),
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      const transcript = data.transcript || '';

      // Send both audio and transcript
      onRecordingComplete(audioBlob, transcript);
      
      // Reset
      setAudioBlob(null);
      setRecordingTime(0);
    } catch (error) {
      console.error('Transcription error:', error);
      // Send audio even if transcription fails
      onRecordingComplete(audioBlob);
      setAudioBlob(null);
      setRecordingTime(0);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCancel = () => {
    if (isRecording) {
      stopRecording();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAudioBlob(null);
    setRecordingTime(0);
    setWaveformData([]);
    if (onCancel) {
      onCancel();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCancel();
        }
      }}
    >
      <div
        className="bg-black/90 backdrop-blur-xl rounded-2xl p-8 max-w-md w-full mx-4 transition-all duration-300"
        style={{
          border: `2px solid ${colors.accent}40`,
          boxShadow: `0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px ${colors.accent}20`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {!audioBlob ? (
          <>
            <div className="text-center mb-6">
              <h3
                className="text-xl font-semibold mb-2"
                style={{
                  color: colors.text,
                  fontFamily: 'var(--font-inter), sans-serif',
                }}
              >
                {isRecording ? 'Recording...' : 'Record Voice Message'}
              </h3>
              {isRecording && (
                <div
                  className="text-3xl font-mono"
                  style={{
                    color: colors.accent,
                  }}
                >
                  {formatTime(recordingTime)}
                </div>
              )}
            </div>

            {/* Waveform visualization */}
            {isRecording && waveformData.length > 0 && (
              <div className="flex items-end justify-center gap-1.5 mb-6 h-16">
                {waveformData.map((height, i) => (
                  <div
                    key={i}
                    className="w-2 rounded-full transition-all duration-75"
                    style={{
                      backgroundColor: colors.accent,
                      height: `${Math.max(8, height * 60)}px`,
                      minHeight: '8px',
                      boxShadow: `0 0 8px ${colors.accent}60`,
                    }}
                  />
                ))}
              </div>
            )}

            <div className="flex flex-col items-center mb-6">
              {/* Record button with pulsing glow */}
              <div className="relative">
                {isRecording && (
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      backgroundColor: colors.accent,
                      opacity: 0.3,
                      animation: 'record-pulse 2s ease-in-out infinite',
                      transform: 'scale(1.2)',
                    }}
                  />
                )}
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className="relative w-20 h-20 rounded-full flex items-center justify-center transition-all z-10"
                  style={{
                    backgroundColor: isRecording ? '#ef4444' : colors.accent,
                    color: '#ffffff',
                    boxShadow: isRecording
                      ? `0 0 30px ${colors.accent}50, 0 0 60px ${colors.accent}30`
                      : `0 4px 16px ${colors.accent}40`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {isRecording ? (
                    <Square size={32} fill="currentColor" />
                  ) : (
                    <Mic size={32} fill="currentColor" />
                  )}
                </button>
              </div>
              
              {/* Circular progress indicator */}
              {isRecording && (
                <div className="mt-4 relative w-16 h-16">
                  <svg className="transform -rotate-90 w-16 h-16">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.1)"
                      strokeWidth="4"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke={colors.accent}
                      strokeWidth="4"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (1 - (recordingTime % 60) / 60)}`}
                      style={{
                        transition: 'stroke-dashoffset 0.1s linear',
                      }}
                    />
                  </svg>
                  <div
                    className="absolute inset-0 flex items-center justify-center text-xs font-mono"
                    style={{
                      color: colors.accent,
                    }}
                  >
                    {recordingTime % 60}
                  </div>
                </div>
              )}
            </div>

            {isRecording && (
              <div
                className="text-center text-sm"
                style={{
                  color: colors.text,
                  opacity: 0.6,
                }}
              >
                Click the square to stop recording
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-center mb-6">
              <h3
                className="text-lg font-semibold mb-2"
                style={{
                  color: colors.text,
                  fontFamily: 'var(--font-inter), sans-serif',
                }}
              >
                Recording Complete
              </h3>
              <div
                className="text-sm"
                style={{
                  color: colors.text,
                  opacity: 0.6,
                }}
              >
                Duration: {formatTime(recordingTime)}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-3 rounded-lg transition-all"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: colors.text,
                  border: `1px solid ${colors.accent}30`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={isTranscribing}
                className="flex-1 px-4 py-3 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  backgroundColor: colors.accent,
                  color: '#ffffff',
                }}
                onMouseEnter={(e) => {
                  if (!isTranscribing) {
                    e.currentTarget.style.opacity = '0.9';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isTranscribing) {
                    e.currentTarget.style.opacity = '1';
                  }
                }}
              >
                {isTranscribing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Transcribing...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Send
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


