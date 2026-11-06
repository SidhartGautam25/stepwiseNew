import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        theme: {
          bg: 'var(--canvas-bg)',
          fg: 'var(--canvas-fg)',
          card: 'var(--card-bg)',
          border: 'var(--border-color)',
          yellow: 'var(--accent-yellow)',
          pink: 'var(--accent-pink)',
          blue: 'var(--accent-blue)',
          green: 'var(--accent-green)',
          red: 'var(--accent-red)',
          purple: 'var(--accent-purple)',
          orange: 'var(--accent-orange)',
          'surface-muted': 'var(--surface-muted)',
          terminal: 'var(--terminal-bg)',
          muted: 'var(--muted-text)',
        },
      },
      boxShadow: {
        'hard-sm': 'var(--shadow-hard-sm)',
        'hard-md': 'var(--shadow-hard-md)',
        'hard-lg': 'var(--shadow-hard-lg)',
        'hard-xl': 'var(--shadow-hard-xl)',
      },
    },
  },
  plugins: [],
};

export default config;
