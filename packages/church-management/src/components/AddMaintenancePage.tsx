import React, { useState, useEffect } from 'react';
import { MaintenanceRecord, MaintenanceStatus, MaintenanceType } from './maintenanceData';
import { Equipment } from './equipmentData';
import { ArrowLeftIcon, WrenchIcon } from './Icons';
import { InputField, SelectField, TextAreaField } from './FormControls';
import { CheckCircle, AlertTriangle, Wrench } from 'lucide-react';

interface AddMaintenancePageProps {
  onBack: () => void;
  onSave: (record: Omit<MaintenanceRecord, 'id'> | MaintenanceRecord) => void;
  recordToEdit: MaintenanceRecord | null;
  equipment: Equipment[];
}

const maintenanceTypes: MaintenanceType[] = ['Repair', 'Scheduled Check-up', 'Inspection', 'Upgrade', 'Other'];
const maintenanceStatuses: MaintenanceStatus[] = ['Completed', 'In Progress', 'Pending'];

const AddMaintenancePage: React.FC<AddMaintenancePageProps> = ({ onBack, onSave, recordToEdit, equipment }) => {
  const isEditMode = !!recordToEdit;

  const [formState, setFormState] = useState({
    equipmentId: '',
    date: new Date().toISOString().split('T')[0],
    type: 'Repair' as MaintenanceType,
    cost: '',
    status: 'Pending' as MaintenanceStatus,
    description: '',
  });

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingRecordData, setPendingRecordData] = useState<{
    equipmentId: number;
    date: string;
    type: MaintenanceType;
    cost: number;
    status: MaintenanceStatus;
    description: string;
    id?: number;
  } | null>(null);

  useEffect(() => {
    if (isEditMode && recordToEdit) {
      setFormState({
        equipmentId: recordToEdit.equipmentId.toString(),
        date: recordToEdit.date,
        type: recordToEdit.type,
        cost: recordToEdit.cost.toString(),
        status: recordToEdit.status,
        description: recordToEdit.description,
      });
    }
  }, [recordToEdit, isEditMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.equipmentId || !formState.type || !formState.status) {
      alert('Please fill in all required fields.');
      return;
    }

    const recordData = {
      equipmentId: parseInt(formState.equipmentId),
      date: formState.date,
      type: formState.type,
      cost: formState.cost ? parseFloat(formState.cost) : 0,
      status: formState.status,
      description: formState.description,
    };

    // Store the record data and show confirmation
    if (isEditMode) {
      setPendingRecordData({ ...recordData, id: recordToEdit.id });
    } else {
      setPendingRecordData(recordData);
    }
    setShowConfirmation(true);
  };

  const handleConfirmSave = () => {
    if (pendingRecordData) {
      onSave(pendingRecordData);
      setShowConfirmation(false);
      setPendingRecordData(null);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setPendingRecordData(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Edit' : 'Add'} Maintenance Record</h1>
        <button onClick={onBack} className="flex items-center text-sm text-green-600 hover:underline font-semibold">
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Equipment
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 pb-4 mb-6">
          <p className="flex items-center text-green-700 font-medium">
            <WrenchIcon className="h-6 w-6 mr-2 p-1 bg-green-100 rounded-full" />
            Log a new maintenance task for a piece of equipment
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">Equipment</label>
              <select
                name="equipmentId"
                value={formState.equipmentId}
                onChange={handleChange}
                required
                className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="" disabled hidden>
                  Select Equipment
                </option>
                {equipment.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <InputField name="date" label="Date" type="date" value={formState.date} onChange={handleChange} required />
            <SelectField
              name="type"
              label="Maintenance Type"
              options={maintenanceTypes}
              value={formState.type}
              onChange={handleChange}
              required
            />
            <InputField name="cost" label="Cost (KSH)" type="number" value={formState.cost} onChange={handleChange} />
            <SelectField
              name="status"
              label="Status"
              options={maintenanceStatuses}
              value={formState.status}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <TextAreaField
              name="description"
              label="Description"
              placeholder="Describe the maintenance performed or needed..."
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
              {isEditMode ? 'Save Changes' : 'Add Record'}
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && pendingRecordData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="p-4 border-b bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-t-xl">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6" />
                <h2 className="text-lg font-bold">
                  {isEditMode ? 'Confirm Maintenance Update' : 'Confirm Maintenance Record'}
                </h2>
              </div>
              <p className="text-orange-100 text-sm mt-1">Please review the maintenance details before saving</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Wrench className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-800 mb-2">Maintenance Details:</p>
                    <div className="space-y-1 text-sm text-orange-700">
                      <p>
                        <strong>Equipment:</strong>{' '}
                        {equipment.find((e) => e.id === pendingRecordData.equipmentId)?.name}
                      </p>
                      <p>
                        <strong>Type:</strong> {pendingRecordData.type}
                      </p>
                      <p>
                        <strong>Status:</strong> {pendingRecordData.status}
                      </p>
                      <p>
                        <strong>Date:</strong> {new Date(pendingRecordData.date).toLocaleDateString()}
                      </p>
                      {pendingRecordData.cost > 0 && (
                        <p>
                          <strong>Cost:</strong> KSH {pendingRecordData.cost.toLocaleString()}
                        </p>
                      )}
                      {pendingRecordData.description && (
                        <p>
                          <strong>Description:</strong> {pendingRecordData.description}
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
                      ? 'This will update the existing maintenance record.'
                      : 'This will add a new maintenance record to your equipment log.'}
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
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {isEditMode ? 'Update Record' : 'Add Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddMaintenancePage;
