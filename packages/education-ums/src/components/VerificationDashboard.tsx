/**
 * Verification Dashboard Component
 * Administrative interface for certificate verification management.
 * Stats and activity ledger are fetched from the API (verification_logs / certificates tables)
 * so the dashboard reflects real database activity instead of mock data.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Globe,
  Clock,
  MapPin,
} from '../shims/lucide-react';
import { authFetch } from '../services/authService';
import { API_URL } from '../services/config';

interface VerificationStats {
  total_verifications: number;
  today: number;
  this_month: number;
  success_rate: number;
  unique_verifiers: number;
  certificates: {
    total_issued: number;
    active: number;
    revoked: number;
    suspended: number;
  };
  by_faculty: Record<string, number>;
  by_method: {
    online: number;
    offline: number;
    qr_scan: number;
  };
}

interface VerificationLog {
  id: string;
  certificate_serial: string;
  student_name: string | null;
  verification_result: 'valid' | 'invalid' | 'revoked';
  method: 'online' | 'offline' | 'qr_scan';
  timestamp: string;
  ip_address: string | null;
  location?: string | null;
  user_agent: string | null;
}

const VerificationDashboard: React.FC = () => {
  const [stats, setStats] = useState<VerificationStats | null>(null);
  const [logs, setLogs] = useState<VerificationLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMethod, setFilterMethod] = useState('all');
  const [filterResult, setFilterResult] = useState('all');

  const loadStats = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/certificates/verification/stats`, {}, 8000);
      const body = await res.json();
      const statsData = body?.data;
      if (!statsData) {
        setError(body?.error || 'Failed to load verification stats');
        return;
      }
      setStats({
        total_verifications: statsData.totalVerifications ?? 0,
        today: statsData.activity?.today ?? 0,
        this_month: statsData.activity?.this_month ?? 0,
        success_rate: statsData.activity?.success_rate ?? 0,
        unique_verifiers: statsData.activity?.unique_verifiers ?? 0,
        certificates: {
          total_issued: statsData.issued ?? 0,
          active: statsData.issued ?? 0,
          revoked: statsData.revoked ?? 0,
          suspended: statsData.suspended ?? 0,
        },
        by_faculty: statsData.by_faculty ?? {},
        by_method: {
          online: statsData.by_method?.online ?? 0,
          offline: statsData.by_method?.offline ?? 0,
          qr_scan: statsData.by_method?.qr_scan ?? 0,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load verification stats');
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ perPage: '50' });
      if (searchTerm) params.set('serial', searchTerm);
      if (filterMethod !== 'all') params.set('method', filterMethod);
      if (filterResult !== 'all') params.set('result', filterResult);

      const res = await authFetch(`${API_URL}/certificates/verification/logs?${params.toString()}`, {}, 8000);
      const body = await res.json();
      const items = body?.data?.items ?? [];
      setTotalLogs(body?.data?.total ?? items.length);
      setLogs(
        items.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          certificate_serial: row.serial_number as string,
          student_name: (row.student_name as string) || null,
          verification_result: (row.result as 'valid' | 'invalid' | 'revoked') || 'invalid',
          method: (row.method as 'online' | 'offline' | 'qr_scan') || 'online',
          timestamp: (row.created_at as string) || new Date().toISOString(),
          ip_address: (row.ip_address as string) || null,
          location: row.location as string | undefined,
          user_agent: (row.user_agent as string) || null,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load verification activity');
    }
  }, [searchTerm, filterMethod, filterResult]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadStats(), loadLogs()]).finally(() => setLoading(false));
  }, [loadStats, loadLogs]);

  const totalVerifications = stats?.total_verifications ?? 0;
  const qrShare = totalVerifications > 0
    ? Math.round(((stats?.by_method?.qr_scan ?? 0) / totalVerifications) * 1000) / 10
    : 0;
  const avgPerVerifier = stats?.unique_verifiers
    ? Math.round((totalVerifications / stats.unique_verifiers) * 10) / 10
    : 0;

  const renderBars = () => {
    const max = Math.max(...Object.values(stats?.by_faculty ?? {}), 1);
    return (
      <div className="flex items-end gap-2 h-48">
        {Object.entries(stats?.by_faculty ?? {}).map(([label, count]) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <span className="text-xs font-bold text-gray-500">{count}</span>
            <div
              className="w-12 rounded-t-lg"
              style={{ height: `${Math.max(8, (count / max) * 100)}px`, backgroundColor: 'lime' }}
            />
            <span className="text-[10px] text-gray-400 text-center truncate max-w-[80px]">
              {label}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderMethods = () => {
    const methods = [
      { name: 'Online', value: stats?.by_method?.online ?? 0, color: 'bg-lime-500' },
      { name: 'Offline', value: stats?.by_method?.offline ?? 0, color: 'bg-blue-500' },
      { name: 'QR Scan', value: stats?.by_method?.qr_scan ?? 0, color: 'bg-purple-500' },
    ];
    return (
      <div className="space-y-4">
        {methods.map((m) => (
          <div key={m.name}>
            <div className="flex justify-between mb-1">
              <span className="text-sm">{m.name}</span>
              <span className="text-sm font-bold">{m.value}</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full">
              <div
                className={`h-2 rounded-full ${m.color}`}
                style={{ width: `${m.value > 0 && totalVerifications > 0 ? Math.min(100, Math.round((m.value / totalVerifications) * 100)) : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const resultStyle = (result: 'valid' | 'invalid' | 'revoked') => {
    switch (result) {
      case 'valid': return 'bg-green-100 text-green-700';
      case 'invalid': return 'bg-red-100 text-red-700';
      case 'revoked': return 'bg-amber-100 text-amber-700';
    }
  };

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? ts : d.toLocaleString();
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-lime-500">Verification Dashboard</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Monitor certificate verification activity across the institution.
        </p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Shield />}
          label="Total Verifications"
          value={stats?.total_verifications ?? 0}
          color="lime"
          hint="All certificate verification checks"
        />
        <StatCard
          icon={<TrendingUp />}
          label="Today"
          value={stats?.today ?? 0}
          color="emerald"
          hint="Verifications in the last 24 hours"
        />
        <StatCard
          icon={<Users />}
          label="Unique Verifiers"
          value={stats?.unique_verifiers ?? 0}
          color="sky"
          hint="Distinct users verifying certificates"
        />
        <StatCard
          icon={<AlertTriangle />}
          label="Success Rate"
          value={`${stats?.success_rate ?? 0}%`}
          color="amber"
          hint="Valid vs. invalid checks"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-black uppercase text-gray-500 dark:text-gray-300">
              Verifications by Faculty
              <span className="ml-2 text-xs font-medium text-gray-400 dark:text-gray-500">
                (by program)
              </span>
            </h3>
          </div>
          <div className="flex items-end gap-2 h-48 overflow-x-auto">
            {renderBars()}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-black uppercase text-gray-500 dark:text-gray-300">
              Verification Methods
            </h3>
          </div>
          <div className="space-y-4">
            {renderMethods()}
          </div>
        </div>
      </div>

      {/* Certificates Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">
              {stats?.certificates?.total_issued ?? 0}
            </p>
            <p className="text-xs font-black uppercase text-gray-500">
              Certificates Issued
            </p>
          </div>
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">
              {stats?.certificates?.active ?? 0}
            </p>
            <p className="text-xs font-black uppercase text-gray-500">
              Active Certificates
            </p>
          </div>
          <Globe className="w-8 h-8 text-blue-500" />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">
              {stats?.certificates?.revoked ?? 0}
            </p>
            <p className="text-xs font-black uppercase text-gray-500">
              Revoked Certificates
            </p>
          </div>
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">
              {stats?.certificates?.suspended ?? 0}
            </p>
            <p className="text-xs font-black uppercase text-gray-500">
              Suspended Certificates
            </p>
          </div>
          <Clock className="w-8 h-8 text-orange-500" />
        </div>
      </div>

      {/* Detailed Activity Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black uppercase text-gray-500 dark:text-gray-300">
            Recent Verification Activity
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search by serial"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
            />
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
            >
              <option value="all">All Methods</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="qr_scan">QR Scan</option>
            </select>
            <select
              value={filterResult}
              onChange={(e) => setFilterResult(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
            >
              <option value="all">All Results</option>
              <option value="valid">Valid</option>
              <option value="invalid">Invalid</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500 dark:text-gray-300">
                  Serial Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500 dark:text-gray-300">
                  Student Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500 dark:text-gray-300">
                  Result
                </th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500 dark:text-gray-300">
                  Method
                </th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500 dark:text-gray-300">
                  IP Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500 dark:text-gray-300">
                  Location
                </th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500 dark:text-gray-300">
                  User Agent
                </th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500 dark:text-gray-300">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 font-mono text-sm">{log.certificate_serial}</td>
                  <td className="px-4 py-3 text-sm">{log.student_name || "—"}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${resultStyle(log.verification_result)}`}>
                      {log.verification_result}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{log.method}</td>
                  <td className="px-4 py-3 font-mono text-xs">{log.ip_address || "—"}</td>
                  <td className="px-4 py-3 text-sm">{log.location || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">{log.user_agent || "—"}</td>
                  <td className="px-4 py-3 text-sm">{formatDate(log.timestamp)}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                    {loading ? "Loading activity..." : "No verification activity recorded yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing <span className="font-bold">{logs.length}</span> of{" "}
            <span className="font-bold">{totalLogs}</span> records
          </p>
        </div>
      </div>

      {/* System Insights — derived from live DB activity */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black uppercase text-gray-500 dark:text-gray-300">
            System Insights
          </h3>
          <span className="text-xs px-2 py-1 rounded-full bg-lime-100 dark:bg-gray-600 text-lime-700 dark:text-lime-300">
            Live
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-lime-500">{stats?.this_month ?? 0}</p>
            <p className="text-xs text-gray-500">Verifications this month</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-lime-500">{qrShare}%</p>
            <p className="text-xs text-gray-500">QR Scan share</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-lime-500">{avgPerVerifier}</p>
            <p className="text-xs text-gray-500">Avg. verifications / verifier</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-lime-500">{stats?.by_method?.offline ?? 0}</p>
            <p className="text-xs text-gray-500">Offline verifications</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-lime-500">{stats?.today ?? 0}</p>
            <p className="text-xs text-gray-500">Verifications today</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-lime-500">{stats?.success_rate ?? 0}%</p>
            <p className="text-xs text-gray-500">Overall success rate</p>
          </div>
        </div>
      </div>

      {/* Location note */}
      <div className="flex items-center gap-2 mt-4 text-xs text-gray-400">
        <MapPin className="w-4 h-4" />
        IP geolocation is captured from the verification request headers when available.
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  color: 'lime' | 'emerald' | 'sky' | 'amber';
  hint: string;
}

const StatCard = ({ icon, label, value, color, hint }: StatCardProps) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
    <div className="flex items-center gap-3 mb-2">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          color === 'lime'
            ? 'bg-lime-100 text-lime-600'
            : color === 'emerald'
              ? 'bg-emerald-100 text-emerald-600'
              : color === 'sky'
                ? 'bg-sky-100 text-sky-600'
                : 'bg-amber-100 text-amber-600'
        }`}
      >
        {icon}
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
        <p className="text-xs font-black uppercase text-gray-500">{label}</p>
        <p className="text-xs text-gray-400">{hint}</p>
      </div>
    </div>
  </div>
);

export default VerificationDashboard;