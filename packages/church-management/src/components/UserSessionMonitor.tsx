import React, { useState } from 'react';
import { calculateSessionDuration } from './userSessionData';
import { User } from './userData';
import { SearchIcon, UserIcon } from './Icons';
import { Users, Activity, Shield, AlertCircle, CheckCircle, XCircle, Monitor, Smartphone, Plus } from 'lucide-react';
import { useUserSessions } from '../hooks/useUserSessions';
import { useLoginAttempts } from '../hooks/useLoginAttempts';

interface LoginAttempt {
  id: string;
  email: string;
  success: boolean;
  timestamp: string;
  failureReason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  location?: string | null;
}

interface UserSessionMonitorProps {
  currentUser: User;
}

const UserSessionMonitor: React.FC<UserSessionMonitorProps> = ({ currentUser }) => {
  const {
    sessions,
    loading: sessionsLoading,
    addSession,
    loadMoreSessions,
    daysBack: sessionDaysBack,
  } = useUserSessions();
  const {
    attempts,
    loading: attemptsLoading,
    logLoginAttempt,
    loadMoreAttempts,
    daysBack: attemptDaysBack,
  } = useLoginAttempts();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedTab, setSelectedTab] = useState<'sessions' | 'attempts'>('sessions');

  // Create test session for demonstration
  const createTestSession = async () => {
    if (!currentUser) return;

    try {
      await addSession({
        userId: currentUser.id,
        userEmail: currentUser.email,
        userName: currentUser.username,
        userRole: currentUser.role,
        loginTime: new Date().toISOString(),
        isActive: true,
        lastActivity: new Date().toISOString(),
        ipAddress: '192.168.1.100',
        userAgent: navigator.userAgent,
        location: 'Test Location',
      });

      await logLoginAttempt({
        email: currentUser.email,
        timestamp: new Date().toISOString(),
        success: true,
        ipAddress: '192.168.1.100',
        userAgent: navigator.userAgent,
        location: 'Test Location',
      });
    } catch (error) {
      console.error('Failed to create test session:', error);
    }
  };

  // Filter sessions
  const filteredSessions = sessions.filter((session) => {
    const matchesSearch =
      session.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.userRole.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && session.isActive) ||
      (filterStatus === 'inactive' && !session.isActive);

    return matchesSearch && matchesStatus;
  });

  // Filter login attempts
  const filteredAttempts = attempts.filter((attempt: LoginAttempt) =>
    attempt.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Statistics
  const stats = {
    totalSessions: sessions.length,
    activeSessions: sessions.filter((s) => s.isActive).length,
    totalAttempts: attempts.length,
    failedAttempts: attempts.filter((a: LoginAttempt) => !a.success).length,
    successRate:
      attempts.length > 0
        ? Math.round((attempts.filter((a: LoginAttempt) => a.success).length / attempts.length) * 100)
        : 0,
  };

  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3" />
          Online
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        <XCircle className="w-3 h-3" />
        Offline
      </span>
    );
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      'Super Admin': 'bg-red-100 text-red-800',
      Admin: 'bg-orange-100 text-orange-800',
      Editor: 'bg-blue-100 text-blue-800',
      Viewer: 'bg-green-100 text-green-800',
      'Data Personnel': 'bg-purple-100 text-purple-800',
      Guest: 'bg-gray-100 text-gray-800',
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}
      >
        {role}
      </span>
    );
  };

  const getDeviceIcon = (userAgent?: string) => {
    if (!userAgent) return <Monitor className="w-4 h-4" />;

    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      return <Smartphone className="w-4 h-4" />;
    }
    return <Monitor className="w-4 h-4" />;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (sessionsLoading || attemptsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            User Session Monitor
          </h1>
          <p className="text-gray-500">Real-time monitoring of user sessions and login attempts</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={createTestSession}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Create Test Session
          </button>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Live Monitoring</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-700">{stats.activeSessions}</p>
              <p className="text-sm text-blue-600">Active Sessions</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-700">{stats.successRate}%</p>
              <p className="text-sm text-green-600">Success Rate</p>
            </div>
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-orange-600" />
            <div>
              <p className="text-2xl font-bold text-orange-700">{stats.totalAttempts}</p>
              <p className="text-sm text-orange-600">Login Attempts</p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-red-700">{stats.failedAttempts}</p>
              <p className="text-sm text-red-600">Failed Attempts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="flex border-b">
          <button
            onClick={() => setSelectedTab('sessions')}
            className={`flex-1 py-3 px-4 text-sm font-medium ${
              selectedTab === 'sessions'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            User Sessions ({stats.totalSessions})
          </button>
          <button
            onClick={() => setSelectedTab('attempts')}
            className={`flex-1 py-3 px-4 text-sm font-medium ${
              selectedTab === 'attempts'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Shield className="w-4 h-4 inline mr-2" />
            Login Attempts ({stats.totalAttempts})
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {selectedTab === 'sessions' && (
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Sessions</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-auto max-h-[60vh]">
          {selectedTab === 'sessions' ? (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Login Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{session.userName}</p>
                          <p className="text-sm text-gray-500">{session.userEmail}</p>
                          <div className="mt-1">{getRoleBadge(session.userRole)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(session.isActive)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(session.loginTime).toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDuration(calculateSessionDuration(session.loginTime, session.logoutTime))}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        {getDeviceIcon(session.userAgent)}
                        <span>{session.location || 'Unknown'}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Result</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAttempts.map((attempt: LoginAttempt) => (
                  <tr key={attempt.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-800">{attempt.email}</td>
                    <td className="px-6 py-4">
                      {attempt.success ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3" />
                          Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3" />
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(attempt.timestamp).toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{attempt.failureReason || 'Successful login'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Empty States */}
        {selectedTab === 'sessions' && filteredSessions.length === 0 && (
          <div className="p-8 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">No sessions found</h3>
            <p className="text-gray-500">No user sessions match your current filters.</p>
          </div>
        )}

        {selectedTab === 'sessions' && filteredSessions.length > 0 && (
          <div className="flex flex-col items-center py-4 border-t bg-gray-50">
            <p className="text-xs text-gray-500 mb-2">Showing sessions from the last {sessionDaysBack} days</p>
            <button
              onClick={loadMoreSessions}
              className="bg-white border border-gray-300 text-gray-600 text-sm font-medium py-2 px-6 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Load {sessionDaysBack + 30} days of history
            </button>
          </div>
        )}

        {selectedTab === 'attempts' && filteredAttempts.length === 0 && (
          <div className="p-8 text-center">
            <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">No login attempts</h3>
            <p className="text-gray-500">No login attempts match your search criteria.</p>
          </div>
        )}

        {selectedTab === 'attempts' && filteredAttempts.length > 0 && (
          <div className="flex flex-col items-center py-4 border-t bg-gray-50">
            <p className="text-xs text-gray-500 mb-2">Showing attempts from the last {attemptDaysBack} days</p>
            <button
              onClick={loadMoreAttempts}
              className="bg-white border border-gray-300 text-gray-600 text-sm font-medium py-2 px-6 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Load {attemptDaysBack + 30} days of history
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserSessionMonitor;
