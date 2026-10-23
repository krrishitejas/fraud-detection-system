/** @type {import('tailwindcss').Config} */

/*
 * The light design system.
 *
 * The tokens are named for the job they do, not for the colour they happen to be,
 * so a reader of a class name can tell what it is for: `surface` is something you
 * put things on, `line` separates, `ink` is text, `brand` is the product accent,
 * and positive / warning / danger carry meaning rather than decoration.
 *
 * Every ink shade used for text clears WCAG AA on the surface it is meant for:
 * ink-700 on white is 10.4:1, ink-500 on white is 4.9:1, and brand-600 on white is
 * 5.2:1. That matters more than usual here, because a fraud decision is something a
 * person has to read and act on.
 */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          page:   '#f5f7fb',   // the page behind everything
          card:   '#ffffff',   // panels, cards, the sidebar
          sunken: '#eef2f8',   // insets, code blocks, table headers
          hover:  '#e8eef7',   // hover and secondary fills
          active: '#dde6f2',   // pressed and selected fills
        },
        line: {
          DEFAULT: '#e9edf4',  // panels and separators: ~1.15:1 on white
          strong:  '#cbd6e6',  // controls only, where an edge must be findable
        },
        ink: {
          900: '#0f172a',      // headings
          800: '#1e293b',      // strong body
          700: '#334155',      // body
          600: '#475569',      // secondary body
          500: '#5b6b82',      // labels, captions (4.9:1 on white)
          400: '#6b7a91',      // the quietest readable text (4.5:1 on white)
        },
        brand: {
          50:  '#eef4ff',
          100: '#dbe6fe',
          200: '#c3d6fd',
          500: '#3b6fe0',
          600: '#2457c9',      // default accent for text and icons
          700: '#1b44a3',      // accent text on a tinted background
        },
        positive: { 50: '#ecfdf5', 100: '#d1fae5', 500: '#10b981', 600: '#059669', 700: '#047857' },
        warning:  { 50: '#fffbeb', 100: '#fef3c7', 500: '#f59e0b', 600: '#b45309', 700: '#92400e' },
        danger:   { 50: '#fef2f2', 100: '#fee2e2', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c' },
        violet:   { 50: '#f5f3ff', 100: '#ede9fe', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9' },
        teal:     { 50: '#f0fdfa', 100: '#ccfbf1', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e' },
      },
      fontSize: {
        // 13px, not Tailwind's 12px. An app screen is read for eight hours;
        // the inspector measured 72% of this screen under 13px, which is
        // subline size being used for the data itself.
        xs: ['0.8125rem', { lineHeight: '1.15rem' }],
        sm: ['0.875rem', { lineHeight: '1.3rem' }],
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        // Light themes separate with elevation, not with glow.
        card:    '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
        raised:  '0 2px 4px rgba(15, 23, 42, 0.04), 0 6px 16px rgba(15, 23, 42, 0.08)',
        overlay: '0 12px 32px rgba(15, 23, 42, 0.14)',
        focus:   '0 0 0 3px rgba(36, 87, 201, 0.18)',
      },
    },
  },
  plugins: [],
};
