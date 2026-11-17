import { create } from '../shims/zustand';

export type DialogVariant = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  detail?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  badgeText?: string;
}

export interface AlertDialogOptions {
  title: string;
  message: string;
  detail?: string;
  confirmText?: string;
  variant?: DialogVariant;
  badgeText?: string;
}

interface DialogState {
  isOpen: boolean;
  isAlertOnly: boolean;
  options: ConfirmDialogOptions | null;
  resolver: ((value: boolean) => void) | null;

  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  alert: (options: AlertDialogOptions) => Promise<void>;
  handleConfirm: () => void;
  handleCancel: () => void;
}

export const useDialogStore = create<DialogState>((set, get) => ({
  isOpen: false,
  isAlertOnly: false,
  options: null,
  resolver: null,

  confirm: (options) => {
    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        isAlertOnly: false,
        options: {
          variant: 'danger',
          confirmText: 'Confirm Action',
          cancelText: 'Cancel',
          badgeText: 'Institutional Security Protocol',
          ...options,
        },
        resolver: resolve,
      });
    });
  },

  alert: (options) => {
    return new Promise<void>((resolve) => {
      set({
        isOpen: true,
        isAlertOnly: true,
        options: {
          variant: 'info',
          confirmText: 'Acknowledge',
          badgeText: 'Institutional Notice',
          ...options,
        },
        resolver: () => resolve(),
      });
    });
  },

  handleConfirm: () => {
    const { resolver } = get();
    if (resolver) resolver(true);
    set({ isOpen: false, options: null, resolver: null, isAlertOnly: false });
  },

  handleCancel: () => {
    const { resolver } = get();
    if (resolver) resolver(false);
    set({ isOpen: false, options: null, resolver: null, isAlertOnly: false });
  },
}));

/**
 * Convenient standalone helper functions for non-hook usage
 */
export const showConfirmDialog = (options: ConfirmDialogOptions) =>
  useDialogStore.getState().confirm(options);

export const showAlertDialog = (options: AlertDialogOptions) =>
  useDialogStore.getState().alert(options);
