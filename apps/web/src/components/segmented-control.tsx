'use client';
import React from 'react';

export interface SegTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface SegmentedControlProps {
  tabs: SegTab[];
  value: string;
  onChange: (id: string) => void;
  /** pill = outlined rounded buttons (default), chip = white pill on gray bg, underline = border-bottom indicator */
  variant?: 'pill' | 'chip' | 'underline';
  className?: string;
  activeStyle?: React.CSSProperties;
  inactiveStyle?: React.CSSProperties;
  role?: string;
  'aria-label'?: string;
}

export function SegmentedControl({
  tabs,
  value,
  onChange,
  variant = 'pill',
  className = '',
  activeStyle,
  inactiveStyle,
  role,
  'aria-label': ariaLabel,
}: SegmentedControlProps) {
  if (variant === 'chip') {
    return (
      <div
        className={`flex flex-wrap gap-0.5 p-1 rounded-xl ${className}`}
        style={{ background: '#f3f4f6' }}
      >
        {tabs.map((t) => {
          const active = value === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap"
              style={active
                ? (activeStyle ?? { background: '#fff', color: '#374151', boxShadow: '0 2px 8px rgba(55,65,81,.15)' })
                : (inactiveStyle ?? { color: '#9ca3af' })}
            >
              {t.icon}
              {t.label}
              {t.badge != null && (
                <span className="text-[11px] bg-gray-100 text-gray-700 rounded-full px-1.5 ml-0.5">{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'underline') {
    return (
      <div className={`flex flex-wrap ${className}`} role={role} aria-label={ariaLabel}>
        {tabs.map((t) => {
          const active = value === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={[
                'flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap touch-manipulation',
                active
                  ? 'border-[#374151] text-[#374151] font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200',
              ].join(' ')}
              style={active ? activeStyle : inactiveStyle}
            >
              {t.icon && <span className="flex items-center w-4 h-4">{t.icon}</span>}
              {t.label}
              {t.badge != null && (
                <span
                  className="text-white font-bold leading-none"
                  style={{ fontSize: '9px', padding: '2px 5px', borderRadius: '99px', background: '#374151' }}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap gap-2 ${className}`}
      role={role ?? 'tablist'}
      aria-label={ariaLabel}
    >
      {tabs.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border whitespace-nowrap"
            style={active
              ? (activeStyle ?? { background: '#f3f4f6', border: '2px solid #374151', color: '#374151' })
              : (inactiveStyle ?? { background: '#faf9ff', border: '1.5px solid #e5e7eb', color: '#374151' })
            }
          >
            {t.icon}
            {t.label}
            {t.badge != null && (
              <span
                className="text-white font-bold leading-none"
                style={{ fontSize: '9px', padding: '2px 5px', borderRadius: '99px', background: '#374151' }}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
