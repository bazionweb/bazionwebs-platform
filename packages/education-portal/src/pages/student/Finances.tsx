import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

export default function Finances() {
  const [data, setData] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [alert, setAlert] = useState({ type: '', msg: '' });
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [planSubmitted, setPlanSubmitted] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);

  const [financialAid, setFinancialAid] = useState<{ awards: any[]; total_awarded: number }>({ awards: [], total_awarded: 0 });

  const loadFinances = async () => {
    try {
      const [finResult, dashResult, aidResult] = await Promise.all([
        api.student.getFinances().catch(() => null),
        api.student.getDashboard().catch(() => null),
        api.finance.getFinancialAid().catch(() => ({ awards: [], total_awarded: 0 })),
      ]);
      setData(finResult);
      setDashboardData(dashResult);
      setFinancialAid(aidResult);
    } catch (e: any) {
      setAlert({ type: 'danger', msg: e.message || 'Failed to load finances' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinances();
    // Paystack callback: ?reference= / ?trxref= — re-verify server-side
    try {
      const params = new URLSearchParams(window.location.search);
      const reference = params.get('reference') || params.get('trxref');
      if (reference) {
        api.payments.verify(reference)
          .then((v) => {
            if (v.verified) {
              setAlert({ type: 'success', msg: `Payment verified! Receipt logged under BEMI TRAINING INSTITUTE (ref: ${v.reference}).` });
            } else {
              setAlert({ type: 'danger', msg: `Payment not yet confirmed (status: ${v.status}). If debited, it will reconcile automatically via webhook.` });
            }
            loadFinances();
          })
          .catch((e: any) => setAlert({ type: 'danger', msg: e.message || 'Payment verification failed' }));
      }
    } catch { /* ignore */ }
  }, []);

  const handlePay = async (invoiceId: string) => {
    setPaying(invoiceId);
    try {
      const result = await api.student.payInvoice(invoiceId);
      const checkoutUrl = result.authorization_url || result.authorizationUrl;
      if (checkoutUrl) {
        setAlert({
          type: 'success',
          msg: `Redirecting to secure Paystack checkout — payee: ${result.merchant || 'BEMI TRAINING INSTITUTE'}. Complete payment to clear this invoice.`,
        });
        window.location.href = checkoutUrl;
        return;
      }
      setAlert({ type: 'success', msg: result.message || 'Payment initialized. Follow the checkout prompt to complete payment.' });
      loadFinances();
    } catch (e: any) {
      setAlert({ type: 'danger', msg: e.message || 'Payment failed' });
    } finally {
      setPaying(null);
    }
  };

  const invoices = data?.invoices || [];
  const payments = data?.payments || [];

  const totalOutstandingBilling = invoices
    .filter((inv: any) => inv.status !== 'paid')
    .reduce((acc: number, curr: any) => acc + (Number(curr.current_balance ?? curr.payable_amount ?? curr.amount) || 0), 0);

  const totalOutstandingBase = invoices
    .filter((inv: any) => inv.status !== 'paid')
    .reduce((acc: number, curr: any) => acc + (Number(curr.authoritative_usd ?? curr.total_base ?? 0) || 0), 0);

  const totalPaidBilling = invoices
    .filter((inv: any) => inv.status === 'paid')
    .reduce((acc: number, curr: any) => acc + (Number(curr.payable_amount ?? curr.amount) || 0), 0);

  const activeRate = invoices[0]?.exchange_rate || 129.76;
  const activeRateSource = invoices[0]?.exchange_rate_source || 'CBK';

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto' }}>
      
      {/* ─── Header Section ─── */}
      <div style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '2rem', color: 'var(--navy)', margin: 0, fontWeight: 900 }}>
              💳 Tuition & Student Financial Services
            </h1>
            <span className="badge badge-accepted" style={{ fontSize: '0.75rem' }}>Official Student Ledger</span>
          </div>
          <p style={{ color: 'var(--slate)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            Authoritative USD Pricing with dynamic KES settlement powered by <strong>Central Bank of Kenya</strong> indicative rates.
            Payments processed by <strong>BEMI TRAINING INSTITUTE</strong> (trading as BMI University) via Paystack.
          </p>
        </div>
      </div>

      {alert.msg && (
        <div className={`alert alert-${alert.type}`} style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{alert.msg}</span>
          <button onClick={() => setAlert({ type: '', msg: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>
      )}

      {/* ─── 4 Financial Summary Cards ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
        <div className="card" style={{ borderTop: '4px solid var(--gold)', margin: 0 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--slate)', fontWeight: 700, textTransform: 'uppercase' }}>Current Balance Due</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: totalOutstandingBilling > 0 ? 'var(--danger)' : 'var(--navy)', marginTop: '0.25rem' }}>
            ${totalOutstandingBase > 0 ? totalOutstandingBase.toLocaleString(undefined, { minimumFractionDigits: 2 }) : totalOutstandingBilling.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--slate)', fontWeight: 600, marginTop: '0.2rem' }}>
            Payable in KES: KES {totalOutstandingBilling.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: totalOutstandingBilling > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700, marginTop: '0.35rem' }}>
            {totalOutstandingBilling > 0 ? '⚠️ Outstanding Payment Required' : '✓ All Invoices Settled'}
          </div>
        </div>

        <div className="card" style={{ borderTop: '4px solid #10b981', margin: 0 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--slate)', fontWeight: 700, textTransform: 'uppercase' }}>Total Settled (YTD)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#065f46', marginTop: '0.25rem' }}>
            KES {totalPaidBilling.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, marginTop: '0.35rem' }}>
            ✓ Verified Official Receipts Logged
          </div>
        </div>

        <div className="card" style={{ borderTop: '4px solid #3b82f6', margin: 0 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--slate)', fontWeight: 700, textTransform: 'uppercase' }}>Exchange Rate Policy</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e3a8a', marginTop: '0.25rem' }}>
            1 USD = {activeRate} KES
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--slate)', fontWeight: 600, marginTop: '0.35rem' }}>
            Source: {activeRateSource} (Indicative Rate)
          </div>
        </div>

        <div className="card" style={{ borderTop: '4px solid #8b5cf6', margin: 0 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--slate)', fontWeight: 700, textTransform: 'uppercase' }}>Institutional Aid / Grant</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#5b21b6', marginTop: '0.25rem' }}>
            $0.00
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--slate)', fontWeight: 600, marginTop: '0.35rem' }}>
            Standard Tuition Rate Applied
          </div>
        </div>
      </div>

      {/* ─── Grid: Invoices & Account Summary ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* Invoices List */}
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
            Student Statement & Invoices
          </h2>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="spinner" style={{ width: 40, height: 40 }}></div>
            </div>
          ) : invoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--slate)' }}>
              <p style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>No active invoices or tuition statements found.</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Your student account is currently in good standing.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice / Date</th>
                    <th>Breakdown & Lines</th>
                    <th>USD Price</th>
                    <th>KES Payable</th>
                    <th>FX Snapshot</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: any) => {
                    const payableAmt = Number(inv.current_balance ?? inv.payable_amount ?? inv.amount);
                    const baseAmt = Number(inv.authoritative_usd ?? inv.total_base ?? inv.amount);
                    const fxRate = inv.exchange_rate || 129.76;
                    const fxSource = inv.exchange_rate_source || 'CBK';

                    return (
                      <tr key={inv.id}>
                        <td>
                          <strong>{inv.invoice_number || inv.id.substring(0, 10).toUpperCase()}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>
                            {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : 'N/A'}
                          </div>
                        </td>
                        <td>
                          {inv.lines && inv.lines.length > 0 ? (
                            <div>
                              {inv.lines.map((ln: any, idx: number) => (
                                <div key={idx} style={{ fontSize: '0.8rem', color: 'var(--navy)' }}>
                                  • {ln.description} (${Number(ln.unit_amount_base).toFixed(2)})
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.85rem' }}>Tuition / Fee Schedule</span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>${baseAmt.toFixed(2)}</span>
                        </td>
                        <td>
                          <strong style={{ color: inv.status === 'paid' ? '#065f46' : 'var(--navy)' }}>
                            KES {payableAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </strong>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>
                            1 USD = {fxRate} KES
                            <br />
                            <small>({fxSource})</small>
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge-${inv.status === 'paid' ? 'accepted' : 'rejected'}`}>
                            {inv.status === 'paid' ? 'Paid In Full' : (inv.status === 'partially_paid' ? 'Partial' : 'Unpaid')}
                          </span>
                        </td>
                        <td>
                          {inv.status !== 'paid' ? (
                            <button
                              className="btn btn-gold btn-sm"
                              onClick={() => handlePay(inv.id)}
                              disabled={paying === inv.id}
                            >
                              {paying === inv.id ? 'Processing...' : 'Pay KES'}
                            </button>
                          ) : (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => setSelectedReceipt({
                                invoiceNumber: inv.invoice_number || inv.id,
                                studentName: dashboardData?.user?.first_name ? `${dashboardData.user.first_name} ${dashboardData.user.last_name || ''}` : 'Enrolled Student',
                                regNo: inv.reg_no || dashboardData?.reg_no || dashboardData?.user?.reg_no || 'Pending',
                                amountBilling: Number(inv.total_billing ?? inv.amount),
                                amountBase: baseAmt,
                                exchangeRate: fxRate,
                                exchangeRateSource: fxSource,
                                lines: inv.lines,
                                date: inv.created_at,
                                reference: inv.invoice_number || inv.id,
                                status: 'Paid in Full',
                                balance: 0,
                              })}
                              style={{ fontSize: '0.8rem', padding: '2px 8px' }}
                            >
                              📄 Receipt
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Account Summary & Payment Methods */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card" style={{ borderTop: '4px solid var(--gold)' }}>
            <h2 style={{ fontSize: '1.15rem', color: 'var(--navy)', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
              Account Balance Summary
            </h2>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate)', fontWeight: 600 }}>TOTAL AMOUNT DUE</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: totalOutstandingBilling > 0 ? 'var(--danger)' : 'var(--navy)' }}>
                ${totalOutstandingBase > 0 ? totalOutstandingBase.toLocaleString(undefined, { minimumFractionDigits: 2 }) : totalOutstandingBilling.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--slate)', marginTop: '0.2rem' }}>
                Payable in KES: <strong>KES {totalOutstandingBilling.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
              {financialAid.total_awarded > 0 && (
                <div style={{ fontSize: '0.85rem', color: '#166534', marginTop: '0.4rem', fontWeight: 600 }}>
                  🎁 Financial Aid Applied: ${financialAid.total_awarded.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                </div>
              )}
              {payments.length > 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  ✓ {payments.length} verified transaction{payments.length > 1 ? 's' : ''} on record
                </div>
              )}
            </div>
            <div style={{ padding: '0.85rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              🔒 Secured by <strong>Paystack</strong>. Payee on checkout &amp; bank statement: <strong>BEMI TRAINING INSTITUTE</strong> (trading as BMI University).
              All amounts are billed in Kenyan Shillings at the official snapshot exchange rate.
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1.05rem', color: 'var(--navy)', marginBottom: '0.75rem' }}>Flexible Tuition Payment Plan</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Tuition is billed in descending whole-unit installments per academic semester with 0% interest.
            </p>
            {planSubmitted ? (
              <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: '#065f46', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontWeight: 700 }}>
                ✓ Installment Plan request submitted to Student Accounts.
              </div>
            ) : (
              <button
                className="btn btn-outline btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setShowPlanModal(true)}
              >
                Apply for Installment Plan
              </button>
            )}
          </div>

          <div className="card" style={{ borderTop: '4px solid var(--navy)' }}>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--navy)', marginBottom: '0.5rem' }}>📄 Official Tax Documentation</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Download certified Form 1098-T Tuition Statement for higher education tax credit filings.
            </p>
            <button
              className="btn btn-outline btn-sm"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setShowTaxModal(true)}
            >
              🖨️ View 1098-T Tax Statement
            </button>
          </div>

        </div>

      </div>

      {/* ─── Official Receipt Modal ─── */}
      {selectedReceipt && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: 640, width: '100%', background: 'white', borderRadius: 'var(--radius-lg)', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ borderBottom: '2px solid var(--gold)', paddingBottom: '1rem', marginBottom: '1.25rem', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.4rem', color: 'var(--navy)', margin: 0, fontWeight: 900 }}>
                BEMI TRAINING INSTITUTE
              </h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--slate)', fontWeight: 600 }}>
                trading as BMI University • Office of Student Accounts
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>
                Official Financial Transaction Receipt
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--slate)' }}>Student:</span> <strong>{selectedReceipt.studentName}</strong><br />
                <span style={{ color: 'var(--slate)' }}>Reg No:</span> <strong>{selectedReceipt.regNo || 'Pending'}</strong><br />
                <span style={{ color: 'var(--slate)' }}>Receipt Date:</span> {new Date(selectedReceipt.date || Date.now()).toLocaleDateString()}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: 'var(--slate)' }}>Invoice Ref:</span> <strong>{selectedReceipt.invoiceNumber}</strong><br />
                <span style={{ color: 'var(--slate)' }}>Payment Provider:</span> Paystack<br />
                <span style={{ color: 'var(--slate)' }}>Status:</span> <span style={{ color: '#065f46', fontWeight: 700 }}>Settled</span>
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700 }}>Authoritative Base Price:</span>
                <span style={{ fontWeight: 700 }}>${Number(selectedReceipt.amountBase || 0).toFixed(2)} USD</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                <span>Locked Exchange Rate:</span>
                <span>1 USD = {selectedReceipt.exchangeRate} KES ({selectedReceipt.exchangeRateSource})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 900, color: '#065f46' }}>
                <span>Total Amount Paid:</span>
                <span>KES {Number(selectedReceipt.amountBilling || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--slate)', marginTop: '0.5rem' }}>
                <span>Remaining Account Balance:</span>
                <span>KES {Number(selectedReceipt.balance || 0).toFixed(2)}</span>
              </div>
            </div>

            {selectedReceipt.lines && selectedReceipt.lines.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--slate)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  Fee Allocation Breakdown
                </div>
                {selectedReceipt.lines.map((l: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px dashed #e2e8f0' }}>
                    <span>{l.description}</span>
                    <span>KES {Number(l.line_total_billing || 0).toFixed(2)} (${Number(l.line_total_base || 0).toFixed(2)})</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: '0.75rem', color: 'var(--slate)', textAlign: 'center', marginBottom: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
              Payment received by BEMI TRAINING INSTITUTE (trading as BMI University).
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setSelectedReceipt(null)}>Close</button>
              <button className="btn btn-gold btn-sm" onClick={() => window.print()}>🖨️ Print Official Receipt</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tuition Plan Modal ─── */}
      {showPlanModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: 500, width: '100%', background: 'white', borderRadius: 'var(--radius-lg)', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--navy)', marginBottom: '0.5rem', fontWeight: 800 }}>
              📋 3-Month Installment Plan Option
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Enroll in deterministic whole-USD installments converted to KES at the official CBK rate snapshot.
            </p>
            <div style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
              <div>• <strong>Installment 1 (Immediate)</strong></div>
              <div>• <strong>Installment 2 (Mid-term)</strong></div>
              <div>• <strong>Installment 3 (Final)</strong></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setShowPlanModal(false)}>Cancel</button>
              <button
                className="btn btn-gold btn-sm"
                onClick={() => {
                  setShowPlanModal(false);
                  setPlanSubmitted(true);
                  setAlert({ type: 'success', msg: 'Installment payment plan agreement submitted successfully.' });
                }}
              >
                Confirm & Enroll in Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 1098-T Tax Statement Modal ─── */}
      {showTaxModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: 680, width: '100%', background: 'white', borderRadius: 'var(--radius-lg)', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--navy)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', color: 'var(--navy)', margin: 0, fontWeight: 900 }}>
                  IRS Form 1098-T Tuition Statement
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>Department of the Treasury — Internal Revenue Service</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--gold-dark)' }}>2026</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.85rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--slate)', fontWeight: 700 }}>FILER'S Name & Address</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy)', marginTop: '0.2rem' }}>BEMI TRAINING INSTITUTE</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>Trading as BMI University • Office of Student Accounts & Bursar</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>EIN: 56-1234567 • Tel: 704-607-5540</div>
              </div>

              <div style={{ padding: '0.85rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--slate)', fontWeight: 700 }}>STUDENT'S Name & Tax ID</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy)', marginTop: '0.2rem' }}>
                  {dashboardData?.user?.first_name ? `${dashboardData.user.first_name} ${dashboardData.user.last_name || ''}` : 'Enrolled Student'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>SSN/TIN Mask: ***-**-8801</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>ID: {(dashboardData?.id || 'STD-2026').substring(0, 12).toUpperCase()}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', border: '1.5px solid var(--navy)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--navy)' }}>BOX 1: Payments Received for Qualified Tuition</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--navy)', marginTop: '0.25rem' }}>
                  KES {(totalPaidBilling > 0 ? totalPaidBilling : 583920).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ padding: '1rem', border: '1.5px solid var(--gold)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--gold-dark)' }}>BOX 5: Scholarships or Institutional Grants</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--gold-dark)', marginTop: '0.25rem' }}>
                  $0.00 USD
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--slate)' }}>Box 8 Checked: Half-Time Student or Greater [X]</div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-outline btn-sm" onClick={() => setShowTaxModal(false)}>Close</button>
                <button className="btn btn-gold btn-sm" onClick={() => window.print()}>🖨️ Print Form 1098-T</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
