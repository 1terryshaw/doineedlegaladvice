'use client';

import { useState, useEffect } from 'react';

interface LoadingSpinnerProps {
  messages: string[];
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: { svg: 32, stroke: 3 },
  md: { svg: 48, stroke: 3 },
  lg: { svg: 64, stroke: 4 },
};

export default function LoadingSpinner({ messages, size = 'md' }: LoadingSpinnerProps) {
  const [message] = useState(() => messages[Math.floor(Math.random() * messages.length)]);
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    setPrefersReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  const { svg, stroke } = SIZES[size];
  const radius = (svg - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <svg
        width={svg}
        height={svg}
        viewBox={`0 0 ${svg} ${svg}`}
        className={prefersReduced ? '' : 'animate-spin'}
        style={prefersReduced ? {} : { animationDuration: '1.2s' }}
        role="status"
        aria-label="Loading"
      >
        {/* Background circle */}
        <circle
          cx={svg / 2}
          cy={svg / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-gray-200"
        />
        {/* Spinning arc */}
        <circle
          cx={svg / 2}
          cy={svg / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.3} ${circumference * 0.7}`}
          className="text-[#1E3A5F]"
        />
      </svg>
      {message && (
        <p className="text-gray-500 text-sm font-medium">{message}</p>
      )}
    </div>
  );
}
