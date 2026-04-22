import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';
import { colors, fonts } from './tokens';

const config = defineConfig({
  theme: {
    breakpoints: {
      base: '0px',
      sm: '560px',
      md: '1024px',
      lg: '1460px',
    },
    tokens: {
      colors,
      fonts,
    },
    semanticTokens: {
      colors: {
        // ── Core semantic tokens (matching Engine) ──
        bg: {
          DEFAULT: {
            value: {
              _light: '{colors.background.app.light}',
              _dark: '{colors.background.app.dark}',
            },
          },
          canvas: {
            value: {
              _light: '{colors.background.card.light}',
              _dark: '{colors.background.card.dark}',
            },
          },
          subtle: {
            value: {
              _light: 'rgba(250, 250, 250, 0.6)',
              _dark: 'rgba(26, 26, 26, 0.6)',
            },
          },
          muted: {
            value: {
              _light: 'rgba(255, 255, 255, 0.8)',
              _dark: 'rgba(26, 26, 26, 0.8)',
            },
          },
          hover: {
            value: {
              _light: '#f5f5f5',
              _dark: '#2a2a2a',
            },
          },
          active: {
            value: {
              _light: '#e0e0e0',
              _dark: '#333333',
            },
          },
        },

        fg: {
          DEFAULT: {
            value: {
              _light: '{colors.text.primary.light}',
              _dark: '{colors.text.primary.dark}',
            },
          },
          secondary: {
            value: {
              _light: '{colors.text.secondary.light}',
              _dark: '{colors.text.secondary.dark}',
            },
          },
          muted: {
            value: {
              _light: '{colors.text.muted.light}',
              _dark: '{colors.text.muted.dark}',
            },
          },
          link: {
            value: {
              _light: '{colors.brand.500}',
              _dark: '{colors.brand.400}',
            },
          },
          success: {
            value: {
              _light: '{colors.status.success.light}',
              _dark: '{colors.status.success.dark}',
            },
          },
          error: {
            value: {
              _light: '{colors.status.error.light}',
              _dark: '{colors.status.error.dark}',
            },
          },
        },

        border: {
          DEFAULT: {
            value: {
              _light: '{colors.border.primary.light}',
              _dark: '{colors.border.primary.dark}',
            },
          },
          emphasized: {
            value: {
              _light: '{colors.border.primary.light}',
              _dark: '{colors.border.primary.dark}',
            },
          },
          muted: {
            value: {
              _light: '{colors.border.secondary.light}',
              _dark: '{colors.border.secondary.dark}',
            },
          },
          hover: {
            value: {
              _light: '{colors.brand.500}',
              _dark: '{colors.brand.400}',
            },
          },
          focus: {
            value: {
              _light: '{colors.brand.500}',
              _dark: '{colors.brand.400}',
            },
          },
        },

        brand: {
          DEFAULT: { value: '{colors.brand.500}' },
          hover: {
            value: {
              _light: '{colors.brand.600}',
              _dark: '{colors.brand.400}',
            },
          },
          subtle: { value: '{colors.brand.400}' },
          contrast: { value: '#FFFFFF' },
        },

        // Status
        success: {
          value: {
            _light: '{colors.status.success.light}',
            _dark: '{colors.status.success.dark}',
          },
        },
        error: {
          value: {
            _light: '{colors.status.error.light}',
            _dark: '{colors.status.error.dark}',
          },
        },
        warning: { value: '{colors.status.warning}' },
        info: { value: '{colors.status.info}' },

        // Glass
        glass: {
          value: {
            _light: '{colors.glass.light}',
            _dark: '{colors.glass.dark}',
          },
        },

        // ── Futurescaper-specific: STEEP category backgrounds ──
        steepBg: {
          social: {
            value: {
              _light: '{colors.steep.social.light}',
              _dark: '{colors.steep.social.dark}',
            },
          },
          technological: {
            value: {
              _light: '{colors.steep.technological.light}',
              _dark: '{colors.steep.technological.dark}',
            },
          },
          economic: {
            value: {
              _light: '{colors.steep.economic.light}',
              _dark: '{colors.steep.economic.dark}',
            },
          },
          environmental: {
            value: {
              _light: '{colors.steep.environmental.light}',
              _dark: '{colors.steep.environmental.dark}',
            },
          },
          political: {
            value: {
              _light: '{colors.steep.political.light}',
              _dark: '{colors.steep.political.dark}',
            },
          },
          ethical: {
            value: {
              _light: '{colors.steep.ethical.light}',
              _dark: '{colors.steep.ethical.dark}',
            },
          },
        },

        // ── Futurescaper-specific: Probability backgrounds ──
        probabilityBg: {
          probable: {
            value: {
              _light: '{colors.probability.probable.light}',
              _dark: '{colors.probability.probable.dark}',
            },
          },
          plausible: {
            value: {
              _light: '{colors.probability.plausible.light}',
              _dark: '{colors.probability.plausible.dark}',
            },
          },
          possible: {
            value: {
              _light: '{colors.probability.possible.light}',
              _dark: '{colors.probability.possible.dark}',
            },
          },
          wildcard: {
            value: {
              _light: '{colors.probability.wildcard.light}',
              _dark: '{colors.probability.wildcard.dark}',
            },
          },
        },

        // ── Futurescaper-specific: Solution/Idea background ──
        solutionBg: {
          value: {
            _light: '{colors.solution.light}',
            _dark: '{colors.solution.dark}',
          },
        },
      },
    },

    // ── Keyframes (migrated from index.css + Engine patterns) ──
    keyframes: {
      spin: {
        from: { transform: 'rotate(0deg)' },
        to: { transform: 'rotate(360deg)' },
      },
      fadeIn: {
        from: { opacity: '0' },
        to: { opacity: '1' },
      },
      fadeInUp: {
        from: { transform: 'translateY(10px)', opacity: '0' },
        to: { transform: 'translateY(0)', opacity: '1' },
      },
      slideUp: {
        from: { transform: 'translateY(10px)', opacity: '0' },
        to: { transform: 'translateY(0)', opacity: '1' },
      },
      toolbarSlideIn: {
        '0%': { opacity: '0', transform: 'translateY(8px) scale(0.92)' },
        '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
      },
      actionBtnPop: {
        '0%': { transform: 'scale(0)', opacity: '0' },
        '70%': { transform: 'scale(1.15)' },
        '100%': { transform: 'scale(1)', opacity: '1' },
      },
      nodeExpand: {
        '0%': { opacity: '0', transform: 'scale(0.95)' },
        '100%': { opacity: '1', transform: 'scale(1)' },
      },
    },
  },

  // ── Global CSS ──
  globalCss: {
    '*': {
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    },
    html: {
      bg: 'bg',
      color: 'fg',
      minHeight: '100vh',
    },
    body: {
      bg: 'bg',
      color: 'fg',
      minHeight: '100vh',
      fontFamily: 'body',
      transition: 'background-color 0.2s, color 0.2s',
    },
  },

  // ── Theme conditions (same as Engine) ──
  conditions: {
    light: '[data-theme=light] &, .light &',
    dark: '[data-theme=dark] &, .dark &',
  },
});

export const theme = createSystem(defaultConfig, config);
