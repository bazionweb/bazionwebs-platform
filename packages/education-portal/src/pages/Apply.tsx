import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from '../shims/react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { PROGRAMS as FALLBACK_PROGRAMS, API_WORKER_URL } from '../lib/contracts-bridge';
import { z } from 'zod';
import styles from './Apply.module.css';

const _viteApiUrl = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_API_URL : undefined;
const _isDev = false;
const API_BASE = (_viteApiUrl && _viteApiUrl.trim() !== ''
  ? _viteApiUrl
  : (_isDev ? 'http://127.0.0.1:8787' : API_WORKER_URL)
) + '/api';

const STEPS = ['Personal Info', 'Academic Program', 'Background', 'Statement', 'Documents', 'Review & Submit'];
const STORAGE_KEY = 'bmi_apply_form';

const COUNTRIES_LIST = [
  { name: 'Liberia', nationality: 'Liberian', flag: '🇱🇷' },
  { name: 'Kenya', nationality: 'Kenyan', flag: '🇰🇪' },
  { name: 'Nigeria', nationality: 'Nigerian', flag: '🇳🇬' },
  { name: 'Ghana', nationality: 'Ghanaian', flag: '🇬🇭' },
  { name: 'United States', nationality: 'American', flag: '🇺🇸' },
  { name: 'United Kingdom', nationality: 'British', flag: '🇬🇧' },
  { name: 'Canada', nationality: 'Canadian', flag: '🇨🇦' },
  { name: 'Sierra Leone', nationality: 'Sierra Leonean', flag: '🇸🇱' },
  { name: 'South Africa', nationality: 'South African', flag: '🇿🇦' },
  { name: 'Uganda', nationality: 'Ugandan', flag: '🇺🇬' },
  { name: 'Tanzania', nationality: 'Tanzanian', flag: '🇹🇿' },
  { name: 'Rwanda', nationality: 'Rwandan', flag: '🇷🇼' },
  { name: 'Ethiopia', nationality: 'Ethiopian', flag: '🇪🇹' },
  { name: 'Egypt', nationality: 'Egyptian', flag: '🇪🇬' },
  { name: 'Cameroon', nationality: 'Cameroonian', flag: '🇨🇲' },
  { name: 'Zambia', nationality: 'Zambian', flag: '🇿🇲' },
  { name: 'Zimbabwe', nationality: 'Zimbabwean', flag: '🇿🇼' },
  { name: 'Australia', nationality: 'Australian', flag: '🇦🇺' },
  { name: 'India', nationality: 'Indian', flag: '🇮🇳' },
  { name: 'Germany', nationality: 'German', flag: '🇩🇪' },
  { name: 'France', nationality: 'French', flag: '🇫🇷' },
  { name: 'Brazil', nationality: 'Brazilian', flag: '🇧🇷' },
  { name: 'China', nationality: 'Chinese', flag: '🇨🇳' },
  { name: 'Japan', nationality: 'Japanese', flag: '🇯🇵' },
  { name: 'South Korea', nationality: 'South Korean', flag: '🇰🇷' },
  { name: 'Mexico', nationality: 'Mexican', flag: '🇲🇽' },
  { name: 'Philippines', nationality: 'Filipino', flag: '🇵🇭' },
  { name: 'Jamaica', nationality: 'Jamaican', flag: '🇯🇲' },
  { name: 'Trinidad and Tobago', nationality: 'Trinidadian', flag: '🇹🇹' },
  { name: 'Bahamas', nationality: 'Bahamian', flag: '🇧🇸' },
  { name: 'Haiti', nationality: 'Haitian', flag: '🇭🇹' },
  { name: 'Dominican Republic', nationality: 'Dominican', flag: '🇩🇴' },
  { name: 'New Zealand', nationality: 'New Zealander', flag: '🇳🇿' },
  { name: 'Ireland', nationality: 'Irish', flag: '🇮🇪' },
  { name: 'Netherlands', nationality: 'Dutch', flag: '🇳🇱' },
  { name: 'Sweden', nationality: 'Swedish', flag: '🇸🇪' },
  { name: 'Norway', nationality: 'Norwegian', flag: '🇳🇴' },
  { name: 'Switzerland', nationality: 'Swiss', flag: '🇨🇭' },
  { name: 'Other', nationality: 'Other', flag: '🌐' },
];

const TOP_COUNTRIES = COUNTRIES_LIST.slice(0, 7);

import { validateDocument } from '../lib/documentValidation';
import type { DocumentValidationResult } from '../lib/documentValidation';

interface StagedDoc {
  id: string;
  file: File;
  docType: string;
  name: string;
  sizeKb: number;
  validation?: DocumentValidationResult;
}

// Zod schemas (matching backend definitions — program_id canonical, program legacy fallback)
const SubmitApplicationFields = {
  // program_id is canonical; program (label) is the legacy fallback.
  // Both optional at field level with empty-string tolerated (drafts);
  // the refine below enforces that at least one is actually selected.
  program: z.string().optional(),
  program_id: z.string().optional(),
  degree_level: z.string().min(1, 'Degree level is required'),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  gender: z.string().min(1, 'Gender is required'),
  nationality: z.string().min(1, 'Nationality is required'),
  personal_statement: z.string()
    .min(100, 'Personal statement must be at least 100 characters')
    .max(10000, 'Personal statement must not exceed 10000 characters'),
  prior_education: z.string()
    .min(20, 'Prior education must be at least 20 characters')
    .max(5000, 'Prior education must not exceed 5000 characters'),
  high_school: z.string().optional(),
  graduation_year: z.union([z.number(), z.string()]).optional(),
  gpa: z.union([z.number(), z.string()]).optional(),
  address: z.string().optional(),
};

// Base object schema for per-step picks; refined schema for final submit.
const SubmitApplicationBase = z.object(SubmitApplicationFields);
const SubmitApplicationSchema = SubmitApplicationBase.refine((d) => d.program || d.program_id, {
  message: 'Program selection is required',
  path: ['program_id'],
});

export default function Apply() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentDue, setPaymentDue] = useState<{ applicationId: string; invoiceNumber?: string; formatted?: string } | null>(null);
  const [payingFee, setPayingFee] = useState(false);
  const [existingApp, setExistingApp] = useState<any>(null);
  const [_checkingExisting, setCheckingExisting] = useState(true);
  const [stagedDocs, setStagedDocs] = useState<StagedDoc[]>([]);
  const [selectedDocType, setSelectedDocType] = useState('transcript');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 0 Filter & Search State
  const [programSearch, setProgramSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');

  // Step 1 Country Combobox State
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const countryComboboxRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load saved form:', e);
    }
    return {
      program: '',
      program_id: '',
      degree_level: '',
      prior_education: '',
      personal_statement: '',
      date_of_birth: '',
      nationality: '',
      address: '',
      gender: '',
      high_school: '',
      graduation_year: '',
      gpa: ''
    };
  });

  const [searchParams] = useSearchParams();
  const urlProgram = searchParams.get('program');
  const urlProgramId = searchParams.get('program_id');

  // Check if applicant already has an active submitted application or existing draft
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const myApp = await api.applications.getMyApplication();
        if (active && myApp && myApp.status && !['draft', 'rejected'].includes(myApp.status)) {
          setExistingApp(myApp);
        } else if (active && myApp && myApp.status === 'draft') {
          // Pre-populate draft program info if form has not set a program yet
          setForm((prev: any) => ({
            ...prev,
            program: prev.program || myApp.program || '',
            program_id: prev.program_id || (myApp as any).program_id || '',
            degree_level: prev.degree_level || myApp.degree_level || '',
          }));
        }
      } catch {
        // No application found or fetch failed, proceed with form
      } finally {
        if (active) setCheckingExisting(false);
      }
    })();
    return () => { active = false; };
  }, []);



  // Auto-save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch (e) {
      console.warn('Failed to save form:', e);
    }
  }, [form]);

  // Click outside to close country dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (countryComboboxRef.current && !countryComboboxRef.current.contains(e.target as Node)) {
        setCountryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-save to API (debounced 30s, quota protection)
  const lastSavedAt = useRef<number>(0);
  const saveTimeout = useRef<any>(null);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Session timeout logic
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const sessionTimeoutRef = useRef<number | null>(null);

  const resetSessionTimer = useCallback(() => {
    setShowTimeoutWarning(false);
    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current as any);
    sessionTimeoutRef.current = setTimeout(() => {
      setShowTimeoutWarning(true);
    }, 15 * 60 * 1000) as any;
  }, []);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => {
      if (!showTimeoutWarning) {
        resetSessionTimer();
      }
    };
    events.forEach(e => window.addEventListener(e, handleActivity));
    resetSessionTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity));
      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current as any);
    };
  }, [resetSessionTimer, showTimeoutWarning]);

  useEffect(() => {
    if (step < 2) return;

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current as any);
    }

    const now = Date.now();
    const timeSinceLastSave = now - lastSavedAt.current;
    const delay = Math.max(30000 - timeSinceLastSave, 2000);

    setDraftStatus('idle');

    saveTimeout.current = setTimeout(() => {
      setDraftStatus('saving');
      api.applications.saveDraft({
        current_step: step,
        application_data: form
      })
        .then(() => {
          lastSavedAt.current = Date.now();
          setDraftStatus('saved');
          setTimeout(() => setDraftStatus('idle'), 3000);
        })
        .catch(err => {
          console.warn('Background draft save failed:', err);
          setDraftStatus('error');
        });
    }, delay);

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current as any);
    };
  }, [form, step]);

  const update = useCallback((field: string, value: string | number) => setForm((f: any) => ({ ...f, [field]: value })), []);

  const [programs, setPrograms] = useState(FALLBACK_PROGRAMS);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/public/programs`);
        if (!res.ok) return;
        const body = await res.json();
        if (!body?.success || !Array.isArray(body.data)) return;
        if (cancelled) return;
        setPrograms(body.data.map((p: any) => ({
          id: p.id ?? p.code ?? p.label ?? p.name,
          label: p.label ?? p.name,
          level: p.level,
          description: p.description,
          icon: p.icon ?? undefined,
        })));
      } catch { /* silently keep fallback */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Sync program from URL query params when arriving with ?program=...
  useEffect(() => {
    if (!urlProgram && !urlProgramId) return;
    const match = programs.find((p: any) =>
      (urlProgramId && p.id === urlProgramId) ||
      (urlProgram && p.label?.toLowerCase() === urlProgram.toLowerCase())
    );
    if (match) {
      setForm((prev: any) => ({
        ...prev,
        program: match.label,
        program_id: (match as any).id || (match as any).code || prev.program_id,
        degree_level: match.level || prev.degree_level,
      }));
      if (match.level) {
        setSelectedLevel(match.level);
      }
    } else if (urlProgram) {
      setForm((prev: any) => ({
        ...prev,
        program: urlProgram,
      }));
    }
  }, [urlProgram, urlProgramId, programs]);

  // Filtered Programs
  const filteredPrograms = useMemo(() => {
    return programs.filter(p => {
      const matchesLevel = selectedLevel === 'all' || p.level.toLowerCase() === selectedLevel.toLowerCase();
      const matchesSearch = programSearch.trim() === '' ||
        p.label.toLowerCase().includes(programSearch.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(programSearch.toLowerCase()));
      return matchesLevel && matchesSearch;
    });
  }, [programs, selectedLevel, programSearch]);

  // Program Level Counts
  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = { all: programs.length };
    programs.forEach(p => {
      const lvl = p.level.toLowerCase();
      counts[lvl] = (counts[lvl] || 0) + 1;
    });
    return counts;
  }, [programs]);

  // Filtered Countries for Combobox
  const filteredCountries = useMemo(() => {
    const query = form.nationality?.trim().toLowerCase() || '';
    if (!query) return COUNTRIES_LIST;
    return COUNTRIES_LIST.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.nationality.toLowerCase().includes(query)
    );
  }, [form.nationality]);

  const selectProgram = (p: { id?: string; label: string; level: string }) => {
    update('program', p.label);
    if (p.id) update('program_id', p.id);
    update('degree_level', p.level);
  };

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep(s => Math.max(s - 1, 0));

  const canProceedStep0 = Boolean((form.program || form.program_id) && form.degree_level);
  const canProceedStep1 = SubmitApplicationBase.pick({ date_of_birth: true, gender: true, nationality: true }).safeParse(form).success;
  const canProceedStep2 = SubmitApplicationBase.pick({ prior_education: true }).safeParse(form).success;
  const canProceedStep3 = SubmitApplicationBase.pick({ personal_statement: true }).safeParse(form).success;

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    const validation = await validateDocument(file, selectedDocType);
    if (!validation.valid) {
      setError(validation.errors.join(' '));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const newDoc: StagedDoc = {
      id: crypto.randomUUID(),
      file,
      docType: selectedDocType,
      name: file.name,
      sizeKb: validation.sizeKb,
      validation,
    };
    setStagedDocs(prev => [...prev, newDoc]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeStagedDoc = (id: string) => {
    setStagedDocs(prev => prev.filter(d => d.id !== id));
  };

  const handleSubmit = async () => {
    if (loading) return;
    setError('');

    const validation = SubmitApplicationSchema.safeParse(form);
    if (!validation.success) {
      setError('Please fix the errors in the form before submitting.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.applications.submit({
        program: form.program || undefined,
        program_id: form.program_id || undefined,
        degree_level: form.degree_level,
        personal_statement: form.personal_statement,
        prior_education: form.prior_education,
        date_of_birth: form.date_of_birth || undefined,
        nationality: form.nationality || undefined,
        address: form.address || undefined,
        gender: form.gender || undefined,
        high_school: form.high_school || undefined,
        graduation_year: form.graduation_year ? Number(form.graduation_year) : undefined,
        gpa: form.gpa ? Number(form.gpa) : undefined,
      });

      const appId = (res as any)?.application_id || (res as any)?.data?.application_id || (res as any)?.id;

      // Upload any staged documents attached during the application
      if (appId && stagedDocs.length > 0) {
        for (const doc of stagedDocs) {
          try {
            await api.documents.upload(appId, doc.docType, doc.file);
          } catch (uploadErr) {
            console.warn('Attached document upload error:', uploadErr);
          }
        }
      }

      localStorage.removeItem(STORAGE_KEY);
      navigate('/status?submitted=1');
    } catch (err: unknown) {
      const apiErr = err instanceof ApiError ? err : null;
      if (apiErr && apiErr.status === 402 && apiErr.data?.invoice_id) {
        const inv = apiErr.data.invoice || {};
        setPaymentDue({
          applicationId: apiErr.data.application_id,
          invoiceNumber: apiErr.data.invoice_number || inv.invoice_number,
          formatted: inv.formatted_dual || (inv.total_minor != null ? `${(Number(inv.total_minor) / 100).toFixed(2)} ${inv.charge_currency ?? ''}`.trim() : undefined),
        });
      } else {
        const msg = err instanceof Error ? err.message : 'Submission failed. Please try again.';
        if (msg.toLowerCase().includes('already have an active application') || msg.includes('409')) {
          setError('You already have an active application submitted. Redirecting to your status tracker...');
          setTimeout(() => navigate('/status'), 1800);
        } else {
          setError(msg);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePayApplicationFee = async () => {
    if (!paymentDue) return;
    setPayingFee(true);
    setError('');
    try {
      const intent = await api.applications.payApplicationFee(paymentDue.applicationId);
      if (intent.authorizationUrl) {
        window.location.href = intent.authorizationUrl;
        return;
      }
      if (intent.reference) {
        // Test/no-redirect gateway: confirm inline then retry submission.
        await api.payments.verify(intent.reference);
        setPaymentDue(null);
        setError('Payment received. Click "Submit Application" again to finalize.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start fee payment.');
    } finally {
      setPayingFee(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <h1 className={styles.title}>Your Application</h1>
          <div className={styles.subHeader}>
            <p className={styles.welcomeText}>
              Welcome, {user?.first_name}. Complete all steps to submit your application.
            </p>
            <div className={styles.stepMeta}>
              {step > 1 && (
                <span className={`${styles.draftPill} ${styles[draftStatus] || ''}`}>
                  {draftStatus === 'saving' ? 'Saving draft...' : draftStatus === 'saved' ? '✓ Draft saved' : draftStatus === 'error' ? '⚠️ Save failed' : ''}
                </span>
              )}
              <span className="badge badge-undergraduate" style={{ background: 'var(--slate)', color: 'white' }}>
                Step {step + 1} of {STEPS.length} — {Math.round((step / (STEPS.length - 1)) * 100)}% complete
              </span>
            </div>
          </div>
        </div>

        {existingApp && (
          <div className="alert alert-info" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: '#f8fafc', borderLeft: '4px solid var(--gold)' }}>
            <div>
              <strong style={{ color: 'var(--navy)', fontSize: '1rem' }}>Active Application on File</strong>
              <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                You already have a submitted application for <strong>{existingApp.program}</strong> (Status: <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{existingApp.status?.replace('_', ' ')}</span>).
              </p>
            </div>
            <button
              type="button"
              className="btn btn-navy"
              onClick={() => navigate('/status')}
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}
            >
              Track Application Status →
            </button>
          </div>
        )}

        {showTimeoutWarning && (
          <div className="alert alert-warning" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>Session Timeout Warning</strong>
              <p style={{ margin: 0 }}>You have been inactive for 15 minutes. To prevent data loss, please continue your session.</p>
            </div>
            <button className="btn btn-navy" onClick={resetSessionTimer} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
              Continue Session
            </button>
          </div>
        )}

        <div className="steps">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className="step"
              onClick={() => i < step ? setStep(i) : undefined}
              role="button"
              tabIndex={i < step ? 0 : -1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && i < step) setStep(i);
              }}
              style={{ cursor: i < step ? 'pointer' : 'default' }}
            >
              <div className={`step-circle ${i < step ? 'done' : i === step ? 'active' : ''}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className="step-label" style={{ color: i === step ? 'var(--navy)' : 'var(--slate)' }}>{label}</span>
              {i < STEPS.length - 1 && <div className={`step-line ${i < step ? 'done' : ''}`} />}
            </div>
          ))}
        </div>

        <div className="card">
          {error && <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>{error}</div>}

          {step === 0 && (
            <div>
              <div style={{ marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.25rem' }}>Choose Your Program</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Select the degree or certificate program you wish to apply to.</p>
              </div>

              {/* Search and Category Filters */}
              <div className={styles.searchFilterBar}>
                <div className={styles.searchBox}>
                  <span className={styles.searchIcon}>🔍</span>
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search programs by keyword or title..."
                    value={programSearch}
                    onChange={(e) => setProgramSearch(e.target.value)}
                  />
                  {programSearch && (
                    <button
                      type="button"
                      className={styles.clearSearchBtn}
                      onClick={() => setProgramSearch('')}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className={styles.levelTabs} role="tablist">
                  {[
                    { key: 'all', label: 'All Programs' },
                    { key: 'undergraduate', label: 'Undergraduate' },
                    { key: 'graduate', label: 'Graduate' },
                    { key: 'doctorate', label: 'Doctorate' },
                    { key: 'diploma', label: 'Diploma' },
                    { key: 'certificate', label: 'Certificate' },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={selectedLevel === tab.key}
                      className={`${styles.levelTab} ${selectedLevel === tab.key ? styles.active : ''}`}
                      onClick={() => setSelectedLevel(tab.key)}
                    >
                      <span>{tab.label}</span>
                      <span className={styles.tabCount}>{levelCounts[tab.key] || 0}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Programs Grid */}
              {filteredPrograms.length === 0 ? (
                <div className={styles.emptyPrograms}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                  <p style={{ fontWeight: 600, margin: '0 0 0.5rem 0' }}>No programs match your search</p>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => { setProgramSearch(''); setSelectedLevel('all'); }}
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className={styles.programGrid}>
                  {filteredPrograms.map((p) => {
                    const isSelected = form.program === p.label;
                    const levelClass = styles[p.level] || '';
                    return (
                      <div
                        key={p.label}
                        onClick={() => selectProgram(p)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') selectProgram(p); }}
                        aria-pressed={isSelected}
                        className={`${styles.programCard} ${isSelected ? styles.selected : ''}`}
                      >
                        <div>
                          <div className={styles.cardHeader}>
                            <span className={`${styles.levelBadge} ${levelClass}`}>
                              {p.level}
                            </span>
                            <div className={styles.checkIndicator}>
                              ✓
                            </div>
                          </div>
                          <h3 className={styles.programTitle}>{p.label}</h3>
                          {p.description && (
                            <p className={styles.programDesc}>{p.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {form.program && (
                <div className={styles.selectedBanner}>
                  <div>
                    <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a16207', fontWeight: 700 }}>Selected Program:</span>
                    <div style={{ fontWeight: 800, color: '#4B0082', fontSize: '1rem', marginTop: '0.1rem' }}>
                      {form.program}
                    </div>
                  </div>
                  <span className={`badge badge-${form.degree_level}`} style={{ textTransform: 'capitalize' }}>
                    {form.degree_level}
                  </span>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.25rem' }}>Personal Information</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                  Please confirm your personal details and origin.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg)', padding: '1rem 1.25rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.9rem' }}><strong>Name:</strong> {user?.first_name} {user?.last_name}</div>
                <div style={{ fontSize: '0.9rem' }}><strong>Email:</strong> {user?.email}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="date_of_birth">Date of Birth *</label>
                  <input type="date" id="date_of_birth" className="form-input" value={form.date_of_birth || ''} onChange={e => update('date_of_birth', e.target.value)} required />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="gender">Gender *</label>
                  <select id="gender" className="form-input" value={form.gender || ''} onChange={e => update('gender', e.target.value)} required>
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Searchable & Typable Country / Nationality Combobox */}
              <div className="form-group" ref={countryComboboxRef}>
                <label className="form-label" htmlFor="nationality">
                  Nationality *
                </label>
                <div className={styles.comboboxContainer}>
                  <div className={styles.comboboxInputWrapper}>
                    <input
                      type="text"
                      id="nationality"
                      className="form-input"
                      value={form.nationality || ''}
                      onChange={e => {
                        update('nationality', e.target.value);
                        setCountryDropdownOpen(true);
                      }}
                      onFocus={() => setCountryDropdownOpen(true)}
                      placeholder="Type or select your nationality / country (e.g. Liberian, Kenyan, American...)"
                      autoComplete="off"
                      required
                    />
                    <button
                      type="button"
                      style={{
                        position: 'absolute',
                        right: '0.75rem',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--slate)',
                        padding: '0.25rem',
                        fontSize: '0.8rem'
                      }}
                      onClick={() => setCountryDropdownOpen(prev => !prev)}
                      tabIndex={-1}
                    >
                      {countryDropdownOpen ? '▲' : '▼'}
                    </button>
                  </div>

                  {countryDropdownOpen && (
                    <div className={styles.comboboxDropdown} role="listbox">
                      {filteredCountries.length === 0 ? (
                        <div style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--slate)', textAlign: 'center' }}>
                          No direct match. You can keep typing "{form.nationality}" as custom nationality.
                        </div>
                      ) : (
                        filteredCountries.map(c => {
                          const isMatch = form.nationality?.toLowerCase() === c.name.toLowerCase() ||
                            form.nationality?.toLowerCase() === c.nationality.toLowerCase();
                          return (
                            <div
                              key={c.name}
                              role="option"
                              aria-selected={isMatch}
                              className={`${styles.comboboxItem} ${isMatch ? styles.selected : ''}`}
                              onClick={() => {
                                update('nationality', c.nationality);
                                setCountryDropdownOpen(false);
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span className={styles.countryFlag}>{c.flag}</span>
                                <span>{c.name}</span>
                              </div>
                              <span style={{ fontSize: '0.8rem', color: isMatch ? '#854d0e' : 'var(--slate)' }}>
                                {c.nationality}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Quick Selection Chips */}
                <div className={styles.quickChips}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center', marginRight: '0.2rem' }}>Quick select:</span>
                  {TOP_COUNTRIES.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      className={`${styles.quickChip} ${form.nationality === c.nationality ? styles.active : ''}`}
                      onClick={() => {
                        update('nationality', c.nationality);
                        setCountryDropdownOpen(false);
                      }}
                    >
                      <span>{c.flag}</span>
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="address">Mailing Address</label>
                <textarea id="address" className="form-textarea" rows={3} value={form.address || ''} onChange={e => update('address', e.target.value)} placeholder="Full street address, city, state/province, postal code" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h2 style={{ marginBottom: '0.25rem' }}>Educational Background</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Tell us about your prior education and academic history.</p>

              <div className="form-group">
                <label className="form-label" htmlFor="high_school">High School</label>
                <input type="text" id="high_school" className="form-input" value={form.high_school || ''} onChange={e => update('high_school', e.target.value)} placeholder="Name of High School" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="graduation_year">Graduation Year</label>
                  <input type="number" id="graduation_year" className="form-input" value={form.graduation_year || ''} onChange={e => update('graduation_year', e.target.value ? parseInt(e.target.value, 10) : '')} placeholder="YYYY" min="1900" max="2100" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="gpa">GPA</label>
                  <input type="number" id="gpa" className="form-input" value={form.gpa || ''} onChange={e => update('gpa', e.target.value ? parseFloat(e.target.value) : '')} placeholder="e.g. 3.5" min="0" max="5" step="0.01" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="prior_education">Prior Education & Academic History *</label>
                <textarea
                  id="prior_education"
                  className="form-textarea"
                  style={{ minHeight: 200 }}
                  value={form.prior_education}
                  onChange={e => update('prior_education', e.target.value)}
                  placeholder="Please describe your educational history, including institutions attended, degrees earned, graduation dates, and any relevant certifications or training..."
                  required
                  aria-describedby="prior-edu-hint"
                  maxLength={5000}
                />
                <span id="prior-edu-hint" className="form-hint">{form.prior_education.length}/5000 characters (minimum 20)</span>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h2 style={{ marginBottom: '0.25rem' }}>Personal Statement</h2>
              <div className="alert alert-info" style={{ fontSize: '0.875rem' }} role="note">
                Please address: (1) your vocational goals and calling, (2) your church involvement, (3) why you chose BMI University, and (4) an assessment of your strengths and weaknesses.
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="personal_statement">Personal Statement *</label>
                <textarea
                  id="personal_statement"
                  className="form-textarea"
                  style={{ minHeight: 280 }}
                  value={form.personal_statement}
                  onChange={e => update('personal_statement', e.target.value)}
                  placeholder="Write your personal statement here (1–2 pages recommended)..."
                  required
                  aria-describedby="statement-hint"
                  maxLength={10000}
                />
                <span id="statement-hint" className="form-hint">{form.personal_statement.length}/10000 characters (minimum 100)</span>
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h2 style={{ marginBottom: '0.25rem' }}>Supporting Documents</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Upload transcripts, government-issued photo ID, or certificates. Documents can also be submitted later from your status page.
              </p>

              <div style={{ background: 'var(--bg)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <label className="form-label" htmlFor="doc-type-select">Document Type</label>
                    <select
                      id="doc-type-select"
                      className="form-select"
                      value={selectedDocType}
                      onChange={e => setSelectedDocType(e.target.value)}
                    >
                      <option value="transcript">Academic Transcript</option>
                      <option value="id_document">Passport / National ID</option>
                      <option value="other">Supporting Certificate / Other</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    📎 Select File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                    onChange={handleFileSelected}
                    style={{ display: 'none' }}
                  />
                </div>

                {stagedDocs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--slate)', border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📄</div>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>No documents attached yet (optional during submission).</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {stagedDocs.map(d => (
                      <div
                        key={d.id}
                        style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.75rem 1rem', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            {d.validation?.previewUrl ? (
                              <img
                                src={d.validation.previewUrl}
                                alt="Preview"
                                style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }}
                              />
                            ) : (
                              <div style={{ width: 36, height: 36, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, fontSize: '1.1rem' }}>
                                📄
                              </div>
                            )}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span className="badge badge-submitted" style={{ textTransform: 'capitalize', fontSize: '0.75rem' }}>
                                  {d.docType.replace('_', ' ')}
                                </span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{d.name}</span>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--slate)', marginTop: 2 }}>
                                {d.sizeKb} KB • {d.validation?.detectedFormat || 'Verified File'}
                                {d.validation?.dimensions && ` (${d.validation.dimensions.width}×${d.validation.dimensions.height}px)`}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeStagedDoc(d.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 800 }}
                            title="Remove file"
                          >
                            ✕
                          </button>
                        </div>

                        {d.validation?.warnings && d.validation.warnings.length > 0 && (
                          <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '0.4rem 0.6rem', borderRadius: 4, fontSize: '0.75rem', color: '#b45309' }}>
                            ⚠️ {d.validation.warnings.join(' ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h2 style={{ marginBottom: '0.5rem' }}>Review & Submit</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Please review your application before submitting.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { label: 'Applicant', value: `${user?.first_name} ${user?.last_name} (${user?.email})` },
                  { label: 'Program', value: form.program },
                  { label: 'Degree Level', value: form.degree_level.charAt(0).toUpperCase() + form.degree_level.slice(1) },
                  { label: 'Date of Birth', value: form.date_of_birth || 'Not provided' },
                  { label: 'Nationality', value: form.nationality || 'Not provided' },
                  { label: 'Attached Documents', value: `${stagedDocs.length} file(s) attached` },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>{row.label}</span>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', textAlign: 'right', maxWidth: '60%' }}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="alert alert-warning" style={{ marginTop: '1.5rem', fontSize: '0.875rem' }} role="note">
                ⚠️ Once submitted, you cannot edit your application directly. Any additional documents can be uploaded on your status page.
              </div>
            </div>
          )}

          {paymentDue && (
            <div className="alert alert-info" style={{ marginTop: '1.5rem', borderLeft: '4px solid #f59e0b', padding: '1rem' }}>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>💳 Application fee payment required</strong>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem' }}>
                A non-refundable application fee{paymentDue.formatted ? ` of ${paymentDue.formatted}` : ''} must be paid before your application can be submitted.
                {paymentDue.invoiceNumber ? ` Invoice: ${paymentDue.invoiceNumber}` : ''}
              </p>
              <button className="btn btn-navy" onClick={handlePayApplicationFee} disabled={payingFee} style={{ padding: '0.6rem 1.25rem', fontWeight: 700 }}>
                {payingFee ? '⏳ Processing…' : 'Pay Application Fee'}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', gap: '1rem' }}>
            {step > 0 ? (
              <button className="btn btn-outline" onClick={prev}>← Back</button>
            ) : <div />}
            {step < STEPS.length - 1 ? (
              <button
                className="btn btn-gold"
                onClick={next}
                disabled={step === 0 ? !canProceedStep0 : step === 1 ? !canProceedStep1 : step === 2 ? !canProceedStep2 : step === 3 ? !canProceedStep3 : false}
                aria-label={step === 0 ? 'Continue to personal info' : step === 2 ? 'Continue to statement' : 'Continue'}
              >
                Continue →
              </button>
            ) : (
              <button className="btn btn-navy" onClick={handleSubmit} disabled={loading}>
                {loading ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Submitting...</> : '✓ Submit Application'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
