/*
 * Chart tokens.
 *
 * Every chart in the dashboard reads its colours from here, so the light theme is
 * defined once rather than as hex literals scattered through seven pages.
 *
 * The three categorical hues were validated against a white chart surface rather
 * than chosen by eye. Worst all-pairs separation is dE 8.4 under protanopia and
 * 25.1 for normal vision, and all three clear 3:1 contrast against white, so the
 * series stay distinguishable for a colour-blind reader and visible for everyone.
 * Keep the order fixed: a series keeps its colour when a filter removes another,
 * because colour here identifies the thing, not its rank.
 *
 * Ranked magnitude charts -- feature importance, PSI by block -- use ONE hue, not
 * three. Colouring the top bar red and the second amber encodes rank twice, once in
 * the bar length and once in the hue, and invents a severity the number does not
 * carry.
 */

export const chartColors = {
  /** Fixed categorical order. Never cycle; past three series, facet instead. */
  series: ['#2457c9', '#d9601f', '#0f8f66'] as const,

  /** Single hue for "how much of this" charts. */
  magnitude: '#2457c9',
  magnitudeMuted: '#9db4e4',

  /** Reserved for state. Never reused as a fourth series colour. */
  status: {
    positive: '#047857',
    warning: '#b45309',
    danger: '#b91c1c',
    neutral: '#64748b',
  },

  grid: '#e4eaf3',
  axis: '#64748b',
  surface: '#ffffff',
  border: '#cbd6e6',
  ink: '#0f172a',
} as const;

/** Recharts tooltip styling, identical everywhere. */
export const tooltipStyle = {
  backgroundColor: chartColors.surface,
  border: `1px solid ${chartColors.border}`,
  borderRadius: '8px',
  color: chartColors.ink,
  fontSize: '12px',
  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
} as const;

export const tooltipItemStyle = { color: chartColors.ink } as const;
export const tooltipLabelStyle = {
  color: chartColors.axis,
  fontWeight: 600,
  marginBottom: '4px',
} as const;
