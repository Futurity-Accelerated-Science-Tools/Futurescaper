/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        positive: {
          light: '#e6fff5',
          DEFAULT: '#00d4aa',
          dark: '#0a6847',
        },
        negative: {
          light: '#fff0f3',
          DEFAULT: '#ff4d6d',
          dark: '#a4133c',
        },
        neutral: {
          light: '#f3f4f6',
          DEFAULT: '#9ca3af',
          dark: '#4b5563',
        },
        seed: {
          light: '#f0f0ff',
          DEFAULT: '#7c5cfc',
          dark: '#5a3fd6',
        },
        steep: {
          social: '#e91e8c',
          technological: '#00d4aa',
          economic: '#c8e600',
          environmental: '#22c55e',
          political: '#ff6b35',
          ethical: '#7c5cfc',
        }
      },
      fontFamily: {
        sans: ['JetBrains Mono', 'monospace'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
