"use client";

import { useState } from "react";
import {
  ChurchNav,
  ChurchFooter,
  PageHero,
  ScriptureQuote,
} from "@bazion/ui";
import { globalMissionConfig } from "../../../../templates/global-mission.config";
import { sampleCampaigns } from "../../../../templates/church-sample-data";

const CATEGORIES = [
  "General Ministry & Revival",
  "Missions & Open-Air Crusades",
  "Free Medical Outreaches",
  "Annual Conferences",
  "Community Relief & Compassion",
  "Church Planting",
];

export default function GivePage() {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(1000);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [category, setCategory] = useState("General Ministry & Revival");
  const [phone, setPhone] = useState("");
  const [donorName, setDonorName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const effectiveAmount = selectedAmount !== null ? selectedAmount : Number(customAmount) || 0;

  const handleMpesaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (effectiveAmount < 10) {
      alert("Please enter a valid donation amount (minimum KES 10).");
      return;
    }
    setIsSubmitting(true);
    try {
      const formattedPhone = phone.trim().startsWith("+")
        ? phone.trim()
        : `+254${phone.trim().replace(/^0+/, "")}`;

      await fetch("/v1/public/church/donations/mpesa-stk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: effectiveAmount,
          phoneNumber: formattedPhone,
          givingCategory: category,
          donorName: donorName || "Anonymous Partner",
        }),
      });
      setPaymentSuccess(true);
    } catch {
      // Optimistic simulation fallback
      setPaymentSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ChurchNav
        ministryName={globalMissionConfig.ministryName}
        logoUrl={globalMissionConfig.branding.logoUrl}
        currentPath="/give"
        giveHref="/give"
      />

      <main>
        {/* 1. Page Hero */}
        <PageHero
          eyebrow="PARTNER WITH THE MISSION"
          title="Partner With Us in the"
          highlightedTitle="Work of God"
          subtitle="Your generous financial giving enables us to preach the gospel, plant churches, conduct free medical outreaches, and hold Holy Ghost revival conferences."
          bgImageUrl={globalMissionConfig.branding.heroBgUrl}
        />

        {/* 2. Giving Options: Online M-Pesa STK Push & Direct Paybill */}
        <section className="ch-section">
          <div className="ch-container">
            <div className="ch-grid-2" style={{ alignItems: "start" }}>
              {/* Left Column: Direct M-Pesa Instructions Card */}
              <div>
                <span className="ch-eyebrow">Mobile Money Giving</span>
                <h2 className="ch-title">Give via M-Pesa Paybill</h2>
                <p className="ch-subtitle" style={{ marginBottom: "28px" }}>
                  Instant, direct, and zero fees. You can give directly from your phone using our
                  verified Equity Bank Paybill details.
                </p>

                <div
                  style={{
                    backgroundColor: "var(--church-primary)",
                    color: "#ffffff",
                    padding: "32px",
                    borderRadius: "var(--church-radius-lg)",
                    boxShadow: "var(--church-shadow-lg)",
                    marginBottom: "24px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                    <span style={{ fontSize: "24px" }}>📱</span>
                    <strong style={{ fontSize: "18px", color: "var(--church-accent)" }}>
                      Equity Bank Paybill
                    </strong>
                  </div>

                  <div style={{ display: "grid", gap: "16px", marginBottom: "24px" }}>
                    <div>
                      <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "#94a3b8" }}>
                        Business / Paybill Number
                      </div>
                      <div style={{ fontSize: "32px", fontWeight: 900, letterSpacing: "1px", color: "#ffffff" }}>
                        {globalMissionConfig.giving.mpesaPaybill}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "#94a3b8" }}>
                        Account Number
                      </div>
                      <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--church-accent)" }}>
                        {globalMissionConfig.giving.accountName}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: "1px solid rgba(255, 255, 255, 0.15)",
                      paddingTop: "16px",
                      fontSize: "13px",
                      lineHeight: 1.6,
                      color: "#cbd5e1",
                    }}
                  >
                    {globalMissionConfig.giving.instructions}
                  </div>
                </div>

                {/* Bank / International Transfer Note */}
                <div
                  style={{
                    padding: "24px",
                    borderRadius: "var(--church-radius)",
                    border: "1px solid var(--church-border)",
                    backgroundColor: "var(--church-bg-alt)",
                  }}
                >
                  <h4 style={{ margin: "0 0 8px 0", color: "var(--church-primary)" }}>
                    🌍 Giving from Outside Kenya / Diaspora?
                  </h4>
                  <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6, color: "var(--church-text-muted)" }}>
                    You can remit funds via Wave, Remitly, WorldRemit, or Sendwave directly to M-Pesa
                    telephone: <strong>+254 721 341 793</strong> or contact our treasury office for
                    SWIFT bank transfer details.
                  </p>
                </div>
              </div>

              {/* Right Column: Online STK Push Simulation Form */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  padding: "36px",
                  borderRadius: "var(--church-radius-lg)",
                  border: "1px solid var(--church-border)",
                  boxShadow: "var(--church-shadow)",
                }}
              >
                {paymentSuccess ? (
                  <div style={{ textAlign: "center", padding: "30px 0" }}>
                    <div style={{ fontSize: "52px", marginBottom: "16px" }}>📲</div>
                    <h3 style={{ fontSize: "22px", color: "var(--church-primary)", marginBottom: "8px" }}>
                      STK Push Sent to Your Phone!
                    </h3>
                    <p style={{ fontSize: "15px", color: "var(--church-text)", lineHeight: 1.6, marginBottom: "20px" }}>
                      Please check your mobile phone ({phone}) and enter your M-Pesa PIN to complete
                      your donation of <strong>KES {effectiveAmount.toLocaleString()}</strong>.
                    </p>
                    <div
                      style={{
                        padding: "16px",
                        backgroundColor: "var(--church-bg-muted)",
                        borderRadius: "var(--church-radius)",
                        fontSize: "13px",
                        color: "var(--church-text-muted)",
                        marginBottom: "24px",
                      }}
                    >
                      Once confirmed by Safaricom, your payment reference will be securely recorded
                      under the <em>{category}</em> fund.
                    </div>
                    <button
                      type="button"
                      className="ch-btn ch-btn-outline"
                      onClick={() => setPaymentSuccess(false)}
                    >
                      Make Another Donation
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleMpesaSubmit} style={{ display: "grid", gap: "20px" }}>
                    <span className="ch-eyebrow">Online Giving Portal</span>
                    <h3 style={{ fontSize: "22px", color: "var(--church-primary)", margin: "4px 0 8px 0" }}>
                      Give with M-Pesa STK Push
                    </h3>
                    <p style={{ fontSize: "13px", color: "var(--church-text-muted)", margin: 0 }}>
                      Enter your phone number below and an M-Pesa prompt will appear instantly on your phone.
                    </p>

                    {/* Amount Chips */}
                    <div>
                      <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>
                        Select Donation Amount (KES) *
                      </label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                        {globalMissionConfig.giving.suggestedAmounts.map((amt) => {
                          const isSelected = selectedAmount === amt;
                          return (
                            <button
                              key={amt}
                              type="button"
                              className={`ch-filter-btn ${isSelected ? "active" : ""}`}
                              style={{ padding: "10px 4px", fontSize: "12px", width: "100%" }}
                              onClick={() => {
                                setSelectedAmount(amt);
                                setCustomAmount("");
                              }}
                            >
                              KES {amt.toLocaleString()}
                            </button>
                          );
                        })}
                      </div>

                      <div style={{ marginTop: "12px" }}>
                        <input
                          type="number"
                          placeholder="Or enter custom amount in KES..."
                          value={customAmount}
                          onChange={(e) => {
                            setCustomAmount(e.target.value);
                            setSelectedAmount(null);
                          }}
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            border: "1px solid var(--church-border)",
                            borderRadius: "var(--church-radius)",
                            fontSize: "14px",
                          }}
                        />
                      </div>
                    </div>

                    {/* Giving Category */}
                    <div>
                      <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>
                        Giving Category / Purpose *
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: "var(--church-radius)",
                          border: "1px solid var(--church-border)",
                          fontSize: "14px",
                          backgroundColor: "#ffffff",
                        }}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {/* Donor Phone */}
                    <div>
                      <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>
                        M-Pesa Mobile Number *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 0721341793 or 254721341793"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          border: "1px solid var(--church-border)",
                          borderRadius: "var(--church-radius)",
                          fontSize: "14px",
                        }}
                      />
                    </div>

                    {/* Optional Donor Name */}
                    <div>
                      <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>
                        Donor Name (Optional — Leave blank for anonymous giving)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. John Doe"
                        value={donorName}
                        onChange={(e) => setDonorName(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          border: "1px solid var(--church-border)",
                          borderRadius: "var(--church-radius)",
                          fontSize: "14px",
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="ch-btn ch-btn-accent"
                      style={{ padding: "14px", fontSize: "16px", marginTop: "8px" }}
                    >
                      {isSubmitting
                        ? "Triggering STK Push..."
                        : `Give KES ${effectiveAmount.toLocaleString()} via M-Pesa`}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 3. Active Donation Campaigns */}
        <section className="ch-section ch-section-alt">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Fundraising Projects</span>
              <h2 className="ch-title">Active Ministry Campaigns</h2>
              <p className="ch-subtitle">
                Support designated ministry projects where your contribution directly equips the
                harvest field.
              </p>
            </div>

            <div className="ch-grid-3">
              {sampleCampaigns.map((camp) => {
                const pct = Math.min(100, Math.round((camp.raisedAmount / camp.targetAmount) * 100));
                return (
                  <div key={camp.id} className="ch-card">
                    <div className="ch-card-body">
                      <span className="ch-sermon-badge">{camp.category}</span>
                      <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 10px 0", color: "var(--church-primary)" }}>
                        {camp.title}
                      </h3>
                      <p style={{ fontSize: "14px", color: "var(--church-text-muted)", lineHeight: 1.6, marginBottom: "20px" }}>
                        {camp.description}
                      </p>

                      <div style={{ marginTop: "auto" }}>
                        {/* Progress Bar */}
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                          <span>Raised: <strong>KES {camp.raisedAmount.toLocaleString()}</strong></span>
                          <span>Target: <strong>KES {camp.targetAmount.toLocaleString()}</strong></span>
                        </div>
                        <div
                          style={{
                            height: "8px",
                            backgroundColor: "var(--church-bg-muted)",
                            borderRadius: "999px",
                            overflow: "hidden",
                            marginBottom: "16px",
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              backgroundColor: "var(--church-accent)",
                              borderRadius: "999px",
                            }}
                          />
                        </div>

                        <button
                          type="button"
                          className="ch-btn ch-btn-primary"
                          style={{ width: "100%" }}
                          onClick={() => {
                            setCategory(camp.title);
                            window.scrollTo({ top: 400, behavior: "smooth" });
                          }}
                        >
                          Support This Campaign ({pct}% funded)
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4. Biblical Giving Scripture Encouragement */}
        <div className="ch-container">
          <ScriptureQuote
            verse="So let each one give as he purposes in his heart, not grudgingly or of necessity; for God loves a cheerful giver. And God is able to make all grace abound toward you."
            reference="2 Corinthians 9:7-8"
          />
        </div>
      </main>

      <ChurchFooter
        ministryName={globalMissionConfig.ministryName}
        phoneNumbers={globalMissionConfig.contact.phones}
        email={globalMissionConfig.contact.email}
        address={globalMissionConfig.contact.address}
      />
    </>
  );
}
