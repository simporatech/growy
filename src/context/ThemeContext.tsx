import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_PREFERENCES, useAuth } from './AuthContext';

export interface ThemePreset {
  id: string;
  name: string;
  hex: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'mint', name: 'Default Mint', hex: '#97f2cc' },
  { id: 'cyan', name: 'Ocean Cyan', hex: '#38BDF8' },
  { id: 'violet', name: 'Royal Violet', hex: '#A78BFA' },
  { id: 'amber', name: 'Sunset Amber', hex: '#FBBF24' },
  { id: 'rose', name: 'Rose Coral', hex: '#FB7185' },
];

export const DEFAULT_ACCENT_COLOR = DEFAULT_PREFERENCES.accentColor;

interface ThemeContextValue {
  accentColor: string;
  setAccentColor: (hex: string) => void;
  presets: ThemePreset[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function computeContrastForeground(r: number, g: number, b: number): string {
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.52 ? '#1A1A1C' : '#FFFFFF';
}

function applyAccentToRoot(hex: string): void {
  const safeHex = isValidHex(hex) ? hex : DEFAULT_ACCENT_COLOR;
  const [r, g, b] = hexToRgbTuple(safeHex);
  const root = document.documentElement;
  root.style.setProperty('--accent-color', safeHex);
  root.style.setProperty('--accent-rgb', `${r} ${g} ${b}`);
  root.style.setProperty('--accent-foreground', computeContrastForeground(r, g, b));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, updateUserPreferences } = useAuth();
  const [accentColor, setAccentState] = useState<string>(DEFAULT_ACCENT_COLOR);

  // Hydrate from active user's JSON preferences, or reset to default when signed out
  useEffect(() => {
    if (user?.preferences.accentColor && isValidHex(user.preferences.accentColor)) {
      setAccentState(user.preferences.accentColor);
    } else {
      setAccentState(DEFAULT_ACCENT_COLOR);
    }
  }, [user?.id, user?.preferences.accentColor]);

  // Apply CSS custom properties whenever accentColor changes
  useEffect(() => {
    applyAccentToRoot(accentColor);
  }, [accentColor]);

  const setAccentColor = useCallback(
    (hex: string) => {
      if (!isValidHex(hex)) return;
      const normalized = hex.toLowerCase();
      setAccentState(normalized);
      if (user) {
        updateUserPreferences({ accentColor: normalized });
      }
    },
    [user, updateUserPreferences]
  );

  return (
    <ThemeContext.Provider value={{ accentColor, setAccentColor, presets: THEME_PRESETS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
