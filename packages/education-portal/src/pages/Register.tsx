import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from '../shims/react-router-dom';
import { api } from '../lib/api';
import { z } from 'zod';
import { Check } from '../shims/lucide-react';

const STORAGE_KEY = 'bmi_register_form';

const PASSWORD_REQUIREMENTS = [
  { id: 'length', label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter (A-Z)', test: (pw: string) => /[A-Z]/.test(pw) },
  { id: 'lowercase', label: 'One lowercase letter (a-z)', test: (pw: string) => /[a-z]/.test(pw) },
  { id: 'number', label: 'One number (0-9)', test: (pw: string) => /[0-9]/.test(pw) },
  { id: 'special', label: 'One special character (!@#$%^&*)', test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
];

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');

const RegisterSchema = z.object({
  first_name: z.string().min(1, 'This field is required').max(100, 'First name too long'),
  last_name: z.string().min(1, 'This field is required').max(100, 'Last name too long'),
  email: z.string().email('Please enter a valid email address').max(254, 'Email too long'),
  password: passwordSchema,
});

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Read prefill params from the university apply page redirect via URL search params
  const prefillEmail = searchParams.get('email') ?? '';
  const prefillFirstName = searchParams.get('first_name') ?? '';
  const prefillLastName = searchParams.get('last_name') ?? '';
  const prefillProgram = searchParams.get('program') ?? '';
  const isPrefilledFromApply = !!(prefillEmail && prefillFirstName && prefillLastName);

  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          first_name: prefillFirstName || parsed.first_name || '',
          last_name: prefillLastName || parsed.last_name || '',
          email: prefillEmail || parsed.email || '',
          phone: parsed.phone || '',
          password: '', // Don't persist password for security
          confirm_password: '',
        };
      }
    } catch (e) {
      console.warn('Failed to load saved form:', e);
    }
    return {
      first_name: prefillFirstName,
      last_name: prefillLastName,
      email: prefillEmail,
      phone: '',
      password: '',
      confirm_password: '',
    };
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState<Record<string, string>>({});

  const formRef = useRef(form);
  useEffect(() => {
    formRef.current = form;
  }, [form]);

  // Keep form in sync if params arrive after mount (e.g. client-side navigation)
  useEffect(() => {
    if (prefillEmail || prefillFirstName || prefillLastName) {
      setForm(f => ({
        ...f,
        email: prefillEmail || f.email,
        first_name: prefillFirstName || f.first_name,
        last_name: prefillLastName || f.last_name,
      }));
    }
  }, [prefillEmail, prefillFirstName, prefillLastName]);

  // Auto-save to localStorage
  useEffect(() => {
    try {
      const toSave = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn('Failed to save form:', e);
    }
  }, [form.first_name, form.last_name, form.email, form.phone]);

  const validateField = useCallback((field: string, value: string, formState: typeof form) => {
    if (field === 'confirm_password') {
      return value !== formState.password ? 'Passwords do not match' : '';
    }
    
    // Use Zod schema for field validation
    const schemaMap: Record<string, z.ZodTypeAny> = {
      first_name: RegisterSchema.shape.first_name,
      last_name: RegisterSchema.shape.last_name,
      email: RegisterSchema.shape.email,
      password: RegisterSchema.shape.password,
    };

    const schema = schemaMap[field];
    if (schema) {
      const result = schema.safeParse(value);
      if (!result.success) {
        return (result.error as any).errors?.[0]?.message || (result.error as any).issues?.[0]?.message || 'Invalid value';
      }
    }
    return '';
  }, []);

  const debounceTimers = useRef<Record<string, number>>({});

  const update = useCallback((field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    const newForm = { ...formRef.current, [field]: value };
    
    // Clear existing debounce timer
    if (debounceTimers.current[field]) {
      clearTimeout(debounceTimers.current[field]);
    }

    // Debounce email and password validation for better UX
    if (field === 'email' || field === 'password') {
      debounceTimers.current[field] = setTimeout(() => {
        const latestForm = formRef.current;
        const err = validateField(field, latestForm[field as keyof typeof form], latestForm);
        setValidation(v => ({ ...v, [field]: err }));
        
        // Also re-validate confirm password if password changes
        if (field === 'password' && latestForm.confirm_password) {
          setValidation(v => ({ ...v, confirm_password: validateField('confirm_password', latestForm.confirm_password, latestForm) }));
        }
      }, 500) as any;
    } else {
      const err = validateField(field, value, newForm);
      setValidation(v => ({ ...v, [field]: err }));
    }
  }, [validateField]);

  const getPasswordStrength = (pw: string): { label: string; color: string; score: number } => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 2) return { label: 'Weak', color: 'var(--danger)', score };
    if (score <= 4) return { label: 'Medium', color: 'var(--warning)', score };
    return { label: 'Strong', color: 'var(--success)', score };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate all fields
    const newValidation: Record<string, string> = {};
    let hasError = false;
    ['first_name', 'last_name', 'email', 'password', 'confirm_password'].forEach(field => {
      const err = validateField(field, form[field as keyof typeof form], form);
      if (err) hasError = true;
      newValidation[field] = err;
    });
    setValidation(newValidation);
    if (hasError) return;

    setLoading(true);
    try {
      await api.auth.register({
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || undefined,
        program: prefillProgram || undefined,
      });

      // Clear saved form on success
      localStorage.removeItem(STORAGE_KEY);

      if (prefillProgram) {
        try {
          const existingApplyForm = JSON.parse(localStorage.getItem('bmi_apply_form') || '{}');
          localStorage.setItem('bmi_apply_form', JSON.stringify({
            ...existingApplyForm,
            program: prefillProgram,
          }));
        } catch { /* ignore */ }
        // Came from the university apply page — go straight to the application form with prefilled program
        setSuccess('Account created! Please check your email to verify your account, then complete your application.');
        setTimeout(() => navigate(`/apply?program=${encodeURIComponent(prefillProgram)}`), 2000);
      } else {
        setSuccess('Account created! Please check your email to verify your account before logging in.');
        setForm({ first_name: '', last_name: '', email: '', phone: '', password: '', confirm_password: '' });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const strength = form.password ? getPasswordStrength(form.password) : null;

  return (
    <div className="page-center" style={{ background: 'linear-gradient(150deg, #f8fafc 0%, #eef2ff 50%, #faf5e4 100%)' }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link to="/" style={{ display: 'inline-block' }}>
            <img src="/bmi-logo.png" alt="BMI University Portal" style={{ height: '64px' }} />
          </Link>
          <h1 style={{ color: 'var(--navy)', fontSize: '1.8rem', marginTop: '1rem' }}>Create Your Account</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {isPrefilledFromApply ? 'One last step — set your password to complete your application.' : 'Start your admissions journey today'}
          </p>
        </div>
        <div className="card">
          {/* Contextual welcome banner when arriving from the university apply page */}
          {isPrefilledFromApply && !success && !error && (
            <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
              <strong>Almost there!</strong> Your account details have been pre-filled from your application.
              {prefillProgram && (
                <> Your selected program — <strong>{prefillProgram}</strong> — will be saved to your application.</>
              )}
              {' '}Just set a password to finish creating your account.
            </div>
          )}

          {error && <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>{error}</div>}
          {success && <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>{success}</div>}

          {!success && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="first_name">First Name *</label>
                  <input
                    id="first_name"
                    className="form-input"
                    type="text"
                    required
                    value={form.first_name}
                    onChange={e => update('first_name', e.target.value)}
                    placeholder="John"
                    autoFocus={!isPrefilledFromApply}
                    readOnly={isPrefilledFromApply}
                    style={isPrefilledFromApply ? { background: '#f1f5f9', color: 'var(--text-muted)' } : undefined}
                  />
                  {validation.first_name && <span className="form-error">{validation.first_name}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="last_name">Last Name *</label>
                  <input
                    id="last_name"
                    className="form-input"
                    type="text"
                    required
                    value={form.last_name}
                    onChange={e => update('last_name', e.target.value)}
                    placeholder="Smith"
                    readOnly={isPrefilledFromApply}
                    style={isPrefilledFromApply ? { background: '#f1f5f9', color: 'var(--text-muted)' } : undefined}
                  />
                  {validation.last_name && <span className="form-error">{validation.last_name}</span>}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email Address *</label>
                <input
                  id="email"
                  className="form-input"
                  type="email"
                  required
                  value={form.email}
                  onChange={e => update('email', e.target.value)}
                  placeholder="john@example.com"
                  readOnly={isPrefilledFromApply}
                  style={isPrefilledFromApply ? { background: '#f1f5f9', color: 'var(--text-muted)' } : undefined}
                />
                {validation.email && <span className="form-error">{validation.email}</span>}
              </div>
              {!isPrefilledFromApply && (
                <div className="form-group">
                  <label className="form-label" htmlFor="phone">Phone Number</label>
                  <input id="phone" className="form-input" type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+1 (704) 000-0000" />
                </div>
              )}
              <div className="form-group">
                <label className="form-label" htmlFor="password">Password *</label>
                <input
                  id="password"
                  className="form-input"
                  type="password"
                  required
                  value={form.password}
                  onChange={e => update('password', e.target.value)}
                  placeholder="Min. 8 characters with uppercase, lowercase, number & special char"
                  autoFocus={isPrefilledFromApply}
                />
                {strength && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${(strength.score / 6) * 100}%`, height: '100%', background: strength.color, borderRadius: 2, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: strength.color, fontWeight: 600 }}>{strength.label}</span>
                  </div>
                )}

                {/* Password Requirements Live Checklist */}
                <div style={{ marginTop: '0.75rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>
                    Password Requirements:
                  </span>
                  {PASSWORD_REQUIREMENTS.map((req) => {
                    const isMet = req.test(form.password);
                    return (
                      <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: isMet ? '#16a34a' : '#64748b', fontWeight: isMet ? 600 : 400, transition: 'all 0.2s ease' }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: isMet ? '#dcfce7' : '#e2e8f0', border: `1px solid ${isMet ? '#86efac' : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {isMet ? <Check size={10} color="#16a34a" strokeWidth={3} /> : <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#94a3b8' }} />}
                        </div>
                        <span>{req.label}</span>
                      </div>
                    );
                  })}
                </div>

                {validation.password && <span className="form-error">{validation.password}</span>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="confirm_password">Confirm Password *</label>
                <input
                  id="confirm_password"
                  className="form-input"
                  type="password"
                  required
                  value={form.confirm_password}
                  onChange={e => update('confirm_password', e.target.value)}
                  placeholder="Re-enter password"
                />
                {validation.confirm_password && <span className="form-error">{validation.confirm_password}</span>}
              </div>
              <button type="submit" className="btn btn-gold btn-full" disabled={loading} style={{ marginTop: '0.5rem' }}>
                {loading ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Creating Account...</> : (isPrefilledFromApply ? 'Complete Registration →' : 'Create Account →')}
              </button>
            </form>
          )}
          <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Already have an account? <Link to="/login" style={{ color: 'var(--gold)', fontWeight: 600 }}>Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
