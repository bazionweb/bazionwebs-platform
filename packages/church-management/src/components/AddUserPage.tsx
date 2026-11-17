import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, AccessibleSection, PermissionLevel } from './userData';
import { AvatarTransform } from './memberData';
import AvatarEditor, { TransformedAvatar } from './AvatarEditor';
import {
  ArrowLeftIcon,
  UserIcon,
  MailIcon,
  LockIcon,
  CheckCircleIcon,
  UsersIcon,
  EyeIcon,
  EyeOffIcon,
  RefreshIcon,
  UserPlusIcon,
  XCircleIcon,
  CameraIcon,
} from './Icons';
import { Settings2 } from 'lucide-react';
import UserConfirmModal from './user/UserConfirmModal';

const allAccessibleSections: AccessibleSection[] = [
  // Members Module
  'Members',
  'Add Member',
  'Member Details',
  'Birthdays',
  'Manage Groups',

  // Attendance Module
  'Attendance',
  'Mark Attendance',
  'Attendance Reports',
  'Attendance Patterns',
  'Department Attendance',
  'All Attendance Records',
  'Compare Periods',

  // Finance Module
  'Finance',
  'Add Transaction',
  'Transactions List',
  'Tithe Tracking',
  'Tithe History',
  'Generate Report',
  'Weekly Reports',
  'Welfare Tracking',

  // Equipment Module
  'Equipment',
  'Add Equipment',
  'Equipment Inventory',
  'Add Maintenance',
  'Equipment Reports',

  // Visitors Module
  'Visitors',
  'Add Visitor',
  'Visitor Details',
  'Visitor Management',

  // Branches Module
  'Branches',
  'Add Branch',

  // SMS Module
  'SMS Broadcast',
  'Compose SMS',
  'Send SMS',
  'SMS History',
  'SMS Settings',
  'Send Visitor SMS',
  'AI Generate SMS',
];

interface AddUserPageProps {
  onBack: () => void;
  onSave: (userData: Partial<User>) => void;
  userToEdit: User | null;
}

const userRoles: UserRole[] = ['Super Admin', 'Admin', 'Data Personnel', 'Member', 'Guest'];

const ValidationCriteria: React.FC<{ criteria: { text: string; met: boolean }[] }> = ({ criteria }) => (
  <ul className="text-xs text-gray-500 space-y-1 mt-2">
    {criteria.map((item, index) => (
      <li key={index} className="flex items-center">
        {item.met ? (
          <CheckCircleIcon className="w-4 h-4 mr-2 text-green-500" />
        ) : (
          <XCircleIcon className="w-4 h-4 mr-2 text-red-400" />
        )}
        <span className={item.met ? 'text-green-600' : 'text-gray-500'}>{item.text}</span>
      </li>
    ))}
  </ul>
);

const AddUserPage: React.FC<AddUserPageProps> = ({ onBack, onSave, userToEdit }) => {
  const isEditMode = !!userToEdit;

  const [formState, setFormState] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Data Personnel' as UserRole,
    permissionLevel: 'Editor' as PermissionLevel,
    avatar: '',
    avatarTransform: undefined as AvatarTransform | undefined,
    assignedSections: [] as AccessibleSection[],
  });

  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingUserData, setPendingUserData] = useState<Partial<User> | null>(null);

  const [validation, setValidation] = useState({
    minLength: false,
    hasUpper: false,
    hasNumber: false,
    hasSpecial: false,
    passwordsMatch: false,
  });

  useEffect(() => {
    if (isEditMode && userToEdit) {
      setFormState({
        username: userToEdit.username,
        email: userToEdit.email,
        role: userToEdit.role,
        permissionLevel: userToEdit.permissionLevel || 'Editor',
        password: '',
        confirmPassword: '',
        avatar: userToEdit.avatar,
        avatarTransform: userToEdit.avatarTransform,
        assignedSections: userToEdit.assignedSections || [],
      });
    } else {
      setFormState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'Data Personnel',
        permissionLevel: 'Editor',
        avatar: '',
        avatarTransform: undefined,
        assignedSections: [],
      });
    }
  }, [userToEdit, isEditMode]);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const { password, confirmPassword } = formState;
    const minLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const passwordsMatch = password !== '' && password === confirmPassword;

    setValidation({ minLength, hasUpper, hasNumber, hasSpecial, passwordsMatch });
  }, [formState.password, formState.confirmPassword]);

  const isPasswordSectionValid = useMemo(() => {
    if (isEditMode && !formState.password && !formState.confirmPassword) {
      return true; // Passwords are optional in edit mode if left blank
    }
    return (
      validation.minLength &&
      validation.hasUpper &&
      validation.hasNumber &&
      validation.hasSpecial &&
      validation.passwordsMatch
    );
  }, [validation, isEditMode, formState.password, formState.confirmPassword]);

  const isFormFullyValid = useMemo(() => {
    return formState.username && formState.email && isPasswordSectionValid;
  }, [formState.username, formState.email, isPasswordSectionValid]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormState((prev) => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReset = () => {
    if (userToEdit) {
      setFormState({
        username: userToEdit.username,
        email: userToEdit.email,
        role: userToEdit.role,
        permissionLevel: userToEdit.permissionLevel || 'Editor',
        password: '',
        confirmPassword: '',
        avatar: userToEdit.avatar,
        avatarTransform: userToEdit.avatarTransform,
        assignedSections: userToEdit.assignedSections || [],
      });
    } else {
      setFormState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'Data Personnel',
        permissionLevel: 'Editor',
        avatar: '',
        avatarTransform: undefined,
        assignedSections: [],
      });
    }
  };

  const handleAvatarTransformSave = (croppedImageUrl: string, transform: AvatarTransform) => {
    setFormState((prev) => ({ ...prev, avatar: croppedImageUrl, avatarTransform: transform }));
    setShowAvatarEditor(false);
  };

  const handleToggleSection = (section: AccessibleSection) => {
    setFormState((prev) => ({
      ...prev,
      assignedSections: prev.assignedSections.includes(section)
        ? prev.assignedSections.filter((s) => s !== section)
        : [...prev.assignedSections, section],
    }));
  };

  const handleSelectAllSections = () => {
    setFormState((prev) => ({ ...prev, assignedSections: [...allAccessibleSections] }));
  };

  const handleClearAllSections = () => {
    setFormState((prev) => ({ ...prev, assignedSections: [] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormFullyValid) {
      alert('Please ensure all fields are correct and password requirements are met.');
      return;
    }

    const dataToSave: Partial<User> = {
      username: formState.username,
      email: formState.email,
      role: formState.role,
      permissionLevel: formState.role === 'Super Admin' ? 'Editor' : formState.permissionLevel,
      avatar: formState.avatar || undefined,
      avatarTransform: formState.avatarTransform,
      assignedSections: ['Super Admin', 'Admin'].includes(formState.role) ? undefined : formState.assignedSections,
    };

    if (isEditMode && userToEdit) {
      dataToSave.id = userToEdit.id;
    }

    // Store the user data and show confirmation
    setPendingUserData(dataToSave);
    setShowConfirmation(true);
  };

  const handleConfirmSave = () => {
    if (pendingUserData) {
      onSave(pendingUserData);
      setShowConfirmation(false);
      setPendingUserData(null);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setPendingUserData(null);
  };

  const passwordCriteria = [
    { text: 'At least 8 characters long', met: validation.minLength },
    { text: 'Contains an uppercase letter', met: validation.hasUpper },
    { text: 'Contains a number', met: validation.hasNumber },
    { text: 'Contains a special character', met: validation.hasSpecial },
    { text: 'Passwords match', met: validation.passwordsMatch },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Edit' : 'Add New'} User</h1>
          <p className="mt-1 text-gray-600">
            {isEditMode ? 'Update user details and permissions.' : 'Create a new system user account.'}
          </p>
        </div>
        <button onClick={onBack} className="flex items-center text-sm text-green-600 hover:underline font-semibold">
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Users
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-green-200 to-green-100 flex items-center">
          <UserIcon className="h-6 w-6 mr-3 text-green-800" />
          <h2 className="text-lg font-bold text-green-800">User Information</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600 flex items-center">
              <UserIcon className="h-4 w-4 mr-2 text-gray-400" />
              Username *
            </label>
            <input
              type="text"
              name="username"
              value={formState.username}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-500">Choose a unique username for this account.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600 flex items-center">
              <MailIcon className="h-4 w-4 mr-2 text-gray-400" />
              Email *
            </label>
            <input
              type="email"
              name="email"
              value={formState.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-500">Enter a valid email address for account recovery.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600 flex items-center">
              <CameraIcon className="h-4 w-4 mr-2 text-gray-400" />
              Profile Picture
            </label>
            <div className="flex items-center space-x-4">
              {formState.avatar ? (
                <div className="relative">
                  <TransformedAvatar
                    src={formState.avatar}
                    transform={formState.avatarTransform}
                    className="w-20 h-20 rounded-full border-2 border-gray-200"
                    alt="Profile Preview"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAvatarEditor(true)}
                    className="absolute -bottom-1 -right-1 bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded-full shadow-md"
                    title="Adjust photo position"
                  >
                    <Settings2 className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <UserIcon className="h-10 w-10 text-gray-400" />
                </div>
              )}
              <div className="flex-1">
                <div className="border border-gray-300 rounded-lg px-3 py-2">
                  <input
                    type="file"
                    id="file-upload"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="sr-only"
                  />
                  <label htmlFor="file-upload" className="w-full flex items-center cursor-pointer">
                    <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-200 text-sm font-medium">
                      Choose file
                    </span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Upload a profile picture for this user. Click the gear icon to adjust position.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600 flex items-center">
              <LockIcon className="h-4 w-4 mr-2 text-gray-400" />
              {isEditMode ? 'New Password' : 'Password'} {isEditMode ? '' : '*'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formState.password}
                onChange={handleChange}
                required={!isEditMode}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
              >
                {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {isEditMode ? 'Leave blank to keep the current password.' : 'Password must meet the requirements below.'}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600 flex items-center">
              <CheckCircleIcon className="h-4 w-4 mr-2 text-gray-400" />
              Confirm {isEditMode ? 'New' : ''} Password {formState.password ? '*' : ''}
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formState.confirmPassword}
                onChange={handleChange}
                required={!!formState.password}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
              >
                {showConfirmPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
            {(formState.password || formState.confirmPassword) && <ValidationCriteria criteria={passwordCriteria} />}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600 flex items-center">
              <UsersIcon className="h-4 w-4 mr-2 text-gray-400" />
              User Role
            </label>
            <select
              name="role"
              value={formState.role}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              {userRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">Select the appropriate access level for this user.</p>
          </div>

          {/* Permission Level - Show for all roles except Super Admin */}
          {formState.role !== 'Super Admin' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600 flex items-center">
                <EyeIcon className="h-4 w-4 mr-2 text-gray-400" />
                Permission Level
              </label>
              <select
                name="permissionLevel"
                value={formState.permissionLevel}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="Viewer">Viewer - Can view data only</option>
                <option value="Editor">Editor - Can view and edit data</option>
              </select>
              <p className="text-xs text-gray-500">
                {formState.permissionLevel === 'Viewer'
                  ? 'Viewer access allows reading data but prevents modifications.'
                  : 'Editor access allows both viewing and modifying data.'}
              </p>
            </div>
          )}

          {/* Section Access - Shown for all roles except Super Admin */}
          {['Data Personnel', 'Member', 'Guest'].includes(formState.role) && (
            <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg mt-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-blue-800 flex items-center">
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  Assigned Services / Sections (Role Access Restrictions)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllSections}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-gray-400">|</span>
                  <button
                    type="button"
                    onClick={handleClearAllSections}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              <p className="text-xs text-blue-600">
                Select which sections this user is explicitly allowed to access. Unchecked sections will be hidden.
              </p>

              {/* Members Module */}
              <div className="mb-3">
                <h4 className="text-xs font-medium text-blue-800 mb-2 flex items-center">👥 Members Module</h4>
                <div className="grid grid-cols-2 gap-2 pl-3">
                  {['Members', 'Add Member', 'Member Details', 'Birthdays', 'Manage Groups'].map((section) => (
                    <label
                      key={section}
                      className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                        formState.assignedSections.includes(section as AccessibleSection)
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formState.assignedSections.includes(section as AccessibleSection)}
                        onChange={() => handleToggleSection(section as AccessibleSection)}
                        className="w-3 h-3 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-xs font-medium text-gray-700">{section}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Attendance Module */}
              <div className="mb-3">
                <h4 className="text-xs font-medium text-blue-800 mb-2 flex items-center">📊 Attendance Module</h4>
                <div className="grid grid-cols-2 gap-2 pl-3">
                  {[
                    'Attendance',
                    'Mark Attendance',
                    'Attendance Reports',
                    'Attendance Patterns',
                    'Department Attendance',
                    'All Attendance Records',
                    'Compare Periods',
                  ].map((section) => (
                    <label
                      key={section}
                      className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                        formState.assignedSections.includes(section as AccessibleSection)
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formState.assignedSections.includes(section as AccessibleSection)}
                        onChange={() => handleToggleSection(section as AccessibleSection)}
                        className="w-3 h-3 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-xs font-medium text-gray-700">{section}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Finance Module */}
              <div className="mb-3">
                <h4 className="text-xs font-medium text-blue-800 mb-2 flex items-center">💰 Finance Module</h4>
                <div className="grid grid-cols-2 gap-2 pl-3">
                  {[
                    'Finance',
                    'Add Transaction',
                    'Transactions List',
                    'Tithe Tracking',
                    'Tithe History',
                    'Generate Report',
                    'Weekly Reports',
                    'Welfare Tracking',
                  ].map((section) => (
                    <label
                      key={section}
                      className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                        formState.assignedSections.includes(section as AccessibleSection)
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formState.assignedSections.includes(section as AccessibleSection)}
                        onChange={() => handleToggleSection(section as AccessibleSection)}
                        className="w-3 h-3 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-xs font-medium text-gray-700">{section}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Equipment Module */}
              <div className="mb-3">
                <h4 className="text-xs font-medium text-blue-800 mb-2 flex items-center">🔧 Equipment Module</h4>
                <div className="grid grid-cols-2 gap-2 pl-3">
                  {['Equipment', 'Add Equipment', 'Equipment Inventory', 'Add Maintenance', 'Equipment Reports'].map(
                    (section) => (
                      <label
                        key={section}
                        className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                          formState.assignedSections.includes(section as AccessibleSection)
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formState.assignedSections.includes(section as AccessibleSection)}
                          onChange={() => handleToggleSection(section as AccessibleSection)}
                          className="w-3 h-3 text-green-600 rounded focus:ring-green-500"
                        />
                        <span className="text-xs font-medium text-gray-700">{section}</span>
                      </label>
                    ),
                  )}
                </div>
              </div>

              {/* Visitors Module */}
              <div className="mb-3">
                <h4 className="text-xs font-medium text-blue-800 mb-2 flex items-center">👋 Visitors Module</h4>
                <div className="grid grid-cols-2 gap-2 pl-3">
                  {['Visitors', 'Add Visitor', 'Visitor Details', 'Visitor Management'].map((section) => (
                    <label
                      key={section}
                      className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                        formState.assignedSections.includes(section as AccessibleSection)
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formState.assignedSections.includes(section as AccessibleSection)}
                        onChange={() => handleToggleSection(section as AccessibleSection)}
                        className="w-3 h-3 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-xs font-medium text-gray-700">{section}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Branches Module */}
              <div className="mb-3">
                <h4 className="text-xs font-medium text-blue-800 mb-2 flex items-center">🏢 Branches Module</h4>
                <div className="grid grid-cols-2 gap-2 pl-3">
                  {['Branches', 'Add Branch'].map((section) => (
                    <label
                      key={section}
                      className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                        formState.assignedSections.includes(section as AccessibleSection)
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formState.assignedSections.includes(section as AccessibleSection)}
                        onChange={() => handleToggleSection(section as AccessibleSection)}
                        className="w-3 h-3 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-xs font-medium text-gray-700">{section}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* SMS Module */}
              <div className="mb-3">
                <h4 className="text-xs font-medium text-blue-800 mb-2 flex items-center">📱 SMS Module</h4>
                <div className="grid grid-cols-2 gap-2 pl-3">
                  {[
                    'SMS Broadcast',
                    'Compose SMS',
                    'Send SMS',
                    'SMS History',
                    'SMS Settings',
                    'Send Visitor SMS',
                    'AI Generate SMS',
                  ].map((section) => (
                    <label
                      key={section}
                      className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                        formState.assignedSections.includes(section as AccessibleSection)
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formState.assignedSections.includes(section as AccessibleSection)}
                        onChange={() => handleToggleSection(section as AccessibleSection)}
                        className="w-3 h-3 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-xs font-medium text-gray-700">{section}</span>
                    </label>
                  ))}
                </div>
              </div>
              {formState.assignedSections.length === 0 && (
                <p className="text-xs text-orange-600 mt-2">
                  ⚠️ No sections assigned. This user will only have access to Dashboard and Settings.
                </p>
              )}
            </div>
          )}

          {['Super Admin', 'Admin'].includes(formState.role) && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>{formState.role}</strong> users have access to all sections of the system.
              </p>
            </div>
          )}

          <div className="flex justify-between items-center pt-5 border-t">
            <p className="text-xs text-gray-500">All fields marked with * are required.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="bg-gray-100 text-gray-700 font-semibold py-2 px-4 rounded-lg flex items-center hover:bg-gray-200"
              >
                <RefreshIcon className="h-4 w-4 mr-2" />
                Reset Form
              </button>
              <button
                type="submit"
                disabled={!isFormFullyValid}
                className="bg-church-green-dark hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <UserPlusIcon className="h-5 w-5 mr-2" />
                {isEditMode ? 'Update User' : 'Save User'}
              </button>
            </div>
          </div>
        </form>
      </div>
      <footer className="text-center text-sm text-gray-500 mt-8">
        © {new Date().getFullYear()} All rights reserved. Church Management System
      </footer>

      {/* Avatar Editor Modal */}
      {showAvatarEditor && formState.avatar && (
        <AvatarEditor
          imageUrl={formState.avatar}
          initialTransform={formState.avatarTransform}
          onSave={handleAvatarTransformSave}
          onCancel={() => setShowAvatarEditor(false)}
        />
      )}

      {/* Confirmation Modal */}
      {showConfirmation && pendingUserData && (
        <UserConfirmModal
          pendingUserData={pendingUserData}
          isEditMode={isEditMode}
          onConfirm={handleConfirmSave}
          onCancel={handleCancelConfirmation}
        />
      )}
    </div>
  );
};

export default AddUserPage;
