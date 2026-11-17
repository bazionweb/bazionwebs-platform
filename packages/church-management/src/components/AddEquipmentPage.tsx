import React, { useState, useEffect } from 'react';
import { Equipment, EquipmentCondition, equipmentCategories } from './equipmentData';
import { ArrowLeftIcon, EquipmentIcon } from './Icons';
import { InputField, SelectField, TextAreaField } from './FormControls';
import { CheckCircle, AlertTriangle } from 'lucide-react';

interface AddEquipmentPageProps {
  onBack: () => void;
  onSave: (equipment: Omit<Equipment, 'id'> | Equipment) => void;
  equipmentToEdit: Equipment | null;
}

const AddEquipmentPage: React.FC<AddEquipmentPageProps> = ({ onBack, onSave, equipmentToEdit }) => {
  const isEditMode = !!equipmentToEdit;

  const [formState, setFormState] = useState({
    name: '',
    category: '',
    purchaseDate: '',
    purchasePrice: '',
    condition: 'Good' as EquipmentCondition,
    location: '',
    description: '',
  });

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingEquipmentData, setPendingEquipmentData] = useState<
    (Omit<typeof formState, 'purchasePrice'> & { purchasePrice?: number } & { id?: number }) | null
  >(null);

  useEffect(() => {
    if (isEditMode) {
      setFormState({
        name: equipmentToEdit.name,
        category: equipmentToEdit.category,
        purchaseDate: equipmentToEdit.purchaseDate || '',
        purchasePrice: equipmentToEdit.purchasePrice?.toString() || '',
        condition: equipmentToEdit.condition,
        location: equipmentToEdit.location || '',
        description: equipmentToEdit.description || '',
      });
    }
  }, [equipmentToEdit, isEditMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name || !formState.category) {
      alert('Please fill in Equipment Name and Category.');
      return;
    }

    const equipmentData = {
      ...formState,
      purchasePrice: formState.purchasePrice ? parseFloat(formState.purchasePrice) : undefined,
    };

    // Store the equipment data and show confirmation
    if (isEditMode) {
      setPendingEquipmentData({ ...equipmentData, id: equipmentToEdit.id });
    } else {
      setPendingEquipmentData(equipmentData);
    }
    setShowConfirmation(true);
  };

  const handleConfirmSave = () => {
    if (pendingEquipmentData) {
      onSave(pendingEquipmentData);
      setShowConfirmation(false);
      setPendingEquipmentData(null);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setPendingEquipmentData(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Edit' : 'Add'} Equipment</h1>
        <button onClick={onBack} className="flex items-center text-sm text-green-600 hover:underline font-semibold">
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Equipment
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 pb-4 mb-6">
          <p className="flex items-center text-green-700 font-medium">
            <EquipmentIcon className="h-6 w-6 mr-2 p-1 bg-green-100 rounded-full" />
            Record a new equipment item for HKM Ministries
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-800">Equipment Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField
              name="name"
              label="Equipment Name"
              type="text"
              value={formState.name}
              onChange={handleChange}
              required
            />
            <SelectField
              name="category"
              label="Category"
              options={equipmentCategories}
              value={formState.category}
              onChange={handleChange}
              required
            />
            <InputField
              name="purchaseDate"
              label="Purchase Date"
              type="date"
              value={formState.purchaseDate}
              onChange={handleChange}
            />
            <InputField
              name="purchasePrice"
              label="Purchase Price (KSH)"
              type="number"
              value={formState.purchasePrice}
              onChange={handleChange}
            />
            <SelectField
              name="condition"
              label="Condition"
              options={['Excellent', 'Good', 'Fair', 'Needs Attention']}
              value={formState.condition}
              onChange={handleChange}
              required
            />
            <InputField
              name="location"
              label="Location"
              type="text"
              placeholder="e.g. Main Auditorium, Office"
              value={formState.location}
              onChange={handleChange}
            />
          </div>
          <div className="md:col-span-2">
            <TextAreaField
              name="description"
              label="Description"
              placeholder="Enter any additional details about this equipment..."
              value={formState.description}
              onChange={handleChange}
            />
          </div>

          <div className="flex justify-end pt-6 border-t">
            <button
              type="button"
              onClick={onBack}
              className="bg-gray-200 text-gray-700 font-semibold py-2 px-6 rounded-lg mr-4 hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-church-green-dark hover:bg-emerald-700 text-white font-semibold py-2 px-6 rounded-lg"
            >
              {isEditMode ? 'Save Changes' : 'Add Equipment'}
            </button>
          </div>
        </form>
        <footer className="text-center text-sm text-gray-500 mt-8 pt-4 border-t">
          © {new Date().getFullYear()} All rights reserved. Church Management System
        </footer>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && pendingEquipmentData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="p-4 border-b bg-gradient-to-r from-green-600 to-green-700 text-white rounded-t-xl">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6" />
                <h2 className="text-lg font-bold">
                  {isEditMode ? 'Confirm Equipment Update' : 'Confirm Equipment Addition'}
                </h2>
              </div>
              <p className="text-green-100 text-sm mt-1">Please review the equipment details before saving</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <EquipmentIcon className="w-5 h-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800 mb-2">Equipment Details:</p>
                    <div className="space-y-1 text-sm text-green-700">
                      <p>
                        <strong>Name:</strong> {pendingEquipmentData.name}
                      </p>
                      <p>
                        <strong>Category:</strong> {pendingEquipmentData.category}
                      </p>
                      <p>
                        <strong>Condition:</strong> {pendingEquipmentData.condition}
                      </p>
                      {pendingEquipmentData.location && (
                        <p>
                          <strong>Location:</strong> {pendingEquipmentData.location}
                        </p>
                      )}
                      {pendingEquipmentData.purchaseDate && (
                        <p>
                          <strong>Purchase Date:</strong>{' '}
                          {new Date(pendingEquipmentData.purchaseDate).toLocaleDateString()}
                        </p>
                      )}
                      {pendingEquipmentData.purchasePrice && (
                        <p>
                          <strong>Purchase Price:</strong> KSH {pendingEquipmentData.purchasePrice.toLocaleString()}
                        </p>
                      )}
                      {pendingEquipmentData.description && (
                        <p>
                          <strong>Description:</strong> {pendingEquipmentData.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-blue-600" />
                  <p className="text-sm text-blue-700">
                    {isEditMode
                      ? 'This will update the existing equipment record.'
                      : 'This will add a new equipment item to your inventory.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 rounded-b-xl">
              <button
                onClick={handleCancelConfirmation}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {isEditMode ? 'Update Equipment' : 'Add Equipment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddEquipmentPage;
