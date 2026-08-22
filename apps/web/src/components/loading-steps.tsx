'use client';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStepsProps {
  steps: string[];
  active: boolean;
}

export function LoadingSteps({ steps, active }: LoadingStepsProps) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!active) { setCurrent(0); return; }
    setCurrent(0);
    const interval = setInterval(() => {
      setCurrent(prev => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 2200);
    return () => clearInterval(interval);
  }, [active, steps.length]);

  if (!active) return null;

  return (
    <div className="rounded-2xl border border-[#e3ddf8] bg-[#faf9ff] px-5 py-4 space-y-2.5 animate-in fade-in duration-300">
      <p className="text-[11px] font-semibold text-[#374151] uppercase tracking-widest mb-1 flex items-center gap-1.5">
        <Loader2 className="w-3 h-3 animate-spin" /> AI is working
      </p>
      {steps.map((step, i) => {
        const done = i < current;
        const running = i === current;
        return (
          <div
            key={i}
            className={`flex items-center gap-2.5 text-sm transition-all duration-500 ${
              done ? 'text-gray-400' : running ? 'text-gray-800 font-medium' : 'text-gray-300'
            }`}
          >
            <span className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
              done
                ? 'bg-green-100 text-green-600'
                : running
                ? 'bg-[#374151] text-white'
                : 'bg-gray-100 text-gray-300'
            }`}>
              {done ? '✓' : i + 1}
            </span>
            <span className={running ? 'animate-pulse' : ''}>
              {step}
            </span>
          </div>
        );
      })}
    </div>
  );
}
