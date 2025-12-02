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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
        
        // Stop all tracks
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
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
    setAudioBlob(null);
    setRecordingTime(0);
    if (onCancel) {
      onCancel();
    }
  };

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
        className="bg-black rounded-2xl p-8 max-w-md w-full mx-4"
        style={{
          border: `2px solid ${colors.accent}`,
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

            <div className="flex justify-center mb-6">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className="w-20 h-20 rounded-full flex items-center justify-center transition-all"
                style={{
                  backgroundColor: isRecording ? '#ef4444' : colors.accent,
                  color: '#ffffff',
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

