import React from 'react';
import { User, UserRole } from './userData';
import { UsersIcon, UserPlusIcon } from './Icons';
import { useTheme } from './ThemeContext';
import ActionButtons from './ActionButtons';
import { useUserSessions } from '../hooks/useUserSessions';
import PageHeader from './PageHeader';

interface UsersPageProps {
  users: User[];
  setActivePage: (page: string) => void;
  onDeleteUser: (id: string) => void;
  onEditUser: (user: User) => void;
}

const StatCard: React.FC<{ title: string; value: string; icon: React.ElementType; color: string }> = ({
  title,
  value,
  icon: Icon,
  color,
}) => (
  <div className={`p-4 rounded-lg shadow-md flex items-center text-white ${color}`}>
    <div className="p-3 bg-white/20 rounded-lg mr-4">
      <Icon className="h-6 w-6" />
    </div>
    <div>
      <p className="text-sm uppercase font-semibold">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  </div>
);

const getRoleChip = (role: UserRole) => {
  switch (role) {
    case 'Super Admin':
      return <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-1 rounded-full">{role}</span>;
    case 'Admin':
      return <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full">{role}</span>;
    case 'Member':
      return <span className="bg-cyan-100 text-cyan-800 text-xs font-medium px-2.5 py-1 rounded-full">{role}</span>;
    case 'Data Personnel':
      return <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full">{role}</span>;
  }
};

const UsersPage: React.FC<UsersPageProps> = ({ users, setActivePage, onDeleteUser, onEditUser }) => {
  const { modeColors } = useTheme();
  const { sessions } = useUserSessions();

  // Display all users
  const allUsers = users || [];

  // Create a map of user emails to their online status
  const onlineUsers = new Set(sessions.filter((session) => session.isActive).map((session) => session.userEmail));

  const superAdminCount = allUsers.filter((u) => u.role === 'Super Admin').length;
  const adminCount = allUsers.filter((u) => u.role === 'Admin').length;
  const memberCount = allUsers.filter((u) => u.role === 'Member').length;
  const dataPersonnelCount = allUsers.filter((u) => u.role === 'Data Personnel').length;
  const onlineCount = allUsers.filter((u) => onlineUsers.has(u.email)).length;

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="System Users"
        subtitle="Manage accounts that have access to the system."
        icon={<UsersIcon className="h-8 w-8 text-blue-600" />}
        actions={
          <button
            onClick={() => setActivePage('Add User')}
            className="bg-church-green-dark hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center"
          >
            <UserPlusIcon className="h-5 w-5 mr-2" /> Add New User
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <StatCard title="Total Users" value={users.length.toString()} icon={UsersIcon} color="bg-blue-500" />
          <StatCard title="Online Now" value={onlineCount.toString()} icon={UsersIcon} color="bg-green-500" />
          <StatCard title="Super Admins" value={superAdminCount.toString()} icon={UsersIcon} color="bg-purple-500" />
          <StatCard title="Admins" value={adminCount.toString()} icon={UsersIcon} color="bg-sky-500" />
          <StatCard title="Members" value={memberCount.toString()} icon={UsersIcon} color="bg-cyan-500" />
          <StatCard
            title="Data Personnel"
            value={dataPersonnelCount.toString()}
            icon={UsersIcon}
            color="bg-orange-500"
          />
        </div>

        <div className={`${modeColors.card} rounded-lg shadow-sm overflow-hidden border ${modeColors.border}`}>
          <div className={`p-4 border-b ${modeColors.border}`}>
            <h3 className={`text-lg font-semibold ${modeColors.text}`}>All Users</h3>
          </div>
          <div className="overflow-auto max-h-[65vh]">
            <table className={`w-full text-sm text-left ${modeColors.textSecondary} relative`}>
              <thead
                className={`text-xs ${modeColors.text} uppercase ${modeColors.bgSecondary} sticky top-0 z-10 shadow-sm`}
              >
                <tr>
                  <th className={`px-6 py-3 ${modeColors.bgSecondary}`}>User</th>
                  <th className={`px-6 py-3 ${modeColors.bgSecondary}`}>Email</th>
                  <th className={`px-6 py-3 ${modeColors.bgSecondary}`}>Role</th>
                  <th className={`px-6 py-3 ${modeColors.bgSecondary}`}>Status</th>
                  <th className={`px-6 py-3 ${modeColors.bgSecondary}`}>Last Login</th>
                  <th className={`px-6 py-3 ${modeColors.bgSecondary}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.length > 0 ? (
                  allUsers.map((user) => {
                    const isOnline = onlineUsers.has(user.email);
                    return (
                      <tr
                        key={user.id}
                        className={`${modeColors.card} border-b ${modeColors.border} ${modeColors.hover}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="relative">
                              <img
                                className="w-10 h-10 rounded-full object-cover"
                                src={user.avatar}
                                alt={user.username}
                              />
                              {isOnline && (
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                              )}
                            </div>
                            <div className="pl-3">
                              <div className={`text-base font-semibold ${modeColors.text}`}>{user.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className={`px-6 py-4 ${modeColors.text}`}>{user.email}</td>
                        <td className="px-6 py-4">{getRoleChip(user.role)}</td>
                        <td className="px-6 py-4">
                          {isOnline ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                              Offline
                            </span>
                          )}
                        </td>
                        <td className={`px-6 py-4 ${modeColors.text}`}>{user.lastLogin}</td>
                        <td className="px-6 py-4">
                          <ActionButtons
                            onEdit={() => onEditUser(user)}
                            onDelete={() => onDeleteUser(user.id)}
                            itemName={user.username}
                            itemType="User"
                            itemDetails={{
                              Email: user.email,
                              Role: user.role,
                              Status: isOnline ? 'Online' : 'Offline',
                              'Permission Level': user.permissionLevel || 'N/A',
                              'Last Login': user.lastLogin,
                            }}
                            size="md"
                            variant="icon"
                          />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No users found.{' '}
                      <button onClick={() => setActivePage('Add User')} className="text-green-600 hover:underline">
                        Add one now
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <footer className="text-center text-sm text-gray-500 mt-8 pt-4">
          © {new Date().getFullYear()} All rights reserved. Church Management System
        </footer>
      </div>
    </div>
  );
};

export default UsersPage;
