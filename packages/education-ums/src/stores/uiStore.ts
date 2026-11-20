/**
 * BMI UMS - UI Store (Zustand)
 * Centralizes UI-level state: theme, sidebar, modals, logo.
 * Removes these concerns from App.tsx and ViewRenderer.
 */
import { create } from '../shims/zustand';

const STORAGE_KEY = 'bmi_ui_prefs';

function loadPersisted<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw)[key] ?? fallback) : fallback;
  } catch {
    return fallback;
  }
}

function persist(key: string, partial: any) {
  try {
    let current = {};
    const raw = localStorage.getItem(key);
    if (raw) current = JSON.parse(raw);
    localStorage.setItem(key, JSON.stringify({ ...current, ...partial }));
  } catch { /* ignore */ }
}

interface UIState {
  theme: 'light' | 'dark';
  logo: string;
  institutionName: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  tagline: string;
  accreditationLabel: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;
  expandedGroups: string[];
  isAIModalOpen: boolean;
  isNotificationCenterOpen: boolean;

  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setLogo: (logo: string) => void;
  setInstitutionBranding: (branding: {
    logo?: string;
    institutionName?: string;
    shortName?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    tagline?: string;
    accreditationLabel?: string;
    address?: string;
    contactEmail?: string;
    contactPhone?: string;
  }) => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  toggleSidebarCollapse: () => void;
  toggleGroup: (groupId: string) => void;
  expandGroup: (groupId: string) => void;
  openAIModal: () => void;
  closeAIModal: () => void;
  openNotificationCenter: () => void;
  closeNotificationCenter: () => void;
  toggleNotificationCenter: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  theme: loadPersisted<'light' | 'dark'>(STORAGE_KEY, 'light'),
  logo: '/BMI.svg',
  institutionName: 'Bethel Ministries International University',
  shortName: 'BMI University',
  primaryColor: '#0E1D38',
  secondaryColor: '#172A4D',
  accentColor: '#C5A048',
  tagline: 'Excellence in faith and knowledge',
  accreditationLabel: 'Accredited Higher Education',
  address: 'Mukurwe-ini Plaza, Nyeri County, Kenya',
  contactEmail: 'registrar@bmiuniversities.org',
  contactPhone: '+254 721 341 793',
  isSidebarOpen: false,
  isSidebarCollapsed: loadPersisted<boolean>(STORAGE_KEY, false),
  expandedGroups: loadPersisted<string[]>(STORAGE_KEY, []),
  isAIModalOpen: false,
  isNotificationCenterOpen: false,

  setTheme: (theme) => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ theme });
    persist(STORAGE_KEY, { theme });
  },

  toggleTheme: () => {
    const current = get().theme;
    get().setTheme(current === 'dark' ? 'light' : 'dark');
  },

  setLogo: (logo) => set({ logo }),
  setInstitutionBranding: (branding) =>
    set((state) => ({
      logo: branding.logo ?? state.logo,
      institutionName: branding.institutionName ?? state.institutionName,
      shortName: branding.shortName ?? state.shortName,
      primaryColor: branding.primaryColor ?? state.primaryColor,
      secondaryColor: branding.secondaryColor ?? state.secondaryColor,
      accentColor: branding.accentColor ?? state.accentColor,
      tagline: branding.tagline ?? state.tagline,
      accreditationLabel: branding.accreditationLabel ?? state.accreditationLabel,
      address: branding.address ?? state.address,
      contactEmail: branding.contactEmail ?? state.contactEmail,
      contactPhone: branding.contactPhone ?? state.contactPhone,
    })),

  openSidebar: () => set({ isSidebarOpen: true }),
  closeSidebar: () => set({ isSidebarOpen: false }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleSidebarCollapse: () =>
    set((state) => {
      const next = !state.isSidebarCollapsed;
      persist(STORAGE_KEY, { isSidebarCollapsed: next });
      return { isSidebarCollapsed: next };
    }),
  toggleGroup: (groupId) =>
    set((state) => {
      const next = state.expandedGroups.includes(groupId)
        ? state.expandedGroups.filter((g) => g !== groupId)
        : [...state.expandedGroups, groupId];
      persist(STORAGE_KEY, { expandedGroups: next });
      return { expandedGroups: next };
    }),
  expandGroup: (groupId) =>
    set((state) => {
      if (state.expandedGroups.includes(groupId)) return state;
      const next = [...state.expandedGroups, groupId];
      persist(STORAGE_KEY, { expandedGroups: next });
      return { expandedGroups: next };
    }),

  openAIModal: () => set({ isAIModalOpen: true }),
  closeAIModal: () => set({ isAIModalOpen: false }),

  openNotificationCenter: () => set({ isNotificationCenterOpen: true }),
  closeNotificationCenter: () => set({ isNotificationCenterOpen: false }),
  toggleNotificationCenter: () => set((state) => ({ isNotificationCenterOpen: !state.isNotificationCenterOpen })),
}));









