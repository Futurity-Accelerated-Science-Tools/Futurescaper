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

/**
 * Manages the `data-theme` attribute on <html> which drives Chakra's
 * semantic token conditions (`_light` / `_dark`).
 */
export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>(() => {
    // Check localStorage, fall back to system preference
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
