import React, { useState, useEffect } from 'react';
import {
  ArrowLeftIcon,
  UserPlusIcon,
  UserIcon,
  MailIcon,
  PhoneIcon,
  CalendarIcon,
  LocationMarkerIcon,
  CameraIcon,
  CollectionIcon,
  CheckCircleIcon,
} from './Icons';
import { InputField, SelectField } from './FormControls';
import { Member, AvatarTransform, EmailTier } from './memberData';
import AvatarEditor, { TransformedAvatar } from './AvatarEditor';
import { Settings2, CheckCircle, AlertTriangle } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';
import { useTheme } from './ThemeContext';

interface AddMemberPageProps {
  onBack: () => void;
  onSave: (memberData: Partial<Member>) => void;
  memberToEdit: Member | null;
}

const departments = [
  'Head Pastor',
  'Choir',
  'Media',
  'Ushering',
  'Protocol',
  'Welfare',
  'Intercessors',
  'Junior Youth',
  'Youth',
  'Traffic',
  'Administration',
  'Instrumentalist',
  'Deacon',
  "Pastor's Wife",
  'Sunday School',
  'Pastoral Care',
  'Evangelism',
  'Technical',
  'None',
];
const roles = ['Member', 'Leader'];
const statuses: Member['status'][] = ['Active', 'Inactive', 'Transferred', 'Pending Fee'];
const emailTierOptions: { value: EmailTier; label: string }[] = [
  { value: 'member', label: 'Regular Member' },
  { value: 'leadership', label: 'Leadership' },
];

const AddMemberPage: React.FC<AddMemberPageProps> = ({ onBack, onSave, memberToEdit }) => {
  const { colors } = useTheme();
  const isEditMode = !!memberToEdit;

  const [formState, setFormState] = useState({
    name: '',
    email: '',
    phone: '',
    dob: '',
    gender: '' as Member['gender'] | '',
    maritalStatus: '',
    occupation: '',
    location: '',
    title: '',
    department: '',
    role: 'Member',
    status: 'Pending Fee' as Member['status'],
    email_tier: 'member' as EmailTier,
    avatar: '',
    avatarTransform: undefined as AvatarTransform | undefined,
  });
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingMemberData, setPendingMemberData] = useState<Partial<Member> | null>(null);

  useEffect(() => {
    if (isEditMode && memberToEdit) {
      setFormState({
        name: memberToEdit.name,
        email: memberToEdit.email || '',
        phone: memberToEdit.phone || '',
        dob: memberToEdit.dob,
        gender: memberToEdit.gender,
        maritalStatus: memberToEdit.maritalStatus || '',
        occupation: memberToEdit.occupation || '',
        location: memberToEdit.location || '',
        title: memberToEdit.title,
        department: memberToEdit.department,
        role: memberToEdit.role,
        status: memberToEdit.status,
        email_tier: memberToEdit.email_tier || 'member',
        avatar: memberToEdit.avatar,
        avatarTransform: memberToEdit.avatarTransform,
      });
    }
  }, [memberToEdit, isEditMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file (JPEG, PNG, etc.).');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert('Image size must be under 10MB. Please choose a smaller file.');
        return;
      }

      try {
        const compressedBase64 = await compressImage(file, 600, 600, 0.7);
        setFormState((prev) => ({ ...prev, avatar: compressedBase64 }));
      } catch (error) {
        console.error('Error compressing image:', error);
        alert('Failed to process the image. Please try again.');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { name, gender, ...rest } = formState;
    if (!name || !gender) {
      alert('Please fill in Name and Gender.');
      return;
    }

    const memberData = { name, gender, ...rest };
    setPendingMemberData(memberData);
    setShowConfirmation(true);
  };

  const handleConfirmSave = () => {
    if (pendingMemberData) {
      onSave(pendingMemberData);
      setShowConfirmation(false);
      setPendingMemberData(null);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setPendingMemberData(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Edit' : 'Add New'} Member</h1>
        <button onClick={onBack} className="flex items-center text-sm text-green-600 hover:underline font-semibold">
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Members
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 pb-4 mb-6">
          <p className="flex items-center text-green-700 font-medium">
            <UserPlusIcon className="h-6 w-6 mr-2 p-1 bg-green-100 rounded-full" />
            Please fill in the member details below
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Personal Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <UserIcon className="h-5 w-5 mr-2 text-gray-500" />
              Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <InputField
                name="name"
                label="Full Name"
                type="text"
                value={formState.name}
                onChange={handleChange}
                required
              />
              <InputField
                name="email"
                label="Email Address"
                type="email"
                value={formState.email}
                onChange={handleChange}
                icon={MailIcon}
              />
              <InputField
                name="phone"
                label="Phone Number"
                type="tel"
                value={formState.phone}
                onChange={handleChange}
                icon={PhoneIcon}
              />
              <InputField
                name="dob"
                label="Date of Birth"
                type="date"
                value={formState.dob}
                onChange={handleChange}
                icon={CalendarIcon}
                placeholder="YYYY-MM-DD"
              />
              <SelectField
                name="gender"
                label="Gender"
                options={['Male', 'Female']}
                value={formState.gender}
                onChange={handleChange}
                required
              />
              <SelectField
                name="maritalStatus"
                label="Marital Status"
                options={['Single', 'Married', 'Divorced', 'Widowed']}
                value={formState.maritalStatus}
                onChange={handleChange}
              />
              <InputField
                name="occupation"
                label="Occupation"
                type="text"
                value={formState.occupation}
                onChange={handleChange}
              />
              <InputField
                name="location"
                label="Location/Address"
                type="text"
                value={formState.location}
                onChange={handleChange}
                icon={LocationMarkerIcon}
              />
            </div>
          </div>

          {/* Church Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <CollectionIcon className="h-5 w-5 mr-2 text-gray-500" />
              Church Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <InputField
                name="title"
                label="Title"
                type="text"
                placeholder="e.g., Elder, Deaconess"
                value={formState.title}
                onChange={handleChange}
              />
              <SelectField
                name="department"
                label="Department"
                options={departments}
                value={formState.department}
                onChange={handleChange}
              />
              <SelectField name="role" label="Role" options={roles} value={formState.role} onChange={handleChange} />
              <SelectField
                name="email_tier"
                label="Member Tier"
                options={emailTierOptions.map((o) => o.label)}
                value={emailTierOptions.find((o) => o.value === formState.email_tier)?.label || 'Regular Member'}
                onChange={(e) => {
                  const option = emailTierOptions.find((o) => o.label === e.target.value);
                  setFormState((prev) => ({ ...prev, email_tier: option?.value || 'member' }));
                }}
              />
              <SelectField
                name="status"
                label="Membership Status"
                options={statuses}
                value={formState.status}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Profile Picture */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <CameraIcon className="h-5 w-5 mr-2 text-gray-500" />
              Profile Picture
            </h3>
            <div className="flex items-center space-x-4">
              {formState.avatar ? (
                <div className="relative">
                  <TransformedAvatar
                    src={formState.avatar}
                    transform={formState.avatarTransform}
                    className="w-24 h-24 rounded-full border-2 border-gray-200"
                    alt="Profile Preview"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAvatarEditor(true)}
                    className="absolute -bottom-1 -right-1 bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded-full shadow-md transition-colors"
                    title="Adjust photo position"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <UserIcon className="h-12 w-12 text-gray-400" />
                </div>
              )}
              <div className="flex-1">
                <input type="file" id="file-upload" accept="image/*" onChange={handleImageChange} className="hidden" />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer bg-white border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-50"
                >
                  Choose file
                </label>
                <p className="text-xs text-gray-500 mt-1">Upload a profile picture for this member.</p>
                {formState.avatar && (
                  <button
                    type="button"
                    onClick={() => setShowAvatarEditor(true)}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Settings2 className="w-4 h-4" />
                    Adjust position & zoom
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Avatar Editor Modal */}
          {showAvatarEditor && formState.avatar && (
            <AvatarEditor
              imageUrl={formState.avatar}
              initialTransform={formState.avatarTransform}
              onSave={(croppedImageUrl, transform) => {
                setFormState((prev) => ({
                  ...prev,
                  avatar: croppedImageUrl,
                  avatarTransform: transform,
                }));
                setShowAvatarEditor(false);
              }}
              onCancel={() => setShowAvatarEditor(false)}
            />
          )}

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
              className={`${colors.primary} ${colors.primaryHover} text-white font-semibold py-2 px-6 rounded-lg flex items-center`}
            >
              <CheckCircleIcon className="w-5 h-5 mr-2" />
              {isEditMode ? 'Update Member' : 'Save Member'}
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && pendingMemberData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-xl">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6" />
                <h2 className="text-lg font-bold">
                  {isEditMode ? 'Confirm Member Update' : 'Confirm Member Addition'}
                </h2>
              </div>
              <p className="text-blue-100 text-sm mt-1">Please review the member details before saving</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <UserIcon className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-800 mb-2">Member Details:</p>
                    <div className="space-y-1 text-sm text-blue-700">
                      <p>
                        <strong>Name:</strong> {pendingMemberData.name}
                      </p>
                      {pendingMemberData.email && (
                        <p>
                          <strong>Email:</strong> {pendingMemberData.email}
                        </p>
                      )}
                      {pendingMemberData.phone && (
                        <p>
                          <strong>Phone:</strong> {pendingMemberData.phone}
                        </p>
                      )}
                      <p>
                        <strong>Gender:</strong> {pendingMemberData.gender}
                      </p>
                      {pendingMemberData.dob && (
                        <p>
                          <strong>Date of Birth:</strong> {new Date(pendingMemberData.dob).toLocaleDateString()}
                        </p>
                      )}
                      {pendingMemberData.department && (
                        <p>
                          <strong>Department:</strong> {pendingMemberData.department}
                        </p>
                      )}
                      {pendingMemberData.role && (
                        <p>
                          <strong>Role:</strong> {pendingMemberData.role}
                        </p>
                      )}
                      {pendingMemberData.email_tier && (
                        <p>
                          <strong>Member Tier:</strong>{' '}
                          {pendingMemberData.email_tier === 'leadership' ? 'Leadership' : 'Regular Member'}
                        </p>
                      )}
                      {pendingMemberData.location && (
                        <p>
                          <strong>Location:</strong> {pendingMemberData.location}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-green-600" />
                  <p className="text-sm text-green-700">
                    {isEditMode
                      ? 'This will update the existing member record.'
                      : 'This will add a new member to your church database.'}
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {isEditMode ? 'Update Member' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddMemberPage;
