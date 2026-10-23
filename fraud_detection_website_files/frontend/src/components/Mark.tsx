import React from 'react';

/**
 * The product's mark.
 *
 * Drawn from the thing the product does rather than from the category. A
 * shield in a rounded square says "security software"; this says what this
 * system is: a scale with one line across it, placed where the real cutoff
 * sits — near the left, because fraud is rare and the boundary is nowhere
 * near the middle. The short strokes to the right of the line are the held
 * payments, the few that cross it.
 */
export const Mark: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg
    viewBox="0 0 36 36"
    className={className}
    role="img"
    aria-label="Ledger fraud scoring"
    fill="none"
  >
    <rect x="0.75" y="0.75" width="34.5" height="34.5" rx="3" stroke="#1C2117" strokeWidth="1.5" />
    {/* the scale */}
    <path d="M7 26h22" stroke="#1C2117" strokeWidth="1.5" strokeLinecap="square" />
    {/* the approved stretch: most payments, none of them near the line */}
    <path d="M10 26v-4M14 26v-7M18 26v-11" stroke="#6E7767" strokeWidth="2" strokeLinecap="square" />
    {/* the line */}
    <path d="M22.5 30V7" stroke="#B3301A" strokeWidth="2" strokeLinecap="square" />
    {/* what crossed it */}
    <path d="M26.5 26v-14" stroke="#B3301A" strokeWidth="2" strokeLinecap="square" />
  </svg>
);
