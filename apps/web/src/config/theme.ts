/**
 * Centralized Design System & Theme Configuration
 * All colors, typography, borders, and shadows are defined here as single sources of truth.
 * Modifying these values updates the entire design system across components.
 */

export const THEME = {
  colors: {
    // Canvas & Core
    canvasBg: '#F7F4EE',        // Warm retro off-white paper
    canvasFg: '#000000',        // Pure ink black for maximum contrast
    cardBg: '#FFFFFF',          // Clean white surface for cards

    // Accents
    accentYellow: '#FFDE59',    // Vibrant neo-brutalist yellow (CTA, highlights, active tabs)
    accentPink: '#FCA5A5',      // Soft pastel pink / lavender for hero banner pill
    accentBlue: '#93C5FD',      // Light sky blue for card header bars
    accentGreen: '#4ADE80',     // Vibrant terminal pass green
    accentRed: '#F87171',       // Vibrant terminal fail coral/red

    // Surfaces & Code
    terminalBg: '#121212',      // Deep terminal background
    border: '#000000',          // High-contrast 2px/3px black border
    mutedText: '#4B5563',       // Subtitle and muted text
  },

  borders: {
    default: '2px solid #000000',
    thick: '3px solid #000000',
    thin: '1px solid #000000',
  },

  shadows: {
    sm: '2px 2px 0px #000000',
    md: '3px 3px 0px #000000',
    lg: '4px 4px 0px #000000',
    xl: '8px 8px 0px #000000',
  },

  radii: {
    none: '0px',
    sm: '2px',
    md: '4px',
    pill: '9999px',
  },

  fonts: {
    sans: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
    mono: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)',
  },
} as const;

export type ThemeConfig = typeof THEME;

