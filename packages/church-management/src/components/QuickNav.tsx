import React from 'react';
import { useTheme } from './ThemeContext';

interface QuickNavProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

const quickNavItems = [
  { page: 'Dashboard', label: 'Dashboard', icon: '📊' },
  { page: 'Members', label: 'Members', icon: '👥' },
  { page: 'Attendance', label: 'Attendance', icon: '📋' },
  { page: 'Finance', label: 'Finance', icon: '💰' },
  { page: 'SMS Broadcast', label: 'SMS', icon: '📱' },
  { page: 'Equipment', label: 'Equipment', icon: '🔧' },
  { page: 'Visitors', label: 'Visitors', icon: '👋' },
  { page: 'Reports', label: 'Reports', icon: '📈' },
];

const QuickNav: React.FC<QuickNavProps> = ({ activePage, onNavigate }) => {
  const { modeColors } = useTheme();

  return (
    <div className={`${modeColors.card} border-b ${modeColors.border} px-3 sm:px-4 lg:px-6 py-2`}>
      <div className="flex items-center space-x-1 overflow-x-auto scrollbar-hide">
        {quickNavItems.map((item) => (
          <button
            key={item.page}
            onClick={() => onNavigate(item.page)}
            className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
              activePage === item.page
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : `${modeColors.textSecondary} hover:${modeColors.hover} hover:${modeColors.text}`
            }`}
          >
            <span className="text-sm sm:text-base">{item.icon}</span>
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickNav;
