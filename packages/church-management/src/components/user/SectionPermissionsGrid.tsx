import React from 'react';
import { AccessibleSection } from '../userData';

interface SectionPermissionsGridProps {
  allAccessibleSections: AccessibleSection[];
  assignedSections: AccessibleSection[];
  onToggleSection: (section: AccessibleSection) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

/**
 * Presentational grid component for selecting accessible sections for non-admin users.
 */
const SectionPermissionsGrid: React.FC<SectionPermissionsGridProps> = ({
  allAccessibleSections,
  assignedSections,
  onToggleSection,
  onSelectAll,
  onClearAll,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-md font-semibold text-gray-800">Module & Section Access</h3>
          <p className="text-xs text-gray-500">Select which features and pages this user can view or edit.</p>
        </div>
        <div className="space-x-2">
          <button
            type="button"
            onClick={onSelectAll}
            className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-200 font-medium"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded border border-gray-300 font-medium"
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto p-3 border border-gray-200 rounded-lg bg-gray-50">
        {allAccessibleSections.map((section) => {
          const isSelected = assignedSections.includes(section);
          return (
            <label
              key={section}
              className={`flex items-center p-2 rounded-md border text-xs cursor-pointer select-none transition-colors ${
                isSelected
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-medium'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSection(section)}
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 mr-2 h-3.5 w-3.5"
              />
              <span className="truncate">{section}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default SectionPermissionsGrid;
