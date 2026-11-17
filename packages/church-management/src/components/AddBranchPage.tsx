import React, { useState, useEffect } from 'react';
import { Branch, BranchPastor, BranchGivingRecord } from './branchData';
import { AvatarTransform } from './memberData';
import AvatarEditor, { TransformedAvatar } from './AvatarEditor';
import {
  ArrowLeftIcon,
  UserIcon,
  MailIcon,
  PhoneIcon,
  LocationMarkerIcon,
  CameraIcon,
  CheckCircleIcon,
  PlusIcon,
  TrashIcon,
  CalendarIcon,
} from './Icons';
import { InputField, SelectField } from './FormControls';
import { Building2, Users, DollarSign, CheckCircle, AlertTriangle } from 'lucide-react';
import { Settings2 } from 'lucide-react';

interface AddBranchPageProps {
  onBack: () => void;
  onSave: (branch: Partial<Branch>) => void;
  branchToEdit: Branch | null;
}

const givingTypes = ['Tithe', 'Offering', 'Special Seed', 'Building Fund', 'Missions', 'Other'];

const AddBranchPage: React.FC<AddBranchPageProps> = ({ onBack, onSave, branchToEdit }) => {
  const isEditMode = !!branchToEdit;

  const [branchName, setBranchName] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchEmail, setBranchEmail] = useState('');
  const [establishedDate, setEstablishedDate] = useState('');

  const [pastor, setPastor] = useState<BranchPastor>({
    name: '',
    email: '',
    phone: '',
    gender: 'Male',
    maritalStatus: 'Single',
    avatar: '',
    title: 'Senior Pastor',
  });

  const [memberCount, setMemberCount] = useState({ male: 0, female: 0, total: 0 });
  const [givingRecords, setGivingRecords] = useState<BranchGivingRecord[]>([]);
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingBranchData, setPendingBranchData] = useState<Partial<Branch> | null>(null);

  // New giving record form
  const [newGiving, setNewGiving] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Tithe',
    amount: '',
    description: '',
  });

  useEffect(() => {
    if (isEditMode && branchToEdit) {
      setBranchName(branchToEdit.name);
      setLocation(branchToEdit.location);
      setAddress(branchToEdit.address || '');
      setBranchPhone(branchToEdit.phone || '');
      setBranchEmail(branchToEdit.email || '');
      setEstablishedDate(branchToEdit.establishedDate || '');
      setPastor(branchToEdit.pastor);
      setMemberCount(branchToEdit.memberCount);
      setGivingRecords(branchToEdit.givingRecords);
    }
  }, [branchToEdit, isEditMode]);

  useEffect(() => {
    setMemberCount((prev) => ({ ...prev, total: prev.male + prev.female }));
  }, [memberCount.male, memberCount.female]);

  const handlePastorChange = (field: keyof BranchPastor, value: string) => {
    setPastor((prev) => ({ ...prev, [field]: value }));
  };

  const handlePastorImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPastor((prev) => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleAvatarTransformSave = (croppedImageUrl: string, transform: AvatarTransform) => {
    setPastor((prev) => ({ ...prev, avatar: croppedImageUrl, avatarTransform: transform }));
    setShowAvatarEditor(false);
  };

  const handleAddGivingRecord = () => {
    if (!newGiving.amount || parseFloat(newGiving.amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const record: BranchGivingRecord = {
      id: Date.now().toString(),
      date: newGiving.date,
      type: newGiving.type as BranchGivingRecord['type'],
      amount: parseFloat(newGiving.amount),
      description: newGiving.description,
    };

    setGivingRecords((prev) => [record, ...prev]);
    setNewGiving({
      date: new Date().toISOString().split('T')[0],
      type: 'Tithe',
      amount: '',
      description: '',
    });
  };

  const handleRemoveGivingRecord = (id: string) => {
    setGivingRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!branchName || !location || !pastor.name || !pastor.email || !pastor.phone) {
      alert('Please fill in all required fields (Branch Name, Location, Pastor Name, Email, Phone)');
      return;
    }

    const branchData: Partial<Branch> = {
      name: branchName,
      location,
      address,
      phone: branchPhone,
      email: branchEmail,
      establishedDate,
      pastor,
      memberCount,
      givingRecords,
      isActive: true,
    };

    if (isEditMode && branchToEdit) {
      branchData.id = branchToEdit.id;
    }

    // Store the branch data and show confirmation
    setPendingBranchData(branchData);
    setShowConfirmation(true);
  };

  const handleConfirmSave = () => {
    if (pendingBranchData) {
      onSave(pendingBranchData);
      setShowConfirmation(false);
      setPendingBranchData(null);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setPendingBranchData(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Edit' : 'Add New'} Branch</h1>
        <button onClick={onBack} className="flex items-center text-sm text-green-600 hover:underline font-semibold">
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Branches
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Branch Information */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Building2 className="h-5 w-5 mr-2 text-gray-500" />
            Branch Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <InputField
              name="branchName"
              label="Branch Name *"
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              required
            />
            <InputField
              name="location"
              label="Location/City *"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              icon={LocationMarkerIcon}
              required
            />
            <InputField
              name="address"
              label="Full Address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <InputField
              name="branchPhone"
              label="Branch Phone"
              type="tel"
              value={branchPhone}
              onChange={(e) => setBranchPhone(e.target.value)}
              icon={PhoneIcon}
            />
            <InputField
              name="branchEmail"
              label="Branch Email"
              type="email"
              value={branchEmail}
              onChange={(e) => setBranchEmail(e.target.value)}
              icon={MailIcon}
            />
            <InputField
              name="establishedDate"
              label="Established Date"
              type="date"
              value={establishedDate}
              onChange={(e) => setEstablishedDate(e.target.value)}
              icon={CalendarIcon}
            />
          </div>
        </div>

        {/* Pastor Information */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <UserIcon className="h-5 w-5 mr-2 text-gray-500" />
            Pastor Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <InputField
              name="pastorName"
              label="Pastor Name *"
              type="text"
              value={pastor.name}
              onChange={(e) => handlePastorChange('name', e.target.value)}
              required
            />
            <InputField
              name="pastorEmail"
              label="Email *"
              type="email"
              value={pastor.email}
              onChange={(e) => handlePastorChange('email', e.target.value)}
              icon={MailIcon}
              required
            />
            <InputField
              name="pastorPhone"
              label="Phone *"
              type="tel"
              value={pastor.phone}
              onChange={(e) => handlePastorChange('phone', e.target.value)}
              icon={PhoneIcon}
              required
            />
            <SelectField
              name="pastorGender"
              label="Gender"
              options={['Male', 'Female']}
              value={pastor.gender}
              onChange={(e) => handlePastorChange('gender', e.target.value)}
            />
            <SelectField
              name="pastorMaritalStatus"
              label="Marital Status"
              options={['Single', 'Married', 'Divorced', 'Widowed']}
              value={pastor.maritalStatus}
              onChange={(e) => handlePastorChange('maritalStatus', e.target.value)}
            />
            <InputField
              name="pastorTitle"
              label="Title"
              type="text"
              value={pastor.title || ''}
              onChange={(e) => handlePastorChange('title', e.target.value)}
              placeholder="e.g., Senior Pastor"
            />
          </div>

          {/* Pastor Photo */}
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
              <CameraIcon className="h-4 w-4 mr-2" />
              Pastor Photo
            </h4>
            <div className="flex items-center space-x-4">
              {pastor.avatar ? (
                <div className="relative">
                  <TransformedAvatar
                    src={pastor.avatar}
                    transform={pastor.avatarTransform}
                    className="w-20 h-20 rounded-full border-2 border-gray-200"
                    alt={pastor.name}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAvatarEditor(true)}
                    className="absolute -bottom-1 -right-1 bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded-full shadow-md"
                    title="Adjust photo"
                  >
                    <Settings2 className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <UserIcon className="h-10 w-10 text-gray-400" />
                </div>
              )}
              <div>
                <input
                  type="file"
                  id="pastor-photo"
                  accept="image/*"
                  onChange={handlePastorImageChange}
                  className="hidden"
                />
                <label
                  htmlFor="pastor-photo"
                  className="cursor-pointer bg-white border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-50"
                >
                  Choose Photo
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Member Count */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Users className="h-5 w-5 mr-2 text-gray-500" />
            Member Count
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Male Members</label>
              <input
                type="number"
                min="0"
                value={memberCount.male}
                onChange={(e) => setMemberCount((prev) => ({ ...prev, male: parseInt(e.target.value) || 0 }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Female Members</label>
              <input
                type="number"
                min="0"
                value={memberCount.female}
                onChange={(e) => setMemberCount((prev) => ({ ...prev, female: parseInt(e.target.value) || 0 }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Members</label>
              <input
                type="number"
                value={memberCount.total}
                disabled
                className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-600"
              />
            </div>
          </div>
        </div>

        {/* Giving Records */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <DollarSign className="h-5 w-5 mr-2 text-gray-500" />
            Giving Records
          </h3>

          {/* Add New Record */}
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Add New Record</h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Date</label>
                <input
                  type="date"
                  value={newGiving.date}
                  onChange={(e) => setNewGiving((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Type</label>
                <select
                  value={newGiving.type}
                  onChange={(e) => setNewGiving((prev) => ({ ...prev, type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {givingTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Amount (KSH)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newGiving.amount}
                  onChange={(e) => setNewGiving((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Description</label>
                <input
                  type="text"
                  value={newGiving.description}
                  onChange={(e) => setNewGiving((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleAddGivingRecord}
                className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-1"
              >
                <PlusIcon className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>

          {/* Records List */}
          {givingRecords.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {givingRecords.map((record) => (
                <div key={record.id} className="flex justify-between items-center bg-white border rounded-lg p-3">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">{record.date}</span>
                    <span className="font-medium">{record.type}</span>
                    {record.description && <span className="text-sm text-gray-500">- {record.description}</span>}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-green-600">KSH {record.amount.toLocaleString()}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveGivingRecord(record.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No giving records added yet</p>
          )}
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={onBack}
            className="bg-gray-200 text-gray-700 font-semibold py-2 px-6 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg flex items-center"
          >
            <CheckCircleIcon className="w-5 h-5 mr-2" />
            {isEditMode ? 'Update Branch' : 'Save Branch'}
          </button>
        </div>
      </form>

      {/* Avatar Editor Modal */}
      {showAvatarEditor && pastor.avatar && (
        <AvatarEditor
          imageUrl={pastor.avatar}
          initialTransform={pastor.avatarTransform}
          onSave={handleAvatarTransformSave}
          onCancel={() => setShowAvatarEditor(false)}
        />
      )}

      {/* Confirmation Modal */}
      {showConfirmation && pendingBranchData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="p-4 border-b bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-t-xl">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6" />
                <h2 className="text-lg font-bold">
                  {isEditMode ? 'Confirm Branch Update' : 'Confirm Branch Addition'}
                </h2>
              </div>
              <p className="text-indigo-100 text-sm mt-1">Please review the branch details before saving</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-indigo-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-indigo-800 mb-2">Branch Details:</p>
                    <div className="space-y-1 text-sm text-indigo-700">
                      <p>
                        <strong>Name:</strong> {pendingBranchData.name}
                      </p>
                      <p>
                        <strong>Location:</strong> {pendingBranchData.location}
                      </p>
                      {pendingBranchData.address && (
                        <p>
                          <strong>Address:</strong> {pendingBranchData.address}
                        </p>
                      )}
                      <p>
                        <strong>Pastor:</strong> {pendingBranchData.pastor?.name}
                      </p>
                      <p>
                        <strong>Pastor Email:</strong> {pendingBranchData.pastor?.email}
                      </p>
                      <p>
                        <strong>Pastor Phone:</strong> {pendingBranchData.pastor?.phone}
                      </p>
                      {pendingBranchData.establishedDate && (
                        <p>
                          <strong>Established:</strong>{' '}
                          {new Date(pendingBranchData.establishedDate).toLocaleDateString()}
                        </p>
                      )}
                      <p>
                        <strong>Total Members:</strong> {pendingBranchData.memberCount?.total}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-blue-600" />
                  <p className="text-sm text-blue-700">
                    {isEditMode
                      ? 'This will update the existing branch record.'
                      : 'This will add a new branch to your church network.'}
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
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {isEditMode ? 'Update Branch' : 'Add Branch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddBranchPage;
