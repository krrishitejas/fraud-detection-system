/*
 * Chart tokens.
 *
 * One hue on the main data element, neutrals for everything else. That is the
 * rule the studied product screens follow and the one generated dashboards
 * break first: a hue per bar, a rainbow legend, a different colour for every
 * row. Here `series[0]` is the measure the chart is about and `series[1]` is
 * its comparison; past two, facet rather than reach for a third hue.
 *
 * The signal colours are not in this list on purpose. flag, hold and clear
 * mean over the line, under review and approved; spending them on a chart
 * series would make a bar look like a verdict.
 */

export const chartColors = {
  /** The main measure, then its comparison. Fixed order: a series keeps its
   *  colour when a filter removes another, because colour identifies the
   *  thing and not its rank. */
  /* Validated against the paper surface rather than chosen by eye: worst
     all-pairs separation dE 8.9 under deuteranopia and 16.6 for normal
     vision, and all three clear 3:1 contrast. Ink blue, ochre, plum. */
  series: ['#1C6494', '#BE7F00', '#7B3A5E'] as const,

  /** Single hue for "how much of this" charts, where bar length is the ranking
   *  and a second colour would encode it twice. */
  magnitude: '#1C6494',
  magnitudeMuted: '#A6C3D7',

  /** Reserved for state. Never a series colour. */
  status: {
    flag: '#B3301A',
    hold: '#8A6A12',
    clear: '#476034',
    neutral: '#5A6353',
  },

  grid: '#DFE4D8',
  axis: '#5A6353',
  surface: '#FBFCF9',
  border: '#C3CCB6',
  ink: '#1C2117',
} as const;

/** Recharts tooltip styling, identical everywhere. */
export const tooltipStyle = {
  backgroundColor: chartColors.surface,
  border: `1px solid ${chartColors.border}`,
  borderRadius: '6px',
  color: chartColors.ink,
  fontSize: '12px',
  fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
  boxShadow: '0 12px 32px rgba(28, 33, 23, 0.16)',
} as const;

export const tooltipItemStyle = { color: chartColors.ink } as const;
export const tooltipLabelStyle = {
  color: chartColors.axis,
  fontWeight: 600,
  marginBottom: '4px',
} as const;
