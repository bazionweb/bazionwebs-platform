import React, { useState } from 'react';
import { FollowUp } from './visitorData';
import { XCircleIcon, CalendarIcon } from './Icons';
import { SelectField, TextAreaField, InputField } from './FormControls';

interface AddFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (followUpData: Omit<FollowUp, 'id' | 'visitorId'>) => void;
}

const interactionTypes: FollowUp['interactionType'][] = ['Phone Call', 'Home Visit', 'Text Message', 'Email'];

const AddFollowUpModal: React.FC<AddFollowUpModalProps> = ({ isOpen, onClose, onSave }) => {
  const [formState, setFormState] = useState({
    date: new Date().toISOString().split('T')[0],
    interactionType: 'Phone Call' as FollowUp['interactionType'],
    notes: '',
    outcome: '',
    nextFollowUpDate: '',
  });

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.date || !formState.interactionType || !formState.notes) {
      alert('Please fill in Date, Interaction Type, and Notes.');
      return;
    }
    onSave(formState);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg m-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <CalendarIcon className="h-6 w-6 mr-2 text-yellow-500" />
            Add Follow-up Record
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircleIcon className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                name="date"
                label="Interaction Date"
                type="date"
                value={formState.date}
                onChange={handleChange}
                required
              />
              <SelectField
                name="interactionType"
                label="Interaction Type"
                options={interactionTypes}
                value={formState.interactionType}
                onChange={handleChange}
                required
              />
            </div>
            <TextAreaField
              name="notes"
              label="Notes"
              placeholder="Describe the interaction..."
              value={formState.notes}
              onChange={handleChange}
              required
            />
            <InputField
              name="outcome"
              label="Outcome"
              type="text"
              placeholder="e.g., Positive response, scheduled another call"
              value={formState.outcome}
              onChange={handleChange}
            />
            <InputField
              name="nextFollowUpDate"
              label="Next Follow-up Date (Optional)"
              type="date"
              value={formState.nextFollowUpDate}
              onChange={handleChange}
            />
          </div>
          <div className="bg-gray-50 p-4 rounded-b-lg flex justify-end items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg"
            >
              Save Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddFollowUpModal;
