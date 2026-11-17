import React from 'react';
import { useTheme } from './ThemeContext';

interface ThemeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'light';
  children: React.ReactNode;
  className?: string;
}

export const ThemeButton: React.FC<ThemeButtonProps> = ({
  variant = 'primary',
  children,
  className = '',
  ...props
}) => {
  const { colors } = useTheme();

  const baseClasses = 'font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors';

  let variantClasses = '';

  if (variant === 'primary') {
    variantClasses = `${colors.primary} ${colors.primaryHover} text-white`;
  } else if (variant === 'secondary') {
    variantClasses = `${colors.primaryLight} ${colors.accent} hover:opacity-80`;
  } else if (variant === 'light') {
    variantClasses = `bg-gray-100 text-gray-700 hover:bg-gray-200`;
  }

  return (
    <button className={`${baseClasses} ${variantClasses} ${className}`} {...props}>
      {children}
    </button>
  );
};

export default ThemeButton;
