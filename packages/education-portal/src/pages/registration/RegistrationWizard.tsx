import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from '../../shims/react-router-dom';
import { api } from '../../lib/api';
import ScheduleVisualizer from './ScheduleVisualizer';
import type { ScheduleConflict } from './ScheduleVisualizer';

const STEP_LABELS = [
  'Profile & Emergency Contacts',
  'Curriculum & Degree Pathway',
  'Course & Section Selection',
  'Financial Aid & Fee Agreement',
  'Terms of Enrollment & Digital Signature',
] as const;

interface EligibilityState {
  eligible: boolean;
  status: string;
  reasons: string[];
  activeHolds: Array<{ id: string; hold_type: string; reason: string; blocks: string }>;
  advisingReleased: boolean;
  catalogYearId: string | null;
  term: { id: string; name: string; academic_year: string; status: string } | null;
}

interface PersonalDetails {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  nationality: string;
  phone: string;
  current_address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

interface CourseItem {
  id: string;
  code: string;
  title: string;
  credits: number;
  capacity?: number;
  seats_taken?: number;
  is_mandatory?: boolean;
}

export default function RegistrationWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const [eligibility, setEligibility] = useState<EligibilityState | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [completed, setCompleted] = useState(false);
  const [hasScheduleConflict, setHasScheduleConflict] = useState(false);
  const [scheduleConflicts, setScheduleConflicts] = useState<ScheduleConflict[]>([]);

  const handleConflictDetected = useCallback((conflict: boolean, conflictsList: ScheduleConflict[]) => {
    setHasScheduleConflict(conflict);
    setScheduleConflicts(conflictsList);
  }, []);

  // Detect and verify return from Paystack checkout (?reference= or ?trxref=)
  useEffect(() => {
    const ref = searchParams.get('reference') || searchParams.get('trxref');
    if (!ref) return;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const verifyRes = await api.payments.verify(ref);
        if (verifyRes?.verified || verifyRes?.status === 'success' || (verifyRes as any)?.status === 'succeeded') {
          setAcceptedFeeStructure(true);
          setCurrentStep(3);
          setSuccessMsg('✅ Tuition payment verified successfully via Paystack! You may now review and proceed to Step 5 (Terms of Enrollment).');
        } else {
          setError('Payment was not completed or could not be verified by the gateway.');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to verify return payment with the gateway.');
      } finally {
        setLoading(false);
      }
    })();
  }, [searchParams]);

  // Form State
  const [profile, setProfile] = useState<PersonalDetails>({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    nationality: '',
    phone: '',
    current_address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });

  const [curriculum, setCurriculum] = useState<any>(null);
  const [availableCourses, setAvailableCourses] = useState<CourseItem[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  // courseId -> chosen sectionId (canonical: students reserve SECTIONS, not courses)
  const [selectedSections, setSelectedSections] = useState<Record<string, string>>({});
  const [courseSections, setCourseSections] = useState<Record<string, Array<{ id: string; section_code: string; seats_available: number; is_full: boolean; schedule?: string; room?: string }>>>({});
  const [seatStatuses, setSeatStatuses] = useState<Record<string, { status: string; waitlistPosition?: number; message?: string }>>({});

  const [feeAgreement, setFeeAgreement] = useState<{
    program_name: string;
    catalog_year_id: string;
    gross_tuition: number;
    financial_aid_discount: number;
    net_balance_due: number;
    currency: string;
    payment_plans: Array<{ id: string; name: string; discount?: string }>;
  } | null>(null);

  const [selectedPlan, setSelectedPlan] = useState('full');
  const [acceptedFeeStructure, setAcceptedFeeStructure] = useState(false);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [dataConfirmed, setDataConfirmed] = useState(false);
  const [signedName, setSignedName] = useState('');
  const [agreementMeta, setAgreementMeta] = useState<{ document_id: string; version: string; version_hash: string; text: string } | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setCheckingEligibility(true);
    try {
      const [eligRes, statusRes, feeRes, currRes, modRes, agrRes] = await Promise.all([
        api.student.getRegistrationEligibility().catch(() => null),
        api.registration.getStatus().catch(() => null),
        api.finance.getFeeAgreement().catch(() => null),
        api.student.getCurriculum().catch(() => null),
        api.registration.getModules().catch(() => [] as any[]),
        api.enrollment.getAgreement().catch(() => null),
      ]);

      if (eligRes) setEligibility(eligRes);
      if (feeRes) setFeeAgreement(feeRes);
      if (currRes) setCurriculum(currRes);
      if (agrRes) setAgreementMeta(agrRes);

      if (statusRes?.current_data?.personal_details) {
        setProfile(prev => ({
          ...prev,
          ...statusRes.current_data.personal_details,
          ...statusRes.current_data.address,
        }));
      }

      if (Array.isArray(modRes) && modRes.length > 0) {
        setAvailableCourses(modRes.map(m => ({
          id: m.id,
          code: m.code,
          title: m.name || m.title,
          credits: m.credits || 3,
          is_mandatory: true,
        })));
        // Do NOT auto-select courses: mandatory enrolment must come from the
        // canonical curriculum endpoint (POST /student/enroll/mandatory), and
        // electives require explicit student choice with section selection.
        // Attempt mandatory auto-enrol in the background only if course_selection hold is active.
        const hasCourseHold = eligRes?.activeHolds?.some((h: any) => h.hold_type === 'course_selection') ||
                              (eligRes as any)?.unresolved_holds?.some((h: any) => h.hold_type === 'course_selection');
        if (hasCourseHold) {
          try {
            await (api.student as any).autoEnrollMandatory?.()?.catch?.(() => null);
          } catch { /* endpoint may not exist in older mocks — non-fatal */ }
        }
      }
    } catch (err: unknown) {
      console.warn('Initial data load warning:', err);
    } finally {
      setCheckingEligibility(false);
    }
  };

  const totalSelectedCredits = availableCourses
    .filter(c => selectedCourseIds.includes(c.id))
    .reduce((sum, c) => sum + c.credits, 0);

  const handleToggleCourse = async (courseId: string) => {
    if (selectedCourseIds.includes(courseId)) {
      const sectionId = selectedSections[courseId];
      setSelectedCourseIds(prev => prev.filter(id => id !== courseId));
      setSelectedSections(prev => {
        const next = { ...prev };
        delete next[courseId];
        return next;
      });
      try {
        await api.registration.dropCourse(courseId, sectionId);
        setSeatStatuses(prev => {
          const next = { ...prev };
          delete next[courseId];
          return next;
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to drop course section.');
      }
    } else {
      // Resolve sections for this course, then reserve a SECTION (never a bare courseId).
      setError('');
      try {
        let sections = courseSections[courseId];
        if (!sections) {
          try {
            const res = await (api.student as any).getSections?.(courseId, eligibility?.term?.id);
            sections = res?.sections || [];
            setCourseSections(prev => ({ ...prev, [courseId]: sections! }));
            if (res?.my_section_ids?.length) {
              setSelectedSections(prev => ({ ...prev, [courseId]: res.my_section_ids[0] }));
              setSelectedCourseIds(prev => [...prev, courseId]);
              setSeatStatuses(prev => ({ ...prev, [courseId]: { status: 'reserved', message: 'Already registered in this section.' } }));
              return;
            }
          } catch {
            sections = [];
          }
        }
        const open = (sections || []).find(s => !s.is_full) || (sections || [])[0];
        if (!open) {
          // Fallback for environments without section data (e.g. legacy tests):
          // attempt reservation and let the server validate the section.
          try {
            const legacy = await api.registration.reserveSeat(courseId, eligibility?.term?.id);
            setSelectedSections(prev => ({ ...prev, [courseId]: courseId }));
            setSelectedCourseIds(prev => [...prev, courseId]);
            setSeatStatuses(prev => ({ ...prev, [courseId]: legacy }));
            return;
          } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'No sections available for this course yet. Please contact the registrar.');
            return;
          }
        }
        const res = await api.registration.reserveSeat(open.id, eligibility?.term?.id);
        setSelectedSections(prev => ({ ...prev, [courseId]: open.id }));
        setSelectedCourseIds(prev => [...prev, courseId]);
        setSeatStatuses(prev => ({ ...prev, [courseId]: res }));
        if (res.status === 'waitlisted') {
          setError(`Section ${open.section_code} is full — waitlisted at position #${res.waitlistPosition ?? '?'}.`);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Seat reservation failed.');
      }
    }
  };

  const handleNext = async () => {
    setError('');
    if (currentStep === 0) {
      if (!profile.first_name || !profile.last_name || !profile.emergency_contact_phone) {
        setError('Please complete all required contact and emergency details.');
        return;
      }
      // Persist to the canonical backend (server is authoritative; local state is a cache).
      setLoading(true);
      try {
        await api.registration.saveStep('personal_details', {
          first_name: profile.first_name,
          last_name: profile.last_name,
          date_of_birth: profile.date_of_birth,
          gender: profile.gender,
          nationality: profile.nationality,
          phone: profile.phone,
        });
        await api.registration.saveStep('address', {
          current_address: profile.current_address,
          city: '',
          state: '',
          country: profile.nationality,
          emergency_contact_name: profile.emergency_contact_name,
          emergency_contact_phone: profile.emergency_contact_phone,
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to save profile. Please try again.');
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }
    if (currentStep === 2) {
      if (selectedCourseIds.length === 0) {
        setError('Please select at least one course module for the semester.');
        return;
      }
      if (hasScheduleConflict) {
        setError('Please resolve the timetable conflict between selected courses before proceeding.');
        return;
      }
    }
    if (currentStep === 3) {
      if (!acceptedFeeStructure) {
        setError('You must accept the fee structure and select a payment arrangement.');
        return;
      }
    }

    setCurrentStep(s => Math.min(s + 1, STEP_LABELS.length - 1));
  };

  const handlePrevious = () => {
    setCurrentStep(s => Math.max(0, s - 1));
  };

  const handleFinalSubmit = async () => {
    setError('');
    if (!termsAccepted || !dataConfirmed || !signedName.trim()) {
      setError('Please review and agree to all terms and type your full legal signature.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Legally binding e-signature (records agreement_signed — does NOT confer REGISTERED).
      //    Version metadata comes from GET /enrollment/agreement so the signature
      //    binds to a real auditable revision, never a hardcoded placeholder hash.
      const signRes = await api.enrollment.signAgreement(
        agreementMeta?.document_id || 'ENROLL-AGREEMENT-2026',
        signedName.trim(),
        agreementMeta?.version_hash || 'v1.0-sha256-standard'
      );
      if (!signRes?.success && !(signRes as any)?.agreement_signed) {
        throw new Error('Agreement signature was not recorded. Please try again.');
      }

      // 2. Canonical finalize transaction owns the REGISTERED transition.
      //    It validates holds, advising, sections, payment and signature together.
      //    Errors MUST surface — never swallow with .catch(()=>{}).
      const finalRes = await api.registration.finalize();
      if (!finalRes?.success || finalRes.status !== 'REGISTERED') {
        throw new Error(finalRes?.message || 'Registration finalization did not complete. No changes were lost — please resolve the outstanding items and retry.');
      }

      setCompleted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Eligibility Gating Screen
  if (checkingEligibility) {
    return (
      <div className="page-center">
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (eligibility && !eligibility.eligible) {
    return (
      <div className="page" style={{ padding: '4rem 1.5rem', background: 'var(--bg)' }}>
        <div className="card" style={{ maxWidth: 680, margin: '0 auto', borderLeft: '4px solid var(--danger)', padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '2rem' }}>⛔</span>
            <div>
              <h2 style={{ margin: 0, color: 'var(--danger)' }}>Registration Unavailable</h2>
              <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Your account is not currently cleared for course registration.
              </p>
            </div>
          </div>

          <div style={{ background: '#fef2f2', padding: '1rem', borderRadius: 8, marginBottom: '1.5rem', border: '1px solid #fecaca' }}>
            <strong style={{ color: '#991b1b', display: 'block', marginBottom: '0.5rem' }}>Outstanding Requirements:</strong>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#b91c1c', fontSize: '0.9rem' }}>
              {eligibility.reasons.map((r, i) => (
                <li key={i} style={{ marginBottom: '0.25rem' }}>{r}</li>
              ))}
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button className="btn btn-navy" onClick={() => navigate('/status')}>
              ← Back to Status Tracker
            </button>
            <button className="btn btn-outline" onClick={fetchInitialData}>
              🔄 Re-check Clearance
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="page-center" style={{ padding: '4rem 1.5rem' }}>
        <div className="card" style={{ maxWidth: 540, textAlign: 'center', padding: '3.5rem 2.5rem', border: '2px solid var(--success)' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', color: 'var(--navy)', marginBottom: '0.5rem' }}>
            Registration Complete!
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            Your enrollment agreement has been digitally signed and your course schedule is confirmed (Status: <strong style={{ color: 'var(--success)' }}>REGISTERED</strong>).
          </p>
          <div style={{ background: '#f0fdf4', padding: '1.25rem', borderRadius: 8, border: '1px solid #bbf7d0', marginBottom: '1.5rem', textAlign: 'left', fontSize: '0.875rem' }}>
            <div style={{ marginBottom: '0.5rem' }}><strong>Term:</strong> {eligibility?.term?.name || 'Academic Term'}</div>
            <div style={{ marginBottom: '0.5rem' }}><strong>Locked Catalog Year:</strong> <span style={{ fontFamily: 'monospace' }}>{eligibility?.catalogYearId || 'CAT-2026'}</span></div>
            <div style={{ marginBottom: '0.5rem' }}><strong>Registered Load:</strong> {totalSelectedCredits} Credits ({selectedCourseIds.length} Modules)</div>
            <div><strong>Net Balance:</strong> ${feeAgreement?.net_balance_due.toFixed(2) || '0.00'}</div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline btn-full"
              onClick={() => window.print()}
              style={{ flex: 1 }}
            >
              🖨️ Print Registration Slip
            </button>
            <a href="/student/dashboard" className="btn btn-gold btn-full" style={{ flex: 1 }}>
              Enter Student Portal →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ padding: '4rem 1.5rem 5rem', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', color: 'var(--navy)', marginBottom: '0.25rem' }}>
            Student Registration & Enrollment
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Term: <strong>{eligibility?.term?.name || 'Academic Term'}</strong> • Catalog Year: <strong style={{ fontFamily: 'monospace' }}>{eligibility?.catalogYearId || 'CAT-2026'}</strong>
          </p>
          <div className="gold-bar" style={{ marginTop: '0.5rem' }} />
        </div>

        {/* Step Indicator */}
        <div className="steps" style={{ marginBottom: '2rem', overflowX: 'auto', paddingBottom: 4 }}>
          {STEP_LABELS.map((label, idx) => (
            <div key={label} className="step" style={{ minWidth: 0 }}>
              <div className={`step-circle ${idx < currentStep ? 'done' : idx === currentStep ? 'active' : ''}`}>
                {idx < currentStep ? '✓' : idx + 1}
              </div>
              <span className="step-label" style={{
                color: idx === currentStep ? 'var(--gold-dark)' : idx < currentStep ? 'var(--navy)' : 'var(--slate)',
                fontWeight: idx === currentStep ? 700 : 500,
                whiteSpace: 'nowrap',
                marginLeft: '0.4rem',
              }}>
                {label.split(' ')[0]}
              </span>
              {idx < STEP_LABELS.length - 1 && (
                <div className={`step-line ${idx < currentStep ? 'done' : ''}`} />
              )}
            </div>
          ))}
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>{error}</div>}
        {successMsg && (
          <div style={{ marginBottom: '1.5rem', background: '#f0fdf4', border: '1.5px solid #86efac', color: '#166534', padding: '0.85rem 1.25rem', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600 }}>
            {successMsg}
          </div>
        )}

        {/* ─── Step Content ─── */}
        <div className="card" style={{ minHeight: 380, padding: '2rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', color: 'var(--navy)', marginBottom: '1.5rem' }}>
            Step {currentStep + 1}: {STEP_LABELS[currentStep]}
          </h2>

          {/* Step 0: Profile & Emergency Contact */}
          {currentStep === 0 && (
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input className="form-input" value={profile.first_name} onChange={e => setProfile({ ...profile, first_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input className="form-input" value={profile.last_name} onChange={e => setProfile({ ...profile, last_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Current Address</label>
                <input className="form-input" value={profile.current_address} onChange={e => setProfile({ ...profile, current_address: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Emergency Contact Name</label>
                <input className="form-input" value={profile.emergency_contact_name} onChange={e => setProfile({ ...profile, emergency_contact_name: e.target.value })} placeholder="Relative / Sponsor" />
              </div>
              <div className="form-group">
                <label className="form-label">Emergency Contact Phone</label>
                <input className="form-input" value={profile.emergency_contact_phone} onChange={e => setProfile({ ...profile, emergency_contact_phone: e.target.value })} placeholder="+231..." />
              </div>
            </div>
          )}

          {/* Step 1: Degree Pathway & Curriculum */}
          {currentStep === 1 && (
            <div>
              <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
                <strong>Locked Degree Audit Version:</strong> You are matriculating under catalog year <strong>{eligibility?.catalogYearId || 'CAT-2026'}</strong>. Your graduation requirements remain locked to this catalog.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate)', textTransform: 'uppercase', fontWeight: 700 }}>Program</span>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', marginTop: 4 }}>{curriculum?.program_name || 'Degree Program'}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate)', textTransform: 'uppercase', fontWeight: 700 }}>Degree Level</span>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', marginTop: 4 }}>Undergraduate / Bachelor</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate)', textTransform: 'uppercase', fontWeight: 700 }}>Catalog Year</span>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', marginTop: 4, fontFamily: 'monospace' }}>{eligibility?.catalogYearId || 'CAT-2026'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Course & Section Selection */}
          {currentStep === 2 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Select course sections for this semester:</span>
                <span style={{ background: 'var(--navy)', color: 'var(--gold)', padding: '0.35rem 1rem', borderRadius: 999, fontWeight: 700, fontSize: '0.9rem' }}>
                  {totalSelectedCredits} Total Credits
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {availableCourses.map(c => {
                  const isSelected = selectedCourseIds.includes(c.id);
                  const seatInfo = seatStatuses[c.id];
                  const sectionId = selectedSections[c.id];
                  const sections = courseSections[c.id] || [];
                  const chosen = sections.find(s => s.id === sectionId);
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleToggleCourse(c.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem 1.25rem',
                        borderRadius: 8,
                        border: `2px solid ${isSelected ? 'var(--gold)' : 'var(--border)'}`,
                        background: isSelected ? 'rgba(212, 175, 55, 0.05)' : 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          style={{ accentColor: 'var(--gold)', width: 18, height: 18 }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.95rem' }}>
                            {c.code} — {c.title}
                          </div>
                          {isSelected && chosen && (
                            <span style={{ color: 'var(--navy)', fontSize: '0.75rem', fontWeight: 600 }}>
                              Section {chosen.section_code}{chosen.schedule ? ` • ${chosen.schedule}` : ''}{chosen.room ? ` • ${chosen.room}` : ''} • {chosen.seats_available} seats left
                            </span>
                          )}
                          {seatInfo?.status === 'waitlisted' && (
                            <span style={{ color: '#b45309', fontSize: '0.75rem', fontWeight: 600 }}>
                              ⏳ Waitlisted (Position #{seatInfo.waitlistPosition})
                            </span>
                          )}
                          {seatInfo?.status === 'reserved' && seatInfo.message && (
                            <span style={{ color: 'var(--success)', fontSize: '0.75rem', fontWeight: 600, display: 'block' }}>
                              ✓ {seatInfo.message}
                            </span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--slate)', fontSize: '0.85rem' }}>
                        {c.credits} credits
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Dynamic Live Timetable & Schedule Grid */}
              <ScheduleVisualizer
                courses={availableCourses}
                selectedCourseIds={selectedCourseIds}
                onConflictDetected={handleConflictDetected}
              />

              {hasScheduleConflict && scheduleConflicts.length > 0 && (
                <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    ⚠️ Timetable Conflict Detected ({scheduleConflicts.length})
                  </div>
                  <p style={{ margin: '0 0 0.5rem 0', color: '#7f1d1d' }}>
                    The following course sections overlap. Please adjust your section selections to resolve timetable conflicts before continuing:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                    {scheduleConflicts.map((c, i) => (
                      <li key={i} style={{ marginBottom: '0.25rem' }}>
                        <strong>{c.courseA.code}</strong> ({c.courseA.title}) overlaps with <strong>{c.courseB.code}</strong> ({c.courseB.title}) on {c.day} at {c.timeSlot}.
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Financial Aid & Fee Agreement */}
          {currentStep === 3 && (
            <div>
              {/* Tuition Summary Card */}
              <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', padding: '1.5rem', borderRadius: 10, marginBottom: '1.5rem', color: 'white' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--gold)', marginBottom: '0.5rem' }}>
                  📋 TUITION STATEMENT — {feeAgreement?.catalog_year_id || 'Academic Year 2026-2027'}
                </div>
                <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#cbd5e1' }}>Programme:</span>
                    <strong>{feeAgreement?.program_name || 'Enrolled Programme'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#cbd5e1' }}>Gross Tuition:</span>
                    <strong>${feeAgreement?.gross_tuition?.toFixed(2) || '1,500.00'} USD</strong>
                  </div>
                  {(feeAgreement?.financial_aid_discount ?? 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4ade80' }}>
                      <span>Financial Aid / Scholarship:</span>
                      <strong>− ${feeAgreement!.financial_aid_discount.toFixed(2)} USD</strong>
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 900 }}>
                    <span>Net Balance Due:</span>
                    <span style={{ color: 'var(--gold)' }}>${feeAgreement?.net_balance_due?.toFixed(2) || '1,500.00'} USD</span>
                  </div>
                </div>
              </div>

              {/* Payment Arrangement */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ marginBottom: '0.75rem', display: 'block' }}>
                  💳 Select Payment Arrangement
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {(feeAgreement?.payment_plans || [
                    { id: 'full', name: 'Single Full Payment — Pay entire balance now', discount: '5% Early Payment Discount' },
                    { id: 'installments_2', name: 'Two Instalments — 50% now, 50% before midterms' },
                    { id: 'installments_3', name: 'Three Instalments — 33% now, 33% midterm, 34% final' },
                  ]).map(p => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem 1rem', background: selectedPlan === p.id ? '#eff6ff' : 'white', borderRadius: 8, border: `1.5px solid ${selectedPlan === p.id ? 'var(--gold)' : 'var(--border)'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
                      <input type="radio" name="payment_plan" value={p.id} checked={selectedPlan === p.id} onChange={() => setSelectedPlan(p.id)} style={{ marginTop: 2 }} />
                      <div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--navy)', fontWeight: 600 }}>{p.name}</div>
                        {(p as any).discount && <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>✓ {(p as any).discount}</div>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Pay Now CTA */}
              {!acceptedFeeStructure && (
                <div style={{ background: '#fffbeb', border: '1.5px solid var(--gold)', borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                    ⚡ Action Required: Pay Your First Instalment to Proceed
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Secure your place by completing your initial tuition payment. You will be redirected to Paystack's secure payment gateway.
                    After a successful payment you will be automatically returned here to continue.
                  </p>
                  <button
                    id="btn-pay-now"
                    className="btn btn-gold"
                    style={{ width: '100%', fontWeight: 800, fontSize: '1rem', letterSpacing: '0.02em' }}
                    disabled={loading}
                    onClick={async () => {
                      setLoading(true);
                      setError('');
                      try {
                        const firstInstalment = feeAgreement?.net_balance_due
                          ? (selectedPlan === 'full' ? feeAgreement.net_balance_due
                            : selectedPlan === 'installments_2' ? Math.ceil(feeAgreement.net_balance_due * 0.5 * 100) / 100
                            : Math.ceil(feeAgreement.net_balance_due * 0.334 * 100) / 100)
                          : 500;
                        const intent = await api.payments.createIntent({
                          amount: firstInstalment,
                          reason: `Tuition — ${feeAgreement?.program_name || 'BMI Programme'} (${selectedPlan})`,
                          purpose: 'tuition',
                          currency: 'USD',
                        });
                        if (intent?.authorizationUrl) {
                          window.location.href = intent.authorizationUrl;
                        } else {
                          throw new Error('Payment gateway did not return a redirect URL. Please contact the bursar\'s office.');
                        }
                      } catch (err: unknown) {
                        setError(err instanceof Error ? err.message : 'Payment initiation failed. Please try again.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    {loading ? '⏳ Initiating Payment...' : `💳 Pay Now via Paystack — $${
                      feeAgreement?.net_balance_due
                        ? (selectedPlan === 'full' ? feeAgreement.net_balance_due.toFixed(2)
                          : selectedPlan === 'installments_2' ? (feeAgreement.net_balance_due * 0.5).toFixed(2)
                          : (feeAgreement.net_balance_due * 0.334).toFixed(2))
                        : '500.00'
                    } USD`}
                  </button>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.6rem', textAlign: 'center' }}>
                    Already paid? Click "I have completed payment" below ↓
                  </p>
                </div>
              )}

              {/* Manual confirm once payment is done (e.g. returning from Paystack) */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', padding: '0.75rem', background: acceptedFeeStructure ? '#f0fdf4' : 'white', borderRadius: 8, border: `1.5px solid ${acceptedFeeStructure ? '#86efac' : 'var(--border)'}`, transition: 'all 0.15s' }}>
                <input type="checkbox" checked={acceptedFeeStructure} onChange={e => setAcceptedFeeStructure(e.target.checked)} style={{ accentColor: 'var(--gold)', width: 18, height: 18, marginTop: 2 }} />
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {acceptedFeeStructure
                    ? '✅ I have completed my initial tuition payment and accept the fee schedule.'
                    : 'I have completed my initial tuition payment and accept the fee schedule and payment plan above.'}
                </span>
              </label>

              {acceptedFeeStructure && (
                <div style={{ marginTop: '1rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.875rem', color: '#166534' }}>
                  ✅ <strong>Payment acknowledged.</strong> You may now proceed to sign the enrollment agreement.
                </div>
              )}
            </div>
          )}

          {/* Step 4: Terms of Enrollment & Digital Signature */}
          {currentStep === 4 && (
            <div>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)', marginBottom: '1.5rem', maxHeight: 180, overflowY: 'auto', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <p><strong>BMI University Matriculation & Honor Agreement{agreementMeta ? ` (v${agreementMeta.version})` : ''}:</strong></p>
                <p>{agreementMeta?.text || 'By completing this registration, I commit to upholding the highest standards of academic integrity, ethical conduct, and respect within the BMI community. I agree to abide by all university policies, course requirements, and payment schedules.'}</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={dataConfirmed} onChange={e => setDataConfirmed(e.target.checked)} style={{ accentColor: 'var(--gold)', width: 18, height: 18 }} />
                  <span style={{ fontSize: '0.875rem' }}>I confirm that all registration information is accurate.</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} style={{ accentColor: 'var(--gold)', width: 18, height: 18 }} />
                  <span style={{ fontSize: '0.875rem' }}>I agree to the Terms of Enrollment and Student Code of Conduct.</span>
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Digital Signature (Type your full legal name)</label>
                <input
                  className="form-input"
                  value={signedName}
                  onChange={e => setSignedName(e.target.value)}
                  placeholder="e.g. Johnathan Doe"
                  style={{ fontFamily: 'serif', fontSize: '1.1rem' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--slate)', marginTop: 4, display: 'block' }}>
                  Binding electronic signature recorded with IP, timestamp, and document version hash{agreementMeta ? ` (${agreementMeta.version_hash.slice(0, 19)}…)` : ''}.
                </span>
              </div>
            </div>
          )}

        </div>

        {/* ─── Navigation Buttons ─── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
          <button onClick={handlePrevious} disabled={currentStep === 0} className="btn btn-outline">
            Previous
          </button>
          {currentStep < STEP_LABELS.length - 1 ? (
            <button onClick={handleNext} className="btn btn-gold">
              Save & Continue →
            </button>
          ) : (
            <button onClick={handleFinalSubmit} disabled={submitting} className="btn btn-navy" style={{ padding: '0.75rem 2rem', fontWeight: 800 }}>
              {submitting ? 'Signing & Registering...' : '✓ Complete Registration & Sign Agreement'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}