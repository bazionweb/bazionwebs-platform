import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Server, 
  Database, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Users,
} from '../shims/lucide-react';
import { authFetch } from '../services/authService';
import { API_URL } from '../services/config';

interface SystemHealthData {
  status: string;
  timestamp: string;
  database: {
    connection_status: string;
    response_time_ms: number;
    current_db_time: string;
    counts: { users: number; applications: number; active_sessions: number };
  };
  performance: {
    avg_query_time_ms: string;
    error_rate_percent: string;
    recent_errors: number;
    slow_queries_count: number;
  };
  alerts: string[];
}

const SystemHealth: React.FC = () => {
  const [data, setData] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      const response = await authFetch(`${API_URL.replace('/v1', '')}/admin/performance/health`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch diagnostics');
      }
    } catch { 
      setError('Network error fetching diagnostics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // 30 seconds instead of 5 to reduce load
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4B0082]"></div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-800">Diagnostic Error</h2>
        <p className="text-gray-600">{error}</p>
        <button 
          onClick={() => { setLoading(true); fetchHealth(); }}
          className="mt-4 px-6 py-2 bg-[#4B0082] text-white rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex justify-between items-end border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-2xl font-black text-[#2E004F] uppercase tracking-tight">System Health</h2>
          <p className="text-[8px] font-semibold text-gray-500 uppercase tracking-widest mt-1">Infrastructure & Database Monitoring</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 text-emerald-500 font-black text-xs uppercase">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            {data?.status || 'Unknown'}
          </div>
          <p className="text-[9px] text-gray-400 font-mono mt-1">Refreshes every 30s</p>
        </div>
      </div>

      {/* Top Level Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Users size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Users</p>
            <p className="text-xl font-black text-gray-900">{data?.database.counts.users.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Avg Query Time</p>
            <p className="text-xl font-black text-gray-900">{data?.performance.avg_query_time_ms}ms</p>
          </div>
        </div>
        <div className="bg-white p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className={`p-3 rounded-lg ${parseFloat(data?.performance.error_rate_percent || '0') > 5 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Error Rate</p>
            <p className="text-xl font-black text-gray-900">{data?.performance.error_rate_percent}</p>
          </div>
        </div>
        <div className="bg-white p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Database size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">DB Response Time</p>
            <p className="text-xs font-black text-gray-900">{data?.database.response_time_ms}ms</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Info & Resources */}
        <div className="space-y-6">
          <div className="bg-white p-6 shadow-sm border border-gray-100">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-900 mb-4 flex items-center gap-2">
              <Server size={14} className="text-purple-600" /> Database Connection
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-bold uppercase tracking-tight">Status</span>
                <span className={`font-mono text-xs font-bold ${data?.database.connection_status === 'connected' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {data?.database.connection_status}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-bold uppercase tracking-tight">Current DB Time</span>
                <span className="font-mono text-gray-900">{data?.database.current_db_time}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-bold uppercase tracking-tight">Active Sessions</span>
                <span className="font-mono text-gray-900">{data?.database.counts.active_sessions}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 shadow-sm border border-gray-100">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-900 mb-4 flex items-center gap-2">
              <Activity size={14} className="text-amber-600" /> Performance Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-bold uppercase tracking-tight">Recent Errors</span>
                <span className="font-mono text-gray-900">{data?.performance.recent_errors}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-bold uppercase tracking-tight">Slow Queries</span>
                <span className="font-mono text-gray-900">{data?.performance.slow_queries_count}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div className="lg:col-span-2 bg-white p-6 shadow-sm border border-gray-100">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-600" /> System Alerts
          </h3>
          {(data?.alerts?.length || 0) > 0 ? (
            <div className="space-y-3">
              {data!.alerts.map((alert, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle size={16} className="text-amber-600" />
                  <p className="text-sm font-medium text-amber-800">{alert}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <p className="text-sm font-medium text-emerald-800">No active alerts. System is healthy.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemHealth;
