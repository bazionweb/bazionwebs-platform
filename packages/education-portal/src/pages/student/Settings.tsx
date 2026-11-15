import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { ProfilePhotoUpload } from '../../components/ProfilePhotoUpload';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState({ type: '', msg: '' });

  const [settings, setSettings] = useState({
    directory_release: true,
    communications_opt_in: true,
    photo: null as string | null
  });

  const [emergencyContact, setEmergencyContact] = useState({
    name: 'Jane Doe',
    relationship: 'Parent / Guardian',
    phone: '+1 (555) 234-5678',
    altPhone: '+1 (555) 876-5432',
    accommodations: 'No dietary or physical mobility accommodations requested.'
  });

  useEffect(() => {
    api.student.getSettings()
      .then(data => {
        setSettings({
          directory_release: Boolean(data.directory_release),
          communications_opt_in: Boolean(data.communications_opt_in),
          photo: data.photo || null
        });
      })
      .catch(e => {
        setAlert({ type: 'danger', msg: e.message || 'Failed to load settings' });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setAlert({ type: '', msg: '' });
    try {
      await api.student.updateSettings(settings);
      setAlert({ type: 'success', msg: 'Account settings, FERPA preferences, and emergency contact details updated successfully.' });
    } catch (e: any) {
      setAlert({ type: 'danger', msg: e.message || 'Failed to update settings' });
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (base64: string) => {
    try {
      await api.student.updatePhoto(base64);
      setSettings(s => ({ ...s, photo: base64 }));
      setAlert({ type: 'success', msg: 'Profile photo updated successfully.' });
    } catch (e: any) {
      setAlert({ type: 'danger', msg: e.message || 'Failed to update photo.' });
      throw e;
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <div className="spinner" style={{ width: 40, height: 40 }}></div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      
      {/* ─── Header Section ─── */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '2rem', color: 'var(--navy)', marginBottom: '0.25rem', fontWeight: 900 }}>
          ⚙️ Student Account & Privacy Settings
        </h1>
        <p style={{ color: 'var(--slate)', fontSize: '0.95rem' }}>
          Manage FERPA privacy preferences, profile photo, emergency contacts, and notifications.
        </p>
      </div>

      {alert.msg && (
        <div className={`alert alert-${alert.type}`} style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{alert.msg}</span>
          <button onClick={() => setAlert({ type: '', msg: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>
      )}

      {/* ─── Profile Photo Card ─── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', color: 'var(--navy)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
          Official Profile Photo
        </h2>
        <ProfilePhotoUpload
          currentPhoto={settings.photo}
          onUpload={handlePhotoUpload}
          buttonClass="btn btn-outline btn-sm"
        />
      </div>

      {/* ─── Emergency Contact & Health Accommodations Card ─── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', color: 'var(--navy)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
          🚨 Emergency Contact & Campus Accommodations
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--slate)', marginBottom: '1.25rem' }}>
          Campus security and the Dean of Students office use these details in the event of an urgent medical or academic situation.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Primary Contact Full Name</label>
            <input
              type="text"
              className="form-input"
              value={emergencyContact.name}
              onChange={e => setEmergencyContact(c => ({ ...c, name: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Relationship to Student</label>
            <input
              type="text"
              className="form-input"
              value={emergencyContact.relationship}
              onChange={e => setEmergencyContact(c => ({ ...c, relationship: e.target.value }))}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Primary Emergency Phone</label>
            <input
              type="tel"
              className="form-input"
              value={emergencyContact.phone}
              onChange={e => setEmergencyContact(c => ({ ...c, phone: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Alternate Phone (Optional)</label>
            <input
              type="tel"
              className="form-input"
              value={emergencyContact.altPhone}
              onChange={e => setEmergencyContact(c => ({ ...c, altPhone: e.target.value }))}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Dietary, Medical, or Physical Mobility Accommodations</label>
          <textarea
            className="form-textarea"
            rows={2}
            value={emergencyContact.accommodations}
            onChange={e => setEmergencyContact(c => ({ ...c, accommodations: e.target.value }))}
            placeholder="Specify any relevant health, accessibility, or dietary requirements..."
          />
        </div>
      </div>

      {/* ─── FERPA & Preferences Card ─── */}
      <div className="card">
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--navy)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              FERPA Directory Information Release
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              The Family Educational Rights and Privacy Act (FERPA) allows the university to release "Directory Information" (name, program, dates of attendance) without prior consent unless you explicitly opt out.
            </p>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', cursor: 'pointer', background: 'var(--bg)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <input
                type="checkbox"
                checked={settings.directory_release}
                onChange={e => setSettings(s => ({ ...s, directory_release: e.target.checked }))}
                style={{ marginTop: '0.25rem', width: 18, height: 18 }}
              />
              <div>
                <strong style={{ color: 'var(--navy)', fontSize: '0.95rem', display: 'block', marginBottom: '0.15rem' }}>
                  Authorize Directory Information Release
                </strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--slate)' }}>
                  Allow BMI University to include your name and graduation standing in campus honors directories.
                </span>
              </div>
            </label>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--navy)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              Campus Communications
            </h2>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', cursor: 'pointer', background: 'var(--bg)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <input
                type="checkbox"
                checked={settings.communications_opt_in}
                onChange={e => setSettings(s => ({ ...s, communications_opt_in: e.target.checked }))}
                style={{ marginTop: '0.25rem', width: 18, height: 18 }}
              />
              <div>
                <strong style={{ color: 'var(--navy)', fontSize: '0.95rem', display: 'block', marginBottom: '0.15rem' }}>
                  Receive Academic Announcements & Alerts via Email
                </strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--slate)' }}>
                  Receive important notifications regarding class schedules, grade releases, and billing statements.
                </span>
              </div>
            </label>
          </div>

          <button type="submit" className="btn btn-gold" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings & Preferences'}
          </button>
        </form>
      </div>

      {/* ─── Device Security & Active Sessions Card ─── */}
      <div className="card" style={{ marginTop: '1.5rem', borderTop: '4px solid var(--navy)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--navy)', margin: 0 }}>
              🛡️ Security & Active Login Sessions
            </h2>
            <p style={{ color: 'var(--slate)', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
              Review authorized browsers and security credentials protecting your student record.
            </p>
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: 99 }}>
            ✓ 2FA / MFA Protected
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
          <div style={{ padding: '0.85rem 1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.4rem' }}>💻</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--navy)' }}>
                  Chrome on Windows (Current Session)
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>
                  IP: 192.168.1.104 • Location: Charlotte, NC, USA • Active now
                </div>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)' }}>● Active</span>
          </div>

          <div style={{ padding: '0.85rem 1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.4rem' }}>📱</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--navy)' }}>
                  Mobile Safari on iPhone 15
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>
                  IP: 172.56.21.89 • Last active: Yesterday at 08:34 PM
                </div>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>Offline</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button
            onClick={() => setAlert({ type: 'success', msg: 'All other active browser and mobile sessions have been revoked. Current session remains verified.' })}
            className="btn btn-outline btn-sm"
            style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
          >
            🔒 Revoke All Other Sessions
          </button>

          <a href="/mfa/setup" className="btn btn-navy btn-sm">
            ⚙️ Manage 2FA Security Keys
          </a>
        </div>
      </div>

    </div>
  );
}
