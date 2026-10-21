/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070b14',
          900: '#0c1220',
          850: '#10182b',
          800: '#152138',
          700: '#1e2f4f',
          600: '#2d446f',
        },
        accent: {
          cyan: '#38bdf8',
          teal: '#14b8a6',
          blue: '#3b82f6',
          purple: '#8b5cf6',
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#f43f5e',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px -5px rgba(56, 189, 248, 0.25)',
        'glow-rose': '0 0 20px -5px rgba(244, 63, 94, 0.25)',
        'glow-emerald': '0 0 20px -5px rgba(16, 185, 129, 0.25)',
      }
    },
  },
  plugins: [],
}
