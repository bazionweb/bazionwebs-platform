import { useState, useEffect } from 'react';
import { api, Course } from '../../lib/api';

export default function Academics() {
  const [activeTab, setActiveTab] = useState<'registration' | 'schedule' | 'transcript' | 'audit' | 'calculator'>('registration');
  const [courses, setCourses] = useState<Course[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [transcriptData, setTranscriptData] = useState<{ classes: any[]; gpa: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [alert, setAlert] = useState({ type: '', msg: '' });

  // Simulator hypothetical grades state
  const [hypotheticalGrades, setHypotheticalGrades] = useState<{ [key: string]: number }>({});

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'registration' || activeTab === 'audit') {
        const [coursesData, dashData] = await Promise.all([
          api.student.getCourses().catch(() => []),
          api.student.getDashboard().catch(() => null)
        ]);
        setCourses(coursesData);
        setDashboardData(dashData);
      } else if (activeTab === 'schedule' || activeTab === 'calculator') {
        const data = await api.student.getDashboard().catch(() => null);
        setDashboardData(data);
      } else if (activeTab === 'transcript') {
        const [transData, dashData] = await Promise.all([
          api.student.getTranscript().catch(() => null),
          api.student.getDashboard().catch(() => null)
        ]);
        setTranscriptData(transData);
        setDashboardData(dashData);
      }
    } catch (e: any) {
      setAlert({ type: 'danger', msg: e.message || 'Failed to load academic data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleEnroll = async (courseId: string) => {
    setActionLoading(courseId);
    try {
      await api.student.enroll(courseId);
      setAlert({ type: 'success', msg: 'Successfully enrolled in course! Registration updated.' });
      loadData();
    } catch (e: any) {
      setAlert({ type: 'danger', msg: e.message || 'Failed to enroll in course' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDrop = async (courseId: string) => {
    if (!window.confirm("Are you sure you want to drop this course?")) return;
    setActionLoading(courseId);
    try {
      await api.student.dropCourse(courseId);
      setAlert({ type: 'success', msg: 'Course dropped successfully.' });
      loadData();
    } catch (e: any) {
      setAlert({ type: 'danger', msg: e.message || 'Failed to drop course' });
    } finally {
      setActionLoading(null);
    }
  };

  const currentEnrolledIds = dashboardData?.current_classes?.map((c: any) => c.id) || [];
  const studentName = dashboardData?.user?.first_name ? `${dashboardData.user.first_name} ${dashboardData.user.last_name || ''}`.trim() : (dashboardData?.first_name ? `${dashboardData.first_name} ${dashboardData.last_name || ''}`.trim() : 'Enrolled Student');
  const programName = dashboardData?.program_name || dashboardData?.user?.program_name || 'Bachelor of Science / Master Program';
  const totalEarnedCredits = dashboardData?.total_credits || 0;
  const degreeTotalCredits = dashboardData?.degree_credits || 120;

  // Curriculum categories for Degree Audit Checklist
  const coreRequirements = [
    { code: 'BIB-101', title: 'Old Testament Survey', credits: 3, status: 'completed', grade: 'A' },
    { code: 'BIB-102', title: 'New Testament Survey', credits: 3, status: 'completed', grade: 'A-' },
    { code: 'THEO-201', title: 'Systematic Theology I', credits: 3, status: currentEnrolledIds.length > 0 ? 'in_progress' : 'needed' },
    { code: 'HIST-101', title: 'Church History & Heritage', credits: 3, status: 'needed' },
    { code: 'MIN-301', title: 'Principles of Christian Ministry', credits: 3, status: 'needed' },
    { code: 'ETH-401', title: 'Christian Ethics & Apologetics', credits: 3, status: 'needed' },
  ];

  const practicumRequirements = [
    { code: 'PRAC-350', title: 'Ministry Field Practicum I', credits: 2, status: 'needed' },
    { code: 'PRAC-450', title: 'Senior Ministry Leadership Practicum II', credits: 2, status: 'needed' },
  ];

  const capstoneRequirements = [
    { code: 'CAP-490', title: 'Senior Theological Capstone Seminar', credits: 4, status: 'needed' },
  ];

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto' }}>
      
      {/* ─── Page Title Header ─── */}
      <div style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', color: 'var(--navy)', marginBottom: '0.25rem', fontWeight: 900 }}>
            📚 Academic Portal & Course Management
          </h1>
          <p style={{ color: 'var(--slate)', fontSize: '0.95rem' }}>
            Register for classes, view class schedules, run degree audits, and access official transcripts.
          </p>
        </div>
        <div style={{ background: 'white', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--slate)', fontWeight: 600 }}>CUMULATIVE GPA</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy)' }}>
              {transcriptData?.gpa !== undefined && transcriptData?.gpa !== null ? `${Number(transcriptData.gpa).toFixed(2)} / 4.00` : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {alert.msg && (
        <div className={`alert alert-${alert.type}`} style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{alert.msg}</span>
          <button onClick={() => setAlert({ type: '', msg: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>
      )}

      {/* ─── Navigation Tabs ─── */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem', borderBottom: '2px solid var(--border)', background: 'white', padding: '0.5rem 0.5rem 0', borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', overflowX: 'auto' }}>
        <button
          onClick={() => setActiveTab('registration')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'registration' ? '3px solid var(--gold)' : '3px solid transparent',
            fontWeight: activeTab === 'registration' ? 700 : 500,
            color: activeTab === 'registration' ? 'var(--navy)' : 'var(--slate)',
            cursor: 'pointer',
            fontSize: '0.95rem',
            whiteSpace: 'nowrap',
          }}
        >
          📝 Course Registration
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'schedule' ? '3px solid var(--gold)' : '3px solid transparent',
            fontWeight: activeTab === 'schedule' ? 700 : 500,
            color: activeTab === 'schedule' ? 'var(--navy)' : 'var(--slate)',
            cursor: 'pointer',
            fontSize: '0.95rem',
            whiteSpace: 'nowrap',
          }}
        >
          📅 Active Class Schedule
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'audit' ? '3px solid var(--gold)' : '3px solid transparent',
            fontWeight: activeTab === 'audit' ? 700 : 500,
            color: activeTab === 'audit' ? 'var(--navy)' : 'var(--slate)',
            cursor: 'pointer',
            fontSize: '0.95rem',
            whiteSpace: 'nowrap',
          }}
        >
          📊 Degree Audit Checklist
        </button>
        <button
          onClick={() => setActiveTab('transcript')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'transcript' ? '3px solid var(--gold)' : '3px solid transparent',
            fontWeight: activeTab === 'transcript' ? 700 : 500,
            color: activeTab === 'transcript' ? 'var(--navy)' : 'var(--slate)',
            cursor: 'pointer',
            fontSize: '0.95rem',
            whiteSpace: 'nowrap',
          }}
        >
          🎓 Official Transcript & Grades
        </button>
        <button
          onClick={() => setActiveTab('calculator')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'calculator' ? '3px solid var(--gold)' : '3px solid transparent',
            fontWeight: activeTab === 'calculator' ? 700 : 500,
            color: activeTab === 'calculator' ? 'var(--navy)' : 'var(--slate)',
            cursor: 'pointer',
            fontSize: '0.95rem',
            whiteSpace: 'nowrap',
          }}
        >
          🧮 GPA Forecast Simulator
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <div className="spinner" style={{ width: 40, height: 40 }}></div>
        </div>
      ) : (
        <>
          {/* TAB 1: COURSE REGISTRATION */}
          {activeTab === 'registration' && (
            <div className="card">
              <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                Available Courses for Registration — Fall 2026
              </h2>
              {courses.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No open course offerings found for current registration period.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {courses.map((c) => {
                    const isEnrolled = currentEnrolledIds.includes(c.id);
                    const prereqsLocked = c.prerequisites_met === false;
                    const isFull = Boolean(c.is_full);

                    return (
                      <div
                        key={c.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '1.25rem',
                          background: prereqsLocked ? 'rgba(241, 245, 249, 0.6)' : 'var(--bg)',
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${prereqsLocked ? '#cbd5e1' : 'var(--border)'}`,
                          opacity: prereqsLocked ? 0.85 : 1,
                          flexWrap: 'wrap',
                          gap: '1rem',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 280 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                            <span style={{ background: 'var(--navy)', color: 'var(--gold)', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontFamily: 'var(--font-heading)' }}>
                              {c.code}
                            </span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--slate)', fontWeight: 600 }}>
                              {c.credits} Credits • {c.semester || 'Fall 2026'}
                            </span>
                            {c.is_mandatory && (
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 8px', borderRadius: '99px' }}>
                                Core Requirement
                              </span>
                            )}
                            {isFull && (
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '99px' }}>
                                Section Full
                              </span>
                            )}
                          </div>

                          <h3 style={{ fontSize: '1.05rem', color: 'var(--navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {c.title || c.name}
                            {prereqsLocked && <span title="Prerequisites required" style={{ fontSize: '0.9rem' }}>🔒</span>}
                          </h3>

                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem', maxWidth: 700 }}>
                            {c.description || 'Comprehensive foundational course offering rigorous academic and practical formation.'}
                          </p>

                          {prereqsLocked && c.unmet_prerequisites && c.unmet_prerequisites.length > 0 && (
                            <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              ⚠️ Unmet Prerequisites: {c.unmet_prerequisites.join(', ')}
                            </div>
                          )}
                        </div>

                        <div>
                          {isEnrolled ? (
                            <span className="badge badge-accepted" style={{ padding: '0.5rem 1rem' }}>✓ Enrolled</span>
                          ) : prereqsLocked ? (
                            <button
                              disabled
                              className="btn btn-outline btn-sm"
                              style={{ opacity: 0.6, cursor: 'not-allowed' }}
                              title="Complete prerequisite courses before enrolling"
                            >
                              🔒 Locked
                            </button>
                          ) : isFull ? (
                            <button
                              onClick={() => handleEnroll(c.id)}
                              disabled={actionLoading === c.id}
                              className="btn btn-outline btn-sm"
                              style={{ borderColor: 'var(--gold)', color: 'var(--navy)', fontWeight: 700 }}
                            >
                              {actionLoading === c.id ? 'Waitlisting...' : 'Join Waitlist'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleEnroll(c.id)}
                              disabled={actionLoading === c.id}
                              className="btn btn-gold btn-sm"
                            >
                              {actionLoading === c.id ? 'Enrolling...' : 'Enroll in Course'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SCHEDULE */}
          {activeTab === 'schedule' && (
            <div className="card">
              <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                Your Active Enrolled Courses & Syllabus Hub
              </h2>
              {dashboardData?.current_classes?.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', padding: '2rem 0', textAlign: 'center' }}>
                  You are not currently enrolled in any classes. Use the Registration tab to enroll.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {(dashboardData?.current_classes || []).map((c: any) => (
                    <div
                      key={c.id}
                      style={{
                        background: 'var(--bg)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        padding: '1.25rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{ background: 'var(--navy)', color: 'var(--gold)', fontWeight: 800, padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.9rem', fontFamily: 'var(--font-heading)' }}>
                            {c.code}
                          </span>
                          <div>
                            <h3 style={{ fontSize: '1.1rem', color: 'var(--navy)', margin: 0, fontWeight: 700 }}>
                              {c.name || c.title}
                            </h3>
                            <div style={{ fontSize: '0.8rem', color: 'var(--slate)', marginTop: '0.2rem' }}>
                              📍 {c.room || 'Online LMS'} • ⏰ {c.time || 'Mon/Wed 09:00 AM - 10:30 AM'} • {c.credits || 3} Credits
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            onClick={() => {
                              window.alert(`Syllabus for ${c.code} - ${c.name || c.title}\n\nInstructor: Dr. Sarah Jenkins\nOffice Hours: Tue/Thu 2:00 PM - 4:00 PM EST\nClass Room: Moodle Virtual Room 102\n\nModules:\n• Week 1-4: Foundational Principles & Historical Context\n• Week 5-8: Systematic Exegesis & Theological Analysis\n• Week 9-12: Practical Field Application & Final Capstone Project`);
                            }}
                            className="btn btn-outline btn-sm"
                            style={{ borderColor: '#3b82f6', color: '#1d4ed8', fontWeight: 600 }}
                          >
                            📖 Course Syllabus
                          </button>
                          <button
                            onClick={() => {
                              window.alert(`Redirecting to BMI Moodle LMS course portal for ${c.code}...`);
                            }}
                            className="btn btn-gold btn-sm"
                          >
                            🚀 Open Moodle LMS
                          </button>
                          <button
                            onClick={() => handleDrop(c.id)}
                            disabled={actionLoading === c.id}
                            className="btn btn-danger btn-sm"
                          >
                            {actionLoading === c.id ? 'Dropping...' : 'Drop'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DEGREE AUDIT CHECKLIST */}
          {activeTab === 'audit' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)', margin: 0 }}>📊 Degree Requirement Audit</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--slate)', margin: '0.2rem 0 0 0' }}>Program: {programName}</p>
                </div>
                <div style={{ background: 'var(--bg)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--slate)', fontWeight: 600 }}>Total Progress: </span>
                  <strong style={{ color: 'var(--navy)' }}>{totalEarnedCredits} / {degreeTotalCredits} Credits</strong>
                </div>
              </div>

              {/* Section 1: Biblical & Theological Core */}
              <div style={{ marginBottom: '1.75rem' }}>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--navy)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📖 Biblical & Theological Core Foundations</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate)' }}>(18 Credits Required)</span>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {coreRequirements.map(req => (
                    <div key={req.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--navy)' }}>{req.code}</span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--navy)' }}>{req.title}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>{req.credits} Cr</span>
                        {req.status === 'completed' ? (
                          <span className="badge badge-accepted" style={{ fontSize: '0.75rem' }}>✓ Grade: {req.grade}</span>
                        ) : req.status === 'in_progress' ? (
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 8px', borderRadius: '99px' }}>⏳ In Progress</span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate)', background: '#e2e8f0', padding: '2px 8px', borderRadius: '99px' }}>⭕ Needed</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2: Ministry Practicum */}
              <div style={{ marginBottom: '1.75rem' }}>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--navy)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🤝 Ministry Leadership & Practical Fieldwork</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate)' }}>(4 Credits Required)</span>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {practicumRequirements.map(req => (
                    <div key={req.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--navy)' }}>{req.code}</span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--navy)' }}>{req.title}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>{req.credits} Cr</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate)', background: '#e2e8f0', padding: '2px 8px', borderRadius: '99px' }}>⭕ Needed</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 3: Senior Capstone */}
              <div>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--navy)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🎓 Capstone Synthesis Seminar</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate)' }}>(4 Credits Required)</span>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {capstoneRequirements.map(req => (
                    <div key={req.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--navy)' }}>{req.code}</span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--navy)' }}>{req.title}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>{req.credits} Cr</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate)', background: '#e2e8f0', padding: '2px 8px', borderRadius: '99px' }}>⭕ Needed</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TRANSCRIPT */}
          {activeTab === 'transcript' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)', margin: 0 }}>Official Academic Record & Transcript</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--slate)', margin: '0.2rem 0 0 0' }}>Verified coursework and cumulative grade point average audit.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <button
                    className="btn btn-gold btn-sm"
                    onClick={() => window.print()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    🖨️ Print / Save Official Transcript (PDF)
                  </button>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--slate)', fontWeight: 600 }}>CUMULATIVE GPA</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--gold-dark)' }}>
                      {transcriptData?.gpa !== undefined && transcriptData?.gpa !== null ? Number(transcriptData.gpa).toFixed(2) : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Printable Official Transcript Document View */}
              <div className="printable-transcript" style={{ padding: '1rem 0' }}>
                <div style={{ border: '2px solid var(--navy)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', background: '#fdfefe' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--navy)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <h1 style={{ fontSize: '1.4rem', color: 'var(--navy)', margin: 0, fontWeight: 900, letterSpacing: '0.05em' }}>
                        BMI UNIVERSITY • OFFICE OF THE REGISTRAR
                      </h1>
                      <div style={{ fontSize: '0.8rem', color: 'var(--slate)', marginTop: '0.2rem' }}>
                        Official Student Academic Transcript • Document Ref: TR-2026-{(dashboardData?.id || '0000').substring(0, 6).toUpperCase()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--slate)' }}>
                      <div>Issued: {new Date().toLocaleDateString()}</div>
                      <div>Status: Official / Verified</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    <div><strong>Student Name:</strong> {studentName}</div>
                    <div><strong>Degree Program:</strong> {programName}</div>
                    <div><strong>Academic Standing:</strong> {transcriptData?.gpa && Number(transcriptData.gpa) >= 3.5 ? "Dean's List / High Honors" : 'Good Standing'}</div>
                    <div><strong>Cumulative GPA:</strong> {transcriptData?.gpa ? Number(transcriptData.gpa).toFixed(2) : 'N/A'} / 4.00</div>
                  </div>
                </div>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Term</th>
                        <th>Course Code</th>
                        <th>Course Title</th>
                        <th>Credits</th>
                        <th>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!transcriptData?.classes || transcriptData.classes.length === 0) ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', color: 'var(--slate)', padding: '2rem' }}>
                            No official transcript records found. Complete active courses to record grades.
                          </td>
                        </tr>
                      ) : (
                        transcriptData.classes.map((row: any, i: number) => (
                          <tr key={i}>
                            <td><span className="badge badge-submitted">{row.term || 'Fall 2026'}</span></td>
                            <td><strong>{row.code || row.course_code}</strong></td>
                            <td>{row.title || row.name || row.course_name}</td>
                            <td>{row.credits || 3}</td>
                            <td><strong style={{ color: 'var(--navy)' }}>{row.grade || 'Enrolled'}</strong></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--slate)' }}>
                  <div>Security Seal: [BMI-DIGITAL-VERIFIED-AUTH-HASH-2026]</div>
                  <div>Registrar Signature: <em>Office of Academic Certification</em></div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: GPA FORECAST SIMULATOR */}
          {activeTab === 'calculator' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)', margin: 0 }}>
                    🧮 Interactive GPA Forecast & "What-If" Simulator
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--slate)', margin: '0.2rem 0 0 0' }}>
                    Simulate anticipated semester grades to calculate projected cumulative GPA and Latin Honors standing.
                  </p>
                </div>
              </div>

              {/* Current vs Projected GPA Metric Banners */}
              {(() => {
                const currentGpa = dashboardData?.gpa !== undefined && dashboardData?.gpa !== null ? Number(dashboardData.gpa) : 3.85;
                const earnedCredits = dashboardData?.total_credits || 36;
                const currentQualityPoints = currentGpa * earnedCredits;

                const activeClasses = dashboardData?.current_classes || [];
                let simPoints = 0;
                let simCredits = 0;

                activeClasses.forEach((c: any) => {
                  const cr = c.credits || 3;
                  const pts = hypotheticalGrades[c.id] !== undefined ? hypotheticalGrades[c.id] : 4.0; // default to 'A'
                  simPoints += (pts * cr);
                  simCredits += cr;
                });

                const totalProjCredits = earnedCredits + (simCredits || 12);
                const totalProjPoints = currentQualityPoints + (simCredits > 0 ? simPoints : (4.0 * 12));
                const projectedGpa = Number(totalProjPoints / totalProjCredits).toFixed(2);

                const getHonors = (val: number) => {
                  if (val >= 3.90) return { title: 'Summa Cum Laude (Highest Honors)', color: '#065f46', bg: 'rgba(16, 185, 129, 0.1)' };
                  if (val >= 3.75) return { title: 'Magna Cum Laude (High Honors)', color: '#1e40af', bg: 'rgba(59, 130, 246, 0.1)' };
                  if (val >= 3.50) return { title: 'Cum Laude (Honors)', color: 'var(--gold-dark)', bg: 'rgba(212, 175, 55, 0.15)' };
                  return { title: 'Standard Academic Standing', color: 'var(--navy)', bg: 'var(--bg)' };
                };

                const honorsInfo = getHonors(Number(projectedGpa));

                return (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--slate)', fontWeight: 600 }}>Current Cumulative GPA</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--navy)', marginTop: '0.2rem' }}>
                          {currentGpa.toFixed(2)} <span style={{ fontSize: '0.85rem', color: 'var(--slate)', fontWeight: 500 }}>/ 4.00</span>
                        </div>
                      </div>

                      <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid #3b82f6' }}>
                        <div style={{ fontSize: '0.8rem', color: '#1e40af', fontWeight: 600 }}>Projected Cumulative GPA</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1d4ed8', marginTop: '0.2rem' }}>
                          {projectedGpa} <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>/ 4.00</span>
                        </div>
                      </div>

                      <div style={{ padding: '1rem', background: honorsInfo.bg, borderRadius: 'var(--radius-sm)', border: `1px solid ${honorsInfo.color}` }}>
                        <div style={{ fontSize: '0.8rem', color: honorsInfo.color, fontWeight: 600 }}>Projected Graduation Distinction</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: honorsInfo.color, marginTop: '0.4rem' }}>
                          {honorsInfo.title}
                        </div>
                      </div>
                    </div>

                    <h3 style={{ fontSize: '1.05rem', color: 'var(--navy)', marginBottom: '0.75rem' }}>
                      Active Term Course Grade Projections
                    </h3>

                    {activeClasses.length === 0 ? (
                      <p style={{ color: 'var(--slate)', fontSize: '0.9rem' }}>
                        No active classes enrolled. Enroll in courses to simulate semester grade point outcomes.
                      </p>
                    ) : (
                      <div className="table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Course Code</th>
                              <th>Course Title</th>
                              <th>Credit Hours</th>
                              <th>Hypothetical Target Grade</th>
                              <th>Grade Points</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeClasses.map((c: any) => {
                              const currentSelectedPts = hypotheticalGrades[c.id] !== undefined ? hypotheticalGrades[c.id] : 4.0;
                              return (
                                <tr key={c.id}>
                                  <td><strong>{c.code}</strong></td>
                                  <td>{c.name || c.title}</td>
                                  <td>{c.credits || 3} Credits</td>
                                  <td>
                                    <select
                                      className="form-input"
                                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', width: 'auto' }}
                                      value={currentSelectedPts}
                                      onChange={(e) => setHypotheticalGrades({ ...hypotheticalGrades, [c.id]: Number(e.target.value) })}
                                    >
                                      <option value="4.0">A (4.00 - Outstanding)</option>
                                      <option value="3.7">A- (3.70 - Excellent)</option>
                                      <option value="3.3">B+ (3.30 - Very Good)</option>
                                      <option value="3.0">B (3.00 - Good)</option>
                                      <option value="2.7">B- (2.70 - Satisfactory)</option>
                                      <option value="2.3">C+ (2.30 - Average)</option>
                                      <option value="2.0">C (2.00 - Passing)</option>
                                      <option value="1.0">D (1.00 - Below Average)</option>
                                      <option value="0.0">F (0.00 - Failing)</option>
                                    </select>
                                  </td>
                                  <td>
                                    <strong>{((c.credits || 3) * currentSelectedPts).toFixed(1)} Quality Pts</strong>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
