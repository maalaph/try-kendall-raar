'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { colors } from '@/lib/config';
import { Plus, MessageSquare, X, GripVertical } from 'lucide-react';

interface ChatThread {
  threadId: string;
  title: string;
  lastMessageAt: string;
  messageCount: number;
  preview: string;
}

interface ChatListSidebarProps {
  recordId: string;
  currentThreadId?: string | null;
}

export default function ChatListSidebar({ recordId, currentThreadId }: ChatListSidebarProps) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingThread, setCreatingThread] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatSidebarWidth');
      return saved ? parseInt(saved, 10) : 280;
    }
    return 280;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [hoveredThreadId, setHoveredThreadId] = useState<string | null>(null);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const MIN_WIDTH = 200;
  const MAX_WIDTH = 500;
  const COLLAPSED_WIDTH = 60;

  // Save width to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && sidebarWidth !== COLLAPSED_WIDTH) {
      localStorage.setItem('chatSidebarWidth', sidebarWidth.toString());
    }
  }, [sidebarWidth]);

  // Resize handler
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!sidebarRef.current) return;
      const rect = sidebarRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const fetchThreads = useCallback(async (isInitialLoad = false, force = false) => {
    // Prevent multiple simultaneous fetches unless forced
    if (fetchingRef.current && !force) {
      console.log('[ChatListSidebar] Fetch already in progress, skipping...');
      return;
    }
    
    fetchingRef.current = true;
    try {
      const response = await fetch(`/api/chat/threads?recordId=${encodeURIComponent(recordId)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setThreads(data.threads || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch chat threads:', error);
    } finally {
      fetchingRef.current = false;
      // Only set loading to false on initial load, not on refreshes
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  }, [recordId]);

  // Track previous threadId to avoid unnecessary refreshes
  const prevThreadIdRef = useRef<string | null | undefined>(currentThreadId);
  
  useEffect(() => {
    // Initial load
    fetchThreads(true);
    
    // Refresh every 10 seconds to get new threads (without affecting loading state)
    const interval = setInterval(() => {
      fetchThreads(false, true); // Force refresh to ensure we get all threads
    }, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]); // Only depend on recordId, not fetchThreads
  
  // Refresh when currentThreadId actually changes (not on every render)
  useEffect(() => {
    // Only refresh if threadId actually changed (not just on every render)
    if (currentThreadId !== prevThreadIdRef.current && currentThreadId) {
      prevThreadIdRef.current = currentThreadId;
      // Refresh thread list when switching threads to ensure it's up to date
      fetchThreads(false, true);
    } else if (currentThreadId !== prevThreadIdRef.current) {
      // Update ref even if currentThreadId is null/undefined
      prevThreadIdRef.current = currentThreadId;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentThreadId]); // Only depend on currentThreadId

  const handleNewChat = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (creatingThread) {
      console.log('[ChatListSidebar] Already creating thread, ignoring click');
      return; // Prevent multiple simultaneous requests
    }
    
    if (!recordId) {
      console.error('[ChatListSidebar] No recordId available');
      alert('Unable to create new chat: User ID not found. Please refresh the page.');
      return;
    }
    
    console.log('[ChatListSidebar] Creating new chat for recordId:', recordId);
    
    setCreatingThread(true);
    
    // Show immediate feedback
    const button = e?.currentTarget as HTMLButtonElement;
    if (button) {
      button.style.opacity = '0.7';
      button.disabled = true;
    }
    
    try {
      const response = await fetch('/api/chat/threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recordId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.error || `Failed to create thread: ${response.status}`);
      }

      const data = await response.json();
      console.log('[ChatListSidebar] Create thread response:', data);

      if (data.success && data.threadId) {
        console.log('[ChatListSidebar] Thread created successfully:', data.threadId);
        
        // Refresh thread list BEFORE navigating to ensure the new thread appears
        // Wait a moment for the placeholder message to be saved to Airtable
        try {
          // Wait 500ms for Airtable to save the placeholder message
          await new Promise(resolve => setTimeout(resolve, 500));
          // Force refresh the thread list
          await fetchThreads(false, true);
          console.log('[ChatListSidebar] Thread list refreshed after creating new thread');
        } catch (fetchError) {
          console.error('[ChatListSidebar] Failed to refresh thread list:', fetchError);
          // Continue with navigation even if refresh fails
        }
        
        // Reset creating state before navigation
        setCreatingThread(false);
        
        // Navigate to new chat using window.location for guaranteed navigation
        const newUrl = `/chat?recordId=${encodeURIComponent(recordId)}&threadId=${encodeURIComponent(data.threadId)}`;
        console.log('[ChatListSidebar] Navigating to:', newUrl);
        
        // Use window.location.href for guaranteed navigation (bypasses any router issues)
        window.location.href = newUrl;
      } else {
        const errorMsg = data.error || 'Failed to create new chat. No threadId returned.';
        console.error('[ChatListSidebar] Failed to create thread:', {
          success: data.success,
          threadId: data.threadId,
          error: data.error,
          fullResponse: data
        });
        alert(errorMsg);
        setCreatingThread(false);
        if (button) {
          button.style.opacity = '1';
          button.disabled = false;
        }
      }
    } catch (error) {
      console.error('[ChatListSidebar] Failed to create new chat:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to create new chat: ${errorMessage}. Please try again.`);
      setCreatingThread(false);
      if (button) {
        button.style.opacity = '1';
        button.disabled = false;
      }
    }
  };

  const handleThreadClick = (threadId: string) => {
    router.push(`/chat?recordId=${encodeURIComponent(recordId)}&threadId=${encodeURIComponent(threadId)}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    setShowDeleteConfirm(threadId);
  };

  const handleDeleteConfirm = async (threadId: string) => {
    setDeletingThreadId(threadId);
    setShowDeleteConfirm(null);

    try {
      const response = await fetch(`/api/chat/threads/${encodeURIComponent(threadId)}?recordId=${encodeURIComponent(recordId)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove from local state
        setThreads(prev => prev.filter(t => t.threadId !== threadId));
        
        // If deleted thread was active, navigate to first thread or new chat
        if (currentThreadId === threadId) {
          const remainingThreads = threads.filter(t => t.threadId !== threadId);
          if (remainingThreads.length > 0) {
            router.push(`/chat?recordId=${encodeURIComponent(recordId)}&threadId=${encodeURIComponent(remainingThreads[0].threadId)}`);
          } else {
            router.push(`/chat?recordId=${encodeURIComponent(recordId)}`);
          }
        }
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete chat');
      }
    } catch (error) {
      console.error('Failed to delete thread:', error);
      alert('Failed to delete chat. Please try again.');
    } finally {
      setDeletingThreadId(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(null);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const currentWidth = isOpen ? sidebarWidth : COLLAPSED_WIDTH;

  return (
    <>
      <div 
        ref={sidebarRef}
        className="h-full flex flex-col flex-shrink-0 relative" 
        style={{ 
          backgroundColor: colors.secondary, 
          borderRight: `1px solid ${colors.accent}30`,
          width: `${currentWidth}px`,
          minWidth: `${currentWidth}px`,
          transition: isResizing ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isOpen ? `0 0 20px ${colors.accent}10` : 'none',
        }}
      >
        {/* Resize Handle - Only on the rightmost edge */}
        {isOpen && (
          <div
            onMouseDown={(e) => {
              // Only start resizing if clicking very close to the right edge
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              if (clickX >= rect.width - 4) { // Only if within 4px of right edge
                handleMouseDown(e);
              }
            }}
            className="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize transition-all group"
            style={{
              backgroundColor: 'transparent',
              pointerEvents: 'auto',
              zIndex: 2,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${colors.accent}20`;
            }}
            onMouseLeave={(e) => {
              if (!isResizing) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ color: colors.accent }}
            >
              <GripVertical size={16} />
            </div>
          </div>
        )}

        {/* Header */}
        <div 
          className="flex items-center justify-between p-4 border-b relative" 
          style={{ 
            borderColor: `${colors.accent}30`,
            background: `linear-gradient(135deg, ${colors.secondary} 0%, ${colors.secondary}dd 100%)`,
            zIndex: 10,
            position: 'relative',
          }}
        >
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 transition-all group"
            style={{ color: colors.text }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.8';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <MessageSquare size={18} style={{ filter: isOpen ? `drop-shadow(0 0 4px ${colors.accent}60)` : 'none' }} />
            {isOpen && (
              <span style={{ 
                fontFamily: 'var(--font-inter), sans-serif', 
                fontWeight: 600, 
                fontSize: '0.9375rem',
                letterSpacing: '-0.01em',
              }}>
                Chats
              </span>
            )}
          </button>
          {isOpen && (
            <button
              onClick={(e) => handleNewChat(e)}
              disabled={creatingThread}
              className="p-2 rounded-lg transition-all relative group"
              style={{
                color: colors.accent,
                backgroundColor: 'transparent',
                cursor: creatingThread ? 'wait' : 'pointer',
                pointerEvents: creatingThread ? 'none' : 'auto',
                zIndex: 20,
                opacity: creatingThread ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!creatingThread) {
                  e.currentTarget.style.backgroundColor = `${colors.accent}20`;
                  e.currentTarget.style.boxShadow = `0 0 12px ${colors.accent}40`;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.boxShadow = 'none';
              }}
              title={creatingThread ? 'Creating new chat...' : 'New Chat'}
            >
              <Plus size={18} />
            </button>
          )}
        </div>

        {/* Threads List */}
        {isOpen && (
          <div
            className="flex-1 overflow-y-auto"
            style={{
              width: '100%',
              position: 'relative',
              zIndex: 5,
              pointerEvents: 'auto',
            }}
          >
            {loading ? (
              <div className="text-center py-12" style={{ color: colors.text, opacity: 0.6 }}>
                <div className="animate-pulse">Loading...</div>
              </div>
            ) : threads.length === 0 ? (
              <div 
                className="text-center py-12 px-4" 
                style={{ 
                  color: colors.text, 
                  opacity: 0.6,
                  position: 'relative',
                  zIndex: 50,
                  pointerEvents: 'auto',
                }}
              >
                <p className="text-sm mb-4" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>No chats yet</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('[ChatListSidebar] Start New Chat button clicked');
                    handleNewChat(e);
                  }}
                  disabled={creatingThread}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  className="px-5 py-2.5 rounded-lg transition-all"
                  style={{
                    backgroundColor: `${colors.accent}20`,
                    border: `1px solid ${colors.accent}50`,
                    color: colors.accent,
                    fontFamily: 'var(--font-inter), sans-serif',
                    fontWeight: 500,
                    cursor: creatingThread ? 'wait' : 'pointer',
                    position: 'relative',
                    zIndex: 100,
                    pointerEvents: creatingThread ? 'none' : 'auto',
                    opacity: creatingThread ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!creatingThread) {
                      e.currentTarget.style.backgroundColor = `${colors.accent}30`;
                      e.currentTarget.style.boxShadow = `0 0 16px ${colors.accent}40`;
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = `${colors.accent}20`;
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {creatingThread ? 'Creating...' : 'Start New Chat'}
                </button>
              </div>
            ) : (
              <div className="py-2">
                {threads.map((thread) => {
                  const isActive = currentThreadId === thread.threadId;
                  const isHovered = hoveredThreadId === thread.threadId;
                  const isDeleting = deletingThreadId === thread.threadId;
                  const showDelete = showDeleteConfirm === thread.threadId;

                  return (
                    <div
                      key={thread.threadId}
                      className="relative group"
                      onMouseEnter={() => setHoveredThreadId(thread.threadId)}
                      onMouseLeave={() => setHoveredThreadId(null)}
                    >
                      {showDelete && (
                        <div
                          className="absolute inset-0 z-20 flex items-center justify-center gap-2 p-3 rounded-lg"
                          style={{
                            backgroundColor: `${colors.accent}20`,
                            border: `1px solid ${colors.accent}50`,
                            backdropFilter: 'blur(4px)',
                          }}
                        >
                          <span className="text-xs" style={{ color: colors.text, fontFamily: 'var(--font-inter), sans-serif' }}>
                            Delete?
                          </span>
                          <button
                            onClick={() => handleDeleteConfirm(thread.threadId)}
                            className="px-2 py-1 rounded text-xs transition-all"
                            style={{
                              backgroundColor: colors.accent,
                              color: colors.text,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.opacity = '0.9';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.opacity = '1';
                            }}
                          >
                            Yes
                          </button>
                          <button
                            onClick={handleDeleteCancel}
                            className="px-2 py-1 rounded text-xs transition-all"
                            style={{
                              backgroundColor: 'transparent',
                              color: colors.text,
                              border: `1px solid ${colors.accent}50`,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = `${colors.accent}20`;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            No
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => !showDelete && handleThreadClick(thread.threadId)}
                        disabled={isDeleting || showDelete}
                        className="w-full text-left p-3.5 transition-all border-l-2 relative"
                        style={{
                          backgroundColor: isActive 
                            ? `${colors.accent}20` 
                            : isHovered 
                            ? `${colors.accent}10` 
                            : 'transparent',
                          borderLeftColor: isActive ? colors.accent : 'transparent',
                          borderLeftWidth: isActive ? '3px' : '0px',
                          color: colors.text,
                          opacity: isDeleting ? 0.5 : 1,
                          cursor: showDelete ? 'default' : 'pointer',
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span
                            className="text-sm font-medium truncate flex-1"
                            style={{ 
                              color: isActive ? colors.accent : colors.text,
                              fontFamily: 'var(--font-inter), sans-serif',
                              fontWeight: isActive ? 600 : 500,
                              textShadow: isActive ? `0 0 8px ${colors.accent}40` : 'none',
                            }}
                          >
                            {thread.title}
                          </span>
                          {isHovered && !showDelete && (
                            <button
                              onClick={(e) => handleDeleteClick(e, thread.threadId)}
                              className="p-1 rounded transition-all flex-shrink-0 opacity-0 group-hover:opacity-100"
                              style={{
                                color: colors.text,
                                backgroundColor: 'transparent',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = `${colors.accent}30`;
                                e.currentTarget.style.color = '#ef4444';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = colors.text;
                              }}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                        {thread.preview && (
                          <p
                            className="text-xs line-clamp-2 mt-1.5"
                            style={{
                              color: colors.text,
                              opacity: isActive ? 0.8 : 0.6,
                              fontFamily: 'var(--font-inter), sans-serif',
                              lineHeight: '1.4',
                            }}
                          >
                            {thread.preview}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span
                            className="text-xs"
                            style={{ 
                              color: colors.text, 
                              opacity: 0.4,
                              fontFamily: 'var(--font-inter), sans-serif',
                            }}
                          >
                            {formatTimestamp(thread.lastMessageAt)}
                          </span>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
