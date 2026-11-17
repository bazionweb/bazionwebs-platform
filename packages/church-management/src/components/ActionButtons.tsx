import React from 'react';
import { Edit, Trash2, Eye } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { useConfirmation } from '../hooks/useConfirmation';

interface ActionButtonsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  itemName: string;
  itemType: string;
  itemDetails?: { [key: string]: unknown };
  editLabel?: string;
  deleteLabel?: string;
  viewLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'icon' | 'text' | 'both';
  showConfirmation?: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  onEdit,
  onDelete,
  onView,
  itemName,
  itemType,
  itemDetails,
  editLabel = 'Edit',
  deleteLabel = 'Delete',
  viewLabel = 'View',
  size = 'md',
  variant = 'icon',
  showConfirmation = true,
}) => {
  const {
    isOpen,
    config,
    isLoading,
    showConfirmation: showConfirmationModal,
    hideConfirmation,
    handleConfirm,
  } = useConfirmation();

  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const handleEditClick = () => {
    if (!onEdit) return;

    if (showConfirmation) {
      showConfirmationModal({
        title: `Edit ${itemType}`,
        message: `Are you sure you want to edit this ${itemType.toLowerCase()}?`,
        itemName,
        itemDetails,
        type: 'edit',
        onConfirm: onEdit,
      });
    } else {
      onEdit();
    }
  };

  const handleDeleteClick = () => {
    if (!onDelete) return;

    if (showConfirmation) {
      showConfirmationModal({
        title: `Delete ${itemType}`,
        message: `Are you sure you want to delete this ${itemType.toLowerCase()}?`,
        itemName,
        itemDetails,
        type: 'delete',
        onConfirm: onDelete,
      });
    } else {
      onDelete();
    }
  };

  const renderButton = (onClick: () => void, icon: React.ReactNode, label: string, colorClass: string) => {
    const baseClass = `${sizeClasses[size]} rounded-lg font-medium transition-colors ${colorClass}`;

    if (variant === 'icon') {
      return (
        <button onClick={onClick} className={baseClass} title={label}>
          {icon}
        </button>
      );
    }

    if (variant === 'text') {
      return (
        <button onClick={onClick} className={`${baseClass} px-3 py-2`}>
          {label}
        </button>
      );
    }

    // variant === 'both'
    return (
      <button onClick={onClick} className={`${baseClass} px-3 py-2 flex items-center gap-2`}>
        {icon}
        {label}
      </button>
    );
  };

  return (
    <>
      <div className="flex gap-1">
        {onView &&
          renderButton(onView, <Eye className={iconSizes[size]} />, viewLabel, 'text-blue-600 hover:bg-blue-50')}

        {onEdit &&
          renderButton(
            handleEditClick,
            <Edit className={iconSizes[size]} />,
            editLabel,
            'text-green-600 hover:bg-green-50',
          )}

        {onDelete &&
          renderButton(
            handleDeleteClick,
            <Trash2 className={iconSizes[size]} />,
            deleteLabel,
            'text-red-600 hover:bg-red-50',
          )}
      </div>

      {/* Confirmation Modal */}
      {config && (
        <ConfirmationModal
          isOpen={isOpen}
          onClose={hideConfirmation}
          onConfirm={handleConfirm}
          title={config.title}
          message={config.message}
          itemName={config.itemName}
          itemDetails={config.itemDetails}
          type={config.type}
          isLoading={isLoading}
        />
      )}
    </>
  );
};

export default ActionButtons;
