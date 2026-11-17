import React from 'react';
import { useTheme } from './ThemeContext';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: Array<{
    label: string;
    onClick?: () => void;
  }>;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, icon, actions, breadcrumbs }) => {
  const { modeColors } = useTheme();

  return (
    <div className={`sticky top-0 z-40 ${modeColors.card} border-b ${modeColors.border} shadow-sm`}>
      <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center space-x-1 sm:space-x-2 mb-2 overflow-x-auto scrollbar-hide">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                {index > 0 && <span className={`text-xs sm:text-sm ${modeColors.textSecondary} flex-shrink-0`}>›</span>}
                <button
                  onClick={crumb.onClick}
                  className={`text-xs sm:text-sm whitespace-nowrap ${
                    index === breadcrumbs.length - 1
                      ? `${modeColors.text} font-medium`
                      : `${modeColors.textSecondary} hover:${modeColors.text}`
                  } transition-colors`}
                  disabled={index === breadcrumbs.length - 1}
                >
                  {crumb.label}
                </button>
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Main Header */}
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
            {icon && <div className="flex-shrink-0 text-lg sm:text-xl">{icon}</div>}
            <div className="min-w-0 flex-1">
              <h1 className={`text-lg sm:text-2xl lg:text-3xl font-bold ${modeColors.text} truncate`}>{title}</h1>
              {subtitle && (
                <p className={`mt-1 text-xs sm:text-sm lg:text-base ${modeColors.textSecondary} line-clamp-2`}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          {actions && <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">{actions}</div>}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;
