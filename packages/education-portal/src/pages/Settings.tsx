import { Link } from '../shims/react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="page" style={{ padding: '5rem 1.5rem 3rem', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.5rem', marginBottom: '0.5rem' }}>Account Settings</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem' }}>
          Welcome back, {user?.first_name || 'User'}
        </p>

        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Two-Factor Authentication</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Add an extra layer of security to your account using an authenticator app.
                </p>
              </div>
              <Link to="/mfa/setup" className="btn btn-gold btn-sm">
                Configure
              </Link>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Profile Information</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Update your personal details and contact information.
                </p>
              </div>
              <span style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>Coming soon</span>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Notifications</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Manage your email and push notification preferences.
                </p>
              </div>
              <span style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>Coming soon</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
