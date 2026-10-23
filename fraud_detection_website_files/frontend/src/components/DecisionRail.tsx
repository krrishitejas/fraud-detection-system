import React from 'react';

/**
 * The decision rail.
 *
 * Every decision this system makes is a position relative to one line. That
 * line sits at 0.0655, not at 0.5, because fraud is 3.5% of these payments —
 * and that asymmetry is the thing a generic risk gauge centred at 50 hides.
 *
 * The scale is logarithmic. On a linear nought-to-one axis the cutoff, the
 * review floor and nearly every score a real payment receives collapse into
 * the leftmost 7% and the rail shows nothing. Compressed, the region where
 * decisions actually change becomes most of the width, which is the only
 * arrangement that lets a reader see a score sit *near* the line rather than
 * simply on one side of it.
 *
 * Used wherever a cutoff is applied: under a scored payment, and on the
 * governance page where the cost sweep is six cutoffs on this same rail.
 */

const MIN = 0.001;

/** Log position, 0 to 1 across the rail. */
function pos(v: number): number {
  const clamped = Math.min(1, Math.max(MIN, v));
  return (Math.log10(clamped) - Math.log10(MIN)) / (0 - Math.log10(MIN));
}

const TICKS = [0.001, 0.01, 0.1, 1];

export interface DecisionRailProps {
  /** Where the cutoff sits. Above it, a payment is held. */
  threshold: number;
  /** The review floor. Between the two, a human decides. */
  reviewLow?: number;
  /** A scored payment to place on the rail. */
  score?: number | null;
  /** Other cutoffs to show as ghosts, e.g. the cost sweep. */
  marks?: { at: number; label: string }[];
  /** Taller, with an axis. The compact form omits both. */
  showScale?: boolean;
  label?: string;
}

export const DecisionRail: React.FC<DecisionRailProps> = ({
  threshold,
  reviewLow,
  score = null,
  marks = [],
  showScale = true,
  label,
}) => {
  const tPos = pos(threshold);
  const rPos = reviewLow != null ? pos(reviewLow) : null;
  const sPos = score != null ? pos(score) : null;
  const over = score != null && score >= threshold;
  const review = score != null && !over && reviewLow != null && score >= reviewLow;

  return (
    <figure className="m-0">
      {label && (
        <figcaption className="text-xs text-ink-500 mb-2">{label}</figcaption>
      )}

      <div className={`relative ${showScale ? 'h-[4.25rem]' : 'h-9'}`}>
        {/* Where this payment landed, read above the bar. */}
        {sPos != null && (
          <div
            className="absolute top-0 transition-[left] duration-500 ease-out motion-reduce:transition-none"
            style={{ left: `${sPos * 100}%` }}
          >
            <div
              className={`-translate-x-1/2 whitespace-nowrap font-mono text-xs tabular-nums font-semibold ${
                over ? 'text-flag-700' : review ? 'text-hold-700' : 'text-clear-700'
              }`}
            >
              {score!.toFixed(6)}
            </div>
          </div>
        )}

        {/* The bands. Approve runs to the review floor, the review band to the
            cutoff, and everything above the cutoff is held. */}
        <div className="absolute inset-x-0 top-5 h-5 rounded-sm overflow-hidden border border-line">
          <div
            className="absolute inset-y-0 left-0 bg-clear-50"
            style={{ right: `${100 - (rPos ?? tPos) * 100}%` }}
          />
          {rPos != null && (
            <div
              className="absolute inset-y-0 bg-hold-50"
              style={{ left: `${rPos * 100}%`, right: `${100 - tPos * 100}%` }}
            />
          )}
          <div className="absolute inset-y-0 right-0 bg-flag-50" style={{ left: `${tPos * 100}%` }} />

          {/* Ghost cutoffs: where the line would sit under other assumptions. */}
          {marks.map((m) => (
            <div
              key={m.label}
              className="absolute inset-y-0 w-px bg-ink-400/45"
              style={{ left: `${pos(m.at) * 100}%` }}
              aria-hidden="true"
            />
          ))}

          {rPos != null && (
            <div className="absolute inset-y-0 w-px bg-hold-600" style={{ left: `${rPos * 100}%` }} />
          )}
          {/* The cutoff: the only hard line on the rail. */}
          <div
            className="absolute inset-y-0 w-0.5 bg-flag-600"
            style={{ left: `calc(${tPos * 100}% - 1px)` }}
          />
        </div>

        {/* The payment's own mark, spanning the bar. */}
        {sPos != null && (
          <div
            className="absolute top-[0.9rem] transition-[left] duration-500 ease-out motion-reduce:transition-none"
            style={{ left: `${sPos * 100}%` }}
          >
            <div
              className={`-ml-px w-0.5 h-7 ${
                over ? 'bg-flag-700' : review ? 'bg-hold-700' : 'bg-clear-700'
              }`}
            />
          </div>
        )}

        {/* The axis. Decades, because the scale is logarithmic and saying so is
            the only honest way to label it. */}
        {showScale && (
          <div className="absolute inset-x-0 top-10">
            {TICKS.map((t) => (
              <div
                key={t}
                className="absolute top-0 flex flex-col items-center"
                style={{ left: `${pos(t) * 100}%`, transform: 'translateX(-50%)' }}
              >
                <div className="w-px h-1.5 bg-line-strong" />
                <span className="mt-0.5 font-mono text-[11px] tabular-nums text-ink-400">{t}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* The legend is text, so the bands are never identified by colour alone. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11px] text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-[1px] bg-clear-50 border border-clear-100 shrink-0" />
          approve
        </span>
        {reviewLow != null && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-[1px] bg-hold-50 border border-hold-100 shrink-0" />
            review from{' '}
            <span className="font-mono tabular-nums text-ink-700">
              {reviewLow.toFixed(4)}
            </span>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="w-0.5 h-3 bg-flag-600 shrink-0" />
          hold at or above{' '}
          <span className="font-mono tabular-nums text-ink-700">
            {threshold.toFixed(4)}
          </span>
        </span>
        <span className="text-ink-400">log scale</span>
      </div>
    </figure>
  );
};
