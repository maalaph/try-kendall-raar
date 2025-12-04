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
      className="p-6 rounded-xl"
      style={{
        backgroundColor: `${colors.accent}15`,
        border: `1px solid ${colors.accent}40`,
      }}
    >
      {icon && (
        <div className="mb-3" style={{ color: colors.accent }}>
          {icon}
        </div>
      )}
      <div
        className="text-3xl font-bold mb-1"
        style={{
          color: colors.text,
          fontFamily: 'var(--font-inter), sans-serif',
        }}
      >
        {value}
      </div>
      <div
        className="text-sm"
        style={{
          color: colors.text,
          opacity: 0.7,
          fontFamily: 'var(--font-inter), sans-serif',
        }}
      >
        {label}
      </div>
    </div>
  );
}



