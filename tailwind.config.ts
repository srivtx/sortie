/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // SORTIE design tokens
        bg: '#0a0a0a',
        surface: '#0d0d0d',
        surface2: '#111111',
        line: '#1f1f1f',
        line2: '#2a2a2a',
        ink: '#e5e5e5',
        dim: '#a3a3a3',
        mute: '#737373',
        dim2: '#404040',
        // Status
        green: '#14F195',
        red: '#ef4444',
        purple: '#9945FF',
        amber: '#fbbf24',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
