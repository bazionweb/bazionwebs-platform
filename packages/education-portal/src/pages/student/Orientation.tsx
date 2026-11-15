import { useState, useEffect } from 'react';
import { Link } from '../../shims/react-router-dom';
import { api } from '../../lib/api';

const MODULES = [
  { id: 'welcome', title: '1. Welcome & Institutional Vision', icon: '🏛️' },
  { id: 'integrity', title: '2. Academic Integrity & Honor Code', icon: '📜' },
  { id: 'resources', title: '3. Student Services & LMS Guide', icon: '💻' },
  { id: 'quiz', title: '4. Orientation Quiz & Verification', icon: '✅' },
] as const;

const QUIZ_QUESTIONS = [
  {
    id: 'q1',
    question: 'What is the core expectation of the BMI University Academic Honor Code?',
    options: [
      { text: 'Submitting original academic work and properly citing all sources', correct: true },
      { text: 'Sharing exam answers with classmates during midterm evaluations', correct: false },
      { text: 'Using generative AI tools to write all theological essays without attribution', correct: false },
      { text: 'Only attending the first and last class sessions of each semester', correct: false },
    ],
  },
  {
    id: 'q2',
    question: 'Where can students access their course materials, weekly assignments, and lecture notes?',
    options: [
      { text: 'On random social media groups', correct: false },
      { text: 'Through the BMI Moodle Learning Management System (LMS) and Student Portal', correct: true },
      { text: 'Only by physical mail delivered once a year', correct: false },
      { text: 'Assignments are never posted online', correct: false },
    ],
  },
  {
    id: 'q3',
    question: 'What is the minimum required cumulative GPA to maintain Good Academic Standing at BMI?',
    options: [
      { text: '1.00 Cumulative GPA', correct: false },
      { text: '2.00 Cumulative GPA', correct: true },
      { text: '3.80 Cumulative GPA', correct: false },
      { text: 'There is no GPA requirement', correct: false },
    ],
  },
  {
    id: 'q4',
    question: 'What should you do if you experience academic difficulty or have billing questions?',
    options: [
      { text: 'Immediately drop out without informing anyone', correct: false },
      { text: 'Submit a support ticket or contact your Academic Advisor & Registrar office', correct: true },
      { text: 'Ignore upcoming tuition invoices until graduation', correct: false },
      { text: 'Contact external non-university forums', correct: false },
    ],
  },
];

export default function Orientation() {
  const [activeModule, setActiveModule] = useState(0);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [honorCodeAccepted, setHonorCodeAccepted] = useState(false);

  useEffect(() => {
    api.student.getDashboard().then((dash: any) => {
      const orientationHold = dash?.registration_holds?.find((h: any) => h.hold_type === 'orientation');
      if (!orientationHold && dash?.registration_holds) {
        // Hold is not active (already done)
      }
    }).catch(() => {});
  }, []);

  const handleSelectAnswer = (qId: string, optionIdx: number) => {
    setAnswers(prev => ({ ...prev, [qId]: optionIdx }));
    setQuizSubmitted(false);
  };

  const calculateScore = () => {
    let score = 0;
    QUIZ_QUESTIONS.forEach(q => {
      const selected = answers[q.id];
      if (selected !== undefined && q.options[selected]?.correct) {
        score++;
      }
    });
    return score;
  };

  const handleFinishOrientation = async () => {
    const score = calculateScore();
    setQuizSubmitted(true);

    if (score < QUIZ_QUESTIONS.length) {
      setError(`You answered ${score} of ${QUIZ_QUESTIONS.length} correctly. Please review your answers and score 100% to complete orientation.`);
      return;
    }

    if (!honorCodeAccepted) {
      setError('Please accept the Academic Honor Code commitment before completing orientation.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.student.completeOrientation();
      setCompleted(true);
    } catch (err: any) {
      if (err?.message?.includes('already resolved') || err?.message?.includes('not found')) {
        setCompleted(true);
      } else {
        setError(err.message || 'Failed to complete orientation. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (completed) {
    return (
      <div style={{ maxWidth: 840, margin: '0 auto', padding: '1rem 0 3rem' }}>
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 2rem', borderTop: '6px solid var(--success)' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎉</div>
          <h1 style={{ fontSize: '2rem', color: 'var(--navy)', marginBottom: '0.75rem', fontWeight: 900 }}>
            Orientation Completed!
          </h1>
          <p style={{ color: 'var(--slate)', fontSize: '1.05rem', maxWidth: 560, margin: '0 auto 2rem', lineHeight: 1.6 }}>
            Congratulations! You have completed the BMI University New Student Orientation and satisfied the orientation requirement. Your orientation hold has been resolved.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/registration" className="btn btn-gold" style={{ padding: '0.85rem 2rem', fontSize: '1rem', fontWeight: 700 }}>
              📝 Proceed to Course Registration →
            </Link>
            <Link to="/student/dashboard" className="btn btn-outline" style={{ padding: '0.85rem 1.75rem' }}>
              🏠 Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '1rem 0 3rem' }}>
      
      {/* Header Banner */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--gold-dark)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
          ✦ BMI University Student Onboarding
        </div>
        <h1 style={{ fontSize: '2.25rem', color: 'var(--navy)', fontWeight: 900, marginBottom: '0.5rem' }}>
          New Student Online Orientation
        </h1>
        <p style={{ color: 'var(--slate)', fontSize: '0.95rem' }}>
          Welcome to the BMI academic community. Complete all 4 modules and pass the brief verification quiz to unlock course registration.
        </p>
      </div>

      {/* Module Navigation Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
        {MODULES.map((m, idx) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setActiveModule(idx)}
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              border: `2px solid ${activeModule === idx ? 'var(--gold)' : 'var(--border)'}`,
              background: activeModule === idx ? 'var(--navy)' : 'white',
              color: activeModule === idx ? 'white' : 'var(--navy)',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              transition: 'all 0.2s',
              boxShadow: activeModule === idx ? '0 4px 12px rgba(15, 23, 42, 0.15)' : 'none',
            }}
          >
            <span style={{ fontSize: '1.4rem' }}>{m.icon}</span>
            <div>
              <div style={{ fontSize: '0.75rem', opacity: activeModule === idx ? 0.8 : 0.6, fontWeight: 700 }}>
                Step {idx + 1}
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                {m.title.split('. ')[1]}
              </div>
            </div>
          </button>
        ))}
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {/* Module 1: Welcome & Institutional Vision */}
      {activeModule === 0 && (
        <div className="card">
          <h2 style={{ fontSize: '1.4rem', color: 'var(--navy)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>🏛️</span> Welcome to BMI University
          </h2>
          
          <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: 'white', padding: '1.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
            <div style={{ color: 'var(--gold)', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              President's Welcome Address
            </div>
            <h3 style={{ color: 'white', fontSize: '1.25rem', marginBottom: '0.75rem' }}>
              Equipping Leaders with Academic Excellence & Moral Integrity
            </h3>
            <p style={{ color: '#cbd5e1', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
              "We welcome you into an institution committed to cultivating scholarship, biblical truth, and leadership. As a student at BMI, you are embarking on an academic journey designed to prepare you for impactful service in ministry, education, and professional leadership."
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
            <div style={{ padding: '1.25rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎯</div>
              <strong style={{ color: 'var(--navy)', display: 'block', marginBottom: '0.35rem' }}>Our Mission</strong>
              <p style={{ fontSize: '0.85rem', color: 'var(--slate)', margin: 0, lineHeight: 1.5 }}>
                To provide quality higher education that integrates rigorous scholarship, ethical formation, and community impact.
              </p>
            </div>

            <div style={{ padding: '1.25rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🤝</div>
              <strong style={{ color: 'var(--navy)', display: 'block', marginBottom: '0.35rem' }}>Student Community</strong>
              <p style={{ fontSize: '0.85rem', color: 'var(--slate)', margin: 0, lineHeight: 1.5 }}>
                A vibrant global cohort of learners spanning multiple countries, backgrounds, and disciplines.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-gold" onClick={() => setActiveModule(1)}>
              Continue to Academic Integrity →
            </button>
          </div>
        </div>
      )}

      {/* Module 2: Academic Integrity & Honor Code */}
      {activeModule === 1 && (
        <div className="card">
          <h2 style={{ fontSize: '1.4rem', color: 'var(--navy)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>📜</span> Academic Integrity & Honor Code
          </h2>

          <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
            <strong>Commitment to Truth & Originality:</strong> Academic integrity is non-negotiable at BMI University. All submitted coursework, papers, exams, and projects must represent your own original work.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.75rem' }}>
            <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <strong style={{ color: 'var(--navy)' }}>1. Plagiarism & Unauthorized Collaboration</strong>
              <p style={{ fontSize: '0.88rem', color: 'var(--slate)', margin: '0.25rem 0 0', lineHeight: 1.5 }}>
                Copying text, ideas, or theological commentaries without proper quotation and attribution is strictly prohibited. Use Turabian/APA citation styles as specified by your faculty.
              </p>
            </div>

            <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <strong style={{ color: 'var(--navy)' }}>2. Grading & Satisfactory Academic Progress (SAP)</strong>
              <p style={{ fontSize: '0.88rem', color: 'var(--slate)', margin: '0.25rem 0 0', lineHeight: 1.5 }}>
                Undergraduate students must maintain a minimum cumulative GPA of <strong>2.00</strong> (Graduate: <strong>3.00</strong>) and a 67% course completion rate to remain in Good Academic Standing.
              </p>
            </div>

            <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <strong style={{ color: 'var(--navy)' }}>3. Attendance & Course Participation</strong>
              <p style={{ fontSize: '0.88rem', color: 'var(--slate)', margin: '0.25rem 0 0', lineHeight: 1.5 }}>
                Students must actively participate in online discussions, lectures, and required modular seminars. Unexcused absence exceeding 20% of class sessions may result in administrative withdrawal.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-outline" onClick={() => setActiveModule(0)}>
              ← Back
            </button>
            <button className="btn btn-gold" onClick={() => setActiveModule(2)}>
              Continue to Student Services →
            </button>
          </div>
        </div>
      )}

      {/* Module 3: Student Services & LMS Guide */}
      {activeModule === 2 && (
        <div className="card">
          <h2 style={{ fontSize: '1.4rem', color: 'var(--navy)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>💻</span> Student Services & Technology Guide
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
            <div style={{ padding: '1.25rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'white' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>🖥️</div>
              <strong style={{ color: 'var(--navy)', display: 'block' }}>BMI Moodle LMS</strong>
              <p style={{ fontSize: '0.85rem', color: 'var(--slate)', marginTop: '0.25rem', lineHeight: 1.5 }}>
                Access course syllabi, submit weekly assignments, join live video lectures, and participate in peer forum discussions.
              </p>
            </div>

            <div style={{ padding: '1.25rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'white' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>💳</div>
              <strong style={{ color: 'var(--navy)', display: 'block' }}>Student Financial Portal</strong>
              <p style={{ fontSize: '0.85rem', color: 'var(--slate)', marginTop: '0.25rem', lineHeight: 1.5 }}>
                Review generated term invoices, make credit card or bank transfer payments, and download official payment receipts.
              </p>
            </div>

            <div style={{ padding: '1.25rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'white' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>📚</div>
              <strong style={{ color: 'var(--navy)', display: 'block' }}>Digital Library Catalog</strong>
              <p style={{ fontSize: '0.85rem', color: 'var(--slate)', marginTop: '0.25rem', lineHeight: 1.5 }}>
                Search thousands of academic journals, biblical reference texts, theological treatises, and reserve textbooks.
              </p>
            </div>

            <div style={{ padding: '1.25rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'white' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>🎫</div>
              <strong style={{ color: 'var(--navy)', display: 'block' }}>Help Desk & Advisory</strong>
              <p style={{ fontSize: '0.85rem', color: 'var(--slate)', marginTop: '0.25rem', lineHeight: 1.5 }}>
                Create support tickets for academic advising, transcript requests, technical support, or degree audits.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-outline" onClick={() => setActiveModule(1)}>
              ← Back
            </button>
            <button className="btn btn-gold" onClick={() => setActiveModule(3)}>
              Proceed to Orientation Quiz →
            </button>
          </div>
        </div>
      )}

      {/* Module 4: Orientation Quiz & Verification */}
      {activeModule === 3 && (
        <div className="card">
          <h2 style={{ fontSize: '1.4rem', color: 'var(--navy)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>✅</span> Orientation Quiz & Verification
          </h2>
          <p style={{ color: 'var(--slate)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Answer all 4 questions correctly and accept the Honor Code to complete orientation.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
            {QUIZ_QUESTIONS.map((q, qIdx) => {
              const selectedOpt = answers[q.id];
              return (
                <div key={q.id} style={{ padding: '1.25rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.95rem', marginBottom: '0.75rem' }}>
                    {qIdx + 1}. {q.question}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {q.options.map((opt, optIdx) => {
                      const isSelected = selectedOpt === optIdx;
                      const isCorrect = opt.correct;
                      let bg = 'white';
                      let borderColor = 'var(--border)';

                      if (quizSubmitted) {
                        if (isSelected && isCorrect) {
                          bg = 'rgba(16, 185, 129, 0.12)';
                          borderColor = 'var(--success)';
                        } else if (isSelected && !isCorrect) {
                          bg = 'rgba(239, 68, 68, 0.12)';
                          borderColor = 'var(--danger)';
                        }
                      } else if (isSelected) {
                        bg = 'rgba(212, 175, 55, 0.1)';
                        borderColor = 'var(--gold)';
                      }

                      return (
                        <label
                          key={optIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-sm)',
                            border: `1.5px solid ${borderColor}`,
                            background: bg,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            checked={isSelected}
                            onChange={() => handleSelectAnswer(q.id, optIdx)}
                            style={{ accentColor: 'var(--gold)', width: 16, height: 16 }}
                          />
                          <span style={{ fontSize: '0.9rem', color: 'var(--navy)' }}>{opt.text}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Honor Code Acknowledgment Checkbox */}
          <div style={{ padding: '1.25rem', background: 'rgba(212, 175, 55, 0.08)', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--gold)', marginBottom: '2rem' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={honorCodeAccepted}
                onChange={e => setHonorCodeAccepted(e.target.checked)}
                style={{ accentColor: 'var(--gold)', width: 18, height: 18, marginTop: 2, flexShrink: 0 }}
              />
              <span style={{ fontSize: '0.9rem', color: 'var(--navy)', lineHeight: 1.5 }}>
                <strong>Honor Code Acknowledgment:</strong> I solemnly pledge to uphold the highest standards of academic honesty, integrity, and personal conduct during my tenure as a student at BMI University.
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button className="btn btn-outline" onClick={() => setActiveModule(2)}>
              ← Back
            </button>
            <button
              className="btn btn-gold"
              onClick={handleFinishOrientation}
              disabled={loading || Object.keys(answers).length < QUIZ_QUESTIONS.length || !honorCodeAccepted}
              style={{ padding: '0.75rem 2rem', fontSize: '0.95rem', fontWeight: 800 }}
            >
              {loading ? 'Submitting...' : '✓ Complete Orientation & Resolve Hold'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
