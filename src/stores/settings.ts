import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Locale } from '@/data/types';

export type ThemePref = 'light' | 'dark' | 'system';

interface SettingsState {
  theme: ThemePref;
  locale: Locale;
  sound: boolean;
  /** Dependent territories & constituent parts (Greenland, Hong Kong, …). */
  includeTerritories: boolean;
  /** Partially recognised / disputed (Kosovo, Taiwan, Palestine, W. Sahara). */
  includePartial: boolean;
  setTheme: (t: ThemePref) => void;
  setLocale: (l: Locale) => void;
  toggleSound: () => void;
  setIncludeTerritories: (v: boolean) => void;
  setIncludePartial: (v: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      locale: 'uz',
      sound: true,
      includeTerritories: false,
      includePartial: true,
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      toggleSound: () => set((s) => ({ sound: !s.sound })),
      setIncludeTerritories: (includeTerritories) => set({ includeTerritories }),
      setIncludePartial: (includePartial) => set({ includePartial }),
    }),
    { name: 'geomaster-settings', version: 1 },
  ),
);

export function applyTheme(pref: ThemePref) {
  const dark =
    pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}
