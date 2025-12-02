'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { colors } from '@/lib/config';
import { GripVertical, ChevronLeft, ChevronRight } from 'lucide-react';

interface ChatNavbarProps {
  recordId: string;
  kendallName?: string;
}

export default function ChatNavbar({ recordId, kendallName = 'Kendall' }: ChatNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isChatPage = pathname === '/chat';
  const isDashboardPage = pathname === '/dashboard';
  const isIntegrationsPage = pathname === '/integrations';
  const [navbarWidth, setNavbarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatNavbarWidth');
      return saved ? parseInt(saved, 10) : 1200;
    }
    return 1200;
  });
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatNavbarCollapsed');
      return saved === 'true';
    }
    return false;
  });
  const [isResizing, setIsResizing] = useState(false);
  const navbarRef = useRef<HTMLDivElement>(null);

  const MIN_WIDTH = 400; // Minimum width to show "raar." and nav items
  const COLLAPSED_WIDTH = 80; // Width when collapsed (just enough for logo and toggle)

  // Save width and collapsed state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatNavbarWidth', navbarWidth.toString());
      localStorage.setItem('chatNavbarCollapsed', isCollapsed.toString());
    }
  }, [navbarWidth, isCollapsed]);

  // Resize handler - only activate when clicking very close to right edge
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!navbarRef.current) return;
    
    const rect = navbarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const navbarWidth = rect.width;
    const EDGE_THRESHOLD = 8; // Only activate resize within last 8px
    
    // Only activate resize if clicking within the rightmost 8px
    if (clickX >= navbarWidth - EDGE_THRESHOLD) {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
    }
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!navbarRef.current) return;
      const rect = navbarRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      if (newWidth >= MIN_WIDTH) {
        setNavbarWidth(newWidth);
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

  const currentWidth = isCollapsed ? COLLAPSED_WIDTH : navbarWidth;

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center"
      style={{
        padding: '1.5rem 2rem',
        backgroundColor: colors.primary,
        borderBottom: `1px solid ${colors.accent}30`,
      }}
    >
      <div 
        ref={navbarRef}
        className="flex items-center justify-between relative"
        style={{
          width: `${currentWidth}px`,
          minWidth: isCollapsed ? `${COLLAPSED_WIDTH}px` : `${MIN_WIDTH}px`,
          transition: isResizing ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onMouseDown={!isCollapsed ? handleMouseDown : undefined}
      >
        {/* Logo */}
        <Link
          href="/"
          className="inline-block transition-all duration-300 flex-shrink-0"
          style={{
            fontFamily: 'var(--font-league-spartan), sans-serif',
            fontSize: isCollapsed ? 'clamp(20px, 3vw, 32px)' : 'clamp(24px, 5vw, 48px)',
            color: colors.text,
            textDecoration: 'none',
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textShadow = `0 0 20px ${colors.accent}33`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textShadow = 'none';
          }}
        >
          raar.
        </Link>

        {/* Navigation Links - Centered */}
        {!isCollapsed && (
        <div 
          className="flex items-center gap-6 sm:gap-8 absolute left-1/2 -translate-x-1/2"
          style={{ 
            position: 'relative', 
            zIndex: 20,
            pointerEvents: 'auto',
          }}
        >
          {/* Chat Link */}
          <Link
            href={`/chat?recordId=${recordId}`}
            className="transition-all duration-300"
            style={{
              color: isChatPage ? colors.accent : colors.text,
              textDecoration: 'none',
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
              fontWeight: isChatPage ? 600 : 500,
              borderBottom: isChatPage ? `2px solid ${colors.accent}` : '2px solid transparent',
              paddingBottom: '0.25rem',
              pointerEvents: 'auto',
              position: 'relative',
              zIndex: 20,
            }}
            onMouseEnter={(e) => {
              if (!isChatPage) {
                e.currentTarget.style.color = colors.accent;
              }
            }}
            onMouseLeave={(e) => {
              if (!isChatPage) {
                e.currentTarget.style.color = colors.text;
              }
            }}
          >
            Chat
          </Link>

          {/* Stats Link */}
          <Link
            href={`/dashboard?recordId=${recordId}`}
            className="transition-all duration-300"
            style={{
              color: isDashboardPage ? colors.accent : colors.text,
              textDecoration: 'none',
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
              fontWeight: isDashboardPage ? 600 : 500,
              borderBottom: isDashboardPage ? `2px solid ${colors.accent}` : '2px solid transparent',
              paddingBottom: '0.25rem',
              pointerEvents: 'auto',
              position: 'relative',
              zIndex: 20,
            }}
            onMouseEnter={(e) => {
              if (!isDashboardPage) {
                e.currentTarget.style.color = colors.accent;
              }
            }}
            onMouseLeave={(e) => {
              if (!isDashboardPage) {
                e.currentTarget.style.color = colors.text;
              }
            }}
          >
            Stats
          </Link>

          {/* Integrations Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Use direct navigation - most reliable method
              window.location.href = `/integrations?recordId=${encodeURIComponent(recordId)}`;
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            className="transition-all duration-300"
            style={{
              color: isIntegrationsPage ? colors.accent : colors.text,
              textDecoration: 'none',
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
              fontWeight: isIntegrationsPage ? 600 : 500,
              borderBottom: isIntegrationsPage ? `2px solid ${colors.accent}` : '2px solid transparent',
              paddingBottom: '0.25rem',
              pointerEvents: 'auto',
              position: 'relative',
              zIndex: 100,
              backgroundColor: 'transparent',
              border: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              padding: 0,
              margin: 0,
            }}
            onMouseEnter={(e) => {
              if (!isIntegrationsPage) {
                e.currentTarget.style.color = colors.accent;
              }
            }}
            onMouseLeave={(e) => {
              if (!isIntegrationsPage) {
                e.currentTarget.style.color = colors.text;
              }
            }}
          >
            Integrations
          </button>

          {/* Edit Agent Link */}
          <Link
            href={`/personal-setup?edit=${recordId}`}
            className="transition-all duration-300"
            style={{
              color: colors.text,
              textDecoration: 'none',
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
              fontWeight: 500,
              pointerEvents: 'auto',
              position: 'relative',
              zIndex: 20,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = colors.accent;
              e.currentTarget.style.textShadow = `0 0 10px ${colors.accent}50`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = colors.text;
              e.currentTarget.style.textShadow = 'none';
            }}
          >
            Edit Agent
          </Link>
        </div>
        )}

        {/* Collapse/Expand Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg transition-all flex-shrink-0"
          style={{
            color: colors.accent,
            backgroundColor: 'transparent',
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${colors.accent}20`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title={isCollapsed ? 'Expand navbar' : 'Collapse navbar'}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>

        {/* Resize Handle - Only show when not collapsed, constrained to rightmost 8px */}
        {!isCollapsed && (
        <div
          className="absolute right-0 top-0 bottom-0 cursor-col-resize group"
          style={{
            width: '8px',
            backgroundColor: 'transparent',
            pointerEvents: 'none',
            zIndex: 1,
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
      </div>
    </nav>
  );
}
