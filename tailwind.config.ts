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
        // SORTIE design tokens (CSS variables for theme switching)
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface-2)',
        chrome: 'var(--chrome)',
        line: 'var(--line)',
        line2: 'var(--line-2)',
        ink: 'var(--ink)',
        dim: 'var(--dim)',
        mute: 'var(--mute)',
        dim2: 'var(--dim-2)',
        green: 'var(--green)',
        red: 'var(--red)',
        purple: 'var(--purple)',
        amber: 'var(--amber)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
