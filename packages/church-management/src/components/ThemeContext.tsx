import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeName = 'green' | 'blue' | 'purple' | 'orange' | 'dark';
export type ModeType = 'day' | 'night';

interface ThemeColors {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  sidebar: string;
  sidebarText: string;
  sidebarHover: string;
  accent: string;
}

interface ModeColors {
  bg: string;
  bgSecondary: string;
  text: string;
  textSecondary: string;
  border: string;
  card: string;
  header: string;
  hover: string;
}

const themes: Record<ThemeName, ThemeColors> = {
  green: {
    primary: 'bg-green-600',
    primaryHover: 'hover:bg-green-700',
    primaryLight: 'bg-green-50',
    sidebar: 'bg-gradient-to-b from-green-800 to-green-900',
    sidebarText: 'text-green-100',
    sidebarHover: 'hover:bg-green-700',
    accent: 'text-green-600',
  },
  blue: {
    primary: 'bg-blue-600',
    primaryHover: 'hover:bg-blue-700',
    primaryLight: 'bg-blue-50',
    sidebar: 'bg-gradient-to-b from-blue-800 to-blue-900',
    sidebarText: 'text-blue-100',
    sidebarHover: 'hover:bg-blue-700',
    accent: 'text-blue-600',
  },
  purple: {
    primary: 'bg-purple-600',
    primaryHover: 'hover:bg-purple-700',
    primaryLight: 'bg-purple-50',
    sidebar: 'bg-gradient-to-b from-purple-800 to-purple-900',
    sidebarText: 'text-purple-100',
    sidebarHover: 'hover:bg-purple-700',
    accent: 'text-purple-600',
  },
  orange: {
    primary: 'bg-orange-600',
    primaryHover: 'hover:bg-orange-700',
    primaryLight: 'bg-orange-50',
    sidebar: 'bg-gradient-to-b from-orange-700 to-orange-800',
    sidebarText: 'text-orange-100',
    sidebarHover: 'hover:bg-orange-600',
    accent: 'text-orange-600',
  },
  dark: {
    primary: 'bg-gray-700',
    primaryHover: 'hover:bg-gray-800',
    primaryLight: 'bg-gray-100',
    sidebar: 'bg-gradient-to-b from-gray-800 to-gray-900',
    sidebarText: 'text-gray-100',
    sidebarHover: 'hover:bg-gray-700',
    accent: 'text-gray-700',
  },
};

// Day Mode: Light, bright, professional
const dayMode: ModeColors = {
  bg: 'bg-white',
  bgSecondary: 'bg-gray-50',
  text: 'text-gray-900',
  textSecondary: 'text-gray-700', // Improved contrast
  border: 'border-gray-300', // Better visibility
  card: 'bg-white',
  header: 'bg-white border-b-2 border-gray-300',
  hover: 'hover:bg-gray-100',
};

// Night Mode: Dark, eye-friendly, modern
const nightMode: ModeColors = {
  bg: 'bg-slate-900',
  bgSecondary: 'bg-slate-800',
  text: 'text-slate-50',
  textSecondary: 'text-slate-100', // Improved contrast
  border: 'border-slate-600', // Better visibility
  card: 'bg-slate-800',
  header: 'bg-slate-800 border-b-2 border-slate-600',
  hover: 'hover:bg-slate-600', // Better hover visibility
};

interface ThemeContextType {
  theme: ThemeName;
  mode: ModeType;
  colors: ThemeColors;
  modeColors: ModeColors;
  setTheme: (theme: ThemeName) => void;
  setMode: (mode: ModeType) => void;
  availableThemes: ThemeName[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const saved = localStorage.getItem('hkm_theme');
    return (saved as ThemeName) || 'green';
  });

  const [mode, setModeState] = useState<ModeType>(() => {
    const saved = localStorage.getItem('hkm_mode');
    return (saved as ModeType) || 'day';
  });

  const setTheme = (newTheme: ThemeName) => {
    setThemeState(newTheme);
    localStorage.setItem('hkm_theme', newTheme);
  };

  const setMode = (newMode: ModeType) => {
    setModeState(newMode);
    localStorage.setItem('hkm_mode', newMode);
  };

  useEffect(() => {
    // Apply theme and mode to document for global styles
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-mode', mode);
    // Apply to body for full page dark mode
    if (mode === 'night') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [theme, mode]);

  const modeColors = mode === 'night' ? nightMode : dayMode;

  const value: ThemeContextType = {
    theme,
    mode,
    colors: themes[theme],
    modeColors,
    setTheme,
    setMode,
    availableThemes: Object.keys(themes) as ThemeName[],
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
