import { Link, useLocation } from '../shims/react-router-dom';

interface StudentSidebarProps {
  user?: any;
}

export function StudentSidebar({ user }: StudentSidebarProps) {
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', path: '/student/dashboard', icon: '🏠' },
    { label: 'Academics & Grades', path: '/student/academics', icon: '📚' },
    { label: 'Finances & Tuition', path: '/student/finances', icon: '💳' },
    { label: 'Class Registration', path: '/registration', icon: '📝' },
    { label: 'Documents & ID', path: '/student/documents', icon: '📁' },
    { label: 'Orientation', path: '/student/orientation', icon: '🎓' },
    { label: 'Graduation & Alumni', path: '/student/graduation', icon: '🏛️' },
    { label: 'Help & Support', path: '/student/support', icon: '🎫' },
    { label: 'Account Settings', path: '/student/settings', icon: '⚙️' },
  ];

  return (
    <aside className="student-sidebar">
      <div className="student-sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div style={{ background: 'white', padding: '5px 10px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/bmi-logo.png" alt="BMI University Logo" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
        </div>
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--gold)', fontWeight: 800, letterSpacing: '0.12em' }}>
            STUDENT PORTAL
          </div>
        </div>
      </div>

      <div className="student-sidebar-nav">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`student-nav-item ${isActive ? 'active' : ''}`}
            >
              <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="student-sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--gold)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
            {user?.first_name ? user.first_name[0].toUpperCase() : 'S'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : 'Student Account'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Reg No: {user?.reg_no || user?.registration_number || 'Pending Issuance'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
