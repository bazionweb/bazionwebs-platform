import React from 'react';
import { ArrowRight } from '../shims/lucide-react';
import { StatCardProps } from '../types';

const StatCard: React.FC<StatCardProps> = ({ title, value, subText, color, icon, onClick }) => {
  const getStyles = () => {
    switch (color) {
      // Purple Card (Primary)
      case 'purple': return {
        bg: 'bg-gradient-to-br from-[#4B0082] to-[#320064]',
        text: 'text-white',
        iconBg: 'bg-white/20',
        shadow: 'shadow-purple-200 dark:shadow-none'
      };
      // Gold/Amber Card (Accent)
      case 'amber': return {
        bg: 'bg-gradient-to-br from-[#FFD700] to-[#FDB931]',
        text: 'text-[#4B0082]',
        iconBg: 'bg-[#4B0082]/20',
        shadow: 'shadow-yellow-200 dark:shadow-none'
      };
      // Emerald Card
      case 'emerald': return {
        bg: 'bg-white dark:bg-gray-800',
        text: 'text-gray-800 dark:text-white',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
        shadow: 'shadow-gray-200 border border-gray-100 dark:border-gray-700 dark:shadow-none'
      };
      // Blue Card
      case 'blue': return {
        bg: 'bg-white dark:bg-gray-800',
        text: 'text-gray-800 dark:text-white',
        iconBg: 'bg-blue-100 dark:bg-blue-900/30',
        shadow: 'shadow-gray-200 border border-gray-100 dark:border-gray-700 dark:shadow-none'
      };
      default: return { bg: 'bg-gray-500', text: 'text-white', iconBg: 'bg-white/20', shadow: '' };
    }
  };

  const styles = getStyles();
  const isDark = color === 'purple';

  return (
    <div onClick={onClick} className={`rounded-2xl p-6 ${styles.bg} ${styles.text} shadow-lg ${styles.shadow} relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 ${onClick ? 'cursor-pointer' : ''}`}>
        {/* Background decorative circles */}
        <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl transition-transform duration-500 group-hover:scale-150 ${isDark ? 'bg-white/10' : 'bg-[#4B0082]/5'}`}></div>
        
        <div className="flex justify-between items-start mb-4 relative z-10">
            <div className={`p-3 rounded-xl backdrop-blur-sm ${styles.iconBg}`}>
                {icon}
            </div>
        </div>

        <div className="relative z-10">
            <h3 className={`text-xs font-bold uppercase tracking-wider mb-1 ${isDark ? 'opacity-70' : 'text-gray-500 dark:text-gray-400'}`}>{title}</h3>
            <div className="text-3xl font-bold mb-1 tracking-tight">{value}</div>
            <p className={`text-xs ${isDark ? 'opacity-70' : 'text-gray-400 dark:text-gray-500'}`}>{subText}</p>
        </div>

        <div className={`flex justify-end items-center mt-4 pt-3 border-t relative z-10 ${onClick ? 'cursor-pointer hover:underline' : 'opacity-40'} ${isDark ? 'border-white/10' : 'border-gray-100 dark:border-gray-700'}`}>
            <span className="text-xs font-bold mr-1">View Details</span>
            <ArrowRight size={14} />
        </div>
    </div>
  );
};

export default StatCard;








