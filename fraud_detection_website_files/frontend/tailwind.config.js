/** @type {import('tailwindcss').Config} */

/*
 * Ledger.
 *
 * The subject is a fraud analyst's scoring console, and the one fact that
 * belongs to it and to nothing else is where its decision boundary sits: at
 * 0.0655 on a nought-to-one scale, because fraud is 3.5% of these payments.
 * A generic risk dashboard centres a gauge at 50. This one's line is at 6.55,
 * and the design exists to make that asymmetry readable.
 *
 * So the palette is ledger stock rather than the slate-and-blue kit every
 * dashboard wears: a cool pale green-grey paper, a dark olive ink, and one
 * signal colour that means ONE thing. `flag` is used where a payment is above
 * the cutoff and nowhere else -- not on navigation, not on headings, not on a
 * button that happens to be primary. When a reader sees it, something crossed
 * the line.
 *
 * Every ink shade used for text clears WCAG AA on the surface it is meant for.
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          page:   '#EFF2EC',   // ledger stock
          card:   '#FBFCF9',   // panels, the sidebar
          sunken: '#E6EBE0',   // insets, table heads, code
          hover:  '#E1E7DA',
          active: '#D6DECC',
        },
        line: {
          DEFAULT: '#DFE4D8',  // ruling: a whisper, ~1.15:1 on paper
          strong:  '#C3CCB6',  // controls, where an edge must be findable
        },
        ink: {
          900: '#1C2117',      // headings. A chosen dark, not #111
          800: '#2B3224',
          700: '#3D4634',      // body
          600: '#4E5944',
          500: '#5A6353',      // labels (4.9:1 on paper)
          400: '#606957',      // the quietest readable text: 4.5:1 on paper,
                               // on the page ground and on a sunken inset
        },
        // Over the line. Nothing else may use it.
        flag:  { 50: '#FBEDE9', 100: '#F6DBD3', 500: '#C9442C', 600: '#B3301A', 700: '#8F2614' },
        // The review band: neither approved nor held.
        hold:  { 50: '#FAF4E4', 100: '#F3E8C8', 500: '#A8841C', 600: '#8A6A12', 700: '#6B520C' },
        // Approved. Deliberately quiet: most payments are fine and the screen
        // should not celebrate each one.
        clear: { 50: '#EDF2E9', 100: '#DCE6D4', 500: '#5C7A48', 600: '#476034', 700: '#374C28' },
        // One hue for data, on the main series only.
        data:  { 50: '#E7EFF5', 100: '#CFE0EC', 500: '#2277AD', 600: '#1C6494', 700: '#164E73' },
      },
      fontFamily: {
        // Archivo for the interface: a grotesque with industrial character and
        // a real weight range, which Inter does not have the voice for.
        sans: ['Archivo', 'system-ui', '-apple-system', 'sans-serif'],
        // Plex Mono for every figure and identifier. Plex was drawn for data.
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // 13px, not Tailwind's 12px: this screen is read for hours.
        xs: ['0.8125rem', { lineHeight: '1.15rem' }],
        sm: ['0.875rem', { lineHeight: '1.3rem' }],
      },
      boxShadow: {
        // Paper separates by tone, not by shadow. Only what floats casts one.
        card:    '0 1px 0 rgba(28, 33, 23, 0.03)',
        overlay: '0 12px 32px rgba(28, 33, 23, 0.16)',
        focus:   '0 0 0 3px rgba(62, 110, 150, 0.22)',
      },
    },
  },
  plugins: [],
};
