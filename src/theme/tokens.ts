import { defineTokens } from '@chakra-ui/react';

// ─── Font stacks (matching FAST Engine) ─────────────────────────────
const sansFallback = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
const monoFallback = `SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;

export const fonts = defineTokens.fonts({
  heading: {
    value: `"TT Norms Pro Normal", ${sansFallback}`,
  },
  body: {
    value: `"JetBrains Mono", ${monoFallback}`,
  },
  mono: {
    value: `"JetBrains Mono", ${monoFallback}`,
  },
  headingCompact: {
    value: `"TT Norms Pro Compact", ${sansFallback}`,
  },
  sans: {
    value: `"TT Norms Pro Normal", ${sansFallback}`,
  },
});

// ─── Color tokens (matching FAST Engine core + Futurescaper-specific) ──
export const colors = defineTokens.colors({
  // ── Core brand (same as Engine) ──
  brand: {
    50: { value: '#f0f4ff' },
    100: { value: '#e0eaff' },
    200: { value: '#c7d7fe' },
    300: { value: '#a5bcfc' },
    400: { value: '#8285FF' },
    500: { value: '#0005E9' },
    600: { value: '#000383' },
    700: { value: '#000266' },
    800: { value: '#00024d' },
    900: { value: '#000133' },
  },

  // ── Backgrounds ──
  background: {
    app: {
      light: { value: '#FAFAFA' },
      dark: { value: '#111111' },
    },
    card: {
      light: { value: '#FFFFFF' },
      dark: { value: '#1a1a1a' },
    },
  },

  // ── Text ──
  text: {
    primary: {
      light: { value: '#1B1B1D' },
      dark: { value: '#FFFFFF' },
    },
    secondary: {
      light: { value: '#434B53' },
      dark: { value: '#A7ACB2' },
    },
    muted: {
      light: { value: '#7D858C' },
      dark: { value: '#7D858C' },
    },
  },

  // ── Borders ──
  border: {
    primary: {
      light: { value: '#111111' },
      dark: { value: '#FFFFFF' },
    },
    secondary: {
      light: { value: '#E0E0E0' },
      dark: { value: '#333333' },
    },
  },

  // ── Status ──
  status: {
    success: {
      light: { value: '#3DB462' },
      dark: { value: '#5EFF8F' },
    },
    error: {
      light: { value: '#FF4D53' },
      dark: { value: '#FF6860' },
    },
    warning: { value: '#F2CD5D' },
    info: { value: '#46ACC8' },
  },

  // ── Glass ──
  glass: {
    light: { value: 'rgba(255, 255, 255, 0.8)' },
    dark: { value: 'rgba(26, 26, 26, 0.5)' },
  },

  // ── Futurescaper: STEEP category colors (muted variants) ──
  // These are subtle tints used as secondary hints alongside symbols
  steep: {
    social: {
      light: { value: '#F5E0EA' },      // Muted pink
      dark: { value: 'rgba(233, 30, 140, 0.15)' },
    },
    technological: {
      light: { value: '#DFF5EF' },      // Muted teal
      dark: { value: 'rgba(0, 212, 170, 0.15)' },
    },
    economic: {
      light: { value: '#F5F2D9' },      // Muted yellow
      dark: { value: 'rgba(200, 230, 0, 0.15)' },
    },
    environmental: {
      light: { value: '#E0F5E6' },      // Muted green
      dark: { value: 'rgba(34, 197, 94, 0.15)' },
    },
    political: {
      light: { value: '#FDE8DF' },      // Muted orange
      dark: { value: 'rgba(255, 107, 53, 0.15)' },
    },
    ethical: {
      light: { value: '#EDDFFF' },      // Muted purple
      dark: { value: 'rgba(124, 92, 252, 0.15)' },
    },
  },

  // ── Futurescaper: Probability colors (muted) ──
  probability: {
    probable: {
      light: { value: '#DFF5EF' },
      dark: { value: 'rgba(0, 212, 170, 0.15)' },
    },
    plausible: {
      light: { value: '#EDDFFF' },
      dark: { value: 'rgba(124, 92, 252, 0.15)' },
    },
    possible: {
      light: { value: '#FFF0D9' },
      dark: { value: 'rgba(255, 159, 28, 0.15)' },
    },
    wildcard: {
      light: { value: '#FFE0E4' },
      dark: { value: 'rgba(255, 77, 109, 0.15)' },
    },
  },

  // ── Futurescaper: Solution/Idea colors ──
  solution: {
    light: { value: '#FFF7E6' },
    dark: { value: 'rgba(255, 159, 28, 0.15)' },
  },
});
