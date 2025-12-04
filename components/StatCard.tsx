'use client';

import { colors } from '@/lib/config';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}

export default function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div
      className="p-5 rounded-lg w-full"
      style={{
        backgroundColor: `${colors.accent}10`,
        border: `1px solid ${colors.accent}25`,
      }}
    >
      <div className="flex items-center justify-center mb-2">
        {icon && (
          <div style={{ color: colors.accent, opacity: 0.8 }}>
            {icon}
          </div>
        )}
      </div>
      <div
        className="text-2xl font-semibold mb-1 text-center"
        style={{
          color: colors.text,
          fontFamily: 'var(--font-inter), sans-serif',
        }}
      >
        {value}
      </div>
      <div
        className="text-xs text-center"
        style={{
          color: colors.text,
          opacity: 0.6,
          fontFamily: 'var(--font-inter), sans-serif',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </div>
    </div>
  );
}



