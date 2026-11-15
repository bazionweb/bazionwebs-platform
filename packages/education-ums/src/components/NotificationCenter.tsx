import React, { useEffect, useState } from 'react';
import { Bell, X, CheckCircle, Trash2, Info, AlertTriangle, ExternalLink } from '../shims/lucide-react';
import { authFetch } from '../services/authService';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link?: string;
  created: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/v1/notifications');
      if (res.ok) {
        const data = await res.json();
        if (data.success) setNotifications(data.data);
      }
    } catch (error) { // eslint-disable-next-line no-console
      console.error(error);
     } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadNotifications();
  }, [isOpen]);

  const markAsRead = async (id: string) => {
    try {
      const res = await authFetch(`/api/v1/notifications/${id}/read`, { method: 'PATCH' });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      }
    } catch (error) { // eslint-disable-next-line no-console
      console.error(error);
     }
  };

  const deleteNotification = async (id: string) => {
    try {
      const res = await authFetch(`/api/v1/notifications/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (error) { // eslint-disable-next-line no-console
      console.error(error);
     }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'grade_published': return <CheckCircle className="text-emerald-500" size={16} />;
      case 'fee_update': return <Info className="text-blue-500" size={16} />;
      case 'system_alert': return <AlertTriangle className="text-amber-500" size={16} />;
      default: return <Bell className="text-gray-400" size={16} />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-gray-800 shadow-2xl z-[60] border-l-2 border-[#4B0082] animate-slide-in">
      <div className="bg-[#4B0082] text-white p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Bell size={18} />
          <span className="font-black uppercase text-xs tracking-widest">Notifications</span>
        </div>
        <button onClick={onClose}><X size={18} /></button>
      </div>

      <div className="overflow-y-auto h-[calc(100%-60px)] p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-purple-200 border-t-[#4B0082] rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No notifications</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div 
              key={n.id} 
              className={`p-3 border border-gray-100 dark:border-gray-700 relative group ${n.is_read ? 'bg-white dark:bg-gray-800' : 'bg-purple-50/50 dark:bg-purple-900/10 border-l-4 border-l-[#4B0082]'}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">{getIcon(n.type)}</div>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase text-gray-900 dark:text-white leading-tight">{n.title}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{n.message}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[8px] font-bold text-gray-400 uppercase">{new Date(n.created).toLocaleDateString()}</span>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {n.link && (
                        <a href={n.link} className="text-[#4B0082]"><ExternalLink size={12} /></a>
                      )}
                      {!n.is_read && (
                        <button onClick={() => markAsRead(n.id)} className="text-emerald-600"><CheckCircle size={12} /></button>
                      )}
                      <button onClick={() => deleteNotification(n.id)} className="text-red-500"><Trash2 size={12} /></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;









