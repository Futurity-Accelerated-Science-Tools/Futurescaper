import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

type ColorMode = 'light' | 'dark';

interface ColorModeContextValue {
  colorMode: ColorMode;
  toggleColorMode: () => void;
  setColorMode: (mode: ColorMode) => void;
}

const ColorModeContext = createContext<ColorModeContextValue>({
  colorMode: 'light',
  toggleColorMode: () => {},
  setColorMode: () => {},
});

export function useColorMode() {
  return useContext(ColorModeContext);
}

interface ColorModeProviderProps {
  children: ReactNode;
  /**
   * When provided, the provider delegates to an external color mode
   * instead of managing its own state. Used when Futurescaper components
   * are rendered inside the FAST app, which has its own theme context.
   */
  externalColorMode?: ColorMode;
  externalToggle?: () => void;
}

/**
 * Manages the `data-theme` attribute on <html> which drives Chakra's
 * semantic token conditions (`_light` / `_dark`).
 *
 * When externalColorMode is provided (e.g. from FAST's useTheme()),
 * this provider acts as a pass-through bridge rather than managing state.
 */
export function ColorModeProvider({
  children,
  externalColorMode,
  externalToggle,
}: ColorModeProviderProps) {
  // ── External mode (running inside FAST) ──────────────────────
  if (externalColorMode !== undefined) {
    const setColorMode = useCallback(
      (mode: ColorMode) => {
        // Only toggle if the requested mode differs from current
        if (mode !== externalColorMode && externalToggle) {
          externalToggle();
        }
      },
      [externalColorMode, externalToggle]
    );

    return (
      <ColorModeContext.Provider
        value={{
          colorMode: externalColorMode,
          toggleColorMode: externalToggle || (() => {}),
          setColorMode,
        }}
      >
        {children}
      </ColorModeContext.Provider>
    );
  }

  // ── Standalone mode (running as independent Futurescaper app) ──
  return <StandaloneColorModeProvider>{children}</StandaloneColorModeProvider>;
}

function StandaloneColorModeProvider({ children }: { children: ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>(() => {
    const stored = localStorage.getItem('futurescaper-color-mode') as ColorMode | null;
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorMode);
    localStorage.setItem('futurescaper-color-mode', colorMode);
  }, [colorMode]);

  const toggleColorMode = useCallback(() => {
    setColorModeState(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const setColorMode = useCallback((mode: ColorMode) => {
    setColorModeState(mode);
  }, []);

  return (
    <ColorModeContext.Provider value={{ colorMode, toggleColorMode, setColorMode }}>
      {children}
    </ColorModeContext.Provider>
  );
}
