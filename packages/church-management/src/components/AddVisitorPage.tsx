import React, { useState, useEffect } from 'react';
import { Visitor } from './visitorData';
import { ArrowLeftIcon, UserPlusIcon } from './Icons';
import { InputField, SelectField } from './FormControls';
import { CheckCircle, AlertTriangle, Users } from 'lucide-react';

interface AddVisitorPageProps {
  onBack: () => void;
  onSave: (visitorData: Omit<Visitor, 'id' | 'initials' | 'registeredDate' | 'followUps'> | Visitor) => void;
  visitorToEdit: Visitor | null;
}

const AddVisitorPage: React.FC<AddVisitorPageProps> = ({ onBack, onSave, visitorToEdit }) => {
  const isEditMode = !!visitorToEdit;

  const [formState, setFormState] = useState({
    name: '',
    phone: '',
    email: '',
    heardFrom: '',
    firstVisit: new Date().toISOString().split('T')[0],
    status: 'New' as Visitor['status'],
  });

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingVisitorData, setPendingVisitorData] = useState<Omit<
    Visitor,
    'id' | 'initials' | 'registeredDate' | 'followUps'
  > | null>(null);

  useEffect(() => {
    if (isEditMode && visitorToEdit) {
      setFormState({
        name: visitorToEdit.name,
        phone: visitorToEdit.phone,
        email: visitorToEdit.email || '',
        heardFrom: visitorToEdit.heardFrom,
        firstVisit: visitorToEdit.firstVisit,
        status: visitorToEdit.status,
      });
    }
  }, [visitorToEdit, isEditMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name || !formState.phone || !formState.firstVisit) {
      alert('Please fill in Name, Phone, and First Visit date.');
      return;
    }

    let visitorData: Omit<Visitor, 'id' | 'initials' | 'registeredDate' | 'followUps'>;

    // When editing, pass the whole form state for merging in the parent
    if (visitorToEdit) {
      visitorData = formState;
    } else {
      // When adding, create a clean object with only the necessary fields
      visitorData = {
        name: formState.name,
        phone: formState.phone,
        email: formState.email,
        heardFrom: formState.heardFrom,
        firstVisit: formState.firstVisit,
        status: 'New', // Always 'New' for a new registration
      };
    }

    // Store the visitor data and show confirmation
    setPendingVisitorData(visitorData);
    setShowConfirmation(true);
  };

  const handleConfirmSave = () => {
    if (pendingVisitorData) {
      onSave(pendingVisitorData);
      setShowConfirmation(false);
      setPendingVisitorData(null);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setPendingVisitorData(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Edit' : 'Register New'} Visitor</h1>
        <button onClick={onBack} className="flex items-center text-sm text-green-600 hover:underline font-semibold">
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Visitors
        </button>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="border-b pb-4 mb-6">
          <p className="flex items-center text-green-700 font-medium">
            <UserPlusIcon className="h-6 w-6 mr-2 p-1 bg-green-100 rounded-full" />
            Please fill in the visitor's details below
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField
              name="name"
              label="Full Name"
              type="text"
              value={formState.name}
              onChange={handleChange}
              required
            />
            <InputField
              name="phone"
              label="Phone Number"
              type="tel"
              value={formState.phone}
              onChange={handleChange}
              required
            />
            <InputField
              name="email"
              label="Email Address (Optional)"
              type="email"
              value={formState.email}
              onChange={handleChange}
            />
            <SelectField
              name="heardFrom"
              label="How did they hear about us?"
              options={['Friend', 'Family', 'Social Media', 'Event', 'Other']}
              value={formState.heardFrom}
              onChange={handleChange}
              required
            />
            <InputField
              name="firstVisit"
              label="First Visit Date"
              type="date"
              value={formState.firstVisit}
              onChange={handleChange}
              required
            />
            {isEditMode && (
              <SelectField
                name="status"
                label="Status"
                options={['New', 'In follow up', 'Converted']}
                value={formState.status}
                onChange={handleChange}
                required
              />
            )}
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
              {isEditMode ? 'Save Changes' : 'Register Visitor'}
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && pendingVisitorData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="p-4 border-b bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-t-xl">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6" />
                <h2 className="text-lg font-bold">
                  {isEditMode ? 'Confirm Visitor Update' : 'Confirm Visitor Registration'}
                </h2>
              </div>
              <p className="text-teal-100 text-sm mt-1">Please review the visitor details before saving</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-teal-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-teal-800 mb-2">Visitor Details:</p>
                    <div className="space-y-1 text-sm text-teal-700">
                      <p>
                        <strong>Name:</strong> {pendingVisitorData.name}
                      </p>
                      <p>
                        <strong>Phone:</strong> {pendingVisitorData.phone}
                      </p>
                      {pendingVisitorData.email && (
                        <p>
                          <strong>Email:</strong> {pendingVisitorData.email}
                        </p>
                      )}
                      <p>
                        <strong>Heard From:</strong> {pendingVisitorData.heardFrom}
                      </p>
                      <p>
                        <strong>First Visit:</strong> {new Date(pendingVisitorData.firstVisit).toLocaleDateString()}
                      </p>
                      {isEditMode && (
                        <p>
                          <strong>Status:</strong> {pendingVisitorData.status}
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
                      ? 'This will update the existing visitor record.'
                      : 'This will register a new visitor in your system.'}
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
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {isEditMode ? 'Update Visitor' : 'Register Visitor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddVisitorPage;
