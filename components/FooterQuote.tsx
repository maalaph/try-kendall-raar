'use client';

import { colors } from '@/lib/config';

export default function FooterQuote() {
  return (
    <footer 
      className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 border-t flex items-center justify-center"
      style={{ 
        borderColor: colors.secondary,
        backgroundColor: colors.primary,
      }}
    >
      <div className="w-full max-w-7xl mx-auto flex items-center justify-center">
        <div className="flex items-center justify-center gap-6 sm:gap-8">
          {/* Facebook Icon */}
          <a
            href="https://www.facebook.com/share/1bbSX7Q8Qc/?mibextid=wwXIfr"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-all duration-300"
            style={{ color: colors.accent, opacity: 0.7 }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
            </svg>
          </a>

          {/* Email Icon */}
          <a
            href="mailto:admin@ordco.net"
            className="transition-all duration-300"
            style={{ color: colors.accent, opacity: 0.7 }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </a>

          {/* Instagram Icon */}
          <a
            href="https://www.instagram.com/raar.inc?igsh=MTRhZXZicmE5dXNpZw%3D%3D&utm_source=qr"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-all duration-300"
            style={{ color: colors.accent, opacity: 0.7 }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}

