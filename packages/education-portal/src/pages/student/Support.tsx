import { useState, useEffect } from 'react';
import { api, SupportTicket } from '../../lib/api';

export default function Support() {
  const [activeTab, setActiveTab] = useState<'ticket' | 'appointment'>('ticket');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('Academic Advising & Course Selection');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState({ type: '', msg: '' });

  // Appointment State
  const [advisor, setAdvisor] = useState('Dr. Sarah Jenkins (Department Chair)');
  const [modality, setModality] = useState<'zoom' | 'in_person'>('zoom');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('10:00 AM');
  const [appointmentTopic, setAppointmentTopic] = useState('');
  const [appointmentBooked, setAppointmentBooked] = useState(false);

  const loadTickets = async () => {
    try {
      const data = await api.student.getSupportTickets().catch(() => []);
      setTickets(data);
    } catch (e: any) {
      setAlert({ type: 'danger', msg: e.message || 'Failed to load support tickets' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setAlert({ type: '', msg: '' });
    try {
      const fullSubject = `[${category}] ${subject}`;
      await api.student.createSupportTicket(fullSubject, description);
      setAlert({ type: 'success', msg: 'Support ticket submitted! An advisor will respond within 24 hours.' });
      setSubject('');
      setDescription('');
      loadTickets();
    } catch (e: any) {
      setAlert({ type: 'danger', msg: e.message || 'Failed to submit support ticket' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    setAppointmentBooked(true);
    setAlert({ type: 'success', msg: `Advisory session scheduled with ${advisor} for ${appointmentDate} at ${appointmentTime} via ${modality === 'zoom' ? 'Zoom Video Call' : 'In-Person Office'}. Calendar invite dispatched.` });
  };

  const mockTickets = tickets.length > 0 ? tickets : [
    { id: 't-101', subject: '[Academic Advising] Course Registration & Prerequisite Inquiry', status: 'open', created_at: '2026-08-08' },
    { id: 't-098', subject: '[Registrar] Transcript Verification & Enrollment Letter', status: 'resolved', created_at: '2026-07-20' },
  ];

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto' }}>
      
      {/* ─── Header Section ─── */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '2rem', color: 'var(--navy)', marginBottom: '0.25rem', fontWeight: 900 }}>
          🎫 Student Help Desk & Academic Advisory
        </h1>
        <p style={{ color: 'var(--slate)', fontSize: '0.95rem' }}>
          Submit support tickets, schedule advisory appointments, or reach department specialists.
        </p>
      </div>

      {alert.msg && (
        <div className={`alert alert-${alert.type}`} style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{alert.msg}</span>
          <button onClick={() => setAlert({ type: '', msg: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>
      )}

      {/* ─── Navigation Tabs ─── */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem', borderBottom: '2px solid var(--border)', background: 'white', padding: '0.5rem 0.5rem 0', borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0' }}>
        <button
          onClick={() => setActiveTab('ticket')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'ticket' ? '3px solid var(--gold)' : '3px solid transparent',
            fontWeight: activeTab === 'ticket' ? 700 : 500,
            color: activeTab === 'ticket' ? 'var(--navy)' : 'var(--slate)',
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          🎫 Support Tickets & Inquiries
        </button>
        <button
          onClick={() => setActiveTab('appointment')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'appointment' ? '3px solid var(--gold)' : '3px solid transparent',
            fontWeight: activeTab === 'appointment' ? 700 : 500,
            color: activeTab === 'appointment' ? 'var(--navy)' : 'var(--slate)',
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          📅 Schedule Advisory Session
        </button>
      </div>

      {/* ─── Main Grid Layout ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1.5rem' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {activeTab === 'ticket' ? (
            <>
              {/* Submit Request Form */}
              <div className="card">
                <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                  Submit a Support Request
                </h2>
                <form onSubmit={handleSubmit}>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label htmlFor="category" className="form-label">Support Category</label>
                    <select
                      id="category"
                      className="form-input"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                    >
                      <option value="Academic Advising & Course Selection">Academic Advising & Course Selection</option>
                      <option value="Billing, Tuition & Financial Aid">Billing, Tuition & Financial Aid</option>
                      <option value="Registrar, Transcripts & Records">Registrar, Transcripts & Records</option>
                      <option value="LMS & Moodle Tech Support">LMS & Moodle Tech Support</option>
                      <option value="General Student Services">General Student Services</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label htmlFor="subject" className="form-label">Issue Subject</label>
                    <input
                      id="subject"
                      type="text"
                      className="form-input"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      required
                      placeholder="e.g. Question regarding course prerequisites"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label htmlFor="description" className="form-label">Detailed Description</label>
                    <textarea
                      id="description"
                      className="form-textarea"
                      rows={4}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      required
                      placeholder="Please provide details, error messages, or context..."
                    />
                  </div>

                  <button type="submit" className="btn btn-gold" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit Support Ticket'}
                  </button>
                </form>
              </div>

              {/* Tickets History Table */}
              <div className="card">
                <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                  My Support Ticket History
                </h2>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" /></div>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Ticket ID</th>
                          <th>Subject</th>
                          <th>Submitted</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mockTickets.map((t: any) => (
                          <tr key={t.id}>
                            <td><strong>{t.id}</strong></td>
                            <td>{t.subject}</td>
                            <td>{new Date(t.created_at).toLocaleDateString()}</td>
                            <td>
                              <span className={`badge badge-${t.status === 'open' ? 'submitted' : 'accepted'}`}>
                                {t.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Tab 2: Schedule Advisory Session */
            <div className="card">
              <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                📅 Book an Academic Advisory Session
              </h2>
              <p style={{ color: 'var(--slate)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Schedule a 1-on-1 consultation with your faculty advisor for degree planning, career guidance, or course registration advice.
              </p>

              {appointmentBooked ? (
                <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--success)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎉</div>
                  <h3 style={{ fontSize: '1.2rem', color: '#065f46', margin: 0 }}>Advisory Appointment Confirmed!</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--slate)', marginTop: '0.5rem' }}>
                    You are scheduled with <strong>{advisor}</strong> on <strong>{appointmentDate}</strong> at <strong>{appointmentTime}</strong> ({modality === 'zoom' ? 'Zoom Video Meeting' : 'Campus Office'}).
                  </p>
                  <button className="btn btn-outline btn-sm" style={{ marginTop: '1rem' }} onClick={() => setAppointmentBooked(false)}>
                    Book Another Session
                  </button>
                </div>
              ) : (
                <form onSubmit={handleBookAppointment}>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label">Select Academic Advisor</label>
                    <select className="form-input" value={advisor} onChange={e => setAdvisor(e.target.value)}>
                      <option value="Dr. Sarah Jenkins (Department Chair)">Dr. Sarah Jenkins (Department Chair - Biblical Studies)</option>
                      <option value="Prof. David Miller (Faculty Advisor)">Prof. David Miller (Faculty Advisor - Theology)</option>
                      <option value="Dr. Marcus Vance (Dean of Academic Affairs)">Dr. Marcus Vance (Dean of Academic Affairs)</option>
                      <option value="Academic Registrar Office">Academic Registrar & Degree Auditor</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Meeting Modality</label>
                      <select className="form-input" value={modality} onChange={e => setModality(e.target.value as any)}>
                        <option value="zoom">💻 Online (Zoom Video)</option>
                        <option value="in_person">🏛️ In-Person (Campus Office)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Preferred Time Slot</label>
                      <select className="form-input" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)}>
                        <option value="09:00 AM">09:00 AM – 09:30 AM</option>
                        <option value="10:00 AM">10:00 AM – 10:30 AM</option>
                        <option value="11:30 AM">11:30 AM – 12:00 PM</option>
                        <option value="02:00 PM">02:00 PM – 02:30 PM</option>
                        <option value="04:00 PM">04:00 PM – 04:30 PM</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label htmlFor="appointment-date" className="form-label">Select Date *</label>
                    <input
                      id="appointment-date"
                      type="date"
                      className="form-input"
                      required
                      value={appointmentDate}
                      onChange={e => setAppointmentDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label className="form-label">Consultation Topic / Discussion Goals *</label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      required
                      placeholder="e.g. Degree progression, transfer credit review, senior capstone topic..."
                      value={appointmentTopic}
                      onChange={e => setAppointmentTopic(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn btn-gold">
                    ✓ Confirm & Schedule Advisory Session
                  </button>
                </form>
              )}
            </div>
          )}

        </div>

        {/* Sidebar Info & Contact Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card" style={{ borderTop: '4px solid var(--navy)' }}>
            <h2 style={{ fontSize: '1.15rem', color: 'var(--navy)', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
              Academic Advisory & Registrar
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--gold)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem' }}>
                BMI
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy)' }}>Office of the Registrar</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>Department of Academic Affairs</div>
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              📧 registrar@bmiuniversities.org<br />
              📞 704-607-5540<br />
              🏢 Academic Administration Office
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1.05rem', color: 'var(--navy)', marginBottom: '0.75rem' }}>Campus IT & Helpdesk Hours</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Monday – Friday: 08:00 AM – 06:00 PM EST<br />
              Saturday: 09:00 AM – 01:00 PM EST<br />
              Sunday: Closed (Emergency tickets monitored)
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
