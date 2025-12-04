'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import SmartSuggestions from './SmartSuggestions';
import QuickActions from './QuickActions';
import CommandPalette from './CommandPalette';
import SearchBar from './SearchBar';
import TypingIndicator from './TypingIndicator';
import ActiveCallBanner from './ActiveCallBanner';
import { colors } from '@/lib/config';
import { Search } from 'lucide-react';

interface ChatMessageType {
  id: string;
  message: string;
  role: 'user' | 'assistant';
  timestamp: string;
  attachments?: Array<{ url: string; filename: string }>;
}

interface ChatInterfaceProps {
  recordId: string;
  threadId?: string;
}

export default function ChatInterface({ recordId, threadId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastMessageId, setLastMessageId] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [assistantName, setAssistantName] = useState<string>('Kendall'); // Default, will be updated from API
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());
  const [activeCall, setActiveCall] = useState<{
    callId: string;
    status: 'ringing' | 'in-progress' | 'ended' | 'cancelled' | 'failed';
    startTime: string;
    phoneNumber: string;
    contactName?: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callStatusPollingRef = useRef<NodeJS.Timeout | null>(null);
  const isTabVisibleRef = useRef(true);
  const isUserScrollingRef = useRef(false);
  const hasInitialMessagesRef = useRef(false);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Check if user is scrolling
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      isUserScrollingRef.current = true;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 2000);
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  // Tab visibility detection for polling backoff
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabVisibleRef.current = !document.hidden;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Check for active calls on mount (state restoration)
  useEffect(() => {
    const checkActiveCall = async () => {
      try {
        const params = new URLSearchParams({ recordId });
        if (threadId) {
          params.append('threadId', threadId);
        }
        const response = await fetch(`/api/call/active?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.activeCall) {
            setActiveCall({
              callId: data.activeCall.callId,
              status: data.activeCall.status,
              startTime: data.activeCall.startTime,
              phoneNumber: data.activeCall.phoneNumber,
              contactName: data.activeCall.contactName,
            });
          }
        }
      } catch (error) {
        console.warn('[ChatInterface] Failed to check for active calls:', error);
      }
    };

    checkActiveCall();
  }, [recordId, threadId]);

  // Polling for call status (during ringing or queued)
  useEffect(() => {
    if (!activeCall || (activeCall.status !== 'ringing' && activeCall.status !== 'queued')) {
      // Stop polling if no active call or call is not ringing/queued
      if (callStatusPollingRef.current) {
        clearInterval(callStatusPollingRef.current);
        callStatusPollingRef.current = null;
      }
      return;
    }

    // Poll every 1 second during ringing
    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/call/status?callId=${activeCall.callId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            const newStatus = data.status;
            
            // Update status if it changed
            if (newStatus !== activeCall.status) {
              setActiveCall(prev => prev ? { ...prev, status: newStatus } : null);
              
              // Stop polling if call is no longer ringing or queued
              if (newStatus !== 'ringing' && newStatus !== 'queued') {
                if (callStatusPollingRef.current) {
                  clearInterval(callStatusPollingRef.current);
                  callStatusPollingRef.current = null;
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('[ChatInterface] Error polling call status:', error);
        // Exponential backoff on errors
        if (callStatusPollingRef.current) {
          clearInterval(callStatusPollingRef.current);
          // Retry with longer interval
          callStatusPollingRef.current = setTimeout(() => {
            pollStatus();
          }, 2000);
        }
      }
    };

    // Start polling immediately, then every 1 second
    pollStatus();
    callStatusPollingRef.current = setInterval(pollStatus, 1000);

    return () => {
      if (callStatusPollingRef.current) {
        clearInterval(callStatusPollingRef.current);
        callStatusPollingRef.current = null;
      }
    };
  }, [activeCall?.callId, activeCall?.status]);

  // Handle cancel call
  const handleCancelCall = async () => {
    if (!activeCall) return;

    try {
      const response = await fetch('/api/call/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: activeCall.callId }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Update status immediately
          setActiveCall(prev => prev ? { ...prev, status: 'cancelled' } : null);
          console.log('[ChatInterface] Call cancelled successfully');
        } else {
          console.error('[ChatInterface] Cancel failed:', data.error || data.message);
          // Still update UI to show cancellation attempt
          setActiveCall(prev => prev ? { ...prev, status: 'cancelled' } : null);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[ChatInterface] Cancel request failed:', errorData);
        // Update UI anyway to provide feedback
        setActiveCall(prev => prev ? { ...prev, status: 'cancelled' } : null);
      }
    } catch (error) {
      console.error('[ChatInterface] Failed to cancel call:', error);
      // Update UI to show cancellation attempt even on error
      setActiveCall(prev => prev ? { ...prev, status: 'cancelled' } : null);
    }
  };

  // Fetch messages
  const fetchMessages = useCallback(async (sinceLastId?: string, append = false, mergeMode = false) => {
    try {
      const params = new URLSearchParams({ recordId });
      if (threadId) {
        params.append('threadId', threadId);
      }
      if (sinceLastId) {
        params.append('lastMessageId', sinceLastId);
      }
      params.append('limit', '50');

      const response = await fetch(`/api/chat/messages?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.details || `HTTP ${response.status}: ${response.statusText}`;
        console.error('[ChatInterface] Failed to fetch messages:', {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
        });
        
        // If table not configured, just return empty array instead of error
        if (errorMessage.includes('Chat Messages table not configured') || 
            errorMessage.includes('AIRTABLE_CHAT_MESSAGES_TABLE_ID')) {
          console.warn('[ChatInterface] Chat Messages table not configured - keeping existing messages');
          if (append) {
            setLoadingMore(false);
          } else {
            // Don't clear messages - keep what we have
            if (!hasInitialMessagesRef.current) {
              setMessages([]);
            }
            setLoading(false);
          }
          return;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.success) {
        if (append) {
          setMessages(prev => {
            const newMsgs = [...data.messages, ...prev];
            if (newMsgs.length > 0) hasInitialMessagesRef.current = true;
            return newMsgs;
          });
        } else {
          // Only replace messages if we got results
          if (data.messages && data.messages.length > 0) {
            if (mergeMode && hasInitialMessagesRef.current) {
              // Merge mode: combine existing messages with fetched messages, avoiding duplicates
              setMessages(prev => {
                if (prev.length === 0) {
                  // No existing messages, just use fetched ones
                  hasInitialMessagesRef.current = true;
                  return data.messages;
                }
                
                const existingIds = new Set(prev.map(m => m.id));
                const existingByContent = new Map(
                  prev.map(m => [`${m.role}:${m.message}:${m.timestamp.slice(0, 16)}`, m])
                );
                
                // Update existing temp messages with real IDs from fetched messages
                const updatedPrev = prev.map(p => {
                  // Find matching message by content (for temp messages)
                  if (p.id.startsWith('temp-') || p.id.startsWith('msg-') || p.id.startsWith('assistant-')) {
                    const match = data.messages.find((m: ChatMessageType) => {
                      const timeMatch = Math.abs(new Date(m.timestamp).getTime() - new Date(p.timestamp).getTime()) < 60000; // Within 1 minute
                      return m.message === p.message && m.role === p.role && timeMatch;
                    });
                    if (match && !existingIds.has(match.id)) {
                      return match; // Replace temp with real
                    }
                  }
                  return p;
                });
                
                // Add new messages that don't exist yet
                const newMsgs = data.messages.filter((m: ChatMessageType) => {
                  if (existingIds.has(m.id)) return false;
                  const contentKey = `${m.role}:${m.message}:${m.timestamp.slice(0, 16)}`;
                  return !existingByContent.has(contentKey);
                });
                
                // Combine and sort by timestamp
                const merged = [...updatedPrev, ...newMsgs].sort((a, b) => 
                  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );
                
                // Only update if messages actually changed to prevent infinite loops
                if (merged.length === prev.length && 
                    merged.every((m, i) => m.id === prev[i]?.id && m.message === prev[i]?.message)) {
                  return prev; // No change, return previous to prevent re-render
                }
                
                hasInitialMessagesRef.current = true;
                return merged;
              });
            } else {
              // Normal replace mode (initial load or explicit refresh)
              setMessages(data.messages);
              hasInitialMessagesRef.current = true;
              // Clear new message IDs on initial load - these are not new messages
              if (!sinceLastId) {
                setNewMessageIds(new Set());
              }
            }
            // Scroll to bottom only if not loading older messages
            if (!sinceLastId && data.messages.length > 0) {
              setTimeout(scrollToBottom, 100);
            }
          } else if (!hasInitialMessagesRef.current && !mergeMode) {
            // Only set empty if we truly have no messages (initial load) and not in merge mode
            setMessages([]);
          }
          // If messages exist and we got empty response, keep existing messages
          // In merge mode, always keep existing messages even if fetch returns empty
        }
        if (data.lastMessageId) {
          setLastMessageId(data.lastMessageId);
        }
        setHasMore(data.hasMore || false);
      } else {
        console.error('[ChatInterface] API returned success: false:', data.error);
        // Don't throw error - just log it and keep existing messages
        // Only throw if this is initial load and we have no messages
        if (!hasInitialMessagesRef.current && !append) {
          throw new Error(data.error || 'Failed to fetch messages');
        }
      }
    } catch (error) {
      console.error('[ChatInterface] Error fetching messages:', error);
      // Don't clear messages on error - keep what we have
      // Only set empty messages if this was initial load and we have nothing
      if (!hasInitialMessagesRef.current && !append && loading) {
        // Initial load failed - it's okay to show empty state
        setMessages([]);
      }
      // Don't show error if it's just missing table configuration
      if (error instanceof Error && 
          !error.message.includes('Chat Messages table not configured') &&
          !error.message.includes('AIRTABLE_CHAT_MESSAGES_TABLE_ID')) {
        // Only log to console, don't disrupt UX for network errors
      }
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [recordId, threadId, scrollToBottom]);

  // Handle threadId changes - clear messages and reset state when switching threads
  useEffect(() => {
    // Clear messages and reset state when threadId changes
    setMessages([]);
    setLastMessageId(undefined);
    setHasMore(false);
    setLoadingMore(false);
    hasInitialMessagesRef.current = false;
    setLoading(true);
    
    // Fetch messages for the new thread
    fetchMessages();
  }, [threadId, fetchMessages]);

  // Polling for new messages
  useEffect(() => {
    if (loading) return;

    const pollInterval = () => {
      // Backoff when tab is backgrounded or user is idle
      const interval = !isTabVisibleRef.current ? 15000 : 5000;
      
      pollingIntervalRef.current = setTimeout(() => {
        if (!isUserScrollingRef.current) {
          // Poll for new messages by fetching all and merging (preserves existing messages)
          fetchMessages(undefined, false, true).catch(err => {
            // Don't clear messages on polling error - just log it
            console.warn('[ChatInterface] Polling error (keeping existing messages):', err);
          });
        }
        pollInterval();
      }, interval);
    };

    pollInterval();

    return () => {
      if (pollingIntervalRef.current) {
        clearTimeout(pollingIntervalRef.current);
      }
    };
  }, [loading, lastMessageId, fetchMessages]);

  // Load older messages
  const loadOlderMessages = useCallback(() => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    
    setLoadingMore(true);
    const oldestMessageId = messages[0].id;
    fetchMessages(oldestMessageId, true);
  }, [messages, hasMore, loadingMore, fetchMessages]);

  // Handle send message
  const handleSend = async (message: string) => {
    if (!message.trim() || sending) return;

    // Combine pending action with user message if exists
    let finalMessage = message.trim();
    if (pendingAction) {
      if (pendingAction === 'make-call') {
        finalMessage = `Make a call to ${finalMessage}`;
      } else if (pendingAction === 'schedule-call') {
        finalMessage = `Schedule a call for ${finalMessage}`;
      } else if (pendingAction === 'quick-message') {
        finalMessage = `Send a message: ${finalMessage}`;
      }
      // Clear pending action after combining
      setPendingAction(null);
    }

    setSending(true);
    
    // Optimistically add user message (show original message to user)
    const tempUserMessage: ChatMessageType = {
      id: `temp-${Date.now()}`,
      message: message.trim(), // Show original message, not combined one
      role: 'user',
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);
    scrollToBottom();

    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, message: finalMessage, threadId }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();
      
      if (data.success) {
        // Update assistant name if provided
        if (data.kendallName) {
          setAssistantName(data.kendallName);
        }
        
          // Remove temp message and add real messages from API response
        setMessages(prev => {
          const filtered = prev.filter(m => !m.id.startsWith('temp-'));
          const assistantId = `assistant-${Date.now()}`;
          const newMessages = [
            ...filtered,
            {
              id: data.message?.id || `msg-${Date.now()}`,
              message: message.trim(), // Show original message to user
              role: 'user',
              timestamp: new Date().toISOString(),
            },
            {
              id: assistantId,
              message: data.response || '',
              role: 'assistant',
              timestamp: new Date().toISOString(),
            },
          ];
          
          // Add call status message if available
          let callStatusId: string | null = null;
          if (data.callStatus) {
            callStatusId = `call-status-${Date.now()}`;
            newMessages.push({
              id: callStatusId,
              message: data.callStatus.message,
              role: 'assistant',
              timestamp: new Date().toISOString(),
            });
          }
          
          // Mark assistant messages as new for typewriter effect
          setNewMessageIds(prev => {
            const updated = new Set(prev);
            updated.add(assistantId);
            if (callStatusId) {
              updated.add(callStatusId);
            }
            return updated;
          });
          
          // Mark that we have messages now
          if (newMessages.length > 0) {
            hasInitialMessagesRef.current = true;
            // Update lastMessageId for polling
            setLastMessageId(newMessages[newMessages.length - 1].id);
          }
          
          return newMessages;
        });

        // Set active call state if call was initiated (outside setMessages callback)
        if (data.callStatus && data.callStatus.success && data.callStatus.callId) {
          // Extract contact name from message if available
          const contactNameMatch = data.callStatus.message?.match(/called?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
          const contactName = contactNameMatch ? contactNameMatch[1] : undefined;
          
          // Get phone number from callStatus
          // phoneNumber might be formatted like "(814) 563-0232" or E.164 like "+18145630232"
          let phoneNumber = data.callStatus.phoneNumber || '';
          
          // If formatted, convert to E.164 for consistency
          if (phoneNumber && !phoneNumber.startsWith('+')) {
            const digits = phoneNumber.replace(/\D/g, '');
            if (digits.length === 10) {
              phoneNumber = `+1${digits}`;
            } else if (digits.length === 11 && digits.startsWith('1')) {
              phoneNumber = `+${digits}`;
            }
          }
          
          // If still no phone number, try to extract from message
          if (!phoneNumber) {
            const phoneMatch = data.callStatus.message?.match(/\((\d{3})\)\s*(\d{3})-(\d{4})/);
            if (phoneMatch) {
              phoneNumber = `+1${phoneMatch[1]}${phoneMatch[2]}${phoneMatch[3]}`;
            }
          }
          
          if (phoneNumber) {
            setActiveCall({
              callId: data.callStatus.callId,
              status: 'ringing', // Initial status
              startTime: new Date().toISOString(),
              phoneNumber: phoneNumber,
              contactName: contactName,
            });

            // Write to in-memory cache (optional, for state restoration) - fire and forget
            fetch('/api/call/active', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                callId: data.callStatus.callId,
                recordId: recordId,
                threadId: threadId,
                status: 'ringing',
                phoneNumber: phoneNumber,
                contactName: contactName,
              }),
            }).catch(error => {
              console.warn('[ChatInterface] Failed to cache active call:', error);
            });
          }
        }
        
        scrollToBottom();
        
        // Refresh messages after a delay to get proper IDs from Airtable
        // Use merge mode to preserve existing messages
        setTimeout(() => {
          fetchMessages(undefined, false, true).catch(err => {
            // If fetch fails, don't clear messages - keep what we have
            console.warn('[ChatInterface] Failed to refresh messages, keeping optimistic updates:', err);
          });
        }, 1500);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove temp message on error
      setMessages(prev => {
        const filtered = prev.filter(m => !m.id.startsWith('temp-'));
        // Add personalized error message
        filtered.push({
          id: `error-${Date.now()}`,
          message: `${assistantName} couldn't process that message. Please try again.`,
          role: 'assistant',
          timestamp: new Date().toISOString(),
        });
        return filtered;
      });
      scrollToBottom();
    } finally {
      setSending(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0 || uploading) return;

    // Clear pending action when file is uploaded
    if (pendingAction) {
      setPendingAction(null);
    }

    setUploading(true);

    try {
      for (const file of files) {
        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          alert(`File "${file.name}" is too large. Maximum size is 10MB.`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('recordId', recordId);
        if (threadId) {
          formData.append('threadId', threadId);
        }

        const response = await fetch('/api/chat/upload-document', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to upload file');
        }

        const data = await response.json();
        if (data.success && data.message) {
          // Add upload message to chat
          setMessages(prev => [...prev, {
            id: data.message?.id || `upload-${Date.now()}`,
            message: data.file?.filename ? `Uploaded file: ${data.file.filename}` : 'File uploaded',
            role: 'user',
            timestamp: new Date().toISOString(),
            attachments: [{ url: data.file.url, filename: data.file.filename }],
          }]);
          scrollToBottom();
        }
      }
    } catch (error) {
      console.error('File upload error:', error);
      // Add personalized error message to chat instead of alert
      setMessages(prev => [...prev, {
        id: `upload-error-${Date.now()}`,
        message: `${assistantName} couldn't upload the file. ${error instanceof Error ? error.message : 'Please try again.'}`,
        role: 'assistant',
        timestamp: new Date().toISOString(),
      }]);
      scrollToBottom();
    } finally {
      setUploading(false);
    }
  };

  // Auto-scroll on new messages
  useEffect(() => {
    if (!isUserScrollingRef.current && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // Keyboard shortcuts for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+F or Ctrl+F for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && !showSearch) {
        e.preventDefault();
        setShowSearch(true);
      }
      // Escape to close search
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      {showSearch && (
        <SearchBar
          recordId={recordId}
          onResultClick={(result) => {
            setShowSearch(false);
            // Could scroll to message if implemented
          }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Command Palette */}
      <CommandPalette
        recordId={recordId}
        assistantName={assistantName}
        onActionSelect={(action, data) => {
          if (action === 'make-call') {
            setPendingAction('make-call');
            setTimeout(() => {
              const textarea = document.querySelector('textarea[placeholder*="Message"]') as HTMLTextAreaElement;
              textarea?.focus();
            }, 100);
          } else if (action === 'schedule-call') {
            setPendingAction('schedule-call');
            setTimeout(() => {
              const textarea = document.querySelector('textarea[placeholder*="Message"]') as HTMLTextAreaElement;
              textarea?.focus();
            }, 100);
          } else if (action === 'check-schedule') {
            handleSend('What\'s on my schedule?');
          } else if (action === 'send-message') {
            setPendingAction('quick-message');
            setTimeout(() => {
              const textarea = document.querySelector('textarea[placeholder*="Message"]') as HTMLTextAreaElement;
              textarea?.focus();
            }, 100);
          } else if (action === 'upload-file') {
            // Clear pending action when uploading file
            if (pendingAction) {
              setPendingAction(null);
            }
            // Trigger file upload via the input in ChatInput
            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            fileInput?.click();
          } else if (action === 'call-contact' && data) {
            handleSend(`Call ${data.name}${data.phone ? ` at ${data.phone}` : ''}`);
          }
        }}
        conversations={messages.slice(-10).map(m => ({
          id: m.id,
          preview: m.message.substring(0, 50),
          timestamp: m.timestamp,
        }))}
      />

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        data-messages-container
        className="flex-1 overflow-y-auto pb-4 lg:pb-6 pt-8"
        style={{
          backgroundColor: colors.primary,
          paddingLeft: 'clamp(1rem, 4vw, 2rem)',
          paddingRight: 'clamp(1rem, 4vw, 2rem)',
        }}
      >
        {/* Active Call Banner */}
        {activeCall && (
          <ActiveCallBanner
            callId={activeCall.callId}
            status={activeCall.status}
            phoneNumber={activeCall.phoneNumber}
            contactName={activeCall.contactName}
            startTime={activeCall.startTime}
            onCancel={handleCancelCall}
            onDismiss={() => setActiveCall(null)}
          />
        )}
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div style={{ color: colors.text, opacity: 0.6 }}>Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <SmartSuggestions 
              recordId={recordId}
              assistantName={assistantName}
              onSuggestionClick={(suggestion) => {
                if (suggestion.action?.type === 'call' && suggestion.action.data) {
                  handleSend(`Call ${suggestion.action.data.name || suggestion.action.data.phone}`);
                } else {
                  handleSend(suggestion.message);
                }
              }}
            />
            <div
              className="text-center"
              style={{ color: colors.text, opacity: 0.6 }}
            >
              <p className="mb-2" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
                Start chatting with {assistantName}
              </p>
              <p className="text-sm" style={{ opacity: 0.8 }}>
                Ask questions, request calls, or share information
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Show suggestions at top when messages exist but user might be idle */}
            {messages.length > 0 && !sending && (
              <SmartSuggestions 
                recordId={recordId}
                assistantName={assistantName}
                onSuggestionClick={(suggestion) => {
                  if (suggestion.action?.type === 'call' && suggestion.action.data) {
                    handleSend(`Call ${suggestion.action.data.name || suggestion.action.data.phone}`);
                  } else {
                    handleSend(suggestion.message);
                  }
                }}
              />
            )}
            {sending && (
              <TypingIndicator assistantName={assistantName} showWaveform={false} />
            )}
            {hasMore && (
              <div className="flex justify-center mb-4">
                <button
                  onClick={loadOlderMessages}
                  disabled={loadingMore}
                  className="px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: `${colors.accent}15`,
                    border: `1px solid ${colors.accent}40`,
                    color: colors.text,
                  }}
                  onMouseEnter={(e) => {
                    if (!loadingMore) {
                      e.currentTarget.style.backgroundColor = `${colors.accent}25`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loadingMore) {
                      e.currentTarget.style.backgroundColor = `${colors.accent}15`;
                    }
                  }}
                >
                  {loadingMore ? 'Loading...' : 'Load older messages'}
                </button>
              </div>
            )}
            
            {messages.map((msg, index) => {
              const previousMessage = index > 0 ? messages[index - 1] : null;
              const isConsecutive = previousMessage?.role === msg.role;
              const isNewMessage = newMessageIds.has(msg.id);
              const isTyping = sending && index === messages.length - 1 && msg.role === 'assistant';
              
              return (
                <ChatMessage
                  key={msg.id}
                  message={msg.message}
                  role={msg.role}
                  timestamp={msg.timestamp}
                  attachments={msg.attachments}
                  isNewMessage={isNewMessage}
                  isConsecutive={isConsecutive}
                  isTyping={isTyping}
                />
              );
            })}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area - Floating */}
      <div 
        className="sticky bottom-0"
        style={{ 
          background: `linear-gradient(to top, ${colors.primary} 0%, ${colors.primary} 60%, transparent 100%)`,
          paddingTop: '24px',
        }}
      >
        {/* Quick Actions */}
        <div className="px-4 mb-3">
          <QuickActions
            recordId={recordId}
            assistantName={assistantName}
            onActionSelect={(action) => {
              if (action === 'make-call') {
                setPendingAction('make-call');
              } else if (action === 'schedule-call') {
                setPendingAction('schedule-call');
              } else if (action === 'check-schedule') {
                // Check schedule can be sent immediately
                handleSend('What\'s on my schedule?');
              } else if (action === 'quick-message') {
                setPendingAction('quick-message');
              }
              // Focus the input field after setting pending action
              setTimeout(() => {
                const textarea = document.querySelector('textarea[placeholder*="Message"]') as HTMLTextAreaElement;
                textarea?.focus();
              }, 100);
            }}
          />
        </div>
        
        <ChatInput
          onSend={handleSend}
          onFileUpload={handleFileUpload}
          isSending={sending}
          isUploading={uploading}
          assistantName={assistantName}
          pendingAction={pendingAction}
          onClearPendingAction={() => setPendingAction(null)}
          onVoiceMessage={async (audioBlob, transcript) => {
            if (transcript) {
              handleSend(transcript);
            } else {
              // Handle audio-only message (would upload and send)
              console.log('Voice message received:', audioBlob);
            }
          }}
        />
      </div>
    </div>
  );
}

