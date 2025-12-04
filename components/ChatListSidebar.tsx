'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { colors } from '@/lib/config';
import { Plus, MessageSquare, X, GripVertical, Search, Pencil, Check } from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [updatingTitle, setUpdatingTitle] = useState<string | null>(null);
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
    if (!threadId || !recordId) {
      console.error('[ChatListSidebar] Cannot navigate: missing threadId or recordId', { threadId, recordId });
      return;
    }

    const url = `/chat?recordId=${encodeURIComponent(recordId)}&threadId=${encodeURIComponent(threadId)}`;
    console.log('[ChatListSidebar] Navigating to thread:', url);

    try {
      // Use router.push for navigation (faster, no page reload)
      router.push(url);
    } catch (error) {
      console.error('[ChatListSidebar] Error navigating with router.push, using window.location fallback:', error);
      // Fallback to window.location if router.push fails
      window.location.href = url;
    }
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

  const handleEditTitle = (e: React.MouseEvent, threadId: string, currentTitle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingThreadId(threadId);
    setEditingTitle(currentTitle);
  };

  const handleCancelEdit = () => {
    setEditingThreadId(null);
    setEditingTitle('');
  };

  const handleSaveTitle = async (threadId: string) => {
    if (!editingTitle.trim() || updatingTitle === threadId) return;
    
    setUpdatingTitle(threadId);
    
    try {
      const response = await fetch(`/api/chat/threads/${encodeURIComponent(threadId)}?recordId=${encodeURIComponent(recordId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: editingTitle.trim() }),
      });

      if (response.ok) {
        // Update local state
        setThreads(prev => prev.map(t => 
          t.threadId === threadId 
            ? { ...t, title: editingTitle.trim() }
            : t
        ));
        setEditingThreadId(null);
        setEditingTitle('');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update chat name');
      }
    } catch (error) {
      console.error('Failed to update thread title:', error);
      alert('Failed to update chat name. Please try again.');
    } finally {
      setUpdatingTitle(null);
    }
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

  // Filter threads based on search query
  const filteredThreads = threads.filter((thread) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      thread.title.toLowerCase().includes(query) ||
      thread.preview.toLowerCase().includes(query)
    );
  });

  const currentWidth = isOpen ? sidebarWidth : COLLAPSED_WIDTH;

  return (
    <>
      <div 
        ref={sidebarRef}
        className="h-full flex flex-col flex-shrink-0 relative" 
        style={{ 
          background: `linear-gradient(180deg, ${colors.secondary} 0%, ${colors.secondary}dd 50%, ${colors.secondary} 100%)`,
          borderRight: `1px solid ${colors.accent}40`,
          width: `${currentWidth}px`,
          minWidth: `${currentWidth}px`,
          height: '100%', // Explicitly set height to fill container
          maxHeight: '100%', // Prevent overflow
          transition: isResizing ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isOpen 
            ? `0 0 30px ${colors.accent}15, inset 0 0 60px ${colors.accent}05` 
            : 'none',
          overflow: 'hidden', // Prevent sidebar from overflowing
          position: 'relative',
        }}
      >
        {/* Subtle gradient overlay for depth - REMOVED TEMPORARILY TO TEST CLICKS */}
        {/* <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(135deg, ${colors.accent}08 0%, transparent 50%, ${colors.accent}05 100%)`,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        /> */}
        {/* Resize Handle - Only on the rightmost edge */}
        {isOpen && (
          <div
            onMouseDown={(e) => {
              // Only start resizing if clicking very close to the right edge
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              // Only activate if within 4px of right edge
              if (clickX >= rect.width - 4) {
                handleMouseDown(e);
              }
            }}
            className="absolute right-0 top-0 bottom-0 transition-all group"
            style={{
              backgroundColor: 'transparent',
              // Only allow pointer events on the rightmost 4px to avoid blocking thread clicks
              width: '4px',
              pointerEvents: 'auto',
              zIndex: 0, // Below threads list - threads have zIndex 50-101 so they're above
            }}
            onMouseEnter={(e) => {
              if (!isResizing) {
                e.currentTarget.style.backgroundColor = `${colors.accent}20`;
              }
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
          className="flex items-center justify-between p-4 border-b flex-shrink-0 relative" 
          style={{ 
            borderColor: `${colors.accent}40`,
            background: `linear-gradient(135deg, ${colors.secondary}ee 0%, ${colors.secondary}cc 50%, ${colors.secondary}dd 100%)`,
            zIndex: 10,
            position: 'relative',
            minHeight: '64px', // Ensure header has minimum height
            boxShadow: `0 2px 20px ${colors.accent}10, inset 0 1px 0 ${colors.accent}15`,
          }}
        >
          {/* Header glow effect */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '1px',
              background: `linear-gradient(90deg, transparent 0%, ${colors.accent}60 50%, transparent 100%)`,
              opacity: 0.6,
            }}
          />
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 transition-all group relative z-10"
            style={{ 
              color: colors.text,
              padding: '4px 8px',
              borderRadius: '8px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.backgroundColor = `${colors.accent}15`;
              e.currentTarget.style.boxShadow = `0 0 12px ${colors.accent}30`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <MessageSquare 
              size={18} 
              style={{ 
                filter: isOpen ? `drop-shadow(0 0 6px ${colors.accent}80)` : 'none',
                transition: 'filter 0.2s ease',
              }} 
            />
            {isOpen && (
              <span style={{ 
                fontFamily: 'var(--font-inter), sans-serif', 
                fontWeight: 600, 
                fontSize: '0.9375rem',
                letterSpacing: '-0.01em',
                textShadow: `0 0 8px ${colors.accent}40`,
                transition: 'text-shadow 0.2s ease',
              }}>
                Chats
              </span>
            )}
          </button>
          {isOpen && (
            <button
              onClick={(e) => handleNewChat(e)}
              disabled={creatingThread}
              className="p-2 rounded-lg transition-all relative group z-10"
              style={{
                color: colors.accent,
                backgroundColor: 'transparent',
                cursor: creatingThread ? 'wait' : 'pointer',
                pointerEvents: creatingThread ? 'none' : 'auto',
                zIndex: 20,
                opacity: creatingThread ? 0.5 : 1,
                border: `1px solid ${colors.accent}30`,
              }}
              onMouseEnter={(e) => {
                if (!creatingThread) {
                  e.currentTarget.style.backgroundColor = `${colors.accent}25`;
                  e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}50, 0 0 40px ${colors.accent}30`;
                  e.currentTarget.style.borderColor = colors.accent;
                  e.currentTarget.style.transform = 'scale(1.1)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = `${colors.accent}30`;
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title={creatingThread ? 'Creating new chat...' : 'New Chat'}
            >
              <Plus 
                size={18} 
                style={{ 
                  filter: `drop-shadow(0 0 4px ${colors.accent}60)`,
                  transition: 'filter 0.2s ease',
                }} 
              />
            </button>
          )}
        </div>

        {/* Search Input */}
        {isOpen && (
          <div 
            className="px-4 py-3 border-b flex-shrink-0 relative"
            style={{
              borderColor: `${colors.accent}30`,
              backgroundColor: `${colors.secondary}dd`,
              zIndex: 10,
            }}
          >
            <div className="relative">
              <Search 
                size={16} 
                style={{ 
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: colors.text,
                  opacity: 0.5,
                  pointerEvents: 'none',
                  zIndex: 1,
                }} 
              />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 rounded-lg transition-all"
                style={{
                  backgroundColor: `${colors.primary}80`,
                  border: `1px solid ${colors.accent}30`,
                  color: colors.text,
                  fontFamily: 'var(--font-inter), sans-serif',
                  fontSize: '0.875rem',
                  outline: 'none',
                  paddingLeft: '36px', // More space for icon
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = colors.accent;
                  e.currentTarget.style.boxShadow = `0 0 12px ${colors.accent}30`;
                  e.currentTarget.style.backgroundColor = `${colors.primary}90`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = `${colors.accent}30`;
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.backgroundColor = `${colors.primary}80`;
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-all"
                  style={{
                    color: colors.text,
                    opacity: 0.6,
                    zIndex: 2,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.backgroundColor = `${colors.accent}20`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0.6';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Threads List */}
        {isOpen && (
          <div
            className="flex-1 overflow-y-auto"
            style={{
              width: '100%',
              position: 'relative',
              zIndex: 50,
              pointerEvents: 'auto',
              minHeight: 0,
              paddingTop: '4px',
              paddingBottom: '8px',
            }}
          >
            {loading ? (
              <div className="text-center py-12" style={{ color: colors.text, opacity: 0.6 }}>
                <div 
                  className="animate-pulse"
                  style={{
                    fontFamily: 'var(--font-inter), sans-serif',
                    textShadow: `0 0 8px ${colors.accent}30`,
                  }}
                >
                  Loading...
                </div>
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
                <p 
                  className="text-sm mb-4" 
                  style={{ 
                    fontFamily: 'var(--font-inter), sans-serif',
                    opacity: 0.7,
                  }}
                >
                  No chats yet
                </p>
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
                    background: `linear-gradient(135deg, ${colors.accent}25 0%, ${colors.accent}15 100%)`,
                    border: `1px solid ${colors.accent}50`,
                    color: colors.accent,
                    fontFamily: 'var(--font-inter), sans-serif',
                    fontWeight: 500,
                    cursor: creatingThread ? 'wait' : 'pointer',
                    position: 'relative',
                    zIndex: 100,
                    pointerEvents: creatingThread ? 'none' : 'auto',
                    opacity: creatingThread ? 0.6 : 1,
                    boxShadow: `0 0 20px ${colors.accent}20`,
                  }}
                  onMouseEnter={(e) => {
                    if (!creatingThread) {
                      e.currentTarget.style.background = `linear-gradient(135deg, ${colors.accent}35 0%, ${colors.accent}25 100%)`;
                      e.currentTarget.style.boxShadow = `0 0 30px ${colors.accent}40, 0 0 60px ${colors.accent}20`;
                      e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                      e.currentTarget.style.borderColor = colors.accent;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = `linear-gradient(135deg, ${colors.accent}25 0%, ${colors.accent}15 100%)`;
                    e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}20`;
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.borderColor = `${colors.accent}50`;
                  }}
                >
                  {creatingThread ? 'Creating...' : 'Start New Chat'}
                </button>
              </div>
            ) : filteredThreads.length === 0 && searchQuery ? (
              <div className="text-center py-12 px-4" style={{ color: colors.text, opacity: 0.6 }}>
                <p className="text-sm" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
                  No chats found matching "{searchQuery}"
                </p>
              </div>
            ) : (
              <div 
                className="py-1"
                style={{
                  pointerEvents: 'auto',
                }}
              >
                {filteredThreads.map((thread) => {
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
                      style={{
                        position: 'relative',
                        zIndex: 100,
                      }}
                    >
                      <Link
                        href={`/chat?recordId=${encodeURIComponent(recordId)}&threadId=${encodeURIComponent(thread.threadId)}`}
                        className="w-full text-left p-3.5 transition-all border-l-2 relative block"
                        style={{
                          background: isActive 
                            ? `linear-gradient(90deg, ${colors.accent}25 0%, ${colors.accent}15 100%)`
                            : isHovered 
                            ? `linear-gradient(90deg, ${colors.accent}15 0%, ${colors.accent}08 100%)`
                            : 'transparent',
                          borderLeftColor: isActive ? colors.accent : 'transparent',
                          borderLeftWidth: isActive ? '3px' : '0px',
                          color: colors.text,
                          opacity: isDeleting ? 0.5 : 1,
                          cursor: showDelete || isDeleting ? 'default' : 'pointer',
                          pointerEvents: showDelete || isDeleting ? 'none' : 'auto',
                          zIndex: 101,
                          position: 'relative',
                          borderRadius: '0 8px 8px 0',
                          margin: '2px 8px',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: isActive 
                            ? `0 0 20px ${colors.accent}20, inset 0 0 20px ${colors.accent}10`
                            : isHovered
                            ? `0 0 15px ${colors.accent}15`
                            : 'none',
                          transform: isHovered && !isActive ? 'translateX(2px)' : 'translateX(0)',
                          textDecoration: 'none',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive && !showDelete && !isDeleting) {
                            e.currentTarget.style.boxShadow = `0 0 20px ${colors.accent}20, inset 0 0 20px ${colors.accent}08`;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.boxShadow = 'none';
                          }
                        }}
                        onClick={(e) => {
                          if (showDelete || isDeleting) {
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                          }
                          // Fallback navigation if Link doesn't work
                          const link = e.currentTarget;
                          setTimeout(() => {
                            if (window.location.pathname === '/chat' && !window.location.search.includes(`threadId=${encodeURIComponent(thread.threadId)}`)) {
                              handleThreadClick(thread.threadId);
                            }
                          }, 100);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5 relative">
                          {editingThreadId === thread.threadId ? (
                            <div className="flex items-center gap-1 flex-1">
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveTitle(thread.threadId);
                                  } else if (e.key === 'Escape') {
                                    handleCancelEdit();
                                  }
                                }}
                                autoFocus
                                className="text-sm font-medium flex-1 px-2 py-1 rounded"
                                style={{
                                  backgroundColor: `${colors.primary}90`,
                                  border: `1px solid ${colors.accent}50`,
                                  color: colors.text,
                                  fontFamily: 'var(--font-inter), sans-serif',
                                  outline: 'none',
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onFocus={(e) => {
                                  e.currentTarget.style.borderColor = colors.accent;
                                  e.currentTarget.style.boxShadow = `0 0 8px ${colors.accent}30`;
                                }}
                                onBlur={(e) => {
                                  e.currentTarget.style.borderColor = `${colors.accent}50`;
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleSaveTitle(thread.threadId);
                                }}
                                disabled={updatingTitle === thread.threadId}
                                className="p-1 rounded transition-all flex-shrink-0"
                                style={{
                                  color: colors.accent,
                                  backgroundColor: 'transparent',
                                  pointerEvents: 'auto',
                                  opacity: updatingTitle === thread.threadId ? 0.5 : 1,
                                }}
                                onMouseEnter={(e) => {
                                  if (updatingTitle !== thread.threadId) {
                                    e.currentTarget.style.backgroundColor = `${colors.accent}20`;
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleCancelEdit();
                                }}
                                className="p-1 rounded transition-all flex-shrink-0"
                                style={{
                                  color: colors.text,
                                  backgroundColor: 'transparent',
                                  pointerEvents: 'auto',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = `${colors.accent}20`;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span
                                className="text-sm font-medium truncate flex-1"
                                style={{ 
                                  color: isActive ? colors.accent : colors.text,
                                  fontFamily: 'var(--font-inter), sans-serif',
                                  fontWeight: isActive ? 600 : 500,
                                  textShadow: isActive 
                                    ? `0 0 10px ${colors.accent}50, 0 0 20px ${colors.accent}30`
                                    : isHovered
                                    ? `0 0 6px ${colors.accent}30`
                                    : 'none',
                                  transition: 'all 0.2s ease',
                                  cursor: 'text',
                                  userSelect: 'text',
                                }}
                                onDoubleClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleEditTitle(e, thread.threadId, thread.title);
                                }}
                                title="Double-click to rename"
                              >
                                {thread.title}
                              </span>
                              {isHovered && !showDelete && (
                                <div className="flex items-center gap-1 flex-shrink-0" style={{ position: 'absolute', right: 0, top: 0 }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleEditTitle(e, thread.threadId, thread.title);
                                    }}
                                    className="p-1 rounded transition-all opacity-0 group-hover:opacity-100"
                                    style={{
                                      color: colors.text,
                                      backgroundColor: 'transparent',
                                      pointerEvents: 'auto',
                                      zIndex: 200,
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = `${colors.accent}30`;
                                      e.currentTarget.style.color = colors.accent;
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'transparent';
                                      e.currentTarget.style.color = colors.text;
                                    }}
                                    title="Rename chat"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDeleteClick(e, thread.threadId);
                                    }}
                                    className="p-1 rounded transition-all opacity-0 group-hover:opacity-100"
                                    style={{
                                      color: colors.text,
                                      backgroundColor: 'transparent',
                                      pointerEvents: 'auto',
                                      zIndex: 200,
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = `${colors.accent}30`;
                                      e.currentTarget.style.color = '#ef4444';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'transparent';
                                      e.currentTarget.style.color = colors.text;
                                    }}
                                    title="Delete chat"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        {thread.preview && (
                          <p
                            className="text-xs line-clamp-2 mt-1.5"
                            style={{
                              color: colors.text,
                              opacity: isActive ? 0.85 : isHovered ? 0.7 : 0.6,
                              fontFamily: 'var(--font-inter), sans-serif',
                              lineHeight: '1.5',
                              transition: 'opacity 0.2s ease',
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
                              opacity: isActive ? 0.5 : 0.4,
                              fontFamily: 'var(--font-inter), sans-serif',
                              transition: 'opacity 0.2s ease',
                            }}
                          >
                            {formatTimestamp(thread.lastMessageAt)}
                          </span>
                        </div>
                      </Link>
                      {showDelete && (
                        <div
                          className="absolute inset-0 z-200 flex items-center justify-center gap-2 p-3 rounded-lg"
                          style={{
                            backgroundColor: `${colors.accent}20`,
                            border: `1px solid ${colors.accent}50`,
                            backdropFilter: 'blur(4px)',
                            zIndex: 200,
                            pointerEvents: 'auto',
                          }}
                        >
                          <span className="text-xs" style={{ color: colors.text, fontFamily: 'var(--font-inter), sans-serif' }}>
                            Delete?
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteConfirm(thread.threadId);
                            }}
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
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteCancel();
                            }}
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
