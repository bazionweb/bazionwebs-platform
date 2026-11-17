import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircleIcon, XCircleIcon, ExclamationIcon, BellIcon } from './Icons';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000); // Auto remove after 3 seconds
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center p-4 mb-2 rounded-lg shadow-lg text-white min-w-[300px] transform transition-all duration-300 animate-fade-in-up ${
              toast.type === 'success'
                ? 'bg-green-600'
                : toast.type === 'error'
                  ? 'bg-red-600'
                  : toast.type === 'warning'
                    ? 'bg-yellow-500'
                    : 'bg-blue-600'
            }`}
            onClick={() => removeToast(toast.id)}
          >
            <div className="mr-3">
              {toast.type === 'success' && <CheckCircleIcon className="w-6 h-6" />}
              {toast.type === 'error' && <XCircleIcon className="w-6 h-6" />}
              {toast.type === 'warning' && <ExclamationIcon className="w-6 h-6" />}
              {toast.type === 'info' && <BellIcon className="w-6 h-6" />}
            </div>
            <div className="flex-1 font-medium">{toast.message}</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              className="ml-4 text-white hover:text-gray-200"
            >
              <XCircleIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
