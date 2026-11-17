import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from '../shims/react-router-dom';
import { api } from '../lib/api';

interface StudentHeaderProps {
  user?: any;
  onLogout?: () => void;
}

export function StudentHeader({ user, onLogout }: StudentHeaderProps) {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentLang, setCurrentLang] = useState('🇺🇸 EN');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [largeFont, setLargeFont] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('bmi_theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('bmi_theme', next ? 'dark' : 'light');
    if (next) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const toggleFont = () => {
    const next = !largeFont;
    setLargeFont(next);
    document.documentElement.style.fontSize = next ? '18px' : '16px';
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.notifications.list();
      if (res && res.data) {
        setNotifications(res.data);
        setUnreadCount(res.meta?.unread_count ?? res.data.filter((n: any) => !n.is_read).length);
      }
    } catch {
      // Keep empty or fallback silently
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (e) {
      console.warn('Failed to mark notifications as read', e);
    }
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      try {
        await api.notifications.markRead([notif.id]);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (e) {
        console.warn('Failed to mark notification read', e);
      }
    }
    if (notif.link) {
      setShowNotifications(false);
      navigate(notif.link);
    }
  };

  return (
    <header className="student-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy)', background: 'rgba(212, 175, 55, 0.15)', border: '1px solid rgba(212, 175, 55, 0.4)', padding: '4px 12px', borderRadius: '99px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)' }} />
          Fall 2026 Academic Term
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        {/* Search Input */}
        <div className="student-header-search">
          <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', color: 'var(--slate)' }}>
            🔍
          </span>
          <input type="text" placeholder="Search courses, invoices, tickets..." />
        </div>

        {/* Language Switcher */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.35rem 0.65rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            title="Switch Language"
          >
            {currentLang} ▾
          </button>
          {showLangMenu && (
            <div style={{ position: 'absolute', top: '120%', right: 0, width: 140, background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', zIndex: 100, padding: '0.35rem 0' }}>
              <button onClick={() => { setCurrentLang('🇺🇸 EN'); setShowLangMenu(false); }} className="dropdown-item" style={{ fontSize: '0.8rem' }}>🇺🇸 English</button>
              <button onClick={() => { setCurrentLang('🇪🇸 ES'); setShowLangMenu(false); }} className="dropdown-item" style={{ fontSize: '0.8rem' }}>🇪🇸 Español</button>
              <button onClick={() => { setCurrentLang('🇫🇷 FR'); setShowLangMenu(false); }} className="dropdown-item" style={{ fontSize: '0.8rem' }}>🇫🇷 Français</button>
              <button onClick={() => { setCurrentLang('🇵🇹 PT'); setShowLangMenu(false); }} className="dropdown-item" style={{ fontSize: '0.8rem' }}>🇵🇹 Português</button>
              <button onClick={() => { setCurrentLang('🇰🇷 KO'); setShowLangMenu(false); }} className="dropdown-item" style={{ fontSize: '0.8rem' }}>🇰🇷 한국어</button>
            </div>
          )}
        </div>

        {/* Accessibility Font Size Toggle */}
        <button
          onClick={toggleFont}
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.35rem 0.6rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy)', cursor: 'pointer' }}
          title={largeFont ? 'Reset Standard Font Size' : 'Increase Font Size (WCAG)'}
        >
          {largeFont ? 'A-' : 'A+'}
        </button>

        {/* Theme Dark / Light Toggle */}
        <button
          onClick={toggleTheme}
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.9rem' }}
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>

        {/* Notification Icon & Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
            title="Notifications"
          >
            🔔
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: -2, right: -2, background: 'var(--danger)', color: 'white', fontSize: '0.68rem', fontWeight: 800, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div style={{ position: 'absolute', top: '120%', right: 0, width: 340, background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', zIndex: 100, padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--navy)' }}>
                  Notifications {unreadCount > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--gold-dark)' }}>({unreadCount} new)</span>}
                </strong>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: 'var(--gold-dark)', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 300, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--slate)', fontSize: '0.85rem' }}>
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      style={{
                        padding: '0.65rem 0.75rem',
                        borderRadius: '6px',
                        background: !n.is_read ? 'rgba(212, 175, 55, 0.08)' : 'var(--bg)',
                        border: !n.is_read ? '1px solid rgba(212, 175, 55, 0.3)' : '1px solid var(--border)',
                        cursor: n.link ? 'pointer' : 'default',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontSize: '0.85rem', fontWeight: !n.is_read ? 700 : 600, color: 'var(--navy)' }}>
                        {n.title}
                      </div>
                      {n.body && <div style={{ fontSize: '0.78rem', color: 'var(--slate)', marginTop: '0.2rem', lineHeight: 1.4 }}>{n.body}</div>}
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                        {new Date(n.created_at + (n.created_at?.endsWith('Z') ? '' : 'Z')).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar & Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            style={{ background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
          >
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--navy)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', border: '2px solid var(--gold)' }}>
              {user?.first_name ? user.first_name[0].toUpperCase() : 'S'}
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--navy)' }}>
              {user?.first_name || 'Account'} ▾
            </span>
          </button>

          {showProfileMenu && (
            <div style={{ position: 'absolute', top: '120%', right: 0, width: 200, background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', zIndex: 100, padding: '0.5rem 0' }}>
              <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)', marginBottom: '0.25rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{user?.first_name} {user?.last_name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>{user?.email}</div>
              </div>
              <Link to="/student/settings" className="dropdown-item">⚙️ Account Settings</Link>
              <Link to="/student/support" className="dropdown-item">🎫 Contact Support</Link>
              <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.25rem', paddingTop: '0.25rem' }}>
                <button
                  onClick={onLogout}
                  className="dropdown-item"
                  style={{ color: 'var(--danger)', fontWeight: 600 }}
                >
                  🚪 Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
