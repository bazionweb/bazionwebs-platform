import Link from "next/link";

export const metadata = {
  title: "Terms of Service & Student Payment Policy | BMI University & BEMI Training Institute",
  description:
    "Official Terms of Service, Tuition Payment Policies, Refund & Cancellation Policy, and Transaction Security Standards for Bethel Ministries International University and BEMI Training Institute.",
};

export default function TermsPage() {
  return (
    <main id="main-content" style={{ background: "#ffffff", minHeight: "100vh", padding: "8.5rem 2rem 6rem", color: "#0f172a" }}>
      <div style={{ maxWidth: "880px", margin: "0 auto" }}>
        {/* ── Page Header ── */}
        <div style={{ marginBottom: "2.5rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              color: "#c5a048",
              fontWeight: 800,
              fontSize: "0.82rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: "0.75rem",
            }}
          >
            <span>⚖️</span> Institutional Policy & Governance
          </div>
          <h1
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 900,
              fontSize: "clamp(2.2rem, 4vw, 3.2rem)",
              color: "#0f172a",
              lineHeight: 1.15,
              marginBottom: "0.75rem",
            }}
          >
            Terms of Service &amp; Student Payment Policy
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.95rem", margin: 0 }}>
            <em>Effective Date: October 2024 &bull; Last Revised: October 2026 &bull; Version 2.4</em>
          </p>
          <div className="gold-bar" style={{ marginTop: "1.5rem" }} />
        </div>

        {/* ── Institutional Notice Banner ── */}
        <div
          style={{
            background: "#f8fafc",
            border: "1.5px solid #e2e8f0",
            borderLeft: "5px solid #c5a048",
            borderRadius: "14px",
            padding: "1.5rem 1.75rem",
            marginBottom: "3rem",
            boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
          }}
        >
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.1rem", color: "#0f172a", margin: "0 0 0.5rem" }}>
            Official Institutional Statement &amp; Merchant of Record
          </h3>
          <p style={{ color: "#475569", fontSize: "0.92rem", lineHeight: 1.7, margin: 0 }}>
            In Kenya and across the African continent, Bethel Ministries International operates through <strong>BEMI TRAINING INSTITUTE</strong> (Registration No. <strong>BN-93SQD5LL</strong>), trading as <strong>BMI University</strong>. All tuition invoices, fee receipts, payment gateways (including <strong>IntaSend</strong> and <strong>Paystack</strong>), and bank account settlements are legally administered by BEMI Training Institute.
          </p>
        </div>

        {/* ── Main Policy Content ── */}
        <div style={{ color: "#334155", fontSize: "1rem", lineHeight: 1.85, display: "flex", flexDirection: "column", gap: "2.5rem" }}>
          
          {/* Section 1 */}
          <section>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.45rem", color: "#0f172a", marginBottom: "0.75rem" }}>
              1. Institutional Identity &amp; Scope of Agreement
            </h2>
            <p>
              These Terms of Service and Student Payment Policy (&ldquo;Terms&rdquo;) govern the relationship between <strong>BEMI Training Institute</strong> (trading as <strong>BMI University</strong>), situated at <strong>Mukurwe-ini Plaza, Mukurweini Road, Nyeri County, Kenya</strong> (P.O. Box 79534 - 00200, City Square), and any applicant, enrolled student, parent, guardian, sponsor, or authorized third-party payer (&ldquo;Student&rdquo; or &ldquo;Payer&rdquo;).
            </p>
            <p>
              By accessing the BMI University student portal, submitting an application, enrolling in academic courses, or initiating any electronic fee payment, the Payer unconditionally accepts and agrees to be bound by these Terms.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.45rem", color: "#0f172a", marginBottom: "0.75rem" }}>
              2. Scope of Educational Services
            </h2>
            <p>
              BEMI Training Institute provides Christian theological formation, executive leadership development, diploma curricula, and degree articulation pathways leading to undergraduate, graduate, and postgraduate qualifications conferred by Bethel Ministries International University.
            </p>
            <p>
              Admissions decisions, academic progression, and degree conferrals remain subject to satisfactory fulfillment of institutional academic integrity guidelines, attendance benchmarks, and complete fee clearance.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.45rem", color: "#0f172a", marginBottom: "0.75rem" }}>
              3. Tuition Schedules, Billing &amp; Settlement Currencies
            </h2>
            <p>
              All academic programs are priced based on the published institutional rate card. The following financial standards apply:
            </p>
            <ul style={{ paddingLeft: "1.5rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <li>
                <strong>Authoritative Pricing Base:</strong> Program tuition rates are benchmarked in United States Dollars (USD) or published Kenyan Shillings (KES) equivalent packages.
              </li>
              <li>
                <strong>Regional Presentation &amp; Settlement:</strong> For students paying within Kenya and East Africa via local payment rails (M-Pesa, local debit cards, PesaLink), fees are settled in <strong>Kenyan Shillings (KES)</strong> based on the snapshot exchange rate aligned with indicative rates published by the Central Bank of Kenya (CBK).
              </li>
              <li>
                <strong>Non-Refundable Onboarding &amp; Application Fees:</strong> The non-refundable Application Fee ($24 / KES equivalent) covers administrative identity validation, academic evaluation, and portal account provisioning.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.45rem", color: "#0f172a", marginBottom: "0.75rem" }}>
              4. Authorized Payment Processors &amp; Security Standards
            </h2>
            <p>
              To guarantee maximum transaction security and compliance with the <strong>National Payment System Act of Kenya</strong> and international card association rules (Visa and Mastercard Core Rules), BEMI Training Institute partners exclusively with Central Bank of Kenya (CBK) licensed Payment Service Providers (PSPs):
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", margin: "1.25rem 0" }}>
              <div style={{ background: "#f8fafc", padding: "1.25rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <strong style={{ color: "#0f172a", display: "block", marginBottom: "0.4rem" }}>📱 IntaSend Payments</strong>
                <span style={{ fontSize: "0.88rem", color: "#64748b" }}>
                  Authorized processing partner for M-Pesa Express (STK Push), Paybill, Till, and East African mobile money collections.
                </span>
              </div>
              <div style={{ background: "#f8fafc", padding: "1.25rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <strong style={{ color: "#0f172a", display: "block", marginBottom: "0.4rem" }}>💳 Paystack Payments</strong>
                <span style={{ fontSize: "0.88rem", color: "#64748b" }}>
                  Authorized processing partner for local/international debit/credit cards (Visa, Mastercard, Amex), Apple Pay, and Pan-African card rails.
                </span>
              </div>
            </div>
            <p>
              <strong>Zero Credential Retention:</strong> BEMI Training Institute does not store, process, or view credit/debit card primary account numbers (PAN), CVV/CVC codes, or student M-Pesa PINs on its web servers. All payment entry points utilize end-to-end tokenization and 256-bit SSL encryption meeting <strong>PCI-DSS Level 1</strong> compliance.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.45rem", color: "#0f172a", marginBottom: "0.75rem" }}>
              5. Official Payee &amp; Statement Descriptors
            </h2>
            <p>
              When completing an electronic fee transaction, the transaction descriptor on the Payer&rsquo;s bank statement, credit card bill, M-Pesa SMS confirmation, or checkout authorization window will appear as:
            </p>
            <div style={{ background: "#f1f5f9", padding: "1rem 1.5rem", borderRadius: "10px", fontFamily: "monospace", fontSize: "0.95rem", color: "#0f172a", borderLeft: "4px solid #c5a048" }}>
              <strong>Merchant / Payee:</strong> BEMI TRAINING INSTITUTE<br />
              <strong>Trading Designation:</strong> BEMI TRAINING INSTITUTE (trading as BMI University)<br />
              <strong>Bank Statement Descriptor:</strong> BEMI*TRAINING &bull; NAIROBI KE
            </div>
            <p style={{ marginTop: "0.85rem" }}>
              Appearance of these merchant identifiers signifies that the payment has cleared directly into the institute&rsquo;s verified treasury accounts.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.45rem", color: "#0f172a", marginBottom: "0.75rem" }}>
              6. Service Delivery &amp; Educational Access Policy
            </h2>
            <p>
              Following payment authorization:
            </p>
            <ul style={{ paddingLeft: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <li>
                <strong>Instant Electronic Receipt:</strong> An automated, cryptographically verifiable electronic receipt is generated immediately upon gateway callback, displaying the unique Paystack or IntaSend transaction reference, time stamp, and amount cleared.
              </li>
              <li>
                <strong>Ledger Crediting:</strong> The student&rsquo;s account in the University Management System (UMS) is updated in real time.
              </li>
              <li>
                <strong>Academic Access Provisioning:</strong> Matriculation clearance, course module materials, LMS classroom credentials, and formal student documentation are activated within <strong>24 to 48 business hours</strong> of tuition clearance.
              </li>
            </ul>
          </section>

          {/* Section 7 — CRITICAL FOR GATEWAY COMPLIANCE */}
          <section style={{ background: "#fdf8ec", border: "1.5px solid #f3d99b", borderRadius: "16px", padding: "2rem" }}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.45rem", color: "#92400e", marginBottom: "0.75rem" }}>
              7. Tuition Refund, Withdrawal &amp; Cancellation Policy
            </h2>
            <p style={{ color: "#78350f" }}>
              To ensure fairness, institutional sustainability, and full adherence to consumer protection benchmarks, the following refund schedule applies to all academic fees:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.25rem" }}>
              <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "10px", border: "1px solid #fde68a" }}>
                <strong style={{ color: "#0f172a" }}>A. Institutional Cancellation (100% Refund):</strong>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.92rem", color: "#475569" }}>
                  If BEMI Training Institute or BMI University cancels, withdraws, or postpones a scheduled cohort or intake before commencement, the student is entitled to a <strong>100% full refund</strong> of all tuition fees paid for that term.
                </p>
              </div>

              <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "10px", border: "1px solid #fde68a" }}>
                <strong style={{ color: "#0f172a" }}>B. Withdrawal Prior to Term Commencement (90% Refund):</strong>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.92rem", color: "#475569" }}>
                  If an enrolled student submits a formal written withdrawal notice to the Registrar before the official published commencement date of instruction, they are eligible for a <strong>90% refund</strong> of tuition paid (10% retained as an administrative matriculation processing charge).
                </p>
              </div>

              <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "10px", border: "1px solid #fde68a" }}>
                <strong style={{ color: "#0f172a" }}>C. Withdrawal Within First 14 Calendar Days (50% Refund):</strong>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.92rem", color: "#475569" }}>
                  If a formal withdrawal is submitted within the first 14 calendar days following the start of classes, the student is eligible for a <strong>50% tuition refund</strong>.
                </p>
              </div>

              <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "10px", border: "1px solid #fde68a" }}>
                <strong style={{ color: "#0f172a" }}>D. Withdrawals After 14 Days (Non-Refundable / Academic Credit):</strong>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.92rem", color: "#475569" }}>
                  Withdrawals submitted after 14 calendar days of term commencement are strictly non-refundable. Students experiencing verified medical or compassionate emergencies may apply to the Academic Board for a <strong>Tuition Deferral Credit</strong> applicable toward the next scheduled academic term.
                </p>
              </div>

              <div style={{ background: "#ffffff", padding: "1.25rem", borderRadius: "10px", border: "1px solid #fde68a" }}>
                <strong style={{ color: "#0f172a" }}>E. Refund Disbursement SLA &amp; Method:</strong>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.92rem", color: "#475569" }}>
                  All approved refunds are disbursed strictly to the <strong>original payment account</strong> (e.g., reversing to the initiating M-Pesa phone number or card account) within <strong>14 to 21 business days</strong> following formal Bursar clearance.
                </p>
              </div>
            </div>
          </section>

          {/* Section 8 */}
          <section>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.45rem", color: "#0f172a", marginBottom: "0.75rem" }}>
              8. Financial Holds &amp; Default Provisions
            </h2>
            <p>
              Failure to settle tuition installments in accordance with the agreed payment schedule will result in administrative holds on the student&rsquo;s account. While an account is in arrears, the student may experience temporary suspension of examination access, grade transcript issuance, and diploma conferral until full balance reconciliation is completed.
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.45rem", color: "#0f172a", marginBottom: "0.75rem" }}>
              9. Payment Inquiries, Discrepancies &amp; Dispute Resolution
            </h2>
            <p>
              In the rare event of a failed transaction, duplicate deduction, or unrecognized debit:
            </p>
            <ul style={{ paddingLeft: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <li>
                <strong>Direct Notification:</strong> Contact the Bursar &amp; Finance Office immediately with your student ID, transaction reference, date, and mobile/card confirmation message.
              </li>
              <li>
                <strong>Response Guarantee:</strong> The Bursar desk acknowledges all financial discrepancy inquiries within <strong>24 business hours</strong> and achieves reconciliation within <strong>3 business days</strong> with the relevant payment gateway.
              </li>
              <li>
                <strong>Contact Email:</strong> <code>finance@bmiuniversities.org</code> &bull; <code>admin@bmiuniversities.org</code>
              </li>
              <li>
                <strong>Helpline:</strong> +254 721 341 793 / +254 704 500 872
              </li>
            </ul>
          </section>

          {/* Section 10 */}
          <section>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.45rem", color: "#0f172a", marginBottom: "0.75rem" }}>
              10. Data Protection &amp; Student Privacy
            </h2>
            <p>
              All personal identifiable information (PII) collected during admissions, tuition payments, and portal authentication is processed in strict compliance with the <strong>Kenya Data Protection Act, 2019 (KDPA)</strong> and international higher education privacy standards. For details on how student records are protected, please review our <Link href="/privacy" style={{ color: "#c5a048", fontWeight: 700, textDecoration: "underline" }}>Privacy Policy</Link>.
            </p>
          </section>

          {/* Section 11 */}
          <section>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.45rem", color: "#0f172a", marginBottom: "0.75rem" }}>
              11. Governing Law &amp; Legal Jurisdiction
            </h2>
            <p>
              These Terms, transactions, and student financial covenants executed within Kenya or across the African continent shall be construed and governed in accordance with the <strong>Laws of the Republic of Kenya</strong>. The parties submit to the jurisdiction of the competent courts in Kenya for the resolution of any dispute arising hereunder.
            </p>
          </section>

          {/* Section 12 */}
          <section style={{ background: "#f8fafc", borderRadius: "14px", padding: "1.75rem", border: "1px solid #e2e8f0" }}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.3rem", color: "#0f172a", marginBottom: "0.75rem" }}>
              12. Official Institutional &amp; Bursar Correspondence
            </h2>
            <div style={{ fontSize: "0.92rem", color: "#475569", lineHeight: 1.7 }}>
              <strong>BEMI TRAINING INSTITUTE</strong><br />
              <em>(trading as Bethel Ministries International University / BMI University)</em><br />
              <strong>Registered Campus:</strong> Mukurwe-ini Plaza, Mukurweini Road, Nyeri County, Kenya<br />
              <strong>Postal Address:</strong> P.O. Box 79534 - 00200, City Square, Kenya<br />
              <strong>Official Email:</strong> admin@bmiuniversities.org / admissions@bmiuniversities.org<br />
              <strong>Bursar &amp; Finance Desk:</strong> finance@bmiuniversities.org<br />
              <strong>Telephone:</strong> +254 721 341 793 / +254 704 500 872
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
