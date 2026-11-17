import React, { useState } from 'react';
import { User, UserRole, AccessibleSection } from './userData';
import { TransformedAvatar } from './AvatarEditor';
import { SearchIcon, PencilIcon, TrashIcon, CheckCircleIcon, XCircleIcon } from './Icons';
import { Shield, ShieldCheck, Users, Save, X } from 'lucide-react';
import { useUserSessions } from '../hooks/useUserSessions';

interface DataPersonnelManagementPageProps {
  users: User[];
  currentUser: User;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (id: string) => void;
}

const roleColors: Record<UserRole, string> = {
  'Super Admin': 'bg-purple-100 text-purple-800',
  Admin: 'bg-blue-100 text-blue-800',
  Member: 'bg-cyan-100 text-cyan-800',
  'Data Personnel': 'bg-green-100 text-green-800',
  Guest: 'bg-gray-100 text-gray-800',
};

const DataPersonnelManagementPage: React.FC<DataPersonnelManagementPageProps> = ({
  users,
  currentUser,
  onUpdateUser,
  onDeleteUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedSections, setSelectedSections] = useState<AccessibleSection[]>([]);
  const [selectedRole, setSelectedRole] = useState<UserRole>('Data Personnel');
  const { sessions } = useUserSessions();

  // Create a map of user emails to their online status
  const onlineUsers = new Set(sessions.filter((session) => session.isActive).map((session) => session.userEmail));

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setSelectedSections(user.assignedSections || []);
    setSelectedRole(user.role);
  };

  const handleSaveUser = () => {
    if (!editingUser) return;

    const updatedUser: User = {
      ...editingUser,
      role: selectedRole,
      assignedSections: ['Super Admin', 'Admin'].includes(selectedRole) ? undefined : selectedSections,
    };

    onUpdateUser(updatedUser);
    setEditingUser(null);
  };

  const handleToggleSection = (section: AccessibleSection) => {
    setSelectedSections((prev) => (prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]));
  };

  const handleDeleteUser = (user: User) => {
    if (user.id === currentUser.id) {
      alert('You cannot delete your own account!');
      return;
    }
    if (user.role === 'Super Admin') {
      alert('Cannot delete Super Admin accounts!');
      return;
    }
    if (confirm(`Are you sure you want to delete ${user.username}?`)) {
      onDeleteUser(user.id);
    }
  };

  const superAdminCount = users.filter((u) => u.role === 'Super Admin').length;
  const adminCount = users.filter((u) => u.role === 'Admin').length;
  const dataPersonnelCount = users.filter((u) => u.role === 'Data Personnel').length;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Data Personnel & User Management</h1>
          <p className="text-gray-500">Manage user roles and section access permissions</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center gap-4">
          <div className="p-3 bg-purple-100 rounded-lg">
            <ShieldCheck className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-700">{superAdminCount}</p>
            <p className="text-sm text-purple-600">Super Admins</p>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-700">{adminCount}</p>
            <p className="text-sm text-blue-600">Admins</p>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <Users className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-green-700">{dataPersonnelCount}</p>
            <p className="text-sm text-green-600">Data Personnel</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned Sections</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredUsers.map((user) => {
              const isOnline = onlineUsers.has(user.email);
              return (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <TransformedAvatar
                          src={user.avatar}
                          transform={user.avatarTransform}
                          className="w-10 h-10 rounded-full"
                          alt={user.username}
                        />
                        {isOnline && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{user.username}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                        {isOnline && <p className="text-xs text-green-600 font-medium">● Online</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {['Data Personnel', 'Member', 'Guest'].includes(user.role) ? (
                      <div className="flex flex-wrap gap-1">
                        {user.assignedSections && user.assignedSections.length > 0 ? (
                          user.assignedSections.map((section) => (
                            <span key={section} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                              {section}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400 text-sm italic">No sections assigned</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm">All sections</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {user.isActive !== false ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircleIcon className="w-4 h-4" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 text-sm">
                        <XCircleIcon className="w-4 h-4" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Edit permissions"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      {user.id !== currentUser.id && user.role !== 'Super Admin' && (
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete user"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="p-8 text-center text-gray-500">No users found matching your search.</div>
        )}
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">Edit User Permissions</h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {/* User Info */}
              <div className="flex items-center gap-4 mb-6 pb-4 border-b">
                <TransformedAvatar
                  src={editingUser.avatar}
                  transform={editingUser.avatarTransform}
                  className="w-16 h-16 rounded-full"
                  alt={editingUser.username}
                />
                <div>
                  <p className="font-semibold text-lg">{editingUser.username}</p>
                  <p className="text-gray-500">{editingUser.email}</p>
                </div>
              </div>

              {/* Role Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">User Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Super Admin', 'Admin', 'Data Personnel', 'Member', 'Guest'] as UserRole[]).map((role) => (
                    <button
                      key={role}
                      onClick={() => setSelectedRole(role)}
                      disabled={
                        role === 'Super Admin' &&
                        editingUser.role !== 'Super Admin' &&
                        currentUser.role !== 'Super Admin'
                      }
                      className={`p-3 rounded-lg border-2 text-center transition-colors ${
                        selectedRole === role ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                      } ${role === 'Super Admin' && editingUser.role !== 'Super Admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className={`text-sm font-medium ${selectedRole === role ? 'text-green-700' : 'text-gray-700'}`}
                      >
                        {role}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section Assignment (only for non-admins) */}
              {['Data Personnel', 'Member', 'Guest'].includes(selectedRole) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Sections</label>
                  <p className="text-xs text-gray-500 mb-3">Select which sections this user can access and manage.</p>

                  {/* Members Module */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-800 mb-2 flex items-center">👥 Members Module</h4>
                    <div className="grid grid-cols-2 gap-2 pl-4">
                      {['Members', 'Add Member', 'Member Details', 'Birthdays', 'Manage Groups'].map((section) => (
                        <label
                          key={section}
                          className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                            selectedSections.includes(section as AccessibleSection)
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSections.includes(section as AccessibleSection)}
                            onChange={() => handleToggleSection(section as AccessibleSection)}
                            className="w-3 h-3 text-green-600 rounded"
                          />
                          <span className="text-xs">{section}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Attendance Module */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-800 mb-2 flex items-center">📊 Attendance Module</h4>
                    <div className="grid grid-cols-2 gap-2 pl-4">
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
                            selectedSections.includes(section as AccessibleSection)
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSections.includes(section as AccessibleSection)}
                            onChange={() => handleToggleSection(section as AccessibleSection)}
                            className="w-3 h-3 text-green-600 rounded"
                          />
                          <span className="text-xs">{section}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Finance Module */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-800 mb-2 flex items-center">💰 Finance Module</h4>
                    <div className="grid grid-cols-2 gap-2 pl-4">
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
                            selectedSections.includes(section as AccessibleSection)
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSections.includes(section as AccessibleSection)}
                            onChange={() => handleToggleSection(section as AccessibleSection)}
                            className="w-3 h-3 text-green-600 rounded"
                          />
                          <span className="text-xs">{section}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Equipment Module */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-800 mb-2 flex items-center">🔧 Equipment Module</h4>
                    <div className="grid grid-cols-2 gap-2 pl-4">
                      {[
                        'Equipment',
                        'Add Equipment',
                        'Equipment Inventory',
                        'Add Maintenance',
                        'Equipment Reports',
                      ].map((section) => (
                        <label
                          key={section}
                          className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                            selectedSections.includes(section as AccessibleSection)
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSections.includes(section as AccessibleSection)}
                            onChange={() => handleToggleSection(section as AccessibleSection)}
                            className="w-3 h-3 text-green-600 rounded"
                          />
                          <span className="text-xs">{section}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Visitors Module */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-800 mb-2 flex items-center">👋 Visitors Module</h4>
                    <div className="grid grid-cols-2 gap-2 pl-4">
                      {['Visitors', 'Add Visitor', 'Visitor Details', 'Visitor Management'].map((section) => (
                        <label
                          key={section}
                          className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                            selectedSections.includes(section as AccessibleSection)
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSections.includes(section as AccessibleSection)}
                            onChange={() => handleToggleSection(section as AccessibleSection)}
                            className="w-3 h-3 text-green-600 rounded"
                          />
                          <span className="text-xs">{section}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Branches Module */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-800 mb-2 flex items-center">🏢 Branches Module</h4>
                    <div className="grid grid-cols-2 gap-2 pl-4">
                      {['Branches', 'Add Branch'].map((section) => (
                        <label
                          key={section}
                          className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                            selectedSections.includes(section as AccessibleSection)
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSections.includes(section as AccessibleSection)}
                            onChange={() => handleToggleSection(section as AccessibleSection)}
                            className="w-3 h-3 text-green-600 rounded"
                          />
                          <span className="text-xs">{section}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* SMS Module */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-800 mb-2 flex items-center">📱 SMS Module</h4>
                    <div className="grid grid-cols-2 gap-2 pl-4">
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
                            selectedSections.includes(section as AccessibleSection)
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSections.includes(section as AccessibleSection)}
                            onChange={() => handleToggleSection(section as AccessibleSection)}
                            className="w-3 h-3 text-green-600 rounded"
                          />
                          <span className="text-xs">{section}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {!['Data Personnel', 'Member', 'Guest'].includes(selectedRole) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-700">
                    <strong>{selectedRole}s</strong> have access to all sections of the system.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataPersonnelManagementPage;
