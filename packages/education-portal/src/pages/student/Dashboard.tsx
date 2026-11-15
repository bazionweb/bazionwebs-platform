import { useState, useEffect } from 'react';
import { Link } from '../../shims/react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

export default function Dashboard() {
  const { user: authUser } = useAuth();
  const [data, setData] = useState<any>(null);
  const [onboarding, setOnboarding] = useState<any>(null);
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.student.getDashboard().catch(() => null),
      api.student.getOnboardingStatus().catch(() => null),
      api.student.getDeadlines().catch(() => []),
      api.student.getAttendance().catch(() => []),
    ])
      .then(([dashData, obData, deadlineList, attList]) => {
        setData(dashData);
        setOnboarding(obData);
        setDeadlines(Array.isArray(deadlineList) ? deadlineList : []);
        setAttendance(Array.isArray(attList) ? attList : []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="spinner" style={{ width: 44, height: 44 }}></div>
      </div>
    );
  }

  // Dynamic student name resolution from Auth context or API payload
  const rawFirstName = authUser?.first_name || data?.user?.first_name || data?.first_name || '';
  const rawLastName = authUser?.last_name || data?.user?.last_name || data?.last_name || '';
  const studentName = (rawFirstName || rawLastName) ? `${rawFirstName} ${rawLastName}`.trim() : (authUser?.email ? authUser.email.split('@')[0] : 'Student');
  const programName = data?.program_name || data?.user?.program_name || 'Degree Program';
  const currentClasses = data?.current_classes || [];
  const gpa = data?.gpa !== undefined && data?.gpa !== null ? Number(data.gpa).toFixed(2) : 'N/A';
  const totalCredits = data?.total_credits || 0;
  const degreeCredits = data?.degree_credits || 120;
  const creditsRemaining = Math.max(0, degreeCredits - totalCredits);
  const creditPct = Math.min(Math.round((totalCredits / degreeCredits) * 100), 100);

  // Approximate remaining terms (assuming 15 credits / term)
  const estTermsLeft = Math.ceil(creditsRemaining / 15);

  const presentCount = attendance.filter((a: any) => a.status === 'present' || a.status === 'attended').length;
  const totalAttSessions = attendance.length;
  const attendanceRate = totalAttSessions > 0 ? Math.round((presentCount / totalAttSessions) * 100) : 100;
  const attendanceStats = {
    total: totalAttSessions,
    present: presentCount,
    absent: Math.max(0, totalAttSessions - presentCount),
    rate: attendanceRate,
  };

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto' }}>
      
      {/* ─── Hero Welcome Banner ─── */}
      <div className="hero-welcome">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ background: 'white', padding: '3px 6px', borderRadius: '6px', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', display: 'inline-flex', alignItems: 'center' }}>
                <img src="/bmi-logo.png" alt="BMI Logo" style={{ height: 22, width: 'auto', objectFit: 'contain' }} />
              </div>
              ✦ BMI UNIVERSITY ACADEMIC PORTAL
            </div>
            <h1 style={{ fontSize: '2.25rem', color: 'white', marginBottom: '0.5rem', fontWeight: 900 }}>
              Welcome back, {studentName}! 👋
            </h1>
            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', maxWidth: 600, lineHeight: 1.5 }}>
              You are currently enrolled in <strong>{programName}</strong>. Keep up the great work this semester!
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/registration" className="btn btn-gold btn-sm" style={{ boxShadow: '0 4px 14px rgba(212, 175, 55, 0.4)' }}>
              📝 Course Registration
            </Link>
            <Link to="/student/finances" className="btn btn-outline btn-sm" style={{ borderColor: 'rgba(255, 255, 255, 0.4)', color: 'white' }}>
              💳 Pay Tuition
            </Link>
          </div>
        </div>
      </div>

      {/* ─── 4 KPI Stat Counter Cards ─── */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ borderTop: '4px solid var(--gold)' }}>
          <div className="kpi-lbl">Cumulative GPA</div>
          <div className="kpi-val" style={{ color: 'var(--navy)' }}>
            {gpa} {gpa !== 'N/A' && <span style={{ fontSize: '0.9rem', color: 'var(--slate)', fontWeight: 500 }}>/ 4.00</span>}
          </div>
          <div style={{ fontSize: '0.75rem', color: gpa !== 'N/A' && Number(gpa) >= 3.5 ? 'var(--success)' : 'var(--slate)', fontWeight: 700, marginTop: '0.4rem' }}>
            {gpa !== 'N/A' && Number(gpa) >= 3.5 ? '▲ Honor Roll Standing' : 'Active Standing'}
          </div>
        </div>

        <div className="kpi-card" style={{ borderTop: '4px solid #3b82f6' }}>
          <div className="kpi-lbl">Degree Credit Progress</div>
          <div className="kpi-val">{totalCredits} <span style={{ fontSize: '0.9rem', color: 'var(--slate)', fontWeight: 500 }}>/ {degreeCredits} Cr</span></div>
          <div style={{ marginTop: '0.5rem', background: 'var(--border)', height: 6, borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${creditPct}%`, background: '#3b82f6', height: '100%' }} />
          </div>
        </div>

        <div className="kpi-card" style={{ borderTop: '4px solid #10b981' }}>
          <div className="kpi-lbl">Active Enrolled Classes</div>
          <div className="kpi-val" style={{ color: '#065f46' }}>{currentClasses.length} <span style={{ fontSize: '0.9rem', color: 'var(--slate)', fontWeight: 500 }}>Courses</span></div>
          <div style={{ fontSize: '0.75rem', color: 'var(--slate)', fontWeight: 600, marginTop: '0.4rem' }}>
            {currentClasses.reduce((acc: number, c: any) => acc + (c.credits || 0), 0)} Total Credit Hours
          </div>
        </div>

        <div className="kpi-card" style={{ borderTop: '4px solid var(--gold)' }}>
          <div className="kpi-lbl">Account Tuition Balance</div>
          <div className="kpi-val" style={{ color: data?.upcoming_invoices?.length > 0 ? 'var(--danger)' : 'var(--navy)' }}>
            ${data?.upcoming_invoices?.reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0).toFixed(2) || '0.00'}
          </div>
          <div style={{ fontSize: '0.75rem', color: data?.upcoming_invoices?.length > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700, marginTop: '0.4rem' }}>
            {data?.upcoming_invoices?.length > 0 ? '⚠️ Invoice Due Soon' : '✓ Good Standing'}
          </div>
        </div>
      </div>

      {/* ─── Degree Progress Tracker Widget ─── */}
      <div className="card" style={{ marginBottom: '2rem', border: '1px solid #e2e8f0', background: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)', margin: 0 }}>📊 Degree Completion Pathway</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
              Tracking progress toward Bachelor of Science / Master Degree completion
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)', padding: '4px 12px', borderRadius: '99px' }}>
              {creditPct}% Completed
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 12px', borderRadius: '99px' }}>
              Standing: {gpa !== 'N/A' && Number(gpa) >= 3.5 ? "Dean's List" : 'Good Standing'}
            </span>
          </div>
        </div>

        {/* Multi-tier progress bar */}
        <div style={{ background: '#f1f5f9', height: 12, borderRadius: 99, overflow: 'hidden', marginBottom: '1rem', position: 'relative' }}>
          <div style={{ width: `${creditPct}%`, background: 'linear-gradient(90deg, #3b82f6 0%, #6366f1 100%)', height: '100%', borderRadius: 99, transition: 'width 0.8s ease' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', paddingTop: '0.5rem' }}>
          <div style={{ padding: '0.75rem 1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--slate)', textTransform: 'uppercase', fontWeight: 700 }}>Credits Earned</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy)', marginTop: '0.2rem' }}>{totalCredits} <span style={{ fontSize: '0.8rem', color: 'var(--slate)', fontWeight: 500 }}>credits</span></div>
          </div>
          <div style={{ padding: '0.75rem 1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--slate)', textTransform: 'uppercase', fontWeight: 700 }}>Credits Remaining</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem' }}>{creditsRemaining} <span style={{ fontSize: '0.8rem', color: 'var(--slate)', fontWeight: 500 }}>credits</span></div>
          </div>
          <div style={{ padding: '0.75rem 1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--slate)', textTransform: 'uppercase', fontWeight: 700 }}>Total Required</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy)', marginTop: '0.2rem' }}>{degreeCredits} <span style={{ fontSize: '0.8rem', color: 'var(--slate)', fontWeight: 500 }}>credits</span></div>
          </div>
          <div style={{ padding: '0.75rem 1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--slate)', textTransform: 'uppercase', fontWeight: 700 }}>Estimated Terms</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem' }}>~{estTermsLeft} <span style={{ fontSize: '0.8rem', color: 'var(--slate)', fontWeight: 500 }}>semesters</span></div>
          </div>
        </div>
      </div>

      {/* ─── Onboarding Checklist Card (if incomplete) ─── */}
      {onboarding && !onboarding.isComplete && (
        <div className="card" style={{ marginBottom: '2rem', border: '2px solid var(--gold)', background: 'linear-gradient(to right, rgba(212, 175, 55, 0.05), rgba(212, 175, 55, 0.15))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', color: 'var(--navy)', marginBottom: '0.2rem' }}>🎓 Enrollment Onboarding Checklist</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Complete required tasks to finalize your active student profile.</p>
            </div>
            <span style={{ fontWeight: 800, color: 'var(--navy)', background: 'var(--gold)', padding: '4px 12px', borderRadius: '99px', fontSize: '0.85rem' }}>
              {onboarding.progress}% Completed
            </span>
          </div>

          <div style={{ display: 'grid', gap: '0.65rem' }}>
            {onboarding.tasks.map((task: any) => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.1rem', background: task.completed ? 'rgba(16, 185, 129, 0.08)' : 'white', border: `1px solid ${task.completed ? 'var(--success)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: task.completed ? 'var(--success)' : 'var(--border)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>
                    {task.completed ? '✓' : '•'}
                  </div>
                  <span style={{ fontWeight: task.completed ? 700 : 500, color: task.completed ? '#065f46' : 'var(--navy)', fontSize: '0.9rem' }}>
                    {task.title}
                  </span>
                </div>
                {!task.completed && (
                  <Link to={task.actionUrl} className="btn btn-gold btn-sm">Start Task</Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Grid Layout: Current Schedule & Quick Actions + Deadlines ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* Left Column: Schedule & Attendance Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Today's Schedule Card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)' }}>📅 Enrolled Classes & Timetable</h2>
              <Link to="/student/academics" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gold-dark)' }}>View Full Schedule →</Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {currentClasses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--slate)', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>No enrolled classes for this active term.</p>
                  <Link to="/registration" className="btn btn-gold btn-sm" style={{ marginTop: '0.75rem', display: 'inline-block' }}>
                    Browse Course Catalog →
                  </Link>
                </div>
              ) : (
                currentClasses.map((cls: any) => (
                  <div key={cls.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ background: 'var(--navy)', color: 'var(--gold)', fontWeight: 800, padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', fontFamily: 'var(--font-heading)' }}>
                        {cls.code || cls.course_code}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.95rem' }}>{cls.name || cls.course_name || cls.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--slate)', marginTop: '0.15rem' }}>
                          📍 {cls.room || 'Online'} • {cls.time || 'Schedule TBD'}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge badge-accepted" style={{ fontSize: '0.75rem' }}>Grade: {cls.grade || 'Enrolled'}</span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate)', marginTop: '0.2rem' }}>{cls.credits || 3} Credits</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Attendance & Academic Engagement Card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '1.2rem', color: 'var(--navy)', margin: 0 }}>
                📊 Course Attendance & Engagement Record
              </h2>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: attendanceStats.rate >= 80 ? '#065f46' : '#b45309', background: attendanceStats.rate >= 80 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', padding: '3px 10px', borderRadius: 99 }}>
                ✓ {attendanceStats.total > 0 ? `${attendanceStats.rate}% Attendance Rate` : 'No Records Yet'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.85rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--slate)', fontWeight: 600 }}>Total Lectures Logged</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy)', marginTop: '0.2rem' }}>{attendanceStats.total} Sessions</div>
              </div>
              <div style={{ padding: '0.85rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--slate)', fontWeight: 600 }}>Attended & Participated</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)', marginTop: '0.2rem' }}>{attendanceStats.present} Sessions</div>
              </div>
              <div style={{ padding: '0.85rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--slate)', fontWeight: 600 }}>Absences / Excused</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate)', marginTop: '0.2rem' }}>{attendanceStats.absent} Sessions</div>
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Institutional requirement: Minimum 80% course session attendance required for final exam eligibility.
            </div>
          </div>

        </div>

        {/* Right Column: Key Academic Dates & Quick Actions & Support Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Key Academic Dates & Deadlines Widget */}
          <div className="card">
            <h2 style={{ fontSize: '1.15rem', color: 'var(--navy)', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>🗓️ Key Dates & Deadlines</span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {deadlines.length === 0 ? (
                <div style={{ padding: '0.75rem', color: 'var(--slate)', fontSize: '0.85rem', textAlign: 'center', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
                  No upcoming institutional deadlines registered.
                </div>
              ) : (
                deadlines.slice(0, 4).map((d: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--navy)' }}>{d.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate)', marginTop: '0.1rem' }}>📅 {d.date}</div>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: d.tag === 'Urgent' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: d.tag === 'Urgent' ? '#dc2626' : '#2563eb' }}>
                      {d.type || d.tag}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h2 style={{ fontSize: '1.15rem', color: 'var(--navy)', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
              ⚡ Quick Actions Hub
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <Link to="/registration" className="btn btn-outline btn-sm" style={{ justifyContent: 'flex-start' }}>
                📝 Register for Classes
              </Link>
              <Link to="/student/finances" className="btn btn-outline btn-sm" style={{ justifyContent: 'flex-start' }}>
                💳 Pay Tuition & Fees
              </Link>
              <Link to="/student/documents" className="btn btn-outline btn-sm" style={{ justifyContent: 'flex-start' }}>
                📄 Request Transcript / ID
              </Link>
              <Link to="/student/orientation" className="btn btn-outline btn-sm" style={{ justifyContent: 'flex-start' }}>
                🎓 Student Orientation Hub
              </Link>
              <Link to="/student/support" className="btn btn-outline btn-sm" style={{ justifyContent: 'flex-start' }}>
                🎫 Contact Support Ticket
              </Link>
            </div>
          </div>

          <div className="card" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--gold)', marginBottom: '0.5rem' }}>👨‍🏫 Academic Advisory</h3>
            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{data?.advisor_name || 'Academic Registrar Office'}</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem' }}>{data?.advisor_dept || 'Department of Academic Affairs'}</div>
            <Link to="/student/support" className="btn btn-gold btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
              Send Message
            </Link>
          </div>

        </div>

      </div>

    </div>
  );
}
