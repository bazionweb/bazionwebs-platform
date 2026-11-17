/**
 * BMI UMS - UI Store Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../stores/uiStore';

describe('useUIStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      theme: 'light',
      logo: '/BMI.svg',
      isSidebarOpen: false,
      isAIModalOpen: false,
    });
    document.documentElement.classList.remove('dark');
  });

  describe('initial state', () => {
    it('should have light theme by default', () => {
      expect(useUIStore.getState().theme).toBe('light');
    });

    it('should have sidebar closed by default', () => {
      expect(useUIStore.getState().isSidebarOpen).toBe(false);
    });

    it('should have AI modal closed by default', () => {
      expect(useUIStore.getState().isAIModalOpen).toBe(false);
    });
  });

  describe('setTheme', () => {
    it('should update theme to dark', () => {
      useUIStore.getState().setTheme('dark');
      expect(useUIStore.getState().theme).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should update theme to light and remove dark class', () => {
      useUIStore.getState().setTheme('dark');
      useUIStore.getState().setTheme('light');
      expect(useUIStore.getState().theme).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from light to dark', () => {
      useUIStore.getState().toggleTheme();
      expect(useUIStore.getState().theme).toBe('dark');
    });

    it('should toggle from dark to light', () => {
      useUIStore.getState().setTheme('dark');
      useUIStore.getState().toggleTheme();
      expect(useUIStore.getState().theme).toBe('light');
    });
  });

  describe('sidebar', () => {
    it('should open sidebar', () => {
      useUIStore.getState().openSidebar();
      expect(useUIStore.getState().isSidebarOpen).toBe(true);
    });

    it('should close sidebar', () => {
      useUIStore.getState().openSidebar();
      useUIStore.getState().closeSidebar();
      expect(useUIStore.getState().isSidebarOpen).toBe(false);
    });
  });

  describe('AI modal', () => {
    it('should open AI modal', () => {
      useUIStore.getState().openAIModal();
      expect(useUIStore.getState().isAIModalOpen).toBe(true);
    });

    it('should close AI modal', () => {
      useUIStore.getState().openAIModal();
      useUIStore.getState().closeAIModal();
      expect(useUIStore.getState().isAIModalOpen).toBe(false);
    });
  });
});









