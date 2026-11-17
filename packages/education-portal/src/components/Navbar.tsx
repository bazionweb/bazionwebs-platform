// src/components/Navbar.tsx
import { Link, useNavigate, useLocation } from '../shims/react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTenantConfig } from '../context/TenantContext';
import { useState, useEffect, useRef } from 'react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const tenantConfig = useTenantConfig();
  const isBmiDefault = tenantConfig.shortName === 'BMI University';
  const logoSrc = isBmiDefault && tenantConfig.branding.logoUrl === '/images/bmi-logo.png'
    ? '/bmi-logo.png'
    : tenantConfig.branding.logoUrl;
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
  }, []);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Hide top Navbar on student workspace pages (they use StudentLayout with StudentSidebar & StudentHeader)
  if (location.pathname.startsWith('/student/')) {
    return null;
  }

  return (
    <>
      <nav className="navbar">
        <Link to="/" className="navbar-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img src={logoSrc} alt={`${tenantConfig.shortName} Logo`} style={{ height: '32px', width: 'auto' }} /> 
          <span className="navbar-brand-badge" style={{ fontSize: '0.72rem', background: 'var(--gold)', color: 'var(--navy)', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Student Portal
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="navbar-links desktop-only">
          {!user ? (
            <>
              <Link to="/login" className={`navbar-link${location.pathname === '/login' ? ' active' : ''}`}>Login</Link>
              <Link to="/claim" className={`navbar-link${location.pathname === '/claim' ? ' active' : ''}`}>Claim Account</Link>
              <Link to="/register" className="btn btn-gold btn-sm">Apply Now</Link>
            </>
          ) : (
            <>
              {user.role === 'student' ? (
                <>
                  <Link to="/student/dashboard" className={`navbar-link${location.pathname === '/student/dashboard' ? ' active' : ''}`}>Dashboard</Link>
                  <Link to="/student/academics" className={`navbar-link${location.pathname === '/student/academics' ? ' active' : ''}`}>Academics</Link>
                  <Link to="/student/finances" className={`navbar-link${location.pathname === '/student/finances' ? ' active' : ''}`}>Finances</Link>
                  <Link to="/registration" className={`navbar-link${location.pathname === '/registration' ? ' active' : ''}`}>Registration</Link>
                  <Link to="/student/documents" className={`navbar-link${location.pathname === '/student/documents' ? ' active' : ''}`}>Documents</Link>
                  <Link to="/status" className={`navbar-link${location.pathname === '/status' ? ' active' : ''}`}>My Application</Link>
                </>
              ) : user.role === 'alumni' ? (
                <>
                  <Link to="/alumni" className={`navbar-link${location.pathname === '/alumni' ? ' active' : ''}`}>Alumni</Link>
                  <Link to="/documents" className={`navbar-link${location.pathname === '/documents' ? ' active' : ''}`}>Documents</Link>
                </>
              ) : (
                <Link to="/status" className={`navbar-link${location.pathname === '/status' ? ' active' : ''}`}>My Application</Link>
              )}
              
              <div className="dropdown" ref={dropdownRef} style={{ position: 'relative' }}>
                <button 
                  className="navbar-link btn" 
                  style={{ 
                    padding: '0.5rem 1rem', 
                    background: 'transparent', 
                    border: 'none', 
                    cursor: 'pointer', 
                    color: 'var(--navy-light)', 
                    fontWeight: 500, 
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  aria-haspopup="true"
                  aria-expanded={dropdownOpen}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'var(--navy)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}>
                    {user.first_name?.[0]?.toUpperCase()}
                  </div>
                  <span>{user.first_name}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                {dropdownOpen && (
                  <div className="dropdown-menu" role="menu">
                    <Link to="/settings" className="dropdown-item" onClick={() => setDropdownOpen(false)}>Settings</Link>
                    <button onClick={() => { handleLogout(); setDropdownOpen(false); }} className="dropdown-item">Sign Out</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Mobile Hamburger Menu Toggle Button */}
        <button 
          className="mobile-hamburger-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* Mobile Drawer Overlay Backdrop */}
      {mobileMenuOpen && (
        <div className="mobile-nav-backdrop" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Mobile Off-Canvas Navigation Drawer */}
      <div className={`mobile-nav-drawer ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src={logoSrc} alt={`${tenantConfig.shortName} Logo`} style={{ height: 28 }} />
            <span style={{ fontWeight: 800, color: 'var(--navy)', fontSize: '1rem' }}>{tenantConfig.shortName} Portal</span>
          </div>
          <button className="mobile-drawer-close" onClick={() => setMobileMenuOpen(false)}>✕</button>
        </div>

        <div className="mobile-drawer-links">
          {!user ? (
            <>
              <Link to="/login" className={`mobile-drawer-link${location.pathname === '/login' ? ' active' : ''}`}>🔑 Login</Link>
              <Link to="/claim" className={`mobile-drawer-link${location.pathname === '/claim' ? ' active' : ''}`}>📋 Claim Account</Link>
              <Link to="/register" className="btn btn-gold btn-block" style={{ marginTop: '1rem', justifyContent: 'center' }}>🎓 Apply Now</Link>
            </>
          ) : (
            <>
              <div style={{ padding: '0.75rem 1rem', background: 'var(--bg)', borderRadius: '8px', marginBottom: '0.75rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.95rem' }}>{user.first_name} {user.last_name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>{user.email}</div>
              </div>
              {user.role === 'student' && (
                <>
                  <Link to="/student/dashboard" className="mobile-drawer-link">🏠 Student Dashboard</Link>
                  <Link to="/student/academics" className="mobile-drawer-link">📚 Academics & Grades</Link>
                  <Link to="/student/finances" className="mobile-drawer-link">💳 Finances & Tuition</Link>
                  <Link to="/registration" className="mobile-drawer-link">📝 Class Registration</Link>
                  <Link to="/student/documents" className="mobile-drawer-link">📁 Documents & ID</Link>
                </>
              )}
              <Link to="/status" className="mobile-drawer-link">📄 Application Status</Link>
              <button onClick={handleLogout} className="mobile-drawer-link" style={{ color: 'var(--danger)', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
                🚪 Sign Out
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
