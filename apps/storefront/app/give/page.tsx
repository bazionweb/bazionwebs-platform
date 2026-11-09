"use client";

import { useEffect, useState } from "react";
import {
  ChurchNav,
  ChurchFooter,
  PageHero,
  ScriptureQuote,
} from "@bazion/ui";
import { useMinistrySite } from "../../lib/use-ministry-site";

interface PublicCampaign {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  targetAmountMinor: number;
  raisedAmountMinor: number;
  currency: string;
}

const CATEGORIES = [
  "General Ministry",
  "Worship and Teaching",
  "Community Outreach",
  "Missions",
  "Youth and Families",
  "Other",
];

export default function GivePage() {
  const site = useMinistrySite();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(1000);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [phone, setPhone] = useState("");
  const [donorName, setDonorName] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [campaigns, setCampaigns] = useState<PublicCampaign[]>([]);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "starting" | "pending" | "verified" | "failed">("idle");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<{ idempotencyKey: string; statusToken: string } | null>(null);

  const effectiveAmount = selectedAmount !== null ? selectedAmount : Number(customAmount) || 0;

  useEffect(() => {
    let active = true;
    fetch("/v1/public/church/campaigns")
      .then(async (response) => {
        if (!response.ok) throw new Error("Campaign information is unavailable.");
        return response.json() as Promise<{ campaigns: PublicCampaign[] }>;
      })
      .then((data) => { if (active) setCampaigns(data.campaigns); })
      .catch((error: unknown) => { if (active) setCampaignsError(error instanceof Error ? error.message : "Campaign information is unavailable."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (paymentStatus !== "pending" || !attempt) return;
    let active = true;
    const checkStatus = async () => {
      try {
        const response = await fetch("/v1/public/church/donations/status", {
          headers: { "X-Donation-Status-Token": attempt.statusToken },
        });
        if (!response.ok) return;
        const data = await response.json() as { status?: string; paymentStatus?: string; providerReference?: string | null };
        if (!active) return;
        if (data.paymentStatus === "verified" && data.status === "succeeded") {
          setPaymentReference(data.providerReference ?? null);
          setPaymentMessage("Safaricom confirmed your donation.");
          setPaymentStatus("verified");
        } else if (data.paymentStatus === "failed" || data.status === "failed") {
          setPaymentMessage("Safaricom did not complete this payment. No donation was recorded as received.");
          setPaymentStatus("failed");
        }
      } catch {
        // Keep the attempt pending and retry; never translate a network error into payment success.
      }
    };
    void checkStatus();
    const timer = window.setInterval(() => { void checkStatus(); }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [attempt, paymentStatus]);

  const handleMpesaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isSafeInteger(effectiveAmount) || effectiveAmount < 10) {
      setPaymentError("Please enter a whole KES amount of at least 10.");
      return;
    }
    const paymentAttempt = {
      idempotencyKey: crypto.randomUUID(),
      statusToken: `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`,
    };
    setAttempt(paymentAttempt);
    setPaymentStatus("starting");
    setPaymentError(null);
    setPaymentMessage("");
    setPaymentReference(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/v1/public/church/donations/mpesa-stk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": paymentAttempt.idempotencyKey,
          "X-Donation-Status-Token": paymentAttempt.statusToken,
        },
        body: JSON.stringify({
          amount: effectiveAmount,
          phoneNumber: phone.trim(),
          givingCategory: category,
          ...(selectedCampaignId ? { campaignId: selectedCampaignId } : {}),
          donorName: donorName.trim() || undefined,
          anonymous: !donorName.trim(),
          privacyConsent: true,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setPaymentStatus(data?.error === "PAYMENT_REQUEST_REJECTED" ? "failed" : "idle");
        setPaymentError(typeof data?.message === "string" ? data.message : site.giving.mpesaPaybill
          ? "Online giving is unavailable. Use the Paybill instructions on this page."
          : "Online giving is unavailable. Contact the ministry to confirm current giving options.");
        if (response.status === 503 || response.status === 502) setAttempt(null);
        return;
      }
      setPaymentMessage(typeof data?.message === "string" ? data.message : "Payment request received; waiting for Safaricom confirmation.");
      setPaymentStatus(data?.status === "failed" ? "failed" : "pending");
    } catch (error) {
      setPaymentMessage("We could not confirm whether Safaricom received the request. Checking payment status; do not submit another payment yet.");
      setPaymentError(error instanceof Error ? error.message : "The request status is unknown.");
      setPaymentStatus("pending");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ChurchNav
        ministryName={site.ministryName}
        logoUrl={site.branding.logoUrl}
        currentPath="/give"
        giveHref="/give"
      />

      <main id="main-content">
        {/* 1. Page Hero */}
        <PageHero
          eyebrow="PARTNER WITH THE MISSION"
          title="Partner With Us in the"
          highlightedTitle="Work of God"
          subtitle={`Your gift can support the programs and priorities of ${site.ministryName}.`}
          bgImageUrl={site.branding.heroBgUrl}
        />

        {/* 2. Giving Options: Online M-Pesa STK Push & Direct Paybill */}
        <section className="ch-section">
          <div className="ch-container">
            <div className="ch-grid-2" style={{ alignItems: "start" }}>
              {/* Left Column: Direct M-Pesa Instructions Card */}
              <div>
                {site.giving.mpesaPaybill && site.giving.accountName ? <>
                <span className="ch-eyebrow">Mobile Money Giving</span>
                <h2 className="ch-title">Give via M-Pesa Paybill</h2>
                <p className="ch-subtitle" style={{ marginBottom: "28px" }}>
                  Use the ministry&apos;s Paybill details below, or request an M-Pesa prompt when online giving is available. Your mobile provider may apply its usual transaction fees.
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
                      M-Pesa Paybill
                    </strong>
                  </div>

                  <div style={{ display: "grid", gap: "16px", marginBottom: "24px" }}>
                    <div>
                      <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "#94a3b8" }}>
                        Business / Paybill Number
                      </div>
                      <div style={{ fontSize: "32px", fontWeight: 900, letterSpacing: "1px", color: "#ffffff" }}>
                        {site.giving.mpesaPaybill}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "#94a3b8" }}>
                        Account Number
                      </div>
                      <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--church-accent)" }}>
                        {site.giving.accountName}
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
                    {site.giving.instructions}
                  </div>
                </div>

                {/* Contact details for other giving methods */}
                <div
                  style={{
                    padding: "24px",
                    borderRadius: "var(--church-radius)",
                    border: "1px solid var(--church-border)",
                    backgroundColor: "var(--church-bg-alt)",
                  }}
                >
                  <h4 style={{ margin: "0 0 8px 0", color: "var(--church-primary)" }}>
                    Need another giving option?
                  </h4>
                  <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6, color: "var(--church-text-muted)" }}>
                    Contact the ministry for available giving methods. {site.contact.phones.join(" · ")} {site.contact.email}
                  </p>
                </div>
                </> : <div className="ch-card"><div className="ch-card-body">
                  <span className="ch-eyebrow">Giving details</span>
                  <h2 className="ch-title">Contact the ministry</h2>
                  <p className="ch-subtitle">Manual giving instructions have not been published. Contact the ministry for current details.</p>
                  {site.contact.phones.map((phone) => <p key={phone}><a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>{phone}</a></p>)}
                  {site.contact.email && <p><a href={`mailto:${site.contact.email}`}>{site.contact.email}</a></p>}
                </div></div>}
              </div>

              {/* Right Column: Online M-Pesa STK Push Form */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  padding: "36px",
                  borderRadius: "var(--church-radius-lg)",
                  border: "1px solid var(--church-border)",
                  boxShadow: "var(--church-shadow)",
                }}
              >
                {paymentStatus === "pending" || paymentStatus === "verified" || paymentStatus === "failed" ? (
                  <div style={{ textAlign: "center", padding: "30px 0" }}>
                    <div style={{ fontSize: "52px", marginBottom: "16px" }}>{paymentStatus === "verified" ? "✅" : paymentStatus === "failed" ? "⚠️" : "📲"}</div>
                    <h3 style={{ fontSize: "22px", color: "var(--church-primary)", marginBottom: "8px" }}>
                      {paymentStatus === "verified" ? "Donation Confirmed" : paymentStatus === "failed" ? "Payment Not Completed" : "Waiting for Payment Confirmation"}
                    </h3>
                    <p style={{ fontSize: "15px", color: "var(--church-text)", lineHeight: 1.6, marginBottom: "20px" }}>
                      {paymentMessage || `Check ${phone} for an M-Pesa prompt and approve it to continue.`}
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
                      {paymentStatus === "verified"
                        ? <>Payment reference: <strong>{paymentReference ?? "confirmed"}</strong>. Fund: <em>{category}</em>.</>
                        : paymentStatus === "failed"
                          ? "The payment was not counted as received. You can start a new attempt if you want to try again."
                          : "Your donation is not recorded as received until Safaricom confirmation arrives."}
                    </div>
                    <button
                      type="button"
                      className="ch-btn ch-btn-outline"
                      disabled={paymentStatus === "pending"}
                      onClick={() => { setPaymentStatus("idle"); setPaymentError(null); setAttempt(null); setPaymentMessage(""); setPrivacyConsent(false); }}
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
                      Submit a payment request. It will remain pending until Safaricom confirms it.
                    </p>
                    {paymentError && <p role="alert" style={{ color: "#b91c1c" }}>{paymentError}</p>}

                    {/* Amount Chips */}
                    <div>
                      <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>
                        Select Donation Amount (KES) *
                      </label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                        {site.giving.suggestedAmounts.map((amt) => {
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
                        <label htmlFor="custom-giving-amount" style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Custom amount (KES)</label>
                        <input
                          id="custom-giving-amount"
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
                      <label htmlFor="giving-category" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>
                        Giving Category / Purpose *
                      </label>
                      <select
                        id="giving-category"
                        value={selectedCampaignId ? `campaign:${selectedCampaignId}` : `category:${category}`}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value.startsWith("campaign:")) {
                            const campaign = campaigns.find((item) => item.id === value.slice("campaign:".length));
                            setSelectedCampaignId(campaign?.id ?? "");
                            if (campaign) setCategory(campaign.title.slice(0, 80));
                          } else {
                            setSelectedCampaignId("");
                            setCategory(value.slice("category:".length));
                          }
                        }}
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
                          <option key={c} value={`category:${c}`}>{c}</option>
                        ))}
                        {campaigns.length > 0 && <optgroup label="Active campaigns">
                          {campaigns.map((campaign) => <option key={campaign.id} value={`campaign:${campaign.id}`}>{campaign.title}</option>)}
                        </optgroup>}
                      </select>
                    </div>

                    {/* Donor Phone */}
                    <div>
                      <label htmlFor="giving-phone" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>
                        M-Pesa Mobile Number *
                      </label>
                      <input
                        id="giving-phone"
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
                      <label htmlFor="giving-donor-name" style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>
                        Donor Name (Optional — Leave blank for anonymous giving)
                      </label>
                      <input
                        id="giving-donor-name"
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

                    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, lineHeight: 1.6 }}>
                      <input type="checkbox" required checked={privacyConsent} onChange={(event) => setPrivacyConsent(event.target.checked)} style={{ marginTop: 3, minWidth: 18, minHeight: 18 }} />
                      <span>I understand that these details are used to process and reconcile this gift. Payment processing is handled by Safaricom M-Pesa. Read the <a href="/privacy">privacy notice</a>.</span>
                    </label>

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
              {campaigns.map((camp) => {
                const targetAmount = camp.targetAmountMinor / 100;
                const raisedAmount = camp.raisedAmountMinor / 100;
                const pct = targetAmount > 0 ? Math.min(100, Math.round((raisedAmount / targetAmount) * 100)) : 0;
                return (
                  <div key={camp.id} className="ch-card">
                    <div className="ch-card-body">
                      <span className="ch-sermon-badge">Campaign</span>
                      <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 10px 0", color: "var(--church-primary)" }}>
                        {camp.title}
                      </h3>
                      <p style={{ fontSize: "14px", color: "var(--church-text-muted)", lineHeight: 1.6, marginBottom: "20px" }}>
                        {camp.description ?? "Support this ministry campaign."}
                      </p>

                      <div style={{ marginTop: "auto" }}>
                        {/* Progress Bar */}
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                          <span>Raised: <strong>{camp.currency} {raisedAmount.toLocaleString()}</strong></span>
                          <span>Target: <strong>{camp.currency} {targetAmount.toLocaleString()}</strong></span>
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
                            setSelectedCampaignId(camp.id);
                            setCategory(camp.title.slice(0, 80));
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
              {campaignsError && <p role="status">{campaignsError}</p>}
              {!campaignsError && campaigns.length === 0 && <p>No active campaigns are available right now. You can still choose a general giving category above.</p>}
            </div>
          </div>
        </section>

        {site.scripture.verse && <div className="ch-container">
          <ScriptureQuote
            verse={site.scripture.verse}
            reference={site.scripture.reference}
            version={site.scripture.version || undefined}
          />
        </div>}
      </main>

      <ChurchFooter
        ministryName={site.ministryName}
        tagline={site.tagline}
        phoneNumbers={site.contact.phones}
        email={site.contact.email}
        address={site.contact.address}
      />
    </>
  );
}
