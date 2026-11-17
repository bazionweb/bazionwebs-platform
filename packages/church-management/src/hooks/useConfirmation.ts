import { useState } from 'react';

export interface ConfirmationConfig {
  title: string;
  message: string;
  itemName: string;
  itemDetails?: Record<string, unknown>;
  type: 'edit' | 'delete';
  onConfirm: () => void | Promise<void>;
}

export const useConfirmation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ConfirmationConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const showConfirmation = (confirmationConfig: ConfirmationConfig) => {
    setConfig(confirmationConfig);
    setIsOpen(true);
  };

  const hideConfirmation = () => {
    setIsOpen(false);
    setConfig(null);
    setIsLoading(false);
  };

  const handleConfirm = async () => {
    if (!config) return;

    setIsLoading(true);
    try {
      await config.onConfirm();
      hideConfirmation();
    } catch (error) {
      console.error('Confirmation action failed:', error);
      setIsLoading(false);
      // Don't hide the modal on error, let user try again
    }
  };

  return {
    isOpen,
    config,
    isLoading,
    showConfirmation,
    hideConfirmation,
    handleConfirm,
  };
};

export default useConfirmation;
